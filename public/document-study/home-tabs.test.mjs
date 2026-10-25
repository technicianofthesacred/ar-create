import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const library=fs.readFileSync(new URL('./project-library.js',import.meta.url),'utf8'),tabs=fs.readFileSync(new URL('./home-tabs.js',import.meta.url),'utf8');

function fixture(t){
 const dom=new JSDOM('<div id="app"><aside class="rail"></aside><main id="workspace"><div class="topbar"></div><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this);}};
 t.after(async()=>{w.dispatchEvent(new w.Event('pagehide'));observers.forEach(observer=>observer.disconnect());await new Promise(resolve=>setImmediate(resolve));dom.window.close();});
 w.HTMLDialogElement.prototype.show=function(){this.open=true;this.dataset.testModal='false';};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.dataset.testModal='true';};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.CSS={escape:s=>s};
 w.state={project:'p0',projects:Array.from({length:125},(_,i)=>({id:'p'+i,name:'Invented tea '+i,folder:i%2?'Tea':'Ideas',archived:i>=120,step:i%3?'Material':'Writing'}))};
 w.crypto.randomUUID=()=>'00000000-0000-4000-8000-000000000001';
 Object.assign(w,{rememberPosition(){},selected:null,activeBlock:null,keyboardBlock:null,modal:null,mobileProjects:false});
 const calls=[];let fail=false,saves=0,selection=null;
 const outputs={p0:[{id:'o-a',title:'Kiln article',format:'Article'}],p7:[{id:'o-c',title:'Seven slides',format:'Carousel'},{id:'o-d',title:'Gate essay',format:'Article'}]};
 w.current=()=>w.state.projects.find(p=>p.id===w.state.project);
 w.save=()=>{saves++;};
 w.projectBrowser=()=>'';
 w.render=()=>{};
 w.viewPhase=async n=>{calls.push(['viewPhase',n]);w.current().viewedStage=n;};
 w.switchProject=id=>{calls.push(['switchProject',id]);w.state.project=id;selection=null;w.render();};
 w.fetch=async()=>({ok:true,json:async()=>({collections:[]})});
 w.studyOutputConnection={flush:async()=>{if(fail)throw Error('Save failed. Your words remain here.');},selectOutput:async({projectId,outputId})=>{calls.push(['selectOutput',projectId,outputId]);selection={projectId,outputId};}};
 w.realOutputOverview={read:async({projectId})=>({projectId,outputs:outputs[projectId]||[]}),onAction:async a=>{calls.push(['onAction',a.projectId,a.outputId,a.kind]);}};
 w.workspaceNavigation={selectedOutput:()=>selection?.projectId===w.state.project?(outputs[selection.projectId]||[]).find(o=>o.id===selection.outputId)||null:null};
 w.eval(library);w.eval(tabs);
 const idle=async()=>{await w.projectLibrary.whenIdle();await w.homeTabs.whenIdle();await w.projectLibrary.whenIdle();};
 return {dom,w,calls,idle,outputs,set fail(v){fail=v;},get saves(){return saves;},select(projectId,outputId){selection={projectId,outputId};w.render();},
  click:async selector=>{const el=w.document.querySelector(selector);assert.ok(el,'missing '+selector);el.click();await idle();},
  keys:()=>JSON.parse(JSON.stringify(w.state.projectNavigation.openTabs.map(t=>t.projectId+'::'+t.outputId)))};
}

test('current piece gets a tab; an output tab replaces the bare piece tab; tabs survive in browser state',async t=>{
 const f=fixture(t);
 assert.deepEqual(f.keys(),['p0::']);
 assert.ok(f.w.document.querySelector('#c3-tabstrip [data-ht-tab="p0::"][aria-current=page]'));
 f.select('p0','o-a');
 assert.deepEqual(f.keys(),['p0::o-a']);
 assert.match(f.w.document.querySelector('#c3-tabstrip .ht-tab.on').textContent,/Kiln article/);
 assert.ok(f.saves>0);
});

