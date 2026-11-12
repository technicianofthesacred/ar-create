import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {addMagazineToSyntheticHome} from '../scripts/demo-magazine.mjs';
import {createServer} from '../runtime/server.mjs';

// Version two's Write, Read and Check for a Magazine story, against the real in-process server with the invented demo
// Magazine (three stories: Kiln Keeper and Salt Lake Weaver have words, Bamboo Carver has no draft). Each guarantee of
// Write is proved here on the real commands: no word lost through a slow save, a reload or a closed tab, a newer saved
// version is shown beside his and never merged, a held Magazine keeps his words, an assistant's page is read only, and a
// suggestion is accepted or rejected by him alone. Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(check,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await settle(25);}};

let world=null;
async function theWorld(){
 if(world)return world;
 const home=syntheticHome(),magazine=await addMagazineToSyntheticHome(home),config=JSON.parse(fs.readFileSync(home.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+s.address().port;
 world={base,vault:magazine.vault,close:async()=>{s.closeAllConnections?.();await new Promise(r=>s.close(r));fs.rmSync(home.dir,{recursive:true,force:true});}};
 return world;
}
after(async()=>{if(world)await world.close();});

const KILN={id:'mag-kiln-keeper',piece:'mag-kiln-keeper:article'},WEAVER={id:'mag-salt-lake-weaver',piece:'mag-salt-lake-weaver:article'},BAMBOO={id:'mag-bamboo-carver',piece:'mag-bamboo-carver:article'};
const selector=s=>`storyId=${s.id}&pieceId=${encodeURIComponent(s.piece)}&edition=working`;
const body=s=>({storyId:s.id,pieceId:s.piece,edition:'working'});
const AGENT={'X-AR-Actor':'agent:claude-code','X-AR-Client':'cli'};
/** A call straight to the server, as him (from the page's own origin) or as an assistant. */
async function api(base,method,route,{input,agent=false}={}){
 const r=await fetch(base+route,{method,headers:{'content-type':'application/json',...(agent?AGENT:{Origin:base})},body:input?JSON.stringify(input):undefined});
 const text=await r.text();let value;try{value=JSON.parse(text);}catch{value=text;}
 return {status:r.status,value};
}
const draftOf=async(base,s)=>(await api(base,'GET','/api/magazine/working-draft/read?'+selector(s))).value;
const wordsOf=async(base,s)=>(await draftOf(base,s)).paragraphs.map(p=>p.text);
const uuid=()=>globalThis.crypto.randomUUID();
/** Another window of his (or an assistant) changes one paragraph in the Magazine. */
async function editElsewhere(base,s,index,text,agent=false){
 const d=await draftOf(base,s),p=d.paragraphs[index];
 return api(base,'POST','/api/magazine/working-draft/edit',{agent,input:{...body(s),block:p.block,seen:p.seen,text,operationId:uuid()}});
}

/** The real page on the real server. slowEdit holds an edit's answer back (the server has it); lateEdit holds it back
    before it reaches the server. seed is what the device already keeps (what a reload leaves). */
async function livePage(base,route,{search='',slowEdit=0,lateEdit=0,seed=null,patch=[],on=false,storage=null,ready='textarea.wr-ed,.wr-none,.ck-work,.ck-none,.rd-text,.rd-empty'}={}){
 if(on)patch=[...patch,['const STORY_EDITING=false;','const STORY_EDITING=true;']];
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#'+route,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 if(storage)Object.defineProperty(w,'localStorage',{value:storage,configurable:true});
 if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.EventSource=class{constructor(){this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,url:u.pathname+u.search,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  const isEdit=u.pathname==='/api/magazine/working-draft/edit';
  if(lateEdit&&isEdit)await settle(lateEdit);
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  const text=await r.text();entry.status=r.status;
  if(slowEdit&&isEdit)await settle(slowEdit);
  return {ok:r.ok,status:r.status,text:async()=>text};
 };
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])){let code=fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(repo,'public/v2',src),'utf8');if(src.endsWith('write.js'))for(const [a,b] of patch){assert.ok(code.includes(a),'patch target '+a);code=code.replace(a,b);}w.eval(code);}
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector(ready));
 await settle(150);
 return {w,doc:w.document,calls,sources};
}
const prefix=s=>`ar-v2-write-story:${s.id}:${s.piece}:`;
const keptKeys=(w,s)=>{const out=[];for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);if(k.startsWith(prefix(s)))out.push(k);}return out;};
const kept=(w,s)=>{const keys=keptKeys(w,s);return keys.length?{edits:keys.map(k=>JSON.parse(w.localStorage.getItem(k)))}:null;};
const type=(w,el,value)=>{el.focus();el.value=value;el.setSelectionRange(value.length,value.length);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const blur=(w,el)=>el.dispatchEvent(new w.Event('focusout',{bubbles:true}));
const boxes=doc=>[...doc.querySelectorAll('textarea.wr-ed')];
const savedSaying=doc=>doc.querySelector('.wr-bar [data-wr-saved]').textContent;
const quiet=(doc,ms=20000)=>until(()=>/^Saved/.test(savedSaying(doc)),ms);
const edits=calls=>calls.filter(c=>c.path==='/api/magazine/working-draft/edit'&&c.method==='POST');
/** A reload keeps only what is on the device. */
async function reload(old,base,route,opts={}){
 const seed={};for(let i=0;i<old.w.localStorage.length;i++){const k=old.w.localStorage.key(i);seed[k]=old.w.localStorage.getItem(k);}
 old.w.close();return livePage(base,route,{on:true,...opts,seed});
}

// ---------- Read ----------
test('Read shows the story\'s saved words from the Magazine, and nothing in it can be edited',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/read/'+KILN.id+'?piece='+encodeURIComponent(KILN.piece),{ready:'.rd-text .rd-p'});
 const text=pg.doc.querySelector('.rd-text').textContent;
 assert.match(text,/I reached the kiln before the heat did/);assert.match(text,/Ash is just the fire/);
 assert.doesNotMatch(text,/^---|\n---/,'the rules between the parts of the file are not shown as words');
 assert.equal(pg.doc.querySelectorAll('textarea').length,0,'nothing to edit');
 assert.ok(pg.calls.some(c=>c.path==='/api/magazine/working-draft/read'));
 assert.equal(pg.calls.filter(c=>/study-draft\/(read|check|save)|=null|\/null/.test(c.url)).length,0,'no draft request and no null id');
 assert.ok(pg.calls.every(c=>c.status<400),'no refused request: '+JSON.stringify(pg.calls.filter(c=>c.status>=400)));
 assert.match(pg.doc.querySelector('.rd-count').textContent,/\d+ words/);
 assert.match(pg.doc.querySelector('.wr-seg [aria-current]').textContent,/Read/);
});
test('Read: a story with no draft says so plainly, with no refused request',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/read/'+BAMBOO.id,{ready:'.rd-empty'});
 assert.match(pg.doc.querySelector('.rd-empty').textContent,/no draft yet/);
 assert.ok(pg.calls.every(c=>c.status<400&&!/=null|\/null/.test(c.url)),JSON.stringify(pg.calls.filter(c=>c.status>=400)));
});
test('Read shows a change made in the Magazine while it is open',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/read/'+WEAVER.id,{ready:'.rd-text .rd-p'});
 assert.equal((await editElsewhere(base,WEAVER,3,'Nobody buys the first piece, he said, and nobody should.')).status,200);
 for(const s of pg.sources)s.emit('change',{kind:'magazine.edit',cursor:9001,bootId:'b',scope:{kind:'story',id:WEAVER.id},operationId:'elsewhere-r'});
 await until(()=>/and nobody should/.test(pg.doc.querySelector('.rd-text').textContent));
});

