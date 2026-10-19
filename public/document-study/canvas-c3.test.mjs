import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./canvas-c3.js',import.meta.url),'utf8');
const pages={
 5:'<main class="workspace"><div class="desk"><article class="document"><h1>Piece</h1><div id="manuscript" contenteditable="true">Unsaved human writing</div></article></div></main>',
 6:'<main class="workspace"><section class="phaseReader"><article class="recordPage"><h2>Piece</h2><div class="recordBody">Read words</div></article></section></main>',
1:'<main class="workspace"><section class="phaseReader flow-stage"><article class="recordPage flow-paper" id="stage-working-lane"><header class="flow-lane-head">Current material</header><div class="material-surface"><button data-flow-action="files">Add files</button></div></article></section></main>',
 7:'<main class="workspace"><div class="wn-check-layout"><section class="wn-check-manuscript"><article class="document"><h1>Piece</h1></article></section><aside class="wn-check-findings"><button data-current-check="run">Check saved draft</button></aside></div></main>'};
function fixture(stage){
 const dom=new JSDOM(`<div id="app">${pages[stage]}</div>`,{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 w.state={project:'p1',projects:[{id:'p1',name:'Piece',view:stage===5?'article':'record',viewedStage:stage}]};w.current=()=>w.state.projects[0];
 w.phases=[];w.viewPhase=n=>w.phases.push(n);w.save=()=>{};let builds=0;w.surfaceBar={build:()=>builds++};w.render=()=>{w.document.getElementById('app').innerHTML=pages[stage];};
 w.eval(code);return {w,d:w.document,get builds(){return builds;}};
}
test('Write gets the board heading line inside the document, above the title; the editor is untouched',()=>{
 const f=fixture(5),t=f.d.querySelector('.document>.c3-ctitle');
 assert.match(t.textContent,/05\s*Write\s*The same manuscript as Read and Check/);
 assert.equal(t.nextElementSibling.tagName,'H1');
 assert.equal(f.d.querySelector('#manuscript').textContent,'Unsaved human writing');
});
test('Read gets the heading and an inspector that only points to where the work happens',()=>{
 const f=fixture(6);
 assert.match(f.d.querySelector('.phaseReader>.c3-ctitle').textContent,/06\s*Read/);
 const side=f.d.querySelector('#c3-read-insp');
 assert.ok(side);
 side.querySelector('[data-c3-go="5"]').click();
 side.querySelector('[data-c3-tab="readiness"]').click();
 f.d.querySelector('#c3-read-insp [data-c3-go="7"]').click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.phases)),[5,7]);
 assert.equal(f.d.querySelectorAll('#c3-read-insp textarea,#c3-read-insp input').length,0,'no field that would pretend to save');
});
test('Check with a loaded manuscript: heading above the manuscript, panel kept, bar asked to pick up the run button',()=>{
 const f=fixture(7);
 assert.match(f.d.querySelector('.wn-check-manuscript>.c3-ctitle').textContent,/07\s*Check/);
 assert.ok(f.d.querySelector('.wn-check-layout.c3-check .wn-check-findings [data-current-check="run"]'));
 assert.ok(f.builds>=1);
});
test('a full render is decorated again without duplicate headings',()=>{
 const f=fixture(5);f.w.render();f.w.c3Canvas.decorate();f.w.c3Canvas.decorate();
 assert.equal(f.d.querySelectorAll('.c3-ctitle').length,1);
});

test('Material gets the heading, the flattened lane and an inspector that opens on Decisions',()=>{
 const f=fixture(1);
 assert.match(f.d.querySelector('.phaseReader>.c3-ctitle').textContent,/01\s*Material\s*Shared by every output/);
 assert.ok(f.d.querySelector('.phaseReader.c3-flow'));
 assert.equal(f.d.querySelector('#c3-read-insp [aria-selected="true"]').textContent,'Decisions');
 assert.ok(f.d.querySelector('[data-flow-action="files"]'),'the lane keeps its own add button');
});
