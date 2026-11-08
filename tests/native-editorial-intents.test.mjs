import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createStudyBridge} from '../runtime/services/study-mcp-bridge.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {digest} from '../runtime/services/files.mjs';
const empty='---\nkind: draft\n---\n\n';
const prose='The invented cup stayed warm.\n\nThe invented room was quiet.\n\nThe closing remains mine.';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn);
const agent=fn=>withActor({actor:'agent:codex',client:'mcp'},fn);
async function fixture(t,raw=empty){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'native-intents-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 let source='The invented cup stayed warm while the room was quiet.';
 const originals={catalog:()=>({drafts:[]}),readDraft:()=>({id:'original',parentStudyKey:'invented',partKey:'article',records:[{id:'dev',role:'draft',path:'Workflow/3-Develop/DEV - Invented.md',raw,hash:digest(raw)},{id:'source',role:'source',path:'Workflow/1-Source/SRC - Invented.md',raw:source,hash:digest(source)}]})};
 const drafts=createStudyDraftCopies({dataDir,originals}),opened=await drafts.openCopy({originalId:'original',originalHash:digest(raw),parentStudyId:'invented',operationId:randomUUID()}),binding={parentStudyId:'invented',bindingId:opened.binding.id};
 const restart=()=>createStudyBridge({dataDir,drafts,binding});let bridge=restart();
 const prepare=(purpose,extra={})=>agent(()=>bridge.prepare({sourceIds:['source'],purpose,instruction:'  Keep the cup and the uncertainty.  ',...extra}));
 return {dataDir,drafts,opened,binding,raw,prepare,restart,get bridge(){return bridge;},reload(){bridge=restart();},changeSource(){source+=' Changed invented detail.';},read:()=>drafts.read(binding)};
}
const proposed=['The cup stays warm.','The room stays quiet.','The ending leaves the reason uncertain.'];
test('initial complete article captures exact intent, survives reload, stages only, Finish preserves marks/edits and exact Undo',async t=>{
 const f=await fixture(t),r=await f.prepare('article-draft');assert.equal(r.purpose,'article-draft');assert.equal(r.request.instruction,'  Keep the cup and the uncertainty.  ');f.reload();
 const context=await f.bridge.context({requestId:r.id});assert.equal(context.purpose,'article-draft');assert.equal(context.request.instruction,r.request.instruction);assert.equal(context.intent.target.kind,'insert');assert.equal(context.sources[0].raw,'The invented cup stayed warm while the room was quiet.');
 const review=await agent(()=>f.bridge.propose({requestId:r.id,draftParagraphs:proposed}));assert.equal((await f.read()).raw,f.raw);assert.equal(review.purpose,'article-draft');assert.equal(review.instruction,r.request.instruction);
 for(const extra of [{},{replacements:[{id:review.replacements[0].id,words:'Bypass.'}]}])await assert.rejects(human(()=>f.bridge.accept({requestId:r.id,operationId:randomUUID(),...extra})),/Finish/);
 const [first,second,third]=review.replacements,operationId=randomUUID(),finished=await human(()=>f.bridge.finish({requestId:r.id,operationId,edits:[{id:first.id,words:'My cup is still warm.'}],marks:[{id:second.id,note:'Not my wording.'}]}));
 assert.match(finished.raw,/^---\nkind: draft\n---\n/);assert.match(finished.raw,/My cup is still warm/);assert.ok(!finished.raw.includes(proposed[1]));assert.deepEqual(finished.readThrough.read,[third.id]);assert.equal(finished.projection.find(row=>row.words===third.words).id,third.id);assert.equal(finished.readThrough.marked[0].note,'Not my wording.');
 const undone=await human(()=>f.drafts.undo({...f.binding,operationId:randomUUID(),expected:finished.expected,undoOperationId:operationId}));assert.equal(undone.raw,f.raw);
});
test('complete article preserves native metadata and footer bytes around an empty body',async t=>{
 const raw='---\nkind: draft\n---\n\nTitle: Invented\n\n---\n\n\n---\n\nRetained author notes.',f=await fixture(t,raw),r=await f.prepare('article-draft');await f.bridge.propose({requestId:r.id,draftParagraphs:proposed});const saved=await human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID()}));assert.equal(saved.raw.replace(proposed.map(words=>words+'\n\n').join(''),''),raw);
});
test('initial complete article refuses authored prose, headings, quotations, photos, nested and protected body bytes',async t=>{
 for(const body of [prose,'# Exact heading','> Kept quotation.','- Nested words','%%protected note%%','%%photo: cup.jpg · Cup%%','==Pending words==']){const f=await fixture(t,empty+body);await assert.rejects(f.prepare('article-draft'),/empty|protected|nested|unsupported/);assert.equal((await f.read()).raw,f.raw);}
});
test('scoped revision fixes exact target IDs and marks retain old wording while unaffected structure stays exact',async t=>{
 const f=await fixture(t,empty+prose),rows=f.opened.projection.filter(row=>row.words&&row.safe),targetParagraphIds=rows.slice(0,2).map(row=>row.id),r=await f.prepare('scoped-revision',{targetParagraphIds:[...targetParagraphIds].reverse()});
 assert.deepEqual(r.request.targetParagraphIds,targetParagraphIds);assert.deepEqual((await f.bridge.context({requestId:r.id})).request,r.request);
 for(const replacements of [[{id:rows[0].id,words:'Changed.'}],[{id:rows[0].id,words:'Changed.'},{id:rows[2].id,words:'Widened.'}],[{id:rows[0].id,words:'Changed.'},{id:rows[0].id,words:'Repeated.'}]])await assert.rejects(f.bridge.propose({requestId:r.id,replacements}),/scope/);
 for(const words of ['# Heading','- List','    Code'])await assert.rejects(f.bridge.propose({requestId:r.id,replacements:targetParagraphIds.map(id=>({id,words}))}),/ordinary paragraph/);
 const replacements=targetParagraphIds.map((id,i)=>({id,words:proposed[i]}));await f.bridge.propose({requestId:r.id,replacements});f.reload();assert.equal((await f.bridge.review({requestId:r.id})).status,'pending');await assert.rejects(f.bridge.accept({requestId:r.id,operationId:randomUUID(),replacements:[{id:rows[2].id,words:'Escape.'}]}),/Finish/);
 await assert.rejects(human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID(),edits:[{id:rows[0].id,words:'# Heading'}]})),/ordinary paragraph/);
 const operationId=randomUUID(),saved=await human(()=>f.bridge.finish({requestId:r.id,operationId,edits:[{id:rows[0].id,words:'The cup stayed warm, I think.'}],marks:[{id:rows[1].id}]}));assert.equal(saved.raw,f.raw.replace(rows[0].words,'The cup stayed warm, I think.'));assert.equal((await human(()=>f.drafts.undo({...f.binding,operationId:randomUUID(),expected:saved.expected,undoOperationId:operationId}))).raw,f.raw);
});
test('scope and input contracts refuse missing instructions, unknown targets, mixed payloads and structural generated words',async t=>{
 const f=await fixture(t);for(const instruction of [undefined,'','\nInjected'])await assert.rejects(f.prepare('article-draft',{instruction}),/instruction|request/);
 await assert.rejects(f.prepare('article-draft',{targetParagraphIds:['wrong']}),/scoped revision/);await assert.rejects(f.prepare('scoped-revision',{targetParagraphIds:['wrong']}),/targets/);
 const r=await f.prepare('article-draft');for(const draftParagraphs of [[],['# Heading'],['- Item'],['    Code'],['Words\nWords']])await assert.rejects(f.bridge.propose({requestId:r.id,draftParagraphs}),/ordinary/);
 await assert.rejects(f.bridge.propose({requestId:r.id,replacements:[]}),/article-draft/);await assert.rejects(f.bridge.propose({requestId:r.id,draftParagraphs:proposed,replacements:[]}),/article-draft/);
});
test('scoped proposals and Finish cannot drop protections, and exact rejected wording/reason survives reload',async t=>{
 const f=await fixture(t,empty+prose),row=f.opened.projection.find(row=>row.words==='The invented cup stayed warm.'),contract=await f.bridge.contracts();
 await human(()=>f.bridge.humanContract({kind:'protect',humanDecision:true,operationId:randomUUID(),expectedContractHash:contract.hash,expected:f.opened.expected,paragraphId:row.id,seenBlockHash:row.blockHash,from:13,to:16,text:'cup'}));
 const input={targetParagraphIds:[row.id]},r=await f.prepare('scoped-revision',input);await assert.rejects(f.bridge.propose({requestId:r.id,replacements:[{id:row.id,words:'The invented bowl stayed warm.'}]}),/protected exact/);
 await f.bridge.propose({requestId:r.id,replacements:[{id:row.id,words:'The cup is definitely warm.'}]});await assert.rejects(human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID(),edits:[{id:row.id,words:'Only a bowl.'}]})),/protected exact/);
 await human(async()=>f.bridge.reject({requestId:r.id,humanDecision:true,reason:'The certainty is not mine.',expectedContractHash:(await f.bridge.contracts()).hash}));f.reload();const next=await f.prepare('scoped-revision',input),context=await f.bridge.context({requestId:next.id});assert.equal(context.humanContracts.rejections[0].reason,'The certainty is not mine.');assert.equal(context.humanContracts.protections[0].text,'cup');await assert.rejects(f.bridge.propose({requestId:next.id,replacements:[{id:row.id,words:'The cup is definitely warm.'}]}),/rejected wording/);assert.equal((await f.read()).raw,f.raw);
});
test('article rejection cannot be retried by changing inserted paragraph identities',async t=>{
 const f=await fixture(t),r=await f.prepare('article-draft');await f.bridge.propose({requestId:r.id,draftParagraphs:proposed});await human(async()=>f.bridge.reject({requestId:r.id,humanDecision:true,reason:'These words are not me.',expectedContractHash:(await f.bridge.contracts()).hash}));const next=await f.prepare('article-draft');await assert.rejects(f.bridge.propose({requestId:next.id,draftParagraphs:proposed}),/rejected wording/);
});
test('changed retained source bytes hold article context, review, proposal and Finish without overwriting saved writing',async t=>{
 const f=await fixture(t),r=await f.prepare('article-draft');await f.bridge.propose({requestId:r.id,draftParagraphs:proposed});const source=f.opened.context.records.find(row=>row.id==='source');fs.chmodSync(source.copiedPath,0o600);fs.appendFileSync(source.copiedPath,'Changed captured source.');assert.equal((await f.bridge.review({requestId:r.id})).stale,true);await assert.rejects(f.bridge.context({requestId:r.id}),/changed|stale/);await assert.rejects(f.bridge.propose({requestId:r.id,draftParagraphs:proposed}),/changed|stale/);await assert.rejects(human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID()})),/changed|stale/);assert.equal(fs.readFileSync(f.opened.paths.draft,'utf8'),f.raw);
});
test('changed native words and changed immutable intent are held on reloaded scoped requests',async t=>{
 const f=await fixture(t,empty+prose),row=f.opened.projection.find(row=>row.words==='The invented cup stayed warm.'),r=await f.prepare('scoped-revision',{targetParagraphIds:[row.id]});await f.bridge.propose({requestId:r.id,replacements:[{id:row.id,words:'The cup stays warm.'}]});const saved=await human(()=>f.drafts.save({...f.binding,operationId:randomUUID(),expected:f.opened.expected,operations:[{kind:'text',id:row.id,from:0,to:row.words.length,insert:'Human changed the cup.',seenBlockHash:row.blockHash}]}));f.reload();assert.equal((await f.bridge.review({requestId:r.id})).stale,true);await assert.rejects(human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID()})),/changed|stale/);assert.equal((await f.read()).raw,saved.raw);
 const file=path.join(f.dataDir,'study-mcp-requests',r.id,'request.json'),record=JSON.parse(fs.readFileSync(file));record.request.instruction='Silently widen the task.';fs.writeFileSync(file,JSON.stringify(record));await assert.rejects(f.bridge.review({requestId:r.id}),/request instruction|editorial instruction/);
});

