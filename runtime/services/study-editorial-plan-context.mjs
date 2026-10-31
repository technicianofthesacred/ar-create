import {digest} from './files.mjs';
import {researchPointId} from './study-research-choices.mjs';
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const same=(a,b)=>stable(a)===stable(b);
const fail=message=>{throw Object.assign(Error(message),{status:409});};
const uuidPin=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value),hashPin=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const PARENTS={hk:'hk','ref-an-cha':'ancha','ref-collector':'collector'};
export const EDITORIAL_PLAN_ROLE='saved-editorial-plan-not-evidence-source-quotation-or-approved-prose';
/** Internal capability only: the bridge supplies the accepted opening preimage.
 * Re-read the native receipt here; neither a flag nor caller hashes grant lineage. */
async function acceptedOpeningTransition(drafts,binding,draft,lineage){
 if(!lineage||lineage.schema!=='ar-create.accepted-opening-plan-lineage.v1'||!same(lineage.binding,binding)||typeof drafts.inspect!=='function'||! /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(lineage.operationId||''))fail('Exact accepted opening lineage is unavailable.');
 const inspected=await drafts.inspect({...binding,operationId:lineage.operationId}),receipt=inspected?.receipt,changes=receipt?.changes;
 if(inspected?.bindingId!==binding.bindingId||receipt?.projectId!==binding.bindingId||receipt.operationId!==lineage.operationId||receipt.kind!=='draft-operations'||receipt.state!=='committed'||!Array.isArray(changes)||changes.length!==3||changes.some(c=>c.state!=='applied'))fail('Only the exact committed opening operation can carry saved research choices.');
 const writing=changes.filter(c=>!c.area&&c.relativePath.startsWith('Workflow/3-Develop/')),edits=changes.filter(c=>!c.area&&c.relativePath.startsWith('Workflow/4-Review/')),metadata=changes.filter(c=>c.area==='binding-metadata'&&c.relativePath===binding.bindingId+'.draft-correspondence.json');
 if(writing.length!==1||edits.length!==1||metadata.length!==1)fail('The opening operation changed unsupported records.');
 const before={workflow:receipt.expectedWorkflow,bindingHash:receipt.expectedBindingHash,correspondenceHash:metadata[0].beforeHash},after={workflow:{...receipt.expectedWorkflow,draft:writing[0].afterHash,edits:edits[0].afterHash},bindingHash:receipt.expectedBindingHash,correspondenceHash:metadata[0].afterHash};
 if(!same(lineage.beforeExpected,before)||!same(lineage.afterExpected,after)||!same(draft.expected,after)||writing[0].beforeHash!==before.workflow?.draft||edits[0].beforeHash!==before.workflow?.edits||lineage.beforeHash!==before.workflow?.draft||lineage.afterHash!==writing[0].afterHash||digest(draft.raw)!==lineage.afterHash)fail('Saved choices do not match the exact opening preimage and current receipt result.');
 return before;
}
/** Read only existing authorities. No active-project reads, saves, source analysis,
 * guessed attribution, insertion, stage transitions, providers or new storage. */
