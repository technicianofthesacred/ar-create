import {readJson,digest,resolveInside} from './files.mjs';
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
export const PROJECT_MATERIAL_ROLE='attached-parent-material-not-verified-evidence-or-approved-prose';
/** Composition of existing persisted binding and first-flow membership authorities.
 * No discovery, active-project fallback, attachment, review, provider or storage. */
export function createStudyProjectMaterialContext({dataDir,firstFlow,drafts}){
 if(typeof firstFlow?.materialContext!=='function')throw TypeError('Supply existing read-only first-flow material authority.');
 function owned(key,optional=false){const file=resolveInside(dataDir,'study-project-bindings/'+digest(key)+'.json',{missing:true}),record=readJson(file,null);if(record===null&&optional)return null;if(!record||record.schema!=='ar-create.study-binding.v1'||record.status!=='ready'||record.projectKey!==key||!UUID.test(record.projectId||'')||!UUID.test(record.documentId||''))fail('Exact ready persisted parent and part bindings required for material context.');return record;}
 async function materialPart(binding){
  const direct=owned('owned-draft:'+binding.bindingId,true);if(direct)return {record:direct};
  if(typeof drafts?.read!=='function')fail('Exact ready persisted parent and part bindings required for material context.');
  const lineage=[],seen=new Set();let id=binding.bindingId;
  for(let depth=0;depth<16;depth++){
   if(seen.has(id))fail('Native material ancestry is cyclic.');seen.add(id);
   const value=await drafts.read({bindingId:id,parentStudyId:binding.parentStudyId}),b=value.binding;
   if(b?.id!==id||b.parentStudyId!==binding.parentStudyId||b.authority!=='owned-working-copy'||b.status!=='ready'||value.readiness?.ready!==true)fail('Native material ancestry belongs to another or unready owner.');
   const physical=owned('owned-draft:'+id,true);if(physical)return {record:physical,inheritance:{role:'inherited-root-material-context',bindingId:id,lineage}};
   if(b.kind!=='output-fork'||!UUID.test(b.sourceBindingId||'')||!UUID.test(b.canonicalOutputId||'')||b.outputId!==b.canonicalOutputId||b.derivedFrom?.bindingId!==b.sourceBindingId||b.textOutputKind!==undefined&&!['post','product-listing'].includes(b.textOutputKind))fail('The selected child has no exact persisted root material owner.');
   lineage.push({bindingId:id,sourceBindingId:b.sourceBindingId,outputId:b.canonicalOutputId,...(b.textOutputKind?{textOutputKind:b.textOutputKind}:{})});id=b.sourceBindingId;
  }
  fail('Native material ancestry exceeds its bounded owner chain.');
 }
 async function parentCapture(parent){
  const capture=await firstFlow.materialContext({projectId:parent.projectId}),{hash,...payload}=capture;
  if(capture.schema!=='ar-create.first-flow-material-context.v1'||capture.projectId!==parent.projectId||capture.documentId!==parent.documentId||hash!==digest(stable(payload))||!Array.isArray(capture.records))fail('Parent material authority identity or hash changed.');
  return capture;
 }
 function select(capture,sourceIds,keepBody=false){
  if(sourceIds!==undefined&&(!Array.isArray(sourceIds)||new Set(sourceIds).size!==sourceIds.length||sourceIds.some(id=>!UUID.test(id))))fail('Select explicit parent Library source IDs.',400);
  return sourceIds===undefined?capture.records.map(({raw,...record})=>keepBody&&typeof raw==='string'?{...record,raw}:record):sourceIds.map(id=>{const record=capture.records.find(r=>r.id===id);if(!record?.eligible||record.review?.state!=='reviewed'||typeof record.raw!=='string')fail('Selected parent material is missing, unreadable or unreviewed.',400);return structuredClone(record);});
 }
 return {/** The subject's own attached material with no part connection. A subject begun in version two (New subject)
  * has only the parent connection. Same parent connection, same eligible-and-reviewed test and same refusals as
  * context(); nothing is attached, reviewed or connected as a side effect. The caller has already checked that its
  * draft belongs to this parent. */
 async parentContext({parentStudyId}={},{sourceIds,withBody=false}={}){
  if(typeof parentStudyId!=='string'||!parentStudyId)fail('Explicit study binding required.',400);
  const parent=owned(parentStudyId),capture=await parentCapture(parent),records=select(capture,sourceIds,withBody);
  const out={schema:'ar-create.study-project-material-context.v1',role:PROJECT_MATERIAL_ROLE,binding:{parentStudyId},parent:{projectId:parent.projectId,documentId:parent.documentId},records};return {...out,hash:digest(stable(out))};
 },
 async context(binding,{sourceIds}={}){
  if(!UUID.test(binding?.bindingId||'')||typeof binding.parentStudyId!=='string'||!binding.parentStudyId)fail('Explicit study part binding required.',400);
  const parent=owned(binding.parentStudyId),resolved=await materialPart(binding),part=resolved.record;if(parent.projectId===part.projectId)fail('Parent material and owned manuscript part rooms must remain distinct.');
  const capture=await parentCapture(parent),records=select(capture,sourceIds);
  const out={schema:'ar-create.study-project-material-context.v1',role:PROJECT_MATERIAL_ROLE,binding:structuredClone(binding),parent:{projectId:parent.projectId,documentId:parent.documentId},part:{projectId:part.projectId,documentId:part.documentId},...(resolved.inheritance?{materialOwner:resolved.inheritance}:{}),records};return {...out,hash:digest(stable(out))};
 }};
}