// ---------- Check ----------
test('Check shows what magazine.check finds, read only, in Check\'s layout, and says what a story cannot give',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/check/'+KILN.id+'?piece='+encodeURIComponent(KILN.piece),{ready:'.ck-find'});
 const side=pg.doc.querySelector('.ck-side').textContent;
 assert.match(side,/Quote needs review/);assert.match(side,/When the glaze runs/);assert.match(side,/\d of \d quoted passages found/);
 assert.equal(pg.doc.querySelectorAll('textarea').length,0,'read only');
 assert.ok(pg.calls.some(c=>c.path==='/api/magazine/check'&&c.method==='POST'),'the Magazine\'s own check');
 assert.equal(pg.calls.filter(c=>/study-draft\/(read|check|save)|current-work|=null|\/null/.test(c.url)).length,0,'no draft check, no decisions read, no null id');
 assert.ok(pg.calls.every(c=>c.status<400),JSON.stringify(pg.calls.filter(c=>c.status>=400)));
 assert.match(pg.doc.querySelector('[data-ck-dec]').textContent,/do not answer for a Magazine story/,'decisions say so plainly');
 pg.doc.querySelector('[data-ck="go"]').click();
 await until(()=>pg.doc.querySelector('[data-ck-p][data-hit="true"] mark.ck-mark'));
 assert.match(pg.doc.querySelector('mark.ck-mark').textContent,/When the glaze runs/);
 // a check again changes nothing
 const before=(await draftOf(base,KILN)).document.hash;
 pg.doc.querySelector('[data-ck="run"]').click();await settle(600);
 assert.equal((await draftOf(base,KILN)).document.hash,before);
});
test('Check: a story with no draft says so plainly and asks nothing of the Magazine\'s check',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/check/'+BAMBOO.id,{ready:'.ck-none'});
 assert.match(pg.doc.querySelector('.ck-none').textContent,/no draft yet/);
 assert.equal(pg.calls.filter(c=>/magazine\/check|study-draft\/(read|check|save)|=null|\/null/.test(c.url)).length,0);
 assert.ok(pg.calls.every(c=>c.status<400),JSON.stringify(pg.calls.filter(c=>c.status>=400)));
});

