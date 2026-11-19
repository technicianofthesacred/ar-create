import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStudyVideoBriefs} from '../runtime/services/study-video-briefs.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {digest} from '../runtime/services/files.mjs';

async function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'video-inquiry-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const scope={projectKey:'hk',parentStudyId:'hk'},raw='An invented speaker: Steam rose over the kettle.',quote='Steam rose over the kettle.',from=raw.indexOf(quote);
 let original={path:'transcript.md',name:'Invented transcript',role:'source',hash:digest(raw),raw};
 const collectionId=randomUUID(),otherCollectionId=randomUUID(),missing=randomUUID(),records=new Map([collectionId,otherCollectionId].map(id=>[id,{collection:{id,name:'Invented inquiry',sourceIds:[]},record:{scope:{collectionId:id},body:'Open question: What made this moment matter?',hash:digest('learning'),revision:1}}]));
 let read=async({collectionId:id})=>{const record=records.get(id);if(!record)throw Object.assign(Error('Collection was not found.'),{status:404});return structuredClone(record);};
 const open=()=>createStudyVideoBriefs({dataDir,originals:{list:async projectKey=>({projectKey,records:[structuredClone(original)]})},inquiries:{read:input=>read(input)}});
 const input={...scope,operationId:randomUUID(),title:'Invented video brief',findingId:'invented-finding',sourcePath:original.path,sourceHash:original.hash,from,to:from+quote.length,quote};
 const {brief}=await open().add(input),request={...scope,id:brief.id,operationId:randomUUID(),expectedCollectionId:null,collectionId};
 return{dataDir,scope,open,brief,request,collectionId,otherCollectionId,missing,records,changeSource(){original={...original,raw:raw+' Changed',hash:digest(raw+' Changed')};},readWith(fn){read=fn;},file:path.join(dataDir,'study-video-briefs','hk',brief.id+'.json')};
}

test('an existing brief keeps one durable inquiry pointer without copying or changing learning or source',async t=>{
 const f=await fixture(t),before=structuredClone([...f.records]);
 const result=await withActor({actor:'agent:codex',client:'cli'},()=>f.open().linkInquiry(f.request));
 assert.equal(result.brief.collectionId,f.collectionId);assert.equal(result.brief.inquiryLink.operations[0].provenance.actor,'agent:codex');
 for(const key of ['id','title','findingId','quote','sourcePath','sourceHash','from','to','status','provenance'])assert.deepEqual(result.brief[key],f.brief[key]);
 assert.deepEqual([...f.records],before);assert.equal(result.brief.body,undefined);
 assert.deepEqual((await f.open().list(f.scope)).briefs,[result.brief]);assert.deepEqual((await f.open().resolve({...f.scope,id:f.brief.id})).brief,result.brief);
});

test('durable replay survives subsequent relinks and operation reuse with a different payload refuses',async t=>{
 const f=await fixture(t),first=await f.open().linkInquiry(f.request);
 assert.deepEqual(await f.open().linkInquiry(f.request),first);
 const second=await f.open().linkInquiry({...f.request,operationId:randomUUID(),expectedCollectionId:f.collectionId,collectionId:f.otherCollectionId});
 assert.equal(second.brief.collectionId,f.otherCollectionId);
 assert.deepEqual(await f.open().linkInquiry(f.request),second);
 await assert.rejects(f.open().linkInquiry({...f.request,collectionId:f.otherCollectionId}),{status:409});
 const detached=await f.open().linkInquiry({...f.request,operationId:randomUUID(),expectedCollectionId:f.otherCollectionId,collectionId:null});
 assert.equal(detached.brief.collectionId,null);assert.equal(detached.brief.inquiryLink.operations.length,3);
});

test('linking rejects wrong scope, unknown inquiry, stale expected link and unconnected inquiry owner',async t=>{
 const f=await fixture(t),before=fs.readFileSync(f.file,'utf8');
 await assert.rejects(f.open().linkInquiry({...f.request,parentStudyId:'ref-an-cha'}),{status:409});
 await assert.rejects(f.open().linkInquiry({...f.request,collectionId:f.missing}),{status:404});
 await assert.rejects(f.open().linkInquiry({...f.request,expectedCollectionId:f.otherCollectionId}),{status:409});
 await assert.rejects(f.open().linkInquiry({...f.request,collectionId:undefined}),{status:400});
 const unconnected=createStudyVideoBriefs({dataDir:f.dataDir,originals:{list:()=>({})}});
 await assert.rejects(unconnected.linkInquiry(f.request),{status:503});assert.equal(fs.readFileSync(f.file,'utf8'),before);
});

test('linking refuses a changed source and a mismatched inquiry response without writing',async t=>{
 const f=await fixture(t),before=fs.readFileSync(f.file,'utf8');f.readWith(async()=>({collection:{id:f.otherCollectionId},record:{scope:{collectionId:f.otherCollectionId}}}));
 await assert.rejects(f.open().linkInquiry(f.request),{status:409});assert.equal(fs.readFileSync(f.file,'utf8'),before);
 f.changeSource();await assert.rejects(f.open().linkInquiry(f.request),{status:409});assert.equal(fs.readFileSync(f.file,'utf8'),before);
});

test('linking preserves a concurrent external brief change made during inquiry validation',async t=>{
 const f=await fixture(t);let ready,release;const entered=new Promise(resolve=>ready=resolve),held=new Promise(resolve=>release=resolve);
 f.readWith(async({collectionId})=>{ready();await held;return f.records.get(collectionId);});
 const operation=f.open().linkInquiry(f.request);await entered;
 const changed=JSON.parse(fs.readFileSync(f.file,'utf8'));changed.brief.title='Concurrent saved brief title';fs.writeFileSync(f.file,JSON.stringify(changed));release();
 await assert.rejects(operation,{status:409});assert.deepEqual(JSON.parse(fs.readFileSync(f.file,'utf8')),changed);
});

test('an original changed while the inquiry is read cannot be linked as current',async t=>{
 const f=await fixture(t),before=fs.readFileSync(f.file,'utf8');
 f.readWith(async({collectionId})=>{f.changeSource();return f.records.get(collectionId);});
 await assert.rejects(f.open().linkInquiry(f.request),{status:409});assert.equal(fs.readFileSync(f.file,'utf8'),before);
});
