/* Read-only, supplied-record Research browser. Existing adapters own all saved work. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ArResearchPointBrowser=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const mounts=new WeakMap();
 const str=value=>typeof value==='string'?value:'';
 const arr=value=>Array.isArray(value)?value:[];
 const scope=value=>({projectId:str(value?.projectId),outputId:str(value?.outputId),revision:str(value?.revision)});
 const same=(a,b)=>!!a?.projectId&&!!a.revision&&a.projectId===b?.projectId&&a.outputId===b?.outputId&&a.revision===b?.revision;
 const safeURL=value=>{try{const url=new URL(str(value));return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?str(value):'';}catch{return '';}};
 const paragraphs=value=>str(value).split(/\n\s*\n/).filter(Boolean);
 const blocks=value=>arr(value).map(item=>typeof item==='string'?{title:'',text:item}:{title:str(item?.title),text:str(item?.text)}).filter(item=>item.title||item.text);
 function normalize(input){
  const context=scope(input?.scope),seen=new Set();
  const points=arr(input?.points).filter(point=>{const id=str(point?.id);if(!id.trim()||seen.has(id)||(point.scope&&!same(context,scope(point.scope))))return false;seen.add(id);return true;}).map(point=>{
   const ids=new Set();
   const sources=arr(point.sources).filter(source=>{const id=str(source?.id);if(!id||ids.has(id))return false;ids.add(id);return true;}).map(source=>({id:source.id,title:str(source.title)||'Source',url:safeURL(source.url),target:str(source.target),quality:str(source.quality),excerpt:str(source.excerpt)}));
   const supplied=point.evidence||{},requested=str(supplied.status),reason=str(supplied.reason),qualification=str(supplied.qualification),hasSource=sources.some(source=>source.target||source.url);
   let evidenceStatus=['usable','qualified','held'].includes(requested)?requested:'held';
   const limits=[];
   if(evidenceStatus!=='held'&&!hasSource){evidenceStatus='held';limits.push('No supporting source is supplied.');}
   if(evidenceStatus!=='held'&&!reason){evidenceStatus='held';limits.push('No evidence reason is supplied.');}
   if(evidenceStatus==='qualified'&&!qualification){evidenceStatus='held';limits.push('Exact limiting wording is missing.');}
   if(point.stale){evidenceStatus='held';limits.push('This point refers to an earlier source revision. Reload its current records before acting.');}
   const decision=!point.decision?.stale&&(!point.decision?.scope||same(context,scope(point.decision.scope)))?point.decision:null;
   return {id:point.id,title:str(point.title)||'Untitled point',kind:str(point.kind),stale:!!point.stale,canDecide:point.canDecide!==false,sources,
    quotes:arr(point.quotes).map(q=>({text:str(q?.text),speaker:str(q?.speaker),location:str(q?.location),sourceId:str(q?.sourceId)})).filter(q=>q.text),
    explanation:str(point.explanation),history:blocks(point.history),teachings:blocks(point.teachings),learning:blocks(point.learning),questions:arr(point.questions).map(str).filter(Boolean),
    evidence:{status:evidenceStatus,recordedStatus:requested,reason,qualification,recordedAt:str(supplied.recordedAt),limits},
    decision:{value:str(decision?.value),reason:str(decision?.reason),recordedAt:str(decision?.recordedAt)},
    speakerIssues:arr(point.speakerIssues).map(i=>({id:str(i?.id),original:str(i?.original),proposed:str(i?.proposed),reason:str(i?.reason),decision:str(i?.decision)})),
    discussions:arr(point.discussions).map(d=>({author:str(d?.author),text:str(d?.text),date:str(d?.date),status:str(d?.status)})).filter(d=>d.text),
    related:arr(point.related).map(r=>({pointId:str(r?.pointId),label:str(r?.label)})).filter(r=>r.pointId)
   };
  });
  const rawBrief=input?.brief,briefScope=scope(rawBrief?.scope);
  const briefMatches=same(context,{...briefScope,outputId:context.outputId})&&[context.outputId,'shared'].includes(briefScope.outputId);
  const brief=rawBrief&&briefMatches?{
   revision:str(rawBrief.revision),updatedAt:str(rawBrief.updatedAt),status:str(rawBrief.status),content:str(rawBrief.content),
   sections:blocks(rawBrief.sections),updates:arr(rawBrief.updates).map(u=>({date:str(u?.date),text:str(u?.text)})).filter(u=>u.text)
  }:null;
  return {scope:context,title:str(input?.title)||'Research',outputTitle:str(input?.outputTitle)||'Project learning',points,brief,valid:same(context,context),showContext:input?.showContext!==false};
 }
 const tools={
  question:{label:'Your questions & comments',purpose:'Save your exact wording in shared project notes. No AI answer is requested.',field:'Your question or comment'},
  discuss:{label:'Discuss this point',purpose:'Ask about this point using its exact source words, evidence limits and supplied learning.',field:'Your question'},
  atlas:{label:'Look up in Tea Atlas',purpose:'Find relevant Atlas entries for this point. A connected adapter must confirm access and return attributable sources for review.',field:'Term or question'},
  speaker:{label:'Review speaker wording',purpose:'Review original wording, proposed handling and the reason. Include / Leave out is a separate decision.',field:'Your wording or review note'},
  brief:{label:'Update shared brief',purpose:'Review how supplied research or a reply changes the shared brief before any update is accepted.',field:'What should change?'}
 };
 function mount(host,input,callbacks={}){
  if(!host?.ownerDocument)throw new TypeError('A DOM host is required.');
  mounts.get(host)?.destroy();
  const doc=host.ownerDocument;
  let data=normalize(input),handlers=callbacks||{},selected=data.points[0]?.id||'',tab='points',tool='',message='',busy=false,dead=false,epoch=0;
  const drafts=new Map();let discussionMount=null;
  function closeDiscussion(){discussionMount?.destroy?.();discussionMount=null;}
  function el(tag,text,cls){const node=doc.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(cls)node.className=cls;return node;}
  function button(label,key,value,disabled=false){const node=el('button',label);node.type='button';node.dataset[key]=value;node.disabled=disabled;return node;}
  function prose(parent,text){for(const paragraph of paragraphs(text))parent.append(el('p',paragraph));}
  function section(parent,title,items){if(!items.length)return;const node=el('section',null,'rpb-prose');node.append(el('h3',title));for(const item of items){if(item.title)node.append(el('h4',item.title));prose(node,item.text);}parent.append(node);}
  function current(){return data.points.find(point=>point.id===selected);}
  function captureInput(){const input=host.querySelector('[data-rpb-input]');if(input&&tool)drafts.set((tab==='brief'?'brief':selected)+':'+tool,input.value);const issue=host.querySelector('[data-rpb-issue]'),handling=host.querySelector('[data-rpb-handling]');if(issue&&handling)drafts.set(selected+':speaker-choice',{issueId:issue.value,handling:handling.value});}
  function actionHandler(id){return typeof handlers.actions?.[id]==='function'?handlers.actions[id]:typeof handlers.onAction==='function'&&arr(handlers.connectedActions).includes(id)?handlers.onAction:null;}
  function canAct(point){return data.valid&&!busy&&(!point||!point.stale);}
  function sourceRows(parent,point){
   const details=el('section',null,'rpb-sources');details.append(el('h3','Sources · '+point.sources.length));
   if(!point.sources.length)details.append(el('p','No supporting source is supplied.'));
   for(const source of point.sources){const row=el('section');row.append(el('h4',source.title));if(source.quality)row.append(el('p',source.quality,'rpb-meta'));if(source.excerpt)row.append(el('blockquote',source.excerpt));
    if(source.url){const link=el('a','Open supplied reference');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}
    if(source.target||source.url)row.append(button('Show source','rpbSource',source.id,!canAct(point)));else row.append(el('p','No source location is connected.','rpb-meta'));details.append(row);
   }parent.append(details);
  }
  function toolPanel(parent,point){
   if(!tool)return;const config=tools[tool],panel=el('section',null,'rpb-tool-panel');panel.dataset.rpbToolPanel='';panel.append(el('h3',config.label),el('p',config.purpose));
   panel.append(el('p',data.title+' · '+data.outputTitle+(point?' · '+point.title:''),'rpb-meta'));
   if(tool==='speaker'){
    if(!point?.speakerIssues.length)panel.append(el('p','No speaker review has been supplied for this point.'));
    for(const issue of point?.speakerIssues||[]){const item=el('section',null,'rpb-prose');if(issue.original)item.append(el('blockquote',issue.original));if(issue.proposed){item.append(el('h4','Proposed handling'));prose(item,issue.proposed);}if(issue.reason)prose(item,issue.reason);if(issue.decision)item.append(el('p','Recorded choice: '+issue.decision,'rpb-meta'));panel.append(item);}
    const issues=(point?.speakerIssues||[]).filter((issue,index,all)=>issue.id&&all.findIndex(i=>i.id===issue.id)===index),choice=drafts.get(selected+':speaker-choice');
    if(issues.length){const fields=el('div',null,'rpb-actions'),issueLabel=el('label','Speaker issue'),issueSelect=el('select');issueSelect.dataset.rpbIssue='';for(const issue of issues){const option=el('option',issue.original||issue.reason||'Supplied speaker issue');option.value=issue.id;issueSelect.append(option);}if(choice&&issues.some(i=>i.id===choice.issueId))issueSelect.value=choice.issueId;issueLabel.append(issueSelect);fields.append(issueLabel);
     const handlingLabel=el('label','Handling to review'),handling=el('select');handling.dataset.rpbHandling='';for(const [id,title] of [['suggested','Suggested'],['as-said','As said'],['cut','Cut'],['my-words','My words']]){const option=el('option',title);option.value=id;handling.append(option);}if(choice)handling.value=choice.handling;handlingLabel.append(handling);fields.append(handlingLabel);panel.append(fields);}
   }
   if(tool==='discuss'){
    for(const turn of point?.discussions||[]){const item=el('section',null,'rpb-prose');item.append(el('p',[turn.author,turn.date,turn.status].filter(Boolean).join(' · '),'rpb-meta'));prose(item,turn.text);panel.append(item);}
   }
   const questionState=tool==='question'&&typeof handlers.questions==='function'?handlers.questions(payload(point)):null;
   if(tool==='question')for(const entry of questionState?.entries||[]){const item=el('section',null,'rpb-prose');item.dataset.savedQuestion='';item.append(el('p',[entry.author==='human:adrian'?'Adrian':'Human note',Number.isFinite(Date.parse(entry.createdAt))?new Date(entry.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'',entry.stale?'Earlier source revision':'Saved'].filter(Boolean).join(' · '),'rpb-meta'));prose(item,entry.text);const origin=el('section');origin.append(el('h3','Retained origin · not independently verified'),el('p',entry.origin?.recordPath||''),el('p','SHA-256 '+(entry.origin?.recordHash||'')),el('blockquote',entry.origin?.originalText||''));item.append(origin);panel.append(item);}
   const nativeDiscussion=tool==='discuss'&&typeof handlers.mountDiscussion==='function';
   const connected=nativeDiscussion||!!actionHandler(tool),connection=el('p',tool==='question'?(questionState?.available?'Questions save to shared project notes; human wording, not an AI reply.':questionState?.reason||'Shared project notes are unavailable. Your question remains here.'):(connected?'Connected action · its result must be reviewed before use.':config.label+' is not connected. This input stays in this view; no research or update is run.'),'rpb-meta');panel.append(connection);
   const label=el('label',config.field),input=el('textarea');input.rows=3;input.dataset.rpbInput='';input.value=drafts.get((point?.id||'brief')+':'+tool)||'';label.append(input);panel.append(label);
   if(nativeDiscussion){parent.append(panel);try{discussionMount=handlers.mountDiscussion(panel,payload(point),input);}catch(error){connection.textContent='Discussion is unavailable. '+(str(error?.message)||'Reopen the current research point.');}panel.append(button('Close','rpbClose',''));return;}
   panel.append(button(tool==='question'?'Save question':connected?'Send for review':config.label+' · not connected','rpbSubmit',tool,!connected||tool==='question'&&!questionState?.available||!canAct(point)||(tool==='speaker'&&!point?.speakerIssues.some(i=>i.id))),button('Close','rpbClose',''));parent.append(panel);
  }
  function renderPoint(parent){
   const point=current();if(!point){parent.append(el('p','No research points are connected in this view. Existing research may be available through the current record owner.'));return;}
   const article=el('article');article.dataset.rpbDetail='';article.append(el('h2',point.title));if(point.kind)article.append(el('p',point.kind,'rpb-meta'));
   if(data.showContext){for(const quote of point.quotes){article.append(el('blockquote',quote.text));article.append(el('p',[quote.speaker||'Speaker not recorded',quote.location].filter(Boolean).join(' · '),'rpb-meta'));}}
   const evidence=el('section',null,'rpb-evidence');evidence.dataset.rpbEvidence='';evidence.dataset.state=point.evidence.status;
   const label={usable:'Supported · recorded usable',qualified:'Uncertain · recorded qualified',held:'Uncertain · Held'}[point.evidence.status];evidence.append(el('strong','Recorded evidence · '+label));
   prose(evidence,point.evidence.reason||'No evidence reason is recorded.');if(point.evidence.qualification){evidence.append(el('span','Exact limiting wording','rpb-meta'),el('p',point.evidence.qualification));}for(const limit of point.evidence.limits)evidence.append(el('p',limit));if(point.evidence.recordedAt)evidence.append(el('p',point.evidence.recordedAt,'rpb-meta'));article.append(evidence);
   if(point.explanation){const learning=el('section',null,'rpb-prose');learning.append(el('h3','Understanding this point'));prose(learning,point.explanation);article.append(learning);}
   section(article,'History & context',point.history);section(article,'Teaching connections',point.teachings);section(article,'Learning to carry forward',point.learning);
   if(point.questions.length){const questions=el('section',null,'rpb-prose');questions.append(el('h3','Next questions'));const list=el('ul');point.questions.forEach(q=>list.append(el('li',q)));questions.append(list);article.append(questions);}
   if(!point.explanation&&!point.history.length&&!point.teachings.length&&!point.learning.length&&!point.questions.length)article.append(el('p','No deeper learning is supplied for this point. Develop it through the existing research tools when connected.'));
   sourceRows(article,point);
   const choices=el('div',null,'rpb-actions');choices.append(button('Include','rpbDecision','include',!canAct(point)||!point.canDecide||typeof handlers.onDecision!=='function'),button('Leave out','rpbDecision','leave-out',!canAct(point)||!point.canDecide||typeof handlers.onDecision!=='function'));
   if(point.decision.value)article.append(el('p',({include:'Included','leave-out':'Left out'}[point.decision.value]||'Recorded choice: '+point.decision.value)+(point.decision.reason?' · '+point.decision.reason:''),'rpb-meta'));
   if(typeof handlers.onDecision!=='function')article.append(el('p','Saving Include / Leave out is not connected here.','rpb-meta'));
   article.append(choices);const actions=el('div',null,'rpb-actions');for(const id of ['question','discuss','atlas','speaker'])actions.append(button(tools[id].label,'rpbTool',id,!canAct(point)));article.append(actions);toolPanel(article,point);
   const related=point.related.filter(r=>data.points.some(p=>p.id===r.pointId));if(related.length){const links=el('div',null,'rpb-actions');links.append(el('span','Related points','rpb-meta'));for(const relation of related)links.append(button(relation.label||data.points.find(p=>p.id===relation.pointId).title,'rpbRelated',relation.pointId));article.append(links);}parent.append(article);
  }
  function renderBrief(parent){
   const article=el('article',null,'rpb-prose');article.append(el('h2','Shared story brief'));
   const brief=data.brief;if(brief){article.append(el('p',[brief.status||'Supplied shared record',brief.updatedAt].filter(Boolean).join(' · '),'rpb-meta'));if(brief.content)prose(article,brief.content);for(const item of brief.sections){const section=el('section');section.dataset.rpbBriefSection='';if(item.title)section.append(el('h3',item.title));prose(section,item.text);article.append(section);}if(!brief.content&&!brief.sections.length)article.append(el('p','The brief is listed, but its words are unavailable.'));
    if(brief.updates.length){const history=el('section');history.append(el('h3','Dated updates'));for(const update of brief.updates){history.append(el('p',update.date,'rpb-meta'));prose(history,update.text);}article.append(history);}
   }else article.append(el('p','No shared brief is connected in this view. Open the existing brief through its owner, or prepare it when that action is connected.'));
   const actions=el('div',null,'rpb-actions');actions.append(button('Update shared brief','rpbTool','brief',!canAct()),button('Continue to Direction','rpbDirection','',!canAct()||typeof handlers.onDirection!=='function'));article.append(actions);
   article.append(el('p','Direction uses the selected sources, shared brief and human choices. Existing output wording changes only through its own review.','rpb-meta'));if(typeof handlers.onDirection!=='function')article.append(el('p','Opening Direction from this panel is not connected.','rpb-meta'));toolPanel(article,null);parent.append(article);
  }
  function render(focusPoint){
   closeDiscussion();
   if(dead)return;const root=el('section',null,'rpb');root.setAttribute('aria-label','Research points and shared brief');
   const header=el('header',null,'rpb-heading');header.append(el('p',data.title+' · '+data.outputTitle,'rpb-meta'));
   const tabs=el('nav',null,'rpb-actions');tabs.setAttribute('aria-label','Research view');for(const [id,label] of [['points','Research points'],['brief','Shared brief']]){const b=button(label,'rpbTab',id);b.setAttribute('aria-pressed',String(tab===id));tabs.append(b);}header.append(tabs);root.append(header);
   if(!data.valid)root.append(el('p','Current project and source revision are required before actions can connect.','rpb-meta'));
   const body=el('div',null,tab==='points'?'rpb-layout':'rpb-brief');if(tab==='points'){
    const index=el('nav',null,'rpb-index');index.setAttribute('aria-label','Research points');data.points.forEach(point=>{const b=button(point.title,'rpbPoint',point.id);b.setAttribute('aria-current',String(point.id===selected));b.tabIndex=point.id===selected?0:-1;index.append(b);});body.append(index);const detail=el('div',null,'rpb-detail');renderPoint(detail);body.append(detail);
   }else renderBrief(body);root.append(body);
   const status=el('p',message,'rpb-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);host.replaceChildren(root);
   if(focusPoint)[...host.querySelectorAll('[data-rpb-point]')].find(b=>b.dataset.rpbPoint===focusPoint)?.focus();
  }
  function payload(point){return {scope:{...data.scope},pointId:point?.id||null,briefRevision:data.brief?.revision||null};}
  async function dispatch(callback,request,point){
   if(dead||!canAct(point))return;const version=epoch;busy=true;message='Request in progress…';render();
   try{const result=await callback(request);if(dead||version!==epoch)return;captureInput();if(request.action==='question'&&result?.entry&&drafts.get(selected+':question')===request.input)drafts.delete(selected+':question');message=typeof result?.message==='string'?result.message:'Request returned. Refresh the supplied records to see any accepted changes.';}
   catch(error){if(dead||version!==epoch)return;captureInput();message='The action could not finish. '+(str(error?.message)||'Try again through the existing owner.');}
   finally{if(!dead&&version===epoch){busy=false;render();}}
  }
  function select(id,focus){if(!data.points.some(point=>point.id===id))return;captureInput();epoch++;busy=false;selected=id;tool='';message='';render(focus?id:null);if(typeof handlers.onSelect==='function'){const version=epoch;try{Promise.resolve(handlers.onSelect(payload(current()))).catch(error=>{if(dead||version!==epoch)return;message='The selected point could not be opened. '+str(error?.message);render(focus?id:null);});}catch(error){message='The selected point could not be opened. '+str(error?.message);render(focus?id:null);}}}
  function onClick(event){
   const control=event.target.closest?.('button');if(!control||!host.contains(control)||control.disabled||dead)return;captureInput();const attrs=control.dataset,point=current();
   if('rpbPoint'in attrs)return select(attrs.rpbPoint,true);
   if('rpbRelated'in attrs)return select(attrs.rpbRelated,true);
   if('rpbTab'in attrs){epoch++;busy=false;tab=attrs.rpbTab;tool='';message='';render();return;}
   if('rpbTool'in attrs){tool=attrs.rpbTool;message='';render();host.querySelector('[data-rpb-input]')?.focus();return;}
   if('rpbClose'in attrs){tool='';render();return;}
   if('rpbSource'in attrs){const source=point?.sources.find(s=>s.id===attrs.rpbSource);if(!source||!canAct(point))return;if(typeof handlers.onOpenSource==='function')return dispatch(handlers.onOpenSource,{...payload(point),source:{...source}},point);message='Opening this source is not connected. Its supplied reference remains available above.';render();return;}
   if('rpbDecision'in attrs&&point.canDecide&&typeof handlers.onDecision==='function')return dispatch(handlers.onDecision,{...payload(point),decision:attrs.rpbDecision},point);
   if('rpbSubmit'in attrs&&actionHandler(tool)){const text=host.querySelector('[data-rpb-input]')?.value||'';drafts.set((tab==='brief'?'brief':selected)+':'+tool,text);return dispatch(actionHandler(tool),{...payload(tab==='brief'?null:point),action:tool,input:text,...(tool==='speaker'?{issueId:host.querySelector('[data-rpb-issue]')?.value||'',handling:host.querySelector('[data-rpb-handling]')?.value||''}:{})},tab==='brief'?null:point);}
   if('rpbDirection'in attrs&&typeof handlers.onDirection==='function')return dispatch(handlers.onDirection,payload(null),null);
  }
  function onKey(event){const b=event.target.closest?.('[data-rpb-point]');if(!b||!host.contains(b))return;const index=data.points.findIndex(p=>p.id===b.dataset.rpbPoint);let next=index;if(event.key==='ArrowDown')next=(index+1)%data.points.length;else if(event.key==='ArrowUp')next=(index-1+data.points.length)%data.points.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=data.points.length-1;else return;event.preventDefault();select(data.points[next].id,true);}
  host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);
  const instance={
   update(next,nextCallbacks){if(dead)return;const oldScope=data.scope;captureInput();epoch++;busy=false;data=normalize(next);if(nextCallbacks!==undefined)handlers=nextCallbacks||{};if(!same(oldScope,data.scope)){drafts.clear();selected=data.points[0]?.id||'';tool='';}if(!data.points.some(p=>p.id===selected))selected=data.points[0]?.id||'';message='';render();},
   refresh(){if(dead)return;const input=host.querySelector('[data-rpb-input]'),active=doc.activeElement===input&&input?{start:input.selectionStart,end:input.selectionEnd}:null;captureInput();render();if(active){const next=host.querySelector('[data-rpb-input]');next?.focus();next?.setSelectionRange(active.start,active.end);}},
   select:id=>{if(!dead)select(id,false);},
   getSelection:()=>selected,
   getViewState:()=>{captureInput();return {scope:{...data.scope},selected,tab,tool,drafts:[...drafts]};},
   restoreViewState(value){if(dead||!same(data.scope,scope(value?.scope))||!data.points.some(p=>p.id===value.selected))return false;selected=value.selected;tab=value.tab==='brief'?'brief':'points';tool=Object.hasOwn(tools,value.tool)?value.tool:'';drafts.clear();for(const entry of arr(value.drafts))if(Array.isArray(entry)&&typeof entry[0]==='string'&&(typeof entry[1]==='string'||entry[1]&&typeof entry[1]==='object'))drafts.set(entry[0],entry[1]);render();return true;},
   destroy(){closeDiscussion();if(dead)return;dead=true;epoch++;drafts.clear();host.removeEventListener('click',onClick);host.removeEventListener('keydown',onKey);if(mounts.get(host)===instance){mounts.delete(host);host.replaceChildren();}}
  };mounts.set(host,instance);render();return instance;
 }
 return {mount,normalize};
});
