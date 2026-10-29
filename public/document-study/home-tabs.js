/* C3 Home and tabs. A tab strip for open pieces/outputs and a full-screen Home built on the existing project library.
   Browser-local only: tabs and Home filters never create, change, archive or delete saved work. Every move goes through
   the existing wrapped switchProject/viewPhase/output owners, so a failed save still refuses navigation. Install last. */
(()=>{
 if(window.homeTabs)return;
 const MAX_TABS=24,TAB_MIN=150;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=d=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
 const ICONS={home:'<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',flask:'<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="M7 7l10 10M17 7 7 17"/>',chev:'<path d="m7 10 5 5 5-5"/>',doc:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 15h5"/>',slides:'<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 11h6"/>',piece:'<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M8 9h8M8 12h8M8 15h5"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',moon:'<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',more:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'};
 let queue=Promise.resolve(),statusFilter='',lastPaint='',findQuery='',lastProject=null,resultsObserver=null,finderReturnFocus=null;
 const nav=()=>{state.projectNavigation||={recent:[]};if(!Array.isArray(state.projectNavigation.openTabs))state.projectNavigation.openTabs=[];return state.projectNavigation;};
 const project=id=>state.projects.find(p=>p.id===id);
 const tabKey=t=>t.projectId+'::'+(t.outputId||'');
 const tabs=()=>nav().openTabs.filter(t=>project(t.projectId));
 const library=()=>document.getElementById('project-library');
 const homeOpen=()=>!!library()?.open&&!library()?.dataset.plContext;
 const stage=()=>Number(current().viewedStage)||(current().view==='article'?5:0);
 const note=p=>p.archived?'Archived':p.step||p.status||'Material';
 function message(text){const node=document.querySelector('#c3-tabstrip [data-ht-status]');if(node){node.textContent=text||'';node.hidden=!text;}}
 function serial(action){queue=queue.then(async()=>{try{message('');await action();}catch(error){message(error.message||'That could not finish. Your current work is retained.');}finally{paint();}});return queue;}
 function store(){try{save();}catch{message('Open tabs could not be stored in this browser. Your work is unchanged.');}}
 function here(){const p=current(),o=window.workspaceNavigation?.selectedOutput?.()||null;return {projectId:p.id,outputId:o?.id||'',title:o?.title||p.name,format:o?.format||''};}
 // The current place always has a tab while Home is closed. An output tab replaces the bare piece tab of the same piece.
 function track(){
  if(homeOpen()||!state?.projects?.length)return;
  const h=here(),list=nav().openTabs;let changed=false;
  const found=list.find(t=>tabKey(t)===tabKey(h));
  if(found){if(found.title!==h.title||found.format!==h.format){found.title=h.title;found.format=h.format;changed=true;}}
  else{
   if(h.outputId){const bare=list.findIndex(t=>t.projectId===h.projectId&&!t.outputId);if(bare>=0)list.splice(bare,1);}
   list.push({...h,openedAt:Date.now()});changed=true;
   while(list.length>MAX_TABS){const i=list.findIndex(t=>tabKey(t)!==tabKey(h));if(i<0)break;list.splice(i,1);}
  }
  for(let i=list.length-1;i>=0;i--)if(!project(list[i].projectId)){list.splice(i,1);changed=true;}
  if(changed)store();
 }
 function isCurrent(t){if(homeOpen())return false;const h=here();return tabKey(t)===tabKey(h);}
 function midTrim(t,max){t=String(t||'');if(t.length<=max)return t;const tail=Math.max(6,Math.floor(max*.35));return t.slice(0,max-tail-1).trimEnd()+'…'+t.slice(-tail).trimStart();}
 function tabIcon(t){return icon(t.format==='Carousel'?ICONS.slides:t.outputId?ICONS.doc:ICONS.piece);}
 function tabLabel(t){const p=project(t.projectId);return t.outputId?`${t.title} · ${t.format||'output'} · ${p?.name||''}`:`${p?.name||t.title} · piece`;}
 function tabHTML(t,inMenu=false){const k=esc(tabKey(t)),cur=isCurrent(t),label=esc(tabLabel(t));return `<div class="ht-tab ${cur?'on':''} ${inMenu?'ht-menu-tab':''}" role="presentation"><button type="button" class="ht-open" data-ht-tab="${k}" ${cur?'aria-current="page"':''} title="${label}">${tabIcon(t)}<span class="ht-title">${esc(midTrim(t.outputId?t.title:project(t.projectId)?.name||t.title,26))}</span></button><button type="button" class="ht-close" data-ht-close="${k}" aria-label="Close tab ${label}" title="Close tab. Nothing is deleted.">${icon(ICONS.x)}</button></div>`;}
 function visibleCount(strip,total){const width=strip?.clientWidth||0;if(!width)return total;const fixed=width<=650?190:330;return Math.max(1,Math.floor((width-fixed)/TAB_MIN));}
 function strip(){let node=document.getElementById('c3-tabstrip');if(node)return node;node=document.createElement('header');node.id='c3-tabstrip';node.setAttribute('aria-label','Home, Research and open tabs');document.body.prepend(node);document.body.classList.add('c3-tabs');window.requestAnimationFrame?.(()=>paint());return node;}
 function paint(){
  if(!state?.projects?.length)return;
  const node=strip(),all=tabs(),home=homeOpen(),research=!home&&stage()===3;
  // Keep the current tab visible even when the rest overflow into More.
  const n=visibleCount(node,all.length),cur=all.findIndex(isCurrent);let shown=all.slice(0,n);
  if(cur>=n&&n>0)shown=[...all.slice(0,n-1),all[cur]];
  const hidden=all.filter(t=>!shown.includes(t));
  const html=`<button type="button" class="ht-place ${home?'on':''}" data-ht-home ${home?'aria-current="page"':''} aria-label="Home, every piece" title="Home · every piece">${icon(ICONS.home)}</button><button type="button" class="ht-place ${research?'on':''}" data-ht-research ${research?'aria-current="page"':''} aria-label="Research for the current piece" title="Research · current piece. Across every piece is not connected yet.">${icon(ICONS.flask)}</button><span class="ht-sep" aria-hidden="true"></span><nav class="ht-tabs" aria-label="Open tabs">${shown.map(t=>tabHTML(t)).join('')}</nav>${hidden.length?`<details class="ht-more"><summary aria-label="${hidden.length} more open tabs" title="Open tabs that do not fit">+${hidden.length}${icon(ICONS.chev)}</summary><div class="ht-menu" role="group" aria-label="More open tabs">${hidden.map(t=>tabHTML(t,true)).join('')}</div></details>`:''}<details class="ht-plus"><summary aria-label="Open or create" title="Open or create">${icon(ICONS.plus)}<span class="ht-plus-label">New</span></summary><div class="ht-menu" role="group" aria-label="Open or create"><button type="button" data-pl-new>New project</button><button type="button" data-ht-new-output>New output for this piece</button><button type="button" data-ht-home>Find any piece</button></div></details><span class="ht-grow" aria-hidden="true"></span><details class="ht-switch"><summary title="Find any piece and open it" aria-label="${esc(home?'All subjects':current().name+', switch subject')}">${icon(ICONS.list)}<span class="ht-switch-label">${esc(home?'All subjects':current().name)}</span>${icon(ICONS.chev)}</summary><div class="ht-menu ht-switch-menu" role="dialog" aria-label="Projects and tools"><label class="ht-find">${icon(ICONS.search)}<span class="ht-sr">Find a project or tool</span><input type="search" data-ht-find autocomplete="off" placeholder="Find a project or tool"></label><div data-ht-find-results></div><button type="button" class="ht-find-all" data-ht-home>${icon(ICONS.home)}<span>See all ${state.projects.filter(p=>!p.archived).length} subjects</span></button></div></details><button type="button" class="ht-place ht-theme" data-ht-theme aria-label="${themeLabel()}" title="${themeLabel()}">${icon(document.documentElement.dataset.theme==='dark'?ICONS.sun:ICONS.moon)}</button><p class="ht-status" role="status" data-ht-status hidden></p>`;
  const status=node.querySelector('[data-ht-status]')?.textContent||'';
  if(html!==lastPaint||!node.firstChild){const openMenus=[...node.querySelectorAll('details[open]')].map(d=>d.className);node.innerHTML=html;lastPaint=html;const moved=lastProject!==current().id;lastProject=current().id;openMenus.forEach(c=>{if(moved&&c.includes('ht-switch')){findQuery='';return;}const d=node.querySelector('details.'+c.split(' ')[0]);if(d)d.open=true;});}
  if(status)message(status);
  const find=node.querySelector('[data-ht-find]');if(find&&find.value!==findQuery)find.value=findQuery;findResults();
  place(node);
  window.dispatchEvent(new CustomEvent('c3-header-painted'));
 }
 function themeLabel(){return document.documentElement.dataset.theme==='dark'?'Switch to light theme':'Switch to dark theme';}
 function findRow(p){return `<button type="button" class="ht-find-row" data-pl-open="${esc(p.id)}" title="${esc(p.name)}">${icon(ICONS.piece)}<span><strong>${esc(p.name)}</strong><small>${esc([p.folder||'Projects',note(p)].join(' · '))}</small></span></button>`;}
 function toolChoices(){
  const labels=['Library','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
  return [...document.querySelectorAll('.workflowNavigation .workflowStep')].map((button,index)=>({number:Number(button.dataset.stage||button.querySelector('.stepNumber')?.textContent)||index+1,button})).filter(t=>labels[t.number-1]).map(t=>({...t,label:labels[t.number-1],disabled:t.button.disabled}));
 }
 function toolRow(t){return `<button type="button" class="ht-find-row" data-ht-tool="${t.number}" ${t.disabled?'disabled':''}>${icon(ICONS.piece)}<span><strong>${esc(t.label)}</strong><small>Tool · current project</small></span></button>`;}
 function findResults(){
  const host=document.querySelector('#c3-tabstrip [data-ht-find-results]');if(!host)return;
  const q=findQuery.trim().toLocaleLowerCase(),tools=toolChoices().filter(t=>!q||t.label.toLocaleLowerCase().includes(q));let html;
  if(q){const rows=state.projects.filter(p=>!p.archived&&[p.name,p.folder].filter(Boolean).join(' ').toLocaleLowerCase().includes(q)).slice(0,8);html=(rows.length?'<div class="ht-find-h">Projects</div>'+rows.map(findRow).join(''):'')+(tools.length?'<div class="ht-find-h">Tools</div>'+tools.map(toolRow).join(''):'');if(!html)html='<p class="ht-find-empty">No project or tool matches. Try a shorter name or a folder.</p>';}
  else{const pinned=state.projects.filter(p=>p.pinnedAt&&!p.archived).sort((a,b)=>b.pinnedAt-a.pinnedAt),used=new Set(pinned.map(p=>p.id)),recent=(nav().recent||[]).map(project).filter(p=>p&&!p.archived&&!used.has(p.id));recent.forEach(p=>used.add(p.id));const openIds=[...new Set(tabs().map(t=>t.projectId))].filter(id=>!used.has(id)),open=openIds.map(project).filter(p=>p&&!p.archived);html=`${pinned.length?'<div class="ht-find-h">Pinned</div>'+pinned.map(findRow).join(''):''}${recent.length?'<div class="ht-find-h">Recent</div>'+recent.slice(0,5).map(findRow).join(''):''}${open.length?'<div class="ht-find-h">Open tabs</div>'+open.map(findRow).join(''):''}${tools.length?'<div class="ht-find-h">Tools</div>'+tools.map(toolRow).join(''):''}`;}
  if(host.dataset.render!==html){host.innerHTML=html;host.dataset.render=html;}
 }
 async function openFinder(){
  await flush();await leaveHome();finderReturnFocus=document.activeElement;findQuery='';paint();
  const finder=document.querySelector('#c3-tabstrip .ht-switch');if(!finder)throw Error('The project finder is not available. Your current work is retained.');finder.open=true;finder.querySelector('[data-ht-find]')?.focus();
 }
 async function openTool(number){const tool=toolChoices().find(t=>t.number===number);if(!tool||tool.disabled)return;await flush();await leaveHome();await viewPhase(number);}
 // While Home is open the strip lives inside the modal library so it stays reachable. Otherwise it is no longer a row of
 // its own: it is the head of the sidebar (Home, the piece switcher, New), above the steps (review A3).
 function place(node){const d=library();if(homeOpen()){decorateHome(d);if(node.parentElement!==document.body){node.querySelectorAll('details[open]').forEach(m=>m.open=false);document.body.prepend(node);}document.body.classList.remove('c3-strip-in-rail');return;}
  if(node.parentElement!==document.body)document.body.prepend(node);document.body.classList.remove('c3-strip-in-rail');}
 async function flush(){if(window.studyOutputConnection?.flush)await window.studyOutputConnection.flush();else{const proof=await window.studyDraft?.flush?.();if(proof?.dirty)throw Error('Save or resolve the current changes before continuing.');}}
 async function leaveHome(){if(homeOpen())await window.projectLibrary.close();if(homeOpen())throw Error('Home is still open because the current work needs saving first.');}
 async function activate(k){
  const t=tabs().find(x=>tabKey(x)===k);if(!t)return;
  if(isCurrent(t))return;
  await flush();
  if(current().id!==t.projectId){await window.projectLibrary?.whenIdle?.();await window.switchProject(t.projectId);if(current().id!==t.projectId)throw Error('The piece did not open. Save or resolve the current changes, then try the tab again.');}
  await leaveHome();
  if(!t.outputId||window.workspaceNavigation?.selectedOutput?.()?.id===t.outputId)return;
  const data=await window.realOutputOverview?.read?.({projectId:t.projectId}),o=data?.outputs?.find(x=>x.id===t.outputId);
  if(!o)throw Error(`“${t.title}” is no longer an output of ${project(t.projectId)?.name||'this piece'}. Close its tab; nothing was deleted.`);
  await window.studyOutputConnection.selectOutput({projectId:t.projectId,outputId:o.id});
  if(o.format==='Carousel')await window.realOutputOverview.onAction({projectId:t.projectId,outputId:o.id,kind:'words'});
  else{await window.realOutputOverview.onAction({projectId:t.projectId,outputId:o.id,kind:'native'});await viewPhase(5);}
 }
 async function closeTab(k){
  const list=nav().openTabs,i=list.findIndex(t=>tabKey(t)===k);if(i<0)return;
  const wasCurrent=isCurrent(list[i]);if(wasCurrent)await flush();
  list.splice(i,1);store();
  if(wasCurrent)await window.projectLibrary.open();
 }
 async function newOutput(){await leaveHome();const menu=document.querySelector('#work-context details.wn-new');if(!menu)throw Error('Open a piece with a working manuscript to create an output.');menu.open=true;menu.querySelector('summary')?.focus();}
 // ---------- Home: the existing library, full screen, with facets and a grid/list view ----------
 function base(filter){return state.projects.filter(p=>filter==='archive'?p.archived:filter==='all'?true:filter==='pinned'?p.pinnedAt&&!p.archived:!p.archived);}
 function counts(list,by){const m=new Map();for(const p of list){const k=by(p);m.set(k,(m.get(k)||0)+1);}return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
 function facetButton(attr,value,label,n,on,dot=false){return `<button type="button" class="ht-facet ${on?'on':''}" ${attr}="${esc(value)}" aria-pressed="${on}">${dot?'<i class="ht-dot" aria-hidden="true"></i>':''}<span>${esc(label)}</span><span class="ht-count">${n}</span></button>`;}
 function facets(){
  const filter=window.projectLibrary?.filterValue?.()||'active',show=filter.startsWith('folder:')?'active':filter,folder=filter.startsWith('folder:')?filter.slice(7):'';
  const shows=[['active','Active'],['pinned','Pinned'],['archive','Archived'],['all','All, including archived']];
  const scoped=base(show),folders=counts(scoped,p=>p.folder||'Projects'),inFolder=scoped.filter(p=>!folder||(p.folder||'Projects')===folder),statuses=counts(inFolder,note);
  const on=[folder,statusFilter,show!=='active'?shows.find(([v])=>v===show)?.[1]:''].filter(Boolean);
  return `<details class="ht-filter" data-ht-filter><summary>${icon(ICONS.list)}<span>Filter</span>${on.length?`<span class="ht-filter-on">${esc(on.join(' · '))}</span>`:''}</summary><div class="ht-filter-panel" role="group" aria-label="Filter pieces"><div class="ht-fgroup" role="group" aria-label="Brand or folder"><div class="ht-fh">Brand</div>${facetButton('data-ht-folder','','All brands',scoped.length,!folder)}${folders.map(([f,n])=>facetButton('data-ht-folder',f,f,n,folder===f)).join('')}</div><div class="ht-fgroup" role="group" aria-label="Status"><div class="ht-fh">Status</div>${facetButton('data-ht-status-filter','','Any status',inFolder.length,!statusFilter)}${statuses.map(([s,n])=>facetButton('data-ht-status-filter',s,s,n,statusFilter===s,true)).join('')}</div><div class="ht-fgroup" role="group" aria-label="Show"><div class="ht-fh">Show</div>${shows.map(([v,l])=>facetButton('data-ht-show',v,l,base(v).length,show===v&&!folder)).join('')}</div>${folder||statusFilter||show!=='active'?'<button type="button" class="ht-clear" data-ht-clear>Clear filters</button>':''}<p class="ht-fnote">Brands are your folders. Folders and pins are browser-local filing.</p></div></details>`;
 }
 function decorateHome(d){
  if(!d||d.dataset.plContext||d.dataset.workbenchPieces==='true')return;
  if(!d.classList.contains('c3-home')){
   d.classList.add('c3-home');
   const title=d.querySelector('#pl-title');if(title){title.textContent='Home · every piece';title.classList.add('ht-sr');}
   const close=d.querySelector('[data-pl-close]');if(close){close.textContent='Continue where I left off';close.classList.add('ht-primary');}
   const bar=document.createElement('div');bar.className='ht-homebar';
   const search=d.querySelector('.pl-search');if(search){search.classList.add('ht-find');search.firstChild?.nodeType===3&&search.firstChild.replaceWith(Object.assign(document.createElement('span'),{className:'ht-sr',textContent:'Search all pieces'}));search.insertAdjacentHTML('afterbegin',icon(ICONS.search));}
   const input=d.querySelector('[data-pl-search]');if(input)input.placeholder='Search '+state.projects.filter(p=>!p.archived).length+' pieces by name or folder';
   const actions=document.createElement('div');actions.className='ht-homebar-actions';
   const newer=d.querySelector('.pl-toolbar [data-pl-new]');if(newer){newer.textContent='New piece';actions.append(newer);}
   if(close)actions.append(close);
   if(search)bar.append(search);bar.append(actions);
   const body=document.createElement('div');body.className='ht-home-body';
   const aside=document.createElement('aside');aside.className='ht-facets';aside.setAttribute('aria-label','Filter pieces');
   const main=document.createElement('section');main.className='ht-home-main';main.setAttribute('aria-label','All pieces');
   for(const child of [...d.children])if(child.id!=='c3-tabstrip')main.append(child);
   const views=document.createElement('div');views.className='ht-views';views.setAttribute('role','group');views.setAttribute('aria-label','View');
   main.querySelector('.pl-results-head')?.append(views);
   body.append(aside,main);d.append(bar,body);
   resultsObserver=new MutationObserver(()=>cards(d));resultsObserver.observe(d.querySelector('[data-pl-results]'),{childList:true});
  }
  const mode=nav().homeView==='list'?'list':'grid',grouping=['folder','status'].includes(nav().homeGroup)?nav().homeGroup:'none';
  const views=d.querySelector('.ht-views'),viewsHTML=`<span class="ht-seg-l">Group</span><span class="ht-seg" role="group" aria-label="Group by">${[['none','None'],['folder','Brand'],['status','Status']].map(([v,l])=>`<button type="button" class="ht-view ${grouping===v?'on':''}" data-ht-group="${v}" aria-pressed="${grouping===v}">${l}</button>`).join('')}</span><span class="ht-seg" role="group" aria-label="View">${[['grid','Grid'],['list','List']].map(([v,l])=>`<button type="button" class="ht-view ${mode===v?'on':''}" data-ht-view="${v}" aria-pressed="${mode===v}">${icon(ICONS[v])}<span>${l}</span></button>`).join('')}</span>`;if(views&&views.dataset.render!==viewsHTML){views.innerHTML=viewsHTML;views.dataset.render=viewsHTML;}
  d.querySelector('[data-pl-results]')?.classList.toggle('ht-grid',mode==='grid');
  const aside=d.querySelector('.ht-facets'),html=facets();if(aside&&aside.dataset.render!==html){const open=!!aside.querySelector('details.ht-filter')?.open;aside.innerHTML=html;aside.dataset.render=html;if(open)aside.querySelector('details.ht-filter').open=true;}
  cards(d);
 }
 // Cards: a cover, the name, folder and status; pin and organize move, unchanged, into a ⋯ menu. Optional grouping.
 function cards(d){
  const host=d?.querySelector('[data-pl-results]');if(!host)return;
  const count=d.querySelector('[data-pl-count]');if(count&&/project/.test(count.textContent))count.textContent=count.textContent.replace(/projects?/,w=>w==='project'?'piece':'pieces');
  const rows=[...host.querySelectorAll(':scope>.pl-library-row')];
  for(const row of rows){
   if(row.dataset.htCard)continue;row.dataset.htCard='true';
   const open=row.querySelector('.pl-open'),p=project(open?.dataset.plOpen);if(!open||!p)continue;
   open.insertAdjacentHTML('afterbegin',`<span class="ht-cover" aria-hidden="true"><span>${esc(p.name)}</span></span>`);
   const meta=open.querySelector('span:not(.ht-cover):not(.ht-cover *)');if(meta)meta.insertAdjacentHTML('afterbegin','<i class="ht-dot" aria-hidden="true"></i>');
   const pin=row.querySelector('.pl-pin'),file=row.querySelector('[data-pl-file]');
   const more=document.createElement('details');more.className='ht-card-more';
   more.innerHTML=`<summary aria-label="More for ${esc(p.name)}" title="Pin, organize">${icon(ICONS.more)}</summary><div class="ht-menu" role="group" aria-label="More for ${esc(p.name)}"></div>`;
   const menu=more.querySelector('.ht-menu');
   if(pin){pin.insertAdjacentHTML('beforeend',`<span>${p.pinnedAt?'Unpin':'Pin'}</span>`);menu.append(pin);}
   if(file){file.textContent='Organize';menu.append(file);}
   row.append(more);
  }
  host.querySelectorAll(':scope>.ht-ghead').forEach(n=>n.remove());
  const grouping=nav().homeGroup;if(!['folder','status'].includes(grouping)){resultsObserver?.takeRecords();return;}
  const key=row=>{const p=project(row.querySelector('.pl-open')?.dataset.plOpen);return p?(grouping==='folder'?p.folder||'Projects':note(p)):'';};
  const sorted=rows.slice().sort((a,b)=>key(a).localeCompare(key(b)));let last=null;
  for(const row of sorted){const k=key(row);if(k!==last){const n=sorted.filter(r=>key(r)===k).length,h=document.createElement('div');h.className='ht-ghead';h.innerHTML=`${esc(k)}<span>${n}</span>`;host.append(h);last=k;}host.append(row);}
  resultsObserver?.takeRecords();
 }
 function setFilter(value){const select=library()?.querySelector('[data-pl-filter]');if(!select)return;if(![...select.options].some(o=>o.value===value))return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}
 async function setStatus(value){statusFilter=value;await window.projectLibrary.setRefine(value?p=>note(p)===value:null);}
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('#c3-tabstrip button,#c3-tabstrip summary,#project-library .ht-facets button,#project-library [data-ht-view],#project-library [data-ht-group]');
  if(!button||button.matches('[data-pl-new],[data-pl-open]'))return;
  if(button.matches('summary'))return;
  event.preventDefault();
  for(const d of document.querySelectorAll('#c3-tabstrip details[open]'))if(!d.contains(button)||button.closest('.ht-menu'))d.open=false;
  void serial(async()=>{
   if(button.hasAttribute('data-ht-tool'))return openTool(Number(button.dataset.htTool));
   if(button.hasAttribute('data-ht-home'))return homeOpen()?library().querySelector('[data-pl-search]')?.focus():window.projectLibrary.open();
   if(button.hasAttribute('data-ht-research')){await flush();await leaveHome();if(stage()!==3)await viewPhase(3);return;}
   if(button.hasAttribute('data-ht-tab'))return activate(button.dataset.htTab);
   if(button.hasAttribute('data-ht-close'))return closeTab(button.dataset.htClose);
   if(button.hasAttribute('data-ht-new-output'))return newOutput();
   if(button.hasAttribute('data-ht-show')){await setStatus('');return setFilter(button.dataset.htShow);}
   if(button.hasAttribute('data-ht-folder')){await setStatus('');return setFilter(button.dataset.htFolder?'folder:'+button.dataset.htFolder:'active');}
   if(button.hasAttribute('data-ht-status-filter'))return setStatus(button.dataset.htStatusFilter);
   if(button.hasAttribute('data-ht-clear')){await setStatus('');return setFilter('active');}
   if(button.hasAttribute('data-ht-view')){nav().homeView=button.dataset.htView;store();decorateHome(library());}
   if(button.hasAttribute('data-ht-group')){nav().homeGroup=button.dataset.htGroup;store();decorateHome(library());}
   if(button.hasAttribute('data-ht-theme')){state.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';store();applyTheme();const select=document.querySelector('.themeSelect');if(select)select.value=state.theme;}
  });
 });
 document.addEventListener('input',event=>{if(!event.target.matches?.('#c3-tabstrip [data-ht-find]'))return;findQuery=event.target.value;findResults();});
 document.addEventListener('keydown',event=>{
  const finder=document.querySelector('#c3-tabstrip .ht-switch[open]');if(!finder)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finder.open=false;const target=finderReturnFocus?.isConnected?finderReturnFocus:finder.querySelector('summary');target?.focus?.({preventScroll:true});finderReturnFocus=null;return;}
  if(!finder.contains(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
  const rows=[...finder.querySelectorAll('[data-ht-find-results] button:not(:disabled)')],at=rows.indexOf(event.target);
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){if(!rows.length)return;event.preventDefault();const next=at<0?(event.key==='ArrowDown'?0:rows.length-1):(at+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[next].focus();}
  else if(event.key==='Enter'&&event.target.matches('[data-ht-find]')&&rows.length){event.preventDefault();rows[0].click();}
 },true);

 document.addEventListener('toggle',event=>{const d=event.target;if(!d.matches?.('.ht-card-more,#c3-tabstrip details')||!d.open)return;if(d.closest('.c3-rail')){const r=d.querySelector('summary').getBoundingClientRect();d.style.setProperty('--ht-mx',Math.round(Math.min(r.left,Math.max(8,innerWidth-372)))+'px');d.style.setProperty('--ht-my',Math.round(r.bottom+4)+'px');}document.querySelectorAll('.ht-card-more[open],#c3-tabstrip details[open]').forEach(o=>{if(o!==d&&!o.contains(d))o.open=false;});if(d.matches('.ht-switch'))d.querySelector('[data-ht-find]')?.focus();},true);
 // Facet counts follow the library's own filter changes and result repaints.
 document.addEventListener('change',event=>{if(event.target.matches?.('#project-library [data-pl-filter]'))void window.projectLibrary.whenIdle().then(()=>{if(homeOpen())decorateHome(library());});});
 const previousRender=window.render;
 window.render=function(...args){const result=previousRender.apply(this,args);if(result?.then)return result.then(value=>{track();paint();return value;});track();paint();return result;};
 const observer=new MutationObserver(()=>{const d=library();if(d&&!d.dataset.htWatched){d.dataset.htWatched='true';new MutationObserver(()=>{track();paint();}).observe(d,{attributes:true,attributeFilter:['open']});d.addEventListener('close',()=>{track();paint();});}});
 observer.observe(document.body,{childList:true});
 for(const name of ['study-output-selection','study-draft-change'])window.addEventListener(name,()=>{track();paint();});
 window.addEventListener('resize',()=>paint());
 window.c3Shell?.register?.('sidebar head',()=>{const n=document.getElementById('c3-tabstrip');if(n)place(n);},{order:25});
 window.homeTabs={tabs,paint,track,openFinder:()=>serial(openFinder),activate:k=>serial(()=>activate(k)),close:k=>serial(()=>closeTab(k)),whenIdle:()=>queue};
 track();paint();
})();
