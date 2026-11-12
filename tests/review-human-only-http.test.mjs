// The activity journal is left out of the byte comparison: it may note a refused attempt, which is not a change to any record.
// Stage 7, piece 3: marking reviewed is Adrian's alone, over real HTTP. Invented content only.
// The gate in the registry is a first look; the services refuse again and are the real check, so each odd spelling of the
// transcript review path is tried: it must be refused for an assistant and write nothing.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';import {createWorkshopFixture} from '../runtime/recording-workshop-fixture.mjs';import {digest} from '../runtime/services/files.mjs';
import {run} from '../agents/cli/ar-create.mjs';import {createTools} from '../agents/mcp/server.mjs';

const AGENTS=['agent:claude-code','agent:codex','agent:chatgpt','agent:hermes','agent:grok','agent:claude-design','cron:nightly','import:notes'],AGENT='agent:codex',PLAIN=/human-only; .* may propose but not decide|Confirming material is for Adrian/;
async function start(t,{recording=false}={}){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'review-human-http-'))),dataDir=path.join(dir,'data'),roots={vaultRoot:path.join(dir,'vault'),filesRoot:path.join(dir,'files')};for(const r of Object.values(roots))fs.mkdirSync(r,{recursive:true});
 const fixture=recording?createWorkshopFixture(dataDir):null;if(fixture)fs.writeFileSync(path.join(fixture.output,'transcribe.json'),JSON.stringify(fixture.original));
 const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:roots,researchEnabled:true,sharedArticles:true,transcriptionRuntime:{python:'/no-interpreter'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const port=server.address().port,base='http://127.0.0.1:'+port;
 /** A request whose path is sent exactly as written (fetch would fold dot segments and backslashes first). */
 const raw=(method,rawPath,body,headers={})=>new Promise((resolve,reject)=>{const data=body===undefined?null:JSON.stringify(body),req=http.request({host:'127.0.0.1',port,method,path:rawPath,headers:{...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{let json=null;try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{}resolve({status:res.statusCode,body:json});});});req.on('error',reject);if(data)req.write(data);req.end();});
 const as=(actor,client='cli')=>actor?{'x-ar-actor':actor,'x-ar-client':client}:{};
 const call=(rawPath,body,actor='human:adrian',client='ui')=>raw(body===undefined?'GET':'POST',rawPath,body,as(actor,client));
 const tree=()=>Object.fromEntries(fs.readdirSync(dataDir,{recursive:true}).sort().filter(p=>!p.startsWith('journal'+path.sep)&&(()=>{try{return fs.lstatSync(path.join(dataDir,p)).isFile();}catch{return false;}})()).map(p=>[p,digest(fs.readFileSync(path.join(dataDir,p)))]));
 const cli=(args,input,actor=AGENT)=>run(['--url',base,'--actor',actor,...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});
 return {dir,dataDir,base,port,fixture,raw,call,as,tree,cli};
}
const state=async(h,id)=>/review_status: (\w+)/.exec((await h.call('/transcription/'+id+'/snapshot')).body.markdown)?.[1];
const bodyOf=r=>JSON.stringify(r.body);

