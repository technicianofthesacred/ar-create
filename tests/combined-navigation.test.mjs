import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/combined-navigation.js',import.meta.url),'utf8');
function boot(n=5){
 const dom=new JSDOM('<header id="c3-tabstrip"><div class="wbf-top-actions"></div></header><div class="workflowNavigation wb-rail"><button data-tr-home>Old Home</button>'+Array.from({length:12},(_,i)=>`<button class="workflowStep"><span class="stepNumber">${i+1}</span></button>`).join('')+'</div><dialog id="project-library"></dialog>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document,p={view:'record',viewedStage:n,id:'kept'};
 const calls=[];w.current=()=>p;w.c3Shell={register(_name,fn){this.paint=fn;}};w.projectLibrary={async close(){calls.push('close');d.querySelector('dialog').removeAttribute('open');}};w.combinedSubjects={async open(){calls.push('subjects');d.querySelector('dialog').setAttribute('data-combined-subjects','');d.querySelector('dialog').setAttribute('open','');}};
 w.workspaceNavigation={async changeMode(mode){calls.push(mode);}};d.querySelector('[data-tr-home]').onclick=()=>calls.push('home');[...d.querySelectorAll('.workflowStep')].forEach((b,i)=>b.onclick=()=>calls.push('stage:'+String(i+1)));w.eval(code);return {w,d,p,calls,close:()=>w.close()};
}
test('Combined rail retains all checkpoints and exposes independent learning',async()=>{
 const f=boot();assert.deepEqual([...f.d.querySelectorAll('.combined-rail [data-combined-nav]')].map(n=>n.textContent),['Home','Library','Material','Source','Research','Learning','Direction','Write','Check','Media','Arrange','Audience','Share','Outputs']);assert.equal(f.d.querySelectorAll('.workflowStep').length,12);
 await f.w.combinedNavigation.go('arrange');assert.deepEqual(f.calls,['arrange']);await f.w.combinedNavigation.go('subjects');assert.deepEqual(f.calls,['arrange','subjects']);assert.equal(f.d.querySelector('[data-combined-nav="subjects"]').getAttribute('aria-current'),'page');f.close();
});
test('piece Write and Read switch through the maintained selected-piece mode owner',async()=>{
 const f=boot();f.d.querySelector('[data-combined-mode="read"]').click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(f.calls,['read']);assert.equal(f.calls.some(c=>c==='stage:6'),false);
 f.w.workspaceNavigation.changeMode=async()=>{throw Error('Save refused');};f.d.querySelector('[data-combined-mode="write"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(f.d.querySelector('[role="status"]').textContent,'Save refused');assert.equal(f.p.id,'kept');f.close();
});
test('failed Home close prevents section opening and preserves the dialog',async()=>{
 const f=boot();f.d.querySelector('dialog').setAttribute('open','');f.w.projectLibrary.close=async()=>{throw Error('Resolve current changes');};assert.equal(await f.w.combinedNavigation.go('source'),false);assert.deepEqual(f.calls,[]);assert.equal(f.d.querySelector('dialog').open,true);assert.match(f.d.querySelector('[role="status"]').textContent,/Resolve/);f.close();
});
test('rail keyboard navigation changes focus, never the selected work',()=>{
 const f=boot(),b=f.d.querySelector('[data-combined-nav="home"]');b.focus();b.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(f.d.activeElement.dataset.combinedNav,'library');assert.deepEqual(f.calls,[]);assert.equal(f.p.viewedStage,5);f.close();
});

test('phone groups expose the same guarded entrances and Escape returns focus',async()=>{
 const f=boot(),button=f.d.querySelector('[data-combined-group="develop"]');button.click();assert.deepEqual([...f.d.querySelectorAll('#combined-phone-sheet button')].map(b=>b.textContent),['Library','Source','Research','Learning library','Direction']);f.d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.d.querySelector('#combined-phone-sheet'),null);assert.equal(f.d.activeElement,button);assert.deepEqual(f.calls,[]);f.close();
});
test('a Source sheet captured before group navigation closes that group and Escape returns directly to the writer',async()=>{const f=boot();try{f.p.view='article';f.p.viewedStage=5;const owner={kind:'magazine',storyId:'saved-story',pieceId:'saved-piece',path:'Workflow/3-Develop/DEV - Synthetic.md'},H='a'.repeat(64);f.w.studyDraft={currentOwner:()=>owner,currentProof:()=>({owner,parentStudyId:f.p.id,draftHash:H,expected:{workflow:{draft:H}},sequence:2,dirty:true}),holdForContext:()=>({bufferToken:'kept-buffer'}),releaseContext:()=>({sameEditorNode:true})};const app=f.d.createElement('div');app.id='app';app.innerHTML='<main id="workspace"><div id="manuscript" contenteditable="true"><p>Exact unsaved writer words.</p></div></main>';f.d.body.append(app);const editor=f.d.getElementById('manuscript');f.w.eval(fs.readFileSync(new URL('../public/document-study/combined-sheets.js',import.meta.url),'utf8'));f.w.combinedSheets.registerOwner('source',({container})=>{container.textContent='Retained source reading';return {};});f.d.querySelector('[data-combined-group="develop"]').click();assert.ok(f.d.getElementById('combined-phone-sheet'));f.d.querySelector('#combined-phone-sheet [data-combined-nav="source"]').click();await new Promise(resolve=>setTimeout(resolve,0));assert.ok(f.d.getElementById('combined-sheet'));assert.equal(f.d.getElementById('combined-phone-sheet'),null);assert.equal(f.d.activeElement.hasAttribute('data-combined-sheet-close'),true);f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.d.getElementById('combined-sheet'),null);assert.equal(f.d.getElementById('combined-phone-sheet'),null);assert.equal(f.d.getElementById('manuscript'),editor);assert.equal(editor.textContent,'Exact unsaved writer words.');assert.deepEqual(f.calls,[]);}finally{f.close();}});

