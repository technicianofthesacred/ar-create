import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
const repo=path.resolve(import.meta.dirname,'..');
test('CLI and MCP carry boot/limit/history cursors; idle SSE restart immediately asks for canonical reread',async t=>{
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config));let server;
 const start=async()=>{server=await createServer({...config,publicDir:path.join(repo,'public'),sharedArticles:true,researchEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};
 t.after(async()=>{if(server)await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});let url=await start();
 const cli=(name,input)=>run(['--url',url,'--actor','agent:codex',name,'--input','-'],{stdin:async()=>JSON.stringify(input)});
 for(let i=0;i<9;i++){const r=await cli('handoff',{scope:{kind:'project',id:i%2?'other':'p'},operationId:randomUUID(),to:'human:adrian',summary:'Synthetic handoff '+i});assert.equal(r.exitCode,0);}
 const tools=createTools({url,actor:'agent:chatgpt'});let cursor=0,bootId,seen=[];
 do{const p=await tools.callTool('ar_create_events',{since:cursor,bootId,limit:2,scopeKind:'project',scopeId:'p'});assert.equal(p.reset,false);assert.ok(p.events.length<=2);seen.push(...p.events);cursor=p.cursor;bootId=p.bootId;if(!p.hasMore)break;}while(true);
 assert.equal(seen.length,5);assert.deepEqual(seen.map(e=>e.cursor),[1,3,5,7,9]);
 const empty=await cli('events',{since:cursor,bootId,limit:2});assert.equal(empty.exitCode,0);assert.equal(empty.result.reset,false);assert.deepEqual(empty.result.events,[]);
 const history=await cli('history',{kind:'project',id:'p',limit:2});assert.equal(history.result.lines.length,2);assert.ok(history.result.nextCursor);const next=await cli('history',{kind:'project',id:'p',limit:2,before:history.result.nextCursor});assert.equal(next.result.lines.length,2);assert.equal(new Set([...history.result.lines,...next.result.lines].map(r=>r.operationId)).size,4);
 await new Promise(r=>server.close(r));url=await start();
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),3000);let reader;
 try{const response=await fetch(url+'/api/events?since='+cursor+'&bootId='+bootId,{signal:abort.signal});reader=response.body.getReader();let text='';while(!text.includes('\n\n')){const {value,done}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);}const hello=JSON.parse(text.match(/event: hello\ndata: ([^\n]+)/)[1]);assert.equal(hello.reset,true);assert.equal(hello.resetReason,'boot-changed');assert.equal(hello.cursor,0);assert.notEqual(hello.bootId,bootId);assert.match(text,/event: reset/,'reset arrives without any subsequent write');}finally{clearTimeout(timeout);abort.abort();await reader?.cancel().catch(()=>{});}
});
