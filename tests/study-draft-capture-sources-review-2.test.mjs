// Second adversarial review of piece A (study-draft.capture-sources). Invented content only. Each test names the finding
// it proves in docs/plans/version-two-briefs/v2-12-capture-sources.md, "Second code review of piece A". A test marked
// todo states the corrected behaviour and fails today; the others pin what this review confirmed.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {createStudyDraftChecks} from '../runtime/services/study-draft-checks.mjs';import {withActor} from '../runtime/services/actor.mjs';import {digest} from '../runtime/services/files.mjs';

const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),AGENT='agent:codex';

async function http(t,{recording=false}={}){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review2-http-'))),dataDir=path.join(dir,'data'),roots={vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')};for(const r of Object.values(roots))fs.mkdirSync(r,{recursive:true});
 const fixture=recording?createWorkshopFixture(dataDir):null;if(fixture)fs.writeFileSync(path.join(fixture.output,'transcribe.json'),JSON.stringify(fixture.original));
 const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:roots,researchEnabled:false,sharedArticles:true,...(recording?{transcriptionRuntime:{python:'/no-interpreter'}}:{})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,actor='human:adrian')=>{const response=await fetch(base+route,{...(body===undefined?{headers:{'x-ar-actor':actor}}:{method:'POST',headers:{'content-type':'application/json','x-ar-actor':actor},body:JSON.stringify(body)})});let json=null;try{json=await response.json();}catch{}return {status:response.status,body:json};};
 return {dataDir,call,fixture};
}
// Assistants can no longer mark anything reviewed. A review one made before that change is made in a fixture by writing
// the old stamp, so "reviewed by an assistant" stays tested.
function stampTranscriptAs(h,actor,revision){const tf=path.join(h.fixture.output,'transcript.json'),bf=path.join(h.fixture.output,'.corrections','base.json'),doc=JSON.parse(fs.readFileSync(tf,'utf8'));doc.metadata.review={status:'reviewed',reviewedAt:new Date().toISOString(),inspectedRevision:revision,by:actor};fs.writeFileSync(tf,JSON.stringify(doc,null,2));const base=JSON.parse(fs.readFileSync(bf,'utf8'));base.json=fs.readFileSync(tf,'utf8');fs.writeFileSync(bf,JSON.stringify(base,null,2));}
function noteFlow(n){return fs.readdirSync(path.join(n.h.dataDir,'first-flow')).map(d=>path.join(n.h.dataDir,'first-flow',d,'flow.json')).find(f=>fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).projectId===n.projectId);}
function stampNoteAs(n,actor){const file=noteFlow(n),flow=JSON.parse(fs.readFileSync(file,'utf8'));flow.reviews[n.source.id]=n.source.hash;flow.reviewedBy={...(flow.reviewedBy||{}),[n.source.id]:{by:actor,at:new Date().toISOString(),hash:n.source.hash}};fs.writeFileSync(file,JSON.stringify(flow));}
async function service(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review2-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Object.assign(Error('No originals.'),{status:404});}}}),parentStudyId='subject-'+randomUUID();
 const doc=await human(()=>drafts.createCollection({parentStudyId,title:'Invented subject',operationId:randomUUID()})),scope={bindingId:doc.binding.id,parentStudyId};
 const records=new Map(),add=(title,kind,raw)=>{const id=randomUUID(),hash=digest('library:'+raw);records.set(id,{id,title,kind,hash,eligible:true,review:{state:'reviewed',hash,by:'human:adrian',at:'2026-11-12T10:00:00.000Z',basis:kind==='transcript'?'canonical-recording-review':'exact-first-flow-source-use-review'},raw,bodyHash:digest(raw)});return id;};
 const lib={async context(_,{sourceIds}={}){return {records:(sourceIds||[...records.keys()]).map(id=>structuredClone(records.get(id)))};}};
 const capture=async ids=>{const cur=await drafts.read(scope);return human(()=>drafts.captureSources({...scope,operationId:randomUUID(),expectedSourcesHash:cur.addedSources?.hash??null,sources:ids.map(id=>({sourceId:id,sourceHash:records.get(id).hash}))},{material:lib}));};
 const checks=createStudyDraftChecks({dataDir,drafts,outputs:null});
 const write=async raw=>{const d=await drafts.read(scope);return human(()=>drafts.save({...scope,expected:d.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw}]}));};
 const check=async()=>{const d=await drafts.read(scope);return checks.run({...scope,operationId:randomUUID(),expected:d.expected});};
 return {dataDir,drafts,checks,scope,add,capture,write,check};
}
const INVENTED='"The kiln told me to stop selling cups to tourists."';
const long=n=>Array.from({length:n},(_,i)=>'w'+i).join(' ');

