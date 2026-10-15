/* Approved Draft surface. Existing editor/adapters remain the owners of every word. */
(()=>{
 const UI_KEY='ar-document-study-draft-surface-v1';
 let focus=false,expanded=false,revealed=false;
 try{focus=JSON.parse(localStorage.getItem(UI_KEY)||'null')?.focus===true}catch{}
 const active=()=>current()?.view==='article'&&current()?.viewedStage===5&&!current()?.referenceOnly;
 const button=(label,action)=>{const el=document.createElement('button');el.type='button';el.textContent=label;el.dataset.surfaceAction=action;return el};
 function setMode(next){focus=next;revealed=false;expanded=false;try{localStorage.setItem(UI_KEY,JSON.stringify({focus}))}catch{}state.variant=focus?'selection':'visible';marginOpen=!focus;decorate();}
 function showMargin(){revealed=true;expanded=true;marginOpen=true;decorateMargin();}
 function decorateMargin(){
  const margin=document.getElementById('margin');if(!active()||!margin)return;
  if(!margin.querySelector('.draft-surface-margin-body')){
   const body=document.createElement('div');body.className='draft-surface-margin-body';
   while(margin.firstChild)body.append(margin.firstChild);
   const head=document.createElement('div');head.className='draft-surface-margin-head';
   const title=document.createElement('strong');title.textContent='Editorial margin';head.append(title,button('Close','close-margin'));
   const summary=document.createElement('div');summary.className='draft-surface-margin-summary';
   const label=document.createElement('span');label.textContent='Your editorial notes';summary.append(label,button('Review notes','open-margin'));
   margin.append(head,summary,body);
   const notes=body.querySelector('.originalNotes');if(notes){const details=document.createElement('details');details.className='draft-surface-retained-notes';const s=document.createElement('summary');s.textContent='Recorded editorial notes · '+notes.querySelectorAll('.originalNote').length;details.append(s,notes);body.append(details);}
   const hint=body.querySelector('.marginHint');if(hint)hint.textContent='Recorded notes stay attached to their passages.';
   const status=document.createElement('p');status.className='draft-surface-ai-state';status.textContent='Live AI is not connected to this editor. Existing sample discussions remain labeled.';body.append(status);
  }
  moveContext();
  margin.classList.toggle('expanded',expanded);margin.classList.toggle('revealed',revealed);
  document.body.dataset.draftFocus=String(focus);
  document.querySelectorAll('[data-surface-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el.dataset.surfaceMode==='focus')===focus)));
 }
 function moveContext(){
  const paper=document.querySelector('.desk>.document'),margin=document.getElementById('margin');if(!paper||!margin)return;
  let meta=paper.querySelector('.draft-surface-document-meta');
  if(!meta){meta=document.createElement('div');meta.className='draft-surface-document-meta';const identity=document.createElement('span');identity.textContent=window.studyDraft?.currentBinding()?'Working file · original preserved':'Browser draft · this device';const details=document.createElement('details');details.className='draft-surface-source';const summary=document.createElement('summary');summary.textContent='Source & brief';const body=document.createElement('div');body.className='draft-surface-source-body';details.append(summary,body);meta.append(identity,details);const title=paper.querySelector(':scope>h1');title?.after(meta);}
  const context=margin.querySelector('.draft-context');if(context){const host=meta.querySelector('.draft-surface-source-body'),retained=host.querySelector(':scope>details.draft-details');host.replaceChildren(context);const file=document.querySelector('.draft-bar>details.draft-details')||retained;if(file)host.append(file);}
  const file=document.querySelector('.draft-bar>details.draft-details');if(file)meta.querySelector('.draft-surface-source-body').append(file);const tabs=document.querySelector('.draft-bar>.draft-tabs');if(tabs){paper.querySelector(':scope>.draft-tabs')?.remove();meta.after(tabs);}const first=paper.querySelector('#manuscript')?.firstElementChild;if(first?.classList.contains('draft-protected')&&/^Conversations over Tea/i.test(first.textContent.trim())){first.classList.add('draft-surface-frontmatter');let next=first.nextElementSibling;while(next&&next.classList.contains('draft-protected')&&(next.querySelector('details>summary')?.textContent==='Story credits'||next.children.length===1&&next.firstElementChild.tagName==='HR')){next.classList.add('draft-surface-frontmatter');next=next.nextElementSibling;}}
 }
 function decorateProse(){
  const p=current(),retained=p?.viewedStage===6&&p?.view==='record';
  for(const words of document.querySelectorAll('#manuscript,.draft-read-words'+(retained?',.phaseReader .recordBody':''))){
   words.classList.add('manuscript-prose');const paper=words.closest('.document,.recordPage');if(!paper)continue;paper.classList.add('prose-document');
   const title=[...paper.children].find(el=>el.tagName==='H1'||el.tagName==='H2'),first=words.firstElementChild;
   const duplicate=first&&/^H[1-6]$/.test(first.tagName)&&title&&first.textContent.trim()===title.textContent.trim();
   if(first)first.classList.toggle('prose-duplicate-title',!!duplicate);
  }
 }
 function decorate(){
  decorateProse();
  const enabled=active();document.body.classList.toggle('draft-surface-active',enabled);if(!enabled){delete document.body.dataset.draftFocus;return;}
  const top=document.querySelector('.workspace>.topbar');if(top&&!top.querySelector('.draft-surface-modes')){
   const modes=document.createElement('div');modes.className='draft-surface-modes';modes.setAttribute('aria-label','Writing view');
   for(const mode of ['margin','focus']){const b=button(mode==='margin'?'Margin':'Focus','mode');b.dataset.surfaceMode=mode;modes.append(b)}
   const theme=top.querySelector('.themeSelect');top.insertBefore(modes,theme||null);
   const projects=top.querySelector('.mobileProjects');if(projects){projects.textContent='Projects';projects.setAttribute('aria-label','Show or hide projects');}
  }
  const row=document.querySelector('.draft-bar>.draft-row'),bar=document.querySelector('.workspace>.workbar');
  if(row&&bar&&!row.classList.contains('draft-surface-actions')){
   bar.classList.add('draft-surface-toolbar');row.classList.add('draft-surface-actions');
   const prior=bar.querySelector('.draft-surface-actions');const extra=prior?.querySelector('.draft-surface-more')||document.createElement('details');extra.className='draft-surface-more';if(!extra.firstChild){const summary=document.createElement('summary');summary.textContent='More';const content=document.createElement('div');content.className='draft-surface-more-body';extra.append(summary,content);}const body=extra.querySelector('.draft-surface-more-body');const retainedUndo=prior?.querySelector('button[onclick="undo()"]');if(retainedUndo)row.insertBefore(retainedUndo,row.querySelector('[data-draft-action="disk-undo"]'));if(prior)prior.remove();
   for(const el of [...bar.children]){
    if(el===row)continue;if(el.tagName==='BUTTON'&&el.getAttribute('onclick')==='undo()'){el.textContent='Undo typing';row.insertBefore(el,row.querySelector('[data-draft-action="disk-undo"]'));}
    else if(el.tagName==='BUTTON'&&el.getAttribute('onclick')==='openInstruction()'){el.textContent='Discuss wording';el.title='Existing discussion tools; sample responses remain labeled';body.append(el);}
    else if(el.tagName==='BUTTON'&&!el.hasAttribute('aria-label'))body.append(el);
    else el.hidden=true;
   }
   row.querySelector('[data-draft-action="disk-undo"]')?.replaceChildren(document.createTextNode('Undo saved'));
   row.querySelector('[data-draft-action="history"]')?.replaceChildren(document.createTextNode('Revisions'));
   const lead=row.querySelector('strong');if(lead)lead.hidden=true;
   for(const key of ['disk-undo','history','download-markdown']){const secondary=row.querySelector('[data-draft-action="'+key+'"]');if(secondary){body.querySelectorAll('[data-draft-action="'+key+'"]').forEach(old=>old.remove());body.append(secondary);}}const studyDetails=top?.querySelector('button[onclick="modal=\'about\';render()"]');if(studyDetails)body.append(studyDetails);
   const status=row.querySelector('[data-draft-status]');if(status)status.classList.add('draft-surface-save-state');
   row.append(button('Margin','open-margin'),extra);bar.append(row);
  }
  const stage=document.querySelector('.workflowStep[onclick="viewPhase(5)"]');if(stage){stage.classList.add('isViewed');stage.setAttribute('aria-current','step');}
  decorateMargin();
 }
 const oldRender=render;render=function(){oldRender();decorate()};
 const oldRefresh=refreshDiscussion;refreshDiscussion=function(){oldRefresh();if(active()){revealed=revealed||marginOpen;decorateMargin()}};
 const oldPositionMargin=positionMargin;positionMargin=function(){if(!active())return oldPositionMargin();const card=document.querySelector('#margin .discussion');if(card)card.style.marginTop='0';};
 const oldPositionNotes=positionOriginalNotes;positionOriginalNotes=function(){if(!active())return oldPositionNotes();document.querySelectorAll('#margin [data-note-anchor]').forEach(el=>{el.style.position='static';el.style.top='auto';el.style.marginTop='0';});};
 const oldClose=closeMargin;closeMargin=function(){if(!active())return oldClose();revealed=false;expanded=false;marginOpen=!focus;decorateMargin()};
 document.addEventListener('click',event=>{const el=event.target.closest?.('[data-surface-action]');if(!el||!active())return;const action=el.dataset.surfaceAction;if(action==='mode')setMode(el.dataset.surfaceMode==='focus');else if(action==='open-margin')showMargin();else if(action==='close-margin'){revealed=false;expanded=false;marginOpen=!focus;decorateMargin();}});
 document.addEventListener('selectionchange',()=>{if(!active()||!focus)return;const selection=window.getSelection();if(selection?.isCollapsed)return;const node=selection?.anchorNode,editor=document.getElementById('manuscript');if(node&&editor?.contains(node)){revealed=true;expanded=true;decorateMargin();}});
 window.addEventListener('study-draft-change',()=>{if(active()){const status=document.querySelector('.draft-surface-save-state');if(status)status.setAttribute('role',status.getAttribute('role')||'status');}});
 let queued=false;new MutationObserver(()=>{if(queued||(!active()&&!document.querySelector('#manuscript,.draft-read-words,.manuscript-prose')))return;queued=true;queueMicrotask(()=>{queued=false;decorate()})}).observe(app,{childList:true,subtree:true});
 decorate();
})();
