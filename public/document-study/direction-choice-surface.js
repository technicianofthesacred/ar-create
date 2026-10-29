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
if(typeof window!=='undefined'){
 let mounted=null;
 const stage=()=>{try{return current().view==='record'&&Number(current().viewedStage);}catch{return 0;}};
 const currentId=()=>{try{return current().id;}catch{return null;}};
 const hash=async raw=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const loadOptions=createPreparedDirectionReader({catalog:()=>window.existingWork?.catalog?.(),refresh:async()=>{if(!await window.existingWork?.load?.())throw Error('The prepared map could not refresh.');},request:(...args)=>fetch(...args),hash,isCurrent:id=>stage()===4&&currentId()===id});
 function decorate(){
  const workspace=document.getElementById('workspace'),lane=workspace?.querySelector('#stage-working-lane'),ui=window.inlineDirectionChoices;
  if(stage()!==4||!lane||!ui){if(mounted&&!mounted.host.isConnected){ui?.unmount();mounted=null;}return;}
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
  void ui.mount({container:host,parentStudyId:snapshot.id,loadOptions,canMutate:()=>window.arCreateUiActor?.actor==='human:adrian',isCurrent:()=>mounted===snapshot&&host.isConnected&&stage()===4&&currentId()===snapshot.id}).then(ready=>{if(mounted===snapshot&&host.isConnected)workspace.classList.toggle('combined-direction-ready',ready===true);});
 }
 window.directionChoiceSurface={decorate};
 window.addEventListener('study-inline-direction-ready',decorate);
 window.c3Shell?.register('inline Direction owner layout',decorate,{order:98,ignore:'.combined-direction-layout'});
 decorate();
}
