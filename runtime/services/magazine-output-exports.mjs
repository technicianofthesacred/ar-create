// Exact working-source adapter over the maintained exports register. No manuscript store.
import {digest} from './files.mjs';
import {StateError} from '../store.mjs';
const HEX=/^[a-f0-9]{64}$/;
const fail=(message,status=409)=>{throw new StateError(message,status);};
export function createMagazineOutputExports({working,exports:register}){
 function fields(input,extra=[]){const keys=['storyId','pieceId','expectedHash',...extra];if(!input||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k))||['storyId','pieceId'].some(k=>typeof input[k]!=='string'||!input[k]||input[k].length>256)||!HEX.test(input.expectedHash||''))fail('Choose the exact Magazine article and working hash.',400);}
 async function scope(input,{checkHash=true}={}){
  const catalog=await working.catalog(),root=catalog.rootIdentity;
  if(catalog.registered!==true||root?.scheme!=='canonical-directory-sha256-v1'||!HEX.test(root.fingerprint))fail('The registered Magazine root is unavailable.');
  const read=await working.read({storyId:input.storyId,pieceId:input.pieceId,edition:'working'}),a=read.authority,d=read.document;
  if(a?.kind!=='magazine'||a.storyId!==input.storyId||a.pieceId!==input.pieceId||typeof a.path!=='string'||(checkHash&&d?.hash!==input.expectedHash)||typeof d?.text!=='string'||digest(d.text)!==d.hash)fail('The article changed before its export could be recorded.');
  const owner={kind:'magazine',storyId:a.storyId,pieceId:a.pieceId,path:a.path,rootFingerprint:root.fingerprint};
  return {projectId:'magazine:'+digest(root.fingerprint+':'+a.storyId),documentId:digest(JSON.stringify(owner)),outputId:digest(a.pieceId),owner,sourceHash:d.hash};
 }
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 return {
  async save(input){
   input=structuredClone(input);
   fields(input,['renderRevision','name','body']);if(!HEX.test(input.renderRevision||'')||typeof input.body!=='string'||!input.body.startsWith('<!doctype html>'))fail('Prepare the exact working HTML before recording its export.',400);
   const s=await scope(input),binding={owner:s.owner,sourceHash:s.sourceHash,renderRevision:input.renderRevision};
   const finalCheck=async()=>{if(!same(s,await scope(input)))fail('The registered source changed during export.');};
   return register.save({name:input.name,mimeType:'text/html',body:input.body,outputId:s.outputId,manuscriptRevision:0},{...s,output:{id:s.outputId,kind:'article',manuscriptRevision:0},finalCheck,magazineBinding:binding,exportUrl:id=>'/api/magazine/working-draft/export-file?'+new URLSearchParams({storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash,exportId:id})});
  },
  async list(input){input=structuredClone(input);fields(input);const s=await scope(input);return {artifacts:register.list(s).artifacts.filter(r=>r.exportKind==='magazine-working-html'&&same(r.sourceBinding?.owner,s.owner)).map(r=>({...r,stale:r.sourceBinding.sourceHash!==s.sourceHash}))};},
  async file(input){input=structuredClone(input);fields(input,['exportId']);const s=await scope(input,{checkHash:false}),result=register.file(input.exportId,s);if(result.artifact.sourceBinding?.sourceHash!==input.expectedHash||result.artifact.exportKind!=='magazine-working-html'||!same(result.artifact.sourceBinding?.owner,s.owner))fail('Export belongs to another article.',404);return result;}
 };
}
