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

/* ---------------- the station of a subject ---------------- */
function stations(){
 const html=read('public/v2/index.html'),dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html',runScripts:'outside-only'});
 const w=dom.window;windows.push(w);w.fetch=async()=>({ok:true,status:200,text:async()=>'{}'});w.EventSource=class{addEventListener(){}close(){}};
 for(const f of ['shell/client.js','shell/parts.js','shell/shell.js','screens/home.js'])w.eval(fs.readFileSync(path.join(v2dir,f),'utf8'));
 return w;
}

test('station: where a subject stands and its next step, from the facts its records hold',()=>{
 const w=stations(),{station,STATIONS,RESTING_DAYS}=w.v2HomeStations;
 assert.equal(w.v2.shared?.home?.station??station,station,'shared on the shell namespace when it has one, and as a plain global');
 assert.deepEqual(JSON.parse(JSON.stringify(STATIONS.map(s=>s.name))),['Gather','Research','Create','Share','Published','Resting']);
 const at=(facts,days=1)=>{const r=station({changedAt:new Date(NOW-days*DAY).toISOString(),...facts},NOW);return JSON.parse(JSON.stringify([r.station,r.name,r.next,r.section,r.ring]));};
 // Nothing known: a station, and no next step that cannot be vouched for.
 assert.deepEqual(at({}),['gather','Gather','','material',.05],'nothing known yet: no next step');
 assert.deepEqual(at({material:0}),['gather','Gather','Add material','material',.05],'known to have nothing');
 assert.deepEqual(at({material:2}),['gather','Gather','','research',.2],'material, research not known');
 assert.deepEqual(at({material:2,research:0}),['gather','Gather','Start the research','research',.2]);
 assert.deepEqual(at({material:2,research:1}),['research','Research','','direction',.4],'direction not read');
 assert.deepEqual(at({material:2,research:1,direction:false}),['research','Research','Write my direction','direction',.4]);
 assert.deepEqual(at({material:2,research:1,direction:true}),['create','Create','Write','write',.5]);
 assert.deepEqual(at({direction:true,article:true}),['create','Create','','write',.6],'an Article: whether it is finished is not recorded');
 assert.deepEqual(at({article:true,suggestions:1}),['create','Create','Look at 1 suggestion','write',.6]);
 assert.deepEqual(at({article:true,suggestions:3}).slice(2,3),['Look at 3 suggestions']);
 assert.deepEqual(at({article:true,articleStatus:'correction-needed'}).slice(2,3),['Correct the Article']);
 assert.deepEqual(at({article:true,carousel:{chosen:true,ready:false}}).slice(0,3),['create','Create',''],'an Article and a Carousel: no single next step is certain');
 assert.deepEqual(at({carousel:{chosen:false,ready:false}}),['create','Create','Choose a story','arrange',.6]);
 assert.deepEqual(at({carousel:{chosen:true,ready:false}}).slice(2,3),['Make the slides']);
 assert.deepEqual(at({article:true,articleStatus:'review-needed'}),['share','Share','Review it','audience',.8]);
 assert.deepEqual(at({article:true,articleStatus:'complete'}),['share','Share','See it as the audience','audience',.85]);
 assert.deepEqual(at({carousel:{chosen:true,ready:true},article:true}),['share','Share','Post the Carousel','share',.9]);
 assert.deepEqual(at({published:true,article:true,asks:2}),['published','Published','','outputs',1],'published has no next step, even with a question open');
 assert.deepEqual(at({article:true,articleStatus:'paused'}),['resting','Resting','','',0],'a paused Article rests');
 assert.deepEqual(at({direction:true},RESTING_DAYS+1).slice(0,3),['resting','Resting',''],'untouched for '+RESTING_DAYS+' days');
 assert.deepEqual(at({direction:true},RESTING_DAYS-1).slice(0,1),['create']);
 assert.deepEqual(at({material:1,asks:1}).slice(0,3),['gather','Gather','Answer 1 question'],'a question waiting on him comes first');
 assert.deepEqual(at({article:true,asks:2}).slice(2,3),['Answer 2 questions']);
 assert.equal(station(undefined,NOW).station,'gather','no facts at all');
 assert.equal(station({changedAt:'not a time',direction:true},NOW).station,'create','an unreadable time is not a reason to rest');
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

test('Home on real records: Needs you, the desk, Everything by folder, tag, station and recent, find, archived',async t=>{
 const f=await server(t);await world(f);
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelector('.home-groups .home-row'),'the list');
 // Needs you: the question, where it is from, its choices in place.
 const ask=doc.querySelector('.home-needs li');
 assert.match(ask.textContent,/Is the invented garden named in the piece\?/);assert.match(ask.textContent,/Invented garden/);
 assert.deepEqual([...ask.querySelectorAll('[data-ask-choice]')].map(b=>b.dataset.askChoice),['Name it','Leave it out']);
 // On your desk: the two pinned subjects as cards, each with its station and the next step, opening the subject.
 const cards=[...doc.querySelectorAll('.home-card')];
 assert.deepEqual(cards.map(c=>c.querySelector('b').textContent.slice(0,15)),['Invented garden','Invented river']);
 assert.equal(cards[0].querySelector('.home-card-next').getAttribute('href'),'#/subject/inv-garden');
 assert.match(cards[0].querySelector('.home-card-next').textContent,/Answer 1 question/,'his question is its next step');
 assert.match(cards[1].textContent,/Gather/);
 // Its next step comes once it is read a little further: it has no material, so that is certain.
 await until(()=>/Add material/.test(doc.querySelectorAll('.home-card')[1].querySelector('.home-card-next').textContent),'the next step');
 // Everything, by folder: real folders in their saved order, with their path; an empty folder still shows. The
 // fixture's two invented working drafts are subjects with no folder yet.
 assert.deepEqual([...doc.querySelectorAll('.home-group h3')].map(h=>h.textContent),['Tea','Gardens','Art','Not in a folder']);
 assert.equal(rowsOf(doc,'f:').length,2);
 assert.equal(doc.querySelector('.home-group[data-key="f:Tea\u0001Gardens"] .home-path').textContent,'Subjects / Tea / Gardens');
 assert.deepEqual(rowsOf(doc,'f:Tea'),['Invented cups','Invented river']);
 assert.match(doc.querySelector('.home-group[data-key="f:Art"]').textContent,/Empty/,'Art holds only an archived subject');
 assert.match(doc.querySelector('.home-all .home-sec-h').textContent,/5 subjects/);
 // Station chips count; one filters.
 const chip=id=>doc.querySelector(`[data-station="${id}"]`);
 assert.equal(chip('gather').querySelector('small').textContent,'3');assert.equal(chip('create').querySelector('small').textContent,'2');assert.equal(chip('share').querySelector('small').textContent,'0');
 click(w,chip('create'));assert.deepEqual([...doc.querySelectorAll('.home-group h3')].map(h=>h.textContent),['Not in a folder'],'one station shown');
 click(w,doc.querySelector('[data-station="create"]'));assert.equal(doc.querySelectorAll('.home-row').length,5,'pressed again, all again');
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
 assert.deepEqual([...doc.querySelectorAll('.home-group h3')].map(h=>h.textContent),['Gather','Create']);
 click(w,doc.querySelector('[data-group-by="recent"]'));
 assert.equal(doc.querySelectorAll('.home-row').length,5);
 click(w,doc.querySelector('[data-view="covers"]'));
 assert.equal(doc.querySelectorAll('.home-cover').length,5);
 click(w,doc.querySelector('[data-view="rows"]'));click(w,doc.querySelector('[data-group-by="folder"]'));
 // Archived subjects are out of the way behind one control.
 const archived=doc.querySelector('[data-archived]');assert.match(archived.textContent,/Archived · 1/);
 assert.equal(doc.body.textContent.includes('Invented old plan'),false);
 click(w,archived);assert.match(doc.querySelector('.home-archived').textContent,/Invented old plan/);
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
 assert.match(doc.querySelector('.home-needs li.ok').textContent,/Answered: Leave it out\./);
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
 const {doc}=await page({base:'http://local.test',fetchImpl:async u=>{const p=new URL(String(u),'http://local.test').pathname;if(p==='/api/capabilities')return {ok:true,status:200,text:async()=>JSON.stringify({commands:[['study-draft.catalog','/api/study-draft/catalog'],['subject-places','/api/subject-places'],['subject-places.folders.get','/api/subject-places/folders']].map(([name,route])=>({name,route,method:'GET',readOnly:true,schema:{}}))})};
  if(p==='/api/study-draft/catalog')return {ok:true,status:200,text:async()=>JSON.stringify({collections:[],drafts:[]})};return {ok:true,status:200,text:async()=>JSON.stringify({places:[],folders:[]})};}});
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

test('Home keeps the desk and the folders apart, takes quick presses in turn, and files a moved subject last',async t=>{
 const f=await server(t);await world(f);
 const placeOf=async id=>(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];
 // Three on the desk, and Tea holding three in a known order.
 const p=await placeOf('inv-cups');await f.agent('/api/subject-places/save',{parentStudyId:'inv-cups',expectedRevision:p.revision,expectedHash:p.hash,pinned:true});
 const tea=['inv-river','inv-cups'];const rows=[];for(const id of tea)rows.push(await placeOf(id));
 await f.agent('/api/subject-places/reorder',{items:rows.map(r=>({parentStudyId:r.parentStudyId,expectedRevision:r.revision,expectedHash:r.hash}))});
 const {w,doc}=await page({base:f.url,fetchImpl:pageFetch(f.url)});
 await until(()=>doc.querySelectorAll('.home-card').length===3,'the desk');
 const deskIds=()=>[...doc.querySelectorAll('.home-card')].map(c=>c.dataset.id);
 const start=deskIds(),last=start[2];
 // Three quick Move up presses on the last card: it ends first, and the other two keep their order.
 const up=()=>[...doc.querySelectorAll('.home-card')].find(c=>c.dataset.id===last).querySelector('[data-v2-up]');
 click(w,up());click(w,up());
 await until(async()=>(await placeOf(last)).deskOrder===0,'the presses to be saved');
 assert.deepEqual(deskIds(),[last,start[0],start[1]]);
 const saved=await Promise.all(start.map(placeOf));
 assert.deepEqual(Object.fromEntries(saved.map(x=>[x.parentStudyId,x.deskOrder])),{[last]:0,[start[0]]:1,[start[1]]:2});
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
 // Arrange: the row's quiet menu archives, with Undo.
 click(w,doc.querySelector('[data-arrange]'));
 click(w,doc.querySelector('[data-row-menu="inv-cups"]'));
 click(w,doc.querySelector('dialog.v2-sheet [data-archive-now]'));
 const placeOf=async id=>(await f.agent('/api/subject-places?parentStudyId='+id)).places[0];
 await until(async()=>(await placeOf('inv-cups')).archived,'the archive');
 const note=await until(()=>[...doc.querySelectorAll('#v2-messages .v2-msg')].find(m=>/archived/.test(m.textContent)),'the Undo note');
 click(w,[...note.querySelectorAll('button')].find(b=>/Undo/.test(b.textContent)));
 await until(async()=>!(await placeOf('inv-cups')).archived,'Undo');
});
