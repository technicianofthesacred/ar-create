import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {loadConfig,validateImportedTranscriptTranslation} from '../config.mjs';
import {createReviewConnection} from '../scripts/review-connection.mjs';
import {createExistingWorkReview,readReviewTranslationPermission} from '../scripts/review-existing.mjs';
const sourceId='12345678-1234-1234-1234-123456789abc',hash='a'.repeat(64),route='/api/source-sessions/translation-proposals';
const input={sessionId:'invented-session',expectedRevision:3,expectedSourceHash:hash};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
function files(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'translation-host-')),exe=path.join(dir,'fake-codex');fs.writeFileSync(exe,'#!/bin/sh\nexit 99\n',{mode:0o700});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,exe,policy:{codexPath:exe,timeoutMs:1000,keptConversations:{enabled:true,shareEntireContext:true,sourceIds:[sourceId]}}};}
function request(port,{url=route,method='POST',body=JSON.stringify(input),origin=`http://127.0.0.1:${port}`,type='application/json',site}={}){return new Promise((resolve,reject)=>{const headers={'content-type':type,...(origin===null?{}:{origin}),...(site?{'sec-fetch-site':site}:{})};const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.once('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.once('error',reject);req.end(method==='GET'?undefined:body);});}
async function setup(t,{policy=null,delay=0,snapshot={revision:3,sessions:[{id:input.sessionId,sourceId,sourceHash:hash}]},...options}={}){
 const calls=[];const owner=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;calls.push({url:req.url,method:req.method,body,headers:req.headers});res.setHeader('content-type','application/json');if(req.url==='/api/source-sessions')return res.end(JSON.stringify(snapshot));if(delay)await new Promise(r=>setTimeout(r,delay));res.end(JSON.stringify({state:'ready',applied:false,proposals:[{text:'Invented English proposal'}]}));});
 const ownerPort=await listen(owner),server=createReviewConnection({authorityURL:`http://127.0.0.1:${ownerPort}`,allowedAuthorityPort:ownerPort,timeoutMs:50,translationProposals:policy,...options}),port=await listen(server);
 t.after(async()=>{await close(server);await close(owner);});return {port,calls,ownerPort};
}

test('optional host translation stays off without explicit owner config; tools executable does not grant it',t=>{
 const f=files(t),file=path.join(f.dir,'config.json'),owner={dataDir:path.join(f.dir,'owner'),notesFile:path.join(f.dir,'notes.json'),handoverFile:path.join(f.dir,'handover.json'),connections:[]};
 fs.writeFileSync(file,JSON.stringify({dataDir:f.dir,allowScratchRoots:true,tools:{codex:f.exe},importedTranscriptOwner:owner}));
 assert.equal(loadConfig({AR_CREATE_CONFIG:file}).importedTranscriptOwner.translation,undefined);
 fs.writeFileSync(file,JSON.stringify({dataDir:f.dir,allowScratchRoots:true,importedTranscriptOwner:{...owner,translation:f.policy}}));
 assert.deepEqual(loadConfig({AR_CREATE_CONFIG:file}).importedTranscriptOwner.translation,f.policy);
 assert.equal(fs.existsSync(owner.dataDir),false,'config validation does not initialize an imported owner');
});

test('translation host config rejects extra commands, relative executable, unbounded timeout and implicit sharing',t=>{
 const {policy}=files(t);
 for(const bad of [{...policy,command:'other'},{...policy,codexPath:'codex'},{...policy,timeoutMs:0},{...policy,timeoutMs:600001},{...policy,timeoutMs:1000.5},{...policy,keptConversations:{...policy.keptConversations,enabled:'true'}},{...policy,keptConversations:{enabled:true,sourceIds:[sourceId]}},{...policy,keptConversations:{...policy.keptConversations,sourceIds:['all']}},{...policy,keptConversations:{...policy.keptConversations,sourceIds:[sourceId,sourceId]}}])assert.throws(()=>validateImportedTranscriptTranslation(bad));
 const copy=validateImportedTranscriptTranslation(policy);policy.keptConversations.sourceIds.length=0;assert.deepEqual(copy.keptConversations.sourceIds,[sourceId],'trusted policy is a startup snapshot');
});

test('source corrections never grant translation, and proposal path cannot be a POST read',async t=>{
 assert.throws(()=>createReviewConnection({readPostPaths:[route]}));
 const f=await setup(t,{sourceCorrections:true});const r=await request(f.port);assert.equal(r.status,503);assert.equal(JSON.parse(r.body).state,'unavailable');assert.equal(f.calls.length,0);
});

test('enabled generation forwards only unchanged exact request after current source guards; has its own deadline',async t=>{
 const {policy}=files(t),f=await setup(t,{policy,delay:150});const body=JSON.stringify(input),r=await request(f.port,{body});
 assert.equal(r.status,200,'generation may take longer than ordinary 50ms reads');assert.match(r.headers['cache-control'],/private.*no-store/);
 assert.deepEqual(f.calls.map(c=>[c.method,c.url]),[['GET','/api/source-sessions'],['POST',route]]);assert.equal(f.calls[1].body,body);assert.equal(f.calls[1].headers.origin,`http://127.0.0.1:${f.ownerPort}`);
 assert.equal(f.calls[1].headers.authorization,undefined);
});

test('proposal schema, route, origin, method and JSON guards refuse before any owner access',async t=>{
 const {policy}=files(t),f=await setup(t,{policy});
 for(const options of [{body:JSON.stringify({...input,sourceId})},{body:JSON.stringify({...input,permission:true})},{body:JSON.stringify({...input,expectedRevision:-1})},{body:JSON.stringify({...input,expectedSourceHash:'wrong'})},{body:'{}'},{body:'not JSON'},{origin:null},{origin:`http://localhost:${f.port}`},{site:'cross-site'},{url:route+'?enabled=true'},{method:'GET'},{type:'text/plain'}])assert.ok([400,403,405,415].includes((await request(f.port,options)).status),JSON.stringify(options));
 assert.equal(f.calls.length,0);
});

test('revision, source fingerprint, source allowlist and duplicate session mismatch refuse generation',async t=>{
 const {policy}=files(t);
 for(const snapshot of [{revision:4,sessions:[{id:input.sessionId,sourceId,sourceHash:hash}]},{revision:3,sessions:[{id:input.sessionId,sourceId,sourceHash:'b'.repeat(64)}]},{revision:3,sessions:[{id:input.sessionId,sourceId:'22345678-1234-1234-1234-123456789abc',sourceHash:hash}]},{revision:3,sessions:[{id:input.sessionId,sourceId,sourceHash:hash},{id:input.sessionId,sourceId,sourceHash:hash}]}]){
  const f=await setup(t,{policy,snapshot});assert.ok([403,409].includes((await request(f.port)).status));assert.deepEqual(f.calls.map(c=>c.method),['GET']);
 }
});

test('false or incomplete host grants stay unavailable and do not read private conversations',async t=>{
 const {policy}=files(t);
 for(const kept of [{enabled:false,shareEntireContext:true,sourceIds:[sourceId]},{enabled:true,shareEntireContext:false,sourceIds:[sourceId]},{enabled:true,shareEntireContext:true,sourceIds:[]}]){const f=await setup(t,{policy:{...policy,keptConversations:kept}});assert.equal((await request(f.port)).status,503);assert.equal(f.calls.length,0);}
});

test('freshness check revokes a changed host grant before private owner access',async t=>{
 const {policy}=files(t),f=await setup(t,{policy,translationPermissionCurrent:()=>{throw Object.assign(Error('Host changed'),{status:409});}});assert.equal((await request(f.port)).status,409);assert.equal(f.calls.length,0);
});

test('review permission comes only from explicit Library host file and its inspection freshness',async t=>{
 const f=files(t),file=path.join(f.dir,'host.json');fs.writeFileSync(file,JSON.stringify({importedTranscriptOwner:{translation:f.policy},tools:{codex:'/ignored'}}));let checks=0;const inspection={assertCurrent:()=>checks++};
 assert.equal(await readReviewTranslationPermission(null,inspection),null);assert.deepEqual(await readReviewTranslationPermission(file,inspection),f.policy);assert.equal(checks,2);await assert.rejects(()=>readReviewTranslationPermission(file,null));
 fs.writeFileSync(file,JSON.stringify({tools:{codex:f.exe},translation:f.policy}));assert.equal(await readReviewTranslationPermission(file,inspection),null,'top-level review or tools settings are not a grant');
 const config={authorityURL:'http://127.0.0.1:8841',allowedAuthorityPort:8841,magazineRoots:[],translationProposals:f.policy,importedTranscriptOwner:{translation:f.policy}};
 const {server}=await createExistingWorkReview({config});const port=await listen(server);t.after(()=>close(server));assert.equal((await request(port)).status,503,'review config cannot supply a replacement execution grant');
});


test('existing-work entrance derives enabled proxy policy from the same explicit inspection host file',async t=>{
 const f=files(t),up=await setup(t),file=path.join(f.dir,'host.json');
 fs.writeFileSync(file,JSON.stringify({importedTranscriptOwner:{translation:f.policy}}));
 let checks=0;const libraryInspection={scope:'invented-host',assertCurrent:()=>checks++,...Object.fromEntries(['tree','folders','sourceText','collectionsSnapshot','collectionRelationships','evidence'].map(name=>[name,async()=>({})]))};
 const {server}=await createExistingWorkReview({config:{authorityURL:`http://127.0.0.1:${up.ownerPort}`,allowedAuthorityPort:up.ownerPort,magazineRoots:[]},libraryInspection,libraryInspectionConfigFile:file});
 const port=await listen(server);t.after(()=>close(server));
 const response=await request(port);assert.equal(response.status,200);assert.equal(up.calls.at(-1).url,route);assert.equal(up.calls.at(-1).body,JSON.stringify(input));assert.ok(checks>=4,'host freshness checked during startup and before forwarding');
});
