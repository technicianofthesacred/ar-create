import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {StateError} from '../store.mjs';
import {atomicWrite,readJson,digest,ensurePrivateDirectory} from './files.mjs';
import {provenance} from './actor.mjs';
// A persisted intent assigns identity BEFORE creating a piece. A restart finds
// exactly that ID, never a title or whichever piece happens to be active.
export function createStudyBindings({dataDir,store,afterCreate=null}){
 const dir=ensurePrivateDirectory(dataDir,'study-project-bindings');let queue=Promise.resolve();
 return {async lookup({projectKey}={}){
  if(typeof projectKey!=='string'||!projectKey.trim()||projectKey.length>256||/[\x00-\x1f\x7f]/.test(projectKey))throw new StateError('Explicit study project identity required.',400);
  const binding=readJson(path.join(dir,digest(projectKey)+'.json'),null);
  if(!binding)throw new StateError('No saved Material connection for this project.',404);
  const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if(binding.schema!=='ar-create.study-binding.v1'||binding.status!=='ready'||binding.projectKey!==projectKey||!uuid.test(binding.projectId||'')||!uuid.test(binding.documentId||''))throw new StateError('Saved Material connection needs recovery; no replacement was created.',409);
  const {pieces}=await store.listPieces();
  if(pieces.filter(p=>p.id===binding.projectId&&p.documentId===binding.documentId).length!==1)throw new StateError('Saved Material project/document is unavailable; existing identity preserved.',409);
  return {projectKey,projectId:binding.projectId,documentId:binding.documentId};
 },select(input){const captured=structuredClone(input);const work=queue.then(async()=>{
  const {projectKey,title,operationId}=captured||{};
  if(typeof projectKey!=='string'||!projectKey.trim()||projectKey.length>256||/[\x00-\x1f\x7f]/.test(projectKey)||typeof title!=='string'||!title.trim()||title.length>256||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(operationId||''))throw new StateError('Choose a named study project and operation ID.',400);
  const file=path.join(dir,digest(projectKey)+'.json');let binding=readJson(file,null);
  if(binding&&binding.projectKey!==projectKey)throw new StateError('Study identity mismatch.',409);
  if(!binding){binding={schema:'ar-create.study-binding.v1',projectKey,projectId:randomUUID(),title,operationId,status:'pending',createdAt:new Date().toISOString(),provenance:provenance()};atomicWrite(file,JSON.stringify(binding,null,2)+'\n',{exclusive:true});}
  let state=await store.read({allowEditedMarkdown:true});const {pieces}=await store.listPieces();
  if(!pieces.some(p=>p.id===binding.projectId)){
   if(binding.status!=='pending')throw new StateError('The bound working piece is missing; its binding is preserved.',409);
   state=await store.createPiece({expectedProjectId:state.project.id,expectedRevision:state.revision,title:binding.title},{projectId:binding.projectId});
   if(afterCreate)await afterCreate(binding);
  }else if(state.project.id!==binding.projectId)state=await store.switchPiece({expectedProjectId:state.project.id,expectedRevision:state.revision,projectId:binding.projectId});
  if(binding.status==='pending'){binding={...binding,status:'ready',documentId:state.project.document.id};atomicWrite(file,JSON.stringify(binding,null,2)+'\n');}
  if(state.project.document.id!==binding.documentId)throw new StateError('Bound document identity changed.',409);
  return {projectId:binding.projectId,documentId:binding.documentId,bindingPath:file};
 });queue=work.catch(()=>{});return work;}};
}
