import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID,createHash} from 'node:crypto';
import {createStore} from '../store.mjs';import {createStudyBindings} from './study-bindings.mjs';import {createStudyDraftCopies} from './study-draft-copies.mjs';import {createStudyOriginals} from './study-originals.mjs';import {createStudyOwnedPhotoBindings} from './study-owned-photo-bindings.mjs';import {createStudyHumanDirection} from './study-human-direction.mjs';import {createLibrary} from './library.mjs';import {digest} from './files.mjs';import {createNativeOutputFactory} from './native-output-factory.mjs';
const DEV='Workflow/3-Develop/DEV - Invented part.md',SRC='Workflow/1-Source/SRC - Invented source.md';
async function fixture(t,{withPhoto=false,publicationFault}={}){const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'native-output-factory-'))),vault=path.join(dataDir,'synthetic-original-vault'),files=path.join(dataDir,'synthetic-original-files');fs.mkdirSync(vault);fs.mkdirSync(files);const put=(rel,body)=>{const file=path.join(vault,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};put(DEV,'---\ntype: DEV\ntitle: Synthetic owner test\n---\n\n'+(withPhoto?'%%photo: cover.jpg · Cover%%\n\n':'')+'Original native words.\n');put(SRC,'Exact synthetic original source.');const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{'synthetic-parent':{title:'Invented source',docs:[[SRC,'source']],relatedProjects:[]}},drafts:{'synthetic-draft':{parentStudyKey:'synthetic-parent',partKey:'1',title:'Synthetic owner test',path:DEV,contextScope:'Invented fixture only.',support:[[SRC,'source']]}}}}),store=await createStore({dataDir,sharedArticles:true,publicationFault});t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});const native=createStudyDraftCopies({dataDir,originals}),root=await native.openCopy({originalId:'synthetic-draft',originalHash:digest(fs.readFileSync(path.join(vault,DEV))),parentStudyId:'synthetic-parent',operationId:randomUUID()}),bindings=createStudyBindings({dataDir,store});await bindings.select({projectKey:'synthetic-parent',title:'Synthetic parent',operationId:randomUUID()});const ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings}),physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'synthetic-parent',operationId:randomUUID()}),direction=createStudyHumanDirection({dataDir,store,drafts:native,bindings}),library=createLibrary({dataDir,legacyState:()=>({project:{sources:[]}})}),factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos}),group={rootBindingId:root.binding.id,parentStudyId:'synthetic-parent'},create=async()=>factory.owner.create({...group,kind:'article',sourceBindingId:root.binding.id,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:'synthetic-parent'})).expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()});return {dataDir,vault,files,store,native,root,originals,ownedPhotos,direction,library,factory,group,physical,create,put};}

