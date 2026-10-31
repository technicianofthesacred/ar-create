import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {digest} from '../runtime/services/files.mjs';

test('agent creates and reopens an isolated real-owner structure subject and Article; originals and human guards remain',async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-structure-http-'))),vault=path.join(dataDir,'vault'),files=path.join(dataDir,'files');fs.mkdirSync(vault);fs.mkdirSync(files);const DEV='Workflow/3-Develop/DEV - Original.md',SRC='Workflow/1-Source/SRC - Original.md',raw='---\ntitle: Original article\n---\n\nExact original words.\n';
 for(const [rel,body] of [[DEV,raw],[SRC,'The original recording says these exact words.']]){const file=path.join(vault,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
 const catalog={projects:{parent:{title:'Original',docs:[[SRC,'source']]}},drafts:{'original-article':{parentStudyKey:'parent',partKey:'article',title:'Original article',path:DEV,support:[[SRC,'source']]}}};
 const options={dataDir,publicDir:path.join(dataDir,'public'),studyOriginalRoots:{vaultRoot:vault,filesRoot:files,catalog},sharedArticles:true,researchEnabled:false};let server=await createServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true,force:true});});
 const post=async(route,input,actor='agent:codex')=>{const response=await fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'cli'},body:JSON.stringify(input)});return {status:response.status,value:await response.json()};};
 const source=await post('/api/study-draft/open',{parentStudyId:'parent',originalId:'original-article',originalHash:digest(raw),operationId:randomUUID()});assert.equal(source.status,200,JSON.stringify(source.value));
 const input={sourceBindingId:source.value.binding.id,sourceParentStudyId:'parent',expected:source.value.expected,title:'Original · structure test',operationId:randomUUID()};
 const human=await post('/api/study/structure-tests',input,'human:adrian');assert.equal(human.status,403);
 const created=await post('/api/study/structure-tests',input);assert.equal(created.status,200,JSON.stringify(created.value));const copy=created.value;assert.equal(copy.createdBy,'agent:codex');assert.equal(copy.decisions.role,'stand-in');assert.equal(copy.parentStudyId,'structure-test-'+input.operationId);assert.notEqual(copy.bindingId,source.value.binding.id);assert.ok(copy.article.outputId);assert.ok(copy.article.bindingId);assert.notEqual(copy.article.bindingId,source.value.binding.id);
 const read=await fetch(base+'/api/study/structure-tests?'+new URLSearchParams({parentStudyId:copy.parentStudyId}));assert.equal(read.status,200);assert.equal((await read.json()).bindingId,copy.bindingId);
 const article=await (await fetch(base+'/api/study-draft/read?'+new URLSearchParams({bindingId:copy.article.bindingId,parentStudyId:copy.parentStudyId}))).json();assert.equal(article.raw,raw);assert.equal(article.binding.canonicalOutputId,copy.article.outputId);
 const again=await post('/api/study/structure-tests',input);assert.equal(again.status,200,JSON.stringify(again.value));assert.deepEqual(again.value.article,copy.article);
 const listings=await (await fetch(base+'/api/concepts')).json();assert.ok(listings.concepts.some(row=>row.parentStudyId===copy.parentStudyId&&row.title===input.title));
 assert.equal((await fetch(base+'/api/study/structure-tests?parentStudyId=parent')).status,404);assert.equal((await post('/api/study/structure-tests',{...input,sourceParentStudyId:'foreign',operationId:randomUUID()})).status,409);
 const before=await (await fetch(base+'/api/study-draft/read?'+new URLSearchParams({bindingId:source.value.binding.id,parentStudyId:'parent'}))).json();assert.equal(before.raw,raw);assert.equal(fs.readFileSync(path.join(vault,DEV),'utf8'),raw);assert.equal(before.history.length,source.value.history.length);
 const guarded=await post('/api/study-ai/accept',{parentStudyId:'parent',bindingId:source.value.binding.id,operationId:randomUUID()});assert.ok(guarded.status>=400);assert.equal(fs.readFileSync(path.join(vault,DEV),'utf8'),raw);
 server.closeAllConnections();await new Promise(r=>server.close(r));server=await createServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const restarted=await post('/api/study/structure-tests',input);assert.equal(restarted.status,200,JSON.stringify(restarted.value));assert.deepEqual(restarted.value.article,copy.article);assert.equal(restarted.value.createdBy,'agent:codex');
});
