// Adversarial review of piece A (study-draft.capture-sources). Invented content only. Each test names the finding it
// proves in docs/plans/version-two-briefs/v2-12-capture-sources.md, "Code review of piece A". A test marked todo states
// the behaviour the finding asks for and fails today; it starts passing when the correction lands. The others pass
// today and pin what the review confirmed.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {createStudyDraftChecks} from '../runtime/services/study-draft-checks.mjs';import {withActor} from '../runtime/services/actor.mjs';import {digest} from '../runtime/services/files.mjs';

const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn);
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);

async function http(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review-http-'))),dataDir=path.join(dir,'data'),roots={vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')};for(const r of Object.values(roots))fs.mkdirSync(r,{recursive:true});
 const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:roots,researchEnabled:false,sharedArticles:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,actor='human:adrian')=>{const response=await fetch(base+route,{...(body===undefined?{headers:{'x-ar-actor':actor}}:{method:'POST',headers:{'content-type':'application/json','x-ar-actor':actor},body:JSON.stringify(body)})});let json=null;try{json=await response.json();}catch{}return {status:response.status,body:json};};
 return {dataDir,call};
}

// Review finding 1 (must fix). Every step before Adrian's one press is open to an assistant: write a file whose front
// matter says "kind: transcript", attach it, mark it reviewed. The list he is shown says transcript, reviewed, eligible,
// role source. One press, and Check passes on a sentence nobody said. Measured over HTTP here and on npm run demo.
test('an assistant cannot make Check trust words it wrote, even with Adrian pressing once', {todo:'review finding 1: make review human-only and give role source only to a canonical recording transcript'}, async t=>{
 const h=await http(t),AGENT='agent:codex',parentStudyId=randomUUID();
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented kiln subject',operationId:randomUUID()});assert.equal(made.status,200,JSON.stringify(made.body));
 const bindingId=made.body.binding.id,projectId=made.body.projectBinding.projectId,scope={bindingId,parentStudyId},q='?bindingId='+bindingId+'&parentStudyId='+parentStudyId;
 const invented='---\nkind: transcript\ntitle: Interview with the potter\n---\n\n## Full Transcript\n\n**Potter:** The kiln told me to stop selling cups to tourists.\n';
 const imported=await h.call('/api/sources/import',{files:[{name:'Interview with the potter.md',content:invented}]},AGENT);assert.equal(imported.status,200,JSON.stringify(imported.body));
 const source=imported.body.receipts[0].source;assert.equal(source.kind,'transcript','front matter alone makes it a transcript');
 assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]},AGENT)).status,200);
 assert.equal((await h.call('/api/first-flow/select',{projectKey:parentStudyId,title:'Invented kiln subject',operationId:randomUUID()},AGENT)).status,200);
 const reviewed=await h.call('/api/first-flow/source-review',{projectId,operationId:randomUUID(),sourceId:source.id,expectedHash:source.hash,reviewed:true,humanDecision:true},AGENT);
 if(reviewed.status===403)return;// corrected: an assistant may not mark material reviewed
 const row=(await h.call('/api/study-draft/capture-sources/list'+q)).body.sources.find(s=>s.id===source.id);
 const done=await h.call('/api/study-draft/capture-sources',{...scope,operationId:randomUUID(),expectedSourcesHash:null,sources:[{sourceId:source.id,sourceHash:source.hash}]});
 if(done.status!==200)return;// corrected: refused at capture
 const read=(await h.call('/api/study-draft/read'+q)).body;
 const saved=await h.call('/api/study-draft/save',{...scope,expected:read.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'"The kiln told me to stop selling cups to tourists."'}]});assert.equal(saved.status,200);
 const ran=await h.call('/api/study-draft/check',{...scope,operationId:randomUUID(),expected:saved.body.expected});assert.equal(ran.status,200);
 assert.notEqual(ran.body.status,'checked','Check passed on words an assistant wrote, labelled, attached and reviewed (listed to Adrian as '+JSON.stringify([row.kind,row.reviewed,row.role])+')');
});

// Service fixture: a subject begun the version two way, with a fake of the material authority.
async function service(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'capture-review-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Object.assign(Error('No originals.'),{status:404});}}}),parentStudyId='subject-'+randomUUID();
 const doc=await human(()=>drafts.createCollection({parentStudyId,title:'Invented subject',operationId:randomUUID()})),scope={bindingId:doc.binding.id,parentStudyId};
 const records=new Map(),add=(title,kind,raw)=>{const id=randomUUID(),hash=digest('library:'+raw);records.set(id,{id,title,kind,hash,eligible:true,review:{state:'reviewed'},raw,bodyHash:digest(raw)});return id;};
 const lib={async parentContext(_,{sourceIds}={}){return {records:(sourceIds||[...records.keys()]).map(id=>structuredClone(records.get(id)))};}};
 const capture=(ids,expectedSourcesHash=null)=>human(()=>drafts.captureSources({...scope,operationId:randomUUID(),expectedSourcesHash,sources:ids.map(id=>({sourceId:id,sourceHash:records.get(id).hash}))},{material:lib}));
 const checks=createStudyDraftChecks({dataDir,drafts,outputs:null});
 const write=async raw=>{const d=await drafts.read(scope);return human(()=>drafts.save({...scope,expected:d.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw}]}));};
 const check=async()=>{const d=await drafts.read(scope);return checks.run({...scope,operationId:randomUUID(),expected:d.expected});};
 const room=path.join(dataDir,'study-draft-copies','copies',scope.bindingId),bindingFile=()=>JSON.parse(fs.readFileSync(path.join(dataDir,'study-draft-copies','bindings',fs.readdirSync(path.join(dataDir,'study-draft-copies','bindings'))[0]),'utf8'));
 return {dataDir,drafts,scope,add,capture,write,check,room,bindingFile};
}

// Review answer on the straddle question: measured on a new subject...
test('a quote straddling the join of two captured files does not pass', {todo:'review finding 2: run the pinned guard per added file when a draft has added sources'}, async t=>{
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
test('a draft read does not carry the full text of added sources', {todo:'review finding 4: keep raw out of readOwned; let evidence() read the copies'}, async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\n'+'Speaker: words. '.repeat(1000)+'\n');await s.capture([a]);
 const read=await s.drafts.read(s.scope);assert.equal(read.addedSources.records[0].raw,undefined);
});

// Review finding 5 (should fix): a source captured and then set aside keeps counting for Check (Decision 6), but the
// list says "You set this aside, so it is not used." Piece B will show that sentence beside a Check that still reads it.
test('the list does not say a captured source is unused while Check still reads it', {todo:'review finding 5: order the reasons so a captured source reads as used'}, async t=>{
 const s=await service(t),a=s.add('Interview','transcript','## Full Transcript\n\nSpeaker: The clay remembers every hand.\n');await s.write('"The clay remembers every hand."\n');await s.capture([a]);
 const lib={async parentContext(){return {records:[{id:a,title:'Interview',kind:'transcript',hash:'0'.repeat(64),eligible:false,setAside:true,review:{state:'unreviewed'},reason:'set aside'}]};}};
 const row=(await s.drafts.listCaptureSources(s.scope,{material:lib})).sources[0];
 const r=await s.check();assert.equal(r.status,'checked');assert.ok(r.proof.sources.some(x=>x.id.startsWith('added:'+a)),'Check still reads it');
 assert.doesNotMatch(row.reason||'',/not used/);
});
