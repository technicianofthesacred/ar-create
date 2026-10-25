import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'original-check-inputs-')));
  const vault=path.join(root,'vault'), files=path.join(root,'files');
  fs.mkdirSync(vault); fs.mkdirSync(files);
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(relative,raw)=>{const file=path.join(vault,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw);return file;};
  const draftPath='Workflow/3-Develop/DEV - Invented.md';
  write(draftPath,'# Invented manuscript\n');
  const source='Workflow/1-Source/SRC - Invented.md', context='Workflow/1-Source/CONTEXT - Invented.md';
  write(source,'Invented speech.');write(context,'Invented author context.');
  write('Workflow/3-Develop/BRIEF - Invented.md','Invented brief.');
  const entry={parentStudyKey:'invented',partKey:'article',title:'Private title sentinel',path:draftPath,support:[[source,'source'],[context,'author context'],['Workflow/3-Develop/BRIEF - Invented.md','brief']]};
  const catalog={projects:{},drafts:{invented:entry}};
  const input={parentStudyKey:'invented',partKey:'article',draftPath,expectedDraftHash:hash(fs.readFileSync(path.join(vault,draftPath)))};
  const open=()=>createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog});
  return {root,vault,files,write,source,context,entry,catalog,input,open};
}

test('exact configured support returns only bounded mechanical-check metadata and stable revision',t=>{
  const f=fixture(t),service=f.open(),before=fs.readFileSync(path.join(f.vault,f.input.draftPath));
  const got=service.checkInputs(f.input);
  const metadata={schema:'ar-create.study-original-inputs.v1',rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:hash(fs.realpathSync(f.vault))},parentStudyKey:'invented',partKey:'article',draftPath:f.input.draftPath,draftHash:f.input.expectedDraftHash,sources:[{path:f.source,hash:hash('Invented speech.'),role:'source'}],contexts:[{path:f.context,hash:hash('Invented author context.'),role:'context'}]};
  assert.deepEqual(got,{...metadata,revision:hash(JSON.stringify(metadata))});
  assert.deepEqual(service.checkInputs(f.input),got);
  for(const secret of [f.vault,'Private title sentinel','Invented speech.','Invented author context.','raw','modifiedAt'])assert.ok(!JSON.stringify(got).includes(secret));
  assert.deepEqual(fs.readFileSync(path.join(f.vault,f.input.draftPath)),before);
  assert.equal(service.readDraft('invented',f.input.expectedDraftHash).records[0].raw,before.toString());
  assert.equal(service.catalog()[0].path,f.input.draftPath);
});

test('multiple explicit sources and missing references are preserved without selection or inference',t=>{
  const f=fixture(t);f.entry.support.push(['Workflow/1-Source/SRC - Missing.md','source'],['Workflow/1-Source/CONTEXT - Missing.md','author context']);
  f.write('Workflow/1-Source/SRC - Unlisted.md','Never infer this source.');
  const got=f.open().checkInputs(f.input);
  assert.equal(got.sources.length,2);assert.deepEqual(got.sources[1],{path:'Workflow/1-Source/SRC - Missing.md',hash:null,role:'source'});
  assert.deepEqual(got.contexts[1],{path:'Workflow/1-Source/CONTEXT - Missing.md',hash:null,role:'context'});
  f.write(f.source,'Changed source');assert.notEqual(f.open().checkInputs(f.input).revision,got.revision);
});

test('input requires exactly four bounded strings and a lowercase SHA256 guard',t=>{
  const f=fixture(t),service=f.open();
  for(const input of [null,[],{}, {...f.input,extra:true},{...f.input,partKey:1},{...f.input,parentStudyKey:''},{...f.input,parentStudyKey:'x'.repeat(257)},{...f.input,draftPath:'x'.repeat(4097)},{...f.input,expectedDraftHash:'f'.repeat(63)},{...f.input,expectedDraftHash:'A'.repeat(64)}])assert.throws(()=>service.checkInputs(input),e=>e.status===400);
});

