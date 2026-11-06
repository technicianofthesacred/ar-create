import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {coherentFixture,op,words} from './helpers/coherent-journey-fixture.mjs';
import {recoveryOwners} from './helpers/simmer-recovery-owners.mjs';
import {inventedPhoto} from './helpers/simmer-demo.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {digest} from '../runtime/services/files.mjs';
import {createEventBus} from '../runtime/services/events.mjs';
import {createStudyAIExecution} from '../runtime/services/study-ai-execution.mjs';
import {createArtifactExecution} from '../runtime/services/artifact-execution.mjs';

const asAgent=fn=>withActor({actor:'agent:codex',client:'cli'},fn);

test('coherent two-topic HTTP event burst drains bounded filtered pages and restart requires canonical reread',async t=>{
 const f=await coherentFixture(t),native=await f.native(),contracts=await f.ai('contracts');
 const before=await f.request('/api/events/since?since=0&limit=1000'),sent=[];
 for(let i=0;i<260;i++){
  const scope={kind:'project',id:i%3===0?'ref-an-cha':'hk'},operationId=op();
  await f.request('/api/journal/handoff',{scope,operationId,to:'human:adrian',summary:'Invented event burst '+i});
  sent.push({scope,operationId});
 }
 const pages=async(filter={})=>{
  let cursor=before.cursor,seen=[],count=0;
  while(true){
   const route='/api/events/since?'+new URLSearchParams({since:cursor,bootId:before.bootId,limit:17,...filter});
   const page=await f.request(route);
   assert.deepEqual(await f.request(route),page,'Lost reply / duplicate poll returns the same page');
   assert.equal(page.reset,false);assert.ok(page.events.length<=17);
   seen.push(...page.events);count++;
   assert.ok(page.cursor>=cursor);cursor=page.cursor;
   if(!page.hasMore)return {seen,cursor,count};
   assert.ok(count<100,'Paging must terminate');
  }
 };
 const all=await pages();assert.ok(all.count>1);assert.deepEqual(all.seen.map(e=>e.operationId),sent.map(e=>e.operationId));
 assert.equal(new Set(all.seen.map(e=>e.cursor)).size,260);
 assert.ok(all.seen.every(e=>e.actor==='agent:codex'&&e.client==='cli'));
 for(const id of ['hk','ref-an-cha','absent-invented-topic']){
  const filtered=await pages({kind:'project',id});
  assert.deepEqual(filtered.seen.map(e=>e.operationId),sent.filter(s=>s.scope.id===id).map(s=>s.operationId));
  assert.equal(filtered.cursor,all.cursor,'Filtered gaps still reach the current head');
 }
 await f.close();await f.start();
 const reset=await f.request('/api/events/since?'+new URLSearchParams({since:all.cursor,bootId:before.bootId,limit:17,kind:'project',id:'hk'}));
 assert.equal(reset.reset,true);assert.equal(reset.resetReason,'boot-changed');assert.deepEqual(reset.events,[]);assert.equal(reset.hasMore,false);
 // Events instruct reread; the persisted owners, not an event projection, retain words and decisions.
 assert.deepEqual((await f.native()).projection,native.projection);assert.equal((await f.native()).raw,native.raw);
 assert.deepEqual(await f.ai('contracts'),contracts);
 assert.equal((await f.request('/api/concept?parentStudyId=hk')).authorThoughts,words.note);
 assert.equal((await f.request('/api/concept?parentStudyId=ref-an-cha')).authorThoughts,'');
 const resumed=await f.request('/api/events/since?'+new URLSearchParams({since:reset.cursor,bootId:reset.bootId,limit:17}));assert.equal(resumed.reset,false);
 // The bounded buffer's overflow contract is checked without fabricating HTTP owner writes.
 const bounded=createEventBus({limit:40});for(let i=0;i<61;i++)bounded.emit({kind:'synthetic-change',scope:{kind:'project',id:i%2?'hk':'ref-an-cha'}});
 const expired=bounded.since(0,{kind:'project',id:'hk'},17,bounded.bootId);
 assert.equal(expired.resetReason,'buffer-expired');assert.deepEqual(expired.events,[]);assert.equal(expired.cursor,61);
});

