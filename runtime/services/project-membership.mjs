import {createHash} from 'node:crypto';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=v=>createHash('sha256').update(stable(v)).digest('hex'),same=(a,b)=>stable(a)===stable(b),clone=v=>structuredClone(v);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status,outcome:'not-applied'});};
const readable=v=>typeof v==='string'&&v.trim()&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
const knownIssue=e=>[400,403,404,409,503].includes(e.status);

/** Explicit declared view of existing owners. It stores no Project or membership records. */
export function createProjectMembership({store,bindings,drafts,ownedPhotos,outputs,library,workReferences}={}){
 if(!store?.listPieces||!store?.readArticle||!bindings?.lookup||!drafts?.read||!ownedPhotos?.resolve||!outputs?.read||!library?.typedRelationships||!workReferences?.read)throw Error('Supply actual maintained workspace/binding/draft/photo/native/Library work-reference owners.');
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['workspaceId','parentStudyId','rootBindingId','expectedProjectHash'].includes(k)))fail('Use exact declaration fields; caller snapshots and paths are refused.',400);
  if(!UUID.test(input.workspaceId||'')||!UUID.test(input.rootBindingId||'')||!readable(input.parentStudyId)||input.expectedProjectHash!==undefined&&!HASH.test(input.expectedProjectHash))fail('Declare one exact named workspace UUID and its native parent/root identities.',400);
 }
 async function workspace(id){
  const catalog=await store.listPieces({readOnly:true}),matches=catalog.pieces?.filter(p=>p.id===id);if(matches?.length!==1||!UUID.test(matches[0].documentId||''))fail('Exact saved workspace/document was not found.',404);
  const saved=await store.readArticle({projectId:id});if(saved.project?.id!==id||saved.document?.id!==matches[0].documentId||!saved.expected||saved.externalEdit||!readable(saved.project.title))fail('Project requires its exact existing named saved workspace.');
  return {id,documentId:saved.document.id,name:saved.project.title,proofHash:hash(saved.expected)};
 }
 const rootIdentity=s=>{const b=s?.binding;if(!b||b.authority!=='owned-working-copy'||b.status!=='ready'||b.kind==='output-fork'||s.readiness?.ready!==true)fail('Project requires an existing ready native root, not an output fork.');return {id:b.id,parentStudyId:b.parentStudyId,parentStudyKey:b.parentStudyKey,originalId:b.originalId,originalHash:b.originalHash,partKey:b.partKey,kind:b.kind??null};};
 function groupView(value,g){
  if(!same(value?.scope,g)||value.documentId!==g.rootBindingId||!UUID.test(value.photoScope?.projectId||'')||!UUID.test(value.photoScope?.documentId||'')||!Array.isArray(value.outputs)||value.outputs.length>100||!Array.isArray(value.outputBindings)||new Set(value.outputs.map(o=>o.id)).size!==value.outputs.length||value.outputs.some(o=>!UUID.test(o.id)||value.outputBindings.filter(b=>b.outputId===o.id).length!==1)||!HASH.test(value.expectedOutput?.hash||'')||!Number.isSafeInteger(value.expectedOutput.revision))fail('Maintained native output group has another or ambiguous root scope.');return value;
 }
 async function ownership(input){
  const g={rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId},parent=await bindings.lookup({projectKey:input.parentStudyId}),root=rootIdentity(await drafts.read({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId}));
  if(parent.projectKey!==input.parentStudyId||root.id!==input.rootBindingId||root.parentStudyId!==input.parentStudyId||root.parentStudyKey!==input.parentStudyId)fail('Named Project parent/root ownership changed.');
  const group=groupView(await outputs.read(g),g),physical=await ownedPhotos.resolve(group.photoScope.projectId);
  if(physical.bindingId!==g.rootBindingId||physical.parentStudyId!==g.parentStudyId||physical.projectId!==group.photoScope.projectId||physical.documentId!==group.photoScope.documentId)fail('Native root physical workspace ownership changed.');
  const declared=await workspace(input.workspaceId);let mappingRole;
  if(input.workspaceId===parent.projectId&&declared.documentId===parent.documentId)mappingRole='parent-study-workspace';
  else if(input.workspaceId===physical.projectId&&declared.documentId===physical.documentId)mappingRole='root-owned-workspace';
  else fail('Declared named Project workspace is not bound to this native parent/root.');
  return {g,parent,root,group,declared,mappingRole};
 }
 // Narrow target proof for Library mutations: no Library read or membership projection reentry.
 async function readAuthority(endpoint){
  if(!endpoint||typeof endpoint!=='object'||Array.isArray(endpoint)||endpoint.kind!=='project'||Object.keys(endpoint).some(k=>!['kind','id','parentStudyId','rootBindingId'].includes(k)))fail('Use exact named Project authority fields; snapshots and paths are refused.',400);
  const input={workspaceId:endpoint.id,parentStudyId:endpoint.parentStudyId,rootBindingId:endpoint.rootBindingId};validate(input);const owned=await ownership(input);
  const identity={workspaceId:owned.declared.id,documentId:owned.declared.documentId,mappingRole:owned.mappingRole,parentStudyId:input.parentStudyId,rootBindingId:input.rootBindingId,parentWorkspaceId:owned.parent.projectId,parentDocumentId:owned.parent.documentId,root:owned.root,rootWorkspace:clone(owned.group.photoScope)};
  return {schema:'ar-create.named-project-authority.v1',endpoint:clone(endpoint),humanProjectMapping:'existing-named-saved-workspace',project:{id:owned.declared.id,technicalWorkspaceId:owned.declared.id,documentId:owned.declared.documentId,name:owned.declared.name,mappingRole:owned.mappingRole},identity,proofHash:hash(identity)};
 }
 async function collectionSnapshot(){
  if(typeof library.collectionsSnapshot!=='function')fail('Library collectionsSnapshot read-only capability is required; refresh fallback is not allowed.',503);
  const snapshot=await library.collectionsSnapshot();
  if(!Number.isSafeInteger(snapshot?.revision)||!HASH.test(snapshot.indexHash||'')||!Array.isArray(snapshot.collections)||snapshot.collections.some(c=>!UUID.test(c.id||'')||!readable(c.name)||!Array.isArray(c.sourceIds))||new Set(snapshot.collections.map(c=>c.id)).size!==snapshot.collections.length)fail('Read-only Library collection snapshot is unavailable or ambiguous.');return snapshot;
 }
 async function member(group,output){
  const owner=group.outputBindings.find(b=>b.outputId===output.id).wordOwner,g=group.scope,endpoint={kind:'piece',id:output.id,...g};
  if(!owner||!['native','carousel-words'].includes(owner.kind))fail('Native Piece has no exact maintained wording owner.');
  if(owner.kind==='native'){
   const draft=await drafts.read({bindingId:owner.bindingId,parentStudyId:g.parentStudyId});
   if(owner.parentStudyId!==g.parentStudyId||draft.binding?.id!==owner.bindingId||draft.binding.parentStudyId!==g.parentStudyId||draft.binding.canonicalOutputId!==output.id||draft.binding.authority!=='owned-working-copy'||draft.binding.status!=='ready')fail('Native Piece wording binding belongs to another output or parent.');
  }else if(owner.projectId!==group.photoScope.projectId||owner.documentId!==group.photoScope.documentId||owner.outputId!==output.id)fail('Carousel words belong to another exact native output group.');
  let physicalWorkspace=null;
  if(owner.kind==='native')try{const bound=await bindings.lookup({projectKey:'owned-draft:'+owner.bindingId});physicalWorkspace={id:bound.projectId,documentId:bound.documentId};}catch(error){if(error.status!==404)throw error;}
  else physicalWorkspace={id:owner.projectId,documentId:owner.documentId};
  let proof,issue=null;try{proof=await workReferences.read(endpoint);if(!same(proof.endpoint,endpoint)||proof.authority?.outputId!==output.id||proof.authority.rootBindingId!==g.rootBindingId||proof.authority.parentStudyId!==g.parentStudyId)fail('Native Piece proof belongs to a different parent/root.');}catch(error){if(!knownIssue(error))throw error;proof=null;issue='Current edition proof is unavailable; native root membership is retained.';}
  return {id:output.id,name:output.name||output.title||output.kind,kind:output.kind,rootBindingId:g.rootBindingId,parentStudyId:g.parentStudyId,membershipBasis:'maintained-native-root-output-binding',wordOwner:clone(owner),physicalWorkspace,...proof?{edition:clone(proof.edition),workHash:proof.workHash}: {},review:{needed:!!issue||!!proof?.freshness?.stale,reason:issue||proof?.freshness?.reason||null},directionInheritance:'not-implied'};
 }
 async function read(input){
  validate(input);const snapshot=await collectionSnapshot(),owned=await ownership(input),references=await library.typedRelationships({includeDetached:true});
  if(references.revision!==snapshot.revision||references.indexHash!==snapshot.indexHash||!Array.isArray(references.relationships))fail('Library relationships changed during Project read; refresh.');
  const pieces=[];for(const output of owned.group.outputs)pieces.push(await member(owned.group,output));const memberIds=new Set(pieces.map(p=>p.id));
  const targetsProject=edge=>edge.recordKind==='organizational-association'&&edge.to?.kind==='project'&&edge.to.id===input.workspaceId&&edge.to.rootBindingId===input.rootBindingId&&edge.to.parentStudyId===input.parentStudyId||edge.to?.kind==='workspace'&&edge.to.id===input.workspaceId||edge.to?.kind==='piece'&&memberIds.has(edge.to.id)&&edge.to.rootBindingId===input.rootBindingId&&edge.to.parentStudyId===input.parentStudyId;
  const accepted=references.relationships.filter(r=>r.from?.kind==='collection'&&r.status==='accepted'&&targetsProject(r));
  const collections=snapshot.collections.filter(c=>accepted.some(r=>r.from.id===c.id)).map(c=>{const rows=accepted.filter(r=>r.from.id===c.id);return {id:c.id,name:c.name,sourceCount:c.sourceIds.length,organizationalNavigation:true,associationBasis:'explicit-accepted-existing-work-reference',reviewNeeded:rows.some(r=>r.review?.needed),references:clone(rows),directionInheritance:'not-implied'};});
  const finalSnapshot=await collectionSnapshot(),finalReferences=await library.typedRelationships({includeDetached:true});
  if(finalSnapshot.indexHash!==snapshot.indexHash||finalReferences.indexHash!==snapshot.indexHash||!same(finalReferences.relationships,references.relationships))fail('Library source/work review changed during Project read; refresh.');
  const finalOwned=await ownership(input);if(!same(finalOwned.root,owned.root)||!same(finalOwned.parent,owned.parent)||!same(finalOwned.declared,owned.declared)||!same(finalOwned.group.expectedOutput,owned.group.expectedOutput)||finalOwned.mappingRole!==owned.mappingRole)fail('Project/native root changed during read; refresh.');
  for(const [index,output]of finalOwned.group.outputs.entries())if(!same(await member(finalOwned.group,output),pieces[index]))fail('Native Piece edition changed during Project read; refresh.');
  const result={schema:'ar-create.named-project-membership.v1',humanProjectMapping:'existing-named-saved-workspace',project:{id:input.workspaceId,technicalWorkspaceId:input.workspaceId,documentId:owned.declared.documentId,name:owned.declared.name,mappingRole:owned.mappingRole,parentStudyId:input.parentStudyId,rootBindingId:input.rootBindingId},pieces,collections,standaloneCollections:snapshot.collections.filter(c=>!collections.some(p=>p.id===c.id)).map(c=>({id:c.id,name:c.name,sourceCount:c.sourceIds.length})),libraryExpected:{revision:snapshot.revision,hash:snapshot.indexHash},coverage:{kind:'known-native-root-and-explicit-accepted-library-references',unknownDependencies:['Unrecorded organizational connections are unknown.','This declaration covers one named saved workspace and one exact native root group.']},limits:{multiWorkspaceProjects:'unsupported',sourceFreeAttachment:'explicit-organizational-association-supported'},directionInheritance:'not-implied'};
  const projectionHash=hash(result);if(input.expectedProjectHash&&input.expectedProjectHash!==projectionHash)fail('Project membership/review changed; refresh the current projection.');return {...result,projectionHash};
 }
 return {read,readAuthority};
}