// ---------- Write ----------
test('Write: a story with no draft says so plainly',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+BAMBOO.id,{ready:'.wr-dim[role="status"]'});
 assert.match(pg.doc.querySelector('[data-wr-text]').textContent,/no draft yet/);
 assert.equal(boxes(pg.doc).length,0);
 assert.ok(pg.calls.every(c=>c.status<400&&!/=null|\/null/.test(c.url)));
});
test('Write: a paragraph he changes is saved with the hash he saw, and is there after a reload',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true});
 const before=await wordsOf(base,WEAVER),box=boxes(pg.doc)[1];
 assert.equal(box.value,before[1]);
 type(pg.w,box,before[1]+' (typed)');blur(pg.w,box);
 await quiet(pg.doc);
 const sent=edits(pg.calls);assert.equal(sent.length,1);assert.match(sent[0].body.seen,/^[a-f0-9]{12}$/);assert.equal(sent[0].body.edition,'working');
 assert.deepEqual(Object.keys(sent[0].body).sort(),['block','edition','operationId','pieceId','seen','storyId','text'],'only the fields the command takes');
 assert.equal((await wordsOf(base,WEAVER))[1],before[1]+' (typed)');
 assert.equal(kept(pg.w,WEAVER),null,'nothing waits on the device once saved');
 const again=await reload(pg,base,'/write/'+WEAVER.id);
 assert.equal(boxes(again.doc)[1].value,before[1]+' (typed)');
});
test('Write: words typed while a save is in flight are never lost',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{on:true,slowEdit:600});
 const box=boxes(pg.doc)[2],start=(await wordsOf(base,WEAVER))[2];
 let typed=start+' and then';type(pg.w,box,typed);blur(pg.w,box);// in flight now
 await settle(120);
 for(const word of [' carried on','  while it was saving',' and again']){typed+=word;type(pg.w,box,typed);await settle(40);}
 await until(()=>/^Saved/.test(savedSaying(pg.doc))&&(boxes(pg.doc)[2].value===typed),30000);
 await settle(2500);await quiet(pg.doc,30000);
 const flat=typed.replace(/\s+/g,' ');
 assert.equal((await wordsOf(base,WEAVER))[2].replace(/\s+/g,' '),flat,'every character is in the Magazine, once');
 assert.equal(boxes(pg.doc)[2].value.replace(/\s+/g,' '),flat);
 assert.equal(kept(pg.w,WEAVER),null);
 assert.ok(edits(pg.calls).every(c=>c.status===200),'no refused save');
});
test('Write: a reload while a save is on its way (the Magazine has it, the answer is lost) shows no newer version and loses nothing',{timeout:90000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{on:true,slowEdit:1500});
 const box=boxes(pg.doc)[3],start=(await wordsOf(base,WEAVER))[3];
 type(pg.w,box,start+' [one]');blur(pg.w,box);
 await until(()=>edits(pg.calls)[0]?.status===200);// the Magazine has it; the page has not heard
 const firstOp=edits(pg.calls)[0].body.operationId;
 type(pg.w,boxes(pg.doc)[3],start+' [one] [two]');// and he typed more
 assert.ok(kept(pg.w,WEAVER).edits.some(e=>e.sending),'the operation in flight is kept with his words');
 const again=await reload(pg,base,'/write/'+WEAVER.id);
 assert.equal(again.doc.querySelector('[data-wr-conflict]').hidden,true,'his own save is not a newer version');
 await quiet(again.doc,30000);await settle(800);await quiet(again.doc,30000);
 assert.equal((await wordsOf(base,WEAVER))[3],start+' [one] [two]');
 assert.equal(boxes(again.doc)[3].value,start+' [one] [two]');
 assert.ok(edits(again.calls).every(c=>c.status===200),'no refused save: '+JSON.stringify(edits(again.calls).map(c=>c.status)));
 assert.ok(!edits(again.calls).some(c=>c.body.operationId===firstOp),'the first operation is settled from the Magazine\'s receipt, never sent again');
 assert.equal(kept(again.w,WEAVER),null);
});
test('Write: a tab closed before the save reached the Magazine keeps his words, and the next page saves them',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{on:true,lateEdit:4000});
 const box=boxes(pg.doc)[1],start=(await wordsOf(base,KILN))[1];
 type(pg.w,box,start+' Kept on the device.');blur(pg.w,box);
 await settle(200);
 assert.equal((await wordsOf(base,KILN))[1],start,'the Magazine has not heard yet');
 const again=await reload(pg,base,'/write/'+KILN.id);// the tab is gone; the device remembers
 assert.equal(boxes(again.doc)[1].value,start+' Kept on the device.','his words come back');
 await quiet(again.doc,30000);
 assert.equal((await wordsOf(base,KILN))[1],start+' Kept on the device.');
});
test('Write: a paragraph changed in the Magazine meanwhile shows both versions and merges nothing; he chooses',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true});
 const mine='My own wording for the shoreline.',theirs='Their wording for the shoreline.';
 // another window changes the paragraph first
 assert.equal((await editElsewhere(base,WEAVER,1,theirs)).status,200);
 const box=boxes(pg.doc)[1];type(pg.w,box,mine);blur(pg.w,box);
 const conflict=pg.doc.querySelector('[data-wr-conflict]');
 await until(()=>!conflict.hidden);
 assert.match(conflict.textContent,/Yours\s*My own wording/);assert.match(conflict.textContent,/Saved\s*Their wording/);
 assert.equal((await wordsOf(base,WEAVER))[1],theirs,'nothing was written over the newer words');
 assert.match(savedSaying(pg.doc),/Not saved/);
 assert.ok(kept(pg.w,WEAVER),'his words are still kept on the device');
 // a reload does not lose them either
 const again=await reload(pg,base,'/write/'+WEAVER.id);
 await until(()=>!again.doc.querySelector('[data-wr-conflict]').hidden);
 assert.match(again.doc.querySelector('[data-wr-conflict]').textContent,/My own wording/);
 again.doc.querySelector('[data-act="mine"]').click();
 await quiet(again.doc,30000);
 assert.equal((await wordsOf(base,WEAVER))[1],mine,'his words, by his choice');
 // and the other choice
 assert.equal((await editElsewhere(base,WEAVER,1,theirs)).status,200);
 const third=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true}),b3=boxes(third.doc)[1];
 assert.equal((await editElsewhere(base,WEAVER,1,'A later hand.')).status,200);
 type(third.w,b3,'Words he will let go.');blur(third.w,b3);
 await until(()=>!third.doc.querySelector('[data-wr-conflict]').hidden);
 third.doc.querySelector('[data-act="theirs"]').click();
 await until(()=>third.doc.querySelector('[data-wr-conflict]').hidden);
 assert.equal(boxes(third.doc)[1].value,'A later hand.');assert.equal((await wordsOf(base,WEAVER))[1],'A later hand.');
 assert.equal(kept(third.w,WEAVER),null);
});
test('Write: a Magazine that is held by someone else keeps his words and saves them when it is free',{timeout:60000},async()=>{
 const {base,vault}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{on:true,on:true});
 const lock=path.join(vault,'Workflow/_mag-running.md');
 fs.writeFileSync(lock,`machine: another-mac\nsince: ${new Date().toISOString()}\ndoing: a run\nholder: mag-session\nmode: session\n`);
 try{
  const box=boxes(pg.doc)[2],start=(await wordsOf(base,KILN))[2];
  type(pg.w,box,start+' Held words.');blur(pg.w,box);
  await until(()=>edits(pg.calls).some(c=>c.status===423));
  assert.match(savedSaying(pg.doc),/working on this|kept/i);assert.equal(pg.doc.querySelector('[data-wr-conflict]').hidden,true,'a held Magazine is not a newer version');
  assert.equal((await wordsOf(base,KILN))[2],start);assert.equal(boxes(pg.doc)[2].value,start+' Held words.');
  assert.ok(kept(pg.w,WEAVER)===null&&kept(pg.w,KILN).edits.length===1,'kept on the device');
 }finally{fs.rmSync(lock,{force:true});}
 const box=boxes(pg.doc)[2];blur(pg.w,box);
 await quiet(pg.doc,30000);
 assert.match((await wordsOf(base,KILN))[2],/Held words\.$/);
});
test('Write: a line with a pending review mark is not editable here, and says why',async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{on:true,on:true});
 const locked=[...pg.doc.querySelectorAll('.wr-lock')].find(n=>/She never looked at the clock/.test(n.textContent));
 assert.ok(locked,'shown');assert.match(pg.doc.querySelector('.wr-lock-why').textContent,/review decision in the Magazine/);
 assert.ok(!boxes(pg.doc).some(b=>/never looked at the clock/.test(b.value)));
 assert.match(pg.doc.querySelector('.wr-todo').textContent,/Not built yet/,'new and removed paragraphs say so and open in Advanced');
 assert.ok(pg.doc.querySelector('.wr-todo [data-wr-advanced]'));
});
test('Write: an assistant\'s page is read only: it types nothing, keeps nothing, restores nothing and cannot save',{timeout:60000},async()=>{
 const {base}=await theWorld(),human=await livePage(base,'/write/'+WEAVER.id,{on:true,lateEdit:6000});
 const hb=boxes(human.doc)[1],words=(await wordsOf(base,WEAVER))[1];
 type(human.w,hb,words+' HIS UNSAVED');
 const seed={};for(const k of keptKeys(human.w,WEAVER))seed[k]=human.w.localStorage.getItem(k);assert.ok(Object.keys(seed).length,'his words are on the device');
 human.w.close();
 const ai=await livePage(base,'/write/'+WEAVER.id,{on:true,search:'?reviewActor=agent:claude-code',seed});
 assert.ok(boxes(ai.doc).length>0&&boxes(ai.doc).every(b=>b.readOnly),'every paragraph is read only');
 assert.ok(!boxes(ai.doc).some(b=>/HIS UNSAVED/.test(b.value)),'his kept words are not restored as an assistant\'s page');
 assert.equal(ai.doc.querySelector('[data-wr-saved]').textContent,'Read only');
 assert.match(ai.doc.querySelector('.wr-ro').textContent,/Only Adrian writes here/);
 type(ai.w,boxes(ai.doc)[1],words+' typed by an assistant');blur(ai.w,boxes(ai.doc)[1]);
 await settle(2200);
 assert.equal(edits(ai.calls).length,0,'no save is attempted');
 assert.equal((await wordsOf(base,WEAVER))[1],words);
 assert.deepEqual(Object.fromEntries(keptKeys(ai.w,WEAVER).map(k=>[k,ai.w.localStorage.getItem(k)])),seed,'an assistant leaves nothing of its own on the device, and does not take his');
 // and the Magazine itself refuses an assistant's edit
 const d=await draftOf(base,WEAVER),p=d.paragraphs[1];
 const refused=await api(base,'POST','/api/magazine/working-draft/edit',{agent:true,input:{...body(WEAVER),block:p.block,seen:p.seen,text:'x',operationId:uuid()}});
 assert.equal(refused.status,403);
});
test('Write: presence tells an assistant he has unsaved words, only while he has them',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{on:true,lateEdit:1500});
 const box=boxes(pg.doc)[1],start=(await wordsOf(base,KILN))[1];
 type(pg.w,box,start+' Presence.');
 await until(()=>pg.calls.some(c=>c.path==='/api/presence'&&c.status===200));
 const session=pg.calls.find(c=>c.path==='/api/presence').body.session;
 const mine=async()=>(await api(base,'GET','/api/presence')).value.presence.find(r=>r.session===session);
 assert.equal((await mine()).dirty,true);
 blur(pg.w,box);await quiet(pg.doc,30000);
 await until(async()=>(await mine())?.dirty===false);
});

