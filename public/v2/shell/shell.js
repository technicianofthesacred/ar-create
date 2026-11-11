/* Version two: the shell. The frame every screen lives in (top bar, phone bar, the thin header on a phone, the message
   area), the router on the address hash, the screen registry, the theme and the brand tint. Screens add themselves
   with v2.screen({...}) from their own file and draw only inside the frame's main area. See public/v2/README.md. */
(function(root){
 'use strict';
 const doc=root.document,P=root.V2Parts,C=root.V2Client;
 const {esc,icon}=P;
 const client=C.createClient(),live=C.createLive();

 // ---------- the existing workspace (Advanced) ----------
 const WORKSPACE='/document-study/index.html';
 // The existing workspace's own section names (its rail), plus Read, which it shows as a view of Write.
 const SECTIONS=Object.freeze(['home','subjects','library','material','source','research','direction','write','read','check','media','arrange','audience','share','outputs']);
 /** The address of the matching place in the existing workspace for a subject, a piece (an output id) and a section. */
 function advanced({subject,piece,section}={}){
  const q=new URLSearchParams();
  if(typeof subject==='string'&&subject)q.set('subject',subject);
  if(typeof piece==='string'&&piece)q.set('piece',piece);
  if(typeof section==='string'&&SECTIONS.includes(section))q.set('section',section);
  if(client.explicit()&&client.actor())q.set('reviewActor',client.actor());
  const s=String(q);return WORKSPACE+(s?'?'+s:'');
 }

 // Every hand-off to the existing workspace names the version two address he is leaving, so its "Version two" link can
 // return there. It is added as the link is followed (the address changes after the link is drawn), never to advanced().
 function markWay(e){
  const a=e.target?.closest?.('a[href^="'+WORKSPACE+'"]');if(!a)return;
  try{const url=new URL(a.getAttribute('href'),root.location.href);url.searchParams.delete('v2from');
   const here=String(root.location.hash||'').replace(/^#/,'');if(here&&here!=='/')url.searchParams.set('v2from',here);
   a.setAttribute('href',url.pathname+url.search+url.hash);}catch{}
 }
 for(const type of ['pointerdown','click','contextmenu','auxclick','focusin'])doc.addEventListener(type,markWay,true);
 doc.addEventListener('keydown',e=>{if(e.key==='Enter')markWay(e);},true);

 // ---------- theme: follows the system, unless he chose one with the theme button ----------
 // A choice made with the theme button is kept in this page's own key and wins from then on. Until he makes one, the
 // page follows the system setting, as the sample does. (The existing workspace keeps its own theme inside its browser
 // recovery copy and stores "dark" there by default, so it is no sign of a choice and is not read.)
 const OWN_THEME='ar-create-v2-theme';
 const media=root.matchMedia?root.matchMedia('(prefers-color-scheme: dark)'):null;
 function chosenTheme(){let own=null;try{own=JSON.parse(root.localStorage.getItem(OWN_THEME)||'null');}catch{}
  if(own&&['dark','light'].includes(own.theme))return own.theme;
  return media?.matches?'dark':'light';}
 function applyTheme(){const theme=chosenTheme();doc.documentElement.dataset.theme=theme;paintTheme();applyBrand(brandId);return theme;}
 function toggleTheme(){const next=doc.documentElement.dataset.theme==='dark'?'light':'dark';try{root.localStorage.setItem(OWN_THEME,JSON.stringify({theme:next}));}catch{}doc.documentElement.dataset.theme=next;paintTheme();applyBrand(brandId);}
 media?.addEventListener?.('change',()=>applyTheme());
 root.addEventListener('storage',e=>{if(e.key===OWN_THEME)applyTheme();});

 // ---------- brand tint: the look's accent on the top bar line, rings and current markers ----------
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

 // ---------- the screen registry and the router ----------
 const screens=[];let started=false,active=null,firstPaint=true;
 const compile=route=>{const parts=String(route||'').replace(/^#?\/?/,'').replace(/\/$/,'').split('/').filter(Boolean);return {parts,keys:parts.filter(p=>p.startsWith(':')).map(p=>p.slice(1))};};
 /** Register a screen. route: '' for Home, 'looks', 'subject/:id', 'research/topic/:id'. render(ctx) returns markup or
     a node for the main area; mount(el, ctx) runs after it is on screen; unmount(el, ctx) before it leaves. title is
     text or ctx => text; brand is a look id or ctx => look id (or null). */
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
  try{s.unmount?.(main(),ctx);}catch(error){console.error('Version two: the '+s.id+' screen could not close cleanly.',error);}
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
   /** Hear changes while this screen is open; stops by itself when the screen closes. */
   on:(filter,fn)=>{const off=live.on(filter,fn);offs.push(off);return off;},
   /** The name in the thin header on a phone and in the window title. */
   setTitle:text=>{if(active?.ctx===ctx){ctx.title=String(text||'');paintPlace();}},
   /** Where this screen's own "Open in Advanced" leads: {subject, piece, section}. The top bar's Advanced link opens it. */
   setAdvanced:target=>{if(active?.ctx===ctx){ctx.advancedTarget=target||null;paintPlace();}}};
  ctx.title=typeof s.title==='function'?safe(()=>s.title(ctx),''):(s.title||'');
  active={screen:s,ctx};
  let body;try{body=s.render(ctx);}catch(error){console.error(error);body=`<div class="v2-page"><p class="v2-msg" data-tone="bad">This screen could not open. Nothing was changed.</p></div>`;}
  if(body&&typeof body==='object'&&'nodeType' in body)el.replaceChildren(body);else el.innerHTML=String(body??'');
  applyBrand(typeof s.brand==='function'?safe(()=>s.brand(ctx),null):(s.brand||null));
  paintPlace();
  if(!firstPaint){root.scrollTo?.(0,0);el.focus({preventScroll:true});}firstPaint=false;
  try{await s.mount?.(el,ctx);}catch(error){console.error('Version two: the '+s.id+' screen could not finish opening.',error);}
 }
 const safe=(fn,fallback)=>{try{return fn();}catch{return fallback;}};

 // ---------- the frame ----------
  function frameMarkup(){
  return `<a class="v2-skip" href="#v2-main" data-v2-skip>Skip to the work</a>
<header class="v2-top" data-v2-top>
 <a class="v2-logo" href="#/" aria-label="Home"><i></i></a>
 <nav class="v2-places" aria-label="Places">
  <a class="v2-place" data-v2-place="home" href="#/">Home</a><a class="v2-place" data-v2-place="research" href="#/research">Research</a><a class="v2-place" data-v2-place="looks" href="#/looks">Looks</a><a class="v2-place" data-v2-place="library" href="${esc(advanced({section:'library'}))}">Library</a>
 </nav>
 <nav class="v2-desk" data-v2-desk aria-label="On your desk" hidden></nav>
 <span class="v2-grow"></span>
 <button type="button" class="v2-ghost v2-wide" data-v2-ask aria-label="Ask or find" title="Ask or find: opens Research">${icon('search')}<kbd>⌘K</kbd></button>
 <a class="v2-ghost v2-wide v2-needs" data-v2-needs href="#/" hidden><i aria-hidden="true"></i><span>Needs you · <b data-v2-needs-count>0</b></span></a>
 <button type="button" class="v2-ghost v2-wide" data-v2-capture>${icon('plus')}Capture</button>
 <button type="button" class="v2-ghost v2-icon-btn" data-v2-theme aria-label="Switch theme">${icon('sun')}</button>
 <a class="v2-advanced" data-v2-advanced href="${esc(advanced())}">Advanced</a>
</header>
<div class="v2-messages" id="v2-messages" role="status" aria-live="polite"></div>
<main class="v2-main" id="v2-main" tabindex="-1"></main>
<nav class="v2-phone" data-v2-phone aria-label="Places">
 <a href="#/" data-v2-place="home">${icon('home')}<span>Home</span></a>
 <a href="#/research" data-v2-place="research">${icon('search')}<span>Research</span></a>
 <button type="button" class="v2-cap" data-v2-capture>${icon('plus')}<span>Capture</span></button>
 <a href="#/" data-v2-needs-phone>${icon('ask')}<span>Needs you</span><em data-v2-needs-badge hidden></em></a>
</nav>`;
 }
 function paintTheme(){const b=doc.querySelector('[data-v2-theme]');if(!b)return;const dark=doc.documentElement.dataset.theme==='dark';b.innerHTML=icon(dark?'sun':'moon');b.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');b.title=dark?'Light theme':'Dark theme';}
 function placeOf(){if(!active)return '';const r=active.screen.route;if(r==='')return 'home';if(r==='research'||r.startsWith('research/'))return 'research';if(r==='looks')return 'looks';return '';}
 function paintPlace(){
  const place=placeOf();
  for(const a of doc.querySelectorAll('[data-v2-place]')){if(a.dataset.v2Place===place)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  const ctx=active?.ctx;
  const target=ctx?.advancedTarget||(active?.screen.route.startsWith('subject/')&&ctx?.params.id?{subject:ctx.params.id}:{});
  const adv=doc.querySelector('[data-v2-advanced]');if(adv)adv.href=advanced(target);
  doc.title=(ctx?.title?ctx.title+' · ':'')+'AR Create';
  paintDesk();
 }

 // ---------- On your desk: the subjects in hand, in the top bar on every screen ----------
 // A subject is on the desk when its saved place is pinned (subject-places). Its name comes from the saved
 // collections and drafts (study-draft.catalog). Home may give a fuller source with v2.desk.use(async () => items).
 let desk=[],deskSource=null,deskToken=0;
 async function defaultDesk(){
  const [places,catalog]=await Promise.all([client.call('subject-places',{}),client.call('study-draft.catalog',{}).catch(()=>null)]);
  const names=new Map();for(const row of [...(catalog?.collections||[]),...(catalog?.drafts||[])])for(const key of [row?.parentStudyId,row?.parentStudyKey])if(key&&row.title&&!names.has(key))names.set(key,row.title);
  return (places?.places||[]).filter(p=>p.pinnedAt&&!p.archived).sort((a,b)=>(a.order??1e9)-(b.order??1e9)||String(a.pinnedAt).localeCompare(String(b.pinnedAt))).slice(0,5)
   .map(p=>({id:p.parentStudyId,title:names.get(p.parentStudyId)||p.parentStudyId}));
 }
 async function refreshDesk(){const token=++deskToken;try{const items=await (deskSource||defaultDesk)();if(token!==deskToken)return;desk=Array.isArray(items)?items.filter(i=>i&&typeof i.id==='string').slice(0,5):[];}catch{if(token===deskToken)desk=[];}paintDesk();}
 function paintDesk(){
  const nav=doc.querySelector('[data-v2-desk]');if(!nav)return;nav.hidden=!desk.length;
  const current=active?.screen.route.startsWith('subject/')?active.ctx.params.id:null;
  nav.innerHTML=desk.map(d=>`<a class="v2-desk-chip" href="${esc(href('subject/:id',{id:d.id}))}" title="${esc(d.title)}"${d.id===current?' aria-current="page"':''}>${d.cover?`<img src="${esc(d.cover)}" alt="">`:'<i aria-hidden="true"></i>'}<span>${esc(d.short||d.title)}</span></a>`).join('')
   +'<button type="button" class="v2-ghost v2-desk-more" data-v2-desk-more hidden></button>';
  fitDesk();
 }
 // The desk keeps to one row. Chips shrink to a sensible width; those that still do not fit are taken out (hidden, so
 // nothing invisible can take focus), the subject open now last of all, and a quiet "+n" opens the rest.
 const DESK_MIN=104;
 function fitDesk(){
  const nav=doc.querySelector('[data-v2-desk]');if(!nav||nav.hidden)return;
  const chips=[...nav.querySelectorAll('.v2-desk-chip')],more=nav.querySelector('[data-v2-desk-more]');if(!more)return;
  chips.forEach(c=>{c.hidden=false;});more.hidden=true;
  if(root.getComputedStyle(nav).display==='none')return;
  // A chip may shrink to DESK_MIN, or to its whole name when that is shorter.
  for(const c of chips){const name=c.querySelector('span');c.style.minWidth=Math.min(DESK_MIN,(name?.scrollWidth||0)+46)+'px';}
  const over=()=>nav.scrollWidth>nav.clientWidth+1;
  if(!over())return;
  more.hidden=false;
  const order=chips.slice().reverse().sort((a,b)=>(a.hasAttribute('aria-current')?1:0)-(b.hasAttribute('aria-current')?1:0));
  for(const c of order){if(!over())break;c.hidden=true;}
  const n=chips.filter(c=>c.hidden).length;
  if(!n){more.hidden=true;return;}
  more.textContent='+'+n;more.setAttribute('aria-label',`${n} more on your desk`);more.title=`${n} more on your desk`;
 }
 function deskSheet(){
  const nav=doc.querySelector('[data-v2-desk]'),rest=[...(nav?.querySelectorAll('.v2-desk-chip[hidden]')||[])];
  const list=doc.createElement('ul');list.className='v2-desk-list';
  for(const c of rest){const li=doc.createElement('li'),a=doc.createElement('a');a.href=c.getAttribute('href');a.textContent=c.title;li.append(a);list.append(li);}
  const s=P.sheet({title:'On your desk',body:list});list.addEventListener('click',e=>{if(e.target.closest('a'))s.close();});
 }

 // ---------- Needs you: the count ----------
 let needs=0;
 async function refreshNeeds(){try{const r=await client.call('needs-you',{status:'open'});needs=Number(r?.counts?.open??r?.asks?.length??0)||0;}catch{needs=0;}
  const a=doc.querySelector('[data-v2-needs]');if(a){a.hidden=!needs;a.querySelector('[data-v2-needs-count]').textContent=String(needs);a.setAttribute('aria-label',`Needs you: ${needs}`);}
  const badge=doc.querySelector('[data-v2-needs-badge]');if(badge){badge.hidden=!needs;badge.textContent=String(needs);}
  const phone=doc.querySelector('[data-v2-needs-phone]');phone?.setAttribute('aria-label',needs?`Needs you: ${needs}`:'Needs you');}

 // ---------- Capture: the sample's sheet with four tiles ----------
 // Speak, Photograph and Write a thought have no capture back end in version two, so each opens the place where
 // material is added in the existing workspace (Advanced). A question goes to Research. Nothing is saved here.
 function captureSheet(){
  const inSubject=!!active?.screen.route.startsWith('subject/')&&active.ctx.params.id,subject=inSubject?active.ctx.params.id:null;
  const name=inSubject&&active.ctx.title?active.ctx.title:'';
  const where=advanced({...(subject?{subject}:{}),section:'material'});
  const to=name?`Goes to <b>${esc(name)}</b>. A question goes to Research.`:'Opens the place for new material, to file later. A question goes to Research.';
  const tile=(cls,ic,label,href,attr='')=>`<a class="${cls}" href="${esc(href)}"${attr}>${icon(ic)}${label}</a>`;
  const body=`<p class="v2-cap-to">${to}</p><div class="v2-cap4">${tile('rec','mic','Speak',where)}${tile('','photo','Photograph',where)}${tile('','pen','Write a thought',where)}${tile('','ask','Ask a question','#/research',' data-v2-cap-ask')}</div>`;
  const sh=P.sheet({title:'Capture',body,close:false});
  sh.el.addEventListener('click',e=>{if(e.target.closest('.v2-cap4 a'))sh.close();});
 }

 // ---------- start ----------
 function start(){
  if(started)return;started=true;
  const host=doc.getElementById('v2-app')||doc.body;host.innerHTML=frameMarkup();
  applyTheme();
  host.addEventListener('click',e=>{
   if(e.target.closest('[data-v2-theme]'))return toggleTheme();
   if(e.target.closest('[data-v2-capture]'))return captureSheet();
   if(e.target.closest('[data-v2-ask]'))return go('research');
   if(e.target.closest('[data-v2-desk-more]'))return deskSheet();
   if(e.target.closest('[data-v2-skip]')){e.preventDefault();main()?.focus();}
  });
  root.addEventListener('hashchange',()=>route());
  // Fit the desk again when the bar changes width (a window resized, fonts arrived).
  let fitting=0;const refit=()=>{root.cancelAnimationFrame?.(fitting);fitting=root.requestAnimationFrame?root.requestAnimationFrame(fitDesk):setTimeout(fitDesk,0);};
  // The spacer changes width whenever anything else in the bar does (the Needs you count appears, a font arrives).
  if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(refit);ro.observe(doc.querySelector('[data-v2-top]'));ro.observe(doc.querySelector('.v2-grow'));}else root.addEventListener('resize',refit);
  doc.fonts?.ready?.then(refit);
  live.on({kinds:['needs-you*']},()=>refreshNeeds());
  live.on({kinds:['subject-places*','study-draft*','concept*']},()=>refreshDesk());
  live.on({},e=>{if(e.reset){refreshNeeds();refreshDesk();}});
  if(!client.actor())P.say('This page was opened with an assistant name the app does not know, so nothing can be read or changed. Open it again with a listed name.',{tone:'bad'});
  refreshNeeds();refreshDesk();route();
 }

 const v2=Object.freeze({
  version:1,
  // screens and places
  screen,href,go,route:()=>active?{id:active.screen.id,params:{...active.ctx.params},query:{...active.ctx.query},path:active.ctx.path}:null,
  screens:()=>screens.map(s=>({id:s.id,route:s.route})),
  // commands and changes
  call:(name,input,options)=>client.call(name,input,options),
  on:(filter,fn)=>live.on(filter,fn),
  expect:record=>({expectedRevision:record?.revision??0,...(typeof record?.hash==='string'?{expectedHash:record.hash}:{})}),
  actor:()=>client.actor(),isHuman:()=>client.isHuman(),actorName:C.actorName,Error:C.V2Error,
  // the other front and the frame
  advanced,brand:id=>applyBrand(id),theme:()=>doc.documentElement.dataset.theme,
  desk:Object.freeze({refresh:refreshDesk,use:source=>{deskSource=typeof source==='function'?source:null;return refreshDesk();},list:()=>desk.map(d=>({...d}))}),
  needs:Object.freeze({refresh:refreshNeeds,count:()=>needs}),
  // Helpers a screen offers the others: v2.shared.<screen id> = {...}. The only part of v2 a screen may write to.
  shared:{},
  // the shared pieces
  ui:Object.freeze({ring:P.ring,step:P.step,notBuilt:P.notBuilt,sheet:P.sheet,say:P.say,undo:P.undo,reorder:P.reorder,icon:P.icon,esc:P.esc}),
 });
 root.v2=v2;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);else setTimeout(start,0);
})(window);
