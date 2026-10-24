// Explicit read-only access to a retained original SPA state. This is never a
// working-output authority and does not import, migrate, or write its source.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const MAX_BYTES=2*1024*1024;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=160&&!/[\u0000-\u001f\u007f]/.test(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function createRetainedCarouselReader({retainedCarouselState}={}){
 if(retainedCarouselState===undefined)return {list:async()=>({readOnly:true,available:false,items:[]}),read:async()=>fail('Retained originals are not configured.',503)};
 const config=retainedCarouselState;
 if(!object(config)||Object.keys(config).some(key=>!['path','projectId','documentId','outputIds','readOnlyOutputIds'].includes(key))||typeof config.path!=='string'||!path.isAbsolute(config.path)||!identifier(config.projectId)||!identifier(config.documentId)||!Array.isArray(config.outputIds)||!config.outputIds.length||config.outputIds.length>100||config.outputIds.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(config.outputIds).size!==config.outputIds.length)fail('Use an explicit retained-original configuration.',400);
 const readOnly=config.readOnlyOutputIds===undefined?[]:config.readOnlyOutputIds;
 if(!Array.isArray(readOnly)||readOnly.length>100||readOnly.some(id=>typeof id!=='string'||!UUID.test(id))||new Set([...config.outputIds,...readOnly]).size!==config.outputIds.length+readOnly.length)fail('Use distinct explicit read-only retained-original identities.',400);
 const sourcePath=path.normalize(config.path),projectId=config.projectId,documentId=config.documentId,copyAllowed=new Set(config.outputIds),allowed=[...config.outputIds,...readOnly];
 async function snapshot(){
  let handle;
  try{
   // Reject symlinked parents as well as the final path. O_NOFOLLOW protects
   // the open against a final-component replacement between these checks.
   if(await fs.realpath(sourcePath)!==sourcePath)fail('The retained original must be a regular file.',403);
   const initial=await fs.lstat(sourcePath);if(!initial.isFile()||initial.isSymbolicLink())fail('The retained original must be a regular file.',403);
   handle=await fs.open(sourcePath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const before=await handle.stat();if(!before.isFile())fail('The retained original must be a regular file.',403);
   if(before.size>MAX_BYTES)fail('The retained original exceeds the reader limit.',413);
   const bytes=Buffer.alloc(MAX_BYTES+1);let length=0;
   while(length<bytes.length){const part=await handle.read(bytes,length,bytes.length-length,length);if(!part.bytesRead)break;length+=part.bytesRead;}
   if(length>MAX_BYTES)fail('The retained original exceeds the reader limit.',413);
   const after=await handle.stat(),current=await fs.lstat(sourcePath);
   if(!current.isFile()||current.isSymbolicLink()||initial.dev!==before.dev||initial.ino!==before.ino||before.dev!==current.dev||before.ino!==current.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs||after.size!==length||current.size!==after.size||current.mtimeMs!==after.mtimeMs||current.ctimeMs!==after.ctimeMs)fail('The retained original changed while it was read.');
   const raw=bytes.subarray(0,length);let state;try{state=JSON.parse(raw.toString('utf8'));}catch{fail('The retained original is not supported JSON.',415);}
   const project=state?.project,document=project?.document;
   if(!Number.isSafeInteger(state?.revision)||state.revision<0||project?.id!==projectId||document?.id!==documentId||document?.schema!=='ar-create.document.v1'||!Number.isSafeInteger(document.revision)||document.revision<0||!Array.isArray(document.outputs))fail('The configured retained-original identity is unavailable.');
   const seen=new Set();for(const output of document.outputs){if(!identifier(output?.id)||seen.has(output.id))fail('Retained output identities are ambiguous.');seen.add(output.id);}
   const outputs=allowed.map(id=>{const output=document.outputs.find(item=>item.id===id);if(!output||output.kind!=='carousel'||!Number.isSafeInteger(output.outputRevision)||output.outputRevision<0||typeof output.createdAt!=='string'||!Number.isFinite(Date.parse(output.createdAt))||!Array.isArray(output.slides)||output.slides.length>200)fail('A configured retained carousel is unavailable.');const slides=new Set();for(const slide of output.slides){if(!identifier(slide?.id)||slides.has(slide.id)||typeof slide.text!=='string'||typeof slide.template!=='string'||!Array.isArray(slide.photos))fail('A retained carousel has unsupported slide data.',415);slides.add(slide.id);}return output;});
   return {state,outputs,sourceHash:digest(raw)};
  }catch(error){if([400,403,409,413,415,503].includes(error.status))throw error;fail('The retained original could not be read.',503);}finally{await handle?.close();}
 }
 function metadata(snapshot,output){return {readOnly:true,authority:'retained-original',copyAllowed:copyAllowed.has(output.id),projectId,documentId,outputId:output.id,kind:'carousel',title:typeof output.title==='string'?output.title:'Untitled carousel',revision:snapshot.state.revision,documentRevision:snapshot.state.project.document.revision,outputRevision:output.outputRevision,createdAt:output.createdAt,slideCount:output.slides.length,sourceHash:snapshot.sourceHash,outputHash:digest(JSON.stringify(output))};}
 return {
  async list(){const value=await snapshot();return {readOnly:true,available:true,items:value.outputs.map(output=>metadata(value,output))};},
  async read({outputId,expectedSourceHash,expectedOutputHash}={}){
   if(!allowed.includes(outputId)||!HASH.test(expectedSourceHash||'')||!HASH.test(expectedOutputHash||''))fail('Use the exact retained carousel reference.',400);
   const value=await snapshot(),output=value.outputs.find(item=>item.id===outputId),item=metadata(value,output);
   if(item.sourceHash!==expectedSourceHash||item.outputHash!==expectedOutputHash)fail('The retained original changed. Refresh its listing before opening it.');
   return {...item,output:structuredClone(output)};
  },
 };
}
