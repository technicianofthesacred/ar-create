import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {recoveryOwners} from './helpers/simmer-recovery-owners.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createStudyBindings} from '../runtime/services/study-bindings.mjs';
import {createStudyHumanDirection} from '../runtime/services/study-human-direction.mjs';
import {createCurrentUnderstandingResolver} from '../runtime/services/current-understanding.mjs';
import {conceptContextProjection} from '../runtime/services/concept-markdown.mjs';
import {createCurrentWork} from '../runtime/services/current-work.mjs';
import {createConversationCapture} from '../runtime/services/conversation-capture.mjs';
import {createNeedsYou} from '../runtime/services/needs-you.mjs';
import {createPresence} from '../runtime/services/presence.mjs';
import {withActor} from '../runtime/services/actor.mjs';

const agent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn);
async function fixture(t){
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config));
 t.after(()=>fs.rmSync(home.dir,{recursive:true,force:true}));
 const x=await recoveryOwners(config),{dataDir}=config;
 const originals=createStudyOriginals(config.studyOriginalRoots),drafts=createStudyDraftCopies({dataDir,originals}),bindings=createStudyBindings({dataDir,store:x.store});
 const direction=createStudyHumanDirection({dataDir,store:x.store,bindings,drafts,library:x.library});
 const understanding=createCurrentUnderstandingResolver({library:x.library,humanDirection:direction,conceptContextProjection});
 const captures=createConversationCapture({dataDir,...x}),needs=createNeedsYou({dataDir}),presence=createPresence();
 // These project-only checks have no piece proposals or continuity assignments.
 const reader=()=>createCurrentWork({...x,direction,understanding,captures,needs,presence,continuity:{read:async()=>({data:{assignments:[]}})}});
 const parentStudyId='invented-context-'+randomUUID(),project=await agent(()=>x.concepts.create({parentStudyId,title:'Invented context',operationId:randomUUID()}));
 return {...x,home,config,project,selector:{parentStudyId},reader};
}
function fileSnapshot(root){
 return Object.fromEntries(fs.readdirSync(root,{recursive:true}).filter(rel=>fs.statSync(path.join(root,rel)).isFile()).sort().map(rel=>[rel,fs.readFileSync(path.join(root,rel)).toString('base64')]));
}

test('saved board intention and links reach another client and invalidate prepared context',async t=>{
 const f=await fixture(t),subject=f.selector.parentStudyId,clientA=f.reader(),clientB=f.reader();
 const empty=await f.boards.read({subject});
 const blocks=['one','two'].map(id=>({id,kind:'mine',origin:'human',by:'human:adrian',text:'Invented '+id,wide:true}));
 let board=await human(()=>f.boards.save({subject,operationId:randomUUID(),expectedRevision:empty.revision,expectedHash:empty.hash,board:{...empty,groups:[{id:'g-invented',title:'Invented',blocks}]}}));
 const initial=await clientA.read({selector:f.selector});
 assert.equal(initial.readConsistency.status,'stable-reread');
 const sentence={...board.forming.sentence,about:'  Keep the crack.\nKeep these exact words.  ',reader:'A maker'};
 board=await human(()=>f.boards.save({subject,operationId:randomUUID(),expectedRevision:board.revision,expectedHash:board.hash,board:{...board,forming:{...board.forming,sentence}}}));
 const preparedText='Preparation from the earlier intention.  ';
 const held=await clientB.validate({selector:f.selector,expectedFingerprint:initial.fingerprint,preparedText});
 assert.equal(held.status,'held-context-changed');
 assert.equal(held.preparedText,preparedText);
 assert.equal(held.mayApply,false);
 assert.deepEqual(held.current.contributions.boardContext.forming,board.forming);
 assert.equal(held.current.contributions.boardContext.revision,board.revision);
 assert.equal(held.current.contributions.boardContext.hash,board.hash);
 assert.deepEqual(held.current.contributions.board,board.groups,'existing blocks projection stays compatible');
 const prior=held.current;
 board=await human(()=>f.boards.save({subject,operationId:randomUUID(),expectedRevision:board.revision,expectedHash:board.hash,board:{...board,links:[['one','two']]}}));
 const linked=await clientA.validate({selector:f.selector,expectedFingerprint:prior.fingerprint,preparedText});
 assert.equal(linked.status,'held-context-changed');
 assert.deepEqual(linked.current.contributions.boardContext.links,board.links);
 assert.equal((await clientB.validate({selector:f.selector,expectedFingerprint:linked.current.fingerprint,preparedText})).status,'current-target-guards-required');
});

test('selected-source context reads and validation neither discover nor persist Library files',async t=>{
 const f=await fixture(t),source=await f.library.retainChatFile({operationId:randomUUID(),slot:'note',folder:'Invented',name:'selected.md',bytes:Buffer.from('Invented selected passage.'),provenance:{kind:'chat-intake'}});
 const snap=await f.library.snapshot(source.id,{includeBody:true}),{parentStudyId}=f.selector;
 await agent(()=>f.concepts.save({parentStudyId,operationId:randomUUID(),expectedRevision:f.project.revision,expectedHash:f.project.hash,authorThoughts:'',aiInterpretation:'',suggestions:'',sourceSelections:[{sourceId:source.id,sourceHash:snap.hash,quote:snap.text,start:0}]}));
 const clientA=f.reader(),clientB=f.reader(),baseline=await clientA.read({selector:f.selector});
 assert.equal(baseline.sources.freshness[0].stale,false);
 assert.equal(baseline.readConsistency.status,'stable-reread');
 const unscanned=path.join(f.config.dataDir,'library','unscanned.md');
 fs.writeFileSync(unscanned,'Invented file not yet indexed.');
 const before=fileSnapshot(f.config.dataDir),indexFile=path.join(f.config.dataDir,'library-index.json');
 const checked=await clientB.validate({selector:f.selector,expectedFingerprint:baseline.fingerprint,preparedText:'Unaccepted preparation'});
 assert.equal(checked.status,'current-target-guards-required');
 assert.deepEqual(fileSnapshot(f.config.dataDir),before);
 assert.equal(JSON.parse(fs.readFileSync(indexFile)).sources.some(s=>s.rel_path==='unscanned.md'),false);
 fs.writeFileSync(snap.path,'Changed invented selected passage.');
 const changedFiles=fileSnapshot(f.config.dataDir),changed=await clientA.validate({selector:f.selector,expectedFingerprint:baseline.fingerprint,preparedText:'Unaccepted preparation'});
 assert.equal(changed.status,'held-context-changed');
 assert.equal(changed.current.sources.freshness[0].stale,true);
 assert.notEqual(changed.current.sources.freshness[0].currentHash,snap.hash);
 assert.deepEqual(fileSnapshot(f.config.dataDir),changedFiles,'freshness checks read current bytes without updating the index');
 fs.rmSync(snap.path);
 const missingFiles=fileSnapshot(f.config.dataDir),missing=await clientB.read({selector:f.selector});
 assert.equal(missing.sources.freshness[0].unavailable,true);
 assert.deepEqual(fileSnapshot(f.config.dataDir),missingFiles);
});
