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

function workspace({slow=0,stuckWriter=false,stale=null,projects=null,readDelay=0,hangReads=false,noReturn=false}={}){
 const dom=new JSDOM('<body><header id="c3-tabstrip"></header><nav class="combined-rail"><button data-combined-nav="write" aria-current="page"></button><button data-combined-nav="arrange"></button></nav><div id="study-output-canvas"></div><div id="manuscript"></div></body>',{url:'http://local.test/document-study/index.html',runScripts:'outside-only'});
 const w=dom.window,calls=[],reads=[];windows.push(w);
 let at='s1',rail='write',mode='edit',binding=null;const sel={...(stale||{})};const pickedNow=()=>sel[at]?{id:sel[at],kind:'article'}:null;
 const later=fn=>slow?new Promise(r=>setTimeout(()=>r(fn()),slow)):Promise.resolve(fn());
 const mark=()=>{for(const b of w.document.querySelectorAll('[data-combined-nav]')){if(b.dataset.combinedNav===rail)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}};
 const outputs={s1:[{id:'a1',format:'Article'},{id:'a2',format:'Article'}],s2:[{id:'b1',format:'Article'}]};
 w.c3Shell={register:(n,fn)=>fn()};
 w.eval('var current=()=>window.__at; var state={projects:'+JSON.stringify(projects||[{id:'s1'},{id:'s2'}])+'};');
 const sync=()=>{w.__at={id:at,viewedStage:5};};sync();
 w.combinedSubjects={open:async o=>{calls.push(['subject',o.projectId]);await later(()=>{at=o.projectId;sync();});},openStage:async n=>{calls.push(['stage',n]);return true;},isOpen:()=>false};
 w.combinedNavigation={go:async key=>{calls.push(['go',key]);await later(()=>{rail=key;mark();});return true;}};
 w.workspaceNavigation={changeMode:async m=>{calls.push(['mode',m]);await later(()=>{mode=m==='read'?'preview':'edit';});}};
 w.studyDraft={viewMode:()=>mode};
 // A writer that never takes the chosen piece's binding (it declined, or a newer open superseded it).
 w.realOutputOverview={read:async({projectId})=>{reads.push(projectId);if(hangReads&&projectId!==at)return new Promise(()=>{});if(readDelay)await new Promise(r=>setTimeout(r,readDelay));return {outputs:outputs[projectId]||[],existingDraft:noReturn?null:{bindingId:'own-'+projectId}};},onAction:async r=>{calls.push(['piece',r.projectId,r.outputId]);await later(()=>{sel[r.projectId]=r.outputId;if(!stuckWriter)binding={id:'bind-'+r.outputId,parentStudyId:r.projectId};w.dispatchEvent(new w.CustomEvent('study-output-selection'));});}};
 w.studyOutputConnection={selection:()=>{const picked=pickedNow();return picked?{output:picked,owner:{kind:'native',bindingId:'bind-'+picked.id}}:null;},clearSelection:async({projectId})=>{calls.push(['clear',projectId]);delete sel[projectId];}};
 w.studyDraft.openBinding=async({bindingId,parentStudyId})=>{calls.push(['bind',bindingId]);binding={id:bindingId,parentStudyId};};
 w.studyDraft.currentBinding=()=>binding||(stuckWriter?{id:'bind-earlier',parentStudyId:at}:null);
 w.eval(source);
 return {w,calls,reads};
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

// ---------- no piece asked: the subject's own writing place ----------
test('with no piece, an earlier-chosen piece is left through the writer\'s own manuscript before ok',async()=>{
 for(const view of ['write','read',null]){
  const {w,calls}=workspace({stale:{s1:'a1'}});
  const r=await w.arVersionTwo.openPlace({subject:'s1',view});
  assert.equal(r.ok,true,'view '+view);assert.equal(r.opened.piece,null);
  assert.deepEqual(calls.filter(x=>x[0]==='bind'||x[0]==='clear'),[['bind','own-s1'],['clear','s1']]);
  assert.equal(w.studyDraft.currentBinding().id,'own-s1');
 }
});

test('a piece chosen in this tab and then a landing with no piece ends on the subject\'s own writing',async()=>{
 const {w}=workspace();
 assert.equal((await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'write'})).opened.piece,'a2');
 const r=await w.arVersionTwo.openPlace({subject:'s1',view:'write'});
 assert.equal(r.ok,true);assert.equal(r.opened.piece,null);
 assert.equal(w.studyDraft.currentBinding().id,'own-s1');
});

