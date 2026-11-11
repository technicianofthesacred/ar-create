import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {buildRequest as agentBuildRequest} from '../agents/lib/client.mjs';

// Version two's shell: the names every screen relies on, the two fronts, and the command client against the real
// in-process server. Invented subjects and words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');

// The screen files, in order. index.html lists every one now, so a screen piece never edits it.
const SCREENS=['home','subject','slides','looks','research','write'];
const ROUTES={home:'','subject':'subject/:id',slides:'slides/:id',looks:'looks',research:'research','research-group':'research/group/:id','research-topic':'research/topic/:id',write:'write/:id'};

function scriptsOf(html){return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);}
function stylesOf(html){return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);}

/** The page in a DOM, with fetch answered by the given table: route -> body (or [status, body]). */
async function page({url='http://local.test/v2/index.html',answers={},storage={}}={}){
 const html=read('public/v2/index.html');
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],sources=[];windows.push(w);
 // A stand-in for the browser's EventSource, to send the page changes as the server's stream would.
 w.EventSource=class{constructor(u){this.url=u;this.l={};sources.push(this);}addEventListener(t,f){(this.l[t]||=[]).push(f);}close(){this.closed=true;}emit(t,data){for(const f of this.l[t]||[])f({data:JSON.stringify(data)});}};
 for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
 const commands=[['needs-you','GET','/api/needs-you',true],['subject-places','GET','/api/subject-places',true],['study-draft.catalog','GET','/api/study-draft/catalog',true],['look','GET','/api/look',true],['subject-places.save','POST','/api/subject-places/save',false],['needs-you.answer','POST','/api/needs-you/answer',false]]
  .map(([name,method,route,readOnly])=>({name,method,route,readOnly,schema:{},actors:['any']}));
 w.fetch=async(input,options={})=>{const u=new URL(String(input),w.location.href);calls.push({path:u.pathname+u.search,options});
  const answer=u.pathname==='/api/capabilities'?{commands}:answers[u.pathname]??{};const [status,body]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};};
 for(const src of scriptsOf(html)){const file=src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src);w.eval(fs.readFileSync(file,'utf8'));}
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await new Promise(r=>setTimeout(r,30));
 return {dom,w,calls,sources,doc:w.document};
}
// Close every page when done, so their timers do not hold the run open.
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=()=>new Promise(r=>setTimeout(r,30));
const plain=value=>JSON.parse(JSON.stringify(value));

test('index.html lists every screen file in order, after the shell, and every file it names exists',()=>{
 const html=read('public/v2/index.html'),scripts=scriptsOf(html),styles=stylesOf(html);
 assert.deepEqual(scripts,['/document-study/recovery-storage.js','shell/client.js','shell/parts.js','shell/shell.js',...SCREENS.map(s=>`screens/${s}.js`)]);
 assert.deepEqual(styles,['/document-study/c3-theme.css','shell/shell.css','/document-study/graphite-controls.css',...SCREENS.map(s=>`screens/${s}.css`)]);
 for(const file of [...scripts,...styles])assert.ok(fs.existsSync(file.startsWith('/')?path.join(repo,'public',file):path.join(v2dir,file)),file+' exists');
 assert.doesNotMatch(html,/<script>(?!<)/,'no inline script: the page runs under the app\'s strict script policy');
 assert.ok(fs.existsSync(path.join(v2dir,'README.md')),'the one page later workers read');
});

test('the shell exposes the names screens rely on, and every screen registers its route',async()=>{
 const {w}=await page();
 const v2=w.v2;
 for(const name of ['screen','href','go','route','screens','call','on','expect','actor','isHuman','actorName','Error','advanced','brand','theme'])assert.equal(typeof v2[name],'function',name);
 for(const name of ['refresh','use','list'])assert.equal(typeof v2.desk[name],'function','desk.'+name);
 for(const name of ['refresh','count'])assert.equal(typeof v2.needs[name],'function','needs.'+name);
 assert.equal(typeof v2.shared,'object','v2.shared: where screens leave helpers for each other');
 v2.shared.invented={answer:()=>42};assert.equal(v2.shared.invented.answer(),42);
 for(const name of ['ring','step','notBuilt','sheet','say','undo','reorder','icon','esc'])assert.equal(typeof v2.ui[name],'function','ui.'+name);
 assert.equal(v2.version,1);
 assert.deepEqual(plain(Object.fromEntries(v2.screens().map(s=>[s.id,s.route]))),ROUTES);
 assert.throws(()=>v2.screen({id:'home',route:'elsewhere',render:()=>''}),/already registered/);
 assert.throws(()=>v2.screen({id:'another',route:'looks',render:()=>''}),/already answers/);
 assert.equal(v2.href('subject/:id',{id:'a b'}),'#/subject/a%20b');
 assert.equal(v2.href('research'),'#/research');
 assert.deepEqual(plain(v2.expect({revision:3,hash:'h'})),{expectedRevision:3,expectedHash:'h'});
 assert.deepEqual(plain(v2.expect(null)),{expectedRevision:0});
});

