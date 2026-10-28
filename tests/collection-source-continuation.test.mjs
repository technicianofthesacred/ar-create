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
 const reopened=await f.boot({stored});await until(()=>reopened.w.document.querySelector('[data-continuation-source="'+f.source.id+'"]')?.checked);reopened.w.document.querySelector('[data-continuation-openings]').click();await until(()=>!reopened.w.document.body.textContent.includes('Preparing context'));assert.equal(reopened.reviews.length,1);
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

import {createStudyEditorialPlanContext} from '../runtime/services/study-editorial-plan-context.mjs';
import {digest} from '../runtime/services/files.mjs';
test('authored-root original-plan adapter is explicit, hashed and refuses contradictory identity or support',async()=>{
 const binding={bindingId:randomUUID(),parentStudyId:'invented-new-parent'},base={binding:{id:binding.bindingId,parentStudyId:binding.parentStudyId,kind:'collection-root',origin:'authored-collection',originalId:'collection:'+binding.parentStudyId,partKey:'collection',authority:'owned-working-copy',status:'ready'},readiness:{ready:true},expected:{workflow:{draft:digest('Invented draft')}},context:{records:[{role:'draft'}]}};
 let current=base;const adapter=createStudyEditorialPlanContext({drafts:{read:async()=>current},originals:{readDraft:()=>assert.fail('Authored root cannot impersonate an original')},choices:{read:()=>assert.fail('Original-backed choices do not apply to a new authored parent')}}),view=await adapter.context(binding),{hash,...payload}=view;
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 assert.equal(hash,digest(stable(payload)));assert.equal(view.originalPlan.status,'not-applicable');assert.deepEqual(view.records,[]);assert.deepEqual(view.selections,[]);assert.deepEqual(view.expected,base.expected);
 for(const change of [{binding:{kind:'output-fork'}},{binding:{origin:'foreign'}},{binding:{originalId:'foreign'}},{binding:{partKey:'article'}},{binding:{parentStudyId:'foreign'}},{binding:{parentStudyId:'hk',originalId:'collection:hk'}},{context:{records:[{role:'research',raw:'Must not silently drop retained support'}]}},{context:{records:[{role:'brief',missing:true}]}}]){current={...base,...change,binding:{...base.binding,...change.binding}};await assert.rejects(adapter.context(change.binding?.parentStudyId==='hk'?{...binding,parentStudyId:'hk'}:binding),/Authored root|Exact ready/);}
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
