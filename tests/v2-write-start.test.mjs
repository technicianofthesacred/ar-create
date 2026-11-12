import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

// Starting an Article inside version two: a new subject has no Article; Write opens it on an empty page and his first
// saved words make it (study-draft.save into the subject's draft, then study.outputs.create, the same two commands the
// existing workspace uses). Real server, real page. Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await settle(25);}};
const getJSON=async(base,p)=>(await fetch(base+p)).json();

let world=null;
async function theWorld(){
 if(world)return world;
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 world={base:'http://127.0.0.1:'+s.address().port,close:async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}};
 return world;
}
after(async()=>{if(world)await world.close();});
let n=0;
async function newSubject(base){
 const id='invented-start-'+(++n)+'-'+Date.now();
 const r=await fetch(base+'/api/study-draft/create-collection',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:JSON.stringify({parentStudyId:id,title:'Invented start '+n,operationId:crypto.randomUUID()})});
 assert.equal(r.status,200);
 return id;
}
async function livePage(base,id,{search='',slowSave=0,slowCreate=0,failCreate=false,query=''}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#/write/'+id+query,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  if(u.pathname==='/api/study/outputs/create'){if(slowCreate)await settle(slowCreate);if(failCreate){entry.status=409;return {ok:false,status:409,text:async()=>JSON.stringify({error:'This changed since it was opened here. Invented refusal.'})};}}
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  const text=await r.text();entry.status=r.status;
  if(slowSave&&u.pathname==='/api/study-draft/save')await settle(slowSave);
  return {ok:r.ok,status:r.status,text:async()=>text};
 };
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('[data-wr-text]')||w.document.querySelector('.wr-none'));
 const said=[];new w.MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.classList?.contains('v2-msg'))said.push(n.textContent);}).observe(w.document.getElementById('v2-messages'),{childList:true,subtree:true});
 return {w,doc:w.document,calls,said};
}
const type=(w,el,value)=>{el.focus();el.value=value;el.setSelectionRange(value.length,value.length);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const articlesOf=async(base,id)=>(await getJSON(base,'/api/subject/standing?parentStudyId='+id)).forms.filter(f=>f.kind==='article');
const wordsOf=d=>d.projection.filter(r=>r.safe!==false||r.words).map(r=>r.words);
const pieceWords=async(base,id,piece)=>{
 const st=await getJSON(base,'/api/subject/standing?parentStudyId='+id),root=st.facts.bindingId;
 const outs=await getJSON(base,`/api/study/outputs?rootBindingId=${root}&parentStudyId=${id}&selectedOutputId=${piece}`);
 const owner=outs.outputBindings.find(b=>b.outputId===piece).wordOwner;
 return wordsOf(await getJSON(base,`/api/study-draft/read?bindingId=${owner.bindingId}&parentStudyId=${id}`));
};

test('a subject with no Article opens Write on an empty page with "Write here", and his first saved words make the Article',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 assert.deepEqual(await articlesOf(base,id),[],'no Article to begin with');
 const pg=await livePage(base,id);
 const box=pg.doc.querySelector('textarea.wr-ed');
 assert.ok(box,'there is a box to write in');assert.equal(box.getAttribute('placeholder'),'Write here');assert.equal(box.readOnly,false);
 type(pg.w,box,'The first cup was small and bitter.');
 await until(()=>/[?&]piece=/.test(pg.w.location.hash),30000);
 const piece=decodeURIComponent(pg.w.location.hash.match(/piece=([^&]+)/)[1]);
 const arts=await articlesOf(base,id);
 assert.equal(arts.length,1,'one Article now');assert.equal(arts[0].id,piece,'the address carries it');
 assert.deepEqual(pg.calls.filter(c=>c.method==='POST').map(c=>c.path).filter(p=>/study-draft\/save|study\/outputs\/create/.test(p)),['/api/study-draft/save','/api/study/outputs/create'],'the two commands the existing workspace uses');
 await until(()=>[...pg.doc.querySelectorAll('textarea.wr-ed')].some(t=>t.value==='The first cup was small and bitter.'));
 assert.deepEqual(await pieceWords(base,id,piece),['The first cup was small and bitter.'],'his words are the Article\'s words');
});

test('words typed while the first save is on its way are saved too, in the same Article',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{slowSave:700});
 const box=pg.doc.querySelector('textarea.wr-ed');
 type(pg.w,box,'First words.');
 await until(()=>pg.calls.some(c=>c.path==='/api/study-draft/save'));
 type(pg.w,pg.doc.querySelector('textarea.wr-ed'),'First words. And words typed during the save.');
 await until(()=>/[?&]piece=/.test(pg.w.location.hash),40000);
 const piece=decodeURIComponent(pg.w.location.hash.match(/piece=([^&]+)/)[1]);
 const words=await pieceWords(base,id,piece);
 assert.equal(words.join(' '),'First words. And words typed during the save.');
 assert.equal((await articlesOf(base,id)).length,1,'only one Article was made');
});

