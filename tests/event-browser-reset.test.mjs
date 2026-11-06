// W2: real shell/owner subscriptions. Synthetic files only; transport is controlled.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await tick();}assert.ok(fn(),'expected browser state settled');}
function transport(w,{page,request,handshakes=false}){
 const sources=[],ownerTimers=new Set();let serverPage={...page},pending=0;
 if(handshakes){
  // Canonical rereads and presence yield/reopen the stream through finite
  // deferred work. Observe completion, rather than assuming 40ms covers it.
  const schedule=w.setTimeout.bind(w),cancel=w.clearTimeout.bind(w);
  w.setTimeout=(fn,delay=0,...args)=>{
   const id=schedule(()=>{ownerTimers.delete(id);fn(...args);},delay);
   ownerTimers.add(id);return id;
  };
  w.clearTimeout=id=>{ownerTimers.delete(id);cancel(id);};
 }
 class Source{
  constructor(url){
   this.url=url;this.handlers={};sources.push(this);
   if(handshakes)queueMicrotask(()=>{
    if(this.closed)return;
    const query=new URL(url,'http://localhost').searchParams;
    this.send('hello',{...serverPage,reset:query.get('bootId')!==serverPage.bootId,resetReason:'boot-changed'});
   });
  }
  addEventListener(kind,fn){this.handlers[kind]=fn;}
  send(kind,value){
   // A synthetic server restart changes later polls and stream handshakes too.
   if(kind==='hello'&&handshakes)serverPage={bootId:value.bootId,cursor:value.cursor,headCursor:value.headCursor,events:[]};
   this.handlers[kind]?.({data:JSON.stringify(value)});
  }
  close(){this.closed=true;}
 }
 w.document.hasFocus=()=>true;w.EventSource=Source;
 w.fetch=async(url,options)=>{
  if(String(url).startsWith('/api/events'))return {ok:true,json:async()=>serverPage};
  pending++;
  try{
   // Headers cannot arrive before this synthetic owner's response is ready.
   const value=request?await request(url,options):{};
   return {ok:true,json:async()=>value};
  }finally{pending--;}
 };
 sources.idle=()=>pending===0&&ownerTimers.size===0&&sources.length>0&&!sources.at(-1).closed;
 return sources;
}

test('initial poll delivers its first page; hello never advances past unconsumed replay',async t=>{
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>{w.c3Shell.live.stop();dom.window.close();});
 const event=cursor=>({bootId:'boot-first',cursor,kind:'saved',scope:{kind:'project',id:'p'}});
 const sources=transport(w,{page:{bootId:'boot-first',cursor:1,headCursor:10,hasMore:true,reset:false,events:[event(1)]}});
 w.eval(read('shell.js'));const received=[];w.c3Shell.live.on({},value=>received.push(value));await w.c3Shell.live.connect();
 assert.deepEqual(received.map(v=>v.cursor),[1]);assert.equal(sources[0].url,'/api/events?since=1&bootId=boot-first');
 sources[0].send('hello',{bootId:'boot-first',cursor:10,headCursor:10,reset:false});
 assert.equal(w.c3Shell.live.cursor(),1,'handshake head is not a delivery acknowledgement');
 for(let cursor=2;cursor<=10;cursor++)sources[0].send('change',event(cursor));
 sources[0].send('change',event(10));
 assert.deepEqual(received.map(v=>v.cursor),Array.from({length:10},(_,i)=>i+1));
});

test('idle hello resets lower, equal and higher sequences once, even without a later write',async t=>{
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>{w.c3Shell.live.stop();dom.window.close();});
 const sources=transport(w,{page:{bootId:'boot-old',cursor:5,headCursor:5,events:[]}});
 w.eval(read('shell.js'));const resets=[];w.c3Shell.live.on({},event=>{if(event.reset)resets.push(event);});await w.c3Shell.live.connect();
 for(const [i,cursor] of [0,5,20].entries()){
  const source=sources.at(-1),bootId='boot-new-'+i;
  source.send('hello',{bootId,cursor,headCursor:cursor,reset:true});
  source.send('reset',{bootId,cursor,headCursor:cursor,reset:true});
  assert.equal(resets.length,i+1,'hello plus reset is one owner notification');assert.equal(w.c3Shell.live.cursor(),cursor);
  source.onerror();await w.c3Shell.live.connect();assert.equal(sources.at(-1).url,'/api/events?since='+cursor+'&bootId='+bootId);
  sources.at(-1).send('hello',{bootId,cursor,headCursor:cursor,reset:false});assert.equal(resets.length,i+1,'same boot reconnect does not reset again');
 }
});

