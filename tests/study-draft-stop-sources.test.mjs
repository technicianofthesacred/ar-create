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
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const QUOTE='"The clay remembers every hand that has pressed it."\n';
const ANY=[fn=>agent(fn,'agent:claude-code'),fn=>agent(fn,'agent:codex'),fn=>agent(fn,'agent:chatgpt'),fn=>withActor({actor:'cron:nightly',client:'cli'},fn),fn=>withActor({actor:'import:notes',client:'cli'},fn),fn=>fn()];
/** A fixture with the transcript and the note both captured, and the stop helper. */
async function used(t,options){
 const f=await fixture(t,options);await f.write(QUOTE);const out=await f.capture([f.transcript,f.note]);
 const hashOf=id=>f.lib.records.get(id)&&digest(f.lib.records.get(id).raw);
 const copied=id=>digest(id===f.transcript?TRANSCRIPT:NOTE);
 const stopInput=(id,over={})=>({...f.scope,operationId:randomUUID(),expectedSourcesHash:over.hash??null,sourceId:id,copiedHash:copied(id),...over.fields});
 const stop=async(id,{as=human,hash,operationId=randomUUID(),fields}={})=>{const cur=hash??(await f.drafts.read(f.scope)).addedSources.hash;return as(()=>f.drafts.stopSources({...f.scope,operationId,expectedSourcesHash:cur,sourceId:id,copiedHash:copied(id),...fields}));};
 const file=path.join(f.room,'added-sources.json'),entries=()=>JSON.parse(fs.readFileSync(file,'utf8')).entries;
 const rewrite=fn=>{const doc=JSON.parse(fs.readFileSync(file,'utf8'));fn(doc);fs.chmodSync(file,0o600);fs.writeFileSync(file,JSON.stringify(doc,null,2));fs.chmodSync(file,0o400);};
 const rehash=(doc,i)=>{const e=doc.entries[i];delete e.entryHash;e.entryHash=digest(stable(e));if(doc.entries[i+1])doc.entries[i+1].previousHash=e.entryHash;};
 return {...f,out,copied,stop,file,entries,rewrite,rehash,stopInput};
}
const stoppedNow=async f=>(await f.drafts.read(f.scope)).addedSources;

test('stopping as Adrian appends one entry, nothing is rewritten, and the old entries stay exactly as they were', async t=>{
 const f=await used(t),before=fs.readFileSync(f.file,'utf8'),was=f.entries(),copies=fs.readdirSync(path.join(f.room,'capture')).sort(),tree=f.tree();
 const out=await f.stop(f.note);
 const now=f.entries();assert.equal(now.length,was.length+1);assert.deepEqual(now.slice(0,was.length),was);
 const e=now.at(-1);assert.deepEqual(Object.keys(e).sort(),['action','actor','copiedHash','entryHash','id','inputHash','operationId','previousHash','sequence','sourceId','stopped'+'At','stops'].sort());
 assert.equal(e.action,'stop');assert.equal(e.actor,'human:adrian');assert.equal(e.stops,was.find(x=>x.sourceId===f.note).entryHash);assert.equal(e.previousHash,was.at(-1).entryHash);assert.equal(e.copiedHash,f.copied(f.note));assert.equal(e.id,'added:'+f.note+':'+f.copied(f.note).slice(0,12));
 // Not one byte before the new entry changed in meaning, and no copy was removed or added.
 assert.deepEqual(fs.readdirSync(path.join(f.room,'capture')).sort(),copies);assert.ok(before.length>0);
 const treeNow=f.tree();for(const name of Object.keys(tree))if(name!=='added-sources.json')assert.equal(treeNow[name],tree[name],name);
 assert.equal(fs.statSync(f.file).mode&0o777,0o400);
 assert.deepEqual(out.stopped,[{sourceId:f.note,copiedHash:f.copied(f.note)}]);assert.match(out.sourcesHash,/^[a-f0-9]{64}$/);
 const read=out.document.addedSources;assert.equal(read.hash,out.sourcesHash);assert.deepEqual(read.records.map(r=>r.sourceId),[f.transcript]);
 assert.equal(read.stopped.length,1);assert.deepEqual(Object.keys(read.stopped[0]).sort(),['actor','copiedHash','id','kind','operationId','sourceId','stoppedAt','title']);assert.equal(read.stopped[0].title,'Studio note');
});

