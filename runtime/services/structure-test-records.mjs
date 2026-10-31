import path from 'node:path';
import {StateError} from '../store.mjs';
import {digest} from './files.mjs';
const HASH=/^[a-f0-9]{64}$/;
const PARENTS={hk:'hk',ancha:'ref-an-cha',collector:'ref-collector'};
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const fail=(message,status=409)=>{throw new StateError(message,status);};
const stage=role=>({draft:5,source:2,transcript:2,context:4,research:3,'research notes':3,notes:3,brief:3,map:4,plan:4,photo:8,carousel:9}[role]||2);
/** Read the registered copy's immutable captures through their maintained owner.
 * Original presentation summaries may be reused only with complete matching
 * capture provenance. This service owns no files or editorial decisions. */
export function createStructureTestRecords({structureTests,drafts,originals,derivedFindings}={}){
 if(typeof structureTests?.read!=='function'||typeof structureTests?.validateTarget!=='function'||typeof drafts?.read!=='function'||typeof originals?.list!=='function'||typeof derivedFindings?.read!=='function')throw Error('Connect the maintained structure copy, original and derived readers.');
 function input(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='parentStudyId'||typeof value.parentStudyId!=='string'||!/^structure-test-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.parentStudyId))fail('Choose one exact registered structure-test parent.',400);return value.parentStudyId;}
 async function root(parentStudyId){
  const view=await structureTests.read({parentStudyId}),owned=await drafts.read({bindingId:view.bindingId,parentStudyId}),trusted=await structureTests.validateTarget({bindingId:view.bindingId,parentStudyId}),b=owned.binding;
  if(b?.id!==view.bindingId||b.parentStudyId!==parentStudyId||b.origin!=='structure-test'||b.kind!=='collection-root'||b.status!=='ready'||owned.readiness?.ready!==true||b.structureTest?.role!=='structure-test'||b.structureTest.label!=='stand-in'||stable(b.structureTest)!==stable(trusted.root?.binding?.structureTest)||!Array.isArray(owned.context?.records))fail('The registered structure-test capture identity changed.');
  const seen=new Set();for(const r of owned.context.records){if(typeof r.sourcePath!=='string'||!r.sourcePath||seen.has(r.sourcePath))fail('Captured source path identity is ambiguous.');seen.add(r.sourcePath);if(!r.missing&&(typeof r.raw!=='string'||!HASH.test(r.copiedHash||'')||r.sourceHash!==r.copiedHash||digest(r.raw)!==r.copiedHash))fail('Captured source bytes or hashes changed.');}
  return {owned,signature:stable({id:b.id,parentStudyId,metadata:b.structureTest,records:owned.context.records.map(r=>({id:r.id,path:r.sourcePath,role:r.role,hash:r.copiedHash,missing:r.missing===true}))})};
 }
 async function unchanged(parentStudyId,snapshot){if((await root(parentStudyId)).signature!==snapshot.signature)fail('Structure-test captures changed during reading.');}
 function base(parentStudyId){return {schema:'ar-create.study-derived-findings.v1',schemaVersion:1,kind:'source-backed-presentation-findings',canonicalRecord:false,projectKey:parentStudyId,parentStudyId};}
 function empty(parentStudyId,reason,stale=false){return {...base(parentStudyId),available:false,stale,freshness:{state:stale?'stale':'unavailable',reason},verification:'No matching retained findings are available for this copy; no fresh research or fact checking ran.',summaryAuthorship:'',points:[]};}
 async function list(value){const parentStudyId=input(value),snapshot=await root(parentStudyId),b=snapshot.owned.binding,records=snapshot.owned.context.records.map(r=>({id:r.id,name:path.basename(r.sourcePath),title:path.basename(r.sourcePath).replace(/\.md$/i,''),path:r.sourcePath,sourcePath:r.sourcePath,role:r.role,stage:stage(r.role),raw:r.missing?null:r.raw,hash:r.missing?null:r.copiedHash,copiedHash:r.missing?null:r.copiedHash,modifiedAt:null,missing:r.missing===true,origin:'immutable-structure-test-capture'}));await unchanged(parentStudyId,snapshot);return {projectKey:parentStudyId,parentStudyId,title:b.title,records,audio:[],diagnostics:[],relatedProjects:[],role:'retained-copy-material',verification:'Exact immutable captured bytes; no new source or factual verification.'};}
 async function findings(value){
  const parentStudyId=input(value),snapshot=await root(parentStudyId),sourceParent=snapshot.owned.binding.structureTest.sourceParentStudyId,projectKey=Object.keys(PARENTS).find(key=>PARENTS[key]===sourceParent);
  if(!projectKey)return empty(parentStudyId,'This copy has no supported original-derived findings mapping.');
  let projection,current;try{projection=await derivedFindings.read({projectKey,parentStudyId:sourceParent});current=await originals.list(projectKey);}catch(error){if(error.status!==404)throw error;return empty(parentStudyId,'No retained original findings are available.');}
  if(projection?.schema!=='ar-create.study-derived-findings.v1'||projection.projectKey!==projectKey||projection.parentStudyId!==sourceParent||projection.canonicalRecord!==false||!Array.isArray(projection.points))fail('Original derived-findings authority returned another scope or schema.');
  if(!projection.available||projection.stale===true){await unchanged(parentStudyId,snapshot);return empty(parentStudyId,projection.freshness?.reason||'Retained original findings are unavailable.',projection.stale===true);}
  if(current?.projectKey!==projectKey||!Array.isArray(current.records))fail('Original record authority returned another scope.');
  const captures=new Map(snapshot.owned.context.records.map(r=>[r.sourcePath,r])),originalRecords=new Map();for(const r of current.records){if(originalRecords.has(r.path))fail('Original source paths are ambiguous.');originalRecords.set(r.path,r);}
  let mismatch=false;
  function matched(sourcePath,hash){const r=captures.get(sourcePath),original=originalRecords.get(sourcePath);if(!r||r.missing||!HASH.test(hash||'')||hash!==r.copiedHash||!original||original.missing||original.hash!==hash||typeof original.raw!=='string'||digest(original.raw)!==hash){mismatch=true;return null;}return r;}
  for(const source of projection.freshness?.sourceHashes||[])matched(source.path,source.hash);
  const points=projection.points.map(point=>{
   if(!Array.isArray(point.sources)||!point.sources.length)fail('A retained finding needs its exact captured source references.');
   for(const source of point.sources){const r=matched(source.path,source.hash);if(source.recordPath!==undefined&&(source.recordPath!==source.path||source.recordHash!==source.hash))mismatch=true;if(r&&typeof source.raw==='string'){const range=source.sourceRange;if(!range||!Number.isSafeInteger(range.from)||!Number.isSafeInteger(range.to)||range.from<0||range.to<=range.from||r.raw.slice(range.from,range.to)!==source.raw||source.excerptHash&&digest(source.raw)!==source.excerptHash)mismatch=true;}}
   for(const speech of point.spoken||[]){const r=matched(speech.sourcePath,speech.sourceHash),range=speech.sourceRange;if(r&&(!range||!Number.isSafeInteger(range.from)||!Number.isSafeInteger(range.to)||range.from<0||range.to<=range.from||r.raw.slice(range.from,range.to)!==speech.quote))mismatch=true;}
   const {narration,humanDecision,decision,scope,...retained}=structuredClone(point);
   return {...retained,id:'copy-derived-'+digest(parentStudyId+'\n'+point.id).slice(0,24),projectKey:parentStudyId,parentStudyId,projectId:parentStudyId,scope:{projectId:parentStudyId,outputId:'',revision:digest(snapshot.signature)},sources:retained.sources.map(source=>({...source,sourceOrigin:'immutable-structure-test-capture'})),canPlan:false,canDecide:false,planReason:'Retained learning only; this copy has no adopted editorial decision for this finding.',decision:{state:'read-only',included:null,authority:'retained-copy-presentation-only'},verificationScope:'retained-source-integrity-only-not-independent-factual-verification'};
  });
  await unchanged(parentStudyId,snapshot);
  if(mismatch)return empty(parentStudyId,'Retained finding sources do not match this copy’s immutable captures.',true);
  return {...structuredClone(projection),...base(parentStudyId),available:true,stale:false,points,approvalScope:'Retained presentation only; no original human decision is adopted by this copy.',retainedFrom:{projectKey,parentStudyId:sourceParent},freshness:{state:'current',scope:'exact-retained-projection-and-immutable-copy-capture-match',sourceHashes:structuredClone(projection.freshness?.sourceHashes||[])},verification:'Retained noncanonical findings matched to exact copy captures. No fresh research, factual verification or copy editorial decision was performed.',verificationProof:{sourceIntegrity:'capture-matched',independentFactCheck:false,attributionAssessment:false}};
 }
 return {list,findings};
}
