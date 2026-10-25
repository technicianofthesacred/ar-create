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

test('collapsed section reopens from the visible Workbench title bar, surviving its repaint',()=>{
 const {w,d,close}=boot(3,{prefs:'{"3":false}',work:'<header id="c3-surface-bar"><div class="sb-left">Research</div><div class="sb-right"></div></header>'});
 const owner=d.querySelector('#wb-open');assert.strictEqual(owner.parentElement,d.querySelector('#c3-surface-bar>.sb-right'));assert.ok(owner.hasAttribute('data-c3-retain-control'));
 d.querySelector('#c3-surface-bar>.sb-left').append(owner);w.c3Workbench.decorate();assert.strictEqual(d.querySelector('#c3-surface-bar>.sb-right>#wb-open'),owner);owner.click();assert.ok(d.querySelector('#wb-panel'));assert.equal(d.querySelector('#wb-open'),null);close();
});

test('mobile current navigation follows the visible Bench or Pieces, preserving the return stage',()=>{
 const {w,d,close}=boot(11,{phone:true});try{
 const dialog=d.createElement('dialog');dialog.id='project-library';d.body.append(dialog);dialog.open=true;w.c3Workbench.decorate();
 assert.ok(d.querySelector('[data-wb-home][aria-current="page"]'));assert.equal(d.querySelector('.wb-bb[data-here]'),null);
 dialog.dataset.workbenchPieces='true';w.c3Workbench.decorate();assert.equal(d.querySelector('[data-wb-home][aria-current]'),null);assert.ok(d.querySelector('[data-wb-group="make"][data-here]'));
 dialog.open=false;w.c3Workbench.decorate();assert.ok(d.querySelector('[data-wb-group="deliver"][data-here]'));assert.equal(d.querySelector('.workflowStep[aria-current]').dataset.stage,'11');
 }finally{close();}
});

test('phone navigation uses the exact approved Bench and group icon paths',()=>{
 const{d,close}=boot(2,{phone:true});
 assert.equal(d.querySelector('[data-wb-home] path').getAttribute('d'),'M3 10h18M5 10v9M19 10v9M7 6h10M9 14h6');
 assert.equal(d.querySelector('[data-wb-group="develop"] path').getAttribute('d'),'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l4 4');
 assert.equal(d.querySelector('[data-wb-group="deliver"] path').getAttribute('d'),'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5');close();
});
test('generic Source and Outputs rows use domain icons without changing exact owner dispatch',()=>{
 const{d,stage,close}=boot(2,{work:'<select data-source-reader-select><option value="actual">Actual session</option></select><div id="output-overview"><div class="oo-row" data-overview-output="output-id"><span class="oo-meta">Article · Draft</span><button class="oo-title">Actual output</button></div></div>'});
 assert.equal(d.querySelector('[data-wb-fold] path').getAttribute('d'),'M4 4h16v16H4zM9 4v16');
 assert.equal(d.querySelector('[data-wb-row="sess:actual"] svg').getAttribute('aria-hidden'),'true');
 const owner=d.querySelector('.oo-title');let clicks=0;owner.onclick=()=>clicks++;stage(12);d.querySelector('[data-wb-row="out:output-id"] svg').dispatchEvent(new d.defaultView.MouseEvent('click',{bubbles:true}));assert.equal(clicks,1);assert.equal(d.querySelector('[data-wb-row="out:output-id"] .wbp-l').textContent,'Actual output');close();
});

test('phone section sheet exposes the approved Done action and returns to its opener',()=>{
 const{d,close}=boot(2,{phone:true,work:'<select data-source-reader-select><option>Actual session</option></select>'});
 d.querySelector('#wb-open').click();assert.equal(d.querySelector('[data-wb-fold]').textContent,'Done');d.querySelector('[data-wb-fold]').click();assert.equal(d.querySelector('#wb-panel'),null);assert.equal(d.activeElement.id,'wb-open');close();
});