test('a record with no stop entry reads with the same keys as before; its list adds only capturedHash on used rows and no stop keys', async t=>{
 const f=await fixture(t);await f.capture([f.transcript,f.note]);
 const read=await f.drafts.read(f.scope);assert.deepEqual(Object.keys(read.addedSources).sort(),['hash','records']);
 for(const r of read.addedSources.records)assert.deepEqual(Object.keys(r).sort(),['actor','added','capturedAt','copiedHash','copiedPath','id','kind','length','libraryHash','operationId','review','role','sourceId','sourcePath','title']);
 const listed=await f.list();assert.equal(Object.hasOwn(listed,'stopped'),false);
 for(const s of listed.sources){assert.equal(Object.hasOwn(s,'capturedHash'),s.captured===true&&!s.stopped,'capturedHash only on a used row');assert.equal(Object.hasOwn(s,'stopped'),false);assert.equal(Object.hasOwn(s,'stoppedAt'),false);}
 const bytes=fs.readFileSync(path.join(f.room,'added-sources.json'));await f.list();await f.drafts.read(f.scope);assert.deepEqual(fs.readFileSync(path.join(f.room,'added-sources.json')),bytes);
 assert.equal((await f.drafts.inspectRoots(f.scope))!==undefined,true);
});

test('Check stops reading a stopped source: a quote found only in it is not found, and an earlier receipt reads stale', async t=>{
 const f=await used(t);const mid=await f.check();assert.equal(mid.status,'checked');assert.equal((await f.checks.read(f.scope)).status,'checked');
 // Stop the note, which is not the source of the quote: still passes once checked again, but the old receipt is stale at once.
 await f.stop(f.note);const stale=await f.checks.read(f.scope);assert.equal(stale.status,'stale');assert.match(stale.staleReason,/earlier draft or source revision/);
 const again=await f.check();assert.equal(again.status,'checked');assert.deepEqual(again.proof.sources.map(s=>s.role),['source']);
});

test('a quote found only in a stopped note passes while it is used and is not found after the stop', async t=>{
 const f=await used(t);await f.write('"Cobalt comes from a small blue mine."\n');
 const withNote=await f.check();assert.equal(withNote.status,'checked',issueText(withNote));
 await f.stop(f.note);const without=await f.check();assert.notEqual(without.status,'checked');assert.match(issueText(without),/NOT FOUND|not found/i);
});

test('a quote found only in the stopped copy is not found once it is stopped', async t=>{
 const f=await fixture(t);await f.write('"Cobalt comes from a small blue mine."\n');
 const quoteOnlyInNote=f.lib.add(randomUUID(),'Second transcript','transcript','## Full Transcript\n\nSpeaker: Cobalt comes from a small blue mine and costs more each year.\n');
 const first=await f.capture([quoteOnlyInNote]);assert.equal(first.captured.length,1);
 const pass=await f.check();assert.notEqual(pass.status,'failed',(pass.quote?.output||''));assert.doesNotMatch(pass.quote?.output||'',/NOT FOUND/);
 const cur=await f.drafts.read(f.scope);
 await human(()=>f.drafts.stopSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:cur.addedSources.hash,sourceId:quoteOnlyInNote,copiedHash:digest('## Full Transcript\n\nSpeaker: Cobalt comes from a small blue mine and costs more each year.\n')}));
 // The locked capture is empty and the added transcript is stopped: nothing to check against.
 const held=await f.check();assert.equal(held.status,'held');assert.match(held.quote.reason,/No captured SRC available/);
});

