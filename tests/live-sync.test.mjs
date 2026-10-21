// Live sync, presence, conflicts, leases, Recent changes, questions and Home (review A8, C2, C3, F-25, F-26, F-30), and the
// release sha on /api/i64os/health (B3). The browser half runs the real page scripts in jsdom over the real draft owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createServer} from '../runtime/server.mjs';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const dir=new URL('../public/document-study/',import.meta.url),read=f=>fs.readFileSync(new URL(f,dir),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const tick=(ms=40)=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,ms=3000)=>{const end=Date.now()+ms;while(Date.now()<end){if(fn())return true;await tick(20);}return false;};

// ---------- B3: health names the release
test('/api/i64os/health returns the release sha it was given, and null when there is none',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ar-live-health-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'vault'));fs.mkdirSync(path.join(root,'files'));
 const start=async release=>{const server=await createServer({dataDir:path.join(root,'data-'+randomUUID()),publicDir:path.join(root,'public'),studyOriginalRoots:{vaultRoot:path.join(root,'vault'),filesRoot:path.join(root,'files')},researchEnabled:false,release});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return 'http://127.0.0.1:'+server.address().port;};
 const sha='0f562ad1c0ffee0000000000000000000000beef';
 assert.deepEqual(await (await fetch(await start({sha,at:'2026-10-21T00:00:00Z'})+'/api/i64os/health')).json(),{service:'ar-create-document-study',ready:true,release:{sha}});
 assert.deepEqual(await (await fetch(await start(null)+'/api/i64os/health')).json(),{service:'ar-create-document-study',ready:true,release:{sha:null}});
 assert.equal((await (await fetch(await start({sha:'not a sha'})+'/api/i64os/health')).json()).release.sha,null);
 const base=await start({sha});assert.equal((await fetch(base+'/api/i64os/health',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'})).status,405,'still read-only');
});

// ---------- the shell's one event stream
function shellPage(){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,sources=[],fetched=[];
 class FakeSource{constructor(url){this.url=url;this.handlers={};this.readyState=0;sources.push(this);queueMicrotask(()=>this.onopen?.());}addEventListener(type,fn){(this.handlers[type]||=[]).push(fn);}send(type,data){for(const fn of this.handlers[type]||[])fn({data:JSON.stringify(data)});}close(){this.readyState=2;this.closed=true;}}
 w.EventSource=FakeSource;w.fetch=async url=>{fetched.push(url);return {ok:true,json:async()=>({cursor:5,bootId:'boot-1',events:[]})};};
 w.eval(read('shell.js'));return {w,dom,sources,fetched};
}
test('one event stream: resumes from the last cursor, filters by record, drops repeats and resets on a new boot',async()=>{
 const {w,dom,sources}=shellPage();const got=[],all=[];
 w.c3Shell.live.on({kind:'draft',id:'d1'},e=>got.push(e));w.c3Shell.live.on({},e=>all.push(e));
 assert.ok(await until(()=>sources.length===1));
 assert.equal(sources[0].url,'/api/events?since=5','starts where the stream stands');
 await until(()=>w.c3Shell.live.connected());
 const change=(cursor,scope,bootId='boot-1')=>sources.at(-1).send('change',{cursor,bootId,kind:'study-draft.save',scope,actor:'agent:claude-code',at:new Date().toISOString()});
 change(6,{kind:'draft',id:'d1'});change(7,{kind:'draft',id:'other'});change(7,{kind:'draft',id:'d1'});
 assert.deepEqual(got.map(e=>e.cursor),[6],'matching record only, never twice');assert.deepEqual(all.map(e=>e.cursor),[6,7]);
 // The connection drops: it reopens from cursor 7, not from the first URL.
 sources.at(-1).onerror();assert.equal(w.c3Shell.live.connected(),false);
 assert.ok(await until(()=>sources.length===2,2500),'reconnects');assert.equal(sources[1].url,'/api/events?since=7');
 // The server restarted: everything is re-read.
 change(1,{kind:'draft',id:'d1'},'boot-2');assert.equal(got.at(-1).reset,true);assert.equal(all.at(-1).reset,true);
 sources.at(-1).send('reset',{bootId:'boot-3',cursor:0});assert.equal(got.filter(e=>e.reset).length,2);
 assert.equal(w.c3Shell.actorName('agent:claude-code'),'Claude');assert.equal(w.c3Shell.actorName('agent:codex'),'Codex');assert.equal(w.c3Shell.actorName('human:adrian'),'You');
 w.c3Shell.live.stop();dom.window.close();
});

// ---------- the draft: live refresh, conflicts that name who saved, Keep mine, presence, 423
async function owner(){const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-live-ui-'))),service=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>null}}),parentStudyId='live-piece';const d=await service.createCollection({parentStudyId,title:'Live piece',operationId:randomUUID()});return {service,parentStudyId,bindingId:d.binding.id,dataDir};}
async function draftPage(o){
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,presence=[],listeners=[];let override=null;
 const p={id:o.parentStudyId,title:'Live piece',collectionKind:'collection-root',collectionBindingId:o.bindingId,view:'article',viewedStage:5,blocks:[{id:'initial',tag:'p',html:'<br>'}],history:[],note:null,positions:{}};
 Object.assign(w,{state:{projects:[p]},current:()=>p,selected:null,activeBlock:null,keyboardBlock:null,typingSession:null,WORKFLOW_RECORDS:{},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),readonlyHTML:s=>s,shortRecordName:s=>s,toast:()=>{},rememberPosition:()=>{},commitTyping:()=>{},save:()=>{},onTyping:el=>{p.blocks=[...el.children].map(c=>({id:c.dataset.block,tag:c.tagName.toLowerCase(),html:c.innerHTML}));},viewPhase:n=>{p.viewedStage=n;w.render();},setView:v=>{p.view=v;w.render();},blockHTML:b=>'<'+b.tag+' data-block="'+b.id+'">'+b.html+'</'+b.tag+'>',article:()=>'<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">'+p.blocks.map(b=>w.blockHTML(b)).join('')+'</div>',undo:()=>{},workflowBar:()=>'',refreshDiscussion:()=>{},phaseReader:()=>'',historicalNotice:()=>'',wireDocument:()=>{},openInstruction:()=>{},render:()=>{w.document.getElementById('app').innerHTML=w.article(p);w.wireDocument();}});
 w.c3Shell={live:{on:(filter,fn)=>{listeners.push({filter,fn});return ()=>{};},connected:()=>true},actorName:a=>({'agent:claude-code':'Claude','agent:codex':'Codex'})[a]||(String(a).startsWith('human:')?'You':a),reveal:()=>{}};
 w.fetch=async(url,init)=>{
  if(url.startsWith('/api/presence')){presence.push(JSON.parse(init.body));return {ok:true,json:async()=>({})};}
  if(url.startsWith('/api/journal'))return {ok:true,json:async()=>({lines:[]})};
  const input=init?JSON.parse(init.body):Object.fromEntries(new URL(url,'http://localhost').searchParams),route=url.split('/').at(-1).split('?')[0];
  if(override){const out=override(route,input);if(out)return out;}
  try{const value=route==='catalog'?await o.service.catalog():route==='read'?await o.service.read(input):route==='save'?await o.service.save(input):await o.service.openCopy(input);return {ok:true,json:async()=>value};}
  catch(error){return {ok:false,status:error.status||500,json:async()=>({error:error.message})};}
 };
 w.EventSource=class{close(){}}; // a real browser: presence and catalog learning run
 w.eval(read('draft-flow.js'));await tick(80);
 const emit=event=>{for(const l of listeners)if(event.reset||(!l.filter.kind||l.filter.kind===event.scope?.kind))l.fn(event);};
 const words=()=>w.document.getElementById('manuscript')?.textContent||'';
 const edit=html=>{const el=w.document.getElementById('manuscript');el.innerHTML=html;w.onTyping(el);};
 return {w,dom,p,presence,emit,words,edit,setOverride:fn=>override=fn,doc:()=>JSON.parse(w.localStorage.getItem('ar-document-study-owned-drafts-v1')).documents[o.bindingId]};
}
async function agentSave(o,match,change){const r=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId}),row=r.projection.find(x=>match.test(x.words||''));const at=row.words.indexOf(change.from);return o.service.save({bindingId:o.bindingId,parentStudyId:o.parentStudyId,operationId:randomUUID(),expected:r.expected,operations:[{kind:'text',id:row.id,from:at,to:at+change.from.length,insert:change.to,seenBlockHash:row.blockHash}]});}
const saveEvent=o=>({kind:'study-draft.save',scope:{kind:'draft',id:o.bindingId},actor:'agent:claude-code',client:'cli',at:new Date().toISOString(),operationId:randomUUID()});