test('opening a tab of another piece goes through the existing project, output and Write owners',async t=>{
 const f=fixture(t);
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'o-d',title:'Gate essay',format:'Article'});f.w.homeTabs.paint();
 await f.click('[data-ht-tab="p7::o-d"]');
 assert.equal(f.w.current().id,'p7');
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[['switchProject','p7'],['selectOutput','p7','o-d'],['onAction','p7','o-d','native'],['viewPhase',5]]);
 f.calls.length=0;
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'o-c',title:'Seven slides',format:'Carousel'});f.w.homeTabs.paint();
 await f.click('[data-ht-tab="p7::o-c"]');
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[['selectOutput','p7','o-c'],['onAction','p7','o-c','words']]);
});

test('a failed save refuses tab switch, tab close, Home and Research without replacing the editor',async t=>{
 const f=fixture(t);
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'o-d',title:'Gate essay',format:'Article'});f.w.homeTabs.paint();
 const editor=f.w.document.querySelector('#manuscript');
 f.fail=true;
 await f.click('[data-ht-tab="p7::o-d"]');
 assert.equal(f.w.current().id,'p0');
 assert.match(f.w.document.querySelector('[data-ht-status]').textContent,/Save failed/);
 await f.click('[data-ht-close="p0::"]');
 assert.equal(f.w.document.querySelector('#project-library')?.open||false,false);
 assert.ok(f.keys().includes('p0::'),'a refused close keeps the tab');
 await f.click('[data-ht-home]');
 assert.equal(f.w.document.querySelector('#project-library')?.open||false,false);
 await f.click('[data-ht-research]');
 assert.equal(f.w.current().viewedStage,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[]);
 assert.equal(f.w.document.querySelector('#manuscript'),editor);
 assert.equal(editor.textContent,'Unsaved human writing');
});

test('closing a tab only forgets the tab: no project, output or filing data changes',async t=>{
 const f=fixture(t);
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'o-d',title:'Gate essay',format:'Article'});f.w.homeTabs.paint();
 const before=JSON.stringify(f.w.state.projects);
 await f.click('[data-ht-close="p7::o-d"]');
 assert.deepEqual(f.keys(),['p0::']);
 assert.equal(JSON.stringify(f.w.state.projects),before);
 assert.equal(f.calls.length,0);
 await f.click('[data-ht-close="p0::"]');
 assert.equal(f.w.document.querySelector('#project-library').open,true,'closing the tab you are on shows Home');
 assert.equal(JSON.stringify(f.w.state.projects),before);
});

test('an output that no longer exists says so and deletes nothing',async t=>{
 const f=fixture(t);
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'gone',title:'Old draft',format:'Article'});f.w.homeTabs.paint();
 await f.click('[data-ht-tab="p7::gone"]');
 assert.match(f.w.document.querySelector('[data-ht-status]').textContent,/no longer an output.*nothing was deleted/);
 assert.ok(f.keys().includes('p7::gone'));
 assert.equal(f.calls.some(c=>c[0]==='selectOutput'),false);
});

