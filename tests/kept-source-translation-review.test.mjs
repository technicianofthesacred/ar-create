import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {sourceTranslationFixture} from './helpers/kept-source-translation-fixture.mjs';
import {createSourceSessions,createImportedSourceOwner} from '../runtime/services/source-sessions.mjs';
import {createServer} from '../runtime/server.mjs';
import {loadConfig} from '../config.mjs';
import {createKeptSourceTranslationReview,translationReviewContextHash,validateTranslationReviewConfig} from '../runtime/services/kept-source-translation-review.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const f=await sourceTranslationFixture(t,{enabled:false}),state=await f.read(),session=state.sessions[0],file=path.join(f.root,'review.json');
 const receipt={sourceId:session.sourceId,sourceHash:session.sourceHash,applied:false,purpose:'Synthetic saved translation review',proposals:['gap','gap2'].map(turnId=>({turnId,label:'English proposal',current:session.turns.find(t=>t.id===turnId).text,proposal:'Invented English '+turnId,uncertainty:'Invented uncertainty'}))};
 fs.writeFileSync(file,JSON.stringify(receipt));
 const descriptor={file,expectedSha256:digest(fs.readFileSync(file)),sessionId:session.id,sourceId:session.sourceId,expectedRevision:state.revision,expectedSourceHash:session.sourceHash,expectedContextHash:translationReviewContextHash(session)};
 const input={sessionId:session.id,expectedRevision:state.revision,expectedSourceHash:session.sourceHash};
 return {...f,state,session,file,receipt,descriptor,input};
}
const snapshot=root=>fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>{const file=path.join(root,e.name);return e.isDirectory()?snapshot(file):[[file,fs.readFileSync(file).toString('hex'),fs.statSync(file).mtimeMs,fs.statSync(file).ino]];});
test('normal HTTP saved review survives two new owners with generation revoked and zero writes/executions',async t=>{
 const f=await fixture(t);const before=snapshot(f.root);
 for(let i=0;i<2;i++){
  const source=createSourceSessions({manager:f.open(),translationReviewConfig:f.descriptor});
  const server=await createServer({dataDir:path.join(f.root,'http-app'),publicDir:f.publicDir,importedSourceFactory:async()=>source,researchEnabled:false});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
   const route='/api/source-sessions/translation-review?',query=new URLSearchParams(f.input);
   const response=await fetch(base+route+query),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.state,'proposal-ready');assert.equal(result.savedReview,true);assert.equal(result.applied,false);assert.deepEqual(result.proposals.map(p=>p.turnId),['gap','gap2']);assert.deepEqual(result.preservedTurnIds,['edited','english']);assert.deepEqual(result.sourceContext,{...f.input,sourceId:f.session.sourceId});
   for(const suffix of ['&file='+encodeURIComponent(f.file),'&sessionId=duplicate'])assert.equal((await fetch(base+route+query+suffix)).status,400);
   for(const revision of ['-1','1.0','1e0','01','9007199254740992'])assert.equal((await fetch(base+route+new URLSearchParams({...f.input,expectedRevision:revision}))).status,400);
   const generation=await fetch(base+'/api/source-sessions/translation-proposals',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(f.input)});assert.equal((await generation.json()).state,'unavailable');
  }finally{server.closeIdleConnections?.();await new Promise(r=>server.close(r));}
 }
 assert.deepEqual(await f.read(),f.state);assert.equal(fs.existsSync(f.log),false);
 // Server boot owns its normal app files; the imported source and receipt stay exact.
 for(const row of before)assert.deepEqual(snapshot(f.root).find(after=>after[0]===row[0]),row);
});
test('default off and startup config validation preserve the explicit descriptor through loadConfig',async t=>{
 const f=await fixture(t),none=createKeptSourceTranslationReview({read:()=>{throw Error('must not read');}});
 assert.deepEqual(await none.read(f.input),{state:'unavailable',gate:'no-saved-review',applied:false,proposals:[],message:'No saved translation review is connected for this conversation.'});
 assert.equal(validateTranslationReviewConfig(undefined),null);
 for(const patch of [{file:'relative'},{expectedRevision:-1},{sourceId:'not-uuid'},{expectedContextHash:'bad'},{extra:true},{file:f.root}])assert.throws(()=>validateTranslationReviewConfig({...f.descriptor,...patch}));
 const owner={dataDir:path.join(f.root,'owner'),notesFile:path.join(f.root,'notes'),handoverFile:path.join(f.root,'handover'),connections:[],translationReview:f.descriptor};
 const file=path.join(f.root,'config.json');fs.writeFileSync(file,JSON.stringify({allowScratchRoots:true,dataDir:path.join(f.root,'config-app'),importedTranscriptOwner:owner}));
 assert.deepEqual(loadConfig({AR_CREATE_CONFIG:file}).importedTranscriptOwner.translationReview,f.descriptor);
 fs.writeFileSync(file,JSON.stringify({allowScratchRoots:true,dataDir:path.join(f.root,'config-app'),importedTranscriptOwner:{...owner,translationReview:{...f.descriptor,extra:true}}}));assert.throws(()=>loadConfig({AR_CREATE_CONFIG:file}));
});
test('changed context at unchanged sourceHash preserves earlier review; owner race refuses proposals',async t=>{
 const f=await fixture(t);let state=structuredClone(f.state),calls=0;
 const review=createKeptSourceTranslationReview({read:async()=>{calls++;return state;},config:f.descriptor});
 state.sessions[0].turns[1].text='Different surrounding human words';const earlier=await review.read(f.input);assert.equal(earlier.state,'earlier-review');assert.equal(earlier.readOnly,true);assert.deepEqual(earlier.proposals.map(p=>p.turnId),['gap','gap2']);assert.deepEqual(earlier.sourceContext,{...f.input,sourceId:f.session.sourceId});
 state=structuredClone(f.state);calls=0;
 const race=createKeptSourceTranslationReview({read:async()=>{calls++;const v=structuredClone(state);if(calls===2)v.sessions[0].turns[1].originalText='Changed original';return v;},config:f.descriptor});
 await assert.rejects(race.read(f.input),{status:409});assert.equal(calls,2);
 for(const patch of [{expectedRevision:f.input.expectedRevision+1},{expectedSourceHash:'b'.repeat(64)},{sessionId:'another-session'}])await assert.rejects(review.read({...f.input,...patch}),{status:409});
});
test('immutable receipt drift, unsafe paths and incomplete/foreign/blank results refuse proposals',async t=>{
 const f=await fixture(t),reader=()=>createKeptSourceTranslationReview({read:()=>f.state,config:f.descriptor});
 const existing=reader();fs.appendFileSync(f.file,' ');await assert.rejects(existing.read(f.input),{status:409});
 for(const change of [r=>r.proposals.pop(),r=>r.proposals.push(r.proposals[0]),r=>r.proposals[0].turnId='english',r=>r.proposals[0].current='different',r=>r.proposals[0].proposal=' ',r=>r.applied=true,r=>r.sourceId='foreign',r=>r.proposals[0].uncertainty=42]){const receipt=structuredClone(f.receipt);change(receipt);fs.writeFileSync(f.file,JSON.stringify(receipt));f.descriptor.expectedSha256=digest(fs.readFileSync(f.file));await assert.rejects(reader().read(f.input),{status:409});}
 const link=path.join(f.root,'linked');fs.symlinkSync(f.root,link);assert.throws(()=>validateTranslationReviewConfig({...f.descriptor,file:path.join(link,'review.json')}),/symlink/);
 fs.unlinkSync(f.file);fs.symlinkSync(path.join(f.root,'mode'),f.file);assert.throws(()=>validateTranslationReviewConfig(f.descriptor),/symlink/);await assert.rejects(existing.read(f.input),{status:409});
});
test('restored receipt states missing uncertainty once and preserves captured notes',async t=>{const f=await fixture(t);delete f.receipt.proposals[0].uncertainty;fs.writeFileSync(f.file,JSON.stringify(f.receipt));f.descriptor.expectedSha256=digest(fs.readFileSync(f.file));const result=await createKeptSourceTranslationReview({read:()=>f.state,config:f.descriptor}).read(f.input);assert.match(result.reviewNote,/uncertainty notes were not retained/);assert.equal(result.proposals[0].uncertainty,'');assert.equal(result.proposals[1].uncertainty,'Invented uncertainty');});
test('canonical context hashing ignores object key order and binds every original/current field',()=>{const a={id:'x',turns:[{text:'current',originalText:'original',metadata:{z:1,a:2}}]},b={turns:[{metadata:{a:2,z:1},originalText:'original',text:'current'}],id:'x'};assert.equal(translationReviewContextHash(a),translationReviewContextHash(b));b.turns[0].metadata.a=3;assert.notEqual(translationReviewContextHash(a),translationReviewContextHash(b));});

