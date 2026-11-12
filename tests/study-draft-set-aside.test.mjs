// study-draft.set-aside and study-draft.set-aside.list: words of Adrian's kept off the page (the unsaved version he did not
// keep when two versions met, words a closed tab left on a device, a save that could not be delivered). His only; never
// written into the draft; never changed or removed; the same operation sent twice is the same answer. Invented words only.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {withActor} from '../runtime/services/actor.mjs';import {digest} from '../runtime/services/files.mjs';
import {syntheticHome} from '../scripts/demo.mjs';import {createServer} from '../runtime/server.mjs';
const human=fn=>withActor({actor:'human:adrian',client:'ui'},fn),agent=(fn,actor='agent:codex')=>withActor({actor,client:'cli'},fn);

async function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'set-aside-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>{throw Object.assign(Error('No originals.'),{status:404});}}}),parentStudyId='subject-'+randomUUID();
 let doc=await human(()=>drafts.createCollection({parentStudyId,title:'Invented subject',operationId:randomUUID()}));
 const scope={bindingId:doc.binding.id,parentStudyId};
 doc=await drafts.read(scope);
 doc=await human(()=>drafts.save({...scope,expected:doc.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'The straw goes down at dawn.\n'}]}));
 const room=path.join(dataDir,'study-draft-copies','copies',scope.bindingId);
 const tree=()=>Object.fromEntries(fs.readdirSync(room,{recursive:true}).sort().filter(p=>fs.lstatSync(path.join(room,p)).isFile()&&!p.startsWith('set-aside')).map(p=>[p,digest(fs.readFileSync(path.join(room,p)))]));
 return {dataDir,drafts,scope,room,tree,doc:()=>doc};
}
const words=(scope,extra={})=>({...scope,operationId:randomUUID(),reason:'conflict',paragraphs:[{id:'p1',words:'My own words for the straw, typed here.'}],...extra});

test('Adrian sets words aside: kept as he sent them, with who and when, and the draft is never opened or changed',async t=>{
 const f=await fixture(t),before=f.tree(),read=await f.drafts.read(f.scope);
 const input=words(f.scope,{expected:read.expected,paragraphs:[{id:'p1',words:'My own words for the straw, typed here.',baseHash:digest('The straw goes down at dawn.'),savedHash:digest('Other words.')},{words:'A new paragraph of mine.'}]});
 const out=await human(()=>f.drafts.setAside(input));
 assert.equal(out.replayed,false);assert.equal(out.entry.actor,'human:adrian');assert.equal(out.entry.reason,'conflict');assert.match(out.entry.at,/^\d{4}-/);
 assert.deepEqual(out.entry.paragraphs.map(p=>[p.id,p.words]),[['p1','My own words for the straw, typed here.'],[null,'A new paragraph of mine.']]);
 assert.equal(out.entry.paragraphs[0].wordsHash,digest('My own words for the straw, typed here.'));
 assert.deepEqual(out.entry.expected,read.expected);
 assert.deepEqual(f.tree(),before,'nothing else in the draft\'s folder changed');
 const again=await f.drafts.read(f.scope);assert.equal(again.raw,read.raw);assert.deepEqual(again.expected,read.expected);assert.equal(Object.hasOwn(again,'setAside'),false,'the draft read is as before');
 const list=await agent(()=>f.drafts.listSetAside(f.scope));
 assert.equal(list.items.length,1);assert.deepEqual(list.damaged,[]);assert.equal(list.items[0].paragraphs[1].words,'A new paragraph of mine.');
 const file=path.join(f.room,'set-aside',input.operationId+'.json');assert.equal(fs.statSync(file).mode&0o777,0o400,'read-only once written');
});

test('the same operation sent twice is the first answer; a different request under that id is refused; nothing is overwritten',async t=>{
 const f=await fixture(t),input=words(f.scope);
 const one=await human(()=>f.drafts.setAside(input)),two=await human(()=>f.drafts.setAside(structuredClone(input)));
 assert.equal(two.replayed,true);assert.deepEqual(two.entry,one.entry);assert.equal(two.items.length,1);
 await assert.rejects(human(()=>f.drafts.setAside({...input,paragraphs:[{id:'p1',words:'Something else.'}]})),e=>e.status===409);
 assert.equal((await f.drafts.listSetAside(f.scope)).items[0].paragraphs[0].words,'My own words for the straw, typed here.');
 const second=await human(()=>f.drafts.setAside(words(f.scope,{reason:'recovery'})));
 assert.deepEqual(second.items.map(e=>e.reason),['conflict','recovery'],'kept in the order they were set aside');
});

