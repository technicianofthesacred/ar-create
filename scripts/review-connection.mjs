import {validateSourcedWriting} from './review-sourced-writing.mjs';
import {parseActor,AGENT_ACTORS} from '../runtime/services/actor.mjs';
import {validateFeedbackInvitationChange} from '../runtime/services/magazine/feedback-share-codec.mjs';
import {articleCompositionIssue} from '../runtime/src/workspaces/article-composition.mjs';
import {assertOutputEditorialReady} from '../runtime/src/workspaces/editorial-state.mjs';
import {validatePhotoAnnotation,validateArticleCredits} from '../runtime/services/magazine-annotations.mjs';
// A code-only review entrance over one existing loopback authority. No app backend,
// store or private directory is imported or initialized here. Optional human source and manuscript
// corrections forward only to that existing owner; this entrance never owns writes.
import {createTranslationOneRunAdmission} from '../runtime/services/translation-one-run-admission.mjs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {validateImportedTranscriptTranslation} from '../config.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav'};
const SAFE_MEDIA_TYPES=new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif','image/heic','video/mp4','video/quicktime','video/x-m4v']);
const SECURITY={
 'Cache-Control':'private, no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
};
function authority(value,port){
 const url=new URL(value);
 if(!Number.isInteger(port)||port<1||port>65535||url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port!==String(port))throw Error('Review authority must be a loopback HTTP origin with its explicitly allowed port.');
 return url;
}
function validPath(raw){
 if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||/[\\\x00-\x20\x7f]/.test(raw))return null;
 const pathname=raw.split('?')[0];let decoded;
 try{decoded=decodeURIComponent(pathname);}catch{return null;}
 // Reject separator escapes and repeated encoding instead of normalizing them.
 if(/%(?:2f|5c)/i.test(pathname)||decoded.includes('%')||decoded.includes('\\')||/[\x00-\x20\x7f]/.test(decoded)||decoded.split('/').some(p=>p==='.'||p==='..'))return null;
 return decoded;
}
// Same flat, passive image namespaces as fixture-overlay.mjs. Other originals
// are read through the existing /api owner, never by exposing a data directory.
const READ_POST_PATHS=new Set(['/api/research/atlas/search','/api/magazine/check','/api/concept/sources/search','/api/study-draft/inspect','/api/study-draft/history-preview','/api/study/outputs/export-check','/api/work-continuity/read','/api/work-continuity/context','/api/work-continuity/understanding','/api/work-continuity/artifacts']);
const NATIVE_CAROUSEL_PATHS=new Set(['/api/study/outputs/copy-retained-carousel','/api/study/outputs/copy-browser-carousel','/api/study/outputs/save','/api/study/outputs/review-words','/api/study/outputs/stand-in-review-words','/api/study/outputs/stand-in-save','/api/study/outputs/stand-in-refresh','/api/study/outputs/undo','/api/study/outputs/undo-words']);
function validateCarouselCorrection(pathname,bytes){
 if(pathname==='/api/study/outputs/stand-in-refresh'){validateNativeReview(pathname,bytes);return;}
 const input=JSON.parse(bytes.toString('utf8')),object=v=>v&&typeof v==='object'&&!Array.isArray(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),fail=()=>{throw Object.assign(Error('Use the exact saved carousel owner and current revision guards.'),{status:400});};
 const base=['rootBindingId','parentStudyId','expectedOutput','operationId'],copy=pathname.includes('/copy-'),extra=copy?['destinationProjectId','destinationDocumentId','expectedNative',pathname.endsWith('copy-browser-carousel')?'browser':'source']:(pathname.endsWith('/save')||pathname.endsWith('/stand-in-save'))?['selectedOutputId','changes']:pathname.endsWith('review-words')?['selectedOutputId','expectedWords','wordsHash']:['selectedOutputId','undoOperationId'];
 if(!object(input)||[...base,...extra].some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>![...base,...extra,'expectedNative'].includes(k))||!uuid(input.rootBindingId)||typeof input.parentStudyId!=='string'||!input.parentStudyId||input.parentStudyId.length>160||!uuid(input.operationId)||!object(input.expectedOutput)||!Number.isSafeInteger(input.expectedOutput.revision)||!hash(input.expectedOutput.hash))fail();
 if(copy){if(!uuid(input.destinationProjectId)||!uuid(input.destinationDocumentId)||!object(input.expectedNative)||!object(input.browser||input.source))fail();}
 else{if((pathname.endsWith('/stand-in-review-words')||pathname.endsWith('/stand-in-save'))&&!input.parentStudyId.startsWith('structure-test-'))fail();if(!uuid(input.selectedOutputId))fail();if((pathname.endsWith('/save')||pathname.endsWith('/stand-in-save'))&&(!object(input.changes)||Object.keys(input.changes).some(k=>!(pathname.endsWith('/stand-in-save')?['slides','caption','name','placements','articleComposition']:['slides','caption','name']).includes(k))))fail();if(pathname.includes('/undo')&&!uuid(input.undoOperationId))fail();if(pathname.endsWith('review-words')&&(!object(input.expectedWords)||!hash(input.wordsHash)))fail();}
}
// These are existing owner operations, admitted only by the two installed native grants.
const NATIVE_EDITION_PATHS=new Set(['/api/study/outputs/create','/api/study/outputs/refresh','/api/study/outputs/export']);
const NATIVE_EXPORT_BODY=32*1024*1024,NATIVE_EXPORT_REQUEST=33*1024*1024;
// The maintained owner renders 1–40 slides in sequence. Each renderer has a 30s
// deadline plus bounded cleanup; reserve 35s per saved slide and the normal I/O margin.
const CAROUSEL_EXPORT_MAX_SLIDES=40,CAROUSEL_EXPORT_SLIDE_MS=35000;
function validateNativeReview(pathname,bytes,{articleSave=false,view=null}={}){
 const input=JSON.parse(bytes.toString('utf8')),object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),fields=(v,required,optional=[])=>object(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k)),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),nullable=v=>v===null||hash(v),revision=v=>Number.isSafeInteger(v)&&v>=0,id=v=>typeof v==='string'&&v.trim()===v&&!!v&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v),fail=()=>{throw Object.assign(Error('Use the exact saved native output and complete current owner proof.'),{status:400});};
 const outputProof=v=>fields(v,['revision','hash'])&&revision(v.revision)&&hash(v.hash);
 const nativeProof=v=>fields(v,['workflow','bindingHash','correspondenceHash'])&&nullable(v.bindingHash)&&nullable(v.correspondenceHash)&&fields(v.workflow,['draft','edits'],['ask','map'])&&Object.values(v.workflow).every(nullable);
 const carouselProof=(v,outputId)=>fields(v,['projectId','documentId','outputId','projectHash','outputHash','markdownHash','companionHash'])&&uuid(v.projectId)&&uuid(v.documentId)&&v.outputId===outputId&&hash(v.projectHash)&&hash(v.outputHash)&&nullable(v.markdownHash)&&hash(v.companionHash);
 if(pathname==='/api/study-draft/check'){
  if(!fields(input,['targetKind','bindingId','parentStudyId','outputId','expected','operationId'])||input.targetKind!=='carousel'||!uuid(input.bindingId)||!id(input.parentStudyId)||!uuid(input.outputId)||!uuid(input.operationId)||!fields(input.expected,['expectedOutput','expectedWords'])||!outputProof(input.expected.expectedOutput)||!carouselProof(input.expected.expectedWords,input.outputId))fail();return input;
 }
 const base=['rootBindingId','parentStudyId','expectedOutput'],mutation=[...base,'operationId'];
 if(!object(input)||!uuid(input.rootBindingId)||!id(input.parentStudyId)||!outputProof(input.expectedOutput))fail();
 if(pathname.endsWith('/stand-in-refresh')){if(!fields(input,[...mutation,'selectedOutputId','expectedNative'])||!uuid(input.operationId)||!uuid(input.selectedOutputId)||!nativeProof(input.expectedNative)||!input.parentStudyId.startsWith('structure-test-'))fail();return input;}
 if(pathname.endsWith('/stand-in-create')){
  if(!fields(input,[...mutation,'kind','sourceBindingId','expectedNative'])||!uuid(input.operationId)||!['article','carousel','post','product-listing'].includes(input.kind)||!uuid(input.sourceBindingId)||!nativeProof(input.expectedNative)||!input.parentStudyId.startsWith('structure-test-'))fail();return input;
 }
 if(pathname.endsWith('/create')){
  if(!fields(input,[...mutation,'kind','sourceOutputId','targetLanguage','expectedSourceWords'])||!uuid(input.operationId)||!['article','carousel'].includes(input.kind)||!uuid(input.sourceOutputId)||input.sourceOutputId===input.operationId||typeof input.targetLanguage!=='string'||input.targetLanguage.length>48)fail();
  try{if(Intl.getCanonicalLocales(input.targetLanguage)[0]!==input.targetLanguage)fail();}catch{fail();}
  const p=input.expectedSourceWords;
  if(input.kind==='article'){if(!fields(p,['kind','bindingId','parentStudyId','expected','rawHash','capturedRawHash'])||p.kind!=='native'||!uuid(p.bindingId)||p.parentStudyId!==input.parentStudyId||!nativeProof(p.expected)||!hash(p.rawHash)||!hash(p.capturedRawHash))fail();}
  else if(!fields(p,['kind','projectId','documentId','outputId','expected','wordsHash'])||p.kind!=='carousel-words'||!uuid(p.projectId)||!uuid(p.documentId)||p.outputId!==input.sourceOutputId||!carouselProof(p.expected,p.outputId)||p.expected.projectId!==p.projectId||p.expected.documentId!==p.documentId||!hash(p.wordsHash))fail();
 }else if(pathname.endsWith('/save')){
  if(!fields(input,[...mutation,'selectedOutputId','changes'],['expectedNative'])||!uuid(input.operationId)||!uuid(input.selectedOutputId)||!object(input.changes)||Object.keys(input.changes).some(k=>!['placements','articleComposition','name','slides','caption'].includes(k))||Object.hasOwn(input,'expectedNative')&&!object(input.expectedNative))fail();
  if(articleSave){
   if(!nativeProof(input.expectedNative)||!Object.keys(input.changes).length||Object.keys(input.changes).some(k=>!['placements','articleComposition','name'].includes(k)))fail();
   if(Object.hasOwn(input.changes,'name')&&(typeof input.changes.name!=='string'||!input.changes.name.isWellFormed()||input.changes.name.length>256||/[\x00-\x1f\x7f]/.test(input.changes.name)))fail();
   const placements=input.changes.placements??view.output.placements;
   if(!Array.isArray(placements)||placements.length>5000||placements.some(p=>!fields(p,['slot','url'],['x','y','zoom','alt','caption','paragraphId'])||!id(p.slot)||typeof p.url!=='string'||p.url!==''&&!/^\/api\/sources\/blob\?id=(?:[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(p.url)||['x','y'].some(k=>p[k]!==undefined&&(!Number.isFinite(p[k])||p[k]<0||p[k]>1))||p.zoom!==undefined&&(!Number.isFinite(p.zoom)||p.zoom<=0)||['alt','caption'].some(k=>p[k]!==undefined&&(typeof p[k]!=='string'||!p[k].isWellFormed()||p[k].length>100000))||p.paragraphId!==undefined&&p.paragraphId!==null&&!id(p.paragraphId)))fail();
   if(articleCompositionIssue(input.changes.articleComposition??view.output.articleComposition,view.output.manuscript,placements))fail();
   try{assertOutputEditorialReady({...view.output,...input.changes});}catch{fail();}
  }
 }else if(pathname.endsWith('/refresh')){
  if(!fields(input,[...mutation,'selectedOutputId','expectedNative'])||!uuid(input.operationId)||!uuid(input.selectedOutputId)||!nativeProof(input.expectedNative))fail();
 }else if(pathname.endsWith('/export')){
  if(!['article','carousel'].includes(input.kind)||!uuid(input.selectedOutputId))fail();
  if(input.kind==='article'){
   if(!fields(input,[...base,'kind','selectedOutputId','expectedNative','manuscriptRevision','name','mimeType','body'])||!nativeProof(input.expectedNative)||!revision(input.manuscriptRevision)||typeof input.name!=='string'||!input.name.trim()||input.name.length>240||/[/\\:\x00-\x1f\x7f]/.test(input.name)||input.name.startsWith('.')||!['text/html','text/markdown','application/json'].includes(input.mimeType)||typeof input.body!=='string'||!input.body.isWellFormed())fail();
   if(Buffer.byteLength(input.body)>NATIVE_EXPORT_BODY)throw Object.assign(Error('Export exceeds 32 MB.'),{status:413});
   if(input.mimeType==='application/json')try{JSON.parse(input.body);}catch{fail();}
  }else if(!fields(input,[...base,'kind','selectedOutputId','outputRevision'])||!revision(input.outputRevision))fail();
 }else fail();
 return input;
}
function nativeOutputSnapshot(upstream,timeoutMs,input){
 const query=new URLSearchParams({rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId});
 return new Promise((resolve,reject)=>{const fail=()=>reject(Object.assign(Error('The selected native output could not be verified. Reopen it before continuing.'),{status:503})),pending=http.get(new URL('/api/study/outputs?'+query,upstream),{headers:{accept:'application/json'}},owner=>{
  if(owner.statusCode!==200){owner.resume();return fail();}let size=0;const chunks=[];owner.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){owner.destroy();fail();}else chunks.push(chunk);});owner.once('error',fail);owner.once('end',()=>{try{resolve(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));}catch{fail();}});
 });pending.setTimeout(timeoutMs,()=>pending.destroy(Error('timeout')));pending.once('error',fail);});
}

