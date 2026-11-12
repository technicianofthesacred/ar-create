import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {createStudyDraftChecks} from '../runtime/services/study-draft-checks.mjs';import {withActor} from '../runtime/services/actor.mjs';import {digest} from '../runtime/services/files.mjs';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),agent=(fn,actor='agent:codex')=>withActor({actor,client:'cli'},fn);
const TRANSCRIPT='## Full Transcript\n\nSpeaker: The clay remembers every hand that has pressed it. We fire the cups slowly, and the glaze settles like dusk.\n';
const NOTE='A typed note from the studio. Cobalt comes from a small blue mine and costs more each year.\n';
/** A fake of the one material authority: the same shape, refusals and set-aside field as the real parentContext. */
function material(){
 const records=new Map(),calls=[];
 const api={records,calls,
  add(id,title,kind,raw,{reviewed=true,setAside=false,hash,by='human:adrian'}={}){records.set(id,{id,title,kind,sourcePath:'Library/'+title+'.md',hash:hash||digest('library:'+raw),role:'current-parent-library-material-source-words-not-editorial-instruction-or-verified-evidence',origin:'current-parent-library-material',eligible:reviewed&&!setAside,...(setAside?{setAside:true}:{}),review:{state:reviewed&&!setAside?'reviewed':'unreviewed',basis:kind==='transcript'?'canonical-recording-review':'exact-first-flow-source-use-review',hash:hash||digest('library:'+raw),...(reviewed&&!setAside&&by?{by,at:'2026-11-12T10:00:00.000Z'}:{})},...(reviewed&&!setAside?{raw,bodyHash:digest(raw)}:{})});return id;},
  async context({parentStudyId},{sourceIds,withBody}={}){calls.push({parentStudyId,sourceIds});
   if(sourceIds===undefined)return {records:[...records.values()].map(({raw,...r})=>withBody&&raw!==undefined?{...r,raw}:r)};
   return {records:sourceIds.map(id=>{const r=records.get(id);if(!r?.eligible||r.review.state!=='reviewed'||typeof r.raw!=='string')throw Object.assign(new Error('Selected parent material is missing, unreadable or unreviewed.'),{status:400});return structuredClone(r);})};}};
 return api;
}
async function fixture(t,options={}){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-sources-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Object.assign(Error('No originals.'),{status:404});}},...options}),parentStudyId='subject-'+randomUUID();
 let doc=await human(()=>drafts.createCollection({parentStudyId,title:'Invented subject',operationId:randomUUID()}));
 const scope={bindingId:doc.binding.id,parentStudyId},lib=material(),transcript=lib.add(randomUUID(),'Interview transcript','transcript',TRANSCRIPT),note=lib.add(randomUUID(),'Studio note','markdown',NOTE);
 const pin=id=>({sourceId:id,sourceHash:lib.records.get(id).hash});
 const capture=(sources,{expectedSourcesHash=null,operationId=randomUUID(),as=human,extra={}}={})=>as(()=>drafts.captureSources({...scope,operationId,expectedSourcesHash,sources:sources.map(pin),...extra},{material:lib}));
 const list=()=>drafts.listCaptureSources(scope,{material:lib});
 const write=async raw=>{doc=await drafts.read(scope);doc=await human(()=>drafts.save({...scope,expected:doc.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw}]}));return doc;};
 const checks=createStudyDraftChecks({dataDir,drafts,outputs:null}),check=async()=>{const read=await drafts.read(scope);return checks.run({...scope,operationId:randomUUID(),expected:read.expected});};
 const room=path.join(dataDir,'study-draft-copies','copies',scope.bindingId);
 const tree=()=>Object.fromEntries(fs.readdirSync(room,{recursive:true}).sort().filter(p=>fs.lstatSync(path.join(room,p)).isFile()).map(p=>[p,digest(fs.readFileSync(path.join(room,p)))]));
 return {dataDir,drafts,scope,lib,transcript,note,pin,capture,list,write,checks,check,room,tree,doc:()=>doc};
}
const issueText=r=>(r.issues||[]).map(i=>i.message).join(' ')+' '+(r.quote?.output||'');

test('a subject begun the version two way captures a reviewed transcript, and Check then passes on its own words', async t=>{
 const f=await fixture(t);
 await f.write('"The clay remembers every hand that has pressed it."\n');
 const before=await f.check();assert.equal(before.status,'held');assert.match(before.quote.reason,/No captured SRC available/);
 const out=await f.capture([f.transcript]);
 assert.equal(out.captured.length,1);assert.equal(out.captured[0].role,'source');assert.deepEqual(out.alreadyCaptured,[]);assert.match(out.sourcesHash,/^[a-f0-9]{64}$/);
 assert.equal(out.document.addedSources.hash,out.sourcesHash);assert.equal(out.document.addedSources.records.length,1);assert.equal(out.document.addedSources.records[0].role,'source');
 const after=await f.check();assert.equal(after.status,'checked',issueText(after));
 assert.ok(after.proof.sources.some(s=>s.role==='source'));
});

