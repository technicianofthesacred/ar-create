// The promises about Adrian's words, written once and run against both fronts' Write (version two, public/v2/screens/
// write.js, and version three, public/v3/screens/write*.js), against the real in-process server, so the two copies of the
// saving machinery cannot drift on what matters (plan: docs/plans/2026-11-12-write-read-check-build.md, V3-1):
//   unsaved words survive a reload and a crash, and a failed save keeps them on the device;
//   a newer saved version never discards or overwrites: a paragraph changed elsewhere is kept, his own change is kept;
//   where both changed one paragraph, both are kept until he chooses, and the one he does not keep is kept on the app;
//   two tabs never lose each other's words, and a closed tab's words are taken in once, by one tab only;
//   version two and version three open on one piece meet at the server, and neither touches the other's (or Advanced's) keys;
//   an assistant's page cannot save prose.
// He is stood in for as the other tests do (the page's own author, human:adrian; X-AR-Actor: human:adrian on direct calls).
// Two tabs share one device store and one Web Lock manager, as tabs of one browser do. Invented words only.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const windows=[];
const until=async(check,ms=25000,what='')=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('timed out '+what);await settle(25);}};

// ---------- the world: one real server with the demo's invented subjects ----------
let world=null;
async function theWorld(){
 if(world)return world;
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+s.address().port;
 await fillDemo(base,{only:['straw-over-the-rows','the-first-cup','studio-after-rain','circle-of-twelve','ink-on-warm-paper','shade-and-patience','small-paintings-of-doors']});
 world={base,close:async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}};
 return world;
}
after(async()=>{for(const w of windows)try{w.close();}catch{}if(world)await world.close();});
const getJSON=async(base,p,headers={})=>(await fetch(base+p,{headers})).json();
const subjectOf=async(base,slug)=>{const st=await getJSON(base,'/api/subject/standing?parentStudyId=demo-'+slug);return {id:'demo-'+slug,binding:st.facts.bindingId,piece:st.forms.find(f=>f.kind==='article').id};};
const draftOf=(base,sub)=>getJSON(base,`/api/study-draft/read?bindingId=${sub.binding}&parentStudyId=${sub.id}`);
const wordsOf=d=>d.projection.filter(r=>r.safe!==false||r.words).map(r=>r.words);
const asideOf=async(base,sub)=>(await getJSON(base,`/api/study-draft/set-aside/list?bindingId=${sub.binding}&parentStudyId=${sub.id}`)).items||[];
const post=async(base,route,body,actor='human:adrian')=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-AR-Actor':actor,'X-AR-Client':'cli'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
/** Another window of his saves a change to one paragraph, through the same command. */
async function elsewhere(base,sub,pick,insert='Elsewhere: '){
 const cur=await draftOf(base,sub),row=pick(cur.projection.filter(r=>r.safe!==false&&r.words&&r.words.length>30));
 const r=await post(base,'/api/study-draft/save',{bindingId:sub.binding,parentStudyId:sub.id,operationId:crypto.randomUUID(),expected:cur.expected,operations:[{kind:'text',id:row.id,from:0,to:0,insert,seenBlockHash:row.blockHash}]});
 assert.equal(r.status,200,JSON.stringify(r.body));return row.id;
}

// ---------- a device: one store and one lock manager shared by the tabs of one browser ----------
function device(){
 const data=new Map(),heldBy=new Map();
 const storage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{data.set(String(k),String(v));},removeItem:k=>{data.delete(k);},clear:()=>data.clear()};
 const locks=owner=>({request(name,opts,cb){
  if(typeof opts==='function'){cb=opts;opts={};}
  if(heldBy.has(name))return Promise.resolve().then(()=>cb(null));
  heldBy.set(name,owner);
  return Promise.resolve().then(()=>cb({name,mode:'exclusive'})).finally(()=>{if(heldBy.get(name)===owner)heldBy.delete(name);});
 }});
 return {data,storage,locks,crash(owner){for(const [k,o] of [...heldBy])if(o===owner)heldBy.delete(k);},heldBy};
}