// Finding 1 (should fix, fails open). The quote check now runs the guard once per captured file and counts a passage as
// not found only when every run printed it. A run that dies part way (the guard recurses once per quoted word, so a very
// long passage that does match one file overflows the stack there: exit 1, no NOT FOUND lines) is read as "found
// everything". On main one dead run is "unsupported" and Check is held. Here an invented quote passes.
test('a guard run that dies on one captured file does not turn every quote into found',async t=>{
 const s=await service(t),words=long(12000);
 const a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n'),b=s.add('Long note','markdown',words+'\n');
 await s.capture([a]);await s.write('"'+words+'"');await s.write(INVENTED);
 const one=await s.check();assert.equal(one.status,'needs-review','with one file both passages are reported');assert.equal(one.issues.length,2);
 await s.capture([b]);
 const two=await s.check();assert.notEqual(two.status,'checked',two.quote?.output?.split('\n').slice(0,2).join(' | '));
});
// The same dead run, when it is the only run or the first, is held (as on main): the fault is only in how later runs are merged.
test('the same dead run as the first run is held, not checked (pinned)', async t=>{
 const s=await service(t),words=long(12000),b=s.add('Long transcript','transcript','## Full Transcript\n\nSpeaker: '+words+'\n');
 await s.capture([b]);await s.write('"'+words+'"');await s.write(INVENTED);
 const r=await s.check();assert.equal(r.status,'held');assert.equal(r.quote.status,'unsupported');
});

