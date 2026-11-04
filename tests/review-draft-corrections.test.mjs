import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import {createReviewConnection} from '../scripts/review-connection.mjs';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';
const savePath='/api/study-draft/save',undoPath='/api/study-draft/undo';
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
const hash='a'.repeat(64),otherHash='b'.repeat(64);
const save={bindingId:'11111111-1111-1111-1111-111111111111',parentStudyId:'synthetic-parent:writing',operationId:'22222222-2222-2222-2222-222222222222',expected:{workflow:{draft:hash,edits:null,ask:otherHash,map:hash},bindingHash:hash,correspondenceHash:otherHash},operations:[{kind:'text',id:'stable-native-line',from:0,to:4,insert:'Saved synthetic words. 原话。',seenBlockHash:hash}]};
const undo={bindingId:save.bindingId,parentStudyId:save.parentStudyId,operationId:'33333333-3333-3333-3333-333333333333',expected:save.expected,undoOperationId:save.operationId};
function request(port,url,{method='POST',headers={},body}={}){
 return new Promise((resolve,reject)=>{let answered=false;const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers,agent:false},res=>{answered=true;const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));res.on('error',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('connect',(res,socket)=>{socket.destroy();resolve({status:res.statusCode});});
  // A server that refuses an oversized body answers and closes before the body is fully sent; the write then fails
  // with ECONNRESET/EPIPE while the answer is still on its way. Give the answer a moment before calling it a failure.
  req.on('error',error=>{if(answered)return;if(['ECONNRESET','EPIPE'].includes(error.code))setTimeout(()=>{if(!answered)reject(error);},500);else reject(error);});req.end(body);});
}
async function setup(t,{enabled=true,respond,existingReview=false}={}){
 const calls=[];
 const owner=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const entry={url:req.url,method:req.method,headers:req.headers,bytes:Buffer.concat(chunks)};calls.push(entry);if(respond)return respond(entry,res);res.writeHead(200,{'content-type':'application/json','set-cookie':'discard=1'});res.end('{"saved":true}');});
 const ownerPort=await listen(owner),authorityURL=`http://127.0.0.1:${ownerPort}`;
 const server=existingReview?(await createExistingWorkReview({config:{authorityURL,allowedAuthorityPort:ownerPort,magazineRoots:[]}})).server:createReviewConnection({authorityURL,allowedAuthorityPort:ownerPort,actualWorkReview:true,studyDraftCorrections:enabled});
 const port=await listen(server),origin=`http://127.0.0.1:${port}`;
 t.after(async()=>{await close(server);await close(owner);});
 const send=(url=savePath,input=save,options={})=>request(port,url,{...options,headers:{origin,'content-type':'application/json',...options.headers},body:options.body??JSON.stringify(input)});
 return{calls,port,origin,ownerPort,send};
}
test('save and Undo forward their exact bytes, IDs and full proof only to the existing owner',async t=>{
 const {port,origin,ownerPort,calls}=await setup(t);
 const bytes=Buffer.from(' \n'+JSON.stringify(save,null,2)+'\n');const result=await request(port,savePath,{headers:{origin,'content-type':'application/json; charset=utf-8',authorization:'Bearer discard',cookie:'private=discard','x-api-key':'discard','x-forwarded-host':'evil.invalid'},body:bytes});
 assert.equal(result.status,200);assert.equal(result.headers['set-cookie'],undefined);assert.deepEqual(calls[0].bytes,bytes);assert.equal(calls[0].url,savePath);assert.equal(calls[0].method,'POST');assert.equal(calls[0].headers.origin,`http://127.0.0.1:${ownerPort}`);assert.equal(Number(calls[0].headers['content-length']),bytes.length);
 for(const key of ['authorization','cookie','x-api-key','x-forwarded-host'])assert.equal(calls[0].headers[key],undefined);
 const undoBytes=Buffer.from(JSON.stringify(undo,null,1));assert.equal((await request(port,undoPath,{headers:{origin,'content-type':'application/json'},body:undoBytes})).status,200);assert.deepEqual(calls[1].bytes,undoBytes);
});
test('all ordinary native prose and structure operation shapes pass without proxy interpretation',async t=>{
 const {send,calls}=await setup(t);const operations=[...save.operations,{kind:'move',id:'line-2',beforeId:null},{kind:'split',id:'line-1',at:5,newId:'new-line'},{kind:'join',leftId:'line-1',rightId:'line-2'},{kind:'insert',id:'new-other',beforeId:'line-1',raw:'Ordinary new prose.'},{kind:'delete',id:'line-3'},{kind:'blockKind',id:'line-4',blockKind:'heading',level:2,seenBlockHash:hash},{kind:'blockKind',id:'line-5',blockKind:'paragraph',seenBlockHash:hash}];
 assert.equal((await send(savePath,{...save,operations})).status,200);assert.deepEqual(JSON.parse(calls[0].bytes).operations,operations);
 const minimalProof={workflow:{draft:hash,edits:null},bindingHash:hash,correspondenceHash:hash};assert.equal((await send(savePath,{...save,expected:minimalProof})).status,200);
});
test('stable owner retries, changed-request conflict, stale proof, and owner refusals pass through unchanged',async t=>{
 const receipts=new Map();let commits=0;
 const {send,calls}=await setup(t,{respond:(entry,res)=>{const input=JSON.parse(entry.bytes),key=input.operationId,prior=receipts.get(key);let status=200,body;
  if(input.parentStudyId==='owner-locked'){status=423;body='{"error":"owner remains locked"}';}
  else if(input.parentStudyId==='owner-unavailable'){status=503;body='{"error":"owner unavailable"}';}
  else if(prior){if(prior.request!==entry.bytes.toString()){status=409;body='{"error":"operation ID conflict"}';}else body=prior.body;}
  else if(input.expected.workflow.draft!==hash){status=409;body='{"error":"working manuscript changed"}';}
  else{commits++;body=JSON.stringify({operationId:key,raw:'Saved synthetic manuscript',expected:{...input.expected,bindingHash:otherHash}});receipts.set(key,{request:entry.bytes.toString(),body});}
  res.writeHead(status,{'content-type':'application/json'});res.end(body);
 }});
 const first=await send(),retry=await send();assert.equal(first.status,200);assert.equal(retry.status,200);assert.equal(retry.body,first.body);assert.equal(commits,1);assert.deepEqual(calls[0].bytes,calls[1].bytes);
 assert.equal((await send(savePath,{...save,operations:[{...save.operations[0],insert:'Different attempt'}]})).status,409);
 const stale={...save,operationId:undo.operationId,expected:{...save.expected,workflow:{...save.expected.workflow,draft:otherHash}}};const conflict=await send(savePath,stale);assert.equal(conflict.status,409);assert.equal(conflict.body,'{"error":"working manuscript changed"}');assert.deepEqual(JSON.parse(calls.at(-1).bytes),stale);
 assert.equal((await send(savePath,{...save,parentStudyId:'owner-locked'})).status,423);assert.equal((await send(savePath,{...save,parentStudyId:'owner-unavailable'})).status,503);assert.equal(calls.length,6);
});
test('manuscript corrections require exact local Origin and reject query aliases and non-POST verbs',async t=>{
 const {port,origin,send,calls}=await setup(t);
 for(const supplied of [undefined,'null','http://evil.invalid',`http://localhost:${port}`,origin.replace('http:','https:')]){const headers={'content-type':'application/json'};if(supplied!==undefined)headers.origin=supplied;assert.equal((await request(port,savePath,{headers,body:JSON.stringify(save)})).status,403);}
 for(const headers of [{origin,'sec-fetch-site':'cross-site'},{origin,host:`evil.invalid:${port}`}])assert.equal((await request(port,savePath,{headers,body:JSON.stringify(save)})).status,403);
 for(const url of [savePath+'?',savePath+'?operationId=other',undoPath+'?expected=other','/api/study-draft/%73ave','/api/study-draft/../study-draft/save'])assert.equal((await send(url)).status,400,url);
 for(const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await request(port,savePath,{method,headers:{origin}})).status,405,method);
 assert.equal(calls.length,0);
});
test('missing proof, unsafe request fields, bad operations and approval operations are refused before the owner',async t=>{
 const {send,calls}=await setup(t);
 for(const input of [null,[],{}, {...save,path:'/private/never'},{...save,raw:'replace everything'},{...save,bindingId:'caller-path'},{...save,parentStudyId:''},{...save,operationId:'not-a-uuid'},{...save,expected:undefined},{...save,expected:{workflow:save.expected.workflow}},{...save,expected:{...save.expected,path:'/private'}},{...save,expected:{...save.expected,workflow:{draft:hash}}},{...save,expected:{...save.expected,workflow:{...save.expected.workflow,sourcePath:hash}}},{...save,operations:[]},{...save,operations:Array(1001).fill(save.operations[0])}])assert.equal((await send(savePath,input)).status,400);
 for(const op of [null,{}, {...save.operations[0],kind:['text']}, {kind:'approveMark',id:'line',rawFrom:0,rawTo:4,seenBlockHash:hash,seenMarkupHash:hash,humanDecision:true},{...save.operations[0],path:'/private'},{...save.operations[0],seenBlockHash:undefined},{...save.operations[0],from:-1},{...save.operations[0],insert:'\ud800'},{kind:'insert',id:'new',beforeId:null,raw:'bad\0text'},{kind:'blockKind',id:'line',blockKind:'heading',level:4,seenBlockHash:hash},{kind:'delete',id:'bad\nidentity'}])assert.equal((await send(savePath,{...save,operations:[op]})).status,400);
 for(const input of [{...undo,undoOperationId:'bad'},{...undo,operations:save.operations},{...undo,expected:undefined}])assert.equal((await send(undoPath,input)).status,400);assert.equal(calls.length,0);
});
test('UTF-8 JSON and 1 MB body/media boundaries apply before any manuscript request reaches owner',async t=>{
 const {port,origin,calls}=await setup(t);
 for(const [headers,body,status] of [[{'content-type':'text/plain'},'{}',415],[{'content-type':'application/json'},'{broken',400],[{'content-type':'application/json'},Buffer.from([0x7b,0x22,0x61,0x22,0x3a,0x22,0xff,0x22,0x7d]),400],[{'content-type':'application/json','content-length':String(1024*1024+1)},'{}',413],[{'content-type':'application/json'},JSON.stringify({...save,operations:[{...save.operations[0],insert:'x'.repeat(1024*1024)}]}),413]]){const result=await request(port,savePath,{headers:{origin,...headers},body});assert.equal(result.status,status);}
 assert.equal(calls.length,0);
});
test('default remains read-only; existing-work entrance advertises explicit manuscript permission only',async t=>{
 const disabled=await setup(t,{enabled:false});assert.equal((await disabled.send()).status,423);assert.equal((await disabled.send(undoPath,undo)).status,423);assert.equal(disabled.calls.length,0);
 const enabled=await setup(t,{existingReview:true});const flags=await request(enabled.port,'/document-study/package-config.js',{method:'GET'}),sandbox={window:{}};vm.runInNewContext(flags.body,sandbox);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.readOnly,true);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.studyDraftCorrections,true);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.sourceCorrections,true);assert.equal(sandbox.window.AR_CREATE_REVIEW_MODE.browserCarouselCorrections,true);
 for(const url of ['/api/study-draft/open','/api/study-draft/create-collection','/api/study-draft/history-restore','/api/study-draft/recover','/api/study-draft/root-recovery','/api/study-ai/accept','/api/study/outputs/save','/api/study/outputs/create','/api/review/media/file','/api/execution/start'])assert.equal((await enabled.send(url)).status,423,url);
 // Direction saves pass the main review entrance since a9befe2 (guarded, not read-only): a malformed body is refused 400 before the owner.
 assert.equal((await enabled.send('/api/study/human-direction/write')).status,400);
 const upgrade=await request(enabled.port,savePath,{headers:{origin:enabled.origin,connection:'Upgrade',upgrade:'websocket'}});assert.equal(upgrade.status,405);assert.equal(enabled.calls.length,0);
});
test('lost owner response preserves uncertainty and sends exactly one attempt; redirects never follow',async t=>{
 let committed=null,commits=0;
 const lost=await setup(t,{respond:(entry,res)=>{if(!committed){commits++;committed={bytes:entry.bytes,body:JSON.stringify({operationId:save.operationId,state:'committed',raw:'Saved before response was lost'})};return res.destroy();}assert.deepEqual(entry.bytes,committed.bytes);res.writeHead(200,{'content-type':'application/json'});res.end(committed.body);}}),response=await lost.send();
 assert.equal(response.status,502);assert.match(response.body,/could not confirm.*operation ID/);assert.doesNotMatch(response.body,/has not changed/);assert.equal(lost.calls.length,1);assert.deepEqual(JSON.parse(lost.calls[0].bytes),save);
 const recovered=await lost.send();assert.equal(recovered.status,200);assert.equal(recovered.body,committed.body);assert.equal(commits,1);assert.equal(lost.calls.length,2);
 const redirected=await setup(t,{respond:(_entry,res)=>{res.writeHead(307,{location:'http://example.invalid/private'});res.end();}});assert.equal((await redirected.send()).status,502);assert.equal(redirected.calls.length,1);
});
