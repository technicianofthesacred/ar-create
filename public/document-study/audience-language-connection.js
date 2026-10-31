import {createAudienceLanguageDrawer} from './audience-language-drawer.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),clone=v=>structuredClone(v);
/** Connect the existing Audience selection to the existing translation owner. */
export function createAudienceLanguageConnection({window:win,createDrawer=createAudienceLanguageDrawer}={}){
 let drawer=null,context=null,epoch=0;
 const actor=()=>win.arCreateUiActor?.actor;
 const snapshot=()=>win.outputStageSurfaces?.navigationSnapshot?.();
 function selected(scope){const n=snapshot();return n?.state==='ready'&&n.kind==='article'&&n.projectId===scope.parentStudyId&&n.outputId===scope.outputId&&n.rootBindingId===scope.bindingId;}
 const key=scope=>'ar-create-audience-language:'+JSON.stringify([actor(),scope]);
 const pointer=scope=>{try{return win.sessionStorage.getItem(key(scope))||undefined;}catch{return undefined;}};
 const remember=({scope,requestId})=>{if(requestId)try{win.sessionStorage.setItem(key(scope),requestId);}catch{}};
 async function open({projectId,rootBindingId,outputId}={}){
  const scope={kind:'audience-article',bindingId:rootBindingId,parentStudyId:projectId,outputId},token=++epoch,by=actor();
  if(!selected(scope)||!by)throw Error('Choose the exact saved Article in Audience.');
  await win.studyOutputConnection?.flush?.();
  const response=await win.fetch('/api/study/outputs?'+new URLSearchParams({rootBindingId,parentStudyId:projectId,selectedOutputId:outputId}),{cache:'no-store'}),view=await response.json();
  if(!response.ok)throw Error(view.error||'This saved Article could not be read.');
  if(token!==epoch||!selected(scope)||actor()!==by||view.scope?.rootBindingId!==rootBindingId||view.scope?.parentStudyId!==projectId||view.output?.id!==outputId||view.output.kind!=='article'||view.writingProof?.kind!=='native'||view.wordOwner?.bindingId!==view.writingProof.bindingId)throw Error('The selected Article changed. Reopen its translation.');
  drawer?.close();context={scope,sourceProof:clone(view.writingProof),actor:by,title:view.output.title||view.output.name||'Article'};
  drawer=createDrawer({window:win,request:async packet=>{
   const response=await win.fetch(packet.url,{method:packet.method,cache:'no-store',signal:packet.signal,headers:{Accept:'application/json','X-AR-Actor':by,'X-AR-Client':'ui',...(packet.body?{'Content-Type':'application/json'}:{})},...(packet.body?{body:JSON.stringify(packet.body)}:{})}),value=await response.json();
   if(!response.ok)throw Error(value.error||'Translation could not finish.');
   if(value.id&&(!same(value.source?.scope,scope)||!same(value.source?.proof?.writingProof,context.sourceProof)))throw Error('The saved source words changed. Reopen this Article’s translation.');
   return value;
  },context:()=>selected(scope)&&actor()===by?context:null,onRequestPrepared:remember,onClose:remember,onOpenEdition:async edition=>{
   if(!selected(scope)||actor()!==by||edition.rootBindingId!==scope.bindingId||edition.parentStudyId!==scope.parentStudyId||edition.selectedOutputId===scope.outputId)throw Error('The selected source Article changed. The Chinese edition remains in Outputs.');
   const catalog=await win.realOutputOverview.read({projectId});
   if(!selected(scope)||actor()!==by||catalog.projectId!==projectId||!catalog.outputs?.some(o=>o.id===edition.selectedOutputId&&o.rootBindingId===rootBindingId))throw Error('The saved Chinese edition is available in Outputs. Reopen it there.');
   drawer.close();await win.studyOutputConnection.selectOutput({projectId,outputId:edition.selectedOutputId});await win.viewPhase(10);
  }});
  return drawer.open({requestId:pointer(scope)});
 }
 function close(){epoch++;drawer?.close();drawer=null;context=null;}
 return {open,close,get state(){return drawer?.state||null;}};
}
if(typeof window!=='undefined')window.studyAudienceLanguage=createAudienceLanguageConnection({window});
