/* Workbench rail and section panel (design/three-directions/c-workbench, revisions 5 and 6). The sidebar becomes a
   compact rail: Home and the piece switcher at the top, the twelve steps as icon + label with Gather / Develop / Make /
   Deliver as thin dividers, the learning library, History and theme at the foot. No number badges. The step buttons are
   still study.js's own .workflowStep buttons with their viewPhase(n) handlers; this module only restyles them and adds a
   panel beside the rail for sections that have something to browse, all from what the page already shows:
     Source  - the kept conversations (the reader's own select) and the Source index (sessions and versions)
     Research - supplied points and the shared brief, through existing controls or headings
     Media   - the Media tools' own groupings (All media, Photos, Video, Selected, Unavailable)
     Outputs - this piece's outputs from the Outputs register, grouped by kind
   Every row presses the owner's real control (a button, or the owner's select with a change event). Nothing here
   saves, approves, sends or exports, and no store is read that the page has not already read. The panel's open or
   collapsed state is remembered per section on this device. Phone (850px and narrower): the rail is a bottom bar of
   Home and the four groups, each opening the existing step sheet; the panel opens as a sheet from the title line.
   Install after tree.js. */
(()=>{
 if(window.c3Workbench)return;
 const PREF='c3-workbench-panel-v1',PHONE='(max-width:850px)';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const I={home:'<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',gather:'<path d="M4 13.5 6.5 5h11l2.5 8.5"/><path d="M4 13.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.5"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',develop:'<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',make:'<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>',deliver:'<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',fold:'<path d="M14.5 7 9.5 12l5 5"/>',panel:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M9 4.5v15"/>'};
 const GROUPS=[['gather','Gather'],['develop','Develop'],['make','Make'],['deliver','Deliver']];
 let prefs={};try{const v=JSON.parse(localStorage.getItem(PREF)||'{}');if(v&&typeof v==='object')prefs=v;}catch{}
 const store=()=>{try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}};
 const phone=()=>!!window.matchMedia?.(PHONE).matches;
 const stage=()=>{try{const p=current();return p.view==='record'&&Number(p.viewedStage)||(p.view==='article'?5:0);}catch{return 0;}};
 const homeOpen=()=>document.body.classList.contains('c3-home-open');
 const text=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
 let sheet=false,lastStage=null,forwardingStep=false; // phone: the panel is open as a sheet

 // ---------- what each panel lists, read from the owner's own rendering ----------
 function libraryRows(){
  const rows=[{key:'lib:inbox',label:'Inbox',on:true}];
  if(document.querySelector('.workflowNavigation [data-tr-topics]'))rows.push({key:'lib:all',label:'All sources',title:'Open the connected Library workspace'});
  return {groups:[{label:'Library',rows}],empty:''};
 }
 function libraryPress(key){
  if(key==='lib:all')return document.querySelector('.workflowNavigation [data-tr-topics]')?.click();
  if(key!=='lib:inbox')return;
  const owner=[...document.querySelectorAll('.workflowNavigation .workflowStep')].find(b=>Number(text(b.querySelector('.stepNumber')))===1);
  if(owner){forwardingStep=true;try{owner.click();}finally{forwardingStep=false;}}
 }
 function sourceRows(){
  const groups=[],ws=document.querySelector('#app #workspace');if(!ws)return null;
  const select=ws.querySelector('[data-source-reader-select]');
  if(select&&select.options.length)groups.push({label:'Kept conversations',rows:[...select.options].map(o=>({key:'sess:'+o.value,label:text(o),on:o.selected,disabled:select.disabled}))});
  const index=ws.querySelector('.material-index');
  if(index){
   let group=null,i=0;
   for(const n of index.querySelectorAll(':scope h3,:scope .material-record,:scope>button,:scope>.material-audio,:scope>p.small')){
    if(n.matches('h3')){group={label:text(n),rows:[]};groups.push(group);continue;}
    if(!group){group={label:'Sources',rows:[]};groups.push(group);}
    if(n.matches('p.small')){group.note=text(n);continue;}
    const press=n.matches('button')?n:[...n.querySelectorAll('button')].find(b=>!b.closest('details'));
    const name=n.matches('.material-record')?[text(n.querySelector('strong')),text(n.querySelector('.small'))].filter(Boolean).join(' · '):text(n);
    if(!press||!name){i++;continue;}
    group.rows.push({key:'idx:'+i,label:name,on:n.classList.contains('is-current'),disabled:press.disabled,title:text(press)});i++;
   }
  }
  return {groups:groups.filter(g=>g.rows.length||g.note),empty:'No source sessions are connected to this piece yet.'};
 }
 function sourcePress(key){
  const ws=document.querySelector('#app #workspace');if(!ws)return;
  if(key.startsWith('sess:')){const s=ws.querySelector('[data-source-reader-select]');if(!s||s.disabled)return;s.value=key.slice(5);s.dispatchEvent(new Event('change',{bubbles:true}));return;}
  const index=ws.querySelector('.material-index');if(!index)return;let i=0;
  for(const n of index.querySelectorAll(':scope h3,:scope .material-record,:scope>button,:scope>.material-audio,:scope>p.small')){
   if(n.matches('h3,p.small'))continue;
   if('idx:'+i===key){const press=n.matches('button')?n:[...n.querySelectorAll('button')].find(b=>!b.closest('details'));if(press&&!press.disabled){press.click();window.c3Shell?.reveal?.(n);}return;}
   i++;
  }
 }
 function mediaRows(){
  const ws=document.querySelector('#app #workspace'),select=ws?.querySelector('[data-mot-filter]');if(!select)return null;
  // The owner's filter may hide cards; visible cards cannot establish totals for the other groups.
  return {groups:[{label:'Show',rows:[...select.options].map(o=>({key:'mf:'+o.value,label:text(o),on:o.selected,disabled:select.disabled}))}],empty:''};
 }
 function mediaPress(key){const s=document.querySelector('#app #workspace [data-mot-filter]');if(!s||s.disabled)return;s.value=key.slice(3);s.dispatchEvent(new Event('change',{bubbles:true}));}
 function outputRows(){
  const host=document.querySelector('#app #workspace #output-overview');if(!host)return null;
  const rows=[...host.querySelectorAll('.oo-row[data-overview-output]')],byKind=new Map();
  for(const r of rows){const kind=text(r.querySelector('.oo-meta')).split(' · ')[0]||'Output',b=r.querySelector('.oo-title');if(!b)continue;if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push({key:'out:'+r.dataset.overviewOutput,label:text(b)||'Untitled output',title:text(r.querySelector('.oo-state strong'))||'',disabled:b.disabled,on:r.classList.contains('is-current')||r.matches('[aria-current]')});}
  return {groups:[...byKind].map(([label,rows])=>({label,rows,count:rows.length})),empty:host.querySelector('.oo-empty [role=alert]')?text(host.querySelector('.oo-empty [role=alert]')):'No outputs made yet.'};
 }
 function outputPress(key){const id=key.slice(4),b=[...document.querySelectorAll('#app #workspace #output-overview .oo-row[data-overview-output]')].find(r=>r.dataset.overviewOutput===id)?.querySelector('.oo-title');if(b&&!b.disabled)b.click();}
 function researchTargets(){
  const ws=document.querySelector('#app #workspace');if(!ws)return [];
  const controls=[...ws.querySelectorAll('[data-rpb-tab],[data-rpb-point]')];
  if(controls.length)return controls.map(n=>({node:n,label:text(n),on:n.getAttribute('aria-current')==='true'||n.getAttribute('aria-pressed')==='true',disabled:n.disabled}));
  return [...ws.querySelectorAll('.research-standard-point[data-research-point]')].map(n=>({node:n,label:text(n.querySelector('h2')),on:false}));
 }
 function researchRows(){return {groups:[{label:'Points and brief',rows:researchTargets().map((r,i)=>({key:'rp:'+i,label:r.label,on:r.on,disabled:r.disabled}))}],empty:'No research points are connected to this piece yet.'};}
 function researchPress(key){
  const target=researchTargets()[Number(key.slice(3))]?.node;if(!target)return;
  if(target.matches('button'))target.click();else{
   // Jump to the actual finding without changing its plan, narration or saved choices.
   for(let d=target.parentElement;d;d=d.parentElement)if(d.matches('details'))d.open=true;
   target.scrollIntoView?.({block:'start'});const heading=target.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
 }
 const PANELS={
  1:{name:'Library',open:'Folders',aria:'Library navigation',rows:libraryRows,press:libraryPress},
  2:{name:'Source',open:'Sessions',aria:'Source sessions',rows:sourceRows,press:sourcePress},
  3:{name:'Research',open:'Points',aria:'Research points',rows:researchRows,press:researchPress},
  8:{name:'Media',open:'Groups',aria:'Media groups',rows:mediaRows,press:mediaPress},
  12:{name:'Outputs',open:'By kind',aria:'Outputs by kind',rows:outputRows,press:outputPress},
 };
 const panelFor=n=>homeOpen()?null:PANELS[n]||null;
 const isOpen=n=>phone()?sheet:prefs[n]!==false;

 // ---------- the rail ----------
 function bottomBar(nav){
  let bar=nav.querySelector(':scope>.wb-bbar');
  const here=nav.querySelector('.workflowStep[aria-current]')?.closest('.wn-family')?.dataset.family||'',open=nav.classList.contains('cr-open')?nav.dataset.wbGroup||'all':'';
  const html=`<button type="button" class="wb-bb" data-wb-home ${homeOpen()?'aria-current="page"':''}>${icon(I.home)}<span>Home</span></button>${GROUPS.map(([k,l])=>`<button type="button" class="wb-bb" data-wb-group="${k}" aria-expanded="${open===k}" ${here===k&&!homeOpen()?'data-here':''}>${icon(I[k])}<span>${l}</span></button>`).join('')}`;
  if(!bar){bar=document.createElement('div');bar.className='wb-bbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Home and the four groups of steps');nav.append(bar);}
  if(bar.dataset.render!==html){bar.innerHTML=html;bar.dataset.render=html;}
 }
 function rail(nav){
  // The step number and the state word stay inside each button for screen readers (visually hidden by the CSS); the rail
  // itself shows only the icon and the name.
  nav.classList.add('wb-rail');
  // Keep the canonical first-step button and its ingestion handler; Library's Inbox is that existing surface.
  const inbox=[...nav.querySelectorAll('.workflowStep')].find(b=>Number(text(b.querySelector('.stepNumber')))===1);
  const label=inbox?.querySelector('.stepName');if(label&&label.textContent!=='Library')label.textContent='Library';
  if(inbox){const aria=inbox.getAttribute('aria-label');if(aria&&/^View step 1:/.test(aria)&&!aria.includes('Library'))inbox.setAttribute('aria-label',aria.replace(/^View step 1:[^,]*/, 'View step 1: Library'));}
  bottomBar(nav);
 }
 // ---------- the panel ----------
 function panelHTML(n,spec,data){
  const head=`<div class="wbp-head"><span class="wbp-title">${esc(spec.name)}</span><button type="button" class="wbp-fold" data-wb-fold aria-label="${phone()?'Close':'Collapse'} the ${esc(spec.name)} panel" title="${phone()?'Close':'Collapse'} ([)">${icon(I.fold)}</button></div>`;
  if(!data)return head+`<p class="wbp-note" role="status">Reading this section…</p>`;
  const groups=data.groups.filter(g=>g.rows.length||g.note);
  const body=groups.length?groups.map(g=>`<div class="wbp-group" role="group" aria-label="${esc(g.label)}"><div class="wbp-gl">${esc(g.label)}</div>${g.rows.map(r=>`<button type="button" class="wbp-row${r.on?' on':''}" data-wb-row="${esc(r.key)}" ${r.on?'aria-current="true"':''} ${r.disabled?'disabled':''} title="${esc([r.label,r.title].filter(Boolean).join(' · '))}"><span class="wbp-l">${esc(r.label)}</span>${r.count!=null?`<span class="wbp-n">${esc(r.count)}</span>`:''}</button>`).join('')}${g.note?`<p class="wbp-note">${esc(g.note)}</p>`:''}</div>`).join(''):`<p class="wbp-note">${esc(data.empty)}</p>`;
  return head+`<div class="wbp-body">${body}</div>`;
 }
 function opener(n,spec,show){
  let b=document.getElementById('wb-open');
  const title=document.querySelector('#app #workspace .c3-ctitle');
  if(!show||!title){b?.remove();return;}
  if(!b){b=document.createElement('button');b.type='button';b.id='wb-open';b.className='wb-open';b.dataset.wbOpen='';}
  const html=`${icon(I.panel)}<span>${esc(spec.open)}</span>`;if(b.dataset.render!==html){b.innerHTML=html;b.dataset.render=html;}
  b.setAttribute('aria-label',`Open the ${spec.name} panel: ${spec.aria}`);b.setAttribute('aria-controls','wb-panel');b.setAttribute('aria-expanded','false');
  // Empty-state cards and Source/Research controls own the title's following sibling.
  // Put this action inside the title so independent decorators cannot keep moving siblings past one another.
  if(b.parentElement!==title)title.append(b);
 }
 function panel(shell,nav){
  const n=stage(),spec=panelFor(n),active=nav.querySelector('.workflowStep[aria-current]');
  let el=shell.querySelector(':scope>#wb-panel');
  for(const b of nav.querySelectorAll('.workflowStep[aria-controls="wb-panel"]'))if(b!==active||!spec){b.removeAttribute('aria-controls');b.removeAttribute('aria-expanded');}
  if(!spec){el?.remove();document.body.classList.remove('wb-panel-on','wb-panel-sheet');document.body.removeAttribute('data-wb-panel');opener(n,{},false);return;}
  const open=isOpen(n);
  if(active){active.setAttribute('aria-controls','wb-panel');active.setAttribute('aria-expanded',String(open));}
  document.body.dataset.wbPanel=String(n);
  if(!open){el?.remove();document.body.classList.remove('wb-panel-on','wb-panel-sheet');opener(n,spec,true);return;}
  opener(n,spec,false);
  if(!el){el=document.createElement('aside');el.id='wb-panel';el.className='wb-panel';shell.append(el);}
  el.setAttribute('aria-label',spec.aria);
  const html=panelHTML(n,spec,spec.rows());
  if(el.dataset.render!==html){el.innerHTML=html;el.dataset.render=html;}
  document.body.classList.toggle('wb-panel-on',!phone());document.body.classList.toggle('wb-panel-sheet',phone());
 }
 function decorate(){
  const shell=document.querySelector('#app>.shell'),nav=shell?.querySelector(':scope>.workflowNavigation.c3-rail');
  if(!shell||!nav){document.body.classList.remove('wb-on','wb-panel-on','wb-panel-sheet');return;}
  const n=stage();if(n!==lastStage){sheet=false;lastStage=n;}
  rail(nav);panel(shell,nav);
  document.body.classList.add('wb-on');
 }
 function toggle(n,open){if(phone()){sheet=open;}else{prefs[n]=open;store();}decorate();if(open)(document.querySelector('#wb-panel .wbp-row.on')||document.querySelector('#wb-panel .wbp-row')||document.querySelector('#wb-panel [data-wb-fold]'))?.focus({preventScroll:true});else document.querySelector('#wb-open,.workflowNavigation .workflowStep[aria-current]')?.focus({preventScroll:true});}
 // Clicking the active step again opens or closes its panel (it is already the section shown, so nothing else happens).
 document.addEventListener('click',event=>{
  const step=event.target.closest?.('.workflowNavigation.wb-rail .workflowStep[aria-current]');
  if(!step||forwardingStep||phone()||step.closest('.cr-open'))return;
  const n=stage();if(!panelFor(n))return;
  event.preventDefault();event.stopPropagation();toggle(n,!isOpen(n));
 },true);
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-wb-row],[data-wb-fold],[data-wb-open],[data-wb-home],button[data-wb-group]');if(!t)return;
  if(t.matches('[data-wb-home]'))return void document.querySelector('[data-tr-home],[data-ht-home]')?.click();
  if(t.matches('[data-wb-group]')){
   const nav=t.closest('.workflowNavigation'),g=t.dataset.wbGroup,already=nav.classList.contains('cr-open')&&nav.dataset.wbGroup===g;
   sheet=false;
   nav.dataset.wbGroup=g;nav.classList.toggle('cr-open',!already);nav.querySelector('.cr-picker')?.setAttribute('aria-expanded',String(!already));
   if(!already)nav.querySelector(`.wn-family[data-family="${g}"] .workflowStep`)?.focus({preventScroll:true});
   return decorate();
  }
  const n=stage(),spec=panelFor(n);if(!spec)return;
  if(t.matches('[data-wb-fold]'))return toggle(n,false);
  if(t.matches('[data-wb-open]'))return toggle(n,true);
  if(t.matches('[data-wb-row]')&&!t.disabled){spec.press(t.dataset.wbRow);if(phone()){sheet=false;}queueMicrotask(decorate);}
 });
 // The sheet opened from the step name (the picker) shows every group; one opened from a group shows that group.
 document.addEventListener('click',event=>{if(event.target.closest?.('.workflowNavigation .cr-picker')){const nav=event.target.closest('.workflowNavigation');delete nav.dataset.wbGroup;queueMicrotask(decorate);}},true);
 document.addEventListener('keydown',event=>{
  const focused=event.target;
  const rail=focused?.closest?.('.workflowNavigation.wb-rail'),panel=focused?.closest?.('#wb-panel');
  if((rail||panel)&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
   const bottom=focused.closest('.wb-bbar');
   const candidates=bottom?[...bottom.querySelectorAll('button')]:panel?[...panel.querySelectorAll('button:not(:disabled)')]:[...rail.querySelectorAll('.workflowStep:not(:disabled)')].filter(b=>!phone()||!rail.dataset.wbGroup||b.closest('.wn-family')?.dataset.family===rail.dataset.wbGroup);
   const i=candidates.indexOf(focused);
   if(i>=0){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?candidates.length-1:(i+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+candidates.length)%candidates.length;candidates[next]?.focus();return;}
  }
  if(event.key==='Escape'&&phone()){const nav=document.querySelector('.workflowNavigation.wb-rail');if(nav&&!nav.classList.contains('cr-open')){queueMicrotask(decorate);nav.querySelector(`button[data-wb-group="${nav.dataset.wbGroup}"]`)?.focus();}}
  if(event.key==='Escape'&&sheet){sheet=false;decorate();document.getElementById('wb-open')?.focus();return;}
  if(event.key!=='['||event.metaKey||event.ctrlKey||event.altKey)return;
  const t=event.target;if(t?.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"]'))return;
  const n=stage();if(!panelFor(n))return;event.preventDefault();toggle(n,!isOpen(n));
 });
 // The piece switcher's menu flies out beside the rail, level with its own row.
 document.addEventListener('toggle',event=>{const d=event.target;if(!d.matches?.('#c3-tabstrip details')||!d.open||!d.closest('.wb-rail')||phone())return;const r=d.querySelector('summary').getBoundingClientRect();d.style.setProperty('--wb-my',Math.round(Math.max(8,Math.min(r.top,innerHeight-440)))+'px');},true);
 window.matchMedia?.(PHONE).addEventListener?.('change',()=>{sheet=false;decorate();});
 window.addEventListener('study-output-selection',()=>decorate());
 window.c3Workbench={decorate,panels:()=>Object.keys(PANELS).map(Number),isOpen,toggle};
 window.c3Shell.register('workbench rail',decorate,{order:70,ignore:'#wb-panel'});
})();
