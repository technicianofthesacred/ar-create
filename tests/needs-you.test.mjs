import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {createNeedsYou} from '../runtime/services/needs-you.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const HOUR=3600*1000;
const agent={actor:'agent:claude-code',client:'cli'},adrianUi={actor:'human:adrian',client:'ui'};
const steer=(over={})=>({operationId:randomUUID(),band:'steer',question:'Which group does the bowl photo belong in?',choices:['Marks','Repair','Hands'],default:'Repair',applyAt:new Date(Date.now()+HOUR).toISOString(),...over});
const only=(over={})=>({operationId:randomUUID(),band:'only-adrian',question:'Who is this piece for?',choices:['Tea drinker','Maker'],...over});

function clockFixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-needs-you-')),clock={at:Date.parse('2026-11-03T08:00:00Z')},events=[];
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const list=createNeedsYou({dataDir:dir,now:()=>clock.at,onChange:(kind,ask)=>events.push([kind,ask.id])});
 return {dir,clock,events,list,file:path.join(dir,'needs-you','asks.json'),at:ms=>new Date(clock.at+ms).toISOString()};
}

test('an Only Adrian ask never applies itself, however long it waits, and cannot be given a default',async t=>{
 const f=clockFixture(t);
 await assert.rejects(f.list.raise(only({default:'Maker'}),agent),/never applies itself/);
 await assert.rejects(f.list.raise(only({applyAt:f.at(HOUR)}),agent),/never applies itself/);
 const ask=await f.list.raise(only(),agent);
 assert.equal(ask.status,'open');assert.equal(ask.default,null);assert.equal(ask.applyAt,null);
 f.clock.at+=400*24*HOUR;
 assert.equal((await f.list.list({status:'open'})).asks[0].status,'open','a year later it still waits for him');
 // Even a file edited by hand to carry a default and a past time does not let it apply.
 const state=JSON.parse(fs.readFileSync(f.file,'utf8'));Object.assign(state.asks[0],{default:'Maker',applyAt:f.at(-HOUR)});fs.writeFileSync(f.file,JSON.stringify(state));
 const after=await f.list.list({status:'all'});
 assert.equal(after.asks[0].status,'open');assert.equal(after.asks[0].resolution,null);assert.equal(after.counts.defaulted,0);
});

test('a steer default applies on schedule, shows as applied by default, and Adrian can change it',async t=>{
 const f=clockFixture(t),ask=await f.list.raise(steer({applyAt:f.at(2*HOUR)}),agent);
 assert.deepEqual([ask.band,ask.default,ask.applyAt],['steer','Repair',f.at(2*HOUR)]);
 f.clock.at+=HOUR;assert.equal((await f.list.list({id:ask.id})).asks[0].status,'open','not before its time');
 f.clock.at+=HOUR+1;
 const applied=(await f.list.list({status:'defaulted'})).asks[0];
 assert.equal(applied.status,'defaulted');assert.equal(applied.resolution.choice,'Repair');assert.equal(applied.resolution.by,'default');assert.equal(applied.resolution.via,'default');
 assert.ok(f.events.some(([kind,id])=>kind==='defaulted'&&id===ask.id),'the app is told it applied');
 assert.equal((await f.list.list()).asks.length,1,'the pending list still shows it until he settles it');
 const changed=await f.list.answer({operationId:randomUUID(),id:ask.id,choice:'Hands'},adrianUi);
 assert.equal(changed.status,'answered');assert.equal(changed.resolution.choice,'Hands');assert.equal(changed.resolution.by,'human:adrian');assert.equal(changed.earlier,1,'the default stays in the record');
 assert.equal((await f.list.list()).asks.length,0,'answered asks leave the pending list');
 assert.equal((await f.list.list({status:'answered'})).asks[0].id,ask.id);
});