test('stopping the only source holds Check, and the list says so', async t=>{
 const f=await fixture(t);await f.write(QUOTE);await f.capture([f.transcript]);assert.equal((await f.check()).status,'checked');
 const cur=await f.drafts.read(f.scope);
 const out=await human(()=>f.drafts.stopSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:cur.addedSources.hash,sourceId:f.transcript,copiedHash:digest(TRANSCRIPT)}));
 assert.deepEqual(out.document.addedSources.records,[]);assert.equal((await f.checks.read(f.scope)).status,'stale');
 const held=await f.check();assert.equal(held.status,'held');assert.match(held.quote.reason,/No captured SRC available/);
 const l=await f.list(),row=l.sources.find(s=>s.id===f.transcript);assert.equal(l.hasQuoteSource,false);assert.equal(l.sourcesHash,out.sourcesHash);
 assert.deepEqual([row.stopped,row.captured,row.eligible],[true,false,false]);assert.match(row.reason,/stopped/);assert.equal(typeof row.stoppedAt,'string');assert.equal(Object.hasOwn(row,'capturedHash'),false);
 const note=l.sources.find(s=>s.id===f.note);assert.equal(Object.hasOwn(note,'stopped'),false);assert.equal(note.eligible,true);
});

test('the list gives capturedHash only on a used row and keeps the stopped row out of "Already used"', async t=>{
 const f=await used(t);let l=await f.list();const by=id=>l.sources.find(s=>s.id===id);
 assert.equal(by(f.transcript).capturedHash,digest(TRANSCRIPT));assert.match(by(f.transcript).reason,/Already used/);
 await f.stop(f.transcript);l=await f.list();assert.equal(by(f.transcript).stopped,true);assert.doesNotMatch(by(f.transcript).reason,/Already used/);assert.equal(by(f.note).capturedHash,digest(NOTE));
});

test('a captured source no longer attached to the subject still has a row, so it can be stopped', async t=>{
 const f=await used(t);f.lib.records.delete(f.note);let l=await f.list();const row=l.sources.find(s=>s.id===f.note);
 assert.ok(row);assert.equal(row.captured,true);assert.equal(row.capturedHash,digest(NOTE));assert.equal(row.eligible,false);
 await f.stop(f.note);l=await f.list();const gone=l.sources.find(s=>s.id===f.note);assert.equal(gone.stopped,true);assert.equal(gone.captured,false);
});

test('a retried operation ID answers the same and writes nothing; a double press settles; other input with the same ID is 409', async t=>{
 const f=await used(t),operationId=randomUUID(),hash=(await stoppedNow(f)).hash,first=await f.stop(f.note,{operationId,hash}),tree=f.tree(),n=f.entries().length;
 const replay=await f.stop(f.note,{operationId,hash});assert.equal(replay.sourcesHash,first.sourcesHash);assert.deepEqual(replay.stopped,first.stopped);assert.deepEqual(f.tree(),tree);
 await assert.rejects(f.stop(f.transcript,{operationId,hash}),e=>e.status===409);
 await assert.rejects(f.stop(f.note,{operationId,hash:digest('other')}),e=>e.status===409);
 // A second press from a stale tab (new operation ID, old hash) settles.
 const second=await f.stop(f.note,{hash});assert.equal(second.sourcesHash,first.sourcesHash);assert.equal(f.entries().length,n);assert.deepEqual(f.tree(),tree);
 // A capture operation ID cannot be reused as a stop.
 await assert.rejects(f.stop(f.transcript,{operationId:f.entries()[0].operationId}),e=>e.status===409);
 const own=JSON.parse(fs.readFileSync(path.join(f.dataDir,'study-draft-copies','bindings',fs.readdirSync(path.join(f.dataDir,'study-draft-copies','bindings'))[0]),'utf8'));
 await assert.rejects(f.stop(f.transcript,{operationId:own.operationId}),e=>e.status===409);
 assert.equal(f.entries().length,n);
});

