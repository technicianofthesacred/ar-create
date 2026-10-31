/* The existing author page and prepared MAP share one inline Direction screen. */
import {parsePreparedDirections} from '../lib/direction-choice.js';
const HASH=/^[a-f0-9]{64}$/i;
export function createPreparedDirectionReader({catalog,refresh,request,hash,isCurrent}){
 return async({parentStudyId,fresh=false})=>{
  if(fresh||!catalog()?.stories?.length)await refresh();if(!isCurrent(parentStudyId))throw Error('The selected subject changed.');
  const value=catalog(),stories=(value?.stories||[]).filter(s=>s.nativeProjectId===parentStudyId||s.id===parentStudyId);
  if(stories.length!==1)throw Error('The prepared map is not connected to this subject.');
  const maps=stories[0].artifacts.filter(a=>String(a.kind).toUpperCase()==='MAP'&&!a.archived);
  if(maps.length!==1||!HASH.test(maps[0].hash||''))throw Error('Choose one current prepared map before making a choice.');
  const source={artifactId:maps[0].artifactId,hash:maps[0].hash},response=await request('/api/review/artifact?'+new URLSearchParams({id:source.artifactId,hash:source.hash})),read=await response.json();
  if(!response.ok||typeof read.raw!=='string')throw Error(read.error||'The current prepared map could not be read.');
  if(await hash(read.raw)!==source.hash)throw Error('The prepared map changed. Reopen Direction before choosing.');
  const current=catalog()?.stories?.filter(s=>(s.nativeProjectId===parentStudyId||s.id===parentStudyId)&&s.id===stories[0].id),currentMaps=current?.length===1?current[0].artifacts.filter(a=>String(a.kind).toUpperCase()==='MAP'&&!a.archived):[];
  if(!isCurrent(parentStudyId)||current?.length!==1||currentMaps.length!==1||currentMaps[0].artifactId!==source.artifactId||currentMaps[0].hash!==source.hash)throw Error('The prepared map or selected subject changed.');
  const options=parsePreparedDirections(read.raw,source);if(!options.angles.length||!options.titles.length)throw Error('The prepared map has no supported angle and title list.');return options;
 };
}
export function createDirectionPieceGrid({document:doc,projectId,pieces=[],context=null,open,options=null,onDecision,drafts=new Map()}){
 const targetKey=t=>t?.kind==='native'&&t.bindingId?'native:'+t.bindingId:t?.kind==='output'&&t.outputId?'output:'+t.outputId:null,seenTargets=new Set();pieces=pieces.filter(piece=>{const key=targetKey(piece.directionTarget);if(!key)return true;if(seenTargets.has(key))return false;seenTargets.add(key);return true;});
 const grid=doc.createElement('section');grid.className='direction-piece-grid';grid.setAttribute('aria-label','Direction and your pieces');
 const heading=doc.createElement('h3');heading.textContent='Which decisions go into each piece';grid.append(heading);
 if(!pieces.length){const empty=doc.createElement('p');empty.textContent='No current connected pieces are available in this subject.';grid.append(empty);return grid;}
 const table=doc.createElement('table'),caption=doc.createElement('caption');caption.textContent='Shared subject direction · piece wording stays independent';table.append(caption);
 const head=table.createTHead().insertRow();head.append(doc.createElement('td'));
 const labels=pieces.map(piece=>({'Manuscript':'Article','Product listing':'Listing'}[piece.format]||piece.format||'Piece'));
 for(const [i,piece]of pieces.entries()){const cell=doc.createElement('th'),button=doc.createElement('button');cell.scope='col';button.type='button';button.textContent=labels[i]+' · '+piece.title;button.addEventListener('click',()=>open(piece.reference,button));cell.append(button);head.append(cell);}
 const valid=context&&context.available!==false&&typeof projectId==='string'&&context.parentStudyId===projectId;
 const connected=valid&&options?.canDecide===true&&typeof onDecision==='function',key=t=>t?.kind==='native'&&t.bindingId?'native:'+t.bindingId:t?.kind==='output'&&t.outputId?'output:'+t.outputId:null;
 const counts=new Map();for(const p of pieces){const k=key(p.directionTarget);if(k)counts.set(k,(counts.get(k)||0)+1);}
 const body=table.createTBody();for(const kind of ['angle','title']){const row=body.insertRow(),name=doc.createElement('th');name.scope='row';name.textContent=kind==='angle'?'Angle':'Title';row.append(name);
  for(const piece of pieces){const cell=row.insertCell();cell.dataset.piece=({'Manuscript':'Article'}[piece.format]||piece.format||'Piece');const target=piece.directionTarget,k=key(target),local=k?context?.pieceDecisions?.[k]?.[kind]:null,subject=kind==='angle'?context?.selectedAngle:context?.selectedTitle,mode=local?.action||'inherit',needsReview=local?.action==='inherit'&&local.basis?.subjectOperationId!==(subject?.operationId||null),choice=needsReview?null:mode==='use'?local:mode==='inherit'?subject:null;
   const summary=doc.createElement('p');summary.textContent=!valid?'Not connected':needsReview?'Review needed · subject changed':mode==='not-applicable'?'Not applicable':mode==='reject'?'No choice · rejected':(choice?.text||'Not chosen')+(connected&&k?' · '+(mode==='use'?'This piece':'Inherited'):'');cell.append(summary);
   if(!connected||!k||counts.get(k)!==1)continue;
   const draftKey=k+':'+kind+':'+options.source.artifactId+':'+options.source.hash;let d=drafts.get(draftKey);if(!d){d={optionId:mode==='use'?local.optionId:'',text:mode==='use'?local.text:'',reason:''};drafts.set(draftKey,d);}
   const select=doc.createElement('select');select.setAttribute('aria-label',piece.title+' '+kind+' option');const placeholder=doc.createElement('option');placeholder.value='';placeholder.textContent='Choose '+kind;select.append(placeholder);for(const option of kind==='angle'?options.angles:options.titles){const o=doc.createElement('option');o.value=option.id;o.textContent=option.text;select.append(o);}select.value=d.optionId;
   const words=doc.createElement('input');words.value=d.text;words.maxLength=2048;words.setAttribute('aria-label',piece.title+' '+kind+' wording');words.addEventListener('input',()=>d.text=words.value);
   const reason=doc.createElement('input');reason.value=d.reason;reason.maxLength=2048;reason.placeholder='Reason';reason.setAttribute('aria-label',piece.title+' '+kind+' reason');reason.addEventListener('input',()=>d.reason=reason.value);
   select.addEventListener('change',()=>{d.optionId=select.value;const o=(kind==='angle'?options.angles:options.titles).find(o=>o.id===select.value);d.text=o?.text||'';words.value=d.text;});cell.append(select,words,reason);
   const actions=doc.createElement('div');actions.className='direction-piece-actions';const status=doc.createElement('span');status.setAttribute('role','status');
   for(const [action,label]of [['use','Use'],['reject','Not this'],['inherit','Inherit subject'],['not-applicable','Not applicable']]){const button=doc.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',async()=>{for(const control of grid.querySelectorAll('button,input,select'))control.disabled=true;status.textContent='Saving…';try{const ok=await onDecision({target,kind,action,optionId:d.optionId,text:d.text,reason:d.reason});status.textContent=ok===false?'Choice not saved':'Choice saved';}catch(error){status.textContent=error.message;}finally{for(const control of grid.querySelectorAll('button,input,select'))control.disabled=false;}});actions.append(button);}cell.append(actions,status);
   if(local?.actor){const actor=doc.createElement('small');actor.textContent=local.actor+(local.decisionRole==='stand-in'?' · stand-in':'');cell.append(actor);}
  }
 }
 if(!connected){const row=body.insertRow(),name=doc.createElement('th');name.textContent='Piece overrides';row.append(name);for(const piece of pieces)row.insertCell().textContent='Not connected';}
 grid.append(table);return grid;
}
export function showDirectionRecords(workspace){
 for(const details of workspace.querySelectorAll('details.flow-retained,details.recordDetails')){
  const section=workspace.ownerDocument.createElement('section');for(const attr of details.attributes)if(attr.name!=='open')section.setAttribute(attr.name,attr.value);
  for(const child of [...details.childNodes]){if(child.nodeType===1&&child.tagName==='SUMMARY'){const heading=workspace.ownerDocument.createElement(details.classList.contains('recordDetails')?'h4':'h3');heading.textContent=details.classList.contains('recordDetails')?'Original record':child.textContent;section.append(heading);}else section.append(child);}
  details.replaceWith(section);
 }
}
if(typeof window!=='undefined'){
 let mounted=null;
 const stage=()=>{try{return current().view==='record'&&Number(current().viewedStage);}catch{return 0;}};
 const currentId=()=>{try{return current().id;}catch{return null;}};
 const hash=async raw=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const legacyOptions=createPreparedDirectionReader({catalog:()=>window.existingWork?.catalog?.(),refresh:async()=>{if(!await window.existingWork?.load?.())throw Error('The prepared map could not refresh.');},request:(...args)=>fetch(...args),hash,isCurrent:id=>stage()===4&&currentId()===id});
 const bindingFor=id=>{const b=window.studyDraft?.currentBinding?.();return b?.parentStudyId===id&&b.id?b:null;};
 const loadOptions=async args=>{const b=bindingFor(args.parentStudyId);if(!b)return legacyOptions(args);const response=await fetch('/api/study/direction-options?'+new URLSearchParams({bindingId:b.id,parentStudyId:args.parentStudyId}),{cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.error||'Directions unavailable');if(currentId()!==args.parentStudyId||bindingFor(args.parentStudyId)?.id!==b.id||value.bindingId!==b.id||value.parentStudyId!==args.parentStudyId||!HASH.test(value.source?.hash||'')||!Array.isArray(value.angles)||!Array.isArray(value.titles))throw Error('Direction scope changed.');return value;};
 async function refreshGrid(snapshot){const layout=snapshot.layout;
const token=++snapshot.gridEpoch;try{const [result,context,options]=await Promise.all([window.workbenchPieces?.listForProject?.(snapshot.id),window.directionChoiceContext?.read?.(snapshot.id).catch(()=>null),loadOptions({parentStudyId:snapshot.id}).catch(()=>null)]);if(mounted!==snapshot||token!==snapshot.gridEpoch||!layout.isConnected||currentId()!==snapshot.id||stage()!==4)return;layout.querySelector('.direction-piece-grid')?.remove();const pieces=result?.projectId===snapshot.id?result.pieces.filter(p=>p.projectId===snapshot.id&&p.editionRole==='current'&&p.reference):[];layout.append(createDirectionPieceGrid({document,projectId:snapshot.id,pieces,context,options,drafts:snapshot.drafts,onDecision:input=>window.inlineDirectionChoices.decide(input),open:async(reference,button)=>{if(mounted!==snapshot||currentId()!==snapshot.id)return;if(window.studyHumanDirection?.isDirty?.({parentStudyId:snapshot.id})){button.textContent='Save or compare your direction first';return;}button.disabled=true;try{if(await window.workbenchPieces.openReference(reference,{mode:'read'})===false)throw Error('This piece could not open.');}catch(error){let message=layout.querySelector('[data-direction-piece-error]');if(!message){message=document.createElement('p');message.dataset.directionPieceError='';message.setAttribute('role','alert');layout.append(message);}message.textContent=error.message;}finally{button.disabled=false;}}}));}catch{if(mounted===snapshot&&token===snapshot.gridEpoch&&layout.isConnected&&stage()===4&&currentId()===snapshot.id){const error=document.createElement('p');error.textContent='Current pieces could not load. Use Board to open their existing records.';layout.append(error);}}}
 function decorate(){
  const workspace=document.getElementById('workspace'),lane=workspace?.querySelector('#stage-working-lane'),ui=window.inlineDirectionChoices;
  if(stage()!==4||!lane||!ui){if(mounted&&!mounted.host.isConnected){ui?.unmount();mounted=null;}return;}
  showDirectionRecords(workspace);
  let continuation=workspace.querySelector('#study-source-continuation');if(!continuation?.querySelector('.source-continuation')){window.studySourceContinuation?.mount?.();continuation=workspace.querySelector('#study-source-continuation');}if(!continuation?.querySelector('.source-continuation'))return;
  workspace.classList.add('combined-direction');
  let layout=lane.querySelector(':scope>.combined-direction-layout');
  if(!layout){layout=document.createElement('section');layout.className='combined-direction-layout';layout.setAttribute('aria-label','Your thoughts and direction');const left=document.createElement('section');left.className='combined-direction-author';const title=document.createElement('h2');title.textContent='Your page';left.append(title);layout.append(left);lane.prepend(layout);}
  const left=layout.querySelector('.combined-direction-author');if(continuation.parentElement!==left)left.append(continuation);
  let host=layout.querySelector('#inline-direction-choices');if(!host){host=document.createElement('section');host.id='inline-direction-choices';layout.append(host);}
  // Retain the original map entrance, including all dated decisions, separately.
  let original=left.querySelector('[data-direction-original-map]');
  if(!original){original=document.createElement('button');original.type='button';original.dataset.directionOriginalMap='';original.textContent='Original map and earlier decisions';original.onclick=()=>{const stories=window.existingWork?.catalog?.()?.stories?.filter(s=>s.nativeProjectId===currentId()),maps=stories?.length===1?stories[0].artifacts.filter(a=>a.kind==='MAP'&&!a.archived):[];if(maps.length===1)void window.existingWork.openArtifact(stories[0].id,maps[0].artifactId);};left.append(original);}
  if(!left.querySelector('[data-direction-source-context]')){const sources=document.createElement('button');sources.type='button';sources.dataset.directionSourceContext='';sources.textContent='Research and source context';sources.onclick=()=>viewPhase(3);left.append(sources);}
  if(mounted?.host===host&&mounted.id===currentId())return;
  mounted={host,id:currentId(),layout,gridEpoch:0,drafts:new Map()};const snapshot=mounted;
  void refreshGrid(snapshot);
  void ui.mount({container:host,parentStudyId:snapshot.id,bindingId:bindingFor(snapshot.id)?.id,loadOptions,canMutate:()=>window.arCreateUiActor?.actor==='human:adrian',isCurrent:()=>mounted===snapshot&&host.isConnected&&stage()===4&&currentId()===snapshot.id}).then(ready=>{if(mounted===snapshot&&host.isConnected){workspace.classList.toggle('combined-direction-ready',ready===true);window.c3Empty?.decorate?.();}});
 }
 window.directionChoiceSurface={decorate};
 window.addEventListener('study-inline-direction-ready',decorate);
 for(const name of ['study-direction-choice-change','study-human-direction-change'])window.addEventListener(name,event=>{const snapshot=mounted;if(!snapshot||stage()!==4||currentId()!==snapshot.id||event.detail?.parentStudyId&&event.detail.parentStudyId!==snapshot.id||snapshot.refreshQueued)return;snapshot.refreshQueued=true;queueMicrotask(()=>{snapshot.refreshQueued=false;if(mounted===snapshot&&stage()===4&&currentId()===snapshot.id)void refreshGrid(snapshot);});});
 window.c3Shell?.register('inline Direction owner layout',decorate,{order:98,ignore:'.combined-direction-layout'});
 decorate();
}
