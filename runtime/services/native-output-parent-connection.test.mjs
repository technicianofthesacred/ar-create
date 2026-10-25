import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createStore} from '../store.mjs';
import {createStudyBindings} from './study-bindings.mjs';
import {createStudyDraftCopies} from './study-draft-copies.mjs';
import {createStudyOriginals} from './study-originals.mjs';
import {createStudyOwnedPhotoBindings} from './study-owned-photo-bindings.mjs';
import {createLibrary} from './library.mjs';
import {createNativeOutputFactory} from './native-output-factory.mjs';
import {digest} from './files.mjs';

async function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'native-parent-connection-')));
 const vault=path.join(dataDir,'invented-vault'),files=path.join(dataDir,'invented-files');
 fs.mkdirSync(vault);fs.mkdirSync(files);
 const sourcePath='Workflow/1-Source/SRC - Invented shared source.md';
 const source='Invented original source; never a retained private sample.';
 const put=(relative,body)=>{const file=path.join(vault,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
 put(sourcePath,source);
 const drafts={};
 for(const partKey of ['1','2']){
  const relative='Workflow/3-Develop/DEV - Invented part '+partKey+'.md';
  put(relative,'---\ntype: DEV\ntitle: Invented part '+partKey+'\n---\n\nExact original words for part '+partKey+'.\n');
  drafts['invented-'+partKey]={parentStudyKey:'invented-parent',partKey,title:'Invented part '+partKey,path:relative,contextScope:'Synthetic owner selection contract.',support:[[sourcePath,'source']]};
 }
 const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{'invented-parent':{title:'Invented parent',docs:[[sourcePath,'source']],relatedProjects:[]}},drafts}});
 const store=await createStore({dataDir,sharedArticles:true});
 t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const native=createStudyDraftCopies({dataDir,originals}),bindings=createStudyBindings({dataDir,store});
 const roots=[];
 for(const id of ['invented-1','invented-2']){
  const original=originals.readDraft(id),draft=original.records.find(r=>r.role==='draft');
  roots.push(await native.openCopy({originalId:id,originalHash:draft.hash,parentStudyId:'invented-parent',operationId:randomUUID()}));
 }
 const ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings});
 const library=createLibrary({dataDir,legacyState:()=>({project:{sources:[]}})});
 const makeFactory=()=>createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos});
 const group={rootBindingId:roots[0].binding.id,parentStudyId:'invented-parent'};
 return {dataDir,vault,sourcePath,source,store,native,bindings,roots,ownedPhotos,makeFactory,group};
}
const createInput=(f,view)=>({...f.group,kind:'article',sourceBindingId:f.roots[0].binding.id,expectedNative:f.roots[0].expected,expectedOutput:view.expectedOutput,operationId:randomUUID()});

