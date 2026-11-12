import {languageDerivativeSpans} from './language-derivative-spans.mjs';
import {isFixtureRecord} from './live-records.mjs';
import {historicalVersion,canUndoVersion} from './draft-history.mjs';
import {createStudyOwnedRelocation} from './study-owned-relocation.mjs';
import {projection as projectDraft,approvalSpans} from './draft-correspondence.mjs';
import {createStudyRootRecovery} from './study-root-recovery.mjs';
import {createStudyDraftSetAside} from './study-draft-set-aside.mjs';
import {createProvenanceLedger,currentActor,AGENT_ACTORS,HUMAN_ACTORS} from './actor.mjs';
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {StateError} from '../store.mjs';import {atomicWrite,readJson,digest,ensurePrivateDirectory,regular} from './files.mjs';
import {createBoundProjectFolders} from './ar-project-folders.mjs';import {snapshot} from './draft-correspondence-metadata.mjs';import * as ask from '../reference/mag-ask.mjs';import * as draft from '../reference/mag-edit.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(message,status=409)=>{throw new StateError(message,status);};
const readable=(v,label,max=256)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]/.test(v))fail(label+' must be explicit readable text.',400);return v;};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
/** An explicit owned working-copy binding over the tested Magazine DEV journal.
 * Original readers are injected allowlists; no arbitrary caller path is opened. */