test('an assistant cannot mark a transcript reviewed by the plain path or any odd spelling of it, and nothing is written',async t=>{
 const h=await start(t,{recording:true}),id=h.fixture.id,snap=async()=>(await h.call('/transcription/'+id+'/snapshot')).body;
 const named=await h.call('/transcription/'+id+'/speakers',{expected:(await snap()).expected,names:{s1:'Potter',s2:'Visitor'}});assert.equal(named.status,200);
 const spellings=['/transcription/'+id+'/review','/transcription/x/../'+id+'/review','/transcription/'+id+'\\review','/transcription\\'+id+'/review','/transcription/x/%2e%2e/'+id+'/review','/transcription/'+id+'/%72eview','/transcription/./'+id+'/review','/transcription/'+id+'/review/../review','/transcription/x%2f..%2f'+id+'/review'];
 const before=h.tree();
 for(const actor of AGENTS)for(const spelling of spellings){
  const r=await h.raw('POST',spelling,{expected:named.body.expected,confirmed:true},h.as(actor));
  assert.equal(r.status,403,actor+' '+spelling+' '+bodyOf(r));assert.match(r.body?.error||'',/human-only|Confirming material is for Adrian/,actor+' '+spelling);
 }
 const r=await h.raw('POST',spellings[0],{expected:named.body.expected,confirmed:true},h.as(AGENT));assert.match(r.body.error,PLAIN);
 assert.deepEqual(h.tree(),before,'every file under the data folder is byte identical');
 // Through the registry names, the CLI and the MCP tool.
 for(const name of ['.transcription.id.review','.transcription.id.action']){const refused=await h.cli(['call',name,'--id',id,'--action','review'],{expected:named.body.expected,confirmed:true});assert.notEqual(refused.exitCode,0,name+' '+JSON.stringify(refused.result));}
 assert.deepEqual(h.tree(),before,'the CLI call wrote nothing');
});

test('a transcript review with no actor header from a non-browser client is refused and writes nothing; the owner succeeds',async t=>{
 const h=await start(t,{recording:true}),id=h.fixture.id,snap=async()=>(await h.call('/transcription/'+id+'/snapshot')).body;
 const named=await h.call('/transcription/'+id+'/speakers',{expected:(await snap()).expected,names:{s1:'Potter',s2:'Visitor'}});assert.equal(named.status,200);
 const before=h.tree();
 for(const spelling of ['/transcription/'+id+'/review','/transcription/x/../'+id+'/review','/transcription/'+id+'\\review']){
  const none=await h.raw('POST',spelling,{expected:named.body.expected,confirmed:true},{});assert.equal(none.status,403,spelling+bodyOf(none));assert.match(none.body.error,/unattributed caller/);
 }
 assert.deepEqual(h.tree(),before);
 assert.equal(await state(h,id),'unreviewed');
 const done=await h.call('/transcription/'+id+'/review',{expected:named.body.expected,confirmed:true});assert.equal(done.status,200,bodyOf(done));
 assert.equal(await state(h,id),'reviewed');
 // A review with no `expected` is refused for everyone (the recording workshop page sends none; mending it must first make it say who presses).
 assert.equal((await h.call('/transcription/'+id+'/review',{confirmed:true})).status,409);
});

test('an assistant may still name speakers and correct segments, and either one clears a review Adrian gave',async t=>{
 const h=await start(t,{recording:true}),id=h.fixture.id,snap=async()=>(await h.call('/transcription/'+id+'/snapshot')).body,status=()=>state(h,id);
 const named=await h.call('/transcription/'+id+'/speakers',{expected:(await snap()).expected,names:{s1:'Potter',s2:'Visitor'}},AGENT,'cli');assert.equal(named.status,200,bodyOf(named));
 assert.equal((await h.call('/transcription/'+id+'/review',{expected:named.body.expected,confirmed:true})).status,200);assert.equal(await status(),'reviewed');
 const s=await snap(),edit=await h.call('/transcription/'+id+'/segment',{expected:s.expected,index:0,text:'The first sample uses a low fixture tone, said again.',speaker:s.result.segments[0].speaker},AGENT,'cli');assert.equal(edit.status,200,bodyOf(edit));
 assert.equal(await status(),'unreviewed');
 const again=await h.call('/transcription/'+id+'/speakers',{expected:(await snap()).expected,names:{s1:'Potter',s2:'Guest'}},AGENT,'cli');assert.equal(again.status,200);
});