test('Research record navigation opens the exact raw owner without points or a new write',()=>{
 const {d,close}=boot(3,{work:'<details class="flow-retained"><summary>Retained history</summary><article class="compactRecord"><details class="recordDetails"><summary>Details</summary><p>retained/research.md</p></details><div class="recordBody"><h1>Earlier inquiry</h1><p>Exact retained text</p></div></article></details>'});const original=d.querySelector('.compactRecord');const row=d.querySelector('[data-wb-row="rr:0"]');assert.ok(row);assert.match(row.textContent,/Earlier inquiry/);row.click();assert.ok(original.parentElement.open);assert.strictEqual(d.querySelector('.compactRecord'),original);assert.equal(d.querySelector('.recordDetails').open,false);close();
});
test('Media retained placements have a direct entrance with no native filter or photos',()=>{
 const {d,close}=boot(8,{work:'<div id="owned-photo-stage">No photos added yet</div><details data-retained-photo-records><summary>Earlier photo placements · read-only</summary><div class="stagePhotoGrid"><img src="/invented.jpg"></div></details>'});const retained=d.querySelector('[data-retained-photo-records]');const row=d.querySelector('[data-wb-row="mr:retained"]');assert.ok(row);row.click();assert.ok(retained.open);assert.strictEqual(d.querySelector('[data-retained-photo-records]'),retained);assert.equal(d.querySelector('[data-photo-occurrence]'),null);close();
});

const inquiryId='11111111-1111-4111-8111-111111111111',otherInquiry='22222222-2222-4222-8222-222222222222',inquiryHash='a'.repeat(64),inquiryCatalog=()=>({revision:1,indexHash:inquiryHash,collections:[{id:inquiryId,name:'Independent sunlight learning',question:'What changes sunlight?',sourceIds:[]},{id:otherInquiry,name:'Another question?',body:'# Question-shaped saved words?',sourceIds:[]}]});
test('Research lists exact independent Collections and marks only recorded questions through the same learning owner',async()=>{const {w,d,close}=boot(3,{work:'<section class="research-standard-point" data-research-point="p"><h2>Existing project point</h2></section>'});try{const opened=[];w.connectedWorkspace={readCollections:async()=>inquiryCatalog(),openContext:async(...args)=>opened.push(args)};w.c3Workbench.decorate();await tick();await tick();const row=d.querySelector('[data-wb-row="rc:'+inquiryId+'"]');assert.ok(row);assert.match(row.textContent,/Independent sunlight learning/);assert.ok(row.querySelector('[data-wb-question-marker]'));assert.equal(d.querySelector('[data-wb-row="rc:'+otherInquiry+'"] [data-wb-question-marker]'),null);assert.ok(d.querySelector('[data-wb-row="rp:0"]'));row.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(opened)),[['inquiries',{collectionId:inquiryId}]]);assert.equal(d.querySelector('.research-standard-point h2').textContent,'Existing project point');}finally{close();}});
test('Research Collection read failure leaves current points available and explicit retry uses the same read owner',async()=>{const {w,d,close}=boot(3,{work:'<section class="research-standard-point" data-research-point="p"><h2>Kept inquiry point</h2></section>'});try{let fail=true;w.connectedWorkspace={readCollections:async()=>{if(fail)throw Error('Local inquiry unavailable');return inquiryCatalog();},openContext:async()=>{}};w.c3Workbench.decorate();await tick();await tick();assert.match(d.querySelector('#wb-panel').textContent,/Collections.*unavailable/);assert.ok(d.querySelector('[data-wb-row="rp:0"]'));fail=false;d.querySelector('[data-wb-row="rc:refresh"]').click();await tick();await tick();assert.ok(d.querySelector('[data-wb-row="rc:'+inquiryId+'"]'));}finally{close();}});
test('Research guarded Collection refusal keeps the actual point nodes and never opens another stage',async()=>{const {w,d,close}=boot(3,{work:'<section class="research-standard-point" data-research-point="p"><h2>Kept point</h2><textarea>Pending question</textarea></section>'});try{let legacy=0;w.viewPhase=()=>legacy++;w.connectedWorkspace={readCollections:async()=>inquiryCatalog(),openContext:async()=>{throw Error('Keep the held work for review.');}};w.c3Workbench.decorate();await tick();await tick();const node=d.querySelector('[data-research-point]');d.querySelector('[data-wb-row="rc:'+inquiryId+'"]').click();await tick();assert.equal(d.querySelector('[data-research-point]'),node);assert.equal(node.querySelector('textarea').value,'Pending question');assert.equal(legacy,0);assert.match(d.querySelector('#wb-panel').textContent,/Keep the held work/);}finally{close();}});
test('a late Research Collection reply cannot populate a different section',async()=>{const {w,d,stage,close}=boot(3);try{let release;w.connectedWorkspace={readCollections:()=>new Promise(resolve=>release=resolve)};w.c3Workbench.decorate();stage(2);release(inquiryCatalog());await tick();assert.equal(d.querySelector('[data-wb-row="rc:'+inquiryId+'"]'),null);assert.equal(d.querySelector('#wb-panel').getAttribute('aria-label'),'Source sessions');}finally{close();}});