test('asks are checked on the way in: bands, defaults, links, size and repeats',async t=>{
 const f=clockFixture(t);
 await assert.rejects(f.list.raise({...only(),band:'later'},agent),/only-adrian or steer/);
 await assert.rejects(f.list.raise(steer({default:undefined}),agent),/default/);
 await assert.rejects(f.list.raise(steer({default:'Somewhere else'}),agent),/one of the choices/);
 await assert.rejects(f.list.raise(steer({choices:undefined}),agent),/lists the choices/);
 await assert.rejects(f.list.raise(steer({applyAt:f.at(-1000)}),agent),/in the future/);
 await assert.rejects(f.list.raise(steer({applyAt:undefined}),agent),/needs applyAt/);
 await assert.rejects(f.list.raise(steer({applyAt:f.at(90*24*HOUR)}),agent),/within 30 days/);
 await assert.rejects(f.list.raise(only({question:'x'.repeat(281)}),agent),/280/);
 await assert.rejects(f.list.raise(only({choices:['a','b','c','d','e','f']}),agent),/up to 5/);
 await assert.rejects(f.list.raise(only({surprise:1}),agent),/Unknown field/);
 await assert.rejects(f.list.raise({...only(),operationId:'not-a-uuid'},agent),/operationId/);
 // A human-only step lives on its own screen; the ask links to it, stays Only Adrian, and is closed with one tap.
 const href='/document-study/index.html?reviewMagazineStory=tea-teacher&reviewStage=11';
 await assert.rejects(f.list.raise(only({choices:undefined,link:{label:'Open Share',href:'https://example.com/'}}),agent),/back into the app/);
 await assert.rejects(f.list.raise(only({choices:undefined,link:{label:'Open Share',href:'//evil.example/document-study/index.html'}}),agent),/back into the app/);
 await assert.rejects(f.list.raise(steer({link:{label:'Open Share',href}}),agent),/Only Adrian/);
 const linked=await f.list.raise(only({question:'Send the Tea Teacher story?',choices:undefined,link:{label:'Open Share',href}}),agent);
 assert.deepEqual(linked.link,{label:'Open Share',href});assert.deepEqual(linked.choices,['Done']);
 // The same operationId replays; the same open question from the same agent is the same ask.
 const first=await f.list.raise(only(),agent),again=await f.list.raise({...only(),operationId:first.operationId??randomUUID()},agent);
 assert.equal(again.duplicate,true);assert.equal(again.id,first.id);
 const op=randomUUID(),one=await f.list.raise(only({operationId:op,question:'A different question?'}),agent),two=await f.list.raise(only({operationId:op,question:'A different question?'}),agent);
 assert.equal(two.replay,true);assert.equal(two.id,one.id);
 // Choices are exact; an ask without choices takes his own words.
 await assert.rejects(f.list.answer({operationId:randomUUID(),id:first.id,choice:'Somebody else'},adrianUi),/not one of the choices/);
 await assert.rejects(f.list.answer({operationId:randomUUID(),id:first.id,text:'free words'},adrianUi),/tap one/);
 const free=await f.list.raise(only({question:'What do you call this dish?',choices:undefined}),agent);
 assert.deepEqual(free.choices,[]);
 assert.equal((await f.list.answer({operationId:randomUUID(),id:free.id,text:'  Pasta, with this flair '},adrianUi)).resolution.text,'Pasta, with this flair');
});

test('a flood of asks is held at one hundred open',async t=>{
 const f=clockFixture(t);
 for(let i=0;i<100;i++)await f.list.raise(only({question:'Question number '+i}),agent);
 await assert.rejects(f.list.raise(only({question:'One too many'}),agent),error=>error.status===429);
 await assert.rejects(f.list.raise(steer({applyAt:f.at(HOUR)}),agent),error=>error.status===429,'the cap holds for steer asks too');
});

test('settled asks older than thirty days are removed; open ones are never',async t=>{
 const f=clockFixture(t),a=await f.list.raise(only({question:'Open for a long time?'}),agent),b=await f.list.raise(only({question:'Settled?'}),agent);
 await f.list.answer({operationId:randomUUID(),id:b.id,choice:'Maker'},adrianUi);
 f.clock.at+=31*24*HOUR;
 const all=await f.list.list({status:'all'});
 assert.deepEqual(all.asks.map(x=>x.id),[a.id]);
});

async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:claude-code')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 // Raw requests, so a test can say exactly which actor and client headers it sends (or none, as the browser page does).
 const send=(method,route,{body,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text?JSON.parse(text):null}));});
  req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 const page=(method,route,body)=>send(method,route,{body,headers:{Origin:url}});
 return {url,cli,send,page,dataDir:config.dataDir,capabilities:await (await fetch(url+'/api/capabilities')).json()};
}