test('an assistant sees the empty page read only, cannot write or start the Article, and leaves nothing on the device',{timeout:60000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{search:'?reviewActor=agent:codex'});
 await settle(300);
 assert.equal([...pg.doc.querySelectorAll('textarea.wr-ed')].filter(t=>!t.readOnly).length,0,'nothing to type into');
 assert.match(pg.doc.body.textContent,/Only Adrian writes here/);
 assert.deepEqual(pg.calls.filter(c=>c.method==='POST'&&/study-draft\/save|outputs\/create/.test(c.path)),[],'nothing was sent');
 assert.equal(pg.w.localStorage.length,0,'nothing kept as his');
 assert.deepEqual(await articlesOf(base,id),[]);
});

test('the same address with a piece that does not exist still says so, and does not start an Article',{timeout:60000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id+'?piece=nope');
 await until(()=>pg.doc.querySelector('.wr-none')||pg.doc.querySelector('textarea.wr-ed'),20000);
 assert.ok(pg.doc.querySelector('.wr-none'),'it says the piece is not one of this subject\'s Articles');
});

const saveWords=async(base,id,text)=>{
 const st=await getJSON(base,'/api/subject/standing?parentStudyId='+id),binding=st.facts.bindingId;
 const d=await getJSON(base,`/api/study-draft/read?bindingId=${binding}&parentStudyId=${id}`);
 const r=await fetch(base+'/api/study-draft/save',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:JSON.stringify({bindingId:binding,parentStudyId:id,operationId:crypto.randomUUID(),expected:d.expected,operations:[{kind:'insert',id:crypto.randomUUID(),beforeId:null,raw:text}]})});
 assert.equal(r.status,200);return binding;
};
const key=(w,el,k)=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
const savedLine=doc=>doc.querySelector('.wr-bar [data-wr-saved]').textContent;

test('while the Article is being made the line says so, the box stays open to type in, and Enter waits for the Article: no warning shows',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{slowCreate:1500});
 type(pg.w,pg.doc.querySelector('textarea.wr-ed'),'Words before the Article exists.');
 await until(()=>savedLine(pg.doc)==='Starting the Article',20000);
 const saves=()=>pg.calls.filter(c=>c.path==='/api/study-draft/save').length,before=saves();
 const box=pg.doc.querySelector('textarea.wr-ed');
 assert.equal(box.readOnly,false,'keys are not dropped');
 key(pg.w,box,'Enter');await settle(300);
 assert.equal(saves(),before,'nothing is saved while the Article is made');
 await until(()=>/[?&]piece=/.test(pg.w.location.hash),30000);
 assert.deepEqual(pg.said,[],'no warning at any point');
 assert.equal((await articlesOf(base,id)).length,1);
});

// A steady typist: one letter every 15 ms, into whichever box has the cursor, as a browser does (a key goes to the focused
// box and is dropped if that box is gone or read only).
const typist=(pg)=>{
 const {w,doc}=pg,rec={typed:'',dropped:0};
 return {rec,press(ch){
  const el=doc.activeElement;
  if(!el||!el.matches?.('textarea.wr-ed')||el.readOnly||!el.isConnected){rec.dropped++;return;}
  const at=el.selectionStart;el.value=el.value.slice(0,at)+ch+el.value.slice(at);el.setSelectionRange(at+1,at+1);
  el.dispatchEvent(new w.Event('input',{bubbles:true}));rec.typed+=ch;
 }};
};

test('typing steadily across the moment the Article is made loses no letter: the same box, the same cursor, every letter saved in the Article',{timeout:120000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{slowSave:300,slowCreate:600});
 const box=pg.doc.querySelector('textarea.wr-ed'),t=typist(pg);
 box.focus();
 for(let i=0;i<5;i++){t.press('abcde'[i]);await settle(15);}
 await settle(1900);// his first pause: the first save goes out
 const letters='fghijklmnopqrstuvwxyz';let moved=false,during=null,after=null;
 for(let i=0;i<240;i++){
  t.press(letters[i%letters.length]);await settle(15);
  if(!during&&savedLine(pg.doc)==='Starting the Article')during=pg.doc.activeElement;
  if(!moved&&/[?&]piece=/.test(pg.w.location.hash)){moved=true;after=pg.doc.activeElement;}
 }
 assert.ok(moved,'the Article was made during the typing');
 await until(()=>!/Not saved|Saving|Starting/.test(savedLine(pg.doc)),30000);
 await settle(500);await until(()=>!/Not saved|Saving|Starting/.test(savedLine(pg.doc)),30000);
 assert.equal(t.rec.dropped,0,'no key was dropped');
 assert.ok(during&&after,'the typing passed through the making of the Article');
 assert.equal(after,during,'the page was not rebuilt when the Article was made: the same box');
 const now=pg.doc.activeElement;
 assert.ok(now?.matches?.('textarea.wr-ed')&&now.selectionStart===now.value.length,'the cursor is still in the text, at the end');
 const piece=decodeURIComponent(pg.w.location.hash.match(/piece=([^&]+)/)[1]);
 assert.deepEqual(await pieceWords(base,id,piece),[t.rec.typed],'every letter is in the Article, in order');
 assert.equal((await articlesOf(base,id)).length,1);
 assert.ok(pg.doc.querySelector('.wr-tabs a[aria-current="page"]'),'the tabs now show the Article');
});

