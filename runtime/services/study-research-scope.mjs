import {StateError} from '../store.mjs';import {AGENT_ACTORS,currentActor} from './actor.mjs';
/** Resolve existing parent/part registries without selecting a physical project. */
export function createStudyResearchScope({drafts,bindings,resolveSources,validateStandInTarget}){
 return async scope=>{
  if(!scope||Object.keys(scope).sort().join(',')!=='bindingId,documentId,parentStudyId,projectId')throw new StateError('Choose the exact saved native Research scope.',400);
  const target={bindingId:scope.bindingId,parentStudyId:scope.parentStudyId},before=await drafts.read(target);if(before.binding?.id!==scope.bindingId||before.binding.parentStudyId!==scope.parentStudyId||before.readiness?.ready!==true)throw new StateError('The native Research subject changed.',409);
  const parent=await bindings.lookup({projectKey:scope.parentStudyId}),part=await bindings.lookup({projectKey:'owned-draft:'+scope.bindingId});if(parent.projectId!==scope.projectId||parent.documentId!==scope.documentId||parent.projectId===part.projectId)throw new StateError('Research belongs to another saved parent or part.',409);
  const sources=await resolveSources(target,{parent,part});let canStandInReview=false;if(AGENT_ACTORS.includes(currentActor()?.actor)){try{await validateStandInTarget(target);canStandInReview=true;}catch(error){if(![403,404,409].includes(error.status))throw error;}}
  const again=await bindings.lookup({projectKey:scope.parentStudyId}),againPart=await bindings.lookup({projectKey:'owned-draft:'+scope.bindingId});if(JSON.stringify(again)!==JSON.stringify(parent)||JSON.stringify(againPart)!==JSON.stringify(part))throw new StateError('Research owner changed while resolving sources.',409);
  return {projectId:parent.projectId,documentId:parent.documentId,sources,canStandInReview};
 };
}
