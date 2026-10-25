import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createKeptSourceTranslationRequests} from '../runtime/services/kept-source-translation-requests.mjs';
import {createTranslationOneRunAdmission} from '../runtime/services/translation-one-run-admission.mjs';
import {validateImportedTranscriptTranslation} from '../config.mjs';
import {createReviewConnection} from '../scripts/review-connection.mjs';
import {createExistingWorkReview,readReviewTranslationPermission} from '../scripts/review-existing.mjs';
import {sourceTranslationFixture} from './helpers/kept-source-translation-fixture.mjs';
const route='/api/source-sessions/translation-proposals';
const receiptFiles=root=>fs.existsSync(path.join(root,'.translation-one-run-admissions'))?fs.readdirSync(path.join(root,'.translation-one-run-admissions')):[];
async function assertConsumed(pending){const result=await pending;assert.equal(result.state,'error');assert.match(result.message,/already been consumed/);assert.deepEqual(result.proposals,[]);assert.equal(result.execution,undefined);}
const calls=f=>fs.existsSync(f.log)?fs.readFileSync(f.log,'utf8').trim().split('\n').length:0;
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
async function fixture(t){const f=await sourceTranslationFixture(t,{enabled:false}),state=await f.read(),s=state.sessions[0],config={translation:{codexPath:path.join(f.root,'fake-account'),timeoutMs:10000,keptConversations:{enabled:true,shareEntireContext:true,sourceIds:[s.sourceId],oneRunId:randomUUID()}}},input={sessionId:s.id,expectedRevision:state.revision,expectedSourceHash:s.sourceHash};const owner=(extra={})=>createKeptSourceTranslationRequests({read:async()=>structuredClone(state),config,admissionDataDir:f.root,...extra});return {...f,state,config,input,owner};}

test('owner admission persists across reconstruction; new explicit UUID permits one more fake attempt',async t=>{
 const f=await fixture(t),first=f.owner();
 assert.equal((await first.propose(f.input)).state,'proposal-ready');assert.equal(calls(f),1);
 await assertConsumed(first.propose(f.input));await assertConsumed(f.owner().propose(f.input));assert.equal(calls(f),1);
 f.config.translation.keptConversations.oneRunId=randomUUID();assert.equal((await f.owner().propose(f.input)).state,'proposal-ready');assert.equal(calls(f),2);
 assert.equal(receiptFiles(f.root).length,2);
 for(const file of receiptFiles(f.root)){const raw=fs.readFileSync(path.join(f.root,'.translation-one-run-admissions',file),'utf8'),receipt=JSON.parse(raw);assert.deepEqual(Object.keys(receipt).sort(),['consumedAt','oneRunId','schema','scope']);assert.equal(receipt.scope,'owner');assert.ok(!raw.includes(f.input.sessionId)&&!raw.includes(f.input.expectedSourceHash)&&!raw.includes('虚构'));}
});

test('independent concurrent owner instances admit exactly one fake execution',async t=>{
 const f=await fixture(t),results=await Promise.allSettled([f.owner().propose(f.input),f.owner().propose(f.input)]);
 assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.state==='proposal-ready').length,1);assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.state==='error'&&/already been consumed/.test(r.value.message)).length,1);assert.equal(calls(f),1);
});

test('invalid owner preflight never consumes; failed fake execution consumes permanently',async t=>{
 const f=await fixture(t);await assert.rejects(f.owner().propose({...f.input,expectedRevision:f.input.expectedRevision+1}),{status:409});await assert.rejects(f.owner().propose({...f.input,permission:true}),{status:400});assert.deepEqual(receiptFiles(f.root),[]);
 fs.writeFileSync(f.marker,'error');assert.equal((await f.owner().propose(f.input)).state,'error');assert.equal(calls(f),1);await assertConsumed(f.owner().propose(f.input));assert.equal(calls(f),1);
});

test('final pinned-context mismatch does not consume the owner permit',async t=>{
 const f=await fixture(t);let reads=0;
 const owner=f.owner({read:async()=>{const state=structuredClone(f.state);if(++reads>1)state.revision++;return state;}});
 const refused=await owner.propose(f.input);assert.equal(refused.state,'error');assert.match(refused.message,/selected conversation changed/);assert.deepEqual(receiptFiles(f.root),[]);assert.equal(calls(f),0);
 assert.equal((await f.owner().propose(f.input)).state,'proposal-ready');
});

