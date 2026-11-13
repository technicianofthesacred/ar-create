import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

// Version three's Home (public/v3/screens/home.js and home.css): a copy of version two's Home in the approved look
// (design/2026-11-write/NOTES.md, third pass). The route is claimed by version three's file only, the style sheet keeps
// to the system (sizes 13 and 14, weights 400 and 600, corners 6 and 8 and round, every rule under .v3-home), and the
// screen runs against the real in-process server with invented subjects. Invented words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM,VirtualConsole}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v3dir=path.join(repo,'public/v3');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=(ms=30)=>new Promise(r=>setTimeout(r,ms));
const until=async(check,what,ms=15000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('Timed out waiting for '+what);await settle(25);}};
const scriptsOf=html=>[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const stylesOf=html=>[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);

let theShared=null;
async function theWorld(){
 if(theShared)return theShared;
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 theShared={base:'http://127.0.0.1:'+s.address().port,close:async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}};
 return theShared;
}
after(async()=>{if(theShared)await theShared.close();});

/** Version three's page in a DOM. fetchImpl answers its requests; EventSource is a stand-in the test can speak through. */
async function page({base,fetchImpl,hash='#/',storage={}}){
 const html=read('public/v3/index.html'),errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('error',(...a)=>errors.push(a.map(String).join(' ')));virtualConsole.on('jsdomError',e=>errors.push(String(e?.message||e)));
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v3/index.html'+hash,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const w=dom.window,sources=[];windows.push(w);
 w.scrollTo=()=>{};w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
 w.EventSource=class{constructor(u){this.url=u;this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){this.closed=true;}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.fetch=fetchImpl;
 for(const src of scriptsOf(html))w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v3dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,doc:w.document,sources,errors};
}

/** A selector list split at its top-level commas (not the ones inside :is(...)). */
function topLevel(list){const out=[];let depth=0,from=0;for(let i=0;i<list.length;i++){if(list[i]==='(')depth++;else if(list[i]===')')depth--;else if(list[i]===','&&!depth){out.push(list.slice(from,i).trim());from=i+1;}}out.push(list.slice(from).trim());return out;}