test('Home is the existing nonmodal library: shared strip remains reachable, facet counts and editor kept',async t=>{
 const f=fixture(t),editor=f.w.document.querySelector('#manuscript');
 await f.click('[data-ht-home]');
 const d=f.w.document.querySelector('#project-library');
 assert.equal(d.open,true);
 assert.ok(d.classList.contains('c3-home'));
 assert.equal(d.dataset.testModal,'false');
 assert.equal(f.w.document.querySelector('#c3-tabstrip').parentElement,f.w.document.body);
 assert.ok(f.w.document.querySelector('#c3-tabstrip [data-ht-home][aria-current=page]'));
 const facet=(attr,value)=>d.querySelector(`[${attr}="${value}"]`);
 assert.match(facet('data-ht-show','active').textContent,/120/);
 assert.match(facet('data-ht-folder','Tea').textContent,/60/);
 assert.match(facet('data-ht-status-filter','Writing').textContent,/40/);
 assert.match(d.querySelector('[data-pl-count]').textContent,/120 pieces/);
 await f.click('#project-library [data-ht-status-filter="Writing"]');
 assert.match(d.querySelector('[data-pl-count]').textContent,/40 pieces/);
 await f.click('#project-library [data-ht-folder="Tea"]');
 assert.match(d.querySelector('[data-pl-count]').textContent,/60 pieces/);
 await f.click('#project-library [data-ht-view="list"]');
 assert.equal(d.querySelector('[data-pl-results]').classList.contains('ht-grid'),false);
 assert.equal(f.w.state.projectNavigation.homeView,'list');
 await f.click('#project-library [data-pl-close]');
 assert.equal(d.open,false);
 assert.equal(f.w.document.querySelector('#c3-tabstrip').parentElement,f.w.document.body);
 assert.equal(f.w.document.querySelector('#manuscript'),editor);
 assert.equal(editor.textContent,'Unsaved human writing');
});

test('opening a piece from Home keeps the library open/switch path and gives the piece a tab',async t=>{
 const f=fixture(t);
 await f.click('[data-ht-home]');
 await f.click('#project-library [data-pl-open="p10"]');
 assert.equal(f.w.current().id,'p10');
 assert.equal(f.w.document.querySelector('#project-library').open,false);
 assert.ok(f.keys().includes('p10::'));
});

test('existing global hooks stay callable after install',t=>{
 const f=fixture(t);
 for(const name of ['switchProject','render','viewPhase','save','projectBrowser'])assert.equal(typeof f.w[name],'function',name);
 assert.equal(typeof f.w.projectLibrary.open,'function');
});

test('card ⋯ menu holds the same pin and organize buttons; grouping adds headings only',async t=>{
 const f=fixture(t);
 await f.click('[data-ht-home]');
 const d=f.w.document.querySelector('#project-library'),row=d.querySelector('.pl-library-row');
 const menu=row.querySelector('.ht-card-more .ht-menu');
 assert.ok(menu.querySelector('[data-pl-pin]'),'pin is in the menu');
 assert.ok(menu.querySelector('[data-pl-file]'),'organize is in the menu');
 assert.equal(row.querySelectorAll('[data-pl-pin],[data-pl-file]').length,2,'not duplicated');
 const before=d.querySelectorAll('.pl-library-row').length;
 await f.click('#project-library [data-ht-group="status"]');
 assert.deepEqual(JSON.parse(JSON.stringify([...d.querySelectorAll('.ht-ghead')].map(h=>h.firstChild.textContent))),['Material','Writing']);
 assert.equal(d.querySelectorAll('.pl-library-row').length,before);
 assert.equal(f.w.state.projectNavigation.homeGroup,'status');
});

test('All pieces finder opens a piece through the library path; theme switch only changes the theme',async t=>{
 const f=fixture(t);
 f.w.applyTheme=()=>{f.w.document.documentElement.dataset.theme=f.w.state.theme;};f.w.applyTheme();
 const input=f.w.document.querySelector('[data-ht-find]');
 input.value='tea 42';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 const hit=f.w.document.querySelector('[data-ht-find-results] [data-pl-open="p42"]');
 assert.ok(hit);
 hit.click();await f.idle();
 assert.equal(f.w.current().id,'p42');
 const before=JSON.stringify(f.w.state.projects);
 f.w.state.theme='light';f.w.applyTheme();
 await f.click('[data-ht-theme]');
 assert.equal(f.w.state.theme,'dark');
 assert.equal(JSON.stringify(f.w.state.projects),before);
});


