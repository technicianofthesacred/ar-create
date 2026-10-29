import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from '../runtime/server.mjs';
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');
const scripts=['draft-flow.js','human-direction.js','source-continuation.js'].map(name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8'));
const settle=async()=>{for(let n=0;n<10;n++)await new Promise(r=>setTimeout(r,5));};
const until=async predicate=>{for(let n=0;n<100;n++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}assert.fail('Caller did not reach the expected state');};
async function fixture(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'collection-source-callers-'))),dataDir=path.join(dir,'data'),vault=path.join(dir,'vault'),files=path.join(dir,'files');fs.mkdirSync(vault);fs.mkdirSync(files);
 const server=await createServer({dataDir,publicDir:path.resolve('public'),studyOriginalRoots:{vaultRoot:vault,filesRoot:files},sharedArticles:true,researchEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,windows=[];
 t.after(async()=>{windows.forEach(w=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 async function request(route,body){const response=await fetch(base+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian'},body:JSON.stringify(body)}),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
 const parentStudyId='invented-collection-'+randomUUID(),root=await request('/api/study-draft/create-collection',{parentStudyId,title:'Invented collected thought',operationId:randomUUID()}),bindingId=root.binding.id,scope={parentStudyId,bindingId};
 const source=(await request('/api/sources/import',{files:[{name:'Invented note.md',content:'Exact invented source uncertainty.'}]})).receipts[0].source;
 await request('/api/first-flow/select',{projectKey:parentStudyId,title:root.binding.title,operationId:randomUUID()});
 await request('/api/first-flow/attach',{projectId:root.projectBinding.projectId,sourceIds:[source.id],operationId:randomUUID()});await request('/api/first-flow/source-review',{projectId:root.projectBinding.projectId,sourceId:source.id,expectedHash:source.hash,reviewed:true,humanDecision:true,operationId:randomUUID()});
 const catalog=await request('/api/study-draft/catalog');assert.deepEqual(catalog.drafts,[]);
 async function boot({stored,catalogView=value=>value,unbound=false,selectionFailure=false,delaySource=false}={}){
  const dom=new JSDOM('<main id="app"><div id="stage-working-lane"></div></main>',{url:base+'/document-study/',runScripts:'outside-only'}),w=dom.window;windows.push(w);const p={id:parentStudyId,name:'Invented collected thought',collectionKind:'collection-root',collectionBindingId:bindingId,view:'record',viewedStage:3,blocks:[],history:[],note:null,positions:{}},calls=[],reviews=[];let connected=!unbound,releaseSource;const sourceGate=delaySource?new Promise(resolve=>releaseSource=resolve):Promise.resolve();let gate=()=>{};
  if(stored)for(const [key,value]of Object.entries(stored))w.localStorage.setItem(key,value);
  Object.assign(w,{state:{projects:[p]},current:()=>p,selected:null,activeBlock:null,keyboardBlock:null,typingSession:null,WORKFLOW_RECORDS:{},esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),readonlyHTML:value=>value,shortRecordName:value=>value,toast:()=>{},rememberPosition:()=>{},commitTyping:()=>{},save:()=>{},onTyping:()=>{},viewPhase:n=>{p.viewedStage=n;p.view='record';w.render();},setView:v=>{p.view=v;w.render();},blockHTML:b=>'<'+b.tag+' data-block="'+b.id+'">'+b.html+'</'+b.tag+'>',article:()=>'<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">'+p.blocks.map(b=>w.blockHTML(b)).join('')+'</div>',undo:()=>{},workflowBar:()=>'',refreshDiscussion:()=>{},phaseReader:()=>'<div id="stage-working-lane"></div>',historicalNotice:()=>'',wireDocument:()=>{},openInstruction:()=>{},render:()=>{w.document.getElementById('app').innerHTML=p.view==='article'?w.article(p):w.phaseReader(p);w.wireDocument();}});
  Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;Object.defineProperty(w.document,'scrollingElement',{value:w.document.documentElement});w.studyAIProposals={openPrepared:async input=>reviews.push({...input})};
  w.fetch=async(route,options)=>{const u=new URL(route,base),body=options?.body&&JSON.parse(options.body),call={path:u.pathname,query:Object.fromEntries(u.searchParams),body};calls.push(call);await gate(call);if(u.pathname==='/api/study-ai/read')await sourceGate;
   if(u.pathname==='/api/study-ai/read'&&!connected)return {ok:false,status:409,json:async()=>({error:'Exact ready persisted parent and part bindings required for material context.'})};
   if(u.pathname==='/api/study/human-direction/select')connected=true;
   if(selectionFailure&&u.pathname==='/api/study/human-direction'&&u.searchParams.get('scope')==='part')return {ok:false,status:423,json:async()=>({error:'Invented scope locked'})};
   const response=await fetch(base+u.pathname+u.search,{...options,headers:{...options?.headers,'X-AR-Actor':'human:adrian'}});if(u.pathname.endsWith('/catalog')){const value=catalogView(await response.json());return {ok:response.ok,status:response.status,json:async()=>value};}return response;
  };
  scripts.forEach(code=>w.eval(code));await settle();return {w,p,calls,reviews,releaseSource,setGate:fn=>gate=fn,storage:()=>Object.fromEntries(Object.keys(w.localStorage).map(key=>[key,w.localStorage.getItem(key)])),selectSource:async()=>{const input=w.document.querySelector('[data-continuation-source="'+source.id+'"]');assert.ok(input,'ready Collection source loads through actual choosePart');input.checked=true;input.dispatchEvent(new w.Event('change'));await settle();}};
 }
 return {boot,request,root,source,scope,catalog};
}
test('new Collection source reaches actual Direction and Draft callers, opening preparation survives switch/reload without approval',async t=>{
 const f=await fixture(t),before=await f.request('/api/study-draft/read?'+new URLSearchParams(f.scope)),b=await f.boot();
 await until(()=>b.w.document.querySelector('[data-continuation-source]'));await b.w.studyHumanDirection.choosePart(f.scope);await b.selectSource();assert.equal(b.w.document.querySelector('[data-continuation-openings]').disabled,false);
 const stored=b.storage();b.p.id='unrelated';b.w.render();await settle();b.p.id=f.scope.parentStudyId;b.w.render();await settle();assert.equal(b.w.studySourceContinuation.selection().bindingId,f.scope.bindingId);
 const reopened=await f.boot({stored});await until(()=>reopened.w.document.querySelector('[data-continuation-source="'+f.source.id+'"]')?.checked);reopened.w.document.querySelector('[data-continuation-openings]').click();await until(()=>reopened.reviews.length===1);assert.equal(reopened.reviews.length,1);
 assert.equal(reopened.w.studyDraft.currentBinding().id,f.scope.bindingId);assert.equal(reopened.p.viewedStage,5);assert.equal(reopened.reviews[0].bindingId,f.scope.bindingId);
 const prepared=reopened.calls.find(c=>c.path==='/api/study-ai/prepare');assert.deepEqual(prepared.query,f.scope);assert.deepEqual(prepared.body,{sourceIds:[f.source.id],purpose:'opening-options',answerIds:[]});
 const context=await f.request('/api/study-ai/context?'+new URLSearchParams({...f.scope,requestId:reopened.reviews[0].requestId}));assert.equal(context.editorialPlan.originalPlan.status,'not-applicable');assert.ok(context.sources.some(record=>record.id===f.source.id));
 const after=await f.request('/api/study-draft/read?'+new URLSearchParams(f.scope));assert.equal(after.raw,before.raw);assert.deepEqual(after.expected,before.expected);assert.equal((await f.request('/api/study-draft/catalog')).collections.length,1);assert.deepEqual(reopened.calls.filter(c=>c.body).map(c=>c.path),['/api/study-ai/prepare']);
});
test('Collection context reconnect rechecks its exact root and deduplicates identical catalog rows',async t=>{
 const f=await fixture(t),b=await f.boot({unbound:true,catalogView:c=>({...c,collections:[...c.collections,...c.collections]})});await until(()=>b.w.document.querySelector('[data-continuation-connect]'));assert.equal(b.w.document.querySelectorAll('[data-continuation-part] option').length,2);
 b.w.document.querySelector('[data-continuation-connect]').click();await until(()=>b.w.document.querySelector('[data-continuation-source]'));assert.deepEqual(b.calls.filter(c=>c.body).map(c=>c.path),['/api/study/human-direction/select']);await b.w.studyHumanDirection.choosePart(f.scope);
});
test('foreign, pending, fork and ambiguous roots never reach a source or preparation',async t=>{
 const f=await fixture(t);for(const kind of ['foreign','pending','fork','ambiguous']){const b=await f.boot({catalogView:c=>{const row=c.collections[0];return {...c,collections:kind==='ambiguous'?[row,{...row,parentStudyId:'foreign'}]:[{...row,...({foreign:{parentStudyId:'foreign'},pending:{bindingStatus:'pending'},fork:{kind:'output-fork'}}[kind])}]};}});await settle();assert.equal(b.w.document.querySelector('[data-continuation-source]'),null,kind);assert.equal(b.w.document.querySelector('[data-continuation-openings]').disabled,true,kind);await assert.rejects(b.w.studyDraft.openPart(f.scope),/ready|ambiguous/i);assert.equal(b.calls.some(c=>c.body),false,kind);}
});
test('failed exact Direction load keeps a discovered Collection root held before preparation',async t=>{
 const f=await fixture(t),b=await f.boot({selectionFailure:true});await settle();await b.selectSource();assert.equal(b.w.document.querySelector('[data-continuation-openings]').disabled,true);assert.equal(b.calls.some(c=>c.path==='/api/study-ai/prepare'),false);
});

import {openingProposalTarget} from '../runtime/services/native-proposal-capability.mjs';
import {createStudyEditorialPlanContext} from '../runtime/services/study-editorial-plan-context.mjs';
import {digest} from '../runtime/services/files.mjs';
test('authored-root original-plan adapter is explicit, hashed and refuses contradictory identity or support',async()=>{
 const binding={bindingId:randomUUID(),parentStudyId:'invented-new-parent'},base={binding:{id:binding.bindingId,parentStudyId:binding.parentStudyId,kind:'collection-root',origin:'authored-collection',originalId:'collection:'+binding.parentStudyId,partKey:'collection',authority:'owned-working-copy',status:'ready'},readiness:{ready:true},expected:{workflow:{draft:digest('Invented draft')}},context:{records:[{role:'draft'}]}};
 let current=base;const adapter=createStudyEditorialPlanContext({drafts:{read:async()=>current},originals:{readDraft:()=>assert.fail('Authored root cannot impersonate an original')},choices:{read:()=>assert.fail('Original-backed choices do not apply to a new authored parent')}}),view=await adapter.context(binding),{hash,...payload}=view;
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 assert.equal(hash,digest(stable(payload)));assert.equal(view.originalPlan.status,'not-applicable');assert.deepEqual(view.records,[]);assert.deepEqual(view.selections,[]);assert.deepEqual(view.expected,base.expected);
 for(const change of [{binding:{kind:'output-fork'}},{binding:{origin:'foreign'}},{binding:{originalId:'foreign'}},{binding:{partKey:'article'}},{binding:{parentStudyId:'foreign'}},{binding:{parentStudyId:'hk',originalId:'collection:hk'}},{context:{records:[{role:'research',raw:'Must not silently drop retained support'}]}},{context:{records:[{role:'brief',missing:true}]}}]){current={...base,...change,binding:{...base.binding,...change.binding}};await assert.rejects(adapter.context(change.binding?.parentStudyId==='hk'?{...binding,parentStudyId:'hk'}:binding),/Authored (?:root|independent Article)|Exact ready/);}
 current=base;await assert.rejects(adapter.context(binding,{acceptedOpening:{schema:'fake'}}),/lineage/);
});

test('leaving while Collection sources load retries exact Direction selection on return',async t=>{
 const f=await fixture(t),b=await f.boot({delaySource:true});await until(()=>b.calls.some(c=>c.path==='/api/study-ai/read'));
 b.p.id='unrelated';b.w.render();await settle();b.releaseSource();await settle();b.p.id=f.scope.parentStudyId;b.w.render();
 await until(()=>b.w.document.querySelector('[data-continuation-source="'+f.source.id+'"]'));await b.selectSource();await until(()=>!b.w.document.querySelector('[data-continuation-openings]').disabled);
 assert.equal(b.w.studySourceContinuation.selection().bindingId,f.scope.bindingId);assert.equal(b.calls.some(c=>c.body),false);
});
test('Collection connection recheck refuses a root that became pending without a write',async t=>{
 const f=await fixture(t);let pending=false;const b=await f.boot({unbound:true,catalogView:c=>pending?{...c,collections:c.collections.map(row=>({...row,bindingStatus:'pending'}))}:c});
 await until(()=>b.w.document.querySelector('[data-continuation-connect]'));pending=true;b.w.document.querySelector('[data-continuation-connect]').click();await settle();
 assert.equal(b.calls.some(c=>c.body),false);assert.equal(b.w.document.querySelector('[data-continuation-openings]').disabled,true);
});

test('authored second and manual language Articles prepare from their own saved words and Direction independently of later source writing',async t=>{
 const f=await fixture(t),group={rootBindingId:f.scope.bindingId,parentStudyId:f.scope.parentStudyId},query=new URLSearchParams(group),draftRoute=scope=>'/api/study-draft/read?'+new URLSearchParams(scope),aiRoute=(scope,name,requestId)=>'/api/study-ai/'+name+'?'+new URLSearchParams({...scope,...(requestId?{requestId}:{})});
 const root=await f.request(draftRoute(f.scope)),written=await f.request('/api/study-draft/save',{...f.scope,operationId:randomUUID(),expected:root.expected,operations:[{kind:'insert',id:randomUUID(),beforeId:openingProposalTarget(root).beforeId,raw:'I keep the invented origin uncertain.'}]}),initial=await f.request('/api/study/outputs?'+query);
 const primary=await f.request('/api/study/outputs/create',{...group,kind:'article',sourceBindingId:f.scope.bindingId,expectedNative:written.expected,expectedOutput:initial.expectedOutput,operationId:randomUUID()}),second=await f.request('/api/study/outputs/create',{...group,kind:'article',sourceBindingId:f.scope.bindingId,expectedNative:(await f.request(draftRoute(f.scope))).expected,expectedOutput:primary.view.expectedOutput,operationId:randomUUID()}),language=await f.request('/api/study/outputs/create',{...group,kind:'article',sourceOutputId:primary.view.output.id,targetLanguage:'zh-Hans',expectedSourceWords:primary.view.writingProof,expectedOutput:second.view.expectedOutput,operationId:randomUUID()});
 const captured=[];
 for(const [index,created]of [second,language].entries()){
  const own=created.view.outputBindings.find(row=>row.outputId===created.view.output.id).wordOwner,scope={bindingId:own.bindingId,parentStudyId:own.parentStudyId};assert.notEqual(scope.bindingId,f.scope.bindingId);
  const before=await f.request(draftRoute(scope));assert.equal(before.binding.kind,'output-fork');assert.equal(before.binding.origin,'authored-collection');
  const row=before.projection.find(row=>row.words==='I keep the invented origin uncertain.'),saved=await f.request('/api/study-draft/save',{...scope,operationId:randomUUID(),expected:before.expected,operations:[{kind:'text',id:row.id,from:0,to:row.words.length,insert:'I keep this independent invented Article '+index+' uncertain.',seenBlockHash:row.blockHash}]});
  const selected=await f.request('/api/study/human-direction/select',{...scope,scope:'part',title:'Invented independent Article '+index,operationId:randomUUID()}),direction=await f.request('/api/study/human-direction/write',{...scope,scope:'part',body:'Retain the independent focus '+index+'.',expectedRevision:selected.revision,expectedHash:selected.hash,operationId:randomUUID()});
  const prepared=await f.request(aiRoute(scope,'prepare'),{purpose:'opening-options',sourceIds:[f.source.id]}),context=await f.request(aiRoute(scope,'context',prepared.id));
  assert.equal(context.raw,saved.raw);assert.equal(context.editorialPlan.contextScope,'exact-authored-independent-output');assert.equal(context.editorialPlan.outputLineage.outputId,created.view.output.id);assert.ok(context.humanDirection.records.some(record=>record.scope.bindingId===scope.bindingId&&record.body===direction.body));assert.equal(prepared.modelExecuted,false);captured.push({scope,prepared,context,saved});
 }
 const latest=await f.request(draftRoute(f.scope)),rootParagraph=latest.projection.find(row=>row.words==='I keep the invented origin uncertain.');await f.request('/api/study-draft/save',{...f.scope,operationId:randomUUID(),expected:latest.expected,operations:[{kind:'text',id:rootParagraph.id,from:0,to:rootParagraph.words.length,insert:'The source manuscript now has different invented words.',seenBlockHash:rootParagraph.blockHash}]});
 for(const child of captured){assert.deepEqual(await f.request(aiRoute(child.scope,'context',child.prepared.id)),child.context);const current=await f.request(draftRoute(child.scope));assert.equal(current.raw,child.saved.raw);assert.deepEqual(current.expected,child.saved.expected);}
});

test('authored output plan requires exact canonical archival fork proof and refuses malformed lineage',async()=>{
 const binding={bindingId:randomUUID(),parentStudyId:'invented-independent-parent'},sourceBindingId=randomUUID(),outputId=randomUUID(),hash=digest('Invented immutable fork seed'),expected={workflow:{draft:hash,edits:null},bindingHash:digest('binding'),correspondenceHash:digest('correspondence')},fork={id:binding.bindingId,parentStudyId:binding.parentStudyId,kind:'output-fork',origin:'authored-collection',originalId:'collection:'+binding.parentStudyId,partKey:'collection',authority:'owned-working-copy',status:'ready',outputId,canonicalOutputId:outputId,sourceBindingId,seedWorkingHash:hash,derivedFrom:{bindingId:sourceBindingId,expected,rawHash:hash,captureHash:digest('capture'),relationship:'archival-starting-edition-not-continuous-wording-or-freshness-authority'}},draft={binding:fork,readiness:{ready:true},expected,context:{records:[{role:'draft'}]}};
 let current=draft;const adapter=createStudyEditorialPlanContext({drafts:{read:async()=>current},originals:{readDraft:()=>assert.fail('An authored fork has no legacy original')},choices:{read:()=>assert.fail('No original-backed choices may be invented')}}),view=await adapter.context(binding);assert.equal(view.outputLineage.outputId,outputId);
 for(const patch of [{canonicalOutputId:randomUUID()},{sourceBindingId:randomUUID()},{outputId:'wrong'},{outputId:binding.bindingId,canonicalOutputId:binding.bindingId},{sourceBindingId:binding.bindingId,derivedFrom:{...fork.derivedFrom,bindingId:binding.bindingId}},{seedWorkingHash:digest('wrong seed')},{textOutputKind:'post'},{derivedFrom:null},{derivedFrom:{...fork.derivedFrom,relationship:'live-source-authority'}},{derivedFrom:{...fork.derivedFrom,rawHash:digest('wrong raw')}},{derivedFrom:{...fork.derivedFrom,captureHash:null}},{derivedFrom:{...fork.derivedFrom,expected:{...expected,bindingHash:'wrong'}}}]){current={...draft,binding:{...fork,...patch}};await assert.rejects(adapter.context(binding),/Authored|archival/i);}
 const arraySource=[sourceBindingId];current={...draft,binding:{...fork,sourceBindingId:arraySource,derivedFrom:{...fork.derivedFrom,bindingId:arraySource}}};await assert.rejects(adapter.context(binding),/Authored|archival/i);
 const arrayHash=[hash];current={...draft,binding:{...fork,seedWorkingHash:arrayHash,derivedFrom:{...fork.derivedFrom,rawHash:arrayHash,expected:{...expected,workflow:{...expected.workflow,draft:arrayHash}}}}};await assert.rejects(adapter.context(binding),/Authored|archival/i);
 current={...draft,binding:{...fork,parentStudyId:'hk',originalId:'collection:hk'}};await assert.rejects(adapter.context({...binding,parentStudyId:'hk'}),/Authored/i);
 current={...draft,context:{records:[{role:'brief',missing:true}]}};await assert.rejects(adapter.context(binding),/Authored|retained/i);
});