test('the router: Home first, each route opens from its address, unknown addresses go Home, back and forward work',async()=>{
 const {w,doc}=await page({url:'http://local.test/v2/index.html#/subject/synthetic-one'});
 assert.equal(w.v2.route().id,'subject');assert.deepEqual(plain(w.v2.route().params),{id:'synthetic-one'});
 assert.equal(doc.querySelector('[data-v2-here]'),null,'the sample has no thin back bar under the top bar');
 w.location.hash='#/research/topic/t1';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 assert.equal(w.v2.route().id,'research-topic');
 assert.equal(doc.querySelector('[data-v2-place="research"]').getAttribute('aria-current'),'page');
 w.location.hash='#/nowhere/at/all';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 assert.equal(w.location.hash,'#/');assert.equal(w.v2.route().id,'home');
 assert.equal(doc.querySelector('.v2-top [data-v2-place="home"]').getAttribute('aria-current'),'page');
 w.history.back();await new Promise(r=>setTimeout(r,60));
 assert.notEqual(w.v2.route().id,'home','Back leaves Home again');
});

test('the frame: top bar, phone bar, Needs you count, the desk from pinned subjects, theme',async()=>{
 const {w,doc,calls}=await page({answers:{
  '/api/needs-you':{counts:{open:2},asks:[]},
  '/api/subject-places':{places:[{parentStudyId:'p2',pinnedAt:'2026-11-02T00:00:00Z',archived:false,order:1},{parentStudyId:'p1',pinnedAt:'2026-11-01T00:00:00Z',archived:false,order:0},{parentStudyId:'p3',pinnedAt:null},{parentStudyId:'p4',pinnedAt:'2026-11-03T00:00:00Z',archived:true}]},
  '/api/study-draft/catalog':{collections:[{parentStudyId:'p1',title:'Invented garden'}],drafts:[{parentStudyKey:'p2',title:'Invented cups'}]},
 },storage:{'ar-create-packaged-document-study-v1':JSON.stringify({theme:'light',projects:[]})}});
 await settle();
 const top=doc.querySelector('[data-v2-top]');
 assert.deepEqual([...top.querySelectorAll('.v2-place')].map(a=>a.textContent),['Home','Research','Looks','Library']);
 for(const hook of ['[data-v2-ask]','[data-v2-needs]','[data-v2-capture]','[data-v2-theme]','[data-v2-advanced]'])assert.ok(top.querySelector(hook),hook);
 assert.equal(top.querySelector('[data-v2-advanced]').textContent,'Advanced');
 assert.equal(top.querySelector('[data-v2-needs]').hidden,false);assert.equal(top.querySelector('[data-v2-needs-count]').textContent,'2');
 assert.deepEqual([...doc.querySelectorAll('[data-v2-phone] span')].map(s=>s.textContent),['Home','Research','Capture','Needs you']);
 assert.equal(doc.querySelector('[data-v2-needs-badge]').textContent,'2');
 assert.deepEqual([...doc.querySelectorAll('.v2-desk-chip')].map(a=>[a.getAttribute('href'),a.textContent]),[['#/subject/p1','Invented garden'],['#/subject/p2','Invented cups']],'pinned, not archived, in hand order, named from the records');
 assert.match(top.querySelector('[data-v2-place="library"]').getAttribute('href'),/^\/document-study\/index\.html\?section=library$/);
 // The theme follows the system until he chooses one with the theme button; the choice is kept.
 assert.equal(doc.documentElement.dataset.theme,'light','no system preference in this page, so light, whatever the workspace stored');
 doc.querySelector('[data-v2-theme]').click();
 assert.equal(doc.documentElement.dataset.theme,'dark');
 assert.deepEqual(JSON.parse(w.localStorage.getItem('ar-create-v2-theme')),{theme:'dark'});
 assert.equal(JSON.parse(w.localStorage.getItem('ar-create-packaged-document-study-v1')).theme,'light','the workspace\'s own copy is never written');
 w.location.hash='#/subject/p1';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 assert.equal(doc.querySelector('[data-v2-advanced]').getAttribute('href'),'/document-study/index.html?subject=p1');
 assert.equal(doc.querySelector('.v2-desk-chip[aria-current]').getAttribute('href'),'#/subject/p1');
 assert.ok(calls.every(c=>!c.options.headers['X-AR-Actor']),'as Adrian the page sends no actor header, like the existing page');
});