test('it never reports ok while an earlier piece is still shown (no way back offered)',async()=>{
 const {w}=workspace({stale:{s1:'a1'},noReturn:true});
 const r=await w.arVersionTwo.openPlace({subject:'s1',view:'write'});
 assert.equal(r.ok,false);assert.equal(r.reason,'not-shown');
});

test('with no piece, unsaved words in the open piece leave it open: nothing is opened, cleared or saved, and it is not ok',async()=>{
 for(const unsaved of [w=>{w.studyDraft.currentProof=()=>({dirty:true});},w=>{w.studyOutputConnection.canvasProof=()=>({pending:true});},w=>{w.studyOutputConnection.canvasProof=()=>({pending:false,browserDraftToken:'t'});},w=>{w.studyDraft.recoveryOwnership=()=>({state:'pending'});}]){
  const {w,calls}=workspace({stale:{s1:'a1'}});unsaved(w);
  let saves=0;w.studyDraft.flush=async()=>{saves++;};w.studyOutputConnection.flush=async()=>{saves++;};
  const r=await w.arVersionTwo.openPlace({subject:'s1',view:'write'});
  assert.equal(r.ok,false);assert.equal(r.reason,'not-shown');assert.match(r.message,/unsaved/);
  assert.equal(calls.some(x=>x[0]==='bind'||x[0]==='clear'),false);assert.equal(saves,0);
  assert.equal(r.opened.piece,'a1');
 }
});

test('with no piece, a different piece chosen while the manuscript opens is never cleared',async()=>{
 const {w,calls}=workspace({stale:{s1:'a1'}});
 const open=w.studyDraft.openBinding;w.studyDraft.openBinding=async o=>{await open(o);await w.studyOutputConnection.clearSelection({projectId:'s1'});await w.realOutputOverview.onAction({projectId:'s1',outputId:'a2',kind:'native'});await open(o);};
 const r=await w.arVersionTwo.openPlace({subject:'s1',view:'write'});
 assert.equal(r.ok,false);assert.equal(calls.filter(x=>x[0]==='clear').length,1);
 assert.equal(w.studyOutputConnection.selection().output.id,'a2');
});

test('a subject whose own pieces are not read in time is never called "no such piece"',async()=>{
 const {w}=workspace({readDelay:150});
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'write',searchTimeout:30});
 assert.notEqual(r.reason,'piece-not-found');assert.equal(r.ok,true);assert.equal(r.opened.piece,'a2');
});

test('no earlier piece: nothing is opened or cleared',async()=>{
 const {w,calls}=workspace();
 const r=await w.arVersionTwo.openPlace({subject:'s1',view:'write'});
 assert.equal(r.ok,true);assert.equal(calls.some(x=>x[0]==='bind'||x[0]==='clear'),false);
});

// ---------- the search for another subject's piece is bounded ----------
const many=n=>Array.from({length:n},(_,i)=>({id:i===0?'s1':'x'+i}));
test('with 150 subjects and reads that never answer, a missing piece is reported within the time limit',async()=>{
 const {w,calls}=workspace({projects:many(150),hangReads:true});
 const t0=Date.now();
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'zz',view:'write',searchTimeout:300});
 assert.equal(r.reason,'piece-not-found');assert.ok(Date.now()-t0<3000,'took '+(Date.now()-t0));
 assert.equal(calls.some(x=>x[0]==='piece'),false);assert.equal(r.opened.subject,'s1');assert.equal(r.opened.section,'write');
});

test('the search stops reading once its time is up, and once the piece is found elsewhere',async()=>{
 const slow=workspace({projects:many(150),readDelay:40});
 const r=await slow.w.arVersionTwo.openPlace({subject:'s1',piece:'zz',view:'write',searchTimeout:200});
 assert.equal(r.reason,'piece-not-found');assert.ok(slow.reads.length<60,'read '+slow.reads.length);
 const found=workspace({projects:many(150)});
 found.w.eval('state.projects[3].id="s2"');
 const f=await found.w.arVersionTwo.openPlace({subject:'s1',piece:'b1',view:'write'});
 assert.equal(f.reason,'piece-other-subject');assert.ok(found.reads.length<20,'read '+found.reads.length);
});

