import {readDirectionChoices,applyDirectionChoice,stripDirectionChoices} from '../lib/direction-choice.js';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameSource=(a,b)=>a?.artifactId===b?.artifactId&&a?.hash===b?.hash;

// Choices remain a managed section of the existing shared direction record.
// Draft inputs below are ephemeral; they never replace the saved owner.
export function createInlineDirectionChoices({window:win,fetch:request=win.fetch.bind(win)}={}) {
 let mounted=null,epoch=0;
 const drafts=new Map();
 const api=async(url,body)=>{const response=await request(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Error(value.error||'The direction could not be saved.');return value;};
 const readRecord=id=>api('/api/study/human-direction?'+new URLSearchParams({parentStudyId:id,scope:'project'}));
 async function readFor(parentStudyId){const record=await readRecord(parentStudyId);return {...readDirectionChoices(record.body||''),revision:record.revision,hash:record.hash,parentStudyId,scope:'project'};}
 const isCurrent=m=>mounted===m&&m.container.isConnected&&m.isCurrent()!==false;
 const dirty=m=>win.studyHumanDirection?.isDirty?.({parentStudyId:m.parentStudyId});
 const mutable=m=>m.bindingId?m.options?.canDecide===true:typeof m.canMutate==='function'?m.canMutate()===true:m.canMutate===true;
 const inputs=m=>{let draft=drafts.get(m.parentStudyId);if(!draft||!sameSource(draft.source,m.options?.source)){draft={source:m.options?.source,words:{},reasons:{}};drafts.set(m.parentStudyId,draft);}return draft;};
 function paint(m){
  if(!isCurrent(m))return;
  const host=m.container,state=m.record?readDirectionChoices(m.record.body||''):null,options=m.options;
  const blocked=m.busy||!options||!state?.available||!mutable(m)||dirty(m)||!m.record?.bound;
  const disabled=blocked?' disabled':'';
  if(!options){host.innerHTML='<section class="inline-direction-choices"><h3>Angles and titles</h3><p role="status">'+escapeHTML(m.error||'Loading prepared directions…')+'</p></section>';return;}
  const draft=inputs(m),optionHTML=(option,kind)=>{
   const selected=kind==='angle'?state?.selectedAngle:state?.selectedTitle;
   const chosen=selected?.optionId===option.id&&sameSource(selected.source,options.source);
   const rejected=state?.rejections?.filter(event=>event.kind===kind&&event.optionId===option.id&&sameSource(event.source,options.source)).at(-1);
   const key=kind+':'+option.id,word=draft.words[key]??(chosen?selected.text:option.text),reason=draft.reasons[key]??'';
   return '<section class="inline-direction-option'+(chosen?' is-chosen':'')+'" data-choice-kind="'+kind+'" data-choice-id="'+escapeHTML(option.id)+'"><label class="inline-direction-option-label">'+(kind==='angle'?'Angle':'Title')+'<textarea data-choice-words aria-label="Edit '+kind+' wording" rows="'+(kind==='angle'?Math.min(4,Math.max(1,Math.ceil(String(word).length/80))):1)+'" maxlength="2048"'+disabled+'>'+escapeHTML(word)+'</textarea></label>'+(option.description?'<p class="inline-direction-description">'+escapeHTML(option.description).replace(/\n/g,'<br>')+'</p>':'')+'<div class="inline-direction-actions"><button type="button" data-choice-action="use"'+disabled+'>'+(chosen&&word===selected.text?(options.standIn?'Stand-in choice':'Chosen by you'):'Use this')+'</button><button type="button" data-choice-action="reject"'+disabled+'>Not this</button><input data-choice-reason aria-label="Reason for rejecting this '+kind+'" placeholder="Why doesn’t this fit?" maxlength="2048" value="'+escapeHTML(reason)+'"'+disabled+'></div>'+(rejected?'<p class="inline-direction-rejected">Previously rejected: '+escapeHTML(rejected.reason)+'</p>':'')+'</section>';
  };
  const events=state?.events||[];
  host.innerHTML='<section class="inline-direction-choices"><header><h3>Angles</h3><span>'+escapeHTML(options.standIn?'Stand-in · '+(win.arCreateUiActor?.actor||'Agent'):'Prepared possibilities')+'</span></header>'+options.angles.map(option=>optionHTML(option,'angle')).join('')+'<header class="inline-direction-title-heading"><h3>Titles</h3><span>Choose or edit the wording</span></header>'+options.titles.map(option=>optionHTML(option,'title')).join('')+'<p class="inline-direction-status" role="status">'+escapeHTML(m.error||(!mutable(m)?'Review only · choices belong to the author.':dirty(m)?'Save or compare your unsaved direction before choosing.':!state?.available?state?.reason||'The saved choices need review.':!m.record?.bound?'Connect shared project direction before choosing.':m.busy?'Saving your choice…':m.message||'Subject choices'))+'</p>'+(events.length?'<section class="inline-direction-history"><h4>Earlier choices and reasons</h4><ol>'+events.map(event=>'<li>'+escapeHTML(event.target?.kind==='native'?'Piece':event.target?.kind==='output'?'Output':'Subject')+' · '+escapeHTML(event.actor||'human:adrian')+(event.decisionRole==='stand-in'?' · stand-in':'')+' · '+escapeHTML(event.kind==='angle'?'Angle':'Title')+' · '+escapeHTML(event.text)+' · '+(event.action==='use'?'Chosen':event.action==='reject'?'Rejected: '+escapeHTML(event.reason):event.action==='inherit'?'Inherit subject':'Not applicable')+'</li>').join('')+'</ol></section>':'')+'</section>';
  for(const row of host.querySelectorAll('[data-choice-kind]')){
   const key=row.dataset.choiceKind+':'+row.dataset.choiceId;
   row.querySelector('[data-choice-words]').addEventListener('input',e=>{draft.words[key]=e.target.value;});
   row.querySelector('[data-choice-reason]').addEventListener('input',e=>{draft.reasons[key]=e.target.value;});
   for(const button of row.querySelectorAll('[data-choice-action]'))button.addEventListener('click',()=>save(m,{kind:row.dataset.choiceKind,optionId:row.dataset.choiceId,action:button.dataset.choiceAction,text:row.querySelector('[data-choice-words]').value,reason:row.querySelector('[data-choice-reason]').value}));
  }
 }
 async function save(m,input){
  if(!isCurrent(m)||m.busy||!mutable(m))return false;
  if(['use','reject'].includes(input.action)&&(!input.text?.trim()||input.action==='reject'&&!input.reason?.trim())){m.error=input.action==='reject'?'Add a reason before rejecting this possibility.':'Write the wording you want to use.';paint(m);return false;}
  m.busy=true;m.error='';m.message='';let success=false;paint(m);
  try{
   if(dirty(m))throw Error('Save or compare your unsaved direction before choosing.');
   const fresh=await m.loadOptions({parentStudyId:m.parentStudyId,fresh:true});
   if(!isCurrent(m))return;
   if(m.bindingId&&(fresh?.bindingId!==m.bindingId||fresh?.parentStudyId!==m.parentStudyId||fresh?.canDecide!==true))throw Error('Direction authority changed.');
   if(!sameSource(fresh?.source,m.options.source))throw Error('The prepared directions have changed. Reload them before choosing.');
   const option=(input.kind==='angle'?fresh.angles:fresh.titles).find(item=>item.id===input.optionId);
   if(['use','reject'].includes(input.action)&&!option)throw Error('This prepared possibility is no longer available.');
   const record=await readRecord(m.parentStudyId);
   if(!isCurrent(m))return;
   if(dirty(m))throw Error('Your unsaved direction is preserved. Save or compare it before choosing.');
   if(m.bindingId&&(record.scope?.kind!=='project'||record.scope.parentStudyId!==m.parentStudyId))throw Error('Saved direction belongs to another subject.');
   if(record.externalEdit||!record.bound)throw Error('The shared direction needs review before saving a choice.');
   if(!mutable(m))throw Error('Choices belong to the author.');
   if(m.bindingId&&(record.hash!==m.record?.hash||record.revision!==m.record?.revision))throw Error('Saved choices changed. Reload Direction before deciding.');
   const event={...input,operationId:win.crypto.randomUUID(),source:fresh.source};
   let saved;if(m.bindingId){const target=input.target||{kind:'subject'},choice=['use','reject'].includes(input.action);saved=await api('/api/study/direction-decision',{parentStudyId:m.parentStudyId,bindingId:m.bindingId,operationId:event.operationId,expectedRevision:record.revision,expectedHash:record.hash,target,kind:input.kind,action:input.action,...(choice?{optionId:input.optionId,text:input.text,source:fresh.source}:{}),...(input.reason?.trim()?{reason:input.reason.trim()}:{})});saved=saved.record||saved;}else{const body=applyDirectionChoice(record.body||'',event);saved=await api('/api/study/human-direction/write',{parentStudyId:m.parentStudyId,scope:'project',expectedRevision:record.revision,expectedHash:record.hash,operationId:event.operationId,body});}
   if(!isCurrent(m))return;if(saved.scope?.parentStudyId&&saved.scope.parentStudyId!==m.parentStudyId)throw Error('Saved choice belongs to another subject.');m.record=saved;m.message=m.options.standIn?'Stand-in choice saved':'Choice saved';
   win.dispatchEvent(new win.CustomEvent('study-human-direction-change',{detail:{parentStudyId:m.parentStudyId,scope:'project',revision:saved.revision}}));
   success=true;win.dispatchEvent(new win.CustomEvent('study-direction-choice-change',{detail:{parentStudyId:m.parentStudyId,scope:'project',revision:saved.revision}}));
  }catch(error){m.error=error.message;}finally{m.busy=false;paint(m);}return success;
 }
 async function refresh(){
  const m=mounted;if(!m||!isCurrent(m)||m.busy)return;
  const token=++epoch;
  try{const [record,options]=await Promise.all([readRecord(m.parentStudyId),m.loadOptions({parentStudyId:m.parentStudyId,fresh:false})]);if(token!==epoch||!isCurrent(m))return;if(m.bindingId&&(record.scope?.kind!=='project'||record.scope.parentStudyId!==m.parentStudyId))throw Error('Saved direction belongs to another subject.');if(!options?.source||!Array.isArray(options.angles)||!Array.isArray(options.titles))throw Error('No current prepared directions are available.');m.record=record;m.options=options;m.error='';}catch(error){if(token!==epoch||!isCurrent(m))return;m.error=error.message;}paint(m);return !!m.options&&!m.error;
 }
 function mount({container,parentStudyId,bindingId=null,loadOptions,canMutate=false,isCurrent:current=()=>true}){
  if(!container||!parentStudyId||typeof loadOptions!=='function')throw Error('Choose a project and prepared direction connection.');
  if(mounted?.container===container&&mounted.parentStudyId===parentStudyId){mounted.loadOptions=loadOptions;mounted.bindingId=bindingId;mounted.canMutate=canMutate;mounted.isCurrent=current;return refresh();}
  mounted={container,parentStudyId,bindingId,loadOptions,canMutate,isCurrent:current,busy:false,error:'',message:''};paint(mounted);return refresh();
 }
 const onChange=event=>{if(event.detail?.parentStudyId===mounted?.parentStudyId&&!mounted.busy)void refresh();};
 win.addEventListener('study-human-direction-change',onChange);
 const onNotesState=()=>{if(mounted&&!mounted.busy&&isCurrent(mounted))paint(mounted);};
 win.addEventListener('study-direction-plan-state',onNotesState);
 return {mount,refresh,readFor,decide:input=>{if(!mounted||!isCurrent(mounted))return Promise.reject(Error('Open the current Direction first.'));return save(mounted,input);},unmount(){mounted=null;++epoch;},destroy(){mounted=null;++epoch;win.removeEventListener('study-human-direction-change',onChange);win.removeEventListener('study-direction-plan-state',onNotesState);}};
}
if(typeof window!=='undefined'){
 window.directionChoiceCodec={readDirectionChoices,stripDirectionChoices};
 window.inlineDirectionChoices=createInlineDirectionChoices({window});
 window.dispatchEvent(new CustomEvent('study-inline-direction-ready'));
}