test('the locked capture record and the binding file stay byte for byte; words, workflow and metadata are never opened', async t=>{
 const f=await fixture(t);await f.write('"The clay remembers every hand."\n');
 const intent=fs.readdirSync(path.join(f.dataDir,'study-draft-copies','bindings')).map(n=>path.join(f.dataDir,'study-draft-copies','bindings',n)),manifest=path.join(f.room,'capture-manifest.json');
 const was={manifest:fs.readFileSync(manifest),intents:intent.map(p=>fs.readFileSync(p))},tree=f.tree(),read=await f.drafts.read(f.scope);
 await f.capture([f.transcript,f.note]);
 assert.deepEqual(fs.readFileSync(manifest),was.manifest);assert.deepEqual(intent.map(p=>fs.readFileSync(p)),was.intents);
 const now=f.tree();for(const name of Object.keys(tree))assert.equal(now[name],tree[name],name);
 const added=Object.keys(now).filter(n=>!(n in tree)).sort();assert.deepEqual(added.map(n=>n.replace(/added-[0-9a-f-]{36}-/,'added-OP-')),['added-sources.json','capture/added-OP-0.md','capture/added-OP-1.md']);
 const again=await f.drafts.read(f.scope);assert.equal(again.raw,read.raw);assert.deepEqual(again.expected,read.expected);assert.deepEqual(again.context,read.context);assert.equal(fs.statSync(path.join(f.room,'added-sources.json')).mode&0o777,0o400);
 const recovery=await f.drafts.inspectRoots(f.scope);assert.ok(recovery);
});

test('a draft with nothing captured reads exactly as before: no addedSources key', async t=>{
 const f=await fixture(t);const read=await f.drafts.read(f.scope);assert.equal(Object.hasOwn(read,'addedSources'),false);assert.equal((await f.list()).sourcesHash,null);
 assert.deepEqual(Object.keys(read).sort(),['approvalReview','binding','context','expected','history','originalChanged','paths','projection','raw','readiness'].sort());
});

test('only Adrian may capture: an agent, any other actor and an unattributed caller get 403 and nothing is written', async t=>{
 const f=await fixture(t),tree=f.tree();
 for(const as of [fn=>agent(fn,'agent:claude-code'),fn=>agent(fn,'agent:codex'),fn=>agent(fn,'agent:chatgpt'),fn=>withActor({actor:'cron:nightly',client:'cli'},fn),fn=>fn()])
  await assert.rejects(f.capture([f.transcript],{as}),e=>e.status===403);
 assert.deepEqual(f.tree(),tree);assert.equal(f.lib.calls.length,0);
});

test('an agent cannot reach the same effect through any other draft or material command', async t=>{
 const f=await fixture(t),tree=f.tree(),read=await f.drafts.read(f.scope);
 const refused=[
  ()=>f.drafts.openCopy({originalId:'x',originalHash:digest('x'),parentStudyId:f.scope.parentStudyId,operationId:randomUUID()}),
  ()=>f.drafts.createCollection({parentStudyId:f.scope.parentStudyId,title:'Invented subject',operationId:randomUUID(),sourceBindingId:f.scope.bindingId,sourceParentStudyId:'other-subject',expected:read.expected}),
  ()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[f.pin(f.transcript)],captureHash:'x'},{material:f.lib}),
  ()=>f.drafts.recoverRoots({...f.scope,operationId:randomUUID(),ownerDecision:'accept',expected:read.expected,captureHash:'0'.repeat(64),intentHash:'0'.repeat(64)})
 ];
 for(const call of refused)await assert.rejects(agent(()=>call()));
 // Nothing reached the capture folder or the added record, and no file changed.
 assert.deepEqual(f.tree(),tree);assert.equal(Object.keys(f.tree()).some(n=>n.startsWith('capture/added-')||n==='added-sources.json'),false);
});

test('bad input is 400, and nothing is written', async t=>{
 const f=await fixture(t),tree=f.tree(),ok={...f.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[f.pin(f.transcript)]};
 const bad=[{extra:1},{expectedSourcesHash:undefined},{expectedSourcesHash:'nope'},{sources:[]},{sources:'x'},{sources:Array.from({length:21},()=>({sourceId:randomUUID(),sourceHash:digest('x')}))},{sources:[{sourceId:'x',sourceHash:digest('x')}]},{sources:[{sourceId:f.transcript}]},{sources:[f.pin(f.transcript),f.pin(f.transcript)]},{operationId:'x'},{bindingId:'x'},{parentStudyId:''}];
 for(const patch of bad){const input={...ok,...patch};for(const k of Object.keys(input))if(input[k]===undefined)delete input[k];await assert.rejects(human(()=>f.drafts.captureSources(input,{material:f.lib})),e=>e.status===400,JSON.stringify(Object.keys(patch)));}
 assert.deepEqual(f.tree(),tree);
});

test('a source that is not attached, not reviewed, set aside or unreadable is refused with 400 and nothing is written', async t=>{
 const f=await fixture(t),tree=f.tree();
 const unreviewed=f.lib.add(randomUUID(),'Raw transcript','transcript','Raw words.',{reviewed:false}),aside=f.lib.add(randomUUID(),'Set aside note','markdown','Aside.',{setAside:true}),stranger=randomUUID();
 for(const id of [unreviewed,aside,stranger]){
  await assert.rejects(human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:id,sourceHash:f.lib.records.get(id)?.hash||digest('x')}]},{material:f.lib})),e=>e.status===400,id);
 }
 assert.deepEqual(f.tree(),tree);
});