test('new intents retain current page and exact piece instructions; later protection/guidance changes hold Finish',async t=>{
 const f=await fixture(t,empty+prose),row=f.opened.projection.find(row=>row.words==='The invented cup stayed warm.'),body='  Keep my uncertainty; never turn it into a fact.  ';
 await human(async()=>f.bridge.humanContract({kind:'set-piece-guidance',humanDecision:true,operationId:randomUUID(),expectedContractHash:(await f.bridge.contracts()).hash,key:'direction',body}));
 const r=await f.prepare('scoped-revision',{targetParagraphIds:[row.id],sourceIds:['source','author-page:'+f.binding.bindingId]}),context=await f.bridge.context({requestId:r.id});assert.equal(context.sources.find(source=>source.role==='author-page').raw,f.raw);assert.equal(context.humanContracts.pieceGuidance[0].body,body);
 await f.bridge.propose({requestId:r.id,replacements:[{id:row.id,words:'The cup stayed warm, perhaps.'}]});await human(async()=>f.bridge.humanContract({kind:'set-piece-guidance',humanDecision:true,operationId:randomUUID(),expectedContractHash:(await f.bridge.contracts()).hash,key:'direction',body:'New exact human direction.'}));assert.equal((await f.bridge.review({requestId:r.id})).stale,true);await assert.rejects(human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID()})),/contracts changed/);assert.equal((await f.read()).raw,f.raw);
});