// ---------- the two fronts, and how he answers each one's question ----------
const FRONTS=[
 {name:'version two',dir:'v2',prefix:'ar-v2-write:',eds:doc=>[...doc.querySelectorAll('textarea.wr-ed[data-ed]')],
  box:doc=>{const b=doc.querySelector('[data-wr-conflict]');return b&&!b.hidden?b:null;},
  /** A newer version with no paragraph changed in both places: version two asks; he keeps his words. */
  async takeNewer(pg){const b=await until(()=>FRONTS[0].box(pg.doc),25000,'the newer-version box');b.querySelector('[data-act="mine"]').click();},
  pairShown:(pg,rid)=>!!FRONTS[0].box(pg.doc)?.querySelector(`[data-act="pair"][data-k="${rid}"]`),
  async keep(pg,rid,v){const b=FRONTS[0].box(pg.doc);if(v==='both')throw new Error('version two keeps one of the two');b.querySelector(`[data-act="pair"][data-v="${v}"][data-k="${rid}"]`).click();FRONTS[0].box(pg.doc).querySelector('[data-act="mine"]').click();},
  async useSaved(pg){FRONTS[0].box(pg.doc).querySelector('[data-act="theirs"]').click();},
  /** A closed tab's words: version two takes them into the page as after a reload. */
  shownFromClosed:(pg,words)=>FRONTS[0].eds(pg.doc).some(t=>t.value.includes(words)),
  async putBackClosed(){}},
 {name:'version three',dir:'v3',prefix:'ar-v3-write:',eds:doc=>[...doc.querySelectorAll('.wr-ed[data-ed]')],
  box:doc=>doc.querySelector('.wr-two'),
  async takeNewer(){/* taken paragraph by paragraph: nothing to press */},
  pairShown:(pg,rid)=>!!pg.doc.querySelector(`[data-row="${rid}"] .wr-two`),
  async keep(pg,rid,v){pg.doc.querySelector(`[data-row="${rid}"] [data-act="keep"][data-v="${v}"]`).click();},
  async useSaved(pg,rid){pg.doc.querySelector(`[data-row="${rid}"] [data-act="keep"][data-v="theirs"]`).click();},
  /** A closed tab's words: offered once, in place. */
  shownFromClosed:(pg,words)=>!!pg.doc.querySelector('[data-wr-side="recovered"]')&&[...pg.doc.querySelectorAll('.wr-rec')].some(e=>e.textContent.includes(words)),
  async putBackClosed(pg){(await until(()=>pg.doc.querySelector('[data-act="rec"][data-v="back"]'))).click();}},
];

/** The real page of one front on the real server. dev shares a store and locks with other tabs; down cuts the connection. */
async function livePage(front,base,sub,{search='',dev=null,owner='tab',seed=null}={}){
 const html=read(`public/${front.dir}/index.html`);
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+`/${front.dir}/index.html`+search+'#/write/'+sub.id+'?piece='+sub.piece,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];windows.push(w);
 if(dev){Object.defineProperty(w,'localStorage',{configurable:true,get:()=>dev.storage});Object.defineProperty(w.navigator,'locks',{configurable:true,get:()=>dev.locks(owner)});}
 if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET',entry={path:u.pathname,method,body:options.body?JSON.parse(options.body):null,status:0};calls.push(entry);
  if(w.__down)throw new TypeError('Failed to fetch');
  if(w.__fail&&u.pathname==='/api/study-draft/save'){entry.status=500;return {ok:false,status:500,text:async()=>JSON.stringify({error:'The app is down.'})};}
  const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});
  const text=await r.text();entry.status=r.status;return {ok:r.ok,status:r.status,text:async()=>text};
 };
 const dir=path.join(repo,'public',front.dir);
 for(const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await until(()=>w.document.querySelector('.wr-ed[data-ed]')||w.document.querySelector('.wr-none'),25000,'the page');
 await settle(150);
 return {w,doc:w.document,calls,front};
}
const type=(w,el,value)=>{el.focus();el.value=value;try{el.setSelectionRange(value.length,value.length);}catch{}el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const blur=(w,el)=>el.dispatchEvent(new w.Event('focusout',{bubbles:true}));
const savedSaying=doc=>doc.querySelector('.wr-bar [data-wr-saved]').textContent;
const quiet=doc=>until(()=>/^Saved/.test(savedSaying(doc)),30000,'saved');
const rowOf=(pg,id)=>pg.front.eds(pg.doc).find(t=>t.dataset.ed===id);
const longRow=(pg,i=0)=>pg.front.eds(pg.doc).filter(t=>t.value.length>30)[i];
const keysOf=(storage,prefix,sub)=>{const out={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k&&(k===prefix+sub.binding||k.startsWith(prefix+sub.binding+':')))out[k]=JSON.parse(storage.getItem(k));}return out;};
const keptWords=rec=>[...(rec?.edits||[]).map(e=>e[1]),...(rec?.added||[]).map(a=>a.text)];