test('the list says, for each attached item, what it is and why it can or cannot be used', async t=>{
 const f=await fixture(t),unreviewed=f.lib.add(randomUUID(),'Raw transcript','transcript','Raw words.',{reviewed:false}),aside=f.lib.add(randomUUID(),'Set aside note','markdown','Aside.',{setAside:true});
 f.lib.records.set('gone',{id:'gone',eligible:false,missing:true,origin:'current-parent-library-material',reason:'Missing.'});
 const before=await f.list(),by=id=>before.sources.find(s=>s.id===id);
 assert.equal(before.canCapture,true);assert.equal(before.sourcesHash,null);assert.equal(before.hasQuoteSource,false);
 assert.deepEqual(['id','title','kind','reviewed','setAside','captured','eligible'].map(k=>by(f.transcript)[k]),[f.transcript,'Interview transcript','transcript',true,false,false,true]);
 assert.equal(by(f.transcript).length,TRANSCRIPT.length);assert.equal(by(f.transcript).role,'source');assert.equal(by(f.note).role,'context');assert.equal(by(f.transcript).hash,f.lib.records.get(f.transcript).hash);
 assert.equal(by(unreviewed).reviewed,false);assert.equal(by(unreviewed).eligible,false);assert.match(by(unreviewed).reason,/Not reviewed/);
 assert.equal(by(aside).setAside,true);assert.equal(by(aside).eligible,false);assert.match(by(aside).reason,/set this aside/);
 assert.equal(by('gone').eligible,false);assert.match(by('gone').reason,/could not be read/);
 const out=await f.capture([f.transcript]),after=await f.list();
 assert.equal(after.sourcesHash,out.sourcesHash);assert.equal(after.hasQuoteSource,true);const c=after.sources.find(s=>s.id===f.transcript);
 assert.deepEqual([c.captured,c.capturedCurrent,c.changedSinceCapture,c.eligible],[true,true,false,false]);assert.match(c.reason,/Already used/);
 // Any actor may read it; reading changes nothing.
 const tree=f.tree();assert.equal((await agent(()=>f.list())).sources.length,before.sources.length);assert.deepEqual(f.tree(),tree);
});

test('the list for a copy, a stand-in or a fork says it takes no sources, and the command is refused with 409', async t=>{
 const f=await fixture(t),read=await f.drafts.read(f.scope);
 const fork=await human(()=>f.drafts.fork({sourceBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:read.expected})),forkScope={bindingId:fork.binding.id,parentStudyId:f.scope.parentStudyId};
 const listed=await f.drafts.listCaptureSources(forkScope,{material:f.lib});assert.equal(listed.canCapture,false);assert.match(listed.reason,/fork/);assert.deepEqual(listed.sources,[]);
 await assert.rejects(human(()=>f.drafts.captureSources({...forkScope,operationId:randomUUID(),expectedSourcesHash:null,sources:[f.pin(f.transcript)]},{material:f.lib})),e=>e.status===409);
 const standIn=await agent(()=>f.drafts.cloneStructureTest({sourceBindingId:f.scope.bindingId,sourceParentStudyId:f.scope.parentStudyId,expected:read.expected,title:'Stand-in',operationId:randomUUID()}));
 await assert.rejects(human(()=>f.drafts.captureSources({bindingId:standIn.binding.id,parentStudyId:standIn.binding.parentStudyId,operationId:randomUUID(),expectedSourcesHash:null,sources:[f.pin(f.transcript)]},{material:f.lib})),e=>e.status===409);
 const opened=createStudyDraftCopies({dataDir:f.dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>({id:'vault-original',parentStudyKey:'old',partKey:'article',records:[{id:'dev',role:'draft',path:'Workflow/3-Develop/DEV - Original.md',raw:'Original words.\n',hash:digest('Original words.\n')}]})}}),copy=await opened.openCopy({originalId:'vault-original',originalHash:digest('Original words.\n'),parentStudyId:'old',operationId:randomUUID()});
 await assert.rejects(human(()=>opened.captureSources({bindingId:copy.binding.id,parentStudyId:'old',operationId:randomUUID(),expectedSourcesHash:null,sources:[f.pin(f.transcript)]},{material:f.lib})),e=>e.status===409);
});

test('the same operation twice changes nothing; the same ID with different input is 409; pressing twice never makes two', async t=>{
 const f=await fixture(t),operationId=randomUUID(),first=await f.capture([f.transcript],{operationId}),tree=f.tree();
 const replay=await f.capture([f.transcript],{operationId});assert.equal(replay.sourcesHash,first.sourcesHash);assert.deepEqual(replay.captured,first.captured);assert.deepEqual(f.tree(),tree);
 await assert.rejects(f.capture([f.note],{operationId}),e=>e.status===409);
 // A second press with a new operation ID from a stale page (expected null) is settled, not refused.
 const second=await f.capture([f.transcript],{expectedSourcesHash:null});assert.deepEqual(second.captured,[]);assert.deepEqual(second.alreadyCaptured,[f.transcript]);assert.equal(second.sourcesHash,first.sourcesHash);assert.deepEqual(f.tree(),tree);
});

test('two presses at once make one record, in order', async t=>{
 const f=await fixture(t),a=f.capture([f.transcript]),b=f.capture([f.transcript]),results=await Promise.allSettled([a,b]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);const read=await f.drafts.read(f.scope);assert.equal(read.addedSources.records.length,1);
 assert.equal(fs.readdirSync(path.join(f.room,'capture')).filter(n=>n.startsWith('added-')).length,1);
 const [x,y]=results.map(r=>r.value);assert.equal(x.captured.length+y.captured.length,1);
});