test('trusted loadConfig descriptor reaches the real imported source factory',async t=>{
 const f=await fixture(t),entries=['start','overlay','manager'].map(name=>{const file=path.join(f.root,name);fs.writeFileSync(file,'Disabled synthetic legacy entrypoint');return {file,sha256:digest(fs.readFileSync(file))};});
 const owner={dataDir:path.join(f.root,'owner'),notesFile:path.join(f.root,'notes.json'),handoverFile:path.join(f.root,'handover.json'),connections:[],translationReview:f.descriptor};fs.writeFileSync(owner.notesFile,'{}');fs.writeFileSync(owner.handoverFile,JSON.stringify({schema:'ar-create.source-owner-handover.v1',state:'legacy-disabled',dataDir:owner.dataDir,legacyPort:8927,disabledStartFile:entries[0].file,disabledStartSha256:entries[0].sha256,disabledEntrypoints:entries.slice(1)}));const file=path.join(f.root,'startup-config.json');fs.writeFileSync(file,JSON.stringify({allowScratchRoots:true,dataDir:path.join(f.root,'factory-app'),importedTranscriptOwner:owner}));
 const service=await createImportedSourceOwner(loadConfig({AR_CREATE_CONFIG:file}).importedTranscriptOwner);const result=await service.readTranslationReview(f.input);assert.equal(result.state,'proposal-ready');assert.deepEqual(result.proposals.map(p=>p.turnId),['gap','gap2']);assert.equal(fs.existsSync(f.log),false);
});