test('only Adrian may set words aside: an agent, another actor and an unattributed caller get 403 and nothing is written',async t=>{
 const f=await fixture(t);
 for(const actor of ['agent:codex','agent:claude-code','cron:nightly'])await assert.rejects(agent(()=>f.drafts.setAside(words(f.scope)),actor),e=>e.status===403&&/Adrian/.test(e.message));
 await assert.rejects(f.drafts.setAside(words(f.scope)),e=>e.status===403);
 assert.equal(fs.existsSync(path.join(f.room,'set-aside')),false);
 assert.deepEqual((await agent(()=>f.drafts.listSetAside(f.scope))).items,[],'an assistant may read the list');
});

test('malformed requests are refused before anything is written',async t=>{
 const f=await fixture(t);
 const bad=[{reason:'because'},{paragraphs:[]},{paragraphs:[{words:'   '}]},{paragraphs:[{words:'ok',extra:1}]},{paragraphs:[{id:'',words:'ok'}]},{paragraphs:[{words:'ok',baseHash:'nope'}]},{operationId:'x'},{expected:'h1'},{surprise:true},{paragraphs:[{words:'a\u0000b'}]}];
 for(const extra of bad)await assert.rejects(human(()=>f.drafts.setAside(words(f.scope,extra))),e=>e.status===400,JSON.stringify(extra));
 await assert.rejects(human(()=>f.drafts.setAside(words({...f.scope,parentStudyId:'another'}))),e=>e.status>=400);
 await assert.rejects(human(()=>f.drafts.setAside(words({...f.scope,bindingId:randomUUID()}))),e=>e.status===404);
 assert.equal(fs.existsSync(path.join(f.room,'set-aside')),false);
});

test('an entry changed outside the app is reported as damaged and never offered as his words',async t=>{
 const f=await fixture(t),input=words(f.scope);await human(()=>f.drafts.setAside(input));
 const file=path.join(f.room,'set-aside',input.operationId+'.json');fs.chmodSync(file,0o600);
 const e=JSON.parse(fs.readFileSync(file,'utf8'));e.paragraphs[0].words='Not what he wrote.';fs.writeFileSync(file,JSON.stringify(e));
 const list=await f.drafts.listSetAside(f.scope);assert.deepEqual(list.items,[]);assert.deepEqual(list.damaged,[input.operationId+'.json']);
});

test('over HTTP: Adrian sets aside, an assistant gets 403 and can read the list; the commands are in /api/capabilities',async t=>{
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port,as=actor=>({'X-AR-Actor':actor,'X-AR-Client':'cli'});
 const call=async(route,input,headers)=>{const r=await fetch(url+route,input===undefined?{headers}:{method:'POST',headers:{'Content-Type':'application/json',Origin:url,...headers},body:JSON.stringify(input)});return {status:r.status,body:await r.json()};};
 const caps=(await call('/api/capabilities?only=commands',undefined,{})).body.commands;
 const one=caps.find(c=>c.name==='study-draft.set-aside'),two=caps.find(c=>c.name==='study-draft.set-aside.list');
 assert.ok(one&&two,'both are in the registry');
 assert.deepEqual([one.method,one.readOnly,one.actors],['POST',false,['human']]);assert.deepEqual([two.method,two.readOnly,two.actors],['GET',true,['any']]);
 const parentStudyId='subject-'+randomUUID();
 const made=await call('/api/study-draft/create-collection',{parentStudyId,title:'Invented subject',operationId:randomUUID()},as('human:adrian'));
 assert.equal(made.status,200,JSON.stringify(made.body));
 const scope={bindingId:made.body.binding.id,parentStudyId};
 const refused=await call('/api/study-draft/set-aside',words(scope),as('agent:codex'));
 assert.equal(refused.status,403);
 const ok=await call('/api/study-draft/set-aside',words(scope),as('human:adrian'));
 assert.equal(ok.status,200,JSON.stringify(ok.body));
 const listed=await call('/api/study-draft/set-aside/list?bindingId='+scope.bindingId+'&parentStudyId='+encodeURIComponent(parentStudyId),undefined,as('agent:codex'));
 assert.equal(listed.status,200);assert.equal(listed.body.items.length,1);assert.equal(listed.body.items[0].actor,'human:adrian');
});