// ---------- an assistant's suggestions ----------
async function propose(base,s,change){
 const d=await draftOf(base,s),text=d.document.text.replace(change[0],change[1]);
 return api(base,'POST','/api/magazine/working-draft/save',{agent:true,input:{...body(s),expectedHash:d.document.hash,content:text,operationId:uuid()}});
}
test('Write: an assistant\'s suggestion is shown to him, and only he accepts or rejects it',{timeout:90000},async()=>{
 const {base}=await theWorld(),start=await wordsOf(base,WEAVER);
 const made=await propose(base,WEAVER,['what the lake wants','what the lake needs']);
 assert.equal(made.status,200);assert.equal(made.value.proposed,true,'an assistant\'s save is a proposal');
 const ai=await livePage(base,'/write/'+WEAVER.id,{on:true,search:'?reviewActor=agent:claude-code'});
 await until(()=>ai.doc.querySelector('[data-prop]'));
 assert.match(ai.doc.querySelector('[data-prop]').textContent,/lake needs/);
 assert.equal(ai.doc.querySelectorAll('[data-prop] button').length,0,'an assistant\'s page has no decision to press');
 assert.match(ai.doc.querySelector('[data-prop]').textContent,/Only Adrian decides/);
 const refused=await api(base,'POST','/api/magazine/proposal/accept',{agent:true,input:{proposalId:made.value.proposalId,operationId:uuid()}});
 assert.equal(refused.status,403);assert.ok(!(await wordsOf(base,WEAVER)).some(t=>/lake needs/.test(t)),'nothing was written');
 // as him, with unsaved words open, a decision waits
 const pg=await livePage(base,'/write/'+WEAVER.id,{on:true,lateEdit:5000});
 await until(()=>pg.doc.querySelector('[data-prop]'));
 const box=boxes(pg.doc)[1];type(pg.w,box,start[1]+' x');
 pg.doc.querySelector('[data-act="accept"]').click();await settle(200);
 assert.ok(!(await wordsOf(base,WEAVER)).some(t=>/lake needs/.test(t)),'not accepted while his words are unsaved');
 type(pg.w,box,start[1]);// back to what is saved
 pg.doc.querySelector('[data-act="accept"]').click();
 await until(async()=>(await wordsOf(base,WEAVER)).some(t=>/lake needs/.test(t)));
 assert.equal(pg.calls.filter(c=>c.path==='/api/magazine/proposal/accept').length,1);
 await until(()=>!pg.doc.querySelector('[data-prop]'));
 // a second suggestion, turned down
 const second=await propose(base,WEAVER,['what the lake needs','what the water needs']);
 assert.equal(second.status,200);
 const p2=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true});
 await until(()=>p2.doc.querySelector('[data-prop]'));
 p2.doc.querySelector('[data-act="reject"]').click();
 await until(()=>!p2.doc.querySelector('[data-prop]'));
 assert.ok(!(await wordsOf(base,WEAVER)).some(t=>/water needs/.test(t)));
 // a suggestion made on older words is not offered
 const third=await propose(base,WEAVER,['what the lake needs','what the shore needs']);assert.equal(third.status,200);
 assert.equal((await editElsewhere(base,WEAVER,0,'A changed metadata line.')).status,200);
 const p3=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true});await settle(600);
 assert.equal(p3.doc.querySelector('[data-prop]'),null);assert.match(p3.doc.querySelector('.wr-stale').textContent,/set aside/);
});


