import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

// Version three's frame (public/v3/): the default front since 12 November 2026. It keeps version two's screen contract,
// runs version two's screen files unchanged inside its own frame for every screen it has not built, loads one shell
// only, and links both ways: "Version two" to the same place in version two, "Advanced" to the same place in the
// existing workspace, and version two's one new link, "Version three", back. Invented subjects and words only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM,VirtualConsole}=require('jsdom');
const repo=path.resolve(import.meta.dirname,'..'),v3dir=path.join(repo,'public/v3'),v2dir=path.join(repo,'public/v2');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const SCREENS=['home','subject','slides','looks','research','write','read','check'];
const ROUTES={home:'','subject':'subject/:id',slides:'slides/:id',looks:'looks',research:'research','research-group':'research/group/:id','research-topic':'research/topic/:id',write:'write/:id',read:'read/:id',check:'check/:id'};
const scriptsOf=html=>[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const stylesOf=html=>[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
const fileOf=(src,dir)=>src.startsWith('/')?path.join(repo,'public',src):path.join(dir,src);
const windows=[];after(()=>{for(const w of windows)w.close();});
const settle=(ms=30)=>new Promise(r=>setTimeout(r,ms));
const until=async(check,ms=15000)=>{const end=Date.now()+ms;for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw new Error('timed out');await settle(25);}};
const plain=value=>JSON.parse(JSON.stringify(value));
const keysOf=v2=>({top:Object.keys(v2).sort(),desk:Object.keys(v2.desk).sort(),needs:Object.keys(v2.needs).sort(),ui:Object.keys(v2.ui).sort()});

/** A front's page in a DOM. fetch is answered by the table, or sent to a real server when base is given. */
async function page({front='v3',url,answers={},base=null,storage={}}={}){
 const html=read(`public/${front}/index.html`),dir=front==='v3'?v3dir:v2dir;
 const errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('error',(...a)=>errors.push(a.map(String).join(' ')));virtualConsole.on('jsdomError',e=>errors.push(String(e?.message||e)));
 const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/g,''),{url:url||`http://local.test/${front}/index.html`,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const w=dom.window,calls=[];windows.push(w);
 w.EventSource=class{addEventListener(){}close(){}};
 w.CSS={escape:v=>String(v).replace(/["\\]/g,'\\$&')};
 w.HTMLDialogElement.prototype.showModal||=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close||=function(){this.removeAttribute('open');};
 for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
 const commands=[['needs-you','GET','/api/needs-you'],['subject-places','GET','/api/subject-places'],['study-draft.catalog','GET','/api/study-draft/catalog'],['look','GET','/api/look'],['subjects.standing','GET','/api/subjects/standing']]
  .map(([name,method,route])=>({name,method,route,readOnly:true,schema:{},actors:['any']}));
 w.fetch=async(input,options={})=>{
  const u=new URL(String(input),w.location.href),method=options.method||'GET';calls.push({path:u.pathname+u.search,options});
  if(base){const r=await fetch(base+u.pathname+u.search,{method,headers:{...options.headers,...(method!=='GET'?{Origin:base}:{})},body:options.body});const text=await r.text();return {ok:r.ok,status:r.status,text:async()=>text};}
  const answer=u.pathname==='/api/capabilities'?{commands}:answers[u.pathname]??{};const [status,body]=Array.isArray(answer)?answer:[200,answer];
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};};
 for(const src of scriptsOf(html))w.eval(fs.readFileSync(fileOf(src,dir),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await settle();
 return {w,doc:w.document,calls,errors};
}
const goHash=async(w,hash)=>{w.location.hash=hash;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await settle();};

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

test('index.html loads one shell only, version two\'s client, parts, Capture and every screen file as they are, and its own frame',()=>{
 const html=read('public/v3/index.html'),scripts=scriptsOf(html),styles=stylesOf(html);
 assert.deepEqual(scripts,['/document-study/recovery-storage.js','/v2/shell/client.js','/v2/shell/parts.js','/v2/shell/capture.js','shell/frame.js',...SCREENS.map(s=>`/v2/screens/${s}.js`)]);
 assert.ok(!scripts.some(s=>/shell\.js$/.test(s)),'version two\'s shell.js and its top bar are never loaded here');
 assert.deepEqual(styles,['/document-study/c3-theme.css','/v2/shell/shell.css','/v2/shell/capture.css','/document-study/graphite-controls.css',...SCREENS.map(s=>`/v2/screens/${s}.css`),'shell/frame.css']);
 for(const file of [...scripts,...styles])assert.ok(fs.existsSync(fileOf(file,v3dir)),file+' exists');
 assert.doesNotMatch(html,/<script>(?!<)/,'no inline script: the page runs under the app\'s strict script policy');
 assert.ok(fs.existsSync(path.join(v3dir,'README.md')));
});

test('the frame keeps version two\'s screen contract name for name, and every version two screen registers its route in it',async()=>{
 const three=await page(),two=await page({front:'v2'});
 assert.deepEqual(keysOf(three.w.v2),keysOf(two.w.v2),'the same names as version two\'s shell');
 assert.equal(three.w.v2.version,1);
 assert.deepEqual(plain(Object.fromEntries(three.w.v2.screens().map(s=>[s.id,s.route]))),ROUTES);
 assert.equal(three.w.v3Frame.front,'v3');
 assert.equal(three.doc.querySelector('.v2-top'),null,'no version two top bar');
 assert.ok(three.doc.querySelector('#v2-app>#v2-messages')&&three.doc.querySelector('#v2-app>main#v2-main'),'the message and main areas where version two\'s screens expect them');
 assert.equal(three.doc.querySelector('#v2-app [data-v3-band],#v2-app [data-v3-phone]'),null,'the band and the phone bar sit outside #v2-app, out of reach of version two\'s frame rules');
});

test('two files claiming one route, or one id, are refused',async()=>{
 const {w}=await page();
 assert.throws(()=>w.v2.screen({id:'write-again',route:'write/:id',render:()=>''}),/already answers/);
 assert.throws(()=>w.v2.screen({id:'looks',route:'looks-again',render:()=>''}),/already registered/);
 assert.equal(w.v2.screens().length,Object.keys(ROUTES).length,'nothing was added');
});

test('the router inside the frame: each route opens from its address, unknown addresses go Home, places are marked',async()=>{
 const {w,doc}=await page({url:'http://local.test/v3/index.html#/research'});
 assert.equal(w.v2.route().id,'research');
 assert.equal(doc.querySelector('.v3-places [aria-current]').dataset.v3Place,'research');
 assert.equal(doc.querySelector('.v3-phone [aria-current]').dataset.v3Place,'research');
 await goHash(w,'#/looks');assert.equal(w.v2.route().id,'looks');
 await goHash(w,'#/nowhere/at/all');await settle();
 assert.equal(w.location.hash,'#/');assert.equal(w.v2.route().id,'home');
 assert.equal(w.location.pathname,'/v3/index.html','he never leaves version three');
});

test('"Version two" opens the same place in version two, keeping the subject, the piece and the section',async()=>{
 const {w,doc}=await page({url:'http://local.test/v3/index.html#/subject/s1'});
 const two=()=>doc.querySelector('a[data-v3-two]');
 assert.equal(two().textContent,'Version two');
 assert.equal(two().getAttribute('href'),'/v2/index.html#/subject/s1');
 await goHash(w,'#/write/s1?piece=o1');assert.equal(two().getAttribute('href'),'/v2/index.html#/write/s1?piece=o1');
 await goHash(w,'#/check/s1?piece=o1');assert.equal(two().getAttribute('href'),'/v2/index.html#/check/s1?piece=o1');
 // A screen may change the address without routing (a piece made in Write): the link is refreshed as it is followed.
 w.history.replaceState(null,'','#/read/s1?piece=o2');
 two().dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
 assert.equal(two().getAttribute('href'),'/v2/index.html#/read/s1?piece=o2');
 await goHash(w,'#/');assert.equal(two().getAttribute('href'),'/v2/index.html');
});

test('"Advanced" opens the same place in the existing workspace, as version two\'s does, and names the way back',async()=>{
 const {w,doc}=await page({url:'http://local.test/v3/index.html#/subject/s1'});
 const adv=()=>doc.querySelector('a[data-v2-advanced]');
 assert.equal(adv().textContent,'Advanced');
 assert.equal(adv().getAttribute('href'),'/document-study/index.html?subject=s1');
 assert.equal(w.v2.advanced({subject:'s1',piece:'o1',section:'read'}),'/document-study/index.html?subject=s1&piece=o1&section=read');
 // A screen names its own place, as version two's Write, Read and Check do.
 w.v2.screen({id:'invented-place',route:'invented/:id',render:()=>'<p>Invented</p>',mount:(el,ctx)=>ctx.setAdvanced({subject:ctx.params.id,piece:'o9',section:'check'})});
 await goHash(w,'#/invented/s2');
 assert.equal(adv().getAttribute('href'),'/document-study/index.html?subject=s2&piece=o9&section=check');
 adv().dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
 assert.equal(new URL(adv().getAttribute('href'),'http://local.test/').searchParams.get('v2from'),'/invented/s2','the existing workspace\'s way back returns here');
});

test('an assistant\'s ?reviewActor= is carried: on every call, and by both links',async()=>{
 const {doc,calls,w}=await page({url:'http://local.test/v3/index.html?reviewActor=agent:codex#/subject/s1'});
 await settle(60);
 const sent=calls.filter(c=>c.path.startsWith('/api/')&&!c.path.startsWith('/api/capabilities'));
 assert.ok(sent.length>0);
 for(const c of sent)assert.equal(c.options.headers['X-AR-Actor'],'agent:codex',c.path);
 assert.equal(w.v2.actor(),'agent:codex');
 assert.equal(doc.querySelector('a[data-v3-two]').getAttribute('href'),'/v2/index.html?reviewActor=agent%3Acodex#/subject/s1');
 assert.equal(doc.querySelector('a[data-v2-advanced]').getAttribute('href'),'/document-study/index.html?subject=s1&reviewActor=agent%3Acodex');
 const unknown=await page({url:'http://local.test/v3/index.html?reviewActor=agent:somebody'});
 assert.match(unknown.doc.getElementById('v2-messages').textContent,/assistant name the app does not know/);
});

test('version two\'s one new link, "Version three", opens the same place in version three',async()=>{
 const {w,doc}=await page({front:'v2',url:'http://local.test/v2/index.html?reviewActor=agent:codex#/write/s1?piece=o1'});
 const three=()=>doc.querySelector('.v2-top a[data-v2-v3]');
 assert.equal(three().textContent,'Version three');
 assert.equal(three().nextElementSibling,doc.querySelector('[data-v2-advanced]'),'beside Advanced');
 assert.equal(three().getAttribute('href'),'/v3/index.html?reviewActor=agent:codex#/write/s1?piece=o1');
 await goHash(w,'#/check/s1?piece=o2');
 three().dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
 assert.equal(three().getAttribute('href'),'/v3/index.html?reviewActor=agent:codex#/check/s1?piece=o2');
 assert.equal(doc.querySelectorAll('.v2-top a[data-v2-v3]').length,1);
});

test('the theme is one choice for both fronts',async()=>{
 const {doc}=await page({storage:{'ar-create-v2-theme':JSON.stringify({theme:'dark'})}});
 assert.equal(doc.documentElement.dataset.theme,'dark');
 doc.querySelector('[data-v2-theme]').click();
 assert.equal(doc.documentElement.dataset.theme,'light');
 assert.equal(JSON.parse(doc.defaultView.localStorage.getItem('ar-create-v2-theme')).theme,'light');
});

test('the frame\'s styles reach only the frame: every rule starts with a .v3- class',()=>{
 const css=read('public/v3/shell/frame.css').replace(/\/\*[\s\S]*?\*\//g,'');
 const selectors=[];
 // Rules inside @layer and @media blocks are read as plain rules; the blocks themselves carry no selector.
 for(const m of css.matchAll(/([^{}@;]+)\{[^{}]*\}/g)){const sel=m[1].trim();if(sel)selectors.push(...sel.split(',').map(s=>s.trim()));}
 assert.ok(selectors.length>20);
 for(const s of selectors)assert.match(s,/^(:root(\[data-theme="(light|dark)"\])?|(a|button)?\.v3-[\w-]+.*)$/,s);
 assert.doesNotMatch(css,/\.v2-(?!ic\b)|#v2-|\bbody\b|\bhtml\b/,'nothing aimed at version two\'s classes (only its icon, inside the frame), the body or the page');
});

test('the app\'s own address and /v3 open version three with the query kept; version two still opens at its own address; Advanced works as before',async()=>{
 const {base}=await theWorld();
 const get=(route,method='GET')=>fetch(base+route,{method,redirect:'manual'});
 for(const [route,location] of [['/','/v3/index.html'],['/?reviewActor=agent:codex','/v3/index.html?reviewActor=agent:codex'],['/v3','/v3/index.html'],['/v3?reviewActor=agent:claude-code','/v3/index.html?reviewActor=agent:claude-code']]){
  const r=await get(route);assert.equal(r.status,302,route);assert.equal(r.headers.get('location'),location,route);
 }
 const v3=await get('/v3/index.html');assert.equal(v3.status,200);assert.match(v3.headers.get('content-type'),/text\/html/);assert.match(await v3.text(),/shell\/frame\.js/);
 assert.doesNotMatch(v3.headers.get('content-security-policy'),/script-src[^;]*unsafe-inline/,'version three runs without inline scripts');
 assert.equal((await get('/v3/')).status,200);
 for(const file of ['/v3/shell/frame.js','/v3/shell/frame.css'])assert.equal((await get(file)).status,200,file);
 // Version two at its own address, as before.
 for(const [route,location] of [['/v2','/v2/index.html'],['/v2?reviewActor=agent:codex','/v2/index.html?reviewActor=agent:codex']]){
  const r=await get(route);assert.equal(r.status,302,route);assert.equal(r.headers.get('location'),location,route);
 }
 for(const route of ['/v2/index.html','/v2/','/v2/index.html?reviewActor=agent:claude-code']){
  const r=await get(route);assert.equal(r.status,200,route);assert.match(await r.text(),/shell\/shell\.js/,route);
 }
 for(const route of ['/document-study/index.html','/document-study/index.html?reviewActor=agent:claude-code','/document-study/index.html?subject=hk&section=write']){
  const r=await get(route);assert.equal(r.status,200,route);assert.match(r.headers.get('content-type'),/text\/html/,route);
 }
});

test('every version two screen opens and draws inside the frame against the real server, and a link drawn by a borrowed screen stays in version three',async()=>{
 const {base}=await theWorld();
 const standing=await (await fetch(base+'/api/subject/standing?parentStudyId=hk')).json();
 const piece=(standing.forms||[]).find(f=>f.kind==='article')?.id;
 const {w,doc,errors}=await page({url:base+'/v3/index.html#/',base});
 await until(()=>w.v2.route()?.id==='home'&&doc.getElementById('v2-main').children.length);
 const routes=[['home','#/'],['subject','#/subject/hk'],['research','#/research'],['research-group','#/research/group/none'],['research-topic','#/research/topic/none'],['looks','#/looks'],['slides','#/slides/none'],
  ['write','#/write/hk'+(piece?'?piece='+encodeURIComponent(piece):'')],['read','#/read/hk'+(piece?'?piece='+encodeURIComponent(piece):'')],['check','#/check/hk'+(piece?'?piece='+encodeURIComponent(piece):'')]];
 for(const [id,hash] of routes){
  await goHash(w,hash);
  await until(()=>w.v2.route()?.id===id&&doc.getElementById('v2-main').textContent.trim().length>0);
  await settle(300);
  assert.equal(w.v2.route().id,id,hash);
  assert.doesNotMatch(doc.getElementById('v2-main').textContent,/could not open/,hash);
  assert.ok(doc.querySelector('[data-v3-band]'),'the frame stays');
 }
 // From the borrowed subject page to a route it links to: a hash link, so it lands on a route inside version three.
 await goHash(w,'#/subject/hk');await until(()=>doc.querySelector('#v2-main a[href^="#/"]'));
 const link=[...doc.querySelectorAll('#v2-main a[href^="#/"]')].find(a=>/^#\/(write|read|check|slides)\//.test(a.getAttribute('href')))||doc.querySelector('#v2-main a[href^="#/"]');
 await goHash(w,link.getAttribute('href'));
 assert.equal(w.location.pathname,'/v3/index.html');
 assert.ok(w.v2.route(),'a version three route opened');
 assert.ok(doc.querySelector('[data-v3-band]'));
 assert.deepEqual(errors.filter(e=>!/Not implemented|scrollTo/.test(e)),[],'no errors in the console');
});
