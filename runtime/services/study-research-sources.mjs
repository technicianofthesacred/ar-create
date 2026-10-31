import {StateError} from '../store.mjs';
/** Join existing source identities to an exact native subject; never import or activate. */
export function createStudyResearchSources({drafts,library,firstFlow,conceptWork}){
 return async function resolve(binding,scope){
  const before=await drafts.read(binding);if(before.binding?.id!==binding.bindingId||before.binding.parentStudyId!==binding.parentStudyId||before.binding.status!=='ready'||before.readiness?.ready!==true)throw new StateError('Choose this ready native subject before research.',409);
  const captured=(before.context?.records||[]).filter(r=>!r.missing&&['source','context','transcript','raw'].includes(r.role)),tree=await library.tree(),allowed=new Map();
  for(const record of captured){const matches=(tree.sources||[]).filter(s=>!s.missing&&!s.sourceUnavailable&&s.rel_path===record.sourcePath&&s.hash===record.copiedHash&&s.originalReferences?.some(r=>r.path===record.sourcePath));if(matches.length>1)throw new StateError('The retained source has more than one Library identity.',409);if(matches.length===1)allowed.set(matches[0].id,record.copiedHash);}
  if(firstFlow?.materialContext){const material=await firstFlow.materialContext({projectId:scope.parent.projectId});for(const r of material.records||[])if(r.eligible)allowed.set(r.id,r.hash);}
  if(conceptWork?.read){try{const concept=await conceptWork.read({parentStudyId:binding.parentStudyId});for(const r of concept.sourceSelections||[]){const connection=concept.sourceConnections?.find(s=>s.sourceId===r.sourceId&&s.sourceHash===r.sourceHash);if(connection&&!connection.stale&&!connection.unavailable)allowed.set(r.sourceId,r.sourceHash);}}catch(error){if(error.status!==404)throw error;}}
  const after=await drafts.read(binding);if(after.binding?.id!==before.binding.id||after.binding.parentStudyId!==before.binding.parentStudyId||JSON.stringify(after.context)!==JSON.stringify(before.context))throw new StateError('Native source ownership changed during research.',409);
  return [...allowed].map(([id,hash])=>({id,hash}));
 };
}