import {createNativeOutputOwner} from './native-output-owner.mjs';
import {mapper,helpers} from './native-output-helpers.mjs';
import {createNativeOutputExports} from './native-output-exports.mjs';
import {withActor} from './actor.mjs';
const agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);
async function copied(t,options){
 const f=await fixture(t,options),sourceBefore=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId});
 const root=await agent(()=>f.native.cloneStructureTest({sourceBindingId:f.root.binding.id,sourceParentStudyId:f.group.parentStudyId,expected:sourceBefore.expected,title:'Synthetic stand-in',operationId:randomUUID()}));
 const parentStudyId=root.binding.parentStudyId,group={rootBindingId:root.binding.id,parentStudyId};
 const bindings=createStudyBindings({dataDir:f.dataDir,store:f.store});await bindings.select({projectKey:parentStudyId,title:'Synthetic stand-in',operationId:randomUUID()});
 await f.ownedPhotos.select({bindingId:root.binding.id,parentStudyId,operationId:randomUUID()});
 let enabled=true,changed=false,checks=0,race=false;const fingerprint=createHash('sha256').update(root.binding.id+parentStudyId).digest('hex');
 const guard=async(input,{rootSnapshot}={})=>{checks++;if(race&&checks%2===0)changed=true;const current=rootSnapshot||await f.native.read({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId});return {canStandInReview:enabled&&current.binding.origin==='structure-test'&&current.binding.id===root.binding.id,fingerprint:changed?'a'.repeat(64):fingerprint};};
 const owner=()=>createNativeOutputOwner({dataDir:f.dataDir,store:f.store,native:f.native,mapper,helpers,scope:f.factory.scope,proof:f.factory.proof,validateStandInReview:guard});let service=owner();
 const create=async()=>service.create({...group,kind:'carousel',sourceBindingId:root.binding.id,expectedNative:root.expected,expectedOutput:(await service.read(group)).expectedOutput,operationId:randomUUID()});
 const view=id=>service.read({...group,selectedOutputId:id});
 const request=v=>({...group,selectedOutputId:v.output.id,expectedOutput:v.expectedOutput,expectedWords:v.writingProof.expected,wordsHash:v.writingProof.wordsHash,operationId:randomUUID()});
 return {...f,root,group,sourceBefore,create,view,request,get service(){return service;},restart(){service=owner();},disable(){enabled=false;},change(){changed=true;},race(){race=true;checks=0;},get checks(){return checks;}};
}
test('copy Carousel stand-in reviews exact own words, persists truthful provenance and replays after owner restart',async t=>{
 const f=await copied(t),first=await f.create(),second=await f.create(),sibling=second.view.output,v=await f.view(first.view.output.id),input=f.request(v);
 await assert.rejects(f.service.assertExport({...f.group,selectedOutputId:v.output.id,expectedOutput:v.expectedOutput}),/own saved words/);
 await assert.rejects(agent(()=>f.service.reviewCarouselWords(input)),/human-only/);
 const saved=await agent(()=>f.service.standInReviewCarouselWords(input)),receipt=saved.view.wordsReviewDecision;
 assert.equal(saved.view.output.stage,'look');assert.equal(receipt.schema,'ar-create.carousel-words-stand-in-review.v1');assert.equal(receipt.decisionRole,'stand-in');assert.equal(receipt.actor,'agent:codex');assert.equal(receipt.client,'cli');assert.equal(receipt.operationId,input.operationId);assert.equal(receipt.review.hash,saved.view.writingProof.wordsHash);assert.equal(receipt.humanDecision,undefined);assert.deepEqual(receipt.scope,{...f.group,outputId:v.output.id});
 f.restart();const replay=await agent(()=>f.service.standInReviewCarouselWords(input));assert.equal(replay.alreadySaved,true);assert.deepEqual(replay.view.wordsReviewDecision,receipt);assert.deepEqual((await f.view(sibling.id)).output,sibling);
 const source=await f.native.read({bindingId:f.sourceBefore.binding.id,parentStudyId:f.sourceBefore.binding.parentStudyId});assert.equal(source.raw,f.sourceBefore.raw);assert.deepEqual(source.expected,f.sourceBefore.expected);
 await f.service.assertExport({...f.group,selectedOutputId:v.output.id,expectedOutput:saved.view.expectedOutput});
 const exports=createNativeOutputExports({dataDir:f.dataDir,store:f.store,outputs:f.service,resolveScope:input=>f.factory.scope.resolve(input),library:f.library,carousel:{save:async(input,origin,trusted)=>{await trusted.finalCheck();return trusted.publicationBinding;}}});
 const binding=await exports.saveCarousel({...f.group,selectedOutputId:v.output.id,expectedOutput:saved.view.expectedOutput,outputRevision:saved.view.output.outputRevision},'http://127.0.0.1:5500');assert.deepEqual(binding.wordsReviewDecision,receipt);
 f.disable();await assert.rejects(agent(()=>f.service.standInReviewCarouselWords(input)),/registered structure-test/);
});
test('stand-in refuses foreign scopes, stale own words, changed root authority, unregistered actors and forged fields',async t=>{
 const f=await copied(t),c=await f.create(),v=await f.view(c.view.output.id),input=f.request(v);
 await assert.rejects(()=>f.service.standInReviewCarouselWords(input),/explicit registered agent/);
 await assert.rejects(withActor.bind(null,{actor:'human:adrian',client:'ui'},()=>f.service.standInReviewCarouselWords(input)),/explicit registered agent/);
 await assert.rejects(agent(()=>f.service.standInReviewCarouselWords({...input,humanDecision:true})),/Unsupported/);
 await assert.rejects(agent(()=>f.service.standInReviewCarouselWords({...input,rootBindingId:f.sourceBefore.binding.id,parentStudyId:f.sourceBefore.binding.parentStudyId})),/registered structure-test/);
 const slides=structuredClone(v.output.slides);slides[0].text+=' Own changed wording.';
 const edited=await f.service.save({...f.group,selectedOutputId:v.output.id,expectedOutput:v.expectedOutput,operationId:randomUUID(),changes:{slides,caption:'Copy caption'}});
 await assert.rejects(agent(()=>f.service.standInReviewCarouselWords({...input,operationId:randomUUID(),expectedOutput:edited.view.expectedOutput})),/changed since human review/);
 const current=f.request(edited.view);await agent(()=>f.service.standInReviewCarouselWords(current));f.change();await assert.rejects(agent(()=>f.service.standInReviewCarouselWords(current)),/another exact output request/);
});

