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
 let benchCatalog=null,benchQuery='',benchLimit=30,benchEditionView='current',benchMessage='',benchActionBusy=false,benchThreadState='motion',benchThread='',benchMoreOpen=false,ideaRev=null;const ideaCache=new Map();
 const benchHidden=new Map();
 const benchTitle=row=>window.arCreateDisplay?.title({title:row.title})||row.title;
 function restoreBenchInventory(){for(const [node,old]of benchHidden){node.hidden=old.hidden;node.style.cssText=old.style;}benchHidden.clear();}
 function setBenchCatalog(payload={}){
  if(!actualBench())return false;
  queueMicrotask(()=>window.dispatchEvent(new Event('combined-counts')));
  const old=benchCatalog;
  // Callbacks may be replaced without repainting the same metadata under an observer.
  const token=JSON.stringify([payload.scope,payload.ready,payload.error,payload.current,payload.history,payload.capabilities,payload.authorDecisions]);
  if(old&&old.catalog===payload.catalog&&old.token===token){old.open=payload.open;old.refresh=payload.refresh;old.openDecision=payload.openDecision;if(tool==='check')drawer();bench();return true;}
  try{if(!window.arCreateBenchProjection)throw Error('The Home connection is unavailable.');const projection=window.arCreateBenchProjection.project(payload);if(old&&old.scope!==payload.scope){benchQuery='';benchLimit=30;benchEditionView='current';}benchCatalog={...payload,projection,token,ready:projection.ready};benchMessage=payload.error?'Work could not refresh. Saved references remain available.':'';if(tool==='check')drawer();bench();return true;}
  catch(error){if(old){old.ready=false;if(old.scope!==payload.scope)benchCatalog=null;}benchMessage=window.arCreateDisplay?.error(error,'The work list could not refresh. Try again.')||'The work list could not refresh. Try again.';bench();return false;}
 }
 async function openBenchWork(targetKey){
  const entry=benchCatalog;if(benchActionBusy)return;
  try{const descriptor=window.arCreateBenchProjection.descriptor(entry?.projection,targetKey,{scope:entry?.scope,revision:entry?.projection?.revision,ready:entry?.ready});if(typeof entry.open!=='function')throw Error('This work is not connected to an opening action.');benchActionBusy=true;benchMessage='';await entry.open(descriptor);}
  catch(error){if(entry===benchCatalog)benchMessage=window.arCreateDisplay?.error(error,'This work could not open. Your current words are retained.')||'This work could not open. Your current words are retained.';}
  finally{benchActionBusy=false;bench();}
 }
 function homeLabel(label){return esc(label).replace(/¶(\d+)/g,'<span class="combined-paragraph">¶</span>$1');}
 function authorDecisionModel(){
  const value=benchCatalog?.authorDecisions;if(!value)return null;
  const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value),valid=['reading','ready','unavailable'].includes(value.state)&&value.projectId===current().id&&Array.isArray(value.items),items=valid?value.items.filter(item=>{if(!item||typeof item.label!=='string'||!item.label.trim()||typeof item.target?.projectId!=='string'||!item.target.projectId)return false;const t=item.target;return item.kind==='passages'?t.kind==='current-article'&&hash(t.hash)&&t.owner?.kind==='magazine'&&Number.isInteger(item.count)&&item.count>0:['angle','title'].includes(item.kind)?t.kind==='direction'&&hash(t.hash)&&Number.isSafeInteger(t.revision)&&t.revision>=0:item.kind==='carousel-words'?t.kind==='piece-reference'&&hash(t.hash)&&typeof t.reference==='string'&&!!t.reference:false;}):[];
  return {state:valid&&items.length===value.items.length?value.state:'unavailable',items:items.slice(0,100),projectId:value.projectId};
 }
 const authorDecisionKey=item=>JSON.stringify([item.kind,item.target,item.count??null,item.hash??null]);
 // Each decision names its subject and the step it opens, as the Home board shows.
 function authorDecisionPlace(item){
  const t=item.target,id=t.storyId||t.owner?.storyId,stories=benchCatalog?.catalog?.stories||[],story=stories.find(s=>s.id===id)||stories.find(s=>s.nativeProjectId===t.projectId),row=story&&(benchCatalog?.projection?.rows||[]).find(r=>r.kind==='Project'&&r.target?.storyId===story.id);
  return {subject:row?benchTitle(row):story?.name||'',step:({4:'Direction',5:'Write',6:'Read',7:'Check',9:'Arrange',10:'Audience'})[t.stage]||''};
 }
 function authorDecisionHTML(model){
  if(!model?.items.length)return '';
  return `<ol class="moves">${model.items.map(item=>{const place=authorDecisionPlace(item),count=item.kind==='passages'&&!item.label.includes(String(item.count))?`${item.count} pending passages`:item.kind==='carousel-words'&&Number.isInteger(item.count)?`${item.count} slides`:'';return `<li><button type="button" class="move" data-wbf-author-decision="${esc(authorDecisionKey(item))}" ${benchActionBusy||typeof benchCatalog?.openDecision!=='function'?'disabled':''}><span><span class="t">${esc(item.label)}${place.subject?' · '+esc(place.subject):''}</span>${count?`<span class="w">${count}</span>`:''}</span>${place.step?`<span class="go">${place.step} ›</span>`:''}</button></li>`;}).join('')}</ol>`;
 }
 function authorDecisionStatus(model){return model?.state==='reading'?'<p class="dim small" role="status">Reading saved editorial decisions…</p>':model?.state==='unavailable'?'<p class="dim small" role="status">'+(model.items.length?'Some editorial decisions could not be read. The confirmed items above remain waiting.':'Editorial decisions could not be read. Reopen this subject to check them.')+'</p>':'';}
 function refreshCheckDecisions(host){
  const global=authorDecisionModel(),model=global?{...global,items:global.items.filter(item=>item.target.projectId===current().id)}:null;let section=host.querySelector(':scope>[data-wbf-check-decisions]');
  if(!model){section?.remove();return;}
  if(!section){section=document.createElement('section');section.dataset.wbfCheckDecisions='';host.append(section);}
  setHTML(section,'<h3>Needs your decision</h3>'+authorDecisionHTML(model)+authorDecisionStatus(model)+(model.state==='ready'&&!model.items.length?'<p class="dim small">No pending editorial decisions are recorded for this subject.</p>':''));
 }
 async function openAuthorDecision(key){
  if(benchActionBusy)return;const entry=benchCatalog,model=authorDecisionModel(),item=model?.items.find(row=>authorDecisionKey(row)===key);
  try{if(!item||entry!==benchCatalog||typeof entry.openDecision!=='function')throw Error('This decision changed. Reopen this subject’s review.');benchActionBusy=true;benchMessage='';const opened=await entry.openDecision(JSON.parse(JSON.stringify(item)));if(opened===false)throw Error('This decision could not open. Reopen this subject’s review.');}
  catch(error){benchMessage=error.message;toolError(error);}
  finally{benchActionBusy=false;bench();}
 }
 const waitingQuestions=()=>(window.arLive?.waiting?.()||[]).filter(row=>row.type==='question'&&row.line?.status==='needs-decision');
 const questionKey=row=>JSON.stringify([row.line.scope?.kind,row.line.scope?.id,row.line.operationId,row.line.ts]);
 // The saved Direction angle, read once per subject; the line stays out until a real angle is saved.
 function loadIdea(t){
  const id=t?.story?.nativeProjectId,rev=benchCatalog?.catalog?.revision;if(!id||typeof window.directionChoiceContext?.read!=='function')return;
  if(rev!==ideaRev){ideaCache.clear();ideaRev=rev;}
  if(ideaCache.has(id))return;ideaCache.set(id,'');
  Promise.resolve().then(()=>window.directionChoiceContext.read(id)).then(c=>{const text=typeof c?.selectedAngle?.text==='string'?c.selectedAngle.text.replace(/\s+/g,' ').trim():'';if(text&&ideaRev===rev){ideaCache.set(id,text);bench();}}).catch(()=>{});
 }
 // Decisions no listed subject owns stay reachable behind one quiet toggle; unowned questions stay in Optional.
 function homeRest(covered){
  const all=authorDecisionModel(),n=all?all.items.filter(d=>!covered.has(authorDecisionKey(d))).length:0;
  return {n,show:n>0||(!!all&&all.state!=='ready')};
 }
 function homeLists(opts={}){
  const decisionsAll=authorDecisionModel(),decisions=opts.inThread&&decisionsAll&&opts.covered?{...decisionsAll,items:decisionsAll.items.filter(d=>!opts.covered.has(authorDecisionKey(d)))}:decisionsAll,wording=benchCatalog?.current?.wordingReview,review=!decisions&&wording&&Number.isInteger(wording.count)&&wording.count>0&&window.arCreateBenchProjection?.key(wording.target)===benchCatalog.projection?.current?.key?wording:null;
  const questions=waitingQuestions().filter(row=>!opts.coveredQ?.has(questionKey(row))),count=(decisions?.items.length||0)+(review?1:0);
  const knownProjects=new Set(nextProjects().filter(p=>!p.unavailable).map(p=>p.id)),proof=window.studyDraft?.currentProof?.();
  const activity=window.arLive?.state?.(),handled=(activity?.committedLines||[]).filter(row=>row?.status==='committed'&&/^agent:[A-Za-z0-9._-]+$/.test(row.actor||'')&&!['first-flow.select','study.photos.select','study.human-direction.select','study-draft.open'].includes(row.kind)&&Number.isFinite(Date.parse(row.ts))&&((['project','piece'].includes(row.scope?.kind)&&knownProjects.has(row.scope.id))||(row.scope?.kind==='draft'&&row.scope.id===proof?.bindingId&&knownProjects.has(proof?.parentStudyId)))).sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts)).slice(0,5);
  return `<aside class="combined-home-lists" aria-label="Current work">${opts.inThread&&(!opts.showDecisions||!(decisions&&(decisions.items.length||decisions.state!=='ready')))?'':`<section class="combined-home-list" data-home-decisions><h2>Needs your decision${count?' · '+count:''}</h2>${authorDecisionHTML(decisions)}${authorDecisionStatus(decisions)}${review?`<ol class="moves"><li><button type="button" class="move" data-wbf-wording-review="${esc(window.arCreateBenchProjection.key(review.target))}" ${benchActionBusy?'disabled':''}><span class="t">Review marked wording · ${review.count} highlights</span><span class="w">${esc(benchCatalog.projection.current.projectTitle)} · Audience</span></button></li></ol>`:''}${!count&&(!decisions||decisions.state==='ready')?'<p class="dim small">'+(decisions?'No pending editorial decisions are recorded.':'No unanswered editorial decisions.')+'</p>':''}</section>`}<section class="combined-home-list" data-home-optional><h2>Optional</h2>${opts.inThread&&review?`<ol class="moves"><li><button type="button" class="move" data-wbf-wording-review="${esc(window.arCreateBenchProjection.key(review.target))}" ${benchActionBusy?'disabled':''}><span class="t">Review marked wording · ${review.count} highlights</span><span class="w">${esc(benchCatalog.projection.current.projectTitle)} · Audience</span></button></li></ol>`:''}${questions.length?`<ol class="moves">${questions.map(question=>`<li><button type="button" class="move" data-wbf-question="${esc(questionKey(question))}"><span><span class="t">${esc(question.title)}</span><span class="w">${esc(question.piece||'Saved work')} · ${esc(question.who)}</span></span></button></li>`).join('')}</ol>`:movesHTML({learningOnly:actualBench(),heading:false})}</section>${opts.inThread?'':`<section class="combined-home-list" data-home-handled><h2>Handled by agents</h2>${handled.length&&activity?.committedStatus==='unavailable'?'<p class="dim small">Saved activity · recent changes could not refresh.</p>':''}${handled.length?`<ul class="combined-handled">${handled.map(row=>`<li><span>${esc(window.c3Shell?.actorName?.(row.actor)||row.actor)} · ${esc(window.arLive?.label?.(row)||'Saved change')}</span><time datetime="${esc(row.ts)}">${esc(new Date(row.ts).toLocaleDateString())}</time></li>`).join('')}</ul>`:'<p class="dim small">'+(activity?.committedStatus==='unavailable'?'Recent agent changes could not be read.':activity?.committedStatus==='pending'?'Reading recent agent changes…':'No committed agent changes are recorded.')+'</p>'}</section>`}</aside>`;
 }

 async function openWordingReview(key){
  if(benchActionBusy)return;const entry=benchCatalog,review=entry?.current?.wordingReview,p=current(),owner=window.studyDraft?.currentOwner?.(),proof=window.studyDraft?.currentProof?.(),sameOwner=(a,b)=>!!a&&!!b&&['kind','storyId','pieceId','partKey','path'].every(field=>typeof a[field]==='string'&&a[field]===b[field]);
  const exact=()=>{const now=window.studyDraft?.currentProof?.();if(benchCatalog!==entry||current()!==p||p.id!==review?.parentStudyId||!sameOwner(window.studyDraft?.currentOwner?.(),owner)||!sameOwner(now?.owner,owner)||now?.draftHash!==review.hash||window.studyOutputConnection?.selection?.())throw Error('The selected article changed. Reopen its wording review.');};
  try{window.arCreateBenchProjection.descriptor(entry?.projection,key,{scope:entry?.scope,revision:entry?.projection?.revision,ready:entry?.ready});if(!review||window.arCreateBenchProjection.key(review.target)!==key||!sameOwner(review.owner,owner)||proof?.dirty||!/^[a-f0-9]{64}$/i.test(review.hash))throw Error('Save or resolve the current article before reviewing its wording.');exact();benchActionBusy=true;benchMessage='';await window.projectLibrary.close();if(document.getElementById('project-library')?.open)throw Error('Return to the article before reviewing its wording.');exact();await viewPhase(10);exact();}
  catch(error){benchMessage=error.message;const status=document.getElementById('wn-message');if(status){status.textContent=error.message;status.hidden=false;}}
  finally{benchActionBusy=false;bench();}
 }
 // A thread is one subject in motion: its outputs as step tracks, its waiting decisions, and its state.
 // A step counts as done only when saved state shows it; unknown steps stay open.
 function homeThread(entry,group,row){
  const story=entry.catalog?.stories?.find(s=>s.id===(group.project?.target.storyId||group.items[0]?.target?.storyId))||null,ids=new Set([story?.nativeProjectId,...group.items.map(i=>i.target?.parentStudyId)].filter(Boolean)),model=authorDecisionModel(),known=model?.state==='ready';
  const decisions=(model?.items||[]).filter(item=>ids.has(item.target.projectId)||!!story&&(item.target.storyId===story.id||item.target.owner?.storyId===story.id));
  const pending=kind=>decisions.some(d=>d.kind===kind),sources=!!story&&(entry.catalog?.sources||[]).some(s=>s.storyId===story.id&&!s.archived);
  const tracks=group.items.map(item=>{const carousel=/carousel/i.test(item.kind||'');return {item,label:item.kind||'Piece',steps:carousel?[['Words',known&&!pending('carousel-words')],['Visuals',false],['Slides saved',false],['Posted',false]]:[['Source',sources],['Angle',!!story&&known&&!pending('angle')],['Title',!!story&&known&&!pending('title')],['Draft',!!story?.latestDraft],['Passages',!!story&&known&&!pending('passages')],['Check',false],['Published',!!story?.published]]};});
  const done=tracks.reduce((n,t)=>n+t.steps.filter(x=>x[1]).length,0),total=tracks.reduce((n,t)=>n+t.steps.length,0);
  const archived=!!(group.project?.archived||story?.archived||(window.state?.projects||[]).find(p=>p.id===story?.nativeProjectId)?.archived);
  const questions=waitingQuestions().filter(r=>ids.has(r.line.scope?.id));
  return {group,story,ids,questions,key:group.project?.key||group.items[0]?.key||'',title:group.project?group.project.projectTitle:group.items[0]?.projectTitle||'Saved work',decisions,tracks,done,total,state:story?.published?'finished':archived?'resting':'motion',next:decisions[0]?.label||questions[0]?.title||(group.items[0]?group.items[0].kind+' · '+benchTitle(group.items[0]):'No piece yet')};
 }
 function threadNext(t,connected,action){
  if(!t)return '';const d=t.decisions[0],first=t.group.items[0]||t.group.project;
  return `<section class="pickup thread-next-box" aria-label="Next"><div class="lab">Next</div><h2>${esc(d?d.label:first?benchTitle(first):'No piece yet')}</h2><div class="acts">${d?`<button type="button" class="btn primary" data-wbf-author-decision="${esc(authorDecisionKey(d))}" ${benchActionBusy||typeof benchCatalog?.openDecision!=='function'?'disabled':''}>Continue</button>`:first?action(first,'Continue',true):''}</div></section>`;
 }
 function threadDetail(entry,t,nextHTML,connected,covered,coveredQ){
  if(!t)return nextHTML+homeLists();
  const now={angle:'Angle',title:'Title',passages:'Passages','carousel-words':'Words'}[t.decisions[0]?.kind]||'';
  const tracks=t.tracks.map(tr=>`<section class="thread-track"><header><span>${esc(tr.label)} · ${esc(benchTitle(tr.item))}</span><b>${tr.steps.filter(x=>x[1]).length} of ${tr.steps.length}</b></header><ol>${tr.steps.map(([label,done])=>`<li class="${done?'is-done':label===now?'is-now':''}"><button type="button" ${label===now&&!done?'aria-current="step" ':''}data-wbf-thread-open="${esc(tr.item.key)}" ${connected&&tr.item.available&&!benchActionBusy?'':'disabled'}>${esc(label)}</button></li>`).join('')}</ol></section>`).join('');
  const agents=(window.arLive?.state?.()?.committedLines||[]).filter(r=>r?.status==='committed'&&/^agent:/.test(r.actor||'')&&!['first-flow.select','study.photos.select','study.human-direction.select','study-draft.open'].includes(r.kind)&&t.ids.has(r.scope?.id)).slice(0,5),waiting=t.decisions.length+t.questions.length;
  const readyNote=waiting?waiting+' waiting'+(t.questions.length?' · '+t.questions.length+' question'+(t.questions.length===1?'':'s'):''):agents.length?agents.length+' left by agents':'';
  const ready=`<section class="thread-ready" aria-label="Ready for your eye"><header><span class="lab">Ready for your eye</span><span class="dim small">${readyNote}</span></header>${waiting||agents.length?`<ul>${t.decisions.map(d=>{const place=authorDecisionPlace(d);return `<li><button type="button" class="move" data-wbf-author-decision="${esc(authorDecisionKey(d))}" ${benchActionBusy||typeof benchCatalog?.openDecision!=='function'?'disabled':''}><span class="t">${esc(d.label)}</span>${place.step?`<span class="go">${place.step} ›</span>`:''}</button></li>`;}).join('')}${t.questions.map(r=>`<li class="is-question"><button type="button" class="move" data-wbf-question="${esc(questionKey(r))}"><span class="t">${esc(r.title)}</span><span class="go">${esc(r.who||'Agent')} ›</span></button></li>`).join('')}${agents.map(r=>`<li><span>${esc(window.c3Shell?.actorName?.(r.actor)||r.actor)} · ${esc(window.arLive?.label?.(r)||'Saved change')}</span><time class="dim small">${esc(new Date(r.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'}))}</time></li>`).join('')}</ul>`:'<p class="dim small">Nothing here is waiting on you.</p>'}</section>`;
  const rest=homeRest(covered);
  const addFrom=t.group.items[0]||t.group.project||null;
  return `<div class="thread-head"><h2>${esc(t.title)}</h2>${ideaCache.get(t.story?.nativeProjectId)?`<span class="thread-idea" title="${esc(ideaCache.get(t.story.nativeProjectId))}">the idea: ${esc(ideaCache.get(t.story.nativeProjectId))}</span>`:''}<span class="dim small">${t.done} of ${t.total} steps done</span></div>${nextHTML}${ready}${tracks}<section class="thread-box"><header><span class="lab">Thread</span><span class="dim small">what it drew from, what could follow</span>${t.group.project?`<button type="button" class="lnk" data-combined-home-board="${esc(t.group.project.target.storyId)}">Open the board</button>`:''}</header><div class="combined-home-row thread-chain">${t.group.project?homeFlow(entry.catalog,t.group.project.target.storyId):''}<span class="thread-node here"><b>${esc(t.title)}</b><span class="dim small">in motion</span></span>${addFrom?`<button type="button" class="lnk thread-add thread-node ghost" data-wbf-thread-add="${esc(addFrom.key)}" ${connected&&addFrom.available!==false&&!benchActionBusy?'':'disabled'} title="Opens Outputs, where new outputs are made"><b>+ Add an output</b><span class="dim small">made in Outputs</span></button>`:''}</div></section>${rest.show?`<p class="thread-more dim small"><span>${rest.n?rest.n+' more waiting':'Some decisions could not be read'}</span><button type="button" class="lnk" data-wbf-home-more aria-expanded="${benchMoreOpen}">${benchMoreOpen?'Hide':'Show'}</button></p>`:''}${homeLists({inThread:true,covered,coveredQ,showDecisions:rest.show&&benchMoreOpen})}`;
 }
 // Each subject reads left to right: what was gathered, what was understood, what was made.
 function homeFlow(catalog,storyId){
  const rows=(catalog?.sources||[]).filter(s=>s.storyId===storyId&&!s.archived),count=kinds=>rows.filter(s=>kinds.includes(String(s.kind||'').toUpperCase())).length,plural=(n,word)=>n+' '+word+(n===1?'':'s');
  const gathered=count(['RAW','SRC','CONTEXT','TRANSCRIPT','AUDIO','VIDEO','IMAGE','PHOTO','PHOTOS','PDF']),understood=count(['NOTES','RESEARCH','BRIEF','READ','MAP','ASK','IDEA','MOMENTS']);
  return `<span class="combined-home-step">${gathered?plural(gathered,'original source'):'no material yet'}</span><i aria-hidden="true">→</i><span class="combined-home-step">${understood?plural(understood,'research note'):'no notes yet'}</span><i aria-hidden="true">→</i>`;
 }
 function renderCatalogBench(section,d){
  for(const selector of ['.ht-homebar','.pl-results-head','[data-pl-results]','.pl-more']){const owner=d.querySelector(selector);if(owner&&!section.contains(owner)){if(!benchHidden.has(owner))benchHidden.set(owner,{hidden:owner.hidden,style:owner.style.cssText});if(!owner.hidden)owner.hidden=true;if(owner.style.getPropertyValue('display')!=='none')owner.style.setProperty('display','none','important');}}
  loadMoves(d);
  const entry=benchCatalog,model=entry?.projection,connected=!!entry?.ready&&!!model?.ready&&typeof entry.open==='function';
  const action=(row,label,primary=false)=>`<button type="button" class="${primary?'btn primary':'lnk'}" data-wbf-bench-open="${esc(row.key)}" ${connected&&row.available&&!benchActionBusy?'':'disabled'}>${homeLabel(label)}</button>`;
  const title='<div class="thead"><h1>Home</h1></div>';
  const notice=benchMessage?`<p role="status">${esc(benchMessage)}</p>`:model&&!model.ready?'<p class="dim small" role="status">Saved work list · checking for updates…</p>':'';
  if(!model||model.state==='pending'){setHTML(section.querySelector('.wbf-bench-story'),title+notice+(!benchMessage?'<p role="status">Reading your projects and pieces…</p>':'')+(typeof entry?.refresh==='function'?'<button type="button" class="lnk" data-wbf-bench-refresh>Try again</button>':''));setHTML(section.querySelector('.wbf-active'),'');return;}
  const row=model.current;
  const excerpt=entry.current?.excerpt,exactExcerpt=row&&excerpt?.source==='saved-pickup'&&window.arCreateBenchProjection.key(excerpt.target)===row.key&&typeof excerpt.text==='string'?excerpt.text:'';
  const current=row?`<h2>${esc(benchTitle(row))}<span class="sub"> · ${esc(row.kind)}</span></h2><div class="meta">${esc(row.projectTitle)} · ${esc(row.saveLabel)}</div>${exactExcerpt?`<blockquote>${Number.isInteger(excerpt.index)?'<span class="combined-paragraph">¶</span>'+String(excerpt.index+1):''}<span>${esc(exactExcerpt)}</span></blockquote>`:''}<div class="acts">${action(row,row.resumeLabel,true)}${row.target?.storyId?`<button type="button" class="btn" data-combined-home-board="${esc(row.target.storyId)}">Open the board</button>`:''}</div><div class="since"><div class="lab">Recent saved activity</div>${model.history.length?`<ul>${model.history.map(e=>`<li><i></i><span>${esc(e.label)}<small>${esc(e.actor)} · ${esc(new Date(e.at).toLocaleString())}</small></span></li>`).join('')}</ul>`:'<p class="dim small">No saved activity is available for this piece.</p>'}</div>`:'<h2>Choose work to continue</h2><p class="dim">Find a project or piece below. Its saved location and history stay with its owner.</p>';
  
  const q=benchQuery.toLocaleLowerCase(),earlier=item=>item.editionRole&&item.editionRole!=='current',earlierCount=model.rows.filter(item=>item.kind!=='Project'&&earlier(item)).length,inEarlier=benchEditionView==='earlier';
  const build=view=>{
   const old=view==='earlier',visibleRows=model.rows.filter(item=>item.kind!=='Project'&&(old?earlier(item):!earlier(item)));
   const groups=model.rows.filter(item=>item.kind==='Project'&&(old||!earlier(item))).map(project=>{const story=entry.catalog?.stories?.find(s=>s.id===project.target.storyId);return{project,items:visibleRows.filter(item=>item.target.storyId===project.target.storyId||story?.nativeProjectId&&item.target.parentStudyId===story.nativeProjectId)};}).filter(group=>!old||group.items.length),grouped=new Set(groups.flatMap(group=>group.items.map(item=>item.key)));
   // Unresolved owners stay individually addressable in the saved-record view.
   // Equal display titles never merge their identities or adopt their words.
   groups.push(...visibleRows.filter(item=>!grouped.has(item.key)).map(item=>({project:null,items:[item]})));
   return groups.filter(group=>!q||[group.project,...group.items].filter(Boolean).some(item=>[benchTitle(item),item.projectTitle,item.kind].join(' ').toLocaleLowerCase().includes(q)));
  };
  // Home is threads: subjects in motion, closest to finished first; resting and finished on their own tabs.
  const threads=build(benchEditionView).map(group=>homeThread(entry,group,row)),counts={motion:0,resting:0,finished:0};for(const t of (inEarlier?build('current').map(group=>homeThread(entry,group,row)):threads))counts[t.state]++;
  const visible=(inEarlier?threads:threads.filter(t=>t.state===benchThreadState)).sort((a,b)=>inEarlier?0:(b.total?b.done/b.total:0)-(a.total?a.done/a.total:0));
  const filtered=visible.map(t=>t.group),shown=filtered.slice(0,benchLimit),shownThreads=visible.slice(0,benchLimit);
  const pickupThread=row?shownThreads.find(t=>[t.group.project,...t.group.items].some(item=>item?.key===row.key||item?.target?.storyId&&item.target.storyId===row.target?.storyId)):null;
  const selected=shownThreads.find(t=>t.key===benchThread)||pickupThread||shownThreads[0]||null;
  loadIdea(selected);
  const coveredQ=new Set(visible.flatMap(t=>t.questions.map(questionKey)));
  setHTML(section.querySelector('.wbf-bench-story'),title+notice+threadDetail(entry,selected,selected&&selected===pickupThread?`<section class="pickup" aria-label="Pick up where you left off"><div class="lab">Next</div>${current}</section>`:threadNext(selected,connected,action),connected,new Set(visible.flatMap(t=>t.decisions.map(authorDecisionKey))),coveredQ));
  const inventory=section.querySelector('.wbf-active'),search=inventory.querySelector('[data-wbf-bench-search]'),focused=search===document.activeElement,cursor=focused?search.selectionStart:null;
  setHTML(inventory,`<div class="thread-tabs" role="tablist" aria-label="Subjects by state">${[['motion','In motion'],['resting','Resting'],['finished','Finished']].map(([key,label])=>`<button type="button" role="tab" data-wbf-thread-state="${key}" aria-selected="${!inEarlier&&benchThreadState===key}">${label} <b>${counts[key]}</b></button>`).join('')}${earlierCount||inEarlier?`<button type="button" role="tab" data-wbf-bench-editions="earlier" aria-selected="${inEarlier}">Earlier<span class="ed"> editions</span> <b>${earlierCount}</b></button>`:''}<span class="thread-tools"><input type="search" data-wbf-bench-search value="${esc(benchQuery)}" placeholder="Find a subject or piece  /" aria-label="Find saved work"><button type="button" class="thread-tool" data-combined-home-board="">All subjects</button>${d.querySelector('[data-pl-new]')?'<button type="button" class="thread-tool" data-wbf-new>+ New subject</button>':''}</span></div><div class="alist combined-home-subjects thread-list" data-wbf-bench-results>${shown.map((group,index)=>{const t=shownThreads[index],waitN=t.decisions.length+t.questions.length;return `<article class="combined-home-subject thread-row${t===selected?' is-selected':''}" data-wbf-thread="${esc(t.key)}"><span class="thread-n">${String(index+1).padStart(2,'0')}</span><div class="thread-main"><header>${group.project?action(group.project,group.project.projectTitle):`<strong class="thread-title">${esc(group.items[0].projectTitle)}</strong>`}</header><span class="thread-next">${t.decisions.length?'<i class="thread-eye" aria-hidden="true"></i>':t.questions.length?'<i class="thread-eye is-q" aria-hidden="true"></i>':''}<span class="tn">${esc(waitN?String(t.next).replace(/\s+waiting for you$/i,''):t.next)}</span>${waitN?`<span class="tw"> · ${waitN} waiting</span>`:''}</span>${inEarlier?`<div class="combined-home-row"><div class="combined-home-pieces">${group.items.map(item=>`<button type="button" data-wbf-bench-open="${esc(item.key)}" ${connected&&item.available&&!benchActionBusy?'':'disabled'}>${esc(item.kind)} · ${esc(benchTitle(item))}</button>`).join('')||'<span class="dim small">No piece listed</span>'}</div></div>`:''}</div><div class="thread-bars" aria-hidden="true">${t.tracks.map(tr=>`<i style="--done:${tr.steps.length?Math.round(100*tr.steps.filter(x=>x[1]).length/tr.steps.length):0}%"></i>`).join('')}</div></article>`;}).join('')||`<p class="dim">${benchQuery?'No matching saved work.':'No saved work is recorded yet.'}</p>`}</div>${shown.length<filtered.length?`<button type="button" class="lnk" data-wbf-bench-more>Show more · ${shown.length} of ${filtered.length}</button>`:''}`);
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
 function closeTool(){compareIntent++;stopSources(document.getElementById('wbf-drawer'));stopUnderstanding(document.getElementById('wbf-drawer'));restore();if(tool==='proposals')window.studyAIProposals?.closeForDrawer?.();tool='';delete document.body.dataset.wbfDrawerTool;const d=document.getElementById('wbf-drawer');d?.wbfEmptyObserver?.disconnect();d?.remove();document.body.classList.remove('wbf-drawer-open');returnFocus?.isConnected&&returnFocus.focus?.({preventScroll:true});}
 function drawer(){
  if(!tool)return;
  let d=document.getElementById('wbf-drawer');if(!d){d=document.createElement('aside');d.id='wbf-drawer';d.setAttribute('aria-label','Tools beside the writing');d.innerHTML='<div class="dr-head"><h2></h2><button class="btn quiet" data-wbf-close aria-label="Close tools">'+ic('close')+'</button></div><div class="dr-tabs" role="tablist"></div><div class="dr-body"></div>';document.body.append(d);}
  setHTML(d.querySelector('h2'),esc(({understanding:'Understanding',check:'Check',history:'History',sources:'Sources',proposals:'AI proposals',recovery:'Earlier writing & recovery'})[tool])+' <span class="sub">· '+esc(current().name)+'</span>');
  setHTML(d.querySelector('.dr-tabs'),(tool==='proposals'?['understanding','proposals','history','sources']:['understanding','check','history','sources']).map(k=>`<button type="button" role="tab" data-wbf-tool="${k}" aria-selected="${tool===k}" class="${tool===k?'on':''}">${({understanding:'Understanding',check:'Check',history:'History',sources:'Sources',proposals:'Proposals'})[k]}</button>`).join(''));
  d.dataset.tool=tool;document.body.dataset.wbfDrawerTool=tool;
  const host=d.querySelector('.dr-body'),ownerKey=tool==='sources'?(()=>{try{return sourceContext().stamp;}catch{return current().id+':unavailable';}})():current().id+':'+(window.studyDraft?.currentBinding?.()?.id||'');
  if(tool!=='sources')stopSources(d);
  const understanding=window.workbenchUnderstanding?.mount;
  if(tool==='understanding'&&typeof understanding==='function'){
   const binding=[5,6,7].includes(stage())?window.studyDraft?.currentBinding?.():null,selection=window.studyOutputConnection?.selection?.(),owner=window.studyDraft?.currentOwner?.(),proof=window.studyDraft?.currentProof?.();
   const contextKey=JSON.stringify([current().id,binding?.id,binding?.parentStudyId,binding?.sourceBindingId,binding?.canonicalOutputId,owner?.kind,owner?.storyId,owner?.pieceId,owner?.path,proof?.parentStudyId,selection?.projectId,selection?.rootBindingId,selection?.output?.id]);
   d.wbfEmptyObserver?.disconnect();d.wbfEmptyObserver=null;
   if(host.dataset.tool!==tool||mounted!==ws()||host.wbfUnderstandingKey!==contextKey||host.wbfUnderstandingMount!==understanding){
    stopUnderstanding(d);restore();host.replaceChildren();host.dataset.tool=tool;host.dataset.ownerKey=ownerKey;host.wbfOwner=null;mounted=ws();host.wbfUnderstandingKey=contextKey;host.wbfUnderstandingMount=understanding;
    try{host.wbfUnderstanding=understanding(host,{projectId:current().id});}
    catch(error){const message=document.createElement('p');message.className='dim';message.textContent='Understanding is unavailable: '+error.message;host.append(message);}
   }
   document.body.classList.add('wbf-drawer-open');return;
  }
  stopUnderstanding(d);
  const found=tool==='proposals'?document.getElementById('study-ai-proposals'):tool==='recovery'?document.querySelector('.draft-bar'):tool==='check'?document.querySelector('.wn-check-findings'):tool==='understanding'?document.querySelector('#c3-insp-decisions #downstream-human-direction,#downstream-human-direction'):tool==='sources'?document.querySelector('.draft-surface-source'):tool==='history'?[...document.querySelectorAll('.draft-bar>.draft-inspect')].find(n=>n.querySelector('summary')?.textContent.trim()==='History'):null;
  const target=(found&&(!found.closest('#wbf-drawer')||host.dataset.ownerKey===ownerKey)?found:null)||(host.dataset.ownerKey===ownerKey&&host.contains(host.wbfOwner)?host.wbfOwner:null);
  // A replaced owner or a story switch must never leave another piece's controls in this drawer.
  if(host.dataset.tool!==tool||mounted!==ws()||host.dataset.ownerKey!==ownerKey||host.wbfOwner!==target){
   stopSources(d);restore();host.replaceChildren();host.dataset.tool=tool;host.dataset.ownerKey=ownerKey;host.wbfOwner=target;mounted=ws();
   if(target){move(target,host);if(tool==='proposals')target.hidden=false;if(target.tagName==='DETAILS')target.open=true;}
   else if(tool==='check'&&window.studyDraftCheck?.mount){host.wbfOwner=window.studyDraftCheck.mount(host);}
   else{const p=document.createElement('p');p.className='dim wbf-drawer-empty';p.textContent=tool==='sources'?'No retained working-file source context is connected to this piece.':tool==='history'?'No earlier saved versions are available for this piece yet.':tool==='understanding'?'No saved direction for this piece yet. Write your thoughts in Direction.':'Checks appear beside the saved manuscript.';host.append(p);}
  }
  if(tool==='sources'&&!host.wbfSources)host.wbfSources=mountSources(host);
  d.wbfEmptyObserver?.disconnect();d.wbfEmptyObserver=null;
  if(tool==='understanding'){
   const owner=host.wbfOwner,refreshEmpty=()=>{const empty=host.querySelector(':scope>.wbf-drawer-empty');if(owner?.textContent.trim())empty?.remove();else if(!empty){const message=document.createElement('p');message.className='dim wbf-drawer-empty';message.textContent='No saved direction for this piece yet. Write your thoughts in Direction.';host.append(message);}};
   refreshEmpty();if(owner instanceof Node){d.wbfEmptyObserver=new MutationObserver(refreshEmpty);d.wbfEmptyObserver.observe(owner,{childList:true,subtree:true,characterData:true});}
  }
  if(tool==='check')refreshCheckDecisions(host);
  document.body.classList.add('wbf-drawer-open');
 }
 function toolError(error){let status=document.getElementById('wn-message')||document.getElementById('wbf-tool-message');if(!status){status=document.createElement('p');status.id='wbf-tool-message';status.className='dim small';status.setAttribute('role','status');ws()?.prepend(status);}if(status){status.textContent=error.message||'This tool is unavailable. Your current work is retained.';status.hidden=false;}}
 function selectedScopeKey(){const p=current(),proof=window.studyDraft?.currentProof?.(),owner=window.studyDraft?.currentOwner?.(),binding=window.studyDraft?.currentBinding?.();if([5,6,7].includes(stage())&&proof?.parentStudyId===p.id){if(owner?.kind==='magazine'&&proof.owner?.kind==='magazine'&&['storyId','pieceId','path'].every(key=>owner[key]&&owner[key]===proof.owner[key]))return JSON.stringify(['magazine',p.id,owner.storyId,owner.pieceId,owner.path]);if(binding?.id&&binding.parentStudyId===p.id&&proof.bindingId===binding.id)return JSON.stringify(['native',p.id,binding.id,binding.canonicalOutputId]);}const s=window.studyOutputConnection?.selection?.();return JSON.stringify([p.id,s?.projectId,s?.rootBindingId,s?.output?.id]);}
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
   if(typeof window.workspaceNavigation?.whenNavigationReady==='function')await window.workspaceNavigation.whenNavigationReady();
   const navigationOwner=window.workspaceNavigation?.navigationOwner?.(),navigationKey=value=>{if(!value)return null;if(value.kind==='magazine')return JSON.stringify([value.projectId,'magazine',value.owner.storyId,value.owner.pieceId,value.owner.path]);const selected=window.studyOutputConnection?.selection?.();if(value.outputId||value.owner?.outputId&&selected?.projectId===value.projectId&&selected.output?.id===value.owner.outputId)return JSON.stringify([value.projectId,'output',value.rootBindingId||selected?.rootBindingId,value.outputId||value.owner.outputId]);return JSON.stringify([value.projectId,'native',value.owner?.bindingId]);};const expectedNavigation=navigationKey(navigationOwner);
   const id=current().id,scope=selectedScopeKey(),connected=window.studyOutputConnection?.selection?.(),proof=window.studyDraft?.currentProof?.(),owner=window.studyDraft?.currentOwner?.(),binding=window.studyDraft?.currentBinding?.();
   const checkedArticle=stage()===7&&proof?.parentStudyId===id&&(owner?.kind==='magazine'&&proof.owner?.kind==='magazine'&&['storyId','pieceId','path'].every(key=>owner[key]&&owner[key]===proof.owner[key])||binding?.id&&binding.parentStudyId===id&&proof.bindingId===binding.id);
   if(![5,6,7].includes(stage())||connected?.output?.kind==='carousel'&&!checkedArticle){
    if(typeof window.workspaceNavigation?.changeMode!=='function')throw Error('The selected output’s checking connection is unavailable.');
    await window.workspaceNavigation.changeMode('check');
    const openedOwner=window.workspaceNavigation?.navigationOwner?.(),exactNavigation=expectedNavigation?navigationKey(openedOwner)===expectedNavigation&&(proof?.dirty||!navigationOwner.hash||openedOwner?.hash===navigationOwner.hash):selectedScopeKey()===scope||!proof?.bindingId&&!owner&&!!openedOwner;
    if(current().id!==id||!exactNavigation||(![5,6,7].includes(stage())&&!window.workspaceNavigation?.isCarouselCheck?.()))throw Error('The selected work changed before Check could open.');
   }
   closeTool();tool='check';mounted=null;decorate();document.querySelector('#wbf-drawer [data-wbf-close]')?.focus({preventScroll:true});return;
  }
  if(tool===k){closeTool();return;}
  restore();if(tool==='proposals')window.studyAIProposals?.closeForDrawer?.();if(k==='proposals'){if(typeof window.studyAIProposals?.openForDrawer!=='function')throw Error('Proposal review is unavailable for this working part.');if(document.body.dataset.draftFocus==='true'){const margin=document.querySelector('.workspace>.topbar [data-surface-mode="margin"]');if(!margin)throw Error('Leave Focus before opening proposal review.');margin.click();}window.studyAIProposals.openForDrawer();}tool=k;mounted=null;
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
  if(label){const text=globalLibrary?'All subjects':document.getElementById('project-library')?.open?'All subjects':current().name||'Subjects';if(label.textContent!==text)label.textContent=text;switcher.setAttribute('aria-label',globalLibrary?'All subjects, switch subject':text+', switch subject');bar.dataset.wbfGlobal=String(globalLibrary);}
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
   return root.querySelector('.car-writing-page')?(root.querySelector('.car-writing-page').dataset.writingView==='read'?'Read':'Write'):root.querySelector('.car-stage')?'Arrange':null;
  }catch{return null;}
 }
 function carouselFrame(w,bar){
  if(!bar)return;
  const mode=nativeCarouselMode(w),label=bar?.querySelector('.sb-cp-name');
  if(label){const previous=carouselLabels.get(label);if(mode){if(!previous)carouselLabels.set(label,{before:label.textContent,applied:mode});else previous.applied=mode;if(label.textContent!==mode)label.textContent=mode;}else if(previous){if(label.textContent===previous.applied&&label.textContent!==previous.before)label.textContent=previous.before;carouselLabels.delete(label);}}
  const redundant=['Write','Read'].includes(mode)?[...bar.querySelectorAll('.sb-pw')].filter(node=>{const button=node.querySelector('[data-sb-primary]');return button&&/^Write first$/i.test((button.getAttribute('aria-label')||button.textContent).trim());}):[];
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
  }else{tools?.remove();w.querySelector('#wbf-document-actions')?.remove();if(tool&&tool!=='understanding'&&!(tool==='check'&&window.workspaceNavigation?.isCarouselCheck?.()))closeTool();}
  document.body.classList.toggle('wbf-check-open',n===7||!!window.workspaceNavigation?.isCarouselCheck?.());
  const picker=w.querySelector('.draft-bar>.draft-part-picker,.draft-bar>[data-draft-action="parts"]');
  if(picker){let part=w.querySelector('#wbf-parts');if(!part){part=document.createElement('details');part.id='wbf-parts';part.dataset.c3RetainControl='';part.innerHTML='<summary>Parts</summary><div></div>';w.querySelector('#c3-surface-bar .sb-right')?.append(part);}part.querySelector('div').append(picker);}
  const margin=w.querySelector('#margin');if(margin)margin.classList.add('wbf-margin');
  let pull=document.getElementById('wbf-pull');if([5,6].includes(n)){if(!pull){pull=document.createElement('button');pull.id='wbf-pull';pull.type='button';pull.dataset.wbfTool='understanding';pull.title='Pull out the understanding (])';pull.setAttribute('aria-label','Pull out the understanding');pull.innerHTML=ic('chev');document.body.append(pull);}}else pull?.remove();
  drawer();
 }
 function benchLocation(projectId){return window.workspaceNavigation?.lastLocation?.(projectId)||null;}
 // Ephemeral projection of the maintained read-only output register. It never
 // stores task status, changes project to inspect it, or marks a move complete.
 let nextSerial=0,nextIntent=0,nextMoves=null,nextBusy=false;
 const nextProjects=()=>{
  if(!actualBench())return state.projects.filter(p=>typeof p.id==='string'&&!p.archived);
  const catalog=benchCatalog?.catalog;if(!catalog)return[];
  const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value),groups=new Map(),excluded=new Set(catalog.excludedProjectIds||[]),out=[];
  for(const story of catalog.stories||[]){if(story.archived||excluded.has(story.id)||excluded.has(story.nativeProjectId))continue;if(typeof story.nativeProjectId!=='string'||!story.nativeProjectId){out.push({id:'unresolved:'+story.id,name:story.name,unavailable:'No native project identity is registered for this saved work.',scopeProof:story.id});continue;}const rows=groups.get(story.nativeProjectId)||[];rows.push(story);groups.set(story.nativeProjectId,rows);}
  for(const [id,stories]of groups){if(state.projects.some(p=>p.id===id&&p.archived))continue;const targets=[];let invalid=false;
   for(const link of catalog.workspaceLinks?.pieces||[])for(const [index,target]of (link.targets||[]).entries())if(target.parentStudyId===id&&target.role==='parent-study-workspace'){
    const entries=(catalog.workspacePieces||[]).filter(piece=>piece.id===link.workspaceId),entry=entries.length===1?entries[0]:null;
    if(!entry||!uuid(entry.id)||!uuid(entry.documentId)||target.workspaceId!==entry.id||target.documentId!==entry.documentId||target.bindingKey!==id){invalid=true;continue;}targets.push({workspaceId:entry.id,documentId:entry.documentId,targetIndex:index,rootBindingId:target.rootBindingId,originalId:target.originalId,originalHash:target.originalHash,partKey:target.partKey});
   }
   const owners=new Map(targets.map(t=>[JSON.stringify([t.workspaceId,t.documentId]),{projectId:t.workspaceId,documentId:t.documentId}])),warm=state.projects.some(p=>p.id===id&&!p.archived),rootTargets=targets.filter(t=>uuid(t.rootBindingId)&&typeof t.originalId==='string'&&t.originalId&&/^[a-f0-9]{64}$/.test(t.originalHash||'')),navigation=rootTargets.length===1&&stories.length===1?{workspaceId:rootTargets[0].workspaceId,targetIndex:rootTargets[0].targetIndex,parentStudyId:id,rootBindingId:rootTargets[0].rootBindingId,storyId:stories[0].id}:null;
   const scopeProof=JSON.stringify([id,stories.map(s=>s.id).sort(),targets,invalid]);out.push({id,name:stories.length===1?stories[0].name:'Saved native project',scopeProof,expectedOwner:owners.size===1?[...owners.values()][0]:null,navigation,unavailable:invalid||owners.size>1?'The saved native project ownership is ambiguous.':!warm&&!navigation?'Open the exact registered project before its current moves can be picked up.':null});
  }return out;
 };
 const nextKey=row=>row.output?JSON.stringify([row.projectId,row.output.id,row.output.rootBindingId,row.output.edition??null]):row.key;
 const nextProof=output=>JSON.stringify([output.id,output.rootBindingId,output.edition??null,output.kind,output.format,output.status,output.nextAction]);
 const nextLive=(d,serial)=>serial===nextSerial&&d?.isConnected&&d.open&&!d.dataset.plContext&&d.dataset.workbenchPieces!=='true';
 async function readOutputMoves(projectId){
  if(typeof window.realOutputOverview?.read!=='function'||typeof window.realOutputOverview?.onAction!=='function')throw Error('Saved output actions are unavailable.');
  const data=await window.realOutputOverview.read({projectId});
  if(data?.projectId!==projectId||!Array.isArray(data.outputs)||data.outputs.some(o=>typeof o?.id!=='string')||new Set(data.outputs.map(o=>o.id)).size!==data.outputs.length)throw Error('The output reader did not confirm this project’s exact pieces.');
  if(data.availability&&data.availability.state!=='ready'||data.emptyMessage)throw Error(data.availability?.message||data.emptyMessage);
  const rows=[],unknown=[];
  for(const output of data.outputs){
   if(['ready','published','complete','completed','draft','in-progress'].includes(output.status))continue;
   if(!['correction-needed','review-needed'].includes(output.status)||typeof output.rootBindingId!=='string'||!output.rootBindingId||!['native','words','arrange','review'].includes(output.nextAction?.kind)||!output.nextAction.label||output.nextAction.disabled){unknown.push('A saved output has no current next-action proof.');continue;}
   rows.push({projectId,output,proof:nextProof(output)});
  }
  return {rows,unknown};
 }
 async function readMoves(projectId){
  const rows=[],unknown=[];
  const readers=[...(actualBench()?[]:[()=>readOutputMoves(projectId)]),async()=>{if(typeof window.studyBenchMoves?.read!=='function')throw Error('Source and Research moves are unavailable.');const target=actualBench()?nextProjects().find(p=>p.id===projectId):null;if(actualBench()&&(!target||target.unavailable))throw Error(target?.unavailable||'The native project context changed.');const result=await window.studyBenchMoves.read(projectId,target?.expectedOwner?{expectedOwner:target.expectedOwner}:undefined);return target?{...result,rows:result.rows.map(row=>({...row,catalogScopeProof:target.scopeProof,catalogOwner:target.expectedOwner,catalogNavigation:target.navigation}))}:result;}];
  const results=await Promise.allSettled(readers.map(read=>read()));
  for(const result of results)if(result.status==='fulfilled'){rows.push(...result.value.rows);unknown.push(...result.value.unknown);}else unknown.push(result.reason.message);
  return{rows,unknown};
 }
 function movesHTML({learningOnly=false,heading=true}={}){
  const m=nextMoves,rows=(m?.rows||[]).filter(row=>!learningOnly||!row.output);
  return `<div data-wbf-next-list>${heading?'<h2 class="sec">Next moves</h2>':''}${rows.length&&!actualBench()?`<p class="dim small">${rows.length} current ${learningOnly?'Source and Research':'saved'} moves.</p>`:''}${m?.loading?'<p role="status">'+(actualBench()?'Reading suggestions…':'Reading current work…')+'</p>':''}${m?.message?'<p role="status">'+esc(m.message)+'</p>':''}<ol class="moves">${rows.map(row=>`<li><button type="button" class="move" data-wbf-next="${esc(nextKey(row))}" ${nextBusy?'disabled':''}><span><span class="t">${esc(row.output?row.output.nextAction.label:row.label)} · ${esc(row.output?.title||row.title||row.output?.format||'Saved work')}</span><br><span class="w">${esc(nextProjects().find(p=>p.id===row.projectId)?.name||'Project')} · ${esc(row.output?.format||(row.kind==='source'?'Source passage':'Research point'))}${row.reasons?' · '+esc(row.reasons.join(', ')):''}</span></span></button></li>`).join('')}</ol>${m&&!m.loading&&!rows.length&&!m.errors.length?'<p class="dim small">No optional suggestions right now.</p>':''}${m?.errors.length?'<p class="combined-home-coverage dim small" role="status">'+(actualBench()?'Optional suggestions are not available right now.':'Optional suggestions could not be read for '+m.errors.length+(m.errors.length===1?' subject.':' subjects.'))+'</p>':''}${actualBench()?'':`<button type="button" class="lnk" data-wbf-next-refresh ${m?.loading||nextBusy?'disabled':''}>Refresh moves</button>`}</div>`;
 }
 function loadMoves(d,force=false){
  const projects=nextProjects(),signature=JSON.stringify([projects.map(p=>[p.id,p.scopeProof,p.unavailable]),actualBench(),typeof window.studyBenchMoves?.read]);
  if(!force&&nextMoves?.dialog===d&&nextMoves.signature===signature)return;
  const serial=++nextSerial;nextMoves={dialog:d,signature,rows:[],errors:[],loading:true,message:''};
  if(!d.wbfNextCleanup){d.wbfNextCleanup=true;d.addEventListener('close',()=>{nextSerial++;nextMoves=null;});}
  if(actualBench()&&typeof window.studyBenchMoves?.read!=='function'){nextMoves.loading=false;nextMoves.errors.push({name:'Source and Research',message:'Current move readers are unavailable.'});return;}
  let at=0;
  void Promise.all(Array.from({length:Math.min(3,projects.length)},async()=>{
   while(at<projects.length&&nextLive(d,serial)){const p=projects[at++];try{
    if(p.unavailable)throw Error(p.unavailable);const result=await readMoves(p.id);if(!nextLive(d,serial))return;
    nextMoves.rows.push(...result.rows);if(result.unknown.length)nextMoves.errors.push({name:p.name,message:result.unknown.join(' ')});
   }catch(error){if(nextLive(d,serial))nextMoves.errors.push({name:p.name,message:error.message});}}
  })).then(()=>{if(!nextLive(d,serial))return;nextMoves.loading=false;nextMoves.rows.sort((a,b)=>(a.output?2:a.kind==='source'?0:1)-(b.output?2:b.kind==='source'?0:1)||(a.output&&b.output?['correction-needed','review-needed','in-progress','draft'].indexOf(a.output.status)-['correction-needed','review-needed','in-progress','draft'].indexOf(b.output.status):0)||nextKey(a).localeCompare(nextKey(b)));bench();});
 }
 async function openMove(key){
  const m=nextMoves,row=m?.rows.find(row=>nextKey(row)===key),d=m?.dialog;
  if(!row||nextBusy||!nextLive(d,nextSerial))return;
  const origin=current(),originStage=stage(),intent=++nextIntent,serial=nextSerial;
  const sameOrigin=()=>intent===nextIntent&&current()===origin&&stage()===originStage;
  const activeTarget=()=>nextProjects().some(p=>p.id===row.projectId&&!p.unavailable&&(!row.catalogScopeProof||p.scopeProof===row.catalogScopeProof));
  const exact=async()=>{const fresh=await readMoves(row.projectId);if(!fresh.rows.some(item=>nextKey(item)===key&&item.proof===row.proof))throw Error('This move changed. Refresh moves before opening it.');};
  nextBusy=true;bench();
  try{
   if(!row.output)window.studyBenchMoves?.assertCanLeave?.();
   await exact();if(!sameOrigin()||!nextLive(d,serial)||!activeTarget())throw Error('The selected work changed. Choose the move again.');
   await window.projectLibrary.close();if(d.open||document.getElementById('project-library')?.open)throw Error('Return from the open work before continuing.');
   if(!sameOrigin()||!activeTarget())throw Error('The selected work changed. Choose the move again.');
   if(!row.output){if(typeof window.studyBenchMoves?.prepareNavigation!=='function')throw Error('The exact Source or Research entrance is unavailable.');window.studyBenchMoves.prepareNavigation(row);}
   if(!row.output&&row.catalogNavigation&&!state.projects.some(p=>p.id===row.projectId&&!p.archived)){if(typeof window.existingWork?.openWorkspaceTarget!=='function')throw Error('The exact saved project entrance is unavailable.');const nav=row.catalogNavigation;await window.existingWork.openWorkspaceTarget(nav.workspaceId,nav.targetIndex,{stage:row.kind==='source'?2:3,storyId:nav.storyId});}
   else if(current().id!==row.projectId)await window.switchProject(row.projectId);
   if(intent!==nextIntent||current().id!==row.projectId||!activeTarget())throw Error('The selected project changed.');
   await exact();if(intent!==nextIntent||current().id!==row.projectId||!activeTarget())throw Error('The selected project changed.');
   if(row.output)await window.realOutputOverview.onAction({projectId:row.projectId,outputId:row.output.id,edition:row.output.edition??null,kind:row.output.nextAction.kind});
   else {if(typeof window.studyBenchMoves?.open!=='function')throw Error('The exact saved move entrance is unavailable.');const chosen=current(),chosenStage=stage();await window.studyBenchMoves.open(row,{originGuard:()=>{if(intent!==nextIntent||current()!==chosen||stage()!==chosenStage||!activeTarget())throw Error('The selected move changed.');}});}
  }catch(error){if(!row.output)window.studyBenchMoves?.cancelNavigation?.(row);if(intent===nextIntent){if(d.open&&nextMoves===m){m.message=error.message;bench();}else{const status=document.getElementById('wn-message');if(status&&[origin.id,row.projectId].includes(current().id)){status.textContent=error.message;status.hidden=false;}}}}
  finally{nextBusy=false;if(d.open)bench();}
 }
 window.addEventListener('study-carousel-view',()=>decorate());window.addEventListener('study-write-view',()=>decorate());
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
  const binding=window.studyDraft?.currentBinding?.(),recent=(window.arLive?.state?.().humanLines||[]).filter(r=>r.status==='committed'&&!['first-flow.select','study.photos.select','study.human-direction.select','study-draft.open'].includes(r.kind)&&(['project','piece'].includes(r.scope?.kind)&&r.scope.id===p.id||r.scope?.kind==='draft'&&r.scope.id===binding?.id)).slice(0,3);
  let folders=d.querySelector(':scope>.wbf-piece-nav');if(!folders){folders=document.createElement('aside');folders.className='wbf-piece-nav';folders.setAttribute('aria-label','Piece folders');d.append(folders);}
  const active=window.projectLibrary?.filterValue?.()||'active',groups=[['active','All pieces'],['pinned','Pinned'],['archive','Archived'],...[...new Set((state.projects||[]).map(p=>p.folder||'Projects'))].sort().map(f=>['folder:'+f,f])];
  setHTML(folders,`<div class="sph">Pieces</div><div class="spb">${groups.map(([value,label])=>`<button type="button" class="rk${active===value?' on':''}" data-wbf-project-filter="${esc(value)}" ${active===value?'aria-current="true"':''}><span class="lbl">${esc(label)}</span></button>`).join('')}</div>`);
  setHTML(section.querySelector('.wbf-bench-story'),`<div class="thead"><h1>Home</h1></div><section class="pickup" aria-label="Pick up where you left off"><div class="lab">Pick up here</div><h2>${esc(p.name)} <span class="sub">· ${esc(location?({3:'Research',4:'Direction',5:'Write',6:'Read',7:'Check',8:'Media',9:'Arrange',10:'Audience',11:'Share'}[location.item?.stage||location.stage]||'Current work'):'Current work')}</span></h2><div class="meta">${esc(st?.save?.text||'Your current piece')}</div>${resumeText?`<blockquote>${esc(resumeText)}</blockquote>`:''}<div class="acts"><button type="button" class="btn primary" data-wbf-resume>${homeLabel(resumeLabel)}</button><button type="button" class="lnk" data-wbf-recent>Recent changes</button></div><div class="since"><div class="lab">Recent saved activity</div>${recent.length?`<ul>${recent.map(r=>`<li><i></i><span>${esc(window.arLive?.label?.(r)||'Saved change')}<small>${esc(window.c3Shell?.actorName?.(r.actor)||'You')} · ${esc(new Date(r.ts).toLocaleString())}</small></span></li>`).join('')}</ul>`:'<p class="dim small">No saved activity is available here yet.</p>'}</div></section>${homeLists()}`);
  const inventory=section.querySelector('.wbf-active');let title=inventory.querySelector('.wbf-active-title');if(!title){title=document.createElement('div');title.className='wbf-active-title';inventory.prepend(title);}setHTML(title,`<h2 class="sec">Everything active <span class="sub">· ${(state.projects||[]).filter(p=>!p.archived).length}</span></h2><button type="button" class="lnk" data-wbf-new>New subject</button>`);
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
  document.body.classList.add('wbf-on');const home=document.getElementById('project-library'),mode=home?.open&&!home.dataset.plContext?homeMode:'';if(document.body.dataset.wbfHome!==mode)document.body.dataset.wbfHome=mode;const n=stage();if(tool==='proposals'&&!window.studyAIProposals?.isOpen?.())closeTool();if(n===7&&decoratedStage!==7){restore();tool='check';mounted=null;}if(![5,6,7].includes(n)&&!window.workspaceNavigation?.isCarouselCheck?.()&&tool==='check')closeTool();decoratedStage=n;header();documents();bench();
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
  const b=event.target.closest?.('[data-wbf-thread-state],[data-wbf-thread-open],[data-wbf-thread-add],[data-wbf-author-decision],[data-wbf-bench-editions],[data-wbf-home-more],[data-wbf-question],[data-wbf-wording-review],[data-wbf-bench-open],[data-wbf-bench-refresh],[data-wbf-bench-more],[data-wbf-size],[data-wbf-tool],[data-wbf-close],[data-wbf-thought],[data-wbf-pieces],[data-wbf-resume],[data-wbf-next],[data-wbf-next-refresh],[data-wbf-recent],[data-wbf-project-filter],[data-wbf-save],[data-wbf-mode],[data-wbf-carousel-view],[data-wbf-new],[data-wbf-make-output],.workflowNavigation [data-tr-home],[data-wbf-thread]');if(!b)return;
  if(b.hasAttribute('data-wbf-author-decision'))return openAuthorDecision(b.dataset.wbfAuthorDecision);
  if(b.hasAttribute('data-wbf-bench-editions')){benchEditionView=b.dataset.wbfBenchEditions==='earlier'?'earlier':'current';benchQuery='';benchLimit=30;bench();return;}
  if(b.hasAttribute('data-wbf-home-more')){benchMoreOpen=!benchMoreOpen;bench();return;}
  if(b.hasAttribute('data-wbf-question')){const match=(window.arLive?.waiting?.()||[]).find(row=>row.type==='question'&&row.line?.status==='needs-decision'&&JSON.stringify([row.line.scope?.kind,row.line.scope?.id,row.line.operationId,row.line.ts])===b.dataset.wbfQuestion);if(match)window.arLive.showAsk(match.line);else bench();return;}
  if(b.hasAttribute('data-wbf-wording-review'))return openWordingReview(b.dataset.wbfWordingReview);
  if(b.hasAttribute('data-wbf-bench-open'))return openBenchWork(b.dataset.wbfBenchOpen);
  if(b.hasAttribute('data-wbf-bench-refresh'))return void benchCatalog?.refresh?.();
  if(b.hasAttribute('data-wbf-bench-more')){benchLimit+=30;bench();return;}
  if(b.hasAttribute('data-wbf-thread-state')){benchEditionView='current';benchThreadState=b.dataset.wbfThreadState;benchThread='';benchLimit=30;bench();return;}
  if(b.hasAttribute('data-wbf-thread-open'))return openBenchWork(b.dataset.wbfThreadOpen);
  if(b.hasAttribute('data-wbf-thread-add'))return openBenchWork(b.dataset.wbfThreadAdd).then(()=>{if(!document.getElementById('project-library')?.open)return window.combinedNavigation?.go?.('outputs');});
  if(b.hasAttribute('data-wbf-thread')){benchThread=b.dataset.wbfThread;bench();return;}
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
  if(b.hasAttribute('data-wbf-resume')){const target=benchLocation(current().id);b.disabled=true;try{await window.projectLibrary.close();if(target)await window.workspaceNavigation?.resumeLast?.(target);else window.workspaceNavigation?.capture?.({pickup:true});}catch(error){const status=document.querySelector('#wn-message')||document.querySelector('#project-library [data-pl-status]');if(status){status.textContent=error.message||'The saved work could not open. Your current work is retained.';status.hidden=false;}}finally{if(b.isConnected)b.disabled=false;}return;}
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
 // Home keys: j and k move between threads, 1 to 5 pick one, Enter continues the chosen thread.
 document.addEventListener('keydown',event=>{const d=document.getElementById('project-library');if(!d?.open||d.dataset.plContext||!d.querySelector('.thread-list')||event.metaKey||event.ctrlKey||event.altKey||event.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]'))return;if(event.key==='/'){const find=d.querySelector('[data-wbf-bench-search]');if(find){event.preventDefault();find.focus();return;}}const rows=[...d.querySelectorAll('.thread-list [data-wbf-thread]')];if(!rows.length)return;const at=Math.max(0,rows.findIndex(r=>r.classList.contains('is-selected')));let next=null;if(event.key==='j')next=rows[Math.min(rows.length-1,at+1)];else if(event.key==='k')next=rows[Math.max(0,at-1)];else if(/^[1-5]$/.test(event.key))next=rows[Number(event.key)-1];else if(event.key==='Enter'){const go=d.querySelector('.wbf-bench-story .pickup .btn.primary');if(go&&!go.disabled){event.preventDefault();go.click();}return;}if(!next)return;event.preventDefault();benchThread=next.dataset.wbfThread;bench();});
 document.addEventListener('input',event=>{if(event.target.matches?.('[data-wbf-bench-search]')){benchQuery=event.target.value;benchLimit=30;bench();}});
 // What is waiting on Adrian, per step, for the rail's counts.
 const waitingCounts=()=>{const items=authorDecisionModel()?.items||[],out={home:items.length};for(const it of items)out[it.target.stage]=(out[it.target.stage]||0)+1;return out;};
 window.c3WorkbenchFrame={decorate,openTool,closeTool,setBenchCatalog,waitingCounts};
 window.addEventListener('c3-header-painted',header);
 window.c3Shell.register('full Workbench frame',()=>{decorate();watchHome();},{order:95,ignore:'#wbf-tools,#wbf-drawer,.wbf-top-actions,.wbf-bench'});
 document.addEventListener('toggle',event=>{if(event.target.id==='project-library')decorate();},true);
 for(const n of ['study-draft-change','study-output-selection','c3-piece-state'])window.addEventListener(n,decorate);
})();
