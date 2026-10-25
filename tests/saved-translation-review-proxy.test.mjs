import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createReviewConnection} from '../scripts/review-connection.mjs';
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
const close=s=>new Promise(r=>{s.closeAllConnections?.();s.close(r);});
test('saved review is an exact read through the maintained owner with generation disabled',async t=>{
 const calls=[],owner=http.createServer((req,res)=>{calls.push({method:req.method,url:req.url});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({state:'proposal-ready',applied:false,proposals:[{turnId:'invented',text:'Invented proposal.'}]}));});
 const ownerPort=await listen(owner),proxy=createReviewConnection({authorityURL:'http://127.0.0.1:'+ownerPort,allowedAuthorityPort:ownerPort}),port=await listen(proxy);t.after(async()=>{await close(proxy);await close(owner);});
 const path='/api/source-sessions/translation-review',query='?sessionId=invented&expectedRevision=7&expectedSourceHash='+'a'.repeat(64),url='http://127.0.0.1:'+port;
 for(const method of ['GET','HEAD']){const r=await fetch(url+path+query,{method});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);if(method==='HEAD')assert.equal(await r.text(),'');else assert.equal((await r.json()).applied,false);}
 assert.deepEqual(calls,[{method:'GET',url:path+query},{method:'HEAD',url:path+query}]);
 for(const q of ['',query+'&file=other.json',query+'&sessionId=duplicate',query.replace('Revision=7','Revision=-1'),query.replace('Revision=7','Revision=7.1'),query.replace('Revision=7','Revision=9007199254740992'),query.replace('a'.repeat(64),'invalid')])assert.equal((await fetch(url+path+q)).status,400);
 for(const method of ['POST','PUT','DELETE'])assert.equal((await fetch(url+path+query,{method})).status,405);
 assert.equal(calls.length,2);
 const generated=await fetch(url+'/api/source-sessions/translation-proposals',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:'{}'});assert.equal(generated.status,503);assert.equal((await generated.json()).state,'unavailable');assert.equal(calls.length,2);
});