test('the theme follows the system until he chooses, and a choice is kept',async()=>{
 const sys=await (async()=>{const html=read('public/v2/index.html');const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:'http://local.test/v2/index.html',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;windows.push(w);
  w.matchMedia=()=>({matches:true,addEventListener(){}});w.fetch=async()=>({ok:true,status:200,text:async()=>'{}'});w.EventSource=class{addEventListener(){}close(){}};
  for(const src of scriptsOf(html)){const file=src.startsWith('/')?path.join(repo,'public',src):path.join(v2dir,src);w.eval(fs.readFileSync(file,'utf8'));}
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();return w;})();
 assert.equal(sys.document.documentElement.dataset.theme,'dark','a dark system opens dark');
 sys.document.querySelector('[data-v2-theme]').click();
 assert.equal(sys.document.documentElement.dataset.theme,'light');
 assert.equal(JSON.parse(sys.localStorage.getItem('ar-create-v2-theme')).theme,'light','the choice is kept');
});

test('Capture is the sample sheet with four tiles; search goes to Research',async()=>{
 const {w,doc}=await page({url:'http://local.test/v2/index.html#/subject/p1'});
 doc.querySelector('[data-v2-capture]').click();
 const sheet=doc.querySelector('dialog.v2-sheet');assert.ok(sheet);
 assert.equal(sheet.querySelector('h2').textContent,'Capture');
 assert.equal(sheet.querySelector('[data-v2-close]'),null,'the sample sheet has no close button');
 assert.deepEqual([...sheet.querySelectorAll('.v2-cap4 a')].map(a=>a.textContent),['Speak','Photograph','Write a thought','Ask a question']);
 assert.match(sheet.querySelector('.v2-cap4 a').getAttribute('href'),/^\/document-study\/index\.html\?subject=p1&section=material$/);
 assert.equal(sheet.querySelector('[data-v2-cap-ask]').getAttribute('href'),'#/research');
 assert.doesNotMatch(sheet.textContent,/Not built yet/);
 sheet.querySelector('[data-v2-cap-ask]').click();assert.equal(doc.querySelector('dialog.v2-sheet'),null,'choosing a tile closes the sheet');
 w.location.hash='#/';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 doc.querySelector('[data-v2-ask]').click();
 assert.equal(w.location.hash,'#/research');
 assert.equal(doc.querySelector('dialog.v2-sheet'),null,'search opens no dialog');
});

