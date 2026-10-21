import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/workbench-rail.js',import.meta.url),'utf8');
function boot(stage=2,{phone=false,prefs='{}',work=''}={}){
 const dom=new JSDOM('<div id="app"><div class="shell"><nav class="workflowNavigation c3-rail"><button data-tr-home>Home</button><button class="cr-picker"></button><div class="workflowSteps">'+[['gather',[1,2]],['develop',[3,4]],['make',[5,6,7,8,9]],['deliver',[10,11,12]]].map(([g,ns])=>`<div class="wn-family" data-family="${g}">${ns.map(n=>`<button class="workflowStep" data-stage="${n}" ${n===stage?'aria-current="step"':''}><span class="stepNumber">${n}</span><span class="stepName">Section ${n}</span></button>`).join('')}</div>`).join('')+'</div></nav><main id="workspace" class="workspace"><h1 class="c3-ctitle">Section</h1>'+work+'</main></div></div>',{url:'http://localhost',runScripts:'dangerously'});
 const w=dom.window,d=w.document;w.localStorage.setItem('c3-workbench-panel-v1',prefs);
 w.current=()=>({view:'record',viewedStage:stage});w.matchMedia=()=>({matches:phone,addEventListener(){}});
 w.c3Shell={register(_name,fn){this.decorate=fn;fn();}};
 w.eval(code);
 return {w,d,close:()=>setTimeout(()=>w.close(),0),stage(n){stage=n;for(const b of d.querySelectorAll('.workflowStep')){b.removeAttribute('aria-current');if(+b.dataset.stage===n)b.setAttribute('aria-current','step');}w.c3Workbench.decorate();}};
}
const tick=()=>new Promise(r=>setTimeout(r,0));
test('Source forwards sessions and index clicks to the existing owners; collapse persists per section',async()=>{
 const {w,d,stage,close}=boot(2,{work:'<select data-source-reader-select><option value="a">Conversation A</option><option value="b">Conversation B</option></select><div class="material-index"><h3>Versions</h3><div class="material-record"><strong>Revision one</strong><button>Open version</button></div></div>'});
 let changes=0,clicks=0;d.querySelector('select').onchange=()=>changes++;d.querySelector('.material-record button').onclick=()=>clicks++;
 d.querySelector('[data-wb-row="sess:b"]').click();await tick();assert.equal(d.querySelector('select').value,'b');assert.equal(changes,1);
 d.querySelector('[data-wb-row="idx:0"]').click();assert.equal(clicks,1);
 d.querySelector('.workflowStep[aria-current]').click();assert.equal(d.querySelector('#wb-panel'),null);assert.equal(JSON.parse(w.localStorage.getItem('c3-workbench-panel-v1'))[2],false);
 stage(8);assert.ok(d.querySelector('#wb-panel'));stage(2);assert.equal(d.querySelector('#wb-panel'),null);
 d.querySelector('#wb-open').click();assert.ok(d.querySelector('#wb-panel'));assert.equal(d.activeElement.dataset.wbRow,'sess:b');close();
});
test('Media uses only owner options, preserves disabled state and does not infer counts from filtered cards',()=>{
 const {w,d,close}=boot(8,{work:'<select data-mot-filter><option value="all">All media</option><option value="video">Video</option></select><div class="photo-thumb">One filtered card</div>'});
 let changes=0;d.querySelector('select').onchange=()=>changes++;
 assert.equal(d.querySelectorAll('.wbp-n').length,0);d.querySelector('[data-wb-row="mf:video"]').click();assert.equal(d.querySelector('select').value,'video');assert.equal(changes,1);
 d.querySelector('select').disabled=true;w.c3Workbench.decorate();assert.equal(d.querySelector('[data-wb-row="mf:all"]').disabled,true);close();
});
test('Research navigates real findings and never marks a guessed current finding',()=>{
 const {d,close}=boot(3,{work:'<details><section class="research-standard-point" data-research-point="p"><h2>A supplied finding</h2><textarea>Unsaved narration</textarea></section></details>'});
 const row=d.querySelector('[data-wb-row="rp:0"]');assert.equal(row.textContent,'A supplied finding');assert.equal(row.hasAttribute('aria-current'),false);row.click();assert.equal(d.querySelector('details').open,true);assert.equal(d.activeElement.tagName,'H2');assert.equal(d.querySelector('textarea').value,'Unsaved narration');close();
});
test('Research and Outputs forward actual owner controls, including current and disabled states',()=>{
 const {w,d,stage,close}=boot(3,{work:'<button data-rpb-point="a" aria-current="true">Point A</button><button data-rpb-point="b">Point B</button>'});
 let clicks=0;d.querySelector('[data-rpb-point="b"]').onclick=()=>clicks++;d.querySelector('[data-wb-row="rp:1"]').click();assert.equal(clicks,1);assert.ok(d.querySelector('[data-wb-row="rp:0"][aria-current]'));
 d.querySelector('#workspace').insertAdjacentHTML('beforeend','<div id="output-overview"><div class="oo-row" data-overview-output="safe:id"><span class="oo-meta">Article · Draft</span><button class="oo-title">Own output</button></div></div>');stage(12);d.querySelector('.oo-title').onclick=()=>clicks++;d.querySelector('[data-wb-row="out:safe:id"]').click();assert.equal(clicks,2);assert.equal(d.querySelector('[data-wb-row="out:safe:id"]').hasAttribute('aria-current'),false);close();
});
test('phone groups open only their tools; panel sheet closes after a choice and Escape',async()=>{
 const {w,d,stage,close}=boot(2,{phone:true,work:'<select data-source-reader-select><option value="a">Conversation</option></select>'});
 assert.equal(d.querySelector('#wb-panel'),null);d.querySelector('button[data-wb-group="make"]').click();assert.ok(d.querySelector('.cr-open[data-wb-group="make"]'));assert.equal(d.activeElement.dataset.stage,'5');assert.equal(d.querySelector('button[data-wb-group="make"]').getAttribute('aria-expanded'),'true');
 d.querySelector('button[data-wb-group="make"]').click();assert.equal(d.querySelector('.cr-open'),null);
 d.querySelector('#wb-open').click();assert.ok(d.body.classList.contains('wb-panel-sheet'));d.querySelector('[data-wb-row]').click();await tick();assert.equal(d.querySelector('#wb-panel'),null);
 d.querySelector('#wb-open').click();d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('#wb-panel'),null);assert.equal(d.activeElement.id,'wb-open');
 d.querySelector('#wb-open').click();stage(8);assert.equal(d.querySelector('#wb-panel'),null);close();
});
test('keyboard navigation changes focus only, and the collapse shortcut leaves text fields alone',()=>{
 const {w,d,close}=boot(2,{work:'<select data-source-reader-select><option>Conversation</option></select><textarea>Draft</textarea>'});
 const current=d.querySelector('.workflowStep[aria-current]');current.focus();current.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(d.activeElement.dataset.stage,'3');assert.equal(current.getAttribute('aria-current'),'step');
 const input=d.querySelector('textarea');input.focus();input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'[',bubbles:true}));assert.ok(d.querySelector('#wb-panel'));
 current.focus();current.dispatchEvent(new w.KeyboardEvent('keydown',{key:'[',bubbles:true}));assert.equal(d.querySelector('#wb-panel'),null);close();
});
test('Library occupies canonical step one; Inbox keeps its real handler and All sources forwards to its Library owner',()=>{
 const {w,d,close}=boot(1);
 const owner=d.querySelector('[data-stage="1"]');owner.querySelector('.stepName').textContent='Material';owner.setAttribute('aria-label','View step 1: Material');
 const foot=d.createElement('div');foot.className='tr-find';foot.innerHTML='<button data-tr-topics>Learning library</button>';d.querySelector('.workflowNavigation').append(foot);
 let ingests=0,libraries=0;owner.onclick=()=>ingests++;foot.firstElementChild.onclick=()=>libraries++;
 w.c3Workbench.decorate();
 assert.equal(owner.querySelector('.stepName').textContent,'Library');assert.equal(owner.querySelector('.stepNumber').textContent,'1');assert.equal(owner.getAttribute('aria-label'),'View step 1: Library');
 const rows=[...d.querySelectorAll('[data-wb-row]')];assert.deepEqual(rows.map(n=>n.querySelector('.wbp-l').textContent),['Inbox','All sources']);assert.equal(rows[0].getAttribute('aria-current'),'true');assert.equal(rows[1].hasAttribute('aria-current'),false);
 rows[0].click();assert.equal(ingests,1);assert.ok(d.querySelector('#wb-panel'),'forwarding to the Inbox owner does not collapse the panel');
 d.querySelector('[data-wb-row="lib:all"]').click();assert.equal(libraries,1);assert.equal(d.querySelector('[data-wb-row*="unsorted"]'),null);close();
});
test('real shell, canvas and empty-state mounts settle on phone Media without competing for the title sibling',async()=>{
 const dom=new JSDOM('<div id="app"><div class="shell"><nav class="workflowNavigation c3-rail"><div class="wn-family" data-family="make"><button class="workflowStep" aria-current="step"><span class="stepNumber">8</span><span class="stepName">Media</span></button></div></nav><main class="workspace" id="workspace"><div id="owned-photo-stage">No photos added yet</div><div id="owned-photos-mount"></div><button data-add>Add</button></main></div></div>',{url:'http://localhost',runScripts:'dangerously'});
 const w=dom.window,d=w.document;w.current=()=>({id:'synthetic',view:'record',viewedStage:8});w.render=()=>{};w.matchMedia=()=>({matches:true,addEventListener(){}});
 // Bound the observer during regression testing so an accidental infinite mutation loop fails rather than hanging Node.
 const NativeObserver=w.MutationObserver,observers=[];let rounds=0,exhausted=false;
 w.MutationObserver=class extends NativeObserver{constructor(callback){super((records,observer)=>{if(++rounds>30){exhausted=true;observer.disconnect();return;}callback(records,observer);});observers.push(this);}};
 for(const file of ['shell.js','canvas-c3.js','empty-states.js'])w.eval(fs.readFileSync(new URL('../public/document-study/'+file,import.meta.url),'utf8'));
 w.eval(code);await tick();
 assert.equal(exhausted,false,'decorators converge instead of endlessly scheduling the shell');
 assert.ok(d.querySelector('.c3-ctitle>#wb-open'),'the opener belongs inside the title');
 assert.ok(d.querySelector('.c3-ctitle+.c3-empty'),'the empty card retains its actual title sibling');
 const settled=rounds;w.c3Shell.run();await tick();assert.equal(rounds,settled,'another full mount pass creates no child-list mutations');for(const observer of observers)observer.disconnect();w.close();
});
