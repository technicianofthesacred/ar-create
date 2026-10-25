/* Exact catalog metadata only. A registered draft does not imply a linked transcript. */
(()=>{
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 function resolve({catalog,ownerCatalog,snapshot}={}){
  const fail=()=>{throw Error('The saved Magazine part changed or its exact registration is unavailable. Refresh before checking.');};
  const owner=snapshot?.owner,proof=snapshot?.proof,links=catalog?.magazineWorkingLinks,root=links?.rootIdentity;
  if(!owner||owner.kind!=='magazine'||proof?.owner?.kind!=='magazine'||proof.owner.storyId!==owner.storyId||proof.owner.pieceId!==owner.pieceId||proof.parentStudyId!==snapshot.parentStudyId||!hash(proof.draftHash)||proof.expected?.workflow?.draft!==proof.draftHash||!hash(catalog?.revision)||links?.state!=='available'||root?.scheme!=='canonical-directory-sha256-v1'||!hash(root.fingerprint))return fail();
  if(ownerCatalog?.schema!=='ar-create.magazine-working-catalog.v1'||ownerCatalog.configured!==true||ownerCatalog.registered!==true||ownerCatalog.rootIdentity?.scheme!==root.scheme||ownerCatalog.rootIdentity?.fingerprint!==root.fingerprint||!Array.isArray(ownerCatalog.stories))return fail();
  const claims=(catalog.stories||[]).flatMap(story=>(story.artifacts||[]).filter(a=>a.magazineWorkingTarget?.storyId===owner.storyId&&a.magazineWorkingTarget?.pieceId===owner.pieceId).map(artifact=>({story,artifact})));
  if(claims.length!==1)return fail();const {story,artifact}=claims[0],target=artifact.magazineWorkingTarget;
  if(story.nativeProjectId!==snapshot.parentStudyId||target.nativeProjectId!==snapshot.parentStudyId||target.kind!=='magazine'||target.edition!=='working'||target.partKey!==owner.partKey||target.artifactId!==artifact.artifactId||target.hash!==artifact.hash||artifact.kind!=='DEV'||artifact.archived||artifact.relativePath!==owner.path||artifact.hash!==proof.draftHash)return fail();
  const owners=ownerCatalog.stories.filter(s=>s.storyId===owner.storyId);if(owners.length!==1||owners[0].archived!==false||!Array.isArray(owners[0].pieces))return fail();
  const registered=owners[0],pieces=registered.pieces.filter(p=>p.pieceId===owner.pieceId),pathClaims=ownerCatalog.stories.flatMap(s=>s.pieces||[]).filter(p=>p.relativePath===owner.path);
  if(pieces.length!==1||pathClaims.length!==1)return fail();const piece=pieces[0];
  if(!['article','article-part'].includes(piece.kind)||piece.relativePath!==owner.path||piece.hash!==proof.draftHash||(piece.part||'article')!==owner.partKey)return fail();
  return {rootIdentity:{...root},catalogRevision:catalog.revision,target:{...target},artifact:{artifactId:artifact.artifactId,hash:artifact.hash,kind:artifact.kind,relativePath:artifact.relativePath},story:{storyId:registered.storyId,name:owner.title||story.name,archived:false,pieces:[{pieceId:piece.pieceId,kind:piece.kind,rel:piece.relativePath,part:piece.part}],vaultRecords:{draft:[{rel:piece.relativePath,currentHash:piece.hash}],src:[],context:[]}},pieceInputs:null};
 }
 window.resolveMagazineCheckRegistration=resolve;
})();
