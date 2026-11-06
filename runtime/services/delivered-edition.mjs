import fs from 'node:fs';
import path from 'node:path';
import {digest,regular,resolveInside} from './files.mjs';
const hash=v=>digest(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),HASH=/^[a-f0-9]{64}$/;
const fail=message=>{throw Object.assign(Error(message),{status:409,outcome:'not-applied'});};
/** Immutable exports are references, never a replacement manuscript or a publication claim. */
export function createDeliveredEditions({exportOwners=()=>({})}={}){
 function scope(input){return input.ownerKind==='magazine'?{storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedWorkingHash}:{rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId};}
 function descriptor(artifact,kind){
  const files=kind==='carousel'?artifact.files.map(({name,mimeType,hash,sizeBytes})=>({name,mimeType,hash,sizeBytes})):[{name:artifact.name,mimeType:artifact.mimeType,hash:artifact.hash,sizeBytes:artifact.sizeBytes}];
  const binding={schema:'ar-create.delivered-edition.v1',exportId:artifact.id,kind,outputId:artifact.outputId,projectId:artifact.projectId,documentId:artifact.documentId,createdAt:artifact.createdAt,manuscriptRevision:artifact.manuscriptRevision,outputRevision:artifact.outputRevision,sourceBinding:artifact.sourceBinding||null,publicationBinding:artifact.publicationBinding||null,renderBinding:artifact.renderBinding||null,contentVerification:artifact.contentVerification||'not-declared',files,...(kind==='carousel'?{output:artifact.output,media:artifact.media||null}:{})};
  return {...binding,edition:hash(binding),publicationVerified:false,sent:false};
 }
 async function list(input){
  const owners=exportOwners(),owner=input.ownerKind==='magazine'?owners.magazine:owners.native;if(!owner?.list)return {available:false,reason:'Retained export ownership is not connected.',editions:[]};
  let catalog;try{catalog=await owner.list(scope(input));}catch(error){return {available:false,reason:error.message,editions:[]};}const editions=[];
  for(const artifact of catalog.artifacts||[]){if(input.ownerKind==='magazine'&&artifact.exportKind!=='magazine-working-html')continue;editions.push(descriptor(artifact,input.ownerKind==='magazine'?'magazine':'article'));}
  for(const artifact of catalog.exports||[]){if(artifact.status!=='complete'||!Array.isArray(artifact.files))continue;editions.push(descriptor(artifact,'carousel'));}
  return {available:true,editions};
 }
 async function inspect(input,identity,exportId){
  const catalog=await list(input);if(!catalog.available)fail(catalog.reason||'Retained export ownership is unavailable.');const matches=catalog.editions.filter(e=>e.exportId===exportId);if(matches.length!==1)fail('Choose one retained export from this exact output.');const selected=matches[0];
  if(input.ownerKind==='magazine'){
   if(selected.sourceBinding?.owner?.kind!=='magazine'||selected.sourceBinding.owner.storyId!==input.storyId||selected.sourceBinding.owner.pieceId!==input.pieceId||selected.sourceBinding.owner.rootFingerprint!==identity.rootFingerprint||selected.outputId!==digest(input.pieceId)||selected.projectId!=='magazine:'+digest(identity.rootFingerprint+':'+input.storyId)||selected.documentId!==hash(selected.sourceBinding.owner))fail('Retained export belongs to another Magazine piece.');
  }else if(selected.outputId!==identity.outputId||selected.projectId!==identity.projectId||selected.documentId!==identity.documentId)fail('Retained export belongs to another output owner.');
  if(!selected.files.length||selected.files.length>102||new Set(selected.files.map(f=>f.name)).size!==selected.files.length)fail('Retained export file set is incomplete or ambiguous.');
  const owners=exportOwners(),owner=selected.kind==='magazine'?owners.magazine:owners.native;
  let total=0,folder=null;const retained=[];
  for(const item of selected.files){
   if(typeof item.name!=='string'||!item.name||item.name!==path.basename(item.name)||item.name.includes('\\')||!HASH.test(item.hash||'')||!Number.isSafeInteger(item.sizeBytes)||item.sizeBytes<0||item.sizeBytes>64*1024*1024)fail('Retained export file metadata is invalid.');
   const result=await owner.file({...scope(input),exportId,...(selected.kind==='magazine'?{expectedHash:selected.sourceBinding.sourceHash}:selected.kind==='carousel'?{format:'carousel',name:item.name}:{format:'article'})});regular(result.file);if(fs.statSync(result.file).size!==item.sizeBytes||(total+=item.sizeBytes)>128*1024*1024)fail('Retained export file size changed or exceeds the bounded edition size.');folder??=path.dirname(result.file);if(path.dirname(result.file)!==folder)fail('Retained export files do not share one owner directory.');retained.push({file:result.file,hash:item.hash,sizeBytes:item.sizeBytes});const bytes=fs.readFileSync(result.file);if(bytes.length!==item.sizeBytes||digest(bytes)!==item.hash)fail('Retained delivered bytes changed; keep the original invitation and review the artifact.');
  }
  // Carousel source photographs are retained beside the rendered files, outside its download list.
  for(const item of Object.values(selected.media||{})){
   if(!item||typeof item.name!=='string'||item.name!==path.basename(item.name)||!HASH.test(item.hash||''))fail('Retained Carousel media metadata is invalid.');
   const file=resolveInside(folder,item.name);regular(file);const size=fs.statSync(file).size;if((total+=size)>128*1024*1024)fail('Retained edition exceeds the bounded size.');if(digest(fs.readFileSync(file))!==item.hash)fail('Retained Carousel media bytes changed.');retained.push({file,hash:item.hash,sizeBytes:size});
  }
  const again=(await list(input)).editions.filter(e=>e.exportId===exportId);if(again.length!==1||!same(again[0],selected))fail('Retained export manifest changed while reading.');
  const manifest=path.join(folder,'.manifest.json');regular(manifest);if(fs.statSync(manifest).size>8*1024*1024)fail('Retained export manifest exceeds the bounded size.');const raw=fs.readFileSync(manifest);
  if(!same(descriptor(JSON.parse(raw),selected.kind),selected))fail('Retained export manifest differs from its owner projection.');
  const manifestHash=digest(raw);
  // Synchronous guard for the final Share CAS boundary after other awaited owners.
  const verify=()=>{
   if(fs.realpathSync(folder)!==folder)fail('Retained export directory changed.');
   regular(manifest);if(fs.statSync(manifest).size!==raw.length||digest(fs.readFileSync(manifest))!==manifestHash)fail('Retained export manifest changed during save.');
   for(const item of retained){regular(item.file);if(fs.statSync(item.file).size!==item.sizeBytes||digest(fs.readFileSync(item.file))!==item.hash)fail('Retained delivered bytes changed during save.');}
  };
  verify();return {delivery:{...selected,manifestHash,bytesVerified:true},verify};
 }
 return {list,read:async(...args)=>(await inspect(...args)).delivery,inspect};
}
