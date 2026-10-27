import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildMagazineFixture,treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration,INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
import {withActor} from '../runtime/services/actor.mjs';
const DEV='Workflow/3-Develop/DEV - Clay Teacher (story).md';
const FEEDBACK='Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
const OTHER='Workflow/6-Feedback/FEEDBACK - River Potter.md';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn);
const agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);
function setup(t,{writable=true}={}){
 const f=buildMagazineFixture({extra:{[FEEDBACK]:'---\ntype: FEEDBACK\nstory: Clay Teacher\n---\n\n## Chinese\n\n你好，朋友。\n\n## English\n\nHello, friend.\n',[OTHER]:'# Other invitation\n'}});t.after(f.cleanup);
 const plan=planRegistration({vault:f.vault,files:f.files});fs.mkdirSync(path.join(f.data,'magazine/projects'),{recursive:true});fs.writeFileSync(path.join(f.data,'magazine/index.json'),JSON.stringify({schema:INDEX_SCHEMA,vaultRoot:f.vault,filesRoot:f.files,stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));for(const p of plan.stories)fs.writeFileSync(path.join(f.data,'magazine/projects',p.storyId+'.json'),JSON.stringify(p));
 const owner=()=>createMagazineVault({vaultRoot:f.vault,filesRoot:f.files,dataDir:f.data,writable,machine:'invented-feedback-write'});const magazine=owner();
 const input=()=>({storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',expectedHash:magazine.read({path:DEV}).hash,registeredFeedbackPath:FEEDBACK,expectedFeedbackHash:magazine.read({path:FEEDBACK}).hash});
 return {f,magazine,owner,input,bridge:createWorkingDraftBridge({magazine}),read:()=>fs.readFileSync(path.join(f.vault,FEEDBACK),'utf8')};
}
test('canonical FEEDBACK prepares without writes, saves through the maintained owner, restarts and exactly undoes',async t=>{
 const s=setup(t),before=treeHashes(s.f.vault),initial=s.read(),selection=s.input(),content=initial+'\nA warm invented memory.\n';
 const prepared=await human(()=>s.bridge.prepareShareFeedback({...selection,content}));assert.equal(prepared.content,content);assert.equal(prepared.mapping.structured,false);assert.deepEqual(treeHashes(s.f.vault),before);
 const saved=await human(()=>s.bridge.saveShareFeedback({...selection,content,operationId:randomUUID()}));assert.equal(saved.written,true);assert.equal(s.read(),content);
 const restarted=createWorkingDraftBridge({magazine:s.owner()}),current=s.input();assert.equal((await restarted.readShareFeedback(current)).document.text,content);
 assert.equal((await human(()=>restarted.eligibleUndoShareFeedback({...current,operationId:saved.operationId}))).eligible,true);
 await human(()=>restarted.undoShareFeedback({...current,operationId:randomUUID(),undoOperationId:saved.operationId}));assert.equal(s.read(),initial);assert.deepEqual(treeHashes(s.f.vault),before);
});
test('lost human save/Undo responses recover the same contextual receipts across recreated owners',async t=>{
 const s=setup(t),input={...s.input(),content:s.read()+'\nSaved once.\n',operationId:randomUUID()};await human(()=>s.bridge.saveShareFeedback(input));
 const reopened=createWorkingDraftBridge({magazine:s.owner()}),before=treeHashes(s.f.vault);
 assert.equal((await human(()=>reopened.saveShareFeedback(input))).replay,true);assert.deepEqual(treeHashes(s.f.vault),before);
 await assert.rejects(human(()=>reopened.saveShareFeedback({...input,content:'Changed retry.'})),e=>e.status===409);
 await assert.rejects(agent(()=>reopened.saveShareFeedback(input)),e=>e.status===403);
 const undo={...s.input(),undoOperationId:input.operationId,operationId:randomUUID()};await human(()=>reopened.undoShareFeedback(undo));
 const restored=treeHashes(s.f.vault);assert.equal((await human(()=>createWorkingDraftBridge({magazine:s.owner()}).undoShareFeedback(undo))).replay,true);assert.deepEqual(treeHashes(s.f.vault),restored);
});
test('agents only create existing owner prose proposals, never write/accept/undo FEEDBACK',async t=>{
 const s=setup(t),before=treeHashes(s.f.vault),input={...s.input(),content:s.read()+'\nProposed memory.\n',operationId:randomUUID()};
 const proposal=await agent(()=>s.bridge.saveShareFeedback(input));assert.equal(proposal.proposed,true);assert.deepEqual(treeHashes(s.f.vault),before);
 assert.equal((await agent(()=>s.bridge.saveShareFeedback(input))).replay,true);
 await assert.rejects(agent(()=>s.magazine.proposalAccept({proposalId:proposal.proposalId,operationId:randomUUID()})),e=>e.status===403);
 assert.equal((await agent(()=>s.bridge.eligibleUndoShareFeedback({...s.input(),operationId:proposal.operationId}))).eligible,false);
 await assert.rejects(agent(()=>s.bridge.undoShareFeedback({...s.input(),undoOperationId:proposal.operationId,operationId:randomUUID()})),e=>e.status===403);
 assert.deepEqual(treeHashes(s.f.vault),before);
});
test('separate DEV and FEEDBACK drift refuse stale saves without rewriting either record',async t=>{
 for(const changed of [DEV,FEEDBACK]){
  const s=setup(t),selection=s.input();fs.appendFileSync(path.join(s.f.vault,changed),'\nExternal new words.\n');const before=treeHashes(s.f.vault);
  await assert.rejects(human(()=>s.bridge.saveShareFeedback({...selection,content:'Must not overwrite.',operationId:randomUUID()})),e=>e.status===409);assert.deepEqual(treeHashes(s.f.vault),before);
  // Explicitly rereading both independent hashes permits a deliberate full-file edit.
  await human(()=>s.bridge.saveShareFeedback({...s.input(),content:s.read()+'\nDeliberate later edit.\n',operationId:randomUUID()}));
 }
});
test('newer feedback and sync conflicts block exact Undo and preserve every current byte',async t=>{
 for(const conflict of [false,true]){
  const s=setup(t),saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:s.read()+'\nFirst edit.\n',operationId:randomUUID()}));
  if(conflict)fs.writeFileSync(path.join(s.f.vault,FEEDBACK.replace(/\.md$/,'.sync-conflict-20261027-test.md')),'Conflicting invitation.');else fs.appendFileSync(path.join(s.f.vault,FEEDBACK),'\nNewer edit.\n');
  const before=treeHashes(s.f.vault),input={...s.input(),operationId:randomUUID(),undoOperationId:saved.operationId};
  await assert.rejects(human(()=>s.bridge.undoShareFeedback(input)),e=>e.status===409);assert.deepEqual(treeHashes(s.f.vault),before);
 }
});
test('foreign selectors, ordinary unscoped receipts, anonymous and readonly writes refuse',async t=>{
 const s=setup(t),other=await human(()=>s.magazine.write({path:OTHER,content:'Another saved message.\n',expectedHash:s.magazine.read({path:OTHER}).hash,operationId:randomUUID()}));
 await assert.rejects(human(()=>s.bridge.undoShareFeedback({...s.input(),undoOperationId:other.operationId,operationId:randomUUID()})),e=>e.status===403);
 const unscoped=await human(()=>s.magazine.write({path:FEEDBACK,content:s.read()+'\nDirect legacy edit.\n',expectedHash:s.input().expectedFeedbackHash,operationId:randomUUID()}));
 await assert.rejects(human(()=>s.bridge.undoShareFeedback({...s.input(),undoOperationId:unscoped.operationId,operationId:randomUUID()})),e=>e.status===403);
 for(const change of [{registeredFeedbackPath:OTHER},{registeredFeedbackPath:'../outside.md'},{actor:'human:adrian'},{context:{}},{expectedFeedbackHash:null},{expectedHash:null},{edition:'published',editionId:'recorded'}])await assert.rejects(human(()=>s.bridge.saveShareFeedback({...s.input(),content:'x',operationId:randomUUID(),...change})));
 await assert.rejects(s.bridge.saveShareFeedback({...s.input(),content:'x',operationId:randomUUID()}),e=>e.status===400);
 const readonly=setup(t,{writable:false});await assert.rejects(human(()=>readonly.bridge.saveShareFeedback({...readonly.input(),content:'x',operationId:randomUUID()})),e=>e.status===503);
});
test('under-lock guard catches maintained DEV changes queued ahead of a FEEDBACK save',async t=>{
 const s=setup(t),selection=s.input(),initial=s.read();let enter,release;
 const entered=new Promise(resolve=>enter=resolve),gate=new Promise(resolve=>release=resolve);
 const held=s.magazine._roots().lock.transaction({actor:'human:adrian',operation:randomUUID()},async()=>{enter();await gate;fs.appendFileSync(path.join(s.f.vault,DEV),'\nQueued maintained revision.\n');});
 await entered;const saving=human(()=>s.bridge.saveShareFeedback({...selection,content:initial+'\nShould not save.\n',operationId:randomUUID()}));
 release();await held;await assert.rejects(saving,e=>e.status===409&&/DEV changed/.test(e.message));assert.equal(s.read(),initial);
});
test('legacy fullfile edits and stale metadata remain canonical editable Markdown, never an inferred recipient',async t=>{
 const s=setup(t),content=s.read().replace('type: FEEDBACK','type: FEEDBACK\nar-create-share: invalid metadata');
 const preparation=await human(()=>s.bridge.prepareShareFeedback({...s.input(),content}));assert.equal(preparation.mapping.structured,false);assert.deepEqual(preparation.mapping.projection,[]);
 await human(()=>s.bridge.saveShareFeedback({...s.input(),content,operationId:randomUUID()}));assert.equal(s.read(),content);assert.equal((await s.bridge.readShareFeedback(s.input())).mapping.structured,false);
});
test('unchanged legacy prose still binds replay to the original DEV revision instead of silently reusing context',async t=>{
 const s=setup(t),input={...s.input(),content:s.read(),operationId:randomUUID()};await human(()=>s.bridge.saveShareFeedback(input));
 fs.appendFileSync(path.join(s.f.vault,DEV),'\nLater piece revision.\n');const before=treeHashes(s.f.vault);
 await assert.rejects(human(()=>s.bridge.saveShareFeedback({...s.input(),content:input.content,operationId:input.operationId})),e=>e.status===409);
 // Exact original replay recovers a receipt, not a rebase to the newer DEV.
 assert.equal((await human(()=>s.bridge.saveShareFeedback(input))).replay,true);assert.deepEqual(treeHashes(s.f.vault),before);
 const receipt=s.magazine.operation({operationId:input.operationId});assert.equal(receipt.context.draft.hash,input.expectedHash);assert.notEqual(receipt.context.draft.hash,s.input().expectedHash);
});
test('reload discovers eligible contextual Undo through the same durable receipts without a browser receipt ID',async t=>{
 const s=setup(t),saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:s.read()+'\nReloadable save.\n',operationId:randomUUID()}));
 const restarted=createWorkingDraftBridge({magazine:s.owner()}),history=await restarted.shareFeedbackHistory(s.input());
 assert.equal(history.history.length,1);assert.equal(history.history[0].operationId,saved.operationId);assert.equal(history.history[0].canUndo,true);assert.equal(history.history[0].actor,'human:adrian');
 assert.equal((await agent(()=>restarted.shareFeedbackHistory(s.input()))).history.length,0);
 await human(()=>restarted.undoShareFeedback({...s.input(),undoOperationId:history.history[0].operationId,operationId:randomUUID()}));assert.equal((await restarted.shareFeedbackHistory(s.input())).history[0].canUndo,false);
});
test('receipt history excludes generic writes and contextual saves from stale DEV or foreign piece/root/actor',async t=>{
 const s=setup(t),saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:s.read()+'\nOwned save.\n',operationId:randomUUID()}));
 const original=s.magazine.operation({operationId:saved.operationId});
 for(const change of [r=>r.context.rootIdentity.fingerprint='b'.repeat(64),r=>r.context.selection.pieceId='other',r=>r.context.selection.storyId='other',r=>r.context.draft.hash='b'.repeat(64),r=>r.actor='agent:codex',r=>delete r.context]){
  const record=structuredClone(original);record.operationId=randomUUID();change(record);fs.writeFileSync(path.join(s.magazine._dirs.operations,record.operationId+'.json'),JSON.stringify(record));
 }
 const history=await createWorkingDraftBridge({magazine:s.owner()}).shareFeedbackHistory(s.input());assert.deepEqual(history.history.map(row=>row.operationId),[saved.operationId]);
 fs.appendFileSync(path.join(s.f.vault,DEV),'\nNew manuscript revision.\n');assert.deepEqual((await s.bridge.shareFeedbackHistory(s.input())).history,[]);
});
test('Undo rechecks DEV and registration under the sole owner lock before restoring any bytes',async t=>{
 for(const changed of ['draft','registration']){
  const s=setup(t),saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:s.read()+'\nSaved invitation.\n',operationId:randomUUID()})),input={...s.input(),undoOperationId:saved.operationId,operationId:randomUUID()};let entered,release;
  const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
  const holding=s.magazine._roots().lock.transaction({actor:'human:adrian',operation:randomUUID()},async()=>{entered();await gate;if(changed==='draft')fs.appendFileSync(path.join(s.f.vault,DEV),'\nRevision queued before Undo.\n');else{const file=path.join(s.f.data,'magazine/projects/mag-clay-teacher.json'),project=JSON.parse(fs.readFileSync(file));project.flags.push('Registration changed while Undo queued');fs.writeFileSync(file,JSON.stringify(project));}});
  await ready;const undoing=human(()=>s.bridge.undoShareFeedback(input));await new Promise(resolve=>setImmediate(resolve));const expected=s.read();release();await holding;
  await assert.rejects(undoing,e=>e.status===409);assert.equal(s.read(),expected);assert.equal(s.magazine.operation({operationId:saved.operationId}).undoneBy,undefined);
 }
});
test('contextual Undo replay refuses a new DEV context even when invitation bytes were unchanged',async t=>{
 const s=setup(t),saved=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:s.read(),operationId:randomUUID()})),input={...s.input(),undoOperationId:saved.operationId,operationId:randomUUID()};await human(()=>s.bridge.undoShareFeedback(input));
 const receipt=s.magazine.operation({operationId:input.operationId});assert.equal(receipt.context.draft.hash,input.expectedHash);
 fs.appendFileSync(path.join(s.f.vault,DEV),'\nNew DEV context.\n');await assert.rejects(human(()=>s.bridge.undoShareFeedback({...input,expectedHash:s.input().expectedHash})),e=>e.status===403||e.status===409);
});

