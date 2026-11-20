import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStudyVideoBriefs} from '../runtime/services/study-video-briefs.mjs';
import {digest} from '../runtime/services/files.mjs';
import {withActor} from '../runtime/services/actor.mjs';

function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'video-atomic-inquiry-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const scope={projectKey:'hk',parentStudyId:'hk'},raw='Invented speaker: Steam rose above the kettle.',quote='Steam rose above the kettle.',from=raw.indexOf(quote);
 let source={path:'transcript.md',name:'Invented transcript',role:'source',hash:digest(raw),raw};
 const collectionId=randomUUID(),otherId=randomUUID(),records=new Map([collectionId,otherId].map(id=>[id,{collection:{id,name:'Invented independent inquiry',sourceIds:[]},record:{scope:{collectionId:id},body:'Unanswered: Which pause belongs in this piece?',revision:1,hash:digest('invented learning')}}]));
 let read=async({collectionId:id})=>{const value=records.get(id);if(!value)throw Object.assign(Error('Collection was not found.'),{status:404});return structuredClone(value);};
 const originals={list:async projectKey=>({projectKey,records:[structuredClone(source)]})};
 const open=(connected=true)=>createStudyVideoBriefs({dataDir,originals,...connected?{inquiries:{read:input=>read(input)}}:{}});
 const input={...scope,operationId:randomUUID(),title:'Invented atomic video brief',findingId:'invented-finding',sourcePath:source.path,sourceHash:source.hash,from,to:from+quote.length,quote};
 return {dataDir,scope,input,collectionId,otherId,records,open,readWith(fn){read=fn;},changeSource(){source={...source,raw:raw+' Changed',hash:digest(raw+' Changed')};},file:path.join(dataDir,'study-video-briefs','hk',input.operationId+'.json')};
}

test('one save atomically reopens a source-backed proposed brief with its selected independent inquiry',async t=>{
 const f=fixture(t),before=structuredClone([...f.records]);
 const {brief}=await withActor({actor:'agent:codex',client:'cli'},()=>f.open().add({...f.input,collectionId:f.collectionId}));
 assert.equal(brief.id,f.input.operationId);assert.equal(brief.collectionId,f.collectionId);assert.equal(brief.inquiryOrigin.collectionId,f.collectionId);assert.equal(brief.status,'proposed');assert.equal(brief.provenance.actor,'agent:codex');
 assert.deepEqual((await f.open().list(f.scope)).briefs,[brief]);assert.deepEqual((await f.open().resolve({...f.scope,id:brief.id})).brief,brief);
 for(const key of ['sourcePath','sourceHash','from','to','quote','findingId'])assert.equal(brief[key],f.input[key]);
 assert.deepEqual([...f.records],before);assert.equal(brief.body,undefined);
});

test('lost-response and concurrent replay reuse one exact brief and reject another initial inquiry',async t=>{
 const f=fixture(t),input={...f.input,collectionId:f.collectionId};
 const both=await Promise.all([f.open().add(input),f.open().add(input)]);assert.deepEqual(both[0],both[1]);
 assert.deepEqual(await f.open().add(input),both[0]);assert.equal((await f.open().list(f.scope)).briefs.length,1);
 await assert.rejects(f.open().add({...input,collectionId:f.otherId}),{status:409});
 await assert.rejects(f.open().add(f.input),{status:409});
});

test('competing initial inquiry payloads cannot overwrite the winning atomic handoff',async t=>{
 const f=fixture(t),results=await Promise.allSettled([f.open().add({...f.input,collectionId:f.collectionId}),f.open().add({...f.input,collectionId:f.otherId})]);
 const winners=results.filter(r=>r.status==='fulfilled'),losers=results.filter(r=>r.status==='rejected');assert.equal(winners.length,1);assert.equal(losers.length,1);assert.equal(losers[0].reason.status,409);
 const briefs=(await f.open().list(f.scope)).briefs;assert.deepEqual(briefs,[winners[0].value.brief]);assert.equal(briefs[0].inquiryOrigin.collectionId,briefs[0].collectionId);
});

test('original add replay remains exact after later inquiry change and detach',async t=>{
 const f=fixture(t),input={...f.input,collectionId:f.collectionId};await f.open().add(input);
 const changed=await f.open().linkInquiry({...f.scope,id:f.input.operationId,operationId:randomUUID(),expectedCollectionId:f.collectionId,collectionId:f.otherId});
 assert.deepEqual(await f.open().add(input),changed);assert.equal(changed.brief.inquiryOrigin.collectionId,f.collectionId);
 const detached=await f.open().linkInquiry({...f.scope,id:f.input.operationId,operationId:randomUUID(),expectedCollectionId:f.otherId,collectionId:null});
 assert.deepEqual(await f.open().add(input),detached);assert.equal(detached.brief.collectionId,null);
 await assert.rejects(f.open().add({...input,collectionId:f.otherId}),{status:409});
});

test('legacy callers stay compatible and cannot claim a later link was the original inquiry',async t=>{
 const f=fixture(t),created=await f.open(false).add(f.input);assert.equal(created.brief.collectionId,undefined);assert.equal(created.brief.inquiryOrigin,undefined);
 const linked=await f.open().linkInquiry({...f.scope,id:f.input.operationId,operationId:randomUUID(),expectedCollectionId:null,collectionId:f.collectionId});
 assert.deepEqual(await f.open().add(f.input),linked);
 await assert.rejects(f.open().add({...f.input,collectionId:f.collectionId}),{status:409});
});

test('missing, malformed or unconnected inquiries never leave a partially created brief',async t=>{
 const f=fixture(t);
 await assert.rejects(f.open().add({...f.input,collectionId:randomUUID()}),{status:404});
 for(const collectionId of [null,undefined,'not-an-id'])await assert.rejects(f.open().add({...f.input,collectionId}),{status:400});
 await assert.rejects(f.open(false).add({...f.input,collectionId:f.collectionId}),{status:503});
 assert.equal(fs.existsSync(f.file),false);assert.deepEqual(await f.open().list(f.scope),{briefs:[]});
});

test('mismatched inquiry identity and source changed during inquiry validation refuse before creation',async t=>{
 const f=fixture(t);
 for(const response of [{collection:{id:f.collectionId},record:{scope:{collectionId:f.otherId}}},{collection:{id:f.otherId},record:{scope:{collectionId:f.collectionId}}}]){
  f.readWith(async()=>response);await assert.rejects(f.open().add({...f.input,collectionId:f.collectionId}),{status:409});assert.equal(fs.existsSync(f.file),false);
 }
 f.readWith(async({collectionId})=>{f.changeSource();return f.records.get(collectionId);});
 await assert.rejects(f.open().add({...f.input,collectionId:f.collectionId}),{status:409});assert.equal(fs.existsSync(f.file),false);
});
