// Stage 7, piece 3: study-draft.capture-sources.stop over real HTTP, and capture with again:true. Invented content only.
// The gate is a first look and the service refuses again; so the plain path and the odd spellings of it (a percent-encoded
// letter, a dot segment, a backslash) are all tried as an assistant and must write nothing.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';import {digest} from '../runtime/services/files.mjs';

const AGENTS=['agent:claude-code','agent:codex','agent:chatgpt','agent:hermes','agent:grok','agent:claude-design','cron:nightly','import:notes'],AGENT='agent:codex',ROUTE='/api/study-draft/capture-sources/stop';
async function start(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'stop-http-'))),dataDir=path.join(dir,'data'),roots={vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')};for(const r of Object.values(roots))fs.mkdirSync(r,{recursive:true});
 const fixture=createWorkshopFixture(dataDir);fs.writeFileSync(path.join(fixture.output,'transcribe.json'),JSON.stringify(fixture.original));
 const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:roots,researchEnabled:false,sharedArticles:true,transcriptionRuntime:{python:'/no-interpreter'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const port=server.address().port;
 const raw=(method,rawPath,body,headers={})=>new Promise((resolve,reject)=>{const data=body===undefined?null:JSON.stringify(body),req=http.request({host:'127.0.0.1',port,method,path:rawPath,headers:{...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{let json=null;try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{}resolve({status:res.statusCode,body:json});});});req.on('error',reject);if(data)req.write(data);req.end();});
 const as=(actor,client)=>actor?{'x-ar-actor':actor,'x-ar-client':client||(actor==='human:adrian'?'ui':'cli')}:{};
 const call=(rawPath,body,actor='human:adrian')=>raw(body===undefined?'GET':'POST',rawPath,body,as(actor));
 const room=id=>path.join(dataDir,'study-draft-copies','copies',id);
 const tree=id=>{const root=room(id);return Object.fromEntries(fs.readdirSync(root,{recursive:true}).sort().filter(p=>fs.lstatSync(path.join(root,p)).isFile()).map(p=>[p,digest(fs.readFileSync(path.join(root,p)))]));};
 return {dataDir,fixture,raw,call,as,room,tree};
}
const QUOTE='"The first sample uses a low fixture tone."';
/** Adrian confirms the invented recording, keeps it as a source and captures it for Check. */
async function captured(t){
 const h=await start(t),id=h.fixture.id,parentStudyId=randomUUID(),snap=async()=>(await h.call('/transcription/'+id+'/snapshot')).body;
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented tone subject',operationId:randomUUID()});assert.equal(made.status,200);
 const bindingId=made.body.binding.id,scope={bindingId,parentStudyId},q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId;
 const named=await h.call('/transcription/'+id+'/speakers',{expected:(await snap()).expected,names:{s1:'Potter',s2:'Visitor'}});assert.equal(named.status,200);
 assert.equal((await h.call('/transcription/'+id+'/review',{expected:named.body.expected,confirmed:true})).status,200);
 const registered=await h.call('/api/recordings/source',{jobId:id,expected:(await snap()).expected,operationId:randomUUID()});assert.equal(registered.status,200);const source=registered.body.source;
 assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]})).status,200);
 const list=async(actor='human:adrian')=>(await h.call('/api/study-draft/capture-sources/list'+q,undefined,actor)).body,row=async()=>(await list()).sources.find(x=>x.id===source.id);
 const cap=await h.call('/api/study-draft/capture-sources',{...scope,operationId:randomUUID(),expectedSourcesHash:(await list()).sourcesHash,sources:[{sourceId:source.id,sourceHash:(await row()).hash}]});assert.equal(cap.status,200,JSON.stringify(cap.body));
 const read=async()=>(await h.call('/api/study-draft/read'+q)).body,check=async()=>(await h.call('/api/study-draft/check',{...scope,operationId:randomUUID(),expected:(await read()).expected}));
 const saved=await h.call('/api/study-draft/save',{...scope,expected:(await read()).expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:QUOTE}]});assert.equal(saved.status,200,JSON.stringify(saved.body));
 const stopInput=async(over={})=>{const r=await row(),l=await list();return {...scope,operationId:randomUUID(),expectedSourcesHash:l.sourcesHash,sourceId:source.id,copiedHash:r.capturedHash,...over};};
 return {h,scope,q,source,list,row,read,check,stopInput,id};
}

