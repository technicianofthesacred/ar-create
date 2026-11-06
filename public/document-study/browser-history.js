/* Browser history is navigation only. Existing owners retain words, files and recovery. */
(function(root){
 function create({window:w,snapshot,restore,onError=()=>{}}){
  const session=w.crypto?.randomUUID?.()||String(Date.now())+Math.random(),entries=new Map();let current=null,pendingURL=null,depth=0,queued=false,busy=false,next=null,bounce=null,idle=Promise.resolve(),disposed=false,suspended=false,initialPush=false;
  const marker=entry=>({session,entry:entry.id,index:entry.index});
  const owned=state=>{const token=state?.arCreateNavigation,entry=token?.session===session&&entries.get(token.entry);return entry&&entry.index===token.index?entry:null;};
  const stateFor=entry=>({...w.history.state,arCreateNavigation:marker(entry)});
  const localURL=url=>{const value=new URL(url,w.location.href);if(value.origin!==w.location.origin||value.pathname!==w.location.pathname)throw Error('Browser navigation cannot change this application origin or page.');return value.href;};
  function record(){if(disposed||busy||depth||suspended)return;const value=snapshot();if(!value)return;const url=pendingURL||w.location.href;pendingURL=null;if(current&&value.key===current.value.key){if(url!==w.location.href)w.history.replaceState(stateFor(current),'',url);return;}
   const entry={id:w.crypto?.randomUUID?.()||String(entries.size+1),index:current?current.index+1:0,value,url};
   if(current){for(const [id,old]of entries)if(old.index>=entry.index)entries.delete(id);w.history.pushState(stateFor(entry),'',url);}else if(initialPush){initialPush=false;w.history.pushState(stateFor(entry),'',url);}else w.history.replaceState(stateFor(entry),'',url);
   entries.set(entry.id,entry);current=entry;for(const old of entries.values()){const position=old.value.position;if(position?.editor&&!position.editor.isConnected){position.editor=null;position.range=null;}}
  }
  function schedule(){if(queued||disposed||busy||depth)return;queued=true;w.setTimeout(()=>{queued=false;try{record();}catch(error){onError(error);}});}
  function begin(){if(suspended){suspended=false;current=null;entries.clear();initialPush=true;}if(!busy&&!depth){record();if(current){const value=snapshot();if(value?.key===current.value.key)current.value=value;}}depth++;}
  function end(){depth=Math.max(0,depth-1);schedule();}
  function pop(event){const target=owned(event.state);if(!target){suspended=true;return;}suspended=false;if(bounce===target.id){bounce=null;return;}next=target;if(busy)return;const leaving=snapshot();if(current&&leaving?.key===current.value.key)current.value=leaving;busy=true;
   idle=(async()=>{while(next){const target=next;next=null;try{await restore(target.value);current=target;pendingURL=null;}catch(error){onError(error);if(!next&&current&&target.index!==current.index){bounce=current.id;w.history.go(current.index-target.index);}}}busy=false;})().catch(error=>{busy=false;onError(error);});
  }
  w.addEventListener('popstate',pop);
  return {record,schedule,begin,end,isReplaying:()=>busy,whenIdle:()=>idle,addressChanged(url){pendingURL=localURL(url);schedule();},dispose(){disposed=true;w.removeEventListener('popstate',pop);},state:()=>current?{session,index:current.index,entry:current.id}:null};
 }
 root.ArBrowserHistory={create};
 if(typeof current!=='function'||!root.document?.getElementById('app')||root.browserNavigation)return;
 const w=root,d=w.document,copy=value=>value?JSON.parse(JSON.stringify(value)):null;
 const identity=owner=>!owner?null:owner.kind==='magazine'?{kind:'magazine',...Object.fromEntries(['storyId','pieceId','path'].map(key=>[key,owner.owner?.[key]??owner[key]]))}:owner.kind==='native'?{kind:'native',bindingId:owner.owner?.bindingId||owner.bindingId}:owner.rootBindingId&&owner.outputId?{kind:owner.kind,rootBindingId:owner.rootBindingId,outputId:owner.outputId}:null;
 function view(){
  if(w.arCreateReviewStartup?.pending)return null;const p=current();if(!p?.id)return null;const b=w.studyDraft?.currentBinding?.(),proof=w.studyDraft?.currentProof?.(),selected=w.studyOutputConnection?.selection?.(),sheet=w.combinedSheets?.state?.(),home=d.getElementById('project-library')?.open;
  if(d.getElementById('manuscript')&&(!proof||proof.parentStudyId!==p.id))return null;
  let owner;try{owner=identity(w.workspaceNavigation?.navigationOwner?.({ignoreReader:true}));}catch{return null;}
  if(Number(p.viewedStage)===9){const canvas=w.studyOutputConnection?.canvasProof?.();if(!canvas||canvas.scope?.parentStudyId!==p.id||(canvas.selectedOutputId||null)!==(selected?.output?.id||null))return null;if(selected?.output?.kind==='carousel'&&(canvas.writingProof?.kind!=='carousel-words'||canvas.writingProof.outputId!==selected.output.id))return null;}
  if([5,6].includes(Number(p.viewedStage))&&selected?.owner?.kind==='native'&&selected.owner.bindingId!==proof?.bindingId)return null;
  const route={projectId:p.id,stage:Number(p.viewedStage)||(p.view==='article'?5:0),view:p.view,mode:w.studyDraft?.viewMode?.()==='preview'?'read':w.workspaceNavigation?.isCarouselCheck?.()?'check':d.querySelector('.car-writing-page')?.dataset.writingView||(Number(p.viewedStage)===9?'arrange':'write'),owner:selected?.projectId===p.id&&selected.output?.id?{kind:'output',rootBindingId:selected.rootBindingId,outputId:selected.output.id}:owner||(b?.parentStudyId===p.id?{kind:'native',bindingId:b.id}:null),output:selected?.projectId===p.id?{rootBindingId:selected.rootBindingId,outputId:selected.output?.id,kind:selected.output?.kind}:null,overlay:w.c3Research?.isOpen?.()?'research':sheet?.projectId===p.id?sheet.kind:null,home:!!home};
  return {key:JSON.stringify(route),route,position:position()};
 }
 function position(){const editor=d.getElementById('manuscript'),ws=d.getElementById('workspace'),selection=w.getSelection(),range=selection?.rangeCount&&editor?.contains(selection.anchorNode)?selection.getRangeAt(0).cloneRange():null;let passage=null;
  if(range){const block=(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement)?.closest('[data-block]'),end=(range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement)?.closest('[data-block]');if(block&&block===end){const before=range.cloneRange();before.selectNodeContents(block);before.setEnd(range.startContainer,range.startOffset);passage={id:block.dataset.block,text:block.textContent,start:before.toString().length,length:range.toString().length};}}
  return {editor,range,passage,scroll:ws?.scrollTop||0,researchScroll:d.getElementById('c3-research')?.scrollTop||0,sourceScroll:d.querySelector('#combined-sheet .combined-sheet-content')?.scrollTop||0};
 }
 function restorePosition(saved){const ws=d.getElementById('workspace'),editor=d.getElementById('manuscript');if(!saved||!ws)return;ws.scrollTop=saved.scroll;const research=d.getElementById('c3-research'),source=d.querySelector('#combined-sheet .combined-sheet-content');if(research)research.scrollTop=saved.researchScroll||0;if(source)source.scrollTop=saved.sourceScroll||0;
  if(saved.range&&saved.editor===editor&&editor?.contains(saved.range.commonAncestorContainer)){editor.focus({preventScroll:true});const selection=w.getSelection();selection.removeAllRanges();selection.addRange(saved.range);return;}
  const p=saved.passage,block=p&&[...d.querySelectorAll('#manuscript [data-block]')].find(node=>node.dataset.block===p.id&&node.textContent===p.text);if(!block)return;const walker=d.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,offset=0,start=null,end=null;while(node=walker.nextNode()){if(!start&&p.start<=offset+node.length)start=[node,p.start-offset];if(p.start+p.length<=offset+node.length){end=[node,p.start+p.length-offset];break;}offset+=node.length;}if(start&&end){const range=d.createRange();range.setStart(...start);range.setEnd(...end);editor.focus({preventScroll:true});const selection=w.getSelection();selection.removeAllRanges();selection.addRange(range);}
 }
 const baseKey=route=>JSON.stringify({...route,overlay:null});
 function settled(test){if(test())return Promise.resolve();return new Promise((resolve,reject)=>{let timer;const observer=new MutationObserver(check);const events=['study-output-owner-confirmed','study-output-selection','study-draft-change','study-write-view','study-carousel-view'];function clear(){clearTimeout(timer);observer.disconnect();for(const event of events)w.removeEventListener(event,check);}function check(){try{if(test()){clear();resolve();}}catch(error){clear();reject(error);}}observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});for(const event of events)w.addEventListener(event,check);timer=setTimeout(()=>{clear();reject(Error('The exact saved navigation context did not become ready. Current words are retained.'));},5000);check();});}
 async function restore(target){const wanted=target.route;let actual=view()?.route;if(!actual)throw Error('The current work is not ready for browser navigation.');
  const sameBase=baseKey(actual)===baseKey(wanted);if(!sameBase){const proof=await w.studyOutputConnection?.flush?.()||await w.studyDraft?.flush?.();if(proof?.dirty||w.studyDraft?.currentProof?.()?.dirty)throw Error('Save or resolve your current writing before going back or forward.');}
  if(actual.overlay==='research'&&wanted.overlay!==actual.overlay){if(w.c3Research.hide()===false)throw Error('Resolve the current Research return before leaving.');}
  else if(actual.overlay&&actual.overlay!==wanted.overlay){if(await w.combinedSheets.close()===false)throw Error('Resolve the current source return before leaving.');}
  actual=view()?.route;if(baseKey(actual)!==baseKey(wanted)){
   if(w.c3Research?.isOpen?.()&&w.c3Research.hide()===false)throw Error('Resolve the current Research return before leaving.');if(w.combinedSheets?.state?.()&&await w.combinedSheets.close()===false)throw Error('Resolve the current source return before leaving.');
   const proof=await w.studyOutputConnection?.flush?.()||await w.studyDraft?.flush?.();if(proof?.dirty||w.studyDraft?.currentProof?.()?.dirty)throw Error('Save or resolve your current writing before going back or forward.');
   if(current().id!==wanted.projectId){await w.switchProject(wanted.projectId);if(current().id!==wanted.projectId)throw Error('This project could not open. Current work is retained.');}
   if(d.getElementById('project-library')?.open&&!wanted.home){if(await w.projectLibrary.close()===false||d.getElementById('project-library')?.open)throw Error('Resolve the open work before browser navigation.');}
   const owner=wanted.owner;
   if(wanted.output?.outputId&&[5,6,7,9].includes(wanted.stage)){
    if(typeof w.studyOutputConnection?.openNavigationOutput!=='function')throw Error('This exact output cannot be reopened through browser history.');await w.studyOutputConnection.openNavigationOutput({projectId:wanted.projectId,rootBindingId:wanted.output.rootBindingId,outputId:wanted.output.outputId,mode:wanted.stage===7||wanted.mode==='check'?'check':wanted.stage===9&&wanted.mode==='write'?'write':wanted.stage===9&&wanted.mode==='read'?'read':wanted.stage===9?'arrange':wanted.stage===6?'read':'write'});
   }else{
    if(wanted.output?.outputId){await w.studyOutputConnection.selectOutput({projectId:wanted.projectId,outputId:wanted.output.outputId});const selected=w.studyOutputConnection.selection();if(selected?.rootBindingId!==wanted.output.rootBindingId||selected?.output?.id!==wanted.output.outputId)throw Error('The exact saved output selection changed.');}
    else if(owner?.kind==='native'&&identity(w.workspaceNavigation.navigationOwner({ignoreReader:true}))?.bindingId!==owner.bindingId){await w.studyOutputConnection?.clearSelection?.({projectId:wanted.projectId,rootBindingId:owner.bindingId});await w.studyDraft.openBinding({parentStudyId:wanted.projectId,bindingId:owner.bindingId});}
    if(owner?.kind==='magazine'&&[5,6].includes(wanted.stage))await w.existingWork.openCurrentDraft({projectId:wanted.projectId,mode:wanted.stage===6?'read':'write',expectedOwner:owner});else if([5,6].includes(wanted.stage))await w.workspaceNavigation.changeMode(wanted.stage===6||wanted.mode==='read'?'read':'write');else await w.viewPhase(wanted.stage);
   }
   if(wanted.home){await w.projectLibrary.open();if(!d.getElementById('project-library')?.open)throw Error('Home could not reopen.');}
  }
  await settled(()=>{if(current().id!==wanted.projectId)throw Error('The selected project changed during browser navigation.');const actual=view()?.route;return actual&&baseKey(actual)===baseKey(wanted);});
  if(wanted.overlay==='research'&&!w.c3Research.isOpen())await w.c3Research.openLearning({parentStudyId:wanted.projectId});else if(wanted.overlay&&wanted.overlay!=='research'&&w.combinedSheets?.state?.()?.kind!==wanted.overlay){if(await w.combinedSheets.open(wanted.overlay)===false)throw Error('The saved source context could not reopen.');}
  await settled(()=>view()?.key===target.key);restorePosition(target.position);
 }
 const error=error=>{const node=d.getElementById('wn-message');if(node){node.textContent=error.message;node.hidden=false;}w.toast?.(error.message);};
 const navigation=create({window:w,snapshot:view,restore,onError:error});w.browserNavigation=navigation;
 const wrappers=new WeakMap();function wrap(owner,name){const prior=owner?.[name];if(typeof prior!=='function')return;if(wrappers.has(prior)){owner[name]=wrappers.get(prior);return;}const wrapped=function(...args){navigation.begin();try{const result=prior.apply(this,args);if(result?.then)return result.finally(()=>navigation.end());navigation.end();return result;}catch(error){navigation.end();throw error;}};wrappers.set(prior,wrapped);wrappers.set(wrapped,wrapped);owner[name]=wrapped;}
 for(const name of ['viewPhase','switchProject','setView'])wrap(w,name);
 for(const [owner,names]of [[w.combinedNavigation,['go']],[w.c3Research,['openLearning','show','hide']],[w.combinedSheets,['open','close']],[w.studyDraft,['openBinding','openMagazine','read','edit']],[w.studyOutputConnection,['onAction','openNavigationOutput']],[w.realOutputOverview,['onAction']],[w.projectLibrary,['open','close']]])for(const name of names)wrap(owner,name);
 const observer=new MutationObserver(()=>navigation.schedule());observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 for(const event of ['study-output-owner-confirmed','study-output-selection','c3-header-painted','study-write-view','study-carousel-view','study-draft-change'])w.addEventListener(event,()=>navigation.schedule());
 navigation.schedule();w.addEventListener('pagehide',()=>{observer.disconnect();navigation.dispose();},{once:true});
})(typeof window!=='undefined'?window:globalThis);
