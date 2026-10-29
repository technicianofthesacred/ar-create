import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=name=>fs.readFileSync(new URL('../public/document-study/'+name+'.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(t,{query='reviewCarousel=target',view='article'}={}){
 const dom=new JSDOM('<div id="app"></div><div id="hover-tools" hidden></div>',{url:'http://localhost/document-study/index.html'+(query?'?'+query:''),runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window;w.matchMedia=()=>({matches:false});w.AR_CREATE_REVIEW_MODE={actualWork:true};
 const project={id:'previous',name:'Previous project',view,viewedStage:5,blocks:[{id:'old',tag:'p',html:'Previous manuscript words'}],slides:view==='carousel'?[{text:'Previous carousel words',role:'cover'}]:[],history:[],rev:1,scroll:0};
 w.localStorage.setItem('ar-existing-work-review-v1:ar-create-packaged-document-study-v1',JSON.stringify({project:'previous',projects:[project],theme:'dark',variant:'visible'}));
 w.eval(code('review-mode')+'\n'+code('synthetic-study-data')+'\n'+code('study')+'\nwindow.state=state;window.current=current;');
 let resolveCatalog,resolveOwner;
 w.fetch=()=>new Promise(resolve=>{resolveCatalog=(fail=false)=>resolve({ok:!fail,json:async()=>fail?{error:'Catalog unavailable'}:({mode:'existing-work-read-only',stories:[],sources:[]})});});
 w.studyDraft={flush:async()=>({dirty:false})};
 w.workbenchPieces={carouselEdition:id=>id==='target'?{origin:w.location.origin,projectId:id}:null,openCarousel:()=>new Promise((resolve,reject)=>{resolveOwner=(fail=false)=>{if(fail){reject(Error('Exact saved carousel unavailable'));return;}const p=w.current();p.id='target';p.view='carousel';p.slides=[{text:'Requested carousel words',role:'cover'}];w.state.project='target';w.render();resolve(true);};})};
 return {w,start:()=>w.eval(code('existing-work')),catalog:fail=>resolveCatalog(fail),owner:fail=>resolveOwner(fail)};
}
for(const view of ['article','carousel'])test('cached '+view+' is concealed before study first render until exact owner resolves',async t=>{
 const s=setup(t,{view}),{w}=s,app=w.document.getElementById('app');
 assert.equal(w.getComputedStyle(app).visibility,'hidden');assert.equal(app.hasAttribute('inert'),true);
 assert.match(app.textContent,/Previous (manuscript|carousel) words/,'cached owner remains mounted without destructive state replacement');
 s.start();s.catalog();await tick();
 assert.equal(w.getComputedStyle(app).visibility,'hidden');
 s.owner();await tick();
 assert.notEqual(w.getComputedStyle(app).visibility,'hidden');assert.equal(app.hasAttribute('inert'),false);assert.match(app.textContent,/Requested carousel words/);
 assert.equal(w.document.querySelector('[data-review-startup]'),null);
});
test('unavailable exact route keeps prior work concealed and Retry preserves the complete URL',async t=>{
 const s=setup(t,{query:'reviewCarousel=missing'}),{w}=s,url=w.location.href;s.start();s.catalog();await tick();
 const status=w.document.querySelector('[data-review-startup]');assert.ok(status);assert.match(status.textContent,/could not|unavailable/i);
 assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');assert.equal(w.document.querySelector('[data-review-startup] a').href,url);assert.equal(w.location.href,url);
});
test('ordinary no-query startup retains its existing visible workspace',t=>{
 const {w}=setup(t,{query:''});assert.equal(w.document.querySelector('[data-review-startup]'),null);assert.notEqual(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
});

test('a failed owner stays concealed even if another catalog refresh succeeds',async t=>{
 const s=setup(t),{w}=s;s.start();s.catalog();await tick();s.owner(true);await tick();
 assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
 const refresh=w.existingWork.load();s.catalog();await refresh;
 assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
 assert.equal(w.document.querySelector('[data-review-startup] a').href,'http://localhost/document-study/index.html?reviewCarousel=target');
});
test('catalog failure and duplicate route values retain the exact failed URL',async t=>{
 for(const query of ['reviewCarousel=target','reviewCarousel=target&reviewCarousel=other']){
  const s=setup(t,{query}),{w}=s,url=w.location.href;s.start();s.catalog(query==='reviewCarousel=target');await tick();
  assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.querySelector('[data-review-startup] a').href,url);assert.equal(w.location.href,url);
 }
});
test('exact Magazine entry stays concealed through its owner load and rejects cancelled pickup',async t=>{
 for(const cancelled of [false,true]){
  const query=new URLSearchParams({reviewStory:'story',reviewStage:'5',reviewMagazineStory:'mag-story',reviewMagazinePiece:'piece',reviewMagazineParent:'previous'}).toString();
  const s=setup(t,{query}),{w}=s,hash='a'.repeat(64);let finish;
  w.AR_CREATE_REVIEW_MODE.magazineDraftCorrections=true;
  const target={kind:'magazine',edition:'working',artifactId:'draft',hash,nativeProjectId:'previous',storyId:'mag-story',pieceId:'piece',partKey:'one',editable:true};
  w.fetch=async()=>({ok:true,json:async()=>({mode:'existing-work-read-only',sources:[],stories:[{id:'story',name:'Requested story',nativeProjectId:'previous',artifacts:[{artifactId:'draft',hash,kind:'DEV',magazineWorkingTarget:target}]}]})});
  w.studyDraft.openMagazine=()=>new Promise(resolve=>{finish=()=>{if(cancelled){resolve(null);return;}const p=w.current();p.view='article';p.viewedStage=5;p.blocks=[{id:'new',tag:'p',html:'Requested Magazine words'}];w.render();resolve({owner:{kind:'magazine',storyId:'mag-story',pieceId:'piece',partKey:'one'},parentStudyId:'previous',expected:{workflow:{draft:hash}},dirty:false});};});
  s.start();await tick();assert.equal(w.arCreateReviewStartup.pending,true);finish();await tick();
  assert.equal(w.arCreateReviewStartup.pending,cancelled);
  if(cancelled)assert.ok(w.document.querySelector('[data-review-startup] a'));else assert.match(w.document.getElementById('app').textContent,/Requested Magazine words/);
 }
});
test('an intentional later section supersedes the pending initial URL',async t=>{
 const s=setup(t),{w}=s;s.start();await w.viewPhase(3);s.catalog();await tick();
 assert.equal(w.arCreateReviewStartup.pending,false);assert.equal(w.current().viewedStage,3);assert.equal(w.current().id,'previous');
 assert.equal(w.document.querySelector('[data-review-startup]'),null);
});
test('an exact original read failure cannot reveal the cached manuscript behind its reader',async t=>{
 const hash='a'.repeat(64),s=setup(t,{query:new URLSearchParams({reviewStory:'story',reviewArtifact:'draft',reviewHash:hash}).toString()}),{w}=s;
 w.fetch=async url=>({ok:url==='/api/review/catalog',json:async()=>url==='/api/review/catalog'?{mode:'existing-work-read-only',sources:[],stories:[{id:'story',name:'Requested story',nativeProjectId:'previous',artifacts:[{artifactId:'draft',hash,kind:'DEV'}]}]}:{error:'Requested original unavailable'}});
 s.start();await tick();await tick();
 assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');assert.ok(w.document.querySelector('[data-review-startup] a'));
});

test('failed exact route offers an explicit workspace entrance without changing the route or cached words',async t=>{
 const s=setup(t,{query:'reviewCarousel=missing#saved-position'}),{w}=s,url=w.location.href,cache=w.localStorage.getItem('ar-create-packaged-document-study-v1');
 s.start();s.catalog();await tick();
 const links=[...w.document.querySelectorAll('[data-review-startup] a')];
 assert.deepEqual(links.map(a=>a.textContent),['Retry','Open workspace']);
 assert.equal(links[0].href,url);assert.equal(links[1].href,'http://localhost/document-study/index.html');
 assert.equal(w.location.href,url);assert.equal(w.localStorage.getItem('ar-create-packaged-document-study-v1'),cache);
 assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');assert.equal(w.document.getElementById('app').hasAttribute('inert'),true);
});

test('exact entry stays concealed through a stalled current-owner flush and reports its refusal',async t=>{
 for(const dirty of [false,true]){
  const s=setup(t,{query:'reviewStory=story&reviewStage=5'}),{w}=s;let release,flushing=false;
  const held=new Promise(resolve=>{release=resolve;});w.studyDraft.flush=async()=>{flushing=true;return held;};
  w.AR_CREATE_REVIEW_MODE.studyDraftCorrections=true;w.studyDraft.openBinding=async input=>({bindingId:input.bindingId,parentStudyId:input.parentStudyId,expected:{workflow:{draft:'synthetic-hash'}},dirty:false});
  w.fetch=async()=>({ok:true,json:async()=>({mode:'existing-work-read-only',sources:[],stories:[{id:'story',name:'Synthetic story',nativeProjectId:'previous',artifacts:[],latestDraft:{hash:'synthetic-hash'}}],workspaceLinks:{pieces:[{workspaceId:'synthetic-workspace',targets:[{workspaceId:'synthetic-workspace',documentId:'synthetic-document',rootBindingId:'synthetic-binding',parentStudyId:'previous',partKey:'article',originalHash:'synthetic-hash'}]}]},workspacePieces:[{id:'synthetic-workspace',documentId:'synthetic-document'}]})});
  const before=JSON.stringify(w.current().blocks),url=w.location.href;s.start();await tick();await tick();
  assert.equal(flushing,true);assert.ok(w.existingWork.catalog(),'catalogue completion does not imply route completion');assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.querySelector('[data-review-startup]').textContent,'Checking your current writing…');assert.equal(w.document.querySelector('[data-review-startup]').dataset.reviewOpeningStep,'flush-current');assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');assert.equal(JSON.stringify(w.current().blocks),before);
  release({dirty});await w.existingWork.load();await tick();
  if(dirty){assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.querySelector('[data-review-startup]').getAttribute('role'),'alert');assert.equal(w.document.querySelector('[data-review-startup] a').href,url);assert.equal(JSON.stringify(w.current().blocks),before);}
  else{assert.equal(w.arCreateReviewStartup.pending,false);assert.equal(w.current().id,'previous');assert.equal(w.current().viewedStage,5);}
 }
});

test('concealed startup restores saved output words mode without waiting for visibility, while navigation awaits host flush',async t=>{
 const s=setup(t,{query:'reviewStory=story&reviewStage=5',view:'record'}),{w}=s,p=w.current(),root='synthetic-primary',outputId='synthetic-carousel';
 p.id='hk';p.viewedStage=9;w.state.project='hk';w.structuredClone=structuredClone;
 const output={id:outputId,kind:'carousel',title:'Synthetic saved carousel',slides:[],outputRevision:1},scope={rootBindingId:root,parentStudyId:'hk'};
 const view={scope,documentId:root,photoScope:{projectId:'synthetic-physical',documentId:'synthetic-document'},outputs:[output],outputBindings:[{outputId,wordOwner:{kind:'carousel-words',projectId:'synthetic-physical',documentId:'synthetic-document',outputId}}],output,expectedOutput:{revision:1,hash:'synthetic-receipt'},writingProof:{kind:'carousel-words',outputId}};
 const catalog={mode:'existing-work-read-only',sources:[],stories:[{id:'story',name:'Synthetic story',nativeProjectId:'hk',artifacts:[]}]};
 w.localStorage.setItem('ar-study-output-connection-v1',JSON.stringify({groups:{},selection:{hk:{rootBindingId:root,outputId,mode:'words'}}}));
 w.fetch=async url=>{const path=new URL(url,w.location.href).pathname;return {ok:true,json:async()=>path==='/api/review/catalog'?catalog:path==='/api/study-draft/catalog'?{drafts:[{bindingId:root,parentStudyId:'hk',bindingStatus:'ready'}]}:view};};
 let release,hostFlushes=0,modeClicks=0;const held=new Promise(resolve=>{release=resolve;});
 w.ArStudyOutputHost={mountStudyOutputHost:async element=>{element.innerHTML='<button>Writing content</button>';element.querySelector('button').onclick=()=>{modeClicks++;};return {model:{selectedOutputId:outputId,outputs:[output],expectedOutput:view.expectedOutput,writingProof:view.writingProof},flush:async()=>{hostFlushes++;await held;},destroy(){}};}};
 w.eval(code('output-connection'));await tick();await tick();
 assert.equal(modeClicks,1,'mode restoration clicks the exact enabled control even behind the startup veil');assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
 s.start();await tick();await tick();assert.ok(hostFlushes>0);assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.querySelector('[data-review-startup]').dataset.reviewOpeningStep,'resolve-route');
 release();await w.existingWork.load();await tick();assert.equal(w.arCreateReviewStartup.pending,false);assert.equal(p.viewedStage,5);assert.equal(p.id,'hk');
});