// ---------- corrections after review ----------
const vaultFile=(vault,name)=>path.join(vault,'Workflow/3-Develop',`DEV - ${name} (story).md`);
const editsLog=(vault,name)=>{try{return fs.readFileSync(path.join(vault,'Workflow/4-Review',`EDITS - DEV - ${name} (story).md`),'utf8');}catch{return '';}};
const entriesIn=text=>(text.match(/^## /gm)||[]).length;

test('the switch STORY_EDITING: off, a story shows read only with one plain line and one link to the existing workspace; on, it edits',async()=>{
 const {base}=await theWorld(),before=fs.readFileSync(vaultFile((await theWorld()).vault,'Kiln Keeper'),'utf8');
 const off=await livePage(base,'/write/'+KILN.id);
 assert.ok(boxes(off.doc).length>0&&boxes(off.doc).every(b=>b.readOnly),'read only');
 assert.match(off.doc.querySelector('[data-wr-locked]').textContent,/changed in the Magazine, not here/);
 assert.equal(off.doc.querySelectorAll('[data-wr-locked] a[href*="/document-study/"]').length,1,'one link to the existing workspace');
 assert.equal(off.doc.querySelector('.wr-todo'),null);assert.equal(off.doc.querySelector('[data-wr-saved]').textContent,'');
 type(off.w,boxes(off.doc)[1],'typed anyway');blur(off.w,boxes(off.doc)[1]);await settle(1800);
 assert.equal(edits(off.calls).length,0);assert.equal(kept(off.w,KILN),null);
 assert.equal(fs.readFileSync(vaultFile((await theWorld()).vault,'Kiln Keeper'),'utf8'),before,'the file is untouched');
 const on=await livePage(base,'/write/'+KILN.id,{on:true});
 assert.ok(boxes(on.doc).some(b=>!b.readOnly),'on: he can edit');assert.equal(on.doc.querySelector('[data-wr-locked]').hidden,true);
});

test('Write honours editable and unavailableReason: a draft the Magazine will not take is read only, with the reason',async()=>{
 const {base,vault}=await theWorld(),conflict=path.join(vault,'Workflow/3-Develop','DEV - Kiln Keeper (story).sync-conflict-20260101-000000-ABCDEFG.md');
 fs.writeFileSync(conflict,'---\ntype: DEV\n---\n\nA conflicting copy.\n');
 try{
  assert.equal((await draftOf(base,KILN)).editable,false,'the Magazine says it is not editable');
  const pg=await livePage(base,'/write/'+KILN.id,{on:true,on:true});
  assert.ok(boxes(pg.doc).every(b=>b.readOnly));
  assert.match(pg.doc.querySelector('[data-wr-locked]').textContent,/Conflicting files need a human choice/);
  assert.equal(pg.doc.querySelector('[data-wr-saved]').textContent,'Read only');
  type(pg.w,boxes(pg.doc)[1],'x');await settle(1800);assert.equal(edits(pg.calls).length,0);
 }finally{fs.rmSync(conflict,{force:true});}
});

test('"Keep my words" never overwrites a paragraph on a guess: common words do not pair, and without a sure place his words are only kept',{timeout:60000},async()=>{
 const {base,vault}=await theWorld(),file=vaultFile(vault,'Salt Lake Weaver');
 const pg=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true});
 const words=await wordsOf(base,WEAVER);
 // elsewhere the paragraph he is editing AND the paragraph beside it are rewritten, so no place is certain
 assert.equal((await editElsewhere(base,WEAVER,2,'The cloth and the water and the night, as it is.')).status,200);
 assert.equal((await editElsewhere(base,WEAVER,1,'It is the lake and the loom and the pattern.')).status,200);
 const box=boxes(pg.doc)[2];type(pg.w,box,'It is the water and the cloth and the night, and it is slow.');blur(pg.w,box);
 const conflict=pg.doc.querySelector('[data-wr-conflict]');await until(()=>!conflict.hidden);
 assert.equal(conflict.querySelector('[data-act="mine"]'),null,'no Keep when there is no sure place');
 assert.ok(conflict.querySelector('[data-act="copy"]'),'he can copy his words');assert.ok(conflict.querySelector('a[href*="/document-study/"]'),'or open the Magazine');
 assert.match(conflict.textContent,/not put on any other paragraph/);
 assert.match(conflict.textContent,/It is the water and the cloth and the night, and it is slow\./,'his words stay on screen');
 assert.ok(kept(pg.w,WEAVER).edits.some(e=>/slow\./.test(e.text)),'and on the device');
 const bytes=fs.readFileSync(file,'utf8');await settle(1800);
 assert.equal(fs.readFileSync(file,'utf8'),bytes,'the story file is byte for byte as it was: nothing was written over anything');
 assert.equal([...conflict.querySelectorAll('button')].filter(b=>b.dataset.act==='theirs').length,1);
 assert.match(conflict.querySelector('[data-act="theirs"]').textContent,/placed/,'the only way to let them go says they were placed');
 assert.ok(words.length>0);
});

