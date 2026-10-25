import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./inspector.js',import.meta.url),'utf8');
const page=(record)=>`<main class="workspace">${record===null?'':`<div id="downstream-human-direction">${record}</div>`}<div class="desk"><article class="document" id="doc"><div id="manuscript" contenteditable="true">Unsaved human writing</div></article><aside class="margin" id="margin"><div class="discussion">Pending correction · Approve these words</div></aside></div></main>`;
function fixture(record='Direction: open with the gate'){
 const dom=new JSDOM(`<div id="app">${page(record)}</div>`,{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 w.state={project:'p1',projects:[{id:'p1',name:'Piece'}]};w.current=()=>w.state.projects[0];
 let saves=0;w.save=()=>{saves++;};w.phases=[];w.viewPhase=n=>{w.phases.push(n);};
 w.render=()=>{w.document.getElementById('app').innerHTML=page(record);};
 w.eval(fs.readFileSync(new URL('./shell.js',import.meta.url),'utf8'));w.eval(code);
 return {w,d:w.document,get saves(){return saves;}};
}
test('tabs sit above the margin; the margin node and its notes are untouched and stay in place',()=>{
 const f=fixture(),desk=f.d.querySelector('.desk'),margin=f.d.getElementById('margin');
 assert.equal(f.d.getElementById('c3-insp-head').nextElementSibling,margin);
 assert.equal(margin.parentElement,desk);
 assert.match(margin.textContent,/Approve these words/);
 assert.deepEqual(JSON.parse(JSON.stringify([...f.d.querySelectorAll('[data-ci-tab]')].map(b=>[b.textContent,b.getAttribute('aria-selected')]))),[['Margin','true'],['Decisions','false']]);
});
test('Decisions shows the owner’s direction record (moved by id, not copied); empty record says so',()=>{
 const f=fixture();
 f.d.querySelector('[data-ci-tab="decisions"]').click();
 assert.equal(f.d.querySelector('.desk').dataset.insp,'decisions');
 assert.equal(f.d.querySelectorAll('#downstream-human-direction').length,1);
 assert.equal(f.d.getElementById('downstream-human-direction').parentElement.id,'c3-insp-decisions');
 const g=fixture('');
 assert.match(g.d.querySelector('#c3-insp-decisions .ci-empty').textContent,/No saved direction/);
});
test('no Readiness tab: checks live on Check, export readiness on Audience',()=>{
 const f=fixture();
 assert.equal(f.d.querySelector('[data-ci-tab="readiness"]'),null);
 assert.equal(f.d.getElementById('c3-insp-readiness'),null);
});
test('a sample proposal never opens by itself; shown on request, it says Sample',()=>{
 const f=fixture();
 f.d.getElementById('margin').insertAdjacentHTML('beforeend','<section class="discussion" id="discussion"><div class="tag">Sample · not a live AI response</div><button class="primary">Accept</button></section>');
 f.w.c3Inspector.decorate();
 const d=f.d.getElementById('discussion');assert.equal(d.hidden,true,'not auto-opened');
 const gate=f.d.querySelector('.ci-sample-gate');assert.match(gate.querySelector('.ci-badge').textContent,/Sample/);
 gate.querySelector('[data-ci-sample]').click();
 return new Promise(r=>setTimeout(r,0)).then(()=>{assert.equal(d.hidden,false);assert.equal(f.d.querySelector('.ci-sample-gate'),null);assert.ok(d.classList.contains('ci-sample'));});
});
test('the chosen tab survives a full render; the editor is never replaced by the inspector',()=>{
 const f=fixture();
 f.d.querySelector('[data-ci-tab="decisions"]').click();
 f.w.render();
 assert.equal(f.d.querySelector('.desk').dataset.insp,'decisions');
 assert.equal(f.d.querySelector('#manuscript').textContent,'Unsaved human writing');
});

test('Understanding keeps the original direction owner while its Workbench drawer is open',()=>{
 const f=fixture(),record=f.d.getElementById('downstream-human-direction'),drawer=f.d.createElement('aside');drawer.id='wbf-drawer';f.d.body.append(drawer);drawer.append(record);f.w.c3Inspector.decorate();assert.strictEqual(record.parentElement,drawer);assert.equal(f.d.querySelectorAll('#downstream-human-direction').length,1);f.w.close();
});
