import {createHash} from 'node:crypto';
import {approvalMarks} from '../src/workspaces/editorial-state.mjs';
import {StateError} from '../store.mjs';
import {AGENT_ACTORS,currentActor} from './actor.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const fail=(message,status=409)=>{throw new StateError(message,status);};
const operation=(id,name)=>{const h=createHash('sha256').update(id+':'+name).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);};
/** Orchestrates existing owned copies/bindings/outputs; stores no manuscript or decisions. */
export function createStructureTests({drafts,bindings,photos,outputs}){
 if(!drafts?.cloneStructureTest||!bindings?.select||!photos?.select||!outputs?.read||!outputs.create)throw Error('Structure tests require the maintained native owners.');
 function report(document){const b=document.binding,m=b.structureTest;if(b.kind!=='collection-root'||b.origin!=='structure-test'||b.status!=='ready'||document.readiness?.ready!==true||m?.role!=='structure-test'||m.label!=='stand-in'||!AGENT_ACTORS.includes(m.createdBy)||!UUID.test(m.sourceBindingId||'')||m.sourceParentStudyId===b.parentStudyId||!HASH.test(m.draftHash||'')||!HASH.test(m.captureHash||''))fail('Registered structure-test provenance is unavailable.');return {schema:'ar-create.structure-test.v1',parentStudyId:b.parentStudyId,title:b.title,bindingId:b.id,role:'structure-test',createdBy:m.createdBy,status:'ready',source:{parentStudyId:m.sourceParentStudyId,bindingId:m.sourceBindingId,draftHash:m.draftHash,captureHash:m.captureHash},decisions:{role:'stand-in',actor:m.createdBy}};}
 async function validateTarget(input){
  if(!input||Object.keys(input).some(k=>!['parentStudyId','bindingId'].includes(k))||typeof input.parentStudyId!=='string'||!input.parentStudyId.startsWith('structure-test-')||!UUID.test(input.bindingId||''))fail('Choose an exact registered structure-test target.',404);
  const rows=(await drafts.catalog()).collections.filter(row=>row.parentStudyId===input.parentStudyId&&row.origin==='structure-test');if(rows.length!==1)fail('Registered structure test was not found.',404);
  const root=await drafts.read({bindingId:rows[0].bindingId,parentStudyId:input.parentStudyId}),view=report(root);
  if(input.bindingId===root.binding.id)return {document:root,root,view};
  const document=await drafts.read(input),editions=await outputs.read({rootBindingId:root.binding.id,parentStudyId:input.parentStudyId});
  if(document.binding.status!=='ready'||document.readiness?.ready!==true||document.binding.authority!=='owned-working-copy'||document.binding.parentStudyKey!==input.parentStudyId||document.binding.sourceBindingId!==root.binding.id||!document.binding.canonicalOutputId||!editions.outputBindings?.some(row=>row.outputId===document.binding.canonicalOutputId&&row.wordOwner?.kind==='native'&&row.wordOwner.bindingId===input.bindingId))fail('Stand-in target is not a native-owned descendant of this exact structure-test root.',403);
  return {document,root,view};
 }
 function pending(document,view){const marks=approvalMarks(document.raw),pendingMarks=marks.pairs+(marks.tokens-marks.pairs*2),reviewableMarks=document.approvalReview.blocks.reduce((n,row)=>n+row.spans.length,0);return pendingMarks?{...view,status:'pending-stand-in',pendingMarks,reviewableMarks,article:null}:null;}
 async function read(input){
  if(!input||Object.keys(input).join(',')!=='parentStudyId'||typeof input.parentStudyId!=='string'||!input.parentStudyId.startsWith('structure-test-'))fail('Choose a registered structure test.',404);
  const rows=(await drafts.catalog()).collections.filter(row=>row.parentStudyId===input.parentStudyId&&row.origin==='structure-test');if(rows.length!==1)fail('Registered structure test was not found.',404);
  const {document,view}=await validateTarget({parentStudyId:input.parentStudyId,bindingId:rows[0].bindingId});
  const id=operation(view.parentStudyId.slice('structure-test-'.length),'article'),editions=await outputs.read({rootBindingId:view.bindingId,parentStudyId:view.parentStudyId});if(!editions.outputs.some(row=>row.id===id&&row.kind==='article')||!editions.outputBindings?.some(row=>row.outputId===id&&row.wordOwner?.kind==='native'))return pending(document,view)||{...view,status:'pending-article',article:null};return view;
 }
 async function reviewMark(input){
  if(!AGENT_ACTORS.includes(currentActor()?.actor))fail('Stand-in mark review requires an explicit agent actor.',403);
  const {root}=await validateTarget({bindingId:input?.bindingId,parentStudyId:input?.parentStudyId});if(root.binding.id!==input.bindingId)fail('Markup stand-in review is limited to the exact copied root.',403);
  await drafts.standInReview(input);return {...await read({parentStudyId:input.parentStudyId}),decision:{role:'stand-in',actor:currentActor().actor,operationId:input.operationId}};
 }
 async function create(input){if(!AGENT_ACTORS.includes(currentActor()?.actor))fail('Structure-test creation requires an explicit agent actor.',403);const document=await drafts.cloneStructureTest(input),view=report(document),projectBinding=await bindings.select({projectKey:view.parentStudyId,title:view.title,operationId:input.operationId}),photoBinding=await photos.select({bindingId:view.bindingId,parentStudyId:view.parentStudyId,operationId:input.operationId}),group={rootBindingId:view.bindingId,parentStudyId:view.parentStudyId},articleId=operation(input.operationId,'article');let editions=await outputs.read(group),article=editions.outputs.find(row=>row.id===articleId);if(!article){const waiting=pending(document,view);if(waiting)return {...waiting,projectBinding,photoBinding};const result=await outputs.create({...group,kind:'article',sourceBindingId:view.bindingId,expectedNative:document.expected,expectedOutput:editions.expectedOutput,operationId:articleId});editions=result.view;article=editions.output;}const lineage=editions.outputBindings?.find(row=>row.outputId===articleId);if(article?.id!==articleId||article.kind!=='article'||lineage?.wordOwner?.kind!=='native'||!UUID.test(lineage.wordOwner.bindingId||''))fail('The test Article could not be verified.');const words=await drafts.read({bindingId:lineage.wordOwner.bindingId,parentStudyId:view.parentStudyId});if(words.binding.canonicalOutputId!==articleId||words.binding.id!==view.bindingId&&words.binding.sourceBindingId!==view.bindingId)fail('Test Article wording belongs to another root.');return {...view,article:{outputId:articleId,bindingId:lineage.wordOwner.bindingId},projectBinding,photoBinding};}
 return {create,read,reviewMark,validateTarget};
}