// Confirmed: the stamp does not outlive the words. After Adrian confirms a recording transcript, an assistant's segment edit
// clears the review; its own review is stamped as its own; extra fields in the body are ignored; a press at either hash is refused.
test('an assistant cannot change a recording transcript after Adrian confirmed it and keep his confirmation (pinned)', async t=>{
 const h=await http(t,{recording:true}),parentStudyId=randomUUID(),jobId=h.fixture.id;
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented tone subject',operationId:randomUUID()});assert.equal(made.status,200);
 const bindingId=made.body.binding.id,scope={bindingId,parentStudyId},q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId;
 const snapNow=async()=>(await h.call('/transcription/'+jobId+'/snapshot')).body;
 const named=await h.call('/transcription/'+jobId+'/speakers',{expected:(await snapNow()).expected,names:{s1:'Potter',s2:'Visitor'}});assert.equal(named.status,200);
 assert.equal((await h.call('/transcription/'+jobId+'/review',{expected:named.body.expected,confirmed:true})).status,200);
 assert.equal((await h.call('/api/recordings/source',{jobId,expected:(await snapNow()).expected,operationId:randomUUID()},AGENT)).status,403,'keeping a recording as a source is his alone');
 const registered=await h.call('/api/recordings/source',{jobId,expected:(await snapNow()).expected,operationId:randomUUID()});assert.equal(registered.status,200);const source=registered.body.source;
 assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]},AGENT)).status,200);
 const row=async()=>(await h.call('/api/study-draft/capture-sources/list'+q,undefined,AGENT)).body.sources.find(x=>x.id===source.id);
 const shown=await row();assert.equal(shown.eligible,true);assert.equal(shown.role,'source');assert.equal(shown.review.by,'human:adrian');
 // Between the list and the press, the assistant rewrites a segment.
 const snap=await snapNow(),edit=await h.call('/transcription/'+jobId+'/segment',{expected:snap.expected,index:0,text:'The kiln told me to stop selling cups to tourists.',speaker:snap.result.segments[0].speaker},AGENT);assert.equal(edit.status,200);
 let now=await row();assert.equal(now.eligible,false);assert.equal(now.reviewed,false);assert.notEqual(now.hash,shown.hash);
 const press=hash=>h.call('/api/study-draft/capture-sources',{...scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:source.id,sourceHash:hash}]});
 assert.equal((await press(shown.hash)).status,400);assert.equal((await press(now.hash)).status,400);
 // Its own review, with his name typed into the body, is refused; one it made before this change reads as its own.
 assert.equal((await h.call('/transcription/'+jobId+'/review',{expected:(await snapNow()).expected,confirmed:true,by:'human:adrian',actor:'human:adrian',metadata:{review:{by:'human:adrian'}}},AGENT)).status,403);
 now=await row();assert.equal(now.reviewed,false,'the refusal left the words unreviewed');
 stampTranscriptAs(h,AGENT,(await snapNow()).expected.revision);
 now=await row();assert.equal(now.review.by,AGENT);assert.equal(now.eligible,false);assert.equal(now.role,'context');assert.equal((await press(now.hash)).status,409);
 // A speakers call that changes nothing still clears a review (here: Adrian's second one).
 assert.equal((await h.call('/transcription/'+jobId+'/review',{expected:(await snapNow()).expected,confirmed:true})).status,200);assert.equal((await row()).eligible,true);
 assert.equal((await h.call('/transcription/'+jobId+'/speakers',{expected:(await snapNow()).expected,names:{s1:'Potter',s2:'Visitor'}},AGENT)).status,200);
 now=await row();assert.equal(now.eligible,false);assert.equal(now.reviewed,false);
 assert.equal((await h.call('/api/study-draft/read'+q)).body.addedSources,undefined,'nothing was captured');
});

