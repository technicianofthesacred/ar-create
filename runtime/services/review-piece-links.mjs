/* Metadata-only projection. Never opens a manuscript, creates a binding or matches a title. */
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const readable=v=>typeof v==='string'&&v.trim()&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);
const ownKey=id=>'owned-draft:'+id;
function roots(catalog){return [...(catalog?.drafts||[]),...(catalog?.collections||[])].filter(r=>r.bindingStatus==='ready'&&UUID.test(r.bindingId||'')&&readable(r.parentStudyId)&&(!r.parentStudyKey||r.parentStudyKey===r.parentStudyId)&&r.kind!=='output-fork');}
function outputs(catalog,nativeRoots){return (catalog?.outputBindings||[]).filter(r=>r.bindingStatus==='ready'&&UUID.test(r.bindingId||'')&&UUID.test(r.outputId||r.canonicalOutputId||'')&&nativeRoots.some(n=>n.bindingId===r.sourceBindingId&&n.parentStudyId===r.parentStudyId));}
/** Fetch only these GET metadata readers; preserve requestedProjectKey with each response. */
export function reviewPieceBindingQueries(catalog={}){
 const nativeRoots=roots(catalog),keys=new Set();
 for(const r of nativeRoots){keys.add(r.parentStudyId);keys.add(ownKey(r.bindingId));}
 for(const r of outputs(catalog,nativeRoots))keys.add(ownKey(r.bindingId));
 return [...keys].sort().map(projectKey=>({projectKey,method:'GET',path:'/api/first-flow/binding?projectKey='+encodeURIComponent(projectKey)}));
}
/**
 * Input: pieces metadata; native draft catalog; bindings metadata rows
 * {requestedProjectKey?, projectKey, projectId, documentId, httpStatus?}.
 * A result proves catalog identity, not manuscript availability, approval or an output edition.
 */
export function resolveReviewPieceLinks({pieces=[],catalog={},bindings=[]}={}){
 if(!Array.isArray(pieces)||!Array.isArray(bindings)||new Set(pieces.map(p=>p.id)).size!==pieces.length||pieces.some(p=>!UUID.test(p.id||'')))throw Error('Use a unique metadata catalog of workspace UUIDs.');
 const nativeRoots=roots(catalog),nativeOutputs=outputs(catalog,nativeRoots),byKey=new Map();
 for(const row of bindings){const key=row.requestedProjectKey||row.projectKey;if(!readable(key))continue;const list=byKey.get(key)||[];list.push(row);byKey.set(key,list);}
 const lookup=key=>{const rows=byKey.get(key)||[];if(rows.length!==1)return {reason:rows.length?'ambiguous-binding-response':'binding-not-resolved'};const r=rows[0];if(r.httpStatus!==undefined&&r.httpStatus!==200)return {reason:'binding-unavailable'};if(r.projectKey!==key||!UUID.test(r.projectId||'')||!UUID.test(r.documentId||''))return {reason:'invalid-binding-identity'};return {row:r};};
 const scopes=[];
 for(const root of nativeRoots){
  const metadata={parentStudyId:root.parentStudyId,rootBindingId:root.bindingId,partKey:root.partKey??null,originalId:root.originalId||root.id||null,originalHash:root.originalHash||null,kind:root.kind||'native-root',cataloguedOutputs:nativeOutputs.filter(o=>o.sourceBindingId===root.bindingId&&o.parentStudyId===root.parentStudyId).map(o=>({outputId:o.outputId||o.canonicalOutputId,bindingId:o.bindingId,sourceBindingId:o.sourceBindingId,kind:o.kind||null}))};
  for(const [role,key]of [['parent-study-workspace',root.parentStudyId],['root-owned-workspace',ownKey(root.bindingId)]])scopes.push({...metadata,role,bindingKey:key,...lookup(key)});
 }
 for(const output of nativeOutputs){if(output.bindingId===output.sourceBindingId)continue;const root=nativeRoots.find(r=>r.bindingId===output.sourceBindingId&&r.parentStudyId===output.parentStudyId),key=ownKey(output.bindingId);scopes.push({parentStudyId:root.parentStudyId,rootBindingId:root.bindingId,partKey:output.partKey??root.partKey??null,originalId:output.originalId||root.originalId||root.id||null,kind:'native-output',outputId:output.outputId||output.canonicalOutputId,outputBindingId:output.bindingId,sourceBindingId:output.sourceBindingId,role:'output-owned-workspace',bindingKey:key,...lookup(key)});}
 return {schema:'ar-create.review-piece-links.v1',basis:'exact-ready-native-catalog-and-saved-project-document-bindings',pieces:pieces.map(piece=>{
  const candidates=scopes.filter(s=>s.row?.projectId===piece.id),targets=[],seen=new Set();
  for(const scope of candidates){if(scope.row.documentId!==piece.documentId)continue;const {row,reason,...target}=scope,key=JSON.stringify([target.role,target.parentStudyId,target.rootBindingId,target.outputId||null]);if(seen.has(key))continue;seen.add(key);targets.push({...target,workspaceId:piece.id,documentId:piece.documentId});}
  const state=targets.length===1?'verified':targets.length>1?'multiple-verified-targets':'unresolved',reason=targets.length?null:!UUID.test(piece.documentId||'')?'no-document-identity':candidates.length?'document-id-mismatch':'no-exact-native-binding';
  return {workspaceId:piece.id,documentId:piece.documentId||null,title:piece.title||'',state,reason,targets,referenceOnly:{available:true,kind:'workspace-metadata',contentReadable:false},provesCurrentEdition:false};
 }),unavailableBindings:scopes.filter(s=>!s.row).map(s=>({bindingKey:s.bindingKey,parentStudyId:s.parentStudyId,rootBindingId:s.rootBindingId,reason:s.reason})),limits:['Workspace and native parent/root identities remain separate.','Several verified targets require an explicit part/output choice.','No manuscript, source, output edition or publication state was read or inferred.']};
}
