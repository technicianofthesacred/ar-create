import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {digest} from '../runtime/services/files.mjs';
import {renderConcept,directionPlanProjection,conceptContextProjection} from '../runtime/services/concept-markdown.mjs';
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');
const script=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const until=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI did not settle');};
const settle=()=>new Promise(r=>setTimeout(r,20));
async function fixture(t){
 const home=syntheticHome(),config=JSON.parse(fs.readFileSync(home.config,'utf8')),server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port,windows=[],calls=[];
 t.after(async()=>{windows.forEach(w=>w.close());await new Promise(r=>server.close(r));fs.rmSync(home.dir,{recursive:true,force:true});});
 async function request(route,body){const response=await fetch(url+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian'},body:JSON.stringify(body)}),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
 const original=fs.readFileSync(path.join(home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8'),opened=await request('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(original),operationId:randomUUID()}),scope={parentStudyId:'hk',scope:'part',bindingId:opened.binding.id};
 const select=await request('/api/study/human-direction/select',{...scope,title:'Invented part',operationId:randomUUID()});
 const exact='My exact original words.\n保留我的疑问。\n\n';
 await request('/api/study/human-direction/write',{...scope,expectedRevision:select.revision,expectedHash:select.hash,operationId:randomUUID(),body:exact});
 async function boot(recovery,{malformed=false,stage=4}={}){
  const dom=new JSDOM('<div id="app"><div id="stage-working-lane"></div></div>',{url,runScripts:'outside-only'}),w=dom.window;windows.push(w);Object.defineProperty(w,'crypto',{value:webcrypto});if(recovery)w.localStorage.setItem('ar-study-human-direction-recovery-v1',recovery);
  w.p={id:'hk',name:'Invented project',view:'record',viewedStage:stage};w.current=()=>w.p;w.state={projects:[w.p]};w.binding=opened.binding;w.studyDraft={currentBinding:()=>w.binding};w.studySourceContinuation={selection:()=>({parentStudyId:'hk',bindingId:w.binding?.id||''})};w.render=()=>{w.document.getElementById('app').innerHTML=w.p.viewedStage===5?'<div class="workspace"><div class="desk"></div></div>':'<div id="stage-working-lane"></div>';};
  w.fetch=(route,options)=>{calls.push({route,body:options?.body&&JSON.parse(options.body)});return fetch(url+route,{...options,headers:{...options?.headers,'X-AR-Actor':'human:adrian'}});};
  w.eval(script('human-direction.js'));w.eval(script('direction-writing-tools.js'));await until(()=>stage===3?w.studyHumanDirection.questionState({parentStudyId:'hk'}).available:malformed?w.document.querySelector('.dwt-context [role=alert]')?.textContent.includes('needs review'):!w.document.querySelector('[data-dwt-plan="title"]')?.disabled);return w;
 }
 const read=()=>request('/api/study/human-direction?'+new URLSearchParams(scope));
 return {boot,read,request,scope,exact,calls,opened,home};
}
const edit=(w,key,value)=>{const field=w.document.querySelector('[data-dwt-plan="'+key+'"]');field.value=value;field.dispatchEvent(new w.Event('input',{bubbles:true}));};
const click=(w,action)=>w.document.querySelector('[data-dwt-action="'+action+'"]').click();
test('Undo refuses to discard an unsaved plan or its recovery copy',async t=>{
 const f=await fixture(t),w=await f.boot();edit(w,'audience','My unsaved audience');const before=await f.read(),recovery=w.localStorage.getItem('ar-study-human-direction-recovery-v1');
 assert.equal(w.document.querySelector('[data-dwt-action="undo-plan"]').disabled,true);
 await assert.rejects(()=>w.studyHumanDirection.planUndo(f.scope),/unsaved/i);assert.equal((await f.read()).body,before.body);assert.equal(w.localStorage.getItem('ar-study-human-direction-recovery-v1'),recovery);assert.equal(w.document.querySelector('[data-dwt-plan="audience"]').value,'My unsaved audience');
});

test('all six plan choices survive physical save, page reopening and scoped agent context without altering original prose or manuscripts',async t=>{
 const f=await fixture(t),w=await f.boot(),values={title:'An invented beginning',audience:'Curious readers',language:'English / 中文',output:'Article and short post',opening:'Start with my question — not certainty.',closing:'Leave an honest question open. <!-- ar-create:direction-plan:v1 -->'};
 w.document.querySelector('.dwt-notes').open=true;
 for(const [key,value] of Object.entries(values))edit(w,key,value);
 assert.equal(f.calls.filter(c=>c.body&&c.route.endsWith('/write')).length,0,'typing only updates owner recovery');
 const recovery=JSON.parse(w.localStorage.getItem('ar-study-human-direction-recovery-v1'));assert.match(recovery.hk.drafts[f.scope.bindingId],/Curious readers/);assert.ok(recovery.hk.drafts[f.scope.bindingId].startsWith(f.exact));
 click(w,'save-plan');await until(()=>w.document.querySelector('.dwt-context').textContent.includes('Saved revision 2'));
 const saved=await f.read();assert.ok(saved.body.startsWith(f.exact));assert.deepEqual(directionPlanProjection(saved.body).values,values);assert.equal(fs.readFileSync(saved.path,'utf8'),saved.body);
 const post=f.calls.find(c=>c.body&&c.route.endsWith('/write'));assert.equal(post.body.scope,'part');assert.equal(post.body.bindingId,f.scope.bindingId);assert.equal(post.body.expectedRevision,1);assert.match(post.body.expectedHash,/^[a-f0-9]{64}$/);assert.match(post.body.operationId,/^[a-f0-9-]{36}$/);
 const reopened=await f.boot();for(const [key,value] of Object.entries(values))assert.equal(reopened.document.querySelector('[data-dwt-plan="'+key+'"]').value,value);
 const read=await f.request('/api/study-ai/read?'+new URLSearchParams({parentStudyId:'hk',bindingId:f.scope.bindingId})),sourceIds=read.sourceCatalog.filter(s=>s.canPrepare).map(s=>s.id),prepared=await f.request('/api/study-ai/prepare?'+new URLSearchParams({parentStudyId:'hk',bindingId:f.scope.bindingId}),{sourceIds}),context=await f.request('/api/study-ai/context?'+new URLSearchParams({parentStudyId:'hk',bindingId:f.scope.bindingId,requestId:prepared.id}));
 const part=context.humanDirection.records.find(r=>r.scope.bindingId===f.scope.bindingId);assert.deepEqual(part.planningIntent.values,values);assert.match(part.planningIntent.role,/not-wording-or-publication-approval/);assert.equal(part.body,saved.body);assert.equal(fs.readFileSync(f.opened.paths.draft,'utf8'),fs.readFileSync(path.join(f.home.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8'));
 click(reopened,'undo-plan');await until(()=>reopened.document.querySelector('.dwt-context').textContent.includes('Saved revision 3'));assert.equal((await f.read()).body,f.exact);assert.equal(reopened.document.querySelector('[data-dwt-plan="title"]').value,'');
});

test('recovered plan detects an incoming revision, preserves both and requires explicit existing conflict resolution',async t=>{
 const f=await fixture(t),w=await f.boot();edit(w,'audience','My unsaved audience');const recovery=w.localStorage.getItem('ar-study-human-direction-recovery-v1');
 const before=await f.read();await f.request('/api/study/human-direction/write',{...f.scope,expectedRevision:before.revision,expectedHash:before.hash,operationId:randomUUID(),body:'A later human revision.\n'});
 const next=await f.boot(recovery);assert.equal(next.document.querySelector('[data-dwt-plan="audience"]').value,'My unsaved audience');assert.equal(next.document.querySelector('[data-dwt-action="save-plan"]').disabled,true);assert.match(next.document.querySelector('.dwt-context').textContent,/Compare both/);
 await next.studyHumanDirection.choosePart(f.scope);assert.match(next.document.querySelector('[data-direction-current]').textContent,/later human revision/);assert.equal(next.document.querySelector('[data-human-direction]').value,f.exact);assert.equal(next.studyHumanDirection.planState(f.scope).values.audience,'My unsaved audience');
 await until(()=>!next.studyHumanDirection.planState(f.scope).busy);next.document.querySelector('[data-direction-use-saved]').click();await settle();assert.equal(next.document.querySelector('[data-dwt-plan="audience"]').value,'');assert.equal((await f.read()).body,'A later human revision.\n');
});

test('plan is bound to selected project or exact manuscript part and malformed manual sections refuse replacement',async t=>{
 const f=await fixture(t),w=await f.boot();edit(w,'title','Part title');w.binding=null;w.studyDirectionWritingTools.mount();await until(()=>w.document.querySelector('.dwt-context').textContent.includes('whole project')&&!w.document.querySelector('[data-dwt-plan="title"]').disabled);assert.equal(w.document.querySelector('[data-dwt-plan="title"]').value,'');edit(w,'title','Project title');w.binding=f.opened.binding;w.studyDirectionWritingTools.mount();await settle();assert.equal(w.document.querySelector('[data-dwt-plan="title"]').value,'Part title');
 const before=await f.read(),body=f.exact+'<!-- ar-create:direction-plan:v1 -->\nmanual unmatched plan';await f.request('/api/study/human-direction/write',{...f.scope,expectedRevision:before.revision,expectedHash:before.hash,operationId:randomUUID(),body});
 const broken=await f.boot(null,{malformed:true});assert.equal(broken.document.querySelector('[data-dwt-action="save-plan"]').disabled,true);assert.equal(broken.document.querySelector('[data-dwt-plan="title"]').disabled,true);assert.equal((await f.read()).body,body);
});


test('a stale save retains the local plan and incoming saved text until the human compares them',async t=>{
 const f=await fixture(t),w=await f.boot();edit(w,'opening','My still unsaved opening');
 const before=await f.read();await f.request('/api/study/human-direction/write',{...f.scope,expectedRevision:before.revision,expectedHash:before.hash,operationId:randomUUID(),body:'An independent incoming direction.\n'});
 click(w,'save-plan');await until(()=>w.document.querySelector('[data-dwt-action="save-plan"]').disabled&&w.document.querySelector('.dwt-context [role=alert]'));
 assert.equal(w.document.querySelector('[data-dwt-plan="opening"]').value,'My still unsaved opening');assert.equal((await f.read()).body,'An independent incoming direction.\n');
 click(w,'angle');await until(()=>w.document.querySelector('[data-direction-current]'));assert.match(w.document.querySelector('[data-direction-current]').textContent,/independent incoming/);assert.equal(w.document.querySelector('[data-human-direction]').value,f.exact);assert.equal(w.studyHumanDirection.planState(f.scope).values.opening,'My still unsaved opening');
});


const sixFields={title:'A saved title',audience:'Curious readers',language:'English / 中文',output:'Short post',opening:'Begin with my question.',closing:'Leave room for doubt.'};
const typeProse=(w,text)=>{const input=w.document.querySelector('[data-human-direction]');input.value=text;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
const block=body=>body.slice(body.indexOf('<!-- ar-create:direction-plan:v1 -->'));

test('normal prose editor stays clean while all six plan fields survive prose edits, concurrent plan edits and device recovery',async t=>{
 const f=await fixture(t),w=await f.boot();for(const [key,value] of Object.entries(sixFields))edit(w,key,value);click(w,'save-plan');await until(()=>w.document.querySelector('.dwt-context').textContent.includes('Saved revision 2'));
 const saved=await f.read();click(w,'angle');assert.equal(w.document.querySelector('[data-human-direction]').value,f.exact);assert.equal(w.document.querySelector('.human-direction-preview').textContent,f.exact);
 const prose='My replacement prose.\nExact second line — 保留疑问。\n\n';typeProse(w,prose);
 let recovery=JSON.parse(w.localStorage.getItem('ar-study-human-direction-recovery-v1')).hk.drafts[f.scope.bindingId];assert.equal(block(recovery),block(saved.body),'editing prose preserves the saved planning block byte for byte');
 edit(w,'closing','A concurrent unsaved ending.');assert.equal(w.document.querySelector('[data-human-direction]').value,prose,'editing a plan keeps exact unsaved prose');
 const newer=prose+'One more exact sentence.';typeProse(w,newer);recovery=w.localStorage.getItem('ar-study-human-direction-recovery-v1');const canonical=JSON.parse(recovery).hk.drafts[f.scope.bindingId];assert.equal(directionPlanProjection(canonical).values.closing,'A concurrent unsaved ending.');
 const reopened=await f.boot(recovery);click(reopened,'angle');assert.equal(reopened.document.querySelector('[data-human-direction]').value,newer);assert.equal(reopened.document.querySelector('[data-dwt-plan="closing"]').value,'A concurrent unsaved ending.');
 click(reopened,'save-plan');await until(()=>reopened.document.querySelector('.dwt-context').textContent.includes('Saved revision 3'));assert.equal(block((await f.read()).body),block(canonical));assert.deepEqual(directionPlanProjection((await f.read()).body).values,{...sixFields,closing:'A concurrent unsaved ending.'});
 click(reopened,'undo-plan');await until(()=>reopened.document.querySelector('.dwt-context').textContent.includes('Saved revision 4'));assert.equal(reopened.document.querySelector('[data-human-direction]').value,f.exact);assert.deepEqual(directionPlanProjection((await f.read()).body).values,sixFields);
});

test('plan-only record has an empty prose field and saved context presents readable intent in writing and learning',async t=>{
 const f=await fixture(t),w=await f.boot();w.binding=null;w.studyDirectionWritingTools.mount();await until(()=>w.document.querySelector('.dwt-context').textContent.includes('whole project')&&!w.document.querySelector('[data-dwt-plan="title"]').disabled);
 for(const [key,value] of Object.entries(sixFields))edit(w,key,value);click(w,'save-plan');await until(()=>w.document.querySelector('.dwt-context').textContent.includes('Saved revision 1'));click(w,'angle');assert.equal(w.document.querySelector('[data-human-direction]').value,'');assert.equal(w.document.querySelector('.human-direction-preview'),null);
 w.p.viewedStage=5;w.p.view='article';w.render();await until(()=>w.document.querySelector('[data-readable-direction-plan]'));assert.match(w.document.querySelector('.human-direction-banner').textContent,/AudienceCurious readers/);assert.doesNotMatch(w.document.querySelector('.human-direction-banner').textContent,/```json|ar-create:direction-plan/);
 w.p.viewedStage=3;w.p.view='record';w.render();await until(()=>w.document.querySelector('[data-learning-shared-body]'));assert.equal(w.document.querySelector('[data-human-direction]').value,'');assert.doesNotMatch(w.document.querySelector('[data-learning-shared-body]').textContent,/```json|ar-create:direction-plan/);assert.match(w.document.querySelector('[data-readable-direction-plan]').textContent,/Opening intentBegin with my question/);
});

test('conflict comparison retains the incoming saved plan as readable fields and malformed metadata remains editable',async t=>{
 const f=await fixture(t),w=await f.boot();for(const [key,value] of Object.entries(sixFields))edit(w,key,value);const recovery=w.localStorage.getItem('ar-study-human-direction-recovery-v1'),canonical=JSON.parse(recovery).hk.drafts[f.scope.bindingId],before=await f.read();
 await f.request('/api/study/human-direction/write',{...f.scope,expectedRevision:before.revision,expectedHash:before.hash,operationId:randomUUID(),body:canonical.replace('A saved title','An incoming title')});
 const next=await f.boot(recovery);click(next,'angle');await until(()=>next.document.querySelector('[data-direction-current]'));const comparison=next.document.querySelector('[data-direction-current]');assert.match(comparison.textContent,/An incoming title/);assert.match(comparison.textContent,/AudienceCurious readers/);assert.doesNotMatch(comparison.textContent,/```json|ar-create:direction-plan/);assert.equal(next.document.querySelector('[data-dwt-plan="title"]').value,'A saved title');
 const current=await f.read(),malformed=f.exact+'<!-- ar-create:direction-plan:v1 -->\nMy manual unfinished plan';await f.request('/api/study/human-direction/write',{...f.scope,expectedRevision:current.revision,expectedHash:current.hash,operationId:randomUUID(),body:malformed});
 const broken=await f.boot(null,{malformed:true});click(broken,'angle');assert.equal(broken.document.querySelector('[data-human-direction]').value,malformed);typeProse(broken,malformed+'\nMy review note.');assert.equal(JSON.parse(broken.localStorage.getItem('ar-study-human-direction-recovery-v1')).hk.drafts[f.scope.bindingId],malformed+'\nMy review note.');
});

test('mixed concept context exposes planning intent separately and never promotes provisional prose to adopted direction',()=>{
 const concept=renderConcept({authorThoughts:'My exact memory.',adoptedDirection:'Keep my uncertainty.',aiInterpretation:'An unadopted interpretation.',suggestions:'An unadopted title.',sourceSelections:[]}),block='<!-- ar-create:direction-plan:v1 -->\n## Planning intent — not approval of wording or publication\n\n```json\n'+JSON.stringify({title:'My planning title'})+'\n```\n<!-- /ar-create:direction-plan:v1 -->';
 const full=concept+'\n\n'+block,projection=conceptContextProjection(full);assert.deepEqual(projection.planningIntent.values,{title:'My planning title'});assert.equal(projection.body,'Keep my uncertainty.');assert.equal(projection.personalThoughts.body,'My exact memory.');assert.equal(projection.suggestions.body,'An unadopted title.');assert.equal(projection.sourceSnapshot.body,full);
});


test('native project question uses its ready human direction owner when the authored concept route returns 404',async t=>{
 const f=await fixture(t),w=await f.boot(null,{stage:3}),project={parentStudyId:'hk',scope:'project'},before=await f.request('/api/study/human-direction?'+new URLSearchParams(project)),manuscriptBefore=fs.readFileSync(f.opened.paths.draft,'utf8');
 assert.equal(before.bound,true);assert.equal(before.scope.parentStudyId,'hk');assert.equal((await fetch(w.location.origin+'/api/concept?parentStudyId=hk')).status,404);
 w.studyHumanDirection.planEdit(project,'title','Native project intent');await w.studyHumanDirection.planSave(project);await until(()=>w.studyHumanDirection.questionState(project).available);const planned=await f.request('/api/study/human-direction?'+new URLSearchParams(project));
 const input={parentStudyId:'hk',pointId:'native-retained-point',title:'A native retained point',text:'My exact native project question.',origin:{recordPath:'Workflow/RESEARCH - Invented.md',recordHash:'a'.repeat(64),originalText:'Exact retained invented research.'}};
 await w.studyHumanDirection.appendQuestion(input,()=>{});await until(()=>w.studyHumanDirection.questionState(project).available);
 const saved=await f.request('/api/study/human-direction?'+new URLSearchParams(project));assert.equal(saved.path,planned.path);assert.deepEqual(saved.scope,before.scope);assert.equal(fs.readFileSync(saved.path,'utf8'),saved.body);assert.match(saved.body,/My exact native project question/);assert.equal(directionPlanProjection(saved.body).values.title,'Native project intent');assert.equal(fs.readFileSync(f.opened.paths.draft,'utf8'),manuscriptBefore);
 assert.equal(f.calls.some(c=>c.route.endsWith('/select')||c.route.endsWith('/concept/save')),false);const writes=f.calls.filter(c=>c.body&&c.route.endsWith('/write'));assert.equal(writes.length,2);assert.equal(writes[1].body.scope,'project');assert.equal(writes[1].body.parentStudyId,'hk');
 const reopened=await f.boot(null,{stage:3});assert.equal(reopened.studyHumanDirection.questionState(project).entries[0].text,input.text);assert.doesNotMatch(reopened.document.querySelector('[data-human-direction]').value,/research-question|recordHash/);
 const unsafe=saved.body+'\n\nSource ID: `12345678-1234-1234-1234-123456789abc` · SHA-256: `'+ 'b'.repeat(64)+'` · character 0';
 await f.request('/api/study/human-direction/write',{...project,operationId:randomUUID(),expectedRevision:saved.revision,expectedHash:saved.hash,body:unsafe});reopened.dispatchEvent(new reopened.Event('focus'));await until(()=>reopened.studyHumanDirection.questionState(project).reason.includes('source connections'));
 await assert.rejects(reopened.studyHumanDirection.appendQuestion({...input,text:'Blocked linked-source question'},()=>{}),/source connections/);assert.equal((await f.request('/api/study/human-direction?'+new URLSearchParams(project))).body,unsafe);
});
