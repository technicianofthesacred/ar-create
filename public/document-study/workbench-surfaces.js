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
  const tools=root.querySelector(':scope>.sws-work-tools');
  if(tools){const more=disclosure(root,tools,'More source tools','wb-source-more');if(more)root.append(more);}
  // Lead with the actual session and its playable recording. Intake, readiness and
  // retained context remain original nodes below the reader, rather than a second inbox.
  let secondary=root.querySelector(':scope>.wb-source-secondary');
  const supplementary=[...root.children].filter(n=>n.matches('.material-readiness,.material-tools,details.sws-secondary:not(:has(.material-reading)),.material-author'));
  if(supplementary.length){if(!secondary){secondary=make('details','wb-source-secondary');secondary.append(make('summary','','Source context & connections'));root.append(secondary);}for(const n of supplementary)secondary.append(n);}
  add(root,'.material-reading>.material-document','wb-source-document');
  let toolbar=root.querySelector('.source-reader-toolbar,:scope>.wb-source-tools');if(!toolbar){toolbar=make('div','tbar wb-source-tools');const layout=root.querySelector(':scope>.material-layout');if(layout)layout.before(toolbar);else root.prepend(toolbar);}
  if(!toolbar.querySelector('.wb-bilingual')){const bilingual=make('button','btn quiet wb-bilingual','Bilingual view');bilingual.type='button';bilingual.disabled=true;bilingual.title='Bilingual view is not connected. Original and corrected source words remain available.';toolbar.append(bilingual);}
  for(const line of root.querySelectorAll('.source-dialogue-group'))if(!line.querySelector(':scope>.tm')){const time=line.querySelector(':scope>time');if(time)time.classList.add('tm');else{const missing=make('span','tm wb-time-unknown','—');missing.title='No timestamp supplied';missing.setAttribute('aria-label','No timestamp supplied');line.prepend(missing);}}

  const hasDialogue=!!root.querySelector('[data-source-reader-dialogue] .source-remark'),retained=!!root.querySelector('.material-reading .material-document .recordBody');root.classList.toggle('wb-source-retained-leading',retained&&!hasDialogue);
  const normalized=text=>String(text||'').toLocaleLowerCase().replace(/\.md$/,'').replace(/^(?:src|raw)\s*[-–—:]\s*/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  for(const record of root.querySelectorAll('.material-document')){const label=record.querySelector(':scope>header h3'),first=record.querySelector('.recordBody>:is(h1,h2,h3):first-child');if(label){const repeated=normalized(label.textContent)===normalized(first?.textContent)||/^(?:source|transcripts? sources?)$/.test(normalized(label.textContent));label.classList.toggle('wb-source-duplicate-title',repeated);}if(first)first.classList.toggle('wb-source-duplicate-title',/^(?:source|transcripts? sources?)$/.test(normalized(first.textContent)));}
  if(hasDialogue&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
 }
 function research(ws,p){
  const full=ws.querySelector('.research-standard'),shared=ws.querySelector('#material-human-direction');
  let host=full||shared;
  const fallback=ws.querySelector(':scope>.wb-research-empty');
  if(host&&fallback)fallback.remove();
  if(!host){host=fallback;if(!host){host=make('section','wb-research-empty');host.setAttribute('aria-label','Research work surface');const title=ws.querySelector(':scope>.c3-ctitle');if(title)title.after(host);else ws.append(host);}}
  if(full&&shared?.classList.contains('wb-shared-research')){const old=shared.querySelector(':scope>.rsplit');if(old){for(const child of [...old.querySelector('.rpts').childNodes])shared.append(child);old.remove();}shared.classList.remove('wb-shared-research');}
  if(!full&&shared)shared.classList.add('wb-shared-research');
  let split=host.querySelector(':scope>.rsplit');
  if(!split){split=make('div','rsplit wb-research-split');const points=make('div','rpts');points.setAttribute('aria-label','Connected research points');split.append(points);const before=host.querySelector(':scope>[data-research-point]');if(before)before.before(split);else host.append(split);split.append(consolePanel(p));}
  const points=split.querySelector('.rpts');
  if(host.classList.contains('wb-research-empty')&&!points.querySelector('.wb-research-no-points')){const empty=make('div','wb-research-no-points');empty.append(make('h2','','No connected research points yet'),make('p','','Findings and source evidence appear here when this project has saved research. The console can search the project records already connected below.'));points.append(empty);}
  if(!full){for(const child of [...host.children])if(child!==split)points.append(child);}
  for(const point of [...host.querySelectorAll(':scope>[data-research-point]')])points.append(point);
  for(const point of points.querySelectorAll(':scope>[data-research-point]')){
   if(point.querySelector(':scope>.wb-point'))continue;
   const heading=point.querySelector(':scope>h2');if(!heading)continue;
   const details=make('details','wb-point'),summary=make('summary','rp'),body=make('div','rpd pdet'),number=make('span','n',String([...points.querySelectorAll(':scope>[data-research-point]')].indexOf(point)+1));heading.classList.add('cl');summary.append(number,heading);details.append(summary,body);
   for(const n of [...point.childNodes])if(n!==heading)body.append(n);
   point.append(details);if(!points.querySelector('details.wb-point[open]'))details.open=true;
   const action=make('button','btn primary wb-discuss-console','Discuss in console');action.type='button';action.onclick=()=>{const command=split.querySelector('.cin input');if(command){command.value='/point '+([...points.querySelectorAll(':scope>[data-research-point]')].indexOf(point)+1);command.focus();}};const acts=make('div','acts');acts.append(action);body.append(acts);
  }
  let rh=points.querySelector(':scope>.rh');if(!rh){rh=make('div','rh');points.prepend(rh);}let counter=rh.querySelector(':scope>.wb-research-count');if(!counter){counter=make('span','wb-research-count');rh.prepend(counter);}const count=points.querySelectorAll(':scope>[data-research-point]').length,label=count?count+' research point'+(count===1?'':'s'):shared?'Shared project notes':'Research points';if(counter.textContent!==label)counter.textContent=label;const originalHeading=host.querySelector(':scope>.research-standard-heading');if(originalHeading)rh.append(originalHeading);const brief=host.querySelector(':scope>.research-work-brief');if(brief&&brief.nextElementSibling===split)split.after(brief);
  add(points,'.research-standard-said blockquote,.research-standard-point [data-research-quote]','quote');
  add(points,'.research-standard-controls','acts');add(points,'.research-standard-said','ev wb-evidence');add(points,'.research-standard-location','src');
  for(const detail of points.querySelectorAll('.wb-point>.rpd'))if(!detail.querySelector(':scope>.wb-certainty')){const certainty=make('div','seg wb-certainty');certainty.setAttribute('role','group');certainty.setAttribute('aria-label','Certainty · editing not connected');certainty.title='Certainty editing is not connected. Recorded evidence and attribution stay as shown.';for(const label of ['Sure','Unsure','Disputed']){const control=make('button','',label);control.type='button';control.disabled=true;control.title=certainty.title;certainty.append(control);}detail.prepend(certainty);}

  if(ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
 }
 function consolePanel(p){
  const panel=make('section','cons wb-console');panel.setAttribute('aria-label','Research console');
  const head=make('div','ch'),title=make('b','', 'Research console');head.append(title,make('span','','· '+(p.name||'This project')),make('span','tag','AI not connected · project search works'));
  const hints=make('div','hints');for(const command of ['/search ','/point ','/sources','/help']){const b=make('button','',command.trim());b.type='button';b.onclick=()=>{input.value=command;input.focus();};hints.append(b);}
  const log=make('div','clog');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-label','Console results');
  const form=make('form','cin'),label=make('label','','research ›'),input=make('input');input.setAttribute('aria-label','Research command');input.autocomplete='off';input.spellcheck=false;input.placeholder='/search words, /point 2, or ask a question';label.append(input);const submit=make('button','','Run');submit.type='submit';form.append(label,submit);
  const key=String(p.id||''),room=rooms.get(key)||{history:[],entries:[],draft:''};rooms.set(key,room);input.value=room.draft;
  const show=(text,cls='out')=>{log.append(make('div',cls,text));};
  show('Search notes and linked source passages already connected to this project. AI discussion and broader Library retrieval are not connected here. Console history stays in this open page.','hon');
  for(const entry of room.entries){show(entry.command,'in');show(entry.result);}
  let cursor=room.history.length;
  input.oninput=()=>{room.draft=input.value;};
  input.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||!room.history.length)return;e.preventDefault();cursor=Math.max(0,Math.min(room.history.length,cursor+(e.key==='ArrowUp'?-1:1)));input.value=room.history[cursor]||'';room.draft=input.value;};
  form.onsubmit=e=>{e.preventDefault();if(typeof current==='function'&&(current()?.id!==p.id||Number(current()?.viewedStage)!==3))return;const command=input.value.trim();if(!command)return;
   const ws=panel.closest('#workspace'),rows=[...ws.querySelectorAll('[data-research-point]')],sources=[...ws.querySelectorAll('[data-learning-shared-body],[data-learning-sources] section,.source-continuation-row')];let result;
   if(/^\/point\s+\d+$/.test(command)){const index=Number(command.split(/\s+/)[1])-1,row=rows[index];if(row){row.querySelector('.wb-point')?.setAttribute('open','');reveal(row);result='Opened point '+(index+1)+': '+(row.querySelector('h2')?.textContent||'Research point');}else result='Choose a point from 1 to '+rows.length+'.';}
   else if(command==='/sources')result=sources.length?sources.map((n,i)=>(i+1)+'. '+n.textContent.trim()).join('\n'):'No linked source passages are available in this view. Open Sources and writing context to inspect the current connections.';
   else if(command.startsWith('/search ')){const q=command.slice(8).trim().toLocaleLowerCase();const matches=[...rows,...sources].filter(n=>n.textContent.toLocaleLowerCase().includes(q));result=matches.length?matches.map(n=>{const index=rows.indexOf(n);return (index>=0?'Point '+(index+1)+': ':'Source: ')+n.textContent.trim().replace(/\s+/g,' ').slice(0,520);}).join('\n\n'):'No connected project record matches “'+command.slice(8).trim()+'”.';}
   else if(command==='/help')result='/search words — search connected project records\n/point number — open the exact existing point\n/sources — read linked source context\n↑ / ↓ — earlier commands';
   else result='AI discussion is not connected. Use /search followed by words to search the connected project records. Your question has not been saved or sent.';
   room.history.push(command);room.entries.push({command,result});cursor=room.history.length;room.draft='';input.value='';show(command,'in');show(result);log.scrollTop=log.scrollHeight;
  };
  panel.append(head,hints,log,form);return panel;
 }
 function direction(ws){
  if(ws.querySelector('.human-direction-editor')&&ws.querySelector('.c3-empty'))window.c3Empty?.reveal?.();
  add(ws,'.human-direction-editor','wb-direction-record');
  add(ws,'.human-direction-words','mine');add(ws,'.human-direction-actions','foot');
  // The actual saved record is the sole editable direction. Open its existing editor,
  // rather than rendering invented prototype angles or a competing text copy.
  for(const editor of ws.querySelectorAll('.human-direction-edit'))if(!opened.has(editor)){opened.add(editor);editor.open=true;}
  add(ws,'.recordedDirection','angle');add(ws,'.flow-directions','angles');add(ws,'.flow-direction','angle');
  for(const choice of ws.querySelectorAll('.flow-direction')){let foot=choice.querySelector(':scope>.foot');if(!foot){foot=make('div','foot');const attribution=choice.querySelector(':scope>.small'),decision=choice.querySelector(':scope>[data-flow-action^="pick:"]');if(attribution)foot.append(attribution);if(decision)foot.append(decision);choice.append(foot);}const chosen=foot.querySelector('[data-flow-action]')?.textContent.trim()==='Chosen';choice.classList.toggle('chosen',chosen);}
 }
 function arrange(ws){
  add(ws,'#study-output-arrange','wb-composition');
  add(ws,'[data-output-stage-surface="9"]','wb-arrange-tools');
  // Native template renders and their controls are deliberately left inside their owner.
  add(ws,'.oss-tool-row','tbar');
 }
 function audience(ws){
  add(ws,'[data-output-stage-surface="10"]','wb-audience');
  add(ws,'.oss-readiness','aud-note');add(ws,'[data-oss-reader]','wb-audience-edition');
  add(ws,'[data-oss-reader] .ar-donor-workspace:has(>.oss-sequence)','phone');add(ws,'[data-oss-reader] .oss-sequence','swipe');add(ws,'[data-oss-reader] .oss-reader','cap2');add(ws,'[data-oss-reader] .ar-output-reader','page');
 }
 function share(ws){
  const root=ws.querySelector('[data-output-stage-surface="11"]');if(!root)return;root.classList.add('wb-invitation');
  const field=root.querySelector('[data-share-field="message"],[data-oss-field="message"]')?.closest('label');if(field){field.classList.add('mine');const notice=root.querySelector(':scope>.oss-muted');if(notice&&field.previousElementSibling!==notice)notice.after(field);if(!root.querySelector(':scope>.wb-share-link')){const row=make('p','wb-share-link'),link=make('button','btn primary','Create a read-only link');link.type='button';link.disabled=true;link.title='Read-only link creation is not connected. Saving or copying an invitation never sends it.';row.append(link);field.after(row);}}

  add(root,'.oss-tool-row','tbar');add(root,'.oss-disclosure','wb-correspondence');
 }
 function outputs(ws,p){
  const root=ws.querySelector('#output-overview .oo-panel');if(!root)return;if(root.querySelector('.oo-row'))window.c3Empty?.reveal?.();root.classList.add('wb-output-tree');add(root,'.oo-register','otree');
  // Project identity is real; it does not infer which source originated an output.
  for(const row of root.querySelectorAll('.oo-row')){if(row.querySelector(':scope>.wb-output-facts'))continue;const facts=make('small','wb-output-facts');for(const n of [row.querySelector('.oo-meta'),row.querySelector(':scope>.oo-state'),row.querySelector(':scope>.oo-delivery')])if(n)facts.append(n);row.append(facts);}
  let origin=root.querySelector(':scope>.origin');if(!origin&&p.name){origin=make('div','origin');origin.append(make('strong','',p.name),make('span','','Independent expressions · each keeps its own wording and delivery record'));root.querySelector('.oo-heading')?.after(origin);}
 }
 function decorate(){const p=typeof current==='function'?current():null,ws=doc.getElementById('workspace'),stage=Number(p?.viewedStage),name=names[stage];if(!ws)return;
  for(const n of Object.values(names))ws.classList.toggle('wb-'+n,!!name&&n===name&&p?.view==='record');
  ws.classList.toggle('wb-section-surface',!!name&&p?.view==='record');if(!name||p?.view!=='record')return;
  ({inbox,'piece-media':pieceMedia,source,research,direction,arrange,audience,share,outputs}[name])(ws,p);
 }
 window.workbenchSurfaces={decorate};window.c3Shell?.register('workbench-surfaces',decorate,{order:85,ignore:'.wb-console'});decorate();
})();