export function createStudyEditorialPlanContext({drafts,originals,choices,validateStandInTarget}={}){
 if(!drafts?.read||!originals?.readDraft||!choices?.read)throw TypeError('Supply existing owned drafts, original part catalog and saved research choices.');
 return {async context(binding,{acceptedOpening}={}){
  const draft=await drafts.read(binding),b=draft?.binding;
  if(b?.id!==binding.bindingId||b.parentStudyId!==binding.parentStudyId||b.authority!=='owned-working-copy'||b.status!=='ready'||draft.readiness?.ready!==true||!draft.expected||!Array.isArray(draft.context?.records))fail('Exact ready owned manuscript is required for editorial context.');
  const openingPreimage=acceptedOpening===undefined?null:await acceptedOpeningTransition(drafts,binding,draft,acceptedOpening);
  if(b.origin==='structure-test'||b.parentStudyId.startsWith('structure-test-')){
   if(typeof validateStandInTarget!=='function')fail('Registered structure-test plan authority is unavailable.');
   const verified=await validateStandInTarget(binding);if(b.kind==='output-fork'&&(b.sourceBindingId!==verified.root?.binding?.id||b.derivedFrom?.bindingId!==b.sourceBindingId||b.outputId!==b.canonicalOutputId||!uuidPin(b.outputId)))fail('Structure-test output plan has no exact registered root owner.');if(!same(verified.document.expected,draft.expected)||verified.document.raw!==draft.raw)fail('Structure-test writing changed while capturing its plan.');
   const originalSourceRecords=draft.context.records.filter(record=>record.role!=='draft').map(record=>{if(record.missing||typeof record.raw!=='string'||record.copiedHash!==digest(record.raw))fail('Copied support capture is unavailable or changed.');return {id:record.id,role:record.role,sourcePath:record.sourcePath,hash:record.copiedHash};}).sort((a,b)=>a.id.localeCompare(b.id));
   const records=draft.context.records.filter(record=>['brief','plan','map'].includes(record.role)).map(record=>({id:record.id,role:EDITORIAL_PLAN_ROLE,recordKind:record.role,sourcePath:record.sourcePath,hash:record.copiedHash,body:record.raw,authority:'immutable-structure-test-support-capture',scope:{bindingId:b.id,parentStudyId:b.parentStudyId,originalId:b.originalId,partKey:b.partKey},interpretation:'Retained plan material; original human decisions remain with the original subject. This capture is not factual evidence or accepted prose.'}));
   const payload={schema:'ar-create.study-editorial-plan-context.v1',role:EDITORIAL_PLAN_ROLE,binding:structuredClone(binding),originalId:b.originalId,partKey:b.partKey,contextScope:b.kind==='output-fork'?'exact-registered-structure-test-output':'exact-registered-structure-test-copy',expected:structuredClone(draft.expected),originalPlan:{status:'captured-support-only',source:structuredClone(verified.view.source),decisions:'Original human decisions remain pending on the original subject.'},choiceSourceExpected:null,originalSourceRecords,records,selections:[]};return {...payload,hash:digest(stable(payload))};
  }
  if(b.kind==='collection-root'||b.origin==='authored-collection'){
   if(!['collection-root','output-fork'].includes(b.kind)||b.origin!=='authored-collection'||b.originalId!=='collection:'+binding.parentStudyId||b.partKey!=='collection'||PARENTS[b.parentStudyId]||draft.context.records.some(record=>record.role!=='draft'))fail('Authored root has contradictory original-plan identity or retained original support; preserve existing context for review.');
   let outputLineage;
   if(b.kind==='output-fork'){
    const from=b.derivedFrom,expected=from?.expected;
    if(!uuidPin(b.id)||!uuidPin(b.outputId)||b.canonicalOutputId!==b.outputId||!uuidPin(b.sourceBindingId)||new Set([b.id,b.outputId,b.sourceBindingId]).size!==3||from?.bindingId!==b.sourceBindingId||from.relationship!=='archival-starting-edition-not-continuous-wording-or-freshness-authority'||!hashPin(from.rawHash)||!hashPin(from.captureHash)||!hashPin(expected?.bindingHash)||!hashPin(expected?.correspondenceHash)||!expected.workflow||Array.isArray(expected.workflow)||expected.workflow.draft!==from.rawHash||Object.values(expected.workflow).some(value=>value!==null&&!hashPin(value))||b.seedWorkingHash!==from.rawHash||b.textOutputKind!==undefined)fail('Authored independent Article has incomplete or contradictory canonical archival fork proof.');
    outputLineage={outputId:b.outputId,canonicalOutputId:b.canonicalOutputId,sourceBindingId:b.sourceBindingId,seedWorkingHash:b.seedWorkingHash,derivedFrom:structuredClone(from)};
   }
   // Authored roots and their exact archived Article forks have no original-part plan or legacy
   // research-choice history. Parent Research and Direction retain their own
   // captured authorities in the existing composition; they are not empty evidence.
   const payload={schema:'ar-create.study-editorial-plan-context.v1',role:EDITORIAL_PLAN_ROLE,binding:structuredClone(binding),originalId:b.originalId,partKey:b.partKey,contextScope:outputLineage?'exact-authored-independent-output':'exact-authored-collection-root',...(outputLineage?{outputLineage}:{}),expected:structuredClone(draft.expected),originalPlan:{status:'not-applicable',reason:'Authored working root has no legacy original-part plan or original-backed Research choices. Parent Research, selected material and scoped Direction remain separate maintained context.'},choiceSourceExpected:null,originalSourceRecords:[],records:[],selections:[]};
   return {...payload,hash:digest(stable(payload))};
  }
  const original=await originals.readDraft(b.originalId);
  if(original?.id!==b.originalId||original.parentStudyKey!==b.parentStudyId||original.partKey!==b.partKey||!Array.isArray(original.records))fail('Editorial records belong to a different original part.');
  const originalSourceRecords=original.records.filter(r=>r.role!=='draft').map(r=>{
   if(typeof r.raw!=='string'||r.hash!==digest(r.raw))fail('Original source revision hash changed.');
   return {id:r.id,role:r.role,sourcePath:r.path,hash:r.hash};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const capturedSourceRecords=draft.context.records.filter(r=>r.role!=='draft'&&!r.missing).map(r=>({id:r.id,role:r.role,sourcePath:r.sourcePath,hash:r.copiedHash})).sort((a,b)=>a.id.localeCompare(b.id));
  if(!same(originalSourceRecords,capturedSourceRecords))fail('Original source revisions changed; refresh the exact owned capture before proposing.');
  const records=[];
  for(const record of draft.context.records.filter(r=>['brief','plan','map'].includes(r.role))){
   const live=original.records.find(r=>r.id===record.id&&r.path===record.sourcePath&&r.role===record.role);
   if(record.missing||!live||typeof record.raw!=='string'||typeof live.raw!=='string'||record.copiedHash!==digest(record.raw)||live.hash!==digest(live.raw)||record.copiedHash!==live.hash)fail('Saved original plan or brief revision changed; refresh the owned capture before proposing.');
   records.push({id:record.id,role:EDITORIAL_PLAN_ROLE,recordKind:record.role,sourcePath:record.sourcePath,hash:record.copiedHash,body:record.raw,authority:'exact-original-part-support-capture',scope:{bindingId:b.id,parentStudyId:b.parentStudyId,originalId:b.originalId,partKey:b.partKey},interpretation:'Complete saved plan/brief/map; may describe several pieces. Only the explicitly bound part is targeted; this record is not proof of approval or factual support.'});
  }
  // Addition/removal of an applicable original record must also invalidate capture.
  if(!same(records.map(r=>r.id).sort(),original.records.filter(r=>['brief','plan','map'].includes(r.role)).map(r=>r.id).sort()))fail('Original part plan/brief catalog changed; refresh the owned capture.');
  const projectKey=PARENTS[b.parentStudyId];if(!projectKey)fail('Unsupported parent study for saved research choices.');
  const saved=await choices.read({projectKey,parentStudyId:b.parentStudyId,bindingId:b.id});
  if(saved?.bindingId!==b.id||saved.parentStudyId!==b.parentStudyId||saved.projectKey!==projectKey||saved.authority!=='owned-working-copy'||saved.purpose!=='editorial-plan-only'||!same(saved.expected,draft.expected)||!Array.isArray(saved.choices)||!Array.isArray(saved.sourceRecords))fail('Saved choices belong to another owned part or revision.');
  const selections=saved.choices.map(c=>{
   const currentChoice=!c.stale&&!c.sourceStale&&!c.draftStale&&same(c.expected,draft.expected),openingChoice=openingPreimage&&c.stale===true&&c.draftStale===true&&c.sourceStale===false&&same(c.expected,openingPreimage);
   if(!(currentChoice||openingChoice)||c.sourceExpected!==saved.sourceExpected||c.pointId!==researchPointId(c.recordPath,c.originalText)||!['include','leave-out'].includes(c.decision)||typeof c.narration!=='string')fail('Saved research choice is stale or its exact identity changed; refresh the choice.');
   const record=original.records.find(r=>r.path===c.recordPath&&r.role==='research');
   const source=saved.sourceRecords.find(r=>r.path===c.recordPath);
   if(!record||record.hash!==c.recordHash||digest(record.raw)!==record.hash||source?.hash!==record.hash||source.missing||!record.raw.includes(c.originalText)||record.raw.indexOf(c.originalText)!==record.raw.lastIndexOf(c.originalText))fail('Research selection must match the exact original part research record and source hash.');
   if(c.anchorId&&!draft.projection?.some(p=>p.id===c.anchorId&&p.blockKind==='paragraph'))fail('Research placement anchor no longer belongs to the current manuscript.');
   return {pointId:c.pointId,decision:c.decision,role:EDITORIAL_PLAN_ROLE,researchPassage:{sourceId:record.id,sourcePath:c.recordPath,sourceHash:c.recordHash,body:c.originalText,role:'selected-research-analysis-passage-not-primary-source-quotation-or-verified-fact',uncertainty:'No new verification or inferred evidence status. Preserve the full research record qualifications.'},researchRecord:{sourceId:record.id,sourceHash:record.hash,body:record.raw,role:'complete-research-analysis-with-original-qualifications-not-primary-evidence'},humanNarration:{body:c.narration,hash:digest(c.narration),role:'human-authored-proposed-narration-not-approved-manuscript'},placement:{anchorId:c.anchorId,role:'planned-paragraph-anchor-not-insertion'},operationId:c.operationId,updatedAt:c.updatedAt};
  });
  const payload={schema:'ar-create.study-editorial-plan-context.v1',role:EDITORIAL_PLAN_ROLE,binding:structuredClone(binding),originalId:b.originalId,partKey:b.partKey,contextScope:original.contextScope??null,expected:structuredClone(draft.expected),choiceSourceExpected:saved.sourceExpected,originalSourceRecords,records,selections};
  return {...payload,hash:digest(stable(payload))};
 }};
}
