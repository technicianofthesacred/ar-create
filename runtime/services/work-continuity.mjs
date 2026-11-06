import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {atomicWrite,digest,ensurePrivateDirectory,readJson,regular,resolveInside} from './files.mjs';
import {provenance,authorOf} from './actor.mjs';
import {outputPrivatePrefix} from '../output-records.mjs';
import IG from '../src/donors/mag/carousel/ig-templates.js';

const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const SCHEMA='ar-create.work-continuity.v1';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>canonical(a)===canonical(b);
const clone=value=>structuredClone(value);
const canonical=value=>JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const encode=value=>JSON.stringify(value)+'\n';
function fields(value,required,optional=[]){if(!object(value)||required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...required,...optional].includes(key)))fail('Use only the explicit receipt fields; caller paths/snapshots are refused.',400);}
function text(value,max=256){if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value))fail('Receipt text must be bounded plain metadata.',400);return value;}
function uuid(value){if(!UUID.test(value||''))fail('An exact UUID is required.',400);return value;}
function scopeOf(input){
 if(!object(input))fail('Choose an exact work scope.',400);
 if(input.kind==='collection'){fields(input,['kind','collectionId']);return {kind:'collection',collectionId:uuid(input.collectionId)};}
 if(input.kind==='project'){fields(input,['kind','parentStudyId']);return {kind:'project',parentStudyId:text(input.parentStudyId)};}
 if(input.kind==='piece'){fields(input,['kind','parentStudyId','rootBindingId','outputId']);return {kind:'piece',parentStudyId:text(input.parentStudyId),rootBindingId:uuid(input.rootBindingId),outputId:uuid(input.outputId)};}
 fail('Unknown work scope.',400);
}
function actorOf(input){fields(input,['clientId','reportedRole']);uuid(input.clientId);if(!['viewer','agent','local-client'].includes(input.reportedRole))fail('Choose an explicit reported local role.',400);return {...input,identityVerification:'unverified-client-label'};}
function versionOf(value){fields(value,['revision','hash','wordsHash','editionHash']);if(!Number.isSafeInteger(value.revision)||value.revision<0||!HASH.test(value.hash||'')||!HASH.test(value.wordsHash||'')||value.editionHash!==null&&!HASH.test(value.editionHash||''))fail('An exact maintained work version is required.',400);return value;}
const allowedChanges=['metadata-only','learning-record','piece-words','piece-layout','source-references'];
function changes(value){if(!Array.isArray(value)||value.length>allowedChanges.length||new Set(value).size!==value.length||value.some(item=>!allowedChanges.includes(item)))fail('Use bounded allowed-change names.',400);return value;}