for(const front of FRONTS){

test(`${front.name}: unsaved words survive a failed save, a crash and a reload, and are then saved once`,{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,front.dir==='v2'?'straw-over-the-rows':'the-first-cup');
 const a=await livePage(front,base,sub);
 const t=longRow(a),words=t.value+' Kept through a crash.';
 a.w.__fail=true;type(a.w,t,words);blur(a.w,t);
 await until(()=>a.calls.some(c=>c.path==='/api/study-draft/save'&&c.status===500),20000,'a failed save');
 const kept=keysOf(a.w.localStorage,front.prefix,sub);
 assert.ok(Object.values(kept).some(r=>keptWords(r).includes(words)),'a failed save keeps his words on this device');
 assert.equal(wordsOf(await draftOf(base,sub)).includes(words),false,'and nothing reached the app');
 a.w.__down=true;// the app goes away and the tab dies with it
 const seed={};for(let i=0;i<a.w.localStorage.length;i++){const k=a.w.localStorage.key(i);seed[k]=a.w.localStorage.getItem(k);}a.w.close();
 const b=await livePage(front,base,sub,{seed});
 assert.ok(front.eds(b.doc).some(e=>e.value===words),'after the reload his words are back on the page');
 await quiet(b.doc);
 const server=wordsOf(await draftOf(base,sub));
 assert.equal(server.filter(x=>x===words).length,1,'saved once');
 assert.deepEqual(Object.keys(keysOf(b.w.localStorage,front.prefix,sub)),[],'nothing is left waiting on the device');
});

test(`${front.name}: a newer version that changed another paragraph is kept, and his own change is kept, nothing overwritten`,{timeout:90000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,front.dir==='v2'?'studio-after-rain':'circle-of-twelve');
 const pg=await livePage(front,base,sub);
 const mine=longRow(pg,0),words=mine.value+' (typed here)';
 type(pg.w,mine,words);
 const otherId=await elsewhere(base,sub,rows=>rows.find(r=>r.id!==mine.dataset.ed));
 blur(pg.w,mine);
 await front.takeNewer(pg);
 await quiet(pg.doc);
 const d=await draftOf(base,sub),server=new Map(d.projection.map(r=>[r.id,r.words]));
 assert.equal(server.get(mine.dataset.ed),words,'his change is saved');
 assert.match(server.get(otherId),/^Elsewhere: /,'the other change is still there');
 assert.equal(rowOf(pg,otherId).value,server.get(otherId),'and on his page');
});

