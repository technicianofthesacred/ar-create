// Agents never save prose directly; they propose it (Adrian, 3 Nov 2026; review Track 3.1).
// One check per prose route: an agent gets 403 before anything is read or written, while the same
// request from Adrian passes the gate. The proposal paths stay open to agents.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {digest} from '../runtime/services/files.mjs';
import {createServer} from '../runtime/server.mjs';
import {PROSE_SAVES} from '../runtime/commands.mjs';
import {MAGAZINE_HUMAN_ONLY} from '../runtime/commands/magazine.mjs';
import {magazineServer} from './helpers/magazine-server.mjs';

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const call=async(route,input,headers={})=>{const response=await fetch(url+route,input===undefined?{headers}:{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};};
 const as=(actor,client='cli')=>({'X-AR-Actor':actor,'X-AR-Client':client});
 return {url,call,as,vault:fixture.vault};
}

const ROUTES=[
 ['study-draft.save','/api/study-draft/save'],
 ['study-draft.history-restore','/api/study-draft/history-restore'],
 ['study.outputs.save','/api/study/outputs/save'],
 ['study.outputs.undo','/api/study/outputs/undo'],
 ['study.outputs.undo-words','/api/study/outputs/undo-words'],
 ['study.human-direction.write','/api/study/human-direction/write'],
 ['study.human-direction.undo','/api/study/human-direction/undo'],
 // Finishing a read-through saves Adrian's rewrites and the paragraphs he left alone (3 Nov 2026).
 ['study-ai.finish','/api/study-ai/finish'],
 ['magazine.mark-published','/api/magazine/mark-published'],
];

// Using material for Check writes no prose, so it is not a prose save; it is still Adrian's alone, at the gate.
test('study-draft.capture-sources is refused to every agent before anything is read, and passes the gate for Adrian',async t=>{
 const f=await setup(t),body={bindingId:randomUUID(),parentStudyId:'invented',operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:randomUUID(),sourceHash:'0'.repeat(64)}]};
 assert.equal(PROSE_SAVES.includes('POST /api/study-draft/capture-sources'),false);
 for(const actor of ['agent:claude-code','agent:codex','agent:chatgpt','agent:hermes','agent:grok','agent:claude-design','cron:nightly','import:notes']){const r=await f.call('/api/study-draft/capture-sources',body,f.as(actor));assert.equal(r.status,403,actor);}
 const human=await f.call('/api/study-draft/capture-sources',body,f.as('human:adrian','ui'));assert.notEqual(human.status,403);
});

test('the prose-save list is exactly the routes tested here',()=>{
 assert.deepEqual([...PROSE_SAVES,'POST /api/magazine/mark-published'].sort(),ROUTES.map(([,route])=>'POST '+route).sort());
 assert.ok(MAGAZINE_HUMAN_ONLY.includes('POST /api/magazine/mark-published'));
});

for(const [name,route] of ROUTES){
 test(`${name}: an agent gets 403; Adrian passes the gate`,async t=>{
  const f=await setup(t);
  for(const actor of ['agent:claude-code','agent:codex','agent:hermes']){
   const out=await f.call(route,{operationId:randomUUID()},f.as(actor,'mcp'));
   assert.equal(out.status,403,`${actor} ${route} ${JSON.stringify(out.body)}`);assert.match(out.body.error,/human-only/,route);
  }
  // cron and import writers are not Adrian either.
  assert.equal((await f.call(route,{operationId:randomUUID()},f.as('cron:nightly'))).status,403,route);
  // Adrian's request is not refused as human-only (it fails later on its empty body, or the owner is not configured here).
  const human=await f.call(route,{operationId:randomUUID()},f.as('human:adrian'));
  assert.doesNotMatch(String(human.body.error||''),/human-only/,route);
  const browser=await f.call(route,{operationId:randomUUID()},{Origin:f.url});
  assert.doesNotMatch(String(browser.body.error||''),/human-only/,route);
 });
}

test('the capabilities registry tells agents these routes are human-only',async t=>{
 const f=await setup(t),caps=(await f.call('/api/capabilities')).body;
 for(const [name] of ROUTES){const command=caps.commands.find(c=>c.name===name);if(command)assert.deepEqual(command.actors,['human'],name);}
 for(const name of ['study-draft.save','study.outputs.save','study.human-direction.write'])assert.ok(caps.commands.some(c=>c.name===name),name);
});

