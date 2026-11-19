import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');

function render(row){
 const dom=new JSDOM('<main></main>',{runScripts:'outside-only'});
 const {window}=dom;
 for(const file of ['public/document-study/readable-markdown.js','public/v2/shell/parts.js']){
  window.eval(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 }
 assert.equal(typeof window.V2Parts.storyProse,'function');
 window.document.querySelector('main').innerHTML=window.V2Parts.storyProse(row);
 return {dom,body:window.document.querySelector('main')};
}

test('Magazine display renders emphasis and line breaks without changing saved wording',()=>{
 const row={kind:'paragraph',words:'A **strong** observation and *quiet* emphasis.\nA second line.'};
 const before=JSON.stringify(row);
 const {dom,body}=render(row);
 try{
  assert.equal(body.querySelector('strong').textContent,'strong');
  assert.equal(body.querySelector('em').textContent,'quiet');
  assert.equal(body.querySelectorAll('br').length,1);
  assert.equal(JSON.stringify(row),before);
 }finally{dom.window.close();}
});

test('Magazine display retains semantic headings, quotes and lists with existing reading classes',()=>{
 for(const [row,selector] of [
  [{kind:'heading',level:2,words:'An **invented** section'},'h2.rd-h strong'],
  [{kind:'blockquote',words:'A remembered *sentence*.'},'blockquote.rd-q em'],
  [{kind:'paragraph',words:'- First item\n- Second item'},'ul li'],
 ]){
  const {dom,body}=render(row);
  try{assert.ok(body.querySelector(selector),selector);}finally{dom.window.close();}
 }
});

test('Magazine display uses visible projection words and keeps HTML and unsafe URLs inert',()=>{
 const row={kind:'paragraph',words:'<script>unsafe()</script> [unsafe](javascript:alert) **kept**',raw:'Hidden original-only metadata'};
 const {dom,body}=render(row);
 try{
  assert.equal(body.querySelector('script'),null);
  assert.equal(body.querySelector('[href^="javascript:"]'),null);
  assert.ok(body.textContent.includes('<script>unsafe()</script>'));
  assert.ok(!body.textContent.includes('Hidden original-only metadata'));
  assert.equal(body.querySelector('strong').textContent,'kept');
 }finally{dom.window.close();}
});


test('donor formatting is retained only when its text matches the visible projection',()=>{
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Kept',marks:[{type:'bold'}]}]}]};
 for(const words of ['Kept','Different visible words']){
  const {dom,body}=render({kind:'paragraph',words,doc});
  try{assert.equal(body.textContent,words);assert.equal(!!body.querySelector('strong'),words==='Kept');}finally{dom.window.close();}
 }
});


test('native formatting cannot introduce HTML or an unsafe link',()=>{
 const words='<img src=x onerror=unsafe()>';
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:words,marks:[{type:'bold'},{type:'link',attrs:{href:'javascript:unsafe()'}}]}]}]};
 const {dom,body}=render({kind:'paragraph',words,doc});
 try{assert.equal(body.textContent,words);assert.equal(body.querySelector('img,a'),null);assert.equal(body.querySelector('strong').textContent,words);}finally{dom.window.close();}
});