test(`${front.name}: both changed one paragraph: both are kept until he chooses, and the one he does not keep is kept on the app`,{timeout:120000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,front.dir==='v2'?'ink-on-warm-paper':'small-paintings-of-doors');
 const pg=await livePage(front,base,sub);
 const t=longRow(pg,0),rid=t.dataset.ed,words=t.value+' (typed here)';
 type(pg.w,t,words);
 await elsewhere(base,sub,rows=>rows.find(r=>r.id===rid));
 blur(pg.w,t);
 await until(()=>front.pairShown(pg,rid),25000,'both versions shown');
 await settle(2500);// nothing is decided for him while he looks
 const server=new Map((await draftOf(base,sub)).projection.map(r=>[r.id,r.words]));
 assert.match(server.get(rid),/^Elsewhere: /,'the saved version is not overwritten');
 assert.equal(server.get(rid).includes('(typed here)'),false,'and nothing is mixed into it');
 assert.ok(Object.values(keysOf(pg.w.localStorage,front.prefix,sub)).some(r=>keptWords(r).includes(words)),'his version waits on the device');
 assert.equal(pg.calls.filter(c=>c.path==='/api/study-draft/save').length,1,'no save is sent until he chooses');
 // He keeps the saved version: his is kept on the app first.
 await front.useSaved(pg,rid);
 await until(async()=>(await asideOf(base,sub)).some(e=>e.paragraphs.some(p=>p.words===words)),20000,'his words set aside');
 const aside=(await asideOf(base,sub)).find(e=>e.paragraphs.some(p=>p.words===words));
 assert.equal(aside.actor,'human:adrian');assert.equal(aside.reason,'conflict');
 await until(()=>rowOf(pg,rid)?.value.startsWith('Elsewhere: '),20000,'the saved version on the page');
 assert.equal(new Map((await draftOf(base,sub)).projection.map(r=>[r.id,r.words])).get(rid),server.get(rid),'the saved version stands');
 // The same again on another paragraph, and this time he keeps his own: the other stays in the draft's history.
 const u=longRow(pg,1),uid=u.dataset.ed,mineToo=u.value+' (mine, kept)';
 type(pg.w,u,mineToo);
 await elsewhere(base,sub,rows=>rows.find(r=>r.id===uid),'Theirs too: ');
 blur(pg.w,u);
 await until(()=>front.pairShown(pg,uid),25000,'both versions shown again');
 await front.keep(pg,uid,'mine');
 await quiet(pg.doc);
 const d=await draftOf(base,sub);assert.equal(new Map(d.projection.map(r=>[r.id,r.words])).get(uid),mineToo,'his version is saved because he chose it');
 const theirs=[...d.history].filter(h=>h.state==='committed').at(-2);
 const prev=await post(base,'/api/study-draft/history-preview',{bindingId:sub.binding,parentStudyId:sub.id,versionOperationId:theirs.operationId,position:'after'});
 assert.equal(prev.status,200);assert.ok(prev.body.projection.some(r=>r.id===uid&&r.words.startsWith('Theirs too: ')),'the version he did not keep is in the history');
});

test(`${front.name}: two tabs never lose each other's words, and a closed tab's words are taken in once, by one tab only`,{timeout:150000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,front.dir==='v2'?'shade-and-patience':'straw-over-the-rows'),dev=device();
 const a=await livePage(front,base,sub,{dev,owner:'A'}),b=await livePage(front,base,sub,{dev,owner:'B'});
 a.w.__down=true;b.w.__down=true;
 const ta=longRow(a,0),tb=longRow(b,1),wa=ta.value+' (tab A)',wb=tb.value+' (tab B)';
 type(a.w,ta,wa);type(b.w,tb,wb);await settle(300);
 const keys=keysOf(dev.storage,front.prefix,sub);
 assert.equal(Object.keys(keys).length,2,'one key for each tab');
 assert.ok(Object.values(keys).some(r=>keptWords(r).includes(wa))&&Object.values(keys).some(r=>keptWords(r).includes(wb)),'each tab\'s words, neither written over');
 // Tab A dies with its words unsaved. Two tabs open; only one is given A's words.
 dev.crash('A');a.w.close();
 const [c,d]=await Promise.all([livePage(front,base,sub,{dev,owner:'C'}),livePage(front,base,sub,{dev,owner:'D'})]);
 await settle(800);
 const shown=[c,d].filter(pg=>front.shownFromClosed(pg,wa));
 assert.equal(shown.length,1,'offered once, in one tab');
 await front.putBackClosed(shown[0]);
 await until(async()=>wordsOf(await draftOf(base,sub)).includes(wa),30000,'A\'s words saved');
 // Tab B comes back: its own words go on top of what is now saved.
 b.w.__down=false;
 await front.takeNewer(b);
 await until(async()=>wordsOf(await draftOf(base,sub)).includes(wb),40000,'B\'s words saved');
 const server=wordsOf(await draftOf(base,sub));
 assert.equal(server.filter(x=>x===wa).length,1);assert.equal(server.filter(x=>x===wb).length,1,'both tabs\' words, each once');
 await settle(500);
 const left=keysOf(dev.storage,front.prefix,sub);
 assert.deepEqual(Object.values(left).flatMap(keptWords).filter(x=>x===wa||x===wb),[],'nothing of either is stranded on the device');
});

