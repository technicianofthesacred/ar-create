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
export function createDirectionPieceGrid({document:doc,pieces=[],open}){
 const grid=doc.createElement('section');grid.className='direction-piece-grid';grid.setAttribute('aria-label','Direction and your pieces');
 const heading=doc.createElement('h3');heading.textContent='Which decisions go into each piece';grid.append(heading);
 const help=doc.createElement('p');help.textContent='Saved subject choices are available to each piece. Existing words and piece-specific decisions stay independent; application has not been checked here.';grid.append(help);
 if(!pieces.length){const empty=doc.createElement('p');empty.textContent='No current connected pieces are available in this subject.';grid.append(empty);return grid;}
 const list=doc.createElement('ul');for(const piece of pieces){const row=doc.createElement('li'),button=doc.createElement('button'),label=({'Manuscript':'Article','Product listing':'Listing'}[piece.format]||piece.format||'Piece');button.type='button';button.textContent=label+' · '+piece.title;button.addEventListener('click',()=>open(piece.reference,button));const state=doc.createElement('span');state.textContent='Shared direction · piece overrides not checked';row.append(button,state);list.append(row);}grid.append(list);return grid;
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
 const loadOptions=createPreparedDirectionReader({catalog:()=>window.existingWork?.catalog?.(),refresh:async()=>{if(!await window.existingWork?.load?.())throw Error('The prepared map could not refresh.');},request:(...args)=>fetch(...args),hash,isCurrent:id=>stage()===4&&currentId()===id});
 function decorate(){
  const workspace=document.getElementById('workspace'),lane=workspace?.querySelector('#stage-working-lane'),ui=window.inlineDirectionChoices;
  if(stage()!==4||!lane||!ui){if(mounted&&!mounted.host.isConnected){ui?.unmount();mounted=null;}return;}
  showDirectionRecords(workspace);
  const continuation=workspace.querySelector('#study-source-continuation');if(!continuation?.querySelector('.source-continuation'))return;
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
  mounted={host,id:currentId()};const snapshot=mounted;
  void (async()=>{try{const result=await window.workbenchPieces?.listForProject?.(snapshot.id);if(mounted!==snapshot||!layout.isConnected||currentId()!==snapshot.id||stage()!==4)return;layout.querySelector('.direction-piece-grid')?.remove();const pieces=result?.projectId===snapshot.id?result.pieces.filter(p=>p.projectId===snapshot.id&&p.editionRole==='current'&&p.reference):[];layout.append(createDirectionPieceGrid({document,pieces,open:async(reference,button)=>{if(mounted!==snapshot||currentId()!==snapshot.id)return;if(window.studyHumanDirection?.isDirty?.({parentStudyId:snapshot.id})){button.textContent='Save or compare your direction first';return;}button.disabled=true;try{if(await window.workbenchPieces.openReference(reference,{mode:'read'})===false)throw Error('This piece could not open.');}catch(error){let message=layout.querySelector('[data-direction-piece-error]');if(!message){message=document.createElement('p');message.dataset.directionPieceError='';message.setAttribute('role','alert');layout.append(message);}message.textContent=error.message;}finally{button.disabled=false;}}}));}catch{if(mounted===snapshot){const error=document.createElement('p');error.textContent='Current pieces could not load. Use Board to open their existing records.';layout.append(error);}}})();
  void ui.mount({container:host,parentStudyId:snapshot.id,loadOptions,canMutate:()=>window.arCreateUiActor?.actor==='human:adrian',isCurrent:()=>mounted===snapshot&&host.isConnected&&stage()===4&&currentId()===snapshot.id}).then(ready=>{if(mounted===snapshot&&host.isConnected)workspace.classList.toggle('combined-direction-ready',ready===true);});
 }
 window.directionChoiceSurface={decorate};
 window.addEventListener('study-inline-direction-ready',decorate);
 window.c3Shell?.register('inline Direction owner layout',decorate,{order:98,ignore:'.combined-direction-layout'});
 decorate();
}