test('Write: the first keystroke keeps a paragraph\'s own line breaks, and every other byte of the file comes back as it was',{timeout:60000},async()=>{
 const {base,vault}=await theWorld(),file=vaultFile(vault,'Salt Lake Weaver');
 const soft='Soft line one\nsoft line two, with an  odd  spacing.';
 fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\n---\n$/,'\n\n'+soft+'\n\n---\n'));
 const pg=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true}),before=fs.readFileSync(file,'utf8');
 const at=boxes(pg.doc).findIndex(b=>b.value===soft);assert.ok(at>=0,'shown with its line break: '+JSON.stringify(boxes(pg.doc).map(b=>b.value)));
 const box=boxes(pg.doc)[at];type(pg.w,box,soft+' More.');blur(pg.w,box);await quiet(pg.doc,20000);
 assert.equal(fs.readFileSync(file,'utf8'),before.replace(soft,soft+' More.'),'only that paragraph changed, line break and spacing as typed');
 assert.equal(boxes(pg.doc)[at].value,soft+' More.');
 assert.equal(edits(pg.calls).at(-1).body.text,soft+' More.');
});

test('Write: marks that mean something in the Magazine are not sent through the paragraph edit; his words are kept and the file is not touched',{timeout:90000},async()=>{
 const {base,vault}=await theWorld(),file=vaultFile(vault,'Kiln Keeper'),pg=await livePage(base,'/write/'+KILN.id,{on:true,on:true}),start=(await wordsOf(base,KILN))[2];
 const bytes=fs.readFileSync(file,'utf8'),sent=edits(pg.calls).length;
 for(const bad of ['# A heading now','Some ==marked== words','A %%hidden note%% here','Make a /rework word/ of this.','> a large line','- a list item','1. a numbered item','| a | table |','a [[link]] here','**bold** words','one\n\ntwo']){
  const box=boxes(pg.doc)[2];type(pg.w,box,bad);blur(pg.w,box);await settle(300);
  const c=pg.doc.querySelector('[data-wr-conflict]');
  assert.equal(c.hidden,false,'said plainly for '+JSON.stringify(bad));assert.match(c.textContent,/has a meaning in the Magazine/);
  assert.equal(boxes(pg.doc)[2].value,bad,'his words stay on the page');assert.ok(kept(pg.w,KILN).edits.some(e=>e.text===bad),'and on the device');
  assert.equal(c.querySelector('[data-act="theirs"]'),null,'no button that only throws them away');
 }
 await settle(1800);assert.equal(edits(pg.calls).length,sent,'nothing was sent');assert.equal(fs.readFileSync(file,'utf8'),bytes,'byte for byte');
 // ordinary punctuation is not a mark, and is saved
 const box=boxes(pg.doc)[2];type(pg.w,box,start+' (and/or a 3 / 4 split, 50% - fine).');blur(pg.w,box);await quiet(pg.doc,20000);
 assert.equal((await wordsOf(base,KILN))[2],start+' (and/or a 3 / 4 split, 50% - fine).');
 // taking the mark out clears the notice and saves
 const again=boxes(pg.doc)[2];type(pg.w,again,'# oops');await settle(100);type(pg.w,again,'Plain again.');blur(pg.w,again);await quiet(pg.doc,20000);
 assert.equal(pg.doc.querySelector('[data-wr-conflict]').hidden,true);assert.equal((await wordsOf(base,KILN))[2],'Plain again.');
});

