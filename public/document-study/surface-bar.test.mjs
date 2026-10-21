import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./surface-bar.js',import.meta.url),'utf8'),pieceState=fs.readFileSync(new URL('./piece-state.js',import.meta.url),'utf8');

// The rows as study.js, draft-surface, workspace-navigation and i64-return leave them in Write.
const rows=({saved='Saved on this device',revisionsDisabled=true}={})=>`<div class="shell"><main class="workspace"><header class="topbar"><button class="mobileProjects">☰</button><h1>Kiln piece</h1><button data-surface-action data-surface-mode="margin" aria-pressed="true" onclick="calls.push('margin')">Margin</button><button data-surface-action data-surface-mode="focus" aria-pressed="false" onclick="calls.push('focus')">Focus</button><select class="themeSelect"><option>System</option></select><a class="i64-return" href="http://127.0.0.1:8888/ar-create" aria-label="Return to i64 OS">i64 OS</a></header><section id="work-context"><div class="wn-identity"><strong>Clay article</strong><span>Article · English</span><select data-wn-piece aria-label="Choose piece"><option value="">Working manuscript</option><option value="o1" selected>Clay article · Article</option></select></div><div class="wn-actions"><button data-wn-outputs onclick="calls.push('outputs')">Outputs</button><details class="wn-new"><summary>New output</summary><div><button data-wn-create="article" onclick="calls.push('create-article')">Article</button><button data-wn-create="post" disabled>Post</button></div></details></div><p id="wn-message" role="status" hidden></p></section><nav class="workbar"><button hidden onclick="calls.push('hidden')">Open current working words</button><button onclick="undo()">Undo typing</button><details><summary>More</summary><button onmousedown="event.preventDefault()" onclick="openInstruction()">Discuss wording</button><button onclick="modal='history';render()">History</button><button onclick="calls.push('study')">Study details</button><button data-draft-action="revisions" ${revisionsDisabled?'disabled':''}>Revisions</button></details><span class="saved" role="status">${saved}</span></nav><section id="direction-writing-tools" class="direction-writing-tools"><div class="dwt-orientation"><nav><button data-dwt-action="voice" onclick="calls.push('voice')">Voice</button><button data-dwt-action="positions">Perspective</button></nav></div><section class="dwt-panel"></section></section><section class="draft-bar"><span data-draft-status role="status">Not saved. Your words are still here.</span><button onclick="calls.push('retry')">Retry exact save</button></section><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>`;
function fixture(opts){
 const dom=new JSDOM(`<div id="app">${rows(opts)}</div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.calls=[];w.modal=null;
 w.state={project:'p1',projects:[{id:'p1',name:'Kiln piece',view:'article',blocks:[{tag:'p',html:'Unsaved human writing'}]}]};
 w.current=()=>w.state.projects[0];
 w.undo=()=>w.calls.push('undo');w.openInstruction=()=>w.calls.push('instruction');
 w.render=()=>{w.document.getElementById('app').innerHTML=rows(opts);};
 if(opts?.draft)w.studyDraft={currentBinding:()=>({id:'b1',title:'Clay article'}),currentProof:()=>({bindingId:'b1',dirty:false,sequence:3}),flush:async()=>({dirty:false})};
 w.eval(fs.readFileSync(new URL('./shell.js',import.meta.url),'utf8'));w.eval(pieceState);w.eval(code);
 return {w,d:w.document,bar:()=>w.document.querySelector('#c3-surface-bar')};
}
const press=(f,sel)=>{const b=f.bar().querySelector(sel);assert.ok(b,'missing '+sel);b.click();};

test('one bar: where you are and one state word on the left, exactly one primary on the right, no bottom bar',()=>{
 const f=fixture(),bar=f.bar();
 assert.equal(bar.parentElement,f.d.querySelector('.workspace'));
 assert.equal(f.d.querySelector('.workspace').firstElementChild,bar);
 assert.equal(f.d.getElementById('c3-crumb'),null,'no bottom location bar');
 assert.match(bar.querySelector('.sb-piece').textContent,/Kiln piece/);
 assert.ok(bar.querySelector('.sb-oselect'),'output switch in the bar');
 assert.match(bar.querySelector('.sb-status').textContent,/Saved on this device/);
 assert.equal(bar.querySelector('.sb-ret').getAttribute('href'),'http://127.0.0.1:8888/ar-create');
 assert.ok(bar.querySelector('[aria-label="Undo"]'));
 assert.equal(bar.querySelector('.sb-right [aria-label^="History"]'),null,'History is in More');
 assert.equal(bar.querySelector('.sb-primary').textContent,'Ask about words','the C1 primary for Write with words');
 assert.equal(bar.querySelectorAll('.sb-primary').length,1);
});

test('every bar control presses the real control; nothing is reimplemented',()=>{
 const f=fixture();
 press(f,'[aria-label="Undo"]');
 press(f,'.sb-primary');
 const focus=[...f.bar().querySelectorAll('.sb-btn')].find(b=>b.textContent.includes('Focus'));focus.click();
 press(f,'[data-sb-more]');[...f.bar().querySelectorAll('.sb-menu .sb-item')].find(b=>b.textContent==='Outputs').click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['undo','instruction','focus','outputs']);
 press(f,'[data-sb-more]');press(f,'.sb-menu [aria-label^="History"]');
 assert.equal(f.w.modal,'history');
 assert.ok(f.bar(),'bar rebuilt after the full render History triggers');
});

test('More lists the remaining real controls, keeps disabled ones disabled and skips hidden ones',()=>{
 const f=fixture();
 press(f,'[data-sb-more]');
 const items=[...f.bar().querySelectorAll('.sb-menu .sb-item')].map(b=>[b.textContent.replace(/\s+/g,' ').trim(),b.disabled]);
 assert.deepEqual(JSON.parse(JSON.stringify(items)),[['Outputs',false],['History · every saved version',false],['A−',false],['A+',false],['New output · Article',false],['New output · Post',true],['Study details',false],['Revisions',true],['Voice',false],['Perspective',false]]);
 assert.equal(f.bar().textContent.includes('Open current working words'),false);
 [...f.bar().querySelectorAll('.sb-menu .sb-item')].find(b=>b.textContent.includes('Study details')).click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['study']);
 assert.equal(f.bar().querySelector('.sb-menu'),null,'menu closes after choosing');
});

test('output choice goes through the real select and its change event',()=>{
 const f=fixture();let seen=null;
 f.d.querySelector('[data-wn-piece]').addEventListener('change',e=>{seen=e.target.value;});
 const s=f.bar().querySelector('.sb-oselect');
 s.value='';s.dispatchEvent(new f.w.Event('change',{bubbles:true}));
 assert.equal(seen,'');
 assert.equal(f.d.querySelector('[data-wn-piece]').value,'');
});

test('the save notice and failed-save recovery are left alone; status follows the owner',async()=>{
 const f=fixture();
 const draft=f.d.querySelector('.draft-bar');
 assert.equal(draft.hidden,false);
 assert.equal(f.bar().contains(draft.querySelector('button')),false);
 assert.equal(f.bar().textContent.includes('Retry exact save'),false,'recovery stays in its own visible notice');
 f.d.querySelector('.workbar .saved').textContent='Save failed · words kept';
 await new Promise(r=>setTimeout(r,0));
 assert.match(f.bar().querySelector('.sb-status').textContent,/Save failed · words kept/);
 assert.equal(f.bar().querySelector('.sb-status').dataset.tone,'bad');
 assert.equal(f.d.querySelector('#manuscript').textContent,'Unsaved human writing');
});

test('the direction tools move into More; choosing one presses the real button so its panel opens in place',()=>{
 const f=fixture();
 press(f,'[data-sb-more]');
 assert.ok([...f.bar().querySelectorAll('.sb-gh')].some(h=>h.textContent==='Direction and voice'));
 [...f.bar().querySelectorAll('.sb-menu .sb-item')].find(b=>b.textContent.trim()==='Voice').click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['voice']);
 assert.ok(f.d.querySelector('#direction-writing-tools .dwt-panel'),'panel stays in the page');
});

test('in Check, with a saved draft, Run checks presses the check panel’s own run button',()=>{
 const f=fixture({draft:true});
 f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=7;
 f.d.querySelector('.workspace').insertAdjacentHTML('beforeend','<aside class="wn-check-findings"><button data-current-check="run" onclick="calls.push(\'run-check\')">Check saved draft</button></aside>');
 f.w.surfaceBar.build();
 const p=f.bar().querySelectorAll('.sb-primary');
 assert.equal(p.length,1);
 assert.equal(p[0].textContent,'Run checks');
 p[0].click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['run-check']);
});

test('in Material, Add files presses the lane’s own button',()=>{
 const f=fixture();
 f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=1;
 f.d.querySelector('.workspace').insertAdjacentHTML('beforeend','<section class="phaseReader"><button data-flow-action="files" onclick="calls.push(\'files\')">Add files</button></section>');
 f.w.surfaceBar.build();
 const p=f.bar().querySelectorAll('.sb-primary');
 assert.equal(p.length,1);assert.equal(p[0].textContent,'Add files');
 p[0].click();assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['files']);
});

test('in Direction, Save direction is the primary and the angle tools stay on the page, not in More',()=>{
 const f=fixture();
 f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=4;
 f.d.querySelector('.workspace').insertAdjacentHTML('beforeend','<section class="phaseReader"><textarea data-human-direction></textarea><button data-direction-save onclick="calls.push(\'save-direction\')">Save direction</button></section>');
 f.w.surfaceBar.build();
 assert.notEqual(f.bar().querySelector('.sb-primary').textContent,'Save direction','nothing typed, nothing to save');
 f.d.querySelector('[data-human-direction]').value='Open with the gate';f.w.surfaceBar.build();
 assert.equal(f.bar().querySelector('.sb-primary').textContent,'Save direction');
 f.bar().querySelector('.sb-primary').click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['save-direction']);
 press(f,'[data-sb-more]');
 assert.equal([...f.bar().querySelectorAll('.sb-gh')].some(h=>h.textContent==='Direction and voice'),false);
});

test('Media and Arrange press their own Upload photos and Audience view buttons as the primary',()=>{
 for(const [stage,html,label,call] of [[8,'<section class="study-photos"><button data-add onclick="calls.push(\'upload\')">Upload photos</button></section>','Add media','upload'],[9,'<section class="oss-surface"><button data-oss-action="look" onclick="calls.push(\'look\')">Audience view</button></section>','Audience view','look']]){
  const f=fixture();f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=stage;
  f.d.querySelector('.workspace').insertAdjacentHTML('beforeend',html);f.w.surfaceBar.build();
  const p=f.bar().querySelector('.sb-primary');assert.equal(p.textContent,label);p.click();assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),[call]);
 }
});

test('Share: an empty invitation asks to write it; a written one presses the app’s own Save invitation',()=>{
 const f=fixture();f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=11;
 f.d.querySelector('.workspace').insertAdjacentHTML('beforeend','<section class="oss-surface"><textarea data-share-field="message"></textarea><button data-share-action="save" onclick="calls.push(\'copy\')">Save invitation</button></section>');f.w.surfaceBar.build();
 assert.equal(f.bar().querySelector('.sb-primary').textContent,'Write invitation');
 f.d.querySelector('[data-share-field="message"]').value='Thank you';f.w.surfaceBar.build();
 const p=f.bar().querySelector('.sb-primary');assert.equal(p.textContent,'Save invitation');p.click();assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['copy']);
});

test('the read-only notice row joins the bar: the state word says why, and its button is a bar action',()=>{
 const f=fixture();f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=6;
 f.d.querySelector('.workspace').insertAdjacentHTML('beforeend','<div class="historicalToolbar"><span>Read-only snapshot · working copy kept separate</span><button onclick="calls.push(\'open-words\')">Open working words</button></div>');
 f.w.surfaceBar.build();
 assert.equal(f.bar().querySelector('.sb-ro').textContent,'Retained record · read-only','identifies the actual retained view');
 const m=f.bar().querySelector('.sb-mode');m.click();
 assert.deepEqual(JSON.parse(JSON.stringify(f.w.calls)),['open-words']);
});

test('a retained-record select is a labelled control in the column, not machine text in the bar',()=>{
 const f=fixture();f.w.state.projects[0].view='record';f.w.state.projects[0].viewedStage=7;let seen=null;
 f.d.querySelector('.workspace').insertAdjacentHTML('beforeend','<div class="historicalToolbar"><span>Read-only snapshot</span><select aria-label="Jump to retained record"><option value="">Records (2)</option><option value="r1">CHK - 2026-10-01 receipt</option></select><button>Open working words</button></div><section class="phaseReader"><p>Findings</p></section>');
 f.d.querySelector('.historicalToolbar select').addEventListener('change',e=>{seen=e.target.value;});
 f.w.surfaceBar.build();
 assert.equal(f.bar().querySelector('select:not(.sb-oselect)'),null);
 const box=f.d.querySelector('.phaseReader>#c3-records');assert.ok(box);assert.match(box.textContent,/Checked against/);
 const s=box.querySelector('select');s.value='r1';s.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(seen,'r1');
});

test('long titles are trimmed in the middle so both ends stay readable; the full title is the tooltip',()=>{
 const f=fixture();
 f.w.state.projects[0].name='Seven Lessons from the Wood-Fired Kiln in Jianshui, Yunnan';f.w.surfaceBar.build();
 const seg=f.bar().querySelector('.sb-piece');
 assert.ok(seg.textContent.length<=32,seg.textContent);
 assert.match(seg.textContent,/^Seven Lessons.*….*Yunnan$/);
 assert.equal(seg.title,'Seven Lessons from the Wood-Fired Kiln in Jianshui, Yunnan');
});


test('connected work receipt inputs and recovery stay with their visible owner, never bar proxies',()=>{
 const f=fixture(),owner=f.d.createElement('details');owner.id='connected-work-receipts';owner.innerHTML='<summary>Work receipts</summary><textarea data-field="desired">Exact pending author task</textarea><p role="status">Outcome pending</p><button>Retry exact operation</button>';f.d.querySelector('#work-context').append(owner);f.w.surfaceBar.build();
 assert.equal(f.d.getElementById('connected-work-receipts'),owner);assert.equal(owner.querySelector('textarea').value,'Exact pending author task');assert.equal(f.bar().textContent.includes('Retry exact operation'),false);
});

test('a failed save offers Try again, which asks the save owner to save once more; a good save does not',async()=>{
 const failed=fixture({saved:'Could not save. Your words are kept here.'});
 let saves=0;failed.w.studyDraft={flush:async()=>{saves++;return {dirty:false};}};
 failed.w.surfaceBar.build();
 const retry=failed.bar().querySelector('[data-cb-retry]');
 assert.ok(retry,'Try again on a failed save');
 assert.equal(retry.textContent,'Try again');
 retry.click();await new Promise(r=>setTimeout(r,10));
 assert.equal(saves,1);
 const ok=fixture();ok.w.studyDraft={flush:async()=>{}};ok.w.surfaceBar.build();
 assert.equal(ok.bar().querySelector('[data-cb-retry]'),null);
});

test('work receipts have no strip of their own: More → Receipts opens them, still owned by their panel',()=>{
 const f=fixture(),owner=f.d.createElement('details');owner.id='connected-work-receipts';owner.innerHTML='<summary>Work receipts</summary><p>Saved r3</p>';f.d.querySelector('#work-context').append(owner);f.w.surfaceBar.build();
 press(f,'[data-sb-more]');
 const item=f.bar().querySelector('[data-sb-receipts]');assert.ok(item,'Receipts in More');item.click();
 const dialog=f.d.getElementById('c3-receipts');assert.ok(dialog?.hasAttribute('open'));
 assert.equal(f.d.getElementById('connected-work-receipts'),owner,'the same panel, moved');assert.ok(dialog.contains(owner));assert.equal(owner.open,true);
});
