import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createReplay,hash} from '../agents/remote/replay.mjs';
function fixture(t){const stateDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-remote-ledger-'));fs.chmodSync(stateDir,0o700);t.after(()=>fs.rmSync(stateDir,{recursive:true,force:true}));return {stateDir,request:{principalId:'a',tool:'prepare',operationId:randomUUID(),projectId:'p',input:{words:'PRIVATE synthetic preparation'}}};}
test('durable delivery stores only fingerprints/receipts; restart replays without owner execution',async t=>{
 const {stateDir,request}=fixture(t);let calls=0;const receipt={requestId:randomUUID(),mayApply:false};await createReplay({stateDir})(request,async()=>{calls++;return receipt;});
 const replay=await createReplay({stateDir})(request,async()=>{calls++;throw Error('must not execute');});assert.equal(calls,1);assert.equal(replay.replayed,true);assert.equal(replay.receiptIsHistorical,true);assert.equal(replay.requestId,receipt.requestId);
 const persisted=fs.readFileSync(path.join(stateDir,'deliveries',hash(['a',request.operationId])+'.json'),'utf8');assert.ok(!persisted.includes(request.input.words));
 await assert.rejects(createReplay({stateDir})({...request,input:{words:'different'}},async()=>{}),e=>e.code==='operation_reused');
});
test('concurrent call, lost reply, corrupt receipt and interrupted start never execute a second owner attempt',async t=>{
 const {stateDir,request}=fixture(t);let release,calls=0;const first=createReplay({stateDir})(request,async()=>{calls++;await new Promise(r=>release=r);throw Error('reply lost');});
 await new Promise(r=>setImmediate(r));await assert.rejects(createReplay({stateDir})(request,async()=>calls++),e=>e.code==='outcome_uncertain');release();await assert.rejects(first,/reply lost/);
 await assert.rejects(createReplay({stateDir})(request,async()=>calls++),e=>e.code==='outcome_uncertain');assert.equal(calls,1);
 const file=path.join(stateDir,'deliveries',hash(['a',request.operationId])+'.json');fs.writeFileSync(file,'{bad');await assert.rejects(createReplay({stateDir})(request,async()=>calls++));assert.equal(calls,1);
});
