/* Full Workbench frame from design/three-directions/c-workbench (final NOTES).
   Presentation only: existing editor, note, history, source and switch owners remain the same nodes.
   No copied prototype records, business writes or second manuscript. */
(()=>{
 if(window.c3WorkbenchFrame)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={write:'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',understanding:'M5 5h14v10H9l-4 4z',panelR:'M4 4h16v16H4zM15 4v16',read:'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z',check:'M5 12l4 4L19 6',history:'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',sources:'M6 3h9l4 4v14H6zM15 3v4h4',close:'M6 6l12 12M18 6L6 18',pieces:'M6 3h9l4 4v14H6zM15 3v4h4',chev:'M9 6l6 6-6 6'};
 const ic=k=>`<svg class="ic sm" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]||paths.pieces}"/></svg>`;
 const railPaths={"1": "M5 4h4v16H5zM11 4h4v16h-4zM17 4l3 1v15l-3-1z", "2": "M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2", "3": "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l4 4", "4": "M12 3v18M5 5h11l3 3-3 3H5zM9 15h-4", "5": "M4 20h4L19 9l-4-4L4 16zM14 6l4 4", "6": "M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z", "7": "M5 12l4 4L19 6", "8": "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01", "9": "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", "10": "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z", "11": "M4 12v7h16v-7M12 3v12M8 7l4-4 4 4", "12": "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"};
 const stage=()=>{try{const p=current();return p.view==='article'?5:Number(p.viewedStage)||0}catch{return 0}};
 let tool='',mounted=null,homeMode='bench',returnFocus=null,restorations=[],benchReturn=null,decoratedStage=null,compareIntent=0,compareBusy=false;
 const ws=()=>document.querySelector('#app #workspace');
 const actualBench=()=>window.AR_CREATE_REVIEW_MODE?.actualWork===true;
 let benchCatalog=null,benchQuery='',benchLimit=30,benchMessage='',benchActionBusy=false;
 const benchHidden=new Map();
 const benchTitle=row=>window.arCreateDisplay?.title({title:row.title})||row.title;
 function restoreBenchInventory(){for(const [node,old]of benchHidden){node.hidden=old.hidden;node.style.cssText=old.style;}benchHidden.clear();}
 function setBenchCatalog(payload={}){
  if(!actualBench())return false;
  const old=benchCatalog;
  // Callbacks may be replaced without repainting the same metadata under an observer.
  const token=JSON.stringify([payload.scope,payload.ready,payload.error,payload.current,payload.history,payload.capabilities]);
  if(old&&old.catalog===payload.catalog&&old.token===token){old.open=payload.open;old.refresh=payload.refresh;bench();return true;}
  try{if(!window.arCreateBenchProjection)throw Error('The Bench connection is unavailable.');const projection=window.arCreateBenchProjection.project(payload);if(old&&old.scope!==payload.scope){benchQuery='';benchLimit=30;}benchCatalog={...payload,projection,token,ready:projection.ready};benchMessage=payload.error?'Work could not refresh. Saved references remain available.':'';bench();return true;}
  catch(error){if(old){old.ready=false;if(old.scope!==payload.scope)benchCatalog=null;}benchMessage=window.arCreateDisplay?.error(error,'The work list could not refresh. Try again.')||'The work list could not refresh. Try again.';bench();return false;}
 }
 async function openBenchWork(targetKey){
  const entry=benchCatalog;if(benchActionBusy)return;
  try{const descriptor=window.arCreateBenchProjection.descriptor(entry?.projection,targetKey,{scope:entry?.scope,revision:entry?.projection?.revision,ready:entry?.ready});if(typeof entry.open!=='function')throw Error('This work is not connected to an opening action.');benchActionBusy=true;benchMessage='';await entry.open(descriptor);}
  catch(error){if(entry===benchCatalog)benchMessage=window.arCreateDisplay?.error(error,'This work could not open. Your current words are retained.')||'This work could not open. Your current words are retained.';}
  finally{benchActionBusy=false;bench();}
 }
 function renderCatalogBench(section,d){
  for(const selector of ['.ht-homebar','.pl-results-head','[data-pl-results]','.pl-more']){const owner=d.querySelector(selector);if(owner&&!section.contains(owner)){if(!benchHidden.has(owner))benchHidden.set(owner,{hidden:owner.hidden,style:owner.style.cssText});if(!owner.hidden)owner.hidden=true;if(owner.style.getPropertyValue('display')!=='none')owner.style.setProperty('display','none','important');}}
  const entry=benchCatalog,model=entry?.projection,connected=!!entry?.ready&&!!model?.ready&&typeof entry.open==='function';
  const action=(row,label,primary=false)=>`<button type="button" class="${primary?'btn primary':'lnk'}" data-wbf-bench-open="${esc(row.key)}" ${connected&&row.available&&!benchActionBusy?'':'disabled'}>${esc(label)}${primary?' '+ic('chev'):''}</button>`;
  const title='<div class="thead"><h1>The bench<span class="sub"> · All projects</span></h1></div>';
  const notice=benchMessage?`<p role="status">${esc(benchMessage)}</p>`:model&&!model.ready?'<p class="dim small" role="status">Saved work list · checking for updates…</p>':'';
  if(!model||model.state==='pending'){setHTML(section.querySelector('.wbf-bench-story'),title+notice+(!benchMessage?'<p role="status">Reading your projects and pieces…</p>':'')+(typeof entry?.refresh==='function'?'<button type="button" class="lnk" data-wbf-bench-refresh>Try again</button>':''));setHTML(section.querySelector('.wbf-active'),'');return;}
  const row=model.current;
  const excerpt=entry.current?.excerpt,exactExcerpt=row&&excerpt?.source==='loaded-owner'&&window.arCreateBenchProjection.key(excerpt.target)===row.key&&typeof excerpt.text==='string'?excerpt.text.slice(0,330):'';
  const current=row?`<h2>${esc(benchTitle(row))}<span class="sub"> · ${esc(row.kind)}</span></h2><div class="meta">${esc(row.projectTitle)} · ${esc(row.saveLabel)}</div>${exactExcerpt?`<blockquote>${esc(exactExcerpt)}</blockquote>`:''}<div class="acts">${action(row,row.resumeLabel,true)}</div><div class="since"><div class="lab">Recent saved activity</div>${model.history.length?`<ul>${model.history.map(e=>`<li><i></i><span>${esc(e.label)}<small>${esc(e.actor)} · ${esc(new Date(e.at).toLocaleString())}</small></span></li>`).join('')}</ul>`:'<p class="dim small">No saved activity is available for this piece.</p>'}</div>`:'<h2>Choose work to continue</h2><p class="dim">Find a project or piece below. Its saved location and history stay with its owner.</p>';
  const moves=`<section class="block"><h2 class="sec">Next moves</h2>${model.moves.length?`<ol class="moves">${model.moves.map(move=>`<li><button type="button" class="move" data-wbf-bench-open="${esc(move.key)}" ${connected&&!benchActionBusy?'':'disabled'}>${ic('pieces')}<span><span class="t">${esc((move.target.kind==='draft'?'Read ':move.target.kind==='carousel'?'View ':'Open ')+benchTitle(move))}</span><br><span class="w">${esc(move.projectTitle)} · ${esc(move.kind)}</span></span>${ic('chev')}</button></li>`).join('')}</ol>`:'<p class="dim small">No connected next move is recorded. Your saved work remains below.</p>'}</section>`;
  setHTML(section.querySelector('.wbf-bench-story'),title+notice+`<section class="pickup" aria-label="Pick up where you left off"><div class="lab">Pick up where you left off</div>${current}</section>`+moves);
  const q=benchQuery.toLocaleLowerCase(),filtered=model.rows.filter(row=>!q||[benchTitle(row),row.projectTitle,row.kind].join(' ').toLocaleLowerCase().includes(q)),shown=filtered.slice(0,benchLimit);
  const inventory=section.querySelector('.wbf-active'),search=inventory.querySelector('[data-wbf-bench-search]'),focused=search===document.activeElement,cursor=focused?search.selectionStart:null;
  setHTML(inventory,`<div class="wbf-active-title"><h2 class="sec">Everything active<span class="sub"> · ${benchQuery?filtered.length+' of '+model.rows.length:model.rows.length}</span></h2><span>${typeof entry.refresh==='function'?'<button type="button" class="lnk" data-wbf-bench-refresh>Refresh</button>':''}${d.querySelector('[data-pl-new]')?'<button type="button" class="lnk" data-wbf-new>New project</button>':''}</span></div><div class="ht-homebar"><label class="pl-search search">Find work<input type="search" data-wbf-bench-search value="${esc(benchQuery)}" placeholder="Project or piece" aria-label="Find saved work"></label></div><div class="alist" data-wbf-bench-results>${shown.map(item=>`<div class="pl-library-row wbf-project-row"><button type="button" class="pl-open arow" data-wbf-bench-open="${esc(item.key)}" ${connected&&item.available&&!benchActionBusy?'':'disabled'}><strong class="wbf-project-name">${esc(benchTitle(item))}</strong><span class="s">${esc(item.kind)}${item.kind==='Project'?'':' · '+esc(item.projectTitle)}${item.archived?' · Earlier work':''}</span></button></div>`).join('')||`<p class="dim">${benchQuery?'No matching saved work.':'No saved work is recorded yet.'}</p>`}</div>${shown.length<filtered.length?`<button type="button" class="lnk" data-wbf-bench-more>Show more · ${shown.length} of ${filtered.length}</button>`:''}`);
  if(focused){const replacement=inventory.querySelector('[data-wbf-bench-search]');if(replacement&&replacement!==search){search.value=benchQuery;replacement.replaceWith(search);}search.focus();try{search.setSelectionRange(cursor,cursor);}catch{}}
 }

 function setHTML(node,html){if(node.dataset.render!==html){node.innerHTML=html;node.dataset.render=html;}}
 function restore(){for(const {node,marker}of restorations){if(marker.isConnected){marker.replaceWith(node);}else node.remove();}restorations=[];}
 function move(node,host){if(!node||host.contains(node))return;const marker=document.createComment('Workbench tool return');node.before(marker);restorations.push({node,marker});host.append(node);}
 function stopUnderstanding(d){const host=d?.querySelector('.dr-body'),controller=host?.wbfUnderstanding;if(!controller)return;host.wbfUnderstanding=null;host.wbfUnderstandingKey=null;host.wbfUnderstandingMount=null;controller.cleanup?.();}
 function stopSources(d){const host=d?.querySelector('.dr-body'),controller=host?.wbfSources;if(!controller)return;host.wbfSources=null;controller.cleanup();}
 const sourceStable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 function sourceContext(){
  const p=current(),binding=[5,6,7].includes(stage())?window.studyDraft?.currentBinding?.():null,selected=window.studyOutputConnection?.selection?.();
  if(binding?.parentStudyId&&binding.parentStudyId!==p.id||selected&&selected.projectId!==p.id)throw Error('The selected source scope changed.');
  const nativeOutput=binding?.canonicalOutputId;if(nativeOutput&&selected?.output?.id&&nativeOutput!==selected.output.id)throw Error('The writing and selected source scopes do not agree.');
  const outputId=nativeOutput||selected?.output?.id,rootBindingId=nativeOutput?(binding.sourceBindingId||(selected?.output?.id===nativeOutput?selected.rootBindingId:binding.id)):selected?.rootBindingId;
  if(nativeOutput&&binding.sourceBindingId&&selected?.rootBindingId&&selected.rootBindingId!==binding.sourceBindingId)throw Error('The selected source root changed.');
  if(outputId&&(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(outputId)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(rootBindingId||'')))throw Error('The exact output source connection is unavailable.');
  const scopes=[{scope:'project',parentStudyId:p.id}];if(outputId)scopes.push({scope:'output',parentStudyId:p.id,bindingId:rootBindingId,outputId});
  return{stamp:JSON.stringify([p.id,stage(),binding?.id,binding?.sourceBindingId,nativeOutput,selected?.projectId,selected?.rootBindingId,selected?.output?.id]),request:{scopes,selectedScope:scopes.at(-1),...(outputId?{piece:{parentStudyId:p.id,rootBindingId,selectedOutputId:outputId}}:{})}};
 }
 function mountSources(host){
  const root=document.createElement('section');root.className='wbf-sources-projection';root.dataset.wbfSources='';host.prepend(root);
  const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;},uuid=v=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v||'');
  const abort=new AbortController();let disposed=false,context;
  const active=()=>{try{return !disposed&&root.isConnected&&tool==='sources'&&sourceContext().stamp===context?.stamp;}catch{return false;}};
  function status(message){let el=root.querySelector('[data-wbf-source-status]');if(!el){el=node('p','');el.dataset.wbfSourceStatus='';el.setAttribute('role','status');root.append(el);}el.textContent=message;}
  function action(label,attribute,kind,descriptor){const b=node('button',label);b.type='button';b.setAttribute(attribute,'');b.className='btn quiet';if(typeof window.connectedWorkspace?.openContext!=='function'){b.disabled=true;b.title='The guarded source reader is not connected.';}b.onclick=async()=>{if(!active()||b.disabled)return;b.disabled=true;try{await window.connectedWorkspace.openContext(kind,descriptor);}catch(error){if(active())status(error.message);}finally{if(b.isConnected)b.disabled=false;}};return b;}
  root.append(node('p','Reading saved source references…'));
  const ready=(async()=>{try{
   context=sourceContext();
   const response=await fetch('/api/work-continuity/understanding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request:context.request}),signal:abort.signal}),value=await response.json();
   if(!active()){abort.abort();return;}if(!response.ok)throw Error(value.error||'Saved Library references are unavailable.');
   const request=context.request,scopes=new Set(request.scopes.map(sourceStable));
   if(value?.schema!=='ar-create.current-understanding.projection.v1'||value.readConsistency?.status!=='stable-reread'||!/^[a-f0-9]{64}$/.test(value.fingerprint||'')||!['current','empty','missing','unavailable'].includes(value.status)||sourceStable(value.selection?.scope)!==sourceStable(request.selectedScope)||!Array.isArray(value.records)||value.records.length!==scopes.size||new Set(value.records.map(r=>sourceStable(r.selector))).size!==scopes.size||value.records.some(r=>!scopes.has(sourceStable(r.selector))))throw Error('Saved Library references are unavailable for this exact scope.');
   if(request.piece&&(value.piece?.status!=='current'||value.piece.scope?.parentStudyId!==request.piece.parentStudyId||value.piece.scope?.rootBindingId!==request.piece.rootBindingId||value.piece.scope?.outputId!==request.piece.selectedOutputId))throw Error('This output’s saved Library references are unavailable.');
   const refs=value.records.filter(r=>['current','empty'].includes(r.status)).flatMap(record=>(record.sourceReferences||[]).map(ref=>({record,ref}))),linked=(value.scopeReferences?.effective||[]).filter(ref=>ref.kind==='linked-learning'&&scopes.has(sourceStable(ref.target))&&ref.origin?.selector?.scope==='collection'&&uuid(ref.origin.selector.collectionId));
   let collections=null,collectionError='';if(refs.length||linked.length){try{if(typeof window.connectedWorkspace?.readCollections!=='function')throw Error('Collection relationships are unavailable.');collections=await window.connectedWorkspace.readCollections();if(!active()){abort.abort();return;}if(!Array.isArray(collections?.collections)||!Number.isSafeInteger(collections.revision)||!/^[a-f0-9]{64}$/.test(collections.indexHash||'')||new Set(collections.collections.map(r=>r.id)).size!==collections.collections.length||collections.collections.some(r=>!uuid(r.id)||typeof r.name!=='string'||!Array.isArray(r.sourceIds)))throw Error('Collection relationships are unavailable.');}catch(error){collectionError=error.message;collections=null;}}
   if(!active()){abort.abort();return;}root.replaceChildren(node('p',request.piece?'Saved references · this output; whole-project references labelled separately.':'Saved references · whole project.'));
   const title=node('h3','Library passages');title.style.font='600 var(--t-head)/1.5 var(--ar-ui)';root.append(title);
   for(const {record,ref}of refs){if(!uuid(ref.sourceId)||typeof ref.quote!=='string'||!Number.isSafeInteger(ref.start)||ref.start<0||!/^[a-f0-9]{64}$/.test(ref.sourceHash||''))continue;const row=node('section','');row.dataset.wbfSourceReference=ref.sourceId;row.style.marginBottom='14px';row.append(node('strong',ref.title||'Saved Library source'),node('p',(record.selector.scope==='project'?'Whole project':'This output')+' · '+({ 'current-reference':'Current source wording',stale:'Source changed since this passage was saved',unavailable:'Source unavailable','invalid-reference':'Saved reference unavailable'}[ref.status]||'Source connection not verified')));const quote=node('blockquote',ref.quote);quote.style.whiteSpace='pre-wrap';quote.style.overflowWrap='anywhere';row.append(quote,action('Read source','data-wbf-source-open','source',{sourceId:ref.sourceId}));const memberships=collections?.collections.filter(c=>c.sourceIds.includes(ref.sourceId))||[];if(memberships.length){row.append(node('small','Collections containing this source · not a citation or output link'));for(const collection of memberships)row.append(action(collection.name,'data-wbf-source-collection','inquiries',{collectionId:collection.id,sourceId:ref.sourceId}));}root.append(row);}
   if(!root.querySelector('[data-wbf-source-reference]'))root.append(node('p',refs.length?'Saved Library references could not be confirmed for this scope.':value.records.some(r=>!['current','empty'].includes(r.status))?'Saved Library references are unavailable for part of this scope.':'No saved Library passages supplied for this scope.'));
   if(linked.length){root.append(node('h3','Linked learning'));for(const reference of linked){const id=reference.origin.selector.collectionId,collection=collections?.collections.find(c=>c.id===id);root.append(action(collection?.name||'Open linked Collection','data-wbf-source-linked','inquiries',{collectionId:id}),node('small',reference.target?.scope==='project'?'Whole project · accepted learning reference':'This output · accepted learning reference'));}}
   if(collectionError)status(collectionError);
  }catch(error){if(!disposed&&root.isConnected){if(context&&!active()){abort.abort();return;}root.replaceChildren(node('p','Saved Library references are unavailable. '+error.message));}}
  if(!disposed&&root.isConnected){const limit=node('p','Not connected · Add sources or insert citations into this manuscript. Reading sources and Collections leaves the wording unchanged.');limit.className='dim small';const add=node('button','Add citations · Not connected');add.type='button';add.disabled=true;add.dataset.wbfSourceAdd='';add.title='No maintained citation insertion writer is connected.';root.append(limit,add);}
  })();
  return{ready,cleanup(){if(disposed)return;disposed=true;abort.abort();root.remove();}};
 }
 function closeTool(){compareIntent++;stopSources(document.getElementById('wbf-drawer'));stopUnderstanding(document.getElementById('wbf-drawer'));restore();tool='';const d=document.getElementById('wbf-drawer');d?.wbfEmptyObserver?.disconnect();d?.remove();document.body.classList.remove('wbf-drawer-open');returnFocus?.isConnected&&returnFocus.focus?.({preventScroll:true});}
 function drawer(){
  if(!tool)return;
  let d=document.getElementById('wbf-drawer');if(!d){d=document.createElement('aside');d.id='wbf-drawer';d.setAttribute('aria-label','Tools beside the writing');d.innerHTML='<div class="dr-head"><h2></h2><button class="btn quiet" data-wbf-close aria-label="Close tools">'+ic('close')+'</button></div><div class="dr-tabs" role="tablist"></div><div class="dr-body"></div>';document.body.append(d);}
  setHTML(d.querySelector('h2'),esc(({understanding:'Understanding',check:'Check',history:'History',sources:'Sources',recovery:'Earlier writing & recovery'})[tool])+' <span class="sub">· '+esc(current().name)+'</span>');
  setHTML(d.querySelector('.dr-tabs'),['understanding','check','history','sources'].map(k=>`<button type="button" role="tab" data-wbf-tool="${k}" aria-selected="${tool===k}" class="${tool===k?'on':''}">${({understanding:'Understanding',check:'Check',history:'History',sources:'Sources'})[k]}</button>`).join(''));
  const host=d.querySelector('.dr-body'),ownerKey=tool==='sources'?(()=>{try{return sourceContext().stamp;}catch{return current().id+':unavailable';}})():current().id+':'+(window.studyDraft?.currentBinding?.()?.id||'');
  if(tool!=='sources')stopSources(d);
  const understanding=window.workbenchUnderstanding?.mount;
  if(tool==='understanding'&&typeof understanding==='function'){
   const binding=[5,6,7].includes(stage())?window.studyDraft?.currentBinding?.():null,selection=window.studyOutputConnection?.selection?.();
   const contextKey=JSON.stringify([current().id,binding?.id,binding?.parentStudyId,binding?.sourceBindingId,binding?.canonicalOutputId,selection?.projectId,selection?.rootBindingId,selection?.output?.id]);
   d.wbfEmptyObserver?.disconnect();d.wbfEmptyObserver=null;
   if(host.dataset.tool!==tool||mounted!==ws()||host.wbfUnderstandingKey!==contextKey||host.wbfUnderstandingMount!==understanding){
    stopUnderstanding(d);restore();host.replaceChildren();host.dataset.tool=tool;host.dataset.ownerKey=ownerKey;host.wbfOwner=null;mounted=ws();host.wbfUnderstandingKey=contextKey;host.wbfUnderstandingMount=understanding;
    try{host.wbfUnderstanding=understanding(host,{projectId:current().id});}
    catch(error){const message=document.createElement('p');message.className='dim';message.textContent='Understanding is unavailable: '+error.message;host.append(message);}
   }
   document.body.classList.add('wbf-drawer-open');return;
  }
  stopUnderstanding(d);
  const found=tool==='recovery'?document.querySelector('.draft-bar'):tool==='check'?document.querySelector('.wn-check-findings'):tool==='understanding'?document.querySelector('#c3-insp-decisions #downstream-human-direction,#downstream-human-direction'):tool==='sources'?document.querySelector('.draft-surface-source'):tool==='history'?[...document.querySelectorAll('.draft-bar>.draft-inspect')].find(n=>n.querySelector('summary')?.textContent.trim()==='History'):null;
  const target=(found&&(!found.closest('#wbf-drawer')||host.dataset.ownerKey===ownerKey)?found:null)||(host.dataset.ownerKey===ownerKey&&host.contains(host.wbfOwner)?host.wbfOwner:null);
  // A replaced owner or a story switch must never leave another piece's controls in this drawer.
  if(host.dataset.tool!==tool||mounted!==ws()||host.dataset.ownerKey!==ownerKey||host.wbfOwner!==target){
   stopSources(d);restore();host.replaceChildren();host.dataset.tool=tool;host.dataset.ownerKey=ownerKey;host.wbfOwner=target;mounted=ws();
   if(target){move(target,host);if(target.tagName==='DETAILS')target.open=true;}
   else if(tool==='check'&&window.studyDraftCheck?.mount){host.wbfOwner=window.studyDraftCheck.mount(host);}
   else{const p=document.createElement('p');p.className='dim wbf-drawer-empty';p.textContent=tool==='sources'?'No retained working-file source context is connected to this piece.':tool==='history'?'No earlier saved versions are available for this piece yet.':tool==='understanding'?'No saved direction for this piece yet. Write your thoughts in Direction.':'Checks appear beside the saved manuscript.';host.append(p);}
  }
  if(tool==='sources'&&!host.wbfSources)host.wbfSources=mountSources(host);
  d.wbfEmptyObserver?.disconnect();d.wbfEmptyObserver=null;
  if(tool==='understanding'){
   const owner=host.wbfOwner,refreshEmpty=()=>{const empty=host.querySelector(':scope>.wbf-drawer-empty');if(owner?.textContent.trim())empty?.remove();else if(!empty){const message=document.createElement('p');message.className='dim wbf-drawer-empty';message.textContent='No saved direction for this piece yet. Write your thoughts in Direction.';host.append(message);}};
   refreshEmpty();if(owner instanceof Node){d.wbfEmptyObserver=new MutationObserver(refreshEmpty);d.wbfEmptyObserver.observe(owner,{childList:true,subtree:true,characterData:true});}
  }
  document.body.classList.add('wbf-drawer-open');
 }
 function toolError(error){let status=document.getElementById('wn-message')||document.getElementById('wbf-tool-message');if(!status){status=document.createElement('p');status.id='wbf-tool-message';status.className='dim small';status.setAttribute('role','status');ws()?.prepend(status);}if(status){status.textContent=error.message||'This tool is unavailable. Your current work is retained.';status.hidden=false;}}
 function selectedScopeKey(){const s=window.studyOutputConnection?.selection?.();return JSON.stringify([current().id,s?.projectId,s?.rootBindingId,s?.output?.id]);}
 async function openThought(){
  const id=current().id,n=stage(),scope=selectedScopeKey(),same=()=>current().id===id&&stage()===n&&selectedScopeKey()===scope;
  try{
   const library=document.getElementById('project-library');if(library?.open){await window.projectLibrary.close();if(library.open)throw Error('Save or resolve the open work before adding a thought.');}
   if(!same())throw Error('The selected work changed. Open Add a thought again.');
   if(tool!=='understanding')await openTool('understanding');else decorate();
   const host=document.querySelector('#wbf-drawer .dr-body'),owner=host?.wbfUnderstanding;
   if(!owner)throw Error('The existing shared notes editor is unavailable.');
   await owner.ready;
   if(!same()||tool!=='understanding'||!host.isConnected||host.wbfUnderstanding!==owner)return;
   const editor=host.querySelector('[data-understanding-edit]');if(!editor||editor.disabled)throw Error('The existing shared notes editor is unavailable.');editor.click();
  }catch(error){toolError(error);}
 }
 async function openTool(k){
  returnFocus=document.activeElement;
  if(k==='check'){
   const id=current().id,scope=selectedScopeKey(),connected=window.studyOutputConnection?.selection?.();
   if(![5,6,7].includes(stage())||connected?.output?.kind==='carousel'){
    if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The selected output’s checking connection is unavailable.');
    await window.workspaceNavigation.changeMode('check');
    if(current().id!==id||selectedScopeKey()!==scope||![5,6,7].includes(stage()))throw Error('The selected work changed before Check could open.');
   }
   closeTool();tool='check';mounted=null;decorate();document.querySelector('#wbf-drawer [data-wbf-close]')?.focus({preventScroll:true});return;
  }
  if(tool===k){closeTool();return;}
  restore();tool=k;mounted=null;
  if(k==='history'&&[5,6,7].includes(stage()))await window.studyDraft?.showHistory?.();
  decorate();document.querySelector('#wbf-drawer [data-wbf-close]')?.focus({preventScroll:true});
 }
 function header(){
  const bar=document.getElementById('c3-tabstrip');if(!bar)return;
  bar.classList.add('wbf-top');
  let tools=bar.querySelector(':scope>.wbf-top-actions');if(!tools){tools=document.createElement('div');tools.className='wbf-top-actions';bar.append(tools);}
  const sizeOwner=document.querySelector('#c3-surface-bar .cb-size'),pct=sizeOwner?.querySelector('output')?.textContent||'100%',smaller=!!sizeOwner?.querySelector('[data-cb-size="-1"]')?.disabled,larger=!!sizeOwner?.querySelector('[data-cb-size="1"]')?.disabled;
  setHTML(tools,`<span class="sizer" role="group" aria-label="Text size"><button class="tbtn" data-wbf-size="-1" aria-label="Smaller text" ${smaller?'disabled':''}>A−</button><span class="pct">${esc(pct)}</span><button class="tbtn" data-wbf-size="1" aria-label="Larger text" ${larger?'disabled':''}>A+</button></span><button class="tbtn" data-wbf-thought aria-label="Add a thought">${ic('understanding')}<span class="lbl-wide">Add a thought</span></button><button class="tbtn" data-wbf-tool="understanding" aria-label="Current understanding" aria-expanded="${tool==='understanding'}">${ic('panelR')}<span class="lbl-wide">Understanding</span></button>`);
  const switcher=bar.querySelector('.ht-switch>summary');
  const globalLibrary=!!document.querySelector('#workspace.wfb-showing:not(.wfb-native) .wfb-browser:not(.wfb-picker-browser):not([data-wfb-owner-scoped="true"])'),label=switcher?.querySelector('.ht-switch-label');
  if(label){const text=globalLibrary?'All projects':document.getElementById('project-library')?.open?'All projects':current().name||'Projects';if(label.textContent!==text)label.textContent=text;switcher.setAttribute('aria-label',globalLibrary?'All projects, switch project':text+', switch project');bar.dataset.wbfGlobal=String(globalLibrary);}
  if(switcher&&!switcher.querySelector('.wbf-project-dot')){const dot=document.createElement('span');dot.className='wbf-project-dot';dot.setAttribute('aria-hidden','true');switcher.prepend(dot);const key=document.createElement('kbd');key.className='lbl-wide';key.textContent='⌘K';switcher.append(key);}
  const rail=document.querySelector('.workflowNavigation');
  if(rail&&!rail.querySelector('[data-wbf-pieces]')){const b=document.createElement('button');b.type='button';b.className='wbf-pieces';b.dataset.wbfPieces='';b.innerHTML=ic('pieces')+'<span class="stepName">Pieces</span>';b.title='Browse your pieces';rail.querySelector('.wn-family[data-family="make"] .wn-family-steps')?.prepend(b);}
  for(const button of rail?.querySelectorAll('.workflowStep')||[]){const n=Number(button.querySelector('.stepNumber')?.textContent),svg=button.querySelector('svg'),path=railPaths[n];if(svg&&path&&svg.dataset.wbfPath!==path){svg.innerHTML='<path d="'+path+'"/>';svg.dataset.wbfPath=path;}}
  const home=rail?.querySelector('[data-tr-home]');if(home?.querySelector('svg')&&!home.dataset.wbfIcon){home.querySelector('svg').innerHTML='<path d="M3 10h18M5 10v9M19 10v9M7 6h10M9 14h6"/>';home.dataset.wbfIcon='bench';}if(home&&home.dataset.short!=='Bench'){home.dataset.short='Bench';home.title='The bench · pick up your work';const label=home.querySelector('.tr-label');if(label)label.textContent='Bench';}
 }
 function sectionActions(n,w){
  if([5,6,7].includes(n))return;
  const bar=w.querySelector('#c3-surface-bar'),menu=bar?.querySelector('.sb-menu');
  if(!bar)return;
  bar.dataset.wbfSectionActions='more';
  const more=bar.querySelector('.sb-morew>.sb-btn');if(more){const label=n===9?'Section tools':'More tools';more.setAttribute('aria-label',label);more.title=label;const text=more.querySelector('span'),visibleLabel=n===9?'Section tools':'More';if(text&&text.textContent!==visibleLabel)text.textContent=visibleLabel;}
  // Move the existing proxies, including disabled reasons, into the native menu.
  // Surface-bar owns repainting and dispatch: no second action or copied state.
  if(menu&&!menu.hasAttribute('data-sb-focused-output'))for(const owner of bar.querySelectorAll('.sb-right>:is(.sb-mode,.sb-pw)')){
   // Arrange keeps its maintained reader-preview action beside the composition.
   if(n===9&&owner.classList.contains('sb-pw'))continue;
   owner.classList.add('wbf-section-action');menu.append(owner);
  }
 }
 const carouselLabels=new WeakMap(),carouselActions=new Map();
 function nativeCarouselMode(w){
  try{const p=current(),selected=window.studyOutputConnection?.selection?.(),canvas=window.studyOutputConnection?.canvasProof?.(),owner=selected?.owner,proof=canvas?.writingProof,root=w.querySelector('#study-output-canvas .car-workspace');
   if(p.view!=='record'||Number(p.viewedStage)!==9||!root||selected?.projectId!==p.id||selected.output?.kind!=='carousel'||owner?.kind!=='carousel-words'||proof?.kind!=='carousel-words'||canvas.scope?.parentStudyId!==p.id||!selected.rootBindingId||canvas.scope.rootBindingId!==selected.rootBindingId||canvas.selectedOutputId!==selected.output.id||owner.outputId!==selected.output.id||!['projectId','documentId','outputId'].every(key=>typeof owner[key]==='string'&&!!owner[key]&&proof[key]===owner[key]&&proof.expected?.[key]===owner[key]))return null;
   return root.querySelector('.car-writing-page')?'Write':root.querySelector('.car-stage')?'Arrange':null;
  }catch{return null;}
 }
 function carouselFrame(w,bar){
  if(!bar)return;
  const mode=nativeCarouselMode(w),label=bar?.querySelector('.sb-cp-name');
  if(label){const previous=carouselLabels.get(label);if(mode){if(!previous)carouselLabels.set(label,{before:label.textContent,applied:mode});else previous.applied=mode;if(label.textContent!==mode)label.textContent=mode;}else if(previous){if(label.textContent===previous.applied&&label.textContent!==previous.before)label.textContent=previous.before;carouselLabels.delete(label);}}
  const redundant=mode==='Write'?[...bar.querySelectorAll('.sb-pw')].filter(node=>{const button=node.querySelector('[data-sb-primary]');return button&&/^Write first$/i.test((button.getAttribute('aria-label')||button.textContent).trim());}):[];
  for(const [node,before]of carouselActions)if(!redundant.includes(node)){node.hidden=before.hidden;if(before.display)node.style.setProperty('display',before.display,before.priority);else node.style.removeProperty('display');carouselActions.delete(node);}
  for(const node of redundant){if(!carouselActions.has(node))carouselActions.set(node,{hidden:node.hidden,display:node.style.getPropertyValue('display'),priority:node.style.getPropertyPriority('display')});if(!node.hidden)node.hidden=true;if(node.style.getPropertyValue('display')!=='none'||node.style.getPropertyPriority('display')!=='important')node.style.setProperty('display','none','important');}
 }
 // Keep the empty-output entrance visible after legacy create buttons are
 // consolidated. The compact menu still presses the original guarded owner.
 function emptyOutputEntrance(w,bar){
  const outputs=window.workspaceNavigation?.outputs?.(current().id),menu=w.querySelector('#work-context .wn-new'),right=bar?.querySelector('.sb-right');
  let button=right?.querySelector('[data-wbf-make-output]');
  const magazine=window.studyDraft?.currentOwner?.()?.kind==='magazine';
  const empty=[9,10,12].includes(stage())&&!magazine&&!window.workbenchPieces?.carouselEdition?.(current().id)&&Array.isArray(outputs)&&outputs.length===0&&menu&&right;
  if(!empty){button?.remove();for(const twin of bar?.querySelectorAll('[data-wbf-create-twin]')||[]){twin.hidden=false;delete twin.dataset.wbfCreateTwin;}return;}
  if(!button){button=document.createElement('button');button.type='button';button.className='btn';button.dataset.wbfMakeOutput='';button.dataset.c3RetainControl='empty-output-entry';button.textContent='Make an output';right.prepend(button);}
  const available=typeof window.surfaceBar?.openMore==='function'&&!!menu.querySelector('[data-wn-create]:not(:disabled)');
  button.disabled=!available;button.title=available?'Choose an output format':menu.querySelector('p')?.textContent||'Open an owned working manuscript to make an output.';
  for(const twin of right.querySelectorAll('[data-sb-primary][aria-label="Make an output"]'))if(!twin.hidden){twin.hidden=true;twin.dataset.wbfCreateTwin='';}
 }
 function documents(){
  const n=stage(),w=ws();if(!w)return;
  const bar=w.querySelector('#c3-surface-bar');emptyOutputEntrance(w,bar);if([5,6,7].includes(n))bar?.removeAttribute('data-wbf-section-actions');sectionActions(n,w);carouselFrame(w,bar);
  for(const entry of w.querySelectorAll('.draft-bar>.draft-inspect'))if(entry.querySelector(':scope>summary')?.textContent.trim()==='History')entry.dataset.wbfHistory='true';
  const docs=w.querySelectorAll('.desk>.document,.phaseReader.c3-read>.document,.phaseReader.c3-read>.recordPage,.wn-check-manuscript>.document,.wn-check-manuscript>.recordPage');
  for(const doc of docs){doc.classList.add('doc');let by=doc.querySelector(':scope>.wbf-doc-by');if(!by){by=document.createElement('div');by.className='by wbf-doc-by';doc.querySelector(':scope > :is(h1,h2)')?.after(by);}const name=current().name;if(by&&by.textContent!==name)by.textContent=name;
   // This generated project label adds no context when the visible title already says it.
   const heading=doc.querySelector(':scope>h1'),title=heading?.textContent.trim(),style=heading&&getComputedStyle(heading);
   const repeated=!!(heading&&heading.getClientRects().length&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&title&&title===String(name??'').trim());
   if(by&&by.hidden!==repeated)by.hidden=repeated;
  }
  let tools=w.querySelector('#wbf-tools');
  if([5,6,7].includes(n)){
   if(!tools){tools=document.createElement('div');tools.id='wbf-tools';tools.className='wbf-doc-tools';w.querySelector('#c3-surface-bar .sb-right')?.prepend(tools);}
   setHTML(tools,`<button type="button" class="btn${n===7?' on':''}" data-wbf-tool="check">${ic('check')}Check</button><button type="button" class="btn" data-wbf-tool="history">${ic('history')}History</button>`);
   let modes=w.querySelector('#wbf-document-actions');if(!modes){modes=document.createElement('div');modes.id='wbf-document-actions';modes.className='wbf-document-actions';w.querySelector('#c3-surface-bar .sb-right')?.append(modes);}
   const slideWords=[...w.querySelectorAll('.wordSequence .slideProse')],prose=w.querySelector('#manuscript,.draft-read-words');
   const text=slideWords.length?slideWords.map(node=>node.textContent).join(' '):prose?.children.length?[...prose.children].map(node=>node.textContent).join(' '):prose?.textContent||'';
   const words=text.trim().split(/\s+/).filter(Boolean).length;
   setHTML(modes,[5,6].includes(n)?'<span class="dim small wbf-word-count"></span>'+(w.querySelector('#manuscript')?'<div class="wbf-mode-switch" role="group" aria-label="Writing view"><button type="button" data-wbf-mode="edit" aria-pressed="false">Edit</button><button type="button" data-wbf-mode="preview" aria-pressed="false">Preview</button></div>':current().view==='carousel'&&typeof window.setOutputMode==='function'?'<button type="button" class="btn quiet" data-wbf-carousel-view="'+(current().outputMode==='look'?'words':'look')+'">'+(current().outputMode==='look'?'Edit words':'Preview slides')+'</button>':''):'');
   const count=modes.querySelector('.wbf-word-count');if(count&&count.textContent!==words+' words')count.textContent=words+' words';
   const currentMode=n===6?'preview':window.studyDraft?.viewMode?.()||'edit';for(const button of modes.querySelectorAll('[data-wbf-mode]')){const pressed=String(button.dataset.wbfMode===currentMode);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}
   // The shared toggle is the sole manuscript-mode entrance; retain original
   // handlers as hidden legacy proxies for old links and surface-bar ownership.
   if(modes.querySelector('.wbf-mode-switch'))for(const proxy of bar?.querySelectorAll('.sb-mode')||[])if(!proxy.hidden)proxy.hidden=true;
   const menuSources=w.querySelector('#c3-surface-bar .sb-menu');if(menuSources&&!menuSources.querySelector('[data-wbf-tool="sources"]')){const b=document.createElement('button');b.type='button';b.className='sb-item';b.dataset.wbfTool='sources';b.textContent='Sources';menuSources.prepend(b);}
   if(menuSources){
    if(n===5&&!menuSources.querySelector('[data-wbf-save]')){const b=document.createElement('button');b.type='button';b.className='sb-item';b.dataset.wbfSave='';b.textContent='Save';menuSources.prepend(b);}
    const recovery=w.querySelector('.draft-bar'),needed=!!recovery?.querySelector('.draft-inspect:not([data-wbf-history]),#draft-recovery:not(:empty),[data-draft-error]:not([hidden])');
    let b=menuSources.querySelector('[data-wbf-tool="recovery"]');
    if(needed&&!b){b=document.createElement('button');b.type='button';b.className='sb-item';b.dataset.wbfTool='recovery';b.textContent='Earlier writing & recovery';menuSources.prepend(b);}
    if(!needed)b?.remove();
    const more=menuSources.closest('.sb-morew')?.querySelector(':scope>.sb-btn');if(more){more.dataset.wbfRecovery=String(needed);more.title=needed?'More tools · writing needs review':'More tools';more.setAttribute('aria-label',more.title);}
   }
   const undo=w.querySelector('#c3-surface-bar .sb-right>.sb-icon[aria-label="Undo"]'),ask=w.querySelector('#c3-surface-bar .sb-primary'),menu=w.querySelector('#c3-surface-bar .sb-menu');
   if(menu)for(const [name,owner]of [['undo',undo],['ask',ask]])if(owner&&!menu.querySelector('[data-wbf-menu="'+name+'"]')){const copy=owner.cloneNode(true);copy.dataset.wbfMenu=name;copy.className='sb-item';copy.textContent=name==='undo'?'Undo typing':owner.textContent;menu.append(copy);}
  }else{tools?.remove();w.querySelector('#wbf-document-actions')?.remove();if(tool&&tool!=='understanding')closeTool();}
  document.body.classList.toggle('wbf-check-open',n===7);
  const picker=w.querySelector('.draft-bar>.draft-part-picker,.draft-bar>[data-draft-action="parts"]');
  if(picker){let part=w.querySelector('#wbf-parts');if(!part){part=document.createElement('details');part.id='wbf-parts';part.dataset.c3RetainControl='';part.innerHTML='<summary>Parts</summary><div></div>';w.querySelector('#c3-surface-bar .sb-right')?.append(part);}part.querySelector('div').append(picker);}
  const margin=w.querySelector('#margin');if(margin)margin.classList.add('wbf-margin');
  let pull=document.getElementById('wbf-pull');if([5,6].includes(n)){if(!pull){pull=document.createElement('button');pull.id='wbf-pull';pull.type='button';pull.dataset.wbfTool='understanding';pull.title='Pull out the understanding (])';pull.setAttribute('aria-label','Pull out the understanding');pull.innerHTML=ic('chev');document.body.append(pull);}}else pull?.remove();
  drawer();
 }
 function benchLocation(projectId){const stored=window.workspaceNavigation?.lastLocation?.(projectId)||null;return benchReturn?.projectId===projectId&&[5,6].includes(benchReturn.item?.stage)?{...benchReturn,...(stored?.key===benchReturn.key?{last:stored.last}:{})}:stored;}
 // Ephemeral projection of the maintained read-only output register. It never
 // stores task status, changes project to inspect it, or marks a move complete.
 let nextSerial=0,nextIntent=0,nextMoves=null,nextBusy=false;
 const nextProjects=()=>state.projects.filter(p=>typeof p.id==='string'&&!p.archived);
 const nextKey=row=>JSON.stringify([row.projectId,row.output.id,row.output.rootBindingId,row.output.edition??null]);
 const nextProof=output=>JSON.stringify([output.id,output.rootBindingId,output.edition??null,output.kind,output.format,output.status,output.nextAction]);
 const nextLive=(d,serial)=>serial===nextSerial&&d?.isConnected&&d.open&&!d.dataset.plContext&&d.dataset.workbenchPieces!=='true';
 async function readMoves(projectId){
  if(typeof window.realOutputOverview?.read!=='function'||typeof window.realOutputOverview?.onAction!=='function')throw Error('Saved output actions are unavailable.');
  const data=await window.realOutputOverview.read({projectId});
  if(data?.projectId!==projectId||!Array.isArray(data.outputs)||data.outputs.some(o=>typeof o?.id!=='string')||new Set(data.outputs.map(o=>o.id)).size!==data.outputs.length)throw Error('The output reader did not confirm this project’s exact pieces.');
  if(data.availability&&data.availability.state!=='ready'||data.emptyMessage)throw Error(data.availability?.message||data.emptyMessage);
  const rows=[],unknown=[];
  for(const output of data.outputs){
   if(['ready','published','complete','completed'].includes(output.status))continue;
   if(!['correction-needed','review-needed','in-progress','draft'].includes(output.status)||typeof output.rootBindingId!=='string'||!output.rootBindingId||!['native','words','arrange','review'].includes(output.nextAction?.kind)||!output.nextAction.label||output.nextAction.disabled){unknown.push(output.id);continue;}
   rows.push({projectId,output,proof:nextProof(output)});
  }
  return {rows,unknown};
 }
 function movesHTML(){
  const m=nextMoves;
  return `<div data-wbf-next-list><h2 class="sec">Next moves <span class="sub">· ${m?.rows.length||0}${m?.loading?' found':m?.errors.length?' available':''} across active projects</span></h2><p class="dim small">Saved output work. Recording and research tasks are not counted.</p>${m?.loading?'<p role="status">Reading saved outputs…</p>':''}${m?.message?'<p role="status">'+esc(m.message)+'</p>':''}<ol class="moves">${(m?.rows||[]).map(row=>`<li><button type="button" class="move" data-wbf-next="${esc(nextKey(row))}" ${nextBusy?'disabled':''}>${ic('pieces')}<span><span class="t">${esc(row.output.nextAction.label)} · ${esc(row.output.title||row.output.format||'Untitled output')}</span><br><span class="w">${esc(nextProjects().find(p=>p.id===row.projectId)?.name||'Project')} · ${esc(row.output.format||'Output')}</span></span>${ic('chev')}</button></li>`).join('')}</ol>${m&&!m.loading&&!m.rows.length?'<p class="dim">'+(m.errors.length?'Next moves are unavailable for some projects.':'No saved output moves are recorded for active projects.')+'</p>':''}${m?.errors.length?'<details><summary>'+m.errors.length+' project'+(m.errors.length===1?'':'s')+' unavailable</summary>'+m.errors.map(issue=>'<p>'+esc(issue.name)+': '+esc(issue.message)+'</p>').join('')+'</details>':''}<button type="button" class="lnk" data-wbf-next-refresh ${m?.loading||nextBusy?'disabled':''}>Refresh moves</button></div>`;
 }
 function loadMoves(d,force=false){
  const projects=nextProjects().map(p=>({id:p.id,name:p.name})),signature=JSON.stringify(projects.map(p=>p.id));
  if(!force&&nextMoves?.dialog===d&&nextMoves.signature===signature)return;
  const serial=++nextSerial;nextMoves={dialog:d,signature,rows:[],errors:[],loading:true,message:''};
  if(!d.wbfNextCleanup){d.wbfNextCleanup=true;d.addEventListener('close',()=>{nextSerial++;nextMoves=null;});}
  let at=0;
  void Promise.all(Array.from({length:Math.min(3,projects.length)},async()=>{
   while(at<projects.length&&nextLive(d,serial)){const p=projects[at++];try{
    const result=await readMoves(p.id);if(!nextLive(d,serial))return;
    nextMoves.rows.push(...result.rows);if(result.unknown.length)nextMoves.errors.push({name:p.name,message:'Current next-action proof is unavailable for '+result.unknown.length+' output'+(result.unknown.length===1?'':'s')+'.'});
   }catch(error){if(nextLive(d,serial))nextMoves.errors.push({name:p.name,message:error.message});}}
  })).then(()=>{if(!nextLive(d,serial))return;nextMoves.loading=false;nextMoves.rows.sort((a,b)=>['correction-needed','review-needed','in-progress','draft'].indexOf(a.output.status)-['correction-needed','review-needed','in-progress','draft'].indexOf(b.output.status)||nextKey(a).localeCompare(nextKey(b)));bench();});
 }
 async function openMove(key){
  const m=nextMoves,row=m?.rows.find(row=>nextKey(row)===key),d=m?.dialog;
  if(!row||nextBusy||!nextLive(d,nextSerial))return;
  const origin=current(),originStage=stage(),intent=++nextIntent,serial=nextSerial;
  const sameOrigin=()=>intent===nextIntent&&current()===origin&&stage()===originStage;
  const activeTarget=()=>nextProjects().some(p=>p.id===row.projectId);
  const exact=async()=>{const fresh=await readMoves(row.projectId);if(!fresh.rows.some(item=>nextKey(item)===key&&item.proof===row.proof))throw Error('This move changed. Refresh moves before opening it.');};
  nextBusy=true;bench();
  try{
   await exact();if(!sameOrigin()||!nextLive(d,serial)||!activeTarget())throw Error('The selected work changed. Choose the move again.');
   await window.projectLibrary.close();if(d.open||document.getElementById('project-library')?.open)throw Error('Return from the open work before continuing.');
   if(!sameOrigin()||!activeTarget())throw Error('The selected work changed. Choose the move again.');
   if(current().id!==row.projectId)await window.switchProject(row.projectId);
   if(intent!==nextIntent||current().id!==row.projectId||!activeTarget())throw Error('The selected project changed.');
   await exact();if(intent!==nextIntent||current().id!==row.projectId||!activeTarget())throw Error('The selected project changed.');
   await window.realOutputOverview.onAction({projectId:row.projectId,outputId:row.output.id,edition:row.output.edition??null,kind:row.output.nextAction.kind});
  }catch(error){if(intent===nextIntent){if(d.open&&nextMoves===m){m.message=error.message;bench();}else{const status=document.getElementById('wn-message');if(status&&[origin.id,row.projectId].includes(current().id)){status.textContent=error.message;status.hidden=false;}}}}
  finally{nextBusy=false;if(d.open)bench();}
 }
 window.addEventListener('study-write-view',()=>decorate());
 window.addEventListener('click',event=>{if(event.target.closest?.('.workflowNavigation .workflowStep,[data-tr-home],[data-wbf-pieces],[data-pl-open],[data-wbf-resume]'))nextIntent++;},true);
 const refreshMoves=()=>{if(nextMoves?.dialog?.open&&!nextBusy){loadMoves(nextMoves.dialog,true);bench();}};
 for(const event of ['study-output-selection','study-draft-change','ar-live-change'])window.addEventListener(event,refreshMoves);
 function bench(){
  const d=document.getElementById('project-library');if(!d?.open||d.dataset.plContext)return;
  if(!d.classList.contains('wbf-home'))d.classList.add('wbf-home');if(d.dataset.wbfHome!==homeMode)d.dataset.wbfHome=homeMode;if(d.dataset.workbenchPieces==='true'){restoreBenchInventory();window.workbenchPieces?.decorate?.();return;}
  const main=d.querySelector('.ht-home-main');if(!main)return;
  let section=main.querySelector(':scope>.wbf-bench');if(!section){section=document.createElement('section');section.className='wbf-bench wrap';section.innerHTML='<div class="wbf-bench-story"></div><section class="block wbf-active"></section>';main.prepend(section);}
  if(actualBench()&&homeMode==='bench'){renderCatalogBench(section,d);return;}restoreBenchInventory();
  loadMoves(d);
  const p=current(),blocks=p.blocks||[],words=document.getElementById('manuscript')?.textContent||blocks.map(b=>b.text||'').filter(Boolean).join(' '),excerpt=words.slice(0,330),st=window.c3PieceState?.read?.();
  const location=benchLocation(p.id),resume=location?.item,passage=resume?.selection||resume?.anchor?.kind==='passage'&&resume.anchor,resumeId=passage?.id,live=[...document.querySelectorAll('#manuscript [data-block],[data-draft-passage]')],matching=resumeId?live.find(n=>(n.dataset.block||n.dataset.draftPassage)===resumeId):null,blockIndex=resumeId?blocks.findIndex(b=>b.id===resumeId):-1,resumeIndex=Number.isInteger(resume?.anchor?.index)&&resume.anchor.id===resumeId?resume.anchor.index:matching?live.indexOf(matching):blockIndex;
  const resumeText=passage?.text||matching?.textContent||(blockIndex>=0?blocks[blockIndex].text||blocks[blockIndex].html?.replace(/<[^>]+>/g,''):'')||(!location&&[5,6].includes(stage())?excerpt:''),resumeLabel=resumeId&&resumeIndex>=0?'Continue at ¶'+(resumeIndex+1):location?({3:'Continue in Research',4:'Continue in Direction',5:'Open the draft',6:'Continue reading',7:'Continue checking',8:'Continue in Media',9:'Continue arranging',10:'Continue in Audience',11:'Continue sharing'}[resume.stage]||'Continue where you left off'):'Continue where you left off';
  const binding=window.studyDraft?.currentBinding?.(),recent=(window.arLive?.state?.().humanLines||[]).filter(r=>['project','piece'].includes(r.scope?.kind)&&r.scope.id===p.id||r.scope?.kind==='draft'&&r.scope.id===binding?.id).slice(0,3);
  let folders=d.querySelector(':scope>.wbf-piece-nav');if(!folders){folders=document.createElement('aside');folders.className='wbf-piece-nav';folders.setAttribute('aria-label','Piece folders');d.append(folders);}
  const active=window.projectLibrary?.filterValue?.()||'active',groups=[['active','All pieces'],['pinned','Pinned'],['archive','Archived'],...[...new Set((state.projects||[]).map(p=>p.folder||'Projects'))].sort().map(f=>['folder:'+f,f])];
  setHTML(folders,`<div class="sph">Pieces</div><div class="spb">${groups.map(([value,label])=>`<button type="button" class="rk${active===value?' on':''}" data-wbf-project-filter="${esc(value)}" ${active===value?'aria-current="true"':''}><span class="lbl">${esc(label)}</span></button>`).join('')}</div>`);
  setHTML(section.querySelector('.wbf-bench-story'),`<div class="thead"><h1>The bench<span class="sub"> · All projects</span></h1></div><section class="pickup" aria-label="Pick up where you left off"><div class="lab">Pick up where you left off</div><h2>${esc(p.name)} <span class="sub">· ${esc(location?({3:'Research',4:'Direction',5:'Write',6:'Write',7:'Check',8:'Media',9:'Arrange',10:'Audience',11:'Share'}[location.item?.stage||location.stage]||'Current work'):'Current work')}</span></h2><div class="meta">${esc(st?.save?.text||'Your current piece')}</div>${resumeText?`<blockquote>${esc(resumeText)}</blockquote>`:''}<div class="acts"><button type="button" class="btn primary" data-wbf-resume>${esc(resumeLabel)} ${ic('chev')}</button><button type="button" class="lnk" data-wbf-recent>Recent changes</button></div><div class="since"><div class="lab">Recent saved activity</div>${recent.length?`<ul>${recent.map(r=>`<li><i></i><span>${esc(window.arLive?.label?.(r)||'Saved change')}<small>${esc(window.c3Shell?.actorName?.(r.actor)||'You')} · ${esc(new Date(r.ts).toLocaleString())}</small></span></li>`).join('')}</ul>`:'<p class="dim small">No saved activity is available here yet.</p>'}</div></section><section class="block">${movesHTML()}</section>`);
  const inventory=section.querySelector('.wbf-active');let title=inventory.querySelector('.wbf-active-title');if(!title){title=document.createElement('div');title.className='wbf-active-title';inventory.prepend(title);}setHTML(title,`<h2 class="sec">Everything active <span class="sub">· ${(state.projects||[]).filter(p=>!p.archived).length}</span></h2><button type="button" class="lnk" data-wbf-new>New project</button>`);
  // Move original inventory owners into the approved active-project list. No copied project authority.
  for(const selector of ['.ht-homebar','.pl-results-head','[data-pl-results]','.pl-more']){const owner=d.querySelector(selector);if(owner&&owner.parentElement!==inventory)inventory.append(owner);}
  const search=d.querySelector('.pl-search');if(search)search.classList.add('search');
  const input=d.querySelector('[data-pl-search]');if(input&&input.placeholder!=='Filter projects')input.placeholder='Filter projects';
  d.querySelector('[data-pl-results]')?.classList.add('alist');
  for(const row of d.querySelectorAll('.pl-library-row')){
   row.classList.add('wbf-project-row');const open=row.querySelector('.pl-open');open?.classList.add('arow');
   open?.querySelector('strong')?.classList.add('wbf-project-name');
   open?.querySelector(':scope>span:not(.ht-cover)')?.classList.add('s');
   if(open&&!open.querySelector('.k')){const date=document.createElement('span');date.className='k';const item=(state.projects||[]).find(p=>p.id===open.dataset.plOpen);date.textContent=item?.archived?'Archived':item?.pinnedAt?'Pinned':'';open.querySelector('strong')?.after(date);}
  }
 }
 function decorate(){
  if(!ws())return;
  document.body.classList.add('wbf-on');const home=document.getElementById('project-library'),mode=home?.open&&!home.dataset.plContext?homeMode:'';if(document.body.dataset.wbfHome!==mode)document.body.dataset.wbfHome=mode;const n=stage();if(n===7&&decoratedStage!==7){restore();tool='check';mounted=null;}if(![5,6,7].includes(n)&&tool==='check')closeTool();decoratedStage=n;header();documents();bench();
 }
 // Home and Pieces share the existing library dialog. Leave through its
 // guarded owner before replaying the exact rail control, including the native
 // Write/Read capture handlers and Check drawer handler on document.
 let leavingHome=false;
 window.addEventListener('click',event=>{
  const button=event.target.closest?.('.workflowNavigation .workflowStep'),home=document.getElementById('project-library');
  if(!button||button.disabled||!home?.open||home.dataset.plContext)return;
  const n=Number(button.querySelector('.stepNumber')?.textContent),projectId=current().id;
  if(!Number.isInteger(n)||n<1||n>12)return;
  event.preventDefault();event.stopImmediatePropagation();if(leavingHome)return;leavingHome=true;
  void(async()=>{
   try{
    if(typeof window.projectLibrary?.close!=='function')throw Error('Return to work before opening this section.');
    await window.projectLibrary.close();
    if(home.open||document.getElementById('project-library')?.open)return;
    if(current().id!==projectId)throw Error('The selected project changed. Choose the section again.');
    const target=button.isConnected?button:[...document.querySelectorAll('.workflowNavigation .workflowStep')].find(item=>Number(item.querySelector('.stepNumber')?.textContent)===n);
    if(target&&!target.disabled)target.click();
   }catch(error){const status=home.querySelector('[data-pl-status]')||document.getElementById('wn-message');if(status){status.textContent=error.message||'This section could not open. Your current work is retained.';status.hidden=false;}}
   finally{leavingHome=false;}
  })();
 },true);
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('#c3-surface-bar [data-cb-compare]'),owner=window.studyDraft;
  if(!button||button.disabled||typeof owner?.compare!=='function')return;
  event.preventDefault();event.stopImmediatePropagation();if(compareBusy)return;
  const projectId=current().id,bindingId=owner.currentBinding?.()?.id,n=stage(),intent=++compareIntent;
  compareBusy=true;button.disabled=true;
  void(async()=>{try{
   const shown=await owner.compare();
   if(shown===false||intent!==compareIntent||current().id!==projectId||owner!==window.studyDraft||owner.currentBinding?.()?.id!==bindingId||stage()!==n)return;
   if(tool!=='recovery')await openTool('recovery');else decorate();
  }catch(error){if(intent===compareIntent&&current().id===projectId){const status=document.getElementById('wn-message');if(status){status.textContent=error.message||'Comparison is unavailable. Your current words are retained.';status.hidden=false;}}}
  finally{compareBusy=false;if(button.isConnected)button.disabled=false;}})();
 },true);
 document.addEventListener('click',event=>{const focus=event.target.closest?.('#c3-surface-bar .sb-focus');if(focus&&document.body.dataset.draftFocus==='true'){const margin=document.querySelector('.workspace>.topbar [data-surface-mode="margin"]');if(margin){event.preventDefault();event.stopImmediatePropagation();margin.click();}return;}const b=event.target.closest?.('.workflowNavigation .workflowStep,[data-wn-mode="check"]');if(!b||b.disabled)return;const isCheck=b.dataset.wnMode==='check'||Number(b.querySelector('.stepNumber')?.textContent)===7;if(isCheck){event.preventDefault();event.stopImmediatePropagation();void openTool('check').catch(toolError);}},true);
 document.addEventListener('click',async event=>{
  if(event.target.closest?.('#c3-surface-bar .sb-morew>.sb-btn'))queueMicrotask(documents);
  const b=event.target.closest?.('[data-wbf-bench-open],[data-wbf-bench-refresh],[data-wbf-bench-more],[data-wbf-size],[data-wbf-tool],[data-wbf-close],[data-wbf-thought],[data-wbf-pieces],[data-wbf-resume],[data-wbf-next],[data-wbf-next-refresh],[data-wbf-recent],[data-wbf-project-filter],[data-wbf-save],[data-wbf-mode],[data-wbf-carousel-view],[data-wbf-new],[data-wbf-make-output],.workflowNavigation [data-tr-home]');if(!b)return;
  if(b.hasAttribute('data-wbf-bench-open'))return openBenchWork(b.dataset.wbfBenchOpen);
  if(b.hasAttribute('data-wbf-bench-refresh'))return void benchCatalog?.refresh?.();
  if(b.hasAttribute('data-wbf-bench-more')){benchLimit+=30;bench();return;}
  if(b.hasAttribute('data-wbf-project-filter')){const select=document.querySelector('#project-library [data-pl-filter]');if(select){select.value=b.dataset.wbfProjectFilter;select.dispatchEvent(new Event('change',{bubbles:true}));}return;}
  if(b.hasAttribute('data-tr-home')){window.workbenchPieces?.close?.();benchReturn=window.workspaceNavigation?.capture?.()||null;homeMode='bench';queueMicrotask(decorate);return;}
  if(b.hasAttribute('data-wbf-new')){document.querySelector('#project-library [data-pl-new]')?.click();return;}
  if(b.hasAttribute('data-wbf-make-output')){if(!b.disabled)window.surfaceBar?.openMore?.('New output');return;}
  if(b.hasAttribute('data-wbf-save')){b.disabled=true;try{await window.studyDraft?.flush?.();}finally{if(b.isConnected)b.disabled=false;}return;}
  if(b.dataset.wbfCarouselView){if(current().view==='carousel'&&typeof window.setOutputMode==='function')await window.setOutputMode(b.dataset.wbfCarouselView);return;}
  if(b.dataset.wbfMode){try{await window.workspaceNavigation?.changeMode?.(b.dataset.wbfMode);}catch(error){toolError(error);}return;}
  if(b.dataset.wbfSize){document.querySelector('#c3-surface-bar [data-cb-size="'+b.dataset.wbfSize+'"]')?.click();decorate();return;}
  if(b.dataset.wbfTool){try{await openTool(b.dataset.wbfTool);}catch(error){toolError(error);}return;}
  if(b.hasAttribute('data-wbf-close'))return closeTool();
  if(b.hasAttribute('data-wbf-thought'))return openThought();
  if(b.hasAttribute('data-wbf-pieces')){homeMode='pieces';await window.projectLibrary.open();window.homeTabs?.paint?.();await window.workbenchPieces?.open?.({dialog:document.getElementById('project-library')});decorate();return;}
  if(b.hasAttribute('data-wbf-resume')){const target=benchLocation(current().id);b.disabled=true;try{await window.projectLibrary.close();if(target)await window.workspaceNavigation?.resumeLast?.(target);}catch(error){const status=document.querySelector('#wn-message')||document.querySelector('#project-library [data-pl-status]');if(status){status.textContent=error.message||'The saved work could not open. Your current work is retained.';status.hidden=false;}}finally{if(b.isConnected)b.disabled=false;}return;}
  if(b.hasAttribute('data-wbf-next-refresh')){refreshMoves();return;}
  if(b.hasAttribute('data-wbf-next'))return openMove(b.dataset.wbfNext);
  if(b.hasAttribute('data-wbf-recent')){await window.projectLibrary.close();window.arLive?.openRecent?.();}
 });
 document.addEventListener('mousedown',event=>{if(event.target.closest?.('.wbf-mode-switch [data-wbf-mode]'))event.preventDefault();});
 document.addEventListener('keydown',event=>{const button=event.target.closest?.('.wbf-mode-switch [data-wbf-mode]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...button.parentElement.querySelectorAll('[data-wbf-mode]')];event.preventDefault();const next=event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):buttons[1-buttons.indexOf(button)];next.focus();next.click();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('project-library')?.open&&!document.getElementById('project-library')?.dataset.plContext){event.preventDefault();void window.projectLibrary.close();return;}if(event.key==='Escape'&&tool){event.preventDefault();closeTool();}if(event.key==='t'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.target.closest?.('input,textarea,select,[contenteditable]')){event.preventDefault();document.querySelector('[data-wbf-thought]')?.click();return;}if(event.key===']'&&!event.target.closest?.('input,textarea,[contenteditable="true"]')){event.preventDefault();void openTool('understanding');}});
 const observer=new MutationObserver(()=>{const d=document.getElementById('project-library');if(d?.open&&!d.dataset.plContext)bench();});
 // Home's owner repaints its rows in place; no observer over our own generated section.
 const watchHome=()=>{const d=document.querySelector('#project-library [data-pl-results]');if(d&&!d.dataset.wbfWatch){d.dataset.wbfWatch='true';observer.observe(d,{childList:true});}};
 document.addEventListener('input',event=>{if(event.target.matches?.('[data-wbf-bench-search]')){benchQuery=event.target.value;benchLimit=30;bench();}});
 window.c3WorkbenchFrame={decorate,openTool,closeTool,setBenchCatalog};
 window.addEventListener('c3-header-painted',header);
 window.c3Shell.register('full Workbench frame',()=>{decorate();watchHome();},{order:95,ignore:'#wbf-tools,#wbf-drawer,.wbf-top-actions,.wbf-bench'});
 document.addEventListener('toggle',event=>{if(event.target.id==='project-library')decorate();},true);
 for(const n of ['study-draft-change','study-output-selection','c3-piece-state'])window.addEventListener(n,decorate);
})();
