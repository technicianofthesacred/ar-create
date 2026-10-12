// Same-output wording review. All publication uses the existing store owner.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {StateError,validateState} from '../store.mjs';
import {renderCarouselWords,parseCarouselWords,carouselWordsManifest} from '../src/workspaces/shared-carousel-words.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,regular} from './files.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const stable=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(item=>JSON.parse(stable(item))):Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,JSON.parse(stable(value[key]))])):value);
export const sharedCarouselWordsIdentity=(projectId,documentId,output)=>digest(stable(carouselWordsManifest(projectId,documentId,output).words));
const fail=message=>{throw new StateError(message,409);};
const utf8=bytes=>{const raw=bytes.toString('utf8');if(!Buffer.from(raw).equals(bytes))throw new StateError('External content is not valid UTF-8. Exact bytes remain available for download and explicit reset.');return raw;};
export function createSharedCarouselBridge({dataDir,store,requests,guidance,writingTemplates}){
 const root=ensurePrivateDirectory(dataDir,'shared-carousel-requests');let pending=Promise.resolve();
 const queue=work=>{const op=pending.then(work);pending=op.catch(()=>{});return op;};
 function location(id,name,create=false){
  if(!uuid.test(id))throw new StateError('Shared carousel request ID is invalid.');
  const directory=path.join(root,id);if(create)ensurePrivateDirectory(root,id);else{const stat=fs.lstatSync(directory,{throwIfNoEntry:false});if(!stat)throw new StateError('Shared carousel request was not found.',404);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Shared request directory must be a real directory.',403);}
  return path.join(directory,name);
 }
 function write(id,name,raw){const file=location(id,name,true);atomicWrite(file,raw,{exclusive:true});return {path:file,hash:digest(raw)};}
 function read(id,name,hash){const file=location(id,name);regular(file);const bytes=fs.readFileSync(file);if(bytes.length>12*1024*1024)fail('Captured carousel artifact is too large.');if(hash&&digest(bytes)!==hash)fail('Captured carousel artifact changed; prepare another request.');return bytes;}
 const readJson=(id,name,hash)=>JSON.parse(utf8(read(id,name,hash)));
 const receipt=id=>fs.existsSync(location(id,'decision.json'))?readJson(id,'decision.json'):null;
 const wordsIdentity=article=>sharedCarouselWordsIdentity(article.project.id,article.document.id,article.output);
 function captured(id){
  const record=readJson(id,'request.json');if(record.schema!=='ar-create.shared-carousel-request.v1'||record.id!==id)fail('Carousel request identity changed.');
  const context=readJson(id,'context.json',record.context.hash),baseline=readJson(id,'baseline.json',record.baselineOutput.hash),raw=utf8(read(id,'baseline.md',record.baseline.hash));
  read(id,'context.md',record.contextMarkdown.hash);
  if(context.manifest.projectId!==record.projectId||context.manifest.documentId!==record.documentId||baseline.id!==record.outputId||sharedCarouselWordsIdentity(record.projectId,record.documentId,baseline)!==record.wordsIdentity||renderCarouselWords(record.projectId,record.documentId,baseline)!==raw)fail('Captured baseline or context belongs to another carousel.');
  if(record.external&&!record.external.missing)read(id,'external.bin',record.external.hash);
  return {record,context,baseline:{raw,output:baseline}};
 }
 function proposed(id,record){const proposal=readJson(id,'proposal.json');if(proposal.schema!=='ar-create.shared-carousel-proposal.v1'||proposal.requestId!==id||proposal.projectId!==record.projectId||proposal.documentId!==record.documentId||proposal.outputId!==record.outputId)fail('Carousel proposal identity changed.');return {proposal,bytes:read(id,'proposal.md',proposal.rawHash)};}
 const bindingFor=(record,proposal,reviewHash)=>({requestId:record.id,proposalHash:proposal.rawHash,reviewHash,contextHash:record.context.hash,wordsIdentity:record.wordsIdentity});
 function bindingCheck(input,binding){if(stable(input)!==stable(binding))fail('Review the exact candidate bytes and context before deciding.');}
 const options=record=>({projectId:record.projectId,documentId:record.documentId,outputId:record.outputId,allowEditedMarkdown:true});
 function assertCurrent(article,record){
  if(article.project.id!==record.projectId||article.document.id!==record.documentId||article.output.id!==record.outputId)fail('Open the carousel that owns this request before deciding.');
  if(wordsIdentity(article)!==record.wordsIdentity)fail('Accepted carousel words changed; prepare a new request. The original proposal is preserved.');
  if(record.external){if(article.expected.markdownHash!==record.external.hash||article.missing!==record.external.missing)fail('External carousel changed again; capture the latest bytes before deciding.');}
  else if(article.externalEdit)fail('Carousel Markdown has external edits; capture them before deciding.');
 }
 async function fresh(record,context,article){try{assertCurrent(article,record);if(record.recoveryOnly)fail(record.recoveryOnly.reason);await requests.validateWriting(context);return {ok:true,reason:null};}catch(error){return {ok:false,reason:error.message};}}
 async function checked(id){const saved=captured(id),article=await store.readCarouselWords(options(saved.record));assertCurrent(article,saved.record);await requests.validateWriting(saved.context);return {...saved,article};}
 async function prepare(input,external=false){
  if(input?.includeThoughts!==undefined&&typeof input.includeThoughts!=='boolean')throw new StateError('Including thoughts requires an explicit boolean.');
  const state=await store.read({allowEditedMarkdown:true});
  if(input?.projectId!==state.project.id||input?.documentId!==state.project.document?.id)fail('Open the exact owning document before preparing carousel work.');
  const article=await store.readCarouselWords({documentId:input.documentId,outputId:input.outputId,allowEditedMarkdown:external});
  if(external&&!article.externalEdit)fail('There is no outside carousel edit to recover.');
  let context,recoveryOnly;
  try{context=await requests.preview({paragraphIds:article.document.paragraphs.map(p=>p.id),sourceIds:input.sourceIds||[],includeThoughts:input.includeThoughts===true,...(input.contextSelection?{contextSelection:input.contextSelection}:{})});await requests.validateWriting(context);}
  catch(error){if(!external)throw error;recoveryOnly={reason:'Exact external bytes are preserved for explicit reset; acceptance context is unavailable: '+error.message};context={manifest:{projectId:article.project.id,documentId:article.document.id},assembledContext:recoveryOnly.reason};}
  const latest=await store.readCarouselWords(options(article.expected));if(stable(latest.expected)!==stable(article.expected))fail('Carousel changed while capturing context. Prepare again.');
  const id=randomUUID(),record={schema:'ar-create.shared-carousel-request.v1',id,createdAt:new Date().toISOString(),projectId:article.project.id,documentId:article.document.id,outputId:article.output.id,wordsIdentity:wordsIdentity(article),context:write(id,'context.json',JSON.stringify(context)),contextMarkdown:write(id,'context.md',context.assembledContext),baseline:write(id,'baseline.md',renderCarouselWords(article.project.id,article.document.id,article.output)),baselineOutput:write(id,'baseline.json',JSON.stringify(article.output)),carousel:article.paths,modelExecuted:false,...(recoveryOnly?{recoveryOnly}:{})};
  if(external)record.external=article.missing?{missing:true,hash:null,bytes:0}:{...write(id,'external.bin',article.bytes),missing:false,bytes:article.bytes.length};
  write(id,'request.json',JSON.stringify(record));return {record,article};
 }
 function stage(record,article,bytes,{allowUnsupported=false}={}){
  let candidate,unsupported;
  try{if(record.external?.missing)throw new StateError('The carousel words file is missing. Its absence is preserved for explicit reset.');if(record.recoveryOnly)fail(record.recoveryOnly.reason);candidate=parseCarouselWords(utf8(bytes),{projectId:record.projectId,documentId:record.documentId,output:article.output});if(!candidate.summary.changed)throw new StateError('The proposal has no wording changes.');validateState({revision:0,project:{...article.project,document:{...article.document,outputs:article.document.outputs.map(o=>o.id===record.outputId?candidate.output:o)}}});}
  catch(error){if(!allowUnsupported)throw error;unsupported={reason:error.message};}
  if(receipt(record.id))fail('This request has a terminal decision.');
  if(fs.existsSync(location(record.id,'proposal.json'))){const prior=proposed(record.id,record);if(prior.proposal.rawHash!==digest(bytes))fail('An immutable proposal already exists. Review an edited candidate or prepare another request.');return prior.proposal;}
  const rawFile=location(record.id,'proposal.md');if(fs.existsSync(rawFile)){if(!read(record.id,'proposal.md').equals(bytes))fail('An interrupted proposal has different bytes; it is preserved.');}else write(record.id,'proposal.md',bytes);
  const proposal={schema:'ar-create.shared-carousel-proposal.v1',requestId:record.id,projectId:record.projectId,documentId:record.documentId,outputId:record.outputId,createdAt:new Date().toISOString(),rawHash:digest(bytes),summary:candidate?.summary||null,status:'for-review',modelExecutionVerified:false,...(unsupported?{unsupported}:{})};write(record.id,'proposal.json',JSON.stringify(proposal));return proposal;
 }
 function reviewBytes(id,record,proposal,bytes){
  const reviewHash=digest(bytes),binding=bindingFor(record,proposal,reviewHash),name='review-'+reviewHash;
  const file=location(id,name+'.md');if(fs.existsSync(file)){if(!read(id,name+'.md',reviewHash).equals(bytes))fail('Review candidate bytes changed.');}else write(id,name+'.md',bytes);
  const receiptFile=location(id,name+'.json');if(fs.existsSync(receiptFile)){if(stable(readJson(id,name+'.json'))!==stable(binding))fail('Review identity changed.');}else write(id,name+'.json',JSON.stringify(binding));
  return binding;
 }
 async function review(id,input={}){
  const {record,context,baseline}=captured(id),{proposal,bytes}=proposed(id,record);let article,unavailable;
  try{article=await store.readCarouselWords(options(record));}catch(error){unavailable=error.message;article={project:{id:record.projectId},document:{id:record.documentId},output:baseline.output,expected:null};}
  let raw=bytes.toString('utf8'),candidate=null,unsupported=proposal.unsupported;
  if(input.raw!==undefined){if(typeof input.raw!=='string'||Buffer.byteLength(input.raw)>1024*1024)throw new StateError('Provide complete review Markdown under 1 MB.');raw=input.raw;unsupported=undefined;}
  try{if(unsupported)throw new StateError(unsupported.reason);candidate=parseCarouselWords(input.raw===undefined?utf8(bytes):raw,{projectId:record.projectId,documentId:record.documentId,output:baseline.output});}
  catch(error){if(input.raw!==undefined)throw error;unsupported={reason:error.message};}
  const freshness=unavailable?{ok:false,reason:unavailable}:await fresh(record,context,article);if(unsupported){freshness.ok=false;freshness.reason=unsupported.reason;}if(candidate&&freshness.ok)candidate=parseCarouselWords(raw,{projectId:record.projectId,documentId:record.documentId,output:article.output});
  const binding=reviewBytes(id,record,proposal,input.raw===undefined?bytes:Buffer.from(raw)),decision=receipt(id);
  return {request:record,proposal,raw,candidate,baseline,output:article.output,expected:article.expected,context:context.manifest,freshness,binding,status:decision?.decision||(freshness.ok?'pending':'stale'),receipt:decision,...(unsupported?{unsupported}:{}),...(record.external?{externalArtifact:{missing:record.external.missing,hash:record.external.hash,bytes:record.external.bytes,url:'/api/shared-carousels/requests/'+id+'/external'}}:{})};
 }
 async function captureSafety(state){
  if(!guidance||!writingTemplates)fail('Verified guidance and writing template snapshots are required.');
  const current=await guidance.get(),{snapshot}=await writingTemplates.snapshot({expectedProjectId:state.project.id,expectedDocumentId:state.project.document.id,expectedRevision:state.revision});
  return {guidance:{voice:current.voice,perspective:current.positions,recipe:current.recipe},writingTemplateSnapshot:snapshot};
 }
 async function decide(id,input,decision){
  const {record,context}=captured(id),{proposal}=proposed(id,record);
  if(typeof input?.reviewHash!=='string'||!/^[a-f0-9]{64}$/.test(input.reviewHash))fail('Review exact candidate bytes before deciding.');
  const binding=bindingFor(record,proposal,input.reviewHash);bindingCheck(input,binding);
  const rawBytes=read(id,'review-'+binding.reviewHash+'.md',binding.reviewHash);bindingCheck(readJson(id,'review-'+binding.reviewHash+'.json'),binding);
  return store.decideSharedCarousel({requestId:id,decision,binding},async boundary=>{
   if(boundary.state.project.id!==record.projectId||boundary.state.project.document?.id!==record.documentId)fail('Open the carousel owning this request.');
   if(decision==='rejected'&&!record.external)return {projectId:record.projectId,documentId:record.documentId,outputId:record.outputId};
   const article=await boundary.readCarouselWords(options(record));
   if(record.external&&(article.expected.markdownHash!==record.external.hash||article.missing!==record.external.missing))fail('External carousel changed again. Capture the latest bytes.');
   const expectedArticle=(await boundary.readArticle()).expected;
   if(decision==='rejected')return {projectId:record.projectId,documentId:record.documentId,outputId:record.outputId,externalHash:record.external.hash,externalMissing:record.external.missing,next:{...boundary.state,revision:boundary.state.revision+1},expectedArticle,expectedCarousel:article.expected};
   assertCurrent(article,record);if(record.recoveryOnly)fail(record.recoveryOnly.reason);
   await requests.validateWriting(context);
   const candidate=parseCarouselWords(utf8(rawBytes),{projectId:record.projectId,documentId:record.documentId,output:article.output});if(!candidate.summary.changed)fail('The reviewed candidate has no wording changes.');
   if(boundary.state.project.versions.length>=50)fail('The 50-version limit is reached. Export Versions first.');
   const safety=await captureSafety(boundary.state),safetyVersionId=randomUUID(),next=structuredClone(boundary.state);
   next.project.versions.unshift({id:safetyVersionId,createdAt:new Date().toISOString(),label:'Before shared carousel acceptance',draft:next.project.draft,document:structuredClone(next.project.document),...safety});
   const output=candidate.output;output.outputRevision=(article.output.outputRevision||0)+1;output.stage='words';delete output.wordsReview;
   next.project.document.outputs=next.project.document.outputs.map(o=>o.id===record.outputId?output:o);next.revision++;validateState(next);
   return {next,projectId:record.projectId,documentId:record.documentId,outputId:record.outputId,safetyVersionId,expectedArticle,expectedCarousel:article.expected,externalHash:record.external?.hash,externalMissing:record.external?.missing,finalCheck:async()=>{await requests.validateWriting(context);const final=await captureSafety(boundary.state);if(stable({...final.writingTemplateSnapshot,capturedAt:null})!==stable({...safety.writingTemplateSnapshot,capturedAt:null})||stable(final.guidance)!==stable(safety.guidance))fail('Guidance or template changed during carousel acceptance.');}};
  });
 }
 return {
  prepare(input){return queue(async()=>(await prepare(input)).record);},
  propose(input){return queue(async()=>{if(typeof input?.raw!=='string'||Buffer.byteLength(input.raw)>1024*1024)throw new StateError('Provide complete carousel Markdown under 1 MB.');const {record,article}=await checked(input.requestId);parseCarouselWords(input.raw,{projectId:record.projectId,documentId:record.documentId,output:article.output});return stage(record,article,Buffer.from(input.raw));});},
  review(id,input){return queue(()=>review(id,input));},
  accept(id,input){return queue(()=>decide(id,input,'accepted'));},reject(id,input){return queue(()=>decide(id,input,'rejected'));},
  external(id){return queue(async()=>{const {record}=captured(id);if(!record.external)throw new StateError('No external artifact exists.',404);return record.external.missing?null:read(id,'external.bin',record.external.hash);});},
  recoverExternal(input){return queue(async()=>{const {record,article}=await prepare(input,true),bytes=record.external.missing?Buffer.alloc(0):read(record.id,'external.bin',record.external.hash);stage(record,article,bytes,{allowUnsupported:true});return review(record.id);});},
  list(input={}){return queue(async()=>{const state=await store.read({allowEditedMarkdown:true}),items=[];const projectId=input.projectId||state.project.id,documentId=input.documentId||state.project.document?.id;for(const id of fs.readdirSync(root)){if(!uuid.test(id))continue;const {record}=captured(id);if(record.projectId!==projectId||record.documentId!==documentId||input.outputId&&record.outputId!==input.outputId)continue;if(!fs.existsSync(location(id,'proposal.json'))){items.push({id,requestId:id,outputId:record.outputId,createdAt:record.createdAt,status:'prepared'});continue;}const item=await review(id);items.push({id,requestId:id,outputId:record.outputId,createdAt:record.createdAt,status:item.status,binding:item.binding,freshness:item.freshness,proposal:item.proposal,receipt:item.receipt,external:!!record.external});}items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));let externalEdit=null;if(input.outputId){const current=await store.readCarouselWords({projectId,documentId,outputId:input.outputId,allowEditedMarkdown:true});if(current.externalEdit)externalEdit={projectId,documentId,outputId:input.outputId,hash:current.expected.markdownHash,missing:current.missing,path:current.paths.markdown};}return {items,...(externalEdit?{externalEdit}:{})};});},
 };
}
