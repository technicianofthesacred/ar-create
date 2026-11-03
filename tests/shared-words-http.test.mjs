// The word library through the real server: HTTP, the CLI and the registry. Agents read and suggest; only Adrian,
// from the app's own page, confirms a suggestion or answers a doubtful word (the CLI exits 5 for anyone else).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {addRecording,TALK,seg} from './helpers/word-recording.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const op=()=>randomUUID();

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:claude-code')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const send=(method,route,{body,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text?JSON.parse(text):null}));});
  req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 const page=(method,route,body)=>send(method,route,{body,headers:{Origin:url}});   // the browser page: human:adrian, client ui
 const home={dir:config.dataDir,clock:{at:Date.now()}};
 return {url,cli,send,page,home,dataDir:config.dataDir,capabilities:await (await fetch(url+'/api/capabilities')).json()};
}
async function teach(f){
 const seed=path.join(f.dataDir,'seed-tea-terms.json');
 fs.writeFileSync(seed,JSON.stringify({terms:[{en:'Lu Yu',cat:'person',core:true,variants:['luyu']},{en:'Shou Puerh',cat:'tea',variants:[]}]}));
 const done=await f.cli(['words','import'],{source:'tea-terms',path:seed},'import:tea-terms');
 assert.equal(done.exitCode,0,JSON.stringify(done.result));
 return done.result;
}

test('every words route is in the registry with a CLI command; the two decisions are human-only',async t=>{
 const f=await setup(t),byName=Object.fromEntries(f.capabilities.commands.map(c=>[c.name,c]));
 for(const name of ['words','words.export','words.checks','words.check','words.add','words.import','words.decide','words.recognise','words.answer'])assert.ok(byName[name],name);
 for(const name of ['words','words.export','words.checks','words.check'])assert.equal(byName[name].readOnly,true,name);
 assert.deepEqual(byName['words.answer'].actors,['human']);assert.deepEqual(byName['words.decide'].actors,['human']);
 for(const name of ['words.add','words.import','words.recognise'])assert.deepEqual(byName[name].actors,['any'],name);
 assert.equal(byName.words.section,'transcript');
 assert.match(JSON.stringify(byName['words.answer'].schema),/choice/);
 // the CLI help lists the group
 assert.match(JSON.stringify((await run(['--help'])).result.commands),/words list\|export\|add/);
});

test('an agent reads, suggests and exports through the CLI; its suggestion waits for Adrian and stays out of the export',async t=>{
 const f=await setup(t);await teach(f);
 const list=await f.cli(['words','list']);
 assert.equal(list.exitCode,0);assert.equal(list.result.counts.total,2);
 assert.equal((await f.cli(['call','words'],{q:'luyu'})).result.entries[0].spelling,'Lu Yu','search reaches the variants');
 const sug=await f.cli(['words','add'],{spelling:'Fenghuang',category:'place'},'agent:codex');
 assert.equal(sug.exitCode,0,JSON.stringify(sug.result));
 assert.equal(sug.result.entry.status,'proposed');assert.equal(sug.result.entry.proposedBy,'agent:codex');
 const waiting=await f.cli(['call','words'],{status:'proposed'});
 assert.deepEqual(waiting.result.entries.map(e=>e.spelling),['Fenghuang']);
 const exported=await f.cli(['words','export']);
 assert.equal(exported.exitCode,0);assert.equal(exported.result.schema,'ar-create.word-library.export.v1');
 assert.ok(!exported.result.entries.some(e=>e.spelling==='Fenghuang'));assert.equal(exported.result.counts.entries,2);
 // the agent cannot confirm, from the CLI, MCP or a raw request
 const body={id:sug.result.entry.id,decision:'confirm'};
 assert.equal((await f.cli(['words','decide'],body)).exitCode,5);
 await assert.rejects(createTools({url:f.url,actor:'agent:claude-code'}).callTool('ar_create_call',{name:'words.decide',input:{operationId:op(),...body}}),e=>e.status===403);
 assert.equal((await f.send('POST','/api/words/decide',{body:{operationId:op(),...body},headers:{'X-AR-Actor':'agent:grok','X-AR-Client':'http'}})).status,403);
 // Adrian, from the app's page, confirms it, and the export now has it
 const yes=await f.page('POST','/api/words/decide',{operationId:op(),...body});
 assert.equal(yes.status,200,JSON.stringify(yes.body));assert.equal(yes.body.entry.confirmedBy,'human:adrian');
 assert.ok((await f.cli(['words','export'])).result.entries.some(e=>e.spelling==='Fenghuang'));
 // an agent still cannot import
 const refused=await f.cli(['words','import'],{source:'tea-terms'},'agent:codex');
 assert.equal(refused.exitCode,5);
});

