import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));const {JSDOM}=require('jsdom');
const stage=fs.readFileSync(new URL('../public/document-study/stage-flow.js',import.meta.url),'utf8'),surface=fs.readFileSync(new URL('../public/document-study/material-surface.js',import.meta.url),'utf8');
const binding={projectKey:'synthetic-room',projectId:'saved-project',documentId:'saved-piece'},JOB='11111111-2222-3333-4444-555555555555';
const res=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const flow={projectId:binding.projectId,materials:[{sourceId:'rec-audio',title:'Invented studio talk',kind:'audio',path:'/x/talk.m4a',hash:'a',job:{id:JOB,state:'done',transcriptReady:true}}],paths:{source:'/x/source.md'},step:'review'};
const snapshot={jobId:JOB,segments:[{index:0,start:0,end:4,speaker:'S0',text:'First invented words.'},{index:1,start:65.4,end:70,speaker:'S1',text:'Second line spoken later.'},{index:2,start:130,end:135,speaker:'S0',text:'Third line.'}],result:{speakers:[{id:'S0',name:'Ana'},{id:'S1',name:null}]}};
const flush=()=>new Promise(r=>setTimeout(r,5));
async function setup(t,{snap=()=>res(200,snapshot),clipboard}={}){
 const dom=new JSDOM('<main id="workspace"></main>',{url:'http://127.0.0.1:8872',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,calls=[],players=[];
 w.fetch=async url=>{calls.push(url);if(url.startsWith('/api/first-flow/binding?'))return res(200,binding);if(url==='/api/first-flow/select')return res(200,binding);if(url.startsWith('/api/first-flow?'))return res(200,flow);if(url.startsWith('/transcription/'))return snap(url);throw Error('Unexpected request '+url)};
 w.Audio=class{constructor(src){this.src=src;this.currentTime=0;this.paused=true;this.readyState=1;this.l={};players.push(this)}addEventListener(n,f){(this.l[n]||=[]).push(f)}play(){this.paused=false;return Promise.resolve()}fire(n){(this.l[n]||[]).forEach(f=>f())}};
 w.Element.prototype.scrollIntoView=function(){w.__scrolled=this.dataset.srcI};
 if(clipboard)Object.defineProperty(w.navigator,'clipboard',{value:clipboard,configurable:true});
 w.eval(`var state={projects:[{id:'synthetic-room',name:'Invented project',view:'record',viewedStage:2}]};var selectedRoom='synthetic-room';function current(){return state.projects.find(p=>p.id===selectedRoom)};var WORKFLOW_RECORDS={'synthetic-room':{stages:{'2':[{name:'SRC - Written note.md',path:'Workflow/SRC - Written note.md',raw:'Plain written words.'}]}}},ORIGINAL_STEPS=['Material','Source'];function esc(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))};function createLocalProject(){}function modalHTML(){return ''}var modal=null;function workflowBar(){return ''}function historicalNotice(){return ''}function phaseReader(){return ''}function render(){document.getElementById('workspace').innerHTML=phaseReader(current())}function save(){}function viewPhase(n){current().viewedStage=n;render()}function toast(){};`);
 w.eval(fs.readFileSync(new URL('../public/document-study/display-format.js',import.meta.url),'utf8'));w.eval(surface);w.eval(stage);
 await flush();await flush();await flush();return {w,calls,players,doc:w.document};
}
const tab=(f,label)=>[...f.doc.querySelectorAll('[data-flow-action^="history:"]')].find(b=>b.closest('.material-record')?.textContent.includes(label));
async function openRecording(f){const b=tab(f,'Invented studio talk')||f.doc.querySelector('[data-flow-action="history:1"]');assert.ok(b,'recording is listed among the project sources');b.click();await flush();await flush();await flush()}
function select(f,li){const range=f.doc.createRange();range.selectNodeContents(li.querySelector('.src-words'));const sel=f.w.getSelection();sel.removeAllRanges();sel.addRange(range);f.doc.dispatchEvent(new f.w.Event('selectionchange'))}

test('a recording-backed source shows timed lines with mm:ss, speaker names and words',async t=>{
 const f=await setup(t);await openRecording(f);
 assert.ok(f.calls.includes('/transcription/'+JOB+'/snapshot?readOnly=1'),'snapshot is read with readOnly=1');
 assert.ok(!f.calls.some(u=>u.startsWith('/transcription/')&&!u.includes('readOnly=1')));
 const top=f.doc.querySelector('.src-top');assert.match(top.textContent,/▶ Play from start/);assert.match(top.textContent,/Invented studio talk/);
 const lines=[...f.doc.querySelectorAll('.src-line')];assert.equal(lines.length,3);
 assert.deepEqual(lines.map(l=>l.querySelector('.src-time').textContent),['00:00','01:05','02:10']);
 assert.deepEqual(lines.map(l=>l.querySelector('.src-who').textContent),['Ana','Speaker 2','Ana']);
 assert.equal(lines[1].querySelector('.src-words').textContent,'Second line spoken later.');
 assert.equal(f.doc.querySelectorAll('.src-timed textarea, .src-timed input, .src-timed [contenteditable]').length,0,'read-only');
});
test('pressing a time seeks and plays; the current line lights while playing and is kept in view',async t=>{
 const f=await setup(t);await openRecording(f);
 f.doc.querySelectorAll('.src-time')[1].click();const p=f.players.at(-1);
 assert.equal(p.src,'/transcription/'+JOB+'/audio');assert.equal(p.currentTime,65.4);assert.equal(p.paused,false);
 assert.deepEqual([...f.doc.querySelectorAll('.src-line.is-lit')].map(l=>l.dataset.srcI),['1']);
 p.currentTime=131;p.fire('timeupdate');
 assert.deepEqual([...f.doc.querySelectorAll('.src-line.is-lit')].map(l=>l.dataset.srcI),['2']);assert.equal(f.w.__scrolled,'2');
 f.doc.querySelector('.src-play').click();assert.equal(p.currentTime,0);assert.deepEqual([...f.doc.querySelectorAll('.src-line.is-lit')].map(l=>l.dataset.srcI),['0']);
});
test('selecting words in a line offers Copy quote with its time and copies the quote',async t=>{
 const written=[];const f=await setup(t,{clipboard:{writeText:async v=>{written.push(v)}}});await openRecording(f);
 const copy=f.doc.querySelector('[data-src-copy]');assert.equal(copy.hidden,true);
 select(f,f.doc.querySelectorAll('.src-line')[1]);assert.equal(copy.hidden,false);assert.equal(copy.textContent,'Copy quote with 01:05');
 copy.click();await flush();
 assert.deepEqual(written,['“Second line spoken later.” — Speaker 2, 01:05, Invented studio talk']);assert.equal(copy.textContent,'Copied');
});
test('clipboard failure falls back to keeping the words selected',async t=>{
 const f=await setup(t,{clipboard:{writeText:async()=>{throw Error('denied')}}});await openRecording(f);
 const li=f.doc.querySelectorAll('.src-line')[2];select(f,li);const copy=f.doc.querySelector('[data-src-copy]');copy.click();await flush();
 assert.equal(String(f.w.getSelection()).trim(),'Third line.');assert.match(copy.textContent,/⌘C/);
});
test('a selection spanning two lines offers nothing',async t=>{
 const f=await setup(t);await openRecording(f);const [a,b]=f.doc.querySelectorAll('.src-words');const r=f.doc.createRange();r.setStart(a.firstChild,0);r.setEnd(b.firstChild,3);const s=f.w.getSelection();s.removeAllRanges();s.addRange(r);f.doc.dispatchEvent(new f.w.Event('selectionchange'));
 assert.equal(f.doc.querySelector('[data-src-copy]').hidden,true);
});
test('an unreadable transcript is an honest not-connected note, not an empty list',async t=>{
 const f=await setup(t,{snap:()=>res(400,{error:'nope'})});await openRecording(f);
 assert.match(f.doc.querySelector('.src-note').textContent,/not connected/i);assert.equal(f.doc.querySelectorAll('.src-line').length,0);
});
test('a written source keeps the prose view with one quiet label',async t=>{
 const f=await setup(t);const b=f.doc.querySelector('[data-flow-action="history:0"]');assert.ok(b);b.click();await flush();
 const text=f.doc.getElementById('workspace').textContent;assert.match(text,/Plain written words\./);assert.match(text,/Written source · no recording/);assert.equal(f.doc.querySelectorAll('.src-line').length,0);
});