test('the commands are in the registry: agents raise and list, answering is human-only',async t=>{
 const f=await setup(t),byName=Object.fromEntries(f.capabilities.commands.map(c=>[c.name,c]));
 assert.deepEqual(byName['needs-you'].actors,['any']);assert.equal(byName['needs-you'].readOnly,true);
 assert.deepEqual(byName['needs-you.raise'].actors,['any']);assert.equal(byName['needs-you.raise'].readOnly,false);
 assert.deepEqual(byName['needs-you.answer'].actors,['human']);
 assert.match(JSON.stringify(byName['needs-you.raise'].schema),/applyAt/);
});

test('an agent raises an ask and lists it through the CLI; the app\'s Home list shows the same record',async t=>{
 const f=await setup(t);
 const raised=await f.cli(['call','needs-you.raise'],steer({about:'Tea Teacher story'}),'agent:codex');
 assert.equal(raised.exitCode,0,JSON.stringify(raised.result));
 assert.equal(raised.result.raisedBy,'agent:codex');assert.equal(raised.result.status,'open');
 const listed=await f.cli(['call','needs-you']);
 assert.equal(listed.exitCode,0,JSON.stringify(listed.result));
 assert.deepEqual(listed.result.asks.map(a=>a.id),[raised.result.id]);
 const app=await f.page('GET','/api/needs-you');
 assert.equal(app.status,200);assert.deepEqual(app.body.asks.map(a=>a.id),[raised.result.id]);assert.equal(app.body.counts.steer,1);
 assert.ok(fs.existsSync(path.join(f.dataDir,'needs-you','asks.json')),'one file in the data folder');
 // A write names its author, like every other write.
 const anonymous=await f.send('POST','/api/needs-you/raise',{body:only()});
 assert.equal(anonymous.status,400);
});

test('an agent cannot answer: the CLI, MCP and a raw request as an agent are all refused, and the ask stays open',async t=>{
 const f=await setup(t),ask=(await f.cli(['call','needs-you.raise'],only(),'agent:codex')).result;
 const body={operationId:randomUUID(),id:ask.id,choice:'Maker'};
 const viaCli=await f.cli(['call','needs-you.answer'],body,'agent:claude-code');
 assert.equal(viaCli.exitCode,5,JSON.stringify(viaCli.result));
 const tools=createTools({url:f.url,actor:'agent:claude-code'});
 await assert.rejects(tools.callTool('ar_create_call',{name:'needs-you.answer',input:body}),error=>error.status===403);
 const raw=await f.send('POST','/api/needs-you/answer',{body,headers:{'X-AR-Actor':'agent:grok','X-AR-Client':'http'}});
 assert.equal(raw.status,403);
 // Not even the raiser, and not a script that names itself as Adrian: the answer comes from the app's own page.
 const asRaiser=await f.send('POST','/api/needs-you/answer',{body,headers:{'X-AR-Actor':'agent:codex','X-AR-Client':'cli'}});
 assert.equal(asRaiser.status,403);
 const asAdrianFromCli=await f.cli(['call','needs-you.answer'],{...body,operationId:randomUUID()},'human:adrian');
 assert.equal(asAdrianFromCli.exitCode,5,JSON.stringify(asAdrianFromCli.result));
 const named=await f.send('POST','/api/needs-you/answer',{body:{...body,operationId:randomUUID()},headers:{'X-AR-Actor':'human:adrian','X-AR-Client':'mcp'}});
 assert.equal(named.status,403);assert.match(named.body.error,/Home list in the app/);
 const after=(await f.page('GET','/api/needs-you')).body;
 assert.equal(after.asks[0].status,'open');assert.equal(after.asks[0].resolution,null);
});