async function note(t,content='An honest note about clay.\n',h0){
 const h=h0||await start(t),parentStudyId=randomUUID();
 const made=await h.call('/api/study-draft/create-collection',{parentStudyId,title:'Invented kiln subject',operationId:randomUUID()},AGENT,'cli');assert.equal(made.status,200,bodyOf(made));
 const bindingId=made.body.binding.id,projectId=made.body.projectBinding.projectId,scope={bindingId,parentStudyId};
 const add=async(name,text)=>{const source=(await h.call('/api/sources/import',{files:[{name,content:text}]},AGENT,'cli')).body.receipts[0].source;assert.equal((await h.call('/api/study/material/attach',{...scope,operationId:randomUUID(),sourceIds:[source.id]},AGENT,'cli')).status,200);return source;};
 const source=await add('Field note.md',content);
 assert.equal((await h.call('/api/first-flow/select',{projectKey:parentStudyId,title:'Invented kiln subject',operationId:randomUUID()},AGENT,'cli')).status,200);
 const review=(actor,over={},src=source,client='cli')=>h.call('/api/first-flow/source-review',{projectId,operationId:randomUUID(),sourceId:src.id,expectedHash:src.hash,reviewed:true,humanDecision:true,...over},actor,actor==='human:adrian'?'ui':client);
 const prepare=(actor,sources,reviews)=>h.call('/api/first-flow/prepare',{projectId,operationId:randomUUID(),sourceIds:sources.map(s=>s.id),question:'What does this invented note say about clay?',...(reviews?{sourceReviews:reviews.map(s=>({sourceId:s.id,hash:s.hash}))}:{})},actor,actor==='human:adrian'?'ui':'cli');
 return {h,projectId,scope,source,add,review,prepare};
}

test('first-flow.source-review with reviewed:true is Adrian only; withdrawing stays open to an assistant',async t=>{
 const n=await note(t),{h}=n,before=h.tree();
 for(const actor of AGENTS){const r=await n.review(actor);assert.equal(r.status,403,actor+bodyOf(r));assert.match(r.body.error,PLAIN);}
 assert.deepEqual(h.tree(),before,'nothing was written');
 const none=await h.raw('POST','/api/first-flow/source-review',{projectId:n.projectId,operationId:randomUUID(),sourceId:n.source.id,expectedHash:n.source.hash,reviewed:true,humanDecision:true},{});assert.notEqual(none.status,200);assert.deepEqual(h.tree(),before,'no actor header: refused, nothing written');
 const mine=await n.review('human:adrian');assert.equal(mine.status,200,bodyOf(mine));
 const withdrawn=await n.review(AGENT,{reviewed:false});assert.equal(withdrawn.status,200,bodyOf(withdrawn));
 const flowFile=fs.readdirSync(path.join(h.dataDir,'first-flow')).map(d=>path.join(h.dataDir,'first-flow',d,'flow.json')).find(f=>fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).projectId===n.projectId);
 assert.equal(JSON.parse(fs.readFileSync(flowFile,'utf8')).reviews[n.source.id],undefined,'the withdrawal took the review away');
 assert.equal((await n.review('human:adrian',{by:'human:adrian'})).status,400,'an extra body key is still refused for him');
});

test('first-flow.prepare stays open to an assistant, but a call that would add a review is refused whole and writes nothing',async t=>{
 const n=await note(t),{h}=n,second=await n.add('Second note.md','Another honest note about glaze and kilns.\n');
 assert.equal((await n.review('human:adrian')).status,200);
 // Ordinary prepare, with the entry already on file, works for an assistant.
 const fine=await n.prepare(AGENT,[n.source],[n.source]);assert.equal(fine.status,200,bodyOf(fine));
 const plain=await n.prepare(AGENT,[n.source]);assert.equal(plain.status,200,bodyOf(plain));
 const before=h.tree();
 for(const actor of AGENTS){const r=await n.prepare(actor,[n.source,second],[n.source,second]);assert.equal(r.status,403,actor+bodyOf(r));assert.match(r.body.error,/Confirming material is for Adrian to do; .* may not\. Nothing was prepared\./);}
 assert.deepEqual(h.tree(),before,'no review, no request folder, flow unchanged');
 // Adrian's own call takes the same path and adds the review.
 assert.equal((await n.prepare('human:adrian',[n.source,second],[n.source,second])).status,200);
});
