import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./checkpoint-rail.js',import.meta.url),'utf8');
const families=[['Gather',[1,2]],['Develop',[3,4]],['Make',[5,6,7,8,9]],['Deliver',[10,11,12]]],names=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];

// The grouped bar as study.js workflowBar + its wrappers + workspace-navigation group() leave it.
function grouped({count=12,current=6,record=[3]}={}){
 const step=n=>`<button class="workflowStep ${n===current?'isCurrent':''}" aria-label="View step ${n}: Original ${n} (read-only)" title="Original ${n} · retained" onclick="viewPhase(${n})"><span class="stepNumber">${n}</span><span class="stepName">${names[n-1]}</span>${record.includes(n)?'<i class="recordDot" aria-hidden="true"></i>':''}${n===current?'<span class="currentMark">current</span>':''}</button>`;
 const fam=families.map(([label,steps])=>`<section class="wn-family" data-family="${label.toLowerCase()}" aria-label="${label}"><span class="wn-family-label">${label}</span><div class="wn-family-steps">${steps.filter(n=>n<=count).map(step).join('')}</div></section>`).join('');
 return `<div class="shell"><aside class="rail"></aside><main class="workspace" id="workspace"><header class="topbar"><h1>Piece</h1></header><nav class="workflowNavigation" aria-label="Creative workspace"><div class="workflowLegend" hidden></div><div class="workflowSteps" data-work-groups="true">${fam}</div></nav><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>`;
}
function fixture(opts){
 const dom=new JSDOM(`<div id="app">${grouped(opts)}</div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.state={project:'p1',projects:[{id:'p1',name:'Piece',view:'record',viewedStage:5}]};
 w.current=()=>w.state.projects[0];
 w.phases=[];w.viewPhase=n=>w.phases.push(n);
 w.render=()=>{w.document.getElementById('app').innerHTML=grouped(opts);};
 w.eval(code);
 return {dom,w,d:w.document};
}

test('the twelve grouped buttons move, unchanged, into a column before the workspace',()=>{
 const {w,d}=fixture(),before=[...d.querySelectorAll('.workflowStep')];
 const snapshot=before.map(b=>[b.getAttribute('onclick'),b.getAttribute('aria-label'),b.title,b.querySelector('.stepNumber').textContent]);
 w.checkpointRail.decorate();
 const nav=d.querySelector('.workflowNavigation');
 assert.equal(nav.parentElement,d.querySelector('#app>.shell'));
 assert.equal(nav.nextElementSibling,d.querySelector('.workspace'));
 assert.ok(nav.classList.contains('c3-rail'));
 const after=[...d.querySelectorAll('.workflowStep')];
 assert.equal(after.length,12);
 after.forEach((b,i)=>{assert.equal(b,before[i],'same button node');assert.deepEqual([b.getAttribute('onclick'),b.getAttribute('aria-label'),b.title,b.querySelector('.stepNumber').textContent],snapshot[i]);});
 assert.equal(d.querySelectorAll('.workflowStep .cr-icon').length,12);
 assert.deepEqual([...d.querySelectorAll('.wn-family')].map(f=>f.getAttribute('aria-label')),['Gather','Develop','Make','Deliver']);
});

test('every checkpoint still calls viewPhase(n) directly; groups are not gates',()=>{
 const {w,d}=fixture();
 for(const b of d.querySelectorAll('.workflowStep'))b.click();
 assert.deepEqual(JSON.parse(JSON.stringify(w.phases)),[1,2,3,4,5,6,7,8,9,10,11,12]);
 assert.equal(d.querySelectorAll('.workflowStep[disabled]').length,0);
});

test('state dot reads existing evidence only: current step, retained record, or none',()=>{
 const {d}=fixture({current:6,record:[3]});
 const dot=n=>[...d.querySelectorAll('.workflowStep')].find(b=>b.querySelector('.stepNumber').textContent==String(n)).querySelector('.cr-dot').dataset.state;
 assert.equal(dot(6),'current');
 assert.equal(dot(3),'record');
 assert.equal(dot(9),'none');
});

test('the phone picker names the viewed checkpoint and opens and closes the list',()=>{
 const {w,d}=fixture();
 const picker=d.querySelector('.cr-picker');
 assert.match(picker.textContent,/Step 5 of 12/);
 assert.match(picker.textContent,/Write/);
 picker.click();
 assert.ok(d.querySelector('.workflowNavigation').classList.contains('cr-open'));
 assert.equal(picker.getAttribute('aria-expanded'),'true');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(d.querySelector('.workflowNavigation').classList.contains('cr-open'),false);
});

test('a full re-render is decorated again; an incomplete bar is left where it was',()=>{
 const {w,d}=fixture();
 w.render();
 assert.equal(d.querySelector('.workflowNavigation').parentElement,d.querySelector('#app>.shell'));
 assert.equal(d.querySelector('#manuscript').textContent,'Unsaved human writing');
 const partial=fixture({count:11});
 partial.w.checkpointRail.decorate();
 assert.equal(partial.d.querySelector('.workflowNavigation').parentElement,partial.d.querySelector('.workspace'));
 assert.equal(partial.d.querySelectorAll('.cr-icon').length,0);
});
