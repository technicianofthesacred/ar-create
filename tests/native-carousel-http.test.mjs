import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createArtifactExecution} from '../runtime/services/artifact-execution.mjs';
import {digest} from '../runtime/services/files.mjs';
import {buildRequest} from '../agents/lib/client.mjs';

const generated='---\nkind: CAROUSEL\nstage: words\nstatus: for-your-yes\nstory: Invented workshop\n---\n\n## Slides\n1. [hook] What does the invented record say?\n2. [teach] It describes a synthetic opening.\n3. [teach] Its source is explicitly invented.\n4. [close] Keep the remaining uncertainty visible.\n\n## Caption\nThis is an invented integration fixture.\n';

test('native Carousel HTTP mounts preserve source and sibling, register once and retain unreviewed words',async t=>{
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config,'utf8'));let launches=0;
 const execution=createArtifactExecution({available:()=>true,execute:async()=>{launches++;return {response:{artifacts:{'result.md':generated}}};}});
 const server=await createServer({...config,publicDir:path.resolve('public'),sharedArticles:true,researchEnabled:false,connections:[],magazineRoots:[],execution});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{execution.dispose();await new Promise(resolve=>server.close(resolve));fs.rmSync(home.dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(route,input,status=200,actor='agent:codex')=>{
  const response=await fetch(base+route,{method:input===undefined?'GET':'POST',headers:{'content-type':'application/json','x-ar-actor':actor,'x-ar-client':'cli'},...(input===undefined?{}:{body:JSON.stringify(input)})});
  const body=await response.json();assert.equal(response.status,status,route+' '+JSON.stringify(body));return body;
 };
 const originalFile=path.join(home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),original=fs.readFileSync(originalFile,'utf8');
 const opened=await request('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(original),operationId:randomUUID()});
 const copy=await request('/api/study/structure-tests',{sourceBindingId:opened.binding.id,sourceParentStudyId:'hk',expected:opened.expected,title:'Invented Carousel HTTP proof',operationId:randomUUID()});
 const group={rootBindingId:copy.bindingId,parentStudyId:copy.parentStudyId};
 const selected={...group,selectedOutputId:copy.article.outputId};
 const article=await request('/api/study/outputs?'+new URLSearchParams(selected));
 const scope={bindingId:copy.article.bindingId,parentStudyId:copy.parentStudyId};
 const native=await request('/api/study-draft/read?'+new URLSearchParams(scope));
 const input={...group,sourceBindingId:scope.bindingId,sourceOutputId:copy.article.outputId,expectedNative:native.expected,expectedOutput:article.expectedOutput,operationId:randomUUID()};
 const selector={...group,requestId:input.operationId},read=()=>request('/api/study/carousel-make?'+new URLSearchParams(selector));
 const commands=(await request('/api/capabilities')).commands;
 for(const action of ['preview','run','register','cancel']){
  const command=commands.find(c=>c.route==='/api/study/carousel-make/'+action);assert.ok(command);assert.equal(command.readOnly,false);assert.deepEqual(command.actors,['any']);
  const body=action==='preview'?input:selector;assert.deepEqual(buildRequest(command,body),{method:'POST',path:command.route,body});
 }
 await request('/api/study/carousel-make?'+new URLSearchParams({...group,unexpected:'no'}),undefined,400);
 await request('/api/study/carousel-make?'+new URLSearchParams(group)+'&rootBindingId='+group.rootBindingId,undefined,400);
 await request('/api/study/carousel-make?'+new URLSearchParams({...group,requestId:''}),undefined,400);
 await request('/api/study/carousel-make/preview?rootBindingId='+group.rootBindingId,input,400);
 await request('/api/study/carousel-make/preview',{...input,raw:'Unrequested prose.'},400);
 const preview=await request('/api/study/carousel-make/preview',input);assert.equal(preview.status,'preview');assert.equal(launches,0);
 await request('/api/study/carousel-make/run',selector);await execution.wait('native-carousel:'+input.operationId);
 const result=await read();assert.equal(result.status,'result-ready',JSON.stringify(result));assert.equal(result.finalizationVerified,true);assert.equal(result.artifact.raw,generated);assert.equal(launches,1);
 await request('/api/study/carousel-make/run',selector,409);
 await request('/api/study/carousel-make/register',{...selector,parentStudyId:'foreign'},404);
 const saved=await request('/api/study/carousel-make/register',selector);assert.equal(saved.status,'registered');assert.equal(saved.reviewed,false);assert.equal(saved.view.output.wordsReview,undefined);assert.equal(saved.view.output.adaptation.reviewed,false);
 const repeat=await request('/api/study/carousel-make/register',selector);assert.equal(repeat.outputId,saved.outputId);assert.equal(launches,1);
 const listing=await request('/api/study/carousel-make?'+new URLSearchParams(group));assert.equal(listing.items.length,1);assert.equal(listing.items[0].status,'registered');assert.equal(listing.items[0].artifact,undefined);assert.equal(listing.items[0].context,undefined);
 assert.deepEqual((await request('/api/study/outputs?'+new URLSearchParams(selected))).output,article.output);
 assert.equal((await request('/api/study-draft/read?'+new URLSearchParams(scope))).raw,native.raw);
 assert.equal(fs.readFileSync(originalFile,'utf8'),original);
 assert.equal((await request('/api/study/outputs?'+new URLSearchParams(group))).outputs.filter(output=>output.id===saved.outputId).length,1);
});
