import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

// Version two's Home: where a subject stands (the one pure function the Subject screen reuses), and the page itself
// against the real in-process server: Needs you, On your desk, Everything by folder, tag, station and recent, find,
// pin, move to a folder with Undo, reorder, New subject, changes from an assistant, and the server out of reach.
// Invented subjects, folders and words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const windows=[];after(()=>{for(const w of windows)w.close();});
const DAY=864e5,NOW=Date.parse('2026-11-11T12:00:00Z');

/** The page in a DOM. fetchImpl answers its requests; EventSource is a stand-in the test can speak through. */
async function page({base,fetchImpl,hash='#/'}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:base+'/v2/index.html'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,sources=[];windows.push(w);
 w.scrollTo=()=>{};
 w.EventSource=class{constructor(u){this.url=u;this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){this.closed=true;}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 w.fetch=fetchImpl;
 const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
 for(const src of scripts)w.eval(fs.readFileSync(src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,doc:w.document,sources};
}
async function until(check,what,ms=8000){const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('Timed out waiting for '+what);await new Promise(r=>setTimeout(r,25));}}

/* ---------------- the next step shown for a subject ---------------- */
function unit(){
 const html=read('public/v2/index.html'),dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html',runScripts:'outside-only'});
 const w=dom.window;windows.push(w);w.fetch=async()=>({ok:true,status:200,text:async()=>'{}'});w.EventSource=class{addEventListener(){}close(){}};
 for(const f of ['shell/client.js','shell/parts.js','shell/shell.js','screens/home.js'])w.eval(fs.readFileSync(path.join(v2dir,f),'utf8'));
 return w;
}
test('nextOf: only a known next step is ever shown',()=>{
 const {nextOf,STATIONS}=unit().v2.shared.home;
 const step=(name,formName=null)=>({name,formName,step:'x',state:'next'});
 assert.deepEqual(JSON.parse(JSON.stringify(STATIONS.map(s=>s.name))),['Gather','Research','Create','Share','Published','Resting']);
 assert.equal(nextOf({known:true,station:'create',forms:[{}],next:step('Check','Article')}),'Check','one form: its name is left out');
 assert.equal(nextOf({known:true,station:'create',forms:[{},{}],next:step('Check','Article')}),'Check · Article','two forms: the form is named');
 assert.equal(nextOf({known:false,station:'create',forms:[],next:step('Check')}),'','not known: nothing');
 assert.equal(nextOf({known:true,station:'create',forms:[],next:null}),'','no next step');
 assert.equal(nextOf({known:true,station:'published',forms:[],next:step('Check')}),'','published has none');
 assert.equal(nextOf({known:true,station:'resting',forms:[],next:step('Check')}),'','resting has none');
 assert.equal(nextOf(undefined),'');
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
const rowsOf=(doc,key)=>[...doc.querySelectorAll(`.home-group[data-key="${key}"] .home-row b`)].map(b=>b.textContent);
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));

const logged=(url,log)=>{const inner=pageFetch(url);return async(u,o)=>{log.push(new URL(String(u),url).pathname);return inner(u,o);};};
const nextText=s=>!s.known||!s.next||['published','resting'].includes(s.station)?'':s.next.formName&&s.forms.length>1?s.next.name+' · '+s.next.formName:s.next.name;

test('Home on real records: every row is true against subjects.standing, in a handful of calls',async t=>{
 const f=await server(t);await world(f);
 const calls=[];
 const {w,doc}=await page({base:f.url,fetchImpl:logged(f.url,calls)});
 await until(()=>doc.querySelector('.home-groups .home-row'),'the list');
 const standing=(await f.agent('/api/subjects/standing')).subjects,by=new Map(standing.map(s=>[s.id,s]));
 // The rule's own words, row by row: station, and a next step only when it is known.
 for(const r of doc.querySelectorAll('.home-groups .home-row')){
  const s=by.get(r.dataset.id);assert.ok(s,'a row for a subject the read knows: '+r.dataset.id);
  assert.equal(r.querySelector('.home-st').textContent.trim(),s.stationName,'its station');
  assert.equal(r.querySelector('.home-next').textContent.trim(),nextText(s),'its next step, or nothing: '+s.title);
 }
 for(const c of doc.querySelectorAll('.home-card')){const s=by.get(c.dataset.id);assert.equal(c.querySelector('.home-card-next span').textContent,nextText(s)||'Open');}
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
 const ask=doc.querySelector('.home-needs li');
 assert.match(ask.textContent,/Is the invented garden named in the piece\?/);assert.match(ask.textContent,/Invented garden/);
 assert.deepEqual([...ask.querySelectorAll('[data-ask-choice]')].map(b=>b.dataset.askChoice),['Name it','Leave it out']);
 // On your desk: the two pinned subjects, opening the subject.
 const cards=[...doc.querySelectorAll('.home-card')];
 assert.deepEqual(cards.map(c=>c.querySelector('b').textContent.slice(0,15)),['Invented garden','Invented river']);
 assert.equal(cards[0].querySelector('.home-card-next').getAttribute('href'),'#/subject/inv-garden');
 // Everything, by folder: real folders in their saved order, with their path; an empty folder still shows.
 assert.deepEqual([...doc.querySelectorAll('.home-group h3')].map(h=>h.textContent),['Tea','Gardens','Art','Not in a folder']);
 assert.equal(doc.querySelector('.home-group[data-key="f:Tea\u0001Gardens"] .home-path').textContent,'Subjects / Tea / Gardens');
 assert.deepEqual(rowsOf(doc,'f:Tea'),['Invented cups','Invented river']);
 assert.match(doc.querySelector('.home-group[data-key="f:Art"]').textContent,/Empty/,'Art holds only an archived subject');
 const total=live.length;
 assert.match(doc.querySelector('.home-all .home-sec-h').textContent,new RegExp(total+' subjects'));
 // One station filters; pressed again, all again.
 const some=standing.find(s=>!s.archived).station,others=live.filter(s=>s.station===some).length;
 click(w,doc.querySelector(`[data-station="${some}"]`));assert.equal(doc.querySelectorAll('.home-row').length,others);
 click(w,doc.querySelector(`[data-station="${some}"]`));assert.equal(doc.querySelectorAll('.home-row').length,total);
 // Find filters by name as he types.
 const find=doc.querySelector('[data-home-find]');find.focus();find.value='cups';find.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.deepEqual([...doc.querySelectorAll('.home-row b')].map(b=>b.textContent),['Invented cups']);
 assert.equal(doc.activeElement,doc.querySelector('[data-home-find]'),'the find field keeps its place while he types');
 doc.querySelector('[data-home-find]').value='';doc.querySelector('[data-home-find]').dispatchEvent(new w.Event('input',{bubbles:true}));
 // By tag: a subject with two tags is under both.
 click(w,doc.querySelector('[data-group-by="tag"]'));
 assert.deepEqual([...doc.querySelectorAll('.home-group h3')].map(h=>h.textContent),['visit','craft','shade','No tag']);
 assert.equal(rowsOf(doc,'t:visit').length,2);
 click(w,doc.querySelector('[data-group-by="station"]'));
 assert.deepEqual([...doc.querySelectorAll('.home-group h3')].map(h=>h.textContent),[...new Set(live.map(s=>s.stationName))].sort((a,b)=>['Gather','Research','Create','Share','Published','Resting'].indexOf(a)-['Gather','Research','Create','Share','Published','Resting'].indexOf(b)));
 click(w,doc.querySelector('[data-group-by="recent"]'));
 assert.equal(doc.querySelectorAll('.home-row').length,total);
 click(w,doc.querySelector('[data-view="covers"]'));
 assert.equal(doc.querySelectorAll('.home-cover').length,total);
 click(w,doc.querySelector('[data-view="rows"]'));click(w,doc.querySelector('[data-group-by="folder"]'));
 // Archived subjects are out of the way behind one control.
 const archived=doc.querySelector('[data-archived]');assert.match(archived.textContent,/Archived · 1/);
 assert.equal(doc.body.textContent.includes('Invented old plan'),false);
 click(w,archived);assert.match(doc.querySelector('.home-archived').textContent,/Invented old plan/);
});

test('Home reads covers for the desk only, after first paint, from the first chosen photograph',async t=>{
 const f=await server(t);await world(f);
 const calls=[],inner=logged(f.url,calls);
 const photo='/api/study/photos/preview?projectId=p&documentId=d&sourceId=s&expectedHash='+'a'.repeat(64);
 const fetchImpl=async(u,o)=>{const path=new URL(String(u),f.url).pathname;
  if(path==='/api/study/photos/inspect'){calls.push(path);return {ok:true,status:200,text:async()=>JSON.stringify({photos:[{sourceId:'s',selected:false,url:photo+'x'},{sourceId:'t',selected:true,url:photo,previewUnavailable:false}]})};}
  return inner(u,o);};
 const {doc}=await page({base:f.url,fetchImpl});
 await until(()=>doc.querySelector('.home-groups .home-row'),'the list');
 const garden=await until(()=>doc.querySelector('.home-card[data-id="inv-garden"] img'),'the cover');
 const src=garden.getAttribute('src');assert.ok(src.startsWith(photo)&&/parentStudyId=inv-garden/.test(src)&&/bindingId=/.test(src),'the chosen photograph, not the unchosen one: '+src);
 assert.equal(calls.filter(p=>p==='/api/study/photos/inspect').length,2,'one for each card on the desk, and none for the rows');
});

test('Home writes through the commands: pin, answer, move to a folder with Undo, reorder the desk, New subject',async t=>{
 const f=await server(t);await world(f);
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelector('.home-groups .home-row'),'the list');
 const placeOf=async id=>(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];
 // Pin puts a subject on the desk, stamped as Adrian's from the app.
 click(w,doc.querySelector('[data-pin="inv-cups"]'));
 await until(async()=>(await placeOf('inv-cups')).pinnedAt,'the pin to be saved');
 assert.equal((await placeOf('inv-cups')).updatedBy,'human:adrian');
 await until(()=>doc.querySelectorAll('.home-card').length===3,'three cards');
 // His answer, from the app's own page.
 click(w,doc.querySelector('[data-ask-choice="Leave it out"]'));
 await until(()=>doc.querySelector('.home-needs li.ok'),'the answer');
 assert.equal(doc.querySelector('.home-needs li.ok .home-said').textContent,'Leave it out');assert.match(doc.querySelector('.home-needs li.ok').textContent,/Answered/);
 const answered=(await f.agent('/api/needs-you?status=answered')).asks[0];
 assert.equal(answered.resolution.choice,'Leave it out');assert.equal(answered.resolution.by,'human:adrian');assert.equal(answered.resolution.client,'ui');
 // A subject dropped onto a folder moves there; Undo moves it back.
 const row=doc.querySelector('.home-row[data-id="inv-cups"]'),head=doc.querySelector('.home-group[data-key="f:Art"]>header');
 row.dispatchEvent(new w.Event('dragstart',{bubbles:true}));head.dispatchEvent(new w.Event('dragover',{bubbles:true,cancelable:true}));head.dispatchEvent(new w.Event('drop',{bubbles:true,cancelable:true}));
 await until(async()=>(await placeOf('inv-cups')).folder.join('/')==='Art','the move');
 const note=await until(()=>doc.querySelector('#v2-messages .v2-msg'),'the Undo note');
 assert.match(note.textContent,/"Invented cups" moved to Art\./);
 click(w,[...note.querySelectorAll('button')].find(b=>/Undo/.test(b.textContent)));
 await until(async()=>(await placeOf('inv-cups')).folder.join('/')==='Tea','Undo');
 // Move down on the first desk card: the new order is saved through subject-places.reorder.
 await until(()=>doc.querySelectorAll('.home-card').length===3&&!doc.querySelector('.home-card [data-v2-down]')?.disabled,'the desk');
 const first=doc.querySelector('.home-card').dataset.id;
 click(w,doc.querySelector('.home-card [data-v2-down]'));
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

test('Home hears an assistant: a subject filed elsewhere moves on screen without a reload, and a held subject says who has it',async t=>{
 const f=await server(t);await world(f);
 const {w,doc,sources}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelector('.home-groups .home-row'),'the list');
 const p=(await f.agent('/api/subject-places?parentStudyId=inv-cups')).places[0];
 await f.agent('/api/subject-places/save',{parentStudyId:'inv-cups',expectedRevision:p.revision,expectedHash:p.hash,folder:['Art']});
 await f.agent('/api/leases/acquire',{scope:{kind:'project',id:'inv-river'},reason:'Invented work'},{op:false});
 const es=sources.at(-1);es.emit('hello',{bootId:'b1',cursor:1});
 es.emit('change',{cursor:2,bootId:'b1',kind:'subject-places.save',scope:{kind:'subjects',id:'inv-cups'}});
 await until(()=>rowsOf(doc,'f:Art').includes('Invented cups'),'the row to move');
 assert.deepEqual(rowsOf(doc,'f:Tea'),['Invented river']);
 assert.match(doc.querySelector('.home-row[data-id="inv-river"]').textContent,/Codex is working on it/);
 assert.match(doc.querySelector('.home-carry, .home-needs .home-quiet').textContent,/Codex is carrying on with 1 thing by itself\./);
});

test('Home with no subjects, and with the app out of reach',async()=>{
 // With no subject at all the page says how to start, and shows no desk and no Needs you.
 const {doc}=await page({base:'http://local.test',fetchImpl:async u=>{const p=new URL(String(u),'http://local.test').pathname;if(p==='/api/capabilities')return {ok:true,status:200,text:async()=>JSON.stringify({commands:[['study-draft.catalog','/api/study-draft/catalog'],['subject-places','/api/subject-places'],['subject-places.folders.get','/api/subject-places/folders'],['subjects.standing','/api/subjects/standing']].map(([name,route])=>({name,route,method:'GET',readOnly:true,schema:{}}))})};
  if(p==='/api/subjects/standing')return {ok:true,status:200,text:async()=>JSON.stringify({subjects:[],count:0})};return {ok:true,status:200,text:async()=>JSON.stringify({places:[],folders:[]})};}});
 await until(()=>doc.querySelector('.home-empty'),'no subjects');
 assert.match(doc.querySelector('.home-empty').textContent,/No subjects yet/);assert.ok(doc.querySelector('.home-empty [data-home-new]'));
 assert.equal(doc.querySelector('[data-home-desk]').hidden,true);assert.equal(doc.querySelector('.home-needs'),null,'nothing waiting: no Needs you');
 const down=await page({base:'http://local.test',fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
 await until(()=>down.doc.querySelector('[data-home-error]'),'the error');
 assert.match(down.doc.querySelector('[data-home-error]').textContent,/could not/);assert.ok(down.doc.querySelector('[data-home-retry]'));
});

test('Home keeps to the look: its own class on every rule, the six sizes, tokens only, no em dash',()=>{
 const css=read('public/v2/screens/home.css'),js=read('public/v2/screens/home.js');
 const body=css.replace(/\/\*[\s\S]*?\*\//g,'');
 for(const block of body.split('}')){const selector=block.split('{').slice(-2,-1)[0]?.trim();if(!selector||selector.startsWith('@'))continue;
  for(const part of selector.replace(/\([^)]*\)/g,'()').split(','))assert.match(part.trim(),/^(\.home|@)/,'every rule starts with .home: '+part.trim());}
 assert.doesNotMatch(body.replace(/var\(--[\w-]+\)/g,''),/#[0-9a-f]{3,8}\b|rgba?\(/i,'no hard-coded colour');
 assert.doesNotMatch(body,/font-size:\s*\d|font:\s*(?:\d{3}\s+)?\d+(?:\.\d+)?(?:px|rem|em)/,'type sizes only from the six (var(--v2-t12) to var(--v2-t22))');
 assert.doesNotMatch(css+js,/—/,'no em dash');
 assert.doesNotMatch(js,/\bfetch\(/,'commands only, through the shell');
});

test('Home keeps the desk and the folders apart, takes three quick presses by click and by keys in turn, and files a moved subject last',async t=>{
 const f=await server(t);await world(f);
 const placeOf=async id=>(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];
 // Three on the desk, and Tea holding three in a known order.
 const p=await placeOf('inv-cups');await f.agent('/api/subject-places/save',{parentStudyId:'inv-cups',expectedRevision:p.revision,expectedHash:p.hash,pinned:true});
 const tea=['inv-river','inv-cups'];const rows=[];for(const id of tea)rows.push(await placeOf(id));
 await f.agent('/api/subject-places/reorder',{items:rows.map(r=>({parentStudyId:r.parentStudyId,expectedRevision:r.revision,expectedHash:r.hash}))});
 await f.agent('/api/study-draft/create-collection',{parentStudyId:'inv-lake',title:'Invented lake'});
 {const q=await placeOf('inv-lake');await f.agent('/api/subject-places/save',{parentStudyId:'inv-lake',expectedRevision:q.revision,...(q.saved?{expectedHash:q.hash}:{}),pinned:true});}
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelectorAll('.home-card').length===4,'the desk');
 const deskIds=()=>[...doc.querySelectorAll('.home-card')].map(c=>c.dataset.id);
 const start=deskIds(),last=start[3];
 const cardOf=id=>[...doc.querySelectorAll('.home-card')].find(c=>c.dataset.id===id);
 // Three quick Move up presses by click on the last card: it ends first, and the others keep their order.
 for(let i=0;i<3;i++)click(w,cardOf(last).querySelector('[data-v2-up]'));
 assert.deepEqual(deskIds(),[last,start[0],start[1],start[2]],'every press counted on screen');
 await until(async()=>(await placeOf(last)).deskOrder===0,'the presses to be saved');
 await until(async()=>(await placeOf(start[2])).deskOrder===3,'the last press to be saved');
 let saved=await Promise.all(start.map(placeOf));
 assert.deepEqual(Object.fromEntries(saved.map(x=>[x.parentStudyId,x.deskOrder])),{[last]:0,[start[0]]:1,[start[1]]:2,[start[2]]:3});
 // Three quick presses by keys (Alt with an arrow key on the card's Move button) take it back down, and focus stays there.
 const btn=cardOf(last).querySelector('[data-v2-down]');btn.focus();
 for(let i=0;i<3;i++)btn.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true,cancelable:true}));
 assert.deepEqual(deskIds(),start,'three presses by keys counted on screen');
 assert.ok(cardOf(last).contains(doc.activeElement),'focus stays on the same card');
 await until(async()=>(await placeOf(last)).deskOrder===3,'the key presses to be saved');
 saved=await Promise.all(start.map(placeOf));
 assert.deepEqual(Object.fromEntries(saved.map(x=>[x.parentStudyId,x.deskOrder])),{[start[0]]:0,[start[1]]:1,[start[2]]:2,[last]:3});
 // The folder order is untouched by the desk.
 assert.deepEqual([(await placeOf('inv-river')).order,(await placeOf('inv-cups')).order],[0,1]);
 // Filing a subject into another folder puts it last there.
 await until(()=>doc.querySelector('.home-row[data-id="inv-garden"]'),'the rows');
 const row=doc.querySelector('.home-row[data-id="inv-garden"]'),head=doc.querySelector('.home-group[data-key="f:Tea"]>header');
 row.dispatchEvent(new w.Event('dragstart',{bubbles:true}));head.dispatchEvent(new w.Event('drop',{bubbles:true,cancelable:true}));
 await until(async()=>(await placeOf('inv-garden')).folder.join('/')==='Tea','the move');
 assert.equal((await placeOf('inv-garden')).order,2,'last in Tea, after the two there');
 await until(()=>rowsOf(doc,'f:Tea').length===3,'the moved row');
 assert.deepEqual(rowsOf(doc,'f:Tea').map(n=>n.slice(0,15)),['Invented river','Invented cups','Invented garden']);
});

test('Home: an answered question stays where it was; archive from the row menu with Undo; quiet empty folders and +N tags',async t=>{
 const f=await server(t);await world(f);
 await f.agent('/api/needs-you/raise',{band:'only-adrian',question:'A second invented question?',choices:['One','Two'],about:'Invented cups'});
 const p=await (await f.agent('/api/subject-places?parentStudyId=inv-cups')).places[0];
 await f.agent('/api/subject-places/save',{parentStudyId:'inv-cups',expectedRevision:p.revision,expectedHash:p.hash,tags:['a1','a2','a3','a4','a5','a6']});
 const {w,doc,sources}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelectorAll('.home-needs li').length===2,'two questions');
 const order=()=>[...doc.querySelectorAll('.home-needs li')].map(li=>li.textContent.includes('garden')?'garden':'second');
 const before=order();
 click(w,[...doc.querySelectorAll('[data-ask-choice]')].find(b=>b.dataset.askChoice==='Name it'));
 await until(()=>doc.querySelector('.home-needs li.ok'),'the answer');
 // A change arrives and Home reads everything again: the answered row keeps its place and its Change it.
 const es=sources.at(-1);es.emit('hello',{bootId:'b1',cursor:1});es.emit('change',{cursor:2,bootId:'b1',kind:'needs-you.answered',scope:{kind:'needs-you',id:'x'}});
 await new Promise(r=>setTimeout(r,900));
 assert.deepEqual(order(),before,'it stays where it was');
 assert.ok(doc.querySelector('.home-needs li.ok [data-ask-change]'),'with Change it');
 assert.doesNotMatch(doc.querySelector('.home-needs').textContent,/Undo/);
 // Tags past four are counted.
 assert.deepEqual([...doc.querySelectorAll('.home-row[data-id="inv-cups"] .home-tags i')].map(i=>i.textContent),['a1','a2','a3','a4','+2']);
 // An empty folder is one quiet line.
 const art=doc.querySelector('.home-group[data-key="f:Art"]');
 assert.equal(art.querySelector('ul,p'),null);assert.match(art.querySelector('header').textContent,/Empty/);
 // The row's quiet menu archives, with Undo; there is no Arrange button, rows drag and have Move up and Move down.
 assert.equal(doc.querySelector('[data-arrange]'),null);
 assert.ok(doc.querySelector('.home-row .home-grip'),'rows carry a drag grip');
 click(w,doc.querySelector('[data-row-menu="inv-cups"]'));
 click(w,doc.querySelector('dialog.v2-sheet [data-archive-now]'));
 const placeOf=async id=>(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];
 await until(async()=>(await placeOf('inv-cups')).archived,'the archive');
 const note=await until(()=>[...doc.querySelectorAll('#v2-messages .v2-msg')].find(m=>/archived/.test(m.textContent)),'the Undo note');
 click(w,[...note.querySelectorAll('button')].find(b=>/Undo/.test(b.textContent)));
 await until(async()=>!(await placeOf('inv-cups')).archived,'Undo');
});

