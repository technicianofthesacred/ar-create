import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createStudyDraftCopies} from './study-draft-copies.mjs';

function fixture(t,extra={}) {
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-collection-root-')));
 t.after(()=>fs.rmSync(dataDir,{force:true,recursive:true}));
 let originalReads=0;
 const originals={catalog:()=>({drafts:[]}),readDraft:()=>{originalReads++;throw Error('Collection must never impersonate imported originals.');}};
 const config={dataDir,originals,...extra},service=createStudyDraftCopies(config);
 const input={parentStudyId:'new-product-'+randomUUID(),title:'A new tea collection',operationId:randomUUID()};
 return {dataDir,config,service,input,reads:()=>originalReads};
}
const scope=(f,document)=>({parentStudyId:f.input.parentStudyId,bindingId:document.binding.id});
const insert=(f,document,text)=>({...scope(f,document),operationId:randomUUID(),expected:document.expected,operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:text}]});
test('arbitrary collection creates a blank native owner without Article/imports; reopen, edit, exact retry and saved Undo retain identity',async t=>{
 const f=fixture(t),root=await f.service.createCollection(f.input);
 assert.equal(root.binding.kind,'collection-root');assert.equal(root.binding.origin,'authored-collection');assert.equal(root.binding.status,'ready');assert.equal(root.readiness.ready,true);assert.ok(root.projection.every(p=>!p.words));assert.equal(root.originalChanged,false);
 assert.match(root.raw,/title: "A new tea collection"/);assert.ok(root.paths.draft.startsWith(f.dataDir+path.sep));assert.equal(fs.readFileSync(root.paths.draft,'utf8'),root.raw);assert.equal(f.reads(),0);
 const catalog=await f.service.catalog();assert.deepEqual(catalog.drafts,[]);assert.deepEqual(catalog.outputBindings,[]);assert.equal(catalog.collections[0].bindingId,root.binding.id);assert.equal(catalog.collections[0].parentStudyId,f.input.parentStudyId);
 const op=insert(f,root,'Collected material remains useful without an article.'),saved=await f.service.save(op);
 assert.match(saved.raw,/Collected material/);assert.ok(saved.projection.some(p=>p.id===op.operations[0].id));
 const reopened=createStudyDraftCopies(f.config),again=await reopened.createCollection(f.input);assert.equal(again.binding.id,root.binding.id);assert.equal(again.raw,saved.raw);assert.equal((await reopened.read(scope(f,root))).raw,saved.raw);assert.equal((await reopened.save(op)).raw,saved.raw);
 const undone=await reopened.undo({...scope(f,root),operationId:randomUUID(),expected:saved.expected,undoOperationId:op.operationId});assert.equal(undone.raw,root.raw);assert.deepEqual(undone.projection.map(p=>p.id),root.projection.map(p=>p.id));assert.equal(f.reads(),0);
 assert.equal((await reopened.inspectRoots(scope(f,root))).audit.bindingId,root.binding.id);
});
test('collection exact creation contract refuses operation reuse, foreign scope and caller paths without changing saved words',async t=>{
 const f=fixture(t),root=await f.service.createCollection(f.input);
 for(const changed of [{title:'Changed title'},{operationId:randomUUID()},{parentStudyId:'foreign'},{path:'/tmp/caller-owned.md'},{raw:'Caller snapshot'}])await assert.rejects(f.service.createCollection({...f.input,...changed}));
 await assert.rejects(f.service.read({...scope(f,root),parentStudyId:'foreign'}),/different parent/);
 assert.equal((await f.service.read(scope(f,root))).raw,root.raw);assert.equal((await f.service.catalog()).collections.length,1);
 const second=await f.service.createCollection({...f.input,parentStudyId:'independent',operationId:randomUUID()});assert.notEqual(second.binding.id,root.binding.id);
});
test('collection interrupted capture reopens exact intent and blank short outputs own independent native save and Undo',async t=>{
 let fail=true;const f=fixture(t,{afterCopyFile:()=>{if(fail){fail=false;throw Error('synthetic collection interruption');}}});await assert.rejects(f.service.createCollection(f.input),/synthetic collection interruption/);
 const reopened=createStudyDraftCopies({...f.config,afterCopyFile:null}),root=await reopened.createCollection(f.input);
 const source=await reopened.save(insert(f,root,'Collection notes are not an automatically drafted article.'));
 for(const textOutputKind of ['post','product-listing']){
  const request={sourceBindingId:root.binding.id,parentStudyId:f.input.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:source.expected,textOutputKind},child=await reopened.fork(request);
  assert.equal(child.binding.origin,'authored-collection');assert.equal(child.binding.textOutputKind,textOutputKind);assert.ok(child.projection.every(p=>!p.words));assert.equal(child.originalChanged,false);assert.equal(child.binding.derivedFrom.rawHash,source.expected.workflow.draft);assert.notEqual(child.binding.seedWorkingHash,source.expected.workflow.draft);
  const op=insert(f,child,'Independent '+textOutputKind+' wording.'),saved=await reopened.save(op);
  assert.match(saved.raw,/Independent/);assert.equal((await reopened.fork(request)).raw,saved.raw);assert.equal((await reopened.read(scope(f,root))).raw,source.raw);
  const undo=await reopened.undo({...scope(f,child),operationId:randomUUID(),expected:saved.expected,undoOperationId:op.operationId});assert.equal(undo.raw,child.raw);
 }
 assert.equal(f.reads(),0);assert.equal((await reopened.catalog()).outputBindings.length,2);
});
