import {conceptContextProjection,CONCEPT_CONTEXT_ROLE} from './concept-markdown.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,readJson,digest,ensurePrivateDirectory,regular,resolveInside} from './files.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ROLE='human-authored-editorial-direction-not-evidence-or-source-quotation';
const queues=new Map();
const fail=(message,status=409)=>{throw new StateError(message,status);};
const readable=v=>typeof v==='string'&&!!v.trim()&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const empty=scope=>({schema:'ar-create.study-human-direction.v1',role:ROLE,bound:!!scope,scope:scope||null,body:'',hash:digest(''),revision:0,updatedAt:null,operationId:null,history:[],path:null});
function serial(key,fn){const work=(queues.get(key)||Promise.resolve()).then(fn);queues.set(key,work.catch(()=>{}));return work;}

/** Explicit human decisions only. Manuscripts and source files remain owned by their existing services. */
export function createStudyHumanDirection({dataDir,store,bindings,drafts}={}){
 if(!store?.listPieces||!bindings?.select||!drafts?.read)throw Error('Supply the existing piece store, study bindings and owned drafts.');
 function selector(input,mutation=false){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['parentStudyId','scope','bindingId','outputId','operationId','title','expectedRevision','expectedHash','body','undoOperationId'].includes(k)))fail('Use explicit direction identities; paths and caller snapshots are refused.',400);
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
 async function authority(input,{create=false}={}){
  const kind=selector(input,create);let parent=registry(input.parentStudyId);
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
   const state=store.get?.();
   if(state?.project?.id!==scope.projectId||state.project.document?.id!==scope.documentId||state.project.document.outputs?.filter(o=>o.id===scope.outputId).length!==1)fail('Output direction requires a provable owned document/output pair; open that owned output first.',404);
  }
  return scope;
 }
 function locations(scope,create=false){
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
  const m=readJson(loc.meta,null);
  if(m&&(m.schema!=='ar-create.study-human-direction.v1'||m.role!==ROLE||!same(m.scope,scope)||!Number.isSafeInteger(m.revision)||m.revision<0||!/^([a-f0-9]{64})$/.test(m.hash||'')))fail('Saved direction identity or revision changed; bytes preserved.');
  return m;
 }
 function persistMeta(loc,snapshot,expectedHash=null){const {body,history,path:unusedPath,externalEdit,...meta}=snapshot;atomicWrite(loc.meta,JSON.stringify(meta,null,2)+'\n',{expectedHash});}
 function recover(loc,scope){
  for(const {file,record:op} of ops(loc)){
   if(!op||op.schema!=='ar-create.study-human-direction-operation.v1'||!same(op.scope,scope)||!UUID.test(op.operationId||'')||path.basename(file)!==op.operationId+'.json'||!['pending','committed','rejected'].includes(op.status)||!['write','undo'].includes(op.kind)||op.before?.hash!==digest(op.before?.body||'')||op.after?.hash!==digest(op.after?.body||''))fail('Direction recovery journal is corrupt; existing bytes preserved.');
   if(op.status!=='pending')continue;
   const body=bytes(loc.body)??'',m=metadata(loc,scope);
   if(digest(body)===op.after.hash&&(m?.revision===op.before.revision||!m&&op.before.revision===0||m?.revision===op.after.revision&&m.hash===op.after.hash)){
    if(m?.revision!==op.after.revision)persistMeta(loc,op.after,fs.existsSync(loc.meta)?digest(fs.readFileSync(loc.meta)):null);
    atomicWrite(file,JSON.stringify({...op,status:'committed',recoveredAt:new Date().toISOString()},null,2)+'\n');
   }else if(digest(body)===op.before.hash&&(m?.revision===op.before.revision||!m&&op.before.revision===0))atomicWrite(file,JSON.stringify({...op,status:'rejected',reason:'Interrupted before body commit; previous words preserved.'},null,2)+'\n');
   else fail('Interrupted direction save conflicts with newer outside edits; recovery snapshots preserved.');
  }
 }
 function current(scope){
  const loc=locations(scope);if(!loc)return empty(scope);
  recover(loc,scope);const m=metadata(loc,scope),raw=bytes(loc.body);
  if(!m&&raw!==null)fail('Direction bytes have no owned revision record; preserved for recovery.');
  if(m&&raw===null)fail('Saved human direction file is missing; recovery history preserved.');
  const history=ops(loc).map(({record:o})=>({operationId:o.operationId,kind:o.kind,status:o.status,createdAt:o.createdAt,before:{body:o.before.body,hash:o.before.hash,revision:o.before.revision,updatedAt:o.before.updatedAt},after:{body:o.after.body,hash:o.after.hash,revision:o.after.revision,updatedAt:o.after.updatedAt},...(o.undoOperationId?{undoOperationId:o.undoOperationId}:{}),...(o.reason?{reason:o.reason}:{})})).sort((a,b)=>a.after.revision-b.after.revision||a.createdAt.localeCompare(b.createdAt));
  if(!m)return {...empty(scope),history,path:loc.body};
  return {...m,body:raw,hash:digest(raw),externalEdit:digest(raw)!==m.hash,history,path:loc.body};
 }
 async function read(input){const scope=await authority(structuredClone(input));return scope?current(scope):empty(null);}
 async function mutate(input,kind){
  selector(input,true);const scope=await authority(input,{create:true}),loc=locations(scope,true);ensurePrivateDirectory(loc.dir,'human-direction-history');
  return serial(loc.body,async()=>{
   const before=current(scope),file=path.join(loc.journal,input.operationId+'.json');
   const fingerprint=digest(JSON.stringify({scope,kind,body:kind==='write'?input.body:null,expectedRevision:input.expectedRevision,expectedHash:input.expectedHash,undoOperationId:input.undoOperationId||null}));
   const prior=readJson(file,null);
   if(prior){if(prior.fingerprint!==fingerprint)fail('Operation UUID already names a different direction decision.');if(prior.status==='committed')return {...prior.after,history:current(scope).history,path:loc.body};fail('This direction operation was rejected; recover its snapshots and use a new operation UUID.');}
   if(input.expectedRevision!==before.revision||input.expectedHash!==before.hash){
    if(kind==='write'&&typeof input.body==='string'&&Buffer.byteLength(input.body)<=1024*1024&&!input.body.includes('\0')){
     const rejected={...empty(scope),bound:true,body:input.body,hash:digest(input.body),revision:before.revision+1,updatedAt:new Date().toISOString(),operationId:input.operationId};
     atomicWrite(file,JSON.stringify({schema:'ar-create.study-human-direction-operation.v1',operationId:input.operationId,scope,kind,fingerprint,status:'rejected',createdAt:rejected.updatedAt,before:{...before,history:undefined,path:undefined},after:rejected,reason:'Stale revision or body hash; submitted wording preserved without applying it.'},null,2)+'\n',{exclusive:true});
    }
    fail('Human direction changed. Refresh and preserve both versions before saving.');
   }
   let body=input.body,undoOperationId;
   if(kind==='undo'){
    const eligible=ops(loc).map(x=>x.record).filter(o=>o.status==='committed'&&o.after.revision===before.revision&&o.after.hash===before.hash);
    const target=input.undoOperationId?eligible.find(o=>o.operationId===input.undoOperationId):eligible[0];
    if(!target)fail('Only the current unchanged direction decision can be undone; older versions remain recoverable.');
    body=target.before.body;undoOperationId=target.operationId;
   }
   if(typeof body!=='string'||Buffer.byteLength(body)>1024*1024||body.includes('\0'))fail('Human direction must be verbatim readable text under 1 MiB.',400);
   const after={...empty(scope),bound:true,body,hash:digest(body),revision:before.revision+1,updatedAt:new Date().toISOString(),operationId:input.operationId};delete after.history;delete after.path;
   const op={schema:'ar-create.study-human-direction-operation.v1',operationId:input.operationId,scope,kind,fingerprint,status:'pending',createdAt:after.updatedAt,before:{...before,history:undefined,path:undefined},after,...(undoOperationId?{undoOperationId}:{})};
   atomicWrite(file,JSON.stringify(op,null,2)+'\n',{exclusive:true});
   const metaHash=fs.existsSync(loc.meta)?digest(fs.readFileSync(loc.meta)):null;
   try{
    atomicWrite(loc.body,body,fs.existsSync(loc.body)?{expectedHash:before.hash}:{exclusive:true});
    persistMeta(loc,after,metaHash);
    atomicWrite(file,JSON.stringify({...op,status:'committed'},null,2)+'\n');
   }catch(error){
    if((bytes(loc.body)??'')===before.body)atomicWrite(file,JSON.stringify({...op,status:'rejected',reason:error.message},null,2)+'\n');
    throw error;
   }
   return current(scope);
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
 return {select:async input=>{const scope=await authority(structuredClone(input),{create:true});return current(scope);},read,write:input=>mutate(structuredClone(input),'write'),undo:input=>mutate(structuredClone(input),'undo'),context};
}