test('live: clean words follow a save made elsewhere; unsaved words are never overwritten and Keep mine keeps both sides',async t=>{
 const o=await owner();t.after(()=>fs.rmSync(o.dataDir,{recursive:true,force:true}));const f=await draftPage(o);t.after(()=>f.dom.window.close());
 f.edit('<p>Opening line.</p><p>Second line.</p>');await f.w.studyDraft.flush();
 assert.equal(f.w.studyDraft.currentProof().dirty,false);
 // Claude saves from the command line; the event arrives; the open editor shows it without any reload.
 await agentSave(o,/Second/,{from:'Second',to:'Agent'});f.emit(saveEvent(o));
 assert.ok(await until(()=>/Agent line\./.test(f.words())),'clean editor follows the newer saved copy');
 assert.equal(f.doc().status,'Saved to working file');
 // An echo of this window's own save is not re-read.
 // Now words are typed here and not yet saved, and Claude saves again.
 f.edit(f.w.document.getElementById('manuscript').innerHTML.replace('Opening line.','Opening line, mine.'));
 await agentSave(o,/Agent/,{from:'Agent',to:'Claude'});f.emit(saveEvent(o));
 assert.ok(await until(()=>f.doc().status==='Conflict'),'held as a conflict');
 assert.match(f.words(),/Opening line, mine\./,'unsaved words stay on screen');assert.match(f.doc().error,/^Claude saved a newer version at /);
 assert.match(f.w.document.querySelector('[data-draft-status]').textContent,/Newer version by Claude/);
 assert.ok(f.w.document.querySelector('#draft-recovery [data-draft-action="keep-mine"]'),'Keep mine is offered');
 assert.ok(f.w.document.querySelector('#draft-recovery [data-draft-action="read"]').textContent==='Compare');
 await tick(1700);assert.equal(f.doc().status,'Conflict','the idle save does not fire over the newer version');
 f.w.document.querySelector('#draft-recovery [data-draft-action="keep-mine"]').click();
 assert.ok(await until(()=>f.doc().status==='Saved to working file'),'Keep mine saves');
 const saved=(await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw;
 assert.match(saved,/Opening line, mine\./,'my paragraph');assert.match(saved,/Claude line\./,'Claude’s paragraph, which I did not touch');
 assert.ok(f.doc().localRevisions.some(r=>/keeping my words/.test(r.reason)),'the words before Keep mine stay recoverable');
 // Presence was posted from currentProof: draft scope, the dirty flag, a sequence that only rises.
 await tick(400);
 const draftPosts=f.presence.filter(x=>x.scope?.kind==='draft'&&x.scope.id===o.bindingId&&!x.leaving);
 assert.ok(draftPosts.some(x=>x.dirty===true)&&draftPosts.some(x=>x.dirty===false),'dirty and clean both reported');
 assert.equal(draftPosts[0].stage,'Write');assert.ok(f.presence.every((x,i)=>i===0||x.sequence>f.presence[i-1].sequence),'monotonic');
 assert.ok(f.presence.every(x=>typeof x.session==='string'&&x.session.length<=64));
});

test('live: a 409 names who saved the newer version; a 423 keeps the words and names the holder and until when',async t=>{
 const o=await owner();t.after(()=>fs.rmSync(o.dataDir,{recursive:true,force:true}));const f=await draftPage(o);t.after(()=>f.dom.window.close());
 f.edit('<p>First.</p>');await f.w.studyDraft.flush();
 const until15=new Date(Date.now()+15*60000).toISOString();let held=true;
 f.setOverride(route=>route==='save'&&held?{ok:false,status:423,json:async()=>({error:'locked',outcome:'not-applied',holder:{actor:'agent:codex',client:'cli',reason:'Proposing wording',expiresAt:until15,leaseId:'l1'}})}:null);
 f.edit('<p>First, and more.</p>');await f.w.studyDraft.flush();
 const d=f.doc();assert.match(d.error,/^Codex is working on this \(Proposing wording\) until \d/);assert.match(d.error,/your words wait here/);
 assert.match(f.words(),/First, and more\./);assert.equal(d.lockedBy.actor,'agent:codex');
 assert.match(f.w.document.querySelector('[data-draft-status]').textContent,/^Held by Codex until/);
 // The holder lets go; the same words save.
 held=false;f.w.document.querySelector('[data-draft-action="retry"]').click();
 assert.ok(await until(()=>f.doc().status==='Saved to working file'));assert.equal(f.doc().lockedBy,undefined);
 assert.match((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,/First, and more\./);
 // A stale save (409) with no live event: the journal says who saved.
 f.w.fetch=(orig=>async(url,init)=>url.startsWith('/api/journal')?{ok:true,json:async()=>({lines:[{actor:'agent:claude-code',client:'cli',ts:new Date().toISOString(),operationId:'theirs',status:'committed'}]})}:orig(url,init))(f.w.fetch);
 await agentSave(o,/First/,{from:'First',to:'Their first'});
 f.edit(f.w.document.getElementById('manuscript').innerHTML.replace('more.','more, again.'));await f.w.studyDraft.flush();
 assert.ok(await until(()=>/^Claude saved a newer version/.test(f.doc().error||'')),'the 409 names Claude');assert.equal(f.doc().status,'Conflict');
});

test('pieces that own a working copy come from the server catalog, not a fixture list',async t=>{
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;t.after(()=>dom.window.close());
 const p={id:'fresh-piece',title:'Fresh',view:'record',viewedStage:4,blocks:[],history:[],note:null,positions:{}},hk={id:'hk',title:'Old fixture',view:'record',viewedStage:4,blocks:[]};
 Object.assign(w,{state:{projects:[p,hk]},current:()=>p,selected:null,activeBlock:null,keyboardBlock:null,typingSession:null,WORKFLOW_RECORDS:{},esc:s=>String(s??''),readonlyHTML:s=>s,shortRecordName:s=>s,toast:()=>{},rememberPosition:()=>{},commitTyping:()=>{},save:()=>{},onTyping:()=>{},viewPhase:()=>{},setView:()=>{},blockHTML:()=>'',article:()=>'',undo:()=>{},workflowBar:()=>'',refreshDiscussion:()=>{},phaseReader:()=>'',historicalNotice:()=>'',wireDocument:()=>{},openInstruction:()=>{},render:()=>{}});
 w.fetch=async url=>url.includes('/catalog')?{ok:true,json:async()=>({drafts:[{originalId:'o1',parentStudyKey:'fresh-piece',partKey:'article'}],collections:[]})}:{ok:true,json:async()=>({})};
 w.EventSource=class{close(){}};w.eval(read('draft-flow.js'));
 assert.equal(w.studyDraft.supports('fresh-piece'),false,'unknown until the server says');
 assert.ok(await until(()=>w.studyDraft.supports('fresh-piece')),'the catalog makes it supported');
 assert.equal(w.studyDraft.supports('hk'),false,'the old fixture ids are not special');
 assert.deepEqual(plain(JSON.parse(w.localStorage.getItem('ar-document-study-draft-pieces-v1')).ids),['fresh-piece'],'remembered for the next first paint');
 assert.doesNotMatch(read('draft-flow.js'),/\['ref-an-cha','hk'\]/);
});

// ---------- Recent changes, the bar's assistant line, questions and Home
const TS='2026-10-20T08:00:00.000Z';
function coordinationFetch(posted){
 const lines=[{ts:TS,operationId:'op-1',actor:'agent:claude-code',client:'cli',scope:{kind:'draft',id:'b1'},kind:'study-draft.save',status:'committed'},{ts:'2026-10-20T07:59:00.000Z',operationId:'op-0',actor:'human:adrian',client:'ui',scope:{kind:'draft',id:'b1'},kind:'study-draft.save',status:'conflict',http:409}];
 const ask={ts:TS,operationId:null,actor:'agent:claude-code',client:'cli',scope:{kind:'draft',id:'b1'},kind:'ask',status:'needs-decision',to:'human:adrian',summary:'Keep paragraph 4 as tightened?',options:['Keep','Cut']};
 const projectAsk={...ask,actor:'agent:codex',scope:{kind:'project',id:'other-piece'},summary:'Open on the second interview?',ts:'2026-10-20T07:00:00.000Z'};
 const hand={ts:'2026-10-20T07:30:00.000Z',actor:'agent:hermes',client:'cli',scope:{kind:'project',id:'p1'},kind:'handoff',status:'handoff',to:'human:adrian',summary:'Direction notes drafted.'};
 return async(url,init)=>{
  const u=new URL(url,'http://localhost'),q=Object.fromEntries(u.searchParams);
  if(init?.method==='POST'){const body=JSON.parse(init.body);posted.push({url:u.pathname,body});return {ok:true,json:async()=>({ts:new Date().toISOString(),actor:'human:adrian',client:'ui',kind:'handoff',status:'handoff',...body})};}
  if(u.pathname==='/api/presence')return {ok:true,json:async()=>({ttlMs:120000,presence:[{actor:'agent:claude-code',client:'cli',stage:'editing ¶4',scope:{kind:'draft',id:'b1'},dirty:false,sequence:1,lastSeen:new Date().toISOString()}]})};
  if(u.pathname==='/api/leases')return {ok:true,json:async()=>({leases:[{actor:'agent:claude-code',scope:{kind:'draft',id:'b1'},reason:'Tightening',expiresAt:new Date(Date.now()+600000).toISOString()}]})};
  if(u.pathname==='/api/study-draft/catalog')return {ok:true,json:async()=>({drafts:[{bindingId:'b1',parentStudyId:'p1'}],collections:[]})};
  if(u.pathname==='/api/journal'){
   if(q.status==='needs-decision')return {ok:true,json:async()=>({lines:[ask,projectAsk]})};
   if(q.status==='handoff')return {ok:true,json:async()=>({lines:[hand]})};
   if(q.actor==='human:adrian')return {ok:true,json:async()=>({lines:posted.map(p=>({...p.body,ts:new Date().toISOString(),actor:'human:adrian',kind:'handoff',status:'handoff'}))})};
   return {ok:true,json:async()=>({lines:q.kind==='draft'?lines:[]})};
  }
  return {ok:false,status:404,json:async()=>({error:'no'})};
 };
}
function coordinationPage(posted){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 const p={id:'p1',name:'Piece one',view:'article',viewedStage:5};
 Object.assign(w,{state:{projects:[p,{id:'other-piece',name:'Piece two'}]},current:()=>p,toast:()=>{},viewPhase:async n=>{p.viewedStage=n;},studyDraft:{currentBinding:()=>({id:'b1',parentStudyId:'p1'})}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.fetch=coordinationFetch(posted);w.eval(read('shell.js'));w.eval(read('recent-changes.js'));
 return {w,dom,p};
}
test('assistant line, question as the primary, answer written back, Home order and Recent changes by who did it',async t=>{
 const posted=[],{w,dom}=coordinationPage(posted);t.after(()=>dom.window.close());
 assert.ok(await until(()=>w.arLive.state().loaded&&w.arLive.note()));
 assert.equal(w.arLive.note().text,'Claude is editing ¶4');assert.match(w.arLive.note().title,/holds this record until .*\(Tightening\)/);
 const q=w.arLive.question(5);assert.equal(q.label,'Claude asks: Keep paragraph 4 as tightened?');assert.deepEqual(plain(q.ask.options),['Keep','Cut']);
 assert.equal(w.arLive.question(2),null,'a question about the draft is not the primary on Source');
 // Home: questions first (needs decision), then handovers.
 assert.deepEqual(plain(w.arLive.waiting().map(x=>[x.type,x.who,x.piece])),[['question','Claude','Piece one'],['question','Codex','Piece two'],['handoff','Hermes','Piece one']]);
 // Answering from the sheet writes a handoff back to the asker, naming the question.
 w.arLive.showAsk(q.ask);w.document.querySelector('#ar-ask [data-ar-ask-option="0"]').click();
 assert.ok(await until(()=>posted.length===1));
 assert.equal(posted[0].url,'/api/journal/handoff');assert.equal(posted[0].body.to,'agent:claude-code');assert.deepEqual(plain(posted[0].body.scope),{kind:'draft',id:'b1'});
 assert.match(posted[0].body.summary,/^Answer: Keep — to “Keep paragraph 4 as tightened\?” \(asked 2026-10-20T08:00:00.000Z\)$/);
 assert.ok(await until(()=>w.arLive.question(5)===null),'answered questions leave the bar');
 assert.equal(w.document.getElementById('ar-ask'),null);
 // Recent changes: grouped by who did it, provenance in words, each row opening its record.
 w.arLive.openRecent();assert.ok(await until(()=>w.document.querySelectorAll('#ar-recent .ar-rc-group').length===2));
 assert.deepEqual(plain([...w.document.querySelectorAll('#ar-recent .ar-rc-who')].map(n=>n.textContent)),['You','Claude']);
 const text=w.document.getElementById('ar-recent').textContent;
 assert.match(text,/Saved the draftby Claude from the command line/);assert.match(text,/by You in the app .* not applied: a newer version existed/);
 assert.equal(w.document.querySelector('#ar-recent [data-ar-rc-open]').textContent.length>0,true);
});

// ---------- the shell gate still holds with a question in the bar
test('with an assistant question open, every step still has exactly one primary and it is the question',async t=>{
 const NAMES=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
 const SCRIPTS=['workspace-navigation.js','shell.js','recent-changes.js','piece-state.js','checkpoint-rail.js','surface-bar.js','inspector.js','canvas-c3.js','empty-states.js','tree.js'];
 const page=stage=>{const steps=NAMES.map((n,i)=>`<button class="workflowStep" aria-label="View step ${i+1}: ${n}" onclick="viewPhase(${i+1})"><span class="stepNumber">${i+1}</span><span class="stepName">${n}</span></button>`).join('');const work=stage===5?`<nav class="workbar"><button onclick="undo()">Undo</button><button onclick="openInstruction()">Ask about words</button><span class="saved">Saved 07:05</span></nav><div class="desk"><article class="document"><div id="manuscript" contenteditable="true">Words.</div></article><aside class="margin" id="margin"></aside></div>`:`<div class="historicalToolbar"><span>Read-only snapshot</span><button onclick="setView('article')">Open the draft</button></div><section class="phaseReader"><article class="recordPage"><h2>${NAMES[stage-1]}</h2></article></section>`;return `<div class="shell"><nav class="workflowNavigation"><div class="workflowLegend"></div><div class="workflowSteps">${steps}</div></nav><main class="workspace" id="workspace"><header class="topbar"><h1>Piece</h1><span class="status">Draft</span></header>${work}</main></div>`;};
 for(const stage of [2,5,9]){
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;t.after(()=>dom.window.close());
  w.state={project:'p1',projects:[{id:'p1',name:'Piece',status:'Draft',view:stage===5?'article':'record',viewedStage:stage,blocks:[{tag:'p',html:'Words.'}],rev:1}],projectNavigation:{recent:[],openTabs:[]}};
  w.__page=page;w.eval(`var state=window.state;var modal=null;var phaseReader=function(){return ''};function current(){return state.projects.find(p=>p.id===state.project)}function save(){}function undo(){}function openInstruction(){}function setView(v){current().view=v;render()}function render(){document.getElementById('app').innerHTML=window.__page(current().view==='article'?5:Number(current().viewedStage))}function viewPhase(n){const p=current();p.viewedStage=n;p.view=n===5?'article':'record';render()}window.current=current;window.render=render;window.viewPhase=viewPhase;window.setView=setView;`);
  const posted=[],base=coordinationFetch(posted);w.fetch=async(url,init)=>{const u=new URL(url,'http://localhost');if(u.pathname==='/api/journal'&&u.searchParams.get('status')==='needs-decision')return {ok:true,json:async()=>({lines:[{ts:TS,actor:'agent:claude-code',client:'cli',scope:{kind:'project',id:'p1'},kind:'ask',status:'needs-decision',to:'human:adrian',summary:'Which angle opens the piece?',options:['Tea','Clay']}]})};return base(url,init);};
  w.render();for(const f of SCRIPTS)w.eval(read(f));w.render();
  assert.ok(await until(()=>/Claude asks/.test(w.document.querySelector('.sb-primary')?.textContent||'')),`step ${stage}: the question becomes the primary`);
  assert.equal(w.document.querySelectorAll('.sb-primary').length,1,`step ${stage}: exactly one primary`);
  assert.equal(w.document.querySelector('.sb-primary').textContent,'Claude asks: Which angle opens the piece?');
 }
});
