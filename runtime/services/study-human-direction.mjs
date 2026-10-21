import {conceptContextProjection,CONCEPT_CONTEXT_ROLE,conceptReferences} from './concept-markdown.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,readJson,digest,ensurePrivateDirectory,regular,resolveInside} from './files.mjs';
import {provenance,authorOf} from './actor.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ROLE='human-authored-editorial-direction-not-evidence-or-source-quotation';
const queues=new Map();
const fail=(message,status=409)=>{throw new StateError(message,status);};
const readable=v=>typeof v==='string'&&!!v.trim()&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const equivalent=(a,b)=>canonical(a)===canonical(b);
const HASH=/^[a-f0-9]{64}$/;
const empty=scope=>({schema:'ar-create.study-human-direction.v1',role:ROLE,bound:!!scope,scope:scope||null,body:'',hash:digest(''),revision:0,updatedAt:null,operationId:null,history:[],path:null});
function serial(key,fn){const work=(queues.get(key)||Promise.resolve()).then(fn);queues.set(key,work.catch(()=>{}));return work;}

/** Explicit human decisions only. Manuscripts and source files remain owned by their existing services. */
export function createStudyHumanDirection({dataDir,store,bindings,drafts,library,readOutputDocument}={}){
 const legacyAvailable=!!(store?.listPieces&&bindings?.select&&drafts?.read);
 if(!legacyAvailable&&typeof library?.collections!=='function'&&typeof library?.collectionsSnapshot!=='function')throw Error('Supply the existing piece store, study bindings and owned drafts, or existing Library for collection scope.');
 const collectionNames=new Map(),metadataSnapshots=new WeakMap();
 function selector(input,mutation=false){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['collectionId','parentStudyId','scope','bindingId','outputId','operationId','title','expectedRevision','expectedHash','expectedMetadataHash','body','undoOperationId'].includes(k)))fail('Use explicit direction identities; paths and caller snapshots are refused.',400);
  if(input.scope==='collection'){
   if(!UUID.test(input.collectionId||'')||['parentStudyId','bindingId','outputId','title'].some(key=>input[key]!==undefined))fail('Collection direction scope requires only its exact Library collection UUID.',400);
   if(mutation&&!UUID.test(input.operationId||''))fail('Direction operation UUID required.',400);
   return 'collection';
  }
  if(input.collectionId!==undefined)fail('Collection identity requires explicit collection scope.',400);
  if(!readable(input.parentStudyId)||!['project','part','output'].includes(input.scope||'project'))fail('Choose an explicit parent study and direction scope.',400);
  const kind=input.scope||'project';
  if(kind==='project'&&(input.bindingId!==undefined||input.outputId!==undefined)||kind==='part'&&input.outputId!==undefined||kind==='part'&&!UUID.test(input.bindingId||'')||kind==='output'&&input.bindingId!==undefined&&!UUID.test(input.bindingId)||kind==='output'&&!readable(input.outputId))fail('Direction scope requires its exact owned part/output identity.',400);
  if(mutation&&!UUID.test(input.operationId||''))fail('Direction operation UUID required.',400);
  return kind;
 }
 function registry(key){
  const root=path.join(dataDir,'study-project-bindings');
  if(!fs.existsSync(root))return null;
  const file=resolveInside(dataDir,'study-project-bindings/'+digest(key)+'.json',{missing:true});
  const b=readJson(file,null);
  if(!b)return null;
  if(b.schema!=='ar-create.study-binding.v1'||b.projectKey!==key||b.status!=='ready'||!UUID.test(b.projectId||'')||!UUID.test(b.documentId||''))fail('Direction requires an exact ready study binding.');
  return b;
 }
 async function pair(b){const {pieces}=await store.listPieces();if(pieces.filter(p=>p.id===b.projectId&&p.documentId===b.documentId).length!==1)fail('The exact owned direction project/document is missing.');}
 async function existingCollection(collectionId){
  if(typeof library?.collections!=='function'&&typeof library?.collectionsSnapshot!=='function')fail('Existing Library is unavailable for collection scope.',503);
  const catalog=await (library.collectionsSnapshot||library.collections).call(library),matches=catalog.collections?.filter(row=>row.id===collectionId);
  if(!matches||matches.length!==1||!Array.isArray(matches[0].sourceIds)||typeof matches[0].name!=='string')fail('Choose one existing Library collection.',404);
  return matches[0];
 }
 async function authority(input,{create=false}={}){
  const kind=selector(input,create);
  if(kind==='collection'){const collection=await existingCollection(input.collectionId);collectionNames.set(input.collectionId,collection.name);return {kind,collectionId:input.collectionId};}
  if(!legacyAvailable)fail('Existing project dependencies are unavailable for this direction scope.',503);
  let parent=registry(input.parentStudyId);
  if(!parent&&create&&readable(input.title)){await bindings.select({projectKey:input.parentStudyId,title:input.title,operationId:input.operationId});parent=registry(input.parentStudyId);}
  if(!parent){if(create)fail('Select the owned parent project before saving direction.',404);return null;}
  await pair(parent);let owned=parent;
  if(input.bindingId){
   const result=await drafts.read({parentStudyId:input.parentStudyId,bindingId:input.bindingId}),b=result?.binding;
   if(!b||b.id!==input.bindingId||b.parentStudyId!==input.parentStudyId||b.authority!=='owned-working-copy'||b.status!=='ready'||result.readiness?.ready!==true)fail('Part direction requires a ready owned draft of this exact parent.');
   const key='owned-draft:'+input.bindingId;owned=registry(key);
   if(!owned&&create){await bindings.select({projectKey:key,title:b.title,operationId:input.operationId});owned=registry(key);}
   if(!owned){if(create)fail('Ready owned part project is missing.',404);return null;}
   await pair(owned);
  }
  const scope={kind,parentStudyId:input.parentStudyId,parentProjectId:parent.projectId,parentDocumentId:parent.documentId,projectId:owned.projectId,documentId:owned.documentId,...(input.bindingId?{bindingId:input.bindingId}:{}),...(kind==='output'?{outputId:input.outputId}:{})};
  if(kind==='output'){
   // listPieces intentionally exposes only a count. No output identity can be inferred from it.
   // Resolve the exact persisted workspace, not whichever workspace another tab
   // last activated. The maintained scoped reader retains its normal file guards.
   const saved=typeof readOutputDocument==='function'?await readOutputDocument({projectId:scope.projectId}):null;
   const project=saved?{...saved.project,document:saved.document}:store.get?.()?.project;
   if(project?.id!==scope.projectId||project.document?.id!==scope.documentId||project.document.outputs?.filter(o=>o.id===scope.outputId).length!==1)fail('Output direction requires a provable owned document/output pair; open that owned output first.',404);
  }
  return scope;
 }
 // Location sidecars belong to this record owner, not a second collection registry.
 // Library is the only membership/name authority; persisted names never follow label changes.
 function collectionDirectory(scope,create){
  const rootRelative='workspaces/collections';
  if(create)ensurePrivateDirectory(dataDir,rootRelative);
  else{
   for(const relative of ['workspaces',rootRelative]){
    if(!fs.lstatSync(path.join(dataDir,relative),{throwIfNoEntry:false}))return null;
    resolveInside(dataDir,relative,{directory:true});
   }
  }
  const root=resolveInside(dataDir,rootRelative,{directory:true}),file=resolveInside(root,scope.collectionId+'.json',{missing:true});
  let mapping=readJson(file,null);
  if(!mapping){
   if(!create)return null;
   const label=(collectionNames.get(scope.collectionId)||'Collection').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,' ').replace(/^[ _-]+|[ _-]+$/g,'').replace(/\s+/g,' ').slice(0,64).trim()||'Collection';
   const folder=label+'--'+scope.collectionId;
   if(fs.lstatSync(path.join(root,folder),{throwIfNoEntry:false}))fail('Unclaimed collection location already exists; preserve it for owner review.');
   ensurePrivateDirectory(root,folder);
   mapping={schema:'ar-create.collection-inquiry-location.v1',collectionId:scope.collectionId,folder};
   atomicWrite(file,JSON.stringify(mapping,null,2)+'\n',{exclusive:true});
  }
  if(Object.keys(mapping).sort().join(',')!=='collectionId,folder,schema'||mapping.schema!=='ar-create.collection-inquiry-location.v1'||mapping.collectionId!==scope.collectionId||typeof mapping.folder!=='string'||!new RegExp('^[\\p{L}\\p{N}][\\p{L}\\p{N} _-]{0,63}--'+scope.collectionId+'$','u').test(mapping.folder))fail('Collection inquiry location mapping identity is invalid.');
  // A moved/missing owned directory is a hold, never authority to derive a new slug.
  return resolveInside(root,mapping.folder,{directory:true});
 }
 function locations(scope,create=false){
  if(scope.kind==='collection'){
   const dir=collectionDirectory(scope,create);if(!dir)return null;
   return {dir,body:path.join(dir,'HUMAN-DIRECTION.md'),meta:path.join(dir,'HUMAN-DIRECTION.json'),journal:path.join(dir,'human-direction-history')};
  }
  const relative='workspaces/'+scope.projectId+(scope.kind==='output'?'/human-direction-outputs/'+digest(scope.outputId):'');
  if(create)ensurePrivateDirectory(dataDir,relative);
  else if(!fs.existsSync(path.join(dataDir,relative)))return null;
  const dir=resolveInside(dataDir,relative,{directory:true});
  return {dir,body:path.join(dir,'HUMAN-DIRECTION.md'),meta:path.join(dir,'HUMAN-DIRECTION.json'),journal:path.join(dir,'human-direction-history')};
 }
 function ops(loc){
  if(!fs.existsSync(loc.journal))return [];
  resolveInside(loc.dir,'human-direction-history',{directory:true});
  return fs.readdirSync(loc.journal).filter(n=>UUID.test(n.slice(0,-5))&&n.endsWith('.json')).map(n=>({file:path.join(loc.journal,n),record:readJson(path.join(loc.journal,n),null)}));
 }
 function bytes(file){if(!fs.existsSync(file))return null;regular(file);return fs.readFileSync(file,'utf8');}
 function metadata(loc,scope){
  const raw=bytes(loc.meta),m=raw===null?null:JSON.parse(raw);
  if(m&&(m.schema!=='ar-create.study-human-direction.v1'||m.role!==ROLE||!same(m.scope,scope)||!Number.isSafeInteger(m.revision)||m.revision<0||!/^([a-f0-9]{64})$/.test(m.hash||'')))fail('Saved direction identity or revision changed; bytes preserved.');
  if(m)metadataSnapshots.set(m,digest(raw));
  return m;
 }
 function metaValue(snapshot){const {body,history,path:unusedPath,externalEdit,metadataHash,...meta}=snapshot;return meta;}
 const metaBytes=snapshot=>JSON.stringify(metaValue(snapshot),null,2)+'\n';
 function persistMeta(loc,snapshot,expectedHash=null){atomicWrite(loc.meta,metaBytes(snapshot),expectedHash===null?{exclusive:true}:{expectedHash});}
 function metaHash(loc){if(!fs.lstatSync(loc.meta,{throwIfNoEntry:false}))return null;regular(loc.meta);return digest(fs.readFileSync(loc.meta));}
 function recover(loc,scope){
  for(const {file,record:op} of ops(loc)){
   if(!op||op.schema!=='ar-create.study-human-direction-operation.v1'||!same(op.scope,scope)||!UUID.test(op.operationId||'')||path.basename(file)!==op.operationId+'.json'||!['pending','committed','rejected'].includes(op.status)||!['write','undo','reference-propose','reference-change','reference-undo'].includes(op.kind)||op.before?.hash!==digest(op.before?.body||'')||op.after?.hash!==digest(op.after?.body||''))fail('Direction recovery journal is corrupt; existing bytes preserved.');
   if(op.status!=='pending')continue;
   const body=bytes(loc.body)??'',m=metadata(loc,scope);
   if(Object.hasOwn(op,'afterMetadataHash')){
    if(!HASH.test(op.afterMetadataHash||'')||op.beforeMetadataHash!==null&&!HASH.test(op.beforeMetadataHash||'')||op.afterMetadataHash!==digest(metaBytes(op.after)))fail('Direction metadata recovery pins are corrupt.');
    const actual=metaHash(loc),beforeBody=digest(body)===op.before.hash,afterBody=digest(body)===op.after.hash;
    if(afterBody&&actual===op.afterMetadataHash)atomicWrite(file,JSON.stringify({...op,status:'committed',recoveredAt:new Date().toISOString()},null,2)+'\n');
    else if(beforeBody&&actual===op.beforeMetadataHash&&!(op.kind==='write'&&op.beforeMetadataHash===null&&fs.existsSync(loc.body)))atomicWrite(file,JSON.stringify({...op,status:'rejected',reason:'Interrupted before metadata/body commit; previous state preserved.'},null,2)+'\n');
    else if(afterBody&&actual===op.beforeMetadataHash&&(!beforeBody||op.kind==='write'&&op.beforeMetadataHash===null&&fs.existsSync(loc.body))){persistMeta(loc,op.after,actual);atomicWrite(file,JSON.stringify({...op,status:'committed',recoveredAt:new Date().toISOString()},null,2)+'\n');}
    else fail('Interrupted direction metadata conflicts with outside edits; all snapshots preserved.');
    continue;
   }
   if(digest(body)===op.after.hash&&(m?.revision===op.before.revision||!m&&op.before.revision===0||m?.revision===op.after.revision&&m.hash===op.after.hash)){
    if(m?.revision!==op.after.revision)persistMeta(loc,op.after,fs.existsSync(loc.meta)?digest(fs.readFileSync(loc.meta)):null);
    atomicWrite(file,JSON.stringify({...op,status:'committed',recoveredAt:new Date().toISOString()},null,2)+'\n');
   }else if(digest(body)===op.before.hash&&(m?.revision===op.before.revision||!m&&op.before.revision===0))atomicWrite(file,JSON.stringify({...op,status:'rejected',reason:'Interrupted before body commit; previous words preserved.'},null,2)+'\n');
   else fail('Interrupted direction save conflicts with newer outside edits; recovery snapshots preserved.');
  }
 }
 function current(scope){
  const loc=locations(scope);if(!loc)return {...empty(scope),metadataHash:null};
  recover(loc,scope);const m=metadata(loc,scope),raw=bytes(loc.body);
  if(!m&&raw!==null)fail('Direction bytes have no owned revision record; preserved for recovery.');
  if(m&&raw===null)fail('Saved human direction file is missing; recovery history preserved.');
  const history=ops(loc).map(({record:o})=>({operationId:o.operationId,...authorOf(o),kind:o.kind,status:o.status,createdAt:o.createdAt,before:{body:o.before.body,hash:o.before.hash,revision:o.before.revision,updatedAt:o.before.updatedAt,...(o.before.scopeReferences?{scopeReferences:structuredClone(o.before.scopeReferences)}:{})},after:{body:o.after.body,hash:o.after.hash,revision:o.after.revision,updatedAt:o.after.updatedAt,...(o.after.scopeReferences?{scopeReferences:structuredClone(o.after.scopeReferences)}:{})},...(o.undoOperationId?{undoOperationId:o.undoOperationId}:{}),...(o.reason?{reason:o.reason}:{})})).sort((a,b)=>a.after.revision-b.after.revision||a.createdAt.localeCompare(b.createdAt));
  if(!m)return {...empty(scope),history,path:loc.body,metadataHash:null};
  return {...m,body:raw,hash:digest(raw),externalEdit:digest(raw)!==m.hash,history,path:loc.body,metadataHash:metadataSnapshots.get(m)};
 }
 async function validateCollectionReferences(scope,before,body){
  if(scope.kind!=='collection')return;
  const refs=conceptReferences(body),previous=conceptReferences(before.body);
  if(refs.length>20)fail('Select at most 20 exact Library passages.',400);
  for(const ref of refs){
   // Preserve already saved, possibly stale quotations during unrelated manual edits.
   if(previous.some(old=>same(old,ref)))continue;
   const collection=await existingCollection(scope.collectionId);
   if(!collection.sourceIds.includes(ref.sourceId))fail('Source is not selected in this Library collection.');
   if(typeof library?.snapshot!=='function')fail('Existing Library source verification is unavailable.',503);
   const source=await library.snapshot(ref.sourceId,{includeBody:true});
   if(source.transcriptState?.managed&&!source.transcriptState.coherent)fail('Library source changed and needs reconciliation.');
   if(source.hash!==ref.sourceHash||typeof source.text!=='string'||!Number.isSafeInteger(ref.start)||ref.start<0||!ref.quote.trim()||source.text.slice(ref.start,ref.start+ref.quote.length)!==ref.quote)fail('Library source changed or exact passage quote/locator does not match.');
  }
 }
 async function read(input){const scope=await authority(structuredClone(input));return scope?current(scope):empty(null);}
 async function mutate(input,kind){
  selector(input,true);const scope=await authority(input,{create:true}),loc=locations(scope,true);ensurePrivateDirectory(loc.dir,'human-direction-history');
  return serial(loc.body,async()=>{
   const before=current(scope),beforeMetadataHash=before.metadataHash,file=path.join(loc.journal,input.operationId+'.json');
   const fingerprint=digest(JSON.stringify({scope,kind,body:kind==='write'?input.body:null,expectedRevision:input.expectedRevision,expectedHash:input.expectedHash,undoOperationId:input.undoOperationId||null}));
   const prior=readJson(file,null);
   if(prior){if(prior.fingerprint!==fingerprint)fail('Operation UUID already names a different direction decision.');if(prior.status==='committed')return {...prior.after,history:current(scope).history,path:loc.body};fail('This direction operation was rejected; recover its snapshots and use a new operation UUID.');}
   if(input.expectedRevision!==before.revision||input.expectedHash!==before.hash){
    if(kind==='write'&&typeof input.body==='string'&&Buffer.byteLength(input.body)<=1024*1024&&!input.body.includes('\0')){
     const rejected={...empty(scope),bound:true,body:input.body,hash:digest(input.body),revision:before.revision+1,updatedAt:new Date().toISOString(),operationId:input.operationId};
     atomicWrite(file,JSON.stringify({schema:'ar-create.study-human-direction-operation.v1',provenance:provenance(),operationId:input.operationId,scope,kind,fingerprint,status:'rejected',createdAt:rejected.updatedAt,before:{...before,history:undefined,path:undefined},after:rejected,reason:'Stale revision or body hash; submitted wording preserved without applying it.'},null,2)+'\n',{exclusive:true});
    }
    fail('Human direction changed. Refresh and preserve both versions before saving.');
   }
   if(input.expectedMetadataHash!==undefined&&input.expectedMetadataHash!==beforeMetadataHash)fail('Direction metadata changed; preserve outside fields.');
   let body=input.body,undoOperationId;
   if(kind==='undo'){
    const eligible=ops(loc).map(x=>x.record).filter(o=>o.status==='committed'&&o.after.revision===before.revision&&o.after.hash===before.hash);
    const target=input.undoOperationId?eligible.find(o=>o.operationId===input.undoOperationId):eligible[0];
    if(!target)fail('Only the current unchanged direction decision can be undone; older versions remain recoverable.');
    if(target.kind.startsWith('reference-'))fail('Use the explicit scope-reference Undo for metadata decisions.');
    if(target.afterMetadataHash&&target.afterMetadataHash!==beforeMetadataHash)fail('Direction metadata changed; exact Undo is unavailable.');
    body=target.before.body;undoOperationId=target.operationId;
   }
   if(typeof body!=='string'||Buffer.byteLength(body)>1024*1024||body.includes('\0'))fail('Human direction must be verbatim readable text under 1 MiB.',400);
   // Undo restores exact owner-journal bytes; it does not introduce a new source claim.
   if(kind==='write'&&scope.kind==='collection')await validateCollectionReferences(scope,before,body);
   const after={...before,...empty(scope),bound:true,body,hash:digest(body),revision:before.revision+1,updatedAt:new Date().toISOString(),operationId:input.operationId};delete after.history;delete after.path;delete after.externalEdit;delete after.metadataHash;
   const op={schema:'ar-create.study-human-direction-operation.v1',provenance:provenance(),operationId:input.operationId,scope,kind,fingerprint,status:'pending',beforeMetadataHash,afterMetadataHash:digest(metaBytes(after)),createdAt:after.updatedAt,before:{...before,history:undefined,path:undefined},after,...(undoOperationId?{undoOperationId}:{})};
   atomicWrite(file,JSON.stringify(op,null,2)+'\n',{exclusive:true});
   const expectedMetaHash=beforeMetadataHash;
   try{
    atomicWrite(loc.body,body,fs.existsSync(loc.body)?{expectedHash:before.hash}:{exclusive:true});
    persistMeta(loc,after,expectedMetaHash);
    atomicWrite(file,JSON.stringify({...op,status:'committed'},null,2)+'\n');
   }catch(error){
    if((bytes(loc.body)??'')===before.body)atomicWrite(file,JSON.stringify({...op,status:'rejected',reason:error.message},null,2)+'\n');
    throw error;
   }
   return current(scope);
  });
 }
 function explicitFields(value,required,optional=[]){if(!value||typeof value!=='object'||Array.isArray(value)||required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...required,...optional].includes(key)))fail('Use exact scope-reference fields; caller paths/snapshots are refused.',400);}
 function referenceSelector(input){explicitFields(input,['scope'],['parentStudyId','bindingId','outputId','collectionId']);selector(input);return structuredClone(input);}
 function referenceRows(record){const rows=record.scopeReferences||[];if(!Array.isArray(rows)||rows.length>128||rows.some(r=>r?.schema!=='ar-create.direction-scope-reference.v1'||!UUID.test(r.id||'')||!['linked-learning','inherit-direction','supersedes'].includes(r.kind)||!['proposed','accepted','detached'].includes(r.status))||new Set(rows.map(r=>r.id)).size!==rows.length)fail('Direction scope-reference metadata is corrupt.');return rows;}
 function selected(record,locator,{editorial=false}={}){
  if(!locator||typeof locator!=='object'||Array.isArray(locator))fail('Choose an explicit field or exact range.',400);
  const projection=conceptContextProjection(record.body);let value,normalized;
  if(locator.kind==='field'){
   explicitFields(locator,['kind','name'],['hash']);
   if(locator.name==='body')value=record.body;
   else if(locator.name==='adoptedDirection')value=projection?.body;
   else if(locator.name==='authorThoughts')value=projection?.personalThoughts?.body;
   else if(locator.name==='aiInterpretation')value=projection?.aiInterpretation?.body;
   else if(locator.name==='suggestions')value=projection?.suggestions?.body;
   else fail('Unknown maintained field.',400);
   if(typeof value!=='string'||!value.trim())fail('That exact maintained field is unavailable.');
   if(editorial&&!(locator.name==='adoptedDirection'||locator.name==='body'&&!projection))fail('Only explicit adopted direction can inherit or supersede; provisional fields stay unadopted.');
   normalized={kind:'field',name:locator.name,hash:digest(value)};
   if(locator.hash!==undefined&&locator.hash!==normalized.hash)fail('Direction field anchor changed.');
  }else{
   explicitFields(locator,['kind','start','end','hash']);
   if(locator.kind!=='range'||!Number.isSafeInteger(locator.start)||!Number.isSafeInteger(locator.end)||locator.start<0||locator.end<=locator.start||locator.end>record.body.length||!HASH.test(locator.hash||''))fail('Exact range/hash required.',400);
   value=record.body.slice(locator.start,locator.end);if(digest(value)!==locator.hash)fail('Direction range changed.');
   if(editorial&&projection){
    const heading="\n\n## Adopted human direction \u2014 explicit\n\n",start=record.body.indexOf(heading)+heading.length;
    if(!projection.body||!record.body.includes(heading)||locator.start<start||locator.end>start+projection.body.length||record.body.slice(start,start+projection.body.length)!==projection.body)fail('A provisional/manual range cannot silently become adopted direction.');
   }
   normalized=structuredClone(locator);
  }
  return normalized;
 }
 async function pinnedOrigin(input,editorial=false){
  explicitFields(input,['selector','revision','hash','locator']);const originSelector=referenceSelector(input.selector),scope=await authority(originSelector);
  if(!scope)fail('Origin direction scope is unavailable.',404);const record=current(scope);
  if(record.externalEdit||record.revision!==input.revision||record.hash!==input.hash)fail('Origin direction version changed; review the exact current record.');
  return {selector:originSelector,scope,revision:record.revision,hash:record.hash,locator:selected(record,input.locator,{editorial})};
 }
 const narrow=(origin,target)=>origin.kind==='project'&&['part','output'].includes(target.kind)&&origin.parentProjectId===target.parentProjectId&&origin.parentDocumentId===target.parentDocumentId||origin.kind==='part'&&target.kind==='output'&&origin.bindingId===target.bindingId&&origin.parentStudyId===target.parentStudyId;
 function association(origin,target,rows){
  if(narrow(origin.scope,target))return null;
  if(origin.scope.kind==='collection'&&['part','output'].includes(target.kind)){
   const link=rows.find(r=>r.kind==='linked-learning'&&r.status==='accepted'&&equivalent(r.origin.scope,origin.scope)&&r.origin.revision===origin.revision&&r.origin.hash===origin.hash&&equivalent(r.target.scope,target));
   if(link)return link.id;fail('Collection direction needs an exact accepted linked-learning association first.');
  }
  fail('No supported exact narrower direction association exists.');
 }
 async function reviewReference(ref,targetRecord,rows){
  const review={needed:false,originMissing:false,originChanged:false,targetChanged:ref.target?.hash!==targetRecord.hash,associationMissing:false};
  try{
   const originScope=await authority(referenceSelector(ref.origin.selector));if(!originScope)throw Error('Missing origin');const source=current(originScope);
   review.currentOrigin={scope:originScope,revision:source.revision,hash:source.hash,metadataHash:source.metadataHash??null};
   review.originChanged=!equivalent(originScope,ref.origin.scope)||source.externalEdit===true||source.revision!==ref.origin.revision||source.hash!==ref.origin.hash;
   if(!review.originChanged)selected(source,ref.origin.locator,{editorial:ref.kind!=='linked-learning'});
  }catch{review.originMissing=true;}
  if(ref.associationReferenceId){const link=rows.find(r=>r.id===ref.associationReferenceId);review.associationMissing=!link||link.kind!=='linked-learning'||link.status!=='accepted'||link.origin.hash!==ref.origin.hash||link.origin.revision!==ref.origin.revision;}
  if(ref.kind==='supersedes'){
   const inherited=rows.find(r=>r.id===ref.supersedesId);if(!inherited||inherited.kind!=='inherit-direction'||inherited.status!=='accepted'||!equivalent(inherited.origin,ref.origin))review.associationMissing=true;
   try{selected(targetRecord,ref.replacement,{editorial:true});}catch{review.targetChanged=true;}
  }
  review.needed=review.originMissing||review.originChanged||review.targetChanged||review.associationMissing;
  return review;
 }
 async function readScopeReferences(input){
  explicitFields(input,['target']);const targetSelector=referenceSelector(input.target),scope=await authority(targetSelector);if(!scope)fail('Target direction scope is unavailable.',404);const record=current(scope),rows=referenceRows(record),references=[];
  for(const ref of rows){const review=await reviewReference(ref,record,rows);references.push({...structuredClone(ref),review,applicability:ref.status==='detached'?'detached':ref.status==='proposed'?'unadopted-proposal':review.needed?'review-needed':ref.kind==='linked-learning'?'linked-learning':ref.kind==='inherit-direction'?'inherited-direction':'explicit-local-override',supersededHere:false});}
  for(const ref of references)if(ref.kind==='supersedes'&&ref.status==='accepted'&&!ref.review.needed){const inherited=references.find(r=>r.id===ref.supersedesId);if(inherited&&!inherited.review.needed)inherited.supersededHere=true;}
  const checked=current(scope);if(checked.revision!==record.revision||checked.hash!==record.hash||checked.metadataHash!==record.metadataHash)fail('Target direction changed during reference read.');
  return {schema:'ar-create.direction-scope-references.v1',target:{selector:targetSelector,scope,revision:record.revision,hash:record.hash,metadataHash:record.metadataHash??null},references,precedence:'explicit-references-only-no-inferred-order',permissionGranted:false,coverage:'only-recorded-explicit-scope-references'};
 }
 async function referenceMutation(candidate,action){
  const input=structuredClone(candidate),required=['target','operationId','expectedRevision','expectedHash','expectedMetadataHash','actor','reason'];
  explicitFields(input,[...required,...(action==='propose'?['kind','origin']:action==='change'?['id','status']:['undoOperationId'])],action==='propose'?['supersedesId','replacement']:[]);
  if(!UUID.test(input.operationId||'')||!['agent','human'].includes(input.actor)||!readable(input.reason))fail('Explicit actor, reason and operation UUID required.',400);
  if(action!=='propose'&&input.actor!=='human')fail('Only an explicit human decision changes direction adoption.');
  const targetSelector=referenceSelector(input.target),scope=await authority(targetSelector);if(!scope)fail('Existing target direction scope required.',404);const loc=locations(scope);if(!loc)fail('Save the target direction record before attaching references.');
  return serial(loc.body,async()=>{
   const before=current(scope),rows=structuredClone(referenceRows(before)),file=path.join(loc.journal,input.operationId+'.json'),kind='reference-'+action,fingerprint=digest(canonical({kind,input})),prior=readJson(file,null);
   if(prior){if(prior.fingerprint!==fingerprint)fail('Operation UUID names different reference bytes.');if(prior.status!=='committed')fail('Rejected reference operation remains in history.');return {operationId:input.operationId,reference:structuredClone(prior.referenceId?prior.after.scopeReferences?.find(r=>r.id===prior.referenceId):null),record:current(scope),replayed:true};}
   if(before.externalEdit||before.revision!==input.expectedRevision||before.hash!==input.expectedHash||before.metadataHash!==input.expectedMetadataHash)fail('Direction body/metadata changed; preserve current words and fields.');
   let referenceId;
   if(action==='propose'){
    if(!['linked-learning','inherit-direction','supersedes'].includes(input.kind))fail('Unknown explicit reference kind.',400);
    const origin=await pinnedOrigin(input.origin,input.kind!=='linked-learning');if(equivalent(origin.scope,scope))fail('A scope cannot inherit or override itself.');
    const ref={schema:'ar-create.direction-scope-reference.v1',id:input.operationId,kind:input.kind,status:'proposed',origin,target:{selector:targetSelector,scope,hash:before.hash,revisionAtPin:before.revision},reason:input.reason,proposedBy:input.actor,stateActor:input.actor,createdOperationId:input.operationId,lastOperationId:input.operationId};
    if(input.kind==='inherit-direction')ref.associationReferenceId=association(origin,scope,rows);
    if(input.kind==='supersedes'){
     const inherited=rows.find(r=>r.id===input.supersedesId);if(!inherited||inherited.kind!=='inherit-direction'||inherited.status!=='accepted'||!equivalent(inherited.origin,origin)||(await reviewReference(inherited,before,rows)).needed)fail('Supersedes must name the exact current accepted inherited origin/anchor.');
     ref.supersedesId=inherited.id;ref.replacement=selected(before,input.replacement,{editorial:true});ref.associationReferenceId=inherited.associationReferenceId;
    }else if(input.supersedesId!==undefined||input.replacement!==undefined)fail('Override fields require explicit supersedes kind.',400);
    rows.push(ref);referenceId=ref.id;
   }else if(action==='change'){
    if(!UUID.test(input.id||'')||!['proposed','accepted','detached'].includes(input.status))fail('Exact reference identity/status required.',400);const ref=rows.find(r=>r.id===input.id);if(!ref)fail('Reference does not belong to this target scope.',404);
    if(input.status==='accepted'&&(await reviewReference(ref,before,rows)).needed)fail('Reference origin/target/association changed; review required.');
    ref.status=input.status;ref.reason=input.reason;ref.stateActor='human';ref.lastOperationId=input.operationId;referenceId=ref.id;
   }else{
    const target=ops(loc).map(row=>row.record).find(op=>op.operationId===input.undoOperationId);if(!target||!target.kind.startsWith('reference-')||target.status!=='committed'||target.after.revision!==before.revision||target.afterMetadataHash!==before.metadataHash)fail('Only current unchanged reference metadata can be undone.');
    const restored=structuredClone(target.before.scopeReferences||[]);for(const ref of restored)if(ref.status==='accepted'&&(await reviewReference(ref,before,restored)).needed)fail('Restored adopted reference changed; retain history and review.');rows.splice(0,rows.length,...restored);referenceId=target.referenceId;
   }
   const after={...before,scopeReferences:rows,revision:before.revision+1,updatedAt:new Date().toISOString(),operationId:input.operationId};delete after.history;delete after.path;delete after.externalEdit;delete after.metadataHash;referenceRows(after);
   // Re-read both body and metadata after asynchronous origin resolution.
   if(digest(bytes(loc.body)||'')!==before.hash||metaHash(loc)!==before.metadataHash)fail('Target direction changed during reference preparation.');
   for(const ref of rows)if(ref.id===referenceId&&ref.status==='accepted'&&(await reviewReference(ref,before,rows)).needed)fail('Accepted origin changed before reference publication.');
   if(digest(bytes(loc.body)||'')!==before.hash||metaHash(loc)!==before.metadataHash)fail('Target direction changed before metadata commit.');
   ensurePrivateDirectory(loc.dir,'human-direction-history');const op={schema:'ar-create.study-human-direction-operation.v1',provenance:provenance(),operationId:input.operationId,scope,kind,fingerprint,status:'pending',referenceId,beforeMetadataHash:before.metadataHash,afterMetadataHash:digest(metaBytes(after)),createdAt:after.updatedAt,before:{...before,history:undefined,path:undefined},after,...(action==='undo'?{undoOperationId:input.undoOperationId}:{})};
   atomicWrite(file,JSON.stringify(op,null,2)+'\n',{exclusive:true});persistMeta(loc,after,before.metadataHash);atomicWrite(file,JSON.stringify({...op,status:'committed'},null,2)+'\n');
   return {operationId:input.operationId,reference:structuredClone(rows.find(r=>r.id===referenceId)||null),record:current(scope),replayed:false};
  });
 }
 async function context(projectId,{documentId,outputId}={}){
  if(!UUID.test(projectId||'')||documentId!==null&&documentId!==undefined&&!readable(documentId)||outputId!==undefined&&!readable(outputId))fail('Context requires an exact owned project/document identity.',400);
  const registryDir=path.join(dataDir,'study-project-bindings');let matched=null;
  if(fs.existsSync(registryDir))for(const name of fs.readdirSync(resolveInside(dataDir,'study-project-bindings',{directory:true}))){if(!/^[a-f0-9]{64}\.json$/.test(name))continue;const b=readJson(path.join(registryDir,name),null);if(b?.projectId===projectId){if(b.status!=='ready'||b.documentId!==documentId)fail('Direction context does not match its exact ready document binding.');if(matched)fail('Multiple ready bindings claim the same direction context.');if(name!==digest(b.projectKey)+'.json')fail('Direction context registry identity changed.');matched=registry(b.projectKey);}}
  if(!matched)return {schema:'ar-create.study-human-direction-context.v1',role:ROLE,projectId,documentId:documentId??null,outputId:outputId||null,records:[],hash:digest('[]')};
  await pair(matched);let parentStudyId=matched.projectKey,bindingId=null;
  if(parentStudyId.startsWith('owned-draft:')){
   bindingId=parentStudyId.slice('owned-draft:'.length);if(!UUID.test(bindingId))fail('Owned direction part identity is invalid.');
   const loc=locations({projectId}),meta=loc?readJson(loc.meta,null):null;
   let mapping=null;const mappingFile=path.join(dataDir,'study-owned-photo-bindings',bindingId+'.json');
   if(fs.existsSync(mappingFile))mapping=readJson(resolveInside(dataDir,'study-owned-photo-bindings/'+bindingId+'.json'),null);
   if(mapping&&(mapping.schema!=='ar-create.study-owned-photo-binding.v1'||mapping.status!=='ready'||mapping.bindingId!==bindingId||mapping.projectId!==projectId||mapping.documentId!==documentId||mapping.key!==matched.projectKey))fail('Owned part context mapping changed.');
   if(meta&&mapping&&meta.scope?.parentStudyId!==mapping.parentStudyId)fail('Owned part direction and photo mapping disagree about their parent study.');
   parentStudyId=meta?.scope?.parentStudyId||mapping?.parentStudyId;
   if(!readable(parentStudyId))fail('Owned part context has no explicit parent mapping; direction cannot be inferred.',404);
  }
  const candidates=[{parentStudyId},...(bindingId?[{parentStudyId,scope:'part',bindingId}]:[]),...(outputId?[{parentStudyId,scope:'output',...(bindingId?{bindingId}:{}),outputId}]:[])];
  const records=[];
  for(const input of candidates){const scope=await authority(input);if(!scope)fail('Ready direction parent or part binding is missing.');const item=current(scope);if(item.revision>0)records.push({role:ROLE,scope:item.scope,body:item.body,hash:item.hash,revision:item.revision,updatedAt:item.updatedAt,...(conceptContextProjection(item.body)||{})});}
  return {schema:'ar-create.study-human-direction-context.v1',role:records.some(item=>item.role===CONCEPT_CONTEXT_ROLE)?CONCEPT_CONTEXT_ROLE:ROLE,projectId,documentId:documentId??null,outputId:outputId||null,records,hash:digest(JSON.stringify(records))};
 }
 return {select:async input=>{const scope=await authority(structuredClone(input),{create:true});return current(scope);},read,write:input=>mutate(structuredClone(input),'write'),undo:input=>mutate(structuredClone(input),'undo'),context,readScopeReferences,proposeScopeReference:input=>referenceMutation(input,'propose'),changeScopeReference:input=>referenceMutation(input,'change'),undoScopeReference:input=>referenceMutation(input,'undo')};
}