test('screens hear changes from the live stream: by record, by command name, and a reset',async()=>{
 const {w,calls,sources}=await page({answers:{'/api/needs-you':{counts:{open:0}}}});
 const es=sources.find(x=>!x.closed);assert.equal(es.url,'/api/events');
 es.emit('hello',{bootId:'boot-1',cursor:5});
 const heard={one:[],needs:[]};w.v2.on({kind:'subject-places',id:'p1'},e=>heard.one.push(e.reset?'reset':e.cursor));w.v2.on({kinds:['needs-you*']},e=>heard.needs.push(e.reset?'reset':e.kind));
 const before=calls.filter(c=>c.path.startsWith('/api/needs-you')).length;
 es.emit('change',{cursor:6,bootId:'boot-1',kind:'subject-places.save',scope:{kind:'subject-places',id:'p2'}});
 es.emit('change',{cursor:7,bootId:'boot-1',kind:'subject-places.save',scope:{kind:'subject-places',id:'p1'}});
 es.emit('change',{cursor:7,bootId:'boot-1',kind:'subject-places.save',scope:{kind:'subject-places',id:'p1'}});
 es.emit('change',{cursor:8,bootId:'boot-1',kind:'needs-you.raise',scope:{kind:'needs-you',id:'a1'}});
 es.emit('reset',{bootId:'boot-2',cursor:0});await settle();
 assert.deepEqual(plain(heard),{one:[7,'reset'],needs:['needs-you.raise','reset']},'a change already heard is not heard twice');
 assert.ok(calls.filter(c=>c.path.startsWith('/api/needs-you')).length>=before+1,'the Needs you count is read again');
 // A screen's own listener stops when the screen closes.
 let open=0;w.v2.screen({id:'listening',route:'listening',render:()=>'',mount:(el,ctx)=>{ctx.on({},()=>open++);}});
 w.location.hash='#/listening';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 es.emit('change',{cursor:20,bootId:'boot-2',kind:'x',scope:{kind:'x',id:'y'}});assert.equal(open,1);
 w.location.hash='#/';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 es.emit('change',{cursor:21,bootId:'boot-2',kind:'x',scope:{kind:'x',id:'y'}});assert.equal(open,1);
});

test('advanced() names the matching place in the existing workspace, and an assistant keeps its name',async()=>{
 const {w}=await page({url:'http://local.test/v2/index.html?reviewActor=agent:codex'});
 assert.equal(w.v2.advanced({subject:'s1',piece:'o1',section:'write'}),'/document-study/index.html?subject=s1&piece=o1&section=write&reviewActor=agent%3Acodex');
 assert.equal(w.v2.advanced({section:'not-a-section'}),'/document-study/index.html?reviewActor=agent%3Acodex');
 assert.equal(w.v2.actor(),'agent:codex');assert.equal(w.v2.isHuman(),false);
 assert.equal(w.sessionStorage.getItem('ar-create-ui-actor'),'agent:codex','kept for the tab under the same key as the existing page');
});

test('a hand-off to the existing workspace names the version two address he is leaving, as it is followed',async()=>{
 const {w}=await page({url:'http://local.test/v2/index.html'});
 for(const place of ['/research/topic/t1','/looks','/research/group/g1','/slides/i1','/subject/p1']){
  w.location.hash='#'+place;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
  const a=w.document.querySelector('[data-v2-advanced]');a.addEventListener('click',e=>e.preventDefault());
  a.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));
  assert.equal(new URL(a.getAttribute('href'),'http://local.test/').searchParams.get('v2from'),place,place);
  assert.equal(w.v2.advanced({}),'/document-study/index.html','advanced() itself stays plain');
 }
 w.location.hash='#/';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 const a=w.document.querySelector('[data-v2-advanced]');a.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));
 assert.equal(new URL(a.getAttribute('href'),'http://local.test/').searchParams.get('v2from'),null,'Home needs none');
});

test('an unknown assistant name blocks every request, as in the existing page',async()=>{
 const {w,calls}=await page({url:'http://local.test/v2/index.html?reviewActor=agent:somebody'});
 assert.equal(w.v2.actor(),null);
 await assert.rejects(w.v2.call('needs-you',{}),e=>e.kind==='refused'&&/does not know/.test(e.message));
 assert.equal(calls.length,0);
 assert.match(w.document.getElementById('v2-messages').textContent,/does not know/);
});

