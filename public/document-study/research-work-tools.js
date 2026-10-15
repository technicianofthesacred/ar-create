/* Expose the existing Magazine research responsibilities beside their findings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ArResearchWorkTools=api;})(typeof window!=='undefined'?window:null,function(){
 const tools=[['learning','Learn more','History, terms, teachings and useful next questions.'],['evidence','Review evidence','Separate usable, qualified and held claims; inspect the exact supporting sources.'],['speaker','Review speaker wording','Compare suggested wording with what was said, without silently correcting a quotation.']];
 function install({document:doc,getProject,getRecords=()=>null,getResearch=()=>null}){
  let browser=null;
 function make(tag,text,cls){const el=doc.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
  function openDepth(point,panel,p){
   const api=doc.defaultView?.ArResearchPointBrowser,snapshot=getResearch(p);if(!api||!snapshot||!snapshot.points.some(n=>n.id===point.dataset.researchPoint))return false;
   browser?.destroy();browser=null;panel.replaceChildren();
   const points=snapshot.points.map(n=>({id:n.id,title:n.title,kind:n.kind,stale:n.stale,quotes:(n.spoken||[]).map(q=>({text:q.quote,speaker:q.speaker,location:q.location})),explanation:n.explanation||n.clarity?.recordedStatement||n.clarity?.supported||n.clarity?.rawNote||'',history:n.history||[],teachings:n.teachings||[],learning:n.learning||[],questions:n.questions||[],discussions:n.discussions||[],speakerIssues:n.speakerIssues||[],related:n.related||[],evidence:n.evidence||{status:'held',reason:n.clarity?.evidenceNeeded||n.clarity?.uncertain||'No independent evidence assessment is attached to this retained point.'},sources:(n.sources||[]).filter(s=>s.id||s.recordPath||s.path).map(s=>({id:s.id||s.recordPath||s.path,title:s.name||s.title||'Recorded source',target:s.recordPath||s.path||s.id,quality:s.quality||'',excerpt:s.excerpt||''}))}));
   const brief=snapshot.records.find(r=>/^BRIEF\b/i.test(r.name||r.path?.split('/').pop()||''));
   const model={scope:snapshot.scope,title:'Develop research',outputTitle:snapshot.outputTitle,showContext:false,points,brief:brief?{scope:{...snapshot.scope,outputId:'shared'},revision:brief.hash||'',status:'Existing shared record · no new verification',updatedAt:brief.modifiedAt||brief.date||'',content:brief.raw||brief.text||''}:null};
   const matching=request=>{const now=getProject(),latest=getResearch(now);if(now?.id!==p.id||now.viewedStage!==3||!latest||JSON.stringify(latest.scope)!==JSON.stringify(request.scope))throw Error('The research context changed. Reopen this point.');const row=[...doc.querySelectorAll('[data-research-point]')].find(n=>n.dataset.researchPoint===request.pointId);if(!row)throw Error('This research point is no longer in the current view.');return {row,latest};};
   let initial=true;
   browser=api.mount(panel,model,{onSelect:request=>{const {row}=matching(request);doc.querySelectorAll('[data-research-point-active]').forEach(n=>n.removeAttribute('data-research-point-active'));row.dataset.researchPointActive='true';if(!initial)row.scrollIntoView?.({block:'start'});},onOpenSource:request=>{const {row,latest}=matching(request),actual=latest.points.find(n=>n.id===request.pointId);if(!(actual?.sources||[]).some(s=>(s.id||s.recordPath||s.path)===request.source.id))throw Error('This source is not attached to the current point.');const details=row.querySelector('[data-research-source-point]');if(!details)throw Error('The existing source reader is unavailable.');details.open=true;details.scrollIntoView?.({block:'center'});return {message:'Opened the existing context and sources for this point.'};}});
   browser.select(point.dataset.researchPoint);initial=false;
   const back=make('button','Use existing point & plan controls');back.type='button';back.onclick=()=>{point.scrollIntoView?.({block:'start'});point.querySelector('[data-research-source-point]')?.setAttribute('open','');};panel.append(back);
   return true;
  }
  function decorate(){
   const p=getProject();if(p?.viewedStage!==3){browser?.destroy();browser=null;return;}
   const host=doc.querySelector('.research-standard');if(!host)return;
   host.querySelectorAll('[data-research-point]').forEach(point=>{
    if(point.querySelector('.research-work-tools'))return;
    const controls=point.querySelector('.research-standard-controls');if(!controls)return;
    const depth=!!doc.defaultView?.ArResearchPointBrowser,details=make('details',null,'research-work-tools'),summary=make('summary',depth?'Explore this point':'Develop this point');details.append(summary);if(depth)summary.dataset.researchWorkTool='depth';
    const actions=make('div',null,'research-work-actions'),panel=make('div',null,'research-work-panel');panel.setAttribute('role','status');
    (depth?[]:tools).forEach(([id,label,purpose])=>{const button=make('button',label);button.type='button';button.dataset.researchWorkTool=id;button.onclick=()=>{
     if(openDepth(point,panel,p))return;
     actions.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));panel.replaceChildren(make('strong',label),make('p',purpose));
     const origin=point.querySelector('[data-research-quote]');if(origin){panel.append(make('blockquote',origin.textContent),make('small','Source words shown above; attribution remains with this finding.'));}
     panel.append(make('p',id==='depth'?'The current research projection is unavailable. Existing findings and sources above remain readable.':id==='learning'?'New explanations and teaching traces are not connected here yet. Existing findings above are retained work, not a fresh research run.':id==='evidence'?'External verification and Tea Atlas lookup are not connected here yet. Use Context & sources to inspect the evidence already attached.':'The Suggested / As said / Cut / My words review is not connected here yet. Existing source quotations remain unchanged.'));
     const context=point.querySelector('[data-research-source-point]');if(context){const open=make('button','Show existing sources');open.type='button';open.onclick=()=>{context.open=true;context.scrollIntoView?.({block:'center'})};panel.append(open);}
    };actions.append(button);});if(depth){details.append(panel);details.addEventListener('toggle',()=>{if(details.open&&!panel.querySelector('.rpb')){if(!openDepth(point,panel,p))panel.textContent='The current research projection is unavailable. Existing findings and sources remain readable.';}});}else details.append(actions,panel);controls.append(details);
   });
   const heading=host.querySelector('.research-standard-heading');if(heading&&!host.querySelector('[data-research-brief]')){
    const details=make('details',null,'research-work-brief');details.dataset.researchBrief='true';details.append(make('summary','Story brief'));
    const records=getRecords(p),fresh=getResearch(p)?.records,brief=(fresh?.length?fresh:records?.stages?.['3']||[]).filter(r=>/^BRIEF\b/i.test(r.name||r.path?.split('/').pop()||''));
    if(brief.length){details.append(make('p','Existing shared brief · retained record, not newly verified'));brief.forEach(r=>{const body=make('div',r.raw||r.text||'The brief is listed, but its words are unavailable in this view.','research-work-brief-prose');details.append(make('h2',r.name||'Shared story brief'),body);});}
    else details.append(make('p','No shared brief is connected in this view. Preparing or updating it through AI is not connected yet.'));
    const scope=make('details');scope.append(make('summary','What the brief carries forward'),make('p','Central line, meaningful moments, exact usable quotations, qualified additions, teaching points, held items and their reasons, and the sources used. One shared brief can support an article and a carousel, with separate writing plans.'));details.append(scope);heading.after(details);
   }
  }
  let pending=false;
  const observer=doc.defaultView?.MutationObserver?new doc.defaultView.MutationObserver(()=>{if(pending)return;pending=true;Promise.resolve().then(()=>{pending=false;decorate()})}):null;
  observer?.observe(doc.getElementById('app')||doc.body,{childList:true,subtree:true});
  return {decorate,disconnect:()=>{observer?.disconnect();browser?.destroy();browser=null}};
 }
 if(typeof document!=='undefined'&&typeof current==='function'){
  const adapter=install({document,getProject:()=>current(),getRecords:p=>typeof WORKFLOW_RECORDS==='object'?WORKFLOW_RECORDS[p.id]:null,getResearch:p=>window.ResearchStandard?.snapshot?.(p?.id)});const prior=render;render=function(){const result=prior.apply(this,arguments);adapter.decorate();return result};adapter.decorate();
 }
 return {install};
});