test('Combined Check awaits one existing drawer action and reports one refusal without redispatching the old stage button',async()=>{const f=boot(10);try{let called=0;f.w.c3WorkbenchFrame={openTool:async key=>{assert.equal(key,'check');called++;throw Error('Exact selected revision changed');}};assert.equal(await f.w.combinedNavigation.go('check'),false);assert.equal(called,1);assert.deepEqual(f.calls,[]);assert.equal(f.d.querySelectorAll('#combined-navigation-status').length,1);assert.equal(f.d.querySelector('#combined-navigation-status').textContent,'Exact selected revision changed');assert.equal(f.p.viewedStage,10);}finally{f.close();}});

test('Research rail opens independent learning without opening or creating a manuscript',async()=>{
 const f=boot(1);try{f.w.c3Research={async openLearning(input){f.calls.push(['learning',input.parentStudyId]);}};assert.equal(await f.w.combinedNavigation.go('research'),true);assert.deepEqual(f.calls,[['learning','kept']]);assert.equal(f.p.viewedStage,1);}finally{f.close();}
});

test('visible Research owns the rail selection while its underlying writing stage stays intact',()=>{
 const f=boot(5);try{let open=true;f.w.c3Research={isOpen:()=>open};f.w.combinedNavigation.decorate();assert.equal(f.d.querySelector('.combined-rail [data-combined-nav="research"]').getAttribute('aria-current'),'page');assert.equal(f.p.viewedStage,5);open=false;f.w.combinedNavigation.decorate();assert.equal(f.d.querySelector('.combined-rail [data-combined-nav="write"]').getAttribute('aria-current'),'page');}finally{f.close();}
});

for(const refused of [false,true])test('leaving Research through Write respects its retained-writing return '+(refused?'refusal':'success'),async()=>{
 const f=boot(5);try{let open=true;f.w.c3Research={isOpen:()=>open,hide(){f.calls.push('restore-research');if(refused)return false;open=false;}};
 assert.equal(await f.w.combinedNavigation.go('write'),!refused);assert.deepEqual(f.calls,refused?['restore-research']:['restore-research','write']);assert.equal(open,refused);
 assert.equal(f.d.querySelector('.combined-rail [aria-current="page"]').dataset.combinedNav,refused?'research':'write');
 }finally{f.close();}
});

