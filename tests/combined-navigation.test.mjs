import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/combined-navigation.js',import.meta.url),'utf8');
function boot(n=5){
 const dom=new JSDOM('<header id="c3-tabstrip"><div class="wbf-top-actions"></div></header><div class="workflowNavigation wb-rail"><button data-tr-home>Old Home</button>'+Array.from({length:12},(_,i)=>`<button class="workflowStep"><span class="stepNumber">${i+1}</span></button>`).join('')+'</div><dialog id="project-library"></dialog>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document,p={view:'record',viewedStage:n,id:'kept'};
 const calls=[];w.current=()=>p;w.c3Shell={register(_name,fn){this.paint=fn;}};w.projectLibrary={async close(){calls.push('close');d.querySelector('dialog').removeAttribute('open');}};w.combinedSubjects={async open(){calls.push('subjects');d.querySelector('dialog').setAttribute('data-combined-subjects','');d.querySelector('dialog').setAttribute('open','');}};
 w.workspaceNavigation={async changeMode(mode){calls.push(mode);}};d.querySelector('[data-tr-home]').onclick=()=>calls.push('home');[...d.querySelectorAll('.workflowStep')].forEach((b,i)=>b.onclick=()=>calls.push('stage:'+String(i+1)));w.eval(code);return {w,d,p,calls,close:()=>w.close()};
}
test('Combined rail exposes exactly twelve entrances while retaining every original handler',async()=>{
 const f=boot();assert.deepEqual([...f.d.querySelectorAll('.combined-rail [data-combined-nav]')].map(n=>n.textContent),['Home','Subjects','Library','Source','Research','Direction','Check','Media','Arrange','Audience','Share','Outputs']);assert.equal(f.d.querySelectorAll('.workflowStep').length,12);
 await f.w.combinedNavigation.go('arrange');assert.deepEqual(f.calls,['stage:9']);await f.w.combinedNavigation.go('subjects');assert.deepEqual(f.calls,['stage:9','subjects']);assert.equal(f.d.querySelector('[data-combined-nav="subjects"]').getAttribute('aria-current'),'page');f.close();
});
test('piece Write and Read switch through the maintained selected-piece mode owner',async()=>{
 const f=boot();f.d.querySelector('[data-combined-mode="read"]').click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(f.calls,['read']);assert.equal(f.calls.some(c=>c==='stage:6'),false);
 f.w.workspaceNavigation.changeMode=async()=>{throw Error('Save refused');};f.d.querySelector('[data-combined-mode="write"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(f.d.querySelector('[role="status"]').textContent,'Save refused');assert.equal(f.p.id,'kept');f.close();
});
test('failed Home close prevents section opening and preserves the dialog',async()=>{
 const f=boot();f.d.querySelector('dialog').setAttribute('open','');f.w.projectLibrary.close=async()=>{throw Error('Resolve current changes');};assert.equal(await f.w.combinedNavigation.go('source'),false);assert.deepEqual(f.calls,[]);assert.equal(f.d.querySelector('dialog').open,true);assert.match(f.d.querySelector('[role="status"]').textContent,/Resolve/);f.close();
});
test('rail keyboard navigation changes focus, never the selected work',()=>{
 const f=boot(),b=f.d.querySelector('[data-combined-nav="home"]');b.focus();b.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(f.d.activeElement.dataset.combinedNav,'subjects');assert.deepEqual(f.calls,[]);assert.equal(f.p.viewedStage,5);f.close();
});

test('phone groups expose the same guarded entrances and Escape returns focus',async()=>{
 const f=boot(),button=f.d.querySelector('[data-combined-group="develop"]');button.click();assert.deepEqual([...f.d.querySelectorAll('#combined-phone-sheet button')].map(b=>b.textContent),['Library','Source','Research','Direction']);f.d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.d.querySelector('#combined-phone-sheet'),null);assert.equal(f.d.activeElement,button);assert.deepEqual(f.calls,[]);f.close();
});
