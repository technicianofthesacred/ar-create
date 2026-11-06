/* Read-only saved placement links; composition and original media keep their owners. */
(()=>{
 const KEY='ar-create.media-return.v1';let navigating=false,selectionEpoch=0;
 window.addEventListener('study-output-selection',()=>selectionEpoch++);
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const binding=()=>{const b=window.studyDraft?.currentBinding?.();return b?{id:b.id,parentStudyId:b.parentStudyId,kind:b.kind,partKey:b.partKey}:null;};
 const selected=()=>{const s=window.studyOutputConnection?.selection?.();return s?{parentStudyId:s.projectId,rootBindingId:s.rootBindingId,outputId:s.output?.id}:null;};
 const fail=()=>{throw Error('The selected section or manuscript part changed. Reopen the exact photograph from Media.');};
 function origin(selector){
  const p=current(),before=binding(),photo=window.studyPhotoStage?.browserOwner?.(),epoch=selectionEpoch;
  const root=()=>{const owner=window.studyPhotoStage?.browserOwner?.(),s=selected(),b=binding();return owner?.read?.()?owner.scope:s?.parentStudyId===p.id?s:b?.parentStudyId===p.id&&b.kind!=='output-fork'?{parentStudyId:p.id,rootBindingId:b.id}:null;};
  const check=()=>{const scope=root();if(current()!==p||p.id!==selector.parentStudyId||p.view!=='record'||Number(p.viewedStage)!==8||selectionEpoch!==epoch||stable(binding())!==stable(before)||scope?.parentStudyId!==selector.parentStudyId||scope.rootBindingId!==selector.rootBindingId||photo&&!photo.read())fail();};
  check();return {p,binding:before,epoch,check};
 }
 function targetCheck(context,value){return ()=>{const p=current(),s=selected();if(p!==context.p||p.id!==value.parentStudyId||p.view!=='record'||Number(p.viewedStage)!==9||selectionEpoch!==context.epoch||stable(binding())!==stable(context.binding)||s?.parentStudyId!==value.parentStudyId||s.rootBindingId!==value.rootBindingId||s.outputId!==value.outputId)fail();};}
 function exact(value,occurrence,selector){
  if(value?.id!==selector.occurrenceId||value.sourceId!==selector.sourceId||value.scope?.parentStudyId!==selector.parentStudyId||value.scope.rootBindingId!==selector.rootBindingId||value.outputId!==occurrence.outputId||stable(value.edition)!==stable(occurrence.edition)||stable(value.location)!==stable(occurrence.location)||stable(value.navigation?.expectedOutput)!==stable(occurrence.navigation?.expectedOutput)||value.navigation?.rootBindingId!==selector.rootBindingId||value.navigation.request?.projectId!==selector.parentStudyId||value.navigation.request.outputId!==occurrence.outputId||value.navigation.request.kind!=='arrange')throw Error('The exact saved placement or edition changed. Refresh Media.');
  return value;
 }
 async function api(route,input){const response=await fetch(route+'?'+new URLSearchParams(input)),result=await response.json();if(!response.ok)throw Error(result.error||'Saved media usage is unavailable.');return result;}
 async function read({sourceIds,...scope}){const query=new URLSearchParams(scope);for(const id of sourceIds)query.append('sourceId',id);const response=await fetch('/api/study/media-usage?'+query),v=await response.json();if(!response.ok)throw Error(v.error||'Saved placements are unavailable.');return v;}
 async function ready(outputId,check){const until=Date.now()+7000;while(Date.now()<until){check();if(document.querySelector('[data-output-recover]')&&window.studyOutputConnection.selection?.()?.output?.id!==outputId)throw Error('Another output has an interrupted operation. Recover its exact save below, then reopen this photograph from Media.');if(window.studyCompositionFocus?.outputId===outputId)return window.studyCompositionFocus;await new Promise(resolve=>requestAnimationFrame(resolve));}throw Error('The matching composition has not finished opening. Your photograph remains unchanged.');}
 async function open(occurrence,usageHash){
  if(navigating)throw Error('The matching placement is still opening.');
  const selector={rootBindingId:occurrence.scope.rootBindingId,parentStudyId:occurrence.scope.parentStudyId,sourceId:occurrence.sourceId,occurrenceId:occurrence.id,expectedUsageHash:usageHash},context=origin(selector);
  navigating=true;sessionStorage.removeItem(KEY);document.getElementById('study-media-return')?.remove();
  try{
   const proof=await window.studyOutputConnection.flush();context.check();if(proof?.dirty)throw Error('Save or resolve your Draft changes before opening this photograph.');
   const resolved=exact(await api('/api/study/media-usage/resolve',selector),occurrence,selector);context.check();
   await window.studyOutputConnection.read({projectId:selector.parentStudyId});context.check();
   await window.studyOutputConnection.onAction(resolved.navigation.request,{rootBindingId:selector.rootBindingId,originGuard:context.check});
   const value={...selector,outputId:resolved.outputId},check=targetCheck(context,value);check();
   const focus=await ready(resolved.outputId,check),fresh=exact(await api('/api/study/media-usage/resolve',selector),resolved,selector);check();
   if(window.studyCompositionFocus!==focus)fail();const result=await focus.focus(fresh.location);check();
   sessionStorage.setItem(KEY,JSON.stringify(value));return result;
  }catch(error){const canvas=document.getElementById('study-output-canvas');if(canvas&&current()===context.p&&current().view==='record'&&Number(current().viewedStage)===9){const alert=document.createElement('p');alert.setAttribute('role','alert');alert.textContent=error.message;canvas.before(alert);}throw error;}
  finally{navigating=false;paintReturn();}
 }
 function paintReturn(){
  const p=current();if(navigating||p?.view!=='record'||Number(p.viewedStage)!==9){document.getElementById('study-media-return')?.remove();return;}
  let value;try{value=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{return;}
  const s=selected();if(!value||value.parentStudyId!==p.id||s?.rootBindingId!==value.rootBindingId||s.outputId!==value.outputId){document.getElementById('study-media-return')?.remove();return;}
  const canvas=document.getElementById('study-output-canvas');if(!canvas||document.getElementById('study-media-return'))return;
  const bar=document.createElement('div');bar.id='study-media-return';bar.className='photo-actions';const button=document.createElement('button');button.type='button';button.textContent='Back to photograph';
  button.onclick=async()=>{button.disabled=true;const context={p:current(),binding:binding(),epoch:selectionEpoch},check=targetCheck(context,value);try{
   check();const proof=await window.studyOutputConnection.flush();check();if(proof?.dirty)throw Error('Save or resolve your Draft changes before returning to Media.');
   await window.viewPhase(8,{originGuard:check});
   const mediaCheck=()=>{if(current()!==context.p||current().view!=='record'||Number(current().viewedStage)!==8||selectionEpoch!==context.epoch||stable(binding())!==stable(context.binding))fail();};
   mediaCheck();await window.studyPhotoStage.focusAsset({parentStudyId:value.parentStudyId,rootBindingId:value.rootBindingId,sourceId:value.sourceId,originGuard:mediaCheck});mediaCheck();sessionStorage.removeItem(KEY);
  }catch(e){button.textContent=e.message;button.disabled=false;}};bar.append(button);canvas.before(bar);
 }
 const observer=new MutationObserver(paintReturn);observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});window.addEventListener('pagehide',event=>{if(!event.persisted)observer.disconnect();});
 window.studyMediaUsage={read,open};
})();
