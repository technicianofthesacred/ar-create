import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {createEventBus} from '../runtime/services/events.mjs';

const repo=path.resolve(import.meta.dirname,'..');
async function setup(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const cli=async(args,input,actor='agent:codex')=>run(['--url',url,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 const pid='events-'+randomUUID().slice(0,8),made=await cli(['project','create'],{parentStudyId:pid,title:'Watched',operationId:randomUUID()});
 assert.equal(made.exitCode,0,JSON.stringify(made.result));
 return {url,cli,pid,project:made.result};
}
/** Read an SSE stream until `count` change events arrive. */
async function sse(url,count,{timeoutMs=5000}={}){
 const controller=new AbortController(),response=await fetch(url,{signal:controller.signal});
 assert.equal(response.headers.get('content-type'),'text/event-stream; charset=utf-8');
 const reader=response.body.getReader(),decoder=new TextDecoder(),events=[];let buffer='';
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 const done=(async()=>{try{while(events.length<count){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let at;while((at=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,at);buffer=buffer.slice(at+2);const data=block.split('\n').find(l=>l.startsWith('data: '));if(block.includes('event: change')&&data)events.push(JSON.parse(data.slice(6)));}}}catch{}finally{clearTimeout(timer);controller.abort();}return events;})();
 return {done};
}

test('a CLI save reaches an open SSE stream with its actor, scope and revision; failures emit nothing',async t=>{
 const f=await setup(t);
 const stream=await sse(f.url+'/api/events?'+new URLSearchParams({kind:'project',id:f.pid}),1);
 const saved=await f.cli(['project','save'],{parentStudyId:f.pid,operationId:randomUUID(),expectedRevision:f.project.revision,expectedHash:f.project.hash,authorThoughts:'',aiInterpretation:'Seen live.',suggestions:'',sourceSelections:[]});
 assert.equal(saved.exitCode,0,JSON.stringify(saved.result));
 const [event]=await stream.done;
 assert.ok(event,'event arrived without a refresh');
 assert.equal(event.kind,'concept.save');assert.deepEqual(event.scope,{kind:'project',id:f.pid});assert.equal(event.revision,saved.result.revision);
 assert.equal(event.actor,'agent:codex');assert.equal(event.client,'cli');assert.match(event.operationId,/^[a-f0-9-]{36}$/);assert.ok(Date.parse(event.at));
 // A stale save (409) changes nothing and announces nothing.
 const before=(await (await fetch(f.url+'/api/events/since?since=0')).json()).cursor;
 const stale=await f.cli(['project','save'],{parentStudyId:f.pid,operationId:randomUUID(),expectedRevision:f.project.revision,expectedHash:f.project.hash,authorThoughts:'',aiInterpretation:'Stale.',suggestions:'',sourceSelections:[]});
 assert.equal(stale.exitCode,3);
 assert.equal((await (await fetch(f.url+'/api/events/since?since=0')).json()).cursor,before);
});

test('agents read events since a cursor; an unknown cursor says reset',async t=>{
 const f=await setup(t);
 const all=await (await fetch(f.url+'/api/events/since?since=0')).json();
 assert.equal(all.schema,'ar-create.events.v1');assert.ok(all.events.some(e=>e.kind==='concepts.post'&&e.scope.id===f.pid&&e.actor==='agent:codex'));
 const none=await (await fetch(f.url+'/api/events/since?since='+all.cursor+'&bootId='+all.bootId)).json();assert.deepEqual(none.events,[]);assert.equal(none.reset,false);
 const ahead=await (await fetch(f.url+'/api/events/since?since='+(all.cursor+50))).json();assert.equal(ahead.reset,true);
 const tools=createTools({url:f.url,actor:'agent:claude-code'}),viaMcp=await tools.callTool('ar_create_events',{since:0,scopeKind:'project',scopeId:f.pid});
 assert.ok(viaMcp.events.length>=1&&viaMcp.events.every(e=>e.scope.id===f.pid));
 // The ring buffer resets readers that fell behind it.
 const bus=createEventBus({limit:3});for(let i=0;i<6;i++)bus.emit({kind:'x',scope:{kind:'project',id:'p'}});
 assert.equal(bus.since(1).reset,true);assert.equal(bus.since(4,{},200,bus.bootId).reset,false);assert.deepEqual(bus.since(4,{},200,bus.bootId).events.map(e=>e.cursor),[5,6]);
});

test('presence: the app says it has unsaved words; agents see editor.dirty; late heartbeats never win',async t=>{
 const f=await setup(t),bindingId=f.project.bindingId,scope={kind:'draft',id:bindingId};
 const post=(input,headers={Origin:f.url})=>fetch(f.url+'/api/presence',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(input)});
 assert.equal((await post({stage:'write',scope,dirty:true,sequence:7})).status,200);
 assert.equal((await post({stage:'write',scope,dirty:false,sequence:3})).status,200,'late heartbeat is accepted but ignored');
 const tools=createTools({url:f.url,actor:'agent:claude-code'}),read=await tools.callTool('study_draft_read',{bindingId,parentStudyId:f.pid});
 assert.equal(read.editor.dirty,true);assert.equal(read.editor.sequence,7);assert.equal(read.editor.stage,'write');assert.ok(Date.parse(read.editor.lastSeen));
 const status=await f.cli(['status'],{kind:'draft',id:bindingId});assert.equal(status.result.editor.dirty,true);assert.ok(status.result.events.events.length>=1);
 // An agent announces itself too; anonymous or malformed heartbeats are refused.
 assert.equal((await post({stage:'propose',scope,dirty:false,sequence:1},{'X-AR-Actor':'agent:claude-code','X-AR-Client':'mcp'})).status,200);
 const list=await (await fetch(f.url+'/api/presence?'+new URLSearchParams({kind:'draft',id:bindingId}))).json();
 assert.deepEqual(list.presence.map(p=>p.actor).sort(),['agent:claude-code','human:adrian']);
 assert.equal((await post({stage:'write',scope,dirty:true,sequence:8},{})).status,400);
 assert.equal((await post({scope:{kind:'nope',id:'x'},dirty:true,sequence:1})).status,400);
 assert.equal((await post({scope,dirty:'yes',sequence:1})).status,400);
 // Clean again: the next read says so.
 assert.equal((await post({stage:'write',scope,dirty:false,sequence:9})).status,200);
 assert.equal((await tools.callTool('study_draft_read',{bindingId,parentStudyId:f.pid})).editor.dirty,false);
 // Presence is not an operation: no journal-worthy event per heartbeat beyond state changes.
 const presenceEvents=(await (await fetch(f.url+'/api/events/since?since=0&kind=draft&id='+bindingId)).json()).events.filter(e=>e.kind==='presence');
 assert.ok(presenceEvents.length<=4);
});