test(`${front.name}: an assistant's page cannot save prose, keep words on the device or set words aside`,{timeout:60000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'the-first-cup'),before=wordsOf(await draftOf(base,sub));
 const pg=await livePage(front,base,sub,{search:'?reviewActor=agent:codex'});
 const t=longRow(pg,0);
 assert.ok(t.readOnly,'his paragraphs are read only for an assistant');
 type(pg.w,t,t.value+' typed by an assistant');blur(pg.w,t);await settle(2200);
 assert.equal(pg.calls.filter(c=>c.method==='POST'&&/study-draft\/(save|set-aside)/.test(c.path)).length,0,'nothing sent');
 assert.equal(pg.w.localStorage.length,0,'nothing kept on the device');
 const cur=await draftOf(base,sub),row=cur.projection.find(r=>r.safe!==false&&r.words);
 const save=await post(base,'/api/study-draft/save',{bindingId:sub.binding,parentStudyId:sub.id,operationId:crypto.randomUUID(),expected:cur.expected,operations:[{kind:'text',id:row.id,from:0,to:0,insert:'Agent: ',seenBlockHash:row.blockHash}]},'agent:codex');
 assert.equal(save.status,403);
 const aside=await post(base,'/api/study-draft/set-aside',{bindingId:sub.binding,parentStudyId:sub.id,operationId:crypto.randomUUID(),reason:'conflict',paragraphs:[{words:'Agent words.'}]},'agent:codex');
 assert.equal(aside.status,403);
 assert.deepEqual(wordsOf(await draftOf(base,sub)),before,'the draft is as it was');
});
}

test('version two and version three open on one piece: their keys never meet, Advanced\'s are untouched, and the conflict is settled at the server with both kept',{timeout:150000},async()=>{
 const {base}=await theWorld(),sub=await subjectOf(base,'ink-on-warm-paper'),dev=device(),[two,three]=FRONTS;
 const advanced={['ar-document-study-owned-drafts-v1:'+sub.binding]:JSON.stringify({kept:'Advanced words, not ours to touch.'})};
 for(const [k,v] of Object.entries(advanced))dev.storage.setItem(k,v);
 const p2=await livePage(two,base,sub,{dev,owner:'two'}),p3=await livePage(three,base,sub,{dev,owner:'three'});
 p2.w.__down=true;p3.w.__down=true;
 const t2=longRow(p2,0),rid=t2.dataset.ed,t3=three.eds(p3.doc).find(e=>e.dataset.ed===rid);
 const w2=t2.value+' (in version two)',w3=t3.value+' (in version three)';
 type(p2.w,t2,w2);type(p3.w,t3,w3);await settle(300);
 const k2=keysOf(dev.storage,two.prefix,sub),k3=keysOf(dev.storage,three.prefix,sub);
 assert.deepEqual(Object.values(k2).flatMap(keptWords),[w2],'version two keeps its own under its own key');
 assert.deepEqual(Object.values(k3).flatMap(keptWords),[w3],'version three keeps its own under its own key');
 // Version two saves first; version three then meets the newer version at the server and both are kept.
 p2.w.__down=false;blur(p2.w,t2);
 await until(async()=>wordsOf(await draftOf(base,sub)).includes(w2),30000,'version two saved');
 p3.w.__down=false;blur(p3.w,t3);
 await until(()=>three.pairShown(p3,rid),40000,'both versions shown in version three');
 await three.keep(p3,rid,'both');
 await until(async()=>(await draftOf(base,sub)).projection.some(r=>r.id===rid&&r.words.includes('(in version two)')&&r.words.includes('(in version three)')),30000,'both kept');
 for(const [k,v] of Object.entries(advanced))assert.equal(dev.storage.getItem(k),v,'Advanced\'s key is exactly as it was');
 await settle(800);
 assert.deepEqual(Object.values(keysOf(dev.storage,two.prefix,sub)).flatMap(keptWords),[],'nothing of version two is left waiting');
 assert.deepEqual(Object.values(keysOf(dev.storage,three.prefix,sub)).flatMap(keptWords),[],'nothing of version three is left waiting');
});
