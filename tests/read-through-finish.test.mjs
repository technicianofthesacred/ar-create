// Read-through replaces per-paragraph Accept (Adrian, 3 November 2026). He reads a machine draft as a whole,
// rewrites or marks what is not him, and finishes. Untouched paragraphs count as read. Only Adrian finishes.
// Each rewrite of a machine paragraph queues a voice correction he approves; nothing edits a voice file.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';import {createServer} from '../runtime/server.mjs';import {createWorkspaceExecution} from '../runtime/services/artifact-execution.mjs';import {digest} from '../runtime/services/files.mjs';import {createAdapter} from '../mcp/study/server.mjs';

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,i64osDirections:null,execution:createWorkspaceExecution({codexPath:null,boundedEditorial:true})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const api=async(route,body,actor='human:adrian')=>{const response=await fetch(url+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':actor.startsWith('human:')?'ui':'mcp'},body:JSON.stringify(body)});return {status:response.status,result:await response.json()};};
 const original=path.join(fixture.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),raw=fs.readFileSync(original,'utf8');
 const opened=(await api('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(raw),operationId:randomUUID()})).result;
 const binding={bindingId:opened.binding.id,parentStudyId:'hk'},query=new URLSearchParams(binding);
 assert.equal((await api('/api/study/human-direction/select',{...binding,scope:'part',operationId:randomUUID(),title:'Synthetic part'})).status,200);
 const direction=(await api('/api/study/human-direction?'+new URLSearchParams({...binding,scope:'part'}))).result;
 assert.equal((await api('/api/study/human-direction/write',{...binding,scope:'part',operationId:randomUUID(),expectedRevision:direction.revision,expectedHash:direction.hash,body:'Keep the invented source uncertain.'})).status,200);
 const ai=(route,body,actor)=>{const [name,extra]=route.split('?');return api('/api/study-ai/'+name+'?'+query+(extra?'&'+extra:''),body,actor);};
 const file=path.join(fixture.dir,'adapter.json');fs.writeFileSync(file,JSON.stringify({schema:'ar-create.study-mcp-config.v1',url,...binding,apiPrefix:'/api/study-ai',actor:'agent:claude-code'}));
 const adapter=createAdapter(file);
 // An agent drafts: one proposal replacing both editable paragraphs.
 async function draft(words){
  const read=await adapter.callTool('study_draft_read',{}),rows=read.projection.filter(p=>p.proposalEditable).slice(0,2);
  assert.equal(rows.length,2,'fixture has two editable paragraphs');
  const request=await adapter.callTool('study_draft_prepare',{sourceIds:read.sourceCatalog.filter(s=>s.canPrepare).map(s=>s.id)});
  await adapter.callTool('study_draft_propose',{requestId:request.id,replacements:rows.map((row,i)=>({id:row.id,words:words[i]}))});
  return {requestId:request.id,rows};
 }
 const writing=async()=>(await api('/api/study-draft/read?'+query)).result.raw;
 return {url,api,ai,binding,draft,writing};
}

test('finish: Adrian\'s rewrite goes in as his words, the untouched paragraph counts as read, and the rewrite queues one voice correction',async t=>{
 const f=await setup(t),{requestId,rows}=await f.draft(['A machine opening that sounds like a brochure.','A machine middle paragraph.']);
 for(const actor of ['agent:claude-code','agent:codex','cron:nightly']){
  const refused=await f.ai('finish',{requestId,operationId:randomUUID()},actor);
  assert.equal(refused.status,403,actor);assert.match(refused.result.error,/human-only/);
 }
 assert.equal((await f.api('/api/voice-corrections')).result.items.length,0);
 const operationId=randomUUID(),mine='I opened the kiln and the room smelled of rain.';
 const done=await f.ai('finish',{requestId,operationId,edits:[{id:rows[0].id,words:mine}]});
 assert.equal(done.status,200,JSON.stringify(done.result));
 assert.deepEqual(done.result.readThrough.read,[rows[1].id]);
 assert.deepEqual(done.result.readThrough.edited,[{id:rows[0].id,before:'A machine opening that sounds like a brochure.',after:mine}]);
 assert.deepEqual(done.result.readThrough.marked,[]);
 const raw=await f.writing();
 assert.ok(raw.includes(mine),raw);assert.ok(raw.includes('A machine middle paragraph.'),raw);assert.ok(!raw.includes('brochure'),raw);
 const review=(await f.ai('review?requestId='+requestId)).result;
 const listed=(await f.ai('requests')).result.items.find(i=>i.id===requestId);assert.equal(listed.readThrough,true);assert.equal(review.status,'accepted');assert.equal(review.decision.readThrough.role,'human-read-through-of-ai-draft');assert.equal(review.decision.provenance.actor,'human:adrian');
 // A retried finish is the same finish: no second write, no second correction.
 const again=await f.ai('finish',{requestId,operationId,edits:[{id:rows[0].id,words:mine}]});
 assert.equal(again.status,200,JSON.stringify(again.result));
 const queued=(await f.api('/api/voice-corrections')).result;
 assert.equal(queued.items.length,1);assert.equal(queued.counts.pending,1);
 const [correction]=queued.items;
 assert.equal(correction.before,'A machine opening that sounds like a brochure.');assert.equal(correction.after,mine);
 assert.equal(correction.piece.parentStudyId,'hk');assert.equal(correction.piece.bindingId,f.binding.bindingId);assert.equal(correction.requestId,requestId);
 assert.equal(correction.queuedBy.actor,'human:adrian');assert.equal(correction.voiceCorrect.key,'voice-profile');
 // A different finish of the same draft is refused.
 assert.equal((await f.ai('finish',{requestId,operationId:randomUUID()})).status,409);
});

test('finish: a paragraph marked "not me" stays out, with his note kept; the rest goes in',async t=>{
 const f=await setup(t),{requestId,rows}=await f.draft(['Words that are not mine at all.','A middle paragraph I can live with.']);
 const before=await f.writing();
 const done=await f.ai('finish',{requestId,operationId:randomUUID(),marks:[{id:rows[0].id,note:'Too polished, I would never say this.'}]});
 assert.equal(done.status,200,JSON.stringify(done.result));
 assert.deepEqual(done.result.readThrough.marked,[{id:rows[0].id,words:'Words that are not mine at all.',note:'Too polished, I would never say this.'}]);
 assert.deepEqual(done.result.readThrough.read,[rows[1].id]);
 const raw=await f.writing();
 assert.ok(!raw.includes('not mine at all'),raw);assert.ok(raw.includes('A middle paragraph I can live with.'),raw);
 assert.ok(raw.includes(rows[0].words),'the marked paragraph keeps its earlier words');assert.notEqual(raw,before);
 assert.equal((await f.api('/api/voice-corrections')).result.items.length,0,'a mark alone is not a rewrite');
});

test('finish: when every paragraph is marked, nothing is taken in and the writing is unchanged',async t=>{
 const f=await setup(t),{requestId,rows}=await f.draft(['First paragraph that is not me.','Second paragraph that is not me.']);
 const before=await f.writing();
 const done=await f.ai('finish',{requestId,operationId:randomUUID(),marks:rows.map(r=>({id:r.id}))});
 assert.equal(done.status,200,JSON.stringify(done.result));
 assert.equal(await f.writing(),before);
 const review=(await f.ai('review?requestId='+requestId)).result;
 assert.equal(review.status,'rejected');assert.equal(review.decision.readThrough.marked.length,2);
});

test('finish: rewrites and marks must name this draft\'s paragraphs, and a paragraph cannot be both',async t=>{
 const f=await setup(t),{requestId,rows}=await f.draft(['One machine paragraph.','Another machine paragraph.']);
 assert.equal((await f.ai('finish',{requestId,operationId:randomUUID(),edits:[{id:'not-a-paragraph',words:'Mine.'}]})).status,400);
 assert.equal((await f.ai('finish',{requestId,operationId:randomUUID(),edits:[{id:rows[0].id,words:'Mine.'}],marks:[{id:rows[0].id}]})).status,400);
 assert.equal((await f.ai('finish',{requestId,operationId:randomUUID(),edits:[{id:rows[0].id,words:'**Markdown** is not prose here.'}]})).status,400);
 assert.equal((await f.ai('review?requestId='+requestId)).result.status,'pending','refused finishes decide nothing');
});

test('voice corrections: only Adrian approves or drops; approved ones export in the i64os voice_correct shape; sent is bookkeeping',async t=>{
 const f=await setup(t),{requestId,rows}=await f.draft(['A machine sentence about tea.','A machine sentence about clay.']);
 const done=await f.ai('finish',{requestId,operationId:randomUUID(),edits:[{id:rows[0].id,words:'Tea, the way my teacher poured it.'},{id:rows[1].id,words:'Clay that remembers the hand.'}]});
 assert.equal(done.status,200,JSON.stringify(done.result));
 const [first,second]=(await f.api('/api/voice-corrections?status=pending')).result.items;
 const agent=await f.api('/api/voice-corrections/decide',{id:first.id,decision:'approve',operationId:randomUUID()},'agent:claude-code');
 assert.equal(agent.status,403);assert.match(agent.result.error,/human-only/);
 const approved=await f.api('/api/voice-corrections/decide',{id:first.id,decision:'approve',key:'body-of-work',note:'I write from the teacher, not about her.',operationId:randomUUID()});
 assert.equal(approved.status,200,JSON.stringify(approved.result));assert.equal(approved.result.status,'approved');
 assert.equal((await f.api('/api/voice-corrections/decide',{id:second.id,decision:'drop',reason:'Draft-specific.',operationId:randomUUID()})).result.status,'dropped');
 const out=(await f.api('/api/voice-corrections/export')).result;
 assert.equal(out.items.length,1);
 const vc=out.items[0].voiceCorrect;
 assert.equal(vc.key,'body-of-work');assert.match(vc.text,/A machine sentence about tea\./);assert.match(vc.text,/Tea, the way my teacher poured it\./);assert.match(vc.text,/I write from the teacher/);
 assert.match(vc.source,/^ar-create · /);assert.doesNotMatch(vc.text+vc.source,/—/,'no em dashes in his copy');
 // Carrying it to i64os is not his decision, so an agent may record that it was sent.
 const sent=await f.api('/api/voice-corrections/sent',{id:first.id,operationId:randomUUID(),ref:'voice_correct queued'},'agent:claude-code');
 assert.equal(sent.status,200,JSON.stringify(sent.result));assert.equal(sent.result.status,'sent');
 assert.equal((await f.api('/api/voice-corrections/export')).result.items.length,0);
 assert.equal((await f.api('/api/voice-corrections/sent',{id:second.id,operationId:randomUUID()},'agent:claude-code')).status,409,'a dropped correction is never sent');
});

test('the registry tells agents finish and voice-correction approval are human-only',async t=>{
 const f=await setup(t),caps=(await f.api('/api/capabilities')).result;
 for(const name of ['study-ai.finish','voice-corrections.decide'])assert.deepEqual(caps.commands.find(c=>c.name===name)?.actors,['human'],name);
 for(const name of ['voice-corrections.get','voice-corrections.export','voice-corrections.sent'])assert.ok(caps.commands.find(c=>c.name===name||c.name===name.replace(/\.get$/,'')),name);
});
