import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createLibrary} from '../runtime/services/library.mjs';
import {createTranscriptManager} from '../runtime/services/imported-transcript-manager.mjs';
import {createSourceSessions} from '../runtime/services/source-sessions.mjs';
import {translationReviewContextHash} from '../runtime/services/kept-source-translation-review.mjs';
import {createServer} from '../runtime/server.mjs';
import {createReviewConnection} from '../scripts/review-connection.mjs';
import * as files from '../runtime/services/files.mjs';
import {StateError} from '../runtime/store.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const close=s=>new Promise(resolve=>{s.closeIdleConnections?.();s.close(resolve);});
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+s.address().port)));
async function fixture(t){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'translation-sequential-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dataDir=path.join(root,'owner'),library=createLibrary({dataDir});
 const open=()=>createTranscriptManager({dataDir,library,files,StateError,requests:{},store:{get:()=>({project:{id:'synthetic'}})}});
 let manager=open();await manager.api.import({expectedRevision:0,format:'structured',label:'Invented conversation',content:JSON.stringify({schema:'ar-create.transcript-import.v1',sourceId:'invented-sequential',sessions:[{id:'kept',title:'Invented garden discussion',turns:[...['a','b','c'].map((id,i)=>({id,speaker:'Visitor',text:['虚构的花园。','虚构的河流。','虚构的茶杯。'][i],language:'zh',timestamp:String(i),originalText:['虚构的花园。','虚构的河流。','虚构的茶杯。'][i]})),{id:'d',speaker:'Host',text:'An invented English reply.'}]}]})});
 let raw=await manager.api.list();await manager.api.decide({expectedRevision:raw.revision,sessionId:raw.sessions[0].id,editorial:'keep',reason:'Invented verification',product:{status:'unknown',notes:'',turnIds:[]}});
 raw=await manager.api.list();await manager.api.edit({operationId:randomUUID(),expectedRevision:raw.revision,expectedSourceHash:raw.sessions[0].sourceHash,sessionId:raw.sessions[0].id,turnId:'d',speaker:'Host',text:'A preserved prior human correction.'});
 const baseline=await createSourceSessions({manager}).list(),s=baseline.sessions[0];
 const receipt={sourceId:s.sourceId,sourceHash:s.sourceHash,applied:false,purpose:'Invented sequential review',proposals:['a','b','c'].map(id=>({turnId:id,label:'English proposal',current:s.turns.find(t=>t.id===id).text,proposal:'Invented English '+id,uncertainty:''}))};
 const file=path.join(root,'review.json');fs.writeFileSync(file,JSON.stringify(receipt));
 const descriptor={file,expectedSha256:sha(fs.readFileSync(file)),sessionId:s.id,sourceId:s.sourceId,expectedRevision:baseline.revision,expectedSourceHash:s.sourceHash,expectedContextHash:translationReviewContextHash(s)};
 let service=createSourceSessions({manager,translationReviewConfig:descriptor}),server,url,proxy,base;
 async function start(){server=await createServer({dataDir:path.join(root,'app'),publicDir:path.join(root,'public'),importedSourceFactory:async()=>service,researchEnabled:false});url=await listen(server);proxy=createReviewConnection({authorityURL:url,allowedAuthorityPort:server.address().port,sourceCorrections:true});base=await listen(proxy);}
 async function stop(){await close(proxy);await close(server);}await start();t.after(stop);
 async function request(route,body,status=200){const response=await fetch(base+route,body?{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
 const state=()=>request('/api/source-sessions');
 async function review(){const current=await state();return request('/api/source-sessions/translation-review?'+new URLSearchParams({sessionId:s.id,expectedRevision:current.revision,expectedSourceHash:current.sessions[0].sourceHash}));}
 async function accept(id){const result=await review(),current=(await state()).sessions[0],p=result.proposals.find(p=>p.turnId===id);assert.ok(p);const body={operationId:randomUUID(),expectedRevision:result.sourceContext.expectedRevision,expectedSourceHash:result.sourceContext.expectedSourceHash,sessionId:s.id,turnId:id,speaker:current.turns.find(t=>t.id===id).speaker,text:p.text,receiptSha256:result.receiptSha256};const saved=await request('/api/source-sessions/translation-accept',body);return {body,saved};}
 async function undo(operationId){const current=await state();return request('/api/source-sessions/undo',{operationId:randomUUID(),undoOperationId:operationId,sessionId:s.id,expectedRevision:current.revision,expectedSourceHash:current.sessions[0].sourceHash});}
 return {root,baseline,descriptor,receipt,request,state,review,accept,undo,get manager(){return manager;},get service(){return service;},async restart(){await stop();manager=open();service=createSourceSessions({manager,translationReviewConfig:descriptor});await start();}};
}
test('three saved proposals: A then B, response replay, owner/proxy restart, Undo B then A restores original proposal states and prior Undo',async t=>{
 const f=await fixture(t),initial=await f.review();assert.deepEqual(initial.proposals.map(p=>p.turnId),['a','b','c']);
 const a=await f.accept('a');let r=await f.review();assert.equal(r.state,'proposal-ready');assert.deepEqual(r.acceptedTurnIds,['a']);assert.deepEqual(r.proposals.map(p=>p.turnId),['b','c']);assert.deepEqual(r.preparedSourceContext,initial.preparedSourceContext);
 const b=await f.accept('b');assert.deepEqual(await f.request('/api/source-sessions/translation-accept',b.body),b.saved);
 await f.restart();r=await f.review();assert.deepEqual(r.acceptedTurnIds,['a','b']);assert.deepEqual(r.proposals.map(p=>p.turnId),['c']);assert.equal(r.sourceContext.expectedRevision,(await f.state()).revision);
 await f.undo(b.body.operationId);r=await f.review();assert.deepEqual(r.acceptedTurnIds,['a']);assert.deepEqual(r.proposals.map(p=>p.turnId),['b','c']);assert.deepEqual(r.preparedSourceContext,initial.preparedSourceContext);
 await f.undo(a.body.operationId);r=await f.review();assert.deepEqual(r.acceptedTurnIds,[]);assert.deepEqual(r.proposals.map(p=>p.turnId),['a','b','c']);assert.deepEqual((await f.state()).sessions,f.baseline.sessions);assert.ok((await f.state()).revision>f.baseline.revision);assert.equal(sha(fs.readFileSync(f.descriptor.file)),f.descriptor.expectedSha256);
});
test('all saved has no remaining proposal, Undo restores one, generic matching edits never gain approval lineage',async t=>{
 const f=await fixture(t);await f.accept('a');await f.accept('b');const c=await f.accept('c');let r=await f.review();assert.equal(r.state,'proposal-ready');assert.deepEqual(r.proposals,[]);assert.deepEqual(r.acceptedTurnIds,['a','b','c']);await f.undo(c.body.operationId);assert.deepEqual((await f.review()).proposals.map(p=>p.turnId),['c']);
 const state=await f.state(),s=state.sessions[0];await f.request('/api/source-sessions/edit',{operationId:randomUUID(),sessionId:s.id,expectedRevision:state.revision,expectedSourceHash:s.sourceHash,turnId:'c',speaker:'Visitor',text:'Invented English c'});r=await f.review();assert.equal(r.state,'earlier-review');assert.equal(r.readOnly,true);
});
test('forged receipt, wrong wording, same operation with foreign receipt, stale guards and generic metadata cannot mutate',async t=>{
 const f=await fixture(t),r=await f.review(),s=(await f.state()).sessions[0],body={operationId:randomUUID(),sessionId:s.id,expectedRevision:r.sourceContext.expectedRevision,expectedSourceHash:s.sourceHash,turnId:'a',speaker:'Visitor',text:'Invented English a',receiptSha256:r.receiptSha256};
 const before=await f.state();for(const patch of [{receiptSha256:'b'.repeat(64)},{text:'An unapproved alternative'},{speaker:'Wrong person'},{expectedRevision:0}])await f.request('/api/source-sessions/translation-accept',{...body,...patch},409);
 await f.request('/api/source-sessions/edit',body,400);assert.deepEqual(await f.state(),before);
 const saved=await f.request('/api/source-sessions/translation-accept',body);await f.request('/api/source-sessions/translation-accept',{...body,receiptSha256:'c'.repeat(64)},409);assert.deepEqual(await f.request('/api/source-sessions/translation-accept',body),saved);
 const authority=await f.manager.api.list(),history=authority.history.find(h=>h.operationId===body.operationId),operation=authority.operations.find(o=>o.id===body.operationId);assert.deepEqual(history.translationAcceptance,operation.translationAcceptance);assert.equal(history.translationAcceptance.receiptSha256,r.receiptSha256);
});
