import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {owners} from './test-fixtures/inquiry-owners.mjs';

// Real factory/owner/work adapter composition is essential: a fake outputs.read
// misses the factory's asset-catalogue read back into this same Library queue.
async function fixture(t){
  const f=await owners(t);
  const source=await f.library.retainAlbumPhoto({folder:'Synthetic',name:'owned.jpg',bytes:Buffer.from([255,216,255,224,0,1,2,3]),provenance:{kind:'synthetic-test'}});
  await f.library.saveCollection({...f.empty,sourceIds:[source.id],expectedRevision:(await f.library.collectionsSnapshot()).revision});
  const output=await f.create('article'),endpoint={kind:'piece',id:output.view.output.id,...f.group};
  const work=await f.work.read(endpoint),sourceHash=(await f.library.snapshot(source.id)).hash;
  const request=async(extra={})=>({...await f.guards(),operationId:randomUUID(),from:{kind:'collection',id:f.empty.id},to:endpoint,sourceId:source.id,expectedSourceHash:sourceHash,expectedWorkHash:work.workHash,relationshipType:'used-in',usageBasis:'declared',actor:'human',reason:'Declared exact source context in this Article.',...extra});
  return {...f,source,sourceHash,output,endpoint,request};
}
function pauseSnapshot(library){
  const original=library.snapshot;let release,entered,used=false;
  const paused=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  library.snapshot=async(...args)=>{if(!used){used=true;entered();await gate;}return original(...args);};
  return {paused,release,restore:()=>{library.snapshot=original;}};
}

test('actual native owner with Library assets completes propose/read/accept/detach/exact Undo and replay', {timeout:10000},async t=>{
  const f=await fixture(t),words=(await f.native.read({bindingId:f.output.view.wordOwner.bindingId,parentStudyId:f.group.parentStudyId})).raw,learning=(await f.direction.read(f.scope)).body;
  await assert.rejects(f.library.proposeTypedRelationship(await f.request({expectedWorkHash:'0'.repeat(64)})),/work edition changed/i);
  const command=await f.request(),[created,replay]=await Promise.all([f.library.proposeTypedRelationship(command),f.library.proposeTypedRelationship(command)]);
  assert.equal(created.relationship.status,'proposed');assert.equal(replay.replayed,true);assert.equal(replay.relationship.id,created.relationship.id);assert.equal(replay.revision,created.revision);
  const listed=await f.library.typedRelationships({entity:f.endpoint,includeDetached:true});assert.equal(listed.relationships.length,1);assert.equal(listed.relationships[0].review.workAvailable,true);assert.equal(listed.relationships[0].review.nativeUsageVerified,false);
  const change=async status=>f.library.changeTypedRelationship({...await f.guards(),operationId:randomUUID(),id:created.relationship.id,status,actor:'human',reason:'Explicit human '+status+'.'});
  const accepted=await change('accepted'),detached=await change('detached');
  const restored=await f.library.undoTypedRelationship({...await f.guards(),operationId:randomUUID(),id:created.relationship.id,undoOperationId:detached.receipt.operationId,actor:'human',reason:'Restore exact prior state.'});
  assert.deepEqual({status:restored.relationship.status,reason:restored.relationship.reason},{status:accepted.relationship.status,reason:accepted.relationship.reason});
  await assert.rejects(f.library.changeTypedRelationship({...command,id:created.relationship.id,status:'accepted'}),/explicit relationship fields/i);
  const current=await f.guards();await f.library.saveCollection({...f.empty,sourceIds:[f.source.id],name:'Renamed while preserving context',expectedRevision:current.expectedRevision});
  await assert.rejects(f.library.changeTypedRelationship({...current,operationId:randomUUID(),id:created.relationship.id,status:'accepted',actor:'human',reason:'Stale Library revision.'}),/changed|refresh/i);
  const before=await f.library.snapshot(f.source.id);fs.appendFileSync(before.path,'outside synthetic edit');
  await assert.rejects(change('accepted'),/source changed|exact version/i);
  const staleDetached=await change('detached');
  await assert.rejects(f.library.undoTypedRelationship({...await f.guards(),operationId:randomUUID(),id:created.relationship.id,undoOperationId:staleDetached.receipt.operationId,actor:'human',reason:'Earlier source must prevent restore.'}),/source changed|exact version/i);
  assert.equal((await f.native.read({bindingId:f.output.view.wordOwner.bindingId,parentStudyId:f.group.parentStudyId})).raw,words);assert.equal((await f.direction.read(f.scope)).body,learning);
});

test('ordinary Library mutation proceeds during native owner await and stale typed publication cannot lose it', {timeout:10000},async t=>{
  const f=await fixture(t),command=await f.request(),pause=pauseSnapshot(f.library);t.after(pause.restore);
  const proposed=f.library.proposeTypedRelationship(command);await pause.paused;
  const saved=await f.library.saveCollection({...f.empty,name:'Concurrent Library change retained',sourceIds:[f.source.id],expectedRevision:command.expectedRevision});pause.release();
  await assert.rejects(proposed,/Library changed|refresh/i);
  const view=await f.library.typedRelationships({includeDetached:true});assert.equal(view.revision,saved.revision);assert.equal(view.relationships.length,0);assert.equal((await f.library.collectionsSnapshot()).collections[0].name,'Concurrent Library change retained');
  const fresh=await f.library.proposeTypedRelationship(await f.request());assert.equal(fresh.relationship.status,'proposed');
});

test('actual native list rejects an index change during trusted owner reads', {timeout:10000},async t=>{
  const f=await fixture(t);await f.library.proposeTypedRelationship(await f.request());const before=await f.library.collectionsSnapshot(),pause=pauseSnapshot(f.library);t.after(pause.restore);
  const reading=f.library.typedRelationships({entity:f.endpoint,includeDetached:true});await pause.paused;
  await f.library.saveCollection({...f.empty,name:'Read conflict retained',sourceIds:[f.source.id],expectedRevision:before.revision});pause.release();await assert.rejects(reading,/Library changed during relationship read/i);
  assert.equal((await f.library.typedRelationships({entity:f.endpoint,includeDetached:true})).relationships.length,1);
});

test('different typed commands sharing exact guards remain ordered with one stale rejection', {timeout:10000},async t=>{
  const f=await fixture(t),first=await f.request(),second={...first,operationId:randomUUID(),relationshipType:'explores'},results=await Promise.allSettled([f.library.proposeTypedRelationship(first),f.library.proposeTypedRelationship(second)]);
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.match(results[1].reason.message,/Library changed|refresh/i);assert.equal((await f.library.typedRelationships({includeDetached:true})).relationships.length,1);
});