/** The rules of a style sheet, with @media and @layer opened: [{selector, body}]. */
function rulesOf(css){
 const text=css.replace(/\/\*[\s\S]*?\*\//g,''),out=[];
 (function walk(src){
  let i=0;
  while(i<src.length){
   const open=src.indexOf('{',i);if(open<0)break;
   const prelude=src.slice(i,open).trim();let depth=1,j=open+1;
   while(j<src.length&&depth){if(src[j]==='{')depth++;else if(src[j]==='}')depth--;j++;}
   const body=src.slice(open+1,j-1);
   if(prelude.startsWith('@media')||prelude.startsWith('@layer')||prelude.startsWith('@supports'))walk(body);
   else if(!prelude.startsWith('@'))out.push({selector:prelude,body});
   i=j;
  }
 })(text);
 return out;
}

test('the route is claimed by version three\'s Home only, and index.html no longer lists version two\'s Home files',()=>{
 const html=read('public/v3/index.html'),scripts=scriptsOf(html),styles=stylesOf(html);
 assert.ok(scripts.includes('screens/home.js'));assert.ok(styles.includes('screens/home.css'));
 assert.ok(!scripts.includes('/v2/screens/home.js'),'two files never claim one route');
 assert.ok(!styles.includes('/v2/screens/home.css'));
 assert.equal(scripts.filter(s=>/home\.js$/.test(s)).length,1);
 for(const f of ['home.js','home.css'])assert.ok(fs.existsSync(path.join(v3dir,'screens',f)),f);
 assert.match(read('public/v3/screens/home.js'),/v2\.screen\(\{id:'home',title:'Home',route:''/);
 assert.ok(fs.existsSync(path.join(repo,'public/v2/screens/home.js')),'version two still has its own Home');
});

test('the style sheet keeps to the system: sizes 13 and 14, weights 400 and 600, corners 6 and 8 and round, no em dash, every rule under .v3-home',()=>{
 const css=read('public/v3/screens/home.css'),rules=rulesOf(css);
 assert.ok(rules.length>100);
 for(const {selector,body} of rules){
  for(const sel of topLevel(selector))assert.match(sel,/^\.v3-home(?![\w-])/,'scoped under .v3-home: '+sel);
  for(const m of body.matchAll(/(?:^|[;\s!])font:\s*([^;]+)/g)){
   const parts=m[1].replace(/!important/,'').trim().split(/\s+/);
   assert.ok(['400','600'].includes(parts[0]),'weight 400 or 600 in "font:'+m[1]+'" ('+selector+')');
   assert.match(parts[1],/^1[34]px(\/|$)/,'size 13 or 14 in "font:'+m[1]+'" ('+selector+')');
  }
  for(const m of body.matchAll(/font-size:\s*([^;]+)/g))assert.match(m[1].trim(),/^1[34]px/,'font-size '+m[1]);
  for(const m of body.matchAll(/font-weight:\s*([^;!]+)/g))assert.match(m[1].trim(),/^(400|600)$/,'font-weight '+m[1]);
  for(const m of body.matchAll(/border-radius:\s*([^;]+)/g))assert.match(m[1].replace(/!important/,'').trim(),/^(0|6px|8px|50%)$/,'radius '+m[1]+' ('+selector+')');
 }
 assert.doesNotMatch(css,/\u2014/,'no em dash');assert.doesNotMatch(read('public/v3/screens/home.js'),/\u2014/);
 assert.doesNotMatch(css,/font-style:\s*italic/);
 for(const token of css.match(/var\(--[\w-]+/g)||[]){
  assert.ok(/^var\(--(ink|dim|warm|paper|bg|line|ar-ui|p|h3-dot|v3-fill2?|v3-edge)$/.test(token),'only the app\'s tokens: '+token);
 }
});

test('every class the script draws is h3- (or the shared v2- parts it reuses), so nothing meets version two\'s Home styles',()=>{
 const js=read('public/v3/screens/home.js');
 const classes=new Set();for(const m of js.matchAll(/class="([^"$]*)/g))for(const c of m[1].split(/\s+/).filter(Boolean))classes.add(c);
 for(const c of classes)assert.match(c,/^(h3-|v3-home$|v2-page$|v2-ic$|has-img$|ok$)/,c);
 assert.ok(!/\bhome-[a-z]/.test(js.replace(/data-home-[a-z]+/g,'').replace(/ar-create-v2-home|ar-v3-home-covers/g,'')),'no version two class names left');
});

test('Home runs in version three\'s frame against the real server: the same sections in the same order, New subject, Needs you, desk cards without a blank cover block, grouping, find',{timeout:90000},async()=>{
 const {base}=await theWorld(),{w,doc,errors}=await page({base,fetchImpl:pageFetch(base)});
 await until(()=>doc.querySelector('.v3-home[data-home] [data-home-groups] .h3-row'),'Home to draw');
 const home=doc.querySelector('.v3-home');
 assert.equal(w.v2.screens().filter(s=>s.id==='home').length,1);
 assert.equal(home.querySelector('h1').textContent,'Home');
 assert.ok(home.querySelector('header [data-home-new]'),'New subject');
 assert.equal(home.querySelector('header [data-home-new]').textContent.trim(),'New subject');
 const sections=[...home.children].map(e=>e.tagName+':'+(e.getAttribute('data-home-needs')!==null?'needs':e.getAttribute('data-home-desk')!==null?'desk':e.getAttribute('data-home-file')!==null?'file':e.getAttribute('data-home-all')!==null?'all':'header'));
 assert.deepEqual(sections,['HEADER:header','DIV:needs','SECTION:desk','SECTION:file','SECTION:all']);
 assert.deepEqual([...home.querySelectorAll('.h3-sec-h h2')].map(h=>h.textContent),['On your desk','Everything']);
 assert.deepEqual([...home.querySelectorAll('[data-group-by]')].map(b=>b.textContent),['By folder','By tag','By station','Recent']);
 assert.deepEqual([...home.querySelectorAll('[data-view]')].map(b=>b.textContent),['Rows','Covers']);
 assert.ok(home.querySelectorAll('[data-station]').length>=6,'the station filters');
 // a desk card with no cover picture has no cover block
 const cards=[...home.querySelectorAll('.h3-card')];
 for(const c of cards){assert.ok(c.querySelector('img')||!c.querySelector('.h3-card-pic'),'a card without a cover draws no cover block');assert.ok(c.querySelector('b'));assert.ok(c.querySelector('.h3-card-next'));}
 // grouping and find work as in version two
 home.querySelector('[data-group-by=station]').click();
 const stations=[...home.querySelectorAll('.h3-group>header h3')].map(h=>h.textContent);
 assert.ok(stations.length>0&&stations.every(n=>['Gather','Research','Create','Share','Published','Resting'].includes(n)),'grouped by station: '+stations);
 assert.equal(home.querySelector('[data-group-by=station]').getAttribute('aria-pressed'),'true');
 home.querySelector('[data-group-by=folder]').click();
 const find=home.querySelector('[data-home-find]');find.value='zzzz-nothing';find.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match(home.querySelector('.h3-all').textContent,/No subject matches/);
 find.value='';find.dispatchEvent(new w.Event('input',{bubbles:true}));
 // Move up and Move down are always drawn for the desk
 assert.ok(home.querySelectorAll('.h3-card>.v2-move [data-v2-down]').length===cards.length||cards.length===0);
 // New subject opens its sheet, with a form that wears the same scope
 home.querySelector('header [data-home-new]').click();
 const form=await until(()=>doc.querySelector('dialog.v2-sheet[open] form.v3-home.h3-form'),'the New subject sheet');
 assert.ok(form.querySelector('input[name=name]'));assert.ok(form.querySelector('button.h3-pri'));
 form.querySelector('[data-v2-close]').click();await settle(100);
 assert.deepEqual(errors,[]);
});

/* ---------------- the page, against the real server ---------------- */
async function server(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+s.address().port;
 // An assistant's own requests, as the CLI makes them.
 const agent=async(route,body,{op=true}={})=>{const r=await fetch(url+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-AR-Actor':'agent:codex','X-AR-Client':'http'},...(body?{body:JSON.stringify({...(op?{operationId:crypto.randomUUID()}:{}),...body})}:{})});const v=await r.json();if(!r.ok)throw new Error(route+': '+r.status+' '+v.error);return v;};
 return {url,agent};
}
// The page's own requests: same origin, so a write is Adrian's from the app (Origin sent, as a browser does).
const pageFetch=url=>async(u,o={})=>{const r=await fetch(new URL(String(u),url),{...o,signal:undefined,headers:{...o.headers,...(o.method&&o.method!=='GET'?{Origin:url}:{})}});return {ok:r.ok,status:r.status,text:()=>r.text()};};

async function world(f){
 const make=async(id,title)=>f.agent('/api/study-draft/create-collection',{parentStudyId:id,title});
 await make('inv-garden','Invented garden of long patience, written up slowly over three seasons with every false start left in');
 await make('inv-cups','Invented cups');
 await make('inv-river','Invented river');
 await make('inv-old','Invented old plan');
 let folders=await f.agent('/api/subject-places/folders');
 for(const p of [['Tea'],['Tea','Gardens'],['Art']]){folders=await f.agent('/api/subject-places/folders',{action:'create',path:p,expectedRevision:folders.revision,expectedHash:folders.hash});}
 const place=async(id,change)=>{const p=(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];return f.agent('/api/subject-places/save',{parentStudyId:id,expectedRevision:p.revision,...(p.saved?{expectedHash:p.hash}:{}),...change});};
 await place('inv-garden',{folder:['Tea','Gardens'],tags:['shade','visit'],pinned:true});
 await place('inv-cups',{folder:['Tea'],tags:['craft']});
 await place('inv-river',{folder:['Tea'],tags:['visit'],pinned:true});
 await place('inv-old',{folder:['Art'],archived:true});
 await f.agent('/api/needs-you/raise',{band:'only-adrian',question:'Is the invented garden named in the piece?',choices:['Name it','Leave it out'],about:'Invented garden',scope:{kind:'project',id:'inv-garden'}});
}
const rowsOf=(doc,key)=>[...doc.querySelectorAll(`.h3-group[data-key="${key}"] .h3-row b`)].map(b=>b.textContent);
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));

const logged=(url,log)=>{const inner=pageFetch(url);return async(u,o)=>{log.push(new URL(String(u),url).pathname);return inner(u,o);};};
const nextText=s=>!s.known||!s.next||['published','resting'].includes(s.station)?'':s.next.formName&&s.forms.length>1?s.next.name+' · '+s.next.formName:s.next.name;


test('Home on real records: every row is true against subjects.standing, in a handful of calls',async t=>{
 const f=await server(t);await world(f);
 const calls=[];
 const {w,doc}=await page({base:f.url,fetchImpl:logged(f.url,calls)});
 await until(()=>doc.querySelector('.h3-groups .h3-row'),'the list');
 const standing=(await f.agent('/api/subjects/standing')).subjects,by=new Map(standing.map(s=>[s.id,s]));
 // The rule's own words, row by row: station, and a next step only when it is known.
 for(const r of doc.querySelectorAll('.h3-groups .h3-row')){
  const s=by.get(r.dataset.id);assert.ok(s,'a row for a subject the read knows: '+r.dataset.id);
  assert.equal(r.querySelector('.h3-st').textContent.trim(),s.stationName,'its station');
  assert.equal(r.querySelector('.h3-next').textContent.trim(),nextText(s),'its next step, or nothing: '+s.title);
 }
 for(const c of doc.querySelectorAll('.h3-card')){const s=by.get(c.dataset.id);assert.equal(c.querySelector('.h3-card-next span').textContent,nextText(s)||'Open');}
 // Station counts are the read's counts for subjects not archived, and do not change after first paint.
 const live=standing.filter(s=>!s.archived),count=id=>String(live.filter(s=>s.station===id).length);
 const chip=id=>doc.querySelector(`[data-station="${id}"] small`).textContent;
 const before=['gather','research','create','share','published','resting'].map(chip);
 assert.deepEqual(before,['gather','research','create','share','published','resting'].map(count));
 await new Promise(r=>setTimeout(r,1200));
 assert.deepEqual(['gather','research','create','share','published','resting'].map(chip),before,'no count moves by itself');
 // A handful of calls: one standing read, no per-subject reads, no list of projects.
 const mine=calls.filter(p=>!/capabilities|events/.test(p));
 assert.equal(mine.filter(p=>p==='/api/subjects/standing').length,1);
 assert.equal(mine.filter(p=>/human-direction|inquiries|first-flow|study-ai/.test(p)).length,0,'nothing is read subject by subject: '+mine.join(' '));
 assert.ok(mine.length<=24,'a handful of calls, not hundreds: '+mine.length);
 // Needs you: the question, where it is from, its choices in place.
 const ask=doc.querySelector('.h3-needs li');
 assert.match(ask.textContent,/Is the invented garden named in the piece\?/);assert.match(ask.textContent,/Invented garden/);
 assert.deepEqual([...ask.querySelectorAll('[data-ask-choice]')].map(b=>b.dataset.askChoice),['Name it','Leave it out']);
 // On your desk: the two pinned subjects, opening the subject.
 const cards=[...doc.querySelectorAll('.h3-card')];
 assert.deepEqual(cards.map(c=>c.querySelector('b').textContent.slice(0,15)),['Invented garden','Invented river']);
 assert.equal(cards[0].querySelector('.h3-card-next').getAttribute('href'),'#/subject/inv-garden');
 // Everything, by folder: real folders in their saved order, with their path; an empty folder still shows.
 assert.deepEqual([...doc.querySelectorAll('.h3-group h3')].map(h=>h.textContent),['Tea','Gardens','Art','Not in a folder']);
 assert.equal(doc.querySelector('.h3-group[data-key="f:Tea\u0001Gardens"] .h3-path').textContent,'Subjects / Tea / Gardens');
 assert.deepEqual(rowsOf(doc,'f:Tea'),['Invented cups','Invented river']);
 assert.match(doc.querySelector('.h3-group[data-key="f:Art"]').textContent,/Empty/,'Art holds only an archived subject');
 const total=live.length;
 assert.match(doc.querySelector('.h3-all .h3-sec-h').textContent,new RegExp(total+' subjects'));
 // One station filters; pressed again, all again.
 const some=standing.find(s=>!s.archived).station,others=live.filter(s=>s.station===some).length;
 click(w,doc.querySelector(`[data-station="${some}"]`));assert.equal(doc.querySelectorAll('.h3-row').length,others);
 click(w,doc.querySelector(`[data-station="${some}"]`));assert.equal(doc.querySelectorAll('.h3-row').length,total);
 // Find filters by name as he types.
 const find=doc.querySelector('[data-home-find]');find.focus();find.value='cups';find.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.deepEqual([...doc.querySelectorAll('.h3-row b')].map(b=>b.textContent),['Invented cups']);
 assert.equal(doc.activeElement,doc.querySelector('[data-home-find]'),'the find field keeps its place while he types');
 doc.querySelector('[data-home-find]').value='';doc.querySelector('[data-home-find]').dispatchEvent(new w.Event('input',{bubbles:true}));
 // By tag: a subject with two tags is under both.
 click(w,doc.querySelector('[data-group-by="tag"]'));
 assert.deepEqual([...doc.querySelectorAll('.h3-group h3')].map(h=>h.textContent),['visit','craft','shade','No tag']);
 assert.equal(rowsOf(doc,'t:visit').length,2);
 click(w,doc.querySelector('[data-group-by="station"]'));
 assert.deepEqual([...doc.querySelectorAll('.h3-group h3')].map(h=>h.textContent),[...new Set(live.map(s=>s.stationName))].sort((a,b)=>['Gather','Research','Create','Share','Published','Resting'].indexOf(a)-['Gather','Research','Create','Share','Published','Resting'].indexOf(b)));
 click(w,doc.querySelector('[data-group-by="recent"]'));
 assert.equal(doc.querySelectorAll('.h3-row').length,total);
 click(w,doc.querySelector('[data-view="covers"]'));
 assert.equal(doc.querySelectorAll('.h3-cover').length,total);
 click(w,doc.querySelector('[data-view="rows"]'));click(w,doc.querySelector('[data-group-by="folder"]'));
 // Archived subjects are out of the way behind one control.
 const archived=doc.querySelector('[data-archived]');assert.match(archived.textContent,/Archived · 1/);
 assert.equal(doc.body.textContent.includes('Invented old plan'),false);
 click(w,archived);assert.match(doc.querySelector('.h3-archived').textContent,/Invented old plan/);
});

test('Home reads covers for the desk only, after first paint, from the first chosen photograph',async t=>{
 const f=await server(t);await world(f);
 const calls=[],inner=logged(f.url,calls);
 const photo='/api/study/photos/preview?projectId=p&documentId=d&sourceId=s&expectedHash='+'a'.repeat(64);
 const fetchImpl=async(u,o)=>{const path=new URL(String(u),f.url).pathname;
  if(path==='/api/study/photos/inspect'){calls.push(path);return {ok:true,status:200,text:async()=>JSON.stringify({photos:[{sourceId:'s',selected:false,url:photo+'x'},{sourceId:'t',selected:true,url:photo,previewUnavailable:false}]})};}
  return inner(u,o);};
 const {doc}=await page({base:f.url,fetchImpl});
 await until(()=>doc.querySelector('.h3-groups .h3-row'),'the list');
 const garden=await until(()=>doc.querySelector('.h3-card[data-id="inv-garden"] img'),'the cover');
 const src=garden.getAttribute('src');assert.ok(src.startsWith(photo)&&/parentStudyId=inv-garden/.test(src)&&/bindingId=/.test(src),'the chosen photograph, not the unchosen one: '+src);
 assert.equal(calls.filter(p=>p==='/api/study/photos/inspect').length,2,'one for each card on the desk, and none for the rows');
});

test('Home writes through the commands: pin, answer, move to a folder with Undo, reorder the desk, New subject',async t=>{
 const f=await server(t);await world(f);
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelector('.h3-groups .h3-row'),'the list');
 const placeOf=async id=>(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];
 // Pin puts a subject on the desk, stamped as Adrian's from the app.
 click(w,doc.querySelector('[data-pin="inv-cups"]'));
 await until(async()=>(await placeOf('inv-cups')).pinnedAt,'the pin to be saved');
 assert.equal((await placeOf('inv-cups')).updatedBy,'human:adrian');
 await until(()=>doc.querySelectorAll('.h3-card').length===3,'three cards');
 // His answer, from the app's own page.
 click(w,doc.querySelector('[data-ask-choice="Leave it out"]'));
 await until(()=>doc.querySelector('.h3-needs li.ok'),'the answer');
 assert.equal(doc.querySelector('.h3-needs li.ok .h3-said').textContent,'Leave it out');assert.match(doc.querySelector('.h3-needs li.ok').textContent,/Answered/);
 const answered=(await f.agent('/api/needs-you?status=answered')).asks[0];
 assert.equal(answered.resolution.choice,'Leave it out');assert.equal(answered.resolution.by,'human:adrian');assert.equal(answered.resolution.client,'ui');
 // A subject dropped onto a folder moves there; Undo moves it back.
 const row=doc.querySelector('.h3-row[data-id="inv-cups"]'),head=doc.querySelector('.h3-group[data-key="f:Art"]>header');
 row.dispatchEvent(new w.Event('dragstart',{bubbles:true}));head.dispatchEvent(new w.Event('dragover',{bubbles:true,cancelable:true}));head.dispatchEvent(new w.Event('drop',{bubbles:true,cancelable:true}));
 await until(async()=>(await placeOf('inv-cups')).folder.join('/')==='Art','the move');
 const note=await until(()=>doc.querySelector('#v2-messages .v2-msg'),'the Undo note');
 assert.match(note.textContent,/"Invented cups" moved to Art\./);
 click(w,[...note.querySelectorAll('button')].find(b=>/Undo/.test(b.textContent)));
 await until(async()=>(await placeOf('inv-cups')).folder.join('/')==='Tea','Undo');
 // Move down on the first desk card: the new order is saved through subject-places.reorder.
 await until(()=>doc.querySelectorAll('.h3-card').length===3&&!doc.querySelector('.h3-card [data-v2-down]')?.disabled,'the desk');
 const first=doc.querySelector('.h3-card').dataset.id;
 click(w,doc.querySelector('.h3-card [data-v2-down]'));
 await until(async()=>(await placeOf(first)).deskOrder===1,'the desk order');
 assert.equal((await placeOf(first)).order,null,'the desk order leaves the folder order alone');
 // New subject: the name, then it opens as itself.
 click(w,doc.querySelector('[data-home-new]'));
 const form=doc.querySelector('dialog.v2-sheet form');form.elements.name.value='Invented new subject';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>/^#\/subject\//.test(w.location.hash),'the subject to open');
 const id=decodeURIComponent(w.location.hash.slice('#/subject/'.length));
 const catalog=await f.agent('/api/study-draft/catalog');
 assert.equal(catalog.collections.find(c=>c.parentStudyId===id)?.title,'Invented new subject');
});

test('Home as an assistant says why the answers are greyed, in a visible line; covers view with no photograph is a plain card; the look dot names its look',async t=>{
 const f=await server(t);await world(f);
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url),hash:'?reviewActor=agent:codex#/'});
 await until(()=>doc.querySelector('.h3-groups .h3-row'),'the list');
 const buttons=[...doc.querySelectorAll('.h3-needs [data-ask-choice]')];
 assert.ok(buttons.length&&buttons.every(b=>b.disabled),'the choices are greyed for an assistant');
 const reason=doc.querySelector('.h3-needs .h3-reason');
 assert.ok(reason&&/Only Adrian answers these/.test(reason.textContent),'the reason is a line on the page, not only a tooltip');
 click(w,doc.querySelector('[data-view="covers"]'));
 const covers=[...doc.querySelectorAll('.h3-cover')];assert.ok(covers.length);
 for(const c of covers){
  const pic=c.querySelector('.h3-cover-pic');assert.ok(!pic||pic.hidden,'no empty picture box when there is no photograph');
  assert.equal(c.querySelector('.h3-cover-pic .v2-ring'),null,'no ring in a picture box');
  assert.ok(c.querySelector('[data-row-menu]')&&c.querySelector('[data-pin]'),'the menu sits beside the pin, as in rows');
 }
 assert.doesNotMatch(read('public/v3/screens/home.js'),/Drawn in the \$\{esc\(id\)\}/,'the dot says the look\'s name, not its id');
});

