// The seeded demo can be walked from a recording to an exported Carousel with no Mac, no account and no private data.
// This starts `npm run demo`'s own server on a free port, waits for its seed, then walks the chain through the app's own requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {client,walkHarbour,readDesk} from '../scripts/demo-seed.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const freePort=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>resolve(port));});server.on('error',reject);});

test('the demo seed refuses the installed app and anything that is not a demo on this machine',()=>{
 assert.throws(()=>client('http://127.0.0.1:8841'),/never the installed app/);
 assert.throws(()=>client('https://example.org'),/only talks to a demo/);
});

test('the stand-in AI and transcriber refuse to run outside a generated demo folder',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'not-a-demo-'));
 try{
  for(const name of ['codex.mjs','transcriber.mjs']){
   const file=path.join(folder,name);fs.copyFileSync(path.join(repo,'scripts/demo-standin',name),file);
   const run=spawnSync(process.execPath,[file,name==='codex.mjs'?'--version':'-c','x'],{encoding:'utf8'});
   assert.equal(run.status,3,name+' must refuse: '+run.stderr);assert.match(run.stderr,/refused/);
  }
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('walking the seeded demo: recording, transcript, research, direction, writing with one proposal finished and one rejected, photographs, a held then released Share, and an export',{timeout:420_000},async t=>{
 const port=await freePort(),output=[];
 const child=spawn(process.execPath,[path.join(repo,'scripts/demo.mjs')],{env:{...process.env,AR_CREATE_PORT:String(port),AR_CREATE_SYNTHETIC_CONFIG:''},cwd:repo,stdio:['ignore','pipe','pipe']});
 t.after(()=>{child.kill('SIGTERM');const dir=output.join('').match(/disposable files: (\S+)/)?.[1];if(dir&&path.basename(dir).startsWith('ar-create-synthetic-'))setTimeout(()=>fs.rmSync(dir,{recursive:true,force:true}),500);});
 child.stdout.on('data',chunk=>output.push(String(chunk)));child.stderr.on('data',chunk=>output.push(String(chunk)));
 const began=Date.now();while(!/Demo seeded|Seeding the demo stopped/.test(output.join(''))){if(Date.now()-began>200_000)assert.fail('The demo did not finish seeding: '+output.join(''));await new Promise(r=>setTimeout(r,500));}
 assert.match(output.join(''),/Demo seeded/,output.join(''));
 assert.notEqual(port,8841);
 const api=client('http://127.0.0.1:'+port);

 // The seed left each subject at its own stage.
 const catalog=await api.author('GET','/api/study-draft/catalog'),titles=catalog.collections.map(row=>row.title);
 for(const title of ['Harbour Morning Walk','Tea Stall Notes','Market Day','Lantern Festival','Salt Pans at Dusk'])assert.ok(titles.includes(title),title+' is seeded');
 const subject=(title)=>{const row=catalog.collections.find(r=>r.title===title);return {title,bindingId:row.bindingId,parentStudyId:row.parentStudyId};};
 const needs=await api.author('GET','/api/needs-you?status=all');
 assert.ok(needs.counts.open>=1&&needs.counts.answered>=1,'Needs you holds a waiting and an answered ask');

 const lantern=subject('Lantern Festival'),desk=await readDesk(api,lantern);
 assert.ok(desk.people.some(p=>p.name==='The lantern maker'),'Lantern Festival holds Share for someone who has not answered');
 const salt=subject('Salt Pans at Dusk'),saltDesk=await readDesk(api,salt);assert.ok(saltDesk.share.release,'Salt Pans at Dusk was released');

 // The recording's transcript carries speakers and times, and the Research answer says where it came from.
 const harbour=subject('Harbour Morning Walk');
 const {jobs}=await api.author('GET','/api/recordings'),job=jobs.find(row=>row.story==='Harbour walk interview');assert.ok(job&&job.transcriptReady&&job.reviewStatus==='reviewed','the recording is transcribed and its read-through confirmed');
 const transcript=await (await fetch(`http://127.0.0.1:${port}/transcription/${job.id}/transcript.json`)).json();
 assert.deepEqual(transcript.speakers.map(s=>s.name),['Interviewer','Guest']);assert.ok(transcript.segments.length>=8&&transcript.segments.every(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)));
 assert.equal(transcript.metadata.standIn,true,'the transcript is marked as a stand-in');
 const research=await api.author('GET','/api/study/research?'+new URLSearchParams({bindingId:harbour.bindingId,parentStudyId:harbour.parentStudyId}));
 assert.equal(research.records.length,1);const kept=await api.author('GET','/api/study/research/answer?'+new URLSearchParams({bindingId:harbour.bindingId,parentStudyId:harbour.parentStudyId,id:research.records[0].id}));
 assert.match(kept.answer.body,/^Stand-in answers for the demo/);assert.ok(kept.keptAt);

 // The author's walk.
 const seen=[];
 const {exported}=await walkHarbour(api,harbour,{at:async(name,facts)=>{seen.push(name);
  if(name==='proposal-waiting'){assert.equal(facts.review.status,'pending');assert.match(facts.review.replacements[0].words,/^Stand-in answers for the demo/);}
  if(name==='article-written')assert.ok(facts.finished.raw.includes('What I notice first is sound'),'the author\'s own paragraph is in the writing');
  if(name==='revision-rejected')assert.equal(facts.rejected.status,'rejected');
  if(name==='carousel-ready'){assert.equal(facts.made.view.output.slides.length,5);assert.ok(facts.photos.length>=3);}
  if(name==='share-held'){assert.match(facts.held.error,/on hold for consent/);assert.equal(facts.held.code,'consent-hold');}
  if(name==='share-released')assert.ok(facts.released.share.release);
 }});
 assert.deepEqual(seen,['start','proposal-waiting','article-written','revision-waiting','revision-rejected','carousel-ready','share-held','share-released','exported']);
 if(exported.error){assert.match(exported.error,/headless Chrome/,'the only acceptable reason for no export is a machine with no Chrome');t.diagnostic('Export skipped: '+exported.error);}
 else{assert.equal(exported.export.status,'complete');assert.ok(exported.export.output,'the export has its Carousel');}
});