test('the shared pieces: ring, step, not built yet, sheet, message with Undo, reorder by Move up and Move down',async()=>{
 const {w,doc}=await page();const ui=w.v2.ui;
 assert.match(ui.ring(0.4),/class="v2-ring" style="--p:0\.40"/);assert.match(ui.ring(2),/v2-ring full/);
 assert.match(ui.step('wait'),/data-state="wait"/);assert.match(ui.step('nonsense'),/data-state="todo"/);
 assert.match(ui.notBuilt('Folders.',{advanced:{subject:'s'}}),/Not built yet\.<\/b> Folders\..*href="\/document-study\/index\.html\?subject=s".*Open in Advanced/s);
 assert.equal(ui.esc('<b>"x"</b>'),'&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
 const s=ui.sheet({title:'Invented sheet',body:'<p>Body</p>'});assert.ok(doc.querySelector('dialog.v2-sheet'));assert.equal(s.body.textContent,'Body');s.close();assert.equal(doc.querySelector('dialog.v2-sheet'),null);
 let undone=false;ui.undo('Moved.',()=>{undone=true;});doc.querySelector('#v2-messages button').click();assert.equal(undone,true);
 const list=doc.createElement('ol');list.innerHTML='<li>A</li><li>B</li><li>C</li>';doc.getElementById('v2-main').append(list);
 const moves=[];ui.reorder(list,{item:'li',onMove:(from,to)=>moves.push([from,to]),label:el=>el.firstChild.textContent});
 assert.equal(list.querySelector('li [data-v2-up]').disabled,true);assert.equal(list.querySelector('li [data-v2-down]').getAttribute('aria-label'),'Move down: A');
 list.querySelector('li [data-v2-down]').click();await settle();
 assert.deepEqual([...list.children].map(li=>li.firstChild.textContent),['B','A','C']);assert.deepEqual(moves,[[0,1]]);
});

test('reorder keeps focus on the same card\'s Move button while the save is slow, and counts every press',async()=>{
 const {w,doc}=await page();const ui=w.v2.ui;
 const list=doc.createElement('ol');list.innerHTML='<li>A</li><li>B</li><li>C</li><li>D</li><li>E</li>';doc.getElementById('v2-main').append(list);
 const moves=[],release=[];ui.reorder(list,{item:'li',onMove:(from,to)=>{moves.push([from,to]);return new Promise(r=>release.push(r));},label:el=>el.firstChild.textContent});
 const a=[...list.children].find(li=>li.firstChild.textContent==='A'),down=a.querySelector('[data-v2-down]');down.focus();
 for(let i=0;i<3;i++){down.click();assert.equal(doc.activeElement,down,'press '+(i+1)+': focus is still on A\'s Move down, before the save returns');}
 assert.deepEqual([...list.children].map(li=>li.firstChild.textContent),['B','C','D','A','E']);assert.equal(moves.length,3,'every press counted');
 // The same by keys (Alt with an arrow key on the focused button).
 for(let i=0;i<2;i++){down.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true,cancelable:true}));}
 assert.deepEqual([...list.children].map(li=>li.firstChild.textContent),['B','A','C','D','E']);assert.equal(doc.activeElement,down);
 release.forEach(r=>r());await settle();assert.equal(doc.activeElement,down,'and after the saves');
 // Moving to the end disables Move down: focus goes to the same card's Move up, never to the page.
 down.click();down.click();down.click();
 assert.equal(a.parentElement.lastElementChild,a);assert.equal(doc.activeElement,a.querySelector('[data-v2-up]'));
});

test('the client builds every registry request exactly as the agents\' client does',async t=>{
 const f=await server(t),{commands}=await (await fetch(f.url+'/api/capabilities')).json(),C=clientModule();
 for(const command of commands){
  const input=Object.fromEntries((command.route.match(/\{(\w+)\}/g)||[]).map(k=>[k.slice(1,-1),'x-1']));
  for(const field of (command.schema?.query||[]).slice(0,3))input[String(field).replace(/\?$/,'')]='v';
  input.extra={nested:true};
  assert.deepEqual(JSON.parse(JSON.stringify(C.buildRequest(command,input))),JSON.parse(JSON.stringify(agentBuildRequest(command,input))),command.name);
 }
});

function clientModule(){const ctx={URLSearchParams,URL,JSON,Error,Promise,setTimeout,clearTimeout,console,crypto:globalThis.crypto,AbortSignal,module:{exports:{}}};ctx.globalThis=ctx;vm.runInNewContext(read('public/v2/shell/client.js'),ctx);return ctx.module.exports;}
async function server(t){
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const s=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>s.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 return {url:'http://127.0.0.1:'+s.address().port};
}
// The page's own requests: same origin (Origin is sent on writes, as a browser does), the actor only when named.
function pageClient(url,search=''){const C=clientModule();return C.createClient({base:url,search,storage:null,fetchImpl:(u,o)=>fetch(u,{...o,headers:{...o.headers,...(o.method!=='GET'?{Origin:url}:{})}})});}

