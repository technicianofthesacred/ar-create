import {readJson,digest,resolveInside} from './files.mjs';
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
export const PROJECT_MATERIAL_ROLE='attached-parent-material-not-verified-evidence-or-approved-prose';
/** Composition of existing persisted binding and first-flow membership authorities.
 * No discovery, active-project fallback, attachment, review, provider or storage. */
export function createStudyProjectMaterialContext({dataDir,firstFlow}){
 if(typeof firstFlow?.materialContext!=='function')throw TypeError('Supply existing read-only first-flow material authority.');
 function owned(key){const file=resolveInside(dataDir,'study-project-bindings/'+digest(key)+'.json',{missing:true}),record=readJson(file,null);if(!record||record.schema!=='ar-create.study-binding.v1'||record.status!=='ready'||record.projectKey!==key||!UUID.test(record.projectId||'')||!UUID.test(record.documentId||''))fail('Exact ready persisted parent and part bindings required for material context.');return record;}
 return {async context(binding,{sourceIds}={}){
  if(!UUID.test(binding?.bindingId||'')||typeof binding.parentStudyId!=='string'||!binding.parentStudyId)fail('Explicit study part binding required.',400);
  const parent=owned(binding.parentStudyId),part=owned('owned-draft:'+binding.bindingId);if(parent.projectId===part.projectId)fail('Parent material and owned manuscript part rooms must remain distinct.');
  const capture=await firstFlow.materialContext({projectId:parent.projectId}),{hash,...payload}=capture;
  if(capture.schema!=='ar-create.first-flow-material-context.v1'||capture.projectId!==parent.projectId||capture.documentId!==parent.documentId||hash!==digest(stable(payload))||!Array.isArray(capture.records))fail('Parent material authority identity or hash changed.');
  if(sourceIds!==undefined&&(!Array.isArray(sourceIds)||new Set(sourceIds).size!==sourceIds.length||sourceIds.some(id=>!UUID.test(id))))fail('Select explicit parent Library source IDs.',400);
  const records=sourceIds===undefined?capture.records.map(({raw,...record})=>record):sourceIds.map(id=>{const record=capture.records.find(r=>r.id===id);if(!record?.eligible||record.review?.state!=='reviewed'||typeof record.raw!=='string')fail('Selected parent material is missing, unreadable or unreviewed.',400);return structuredClone(record);});
  const out={schema:'ar-create.study-project-material-context.v1',role:PROJECT_MATERIAL_ROLE,binding:structuredClone(binding),parent:{projectId:parent.projectId,documentId:parent.documentId},part:{projectId:part.projectId,documentId:part.documentId},records};return {...out,hash:digest(stable(out))};
 }};
}