// An opened native manuscript and its photo/physical owner are insufficient on
// their own. The named parent must be explicitly selected through its owner.
test('cold native root requires exact existing parent selection before output registration',async t=>{
 const f=await fixture(t),photoInput={bindingId:f.group.rootBindingId,parentStudyId:f.group.parentStudyId,operationId:randomUUID()};
 const physical=await f.ownedPhotos.select(photoInput),factory=f.makeFactory();
 const before=f.store.get(),piecesBefore=await f.store.listPieces(),wordsBefore=fs.readFileSync(f.roots[0].paths.draft);
 await assert.rejects(factory.owner.read(f.group),/Exact ready persisted study binding required/);
 assert.deepEqual(f.store.get(),before);assert.deepEqual(await f.store.listPieces(),piecesBefore);
 assert.deepEqual(fs.readFileSync(f.roots[0].paths.draft),wordsBefore);
 assert.equal((await f.native.catalog()).outputBindings.length,0);
 const parentInput={projectKey:f.group.parentStudyId,title:'Invented parent',operationId:randomUUID()};
 const parent=await f.bindings.select(parentInput);
 assert.notEqual(parent.projectId,physical.projectId);
 assert.deepEqual(await f.ownedPhotos.select(photoInput),physical);
 const empty=await factory.owner.read(f.group);assert.equal(empty.outputBindings.length,0);
 const input=createInput(f,empty),created=await factory.owner.create(input);
 assert.equal(created.view.writingProof.bindingId,f.group.rootBindingId);
 assert.equal(created.view.output.id,input.operationId);
 assert.equal(created.view.photoScope.projectId,physical.projectId);
 assert.equal((await factory.owner.create(input)).alreadySaved,true);
 assert.equal((await f.bindings.select(parentInput)).projectId,parent.projectId);
 assert.deepEqual(await f.ownedPhotos.select(photoInput),physical);
 const reopened=f.makeFactory(),read=await reopened.owner.read({...f.group,selectedOutputId:input.operationId});
 assert.equal(read.output.id,input.operationId);assert.equal(read.writingProof.bindingId,f.group.rootBindingId);
 assert.equal(read.outputBindings.length,1);assert.equal((await f.native.catalog()).outputBindings.length,1);
 assert.equal((await f.store.listPieces()).pieces.length,piecesBefore.pieces.length+1);
 assert.deepEqual(fs.readFileSync(f.roots[0].paths.draft),wordsBefore);
});

test('same-parent foreign part cannot seed the selected root output',async t=>{
 const f=await fixture(t);
 await f.bindings.select({projectKey:f.group.parentStudyId,title:'Invented parent',operationId:randomUUID()});
 await f.ownedPhotos.select({bindingId:f.group.rootBindingId,parentStudyId:f.group.parentStudyId,operationId:randomUUID()});
 const factory=f.makeFactory(),empty=await factory.owner.read(f.group),before=f.store.get();
 const words=f.roots.map(root=>fs.readFileSync(root.paths.draft));
 await assert.rejects(factory.owner.create({...createInput(f,empty),sourceBindingId:f.roots[1].binding.id,expectedNative:f.roots[1].expected}),/another native root\/part/);
 assert.deepEqual(f.store.get(),before);assert.equal((await factory.owner.read(f.group)).outputs.length,0);
 assert.equal((await f.native.catalog()).outputBindings.length,0);
 for(const [index,root] of f.roots.entries())assert.deepEqual(fs.readFileSync(root.paths.draft),words[index]);
});

test('missing original source holds output commit and exact retry retains the existing native owner',async t=>{
 const f=await fixture(t);
 await f.bindings.select({projectKey:f.group.parentStudyId,title:'Invented parent',operationId:randomUUID()});
 await f.ownedPhotos.select({bindingId:f.group.rootBindingId,parentStudyId:f.group.parentStudyId,operationId:randomUUID()});
 const factory=f.makeFactory(),empty=await factory.owner.read(f.group),input=createInput(f,empty);
 const words=fs.readFileSync(f.roots[0].paths.draft),before=f.store.get(),sourceFile=path.join(f.vault,f.sourcePath);
 fs.unlinkSync(sourceFile);
 await assert.rejects(factory.owner.create(input),/retained source proof differs/);
 assert.deepEqual(f.store.get(),before);assert.equal((await factory.owner.read(f.group)).outputs.length,0);
 assert.deepEqual(fs.readFileSync(f.roots[0].paths.draft),words);
 // The existing registration can precede the refused output commit; retry its
 // exact operation after source recovery rather than inventing another owner.
 fs.writeFileSync(sourceFile,f.source);
 const created=await factory.owner.create(input);
 assert.equal(created.view.output.id,input.operationId);assert.equal(created.view.writingProof.bindingId,f.group.rootBindingId);
 assert.equal((await factory.owner.create(input)).alreadySaved,true);
 assert.equal((await factory.owner.read(f.group)).outputs.length,1);
 assert.equal((await f.native.catalog()).outputBindings.length,1);
 assert.deepEqual(fs.readFileSync(f.roots[0].paths.draft),words);
 assert.equal(digest(fs.readFileSync(sourceFile)),digest(f.source));
});
