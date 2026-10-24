import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/photos-stage.js',import.meta.url),'utf8');
test('photo phase keeps actual retained placements discoverable independently of native manuscript photos',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost'}),w=dom.window;const p={id:'synthetic',view:'record',viewedStage:1};
 let calls=0;w.current=()=>p;w.phaseReader=()=>{calls++;return '<section class="phaseReader"><article class="recordPage"><h2>Photos in the project</h2><div class="stagePhotoGrid"><img src="/synthetic.jpg"><figcaption>Exact caption</figcaption></div></article></section>';};w.render=()=>{};w.historicalNotice=()=>'';w.workflowBar=()=>'';
 w.eval(code);p.viewedStage=8;w.document.body.innerHTML=w.phaseReader(p);const retained=w.document.querySelector('[data-retained-photo-records]');assert.ok(retained);assert.match(retained.querySelector('summary').textContent,/1.*placement.*read-only/i);assert.equal(retained.querySelector('figcaption').textContent,'Exact caption');assert.equal(retained.querySelector('[data-photo-occurrence]'),null);assert.ok(w.document.querySelector('#owned-photo-stage'));assert.equal(calls,1);p.viewedStage=2;assert.match(w.phaseReader(p),/stagePhotoGrid/);assert.equal(calls,2);w.close();
});
test('empty retained photo phase does not invent a retained media group',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost'}),w=dom.window,p={id:'synthetic',view:'record',viewedStage:1};w.current=()=>p;w.phaseReader=()=>'<section class="phaseReader"><article><p>No retained photo records</p></article></section>';w.render=()=>{};w.historicalNotice=()=>'';w.workflowBar=()=>'';w.eval(code);p.viewedStage=8;w.document.body.innerHTML=w.phaseReader(p);assert.equal(w.document.querySelector('[data-retained-photo-records]'),null);w.close();
});
