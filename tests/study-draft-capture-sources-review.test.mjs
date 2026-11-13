// Adversarial review of piece A (study-draft.capture-sources). Invented content only. Each test names the finding it
// proves in docs/plans/version-two-briefs/v2-12-capture-sources.md, "Code review of piece A". Every test passes: the
// corrections the review asked for are made, and the rest pin what the review confirmed.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {createStudyDraftChecks} from '../runtime/services/study-draft-checks.mjs';import {withActor} from '../runtime/services/actor.mjs';import {digest} from '../runtime/services/files.mjs';

const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn);
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);

async function http(t,{recording=false}={}){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review-http-'))),dataDir=path.join(dir,'data'),roots={vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')};for(const r of Object.values(roots))fs.mkdirSync(r,{recursive:true});
 const fixture=recording?createWorkshopFixture(dataDir):null;if(fixture)fs.writeFileSync(path.join(fixture.output,'transcribe.json'),JSON.stringify(fixture.original));
 const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:roots,researchEnabled:false,sharedArticles:true,...(recording?{transcriptionRuntime:{python:'/no-interpreter'}}:{})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,actor='human:adrian')=>{const response=await fetch(base+route,{...(body===undefined?{headers:{'x-ar-actor':actor}}:{method:'POST',headers:{'content-type':'application/json','x-ar-actor':actor},body:JSON.stringify(body)})});let json=null;try{json=await response.json();}catch{}return {status:response.status,body:json};};
 return {dataDir,call,fixture};
}

// Review finding 1 (must fix). Every step before Adrian's one press is open to an assistant: write a file whose front
// matter says "kind: transcript", attach it, mark it reviewed. The list he is shown says transcript, reviewed, eligible,
// role source. One press, and Check passes on a sentence nobody said. Measured over HTTP here and on npm run demo.
test('an assistant cannot make Check trust words it wrote, even with Adrian pressing once', async t=>{
 const h=await http(t),AGENT='agent:codex',parentStudyId=randomUUID();
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented kiln subject',operationId:randomUUID()});assert.equal(made.status,200,JSON.stringify(made.body));
 const bindingId=made.body.binding.id,projectId=made.body.projectBinding.projectId,scope={bindingId,parentStudyId},q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId;
 const invented='---\nkind: transcript\ntitle: Interview with the potter\nreview_status: reviewed\n---\n\n## Full Transcript\n\n**Potter:** The kiln told me to stop selling cups to tourists.\n';
 const imported=await h.call('/api/sources/import',{files:[{name:'Interview with the potter.md',content:invented}]},AGENT);assert.equal(imported.status,200,JSON.stringify(imported.body));
 const source=imported.body.receipts[0].source;assert.equal(source.kind,'transcript','front matter alone makes it a transcript');
 assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]},AGENT)).status,200);
 assert.equal((await h.call('/api/first-flow/select',{projectKey:parentStudyId,title:'Invented kiln subject',operationId:randomUUID()},AGENT)).status,200);
 const refused=await h.call('/api/first-flow/source-review',{projectId,operationId:randomUUID(),sourceId:source.id,expectedHash:source.hash,reviewed:true,humanDecision:true},AGENT);
 assert.equal(refused.status,403,'an assistant may no longer mark material reviewed');
 // A review an assistant made before that change is made by writing the old stamp, so "Reviewed by an assistant" stays tested.
 const stampFile=fs.readdirSync(path.join(h.dataDir,'first-flow')).map(n=>path.join(h.dataDir,'first-flow',n,'flow.json')).find(f=>fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).projectId===projectId);
 const held=JSON.parse(fs.readFileSync(stampFile,'utf8'));assert.equal(held.reviews[source.id],undefined,'the refusal wrote nothing');held.reviews[source.id]=source.hash;held.reviewedBy={...(held.reviewedBy||{}),[source.id]:{by:AGENT,at:new Date().toISOString(),hash:source.hash}};fs.writeFileSync(stampFile,JSON.stringify(held));
 const row=(await h.call('/api/study-draft/capture-sources/list'+q)).body.sources.find(s=>s.id===source.id);
 assert.equal(row.reviewed,true);assert.equal(row.review.by,AGENT);assert.equal(row.eligible,false);assert.match(row.reason,/Not confirmed by you yet/);assert.equal(row.role,'context','never source from its own kind');
 const done=await h.call('/api/study-draft/capture-sources',{...scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:source.id,sourceHash:source.hash}]});
 assert.equal(done.status,409,JSON.stringify(done.body));assert.match(JSON.stringify(done.body),/Not confirmed by you yet/);
 const read=(await h.call('/api/study-draft/read'+q)).body;assert.equal(read.addedSources,undefined);
 const saved=await h.call('/api/study-draft/save',{...scope,expected:read.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'"The kiln told me to stop selling cups to tourists."'}]});assert.equal(saved.status,200);
 const ran=await h.call('/api/study-draft/check',{...scope,operationId:randomUUID(),expected:saved.body.expected});assert.equal(ran.status,200);
 assert.notEqual(ran.body.status,'checked');assert.equal(ran.body.status,'held');
 // A review with no recorded reviewer (made before reviews were stamped) is no better: the same refusal.
 const flowFile=fs.readdirSync(path.join(h.dataDir,'first-flow')).map(n=>path.join(h.dataDir,'first-flow',n,'flow.json')).find(f=>fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).projectId===projectId);
 const flow=JSON.parse(fs.readFileSync(flowFile,'utf8'));assert.ok(flow.reviewedBy[source.id]);delete flow.reviewedBy;fs.writeFileSync(flowFile,JSON.stringify(flow));
 const old=(await h.call('/api/study-draft/capture-sources/list'+q)).body.sources.find(s=>s.id===source.id);assert.equal(old.eligible,false);assert.equal(old.review.by,'not recorded');assert.match(old.reason,/Not confirmed by you yet/);
});