test('the client against the server: a read, a write with its revision, a 409 re-read and merged, a 403 as an assistant',async t=>{
 const f=await server(t),adrian=pageClient(f.url);
 const before=await adrian.call('subject-places',{parentStudyId:'hk'});
 assert.equal(before.places[0].saved,false,'a subject with no saved place');assert.equal(before.places[0].revision,0);
 const saved=await adrian.call('subject-places.save',{parentStudyId:'hk',expectedRevision:0,tags:['invented']});
 assert.equal(saved.revision,1);assert.deepEqual(saved.tags,['invented']);
 // A stale write: the client says so in plain words and, with reread and merge, tries once more on the fresh record.
 await assert.rejects(adrian.call('subject-places.save',{parentStudyId:'hk',expectedRevision:0,tags:['stale']}),e=>e.kind==='stale'&&e.status===409&&e.message==='This changed since it was opened here. Read it again before saving.');
 const reread=async()=>(await adrian.call('subject-places',{parentStudyId:'hk'})).places[0];
 let seen=null;
 await assert.rejects(adrian.call('subject-places.save',{parentStudyId:'hk',expectedRevision:0,tags:['left']},{reread,merge:fresh=>{seen=fresh;return null;}}),e=>e.kind==='stale'&&e.fresh?.revision===1&&/It has been read again/.test(e.message));
 assert.equal(seen.revision,1,'merge was shown the fresh record');
 const merged=await adrian.call('subject-places.save',{parentStudyId:'hk',expectedRevision:0,tags:['merged']},{reread,merge:fresh=>({parentStudyId:'hk',expectedRevision:fresh.revision,expectedHash:fresh.hash,tags:[...fresh.tags,'merged']})});
 assert.equal(merged.revision,2);assert.deepEqual(merged.tags,['invented','merged']);
 // An assistant may raise a question; only Adrian answers it.
 const codex=pageClient(f.url,'?reviewActor=agent:codex');
 const ask=await codex.call('needs-you.raise',{band:'only-adrian',question:'Invented question?',choices:['Yes','No']});
 assert.ok(ask.id);
 await assert.rejects(codex.call('needs-you.answer',{id:ask.id,choice:'Yes'}),e=>e.kind==='owner-only'&&e.status===403&&e.message==='Only Adrian can decide this. Codex can propose it, not do it.');
 const open=await adrian.call('needs-you',{status:'open'});assert.equal(open.counts.open,1,'the refused answer changed nothing');
 await assert.rejects(adrian.call('no.such.command',{}),e=>e.kind==='refused'&&/no command/.test(e.message));
});

test('the client says who holds a record (423) and what a consent hold is, in plain words',async()=>{
 const C=clientModule(),answer=(status,body)=>C.createClient({search:'',storage:null,fetchImpl:async u=>({ok:u.endsWith('/api/capabilities'),status:u.endsWith('/api/capabilities')?200:status,text:async()=>JSON.stringify(u.endsWith('/api/capabilities')?{commands:[{name:'w',method:'POST',route:'/api/w',readOnly:false,schema:{}}]}:body)})});
 await assert.rejects(answer(423,{error:'locked',holder:{actor:'agent:claude-code',expiresAt:'2026-11-11T10:00:00Z'}}).call('w',{}),e=>e.kind==='held'&&/^Claude is working on this until .+\. Wait, or ask them to let it go\.$/.test(e.message)&&e.holder.actor==='agent:claude-code');
 await assert.rejects(answer(423,{error:'Held until the people in it have said yes.',code:'consent-hold',hold:{unanswered:['x']}}).call('w',{}),e=>e.kind==='consent'&&e.message==='Held until the people in it have said yes.'&&!!e.hold);
 await assert.rejects(answer(500,{error:'internal detail'}).call('w',{}),e=>e.kind==='failed'&&e.message==='The app could not answer. Nothing was changed.');
});