test('a stale expected hash, a wrong copy, a source never captured and no record at all are each 409 and write nothing', async t=>{
 const f=await used(t),tree=f.tree();
 await assert.rejects(f.stop(f.note,{hash:digest('stale')}),e=>e.status===409&&/changed since you looked/.test(e.message));
 await assert.rejects(f.stop(f.note,{fields:{copiedHash:digest('another copy')}}),e=>e.status===409&&/does not read this copy/.test(e.message));
 await assert.rejects(f.stop(randomUUID()),e=>e.status===409&&/does not read this copy/.test(e.message));
 assert.deepEqual(f.tree(),tree);
 const g=await fixture(t);const gt=g.tree();await assert.rejects(human(()=>g.drafts.stopSources({...g.scope,operationId:randomUUID(),expectedSourcesHash:digest('x'),sourceId:g.transcript,copiedHash:digest(TRANSCRIPT)})),e=>e.status===409&&/reads no added source/.test(e.message));assert.deepEqual(g.tree(),gt);
});

test('a damaged record refuses a stop with 409 and writes nothing', async t=>{
 const f=await used(t);f.rewrite(doc=>{doc.entries[0].title='Changed outside the app';});const tree=f.tree();
 await assert.rejects(human(()=>f.drafts.stopSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:digest('x'),sourceId:f.note,copiedHash:digest(NOTE)})),e=>e.status===409&&/Nothing was stopped\.$/.test(e.message)&&!/nothing was used/.test(e.message));
 assert.deepEqual(f.tree(),tree);
});

test('an assistant, any other actor and an unattributed caller are refused with 403 before anything is written', async t=>{
 const f=await used(t),tree=f.tree(),hash=(await stoppedNow(f)).hash;
 for(const as of ANY)await assert.rejects(f.stop(f.note,{as,hash}),e=>e.status===403&&/Stopping a source for Check is for Adrian to do/.test(e.message));
 await assert.rejects(f.stop(f.note,{as:fn=>agent(fn,'agent:codex'),hash}),e=>/agent:codex may not/.test(e.message));
 // Refused before input is even read, and replaying Adrian's own operation as an assistant is refused too.
 await assert.rejects(agent(()=>f.drafts.stopSources({junk:1})),e=>e.status===403);
 const op=randomUUID();await f.stop(f.note,{operationId:op,hash});const after=f.tree();
 await assert.rejects(f.stop(f.note,{as:fn=>agent(fn),operationId:op,hash}),e=>e.status===403);assert.deepEqual(f.tree(),after);
 assert.notDeepEqual(tree,after);
});

test('bad input is 400 and writes nothing', async t=>{
 const f=await used(t),tree=f.tree(),ok=f.stopInput(f.note,{hash:(await stoppedNow(f)).hash});
 for(const patch of [{extra:1},{expectedSourcesHash:null},{expectedSourcesHash:'nope'},{sourceId:'x'},{copiedHash:'x'},{operationId:'x'},{bindingId:'x'},{parentStudyId:''},{sourceId:undefined},{copiedHash:undefined}]){
  const input={...ok,...patch};for(const k of Object.keys(input))if(input[k]===undefined)delete input[k];
  await assert.rejects(human(()=>f.drafts.stopSources(input)),e=>e.status===400,JSON.stringify(Object.keys(patch)));
 }
 assert.deepEqual(f.tree(),tree);
});

test('a fork and a structure-test stand-in refuse a stop with 409', async t=>{
 const f=await used(t),read=await f.drafts.read(f.scope);
 const fork=await human(()=>f.drafts.fork({sourceBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:read.expected}));
 await assert.rejects(human(()=>f.drafts.stopSources({bindingId:fork.binding.id,parentStudyId:f.scope.parentStudyId,operationId:randomUUID(),expectedSourcesHash:digest('x'),sourceId:f.note,copiedHash:digest(NOTE)})),e=>e.status===409);
 const stand=await agent(()=>f.drafts.cloneStructureTest({sourceBindingId:f.scope.bindingId,sourceParentStudyId:f.scope.parentStudyId,expected:read.expected,title:'Stand-in',operationId:randomUUID()}));
 await assert.rejects(human(()=>f.drafts.stopSources({bindingId:stand.binding.id,parentStudyId:stand.binding.parentStudyId,operationId:randomUUID(),expectedSourcesHash:digest('x'),sourceId:f.note,copiedHash:digest(NOTE)})),e=>e.status===409);
});