test('startup phase labels reject unknown steps and cannot replace a failed or completed gate',t=>{
 const {w}=setup(t),startup=w.arCreateReviewStartup,status=w.document.querySelector('[data-review-startup]');
 startup.phase('catalog');assert.equal(status.textContent,'Finding your saved work…');assert.equal(status.dataset.reviewOpeningStep,'catalog');
 for(const step of ['unknown-step','constructor','__proto__']){startup.phase(step);assert.equal(status.textContent,'Finding your saved work…');assert.equal(status.dataset.reviewOpeningStep,'catalog');}
 startup.phase('flush-current');assert.equal(status.textContent,'Checking your current writing…');assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
 startup.fail('Synthetic exact owner refused');const failure=status.innerHTML;startup.phase('open-binding');assert.equal(status.innerHTML,failure);assert.equal(status.getAttribute('role'),'alert');assert.equal(startup.pending,true);
 startup.complete();assert.equal(startup.pending,false);assert.equal(w.document.querySelector('[data-review-startup]'),null);startup.phase('catalog');assert.equal(w.document.querySelector('[data-review-startup]'),null);assert.equal(status.innerHTML,failure);assert.equal(w.document.documentElement.hasAttribute('data-review-startup-pending'),false);
});

test('review readiness settles only at exact restoration completion, and exposes actual failure without hanging',async t=>{const {w}=setup(t),startup=w.arCreateReviewStartup;let settled=false;const waiting=startup.whenReady().then(value=>{settled=true;return value;});await tick();assert.equal(settled,false);startup.phase('open-binding');await tick();assert.equal(settled,false);startup.complete();assert.deepEqual(JSON.parse(JSON.stringify(await waiting)),{ready:true});assert.deepEqual(JSON.parse(JSON.stringify(await startup.whenReady())),{ready:true});});
test('failed review readiness resolves its refusal while preserving the visible retry gate',async t=>{const {w}=setup(t),startup=w.arCreateReviewStartup;const waiting=startup.whenReady();startup.fail('Exact owner refused');assert.deepEqual(JSON.parse(JSON.stringify(await waiting)),{ready:false,error:'Exact owner refused'});assert.equal(startup.pending,true);assert.equal(w.document.querySelector('[data-review-startup]').getAttribute('role'),'alert');startup.complete();assert.deepEqual(JSON.parse(JSON.stringify(await startup.whenReady())),{ready:true});});
test('an invalid or unregistered exact Carousel output route stays concealed with its original Retry address',async t=>{for(const query of ['reviewOutput=44444444-4444-4444-8444-444444444444','reviewWorkspace=missing&reviewBinding=missing&reviewStage=9&reviewOutput=bad','reviewWorkspace=missing&reviewBinding=missing&reviewStage=9&reviewOutput=44444444-4444-4444-8444-444444444444']){const s=setup(t,{query}),{w}=s,url=w.location.href;s.start();s.catalog();await tick();assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.location.href,url);assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');assert.equal(w.document.querySelector('[data-review-startup] a').href,url);}});

test('exact kept Source opens behind the startup guard without waiting for the global catalogue',async t=>{
 const uuid='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64),s=setup(t,{query:'reviewSource='+uuid}),{w}=s;
 let catalogRequests=0,selected=0;const meta={id:'invented-long-source',sourceId:uuid,sourceHash:hash,version:7};
 w.fetch=async url=>{if(url==='/api/source-sessions')return {ok:true,json:async()=>({revision:7,sessions:[meta]})};if(url==='/api/review/catalog'){catalogRequests++;return new Promise(()=>{});}throw Error('Unexpected read');};
 w.studyImportedSource={selectSource:async pins=>{selected++;assert.equal(pins.sourceId,uuid);assert.equal(pins.expectedSourceHash,hash);assert.equal(pins.expectedVersion,7);w.document.getElementById('app').textContent='Exact kept source · 1100 remarks';return {...meta,sessionId:meta.id};}};
 s.start();await tick();await tick();
 assert.equal(selected,1);assert.equal(catalogRequests,1);assert.equal(w.arCreateReviewStartup.pending,false);assert.equal(w.document.getElementById('app').getAttribute('aria-hidden'),null);assert.match(w.document.body.innerText||w.document.body.textContent,/Exact kept source/);assert.equal(w.current().viewedStage,2);
});

for(const outcome of ['earlier-hash','ambiguous','late-catalog-failure','late-excluded-project'])test('exact Source startup preserves its authority on '+outcome,async t=>{
 const uuid='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64),s=setup(t,{query:'reviewSource='+uuid}),{w}=s,meta={id:'source-one',sourceId:uuid,sourceHash:hash,version:7};let finishCatalog,selects=0;
 w.fetch=async url=>url==='/api/source-sessions'?{ok:true,json:async()=>({sessions:outcome==='ambiguous'?[meta,{...meta,id:'source-two'}]:[meta]})}:new Promise(resolve=>{finishCatalog=()=>resolve({ok:outcome!=='late-catalog-failure',json:async()=>outcome==='late-catalog-failure'?{error:'Catalogue unavailable'}:{mode:'existing-work-read-only',stories:[],sources:[],excludedProjectIds:['previous']}});});
 w.studyImportedSource={selectSource:async()=>{selects++;if(outcome==='earlier-hash')throw Error('This transcript changed.');w.document.getElementById('app').textContent='Exact original Source remains';return {...meta,sessionId:meta.id};}};
 s.start();await tick();await tick();
 if(outcome==='earlier-hash'||outcome==='ambiguous'){assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.querySelector('[data-review-startup]').getAttribute('role'),'alert');assert.equal(selects,outcome==='ambiguous'?0:1);return;}
 assert.equal(w.arCreateReviewStartup.pending,false);finishCatalog();await tick();await tick();assert.equal(w.arCreateReviewStartup.pending,false);assert.equal(w.current().id,'previous');assert.equal(selects,1);assert.match(w.document.getElementById('app').textContent,/Exact original Source remains/);assert.equal(w.document.getElementById('app').getAttribute('aria-hidden'),null);
});

test('a late native Source identity cannot select into a different project',async t=>{
 const uuid='11111111-1111-4111-8111-111111111111',s=setup(t,{query:'reviewSource='+uuid}),{w}=s;let finish,selected=0;
 w.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({sessions:[{id:'one',sourceId:uuid,sourceHash:'a'.repeat(64),version:1}]})});});w.studyImportedSource={selectSource:async()=>{selected++;}};
 s.start();w.state.projects.push({...w.current(),id:'changed'});w.state.project='changed';finish();await tick();await tick();assert.equal(selected,0);assert.equal(w.current().id,'changed');assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.querySelector('[data-review-startup]').getAttribute('role'),'alert');
});

