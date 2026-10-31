import {createStudyResearchScope} from './study-research-scope.mjs';
import {digest} from './files.mjs';
/** Reuse saved native/parent/part bindings and FirstFlow material membership. */
export function createStudyFootageScope({drafts,bindings,firstFlow,structureTests}){
 const resolve=createStudyResearchScope({drafts,bindings,resolveSources:async(target,{parent})=>{
  const material=await firstFlow.materialContext({projectId:parent.projectId});
  return material.records.map(row=>({id:row.id}));
 },validateStandInTarget:input=>structureTests.validateTarget(input)});
 return async input=>{
  const parent=await bindings.lookup({projectKey:input.parentStudyId}),part=await bindings.lookup({projectKey:'owned-draft:'+input.bindingId});
  const checked=await resolve({...input,projectId:parent.projectId,documentId:parent.documentId});
  return {...input,projectId:checked.projectId,documentId:checked.documentId,sourceIds:checked.sources.map(row=>row.id),canStandInReview:checked.canStandInReview,fingerprint:digest(JSON.stringify({bindingId:input.bindingId,parentStudyId:input.parentStudyId,parent:{projectId:parent.projectId,documentId:parent.documentId},part:{projectId:part.projectId,documentId:part.documentId}}))};
 };
}