test('bulk capture does not bring a stopped source back; only an explicit again does', async t=>{
 const f=await used(t);await f.stop(f.note);const tree=f.tree(),n=f.entries().length,hash=(await stoppedNow(f)).hash,op=randomUUID();
 // The bulk press, alone or with another source, is refused and writes nothing.
 await assert.rejects(f.capture([f.note],{expectedSourcesHash:hash}),e=>e.status===409&&/You stopped using this for Check/.test(e.message));
 await assert.rejects(f.capture([f.transcript,f.note],{expectedSourcesHash:hash}),e=>e.status===409);
 assert.deepEqual(f.tree(),tree);assert.equal(f.entries().length,n);
 // A retry of the old capture's operation ID answers without reviving it, and says it is stopped.
 const oldOp=f.entries()[0].operationId,replay=await f.capture([f.transcript,f.note],{operationId:oldOp,expectedSourcesHash:null});
 assert.deepEqual(replay.captured.map(c=>c.sourceId),[f.transcript]);assert.deepEqual(replay.stopped,[f.note]);assert.deepEqual(f.tree(),tree);assert.deepEqual((await stoppedNow(f)).records.map(r=>r.sourceId),[f.transcript]);
 // Another library item with the same bytes is another source: it does not revive the stopped one.
 const twin=f.lib.add(randomUUID(),'Same words','markdown',NOTE);await f.capture([twin],{expectedSourcesHash:hash});
 assert.deepEqual((await stoppedNow(f)).stopped.map(x=>x.sourceId),[f.note]);assert.equal((await stoppedNow(f)).records.some(r=>r.sourceId===f.note),false);
 // Again as an assistant: 403.
 const h2=(await stoppedNow(f)).hash,t2=f.tree();
 for(const as of ANY)await assert.rejects(f.capture([f.note],{as,expectedSourcesHash:h2,extra:{sources:[{...f.pin(f.note),again:true}]}}),e=>e.status===403);assert.deepEqual(f.tree(),t2);
 // Again as Adrian: one ordinary capture entry, the source reads as used, and a repeat of the same press settles.
 const sources=[{...f.pin(f.note),again:true}];
 const out=await human(()=>f.drafts.captureSources({...f.scope,operationId:op,expectedSourcesHash:h2,sources},{material:f.lib}));
 assert.deepEqual(out.captured.map(c=>c.sourceId),[f.note]);assert.equal(out.document.addedSources.records.some(r=>r.sourceId===f.note),true);assert.equal(Object.hasOwn(out.document.addedSources,'stopped'),false);
 const e=f.entries().at(-1);assert.equal(Object.hasOwn(e,'action'),false);assert.equal(e.sourceId,f.note);
 const l=await f.list();assert.equal(l.sources.find(s=>s.id===f.note).capturedHash,digest(NOTE));assert.equal(Object.hasOwn(l.sources.find(s=>s.id===f.note),'stopped'),false);
 const len=f.entries().length;const settled=await human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:null,sources},{material:f.lib}));
 assert.deepEqual(settled.captured,[]);assert.deepEqual(settled.alreadyCaptured,[f.note]);assert.equal(f.entries().length,len);
 // And it can be stopped again.
 await f.stop(f.note);assert.equal((await stoppedNow(f)).stopped.some(x=>x.sourceId===f.note),true);
});