test('a stale expected hash is 409, null when a record exists is 409, and a hash changed in the Library is 409', async t=>{
 const f=await fixture(t),first=await f.capture([f.transcript]),tree=f.tree();
 await assert.rejects(f.capture([f.note],{expectedSourcesHash:null}),e=>e.status===409);
 await assert.rejects(f.capture([f.note],{expectedSourcesHash:'0'.repeat(64)}),e=>e.status===409);
 await assert.rejects(human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:first.sourcesHash,sources:[{sourceId:f.note,sourceHash:digest('seen an older version')}]},{material:f.lib})),e=>e.status===409);
 assert.deepEqual(f.tree(),tree);
 const ok=await f.capture([f.note],{expectedSourcesHash:first.sourcesHash});assert.equal(ok.captured[0].role,'context');assert.notEqual(ok.sourcesHash,first.sourcesHash);
});

test('a source over 2 MB is 413, and the total across sources is capped at 4 MB', async t=>{
 const f=await fixture(t),tree=f.tree(),big=f.lib.add(randomUUID(),'Huge','markdown','x'.repeat(2*1024*1024+1));
 await assert.rejects(f.capture([big]),e=>e.status===413);assert.deepEqual(f.tree(),tree);
 const sizes=[1.9,1.9,1.9].map((m,i)=>f.lib.add(randomUUID(),'Part '+i,'markdown',String(i).repeat(Math.floor(m*1024*1024))));
 await assert.rejects(f.capture(sizes),e=>e.status===413);assert.deepEqual(f.tree(),tree);
 const one=await f.capture(sizes.slice(0,2));await assert.rejects(f.capture([sizes[2]],{expectedSourcesHash:one.sourcesHash}),e=>e.status===413);
});

test('an operation ID the draft already uses is 409', async t=>{
 const f=await fixture(t),read=await f.drafts.read(f.scope),saved=await human(()=>f.drafts.save({...f.scope,expected:read.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Some words.'}]})),used=saved.history.at(-1).operationId;
 await assert.rejects(f.capture([f.transcript],{operationId:used}),e=>e.status===409);
 const b=JSON.parse(fs.readFileSync(path.join(f.dataDir,'study-draft-copies','bindings',fs.readdirSync(path.join(f.dataDir,'study-draft-copies','bindings'))[0]),'utf8'));
 await assert.rejects(f.capture([f.transcript],{operationId:b.operationId}),e=>e.status===409);await assert.rejects(f.capture([f.transcript],{operationId:b.prepareOperationId}),e=>e.status===409);
});

test('a file holding the draft\'s own words is refused', async t=>{
 const f=await fixture(t),own='My own sentence about the kiln.\n';await f.write(own);const read=await f.drafts.read(f.scope),mine=f.lib.add(randomUUID(),'My draft pasted','markdown',read.raw);
 await assert.rejects(f.capture([mine]),e=>e.status===409);
});

test('interrupted after the copy and before the record: retrying the same operation completes it once', async t=>{
 let broke=true;const f=await fixture(t,{afterCopyFile:({copiedPath})=>{if(broke&&path.basename(copiedPath).startsWith('added-')){broke=false;throw Error('Synthetic crash after the copy');}}}),operationId=randomUUID();
 await assert.rejects(f.capture([f.transcript],{operationId}),/Synthetic crash/);
 assert.equal(fs.existsSync(path.join(f.room,'added-sources.json')),false);assert.equal(Object.hasOwn(await f.drafts.read(f.scope),'addedSources'),false);
 const done=await f.capture([f.transcript],{operationId});assert.equal(done.captured.length,1);
 assert.equal(fs.readdirSync(path.join(f.room,'capture')).filter(n=>n.startsWith('added-')).length,1);
 const again=await f.capture([f.transcript],{operationId});assert.equal(again.sourcesHash,done.sourcesHash);assert.equal((await f.drafts.read(f.scope)).addedSources.records.length,1);
});

test('a copy left behind by a crash whose bytes differ is kept and refused, not overwritten', async t=>{
 const f=await fixture(t),operationId=randomUUID();fs.writeFileSync(path.join(f.room,'capture','added-'+operationId+'-0.md'),'Someone else\'s bytes',{mode:0o400});
 await assert.rejects(f.capture([f.transcript],{operationId}),e=>e.status===409);assert.equal(fs.readFileSync(path.join(f.room,'capture','added-'+operationId+'-0.md'),'utf8'),'Someone else\'s bytes');
});

test('each entry keeps the review state at the moment of capture, and who confirmed it', async t=>{
 const f=await fixture(t),out=await f.capture([f.transcript,f.note]),file=JSON.parse(fs.readFileSync(path.join(f.room,'added-sources.json'),'utf8'));
 assert.equal(file.schema,'ar-create.study-draft-added-sources.v1');assert.equal(file.entries.length,2);assert.equal(file.entries[0].previousHash,file.captureHash);assert.equal(file.entries[1].previousHash,file.entries[0].entryHash);
 const [t1,n1]=file.entries;assert.equal(t1.actor,'human:adrian');assert.equal(t1.review.state,'reviewed');assert.equal(t1.review.basis,'canonical-recording-review');assert.equal(t1.review.by,'human:adrian');assert.equal(t1.review.hash,f.lib.records.get(f.transcript).hash);assert.equal(t1.eligibleAtCapture,true);assert.equal(t1.setAsideAtCapture,false);assert.equal(t1.libraryHash,f.lib.records.get(f.transcript).hash);assert.equal(t1.copiedHash,digest(TRANSCRIPT));assert.equal(t1.title,'Interview transcript');assert.equal(t1.kind,'transcript');
 assert.equal(n1.review.basis,'exact-first-flow-source-use-review');assert.equal(n1.role,'context');assert.ok(out.document.addedSources.records.every(r=>r.review.by==='human:adrian'));
});

test('a broken added record never stops Write; Check refuses with 409 and says so', async t=>{
 const f=await fixture(t);await f.write('"The clay remembers every hand that has pressed it."\n');
 const damage={
  edited:file=>fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('Interview transcript','Interview forged'),{mode:0o600}),
  copyBytes:(file,room)=>{const name=fs.readdirSync(path.join(room,'capture')).find(n=>n.startsWith('added-'));const p=path.join(room,'capture',name);fs.chmodSync(p,0o600);fs.writeFileSync(p,'Forged words: the clay remembers every hand that has pressed it.');},
  renamed:(file,room)=>{const name=fs.readdirSync(path.join(room,'capture')).find(n=>n.startsWith('added-'));fs.renameSync(path.join(room,'capture',name),path.join(room,'capture','renamed.md'));},
  middleEntryRemoved:file=>{const v=JSON.parse(fs.readFileSync(file,'utf8'));v.entries.splice(0,1);fs.writeFileSync(file,JSON.stringify(v),{mode:0o600});}};
 for(const [name,run] of Object.entries(damage)){
  const g=await fixture(t);await g.write('"The clay remembers every hand that has pressed it."\n');const first=await g.capture([g.transcript]);await g.capture([g.note],{expectedSourcesHash:first.sourcesHash});
  const file=path.join(g.room,'added-sources.json');fs.chmodSync(file,0o600);
  if(name==='copyBytes'||name==='renamed'){const nm=fs.readdirSync(path.join(g.room,'capture')).filter(n=>n.startsWith('added-')).sort()[0];fs.chmodSync(path.join(g.room,'capture',nm),0o600);}
  run(file,g.room);
  const read=await g.drafts.read(g.scope);assert.match(read.addedSources.error,/nothing was used/,name);assert.equal(read.addedSources.records,undefined);
  const saved=await human(()=>g.drafts.save({...g.scope,expected:read.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'Still writing.'}]}));assert.match(saved.raw,/Still writing/,name);
  await assert.rejects(g.check(),e=>e.status===409&&/nothing was used/.test(e.message),name);
  await assert.rejects(g.capture([g.note],{expectedSourcesHash:null}),e=>e.status===409,name);
 }
});

