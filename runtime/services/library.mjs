import {isLiveLibrarySource} from './live-records.mjs';
import {createLibraryFolders,validateLibraryFolders} from './library-folders.mjs';
import {collectionPair,liveCollectionLink,resolvedCollectionLinks} from './donors/study/collection-relationships.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { StateError, MAX_BODY_BYTES } from '../store.mjs';
import { readFolder, splitFrontmatter, slugifyName, readMeta, kindFor } from './wordforge-sources.mjs';
import { normalizeSourceUrl } from './source-identity.mjs';
import { createScraper } from './wordforge-firecrawl.mjs';
import { atomicWrite, readJson, digest, safeRel, regular, resolveInside, ensurePrivateDirectory } from './files.mjs';
import {assertUnusedSourceId} from './source-references.mjs';

// A repeated quartet regex exhausts V8's stack on large recordings. Scan the
// alphabet once, checking quartet length and final padding separately.
function validBase64(value) {
  if (value.length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return !/[^A-Za-z0-9+/]/.test(value.slice(0, value.length - padding));
}

const TEXT = new Set(['.md', '.markdown', '.txt']);
const fileStamp = stat => `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
async function streamHash(file) { const hash=createHash('sha256'); for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex'); }
const now = () => new Date().toISOString();
function string(value, label, max = MAX_BODY_BYTES) { if (typeof value !== 'string' || value.length > max) throw new StateError(`${label} must be text under ${max} characters.`); return value; }

/** Adapted WordForge shelves and Board references, isolated from vault/db/runtime. */
export function createLibrary({ dataDir, connections = [], legacyState = () => ({ project: { sources: [] } }), extraction = null, urlIngestion = null, ingestionState = null, recordingState = null, recordingSourceSnapshot = null, retainedCatalog = null, originalCatalog = null, workReferences = null, projectAssociations = null, inspectionOnly = false }) {
  const scrape = !inspectionOnly && extraction ? createScraper(extraction) : null;
  const owned = path.join(dataDir, 'library');
  if (!inspectionOnly) { fs.mkdirSync(owned, { recursive: true, mode: 0o700 }); resolveInside(owned, '', { directory: true }); }
  const recordingShelf = inspectionOnly ? path.join(dataDir, 'recordings') : ensurePrivateDirectory(dataDir, 'recordings');
  const existingRoot = file => { const stat=fs.lstatSync(file,{throwIfNoEntry:false}); if(!stat)return {path:file,available:false}; if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Library root must be a real directory.',403); return {path:fs.realpathSync(file),available:true}; };
  const roots = [{ id: 'library', name: 'My library', ...inspectionOnly?existingRoot(owned):{path:fs.realpathSync(owned)}, writable: true }, { id: 'recordings', name: 'Recording files', ...inspectionOnly?existingRoot(recordingShelf):{path:fs.realpathSync(recordingShelf)}, writable: false, owner: 'ar-create-magazine' }];
  function configuredRoots(entries) {
    if (!Array.isArray(entries) || entries.length > 64) throw new StateError('Invalid explicitly configured read-only roots.');
    const configured=[];
    for (const entry of entries) {
      if (!entry || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || (['library', 'recordings'].includes(entry.id) || (entry.id === retainedCatalog?.id || entry.id === originalCatalog?.id)) || configured.some(r => r.id === entry.id) || typeof entry.path !== 'string' || !path.isAbsolute(entry.path)) throw new StateError('Invalid explicitly configured read-only root.');
      let configuredPath=entry.path,available=true;
      try{resolveInside(entry.path, '', { directory: true });configuredPath=fs.realpathSync(entry.path);}catch(error){if(error.code!=='ENOENT')throw error;available=false;}
      configured.push({ id: entry.id, name: entry.name || entry.id, path: configuredPath, writable: false,available });
    }
    return configured;
  }
  roots.push(...configuredRoots(connections));
  if (retainedCatalog !== null) {
    if (!retainedCatalog || !/^[a-zA-Z0-9_-]+$/.test(retainedCatalog.id) || roots.some(root => root.id === retainedCatalog.id) || typeof retainedCatalog.path !== 'string' || !path.isAbsolute(retainedCatalog.path) || typeof retainedCatalog.entries !== 'function') throw new StateError('Invalid retained transcript catalog root.');
    roots.push({id: retainedCatalog.id, name: retainedCatalog.name || retainedCatalog.id, path: retainedCatalog.path.replace(/^\/(tmp|var)(?=\/|$)/, '/private/$1'), writable: false, retainedCatalog: true});
  }
  if(originalCatalog!==null){
    if(!originalCatalog||!/^[a-zA-Z0-9_-]+$/.test(originalCatalog.id)||roots.some(root=>root.id===originalCatalog.id)||typeof originalCatalog.path!=='string'||!path.isAbsolute(originalCatalog.path)||typeof originalCatalog.entries!=='function')throw new StateError('Invalid explicitly catalogued original root.');
    roots.push({id:originalCatalog.id,name:originalCatalog.name||originalCatalog.id,path:originalCatalog.path.replace(/^\/(tmp|var)(?=\/|$)/,'/private/$1'),writable:false,originalCatalog:true});
  }
  const indexFile = path.join(dataDir, 'library-index.json');
  let index = inspectionOnly ? { revision: 0, sources: [], collections: [], evidence: [], legacyImported: [] } : readJson(indexFile, { revision: 0, sources: [], collections: [], evidence: [], legacyImported: [] });
  if (!Array.isArray(index.sources) || !Array.isArray(index.collections) || !Array.isArray(index.evidence)) throw new Error('Invalid library index; files preserved.');
  // Old indexes acquire an empty optional edge registry without copying policy
  // or rewriting source/collection membership. Malformed records stay on disk.
  if (index.collectionRelationships === undefined) index.collectionRelationships = [];
  if (!Array.isArray(index.collectionRelationships) || index.collectionRelationships.some(item => !item || typeof item.id !== 'string' || typeof item.sourceId !== 'string' || typeof item.destinationId !== 'string' || item.sourceId === item.destinationId || !['accepted','detached'].includes(item.status) || item.relationshipType !== 'relates-to') || new Set(index.collectionRelationships.map(item=>item.id)).size !== index.collectionRelationships.length) throw new Error('Invalid library index; files preserved.');
  const folderMetadata = new Map();
  let pending = Promise.resolve();
  function serial(fn) { const op = pending.then(fn); pending = op.catch(() => {}); return op; }
  function persist() { index.revision++; atomicWrite(indexFile, JSON.stringify(index, null, 2)); }
  function persistCollectionRelationship(change) {
    const previous=structuredClone(index.collectionRelationships),revision=index.revision;
    try { change(); persist(); }
    catch(error) {
      // Atomic publication may have succeeded before a directory sync failed.
      // Disk is authoritative when readable; otherwise restore the prior view.
      try { index=readJson(indexFile,index);if(index.collectionRelationships===undefined)index.collectionRelationships=[]; }
      catch { index.collectionRelationships=previous;index.revision=revision; }
      throw error;
    }
  }
  // Typed inquiry references remain in this same Library index; legacy relates-to stays untouched.
  const TYPED_SCHEMA='ar-create.library-typed-relationship.v1',UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
  const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  const same=(a,b)=>stable(a)===stable(b),fingerprint=value=>digest(stable(value));
  const typedFail=(message,status=409)=>{throw new StateError(message,status);};
  function typedFields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))typedFail('Use explicit relationship fields; caller paths and snapshots are refused.',400);}
  const organizational=record=>record?.recordKind==='organizational-association';
  const workEndpoint=value=>['workspace','piece'].includes(value?.kind);
  function typedEndpoint(value,kinds){
    typedFields(value,['kind','id',...['piece','project'].includes(value?.kind)?['rootBindingId','parentStudyId']:[]]);
    if(value.kind==='output')typedFail('Use an explicit technical workspace or native Piece mapping; human Project identity is not inferred.',400);
    if(!kinds.includes(value.kind)||!UUID.test(value.id||''))typedFail('Use a supported existing Library/work endpoint UUID.',400);
    if(['piece','project'].includes(value.kind)&&(!UUID.test(value.rootBindingId||'')||typeof value.parentStudyId!=='string'||!value.parentStudyId||value.parentStudyId.length>256||/[\u0000-\u001f\u007f]/.test(value.parentStudyId)))typedFail('Native Piece references require trusted exact root and parent selectors.',400);
  }
  async function readProject(endpoint){
    if(!projectAssociations?.read)typedFail('Narrow named Project authority adapter is not connected.');
    const current=await projectAssociations.read(structuredClone(endpoint));
    if(current?.schema!=='ar-create.named-project-authority.v1'||!same(current.endpoint,endpoint)||current.humanProjectMapping!=='existing-named-saved-workspace'||current.project?.id!==endpoint.id||!UUID.test(current.project?.documentId||'')||!HASH.test(current.proofHash||''))typedFail('Named Project authority returned another or unsupported binding.');return current;
  }
  async function checkProject(record){const current=await readProject(record.to);if(current.proofHash!==record.projectAnchor?.proofHash)typedFail('Named Project identity binding changed; review this association.');return current;}
  async function readWork(endpoint){
    if(!workReferences?.read)typedFail('Trusted existing workspace/native Piece adapter is not connected.');
    const result=await workReferences.read(structuredClone(endpoint));
    if(result?.schema!=='ar-create.library-work-target.v1'||!same(result.endpoint,endpoint)||!HASH.test(result.workHash||'')||!UUID.test(result.authority?.projectId||'')||!UUID.test(result.authority?.documentId||''))typedFail('Trusted work owner returned another or unavailable target.');return result;
  }
  async function checkWork(record){
    if(!workEndpoint(record.to))return null;
    const current=await readWork(record.to);if(current.freshness?.stale)typedFail('Selected native work edition requires review before adoption.');if(current.workHash!==record.workAnchor?.workHash)typedFail('Existing work edition changed; retain this reference and review before adoption.');
    if(record.usageBasis==='measured-native'){
      if(!workReferences?.measure)typedFail('Measured native usage adapter is not connected.');
      const measured=await workReferences.measure({endpoint:record.to,sourceId:record.anchor.sourceId,sourceHash:record.anchor.sourceHash});if(!same(measured,record.usageProof))typedFail('Actual native placement usage changed; review the saved reference.');
    }
    return current;
  }
  function validateTypedIndex(value){
    if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||!['sources','collections','evidence'].every(k=>Array.isArray(value[k])))typedFail('Invalid Library index; existing bytes preserved.');
    const legacy=value.collectionRelationships??[];
    if(!Array.isArray(legacy)||legacy.some(r=>!r||typeof r.id!=='string'||typeof r.sourceId!=='string'||typeof r.destinationId!=='string'||r.sourceId===r.destinationId||!['accepted','detached'].includes(r.status)||r.relationshipType!=='relates-to')||new Set(legacy.map(r=>r.id)).size!==legacy.length)typedFail('Invalid legacy Library relationships; existing bytes preserved.');
    const records=value.typedRelationships??[],ops=value.typedRelationshipOperations??[];
    if(!Array.isArray(records)||records.length>5000||!Array.isArray(ops)||ops.length>10000||new Set(records.map(r=>r?.id)).size!==records.length||new Set(ops.map(o=>o?.operationId)).size!==ops.length)typedFail('Invalid or full typed relationship history; existing bytes preserved.');
    for(const r of records){
      if(r?.schema!==TYPED_SCHEMA||!UUID.test(r.id||'')||!(organizational(r)?r.relationshipType==='associated-with':['supports','challenges','explores','used-in'].includes(r.relationshipType))||!['proposed','accepted','detached'].includes(r.status)||typeof r.reason!=='string'||!r.reason.trim()||!organizational(r)&&(!HASH.test(r.anchor?.sourceHash||'')||!UUID.test(r.anchor?.sourceId||''))||!Array.isArray(r.history)||r.history.length>2000)typedFail('Invalid typed relationship; existing bytes preserved.');
      if(organizational(r)){
        typedEndpoint(r.from,['collection']);typedEndpoint(r.to,['project']);
        if(!same(r.projectAnchor?.endpoint,r.to)||!HASH.test(r.projectAnchor?.proofHash||'')||r.projectAnchor?.project?.id!==r.to.id||!UUID.test(r.projectAnchor?.project?.documentId||'')||['anchor','workAnchor','usageProof','usageBasis'].some(k=>r[k]!==undefined))typedFail('Invalid source-free organizational association.');
      }else{
        if(r.recordKind!==undefined)typedFail('Unsupported typed relationship subtype.');
      typedEndpoint(r.from,['source','evidence','collection']);typedEndpoint(r.to,['collection','workspace','piece']);
      if(workEndpoint(r.to)){if(r.from.kind!=='collection'||r.anchor.collectionId!==r.from.id||!same(r.workAnchor?.endpoint,r.to)||!HASH.test(r.workAnchor?.workHash||'')||!['declared','measured-native'].includes(r.usageBasis)||r.usageBasis==='measured-native'&&(r.relationshipType!=='used-in'||!HASH.test(r.usageProof?.hash||'')))typedFail('Invalid existing-work relationship anchor.');}else if(r.from.kind==='collection')typedFail('Collection context requires an existing work target.');
      if(r.from.kind==='source'&&r.from.id!==r.anchor.sourceId||r.from.kind==='evidence'&&(r.from.id!==r.anchor.evidenceId||!HASH.test(r.anchor.evidenceHash||'')))typedFail('Invalid typed source/evidence anchor; existing bytes preserved.');
      }
      let previous=null;
      for(const [i,event]of r.history.entries()){
        const state=v=>v&&['proposed','accepted','detached'].includes(v.status)&&typeof v.reason==='string'&&!!v.reason.trim();
        if(!UUID.test(event?.operationId||'')||!['propose','change','undo'].includes(event.action)||!['human','agent'].includes(event.actor)||i===0&&(event.action!=='propose'||event.before!==null)||i>0&&(event.action==='propose'||event.actor!=='human'||!state(event.before)||!same({status:event.before.status,reason:event.before.reason},previous))||!state(event.after)||!ops.some(op=>op.operationId===event.operationId&&op.relationshipId===r.id))typedFail('Invalid typed relationship history; existing bytes preserved.');
        previous={status:event.after.status,reason:event.after.reason};
      }
      if(!previous||!same(previous,{status:r.status,reason:r.reason}))typedFail('Typed relationship state no longer matches its saved history.');
    }
    for(const op of ops)if(!UUID.test(op?.operationId||'')||!UUID.test(op.relationshipId||'')||!HASH.test(op.fingerprint||'')||!Number.isSafeInteger(op.resultRevision))typedFail('Invalid typed operation receipt; existing bytes preserved.');
    if(value.sources.some(s=>s.topics!==undefined&&(!Array.isArray(s.topics)||s.topics.length>30||s.topics.some(t=>typeof t!=='string'||!t.trim()||t!==t.trim()||t.length>80||/[\x00-\x1f\x7f]/.test(t))||new Set(s.topics.map(t=>t.toLocaleLowerCase())).size!==s.topics.length)))typedFail('Invalid source topics; existing bytes preserved.');
    if(value.topicOperations!==undefined&&(!Array.isArray(value.topicOperations)||value.topicOperations.length>10000||new Set(value.topicOperations.map(o=>o?.operationId)).size!==value.topicOperations.length||value.topicOperations.some(o=>!UUID.test(o?.operationId||'')||!HASH.test(o.fingerprint||'')||typeof o.actor!=='string'||!Number.isSafeInteger(o.resultRevision))))typedFail('Invalid topic operation history; existing bytes preserved.');
    validateLibraryFolders(value);
    return value;
  }
  function loadTyped(){
    const file=resolveInside(dataDir,'library-index.json',{missing:true});
    if(inspectionOnly&&!fs.existsSync(file))typedFail('Library index is unavailable; no catalog was inferred.',503);
    const bytes=fs.existsSync(file)?(regular(file),fs.readFileSync(file,'utf8')):null;
    let value;try{value=bytes===null?structuredClone(index):JSON.parse(bytes);}catch{typedFail('Cannot read Library index; existing bytes preserved.');}
    validateTypedIndex(value);index=value;return {value,bytes,hash:digest(bytes??'')};
  }
  function endpointExists(value,endpoint){
    if(workEndpoint(endpoint))typedFail('Work endpoints must resolve through the trusted existing owner.');
    const rows=value[{source:'sources',evidence:'evidence',collection:'collections'}[endpoint.kind]];
    const matches=rows.filter(row=>row.id===endpoint.id);if(matches.length!==1)typedFail('Exact Library endpoint was not found or is ambiguous.',404);return matches[0];
  }
  async function sourceVersion(value,sourceId){
    const rows=value.sources.filter(s=>s.id===sourceId);if(rows.length!==1||rows[0].missing||rows[0].managedTerminalSnapshot)return {available:false,hash:null};
    try{const file=checkedFile(rows[0]),before=regular(file),hash=await streamHash(file),after=regular(file);if(fileStamp(before)!==fileStamp(after))typedFail('Source changed during relationship read.');return {available:true,hash};}
    catch(error){if(error.status===409)throw error;if([403,404,503].includes(error.status)||error.code==='ENOENT')return {available:false,hash:null};throw error;}
  }
  const evidenceHash=card=>fingerprint({sourceId:card.sourceId,sourceHash:card.sourceHash,quote:card.quote,locator:card.locator,kind:card.kind});
  async function associationView(record){
    let projectAvailable=true,projectChanged=false;try{const current=await readProject(record.to);projectChanged=current.proofHash!==record.projectAnchor.proofHash;}catch(error){if(![400,403,404,409,503].includes(error.status))throw error;projectAvailable=false;}
    return {...structuredClone(record),review:{needed:!projectAvailable||projectChanged,projectAvailable,projectChanged,factVerified:false,nativeUsageVerified:false,basis:'Explicit organizational association only; no source-version, usage, direction inheritance or approval is implied.'}};
  }
  async function typedView(value,record){
    if(organizational(record))return associationView(record);
    const current=await sourceVersion(value,record.anchor.sourceId),collection=value.collections.find(c=>c.id===(workEndpoint(record.to)?record.from.id:record.to.id)),member=!!collection?.sourceIds?.includes(record.anchor.sourceId),card=record.anchor.evidenceId?value.evidence.find(c=>c.id===record.anchor.evidenceId):null;
    const sourceChanged=current.available&&current.hash!==record.anchor.sourceHash,evidenceChanged=!!record.anchor.evidenceId&&(!card||evidenceHash(card)!==record.anchor.evidenceHash);
    let workAvailable=true,workChanged=false,nativeUsageVerified=false,workReason=null;
    if(workEndpoint(record.to)){try{const work=await readWork(record.to);workChanged=work.workHash!==record.workAnchor.workHash;if(record.usageBasis==='measured-native'&&!sourceChanged&&current.available&&!workChanged){await checkWork(record);nativeUsageVerified=true;}}catch(error){if(![400,403,404,409,503].includes(error.status))throw error;workAvailable=false;workReason='Existing work/placement proof is unavailable or changed; review this retained reference.';}}
    return {...structuredClone(record),review:{needed:!current.available||sourceChanged||evidenceChanged||!member||!workAvailable||workChanged,sourceChanged,evidenceChanged,sourceAvailable:current.available,currentSourceHash:current.hash,collectionAvailable:!!collection,member,workAvailable,workChanged,workReason,factVerified:false,nativeUsageVerified,basis:nativeUsageVerified?'Actual saved native placement only; factual support is not certified.':'Explicit declared relationship; factual support and native usage are not certified.'}};
  }
  async function anchorFor(value,from,to,expectedSourceHash,selectedSourceId){
    const endpoint=endpointExists(value,from),collection=endpointExists(value,workEndpoint(to)?from:to),sourceId=from.kind==='collection'?selectedSourceId:from.kind==='source'?endpoint.id:endpoint.sourceId;
    if(!collection.sourceIds?.includes(sourceId))typedFail('Select this source as a member of the target inquiry before linking.');
    const current=await sourceVersion(value,sourceId);if(!current.available||current.hash!==expectedSourceHash)typedFail('Source changed or is unavailable; review its exact version before linking.');
    if(from.kind==='evidence'&&(endpoint.sourceHash!==current.hash||typeof endpoint.quote!=='string'||!endpoint.locator))typedFail('Evidence belongs to an earlier source version; review a current passage.');
    return {sourceId,sourceHash:current.hash,...from.kind==='collection'?{collectionId:from.id}:{},...from.kind==='evidence'?{evidenceId:endpoint.id,evidenceHash:evidenceHash(endpoint)}:{}};
  }
  // Trusted work owners can read Library snapshots while resolving an edition.
  // Capture under our queue, release it for owner reads, then use the exact index
  // bytes as a publication/read guard. Never hold Library's queue across owners.
  let typedPending=Promise.resolve();
  function typedSerial(fn){const op=typedPending.then(fn);typedPending=op.catch(()=>{});return op;}
  function typedSnapshot(){return serial(()=>{const loaded=loadTyped();return {...loaded,value:structuredClone(loaded.value)};});}
  async function listTyped(input={}){
    typedFields(input,['entity','direction','includeDetached']);
    if(input.entity)typedEndpoint(input.entity,['source','evidence','collection','workspace','piece','project']);
    if(input.direction!==undefined&&!['incoming','outgoing','both'].includes(input.direction)||input.includeDetached!==undefined&&typeof input.includeDetached!=='boolean')typedFail('Use explicit relationship direction and detached-state choice.',400);
    const loaded=await typedSnapshot(),value=loaded.value;if(input.entity){if(input.entity.kind==='project')await readProject(input.entity);else if(workEndpoint(input.entity))await readWork(input.entity);else endpointExists(value,input.entity);}
    const direction=input.direction||'both',entity=input.entity;
    const matches=(value.typedRelationships||[]).filter(r=>(input.includeDetached||r.status!=='detached')&&(!entity||direction!=='incoming'&&(same(r.from,entity)||entity.kind==='source'&&r.anchor?.sourceId===entity.id)||direction!=='outgoing'&&same(r.to,entity)));
    const relationships=[];for(const r of matches)relationships.push(await typedView(value,r));
    const current=await typedSnapshot();if(current.hash!==loaded.hash)typedFail('Library changed during relationship read; refresh.');
    return {schema:'ar-create.library-typed-relationships.v1',revision:value.revision,indexHash:loaded.hash,relationships,coverage:{kind:'known-recorded-references-only',unknownDependencies:['Unrecorded source/learning dependencies are unknown.','Only explicit existing workspace/native Piece references and supported measured placements are known; unrecorded dependencies remain unknown.','External files and provider activity are not exhaustively indexed.']}};
  }
  async function mutateTyped(action,input){
    typedFields(input,['operationId','expectedRevision','expectedHash','actor','reason',...action==='propose'?['from','to','relationshipType','expectedSourceHash','sourceId','expectedWorkHash','usageBasis','recordKind','expectedProjectProofHash']:action==='change'?['id','status']:['id','undoOperationId']]);
    if(!UUID.test(input.operationId||'')||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!HASH.test(input.expectedHash||''))typedFail('Exact Library revision/hash and operation UUID required.',400);
    string(input.reason,'Relationship reason',10000);if(!input.reason.trim()||!['human','agent'].includes(input.actor))typedFail('Explicit actor and reason required.',400);
    if(action!=='propose'&&input.actor!=='human')typedFail('Only an explicit human decision can accept, detach or restore a relationship.',400);
    if(action==='propose'){
      if(organizational(input)){typedEndpoint(input.from,['collection']);typedEndpoint(input.to,['project']);if(input.relationshipType!=='associated-with'||!HASH.test(input.expectedProjectProofHash||'')||['expectedSourceHash','sourceId','expectedWorkHash','usageBasis'].some(k=>input[k]!==undefined))typedFail('Organizational association requires only an existing Collection and exact named Project proof; no source or usage anchor.',400);}
      else{if(input.recordKind!==undefined)typedFail('Unsupported typed relationship subtype.',400);typedEndpoint(input.from,['source','evidence','collection']);typedEndpoint(input.to,['collection','workspace','piece']);if(!['supports','challenges','explores','used-in'].includes(input.relationshipType)||!HASH.test(input.expectedSourceHash||''))typedFail('Explicit meaning and selected source hash required.',400);if(workEndpoint(input.to)){if(input.from.kind!=='collection'||!UUID.test(input.sourceId||'')||!HASH.test(input.expectedWorkHash||'')||input.usageBasis!==undefined&&!['declared','measured-native'].includes(input.usageBasis)||input.usageBasis==='measured-native'&&input.relationshipType!=='used-in')typedFail('Existing work references require trusted selected Collection/source context, exact work edition and declared/measured basis.',400);}else if(input.from.kind==='collection'||['sourceId','expectedWorkHash','usageBasis'].some(k=>input[k]!==undefined))typedFail('Extra work claims are not accepted for a Library-only reference.',400);}
    }
    else if(!UUID.test(input.id||'')||action==='change'&&!['proposed','accepted','detached'].includes(input.status)||action==='undo'&&!UUID.test(input.undoOperationId||''))typedFail('Exact relationship and supported state/Undo identities required.',400);
    const loaded=await typedSnapshot(),value=loaded.value,commandHash=fingerprint({action,input}),prior=(value.typedRelationshipOperations||[]).find(o=>o.operationId===input.operationId);
    if(prior){if(prior.fingerprint!==commandHash)typedFail('Operation UUID already owns a different exact relationship request.');const r=value.typedRelationships.find(r=>r.id===prior.relationshipId);if(!r)typedFail('Recorded relationship operation has no matching record.');return {revision:value.revision,indexHash:loaded.hash,relationship:await typedView(value,r),receipt:structuredClone(prior),replayed:true};}
    if(input.expectedRevision!==value.revision||input.expectedHash!==loaded.hash)typedFail('Library changed; refresh its revision and index hash before saving.');
    const next=structuredClone(value);next.typedRelationships??=[];next.typedRelationshipOperations??=[];
    let record,before=null,deduplicated=false;
    if(action==='propose'){
      if(organizational(input)){
        endpointExists(value,input.from);const projectAnchor=await readProject(input.to);if(projectAnchor.proofHash!==input.expectedProjectProofHash)typedFail('Named Project proof changed since the selected association.');
        record=next.typedRelationships.find(r=>organizational(r)&&same(r.from,input.from)&&same(r.to,input.to));
        if(record)deduplicated=true;
        else{record={schema:TYPED_SCHEMA,recordKind:'organizational-association',id:randomUUID(),from:structuredClone(input.from),to:structuredClone(input.to),relationshipType:'associated-with',status:'proposed',reason:input.reason,projectAnchor,createdAt:now(),updatedAt:now(),history:[]};next.typedRelationships.push(record);}
      }else{
      const anchor=await anchorFor(value,input.from,input.to,input.expectedSourceHash,input.sourceId);
      let workAnchor,usageProof;if(workEndpoint(input.to)){workAnchor=await readWork(input.to);if(workAnchor.workHash!==input.expectedWorkHash)typedFail('Existing work edition changed since the selected reference.');if(input.usageBasis==='measured-native'){if(!workReferences?.measure)typedFail('Measured native usage adapter is not connected.');usageProof=await workReferences.measure({endpoint:input.to,sourceId:anchor.sourceId,sourceHash:anchor.sourceHash});}}
      record=next.typedRelationships.find(r=>same(r.from,input.from)&&same(r.to,input.to)&&r.relationshipType===input.relationshipType&&same(r.anchor,anchor)&&(!workAnchor||r.workAnchor?.workHash===workAnchor.workHash&&r.usageBasis===(input.usageBasis||'declared')));
      if(record)deduplicated=true;
      else{record={schema:TYPED_SCHEMA,id:randomUUID(),from:structuredClone(input.from),to:structuredClone(input.to),relationshipType:input.relationshipType,status:'proposed',reason:input.reason,anchor,...workAnchor?{workAnchor,usageBasis:input.usageBasis||'declared',...usageProof?{usageProof}:{}}:{},createdAt:now(),updatedAt:now(),history:[]};next.typedRelationships.push(record);}
      }
    }else{
      record=next.typedRelationships.find(r=>r.id===input.id);if(!record)typedFail('Typed relationship was not found.',404);
      before={status:record.status,reason:record.reason};
      if(action==='change'){record.status=input.status;record.reason=input.reason;}
      else{
        const last=record.history.at(-1);if(!last||last.operationId!==input.undoOperationId||!same(last.after,before))typedFail('Saved relationship Undo no longer matches its exact latest state.');
        const restored=last.before??{status:'detached',reason:input.reason};record.status=restored.status;record.reason=restored.reason;
      }
      if(record.status!=='detached'){if(organizational(record)){endpointExists(value,record.from);await checkProject(record);}else{const check=await anchorFor(value,record.from,record.to,record.anchor.sourceHash,record.anchor.sourceId);if(!same(check,record.anchor))typedFail('Relationship source/evidence anchor changed; review before restoring.');await checkWork(record);}}
    }
    if(!deduplicated){record.updatedAt=now();record.history.push({operationId:input.operationId,action,actor:input.actor,explanation:input.reason,before,after:{status:record.status,reason:record.reason},at:record.updatedAt});}
    // Recheck physical source ownership/hash after asynchronous work; detached records retain old anchors.
    if(record.status!=='detached'){if(organizational(record)){endpointExists(value,record.from);await checkProject(record);}else{const check=await anchorFor(value,record.from,record.to,record.anchor.sourceHash,record.anchor.sourceId);if(!same(check,record.anchor))typedFail('Source changed before relationship publication.');await checkWork(record);}}
    next.revision=value.revision+1;const receipt={operationId:input.operationId,fingerprint:commandHash,relationshipId:record.id,resultRevision:next.revision,deduplicated};next.typedRelationshipOperations.push(receipt);validateTypedIndex(next);
    const bytes=JSON.stringify(next,null,2);await serial(()=>{
      const current=loadTyped();if(current.hash!==loaded.hash||current.value.revision!==value.revision)typedFail('Library changed; refresh its revision and index hash before saving.');
      try{resolveInside(dataDir,'library-index.json',{missing:true});atomicWrite(indexFile,bytes,loaded.bytes===null?{exclusive:true}:{expectedHash:loaded.hash});index=next;}
      catch(error){try{index=readJson(indexFile,value);}catch{index=value;}throw error;}
    });
    return {revision:next.revision,indexHash:digest(bytes),relationship:await typedView(next,record),receipt:structuredClone(receipt),deduplicated};
  }
  validateTypedIndex(index);
  // The registry owns identity and membership. Never discover neighboring files,
  // infer identity from an inode, or adopt a new UUID for an existing path.
  function catalogTree(root) {
    resolveInside(root.path, '', {directory: true});
    if (fs.realpathSync(root.path) !== root.path) throw new StateError('Catalog folder changed into a symlink.', 403);
    const entries = (root.originalCatalog?originalCatalog:retainedCatalog).entries();
    if(root.originalCatalog)root.catalogDiagnostics=[];
    if (!Array.isArray(entries) || entries.length > 20000) throw new StateError('Retained catalog is unavailable.');
    const ids = new Set(), paths = new Set(),aliases=[];
    const tree = {rel_path:'', name:root.name, file_count:0, total_count:0, conflict_count:0, folders:[], files:[]};
    for (const entry of entries) {
      if (!entry || !root.originalCatalog&&(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entry.id)||ids.has(entry.id)) || paths.has(entry.rel_path) || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 2000) throw new StateError('Invalid retained catalog identity.');
      safeRel(entry.rel_path, false); ids.add(entry.id); paths.add(entry.rel_path);
      let file,stat;try{file=resolveInside(root.path,entry.rel_path);stat=regular(file);}catch(error){if(root.originalCatalog&&(error.code==='ENOENT'||error.status===404)){root.catalogDiagnostics.push({path:entry.rel_path,state:'missing'});continue;}throw error;}
      if(root.originalCatalog){
        if(!Array.isArray(entry.originalReferences)||!entry.originalReferences.length)throw new StateError('Original discovery has no configured provenance.',409);
        const existing=index.sources.filter(source=>{const owner=roots.find(r=>r.id===source.rootId);return (owner?path.join(owner.path,source.rel_path):source.provenance?.originalPath)===file;});
        if(existing.length>1)throw new StateError('Original file already has ambiguous Library identities.',409);
        const prior=existing[0];if(prior&&prior.rootId!==root.id){const owner=roots.find(r=>r.id===prior.rootId);if(!owner||owner.writable)throw new StateError('Original file has an unavailable or writable existing authority; preserve its current identity.',409);aliases.push([prior,entry.originalReferences]);continue;}
      }
      if (!root.originalCatalog&&index.sources.some(source => source.id === entry.id ? source.rootId !== root.id : (source.rootId === root.id && source.rel_path === entry.rel_path) || roots.some(other => other.id === source.rootId && path.join(other.path, source.rel_path) === file))) throw new StateError('Retained catalog conflicts with an existing source identity.',409);
      const meta = readMeta(file), parts = entry.rel_path.split('/'); let folder = tree;
      if (parts.length > 25) throw new StateError('Retained catalog path is too deep.');
      for (let depth=0; depth<parts.length-1; depth++) {
        let child = folder.folders.find(item => item.name === parts[depth]);
        if (!child) { child={rel_path:parts.slice(0,depth+1).join('/'),name:parts[depth],file_count:0,total_count:0,conflict_count:0,folders:[],files:[]};folder.folders.push(child); }
        folder=child;
      }
      folder.files.push({...root.originalCatalog?{originalReferences:structuredClone(entry.originalReferences)}:{providedUUID:entry.id},rel_path:entry.rel_path,name:path.basename(entry.rel_path,path.extname(entry.rel_path)),title:entry.title,kind:kindFor(file,meta.frontmatter),size_bytes:stat.size,modified_at:stat.mtime.toISOString(),transcriptProvenance:structuredClone(entry.transcriptProvenance ?? null)});
    }
    const count = folder => {folder.file_count=folder.files.length;folder.total_count=folder.file_count+folder.folders.reduce((total,child)=>total+count(child),0);return folder.total_count;}; count(tree);for(const [source,refs]of aliases)source.originalReferences=structuredClone(refs);
    return tree;
  }
  function rootById(id = 'library', write = false) { const root = roots.find(r => r.id === id); if (!root) throw new StateError('Unknown configured library root.', 404); if (write && !root.writable) throw new StateError('Connected original roots are read-only.', 403); return root; }
  function publicSource(source) { const root = rootById(source.rootId); const { originalFile, ...metadata } = source; return { ...metadata, sourceUnavailable:root.available===false, ...(root.available===false?{cardEligibility:{eligible:false,reason:'The connected folder is unavailable. Reconnect it before reading or keeping a passage.'}}:{}), originalUrl: originalFile ? `/api/sources/blob?id=${encodeURIComponent(source.id)}&original=1` : null, path: path.join(root.path, source.rel_path), writable: root.writable, url: source.source_url || '', body: undefined }; }
  function sourceById(id) { const source = index.sources.find(s => s.id === id && !s.missing && !s.managedTerminalSnapshot); if (!source) throw new StateError('Source was not found. Refresh the library.', 404); return source; }
  function checkedFile(source, write = false) { const root = rootById(source.rootId, write);if(root.retainedCatalog||root.originalCatalog){try{const tree=catalogTree(root),find=folder=>folder.files.some(item=>(root.originalCatalog||item.providedUUID===source.id)&&item.rel_path===source.rel_path)||folder.folders.some(find);if(!find(tree))throw new StateError('Source is no longer kept in the catalog.',404);root.available=true;}catch(error){root.available=false;throw new StateError('Retained transcript catalog is unavailable or changed. Refresh the library.',503);}}if(root.available===false)throw new StateError('The source folder is unavailable. Reconnect it and refresh the library.',503); const file = resolveInside(root.path, source.rel_path); if (write) regular(file); else { const stat = fs.lstatSync(file); if (!stat.isFile()) throw new StateError('Source must be a regular file.'); } return file; }
  function makeFolder(rootId, folder) { const root = rootById(rootId, true); safeRel(folder, false); resolveInside(root.path, folder, { directory: true, createParents: true }); }
  function savedFile(rootId, folder, name, bytes, provenance, legacyId) {
    const root = rootById(rootId, true); safeRel(folder); safeRel(name, false); if (name.includes('/')) throw new StateError('File name must not contain a folder.');
    resolveInside(root.path, folder, { directory: true, createParents: true });
    let rel = path.posix.join(folder, name); const ext = path.extname(name), stem = name.slice(0, name.length - ext.length); let number = 2;
    while (fs.lstatSync(path.join(root.path, rel), { throwIfNoEntry: false })) { if (number > 50) throw new StateError('Too many name collisions; no file overwritten.', 409); rel = path.posix.join(folder, `${stem}-${number++}${ext}`); }
    const file = resolveInside(root.path, rel, { missing: true }); atomicWrite(file, bytes, { exclusive: true });
    const stat = fs.lstatSync(file); const id = legacyId || randomUUID();
    const originals = path.join(dataDir, 'source-originals'); fs.mkdirSync(originals, { recursive: true, mode: 0o700 }); resolveInside(originals, '', { directory: true });
    const originalFile = path.join(originals, `${digest(id)}-${digest(bytes)}${ext}`); atomicWrite(originalFile, bytes, { exclusive: true });
    const source = { id, rootId: root.id, rel_path: rel, originalFile, hash: digest(bytes), fileStamp: fileStamp(stat), inode: `${stat.dev}:${stat.ino}`, provenance: { capturedAt: now(), ...provenance }, status: 'retained', missing: false };
    index.sources.push(source); return source;
  }
  function importLegacy() {
    for (const source of legacyState().project.sources) {
      if (index.legacyImported.includes(source.id)) continue;
      if (!index.sources.some(s => s.id === source.id)) savedFile('library', 'Earlier sources', `${slugifyName(source.title)}.md`, `---\ntitle: ${JSON.stringify(source.title)}\n${source.url ? `source_url: ${JSON.stringify(source.url)}\n` : ''}---\n\n${source.body}`, { kind: 'existing-workspace', originalId: source.id, originalUrl: source.url }, source.id);
      index.legacyImported.push(source.id);
    }
  }
  // Only the terminal's own recorded cwd can identify a managed snapshot.
  // A matching filename/header elsewhere is still ordinary user research.
  function terminalSnapshotPaths() {
    const result = new Set(), dir = path.join(dataDir, 'terminal');
    if (!fs.existsSync(dir)) return result;
    resolveInside(dataDir, 'terminal', { directory: true });
    for (const name of fs.readdirSync(dir).filter(name => /^[a-f0-9-]{36}\.json$/.test(name))) {
      let session; try { session = readJson(path.join(dir, name), null); } catch { continue; }
      if (!session || session.id !== name.slice(0, -5) || typeof session.cwd !== 'string' || !path.isAbsolute(session.cwd)) continue;
      try {
        const file = path.join(fs.realpathSync(session.cwd), 'accepted-manuscript.snapshot.md');
        if (!file.startsWith(roots[0].path + path.sep)) continue;
        const checked = resolveInside(roots[0].path, path.relative(roots[0].path, file)); regular(checked);
        const fd = fs.openSync(checked, 'r'); let prefix;
        try { const bytes = Buffer.alloc(256), length = fs.readSync(fd, bytes, 0, bytes.length, 0); prefix = bytes.subarray(0, length).toString('utf8'); } finally { fs.closeSync(fd); }
        if (/^<!-- Read-only-in-purpose saved manuscript snapshot; edits here are not accepted into the writing document automatically\. Revision [0-9]+\. -->\n\n/.test(prefix)) result.add(file);
      } catch { /* Unavailable/unrecognised files stay outside this narrow exclusion. */ }
    }
    return result;
  }
  function refresh() {
    const before = JSON.stringify(index); importLegacy();for(const source of index.sources)delete source.originalReferences;
    if (folderMetadata.size > 20000) folderMetadata.clear();
    const managedSnapshots = terminalSnapshotPaths();
    for (const source of index.sources) { if (source.rootId === 'library' && managedSnapshots.has(path.join(roots[0].path, source.rel_path))) source.managedTerminalSnapshot = true; else delete source.managedTerminalSnapshot; }
    const seen = new Set(); const incompleteRoots = new Set(); const trees = [];
    const unavailable=root=>{root.available=false;root.connectionError='Folder unavailable or its scan could not complete. Reconnect it and refresh.';incompleteRoots.add(root.id);trees.push({...root,tree:{rel_path:'',name:root.name,file_count:0,total_count:0,conflict_count:0,folders:[],files:[]}});};
    for (const root of roots) {
      let tree;
      try{resolveInside(root.path, '', { directory: true });const lexical=root.path.replace(/^\/(tmp|var)(?=\/|$)/,'/private/$1');if(fs.realpathSync(root.path)!==lexical)throw new StateError('A connected folder path changed into a symlink.',403);tree = root.retainedCatalog||root.originalCatalog ? catalogTree(root) : readFolder(root.path, '', { count: 0, max: 20000, truncated: false, metadataCache: folderMetadata,throwOnReadError:true });root.available=true;delete root.connectionError;}
      catch{unavailable(root);continue;}
      // A later overlapping connection must not mint another UUID for an
      // existing catalogued original. Its allowlist and original root still own
      // availability; reconnecting a broad folder cannot bypass that boundary.
      if (!root.writable && !root.retainedCatalog && !root.originalCatalog && originalCatalog) {
        const owned = new Set(index.sources.filter(source => source.rootId === originalCatalog.id).map(source => path.join(originalCatalog.path, source.rel_path)));
        const prune = folder => { folder.files = folder.files.filter(file => !owned.has(path.join(root.path, file.rel_path))); for (const child of folder.folders) prune(child); folder.file_count = folder.files.length; folder.total_count = folder.file_count + folder.folders.reduce((total, child) => total + child.total_count, 0); };
        prune(tree);
      }
      if (root.id === 'library' && managedSnapshots.size) {
        const prune = folder => { folder.files = folder.files.filter(file => !managedSnapshots.has(path.join(root.path, file.rel_path))); for (const child of folder.folders) prune(child); folder.file_count = folder.files.length; folder.total_count = folder.file_count + folder.folders.reduce((total, child) => total + child.total_count, 0); };
        prune(tree);
      }
      // Exclude processing/fixture rows from discovery, without deleting their files.
      const pruneNonContent=folder=>{folder.files=folder.files.filter(file=>isLiveLibrarySource({...file,rootId:root.id}));for(const child of folder.folders)pruneNonContent(child);folder.folders=folder.folders.filter(child=>isLiveLibrarySource({rootId:root.id,rel_path:child.rel_path+'/.folder'}));folder.file_count=folder.files.length;folder.total_count=folder.file_count+folder.folders.reduce((total,child)=>total+child.total_count,0);};
      pruneNonContent(tree);
      if (root.id === 'recordings') { tree.files = tree.files.filter(file => !['runner-config.json', 'source-links.json'].includes(file.rel_path)); tree.file_count = tree.files.length; tree.total_count = tree.file_count + tree.folders.reduce((total, folder) => total + folder.total_count, 0); }
      if (tree.truncated) incompleteRoots.add(root.id);
      const flat = [];
      function collect(folder) { for (const file of folder.files) flat.push(file); for (const child of folder.folders) collect(child); }
      collect(tree);
      const inodeCounts = new Map(),scanStats=new Map();
      try{for (const meta of flat) { const stat = fs.lstatSync(resolveInside(root.path, meta.rel_path));scanStats.set(meta.rel_path,stat); const inode = `${stat.dev}:${stat.ino}`; inodeCounts.set(inode, (inodeCounts.get(inode) || 0) + 1); }}catch{unavailable(root);continue;}
      // Match the whole scan before mutating paths. Inode-first matching preserves
      // references across a name swap or a move whose old path now holds a new file.
      // Ambiguous hardlinks stay path-based; missing old inodes are never guessed.
      const previous=index.sources.filter(source=>source.rootId===root.id),matches=new Map(),claimed=new Set(),previousInodes=new Map(),previousPaths=new Map();
      for(const source of previous){previousPaths.set(source.rel_path,source);if(!source.missing){const candidates=previousInodes.get(source.inode)||[];candidates.push(source);previousInodes.set(source.inode,candidates);}}
      for(const meta of flat){if(root.originalCatalog)continue;if(root.retainedCatalog){const source=previous.find(item=>item.id===meta.providedUUID);if(source){matches.set(meta.rel_path,source);claimed.add(source.id);}continue;}const stat=scanStats.get(meta.rel_path),inode=`${stat.dev}:${stat.ino}`,candidates=previousInodes.get(inode)||[];if(inodeCounts.get(inode)===1&&candidates.length===1){matches.set(meta.rel_path,candidates[0]);claimed.add(candidates[0].id);}}
      for(const meta of flat)if(!root.retainedCatalog&&!matches.has(meta.rel_path)){const source=previousPaths.get(meta.rel_path);if(source&&!claimed.has(source.id)){matches.set(meta.rel_path,source);claimed.add(source.id);}}
      for (const meta of flat) {
        const file = resolveInside(root.path, meta.rel_path), stat = scanStats.get(meta.rel_path);
        const inode = `${stat.dev}:${stat.ino}`;
        let source = matches.get(meta.rel_path);
        if (!source) { source = { id: meta.providedUUID || randomUUID(), rootId: root.id, provenance: { kind: root.retainedCatalog ? 'retained-transcript-catalog' : root.originalCatalog ? 'catalogued-original-reference' : root.writable ? 'external-file' : 'connected-root', capturedAt: now(), originalPath: file } }; index.sources.push(source); }
        const stamp = fileStamp(stat), changed = source.fileStamp !== stamp;
        const textFile = TEXT.has(path.extname(file).toLowerCase());
        let body = null, hash = changed ? null : source.hash ?? null;
        if (textFile && stat.size <= MAX_BODY_BYTES) {
          if (changed || source.hasReadableBody === undefined) { const bytes=fs.readFileSync(file); hash=digest(bytes);body=splitFrontmatter(bytes.toString('utf8'));source.hasReadableBody=Boolean(body.body.trim());source.processingStatus=body.frontmatter.processing_status;source.reviewDeclaration=body.frontmatter.review_status; }
          else body={frontmatter:{processing_status:source.processingStatus,review_status:source.reviewDeclaration,source_url:source.source_url,recording_id:source.recordingId},body:source.hasReadableBody?'present':''};
        }
        // sourceId labels the tree leaf; it is derived transport metadata, not a new index field.
        const {originalReferences,sourceId:treeSourceId,...sourceMeta}=meta;
        Object.assign(source, sourceMeta, { hash, fileStamp: stamp, hashStatus: hash ? 'verified' : 'deferred-until-open', inode, missing: false });
        delete source.providedUUID;
        source.status = textFile && stat.size > MAX_BODY_BYTES ? 'retained-text-too-large' : source.kind === 'audio' ? 'retained-needs-transcription' : source.kind === 'other' || source.kind === 'pdf' ? 'retained-needs-extraction' : ['link', 'web-extraction'].includes(source.provenance.kind) && body?.frontmatter.processing_status && body.frontmatter.processing_status !== 'ready' ? body.frontmatter.processing_status : 'ready';
        source.source_url ||= body?.frontmatter.source_url;
        if (body?.frontmatter.recording_id) source.recordingId = body.frontmatter.recording_id;
        if(source.ingestionJobId && ingestionState) { const job=ingestionState(source.ingestionJobId);if(job) { source.status = ({queued:'queued',running:'processing',done:'ready',attention:'needs-captions',failed:'needs-extraction',conflict:'conflict'})[job.state] || source.status;source.processingError=job.error || job.captionError || null;if(job.backend)source.provenance.extraction={jobId:job.id,backend:job.backend,rawFiles:job.rawFiles}; } }
        const recording = source.kind === 'audio' && recordingState ? recordingState(source.id) : null;
        const transcript = recordingSourceSnapshot?.({...source,path:file});
        if(transcript?.managed)source.transcriptState={coherent:transcript.coherent,reviewStatus:transcript.reviewStatus,reason:transcript.reason||null,jobId:transcript.jobId};else delete source.transcriptState;
        const reviewed = transcript?.managed ? transcript.coherent&&transcript.reviewStatus==='reviewed' : body?.frontmatter.review_status === 'reviewed' || recording?.reviewStatus === 'reviewed';
        const readable = Boolean(body?.body.trim());
        const extractionState = ['queued','processing','needs-extraction','conflict'].includes(source.status) ? source.status : source.status === 'retained-text-too-large' ? 'unavailable' : source.status === 'needs-captions' ? 'metadata-only' : source.kind === 'audio' ? 'not-applicable' : source.kind === 'pdf' || source.kind === 'other' ? 'unavailable' : 'ready';
        source.pipelineStates = {
          retention: { state: 'retained', originalAvailable: Boolean(source.originalFile) || !root.writable, hash: source.hash },
          extraction: { state: extractionState, method: source.provenance.extraction?.backend || source.provenance.backend || (body ? 'supplied-text' : 'none') },
          transcription: { state: source.kind === 'transcript' ? 'available' : source.kind === 'audio' ? recording?.state === 'unavailable' ? 'unavailable' : recording?.transcriptReady ? 'available' : recording?.state === 'running' ? 'processing' : recording?.state === 'failed' ? 'failed' : 'saved-only' : source.status === 'needs-captions' ? 'unavailable' : 'not-applicable', ...(recording?.state==='unavailable'?{reason:recording.reason}:{}), method: source.provenance.extraction?.backend === 'copied-i64os-yt-dlp' ? 'youtube-captions' : source.kind === 'audio' || source.recordingId ? 'magazine-local' : source.kind === 'transcript' ? 'supplied-transcript' : 'none' },
          review: { state: reviewed ? 'reviewed' : 'unreviewed', basis: transcript?.managed ? transcript.coherent?'recorded-workshop-snapshot':'transcript-needs-reconciliation' : reviewed ? recording?.reviewStatus === 'reviewed' ? 'recorded-workshop-review' : 'source-declaration' : 'no-human-review-recorded' },
        };
        source.cardEligibility = source.provenance?.kind === 'piece-writing-template' ? { eligible: false, reason: 'This is writing guidance for a piece, not source evidence.' } : { eligible: readable && source.status === 'ready', reason: readable && source.status === 'ready' ? reviewed ? 'Readable material; human review is recorded.' : 'Readable material; human review is still unrecorded.' : source.kind === 'audio' ? 'Choose its transcript before making a text card.' : 'Readable extraction is not ready.' };
        if(recording?.state==='unavailable')source.cardEligibility={eligible:false,reason:recording.reason};
        if(transcript?.managed&&!transcript.coherent)source.cardEligibility={eligible:false,reason:transcript.reason||'Open this recording’s transcript to review outside edits before using it.'};
        if(originalReferences)source.originalReferences=structuredClone(originalReferences);
        seen.add(source.id); Object.assign(meta, publicSource(source), {sourceId:source.id});
      }
      trees.push({ ...root, tree });
    }
    for (const source of index.sources) if (isLiveLibrarySource(source)&&!seen.has(source.id) && !incompleteRoots.has(source.rootId)) source.missing = true;
    if (JSON.stringify(index) !== before) persist();
    // Locations and saved filing readers pin the same persisted index bytes.
    // Refresh must not advertise a tree paired with another process's revision.
    const captured=index,loaded=loadTyped();
    if(!same(captured,loaded.value))throw new StateError('Library index changed during the folder read; refresh.',409);
    return { revision: index.revision, indexHash:loaded.hash, roots: trees, sources: index.sources.filter(s => !s.missing && !s.managedTerminalSnapshot && isLiveLibrarySource(s)).map(publicSource), collections: index.collections, missingSources: index.sources.filter(s => s.missing&&!s.managedTerminalSnapshot&&isLiveLibrarySource(s)).map(missingSummary), unavailableSources: index.sources.filter(s => !s.missing&&!s.managedTerminalSnapshot&&isLiveLibrarySource(s)&&roots.find(root=>root.id===s.rootId)?.available===false).map(missingSummary) };
  }
  const externalRoot = root => root && !root.retainedCatalog && !root.originalCatalog && !['library','recordings'].includes(root.id) && !root.writable;
  function missingSummary(source) {
    const root=roots.find(root=>root.id===source.rootId),external=externalRoot(root)&&source.provenance?.kind==='connected-root';
    return {id:source.id,rootId:source.rootId,rootName:root?.name||source.rootId,title:source.title||source.name||path.basename(source.rel_path),rel_path:source.rel_path,hash:source.hash||null,reconnectable:!!external&&/^[a-f0-9]{64}$/.test(source.hash||''),reason:!root?'Connect the original folder before reconciling this file.':!external?'Only a missing external file can be reconnected.':!/^[a-f0-9]{64}$/.test(source.hash||'')?'No verified captured hash; identity cannot be reconciled safely.':root.available===false?'Original folder unavailable.':'File missing.'};
  }
  function reconnectionPair(input) {
    const originals=index.sources.filter(source=>source.id===input.sourceId),targets=index.sources.filter(source=>source.id===input.targetId);
    if(originals.length!==1||targets.length!==1||input.sourceId===input.targetId)throw new StateError('Choose one retained missing identity and one current file.',409);
    const source=originals[0],target=targets[0],oldRoot=roots.find(root=>root.id===source.rootId),newRoot=rootById(target.rootId);
    if(!externalRoot(oldRoot)||source.provenance?.kind!=='connected-root'||!externalRoot(newRoot)||target.provenance?.kind!=='connected-root'||target.originalFile||source.managedTerminalSnapshot||target.managedTerminalSnapshot)throw new StateError('Choose missing and current files from explicitly connected read-only folders.',409);
    if(!/^[a-f0-9]{64}$/.test(source.hash||''))throw new StateError('The missing file has no verified captured hash. Its identity cannot be reconciled safely.',409);
    let absent=false;
    try{const previous=resolveInside(oldRoot.path,source.rel_path);if(fs.lstatSync(previous).isFile())throw new StateError('The original location still contains a file. No identity was changed.',409);}
    catch(error){if(error.code==='ENOENT'||error.status===404)absent=true;else throw error;}
    if(!absent||(!source.missing&&oldRoot.available!==false))throw new StateError('The original location is not confirmed missing. Refresh or reconnect its folder first.',409);
    if(target.missing||newRoot.available===false)throw new StateError('Choose an available current file.',409);
    const file=checkedFile(target),stat=regular(file);if(stat.size>128*1024*1024)throw new StateError('This file exceeds the bounded 128 MB reconnection check.',413);
    if(index.sources.some(other=>other.id!==source.id&&other.id!==target.id&&!other.missing&&other.inode===`${stat.dev}:${stat.ino}`))throw new StateError('The current file has an ambiguous indexed identity. No identity was changed.',409);
    return {source,target,oldRoot,newRoot,file,stat};
  }
  async function reconnectPreview(input={}) {
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['sourceId','targetId'].includes(key))||typeof input.sourceId!=='string'||typeof input.targetId!=='string')throw new StateError('Choose the missing source and an explicit current file.');
    refresh();const pair=reconnectionPair(input),hash=await streamHash(pair.file);
    if(hash!==pair.source.hash)throw new StateError('The chosen file does not match the captured SHA-256. It remains a separate source.',409);
    if(fileStamp(regular(checkedFile(pair.target)))!==fileStamp(pair.stat))throw new StateError('The chosen file changed while checking its bytes. Preview again.',409);
    const checkedReferences=assertUnusedSourceId({dataDir,index,sourceId:pair.target.id});
    return {source:{id:pair.source.id,title:pair.source.title||pair.source.name,rootId:pair.source.rootId,rootName:pair.oldRoot.name,rel_path:pair.source.rel_path,hash:pair.source.hash},target:{id:pair.target.id,title:pair.target.title||pair.target.name,rootId:pair.target.rootId,rootName:pair.newRoot.name,rel_path:pair.target.rel_path,path:pair.file,hash},checkedReferences,confirmation:{sourceId:pair.source.id,targetId:pair.target.id,expectedRevision:index.revision,expectedSourceHash:pair.source.hash,expectedTargetHash:hash,expectedTargetRootId:pair.target.rootId,expectedTargetPath:pair.target.rel_path,expectedTargetStamp:fileStamp(pair.stat)}};
  }
  async function reconnectMoved(input={}) {
    const keys=['sourceId','targetId','expectedRevision','expectedSourceHash','expectedTargetHash','expectedTargetRootId','expectedTargetPath','expectedTargetStamp','confirmed'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key))||!keys.every(key=>Object.hasOwn(input,key))||input.confirmed!==true||!Number.isSafeInteger(input.expectedRevision))throw new StateError('Preview and explicitly confirm this moved file before reconnecting it.');
    refresh();if(input.expectedRevision!==index.revision)throw new StateError('The Library changed after the preview. Preview the current file again.',409);
    const pair=reconnectionPair(input);
    if(pair.source.hash!==input.expectedSourceHash||pair.target.rootId!==input.expectedTargetRootId||pair.target.rel_path!==input.expectedTargetPath||fileStamp(pair.stat)!==input.expectedTargetStamp)throw new StateError('The selected source or destination changed after the preview. Preview again.',409);
    const hash=await streamHash(pair.file);if(hash!==input.expectedTargetHash||hash!==pair.source.hash)throw new StateError('The current file no longer matches the captured bytes. No identity was changed.',409);
    const checkedReferences=assertUnusedSourceId({dataDir,index,sourceId:pair.target.id});
    if(fileStamp(regular(checkedFile(pair.target)))!==input.expectedTargetStamp)throw new StateError('The selected current file changed. No identity was changed.',409);
    const from={rootId:pair.source.rootId,rootName:pair.oldRoot.name,rel_path:pair.source.rel_path,hash:pair.source.hash,inode:pair.source.inode},to={rootId:pair.target.rootId,rootName:pair.newRoot.name,rel_path:pair.target.rel_path,hash,inode:pair.target.inode};
    const receipt={id:randomUUID(),kind:'operator-confirmed-file-reconnection',confirmedAt:now(),from,to,absorbedTarget:{...pair.target},checkedReferences};
    const restored={...pair.source,...pair.target,id:pair.source.id,hash,hashStatus:'verified',provenance:pair.source.provenance,source_url:pair.source.source_url||pair.target.source_url,originalFile:pair.source.originalFile,reconciliationHistory:[...(pair.source.reconciliationHistory||[]),receipt]};
    index.sources=index.sources.filter(source=>source.id!==pair.target.id).map(source=>source.id===pair.source.id?restored:source);persist();refresh();
    return {source:publicSource(restored),receipt,revision:index.revision};
  }
  function read(id,{allowUnreconciled=false}={}) {
    refresh(); const source = sourceById(id), file = checkedFile(source); const extension = path.extname(file).toLowerCase();
    const readable = TEXT.has(extension); let raw = null, text = null;
    if (readable) { if (fs.statSync(file).size > MAX_BODY_BYTES) throw new StateError('Text exceeds the 2 MB reader limit.', 413); raw = fs.readFileSync(file, 'utf8'); text = splitFrontmatter(raw).body; }
    const transcript=recordingSourceSnapshot?.({...source,path:file});
    if(transcript?.managed&&!transcript.coherent&&!allowUnreconciled)throw new StateError(transcript.reason||'Open this recording’s transcript to review outside edits before using it.',409);
    const parts = source.rel_path.split('/'); const breadcrumbs = [{ name: rootById(source.rootId).name, rel_path: '' }, ...parts.slice(0, -1).map((name, i) => ({ name, rel_path: parts.slice(0, i + 1).join('/') }))];
    return { ...publicSource(source), raw, text, body: text, breadcrumbs, blobUrl: `/api/sources/blob?id=${encodeURIComponent(id)}` };
  }
  function expected(source, hash) { if (typeof hash !== 'string' || hash !== source.hash || digest(fs.readFileSync(checkedFile(source))) !== hash) throw new StateError('Source changed outside this edit. Refresh before saving.', 409); }
  const filing=createLibraryFolders({serial,visibleSource:isLiveLibrarySource,load:loadTyped,publicSource:source=>{
    let metadata;try{metadata=publicSource(source);}catch(error){if(error.status!==404)throw error;metadata={...source,sourceUnavailable:true,writable:false};delete metadata.originalFile;}
    let available=!source.missing&&!metadata.sourceUnavailable;
    if(available){try{regular(resolveInside(rootById(source.rootId).path,source.rel_path));}catch{available=false;}}
    return {...metadata,sourceUnavailable:!available,blobUrl:`/api/sources/blob?id=${encodeURIComponent(source.id)}`};
  },publish:(loaded,next)=>{
    const current=loadTyped();if(current.hash!==loaded.hash||current.value.revision!==loaded.value.revision)typedFail('Library changed before folder publication; refresh.');
    const bytes=JSON.stringify(next,null,2);
    try{resolveInside(dataDir,'library-index.json',{missing:true});atomicWrite(indexFile,bytes,loaded.bytes===null?{exclusive:true}:{expectedHash:loaded.hash});index=next;}
    catch(error){try{index=readJson(indexFile,loaded.value);}catch{index=loaded.value;}throw error;}
    return {value:next,bytes,hash:digest(bytes)};
  }});
  function topicsView(loaded){return {schema:'ar-create.library-topics.v1',revision:loaded.value.revision,indexHash:loaded.hash,sources:loaded.value.sources.filter(isLiveLibrarySource).map(s=>({sourceId:s.id,topics:[...(s.topics||[])]}))};}
  const readTopics=()=>serial(()=>topicsView(loadTyped()));
  const saveTopics=input=>serial(()=>{
    if(inspectionOnly)typedFail('Topic changes are unavailable in inspection-only mode.',403);
    typedFields(input,['operationId','expectedRevision','expectedHash','actor','sourceIds','topics']);
    if(!UUID.test(input.operationId||'')||!Number.isSafeInteger(input.expectedRevision)||!HASH.test(input.expectedHash||'')||typeof input.actor!=='string'||!/^(human|agent|cron|import):[a-zA-Z0-9_-]+$/.test(input.actor))typedFail('Exact revision/hash, operation UUID and named actor required.',400);
    if(!Array.isArray(input.sourceIds)||!input.sourceIds.length||input.sourceIds.length>200||new Set(input.sourceIds).size!==input.sourceIds.length||input.sourceIds.some(id=>!UUID.test(id||'')))typedFail('Choose up to 200 exact Library sources.',400);
    if(!Array.isArray(input.topics)||input.topics.length>30||input.topics.some(v=>typeof v!=='string'||!v.trim()||v.length>80||/[\x00-\x1f\x7f]/.test(v))||new Set(input.topics.map(v=>v.trim().toLocaleLowerCase())).size!==input.topics.length)typedFail('Use up to 30 distinct short topics.',400);
    const loaded=loadTyped(),fingerprint=digest(JSON.stringify(input)),prior=(loaded.value.topicOperations||[]).find(op=>op.operationId===input.operationId);
    if(prior){if(prior.fingerprint!==fingerprint)typedFail('Operation UUID belongs to another topic edit.');return {...topicsView(loaded),replayed:true};}
    if(input.expectedRevision!==loaded.value.revision||input.expectedHash!==loaded.hash)typedFail('Library changed. Refresh topics before saving.');
    if((loaded.value.topicOperations||[]).length>=10000)typedFail('Topic history is full; existing records preserved.');
    const next=structuredClone(loaded.value),before=[];
    for(const id of input.sourceIds){const source=next.sources.find(s=>s.id===id&&isLiveLibrarySource(s));if(!source)typedFail('This Library source is unavailable.',404);before.push({sourceId:id,topics:[...(source.topics||[])]});source.topics=input.topics.map(v=>v.trim());}
    next.revision++;next.topicOperations??=[];next.topicOperations.push({operationId:input.operationId,fingerprint,actor:input.actor,at:now(),before,after:input.topics.map(v=>v.trim()),resultRevision:next.revision});
    const bytes=JSON.stringify(next,null,2);atomicWrite(indexFile,bytes,loaded.bytes===null?{exclusive:true}:{expectedHash:loaded.hash});index=next;return topicsView({value:next,hash:digest(bytes)});
  });
  // Narrow, non-mutating photo reads for composition. These use the saved
  // Library identities and immutable original copies; they never discover files.
  const photoExtensions=new Set(['.jpg','.jpeg','.png','.gif','.webp','.avif']);
  const binaryDataStat=fs.lstatSync(dataDir),binaryDataIdentity=`${binaryDataStat.dev}:${binaryDataStat.ino}`;
  const binaryRoots=new Map(roots.map(root=>{try{const st=fs.lstatSync(root.path);return [root.id,`${root.path}:${st.dev}:${st.ino}`];}catch{return [root.id,null];}}));
  const binaryRoot=root=>{
    const dataStat=fs.lstatSync(dataDir);resolveInside(dataDir,'',{directory:true});if(`${dataStat.dev}:${dataStat.ino}`!==binaryDataIdentity)throw new StateError('Library data root changed; reopen the library.',409);
    const st=fs.lstatSync(root.path);resolveInside(root.path,'',{directory:true});
    const identity=`${root.path}:${st.dev}:${st.ino}`;
    if(binaryRoots.get(root.id)!==identity)throw new StateError('Library photo root changed; reopen the library.',409);
    return digest(identity);
  };
  // Existing immutable-retention provenance, projected as bounded identities only.
  const photoOrigin=value=>value&&typeof value==='object'&&['rootId','revision','sourceHash'].every(k=>HASH.test(value[k]||''))&&typeof value.sourceId==='string'&&/^(?:[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value.sourceId)?Object.fromEntries(['rootId','sourceId','revision','sourceHash'].map(k=>[k,value[k]])):null;
  const photoOriginRef=value=>value&&HASH.test(value.rootId||'')?(value.kind==='publication'&&typeof value.relativePath==='string'&&value.relativePath.length<=1024&&/^read\/[-a-z0-9]+\/[^/\\\u0000-\u001f\u007f]+$/.test(value.relativePath)&&!['.','..'].includes(value.relativePath.split('/').at(-1))?{kind:'publication',rootId:value.rootId,relativePath:value.relativePath}:['library','originals'].includes(value.kind)&&typeof value.sourceId==='string'&&/^(?:[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value.sourceId)?{kind:value.kind,rootId:value.rootId,sourceId:value.sourceId}:null):null;
  const photoMetadata=source=>({id:source.id,rootId:source.rootId,name:path.basename(source.rel_path),relativePath:source.rel_path,description:typeof source.provenance?.description==='string'?source.provenance.description:typeof source.description==='string'?source.description:'',retainedPhoto:source.provenance?.kind==='magazine-library-photo',originalHash:source.provenance?.originalHash||null,...(source.provenance?.kind==='magazine-library-photo'?{retainedOrigin:photoOrigin(source.provenance.origin),retainedOriginRef:photoOriginRef(source.provenance.originRef)}:{})});
  const metadataRevision=(rootHash,source,stat)=>digest(`photo-metadata:${rootHash}:${source.id}:${fileStamp(stat)}:${JSON.stringify(photoMetadata(source))}`);
  const photosSnapshot=(options={})=>serial(()=>{
    if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>k!=='byteMetadata')||options.byteMetadata!==undefined&&typeof options.byteMetadata!=='boolean')throw new StateError('Use the bounded photograph metadata projection.',400);
    const {value,hash:indexHash}=loadTyped(),items=[],issues=[],retainedProofs=new Map();
    if(options.byteMetadata)for(const row of value.sources){const origin=row.provenance?.kind==='magazine-library-photo'?photoOrigin(row.provenance.origin):null;if(!origin||row.provenance.originalHash!==origin.sourceHash)continue;const key=origin.rootId+'\0'+origin.sourceId,known=retainedProofs.get(key)||[];known.push(origin);retainedProofs.set(key,known);}
    for(const root of roots){
      let rootHash;try{rootHash=binaryRoot(root);}catch{issues.push({rootId:root.id,reason:'root-unavailable-or-changed'});continue;}
      for(const source of value.sources.filter(row=>row.rootId===root.id&&!row.managedTerminalSnapshot&&photoExtensions.has(path.extname(row.rel_path).toLowerCase()))){
        const item={...photoMetadata(source),rootHash,rootName:root.name,missing:!!source.missing};
        if(options.byteMetadata){
          try{
            if(source.missing)throw new StateError('Photograph is unavailable.',404);
            const file=checkedFile(source),before=regular(file),stamp=fileStamp(before),fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let prefix;
            try{if(fileStamp(fs.fstatSync(fd))!==stamp)throw new StateError('Photograph changed during metadata inspection.',409);prefix=Buffer.alloc(Math.min(16,before.size));if(fs.readSync(fd,prefix,0,prefix.length,0)!==prefix.length||fileStamp(fs.fstatSync(fd))!==stamp)throw new StateError('Photograph changed during metadata inspection.',409);}finally{fs.closeSync(fd);}
            if(fileStamp(regular(file))!==stamp||binaryRoot(root)!==rootHash)throw new StateError('Photograph changed during metadata inspection.',409);
            let hash=source.fileStamp===stamp&&HASH.test(source.hash||'')?source.hash:null,state=hash?'indexed-current-stat':'pending';
            if(!hash){const rootId=digest('library\0'+source.rootId+'\0'+rootHash),proofs=retainedProofs.get(rootId+'\0'+source.id)||[],matches=[...new Set(proofs.filter(proof=>proof.revision===digest(`${rootHash}:${source.id}:${stamp}:${proof.sourceHash}:${JSON.stringify(photoMetadata(source))}`)).map(proof=>proof.sourceHash))];if(matches.length===1){hash=matches[0];state='retained-origin-current-stat';}}
            const metadata=metadataRevision(rootHash,source,before);
            item.byteMetadata={state,hash,bytes:before.size,prefix:prefix.toString('base64'),metadataRevision:metadata,revision:hash?digest(`${rootHash}:${source.id}:${stamp}:${hash}:${JSON.stringify(photoMetadata(source))}`):metadata,reason:hash?null:source.fileStamp===stamp?'Photograph bytes have not been checked.':'Photograph changed since its indexed hash; verify this exact file before choosing.'};
          }catch{item.byteMetadata={state:'unavailable',hash:null,bytes:null,prefix:null,metadataRevision:digest(`unavailable:${rootHash}:${source.id}:${source.fileStamp||''}`),revision:digest(`unavailable:${rootHash}:${source.id}:${source.fileStamp||''}`),reason:'The indexed photograph is unavailable or changed during inspection.'};}
        }
        if(options.byteMetadata&&item.retainedPhoto){
          try{const digestHash=item.originalHash,ext=path.extname(source.originalFile||'').toLowerCase(),originals=path.join(dataDir,'source-originals');if(!HASH.test(digestHash||'')||path.basename(source.originalFile||'')!==`${digest(source.id)}-${digestHash}${ext}`||path.resolve(source.originalFile)!==path.join(originals,path.basename(source.originalFile)))throw new StateError('Unproved retained original.',409);const stat=regular(resolveInside(originals,path.basename(source.originalFile)));item.originalMetadata={available:true,bytes:stat.size};}catch{item.originalMetadata={available:false,bytes:null};}
        }
        items.push(item);
      }
    }
    if(options.byteMetadata&&loadTyped().hash!==indexHash)throw new StateError('Library metadata changed during inspection.',409);
    return {revision:value.revision,indexHash,items,coverage:{complete:issues.length===0,issues}};
  });
  const binarySnapshot=input=>serial(()=>{
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['id','expectedHash','rootHash','original'].includes(key))||!UUID.test(input.id||'')||input.expectedHash!==undefined&&!HASH.test(input.expectedHash)||input.rootHash!==undefined&&!HASH.test(input.rootHash)||input.original!==undefined&&typeof input.original!=='boolean')throw new StateError('Choose an existing Library photo identity and hash.',400);
    const {value,hash:indexHash}=loadTyped(),matches=value.sources.filter(row=>row.id===input.id);
    if(matches.length!==1)throw new StateError('Library photo identity is unavailable or ambiguous.',404);
    const source=matches[0],root=rootById(source.rootId),rootHash=binaryRoot(root);
    if(input.rootHash!==undefined&&input.rootHash!==rootHash)throw new StateError('Library photo root changed.',409);
    if(!photoExtensions.has(path.extname(source.rel_path).toLowerCase())||source.managedTerminalSnapshot)throw new StateError('Choose a supported Library photo.',415);
    let file;
    if(input.original){
      if(!source.originalFile||!HASH.test(input.expectedHash||''))throw new StateError('A pinned Library original hash is required.',400);
      const originals=path.join(dataDir,'source-originals'),ext=path.extname(source.originalFile).toLowerCase();
      if(path.basename(source.originalFile)!==`${digest(source.id)}-${input.expectedHash}${ext}`||path.resolve(source.originalFile)!==path.join(originals,path.basename(source.originalFile)))throw new StateError('Pinned Library original does not match this identity.',409);
      file=resolveInside(originals,path.basename(source.originalFile));
    }else{
      if(source.missing)throw new StateError('Library photo is unavailable.',404);
      file=checkedFile(source);
    }
    const before=regular(file);if(before.size>20*1024*1024)throw new StateError('Photo exceeds the 20 MB read limit.',413);
    const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let body;
    try{if(fileStamp(fs.fstatSync(fd))!==fileStamp(before))throw new StateError('Library photo changed before reading.',409);body=Buffer.alloc(before.size);let offset=0;while(offset<body.length){const count=fs.readSync(fd,body,offset,body.length-offset,offset);if(!count)throw new StateError('Library photo changed during reading.',409);offset+=count;}if(fileStamp(fs.fstatSync(fd))!==fileStamp(before))throw new StateError('Library photo changed during reading.',409);}finally{fs.closeSync(fd);}
    const hash=digest(body);if(fileStamp(regular(file))!==fileStamp(before)||input.expectedHash!==undefined&&hash!==input.expectedHash||binaryRoot(root)!==rootHash||loadTyped().hash!==indexHash)throw new StateError('Library photo changed; refresh the library.',409);
    return {...photoMetadata(source),rootHash,hash,body,bytes:body.length,indexHash,metadataRevision:metadataRevision(rootHash,source,before),revision:digest(`${rootHash}:${source.id}:${fileStamp(before)}:${hash}:${JSON.stringify(photoMetadata(source))}`)};
  });
  if (inspectionOnly) {
    // Only registered identities are projected. There is no refresh, discovery,
    // import, directory creation, index publication or authoring method here.
    const directoryState = file => {
      const stat=fs.lstatSync(file,{throwIfNoEntry:false});
      if(!stat)return null;
      if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Library root changed into an unsafe path.',403);
      return {identity:`${stat.dev}:${stat.ino}:${fs.realpathSync(file)}`,stamp:fileStamp(stat)};
    };
    const initialData=directoryState(dataDir);
    if(initialData===null)throw new StateError('Library data root is unavailable.',503);
    const initialRoots=new Map(roots.map(root=>[root.id,directoryState(root.path)?.identity??null]));
    const rootGuard=()=>{
      const data=directoryState(dataDir);
      if(data?.identity!==initialData.identity)throw new StateError('Library data root changed; reopen the catalog.',409);
      const stamps=new Map([['data',data.stamp]]);
      for(const root of roots){
        const current=directoryState(root.path);
        if((current?.identity??null)!==initialRoots.get(root.id))throw new StateError('Library source root changed; reopen the catalog.',409);
        root.available=current!==null;
        stamps.set(root.id,current?.stamp??null);
      }
      return stamps;
    };
    const exactIndex=()=>{
      const before=fs.lstatSync(indexFile,{throwIfNoEntry:false});
      if(!before)throw new StateError('Library index is unavailable; no catalog was inferred.',503);
      regular(indexFile);
      const loaded=loadTyped(),after=regular(indexFile);
      if(fileStamp(before)!==fileStamp(after))throw new StateError('Library index changed during inspection.',409);
      const value=loaded.value;
      for(const key of ['sources','collections','evidence'])if(new Set(value[key].map(row=>row?.id)).size!==value[key].length)throw new StateError('Ambiguous Library identities; catalog refused.',409);
      for(const source of value.sources){
        if(!source||typeof source.id!=='string'||typeof source.rootId!=='string'||!roots.some(root=>root.id===source.rootId))throw new StateError('Invalid Library source identity or root.',409);
        safeRel(source.rel_path,false);
      }
      for(const collection of value.collections)if(!collection||typeof collection.id!=='string'||!Array.isArray(collection.sourceIds)||new Set(collection.sourceIds).size!==collection.sourceIds.length||collection.sourceIds.some(id=>value.sources.filter(source=>source.id===id).length!==1))throw new StateError('Invalid Library collection membership.',409);
      return {...loaded,stamp:fileStamp(after)};
    };
    const guarded=async read=>{
      const beforeRoots=rootGuard(),before=exactIndex();
      const result=await read(structuredClone(before.value),before);
      const afterRoots=rootGuard(),after=exactIndex();
      for(const [id,stamp] of beforeRoots)if(afterRoots.get(id)!==stamp)throw new StateError('Library source root changed during inspection.',409);
      if(after.hash!==before.hash||after.stamp!==before.stamp)throw new StateError('Library index changed during inspection.',409);
      return result;
    };
    const catalog=(value,loaded)=>{
      const trees=roots.map(root=>({...root,tree:{rel_path:'',name:root.name,file_count:0,total_count:0,conflict_count:0,folders:[],files:[]},...(root.available?{}:{connectionError:'Folder unavailable. Reconnect it before reading.'})}));
      const byRoot=new Map(trees.map(root=>[root.id,root]));
      const availableById=new Map();
      for(const source of value.sources.filter(source=>!source.missing&&!source.managedTerminalSnapshot&&isLiveLibrarySource(source))){
        const root=byRoot.get(source.rootId),parts=source.rel_path.split('/');let folder=root.tree;
        let available=root.available;
        if(available)try{regular(resolveInside(root.path,source.rel_path));}catch{available=false;}
        availableById.set(source.id,available);
        for(let i=0;i<parts.length-1;i++){
          let child=folder.folders.find(item=>item.name===parts[i]);
          if(!child){child={rel_path:parts.slice(0,i+1).join('/'),name:parts[i],file_count:0,total_count:0,conflict_count:0,folders:[],files:[]};folder.folders.push(child);}
          folder=child;
        }
        folder.files.push({rel_path:source.rel_path,name:source.name||path.basename(source.rel_path,path.extname(source.rel_path)),title:source.title||source.name||path.basename(source.rel_path),kind:source.kind||kindFor(path.join(root.path,source.rel_path),{}),size_bytes:source.size_bytes??null,modified_at:source.modified_at??null,sourceId:source.id,sourceUnavailable:!available});
      }
      const count=folder=>{folder.file_count=folder.files.length;folder.total_count=folder.file_count+folder.folders.reduce((n,child)=>n+count(child),0);return folder.total_count;};
      for(const root of trees)count(root.tree);
      return {revision:value.revision,indexHash:loaded.hash,roots:trees,sources:value.sources.filter(source=>!source.missing&&!source.managedTerminalSnapshot&&isLiveLibrarySource(source)).map(source=>({...publicSource(source),sourceUnavailable:!availableById.get(source.id),...availableById.get(source.id)?{}:{cardEligibility:{eligible:false,reason:'Saved file is unavailable or unsafe.'}}})),collections:structuredClone(value.collections),missingSources:value.sources.filter(source=>source.missing&&!source.managedTerminalSnapshot&&isLiveLibrarySource(source)).map(missingSummary),unavailableSources:value.sources.filter(source=>!source.missing&&!source.managedTerminalSnapshot&&isLiveLibrarySource(source)&&!availableById.get(source.id)).map(source=>({...missingSummary(source),reason:byRoot.get(source.rootId).available?'Saved file is unavailable or unsafe.':'Source folder is unavailable.'}))};
    };
    const sourceText=async input=>guarded((value,loaded)=>{
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['id','expectedIndexHash','expectedHash','expectedStamp'].includes(key))||typeof input.id!=='string')throw new StateError('Select an indexed Library source ID.',400);
      if(input.expectedIndexHash!==undefined&&input.expectedIndexHash!==loaded.hash)throw new StateError('Library index changed; refresh the source.',409);
      const matches=value.sources.filter(source=>source.id===input.id);
      if(matches.length!==1||matches[0].missing||matches[0].managedTerminalSnapshot)throw new StateError('Source is unavailable in the saved catalog.',404);
      const source=matches[0],root=rootById(source.rootId);
      if(!root.available)throw new StateError('Source folder is unavailable.',503);
      const file=resolveInside(root.path,source.rel_path),extension=path.extname(file).toLowerCase();
      if(!TEXT.has(extension))throw new StateError('This source is not readable text.',415);
      const before=regular(file);
      if(before.size>MAX_BODY_BYTES)throw new StateError('Text exceeds the 2 MB reader limit.',413);
      if(input.expectedStamp!==undefined&&input.expectedStamp!==fileStamp(before))throw new StateError('Source changed; refresh before reading.',409);
      const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
      let bytes,opened;
      try{
        opened=fs.fstatSync(fd);if(fileStamp(opened)!==fileStamp(before))throw new StateError('Source changed during inspection.',409);
        bytes=Buffer.alloc(before.size);
        for(let offset=0;offset<bytes.length;){const length=fs.readSync(fd,bytes,offset,bytes.length-offset,null);if(length===0)throw new StateError('Source changed during inspection.',409);offset+=length;}
        if(fileStamp(fs.fstatSync(fd))!==fileStamp(opened))throw new StateError('Source changed during inspection.',409);
      }
      finally{fs.closeSync(fd);}
      if(bytes.length>MAX_BODY_BYTES||bytes.length!==before.size)throw new StateError('Source changed or exceeds the 2 MB reader limit.',409);
      const after=regular(file),hash=digest(bytes);
      if(fileStamp(after)!==fileStamp(before))throw new StateError('Source changed during inspection.',409);
      if(source.hash&&source.hash!==hash||input.expectedHash!==undefined&&input.expectedHash!==hash)throw new StateError('Source bytes differ from the saved catalog; refresh before reading.',409);
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes),text=splitFrontmatter(raw).body;
      return {...publicSource(source),raw,text,body:text,hash,stamp:fileStamp(after),indexHash:loaded.hash};
    });
    return Object.freeze({
      tree:()=>guarded(catalog),
      folders:input=>guarded(async()=>filing.read(input)),
      collectionsSnapshot:()=>guarded((value,loaded)=>({revision:value.revision,indexHash:loaded.hash,collections:structuredClone(value.collections)})),
      collectionRelationships:collectionId=>guarded((value,loaded)=>({revision:value.revision,indexHash:loaded.hash,relationships:resolvedCollectionLinks(value.collectionRelationships??[],value.collections,collectionId)})),
      evidence:()=>guarded((value,loaded)=>({revision:value.revision,indexHash:loaded.hash,cards:value.evidence.map(card=>{const source=value.sources.find(item=>item.id===card.sourceId);return {...structuredClone(card),stale:source?.missing||source?.managedTerminalSnapshot||!source||card.sourceHash!==source.hash,sourceMissing:source?.missing||source?.managedTerminalSnapshot||!source,sourceCurrentHash:source?.hash||null,sourcePath:source?.rel_path||null};})})),
      sourceText
    });
  }
  // Exact owner-issued dependency capability. No refresh, resolver or queued read
  // occurs when validate runs inside a native writer's serialized transaction.
  const captureReadGuard=({collections=[],sources=[]}={})=>serial(()=>{
    const loaded=loadTyped(),pins=[];
    for(const {expected}of collections){const matches=loaded.value.collections.filter(c=>c.id===expected.collectionId);if(expected.indexHash!==loaded.hash||expected.revision!==loaded.value.revision||matches.length!==1||JSON.stringify(matches[0].sourceIds)!==JSON.stringify(expected.sourceIds))throw new StateError('Captured Collection identity changed.',409);}
    for(const {expected}of sources){const matches=loaded.value.sources.filter(s=>s.id===expected.id);if(matches.length!==1)throw new StateError('Captured Library source is unavailable.',409);const source=structuredClone(matches[0]),file=checkedFile(source),stat=regular(file);if(stat.size>MAX_BODY_BYTES)throw new StateError('Captured Direction passage exceeds the bounded source read.',413);const bytes=fs.readFileSync(file),text=splitFrontmatter(new TextDecoder('utf-8',{fatal:true}).decode(bytes)).body;if(digest(bytes)!==expected.hash||!Number.isSafeInteger(expected.start)||!Number.isSafeInteger(expected.end)||expected.start<0||expected.end<expected.start||digest(text.slice(expected.start,expected.end))!==expected.quoteHash)throw new StateError('Captured Library passage changed.',409);pins.push({source,file,hash:expected.hash,identity:[stat.dev,stat.ino]});}
    const validate=()=>{if(loadTyped().hash!==loaded.hash)throw new StateError('Captured Library index or Collection metadata changed.',409);for(const pin of pins){const file=checkedFile(pin.source),stat=regular(file);if(file!==pin.file||stat.size>MAX_BODY_BYTES||stat.dev!==pin.identity[0]||stat.ino!==pin.identity[1]||digest(fs.readFileSync(file))!==pin.hash)throw new StateError('Captured Library source bytes changed.',409);}};validate();return Object.freeze({validate});
  });
  return {
    photosSnapshot, binarySnapshot, captureReadGuard, readTopics, saveTopics,
    folders: async(input={})=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='domain'))throw new StateError('Unsupported folder fields; use explicit filing identities.',400);if(!['library','media'].includes(input.domain))throw new StateError('Choose library or media folders.',400);await serial(refresh);return filing.read(input);},changeFolders: input=>filing.change(input),changePhotoFolders:(input,options)=>filing.changePhoto(input,options),
    setConnections: (entries, beforeCommit = () => {}) => serial(() => { const configured=configuredRoots(entries);beforeCommit();roots.splice(2,roots.length-2,...configured,...roots.filter(root=>root.retainedCatalog||root.originalCatalog));folderMetadata.clear();return refresh(); }),
    reconnectPreview: input => serial(()=>reconnectPreview(input)), reconnectMoved: input => serial(()=>reconnectMoved(input)),
    // Existing indexed identity + current physical bytes; no scan, index save or extraction.
    snapshot: (id,{includeBody=false}={}) => serial(async()=>{
      const source=sourceById(id),file=checkedFile(source),stat=regular(file);
      if(!includeBody)return {...publicSource(source),path:file,hash:await streamHash(file)};
      let raw=null,text=null;const readable=TEXT.has(path.extname(file).toLowerCase())&&stat.size<=MAX_BODY_BYTES;
      if(readable){raw=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(file));text=splitFrontmatter(raw).body;}
      const hash=raw===null?await streamHash(file):digest(raw),transcript=recordingSourceSnapshot?.({...source,path:file,hash});
      if(fileStamp(regular(file))!==fileStamp(stat))throw new StateError('Source changed during read-only snapshot.',409);
      return {...publicSource(source),path:file,hash,raw,text,body:text,...(transcript?.managed?{transcriptState:{managed:true,...transcript}}:{})};
    }),
    tree: () => serial(refresh), read: (id,options) => serial(() => read(id,options)),
    blob: (id, original = false) => serial(async () => { refresh(); const source = original ? index.sources.find(s => s.id === id) : sourceById(id); if (!source) throw new StateError('Source was not found.', 404); let file; if (original) { if (!source.originalFile) throw new StateError('This connected file remains at its original location.', 404); file = resolveInside(path.join(dataDir, 'source-originals'), path.basename(source.originalFile)); regular(file); } else { file = checkedFile(source); if (!source.hash) {source.hash=await streamHash(file);source.hashStatus='verified';if(source.pipelineStates)source.pipelineStates.retention.hash=source.hash;persist();} } return { file, source: publicSource(source) }; }),
    folder: input => serial(() => { makeFolder(input.rootId, input.folder); return refresh(); }),
    retainAlbumPhoto: input => serial(() => { refresh(); const source=savedFile('library',input.folder,input.name,input.bytes,input.provenance); persist(); refresh(); return publicSource(source); }),
    import: input => serial(async () => {
      refresh(); rootById(input.rootId, true); safeRel(input.folder || '');
      if (!Array.isArray(input.files || []) || !Array.isArray(input.urls || []) || (input.files?.length || 0) + (input.urls?.length || 0) > 100) throw new StateError('Import up to 100 files or URLs.');
      const receipts = [];
      for (const file of input.files || []) {
        try { string(file.name, 'File name', 240); let bytes;
          if (typeof file.content === 'string') bytes = Buffer.from(string(file.content, 'File content'));
          else if (typeof file.base64 === 'string' && validBase64(file.base64)) bytes = Buffer.from(file.base64, 'base64');
          else throw new StateError('Provide UTF-8 content or valid base64 bytes.');
          if (bytes.length > 64 * 1024 * 1024) throw new StateError('File exceeds 64 MB.', 413);
          const source = savedFile(input.rootId, input.folder || '', file.name, bytes, { kind: 'upload', originalName: file.name, originalHash: digest(bytes) });
          persist(); refresh(); receipts.push({ ok: true, source: publicSource(source) });
        } catch (error) { receipts.push({ ok: false, name: file.name, error: error.message }); }
      }
      for (const raw of input.urls || []) {
        try {
          string(raw, 'URL', 2048); const url = new URL(raw); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new StateError('Use an HTTP or HTTPS source URL without credentials.');
          const identity = normalizeSourceUrl(raw); const existing = index.sources.find(s => !s.missing && s.source_url && normalizeSourceUrl(s.source_url) === identity);
          if (existing) { receipts.push({ ok: true, reused: true, source: publicSource(existing) }); continue; }
          let ripped = null, extractionError = null;
          if (scrape) { try {
            if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^[0-9.]+$/.test(url.hostname) || url.hostname.startsWith('[')) throw new StateError('Extraction requires a public source hostname.');
            ripped = await scrape(url.href, { onlyMainContent: true });
            if (!ripped.markdown?.trim()) throw new Error('Page returned no readable content.');
            if (Buffer.byteLength(ripped.markdown) > MAX_BODY_BYTES) throw new Error('Extracted text exceeds 2 MB.');
          } catch (error) { ripped = null; extractionError = error.message; } }
          const title = ripped?.title?.trim() || url.hostname + url.pathname;
          const note = `---\ntitle: ${JSON.stringify(title)}\nsource_url: ${JSON.stringify(url.href)}\nprocessing_status: ${urlIngestion ? 'queued' : 'needs-extraction'}\n---\n\n# ${title}\n\n${url.href}\n\nLink retained. ${extractionError ? `Extraction failed: ${extractionError}` : urlIngestion ? 'Local extraction is queued.' : 'Extraction is not configured.'} No article or transcript has been generated.\n`;
          const content = ripped ? `---\ntitle: ${JSON.stringify(title)}\nsource_url: ${JSON.stringify(url.href)}\nripped_at: ${now()}\nadded_by: operator\n---\n\n# ${title}\n\n> Source: <${url.href}>\n\n${ripped.markdown.trim()}\n` : note;
          const source = savedFile(input.rootId, input.folder || '', `${slugifyName(title)}.md`, content, { kind: ripped ? 'web-extraction' : 'link', originalUrl: url.href, identity, backend: ripped?.backend, extractionError });
          persist(); refresh();
          if (!ripped && urlIngestion) { const job = urlIngestion(publicSource(source)); source.ingestionJobId = job.id; source.status = 'queued'; persist(); receipts.push({ ok: true, jobId: job.id, source: publicSource(source) }); }
          else receipts.push({ ok: true, source: publicSource(source) });
        } catch (error) { receipts.push({ ok: false, url: raw, error: error.message }); }
      }
      return { receipts, revision: index.revision };
    }),
    write: input => serial(() => {
      refresh(); const source = sourceById(input.id); expected(source, input.expectedHash); const file = checkedFile(source, true); string(input.content, 'Source content');
      if (!TEXT.has(path.extname(file).toLowerCase())) throw new StateError('Only Markdown and text source bodies can be edited.');
      const old = fs.readFileSync(file, 'utf8'); const header = old.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); const content = input.raw === true ? input.content : (header?.[0] || '') + input.content;
      // Keep the pre-edit file outside the browseable shelf for exact recovery.
      const history = path.join(dataDir, 'source-history'); fs.mkdirSync(history, { recursive: true, mode: 0o700 }); resolveInside(history, '', { directory: true });
      atomicWrite(path.join(history, `${digest(Buffer.from(source.id))}-${source.hash}.txt`), old);
      atomicWrite(file, content, { expectedHash: source.hash }); refresh(); return read(source.id);
    }),
    rename: input => serial(() => {
      refresh(); const source = sourceById(input.id); expected(source, input.expectedHash); safeRel(input.toPath, false); const root = rootById(source.rootId, true), from = checkedFile(source, true);
      if (input.toPath === source.rel_path) return read(source.id);
      const to = resolveInside(root.path, input.toPath, { missing: true }); if (fs.lstatSync(to, { throwIfNoEntry: false })) throw new StateError('Destination already exists; no file overwritten.', 409);
      // Atomic no-clobber publication; unlink only after complete target exists.
      const originalStat = fs.lstatSync(from); fs.linkSync(from, to);
      const currentStat = fs.lstatSync(from);
      if (currentStat.ino !== originalStat.ino || currentStat.dev !== originalStat.dev || digest(fs.readFileSync(to)) !== source.hash) { fs.unlinkSync(to); throw new StateError('Source changed during rename. Refresh before moving.', 409); }
      fs.unlinkSync(from); source.rel_path = input.toPath; persist(); refresh(); return read(source.id);
    }),
    typedRelationships: input => listTyped(structuredClone(input)),
    proposeProjectAssociation: input => {const captured=structuredClone(input);return typedSerial(()=>{typedFields(captured,['operationId','expectedRevision','expectedHash','collectionId','workspaceId','parentStudyId','rootBindingId','expectedProjectProofHash','actor','reason']);return mutateTyped('propose',{operationId:captured.operationId,expectedRevision:captured.expectedRevision,expectedHash:captured.expectedHash,from:{kind:'collection',id:captured.collectionId},to:{kind:'project',id:captured.workspaceId,parentStudyId:captured.parentStudyId,rootBindingId:captured.rootBindingId},recordKind:'organizational-association',relationshipType:'associated-with',expectedProjectProofHash:captured.expectedProjectProofHash,actor:captured.actor,reason:captured.reason});});},
    proposeTypedRelationship: input => {const captured=structuredClone(input);return typedSerial(()=>mutateTyped('propose',captured));},
    changeTypedRelationship: input => {const captured=structuredClone(input);return typedSerial(()=>mutateTyped('change',captured));},
    undoTypedRelationship: input => {const captured=structuredClone(input);return typedSerial(()=>mutateTyped('undo',captured));},
    // Exact current indexed Collection metadata; no source discovery, refresh or writes.
    collectionsSnapshot: () => serial(() => { const loaded=loadTyped(); return {revision:loaded.value.revision,indexHash:loaded.hash,collections:structuredClone(loaded.value.collections)}; }),
    collections: () => serial(() => { refresh(); return { revision: index.revision, collections: index.collections }; }),
    collectionRelationships: collectionId => serial(() => { refresh(); return {revision:index.revision,relationships:resolvedCollectionLinks(index.collectionRelationships,index.collections,collectionId)}; }),
    linkCollections: input => serial(() => {
      refresh(); if(input.expectedRevision!==index.revision)throw new StateError('Library changed. Refresh the relationships before saving.',409);
      const {source,destination}=collectionPair(index.collections,input.sourceId,input.destinationId);
      const existing=liveCollectionLink(index.collectionRelationships,source.id,destination.id);
      if(existing)return{revision:index.revision,relationship:structuredClone(existing)};
      const relationship={id:randomUUID(),sourceId:source.id,destinationId:destination.id,sourceLabel:source.name,destinationLabel:destination.name,relationshipType:'relates-to',status:'accepted',createdAt:now(),updatedAt:now()};
      persistCollectionRelationship(()=>index.collectionRelationships.push(relationship));return{revision:index.revision,relationship:structuredClone(relationship)};
    }),
    detachCollectionRelationship: input => serial(() => {
      refresh();if(input.expectedRevision!==index.revision)throw new StateError('Library changed. Refresh the relationships before saving.',409);
      const relationship=index.collectionRelationships.find(item=>item.id===input.id);if(!relationship)throw new StateError('Collection relationship was not found.',404);
      if(relationship.status!=='detached')persistCollectionRelationship(()=>{relationship.status='detached';relationship.updatedAt=now();});
      return{revision:index.revision,relationship:structuredClone(relationship)};
    }),
    saveCollection: input => serial(() => {
      refresh(); if (input.expectedRevision !== index.revision) throw new StateError('Library changed. Refresh the collection before saving.', 409);
      string(input.name, 'Collection name', 200); if (!input.name.trim() || !Array.isArray(input.sourceIds) || input.sourceIds.length > 1000 || new Set(input.sourceIds).size !== input.sourceIds.length) throw new StateError('Use a name and unique source IDs.');
      input.sourceIds.forEach(sourceById); let collection = input.id ? index.collections.find(c => c.id === input.id) : null; if (input.id && !collection) throw new StateError('Collection was not found.', 404);
      if (!collection) { collection = { id: randomUUID(), added_by: 'local-operator', added_at: now() }; index.collections.push(collection); }
      Object.assign(collection, { name: input.name.trim(), sourceIds: [...input.sourceIds], updated_at: now() }); persist(); return { revision: index.revision, collection };
    }),
    evidence: () => serial(() => { refresh(); return { revision: index.revision, cards: index.evidence.map(card => { const source = index.sources.find(s => s.id === card.sourceId); return { ...structuredClone(card), stale: source?.missing || source?.managedTerminalSnapshot || !source || card.sourceHash !== source.hash, sourceMissing: source?.missing || source?.managedTerminalSnapshot || !source, sourceCurrentHash: source?.hash || null, sourcePath: source?.rel_path || null }; }) }; }),
    saveEvidence: input => serial(() => {
      refresh(); const source = sourceById(input.sourceId), content = read(source.id); string(input.quote, 'Quote', 100000);
      if (!source.cardEligibility.eligible) throw new StateError(source.cardEligibility.reason);
      if (!input.quote.trim() || !content.text?.includes(input.quote)) throw new StateError('Quote must occur verbatim in the readable source.');
      const offset = input.locator?.start ?? content.text.indexOf(input.quote); if (!Number.isSafeInteger(offset) || offset < 0 || content.text.slice(offset, offset + input.quote.length) !== input.quote) throw new StateError('Quote location does not match the source.');
      const card = { id: randomUUID(), sourceId: source.id, quote: input.quote, kind: ['quote', 'highlight', 'paraphrase', 'reference'].includes(input.kind) ? input.kind : 'quote', locator: { ...input.locator, start: offset, end: offset + input.quote.length }, sourceHash: source.hash, sourceTitle: source.title || source.name, sourceUrl: source.source_url || '', sourcePathAtCapture: source.rel_path, createdAt: now(), provenance: structuredClone(source.provenance) };
      index.evidence.push(card); persist(); return { card, revision: index.revision };
    }),
  };
}