test('Research refuses an unknown Collection row and a stale project catalog without redirecting',async()=>{const {w,d,close}=boot(3);try{let projectId='project-one',release;const opened=[];w.current=()=>({id:projectId,view:'record',viewedStage:3});w.connectedWorkspace={readCollections:()=>new Promise(resolve=>release=resolve),openContext:async(...args)=>opened.push(args)};w.c3Workbench.decorate();projectId='project-two';release(inquiryCatalog());await tick();assert.equal(d.querySelector('[data-wb-row="rc:'+inquiryId+'"]'),null);w.connectedWorkspace.readCollections=async()=>inquiryCatalog();w.c3Workbench.decorate();await tick();await tick();const row=d.querySelector('[data-wb-row="rc:'+inquiryId+'"]');row.dataset.wbRow='rc:33333333-3333-4333-8333-333333333333';row.click();await tick();assert.equal(opened.length,0);projectId='project-three';row.dataset.wbRow='rc:'+inquiryId;row.click();await tick();assert.equal(opened.length,0);}finally{close();}});

test('Outputs panel mirrors loading and unavailable states instead of falsely claiming no outputs',()=>{
 const {w,d,close}=boot(12,{work:'<div id="output-overview"><p class="oo-empty" role="status">Reading this project’s outputs…</p></div>'});
 assert.match(d.querySelector('#wb-panel').textContent,/Reading this project’s outputs/);assert.doesNotMatch(d.querySelector('#wb-panel').textContent,/No outputs made yet/);
 const host=d.querySelector('#output-overview');host.innerHTML='<div class="oo-empty"><p role="status">Saved outputs are unavailable for this project.</p><button data-output-retry>Try again</button></div>';w.c3Workbench.decorate();assert.match(d.querySelector('#wb-panel').textContent,/Saved outputs are unavailable/);assert.doesNotMatch(d.querySelector('#wb-panel').textContent,/No outputs made yet/);
 host.innerHTML='<div class="oo-empty"><p role="alert">Reconnect to read saved outputs.</p></div>';w.c3Workbench.decorate();assert.match(d.querySelector('#wb-panel').textContent,/Reconnect to read saved outputs/);close();
});

