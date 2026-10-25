import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import {createReviewConnection} from '../scripts/review-connection.mjs';

const editPath='/api/source-sessions/edit',undoPath='/api/source-sessions/undo';
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
function request(port,url,{method='POST',headers={},body}={}){
 return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers,agent:false},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('connect',(res,socket)=>{socket.destroy();resolve({status:res.statusCode});});req.on('error',reject);req.end(body);});
}
const edit={operationId:'human:synthetic.correct-1',expectedRevision:7,expectedSourceHash:'a'.repeat(64),sessionId:'synthetic-session',turnId:'turn with supplied identity',speaker:'Visitor',text:'A corrected synthetic line.\n另一行。'};
async function setup(t,{sourceCorrections=true,respond}={}){
 const calls=[];
 const owner=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const entry={url:req.url,method:req.method,headers:req.headers,bytes:Buffer.concat(chunks)};calls.push(entry);if(respond)return respond(entry,res);res.writeHead(200,{'content-type':'application/json','set-cookie':'discard=1'});res.end('{"status":"committed"}');});
 const ownerPort=await listen(owner),server=createReviewConnection({authorityURL:`http://127.0.0.1:${ownerPort}`,allowedAuthorityPort:ownerPort,actualWorkReview:true,sourceCorrections,readPostPaths:['/api/work-continuity/read']});
 const port=await listen(server),origin=`http://127.0.0.1:${port}`;
 t.after(async()=>{await close(server);await close(owner);});
 const send=(url=editPath,input=edit,options={})=>request(port,url,{headers:{origin,'content-type':'application/json',...options.headers},body:JSON.stringify(input),...options});
 return{calls,port,origin,ownerPort,send};
}
test('explicit source corrections retain exact bytes, stable non-UUID IDs, and only bounded forwarding headers',async t=>{
 const {port,origin,ownerPort,calls}=await setup(t);
 const bytes=Buffer.from(' {\n "operationId":"human:synthetic.correct-1", "expectedRevision":7,"expectedSourceHash":"'+edit.expectedSourceHash+'","sessionId":"synthetic-session","turnId":"turn with supplied identity","speaker":"Visitor","text":"A corrected synthetic line.\\n另一行。"\n} ');
 const result=await request(port,editPath,{headers:{origin,'content-type':'application/json; charset=utf-8',cookie:'private=discard',authorization:'Bearer discard','x-api-key':'discard','x-forwarded-host':'evil.invalid','sec-fetch-site':'same-origin'},body:bytes});
 assert.equal(result.status,200);assert.equal(result.body,'{"status":"committed"}');assert.equal(result.headers['set-cookie'],undefined);assert.deepEqual(calls[0].bytes,bytes);assert.equal(calls[0].url,editPath);assert.equal(calls[0].headers.origin,`http://127.0.0.1:${ownerPort}`);assert.equal(Number(calls[0].headers['content-length']),bytes.length);
 for(const name of ['cookie','authorization','x-api-key','x-forwarded-host','sec-fetch-site'])assert.equal(calls[0].headers[name],undefined,name);
 const undo={operationId:'human:undo-1',undoOperationId:edit.operationId,expectedRevision:9,expectedSourceHash:'b'.repeat(64),sessionId:edit.sessionId};
 assert.equal((await request(port,undoPath,{headers:{origin,'content-type':'application/json'},body:JSON.stringify(undo)})).status,200);assert.deepEqual(JSON.parse(calls[1].bytes),undo);
});
test('owner retries, conflict, and error responses pass through without refreshed guards or proxy retries',async t=>{
 const receipts=new Map();let commits=0;
 const {send,calls}=await setup(t,{respond:(entry,res)=>{const input=JSON.parse(entry.bytes);let status=200,body;
  if(input.text==='owner failed'){status=503;body='{"error":"synthetic owner unavailable"}';}
  else if(input.text==='owner refused'){status=422;body='{"error":"synthetic owner refused"}';}
  else if(receipts.has(input.operationId)){const prior=receipts.get(input.operationId);if(prior.request!==entry.bytes.toString()){status=409;body='{"error":"operation already used"}';}else body=prior.body;}
  else if(input.expectedRevision!==7||input.expectedSourceHash!==edit.expectedSourceHash){status=409;body='{"error":"source changed; reload"}';}
  else{commits++;body=JSON.stringify({status:'committed',revision:9,operationId:input.operationId,undoOperationId:input.operationId});receipts.set(input.operationId,{request:entry.bytes.toString(),body});}
  res.writeHead(status,{'content-type':'application/json'});res.end(body);
 }});
 const first=await send();assert.equal(first.status,200);const retry=await send();assert.equal(retry.status,first.status);assert.equal(retry.body,first.body);assert.equal(commits,1);assert.deepEqual(calls[0].bytes,calls[1].bytes);
 assert.equal((await send(editPath,{...edit,text:'Changed request with same operation'})).status,409);
 const stale={...edit,operationId:'stale:1',expectedRevision:6,expectedSourceHash:'stale'};const conflict=await send(editPath,stale);assert.equal(conflict.status,409);assert.equal(conflict.body,'{"error":"source changed; reload"}');assert.deepEqual(JSON.parse(calls.at(-1).bytes),stale);
 assert.equal((await send(editPath,{...edit,text:'owner refused'})).status,422);assert.equal((await send(editPath,{...edit,text:'owner failed'})).status,503);assert.equal(calls.length,6);
});
test('writes require this exact local Origin and refuse foreign Host or cross-site requests before owner',async t=>{
 const {port,origin,calls}=await setup(t);
 for(const extra of [{origin:undefined},{origin:'null'},{origin:'http://evil.invalid'},{origin:`http://localhost:${port}`},{origin:origin.replace('http:','https:')},{origin,'sec-fetch-site':'cross-site'},{origin,host:`evil.invalid:${port}`}]){
  const headers={'content-type':'application/json',...extra};if(headers.origin===undefined)delete headers.origin;
  assert.equal((await request(port,editPath,{headers,body:JSON.stringify(edit)})).status,403,JSON.stringify(extra));
 }
 assert.equal(calls.length,0);
});
test('source corrections cannot be entered with queries, encoded aliases, GET, other verbs or other mutations',async t=>{
 const {port,origin,send,calls}=await setup(t);
 for(const url of [editPath+'?text=smuggled',editPath+'?',undoPath+'?operationId=other','/api/source-sessions/%65dit','/api/source-sessions/../source-sessions/edit'])assert.equal((await send(url)).status,400,url);
 for(const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await request(port,editPath,{method,headers:{origin}})).status,405,method);
 for(const url of ['/api/source-sessions/import','/api/source-sessions/decide','/api/sources/write','/api/study-draft/save','/api/study/outputs/save','/api/review/media/file','/api/work-continuity/assign'])assert.equal((await send(url)).status,423,url);
 assert.equal(calls.length,0);
});
test('invalid shapes, types, UTF-8, media types, and oversized bodies fail before owner',async t=>{
 const {port,origin,send,calls}=await setup(t);
 for(const input of [null,[],{}, {...edit,path:'/private/tmp/never'},{...edit,text:undefined},{...edit,expectedRevision:'7'},{...edit,expectedRevision:-1},{...edit,operationId:'not an operation'},{...edit,speaker:' '},{...edit,text:'x'.repeat(12001)},{...edit,turnId:4}])assert.equal((await send(editPath,input)).status,400);
 const undo={operationId:'undo-1',undoOperationId:edit.operationId,expectedRevision:7,expectedSourceHash:edit.expectedSourceHash,sessionId:edit.sessionId};assert.equal((await send(undoPath,{...undo,text:'extra'})).status,400);assert.equal((await send(undoPath,{...undo,undoOperationId:5})).status,400);
 for(const [headers,body,status] of [[{'content-type':'text/plain'},'{}',415],[{'content-type':'application/json'},'{broken',400],[{'content-type':'application/json'},Buffer.from([0x7b,0x22,0x61,0x22,0x3a,0x22,0xff,0x22,0x7d]),400],[{'content-type':'application/json','content-length':String(1024*1024+1)},'{}',413],[{'content-type':'application/json'},JSON.stringify({...edit,text:'x'.repeat(1024*1024)}),413]]){const result=await request(port,editPath,{headers:{origin,...headers},body});assert.equal(result.status,status,JSON.stringify({headers,length:body.length,result}));}
 assert.equal(calls.length,0);
});
test('default entrance stays read-only; enabled review advertises only source-correction permission',async t=>{
 const disabled=await setup(t,{sourceCorrections:false});assert.equal((await disabled.send()).status,423);assert.equal(disabled.calls.length,0);
 const enabled=await setup(t);const response=await request(enabled.port,'/document-study/package-config.js',{method:'GET'});const sandbox={window:{}};vm.runInNewContext(response.body,sandbox);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.readOnly,true);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.sourceCorrections,true);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.authorityOrigin,`http://127.0.0.1:${enabled.ownerPort}`);
 const upgrade=await request(enabled.port,editPath,{headers:{origin:enabled.origin,connection:'Upgrade',upgrade:'websocket'}});assert.equal(upgrade.status,405);assert.equal(enabled.calls.length,0);
});
test('a source correction redirect is refused and never followed',async t=>{
 const {send,calls}=await setup(t,{respond:(_entry,res)=>{res.writeHead(307,{location:'http://example.invalid/private'});res.end();}});assert.equal((await send()).status,502);assert.equal(calls.length,1);
});

test('an interrupted correction is uncertain and keeps the caller operation for safe retry',async t=>{
 const {send,calls}=await setup(t,{respond:(_entry,res)=>res.destroy()});const result=await send();assert.equal(result.status,502);assert.match(result.body,/could not confirm.*operation ID/);assert.doesNotMatch(result.body,/has not changed/);assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].bytes).operationId,edit.operationId);
});
