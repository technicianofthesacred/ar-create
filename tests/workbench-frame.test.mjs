import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const file=new URL('../public/document-study/workbench-frame.js',import.meta.url);
function boot(){const dom=new JSDOM('<header id="c3-tabstrip"><details class="ht-switch"><summary>Projects</summary></details><button data-ht-theme>Theme</button></header><div id="app"><div class="shell"><nav class="workflowNavigation"><div class="tr-head"><button data-tr-home>Home</button></div><div class="wn-family" data-family="make"><div class="wn-family-steps"></div></div></nav><main id="workspace"><header id="c3-surface-bar"><div class="sb-right"><details class="sb-morew"><summary class="sb-btn">More</summary><div class="sb-menu"></div></details><span class="cb-size"><button data-cb-size="-1">A−</button><output>100%</output><button data-cb-size="1">A+</button></span></div></header><div class="desk"><article class="document"><h1>Test title</h1><div id="manuscript" contenteditable="true"><p data-block="keep">Exact human text</p></div></article><aside id="margin"><button id="note">Real note</button></aside><section id="c3-insp-decisions"><textarea>Unsaved direction</textarea></section></div></main></div></div>',{url:'http://localhost',runScripts:'dangerously'});const w=dom.window;let stage=5;w.current=()=>({id:'p',name:'Project',view:stage===5?'article':'record',viewedStage:stage,blocks:[{text:'Exact human text'}]});w.state={projects:[w.current()]};w.matchMedia=()=>({matches:false});w.c3Shell={register(_n,fn){this.fn=fn;fn();}};w.viewPhase=async n=>{stage=n;};w.projectLibrary={open:async()=>{},close:async()=>{}};w.eval(fs.readFileSync(file,'utf8'));return{w,d:w.document,close:()=>w.close()};}
test('full Workbench frame keeps the exact editable manuscript and real margin nodes',()=>{const {w,d,close}=boot();const editor=d.querySelector('#manuscript'),note=d.querySelector('#note');w.c3WorkbenchFrame.decorate();assert.strictEqual(d.querySelector('#manuscript'),editor);assert.strictEqual(d.querySelector('#note'),note);assert.equal(editor.textContent,'Exact human text');assert.ok(d.querySelector('.document.doc'));assert.ok(d.querySelector('#wbf-tools'));assert.ok(d.querySelector('[data-wbf-tool="check"]'));assert.equal(d.querySelector('.wbf-doc-by').textContent,'Project');close();});
test('the global size control forwards to the actual size owner exactly once',()=>{const{d,close}=boot();let hits=0;d.querySelector('#c3-surface-bar [data-cb-size="1"]').onclick=()=>hits++;d.querySelector('[data-wbf-size="1"]').click();assert.equal(hits,1);close();});
test('Sources drawer moves the original source disclosure, retaining unsaved input and handlers',async()=>{const{w,d,close}=boot();const source=d.createElement('details');source.className='draft-surface-source';source.innerHTML='<summary>Source & brief</summary><input value="retained">';d.querySelector('.document').append(source);await w.c3WorkbenchFrame.openTool('sources');assert.strictEqual(d.querySelector('#wbf-drawer .draft-surface-source'),source);assert.equal(source.querySelector('input').value,'retained');w.c3WorkbenchFrame.closeTool();assert.strictEqual(d.querySelector('.document .draft-surface-source'),source);close();});
test('an open drawer follows a replaced source owner and never retains another story’s controls',async()=>{const{w,d,close}=boot();const source=d.createElement('details');source.className='draft-surface-source';source.textContent='First source';d.querySelector('.document').append(source);await w.c3WorkbenchFrame.openTool('sources');const next=d.createElement('details');next.className='draft-surface-source';next.textContent='Second source';d.querySelector('.document').append(next);w.current=()=>({id:'second',name:'Second',view:'article',viewedStage:5,blocks:[]});w.c3WorkbenchFrame.decorate();assert.strictEqual(d.querySelector('#wbf-drawer .draft-surface-source'),next);assert.doesNotMatch(d.querySelector('#wbf-drawer').textContent,/First source/);close();});
test('global Workbench controls return after the maintained header repaints on resize or theme change',()=>{const{w,d,close}=boot();d.querySelector('#c3-tabstrip').innerHTML='<details class="ht-switch"><summary>Project</summary></details>';w.dispatchEvent(new w.CustomEvent('c3-header-painted'));assert.ok(d.querySelector('[data-wbf-size="1"]'));assert.ok(d.querySelector('[data-wbf-tool="understanding"]'));close();});
test('Pieces is separate from the twelve maintained checkpoint buttons',()=>{const{d,close}=boot();assert.equal(d.querySelector('[data-wbf-pieces]').classList.contains('workflowStep'),false);close();});
test('prototype writing actions use the original save and view owners without replacing editable words',async()=>{const{w,d,close}=boot();let saves=0,modes=[];w.studyDraft={flush:async()=>{saves++;return {dirty:false};}};w.workspaceNavigation={changeMode:async mode=>modes.push(mode)};w.c3WorkbenchFrame.decorate();const editor=d.querySelector('#manuscript');d.querySelector('[data-wbf-save]').click();await Promise.resolve();d.querySelector('[data-wbf-mode="preview"]').click();await Promise.resolve();assert.equal(saves,1);assert.deepEqual(modes,['preview']);assert.strictEqual(d.querySelector('#manuscript'),editor);assert.equal(editor.textContent,'Exact human text');close();});

test('the edge handle opens the same Understanding owner and reports the current project',async()=>{const{w,d,close}=boot();const thought=d.createElement('section');thought.id='downstream-human-direction';thought.textContent='My exact direction';d.querySelector('#c3-insp-decisions').append(thought);d.querySelector('#wbf-pull').click();await Promise.resolve();assert.equal(d.querySelector('#wbf-drawer h2').textContent,'Understanding · Project');assert.strictEqual(d.querySelector('#wbf-drawer #downstream-human-direction'),thought);close();});