test('selected current parent source revisions are compared again before returning context or finishing',async t=>{
 const f=await fixture(t),stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);let raw='An invented current selected passage.';
 const projectMaterial={context:async binding=>{const payload={schema:'ar-create.study-project-material-context.v1',role:'attached-parent-material-not-verified-evidence-or-approved-prose',binding,records:[{id:'current-source',role:'source',origin:'current-parent-library-material',raw,hash:digest(raw),eligible:true}]};return {...payload,hash:digest(stable(payload))};}};
 const bridge=createStudyBridge({dataDir:f.dataDir,drafts:f.drafts,binding:f.binding,projectMaterial}),r=await bridge.prepare({purpose:'article-draft',instruction:'Keep uncertainty.',sourceIds:['current-source']});await bridge.propose({requestId:r.id,draftParagraphs:proposed});raw='A changed selected source passage.';assert.equal((await bridge.review({requestId:r.id})).stale,true);await assert.rejects(bridge.context({requestId:r.id}),/material revision/);await assert.rejects(human(()=>bridge.finish({requestId:r.id,operationId:randomUUID()})),/material revision/);assert.equal((await f.read()).raw,f.raw);
});

test('new intents keep service-level Finish human-only and do not open a stand-in decision path',async t=>{
 const {createStudyAI}=await import('../runtime/services/study-ai.mjs'),f=await fixture(t),service=createStudyAI({dataDir:f.dataDir,drafts:f.drafts}),r=await agent(()=>service.call('prepare',{...f.binding,purpose:'article-draft',instruction:'Keep uncertainty.',sourceIds:['source']}));await agent(()=>service.call('propose',{...f.binding,requestId:r.id,draftParagraphs:proposed}));
 await assert.rejects(agent(()=>service.call('finish',{...f.binding,requestId:r.id,operationId:randomUUID()})),/human-only/);await assert.rejects(agent(()=>service.standInReview({...f.binding,action:'accept',requestId:r.id,operationId:randomUUID()})),/registered test copy/);assert.equal((await f.read()).raw,f.raw);
});