// ---------- nothing is left behind ----------
function watchLeaks(w){
 const live=new Set(),log=(add,type,fn,opt)=>{const k=[type,fn,typeof opt==='object'?!!opt?.capture:!!opt];const id=live.has(k)?k:[...live].find(x=>x[0]===k[0]&&x[1]===k[1]&&x[2]===k[2])||k;add?live.add(id):live.delete(id);};
 for(const target of [w,w.document]){const a=target.addEventListener.bind(target),r=target.removeEventListener.bind(target);target.addEventListener=(t,f,o)=>{log(true,t,f,o);return a(t,f,o);};target.removeEventListener=(t,f,o)=>{log(false,t,f,o);return r(t,f,o);};}
 const observers=new Set(),Real=w.MutationObserver;
 w.MutationObserver=class extends Real{observe(...a){observers.add(this);return super.observe(...a);}disconnect(){observers.delete(this);return super.disconnect();}};
 const timers=new Set(),si=w.setInterval.bind(w),ci=w.clearInterval.bind(w),st=w.setTimeout.bind(w),ct=w.clearTimeout.bind(w);
 w.setInterval=(f,n)=>{const id=si(f,n);timers.add(id);return id;};w.clearInterval=id=>{timers.delete(id);ci(id);};
 w.setTimeout=(f,n)=>{const id=st(()=>{timers.delete(id);f();},n);timers.add(id);return id;};w.clearTimeout=id=>{timers.delete(id);ct(id);};
 return ()=>({listeners:live.size,observers:observers.size,timers:timers.size});
}
for(const [name,opts,ask,expect] of [
 ['success',{},{subject:'s1',piece:'a2',view:'read'},true],
 ['failure',{},{subject:'nope',view:'write'},false],
 ['timeout',{stuckWriter:true},{subject:'s1',piece:'a2',view:'write'},false]]){
 test('the listeners, observers and timers openPlace adds are removed after it resolves: '+name,async()=>{
  const {w}=workspace(opts),left=watchLeaks(w);
  const r=await w.arVersionTwo.openPlace(ask);
  assert.equal(r.ok,expect);
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(left(),{listeners:0,observers:0,timers:0});
 });
}

// ---------- a section the workspace did not open is never ok ----------
test('a section the rail refuses (Research while the writer holds no words) is reported, never ok',async()=>{
 const {w}=workspace();
 const go=w.combinedNavigation.go;w.combinedNavigation.go=async key=>key==='research'?false:go(key);
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'research'});
 assert.equal(r.ok,false);assert.equal(r.reason,'not-shown');assert.equal(r.opened.section,'write');
});

test('a rail caught mid-repaint, marking nothing, is not taken as the section shown',async()=>{
 const {w}=workspace();
 w.combinedNavigation.go=async()=>{
  // The rail says yes but stays on Write; a repaint briefly leaves it unmarked and announces itself.
  setTimeout(()=>{const b=w.document.querySelector('[data-combined-nav="write"]');b.removeAttribute('aria-current');w.dispatchEvent(new w.CustomEvent('c3-header-painted'));b.setAttribute('aria-current','page');},50);
  return true;
 };
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'research'});
 assert.equal(r.ok,false);assert.equal(r.reason,'not-shown');
});

test('a piece shown before its writer settled is looked at again once it has, and not called ok if it moved',async()=>{
 const {w}=workspace();let pending=true;w.studyDraft.recoveryOwnership=()=>({state:pending?'pending':'ready'});
 // While the writer is still loading, its late open moves the page back to Write.
 setTimeout(()=>{w.combinedNavigation.go('write').then(()=>{pending=false;w.dispatchEvent(new w.CustomEvent('study-draft-change'));});},300);
 const r=await w.arVersionTwo.openPlace({subject:'s1',piece:'a2',view:'arrange'});
 assert.equal(r.ok,false);assert.equal(r.reason,'not-shown');
});