/** Metadata receipts only. Maintained work owners remain the sole content/revision authorities. */
export function createWorkContinuity({dataDir,direction,outputs,outputExports,understanding}={}){
 if(typeof direction?.read!=='function')throw Error('Supply the maintained shared-record owner.');
 async function currentWork(scope){
  if(scope.kind!=='piece'){
   const input=scope.kind==='collection'?{scope:'collection',collectionId:scope.collectionId}:{scope:'project',parentStudyId:scope.parentStudyId};
   const record=await direction.read(input);
   if(!record?.bound||record.scope?.kind!==scope.kind||scope.kind==='collection'&&record.scope.collectionId!==scope.collectionId||scope.kind==='project'&&record.scope.parentStudyId!==scope.parentStudyId||record.externalEdit)fail('The maintained learning owner cannot confirm this exact current work scope.');
   if(!Number.isSafeInteger(record.revision)||record.revision<0||!HASH.test(record.hash||''))fail('Maintained learning revision is unavailable.');
   const known=new Set([record.revision+':'+record.hash]);
   for(const op of record.history||[])if(op.status==='committed')for(const snapshot of [op.before,op.after])if(snapshot)known.add(snapshot.revision+':'+snapshot.hash);
   return {scope,owner:'study-human-direction',identityVerification:'maintained-owner-confirmed',contentStored:false,version:{revision:record.revision,hash:record.hash,wordsHash:record.hash,editionHash:null},known,anchors:[]};
  }
  if(typeof outputs?.read!=='function')fail('Maintained native output read authority is unavailable.',503);
  const view=await outputs.read({parentStudyId:scope.parentStudyId,rootBindingId:scope.rootBindingId,selectedOutputId:scope.outputId});
  if(view?.scope?.parentStudyId!==scope.parentStudyId||view.scope.rootBindingId!==scope.rootBindingId||view.output?.id!==scope.outputId||!UUID.test(view.photoScope?.projectId||'')||!UUID.test(view.photoScope?.documentId||'')||!view.wordOwner||!view.writingProof)fail('Native owner did not confirm the exact Piece scope.');
  const wordsHash=view.writingProof.rawHash||view.writingProof.wordsHash,expected=view.expectedOutput;
  if(!HASH.test(wordsHash||'')||!Number.isSafeInteger(expected?.revision)||expected.revision<0||!HASH.test(expected.hash||''))fail('Exact current Piece writing/revision proof is unavailable.');
  const writing=view.writingProof.kind==='carousel-words'?{kind:view.writingProof.kind,wordsHash:view.writingProof.wordsHash,expected:{outputHash:view.writingProof.expected?.outputHash,markdownHash:view.writingProof.expected?.markdownHash}}:view.writingProof;
  const editionHash=digest(canonical({output:view.output,wordOwner:view.wordOwner,writing}));
  return {scope,owner:'native-output',identityVerification:'maintained-owner-confirmed',contentStored:false,version:{revision:expected.revision,hash:editionHash,wordsHash,editionHash},projectId:view.photoScope.projectId,documentId:view.photoScope.documentId,known:new Set(),anchors:(view.document?.paragraphs||[]).map(p=>p.id),native:view};
 }
 function locations(work,create=false){
  const relative=work.scope.kind==='piece'?outputPrivatePrefix(work.projectId,work.documentId)+'continuity/'+work.scope.outputId:'workspaces/work-continuity/'+digest(JSON.stringify(work.scope));
  if(create)ensurePrivateDirectory(dataDir,relative);
  else{
   let prefix='';for(const part of relative.split('/')){prefix+=(prefix?'/':'')+part;if(!fs.lstatSync(path.join(dataDir,prefix),{throwIfNoEntry:false}))return null;resolveInside(dataDir,prefix,{directory:true});}
  }
  const dir=resolveInside(dataDir,relative,{directory:true});return {dir,file:path.join(dir,'record.json'),history:path.join(dir,'history'),lock:path.join(dir,'owner.lock')};
 }
 function empty(scope){return {schema:SCHEMA,scope:clone(scope),revision:0,data:{visits:[],assignments:[],completions:[]}};}
 function stateOf(raw,scope){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>512*1024)fail('Continuity metadata is unavailable or too large; preserve it.');
  let state;try{state=JSON.parse(raw);}catch{fail('Continuity metadata cannot be parsed; preserve it.');}
  if(!object(state)||state.schema!==SCHEMA||!same(state.scope,scope)||!Number.isSafeInteger(state.revision)||state.revision<0||!object(state.data)||!Array.isArray(state.data.visits)||state.data.visits.length>64||!Array.isArray(state.data.assignments)||state.data.assignments.length>128||!Array.isArray(state.data.completions)||state.data.completions.length>128)fail('Continuity metadata ownership/schema changed; preserve it.');
  for(const [rows,key] of [[state.data.visits,'viewerId'],[state.data.assignments,'assignmentId'],[state.data.completions,'id']])if(rows.some(row=>!object(row)||!UUID.test(row[key]||''))||new Set(rows.map(row=>row[key])).size!==rows.length)fail('Continuity metadata identities are corrupt.');
  return state;
 }
 function snapshot(raw,scope,exists=false){const state=stateOf(raw,scope);return {state,raw,hash:digest(raw),revision:state.revision,exists};}
 function disk(loc,scope){
  if(!loc||!fs.lstatSync(loc.file,{throwIfNoEntry:false}))return snapshot(encode(empty(scope)),scope,false);
  resolveInside(loc.dir,'record.json');regular(loc.file);return snapshot(fs.readFileSync(loc.file,'utf8'),scope,true);
 }
 function journals(loc,scope){
  if(!loc||!fs.lstatSync(loc.history,{throwIfNoEntry:false}))return [];
  resolveInside(loc.dir,'history',{directory:true});const names=fs.readdirSync(loc.history).filter(n=>UUID.test(n.slice(0,-5))&&n.endsWith('.json'));if(names.length>512)fail('Continuity receipt history limit reached; preserve existing receipts.');
  return names.map(name=>{
   const file=resolveInside(loc.history,name),op=readJson(file,null);
   if(!object(op)||op.schema!=='ar-create.work-continuity-operation.v1'||!same(op.scope,scope)||op.operationId!==name.slice(0,-5)||!HASH.test(op.fingerprint||'')||!['pending','committed','rejected'].includes(op.status))fail('Continuity recovery journal ownership is corrupt.');
   for(const item of [op.before,op.after])if(!object(item)||!HASH.test(item.hash||'')||digest(item.raw||'')!==item.hash||stateOf(item.raw,scope).revision!==item.revision)fail('Continuity recovery snapshots are corrupt.');
   if(op.after.revision!==op.before.revision+1)fail('Continuity journal revision is corrupt.');
   return {file,op};
  });
 }
 function load(loc,scope,{allowPending=false}={}){
  const history=journals(loc,scope),saved=disk(loc,scope);
  if(!allowPending&&history.some(row=>row.op.status==='pending'))fail('Continuity recovery is required before reading or saving.');
  if(!saved.exists&&history.some(row=>row.op.status==='committed'))fail('Saved continuity metadata is missing; recovery receipts retained.');
  return {...saved,history};
 }
 function acquire(loc){
  let fd;try{fd=fs.openSync(loc.lock,'wx+',0o600);}catch(error){if(error.code==='EEXIST')fail('Continuity owner lock is busy; no stale lock takeover.');throw error;}
  const token=randomUUID(),stat=fs.fstatSync(fd);fs.writeFileSync(fd,encode({schema:'ar-create.work-continuity-lock.v1',token}));fs.fsyncSync(fd);
  function check(){
   const named=fs.lstatSync(loc.lock,{throwIfNoEntry:false});if(!named||named.isSymbolicLink()||!named.isFile()||named.nlink!==1||named.dev!==stat.dev||named.ino!==stat.ino)fail('Continuity lock ownership changed.');
   let value;try{value=JSON.parse(fs.readFileSync(loc.lock,'utf8'));}catch{fail('Continuity lock token changed.');}if(value.schema!=='ar-create.work-continuity-lock.v1'||value.token!==token)fail('Continuity lock token changed.');
  }
  function release(){try{check();fs.unlinkSync(loc.lock);}catch{}finally{fs.closeSync(fd);}}
  return {check,release};
 }
 function view(work,saved,viewerId,operation=null){
  const visits=saved.state.data.visits,previous=viewerId?visits.find(v=>v.viewerId===viewerId):null;
  let visit={state:viewerId?'initial-visit':'not-requested',position:viewerId?'start-of-work-initial-visit':'not-requested',actualReadVerified:false,authenticatedIdentity:false};
  if(previous){
   const sameVersion=work.scope.kind==='piece'?same({...previous.version,revision:0},{...work.version,revision:0}):same(previous.version,work.version);
   visit={...visit,state:sameVersion?'same-version':work.known.has(previous.version.revision+':'+previous.version.hash)?'changed-known-history':'changed-history-unavailable',previousVersion:clone(previous.version),recordedVisitAt:previous.recordedAt,registryRevisionChanged:previous.version.revision!==work.version.revision,position:work.scope.kind==='piece'&&!sameVersion?'start-of-work-revision-changed':previous.position&&work.anchors.includes(previous.position.paragraphId)?'anchor-current':work.scope.kind==='piece'?'start-of-work-anchor-unavailable':'start-of-work-no-anchor-owner'};
  }
  const {known,anchors,native,...pointer}=work;
  return {scope:clone(work.scope),expected:{revision:saved.revision,hash:saved.hash},work:clone(pointer),data:clone(saved.state.data),visit,changeImpact:{coverage:'unknown',affected:null,reason:'No reviewed reverse-use dependency coverage is available.'},completionFacts:saved.state.data.completions.map(row=>({id:row.id,currentEdition:row.version?.editionHash===work.version.editionHash&&row.version?.hash===work.version.hash,publicationVerified:false,artifactRechecked:false})),history:saved.history.map(({op})=>({operationId:op.operationId,...authorOf(op),kind:op.kind,status:op.status,before:{revision:op.before.revision,hash:op.before.hash},after:{revision:op.after.revision,hash:op.after.hash}})),...operation?{operation}:{}};
 }
 async function read(input){fields(input,['scope'],['viewerId']);const scope=scopeOf(input.scope);if(input.viewerId!==undefined)uuid(input.viewerId);const work=await currentWork(scope),saved=load(locations(work),scope);return view(work,saved,input.viewerId);}
 function expectedOf(value){fields(value,['revision','hash']);if(!Number.isSafeInteger(value.revision)||value.revision<0||!HASH.test(value.hash||''))fail('Exact continuity metadata revision/hash required.',400);}
 async function verifiedExport(work,exportId){
  if(work.scope.kind!=='piece'||typeof outputExports?.file!=='function'||typeof outputs?.withExportSnapshot!=='function')fail('Maintained exact export/snapshot verifier is unavailable for this scope.',503);
  uuid(exportId);const carousel=work.native.output.kind==='carousel',scope={rootBindingId:work.scope.rootBindingId,parentStudyId:work.scope.parentStudyId,selectedOutputId:work.scope.outputId},verifiedAt=new Date().toISOString();
  async function inspect(){
   let artifact,files=[],media=[];
   if(carousel){
    if(typeof outputExports.list!=='function')fail('Maintained whole-carousel export list is unavailable.',503);
    const list=await outputExports.list(scope),matches=list?.exports?.filter(a=>a.id===exportId);if(matches?.length!==1)fail('Exact complete carousel export was not found in this Piece.');artifact=matches[0];
    const slides=artifact.output?.slides;
    if(artifact.status!=='complete'||artifact.output?.kind!=='carousel'||!Array.isArray(slides)||!slides.length||slides.length>100||new Set(slides.map(s=>s.id)).size!==slides.length)fail('Complete owned carousel slide manifest required.');
    const expected=slides.map((_,i)=>({name:'slide-'+String(i+1).padStart(2,'0')+'.png',mimeType:'image/png'})).concat([{name:'caption.txt',mimeType:'text/plain'},{name:'output.json',mimeType:'application/json'}]);
    if(!Array.isArray(artifact.files)||artifact.files.length!==expected.length||new Set(artifact.files.map(f=>f.name)).size!==expected.length||artifact.files.some((f,i)=>f.name!==expected[i].name||f.mimeType!==expected[i].mimeType||!HASH.test(f.hash||'')||!Number.isSafeInteger(f.sizeBytes)||f.sizeBytes<1||f.sizeBytes>64*1024*1024))fail('Whole ordered unique portrait PNG/caption/output JSON set required.');
    for(const item of artifact.files){
     const owned=await outputExports.file({...scope,exportId,format:'carousel',name:item.name});
     if(owned?.name!==item.name||owned.hash!==item.hash||owned.mimeType!==item.mimeType||owned.sizeBytes!==item.sizeBytes)fail('Maintained carousel file receipt changed.');
     regular(owned.file);const bytes=fs.readFileSync(owned.file);if(bytes.length!==item.sizeBytes||digest(bytes)!==item.hash)fail('Carousel retained bytes changed.');
     if(item.mimeType==='image/png'&&(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==1080||bytes.readUInt32BE(20)!==1350))fail('Exact 1080 by 1350 portrait PNG dimensions/signature required.');
     if(item.name==='caption.txt'&&!bytes.equals(Buffer.from((artifact.output.caption||'')+'\n')))fail('Carousel caption artifact differs from the exact saved snapshot.');
     if(item.name==='output.json'){let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{fail('Carousel output JSON is invalid.');}if(!same(value,artifact.output))fail('Carousel output JSON differs from the saved snapshot.');}
     files.push({name:item.name,mimeType:item.mimeType,sizeBytes:item.sizeBytes,hash:item.hash});
    }
    const reread=await outputExports.list(scope),again=reread?.exports?.filter(a=>a.id===exportId);if(again?.length!==1||!same(again[0],artifact))fail('Carousel manifest changed during whole-set verification.');
   }else{
    const result=await outputExports.file({...scope,exportId,format:'article'});artifact=result?.artifact;
    if(!artifact||!HASH.test(artifact.hash||'')||typeof artifact.name!=='string'||!['text/markdown','text/html','application/json'].includes(artifact.mimeType)||!Number.isSafeInteger(artifact.sizeBytes)||artifact.sizeBytes<0)fail('Exact retained Article export unavailable.');
    const binding=artifact.renderBinding;
    if(artifact.contentVerification!=='server-rendered-exact-edition'||binding?.renderer!=='maintained-output-renderer-v1'||!HASH.test(binding.rendererHash||'')||binding.mimeType!==artifact.mimeType||binding.bodyHash!==artifact.hash||binding.outputHash!==digest(JSON.stringify(work.native.output)))fail('Article completion needs an export rendered from this exact saved edition. Earlier files remain available without correspondence verification.');
    regular(result.file);const bytes=fs.readFileSync(result.file);if(bytes.length!==artifact.sizeBytes||digest(bytes)!==artifact.hash)fail('Retained Article file bytes changed.');
    files=[{name:artifact.name,mimeType:artifact.mimeType,sizeBytes:artifact.sizeBytes,hash:artifact.hash}];
   }
   if(!artifact||artifact.id!==exportId||artifact.projectId!==work.projectId||artifact.documentId!==work.documentId||artifact.outputId!==work.scope.outputId||artifact.publicationProof!=='selected-output-writing-source-assets'||artifact.lineageVerification!=='saved-output-record'||!HASH.test(artifact.publicationBinding?.sourceProofHash||'')||carousel&&artifact.contentVerification!=='existing-carousel-renderer-saved-output-snapshot')fail('Export receipt is foreign or lacks maintained selected-output proof.');
   // File/list owners resolve before this exact native snapshot lease. The callback
   // uses only supplied snapshot values/finalCheck; it never reenters those owners.
   await outputs.withExportSnapshot({...scope,expectedOutput:work.native.expectedOutput,...(work.native.writingProof.kind==='native'?{expectedNative:work.native.writingProof.expected}:{})},async snapshot=>{
    if(snapshot.projectId!==work.projectId||snapshot.documentId!==work.documentId||snapshot.output.id!==scope.selectedOutputId||!same(snapshot.output,work.native.output)||!same(snapshot.wordOwner,artifact.publicationBinding.wordOwner)||snapshot.sourceProofHash!==artifact.publicationBinding.sourceProofHash||artifact.outputRevision!==(snapshot.output.outputRevision||0)||artifact.manuscriptRevision!==snapshot.output.manuscriptRevision||carousel&&!same(artifact.output,snapshot.output))fail('Export is stale for this exact own edition/word/source snapshot.');
    if(carousel){
     const urls=[...new Set(snapshot.output.slides.flatMap(slide=>{const count=IG.T[slide.template]?.photos;if(!Number.isSafeInteger(count)||count<0)fail('Unknown maintained carousel photo contract.');return slide.photos.slice(0,count).map(p=>p.src).filter(Boolean);}))];
     if(!object(artifact.media)||!same(Object.keys(artifact.media).sort(),urls.sort()))fail('Carousel retained-photo manifest is incomplete or foreign.');
     media=urls.map(url=>{const match=/^\/api\/sources\/blob\?id=([^&?#]+)$/.exec(url),id=match?decodeURIComponent(match[1]):null,item=artifact.media[url],current=snapshot.assetProof?.find(a=>a.id===id&&!a.missing);if(!UUID.test(id||'')||!current||current.hash!==item?.hash||!HASH.test(item.hash||'')||typeof item.name!=='string'||!/^photo-[0-9]+\.(?:png|jpe?g|webp)$/.test(item.name))fail('Current exact owned photo proof changed.');return {sourceId:id,name:item.name,hash:item.hash};});
    }
    if(carousel&&new Set(media.map(item=>item.name)).size!==media.length)fail('Carousel retained-photo names are ambiguous.');
    await snapshot.finalCheck();
   });
   return {exportId,artifactReceiptHash:digest(canonical(artifact)),...(carousel?{artifactSetHash:digest(canonical(files)),slideCount:artifact.output.slides.length,files,media,verification:'maintained-whole-carousel-export-byte-verified'}:{artifactHash:artifact.hash,files,verification:'maintained-export-owner-byte-verified'}),sourceProofHash:artifact.publicationBinding.sourceProofHash,outputRevision:artifact.outputRevision,manuscriptRevision:artifact.manuscriptRevision,contentVerification:artifact.contentVerification||'not-declared',verifiedAt};
  }
  const fact=await inspect();return {fact,recheck:async()=>{if(!same(await inspect(),fact))fail('Retained export receipt changed before completion publication.');}};
 }
 function contextRequest(request,scope){
  fields(request,['scopes'],['selectedScope','piece']);
  if(!Array.isArray(request.scopes)||!request.scopes.length||request.scopes.length>32||Buffer.byteLength(canonical(request))>24*1024)fail('Use a bounded explicit understanding request.',400);
  for(const entry of request.scopes){
   const selected=entry?.selector||entry;
   if(entry?.selector){fields(entry,['selector'],['expected']);if(entry.expected){fields(entry.expected,['revision','hash']);if(!Number.isSafeInteger(entry.expected.revision)||entry.expected.revision<0||!HASH.test(entry.expected.hash||''))fail('Exact requested record pin required.',400);}}
   fields(selected,['scope'],['collectionId','parentStudyId','bindingId','outputId']);
   if(selected.scope==='collection'){fields(selected,['scope','collectionId']);uuid(selected.collectionId);}
   else{if(!['project','part','output'].includes(selected.scope))fail('Unknown understanding scope.',400);text(selected.parentStudyId);if(selected.bindingId!==undefined)uuid(selected.bindingId);if(selected.outputId!==undefined)uuid(selected.outputId);}
  }
  if(request.selectedScope!==undefined&&!request.scopes.some(entry=>same(entry?.selector||entry,request.selectedScope)))fail('Selected understanding scope must be explicitly requested.',400);
  let targetScope=null;
  if(scope.kind==='piece'){
   fields(request.piece,['parentStudyId','rootBindingId','selectedOutputId']);
   targetScope={parentStudyId:scope.parentStudyId,rootBindingId:scope.rootBindingId,selectedOutputId:scope.outputId};
   if(!same(request.piece,targetScope))fail('Understanding Piece target differs from the assignment scope.');
  }else{
   if(request.piece!==undefined)fail('Learning assignment cannot borrow an independent Piece target.');
   const selected=request.selectedScope||(request.scopes.length===1?(request.scopes[0].selector||request.scopes[0]):null),wanted=scope.kind==='collection'?{scope:'collection',collectionId:scope.collectionId}:{scope:'project',parentStudyId:scope.parentStudyId};
   if(!same(selected,wanted))fail('Understanding selected scope differs from the exact learning assignment.');
  }
  return {request:clone(request),targetScope};
 }
 function resolver(){if(typeof understanding?.resolve!=='function'||typeof understanding?.validatePending!=='function')fail('Actual current-understanding resolver is unavailable.',503);return understanding;}
 async function prepareContext(request,scope,expectedFingerprint){
  const checked=contextRequest(request,scope),projection=await resolver().resolve(checked.request);
  if(projection?.schema!=='ar-create.current-understanding.projection.v1'||!HASH.test(projection.fingerprint||'')||projection.readConsistency?.status!=='stable-reread'||!['current','empty','explicit-reference'].includes(projection.status)||!Array.isArray(projection.records)||projection.records.some(r=>!['current','empty'].includes(r.status))||scope.kind==='piece'&&(projection.piece?.status!=='current'||projection.piece.words?.status!=='current'||projection.piece.edition?.status!=='owner-current-edition'))fail('Actual understanding context is unavailable or changed; prepare from fresh maintained owners.');
  if(expectedFingerprint!==undefined&&(!HASH.test(expectedFingerprint||'')||expectedFingerprint!==projection.fingerprint))fail('Displayed preparation context fingerprint changed; explicit reprepare required.');
  return {schema:'ar-create.assignment-understanding-context.v1',...checked,allowedTarget:clone(scope),fingerprint:projection.fingerprint,readConsistency:'stable-reread',permissionGranted:false};
 }
 async function checkContext(stored,scope,preparedText,humanText){
  const held={status:'context-not-recorded',contextUnchanged:false,reviewRequired:true,mayApply:false,permissionGranted:false,preparedText,humanText,preparedFingerprint:stored?.fingerprint??null,currentFingerprint:null,targetGuardsRequired:true};
  if(!stored)return {...held,reason:'This receipt has no recorded preparation context; explicitly reprepare.'};
  try{
   if(stored.schema!=='ar-create.assignment-understanding-context.v1'||!HASH.test(stored.fingerprint||'')||!same(stored.allowedTarget,scope))fail('Stored preparation context ownership changed.');
   const checked=contextRequest(stored.request,scope);if(!same(checked.targetScope,stored.targetScope))fail('Stored preparation target changed.');
   const result=await resolver().validatePending({request:checked.request,expectedFingerprint:stored.fingerprint,targetScope:checked.targetScope,preparedText,humanText});
   if(result.preparedText!==preparedText||result.humanText!==humanText)fail('Resolver did not preserve caller text.');
   const unchanged=result.contextUnchanged===true&&result.projection?.fingerprint===stored.fingerprint&&result.projection?.readConsistency?.status==='stable-reread';
   return {...held,status:unchanged?'context-unchanged-target-guards-required':'context-changed',contextUnchanged:unchanged,reviewRequired:!unchanged,currentFingerprint:HASH.test(result.projection?.fingerprint||'')?result.projection.fingerprint:null,reason:result.reason};
  }catch(error){return {...held,status:'context-unavailable',reason:'Review this preparation: '+error.message};}
 }
 async function validateAssignmentContext(candidate){
  const input=clone(candidate);
  fields(input,['scope','assignmentId','preparedText','humanText']);const scope=scopeOf(input.scope);uuid(input.assignmentId);
  if(typeof input.preparedText!=='string'||typeof input.humanText!=='string')fail('Prepared and human text must remain explicit strings.',400);
  let initial;try{initial=await currentWork(scope);}catch(error){return {status:'context-unavailable',scope:clone(scope),assignmentId:input.assignmentId,contextUnchanged:false,reviewRequired:true,mayApply:false,permissionGranted:false,targetGuardsRequired:true,preparedText:input.preparedText,humanText:input.humanText,preparedFingerprint:null,currentFingerprint:null,reason:'Maintained target unavailable: '+error.message};}
  const loc=locations(initial),before=load(loc,scope),assignment=before.state.data.assignments.find(a=>a.assignmentId===input.assignmentId);if(!assignment)fail('Assignment is absent from this exact scope.',404);
  const result=await checkContext(assignment.understandingContext,scope,input.preparedText,input.humanText);
  let after,work,finalSaved;try{after=load(loc,scope);work=await currentWork(scope);finalSaved=load(loc,scope);}catch(error){return {...result,status:'context-unavailable',contextUnchanged:false,reviewRequired:true,reason:'Maintained target/receipt changed during validation: '+error.message};}
  const sameWorkVersion=scope.kind==='piece'?same({...initial.version,revision:0},{...work.version,revision:0}):same(initial.version,work.version);
  if(before.hash!==after.hash||before.hash!==finalSaved.hash||!sameWorkVersion)return {...result,status:'context-changed-during-validation',contextUnchanged:false,reviewRequired:true};
  return {...result,assignmentId:assignment.assignmentId,scope:clone(scope),metadataRevision:after.revision};
 }
 async function apply(kind,input){
  const extras={seen:['viewerId'],assign:['assignment'],result:['assignmentId','outcome','reportedChanges'],complete:['completion'],undo:['undoOperationId']}[kind];
  fields(input,['scope','operationId','expected','expectedWork','actor',...extras],kind==='seen'?['position']:[]);
  const scope=scopeOf(input.scope),actor=actorOf(input.actor);uuid(input.operationId);expectedOf(input.expected);versionOf(input.expectedWork);
  // No lock is held while the first asynchronous scope read resolves.
  const initial=await currentWork(scope),loc=locations(initial,true),lock=acquire(loc);
  try{
   const work=await currentWork(scope);lock.check();
   if(locations(work).dir!==loc.dir)fail('Work storage identity changed during scope read.');
   const before=load(loc,scope),fingerprint=digest(canonical({kind,input})),prior=before.history.find(row=>row.op.operationId===input.operationId)?.op;
   if(prior){if(prior.fingerprint!==fingerprint)fail('Operation UUID already names a different continuity receipt.');if(prior.status!=='committed')fail('This operation was rejected; preserve receipts and use a new operation UUID.');return view(work,before,input.viewerId,{operationId:input.operationId,replayed:true,committedRevision:prior.after.revision,committedHash:prior.after.hash});}
   if(before.history.length>=512)fail('Continuity receipt history limit reached; no new receipt published.');
   if(!same(input.expected,{revision:before.revision,hash:before.hash}))fail('Continuity metadata changed; refresh before saving.');
   if(!same(input.expectedWork,work.version))fail('Maintained work baseline changed; refresh before saving receipts.');
   let next=clone(before.state),exportRecheck=null;const now=new Date().toISOString();
   if(kind==='seen'){
    uuid(input.viewerId);if(actor.reportedRole!=='viewer')fail('Agent preparation cannot record a local viewer visit.');
    if(input.position!==undefined){fields(input.position,['paragraphId']);uuid(input.position.paragraphId);if(!work.anchors.includes(input.position.paragraphId))fail('Visit position is not an existing current work anchor.');}
    const old=next.data.visits.find(row=>row.viewerId===input.viewerId),value={...old,viewerId:input.viewerId,version:clone(work.version),recordedAt:now,position:input.position?clone(input.position):null,actor,meaning:'explicit-local-visit-not-proof-of-reading'};
    if(old)next.data.visits[next.data.visits.indexOf(old)]=value;else next.data.visits.push(value);
   }else if(kind==='assign'){
    const a=input.assignment;fields(a,['assignmentId','requestedScope','desiredResult','allowedChanges','protectedWordHash','stoppingConditions'],['understandingRequest','expectedFingerprint']);uuid(a.assignmentId);if(!same(scopeOf(a.requestedScope),scope))fail('Assignment requested scope differs from this exact work.');text(a.desiredResult,500);changes(a.allowedChanges);
    if(scope.kind!=='piece'&&a.allowedChanges.some(value=>value.startsWith('piece-'))||scope.kind==='piece'&&a.allowedChanges.includes('learning-record'))fail('Allowed changes do not match this work scope.');
    if(a.protectedWordHash!==null&&a.protectedWordHash!==work.version.wordsHash)fail('Protected words must match this maintained whole-word authority.');
    if(!Array.isArray(a.stoppingConditions)||a.stoppingConditions.length<1||a.stoppingConditions.length>12)fail('Supply bounded stopping conditions.',400);a.stoppingConditions.forEach(value=>text(value,160));
    if(next.data.assignments.some(row=>row.assignmentId===a.assignmentId))fail('Assignment UUID already exists in this scope.');
    if(a.expectedFingerprint!==undefined&&a.understandingRequest===undefined)fail('A display fingerprint requires an actual scoped understanding request.',400);
    const understandingContext=a.understandingRequest!==undefined?await prepareContext(a.understandingRequest,scope,a.expectedFingerprint):null;lock.check();
    const {understandingRequest,expectedFingerprint,...receipt}=clone(a);
    next.data.assignments.push({...receipt,...(understandingContext?{understandingContext}:{}),baseline:clone(work.version),actor,createdAt:now,permissionGranted:false,executionLaunched:false,result:null});
   }else if(kind==='result'){
    uuid(input.assignmentId);const a=next.data.assignments.find(row=>row.assignmentId===input.assignmentId);if(!a||a.result)fail('Assignment is missing from this scope or already has a terminal result.');if(!['prepared','stopped','completed'].includes(input.outcome))fail('Choose a bounded result outcome.',400);changes(input.reportedChanges);if(input.reportedChanges.some(value=>!a.allowedChanges.includes(value)))fail('Reported result changes exceed this assignment.');if(a.protectedWordHash!==null&&a.protectedWordHash!==work.version.wordsHash)fail('Protected whole-word hash changed; result receipt held.');
    const context=a.understandingContext?await checkContext(a.understandingContext,scope,undefined,undefined):null;lock.check();
    a.result={...(context?{understandingContext:context}:{}),outcome:input.outcome,actualVersion:clone(work.version),recordedAt:now,actor,reportedChanges:clone(input.reportedChanges),allowedChangesVerification:'reported-only',causationVerified:false,approvalGranted:false};
   }else if(kind==='complete'){
    if(scope.kind!=='piece')fail('Completion belongs to an exact Piece and edition.');const c=input.completion;
    if(!object(c))fail('Supply a bounded completion receipt.',400);fields(c,['destination'],Object.hasOwn(c,'exportId')?['exportId']:['manualComplete']);fields(c.destination,['kind','label']);if(!['private-share','website','email','print','local-file','other'].includes(c.destination.kind))fail('Unknown intended destination.',400);text(c.destination.label,120);
    let fact;if(c.exportId!==undefined){const checked=await verifiedExport(work,c.exportId);fact=checked.fact;exportRecheck=checked.recheck;}else{if(typeof c.manualComplete!=='boolean'||actor.reportedRole!=='viewer')fail('Manual completion requires explicit local viewer attribution, not agent approval.');fact={manualComplete:c.manualComplete,verification:'manual-client-attribution',status:c.manualComplete?'reported-complete':'destination-recorded'};}
    lock.check();next.data.completions.push({id:input.operationId,version:clone(work.version),destination:clone(c.destination),actor,recordedAt:now,publicationVerified:false,...fact});
   }else{
    uuid(input.undoOperationId);const target=before.history.find(row=>row.op.operationId===input.undoOperationId)?.op;if(!target||target.status!=='committed'||target.after.hash!==before.hash||target.after.revision!==before.revision)fail('Only current unchanged continuity metadata can be undone.');next=stateOf(target.before.raw,scope);
   }
   next.revision=before.revision+1;
   const final=await currentWork(scope);lock.check();if(!same(final.version,work.version))fail('Maintained work changed before receipt publication.');
   const assigned=kind==='assign'?next.data.assignments.at(-1):kind==='result'?next.data.assignments.find(a=>a.assignmentId===input.assignmentId):null;
   if(assigned?.understandingContext){
    const checked=await checkContext(assigned.understandingContext,scope,undefined,undefined);lock.check();
    if(kind==='assign'&&!checked.contextUnchanged)fail('Preparation context changed before receipt publication; explicit reprepare required.');
    if(kind==='result')assigned.result.understandingContext=checked;
   }

   if(assigned?.understandingContext){const publicationWork=await currentWork(scope);lock.check();if(!same(publicationWork.version,work.version))fail('Maintained work changed during context verification; receipt held.');}
   if(exportRecheck){await exportRecheck();lock.check();}
   const after=snapshot(encode(next),scope,true);
   ensurePrivateDirectory(loc.dir,'history');const file=resolveInside(loc.history,input.operationId+'.json',{missing:true});const op={schema:'ar-create.work-continuity-operation.v1',provenance:provenance(),scope,operationId:input.operationId,kind,fingerprint,status:'pending',createdAt:now,before:{revision:before.revision,hash:before.hash,raw:before.raw},after:{revision:after.revision,hash:after.hash,raw:after.raw}};
   lock.check();atomicWrite(file,encode(op),{exclusive:true});
   lock.check();atomicWrite(loc.file,after.raw,before.exists?{expectedHash:before.hash}:{exclusive:true});
   lock.check();atomicWrite(file,encode({...op,status:'committed'}),{expectedHash:digest(encode(op))});
   return view(final,load(loc,scope),input.viewerId,{operationId:input.operationId,replayed:false,committedRevision:after.revision,committedHash:after.hash});
  }finally{lock.release();}
 }
 async function recover(input){
  fields(input,['scope']);const scope=scopeOf(input.scope),initial=await currentWork(scope),loc=locations(initial);if(!loc)return view(initial,load(null,scope));const lock=acquire(loc);
  try{
   const work=await currentWork(scope);lock.check();if(locations(work).dir!==loc.dir)fail('Work identity changed during recovery.');
   const pending=journals(loc,scope).filter(row=>row.op.status==='pending');if(pending.length>1)fail('Multiple pending continuity operations conflict; preserve receipts.');
   for(const {file,op} of pending){const saved=disk(loc,scope);let status;if(saved.hash===op.after.hash)status='committed';else if(saved.hash===op.before.hash)status='rejected';else fail('Pending continuity publication conflicts with outside metadata changes; preserve all bytes.');lock.check();atomicWrite(file,encode({...op,status,recoveredAt:new Date().toISOString()}),{expectedHash:digest(fs.readFileSync(file))});}
   return view(work,load(loc,scope));
  }finally{lock.release();}
 }
 return {read,validateAssignmentContext,recordSeen:input=>apply('seen',clone(input)),assign:input=>apply('assign',clone(input)),result:input=>apply('result',clone(input)),complete:input=>apply('complete',clone(input)),undo:input=>apply('undo',clone(input)),recover};
}