test('same-source newer wording/hash/revision and removed targets retain all earlier rows and original provenance',async t=>{const f=await fixture(t);f.receipt.proposals=Array.from({length:25},(_,i)=>({turnId:'old-'+i,label:'Earlier English',current:'Earlier source words '+i,proposal:'Earlier proposal '+i}));fs.writeFileSync(f.file,JSON.stringify(f.receipt));f.descriptor.expectedSha256=digest(fs.readFileSync(f.file));const state=structuredClone(f.state);state.revision++;state.sessions[0].sourceHash='c'.repeat(64);state.sessions[0].turns=[{id:'new-current',text:'New current wording',originalText:'Original words'}];const input={...f.input,expectedRevision:state.revision,expectedSourceHash:state.sessions[0].sourceHash};const review=createKeptSourceTranslationReview({read:()=>state,config:f.descriptor}),result=await review.read(input);assert.equal(result.state,'earlier-review');assert.equal(result.proposals.length,25);assert.deepEqual(result.proposals.map(p=>p.currentAtPreparation),f.receipt.proposals.map(p=>p.current));assert.deepEqual(result.sourceContext,{...f.input,sourceId:f.session.sourceId});assert.deepEqual(result.currentSourceContext,{...input,sourceId:f.session.sourceId});assert.equal(result.applied,false);await assert.rejects(review.read(f.input),{status:409});state.sessions[0].sourceId='foreign';await assert.rejects(review.read(input),{status:409});});
test('unrelated global revision drift reuses exact context with current save guards and original provenance',async t=>{const f=await fixture(t),state=structuredClone(f.state);state.revision++;const input={...f.input,expectedRevision:state.revision};const review=createKeptSourceTranslationReview({read:()=>state,config:f.descriptor}),result=await review.read(input);assert.equal(result.state,'proposal-ready');assert.equal(result.sourceContext.expectedRevision,state.revision);assert.deepEqual(result.preparedSourceContext,{...f.input,sourceId:f.session.sourceId});assert.equal(result.reusedUnchangedContext,true);assert.match(result.reviewNote,/still match/);state.sessions[0].location='Changed metadata';assert.equal((await review.read(input)).state,'earlier-review');});