/* ---------------- what is waiting to be filed ---------------- */

/* ---------------- what is new in version three's Home ---------------- */
const photoOf='/api/study/photos/preview?projectId=p&documentId=d&sourceId=s&expectedHash='+'a'.repeat(64);
/** The page's requests, with the photograph read held until released, and only the garden having one. */
function lateCovers(f,calls){
 const inner=pageFetch(f.url);let release;const gate=new Promise(r=>{release=r;});
 const fetchImpl=async(u,o)=>{const url=new URL(String(u),f.url);
  if(url.pathname==='/api/study/photos/inspect'){calls.push(url.search);await gate;
   const own=/parentStudyId=([^&]+)/.exec(url.search)?.[1];
   return {ok:true,status:200,text:async()=>JSON.stringify({photos:own==='inv-garden'?[{sourceId:'t',selected:true,url:photoOf}]:[]})};}
  return inner(u,o);};
 return {fetchImpl,release};
}
const KEY='ar-v3-home-covers';

test('a desk subject that had a cover last time keeps its cover block from first paint, and the covers then make it true; a subject not remembered gets its block when the cover arrives; the list is ids only under its own key',async t=>{
 const f=await server(t);await world(f);
 // Last time the garden and the river both had a cover; now only the garden does.
 {const calls=[],late=lateCovers(f,calls);
  const {w,doc}=await page({base:f.url,fetchImpl:late.fetchImpl,storage:{[KEY]:JSON.stringify(['inv-garden','inv-river'])}});
  await until(()=>doc.querySelectorAll('.h3-card').length===2,'the desk');
  const pic=id=>doc.querySelector(`.h3-card[data-id="${id}"] .h3-card-pic`);
  assert.ok(pic('inv-garden')&&!pic('inv-garden').querySelector('img'),'the block is there at first paint, empty, before any cover is read');
  assert.ok(pic('inv-river'),'and for the river too');
  late.release();
  await until(()=>doc.querySelector('.h3-card[data-id="inv-garden"] .h3-card-pic img'),'the garden cover');
  await until(()=>!pic('inv-river'),'the river block to go, since it has no cover now');
  assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY)),['inv-garden'],'the list is now the truth');
  assert.equal(w.localStorage.getItem('ar-create-v2-home'),null,'version two\'s key is not touched');
  assert.ok([...Array(w.localStorage.length).keys()].map(i=>w.localStorage.key(i)).every(k=>k===KEY||!/home/.test(k)),'no other Home key written');
 }
 // Nothing remembered (or something unreadable): no block until a cover arrives, then the block is added once, and remembered.
 for(const stored of [undefined,'not json','{"a":1}','[1,{"x":2}]']){
  const calls=[],late=lateCovers(f,calls);
  const {w,doc}=await page({base:f.url,fetchImpl:late.fetchImpl,storage:stored===undefined?{}:{[KEY]:stored}});
  await until(()=>doc.querySelectorAll('.h3-card').length===2,'the desk');
  assert.equal(doc.querySelectorAll('.h3-card-pic').length,0,'no blank block when nothing is remembered: '+stored);
  late.release();
  await until(()=>doc.querySelector('.h3-card[data-id="inv-garden"] .h3-card-pic img'),'the cover to arrive');
  assert.equal(doc.querySelectorAll('.h3-card-pic').length,1,'only the card with a cover has a block');
  assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY)),['inv-garden']);
 }
});