test('a protected Source refusal reports its exact safe stage without exposing private error text',async t=>{
 const uuid='11111111-1111-4111-8111-111111111111',s=setup(t,{query:'reviewSource='+uuid}),{w}=s;
 w.eval(code('display-format'));w.fetch=async()=>({ok:true,json:async()=>({sessions:[{id:'one',sourceId:uuid,sourceHash:'a'.repeat(64),version:1}]})});w.studyDraft.flush=async()=>{throw new TypeError('Owner unavailable at '+['','Users','invented-protected','private-file.md'].join('/'));};s.start();await tick();await tick();const status=w.document.querySelector('[data-review-startup]');assert.equal(status.dataset.reviewFailureStage,'flush-current');assert.equal(status.dataset.reviewFailureType,'TypeError');assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.document.getElementById('app').getAttribute('aria-hidden'),'true');assert.doesNotMatch(status.outerHTML,/private-file|\/Users\/private/);
});

for(const cause of ['source-context-replaced','source-project-changed','source-navigation-superseded','source-url-changed'])test('Source held-read refusal distinguishes '+cause+' without weakening its selection guard',async t=>{
 const uuid='11111111-1111-4111-8111-111111111111',s=setup(t,{query:'reviewSource='+uuid}),{w}=s;let finish,selected=0,flushed=0;
 const original=w.current(),originalWords=JSON.stringify(original.blocks);
 w.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({sessions:[{id:'one',sourceId:uuid,sourceHash:'a'.repeat(64),version:2}]})});});w.studyImportedSource={selectSource:async()=>{selected++;}};w.studyDraft.flush=async()=>{flushed++;return {dirty:false};};s.start();
 if(cause==='source-context-replaced')w.state.projects[w.state.projects.indexOf(original)]={...original};
 else if(cause==='source-project-changed'){w.state.projects.push({...original,id:'changed'});w.state.project='changed';}
 else if(cause==='source-navigation-superseded')await w.viewPhase(3);
 else w.history.replaceState(null,'','?reviewSource='+uuid+'#changed-position');
 const cacheAtResponse=w.localStorage.getItem('ar-create-packaged-document-study-v1');finish();await tick();await tick();const status=w.document.querySelector('[data-review-startup]');assert.equal(status.dataset.reviewFailureStage,'read-transcript');assert.equal(status.dataset.reviewFailureReason,cause);assert.equal(selected,0);assert.equal(flushed,0);assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(JSON.stringify(original.blocks),originalWords);assert.equal(w.localStorage.getItem('ar-create-packaged-document-study-v1'),cacheAtResponse);
});
test('Source list finite deadline identifies timeout while preserving the hidden owner and exact retry URL',async t=>{
 const uuid='11111111-1111-4111-8111-111111111111',s=setup(t,{query:'reviewSource='+uuid}),{w}=s;let deadline,selected=0,aborted=false;const url=w.location.href,original=w.current(),words=JSON.stringify(original.blocks),set=w.setTimeout;
 w.setTimeout=(fn,ms,...args)=>ms===8000?(deadline=fn,88):set(fn,ms,...args);w.clearTimeout=()=>{};
 w.fetch=async(url,options)=>{options.signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});};w.studyImportedSource={selectSource:async()=>{selected++;}};s.start();assert.equal(typeof deadline,'function');deadline();await tick();await tick();
 const status=w.document.querySelector('[data-review-startup]');assert.equal(status.dataset.reviewFailureReason,'source-read-timeout');assert.equal(status.dataset.reviewFailureStage,'read-transcript');assert.equal(aborted,true);assert.equal(selected,0);assert.equal(w.current(),original);assert.equal(JSON.stringify(original.blocks),words);assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(status.querySelector('a').href,url);
});
test('Source failure reason admits only finite safe codes and never arbitrary path or error text',async t=>{
 const s=setup(t,{query:'reviewSource=11111111-1111-4111-8111-111111111111'}),{w}=s;w.eval(code('display-format'));const inventedPath=['','Users','invented','private.md'].join('/');w.fetch=async()=>{throw Object.assign(Error('private content at '+inventedPath),{openingReason:inventedPath});};s.start();await tick();await tick();const status=w.document.querySelector('[data-review-startup]');assert.equal(status.dataset.reviewFailureReason,undefined);assert.doesNotMatch(status.outerHTML,/private content|private.md/);assert.equal(status.outerHTML.includes(inventedPath),false);
});