test('Check is the shared dismissible drawer around the existing findings owner',async()=>{const{w,d,close}=boot();const findings=d.createElement('aside');findings.className='wn-check-findings';findings.innerHTML='<button>Jump to exact passage</button>';d.querySelector('#workspace').append(findings);let hits=0;findings.querySelector('button').onclick=()=>hits++;await w.c3WorkbenchFrame.openTool('check');assert.strictEqual(d.querySelector('#wbf-drawer .wn-check-findings'),findings);findings.querySelector('button').click();assert.equal(hits,1);w.c3WorkbenchFrame.closeTool();assert.strictEqual(d.querySelector('#workspace .wn-check-findings'),findings);assert.equal(d.querySelector('#wbf-drawer'),null);close();});
function resumeBoot({initialStage=12,lastStage=6,location=true,hash='kept-hash',nativeOnly=false}={}){
 const dom=new JSDOM('<header id="c3-tabstrip"><details class="ht-switch"><summary>Project</summary></details></header><div id="app"></div><dialog id="project-library" open><section class="ht-home-main"><div class="pl-results-head"></div><div data-pl-results></div></section><div class="ht-homebar"><label class="pl-search"><input data-pl-search></label></div><p data-pl-status></p></dialog>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document,observers=[],NativeObserver=w.MutationObserver;
 w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
 const p={id:'p',name:'Exact saved project',view:'record',viewedStage:initialStage,blocks:[{id:'b1',text:'First paragraph'},{id:'b2',text:'Second kept words'}]},calls=[];let fail=false;
 w.current=()=>p;w.state={projects:[p]};w.save=()=>{};w.matchMedia=()=>({matches:false});w.c3Shell={register(_n,fn){fn();},actorName:()=> 'You'};
 const proof={bindingId:'b',parentStudyId:'p',draftHash:hash,dirty:false},binding={id:'b',parentStudyId:'p',canonicalOutputId:nativeOnly?null:'o',title:'Exact article'};
 w.studyDraft={currentBinding:()=>binding,currentProof:()=>proof,flush:async()=>{if(fail)throw Error('Save refused');return proof;},openBinding:async input=>{calls.push(['binding',input.bindingId]);p.viewedStage=5;p.view='article';w.render();}};
 w.studyOutputConnection={flush:async()=>{if(fail)throw Error('Save refused');},selection:()=>nativeOnly?null:({projectId:'p',output:{id:'o'}})};
 w.realOutputOverview={read:async()=>({projectId:'p',outputs:nativeOnly?[]:[{id:'o',title:'Exact article',format:'Article',edition:'e'}]}),onAction:async input=>{calls.push(['output',input.outputId,input.kind]);p.viewedStage=5;p.view='article';w.render();}};
 w.phaseReader=()=>p.viewedStage===6?p.blocks.map(b=>`<section data-draft-passage="${b.id}">${b.text}</section>`).join(''):'<article>Current section '+p.viewedStage+'</article>';
 w.render=()=>{d.querySelector('#app').innerHTML='<main class="workspace" id="workspace"><header class="topbar"><h1>Project</h1></header><header id="c3-surface-bar"><div class="sb-right"></div></header><nav class="workflowNavigation"><button data-tr-home>Bench</button></nav>'+(p.viewedStage===5?'<div id="manuscript" contenteditable="true">'+p.blocks.map(b=>`<p data-block="${b.id}">${b.text}</p>`).join('')+'</div>':w.phaseReader(p))+'</main>';};
 w.viewPhase=async n=>{calls.push(['stage',n]);p.viewedStage=n;p.view=n===5?'article':'record';w.render();};w.switchProject=async id=>{calls.push(['project',id]);p.id=id;w.render();};
 w.projectLibrary={close:async()=>{await w.studyOutputConnection.flush();calls.push(['close']);d.querySelector('#project-library').open=false;},filterValue:()=> 'active'};
 const item={stage:lastStage,scroll:0,anchor:{id:'b2',kind:'passage',offset:0,index:1,text:'Second kept words'},selection:{id:'b2',start:7,length:4,text:'Second kept words'},proof:{bindingId:'b',draftHash:'kept-hash'}};
 w.localStorage.setItem('ar-study-work-navigation-v1',JSON.stringify({projects:{p:{last:location?{stage:lastStage,outputId:nativeOnly?null:'o',bindingId:'b'}:null,locations:location?{[nativeOnly?'native:p:b':'output:p:o:e']:item}:{}}}}));w.render();w.eval(fs.readFileSync(new URL('../public/document-study/workspace-navigation.js',import.meta.url),'utf8'));w.eval(fs.readFileSync(file,'utf8'));
 return {w,d,p,calls,set fail(v){fail=v;},settle:async()=>{await new Promise(r=>setTimeout(r,0));w.c3WorkbenchFrame.decorate();},close:()=>{for(const o of observers)o.disconnect();setTimeout(()=>w.close(),0);}};
}
test('Bench on Outputs after restart reads existing last paragraph and resumes the same saved output/stage/caret',async()=>{
 const f=resumeBoot();await f.settle();assert.equal(f.d.querySelector('.pickup blockquote').textContent,'Second kept words');assert.match(f.d.querySelector('[data-wbf-resume]').textContent,/Continue at ¶2/);const before=f.w.localStorage.getItem('ar-study-work-navigation-v1'),read=f.w.workspaceNavigation.lastLocation('p');read.item.selection.text='External mutation';assert.equal(f.w.workspaceNavigation.lastLocation('p').item.selection.text,'Second kept words');assert.equal(f.w.localStorage.getItem('ar-study-work-navigation-v1'),before,'read-only lookup never persists');f.d.querySelector('[data-wbf-resume]').click();await f.settle();assert.equal(f.p.viewedStage,6);assert.deepEqual(f.calls.slice(0,3),[['close'],['output','o','native'],['stage',6]]);assert.equal(f.w.getSelection().toString(),'kept');assert.equal(f.d.querySelector('[data-draft-passage="b2"]').textContent,'Second kept words');f.close();
});
test('closing Bench alone preserves underlying Outputs; Source or Outputs without saved work invent no paragraph',async()=>{
 for(const initialStage of [2,12]){const f=resumeBoot({initialStage,location:false});await f.settle();assert.equal(f.d.querySelector('.pickup blockquote'),null);assert.doesNotMatch(f.d.querySelector('[data-wbf-resume]').textContent,/¶/);await f.w.projectLibrary.close();assert.equal(f.p.viewedStage,initialStage);assert.deepEqual(f.calls,[['close']]);f.close();}
});
test('Bench Continue from Source uses stored meaningful work, while same-owner resume keeps its save guard',async()=>{
 const f=resumeBoot({initialStage:2,lastStage:6});await f.settle();assert.match(f.d.querySelector('[data-wbf-resume]').textContent,/¶2/);f.fail=true;await assert.rejects(f.w.workspaceNavigation.resumeLast(),/Save refused/);assert.equal(f.p.viewedStage,2);assert.deepEqual(f.calls,[]);f.d.querySelector('[data-wbf-resume]').click();await f.settle();assert.equal(f.d.querySelector('#project-library').open,true);assert.equal(f.p.viewedStage,2);assert.match(f.d.querySelector('#wn-message').textContent,/Save refused/);f.close();
});
test('saved caret is never restored onto a newer manuscript proof',async()=>{
 const f=resumeBoot({hash:'newer-hash'});await f.settle();await f.w.workspaceNavigation.resumeLast();assert.equal(f.p.viewedStage,6);assert.equal(f.w.getSelection().toString(),'');assert.equal(f.d.querySelector('[data-draft-passage="b2"]').textContent,'Second kept words');f.close();
});
test('native manuscript continuation opens its exact existing binding without an output authority',async()=>{
 const f=resumeBoot({nativeOnly:true});await f.settle();const target=f.w.workspaceNavigation.lastLocation('p');assert.equal(target.key,'native:p:b');await f.w.workspaceNavigation.resumeLast(target);assert.deepEqual(f.calls.slice(0,2),[['binding','b'],['stage',6]]);assert.equal(f.calls.some(c=>c[0]==='output'),false);assert.equal(f.p.viewedStage,6);assert.equal(f.w.getSelection().toString(),'kept');f.close();
});

test('Bench New project forwards once to the original project creator',async()=>{
 const f=resumeBoot();await f.settle();const original=f.d.createElement('button');original.dataset.plNew='';let calls=0;original.onclick=()=>calls++;f.d.querySelector('#project-library').append(original);f.d.querySelector('[data-wbf-new]').click();assert.equal(calls,1);f.close();
});
test('shared Bench icon decoration is idempotent rather than causing observer repaint loops',()=>{
 const f=boot(),home=f.d.querySelector('[data-tr-home]');home.insertAdjacentHTML('afterbegin','<svg><path d="old"/></svg>');f.w.c3WorkbenchFrame.decorate();const path=home.querySelector('path');f.w.c3WorkbenchFrame.decorate();assert.strictEqual(home.querySelector('path'),path);assert.equal(home.dataset.wbfIcon,'bench');f.close();
});
test('Check drawer over Write retains the exact live editor without a mode switch or save',async()=>{
 const {w,d,close}=boot(),editor=d.querySelector('#manuscript');let mounts=0,saves=0,switches=0;
 w.studyDraft={flush:async()=>{saves++;}};w.viewPhase=async()=>{switches++;};
 w.studyDraftCheck={mount(host){mounts++;const owner=d.createElement('aside');owner.className='wn-check-findings';owner.textContent='Unsaved edits · save before checking';host.append(owner);return owner;}};
 await w.c3WorkbenchFrame.openTool('check');
 assert.strictEqual(d.querySelector('#manuscript'),editor);assert.equal(editor.isContentEditable===false,false);assert.equal(switches,0);assert.equal(saves,0);assert.equal(mounts,1);assert.match(d.querySelector('#wbf-drawer').textContent,/Unsaved edits/);
 w.c3WorkbenchFrame.closeTool();assert.strictEqual(d.querySelector('#manuscript'),editor);close();
});

test('mounted Check is replaced on project switch rather than retaining foreign findings',async()=>{
 const {w,d,close}=boot();let mounts=0;w.studyDraftCheck={mount(host){mounts++;const owner=d.createElement('aside');owner.className='wn-check-findings';owner.textContent=w.current().name;host.append(owner);return owner;}};
 await w.c3WorkbenchFrame.openTool('check');w.current=()=>({id:'other',name:'Other project',view:'article',viewedStage:5});w.c3WorkbenchFrame.decorate();assert.equal(mounts,2);assert.equal(d.querySelector('#wbf-drawer .wn-check-findings').textContent,'Other project');close();
});

test('visible Focus returns through the maintained Margin action when focus is active',()=>{
 const {d,close}=boot();d.querySelector('#workspace').classList.add('workspace');const top=d.createElement('header');top.className='topbar';top.innerHTML='<button data-surface-mode="margin">Margin</button>';d.querySelector('#workspace').prepend(top);let exits=0;top.firstChild.onclick=()=>exits++;d.body.dataset.draftFocus='true';const button=d.createElement('button');button.className='sb-focus';button.textContent='Focus';d.querySelector('#c3-surface-bar').append(button);button.click();assert.equal(exits,1);close();
});

test('earlier writing remains the same guarded owner in a recovery drawer without a document row',async()=>{
 const{w,d,close}=boot();const banner=d.createElement('section');banner.className='draft-bar';banner.innerHTML='<details open class="draft-inspect"><summary>Earlier writing found on this device</summary><input value="Exact retained words"><button data-draft-action="bring-earlier">Bring it in</button></details>';d.querySelector('#workspace').append(banner);let clicks=0;banner.querySelector('button').addEventListener('click',()=>clicks++);w.c3WorkbenchFrame.decorate();assert.match(d.querySelector('.sb-morew>.sb-btn').getAttribute('aria-label'),/writing needs review/);assert.ok(d.querySelector('.sb-menu [data-wbf-tool="recovery"]'));await w.c3WorkbenchFrame.openTool('recovery');assert.strictEqual(d.querySelector('#wbf-drawer .draft-bar'),banner);assert.equal(banner.querySelector('input').value,'Exact retained words');banner.querySelector('button').click();assert.equal(clicks,1);w.c3WorkbenchFrame.closeTool();assert.strictEqual(d.querySelector('#workspace>.draft-bar'),banner);close();
});
test('both document modes retain Sources in More, with explicit Save using its maintained owner',()=>{const{w,d,close}=boot();w.c3WorkbenchFrame.decorate();assert.ok(d.querySelector('.sb-menu [data-wbf-tool="sources"]'));assert.ok(d.querySelector('.sb-menu [data-wbf-save]'));assert.equal(d.querySelectorAll('#wbf-tools>button').length,2);close();});

test('opening the native More menu restores document actions after its owner repaints',async()=>{const{w,d,close}=boot();w.c3WorkbenchFrame.decorate();const menu=d.querySelector('.sb-menu'),more=d.querySelector('.sb-morew>.sb-btn');more.addEventListener('click',()=>menu.replaceChildren());more.click();await Promise.resolve();assert.ok(menu.querySelector('[data-wbf-save]'));assert.ok(menu.querySelector('[data-wbf-tool="sources"]'));close();});


test('nonwriting title actions move their exact guarded proxies into More and retain handlers',()=>{
 const{w,d,close}=boot();w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:4});
 const right=d.querySelector('.sb-right'),mode=d.createElement('button'),primary=d.createElement('span');
 mode.className='sb-btn sb-mode';mode.textContent='Open the draft';let presses=0;mode.onclick=()=>presses++;
 primary.className='sb-pw';primary.innerHTML='<span class="sb-why" id="sb-why">Add sources first</span><button class="sb-primary" data-sb-primary disabled aria-describedby="sb-why">Research these sources</button>';
 right.append(mode,primary);w.c3WorkbenchFrame.decorate();
 assert.strictEqual(d.querySelector('.sb-menu .sb-mode'),mode);assert.strictEqual(d.querySelector('.sb-menu .sb-pw'),primary);mode.click();assert.equal(presses,1);
 assert.equal(primary.querySelector('button').disabled,true);assert.equal(primary.querySelector('#sb-why').textContent,'Add sources first');
 assert.equal(d.querySelectorAll('.sb-menu .sb-mode').length,1);w.c3WorkbenchFrame.decorate();assert.equal(d.querySelectorAll('.sb-menu .sb-mode').length,1);close();
});
test('opening More after a nonwriting surface repaint relocates the new owners once',async()=>{
 const{w,d,close}=boot();w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:2});
 const right=d.querySelector('.sb-right'),more=d.querySelector('.sb-morew>.sb-btn');let owner;
 more.addEventListener('click',()=>{right.querySelector('.sb-menu').replaceChildren();owner=d.createElement('button');owner.className='sb-btn sb-mode';owner.dataset.sb='7';owner.textContent='Open draft';right.append(owner);});
 more.click();await Promise.resolve();assert.strictEqual(d.querySelector('.sb-menu .sb-mode'),owner);assert.equal(owner.dataset.sb,'7');close();
});
test('writing title keeps existing mode and primary owners in their exact positions',()=>{
 const{w,d,close}=boot(),right=d.querySelector('.sb-right'),mode=d.createElement('button'),primary=d.createElement('span');mode.className='sb-mode';primary.className='sb-pw';right.append(mode,primary);w.c3WorkbenchFrame.decorate();assert.strictEqual(mode.parentElement,right);assert.strictEqual(primary.parentElement,right);assert.equal(d.querySelector('#c3-surface-bar').hasAttribute('data-wbf-section-actions'),false);close();
});

