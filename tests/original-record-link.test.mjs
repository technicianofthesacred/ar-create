import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const source=fs.readFileSync(new URL('../public/document-study/study.js',import.meta.url),'utf8');
function render(base){
 const dom=new JSDOM('',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 w.AR_CREATE_PACKAGE_CONFIG=base?{originalReaderBaseUrl:base}:{};
 w.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.readonlyHTML=s=>s;
 w.eval(source.slice(source.indexOf('function originalURL('),source.indexOf('function referenceOverview(')));
 w.eval(source.slice(source.indexOf('function compactRecordPage('),source.indexOf('function viewCurrentWork(')));
 w.document.body.innerHTML=w.compactRecordPage({path:'synthetic/Part 1 & notes.md',title:'Invented retained record',html:'<p>Exact retained wording.</p>',notes:[]},0,6);
 return {w,d:w.document,close:()=>w.close()};
}
test('unconfigured original-file reader is explicit and never opens a fake same-page original link',()=>{
 const f=render();try{assert.equal(f.d.querySelector('a'),null);assert.match(f.d.querySelector('.recordDetails').textContent,/Original file reader is not connected/);assert.equal(f.d.querySelector('.recordBody p').textContent,'Exact retained wording.');}finally{f.close();}
});
test('configured original-file reader retains exact escaped source path and separate retained wording',()=>{
 const f=render('http://127.0.0.1:8877/');try{const link=f.d.querySelector('.recordDetails a');assert.equal(link.href,'http://127.0.0.1:8877/read/synthetic/Part%201%20%26%20notes.md');assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener');assert.equal(f.d.querySelector('.recordBody p').textContent,'Exact retained wording.');}finally{f.close();}
});
