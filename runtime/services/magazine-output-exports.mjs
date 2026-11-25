// Exact working-source adapter over the maintained exports register. No manuscript store.
import {digest} from './files.mjs';
import {StateError} from '../store.mjs';
import fs from 'node:fs';
import {createMagazineMediaInspection} from '../../scripts/magazine-media-inspection.mjs';
import {prepareMagazineHtml} from './render-helper.mjs';
import {createExportAssetReader,exportRendererHash} from './exports.mjs';
const HEX=/^[a-f0-9]{64}$/;
const fail=(message,status=409)=>{throw new StateError(message,status);};
export function createMagazineOutputExports({working,exports:register,repoRoot,roots=[],registeredRoot=null,libraryPhotos,storyPhotos=null}){
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
 const inspected=async action=>{try{return await action();}catch(error){if(error instanceof StateError)throw error;fail(error.message||'The exact working Article is unavailable.',Number.isInteger(error.status)?error.status:409);}};
 function renderer(){
  if(!repoRoot)fail('The exact working Article renderer is not configured.',503);
  return createMagazineMediaInspection({repoRoot,libraryPhotos,storyPhotos,resolveWorking:async input=>{
   const exportRoots=roots.length?roots:registeredRoot?[{id:'registered-magazine-vault',path:registeredRoot}]:[];
   const s=await scope(input),matches=exportRoots.filter(root=>typeof root.id==='string'&&typeof root.path==='string'&&!fs.lstatSync(root.path).isSymbolicLink()&&digest(fs.realpathSync(root.path))===s.owner.rootFingerprint);
   if(matches.length!==1)fail('The registered Article has no unique configured export root.');
   const root=matches[0],read=await working.read({storyId:input.storyId,pieceId:input.pieceId,edition:'working'});
   return {...read,target:{nativeProjectId:input.storyId,artifactId:'mag_'+digest(root.id+'\0'+fs.realpathSync(root.path)+'\0'+s.owner.path),hash:s.sourceHash}};
  }});
 }
 return {
  async save(input){
   input=structuredClone(input);
   fields(input,['renderRevision','name','body']);
   const prepareHere=!Object.hasOwn(input,'body')&&!Object.hasOwn(input,'renderRevision');
   if(!prepareHere&&(!HEX.test(input.renderRevision||'')||typeof input.body!=='string'||!input.body.startsWith('<!doctype html>')))fail('Prepare the exact working HTML before recording its export.',400);
   const s=await scope(input),selection={storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash},media=await inspected(()=>renderer()),edition=await inspected(()=>media.workingEdition(selection)),assets=[];
   if(!prepareHere&&edition.revision!==input.renderRevision)fail('The working Article render revision changed. Prepare its export again.');
   const rendererHash=exportRendererHash(),readAsset=createExportAssetReader({assets,image:async url=>{
    if(url.pathname==='/api/magazine/photos/file'&&storyPhotos){
     // A story's own photograph, by the exact name and hash the edition named.
     const q=Object.fromEntries(url.searchParams),source=edition.media.sources.find(x=>x.previewKind==='story-photo'&&x.name===q.name&&x.sourceRef.hash===q.hash);
     if(Object.keys(q).sort().join()!=='hash,name,storyId'||q.storyId!==input.storyId||!source)fail('Unknown working Article photograph.');
     const photo=await inspected(()=>storyPhotos.file(q));return {body:photo.bytes,hash:photo.hash,contentType:photo.contentType};
    }
    if(url.pathname!=='/api/review/magazine-media/file')fail('Unknown working Article photograph.');
    return inspected(()=>media.preview(Object.fromEntries(url.searchParams)));
   }}),body=await prepareMagazineHtml(edition,{origin:'http://localhost',readAsset});
   if(!prepareHere&&body!==input.body)fail('Export bytes do not match the exact saved working edition. Prepare its export again.');
   const binding={owner:s.owner,sourceHash:s.sourceHash,renderRevision:edition.revision};
   const finalCheck=async()=>{if(!same(s,await scope(input))||!same(edition,await inspected(()=>media.workingEdition(selection)))||exportRendererHash()!==rendererHash)fail('The registered source or its rendered assets changed during export.');await readAsset.assertCurrent();};
   const renderBinding={renderer:'maintained-magazine-renderer-v1',rendererHash,editionHash:digest(JSON.stringify(edition)),bodyHash:digest(body),assets};
   return register.save({name:input.name,mimeType:'text/html',body,outputId:s.outputId,manuscriptRevision:0},{...s,output:{id:s.outputId,kind:'article',manuscriptRevision:0},finalCheck,renderBinding,magazineBinding:binding,exportUrl:id=>'/api/magazine/working-draft/export-file?'+new URLSearchParams({storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash,exportId:id})});
  },
  async list(input){input=structuredClone(input);fields(input);const s=await scope(input);return {artifacts:register.list(s).artifacts.filter(r=>r.exportKind==='magazine-working-html'&&same(r.sourceBinding?.owner,s.owner)).map(r=>({...r,stale:r.sourceBinding.sourceHash!==s.sourceHash}))};},
  async file(input){input=structuredClone(input);fields(input,['exportId']);const s=await scope(input,{checkHash:false}),result=register.file(input.exportId,s);if(result.artifact.sourceBinding?.sourceHash!==input.expectedHash||result.artifact.exportKind!=='magazine-working-html'||!same(result.artifact.sourceBinding?.owner,s.owner))fail('Export belongs to another article.',404);return result;}
 };
}
