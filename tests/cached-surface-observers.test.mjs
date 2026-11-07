import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const surfaces=[
 {file:'source-presentation',stage:2,html:'<main id="stage-working-lane"><article class="material-surface"><div class="recordBody">Invented source</div></article></main>',ready:'.source-presentation .sp-heading'},
 {file:'share-stage',stage:11,html:'<section data-output-stage-surface="11"></section>',ready:'[data-output-stage-surface="11"][data-share-connected]'},
 {file:'shared-prose-surfaces',stage:2,html:'<main class="workspace"><div class="recordBody"><p>Invented source</p></div></main>',ready:'.shared-prose-surface .shared-prose-block'},
 {file:'media-usage',stage:9,html:'<div id="study-output-canvas"></div>',ready:'#study-media-return button'},
 {file:'i64-return',stage:1,html:'<header class="topbar"></header>',ready:'.topbar .i64-return'}
];
for(const surface of surfaces)test(`${surface.file} decorates new surfaces after cached pagehide, then disconnects on actual unload`,async t=>{
 const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'http://localhost/?i64osReturn=http%3A%2F%2Flocalhost%3A8888%2Far-create'}),w=dom.window,d=w.document,app=d.getElementById('app');t.after(()=>w.close());
 let disconnected=0;const Observer=w.MutationObserver;w.MutationObserver=class extends Observer{disconnect(){disconnected++;super.disconnect();}};
 w.current=()=>({id:'invented',name:'Invented project',view:'record',viewedStage:surface.stage});
 w.realOutputOverview={read:async()=>({outputs:[]})};
 w.studyOutputConnection={selection:()=>({projectId:'invented',rootBindingId:'root',output:{id:'article'}})};
 w.sessionStorage.setItem('ar-create.media-return.v1',JSON.stringify({parentStudyId:'invented',rootBindingId:'root',outputId:'article',sourceId:'invented-photo'}));
 app.innerHTML=surface.html;w.eval(fs.readFileSync(new URL(`../public/document-study/${surface.file}.js`,import.meta.url),'utf8'));await settle();await settle();
 const hide=persisted=>w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted}));
 // A browser can cache and restore the same document more than once.
 for(let visit=0;visit<2;visit++){
  hide(true);w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));app.innerHTML=surface.html;await settle();await settle();
  assert.ok(d.querySelector(surface.ready),'new connected surface is decorated after returning');
  assert.equal(disconnected,0,'cached pagehide keeps the observer connected');
 }
 hide(false);assert.equal(disconnected,1,'later actual unload still disconnects');
 app.innerHTML=surface.html;await settle();await settle();assert.equal(d.querySelector(surface.ready),null,'actual unload stops observer-driven decoration');
});
