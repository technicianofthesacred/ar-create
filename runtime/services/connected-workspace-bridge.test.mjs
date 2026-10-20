import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
const sourceURL = new URL('../../public/document-study/connected-workspace.mjs', import.meta.url);
const deferred = () => {let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject};};
const hash = 'a'.repeat(64);
function setup(t, {ready, selectPhotos} = {}) {
  const dom = new JSDOM('<main id="app"><div id="work-context"></div><article id="manuscript"></article></main>', {url:'http://127.0.0.1:8857', runScripts:'outside-only'});
  t.after(() => dom.window.close());
  const w=dom.window, calls={updates:[], mounts:[], releases:[], researchOpen:0, researchClose:0, requests:[], inquiryNavigate:null};
  let project={id:'invented-project-a',view:'article',viewedStage:5}, dialog=null;
  const binding={id:randomUUID(),parentStudyId:project.id}, token=randomUUID();
  w.structuredClone=structuredClone; w.crypto.randomUUID=randomUUID;
  w.current=()=>project;
  w.createInquiryInterfaceClient=()=>({});
  w.mountInquiryWorkspace=({onNavigate})=>{calls.inquiryNavigate=onNavigate;return {ready:Promise.resolve()};};
  w.mountWorkContinuity=({context,container})=>{
    container.dataset.scope=context().scope.parentStudyId;
    return {ready:ready?.promise??Promise.resolve(),update(next){const value=next();calls.updates.push(structuredClone(value.scope));container.dataset.scope=value.scope.parentStudyId;return Promise.resolve();}};
  };
  w.studyDraft={currentBinding:()=>binding,currentProof:()=>({draftHash:hash,dirty:true}),holdForContext:()=>({bufferToken:token,draftHash:hash,saveState:'dirty',dirty:true}),releaseContext:input=>{calls.releases.push(input);return {sameEditorNode:true,selectionRestored:false};}};
  w.studyHumanDirection={openContext:({container})=>{calls.researchOpen++;container.textContent='Actual Research mount mock';},closeContext:()=>calls.researchClose++};
  w.studyPhotoStage={getDraftCache:()=>({})};w.studyMediaUsage={read:async()=>({}),open:async()=>({})};
  w.mountPhotosStage=(container,context)=>{calls.mounts.push({container,context});return {ready:Promise.resolve(),destroy(){}};};
  w.projectLibrary={openContext:options=>{dialog=options;const root=w.document.createElement('section');root.id='project-library';root.innerHTML='<h2 id="pl-title"></h2><span data-pl-status></span><button data-pl-close></button>';root.append(options.content);w.document.body.append(root);},close:async()=>{const old=dialog;if(!old)return;if(old.beforeClose&&await old.beforeClose()!==true)return;w.document.getElementById('project-library')?.remove();dialog=null;await old.onClosed?.();}};
  w.fetch=async(url,options)=>{
    const target=String(url);
    calls.requests.push({url:target,method:options?.method??'GET',body:options?.body});
    let value;
    if(target==='/api/study/photos/select') value=await selectPhotos?.promise??{projectId:randomUUID(),documentId:randomUUID()};
    else if(target.startsWith('/api/study-draft/read?'))value={binding,expected:{workflow:{draft:hash}}};
    else if(target==='/api/work-continuity/read'){const input=JSON.parse(options.body);value={work:{scope:input.scope,version:{editionHash:hash,wordsHash:hash}}};}
    else throw Error('Unexpected synthetic request: '+target);
    return {ok:true,json:async()=>value};
  };
  const actual=fs.readFileSync(sourceURL,'utf8').replace(/^import[^\n]*\n/gm,'');
  vm.runInContext(actual+'\nwindow.__bridge={showContext,fillContext,getDialog:()=>contextDialog};',dom.getInternalVMContext(),{filename:sourceURL.pathname});
  return {dom,w,calls,token,binding,bridge:w.connectedWorkspace,hooks:w.__bridge,setProject:value=>{project={...project,...value};}};
}
test('pending initial panel read does not postpone a new actual Project scope update',async t=>{
  const ready=deferred(),f=setup(t,{ready});
  const first=f.bridge.ensurePanel();
  assert.equal(f.bridge.getContext().scope.parentStudyId,'invented-project-a');
  f.setProject({id:'invented-project-b'});
  const next=f.bridge.ensurePanel();
  assert.equal(f.calls.updates.length,1,'new scope must update while old initial read is still pending');
  assert.equal(f.calls.updates[0].parentStudyId,'invented-project-b');
  assert.equal(f.bridge.getContext().scope.parentStudyId,'invented-project-b');
  await next;
  ready.resolve();await first;
  assert.equal(f.bridge.getContext().scope.parentStudyId,'invented-project-b');
  assert.equal(f.w.document.querySelector('#connected-work-receipts > div').dataset.scope,'invented-project-b');
});
test('late Media selection cannot mount into closed content or steal current Research cleanup',async t=>{
  const selectPhotos=deferred(),f=setup(t,{selectPhotos});
  const media=f.hooks.showContext('media',null);
  const oldContent=f.w.document.querySelector('#project-library > div');
  assert.ok(oldContent?.isConnected);
  await f.w.projectLibrary.close();
  await f.hooks.showContext('research',null);
  assert.equal(f.calls.researchOpen,1);
  selectPhotos.resolve({projectId:randomUUID(),documentId:randomUUID()});await media;
  assert.equal(oldContent.isConnected,false);
  assert.equal(f.calls.mounts.length,0,'late Media response must not mount a detached photo stage');
  assert.equal(f.calls.researchClose,0);
  assert.equal(f.hooks.getDialog().section,'research');
  await f.w.projectLibrary.close();
  assert.equal(f.calls.researchClose,1,'Research retains ownership of its cleanup');
});
function captureInput(){return {selectedScope:{kind:'project',parentStudyId:'invented-project-a'},ownEdition:hash,currentWork:{version:{editionHash:hash,wordsHash:hash}}};}
test('cancelled inactive capture releases the exact trusted native token once',async t=>{
  const f=setup(t),captured=await f.bridge.host.capture(captureInput());
  assert.equal(captured.bufferToken,f.token);assert.equal(f.bridge.getHeld().length,1);
  const result=await f.bridge.host.cancelCapture({captured});
  assert.equal(result.cancelled,true);assert.equal(f.calls.releases.length,1);
  assert.equal(f.calls.releases[0].bufferToken,f.token);assert.equal(f.calls.releases[0].cancelOnly,true);
  assert.equal(f.bridge.getHeld().length,0);
  await f.bridge.host.cancelCapture({captured});assert.equal(f.calls.releases.length,1);
});
test('active context capture cannot be cancelled; close returns its own retained token',async t=>{
  const f=setup(t),captured=await f.bridge.host.capture(captureInput());
  await f.hooks.showContext('research',captured);
  const result=await f.bridge.host.cancelCapture({captured});
  assert.equal(result.cancelled,false);assert.equal(f.calls.releases.length,0);assert.equal(f.bridge.getHeld().length,1);
  await f.w.projectLibrary.close();
  assert.equal(f.calls.releases.length,1);assert.equal(f.calls.releases[0].bufferToken,f.token);assert.notEqual(f.calls.releases[0].cancelOnly,true);
  assert.equal(f.bridge.getHeld().length,0);
});

