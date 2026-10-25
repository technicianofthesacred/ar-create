/* Read-only Media projection. Supplied references remain owned by their maintained readers. */
(()=>{
 'use strict';
 const hash=/^[a-f0-9]{64}$/,text=v=>typeof v==='string'&&v.length>0;
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 const copy=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
 function ref(v){if(!v||!['rootId','sourceId','relativePath'].every(k=>text(v[k]))||!hash.test(v.hash||'')||(/^(?:[a-z]:|[\\/])/i).test(v.relativePath)||v.relativePath.split(/[\\/]/).includes('..'))throw Error('The photograph needs its exact original reference.');return copy(v,['rootId','sourceId','relativePath','hash']);}
 function owner(v){if(v==null)return null;if(!['projectId','pieceId','editionId','artifactId'].every(k=>text(v[k]))||!hash.test(v.hash||''))throw Error('The photograph owner needs its exact piece and edition.');return copy(v,['projectId','pieceId','editionId','artifactId','hash','rootBindingId','parentStudyId']);}
 function previewURL(row){
  if(row.missing||row.available===false||row.previewUnavailable||!row.url||!row.previewScope)return null;
  if(row.previewKind==='magazine-publication'){
   const expected={...copy(row.previewScope,['storyId','pieceId','expectedHash','revision']),sourceId:row.id,sourceHash:row.hash};
   if(Object.keys(expected).length!==6||!Object.values(expected).every(text)||!hash.test(expected.expectedHash)||!hash.test(expected.sourceHash)||!hash.test(expected.revision)||!row.url.startsWith('/api/review/magazine-media/file?'))return null;
   try{const u=new URL(row.url,'http://media.invalid');if(u.origin!=='http://media.invalid'||u.pathname!=='/api/review/magazine-media/file'||u.hash||[...u.searchParams.keys()].some(k=>!Object.hasOwn(expected,k))||Object.entries(expected).some(([k,v])=>u.searchParams.getAll(k).length!==1||u.searchParams.get(k)!==v))return null;return u.pathname+u.search;}catch{return null;}
  }
  const expected={...copy(row.previewScope,['projectId','documentId','bindingId','parentStudyId']),sourceId:row.id,expectedHash:row.hash};
  if(Object.keys(expected).length!==6||!Object.values(expected).every(text)||!row.url.startsWith('/api/study/photos/preview?'))return null;
  try{const u=new URL(row.url,'http://media.invalid');if(u.origin!=='http://media.invalid'||u.pathname!=='/api/study/photos/preview'||u.hash||[...u.searchParams.keys()].some(k=>!Object.hasOwn(expected,k))||Object.entries(expected).some(([k,v])=>u.searchParams.getAll(k).length!==1||u.searchParams.get(k)!==v))return null;return u.pathname+u.search;}catch{return null;}
 }
 function project({scope,revision,sources,currentOwnerRef=null}={}){
  const currentOwner=owner(currentOwnerRef);
  if(!hash.test(scope||'')||!hash.test(revision||'')||!Array.isArray(sources)||sources.length>10000)throw Error('The Media list needs a confirmed scope and revision.');
  const seen=new Set(),rows=sources.map(raw=>{
   const source=ref(raw.sourceRef);if(raw.id!==source.sourceId||seen.has(raw.id))throw Error('Conflicting photograph identities need review.');seen.add(raw.id);
   const own=owner(raw.ownerRef),row={...copy(raw,['id','title','name','modifiedAt','missing','available','previewUnavailable','caption','credit','selected','url','previewKind']),kind:'image',rel_path:source.relativePath,hash:source.hash,sha256:source.hash,sourceRef:source,ownerRef:own,ownerMismatch:!!(own&&currentOwner&&JSON.stringify(own)!==JSON.stringify(currentOwner)),previewScope:raw.previewScope?copy(raw.previewScope,raw.previewKind==='magazine-publication'?['storyId','pieceId','expectedHash','revision']:['projectId','documentId','bindingId','parentStudyId']):null};
   if(row.previewKind==='magazine-publication'&&(!own||own.editionId!=='working'||row.previewScope?.storyId!==own.projectId||row.previewScope?.pieceId!==own.pieceId||row.previewScope?.expectedHash!==own.hash||row.previewScope?.revision!==revision))throw Error('The publication photograph belongs to a different exact working edition.');
   if(row.previewScope&&row.previewKind!=='magazine-publication'&&(!own||row.previewScope.projectId!==own.projectId||row.previewScope.documentId!==own.pieceId||row.previewScope.bindingId!==own.rootBindingId||row.previewScope.parentStudyId!==own.parentStudyId))throw Error('The preview belongs to a different photograph owner.');
   row.url=previewURL(row);if(raw.placements!==undefined&&(!Array.isArray(raw.placements)||raw.placements.length>1000))throw Error('Saved placement references need review.');row.placements=(raw.placements||[]).map(p=>{if(!own||!['placementId','outputId','editionId','projectId','pieceId'].every(k=>text(p[k]))||p.projectId!==own.projectId||p.pieceId!==own.pieceId||!hash.test(p.hash||'')||JSON.stringify(ref(p.sourceRef))!==JSON.stringify(source))throw Error('Saved placement evidence does not match this original.');return {...copy(p,['placementId','outputId','editionId','projectId','pieceId','hash','label','caption','credit']),sourceRef:source,crop:p.crop===undefined?null:JSON.parse(JSON.stringify(p.crop))};});if(new Set(row.placements.map(p=>p.placementId)).size!==row.placements.length)throw Error('Conflicting saved placement references need review.');return row;
  });return freeze({scope,revision,currentOwnerRef:currentOwner,data:{schema:'ar-create.library-folders.v1',domain:'media',readOnly:true,revision,indexHash:revision,folders:[],sources:rows}});
 }
 function descriptor(projection,id,state={}){
  if(!projection||state.scope!==projection.scope||state.revision!==projection.revision||state.ready!==true||state.dirty||state.conflict)throw Error('Media changed or has unsaved work. Refresh before opening.');
  if(projection.currentOwnerRef&&JSON.stringify(owner(state.currentOwnerRef))!==JSON.stringify(projection.currentOwnerRef))throw Error('The active photo owner changed. Refresh before opening.');
  const s=projection.data.sources.find(s=>s.id===id);if(!s||s.missing||s.available===false)throw Error('This original is unavailable. Its saved reference is retained.');
  return freeze({scope:projection.scope,revision:projection.revision,sourceRef:s.sourceRef,ownerRef:s.ownerRef,ownerMismatch:s.ownerMismatch});
 }
 function placement(projection,id,placementId,state){const d=descriptor(projection,id,state),p=projection.data.sources.find(s=>s.id===id).placements.find(p=>p.placementId===placementId);if(!p)throw Error('This saved placement is unavailable. Refresh before opening.');return freeze({...d,placement:p});}
 window.arCreateExactMedia=Object.freeze({project,descriptor,placement,previewURL});
})();