async function note(t,content='An honest note about clay.\n'){
 const h=await http(t),parentStudyId=randomUUID();
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented kiln subject',operationId:randomUUID()});assert.equal(made.status,200);
 const bindingId=made.body.binding.id,projectId=made.body.projectBinding.projectId,scope={bindingId,parentStudyId},q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId;
 const source=(await h.call('/api/sources/import',{files:[{name:'Field note.md',content}]},AGENT)).body.receipts[0].source;
 assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]},AGENT)).status,200);
 assert.equal((await h.call('/api/first-flow/select',{projectKey:parentStudyId,title:'Invented kiln subject',operationId:randomUUID()},AGENT)).status,200);
 const review=(actor,operationId=randomUUID(),extra={})=>h.call('/api/first-flow/source-review',{projectId,operationId,sourceId:source.id,expectedHash:source.hash,reviewed:true,humanDecision:true,...extra},actor);
 const row=async()=>(await h.call('/api/study-draft/capture-sources/list'+q,undefined,AGENT)).body.sources.find(x=>x.id===source.id);
 return {h,projectId,scope,q,source,review,row};
}
// Confirmed: an assistant cannot put Adrian's name on a review of a note.
test('an assistant cannot write the reviewer stamp on a note: extra fields are refused, a replay of his operation changes nothing (pinned)', async t=>{
 const n=await note(t);
 assert.equal((await n.review(AGENT,randomUUID(),{by:'human:adrian'})).status,403);assert.equal((await n.review(AGENT,randomUUID(),{reviewedBy:{by:'human:adrian'}})).status,403);
 assert.equal((await n.review(AGENT)).status,403);assert.equal(JSON.parse(fs.readFileSync(noteFlow(n),'utf8')).reviews[n.source.id],undefined,'nothing was written');
 stampNoteAs(n,AGENT);let row=await n.row();assert.equal(row.review.by,AGENT);assert.equal(row.eligible,false);
 const op=randomUUID();assert.equal((await n.review('human:adrian',op)).status,200);row=await n.row();assert.equal(row.review.by,'human:adrian');assert.equal(row.eligible,true);assert.equal(row.role,'context','a note is never the quote source');
 assert.equal((await n.review(AGENT,op)).status,403,'an assistant repeating his operation is refused before the replay');assert.equal((await n.row()).review.by,'human:adrian','and leaves his stamp');
});
// Finding 3 (should fix). An assistant that reviews the same bytes after Adrian replaces his stamp with its own, so material
// he confirmed reads "Not confirmed by you yet" and he must confirm it again. It cannot gain anything; it can take his away.
test('an assistant reviewing the same bytes after Adrian is refused and does not remove his confirmation',async t=>{
 const n=await note(t);assert.equal((await n.review('human:adrian')).status,200);assert.equal((await n.row()).eligible,true);
 assert.equal((await n.review(AGENT)).status,403);
 const row=await n.row();assert.equal(row.review.by,'human:adrian');assert.equal(row.eligible,true);
});
// Finding 2 (should fix). The material record's review now always carries by and at, null when nobody was recorded. The
// assistant bridge pins the whole record when a suggestion is requested and compares it at acceptance
// (study-mcp-bridge.mjs materialFreshness), so a suggestion waiting when this release lands reads stale. A review made
// before stamps existed must read with the shape it had.
test('a review made before reviews were stamped reads with the same shape as before',async t=>{
 const n=await note(t);assert.equal((await n.review('human:adrian')).status,200);
 const flowFile=fs.readdirSync(path.join(n.h.dataDir,'first-flow')).map(d=>path.join(n.h.dataDir,'first-flow',d,'flow.json')).find(f=>fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).projectId===n.projectId);
 const flow=JSON.parse(fs.readFileSync(flowFile,'utf8'));delete flow.reviewedBy;fs.writeFileSync(flowFile,JSON.stringify(flow,null,2));
 const record=(await n.h.call('/api/first-flow/material-context?projectId='+n.projectId)).body.records.find(r=>r.id===n.source.id);
 assert.deepEqual(Object.keys(record.review).sort(),['basis','hash','state']);
});

// Confirmed: receipts. A passing receipt reads stale after a second capture; the receipt before the first capture was held.
test('a receipt made before a capture, or before a second capture, reads stale (pinned)', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n'),b=s.add('Note','markdown','Cobalt comes from a small blue mine.\n');
 await s.write('"The clay remembers every hand."');
 assert.equal((await s.check()).status,'held');await s.capture([a]);
 let now=await s.checks.read(s.scope);assert.equal(now.status,'stale');
 assert.equal((await s.check()).status,'checked');assert.equal((await s.checks.read(s.scope)).status,'checked');
 await s.capture([b]);now=await s.checks.read(s.scope);assert.equal(now.status,'stale');assert.match(now.staleReason,/earlier draft or source revision/);
});

// Notes, pinned so they are not read as stronger than they are.
// (a) A captured context file is the guard's only file in its own run, so words inside an Obsidian comment (%% %%) in a note
// count as support. On main a CONTEXT file's comments are removed before matching. He confirmed those bytes, so this is his choice.
test('words inside a comment in a captured note do not support a quote, as for a context file on main', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n'),b=s.add('Note','markdown','Plain line.\n\n%% the potter never said the glaze sings at night %%\n');
 await s.capture([a,b]);await s.write('"the glaze sings at night"');
 assert.notEqual((await s.check()).status,'checked');
});
// (b) The pinned guard, unchanged from main: a quote made only of [bracketed] phrases matches any file that has enough words.
test('a quote made only of bracketed phrases passes against any captured file (note: the pinned guard, same on main)', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n');
 await s.capture([a]);await s.write('"[The kiln told me to] [stop selling cups to tourists]"');
 assert.equal((await s.check()).status,'checked');
});