test('actual inquiry Piece navigation opens Carousel words and native Article through their maintained owners',async t=>{
  const f=setup(t),actions=[],reads=[],writes=[];
  f.w.studyDraft.currentBinding=()=>null;
  f.w.studyDraft.currentProof=()=>null;
  f.w.studyOutputConnection={
    canvasProof:()=>null,
    read:async input=>reads.push(input),
    onAction:async input=>{actions.push(input);if(input.kind!=='words'&&input.kind!=='native')throw Error('Wrong Piece owner action');},
    save:()=>writes.push('save'),saveWords:()=>writes.push('saveWords'),write:()=>writes.push('write')
  };
  const carousel=randomUUID(),article=randomUUID();
  for(const [outputId,wordOwner,expectedKind] of [[carousel,{kind:'carousel-words'},'words'],[article,{kind:'native'},'native']]){
    await f.bridge.openContext('inquiries');
    assert.equal(typeof f.calls.inquiryNavigate,'function');
    await f.calls.inquiryNavigate({kind:'piece',parentStudyId:'invented-project-a',outputId,wordOwner});
    assert.equal(f.hooks.getDialog(),null,'the inquiry modal closes before opening the actual Piece');
    assert.equal(actions.at(-1).projectId,'invented-project-a');
    assert.equal(actions.at(-1).outputId,outputId);
    assert.equal(actions.at(-1).kind,expectedKind);
  }
  assert.equal(reads.length,2);assert.equal(actions.length,2);
  assert.equal(writes.length,0,'opening an existing Piece must not write its words');
  assert.equal(f.calls.requests.length,0,'navigation must not send an output write or require a learning receipt');
});
test('standalone inquiry opens with an unowned browser manuscript and no Project receipt prerequisite',async t=>{
  const f=setup(t);
  assert.ok(f.w.document.getElementById('manuscript'));
  f.w.studyDraft.currentBinding=()=>null;
  f.w.studyDraft.currentProof=()=>null;
  f.w.fetch=async()=>{throw Error('Standalone learning must not request Project work receipts');};
  await f.bridge.openContext('inquiries');
  assert.equal(f.hooks.getDialog().section,'inquiries');
  assert.equal(f.hooks.getDialog().captured,null);
  assert.equal(f.bridge.getContext(),null,'opening standalone learning does not prepare a Project receipt context');
  assert.equal(typeof f.calls.inquiryNavigate,'function');
  assert.equal(f.calls.requests.length,0);assert.equal(f.calls.releases.length,0);
});