test('recognise, check and answer over the real server: one ask, the answer only from the app, remembered for the next recording',async t=>{
 const f=await setup(t);await teach(f);
 const a=addRecording(f.home,{segments:TALK,story:'Tea Teacher interview'});
 const rec=await f.cli(['words','recognise',a.id]);
 assert.equal(rec.exitCode,0,JSON.stringify(rec.result));
 assert.ok(rec.result.items.length>=3);assert.ok(rec.result.askId);
 // the Needs you list has exactly one ask for it, with its default
 const asks=(await f.page('GET','/api/needs-you?status=all')).body.asks;
 assert.equal(asks.length,1);assert.equal(asks[0].default,'Keep all as heard');assert.equal(asks[0].scope.id,a.id);
 // an agent reads it all
 const read=await f.cli(['words','check',a.id]);
 assert.equal(read.exitCode,0);assert.equal(read.result.open,rec.result.items.length);
 const near=read.result.items.find(i=>i.word==='Lu Yo');
 assert.equal(near.suggestion,'Lu Yu');assert.match(near.time,/^0:0\d$/);assert.match(near.sentence,/Classic of Tea/);
 const answer={operationId:op(),jobId:a.id,key:near.key,choice:'suggestion'};
 // nobody but Adrian at the app can answer: agent (exit 5), Adrian's own name from the CLI (403), a raw agent request
 assert.equal((await f.cli(['words','answer'],answer)).exitCode,5);
 assert.equal((await f.cli(['words','answer'],{...answer,operationId:op()},'human:adrian')).exitCode,5);
 assert.equal((await f.send('POST','/api/words/answer',{body:{...answer,operationId:op()},headers:{'X-AR-Actor':'human:adrian','X-AR-Client':'mcp'}})).status,403);
 assert.equal((await f.cli(['words','check',a.id])).result.open,rec.result.items.length,'still all open');
 // from the page: done, remembered, the transcript fixed
 const ok=await f.page('POST','/api/words/answer',answer);
 assert.equal(ok.status,200,JSON.stringify(ok.body));
 assert.equal(ok.body.items.find(i=>i.key===near.key).answer.by,'human:adrian');
 assert.match(JSON.parse(fs.readFileSync(path.join(a.output,'transcript.json'),'utf8')).segments[0].text,/^Lu Yu wrote/);
 const learned=await f.cli(['call','words'],{q:'lu yo'});
 assert.equal(learned.result.recent[0].spelling,'Lu Yu');
 // the next recording, in another project, is right without a question
 const b=addRecording(f.home,{segments:[seg(0,'Lu Yo poured the tea.')],story:'Another talk'});
 const second=await f.cli(['words','recognise',b.id]);
 assert.equal(second.result.fixes.applied.length,1);
 assert.equal(JSON.parse(fs.readFileSync(path.join(b.output,'transcript.json'),'utf8')).segments[0].text,'Lu Yu poured the tea.');
 // recognise for something that is not a finished recording is a plain refusal
 assert.equal((await f.cli(['words','recognise',randomUUID()])).exitCode,1);
 assert.equal((await f.page('GET','/api/words/check?jobId='+randomUUID())).status,404);
 assert.equal((await f.page('GET','/api/words/checks')).body.recordings.length,1);
});

test('the word routes keep the usual guards: method, content type, actor and unknown fields',async t=>{
 const f=await setup(t);
 assert.equal((await f.send('GET','/api/words/add')).status,405);
 assert.equal((await f.send('POST','/api/words/add',{body:{operationId:op(),spelling:'X'}})).status,400,'a write names its author');
 assert.equal((await f.send('POST','/api/words/add',{body:{operationId:op(),spelling:'X',surprise:1},headers:{'X-AR-Actor':'agent:codex','X-AR-Client':'cli'}})).status,400);
 assert.equal((await f.send('GET','/api/words/nothing')).status,404);
 assert.equal((await f.send('GET','/api/words?bogus=1')).status,400);
 assert.equal((await f.send('GET','/api/words?category=nonsense')).status,400);
});
