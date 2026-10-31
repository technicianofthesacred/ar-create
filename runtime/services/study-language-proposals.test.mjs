import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanguageProposals} from './study-language-proposals.mjs';
import {createArtifactExecution} from './artifact-execution.mjs';
import {withActor} from './actor.mjs';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),agent=fn=>withActor({actor:'agent:codex',client:'http'},fn);
function fixture(t,{execute,apply,allow=false}={}){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'language-proposal-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 let source={scope:{kind:'audience-article',bindingId:randomUUID(),parentStudyId:'invented',outputId:randomUUID()},proof:{revision:1,hash:'invented-proof'},units:[{id:'p1',text:'I remember An Cha.',pointer:{paragraphId:'p1',blockHash:'exact-block'},role:'author-words'}]},saves=0,calls=0;
 const execution=createArtifactExecution({available:()=>true,execute:execute||(async()=>{calls++;return {response:{artifacts:{'translation.json':JSON.stringify({translations:[{id:'p1',text:'我记得 An Cha。',uncertainty:[]}]})}}};})});
 const options={dataDir,execution,readSource:async()=>structuredClone(source),applyReviewedTranslation:apply||(async packet=>{saves++;return {outputId:packet.operationId,language:'zh-Hans'};}),validateStandInTarget:async()=>{if(!allow)throw Object.assign(Error('Not a registered copy'),{status:403});return {fingerprint:'registered-copy'};}};
 let service=createLanguageProposals(options);
 return {get service(){return service},restart({interrupted=false}={}){service=createLanguageProposals({...options,...(interrupted?{execution:createArtifactExecution({available:()=>true})}:{})});},get source(){return source},get saves(){return saves},get calls(){return calls},execution,prepare:()=>service.prepare({scope:source.scope,targetLanguage:'zh-Hans',retainedTerms:['An Cha']}),async ready(){const r=await this.prepare();await service.run({requestId:r.id});await execution.wait(r.id);return service.review({requestId:r.id});}};
}
test('captured source and exact retained terms produce reviewable units; run never writes words; human accept is durable and replayable',async t=>{
 const f=fixture(t),r=await f.ready();assert.equal(r.status,'pending');assert.equal(f.saves,0);assert.equal(r.proposal.units[0].source.text,'I remember An Cha.');assert.equal(r.proposal.units[0].source.pointer.paragraphId,'p1');assert.equal(r.proposal.units[0].source.hash.length,64);assert.equal(r.proposal.units[0].role,'translation-not-new-facts');
 const operationId=randomUUID(),accepted=await human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId}));assert.equal(accepted.status,'accepted');assert.equal(f.saves,1);f.restart();assert.equal((await human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId}))).status,'accepted');assert.equal(f.saves,1);await assert.rejects(human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId:randomUUID()})),/decision/);
});
test('source revision, text, pointer or scope changes refuse run and acceptance without writes',async t=>{
 for(const change of [s=>s.proof.revision++,s=>s.units[0].text+=' Changed.',s=>s.units[0].pointer.blockHash='changed',s=>s.scope.parentStudyId='foreign']){const f=fixture(t),r=await f.ready();change(f.source);assert.equal((await f.service.review({requestId:r.id})).stale,true);await assert.rejects(human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId:randomUUID()})),/source changed/);assert.equal(f.saves,0);}
 const f=fixture(t),r=await f.prepare();f.source.proof.revision++;await assert.rejects(f.service.run({requestId:r.id}),/source changed/);assert.equal(f.calls,0);
});
test('invalid, incomplete, duplicated, invented units and removed protected words fail closed',async t=>{
 for(const translations of [[],[{id:'other',text:'虚构',uncertainty:[]}],[{id:'p1',text:'茶',uncertainty:[]}],[{id:'p1',text:'An Cha',uncertainty:[],extra:true}],[{id:'p1',text:'An Cha',uncertainty:[]},{id:'p1',text:'An Cha',uncertainty:[]}]]){const f=fixture(t,{execute:async()=>({response:{artifacts:{'translation.json':JSON.stringify({translations})}}})}),r=await f.ready();assert.equal(r.status,'needs-attention');assert.equal(f.saves,0);await assert.rejects(human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId:randomUUID()})));}
});
test('uncertainty remains visible and blocks acceptance; reject never writes words',async t=>{
 const f=fixture(t,{execute:async()=>({response:{artifacts:{'translation.json':JSON.stringify({translations:[{id:'p1',text:'我记得 An Cha。',uncertainty:['Ambiguous source memory.']}]})}}})}),r=await f.ready();assert.equal(r.proposal.units[0].uncertainty.length,1);await assert.rejects(human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId:randomUUID()})),/uncertain/);assert.equal((await human(()=>f.service.reject({humanDecision:true,requestId:r.id,operationId:randomUUID()}))).status,'rejected');assert.equal(f.saves,0);
});
test('agent original approval refuses; registered copy stand-in retains actual actor and role',async t=>{
 const original=fixture(t),r=await original.ready();await assert.rejects(agent(()=>original.service.accept({requestId:r.id,operationId:randomUUID()})),e=>e.status===403);await assert.rejects(agent(()=>original.service.standInAccept({requestId:r.id,operationId:randomUUID()})),e=>e.status===403);assert.equal(original.saves,0);
 const copy=fixture(t,{allow:true}),p=await copy.ready(),saved=await agent(()=>copy.service.standInAccept({requestId:p.id,operationId:randomUUID()}));assert.equal(saved.decision.actor,'agent:codex');assert.equal(saved.decision.role,'stand-in');assert.equal(saved.decision.humanDecision,undefined);assert.equal(copy.saves,1);
});
test('restart interrupts pending run without resend, malformed artifact fails, supplied fields cannot impersonate a decision',async t=>{
 let finish;const f=fixture(t,{execute:()=>new Promise(resolve=>{finish=resolve})}),r=await f.prepare();await f.service.run({requestId:r.id});f.restart({interrupted:true});assert.equal((await f.service.review({requestId:r.id})).status,'needs-attention');await assert.rejects(f.service.run({requestId:r.id}),/attempt/);finish({response:{artifacts:{'translation.json':'{}'}}});await f.execution.wait(r.id);assert.equal(f.saves,0);await assert.rejects(human(()=>f.service.accept({humanDecision:true,requestId:r.id,operationId:randomUUID(),invented:true})),/fields/);
});
test('execution sends selected language units without private owner proof or unrelated native metadata',async t=>{
 let prompt;const f=fixture(t,{execute:async packet=>{prompt=packet.prompt;return {response:{artifacts:{'translation.json':JSON.stringify({translations:[{id:'p1',text:'我记得 An Cha。',uncertainty:[]}]})}}};}});f.source.proof.privateOwnerPath='DO-NOT-SEND-OWNER-PATH';await f.ready();assert.match(prompt,/I remember An Cha/);assert.doesNotMatch(prompt,/DO-NOT-SEND-OWNER-PATH/);assert.match(prompt,/sourceCaptureHash/);
});
