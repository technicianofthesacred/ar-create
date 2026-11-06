import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {digest} from '../runtime/services/files.mjs';

for(const scenario of ['configured','disabled','explicit-native-override'])test('native drafting and translation respect '+scenario+' host execution without running a provider',async t=>{
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config,'utf8'));let launches=0;
 const adapter=(model,available)=>({capabilities:()=>({available,model,configuredProvider:'codex',readiness:{state:available?'unverified':'executable-missing',usable:available?null:false}}),launch(){launches++;throw Error('This read must not run a provider.');},wait:async()=>{},dispose(){}});
 const shared=adapter('host-selected-model',scenario!=='disabled'),override=scenario==='explicit-native-override'?adapter('explicit-native-test-model',true):undefined;
 const server=await createServer({...config,publicDir:path.resolve('public'),sharedArticles:true,researchEnabled:false,connections:[],magazineRoots:[],execution:shared,...(override?{nativeAIExecution:override}:{})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(home.dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(route,input)=>{const response=await fetch(base+route,{method:input?'POST':'GET',headers:{'content-type':'application/json','x-ar-actor':'agent:codex','x-ar-client':'cli'},...(input?{body:JSON.stringify(input)}:{})});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
 const raw=fs.readFileSync(path.join(home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8');
 const opened=await request('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(raw),operationId:randomUUID()});
 const copy=await request('/api/study/structure-tests',{sourceBindingId:opened.binding.id,sourceParentStudyId:'hk',expected:opened.expected,title:'Invented execution wiring',operationId:randomUUID()});
 const native=await request('/api/study-ai/read?'+new URLSearchParams({parentStudyId:copy.parentStudyId,bindingId:copy.article.bindingId}));
 const audience=await request('/api/study/language/capabilities?'+new URLSearchParams({kind:'audience-article',bindingId:copy.bindingId,parentStudyId:copy.parentStudyId,outputId:copy.article.outputId}));
 const owned=await request('/api/study-draft/read?'+new URLSearchParams({bindingId:copy.bindingId,parentStudyId:copy.parentStudyId}));
 const record=owned.context.records.find(r=>r.raw.includes('Entirely invented source fixture.'));assert.ok(record);
 const selectedSource=await request('/api/source-language/capabilities',{selection:{kind:'copy-capture-excerpts',bindingId:copy.bindingId,parentStudyId:copy.parentStudyId,recordId:record.id,expectedSourceHash:record.copiedHash,ranges:[{from:0,to:20}]}});
 for(const result of [audience,selectedSource])for(const [key,value] of Object.entries((override||shared).capabilities()))assert.deepEqual(result[key],value);
 assert.deepEqual(native.aiExecution,(override||shared).capabilities());assert.deepEqual(await request('/api/ai/execution/capabilities'),shared.capabilities());assert.equal(launches,0);assert.equal(fs.readFileSync(path.join(home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8'),raw);
});