test('selected save then reload, owner restart and exact Undo permits a second guarded save without execution',async t=>{
 const f=await fixture(t);let service=createSourceSessions({manager:f.open(),translationReviewConfig:f.descriptor});
 const server=await createServer({dataDir:path.join(f.root,'reuse-app'),publicDir:f.publicDir,importedSourceFactory:async()=>({list:()=>service.list(),readTranslationReview:input=>service.readTranslationReview(input),edit:input=>service.edit(input),undo:input=>service.undo(input)}),researchEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeIdleConnections?.();await new Promise(r=>server.close(r));});const base='http://127.0.0.1:'+server.address().port;
 async function request(route,input){const response=await fetch(base+route,input?{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(input)}:{});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;}
 const read=()=>request('/api/source-sessions');const review=input=>request('/api/source-sessions/translation-review?'+new URLSearchParams(input));
 const before=await read(),initial=await review(f.input),selected=initial.proposals[0],edit={operationId:randomUUID(),...initial.sourceContext,turnId:selected.turnId,speaker:f.session.turns[0].speaker,text:selected.text};delete edit.sourceId;
 await request('/api/source-sessions/edit',edit);let saved=await read();assert.equal(saved.sessions[0].turns[0].text,selected.text);assert.equal((await review({sessionId:f.session.id,expectedRevision:saved.revision,expectedSourceHash:saved.sessions[0].sourceHash})).state,'earlier-review');
 service=createSourceSessions({manager:f.open(),translationReviewConfig:f.descriptor});saved=await read();await request('/api/source-sessions/undo',{operationId:randomUUID(),undoOperationId:edit.operationId,sessionId:f.session.id,expectedRevision:saved.revision,expectedSourceHash:saved.sessions[0].sourceHash});
 const restored=await read();assert.deepEqual(restored.sessions[0],before.sessions[0]);assert.equal(restored.sessions[0].undoOperationId,before.sessions[0].undoOperationId);assert.equal(translationReviewContextHash(restored.sessions[0]),f.descriptor.expectedContextHash);assert.ok(restored.revision>before.revision);
 const next=await review({sessionId:f.session.id,expectedRevision:restored.revision,expectedSourceHash:restored.sessions[0].sourceHash});assert.equal(next.state,'proposal-ready');assert.equal(next.reusedUnchangedContext,true);assert.equal(next.sourceContext.expectedRevision,restored.revision);assert.deepEqual(next.preparedSourceContext,initial.preparedSourceContext);assert.equal(next.preparedSourceContext.expectedRevision,before.revision);
 const second={...edit,operationId:randomUUID(),expectedRevision:next.sourceContext.expectedRevision,expectedSourceHash:next.sourceContext.expectedSourceHash};await request('/api/source-sessions/edit',second);assert.equal((await read()).sessions[0].turns[0].text,selected.text);assert.equal(fs.existsSync(f.log),false);assert.equal(digest(fs.readFileSync(f.file)),f.descriptor.expectedSha256);
});
