import {createHash} from 'node:crypto';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=v=>createHash('sha256').update(stable(v)).digest('hex'),same=(a,b)=>stable(a)===stable(b);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function selector(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!['workspace','piece'].includes(value.kind)||!UUID.test(value.id||'')||Object.keys(value).some(k=>!['kind','id',...value.kind==='piece'?['rootBindingId','parentStudyId']:[]].includes(k)))fail('Use exact existing work selector fields; caller paths and snapshots are refused.',400);
 if(value.kind==='piece'&&(!UUID.test(value.rootBindingId||'')||typeof value.parentStudyId!=='string'||!value.parentStudyId||value.parentStudyId.length>256||/[\u0000-\u001f\u007f]/.test(value.parentStudyId)))fail('Native Piece requires its exact existing root and parent.',400);
}
/** Resolves existing owners only. It never creates/selects a workspace or output. */
export function createLibraryWorkReferences({store,outputs,mediaUsage}={}){
 if(!store?.listPieces||!store?.readArticle||!outputs?.read)throw Error('Existing saved workspace and native independent-output owners are required.');
 async function workspace(id){
  const catalog=await store.listPieces({readOnly:true}),matches=catalog.pieces?.filter(p=>p.id===id);
  if(matches?.length!==1||!UUID.test(matches[0].documentId||''))fail('Exact existing technical workspace/document binding was not found.',404);
  const saved=await store.readArticle({projectId:id});
  if(saved.project?.id!==id||saved.document?.id!==matches[0].documentId||!saved.expected||saved.externalEdit)fail('Saved workspace authority changed or has unreviewed outside edits.');
  return {schema:'ar-create.library-work-target.v1',endpoint:{kind:'workspace',id},authority:{kind:'technical-workspace',projectId:id,documentId:saved.document.id},humanProjectMapping:'not-asserted',workHash:hash({projectId:id,documentId:saved.document.id,expected:saved.expected})};
 }
 async function piece(endpoint){
  const g={rootBindingId:endpoint.rootBindingId,parentStudyId:endpoint.parentStudyId},view=await outputs.read({...g,selectedOutputId:endpoint.id});
  if(!same(view?.scope,g)||view.documentId!==g.rootBindingId||view.output?.id!==endpoint.id||!view.photoScope?.projectId||!view.photoScope.documentId||!view.writingProof||!view.wordOwner||!view.outputBindings?.some(b=>b.outputId===endpoint.id&&same(b.wordOwner,view.wordOwner))||typeof view.freshness?.stale!=='boolean')fail('Exact native output/root/parent authority is unavailable.');
  const physical=await workspace(view.photoScope.projectId);if(physical.authority.documentId!==view.photoScope.documentId)fail('Native output belongs to a different saved workspace document.');
  // Carousel owner CAS includes whole-workspace hashes; keep those out of this independent edition.
  const ownProof=view.writingProof.kind==='carousel-words'?{kind:view.writingProof.kind,wordsHash:view.writingProof.wordsHash,expected:{outputHash:view.writingProof.expected?.outputHash,markdownHash:view.writingProof.expected?.markdownHash}}:view.writingProof;
  const placementEditionHash=hash({output:view.output,wordOwner:view.wordOwner,writingProof:view.writingProof});
  const edition={kind:view.output.kind,revision:view.output.outputRevision??0,hash:hash({output:view.output,wordOwner:view.wordOwner,writingProof:ownProof})};
  const authority={kind:'native-independent-output',projectId:view.photoScope.projectId,documentId:view.photoScope.documentId,rootBindingId:g.rootBindingId,parentStudyId:g.parentStudyId,outputId:endpoint.id};
  return {placementEditionHash,schema:'ar-create.library-work-target.v1',endpoint:structuredClone(endpoint),authority,humanProjectMapping:'not-asserted',edition,freshness:structuredClone(view.freshness),workHash:hash({endpoint,authority,edition,freshness:view.freshness})};
 }
 async function read(endpoint){selector(endpoint);if(endpoint.kind==='workspace')return workspace(endpoint.id);const {placementEditionHash,...target}=await piece(endpoint);return target;}
 async function measure({endpoint,sourceId,sourceHash}){
  selector(endpoint);if(endpoint.kind!=='piece')fail('Measured native placement usage requires an existing native Piece, not workspace selection.');
  if(!UUID.test(sourceId||'')||!HASH.test(sourceHash||''))fail('Exact Library source UUID/hash required for native usage.',400);
  if(!mediaUsage?.read)fail('The maintained saved-placement usage adapter is not connected.',503);
  const before=await piece(endpoint);if(before.freshness.stale)fail('Native output/source proof is stale; measured usage requires review.');
  const usage=await mediaUsage.read({rootBindingId:endpoint.rootBindingId,parentStudyId:endpoint.parentStudyId,sourceIds:[sourceId],selectedOutputId:endpoint.id});
  if(usage.scope?.rootBindingId!==endpoint.rootBindingId||usage.scope.parentStudyId!==endpoint.parentStudyId||usage.scope.projectId!==before.authority.projectId||usage.scope.documentId!==before.authority.documentId)fail('Saved placement proof belongs to another work scope.');
  const source=usage.sources?.find(s=>s.sourceId===sourceId);if(source?.status!=='available'||source.hash!==sourceHash)fail('Exact current source bytes are unavailable for measured usage.');
  const rows=source.occurrences.filter(o=>o.outputId===endpoint.id&&o.edition?.hash===before.placementEditionHash&&!o.freshness?.stale);
  if(!rows.length)fail('No actual saved native placement of this source is recorded in that edition.');
  const occurrences=rows.map(o=>({id:o.id,location:structuredClone(o.location),order:o.order})),after=await read(endpoint);if(after.workHash!==before.workHash)fail('Native edition changed while measuring saved placement use.');
  return {status:'measured-native-placement',sourceId,sourceHash,outputId:endpoint.id,editionHash:before.edition.hash,occurrences,hash:hash({sourceId,sourceHash,outputId:endpoint.id,editionHash:before.edition.hash,occurrences})};
 }
 return {read,measure};
}
