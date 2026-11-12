/* Version three: the frame. The band (the top bar with its clear edge), the phone bar, the message area and the main
   area, in the approved look (design/2026-11-write/NOTES.md); the router on the address hash, the screen registry, the
   theme and the brand tint. It keeps version two's screen contract exactly (public/v2/README.md): the global is still
   called v2, with the same names, so version two's screen files run here unchanged. Version two's command client,
   shared parts and Capture are loaded from /v2/shell/ as they are; version two's own shell.js and its top bar are never
   loaded here. A screen version three has not built yet is version two's file, listed in public/v3/index.html; a route
   belongs to whichever file registered it, and two files may never claim one route. See public/v3/README.md. */
(function(root){
 'use strict';
 const doc=root.document,P=root.V2Parts,C=root.V2Client;
 const {esc,icon}=P;
 const client=C.createClient(),live=C.createLive();

 // ---------- the existing workspace (Advanced), and version two ----------
 const WORKSPACE='/document-study/index.html',VERSION_TWO='/v2/index.html';
 // The existing workspace's own section names (its rail), plus Read, which it shows as a view of Write.
 const SECTIONS=Object.freeze(['home','subjects','library','material','source','research','direction','write','read','check','media','arrange','audience','share','outputs']);
 const actorQuery=()=>client.explicit()&&client.actor()?'?reviewActor='+encodeURIComponent(client.actor()):'';
 /** The address of the matching place in the existing workspace for a subject, a piece (an output id) and a section. */
 function advanced({subject,piece,section}={}){
  const q=new URLSearchParams();
  if(typeof subject==='string'&&subject)q.set('subject',subject);
  if(typeof piece==='string'&&piece)q.set('piece',piece);
  if(typeof section==='string'&&SECTIONS.includes(section))q.set('section',section);
  if(client.explicit()&&client.actor())q.set('reviewActor',client.actor());
  const s=String(q);return WORKSPACE+(s?'?'+s:'');
 }
 /** The same place in version two: both fronts share the routes, so the subject, the piece and the section (write, read,
     check, slides...) carry as they are. The assistant's name carries too. */
 function versionTwo(){const here=String(root.location.hash||'');return VERSION_TWO+actorQuery()+(here&&here!=='#'&&here!=='#/'?here:'');}

 // Every hand-off to the existing workspace names the address he is leaving, so its way back returns there (the
 // workspace reads ?v2from=; both fronts share the routes). Added as the link is followed, never to advanced(). The
 // "Version two" link is refreshed the same way, so it names the place open at that moment.
 function markWay(e){
  const two=e.target?.closest?.('a[data-v3-two]');if(two){two.setAttribute('href',versionTwo());return;}
  const a=e.target?.closest?.('a[href^="'+WORKSPACE+'"]');if(!a)return;
  try{const url=new URL(a.getAttribute('href'),root.location.href);url.searchParams.delete('v2from');
   const here=String(root.location.hash||'').replace(/^#/,'');if(here&&here!=='/')url.searchParams.set('v2from',here);
   a.setAttribute('href',url.pathname+url.search+url.hash);}catch{}
 }
 for(const type of ['pointerdown','click','contextmenu','auxclick','focusin'])doc.addEventListener(type,markWay,true);
 doc.addEventListener('keydown',e=>{if(e.key==='Enter')markWay(e);},true);

 // ---------- theme: follows the system, unless he chose one ----------
 // The choice is kept under version two's key, so the two fronts show the same theme.
 const OWN_THEME='ar-create-v2-theme';
 const media=root.matchMedia?root.matchMedia('(prefers-color-scheme: dark)'):null;
 function chosenTheme(){let own=null;try{own=JSON.parse(root.localStorage.getItem(OWN_THEME)||'null');}catch{}
  if(own&&['dark','light'].includes(own.theme))return own.theme;
  return media?.matches?'dark':'light';}
 function applyTheme(){const theme=chosenTheme();doc.documentElement.dataset.theme=theme;paintTheme();applyBrand(brandId);return theme;}
 function toggleTheme(){const next=doc.documentElement.dataset.theme==='dark'?'light':'dark';try{root.localStorage.setItem(OWN_THEME,JSON.stringify({theme:next}));}catch{}doc.documentElement.dataset.theme=next;paintTheme();applyBrand(brandId);}
 media?.addEventListener?.('change',()=>applyTheme());
 root.addEventListener('storage',e=>{if(e.key===OWN_THEME)applyTheme();});

 // ---------- brand tint: the look's accent, for the screens (--v2-br, rings, current markers) ----------
 const looks=new Map();let brandId=null,brandToken=0;
 async function applyBrand(id){
  brandId=typeof id==='string'&&id?id:null;const token=++brandToken,html=doc.documentElement;
  if(!brandId){delete html.dataset.brand;html.style.removeProperty('--v2-brand');return;}
  try{
   if(!looks.has(brandId))looks.set(brandId,client.call('look',{id:brandId}));
   const look=await looks.get(brandId),theme=html.dataset.theme==='dark'?'dark':'light',accent=look?.roles?.[theme]?.accent||look?.roles?.dark?.accent;
   if(token!==brandToken)return;
   if(typeof accent==='string'&&/^#[0-9a-f]{3,8}$/i.test(accent)){html.dataset.brand=brandId;html.style.setProperty('--v2-brand',accent);}else{delete html.dataset.brand;html.style.removeProperty('--v2-brand');}
  }catch{looks.delete(brandId);if(token===brandToken){delete html.dataset.brand;html.style.removeProperty('--v2-brand');}}
 }

 // ---------- the screen registry and the router (the same rules as version two's) ----------
 const screens=[];let started=false,active=null,firstPaint=true;
 const compile=route=>{const parts=String(route||'').replace(/^#?\/?/,'').replace(/\/$/,'').split('/').filter(Boolean);return {parts,keys:parts.filter(p=>p.startsWith(':')).map(p=>p.slice(1))};};
 /** Register a screen. route: '' for Home, 'looks', 'subject/:id', 'research/topic/:id'. A second file that claims an
     id or a route already taken is refused, so one address is always one screen. */
 function screen(def){
  if(!def||typeof def.id!=='string'||!def.id||typeof def.render!=='function')throw new Error('A screen needs an id and a render function.');
  if(screens.some(s=>s.id===def.id))throw new Error('A screen called "'+def.id+'" is already registered.');
  const c=compile(def.route);
  if(screens.some(s=>s.pattern.parts.join('/')===c.parts.join('/')))throw new Error('Another screen already answers "'+def.route+'".');
  screens.push({...def,route:c.parts.join('/'),pattern:c});
  if(started&&!active)route();
 }
 function parse(hash=root.location.hash){
  const raw=String(hash||'').replace(/^#\/?/,'');const [path,search='']=raw.split('?');
  let parts;try{parts=path.split('/').filter(Boolean).map(decodeURIComponent);}catch{parts=[];}
  if(parts.length===1&&parts[0]==='home')parts=[];
  return {parts,query:Object.fromEntries(new URLSearchParams(search))};
 }
 function match(parts){
  for(const s of screens){const p=s.pattern.parts;if(p.length!==parts.length)continue;const params={};let ok=true;
   for(let i=0;i<p.length;i++){if(p[i].startsWith(':'))params[p[i].slice(1)]=parts[i];else if(p[i]!==parts[i]){ok=false;break;}}
   if(ok)return {screen:s,params};}
  return null;
 }
 /** The address of a route, e.g. href('subject/:id', {id}) or href('research'). */
 function href(route='',params={},query=null){
  const path=compile(route).parts.map(p=>p.startsWith(':')?encodeURIComponent(params[p.slice(1)]??''):p).join('/');
  const q=query?new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined&&v!==null&&v!=='')):null;
  return '#/'+path+(q&&String(q)?'?'+q:'');
 }
 const go=(route,params,query)=>{root.location.hash=href(route,params,query);};
 const main=()=>doc.getElementById('v2-main');

 function leave(){
  if(!active)return;const {screen:s,ctx}=active;active=null;
  ctx.controller.abort();for(const off of ctx.offs.splice(0))try{off();}catch{}
  try{s.unmount?.(main(),ctx);}catch(error){console.error('Version three: the '+s.id+' screen could not close cleanly.',error);}
 }
 async function route(){
  if(!screens.length)return;
  const {parts,query}=parse(),found=match(parts);
  if(found)return show(found.screen,found.params,query,parts);
  // An unknown route goes Home; replacing the address fires hashchange, which routes again.
  if(root.location.hash!=='#/'){root.location.replace('#/');return;}
  const home=match([]);if(home)return show(home.screen,home.params,query,[]);
 }
 async function show(s,params,query,parts){
  leave();
  const el=main(),controller=new AbortController(),offs=[];
  const ctx={id:s.id,params,query,path:parts.join('/'),el,signal:controller.signal,controller,offs,advancedTarget:null,
   on:(filter,fn)=>{const off=live.on(filter,fn);offs.push(off);return off;},
   setTitle:text=>{if(active?.ctx===ctx){ctx.title=String(text||'');paintPlace();}},
   setAdvanced:target=>{if(active?.ctx===ctx){ctx.advancedTarget=target||null;paintPlace();}}};
  ctx.title=typeof s.title==='function'?safe(()=>s.title(ctx),''):(s.title||'');
  active={screen:s,ctx};
  let body;try{body=s.render(ctx);}catch(error){console.error(error);body=`<div class="v2-page"><p class="v2-msg" data-tone="bad">This screen could not open. Nothing was changed.</p></div>`;}
  if(body&&typeof body==='object'&&'nodeType' in body)el.replaceChildren(body);else el.innerHTML=String(body??'');
  applyBrand(typeof s.brand==='function'?safe(()=>s.brand(ctx),null):(s.brand||null));
  paintPlace();
  if(!firstPaint){root.scrollTo?.(0,0);el.focus({preventScroll:true});}firstPaint=false;
  try{await s.mount?.(el,ctx);}catch(error){console.error('Version three: the '+s.id+' screen could not finish opening.',error);}
 }
 const safe=(fn,fallback)=>{try{return fn();}catch{return fallback;}};

 // ---------- the frame ----------
 // The band and the phone bar sit outside #v2-app, so version two's frame rules (shell.css) never reach them; the
 // message area and the main area sit inside it, exactly where version two's screens expect them.
 function frameMarkup(){
  return `<a class="v3-skip" href="#v2-main" data-v2-skip>Skip to the work</a>
<header class="v3-band" data-v3-band>
 <a class="v3-logo" href="#/" aria-label="Home"><i></i></a>
 <nav class="v3-places" aria-label="Places">
  <a class="v3-place" data-v3-place="home" href="#/">Home</a><a class="v3-place" data-v3-place="research" href="#/research">Research</a><a class="v3-place" data-v3-place="looks" href="#/looks">Looks</a><a class="v3-place" data-v3-place="library" href="${esc(advanced({section:'library'}))}">Library</a>
 </nav>
 <nav class="v3-desk" data-v2-desk aria-label="On your desk" hidden></nav>
 <span class="v3-grow"></span>
 <button type="button" class="v3-q v3-wide" data-v2-ask aria-label="Find" title="Find a subject, or words in the Library">${icon('search')}<kbd>⌘K</kbd></button>
 <a class="v3-q v3-wide v3-needs" data-v2-needs href="#/" hidden><i aria-hidden="true"></i><span>Needs you · <b data-v2-needs-count>0</b></span></a>
 <button type="button" class="v3-q v3-wide" data-v2-capture>${icon('plus')}<span>Capture</span></button>
 <button type="button" class="v3-q v3-icon" data-v2-theme aria-label="Switch theme">${icon('sun')}</button>
 <a class="v3-q v3-other" data-v3-two href="${esc(versionTwo())}" title="The same place in version two">Version two</a>
 <a class="v3-q v3-other" data-v2-advanced href="${esc(advanced())}" title="The same place in the existing workspace">Advanced</a>
</header>
<div id="v2-app" class="v3-app">
 <div class="v2-messages" id="v2-messages" role="status" aria-live="polite"></div>
 <main class="v2-main" id="v2-main" tabindex="-1"></main>
</div>
<nav class="v3-phone" data-v3-phone aria-label="Places">
 <a class="v3-pq" href="#/" data-v3-place="home">${icon('home')}<span>Home</span></a>
 <a class="v3-pq" href="#/research" data-v3-place="research">${icon('search')}<span>Research</span></a>
 <button type="button" class="v3-pq" data-v2-capture>${icon('plus')}<span>Capture</span></button>
 <a class="v3-pq" href="#/" data-v2-needs-phone>${icon('ask')}<span>Needs you</span><em data-v2-needs-badge hidden></em></a>
</nav>`;
 }
 function paintTheme(){const b=doc.querySelector('[data-v2-theme]');if(!b)return;const dark=doc.documentElement.dataset.theme==='dark';b.innerHTML=icon(dark?'sun':'moon');b.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');b.title=dark?'Light theme':'Dark theme';}
 function placeOf(){if(!active)return '';const r=active.screen.route;if(r==='')return 'home';if(r==='research'||r.startsWith('research/'))return 'research';if(r==='looks')return 'looks';return '';}
 function paintPlace(){
  const place=placeOf();
  for(const a of doc.querySelectorAll('[data-v3-place]')){if(a.dataset.v3Place===place)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  const ctx=active?.ctx;
  const target=ctx?.advancedTarget||(active?.screen.route.startsWith('subject/')&&ctx?.params.id?{subject:ctx.params.id}:{});
  const adv=doc.querySelector('[data-v2-advanced]');if(adv)adv.href=advanced(target);
  const two=doc.querySelector('[data-v3-two]');if(two)two.href=versionTwo();
  doc.title=(ctx?.title?ctx.title+' · ':'')+'AR Create';
  paintDesk();
 }

 // ---------- On your desk: the subjects in hand, in the band on a computer ----------
 let desk=[],deskSource=null,deskToken=0;
 async function defaultDesk(){
  const [places,catalog]=await Promise.all([client.call('subject-places',{}),client.call('study-draft.catalog',{}).catch(()=>null)]);
  const names=new Map();for(const row of [...(catalog?.collections||[]),...(catalog?.drafts||[])])for(const key of [row?.parentStudyId,row?.parentStudyKey])if(key&&row.title&&!names.has(key))names.set(key,row.title);
  return (places?.places||[]).filter(p=>p.pinnedAt&&!p.archived).sort((a,b)=>(a.order??1e9)-(b.order??1e9)||String(a.pinnedAt).localeCompare(String(b.pinnedAt))).slice(0,5)
   .map(p=>({id:p.parentStudyId,title:names.get(p.parentStudyId)||p.parentStudyId}));
 }
 function oneAtATime(fn){let running=null,again=false;const run=()=>{if(running){again=true;return running;}running=(async()=>{try{await fn();}finally{running=null;}if(again){again=false;await run();}})();return running;};return run;}
 const readDesk=async()=>{const token=++deskToken;try{const items=await (deskSource||defaultDesk)();if(token!==deskToken)return;desk=Array.isArray(items)?items.filter(i=>i&&typeof i.id==='string').slice(0,5):[];}catch{if(token===deskToken)desk=[];}paintDesk();};
 const refreshDesk=oneAtATime(readDesk);
 function paintDesk(){
  const nav=doc.querySelector('[data-v2-desk]');if(!nav)return;nav.hidden=!desk.length;
  const current=active?.screen.route.startsWith('subject/')?active.ctx.params.id:null;
  nav.innerHTML=desk.map(d=>`<a class="v3-chip" href="${esc(href('subject/:id',{id:d.id}))}" title="${esc(d.title)}"${d.id===current?' aria-current="page"':''}>${d.cover?`<img src="${esc(d.cover)}" alt="">`:'<i aria-hidden="true"></i>'}<span>${esc(d.short||d.title)}</span></a>`).join('')
   +'<button type="button" class="v3-q v3-more" data-v2-desk-more hidden></button>';
  fitDesk();
 }
 // The desk keeps whole chips on one line: those that do not fit are taken out (hidden, so nothing invisible can take
 // focus), the subject open now last of all, and a quiet "+n" opens the rest.
 function fitDesk(){
  const nav=doc.querySelector('[data-v2-desk]');if(!nav||nav.hidden)return;
  const chips=[...nav.querySelectorAll('.v3-chip')],more=nav.querySelector('[data-v2-desk-more]');if(!more)return;
  chips.forEach(c=>{c.hidden=false;});more.hidden=true;
  if(root.getComputedStyle(nav).display==='none')return;
  const over=()=>nav.scrollWidth>nav.clientWidth+1;
  if(!over())return;
  more.hidden=false;more.textContent='+'+chips.length;
  const order=chips.slice().reverse().sort((a,b)=>(a.hasAttribute('aria-current')?1:0)-(b.hasAttribute('aria-current')?1:0));
  for(const c of order){if(!over())break;c.hidden=true;more.textContent='+'+chips.filter(x=>x.hidden).length;}
  const n=chips.filter(c=>c.hidden).length;
  if(!n){more.hidden=true;return;}
  more.textContent='+'+n;more.setAttribute('aria-label',`${n} more on your desk`);more.title=`${n} more on your desk`;
 }
 function deskSheet(){
  const nav=doc.querySelector('[data-v2-desk]'),rest=[...(nav?.querySelectorAll('.v3-chip[hidden]')||[])];
  const list=doc.createElement('ul');list.className='v2-desk-list';
  for(const c of rest){const li=doc.createElement('li'),a=doc.createElement('a');a.href=c.getAttribute('href');a.textContent=c.title;li.append(a);list.append(li);}
  const s=P.sheet({title:'On your desk',body:list});list.addEventListener('click',e=>{if(e.target.closest('a'))s.close();});
 }

 // ---------- Needs you: the count ----------
 let needs=0;
 const refreshNeeds=oneAtATime(readNeeds);
 async function readNeeds(){try{const r=await client.call('needs-you',{status:'open'});needs=Number(r?.counts?.open??r?.asks?.length??0)||0;}catch{needs=0;}
  const a=doc.querySelector('[data-v2-needs]');if(a){a.hidden=!needs;a.querySelector('[data-v2-needs-count]').textContent=String(needs);a.setAttribute('aria-label',`Needs you: ${needs}`);}
  const badge=doc.querySelector('[data-v2-needs-badge]');if(badge){badge.hidden=!needs;badge.textContent=String(needs);}
  const phone=doc.querySelector('[data-v2-needs-phone]');phone?.setAttribute('aria-label',needs?`Needs you: ${needs}`:'Needs you');}

 // ---------- Find: subjects by name and the words in the Library (version two's sheet, as it is) ----------
 let findSheet=null;
 const plain=text=>String(text??'').normalize('NFKC').trim().toLocaleLowerCase();
 const snippet=(r,n=150)=>{
  let t=String(r?.quote||'');const c=String(r?.context||''),i=c.indexOf(t);
  if(i>0&&/[\p{L}\p{N}]/u.test(c[i-1]))t=t.replace(/^\S*\s*/,'');
  t=t.replace(/\s+/g,' ').replace(/^[\s"'“”‘’.,;:\-–)\]]+/,'').replace(/[\s,;:\-–(\[]+$/,'');
  return t.length>n?t.slice(0,n-1).trimEnd()+'…':t;};
 function openFind(){
  if(findSheet?.el?.isConnected){findSheet.el.querySelector('[name=q]')?.focus();return findSheet;}
  const body=doc.createElement('div');
  body.innerHTML=`<form class="v2-find" role="search"><div class="v2-find-box">${icon('search')}<input name="q" type="search" autocomplete="off" maxlength="256" aria-label="Find a subject, or words in the Library" placeholder="A subject, or words in the Library"><button class="pri" type="submit">Find</button></div><p class="v2-find-note">Finds subjects by their names and the exact words in your Library. It cannot answer questions yet.</p><div class="v2-find-out" data-v2-find-out aria-live="polite"></div></form>`;
  const sheet=P.sheet({title:'Find',body,onClose:()=>{findSheet=null;}});sheet.el.dataset.v2Find='';findSheet=sheet;
  const form=body.querySelector('form'),out=body.querySelector('[data-v2-find-out]'),input=form.elements.q;let run=0,subjects=null;
  body.addEventListener('click',e=>{if(e.target.closest('a'))sheet.close();});
  form.addEventListener('submit',async e=>{
   e.preventDefault();const query=input.value.trim();if(!query)return;const mine=++run;
   out.innerHTML='<p class="v2-find-meta">Looking…</p>';
   const [subjectsRead,wordsRead]=await Promise.allSettled([
    subjects?Promise.resolve(subjects):client.call('subjects.standing',{}).then(r=>subjects=(r?.subjects||[]).filter(x=>x&&typeof x.id==='string'&&x.id&&!x.archived)),
    client.call('concept.sources.search',{query})]);
   if(mine!==run||!out.isConnected)return;
   const want=plain(query),named=subjectsRead.status==='fulfilled'?subjectsRead.value.filter(x=>plain(x.title||'').includes(want)).slice(0,8):[];
   const seen=new Set(),items=wordsRead.status==='fulfilled'?(wordsRead.value?.results||[]).filter(r=>r&&r.sourceId&&!seen.has(r.sourceId)&&seen.add(r.sourceId)).slice(0,8):[];
   const parts=[];
   if(named.length)parts.push(`<section><h3>Subjects</h3><ul data-v2-find-subject>${named.map(x=>`<li><a href="${esc(href('subject/:id',{id:x.id}))}">${esc(String(x.title||'').trim()||'Untitled subject')}</a></li>`).join('')}</ul></section>`);
   if(items.length)parts.push(`<section><h3>In the Library</h3><ul data-v2-find-item>${items.map(r=>`<li><a href="${esc(advanced({section:'library'}))}"><b>${esc(r.title||'Untitled')}</b>${snippet(r)?`<small>${esc(snippet(r))}</small>`:''}</a></li>`).join('')}</ul><p class="v2-find-meta">Opens the Library in Advanced.${wordsRead.value?.truncated?' More of the Library was not looked through.':''}</p></section>`);
   if(wordsRead.status==='rejected')parts.push(`<p class="v2-find-meta" data-tone="bad">The app could not search the Library. ${esc(wordsRead.reason?.message||'')}</p>`);
   if(subjectsRead.status==='rejected')parts.push(`<p class="v2-find-meta" data-tone="bad">The app could not read your subjects. ${esc(subjectsRead.reason?.message||'')}</p>`);
   if(!named.length&&!items.length&&wordsRead.status==='fulfilled'&&subjectsRead.status==='fulfilled')parts.push(`<p class="v2-find-meta">Nothing found for "${esc(query)}".</p>`);
   out.innerHTML=parts.join('');
  });
  input.focus();
  return sheet;
 }

 // ---------- Capture: version two's sheet (public/v2/shell/capture.js), unchanged ----------
 const capture=root.V2Capture.create({
  call:(name,input,options)=>client.call(name,input,options),isHuman:()=>client.isHuman(),
  advanced,href,expect:record=>({expectedRevision:record?.revision??0,...(typeof record?.hash==='string'?{expectedHash:record.hash}:{})}),
 });
 function openCapture(options={}){return capture.open(options);}
 function captureHere(){
  const route=active?.screen.route||'',id=active?.ctx.params.id;
  const here=['subject/','write/','read/','check/'].some(start=>route.startsWith(start))&&typeof id==='string'&&id;
  return openCapture({subject:here?{id,name:active.ctx.title||''}:null});
 }

 // ---------- start ----------
 let startedAt=0;
 function start(){
  if(started)return;started=true;startedAt=Date.now();
  const host=doc.getElementById('v3-frame')||doc.body;host.innerHTML=frameMarkup();
  applyTheme();
  host.addEventListener('click',e=>{
   if(e.target.closest('[data-v2-theme]'))return toggleTheme();
   if(e.target.closest('[data-v2-capture]'))return captureHere();
   if(e.target.closest('[data-v2-ask]'))return openFind();
   if(e.target.closest('[data-v2-desk-more]'))return deskSheet();
   if(e.target.closest('[data-v2-skip]')){e.preventDefault();main()?.focus();}
  });
  root.addEventListener('hashchange',()=>{route();const two=doc.querySelector('[data-v3-two]');if(two)two.href=versionTwo();});
  doc.addEventListener('keydown',e=>{if(e.key?.toLowerCase()!=='k'||!(e.metaKey||e.ctrlKey)||e.altKey||e.shiftKey)return;if(doc.querySelector('dialog[open]:not([data-v2-find])'))return;e.preventDefault();openFind();});
  let fitting=0;const refit=()=>{root.cancelAnimationFrame?.(fitting);fitting=root.requestAnimationFrame?root.requestAnimationFrame(fitDesk):setTimeout(fitDesk,0);};
  if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(refit);ro.observe(doc.querySelector('[data-v3-band]'));ro.observe(doc.querySelector('.v3-grow'));}else root.addEventListener('resize',refit);
  doc.fonts?.ready?.then(refit);
  live.on({kinds:['needs-you*']},e=>{if(!e?.reset)refreshNeeds();});
  live.on({kinds:['subject-places*','study-draft*','concept*']},e=>{if(!e?.reset)refreshDesk();});
  live.on({},e=>{if(e.reset&&Date.now()-startedAt>3000){refreshNeeds();refreshDesk();}});
  if(!client.actor())P.say('This page was opened with an assistant name the app does not know, so nothing can be read or changed. Open it again with a listed name.',{tone:'bad'});
  refreshNeeds();refreshDesk();route();
 }

 // The screen contract, name for name as version two's shell gives it (public/v2/README.md).
 const v2=Object.freeze({
  version:1,
  screen,href,go,route:()=>active?{id:active.screen.id,params:{...active.ctx.params},query:{...active.ctx.query},path:active.ctx.path}:null,
  screens:()=>screens.map(s=>({id:s.id,route:s.route})),
  call:(name,input,options)=>client.call(name,input,options),
  on:(filter,fn)=>live.on(filter,fn),
  expect:record=>({expectedRevision:record?.revision??0,...(typeof record?.hash==='string'?{expectedHash:record.hash}:{})}),
  actor:()=>client.actor(),isHuman:()=>client.isHuman(),actorName:C.actorName,Error:C.V2Error,
  capture:options=>openCapture(options),find:()=>openFind(),advanced,brand:id=>applyBrand(id),theme:()=>doc.documentElement.dataset.theme,
  desk:Object.freeze({refresh:refreshDesk,use:source=>{deskSource=typeof source==='function'?source:null;return refreshDesk();},list:()=>desk.map(d=>({...d}))}),
  needs:Object.freeze({refresh:refreshNeeds,count:()=>needs}),
  shared:{},
  ui:Object.freeze({ring:P.ring,step:P.step,notBuilt:P.notBuilt,sheet:P.sheet,say:P.say,undo:P.undo,reorder:P.reorder,icon:P.icon,esc:P.esc}),
 });
 // Version three's own ways out, for its tests and the review scripts: where "Version two" leads from here.
 root.v3Frame=Object.freeze({versionTwo,front:'v3'});
 root.v2=v2;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);else setTimeout(start,0);
})(window);