test('the app\'s own address opens version two, and every address of the existing workspace works as before',async t=>{
 const f=await server(t);
 const get=(route,method='GET')=>fetch(f.url+route,{method,redirect:'manual'});
 for(const [route,location] of [['/','/v2/index.html'],['/?reviewActor=agent:codex','/v2/index.html?reviewActor=agent:codex'],['/v2','/v2/index.html']]){
  const r=await get(route);assert.equal(r.status,302,route);assert.equal(r.headers.get('location'),location,route);
 }
 assert.equal((await get('/','HEAD')).status,302);
 const v2=await get('/v2/index.html');assert.equal(v2.status,200);assert.match(v2.headers.get('content-type'),/text\/html/);assert.match(await v2.text(),/screens\/research\.js/);
 assert.doesNotMatch(v2.headers.get('content-security-policy'),/unsafe-inline'; style/,'version two runs without inline scripts');
 assert.equal((await get('/v2/')).status,200);
 for(const file of ['/v2/shell/client.js','/v2/shell/parts.js','/v2/shell/shell.js','/v2/shell/shell.css',...SCREENS.flatMap(s=>[`/v2/screens/${s}.js`,`/v2/screens/${s}.css`])])assert.equal((await get(file)).status,200,file);
 for(const route of ['/document-study/index.html','/document-study/index.html?reviewActor=agent:claude-code','/document-study/index.html?instagram=plan-x','/document-study/index.html?reviewStory=s&reviewStage=11','/document-study/instagram-mirror.html','/transcript-check/index.html']){
  const r=await get(route);assert.equal(r.status,200,route);assert.match(r.headers.get('content-type'),/text\/html/,route);
 }
 const workspace=await get('/document-study/index.html');
 assert.match(workspace.headers.get('content-security-policy'),/script-src 'self' 'unsafe-inline'/,'the workspace keeps its own script policy');
 const html=await workspace.text();assert.match(html,/<script src="study\.js"><\/script>/);assert.match(html,/<script src="version-two\.js"><\/script><\/body>/);
 assert.equal((await get('/api/nowhere')).status,404,'an unknown API route still answers 404');
});

/** The existing workspace's top line, as its own modules leave it, with version-two.js loaded last. */
function workspace({url='http://local.test/document-study/index.html',home=false,projects=[]}={}){
 const dom=new JSDOM(`<body><header id="c3-tabstrip" class="wbf-top"><details class="ht-switch"></details><button class="ht-place ht-theme" data-ht-theme>T</button><div class="wbf-top-actions"></div></header>${home?'<dialog id="project-library" open></dialog>':''}<div id="app"><nav class="combined-rail"></nav><div id="manuscript"></div></div></body>`,{url,runScripts:'outside-only'});
 const w=dom.window,calls=[],mounts=[];windows.push(w);
 w.c3Shell={register:(name,fn)=>{mounts.push(fn);fn();}};
 w.eval('var current=()=>({id:"hk",viewedStage:5});');
 w.eval('var state='+JSON.stringify({projects}));
 w.combinedSubjects={open:async o=>{calls.push(['subject',o.projectId]);},openStage:async n=>{calls.push(['stage',n]);return true;}};
 w.combinedNavigation={go:async key=>{calls.push(['go',key]);return true;}};
 w.workspaceNavigation={changeMode:async mode=>{calls.push(['mode',mode]);}};
 w.realOutputOverview={onAction:async r=>{calls.push(['piece',r.outputId,r.kind]);}};
 w.eval(read('public/document-study/version-two.js'));
 return {w,doc:w.document,calls,mounts};
}
test('the existing workspace: one quiet "Version two" link before the theme switch, back to the same subject',()=>{
 const {doc,mounts,w}=workspace();
 const link=doc.querySelector('#c3-tabstrip>a.v2-front');
 assert.equal(link.textContent,'Version two');assert.equal(link.nextElementSibling,doc.querySelector('.ht-theme'));
 assert.equal(link.getAttribute('href'),'/v2/index.html#/subject/hk');
 // The strip is redrawn by its owner; the link comes back once, never twice.
 doc.getElementById('c3-tabstrip').innerHTML='<details class="ht-switch"></details><button class="ht-place ht-theme" data-ht-theme>T</button>';
 mounts.forEach(fn=>fn());mounts.forEach(fn=>fn());
 assert.equal(doc.querySelectorAll('a.v2-front').length,1);
 assert.equal(doc.querySelectorAll('#c3-tabstrip>*').length,3,'nothing else is added');
 assert.equal(w.document.querySelectorAll('a').length,1);
 const onHome=workspace({home:true});assert.equal(onHome.doc.querySelector('a.v2-front').getAttribute('href'),'/v2/index.html','from Home it opens Home');
});
test('the existing workspace opens the subject, section and piece named in its address, then forgets them',async()=>{
 const {w,calls}=workspace({url:'http://local.test/document-study/index.html?subject=hk&piece=o1&section=read&reviewActor=agent:codex'});
 for(let i=0;i<40&&calls.length<4;i++)await new Promise(r=>setTimeout(r,50));
 assert.deepEqual(calls,[['subject','hk'],['piece','o1','native'],['go','write'],['mode','read']]);
 assert.deepEqual([...new w.URLSearchParams(w.location.search)].map(e=>[...e]),[['reviewActor','agent:codex']],'only the three keys are taken out of the address');
 const plain=workspace();await new Promise(r=>setTimeout(r,450));assert.deepEqual(plain.calls,[],'with no keys nothing is opened');
});
test('a subject with no section opens on the section it was last on, or Write',async()=>{
 const cases=[[[{id:'hk',viewedStage:9}],9],[[{id:'hk',viewedStage:1}],5],[[],5]];
 for(const [projects,stage] of cases){
  const {calls}=workspace({url:'http://local.test/document-study/index.html?subject=hk',projects});
  for(let i=0;i<40&&calls.length<2;i++)await new Promise(r=>setTimeout(r,50));
  assert.deepEqual(calls,[['subject','hk'],['stage',stage]],JSON.stringify(projects));
 }
});

test('the desk keeps to one row: what does not fit is taken out (nothing hidden can take focus) and "+n" opens the rest',async()=>{
 const {w,doc}=await page({answers:{'/api/needs-you':{counts:{open:0}}}});
 const nav=doc.querySelector('[data-v2-desk]');let room=360;
 // The page has no layout here, so the desk's widths are given: 104 a chip at its least, 32 for "+n", 2 between.
 const used=()=>{const shown=[...nav.children].filter(c=>!c.hidden);return shown.reduce((sum,c)=>sum+(c.matches('[data-v2-desk-more]')?32:104),0)+Math.max(0,shown.length-1)*2;};
 Object.defineProperty(nav,'clientWidth',{get:()=>room});Object.defineProperty(nav,'scrollWidth',{get:()=>Math.max(room,used())});
 w.location.hash='#/subject/s3';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();
 const long=i=>(i+' The tea garden keepers of the far hills and their long winter ledger of picking days, notebook').slice(0,90);
 await w.v2.desk.use(async()=>[1,2,3,4,5].map(i=>({id:'s'+i,title:long(i)})));
 const shown=()=>[...nav.querySelectorAll('.v2-desk-chip:not([hidden])')].map(a=>a.getAttribute('href'));
 const more=nav.querySelector('[data-v2-desk-more]');
 assert.deepEqual(shown(),['#/subject/s1','#/subject/s2','#/subject/s3'],'the open subject stays; the last ones go first');
 assert.equal(more.hidden,false);assert.equal(more.textContent,'+2');assert.equal(more.getAttribute('aria-label'),'2 more on your desk');
 assert.ok([...nav.querySelectorAll('.v2-desk-chip[hidden]')].every(a=>a.hidden),'taken out, not merely clipped');
 more.click();
 assert.deepEqual([...doc.querySelectorAll('.v2-desk-list a')].map(a=>[a.getAttribute('href'),a.textContent]),[['#/subject/s4',long(4)],['#/subject/s5',long(5)]]);
 doc.querySelector('.v2-desk-list a').click();assert.equal(doc.querySelector('dialog.v2-sheet'),null,'choosing one closes the sheet');
 room=140;await w.v2.desk.refresh();
 assert.deepEqual(shown(),['#/subject/s3'],'with room for one, it is the subject open now');assert.equal(nav.querySelector('[data-v2-desk-more]').textContent,'+4');
 room=2000;await w.v2.desk.refresh();
 assert.equal(shown().length,5);assert.equal(nav.querySelector('[data-v2-desk-more]').hidden,true,'no "+n" when all fit');
});
