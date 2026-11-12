import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

// The existing workspace's link reader (public/document-study/version-two.js) with stand-ins for the workspace's own
// owners. It checks the order of presses: the piece is chosen first and the section named in the address is pressed
// last, so nothing re-opens Write afterwards; a Carousel is read through its writer's own mode change. The real
// landing is walked in a browser by scripts/review-advanced-addresses.mjs. Invented ids only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../public/document-study/version-two.js'),'utf8');
const SECTIONS=['home','subjects','library','material','source','research','direction','write','read','check','media','arrange','audience','share','outputs'];
const windows=[];after(()=>windows.forEach(w=>w.close()));

function open(query,{carousel=false}={}){
 const dom=new JSDOM('<body><header id="c3-tabstrip"></header><nav class="combined-rail"><button data-combined-nav="write" aria-current="true"></button></nav><div id="study-output-canvas"></div></body>',{url:'http://local.test/document-study/index.html?'+query,runScripts:'outside-only'});
 const w=dom.window,calls=[];windows.push(w);let picked=null;
 w.c3Shell={register:(n,fn)=>fn()};
 w.eval('var current=()=>({id:"s1",viewedStage:5}); var state={projects:[{id:"s1"}]};');
 w.combinedSubjects={open:async o=>{calls.push(['subject',o.projectId]);},openStage:async n=>{calls.push(['stage',n]);return true;}};
 w.combinedNavigation={go:async key=>{calls.push(['go',key]);if(carousel)w.document.getElementById('study-output-canvas').innerHTML='<div class="car-writing-page" data-writing-view="write"></div>';return true;}};
 w.workspaceNavigation={changeMode:async mode=>{calls.push(['mode',mode]);const page=w.document.querySelector('.car-writing-page');if(page)page.dataset.writingView=mode;}};
 w.realOutputOverview={onAction:async r=>{calls.push(['piece',r.outputId,r.kind]);picked={id:r.outputId,kind:carousel?'carousel':'article'};}};
 w.studyOutputConnection={selection:()=>picked?{output:picked}:null};
 w.eval(source);
 return {w,calls};
}
const settle=async(calls,done)=>{for(let i=0;i<80&&!done(calls);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,400));};

test('with a piece, every section is pressed after the piece is chosen, and last',async()=>{
 for(const section of SECTIONS.filter(s=>s!=='home'&&s!=='subjects')){
  const {calls}=open(`subject=s1&piece=o1&section=${section}`);
  await settle(calls,c=>c.some(x=>x[0]==='go'));
  const pieceAt=calls.findIndex(x=>x[0]==='piece'),lastGo=calls.map(x=>x[0]).lastIndexOf('go');
  assert.ok(pieceAt>=0,section+': the piece is chosen');
  assert.equal(calls[pieceAt][1],'o1');
  assert.ok(lastGo>pieceAt,section+': the section is pressed after the piece');
  assert.deepEqual(calls[lastGo],['go',section==='read'?'write':section],section+': the section pressed is the one named');
  assert.equal(calls.slice(lastGo+1).filter(x=>x[0]==='go'||x[0]==='piece').length,0,section+': nothing re-opens another section afterwards');
 }
});
test('with no piece, every section is pressed and no piece is chosen',async()=>{
 for(const section of SECTIONS.filter(s=>s!=='home'&&s!=='subjects')){
  const {calls}=open(`subject=s1&section=${section}`);
  await settle(calls,c=>c.some(x=>x[0]==='go'));
  assert.deepEqual(calls[0],['subject','s1']);
  assert.equal(calls.some(x=>x[0]==='piece'),false,section);
  assert.deepEqual(calls.find(x=>x[0]==='go'),['go',section==='read'?'write':section],section);
 }
});
test('Read of an Article piece switches the writer to Read; Read of a Carousel piece switches its own writer',async()=>{
 const carousel=open('subject=s1&piece=c1&section=read',{carousel:true});
 await settle(carousel.calls,c=>c.some(x=>x[0]==='mode'));
 assert.deepEqual(carousel.calls.filter(x=>x[0]==='mode'),[['mode','read']]);
 assert.equal(carousel.w.document.querySelector('.car-writing-page').dataset.writingView,'read');
 const write=open('subject=s1&piece=c1&section=write',{carousel:true});
 await settle(write.calls,c=>c.some(x=>x[0]==='go'));
 assert.equal(write.calls.some(x=>x[0]==='mode'),false,'Write of a Carousel needs no mode change');
});
test('Home and the subject board are opened by name; an address without the keys opens nothing',async()=>{
 const home=open('section=home');await settle(home.calls,c=>c.some(x=>x[0]==='go'));
 assert.deepEqual(home.calls,[['go','home']]);
 const plain=open('reviewActor=agent:codex');await new Promise(r=>setTimeout(r,600));
 assert.deepEqual(plain.calls,[]);
 assert.equal(plain.w.location.search,'?reviewActor=agent:codex');
});

test('the Version three link returns to the address he left, and keeps doing so after the workspace drops its query string',async()=>{
 const {w}=open('v2from=/research/topic/t1%3Fx%3D1');
 const link=()=>w.document.querySelector('a.v2-front').getAttribute('href');
 assert.equal(link(),'/v3/index.html#/research/topic/t1?x=1');
 w.history.replaceState(null,'','/document-study/index.html');
 w.arVersionTwo.ensure();
 assert.equal(link(),'/v3/index.html#/research/topic/t1?x=1','kept for the tab');
 const again=open('v2from=//evil.example');
 assert.notEqual(again.w.document.querySelector('a.v2-front').getAttribute('href'),'/v3/index.html#//evil.example','an address that is not a plain version two path is ignored');
 assert.match(again.w.document.querySelector('a.v2-front').getAttribute('href'),/^\/v3\/index\.html#\/subject\/s1$/,'falls back to today\'s behaviour');
});
