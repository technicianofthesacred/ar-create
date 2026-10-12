import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,readJson,digest,ensurePrivateDirectory} from './files.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(message,status=409)=>{throw new StateError(message,status);};
const readable=value=>typeof value==='string'&&!!value.trim()&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value);
const identity=b=>({originalId:b.originalId,originalHash:b.originalHash,parentStudyKey:b.parentStudyKey,partKey:b.partKey});
/** Photos belong to an explicit owned part, never an active piece or a title. */
export function createStudyOwnedPhotoBindings({dataDir,drafts,bindings,store,runtime}={}){
 if(!drafts?.read||!bindings?.select||!store?.listPieces)throw Error('Supply owned drafts, study bindings and the existing piece store.');
 const dir=ensurePrivateDirectory(dataDir,'study-owned-photo-bindings');let queue=Promise.resolve();
 const serial=fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
 const file=id=>path.join(dir,id+'.json');
 const read=filePath=>{try{return readJson(filePath,null);}catch(error){fail('Owned photo mapping cannot be read; existing data preserved.');}};
 function validate(mapping,id){
  if(!mapping||mapping.schema!=='ar-create.study-owned-photo-binding.v1'||mapping.bindingId!==id||mapping.ownedDraftId!==id||!uuid.test(id)||!uuid.test(mapping.projectId||'')||!uuid.test(mapping.documentId||'')||!readable(mapping.parentStudyId)||mapping.key!=='owned-draft:'+id||!['pending','ready'].includes(mapping.status)||!mapping.ownedIdentity)fail('Owned photo mapping identity is missing or corrupt.');
  return mapping;
 }
 async function owned(bindingId,parentStudyId,mapping){
  const draft=await drafts.read({bindingId,parentStudyId}),b=draft?.binding;
  if(!b||b.id!==bindingId||b.parentStudyId!==parentStudyId||b.authority!=='owned-working-copy'||b.status!=='ready'||draft.readiness?.ready!==true||!readable(b.title))fail('Photos require a ready owned working-copy draft.');
  if(mapping&&JSON.stringify(mapping.ownedIdentity)!==JSON.stringify(identity(b)))fail('Owned draft capture identity changed; photo mapping preserved.');
  return draft;
 }
 async function verify(mapping){
  const study=read(path.join(dataDir,'study-project-bindings',digest(mapping.key)+'.json'));
  if(!study||study.schema!=='ar-create.study-binding.v1'||study.status!=='ready'||study.projectKey!==mapping.key||study.projectId!==mapping.projectId||study.documentId!==mapping.documentId)fail('Owned photo mapping does not match its ready study binding.');
  const {pieces}=await store.listPieces();
  if(pieces.filter(p=>p.id===mapping.projectId&&p.documentId===mapping.documentId).length!==1)fail('The exact owned photo project and document are missing.');
 }
 const result=m=>({projectId:m.projectId,documentId:m.documentId,parentStudyId:m.parentStudyId,ownedDraftId:m.ownedDraftId,bindingId:m.bindingId,key:m.key,authority:'owned-working-copy'});
 return {
  select(input){const captured=structuredClone(input);return serial(async()=>{
   if(!captured||typeof captured!=='object'||Array.isArray(captured)||Object.keys(captured).some(k=>!['bindingId','parentStudyId','operationId'].includes(k))||!uuid.test(captured.bindingId||'')||!uuid.test(captured.operationId||'')||!readable(captured.parentStudyId))fail('Use explicit owned draft, parent study and operation identities.',400);
   const {bindingId,parentStudyId,operationId}=captured,location=file(bindingId);let mapping=read(location);
   if(mapping){validate(mapping,bindingId);if(mapping.parentStudyId!==parentStudyId)fail('Owned photo mapping belongs to a different parent study.');}
   const draft=await owned(bindingId,parentStudyId,mapping),key='owned-draft:'+bindingId;
   // Existing ready mappings are checked before selection can mutate the piece store.
   if(mapping?.status==='ready')await verify(mapping);
   const selected=await bindings.select({projectKey:key,title:draft.binding.title,operationId});
   if(mapping&&(mapping.projectId!==selected.projectId||mapping.documentId!==selected.documentId))fail('Owned photo project or document identity changed.');
   if(!mapping){mapping={schema:'ar-create.study-owned-photo-binding.v1',bindingId,ownedDraftId:bindingId,parentStudyId,key,projectId:selected.projectId,documentId:selected.documentId,ownedIdentity:identity(draft.binding),status:'ready',createdAt:new Date().toISOString()};atomicWrite(location,JSON.stringify(mapping,null,2)+'\n',{exclusive:true});}
   else if(mapping.status!=='ready'){mapping={...mapping,status:'ready'};atomicWrite(location,JSON.stringify(mapping,null,2)+'\n');}
   await verify(mapping);return result(mapping);
  });},
  resolve(projectId){return serial(async()=>{
   if(!uuid.test(projectId||''))fail('Owned photo project UUID required.',400);
   const matches=[];
   for(const name of fs.readdirSync(dir)){if(!/^[a-f0-9-]{36}\.json$/i.test(name))continue;const mapping=validate(read(path.join(dir,name)),name.slice(0,-5));if(mapping.projectId===projectId)matches.push(mapping);}
   if(matches.length!==1||matches[0].status!=='ready')fail('Ready owned draft photo mapping not found.',404);
   const mapping=matches[0];await owned(mapping.bindingId,mapping.parentStudyId,mapping);await verify(mapping);return result(mapping);
  });}
 };
}