// The honest path: Adrian confirms a recording transcript himself, then presses. A true quote passes, an invented one is found.
test('Adrian confirms a recording transcript and presses; a true quote passes and an invented one is found', async t=>{
 const h=await http(t,{recording:true}),parentStudyId=randomUUID(),jobId=h.fixture.id;
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented tone subject',operationId:randomUUID()});assert.equal(made.status,200,JSON.stringify(made.body));
 const bindingId=made.body.binding.id,scope={bindingId,parentStudyId},q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId;
 let snap=(await h.call('/transcription/'+jobId+'/snapshot')).body;assert.ok(snap.expected,JSON.stringify(snap));
 // An assistant may name speakers but may not confirm; a confirmation it made before this change is made by writing the old stamp.
 const named=await h.call('/transcription/'+jobId+'/speakers',{expected:snap.expected,names:{s1:'Potter',s2:'Visitor'}},'agent:codex');assert.equal(named.status,200,JSON.stringify(named.body));
 const agentReview=await h.call('/transcription/'+jobId+'/review',{expected:named.body.expected,confirmed:true},'agent:codex');assert.equal(agentReview.status,403,JSON.stringify(agentReview.body));
 {const tf=path.join(h.fixture.output,'transcript.json'),bf=path.join(h.fixture.output,'.corrections','base.json'),doc=JSON.parse(fs.readFileSync(tf,'utf8'));doc.metadata.review={status:'reviewed',reviewedAt:new Date().toISOString(),inspectedRevision:named.body.expected.revision,by:'agent:codex'};fs.writeFileSync(tf,JSON.stringify(doc,null,2));const base=JSON.parse(fs.readFileSync(bf,'utf8'));base.json=fs.readFileSync(tf,'utf8');fs.writeFileSync(bf,JSON.stringify(base,null,2));}
 const snapNow=async()=>(await h.call('/transcription/'+jobId+'/snapshot')).body;
 const registered=await h.call('/api/recordings/source',{jobId,expected:(await snapNow()).expected,operationId:randomUUID()});assert.equal(registered.status,200,JSON.stringify(registered.body));const source=registered.body.source;
 assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]})).status,200);
 let row=(await h.call('/api/study-draft/capture-sources/list'+q)).body.sources.find(x=>x.id===source.id);
 assert.equal(row.reviewed,true);assert.equal(row.review.by,'agent:codex');assert.equal(row.eligible,false);assert.match(row.reason,/Not confirmed by you yet/);assert.equal(row.role,'context');
 assert.equal((await h.call('/api/study-draft/capture-sources',{...scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:source.id,sourceHash:row.hash}]})).status,409);
 // Adrian confirms it himself: speakers, then review with the revision he was shown.
 const again=await h.call('/transcription/'+jobId+'/speakers',{expected:(await snapNow()).expected,names:{s1:'Potter',s2:'Visitor'}});assert.equal(again.status,200,JSON.stringify(again.body));
 const mine=await h.call('/transcription/'+jobId+'/review',{expected:again.body.expected,confirmed:true});assert.equal(mine.status,200,JSON.stringify(mine.body));
 const stamped=JSON.parse(fs.readFileSync(path.join(h.fixture.output,'transcript.json'),'utf8')).metadata.review;assert.equal(stamped.by,'human:adrian');assert.equal(stamped.status,'reviewed');assert.ok(stamped.reviewedAt);
 row=(await h.call('/api/study-draft/capture-sources/list'+q)).body.sources.find(x=>x.id===source.id);
 assert.equal(row.eligible,true,JSON.stringify(row));assert.equal(row.role,'source');assert.equal(row.review.by,'human:adrian');assert.equal(row.review.basis,'canonical-recording-review');
 const done=await h.call('/api/study-draft/capture-sources',{...scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:source.id,sourceHash:row.hash}]});assert.equal(done.status,200,JSON.stringify(done.body));assert.equal(done.body.captured[0].role,'source');
 const write=async raw=>{const read=(await h.call('/api/study-draft/read'+q)).body,saved=await h.call('/api/study-draft/save',{...scope,expected:read.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw}]});assert.equal(saved.status,200,JSON.stringify(saved.body));return saved.body;};
 const check=async d=>{const r=await h.call('/api/study-draft/check',{...scope,operationId:randomUUID(),expected:d.expected});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const good=await check(await write('"The first sample uses a low fixture tone."'));assert.equal(good.status,'checked',JSON.stringify(good.issues));
 const bad=await check(await write('"The kiln told me to stop selling cups to tourists."'));assert.equal(bad.status,'needs-review');assert.ok(bad.issues.some(i=>/NOT FOUND/.test(i.message)));
});