test('a cover read that is not answered changes nothing on the device: what was remembered stays',async t=>{
 const f=await server(t);await world(f);
 const inner=pageFetch(f.url);
 const fetchImpl=async(u,o)=>{const p=new URL(String(u),f.url).pathname;if(p==='/api/study-draft/catalog')throw new TypeError('Failed to fetch');return inner(u,o);};
 const {w,doc}=await page({base:f.url,fetchImpl,storage:{[KEY]:JSON.stringify(['inv-garden'])}});
 await until(()=>doc.querySelectorAll('.h3-card').length===2,'the desk');await settle(600);
 assert.equal(doc.querySelector('.h3-card-pic'),null,'the held block does not stay for ever when the read failed');
 assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY)),['inv-garden'],'but the list stays, for the next visit');
});

test('a desk card\'s footer is one bar: the next step, then Move up and Move down; and a cut tag list carries its full text',async t=>{
 const f=await server(t);await world(f);
 const p=(await f.agent('/api/subject-places?parentStudyId=inv-cups')).places[0];
 await f.agent('/api/subject-places/save',{parentStudyId:'inv-cups',expectedRevision:p.revision,expectedHash:p.hash,tags:['an-invented-tag-rather-long','b','c','d','e','f']});
 const {doc}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelector('.h3-groups .h3-row'),'the list');
 for(const card of doc.querySelectorAll('.h3-card')){
  const bar=card.querySelector(':scope>.v2-move');assert.ok(bar,'one bar');
  assert.deepEqual([...bar.children].map(c=>c.className.split(' ')[0]),['h3-card-next','h3-move-btns']);
  assert.ok(bar.querySelector('[data-v2-up]')&&bar.querySelector('[data-v2-down]'));
  assert.equal(card.querySelectorAll('.v2-move').length,1);
 }
 const tags=[...doc.querySelectorAll('.h3-row[data-id="inv-cups"] .h3-tags i')];
 assert.equal(tags.length,5);
 for(const i of tags)assert.ok(i.title,'every tag, and the +N, has its full text in title: '+i.textContent);
 assert.equal(tags[0].title,'an-invented-tag-rather-long');
 assert.equal(tags.at(-1).title,'e, f');
});

