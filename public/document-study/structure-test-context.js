/* Read-only provenance for an explicitly registered structure-test copy. */
const HASH=/^[a-f0-9]{64}$/i;
const ACTOR='agent:codex';
export function validStructureTest(value,parentStudyId){
 return !!value&&value.schema==='ar-create.structure-test.v1'&&value.parentStudyId===parentStudyId&&value.role==='structure-test'&&value.createdBy===ACTOR&&value.status==='ready'&&typeof value.title==='string'&&!!value.title.trim()&&typeof value.bindingId==='string'&&!!value.bindingId&&value.source?.parentStudyId!==parentStudyId&&typeof value.source?.parentStudyId==='string'&&!!value.source.parentStudyId&&typeof value.source.bindingId==='string'&&!!value.source.bindingId&&HASH.test(value.source.draftHash||'')&&HASH.test(value.source.captureHash||'')&&value.decisions?.role==='stand-in'&&value.decisions.actor===ACTOR;
}
export function createStructureTestContext({window:win,current=()=>win.current?.(),fetch:request=(...args)=>win.fetch(...args)}={}){
 const doc=win.document,rooms=new Map();let disposed=false,epoch=0;
 const snapshot=()=>{const p=current(),binding=win.studyDraft?.currentBinding?.(),selection=win.studyOutputConnection?.selection?.();return {p,key:JSON.stringify([p?.id,p?.viewedStage,p?.view,binding?.id,selection?.projectId,selection?.output?.id])};};
 const known=id=>typeof id==='string'&&id.startsWith('structure-test-')&&id.length>'structure-test-'.length;
 function read(id){
  if(!known(id))return Promise.reject(Error('Choose a registered structure test.'));
  if(rooms.has(id))return rooms.get(id).pending;
  const room={abort:new win.AbortController(),settled:false};rooms.set(id,room);
  room.pending=(async()=>{try{const response=await request('/api/study/structure-tests?'+new URLSearchParams({parentStudyId:id}),{method:'GET',cache:'no-store',signal:room.abort.signal});if(response.status===404)return null;if(!response.ok)throw Error('Structure test not connected.');const value=await response.json();if(room.abort.signal.aborted||rooms.get(id)!==room)throw Error('Structure test changed.');if(!validStructureTest(value,id))throw Error('Structure test provenance could not be confirmed.');return value;}finally{room.settled=true;}})();
  return room.pending;
 }
 async function decorate(){
  if(disposed)return;const selected=snapshot(),ticket=++epoch,id=selected.p?.id;
  for(const [key,room]of rooms)if(key!==id&&!room.settled){room.abort.abort();rooms.delete(key);}
  let host=doc.querySelector('[data-structure-test-context]');
  const parent=doc.getElementById('workspace');
  if(!known(id)||!parent||doc.body.dataset.wbfHome==='bench'){host?.remove();return;}
  if(!host||host.parentElement!==parent){host?.remove();host=doc.createElement('aside');host.className='structure-test-context';host.dataset.structureTestContext='';host.setAttribute('aria-label','Structure test provenance');parent.prepend(host);}
  if(host.dataset.selection!==selected.key){host.dataset.selection=selected.key;host.textContent='Structure test · checking provenance';}
  const active=()=>!disposed&&ticket===epoch&&snapshot().key===selected.key&&host.isConnected;
  try{const value=await read(id);if(!active())return;if(!value){host.remove();return;}host.textContent='Structure test · stand-in choices · '+value.decisions.actor;host.dataset.parentStudyId=id;host.dataset.bindingId=value.bindingId;host.dataset.sourceParentStudyId=value.source.parentStudyId;host.dataset.sourceDraftHash=value.source.draftHash;host.dataset.sourceCaptureHash=value.source.captureHash;const ready=doc.createElement('span');ready.className='structure-test-ready';ready.textContent='Source retained · ready';host.append(ready);}catch{if(active())host.textContent='Structure test · provenance not connected';}
 }
 function dispose(){disposed=true;epoch++;for(const room of rooms.values())room.abort.abort();rooms.clear();doc.querySelector('[data-structure-test-context]')?.remove();}
 return {read,decorate,dispose};
}
if(typeof window!=='undefined'){
 window.structureTestContext=createStructureTestContext({window,current:()=>typeof current==='function'?current():null});
 window.c3Shell?.register('Structure test provenance',()=>void window.structureTestContext.decorate(),{order:140,ignore:'[data-structure-test-context]'});
 for(const name of ['study-output-selection','study-draft-change'])window.addEventListener(name,()=>void window.structureTestContext.decorate());
 void window.structureTestContext.decorate();
}
