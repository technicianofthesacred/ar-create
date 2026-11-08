import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=await fs.readFile(new URL('../public/document-study/folder-browser.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
async function setup(){
 const dom=new JSDOM('<div id="app"><div id="workspace"><textarea>Unsaved manuscript</textarea></div></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];
 w.AR_CREATE_REVIEW_MODE={actualWork:true};w.current=()=>({id:'p',view:'record',viewedStage:8});w.c3Shell={register(){}};w.c3Workbench={registerPanel(){},decorate(){}};w.matchMedia=()=>({matches:false});
 w.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>({schema:'ar-create.library-folders.v1',domain:'media',revision:1,indexHash:'hash',sources:['a','b','c','d'].map(id=>({id,title:id,kind:'image',rel_path:id+'.jpg'})),folders:[]})};};
 w.eval(code);await w.workbenchFolderBrowser.refresh();await tick();w.workbenchFolderBrowser.panelSpec('media').press('all');
 return {w,d,calls,close:()=>w.close()};
}
const card=(x,id)=>x.d.querySelector('[data-wfb-id="'+id+'"] .wfb-title');
const selected=x=>[...x.d.querySelectorAll('[data-wfb-id].sel')].map(n=>n.dataset.wfbId);
test('contact selection has no checkboxes, adds and ranges without opening or replacing the grid',async()=>{
 const x=await setup();try{
  assert.equal(x.d.querySelectorAll('input[type=checkbox]').length,0);
  const list=x.d.querySelector('.wfb-vt'),a=card(x,'a');list.scrollTop=12;list.dispatchEvent(new x.w.Event('scroll'));
  card(x,'a').click();assert.deepEqual(selected(x),['a']);assert.equal(x.d.querySelector('.wfb-preview'),null);
  assert.equal(x.d.querySelector('.wfb-vt'),list);assert.equal(list.scrollTop,12);assert.equal(card(x,'a'),a);
  card(x,'c').dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,metaKey:true}));assert.deepEqual(selected(x),['a','c']);
  card(x,'d').dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,shiftKey:true}));assert.deepEqual(selected(x),['c','d']);
  card(x,'b').click();assert.deepEqual(selected(x),['b']);
  assert.equal(card(x,'b').getAttribute('aria-pressed'),'true');
  assert.equal(x.d.querySelector('textarea').value,'Unsaved manuscript');assert.equal(x.calls.filter(c=>c.options.method==='POST').length,0);
 }finally{x.close();}
});
test('double-click expands the selected photo once; Back retains selection and scroll',async()=>{
 const x=await setup();try{
  const list=x.d.querySelector('.wfb-vt');list.scrollTop=12;list.dispatchEvent(new x.w.Event('scroll'));
  card(x,'b').dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,detail:1}));
  card(x,'b').dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,detail:2}));
  card(x,'b').dispatchEvent(new x.w.MouseEvent('dblclick',{bubbles:true,detail:2}));await tick();
  assert.ok(x.d.querySelector('.wfb-preview'));
  x.d.querySelector('[data-wfb-action=back]').click();assert.deepEqual(selected(x),['b']);assert.equal(x.d.querySelector('.wfb-vt').scrollTop,12);
  assert.equal(x.d.querySelectorAll('input[type=checkbox]').length,0);
 }finally{x.close();}
});
test('selection toolbar stays mounted for empty, all, and cleared selections; sorting retains scroll',async()=>{
 const x=await setup();try{
  const bar=x.d.querySelector('.wfb-contact-selection'),list=x.d.querySelector('.wfb-vt');assert.ok(bar);
  x.d.querySelector('[data-wfb-action=selectall]').click();assert.equal(selected(x).length,4);assert.equal(x.d.querySelector('.wfb-contact-selection'),bar);
  x.d.querySelector('[data-wfb-action=selectionclear]').click();assert.deepEqual(selected(x),[]);assert.equal(x.d.querySelector('.wfb-contact-selection'),bar);
  list.scrollTop=12;list.dispatchEvent(new x.w.Event('scroll'));
  const sort=x.d.querySelector('[data-wfb-sort]');sort.value='date';sort.dispatchEvent(new x.w.Event('change',{bubbles:true}));assert.equal(x.d.querySelector('.wfb-vt').scrollTop,12);
 }finally{x.close();}
});
test('Enter and the separate expand button open previews without changing selection',async()=>{
 for(const input of ['keyboard','expand']){const x=await setup();try{
  card(x,'a').click();
  if(input==='keyboard')card(x,'a').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  else x.d.querySelector('[data-wfb-expand-photo="a"]').click();
  await tick();assert.ok(x.d.querySelector('.wfb-preview'));
  x.d.querySelector('[data-wfb-action=back]').click();assert.deepEqual(selected(x),['a']);
 }finally{x.close();}}
});
test('Media list virtualization reserves room for larger thumbnails and long titles',async()=>{
 const x=await setup();try{
  const rows=[...x.d.querySelectorAll('.wfb-vrow')];
  assert.equal(rows[0].style.height,'96px');
  assert.equal(rows[1].style.top,'96px');
  assert.equal(rows[0].querySelector('.wfb-kind').textContent,'Photo');
  card(x,'a').click();assert.deepEqual(selected(x),['a']);
  assert.equal(x.d.querySelector('.wfb-vrow').style.height,'96px');
  assert.equal(x.calls.filter(c=>c.options.method==='POST').length,0);
 }finally{x.close();}
});