async function draftPage(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-w2-browser-'))),service=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>null}}),parentStudyId='restart-piece';
 const made=await service.createCollection({parentStudyId,title:'Restart piece',operationId:randomUUID()}),bindingId=made.binding.id;
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>{w.c3Shell.live.stop();dom.window.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const p={id:parentStudyId,title:'Restart piece',collectionKind:'collection-root',collectionBindingId:bindingId,view:'article',viewedStage:5,blocks:[{id:'initial',tag:'p',html:'<br>'}],history:[],note:null,positions:{}};
 Object.assign(w,{state:{projects:[p]},current:()=>p,selected:null,activeBlock:null,keyboardBlock:null,typingSession:null,WORKFLOW_RECORDS:{},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),readonlyHTML:s=>s,shortRecordName:s=>s,toast:()=>{},rememberPosition:()=>{},commitTyping:()=>{},save:()=>{},onTyping:el=>{p.blocks=[...el.children].map(c=>({id:c.dataset.block,tag:c.tagName.toLowerCase(),html:c.innerHTML}));},viewPhase:n=>{p.viewedStage=n;w.render();},setView:v=>{p.view=v;w.render();},blockHTML:b=>'<'+b.tag+' data-block="'+b.id+'">'+b.html+'</'+b.tag+'>',article:()=>'<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">'+p.blocks.map(b=>w.blockHTML(b)).join('')+'</div>',undo:()=>{},workflowBar:()=>'',refreshDiscussion:()=>{},phaseReader:()=>'',historicalNotice:()=>'',wireDocument:()=>{},openInstruction:()=>{},render:()=>{w.document.getElementById('app').innerHTML=w.article(p);w.wireDocument();}});
 const calls=[];
 const sources=transport(w,{page:{bootId:'boot-before',cursor:5,headCursor:5,events:[]},handshakes:true,request:async(url,options)=>{
  calls.push(String(url));if(url.startsWith('/api/presence'))return {};if(url.startsWith('/api/journal'))return {lines:[]};
  const input=options?JSON.parse(options.body):Object.fromEntries(new URL(url,'http://localhost').searchParams),route=url.split('/').at(-1).split('?')[0];
  return route==='catalog'?service.catalog():route==='read'?service.read(input):route==='save'?service.save(input):service.openCopy(input);
 }});
 w.eval(read('shell.js'));w.eval(read('draft-flow.js'));await until(()=>w.studyDraft.currentProof()?.dirty===false);
 const edit=html=>{const el=w.document.getElementById('manuscript');el.innerHTML=html;w.onTyping(el);};
 const words=()=>w.document.getElementById('manuscript')?.textContent||'';
 const externalSave=async(from,insert)=>{const current=await service.read({bindingId,parentStudyId}),row=current.projection.find(r=>r.words?.includes(from)),at=row.words.indexOf(from);return service.save({bindingId,parentStudyId,operationId:randomUUID(),expected:current.expected,operations:[{kind:'text',id:row.id,from:at,to:at+from.length,insert,seenBlockHash:row.blockHash}]});};
 return {w,sources,calls,edit,words,externalSave,service,bindingId,parentStudyId};
}
test('idle restart handshake makes the real draft owner reread canonical files and preserves dirty words',async t=>{
 const f=await draftPage(t);
 f.edit('<p>Exact opening.</p><p>First ending.</p>');await f.w.studyDraft.flush();await until(()=>f.sources.length&&!f.sources.at(-1).closed);
 const beforeReads=f.calls.filter(url=>url.startsWith('/api/study-draft/read')).length;
 await f.externalSave('First ending.','Saved while disconnected.');
 // The only notification is the connect handshake. No change event or focus event follows.
 f.sources.at(-1).send('hello',{bootId:'boot-after',cursor:5,headCursor:5,reset:true,resetReason:'boot-changed'});
 await until(()=>f.words().includes('Saved while disconnected.'));
 assert.ok(f.calls.filter(url=>url.startsWith('/api/study-draft/read')).length>beforeReads,'existing draft subscription performed its canonical file read');
 assert.equal(f.w.studyDraft.currentProof().dirty,false);
 f.edit(f.w.document.getElementById('manuscript').innerHTML.replace('Exact opening.','UNSAVED_exact_opening'));
 await f.externalSave('Saved while disconnected.','New canonical ending.');
 await until(()=>!f.sources.at(-1).closed);
 f.sources.at(-1).send('hello',{bootId:'boot-again',cursor:0,headCursor:0,reset:true,resetReason:'boot-changed'});
 await until(()=>/newer|changed|Conflict/i.test(f.w.document.querySelector('[data-draft-status]')?.textContent||''));
 assert.match(f.words(),/UNSAVED_exact_opening/);assert.doesNotMatch(f.words(),/New canonical ending/,'dirty editor is held for comparison');
 assert.match((await f.service.read({bindingId:f.bindingId,parentStudyId:f.parentStudyId})).raw,/New canonical ending/);
 // Each canonical read may legitimately replace the yielded stream. Wait for
 // those finite owner responses, then exercise acknowledged same-boot reconnects.
 await until(f.sources.idle);
 const sourceCount=f.sources.length,readCount=f.calls.filter(url=>url.startsWith('/api/study-draft/read')).length;
 for(let i=0;i<3;i++){
  f.sources.at(-1).send('hello',{bootId:'boot-again',cursor:0,headCursor:0,reset:false});
  await until(f.sources.idle);
  assert.equal(f.sources.length,sourceCount,'same-boot handshakes must not start another reset/reconnect cycle');
  assert.equal(f.calls.filter(url=>url.startsWith('/api/study-draft/read')).length,readCount,'settled same-boot handshakes do not repeat canonical reads');
 }
 assert.match(f.words(),/UNSAVED_exact_opening/);
});
