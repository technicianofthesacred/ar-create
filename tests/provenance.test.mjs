import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {digest} from '../runtime/services/files.mjs';
import {authorOf,parseActor,LEGACY_ACTOR} from '../runtime/services/actor.mjs';
import {renderConcept} from '../runtime/services/concept-markdown.mjs';

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const call=async(route,input,headers={})=>{const response=await fetch(url+route,input===undefined?{headers}:{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};};
 const as=(actor,client='cli')=>({'X-AR-Actor':actor,'X-AR-Client':client});
 const ok=async(route,input,headers=as('human:adrian'))=>{const out=await call(route,input,headers);assert.equal(out.status,200,route+' '+JSON.stringify(out.body));return out.body;};
 const raw=fs.readFileSync(path.join(fixture.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8');
 const opened=await ok('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(raw),operationId:randomUUID()});
 return {fixture,config,url,call,ok,as,opened,binding:{bindingId:opened.binding.id,parentStudyId:'hk'}};
}

test('actor vocabulary is closed; legacy records read as unknown(pre-provenance)',()=>{
 for(const value of ['human:adrian','agent:claude-code','agent:codex','agent:claude-design','agent:hermes','agent:grok','agent:chatgpt','cron:nightly-index','import:mag','release:459a2d1'])assert.equal(parseActor(value),value);
 for(const value of ['human:someone','agent:gemini','operator','cron:','release:not-a-sha','agent:codex:x','','human:adrian ',null])assert.equal(parseActor(value),value==='human:adrian '?'human:adrian':null);
 assert.deepEqual(authorOf({operationId:'x'}),{actor:LEGACY_ACTOR,client:null});
 assert.deepEqual(authorOf({provenance:{actor:'agent:codex',client:'cli'}}),{actor:'agent:codex',client:'cli'});
 assert.deepEqual(authorOf({provenance:{actor:'agent:forged',client:'nope'}}),{actor:LEGACY_ACTOR,client:null});
});

test('a mutation with no actor is refused (400); a bad actor is refused; same-origin browser is human:adrian via ui',async t=>{
 const f=await setup(t);
 for(const [route,input] of [['/api/concept/save',{}],['/api/study-draft/save',{}],['/api/study/human-direction/write',{}],['/api/work-continuity/read',{}],['/api/inquiries/create',{}],['/api/sources/folders',{}],['/api/study/share/save',{}],['/api/study/outputs/save',{}]]){
  const out=await f.call(route,input);assert.equal(out.status,400,route);assert.match(out.body.error,/X-AR-Actor/,route);
 }
 assert.equal((await f.call('/api/concept/save',{},{'X-AR-Actor':'agent:gemini'})).status,400);
 assert.equal((await f.call('/api/concept/save',{},{'X-AR-Actor':'agent:codex','X-AR-Client':'carrier-pigeon'})).status,400);
 // Reads need no actor.
 assert.equal((await f.call('/api/study-draft/catalog')).status,200);
 // Foreign origins stay 403 even with a valid actor.
 assert.equal((await f.call('/api/concept/save',{},{Origin:'https://example.invalid','X-AR-Actor':'human:adrian'})).status,403);
 // The browser: same-origin, no header.
 const part=await f.ok('/api/study/human-direction/select',{...f.binding,scope:'part',operationId:randomUUID(),title:'Part'},{Origin:f.url});
 const saved=await f.ok('/api/study/human-direction/write',{...f.binding,scope:'part',operationId:randomUUID(),expectedRevision:part.revision,expectedHash:part.hash,body:'Words from the app.'},{Origin:f.url});
 const row=saved.history.at(-1);assert.equal(row.actor,'human:adrian');assert.equal(row.client,'ui');
});

test('history shows who wrote each direction revision; agents cannot adopt direction',async t=>{
 const f=await setup(t);
 const created=await f.ok('/api/concepts',{parentStudyId:'provenance-concept',title:'Provenance concept',operationId:randomUUID()});
 const pid=created.parentStudyId||'provenance-concept',start=await f.ok('/api/concept?'+new URLSearchParams({parentStudyId:pid}));
 const first=await f.ok('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),expectedRevision:start.revision,expectedHash:start.hash,authorThoughts:'My words.',adoptedDirection:'Keep it quiet.',aiInterpretation:'',suggestions:'',sourceSelections:[]});
 // An agent may add its interpretation, keeping the adopted section.
 const agentSave=await f.ok('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),expectedRevision:first.revision,expectedHash:first.hash,authorThoughts:'My words.',aiInterpretation:'Perhaps about attention.',suggestions:'',sourceSelections:[]},f.as('agent:codex'));
 const rows=agentSave.history.filter(r=>r.status==='committed'),last=rows.slice(-2);
 assert.deepEqual([last[0].actor,last[0].client],['human:adrian','cli']);
 assert.deepEqual([last[1].actor,last[1].client],['agent:codex','cli']);
 assert.equal(agentSave.adoptedDirection,'Keep it quiet.');
 // Changing the adopted section is a human decision.
 const refused=await f.call('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),expectedRevision:agentSave.revision,expectedHash:agentSave.hash,authorThoughts:'My words.',adoptedDirection:'Make it loud.',aiInterpretation:'',suggestions:'',sourceSelections:[]},f.as('agent:claude-code'));
 assert.equal(refused.status,403);assert.match(refused.body.error,/human-only/);
 const after=await f.ok('/api/concept?'+new URLSearchParams({parentStudyId:pid}));assert.equal(after.revision,agentSave.revision);assert.equal(after.adoptedDirection,'Keep it quiet.');
 // A raw body that rewrites the adopted section is refused the same way.
 assert.equal((await f.call('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),expectedRevision:after.revision,expectedHash:after.hash,body:renderConcept({authorThoughts:'My words.',adoptedDirection:'Different.',aiInterpretation:'',suggestions:'',sourceSelections:[]})},f.as('agent:codex'))).status,403);
 // The same change by the human goes through and is stamped as the app.
 const human=await f.ok('/api/concept/save',{parentStudyId:pid,operationId:randomUUID(),expectedRevision:after.revision,expectedHash:after.hash,authorThoughts:'My words.',adoptedDirection:'Make it loud.',aiInterpretation:'',suggestions:'',sourceSelections:[]},{Origin:f.url});
 assert.deepEqual([human.history.at(-1).actor,human.history.at(-1).client],['human:adrian','ui']);
 // The operation records on disk carry the stamp.
 const journalDir=path.join(path.dirname(human.path),'human-direction-history');
 const stamps=fs.readdirSync(journalDir).map(name=>JSON.parse(fs.readFileSync(path.join(journalDir,name),'utf8'))).filter(op=>op.status==='committed').map(op=>op.provenance?.actor);
 assert.deepEqual(stamps.filter(Boolean).sort(),['agent:codex','human:adrian','human:adrian']);
});

test('human-only decisions refuse agents with 403 before any write',async t=>{
 const f=await setup(t),query=new URLSearchParams(f.binding);
 for(const route of ['/api/study-ai/accept?'+query,'/api/study-ai/reject?'+query,'/api/study-ai/human-contract?'+query,'/api/study/share/fact','/api/inquiries/direction-references/change','/api/inquiries/references/change','/api/inquiries/association/change']){
  const out=await f.call(route,{requestId:randomUUID()},f.as('agent:claude-code','mcp'));assert.equal(out.status,403,route);assert.match(out.body.error,/human-only/,route);
 }
});

test('draft saves record their author beside the native receipt',async t=>{
 const f=await setup(t);
 const operationId=randomUUID(),row=f.opened.projection.find(r=>r.blockKind==='paragraph')||f.opened.projection[0];
 const saved=await f.ok('/api/study-draft/save',{...f.binding,expected:f.opened.expected,operationId,operations:[{kind:'text',id:row.id,from:0,to:row.words.length,insert:'Changed by an agent proposal path.',seenBlockHash:row.blockHash}]},f.as('agent:claude-code','cli'));
 const entry=saved.history.find(h=>h.operationId===operationId);assert.ok(entry,'save appears in history');
 assert.equal(entry.actor,'agent:claude-code');assert.equal(entry.client,'cli');
 // Earlier receipts with no stamp read as legacy.
 assert.ok(saved.history.filter(h=>h.operationId!==operationId).every(h=>h.actor==='unknown(pre-provenance)'));
});