// Service fixture: a subject begun the version two way, with a fake of the material authority.
async function service(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Object.assign(Error('No originals.'),{status:404});}}}),parentStudyId='subject-'+randomUUID();
 const doc=await human(()=>drafts.createCollection({parentStudyId,title:'Invented subject',operationId:randomUUID()})),scope={bindingId:doc.binding.id,parentStudyId};
 const records=new Map(),add=(title,kind,raw)=>{const id=randomUUID(),hash=digest('library:'+raw);records.set(id,{id,title,kind,hash,eligible:true,review:{state:'reviewed',hash,by:'human:adrian',at:'2026-11-12T10:00:00.000Z',basis:kind==='transcript'?'canonical-recording-review':'exact-first-flow-source-use-review'},raw,bodyHash:digest(raw)});return id;};
 const lib={async context(_,{sourceIds}={}){return {records:(sourceIds||[...records.keys()]).map(id=>structuredClone(records.get(id)))};}};
 const capture=(ids,expectedSourcesHash=null)=>human(()=>drafts.captureSources({...scope,operationId:randomUUID(),expectedSourcesHash,sources:ids.map(id=>({sourceId:id,sourceHash:records.get(id).hash}))},{material:lib}));
 const checks=createStudyDraftChecks({dataDir,drafts,outputs:null});
 const write=async raw=>{const d=await drafts.read(scope);return human(()=>drafts.save({...scope,expected:d.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw}]}));};
 const check=async()=>{const d=await drafts.read(scope);return checks.run({...scope,operationId:randomUUID(),expected:d.expected});};
 const room=path.join(dataDir,'study-draft-copies','copies',scope.bindingId),bindingFile=()=>JSON.parse(fs.readFileSync(path.join(dataDir,'study-draft-copies','bindings',fs.readdirSync(path.join(dataDir,'study-draft-copies','bindings'))[0]),'utf8'));
 return {dataDir,drafts,scope,add,capture,write,check,room,bindingFile};
}

