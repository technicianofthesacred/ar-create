import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {randomUUID} from 'node:crypto';import {createReviewConnection} from '../scripts/review-connection.mjs';
const H='a'.repeat(64),R=randomUUID(),O=randomUUID(),parent='invented-parent',outputProof={revision:1,hash:H},group={rootBindingId:R,parentStudyId:parent},carouselWords={kind:'carousel-words'};
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port))),close=s=>new Promise(r=>{s.closeAllConnections?.();s.close(r);});
function request(port,url,{method='POST',body,headers={}}={}){return new Promise((resolve,reject)=>{const bytes=typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body),req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{...(method==='POST'?{origin:'http://127.0.0.1:'+port,'content-type':'application/json'}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const raw=Buffer.concat(chunks);let data;try{data=JSON.parse(raw);}catch{}resolve({status:res.statusCode,headers:res.headers,raw,data});});});req.on('error',reject);req.end(bytes);});}
async function stub(t,flags={studyDraftCorrections:true,nativeCarouselCorrections:true},{responseDelayMs=0}={}){const calls=[];let view={scope:group,output:{id:O,kind:'carousel',slides:[{}]},writingProof:carouselWords};const authority=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString();calls.push({url:req.url,method:req.method,headers:req.headers,body});if(req.method==='POST'&&responseDelayMs)await new Promise(r=>setTimeout(r,responseDelayMs));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(req.method==='GET'?view:{saved:true}));}),ownerPort=await listen(authority),proxy=createReviewConnection({actualWorkReview:true,authorityURL:'http://127.0.0.1:'+ownerPort,allowedAuthorityPort:ownerPort,...flags}),port=await listen(proxy);t.after(async()=>{await close(proxy);await close(authority);});return {port,calls,ownerPort,setView:v=>view=v};}
const carouselExport=()=>({...group,kind:'carousel',selectedOutputId:O,expectedOutput:outputProof,outputRevision:0});
test('native Carousel export has a bounded render budget while ordinary writes retain their short timeout',async t=>{
 const flags={studyDraftCorrections:true,nativeCarouselCorrections:true,timeoutMs:100};
 const f=await stub(t,flags,{responseDelayMs:250});
 f.setView({scope:group,output:{id:O,kind:'carousel',slides:[{},{},{}]},writingProof:carouselWords});
 const body=carouselExport(),saved=await request(f.port,'/api/study/outputs/export',{body});
 assert.equal(saved.status,200,'a valid render can outlive the ordinary command budget');
 assert.deepEqual(JSON.parse(f.calls.at(-1).body),body,'the exact guarded export is forwarded unchanged');
 const write={...group,selectedOutputId:O,operationId:randomUUID(),expectedOutput:outputProof,changes:{caption:'Existing unchanged writing authority'}};
 const timedOut=await request(f.port,'/api/study/outputs/save',{body:write});
 assert.equal(timedOut.status,502);assert.match(timedOut.data.error,/could not confirm.*Keep this operation ID/);
 assert.equal(f.calls.filter(c=>c.method==='POST'&&c.url==='/api/study/outputs/save').length,1,'a timed-out write is not automatically retried');
 const slow=await stub(t,{...flags,nativeCarouselExportTimeoutMs:150},{responseDelayMs:300});
 slow.setView({scope:group,output:{id:O,kind:'carousel',slides:[{},{},{}]},writingProof:carouselWords});
 const uncertain=await request(slow.port,'/api/study/outputs/export',{body});
 assert.equal(uncertain.status,502,'the export budget is finite');assert.match(uncertain.data.error,/could not confirm/);
 assert.equal(slow.calls.filter(c=>c.method==='POST').length,1,'an uncertain export is never automatically repeated');
 for(const slides of [[],Array.from({length:41},()=>({})),'not an array']){f.setView({scope:group,output:{id:O,kind:'carousel',slides},writingProof:carouselWords});const count=f.calls.filter(c=>c.method==='POST').length;assert.equal((await request(f.port,'/api/study/outputs/export',{body})).status,409);assert.equal(f.calls.filter(c=>c.method==='POST').length,count,'a caller cannot invent an export count outside the owner snapshot');}
});

test('native Carousel export budget overrides remain positive and bounded',()=>{for(const value of [0,-1,NaN,Infinity,1400001+100])assert.throws(()=>createReviewConnection({timeoutMs:100,nativeCarouselExportTimeoutMs:value}),/bounded native Carousel export timeout/);});
