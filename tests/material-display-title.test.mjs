import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
test('retained Source uses its readable title while keeping the exact original reference and text',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(fs.readFileSync(new URL('../public/document-study/material-surface.js',import.meta.url),'utf8'));
  w.eval(fs.readFileSync(new URL('../public/document-study/display-format.js',import.meta.url),'utf8'));
  for(const [title,expected] of [[undefined,'Invented interview'],['A chosen NASA title','A chosen NASA title']]){
   const record=Object.freeze({name:'SRC - Invented interview.md',title,path:'Workflow/1-Source/SRC - Invented interview.md',raw:'Exact retained interview words.'}),before=JSON.stringify(record);
   const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
   const c={id:'invented',live:{},local:{drafts:{}}},h={esc,originalsAt:(_,stage)=>stage===2?[record]:[],recordWords:r=>'<p>'+esc(r.raw)+'</p>',button:()=>'',field:()=>'',material:()=>'',transcript:()=>'',originalAudio:()=>''};
   w.document.body.innerHTML=w.MaterialSurface.render(c,2,h);
   assert.equal(w.document.querySelector('.material-document>header h3').textContent,expected);
   assert.equal(w.document.querySelector('.material-record .small').textContent,expected);
   assert.match(w.document.querySelector('[data-disclosure="material-original"]').textContent,/Workflow\/1-Source\/SRC - Invented interview.md/);
   assert.match(w.document.querySelector('.recordBody').textContent,/Exact retained interview words/);assert.equal(JSON.stringify(record),before);
  }
 }finally{w.close();}
});
