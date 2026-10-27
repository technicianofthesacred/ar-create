/* Workbench rail and section panel (design/three-directions/c-workbench, revisions 5 and 6). The sidebar becomes a
   compact rail: Home and the piece switcher at the top, the twelve steps as icon + label with Gather / Develop / Make /
   Deliver as thin dividers, the learning library, History and theme at the foot. No number badges. The step buttons are
   still study.js's own .workflowStep buttons with their viewPhase(n) handlers; this module only restyles them and adds a
   panel beside the rail for sections that have something to browse, all from what the page already shows:
     Source  - the kept conversations (the reader's own select) and the Source index (sessions and versions)
     Research - supplied points, the shared brief, and exact Collections through the maintained learning owner
     Media   - the Media tools' own groupings (All media, Photos, Video, Selected, Unavailable)
     Outputs - this piece's outputs from the Outputs register, grouped by kind
   Every row presses the owner's real control (a button, or the owner's select with a change event). Nothing here
   saves, approves, sends or exports. Collections use the existing read-only catalog owner. The panel's open or
   collapsed state is remembered per section on this device. Phone (850px and narrower): the rail is a bottom bar of
   Home and the four groups, each opening the existing step sheet; the panel opens as a sheet from the title line.
   Install after tree.js. */
(()=>{
 if(window.c3Workbench)return;
 const PREF='c3-workbench-panel-v1',PHONE='(max-width:760px)';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const I={home:'<path d="M3 10h18M5 10v9M19 10v9M7 6h10M9 14h6"/>',gather:'<path d="M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5"/>',develop:'<path d="M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l4 4"/>',make:'<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',deliver:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',fold:'<path d="M4 4h16v16H4zM9 4v16"/>',panel:'<path d="M4 4h16v16H4zM9 4v16"/>',source:'<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',piece:'<path d="M6 3h9l4 4v14H6zM15 3v4h4"/>'};
 const GROUPS=[['gather','Gather'],['develop','Develop'],['make','Make'],['deliver','Deliver']];
 let prefs={};try{const v=JSON.parse(localStorage.getItem(PREF)||'{}');if(v&&typeof v==='object')prefs=v;}catch{}
 const store=()=>{try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}};
 const phone=()=>!!window.matchMedia?.(PHONE).matches;
 const stage=()=>{try{const p=current();return p.view==='record'&&Number(p.viewedStage)||(p.view==='article'?5:0);}catch{return 0;}};
 const homeView=()=>{const d=document.getElementById('project-library');return d?.open&&!d.dataset.plContext?(d.dataset.workbenchPieces==='true'?'pieces':'bench'):'';};
 const homeOpen=()=>!!homeView()||document.body.classList.contains('c3-home-open');
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
  if(select&&select.options.length)groups.push({label:'Kept conversations',rows:[...select.options].filter(o=>o.value.trim()).map(o=>({key:'sess:'+o.value,label:text(o),on:o.selected,disabled:select.disabled||o.disabled}))});
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
  if(key.startsWith('sess:')){const s=ws.querySelector('[data-source-reader-select]'),id=key.slice(5);if(!s||s.disabled||!id.trim()||![...s.options].some(o=>o.value===id&&!o.disabled))return;s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));return;}
  const index=ws.querySelector('.material-index');if(!index)return;let i=0;
  for(const n of index.querySelectorAll(':scope h3,:scope .material-record,:scope>button,:scope>.material-audio,:scope>p.small')){
   if(n.matches('h3,p.small'))continue;
   if('idx:'+i===key){const press=n.matches('button')?n:[...n.querySelectorAll('button')].find(b=>!b.closest('details'));if(press&&!press.disabled){press.click();window.c3Shell?.reveal?.(n);}return;}
   i++;
  }
 }
 function mediaRows(){
  const ws=document.querySelector('#app #workspace'),select=ws?.querySelector('[data-mot-filter]'),retained=ws?.querySelector('[data-retained-photo-records]');if(!select&&!retained)return null;
  // Filter totals belong to the native owner; retained placements are a separate authority.
  return {groups:[{label:'Show',rows:select?[...select.options].map(o=>({key:'mf:'+o.value,label:text(o),on:o.selected,disabled:select.disabled})):[]},{label:'Retained project records',rows:retained?[{key:'mr:retained',label:text(retained.querySelector(':scope>summary'))}]:[]}],empty:''};
 }
 function revealRecord(target){if(!target)return;if(target.matches('details'))target.open=true;for(let d=target.parentElement;d;d=d.parentElement)if(d.matches('details'))d.open=true;target.scrollIntoView?.({block:'nearest'});const heading=target.querySelector(':scope>summary,.recordBody h1,.recordBody h2,h2,h3')||target;heading.tabIndex=-1;heading.focus?.({preventScroll:true});}
 function mediaPress(key){if(key==='mr:retained')return revealRecord(document.querySelector('#app #workspace [data-retained-photo-records]'));const s=document.querySelector('#app #workspace [data-mot-filter]');if(!s||s.disabled)return;s.value=key.slice(3);s.dispatchEvent(new Event('change',{bubbles:true}));}
 function outputRows(){
  const host=document.querySelector('#app #workspace #output-overview');if(!host)return null;
  const rows=[...host.querySelectorAll('.oo-row[data-overview-output]')],byKind=new Map();
  for(const r of rows){const kind=text(r.querySelector('.oo-meta')).split(' · ')[0]||'Output',b=r.querySelector('.oo-title');if(!b)continue;if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push({key:'out:'+r.dataset.overviewOutput,label:text(b)||'Untitled output',title:text(r.querySelector('.oo-state strong'))||'',disabled:b.disabled,on:r.classList.contains('is-current')||r.matches('[aria-current]')});}
  const browser=host.querySelector('[data-browser-carousel] [data-output-browser-carousel]');if(browser)byKind.set('Browser copy',[{key:'browser-carousel',label:text(browser)||'Carousel',title:'Saved in this browser only',disabled:browser.disabled}]);
  return {groups:[...byKind].map(([label,rows])=>({label,rows,count:rows.length})),empty:text(host.querySelector('.oo-empty[role=alert],.oo-empty [role=alert],.oo-empty[role=status],.oo-empty [role=status]'))||'No outputs made yet.'};
 }
 function outputPress(key){if(key==='browser-carousel'){const browser=document.querySelector('#app #workspace #output-overview [data-browser-carousel] [data-output-browser-carousel]');if(browser&&!browser.disabled)browser.click();return;}const id=key.slice(4),b=[...document.querySelectorAll('#app #workspace #output-overview .oo-row[data-overview-output]')].find(r=>r.dataset.overviewOutput===id)?.querySelector('.oo-title');if(b&&!b.disabled)b.click();}
 function researchTargets(){
  const ws=document.querySelector('#app #workspace');if(!ws)return [];
  const controls=[...ws.querySelectorAll('[data-rpb-tab],[data-rpb-point]')];
  if(controls.length)return controls.map(n=>({node:n,label:text(n),on:n.getAttribute('aria-current')==='true'||n.getAttribute('aria-pressed')==='true',disabled:n.disabled}));
  return [...ws.querySelectorAll('.research-standard-point[data-research-point]')].map(n=>({node:n,label:text(n.querySelector('h2')),on:false}));
 }
 function researchRecords(){const ws=document.querySelector('#app #workspace');return ws?[...ws.querySelectorAll('.research-standard-coverage>details:not([data-research-source-point]),.flow-retained .compactRecord,[data-disclosure="retained-research"],[data-disclosure="retained-brief"],[data-disclosure^="research-role:"]')].filter(n=>!n.closest('[data-research-point]')):[];}
 const researchCollections={context:null,reader:null,pending:null,data:null,error:'',request:0},collectionUUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 const researchContext=()=>{try{const p=current();return JSON.stringify([p.id,p.view,p.viewedStage]);}catch{return null;}};
 const recordedQuestion=row=>typeof row?.question==='string'&&row.question.trim()?row.question:null;
 async function readResearchCollections(force=false){const context=researchContext(),reader=window.connectedWorkspace?.readCollections;if(stage()!==3||!force&&researchCollections.context===context&&researchCollections.reader===reader)return researchCollections.pending;const token=++researchCollections.request;researchCollections.context=context;researchCollections.reader=reader;researchCollections.data=null;researchCollections.error='';const pending=(async()=>{try{if(typeof reader!=='function')throw Error('The learning owner is not connected.');const value=await reader();if(token!==researchCollections.request||context!==researchContext()||stage()!==3)return;if(!Number.isSafeInteger(value?.revision)||!/^[a-f0-9]{64}$/.test(value.indexHash||'')||!Array.isArray(value.collections)||new Set(value.collections.map(row=>row.id)).size!==value.collections.length||value.collections.some(row=>!collectionUUID.test(row.id||'')||typeof row.name!=='string'||!Array.isArray(row.sourceIds)||new Set(row.sourceIds).size!==row.sourceIds.length||row.sourceIds.some(id=>!collectionUUID.test(id))))throw Error('The saved Collection list was not confirmed.');researchCollections.data=value;}catch(error){if(token===researchCollections.request&&context===researchContext())researchCollections.error='Collections are unavailable. '+error.message;}finally{if(token===researchCollections.request){researchCollections.pending=null;if(context===researchContext()&&stage()===3)queueMicrotask(decorate);else researchCollections.context=null;}}})();researchCollections.pending=pending;await pending;if(researchCollections.pending===pending)researchCollections.pending=null;}
 async function openResearchCollection(key){if(key==='rc:refresh')return readResearchCollections(true);const id=key.slice(3),context=researchContext();if(stage()!==3||context!==researchCollections.context||!researchCollections.data?.collections.some(row=>row.id===id))return;try{if(typeof window.connectedWorkspace?.openContext!=='function')throw Error('The learning owner is unavailable.');await window.connectedWorkspace.openContext('inquiries',{collectionId:id});}catch(error){if(context===researchContext()&&stage()===3){researchCollections.error=error.message;decorate();}}}
 function researchRows(){void readResearchCollections();const collections=researchCollections.data?.collections||[];return {groups:[{label:'Points and brief',rows:researchTargets().map((r,i)=>({key:'rp:'+i,label:r.label,on:r.on,disabled:r.disabled}))},{label:'Collections · independent learning',rows:[...collections.map(row=>({key:'rc:'+row.id,label:row.name,question:recordedQuestion(row),title:recordedQuestion(row)||'Question not recorded'})),{key:'rc:refresh',label:'Refresh Collections',disabled:!!researchCollections.pending}],note:researchCollections.error||(!researchCollections.data?'Reading Collections…':!collections.length?'No Collections yet. Learning remains independent.':'')},{label:'Research records · read-only',rows:researchRecords().map((node,i)=>({key:'rr:'+i,label:window.arCreateDisplay?.recordTitle?.(text(node.querySelector(':scope>summary,.recordBody h1,.recordBody h2')))||text(node.querySelector(':scope>summary,.recordBody h1,.recordBody h2'))||'Retained research record'}))}],empty:'No research points or retained records are connected yet.'};}
 function researchPress(key){
  if(key.startsWith('rc:'))return openResearchCollection(key);
  if(key.startsWith('rr:'))return revealRecord(researchRecords()[Number(key.slice(3))]);
  const target=researchTargets()[Number(key.slice(3))]?.node;if(!target)return;
  if(target.matches('button'))target.click();else{
   // Jump to the actual finding without changing its plan, narration or saved choices.
   const point=target.querySelector(':scope>.wb-point');if(point){if(window.workbenchSurfaces?.selectResearchPoint)window.workbenchSurfaces.selectResearchPoint(point);else revealRecord(point);return;}
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
  const view=homeView(),here=view==='pieces'?'make':homeOpen()?'':nav.querySelector('.workflowStep[aria-current]')?.closest('.wn-family')?.dataset.family||'',open=nav.classList.contains('cr-open')?nav.dataset.wbGroup||'all':'';
  const html=`<button type="button" class="wb-bb" data-wb-home ${homeOpen()&&view!=='pieces'?'aria-current="page"':''}>${icon(I.home)}<span>Bench</span></button>${GROUPS.map(([k,l])=>`<button type="button" class="wb-bb" data-wb-group="${k}" aria-expanded="${open===k}" ${here===k?'data-here':''}>${icon(I[k])}<span>${l}</span></button>`).join('')}`;
  if(!bar){bar=document.createElement('div');bar.className='wb-bbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Bench and the four groups of steps');nav.append(bar);}
  if(bar.dataset.render!==html){bar.innerHTML=html;bar.dataset.render=html;}
 }
 function rail(nav){
  // Keep original step nodes/handlers and owner state. Navigation names describe entrances,
  // not legacy snapshot capability or a claim that a section is finished.
  nav.classList.add('wb-rail');
  const names=['Library','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
  for(const owner of nav.querySelectorAll('.workflowStep')){
   const n=Number(text(owner.querySelector('.stepNumber'))),name=names[n-1];if(!name)continue;
   const label=owner.querySelector('.stepName');if(label&&label.textContent!==name)label.textContent=name;
   if(owner.getAttribute('aria-label')!==name)owner.setAttribute('aria-label',name);
   if(owner.getAttribute('title')!=='Open '+name)owner.setAttribute('title','Open '+name);
  }
  // Read remains a real entrance; its owner may present the same writing surface.
  bottomBar(nav);
 }
 // ---------- the panel ----------
 function panelHTML(n,spec,data){
  const head=`<div class="wbp-head"><span class="wbp-title">${esc(spec.name)}</span><button type="button" class="wbp-fold" data-wb-fold aria-label="${phone()?'Close':'Collapse'} the ${esc(spec.name)} panel" title="${phone()?'Close':'Collapse'} ([)">${phone()?'Done':icon(I.fold)}</button></div>`;
  if(!data)return head+`<p class="wbp-note" role="status">Reading this section…</p>`;
  if(spec.body)return head+`<div class="wbp-body">${spec.body(data)}</div>`;
  const groups=(data.groups||[]).filter(g=>g.rows.length||g.note);
  const body=groups.length?groups.map(g=>`<div class="wbp-group" role="group" aria-label="${esc(g.label)}"><div class="wbp-gl">${esc(g.label)}</div>${g.rows.map(r=>`<button type="button" class="wbp-row${r.on?' on':''}" data-wb-row="${esc(r.key)}" ${r.on?'aria-current="true"':''} ${r.disabled?'disabled':''} title="${esc([r.label,r.title].filter(Boolean).join(' · '))}">${icon(n===2?I.source:n===3?I.develop:n===12?I.piece:I.gather)}<span class="wbp-l">${r.question?'<span data-wb-question-marker aria-label="Recorded question">?</span> ':''}${esc(r.label)}</span>${r.count!=null?`<span class="wbp-n">${esc(r.count)}</span>`:''}</button>`).join('')}${g.note?`<p class="wbp-note">${esc(g.note)}</p>`:''}</div>`).join(''):`<p class="wbp-note">${esc(data.empty)}</p>`;
  return head+`<div class="wbp-body">${body}</div>`;
 }
 function opener(n,spec,show){
  let b=document.getElementById('wb-open');
  const title=document.querySelector('#app #workspace #c3-surface-bar>.sb-right')||document.querySelector('#app #workspace #c3-surface-bar>.sb-left')||document.querySelector('#app #workspace .c3-ctitle');
  if(!show||!title){b?.remove();return;}
  if(!b){b=document.createElement('button');b.type='button';b.id='wb-open';b.className='wb-open';b.dataset.wbOpen='';}
  const html=`${icon(I.panel)}<span>${esc(spec.open)}</span>`;if(b.dataset.render!==html){b.innerHTML=html;b.dataset.render=html;}
  b.setAttribute('aria-label',`Open the ${spec.name} panel: ${spec.aria}`);b.setAttribute('aria-controls','wb-panel');b.setAttribute('aria-expanded','false');
  // Keep the title at the approved left edge. The original panel action belongs
  // with title actions and survives the bar owner's retained-control repaint.
  if(title.classList.contains('sb-right')||title.classList.contains('sb-left')){b.dataset.c3RetainControl='';if(b.parentElement!==title)title.prepend(b);}else if(b.parentElement!==title)title.append(b);
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
  spec.afterRender?.(el);
 }
 function decorate(){
  const shell=document.querySelector('#app>.shell'),nav=shell?.querySelector(':scope>.workflowNavigation.c3-rail');
  if(!shell||!nav){document.body.classList.remove('wb-on','wb-panel-on','wb-panel-sheet');return;}
  const n=stage();if(n!==lastStage){sheet=false;lastStage=n;}
  rail(nav);panel(shell,nav);
  document.body.classList.add('wb-on');
 }
 function toggle(n,open){if(phone()){sheet=open;}else{prefs[n]=open;store();}decorate();if(open)(document.querySelector('#wb-panel .wbp-row.on')||document.querySelector('#wb-panel .wbp-row')||document.querySelector('#wb-panel [data-wb-fold]'))?.focus({preventScroll:true});else (document.getElementById('wb-open')||document.querySelector('.workflowNavigation .workflowStep[aria-current]'))?.focus({preventScroll:true});}
 // Clicking the active step again opens or closes its panel (it is already the section shown, so nothing else happens).
 document.addEventListener('click',event=>{
  const step=event.target.closest?.('.workflowNavigation.wb-rail .workflowStep[aria-current]');
  if(!step||forwardingStep||phone()||step.closest('.cr-open'))return;
  const n=stage();if(!panelFor(n))return;
  event.preventDefault();event.stopPropagation();toggle(n,!isOpen(n));
 },true);
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-wb-row],[data-wb-fold],[data-wb-open],[data-wb-home],button[data-wb-group],[data-wbf-pieces]');if(!t)return;
  // Pieces uses its maintained browser action, rather than a workflowStep.
  // Dismiss the phone tool picker without swallowing or replaying that action.
  if(t.matches('[data-wbf-pieces]')){if(phone()&&!t.disabled){const nav=t.closest('.workflowNavigation');nav?.classList.remove('cr-open');nav?.querySelector('.cr-picker')?.setAttribute('aria-expanded','false');queueMicrotask(decorate);}return;}
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
   const candidates=bottom?[...bottom.querySelectorAll('button')]:panel?[...panel.querySelectorAll('button:not(:disabled)')]:[...rail.querySelectorAll('.workflowStep:not(:disabled)')].filter(b=>!b.hidden).filter(b=>!phone()||!rail.dataset.wbGroup||b.closest('.wn-family')?.dataset.family===rail.dataset.wbGroup);
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
 document.addEventListener('toggle',event=>{if(event.target.id==='project-library')decorate();},true);
 window.matchMedia?.(PHONE).addEventListener?.('change',()=>{sheet=false;decorate();});
 window.addEventListener('study-output-selection',()=>decorate());
 window.c3Workbench={registerPanel(n,spec){PANELS[n]=spec;decorate();},decorate,panels:()=>Object.keys(PANELS).map(Number),isOpen,toggle};
 window.c3Shell.register('workbench rail',decorate,{order:70,ignore:'#wb-panel'});
})();
