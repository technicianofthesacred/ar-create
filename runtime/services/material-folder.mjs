import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolveInside} from './files.mjs';
import {StateError} from '../store.mjs';
const run=promisify(execFile),uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
async function finder(folder){if(process.platform!=='darwin')throw new StateError('Opening this folder is available on the host Mac. Use the saved location on this device.',503);await run('/usr/bin/open',[folder],{timeout:10000,windowsHide:true});}
/** One fixed host action: open the current owned project's derived Material folder. */
export function createMaterialFolder({dataDir,bindings,library,store,openFolder=finder}){
 return {async open(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['projectKey','projectId','documentId'].includes(k))||!uuid.test(input.projectId||'')||!uuid.test(input.documentId||''))throw new StateError('Use the exact saved project and document identities.',400);
  const bound=await bindings.lookup({projectKey:input.projectKey});
  const current=()=>{if(bound.projectId!==input.projectId||bound.documentId!==input.documentId||store.get().project.id!==input.projectId)throw new StateError('The selected project changed. Open its Material folder again.',409);};current();
  await library.folder({rootId:'library',folder:'Projects/'+bound.projectId});current();
  const folder=resolveInside(dataDir,'library/Projects/'+bound.projectId,{directory:true});
  await openFolder(folder);return {opened:true,projectKey:bound.projectKey,projectId:bound.projectId,documentId:bound.documentId,path:folder};
 }};
}