test('Needs you guard: as the human the choices are enabled and there is no reason line; as an agent every choice and "Change it" is disabled, with the reason as a line',async t=>{
 const f=await server(t);await world(f);
 const human=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>human.doc.querySelector('.h3-needs [data-ask-choice]'),'the question');
 assert.ok([...human.doc.querySelectorAll('.h3-needs [data-ask-choice]')].every(b=>!b.disabled),'enabled for him');
 assert.equal(human.doc.querySelector('.h3-needs .h3-reason'),null);
 click(human.w,human.doc.querySelector('[data-ask-choice="Name it"]'));
 await until(()=>human.doc.querySelector('.h3-needs li.ok [data-ask-change]'),'the answer');
 assert.equal(human.doc.querySelector('.h3-needs li.ok [data-ask-change]').disabled,false,'Change it is his');
 await f.agent('/api/needs-you/raise',{band:'only-adrian',question:'A later invented question?',choices:['One','Two'],about:'Invented cups'});
 const agent=await page({base:f.url,fetchImpl:pageFetch(f.url),hash:'?reviewActor=agent:codex#/'});
 await until(()=>agent.doc.querySelector('.h3-needs'),'the panel');
 const open=[...agent.doc.querySelectorAll('.h3-needs [data-ask-choice]')];
 assert.ok(open.length&&open.every(b=>b.disabled&&/Only Adrian answers these/.test(b.title)),'every choice disabled, with the reason');
 assert.match(agent.doc.querySelector('.h3-needs .h3-reason').textContent,/Only Adrian answers these/);
 assert.ok(agent.doc.querySelector('.h3-needs.h3-asking'),'the accent border is for a question still asking');
 // "Change it" is drawn with the same guard: its markup is built from the same flag.
 assert.match(read('public/v3/screens/home.js'),/data-ask-change="\$\{esc\(a\.id\)\}"\$\{off\}>Change it/);
});

