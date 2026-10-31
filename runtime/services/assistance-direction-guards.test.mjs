import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {owners} from './test-fixtures/inquiry-owners.mjs';
import {digest} from './files.mjs';
test('Direction owner issues a synchronous guard for exact body and metadata, including absent records',async t=>{
 const f=await owners(t),input={scope:'part',parentStudyId:f.group.parentStudyId,bindingId:f.group.rootBindingId};
 const before=await f.direction.read(input),expected={scope:before.scope,revision:before.revision,hash:before.hash,metadataHash:before.metadataHash??null};
 const guard=await f.direction.captureReadGuard({records:[{input,expected}],references:[]});
 assert.equal(guard.validate(),undefined);
 await f.direction.write({...input,body:'An explicit invented instruction.',expectedRevision:before.revision,expectedHash:before.hash,operationId:randomUUID()});
 assert.throws(()=>guard.validate(),/changed/);
 const current=await f.direction.read(input),next=await f.direction.captureReadGuard({records:[{input,expected:{scope:current.scope,revision:current.revision,hash:current.hash,metadataHash:current.metadataHash}}],references:[]});
 assert.equal(next.validate(),undefined);fs.appendFileSync(current.path,'\nOutside drift.');assert.throws(()=>next.validate(),/changed/);
});
test('Library owner guard pins exact no-refresh index and selected source bytes',async t=>{
 const f=await owners(t),catalog=await f.library.collectionsSnapshot(),collection=catalog.collections[0];
 const guard=await f.library.captureReadGuard({collections:[{expected:{revision:catalog.revision,indexHash:catalog.indexHash,collectionId:collection.id,sourceIds:collection.sourceIds}}],sources:[]});
 assert.equal(guard.validate(),undefined);
 await f.library.saveCollection({name:'Other invented Collection',sourceIds:[],expectedRevision:catalog.revision});assert.throws(()=>guard.validate(),/changed/);
});
test('Library final guard pins the actual selected passage bytes and immutable source identity',async t=>{
 const f=await owners(t),source=(await f.library.import({files:[{name:'Invented passage.md',content:'Exact invented passage.'}]})).receipts[0].source,current=await f.library.snapshot(source.id,{includeBody:true}),guard=await f.library.captureReadGuard({collections:[],sources:[{expected:{id:source.id,hash:current.hash,start:0,end:current.text.length,quoteHash:digest(current.text)}}]});assert.equal(guard.validate(),undefined);fs.appendFileSync(current.path,'Changed passage.');assert.throws(()=>guard.validate(),/changed/);
});
test('internal native before-intent guards must be synchronous and cannot enter public input',async t=>{
 const f=await owners(t),binding={bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId},current=await f.native.read(binding),row=current.projection.find(r=>r.words),input={...binding,operationId:randomUUID(),expected:current.expected,operations:[{kind:'text',id:row.id,from:0,to:0,insert:'Invented ',seenBlockHash:row.blockHash}]};
 await assert.rejects(f.native.save({...input,beforeIntent:()=>{}}),/Unknown|unsupported|fields/i);await assert.rejects(f.native.save(input,{beforeIntent:async()=>{}}),/synchronous/);assert.equal((await f.native.read(binding)).raw,current.raw);await assert.rejects(f.native.inspect({...binding,operationId:input.operationId}),{status:404});
});

test('Direction final guard pins authoritative operation bytes as well as history membership',async t=>{
 const f=await owners(t),input={scope:'part',parentStudyId:f.group.parentStudyId,bindingId:f.group.rootBindingId},before=await f.direction.read(input),operationId=randomUUID();await f.direction.write({...input,body:'Exact invented instruction.',expectedRevision:before.revision,expectedHash:before.hash,operationId});const current=await f.direction.read(input),guard=await f.direction.captureReadGuard({records:[{input,expected:{scope:current.scope,revision:current.revision,hash:current.hash,metadataHash:current.metadataHash}}],references:[]});assert.equal(guard.validate(),undefined);fs.appendFileSync(path.join(path.dirname(current.path),'human-direction-history',operationId+'.json'),'Changed operation bytes.');assert.throws(()=>guard.validate(),/changed/);
});

test('absent native child part has a final read guard and later explicit part selection invalidates it',async t=>{const f=await owners(t),root=await f.native.read({bindingId:f.group.rootBindingId,parentStudyId:f.group.parentStudyId}),child=await f.native.fork({sourceBindingId:f.group.rootBindingId,parentStudyId:f.group.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:root.expected,textOutputKind:'post'}),input={scope:'part',parentStudyId:f.group.parentStudyId,bindingId:child.binding.id},empty=await f.direction.read(input);assert.equal(empty.bound,false);assert.equal(empty.scope,null);const expected={scope:null,revision:0,hash:digest(''),metadataHash:null},guard=await f.direction.captureReadGuard({records:[{input,expected}]});assert.equal(guard.validate(),undefined);await f.direction.select({...input,title:'Explicit synthetic child part',operationId:randomUUID()});assert.throws(()=>guard.validate(),/changed/);await assert.rejects(f.direction.captureReadGuard({records:[{input,expected}]}),/changed/);await assert.rejects(f.direction.captureReadGuard({records:[{input:{...input,parentStudyId:'foreign'},expected}]}));});
