// The phone pickup through the real server: HTTP, the CLI and the command registry. A fake phone site and a fake
// transcriber stand in, so no network, model or paid service is used. The key is injected; nothing here reads a real one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {startPhoneSite,fakeLocal,fakeWords,KEY} from './helpers/fake-phone-site.mjs';

const repo=path.resolve(import.meta.dirname,'..');

async function setup(t,{key=KEY,segments=[{id:randomUUID()}]}={}){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const site=await startPhoneSite({segments});
 const local=fakeLocal(),words=fakeWords();
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,
  phonePickup:{readKey:async()=>({key,source:key?'environment':null}),local,words,baseUrl:site.origin,watchMs:0}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await site.close();fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:claude-code')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const send=(method,route,{body,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text?JSON.parse(text):null}));});
  req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 const page=(method,route,body)=>send(method,route,{body,headers:{Origin:url}});
 return {url,cli,send,page,site,local,words,capabilities:await (await fetch(url+'/api/capabilities')).json()};
}

test('the pickup is in the registry and the CLI, nothing about it is human-only, and checking is a write',async t=>{
 const f=await setup(t),byName=Object.fromEntries(f.capabilities.commands.map(c=>[c.name,c]));
 for(const name of ['phone-pickup','phone-pickup.setup','phone-pickup.check'])assert.ok(byName[name],name);
 for(const name of ['phone-pickup','phone-pickup.setup'])assert.equal(byName[name].readOnly,true,name);
 assert.notEqual(byName['phone-pickup.check'].readOnly,true);
 for(const name of ['phone-pickup','phone-pickup.setup','phone-pickup.check'])assert.deepEqual(byName[name].actors,['any'],name);
 assert.equal(byName['phone-pickup'].section,'transcript');
 assert.match(JSON.stringify((await run(['--help'])).result.commands),/phone status\|setup\|check/);
});

test('an agent checks the phone through the CLI; the recording comes back as a new version and the key never shows',async t=>{
 const f=await setup(t),[id]=[...f.site.rows.keys()];
 const before=await f.cli(['phone','status']);
 assert.equal(before.exitCode,0);assert.equal(before.result.state,'ready');
 const checked=await f.cli(['phone','check'],{});
 assert.equal(checked.exitCode,0,JSON.stringify(checked.result));
 assert.equal(checked.result.state,'ok');assert.equal(checked.result.finished,1);
 assert.equal(f.site.rows.get(id).improved.engine,'ar-create');
 assert.equal(f.site.rows.get(id).draft,'a quick draft');
 const after=await f.cli(['phone','status']);
 assert.equal(after.result.counts.sentBack,1);
 for(const output of [before,checked,after])assert.ok(!JSON.stringify(output).includes(KEY),'the key is in no answer');
 const setup2=await f.cli(['phone','setup']);
 assert.equal(setup2.exitCode,0);assert.match(setup2.result.command,/AR_PICKUP_TOKEN/);assert.ok(!JSON.stringify(setup2).includes(KEY));
});

test('with no key set the button path says so plainly and sends nothing to the phone site',async t=>{
 const f=await setup(t,{key:null});
 const status=(await f.page('GET','/api/phone-pickup')).body;
 assert.equal(status.state,'needs-key');assert.equal(status.message,'Needs a pickup key, see setup.');assert.ok(status.setup.command.includes('AR_PICKUP_TOKEN'));
 const checked=await f.page('POST','/api/phone-pickup/check',{});
 assert.equal(checked.status,200);assert.equal(checked.body.state,'needs-key');
 assert.equal(f.site.seen.lists,0);assert.equal(f.site.seen.unauthorised,0);
});

test('the check needs a named actor, takes no hidden fields and refuses the wrong method',async t=>{
 const f=await setup(t);
 assert.equal((await f.send('POST','/api/phone-pickup/check',{body:{}})).status,400,'no actor');
 assert.equal((await f.page('GET','/api/phone-pickup?x=1')).status,400);
 assert.equal((await f.page('GET','/api/phone-pickup/check')).status,405);
 assert.equal((await f.page('POST','/api/phone-pickup',{})).status,405);
 assert.equal((await f.page('GET','/api/phone-pickup/nothing')).status,404);
 assert.equal(f.site.seen.lists,0,'none of that reached the phone site');
});

test('the recordings screen has the button, its states and the setup panel',async t=>{
 const source=fs.readFileSync(path.join(repo,'public/document-study/material-intake.js'),'utf8');
 for(const text of ['Check the phone','Needs a pickup key, see setup','/api/phone-pickup/check','/api/phone-pickup','dataset.miPickup'])assert.ok(source.includes(text),text);
 assert.ok(!/[–—]/.test(source.slice(source.indexOf('async function loadPickup'),source.indexOf('function paintMicrophone'))),'no dashes in the new copy');
 // a timer that asks the phone site would break the twice-a-day rule: nothing in the screen or the service schedules one
 const service=fs.readFileSync(path.join(repo,'runtime/services/phone-pickup.mjs'),'utf8');
 assert.ok(!/setInterval\([^)]*check\(/.test(service));
 assert.ok(!/setInterval/.test(source.slice(source.indexOf('async function loadPickup'),source.indexOf('function paintMicrophone'))));
});