test('a cover read that failed is not asked again in this visit, its held block goes, and the list on the device is left as it was',async t=>{
 const f=await server(t);await world(f);
 for(const failing of ['the catalog','the photographs']){
  const calls=[],inner=pageFetch(f.url);let release;const gate=new Promise(r=>{release=r;});
  const fetchImpl=async(u,o)=>{const p=new URL(String(u),f.url).pathname;
   if(p==='/api/study-draft/catalog'||p==='/api/study/photos/inspect')calls.push(p);
   if(failing==='the catalog'&&p==='/api/study-draft/catalog'){await gate;throw new TypeError('Failed to fetch');}
   if(failing==='the photographs'&&p==='/api/study/photos/inspect'){await gate;return {ok:false,status:500,text:async()=>JSON.stringify({error:'down'})};}
   return inner(u,o);};
  const {w,doc,sources}=await page({base:f.url,fetchImpl,storage:{[KEY]:JSON.stringify(['inv-garden'])}});
  await until(()=>doc.querySelectorAll('.h3-card').length===2,'the desk');
  assert.ok(doc.querySelector('.h3-card[data-id="inv-garden"] .h3-card-pic'),'held at first paint ('+failing+')');
  release();
  await until(()=>!doc.querySelector('.h3-card-pic'),'the held block to go once the read failed ('+failing+')');
  assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY)),['inv-garden'],'the list is left for the next visit ('+failing+')');
  const asked=calls.length;assert.ok(asked>0);
  // A change arrives and Home reads and paints again: the failed subject is not asked again, and no block comes back.
  const es=sources.at(-1);es.emit('hello',{bootId:'b1',cursor:1});es.emit('change',{cursor:2,bootId:'b1',kind:'subject-places.save',scope:{kind:'subjects',id:'inv-cups'}});
  await settle(1200);
  assert.equal(calls.length,asked,'no second request in this visit ('+failing+')');
  assert.equal(doc.querySelectorAll('.h3-card-pic').length,0,'and no block comes back ('+failing+')');
  assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY)),['inv-garden']);
 }
});

