/* Approved Workbench section geometry, projected onto the maintained content owners.
   Never clone an editor or replace an owner's HTML: handlers, revisions and Undo stay with it. */
(()=>{
 if(window.workbenchSurfaces)return;
 const doc=document,rooms=new Map(),opened=new WeakSet();
 const names={1:'inbox',8:'piece-media',2:'source',3:'research',4:'direction',9:'arrange',10:'audience',11:'share',12:'outputs'};
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const add=(host,selector,classes)=>host.querySelectorAll(selector).forEach(n=>n.classList.add(...classes.split(' ')));
 const reveal=n=>{if(!n)return;for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;n.scrollIntoView?.({block:'nearest'});const target=n.querySelector('summary,h2,h3,button,input,textarea')||n;if(!target.matches('button,input,textarea,summary'))target.tabIndex=-1;target.focus?.({preventScroll:true});};
 function disclosure(parent,node,label,cls){if(!node||node.closest('.'+cls))return;const details=make('details',cls),summary=make('summary','',label);details.append(summary);node.before(details);details.append(node);return details;}
 function inbox(ws){
  const root=ws.querySelector('.material-surface');if(!root)return;root.classList.add('wb-inbox-owner');
  const intake=root.querySelector('.material-intake.flow-drop'),tools=root.querySelector('.material-tools'),notes=root.querySelector('.material-note-tools');
  if(intake){intake.classList.add('drop');const title=intake.querySelector(':scope>span:first-child');if(title&&title.textContent==='Add to this project')title.textContent='Bring something in';if(notes&&notes.parentElement!==intake)intake.append(notes);}
  // These are original owner nodes, moved once into secondary disclosures rather than removed.
  const readiness=root.querySelector('.material-readiness');if(readiness&&!readiness.closest('.wb-intake-status')){const d=disclosure(root,readiness,'Source readiness','wb-intake-status');root.append(d);}
  const extra=root.querySelector(':scope>.sws-work-tools');if(extra){const d=disclosure(root,extra,'More intake tools','wb-intake-more');if(d)root.append(d);}
  for(const row of root.querySelectorAll('.material-record,.flow-material')){
   row.classList.add('mrow');if(!row.querySelector(':scope>.thumb')){const thumb=make('span','thumb');thumb.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6zM15 3v4h4"/></svg>';thumb.setAttribute('aria-hidden','true');row.prepend(thumb);}
   add(row,':scope>div:first-of-type','wb-material-copy');add(row,'.small','m');
  }
  add(root,'.material-inventory','wb-intake-list');add(root,'.material-record>button','wb-material-action');
  if(tools)tools.classList.add('wb-intake-tools');
 }
 function pieceMedia(ws){
  const retained=ws.querySelector('[data-retained-photo-records]');
  if(retained&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
  const root=ws.querySelector('#owned-photo-stage .study-photos');if(!root)return;root.classList.add('wb-piece-contact');
  add(root,'.photo-grid','mgrid');add(root,'.photo-thumb','asset');add(root,'.photo-actions','acts');add(root,'.photo-drop','drop');
  for(const asset of root.querySelectorAll('.photo-thumb')){
   if(asset.querySelector(':scope>.b'))continue;const body=make('span','b');
   for(const node of [...asset.children])if(node.matches('.photo-thumb-label,.photo-thumb-state'))body.append(node);
   asset.append(body);
  }
  // Keep Media tool/part/filter owners adjacent to the contact sheet. Each retains its
  // actual handlers and its original sibling relationship for the filter projection.
  const tools=ws.querySelector('[data-media-outputs-tools="8"]');if(tools){tools.classList.add('wb-piece-media-tools');const grid=tools.querySelector('.mot-tool-grid');if(grid&&!grid.closest('.wb-media-more'))disclosure(tools,grid,'More media tools','wb-media-more');}
 }
 function source(ws){
  add(ws,'.source-reader-toolbar,.source-reader-actions,.material-audio','tbar');
  add(ws,'.source-dialogue-group','tline');add(ws,'.source-speaker','who');add(ws,'.source-remark','quote');add(ws,'[data-source-reader-edit]','fix');
  const root=ws.querySelector('.sws-source,.material-surface');if(!root)return;
  const inventory=root.querySelector('.material-layout>.material-index');if(inventory){const reading=root.querySelector('.material-reading');if(reading)for(const player of [...inventory.querySelectorAll('audio,video')])reading.prepend(player);if(inventory.querySelector('button,[data-material-doc]'))disclosure(root,inventory,'Other connected material','wb-source-inventory');}
  const tools=root.querySelector(':scope>.sws-work-tools');
  if(tools){const more=disclosure(root,tools,'More source tools','wb-source-more');if(more)root.append(more);}
  // Lead with the actual session and its playable recording. Intake, readiness and
  // retained context remain original nodes below the reader, rather than a second inbox.
  let secondary=root.querySelector(':scope>.wb-source-secondary');
  const supplementary=[...root.children].filter(n=>n.matches('.material-readiness,.material-tools,details.sws-secondary:not(:has(.material-reading)),.material-author'));
  if(supplementary.length){if(!secondary){secondary=make('details','wb-source-secondary');secondary.append(make('summary','','Source context & connections'));root.append(secondary);}for(const n of supplementary)secondary.append(n);}
  add(root,'.material-reading>.material-document','wb-source-document');
  // Notes retain their exact anchored controls without pushing the conversation out of view.
  for(const notes of root.querySelectorAll('.conversation-notes'))if(!notes.closest('.wb-source-notes')){const details=make('details','wb-source-notes');details.append(make('summary','','Conversation notes'));notes.before(details);details.append(notes);}
  const connectedToolbar=root.querySelector('.source-reader-toolbar'),fallbackToolbar=root.querySelector(':scope>.wb-source-tools');if(connectedToolbar&&fallbackToolbar)fallbackToolbar.remove();
  let toolbar=connectedToolbar||fallbackToolbar;if(!toolbar){toolbar=make('div','tbar wb-source-tools');const layout=root.querySelector(':scope>.material-layout');if(layout)layout.before(toolbar);else root.prepend(toolbar);}
  if(!toolbar.querySelector('.wb-bilingual,[data-source-original-toggle]')){const bilingual=make('button','btn quiet wb-bilingual','Bilingual view');bilingual.type='button';bilingual.disabled=true;bilingual.title='Bilingual view is not connected. Original and corrected source words remain available.';toolbar.append(bilingual);}
  for(const line of root.querySelectorAll('.source-dialogue-group'))if(!line.querySelector(':scope>.tm')){const time=line.querySelector(':scope>time');if(time)time.classList.add('tm');else{const missing=make('span','tm wb-time-unknown','—');missing.title='No timestamp supplied';missing.setAttribute('aria-label','No timestamp supplied');line.prepend(missing);}}

  // Compact a supplied zero-hour media clock without inventing timing or changing its value.
  for(const time of root.querySelectorAll('.source-dialogue-group>time.tm')){const value=time.getAttribute('datetime')||time.textContent;if(/^00:[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(value)){const short=value.slice(3);if(time.textContent!==short)time.textContent=short;time.title='Timestamp of first remark · '+value;}}

  // Match the approved timestamp / speaker / speech grid using the existing
  // remark and correction nodes. Their owner retains every event handler.
  for(const line of root.querySelectorAll('.source-dialogue-group'))if(!line.querySelector(':scope>.tx')){const speech=make('div','tx');for(const child of [...line.childNodes])if(!(child.nodeType===1&&child.matches('.tm,.who')))speech.append(child);line.append(speech);}
  const hasDialogue=!!root.querySelector('[data-source-reader-dialogue] .source-remark'),retained=!!root.querySelector('.material-reading .material-document .recordBody');root.classList.toggle('wb-source-retained-leading',retained&&!hasDialogue);
  const normalized=text=>String(text||'').toLocaleLowerCase().replace(/\.md$/,'').replace(/^(?:src|raw)\s*[-–—:]\s*/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  for(const record of root.querySelectorAll('.material-document')){const label=record.querySelector(':scope>header h3'),first=record.querySelector('.recordBody>:is(h1,h2,h3):first-child');if(label){const repeated=normalized(label.textContent)===normalized(first?.textContent)||/^(?:source|transcripts? sources?)$/.test(normalized(label.textContent));label.classList.toggle('wb-source-duplicate-title',repeated);}if(first)first.classList.toggle('wb-source-duplicate-title',/^(?:source|transcripts? sources?)$/.test(normalized(first.textContent)));}
  // Session availability is primary; records and optional tooling stay readable
  // in the same owner, with secondary context in one compact disclosure.
  const more=root.querySelector(':scope>.wb-source-more'),boundary=root.querySelector(':scope>.material-boundary');
  if((more||boundary)&&!secondary){secondary=make('details','wb-source-secondary');secondary.append(make('summary','','Source tools & context'));root.append(secondary);}
  if(secondary){const summary=secondary.querySelector(':scope>summary');if(summary.textContent!=='Source tools & context')summary.textContent='Source tools & context';if(more)secondary.append(more);if(boundary)secondary.append(boundary);}
  if(hasDialogue&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
 }
 function selectResearchPoint(details){
  if(!details)return;const points=details.closest('.rpts');for(const other of points?.querySelectorAll('details.wb-point')||[])if(other!==details)other.open=false;details.open=true;
  const summary=details.querySelector(':scope>summary');if(summary&&points){const rect=summary.getBoundingClientRect(),top=rect.top-points.getBoundingClientRect().top;if(top<0)points.scrollTop+=top;else if(top+rect.height>points.clientHeight)points.scrollTop+=top+rect.height-points.clientHeight;summary.focus?.({preventScroll:true});}
 }
 function researchRecords(ws){return [...ws.querySelectorAll('.research-standard-coverage>details:not([data-research-source-point]),.flow-retained .compactRecord,[data-disclosure="retained-research"],[data-disclosure="retained-brief"],[data-disclosure^="research-role:"]')].filter(n=>!n.closest('[data-research-point]'));}
 function research(ws,p){
  const full=ws.querySelector('.research-standard'),shared=ws.querySelector('#material-human-direction');
  // The maintained notes decorator owns this mount as a direct lane child.
  // Disclose its original editor in place rather than moving the mount.
  if(shared){const lane=ws.querySelector('#stage-working-lane')||shared.closest('.flow-paper')||ws;if(shared.parentElement!==lane)lane.prepend(shared);let context=shared.querySelector('.wb-research-shared');if(!context){context=make('details','wb-research-shared');context.append(make('summary','','Shared project notes'));for(const child of [...shared.childNodes])context.append(child);shared.append(context);}}
  // Shared intent is context, never the findings surface or a second Direction editor.
  let host=full||ws.querySelector('.wb-research-empty');
  if(full){const previous=ws.querySelector('.wb-research-empty');if(previous){const tools=previous.querySelector('.wb-research-tools');if(tools)full.append(tools);const notes=previous.querySelector('.wb-research-shared');if(notes&&shared)shared.append(notes);previous.remove();}}
  if(!host){host=make('section','wb-research-empty');host.setAttribute('aria-label','Research work surface');const paper=ws.querySelector('.flow-paper'),title=ws.querySelector(':scope>.c3-ctitle');if(shared)shared.prepend(host);else if(paper)paper.prepend(host);else if(title)title.after(host);else ws.append(host);}
  let split=host.querySelector(':scope>.rsplit');
  if(!split){split=make('div','rsplit wb-research-split');const points=make('div','rpts');points.setAttribute('aria-label','Connected research points');split.append(points);const before=host.querySelector(':scope>[data-research-point]');if(before)before.before(split);else host.append(split);split.append(consolePanel(p));}
  const points=split.querySelector('.rpts');if(shared&&!full){const notes=shared.querySelector('.wb-research-shared');if(notes&&notes.parentElement!==points)points.append(notes);}const retainedTools=host.querySelector(':scope>.wb-research-tools');if(retainedTools)points.append(retainedTools);
  const records=researchRecords(ws),hasPoints=!!host.querySelector('[data-research-point]');
  if(!hasPoints&&!records.length&&!points.querySelector('.wb-research-no-points')){const empty=make('p','dim wb-research-no-points','No connected research points yet. Saved findings and their source evidence appear here. Use /search in the console to explore the Library.');points.append(empty);}
  if(hasPoints||records.length)points.querySelector('.wb-research-no-points')?.remove();
  for(const point of [...host.querySelectorAll(':scope>[data-research-point]')])points.append(point);
  for(const point of points.querySelectorAll(':scope>[data-research-point]')){
   if(point.querySelector(':scope>.wb-point'))continue;
   const heading=point.querySelector(':scope>h2');if(!heading)continue;
   const details=make('details','wb-point'),summary=make('summary','rp'),body=make('div','rpd pdet'),number=make('span','n',String([...points.querySelectorAll(':scope>[data-research-point]')].indexOf(point)+1));heading.classList.add('cl');const level=make('span','lv wb-level-unrecorded');level.title='Read the recorded evidence and uncertainty below';level.setAttribute('aria-hidden','true');summary.append(number,level,heading);details.append(summary,body);
   for(const n of [...point.childNodes])if(n!==heading)body.append(n);
   point.append(details);details.setAttribute('name','wb-research-points');summary.addEventListener('click',event=>{if(!details.open){event.preventDefault();selectResearchPoint(details);}});if(!points.querySelector('details.wb-point[open]'))details.open=true;
   const action=make('button','btn primary wb-discuss-console','Discuss in console');action.type='button';action.onclick=()=>{const command=split.querySelector('.cin input');if(command){command.value='/point '+([...points.querySelectorAll(':scope>[data-research-point]')].indexOf(point)+1);command.focus();}};const acts=make('div','acts');acts.append(action);body.append(acts);
  }
  let rh=points.querySelector(':scope>.rh');if(!rh){rh=make('div','rh');points.prepend(rh);}let counter=rh.querySelector(':scope>.wb-research-count');if(!counter){counter=make('span','wb-research-count');rh.prepend(counter);}const scope=ws.querySelector('.c3-scope');if(scope&&scope.parentElement!==rh)rh.append(scope);const count=points.querySelectorAll(':scope>[data-research-point]').length,label=count+' point'+(count===1?'':'s')+(records.length?' · '+records.length+' record'+(records.length===1?'':'s'):'');if(counter.textContent!==label)counter.textContent=label;const ownerHeading=host.querySelector(':scope>.research-standard-heading');if(ownerHeading){if(!points.querySelector('.wb-research-tools')){const details=make('details','wb-research-tools');details.append(make('summary','','Sources & research tools'));points.append(details);}points.querySelector('.wb-research-tools').append(ownerHeading);}const brief=host.querySelector(':scope>.research-work-brief');if(brief&&brief.nextElementSibling===split)split.after(brief);
  // These entrances open the maintained record node, including its source/status disclosure.
  let access=points.querySelector('.wb-research-records');
  const recordLabel=n=>{const label=n.querySelector(':scope>summary,.recordBody h1,.recordBody h2')?.textContent.trim()||'Retained research record';return window.arCreateDisplay?.recordTitle?.(label)||label;};
  const signature=records.map(recordLabel).join('\n');
  if(!records.length)access?.remove();else if(!access||access.dataset.records!==signature||access._wbRecords?.some((n,i)=>n!==records[i])||access._wbRecords?.length!==records.length){
   if(!access){access=make('div','acts wb-research-records');rh.append(access);}access.replaceChildren();access.dataset.records=signature;access._wbRecords=records;
   records.forEach((record,i)=>{const button=make('button','btn quiet',recordLabel(record));button.type='button';button.dataset.wbResearchRecord=String(i);button.onclick=()=>{if(record.tagName==='DETAILS')record.open=true;reveal(record);};access.append(button);});
  }
  // Findings lead the working surface. Record entrances remain direct when
  // there are no parsed points; otherwise keep the same buttons/handlers in
  // the existing source disclosure rather than duplicating the rail at top.
  if(access&&hasPoints){let tools=points.querySelector(':scope>.wb-research-tools');if(!tools){tools=make('details','wb-research-tools');tools.append(make('summary','','Sources & research tools'));points.append(tools);}if(access.parentElement!==tools)tools.append(access);}else if(access&&access.parentElement!==rh)rh.append(access);
  // Original preparation/source/file controls stay available inside the work area,
  // rather than creating a second scrolling page beneath the full-height console.
  const coverage=[...host.querySelectorAll(':scope>.research-standard-coverage,:scope>.research-work-brief')];
  if(coverage.length){let tools=points.querySelector(':scope>.wb-research-tools');if(!tools){tools=make('details','wb-research-tools');tools.append(make('summary','','Sources & research tools'));points.append(tools);}for(const node of coverage)tools.append(node);}
  const paper=host.closest('.flow-paper');
  const extra=paper?[...paper.children].filter(n=>n!==host&&n!==shared&&!n.contains(host)&&!n.matches('.c3-ctitle,.c3-scope')):[];

  let more=points.querySelector(':scope>.wb-research-tools');
  if(extra.length){if(!more){more=make('details','wb-research-tools');more.append(make('summary','','Sources & research tools'));points.append(more);}for(const child of extra)if(child!==more&&!more.contains(child))more.append(child);}
  // Retain the original file readers in the existing tools disclosure. Their
  // banner must not push the findings offscreen. The phase owner retains its history.
  const history=[ws.querySelector(':scope>.ew-context')].filter(Boolean);
  if(history.length){if(!more){more=make('details','wb-research-tools');more.append(make('summary','','Sources & research tools'));points.append(more);}for(const record of history)more.append(record);}
  const originalHeading=points.querySelector('.research-standard-heading');if(originalHeading&&more&&originalHeading.parentElement!==more)more.prepend(originalHeading);
  // Keep the source quote and recorded findings readable; the original planning,
  // provenance and additional preparation controls retain their own nodes below.
  for(const body of points.querySelectorAll('.wb-point>.rpd')){
   const secondary=[...body.children].filter(n=>n.matches('.research-standard-controls,.research-standard-shift'));
   if(secondary.length){let details=body.querySelector(':scope>.wb-point-more');if(!details){details=make('details','wb-point-more');details.append(make('summary','','Findings & preparation'));const discussion=body.querySelector(':scope>.acts:last-child');if(discussion)discussion.before(details);else body.append(details);}for(const n of secondary)details.append(n);}
  }
  add(points,'.research-standard-said blockquote,.research-standard-point [data-research-quote]','quote');
  add(points,'.research-standard-controls','acts');add(points,'.research-standard-said','ev wb-evidence');add(points,'.research-standard-location','src');

  const notes=points.querySelector(':scope>.wb-research-shared');if(notes&&points.lastElementChild!==notes)points.append(notes);

  if(ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
 }
 function consolePanel(p){
  const panel=make('section','cons wb-console');panel.setAttribute('aria-label','Research console');
  const head=make('div','ch'),title=make('b','', 'Research console');head.append(title,make('span','','· '+(p.name||'This project')),make('span','tag',window.workbenchLibraryResearch?'AI not connected · Library search works':'AI not connected · project search works'));
  const hints=make('div','hints');for(const command of ['/search ','/point ','/sources','/help']){const b=make('button','',command.trim());b.type='button';b.onclick=()=>{input.value=command;input.focus();};hints.append(b);}
  const log=make('div','clog');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-label','Console results');
  const form=make('form','cin'),label=make('label','','research ›'),input=make('input');input.setAttribute('aria-label','Research command');input.autocomplete='off';input.spellcheck=false;input.placeholder='/search words, /point 2, or ask a question';input.id='wb-research-command';label.htmlFor=input.id;const submit=make('button','','Run');submit.type='submit';form.append(label,input,submit);
  const key=String(p.id||''),room=rooms.get(key)||{history:[],entries:[],draft:''};rooms.set(key,room);input.value=room.draft;
  const show=(text,cls='out')=>{log.append(make('div',cls,text));};
  show(window.workbenchLibraryResearch?'Search the maintained Library with exact case-sensitive words. This is source recall, not factual verification or AI. Questions are not sent to a provider; console history stays in this open page.':'Search notes and linked source passages already connected to this project. AI discussion and broader Library retrieval are not connected here. Console history stays in this open page.','hon');
  const active=()=>panel.isConnected&&current()?.id===p.id&&Number(current()?.viewedStage)===3;
  const showResult=entry=>{if(entry.libraryResult&&window.workbenchLibraryResearch){const out=make('div','out wb-library-results');out.append(window.workbenchLibraryResearch.render(entry.libraryResult,{onOpenSource:async ref=>{const old=out.querySelector('.wb-library-preview');old?.remove();const preview=make('details','wb-library-preview');preview.open=true;preview.append(make('summary','','Opening source…'));out.append(preview);try{const source=await window.workbenchLibraryResearch.readSource(ref);if(!active()||!preview.isConnected)return;const title=window.arCreateDisplay?.title?.({title:source.title,name:source.title},'Library source')||source.title;const reading=make('article','wb-library-reading');if(window.studyReadableMarkdown?.render)reading.innerHTML=window.studyReadableMarkdown.render(source.text);else reading.append(make('pre','',source.text));const provenance=make('details','wb-library-provenance');provenance.append(make('summary','','Source details'),make('p','',source.title),make('p','',source.provenanceState),make('p','',`Source ${source.sourceId} · hash ${source.sourceHash}`));preview.replaceChildren(make('summary','',title+(source.stale?' · changed since this search':'')),reading,provenance);}catch(error){if(active()&&preview.isConnected)preview.replaceChildren(make('summary','','Source could not open'),make('p','',error.message));}}}));log.append(out);}else show(entry.result);};
  for(const entry of room.entries){show(entry.command,'in');showResult(entry);}
  let cursor=room.history.length;
  input.oninput=()=>{room.draft=input.value;};
  input.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||!room.history.length)return;e.preventDefault();cursor=Math.max(0,Math.min(room.history.length,cursor+(e.key==='ArrowUp'?-1:1)));input.value=room.history[cursor]||'';room.draft=input.value;};
  form.onsubmit=async e=>{e.preventDefault();if(typeof current==='function'&&(current()?.id!==p.id||Number(current()?.viewedStage)!==3))return;const submitted=input.value,command=submitted.trim();if(!command)return;const ticket=(room.serial||0)+1;room.serial=ticket;room.pending?.abort();room.pending=null;
   const ws=panel.closest('#workspace'),rows=[...ws.querySelectorAll('[data-research-point]')],sources=[...ws.querySelectorAll('[data-learning-shared-body],[data-learning-sources] section,.source-continuation-row')];let result,libraryResult;
   if(/^\/point\s+\d+$/.test(command)){const index=Number(command.split(/\s+/)[1])-1,row=rows[index];if(row){const detail=row.querySelector('.wb-point');if(detail)selectResearchPoint(detail);else reveal(row);result='Opened point '+(index+1)+': '+(row.querySelector('h2')?.textContent||'Research point');}else result='Choose a point from 1 to '+rows.length+'.';}
   else if(command==='/sources')result=sources.length?sources.map((n,i)=>(i+1)+'. '+n.textContent.trim()).join('\n'):'No linked source passages are available in this view. Open Sources and writing context to inspect the current connections.';
   else if(command.startsWith('/search ')&&window.workbenchLibraryResearch){const controller=new AbortController();room.pending=controller;submit.disabled=true;const pending=make('div','hon','Searching Library…');log.append(pending);try{libraryResult=await window.workbenchLibraryResearch.search({query:command.slice(8),signal:controller.signal});result=window.workbenchLibraryResearch.format(libraryResult);}catch(error){if(error.name==='AbortError')return;result='Library search failed: '+error.message;}finally{pending.remove();if(room.serial===ticket){room.pending=null;submit.disabled=false;}}if(!active()||room.serial!==ticket)return;}
   else if(command.startsWith('/search ')){const q=command.slice(8).trim().toLocaleLowerCase();const matches=[...rows,...sources].filter(n=>n.textContent.toLocaleLowerCase().includes(q));result=matches.length?matches.map(n=>{const index=rows.indexOf(n);return (index>=0?'Point '+(index+1)+': ':'Source: ')+n.textContent.trim().replace(/\s+/g,' ').slice(0,520);}).join('\n\n'):'No connected project record matches “'+command.slice(8).trim()+'”.';}
   else if(command==='/help')result='/search words — '+(window.workbenchLibraryResearch?'search the maintained Library (case-sensitive, bounded readable text)':'search connected project records')+'\n/point number — open the exact existing point\n/sources — read linked source context\n↑ / ↓ — earlier commands';
   else result='AI discussion is not connected. Use /search followed by exact words to find available source passages. Your question has not been saved or sent.';
   room.history.push(command);const entry={command,result,...libraryResult?{libraryResult}:{}};room.entries.push(entry);cursor=room.history.length;if(input.value===submitted){room.draft='';input.value='';}show(command,'in');showResult(entry);log.scrollTop=log.scrollHeight;
  };
  panel.append(head,hints,log,form);return panel;
 }
 function direction(ws){
  if(ws.querySelector('.human-direction-editor')&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
  add(ws,'.human-direction-editor','wb-direction-record');
  add(ws,'.human-direction-words','mine');add(ws,'.human-direction-actions','foot');
  for(const editor of ws.querySelectorAll('.human-direction-editor')){const scope=editor.querySelector(':scope>header>label'),actions=editor.querySelector('.human-direction-actions');if(scope&&actions)actions.append(scope);}
  // The actual saved record is the sole editable direction. Open its existing editor,
  // rather than rendering invented prototype angles or a competing text copy.
  for(const editor of ws.querySelectorAll('.human-direction-edit'))if(!opened.has(editor)){opened.add(editor);editor.open=true;}
  // Keep the maintained writer first. Context is still live, in one disclosure,
  // rather than repeating its heading, source picker and part picker above the words.
  const continuation=ws.querySelector('.source-continuation');
  if(continuation){
   let context=continuation.querySelector(':scope>.wb-direction-context');
   if(!context){context=make('details','wb-direction-context');const summary=make('summary','');summary.textContent='Sources & manuscript';context.append(summary);continuation.append(context);}
   for(const node of continuation.querySelectorAll(':scope>.source-continuation-header,:scope>.source-continuation-sources,:scope>footer'))context.append(node);
   for(const note of continuation.querySelectorAll('.human-direction-edit>p.small'))context.append(note);
   const tools=ws.querySelector('#direction-writing-tools');if(tools&&tools.parentElement!==context)context.append(tools);
   const lane=ws.querySelector('#stage-working-lane');
   if(lane){for(const files of lane.querySelectorAll(':scope>.flow-details'))context.append(files);lane.classList.toggle('wb-direction-no-angles',!lane.querySelector('.flow-direction,.recordedDirection'));}

  }
  for(const label of ws.querySelectorAll('.human-direction-words')){
   if(label.firstChild?.nodeType===Node.TEXT_NODE&&label.firstChild.textContent==='Your words')label.firstChild.textContent='What I want this to say — Adrian';
  }
  add(ws,'.recordedDirection','angle');add(ws,'.flow-directions','angles');add(ws,'.flow-direction','angle');
  for(const choice of ws.querySelectorAll('.flow-direction')){let foot=choice.querySelector(':scope>.foot');if(!foot){foot=make('div','foot');const attribution=choice.querySelector(':scope>.small'),decision=choice.querySelector(':scope>[data-flow-action^="pick:"]');if(attribution)foot.append(attribution);if(decision)foot.append(decision);choice.append(foot);}const chosen=foot.querySelector('[data-flow-action]')?.textContent.trim()==='Chosen';choice.classList.toggle('chosen',chosen);const rejected=!!ws.querySelector('.flow-direction [data-flow-action]')&&[...ws.querySelectorAll('.flow-direction [data-flow-action]')].some(n=>n.textContent.trim()==='Chosen')&&!chosen;choice.classList.toggle('rej',rejected);}
  const lane=ws.querySelector('#stage-working-lane');if(lane){let empty=lane.querySelector(':scope>.wb-direction-empty-angles');const any=!!ws.querySelector('.flow-direction,.recordedDirection');if(any)empty?.remove();else if(!empty){empty=make('section','wb-direction-empty-angles');empty.append(make('h2','sec block','Angles'),make('p','dim','No saved angles yet. Your own words above remain the direction for this piece.'));lane.append(empty);}}
 }
 function arrange(ws){
  // A saved output has its own visual surface even when the source piece is words-only.
  if(window.studyOutputConnection?.selection?.()?.output?.id&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
  add(ws,'#study-output-arrange','wb-composition');
  add(ws,'[data-output-stage-surface="9"]','wb-arrange-tools');
  // Native template renders and their controls are deliberately left inside their owner.
  add(ws,'.oss-tool-row','tbar');
 }
 function audience(ws){
  const root=ws.querySelector('[data-output-stage-surface="10"]');if(!root)return;root.classList.add('wb-audience');
  // Move the existing owner action out of the redundant heading; retain its listener
  // and exact selected-edition navigation rather than creating another action.
  const tools=root.querySelector(':scope>.oss-tool-row'),back=root.querySelector('.oss-heading [data-oss-action="arrange"]');
  if(tools){tools.classList.add('wb-audience-selection');if(back){back.classList.add('btn','quiet');back.textContent='Back to Arrange';tools.append(back);}}
  const readiness=root.querySelector('[data-oss-readiness]');
  if(readiness&&!root.querySelector(':scope>.wb-audience-purpose')){const note=make('p','aud-note wb-audience-purpose'),lead=make('b','','Audience is for looking, not editing.');note.append(lead,doc.createTextNode(' This is how a reader meets the piece. Arrange is where you compose it; Outputs is where files leave.'));readiness.before(note);}
  add(ws,'[data-oss-reader]','wb-audience-edition');
  add(ws,'[data-oss-reader] .ar-donor-workspace:has(>.oss-sequence)','phone');add(ws,'[data-oss-reader] .oss-sequence','swipe');add(ws,'[data-oss-reader] .oss-reader','cap2');add(ws,'[data-oss-reader] .ar-output-reader','page');
 }
 function share(ws){
  const root=ws.querySelector('[data-output-stage-surface="11"]');if(!root)return;root.classList.add('wb-invitation');
  const field=root.querySelector('[data-share-field="message"],[data-oss-field="message"]')?.closest('label');if(!field)return;field.classList.add('mine');
  // A recorded recipient makes the real invitation applicable, even for words-only work.
  if(root.querySelector('[data-share-field="recipient"]')?.value.trim()&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
  if(!field.querySelector('.who')){const label=make('span','who','Note to go with it');for(const node of [...field.childNodes])if(node.nodeType===3)node.remove();field.prepend(label);}
  let intro=root.querySelector(':scope>.wb-share-intro');if(!intro){intro=make('p','wb-share-intro dim','Share a readable note of one piece with one person — for a quote check or a read-through. Only you can see this preparation.');root.prepend(intro);}
  let link=root.querySelector(':scope>.wb-share-link');if(!link){link=make('p','wb-share-link');const button=make('button','btn primary','Create a read-only link');button.type='button';button.disabled=true;button.title='Read-only link creation is not connected. Saving or copying an invitation never sends it.';link.append(button);field.after(link);}
  let privacy=root.querySelector(':scope>.wb-share-privacy');if(!privacy){privacy=make('p','wb-share-privacy dim small','Who can see it: only you. Read-only links are not connected.');link.after(privacy);}
  let recipients=root.querySelector(':scope>.wb-share-recipient');if(!recipients){recipients=make('details','oss-disclosure wb-correspondence wb-share-recipient');recipients.append(make('summary','','Recipient & piece'));const body=make('div','oss-disclosed');recipients.append(body);for(const node of [...root.children])if(node.matches('.oss-field-row,.oss-muted')||node.matches('.oss-tool-row')&&node.querySelector('[data-share-output]'))body.append(node);privacy.after(recipients);}
  const actions=[...root.querySelectorAll(':scope>.oss-tool-row')].find(n=>n.querySelector('[data-share-action="save"],[data-oss-action="copy"]'));if(actions){actions.classList.add('wb-share-actions');if(link.previousElementSibling!==actions)field.after(actions);const review=root.querySelector('.oss-heading [data-share-action="look"],.oss-heading [data-oss-action="look"]');if(review)actions.append(review);}
  add(root,'.oss-tool-row','tbar');add(root,'.oss-disclosure','wb-correspondence');
 }

 function outputs(ws,p){
  const root=ws.querySelector('#output-overview .oo-panel');if(!root)return;if(root.querySelector('.oo-row'))window.c3Empty?.reveal?.();root.classList.add('wb-output-tree');add(root,'.oo-register','otree');
  // Project identity is real; it does not infer which source originated an output.
  for(const row of root.querySelectorAll('.oo-row')){if(row.querySelector(':scope>.wb-output-facts'))continue;const facts=make('small','wb-output-facts');for(const n of [row.querySelector('.oo-meta'),row.querySelector(':scope>.oo-state'),row.querySelector(':scope>.oo-delivery')])if(n)facts.append(n);row.append(facts);}
  let origin=root.querySelector(':scope>.origin');if(!origin&&p.name){
   const heading=make('h2','sec wb-output-origin-heading','One project, edited separately');
   origin=make('div','origin');const icon=doc.querySelector('[aria-label="View step 12: Outputs (private register)"] svg')?.cloneNode(true);if(icon){icon.setAttribute('aria-hidden','true');origin.append(icon);}
   const copy=make('div','wb-output-origin-copy');copy.append(make('b','',p.name),make('div','dim small','Each output below has its own text and its own state. Changing one does not change the others.'));origin.append(copy);root.querySelector('.oo-heading')?.after(heading,origin);
  }
  const referenceOnly=[...root.querySelectorAll('.oo-row')].length>0&&[...root.querySelectorAll('.oo-row')].every(row=>row.querySelector('[data-output-action="publication-reference"]'));
  if(referenceOnly&&origin){const heading=root.querySelector('.wb-output-origin-heading'),name=origin.querySelector('b'),note=origin.querySelector('.small');if(heading&&heading.textContent!=='Article & working draft')heading.textContent='Article & working draft';if(name&&name.textContent!=='Working draft')name.textContent='Working draft';if(note&&note.textContent!=='Your editable manuscript.')note.textContent='Your editable manuscript.';const continuation=root.querySelector('.oo-heading [data-output-action="native"]');if(continuation)origin.append(continuation);}
 }
 function decorate(){const p=typeof current==='function'?current():null;for(const [id,room]of rooms)if(room.pending&&(id!==p?.id||Number(p?.viewedStage)!==3)){room.pending.abort();room.pending=null;}const ws=doc.getElementById('workspace'),stage=Number(p?.viewedStage),name=names[stage];if(!ws)return;
  for(const n of Object.values(names))ws.classList.toggle('wb-'+n,!!name&&n===name&&p?.view==='record');
  ws.classList.toggle('wb-section-surface',!!name&&p?.view==='record');if(!name||p?.view!=='record')return;
  ({inbox,'piece-media':pieceMedia,source,research,direction,arrange,audience,share,outputs}[name])(ws,p);
 }
 window.workbenchSurfaces={decorate,selectResearchPoint};window.c3Shell?.register('workbench-surfaces',decorate,{order:85,ignore:'.wb-console'});decorate();
})();
