import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

// arVersionTwo.openPlace (public/document-study/version-two.js) with stand-ins for the workspace's own owners. It checks
// that the landing resolves from the workspace's state (not a fixed delay), says why it could not open a place, and
// never opens another subject's piece. The real landing is walked in a browser by scripts/review-advanced-addresses.mjs.
// Invented ids only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../public/document-study/version-two.js'),'utf8');
const windows=[];after(()=>windows.forEach(w=>w.close()));

function workspace({slow=0,stuckWriter=false}={}){
 const dom=new JSDOM('<body><header id="c3-tabstrip"></header><nav class="combined-rail"><button data-combined-nav="write" aria-current="page"></button><button data-combined-nav="arrange"></button></nav><div id="study-output-canvas"></div><div id="manuscript"></div></body>',{url:'http://local.test/document-study/index.html',runScripts:'outside-only'});
 const w=dom.window,calls=[];windows.push(w);
 let at='s1',picked=null,rail='write',mode='edit';
 const later=fn=>slow?new Promise(r=>setTimeout(()=>r(fn()),slow)):Promise.resolve(fn());
 const mark=()=>{for(const b of w.document.querySelectorAll('[data-combined-nav]')){if(b.dataset.combinedNav===rail)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}};
 const outputs={s1:[{id:'a1',format:'Article'},{id:'a2',format:'Article'}],s2:[{id:'b1',format:'Article'}]};
 w.c3Shell={register:(n,fn)=>fn()};
 w.eval('var current=()=>window.__at; var state={projects:[{id:"s1"},{id:"s2"}]};');
 const sync=()=>{w.__at={id:at,viewedStage:5};};sync();
 w.combinedSubjects={open:async o=>{calls.push(['subject',o.projectId]);await later(()=>{at=o.projectId;sync();picked=null;});},openStage:async n=>{calls.push(['stage',n]);return true;},isOpen:()=>false};
 w.combinedNavigation={go:async key=>{calls.push(['go',key]);await later(()=>{rail=key;mark();});return true;}};
 w.workspaceNavigation={changeMode:async m=>{calls.push(['mode',m]);await later(()=>{mode=m==='read'?'preview':'edit';});}};
 w.studyDraft={viewMode:()=>mode};
 // A writer that never takes the chosen piece's binding (it declined, or a newer open superseded it).
 if(stuckWriter)w.studyDraft.currentBinding=()=>({id:'bind-earlier',parentStudyId:at});
 w.realOutputOverview={read:async({projectId})=>({outputs:outputs[projectId]||[]}),onAction:async r=>{calls.push(['piece',r.projectId,r.outputId]);await later(()=>{picked={id:r.outputId,kind:'article'};w.dispatchEvent(new w.CustomEvent('study-output-selection'));});}};
 w.studyOutputConnection={selection:()=>picked?{output:picked,owner:{kind:'native',bindingId:'bind-'+picked.id}}:null};
 w.eval(source);
 return {w,calls};
}

test('opens one exact piece of one subject in the chosen view and says what it opened',async()=>{
 const {w,calls}=workspace();
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'read'});
 assert.equal(r.ok,true);assert.equal(r.reason,null);
 assert.equal(r.opened.subject,'s1');assert.equal(r.opened.piece,'a2');assert.equal(r.opened.view,'preview');
 assert.deepEqual(calls.filter(x=>x[0]==='piece'),[['piece','s1','a2']]);
});

test('two Articles of one subject are told apart by id',async()=>{
 for(const id of ['a1','a2']){
  const {w}=workspace();
  const r=await w.arVersionTwo.openPlace({subject:'s1',piece:id,view:'write'});
  assert.equal(r.ok,true);assert.equal(r.opened.piece,id);
 }
});

test('waits for the workspace, however slow, and never resolves before it shows the place',async()=>{
 const {w}=workspace({slow:120});
 const r=await w.arVersionTwo.openPlace({subject:'s2',piece:'b1',view:'arrange'});
 assert.equal(r.ok,true);assert.equal(r.opened.subject,'s2');assert.equal(r.opened.piece,'b1');assert.equal(r.opened.section,'arrange');
});

test('a piece of another subject is reported, never opened, and the subject section still opens',async()=>{
 const {w,calls}=workspace();
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'b1',view:'arrange'});
 assert.equal(r.ok,false);assert.equal(r.reason,'piece-other-subject');
 assert.equal(calls.some(x=>x[0]==='piece'),false,'no piece is chosen');
 assert.equal(r.opened.subject,'s1');assert.equal(r.opened.piece,null);assert.equal(r.opened.section,'arrange');
 assert.match(r.message,/another subject/);
});

test('a piece that does not exist is reported and the subject section still opens',async()=>{
 const {w,calls}=workspace();
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'zz',view:'write'});
 assert.equal(r.reason,'piece-not-found');assert.equal(calls.some(x=>x[0]==='piece'),false);
 assert.equal(r.opened.section,'write');
});

test('a subject that does not exist opens nothing',async()=>{
 const {w,calls}=workspace();
 const r=await w.arVersionTwo.openPlace({subject:'nope',view:'write'});
 assert.equal(r.ok,false);assert.equal(r.reason,'subject-not-found');
 assert.deepEqual(calls,[]);
});

test('with no piece it opens the subject\'s own writing place',async()=>{
 const {w,calls}=workspace();
 const r=await w.arVersionTwo.openPlace({subject:'s2',view:'write'});
 assert.equal(r.ok,true);assert.equal(r.opened.subject,'s2');assert.equal(calls.some(x=>x[0]==='piece'),false);
});

test('never says ok while the writer still holds another binding than the chosen piece\'s',async()=>{
 const {w}=workspace({stuckWriter:true});
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'write'});
 assert.equal(r.ok,false);assert.equal(r.reason,'not-shown');
});

test('the source has no fixed waits',()=>{
 assert.equal(/\bwait\(\d+\)/.test(source),false);
});