test('Write: paragraphs removed above his are no reason to lose his place: his words are sent again from where the paragraph now is',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{on:true,on:true});
 const words=await wordsOf(base,WEAVER),last=words.at(-1),mine=last+' Mine.';
 for(let i=0;i<3;i++)assert.equal((await editElsewhere(base,WEAVER,1,'')).status,200,'a paragraph above is removed in the Magazine');
 const box=boxes(pg.doc).at(-1);type(pg.w,box,mine);blur(pg.w,box);
 await quiet(pg.doc,30000);
 assert.equal((await wordsOf(base,WEAVER)).at(-1),mine,'saved at its new place');
 assert.equal(pg.doc.querySelector('[data-wr-conflict]').hidden,true,'no "gone, reload" and no button to press');
 assert.ok(edits(pg.calls).some(c=>c.status===409)&&edits(pg.calls).at(-1).status===200,'the first try was refused, the second went through from the new place');
});

test('Write: unsent words are kept one paragraph at a time, so a save in one tab never erases the unsent words of another',{timeout:60000},async()=>{
 const {base}=await theWorld(),shared=new JSDOM('',{url:base+'/'}).window;windows.push(shared);
 const A=await livePage(base,'/write/'+KILN.id,{on:true,lateEdit:6000,storage:shared.localStorage}),B=await livePage(base,'/write/'+KILN.id,{on:true,storage:shared.localStorage});
 const words=await wordsOf(base,KILN);
 type(A.w,boxes(A.doc)[1],words[1]+' (tab A, unsent)');// A's save is held back: unsent
 await settle(100);assert.equal(keptKeys(shared,KILN).length,1);
 type(B.w,boxes(B.doc)[3],words[3]+' (tab B)');blur(B.w,boxes(B.doc)[3]);
 await until(()=>edits(B.calls)[0]?.status===200,20000);await quiet(B.doc,30000);
 const left=keptKeys(shared,KILN).map(k=>JSON.parse(shared.localStorage.getItem(k)).text);
 assert.deepEqual(left,[words[1]+' (tab A, unsent)'],'tab B saved and cleared only its own entry');
});

