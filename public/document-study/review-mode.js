/* Actual-work review keeps old demo/browser recovery intact in a separate cache namespace.
   This is a view cache only; the existing authority remains the only saved manuscript owner. */
(()=>{
 if(!window.AR_CREATE_REVIEW_MODE?.actualWork)return;
 // Mount owners normally, but do not expose a cached piece while an exact URL is resolving.
 const routeKeys=['reviewSource','reviewStory','reviewStage','reviewArtifact','reviewHash','reviewWorkspace','reviewBinding','reviewOutput','reviewCarousel','reviewMagazineStory','reviewMagazinePiece','reviewMagazineParent'];
 if(window.location&&document.body&&routeKeys.some(key=>new URLSearchParams(window.location.search).has(key))){
  const requestedURL=window.location.href,root=document.documentElement,held=new Map(),status=document.createElement('section'),style=document.createElement('style');
  root.setAttribute('data-review-startup-pending','');
  style.textContent='html[data-review-startup-pending] body>:not([data-review-startup]),html[data-review-startup-pending] body>:not([data-review-startup]) *{visibility:hidden!important;pointer-events:none!important}';
  document.head.append(style);status.dataset.reviewStartup='';status.setAttribute('role','status');status.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;align-content:center;justify-content:center;gap:16px;padding:24px;background:var(--bg,#181816);color:var(--ink,#f1efe8);font:16px/1.5 system-ui';
  status.textContent='Opening saved work…';document.body.append(status);
  const hold=()=>{if(!window.document?.body)return;for(const node of document.body.children)if(node!==status&&!held.has(node)){held.set(node,{inert:node.hasAttribute('inert'),hidden:node.getAttribute('aria-hidden')});node.setAttribute('inert','');node.setAttribute('aria-hidden','true');}};
  hold();const observer=new MutationObserver(hold);observer.observe(document.body,{childList:true});
  let settleReady;const readiness=new Promise(resolve=>{settleReady=resolve;});
  window.arCreateReviewStartup={pending:true,requestedURL,whenReady(){return this.pending?readiness:Promise.resolve({ready:true});},phase(step){const labels={'resolve-route':'Finding this exact saved work…',catalog:'Finding your saved work…','read-transcript':'Reading the exact saved transcript…','select-transcript':'Selecting the verified transcript…','confirm-transcript':'Confirming the selected transcript…','flush-current':'Checking your current writing…','close-library':'Keeping your current work safe…','switch-project':'Opening the selected project…','open-binding':'Opening your saved draft…','clear-output':'Selecting the working manuscript…','open-section':'Opening the writing surface…','open-check':'Opening the review tools…'};if(!this.pending||status.getAttribute('role')==='alert'||!Object.hasOwn(labels,step))return;status.dataset.reviewOpeningStep=step;status.textContent=labels[step];},complete(){if(!this.pending)return;this.pending=false;settleReady({ready:true});observer.disconnect();root.removeAttribute('data-review-startup-pending');style.remove();status.remove();for(const[node,before]of held){if(!before.inert)node.removeAttribute('inert');if(before.hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',before.hidden);}},fail(message,diagnostic){if(!this.pending)return;if(diagnostic&&/^(catalog|resolve-route|switch-project|open-binding|read-transcript|flush-current|close-library|open-section|select-transcript|confirm-transcript)$/.test(diagnostic.stage||'')){status.dataset.reviewFailureStage=diagnostic.stage;if(['startup-writing-dirty','startup-context-changed','catalog-read-timeout','catalog-read-failed','catalog-http-refused','catalog-response-invalid','source-read-timeout','source-read-failed','source-context-replaced','source-project-changed','source-navigation-superseded','source-url-changed','source-identity-invalid'].includes(diagnostic.reason))status.dataset.reviewFailureReason=diagnostic.reason;if(/^[A-Za-z]{1,40}$/.test(diagnostic.errorName||''))status.dataset.reviewFailureType=diagnostic.errorName;if(Number.isInteger(diagnostic.elapsedMs)&&diagnostic.elapsedMs>=0&&diagnostic.elapsedMs<=600000)status.dataset.reviewFailureElapsedMs=String(diagnostic.elapsedMs);if(Number.isInteger(diagnostic.status)&&diagnostic.status>=100&&diagnostic.status<=599)status.dataset.reviewFailureStatus=String(diagnostic.status);if(/^[A-Za-z0-9:_-]{1,120}$/.test(diagnostic.projectId||''))status.dataset.reviewFailureProject=diagnostic.projectId;if(/^(magazine|carousel-words)$/.test(diagnostic.ownerKind||''))status.dataset.reviewFailureOwner=diagnostic.ownerKind;for(const key of ['writerMounted','proofReadable','proofPresent','dirty','bindingPresent'])if(typeof diagnostic[key]==='boolean')status.dataset['reviewFailure'+key[0].toUpperCase()+key.slice(1)]=String(diagnostic[key]);}settleReady({ready:false,error:message||'This saved work could not open. Retry when it is available.'});status.setAttribute('role','alert');status.replaceChildren();const text=document.createElement('p'),retry=document.createElement('a');text.textContent=message||'This saved work could not open. Retry when it is available.';retry.textContent='Retry';retry.href=requestedURL;retry.style.color='inherit';const workspace=document.createElement('a');workspace.textContent='Open workspace';const workspaceURL=new URL(requestedURL);workspaceURL.search='';workspaceURL.hash='';workspace.href=workspaceURL.href;workspace.style.color='inherit';status.append(text,retry,workspace);}};
 }
 const prefix='ar-existing-work-review-v1:';
 try{
  const owner=window.localStorage;
  const names=()=>Array.from({length:owner.length},(_,i)=>owner.key(i)).filter(k=>k?.startsWith(prefix));
  const scoped={get length(){return names().length;},key:i=>names()[i]?.slice(prefix.length)??null,getItem:k=>owner.getItem(prefix+String(k)),setItem:(k,v)=>owner.setItem(prefix+String(k),String(v)),removeItem:k=>owner.removeItem(prefix+String(k)),clear:()=>names().forEach(k=>owner.removeItem(k))};
  Object.defineProperty(window,'localStorage',{configurable:true,value:scoped});
  window.AR_CREATE_REVIEW_MODE.cacheNamespace=prefix;
 }catch{window.AR_CREATE_REVIEW_MODE.cacheUnavailable=true;}
 const writableDraft=()=>{if(!window.document?.querySelector('#workspace #manuscript'))return false;try{const p=typeof current==='function'?current():null,proof=window.studyDraft?.currentProof?.();if(Number(p?.viewedStage)!==5||proof?.parentStudyId!==p.id)return false;if(proof?.owner?.kind==='magazine'){const owner=window.studyDraft?.currentOwner?.(),hash=proof.expected?.workflow?.draft;return window.AR_CREATE_REVIEW_MODE.magazineDraftCorrections===true&&proof.editable===true&&owner?.kind==='magazine'&&typeof owner.storyId==='string'&&!!owner.storyId&&typeof owner.pieceId==='string'&&!!owner.pieceId&&proof.owner.storyId===owner.storyId&&proof.owner.pieceId===owner.pieceId&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)&&proof.draftHash===hash;}return window.AR_CREATE_REVIEW_MODE.studyDraftCorrections===true&&!!proof?.bindingId&&!!proof.expected?.workflow?.draft;}catch{return false;}};
 const writableFeedback=()=>{try{const p=current(),el=document.querySelector('[data-output-stage-surface="11"][data-feedback-editable="true"]'),owner=window.studyDraft?.currentOwner?.(),proof=window.studyDraft?.currentProof?.();return window.AR_CREATE_REVIEW_MODE.magazineFeedbackCorrections===true&&p.view==='record'&&Number(p.viewedStage)===11&&el&&owner?.kind==='magazine'&&owner.storyId===el.dataset.feedbackStory&&owner.pieceId===el.dataset.feedbackPiece&&proof?.parentStudyId===p.id&&proof.draftHash===el.dataset.feedbackDraft;}catch{return false;}};
 const writableCarousel=()=>{if(window.AR_CREATE_REVIEW_MODE.browserCarouselCorrections!==true)return false;try{const p=current(),edition=window.workbenchPieces?.carouselEdition?.(p.id);return p.view==='carousel'&&p.outputMode!=='look'&&!!document.querySelector('#workspace .wordSequence')&&edition?.authority==='browser-local'&&edition.projectId===p.id&&edition.origin===location.origin;}catch{return false;}};
 // This badge follows the mounted native writer's exact public proof. It grants no editing permission.
 const workingNativeCarousel=()=>{
  if(window.AR_CREATE_REVIEW_MODE.nativeCarouselCorrections!==true)return false;
  try{
   const p=current(),selection=window.studyOutputConnection?.selection?.(),canvas=window.studyOutputConnection?.canvasProof?.(),owner=selection?.owner,proof=canvas?.writingProof,expected=proof?.expected;
   if(p?.view!=='record'||Number(p.viewedStage)!==9||!document.querySelector('#workspace #study-output-canvas .car-workspace')||selection?.projectId!==p.id||selection.output?.kind!=='carousel'||owner?.kind!=='carousel-words'||proof?.kind!=='carousel-words'||proof.dirty===true)return false;
   if(canvas.scope?.parentStudyId!==p.id||canvas.scope.rootBindingId!==selection.rootBindingId||!selection.rootBindingId||canvas.selectedOutputId!==selection.output.id||owner.outputId!==selection.output.id)return false;
   if(!['projectId','documentId','outputId'].every(key=>typeof owner[key]==='string'&&!!owner[key]&&proof[key]===owner[key]&&expected?.[key]===owner[key]))return false;
   return [proof.wordsHash,expected.markdownHash,expected.outputHash].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value));
  }catch{return false;}
 };
 // Native retained marks keep their existing exact-span handler. Permission never supplies wording.
 const approvalPins=new WeakMap(),reviewTitles=new WeakMap();
 const nativeApprovalAllowed=button=>{
  if(window.AR_CREATE_REVIEW_MODE.studyDraftApprovals!==true||window.AR_CREATE_REVIEW_MODE.studyDraftCorrections!==true)return false;
  try{
   const p=current(),draft=window.studyDraft,proof=draft?.currentProof?.(),binding=draft?.currentBinding?.(),review=draft?.reviewState?.(),hash=proof?.expected?.workflow?.draft;
   if(p?.view!=='article'||Number(p.viewedStage)!==5||document.body.dataset.writeView==='preview'||proof?.owner||proof?.dirty!==false||review?.dirty!==false||binding?.authority!=='owned-working-copy'||binding.status!=='ready')return false;
   if(!proof.bindingId||binding.id!==proof.bindingId||binding.parentStudyId!==p.id||proof.parentStudyId!==p.id||review.bindingId!==binding.id||review.parentStudyId!==p.id||proof.draftHash!==hash||![hash,proof.expected?.bindingHash,proof.expected?.correspondenceHash].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))return false;
   const editor=document.querySelector('#workspace #manuscript'),layout=editor?.parentElement,rail=button.closest('.draft-approval-rail'),group=button.closest('[data-approval-block]'),row=button.closest('.draft-mark-approval');
   if(!layout?.classList.contains('draft-approval-layout')||rail?.parentElement!==layout||group?.parentElement!==rail||row?.parentElement!==group||button.parentElement!==row||button.dataset.draftApprove!=='true'||typeof button.onclick!=='function')return false;
   const blockId=group.dataset.approvalBlock,blocks=review.blocks?.filter(b=>b.id===blockId),buttons=[...group.querySelectorAll('[data-draft-approve]')];
   if(blocks?.length!==1||!Number.isSafeInteger(blocks[0].count)||blocks[0].count<=0||buttons.length!==blocks[0].count||![...editor.children].some(node=>node.dataset.block===blockId))return false;
   const signature=JSON.stringify([binding.id,p.id,proof.expected,proof.sequence,blockId,blocks[0].count,buttons.indexOf(button)]),pin=approvalPins.get(button);
   if(!pin){approvalPins.set(button,{signature,handler:button.onclick,title:reviewTitles.has(button)?reviewTitles.get(button):button.getAttribute('title')});return true;}
   return pin.signature===signature&&pin.handler===button.onclick;
  }catch{return false;}
 };
 // Availability follows the selected maintained reader, never the workspace feature flag alone.
 const writableSource=()=>{
  // The startup veil already conceals every remark. Measuring them all here can
  // starve the exact-source read while the hidden badge waits for visibility.
  if(window.arCreateReviewStartup?.pending||window.AR_CREATE_REVIEW_MODE.sourceCorrections!==true)return false;
  try{
   const p=current(),workspace=document.querySelector('#workspace.wb-source');
   if(!workspace||p?.view!=='record'||Number(p.viewedStage)!==2)return false;
   const state=window.studyImportedSource?.getState?.(),room=state?.projects?.[p.id];
   if(state?.data?.revision==null||!room?.sessionId||room.pending)return false;
   const sessions=state.data.sessions?.filter(s=>s.id===room.sessionId);
   if(sessions?.length!==1||!sessions[0].sourceId||!/^[a-f0-9]{64}$/i.test(sessions[0].sourceHash||''))return false;
   const turns=new Set((sessions[0].turns||[]).map(t=>t.id));
   for(const panel of workspace.querySelectorAll('[data-source-reader]')){
    if(panel.dataset.sourceReaderProject!==p.id)continue;
    for(const node of panel.querySelectorAll('[data-source-reader-turn][role="textbox"][aria-readonly="false"]')){
     if(!turns.has(node.dataset.sourceReaderTurn)||!['true','plaintext-only'].includes(node.getAttribute('contenteditable'))||!node.getClientRects().length)continue;
     let visible=true;
     for(let parent=node;parent;parent=parent.parentElement){const style=window.getComputedStyle(parent);if(parent.hidden||parent.getAttribute('aria-hidden')==='true'||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'){visible=false;break;}}
     if(visible)return true;
    }
   }
  }catch{}
  return false;
 };
 // Keep the exact current Check status once when the surface bar already shows it.
 const visibleCheckStatus=(bar,status)=>!!status&&[...bar.querySelectorAll('.sb-ro')].some(node=>{
  const text=(node.textContent||'').trim();if(text!==status&&!text.startsWith(status+' · '))return false;
  for(let parent=node;parent;parent=parent.parentElement){const style=window.getComputedStyle(parent);if(parent.hidden||parent.getAttribute('aria-hidden')==='true'||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;}
  return true;
 });
 // Lock passes can be triggered by the same rows whose attributes the bar watches.
 // Do not manufacture another owner change when the guarded state is unchanged.
 const attr=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
 const removeAttr=(el,name)=>{if(el.hasAttribute(name))el.removeAttribute(name);};
 const disabled=(el,value)=>{if(el.disabled!==value)el.disabled=value;};
 const lock=()=>{
  if(!window.document?.body)return;
  const draftAllowed=writableDraft(),carouselAllowed=writableCarousel();
  for(const el of document.querySelectorAll('[contenteditable="true"],[data-review-read-only]')){if(el.matches('#workspace #manuscript')&&draftAllowed||carouselAllowed&&el.matches('#workspace .wordSequence .slideProse,#workspace .wordSequence .caption .words')){if(el.dataset.reviewReadOnly){attr(el,'contenteditable','true');removeAttr(el,'aria-readonly');removeAttr(el,'data-review-read-only');}continue;}attr(el,'contenteditable','false');attr(el,'aria-readonly','true');attr(el,'data-review-read-only','true');}
  for(const el of document.querySelectorAll('[data-draft-approve],[data-draft-action="disk-undo"],[data-draft-action="restore-version"],[data-draft-action^="undo:"]')){if(el.hasAttribute('data-draft-approve')&&nativeApprovalAllowed(el)){disabled(el,false);if(el.dataset.reviewDraftLock){removeAttr(el,'data-review-draft-lock');const title=approvalPins.get(el)?.title;if(title===null)removeAttr(el,'title');else if(title!==undefined)attr(el,'title',title);}continue;}if((el.dataset.draftAction==='disk-undo'||el.dataset.draftAction?.startsWith('undo:'))&&draftAllowed){if(el.dataset.reviewDraftLock){disabled(el,el.dataset.blocked==='true');removeAttr(el,'data-review-draft-lock');}continue;}if(!reviewTitles.has(el))reviewTitles.set(el,el.getAttribute('title'));disabled(el,true);attr(el,'data-review-draft-lock','true');attr(el,'title','This action is not connected in the review. Saved words and history remain with the installed writer.');}
  for(const el of document.querySelectorAll('.ci-sample-gate,.ci-sample,button[onclick^="openInstruction"],button[onclick^="prepareNote"]'))if(el.style.getPropertyValue('display')!=='none'||el.style.getPropertyPriority('display')!=='important')el.style.setProperty('display','none','important');
  const bar=document.getElementById('c3-surface-bar');if(bar&&!bar.querySelector('[data-review-state]')){const badge=document.createElement('span');badge.dataset.reviewState='';badge.textContent='Read-only review';badge.style.cssText='font:inherit;font-size:13px;white-space:nowrap;opacity:.75;margin-left:auto';bar.append(badge);}
  const badge=bar?.querySelector('[data-review-state]');if(badge){const checkStatus=window.c3PieceState?.checkManuscriptStatus?.()||'',redundant=visibleCheckStatus(bar,checkStatus);if(badge.hidden!==redundant)badge.hidden=redundant;const title=carouselAllowed?'Browser carousel · saved here':'';if(badge.title!==title)badge.title=title;const text=carouselAllowed?'Saved':workingNativeCarousel()?'Working carousel':draftAllowed?'Working manuscript':writableFeedback()?'Feedback editing':writableSource()?'Transcript editing':checkStatus||'Read-only review';if(badge.textContent!==text)badge.textContent=text;}
  attr(document.body,'data-existing-work-review','readonly');
 };
 window.addEventListener?.('study-draft-change',lock);window.addEventListener?.('study-write-view',lock);
 const observe=()=>{lock();new MutationObserver(lock).observe(document.body,{childList:true,subtree:true});};
 if(document.body)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});
})();