async function twoTopicOwners(t){
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config)),folder=path.join(home.dir,'invented-failure-photos');fs.mkdirSync(folder);
 t.after(()=>fs.rmSync(home.dir,{recursive:true,force:true}));
 for(let i=0;i<3;i++)fs.writeFileSync(path.join(folder,`photo-${i}.png`),inventedPhoto(i,32,40));
 const input={subject:'hk',title:'Invented cup, uncertain age',folder,photos:['photo-0.png','photo-1.png','photo-2.png'],words:[{text:words.note,said:'spoken'}],operationId:op()};
 const other={...input,subject:'ref-an-cha',title:'Invented owl survey',words:[{text:words.second,said:'spoken'}],operationId:op()};
 const owners=await recoveryOwners(config);await asAgent(()=>owners.chat.intake(other));
 const untouched={board:await owners.boards.read({subject:other.subject}),concept:await owners.concepts.read({parentStudyId:other.subject}),retained:await owners.library.chatRetention(other.operationId)};
 return {home,config,input,other,untouched};
}

for(const point of ['source-index','project','photo-0','photo-1','photo-2','note','membership','board','response']){
 test(`two-topic intake survives abrupt exit after ${point}: exact note, three photos, no cross-topic or duplicate writes`,async t=>{
  const f=await twoTopicOwners(t);
  // The child uses real maintained owners and exits at the durable checkpoint, without finally/response cleanup.
  const child=spawnSync(process.execPath,[path.resolve('tests/helpers/simmer-recovery-owners.mjs'),f.home.config,'intake',JSON.stringify(f.input),point],{encoding:'utf8',timeout:15000});
  assert.equal(child.status,86,child.stderr||String(child.error));
  const x=await recoveryOwners(f.config),pending=await x.chat.material({subject:f.input.subject});
  const receipt=pending.operations.find(r=>r.operationId===f.input.operationId);assert.ok(receipt,'The interrupted operation remains discoverable');
  const result=await asAgent(()=>x.chat.intake(f.input));assert.equal(result.operation.status,'complete');
  const board=await x.boards.read({subject:f.input.subject}),blocks=board.groups.flatMap(g=>g.blocks),retained=await x.library.chatRetention(f.input.operationId);
  assert.equal(blocks.length,4);assert.equal(new Set(blocks.map(b=>b.id)).size,4);
  assert.equal(blocks.find(b=>b.kind==='mine').text,words.note);
  assert.equal(blocks.find(b=>b.kind==='mine').dictated.carriedBy,'agent:codex');
  assert.equal(blocks.filter(b=>b.kind==='photo').length,3);assert.equal(retained.sources.length,4);
  const ownIds=new Set(retained.sources.map(s=>s.id)),otherIds=new Set(f.untouched.retained.sources.map(s=>s.id));
  assert.ok([...ownIds].every(id=>!otherIds.has(id)),'Intakes never adopt the other topic’s source identities');
  for(const photo of blocks.filter(b=>b.kind==='photo')){
   assert.ok(ownIds.has(photo.photo.sourceId));
   const source=retained.sources.find(s=>s.id===photo.photo.sourceId),expected=fs.readFileSync(path.join(f.input.folder,source.provenance.originalName));
   assert.equal(source.hash,digest(expected));assert.deepEqual(fs.readFileSync((await x.library.blob(source.id,true)).file),expected);
  }
  const collections=(await x.library.collections()).collections;
  assert.equal(collections.length,2);assert.ok(collections.some(c=>c.sourceIds.length===4&&c.sourceIds.every(id=>ownIds.has(id))));
  assert.ok(collections.some(c=>c.sourceIds.length===4&&c.sourceIds.every(id=>otherIds.has(id))));
  const stable={board,tree:await x.library.tree(),collections:await x.library.collections()};
  assert.equal((await asAgent(()=>x.chat.intake(f.input))).replayed,true);
  await assert.rejects(asAgent(()=>x.chat.intake({...f.input,subject:f.other.subject})),e=>e.status===409);
  await assert.rejects(asAgent(()=>x.chat.intake({...f.input,words:[{text:words.second,said:'spoken'}]})),e=>e.status===409);
  assert.deepEqual(await x.boards.read({subject:f.input.subject}),stable.board);
  assert.deepEqual(await x.library.tree(),stable.tree);assert.deepEqual(await x.library.collections(),stable.collections);
  assert.deepEqual(await x.boards.read({subject:f.other.subject}),f.untouched.board);
  assert.deepEqual(await x.concepts.read({parentStudyId:f.other.subject}),f.untouched.concept);
  assert.deepEqual((await x.library.chatRetention(f.other.operationId)).sources,f.untouched.retained.sources);
  for(const collection of f.untouched.retained.collections)assert.deepEqual(collections.find(c=>c.id===collection.id),collection);
  assert.equal((await x.library.tree()).sources.length,8);assert.equal(fs.readdirSync(path.join(f.config.dataDir,'source-originals')).length,8);
 });
}