test('copy authority and captured evidence are rechecked before publication; word edits clear the public decision',async t=>{
 const f=await copied(t),c=await f.create(),v=await f.view(c.view.output.id);f.race();
 await assert.rejects(agent(()=>f.service.standInReviewCarouselWords(f.request(v))),/ownership changed/);
 assert.equal((await f.view(v.output.id)).output.wordsReview,undefined);
 const g=await copied(t),d=await g.create(),before=await g.view(d.view.output.id),read=g.factory.proof.read;
 g.factory.proof.read=async input=>{const p=await read(input);return {...p,sources:p.sources.map(row=>({...row,hash:'b'.repeat(64)}))};};
 await assert.rejects(agent(()=>g.service.standInReviewCarouselWords(g.request(before))),/source|proof/i);
 g.factory.proof.read=read;const saved=await agent(()=>g.service.standInReviewCarouselWords(g.request(before))),slides=structuredClone(saved.view.output.slides);slides[0].text+=' Further own words.';
 const changed=await g.service.save({...g.group,selectedOutputId:before.output.id,expectedOutput:saved.view.expectedOutput,operationId:randomUUID(),changes:{slides}});
 assert.equal(changed.view.wordsReviewDecision,null);assert.equal(changed.view.output.wordsReview,undefined);
});

test('lost completed stand-in review reply resumes from the same durable journal without another decision',async t=>{
 let armed=false;const f=await copied(t,{publicationFault:point=>{if(armed&&point==='after-complete'){armed=false;throw Error('lost stand-in reply');}}}),c=await f.create(),v=await f.view(c.view.output.id),input=f.request(v);armed=true;
 await assert.rejects(agent(()=>f.service.standInReviewCarouselWords(input)),/lost stand-in reply/);f.restart();
 const replay=await agent(()=>f.service.standInReviewCarouselWords(input));assert.equal(replay.alreadySaved,true);assert.equal(replay.view.wordsReviewDecision.operationId,input.operationId);assert.equal(replay.view.wordsReviewDecision.actor,'agent:codex');
});

test('copy-only stand-in save preserves word review semantics and remains exact across replay',async t=>{const f=await copied(t),created=await f.create(),v=await agent(()=>f.view(created.view.output.id));assert.equal(v.standInOutputEditing,true);const input={...f.group,selectedOutputId:v.output.id,operationId:randomUUID(),expectedOutput:v.expectedOutput,changes:{caption:'Synthetic stand-in caption'}};const saved=await agent(()=>f.service.standInSave(input));assert.equal(saved.view.output.caption,input.changes.caption);assert.equal(saved.view.output.wordsReview,undefined);assert.equal(saved.view.wordsReviewDecision,null);f.restart();const replay=await agent(()=>f.service.standInSave(input));assert.equal(replay.alreadySaved,true);assert.equal(replay.view.output.caption,input.changes.caption);assert.equal((await f.native.read({bindingId:f.sourceBefore.binding.id,parentStudyId:f.sourceBefore.binding.parentStudyId})).raw,f.sourceBefore.raw);f.disable();await assert.rejects(agent(()=>f.service.standInSave({...input,operationId:randomUUID(),expectedOutput:saved.view.expectedOutput})),/registered structure-test/);});

test('stand-in native creation reopens its persisted exact operation after owner restart without another output',async t=>{
 const f=await copied(t),view=await agent(()=>f.service.read(f.group)),source=await f.native.read({bindingId:f.root.binding.id,parentStudyId:f.group.parentStudyId}),input={...f.group,operationId:randomUUID(),expectedOutput:view.expectedOutput,kind:'article',sourceBindingId:f.root.binding.id,expectedNative:source.expected};const created=await agent(()=>f.service.standInCreate(input));assert.equal(created.view.output.id,input.operationId);assert.equal(created.view.standInOutputCreation,true);f.restart();const replay=await agent(()=>f.service.standInCreate(input));assert.equal(replay.alreadySaved,true);assert.equal(replay.view.outputs.length,1);assert.equal(replay.view.output.id,input.operationId);assert.equal((await f.native.read({bindingId:f.sourceBefore.binding.id,parentStudyId:f.sourceBefore.binding.parentStudyId})).raw,f.sourceBefore.raw);
});
