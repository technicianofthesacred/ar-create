/* Full A · the Tree. Turns the C3 checkpoint column into the working sidebar: Home and a "Working on" switch at the top,
   the four activities (Gather, Develop, Make, Deliver) with their questions and honest "needs you" counts, a Find section
   at the bottom, and its own collapse arrow that leaves a slim icon rail. Beside it, a list of the pieces in the chosen
   scope for the step you are on, and above the work a step path for the open output with one Next line.
   Everything here is a look over the existing owners: steps still call viewPhase(n), pieces open through the wrapped
   switchProject (save-checked), counts come only from saved output records, and nothing is created, changed or deleted.
   Preferences (collapsed, list shown, scope) stay in this browser. Install after checkpoint-rail and empty-states. */
(()=>{
 if(window.c3Tree)return;
 const ACTS={gather:'What do I have?',develop:'What does it mean?',make:'Say it well',deliver:'Send it out'};
 const NAMES=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
 // The per-kind paths through the same twelve steps, in their original order.
 const PATHS={Carousel:[9,8,10,11],output:[5,6,7,8,10,11],piece:[1,2,3,4,12]};
 const KIND_STEP={native:5,arrange:9,review:10},STATUS_STEP={'correction-needed':5,'review-needed':10};
 const WAITING={'review-needed':'Review needed','correction-needed':'Correction needed'};
 const MAX_READ=12,TTL=60000,LIST_PAGE=40,PREF='c3-tree-v1';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const ICONS={home:'<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',fold:'<path d="M14.5 7 9.5 12l5 5"/>',unfold:'<path d="M9.5 7l5 5-5 5"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',topics:'<path d="M4 6.5h7l2 2h7v10H4z"/>',history:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3h3"/><path d="M12 8v4l3 2"/>',all:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12h8M8 15h5"/>'};
 let prefs={slim:false,list:true,scope:''};try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREF)||'{}')};}catch{}
 const store=()=>{try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}};
 const cache=new Map();let loading=null,listAll=false,message='';
 const stage=()=>{const p=current();return p.view==='record'&&Number(p.viewedStage)||(p.view==='article'?5:0);};
 const pieces=()=>(state.projects||[]).filter(p=>!p.archived);
 const folders=()=>[...new Set(pieces().map(p=>p.folder).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const scope=()=>folders().includes(prefs.scope)?prefs.scope:'';
 const inScope=p=>!scope()||p.folder===scope();
 const scopeName=()=>scope()||'Everything';
 const stepButton=n=>[...document.querySelectorAll('.workflowNavigation .workflowStep')].find(b=>Number(b.querySelector('.stepNumber')?.textContent.trim())===n);
 const selected=()=>{try{return window.workspaceNavigation?.selectedOutput?.()||null;}catch{return null;}};
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
  const opts=['<option value="">Everything</option>',...folders().map(f=>`<option value="${esc(f)}" ${f===scope()?'selected':''}>${esc(f)}</option>`)].join('');
  return `<div class="tr-row"><button type="button" class="tr-home" data-tr-home title="Home · every piece and what needs you">${icon(ICONS.home)}<span class="tr-label">Home</span></button><button type="button" class="tr-fold" data-tr-fold aria-expanded="${!prefs.slim}" aria-label="${prefs.slim?'Open the sidebar':'Fold the sidebar to icons'}" title="${prefs.slim?'Open the sidebar':'Fold the sidebar'}">${icon(prefs.slim?ICONS.unfold:ICONS.fold)}</button></div><label class="tr-scope"><span class="tr-scope-l">Working on</span><select data-tr-scope aria-label="Working on: every list follows this">${opts}</select></label>`;
 }
 function find(){
  const topics=!!window.connectedWorkspace?.openContext,history=!!historyControl();
  return `<div class="tr-find-h">Find</div><button type="button" class="tr-link" data-tr-list aria-pressed="${prefs.list}" title="${prefs.list?'Hide':'Show'} the list of pieces beside this step">${icon(ICONS.list)}<span class="tr-label">Pieces list</span></button>${topics?`<button type="button" class="tr-link" data-tr-topics title="Topics and what you have learned, shared by every piece">${icon(ICONS.topics)}<span class="tr-label">Topics</span></button>`:''}${history?`<button type="button" class="tr-link" data-tr-history title="Earlier versions of this piece. Going back makes a new version.">${icon(ICONS.history)}<span class="tr-label">History</span></button>`:''}<button type="button" class="tr-link" data-tr-all title="Every part of AR Create and whether it works yet">${icon(ICONS.all)}<span class="tr-label">Everything that’s here</span></button>`;
 }
 function historyControl(){return [...document.querySelectorAll('#app .workspace [onclick]')].find(n=>/modal='history'/.test(n.getAttribute('onclick')||''))||null;}
 function sidebar(nav){
  let top=nav.querySelector(':scope>.tr-head');
  if(!top){top=document.createElement('div');top.className='tr-head';const picker=nav.querySelector(':scope>.cr-picker');picker?picker.after(top):nav.prepend(top);}
  const h=head();if(top.dataset.render!==h){top.innerHTML=h;top.dataset.render=h;}
  const c=counts(),known=readCount();
  for(const fam of nav.querySelectorAll('.wn-family')){
   const key=fam.dataset.family,steps=fam.querySelector('.wn-family-steps');
   let act=fam.querySelector(':scope>.tr-act');
   if(!act&&steps){act=document.createElement('div');act.className='tr-act';act.setAttribute('aria-hidden','true');steps.before(act);}
   const label=fam.querySelector('.wn-family-label')?.textContent||key;
   const ah=`<b>${esc(label)}</b><span>${esc(ACTS[key]||'')}</span>`;if(act&&act.dataset.render!==ah){act.innerHTML=ah;act.dataset.render=ah;}
  }
  for(let n=1;n<=12;n++){
   const b=stepButton(n);if(!b)continue;
   let badge=b.querySelector('.tr-n');const v=c[n]||0;
   if(!v){badge?.remove();b.removeAttribute('data-tr-needs');continue;}
   if(!badge){badge=document.createElement('span');badge.className='tr-n';const dot=b.querySelector('.cr-dot');if(dot)dot.before(badge);else b.append(badge);}
   const text=String(v);if(badge.textContent!==text)badge.textContent=text;
   badge.title=`${v} output${v===1?'':'s'} need you here · ${scopeName()} · from the saved records of ${known} piece${known===1?'':'s'}`;
   b.dataset.trNeeds=String(v);
  }
  let foot=nav.querySelector(':scope>.tr-find');
  if(!foot){foot=document.createElement('div');foot.className='tr-find';nav.append(foot);}
  const f=find();if(foot.dataset.render!==f){foot.innerHTML=f;foot.dataset.render=f;}
  nav.classList.add('tr-tree');
 }
 // ---------- the list of pieces for this step
 function row(p,n){
  const cur=p.id===current().id,w=waitingFor(p.id),here=w.filter(r=>r.step===n),note=here.length?here.map(r=>`${r.format}: ${WAITING[r.status]}`).join(' · '):w.length?`${w.length} waiting elsewhere`:'';
  return `<button type="button" class="tq-row ${cur?'on':''} ${here.length?'needs':''}" data-tq-open="${esc(p.id)}" ${cur?'aria-current="true"':''} title="${esc(p.name)}"><strong>${esc(p.name)}</strong><small>${esc([p.folder||'',note||p.step||p.status||''].filter(Boolean).join(' · '))}</small></button>`;
 }
 function queue(shell,nav){
  const n=stage();let q=document.getElementById('c3-queue');
  if(!prefs.list||!n){q?.remove();document.body.classList.remove('c3-queue-on');return;}
  if(!q){q=document.createElement('aside');q.id='c3-queue';q.setAttribute('aria-label','Pieces for this step');}
  if(q.parentElement!==shell||q.previousElementSibling!==nav)nav.after(q);
  const list=pieces().filter(inScope);
  list.sort((a,b)=>{const x=waitingFor(a.id).some(r=>r.step===n),y=waitingFor(b.id).some(r=>r.step===n);if(x!==y)return x?-1:1;return 0;});
  const shown=listAll?list:list.slice(0,LIST_PAGE),waiting=list.filter(p=>waitingFor(p.id).some(r=>r.step===n)).length;
  const html=`<div class="tq-head"><strong>${esc(NAMES[n-1])}</strong><span>${esc(scopeName())} · ${list.length} piece${list.length===1?'':'s'}${waiting?` · ${waiting} need you here`:''}</span></div>${message?`<p class="tq-msg" role="status">${esc(message)}</p>`:''}<div class="tq-list">${shown.map(p=>row(p,n)).join('')||'<p class="tq-empty">No pieces in this scope. Choose Everything in Working on.</p>'}</div>${list.length>shown.length?`<button type="button" class="tq-more" data-tq-all>Show all ${list.length}</button>`:''}`;
  if(q.dataset.render!==html){q.innerHTML=html;q.dataset.render=html;}
  document.body.classList.add('c3-queue-on');
  document.body.dataset.c3Writing=[5,6,7].includes(n)?'true':'false';
 }
 // ---------- the step path for the open output, with one Next line
 function path(ws){
  const n=stage(),o=selected(),writing=n>=5&&n<=11,kind=o?(o.format==='Carousel'?'Carousel':'output'):writing?'output':'piece',steps=PATHS[kind];
  let bar=document.getElementById('c3-path');
  if(!n){bar?.remove();return;}
  if(!bar){bar=document.createElement('nav');bar.id='c3-path';bar.setAttribute('aria-label','Steps for this '+(o?'output':'piece'));}
  const anchor=ws.querySelector(':scope>#c3-surface-bar');
  if(anchor?(anchor.nextElementSibling!==bar):(ws.firstElementChild!==bar))anchor?anchor.after(bar):ws.prepend(bar);
  const at=steps.indexOf(n),next=at<0?steps[0]:steps[at+1];
  const what=o?`${o.format||'Output'} · ${o.title||'Untitled'}`:writing?'The manuscript':'Before an output';
  const html=`<span class="tp-what" title="${esc(what)}">${esc(what)}</span><ol class="tp-steps">${steps.map(s=>`<li><button type="button" data-tp-go="${s}" ${s===n?'aria-current="step"':''}>${esc(NAMES[s-1])}</button></li>`).join('')}</ol>${next?`<button type="button" class="tp-next" data-tp-go="${next}">${at<0?'Start':'Next'}: ${esc(NAMES[next-1])}</button>`:'<span class="tp-done">Last step for this '+(o?'output':'piece')+'</span>'}`;
  bar.dataset.kind=kind;
  if(bar.dataset.render!==html){bar.innerHTML=html;bar.dataset.render=html;}
 }
 // ---------- Everything that's here: every part and whether it works yet
 const PARTS=[
  ['Start','Home','Every piece, pick up where you stopped, and what is waiting on you','working',{home:1}],
  ['Start','Working on','Everything or one project folder; the pieces list and counts follow it. Topics as a scope come with standalone Collections','working',null],
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
  ['Find','Topics','Topics and learning shared by every piece','working',{topics:1}],
  ['Find','Where it’s used','Photos show where they are placed, in Media. Quotes and saved items are not linked yet','prepared',{phase:8}],
  ['Find','History','Earlier versions of a piece; going back makes a new version','working',{history:1}],
  ['Find','Coming back','Leaving a piece for Source, Research or Media offers the way back','working',null],
  ['Find','States','Saving, saved and failed saves in the bottom bar, with what to do','working',null]
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
  if(target.history)return historyControl()?.click();
  if(target.phase)return window.viewPhase(target.phase);
 }
 // ---------- one decorate pass after every render
 function decorate(){
  const shell=document.querySelector('#app>.shell'),ws=shell?.querySelector(':scope>.workspace'),nav=shell?.querySelector(':scope>.workflowNavigation.c3-rail');
  if(!shell||!ws||!nav)return;
  sidebar(nav);queue(shell,nav);path(ws);
  document.body.classList.toggle('c3-tree-slim',!!prefs.slim);
  document.body.classList.add('c3-tree-on');
  load();
 }
 async function open(id){
  const n=stage();message='';
  try{
   if(current().id!==id){await window.switchProject(id);if(current().id!==id)throw Error('The piece did not open. Save or resolve the current changes, then try again.');}
   if(n&&stage()!==n)await window.viewPhase(n);
  }catch(error){message=error.message||'That piece could not open. Your current work is retained.';}
  decorate();
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-tr-home],[data-tr-fold],[data-tr-list],[data-tr-topics],[data-tr-history],[data-tr-all],[data-tq-open],[data-tq-all],[data-tp-go],[data-te-go],[data-te-close]');if(!t)return;
  if(t.matches('[data-tr-home]'))return document.querySelector('[data-ht-home]')?.click();
  if(t.matches('[data-tr-fold]')){prefs.slim=!prefs.slim;store();return decorate();}
  if(t.matches('[data-tr-list]')){prefs.list=!prefs.list;store();return decorate();}
  if(t.matches('[data-tr-topics]'))return void go({topics:1});
  if(t.matches('[data-tr-history]'))return void go({history:1});
  if(t.matches('[data-tr-all]'))return everything();
  if(t.matches('[data-tq-open]'))return void open(t.dataset.tqOpen);
  if(t.matches('[data-tq-all]')){listAll=true;return decorate();}
  if(t.matches('[data-tp-go]'))return void window.viewPhase(Number(t.dataset.tpGo));
  if(t.matches('[data-te-close]'))return document.getElementById('c3-everything')?.close?.();
  if(t.matches('[data-te-go]')){const part=PARTS[Number(t.dataset.teGo)];document.getElementById('c3-everything')?.close?.();return void go(part[4]);}
 });
 document.addEventListener('change',event=>{const s=event.target.closest?.('[data-tr-scope]');if(!s)return;prefs.scope=s.value;listAll=false;store();decorate();});
 const previousRender=window.render;
 window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{decorate();return value;});decorate();return result;};
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 window.addEventListener('study-output-selection',()=>decorate());
 window.c3Tree={decorate,everything,counts,paths:PATHS,parts:PARTS};
 decorate();
})();
