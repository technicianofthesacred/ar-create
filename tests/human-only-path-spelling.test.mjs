// The human-only gate, the journal and the router must all agree on the path. A caller that spells the
// path differently (percent-encoding, an encoded slash, `..`, a backslash) reaches the same handler, so it
// must meet the same refusal and leave the same journal line (review, 12 Nov 2026).
// fetch() tidies paths before sending, so these requests go out through node:http with the path untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const port=server.address().port;
 const post=(rawPath,actor,client='cli',input={operationId:randomUUID()})=>new Promise((resolve,reject)=>{
  const data=JSON.stringify(input);
  const request=http.request({host:'127.0.0.1',port,path:rawPath,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),'X-AR-Actor':actor,'X-AR-Client':client}},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));});
  request.on('error',reject);request.end(data);
 });
 const journal=async()=>(await (await fetch(`http://127.0.0.1:${port}/api/journal?limit=100`)).json()).lines;
 return {post,journal};
}

const SPELLINGS=[
 ['/api/first-flow/material-triage','/api/first-flow/material-triag%65'],
 ['/api/first-flow/material-triage','/api/first-flow%2Fmaterial-triage'],
 ['/api/first-flow/material-triage','/%61pi/first-flow/material-triage'],
 ['/api/study-draft/save','/api/study-draft/sav%65'],
 ['/api/study/language/accept','/api/study/language%2faccept'],
];

for(const [plain,spelled] of SPELLINGS){
 test(`${spelled} is refused to an agent exactly as ${plain} is`,async t=>{
  const f=await setup(t);
  const expected=await f.post(plain,'agent:codex');
  assert.equal(expected.status,403);assert.match(expected.body.error,/^This decision is human-only; agent:codex may propose but not decide\.$/);
  for(const actor of ['agent:codex','agent:claude-code','cron:nightly']){
   const out=await f.post(spelled,actor);
   assert.equal(out.status,403,`${actor} ${spelled} ${JSON.stringify(out.body)}`);
   assert.equal(out.body.error,`This decision is human-only; ${actor} may propose but not decide.`);
  }
  // The same spelling from Adrian still passes the gate and reaches the handler.
  const human=await f.post(spelled,'human:adrian','ui');
  assert.doesNotMatch(String(human.body.error||''),/human-only/);
 });
}

test('confirming a transcript is refused to an agent however the path is spelled',async t=>{
 const f=await setup(t),id=randomUUID();
 for(const rawPath of [`/transcription/${id}/review`,`/transcription/x/../${id}/review`,`/transcription/${id}\\review`,`/transcription/./${id}/review`,`/transcription/${id}/../${id}/review`]){
  const out=await f.post(rawPath,'agent:codex');
  assert.equal(out.status,403,rawPath);assert.equal(out.body.error,'This decision is human-only; agent:codex may propose but not decide.');
 }
});

test('a /transcription/ write is journaled under its command however the path is spelled',async t=>{
 const f=await setup(t),id=randomUUID();
 // recover is open to agents, so these pass the gate; the journal must still see all four.
 const paths=[`/transcription/${id}/recover`,`/transcription/x/../${id}/recover`,`/transcription/${id}\\recover`,`/transcription/./${id}/recover`];
 const statuses=[];for(const rawPath of paths)statuses.push((await f.post(rawPath,'agent:codex')).status);
 // All four reach the recordings router as the same route, so all four answer alike...
 assert.notEqual(statuses[0],403);assert.deepEqual(statuses,paths.map(()=>statuses[0]));
 // ...and all four are in the journal under the transcription command, attributed to the caller.
 const lines=(await f.journal()).filter(line=>line.actor==='agent:codex'&&line.kind==='.transcription.id.action');
 assert.equal(lines.length,paths.length,JSON.stringify(lines.map(line=>line.kind)));
});
