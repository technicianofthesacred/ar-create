// The phone pickup: the Mac asks the phone site what waits for a better transcript, runs each recording through its own
// pipeline and posts the result back. A fake phone site and a fake transcriber stand in: no network, no model, no paid API.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createPhonePickup,createKeyReader,SETUP,KEY_NAME,AUTO_CHECK_MIN_GAP_MS,INFISICAL_PROJECT_ID} from '../runtime/services/phone-pickup.mjs';
import {startPhoneSite,fakeLocal,fakeWords,KEY,WRONG_KEY} from './helpers/fake-phone-site.mjs';

async function setup(t,{segments=[{id:randomUUID()}],key=KEY,siteKey=KEY,local=fakeLocal(),words=fakeWords(),notReady=false}={}){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-pickup-')));
 const site=await startPhoneSite({key:siteKey,segments,notReady});
 const clock={at:Date.parse('2026-11-03T08:00:00Z')};
 const pickup=createPhonePickup({dataDir:dir,readKey:async()=>({key,source:key?'environment':null}),local,words,baseUrl:site.origin,now:()=>clock.at,watchMs:0});
 t.after(async()=>{pickup.stop();await site.close();fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,site,clock,pickup,local,words,ids:[...site.rows.keys()]};
}

test('no key: nothing is sent anywhere, and the screen says what to do',async t=>{
 const f=await setup(t,{key:null});
 const result=await f.pickup.check({reason:'button'});
 assert.equal(result.state,'needs-key');assert.match(result.message,/Needs a pickup key, see setup/);
 assert.equal(f.site.seen.lists,0,'the phone site was not asked');assert.equal(f.site.seen.unauthorised,0);
 const status=await f.pickup.status();
 assert.equal(status.state,'needs-key');assert.equal(status.setup,SETUP);
 assert.ok(SETUP.command.includes(KEY_NAME));assert.match(SETUP.command,/wrangler pages secret put/);assert.match(SETUP.command,/secrets set/);
 assert.ok(SETUP.command.includes(INFISICAL_PROJECT_ID));
 assert.ok(!/[–—]/.test(JSON.stringify(SETUP)),'no dashes in the copy');
 assert.equal(await f.pickup.checkOnStart(),null,'no key, no automatic check either');
});

test('a wrong key is refused by the phone site and said plainly; a site with no key set says so',async t=>{
 const wrong=await setup(t,{key:WRONG_KEY});
 const refused=await wrong.pickup.check({reason:'command'});
 assert.equal(refused.state,'key-refused');assert.match(refused.message,/did not accept the pickup key/);
 assert.equal(wrong.local.calls.imports.length,0);
 const unset=await setup(t,{notReady:true});
 assert.equal((await unset.pickup.check({reason:'command'})).state,'phone-not-ready');
});

test('a recording is fetched, transcribed on the Mac, checked for words and sent back as a new version',async t=>{
 const f=await setup(t),[id]=f.ids;
 const result=await f.pickup.check({reason:'button'});
 assert.equal(result.state,'ok');assert.equal(result.found,1);assert.equal(result.finished,1);
 assert.deepEqual(f.local.calls.imports[0].bytes,f.site.rows.get(id).bytes,'the Mac got the phone audio, byte for byte');
 assert.match(f.local.calls.imports[0].name,new RegExp(`^phone-${id}\\.m4a$`));
 assert.equal(f.local.calls.started.length,1);
 assert.equal(f.words.calls.length,1,'the word check ran on the finished transcript');assert.equal(f.words.calls[0].jobId,f.local.calls.started[0]);
 const sent=f.site.seen.posts[0].body;
 assert.equal(sent.outcome,'improved');assert.equal(sent.engine,'ar-create');assert.equal(sent.text,'Lu Yu wrote the Classic of Tea. The gaiwan was warmed.');
 assert.match(sent.resultHash,/^[a-f0-9]{64}$/);assert.equal(sent.segments[0].words[0].text,'Lu');assert.equal(sent.speakers[0].name,'Adrian');
 assert.equal(f.site.rows.get(id).draft,'a quick draft','the phone draft is not touched from here');
 assert.equal(f.site.rows.get(id).improved.text,sent.text);
 const again=await f.pickup.check({reason:'command'});
 assert.equal(again.recent,true,'a second press within seconds does not go back to the phone site');
 f.clock.at+=60_000;
 const later=await f.pickup.check({reason:'command'});
 assert.equal(later.found,0);assert.equal(f.local.calls.imports.length,1,'never imported twice');assert.equal(f.site.seen.posts.length,1,'never posted twice');
 assert.equal((await f.pickup.status()).counts.sentBack,1);
});

test('a slow transcription is finished later without asking the phone site again',async t=>{
 const f=await setup(t,{local:fakeLocal({autoFinish:false})}),[id]=f.ids;
 const first=await f.pickup.check({reason:'button'});
 assert.equal(first.transcribing,1);assert.equal(first.finished,0);assert.match(first.message,/being transcribed/);
 assert.equal(f.site.rows.get(id).improved,null);
 await f.pickup.advance();assert.equal(f.site.rows.get(id).improved,null,'still running, nothing sent');
 const listsBefore=f.site.seen.lists;
 f.local.finish(f.local.calls.started[0]);
 await f.pickup.advance();
 assert.equal(f.site.rows.get(id).improved.engine,'ar-create');
 assert.equal(f.site.seen.lists,listsBefore,'finishing never lists the phone site');
 assert.equal((await f.pickup.status()).counts.sentBack,1);
});

test('transcription not connected: the recording waits, nothing is lost, and it says why',async t=>{
 const f=await setup(t,{local:fakeLocal({ready:false})});
 const result=await f.pickup.check({reason:'button'});
 assert.equal(result.waiting,1);assert.match(result.message,/waiting for transcription to be connected/);assert.ok(result.problems[0].includes('not connected'));
 assert.equal(f.site.seen.audio,0,'the audio is not fetched until it can be used');
});

test('a failed attempt is tried again next time; a recording that cannot be done is set aside so it stops coming back',async t=>{
 const f=await setup(t),[id]=f.ids;
 f.local.calls.failImportOnce=true;
 const first=await f.pickup.check({reason:'button'});
 assert.equal(first.failed,1);assert.equal(f.site.rows.get(id).improved,null);
 f.clock.at+=60_000;
 const second=await f.pickup.check({reason:'button'});
 assert.equal(second.finished,1,'the retry worked');
 // a transcription that fails outright is set aside, not retried forever
 const g=await setup(t,{local:fakeLocal({autoFinish:false})});
 await g.pickup.check({reason:'button'});
 g.local.fail(g.local.calls.started[0],'The model stopped.');
 await g.pickup.advance();
 const gid=g.ids[0];
 assert.match(g.site.rows.get(gid).skipped,/could not improve this one/);
 assert.equal(g.site.rows.get(gid).improved,null,'the phone draft stands');
 g.clock.at+=60_000;
 assert.equal((await g.pickup.check({reason:'command'})).found,0);
 assert.equal((await g.pickup.status()).counts.setAside,1);
});

test('only five new recordings are taken on at a time',async t=>{
 const f=await setup(t,{segments:Array.from({length:8},()=>({id:randomUUID()}))});
 const result=await f.pickup.check({reason:'button'});
 assert.equal(result.started,5);assert.equal(result.finished,5);
 f.clock.at+=60_000;
 assert.equal((await f.pickup.check({reason:'button'})).finished,3,'the rest on the next check');
});

test('the start-up check runs at most once every twelve hours and only with a key',async t=>{
 const f=await setup(t);
 const first=await f.pickup.checkOnStart();assert.equal(first.reason,'start');
 f.site.add();f.clock.at+=AUTO_CHECK_MIN_GAP_MS-1000;
 assert.equal(await f.pickup.checkOnStart(),null,'too soon');assert.equal(f.site.seen.lists,1);
 f.clock.at+=2000;
 assert.equal((await f.pickup.checkOnStart()).finished,1,'twelve hours later');
});

test('the key is read from the environment, then from the key store, and never appears in files or messages',async t=>{
 const calls=[];
 const fromEnv=createKeyReader({env:{[KEY_NAME]:KEY},run:async a=>{calls.push(a);return '';}});
 assert.deepEqual(await fromEnv(),{key:KEY,source:'environment'});assert.equal(calls.length,0);
 const store=createKeyReader({env:{},run:async a=>{calls.push(a);return KEY+'\n';}});
 assert.deepEqual(await store(),{key:KEY,source:'infisical'});
 assert.ok(calls[0].includes(KEY_NAME)&&calls[0].includes('--plain'));
 await store();assert.equal(calls.length,1,'cached for a while');
 for(const bad of ['','short','has spaces in it but is long enough to pass the length check ok'])assert.equal((await createKeyReader({env:{},run:async()=>bad})()).key,null,JSON.stringify(bad));
 assert.equal((await createKeyReader({env:{},run:async()=>{throw new Error('boom '+KEY);}})()).key,null,'a failing key store is just "no key"');
 // a full run leaves the key nowhere on disk
 const f=await setup(t);await f.pickup.check({reason:'button'});
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 for(const file of walk(f.dir))assert.ok(!fs.readFileSync(file,'utf8').includes(KEY),file);
 assert.ok(!JSON.stringify(await f.pickup.status()).includes(KEY));
});
