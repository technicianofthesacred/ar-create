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
async function livePage(base,id,{search='',slowSave=0,slowCreate=0,failCreate=false,createStatus=409,query='',seed=null}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#/write/'+id+query,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  if(u.pathname==='/api/study/outputs/create'){if(slowCreate)await settle(slowCreate);if(w.closed)throw new Error('the tab was closed before the request went out');if(failCreate){entry.status=createStatus;return {ok:false,status:createStatus,text:async()=>JSON.stringify({error:createStatus===403?'Only Adrian can do this.':'This changed since it was opened here. Invented refusal.'})};}}
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

test('while the Article is being made the line says so, the box stays open to type in, and Enter breaks the paragraph at once: no warning shows',{timeout:90000},async()=>{
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

// ---- the third review: Enter and Backspace while the Article is being made, a tab closed then, and a refusal for good ----
/** What a person typing would expect: paragraphs, and a caret in one of them. A break at the caret swallows the spaces beside
    it; Enter at the end moves to (or makes) an empty paragraph after; at the very start or in an empty paragraph it does
    nothing; Backspace at the start joins the paragraph to the one before with one space, the caret at the join. */
function person(paras,i=0,pos=0){
 const m={paras:[...paras],i,pos,
  type(ch){const p=m.paras[m.i];m.paras[m.i]=p.slice(0,m.pos)+ch+p.slice(m.pos);m.pos++;},
  left(){if(m.pos>0)m.pos--;},
  home(){m.pos=0;},
  enter(){
   const p=m.paras[m.i];if(!p.trim())return;
   const head=p.slice(0,m.pos).replace(/\s+$/,''),tail=p.slice(m.pos).replace(/^\s+/,'');
   if(!tail){if(m.i+1<m.paras.length&&!m.paras[m.i+1].trim()){m.i++;m.pos=0;return;}m.paras.splice(m.i+1,0,'');m.i++;m.pos=0;return;}
   if(!head)return;
   m.paras[m.i]=head;m.paras.splice(m.i+1,0,tail);m.i++;m.pos=0;
  },
  backspace(){
   if(m.pos!==0||m.i<1)return;
   const lt=m.paras[m.i-1].replace(/\s+$/,''),rt=m.paras[m.i].replace(/^\s+/,'');
   m.paras.splice(m.i-1,2,lt&&rt?lt+' '+rt:lt||rt);m.i--;m.pos=lt.length;
  },
  words(){return m.paras.filter(x=>x.trim());}};
 return m;
}
/** One key at a time into whichever box has the caret, as a browser does; the page must show what the person expects after every key. */
function hands(pg,model){
 const {w,doc}=pg,rec={dropped:0,wrong:[],enters:0,joins:0,during:{enters:0,joins:0}},trace=[];
 const box=()=>{const el=doc.activeElement;return el&&el.matches?.('textarea.wr-ed')&&!el.readOnly&&el.isConnected?el:null;};
 const making=()=>/Starting the Article/.test(savedLine(doc));
 const check=what=>{
  trace.push([what,making(),JSON.stringify(model.paras.map(x=>x.slice(0,10))),JSON.stringify([...doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value.slice(0,10))),pg.calls.filter(c=>c.path==='/api/study-draft/save').map(c=>c.status).join(',')].join(' | '));
  const el=box(),shown=[...doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(x=>x.trim());
  if(JSON.stringify(shown)!==JSON.stringify(model.words())||!el||el.value!==model.paras[model.i]||el.selectionStart!==model.pos){
  rec.wrong.push({what,trace:trace.slice(-25),shown,expected:model.words(),caret:el?[el.value,el.selectionStart]:null,at:[model.paras[model.i],model.pos]});}
 };
 const act={
  letter(ch){const el=box();if(!el){rec.dropped++;return;}const at=el.selectionStart;el.value=el.value.slice(0,at)+ch+el.value.slice(at);el.setSelectionRange(at+1,at+1);el.dispatchEvent(new w.Event('input',{bubbles:true}));model.type(ch);},
  left(){const el=box();if(!el){rec.dropped++;return;}el.setSelectionRange(Math.max(0,el.selectionStart-1),Math.max(0,el.selectionStart-1));model.left();},
  home(){const el=box();if(!el){rec.dropped++;return;}el.setSelectionRange(0,0);model.home();},
  enter(){const el=box();if(!el){rec.dropped++;return;}const before=model.paras.length,m0=making();key(w,el,'Enter');model.enter();if(model.paras.length!==before){rec.enters++;if(m0)rec.during.enters++;}},
  backspace(){const el=box();if(!el){rec.dropped++;return;}el.setSelectionRange(0,0);model.home();const before=model.paras.length,m0=making();key(w,el,'Backspace');model.backspace();if(model.paras.length!==before){rec.joins++;if(m0)rec.during.joins++;}}
 };
 return {rec,act,check,making};
}
/** A repeatable stream: mostly letters, some caret moves, Enters, and Backspaces at the start of a paragraph. */
function script(n,seed=7){
 let x=seed;const rnd=()=>{x=(x*1103515245+12345)&0x7fffffff;return x/0x7fffffff;},out=[],letters='abcdefghijklmnopqrstuvwxyz';
 for(let k=0;k<n;k++){
  const r=rnd();
  if(r<.62)out.push(['letter',letters[Math.floor(rnd()*26)]]);
  else if(r<.72)out.push(['left']);
  else if(r<.80)out.push(['home']);
  else if(r<.92)out.push(['enter']);
  else out.push(['backspace']);
 }
 return out;
}
async function run(hand,steps,gap=15){
 for(const [what,arg] of steps){hand.act[what](arg);hand.check(what+' '+(arg||''));await settle(gap);}
}

test('a steady typist who presses Enter and joins paragraphs across the making of the Article: the page is always what he expects, and so is the Article',{timeout:240000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{slowSave:300,slowCreate:2500});
 const model=person(['']),hand=hands(pg,model);
 pg.doc.querySelector('textarea.wr-ed').focus();
 await run(hand,[...'abcdefgh'].map(c=>['letter',c]));
 await settle(1900);// his first pause: the first save goes out
 // a stream with plenty of Enters and joins, long enough to span the making of the Article
 const steps=script(420);
 await run(hand,steps);
 assert.ok(/[?&]piece=/.test(pg.w.location.hash),'the Article was made during the typing');
 assert.ok(hand.rec.during.enters>=2,'Enter was pressed while the Article was being made: '+JSON.stringify(hand.rec));
 assert.ok(hand.rec.during.joins>=1,'Backspace joined while the Article was being made: '+JSON.stringify(hand.rec));
 assert.equal(hand.rec.dropped,0,'no key was dropped');
 assert.deepEqual(hand.rec.wrong.slice(0,2),[],'after every key the page showed what a person typing it expects, with the caret where it belongs');
 await until(()=>!/Not saved|Saving|Starting/.test(savedLine(pg.doc)),40000);await settle(500);await until(()=>!/Not saved|Saving|Starting/.test(savedLine(pg.doc)),40000);
 const piece=decodeURIComponent(pg.w.location.hash.match(/piece=([^&]+)/)[1]);
 assert.deepEqual(await pieceWords(base,id,piece),model.words(),'the saved paragraphs are exactly what he typed');
 assert.deepEqual([...pg.doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(x=>x.trim()),model.words(),'and the page agrees');
 assert.equal(pg.w.localStorage.getItem('ar-v2-write:'+(await getJSON(base,'/api/subject/standing?parentStudyId='+id)).facts.bindingId),null,'nothing is left waiting on the device');
 assert.equal((await articlesOf(base,id)).length,1);
 assert.deepEqual(pg.said.filter(x=>!/Split|Joined|deleted/.test(x)),[],'no warning at any point');
});

test('closing the tab while the Article is being made keeps the Enters and joins too: the paragraphs come back as he left them',{timeout:120000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const a=await livePage(base,id,{slowSave:100,slowCreate:6000});
 const model=person(['']),hand=hands(a,model);
 a.doc.querySelector('textarea.wr-ed').focus();
 await run(hand,[...'the tea garden'].map(c=>['letter',c]));
 await until(()=>savedLine(a.doc)==='Starting the Article',30000);
 // while it is made: a break in the middle, letters after it, a second break at the end, a join, more letters
 const cmds=[['left'],['left'],['left'],['left'],['left'],['enter'],...[...'xyz'].map(c=>['letter',c]),['home'],['enter'],['backspace'],...[...'q'].map(c=>['letter',c]),['left'],['left'],['left'],['enter'],...[...'uv'].map(c=>['letter',c])];
 await run(hand,cmds,40);
 assert.deepEqual(hand.rec.wrong.slice(0,2),[]);assert.ok(hand.rec.during.enters>=2&&hand.rec.during.joins>=1,JSON.stringify(hand.rec.during));
 assert.ok(model.words().length>=2,'two paragraphs or more: '+JSON.stringify(model.words()));
 const kept={};for(let i=0;i<a.w.localStorage.length;i++){const k=a.w.localStorage.key(i);kept[k]=a.w.localStorage.getItem(k);}
 a.w.close();// the tab closes: the create never goes out
 await settle(300);assert.deepEqual(await articlesOf(base,id),[],'no Article was made by the closed tab');
 const b=await livePage(base,id,{seed:kept});
 await until(()=>[...b.doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(x=>x.trim()).length===model.words().length,20000);
 assert.deepEqual([...b.doc.querySelectorAll('textarea.wr-ed')].map(t=>t.value).filter(x=>x.trim()),model.words(),'the page shows the paragraphs as he left them');
 await until(()=>/[?&]piece=/.test(b.w.location.hash),40000);
 const piece=decodeURIComponent(b.w.location.hash.match(/piece=([^&]+)/)[1]);
 await until(()=>!/Not saved|Saving|Starting/.test(savedLine(b.doc)),40000);
 assert.deepEqual(await pieceWords(base,id,piece),model.words(),'the Article holds them, the break included');
});

test('a create refused for good (403) is said once, plainly, and never tried again; his words stay saved',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{failCreate:true,createStatus:403});
 type(pg.w,pg.doc.querySelector('textarea.wr-ed'),'Words that stay saved.');
 await until(()=>pg.calls.filter(c=>c.path==='/api/study/outputs/create').length>=1&&pg.said.length>=1,30000);
 await settle(18000);// two of the old eight-second retries would have gone by
 assert.equal(pg.calls.filter(c=>c.path==='/api/study/outputs/create').length,1,'tried once, not again');
 assert.equal(pg.said.length,1,'one message');assert.match(pg.said[0],/Your words are saved/);assert.match(pg.said[0],/Article could not be started/);assert.doesNotMatch(pg.said[0],/Only Adrian/);
 const binding=(await getJSON(base,'/api/subject/standing?parentStudyId='+id)).facts.bindingId;
 assert.deepEqual(wordsOf(await getJSON(base,`/api/study-draft/read?bindingId=${binding}&parentStudyId=${id}`)),['Words that stay saved.']);
 // more words are still saved, and still do not start another try
 type(pg.w,pg.doc.querySelector('textarea.wr-ed'),'Words that stay saved. And more.');
 await until(()=>pg.calls.filter(c=>c.path==='/api/study-draft/save').length>=2,20000);await settle(1500);
 assert.equal(pg.calls.filter(c=>c.path==='/api/study/outputs/create').length,1,'still tried once');
});

test('a create held by someone (423) is tried again quietly, and said once',{timeout:90000},async()=>{
 const {base}=await theWorld(),id=await newSubject(base);
 const pg=await livePage(base,id,{failCreate:true,createStatus:423});
 type(pg.w,pg.doc.querySelector('textarea.wr-ed'),'Words kept while it is held.');
 await until(()=>pg.calls.filter(c=>c.path==='/api/study/outputs/create').length>=2,40000);
 assert.equal(pg.said.length,1,'one message, not one every retry');assert.match(pg.said[0],/Your words are saved, but the Article could not be started/);
});
