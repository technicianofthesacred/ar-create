import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {spawnSync} from 'node:child_process';
import {recoveryOwners} from './helpers/simmer-recovery-owners.mjs';
import {simmerOperations} from '../runtime/services/simmer-operations.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {inventedPhoto} from './helpers/simmer-demo.mjs';
const actor={actor:'agent:codex',client:'cli'},as=fn=>withActor(actor,fn),hash=b=>createHash('sha256').update(b).digest('hex');
const exact='Invented: “Keep the crack.”  Do not polish my words.\nThe kettle waits.';
async function fixture(t){
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config)),folder=fs.mkdtempSync(path.join(os.tmpdir(),'intake-photos-'));
 for(let i=0;i<3;i++)fs.writeFileSync(path.join(folder,`photo-${i}.png`),inventedPhoto(i,32,40));
 t.after(()=>{fs.rmSync(home.dir,{recursive:true,force:true});fs.rmSync(folder,{recursive:true,force:true});});
 const dataDir=config.dataDir;
 const restart=checkpoint=>recoveryOwners(config,checkpoint);
 const input={subject:'invented-kettle',title:'Invented kettle',folder,photos:['photo-0.png','photo-1.png','photo-2.png'],words:[{text:exact,said:'spoken'}],operationId:randomUUID()};
 return {dataDir,folder,input,restart,config:home.config};
}
async function owners(f,x){const tree=await x.library.tree(),collections=await x.library.collections(),board=await x.boards.read({subject:f.input.subject});let direction=null;try{direction=await x.concepts.read({parentStudyId:f.input.subject});}catch(e){if(e.status!==404)throw e;}return {sources:tree.sources.map(s=>({id:s.id,hash:s.hash})),collections:collections.collections,board,direction};}
async function success(f,x,result){
 const s=await owners(f,x),blocks=s.board.groups.flatMap(g=>g.blocks);assert.equal(blocks.length,4);assert.equal(new Set(blocks.map(b=>b.id)).size,4);assert.equal(s.sources.length,4);assert.equal(s.collections.length,1);assert.equal(s.collections[0].sourceIds.length,4);
 assert.equal(blocks.find(b=>b.kind==='mine').text,exact);assert.equal(blocks.find(b=>b.kind==='mine').dictated.carriedBy,actor.actor);
 for(const p of blocks.filter(b=>b.kind==='photo')){const source=await x.library.snapshot(p.photo.sourceId,{includeBody:false});const original=await x.library.chatRetention(f.input.operationId);const expected=fs.readFileSync(path.join(f.folder,original.sources.find(s=>s.id===source.id).provenance.originalName));assert.equal(source.hash,hash(expected));assert.deepEqual(fs.readFileSync((await x.library.blob(source.id,true)).file),expected);}
 assert.equal(result.operation.status,'complete');
}
for(const point of ['project','photo-0','photo-1','photo-2','note','membership','board','response'])test(`intake resumes after ${point} durable write, restart and lost acknowledgement`,async t=>{
 const f=await fixture(t);let injected=false,x=await f.restart(async key=>{if(key===point&&!injected){injected=true;throw Error('Injected interruption after '+point);}});
 const unrelated=await x.boards.read({subject:'unrelated'});let failure;
 await assert.rejects(as(()=>x.chat.intake(f.input)),e=>{failure=e;return !!e.receipt;});assert.equal(injected,true);assert.equal(failure.receipt.operationId,f.input.operationId);
 if(point==='membership'||point==='board')assert.equal(failure.receipt.steps.membership.status,'saved');
 if(point==='board')assert.equal(failure.receipt.steps.board.status,'saved');
 x=await f.restart();const result=await as(()=>x.chat.intake(f.input));await success(f,x,result);
 const before=await owners(f,x),again=await as(()=>x.chat.intake(f.input));assert.equal(again.replayed,true);assert.deepEqual(await owners(f,x),before);assert.deepEqual(await x.boards.read({subject:'unrelated'}),unrelated);
 await assert.rejects(as(()=>x.chat.intake({...f.input,words:['Different words']})),e=>e.status===409);
 await assert.rejects(as(()=>x.chat.intake({...f.input,subject:'unrelated'})),e=>e.status===409);
 assert.deepEqual(await owners(f,x),before);
 const receipts=simmerOperations(f.dataDir).activityReceipts();assert.equal(receipts.filter(r=>r.status==='committed').length,1);assert.ok(!JSON.stringify(receipts).includes(exact));
});
test('stale and malformed preconditions have no Library, membership, project or board side effects',async t=>{
 const f=await fixture(t),x=await f.restart(),before=await owners(f,x);
 for(const pin of [{expectedRevision:999,expectedHash:'0'.repeat(64)},{expectedRevision:0}])await assert.rejects(as(()=>x.chat.intake({...f.input,...pin})),e=>[400,409].includes(e.status));
 assert.deepEqual(await owners(f,x),before);assert.equal(simmerOperations(f.dataDir).read(f.input.operationId),null);
});
test('mid-import competing board write is partial, keeps original pin and resumes only with explicit current guard',async t=>{
 const f=await fixture(t);let x,competed=false;
 x=await f.restart(async point=>{if(point!=='photo-0'||competed)return;competed=true;const b=await x.boards.read({subject:f.input.subject});await x.boards.save({subject:b.subject,operationId:randomUUID(),expectedRevision:b.revision,expectedHash:b.hash,board:{...b,title:'Competing title'}});});
 let receipt;await assert.rejects(as(()=>x.chat.intake(f.input)),e=>{receipt=e.receipt;return e.status===409;});
 assert.equal(receipt.steps.membership.status,'saved');assert.notEqual(receipt.steps.board.status,'saved');assert.equal((await owners(f,x)).sources.length,4);assert.equal((await owners(f,x)).board.groups.length,0);
 x=await f.restart();await assert.rejects(as(()=>x.chat.intake(f.input)),e=>e.status===409);assert.equal((await owners(f,x)).sources.length,4);
 const b=await x.boards.read({subject:f.input.subject});assert.equal(b.intakeOperations[0].status,'partial');
 const recovered=await as(()=>x.chat.intake({...f.input,resume:{expectedRevision:b.revision,expectedHash:b.hash}}));await success(f,x,recovered);assert.equal(recovered.title,'Invented kettle');assert.equal((await x.boards.read({subject:b.subject})).title,'Competing title');
});
test('simultaneous identical retries coalesce, changed input is refused and unrelated subjects remain independent',async t=>{
 const f=await fixture(t),x=await f.restart();const [a,b]=await as(()=>Promise.all([x.chat.intake(f.input),x.chat.intake(f.input)]));await success(f,x,a);assert.equal(b.replayed,true);
});
for(const point of ['note','direction','board','response'])test(`dish resumes after ${point} with one exact note and guarded Direction`,async t=>{
 const f=await fixture(t);let x=await f.restart();await as(()=>x.chat.intake(f.input));const sentence='Invented: keep the crack, for the first person awake.',input={subject:f.input.subject,sentence,said:'spoken',operationId:randomUUID()};let injected=false;
 x=await f.restart(async key=>{if(key===point&&!injected){injected=true;throw Error('Injected '+point);}});
 await assert.rejects(as(()=>x.chat.dish(input)),e=>!!e.receipt);assert.equal(injected,true);
 x=await f.restart();const out=await as(()=>x.chat.dish(input));assert.equal(out.named.text,sentence);assert.equal(out.direction.status,'saved');assert.equal((await x.concepts.read({parentStudyId:input.subject})).adoptedDirection,sentence);assert.equal((await x.library.tree()).sources.length,5);
 const before=await owners(f,x);assert.equal((await as(()=>x.chat.dish(input))).replayed,true);await assert.rejects(as(()=>x.chat.dish({...input,sentence:'A different sentence.'})),e=>e.status===409);assert.deepEqual(await owners(f,x),before);
});
test('Library owner retries reconcile writes whose caller never received a return value',async t=>{
 const f=await fixture(t),x=await f.restart(),input={operationId:randomUUID(),slot:'photo-0',folder:'Original folder',name:'one.png',bytes:inventedPhoto(0,32,40),provenance:{kind:'chat-intake'}};
 const first=await x.library.retainChatFile(input),fresh=await f.restart(),second=await fresh.library.retainChatFile(input);assert.equal(first.id,second.id);assert.equal((await fresh.library.tree()).sources.length,1);
 await assert.rejects(fresh.library.retainChatFile({...input,bytes:Buffer.from('different')}),e=>e.status===409);
 const c={operationId:input.operationId,name:'Kept once',sourceIds:[first.id]},one=await fresh.library.ensureChatCollection(c),again=await (await f.restart()).library.ensureChatCollection(c);assert.equal(one.collection.id,again.collection.id);assert.equal(again.collection.sourceIds.length,1);
 await assert.rejects(fresh.library.ensureChatCollection({...c,name:'Changed title'}),e=>e.status===409);
});

