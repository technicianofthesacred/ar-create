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
function fixture(stage,page=stage,withState=false){
 const dom=new JSDOM(`<div id="app">${pages[page]}</div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.calls=[];w.state={project:'p1',projects:[{id:'p1',name:'Piece',view:'record',viewedStage:Math.floor(stage)}]};w.current=()=>w.state.projects[0];
 w.viewPhase=n=>w.calls.push('phase:'+n);w.render=()=>{};
 w.eval(fs.readFileSync(new URL('./shell.js',import.meta.url),'utf8'));if(withState)w.eval(fs.readFileSync(new URL('./piece-state.js',import.meta.url),'utf8'));w.eval(code);return {w,d:w.document};
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
 assert.deepEqual(json(btns.map(b=>[b.textContent,b.disabled])),[['New article',false],['New carousel',true],['Open the draft',false]]);
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

test('the empty card owns the screen: tool blocks beside it are hidden, notices and the title stay',()=>{
 const {d}=fixture(12);
 const ws=d.querySelector('.workspace');ws.insertAdjacentHTML('beforeend','<section class="mot-surface" data-media-outputs-tools="12"><button>Continue creating</button></section><p role="alert">Saved edition unavailable</p>');
 d.defaultView.c3Empty.decorate();
 assert.ok(d.querySelector('.mot-surface').hasAttribute('data-c3-empty-hidden'),'tools wait until there is content');
 assert.equal(d.querySelector('[role=alert]').hasAttribute('data-c3-empty-hidden'),false,'notices stay');
 assert.equal(d.querySelector('.c3-ws-title').hasAttribute('data-c3-empty-hidden'),false);
});
test('with the piece state, the card’s first button is the bar’s one primary and runs the same action',async()=>{
 const {w,d}=fixture(12,12,true);w.workspaceNavigation={outputs:()=>[]};w.c3Empty.decorate();
 const first=d.querySelector('.c3-empty .ce-btn');
 assert.equal(first.textContent,w.c3PieceState.primary(12).label);
 assert.ok(first.hasAttribute('data-ce-primary'));
 assert.equal([...d.querySelectorAll('.c3-empty .ce-btn')].filter(b=>b.textContent==='New article').length,0,'the step’s own primary is not repeated');
});
test('acting on a hidden tool from the card reveals the step for this visit',()=>{
 const {w,d}=fixture(12);
 d.querySelector('.workspace').insertAdjacentHTML('beforeend','<section class="tools"><details><summary>Write a note</summary><textarea></textarea></details></section>');
 w.c3Empty.steps[12].actions.push(['Write a note','summary:Write a note']);w.c3Empty.decorate();
 const b=[...d.querySelectorAll('.c3-empty .ce-btn')].find(x=>x.textContent==='Write a note');b.click();
 assert.equal(d.querySelector('.c3-empty'),null);assert.equal(d.querySelectorAll('[data-c3-empty-hidden]').length,0);
 assert.equal(d.querySelector('.tools details').open,true);
 w.c3Empty.decorate();assert.equal(d.querySelector('.c3-empty'),null,'stays revealed on this step');
});
test('one verb for going to the manuscript: every surface says Open the draft',()=>{
 const dir=new URL('./',import.meta.url),old=/Open writing draft|Open working words|Open Draft|Open Write|Open in Write|Continue writing|Continue to Draft|Open editor|Edit draft|Edit this copy/;
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js')&&!f.endsWith('.test.mjs')))assert.doesNotMatch(fs.readFileSync(new URL(f,dir),'utf8'),old,f);
});

test('C6: Share on a words-only piece with no one to invite says Not applicable with its one-line reason; the step stays one click away',()=>{
 const {w,d}=fixture(11);
 w.c3PieceState={notApplicable:n=>n===11?'This piece is words only and has no one recorded in it to invite.':'',primary:()=>({label:'Open Outputs',phase:12}),run:()=>{}};
 w.c3Empty.decorate();
 const card=d.querySelector('.c3-empty.ce-na');assert.ok(card);
 assert.match(card.querySelector('h3').textContent,/Not applicable to this piece/);assert.match(card.textContent,/no one recorded/);
 assert.equal(card.querySelector('[data-ce-primary]').textContent,'Open Outputs','its button is the bar’s primary');
 assert.ok(d.querySelector('.oss-surface').hasAttribute('data-c3-empty-hidden'));
 card.querySelector('[data-ce-anyway]').click();
 assert.equal(d.querySelector('.c3-empty'),null);assert.equal(d.querySelector('.oss-surface').hasAttribute('data-c3-empty-hidden'),false);
});
