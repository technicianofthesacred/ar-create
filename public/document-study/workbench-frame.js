/* Full Workbench frame from design/three-directions/c-workbench (final NOTES).
   Presentation only: existing editor, note, history, source and switch owners remain the same nodes.
   No copied prototype records, business writes or second manuscript. */
(()=>{
 if(window.c3WorkbenchFrame)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={understanding:'M5 5h14v10H9l-4 4z',panelR:'M4 4h16v16H4zM15 4v16',read:'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z',check:'M5 12l4 4L19 6',history:'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',sources:'M6 3h9l4 4v14H6zM15 3v4h4',close:'M6 6l12 12M18 6L6 18',pieces:'M6 3h9l4 4v14H6zM15 3v4h4',chev:'M9 6l6 6-6 6'};
 const ic=k=>`<svg class="ic sm" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]||paths.pieces}"/></svg>`;
 const railPaths={"1": "M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5", "2": "M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2", "3": "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l4 4", "4": "M12 3v18M5 5h11l3 3-3 3H5zM9 15h-4", "5": "M4 20h4L19 9l-4-4L4 16zM14 6l4 4", "6": "M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z", "7": "M5 12l4 4L19 6", "8": "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01", "9": "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", "10": "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z", "11": "M4 12v7h16v-7M12 3v12M8 7l4-4 4 4", "12": "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"};
 const stage=()=>{try{const p=current();return p.view==='article'?5:Number(p.viewedStage)||0}catch{return 0}};
 let tool='',mounted=null,homeMode='bench',returnFocus=null,restorations=[],benchReturn=null,decoratedStage=null;
 const ws=()=>document.querySelector('#app #workspace');
 function setHTML(node,html){if(node.dataset.render!==html){node.innerHTML=html;node.dataset.render=html;}}
 function restore(){for(const {node,marker}of restorations){if(marker.isConnected){marker.replaceWith(node);}else node.remove();}restorations=[];}
 function move(node,host){if(!node||host.contains(node))return;const marker=document.createComment('Workbench tool return');node.before(marker);restorations.push({node,marker});host.append(node);}
 function closeTool(){restore();tool='';document.getElementById('wbf-drawer')?.remove();document.body.classList.remove('wbf-drawer-open');returnFocus?.isConnected&&returnFocus.focus?.({preventScroll:true});}
 function drawer(){
  if(!tool)return;
  let d=document.getElementById('wbf-drawer');if(!d){d=document.createElement('aside');d.id='wbf-drawer';d.setAttribute('aria-label','Tools beside the writing');d.innerHTML='<div class="dr-head"><h2></h2><button class="btn quiet" data-wbf-close aria-label="Close tools">'+ic('close')+'</button></div><div class="dr-tabs" role="tablist"></div><div class="dr-body"></div>';document.body.append(d);}
  d.querySelector('h2').textContent=tool==='understanding'?'Understanding · '+current().name:({check:'Check',history:'History',sources:'Sources'})[tool];
  setHTML(d.querySelector('.dr-tabs'),['understanding','check','history','sources'].map(k=>`<button type="button" role="tab" data-wbf-tool="${k}" aria-selected="${tool===k}" class="${tool===k?'on':''}">${({understanding:'Understanding',check:'Check',history:'History',sources:'Sources'})[k]}</button>`).join(''));
  const host=d.querySelector('.dr-body'),ownerKey=current().id+':'+(window.studyDraft?.currentBinding?.()?.id||'');
  const found=tool==='check'?document.querySelector('.wn-check-findings'):tool==='understanding'?document.querySelector('#c3-insp-decisions #downstream-human-direction,#downstream-human-direction'):tool==='sources'?document.querySelector('.draft-surface-source'):tool==='history'?[...document.querySelectorAll('.draft-bar>.draft-inspect')].find(n=>n.querySelector('summary')?.textContent.trim()==='History'):null;
  const target=found||(host.dataset.ownerKey===ownerKey&&host.contains(host.wbfOwner)?host.wbfOwner:null);
  // A replaced owner or a story switch must never leave another piece's controls in this drawer.
  if(host.dataset.tool!==tool||mounted!==ws()||host.dataset.ownerKey!==ownerKey||host.wbfOwner!==target){
   restore();host.replaceChildren();host.dataset.tool=tool;host.dataset.ownerKey=ownerKey;host.wbfOwner=target;mounted=ws();
   if(target){move(target,host);if(target.tagName==='DETAILS')target.open=true;}
   else{const p=document.createElement('p');p.className='dim';p.textContent=tool==='sources'?'No source record is connected to this piece.':tool==='history'?'No earlier saved versions are available for this piece yet.':tool==='understanding'?'No saved direction for this piece yet. Write your thoughts in Direction.':'Checks appear beside the saved manuscript.';host.append(p);}
  }
  document.body.classList.add('wbf-drawer-open');
 }
 async function openTool(k){
  returnFocus=document.activeElement;
  if(k==='check'){
   closeTool();await viewPhase(7);tool='check';mounted=null;decorate();document.querySelector('#wbf-drawer [data-wbf-close]')?.focus({preventScroll:true});return;
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
  if(switcher&&!switcher.querySelector('.wbf-project-dot')){const dot=document.createElement('span');dot.className='wbf-project-dot';dot.setAttribute('aria-hidden','true');switcher.prepend(dot);const key=document.createElement('kbd');key.className='lbl-wide';key.textContent='⌘K';switcher.append(key);}
  const rail=document.querySelector('.workflowNavigation');
  if(rail&&!rail.querySelector('[data-wbf-pieces]')){const b=document.createElement('button');b.type='button';b.className='wbf-pieces';b.dataset.wbfPieces='';b.innerHTML=ic('pieces')+'<span class="stepName">Pieces</span>';b.title='Browse your pieces';rail.querySelector('.wn-family[data-family="make"] .wn-family-steps')?.prepend(b);}
  for(const button of rail?.querySelectorAll('.workflowStep')||[]){const n=Number(button.querySelector('.stepNumber')?.textContent),svg=button.querySelector('svg'),path=railPaths[n];if(svg&&path&&svg.dataset.wbfPath!==path){svg.innerHTML='<path d="'+path+'"/>';svg.dataset.wbfPath=path;}}
  const home=rail?.querySelector('[data-tr-home]');if(home&&home.dataset.short!=='Bench'){home.dataset.short='Bench';home.title='The bench · pick up your work';const label=home.querySelector('.tr-label');if(label)label.textContent='Bench';}
 }
 function documents(){
  const n=stage(),w=ws();if(!w)return;
  for(const entry of w.querySelectorAll('.draft-bar>.draft-inspect'))if(entry.querySelector(':scope>summary')?.textContent.trim()==='History')entry.dataset.wbfHistory='true';
  const docs=w.querySelectorAll('.desk>.document,.phaseReader.c3-read>.document,.phaseReader.c3-read>.recordPage,.wn-check-manuscript>.document,.wn-check-manuscript>.recordPage');
  for(const doc of docs){doc.classList.add('doc');let by=doc.querySelector(':scope>.wbf-doc-by');if(!by){by=document.createElement('div');by.className='by wbf-doc-by';doc.querySelector(':scope > :is(h1,h2)')?.after(by);}const name=current().name;if(by&&by.textContent!==name)by.textContent=name;}
  let tools=w.querySelector('#wbf-tools');
  if([5,6,7].includes(n)){
   if(!tools){tools=document.createElement('div');tools.id='wbf-tools';tools.className='wbf-doc-tools';w.querySelector('#c3-surface-bar .sb-right')?.prepend(tools);}
   setHTML(tools,`<button type="button" class="btn${n===7?' on':''}" data-wbf-tool="check">${ic('check')}Check</button><button type="button" class="btn" data-wbf-tool="history">${ic('history')}History</button><button type="button" class="btn quiet" data-wbf-tool="sources">${ic('sources')}Sources</button>`);
   let modes=w.querySelector('#wbf-document-actions');if(!modes){modes=document.createElement('div');modes.id='wbf-document-actions';modes.className='wbf-document-actions';w.querySelector('#c3-surface-bar .sb-right')?.append(modes);}
   const words=(w.querySelector('#manuscript,.draft-read-words')?.textContent||'').trim().split(/\s+/).filter(Boolean).length;
   setHTML(modes,`${n===5?`<span class="dim small wbf-word-count">${words} words</span><button class="btn quiet" data-wbf-mode="read">${ic('read')}Read</button><button class="btn quiet" data-wbf-save>Save</button>`:n===6?'<button class="btn quiet" data-wbf-mode="write">Back to Write</button>':''}`);
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
 function bench(){
  const d=document.getElementById('project-library');if(!d?.open||d.dataset.plContext)return;
  d.classList.add('wbf-home');d.dataset.wbfHome=homeMode;
  const main=d.querySelector('.ht-home-main');if(!main)return;
  let section=main.querySelector(':scope>.wbf-bench');if(!section){section=document.createElement('section');section.className='wbf-bench';main.prepend(section);}
  const p=current(),blocks=p.blocks||[],words=document.getElementById('manuscript')?.textContent||blocks.map(b=>b.text||'').filter(Boolean).join(' '),excerpt=words.slice(0,330),st=window.c3PieceState?.read?.(),primary=window.c3PieceState?.primary?.(stage());
  const resume=benchReturn?.projectId===p.id?benchReturn.item:null,passages=[...document.querySelectorAll('#manuscript [data-block],[data-draft-passage]')],resumeId=resume?.selection?.id||resume?.anchor?.id,resumeIndex=passages.findIndex(n=>(n.dataset.block||n.dataset.draftPassage)===resumeId),resumeText=resumeIndex>=0?passages[resumeIndex].textContent:excerpt,resumeLabel=resumeIndex>=0?'Continue at ¶'+(resumeIndex+1):'Continue where you left off';
  const binding=window.studyDraft?.currentBinding?.(),recent=(window.arLive?.state?.().humanLines||[]).filter(r=>['project','piece'].includes(r.scope?.kind)&&r.scope.id===p.id||r.scope?.kind==='draft'&&r.scope.id===binding?.id).slice(0,3);
  let folders=d.querySelector(':scope>.wbf-piece-nav');if(!folders){folders=document.createElement('aside');folders.className='wbf-piece-nav';folders.setAttribute('aria-label','Piece folders');d.append(folders);}
  const active=window.projectLibrary?.filterValue?.()||'active',groups=[['active','All pieces'],['pinned','Pinned'],['archive','Archived'],...[...new Set((state.projects||[]).map(p=>p.folder||'Projects'))].sort().map(f=>['folder:'+f,f])];
  setHTML(folders,`<div class="sph">Pieces</div><div class="spb">${groups.map(([value,label])=>`<button type="button" class="rk${active===value?' on':''}" data-wbf-project-filter="${esc(value)}" ${active===value?'aria-current="true"':''}><span class="lbl">${esc(label)}</span></button>`).join('')}</div>`);
  setHTML(section,`<div class="thead"><h1>The bench<span class="sub"> · All projects</span></h1></div><section class="pickup" aria-label="Pick up where you left off"><div class="lab">Pick up where you left off</div><h2>${esc(p.name)}</h2><div class="meta">${esc(st?.save?.text||'Your current piece')}</div>${resumeText?`<blockquote>${esc(resumeText)}</blockquote>`:''}<div class="acts"><button type="button" class="btn primary" data-wbf-resume>${esc(resumeLabel)} ${ic('chev')}</button><button type="button" class="lnk" data-wbf-recent>Recent changes</button></div><div class="since"><div class="lab">Recent saved activity</div>${recent.length?`<ul>${recent.map(r=>`<li><i></i><span>${esc(window.arLive?.label?.(r)||'Saved change')}<small>${esc(window.c3Shell?.actorName?.(r.actor)||'You')} · ${esc(new Date(r.ts).toLocaleString())}</small></span></li>`).join('')}</ul>`:'<p class="dim small">No saved activity is available here yet.</p>'}</div></section><section class="block"><h2 class="sec">Next moves</h2><ol class="moves"><li><button type="button" class="move" data-wbf-next>${ic('pieces')}<span><span class="t">${esc(primary?.label||'Continue your current piece')}</span><span class="w">${esc(p.name)}</span></span>${ic('chev')}</button></li></ol></section><h2 class="sec block">Everything active</h2>`);
  const searchbar=d.querySelector('.ht-homebar'),resultHead=main.querySelector('.pl-results-head');if(searchbar&&resultHead&&searchbar.nextElementSibling!==resultHead)main.insertBefore(searchbar,resultHead);
  // Existing project browser owns filtering, opening, pinning, filing and creation.
  const search=d.querySelector('.pl-search');if(search)search.classList.add('search');
  for(const row of d.querySelectorAll('.pl-library-row')){row.classList.add('wbf-project-row');row.querySelector('.pl-open')?.classList.add('arow');}
 }
 function decorate(){
  if(!ws())return;
  document.body.classList.add('wbf-on');const n=stage();if(n===7&&decoratedStage!==7){restore();tool='check';mounted=null;}if(n!==7&&tool==='check')closeTool();decoratedStage=n;header();documents();bench();
 }
 document.addEventListener('click',async event=>{
  const b=event.target.closest?.('[data-wbf-size],[data-wbf-tool],[data-wbf-close],[data-wbf-thought],[data-wbf-pieces],[data-wbf-resume],[data-wbf-next],[data-wbf-recent],[data-wbf-project-filter],[data-wbf-save],[data-wbf-mode],.workflowNavigation [data-tr-home]');if(!b)return;
  if(b.hasAttribute('data-wbf-project-filter')){const select=document.querySelector('#project-library [data-pl-filter]');if(select){select.value=b.dataset.wbfProjectFilter;select.dispatchEvent(new Event('change',{bubbles:true}));}return;}
  if(b.hasAttribute('data-tr-home')){benchReturn=window.workspaceNavigation?.capture?.()||null;homeMode='bench';queueMicrotask(decorate);return;}
  if(b.hasAttribute('data-wbf-save')){b.disabled=true;try{await window.studyDraft?.flush?.();}finally{if(b.isConnected)b.disabled=false;}return;}
  if(b.dataset.wbfMode){await window.workspaceNavigation?.changeMode?.(b.dataset.wbfMode);return;}
  if(b.dataset.wbfSize){document.querySelector('#c3-surface-bar [data-cb-size="'+b.dataset.wbfSize+'"]')?.click();decorate();return;}
  if(b.dataset.wbfTool)return openTool(b.dataset.wbfTool);
  if(b.hasAttribute('data-wbf-close'))return closeTool();
  if(b.hasAttribute('data-wbf-thought')){if(document.getElementById('project-library')?.open)await window.projectLibrary.close();closeTool();await viewPhase(4);document.querySelector('textarea[data-human-direction],.human-direction-edit textarea')?.focus();return;}
  if(b.hasAttribute('data-wbf-pieces')){homeMode='pieces';await window.projectLibrary.open();decorate();return;}
  if(b.hasAttribute('data-wbf-resume')){await window.projectLibrary.close();return;}
  if(b.hasAttribute('data-wbf-next')){const a=window.c3PieceState?.primary?.(stage());await window.projectLibrary.close();if(a)await window.c3PieceState.run(a);return;}
  if(b.hasAttribute('data-wbf-recent')){await window.projectLibrary.close();window.arLive?.openRecent?.();}
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('project-library')?.open&&!document.getElementById('project-library')?.dataset.plContext){event.preventDefault();void window.projectLibrary.close();return;}if(event.key==='Escape'&&tool){event.preventDefault();closeTool();}if(event.key==='t'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.target.closest?.('input,textarea,select,[contenteditable]')){event.preventDefault();document.querySelector('[data-wbf-thought]')?.click();return;}if(event.key===']'&&!event.target.closest?.('input,textarea,[contenteditable="true"]')){event.preventDefault();void openTool('understanding');}});
 const observer=new MutationObserver(()=>{const d=document.getElementById('project-library');if(d?.open&&!d.dataset.plContext)bench();});
 // Home's owner repaints its rows in place; no observer over our own generated section.
 const watchHome=()=>{const d=document.querySelector('#project-library [data-pl-results]');if(d&&!d.dataset.wbfWatch){d.dataset.wbfWatch='true';observer.observe(d,{childList:true});}};
 window.c3WorkbenchFrame={decorate,openTool,closeTool};
 window.addEventListener('c3-header-painted',header);
 window.c3Shell.register('full Workbench frame',()=>{decorate();watchHome();},{order:95,ignore:'#wbf-tools,#wbf-drawer,.wbf-top-actions,.wbf-bench'});
 document.addEventListener('toggle',event=>{if(event.target.id==='project-library')decorate();},true);
 for(const n of ['study-draft-change','study-output-selection','c3-piece-state'])window.addEventListener(n,decorate);
})();
