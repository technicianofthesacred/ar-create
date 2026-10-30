import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createReviewConnection} from '../scripts/review-connection.mjs';
const id='12345678-1234-4234-8234-123456789abc';
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
async function fixture(t,{enabled=true,jobs=[{id,state:'failed',transcriptReady:false}]}={}){
 const calls=[],owner=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;calls.push({method:req.method,path:req.url,body,headers:req.headers});res.setHeader('content-type','application/json');res.end(JSON.stringify(req.method==='GET'?{jobs}:{job:{id,state:'running'}}));});
 const ownerPort=await listen(owner),server=createReviewConnection({authorityURL:`http://127.0.0.1:${ownerPort}`,allowedAuthorityPort:ownerPort,actualWorkReview:true,studyDraftCorrections:enabled}),port=await listen(server),origin=`http://127.0.0.1:${port}`;t.after(async()=>{await close(server);await close(owner);});
 const send=({path=`/transcription/${id}/retry`,body={},actor='human:adrian',site='same-origin',from=origin}={})=>fetch(origin+path,{method:'POST',headers:{Origin:from,'Content-Type':'application/json','X-AR-Actor':actor,'Sec-Fetch-Site':site},body:JSON.stringify(body)});return {calls,send};
}
test('only the explicit author Retry forwards the exact failed recording after a fresh read',async t=>{const f=await fixture(t);assert.equal((await f.send()).status,200);assert.deepEqual(f.calls.map(c=>[c.method,c.path]),[['GET','/api/recordings'],['POST',`/transcription/${id}/retry`]]);assert.equal(f.calls[1].body,'{}');assert.equal(f.calls[1].headers['x-ar-actor'],'human:adrian');});
test('Retry does not grant agent, cross-origin, query, start, join or arbitrary payload execution',async t=>{const f=await fixture(t);for(const options of [{actor:'agent:codex'},{from:'https://elsewhere.invalid'},{site:'cross-site'},{path:`/transcription/${id}/retry?different=1`},{path:`/transcription/${id}/start`},{path:'/transcription/join'},{body:{python:'arbitrary-executable'}}]){const response=await f.send(options);assert.ok(response.status>=400,JSON.stringify(options));}assert.equal(f.calls.filter(c=>c.method==='POST').length,0);});
test('Retry remains unavailable when the existing author correction grant is disabled',async t=>{const f=await fixture(t,{enabled:false});assert.equal((await f.send()).status,423);assert.equal(f.calls.length,0);});
for(const jobs of [[],[{id,state:'running',transcriptReady:false}],[{id,state:'failed',transcriptReady:true}],[{id,state:'failed',transcriptReady:false,reviewStatus:'reviewed'}],[{id,state:'failed',transcriptReady:false},{id,state:'failed',transcriptReady:false}]])test('Retry refuses missing, changed, completed or ambiguous recordings '+JSON.stringify(jobs),async t=>{const f=await fixture(t,{jobs});assert.equal((await f.send()).status,409);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);});
