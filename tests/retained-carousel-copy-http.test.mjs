import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex'),route='/api/study/outputs/copy-retained-carousel';
async function setup(t,{configured=true}={}){
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retained-copy-http-'))),dataDir=path.join(home,'owned'),vault=path.join(home,'vault'),files=path.join(home,'files');fs.mkdirSync(vault);fs.mkdirSync(files);
 const originals=[['Workflow/3-Develop/DEV - Synthetic destination.md','---\ntype: DEV\ntitle: Synthetic HTTP destination\n---\n\nExact destination native words.\n'],['Workflow/1-Source/SRC - Synthetic context.md','Synthetic destination context.']];
 for(const[relative,raw]of originals){const file=path.join(vault,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw);}
 const original={id:randomUUID(),kind:'carousel',title:'Synthetic retained original',caption:'Exact original caption.',stage:'look',wordsReview:{hash:'a'.repeat(64),reviewedAt:'2026-10-11T00:00:00Z'},outputRevision:3,createdAt:'2026-10-11T00:00:00Z',slides:Array.from({length:13},(_,i)=>({id:randomUUID(),role:i?'inner':'cover',text:'Exact original slide '+(i+1),credit:'Credit '+i,label:'Label '+i,template:'M12',photos:[],paragraphIds:[]}))};
 const state={revision:4,project:{id:randomUUID(),document:{schema:'ar-create.document.v1',id:randomUUID(),revision:2,outputs:[original]}}},sourceFile=path.join(home,'retained-original.json'),writeSource=()=>fs.writeFileSync(sourceFile,JSON.stringify(state));writeSource();
 const source={projectId:state.project.id,documentId:state.project.document.id,outputId:original.id,sourceHash:sha(fs.readFileSync(sourceFile)),outputHash:sha(JSON.stringify(original))};
 const server=await createServer({dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:{vaultRoot:vault,filesRoot:files,catalog:{projects:{'synthetic-copy-parent':{title:'Synthetic parent',docs:[[originals[1][0],'source']],relatedProjects:[]}},drafts:{'synthetic-copy-draft':{parentStudyKey:'synthetic-copy-parent',partKey:'1',title:'Synthetic destination',path:originals[0][0],contextScope:'Synthetic copy HTTP proof.',support:[[originals[1][0],'source']]}}}},sharedArticles:true,researchEnabled:false,...configured?{retainedCarouselState:{path:sourceFile,projectId:source.projectId,documentId:source.documentId,outputIds:[source.outputId]}}:{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(home,{recursive:true,force:true});});const base='http://127.0.0.1:'+server.address().port;
 const request=async(url,input,{method='POST',origin=true,headers={}}={})=>{const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(origin?{Origin:base}:{}),...headers},...(input!==undefined?{body:typeof input==='string'?input:JSON.stringify(input)}:{})});const text=await response.text();return {status:response.status,value:text?JSON.parse(text):null,allow:response.headers.get('allow')};};
 const post=async(url,input)=>{const response=await request(url,input);assert.equal(response.status,200,JSON.stringify(response.value));return response.value;};
 const get=async url=>{const response=await request(url,undefined,{method:'GET'});assert.equal(response.status,200,JSON.stringify(response.value));return response.value;};
 return {home,dataDir,vault,originals,sourceFile,source,state,original,writeSource,server,base,request,post,get};
}
async function destination(f){
 const native=await f.post('/api/study-draft/open',{originalId:'synthetic-copy-draft',originalHash:sha(f.originals[0][1]),parentStudyId:'synthetic-copy-parent',operationId:randomUUID()});
 await f.post('/api/first-flow/select',{projectKey:'synthetic-copy-parent',title:'Synthetic destination',operationId:randomUUID()});const physical=await f.post('/api/study/photos/select',{bindingId:native.binding.id,parentStudyId:'synthetic-copy-parent',operationId:randomUUID()}),group={rootBindingId:native.binding.id,parentStudyId:'synthetic-copy-parent'};
 const read=id=>f.get('/api/study/outputs?'+new URLSearchParams({...group,...id?{selectedOutputId:id}:{}}));
 return {native,physical,group,read};
}
test('C01/C04/C06/S12 exact HTTP retained copy reuses existing read/edit/review/export owner, replay and source/destination guards',async t=>{
 const f=await setup(t),d=await destination(f),sourceBytes=fs.readFileSync(f.sourceFile),nativeBefore=await f.get('/api/study-draft/read?'+new URLSearchParams({bindingId:d.group.rootBindingId,parentStudyId:d.group.parentStudyId}));
 const existing=await f.post('/api/study/outputs/create',{...d.group,kind:'carousel',sourceBindingId:d.group.rootBindingId,expectedNative:d.native.expected,expectedOutput:(await d.read()).expectedOutput,operationId:randomUUID()}),savedEight=await f.post('/api/study/outputs/save',{...d.group,selectedOutputId:existing.view.output.id,expectedOutput:existing.view.expectedOutput,operationId:randomUUID(),changes:{slides:Array.from({length:8},(_,i)=>({...existing.view.output.slides[0],id:randomUUID(),role:i?'inner':'cover',text:'Current eight '+i,template:'M12'}))}}),eight=structuredClone(savedEight.view.output);
 const body={...d.group,destinationProjectId:d.physical.projectId,destinationDocumentId:d.physical.documentId,expectedOutput:savedEight.view.expectedOutput,expectedNative:d.native.expected,operationId:randomUUID(),source:f.source};
 const capabilities=await f.get('/api/capabilities'),command=capabilities.commands.find(c=>c.route===route);assert.equal(command.method,'POST');assert.equal(command.readOnly,false);assert.deepEqual(command.actors,capabilities.commands.find(c=>c.route==='/api/study/outputs/create').actors);
 assert.equal((await f.request(route,undefined,{method:'GET'})).status,405);
 assert.equal((await f.request(route,body,{headers:{Origin:'https://foreign.invalid'}})).status,403);
 assert.equal((await f.request(route,body,{origin:false})).status,400);
 assert.equal((await f.request(route,body,{headers:{'X-AR-Actor':'invalid-actor'}})).status,400);
 assert.equal((await f.request(route,body,{headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await f.request(route,{...body,padding:'x'.repeat(2*1024*1024)})).status,413);
 assert.equal((await f.request(route+'?path=/outside',body)).status,400);
 assert.equal((await f.request(route,{...body,path:'/outside'})).status,409);
 const scope={kind:'project',id:d.group.parentStudyId},lease=await f.request('/api/leases/acquire',{scope,reason:'Synthetic competing writer proof',ttlMs:60000},{headers:{'X-AR-Actor':'agent:claude-code'}});assert.equal(lease.status,200);
 assert.equal((await f.request(route,body,{headers:{'X-AR-Actor':'agent:codex'}})).status,423);
 assert.equal((await f.request('/api/leases/release',{scope,leaseId:lease.value.lease.leaseId},{headers:{'X-AR-Actor':'agent:claude-code'}})).status,200);
 // Existing write actor policy: an explicit valid agent is attributed just as
 // create/save are; no origin or actor exception is added for this command.
 const response=await f.request(route,body,{headers:{'X-AR-Actor':'agent:codex','X-AR-Client':'http'}});assert.equal(response.status,200,JSON.stringify(response.value));const created=response.value,id=created.view.output.id;
 assert.equal(id,body.operationId);assert.notEqual(id,f.original.id);assert.equal(created.view.output.slides.length,13);assert.equal(created.view.output.wordsReview,undefined);assert.equal(created.view.output.stage,'words');assert.deepEqual(created.view.document.paragraphs,[]);assert.deepEqual(created.view.outputs.find(o=>o.id===eight.id),eight);
 const replay=await f.post(route,body);assert.equal(replay.alreadySaved,true);assert.equal(replay.view.outputs.length,2);
 const exact=await d.read(id);assert.deepEqual(exact.outputOrigins[id].source,f.source);assert.equal(exact.wordOwner.kind,'carousel-words');assert.deepEqual(exact.output.slides.map(s=>s.text),f.original.slides.map(s=>s.text));
 const checkedBody={...body,operationId:randomUUID(),expectedOutput:exact.expectedOutput};
 for(const invalid of [{destinationProjectId:randomUUID()},{destinationDocumentId:randomUUID()},{rootBindingId:randomUUID()},{parentStudyId:'foreign'},{expectedNative:{...body.expectedNative,revision:999}},{expectedOutput:{revision:0,hash:'0'.repeat(64)}},...['projectId','documentId','outputId','sourceHash','outputHash'].map(key=>({source:{...f.source,[key]:key.endsWith('Hash')?'0'.repeat(64):randomUUID()}}))]){const rejected=await f.request(route,{...checkedBody,...invalid});assert.ok([404,409].includes(rejected.status),JSON.stringify(rejected));assert.ok(!JSON.stringify(rejected.value).includes(f.home));}
 assert.equal((await d.read()).outputs.length,2);
 const review=await f.post('/api/study/outputs/review-words',{...d.group,selectedOutputId:id,expectedOutput:exact.expectedOutput,expectedWords:exact.writingProof.expected,wordsHash:exact.writingProof.wordsHash,operationId:randomUUID()});assert.equal(review.view.output.stage,'look');assert.notDeepEqual(review.view.output.wordsReview,f.original.wordsReview);
 const edit=await f.post('/api/study/outputs/save',{...d.group,selectedOutputId:id,expectedOutput:review.view.expectedOutput,operationId:randomUUID(),changes:{caption:'Independent HTTP copy caption.'}});assert.equal(edit.view.output.stage,'words');assert.equal(edit.view.output.wordsReview,undefined);
 assert.equal((await f.request('/api/study/outputs/export-check',{...d.group,selectedOutputId:id,expectedOutput:edit.view.expectedOutput})).status,409);
 const ownReview=await f.post('/api/study/outputs/review-words',{...d.group,selectedOutputId:id,expectedOutput:edit.view.expectedOutput,expectedWords:edit.view.writingProof.expected,wordsHash:edit.view.writingProof.wordsHash,operationId:randomUUID()}),v=ownReview.view;
 await f.post('/api/study/outputs/export-check',{...d.group,selectedOutputId:id,expectedOutput:v.expectedOutput});
 const beforeExport=await f.get('/api/state'),png=await f.post('/api/study/outputs/export',{...d.group,kind:'carousel',selectedOutputId:id,expectedOutput:v.expectedOutput,outputRevision:v.output.outputRevision});assert.equal(png.export.contentVerification,'existing-carousel-renderer-saved-output-snapshot');assert.deepEqual(png.export.output,v.output);const images=png.export.files.filter(file=>file.mimeType==='image/png');assert.equal(images.length,13);
 for(const image of images){const downloaded=await fetch(f.base+image.url);assert.equal(downloaded.status,200);const bytes=Buffer.from(await downloaded.arrayBuffer());assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1350);assert.equal(sha(bytes),image.hash);}
 assert.deepEqual(await f.get('/api/state'),beforeExport);assert.deepEqual((await d.read(eight.id)).output,eight);assert.deepEqual(fs.readFileSync(f.sourceFile),sourceBytes);assert.deepEqual((await f.get('/api/study-draft/read?'+new URLSearchParams({bindingId:d.group.rootBindingId,parentStudyId:d.group.parentStudyId}))).expected,nativeBefore.expected);for(const[relative,raw]of f.originals)assert.equal(fs.readFileSync(path.join(f.vault,relative),'utf8'),raw);
 f.original.caption='Outside source edit';f.writeSource();assert.equal((await d.read(id)).freshness.sourceStale,true);assert.equal((await f.request(route,{...checkedBody,expectedOutput:v.expectedOutput})).status,409);assert.equal((await f.request('/api/study/outputs/export-check',{...d.group,selectedOutputId:id,expectedOutput:v.expectedOutput})).status,409);assert.equal((await d.read()).outputs.length,2);assert.deepEqual((await d.read(eight.id)).output,eight);
});
test('HTTP retained copy is disabled without explicit trusted host config and cannot be enabled by caller paths',async t=>{
 const f=await setup(t,{configured:false}),d=await destination(f),body={...d.group,destinationProjectId:d.physical.projectId,destinationDocumentId:d.physical.documentId,expectedOutput:(await d.read()).expectedOutput,expectedNative:d.native.expected,operationId:randomUUID(),source:f.source};
 fs.unlinkSync(f.sourceFile);const response=await f.request(route,body);assert.equal(response.status,503);assert.ok(!JSON.stringify(response.value).includes(f.home));assert.equal((await f.request(route,{...body,retainedCarouselState:{path:f.sourceFile}})).status,503);assert.equal((await d.read()).outputs.length,0);
});
