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
async function livePage(base,id,{search='',slowSave=0}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#/write/'+id,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  const text=await r.text();entry.status=r.status;
  if(slowSave&&u.pathname==='/api/study-draft/save')await settle(slowSave);
  return {ok:r.ok,status:r.status,text:async()=>text};
 };
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('[data-wr-text]')||w.document.querySelector('.wr-none'));
 return {w,doc:w.document,calls};
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
