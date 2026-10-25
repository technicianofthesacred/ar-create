import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');

function fixture({phone=false,home='',panel=false}={}){
 const dom=new JSDOM(`<body class="wbf-on"><div id="app"><div class="shell"><nav class="workflowNavigation c3-rail"><button class="tr-home" data-tr-home><svg></svg><span class="tr-label">Bench</span></button><div class="workflowSteps"><div class="wn-family" data-family="make"><div class="wn-family-steps"><button class="wbf-pieces"><svg></svg><span class="stepName">Pieces</span></button><button id="write" class="workflowStep" aria-current="step"><svg class="cr-icon"></svg><span class="stepNumber">5</span><span class="stepName">Write</span></button><button id="read" class="workflowStep"><svg class="cr-icon"></svg><span class="stepNumber">6</span><span class="stepName">Read</span></button></div></div></div></nav><main id="workspace"></main></div></div><dialog id="project-library" ${home?'open':''} ${home==='pieces'?'data-workbench-pieces="true"':''}></dialog></body>`,{url:'http://localhost',runScripts:'outside-only'});
 const w=dom.window,d=w.document;
 w.current=()=>({view:'article',viewedStage:5});
 w.matchMedia=()=>({matches:phone,addEventListener(){}});
 w.c3Shell={register(_name,decorate){decorate();}};
 d.body.dataset.wbfHome=home;
 w.eval(read('workbench-rail.js'));
 if(panel)d.body.classList.add('wb-panel-on');
 const style=d.createElement('style');style.textContent=read('workbench-rail.css');d.head.append(style);
 // Inspect native CSSOM selectors against the actual rail decorator DOM. jsdom
 // does not render media queries or resolve color-mix; native screen proof covers
 // the final cascade and theme contrast.
 function rules(list=style.sheet.cssRules){return [...list].flatMap(rule=>rule.cssRules?rules(rule.cssRules):rule.selectorText?[rule]:[]);}
 const fills=rules().filter(rule=>rule.style.getPropertyValue('background')==='var(--wb-current)');
 return {w,d,close:()=>w.close(),filled:()=>[...d.querySelectorAll('.workflowStep,.tr-home,.wbf-pieces,.wb-bb')].filter(node=>fills.some(rule=>node.matches(rule.selectorText)))};
}

test('C02: full current tile targets Write with a panel open or closed, never another step',()=>{
 for(const panel of [false,true]){const f=fixture({panel});try{
  const selected=f.filled();assert.ok(selected.includes(f.d.querySelector('#write')));assert.ok(!selected.includes(f.d.querySelector('#read')));
  assert.equal(f.d.querySelector('#write').getAttribute('aria-current'),'step');
  const style=f.w.getComputedStyle(f.d.querySelector('#write'));assert.equal(style.background,'var(--wb-current)');assert.equal(style.color,'var(--ink)');
  for(const child of f.d.querySelectorAll('#write svg,#write .stepName'))assert.equal(f.w.getComputedStyle(child).color,'inherit');
 }finally{f.close();}}
});

test('C02: Bench and Pieces suppress a retained section current marker',()=>{
 for(const home of ['bench','pieces']){const f=fixture({home,panel:true});try{
  const current=f.filled();assert.ok(!current.includes(f.d.querySelector('#write')));
  assert.ok(current.includes(f.d.querySelector(home==='bench'?'[data-tr-home]':'.wbf-pieces')));
  assert.equal(f.d.querySelector('#write').getAttribute('aria-current'),'step','selection styling preserves the owner marker');
 }finally{f.close();}}
});

test('C05: phone current family fills its icon and label while browsing another family does not claim current',()=>{
 const f=fixture({phone:true});try{
  const nav=f.d.querySelector('nav');nav.classList.add('cr-open');nav.dataset.wbGroup='gather';f.w.c3Workbench.decorate();
  const make=f.d.querySelector('.wb-bb[data-wb-group="make"]'),gather=f.d.querySelector('.wb-bb[data-wb-group="gather"]');
  assert.ok(f.filled().includes(make));assert.ok(!f.filled().includes(gather));assert.equal(gather.getAttribute('aria-expanded'),'true');assert.ok(!gather.hasAttribute('data-here'));
  assert.ok(make.querySelector('svg'));assert.equal(make.querySelector('span').textContent,'Make');
 }finally{f.close();}
});

test('C05: phone Bench and Pieces show their real current destination, not the retained Write group',()=>{
 for(const home of ['bench','pieces']){const f=fixture({phone:true,home});try{
  const current=f.filled().filter(node=>node.classList.contains('wb-bb'));
  assert.equal(current.length,1);assert.ok(current[0].matches(home==='bench'?'[data-wb-home]':'[data-wb-group="make"]'));
 }finally{f.close();}}
});