test('again on a source that was never captured is 400, and again must be exactly true', async t=>{
 const f=await used(t),other=f.lib.add(randomUUID(),'Never used','markdown','Never captured words.\n'),tree=f.tree(),hash=(await stoppedNow(f)).hash;
 await assert.rejects(human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:hash,sources:[{...f.pin(other),again:true}]},{material:f.lib})),e=>e.status===400);
 for(const again of [false,'yes',1])await assert.rejects(human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:hash,sources:[{...f.pin(f.note),again}]},{material:f.lib})),e=>e.status===400);
 assert.deepEqual(f.tree(),tree);
});

test('a stopped source is never revived by again when a stale page repeats an older hash', async t=>{
 const f=await used(t);await f.stop(f.note);const tree=f.tree();
 await assert.rejects(human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{...f.pin(f.note),again:true}]},{material:f.lib})),e=>e.status===409);assert.deepEqual(f.tree(),tree);
});

test('the chain detects a tampered, dropped, forged or misdirected stop entry; every one reads as damaged', async t=>{
 const damaged=async f=>assert.match((await f.drafts.read(f.scope)).addedSources.error,/nothing was used/);
 // Tampered stop (no re-hash).
 let f=await used(t);await f.stop(f.note);f.rewrite(d=>{d.entries.at(-1).stoppedAt='2020-01-01T00:00:00.000Z';});await damaged(f);await assert.rejects(f.check(),e=>e.status===409);
 // Dropped from the middle: a stop followed by an again entry.
 f=await used(t);await f.stop(f.note);await human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{...f.pin(f.note),again:true}]},{material:f.lib})).catch(()=>{});
 const h=(await f.drafts.read(f.scope)).addedSources.hash;await human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:h,sources:[{...f.pin(f.note),again:true}]},{material:f.lib}));
 assert.equal(f.entries().at(-2).action,'stop');f.rewrite(d=>{d.entries.splice(d.entries.length-2,1);});await damaged(f);
 // A stop by an assistant, correctly hashed.
 f=await used(t);await f.stop(f.note);f.rewrite(d=>{d.entries.at(-1).actor='agent:codex';f.rehash(d,d.entries.length-1);});await damaged(f);
 // A stop that points at an older capture entry.
 f=await used(t);await f.stop(f.note);f.rewrite(d=>{d.entries.at(-1).stops=d.entries[0].entryHash;f.rehash(d,d.entries.length-1);});await damaged(f);
 // A stop with an extra key.
 f=await used(t);await f.stop(f.note);f.rewrite(d=>{d.entries.at(-1).note='extra';f.rehash(d,d.entries.length-1);});await damaged(f);
 // A stop that names a source never captured, and a stop of an already stopped source.
 f=await used(t);await f.stop(f.note);f.rewrite(d=>{const e={...d.entries.at(-1)};e.sequence=d.entries.length+1;e.previousHash=d.entries.at(-1).entryHash;e.operationId=randomUUID();delete e.entryHash;e.entryHash=digest(stable(e));d.entries.push(e);});await damaged(f);
 f=await used(t);f.rewrite(d=>{const base=d.entries.at(-1),e={sequence:d.entries.length+1,action:'stop',operationId:randomUUID(),inputHash:digest('x'),actor:'human:adrian',stoppedAt:new Date().toISOString(),sourceId:randomUUID(),copiedHash:digest('y'),stops:base.entryHash,previousHash:base.entryHash};e.id='added:'+e.sourceId+':'+e.copiedHash.slice(0,12);e.entryHash=digest(stable(e));d.entries.push(e);});await damaged(f);
 // A stop that is itself a forged entry that names the right entry, with the right chain, but a different copied hash.
 f=await used(t);await f.stop(f.note);f.rewrite(d=>{const e=d.entries.at(-1);e.copiedHash=digest('else');e.id='added:'+e.sourceId+':'+e.copiedHash.slice(0,12);f.rehash(d,d.entries.length-1);});await damaged(f);
});