test('approved Bench composition retains the exact active-project search, list and action owners across repaint',async()=>{
 const f=resumeBoot();await f.settle();const home=f.d.querySelector('#project-library'),main=home.querySelector('.ht-home-main');
 home.querySelector('.ht-homebar')?.remove();home.querySelector('[data-pl-results]')?.remove();
 const bar=f.d.createElement('div');bar.className='ht-homebar';bar.innerHTML='<label class="pl-search"><input data-pl-search></label>';
 const results=f.d.createElement('div');results.dataset.plResults='';results.innerHTML='<div class="pl-library-row"><button class="pl-open" data-pl-open="p"><strong>Saved project</strong><span>Projects · Draft</span></button><button data-pl-pin="p">Pin</button></div>';
 main.append(bar,results);const owner=results.querySelector('[data-pl-open]'),pin=results.querySelector('[data-pl-pin]');let opens=0,pins=0;owner.onclick=()=>opens++;pin.onclick=()=>pins++;
 f.w.c3WorkbenchFrame.decorate();const active=home.querySelector('.wbf-bench.wrap>.wbf-active.block');assert.ok(active);assert.strictEqual(active.querySelector('.ht-homebar'),bar);assert.strictEqual(active.querySelector('[data-pl-results]'),results);assert.strictEqual(results.querySelector('.arow'),owner);assert.equal(results.classList.contains('alist'),true);
 f.w.c3WorkbenchFrame.decorate();assert.strictEqual(active.querySelector('[data-pl-open]'),owner);owner.click();pin.click();assert.equal(opens,1);assert.equal(pins,1);assert.equal(home.querySelectorAll('.wbf-active').length,1);f.close();
});

test('global Library labels all projects without changing the retained selected story or switch owner',()=>{const{w,d,close}=boot();const summary=d.querySelector('.ht-switch>summary'),label=d.createElement('span');label.className='ht-switch-label';label.textContent='Project';summary.append(label);const selected=w.current().id,workspace=d.querySelector('#workspace');workspace.classList.add('wfb-showing');const library=d.createElement('section');library.className='wfb-browser k-library';workspace.append(library);w.c3WorkbenchFrame.decorate();assert.equal(label.textContent,'All projects');assert.equal(w.current().id,selected);assert.strictEqual(d.querySelector('.ht-switch>summary'),summary);library.remove();workspace.classList.remove('wfb-showing');w.c3WorkbenchFrame.decorate();assert.equal(label.textContent,'Project');assert.equal(w.current().id,selected);close();});