test('a recapture after the Library changed makes Check read only the new copy; both files stay', async t=>{
 const f=await fixture(t);await f.write('"We fire the cups slowly."\n');
 const first=await f.capture([f.transcript]);assert.equal((await f.check()).status,'checked');
 const changed='## Full Transcript\n\nSpeaker: We now fire the cups quickly, and the kiln hums.\n';f.lib.records.get(f.transcript).raw=changed;Object.assign(f.lib.records.get(f.transcript),{hash:digest('library:'+changed),bodyHash:digest(changed)});f.lib.records.get(f.transcript).review.hash=f.lib.records.get(f.transcript).hash;
 const listed=(await f.list()).sources.find(s=>s.id===f.transcript);assert.deepEqual([listed.captured,listed.capturedCurrent,listed.changedSinceCapture,listed.eligible],[true,false,true,true]);
 const second=await f.capture([f.transcript],{expectedSourcesHash:first.sourcesHash});assert.equal(second.captured.length,1);
 assert.equal(fs.readdirSync(path.join(f.room,'capture')).filter(n=>n.startsWith('added-')).length,2);
 const read=await f.drafts.read(f.scope);assert.equal(read.addedSources.records.length,1);assert.equal(read.addedSources.records[0].raw,undefined);assert.equal(read.addedSources.records[0].length,changed.length);
 const result=await f.check();assert.equal(result.status,'needs-review');assert.match(issueText(result),/NOT FOUND/);
});

test('Check does not pass on words that no captured source supports', async t=>{
 const f=await fixture(t),set=async raw=>{const g=await fixture(t);return g;};void set;
 const cases={
  'an invented quote':async g=>{await g.capture([g.transcript]);return '"The moon is made of green porcelain."\n';},
  'a quote found only in an attached source that was not captured':async g=>{await g.capture([g.transcript]);return '"Cobalt comes from a small blue mine."\n';},
  'a quote found only in a set-aside source':async g=>{const aside=g.lib.add(randomUUID(),'Aside','markdown','Porcelain whispers under the rain.',{setAside:true});await g.capture([g.transcript]);assert.ok(aside);return '"Porcelain whispers under the rain."\n';},
  'a quote found only in the Library version that changed after capture':async g=>{await g.capture([g.transcript]);const r=g.lib.records.get(g.transcript);r.raw=r.raw+'Speaker: A brand new sentence arrives later.\n';return '"A brand new sentence arrives later."\n';},
  'a quote found only in the old copy after a recapture':async g=>{const first=await g.capture([g.transcript]);const r=g.lib.records.get(g.transcript),changed='## Full Transcript\n\nSpeaker: Entirely different words now.\n';r.raw=changed;r.hash=digest('library:'+changed);r.review.hash=r.hash;r.bodyHash=digest(changed);await g.capture([g.transcript],{expectedSourcesHash:first.sourcesHash});return '"The clay remembers every hand that has pressed it."\n';}};
 for(const [name,setup] of Object.entries(cases)){
  const g=await fixture(t),words=await setup(g);await g.write(words);const r=await g.check();
  assert.notEqual(r.status,'checked',name);assert.equal(r.status,'needs-review',name);assert.match(issueText(r),/NOT FOUND/,name);
 }
 void f;
});

