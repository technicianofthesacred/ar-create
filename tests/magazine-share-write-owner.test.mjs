import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {buildMagazineFixture,treeHashes} from './helpers/magazine-fixture.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {withActor} from '../runtime/services/actor.mjs';
const DEV='Workflow/3-Develop/DEV - Clay Teacher (story).md',FEEDBACK='Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);
function setup(t){const f=buildMagazineFixture({extra:{[FEEDBACK]:'# Invented invitation\n'}});t.after(f.cleanup);const magazine=createMagazineVault({vaultRoot:f.vault,filesRoot:f.files,dataDir:f.data,writable:true,machine:'invented-owner'});return {f,magazine,context:{schema:'ar-create.magazine-feedback-write-context.v1',rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:createHash('sha256').update(fs.realpathSync(f.vault)).digest('hex')},selection:{storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working'},draft:{path:DEV,hash:magazine.read({path:DEV}).hash},feedback:{path:FEEDBACK,hash:magazine.read({path:FEEDBACK}).hash,registeredHash:magazine.read({path:FEEDBACK}).hash}}};}
test('trusted context is part of the sole writer receipt and replay fingerprint',async t=>{
 const s=setup(t),input={path:FEEDBACK,content:'# New invitation\n',expectedHash:s.context.feedback.hash,operationId:randomUUID()};let guards=0;
 await human(()=>s.magazine.write(input,{context:s.context,assertCurrent:()=>{guards++;}}));
 assert.deepEqual(s.magazine.operation({operationId:input.operationId}).context,s.context);assert.equal(guards,1);
 assert.equal((await human(()=>s.magazine.write(input,{context:s.context,assertCurrent:()=>{guards++;}}))).replay,true);assert.equal(guards,1);
 for(const change of [c=>c.selection.storyId='mag-other',c=>c.selection.pieceId='other',c=>c.draft.hash='b'.repeat(64),c=>c.rootIdentity.fingerprint='b'.repeat(64)]){const context=structuredClone(s.context);change(context);await assert.rejects(human(()=>s.magazine.write(input,{context,assertCurrent:()=>{}})),e=>e.status===409);}
});
test('trusted guard runs inside the one lock immediately before proposal/put and cannot be asynchronous',async t=>{
 for(const proposing of [false,true]){
  const s=setup(t),before=treeHashes(s.f.vault),input={path:FEEDBACK,content:'Proposed or written new invitation.\n',expectedHash:s.context.feedback.hash,operationId:randomUUID()};
  await assert.rejects((proposing?agent:human)(()=>s.magazine.write(input,{context:s.context,assertCurrent:()=>{assert.equal(s.magazine.lockStatus().held,true);throw Object.assign(Error('Current guard refused'),{status:409});}})),e=>e.status===409);assert.deepEqual(treeHashes(s.f.vault),before);assert.equal(s.magazine.proposalList({status:'all'}).proposals.length,0);
  await assert.rejects(human(()=>s.magazine.write({...input,operationId:randomUUID()},{context:s.context,assertCurrent:()=>Promise.resolve()})),e=>e.status===400);assert.deepEqual(treeHashes(s.f.vault),before);
 }
});
test('HTTP-shaped body fields cannot grant trusted context and unsupported context fields refuse',async t=>{
 const s=setup(t),input={path:FEEDBACK,content:'No unauthorized options.\n',expectedHash:s.context.feedback.hash,operationId:randomUUID()};
 for(const extras of [{context:s.context},{assertCurrent:'caller override'}])await assert.rejects(human(()=>s.magazine.write({...input,...extras})),e=>e.status===400);
 for(const change of [c=>c.prose='Not metadata',c=>c.feedback.hash=null,c=>c.selection.edition='published',c=>c.draft.path='../private.md',c=>c.rootIdentity.fingerprint='invalid']){const context=structuredClone(s.context);change(context);await assert.rejects(human(()=>s.magazine.write({...input,operationId:randomUUID()},{context,assertCurrent:()=>{}})));}
});
test('ordinary write/proposal fingerprints and policy remain unchanged without trusted options',async t=>{
 const s=setup(t),input={path:FEEDBACK,content:'An agent proposes prose.\n',expectedHash:s.context.feedback.hash,operationId:randomUUID()},before=treeHashes(s.f.vault);
 const proposed=await agent(()=>s.magazine.write(input));assert.equal(proposed.proposed,true);assert.equal(s.magazine.operation({operationId:input.operationId}).context,undefined);assert.deepEqual(treeHashes(s.f.vault),before);
 assert.equal((await agent(()=>s.magazine.write(input))).replay,true);
 const saved=await human(()=>s.magazine.write({...input,content:'A human saves prose.\n',operationId:randomUUID()}));assert.equal(saved.written,true);
});
test('simultaneous contextual retries retain the same committed receipt under the one lock',async t=>{
 const s=setup(t),input={path:FEEDBACK,content:'Exactly once.\n',expectedHash:s.context.feedback.hash,operationId:randomUUID()};let entered,release;
 const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
 const holding=s.magazine._roots().lock.transaction({actor:'human:adrian',operation:randomUUID()},async()=>{entered();await gate;});await ready;
 const first=human(()=>s.magazine.write(input,{context:s.context,assertCurrent:()=>{}})),second=human(()=>s.magazine.write(input,{context:s.context,assertCurrent:()=>{throw Error('Committed replay must not reenter guard');}}));
 release();await holding;const [a,b]=await Promise.all([first,second]);assert.equal(a.written,true);assert.equal(b.replay,true);assert.equal(s.magazine.operation({operationId:input.operationId}).state,'committed');
});
test('feedback receipt projection stays bounded and never accepts a caller actor override',async t=>{
 const s=setup(t),input={path:FEEDBACK,content:'A saved invitation.\n',expectedHash:s.context.feedback.hash,operationId:randomUUID()};await human(()=>s.magazine.write(input,{context:s.context,assertCurrent:()=>{}}));
 const record=JSON.parse(fs.readFileSync(path.join(s.magazine._dirs.operations,input.operationId+'.json')));
 for(let i=0;i<204;i++){const clone={...record,operationId:randomUUID()};fs.writeFileSync(path.join(s.magazine._dirs.operations,clone.operationId+'.json'),JSON.stringify(clone));}
 assert.equal(s.magazine.feedbackOperations({context:s.context}).operationIds.length,200);assert.equal(s.magazine.feedbackOperations({context:s.context,limit:3}).operationIds.length,3);
 assert.throws(()=>s.magazine.feedbackOperations({context:s.context,limit:201}),e=>e.status===400);assert.throws(()=>s.magazine.feedbackOperations({context:s.context,actor:'human:adrian'}),e=>e.status===400);
});
