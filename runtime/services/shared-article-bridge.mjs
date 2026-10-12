// Local same-article review. No provider execution or inferred editorial approval.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {StateError,validateState} from '../store.mjs';
import {renderProjectArticle} from '../article-persistence.mjs';
import {structuredMarkdown} from '../src/workspaces/structured-markdown.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,regular} from './files.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maxRaw=1024*1024;
const stable=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(item=>JSON.parse(stable(item))):Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,JSON.parse(stable(value[key]))])):value);
export const sharedWritingIdentity=document=>digest(stable({id:document?.id??null,title:document?.title??null,paragraphs:document?.paragraphs??[],pendingResearchCandidate:document?.pendingResearchCandidate??null}));
function locatorLabel(locator){if(typeof locator==='string'){try{if(locator.trim().startsWith('{'))return locatorLabel(JSON.parse(locator));}catch{}return locator.length>120?'Passage in source':locator||'Passage in source';}if(!locator)return 'Passage in source';if(locator.page!==undefined)return `Page ${locator.page}`;if(locator.lineStart!==undefined)return `Line ${locator.lineStart}${locator.lineEnd!==undefined&&locator.lineEnd!==locator.lineStart?'–'+locator.lineEnd:''}`;if(typeof locator.start==='number')return `Characters ${locator.start+1}${typeof locator.end==='number'?'–'+locator.end:''}`;return typeof locator.path==='string'?locator.path.split(/[\\/]/).at(-1)||'Passage in source':'Passage in source';}
function deriveDraft(document){const prose=document.paragraphs.map(p=>structuredMarkdown(p.doc)).join('\n\n'),refs=document.paragraphs.flatMap(p=>p.attributions).filter((a,i,all)=>all.findIndex(b=>b.id===a.id)===i);return prose+(refs.length?'\n\n## Sources\n\n'+refs.map(a=>`- ${a.form==='paraphrase'?'Paraphrase · review required':a.form==='reference'?'Reference':'Quotation'}: ${a.sourceTitle}${a.author?' — '+a.author:''}. ${locatorLabel(a.locator)}\n  Original excerpt: “${a.excerpt}”`).join('\n'):'');}
export function createSharedArticleBridge({dataDir,store,requests,parseArticle,guidance,writingTemplates}){
 const root=ensurePrivateDirectory(dataDir,'shared-article-requests');
 let pending=Promise.resolve();
 const queue=work=>{const op=pending.then(work);pending=op.catch(()=>{});return op;};
 const fail=message=>{throw new StateError(message,409);};
 function location(id,name,{create=false}={}){if(!uuid.test(id))throw new StateError('Shared article request ID is invalid.');const directory=path.join(root,id);if(create)ensurePrivateDirectory(root,id);else {const stat=fs.lstatSync(directory,{throwIfNoEntry:false});if(!stat)throw new StateError('Shared article request was not found.',404);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Shared article request directory must be a real directory.',403);}return path.join(directory,name);}
 function write(id,name,raw){const file=location(id,name,{create:true});atomicWrite(file,raw,{exclusive:true});return {path:file,hash:digest(raw)};}
 function read(id,name,hash){const file=location(id,name);let raw;try{const stat=regular(file);if(stat.size>12*1024*1024)fail('Shared article request is too large.');raw=fs.readFileSync(file);}catch(error){if(error.code==='ENOENT')throw new StateError('Shared article request is incomplete or missing.',404);throw error;}if(hash&&digest(raw)!==hash)fail('Shared article request files changed; prepare a new request.');return raw.toString('utf8');}
 function receipt(id){const file=location(id,'decision.json');return fs.existsSync(file)?JSON.parse(read(id,'decision.json')):null;}
 function captured(id){
  const record=JSON.parse(read(id,'request.json'));
  if(record.schema!=='ar-create.shared-article-request.v1'||record.id!==id)fail('Shared article request identity changed.');
  const context=JSON.parse(read(id,'context.json',record.context.hash));read(id,'context.md',record.contextMarkdown.hash);
  const baselineRaw=read(id,'baseline.md',record.baseline.hash),baselineDocument=JSON.parse(read(id,'baseline.json',record.baselineDocument.hash));
  if(context.manifest.projectId!==record.projectId||context.manifest.documentId!==record.documentId||(baselineDocument?.id??null)!==record.documentId||sharedWritingIdentity(baselineDocument)!==record.writingIdentity)fail('Captured context or baseline belongs to another piece.');
  if(record.external)read(id,'external.md',record.external.hash);
  return {record,context,baseline:{raw:baselineRaw,document:baselineDocument}};
 }
 function proposed(id,record){const proposal=JSON.parse(read(id,'proposal.json'));if(proposal.schema!=='ar-create.shared-article-proposal.v1'||proposal.requestId!==id||proposal.projectId!==record.projectId||proposal.documentId!==record.documentId)fail('Shared article proposal identity changed.');return {proposal,raw:read(id,'proposal.md',proposal.rawHash)};}
 const bindingFor=(record,proposal)=>({requestId:record.id,proposalHash:proposal.rawHash,contextHash:record.context.hash,writingIdentity:record.writingIdentity});
 function checkBinding(input,binding){if(!input||Object.keys(input).some(key=>!Object.keys(binding).includes(key))||stable(input)!==stable(binding))fail('Review the exact proposal and context before deciding.');}
 function assertCurrent(article,record){
  if(article.expected.projectId!==record.projectId||article.expected.documentId!==record.documentId)fail('Open the piece that owns this proposal before accepting it.');
  if(sharedWritingIdentity(article.document)!==record.writingIdentity)fail('The accepted writing changed. Prepare a new request; your words and the proposal are preserved.');
  if(record.external){if(article.expected.markdownHash!==record.external.hash)fail('External article changed again. Capture the latest bytes before deciding.');}
  else if(article.externalEdit)fail('Article Markdown has external edits. Capture them for explicit recovery first.');
 }
 async function fresh(record,context,article){if(record.recoveryOnly)return {ok:false,reason:record.recoveryOnly.reason};try{assertCurrent(article,record);await requests.validateWriting(context);return {ok:true,reason:null};}catch(error){if(!error.status&&!/changed|unavailable|missing/i.test(error.message))throw error;return {ok:false,reason:error.message};}}
 async function checkedRequest(id){const saved=captured(id),article=await store.readArticle({allowEditedMarkdown:true});assertCurrent(article,saved.record);await requests.validateWriting(saved.context);const latest=await store.readArticle({allowEditedMarkdown:true});if(stable(latest.expected)!==stable(article.expected))fail('This piece changed during context checking. Refresh before continuing.');return {...saved,article:latest};}
 async function captureSafety(state){
  if(!guidance||!writingTemplates)fail('Verified guidance and template capture are required before acceptance.');
  const current=await guidance.get(),{snapshot}=await writingTemplates.snapshot({expectedProjectId:state.project.id,expectedDocumentId:state.project.document.id,expectedRevision:state.revision});
  return {guidance:{voice:current.voice,perspective:current.positions,recipe:current.recipe},writingTemplateSnapshot:snapshot};
 }
 async function prepareCaptured(input,external=false){
  if(input?.includeThoughts!==undefined&&typeof input.includeThoughts!=='boolean')throw new StateError('Including personal thoughts must be an explicit boolean.');
  const article=await store.readArticle({allowEditedMarkdown:external});
  if(!article.document&&!external)throw new StateError('Open a structured writing document first.');
  if(input?.projectId!==article.project.id||input?.documentId!==(article.document?.id??null))fail('The selected piece changed. Open it again before preparing AI work.');
  if(external&&!article.externalEdit)fail('There is no external article edit to recover.');
  if(!external&&(article.document.paragraphs.some(p=>p.proposal)||article.document.pendingResearchCandidate))fail('Review or drop the waiting writing proposal first.');
  if(!external&&!article.document.paragraphs.length)throw new StateError('Use Draft from sources to begin an empty article.');
  const identity=sharedWritingIdentity(article.document);let context,recoveryOnly;
  try{if(!article.document?.paragraphs.length||article.document.paragraphs.some(p=>p.proposal)||article.document.pendingResearchCandidate)throw new StateError('Resolve pending writing or start a structured manuscript before preparing verified context.');context=await requests.preview({paragraphIds:article.document.paragraphs.map(p=>p.id),sourceIds:input.sourceIds||[],includeThoughts:input.includeThoughts===true,...(input.contextSelection?{contextSelection:input.contextSelection}:{})});await requests.validateWriting(context);}
  catch(error){if(!external)throw error;recoveryOnly={reason:'External bytes are preserved for explicit reset; verified acceptance context is unavailable: '+error.message};context={manifest:{schema:'ar-create.external-recovery-context.v1',projectId:article.project.id,documentId:article.document?.id??null},assembledContext:recoveryOnly.reason};}
  const latest=await store.readArticle({allowEditedMarkdown:external});
  if(stable(latest.expected)!==stable(article.expected)||sharedWritingIdentity(latest.document)!==identity)fail('This piece changed while preparing AI context. Try again.');
  const id=randomUUID(),contextFile=write(id,'context.json',JSON.stringify(context)),contextMarkdown=write(id,'context.md',context.assembledContext),baseline=write(id,'baseline.md',renderProjectArticle(article.project)),baselineDocument=write(id,'baseline.json',JSON.stringify(article.document));
  const record={schema:'ar-create.shared-article-request.v1',id,createdAt:new Date().toISOString(),projectId:article.project.id,documentId:article.document?.id??null,writingIdentity:identity,context:contextFile,contextMarkdown,baseline,baselineDocument,article:article.paths,modelExecuted:false,...(recoveryOnly?{recoveryOnly}:{}),...(external?{external:write(id,'external.md',fs.readFileSync(article.paths.markdown))}:{})};
  write(id,'request.json',JSON.stringify(record));return {record,article};
 }
 function stage(record,article,raw,{allowUnsupported=false}={}){
  let candidate,unsupported;
  const decoded=Buffer.isBuffer(raw)?raw.toString('utf8'):raw;
  try{if(record.recoveryOnly)throw new StateError(record.recoveryOnly.reason);if(Buffer.byteLength(raw)>maxRaw)throw new StateError('External content exceeds the 1 MB review limit. Exact bytes are preserved for download and explicit reset.');if(Buffer.isBuffer(raw)&&!Buffer.from(decoded).equals(raw))throw new StateError('External content is not valid UTF-8. Its exact bytes are preserved for download and explicit reset.');candidate=parseArticle(decoded,article.document,article.project.id);validateState({revision:0,project:{...article.project,document:candidate.document}});if(sharedWritingIdentity(candidate.document)===sharedWritingIdentity(article.document))throw new StateError('The proposed article has no writing changes.');}
  catch(error){if(!allowUnsupported)throw error;unsupported={reason:error.message};}
  if(fs.existsSync(location(record.id,'decision.json')))fail('This request has a terminal decision. Prepare another request.');
  const proposalFile=location(record.id,'proposal.json');
  if(fs.existsSync(proposalFile)){const prior=JSON.parse(read(record.id,'proposal.json'));if(prior.rawHash!==digest(raw))fail('This request already has a different proposal. Prepare another request.');read(record.id,'proposal.md',prior.rawHash);return prior;}
  const rawFile=location(record.id,'proposal.md');if(fs.existsSync(rawFile)){if(read(record.id,'proposal.md')!==decoded)fail('An interrupted proposal contains different words; existing files are preserved.');}else write(record.id,'proposal.md',raw);
  const proposal={schema:'ar-create.shared-article-proposal.v1',requestId:record.id,projectId:record.projectId,documentId:record.documentId,createdAt:new Date().toISOString(),rawHash:digest(raw),status:'for-review',summary:candidate?.summary||null,...(unsupported?{unsupported}:{}),author:record.external?'external-editor-unspecified':'external-ai-provider-unspecified',modelExecutionVerified:false};write(record.id,'proposal.json',JSON.stringify(proposal));return proposal;
 }
 async function review(id){
  const {record,context,baseline}=captured(id),{proposal,raw}=proposed(id,record),article=await store.readArticle({allowEditedMarkdown:true}),decision=receipt(id);
  let candidate=null;if(!proposal.unsupported){candidate=parseArticle(raw,baseline.document,record.projectId);validateState({revision:0,project:{...article.project,id:record.projectId,document:candidate.document}});}
  const freshness=await fresh(record,context,article);if(proposal.unsupported){freshness.ok=false;freshness.reason=proposal.unsupported.reason;}
  // A fresh preview reflects latest outputs, while baseline stays immutable.
  if(candidate&&freshness.ok)candidate=parseArticle(raw,article.document,record.projectId);
  const preview=proposal.unsupported&&Buffer.byteLength(raw)>64*1024?raw.slice(0,16000):raw;
  return {request:record,proposal,raw:preview,...(record.external?{externalArtifact:{url:'/api/shared-articles/requests/'+id+'/external',hash:record.external.hash,bytes:regular(location(id,'external.md')).size},rawPreviewTruncated:preview!==raw}:{}),candidate,baseline,document:article.document,expected:article.expected,context:context.manifest,freshness,binding:bindingFor(record,proposal),status:decision?.decision||(freshness.ok?'pending':'stale'),receipt:decision,...(proposal.unsupported?{unsupported:proposal.unsupported}:{})};
 }
 async function decide(id,input,decision){
  // Load identity, not freshness. The store checks a terminal receipt first.
  let saved,record,context,proposal,raw,binding;
  try{saved=captured(id);({record,context}=saved);({proposal,raw}=proposed(id,record));binding=bindingFor(record,proposal);checkBinding(input,binding);}catch(error){error.outcome='not-applied';throw error;}
  return store.decideSharedArticle({requestId:id,decision,binding},async boundary=>{
   if(decision==='rejected'&&!record.external){await boundary.readArticle({allowEditedMarkdown:true});return {projectId:record.projectId,documentId:record.documentId};}
   const article=await boundary.readArticle({allowEditedMarkdown:true});
   if(record.external&&article.expected.markdownHash!==record.external.hash)fail('External article changed again. Capture the latest bytes before deciding.');
   if(decision==='rejected')return {projectId:record.projectId,documentId:record.documentId,externalHash:record.external.hash,next:{...boundary.state,revision:boundary.state.revision+1},expectedArticle:article.expected};
   assertCurrent(article,record);
   if(proposal.unsupported)fail('Unsupported external content cannot be accepted. Download its preserved bytes or reset explicitly to the saved article.');
   await requests.validateWriting(context);
   if(boundary.state.project.versions.length>=50)fail('The 50-version limit is reached. Export existing Versions before accepting more writing.');
   const candidate=parseArticle(raw,boundary.state.project.document,record.projectId),safety=await captureSafety(boundary.state),safetyVersionId=randomUUID(),createdAt=new Date().toISOString();
   const next=structuredClone(boundary.state),document=next.project.document;
   next.project.versions.unshift({id:safetyVersionId,createdAt,label:'Before shared article acceptance',draft:deriveDraft(document),document:structuredClone(document),...safety});
   document.title=candidate.document.title;document.paragraphs=candidate.document.paragraphs;document.revision++;
   next.project.title=document.title;next.project.draft=deriveDraft(document);next.revision++;validateState(next);
   return {next,projectId:record.projectId,documentId:record.documentId,safetyVersionId,expectedArticle:article.expected,externalHash:record.external?.hash,finalCheck:async()=>{await requests.validateWriting(context);const finalSafety=await captureSafety(boundary.state);if(stable(finalSafety.guidance)!==stable(safety.guidance)||stable({...finalSafety.writingTemplateSnapshot,capturedAt:null})!==stable({...safety.writingTemplateSnapshot,capturedAt:null}))fail('Guidance or writing template changed during acceptance. Review the current context.');}};
  });
 }
 return {
  launchRequest(id){return queue(async()=>{const saved=await checkedRequest(id);if(receipt(id)||fs.existsSync(location(id,'proposal.json')))fail('This request already has a proposal or decision. Review it instead of resending.');return saved.record;});},
  prepare(input){return queue(async()=>(await prepareCaptured(input)).record);},
  propose(input){return queue(async()=>{if(typeof input?.raw!=='string'||!input.raw.trim()||Buffer.byteLength(input.raw)>maxRaw)throw new StateError('Provide complete article Markdown under 1 MB.');const {record,article}=await checkedRequest(input.requestId);return stage(record,article,input.raw);});},
  review(id){return queue(()=>review(id));},
  external(id){return queue(async()=>{const {record}=captured(id);if(!record.external)throw new StateError('This request has no captured external artifact.',404);const file=location(id,'external.md');regular(file);const bytes=fs.readFileSync(file);if(digest(bytes)!==record.external.hash)fail('Captured external bytes changed.');return bytes;});},
  list(input={}){return queue(async()=>{
   const article=await store.readArticle({allowEditedMarkdown:true}),projectId=input.projectId||article.project.id,documentId=input.documentId??article.document?.id??null,items=[];
   for(const id of fs.readdirSync(root)){if(!uuid.test(id))continue;const saved=captured(id);if(saved.record.projectId!==projectId||saved.record.documentId!==documentId)continue;
    if(!fs.existsSync(location(id,'proposal.json'))){items.push({id,requestId:id,createdAt:saved.record.createdAt,status:'prepared'});continue;}
    const detail=await review(id);items.push({id,requestId:id,createdAt:saved.record.createdAt,status:detail.status,freshness:detail.freshness,binding:detail.binding,proposal:detail.proposal,receipt:detail.receipt,external:!!saved.record.external});
   }
   items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return {items,...(article.externalEdit?{externalEdit:{projectId:article.project.id,documentId:article.document?.id,hash:article.expected.markdownHash,path:article.paths.markdown}}:{})};
  });},
  accept(id,input){return queue(()=>decide(id,input,'accepted'));},
  reject(id,input){return queue(()=>decide(id,input,'rejected'));},
  recoverExternal(input){return queue(async()=>{const {record,article}=await prepareCaptured(input,true);const capturedBytes=fs.readFileSync(record.external.path);if(digest(capturedBytes)!==article.expected.markdownHash)fail('External article changed during capture. Preserve its bytes and capture again.');stage(record,article,capturedBytes,{allowUnsupported:true});return review(record.id);});},
 };
}