test('initial article also fills the exact frontmatter-only bytes produced for a new native piece',async t=>{
 const f=await fixture(t,'---\ntitle: "Invented piece"\n---\n'),r=await f.prepare('article-draft');await f.bridge.propose({requestId:r.id,draftParagraphs:proposed});const saved=await human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID()}));assert.ok(saved.raw.startsWith(f.raw));assert.ok(saved.raw.includes(proposed[0]));
});

async function chosenForInstruction(f,instruction){
 const request=await f.bridge.prepare({sourceIds:['source'],purpose:'opening-options',...(instruction!==undefined?{instruction}:{})}),options=[{id:randomUUID(),words:'I begin with the cup.'},{id:randomUUID(),words:'I begin with the room.'}];
 assert.equal((await f.bridge.context({requestId:request.id})).request?.instruction,instruction);
 await f.bridge.propose({requestId:request.id,openingOptions:options});await human(()=>f.bridge.accept({requestId:request.id,optionId:options[0].id,operationId:randomUUID()}));
 return {request,input:{sourceIds:['source'],purpose:'article-continuation',openingRequestId:request.id,selectedOptionId:options[0].id}};
}
test('optional opening and continuation instructions preserve exact whitespace through capture and restart',async t=>{
 const f=await fixture(t),openingInstruction='  Begin in the room; keep the cup uncertain.  ',continuationInstruction='  Stay with that opening and finish quietly.  ',opening=await chosenForInstruction(f,openingInstruction);
 assert.equal(opening.request.request.instruction,openingInstruction);const openingBaseline=JSON.parse(fs.readFileSync(path.join(f.dataDir,'study-mcp-requests',opening.request.id,'baseline.json')));assert.equal(openingBaseline.request.instruction,openingInstruction);assert.equal((await f.bridge.review({requestId:opening.request.id})).instruction,openingInstruction);
 const continuation=await f.bridge.prepare({...opening.input,instruction:continuationInstruction});f.reload();const context=await f.bridge.context({requestId:continuation.id});assert.equal(context.request.instruction,continuationInstruction);assert.equal(context.continuation.opening.words,'I begin with the cup.');assert.equal(continuation.request.instruction,continuationInstruction);assert.match(continuation.requestHash,/^[a-f0-9]{64}$/);await f.bridge.propose({requestId:continuation.id,continuationParagraphs:proposed});assert.equal((await f.bridge.review({requestId:continuation.id})).instruction,continuationInstruction);
});
test('legacy opening and continuation preparations omit optional instruction and stay valid',async t=>{
 const f=await fixture(t),opening=await chosenForInstruction(f);assert.equal(opening.request.request,undefined);assert.equal(opening.request.requestHash,undefined);const continuation=await f.bridge.prepare(opening.input);f.reload();assert.equal((await f.bridge.context({requestId:continuation.id})).request,undefined);assert.equal(continuation.requestHash,undefined);await f.bridge.propose({requestId:continuation.id,continuationParagraphs:proposed});assert.equal((await f.bridge.review({requestId:continuation.id})).status,'pending');
});
test('optional instructions are validated, and changed or removed captured instruction/hash refuses after restart',async t=>{
 for(const mode of ['opening-options','article-continuation']){
  const f=await fixture(t),input=mode==='opening-options'?{sourceIds:['source'],purpose:mode}:(await chosenForInstruction(f)).input;
  for(const instruction of ['',null,'\nBad','a'.repeat(2001)])await assert.rejects(f.bridge.prepare({...input,instruction}),/short paragraph request/);
  const r=await f.bridge.prepare({...input,instruction:'  Preserve these exact words.  '}),file=path.join(f.dataDir,'study-mcp-requests',r.id,'request.json'),original=fs.readFileSync(file,'utf8');
  for(const mutate of [record=>record.request.instruction='Changed words.',record=>delete record.request,record=>delete record.requestHash]){const record=JSON.parse(original);mutate(record);fs.writeFileSync(file,JSON.stringify(record));f.reload();await assert.rejects(f.bridge.context({requestId:r.id}),/Captured request instruction/);}
  fs.writeFileSync(file,original);f.reload();assert.equal((await f.bridge.context({requestId:r.id})).request.instruction,'  Preserve these exact words.  ');
 }
});