test('a run that stops early still draws the covers already held, even when the run that read them was superseded',async t=>{
 const f=await server(t);await world(f);
 const inner=pageFetch(f.url);let release;const gate=new Promise(r=>{release=r;});
 let waiting=false,failNow=false,failed=0;
 const fetchImpl=async(u,o)=>{const url=new URL(String(u),f.url);
  if(url.pathname==='/api/study-draft/catalog'){
   if(failNow){failed++;throw new TypeError('Failed to fetch');}// the newer run stops early here
   return inner(u,o);}
  if(url.pathname==='/api/study/photos/inspect'){waiting=true;await gate;return {ok:true,status:200,text:async()=>JSON.stringify({photos:[{sourceId:'t',selected:true,url:photoOf}]})};}
  return inner(u,o);};
 const {w,doc,sources}=await page({base:f.url,fetchImpl});
 await until(()=>doc.querySelectorAll('.h3-card').length===2,'the desk');
 await until(()=>waiting,'the first run to wait for its photograph');
 // While it waits, a change starts a newer run, which stops at the failed catalog.
 failNow=true;
 const es=sources.at(-1);es.emit('hello',{bootId:'b1',cursor:1});es.emit('change',{cursor:2,bootId:'b1',kind:'study.photos.choose',scope:{kind:'subjects',id:'inv-garden'}});// a photograph changed: the covers are read again
 await until(()=>failed>=1,'the newer run to ask and fail');
 release();
 await until(()=>doc.querySelector('.h3-card[data-id="inv-garden"] .h3-card-pic img'),'the cover the older run read to be drawn');
});