test('Adrian answers from the app\'s own page: one tap, recorded as human:adrian, visible to the agent',async t=>{
 const f=await setup(t),ask=(await f.cli(['call','needs-you.raise'],only(),'agent:codex')).result;
 const body={operationId:randomUUID(),id:ask.id,choice:'Maker'};
 // The page sends no actor header at all: the same-origin browser is Adrian, client ui.
 const done=await f.page('POST','/api/needs-you/answer',body);
 assert.equal(done.status,200,JSON.stringify(done.body));
 assert.deepEqual([done.body.status,done.body.resolution.choice,done.body.resolution.by,done.body.resolution.client,done.body.resolution.via],['answered','Maker','human:adrian','ui','human']);
 // A retried tap is the same answer, not a second one.
 const retry=await f.page('POST','/api/needs-you/answer',body);
 assert.equal(retry.status,200);assert.equal(retry.body.earlier,0);
 // The agent reads the answer and carries on; it still cannot change it.
 const seen=await f.cli(['call','needs-you'],{status:'answered'},'agent:codex');
 assert.equal(seen.result.asks[0].resolution.choice,'Maker');assert.equal(seen.result.asks[0].resolution.by,'human:adrian');
 const tryChange=await f.cli(['call','needs-you.answer'],{operationId:randomUUID(),id:ask.id,choice:'Tea drinker'},'agent:codex');
 assert.equal(tryChange.exitCode,5);
 assert.equal((await f.page('GET','/api/needs-you?status=answered')).body.asks[0].resolution.choice,'Maker');
 // The write is in the journal under his name.
 const lines=(await f.cli(['history'],{actor:'human:adrian'},'agent:codex')).result;
 assert.ok(JSON.stringify(lines).includes('needs-you.answer'));
 // Answers to an ask that is gone, or not a uuid, are plain errors.
 assert.equal((await f.page('POST','/api/needs-you/answer',{operationId:randomUUID(),id:randomUUID(),choice:'Maker'})).status,404);
 assert.equal((await f.page('POST','/api/needs-you/answer',{operationId:randomUUID(),id:'nope',choice:'Maker'})).status,400);
});

test('HTTP edges: method, content type, unknown field, bad status filter, a link that leaves the app',async t=>{
 const f=await setup(t),headers={'X-AR-Actor':'agent:codex','X-AR-Client':'cli'};
 assert.equal((await f.send('GET','/api/needs-you/raise')).status,405);
 assert.equal((await f.send('POST','/api/needs-you',{body:{},headers})).status,405);
 assert.equal((await f.send('GET','/api/needs-you/nope')).status,404);
 assert.equal((await f.send('GET','/api/needs-you?status=everything')).status,400);
 assert.equal((await f.send('GET','/api/needs-you?colour=red')).status,400);
 const plain=await new Promise(resolve=>{const req=http.request(f.url+'/api/needs-you/raise',{method:'POST',headers:{...headers,'Content-Type':'text/plain'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.end('{}');});
 assert.equal(plain,415);
 assert.equal((await f.send('POST','/api/needs-you/raise',{body:{...only(),extra:true},headers})).status,400);
 const leaving=await f.send('POST','/api/needs-you/raise',{body:only({choices:undefined,link:{label:'Go',href:'https://example.com/document-study/index.html'}}),headers});
 assert.equal(leaving.status,400);
 // A foreign Origin cannot write, even naming an agent.
 assert.equal((await f.send('POST','/api/needs-you/raise',{body:only(),headers:{...headers,Origin:'http://evil.example'}})).status,403);
});

test('over HTTP, a steer default applies by itself when its time passes, and an Only Adrian ask beside it does not',async t=>{
 const f=await setup(t),headers={'X-AR-Actor':'agent:claude-code','X-AR-Client':'cli'};
 const soon=await f.send('POST','/api/needs-you/raise',{body:steer({applyAt:new Date(Date.now()+400).toISOString()}),headers}),waits=await f.send('POST','/api/needs-you/raise',{body:only(),headers});
 assert.equal(soon.status,200,JSON.stringify(soon.body));assert.equal(waits.status,200);
 assert.equal((await f.page('GET','/api/needs-you?id='+soon.body.id)).body.asks[0].status,'open');
 await new Promise(r=>setTimeout(r,700));
 const now=(await f.page('GET','/api/needs-you?status=all')).body,byId=Object.fromEntries(now.asks.map(a=>[a.id,a]));
 assert.equal(byId[soon.body.id].status,'defaulted');assert.equal(byId[soon.body.id].resolution.choice,'Repair');assert.equal(byId[soon.body.id].resolution.by,'default');
 assert.equal(byId[waits.body.id].status,'open');assert.equal(byId[waits.body.id].resolution,null);
 assert.equal(now.counts.defaulted,1);assert.equal(now.counts.onlyAdrian,1);
 // The agent sees what applied and carries on; Adrian can still change it from the page.
 const changed=await f.page('POST','/api/needs-you/answer',{operationId:randomUUID(),id:soon.body.id,choice:'Marks'});
 assert.equal(changed.body.resolution.choice,'Marks');assert.equal(changed.body.earlier,1);
});
