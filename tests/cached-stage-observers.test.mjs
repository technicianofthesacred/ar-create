import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const settle=async()=>{await new Promise(resolve=>setTimeout(resolve,0));await new Promise(resolve=>setTimeout(resolve,0));};

for(const [name,stage,html,target] of [
 ['stage-work-surfaces.js',7,'<section id="current-draft-check"></section>','[data-sws-check]'],
 ['output-stage-surfaces.js',9,'<section class="phaseReader">Original retained content</section>','[data-output-stage-surface="9"]']
])test(name+' keeps decorating after cached departure and stops on real departure',async()=>{
 const dom=new JSDOM('<div id="app"><main id="workspace">'+html+'</main></div>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
 try{
  const p={id:'invented-project',view:'record',viewedStage:stage};w.current=()=>p;w.render=()=>{};
  w.eval(read(name));await settle();assert.ok(w.document.querySelector(target),'initial surface is connected');
  w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));
  w.document.querySelector(target).remove();await settle();
  assert.ok(w.document.querySelector(target),'retained owner must decorate a later mounted surface after Back');
  w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:false}));
  w.document.querySelector(target).remove();await settle();
  assert.equal(w.document.querySelector(target),null,'a later ordinary departure still disconnects the owner');
 }finally{w.close();}
});