test('when another tab made the Article first, this tab opens it at once with no message',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{slowSave:0,slowCreate:1200});
 const box=pg.doc.querySelector('textarea.wr-ed');
 type(pg.w,box,'Words from the first tab.');
 await until(()=>pg.calls.some(c=>c.path==='/api/study-draft/save'&&c.status===200)&&savedLine(pg.doc)==='Starting the Article',20000);
 // the other tab makes it while this one waits
 const binding=(await getJSON(base,'/api/subject/standing?parentStudyId='+id)).facts.bindingId,sc={rootBindingId:binding,parentStudyId:id};
 const native=await getJSON(base,`/api/study-draft/read?bindingId=${binding}&parentStudyId=${id}`),outs=await getJSON(base,`/api/study/outputs?rootBindingId=${binding}&parentStudyId=${id}`);
 const r=await fetch(base+'/api/study/outputs/create',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:JSON.stringify({...sc,operationId:crypto.randomUUID(),kind:'article',sourceBindingId:binding,expectedNative:native.expected,expectedOutput:outs.expectedOutput})});
 assert.equal(r.status,200);
 await until(()=>/[?&]piece=/.test(pg.w.location.hash),10000);
 assert.deepEqual(pg.said,[],'no message');
 assert.equal((await articlesOf(base,id)).length,1);
 assert.equal(pg.calls.filter(c=>c.path==='/api/study/outputs/create').length<=1,true);
});

test('a refused create is said once, the words stay saved, and the retries are quiet; it succeeds when the server accepts',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{failCreate:true});
 type(pg.w,pg.doc.querySelector('textarea.wr-ed'),'Words that stay saved.');
 await until(()=>pg.calls.filter(c=>c.path==='/api/study/outputs/create').length>=2,40000);
 assert.equal(pg.said.length,1,'one message, not one every retry');assert.match(pg.said[0],/Your words are saved/);
 assert.deepEqual(await articlesOf(base,id),[]);
 assert.deepEqual(wordsOf(await getJSON(base,`/api/study-draft/read?bindingId=${(await getJSON(base,'/api/subject/standing?parentStudyId='+id)).facts.bindingId}&parentStudyId=${id}`)),['Words that stay saved.']);
});

test('after a reload between the save and the create, Write makes the Article by itself, with the same line',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 await saveWords(base,id,'Saved before the page closed.');
 assert.deepEqual(await articlesOf(base,id),[]);
 const pg=await livePage(base,id,{slowCreate:800});
 await until(()=>savedLine(pg.doc)==='Starting the Article',20000);
 await until(()=>/[?&]piece=/.test(pg.w.location.hash),30000);
 const piece=decodeURIComponent(pg.w.location.hash.match(/piece=([^&]+)/)[1]);
 assert.deepEqual(await pieceWords(base,id,piece),['Saved before the page closed.']);
});

test('a subject that has another form gets an Article from Write only when he came by Add a form, Article',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base),binding=await saveWords(base,id,'Words for a post.');
 const sc={rootBindingId:binding,parentStudyId:id};
 const native=await getJSON(base,`/api/study-draft/read?bindingId=${binding}&parentStudyId=${id}`),outs=await getJSON(base,`/api/study/outputs?rootBindingId=${binding}&parentStudyId=${id}`);
 const r=await fetch(base+'/api/study/outputs/create',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:JSON.stringify({...sc,operationId:crypto.randomUUID(),kind:'post',sourceBindingId:binding,expectedNative:native.expected,expectedOutput:outs.expectedOutput})});
 assert.equal(r.status,200,'a post exists, and no Article: '+await r.clone().text());
 assert.deepEqual(await articlesOf(base,id),[]);
 const plainPage=await livePage(base,id);await settle(1500);
 assert.deepEqual(plainPage.calls.filter(c=>/outputs\/create/.test(c.path)),[],'opening Write alone makes nothing');
 assert.deepEqual(await articlesOf(base,id),[]);
 const asked=await livePage(base,id,{query:'?start=article'});
 await until(()=>/piece=/.test(asked.w.location.hash),30000);
 assert.equal((await articlesOf(base,id)).length,1);
});