export function createStudyDraftCopies({dataDir,originals,afterCopyFile,afterCommit,beforeCommit,studyRelocation,vaultBound=null}={}){
 const readOriginal=originals?.readDraft||originals?.read;if(!originals?.catalog||!readOriginal)throw Error('Supply the root-owned read-only originals catalog.');
 const relocation=createStudyOwnedRelocation({dataDir,manifest:studyRelocation});
 const root=ensurePrivateDirectory(dataDir,'study-draft-copies'),intents=ensurePrivateDirectory(root,'bindings'),copies=ensurePrivateDirectory(root,'copies'),outputLinks=ensurePrivateDirectory(root,'output-bindings');let pending=Promise.resolve();
 const serial=fn=>{const op=pending.then(fn).catch(error=>{if(error instanceof StateError)throw error;if(error.status||/^(Use explicit structure|Edit would create unsupported|Protected|Unsafe|Unmapped|Invalid native|Native range|External DEV divergence|Correspondence |Unknown native|Malformed native|Block identity|Opaque|Pending wording|No native)/.test(error.message||''))throw new StateError(error.message,error.status||409);throw error;});pending=op.catch(()=>{});return op;};
 const location=id=>{if(!uuid.test(id||''))fail('Owned draft binding UUID required.',400);return path.join(copies,id);};
 const persist=b=>atomicWrite(path.join(intents,b.key+'.json'),JSON.stringify(b,null,2));
 const allBindings=()=>fs.readdirSync(intents).filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).map(name=>readJson(path.join(intents,name),null)).filter(Boolean);
 function outputRegistrations(){return fs.readdirSync(outputLinks).filter(name=>uuid.test(name.slice(0,-5))&&name.endsWith('.json')).map(name=>{const value=readJson(path.join(outputLinks,name),null);if(value?.schema!=='ar-create.study-native-output-binding.v1'||value.bindingId!==name.slice(0,-5)||!uuid.test(value.outputId||'')||!uuid.test(value.operationId||'')||!readable(value.parentStudyId)||typeof value.inputHash!=='string')fail('Native output registration identity is corrupt.');return value;});}
 function outputRegistration(b){const found=outputRegistrations().find(row=>row.bindingId===b.id);if(found&&(found.parentStudyId!==b.parentStudyId||found.originalId!==b.originalId||found.originalHash!==b.originalHash||b.kind==='output-fork'&&found.outputId!==b.outputId))fail('Output registration differs from its exact native owner.');return found;}
 function outputCatalog(rows=allBindings()){const forks=rows.filter(b=>b.kind==='output-fork'),registered=outputRegistrations();const result=forks.map(b=>({bindingId:b.id,parentStudyId:b.parentStudyId,outputId:b.outputId,canonicalOutputId:b.outputId,bindingStatus:b.status,sourceBindingId:b.derivedFrom.bindingId,originalId:b.originalId,originalHash:b.originalHash,seedWorkingHash:b.seedWorkingHash,parentStudyKey:b.parentStudyKey,partKey:b.partKey,title:b.title,kind:b.kind,...(b.textOutputKind?{textOutputKind:b.textOutputKind}:{}),derivedFrom:structuredClone(b.derivedFrom)}));for(const link of registered){const b=rows.find(row=>row.id===link.bindingId);if(!b||b.parentStudyId!==link.parentStudyId)fail('Registered output native owner is missing or belongs to another parent.');outputRegistration(b);if(!result.some(row=>row.bindingId===b.id))result.push({bindingId:b.id,parentStudyId:b.parentStudyId,outputId:link.outputId,canonicalOutputId:link.outputId,bindingStatus:b.status,sourceBindingId:b.id,originalId:b.originalId,originalHash:b.originalHash,parentStudyKey:b.parentStudyKey,partKey:b.partKey,title:b.title,kind:'existing-native-output-registration',derivedFrom:structuredClone(link.derivedFrom)});}if(new Set(result.map(row=>row.outputId)).size!==result.length)fail('Output identity is assigned to more than one native owner.');return result;}
 function binding(input,{allowPending=false}={}){readable(input?.parentStudyId,'Parent study ID');const b=allBindings().find(b=>b.id===input.bindingId);if(!b||b.schema!=='ar-create.study-draft-copy.v1')fail('Owned draft binding not found.',404);if(b.parentStudyId!==input.parentStudyId)fail('This draft binding belongs to a different parent study.');if(b.status!=='ready'&&!allowPending)fail('Draft copy is incomplete; explicitly reopen its saved copy intent.');return b;}
 function original(id){readable(id,'Original identifier');const v=readOriginal.call(originals,id);if(!v||v.id!==id||!Array.isArray(v.records)||v.records.filter(r=>r.role==='draft'&&!r.missing).length!==1)fail('Trusted original must identify exactly one current DEV.',400);readable(v.parentStudyKey,'Original parent study');readable(v.partKey,'Original part');for(const r of v.records){if(r.missing||r.raw===null)continue;if(typeof r.raw!=='string'||Buffer.byteLength(r.raw)>2*1024*1024||!r.hash||digest(r.raw)!==r.hash)fail('Original record hash or readable bytes changed.');}return v;}
 const dirs=b=>({room:location(b.id),workflow:path.join(location(b.id),'workflow'),media:path.join(location(b.id),'media'),metadata:path.join(location(b.id),'metadata'),capture:path.join(location(b.id),'capture')});
 function owner(b){const d=dirs(b);return createBoundProjectFolders({dataDir:d.metadata,roots:{workflow:d.workflow,media:d.media},ask,draft,writableWorkingRecords:true,beforeCommit,afterCommit,...(relocation?{ownedRelocation:relocation.binding}:{})});}
 function capture(b){const file=path.join(dirs(b).room,'capture-manifest.json');regular(file);const raw=fs.readFileSync(file,'utf8');if(digest(raw)!==b.captureHash)fail('Captured original provenance changed; existing working words preserved.');const v=JSON.parse(raw);if(!Array.isArray(v.records)||v.records.some(r=>!r.missing&&(!path.isAbsolute(r.copiedPath||'')||(!relocation&&path.dirname(r.copiedPath)!==dirs(b).capture))))fail('Captured file must remain inside its owned copy.');if(v.bindingId!==b.id||v.originalId!==b.originalId||v.parentStudyId!==b.parentStudyId)fail('Captured study identity changed.');return {...v,records:v.records.map(r=>{if(r.missing)return r;const copiedPath=relocation?relocation.capture(b.id,r,dirs(b).capture):r.copiedPath;regular(copiedPath);const bytes=fs.readFileSync(copiedPath);if(digest(bytes)!==r.copiedHash||r.copiedHash!==r.sourceHash)fail('Read-only source capture changed; existing draft preserved.');return {...r,raw:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};})};}
 function capturedRecordMetadata(b){return capture(b).records.filter(r=>r.role!=='draft').map(r=>{const fileName=path.basename(r.sourcePath||r.id||'Captured record'),known=fileName.match(/^(RAW|SRC|IDEA|MOMENTS|RESEARCH|BRIEF|NOTES|CONTEXT|READ|MAP|PLAN|REFERENCE)\b/i),kind=known?known[1].toUpperCase():({source:'SRC',context:'CONTEXT',research:'RESEARCH',brief:'BRIEF',notes:'NOTES',map:'MAP',plan:'PLAN'}[r.role]||'SRC');return {id:r.id,role:r.role,kind,fileName,title:fileName.replace(/\.md$/i,'').replace(/^[A-Z]+\s*-\s*/,''),hash:r.copiedHash||null,missing:!!r.missing};});}
 function history(b,service,raw,currentModel){const area=path.join(dirs(b).metadata,'ar-project-folder-bindings'),prefix=b.id+'-';return fs.readdirSync(area).filter(name=>name.startsWith(prefix)&&name.endsWith('.operation.json')).map(name=>{const operationId=name.slice(prefix.length,-'.operation.json'.length),receipt=service.inspectOperation({projectId:b.id,operationId}),change=receipt.changes.find(c=>c.relativePath===b.draftRelative);return {operationId,kind:receipt.kind,state:receipt.state,beforeHash:change?.beforeHash||null,afterHash:change?.afterHash||null,hasVersion:receipt.changes.some(change=>change.area==='binding-metadata'&&change.beforeHash!==change.afterHash),canUndo:canUndoVersion({receipt,projectId:b.id,draftRelative:b.draftRelative,sourceKey:currentModel?.sourceKey},currentModel,raw),modifiedAt:fs.statSync(path.join(area,name)).mtime.toISOString(),...draftLedger.lookup({area:'draft',scopeId:b.id,key:operationId,action:'op'})};}).sort((a,b)=>a.modifiedAt.localeCompare(b.modifiedAt));}
 function previewVersion(input){
  const b=binding(input),service=owner(b),current=readOwned(b);
  if(!uuid.test(input.versionOperationId||'')||!['before','after'].includes(input.position))fail('Choose an exact saved version.',400);
  const receipt=service.inspectOperation({projectId:b.id,operationId:input.versionOperationId});if(receipt.state!=='committed')fail('This version is not committed.');
  const metadata=readJson(path.join(dirs(b).metadata,'ar-project-folder-bindings',b.id+'.draft-correspondence.json'),null);
  const {model,raw}=historicalVersion({receipt,projectId:b.id,draftRelative:b.draftRelative,sourceKey:metadata?.sourceKey,position:input.position});
  return {bindingId:b.id,parentStudyId:b.parentStudyId,versionOperationId:input.versionOperationId,position:input.position,hash:model.fileHash,raw,projection:projectDraft(model).map(row=>({...row,raw:model.blocks.find(block=>block.id===row.id).raw})),expected:current.expected};
 }
 function validateStructureTest(b,{allowPendingWithoutSeed=false}={}){
  if(b.origin!=='structure-test'){if(Object.hasOwn(b,'structureTest'))fail('Structure-test metadata cannot be attached to an ordinary native owner.');return;}
  const m=b.structureTest,hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  if(!['pending','ready'].includes(b.status)||b.kind!=='collection-root'||!uuid.test(b.id||'')||!uuid.test(b.operationId||'')||b.parentStudyId!=='structure-test-'+b.operationId||b.parentStudyKey!==b.parentStudyId||!m||Object.keys(m).sort().join(',')!=='captureHash,createdBy,draftHash,expected,label,role,sourceBindingId,sourceParentStudyId'||!AGENT_ACTORS.includes(m.createdBy)||m.role!=='structure-test'||m.label!=='stand-in'||!uuid.test(m.sourceBindingId||'')||m.sourceBindingId===b.id||typeof m.sourceParentStudyId!=='string'||!m.sourceParentStudyId.trim()||m.sourceParentStudyId===b.parentStudyId||!hash(m.draftHash)||!hash(m.captureHash)||!hash(b.structureTestSeedHash)||m.draftHash!==b.seedWorkingHash||m.expected?.workflow?.draft!==m.draftHash||b.key!==digest(stable({parentStudyId:b.parentStudyId,origin:'structure-test'})))fail('Structure-test owner identity or metadata changed.');
  const input={sourceBindingId:m.sourceBindingId,sourceParentStudyId:m.sourceParentStudyId,expected:m.expected,title:b.title,operationId:b.operationId};
  if(digest(stable(input))!==b.structureTestInputHash)fail('Structure-test exact creation identity changed.');
  const file=path.join(dirs(b).room,'structure-test-seed.json');if(!fs.existsSync(file)){if(allowPendingWithoutSeed&&b.status==='pending')return;fail('Immutable structure-test seed is unavailable.');}regular(file);const seed=readJson(file,null);
  if(!seed||digest(stable(seed))!==b.structureTestSeedHash||seed.schema!=='ar-create.structure-test-seed.v1'||seed.bindingId!==b.id||seed.parentStudyId!==b.parentStudyId||seed.originalId!==b.originalId||seed.originalHash!==b.originalHash||seed.draftRelative!==b.draftRelative||stable(seed.structureTest)!==stable(m)||typeof seed.workingRaw!=='string'||digest(seed.workingRaw)!==m.draftHash||!Array.isArray(seed.records)||seed.records.filter(r=>r.role==='draft'&&!r.missing).length!==1||seed.records.some(r=>!r.missing&&(typeof r.raw!=='string'||!hash(r.hash)||digest(r.raw)!==r.hash)))fail('Immutable structure-test seed or metadata changed.');
 }
 function readOwned(b){validateStructureTest(b);validateCollectionSource(b);const registeredOutput=outputRegistration(b),service=owner(b),captured=capture(b),addedSources=addedForRead(added(b)),readiness=service.workflowReadiness(b.id),status=service.readDraftStatus(b.id),workflow=service.readWorkflow(b.id);let projection=null,currentModel=null;
  if(readiness.ready&&status.initialized){const native=service.readDraftProjection(b.id),metadata=readJson(path.join(dirs(b).metadata,'ar-project-folder-bindings',b.id+'.draft-correspondence.json'),null),model=snapshot(workflow.draft,metadata,metadata?.sourceKey);currentModel=model;projection=native.projection.map(p=>({...p,raw:model.blocks.find(block=>block.id===p.id).raw}));}
  let originalChanged=false;if(b.origin!=='authored-collection')try{originalChanged=original(b.originalId).records.find(r=>r.role==='draft').hash!==b.originalHash;}catch{originalChanged=true;}
  return {binding:{id:b.id,parentStudyId:b.parentStudyId,parentStudyKey:b.parentStudyKey,partKey:b.partKey,title:b.title,originalId:b.originalId,originalHash:b.originalHash,status:b.status,createdAt:b.createdAt,authority:'owned-working-copy',...(b.origin?{origin:b.origin}:{}),...(b.structureTest?{structureTest:structuredClone(b.structureTest)}:{}),...(b.collectionSource?{collectionSource:structuredClone(b.collectionSource)}:{}),...(b.kind==='collection-root'?{kind:b.kind}:{}),...(b.textOutputKind?{textOutputKind:b.textOutputKind}:{}),...(registeredOutput?{canonicalOutputId:registeredOutput.outputId,derivedFrom:structuredClone(registeredOutput.derivedFrom)}:{}),...(b.kind==='output-fork'?{kind:b.kind,outputId:b.outputId,canonicalOutputId:b.outputId,sourceBindingId:b.derivedFrom.bindingId,seedWorkingHash:b.seedWorkingHash,derivedFrom:structuredClone(b.derivedFrom)}:{})},approvalReview:{role:'explicit-human-native-markup-decision',blocks:(projection||[]).map(row=>({id:row.id,seenBlockHash:row.blockHash,spans:approvalSpans(row.raw)})).filter(row=>row.spans.length)},raw:workflow.draft,projection,expected:status.expected,history:history(b,service,workflow.draft,currentModel),readiness,originalChanged,paths:{draft:path.join(dirs(b).workflow,b.draftRelative),edits:path.join(dirs(b).workflow,'Workflow/4-Review/EDITS - '+path.basename(b.draftRelative)),manifest:path.join(dirs(b).room,'capture-manifest.json')},context:captured,...(addedSources?{addedSources}:{})};
 }
 function inputFields(input,allowed){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))fail('Malformed request: caller snapshots, paths and unsupported fields are refused.',400);if(!uuid.test(input.operationId||''))fail('Operation UUID required.',400);}
 const blankRaw=title=>'---\ntitle: '+JSON.stringify(title)+'\n---\n';
 function collectionSeed(b,parent){
  const records=[{id:'collection-initial-edition',role:'draft',path:path.join(dirs(b).workflow,b.draftRelative),raw:blankRaw(b.title),hash:b.originalHash},...parent.context.records.filter(r=>r.role!=='draft').map(r=>r.missing?{id:r.id,role:r.role,path:r.sourcePath,raw:null,hash:null,missing:true}:{id:r.id,role:r.role,path:r.sourcePath,raw:r.raw,hash:r.copiedHash})];
  if(new Set(records.map(r=>r.id)).size!==records.length)fail('Retained collection source identities collide.');
  return {schema:'ar-create.collection-source-seed.v1',bindingId:b.id,parentStudyId:b.parentStudyId,source:b.collectionSource,records};
 }
 function validateCollectionSource(b,{allowPendingWithoutSeed=false}={}){
  if(!b.collectionSource){if(b.collectionSourceSeedHash)fail('Collection source provenance is missing.');return null;}
  const source=b.collectionSource,input={parentStudyId:b.parentStudyId,title:b.title,operationId:b.operationId,sourceBindingId:source.bindingId,sourceParentStudyId:source.parentStudyId,expected:source.expected};
  if(b.kind!=='collection-root'||b.origin!=='authored-collection'||!uuid.test(source.bindingId||'')||source.bindingId===b.id||source.parentStudyId===b.parentStudyId||source.relationship!=='archival-source-captures-only-not-wording-or-live-authority'||source.draftHash!==source.expected?.workflow?.draft||digest(stable(input))!==b.collectionInputHash)fail('Collection source creation identity changed.');
  const file=path.join(dirs(b).room,'collection-source-seed.json');if(!fs.existsSync(file)){if(allowPendingWithoutSeed&&b.status==='pending')return null;fail('Immutable collection source seed is unavailable.');}regular(file);const seed=readJson(file,null);
  if(!seed||digest(stable(seed))!==b.collectionSourceSeedHash||seed.schema!=='ar-create.collection-source-seed.v1'||seed.bindingId!==b.id||seed.parentStudyId!==b.parentStudyId||stable(seed.source)!==stable(source)||!Array.isArray(seed.records)||seed.records.filter(r=>r.role==='draft').length!==1||seed.records.find(r=>r.role==='draft')?.raw!==blankRaw(b.title)||new Set(seed.records.map(r=>r.id)).size!==seed.records.length||seed.records.some(r=>!r.missing&&(typeof r.raw!=='string'||digest(r.raw)!==r.hash)))fail('Immutable collection source capture changed.');
  return seed;
 }
 async function createCollection(input){
  inputFields(input,['parentStudyId','title','operationId','sourceBindingId','sourceParentStudyId','expected']);readable(input.parentStudyId,'Parent study ID');readable(input.title,'Collection title');
  const hasSource=['sourceBindingId','sourceParentStudyId','expected'].some(k=>Object.hasOwn(input,k));
  if(hasSource&&(!uuid.test(input.sourceBindingId||'')||typeof input.sourceParentStudyId!=='string'||!input.sourceParentStudyId.trim()||input.sourceParentStudyId===input.parentStudyId||!input.expected||typeof input.expected!=='object'||Array.isArray(input.expected)))fail('Select an exact owned source and saved revision for a separate empty Article.',400);
  const originalId='collection:'+input.parentStudyId,key=digest(stable({parentStudyId:input.parentStudyId,originalId})),file=path.join(intents,key+'.json'),inputHash=digest(stable(input)),all=allBindings();let b=readJson(file,null),parent=null;
  const readSource=()=>{const parent=readOwned(binding({bindingId:input.sourceBindingId,parentStudyId:input.sourceParentStudyId}));if(parent.readiness?.ready!==true||!parent.projection||stable(parent.expected)!==stable(input.expected))fail('Exact current saved native revision is required for retained collection sources.');if(!parent.context.records.some(r=>!r.missing&&['source','context','research','brief','notes','map','plan'].includes(r.role)))fail('Choose an owned piece with readable retained source material.',400);return parent;};
  if(outputRegistrations().some(row=>row.operationId===input.operationId)||all.some(row=>row.operationId===input.operationId&&(row.key!==key||row.collectionInputHash!==inputHash)))fail('Operation ID already belongs to a different native collection/copy/output.');
  if(b){if(b.kind!=='collection-root'||b.collectionInputHash!==inputHash||b.operationId!==input.operationId||b.parentStudyId!==input.parentStudyId||b.title!==input.title||hasSource!==!!b.collectionSource)fail('Collection already has a different native creation identity or exact input.');if(b.status==='ready')return readOwned(b);}
  else{
   if(hasSource)parent=readSource();
   const raw=blankRaw(input.title);b={schema:'ar-create.study-draft-copy.v1',kind:'collection-root',origin:'authored-collection',key,id:randomUUID(),status:'pending',parentStudyId:input.parentStudyId,parentStudyKey:input.parentStudyId,originalId,partKey:'collection',title:input.title,originalHash:digest(raw),seedWorkingHash:digest(raw),createdAt:new Date().toISOString(),operationId:input.operationId,prepareOperationId:randomUUID(),draftRelative:'Workflow/3-Develop/DEV - Collection.md',collectionInputHash:inputHash};
   if(parent){b.collectionSource={bindingId:parent.binding.id,parentStudyId:parent.binding.parentStudyId,expected:structuredClone(parent.expected),draftHash:digest(parent.raw),originalId:parent.binding.originalId,originalHash:parent.binding.originalHash,captureHash:binding({bindingId:parent.binding.id,parentStudyId:parent.binding.parentStudyId}).captureHash,relationship:'archival-source-captures-only-not-wording-or-live-authority'};b.collectionSourceSeedHash=digest(stable(collectionSeed(b,parent)));}
   atomicWrite(file,JSON.stringify(b,null,2),{exclusive:true});
  }
  if(hasSource){
   ensurePrivateDirectory(copies,b.id);const seedFile=path.join(dirs(b).room,'collection-source-seed.json');
   if(!fs.existsSync(seedFile)){parent||=readSource();const seed=collectionSeed(b,parent);if(digest(stable(seed))!==b.collectionSourceSeedHash)fail('Pending collection source capture changed; preserve its creation intent.');atomicWrite(seedFile,JSON.stringify(seed,null,2),{exclusive:true});fs.chmodSync(seedFile,0o400);}
   const seed=validateCollectionSource(b);return finishCopy(b,{id:b.originalId,records:seed.records});
  }
  const raw=blankRaw(b.title);return finishCopy(b,{id:b.originalId,records:[{id:'collection-initial-edition',role:'draft',path:path.join(dirs(b).workflow,b.draftRelative),raw,hash:digest(raw)}]});
 }
 // Agent-only isolated stand-in. Immutable original captures and current working
 // bytes remain separate, both pinned before the normal copy preparation begins.
 async function cloneStructureTest(input){
  inputFields(input,['sourceBindingId','sourceParentStudyId','expected','title','operationId']);
  const actor=currentActor()?.actor;if(!AGENT_ACTORS.includes(actor))fail('Structure-test copy requires an explicit agent actor.',403);
  if(!uuid.test(input.sourceBindingId||''))fail('Exact source binding UUID required.',400);
  readable(input.sourceParentStudyId,'Source parent study ID');readable(input.title,'Stand-in subject title');
  const parentStudyId='structure-test-'+input.operationId,key=digest(stable({parentStudyId,origin:'structure-test'})),inputHash=digest(stable(input)),file=path.join(intents,key+'.json'),all=allBindings();let b=readJson(file,null),parent=null;
  if(outputRegistrations().some(row=>row.operationId===input.operationId)||all.some(row=>row.operationId===input.operationId&&(row.key!==key||row.structureTestInputHash!==inputHash)))fail('Operation ID already belongs to a different native operation.');
  if(all.some(row=>row.parentStudyId===parentStudyId&&row.key!==key))fail('Structure-test parent identity is already owned.');
  if(b){
   if(b.origin!=='structure-test'||b.kind!=='collection-root'||b.key!==key||b.parentStudyId!==parentStudyId||b.structureTestInputHash!==inputHash||b.structureTest?.createdBy!==actor||b.structureTest?.sourceBindingId!==input.sourceBindingId||b.structureTest?.sourceParentStudyId!==input.sourceParentStudyId||stable(b.structureTest?.expected)!==stable(input.expected)||all.filter(row=>row.id===b.id).length!==1)fail('Structure-test identity or exact creation input changed.');
  }else{
   if(all.filter(row=>row.id===input.sourceBindingId).length!==1)fail('Exact unique source native binding required.');
   const source=binding({bindingId:input.sourceBindingId,parentStudyId:input.sourceParentStudyId});parent=readOwned(source);
   if(parent.readiness?.ready!==true||!parent.projection||stable(parent.expected)!==stable(input.expected))fail('Exact current saved native expected revision required for structure-test copy.');
   b={schema:'ar-create.study-draft-copy.v1',kind:'collection-root',origin:'structure-test',key,id:randomUUID(),status:'pending',parentStudyId,parentStudyKey:parentStudyId,originalId:source.originalId,partKey:source.partKey,title:input.title,originalHash:source.originalHash,seedWorkingHash:digest(parent.raw),createdAt:new Date().toISOString(),operationId:input.operationId,prepareOperationId:randomUUID(),draftRelative:source.draftRelative,structureTestInputHash:inputHash,structureTest:{sourceBindingId:source.id,sourceParentStudyId:source.parentStudyId,expected:structuredClone(input.expected),draftHash:digest(parent.raw),captureHash:source.captureHash,createdBy:actor,role:'structure-test',label:'stand-in'}};
   if(all.some(row=>row.id===b.id))fail('Generated structure-test binding ID collided.');
   b.structureTestSeedHash=digest(stable(structureSeed(parent,b)));atomicWrite(file,JSON.stringify(b,null,2),{exclusive:true});
  }
  ensurePrivateDirectory(copies,b.id);const seedFile=path.join(dirs(b).room,'structure-test-seed.json');let seed=readJson(seedFile,null);
  if(seed){regular(seedFile);if(digest(stable(seed))!==b.structureTestSeedHash)fail('Immutable structure-test seed changed.');}
  else{
   if(!parent){parent=readOwned(binding({bindingId:input.sourceBindingId,parentStudyId:input.sourceParentStudyId}));if(stable(parent.expected)!==stable(input.expected))fail('Source changed before immutable seed was saved; preserve pending intent.');}
   seed=structureSeed(parent,b);if(digest(stable(seed))!==b.structureTestSeedHash)fail('Structure-test seed no longer matches the exact source edition.');atomicWrite(seedFile,JSON.stringify(seed,null,2),{exclusive:true});fs.chmodSync(seedFile,0o400);
  }
  if(seed.bindingId!==b.id||seed.parentStudyId!==b.parentStudyId||stable(seed.structureTest)!==stable(b.structureTest)||digest(seed.workingRaw)!==b.seedWorkingHash||!Array.isArray(seed.records)||seed.records.filter(r=>r.role==='draft'&&!r.missing).length!==1)fail('Structure-test seed identity changed.');
  for(const r of seed.records)if(!r.missing&&(typeof r.raw!=='string'||digest(r.raw)!==r.hash))fail('Structure-test capture seed bytes changed.');
  if(b.status==='ready')return readOwned(b);
  return finishCopy(b,{id:b.originalId,records:seed.records,workingRaw:seed.workingRaw});
 }
 function structureSeed(parent,b){return {schema:'ar-create.structure-test-seed.v1',bindingId:b.id,parentStudyId:b.parentStudyId,originalId:b.originalId,originalHash:b.originalHash,draftRelative:b.draftRelative,structureTest:structuredClone(b.structureTest),workingRaw:parent.raw,records:parent.context.records.map(r=>r.missing?{id:r.id,role:r.role,path:r.sourcePath,raw:null,hash:null,missing:true}:{id:r.id,role:r.role,path:r.sourcePath,raw:r.raw,hash:r.copiedHash})};}
 async function openCopy(input){inputFields(input,['originalId','originalHash','parentStudyId','operationId']);readable(input.parentStudyId,'Parent study ID');const source=original(input.originalId);if(source.parentStudyKey!==input.parentStudyId)fail('Original belongs to a different parent study.');const key=digest(stable({parentStudyId:input.parentStudyId,originalId:input.originalId})),file=path.join(intents,key+'.json');let b=readJson(file,null);
  if(b?.status==='ready')return readOwned(b);
  // A registered magazine story is edited in place in the vault (magazine-vault); no new working copy is made.
  // Existing copies stay readable until Adrian chooses between them (magazine.reconcile, D7).
  if(!b){const bound=vaultBound?.(source);if(bound)fail(bound,409);}
  const selected=source.records.find(r=>r.role==='draft');if(input.originalHash!==selected.hash)fail('Review the exact current original DEV hash before making a copy.');
  if(!b){b={schema:'ar-create.study-draft-copy.v1',key,id:randomUUID(),status:'pending',parentStudyId:input.parentStudyId,parentStudyKey:source.parentStudyKey,originalId:source.id,partKey:source.partKey,title:source.title,originalHash:selected.hash,createdAt:new Date().toISOString(),operationId:input.operationId,prepareOperationId:randomUUID(),draftRelative:'Workflow/3-Develop/'+path.basename(selected.path)};if(!/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(b.draftRelative))fail('Trusted original DEV filename is unsupported.',400);atomicWrite(file,JSON.stringify(b,null,2),{exclusive:true});}else if(b.originalHash!==selected.hash)fail('Original changed during an unfinished copy; captured copy intent is preserved.');
  return finishCopy(b,source);
 }
 function finishCopy(b,source){
  const d=dirs(b);for(const dir of [d.room,d.workflow,d.media,d.metadata,d.capture,path.join(d.media,'Project'),path.join(d.workflow,'Derived'),path.join(d.workflow,'Workflow/3-Develop'),path.join(d.workflow,'Workflow/4-Review')])ensurePrivateDirectory(copies,path.relative(copies,dir));
  const manifestFile=path.join(d.room,'capture-manifest.json');let manifest=readJson(manifestFile,null);
  if(!manifest){const records=[];for(const [index,r] of source.records.entries()){if(r.missing||r.raw===null){records.push({id:r.id,role:r.role,sourcePath:r.path,missing:true});continue;}const copiedPath=path.join(d.capture,String(index)+'-'+path.basename(r.path));if(fs.existsSync(copiedPath)){regular(copiedPath);if(digest(fs.readFileSync(copiedPath))!==r.hash)fail('Interrupted copy bytes differ; existing capture preserved.');}else{atomicWrite(copiedPath,r.raw,{exclusive:true});fs.chmodSync(copiedPath,0o400);if(afterCopyFile)afterCopyFile({binding:b,record:r,copiedPath});}records.push({id:r.id,role:r.role,sourcePath:r.path,sourceHash:r.hash,copiedPath,copiedHash:r.hash});}manifest={schema:'ar-create.study-draft-capture.v1',bindingId:b.id,originalId:b.originalId,parentStudyId:b.parentStudyId,capturedAt:new Date().toISOString(),records,...(b.origin?{origin:b.origin}:{})};atomicWrite(manifestFile,JSON.stringify(manifest,null,2),{exclusive:true});fs.chmodSync(manifestFile,0o400);}
  const expectedRecords=source.records.map(r=>({id:r.id,role:r.role,sourcePath:r.path,sourceHash:r.missing||r.raw===null?null:r.hash})),actualRecords=manifest.records.map(r=>({id:r.id,role:r.role,sourcePath:r.sourcePath,sourceHash:r.missing?null:r.sourceHash}));if(stable(expectedRecords)!==stable(actualRecords))fail('Interrupted capture manifest differs from the exact trusted records.');b.captureHash=digest(fs.readFileSync(manifestFile));persist(b);const draftFile=path.join(d.workflow,b.draftRelative),capturedDraft=manifest.records.find(r=>r.role==='draft');if(fs.existsSync(draftFile)){regular(draftFile);if(digest(fs.readFileSync(draftFile))!==(b.seedWorkingHash??b.originalHash))fail('Existing working copy has edits; incomplete copy cannot overwrite them.');}else{const seed=source.workingRaw===undefined?fs.readFileSync(capturedDraft.copiedPath):source.workingRaw;if(digest(seed)!==(b.seedWorkingHash??b.originalHash))fail('Initial working bytes differ from the exact recorded seed.');atomicWrite(draftFile,seed,{exclusive:true});}
  const service=owner(b);try{service.readBinding(b.id);}catch(error){if(error.status!==404)throw error;service.bind({projectId:b.id,mediaFolder:'Project',derivedFolder:'Derived',records:{draft:b.draftRelative},draftAuthority:'owned-working-copy'});}
  const readiness=service.workflowReadiness(b.id);if(!readiness.ready)return readOwned(b);if(!service.readDraftStatus(b.id).initialized)service.prepareDraftCorrespondence({projectId:b.id,operationId:b.prepareOperationId,expected:service.readDraftStatus(b.id).expected});b.status='ready';b.readyAt=new Date().toISOString();persist(b);return readOwned(b);
 }

 function forkSeed(parent,b){
  const captured=parent.context.records;
  return {schema:'ar-create.study-native-fork-seed.v1',bindingId:b.id,parentStudyId:b.parentStudyId,sourceBindingId:b.derivedFrom.bindingId,outputId:b.outputId,originalId:b.originalId,originalHash:b.originalHash,seedWorkingHash:b.seedWorkingHash,derivedFrom:structuredClone(b.derivedFrom),records:captured.map(r=>r.role==='draft'?{id:r.id,role:r.role,path:parent.paths.draft,raw:b.textOutputKind?blankRaw(b.title):parent.raw,hash:b.seedWorkingHash}:r.missing?{id:r.id,role:r.role,path:r.sourcePath,raw:null,hash:null,missing:true}:{id:r.id,role:r.role,path:r.sourcePath,raw:r.raw,hash:r.copiedHash})};
 }
 function validateFork(b,input,key){
  if(!b||b.schema!=='ar-create.study-draft-copy.v1'||b.kind!=='output-fork'||b.key!==key||b.outputId!==input.outputId||b.parentStudyId!==input.parentStudyId||b.derivedFrom?.bindingId!==input.sourceBindingId||b.forkInputHash!==digest(stable(input))||stable(b.derivedFrom.expected)!==stable(input.expected)||b.textOutputKind!==input.textOutputKind||(!b.textOutputKind&&b.seedWorkingHash!==input.expected?.workflow?.draft)||b.derivedFrom.rawHash!==input.expected?.workflow?.draft||!uuid.test(b.id||'')||!['pending','ready'].includes(b.status))fail('Output is registered with a different fork identity or exact input.');
  if(allBindings().filter(row=>row.id===b.id).length!==1)fail('Native fork binding ID collision; registration preserved.');
 }
 async function fork(input){
  inputFields(input,['sourceBindingId','parentStudyId','outputId','operationId','expected','textOutputKind']);readable(input.parentStudyId,'Parent study ID');if(input.textOutputKind!==undefined&&!['post','product-listing'].includes(input.textOutputKind))fail('Supported short text output kind required.',400);if(!uuid.test(input.sourceBindingId||'')||!uuid.test(input.outputId||''))fail('Explicit source binding and output UUID required.',400);
  const key=digest(stable({parentStudyId:input.parentStudyId,sourceBindingId:input.sourceBindingId,outputId:input.outputId})),location=path.join(intents,key+'.json'),inputHash=digest(stable(input)),all=allBindings(),prior=readJson(location,null),links=outputRegistrations();
  if(links.some(row=>row.operationId===input.operationId))fail('Operation ID already belongs to a native output registration.');
  if(links.some(row=>row.outputId===input.outputId&&row.bindingId!==prior?.id))fail('Output ID already registered to another native owner.');
  if(all.some(row=>row.operationId===input.operationId&&(row.key!==key||row.forkInputHash!==inputHash)))fail('Operation ID already belongs to a different native copy/fork.');
  if(all.some(row=>row.id===input.outputId||row.kind==='output-fork'&&row.outputId===input.outputId&&row.key!==key))fail('Output ID already belongs to a different native binding/registration.');
  let b=prior,parent=null;
  if(b){validateFork(b,input,key);if(b.status==='ready')return readOwned(b);}
  else{
   if(all.filter(row=>row.id===input.sourceBindingId).length!==1)fail('Exact unique source native binding required; ID collision or missing owner.');
   const source=binding({bindingId:input.sourceBindingId,parentStudyId:input.parentStudyId});parent=readOwned(source);
   if(parent.readiness?.ready!==true||!parent.projection||stable(parent.expected)!==stable(input.expected))fail('Exact current saved native expected revision is required for this fork.');
   b={schema:'ar-create.study-draft-copy.v1',kind:'output-fork',key,id:randomUUID(),status:'pending',parentStudyId:source.parentStudyId,parentStudyKey:source.parentStudyKey,originalId:source.originalId,partKey:source.partKey,title:source.title,...(source.origin&&source.origin!=='structure-test'?{origin:source.origin}:{}),...(input.textOutputKind?{textOutputKind:input.textOutputKind}:{}),originalHash:source.originalHash,seedWorkingHash:digest(input.textOutputKind?blankRaw(source.title):parent.raw),outputId:input.outputId,createdAt:new Date().toISOString(),operationId:input.operationId,prepareOperationId:randomUUID(),draftRelative:source.draftRelative,forkInputHash:inputHash,derivedFrom:{bindingId:source.id,expected:structuredClone(input.expected),rawHash:digest(parent.raw),captureHash:source.captureHash,relationship:'archival-starting-edition-not-continuous-wording-or-freshness-authority'}};
   if(all.some(row=>row.id===b.id))fail('Generated native fork binding ID collided; no registration written.');
   b.seedHash=digest(stable(forkSeed(parent,b)));atomicWrite(location,JSON.stringify(b,null,2),{exclusive:true});
  }
  const d=dirs(b);ensurePrivateDirectory(copies,b.id);const seedFile=path.join(d.room,'fork-seed.json');let seed=readJson(seedFile,null);
  if(seed){if(digest(stable(seed))!==b.seedHash)fail('Immutable native fork seed changed; preserve child and parent words.');regular(seedFile);}
  else{if(!parent){parent=readOwned(binding({bindingId:input.sourceBindingId,parentStudyId:input.parentStudyId}));if(stable(parent.expected)!==stable(b.derivedFrom.expected))fail('Fork intent has no saved seed and parent changed; preserve intent instead of guessing bytes.');}seed=forkSeed(parent,b);if(digest(stable(seed))!==b.seedHash)fail('Pending fork seed differs from its exact recorded source edition.');atomicWrite(seedFile,JSON.stringify(seed,null,2),{exclusive:true});fs.chmodSync(seedFile,0o400);}
  if(seed.schema!=='ar-create.study-native-fork-seed.v1'||seed.bindingId!==b.id||seed.sourceBindingId!==input.sourceBindingId||seed.outputId!==b.outputId||seed.seedWorkingHash!==b.seedWorkingHash||seed.originalHash!==b.originalHash||!Array.isArray(seed.records)||seed.records.filter(r=>r.role==='draft').length!==1)fail('Fork seed identity/provenance changed.');
  for(const record of seed.records)if(!record.missing&&(typeof record.raw!=='string'||digest(record.raw)!==record.hash))fail('Fork source/context seed bytes changed.');
  const draft=seed.records.find(r=>r.role==='draft');if(digest(draft.raw)!==b.seedWorkingHash)fail('Fork initial working draft does not match its separate seed hash.');
  return finishCopy(b,{id:b.originalId,records:seed.records});
 }
 async function registerOutput(input){
  inputFields(input,['bindingId','parentStudyId','outputId','operationId','expected']);readable(input.parentStudyId,'Parent study ID');if(!uuid.test(input.bindingId||'')||!uuid.test(input.outputId||''))fail('Explicit native binding and output UUID required.',400);
  const b=binding(input),all=allBindings(),links=outputRegistrations(),inputHash=digest(stable(input));
  if(all.some(row=>row.operationId===input.operationId)||links.some(row=>row.operationId===input.operationId&&(row.bindingId!==b.id||row.inputHash!==inputHash)))fail('Operation ID already belongs to another native copy/fork/registration.');
  if(all.some(row=>row.id===input.outputId)||all.some(row=>row.kind==='output-fork'&&row.outputId===input.outputId&&row.id!==b.id)||links.some(row=>row.outputId===input.outputId&&row.bindingId!==b.id))fail('Output ID already owned by a different native registration.');
  if(all.filter(row=>row.id===b.id).length!==1)fail('Native binding ID collision; registration refused.');
  const existing=outputRegistration(b);if(existing){if(existing.outputId!==input.outputId||existing.inputHash!==inputHash||existing.operationId!==input.operationId)fail('Native binding already has a different output registration or exact input.');return readOwned(b);}
  if(b.kind==='output-fork'&&b.outputId!==input.outputId)fail('Native fork already belongs to a different output.');
  const saved=readOwned(b);if(saved.readiness?.ready!==true||!saved.projection||stable(saved.expected)!==stable(input.expected))fail('Exact current saved native expected revision required for output registration.');
  const registered={schema:'ar-create.study-native-output-binding.v1',bindingId:b.id,parentStudyId:b.parentStudyId,outputId:input.outputId,originalId:b.originalId,originalHash:b.originalHash,operationId:input.operationId,inputHash,registeredAt:new Date().toISOString(),derivedFrom:{bindingId:b.id,expected:structuredClone(input.expected),originalId:b.originalId,originalHash:b.originalHash,relationship:'archival-registration-of-existing-canonical-wording-owner-not-shared-wording-freshness'}};
  atomicWrite(path.join(outputLinks,b.id+'.json'),JSON.stringify(registered,null,2),{exclusive:true});return readOwned(b);
 }
 async function withSnapshotLease(input,fn){
  const captured=structuredClone(input);
  if(!captured||typeof captured!=='object'||Array.isArray(captured)||Object.keys(captured).some(key=>!['bindingId','parentStudyId','expected','related'].includes(key))||!uuid.test(captured.bindingId||'')||!readable(captured.parentStudyId)||typeof fn!=='function')fail('Trusted exact native snapshot lease fields and callback required.',400);
  return serial(async()=>{
   const b=binding(captured),snapshot=readOwned(b);
   if(snapshot.readiness?.ready!==true||!snapshot.projection||stable(snapshot.expected)!==stable(captured.expected))fail('Exact ready current native expected proof required for snapshot lease.');
   const related=captured.related;
   if(Object.hasOwn(captured,'related')&&(!related||typeof related!=='object'||Array.isArray(related)||Object.keys(related).sort().join(',')!=='bindingId,expected,parentStudyId'||related.parentStudyId!==captured.parentStudyId||!uuid.test(related.bindingId||'')||b.kind!=='output-fork'||b.derivedFrom?.bindingId!==related.bindingId))fail('Related native source must be the exact authorized fork parent.',400);
   const readRelated=()=>{if(!related)return null;const value=readOwned(binding(related));if(value.readiness?.ready!==true||!value.projection||stable(value.expected)!==stable(related.expected))fail('Related native source changed; preserve the prepared fork.');return value;};
   if(related)readRelated();
   let active=true;const reread=()=>{if(!active)fail('Native snapshot lease has ended; use a fresh exact lease.');return readOwned(b);};
   const rereadRelated=()=>{if(!active)fail('Related native source lease ended.');return readRelated();};
   try{return await fn({snapshot,reread,...(related?{rereadRelated}:{})});}finally{active=false;}
  });
 }
 function standInReview(input){
  inputFields(input,['bindingId','parentStudyId','operationId','expected','id','rawFrom','rawTo','seenBlockHash','seenMarkupHash']);
  if(!AGENT_ACTORS.includes(currentActor()?.actor))fail('Stand-in mark review requires an explicit agent actor.',403);
  const b=binding(input);if(b.origin!=='structure-test'||b.kind!=='collection-root')fail('Stand-in mark review requires the immutable structure-test root.',403);
  validateStructureTest(b);capture(b);
  const operation={kind:'standInReviewMark',decisionRole:'stand-in',...Object.fromEntries(['id','rawFrom','rawTo','seenBlockHash','seenMarkupHash'].map(key=>[key,input[key]]))};
  owner(b).applyDraftOperations({projectId:b.id,operationId:input.operationId,expected:input.expected,operations:[operation]},{structureTestStandIn:true,beforeIntent:()=>{const current=binding(input);if(current.id!==b.id||current.origin!=='structure-test'||current.kind!=='collection-root')fail('Structure-test stand-in authority changed.');validateStructureTest(current);capture(current);}});
  return readOwned(b);
 }
 function saveReviewedLanguage(input,internal){
  inputFields(input,['bindingId','parentStudyId','operationId','expected','operations','sourceBindingId','sourceOutputId','sourceExpected','sourceRawHash','sourceCaptureHash','sourceUnits','requestId','targetLanguage','targetOutputId','decision']);
  if(typeof internal?.validateReview!=='function'||typeof internal.beforeIntent!=='function')fail('Reviewed language writing requires the retained language owner capability.',403);
  const b=binding(input),source=binding({bindingId:input.sourceBindingId,parentStudyId:input.parentStudyId}),decision=input.decision,actor=currentActor()?.actor;
  if(b.kind!=='output-fork'||b.outputId!==input.targetOutputId||b.id===source.id||b.derivedFrom?.bindingId!==source.id||b.derivedFrom.rawHash!==input.sourceRawHash||stable(b.derivedFrom.expected)!==stable(input.sourceExpected)||b.textOutputKind||input.targetLanguage!=='zh-Hans'||!uuid.test(input.requestId||'')||!uuid.test(input.sourceOutputId||'')||!/^[a-f0-9]{64}$/.test(input.sourceCaptureHash||'')||!uuid.test(decision?.operationId||'')||decision?.actor!==actor||decision.action!=='accepted')fail('Only the exact reviewed Chinese Article child can receive translated reader spans.',403);
  if(decision.role==='human'){if(!HUMAN_ACTORS.includes(actor))fail('Genuine human language review required.',403);}else if(decision.role==='stand-in'){
   if(!AGENT_ACTORS.includes(actor))fail('Registered-copy language reviewer required.',403);let ancestor=source,seen=new Set();while(ancestor.kind==='output-fork'){if(seen.has(ancestor.id))fail('Language source lineage loops.');seen.add(ancestor.id);ancestor=binding({bindingId:ancestor.derivedFrom.bindingId,parentStudyId:input.parentStudyId});}if(ancestor.kind!=='collection-root'||ancestor.origin!=='structure-test')fail('Stand-in language review requires its registered copy root.',403);validateStructureTest(ancestor);
  }else fail('Explicit human or registered-copy language decision required.',403);
  const registration=outputRegistration(source);if((source.kind==='output-fork'?source.outputId:registration?.outputId)!==input.sourceOutputId)fail('Reviewed translation belongs to another source output.');
  capture(b);capture(source);const original=readOwned(source);
  const checkSource=()=>{const now=readOwned(source);if(stable(now.expected)!==stable(input.sourceExpected)||digest(now.raw)!==input.sourceRawHash||currentActor()?.actor!==actor)fail('Reviewed language source, annotation proof or actor changed.');internal.beforeIntent();};checkSource();
  const child=readOwned(b),spans=languageDerivativeSpans(original,{bindingId:source.id,outputId:input.sourceOutputId}),units=input.sourceUnits;
  if(!Array.isArray(units)||!units.length||units.length>100||!Array.isArray(input.operations)||!input.operations.length||input.operations.length>100)fail('Bounded exact reviewed source units required.');
  const allowed=new Map();for(const unit of units){const p=unit?.pointer,row=original.projection[p?.blockIndex],map=spans.find(s=>s.id===row?.id)?.map;if(!map||p.bindingId!==source.id||row.id!==p.paragraphId||p.rawHash!==digest(row.raw)||p.blockHash!==row.blockHash||!Number.isSafeInteger(p.rawFrom)||!Number.isSafeInteger(p.rawTo)||p.rawTo<=p.rawFrom||row.raw.slice(p.rawFrom,p.rawTo)!==unit.text||!map.runs.some(r=>!r.locked&&r.rawFrom<=p.rawFrom&&r.rawTo>=p.rawTo))fail('Reviewed translation source span crosses native markup, note, term or source boundaries.');const target=child.projection[p.blockIndex];if(!target)fail('Language child source row mapping changed.');const key=target.id+':'+p.rawFrom+':'+p.rawTo;if(allowed.has(key))fail('Repeated reviewed language source span.');allowed.set(key,unit);}
  const used=new Set();let currentRows=new Map(child.projection.map(r=>[r.id,r.raw]));const sameInitial=digest(child.raw)===input.sourceRawHash;
  // Replay goes through the retained transaction receipt. A new save starts only
  // from the exact fork bytes and each replacement belongs to a reviewed unit.
  let receipt;try{receipt=owner(b).inspectOperation({projectId:b.id,operationId:input.operationId});}catch(error){if(error.status!==404)throw error;}
  if(!sameInitial&&receipt?.state!=='committed')fail('The language child changed before its reviewed translation.');
  if(sameInitial)for(const op of input.operations){const row=child.projection.find(r=>r.id===op.id),key=op.id+':'+op.from+':'+op.to,raw=currentRows.get(op.id);if(op.kind!=='reviewedLanguageText'||!row||!allowed.has(key)||used.has(key)||digest(raw)!==op.seenBlockHash)fail('Language save differs from its exact reviewed source span proof.');used.add(key);currentRows.set(op.id,raw.slice(0,op.from)+op.insert+raw.slice(op.to));}
  const canonical=value=>JSON.stringify(value,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  owner(b).applyDraftOperations({projectId:b.id,operationId:input.operationId,expected:input.expected,operations:structuredClone(input.operations)},{reviewedLanguageDerivative:{operationsHash:digest(canonical(input.operations))},beforeIntent:checkSource});return readOwned(b);
 }
 // Sources Adrian chose to use for Check. The locked capture-manifest.json is never opened for writing: each copy is a
 // new read-only file in capture/ named added-<operationId>-<n>.md, and one append-only, hash-chained record
 // (added-sources.json) names them. Only Check reads it (as draft.addedSources); every other reader of context is unchanged.
 const ADDED_SCHEMA='ar-create.study-draft-added-sources.v1',ADDED_COPY=/^added-[0-9a-f-]{36}-\d+\.md$/,SHA=/^[a-f0-9]{64}$/,MAX_ADDED_SOURCE=2*1024*1024,MAX_ADDED_TOTAL=4*1024*1024,ADDED_BROKEN='Captured sources for Check changed; nothing was used.',ADDED_DAMAGED='The sources saved for Check were changed outside the app, so Check will not run and nothing more can be added until that is put right.';
 const addedFile=b=>path.join(dirs(b).room,'added-sources.json'),addedEntryHash=e=>{const {entryHash:_,...rest}=e;return digest(stable(rest));};
 /** null when nothing was ever captured; {error} when the record or a copy no longer matches its pins. */
 function added(b){
  const file=addedFile(b);if(!fs.lstatSync(file,{throwIfNoEntry:false}))return null;
  try{
   regular(file);const raw=fs.readFileSync(file,'utf8'),v=JSON.parse(raw);
   if(v?.schema!==ADDED_SCHEMA||v.bindingId!==b.id||v.parentStudyId!==b.parentStudyId||v.captureHash!==b.captureHash||!Array.isArray(v.entries)||!v.entries.length)throw new Error('identity');
   let previous=b.captureHash;const latest=new Map(),names=new Set();
   for(const [i,e] of v.entries.entries()){
    if(!e||e.sequence!==i+1||e.previousHash!==previous||e.entryHash!==addedEntryHash(e)||!uuid.test(e.operationId||'')||!uuid.test(e.sourceId||'')||!['source','context'].includes(e.role)||!ADDED_COPY.test(e.copiedName||'')||!e.copiedName.startsWith('added-'+e.operationId+'-')||names.has(e.copiedName)||!SHA.test(e.copiedHash||'')||e.id!=='added:'+e.sourceId+':'+e.copiedHash.slice(0,12))throw new Error('chain');
    names.add(e.copiedName);const copiedPath=path.join(dirs(b).capture,e.copiedName);regular(copiedPath);const bytes=fs.readFileSync(copiedPath);if(digest(bytes)!==e.copiedHash)throw new Error('copy');
    latest.set(e.sourceId,{id:e.id,role:e.role,kind:e.kind,title:e.title,sourceId:e.sourceId,sourcePath:e.sourcePath,libraryHash:e.libraryHash,copiedPath,copiedHash:e.copiedHash,raw:new TextDecoder('utf-8',{fatal:true}).decode(bytes),capturedAt:e.capturedAt,actor:e.actor,operationId:e.operationId,review:e.review,added:true});previous=e.entryHash;
   }
   return {hash:digest(raw),entries:v.entries,records:[...latest.values()]};
  }catch{return {error:ADDED_BROKEN};}
 }
 // The read carries ids, titles, kinds, hashes and lengths, never the text: Check reads each copy from copiedPath and re-hashes it.
 const addedForRead=a=>a?a.error?{error:a.error}:{hash:a.hash,records:a.records.map(({raw,...r})=>({...r,length:raw.length}))}:null;
 /** Why this draft cannot take added sources, or null. Only a subject begun here; never a copy, stand-in or fork. */
 const cannotTakeSources=b=>b.kind!=='collection-root'||b.origin!=='authored-collection'?'Only a subject begun here can use material for Check. A copy, stand-in or fork reads the sources it was made with.':relocation?.has?.(b.id)?'This subject was moved from an older folder; its sources cannot be added here.':null;
 // Only a person's own confirmation, made on these exact bytes, lets material be used for Check. A review with no recorded
 // reviewer (made before reviews were stamped), or by an assistant, a schedule or an import, does not. The material
 // authority has already dropped a stamp made for other bytes. Role "source" (the words quotes are checked against) goes only
 // to a recording's own transcript, confirmed by a person; a file's own kind or front matter never earns it.
 const confirmedByHuman=r=>r?.review?.state==='reviewed'&&HUMAN_ACTORS.includes(r.review.by)&&(r.review.hash===undefined||r.review.hash===r.hash);
 const roleFor=r=>confirmedByHuman(r)&&r.review?.basis==='canonical-recording-review'?'source':'context';
 function humanOnly(){const actor=currentActor()?.actor;if(!actor||!HUMAN_ACTORS.includes(actor))fail('Using material for Check is for Adrian to do'+(actor?'; '+actor+' may not.':'.'),403);}
 async function captureSources(input,{material}={}){
  humanOnly();
  inputFields(input,['bindingId','parentStudyId','operationId','expectedSourcesHash','sources']);if(!uuid.test(input.bindingId||''))fail('Owned draft binding UUID required.',400);readable(input.parentStudyId,'Parent study ID');
  const {expectedSourcesHash,sources}=input;
  if(!Object.hasOwn(input,'expectedSourcesHash')||(expectedSourcesHash!==null&&!SHA.test(expectedSourcesHash||'')))fail('Send the hash of the captured sources you were shown, or null when there were none.',400);
  if(!Array.isArray(sources)||!sources.length||sources.length>20)fail('Choose one to twenty sources.',400);
  for(const s of sources)if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).sort().join()!=='sourceHash,sourceId'||!uuid.test(s.sourceId||'')||!SHA.test(s.sourceHash||''))fail('Each source needs its id and the hash you saw it at.',400);
  if(new Set(sources.map(s=>s.sourceId)).size!==sources.length)fail('Name each source once.',400);
  if(typeof material?.context!=='function')fail('Attached material is unavailable.',503);
  const b=binding(input),why=cannotTakeSources(b);if(why)fail(why);
  capture(b);
  const inputHash=digest(stable({bindingId:input.bindingId,parentStudyId:input.parentStudyId,expectedSourcesHash,sources}));
  const cur=added(b);if(cur?.error)fail(ADDED_BROKEN+' Nothing was added.');
  const outcome=(entries,already)=>{const now=added(b);return {document:readOwned(b),captured:entries.map(e=>({sourceId:e.sourceId,id:e.id,role:e.role,copiedHash:e.copiedHash})),alreadyCaptured:already,sourcesHash:now?.hash??null};};
  // 1. A replay of this exact operation changes nothing.
  const mine=(cur?.entries||[]).filter(e=>e.operationId===input.operationId);
  if(mine.length){if(mine.some(e=>e.inputHash!==inputHash))fail('This operation ID already belongs to a different request.');return outcome(mine,[]);}
  // An operation ID may not be one the draft's own operations already use.
  if(input.operationId===b.operationId||input.operationId===b.prepareOperationId||allBindings().some(row=>row.operationId===input.operationId||row.prepareOperationId===input.operationId)||outputRegistrations().some(row=>row.operationId===input.operationId))fail('This operation ID already belongs to another draft operation.');
  let known=true;try{owner(b).inspectOperation({projectId:b.id,operationId:input.operationId});}catch(error){if(error.status!==404)throw error;known=false;}
  if(known)fail('This operation ID already belongs to another draft operation.');
  // 2. The material authority decides what qualifies: attached to this subject, reviewed, not set aside, readable.
  const context=await material.context({bindingId:b.id,parentStudyId:b.parentStudyId},{sourceIds:sources.map(s=>s.sourceId)}),own=digest(owner(b).readWorkflow(b.id).draft);
  const rows=sources.map((s,index)=>{
   const r=context.records.find(x=>x.id===s.sourceId);
   if(!r||typeof r.raw!=='string')fail('Selected parent material is missing, unreadable or unreviewed.',400);
   if(r.hash!==s.sourceHash)fail('This material changed in the Library after you looked. Look again before using it.');
   if(!confirmedByHuman(r))fail('Not confirmed by you yet. Confirm this material yourself before using it for Check.',409);
   if(Buffer.byteLength(r.raw)>MAX_ADDED_SOURCE)fail('This material is over 2 MB; it is too long to use for Check.',413);
   const copiedHash=digest(r.raw);if(r.bodyHash!==undefined&&r.bodyHash!==copiedHash)fail('The Library text changed while it was read. Look again.');
   if(copiedHash===own)fail('That file holds this draft\'s own words, so it cannot check them.');
   const have=cur?.records.find(x=>x.sourceId===s.sourceId);
   return {index,record:r,raw:r.raw,copiedHash,role:roleFor(r),already:have?.copiedHash===copiedHash};
  });
  const fresh=rows.filter(r=>!r.already),already=rows.filter(r=>r.already).map(r=>r.record.id);
  // 3. Everything asked for is already used: settled, whatever the hash says (a second press from a stale page).
  if(!fresh.length)return {document:readOwned(b),captured:[],alreadyCaptured:already,sourcesHash:cur?.hash??null};
  if((cur?.hash??null)!==expectedSourcesHash)fail('The sources used for Check changed since you looked. Look again.');
  const total=new Map((cur?.records||[]).map(r=>[r.sourceId,Buffer.byteLength(r.raw)]));for(const r of fresh)total.set(r.record.id,Buffer.byteLength(r.raw));
  if([...total.values()].reduce((a,n)=>a+n,0)>MAX_ADDED_TOTAL)fail('That is more than 4 MB of material for Check. Use fewer or shorter sources.',413);
  // 4. Copy each file (exclusive, read-only), then append every entry in one atomic write. A retry of the same
  // operation reuses a copy whose bytes match, so a crash between the two never leaves half a record.
  const entries=[];let previous=cur?.entries.at(-1)?.entryHash??b.captureHash,sequence=cur?.entries.length||0;const capturedAt=new Date().toISOString(),actor=currentActor().actor;
  for(const r of fresh){
   const copiedName='added-'+input.operationId+'-'+r.index+'.md',copiedPath=path.join(dirs(b).capture,copiedName);
   if(fs.lstatSync(copiedPath,{throwIfNoEntry:false})){regular(copiedPath);if(digest(fs.readFileSync(copiedPath))!==r.copiedHash)fail('Interrupted copy bytes differ; the existing copy is kept.');}
   else{atomicWrite(copiedPath,r.raw,{exclusive:true});fs.chmodSync(copiedPath,0o400);if(afterCopyFile)afterCopyFile({binding:b,record:{id:r.record.id,role:r.role},copiedPath});}
   const e={sequence:++sequence,operationId:input.operationId,inputHash,actor,capturedAt,id:'added:'+r.record.id+':'+r.copiedHash.slice(0,12),sourceId:r.record.id,role:r.role,kind:r.record.kind||'',title:r.record.title||'',sourcePath:r.record.sourcePath||'',libraryHash:r.record.hash,
    // Everything the material authority knew about the review at this moment, with who confirmed it (the stamp it holds).
    review:{...structuredClone(r.record.review||{}),by:typeof r.record.review?.by==='string'?r.record.review.by:'not recorded'},eligibleAtCapture:r.record.eligible===true,setAsideAtCapture:r.record.setAside===true,copiedName,copiedHash:r.copiedHash,previousHash:previous};
   e.entryHash=addedEntryHash(e);previous=e.entryHash;entries.push(e);
  }
  const doc={schema:ADDED_SCHEMA,bindingId:b.id,parentStudyId:b.parentStudyId,captureHash:b.captureHash,entries:[...(cur?.entries||[]),...entries]};
  if(cur&&!cur.entries.every((e,i)=>stable(e)===stable(doc.entries[i])))fail('The captured sources record is append-only.');
  atomicWrite(addedFile(b),JSON.stringify(doc,null,2),cur?{expectedHash:cur.hash}:{exclusive:true});fs.chmodSync(addedFile(b),0o400);
  return outcome(entries,already);
 }
 /** What can be used for Check, before anything is pressed. Any actor may read this. */
 async function listCaptureSources(input,{material}={}){
  readable(input?.parentStudyId,'Parent study ID');if(!uuid.test(input.bindingId||''))fail('Owned draft binding UUID required.',400);
  const b=binding(input),cur=added(b),damaged=!!cur?.error,why=cannotTakeSources(b)||(damaged?ADDED_DAMAGED:null),locked=capture(b),hasQuoteSource=[...locked.records,...(damaged?[]:cur?.records||[])].some(r=>r.role==='source'&&!r.missing);
  const base={bindingId:b.id,parentStudyId:b.parentStudyId,canCapture:!why,...(why?{reason:why}:{}),sourcesHash:cur?.hash??null,...(damaged?{addedError:ADDED_DAMAGED,damaged:true}:{}),hasQuoteSource};
  if(why)return {...base,sources:[]};
  if(typeof material?.context!=='function')fail('Attached material is unavailable.',503);
  const context=await material.context({bindingId:b.id,parentStudyId:b.parentStudyId},{withBody:true});
  return {...base,sources:context.records.map(r=>{
   const reviewed=r.review?.state==='reviewed',setAside=r.setAside===true,have=cur?.records?.find(x=>x.sourceId===r.id),current=!!have&&r.bodyHash!==undefined&&have.copiedHash===r.bodyHash,length=typeof r.raw==='string'?r.raw.length:null,confirmed=confirmedByHuman(r);
   // A captured source keeps counting for Check from its pinned copy, whatever happens to the Library item afterwards, so the list never says "not used" for one.
   const reason=r.missing?'This material could not be read.':have&&setAside?'Captured; set aside in the Library since.':have&&current?'Already used for Check.':setAside?'You set this aside, so it is not used.':!reviewed?(have?'Captured earlier; changed in the Library since, and not reviewed again.':'Not reviewed yet. Review it before using it for Check.'):!confirmed?'Not confirmed by you yet. Confirm this material yourself before using it for Check.':!r.eligible||length===null?'There is nothing readable here to use.':Buffer.byteLength(r.raw)>MAX_ADDED_SOURCE?'Over 2 MB, too long to use for Check.':null;
   return {id:r.id,title:r.title||'Unavailable material',kind:r.kind||null,hash:r.hash||null,length,reviewed,confirmedByYou:confirmed,setAside,captured:!!have,capturedCurrent:current,changedSinceCapture:!!have&&!current,...(have?{capturedAt:have.capturedAt,capturedRole:have.role}:{}),eligible:reason===null,...(reason?{reason}:{}),role:roleFor(r),review:{state:r.review?.state||'unreviewed',basis:r.review?.basis||null,by:typeof r.review?.by==='string'?r.review.by:'not recorded',at:r.review?.at||null}};
  })};
 }
 // His words kept off the page (study-draft-set-aside.mjs): stored in the draft's own folder, never in the draft.
 const asides=createStudyDraftSetAside({binding:input=>binding(input),room:b=>dirs(b).room});
 function rootRecovery(input){const b=binding(input);capture(b);return createStudyRootRecovery({copyRoot:root,bindingId:b.id,parentStudyId:b.parentStudyId,originalId:b.originalId});}
 // Draft receipts are written by the bound project-folder owner; who asked for
 // each operation is kept beside them, keyed by binding and operation ID.
 const draftLedger=createProvenanceLedger({dataDir});
 function withDraftProvenance(api){
  for(const name of ['standInReview','cloneStructureTest','createCollection','openCopy','fork','registerOutput','restoreVersion','saveReviewedLanguage','save','undo','recover','recoverRoots','captureSources']){
   const run=api[name];api[name]=async (input,internal)=>{const out=await run(input,internal);const scopeId=input?.bindingId||out?.binding?.id||out?.document?.binding?.id;if(scopeId&&input?.operationId){try{draftLedger.stamp({area:'draft',scopeId,key:input.operationId,action:'op'});}catch(error){console.error('Draft provenance was not recorded:',error.message);}
    // The reply was read before the stamp; show this operation's author in it too.
    const mark=doc=>{if(Array.isArray(doc?.history))doc.history=doc.history.map(h=>h.operationId===input.operationId?{...h,...draftLedger.lookup({area:'draft',scopeId,key:input.operationId,action:'op'})}:h);};mark(out);mark(out?.document);}return out;};
  }
  return api;
 }
 return withDraftProvenance({saveReviewedLanguage:async(input,internal)=>{if(typeof internal?.validateReview!=='function')fail('Retained reviewed language owner required.',403);await internal.validateReview(structuredClone(input));return serial(()=>saveReviewedLanguage(structuredClone(input),internal));},standInReview:input=>serial(()=>standInReview(structuredClone(input))),cloneStructureTest:input=>serial(()=>cloneStructureTest(structuredClone(input))),createCollection:input=>serial(()=>createCollection(structuredClone(input))),withSnapshotLease,inspectRoots:input=>serial(()=>rootRecovery(input).inspect()),recoverRoots:input=>serial(()=>{inputFields(input,['bindingId','parentStudyId','operationId','ownerDecision','expected','captureHash','intentHash']);const result=rootRecovery(input).recover({operationId:input.operationId,ownerDecision:input.ownerDecision,expected:input.expected,captureHash:input.captureHash,intentHash:input.intentHash});return {recovery:result,document:readOwned(binding(input))};}),/** Which app project ids a draft file belongs to: the catalog's parent key and every project a copy of it was opened under. */
  draftLinks:()=>{let list;try{list=originals.catalog();}catch{return [];}const rows=allBindings().filter(b=>b.schema==='ar-create.study-draft-copy.v1');return (Array.isArray(list)?list:list.drafts||[]).map(e=>({path:e.path,ids:[...new Set([e.parentStudyKey,...rows.filter(b=>b.originalId===e.id).flatMap(b=>[b.parentStudyId,b.parentStudyKey])].filter(Boolean))]}));},
  catalog:()=>serial(()=>{const rows=allBindings();let c,originalsUnavailable;try{c=originals.catalog();}catch(error){if(error.status!==404||!rows.some(b=>b.kind==='collection-root'))throw error;c={drafts:[]};originalsUnavailable={status:404,message:error.message};}for(const b of rows){validateStructureTest(b,{allowPendingWithoutSeed:true});validateCollectionSource(b,{allowPendingWithoutSeed:true});}const drafts=Array.isArray(c)?c:c.drafts,excludedProjectIds=[...new Set(rows.filter(isFixtureRecord).map(b=>b.parentStudyId))],live=record=>!isFixtureRecord(record)&&!excludedProjectIds.includes(record.parentStudyId||record.parentStudyKey);return {...(originalsUnavailable?{originalsUnavailable}:{}),...(excludedProjectIds.length?{excludedProjectIds}:{}),collections:rows.filter(b=>b.kind==='collection-root'&&live(b)).map(b=>({bindingId:b.id,parentStudyId:b.parentStudyId,parentStudyKey:b.parentStudyKey,partKey:b.partKey,title:b.title,bindingStatus:b.status,kind:b.kind,origin:b.origin,...(b.structureTest?{structureTest:structuredClone(b.structureTest)}:{}),...(b.collectionSource?{collectionSource:structuredClone(b.collectionSource)}:{}),...(b.status==='ready'?{capturedRecords:capturedRecordMetadata(b)}:{})})),outputBindings:outputCatalog(rows).filter(live),drafts:drafts.filter(live).map(item=>{const id=item.originalId||item.id,b=rows.find(b=>b.kind!=='output-fork'&&b.origin!=='structure-test'&&b.originalId===id);return {...item,originalId:id,...(b?{bindingId:b.id,parentStudyId:b.parentStudyId,bindingStatus:b.status}:{})};})};}),openCopy:input=>serial(()=>openCopy(structuredClone(input))),fork:input=>serial(()=>fork(structuredClone(input))),registerOutput:input=>serial(()=>registerOutput(structuredClone(input))),read:input=>serial(()=>readOwned(binding(input,{allowPending:true}))),captureSources:(input,context)=>serial(()=>captureSources(structuredClone(input),context)),listCaptureSources:(input,context)=>serial(()=>listCaptureSources(structuredClone(input),context)),previewVersion:input=>serial(()=>previewVersion(structuredClone(input))),setAside:input=>serial(()=>asides.setAside(structuredClone(input))),listSetAside:input=>serial(()=>asides.list(structuredClone(input))),restoreVersion:input=>serial(()=>{inputFields(input,['bindingId','parentStudyId','operationId','expected','restoreOperationId','restorePosition']);const b=binding(input);capture(b);owner(b).restoreDraftVersion({projectId:b.id,operationId:input.operationId,expected:input.expected,restoreOperationId:input.restoreOperationId,restorePosition:input.restorePosition});return readOwned(b);}),save:(input,internal={})=>serial(()=>{inputFields(input,['bindingId','parentStudyId','operationId','expected','operations']);const b=binding(input);capture(b);owner(b).applyDraftOperations({projectId:b.id,operationId:input.operationId,expected:input.expected,operations:structuredClone(input.operations)},internal);return readOwned(b);}),undo:input=>serial(()=>{inputFields(input,['bindingId','parentStudyId','operationId','expected','undoOperationId']);const b=binding(input);const actor=currentActor()?.actor;if(actor&&!HUMAN_ACTORS.includes(actor)&&b.origin!=='structure-test')fail('Undoing draft wording is human-only; '+actor+' may undo only its own stand-in marks on a structure-test copy.',403);capture(b);owner(b).undoDraftOperation({projectId:b.id,operationId:input.operationId,expected:input.expected,undoOperationId:input.undoOperationId});return readOwned(b);}),inspect:input=>serial(()=>{const b=binding(input,{allowPending:true}),service=owner(b),capturedHere=added(b)?.entries?.find(e=>e.operationId===input.operationId);if(capturedHere)return {bindingId:b.id,readiness:service.workflowReadiness(b.id),receipt:{state:'committed',operationId:input.operationId,kind:'captureSources',after:{hash:added(b).hash}}};return {bindingId:b.id,readiness:service.workflowReadiness(b.id),receipt:service.inspectOperation({projectId:b.id,operationId:input.operationId})};}),recover:input=>serial(()=>{const b=binding(input,{allowPending:true});capture(b);const service=owner(b);service.recoverOperation({projectId:b.id,operationId:input.operationId});if(b.status==='pending'&&service.workflowReadiness(b.id).ready&&service.readDraftStatus(b.id).initialized){b.status='ready';b.readyAt=new Date().toISOString();persist(b);}return readOwned(b);})});
}