test('Home as an assistant says why the answers are greyed, in a visible line; covers view with no photograph is a plain card; the look dot names its look',async t=>{
 const f=await server(t);await world(f);
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url),hash:'?reviewActor=agent:codex#/'});
 await until(()=>doc.querySelector('.home-groups .home-row'),'the list');
 const buttons=[...doc.querySelectorAll('.home-needs [data-ask-choice]')];
 assert.ok(buttons.length&&buttons.every(b=>b.disabled),'the choices are greyed for an assistant');
 const reason=doc.querySelector('.home-needs .home-reason');
 assert.ok(reason&&/Only Adrian answers these/.test(reason.textContent),'the reason is a line on the page, not only a tooltip');
 click(w,doc.querySelector('[data-view="covers"]'));
 const covers=[...doc.querySelectorAll('.home-cover')];assert.ok(covers.length);
 for(const c of covers){
  const pic=c.querySelector('.home-cover-pic');assert.ok(!pic||pic.hidden,'no empty picture box when there is no photograph');
  assert.equal(c.querySelector('.home-cover-pic .v2-ring'),null,'no ring in a picture box');
  assert.ok(c.querySelector('[data-row-menu]')&&c.querySelector('[data-pin]'),'the menu sits beside the pin, as in rows');
 }
 assert.doesNotMatch(read('public/v2/screens/home.js'),/Drawn in the \$\{esc\(id\)\}/,'the dot says the look\'s name, not its id');
});
