import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createJournal} from '../runtime/services/journal.mjs';
import {createActivityRecovery} from '../runtime/services/activity-recovery.mjs';
import {atomicWrite,observeAtomicWrites} from '../runtime/services/files.mjs';
import {createEventBus} from '../runtime/services/events.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createServer} from '../runtime/server.mjs';
const repo=fileURLToPath(new URL('..',import.meta.url));
function fixture(t){const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'activity-recovery-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));const operationId=randomUUID(),file=path.join(dataDir,'workspaces','p','human-direction-history',operationId+'.json'),meta={operationId,kind:'concept.save',scope:{kind:'project',id:'p'},actor:'agent:codex',client:'cli'},receipt={schema:'ar-create.study-human-direction-operation.v1',operationId,status:'committed',after:{revision:2,hash:'a'.repeat(64),body:'Protected exact phrase.'}};fs.mkdirSync(path.dirname(file),{recursive:true});return {dataDir,file,meta,receipt};}
for(const phase of ['before-owner-commit','after-owner-commit','journal-failure','after-journal-commit'])test(`activity reconciles ${phase} without invented or duplicate commits`,async t=>{
 const f=fixture(t),events=createEventBus();let faulted=false;
 const fault=when=>{if(!faulted&&when===phase){faulted=true;throw Error('synthetic crash');}};
 const j=createJournal({dataDir:f.dataDir,beforeAppend:()=>{if(phase==='journal-failure'&&!faulted){faulted=true;throw Error('journal unavailable');}}}),activity=createActivityRecovery({dataDir:f.dataDir,journal:j,events,fault});
 try{observeAtomicWrites(change=>activity.observe(()=>f.meta,change),()=>atomicWrite(f.file,JSON.stringify(f.receipt)));await activity.reconcile();}catch(error){assert.match(error.message,/synthetic crash|journal unavailable/);}
 const restartedJournal=createJournal({dataDir:f.dataDir}),restarted=createActivityRecovery({dataDir:f.dataDir,journal:restartedJournal,events});await restarted.reconcile();await restarted.reconcile();
 let lines=(await restartedJournal.read()).lines;
 if(phase==='before-owner-commit'){assert.equal(fs.existsSync(f.file),false);assert.equal(lines.length,0);observeAtomicWrites(change=>restarted.observe(()=>f.meta,change),()=>atomicWrite(f.file,JSON.stringify(f.receipt)));await restarted.reconcile();lines=(await restartedJournal.read()).lines;}
 assert.equal(lines.length,1);assert.equal(lines[0].status,'committed');assert.equal(lines[0].operationId,f.meta.operationId);assert.equal(lines[0].after.revision,2);assert.equal(fs.readFileSync(f.file,'utf8'),JSON.stringify(f.receipt));
 restarted.recordResponse({...f.meta,status:'committed',after:{revision:2,hash:'a'.repeat(64)}});await restarted.reconcile();assert.equal((await restartedJournal.read()).lines.length,1,'identical retry projects once');
 assert.equal(events.since(0).events.length,phase==='journal-failure'?2:1);
 if(phase==='journal-failure')assert.equal(events.since(0).events[0].activityPending,true,'live readers still learn the committed owner change while history is unavailable');
});
test('observed receipt survives later owner replacement and request contexts stay isolated',async t=>{
 const f=fixture(t),j=createJournal({dataDir:f.dataDir}),activity=createActivityRecovery({dataDir:f.dataDir,journal:j});
 await Promise.all([observeAtomicWrites(change=>activity.observe(()=>f.meta,change),async()=>{await new Promise(r=>setTimeout(r,5));atomicWrite(f.file,JSON.stringify(f.receipt));}),Promise.resolve().then(()=>atomicWrite(path.join(f.dataDir,'unrelated.json'),JSON.stringify({...f.receipt,operationId:randomUUID()})))]);
 atomicWrite(f.file,JSON.stringify({...f.receipt,operationId:randomUUID(),after:{revision:3}}));
 await createActivityRecovery({dataDir:f.dataDir,journal:j}).reconcile();assert.equal((await j.read()).lines.length,1);assert.equal((await j.read()).lines[0].operationId,f.meta.operationId);
});
test('uncommitted owner receipts never create successful activity',async t=>{
 const f=fixture(t),j=createJournal({dataDir:f.dataDir}),activity=createActivityRecovery({dataDir:f.dataDir,journal:j});
 for(const status of ['pending','rejected'])observeAtomicWrites(change=>activity.observe(()=>f.meta,change),()=>atomicWrite(f.file,JSON.stringify({...f.receipt,status})));
 await activity.reconcile();assert.deepEqual((await j.read()).lines,[]);
});
test('real owner commit, process exit before journal, restart and identical HTTP retry retain exact words once',async t=>{
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config)),pid='activity-crash-'+randomUUID();let server;
 const childCode=`import {createServer} from ${JSON.stringify(new URL('../runtime/server.mjs',import.meta.url).href)}; const c=JSON.parse(process.env.SYNTHETIC_CONFIG);const s=await createServer({...c,publicDir:${JSON.stringify(path.join(repo,'public'))},sharedArticles:true,researchEnabled:false,activityFault:(phase,d)=>{if(phase==='after-owner-commit'&&d.line.kind==='concept.save')process.exit(73);}});s.listen(0,'127.0.0.1',()=>process.send({port:s.address().port}));`;
 const child=spawn(process.execPath,['--input-type=module','-e',childCode],{env:{...process.env,SYNTHETIC_CONFIG:JSON.stringify(config)},stdio:['ignore','pipe','pipe','ipc']});let stderr='';child.stderr.on('data',d=>stderr+=d);t.after(async()=>{child.kill();if(server)await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const ready=await Promise.race([once(child,'message').then(([m])=>m),once(child,'exit').then(([code])=>{throw Error('child exited '+code+' '+stderr);})]);let url='http://127.0.0.1:'+ready.port;
 const post=(route,input)=>fetch(url+route,{method:'POST',headers:{'content-type':'application/json',Origin:url},body:JSON.stringify(input)});
 const made=await (await post('/api/concepts',{parentStudyId:pid,title:'Synthetic durable words',operationId:randomUUID()})).json();assert.ok(made.hash,JSON.stringify(made));
 const input={parentStudyId:pid,operationId:randomUUID(),expectedRevision:made.revision,expectedHash:made.hash,authorThoughts:'Protected exact words — never paraphrase.',aiInterpretation:'Invented reading.',suggestions:'',sourceSelections:[]};
 const died=once(child,'exit');await assert.rejects(post('/api/concept/save',input));assert.equal((await died)[0],73);
 server=await createServer({...config,publicDir:path.join(repo,'public'),sharedArticles:true,researchEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;
 const history=async()=> (await (await fetch(url+'/api/journal?kind=project&id='+encodeURIComponent(pid))).json()).lines.filter(r=>r.operationId===input.operationId&&r.status==='committed');
 assert.equal((await history()).length,1,'recovered before any retry or new write');const retry=await post('/api/concept/save',input);assert.equal(retry.status,200);const saved=await retry.json();assert.equal(saved.authorThoughts,input.authorThoughts);assert.equal((await history()).length,1);assert.match(fs.readFileSync(saved.path,'utf8'),/Protected exact words — never paraphrase\./);
});

test('response-resolved scope is specific and never duplicates the committed operation',async t=>{
 const f=fixture(t),j=createJournal({dataDir:f.dataDir}),a=createActivityRecovery({dataDir:f.dataDir,journal:j});
 observeAtomicWrites(change=>a.observe(()=>f.meta,change),()=>atomicWrite(f.file,JSON.stringify(f.receipt)));
 a.recordResponse({...f.meta,scope:{kind:'draft',id:'resolved-binding'},status:'committed',after:{revision:2}});await a.reconcile();
 assert.equal((await j.read()).lines.length,1);assert.deepEqual((await j.read()).lines[0].scope,{kind:'draft',id:'resolved-binding'});
 a.recordResponse({...f.meta,status:'committed',after:{revision:2}});await a.reconcile();assert.equal((await j.read()).lines.length,1);
});
test('native pending recovery is visible and known refused attempts are cleaned',async t=>{
 const f=fixture(t),j=createJournal({dataDir:f.dataDir}),a=createActivityRecovery({dataDir:f.dataDir,journal:j,readNativeReceipt:()=>{throw Object.assign(Error('missing'),{status:404});}}),input={bindingId:'b',parentStudyId:'p',operationId:f.meta.operationId};
 a.beginNative(f.meta,input);let health=await a.reconcile();assert.equal(health.pending.length,1);assert.equal(health.unresolved,1);assert.equal(health.pending[0].state,'owner-receipt-unresolved');
 a.recordResponse({...f.meta,status:'conflict'});health=await a.reconcile();assert.equal(health.pending.length,0);assert.equal((await j.read()).lines[0].status,'conflict');
});

test('native owner receipt restores activity independently of journal and preserves exact Undo',async t=>{
 const f=fixture(t),native=createStudyDraftCopies({dataDir:fs.realpathSync(f.dataDir),originals:{catalog:()=>({drafts:[]}),readDraft:()=>null}}),parentStudyId='native-activity',made=await native.createCollection({parentStudyId,title:'Native activity',operationId:randomUUID()});
 const input={bindingId:made.binding.id,parentStudyId,operationId:randomUUID(),expected:made.expected,operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Protected exact native words.'}]},meta={...f.meta,operationId:input.operationId,kind:'study-draft.save',scope:{kind:'draft',id:made.binding.id}};
 const j=createJournal({dataDir:f.dataDir}),a=createActivityRecovery({dataDir:f.dataDir,journal:j,readNativeReceipt:i=>native.inspect(i)});a.beginNative(meta,input);const saved=await native.save(input);
 const restored=createActivityRecovery({dataDir:f.dataDir,journal:createJournal({dataDir:f.dataDir}),readNativeReceipt:i=>native.inspect(i)});const result=await restored.reconcile();assert.equal(result.published,1);assert.equal(result.pending.length,0);
 const replay=await native.save(input);assert.equal(replay.raw,saved.raw);assert.equal((await j.read()).lines.filter(r=>r.operationId===input.operationId).length,1);
 const undone=await native.undo({bindingId:made.binding.id,parentStudyId,expected:saved.expected,operationId:randomUUID(),undoOperationId:input.operationId});assert.equal(undone.raw,made.raw,'exact saved Undo remains owner-controlled');
});

test('an imported JSON document cannot masquerade as an owner receipt',async t=>{
 const f=fixture(t),j=createJournal({dataDir:f.dataDir}),a=createActivityRecovery({dataDir:f.dataDir,journal:j});
 observeAtomicWrites(change=>a.observe(()=>f.meta,change),()=>atomicWrite(path.join(f.dataDir,'imported.json'),JSON.stringify(f.receipt)));await a.reconcile();assert.deepEqual((await j.read()).lines,[]);
});
test('registered owner partial and committed transitions are stable and remain distinct on reconciliation',async t=>{
 const f=fixture(t),j=createJournal({dataDir:f.dataDir}),rows=[],a=createActivityRecovery({dataDir:f.dataDir,journal:j,ownerReceipts:()=>rows});
 const row={operationId:f.meta.operationId,command:'simmer.intake',actor:'agent:codex',client:'mcp',scope:{kind:'project',id:'subject'},after:{subject:'subject',steps:{note:{status:'committed',id:'retained-source'}}}};
 rows.push({...row,id:'simmer:'+row.operationId+':partial',status:'partial',at:'2026-11-01T00:00:00Z'});await a.reconcile();assert.equal((await j.read()).lines[0].status,'partial');
 rows.push({...row,id:'simmer:'+row.operationId+':committed',status:'committed',at:'2026-11-01T00:01:00Z'});await a.reconcile();await a.reconcile();const lines=(await j.read()).lines;assert.deepEqual(lines.map(l=>l.status),['committed','partial']);assert.deepEqual(lines.map(l=>l.ts),['2026-11-01T00:01:00Z','2026-11-01T00:00:00Z']);assert.equal(lines.filter(l=>l.status==='committed').length,1);
});