test('Arrange keeps the exact guarded reader-preview primary beside the composition',()=>{
 const{w,d,close}=boot();w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:9});
 const right=d.querySelector('.sb-right'),primary=d.createElement('span'),mode=d.createElement('button');let presses=0;
 primary.className='sb-pw';primary.innerHTML='<button class="sb-primary" data-sb-primary>Audience view</button>';primary.querySelector('button').onclick=()=>presses++;
 mode.className='sb-mode';mode.textContent='Back to writing';right.append(mode,primary);w.c3WorkbenchFrame.decorate();
 assert.equal(d.querySelector('.sb-morew>.sb-btn').getAttribute('aria-label'),'Section tools');
 assert.strictEqual(primary.parentElement,right);assert.strictEqual(mode.parentElement,d.querySelector('.sb-menu'));primary.querySelector('button').click();assert.equal(presses,1);
 w.c3WorkbenchFrame.decorate();assert.strictEqual(primary.parentElement,right);assert.equal(d.querySelectorAll('.sb-pw').length,1);close();
});

function nativeCarouselFrame(){
 const f=boot(),{w,d}=f;w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:9});d.querySelector('.desk').remove();
 const owner={kind:'carousel-words',projectId:'physical-project',documentId:'physical-document',outputId:'native-carousel'},selection={projectId:'p',rootBindingId:'primary-root',output:{id:'native-carousel',kind:'carousel'},owner},proof={scope:{parentStudyId:'p',rootBindingId:'primary-root'},selectedOutputId:'native-carousel',writingProof:{...owner,expected:{...owner},wordsHash:'a'.repeat(64)}};
 w.studyOutputConnection={selection:()=>selection,canvasProof:()=>proof};const canvas=d.createElement('section');canvas.id='study-output-canvas';canvas.innerHTML='<div class="car-workspace"><main class="car-writing-page">Exact own carousel words</main></div>';d.querySelector('#workspace').append(canvas);
 const label=d.createElement('span');label.className='sb-cp-name';label.textContent='Arrange';d.querySelector('#c3-surface-bar').prepend(label);const primary=d.createElement('span');primary.className='sb-pw';primary.innerHTML='<button class="sb-primary" data-sb-primary aria-label="Write first">Write first</button>';d.querySelector('.sb-right').append(primary);return {...f,selection,proof,canvas,label,primary};
}
test('exact native carousel Writing content projects Write and hides only its redundant Write first action',()=>{
 const f=nativeCarouselFrame();try{const original=f.primary.firstElementChild;f.w.c3WorkbenchFrame.decorate();assert.equal(f.label.textContent,'Write');assert.equal(f.primary.hidden,true);assert.equal(f.primary.style.getPropertyValue('display'),'none');assert.strictEqual(f.primary.firstElementChild,original);assert.equal(f.canvas.textContent,'Exact own carousel words');const observer=new f.w.MutationObserver(()=>{});observer.observe(f.d.querySelector('#workspace'),{childList:true,subtree:true});f.w.c3WorkbenchFrame.decorate();assert.equal(observer.takeRecords().length,0);observer.disconnect();}finally{f.close();}
});
test('switching the same native carousel to Visual content restores Arrange and its exact original action',()=>{
 const f=nativeCarouselFrame();try{let presses=0;const original=f.primary.firstElementChild;original.onclick=()=>presses++;f.w.c3WorkbenchFrame.decorate();f.canvas.querySelector('main').className='car-stage';f.w.c3WorkbenchFrame.decorate();assert.equal(f.label.textContent,'Arrange');assert.equal(f.primary.hidden,false);assert.equal(f.primary.style.getPropertyValue('display'),'');assert.strictEqual(f.primary.firstElementChild,original);original.click();assert.equal(presses,1);}finally{f.close();}
});
test('foreign native carousel proof and an unrelated primary action retain their original frame projection',()=>{
 const f=nativeCarouselFrame();try{f.proof.scope.rootBindingId='foreign-root';f.w.c3WorkbenchFrame.decorate();assert.equal(f.label.textContent,'Arrange');assert.equal(f.primary.hidden,false);f.proof.scope.rootBindingId='primary-root';f.primary.firstElementChild.textContent='Audience view';f.primary.firstElementChild.setAttribute('aria-label','Audience view');f.w.c3WorkbenchFrame.decorate();assert.equal(f.label.textContent,'Write');assert.equal(f.primary.hidden,false);}finally{f.close();}
});

test('settled Arrange action labels do not create child-list repaint feedback',()=>{
 const{w,d,close}=boot();w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:9});
 const more=d.querySelector('.sb-morew>.sb-btn');more.innerHTML='<span>More</span>';w.c3WorkbenchFrame.decorate();
 const observer=new w.MutationObserver(()=>{});observer.observe(d.querySelector('#workspace'),{childList:true,subtree:true});w.c3WorkbenchFrame.decorate();
 assert.equal(observer.takeRecords().length,0);observer.disconnect();close();
});

