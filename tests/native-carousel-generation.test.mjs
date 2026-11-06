import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createStore} from '../runtime/store.mjs';
import {createStudyBindings} from '../runtime/services/study-bindings.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createStudyOwnedPhotoBindings} from '../runtime/services/study-owned-photo-bindings.mjs';
import {createLibrary} from '../runtime/services/library.mjs';
import {createNativeOutputFactory} from '../runtime/services/native-output-factory.mjs';
import {createStudyHumanDirection} from '../runtime/services/study-human-direction.mjs';
import {createCurrentUnderstandingResolver} from '../runtime/services/current-understanding.mjs';
import {createAssistanceDirectionContext} from '../runtime/services/assistance-direction-context.mjs';
import {conceptContextProjection} from '../runtime/services/concept-markdown.mjs';
import {createNativeCarouselMake} from '../runtime/services/native-carousel-make.mjs';
import {createArtifactExecution} from '../runtime/services/artifact-execution.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {digest} from '../runtime/services/files.mjs';
const agent=fn=>withActor({actor:'agent:codex',client:'http'},fn);
const raw='---\nkind: CAROUSEL\nstage: words\nstatus: for-your-yes\nstory: Invented vessel\n---\n\n## Slides\n1. [hook] What makes this vessel?\n2. [teach] The record names clay.\n3. [teach] It also names water.\n4. [close] Keep what the record actually says.\n\n## Caption\nClay and water are named. Other details remain unknown.\n';
async function fixture(t,{execute,publicationFault,resolved=false}={}){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'native-carousel-generation-'))),vault=path.join(dataDir,'invented-vault'),files=path.join(dataDir,'invented-files'),DEV='DEV - Invented.md',SRC='SRC - Invented.md';fs.mkdirSync(vault);fs.mkdirSync(files);fs.writeFileSync(path.join(vault,DEV),'---\ntitle: Invented vessel\n---\n\nThe source names clay and water. %%you: Private unselected thought.%%\n');fs.writeFileSync(path.join(vault,SRC),'The invented vessel combines clay and water.\n');
 const store=await createStore({dataDir,sharedArticles:true,publicationFault}),originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{},drafts:{invented:{parentStudyKey:'invented-parent',partKey:'1',title:'Invented vessel',path:DEV,support:[[SRC,'source']]}}}}),native=createStudyDraftCopies({dataDir,originals});
 const root=await native.openCopy({originalId:'invented',originalHash:digest(fs.readFileSync(path.join(vault,DEV))),parentStudyId:'invented-parent',operationId:randomUUID()}),bindings=createStudyBindings({dataDir,store}),library=createLibrary({dataDir});await bindings.select({projectKey:'invented-parent',title:'Invented project',operationId:randomUUID()});
 const ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings});await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'invented-parent',operationId:randomUUID()});
 const factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos}),group={rootBindingId:root.binding.id,parentStudyId:'invented-parent'},created=await factory.owner.create({...group,kind:'article',sourceBindingId:root.binding.id,expectedNative:root.expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()}),article=created.view.output;
 const direction=createStudyHumanDirection({dataDir,store,bindings,drafts:native,library,readOutputDocument:i=>store.readArticle(i)});let voice='Plain accepted voice.\n\n## Strengthenings queue\nUnaccepted voice must stay out.',count=0;
 const execution=createArtifactExecution({available:()=>true,execute:async packet=>{count++;return execute?execute(packet):{response:{artifacts:{'result.md':raw}}};}});
 const assistanceDirection=resolved?createAssistanceDirectionContext({resolver:createCurrentUnderstandingResolver({library,humanDirection:direction,collectionDirection:direction,nativeOutputs:factory.owner,nativeWords:native,carouselWords:store,conceptContextProjection}),humanDirection:direction,collectionDirection:direction,library,drafts:native}):undefined;
 const options={dataDir,native,assistanceDirection,outputs:factory.owner,scope:factory.scope,proof:factory.proof,guidance:{get:async()=>({voice,positions:'Keep uncertainty.',recipe:'Short useful sequence.'})},humanDirection:direction,library,execution,skillRoot:null},make=()=>createNativeCarouselMake(options);
 await store.createPiece({title:'Unrelated active Article',expectedProjectId:store.get().project.id,expectedRevision:store.get().revision});
 const input={...group,sourceBindingId:root.binding.id,sourceOutputId:article.id,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:group.parentStudyId})).expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()},selector={...group,requestId:input.operationId};
 t.after(async()=>{execution.dispose();await execution.wait('native-carousel:'+input.operationId);await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 return {dataDir,vault,store,native,factory,article,options,make,input,selector,execution,count:()=>count,setVoice:v=>voice=v,source:path.join(vault,SRC)};
}
async function prepared(f){const service=f.make();const preview=await agent(()=>service.preview(f.input));assert.equal(preview.status,'preview');await agent(()=>service.run(f.selector));await f.execution.wait('native-carousel:'+f.input.operationId);return {service,result:await service.get(f.selector)};}
test('exact native Article generates once, registers an independent unreviewed Carousel, survives pickup and preserves active work',async t=>{
 const f=await fixture(t),active=structuredClone(f.store.get()),nativeBefore=await f.native.read({bindingId:f.input.sourceBindingId,parentStudyId:f.input.parentStudyId}),{service,result}=await prepared(f);assert.equal(result.status,'result-ready',JSON.stringify(result));assert.equal(result.finalizationVerified,true);assert.equal(f.count(),1);
 const context=fs.readFileSync(path.join(f.dataDir,'native-carousel-make',f.input.operationId,'carousel-make',f.input.operationId,'context.md'),'utf8');assert.match(context,/The source names clay and water/);assert.match(context,/Plain accepted voice/);assert.doesNotMatch(context,/Private unselected thought|Unaccepted voice must stay out|Unrelated active Article/);
 await assert.rejects(agent(()=>service.run(f.selector)),/already/);assert.equal((await f.factory.owner.read(f.input)).outputs.length,1);
 const saved=await agent(()=>service.register(f.selector));assert.equal(saved.status,'registered');assert.equal(saved.view.wordOwner.kind,'carousel-words');assert.equal(saved.view.output.slides.length,4);assert.equal(saved.view.output.caption,'Clay and water are named. Other details remain unknown.');assert.equal(saved.view.output.wordsReview,undefined);assert.equal(saved.view.output.stage,'words');assert.equal(saved.view.output.adaptation.generated,true);assert.equal(saved.view.output.adaptation.reviewed,false);assert.equal(saved.view.output.adaptation.artifactHash,digest(raw));const historyPath=fs.readdirSync(path.join(f.dataDir,'native-outputs'),{recursive:true}).find(name=>name.endsWith('/history/'+f.input.operationId+'.json'));assert.ok(historyPath);const history=JSON.parse(fs.readFileSync(path.join(f.dataDir,'native-outputs',historyPath)));assert.equal(history.provenance.actor,'agent:codex');assert.equal(history.decision,undefined);
 assert.deepEqual(f.store.get(),active);assert.equal((await f.native.read({bindingId:f.input.sourceBindingId,parentStudyId:f.input.parentStudyId})).raw,nativeBefore.raw);assert.deepEqual((await f.factory.owner.read({...f.input,selectedOutputId:f.article.id})).output,f.article);
 const reopened=f.make(),again=await agent(()=>reopened.register(f.selector));assert.equal(again.outputId,saved.outputId);assert.equal((await f.factory.owner.read(f.input)).outputs.length,2);assert.equal(f.count(),1);f.setVoice('Later guidance does not retroactively fail a registered independent draft.');const pickup=await reopened.get(f.selector);assert.equal(pickup.status,'registered');assert.equal(pickup.execution.state,'complete');assert.equal(pickup.error,null);
 const v=saved.view;await assert.rejects(agent(()=>f.factory.owner.reviewCarouselWords({...f.selector,requestId:undefined,selectedOutputId:v.output.id,operationId:randomUUID(),expectedOutput:v.expectedOutput,expectedWords:v.writingProof.expected,wordsHash:v.writingProof.wordsHash})),{status:403});
 const words=await f.store.readCarouselWords({...v.photoScope,outputId:v.output.id});assert.match(words.raw,/What makes this vessel/);
});
for(const changed of ['guidance','source','native'])test(changed+' changes retain generated draft and refuse registration',async t=>{
 const f=await fixture(t),{service}=await prepared(f);if(changed==='guidance')f.setVoice('Changed accepted guidance.');if(changed==='source')fs.appendFileSync(f.source,'Later source detail.');if(changed==='native'){const s=await f.native.read({bindingId:f.input.sourceBindingId,parentStudyId:f.input.parentStudyId}),p=s.projection.find(p=>p.words.includes('source names'));await f.native.save({bindingId:f.input.sourceBindingId,parentStudyId:f.input.parentStudyId,expected:s.expected,operationId:randomUUID(),operations:[{kind:'text',id:p.id,from:0,to:3,insert:'This',seenBlockHash:p.blockHash}]});}
 const held=await service.get(f.selector);assert.equal(held.status,'needs-attention');assert.equal(held.artifact.raw,raw);await assert.rejects(agent(()=>service.register(f.selector)),/finalized current/);assert.equal((await f.factory.owner.read(f.input)).outputs.length,1);assert.equal(f.count(),1);
});
test('foreign target, modified preparation and changed artifact refuse without another execution or output',async t=>{
 const f=await fixture(t),{service}=await prepared(f);await assert.rejects(service.get({...f.selector,parentStudyId:'foreign'}));await assert.rejects(agent(()=>service.preview({...f.input,sourceOutputId:randomUUID()})),/another exact/);await assert.rejects(agent(()=>service.run({...f.selector,raw})),/exact/);
 fs.appendFileSync(path.join(f.dataDir,'native-carousel-make',f.input.operationId,'carousel-make',f.input.operationId,'result.md'),'Tampered');const result=await service.get(f.selector);assert.equal(result.status,'needs-attention');await assert.rejects(agent(()=>service.register(f.selector)));assert.equal((await f.factory.owner.read(f.input)).outputs.length,1);assert.equal(f.count(),1);
});
test('provider failure is retained without retry or registration',async t=>{
 const f=await fixture(t,{execute:async()=>{throw Error('Invented provider offline');}}),{service,result}=await prepared(f);assert.equal(result.status,'needs-attention');assert.equal(result.execution.state,'failed');assert.equal(result.modelExecuted,null);await assert.rejects(agent(()=>service.run(f.selector)),/already/);await assert.rejects(agent(()=>service.register(f.selector)));assert.equal(f.count(),1);
});
test('delayed completion remains scoped when unrelated selection changes',async t=>{
 let release;const gate=new Promise(r=>release=r),f=await fixture(t,{execute:async()=>{await gate;return {response:{artifacts:{'result.md':raw}}};}}),service=f.make();await agent(()=>service.preview(f.input));await agent(()=>service.run(f.selector));const waiting=await service.get(f.selector);assert.equal(waiting.status,'awaiting-artifact');assert.equal(waiting.modelExecuted,null);await assert.rejects(agent(()=>service.register(f.selector)));await f.store.createPiece({title:'Another unrelated Article',expectedProjectId:f.store.get().project.id,expectedRevision:f.store.get().revision});const active=structuredClone(f.store.get());release();await f.execution.wait('native-carousel:'+f.input.operationId);const saved=await agent(()=>service.register(f.selector));assert.equal(saved.status,'registered');assert.deepEqual(f.store.get(),active);assert.equal(f.count(),1);
});
test('completed generation remains recoverable after actual store and executor restart',async t=>{
 const f=await fixture(t);await prepared(f);await f.store.close();Object.assign(f.store,await createStore({dataDir:f.dataDir,sharedArticles:true}));const execution=createArtifactExecution({available:()=>true,execute:async()=>assert.fail('Restart must not resend')});t.after(()=>execution.dispose());const service=createNativeCarouselMake({...f.options,execution});const result=await service.get(f.selector);assert.equal(result.status,'result-ready');const saved=await agent(()=>service.register(f.selector));assert.equal(saved.status,'registered');assert.equal((await f.factory.owner.read(f.input)).outputs.length,2);assert.equal(f.count(),1);
});
test('interrupted running attempt never automatically resends or registers',async t=>{
 let release;const gate=new Promise(r=>release=r),f=await fixture(t,{execute:async()=>{await gate;return {response:{artifacts:{'result.md':raw}}};}}),service=f.make();await agent(()=>service.preview(f.input));await agent(()=>service.run(f.selector));const restarted=createArtifactExecution({available:()=>true,execute:async()=>assert.fail('Interrupted attempt must not resend')});const recovered=createNativeCarouselMake({...f.options,execution:restarted});const result=await recovered.get(f.selector);assert.equal(result.execution.state,'interrupted');await assert.rejects(agent(()=>recovered.run(f.selector)),/already/);await assert.rejects(agent(()=>recovered.register(f.selector)));release();await f.execution.wait('native-carousel:'+f.input.operationId);assert.equal((await recovered.get(f.selector)).execution.state,'interrupted');assert.equal((await f.factory.owner.read(f.input)).outputs.length,1);assert.equal(f.count(),1);restarted.dispose();
});
test('lost transaction reply recovers one registered output despite later source changes',async t=>{
 let armed=false;const f=await fixture(t,{publicationFault:phase=>{if(armed&&phase==='after-file:0'){armed=false;throw Error('Invented transaction interruption');}}}),{service}=await prepared(f);armed=true;await assert.rejects(agent(()=>service.register(f.selector)),/Invented transaction interruption/);await f.store.close();Object.assign(f.store,await createStore({dataDir:f.dataDir,sharedArticles:true}));f.setVoice('Changed after committed intent.');const recovered=await agent(()=>f.make().register(f.selector));assert.equal(recovered.status,'registered');assert.equal((await f.factory.owner.read(f.input)).outputs.length,2);assert.equal(f.count(),1);
});
test('Direction and finalized bundle races at transaction intent refuse publication',async t=>{
 for(const damage of ['direction','artifact']){
  const f=await fixture(t),direction=await f.options.humanDirection.read({scope:'project',parentStudyId:f.input.parentStudyId}),directionPath=direction.path||path.join(f.dataDir,'workspaces',direction.scope.projectId,'HUMAN-DIRECTION.md'),{service}=await prepared(f),save=f.store.saveOutputRecords.bind(f.store);let changed=false;
  f.store.saveOutputRecords=(input,prepare)=>save(input,async owner=>{const prepared=await prepare(owner);return {...prepared,finalCheck:async()=>{await prepared.finalCheck();await new Promise(r=>setImmediate(r));changed=true;if(damage==='artifact')fs.appendFileSync(path.join(f.dataDir,'native-carousel-make',f.input.operationId,'carousel-make',f.input.operationId,'complete.json'),'\n');else{fs.mkdirSync(path.dirname(directionPath),{recursive:true});fs.writeFileSync(directionPath,'Concurrent invented Direction bytes.');}}};});
  // The owner-created final guard also pins a previously absent Direction file.
  await assert.rejects(agent(()=>service.register(f.selector)),/bundle changed|Direction dependency changed/);if(damage==='direction')fs.unlinkSync(directionPath);assert.equal((await f.factory.owner.read(f.input)).outputs.length,1);
  assert.equal(changed,true);
 }
});

test('existing resolved Direction capture and final owner guard register without reentering native leases',async t=>{const f=await fixture(t,{resolved:true}),{service,result}=await prepared(f);assert.equal(result.status,'result-ready',JSON.stringify(result));const saved=await agent(()=>service.register(f.selector));assert.equal(saved.status,'registered');assert.equal(saved.reviewed,false);});

test('durable scoped discovery exposes no artifact and never executes or registers after reopening',async t=>{
 const f=await fixture(t),service=f.make();await agent(()=>service.preview(f.input));const group={rootBindingId:f.input.rootBindingId,parentStudyId:f.input.parentStudyId};let listed=await f.make().list(group);assert.equal(listed.items.length,1);assert.equal(listed.items[0].requestId,f.input.operationId);assert.equal(listed.items[0].status,'preview');assert.equal(f.count(),0);assert.doesNotMatch(JSON.stringify(listed),/assembledContext|artifact|contextHash|promptHash|clay|Private unselected/);await assert.rejects(service.list({...group,requestId:f.input.operationId}));
 const foreign=createNativeCarouselMake({...f.options,outputs:{...f.options.outputs,read:async()=>({outputs:[]})}});assert.deepEqual((await foreign.list({...group,parentStudyId:'other-scope'})).items,[]);
 await agent(()=>service.run(f.selector));await f.execution.wait('native-carousel:'+f.input.operationId);listed=await f.make().list(group);assert.equal(listed.items[0].status,'result-ready');assert.equal(listed.items[0].freshness,'not-checked');assert.equal(f.count(),1);assert.equal((await f.factory.owner.read(group)).outputs.length,1);
 await agent(()=>service.register(f.selector));assert.equal((await f.make().list(group)).items[0].status,'registered');assert.equal(f.count(),1);
});

test('durable cancellation rejects a late signal-ignoring provider result and survives restart without resend',async t=>{
 let release,returned=false,providerSignal,stateAtAbort;const gate=new Promise(r=>release=r),f=await fixture(t,{execute:async packet=>{providerSignal=packet.signal;packet.signal.addEventListener('abort',()=>{stateAtAbort=JSON.parse(fs.readFileSync(path.join(path.dirname(packet.cwd),path.basename(packet.cwd)+'.json'))).execution.state;});await gate;returned=true;return {response:{artifacts:{'result.md':raw}}};}}),service=f.make();
 await agent(()=>service.preview(f.input));await agent(()=>service.run(f.selector));
 let settled=false;const actualAttempt=f.execution.wait('native-carousel:'+f.input.operationId).then(()=>{settled=true;});
 // Waiting on an unprefixed UUID is a no-op: prove the real attempt is still gated.
 await f.execution.wait(f.input.operationId);await new Promise(r=>setImmediate(r));assert.equal(settled,false);assert.equal(returned,false);
 await assert.rejects(agent(()=>service.cancel({...f.selector,parentStudyId:'foreign'})));assert.equal(providerSignal.aborted,false);
 let cancelled;
 try{cancelled=await agent(()=>service.cancel(f.selector));assert.equal(providerSignal.aborted,true);assert.equal(stateAtAbort,'interrupted');}finally{release();}
 await actualAttempt;assert.equal(returned,true,'The deliberately uncooperative provider actually returned its late artifact.');assert.equal(settled,true);
 assert.equal(cancelled.status,'needs-attention');assert.equal(cancelled.execution.state,'interrupted');assert.equal(cancelled.modelExecuted,null);assert.deepEqual((await agent(()=>service.cancel(f.selector))).execution,cancelled.execution);
 const result=await service.get(f.selector);assert.equal(result.status,'needs-attention');assert.equal(result.execution.state,'interrupted');assert.equal(result.artifact,null);assert.equal(result.modelExecuted,null);
 const artifactDirectory=path.join(f.dataDir,'native-carousel-make',f.input.operationId,'carousel-make',f.input.operationId);for(const name of ['result.md','complete.json'])assert.equal(fs.existsSync(path.join(artifactDirectory,name)),false,name+' must not be written after cancellation');
 assert.equal((await f.factory.owner.read(f.input)).outputs.length,1);await assert.rejects(agent(()=>service.register(f.selector)));await assert.rejects(agent(()=>service.run(f.selector)),/already/);
 const execution=createArtifactExecution({available:()=>true,execute:async()=>assert.fail('Cancelled attempts must not resend after restart')});t.after(()=>execution.dispose());const restarted=createNativeCarouselMake({...f.options,execution});assert.equal((await restarted.get(f.selector)).execution.state,'interrupted');assert.equal((await restarted.list({rootBindingId:f.input.rootBindingId,parentStudyId:f.input.parentStudyId})).items[0].execution.state,'interrupted');await assert.rejects(agent(()=>restarted.run(f.selector)),/already/);await assert.rejects(agent(()=>restarted.register(f.selector)));assert.equal(f.count(),1);
});