test('KNOWN LIMIT: cutting the newest stop entry off the file is not detected, and the stopped source then reads as used again (only the added record\'s newest entry is unanchored; needs file access)', async t=>{
 const f=await used(t);await f.stop(f.note);f.rewrite(d=>{d.entries.pop();});
 const read=await f.drafts.read(f.scope);assert.equal(read.addedSources.error,undefined);assert.equal(read.addedSources.records.length,2);
});

test('a replay of an old stop operation after the source was used again answers that it is not stopped', async t=>{
 const f=await used(t);const op=randomUUID(),first=(await stoppedNow(f)).hash;await f.stop(f.note,{operationId:op,hash:first});
 const hash=(await stoppedNow(f)).hash;
 const back=await human(()=>f.drafts.captureSources({...f.scope,operationId:randomUUID(),expectedSourcesHash:hash,sources:[{...f.pin(f.note),again:true}]},{material:f.lib}));
 assert.ok(back.document.addedSources.records.some(r=>r.sourceId===f.note),'used again');
 const tree=f.tree(),replay=await f.stop(f.note,{operationId:op,hash:first});
 assert.deepEqual(replay.stopped,[],'not stopped any more');assert.ok(replay.document.addedSources.records.some(r=>r.sourceId===f.note));assert.deepEqual(f.tree(),tree);
});

test('inspect names a stop operation', async t=>{
 const f=await used(t),operationId=randomUUID(),out=await f.stop(f.note,{operationId});
 const got=await f.drafts.inspect({...f.scope,operationId});assert.equal(got.receipt.kind,'stopSources');assert.equal(got.receipt.state,'committed');assert.equal(got.receipt.after.hash,out.sourcesHash);
 const cap=await f.drafts.inspect({...f.scope,operationId:f.entries()[0].operationId});assert.equal(cap.receipt.kind,'captureSources');
 await assert.rejects(f.drafts.inspect({...f.scope,operationId:randomUUID()}),e=>e.status===404);
});

test('forks and structure tests made before and after a stop read and validate unchanged; root recovery still passes', async t=>{
 const f=await used(t);let read=await f.drafts.read(f.scope);
 const forkBefore=await human(()=>f.drafts.fork({sourceBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:read.expected}));
 const standBefore=await agent(()=>f.drafts.cloneStructureTest({sourceBindingId:f.scope.bindingId,sourceParentStudyId:f.scope.parentStudyId,expected:read.expected,title:'Stand-in one',operationId:randomUUID()}));
 const seedBefore=forkBefore.context.records.map(r=>r.id);
 await f.stop(f.transcript);read=await f.drafts.read(f.scope);
 const forkAfter=await human(()=>f.drafts.fork({sourceBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId,outputId:randomUUID(),operationId:randomUUID(),expected:read.expected}));
 const standAfter=await agent(()=>f.drafts.cloneStructureTest({sourceBindingId:f.scope.bindingId,sourceParentStudyId:f.scope.parentStudyId,expected:read.expected,title:'Stand-in two',operationId:randomUUID()}));
 for(const d of [forkBefore,standBefore,forkAfter,standAfter]){const again=await f.drafts.read({bindingId:d.binding.id,parentStudyId:d.binding.parentStudyId});assert.equal(Object.hasOwn(again,'addedSources'),false);assert.equal(again.readiness.ready,true);}
 assert.deepEqual((await f.drafts.read({bindingId:forkBefore.binding.id,parentStudyId:forkBefore.binding.parentStudyId})).context.records.map(r=>r.id),seedBefore);
 assert.ok(await f.drafts.inspectRoots(f.scope));
});

test('a stop while Check runs leaves a stale receipt, never a pass that still names the stopped source', async t=>{
 const f=await used(t);const running=f.check();await f.stop(f.note);const result=await running;
 assert.ok(['stale','checked'].includes(result.status));const now=await f.checks.read(f.scope);
 if(now.status==='checked')assert.ok(!now.proof.sources.some(s=>s.id.includes(f.note)));else assert.equal(now.status,'stale');
});