test('Research to its already mounted Write editor does not refocus or scroll it through a second mode transition',async()=>{
 const f=boot(5);try{let open=true;const editor=f.d.createElement('div');editor.id='manuscript';editor.textContent='Retained unsaved words.';f.d.body.append(editor);f.w.studyDraft={viewMode:()=> 'edit'};f.w.c3Research={isOpen:()=>open,hide(){f.calls.push('restore-research');open=false;}};
 assert.equal(await f.w.combinedNavigation.go('write'),true);assert.deepEqual(f.calls,['restore-research']);assert.strictEqual(f.d.getElementById('manuscript'),editor);assert.equal(editor.textContent,'Retained unsaved words.');
 }finally{f.close();}
});

test('global Library does not mark the Develop phone group current merely because its menu links to Library',()=>{const f=boot(1);try{f.w.combinedNavigation.decorate();assert.equal(f.d.querySelector('.combined-rail [data-combined-nav="library"]').getAttribute('aria-current'),'page');assert.equal(f.d.querySelector('.combined-phonebar [data-combined-group="develop"]').hasAttribute('aria-current'),false);assert.equal(f.d.querySelectorAll('.combined-phonebar [aria-current]').length,0);}finally{f.close();}});

test('sidebar toggle names its action, reports its state and persists without navigating',()=>{
 const f=boot();try{
  const rail=f.d.querySelector('.combined-rail'),toggle=rail.querySelector('[data-combined-rail-toggle]');
  assert.equal(toggle.getAttribute('aria-label'),'Collapse sidebar');
  assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert.equal(rail.firstElementChild,toggle);
  toggle.focus();toggle.click();
  assert.equal(toggle.getAttribute('aria-label'),'Expand sidebar');
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(f.w.localStorage.getItem('combined-rail-wide'),'false');
  assert.equal(f.d.body.classList.contains('combined-rail-wide'),false);
  f.w.combinedNavigation.decorate();
  assert.equal(f.d.activeElement,toggle);
  assert.deepEqual(f.calls,[]);assert.equal(f.p.id,'kept');
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert.equal(f.w.localStorage.getItem('combined-rail-wide'),'true');
 }finally{f.close();}
});