test('Outputs panel forwards browser-copy owner without fabricating a native output identity',()=>{
 const {w,d,close}=boot(12,{work:'<div id="output-overview"><article class="oo-row" data-browser-carousel><button class="oo-title" data-output-browser-carousel>Current carousel</button></article><article class="oo-row" data-overview-output="saved"><span class="oo-meta">Article</span><button class="oo-title">Saved article</button></article></div>'});let clicks=0;d.querySelector('[data-output-browser-carousel]').onclick=()=>clicks++;assert.doesNotMatch(d.querySelector('#wb-panel').textContent,/No outputs made yet/);assert.match(d.querySelector('#wb-panel').textContent,/Browser copy/);assert.equal(d.querySelectorAll('[data-wb-row="browser-carousel"]').length,1);assert.ok(d.querySelector('[data-wb-row="out:saved"]'));d.querySelector('[data-wb-row="browser-carousel"]').click();assert.equal(clicks,1);assert.equal(d.querySelector('[data-browser-carousel]').hasAttribute('data-overview-output'),false);d.querySelector('[data-output-browser-carousel]').disabled=true;w.c3Workbench.decorate();assert.equal(d.querySelector('[data-wb-row="browser-carousel"]').disabled,true);close();
});

test('Research rail opens the same selected point and keeps the original pending editor',()=>{
 const {w,d,close}=boot(3,{work:'<div class="research-standard"><section class="research-standard-point" data-research-point="a"><h2>First finding</h2><textarea>First</textarea></section><section class="research-standard-point" data-research-point="b"><h2>Second finding</h2><textarea>Second</textarea></section></div>'});
 w.current=()=>({id:'synthetic',view:'record',viewedStage:3});w.eval(fs.readFileSync(new URL('../public/document-study/workbench-surfaces.js',import.meta.url),'utf8'));w.c3Workbench.decorate();const input=d.querySelector('textarea');input.value='Unsaved learning';
 d.querySelector('[data-wb-row="rp:1"]').click();assert.equal(d.querySelector('[data-research-point="b"]>.wb-point').open,true);assert.equal(d.querySelector('[data-research-point="a"]>.wb-point').open,false);assert.strictEqual(d.querySelector('textarea'),input);assert.equal(input.value,'Unsaved learning');assert.equal(d.activeElement,d.querySelector('[data-research-point="b"] summary'));close();
});

test('Source panel lists real conversation identities only and preserves owner option availability',async()=>{
 const {w,d,close}=boot(2,{work:'<select data-source-reader-select><option value="" selected>Choose a kept conversation</option><option value="a">Conversation A</option><option value="b" disabled>Unavailable conversation B</option></select>'});
 const select=d.querySelector('select'),placeholder=select.options[0];let changes=0;select.onchange=()=>changes++;
 assert.equal(d.querySelector('[data-wb-row="sess:"]'),null);
 assert.equal(d.querySelectorAll('[data-wb-row^="sess:"]').length,2);
 assert.equal(select.options[0],placeholder);assert.equal(select.value,'');assert.equal(changes,0);
 assert.equal(d.querySelector('[data-wb-row="sess:b"]').disabled,true);
 d.querySelector('[data-wb-row="sess:a"]').click();await tick();assert.equal(select.value,'a');assert.equal(changes,1);
 select.disabled=true;w.c3Workbench.decorate();assert.equal(d.querySelector('[data-wb-row="sess:a"]').disabled,true);close();
});

test('phone Pieces choice dismisses Make without swallowing or duplicating its maintained action',async()=>{
 const {w,d,close}=boot(5,{phone:true});try{const nav=d.querySelector('.workflowNavigation'),pieces=d.createElement('button');pieces.dataset.wbfPieces='';pieces.textContent='Pieces';nav.querySelector('.wn-family[data-family="make"]').prepend(pieces);let calls=0;pieces.addEventListener('click',()=>calls++);d.querySelector('button[data-wb-group="make"]').click();assert.ok(nav.classList.contains('cr-open'));pieces.click();await tick();assert.equal(calls,1);assert.equal(nav.classList.contains('cr-open'),false);assert.equal(nav.querySelector('.cr-picker').getAttribute('aria-expanded'),'false');assert.equal(d.querySelector('button[data-wb-group="make"]').getAttribute('aria-expanded'),'false');}finally{close();}
});
