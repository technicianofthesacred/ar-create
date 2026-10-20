import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createLibrary} from '../runtime/services/library.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
function setup(t) {
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'catalog-hook-')));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const dataDir=path.join(home,'data'),root=path.join(home,'kept');fs.mkdirSync(dataDir);fs.mkdirSync(root);fs.mkdirSync(path.join(root,'visit'));
 const provenance={original:{sourceId:randomUUID()},corrected:null,translation:{sourceId:randomUUID()},audio:[],speakerUncertainty:[{speaker:'unknown',reason:'Not identified'}]};
 const a={id:randomUUID(),rel_path:'visit/one.md',title:'First session',transcriptProvenance:provenance},b={id:randomUUID(),rel_path:'two.txt',title:'Second session',transcriptProvenance:{original:{sourceId:randomUUID()},speakerUncertainty:[]}};
 fs.writeFileSync(path.join(root,a.rel_path),'---\nkind: transcript\n---\n\nUnknown: Invented tea conversation.\n');fs.writeFileSync(path.join(root,b.rel_path),'Invented second conversation.\n');fs.writeFileSync(path.join(root,'unkept.md'),'Must never be discovered.');fs.writeFileSync(path.join(root,'.secret.md'),'Not a catalog entry.');
 let entries=[a,b];const catalog={id:'kept-transcripts',name:'Kept conversations',path:root,entries:()=>{if(entries instanceof Error)throw entries;return entries;}};
 const library=createLibrary({dataDir,retainedCatalog:catalog});return {library,dataDir,root,a,b,catalog,setEntries:value=>entries=value};
}
test('exact supplied membership, origin bytes, UUIDs, provenance, title changes and external updates',async t=>{
 const f=setup(t);let view=await f.library.tree();let root=view.roots.find(r=>r.id===f.catalog.id);
 assert.equal(root.tree.total_count,2);assert.equal(root.tree.file_count,1);assert.equal(root.tree.folders[0].file_count,1);assert.deepEqual(view.sources.map(s=>s.id).sort(),[f.a.id,f.b.id].sort());
 let source=await f.library.read(f.a.id);assert.equal(source.path,path.join(f.root,f.a.rel_path));assert.equal(source.writable,false);assert.deepEqual(source.transcriptProvenance,f.a.transcriptProvenance);
 const bytes=fs.readFileSync(source.path);assert.equal(source.raw,bytes.toString());assert.equal(source.hash,hash(bytes));
 const snapshot=await f.library.snapshot(f.a.id,{includeBody:true});assert.equal(snapshot.raw,bytes.toString());assert.equal(snapshot.hash,hash(bytes));assert.deepEqual(snapshot.transcriptProvenance,f.a.transcriptProvenance);
 const blob=await f.library.blob(f.a.id);assert.equal(blob.file,source.path);assert.equal(hash(fs.readFileSync(blob.file)),snapshot.hash);
 f.a.title='Renamed session';fs.writeFileSync(source.path,'---\nkind: transcript\n---\n\nUnknown: Changed outside AR.\n');
 source=await f.library.read(f.a.id);assert.equal(source.title,'Renamed session');assert.equal(source.id,f.a.id);assert.equal(source.hash,hash(fs.readFileSync(source.path)));
 const reopened=createLibrary({dataDir:f.dataDir,retainedCatalog:f.catalog});assert.equal((await reopened.read(f.a.id)).id,f.a.id);
 await f.library.setConnections([]);assert.equal((await f.library.tree()).roots.find(r=>r.id===f.catalog.id).tree.total_count,2);
 assert.equal(fs.existsSync(path.join(f.dataDir,'source-originals')),false);
});
test('all file mutation entrances refuse catalog root',async t=>{
 const f=setup(t);await f.library.tree();const source=await f.library.read(f.a.id),bytes=fs.readFileSync(source.path);
 for(const operation of [()=>f.library.write({id:f.a.id,expectedHash:source.hash,content:'changed'}),()=>f.library.rename({id:f.a.id,expectedHash:source.hash,toPath:'moved.md'}),()=>f.library.folder({rootId:f.catalog.id,folder:'new'}),()=>f.library.import({rootId:f.catalog.id,files:[]})])await assert.rejects(operation,error=>error.status===403);
 assert.deepEqual(fs.readFileSync(source.path),bytes);
});
test('catalog failures and removed membership deny stale reads and evidence while ordinary library works',async t=>{
 const f=setup(t);await f.library.tree();const imported=await f.library.import({rootId:'library',files:[{name:'ordinary.txt',content:'Independent ordinary material.'}]});const ordinary=imported.receipts[0].source;
 for(const bad of [new Error('registry offline'),null,[{...f.a,rel_path:'../escape.md'}],[f.a,{...f.b,id:f.a.id}],[f.a,{...f.b,rel_path:f.a.rel_path}],[{...f.a,rel_path:'missing.md'}]]) {
  f.setEntries(bad);const tree=await f.library.tree();assert.equal(tree.roots.find(r=>r.id===f.catalog.id).available,false);assert.equal(tree.sources.find(s=>s.id===f.a.id).cardEligibility.eligible,false);assert.equal((await f.library.read(ordinary.id)).text,'Independent ordinary material.');await assert.rejects(()=>f.library.snapshot(f.a.id,{includeBody:true}));await assert.rejects(()=>f.library.read(f.a.id));await assert.rejects(()=>f.library.saveEvidence({sourceId:f.a.id,quote:'Invented'}));
 }
 f.setEntries([f.a,f.b]);assert.equal((await f.library.read(f.a.id)).id,f.a.id);f.setEntries([f.b]);await assert.rejects(()=>f.library.snapshot(f.a.id));const view=await f.library.tree();assert.equal(view.sources.some(s=>s.id===f.a.id),false);await assert.rejects(()=>f.library.read(f.a.id));
});
test('mismatched indexed IDs, unsafe links and catalog root collisions fail closed',async t=>{
 const f=setup(t);await f.library.tree();f.setEntries([{...f.a,id:randomUUID()},f.b]);assert.equal((await f.library.tree()).roots.find(r=>r.id===f.catalog.id).available,false);
 f.setEntries([f.a,f.b]);await f.library.tree();fs.unlinkSync(path.join(f.root,f.a.rel_path));fs.symlinkSync(path.join(f.root,f.b.rel_path),path.join(f.root,f.a.rel_path));assert.equal((await f.library.tree()).roots.find(r=>r.id===f.catalog.id).available,false);
 assert.throws(()=>createLibrary({dataDir:f.dataDir,retainedCatalog:{...f.catalog,id:'library'}}));assert.throws(()=>createLibrary({dataDir:f.dataDir,retainedCatalog:f.catalog,connections:[{id:f.catalog.id,path:f.root}]}));
});
test('explicit catalog moves preserve UUID and missing root isolates only its sources',async t=>{
 const f=setup(t);await f.library.tree();const original=path.join(f.root,f.a.rel_path);fs.renameSync(original,path.join(f.root,'moved.md'));f.a.rel_path='moved.md';assert.equal((await f.library.read(f.a.id)).rel_path,'moved.md');
 fs.renameSync(f.root,f.root+'-offline');const tree=await f.library.tree();assert.equal(tree.roots.find(r=>r.id===f.catalog.id).available,false);assert.equal(tree.sources.find(s=>s.id===f.a.id).cardEligibility.eligible,false);await assert.rejects(()=>f.library.blob(f.a.id));fs.renameSync(f.root+'-offline',f.root);assert.equal((await f.library.read(f.a.id)).id,f.a.id);
});
test('ordinary file roots retain inode-based identity and evidence behavior without a catalog',async t=>{
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ordinary-hook-')));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));const root=path.join(home,'connected'),dataDir=path.join(home,'data');fs.mkdirSync(root);fs.mkdirSync(dataDir);fs.writeFileSync(path.join(root,'one.txt'),'Ordinary source words.');
 const library=createLibrary({dataDir,connections:[{id:'ordinary',path:root}]});const first=(await library.tree()).sources[0];fs.renameSync(path.join(root,'one.txt'),path.join(root,'two.txt'));const moved=(await library.tree()).sources[0];assert.equal(moved.id,first.id);assert.equal(moved.rel_path,'two.txt');assert.equal((await library.saveEvidence({sourceId:first.id,quote:'source words'})).card.sourceId,first.id);
});
