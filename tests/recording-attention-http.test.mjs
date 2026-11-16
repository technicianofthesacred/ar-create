import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createRecordings} from '../runtime/services/recordings.mjs';
import {wordsFor} from '../runtime/services/words-http.mjs';
import {transcriptCheckFor} from '../runtime/services/transcript-check-http.mjs';
import {sharedNeedsYou} from '../runtime/services/needs-you.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {addRecording,seg} from './helpers/word-recording.mjs';

test('HTTP shows one real recording with usable audio; excludes historical test asks and preserves owners',async t=>{
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config));
 const server=await createServer({...config,publicDir:path.resolve('public'),researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(home.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port,recordings=createRecordings({dataDir:config.dataDir});
 const {shared}=wordsFor({dataDir:config.dataDir,recordings}),needs=sharedNeedsYou({dataDir:config.dataDir,recordings});
 const real=addRecording({dir:config.dataDir,clock:{at:Date.now()}},{story:'Pottery visit',segments:[seg(0,'We visited the pottery.'),seg(4,'We met Zorava by the kiln.',{Zorava:.1}),seg(8,'The bowl cooled overnight.')]});
 const clip=addRecording({dir:config.dataDir,clock:{at:Date.now()}},{story:'Phone clip',segments:[seg(0,'Test 1-2, test test.',{test:.1})]});
 const actor={actor:'agent:codex',client:'cli'};
 await shared.recognise({jobId:real.id},actor);
 assert.equal((await shared.recognise({jobId:clip.id},actor)).state,'excluded');
 await needs.raise({operationId:randomUUID(),band:'only-adrian',question:'Historical test word?',scope:{kind:'recording-words',id:clip.id}},actor);
 let modelCalls=0;
 const check=transcriptCheckFor({dataDir:config.dataDir,recordings,options:{available:()=>true,execute:async()=>{modelCalls++;return {text:JSON.stringify({problems:[{indexes:[1],tier:'ear',fixes:[{index:1,text:'We met Zorava beside the kiln.'}],reason:'Listen to confirm the last phrase.'}]})};}}});
 await withActor(actor,()=>check.suggest(clip.id));assert.equal(modelCalls,0,'a test recording never consumes a model call');
 await withActor(actor,()=>check.suggest(real.id));await check.wait(real.id);
 const asksFile=path.join(config.dataDir,'needs-you/asks.json'),rawBefore=fs.readFileSync(asksFile);
 let listing=await (await fetch(url+'/api/needs-you?status=all')).json();
 assert.equal(listing.asks.length,1);assert.equal(listing.counts.open,1);assert.equal(listing.counts.steer,0);
 const card=listing.asks[0];assert.equal(card.recording.wordCount,1);assert.equal(card.recording.passageCount,1);assert.equal(card.recording.items.length,1);
 assert.ok(card.recording.items[0].context.includes('cooled overnight'));assert.ok(card.recording.items[0].proposed.includes('beside'));
 const audio=await fetch(url+card.recording.items[0].audioUrl.split('#')[0],{headers:{Range:'bytes=0-7'}});assert.equal(audio.status,206);
 assert.deepEqual(fs.readFileSync(asksFile),rawBefore,'listing never completes or rewrites requests');
 const word=(await (await fetch(url+'/api/words/check?jobId='+real.id)).json()).items[0];
 assert.match(word.audioUrl,/^\/transcription\//);
 const before=recordings.transcriptCorrections.read(real.id);
 // A later foreign source edit must invalidate the old word action rather than apply it to changed speech.
 const proposal=recordings.transcriptCorrections.propose(real.id,{expected:before.expected,corrections:[{index:1,text:'We met a different person by the kiln.'}],reason:'Synthetic external edit',kind:'synthetic'});
 recordings.transcriptCorrections.decide(real.id,proposal.id,{decision:'apply',expected:recordings.transcriptCorrections.read(real.id).expected});
 const answer=await fetch(url+'/api/words/answer',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({operationId:randomUUID(),jobId:real.id,key:word.key,choice:'spelling',spelling:'Another name'})});
 assert.equal(answer.status,409);listing=await (await fetch(url+'/api/needs-you')).json();assert.equal(listing.asks.length,0,'stale word and passage work is withheld');
 assert.equal((await needs.list({id:card.id,status:'all'})).asks[0].status,'open','withheld work never impersonates an answer');
 const checkFile=path.join(config.dataDir,'transcript-checks',real.id+'.json'),saved=fs.readFileSync(checkFile);
 const jobFile=path.join(config.dataDir,'recordings/.transcription-jobs',real.id+'.json');fs.writeFileSync(jobFile,JSON.stringify({...JSON.parse(fs.readFileSync(jobFile)),purpose:'test'}));
 await withActor(actor,()=>check.suggest(real.id,{again:true}));assert.equal(modelCalls,1);assert.deepEqual(fs.readFileSync(checkFile),saved,'test exclusion preserves earlier review records');
});

test('legacy defaulted asks use current recording work and cannot approve through a stale Home shortcut',async t=>{
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config));
 const server=await createServer({...config,publicDir:path.resolve('public'),researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(home.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port,recordings=createRecordings({dataDir:config.dataDir});
 const {shared}=wordsFor({dataDir:config.dataDir,recordings});
 const real=addRecording({dir:config.dataDir,clock:{at:Date.now()}},{story:'Pottery conversation',segments:[seg(0,'The studio opened at dawn.'),seg(4,'We met Zorava beside the kiln.',{Zorava:.1}),seg(8,'The glaze cooled slowly.')]});
 const review=await shared.recognise({jobId:real.id},{actor:'agent:codex',client:'cli'});
 const asksFile=path.join(config.dataDir,'needs-you/asks.json'),wordsFile=path.join(config.dataDir,'word-library/recordings',real.id+'.json');
 const raw=JSON.parse(fs.readFileSync(asksFile)),legacy=raw.asks.find(a=>a.id===review.askId);
 Object.assign(legacy,{band:'steer',status:'defaulted',choices:['Keep all as heard','Go through them'],default:'Keep all as heard',applyAt:'2026-01-01T00:00:00.000Z',resolution:{choice:'Keep all as heard',text:'',via:'default',by:'default',at:'2026-01-01T00:00:00.000Z',operationId:null}});
 legacy.history=[{choice:'Go through them',via:'human',by:'human:adrian',at:new Date().toISOString(),operationId:randomUUID()}];
 fs.writeFileSync(asksFile,JSON.stringify(raw));
 const words=JSON.parse(fs.readFileSync(wordsFile));delete words.attentionVersion;delete words.qualifiedKeys;delete words.basis;
 words.items.push({key:'low-confidence:earlier',kind:'low-confidence',word:'earlier',sentence:'The studio opened at dawn.',segmentIndex:0,start:0,end:1,status:'kept',answer:{choice:'keep',by:'human:adrian',at:new Date().toISOString(),operationId:randomUUID()}});
 fs.writeFileSync(wordsFile,JSON.stringify(words));
 const savedAsks=fs.readFileSync(asksFile),savedWords=fs.readFileSync(wordsFile),savedTranscript=fs.readFileSync(path.join(real.output,'transcript.json'));
 // JSDOM can run past the loopback server's idle deadline before the next POST.
 const get=async route=>(await (await fetch(url+route,{headers:{Connection:'close'}})).json());
 const owner=await get('/api/words/check?jobId='+real.id);assert.equal(owner.open,1);
 const feed=await get('/api/needs-you?status=all');assert.equal(feed.asks.length,1);
 const card=feed.asks[0];assert.equal(card.status,'open','pending domain work is presented for review even after a legacy queue default');
 assert.equal(card.recording.wordCount,1);assert.equal(card.default,null);assert.equal(card.resolution,null);assert.deepEqual(card.choices,[]);
 assert.equal(feed.counts.open,1);assert.equal(feed.counts.defaulted,0);assert.ok(card.recording.items[0].audioUrl);
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
 const dom=new JSDOM('<dialog id="project-library" open><div class="ht-home-main"></div></dialog>',{runScripts:'outside-only',url});t.after(()=>dom.window.close());
 dom.window.fetch=async()=>({ok:true,json:async()=>feed});dom.window.eval(fs.readFileSync(path.resolve('public/document-study/needs-you.js'),'utf8'));await dom.window.needsYou.load();
 assert.equal(dom.window.document.querySelectorAll('.ny-recording').length,1);assert.equal(dom.window.document.querySelectorAll('[data-ny-choice]').length,0,'actual projected Home row has no bulk approval shortcut');
 assert.ok(dom.window.document.querySelector('.ny-recording audio[controls]'));assert.match(dom.window.document.querySelector('.ny-recording').textContent,/Zorava/);
 // An already-open old Home page cannot post its former bulk Keep button after the upgrade.
 const stale=await fetch(url+'/api/needs-you/answer',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({id:legacy.id,operationId:randomUUID(),choice:'Keep all as heard'})});
 assert.equal(stale.status,409);assert.match((await stale.json()).error,/recording review/i);assert.equal((await get('/api/words/check?jobId='+real.id)).open,1);
 assert.deepEqual(fs.readFileSync(asksFile),savedAsks);assert.deepEqual(fs.readFileSync(wordsFile),savedWords);assert.deepEqual(fs.readFileSync(path.join(real.output,'transcript.json')),savedTranscript);
 // This same legacy queue entry becomes invisible when its real recording is identified as a test.
 const jobFile=path.join(config.dataDir,'recordings/.transcription-jobs',real.id+'.json');fs.writeFileSync(jobFile,JSON.stringify({...real.job,purpose:'test'}));
 assert.equal((await get('/api/words/check?jobId='+real.id)).open,0);assert.equal((await get('/api/needs-you?status=all')).asks.length,0);
 assert.deepEqual(fs.readFileSync(asksFile),savedAsks);assert.deepEqual(fs.readFileSync(wordsFile),savedWords,'test exclusion preserves the saved human answer');
 // Unsupported old dictionary matches also stay out rather than falling back to the generic defaulted row.
 fs.writeFileSync(jobFile,JSON.stringify(real.job));const originalOpen=structuredClone(words.items[0]);words.items[0]={...words.items[0],key:'near-match:zorava',kind:'near-match',suggestion:'Unsupported dictionary guess',entryId:randomUUID()};fs.writeFileSync(wordsFile,JSON.stringify(words));
 assert.equal((await get('/api/words/check?jobId='+real.id)).open,0);assert.equal((await get('/api/needs-you?status=all')).asks.length,0);assert.deepEqual(fs.readFileSync(asksFile),savedAsks);
 // A genuine decision still works through the word owner, even if the queue's older defaulted receipt survives.
 words.items[0]=originalOpen;fs.writeFileSync(wordsFile,JSON.stringify(words));
 const keep=await fetch(url+'/api/words/answer',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({operationId:randomUUID(),jobId:real.id,key:originalOpen.key,choice:'keep'})});assert.equal(keep.status,200);
 const completed=await keep.json();assert.equal(completed.open,0);assert.equal(completed.items.find(i=>i.key===originalOpen.key).answer.by,'human:adrian');
 const savedHumanAnswers=fs.readFileSync(wordsFile);fs.writeFileSync(asksFile,savedAsks);
 assert.equal((await get('/api/needs-you?status=all')).asks.length,0,'a legacy defaulted queue receipt cannot resurrect completed domain work');
 assert.deepEqual(fs.readFileSync(wordsFile),savedHumanAnswers);assert.deepEqual(fs.readFileSync(asksFile),savedAsks);assert.deepEqual(fs.readFileSync(path.join(real.output,'transcript.json')),savedTranscript);
});
