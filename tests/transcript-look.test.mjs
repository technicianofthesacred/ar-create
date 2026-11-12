// The read-only look at one transcript (GET /transcription/{id}/look, command .transcription.id.look): its words, speakers and
// review stamp, for the subject screen's confirm panel. It must never lock, create, recover or rewrite anything, and the stamp
// must be the real one (who reviewed, on the current bytes). Invented content only (the workshop fixture's tone transcript).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createServer} from '../runtime/server.mjs';import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';

async function scene(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'transcript-look-'))),dataDir=path.join(dir,'data');
 const fixture=createWorkshopFixture(dataDir);fs.writeFileSync(path.join(fixture.output,'transcribe.json'),JSON.stringify(fixture.original));
 const server=await createServer({dataDir,publicDir:path.resolve('public'),researchEnabled:false,transcriptionRuntime:{python:'/no-interpreter'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,actor='human:adrian')=>{const response=await fetch(base+route,body===undefined?{headers:{'x-ar-actor':actor}}:{method:'POST',headers:{'content-type':'application/json','x-ar-actor':actor,origin:base},body:JSON.stringify(body)});let json=null;try{json=await response.json();}catch{}return {status:response.status,body:json};};
 const tree=root=>{const out={};const walk=d=>{for(const n of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,n.name);if(n.isDirectory())walk(f);else out[path.relative(root,f)]=fs.readFileSync(f).toString('base64');}};walk(root);return out;};
 return {fixture,call,tree,dataDir,url:'/transcription/'+fixture.id+'/look'};
}
const confirmAs=async(s,actor)=>{
 const rec=await s.call('/transcription/'+s.fixture.id+'/recover',{},actor);assert.equal(rec.status,200);
 const named=await s.call('/transcription/'+s.fixture.id+'/speakers',{expected:rec.body.expected,names:{s1:'Mara',s2:'Jon'}},actor);assert.equal(named.status,200);
 const done=await s.call('/transcription/'+s.fixture.id+'/review',{expected:named.body.expected,confirmed:true},actor);assert.equal(done.status,200);
};

test('the look gives the words, the speakers and an honest "not reviewed" for a fresh transcript, and any actor may read it',async t=>{
 const s=await scene(t);
 for(const actor of ['human:adrian','agent:codex']){
  const r=await s.call(s.url,undefined,actor);assert.equal(r.status,200);
  assert.deepEqual(Object.keys(r.body).sort(),['coherent','jobId','reviewStatus','reviewedAt','reviewedBy','segments','speakers']);
  assert.equal(r.body.jobId,s.fixture.id);assert.equal(r.body.reviewStatus,'unreviewed');assert.equal(r.body.reviewedBy,null);
  assert.deepEqual(r.body.speakers,[{id:'s1',name:null},{id:'s2',name:null}]);
  assert.deepEqual(r.body.segments.map(g=>g.text),s.fixture.original.segments.map(g=>g.text));
 }
});

test('the look leaves every file under the data folder byte for byte as it was (no lock, no mapping, no publication)',async t=>{
 const s=await scene(t);
 const before=s.tree(s.dataDir);
 for(const actor of ['human:adrian','agent:codex','agent:codex'])assert.equal((await s.call(s.url,undefined,actor)).status,200);
 assert.deepEqual(s.tree(s.dataDir),before,'a fresh transcript is not initialized by looking');
 assert.ok(!fs.existsSync(path.join(s.fixture.output,'.corrections')),'no mapping folder made');
 // After a real confirm the same holds: looking changes nothing.
 await confirmAs(s,'human:adrian');
 const after=s.tree(s.dataDir);
 assert.equal((await s.call(s.url,undefined,'agent:codex')).status,200);assert.deepEqual(s.tree(s.dataDir),after);
});

test('the stamp names who reviewed, on the current bytes: a human, an assistant, and nothing once the words change',async t=>{
 const human=await scene(t);await confirmAs(human,'human:adrian');
 const h=(await human.call(human.url)).body;assert.equal(h.reviewStatus,'reviewed');assert.equal(h.reviewedBy,'human:adrian');assert.deepEqual(h.speakers.map(x=>x.name),['Mara','Jon']);
 const agent=await scene(t);await confirmAs(agent,'agent:codex');
 const a=(await agent.call(agent.url)).body;assert.equal(a.reviewStatus,'reviewed');assert.equal(a.reviewedBy,'agent:codex','the server accepts an assistant\'s review and the look says so');
 // Changing the words by hand (outside the correction boundary) means the stamp is not on the current bytes.
 const file=path.join(human.fixture.output,'transcript.json'),edited=JSON.parse(fs.readFileSync(file,'utf8'));edited.segments[0].text='Changed by hand.';fs.writeFileSync(file,JSON.stringify(edited,null,2));
 const r=(await human.call(human.url)).body;assert.equal(r.reviewStatus,'unreviewed');assert.equal(r.reviewedBy,null);assert.equal(r.coherent,false);
});

test('the look refuses an unknown or unready recording in plain words',async t=>{
 const s=await scene(t);
 const r=await s.call('/transcription/00000000-0000-4000-8000-000000000000/look');assert.ok(r.status>=400&&r.status<500);assert.equal(typeof r.body.error,'string');
});