for(const point of ['source-index','photo-0','membership','board'])test(`abrupt process exit at ${point} recovers without acknowledgement or duplicate originals`,async t=>{
 const f=await fixture(t),child=spawnSync(process.execPath,[path.resolve('tests/helpers/simmer-recovery-owners.mjs'),f.config,'intake',JSON.stringify(f.input),point],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
 const x=await f.restart();const beforeRetry=await x.chat.material({subject:f.input.subject}),receipt=beforeRetry.operations.find(r=>r.operationId===f.input.operationId);assert.equal(receipt.status,'running');assert.equal(receipt.steps[point==='source-index'?'photo-0':point].status,'unconfirmed');assert.ok(receipt.recovery);let discovered=null,externalCollection=null;
 if(point==='source-index'){const tree=await x.library.tree();discovered=tree.sources.find(s=>s.rel_path.includes(f.input.operationId));assert.ok(discovered);const c=await x.library.collections();externalCollection=(await x.library.saveCollection({name:'Independent browse reference',sourceIds:[discovered.id],expectedRevision:c.revision})).collection;}
 const out=await as(()=>x.chat.intake(f.input));
 if(discovered){assert.equal((await x.library.snapshot(discovered.id)).id,discovered.id);assert.deepEqual((await x.library.collections()).collections.find(c=>c.id===externalCollection.id).sourceIds,[discovered.id]);assert.equal((await x.library.tree()).sources.length,4);assert.equal(out.groups.flatMap(g=>g.blocks).length,4);}else await success(f,x,out);
 assert.equal(fs.readdirSync(path.join(f.dataDir,'source-originals')).length,4);
});
test('abrupt process exit after Direction commit preserves exact sentence on retry',async t=>{
 const f=await fixture(t);let x=await f.restart();await as(()=>x.chat.intake(f.input));const input={subject:f.input.subject,sentence:'Invented: a careful cup.',operationId:randomUUID()};
 const child=spawnSync(process.execPath,[path.resolve('tests/helpers/simmer-recovery-owners.mjs'),f.config,'dish',JSON.stringify(input),'direction'],{encoding:'utf8'});assert.equal(child.status,86,child.stderr);
 x=await f.restart();const pending=await x.chat.material({subject:input.subject});assert.equal(pending.operations.find(r=>r.operationId===input.operationId).steps.direction.status,'unconfirmed');const out=await as(()=>x.chat.dish(input));assert.equal(out.named.text,input.sentence);assert.equal((await x.concepts.read({parentStudyId:input.subject})).adoptedDirection,input.sentence);assert.equal((await x.library.tree()).sources.length,5);
});

test('equal Direction words from another operation are not proof of this interrupted operation',async t=>{
 const f=await fixture(t),x=await f.restart();await as(()=>x.chat.intake(f.input));
 const sentence='Invented: a sentence already saved by another choice.';
 await as(()=>x.chat.dish({subject:f.input.subject,sentence,operationId:randomUUID()}));
 const input={subject:f.input.subject,sentence,operationId:randomUUID()};
 const interrupted=await f.restart(key=>{if(key==='direction')throw Error('Lost unchanged acknowledgement');});
 let receipt;await assert.rejects(as(()=>interrupted.chat.dish(input)),e=>{receipt=e.receipt;return !!receipt;});assert.notEqual(receipt.steps.direction.status,'saved');
});

test('legacy board receipts refuse an unprovable payload replay before any source side effect',async t=>{
 const f=await fixture(t),x=await f.restart(),b=await x.boards.read({subject:f.input.subject});
 await as(()=>x.boards.save({subject:f.input.subject,operationId:f.input.operationId,expectedRevision:b.revision,expectedHash:b.hash,board:b}));const before=await owners(f,x);
 await assert.rejects(as(()=>x.chat.intake(f.input)),e=>e.status===409);assert.deepEqual(await owners(f,x),before);
});

for(const owner of ['membership','photo'])test(`a competing ${owner} change before board publication is held until explicitly restored`,async t=>{
 const f=await fixture(t);let x,removed,restoreBytes,restoreFile,changed=false;
 x=await f.restart(async point=>{if(point!=='membership'||changed)return;changed=true;
  const c=(await x.library.collections()).collections[0];
  if(owner==='membership'){removed=c;const v=await x.library.collections();await x.library.saveCollection({...c,sourceIds:c.sourceIds.slice(1),expectedRevision:v.revision});}
  else{const s=(await x.library.chatRetention(f.input.operationId)).sources.find(s=>s.provenance.slot==='photo-0');restoreFile=s.path;restoreBytes=fs.readFileSync(s.path);fs.writeFileSync(s.path,inventedPhoto(2,32,40));}
 });
 await assert.rejects(as(()=>x.chat.intake(f.input)),e=>e.status===409&&!!e.receipt);assert.equal((await x.boards.read({subject:f.input.subject})).groups.length,0);
 if(removed){const v=await x.library.collections();await x.library.saveCollection({...removed,expectedRevision:v.revision});}else fs.writeFileSync(restoreFile,restoreBytes);
 const out=await as(()=>x.chat.intake(f.input));await success(f,x,out);
});