for(const nl of ['\n','\r\n'])for(const mutation of ['source','draft'])test('multiline scoped target retains '+mutation+' freshness guard '+JSON.stringify(nl),async t=>{
 const f=await fixture(t,empty+'First invented line.'+nl+'Second invented line.'+nl+nl+'Neighbor exact.'),target=f.opened.projection.find(p=>p.words==='First invented line.\nSecond invented line.'),r=await f.prepare('scoped-revision',{targetParagraphIds:[target.id]});await f.bridge.propose({requestId:r.id,replacements:[{id:target.id,words:'Revised invented paragraph.'}]});let expected=f.raw;
 if(mutation==='source'){const source=f.opened.context.records.find(row=>row.id==='source');fs.chmodSync(source.copiedPath,0o600);fs.appendFileSync(source.copiedPath,' Changed source.');}else{const saved=await human(()=>f.drafts.save({...f.binding,expected:f.opened.expected,operationId:randomUUID(),operations:[{kind:'text',id:target.id,from:0,to:5,insert:'Later',seenBlockHash:target.blockHash}]}));expected=saved.raw;}
 f.reload();assert.equal((await f.bridge.review({requestId:r.id})).stale,true);await assert.rejects(human(()=>f.bridge.finish({requestId:r.id,operationId:randomUUID()})),/changed|stale/);assert.equal(fs.readFileSync(f.opened.paths.draft,'utf8'),expected);
});