test('concept.save: an agent may propose an interpretation, but not write Adrian\'s thoughts',async t=>{
 const f=await setup(t),pid='prose-rule-concept';
 await f.call('/api/concepts',{parentStudyId:pid,title:'Prose rule',operationId:randomUUID()},f.as('human:adrian'));
 const start=(await f.call('/api/concept?'+new URLSearchParams({parentStudyId:pid}))).body;
 const save=(input,actor)=>f.call('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),aiInterpretation:'',suggestions:'',sourceSelections:[],...input},f.as(actor));
 const mine=await save({expectedRevision:start.revision,expectedHash:start.hash,authorThoughts:'My words.'},'human:adrian');assert.equal(mine.status,200,JSON.stringify(mine.body));
 const proposal=await save({expectedRevision:mine.body.revision,expectedHash:mine.body.hash,authorThoughts:'My words.',aiInterpretation:'Perhaps about attention.',suggestions:'Open on the kiln.'},'agent:claude-code');
 assert.equal(proposal.status,200,JSON.stringify(proposal.body));assert.equal(proposal.body.aiInterpretation,'Perhaps about attention.');
 const refused=await save({expectedRevision:proposal.body.revision,expectedHash:proposal.body.hash,authorThoughts:'Words the agent put in my mouth.'},'agent:codex');
 assert.equal(refused.status,403);assert.match(refused.body.error,/human-only/);
 const after=(await f.call('/api/concept?'+new URLSearchParams({parentStudyId:pid}))).body;
 assert.equal(after.revision,proposal.body.revision);assert.equal(after.authorThoughts,'My words.');
});

test('concept.save: an agent may append Adrian\'s dictated words, stamped as dictated, and never change what is there',async t=>{
 const f=await setup(t),pid='dictation-concept';
 await f.call('/api/concepts',{parentStudyId:pid,title:'Dictation',operationId:randomUUID()},f.as('human:adrian'));
 const start=(await f.call('/api/concept?'+new URLSearchParams({parentStudyId:pid}))).body;
 const save=(base,input,actor)=>f.call('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),expectedRevision:base.revision,expectedHash:base.hash,aiInterpretation:'',suggestions:'',sourceSelections:[],...input},f.as(actor));
 const mine=await save(start,{authorThoughts:'The kiln was cold.'},'human:adrian');assert.equal(mine.status,200,JSON.stringify(mine.body));
 // Appending without saying it is dictation is refused, and so is any change to what is there.
 assert.equal((await save(mine.body,{authorThoughts:'The kiln was cold.\n\nWe waited.'},'agent:claude-code')).status,403);
 for(const changed of ['The kiln was warm.\n\nWe waited.','We waited.\n\nThe kiln was cold.','We waited.']){
  const out=await save(mine.body,{authorThoughts:changed,dictated:true},'agent:claude-code');
  assert.ok([400,403].includes(out.status),changed+' '+out.status);
 }
 // dictated:true with nothing appended is a usage error, not a silent save.
 assert.equal((await save(mine.body,{authorThoughts:'The kiln was cold.',dictated:true},'agent:claude-code')).status,400);
 const operationId=randomUUID(),dictated=await f.call('/api/concept/save',{parentStudyId:pid,operationId,expectedRevision:mine.body.revision,expectedHash:mine.body.hash,authorThoughts:'The kiln was cold.\n\nWe waited two days for the wood.',aiInterpretation:'',suggestions:'',sourceSelections:[],dictated:true},f.as('agent:claude-code'));
 assert.equal(dictated.status,200,JSON.stringify(dictated.body));
 assert.equal(dictated.body.authorThoughts,'The kiln was cold.\n\nWe waited two days for the wood.');
 const row=dictated.body.history.find(h=>h.operationId===operationId);
 assert.deepEqual([row.actor,row.dictated],['agent:claude-code',{by:'agent:claude-code',client:'cli'}]);
 assert.ok(dictated.body.history.filter(h=>h.operationId!==operationId).every(h=>!h.dictated),'only the dictated append is stamped');
 // The stamp survives a fresh read.
 const reread=(await f.call('/api/concept?'+new URLSearchParams({parentStudyId:pid}))).body;
 assert.deepEqual(reread.history.find(h=>h.operationId===operationId).dictated,{by:'agent:claude-code',client:'cli'});
 // Adrian may still rewrite his own words freely.
 assert.equal((await save(reread,{authorThoughts:'Cold kiln. Two days.'},'human:adrian')).status,200);
});

test('study-draft.undo: an agent may not undo draft wording outside a structure-test copy',async t=>{
 const f=await setup(t);
 const raw=fs.readFileSync(path.join(f.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8');
 const opened=(await f.call('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(raw),operationId:randomUUID()},f.as('human:adrian'))).body;
 const binding={bindingId:opened.binding.id,parentStudyId:'hk'},row=opened.projection.find(r=>r.blockKind==='paragraph')||opened.projection[0];
 const saveId=randomUUID(),saved=await f.call('/api/study-draft/save',{...binding,expected:opened.expected,operationId:saveId,operations:[{kind:'text',id:row.id,from:0,to:row.words.length,insert:'Adrian\'s own sentence.',seenBlockHash:row.blockHash}]},f.as('human:adrian'));
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 const refused=await f.call('/api/study-draft/undo',{...binding,expected:saved.body.expected,operationId:randomUUID(),undoOperationId:saveId},f.as('agent:claude-code'));
 assert.equal(refused.status,403);assert.match(refused.body.error,/human-only/);
 const undone=await f.call('/api/study-draft/undo',{...binding,expected:saved.body.expected,operationId:randomUUID(),undoOperationId:saveId},f.as('human:adrian'));
 assert.equal(undone.status,200,JSON.stringify(undone.body));
});

// magazine.working-draft.save and its share-feedback save hand an agent's words to the same proposal path:
// tests/magazine-working-draft-http.test.mjs and tests/magazine-share-context-http.test.mjs prove proposed:true.
test('magazine.write stays the agent proposal path: an agent\'s draft words are proposed, never written',async t=>{
 const s=await magazineServer(t),dev='Workflow/3-Develop/DEV - Clay Teacher (story).md',before=fs.readFileSync(path.join(s.f.vault,dev),'utf8');
 const out=await s.cli(['call','magazine.write'],{path:dev,content:before+'\nAn agent\'s new line.\n',expectedHash:s.hashOf(dev),operationId:randomUUID()});
 assert.equal(out.result?.proposed,true,JSON.stringify(out));
 assert.equal(fs.readFileSync(path.join(s.f.vault,dev),'utf8'),before);
 const proposals=(await (await fetch(s.url+'/api/magazine/proposals')).json()).proposals;
 assert.ok(proposals.some(p=>p.path===dev&&p.actor==='agent:claude-code'));
});
