import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./empty-states.js',import.meta.url),'utf8');
const pages={
 12:'<main class="workspace"><div class="c3-ctitle c3-ws-title">12 Outputs</div><section id="output-overview"><div class="oo-panel"><div class="oo-empty">No connected outputs yet.</div></div></section><section id="work-context"><button data-wn-create="article" onclick="calls.push(\'create-article\')">Article</button><button data-wn-create="carousel" disabled title="Open an owned working manuscript first">Carousel</button></section></main>',
 12.5:'<main class="workspace"><div class="c3-ctitle c3-ws-title">12 Outputs</div><section id="output-overview"><div class="oo-panel"><article class="oo-row">Clay article</article></div></section></main>',
 11:'<main class="workspace"><div class="c3-ctitle c3-ws-title">11 Share</div><section class="oss-surface"><textarea data-oss-field="message"></textarea></section></main>'};
function fixture(stage,page=stage){
 const dom=new JSDOM(`<div id="app">${pages[page]}</div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.calls=[];w.state={project:'p1',projects:[{id:'p1',name:'Piece',view:'record',viewedStage:Math.floor(stage)}]};w.current=()=>w.state.projects[0];
 w.viewPhase=n=>w.calls.push('phase:'+n);w.render=()=>{};
 w.eval(code);return {w,d:w.document};
}
const json=v=>JSON.parse(JSON.stringify(v));
test('an empty step shows the shape, the card and its steps, and hides only the terse empty text',()=>{
 const {d}=fixture(12);
 const block=d.querySelector('.c3-empty');
 assert.ok(block);
 assert.equal(block.previousElementSibling.className.includes('c3-ws-title'),true);
 assert.match(block.querySelector('h3').textContent,/No outputs made yet/);
 assert.equal(block.querySelectorAll('.ce-shape .ce-row').length,3);
 assert.equal(block.querySelectorAll('.ce-step').length,3);
 assert.ok(d.querySelector('#output-overview').hasAttribute('data-c3-empty-hidden'));
 assert.ok(d.querySelector('#output-overview .oo-empty'),'the owner text is kept, only hidden');
});
test('card buttons press the real controls; a disabled control stays disabled with its own reason',()=>{
 const {w,d}=fixture(12);
 const btns=[...d.querySelectorAll('.c3-empty .ce-btn')];
 assert.deepEqual(json(btns.map(b=>[b.textContent,b.disabled])),[['New article',false],['New carousel',true],['Continue writing',false]]);
 assert.equal(btns[1].title,'Open an owned working manuscript first');
 btns[0].click();btns[2].click();
 assert.deepEqual(json(w.calls),['create-article','phase:5']);
});
test('a step with content shows no empty card and hides nothing',()=>{
 const {d}=fixture(12,12.5);
 assert.equal(d.querySelector('.c3-empty'),null);
 assert.equal(d.querySelectorAll('[data-c3-empty-hidden]').length,0);
});
test('Share: a quiet card until you start writing, then it gets out of the way',async()=>{
 const {w,d}=fixture(11);
 assert.ok(d.querySelector('.c3-empty.ce-compact'));
 const m=d.querySelector('[data-oss-field="message"]');
 m.value='Hello';m.dispatchEvent(new w.Event('input',{bubbles:true}));
 await new Promise(r=>setTimeout(r,0));
 assert.equal(d.querySelector('.c3-empty'),null);
});
test('every one of the twelve steps has an empty state with a real next step and no invented content',()=>{
 const {w}=fixture(12);
 const steps=w.c3Empty.steps;
 assert.deepEqual(json(Object.keys(steps).map(Number)),[1,2,3,4,5,6,7,8,9,10,11,12]);
 for(const [n,s] of Object.entries(steps)){
  assert.ok(s.title&&s.text,'words for '+n);
  assert.ok(s.actions.length>=1&&s.actions.some(a=>a[2]),'a primary next step for '+n);
  assert.doesNotMatch(s.text,/Lin Wei|kiln-gate|Clay That/i,'no invented content in '+n);
 }
});
