import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./margin-fold.js',import.meta.url),'utf8');
const bar='<header id="c3-surface-bar"><div class="sb-right"><button type="button" class="sb-btn sb-focus"><span>Focus</span></button><button type="button">More</button></div></header>';
function fixture({stage='5',mid=true,pref=null,margin=true}={}){
 const dom=new JSDOM(`<div id="app"><main id="workspace">${bar}<div class="desk"><article class="document">Words</article>${margin?'<aside id="margin"><p>Notes</p></aside>':''}</div></main></div>`,{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.document.body.className='wbf-on';w.document.body.dataset.c3Stage=stage;
 w.matchMedia=()=>({matches:mid,addEventListener(){}});
 w.Element.prototype.getClientRects=function(){return [{}];};
 if(pref)w.localStorage.setItem('ar-margin-fold-v1',pref);
 w.eval(code);
 return {w,d:w.document};
}
const tick=()=>new Promise(r=>setTimeout(r,10));

test('on a mid-width window the margin starts folded, with one Margin button before Focus',()=>{
 const {d}=fixture();
 const b=d.querySelector('[data-ar-fold="toggle"]');
 assert.ok(b);assert.equal(b.textContent,'Margin');assert.equal(b.nextElementSibling.textContent,'Focus');
 assert.equal(b.getAttribute('aria-expanded'),'false');assert.equal(b.getAttribute('aria-controls'),'margin');
 assert.equal(d.body.dataset.arFold,'closed');
});

test('opening moves focus into the sheet, remembers the choice, and Escape folds it back to the button',()=>{
 const {w,d}=fixture();
 d.querySelector('[data-ar-fold="toggle"]').click();
 assert.equal(d.body.dataset.arFold,'open');
 assert.equal(d.querySelector('[data-ar-fold="toggle"]').getAttribute('aria-expanded'),'true');
 assert.equal(d.activeElement,d.querySelector('#margin>.ar-fold-close'));
 assert.equal(w.localStorage.getItem('ar-margin-fold-v1'),'open');
 let reachedEditor=0;d.addEventListener('keydown',()=>reachedEditor++);
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(reachedEditor,0);
 assert.equal(d.body.dataset.arFold,'closed');
 assert.equal(d.activeElement,d.querySelector('[data-ar-fold="toggle"]'));
 assert.equal(d.querySelector('#margin>.ar-fold-close').hidden,true);
});

test('the Close button inside the sheet folds it, and a remembered open choice opens it again',()=>{
 const {d}=fixture({pref:'open'});
 assert.equal(d.body.dataset.arFold,'open');
 d.querySelector('#margin>.ar-fold-close').click();
 assert.equal(d.body.dataset.arFold,'closed');
});

test('nothing folds on wide or narrow windows, outside Write/Read/Check, in Focus, or without a margin',()=>{
 for(const opts of [{mid:false},{stage:'3'},{margin:false}]){
  const {d}=fixture(opts);
  assert.equal(d.querySelector('[data-ar-fold="toggle"]'),null);assert.equal(d.body.dataset.arFold,undefined);
 }
 const {w,d}=fixture();d.body.dataset.draftFocus='true';w.arMarginFold.decorate();
 assert.equal(d.querySelector('[data-ar-fold="toggle"]'),null);assert.equal(d.body.dataset.arFold,undefined);
});

test('a redrawn heading row gets the button back once, never twice',async()=>{
 const {d}=fixture();
 d.getElementById('c3-surface-bar').innerHTML='<div class="sb-right"><button type="button" class="sb-btn sb-focus"><span>Focus</span></button></div>';
 await tick();
 assert.equal(d.querySelectorAll('[data-ar-fold="toggle"]').length,1);
 d.getElementById('c3-surface-bar').innerHTML+='';await tick();
 assert.equal(d.querySelectorAll('[data-ar-fold="toggle"]').length,1);
});