test('cached pagehide retains sheet observation and ordinary hide disconnects it',async()=>{const f=boot();try{f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide',{persisted:true}));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:true}));f.d.querySelector('[data-combined-group="develop"]').click();const sheet=f.d.createElement('div');sheet.id='combined-sheet';f.d.body.append(sheet);await new Promise(r=>setTimeout(r,0));assert.equal(f.d.getElementById('combined-phone-sheet'),null);sheet.remove();f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));f.d.querySelector('[data-combined-group="develop"]').click();f.d.body.append(sheet);await new Promise(r=>setTimeout(r,0));assert.ok(f.d.getElementById('combined-phone-sheet'));}finally{f.close();}});

test('Research returns to the same browser draft before a working file is bound', async () => {
 const f = boot();
 try {
  f.p.view = 'article';
  f.w.state = {projects: [f.p]};
  f.w.fetch = async () => { throw Error('No research data in this fixture'); };
  const editor = f.d.createElement('div');
  editor.id = 'manuscript';
  editor.tabIndex = 0;
  editor.textContent = 'Exact retained draft words.';
  f.d.body.append(editor);
  const range = f.d.createRange();
  range.setStart(editor.firstChild, 0);
  range.setEnd(editor.firstChild, 5);
  f.w.getSelection().addRange(range);
  editor.scrollTop = 42;
  const releases = [];
  f.w.studyDraft = {
   currentBinding: () => null,
   currentOwner: () => null,
   holdForContext: options => options.deferWorking
    ? {bufferToken: 'browser-draft', browserOnly: true}
    : null,
   releaseContext: options => {
    releases.push({...options});
    if (!options.cancelOnly) throw Error('Browser holds require browser-only release');
   },
  };
  f.w.eval(fs.readFileSync(new URL('../public/document-study/research-tab.js',import.meta.url),'utf8'));

  assert.equal(await f.w.combinedNavigation.go('research'), true);
  const close = f.d.querySelector('[data-rt-learning-close]');
  assert.equal(close.textContent, 'Back to Write');
  f.w.getSelection().removeAllRanges();
  editor.scrollTop = 0;
  close.click();

  assert.equal(f.w.c3Research.isOpen(), false);
  assert.equal(f.d.getElementById('manuscript'), editor);
  assert.equal(editor.textContent, 'Exact retained draft words.');
  assert.equal(f.w.getSelection().toString(), 'Exact');
  assert.equal(editor.scrollTop, 42);
  assert.deepEqual(releases, [{bufferToken: 'browser-draft', cancelOnly: true, restoreSelection: false}]);
 } finally {
  f.close();
 }
});


test('Learning library opens the maintained inquiry owner while keeping the exact draft and selection',async()=>{
 const f=boot(5);try{
  const editor=f.d.createElement('div');editor.id='manuscript';editor.contentEditable='true';editor.textContent='Exact unsaved inquiry detour words';f.d.body.append(editor);
  const range=f.d.createRange();range.setStart(editor.firstChild,6);range.setEnd(editor.firstChild,13);f.w.getSelection().addRange(range);editor.scrollTop=23;let saves=0;
  f.w.studyDraft={flush:async()=>{saves++;}};f.w.connectedWorkspace={openContext:async(...args)=>f.calls.push(args)};f.w.combinedNavigation.decorate();
  const entry=f.d.querySelector('.combined-rail-band[data-band="develop"] [data-combined-nav="learning"]');assert.ok(entry,'Develop exposes Learning library');
  assert.equal(entry.textContent,'Learning');assert.equal(entry.getAttribute('aria-label'),'Learning library');assert.equal(await f.w.combinedNavigation.go('learning'),true);
  assert.deepEqual(f.calls,[['inquiries']]);assert.equal(saves,0);assert.strictEqual(f.d.getElementById('manuscript'),editor);assert.equal(editor.textContent,'Exact unsaved inquiry detour words');assert.equal(f.w.getSelection().toString(),'unsaved');assert.equal(editor.scrollTop,23);
  f.d.querySelector('[data-combined-group="develop"]').click();assert.ok(f.d.querySelector('#combined-phone-sheet [data-combined-nav="learning"]'));
 }finally{f.close();}
});

test('Learning library refuses an unavailable inquiry owner without changing the selected work',async()=>{const f=boot();try{assert.equal(await f.w.combinedNavigation.go('learning'),false);assert.match(f.d.querySelector('[role="status"]').textContent,/Learning library is not connected/);assert.deepEqual(f.calls,[]);assert.equal(f.p.viewedStage,5);}finally{f.close();}});

test('the visible i64 OS exit uses only the maintained return validator and its original navigation link',async()=>{
 const f=boot();try{
  f.w.history.replaceState(null,'','?i64osReturn='+encodeURIComponent('http://localhost:8888/writing/tea'));
  const api={exports:{}};new Function('module','window','document',fs.readFileSync(new URL('../public/document-study/i64-return.js',import.meta.url),'utf8'))(api,undefined,undefined);f.w.ArI64Return=api.exports;
  const bar=f.d.createElement('header');bar.className='topbar';f.d.body.append(bar);f.w.ArI64Return.install(f.d,'http://localhost:8888/writing/tea');
  let navigations=0;bar.querySelector('.i64-return').onclick=event=>{event.preventDefault();navigations++;};f.w.combinedNavigation.decorate();
  const exit=f.d.querySelector('.combined-rail [data-combined-nav="os"]');assert.ok(exit,'OS exit is in visible rail');assert.equal(exit.textContent,'i64 OS');
  assert.equal(await f.w.combinedNavigation.go('os'),true);assert.equal(navigations,1);
  f.d.querySelector('[data-combined-group="develop"]').click();assert.ok(f.d.querySelector('#combined-phone-sheet [data-combined-nav="os"]'));
  bar.querySelector('.i64-return').href='https://example.com/writing/tea';f.w.combinedNavigation.decorate();
  assert.equal(f.d.querySelector('.combined-rail [data-combined-nav="os"]'),null);assert.equal(await f.w.combinedNavigation.go('os'),false);assert.equal(navigations,1);
 }finally{f.close();}
});