test('working invitations and actual facts use contextual writer, survive owner restart and exact Undo; alternate paths cannot forge or rewrite them',async t=>{
 const {feedbackShareSectionChoices,parseFeedbackShare,changeFeedbackInvitation}=await import('../runtime/services/magazine/feedback-share-codec.mjs'),s=setup(t),initialVault=treeHashes(s.f.vault),recipientId=randomUUID(),invitationId=randomUUID();
 const mapping=await human(()=>s.bridge.prepareShareFeedbackMapping({...s.input(),recipientId,recipientName:'Invented Reviewer',sections:feedbackShareSectionChoices(s.read()).map((x,i)=>({language:i?'en':'zh',heading:x.heading,hash:x.hash}))}));await human(()=>s.bridge.saveShareFeedback({...s.input(),content:mapping.content,operationId:randomUUID()}));const mapped=s.read();
 const prepare=change=>human(()=>s.bridge.prepareShareFeedbackMapping({...s.input(),invitationChange:change})),made=await prepare({kind:'new',id:invitationId,recipientId});
 await assert.rejects(agent(()=>s.bridge.prepareShareFeedbackMapping({...s.input(),invitationChange:{kind:'new',id:randomUUID(),recipientId}})),e=>e.status===403);
 await assert.rejects(agent(()=>s.bridge.saveShareFeedback({...s.input(),content:made.content,operationId:randomUUID()})),e=>e.status===403);
 await assert.rejects(human(()=>s.magazine.write({path:FEEDBACK,expectedHash:s.input().expectedFeedbackHash,content:made.content,operationId:randomUUID()})),/contextual/);
 const creation=await human(()=>s.bridge.saveShareFeedback({...s.input(),content:made.content,operationId:randomUUID()}));assert.notEqual(s.read(),mapped);let current=parseFeedbackShare(s.read()),snapshot=structuredClone(current.metadata.invitations[0]);assert.equal(snapshot.target.hash,s.input().expectedHash);
 const fact={id:randomUUID(),kind:'sent',recordedBy:'human',sentAt:'2026-10-28',channel:'WeChat'},prepared=await prepare({kind:'fact',invitationId,fact});const stale=s.input(),sent=await human(()=>s.bridge.saveShareFeedback({...stale,content:prepared.content,operationId:randomUUID()}));
 await assert.rejects(human(()=>s.bridge.saveShareFeedback({...stale,content:prepared.content,operationId:randomUUID()})),e=>e.status===409);
 const restarted=createWorkingDraftBridge({magazine:s.owner()}),view=await restarted.readShareFeedback(s.input());assert.equal(view.mapping.publishedReadiness.available,false);assert.deepEqual(view.mapping.invitations[0].facts,[fact]);assert.equal(view.mapping.invitations[0].workingChanged,false);
 for(const text of [s.read().replace('WeChat','Email'),mapped]){await assert.rejects(human(()=>s.bridge.saveShareFeedback({...s.input(),content:text,operationId:randomUUID()})),/rewritten|removed|cannot/);await assert.rejects(agent(()=>s.magazine.write({path:FEEDBACK,expectedHash:s.input().expectedFeedbackHash,content:text,operationId:randomUUID()})),e=>e.status===403);}
 await human(()=>restarted.undoShareFeedback({...s.input(),undoOperationId:sent.operationId,operationId:randomUUID()}));assert.deepEqual(parseFeedbackShare(s.read()).metadata.invitations[0],snapshot);
 // A later current article never rewrites old invitation targets or their facts.
 fs.appendFileSync(path.join(s.f.vault,DEV),'\nInvented later working words.\n');const later=await s.bridge.readShareFeedback(s.input());assert.equal(later.mapping.invitations[0].workingChanged,true);assert.deepEqual(parseFeedbackShare(s.read()).metadata.invitations[0],snapshot);
 const reply={id:randomUUID(),kind:'reply',recordedBy:'human',receivedAt:null,original:'Thank you. Please review the caption.',translation:null,correction:{text:'Please review caption.',affected:{storyId:s.input().storyId,pieceId:s.input().pieceId,edition:'working',hash:s.input().expectedHash}}};const replied=await prepare({kind:'fact',invitationId,fact:reply});await human(()=>s.bridge.saveShareFeedback({...s.input(),content:replied.content,operationId:randomUUID()}));assert.deepEqual(parseFeedbackShare(s.read()).metadata.invitations[0].target,snapshot.target);
 await assert.rejects(prepare({kind:'new',id:randomUUID(),recipientId,target:{edition:'published',hash:'a'.repeat(64)}}));
 const after=treeHashes(s.f.vault);assert.deepEqual(Object.keys(after).filter(k=>after[k]!==initialVault[k]).sort(),[DEV,FEEDBACK].sort());assert.equal((await s.bridge.readShareFeedback(s.input())).mapping.invitations[0].facts[0].kind,'reply');
});