test('context detours retain their actual header/content and are never decorated as Home',async t=>{
 const f=fixture(t),content=f.w.document.createElement('div');content.innerHTML='<textarea>Unsent source correction</textarea>';
 f.w.projectLibrary.openContext({title:'Source',content,beforeClose:()=>true});f.w.homeTabs.paint();
 const d=f.w.document.getElementById('project-library');assert.equal(d.dataset.plContext,'true');assert.equal(d.classList.contains('c3-home'),false);assert.equal(d.querySelector('#pl-title').textContent,'Source');assert.equal(d.querySelector('textarea'),content.querySelector('textarea'));assert.equal(d.querySelector('.ht-facets'),null);assert.notEqual(f.w.document.getElementById('c3-tabstrip').parentElement,d);
 await f.w.projectLibrary.close();await f.w.projectLibrary.open();f.w.homeTabs.paint();assert.equal(d.dataset.plContext,undefined);assert.equal(d.classList.contains('c3-home'),true);assert.ok(d.querySelector('[data-pl-search]'));
});

test('connected Learning library is present once in actual C3 Open menus after repaint and in Home, using guarded flush',async t=>{
 const f=fixture(t);const w=f.w,d=w.document,opened=[],errors=[];
 w.structuredClone=structuredClone;w.toast=value=>errors.push(value);
 w.createInquiryInterfaceClient=()=>({});
 w.mountInquiryWorkspace=({container})=>{opened.push(container);container.textContent='Invented independent inquiry';return {ready:Promise.resolve()};};
 w.mountWorkContinuity=()=>({ready:Promise.resolve(),update:async()=>{}});
 w.studyDraft={currentBinding:()=>null,currentProof:()=>null};
 const bridge=fs.readFileSync(new URL('./connected-workspace.mjs',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'');w.eval(bridge);
 const settle=async()=>{await new Promise(resolve=>setTimeout(resolve,10));await f.idle();await new Promise(resolve=>setTimeout(resolve,10));};
 const entry=()=>d.querySelector('#c3-tabstrip .ht-plus .ht-menu > [data-learning-library]');
 assert.ok(entry(),'independent learning must be reachable in the real visible Open/create menu, not only hidden rail');
 assert.equal(entry().type,'button');assert.equal(entry().textContent,'Learning library');
 f.w.current().name='Renamed invented piece';w.render();await settle();
 assert.equal(d.querySelectorAll('#c3-tabstrip .ht-plus .ht-menu > [data-learning-library]').length,1,'C3 repaint restores one entry');
 f.fail=true;entry().click();await settle();assert.equal(opened.length,0,'failed owner flush refuses navigation');assert.ok(errors.some(x=>/Save failed/.test(x)));
 f.fail=false;await w.projectLibrary.open();w.homeTabs.paint();await settle();
 assert.equal(d.querySelector('#project-library.c3-home').dataset.testModal,'false');
 assert.ok(entry(),'the same real menu remains reachable outside nonmodal Home');assert.equal(d.querySelectorAll('#c3-tabstrip .ht-plus .ht-menu > [data-learning-library]').length,1);
 entry().closest('details').open=true;entry().click();await settle();
 assert.equal(opened.length,1);assert.equal(d.querySelector('#project-library').dataset.plContext,'true');assert.equal(d.querySelector('#pl-title').textContent,'Learning library');
 assert.equal(d.querySelector('#manuscript').textContent,'Unsaved human writing');
 await w.projectLibrary.close();await settle();
 assert.equal(d.querySelector('#project-library').open,false);assert.equal(d.querySelectorAll('#c3-tabstrip .ht-plus .ht-menu > [data-learning-library]').length,1);
});

test('Home keeps every filter behind one Filter control; Format waits until it is connected',async t=>{
 const f=fixture(t);
 await f.click('[data-ht-home]');
 const d=f.w.document.querySelector('#project-library'),filter=d.querySelector('.ht-facets>details.ht-filter');
 assert.ok(filter,'one Filter control');assert.equal(filter.open,false,'closed until asked');
 assert.equal(d.querySelector('.ht-fgroup[aria-label="Format"]'),null);
 assert.ok(filter.querySelector('[data-ht-folder]')&&filter.querySelector('[data-ht-status-filter]')&&filter.querySelector('[data-ht-show]'),'brand, status and show are kept inside it');
});