test('exact parent, part and configured path refuse unknown, foreign and changed manuscripts',t=>{
  const f=fixture(t),service=f.open();
  for(const change of [{parentStudyKey:'other'},{partKey:'1'},{draftPath:'Workflow/3-Develop/DEV - Other.md'},{draftPath:'../escape.md'}])assert.throws(()=>service.checkInputs({...f.input,...change}));
  f.write(f.input.draftPath,'Changed manuscript');assert.throws(()=>service.checkInputs(f.input),e=>e.status===409);
});

test('duplicate draft definitions, duplicate paths and unsafe configured support refuse',t=>{
  const f=fixture(t);
  f.catalog.drafts.duplicate={...f.entry};assert.throws(()=>f.open().checkInputs(f.input),e=>e.status===409);
  f.catalog.drafts.duplicate={...f.entry,parentStudyKey:'other',partKey:'other'};assert.throws(()=>f.open().checkInputs(f.input),e=>e.status===409);
  delete f.catalog.drafts.duplicate;
  for(const relative of [f.source,f.input.draftPath,'../escape.md','Workflow/../escape.md','/absolute.md','Workflow\\escape.md']){
    f.entry.support.push([relative,'source']);assert.throws(()=>f.open().checkInputs(f.input));f.entry.support.pop();
  }
});

test('captured root cannot rebind and symlinked support cannot escape',t=>{
  const f=fixture(t),service=f.open(),old=f.vault+'-old';
  fs.renameSync(f.vault,old);fs.symlinkSync(old,f.vault);
  assert.throws(()=>service.checkInputs(f.input),e=>e.status===403||e.status===409);
  fs.unlinkSync(f.vault);fs.renameSync(old,f.vault);
  const source=path.join(f.vault,f.source);fs.renameSync(source,source+'.old');fs.symlinkSync(source+'.old',source);
  assert.throws(()=>service.checkInputs(f.input),e=>e.status===403);
});

test('a replacement directory at the same configured name cannot rebind the captured root',t=>{
  const f=fixture(t),service=f.open();
  fs.renameSync(f.vault,f.vault+'-old');fs.mkdirSync(f.vault);
  assert.throws(()=>service.checkInputs(f.input),e=>e.status===409);
});

test('missing relationships stay empty; filenames and titles never infer check inputs',t=>{
  const f=fixture(t);f.entry.support=[];
  const service=f.open(),got=service.checkInputs(f.input);
  assert.deepEqual(got.sources,[]);assert.deepEqual(got.contexts,[]);
  // Configuration belongs to this service instance, not a later caller mutation.
  f.entry.support.push([f.source,'source']);assert.deepEqual(service.checkInputs(f.input),got);
});

test('same-project numbered parts require their exact maintained part and path',t=>{
  const f=fixture(t),otherPath='Workflow/3-Develop/DEV - Invented part two.md';
  f.write(otherPath,'Invented part two.');
  f.catalog.drafts.partTwo={...f.entry,partKey:'2',path:otherPath};
  const service=f.open(),input={...f.input,partKey:'2',draftPath:otherPath,expectedDraftHash:hash('Invented part two.')};
  assert.equal(service.checkInputs(input).partKey,'2');
  assert.throws(()=>service.checkInputs({...input,partKey:'article'}),e=>e.status===404);
  assert.throws(()=>service.checkInputs({...f.input,partKey:'2'}),e=>e.status===404);
});

test('a root replaced while linked metadata is read refuses even with identical replacement bytes',t=>{
 const f=fixture(t),service=f.open(),read=fs.readFileSync;let replaced=false;
 fs.readFileSync=function(file,...args){const bytes=read.call(this,file,...args);if(file===path.join(f.vault,f.source)&&!replaced){replaced=true;fs.renameSync(f.vault,f.vault+'-retained');fs.cpSync(f.vault+'-retained',f.vault,{recursive:true});}return bytes;};
 try{assert.throws(()=>service.checkInputs(f.input),error=>error.status===409);assert.equal(replaced,true);}finally{fs.readFileSync=read;}
});
