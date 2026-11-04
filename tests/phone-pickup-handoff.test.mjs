// A plan the VPS feeder made from a phone memo is taken in by the Mac at its phone check: the memo's transcript and
// photos are filed once, the plan is adopted by matching hashes, and the phone site is told it was taken. A stub
// phone site stands in: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createPhonePickup} from '../runtime/services/phone-pickup.mjs';

const MEMO='00000000-0000-4000-8000-0000000000aa',PHOTO='00000000-0000-4000-8000-0000000000cc';
const TRANSCRIPT='[0:00] The crack records every hand.\n',JPEG=Buffer.from([0xff,0xd8,1,2,3]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bundle={schema:'ar-create.instagram-handoff.v1',plan:{id:'00000000-0000-4000-8000-0000000000bb',revision:4},sources:[{sourceId:'f1',hash:sha(Buffer.from(TRANSCRIPT)),kind:'transcript'},{sourceId:'f2',hash:sha(JPEG),kind:'photo'}]};

function stubSite(){
 const calls=[];let taken=false;
 const reply=(body,status=200)=>new Response(typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body),{status});
 const fetcher=async(url,init={})=>{
  const u=new URL(url);calls.push(init.method==='POST'?'POST '+u.pathname:u.pathname+u.search);
  if(init.headers?.Authorization!=='Bearer '+'k'.repeat(40))return reply({error:'unauthorized'},401);
  if(u.pathname==='/api/oracle/pickup/segments')return reply({segments:[]});
  if(u.pathname==='/api/oracle/pickup/memos')return reply({memos:taken?[]:[{id:MEMO,handoff:{revision:4}}]});
  if(u.pathname===`/api/oracle/pickup/memos/${MEMO}/files/handoff`)return reply(bundle);
  if(u.pathname===`/api/oracle/pickup/memos/${MEMO}`)return reply({memo:{id:MEMO,title:'Yingge kiln',createdAt:'2026-11-04T05:40:00Z'},transcript:TRANSCRIPT,files:{photos:[{id:PHOTO,name:'bowl.jpg'}]}});
  if(u.pathname===`/api/oracle/pickup/memos/${MEMO}/files/${PHOTO}`)return reply(new Uint8Array(JPEG));
  if(u.pathname===`/api/oracle/pickup/memos/${MEMO}/picked`){assert.deepEqual(JSON.parse(init.body),{by:'mac',what:'handoff'});taken=true;return reply({ok:true});}
  return reply({error:'not found'},404);
 };
 return {fetcher,calls};
}

function fakeLocal({adopt='adopted'}={}){
 const imported=[],adopted=[];
 return {imported,adopted,
  async ready(){return {ready:true};},
  async importFile({folder,name,bytes}){const id=crypto.randomUUID();imported.push({folder,name,id});return {id,hash:sha(bytes)};},
  async adoptPlan(b,local){const map=b.sources.map(s=>local(s));adopted.push({b,map});return map.every(Boolean)?{state:adopt,planId:b.plan.id,revision:b.plan.revision,why:'held for a test'}:{state:'held',why:'missing'};},
 };
}

function setup(t,local){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-handoff-')),site=stubSite();
 const pickup=createPhonePickup({dataDir:dir,readKey:async()=>({key:'k'.repeat(40),source:'environment'}),fetcher:site.fetcher,local,baseUrl:'https://phone.invalid',watchMs:0});
 t.after(()=>{pickup.stop();fs.rmSync(dir,{recursive:true,force:true});});
 return {pickup,site,dir};
}

test('a handed-on plan is filed and adopted once, and the phone site is told it was taken', async t => {
 const local=fakeLocal(),{pickup,site}=setup(t,local);
 const first=await pickup.check({reason:'start'});
 assert.equal(first.state,'ok');assert.equal(first.plans,1);
 assert.match(first.message,/1 Instagram plan from the VPS taken in/);
 assert.deepEqual(local.imported.map(f=>[f.folder,f.name]),[['Instagram/2026-11-04 Yingge kiln','2026-11-04 Yingge kiln.md'],['Instagram/2026-11-04 Yingge kiln','bowl.jpg']]);
 assert.equal(local.adopted.length,1);assert.ok(local.adopted[0].map.every(Boolean),'both files matched by hash');
 assert.ok(site.calls.includes(`POST /api/oracle/pickup/memos/${MEMO}/picked`));
 const second=await pickup.check({reason:'start'});
 assert.equal(second.plans,undefined);assert.equal(local.imported.length,2,'nothing filed twice');
});

test('a plan that cannot be adopted stays on the phone site and says why; its files are not filed again', async t => {
 const local=fakeLocal({adopt:'held'}),{pickup,site}=setup(t,local);
 const first=await pickup.check({reason:'start'});
 assert.equal(first.plansHeld,1);assert.ok(first.problems.includes('held for a test'));
 assert.ok(!site.calls.includes(`POST /api/oracle/pickup/memos/${MEMO}/picked`));
 await pickup.check({reason:'start'});
 assert.equal(local.imported.length,2,'files are kept from the first try');
 assert.equal(local.adopted.length,2,'adoption is tried again');
});
