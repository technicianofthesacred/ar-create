import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const library=fs.readFileSync(new URL('./project-library.js',import.meta.url),'utf8'),tabs=fs.readFileSync(new URL('./home-tabs.js',import.meta.url),'utf8');

function fixture(){
 const dom=new JSDOM('<div id="app"><aside class="rail"></aside><main id="workspace"><div class="topbar"></div><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
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

test('current piece gets a tab; an output tab replaces the bare piece tab; tabs survive in browser state',async()=>{
 const f=fixture();
 assert.deepEqual(f.keys(),['p0::']);
 assert.ok(f.w.document.querySelector('#c3-tabstrip [data-ht-tab="p0::"][aria-current=page]'));
 f.select('p0','o-a');
 assert.deepEqual(f.keys(),['p0::o-a']);
 assert.match(f.w.document.querySelector('#c3-tabstrip .ht-tab.on').textContent,/Kiln article/);
 assert.ok(f.saves>0);
});

test('opening a tab of another piece goes through the existing project, output and Write owners',async()=>{
 const f=fixture();
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'o-d',title:'Gate essay',format:'Article'});f.w.homeTabs.paint();
 await f.click('[data-ht-tab="p7::o-d"]');
 assert.equal(f.w.current().id,'p7');
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[['switchProject','p7'],['selectOutput','p7','o-d'],['onAction','p7','o-d','native'],['viewPhase',5]]);
 f.calls.length=0;
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'o-c',title:'Seven slides',format:'Carousel'});f.w.homeTabs.paint();
 await f.click('[data-ht-tab="p7::o-c"]');
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[['selectOutput','p7','o-c'],['onAction','p7','o-c','words']]);
});

test('a failed save refuses tab switch, tab close, Home and Research without replacing the editor',async()=>{
 const f=fixture();
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

test('closing a tab only forgets the tab: no project, output or filing data changes',async()=>{
 const f=fixture();
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

test('an output that no longer exists says so and deletes nothing',async()=>{
 const f=fixture();
 f.w.state.projectNavigation.openTabs.push({projectId:'p7',outputId:'gone',title:'Old draft',format:'Article'});f.w.homeTabs.paint();
 await f.click('[data-ht-tab="p7::gone"]');
 assert.match(f.w.document.querySelector('[data-ht-status]').textContent,/no longer an output.*nothing was deleted/);
 assert.ok(f.keys().includes('p7::gone'));
 assert.equal(f.calls.some(c=>c[0]==='selectOutput'),false);
});

test('Home is the existing library full screen: strip inside, facet counts, status narrowing, editor kept',async()=>{
 const f=fixture(),editor=f.w.document.querySelector('#manuscript');
 await f.click('[data-ht-home]');
 const d=f.w.document.querySelector('#project-library');
 assert.equal(d.open,true);
 assert.ok(d.classList.contains('c3-home'));
 assert.equal(f.w.document.querySelector('#c3-tabstrip').parentElement,d);
 assert.ok(d.querySelector('[data-ht-home][aria-current=page]'));
 const facet=(attr,value)=>d.querySelector(`[${attr}="${value}"]`);
 assert.match(facet('data-ht-show','active').textContent,/120/);
 assert.match(facet('data-ht-folder','Tea').textContent,/60/);
 assert.match(facet('data-ht-status-filter','Writing').textContent,/40/);
 assert.match(d.querySelector('[data-pl-count]').textContent,/120 projects/);
 await f.click('#project-library [data-ht-status-filter="Writing"]');
 assert.match(d.querySelector('[data-pl-count]').textContent,/40 projects/);
 await f.click('#project-library [data-ht-folder="Tea"]');
 assert.match(d.querySelector('[data-pl-count]').textContent,/60 projects/);
 await f.click('#project-library [data-ht-view="list"]');
 assert.equal(d.querySelector('[data-pl-results]').classList.contains('ht-grid'),false);
 assert.equal(f.w.state.projectNavigation.homeView,'list');
 await f.click('#project-library [data-pl-close]');
 assert.equal(d.open,false);
 assert.equal(f.w.document.querySelector('#c3-tabstrip').parentElement,f.w.document.body);
 assert.equal(f.w.document.querySelector('#manuscript'),editor);
 assert.equal(editor.textContent,'Unsaved human writing');
});

test('opening a piece from Home keeps the library open/switch path and gives the piece a tab',async()=>{
 const f=fixture();
 await f.click('[data-ht-home]');
 await f.click('#project-library [data-pl-open="p10"]');
 assert.equal(f.w.current().id,'p10');
 assert.equal(f.w.document.querySelector('#project-library').open,false);
 assert.ok(f.keys().includes('p10::'));
});

test('existing global hooks stay callable after install',()=>{
 const f=fixture();
 for(const name of ['switchProject','render','viewPhase','save','projectBrowser'])assert.equal(typeof f.w[name],'function',name);
 assert.equal(typeof f.w.projectLibrary.open,'function');
});