function railHomeBoot(){
 const steps=Array.from({length:12},(_,i)=>`<button class="workflowStep" onclick="viewPhase(${i+1})"><span class="stepNumber">${i+1}</span><span class="stepName">Section ${i+1}</span></button>`).join('');
 const dom=new JSDOM(`<header id="c3-tabstrip"></header><div id="app"><div class="shell"><nav class="workflowNavigation"><button data-tr-home onclick="projectLibrary.open()">Bench</button><div class="workflowSteps">${steps}</div></nav><main id="workspace" class="workspace"><p id="wn-message" hidden></p><div class="desk"><article class="document"><div id="manuscript">Exact retained words</div></article></div></main></div></div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document;
 const p={id:'p',name:'Synthetic project',view:'article',viewedStage:5,blocks:[]},routes=[];let refuse=false,closes=0;
 w.HTMLDialogElement.prototype.show=w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.phaseReader=()=>'';w.current=()=>p;w.state={project:'p',projects:[p]};w.save=()=>{};w.render=()=>{};w.switchProject=()=>{};w.matchMedia=()=>({matches:false});w.requestAnimationFrame=fn=>setTimeout(fn,0);
 w.viewPhase=async n=>{routes.push(n);p.viewedStage=n;p.view=n===5?'article':'record';};
 w.studyDraft={flush:async()=>{if(refuse)throw Error('Exact save refused');return {dirty:false};}};
 w.fetch=async()=>({ok:true,json:async()=>({drafts:[],collections:[]})});
 w.realOutputOverview={read:async()=>({projectId:'p',outputs:[]})};
 w.c3Shell={register(_name,fn){fn();},actorName:()=> 'You'};
 for(const name of ['project-library.js','workspace-navigation.js','workbench-pieces.js','workbench-frame.js'])w.eval(fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8'));
 const originalClose=w.projectLibrary.close;w.projectLibrary.close=async()=>{closes++;return originalClose();};
 const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
 return{w,d,p,routes,settle,step:n=>[...d.querySelectorAll('.workflowStep')].find(button=>Number(button.querySelector('.stepNumber').textContent)===n),get closes(){return closes;},set refuse(value){refuse=value;},close:()=>w.close()};
}

test('Bench and Pieces rail exits close the real guarded library once then route through original capture handlers once',async()=>{
 for(const mode of ['bench','pieces'])for(const n of [1,2,3,4,5,6,7]){
  const f=railHomeBoot();try{
   (mode==='bench'?f.d.querySelector('[data-tr-home]'):f.d.querySelector('[data-wbf-pieces]')).click();await f.settle();
   assert.equal(f.d.getElementById('project-library').open,true,mode);
   if(mode==='pieces')assert.ok(f.d.querySelector('.wbp-root'));
   f.step(n).click();await f.settle();
   assert.equal(f.closes,1,mode+' close '+n);assert.equal(f.d.getElementById('project-library').open,false);
   assert.deepEqual(f.routes,n===7?[]:[n],mode+' original route '+n);
   if(n===7)assert.ok(f.d.querySelector('#wbf-drawer'),'Check keeps its existing drawer route');
  }finally{f.close();}
 }
});

test('refused Bench/Pieces close retains home and does not enter any rail route',async()=>{
 for(const n of [1,5,6,7]){const f=railHomeBoot();try{
  f.d.querySelector('[data-wbf-pieces]').click();await f.settle();f.refuse=true;
  f.step(n).click();await f.settle();assert.equal(f.closes,1);assert.equal(f.d.getElementById('project-library').open,true);assert.deepEqual(f.routes,[]);assert.equal(f.d.querySelector('#wbf-drawer'),null);assert.match(f.d.querySelector('#project-library [data-pl-status]').textContent,/Exact save refused/);
 }finally{f.close();}}
});

test('contextual project-library work is not dismissed by the Bench/Pieces rail exit handler',async()=>{
 const f=railHomeBoot();try{const content=f.d.createElement('article');content.textContent='Contextual exact work';let contextClose=0;const dialog=f.w.projectLibrary.openContext({title:'Context',content,beforeClose:()=>{contextClose++;return false;}});f.step(2).click();await f.settle();assert.equal(f.closes,0);assert.equal(contextClose,0);assert.equal(dialog.open,true);assert.equal(dialog.dataset.plContext,'true');assert.strictEqual(dialog.querySelector('article'),content);assert.deepEqual(f.routes,[2]);}finally{f.close();}
});

test('Understanding keeps a readable empty state beside an empty live owner and removes it when saved direction arrives',async()=>{const{w,d,close}=boot();try{const owner=d.createElement('div');owner.id='downstream-human-direction';d.querySelector('.desk').prepend(owner);await w.c3WorkbenchFrame.openTool('understanding');assert.match(d.querySelector('#wbf-drawer .dr-body').textContent,/No saved direction/);assert.strictEqual(d.querySelector('#wbf-drawer #downstream-human-direction'),owner);owner.textContent='Exact saved human direction';await Promise.resolve();assert.equal(d.querySelector('#wbf-drawer .wbf-drawer-empty'),null);assert.equal(owner.textContent,'Exact saved human direction');w.c3WorkbenchFrame.closeTool();assert.strictEqual(d.querySelector('.desk #downstream-human-direction'),owner);}finally{close();}});

test('topbar Compare awaits its existing owner once and reveals the same recovery alongside pending words',async()=>{
 const f=boot();try{
  const editor=f.d.querySelector('#manuscript'),words=editor.innerHTML,bar=f.d.createElement('section');bar.className='draft-bar';bar.innerHTML='<div id="draft-recovery"><p>Newer version by Codex</p></div>';f.d.querySelector('#workspace').append(bar);
  const button=f.d.createElement('button');button.dataset.cbCompare='';button.textContent='Compare';f.d.querySelector('#c3-surface-bar').append(button);
  let calls=0,release;const ready=new Promise(resolve=>release=resolve);f.w.studyDraft={currentBinding:()=>({id:'exact-binding'}),compare:async()=>{calls++;await ready;const result=f.d.createElement('article');result.textContent='Exact newer saved wording';bar.append(result);return true;}};
  // The original surface-bar delegate must not run a second owner request.
  f.d.addEventListener('click',event=>{if(event.target.closest('[data-cb-compare]'))void f.w.studyDraft.compare();});
  button.click();await Promise.resolve();assert.equal(calls,1);assert.equal(f.d.querySelector('#wbf-drawer'),null);release();await new Promise(resolve=>setTimeout(resolve,0));
  assert.strictEqual(f.d.querySelector('#wbf-drawer .draft-bar'),bar);assert.match(bar.textContent,/Exact newer saved wording/);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.equal(editor.innerHTML,words);assert.equal(calls,1);
  f.w.c3WorkbenchFrame.closeTool();assert.strictEqual(f.d.querySelector('#workspace>.draft-bar'),bar);
 }finally{f.close();}
});
test('late topbar Compare cannot open recovery over another binding or project',async()=>{
 const f=boot();try{const origin=f.w.current();f.w.current=()=>origin;let binding='first',release;const gate=new Promise(resolve=>release=resolve);f.w.studyDraft={currentBinding:()=>({id:binding}),compare:async()=>{await gate;return true;}};const button=f.d.createElement('button');button.dataset.cbCompare='';f.d.querySelector('#c3-surface-bar').append(button);button.click();await Promise.resolve();binding='second';release();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.d.querySelector('#wbf-drawer'),null);}finally{f.close();}
});

function nextMovesBoot(){
 const dom=new JSDOM('<header id="c3-tabstrip"></header><div id="app"><main id="workspace"><p id="wn-message" hidden></p><div id="manuscript">Exact pending words</div></main></div><dialog id="project-library" open><section class="ht-home-main"><div data-pl-results></div></section><p data-pl-status></p></dialog>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document;
 const projects=[{id:'first-id',name:'Same title',view:'article',viewedStage:5,blocks:[]},{id:'second-id',name:'Same title',view:'record',viewedStage:9,blocks:[]},{id:'archived-id',name:'Archived',archived:true,blocks:[]}],calls=[];let active=projects[0],gate=null,refuse=false;
 const values=new Map(projects.map((p,i)=>[p.id,{projectId:p.id,outputs:[{id:'output-'+i,rootBindingId:'root-'+i,edition:'edition-'+i,title:'Same output title',format:'Carousel',kind:'carousel',status:i?'review-needed':'correction-needed',nextAction:{kind:'arrange',label:i?'Review visuals':'Review output'}}]}]));
 w.state={projects};w.current=()=>active;w.matchMedia=()=>({matches:false});w.c3Shell={register(_name,fn){fn();},actorName:()=> 'You'};w.render=()=>{};
 w.workspaceNavigation={lastLocation:()=>null,capture:()=>null,resumeLast:async target=>calls.push(['resume',target])};
 w.projectLibrary={filterValue:()=> 'active',close:async()=>{calls.push(['close']);if(refuse)throw Error('Exact save refused');d.getElementById('project-library').open=false;d.getElementById('project-library').dispatchEvent(new w.Event('close'));}};
 w.switchProject=async id=>{calls.push(['switch',id]);active=projects.find(p=>p.id===id);};
 w.realOutputOverview={read:async({projectId})=>{calls.push(['read',projectId]);if(gate)await gate(projectId);const result=values.get(projectId);if(result instanceof Error)throw result;return structuredClone(result);},onAction:async input=>calls.push(['output',input])};
 w.eval(fs.readFileSync(file,'utf8'));
 return{w,d,projects,values,calls,set gate(v){gate=v;},set refuse(v){refuse=v;},set active(v){active=v;},settle:()=>new Promise(resolve=>setTimeout(resolve,15)),refresh:()=>d.querySelector('[data-wbf-next-refresh]').click(),close:()=>w.close()};
}
test('Bench aggregates real saved next moves across active project IDs without switching or writing; completion comes from owners',async()=>{
 const f=nextMovesBoot();try{const before=JSON.stringify(f.projects);await f.settle();const buttons=[...f.d.querySelectorAll('[data-wbf-next]')];assert.equal(buttons.length,2);assert.notEqual(buttons[0].dataset.wbfNext,buttons[1].dataset.wbfNext);assert.equal(f.calls.filter(c=>c[0]!=='read').length,0);assert.equal(f.calls.some(c=>c[1]==='archived-id'),false);assert.equal(JSON.stringify(f.projects),before);
 const later=f.values.get('first-id');later.outputs[0].status='ready';f.refresh();await f.settle();assert.equal(f.d.querySelectorAll('[data-wbf-next]').length,1,'a completed owner state removes its move, never a local done toggle');
 }finally{f.close();}
});
test('Bench next move rechecks exact root/output/edition then closes, switches and routes once',async()=>{
 const f=nextMovesBoot();try{await f.settle();f.calls.length=0;f.d.querySelectorAll('[data-wbf-next]')[1].click();await f.settle();assert.deepEqual(JSON.parse(JSON.stringify(f.calls.filter(c=>c[0]!=='read'))),[['close'],['switch','second-id'],['output',{projectId:'second-id',outputId:'output-1',edition:'edition-1',kind:'arrange'}]]);assert.equal(f.d.getElementById('manuscript').textContent,'Exact pending words');}finally{f.close();}
});
test('Bench pending refresh is loading, unavailable is not empty, and unchanged decoration does not refetch',async()=>{
 const f=nextMovesBoot();try{await f.settle();f.values.set('second-id',new Error('Reader offline'));let release;const gate=new Promise(resolve=>release=resolve);f.gate=()=>gate;f.refresh();assert.match(f.d.querySelector('[data-wbf-next-list]').textContent,/Reading/);release();await f.settle();assert.match(f.d.querySelector('[data-wbf-next-list]').textContent,/unavailable/i);assert.doesNotMatch(f.d.querySelector('[data-wbf-next-list]').textContent,/No next moves/);const reads=f.calls.length;f.w.c3WorkbenchFrame.decorate();await f.settle();assert.equal(f.calls.length,reads);}finally{f.close();}
});
test('Bench stale edition, refused save and newer project intent never dispatch the old move',async()=>{
 for(const mode of ['edition','refuse','newer']){const f=nextMovesBoot();try{await f.settle();f.calls.length=0;
 if(mode==='edition')f.values.get('second-id').outputs[0].edition='new-edition';if(mode==='refuse')f.refuse=true;
 let release;if(mode==='newer'){const gate=new Promise(resolve=>release=resolve);f.gate=()=>gate;}
 f.d.querySelectorAll('[data-wbf-next]')[1].click();if(mode==='newer'){await Promise.resolve();f.active=f.projects[1];release();}await f.settle();assert.equal(f.calls.some(c=>c[0]==='output'||c[0]==='switch'),false,mode);if(mode!=='newer')assert.equal(f.d.getElementById('project-library').open,true);
 }finally{f.close();}}
});
test('Bench keyboard activation of its pickup Continue remains independent from output queue discovery',async()=>{
 const f=resumeBoot();try{await f.settle();const button=f.d.querySelector('[data-wbf-resume]');button.focus();button.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));button.click();await f.settle();assert.deepEqual(f.calls.slice(0,3),[['close'],['output','o','native'],['stage',6]]);}finally{f.close();}
});

test('Understanding adapter mounts once per exact context and cleans on tabs, output switches and close',async()=>{
 const f=boot();try{let mounts=0,cleanups=0,project={id:'p',name:'Project',view:'article',viewedStage:5},output='output-one';f.w.current=()=>project;f.w.studyOutputConnection={selection:()=>({projectId:project.id,rootBindingId:'root-one',output:{id:output}})};
 f.w.workbenchUnderstanding={mount(host,options){mounts++;assert.equal(options.projectId,project.id);const owner=f.d.createElement('section');owner.textContent='Exact scoped understanding';host.append(owner);return{ready:Promise.resolve(),cleanup(){cleanups++;owner.remove();}};}};
 const prior=f.d.createElement('aside');prior.id='downstream-human-direction';prior.textContent='Old banner remains at its owner';f.d.querySelector('.desk').append(prior);
 await f.w.c3WorkbenchFrame.openTool('understanding');f.w.c3WorkbenchFrame.decorate();f.w.c3WorkbenchFrame.decorate();assert.equal(mounts,1);assert.strictEqual(prior.parentElement,f.d.querySelector('.desk'));
 output='output-two';f.w.c3WorkbenchFrame.decorate();assert.equal(mounts,2);assert.equal(cleanups,1);
 await f.w.c3WorkbenchFrame.openTool('sources');assert.equal(cleanups,2);await f.w.c3WorkbenchFrame.openTool('understanding');assert.equal(mounts,3);
 project={id:'other',name:'Other project',view:'article',viewedStage:5};f.w.c3WorkbenchFrame.decorate();assert.equal(mounts,4);assert.equal(cleanups,3);
 f.w.c3WorkbenchFrame.closeTool();assert.equal(cleanups,4);f.w.c3WorkbenchFrame.closeTool();assert.equal(cleanups,4);
 }finally{f.close();}
});

const frameTick=()=>new Promise(resolve=>setTimeout(resolve,5));
for(const entrance of ['button','keyboard'])test('quick thought '+entrance+' opens existing Understanding editor beside the same unsaved manuscript',async()=>{
 const f=boot();try{const editor=f.d.querySelector('#manuscript'),scope={projectId:'p',rootBindingId:'root',output:{id:'article'}},calls=[];let ready,opened=0;f.w.studyOutputConnection={selection:()=>scope};f.w.viewPhase=async n=>calls.push(['stage',n]);f.w.workbenchUnderstanding={mount(host){const button=f.d.createElement('button');button.dataset.understandingEdit='';button.onclick=()=>opened++;host.append(button);return{ready:new Promise(resolve=>ready=resolve),cleanup(){button.remove();}};}};editor.firstElementChild.textContent='Unsent exact human words';if(entrance==='button')f.d.querySelector('[data-wbf-thought]').click();else f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'t',bubbles:true}));await frameTick();assert.equal(opened,0,'waits for actual adapter readiness');assert.equal(typeof ready,'function');ready();await frameTick();assert.equal(opened,1);assert.equal(f.w.current().viewedStage,5);assert.equal(f.w.studyOutputConnection.selection(),scope);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.equal(editor.textContent,'Unsent exact human words');assert.deepEqual(calls,[]);}finally{f.close();}
});

test('quick thought waits for Bench close guard and refuses late project/readiness changes',async()=>{
 const f=boot();try{const dialog=f.d.createElement('dialog');dialog.id='project-library';dialog.open=true;f.d.body.append(dialog);let mounts=0;f.w.projectLibrary.close=async()=>{};f.w.workbenchUnderstanding={mount(){mounts++;return{ready:Promise.resolve(),cleanup(){}};}};f.d.querySelector('[data-wbf-thought]').click();await frameTick();assert.equal(dialog.open,true);assert.equal(mounts,0);dialog.open=false;let ready,opened=0;f.w.workbenchUnderstanding.mount=host=>{const b=f.d.createElement('button');b.dataset.understandingEdit='';b.onclick=()=>opened++;host.append(b);return{ready:new Promise(resolve=>ready=resolve),cleanup(){b.remove();}};};f.d.querySelector('[data-wbf-thought]').click();await frameTick();f.w.current=()=>({id:'changed',name:'Changed project',view:'article',viewedStage:5});ready();await frameTick();assert.equal(opened,0);}finally{f.close();}
});

for(const entrance of ['rail','drawer'])test('Carousel '+entrance+' Check uses maintained refusal without a hidden Article fallback',async()=>{
 const f=boot();try{const editor=f.d.querySelector('#manuscript'),selected={projectId:'p',rootBindingId:'carousel-root',output:{id:'carousel',kind:'carousel'}},calls=[];f.w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:9});f.w.studyOutputConnection={selection:()=>selected};f.w.viewPhase=async n=>calls.push(['raw-stage',n]);f.w.workspaceNavigation={changeMode:async mode=>{calls.push(['mode',mode]);throw Error('Carousel checking is not connected. Its own words remain in the existing editor.');}};if(entrance==='drawer')await assert.rejects(f.w.c3WorkbenchFrame.openTool('check'),/Carousel checking/);else{const rail=f.d.createElement('button');rail.className='workflowStep';rail.innerHTML='<span class="stepNumber">7</span>';f.d.querySelector('.workflowNavigation').append(rail);rail.click();await frameTick();assert.match(f.d.body.textContent,/Carousel checking is not connected/);}assert.deepEqual(calls,[['mode','check']]);assert.equal(f.w.current().viewedStage,9);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.strictEqual(f.w.studyOutputConnection.selection(),selected);assert.equal(f.d.querySelector('#wbf-drawer .wn-check-findings'),null);}finally{f.close();}
});

test('Article Check from Arrange routes exact selected owner through maintained mode before mounting findings',async()=>{
 const f=boot();try{const selected={projectId:'p',rootBindingId:'root',output:{id:'article',kind:'article'}},calls=[],p={id:'p',name:'Project',view:'record',viewedStage:9};f.w.current=()=>p;f.w.studyOutputConnection={selection:()=>selected};f.w.viewPhase=async n=>calls.push(['raw-stage',n]);f.w.workspaceNavigation={changeMode:async mode=>{calls.push(['mode',mode]);p.viewedStage=7;}};f.w.studyDraftCheck={mount(host){calls.push(['mount','article']);const owner=f.d.createElement('aside');owner.className='wn-check-findings';host.append(owner);return owner;}};await f.w.c3WorkbenchFrame.openTool('check');assert.deepEqual(calls,[['mode','check'],['mount','article']]);assert.equal(f.w.current().viewedStage,7);assert.strictEqual(f.w.studyOutputConnection.selection(),selected);}finally{f.close();}
});

test('actual Understanding drawer Check tab retains the carousel and current drawer on unsupported refusal',async()=>{
 const f=boot();try{const editor=f.d.querySelector('#manuscript'),p={id:'p',name:'Project',view:'record',viewedStage:9},selection={projectId:'p',rootBindingId:'root',output:{id:'carousel',kind:'carousel'}};f.w.current=()=>p;f.w.studyOutputConnection={selection:()=>selection};const calls=[];f.w.viewPhase=async n=>calls.push(['raw',n]);f.w.workspaceNavigation={changeMode:async mode=>{calls.push(['mode',mode]);throw Error('Carousel checking is not connected');}};await f.w.c3WorkbenchFrame.openTool('understanding');const drawer=f.d.querySelector('#wbf-drawer');drawer.querySelector('.dr-tabs [data-wbf-tool="check"]').click();await frameTick();assert.strictEqual(f.d.querySelector('#wbf-drawer'),drawer);assert.equal(drawer.querySelector('.dr-body').dataset.tool,'understanding');assert.equal(p.viewedStage,9);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.strictEqual(f.w.studyOutputConnection.selection(),selection);assert.deepEqual(calls,[['mode','check']]);assert.match(f.d.body.textContent,/Carousel checking is not connected/);}finally{f.close();}
});

test('late Check owner completion never mounts findings for a changed selected output',async()=>{
 const f=boot();try{const p={id:'p',name:'Project',view:'record',viewedStage:9};let output='article',release,mounts=0;f.w.current=()=>p;f.w.studyOutputConnection={selection:()=>({projectId:'p',rootBindingId:'root',output:{id:output,kind:'article'}})};f.w.workspaceNavigation={changeMode:async()=>{await new Promise(resolve=>release=resolve);p.viewedStage=7;}};f.w.studyDraftCheck={mount(){mounts++;}};const opening=f.w.c3WorkbenchFrame.openTool('check');await frameTick();output='different-article';release();await assert.rejects(opening,/selected work changed/);assert.equal(mounts,0);assert.equal(f.d.querySelector('#wbf-drawer'),null);}finally{f.close();}
});

const SOURCE_UUID='11111111-1111-4111-8111-111111111111',COLLECTION_UUID='22222222-2222-4222-8222-222222222222';
function sourceProjection({references=true,status='current'}={}){return{schema:'ar-create.current-understanding.projection.v1',status,fingerprint:'a'.repeat(64),readConsistency:{status:'stable-reread'},selection:{scope:{scope:'project',parentStudyId:'p'}},records:[{selector:{scope:'project',parentStudyId:'p'},status,sourceReferences:references?[{sourceId:SOURCE_UUID,sourceHash:'b'.repeat(64),title:'Original tea conversation',quote:'Exact saved source passage.',start:0,status:'current-reference'}]:[]}],scopeReferences:{effective:[]}};}
function sourcesAPI(f,reply=sourceProjection()){const calls=[];f.w.fetch=async(url,options)=>{calls.push({url,input:JSON.parse(options.body),signal:options.signal});return{ok:true,json:async()=>typeof reply==='function'?reply():reply};};return calls;}

test('Sources drawer shows real saved references and guarded existing read/Collection actions without citation claims',async()=>{
 const f=boot();try{const editor=f.d.querySelector('#manuscript'),calls=sourcesAPI(f),opens=[];f.w.connectedWorkspace={readCollections:async()=>({revision:1,indexHash:'c'.repeat(64),collections:[{id:COLLECTION_UUID,name:'Tea questions',sourceIds:[SOURCE_UUID]}]}),openContext:async(kind,descriptor)=>opens.push([kind,descriptor])};await f.w.c3WorkbenchFrame.openTool('sources');await f.d.querySelector('.dr-body').wbfSources.ready;assert.equal(calls[0].url,'/api/work-continuity/understanding');assert.deepEqual(calls[0].input,{request:{scopes:[{scope:'project',parentStudyId:'p'}],selectedScope:{scope:'project',parentStudyId:'p'}}});const drawer=f.d.querySelector('#wbf-drawer');assert.match(drawer.textContent,/Whole project/);assert.match(drawer.textContent,/Original tea conversation/);assert.match(drawer.textContent,/Exact saved source passage/);assert.match(drawer.textContent,/current source wording/i);drawer.querySelector('[data-wbf-source-open]').click();await frameTick();drawer.querySelector('[data-wbf-source-collection]').click();await frameTick();assert.deepEqual(JSON.parse(JSON.stringify(opens)),[['source',{sourceId:SOURCE_UUID}],['inquiries',{collectionId:COLLECTION_UUID,sourceId:SOURCE_UUID}]]);assert.equal(drawer.querySelector('[data-wbf-source-add]').disabled,true);assert.match(drawer.textContent,/Not connected.*citation/s);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.equal(editor.textContent,'Exact human text');}finally{f.close();}
});

test('Sources distinguishes loaded empty, unavailable owner and missing retained context',async()=>{
 for(const [reply,pattern]of [[sourceProjection({references:false}),/No saved Library passages/],[sourceProjection({references:false,status:'unavailable'}),/Saved Library references are unavailable/],[()=>{throw Error('Resolver offline');},/Resolver offline/]]){const f=boot();try{sourcesAPI(f,reply);await f.w.c3WorkbenchFrame.openTool('sources');await f.d.querySelector('.dr-body').wbfSources.ready;assert.match(f.d.querySelector('#wbf-drawer').textContent,pattern);assert.match(f.d.querySelector('#wbf-drawer').textContent,/No .*working.file source context/);}finally{f.close();}}
});

test('Sources rejects foreign projection scope and late project payload; close aborts without replacing original owner',async()=>{
 const f=boot();try{let resolve;const pending=new Promise(r=>resolve=r),calls=sourcesAPI(f,()=>pending),owner=f.d.createElement('details');owner.className='draft-surface-source';owner.innerHTML='<summary>Source & brief</summary><input value="Exact local input">';f.d.querySelector('.document').append(owner);await f.w.c3WorkbenchFrame.openTool('sources');const ready=f.d.querySelector('.dr-body').wbfSources.ready;f.w.c3WorkbenchFrame.closeTool();resolve(sourceProjection());await ready;assert.equal(calls[0].signal.aborted,true);assert.strictEqual(f.d.querySelector('.document .draft-surface-source'),owner);assert.equal(owner.querySelector('input').value,'Exact local input');}finally{f.close();}
 const g=boot();try{const value=sourceProjection();value.records[0].selector.parentStudyId='foreign';sourcesAPI(g,value);await g.w.c3WorkbenchFrame.openTool('sources');await g.d.querySelector('.dr-body').wbfSources.ready;assert.match(g.d.querySelector('#wbf-drawer').textContent,/scope|unavailable/i);assert.doesNotMatch(g.d.querySelector('#wbf-drawer').textContent,/Exact saved source passage/);}finally{g.close();}
});

test('Sources reads once during repeated decoration and lets maintained context refusal retain unsent manuscript',async()=>{
 const f=boot();try{const calls=sourcesAPI(f),editor=f.d.querySelector('#manuscript');editor.firstElementChild.textContent='My exact unsent words';f.w.connectedWorkspace={openContext:async()=>{throw Error('Held buffer cannot leave yet');},readCollections:async()=>({revision:0,indexHash:'c'.repeat(64),collections:[]})};await f.w.c3WorkbenchFrame.openTool('sources');await f.d.querySelector('.dr-body').wbfSources.ready;f.w.c3WorkbenchFrame.decorate();f.w.c3WorkbenchFrame.decorate();assert.equal(calls.length,1);f.d.querySelector('[data-wbf-source-open]').click();await frameTick();assert.match(f.d.querySelector('#wbf-drawer').textContent,/Held buffer cannot leave yet/);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.equal(editor.textContent,'My exact unsent words');}finally{f.close();}
});

test('Sources output context is exact and a late project payload cannot paint its references',async()=>{
 const f=boot();try{let release;const value=sourceProjection(),ROOT='33333333-3333-4333-8333-333333333333',OUTPUT='44444444-4444-4444-8444-444444444444';const scope={scope:'output',parentStudyId:'p',bindingId:ROOT,outputId:OUTPUT};value.selection.scope=scope;value.records.push({selector:scope,status:'empty',sourceReferences:[]});value.piece={status:'current',scope:{parentStudyId:'p',rootBindingId:ROOT,outputId:OUTPUT}};f.w.studyOutputConnection={selection:()=>({projectId:'p',rootBindingId:ROOT,output:{id:OUTPUT,kind:'article'}})};const pending=new Promise(resolve=>release=resolve),calls=sourcesAPI(f,()=>pending);await f.w.c3WorkbenchFrame.openTool('sources');const ready=f.d.querySelector('.dr-body').wbfSources.ready;assert.deepEqual(calls[0].input.request.piece,{parentStudyId:'p',rootBindingId:ROOT,selectedOutputId:OUTPUT});f.w.current=()=>({id:'other',name:'Other',view:'article',viewedStage:5});release(value);await ready;assert.equal(calls[0].signal.aborted,true);assert.doesNotMatch(f.d.querySelector('#wbf-drawer').textContent,/Exact saved source passage/);}finally{f.close();}
});

test('malformed saved source reference is unavailable rather than reported as an empty scope',async()=>{
 const f=boot();try{const value=sourceProjection();value.records[0].sourceReferences[0].sourceHash='invalid';sourcesAPI(f,value);await f.w.c3WorkbenchFrame.openTool('sources');await f.d.querySelector('.dr-body').wbfSources.ready;assert.match(f.d.querySelector('#wbf-drawer').textContent,/references could not be confirmed/);assert.equal(f.d.querySelector('[data-wbf-source-open]'),null);}finally{f.close();}
});


test('writing word count keeps paragraph boundaries without changing manuscript nodes',()=>{
 const{w,d,close}=boot(),editor=d.querySelector('#manuscript');editor.innerHTML='<p data-block="one">First two words</p><h2 data-block="heading">A heading</h2><p data-block="two">Last two words</p>';const nodes=[...editor.children],html=editor.innerHTML;w.c3WorkbenchFrame.decorate();assert.equal(d.querySelector('.wbf-word-count').textContent,'8 words');assert.equal(editor.innerHTML,html);assert.deepEqual([...editor.children],nodes);close();
});

test('generated project line is hidden only when the visible document h1 repeats its exact trimmed name',()=>{
 const f=boot();try{const doc=f.d.querySelector('.document'),heading=doc.querySelector('h1'),editor=f.d.querySelector('#manuscript'),words=editor.textContent;
 heading.getClientRects=()=>[{}];heading.textContent='  Project  ';const author=f.d.createElement('div');author.className='by actual-author';author.textContent='By the actual author';heading.after(author);f.w.c3WorkbenchFrame.decorate();
 assert.equal(doc.querySelector('.wbf-doc-by').hidden,true);assert.equal(author.hidden,false);assert.equal(author.textContent,'By the actual author');assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.equal(editor.textContent,words);
 const observed=new f.w.MutationObserver(()=>{});observed.observe(doc.querySelector('.wbf-doc-by'),{attributes:true});f.w.c3WorkbenchFrame.decorate();assert.equal(observed.takeRecords().length,0,'unchanged decoration must not rewrite hidden');observed.disconnect();
 heading.textContent='A distinct article title';f.w.c3WorkbenchFrame.decorate();assert.equal(doc.querySelector('.wbf-doc-by').hidden,false);assert.equal(doc.querySelector('.wbf-doc-by').textContent,'Project');
 }finally{f.close();}
});
test('duplicate project line uses the same rule in Read without removing words, credits or the current caret',()=>{
 const f=boot();try{const doc=f.d.querySelector('.document'),heading=doc.querySelector('h1'),editor=f.d.querySelector('#manuscript'),text=editor.firstElementChild.firstChild;heading.getClientRects=()=>[{}];heading.textContent='Project';
 const phase=f.d.createElement('section');phase.className='phaseReader c3-read';f.d.querySelector('#workspace').append(phase);phase.append(doc);f.w.current=()=>({id:'p',name:'Project',view:'record',viewedStage:6,blocks:[]});
 const range=f.d.createRange();range.setStart(text,3);range.setEnd(text,8);f.w.getSelection().removeAllRanges();f.w.getSelection().addRange(range);const selected=f.w.getSelection().toString();f.w.c3WorkbenchFrame.decorate();
 assert.equal(doc.querySelector('.wbf-doc-by').hidden,true);assert.strictEqual(f.d.querySelector('#manuscript'),editor);assert.equal(f.w.getSelection().toString(),selected);assert.equal(heading.textContent,'Project');
 }finally{f.close();}
});
test('hidden, missing, non-h1, differently cased and empty headings do not hide the project line',()=>{
 for(const alter of [h=>h.getClientRects=()=>[],h=>h.style.visibility='hidden',h=>h.remove(),h=>{const h2=h.ownerDocument.createElement('h2');h2.textContent=h.textContent;h.replaceWith(h2);},h=>h.textContent='project',h=>h.textContent='']){
  const f=boot();try{const h=f.d.querySelector('.document>h1');h.textContent='Project';h.getClientRects=()=>[{}];alter(h);f.w.c3WorkbenchFrame.decorate();assert.equal(f.d.querySelector('.wbf-doc-by')?.hidden,false);}finally{f.close();}
 }
});
test('exact piece-scoped Media keeps the current project name while shared Library remains global',()=>{const{w,d,close}=boot();const switcher=d.querySelector('.ht-switch>summary');switcher.innerHTML='<span class="ht-switch-label"></span>';const workspace=d.querySelector('#workspace');workspace.classList.add('wfb-showing');const browser=d.createElement('section');browser.className='wfb-browser k-media';browser.setAttribute('data-wfb-owner-scoped','true');workspace.append(browser);w.c3WorkbenchFrame.decorate();assert.equal(switcher.querySelector('.ht-switch-label').textContent,w.current().name);browser.removeAttribute('data-wfb-owner-scoped');w.c3WorkbenchFrame.decorate();assert.equal(switcher.querySelector('.ht-switch-label').textContent,'All projects');close();});


test('carousel word count follows the visible slide wording, excluding caption and controls',()=>{
 const{w,d,close}=boot();d.querySelector('.desk').remove();const sequence=d.createElement('section');sequence.className='wordSequence';sequence.innerHTML='<article><div class="wordRole">1 · cover · Credit is separate</div><div class="slideProse" contenteditable="true">A precise hook</div></article><article><div class="slideProse" contenteditable="true">Then teach something useful</div></article><section class="caption">This caption is separate from slide wording</section>';d.querySelector('#workspace').append(sequence);w.current=()=>({id:'p',name:'Project',view:'carousel',outputMode:'words',viewedStage:5});
 const editor=sequence.querySelector('.slideProse');w.c3WorkbenchFrame.decorate();assert.equal(d.querySelector('.wbf-word-count').textContent,'7 words');assert.strictEqual(sequence.querySelector('.slideProse'),editor);editor.textContent='A better precise hook';w.c3WorkbenchFrame.decorate();assert.equal(d.querySelector('.wbf-word-count').textContent,'8 words');assert.strictEqual(sequence.querySelector('.slideProse'),editor);close();
});
