import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from '../server.mjs';
import {mapper} from './native-output-helpers.mjs';

test('edited blank collection creates independent Post and Product listing while exact notes, root and sibling wording survive',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'short-output-edge-')));for(const n of ['vault','files'])fs.mkdirSync(path.join(dir,n));
 const server=await createServer({dataDir:path.join(dir,'data'),publicDir:path.join(dir,'public'),sharedArticles:true,researchEnabled:false,studyOriginalRoots:{vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(route,body,status=200)=>{const response=await fetch(base+route,body?{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined),value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
 const parentStudyId='short-edge-'+randomUUID(),concept=await request('/api/concepts',{parentStudyId,title:'An invented observation',operationId:randomUUID()});
 const body='# Shared learning\n\n'+('An observation can support a personal reflection without proving a general product claim. Keep the question, the uncertainty and the author response distinct.\n\n'.repeat(12))+'## Manual note\n\nKeep every exact word here.\n';
 const notes=await request('/api/concept/save',{parentStudyId,operationId:randomUUID(),expectedRevision:concept.revision,expectedHash:concept.hash,body});
 const catalog=await request('/api/study-draft/catalog'),bindingId=catalog.collections.find(row=>row.parentStudyId===parentStudyId).bindingId,group={rootBindingId:bindingId,parentStudyId};
 const query=(extra={})=>new URLSearchParams({...group,...extra}),nativeRead=id=>request('/api/study-draft/read?'+new URLSearchParams({bindingId:id,parentStudyId}));
 const empty=await request('/api/study/outputs?'+query());assert.equal(empty.outputs.length,0);
 const rootBefore=await nativeRead(bindingId),root=await request('/api/study-draft/save',{bindingId,parentStudyId,expected:rootBefore.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Separate collected writing is permitted here; it is not the shared learning record.'}]});
 const captures={projectId:randomUUID(),documentId:randomUUID(),outputId:randomUUID()};
 assert.throws(()=>mapper.capture(root,captures),/topology/); // Strict article validation must remain strict.
 for(const kind of ['post','product-listing']){
  assert.doesNotThrow(()=>mapper.capture(root,captures,{outputKind:kind}));
  const wrong=structuredClone(root);wrong.projection.find(row=>row.raw.trim()).raw+=' forged';
  assert.throws(()=>mapper.capture(wrong,captures,{outputKind:kind}),/raw|hash|topology/);
 }
 const savedOutputs=[];
 for(const kind of ['post','product-listing']){
  const before=await request('/api/study/outputs?'+query());
  const createInput={...group,kind,expectedOutput:before.expectedOutput,operationId:randomUUID()};
  const result=await request('/api/study/outputs/create',createInput),id=result.view.output.id,ownId=result.view.wordOwner.bindingId;
  assert.notEqual(ownId,bindingId);assert.ok(!savedOutputs.some(row=>row.bindingId===ownId));assert.deepEqual(result.view.output.manuscript,[]);
  const blank=await nativeRead(ownId);assert.ok(blank.projection.every(row=>!row.words));assert.doesNotMatch(blank.raw,/Separate collected writing/);
  const saveId=randomUUID(),text='Independent '+kind+' wording, kept in its own file.',saved=await request('/api/study-draft/save',{bindingId:ownId,parentStudyId,expected:blank.expected,operationId:saveId,operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:text}]});
  let view=(await request('/api/study/outputs/refresh',{...group,selectedOutputId:id,expectedOutput:result.view.expectedOutput,expectedNative:saved.expected,operationId:randomUUID()})).view;
  assert.equal(view.output.manuscript[0].text,text);assert.equal((await nativeRead(ownId)).raw,saved.raw);
  await request('/api/study-draft/save',{bindingId:ownId,parentStudyId,expected:blank.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Stale attempt'}]},409);
  const undone=await request('/api/study-draft/undo',{bindingId:ownId,parentStudyId,expected:saved.expected,undoOperationId:saveId,operationId:randomUUID()});assert.equal(undone.raw,blank.raw);
  view=(await request('/api/study/outputs/refresh',{...group,selectedOutputId:id,expectedOutput:view.expectedOutput,expectedNative:undone.expected,operationId:randomUUID()})).view;assert.deepEqual(view.output.manuscript,[]);
  savedOutputs.push({id,bindingId:ownId,output:view.output,raw:undone.raw});
  assert.equal((await nativeRead(bindingId)).raw,root.raw);
  const noteAfter=await request('/api/concept?'+new URLSearchParams({parentStudyId}));assert.equal(noteAfter.body,notes.body);assert.equal(noteAfter.revision,notes.revision);assert.equal(noteAfter.hash,notes.hash);
  for(const prior of savedOutputs){const old=await request('/api/study/outputs?'+query({selectedOutputId:prior.id}));assert.deepEqual(old.output,prior.output);assert.equal((await nativeRead(prior.bindingId)).raw,prior.raw);}
 }
 assert.equal((await request('/api/study/outputs?'+query())).outputs.length,2);
});