// Review answer on the straddle question: measured on a new subject...
test('a quote straddling the join of two captured files does not pass', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: We wait for the glaze to settle like dusk\n'),b=s.add('Note','markdown','Cobalt comes from a small blue mine.\n');
 await s.capture([a,b]);await s.write('"settle like dusk cobalt comes from a small blue mine."\n');
 assert.notEqual((await s.check()).status,'checked');
});
// ...and on a draft opened from a vault original before this change: the same join, so the gap is not new.
test('the straddle already passes on an old draft whose locked capture holds an SRC and a CONTEXT (pinned: unchanged by piece A)', async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review-old-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const rec=(id,role,p,raw)=>({id,role,path:p,raw,hash:digest(raw)});
 const original={id:'vault-original',parentStudyKey:'old-subject',partKey:'article',title:'Old',records:[rec('dev','draft','Workflow/3-Develop/DEV - Old.md','Opening words.\n'),rec('src','source','Workflow/1-Gather/SRC - Old.md','## Full Transcript\n\nSpeaker: We wait for the glaze to settle like dusk\n'),rec('ctx','context','Workflow/1-Gather/CONTEXT - Old.md','Cobalt comes from a small blue mine.\n')]};
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>structuredClone(original)}});
 const doc=await drafts.openCopy({originalId:'vault-original',originalHash:original.records[0].hash,parentStudyId:'old-subject',operationId:randomUUID()}),scope={bindingId:doc.binding.id,parentStudyId:'old-subject'};
 const saved=await human(()=>drafts.save({...scope,expected:doc.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'"settle like dusk cobalt comes from a small blue mine."'}]}));
 const r=await createStudyDraftChecks({dataDir,drafts,outputs:null}).run({...scope,operationId:randomUUID(),expected:saved.expected});
 assert.equal(r.status,'checked','an old draft passes a quote made of the SRC\'s last words and the CONTEXT\'s first words');
 assert.equal(Object.hasOwn(await drafts.read(scope),'addedSources'),false);
});

