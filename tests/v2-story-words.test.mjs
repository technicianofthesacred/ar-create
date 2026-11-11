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
async function livePage(base,route,{search='',slowEdit=0,lateEdit=0,seed=null,ready='textarea.wr-ed,.wr-none,.ck-work,.ck-none,.rd-text,.rd-empty'}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+search+'#'+route,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
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
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(repo,'public/v2',src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector(ready));
 await settle(150);
 return {w,doc:w.document,calls,sources};
}
const key=s=>`ar-v2-write-story:${s.id}:${s.piece}`;
const kept=(w,s)=>JSON.parse(w.localStorage.getItem(key(s))||'null');
const type=(w,el,value)=>{el.focus();el.value=value;el.setSelectionRange(value.length,value.length);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const blur=(w,el)=>el.dispatchEvent(new w.Event('focusout',{bubbles:true}));
const boxes=doc=>[...doc.querySelectorAll('textarea.wr-ed')];
const savedSaying=doc=>doc.querySelector('.wr-bar [data-wr-saved]').textContent;
const quiet=(doc,ms=20000)=>until(()=>/^Saved/.test(savedSaying(doc)),ms);
const edits=calls=>calls.filter(c=>c.path==='/api/magazine/working-draft/edit'&&c.method==='POST');
/** A reload keeps only what is on the device. */
async function reload(old,base,route,opts={}){
 const seed={};for(let i=0;i<old.w.localStorage.length;i++){const k=old.w.localStorage.key(i);seed[k]=old.w.localStorage.getItem(k);}
 old.w.close();return livePage(base,route,{...opts,seed});
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
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id);
 const before=await wordsOf(base,WEAVER),box=boxes(pg.doc)[1];
 assert.equal(box.value,before[1]);
 type(pg.w,box,before[1]+' (typed)');blur(pg.w,box);
 await quiet(pg.doc);
 const sent=edits(pg.calls);assert.equal(sent.length,1);assert.match(sent[0].body.seen,/^[a-f0-9]{12}$/);assert.equal(sent[0].body.edition,'working');
 assert.deepEqual(Object.keys(sent[0].body).sort(),['block','edition','operationId','pieceId','seen','storyId','text'],'only the fields the command takes');
 assert.equal((await wordsOf(base,WEAVER))[1],before[1]+' (typed)');
 assert.equal(pg.w.localStorage.getItem(key(WEAVER)),null,'nothing waits on the device once saved');
 const again=await reload(pg,base,'/write/'+WEAVER.id);
 assert.equal(boxes(again.doc)[1].value,before[1]+' (typed)');
});
test('Write: words typed while a save is in flight are never lost',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{slowEdit:600});
 const box=boxes(pg.doc)[2],start=(await wordsOf(base,WEAVER))[2];
 let typed=start+' and then';type(pg.w,box,typed);blur(pg.w,box);// in flight now
 await settle(120);
 for(const word of [' carried on','  while it was saving',' and again']){typed+=word;type(pg.w,box,typed);await settle(40);}
 await until(()=>/^Saved/.test(savedSaying(pg.doc))&&(boxes(pg.doc)[2].value===typed),30000);
 await settle(2500);await quiet(pg.doc,30000);
 const flat=typed.replace(/\s+/g,' ');
 assert.equal((await wordsOf(base,WEAVER))[2].replace(/\s+/g,' '),flat,'every character is in the Magazine, once');
 assert.equal(boxes(pg.doc)[2].value.replace(/\s+/g,' '),flat);
 assert.equal(pg.w.localStorage.getItem(key(WEAVER)),null);
 assert.ok(edits(pg.calls).every(c=>c.status===200),'no refused save');
});
test('Write: a reload while a save is on its way (the Magazine has it, the answer is lost) shows no newer version and loses nothing',{timeout:90000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id,{slowEdit:1500});
 const box=boxes(pg.doc)[3],start=(await wordsOf(base,WEAVER))[3];
 type(pg.w,box,start+' [one]');blur(pg.w,box);
 await until(()=>edits(pg.calls)[0]?.status===200);// the Magazine has it; the page has not heard
 type(pg.w,boxes(pg.doc)[3],start+' [one] [two]');// and he typed more
 assert.ok(kept(pg.w,WEAVER).edits.some(e=>e.sending),'the operation in flight is kept with his words');
 const again=await reload(pg,base,'/write/'+WEAVER.id);
 assert.equal(again.doc.querySelector('[data-wr-conflict]').hidden,true,'his own save is not a newer version');
 await quiet(again.doc,30000);await settle(800);await quiet(again.doc,30000);
 assert.equal((await wordsOf(base,WEAVER))[3],start+' [one] [two]');
 assert.equal(boxes(again.doc)[3].value,start+' [one] [two]');
 assert.ok(edits(again.calls).every(c=>c.status===200),'no refused save: '+JSON.stringify(edits(again.calls).map(c=>c.status)));
 assert.equal(again.w.localStorage.getItem(key(WEAVER)),null);
});
test('Write: a tab closed before the save reached the Magazine keeps his words, and the next page saves them',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{lateEdit:4000});
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
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+WEAVER.id);
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
 const third=await livePage(base,'/write/'+WEAVER.id),b3=boxes(third.doc)[1];
 assert.equal((await editElsewhere(base,WEAVER,1,'A later hand.')).status,200);
 type(third.w,b3,'Words he will let go.');blur(third.w,b3);
 await until(()=>!third.doc.querySelector('[data-wr-conflict]').hidden);
 third.doc.querySelector('[data-act="theirs"]').click();
 await until(()=>third.doc.querySelector('[data-wr-conflict]').hidden);
 assert.equal(boxes(third.doc)[1].value,'A later hand.');assert.equal((await wordsOf(base,WEAVER))[1],'A later hand.');
 assert.equal(third.w.localStorage.getItem(key(WEAVER)),null);
});
test('Write: a Magazine that is held by someone else keeps his words and saves them when it is free',{timeout:60000},async()=>{
 const {base,vault}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id);
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
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id);
 const locked=[...pg.doc.querySelectorAll('.wr-lock')].find(n=>/She never looked at the clock/.test(n.textContent));
 assert.ok(locked,'shown');assert.match(pg.doc.querySelector('.wr-lock-why').textContent,/review decision in the Magazine/);
 assert.ok(!boxes(pg.doc).some(b=>/never looked at the clock/.test(b.value)));
 assert.match(pg.doc.querySelector('.wr-todo').textContent,/Not built yet/,'new and removed paragraphs say so and open in Advanced');
 assert.ok(pg.doc.querySelector('.wr-todo [data-wr-advanced]'));
});
test('Write: an assistant\'s page is read only: it types nothing, keeps nothing, restores nothing and cannot save',{timeout:60000},async()=>{
 const {base}=await theWorld(),human=await livePage(base,'/write/'+WEAVER.id,{lateEdit:6000});
 const hb=boxes(human.doc)[1],words=(await wordsOf(base,WEAVER))[1];
 type(human.w,hb,words+' HIS UNSAVED');
 const seed={[key(WEAVER)]:human.w.localStorage.getItem(key(WEAVER))};assert.ok(seed[key(WEAVER)],'his words are on the device');
 human.w.close();
 const ai=await livePage(base,'/write/'+WEAVER.id,{search:'?reviewActor=agent:claude-code',seed});
 assert.ok(boxes(ai.doc).length>0&&boxes(ai.doc).every(b=>b.readOnly),'every paragraph is read only');
 assert.ok(!boxes(ai.doc).some(b=>/HIS UNSAVED/.test(b.value)),'his kept words are not restored as an assistant\'s page');
 assert.equal(ai.doc.querySelector('[data-wr-saved]').textContent,'Read only');
 assert.match(ai.doc.querySelector('.wr-ro').textContent,/Only Adrian writes here/);
 type(ai.w,boxes(ai.doc)[1],words+' typed by an assistant');blur(ai.w,boxes(ai.doc)[1]);
 await settle(2200);
 assert.equal(edits(ai.calls).length,0,'no save is attempted');
 assert.equal((await wordsOf(base,WEAVER))[1],words);
 assert.equal(ai.w.localStorage.getItem(key(WEAVER)),seed[key(WEAVER)],'an assistant leaves nothing of its own on the device, and does not take his');
 // and the Magazine itself refuses an assistant's edit
 const d=await draftOf(base,WEAVER),p=d.paragraphs[1];
 const refused=await api(base,'POST','/api/magazine/working-draft/edit',{agent:true,input:{...body(WEAVER),block:p.block,seen:p.seen,text:'x',operationId:uuid()}});
 assert.equal(refused.status,403);
});
test('Write: presence tells an assistant he has unsaved words, only while he has them',{timeout:60000},async()=>{
 const {base}=await theWorld(),pg=await livePage(base,'/write/'+KILN.id,{lateEdit:1500});
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
 const ai=await livePage(base,'/write/'+WEAVER.id,{search:'?reviewActor=agent:claude-code'});
 await until(()=>ai.doc.querySelector('[data-prop]'));
 assert.match(ai.doc.querySelector('[data-prop]').textContent,/lake needs/);
 assert.equal(ai.doc.querySelectorAll('[data-prop] button').length,0,'an assistant\'s page has no decision to press');
 assert.match(ai.doc.querySelector('[data-prop]').textContent,/Only Adrian decides/);
 const refused=await api(base,'POST','/api/magazine/proposal/accept',{agent:true,input:{proposalId:made.value.proposalId,operationId:uuid()}});
 assert.equal(refused.status,403);assert.ok(!(await wordsOf(base,WEAVER)).some(t=>/lake needs/.test(t)),'nothing was written');
 // as him, with unsaved words open, a decision waits
 const pg=await livePage(base,'/write/'+WEAVER.id,{lateEdit:5000});
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
 const p2=await livePage(base,'/write/'+WEAVER.id);
 await until(()=>p2.doc.querySelector('[data-prop]'));
 p2.doc.querySelector('[data-act="reject"]').click();
 await until(()=>!p2.doc.querySelector('[data-prop]'));
 assert.ok(!(await wordsOf(base,WEAVER)).some(t=>/water needs/.test(t)));
 // a suggestion made on older words is not offered
 const third=await propose(base,WEAVER,['what the lake needs','what the shore needs']);assert.equal(third.status,200);
 assert.equal((await editElsewhere(base,WEAVER,0,'A changed metadata line.')).status,200);
 const p3=await livePage(base,'/write/'+WEAVER.id);await settle(600);
 assert.equal(p3.doc.querySelector('[data-prop]'),null);assert.match(p3.doc.querySelector('.wr-stale').textContent,/set aside/);
});

// ---------- an ordinary subject is unchanged ----------
test('the story editor is only for a story: Write finds an ordinary subject\'s draft as before',()=>{
 const src=read('public/v2/screens/write.js');
 assert.match(src,/found&&found\.story\?openStory\(page,ctx,found\):open\(page,ctx,found\)/);
 assert.doesNotMatch(src,/[\u2014]/,'no em dash');assert.doesNotMatch(src,/\bfetch\(/);
 for(const f of ['read','check']){const t=read(`public/v2/screens/${f}.js`);assert.doesNotMatch(t,/[\u2014]/);assert.doesNotMatch(t,/\bfetch\(/);}
});
