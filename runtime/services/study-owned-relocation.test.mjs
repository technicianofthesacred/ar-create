import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {digest} from './files.mjs';
import {createStudyDraftCopies} from './study-draft-copies.mjs';
const raw='---\ntitle: Synthetic\n---\n\nAlpha words.\n\nBeta words.\n';
const stamp=p=>{const s=fs.lstatSync(p);return {path:p,dev:s.dev,ino:s.ino};};
const scope=d=>({bindingId:d.binding.id,parentStudyId:'synthetic'});
const edit=(d,word='Clear')=>{const p=d.projection.find(p=>p.words==='Beta words.');return {...scope(d),operationId:randomUUID(),expected:d.expected,operations:[{kind:'text',id:p.id,from:0,to:4,insert:word,seenBlockHash:p.blockHash}]};};
async function fixture(t,extra={}){
 const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-owner-relocation-')));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const old=path.join(temp,'old'),dest=path.join(temp,'new');fs.mkdirSync(old);
 const originals={catalog:()=>({drafts:[]}),read:()=>({id:'original',parentStudyKey:'synthetic',partKey:'1',title:'Synthetic',records:[{id:'draft',role:'draft',path:'/synthetic/DEV - Example.md',raw,hash:digest(raw)},{id:'source',role:'source',path:'/synthetic/SRC - Example.md',raw:'Source words.',hash:digest('Source words.')}]})};
 const service=createStudyDraftCopies({dataDir:old,originals,...extra});const opened=await service.openCopy({originalId:'original',originalHash:digest(raw),parentStudyId:'synthetic',operationId:randomUUID()});
 function migrate(){
  fs.cpSync(old,dest,{recursive:true,preserveTimestamps:true});const room=path.join(old,'study-draft-copies/copies',opened.binding.id),newRoom=path.join(dest,'study-draft-copies/copies',opened.binding.id),bindingFile=path.join(room,'metadata/ar-project-folder-bindings',opened.binding.id+'.json'),bindingRaw=fs.readFileSync(bindingFile),binding=JSON.parse(bindingRaw),captured=JSON.parse(fs.readFileSync(path.join(room,'capture-manifest.json')));
  const roots={};for(const [k,suffix] of Object.entries({'roots.media':'media','roots.workflow':'workflow',media:'media/Project',derived:'workflow/Derived'}))roots[k]={before:k.startsWith('roots.')?binding.roots[k.slice(6)]:binding[k],after:stamp(path.join(newRoom,suffix))};
  const manifest={schema:'ar-create.study-owned-relocation.v1',legacyDataRoot:old,dataRoot:dest,bindings:[{bindingId:opened.binding.id,bindingHash:digest(bindingRaw),roots,captures:captured.records.filter(r=>!r.missing).map(r=>({copiedPath:r.copiedPath,copiedHash:r.copiedHash,relocatedPath:path.join(newRoom,'capture',path.basename(r.copiedPath))}))}]};
  fs.renameSync(old,old+'-unavailable');return {manifest,newRoom,bindingRaw,bindingFile:path.join(newRoom,'metadata/ar-project-folder-bindings',opened.binding.id+'.json'),service:createStudyDraftCopies({dataDir:dest,originals,studyRelocation:manifest}),dest};
 }
 return {service,opened,migrate,dest,originals};
}
function fileHashes(root){const out={};function visit(p){for(const n of fs.readdirSync(p)){const f=path.join(p,n);if(fs.statSync(f).isDirectory())visit(f);else out[path.relative(root,f)]=digest(fs.readFileSync(f));}}visit(root);return out;}
test('relocated owner preserves binding CAS, historical context, paragraph identities and saved Undo with old root unavailable',async t=>{
 const f=await fixture(t),request=edit(f.opened),saved=await f.service.save(request),m=f.migrate(),before=fileHashes(m.dest),read=await m.service.read(scope(saved));
 assert.deepEqual(read.expected,saved.expected);assert.deepEqual(read.projection,saved.projection);assert.deepEqual(read.context,saved.context);assert.deepEqual(fileHashes(m.dest),before);assert.deepEqual(fs.readFileSync(m.bindingFile),m.bindingRaw);
 assert.equal((await m.service.save(request)).raw,saved.raw);
 const undone=await m.service.undo({...scope(read),operationId:randomUUID(),expected:read.expected,undoOperationId:request.operationId});assert.equal(undone.raw,raw);assert.deepEqual(undone.projection.map(p=>p.id),f.opened.projection.map(p=>p.id));
 const changed=await m.service.save(edit(undone,'Fresh'));assert.match(changed.raw,/Fresh words/);assert.equal(changed.expected.bindingHash,f.opened.expected.bindingHash);assert.deepEqual(fs.readFileSync(m.bindingFile),m.bindingRaw);
});
test('prepared native operation recovers with exact request UUID and hashes after relocation',async t=>{
 let armed=false;const f=await fixture(t,{afterCommit:(_c,i)=>{if(armed&&i===0){armed=false;throw Error('synthetic interruption');}}}),request=edit(f.opened);armed=true;await assert.rejects(f.service.save(request),/interruption/);
 const m=f.migrate(),pending=await m.service.read(scope(f.opened));assert.equal(pending.readiness.ready,false);const recovered=await m.service.recover({...scope(f.opened),operationId:request.operationId});assert.equal(recovered.readiness.ready,true);assert.match(recovered.raw,/Clear words/);assert.equal((await m.service.save(request)).raw,recovered.raw);
});
test('relocation refuses missing capability, changed binding, changed roots, symlinks and capture drift',async t=>{
 for(const kind of ['missing','binding','root','symlink','capture','wrong-capture','wrong-before']){
  const f=await fixture(t),m=f.migrate(),manifest=structuredClone(m.manifest);let service=m.service;
  if(kind==='missing')service=createStudyDraftCopies({dataDir:m.dest,originals:f.originals});
  if(kind==='binding')fs.appendFileSync(m.bindingFile,' ');
  if(kind==='root'){const p=manifest.bindings[0].roots.media.after.path;fs.renameSync(p,p+'-saved');fs.mkdirSync(p);}
  if(kind==='symlink'){const p=manifest.bindings[0].roots.media.after.path;fs.renameSync(p,p+'-saved');fs.symlinkSync(p+'-saved',p);}
  if(kind==='capture'){const p=manifest.bindings[0].captures[0].relocatedPath;fs.chmodSync(p,0o600);fs.writeFileSync(p,'Changed');}
  if(kind==='wrong-capture'){manifest.bindings[0].captures[0].copiedPath='/outside/capture/file';assert.throws(()=>createStudyDraftCopies({dataDir:m.dest,originals:f.originals,studyRelocation:manifest}));continue;}
  if(kind==='wrong-before'){manifest.bindings[0].roots.media.before.ino++;service=createStudyDraftCopies({dataDir:m.dest,originals:f.originals,studyRelocation:manifest});}
  const before=fileHashes(m.dest);await assert.rejects(service.read(scope(f.opened)));assert.deepEqual(fileHashes(m.dest),before);
 }
});
test('a restart that renumbers the disk keeps both a bound piece and a relocated proof opening',async t=>{
 // After a restart macOS can report the same disk under a new number (dev). Recorded folder stamps keep the old one.
 const f=await fixture(t),old=path.join(path.dirname(f.dest),'old'),m=f.migrate(),original={};
 for(const name of ['lstatSync','statSync','fstatSync']){original[name]=fs[name];fs[name]=(...a)=>{const s=original[name](...a);if(s&&Number.isSafeInteger(s.dev))Object.defineProperty(s,'dev',{value:s.dev+1});return s;};}
 t.after(()=>Object.assign(fs,original));
 const relocated=createStudyDraftCopies({dataDir:m.dest,originals:f.originals,studyRelocation:m.manifest});
 assert.equal((await relocated.read(scope(f.opened))).binding.id,f.opened.binding.id);
 fs.renameSync(old+'-unavailable',old);
 const bound=createStudyDraftCopies({dataDir:old,originals:f.originals});
 assert.equal((await bound.read(scope(f.opened))).binding.id,f.opened.binding.id);
});