test('a quote found only in a file an agent placed in capture/, named in a forged record, is refused before Check runs', async t=>{
 const f=await fixture(t);await f.write('"Forged supporting sentence about glaze."\n');
 const name='added-'+randomUUID()+'-0.md',raw='## Full Transcript\n\nSpeaker: Forged supporting sentence about glaze.\n';fs.writeFileSync(path.join(f.room,'capture',name),raw,{mode:0o400});
 const binding=JSON.parse(fs.readFileSync(path.join(f.dataDir,'study-draft-copies','bindings',fs.readdirSync(path.join(f.dataDir,'study-draft-copies','bindings'))[0]),'utf8'));
 // A forger who knows the format but not the chain: wrong previous hash and entry hash.
 const entry={sequence:1,operationId:name.slice(6,42),inputHash:'0'.repeat(64),actor:'human:adrian',capturedAt:new Date().toISOString(),id:'added:'+randomUUID()+':'+digest(raw).slice(0,12),sourceId:randomUUID(),role:'source',kind:'transcript',title:'Forged',sourcePath:'x',libraryHash:digest(raw),review:{state:'reviewed'},copiedName:name,copiedHash:digest(raw),previousHash:'1'.repeat(64),entryHash:'2'.repeat(64)};
 fs.writeFileSync(path.join(f.room,'added-sources.json'),JSON.stringify({schema:'ar-create.study-draft-added-sources.v1',bindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,captureHash:binding.captureHash,entries:[entry]}));
 assert.match((await f.drafts.read(f.scope)).addedSources.error,/nothing was used/);await assert.rejects(f.check(),e=>e.status===409);
 // The same file with no record at all is simply ignored.
 fs.rmSync(path.join(f.room,'added-sources.json'));const r=await f.check();assert.equal(r.status,'held');
});

test('a check made before a capture reads stale, whether it was held or checked', async t=>{
 const f=await fixture(t);await f.write('"The clay remembers every hand."\n');
 const held=await f.check();assert.equal(held.status,'held');
 await f.capture([f.transcript]);const stale=await f.checks.read({...f.scope});assert.equal(stale.status,'stale');assert.match(stale.staleReason,/earlier draft or source revision/);
 const checked=await f.check();assert.equal(checked.status,'checked');const mid=await f.checks.read({...f.scope});assert.equal(mid.status,'checked');
 await f.capture([f.note],{expectedSourcesHash:(await f.list()).sourcesHash});const after=await f.checks.read({...f.scope});assert.equal(after.status,'stale');assert.notEqual(after.status,'checked');
});

test('a capture that lands while Check runs leaves a stale receipt, never a pass', async t=>{
 const f=await fixture(t);await f.write('"The clay remembers every hand that has pressed it."\n');await f.capture([f.transcript]);
 const running=f.check();await f.capture([f.note],{expectedSourcesHash:(await f.list()).sourcesHash});const result=await running;
 assert.ok(['stale','checked'].includes(result.status));const now=await f.checks.read({...f.scope});
 // Whichever side of the race the capture fell on, a receipt reads as passed only when its proof names both sources.
 if(now.status==='checked')assert.equal(now.proof.sources.length,2);else assert.equal(now.status,'stale');
});

test('inspect gives a committed receipt for a capture operation and 404 for an unknown one', async t=>{
 const f=await fixture(t),operationId=randomUUID(),out=await f.capture([f.transcript],{operationId});
 const got=await f.drafts.inspect({...f.scope,operationId});assert.equal(got.receipt.state,'committed');assert.equal(got.receipt.kind,'captureSources');assert.equal(got.receipt.after.hash,out.sourcesHash);
 await assert.rejects(f.drafts.inspect({...f.scope,operationId:randomUUID()}),e=>e.status===404);
});

test('a fork and a stand-in made before a capture keep their seeds and validate; ones made after carry no added sources', async t=>{
 const f=await fixture(t),read=await f.drafts.read(f.scope),outputId=randomUUID();
 const forkBefore=await human(()=>f.drafts.fork({sourceBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,outputId,operationId:randomUUID(),expected:read.expected})),standBefore=await agent(()=>f.drafts.cloneStructureTest({sourceBindingId:f.scope.bindingId,sourceParentStudyId:f.scope.parentStudyId,expected:read.expected,title:'Before',operationId:randomUUID()}));
 await f.capture([f.transcript,f.note]);
 const forkScope={bindingId:forkBefore.binding.id,parentStudyId:f.scope.parentStudyId},standScope={bindingId:standBefore.binding.id,parentStudyId:standBefore.binding.parentStudyId};
 for(const s of [forkScope,standScope]){const d=await f.drafts.read(s);assert.equal(Object.hasOwn(d,'addedSources'),false);assert.deepEqual(d.context.records.map(r=>r.id),(s===forkScope?forkBefore:standBefore).context.records.map(r=>r.id));}
 const after=await f.drafts.read(f.scope),forkAfter=await human(()=>f.drafts.fork({sourceBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:after.expected})),standAfter=await agent(()=>f.drafts.cloneStructureTest({sourceBindingId:f.scope.bindingId,sourceParentStudyId:f.scope.parentStudyId,expected:after.expected,title:'After',operationId:randomUUID()}));
 for(const d of [forkAfter,standAfter]){assert.equal(Object.hasOwn(d,'addedSources'),false);assert.equal(d.context.records.some(r=>String(r.id).startsWith('added:')),false);}
 const reopened=createStudyDraftCopies({dataDir:f.dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Error('none');}}});await reopened.catalog();
 assert.equal((await reopened.read(f.scope)).addedSources.records.length,2);
});