test('catalogue refusal and invalid response retain safe startup cause without exposing private error bodies',async t=>{
 for(const mode of ['http','invalid','transport']){
  const s=setup(t),{w}=s;w.eval(code('display-format'));
  w.fetch=async()=>{if(mode==='transport')throw new TypeError('private content at /Users/invented/private-network-detail');return {ok:mode!=='http',status:mode==='http'?503:200,json:async()=>mode==='http'?{error:'private content at /Users/invented/private-reader-detail'}:{mode:'wrong'}};};
  s.start();await tick();await tick();const e=w.document.querySelector('[data-review-startup]');
  assert.equal(e.dataset.reviewFailureStage,'catalog');assert.equal(e.dataset.reviewFailureReason,mode==='http'?'catalog-http-refused':mode==='invalid'?'catalog-response-invalid':'catalog-read-failed');assert.doesNotMatch(e.outerHTML,/private-network-detail|private-reader-detail/);assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
 }
});
test('catalogue timeout records bounded elapsed proof while a late response cannot reveal cached work',async t=>{
 const s=setup(t),{w}=s;let expire;const real=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>ms===10000?(expire=fn,123456):real(fn,ms,...args);s.start();await tick();expire();await tick();await tick();const e=w.document.querySelector('[data-review-startup]');assert.equal(e.dataset.reviewFailureReason,'catalog-read-timeout');assert.ok(Number.isInteger(Number(e.dataset.reviewFailureElapsedMs)));s.catalog();await tick();assert.equal(w.arCreateReviewStartup.pending,true);assert.equal(w.getComputedStyle(w.document.getElementById('app')).visibility,'hidden');
});
test('a post-catalog Magazine dirty-writing refusal is diagnosed at flush rather than blamed on discovery',async t=>{
 const query=new URLSearchParams({reviewStory:'story',reviewStage:'5',reviewMagazineStory:'mag-story',reviewMagazinePiece:'piece',reviewMagazineParent:'previous'}).toString(),s=setup(t,{query}),{w}=s,hash='a'.repeat(64);w.AR_CREATE_REVIEW_MODE.magazineDraftCorrections=true;
 const target={kind:'magazine',edition:'working',artifactId:'draft',hash,nativeProjectId:'previous',storyId:'mag-story',pieceId:'piece',partKey:'one',editable:true};w.fetch=async()=>({ok:true,json:async()=>({mode:'existing-work-read-only',sources:[],stories:[{id:'story',name:'Requested story',nativeProjectId:'previous',artifacts:[{artifactId:'draft',hash,kind:'DEV',magazineWorkingTarget:target}]}]})});
 w.studyDraft.flush=async()=>({dirty:true});w.studyDraft.openMagazine=()=>{throw Error('Must not open over dirty work');};s.start();await tick();await tick();const e=w.document.querySelector('[data-review-startup]');assert.equal(e.dataset.reviewFailureStage,'flush-current');assert.equal(e.dataset.reviewFailureReason,'startup-writing-dirty');assert.equal(w.current().id,'previous');assert.equal(w.arCreateReviewStartup.pending,true);
});