test('deterministic execution owner: cancelled topic never stages late output or resends; independent topic completes once (no live provider)',async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w8-execution-failure-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const attempts=['hk','ref-an-cha'].map(parentStudyId=>({parentStudyId,bindingId:op(),requestId:op(),operationId:op()}));
 const contexts=attempts.map((a,i)=>({binding:{id:a.bindingId,parentStudyId:a.parentStudyId},purpose:'sourced-paragraph',request:{instruction:'Use only this invented topic.'},expected:{workflow:{draft:digest(i?words.second:words.article)}},sources:[{id:'invented-source-'+i,role:'source',raw:i?words.second:words.note,hash:digest(i?words.second:words.note)}]}));
 const sent=[],proposals=[],pending=new Map();
 const execution=createArtifactExecution({available:()=>true,execute:packet=>{const id=path.basename(packet.cwd);sent.push(id);return new Promise(resolve=>pending.set(id,{resolve,signal:packet.signal}));}});t.after(()=>execution.dispose());
 const service={call:async(action,args)=>{const i=attempts.findIndex(a=>a.bindingId===args.bindingId&&a.parentStudyId===args.parentStudyId&&a.requestId===args.requestId);assert.ok(i>=0);if(action==='context')return structuredClone(contexts[i]);assert.equal(action,'propose');proposals.push(structuredClone(args));return {id:args.requestId,status:'pending'};}};
 const config={dataDir,service,execution,validateResponse:(candidate,context)=>({sourcedParagraph:candidate.text,sourcedEvidence:{topic:context.binding.parentStudyId}})},owner=createStudyAIExecution(config);
 await Promise.all(attempts.map(a=>asAgent(()=>owner.run(a))));await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.length,2);
 await asAgent(()=>owner.run(attempts[0]));assert.equal(sent.length,2,'Exact in-flight retry does not execute again');
 await assert.rejects(asAgent(()=>owner.cancel({...attempts[0],parentStudyId:attempts[1].parentStudyId})),/scope|identity/i);
 assert.equal((await asAgent(()=>owner.cancel(attempts[0]))).state,'interrupted');assert.equal(pending.get(attempts[0].operationId).signal.aborted,true);
 for(let i=0;i<attempts.length;i++)pending.get(attempts[i].operationId).resolve({response:{artifacts:{'proposal.json':JSON.stringify({text:i?words.second:words.article})}}});
 await Promise.all(attempts.map(a=>owner.wait(a.operationId)));
 assert.equal((await owner.status(attempts[0])).state,'interrupted');assert.equal((await owner.status(attempts[1])).state,'complete');
 assert.equal(proposals.length,1);assert.equal(proposals[0].parentStudyId,'ref-an-cha');assert.equal(proposals[0].sourcedParagraph,words.second);
 const reopened=createStudyAIExecution(config);await assert.rejects(asAgent(()=>reopened.run(attempts[0])),/cancelled|interrupted|fresh/i);
 assert.equal((await asAgent(()=>reopened.run(attempts[1]))).state,'complete');
 await assert.rejects(asAgent(()=>reopened.run({...attempts[1],operationId:op()})),/attempt|request/i);
 assert.equal(sent.length,2);assert.equal(proposals.length,1);assert.deepEqual(contexts[0].sources[0].raw,words.note);
});