test('an assistant cannot stop a source, by the plain path or an odd spelling of it, and nothing is written; the owner can',async t=>{
 const c=await captured(t),{h}=c,input=await c.stopInput(),before=h.tree(c.scope.bindingId);
 assert.ok(input.copiedHash&&input.expectedSourcesHash,'the list gives the hashes to send');
 const spellings=[ROUTE,'/api/study-draft/capture-sources/sto%70','/api/study-draft/capture-sources/./stop','/api/study-draft/capture-sources/x/../stop','/api/study-draft/capture-sources\\stop','/api/study-draft/capture-sources/%2e/stop','/api/study-draft/%63apture-sources/stop','/api/study-draft/capture-sources/stop/../stop'];
 for(const actor of AGENTS)for(const spelling of spellings){
  const r=await h.raw('POST',spelling,input,h.as(actor));
  assert.equal(r.status,403,actor+' '+spelling+' '+JSON.stringify(r.body));assert.match(r.body.error,/human-only|Stopping a source for Check is for Adrian/,actor+' '+spelling);
 }
 assert.match((await h.raw('POST',ROUTE,input,h.as(AGENT))).body.error,/human-only; agent:codex may propose but not decide/);
 for(const spelling of [ROUTE,'/api/study-draft/capture-sources/x/../stop','/api/study-draft/capture-sources\\stop']){const none=await h.raw('POST',spelling,input,{});assert.equal(none.status,403,spelling+JSON.stringify(none.body));assert.match(none.body.error,/unattributed caller/);}
 // A replay of Adrian's own operation by an assistant is refused before any replay.
 const mine=await h.call(ROUTE,input);assert.equal(mine.status,200,JSON.stringify(mine.body));
 const after=h.tree(c.scope.bindingId);assert.notDeepEqual(after,before,'only his stop wrote');
 assert.equal((await h.call(ROUTE,input,AGENT)).status,403);
 const sealed=h.tree(c.scope.bindingId);
 for(const actor of AGENTS)assert.equal((await h.call(ROUTE,await c.stopInput(),actor)).status,403,actor);
 assert.deepEqual(h.tree(c.scope.bindingId),sealed,'every refusal left every file byte identical');
});

test('after Adrian stops the source, the list says so, the old receipt reads stale and Check holds for want of a source',async t=>{
 const c=await captured(t),{h}=c,pressed=await c.stopInput(),before=await c.check();assert.equal(before.status,200,JSON.stringify(before.body));assert.equal(before.body.status,'checked',JSON.stringify(before.body).slice(0,400));
 assert.equal((await c.list()).hasQuoteSource,true);
 const stopped=await h.call(ROUTE,pressed);assert.equal(stopped.status,200,JSON.stringify(stopped.body));
 const l=await c.list(),row=l.sources.find(x=>x.id===c.source.id);assert.equal(l.hasQuoteSource,false);assert.equal(row.stopped,true);assert.equal(row.eligible,false);
 const receipt=await h.call('/api/study-draft/check?bindingId='+c.scope.bindingId+'&parentStudyId='+c.scope.parentStudyId);
 assert.equal(receipt.status,200);assert.equal(receipt.body.status,'stale','the earlier receipt reads out of date');
 const again=await c.check();assert.equal(again.status,200);assert.equal(again.body.status,'held');
 // A double press settles; a stale hash, a wrong copy and a bad body are refused.
 assert.equal((await h.call(ROUTE,{...pressed,operationId:randomUUID()})).status,200,'a double press settles');
 assert.equal((await h.call(ROUTE,{...pressed,operationId:randomUUID(),copiedHash:'0'.repeat(64)})).status,409);
 assert.equal((await h.call(ROUTE,{...pressed,operationId:randomUUID(),extra:1})).status,400);
});

test('capture with again:true is Adrian only; a stopped source cannot be brought back without it',async t=>{
 const c=await captured(t),{h}=c;assert.equal((await h.call(ROUTE,await c.stopInput())).status,200);
 const send=async(actor,item,operationId=randomUUID())=>{const r=await c.row(),l=await c.list();return h.call('/api/study-draft/capture-sources',{...c.scope,operationId,expectedSourcesHash:l.sourcesHash,sources:[{sourceId:c.source.id,sourceHash:r.hash,...item}]},actor);};
 const before=h.tree(c.scope.bindingId);
 for(const actor of AGENTS){const r=await send(actor,{again:true});assert.equal(r.status,403,actor+JSON.stringify(r.body));}
 for(const spelling of ['/api/study-draft/capture-sources','/api/study-draft/x/../capture-sources','/api/study-draft\\capture-sources','/api/study-draft/capture-source%73']){const l=await c.list(),r=await c.row(),res=await h.raw('POST',spelling,{...c.scope,operationId:randomUUID(),expectedSourcesHash:l.sourcesHash,sources:[{sourceId:c.source.id,sourceHash:r.hash,again:true}]},h.as(AGENT));assert.equal(res.status,403,spelling+JSON.stringify(res.body));}
 assert.deepEqual(h.tree(c.scope.bindingId),before,'nothing was written');
 const without=await send('human:adrian',{});assert.equal(without.status,409,JSON.stringify(without.body));assert.match(JSON.stringify(without.body),/You stopped using this for Check/);
 assert.deepEqual(h.tree(c.scope.bindingId),before,'the refused bulk press wrote nothing');
 const back=await send('human:adrian',{again:true});assert.equal(back.status,200,JSON.stringify(back.body));
 assert.equal((await c.list()).hasQuoteSource,true);assert.equal((await c.row()).stopped,undefined);
});