test('oneRunId requires a trusted directory, real ancestors and explicit execution grants',async t=>{
 const f=await fixture(t);const refused=await f.owner({admissionDataDir:null}).propose(f.input);assert.equal(refused.state,'error');assert.match(refused.message,/trusted imported owner data directory/);assert.equal(calls(f),0);
 const link=path.join(f.root,'linked');fs.symlinkSync(f.root,link);assert.throws(()=>createTranslationOneRunAdmission({oneRunId:randomUUID(),dataDir:link,scope:'owner'})(),/real directories/);
 f.config.translation.keptConversations.enabled=false;assert.equal((await f.owner({admissionDataDir:null}).propose(f.input)).state,'unavailable');assert.deepEqual(receiptFiles(f.root),[]);
 assert.throws(()=>validateImportedTranscriptTranslation({...f.config.translation,keptConversations:{...f.config.translation.keptConversations,oneRunId:'all'}}),/UUID/);
});

async function proxy(t,f,{failNetwork=false,fromHost=false}={}){
 const posts=[];const upstream=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;if(req.url==='/api/source-sessions'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(f.state));}posts.push(body);if(failNetwork)return req.socket.destroy();res.setHeader('content-type','application/json');res.end(JSON.stringify({state:'proposal-ready',applied:false,proposals:[]}));});
 const ownerPort=await listen(upstream),base={authorityURL:'http://127.0.0.1:'+ownerPort,allowedAuthorityPort:ownerPort};let server;
 if(fromHost){
  const hostFile=path.join(f.root,randomUUID()+'.json');fs.writeFileSync(hostFile,JSON.stringify({importedTranscriptOwner:{dataDir:f.root,translation:f.config.translation}}));
  const inspection={assertCurrent:()=>{},...Object.fromEntries(['tree','folders','sourceText','collectionsSnapshot','collectionRelationships','evidence'].map(name=>[name,async()=>({})]))};
  ({server}=await createExistingWorkReview({config:{...base,magazineRoots:[]},libraryInspection:inspection,libraryInspectionConfigFile:hostFile}));
 }else server=createReviewConnection({...base,translationProposals:f.config.translation,translationAdmissionDataDir:f.root});
 const port=await listen(server),origin='http://127.0.0.1:'+port;t.after(async()=>{await close(server);await close(upstream);});
 return {posts,async request(body=f.input){const response=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}};
}

test('proxy one-use receipt survives reconstruction, concurrent attempts and owner scope independently',async t=>{
 const f=await fixture(t),a=await proxy(t,f,{fromHost:true}),b=await proxy(t,f,{fromHost:true});
 assert.equal((await a.request({...f.input,expectedRevision:f.input.expectedRevision+1})).status,409);assert.deepEqual(receiptFiles(f.root),[]);
 const results=await Promise.all([a.request(),b.request()]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(a.posts.length+b.posts.length,1);
 const restarted=await proxy(t,f);assert.equal((await restarted.request()).status,409);assert.equal(restarted.posts.length,0);
 assert.equal((await f.owner().propose(f.input)).state,'proposal-ready','proxy and owner consume separate receipt scopes');assert.equal(receiptFiles(f.root).length,2);
 f.config.translation.keptConversations.oneRunId=randomUUID();const next=await proxy(t,f);assert.equal((await next.request()).status,200);
});

test('failed proxy network attempt consumes one-use receipt and cannot automatically retry',async t=>{
 const f=await fixture(t),first=await proxy(t,f,{failNetwork:true});assert.equal((await first.request()).status,502);assert.equal(first.posts.length,1);
 const retry=await proxy(t,f);assert.equal((await retry.request()).status,409);assert.equal(retry.posts.length,0);
});

test('explicit inspection host requires its trusted owner directory for a one-use grant',async t=>{
 const f=await fixture(t),host=path.join(f.root,'missing-dir-host.json');fs.writeFileSync(host,JSON.stringify({importedTranscriptOwner:{translation:f.config.translation}}));await assert.rejects(readReviewTranslationPermission(host,{assertCurrent:()=>{}}),/trusted imported owner data directory/);
});