test('a quote that straddles the join of two captured sources does not pass; a quote wholly inside either does', async t=>{
 const f=await fixture(t);
 const end=f.lib.add(randomUUID(),'Interview','transcript','## Full Transcript\n\nSpeaker: We fire the cups slowly and then we wait for the glaze to settle like dusk\n');
 const start=f.lib.add(randomUUID(),'Notes','markdown','Cobalt comes from a small blue mine and costs more each year.\n');
 await f.capture([end,start]);await f.write('"settle like dusk cobalt comes from a small blue mine."\n');
 const r=await f.check();assert.notEqual(r.status,'checked','a quote made of the last words of one source and the first words of the next must not pass');
 for(const quote of ['"We fire the cups slowly and then we wait for the glaze to settle like dusk."','"Cobalt comes from a small blue mine and costs more each year."']){
  const g=await fixture(t),a=g.lib.add(randomUUID(),'Interview','transcript','## Full Transcript\n\nSpeaker: We fire the cups slowly and then we wait for the glaze to settle like dusk\n'),b=g.lib.add(randomUUID(),'Notes','markdown','Cobalt comes from a small blue mine and costs more each year.\n');
  await g.capture([a,b]);await g.write(quote+'\n');assert.equal((await g.check()).status,'checked','a quote wholly inside one source passes: '+quote);
 }
});

// ---- One pass over real HTTP: the subject is made exactly as version two makes it (home.js, New subject), with the
// real material authority, no first-flow.select and no part connection.
import {createServer} from '../runtime/server.mjs';
async function http(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-sources-http-'))),dataDir=path.join(dir,'data'),roots={vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')};for(const r of Object.values(roots))fs.mkdirSync(r,{recursive:true});const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:roots,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,actor='human:adrian')=>{const response=await fetch(base+route,{...(body===undefined?{headers:{'x-ar-actor':actor}}:{method:'POST',headers:{'content-type':'application/json','x-ar-actor':actor},body:JSON.stringify(body)})});let json=null;try{json=await response.json();}catch{}return {status:response.status,body:json};};
 return {dataDir,call};
}
test('over HTTP: a version two subject lists, refuses an agent, captures what Adrian reviewed, and Check reads it as stale then held', async t=>{
 const h=await http(t),parentStudyId=randomUUID(),made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented kiln subject',operationId:randomUUID()});
 assert.equal(made.status,200,JSON.stringify(made.body));const bindingId=made.body.binding.id,projectId=made.body.projectBinding.projectId,scope={bindingId,parentStudyId};
 assert.equal(made.body.binding.kind,'collection-root');assert.equal(made.body.binding.origin,'authored-collection');
 // Measured here, not assumed: the server's create-collection makes the parent connection and the owned-draft connection.
 const imported=await h.call('/api/sources/import',{files:[{name:'Studio note.md',content:NOTE},{name:'Unreviewed note.md',content:'Words nobody has reviewed yet.\n'}]});assert.equal(imported.status,200,JSON.stringify(imported.body));
 const [note,raw]=imported.body.receipts.map(r=>r.source);
 const attach=await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[note.id,raw.id]});assert.equal(attach.status,200,JSON.stringify(attach.body));
 // Reviewing is done in the existing workspace, which works on the selected project.
 assert.equal((await h.call('/api/first-flow/select',{projectKey:parentStudyId,title:'Invented kiln subject',operationId:randomUUID()})).status,200);
 const review=await h.call('/api/first-flow/source-review',{projectId,operationId:randomUUID(),sourceId:note.id,expectedHash:note.hash,reviewed:true,humanDecision:true});assert.equal(review.status,200,JSON.stringify(review.body));
 const q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId,listed=await h.call('/api/study-draft/capture-sources/list'+q);
 assert.equal(listed.status,200,JSON.stringify(listed.body));assert.equal(listed.body.canCapture,true);assert.equal(listed.body.sourcesHash,null);
 const by=id=>listed.body.sources.find(s=>s.id===id);assert.equal(by(note.id).eligible,true);assert.equal(by(note.id).reviewed,true);assert.equal(by(raw.id).eligible,false);assert.match(by(raw.id).reason,/Not reviewed/);
 assert.equal((await h.call('/api/study-draft/capture-sources/list'+q,undefined,'agent:codex')).status,200);
 const read0=(await h.call('/api/study-draft/read'+q)).body,ran=await h.call('/api/study-draft/check',{...scope,operationId:randomUUID(),expected:read0.expected});assert.equal(ran.status,200,JSON.stringify(ran.body));assert.equal(ran.body.status,'held');
 const input={...scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:note.id,sourceHash:note.hash}]},room=path.join(h.dataDir,'study-draft-copies','copies',bindingId);
 for(const actor of ['agent:codex','agent:claude-code','agent:chatgpt','cron:nightly']){const refused=await h.call('/api/study-draft/capture-sources',input,actor);assert.equal(refused.status,403,actor);}
 assert.equal(fs.existsSync(path.join(room,'added-sources.json')),false);assert.deepEqual(fs.readdirSync(path.join(room,'capture')).filter(n=>n.startsWith('added-')),[]);
 assert.equal((await h.call('/api/study-draft/capture-sources',{...input,sources:[{sourceId:raw.id,sourceHash:raw.hash}]})).status,400);
 const done=await h.call('/api/study-draft/capture-sources',input);assert.equal(done.status,200,JSON.stringify(done.body));assert.equal(done.body.captured[0].role,'context');assert.equal(done.body.document.addedSources.records[0].title,by(note.id).title);
 assert.equal(done.body.document.addedSources.records[0].review.by,'human:adrian');assert.equal(done.body.document.addedSources.records[0].raw,undefined);
 const after=await h.call('/api/study-draft/read'+q);assert.equal(after.body.addedSources.hash,done.body.sourcesHash);assert.equal(after.body.raw,read0.raw);assert.deepEqual(after.body.expected,read0.expected);
 const stale=await h.call('/api/study-draft/check'+q);assert.equal(stale.body.status,'stale');
 const again=await h.call('/api/study-draft/check',{...scope,operationId:randomUUID(),expected:after.body.expected});assert.equal(again.status,200);assert.equal(again.body.status,'held');assert.ok(again.body.proof.sources.some(s=>s.id.startsWith('added:')));
 assert.equal((await h.call('/api/study-draft/capture-sources',input)).body.sourcesHash,done.body.sourcesHash);
 const second=await h.call('/api/study-draft/capture-sources',{...input,operationId:randomUUID()});assert.equal(second.status,200);assert.deepEqual(second.body.captured,[]);
 const reg=(await h.call('/api/capabilities')).body,all=reg.commands||reg,c=all.find(x=>x.name==='study-draft.capture-sources'),l=all.find(x=>x.name==='study-draft.capture-sources.list');
 assert.ok(c&&l);assert.deepEqual(c.actors,['human']);assert.equal(c.section,'draft');assert.equal(c.relay,undefined);assert.equal(c.undo,undefined);assert.equal(l.readOnly,true);
});