function ownedStudyRead(upstream,timeoutMs,route,{preserveRefusal=false}={}){return new Promise((resolve,reject)=>{const fail=()=>reject(Object.assign(Error('The exact owned manuscript could not be verified.'),{status:503})),pending=http.get(new URL(route,upstream),{headers:{accept:'application/json'}},owner=>{if(owner.statusCode!==200){owner.resume();if(preserveRefusal&&[400,403,404,409,423].includes(owner.statusCode))return reject(Object.assign(Error('The exact selected Share owner or saved revision could not be verified.'),{status:owner.statusCode}));return fail();}let size=0;const chunks=[];owner.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){owner.destroy();fail();}else chunks.push(chunk);});owner.once('error',fail);owner.once('end',()=>{try{resolve(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));}catch{fail();}});});pending.setTimeout(timeoutMs,()=>pending.destroy(Error('timeout')));pending.once('error',fail);});}
const MAX_READ_BODY=1024*1024;
async function readJSON(req,{correction=false,maxBytes=MAX_READ_BODY}={}){
 const reject=(status,message)=>{throw Object.assign(Error(message),{status});};
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){req.resume();reject(415,'Read requests require application/json.');}
 const length=req.headers['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>maxBytes)){req.resume();reject(413,'Request exceeds its byte limit.');}
 const chunks=[];let size=0;
 const bytes=await new Promise((resolve,rejectBody)=>{
  const onData=chunk=>{size+=chunk.length;if(size>maxBytes){req.off('data',onData);req.resume();rejectBody(Object.assign(Error('Request exceeds its byte limit.'),{status:413}));}else chunks.push(chunk);};
  req.on('data',onData);req.once('end',()=>resolve(Buffer.concat(chunks)));req.once('error',()=>rejectBody(Object.assign(Error('Read request was interrupted.'),{status:400})));
 });
 try{JSON.parse(correction?new TextDecoder('utf-8',{fatal:true}).decode(bytes):bytes.toString('utf8'));}catch{reject(400,'Request must contain valid UTF-8 JSON.');}
 return bytes;
}
const SOURCE_CORRECTION_PATHS=new Set(['/api/source-sessions/edit','/api/source-sessions/undo','/api/source-sessions/translation-accept']);
function validateCorrection(pathname,bytes){
 const input=JSON.parse(bytes.toString('utf8'));
 const reviewed=pathname.endsWith('/translation-accept'),edit=reviewed||pathname.endsWith('/edit');
 const keys=edit?['operationId','expectedRevision','expectedSourceHash','sessionId','turnId','speaker','text',...(reviewed?['receiptSha256']:[])]:['operationId','undoOperationId','expectedRevision','expectedSourceHash','sessionId'];
 const word=(value,max)=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!value.includes('\0');
 // Match the maintained source owner, including its non-UUID operation IDs.
 // The owner alone compares the caller's unchanged revision/hash under its lock.
 const operation=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||!operation(input.operationId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.expectedSourceHash!=='string'||!word(input.sessionId,300)||(edit?(!word(input.turnId,300)||!word(input.speaker,100)||!word(input.text,12000)):!operation(input.undoOperationId))||(reviewed&&!/^[a-f0-9]{64}$/.test(input.receiptSha256)))throw Object.assign(Error('Use the complete current source correction request.'),{status:400});
}
const TRANSLATION_PROPOSAL_PATH='/api/source-sessions/translation-proposals';
function validateTranslationProposal(bytes){
 const input=JSON.parse(bytes.toString('utf8')),keys=['sessionId','expectedRevision','expectedSourceHash'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||typeof input.sessionId!=='string'||!input.sessionId.trim()||input.sessionId.length>300||!input.sessionId.isWellFormed()||/[\x00-\x1f\x7f]/.test(input.sessionId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.expectedSourceHash!=='string'||!/^[a-f0-9]{64}$/i.test(input.expectedSourceHash))throw Object.assign(Error('Use the exact selected conversation, revision and source fingerprint.'),{status:400});
 return input;
}
function translationSnapshot(upstream,timeoutMs){
 return new Promise((resolve,reject)=>{
  const fail=()=>reject(Object.assign(Error('The conversation owner is unavailable; no translation was started.'),{status:503}));
  const pending=http.get(new URL('/api/source-sessions',upstream),{headers:{accept:'application/json'}},owner=>{
   if(owner.statusCode!==200){owner.resume();return fail();}
   let size=0;const chunks=[];
   owner.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){owner.destroy();fail();}else chunks.push(chunk);});
   owner.once('error',fail);owner.once('end',()=>{try{resolve(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));}catch{fail();}});
  });
  pending.setTimeout(timeoutMs,()=>pending.destroy(Error('timeout')));pending.once('error',fail);
 });
}
const STUDY_DRAFT_CORRECTION_PATHS=new Set(['/api/study-draft/save','/api/study-draft/undo']);
function validateDraftCorrection(pathname,bytes,{approvals=false}={}){
 const input=JSON.parse(bytes.toString('utf8'));
 const fail=()=>{throw Object.assign(Error('Use the complete bound manuscript request and its current saved proof.'),{status:400});};
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const fields=(value,required,optional=[])=>object(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),proofHash=value=>value===null||hash(value);
 const keys=['bindingId','parentStudyId','operationId','expected',pathname.endsWith('/save')?'operations':'undoOperationId'];
 if(!fields(input,keys)||!uuid(input.bindingId)||!uuid(input.operationId)||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId))fail();
 const proof=input.expected;
 // Only the maintained owner can compare this full, unchanged proof with disk.
 if(!fields(proof,['workflow','bindingHash','correspondenceHash'])||!proofHash(proof.bindingHash)||!proofHash(proof.correspondenceHash)||!fields(proof.workflow,['draft','edits'],['ask','map'])||Object.values(proof.workflow).some(value=>!proofHash(value)))fail();
 if(pathname.endsWith('/undo')){if(!uuid(input.undoOperationId))fail();return;}
 if(!Array.isArray(input.operations)||!input.operations.length||input.operations.length>1000)fail();
 // Approval is the owner's one exact marked span, supplied by the maintained
 // human action. It cannot carry substitute words, mix with edits, or batch.
 if(input.operations.some(op=>op?.kind==='approveMark')){
  const op=input.operations[0];
  if(!approvals||input.operations.length!==1||!fields(op,['kind','id','rawFrom','rawTo','seenBlockHash','seenMarkupHash','humanDecision'])||typeof op.id!=='string'||!op.id||op.id.length>256||!op.id.isWellFormed()||/[\x00-\x1f\x7f]/.test(op.id)||!Number.isSafeInteger(op.rawFrom)||op.rawFrom<0||!Number.isSafeInteger(op.rawTo)||op.rawTo-op.rawFrom<5||!hash(op.seenBlockHash)||!hash(op.seenMarkupHash)||op.humanDecision!==true)fail();
  return;
 }
 validateNativeOperations(input.operations,fail);
}
function validateNativeOperations(operations,fail,{photoAspect=false,photoReplace=false,photoLibrary=false,photoInsert=false}={}){
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const fields=(value,required,optional=[])=>object(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 // Prose/structure and one exact photo adjustment; aspect is Magazine-only,
 // and markup approval keeps its separate gate.
 const shapes={photoAnnotation:['kind','id','seenBlockHash','annotation'],articleCredits:['kind','credits'],photoDescription:['kind','id','seenBlockHash','description'],photoInsertAsset:['kind','id','seenBlockHash','rootId','sourceId','revision','sourceHash','description'],photoReplaceAsset:['kind','id','seenBlockHash','rootId','sourceId','revision','sourceHash','description'],photoReplace:['kind','id','seenBlockHash','replacementId','seenReplacementHash'],photoAspect:['kind','id','seenBlockHash','aspect'],photoFocus:['kind','id','seenBlockHash','x','y'],text:['kind','id','from','to','insert','seenBlockHash'],move:['kind','id','beforeId'],split:['kind','id','at','newId'],join:['kind','leftId','rightId'],insert:['kind','id','beforeId','raw'],delete:['kind','id'],blockKind:['kind','id','blockKind','seenBlockHash']};
 for(const op of operations){
  if(!object(op)||typeof op.kind!=='string'||!Object.hasOwn(shapes,op.kind)||!fields(op,shapes[op.kind],op.kind==='blockKind'?['level']:[]))fail();
  for(const key of ['id','leftId','rightId','newId','replacementId'])if(key in op&&(typeof op[key]!=='string'||!op[key]||op[key].length>256||!op[key].isWellFormed()||/[\x00-\x1f]/.test(op[key])))fail();
  if('beforeId' in op&&op.beforeId!==null&&(typeof op.beforeId!=='string'||!op.beforeId))fail();
  for(const key of ['from','to','at'])if(key in op&&(!Number.isSafeInteger(op[key])||op[key]<0))fail();
  for(const key of ['insert','raw'])if(key in op&&(typeof op[key]!=='string'||!op[key].isWellFormed()||op[key].includes('\0')))fail();
  if('seenBlockHash' in op&&!hash(op.seenBlockHash))fail();
  if(['photoReplaceAsset','photoInsertAsset'].includes(op.kind)&&(!photoLibrary||op.kind==='photoInsertAsset'&&!photoInsert||operations.length!==1||!hash(op.rootId)||!hash(op.revision)||!hash(op.sourceHash)||typeof op.sourceId!=='string'||!(/^[a-f0-9]{64}$/.test(op.sourceId)||/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(op.sourceId))||typeof op.description!=='string'||op.description.length>2000||!op.description.isWellFormed()||op.description!==op.description.trim()||/[\x00-\x1f\x7f%]/.test(op.description)||op.description.includes(' · ')))fail();
  if(['photoAnnotation','articleCredits'].includes(op.kind)){if(!photoAspect||operations.length!==1)fail();try{if(op.kind==='photoAnnotation')validatePhotoAnnotation(op.annotation);else validateArticleCredits(op.credits);}catch{fail();}}
  if(op.kind==='photoDescription'&&(!photoAspect||operations.length!==1||typeof op.description!=='string'||op.description.length>2000||!op.description.isWellFormed()||op.description!==op.description.trim()||/[\x00-\x1f\x7f%]/.test(op.description)||op.description.includes(' · ')))fail();
  if(op.kind==='photoReplace'&&(!photoReplace||operations.length!==1||op.id===op.replacementId||!hash(op.seenReplacementHash)))fail();
  if(op.kind==='photoAspect'&&(!photoAspect||operations.length!==1||!['4/3','4/5','1/1'].includes(op.aspect)))fail();
  if(op.kind==='photoFocus'&&(operations.length!==1||![op.x,op.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))fail();
  if(op.kind==='blockKind'&&(!['paragraph','heading','blockquote'].includes(op.blockKind)||op.blockKind==='heading'&&![1,2,3].includes(op.level)||op.blockKind!=='heading'&&op.level!==undefined))fail();
 }
}

function validateMagazineMechanicalCheck(bytes){
 const input=JSON.parse(bytes.toString('utf8')),keys=['parentStudyId','storyId','pieceId','expectedDraftHash','expectedInputRevision','operationId'];
 const id=v=>typeof v==='string'&&v.length>0&&v.length<=256&&v.isWellFormed()&&!/[\x00-\x1f\x7f]/.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||keys.slice(0,3).some(k=>!id(input[k]))||!hash(input.expectedDraftHash)||!hash(input.expectedInputRevision)||typeof input.operationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.operationId))throw Object.assign(Error('Use the exact working piece and current saved-check proof.'),{status:400});
}
const MAGAZINE_DRAFT_CORRECTION_PATHS=new Set(['/api/magazine/working-draft/prepare','/api/magazine/working-draft/save','/api/magazine/working-draft/undo']);
const MAGAZINE_FEEDBACK_CORRECTION_PATHS=new Set(['/api/magazine/working-draft/share-feedback/prepare-mapping','/api/magazine/working-draft/share-feedback/prepare','/api/magazine/working-draft/share-feedback/prepare-paragraph','/api/magazine/working-draft/share-feedback/save','/api/magazine/working-draft/share-feedback/undo']);
function validateMagazineFeedbackCorrection(pathname,body){
 const input=JSON.parse(body.toString('utf8')),action=pathname.split('/').at(-1),base=['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash'],extras=action==='undo'?['operationId','undoOperationId']:action==='prepare-mapping'?['recipientId','recipientName','sections','invitationChange']:action==='prepare-paragraph'?['block','seen','text']:action==='save'?['content','operationId','reason']:['content'];
 const fail=()=>{throw Object.assign(Error('Use exact registered feedback identities, current hashes and the selected paragraph or saved operation.'),{status:400});};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>![...base,...extras].includes(key))||base.some(key=>typeof input[key]!=='string'||!input[key])||input.edition!=='working'||!['expectedHash','expectedFeedbackHash'].every(key=>/^[a-f0-9]{64}$/.test(input[key]))||!['storyId','pieceId'].every(key=>input[key].length<=256&&!/[\x00-\x1f\x7f]/.test(input[key]))||!/^Workflow\/6-Feedback\/FEEDBACK - [^/\\\x00-\x1f\x7f]+\.md$/.test(input.registeredFeedbackPath)||input.registeredFeedbackPath.length>600||input.registeredFeedbackPath.includes('.sync-conflict-'))fail();
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value),words=value=>typeof value==='string'&&value.isWellFormed()&&!value.includes('\0')&&Buffer.byteLength(value,'utf8')<=2*1024*1024;
 if(action==='undo'){if(!uuid(input.operationId)||!uuid(input.undoOperationId))fail();}
 else if(action==='prepare-mapping'){if(input.invitationChange!==undefined){if(['recipientId','recipientName','sections'].some(k=>Object.hasOwn(input,k)))fail();try{validateFeedbackInvitationChange(input.invitationChange);}catch{fail();}return;}if(!uuid(input.recipientId)||!words(input.recipientName)||!input.recipientName.trim()||input.recipientName.length>200||/[\x00-\x1f\x7f]/.test(input.recipientName)||!Array.isArray(input.sections)||!input.sections.length||input.sections.length>12||input.sections.some(row=>!row||typeof row!=='object'||Object.keys(row).length!==3||!['language','heading','hash'].every(key=>Object.hasOwn(row,key))||typeof row.language!=='string'||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(row.language)||typeof row.heading!=='string'||row.heading.length>512||!/^#{1,6} [^\r\n]+$/.test(row.heading)||typeof row.hash!=='string'||!/^[a-f0-9]{64}$/.test(row.hash)))fail();}
 else if(action==='prepare-paragraph'){if(!Number.isSafeInteger(input.block)||input.block<0||!(/^[a-f0-9]{12}$/).test(input.seen||'')||!words(input.text))fail();}
 else if(!words(input.content)||action==='save'&&!uuid(input.operationId)||input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>2000))fail();
}

function validateMagazineCorrection(pathname,bytes){
 const input=JSON.parse(bytes.toString('utf8'));
 const fail=()=>{throw Object.assign(Error('Use the exact working Magazine piece and its current draft proof.'),{status:400});};
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
 const identity=value=>typeof value==='string'&&!!value.trim()&&value.length<=256&&value.isWellFormed()&&!/[\x00-\x1f\x7f]/.test(value);
 const action=pathname.split('/').at(-1),keys=['storyId','pieceId','edition',...(action==='prepare'?['expectedHash','operations']:action==='save'?['expectedHash','content','operationId']:['operationId','undoOperationId'])];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(key=>!Object.hasOwn(input,key))||input.edition!=='working'||!identity(input.storyId)||!identity(input.pieceId))fail();
 if(action!=='undo'&&(typeof input.expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedHash)))fail();
 if(action!=='prepare'&&!uuid(input.operationId))fail();
 if(action==='undo'){if(!uuid(input.undoOperationId))fail();return;}
 if(action==='save'){if(typeof input.content!=='string'||!input.content.isWellFormed()||input.content.includes('\0'))fail();return;}
 if(!Array.isArray(input.operations)||!input.operations.length||input.operations.length>500)fail();
 validateNativeOperations(input.operations,fail,{photoAspect:true,photoReplace:true,photoLibrary:true,photoInsert:true});
}
const fixtureImage=p=>/^\/(?:document-study\/assets\/photos|porcelain-assets)\/[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:jpg|jpeg|png|webp|gif|avif)$/i.test(p);
const upstreamOnly=p=>p.startsWith('/api/')||p.startsWith('/transcription/')||fixtureImage(p)||['/document-study/synthetic-study-data.js','/document-study/package-config.js'].includes(p);
async function staticRead(publicDir,pathname){
 const parts=(pathname==='/'?'/document-study/index.html':pathname).split('/').filter(Boolean);
 if(!parts.length||parts.some(p=>p.startsWith('.')))return null;
 let current=publicDir;
 try{
  const base=await fs.lstat(current);if(!base.isDirectory()||base.isSymbolicLink())return null;
  for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);const st=await fs.lstat(current);if(st.isSymbolicLink()||(i<parts.length-1?!st.isDirectory():!st.isFile()))return null;}
  const canonical=await fs.realpath(publicDir);if(await fs.realpath(current)!==path.join(canonical,...parts))return null;
  return {bytes:await fs.readFile(current),type:TYPES[path.extname(current).toLowerCase()]||'application/octet-stream'};
 }catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return null;throw error;}
}
export function createReviewConnection({publicDir=path.join(root,'public'),runtimePublicDir=path.join(root,'runtime/public'),authorityURL='http://127.0.0.1:8841',allowedAuthorityPort=8841,timeoutMs=10000,nativeCarouselExportTimeoutMs=null,readOverrides=new Map(),actualWorkReview=false,readPostPaths=[],sourceCorrections=false,libraryFolderCorrections=false,changeLibraryFolders=null,changePhotoAlbums=null,studyDraftCorrections=false,studyDraftApprovals=false,browserCarouselCorrections=false,nativeCarouselCorrections=false,nativeOutputExports=false,nativeArticleComposition=false,reviewPhotoReads=[],magazineDraftCorrections=false,magazineFeedbackCorrections=false,magazineCheckReceipts=false,catalogCacheScope=null,translationProposals=null,translationPermissionCurrent=null,translationAdmissionDataDir=null}={}){
 const upstream=authority(authorityURL,allowedAuthorityPort);
 if(changePhotoAlbums!==null&&typeof changePhotoAlbums!=='function')throw Error('Photo album corrections require a trusted callback.');
 if(typeof libraryFolderCorrections!=='boolean'||libraryFolderCorrections&&(!actualWorkReview||typeof changeLibraryFolders!=='function'))throw Error('Library folder corrections require a trusted actual-work structural transport.');
 const translationPolicy=validateImportedTranscriptTranslation(translationProposals);
 const admitTranslation=createTranslationOneRunAdmission({oneRunId:translationPolicy?.keptConversations?.oneRunId,dataDir:translationAdmissionDataDir,scope:'proxy'});
 if(translationPermissionCurrent!==null&&typeof translationPermissionCurrent!=='function')throw Error('Translation permission freshness must be a trusted host check.');
 const translationEnabled=translationPolicy?.keptConversations.enabled===true&&translationPolicy.keptConversations.shareEntireContext===true&&translationPolicy.keptConversations.sourceIds.length>0;
 const translationDeadline=translationPolicy?translationPolicy.timeoutMs+5000:timeoutMs;
 // Browser HTTP/1 pools commonly permit six sockets per origin. Keep live
 // review events from occupying that entire pool across older open clients.
 const eventStreams=new Map(),maxEventStreams=2;
 if(typeof sourceCorrections!=='boolean'||typeof studyDraftCorrections!=='boolean'||typeof studyDraftApprovals!=='boolean'||typeof browserCarouselCorrections!=='boolean'||typeof nativeCarouselCorrections!=='boolean'||typeof nativeOutputExports!=='boolean'||typeof nativeArticleComposition!=='boolean'||typeof magazineDraftCorrections!=='boolean'||typeof magazineFeedbackCorrections!=='boolean'||typeof magazineCheckReceipts!=='boolean')throw Error('Correction permissions must be explicit booleans.');
 if(studyDraftApprovals&&!studyDraftCorrections)throw Error('Marked wording approval requires the existing guarded manuscript corrections.');
 if(!Array.isArray(readPostPaths)||readPostPaths.some(name=>!READ_POST_PATHS.has(name)))throw Error('Only declared maintained POST read paths may be configured.');
 const postReads=new Set(readPostPaths);
 if(!(readOverrides instanceof Map))throw Error('Review read overrides must be an explicit Map.');
 if(!Array.isArray(reviewPhotoReads)||reviewPhotoReads.length>100||reviewPhotoReads.some(item=>!item||Object.keys(item).sort().join(',')!=='sha256,sourceId'||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.sourceId||'')||!/^[a-f0-9]{64}$/.test(item.sha256||'')))throw Error('Photo reads require exact source IDs and reviewed byte hashes.');
 const photoReads=new Map(reviewPhotoReads.map(item=>[item.sourceId,item.sha256]));
 if(photoReads.size!==reviewPhotoReads.length)throw Error('Photo read identities must be unique.');
 const overrides=new Map(readOverrides);
 for(const [name,handler] of overrides)if(typeof handler!=='function'||!(/^\/api\/review\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(name)||['/api/magazine/portfolio','/api/magazine/artifact',...(actualWorkReview?['/api/sources/tree','/api/library/folders','/api/sources/file','/api/collections','/api/collection-relationships','/api/evidence']:[])].includes(name)))throw Error('Review overrides must name a permitted exact read path.');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Use a positive upstream timeout.');
 if(nativeCarouselExportTimeoutMs!==null&&(!Number.isFinite(nativeCarouselExportTimeoutMs)||nativeCarouselExportTimeoutMs<=0||nativeCarouselExportTimeoutMs>CAROUSEL_EXPORT_MAX_SLIDES*CAROUSEL_EXPORT_SLIDE_MS+timeoutMs))throw Error('Use a bounded native Carousel export timeout.');
 const server=http.createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(SECURITY))res.setHeader(key,value);
  const fail=(status,message)=>{if(res.headersSent||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:message,readOnly:true}));};
  const port=server.address()?.port,hosts=[`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`];
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!hosts.includes(req.headers.host)||req.headers.origin!==undefined&&!hosts.map(h=>'http://'+h).includes(req.headers.origin))return fail(403,'Only this local review entrance may read existing work.');
  if(port===allowedAuthorityPort)return fail(503,'Review must use a separate port from the existing authority.');
  const pathname=validPath(req.url);if(!pathname)return fail(400,'This review path is not allowed.');
  const requestActor=req.headers['x-ar-actor']===undefined?'human:adrian':parseActor(req.headers['x-ar-actor']);
  if(!requestActor)return fail(400,'Use one valid actor label for this review session.');
  if(actualWorkReview===true&&pathname==='/api/sources/blob'&&['GET','HEAD'].includes(req.method)){
   req.resume();const query=new URL(req.url,upstream).searchParams,id=query.get('id'),hash=photoReads.get(id);
   if([...query.keys()].length!==1||query.getAll('id').length!==1||!hash)return fail(403,'Original blob reads are unavailable without an exact photo grant.');
   try{const response=await fetch(new URL('/api/sources/blob?id='+encodeURIComponent(id),upstream),{redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
    if(response.status!==200)return fail(409,'The reviewed photograph is unavailable.');
    const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>32*1024*1024)return fail(413,'The reviewed photograph exceeds its byte limit.');chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);
    if(createHash('sha256').update(bytes).digest('hex')!==hash)return fail(409,'The reviewed photograph bytes changed.');
    const type=response.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(type))return fail(415,'The reviewed photograph type is unsupported.');
    res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'X-Content-Sha256':hash});return res.end(req.method==='HEAD'?undefined:bytes);
   }catch{return fail(502,'The reviewed photograph could not be read.');}
  }
  if(pathname==='/api/source-sessions/translation-review'){
   if(!['GET','HEAD'].includes(req.method)){req.resume();res.setHeader('Allow','GET, HEAD');return fail(405,'Saved English proposals are read-only.');}
   const query=new URL(req.url,upstream).searchParams,keys=['sessionId','expectedRevision','expectedSourceHash'];
   if([...query.keys()].length!==keys.length||keys.some(k=>query.getAll(k).length!==1)||!query.get('sessionId')?.trim()||query.get('sessionId').length>160||! /^(0|[1-9][0-9]*)$/.test(query.get('expectedRevision'))||!Number.isSafeInteger(Number(query.get('expectedRevision')))||! /^[a-f0-9]{64}$/i.test(query.get('expectedSourceHash')||''))return fail(400,'Use the selected conversation and its exact current revision.');
  }
  const translationPath=pathname===TRANSLATION_PROPOSAL_PATH;
  if(translationPath){
   if(req.url!==pathname){req.resume();return fail(400,'Use the exact translation proposal path without a query.');}
   if(req.method!=='POST'){req.resume();res.setHeader('Allow','POST');return fail(405,'Translation proposals require an explicit POST.');}
   if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'){req.resume();return fail(403,'Translation proposals must originate from this exact local review page.');}
   if(!translationEnabled){req.resume();res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({state:'unavailable',gate:'kept-conversation-execution-disabled',message:'English proposals are not enabled for this review.',applied:false,proposals:[]}));}
  }
  const translationProposal=translationPath&&translationEnabled;
  const guidanceCorrection=actualWorkReview&&(studyDraftCorrections||magazineDraftCorrections)&&pathname==='/api/guidance'&&req.method==='POST';
  if(guidanceCorrection&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-ar-actor']!=='human:adrian')){req.resume();return fail(403,'Guidance edits require the author’s exact local workspace.');}
  const magazineExport=actualWorkReview&&pathname==='/api/magazine/working-draft/export'&&req.method==='POST';
  if(magazineExport&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site')){req.resume();return fail(403,'Exports must originate from this exact local workspace.');}
  const mechanicalPath=pathname==='/api/magazine/mechanical-check';
  if(mechanicalPath&&['GET','HEAD'].includes(req.method)){
   const query=new URL(req.url,upstream).searchParams,keys=['parentStudyId','storyId','pieceId','checkId'];if([...query.keys()].some(k=>!keys.includes(k))||keys.some(k=>query.getAll(k).length>1)||keys.slice(0,3).some(k=>query.getAll(k).length!==1))return fail(400,'Use one exact saved check owner.');
  }
  const mechanicalCheck=mechanicalPath&&magazineCheckReceipts&&req.method==='POST';
  if(mechanicalCheck){if(req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian'){req.resume();return fail(403,'Saved checks require the author’s local workspace.');}if(req.url!==pathname)return fail(400,'Use the exact check path without a query.');if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'){req.resume();return fail(403,'Checks must originate from this exact local review page.');}}
  const nativeReviewPath=NATIVE_EDITION_PATHS.has(pathname)||pathname==='/api/study-draft/check',nativeReviewEnabled=actualWorkReview&&studyDraftCorrections&&(nativeCarouselCorrections||nativeOutputExports&&pathname==='/api/study/outputs/export');
  if(nativeReviewPath&&nativeReviewEnabled&&req.method!=='GET'&&req.method!=='HEAD'){
   if(req.url!==pathname){req.resume();return fail(400,'Use the exact native output operation path without a query.');}
   if(req.method!=='POST'){req.resume();return fail(405,'Native output operations require an explicit POST.');}
   if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-ar-actor']!==undefined&&requestActor!=='human:adrian'&&pathname!=='/api/study/outputs/export'){req.resume();return fail(403,'Native output operations require the author’s exact local workspace.');}
  }
  const nativeReview=nativeReviewEnabled&&nativeReviewPath&&req.method==='POST';
  const articleCompositionPath=actualWorkReview&&studyDraftCorrections&&nativeArticleComposition&&pathname==='/api/study/outputs/save';
  const correctionPath=SOURCE_CORRECTION_PATHS.has(pathname);
  const draftCorrectionPath=STUDY_DRAFT_CORRECTION_PATHS.has(pathname);
  const magazineCorrectionPath=MAGAZINE_DRAFT_CORRECTION_PATHS.has(pathname);
  const carouselCorrectionPath=NATIVE_CAROUSEL_PATHS.has(pathname);
  const magazineFeedbackPath=MAGAZINE_FEEDBACK_CORRECTION_PATHS.has(pathname);
  if(correctionPath&&sourceCorrections||draftCorrectionPath&&studyDraftCorrections||magazineCorrectionPath&&magazineDraftCorrections||magazineFeedbackPath&&magazineFeedbackCorrections||carouselCorrectionPath&&nativeCarouselCorrections||articleCompositionPath){
   if(req.url!==pathname)return fail(400,'Use the exact correction path without a query.');
   if(req.method!=='POST'){req.resume();res.setHeader('Allow','POST');return fail(405,'Corrections require an explicit POST.');}
   if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'){req.resume();return fail(403,'Corrections must originate from this exact local review page.');}
  }
  const sourceCorrection=sourceCorrections&&correctionPath&&req.method==='POST';
  const draftCorrection=studyDraftCorrections&&draftCorrectionPath&&req.method==='POST';
  const magazineCorrection=magazineDraftCorrections&&magazineCorrectionPath&&req.method==='POST';
  const carouselCorrection=(nativeCarouselCorrections&&carouselCorrectionPath||articleCompositionPath)&&req.method==='POST';
  if(carouselCorrection&&['/api/study/outputs/stand-in-review-words','/api/study/outputs/stand-in-save','/api/study/outputs/stand-in-refresh'].includes(pathname)&&!AGENT_ACTORS.includes(requestActor)){req.resume();return fail(403,'Test-copy stand-ins require the actual agent actor.');}
  const nativeSave=carouselCorrection&&pathname==='/api/study/outputs/save';let nativeArticleSave=false,nativeCarouselExportDeadline=null;
  if(nativeSave&&req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian'){req.resume();return fail(403,'Saved composition changes require the author’s exact local workspace.');}
  const magazineFeedbackCorrection=magazineFeedbackCorrections&&magazineFeedbackPath&&req.method==='POST';
  if(magazineFeedbackCorrection&&req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian'){req.resume();return fail(403,'Feedback wording changes require the author’s local workspace.');}
  if(magazineCorrection&&req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian'){req.resume();return fail(403,'Photo and manuscript changes require the author’s local workspace.');}
  const studyPrepare=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study-ai/prepare'&&req.method==='POST',openingAccept=actualWorkReview&&studyDraftCorrections&&studyDraftApprovals&&pathname==='/api/study-ai/accept'&&req.method==='POST';
  if(studyPrepare||openingAccept){if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian'&&!(studyPrepare&&AGENT_ACTORS.includes(req.headers['x-ar-actor']))){req.resume();return fail(403,'Opening preparation and human choice require the exact local author workspace.');}}
  const carouselProposalMatch=pathname.match(/^\/api\/shared-carousels\/requests\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/(review|accept|reject)$/),carouselProposalPrepare=pathname==='/api/shared-carousels/prepare',carouselProposalDecision=carouselProposalMatch&&['accept','reject'].includes(carouselProposalMatch[2]),carouselProposalPath=carouselProposalPrepare||!!carouselProposalMatch;
  const carouselProposalGranted=actualWorkReview&&studyDraftCorrections&&nativeCarouselCorrections&&(!carouselProposalDecision||studyDraftApprovals),carouselProposal=carouselProposalGranted&&carouselProposalPath&&req.method==='POST';
  if(carouselProposal&& (req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian')){req.resume();return fail(403,'Carousel proposal review requires the author’s exact local workspace.');}
  if(pathname.startsWith('/api/shared-carousels')&&!['GET','HEAD'].includes(req.method)&&!carouselProposal){req.resume();return fail(423,'This Carousel proposal operation is unavailable in this review.');}
  const photoAlbumCorrection=actualWorkReview&&libraryFolderCorrections&&typeof changePhotoAlbums==='function'&&pathname==='/api/magazine/library-photos/album'&&!['GET','HEAD'].includes(req.method);
  const folderCorrection=actualWorkReview&&libraryFolderCorrections&&pathname==='/api/library/folders'&&!['GET','HEAD'].includes(req.method);
  if(folderCorrection||photoAlbumCorrection){
   if(req.url!==pathname){req.resume();return fail(400,'Use the exact Library folder path without a query.');}
   if(req.method!=='POST'){req.resume();return fail(405,'Folder changes require an explicit POST.');}
   if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-ar-actor']!==undefined&&req.headers['x-ar-actor']!=='human:adrian'){req.resume();return fail(403,'Folder changes require the author’s exact local workspace.');}
  }
  const sourcedAction=pathname.match(/^\/api\/magazine\/working-draft\/ai\/(run|propose|accept|reject)$/)?.[1];
  const sourcedCorrection=actualWorkReview&&magazineDraftCorrections&&!!sourcedAction&&req.method==='POST';
  if(sourcedCorrection&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||sourcedAction!=='propose'&&requestActor!=='human:adrian')){req.resume();return fail(403,'Sourced writing requires the exact local workspace; only the author requests or decides proposals.');}
  const directionPath=['/api/study/human-direction/write','/api/study/human-direction/undo'].includes(pathname);
  const directionCorrection=actualWorkReview&&studyDraftCorrections&&directionPath&&req.method==='POST';
  if(directionCorrection&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||requestActor!=='human:adrian')){req.resume();return fail(403,'Direction changes require the author’s exact local workspace and path.');}
  const shareCorrection=actualWorkReview&&(studyDraftCorrections||magazineDraftCorrections)&&['/api/study/share/save','/api/study/share/fact','/api/study/share/undo'].includes(pathname)&&req.method==='POST';
  if(shareCorrection&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||requestActor!=='human:adrian')){req.resume();return fail(403,'Share preparation requires the author’s exact local workspace and path.');}
  const recordingRetryMatch=pathname.match(/^\/transcription\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/(retry|start)$/i);
  const recordingRetry=actualWorkReview&&studyDraftCorrections&&!!recordingRetryMatch&&req.method==='POST';
  if(recordingRetry&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-ar-actor']!=='human:adrian')){req.resume();return fail(403,'Retry requires the author’s exact local workspace.');}
  const structureTestCopy=actualWorkReview&&studyDraftCorrections&&['/api/study/structure-tests','/api/study/structure-tests/review-mark'].includes(pathname)&&req.method==='POST';
  if(structureTestCopy&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!AGENT_ACTORS.includes(req.headers['x-ar-actor']))){req.resume();return fail(403,'Structure-test copying requires an explicit agent in this local workspace.');}
  const proposalContract=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study-ai/human-contract'&&req.method==='POST',standInContract=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study/structure-tests/proposal-contract'&&req.method==='POST';
  if((proposalContract||standInContract)&&(standInContract&&req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||(standInContract?!AGENT_ACTORS.includes(req.headers['x-ar-actor']):req.headers['x-ar-actor']!=='human:adrian'))){req.resume();return fail(403,'Use the exact local author or registered test-copy contract.');}
  const sourcedRun=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study-ai/run'&&req.method==='POST',standInProposal=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study/structure-tests/proposal-review'&&req.method==='POST';
  if((sourcedRun||standInProposal)&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!(['human:adrian',...AGENT_ACTORS].includes(req.headers['x-ar-actor']))||standInProposal&&!AGENT_ACTORS.includes(req.headers['x-ar-actor']))){req.resume();return fail(403,'Use an explicit actor in this exact local workspace.');}
  const nativeResearch=actualWorkReview&&studyDraftCorrections&&['/api/study/research/prepare','/api/study/research/run','/api/study/research/keep','/api/study/research/brief/prepare','/api/study/research/brief/run','/api/study/research/brief/reinspect','/api/study/structure-tests/research-note'].includes(pathname)&&req.method==='POST';
  if(nativeResearch&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!['human:adrian',...AGENT_ACTORS].includes(req.headers['x-ar-actor'])||pathname.endsWith('/research-note')&&!AGENT_ACTORS.includes(req.headers['x-ar-actor']))){req.resume();return fail(403,'Use an explicit actor and exact local Research scope.');}
  const nativeStandInCreatePath=pathname==='/api/study/outputs/stand-in-create',nativeStandInCreateEnabled=actualWorkReview&&studyDraftCorrections&&nativeCarouselCorrections;
  if(nativeStandInCreatePath&&nativeStandInCreateEnabled){if(req.url!==pathname){req.resume();return fail(400,'Use the exact test-copy creation path.');}if(req.method!=='POST'){req.resume();return fail(405,'Test-copy creation requires POST.');}if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!AGENT_ACTORS.includes(req.headers['x-ar-actor'])){req.resume();return fail(403,'Test-copy creation requires the actual local agent actor.');}}
  const nativeStandInCreate=nativeStandInCreatePath&&nativeStandInCreateEnabled&&req.method==='POST';
  const nativeMaterialAttach=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study/material/attach'&&req.method==='POST';
  const nativeFootage=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study/footage/ranges'&&req.method==='POST';
  const nativeVisualReview=actualWorkReview&&studyDraftCorrections&&nativeOutputExports&&['/api/study/outputs/visual-review','/api/study/structure-tests/visual-review'].includes(pathname)&&req.method==='POST';
  if((nativeMaterialAttach||nativeFootage||nativeVisualReview)&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!['human:adrian',...AGENT_ACTORS].includes(req.headers['x-ar-actor']))){req.resume();return fail(403,'Use an explicit actor and exact local media review scope.');}
  const nativeDirection=actualWorkReview&&studyDraftCorrections&&pathname==='/api/study/direction-decision'&&req.method==='POST';
  if(nativeDirection&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!['human:adrian',...AGENT_ACTORS].includes(req.headers['x-ar-actor']))){req.resume();return fail(403,'Use an explicit actor in this exact Direction workspace.');}
  const languageAction=/^\/api\/(?:study\/language|source-language)\/(?:requests|capabilities|prepare|run|review|accept|reject|stand-in-accept|stand-in-reject)$/.test(pathname),transcriptAction=/^\/api\/source-transcript\/(?:terms\/(?:preview|propose)|candidate\/(?:compare|propose|prepare|start|review))$/.test(pathname);
  const languageEnabled=actualWorkReview&&(pathname.startsWith('/api/study/language/')?studyDraftCorrections:sourceCorrections);
  const languageCorrection=(languageAction&&languageEnabled||transcriptAction&&actualWorkReview&&sourceCorrections)&&req.method==='POST';
  if(languageCorrection&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||!['human:adrian',...AGENT_ACTORS].includes(requestActor)||pathname.includes('/stand-in-')&&!AGENT_ACTORS.includes(requestActor)||/\/(accept|reject)$/.test(pathname)&&requestActor!=='human:adrian')){req.resume();return fail(403,'Use the actual local actor and exact saved language scope.');}
  const recordingSource=actualWorkReview&&studyDraftCorrections&&req.method==='POST'&&pathname==='/api/recordings/source';
  if(recordingSource&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||requestActor!=='human:adrian')){req.resume();return fail(403,'Use the author’s exact local recording.');}
  const sourceIntake=actualWorkReview&&studyDraftCorrections&&req.method==='POST'&&pathname==='/api/sources/import',topicCorrection=actualWorkReview&&libraryFolderCorrections&&req.method==='POST'&&pathname==='/api/library/topics';
  if((sourceIntake||topicCorrection)&&(req.url!==pathname||req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'||requestActor!=='human:adrian')){req.resume();return fail(403,'Use the author’s exact local Library.');}
  const correction=recordingSource||sourceIntake||topicCorrection||languageCorrection||nativeStandInCreate||nativeFootage||nativeVisualReview||nativeDirection||nativeResearch||proposalContract||standInContract||sourcedRun||standInProposal||structureTestCopy||shareCorrection||recordingRetry||sourcedCorrection||directionCorrection||photoAlbumCorrection||folderCorrection||carouselProposal||studyPrepare||openingAccept||guidanceCorrection||sourceCorrection||draftCorrection||magazineCorrection||magazineFeedbackCorrection||carouselCorrection||mechanicalCheck||magazineExport||nativeReview;
  const postRead=req.method==='POST'&&postReads.has(pathname);
  if(!['GET','HEAD'].includes(req.method)&&!postRead&&!correction&&!translationProposal){req.resume();res.setHeader('Allow','GET, HEAD');return fail(423,'This is a read-only review. Changes, saves and execution are unavailable here.');}
  try{
   const readBody=postRead||correction||translationProposal?await readJSON(req,{correction:correction||translationProposal,maxBytes:sourceIntake?90*1024*1024:magazineExport||nativeReview&&pathname==='/api/study/outputs/export'?NATIVE_EXPORT_REQUEST:MAX_READ_BODY}):null;
   if(nativeStandInCreate)validateNativeReview(pathname,readBody);
   if(nativeMaterialAttach){const input=JSON.parse(readBody.toString('utf8')),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);if(!input||Object.keys(input).sort().join(',')!=='bindingId,operationId,parentStudyId,sourceIds'||!uuid(input.bindingId)||!uuid(input.operationId)||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId)||!Array.isArray(input.sourceIds)||!input.sourceIds.length||input.sourceIds.length>100||new Set(input.sourceIds).size!==input.sourceIds.length||input.sourceIds.some(id=>!uuid(id)))throw Object.assign(Error('Attach exact retained Library sources to the current native subject.'),{status:400});}
   if(nativeFootage){
    const input=JSON.parse(readBody.toString('utf8')),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),keys=['bindingId','parentStudyId','operationId','expected','sourceId','sourceHash','metadataHash','inTicks','outTicks','label','decision','rangeId'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k))||!uuid(input.bindingId)||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId)||!uuid(input.operationId)||!uuid(input.sourceId)||input.rangeId!==undefined&&!uuid(input.rangeId)||!hash(input.sourceHash)||!hash(input.metadataHash)||!input.expected||Object.keys(input.expected).sort().join(',')!=='hash,revision'||!hash(input.expected.hash)||!Number.isSafeInteger(input.expected.revision)||input.expected.revision<0||!Number.isSafeInteger(input.inTicks)||!Number.isSafeInteger(input.outTicks)||input.outTicks<=input.inTicks||typeof input.label!=='string'||input.label.length>500||/[\x00-\x1f\x7f]/.test(input.label)||!['proposed','keep','check','reject'].includes(input.decision))throw Object.assign(Error('Choose one exact original and bounded saved footage range.'),{status:400});
   }
   if(nativeVisualReview){
    const input=JSON.parse(readBody.toString('utf8')),standIn=pathname.includes('/structure-tests/'),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),keys=['rootBindingId','parentStudyId','selectedOutputId','exportId','operationId','expectedOutput','expectedManifestHash','reviewedFiles',...standIn?[]:['humanDecision']];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!==keys.sort().join(',')||!['rootBindingId','selectedOutputId','exportId','operationId'].every(k=>uuid(input[k]))||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId)||!hash(input.expectedManifestHash)||!input.expectedOutput||Object.keys(input.expectedOutput).sort().join(',')!=='hash,revision'||!hash(input.expectedOutput.hash)||!Number.isSafeInteger(input.expectedOutput.revision)||!Array.isArray(input.reviewedFiles)||!input.reviewedFiles.length||input.reviewedFiles.length>102||input.reviewedFiles.some(f=>!f||Object.keys(f).sort().join(',')!=='hash,name'||!hash(f.hash)||typeof f.name!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,199}$/.test(f.name))||standIn&&!AGENT_ACTORS.includes(req.headers['x-ar-actor'])||!standIn&&(req.headers['x-ar-actor']!=='human:adrian'||input.humanDecision!==true))throw Object.assign(Error('Review the exact exported files with an attributed decision.'),{status:400});
   }
   if(nativeDirection){
    const input=JSON.parse(readBody.toString('utf8')),object=v=>v&&typeof v==='object'&&!Array.isArray(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),string=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v),hash=v=>/^[a-f0-9]{64}$/.test(v||''),keys=['parentStudyId','bindingId','operationId','expectedRevision','expectedHash','target','kind','action','optionId','text','reason','source'],bad=()=>{throw Object.assign(Error('Choose one exact saved Direction target, source and revision.'),{status:400});};
    if(!object(input)||Object.keys(input).some(k=>!keys.includes(k))||!string(input.parentStudyId,256)||!input.parentStudyId.trim()||!uuid(input.bindingId)||!uuid(input.operationId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!hash(input.expectedHash)||!['angle','title'].includes(input.kind)||!['use','reject','inherit','not-applicable'].includes(input.action)||!object(input.target))bad();
    const target=input.target;if(target.kind==='subject'){if(Object.keys(target).join(',')!=='kind'||!['use','reject'].includes(input.action))bad();}else if(target.kind==='native'){if(Object.keys(target).sort().join(',')!=='bindingId,kind'||!uuid(target.bindingId))bad();}else if(target.kind==='output'){if(Object.keys(target).sort().join(',')!=='kind,outputId'||!string(target.outputId,256)||!target.outputId.trim())bad();}else bad();
    if(input.reason!==undefined&&!string(input.reason,2048)||input.action==='reject'&&!input.reason?.trim())bad();
    if(['use','reject'].includes(input.action)){if(!new RegExp('^'+input.kind+':[1-9][0-9]{0,3}$').test(input.optionId||'')||input.text!==undefined&&(!string(input.text,2048)||!input.text.trim())||!object(input.source)||Object.keys(input.source).sort().join(',')!=='artifactId,hash'||!string(input.source.artifactId,512)||!input.source.artifactId.trim()||!hash(input.source.hash))bad();}else if(['optionId','text','source'].some(k=>Object.hasOwn(input,k)))bad();
    if(AGENT_ACTORS.includes(req.headers['x-ar-actor'])&&!input.parentStudyId.startsWith('structure-test-'))throw Object.assign(Error('Agent Direction stand-ins are confined to a registered test copy.'),{status:403});
   }
   if(nativeResearch){
    const input=JSON.parse(readBody.toString('utf8')),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),note=pathname.endsWith('/research-note'),brief=pathname.includes('/brief/'),prepare=pathname.endsWith('/prepare'),keys=note?['bindingId','parentStudyId','operationId','expectedRevision','expectedHash','kind','pointId','title','text','origin']:prepare?['bindingId','parentStudyId','question','sourceIds','cardIds',...(brief?['operationId','sourceReviews','humanDecision']:[])]:['bindingId','parentStudyId',...(brief?['requestId','operationId']:['id'])],human=req.headers['x-ar-actor']==='human:adrian';
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k))||!uuid(input.bindingId)||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId)||note&&(!input.parentStudyId.startsWith('structure-test-')||!uuid(input.operationId)||!Number.isSafeInteger(input.expectedRevision)||!hash(input.expectedHash)||!['question','note'].includes(input.kind)||typeof input.text!=='string'||!input.text.trim()||input.text.length>16384||typeof input.title!=='string'||typeof input.pointId!=='string')||prepare&&(typeof input.question!=='string'||!input.question.trim()||input.question.length>10240||!Array.isArray(input.sourceIds)||!input.sourceIds.length||input.sourceIds.length>100||new Set(input.sourceIds).size!==input.sourceIds.length||input.sourceIds.some(v=>!uuid(v))||input.cardIds!==undefined&&(!Array.isArray(input.cardIds)||input.cardIds.length>100||input.cardIds.some(v=>typeof v!=='string'||!v||v.length>128)))||brief&&(!uuid(input.operationId)||prepare&&(input.cardIds!==undefined||(human?(input.humanDecision!==true||!Array.isArray(input.sourceReviews)||input.sourceReviews.length!==input.sourceIds.length||input.sourceReviews.some(v=>!v||Object.keys(v).sort().join(',')!=='hash,sourceId'||!uuid(v.sourceId)||!hash(v.hash))):input.humanDecision!==undefined||input.sourceReviews!==undefined)))||!note&&!prepare&&!uuid(input[brief?'requestId':'id']))throw Object.assign(Error('Use one exact Research request and current note guards.'),{status:400});
   }
   if(proposalContract||standInContract){
    if(proposalContract){const query=new URL(req.url,upstream).searchParams;if([...query.keys()].some(key=>!['bindingId','parentStudyId'].includes(key))||['bindingId','parentStudyId'].some(key=>query.getAll(key).length!==1)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(query.get('bindingId')||'')||!query.get('parentStudyId')||query.get('parentStudyId').length>256||/[\x00-\x1f\x7f]/.test(query.get('parentStudyId')))throw Object.assign(Error('Choose one exact writing constraint scope.'),{status:400});}
    const input=JSON.parse(readBody.toString('utf8')),kinds={protect:['expected','paragraphId','seenBlockHash','from','to','text'],'release-protection':['protectionId'],'override-rejection':['rejectedRequestId'],'restore-rejection':['rejectedRequestId'],'set-piece-guidance':['key','body'],'clear-piece-guidance':['key']},base=['kind','operationId','expectedContractHash','reason',...(standInContract?['bindingId','parentStudyId']:['humanDecision'])],uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
    if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(kinds,input.kind)||Object.keys(input).some(key=>![...base,...kinds[input.kind]].includes(key))||!uuid(input.operationId)||!/^[a-f0-9]{64}$/.test(input.expectedContractHash||'')||standInContract&&(!uuid(input.bindingId)||typeof input.parentStudyId!=='string'||!input.parentStudyId.startsWith('structure-test-'))||proposalContract&&input.humanDecision!==true)throw Object.assign(Error('Use one exact writing constraint and current contract revision.'),{status:400});
   }
   if(sourcedRun||standInProposal){
    const input=JSON.parse(readBody.toString('utf8')),allowed=sourcedRun?['bindingId','parentStudyId','requestId','operationId']:['bindingId','parentStudyId','requestId','operationId','action','reason'],uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key))||!['bindingId','requestId','operationId'].every(key=>uuid(input[key]))||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId)||standInProposal&&(!['accept','reject'].includes(input.action)||input.reason!==undefined&&(input.action!=='reject'||typeof input.reason!=='string'||input.reason.length>2000)))throw Object.assign(Error('Use the exact prepared request and local decision.'),{status:400});
   }
   if(structureTestCopy&&pathname.endsWith('/review-mark')){
    const input=JSON.parse(readBody.toString('utf8')),keys=['bindingId','parentStudyId','expected','operationId','id','rawFrom','rawTo','seenBlockHash','seenMarkupHash'],uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
    if(!input||Array.isArray(input)||Object.keys(input).sort().join('|')!==keys.sort().join('|')||!uuid(input.bindingId)||!uuid(input.operationId)||typeof input.parentStudyId!=='string'||!input.parentStudyId.startsWith('structure-test-')||typeof input.id!=='string'||!input.id||!input.expected||Array.isArray(input.expected)||typeof input.expected!=='object'||!Number.isSafeInteger(input.rawFrom)||!Number.isSafeInteger(input.rawTo)||input.rawFrom<0||input.rawTo<=input.rawFrom||!hash(input.seenBlockHash)||!hash(input.seenMarkupHash))throw Object.assign(Error('Use one exact copied markup span and current revision for stand-in review.'),{status:400});
   }
   if(structureTestCopy&&pathname==='/api/study/structure-tests'){
    const input=JSON.parse(readBody.toString('utf8')),allowed=['sourceBindingId','sourceParentStudyId','expected','title','operationId'],uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
    if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).length!==allowed.length||Object.keys(input).some(key=>!allowed.includes(key))||!uuid(input.sourceBindingId)||!uuid(input.operationId)||typeof input.sourceParentStudyId!=='string'||!input.sourceParentStudyId.trim()||input.sourceParentStudyId.length>256||typeof input.title!=='string'||!input.title.trim()||input.title.length>256||/[\x00-\x1f\x7f]/.test(input.title)||!input.expected||Array.isArray(input.expected)||typeof input.expected!=='object')throw Object.assign(Error('Use the exact saved source, title and operation for a structure-test copy.'),{status:400});
   }
   if(shareCorrection){
    const input=JSON.parse(readBody.toString('utf8')),magazine=input?.ownerKind==='magazine',base=magazine?['ownerKind','storyId','pieceId','expectedWorkingHash','parentStudyId','selectedOutputId','recipientId']:['rootBindingId','parentStudyId','selectedOutputId','recipientId'],extra=pathname.endsWith('/save')?'changes':pathname.endsWith('/fact')?'fact':'undoOperationId',allowed=[...base,'targetEdition','expected','expectedEdition','operationId',extra],uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
    const bad=()=>{throw Object.assign(Error('Use exact registered Share identities, current record revision and one explicit preparation action.'),{status:400});};
    if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).some(k=>!allowed.includes(k))||base.some(k=>!Object.hasOwn(input,k))||!uuid(input.operationId)||!hash(input.expectedEdition)||!input.expected||Object.keys(input.expected).sort().join(',')!=='hash,revision'||!hash(input.expected.hash)||!Number.isSafeInteger(input.expected.revision)||input.expected.revision<0||!Object.hasOwn(input,extra))bad();
    if(magazine?input.ownerKind!=='magazine'||!hash(input.expectedWorkingHash)||!['storyId','pieceId'].every(k=>typeof input[k]==='string'&&/^[A-Za-z0-9:_-]{1,256}$/.test(input[k]))||input.selectedOutputId!=='magazine-working:'+input.storyId+':'+input.pieceId:!uuid(input.rootBindingId)||!uuid(input.selectedOutputId))bad();
    if(typeof input.parentStudyId!=='string'||!input.parentStudyId||input.parentStudyId.length>256||!(uuid(input.recipientId)||input.recipientId==='none')||input.targetEdition!==undefined&&!hash(input.targetEdition))bad();
    const selector=Object.fromEntries([...base,...(input.targetEdition!==undefined?['targetEdition']:[])].map(k=>[k,input[k]])),proof=await ownedStudyRead(upstream,timeoutMs,'/api/study/share?'+new URLSearchParams(selector),{preserveRefusal:true});
    if(proof?.schema!=='ar-create.share-preparation.v1'||proof.identity?.parentStudyId!==input.parentStudyId||proof.identity?.outputId!==input.selectedOutputId||proof.identity?.recipientId!==input.recipientId||proof.currentEdition!==input.expectedEdition||magazine&&(proof.identity.ownerKind!=='magazine'||proof.identity.storyId!==input.storyId||proof.identity.pieceId!==input.pieceId)||!magazine&&proof.identity.rootBindingId!==input.rootBindingId)throw Object.assign(Error('The exact selected piece or Share edition changed.'),{status:409});
   }
   if(recordingSource){const input=JSON.parse(readBody.toString('utf8'));if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='expected,jobId,operationId'||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i).test(input.jobId||'')||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i).test(input.operationId||'')||!input.expected||Array.isArray(input.expected)||typeof input.expected!=='object')throw Object.assign(Error('Use one exact saved recording and its current proof.'),{status:400});}
   if(sourceIntake){const input=JSON.parse(readBody.toString('utf8'));if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['rootId','folder','files','urls'].includes(k))||input.rootId!=='library'||typeof input.folder!=='string'||input.folder.startsWith('/')||input.folder.split(/[\\/]/).includes('..')||/[\x00-\x1f]/.test(input.folder)||!Array.isArray(input.files)||!Array.isArray(input.urls)||input.files.length+input.urls.length<1||input.files.length+input.urls.length>100)throw Object.assign(Error('Import into the owned Library with exact files or URLs.'),{status:400});}
   if(recordingRetry){
    const input=JSON.parse(readBody.toString('utf8'));if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).length)throw Object.assign(Error('Retry accepts only the exact recording path.'),{status:400});
    const catalog=await ownedStudyRead(upstream,timeoutMs,'/api/recordings'),matches=Array.isArray(catalog?.jobs)?catalog.jobs.filter(job=>job?.id===recordingRetryMatch[1]):[];
    if(matches.length!==1||matches[0].state!==(recordingRetryMatch[2]==='start'?'saved':'failed')||recordingRetryMatch[2]==='start'&&catalog.capability?.ready!==true||matches[0].transcriptReady===true||matches[0].reviewStatus==='reviewed')throw Object.assign(Error('This recording changed or already has a transcript. Refresh intake before retrying.'),{status:409});
   }
   if(sourcedCorrection){
    const input=validateSourcedWriting(sourcedAction,JSON.parse(readBody.toString('utf8'))),scope={storyId:input.storyId,pieceId:input.pieceId,edition:input.edition,parentStudyId:input.parentStudyId},decision=['accept','reject'].includes(sourcedAction),query={...scope,...(decision?{proposalId:input.proposalId}:{expectedHash:input.expectedHash})},record=await ownedStudyRead(upstream,timeoutMs,'/api/magazine/working-draft/ai/'+(decision?'proposal':'context')+'?'+new URLSearchParams(query));
    const selection=record.selection;
    if(selection?.storyId!==input.storyId||selection.pieceId!==input.pieceId||selection.edition!=='working'||record.parentStudyId!==input.parentStudyId||record.contextHash!==input.contextHash||decision&&(record.proposalId!==input.proposalId||record.proposalHash!==input.proposalHash)||!decision&&record.draftHash!==input.expectedHash)throw Object.assign(Error('The sourced paragraph or selected piece context changed.'),{status:409});
   }
   if(directionCorrection){
    const input=JSON.parse(readBody.toString('utf8')),undo=pathname.endsWith('/undo'),uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),required=['parentStudyId','scope','expectedRevision','expectedHash','operationId',...(undo?[]:['body'])],allowed=[...required,'expectedMetadataHash',...(undo?['undoOperationId']:[]),...(input?.scope==='part'?['bindingId']:[])],bad=()=>{throw Object.assign(Error('Use the exact saved project or part direction and current revision guards.'),{status:400});};
    if(!input||typeof input!=='object'||Array.isArray(input)||required.some(key=>!Object.hasOwn(input,key))||Object.keys(input).some(key=>!allowed.includes(key))||!['project','part'].includes(input.scope)||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!hash(input.expectedHash)||!uuid(input.operationId)||input.scope==='part'&&!uuid(input.bindingId)||Object.hasOwn(input,'expectedMetadataHash')&&input.expectedMetadataHash!==null&&!hash(input.expectedMetadataHash)||undo&&Object.hasOwn(input,'undoOperationId')&&!uuid(input.undoOperationId)||!undo&&(typeof input.body!=='string'||!input.body.isWellFormed()||Buffer.byteLength(input.body)>1024*1024||input.body.includes('\0')))bad();
    const selector={parentStudyId:input.parentStudyId,scope:input.scope,...(input.scope==='part'?{bindingId:input.bindingId}:{})},record=await ownedStudyRead(upstream,timeoutMs,'/api/study/human-direction?'+new URLSearchParams(selector));
    const replay=record.history?.some(op=>op.operationId===input.operationId&&op.status==='committed'&&op.kind===(undo?'undo':'write')&&op.before?.revision===input.expectedRevision&&op.before?.hash===input.expectedHash&&(undo?input.undoOperationId===undefined||input.undoOperationId===op.undoOperationId:op.after?.body===input.body));
    if(record.bound!==true||record.scope?.kind!==input.scope||record.scope.parentStudyId!==input.parentStudyId||input.scope==='part'&&record.scope.bindingId!==input.bindingId||!uuid(record.scope.projectId)||record.externalEdit||!replay&&(record.revision!==input.expectedRevision||record.hash!==input.expectedHash||Object.hasOwn(input,'expectedMetadataHash')&&record.metadataHash!==input.expectedMetadataHash))throw Object.assign(Error('The saved direction changed. Preserve your words and reload the current record.'),{status:409});
   }
   if(folderCorrection||photoAlbumCorrection){const value=await (photoAlbumCorrection?changePhotoAlbums:changeLibraryFolders)(JSON.parse(readBody.toString('utf8')),{actor:requestActor,client:'ui'}),bytes=Buffer.from(JSON.stringify(value));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});return res.end(bytes);}
   if(carouselProposal){
    const q=new URL(req.url,upstream).searchParams,keys=['projectId','documentId','outputId'],uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),closed=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key)),bad=message=>{throw Object.assign(Error(message||'Choose one exact native Carousel proposal and owner.'),{status:400});},held=()=>{throw Object.assign(Error('The exact native Carousel proposal or saved words owner changed.'),{status:409});};
    if([...q.keys()].some(key=>!keys.includes(key))||keys.some(key=>q.getAll(key).length!==1||!uuid(q.get(key))))bad();
    const tuple=Object.fromEntries(keys.map(key=>[key,q.get(key)])),input=JSON.parse(readBody.toString('utf8')),scopeKeys=['rootBindingId','parentStudyId',...keys];let scope;
    if(carouselProposalPrepare){
     if(!closed(input,[...scopeKeys,'selectedOutputId'])||!uuid(input.rootBindingId)||input.selectedOutputId!==tuple.outputId||keys.some(key=>input[key]!==tuple[key])||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId))bad();scope=Object.fromEntries(scopeKeys.map(key=>[key,input[key]]));
    }else{
     if(carouselProposalDecision){if(!closed(input,['requestId','proposalHash','reviewHash','contextHash','wordsIdentity'])||input.requestId!==carouselProposalMatch[1]||['proposalHash','reviewHash','contextHash','wordsIdentity'].some(key=>!sha(input[key])))bad();}
     else if(!closed(input,['raw'])||typeof input.raw!=='string'||!input.raw.isWellFormed()||Buffer.byteLength(input.raw)>1024*1024)bad('Use only complete bounded Carousel review Markdown.');
     const detail=await ownedStudyRead(upstream,timeoutMs,'/api/shared-carousels/requests/'+carouselProposalMatch[1]+'?'+new URLSearchParams(tuple)),record=detail?.request;
     scope=record?.nativeScope;
     if(record?.schema!=='ar-create.shared-carousel-request.v1'||record.id!==carouselProposalMatch[1]||keys.some(key=>record[key]!==tuple[key])||!closed(scope,scopeKeys)||!uuid(scope.rootBindingId)||typeof scope.parentStudyId!=='string'||!scope.parentStudyId.trim()||scope.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(scope.parentStudyId)||keys.some(key=>scope[key]!==tuple[key])||detail.context?.schema!=='ar-create.native-carousel-proposal-context.v1'||!closed(detail.context.nativeScope,scopeKeys)||scopeKeys.some(key=>detail.context.nativeScope[key]!==scope[key])||keys.some(key=>detail.context[key]!==tuple[key]))held();
     if(carouselProposalDecision){
      if(input.proposalHash!==detail.proposal?.rawHash||input.contextHash!==record.context?.hash||input.wordsIdentity!==record.wordsIdentity)held();
      const decision=carouselProposalMatch[2]==='accept'?'accepted':'rejected',terminal=['accepted','rejected'].includes(detail.status);
      if(terminal){const receipt=detail.receipt;if(receipt?.schema!=='ar-create.shared-carousel-decision.v1'||receipt.requestId!==record.id||receipt.decision!==decision||keys.some(key=>receipt[key]!==tuple[key])||!closed(receipt.binding,Object.keys(input))||Object.keys(input).some(key=>receipt.binding[key]!==input[key]))held();}
      else if(!['pending','stale'].includes(detail.status)||carouselProposalMatch[2]==='accept'&&(detail.status!=='pending'||detail.freshness?.ok!==true))held();
     }
    }
    const view=await nativeOutputSnapshot(upstream,timeoutMs,{...scope,selectedOutputId:tuple.outputId});
    if(view?.scope?.rootBindingId!==scope.rootBindingId||view.scope.parentStudyId!==scope.parentStudyId||view.output?.id!==tuple.outputId||view.output.kind!=='carousel'||view.photoScope?.projectId!==tuple.projectId||view.photoScope.documentId!==tuple.documentId||view.wordOwner?.kind!=='carousel-words'||view.writingProof?.kind!=='carousel-words'||keys.some(key=>view.wordOwner[key]!==tuple[key]||view.writingProof[key]!==tuple[key]))held();
   }
   if(studyPrepare||openingAccept){
    const q=new URL(req.url,upstream).searchParams,scope={bindingId:q.get('bindingId'),parentStudyId:q.get('parentStudyId')},uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),input=JSON.parse(readBody.toString('utf8')),bad=()=>{throw Object.assign(Error('Use the exact owned part and closed opening request.'),{status:400});};
    if([...q.keys()].some(k=>!['bindingId','parentStudyId'].includes(k))||['bindingId','parentStudyId'].some(k=>q.getAll(k).length!==1)||!uuid(scope.bindingId)||typeof scope.parentStudyId!=='string'||!scope.parentStudyId.trim()||scope.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(scope.parentStudyId)||!input||typeof input!=='object'||Array.isArray(input))bad();
    if(studyPrepare){
     if(Object.keys(input).some(k=>!['sourceIds','answerIds','purpose','openingRequestId','selectedOptionId','instruction'].includes(k))||!Array.isArray(input.sourceIds)||!input.sourceIds.length||input.sourceIds.length>30||new Set(input.sourceIds).size!==input.sourceIds.length||input.sourceIds.some(id=>typeof id!=='string'||!id||id.length>512)||input.answerIds!==undefined&&(!Array.isArray(input.answerIds)||input.answerIds.length>30||new Set(input.answerIds).size!==input.answerIds.length||input.answerIds.some(id=>!uuid(id)))||input.purpose!==undefined&&!['opening-options','article-continuation','sourced-paragraph'].includes(input.purpose))bad();
     if(AGENT_ACTORS.includes(req.headers['x-ar-actor'])&&input.purpose!=='sourced-paragraph')throw Object.assign(Error('Agents may prepare only a sourced paragraph in this review.'),{status:403});
     if(input.purpose==='sourced-paragraph'?(typeof input.instruction!=='string'||!input.instruction.trim()||input.instruction.length>2000||/[\x00-\x1f\x7f]/.test(input.instruction)):input.instruction!==undefined)bad();
     if(input.purpose==='article-continuation'){if(!uuid(input.openingRequestId)||!uuid(input.selectedOptionId))bad();}else if(input.openingRequestId!==undefined||input.selectedOptionId!==undefined)bad();
    }else if(![2,3].includes(Object.keys(input).length)||Object.keys(input).some(k=>!['requestId','operationId','optionId'].includes(k))||!['requestId','operationId'].every(k=>uuid(input[k]))||input.optionId!==undefined&&!uuid(input.optionId))bad();
    const current=await ownedStudyRead(upstream,timeoutMs,'/api/study-draft/read?'+new URLSearchParams(scope));if(current.binding?.id!==scope.bindingId||current.binding.parentStudyId!==scope.parentStudyId||current.binding.authority!=='owned-working-copy'||current.readiness?.ready!==true||!current.expected)throw Object.assign(Error('This exact native part is unavailable or not ready.'),{status:409});
    if(openingAccept){
     const review=await ownedStudyRead(upstream,timeoutMs,'/api/study-ai/review?'+new URLSearchParams({...scope,requestId:input.requestId})),opening=review.purpose==='opening-options'&&Object.keys(input).length===3&&Array.isArray(review.openingOptions)&&review.openingOptions.length>=2&&review.openingOptions.length<=3&&review.openingOptions.some(o=>o.id===input.optionId),continuation=review.purpose==='article-continuation'&&Object.keys(input).length===2&&review.continuation?.schema==='ar-create.native-article-continuation.v1'&&Array.isArray(review.replacements)&&review.replacements.length>=1&&review.replacements.length<=30;
     if(review.id!==input.requestId||!(opening||continuation)||review.status!=='pending'||review.stale!==false||JSON.stringify(review.expected)!==JSON.stringify(current.expected))throw Object.assign(Error('Choose one exact pending current opening or article continuation proposal.'),{status:409});
    }
   }
   if(guidanceCorrection){
    const input=JSON.parse(readBody.toString('utf8')),keys=['key','acceptedRegions','expectedRevision','expectedHash','operationId'];
    if(!input||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||!['voice','positions','recipe'].includes(input.key)||!Array.isArray(input.acceptedRegions)||input.acceptedRegions.length>128||input.acceptedRegions.some(v=>typeof v!=='string')||!['expectedRevision','expectedHash'].every(k=>/^[a-f0-9]{64}$/.test(input[k]||''))||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.operationId||''))throw Object.assign(Error('Use the current shared sheet and its exact guarded text edit.'),{status:400});
   }
   if(postRead&&pathname==='/api/magazine/check'){
    const input=JSON.parse(readBody.toString('utf8')),path=(value,kind)=>typeof value==='string'&&new RegExp('^Workflow/'+(kind==='DEV'?'3-Develop':'1-Source')+'/'+kind+' - [^/]+\\.md$').test(value)&&!/[\\\x00-\x1f]/.test(value)&&!value.split('/').some(p=>p==='.'||p==='..');
    if(req.url!==pathname||!input||Array.isArray(input)||Object.keys(input).length!==3||!path(input.draft,'DEV')||!path(input.source,'SRC')||!Array.isArray(input.context)||input.context.length>64||new Set(input.context).size!==input.context.length||input.context.some(p=>!path(p,'CONTEXT')))throw Object.assign(Error('Use the exact saved draft, explicitly linked transcript and context notes.'),{status:400});
   }
   if(translationProposal){
    const input=validateTranslationProposal(readBody);translationPermissionCurrent?.();
    const current=await translationSnapshot(upstream,timeoutMs),sessions=Array.isArray(current.sessions)?current.sessions.filter(s=>s.id===input.sessionId):[];
    if(sessions.length!==1||!translationPolicy.keptConversations.sourceIds.includes(sessions[0].sourceId))throw Object.assign(Error('This conversation is not approved for account context sharing.'),{status:403});
    if(current.revision!==input.expectedRevision||sessions[0].sourceHash!==input.expectedSourceHash)throw Object.assign(Error('The conversation changed before translation. Refresh its current wording.'),{status:409});
    translationPermissionCurrent?.();admitTranslation();
   }
   if(nativeSave){
    const input=validateNativeReview(pathname,readBody),view=await nativeOutputSnapshot(upstream,timeoutMs,input);
    if(view?.scope?.rootBindingId!==input.rootBindingId||view.scope.parentStudyId!==input.parentStudyId||view.output?.id!==input.selectedOutputId)throw Object.assign(Error('Select this exact saved output before changing its composition.'),{status:409});
    if(articleCompositionPath&&!nativeCarouselCorrections){
     const denied=()=>{throw Object.assign(Error('This connection supports Article layout only; wording and other outputs are unchanged.'),{status:423});};
     if(view.output.kind!=='article'||Object.keys(input.changes).some(k=>!['placements','articleComposition'].includes(k)))denied();
     for(const photo of input.changes.placements||[]){const prior=view.output.placements?.find(row=>row.slot===photo.slot),defaultAlt=photo.slot==='cover'?'Cover photograph':'Article photograph';if((photo.caption||'')!==(prior?.caption||'')||photo.alt!==(prior?.alt??defaultAlt))denied();}
    }
    if(view.output.kind==='article'){
     if(!nativeReviewEnabled&&!articleCompositionPath)throw Object.assign(Error('Native Article composition requires both existing correction grants.'),{status:423});
     if(view.writingProof?.kind!=='native')throw Object.assign(Error('Use the selected Article’s native wording owner.'),{status:409});
     validateNativeReview(pathname,readBody,{articleSave:true,view});nativeArticleSave=true;
    }else if(view.output.kind==='carousel')validateCarouselCorrection(pathname,readBody);
    else throw Object.assign(Error('Only the selected native Article or Carousel composition may change.'),{status:409});
   }
   if(nativeReview){
    const input=validateNativeReview(pathname,readBody);
    if(pathname.endsWith('/refresh')||pathname.endsWith('/export')){
     const view=await nativeOutputSnapshot(upstream,timeoutMs,input),kind=pathname.endsWith('/refresh')?'article':input.kind;
     if(view?.scope?.rootBindingId!==input.rootBindingId||view.scope.parentStudyId!==input.parentStudyId||view.output?.id!==input.selectedOutputId||view.output.kind!==kind||kind==='article'&&view.writingProof?.kind!=='native')throw Object.assign(Error('Select this exact saved native Article or Carousel before continuing.'),{status:409});
     if(pathname.endsWith('/export')&&kind==='carousel'){
      const count=Array.isArray(view.output.slides)?view.output.slides.length:null;
      if(!Number.isSafeInteger(count)||count<1||count>CAROUSEL_EXPORT_MAX_SLIDES)throw Object.assign(Error('Select a saved Carousel with 1–40 slides before exporting.'),{status:409});
      nativeCarouselExportDeadline=nativeCarouselExportTimeoutMs??timeoutMs+count*CAROUSEL_EXPORT_SLIDE_MS;
     }
    }
   }
   if(sourceCorrection)validateCorrection(pathname,readBody);
   if(draftCorrection){validateDraftCorrection(pathname,readBody,{approvals:studyDraftApprovals});if(requestActor!=='human:adrian'&&JSON.parse(readBody).operations?.some(operation=>operation.kind==='approveMark'))return fail(403,'Only the author can approve marked wording.');}
   if(magazineCorrection)validateMagazineCorrection(pathname,readBody);
   if(magazineFeedbackCorrection)validateMagazineFeedbackCorrection(pathname,readBody);
   if(mechanicalCheck)validateMagazineMechanicalCheck(readBody);
   if(carouselCorrection&&!nativeSave)validateCarouselCorrection(pathname,readBody);
   if(actualWorkReview===true&&pathname==='/document-study/package-config.js'){
    const bytes=Buffer.from('window.AR_CREATE_PACKAGE_CONFIG='+JSON.stringify({syntheticFixtures:false,originalReaderBaseUrl:upstream.origin})+';window.AR_CREATE_REVIEW_MODE='+JSON.stringify({actualWork:true,readOnly:true,...(sourceCorrections?{sourceCorrections:true}:{}),...(libraryFolderCorrections?{libraryFolderCorrections:true}:{}),...(translationEnabled?{translationProposals:true}:{}),...(studyDraftCorrections?{studyDraftCorrections:true}:{}),...(studyDraftApprovals?{studyDraftApprovals:true}:{}),...(browserCarouselCorrections?{browserCarouselCorrections:true}:{}),...(nativeCarouselCorrections?{nativeCarouselCorrections:true}:{}),...(magazineDraftCorrections?{magazineDraftCorrections:true}:{}),...(magazineFeedbackCorrections?{magazineFeedbackCorrections:true}:{}),...(magazineCheckReceipts?{magazineCheckReceipts:true}:{}),...(typeof catalogCacheScope==='string'&&/^[a-f0-9]{64}$/.test(catalogCacheScope)?{catalogCacheScope}:{}),authorityOrigin:upstream.origin})+';');
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Content-Length':bytes.length});return res.end(req.method==='HEAD'?undefined:bytes);
   }
   if(!postRead&&overrides.has(pathname)){
    const result=await overrides.get(pathname)({url:new URL(req.url,'http://'+req.headers.host),request:req});
    const status=result?.status??200;if(!Number.isInteger(status)||status<200||status>599||status>=300&&status<400)throw Error('Invalid review read status.');
    if(Buffer.isBuffer(result?.body)){
     if(!['/api/review/media/file','/api/review/magazine-media/file'].includes(pathname)||status!==200||!SAFE_MEDIA_TYPES.has(result.contentType)||result.contentLength!==result.body.length||result.body.length>256*1024*1024||!(/^[a-f0-9]{64}$/).test(result.hash||'')||!(/^[a-f0-9]{64}$/).test(result.revision||''))throw Error('Invalid restricted media response.');
     res.writeHead(200,{'Content-Type':result.contentType,'Content-Length':result.contentLength,'X-Content-SHA256':result.hash,'X-AR-Create-Media-Revision':result.revision});return res.end(req.method==='HEAD'?undefined:result.body);
    }
    const bytes=Buffer.from(JSON.stringify(result?.body??null));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});return res.end(req.method==='HEAD'?undefined:bytes);
   }
   if(!upstreamOnly(pathname)){
    const local=await staticRead(path.resolve(publicDir),pathname)||(/^\/(assets|ig-assets)\//.test(pathname)?await staticRead(path.resolve(runtimePublicDir),pathname):null);
    if(local){res.writeHead(200,{'Content-Type':local.type,'Content-Length':local.bytes.length});return res.end(req.method==='HEAD'?undefined:local.bytes);}
    // The runtime serves generated assets from these two known namespaces.
    if(!/^\/(assets|ig-assets)\//.test(pathname))return fail(404,'This review file is unavailable.');
   }
   const headers={};if(postRead||correction||translationProposal){headers['content-type']='application/json';headers['content-length']=readBody.length;if(req.headers.origin!==undefined)headers.origin=upstream.origin;}for(const key of ['accept','accept-language','range','if-range'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key];if(pathname==='/api/events'&&req.method==='GET'&&/^\d{1,16}$/.test(req.headers['last-event-id']||'')&&Number.isSafeInteger(Number(req.headers['last-event-id'])))headers['last-event-id']=req.headers['last-event-id'];
   if(postRead||correction||translationProposal||req.headers['x-ar-actor']!==undefined){headers['x-ar-actor']=requestActor;headers['x-ar-client']='ui';}
   const pending=http.request(upstream,{method:req.method,path:req.url,headers},owner=>{
    if(owner.statusCode>=300&&owner.statusCode<400){owner.resume();return fail(502,'The existing work authority returned a redirect; review did not follow it.');}
    const selected={};for(const key of ['content-type','content-length','content-range','accept-ranges','content-disposition',...(actualWorkReview===true&&['/api/study/photos/preview','/api/study/photos/available-preview','/api/study/footage/preview'].includes(pathname)?['x-content-sha256']:[]),...(actualWorkReview===true&&pathname==='/api/magazine/library-photos/preview'?['x-content-sha256','x-ar-photo-root-id','x-ar-photo-source-id','x-ar-photo-revision']:[])])if(owner.headers[key]!==undefined)selected[key]=owner.headers[key];
    const eventStream=pathname==='/api/events'&&req.method==='GET'&&owner.statusCode===200&&/^text\/event-stream(?:\s*;|$)/i.test(owner.headers['content-type']||'');
    // The maintained owner heartbeats every20 seconds; ordinary10-second read
    // deadlines must not disconnect a healthy live stream between those beats.
    let retired=false;
    if(eventStream){
     pending.setTimeout(Math.max(timeoutMs,45000));delete selected['content-length'];selected['X-Accel-Buffering']='no';
     const key=JSON.stringify([req.socket.remoteAddress,req.headers.host]),streams=eventStreams.get(key)||new Set();
     const release=()=>{streams.delete(entry);if(!streams.size&&eventStreams.get(key)===streams)eventStreams.delete(key);};
     const entry={retire(){retired=true;release();owner.unpipe(res);res.end();owner.destroy();}};
     while(streams.size>=maxEventStreams)streams.values().next().value.retire();
     streams.add(entry);eventStreams.set(key,streams);
     res.once('close',release);owner.once('close',release);
    }
    res.writeHead(owner.statusCode||502,selected);if(eventStream)res.flushHeaders();
    owner.on('error',()=>{if(!retired)res.destroy();});
    if(req.method==='HEAD'){owner.resume();res.end();}else owner.pipe(res);
   });
   // Rendering and generation have wall deadlines as well as socket inactivity protection.
   const operationDeadline=translationProposal?translationDeadline:nativeCarouselExportDeadline;
   const operationTimer=operationDeadline?setTimeout(()=>pending.destroy(Error('timeout')),operationDeadline):null;
   if(operationTimer)pending.once('close',()=>clearTimeout(operationTimer));
   pending.setTimeout(operationDeadline??timeoutMs,()=>pending.destroy(Error('timeout')));
   pending.on('error',()=>fail(502,translationProposal?'English proposals could not be confirmed. Your source wording is unchanged.':correction?'The existing work authority could not confirm this correction. Keep this operation ID when retrying; reload to check its saved result.':'The existing work authority is unavailable. Your saved work has not changed.'));
   res.on('close',()=>pending.destroy());pending.end(readBody);
  }catch(error){fail(error.status||500,error.status?error.message:'This review could not read the requested file. Your saved work has not changed.');}
 });
 // No WebSocket, tunnel or upgrade can reach the authority.
 const refuse=(_req,socket)=>socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
 server.on('upgrade',refuse);server.on('connect',refuse);
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){if(!['--port','--authority','--authority-port'].includes(args[i])||args[i+1]===undefined)throw Error('Use --port, --authority and --authority-port only.');options[args[i]]=args[i+1];}
 const port=Number(options['--port']||59955);if(!Number.isInteger(port)||port<1||port>65535||[8841,Number(options['--authority-port']||8841)].includes(port))throw Error('Use a separate review port.');
 const server=createReviewConnection({authorityURL:options['--authority']||'http://127.0.0.1:8841',allowedAuthorityPort:Number(options['--authority-port']||8841)});
 server.listen(port,'127.0.0.1',()=>console.log(`Read-only review: http://127.0.0.1:${port}/document-study/index.html`));
}
