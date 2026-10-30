import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');

for(const native of [false,true])test((native?'native findings':'actual-review retained records')+' Research shell settles with one owned scope and unchanged reader',async t=>{
 const content=native?'<article class="flow-paper"><div class="research-standard"><section data-research-point="one"><h2>Recorded finding</h2><p>Exact retained evidence.</p></section></div></article>':'<article class="recordPage"><h2>Research originals</h2><button data-original>Open exact original</button><textarea>Exact pending note</textarea></article>';
 const dom=new JSDOM('<div id="app"><main id="workspace" class="workspace"><section class="phaseReader'+(native?'':' ew-primary')+'">'+content+'</section></main></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,d=w.document;t.after(()=>w.close());
 const reader=d.querySelector('.phaseReader'),record=reader.firstElementChild,words=d.querySelector('textarea'),original=d.querySelector('[data-original]');let clicks=0;
 if(words){words.value='Unsaved exact human note';words.focus();words.setSelectionRange(3,9);words.scrollTop=7;}if(original)original.onclick=()=>clicks++;
 w.current=()=>({id:'hk',name:'Invented retained project',view:'record',viewedStage:3,referenceOnly:!native});w.render=()=>{};w.state={};w.c3Research={};
 w.eval(source('shell.js'));let passes=0;const register=w.c3Shell.register;
 // Bound a failing regression instead of starving the test runner with the loop.
 w.c3Shell.register=(name,fn,options)=>register(name,()=>{if(++passes<=40)fn();},options);
 w.eval(source('canvas-c3.js'));w.eval(source('workbench-surfaces.js'));
 await new Promise(resolve=>w.setTimeout(resolve,20));
 assert.ok(passes<20,'the combined mounts must settle, not reach the loop bound');if(native){assert.equal(d.querySelectorAll('.research-standard details,.research-standard summary').length,0);assert.equal(d.querySelector('.wb-point').tagName,'SECTION');assert.match(d.querySelector('.wb-point .rpd').textContent,/Exact retained evidence/);}assert.equal(d.querySelectorAll('.c3-scope').length,1);
 const scope=d.querySelector('.c3-scope'),parent=scope.parentElement;
 assert.ok(parent.matches('.rh'),'the scope retains its adopted Workbench heading');assert.equal(reader.contains(scope),native,'retained-reader fallback is outside the original reader');
 assert.strictEqual(d.querySelector('.phaseReader'),reader);assert.strictEqual(reader.firstElementChild===record?record:reader.querySelector(native?'.flow-paper':'.recordPage'),record);assert.match(record.textContent,/Exact retained evidence|Research originals/);
 if(words){assert.strictEqual(d.querySelector('textarea'),words);assert.equal(words.value,'Unsaved exact human note');assert.strictEqual(d.activeElement,words);assert.equal(words.selectionStart,3);assert.equal(words.selectionEnd,9);assert.equal(words.scrollTop,7);original.click();assert.equal(clicks,1);}
 let changes=0;const observer=new w.MutationObserver(rows=>changes+=rows.length);observer.observe(d.getElementById('app'),{childList:true,subtree:true});const settled=passes;
 w.c3Shell.run();await new Promise(resolve=>w.setTimeout(resolve,10));observer.disconnect();
 assert.equal(changes,0,'a settled shell pass must not create or move nodes');assert.equal(passes,settled+2);assert.strictEqual(scope.parentElement,parent);assert.equal(d.querySelectorAll('.c3-scope').length,1);
});