test('the material authority serves a subject begun in version two through context(), with and without text', async t=>{
 const {createStudyProjectMaterialContext}=await import('../runtime/services/study-project-material-context.mjs');
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-sources-parent-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x),docs=new Map();
 const parentStudyId='subject-'+randomUUID(),bindingId=randomUUID(),projectId=randomUUID(),documentId=randomUUID(),other='someone-else-'+randomUUID();
 const bind=(key,pid,did)=>{docs.set(pid,did);fs.mkdirSync(path.join(dataDir,'study-project-bindings'),{recursive:true});fs.writeFileSync(path.join(dataDir,'study-project-bindings',digest(key)+'.json'),JSON.stringify({schema:'ar-create.study-binding.v1',status:'ready',projectKey:key,projectId:pid,documentId:did,}));};
 // New subject makes the parent connection and the owned-draft connection (create-collection); no first-flow.select.
 bind(parentStudyId,projectId,documentId);bind('owned-draft:'+bindingId,randomUUID(),randomUUID());bind(other,randomUUID(),randomUUID());
 const sourceId=randomUUID(),raw='Invented words.',unreviewed=randomUUID(),asked=[];
 const records=[{id:sourceId,title:'Note',kind:'markdown',hash:digest('h'),eligible:true,review:{state:'reviewed'},raw,bodyHash:digest(raw)},{id:unreviewed,title:'Raw',kind:'markdown',hash:digest('r'),eligible:false,review:{state:'unreviewed'}}];
 const firstFlow={materialContext:async input=>{asked.push(input.projectId);const out={schema:'ar-create.first-flow-material-context.v1',projectId:input.projectId,documentId:docs.get(input.projectId),role:'x',revision:1,records};return {...out,hash:digest(stable(out))};}};
 const authority=createStudyProjectMaterialContext({dataDir,firstFlow,drafts:{read:async()=>{throw new Error('no drafts needed');}}}),scope={bindingId,parentStudyId};
 assert.equal('parentContext' in authority,false);
 const got=await authority.context(scope,{sourceIds:[sourceId]});assert.equal(got.records[0].raw,raw);assert.deepEqual(asked,[projectId]);
 await assert.rejects(authority.context(scope,{sourceIds:[unreviewed]}),e=>e.status===400);
 await assert.rejects(authority.context(scope,{sourceIds:[randomUUID()]}),e=>e.status===400);
 await assert.rejects(authority.context({bindingId,parentStudyId:'no-such-subject'},{sourceIds:[sourceId]}),e=>e.status===409);
 assert.equal((await authority.context(scope,{})).records.some(r=>Object.hasOwn(r,'raw')),false);
 assert.equal((await authority.context(scope,{withBody:true})).records[0].raw,raw);
 // A part with no connection of its own is still refused.
 await assert.rejects(authority.context({bindingId:randomUUID(),parentStudyId},{sourceIds:[sourceId]}));
});
