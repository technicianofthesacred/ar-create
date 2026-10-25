// A code-only review entrance over one existing loopback authority. No app backend,
// store or private directory is imported or initialized here. Optional human source and manuscript
// corrections forward only to that existing owner; this entrance never owns writes.
import http from 'node:http';
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
const READ_POST_PATHS=new Set(['/api/concept/sources/search','/api/study-draft/inspect','/api/study-draft/history-preview','/api/study/outputs/export-check','/api/work-continuity/read','/api/work-continuity/context','/api/work-continuity/understanding','/api/work-continuity/artifacts']);
const NATIVE_CAROUSEL_PATHS=new Set(['/api/study/outputs/copy-retained-carousel','/api/study/outputs/copy-browser-carousel','/api/study/outputs/save','/api/study/outputs/review-words','/api/study/outputs/undo','/api/study/outputs/undo-words']);
function validateCarouselCorrection(pathname,bytes){
 const input=JSON.parse(bytes.toString('utf8')),object=v=>v&&typeof v==='object'&&!Array.isArray(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),fail=()=>{throw Object.assign(Error('Use the exact saved carousel owner and current revision guards.'),{status:400});};
 const base=['rootBindingId','parentStudyId','expectedOutput','operationId'],copy=pathname.includes('/copy-'),extra=copy?['destinationProjectId','destinationDocumentId','expectedNative',pathname.endsWith('copy-browser-carousel')?'browser':'source']:pathname.endsWith('/save')?['selectedOutputId','changes']:pathname.endsWith('review-words')?['selectedOutputId','expectedWords','wordsHash']:['selectedOutputId','undoOperationId'];
 if(!object(input)||[...base,...extra].some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>![...base,...extra,'expectedNative'].includes(k))||!uuid(input.rootBindingId)||typeof input.parentStudyId!=='string'||!input.parentStudyId||input.parentStudyId.length>160||!uuid(input.operationId)||!object(input.expectedOutput)||!Number.isSafeInteger(input.expectedOutput.revision)||!hash(input.expectedOutput.hash))fail();
 if(copy){if(!uuid(input.destinationProjectId)||!uuid(input.destinationDocumentId)||!object(input.expectedNative)||!object(input.browser||input.source))fail();}
 else{if(!uuid(input.selectedOutputId))fail();if(pathname.endsWith('/save')&&(!object(input.changes)||Object.keys(input.changes).some(k=>!['slides','caption','name'].includes(k))))fail();if(pathname.includes('/undo')&&!uuid(input.undoOperationId))fail();if(pathname.endsWith('review-words')&&(!object(input.expectedWords)||!hash(input.wordsHash)))fail();}
}
const MAX_READ_BODY=1024*1024;
async function readJSON(req,{correction=false}={}){
 const reject=(status,message)=>{throw Object.assign(Error(message),{status});};
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){req.resume();reject(415,'Read requests require application/json.');}
 const length=req.headers['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>MAX_READ_BODY)){req.resume();reject(413,'Read request exceeds the 1 MB limit.');}
 const chunks=[];let size=0;
 const bytes=await new Promise((resolve,rejectBody)=>{
  const onData=chunk=>{size+=chunk.length;if(size>MAX_READ_BODY){req.off('data',onData);req.resume();rejectBody(Object.assign(Error('Read request exceeds the 1 MB limit.'),{status:413}));}else chunks.push(chunk);};
  req.on('data',onData);req.once('end',()=>resolve(Buffer.concat(chunks)));req.once('error',()=>rejectBody(Object.assign(Error('Read request was interrupted.'),{status:400})));
 });
 try{JSON.parse(correction?new TextDecoder('utf-8',{fatal:true}).decode(bytes):bytes.toString('utf8'));}catch{reject(400,'Request must contain valid UTF-8 JSON.');}
 return bytes;
}
const SOURCE_CORRECTION_PATHS=new Set(['/api/source-sessions/edit','/api/source-sessions/undo']);
function validateCorrection(pathname,bytes){
 const input=JSON.parse(bytes.toString('utf8'));
 const keys=pathname.endsWith('/edit')?['operationId','expectedRevision','expectedSourceHash','sessionId','turnId','speaker','text']:['operationId','undoOperationId','expectedRevision','expectedSourceHash','sessionId'];
 const word=(value,max)=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!value.includes('\0');
 // Match the maintained source owner, including its non-UUID operation IDs.
 // The owner alone compares the caller's unchanged revision/hash under its lock.
 const operation=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||!operation(input.operationId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.expectedSourceHash!=='string'||!word(input.sessionId,300)||(pathname.endsWith('/edit')?(!word(input.turnId,300)||!word(input.speaker,100)||!word(input.text,12000)):!operation(input.undoOperationId)))throw Object.assign(Error('Use the complete current source correction request.'),{status:400});
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
function validateNativeOperations(operations,fail){
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const fields=(value,required,optional=[])=>object(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 // Prose/structure and one exact photo focus; markup approval keeps its separate gate.
 const shapes={photoFocus:['kind','id','seenBlockHash','x','y'],text:['kind','id','from','to','insert','seenBlockHash'],move:['kind','id','beforeId'],split:['kind','id','at','newId'],join:['kind','leftId','rightId'],insert:['kind','id','beforeId','raw'],delete:['kind','id'],blockKind:['kind','id','blockKind','seenBlockHash']};
 for(const op of operations){
  if(!object(op)||typeof op.kind!=='string'||!Object.hasOwn(shapes,op.kind)||!fields(op,shapes[op.kind],op.kind==='blockKind'?['level']:[]))fail();
  for(const key of ['id','leftId','rightId','newId'])if(key in op&&(typeof op[key]!=='string'||!op[key]||op[key].length>256||!op[key].isWellFormed()||/[\x00-\x1f]/.test(op[key])))fail();
  if('beforeId' in op&&op.beforeId!==null&&(typeof op.beforeId!=='string'||!op.beforeId))fail();
  for(const key of ['from','to','at'])if(key in op&&(!Number.isSafeInteger(op[key])||op[key]<0))fail();
  for(const key of ['insert','raw'])if(key in op&&(typeof op[key]!=='string'||!op[key].isWellFormed()||op[key].includes('\0')))fail();
  if('seenBlockHash' in op&&!hash(op.seenBlockHash))fail();
  if(op.kind==='photoFocus'&&(operations.length!==1||![op.x,op.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))fail();
  if(op.kind==='blockKind'&&(!['paragraph','heading','blockquote'].includes(op.blockKind)||op.blockKind==='heading'&&![1,2,3].includes(op.level)||op.blockKind!=='heading'&&op.level!==undefined))fail();
 }
}

const MAGAZINE_DRAFT_CORRECTION_PATHS=new Set(['/api/magazine/working-draft/prepare','/api/magazine/working-draft/save','/api/magazine/working-draft/undo']);
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
 validateNativeOperations(input.operations,fail);
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
export function createReviewConnection({publicDir=path.join(root,'public'),runtimePublicDir=path.join(root,'runtime/public'),authorityURL='http://127.0.0.1:8841',allowedAuthorityPort=8841,timeoutMs=10000,readOverrides=new Map(),actualWorkReview=false,readPostPaths=[],sourceCorrections=false,studyDraftCorrections=false,studyDraftApprovals=false,browserCarouselCorrections=false,nativeCarouselCorrections=false,magazineDraftCorrections=false,catalogCacheScope=null}={}){
 const upstream=authority(authorityURL,allowedAuthorityPort);
 // Browser HTTP/1 pools commonly permit six sockets per origin. Keep live
 // review events from occupying that entire pool across older open clients.
 const eventStreams=new Map(),maxEventStreams=2;
 if(typeof sourceCorrections!=='boolean'||typeof studyDraftCorrections!=='boolean'||typeof studyDraftApprovals!=='boolean'||typeof browserCarouselCorrections!=='boolean'||typeof nativeCarouselCorrections!=='boolean'||typeof magazineDraftCorrections!=='boolean')throw Error('Correction permissions must be explicit booleans.');
 if(studyDraftApprovals&&!studyDraftCorrections)throw Error('Marked wording approval requires the existing guarded manuscript corrections.');
 if(!Array.isArray(readPostPaths)||readPostPaths.some(name=>!READ_POST_PATHS.has(name)))throw Error('Only declared maintained POST read paths may be configured.');
 const postReads=new Set(readPostPaths);
 if(!(readOverrides instanceof Map))throw Error('Review read overrides must be an explicit Map.');
 const overrides=new Map(readOverrides);
 for(const [name,handler] of overrides)if(typeof handler!=='function'||!(/^\/api\/review\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(name)||['/api/magazine/portfolio','/api/magazine/artifact',...(actualWorkReview?['/api/sources/tree','/api/library/folders','/api/sources/file','/api/collections','/api/collection-relationships','/api/evidence']:[])].includes(name)))throw Error('Review overrides must name a permitted exact read path.');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Use a positive upstream timeout.');
 const server=http.createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(SECURITY))res.setHeader(key,value);
  const fail=(status,message)=>{if(res.headersSent||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:message,readOnly:true}));};
  const port=server.address()?.port,hosts=[`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`];
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!hosts.includes(req.headers.host)||req.headers.origin!==undefined&&!hosts.map(h=>'http://'+h).includes(req.headers.origin))return fail(403,'Only this local review entrance may read existing work.');
  if(port===allowedAuthorityPort)return fail(503,'Review must use a separate port from the existing authority.');
  const pathname=validPath(req.url);if(!pathname)return fail(400,'This review path is not allowed.');
  if(actualWorkReview===true&&pathname==='/api/sources/blob'&&['GET','HEAD'].includes(req.method)){req.resume();return fail(403,'Original blob reads are unavailable in this read-only review.');}
  const correctionPath=SOURCE_CORRECTION_PATHS.has(pathname);
  const draftCorrectionPath=STUDY_DRAFT_CORRECTION_PATHS.has(pathname);
  const magazineCorrectionPath=MAGAZINE_DRAFT_CORRECTION_PATHS.has(pathname);
  const carouselCorrectionPath=NATIVE_CAROUSEL_PATHS.has(pathname);
  if(correctionPath&&sourceCorrections||draftCorrectionPath&&studyDraftCorrections||magazineCorrectionPath&&magazineDraftCorrections||carouselCorrectionPath&&nativeCarouselCorrections){
   if(req.url!==pathname)return fail(400,'Use the exact correction path without a query.');
   if(req.method!=='POST'){req.resume();res.setHeader('Allow','POST');return fail(405,'Corrections require an explicit POST.');}
   if(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site'){req.resume();return fail(403,'Corrections must originate from this exact local review page.');}
  }
  const sourceCorrection=sourceCorrections&&correctionPath&&req.method==='POST';
  const draftCorrection=studyDraftCorrections&&draftCorrectionPath&&req.method==='POST';
  const magazineCorrection=magazineDraftCorrections&&magazineCorrectionPath&&req.method==='POST';
  const carouselCorrection=nativeCarouselCorrections&&carouselCorrectionPath&&req.method==='POST';
  const correction=sourceCorrection||draftCorrection||magazineCorrection||carouselCorrection;
  const postRead=req.method==='POST'&&postReads.has(pathname);
  if(!['GET','HEAD'].includes(req.method)&&!postRead&&!correction){req.resume();res.setHeader('Allow','GET, HEAD');return fail(423,'This is a read-only review. Changes, saves and execution are unavailable here.');}
  try{
   const readBody=postRead||correction?await readJSON(req,{correction}):null;
   if(sourceCorrection)validateCorrection(pathname,readBody);
   if(draftCorrection)validateDraftCorrection(pathname,readBody,{approvals:studyDraftApprovals});
   if(magazineCorrection)validateMagazineCorrection(pathname,readBody);
   if(carouselCorrection)validateCarouselCorrection(pathname,readBody);
   if(actualWorkReview===true&&pathname==='/document-study/package-config.js'){
    const bytes=Buffer.from('window.AR_CREATE_PACKAGE_CONFIG='+JSON.stringify({syntheticFixtures:false,originalReaderBaseUrl:upstream.origin})+';window.AR_CREATE_REVIEW_MODE='+JSON.stringify({actualWork:true,readOnly:true,...(sourceCorrections?{sourceCorrections:true}:{}),...(studyDraftCorrections?{studyDraftCorrections:true}:{}),...(studyDraftApprovals?{studyDraftApprovals:true}:{}),...(browserCarouselCorrections?{browserCarouselCorrections:true}:{}),...(nativeCarouselCorrections?{nativeCarouselCorrections:true}:{}),...(magazineDraftCorrections?{magazineDraftCorrections:true}:{}),...(typeof catalogCacheScope==='string'&&/^[a-f0-9]{64}$/.test(catalogCacheScope)?{catalogCacheScope}:{}),authorityOrigin:upstream.origin})+';');
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
   const headers={};if(postRead||correction){headers['content-type']='application/json';headers['content-length']=readBody.length;if(req.headers.origin!==undefined)headers.origin=upstream.origin;}for(const key of ['accept','accept-language','range','if-range'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key];if(pathname==='/api/events'&&req.method==='GET'&&/^\d{1,16}$/.test(req.headers['last-event-id']||'')&&Number.isSafeInteger(Number(req.headers['last-event-id'])))headers['last-event-id']=req.headers['last-event-id'];
   const pending=http.request(upstream,{method:req.method,path:req.url,headers},owner=>{
    if(owner.statusCode>=300&&owner.statusCode<400){owner.resume();return fail(502,'The existing work authority returned a redirect; review did not follow it.');}
    const selected={};for(const key of ['content-type','content-length','content-range','accept-ranges','content-disposition',...(actualWorkReview===true&&pathname==='/api/study/photos/preview'?['x-content-sha256']:[])])if(owner.headers[key]!==undefined)selected[key]=owner.headers[key];
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
   pending.setTimeout(timeoutMs,()=>pending.destroy(Error('timeout')));
   pending.on('error',()=>fail(502,correction?'The existing work authority could not confirm this correction. Keep this operation ID when retrying; reload to check its saved result.':'The existing work authority is unavailable. Your saved work has not changed.'));
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
