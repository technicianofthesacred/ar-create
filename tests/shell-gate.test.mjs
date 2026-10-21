// Regression gate for the AR Create shell (review A12): three persistent regions and one bar, exactly one primary
// action per screen, all twelve steps reachable from the phone sheet, and none of the removed bars coming back.
// The real chrome scripts run in jsdom over a minimal study page; layout facts jsdom cannot measure (horizontal
// overflow at 390px) are checked in a browser by tests/ui-gate.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const dir=new URL('../public/document-study/',import.meta.url),read=f=>fs.readFileSync(new URL(f,dir),'utf8');
const NAMES=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
const SCRIPTS=['workspace-navigation.js','shell.js','piece-state.js','checkpoint-rail.js','surface-bar.js','inspector.js','canvas-c3.js','empty-states.js','tree.js'];
function page(stage){
 const steps=NAMES.map((n,i)=>`<button class="workflowStep" aria-label="View step ${i+1}: ${n}" onclick="viewPhase(${i+1})"><span class="stepNumber">${i+1}</span><span class="stepName">${n}</span></button>`).join('');
 const work=stage===5?`<nav class="workbar"><button onclick="undo()">Undo</button><button onclick="openInstruction()">Ask about words</button><button onclick="modal='history';render()">History</button><span class="saved">Saved 07:05</span></nav><div class="desk"><article class="document"><div id="manuscript" contenteditable="true">Words in the draft.</div></article><aside class="margin" id="margin"><div class="marginHint">Select a phrase.</div></aside></div>`
  :`<div class="historicalToolbar"><span>Read-only snapshot · working copy kept separate</span><button onclick="setView('article')">Open the draft</button></div><section class="phaseReader"><article class="recordPage"><h2>${NAMES[stage-1]}</h2><p>Retained record.</p></article></section>`;
 return `<div class="shell"><nav class="workflowNavigation"><div class="workflowLegend"></div><div class="workflowSteps">${steps}</div></nav><main class="workspace" id="workspace"><header class="topbar"><h1>Piece</h1><span class="status">Draft</span><a class="i64-return" href="http://127.0.0.1:8888/ar-create">i64 OS</a></header>${work}</main></div>`;
}
function boot(stage){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.state={project:'p1',projects:[{id:'p1',name:'Piece',status:'Draft',view:stage===5?'article':'record',viewedStage:stage,blocks:[{tag:'p',html:'Words in the draft.'}],rev:1}],projectNavigation:{recent:[],openTabs:[]}};
 w.eval(`var state=window.state;var modal=null;var phaseReader=function(){return ""};function current(){return state.projects.find(p=>p.id===state.project)}function save(){}function undo(){}function openInstruction(){}function setView(v){current().view=v;render()}function render(){document.getElementById('app').innerHTML=(${page.toString()})(current().view==='article'?5:Number(current().viewedStage))}var NAMES=${JSON.stringify(NAMES)};${page.toString()}function viewPhase(n){const p=current();p.viewedStage=n;p.view=n===5?'article':'record';window.phases=(window.phases||[]).concat(n);render()}window.current=current;window.render=render;window.viewPhase=viewPhase;window.setView=setView;window.save=save;`);
 w.render();
 for(const f of SCRIPTS)w.eval(read(f));
 w.render();
 return {w,d:w.document};
}
const visibleRegion=(d,sel)=>[...d.querySelectorAll(sel)].some(n=>!n.hidden&&!n.closest('[hidden],[data-c3-empty-hidden]'));
function regions(d){
 return {sidebar:visibleRegion(d,'#app>.shell>nav.workflowNavigation.c3-rail'),bar:visibleRegion(d,'#c3-surface-bar'),inspector:visibleRegion(d,'#c3-read-insp,.desk>#c3-insp-head'),
  removed:['#c3-path','#c3-queue','#c3-crumb'].filter(s=>d.querySelector(s)),strip:[...d.querySelectorAll('#c3-tabstrip')].some(n=>!n.closest('nav.workflowNavigation'))};
}

test('every step: at most three persistent regions plus the bar, and none of the removed bars',async()=>{
 for(let n=1;n<=12;n++){
  const {d}=boot(n);await new Promise(r=>setTimeout(r,0));
  const r=regions(d);
  assert.deepEqual(r.removed,[],`step ${n}: path strip, pieces column and bottom bar stay gone`);
  assert.equal(r.strip,false,`step ${n}: no tab row of its own`);
  assert.ok(r.sidebar&&r.bar,`step ${n}: sidebar and bar`);
  const count=[r.sidebar,true,r.inspector].filter(Boolean).length; // sidebar, work column, inspector
  assert.ok(count<=3,`step ${n}: ${count} regions`);
  assert.equal(r.inspector,[5,6].includes(n),`step ${n}: the inspector only where passages are anchored`);
 }
});

test('every step: exactly one primary action, and the bar has no second filled button',async()=>{
 for(let n=1;n<=12;n++){
  const {d}=boot(n);await new Promise(r=>setTimeout(r,0));
  assert.equal(d.querySelectorAll('.sb-primary').length,1,`step ${n}`);
 }
});

test('phone: the step name opens the sidebar sheet and every one of the twelve steps is reachable from it',async()=>{
 const {w,d}=boot(5);
 for(let n=1;n<=12;n++){
  const picker=d.querySelector('.workflowNavigation .cr-picker');assert.ok(picker,'the bar’s step name opens the sheet');
  picker.click();assert.ok(d.querySelector('.workflowNavigation.cr-open'),'sheet open');
  const step=[...d.querySelectorAll('.workflowNavigation.cr-open .workflowStep')].find(b=>b.querySelector('.stepNumber').textContent==String(n));
  assert.ok(step,`step ${n} in the sheet`);step.click();await new Promise(r=>setTimeout(r,0));
 }
 assert.deepEqual(JSON.parse(JSON.stringify(w.phases)).slice(-12),[1,2,3,4,5,6,7,8,9,10,11,12]);
 const css=read('checkpoint-rail.css');
 assert.match(css,/\.workflowNavigation\.c3-rail\.cr-open \.workflowSteps\[data-work-groups\]\{position:static!important;display:flex!important/,'the open sheet shows the steps');
 assert.match(css,/\.workflowNavigation\.c3-rail\.cr-open>#c3-tabstrip\{display:flex!important\}/,'Home and the piece switcher travel with the sheet');
});

test('the gate fails on a fourth bar: an extra persistent bar is caught',async()=>{
 const {d}=boot(8);
 d.querySelector('.workspace').insertAdjacentHTML('afterbegin','<nav id="c3-path">Before an output</nav>');
 assert.deepEqual(regions(d).removed,['#c3-path']);
});

test('the chrome mounts through one shell render, not one render patch per layer',()=>{
 for(const f of ['checkpoint-rail.js','surface-bar.js','inspector.js','canvas-c3.js','empty-states.js','tree.js'])
  assert.doesNotMatch(read(f),/window\.render=function/,f+' registers with c3Shell instead of wrapping render');
});