// Confirmed: a truncated, emptied or wrong-type added-sources file fails closed; nothing in it is trusted, Write still saves.
test('a truncated, emptied or replaced added-sources file is never trusted', async t=>{
 for(const damage of ['truncate','empty','directory','symlink','agent-actor']){
  const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n');await s.write('"The clay remembers every hand."\n');await s.capture([a]);
  const file=path.join(s.room,'added-sources.json'),raw=fs.readFileSync(file,'utf8');fs.chmodSync(file,0o600);
  if(damage==='truncate')fs.writeFileSync(file,raw.slice(0,Math.floor(raw.length/2)));
  if(damage==='empty')fs.writeFileSync(file,'');
  if(damage==='directory'){fs.rmSync(file);fs.mkdirSync(file);}
  if(damage==='symlink'){fs.writeFileSync(path.join(s.room,'elsewhere.json'),raw);fs.rmSync(file);fs.symlinkSync(path.join(s.room,'elsewhere.json'),file);}
  if(damage==='agent-actor'){const v=JSON.parse(raw);v.entries[0].actor='agent:codex';fs.writeFileSync(file,JSON.stringify(v));}
  const read=await s.drafts.read(s.scope);assert.match(read.addedSources.error,/nothing was used/,damage);
  await assert.rejects(s.check(),e=>e.status===409,damage);
  const saved=await human(()=>s.drafts.save({...s.scope,expected:read.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Still writing.'}]}));assert.match(saved.raw,/Still writing/,damage);
 }
});

// Note: the chain has no secret, so a writer with file access who recomputes it is trusted (the same strength as the
// locked manifest, which is pinned only by a hash in the binding file). The builder's forged-record test uses wrong
// hashes only. Pinned so the claim in the brief is not read as stronger than it is.
test('a forged record with a correctly recomputed chain is read as genuine (trust model note)', async t=>{
 const s=await service(t);await s.write('"Planted words about glaze."\n');
 const opId=randomUUID(),name='added-'+opId+'-0.md',raw='## Full Transcript\n\nSpeaker: Planted words about glaze.\n';fs.writeFileSync(path.join(s.room,'capture',name),raw,{mode:0o400});
 const sourceId=randomUUID(),copiedHash=digest(raw),b=s.bindingFile();
 const e={sequence:1,operationId:opId,inputHash:'0'.repeat(64),actor:'agent:codex',capturedAt:new Date().toISOString(),id:'added:'+sourceId+':'+copiedHash.slice(0,12),sourceId,role:'source',kind:'transcript',title:'Planted',sourcePath:'x',libraryHash:copiedHash,review:{state:'reviewed'},copiedName:name,copiedHash,previousHash:b.captureHash};
 e.entryHash=digest(stable(e));
 fs.writeFileSync(path.join(s.room,'added-sources.json'),JSON.stringify({schema:'ar-create.study-draft-added-sources.v1',bindingId:s.scope.bindingId,parentStudyId:s.scope.parentStudyId,captureHash:b.captureHash,entries:[e]}));
 assert.equal((await s.check()).status,'checked');
});

// Review finding 4 (should fix): every draft read and every Write save reply now carries the full text of every
// added source (up to 4 MB), and every superseded copy is read and hashed on each read.
test('a draft read does not carry the full text of added sources', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\n'+'Speaker: words. '.repeat(1000)+'\n');await s.capture([a]);
 const read=await s.drafts.read(s.scope);assert.equal(read.addedSources.records[0].raw,undefined);
});

// Review finding 5 (should fix): a source captured and then set aside keeps counting for Check (Decision 6), but the
// list says "You set this aside, so it is not used." Piece B will show that sentence beside a Check that still reads it.
test('the list does not say a captured source is unused while Check still reads it', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n');await s.write('"The clay remembers every hand."\n');await s.capture([a]);
 const lib={async context(){return {records:[{id:a,title:'Interview',kind:'transcript',hash:'0'.repeat(64),eligible:false,setAside:true,review:{state:'unreviewed'},reason:'set aside'}]};}};
 const row=(await s.drafts.listCaptureSources(s.scope,{material:lib})).sources[0];
 const r=await s.check();assert.equal(r.status,'checked');assert.ok(r.proof.sources.some(x=>x.id.startsWith('added:'+a)),'Check still reads it');
 assert.doesNotMatch(row.reason||'',/not used/);
});

// Corrections after review: who confirmed, and bytes confirmed, decide eligibility; a damaged record is named in plain words.
test('only a human confirmation on these exact bytes makes material eligible; other actors and changed bytes do not', async t=>{
 const s=await service(t);
 const records=new Map(),mk=(by,hashOverride,basis='canonical-recording-review')=>{const id=randomUUID(),raw='## Full Transcript\n\nSpeaker: Words '+id+'\n',hash=digest('library:'+raw);records.set(id,{id,title:'T '+by,kind:'transcript',hash,eligible:true,review:{state:'reviewed',hash:hashOverride||hash,...(by?{by,at:'2026-11-12T10:00:00.000Z'}:{}),basis},raw,bodyHash:digest(raw)});return id;};
 const lib2={async context(_,{sourceIds}={}){return {records:(sourceIds||[...records.keys()]).map(id=>structuredClone(records.get(id)))};}};
 const refused=[mk('agent:codex'),mk('cron:nightly'),mk('import:notes'),mk(null),mk('human:adrian','0'.repeat(64))],fine=mk('human:adrian'),ctx=mk('human:adrian',undefined,'exact-first-flow-source-use-review');
 const list=await s.drafts.listCaptureSources(s.scope,{material:lib2});
 for(const id of refused){const row=list.sources.find(x=>x.id===id);assert.equal(row.eligible,false,row.title);assert.match(row.reason,/Not confirmed by you yet/);assert.equal(row.role,'context');
  await assert.rejects(human(()=>s.drafts.captureSources({...s.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:id,sourceHash:records.get(id).hash}]},{material:lib2})),e=>e.status===409&&/Not confirmed by you yet/.test(e.message),row.title);}
 assert.equal(list.sources.find(x=>x.id===fine).role,'source');assert.equal(list.sources.find(x=>x.id===ctx).role,'context');assert.equal(list.sources.find(x=>x.id===ctx).eligible,true);
 const done=await human(()=>s.drafts.captureSources({...s.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:fine,sourceHash:records.get(fine).hash},{sourceId:ctx,sourceHash:records.get(ctx).hash}]},{material:lib2}));
 assert.deepEqual(done.captured.map(c=>c.role),['source','context']);
});

test('a damaged added-sources file is named in plain words by the list, and nothing is repaired', async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n');await s.capture([a]);
 const file=path.join(s.room,'added-sources.json');fs.chmodSync(file,0o600);fs.writeFileSync(file,'{');
 const list=await s.drafts.listCaptureSources(s.scope,{material:{async context(){return {records:[]};}}});
 assert.equal(list.canCapture,false);assert.equal(list.damaged,true);assert.match(list.addedError,/changed outside the app/);assert.match(list.reason,/changed outside the app/);assert.equal(fs.readFileSync(file,'utf8'),'{');
});