test('Write: a paragraph over the limit says the true limit and keeps the words; a saved paragraph is logged once, not at every pause',{timeout:90000},async()=>{
 const {base,vault}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{on:true,on:true}),file=vaultFile(vault,'Kiln Keeper');
 const bytes=fs.readFileSync(file,'utf8'),sent=edits(pg.calls).length;
 const box=boxes(pg.doc)[1];type(pg.w,box,'a'.repeat(200001));await settle(1900);
 const c=pg.doc.querySelector('[data-wr-conflict]');assert.equal(c.hidden,false);assert.match(c.textContent,/at most 200,000 characters/);assert.match(c.textContent,/200,001/);
 assert.equal(edits(pg.calls).length,sent);assert.equal(fs.readFileSync(file,'utf8'),bytes);assert.equal(boxes(pg.doc)[1].value.length,200001,'kept');
 const log0=entriesIn(editsLog(vault,'Kiln Keeper'));
 const long='A long paragraph, '.repeat(1000)+' ';// a trailing space the Magazine trims
 type(pg.w,boxes(pg.doc)[1],long);blur(pg.w,boxes(pg.doc)[1]);await quiet(pg.doc,30000);
 for(let i=0;i<3;i++){await settle(1700);}
 assert.equal(entriesIn(editsLog(vault,'Kiln Keeper'))-log0,1,'one entry for one change, however many pauses follow');
 assert.equal(edits(pg.calls).length,sent+1);
});

test('a suggestion that reorders, or drops a duplicate, is described truthfully; a refused Accept shows the Magazine\'s own wording',{timeout:90000},async()=>{
 const {base,vault}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{on:true,on:true}),{proposalChanges}=pg.w.v2.shared.writeStory;
 const a='---\ntype: DEV\n---\n\nOne.\n\nTwo.\n\nTwo.\n\nThree.\n';
 const same=r=>JSON.parse(JSON.stringify(r));
 assert.deepEqual(same(proposalChanges(a,'---\ntype: DEV\n---\n\nThree.\n\nOne.\n\nTwo.\n\nTwo.\n')),{out:[],in:[],reordered:true});
 assert.deepEqual(same(proposalChanges(a,'---\ntype: DEV\n---\n\nOne.\n\nTwo.\n\nThree.\n')),{out:['Two.'],in:[],reordered:false},'a removed duplicate is not "the same"');
 assert.deepEqual(same(proposalChanges(a,a)),{out:[],in:[],reordered:false});
 // a stale Accept: the card is open, the words change, he presses Accept
 const made=await propose(base,KILN,['She lifted the first bowl','She raised the first bowl']);assert.equal(made.status,200);
 const ui=await livePage(base,'/write/'+KILN.id,{on:true,on:true});await until(()=>ui.doc.querySelector('[data-prop]'));
 fs.appendFileSync(vaultFile(vault,'Kiln Keeper'),'\nA line added outside, so the suggestion is stale.\n');
 ui.doc.querySelector('[data-act="accept"]').click();
 await until(()=>/changed after these words were proposed/.test(ui.doc.body.textContent));
});

// ---------- an ordinary subject is unchanged ----------
test('the story editor is only for a story: Write finds an ordinary subject\'s draft as before',()=>{
 const src=read('public/v2/screens/write.js');
 assert.match(src,/found&&found\.story\?openStory\(page,ctx,found\):open\(page,ctx,found\)/);
 assert.doesNotMatch(src,/[\u2014]/,'no em dash');assert.doesNotMatch(src,/\bfetch\(/);
 for(const f of ['read','check']){const t=read(`public/v2/screens/${f}.js`);assert.doesNotMatch(t,/[\u2014]/);assert.doesNotMatch(t,/\bfetch\(/);}
});

test('as shipped, no request to magazine.working-draft.edit is made from the page as human:adrian, even after typing',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id);
 const box=boxes(pg.doc)[1];
 type(pg.w,box,'typed anyway');blur(pg.w,box);await settle(1800);
 assert.equal(edits(pg.calls).length,0);assert.equal(pg.calls.filter(c=>/working-draft\/edit/.test(c.path)).length,0);
 assert.equal(kept(pg.w,WEAVER),null);
});
