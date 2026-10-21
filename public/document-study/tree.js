/* Full A · the Tree. Turns the C3 checkpoint column into the working sidebar: Home and a "Working on" switch at the top,
   the four activities (Gather, Develop, Make, Deliver) by name, one state word per step (from the piece state), the learning
   library, History and theme at the bottom, and its own collapse arrow that leaves a slim icon rail. No second list of
   pieces beside it: the piece switcher at the top is the one list. "Next" is a quiet link at the end of the work.
   Everything here is a look over the existing owners: steps still call viewPhase(n), pieces open through the wrapped
   switchProject (save-checked), counts come only from saved output records, and nothing is created, changed or deleted.
   Preferences (collapsed, list shown, scope) stay in this browser. Install after checkpoint-rail and empty-states. */
(()=>{
 if(window.c3Tree)return;
 const ACTS={gather:'What do I have?',develop:'What does it mean?',make:'Say it well',deliver:'Send it out'};
 const NAMES=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
 const KIND_STEP={native:5,arrange:9,review:10},STATUS_STEP={'correction-needed':5,'review-needed':10};
 const WAITING={'review-needed':'Review needed','correction-needed':'Correction needed'};
 const MAX_READ=12,TTL=60000,PREF='c3-tree-v1';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const ICONS={home:'<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',fold:'<path d="M14.5 7 9.5 12l5 5"/>',unfold:'<path d="M9.5 7l5 5-5 5"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',topics:'<path d="M4 6.5h7l2 2h7v10H4z"/>',history:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3h3"/><path d="M12 8v4l3 2"/>',all:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12h8M8 15h5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',moon:'<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'};
 let prefs={slim:false,list:true,scope:''};try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREF)||'{}')};}catch{}
 const store=()=>{try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}};
 const cache=new Map();let loading=null;
 const stage=()=>{const p=current();return p.view==='record'&&Number(p.viewedStage)||(p.view==='article'?5:0);};
 const pieces=()=>(state.projects||[]).filter(p=>!p.archived);
 const folders=()=>[...new Set(pieces().map(p=>p.folder).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const scope=()=>''; // one list of pieces: the piece switcher; Home filters by brand
 const inScope=p=>!scope()||p.folder===scope();
 const scopeName=()=>scope()||'Everything';
 const stepButton=n=>[...document.querySelectorAll('.workflowNavigation .workflowStep')].find(b=>Number(b.querySelector('.stepNumber')?.textContent.trim())===n);
 // ---------- saved output records: the only source of "needs you" counts
 function recent(){const nav=state.projectNavigation||{},ids=[current().id,...(nav.openTabs||[]).map(t=>t.projectId),...(nav.recent||[])];return [...new Set(ids)];}
 function readable(){const order=recent(),list=pieces().filter(inScope);list.sort((a,b)=>{const i=order.indexOf(a.id),j=order.indexOf(b.id);return (i<0?1e9:i)-(j<0?1e9:j);});return list.slice(0,MAX_READ);}
 async function readPiece(p){
  const hit=cache.get(p.id);if(hit&&Date.now()-hit.at<TTL)return hit;
  try{const data=await window.realOutputOverview.read({projectId:p.id});if(data?.projectId!==p.id)throw Error('Another piece answered.');const rows=(data.outputs||[]).filter(o=>WAITING[o.status]).map(o=>({id:o.id,title:o.title||'Untitled output',format:o.format||'Output',status:o.status,step:KIND_STEP[o.nextAction?.kind]||STATUS_STEP[o.status]}));const entry={at:Date.now(),ok:true,rows};cache.set(p.id,entry);return entry;}
  catch{const entry={at:Date.now(),ok:false,rows:[]};cache.set(p.id,entry);return entry;}
 }
 function load(){
  if(typeof window.realOutputOverview?.read!=='function'||loading)return loading;
  const list=readable();if(list.every(p=>{const h=cache.get(p.id);return h&&Date.now()-h.at<TTL;}))return null;
  loading=(async()=>{for(const p of list)await readPiece(p);})().finally(()=>{loading=null;decorate();});
  return loading;
 }
 function waitingFor(id){return cache.get(id)?.rows||[];}
 function counts(){const c={},list=pieces().filter(inScope);for(const p of list)for(const r of waitingFor(p.id))if(r.step)c[r.step]=(c[r.step]||0)+1;return c;}
 const readCount=()=>pieces().filter(inScope).filter(p=>cache.get(p.id)?.ok).length;
 // ---------- the sidebar
 function head(){
  return `<div class="tr-row"><button type="button" class="tr-home" data-tr-home title="Home · every piece and what needs you">${icon(ICONS.home)}<span class="tr-label">Home</span></button><button type="button" class="tr-fold" data-tr-fold aria-expanded="${!prefs.slim}" aria-label="${prefs.slim?'Open the sidebar':'Fold the sidebar to icons'}" title="${prefs.slim?'Open the sidebar':'Fold the sidebar'}">${icon(prefs.slim?ICONS.unfold:ICONS.fold)}</button></div>`;
 }
 // The bottom of the sidebar: the learning library, History and the theme. The pieces list is the piece switcher at the
 // top; "Everything that's here" lives in the bar's More (review A4).
 function find(){
  const topics=!!window.connectedWorkspace?.openContext,history=!!historyControl();
  return `${topics?`<button type="button" class="tr-link" data-tr-topics title="Topics and what you have learned, shared by every piece">${icon(ICONS.topics)}<span class="tr-label">Learning library</span></button>`:''}${history?`<button type="button" class="tr-link" data-tr-history title="Earlier versions of this piece. Going back makes a new version.">${icon(ICONS.history)}<span class="tr-label">History</span></button>`:''}${theme()}`;
 }
 // The theme switch moved here from the old tab strip; it presses the strip's own control, which keeps owning the theme.
 function theme(){const dark=document.documentElement.dataset.theme==='dark',l=dark?'Light theme':'Dark theme';return document.querySelector('#c3-tabstrip [data-ht-theme]')?`<button type="button" class="tr-link" data-tr-theme title="Switch to ${l.toLowerCase()}" aria-label="Switch to ${l.toLowerCase()}">${icon(dark?ICONS.sun:ICONS.moon)}<span class="tr-label">${l}</span></button>`:'';}
 function historyControl(){return [...document.querySelectorAll('#app .workspace [onclick]')].find(n=>/modal='history'/.test(n.getAttribute('onclick')||''))||null;}
 function sidebar(nav){
  let top=nav.querySelector(':scope>.tr-head');
  if(!top){top=document.createElement('div');top.className='tr-head';const picker=nav.querySelector(':scope>.cr-picker');picker?picker.after(top):nav.prepend(top);}
  const h=head();if(top.dataset.render!==h){top.innerHTML=h;top.dataset.render=h;}

  for(const fam of nav.querySelectorAll('.wn-family')){
   const key=fam.dataset.family,steps=fam.querySelector('.wn-family-steps');
   let act=fam.querySelector(':scope>.tr-act');
   if(!act&&steps){act=document.createElement('div');act.className='tr-act';act.setAttribute('aria-hidden','true');steps.before(act);}
   const label=fam.querySelector('.wn-family-label')?.textContent||key;
   const ah=`<b>${esc(label)}</b>`;if(act&&act.dataset.render!==ah){act.innerHTML=ah;act.dataset.render=ah;} // group name only (review C5)
  }
  // One state word per step comes from the piece state (checkpoint-rail); the old count badge is not a second indicator.
  for(const badge of nav.querySelectorAll('.tr-n'))badge.remove();
  for(const b of nav.querySelectorAll('.workflowStep[data-tr-needs]'))b.removeAttribute('data-tr-needs');
  let foot=nav.querySelector(':scope>.tr-find');
  if(!foot){foot=document.createElement('div');foot.className='tr-find';nav.append(foot);}
  const f=find();if(foot.dataset.render!==f){foot.innerHTML=f;foot.dataset.render=f;}
  nav.classList.add('tr-tree');
 }
 // ---------- Next: a quiet link at the end of the work, never a bar. It follows the twelve steps in order, skips a step
 // the piece state calls not applicable, and steps aside when the bar's one primary already says the same Next.
 function next(ws){
  const n=stage(),ps=window.c3PieceState;let to=n?n+1:0;
  while(to&&to<=12&&ps?.notApplicable?.(to))to++;
  let link=document.getElementById('c3-next');
  const primary=document.querySelector('#c3-surface-bar .sb-primary')?.textContent.trim()||'';
  if(!n||to>12||primary==='Next: '+NAMES[to-1]){link?.remove();return;}
  if(!link){link=document.createElement('nav');link.id='c3-next';link.setAttribute('aria-label','Next step');}
  if(link.parentElement!==ws||ws.lastElementChild!==link)ws.append(link);
  const html=`<button type="button" class="c3-next-go" data-c3-next="${to}">Next: ${esc(NAMES[to-1])} <span aria-hidden="true">→</span></button>`;
  if(link.dataset.render!==html){link.innerHTML=html;link.dataset.render=html;}
 }
 // ---------- Everything that's here: every part and whether it works yet
 const PARTS=[
  ['Start','Home','Every piece, pick up where you stopped, and what is waiting on you','working',{home:1}],
  ['Start','Piece switcher','At the top of the sidebar: every piece, open tabs and recent pieces; New makes a project or an output','working',null],
  ['Gather','Material · bring in','Files, notes, links and folders, shared by every output of the piece','working',{phase:1}],
  ['Gather','Material · keep or remove','A review of what to keep, with a reason; prepared, not connected yet','prepared',{phase:1}],
  ['Gather','Material · sort into topics','One item at a time, groups, bulk moves and rules; waits for standalone Collections','gated',null],
  ['Gather','Source','What was said, every turn, flagged lines, corrections and notes','working',{phase:2}],
  ['Develop','Research','What you have learned, points with their backing, open questions','working',{phase:3}],
  ['Develop','Your thoughts','Your own words and context, kept in Direction as Author context','working',{phase:4}],
  ['Develop','Direction','What you want to say, and the choices behind it','working',{phase:4}],
  ['Make','Write','The manuscript, protected quotes, notes and decisions, ask Claude','working',{phase:5}],
  ['Make','Read','The clean reading view of the same words','working',{phase:6}],
  ['Make','Check','Findings that jump to their sentence, check again','working',{phase:7}],
  ['Make','Media','Photos and video, with where each one is used','working',{phase:8}],
  ['Make','Arrange','Words and photos in order for this output','working',{phase:9}],
  ['Deliver','Audience','The output as people will see it, and export. Translation and posting are not connected','working',{phase:10}],
  ['Deliver','Share','The message to the people involved, copied to send yourself','working',{phase:11}],
  ['Deliver','Outputs','Every output of the piece, its kind and status; new output','working',{phase:12}],
  ['Deliver','Magazine story','Map, plan, draft, checks, edit passes, photos, publish, feedback. Lives in the Teajia magazine, not here yet','gated',null],
  ['Find','Learning library','Topics and learning shared by every piece, at the bottom of the sidebar','working',{topics:1}],
  ['Find','Where it’s used','Photos show where they are placed, in Media. Quotes and saved items are not linked yet','prepared',{phase:8}],
  ['Find','History','Earlier versions of a piece; going back makes a new version','working',{history:1}],
  ['Find','Receipts','What was saved, handed over or held for a piece, in the bar under More','working',null],
  ['Find','Coming back','Leaving a piece for Source, Research or Media offers the way back','working',null],
  ['Find','States','One state word per step in the sidebar; saving, saved and failed saves in the bar, with what to do','working',null]
 ];
 const TONE={working:'Works now',prepared:'Prepared, not connected',gated:'Not built here yet'};
 function everything(){
  let d=document.getElementById('c3-everything');
  if(!d){d=document.createElement('dialog');d.id='c3-everything';d.setAttribute('aria-labelledby','c3-everything-title');document.body.append(d);}
  const groups=[...new Set(PARTS.map(p=>p[0]))];
  d.innerHTML=`<div class="te-head"><h2 id="c3-everything-title">Everything that’s here</h2><p>Every part of AR Create, in the order you would use it, and whether it works yet.</p><button type="button" class="te-close" data-te-close>Close</button></div>${groups.map(g=>`<section class="te-group"><h3>${esc(g)}</h3>${PARTS.map((p,i)=>[p,i]).filter(([p])=>p[0]===g).map(([p,i])=>`<div class="te-row"><div><strong>${esc(p[1])}</strong><span>${esc(p[2])}</span></div><span class="te-tone" data-tone="${p[3]}">${TONE[p[3]]}</span>${p[4]&&!(p[4].topics&&!window.connectedWorkspace?.openContext)&&!(p[4].history&&!historyControl())?`<button type="button" data-te-go="${i}">Open</button>`:'<span class="te-none"></span>'}</div>`).join('')}</section>`).join('')}`;
  if(!d.open)d.showModal?d.showModal():d.setAttribute('open','');
 }
 async function go(target){
  if(target.home)return document.querySelector('[data-ht-home]')?.click();
  if(target.topics)return window.connectedWorkspace?.openContext?.('inquiries');
  // History opens Recent changes (review A8, F-30): one view of who did what, whose rows open the exact saved versions.
  if(target.history)return window.arLive?window.arLive.openRecent():historyControl()?.click();
  if(target.phase)return window.viewPhase(target.phase);
 }
 // ---------- one decorate pass after every render
 function decorate(){
  const shell=document.querySelector('#app>.shell'),ws=shell?.querySelector(':scope>.workspace'),nav=shell?.querySelector(':scope>.workflowNavigation.c3-rail');
  if(!shell||!ws||!nav)return;
  sidebar(nav);next(ws);document.getElementById('c3-path')?.remove();document.getElementById('c3-queue')?.remove();document.body.classList.remove('c3-queue-on');
  document.body.classList.toggle('c3-tree-slim',!!prefs.slim);
  document.body.classList.add('c3-tree-on');
  load();
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-tr-home],[data-tr-fold],[data-tr-topics],[data-tr-history],[data-tr-all],[data-tr-theme],[data-c3-next],[data-te-go],[data-te-close]');if(!t)return;
  if(t.matches('[data-tr-home]'))return document.querySelector('[data-ht-home]')?.click();
  if(t.matches('[data-tr-fold]')){prefs.slim=!prefs.slim;store();return decorate();}
  if(t.matches('[data-tr-topics]'))return void go({topics:1});
  if(t.matches('[data-tr-history]'))return void go({history:1});
  if(t.matches('[data-tr-all]'))return everything();
  if(t.matches('[data-tr-theme]')){document.querySelector('#c3-tabstrip [data-ht-theme]')?.click();return setTimeout(decorate,0);}
  if(t.matches('[data-c3-next]'))return void window.viewPhase(Number(t.dataset.c3Next));
  if(t.matches('[data-te-close]'))return document.getElementById('c3-everything')?.close?.();
  if(t.matches('[data-te-go]')){const part=PARTS[Number(t.dataset.teGo)];document.getElementById('c3-everything')?.close?.();return void go(part[4]);}
 });
 window.addEventListener('study-output-selection',()=>decorate());
 window.c3Tree={decorate,everything,counts,parts:PARTS};
 window.c3Shell.register('sidebar',decorate,{order:20});
})();
