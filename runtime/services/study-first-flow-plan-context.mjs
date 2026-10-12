import fs from 'node:fs';
import {readJson,digest,resolveInside} from './files.mjs';
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=message=>{throw Object.assign(Error(message),{status:409});};
/** Optional composition at the existing editorialPlan injection. The parent
 * Research room and exact manuscript-part room retain separate authorities. */
export function createStudyFirstFlowPlanContext({dataDir,savedPlan,firstFlow}){
 if(!savedPlan?.context||!firstFlow?.context)throw TypeError('Supply existing saved plan and read-only first-flow context authorities.');
 function registry(key){
  const root=resolveInside(dataDir,'study-project-bindings',{missing:true});if(!fs.existsSync(root))return null;
  const file=resolveInside(root,digest(key)+'.json',{missing:true}),owned=readJson(file,null);if(!owned)return null;
  if(owned.schema!=='ar-create.study-binding.v1'||owned.status!=='ready'||owned.projectKey!==key||!UUID.test(owned.projectId||'')||!UUID.test(owned.documentId||''))fail('Exact ready persisted project/document binding required for research context.');
  return owned;
 }
 async function captured(key,scope){
  const owned=registry(key);
  if(!owned)return {scope,available:false,reason:'No persisted binding connects this research room; no binding was created.'};
  const context=await firstFlow.context({projectId:owned.projectId});
  if(context.projectId!==owned.projectId||context.documentId!==owned.documentId||context.schema!=='ar-create.first-flow-context.v1')fail('Fresh research context belongs to another owned part/document.');
  const {hash,...payload}=context;if(hash!==digest(stable(payload)))fail('First-flow context authority capture hash changed.');
  return {scope,binding:{projectKey:key,projectId:owned.projectId,documentId:owned.documentId},available:context.available,context:structuredClone(context)};
 }
 return {async context(binding){
  const plan=await savedPlan.context(binding),{hash:oldHash,...base}=plan;
  if(oldHash!==digest(stable(base)))fail('Editorial context authority capture hash changed.');
  const project=await captured(binding.parentStudyId,{kind:'project-shared-research',parentStudyId:binding.parentStudyId,role:'potentially-multiple-story-research-not-part-direction-or-approved-part-prose'});
  const part=await captured('owned-draft:'+binding.bindingId,{kind:'matching-part-research',parentStudyId:binding.parentStudyId,bindingId:binding.bindingId,role:'research-and-editorial-intent-for-this-exact-owned-part-not-shared-project-direction-or-approved-prose'});
  if(project.binding&&part.binding&&project.binding.projectId===part.binding.projectId)fail('Parent and owned part research bindings must identify distinct project rooms.');
  const out={...base,firstFlow:{project,part}};return {...out,hash:digest(stable(out))};
 }};
}
