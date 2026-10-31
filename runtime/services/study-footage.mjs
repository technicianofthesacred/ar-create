import path from 'node:path';
import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {digest,atomicWrite,ensurePrivateDirectory,regular} from './files.mjs';
import {currentActor,AGENT_ACTORS,HUMAN_ACTORS,provenance} from './actor.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const TYPES={'.mp4':'video/mp4','.mov':'video/quicktime','.m4v':'video/x-m4v','.webm':'video/webm','.mkv':'video/x-matroska'};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x),hash=v=>digest(stable(v)),same=(a,b)=>stable(a)===stable(b);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const exact=(v,required,optional=[])=>v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
const identity=s=>({bindingId:s.bindingId,parentStudyId:s.parentStudyId,projectId:s.projectId,documentId:s.documentId,fingerprint:s.fingerprint});
const queues=new Map();
const serial=(key,fn)=>{const prior=queues.get(key)||Promise.resolve(),next=prior.then(fn);queues.set(key,next.catch(()=>{}));return next;};
const exec=promisify(execFile);
export async function probeStudyFootage(file){
 const {stdout}=await exec('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-of','json',file],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
 return JSON.parse(stdout);
}
export function footageMetadata(result){
 const streams=result?.streams;if(!Array.isArray(streams)||streams.length>32)fail('Video stream metadata is unavailable.');
 const videos=streams.filter(s=>s.codec_type==='video'&&s.disposition?.attached_pic!==1);if(videos.length!==1)fail('Choose an original with one measurable video stream.');
 const v=videos[0],parts=/^(\d+)\/(\d+)$/.exec(v.time_base||''),startTicks=Number(v.start_pts),durationTicks=Number(v.duration_ts);
 if(!parts||!parts.slice(1).every(x=>Number.isSafeInteger(Number(x))&&Number(x)>0)||!Number.isSafeInteger(startTicks)||!Number.isSafeInteger(durationTicks)||durationTicks<=0||!Number.isSafeInteger(startTicks+durationTicks)||!Number.isInteger(v.width)||!Number.isInteger(v.height)||v.width<=0||v.height<=0)fail('Exact original timebase and duration ticks are unavailable.');
 const rotation=Number(v.side_data_list?.find(s=>s.rotation!==undefined)?.rotation??v.tags?.rotate??0);
 if(!Number.isFinite(rotation))fail('Original video orientation is unavailable.');
 return {timebase:{numerator:Number(parts[1]),denominator:Number(parts[2])},startTicks,durationTicks,width:v.width,height:v.height,rotation,audio:streams.some(s=>s.codec_type==='audio'),variableFrameRate:'not-inferred',frameRate:/^\d+\/\d+$/.test(v.avg_frame_rate||'')?v.avg_frame_rate:null};
}
/** Saved references to existing Library originals, not another media store or edit engine. */
export function createStudyFootage({dataDir,library,resolveScope,probe=probeStudyFootage}){
 if(!library?.snapshot||!library?.blob||typeof resolveScope!=='function'||typeof probe!=='function')throw Error('Supply maintained Library and exact attached-material scope owners.');
 ensurePrivateDirectory(dataDir,'study-footage');
 const file=s=>path.join(ensurePrivateDirectory(dataDir,'study-footage'),digest(s.bindingId+'\0'+s.parentStudyId)+'.json');
 async function scope(input){
  if(!UUID.test(input?.bindingId||'')||!text(input?.parentStudyId,256)||!input.parentStudyId)fail('Exact native binding and parent are required.',400);
  const s=await resolveScope({bindingId:input.bindingId,parentStudyId:input.parentStudyId});
  if(s?.bindingId!==input.bindingId||s.parentStudyId!==input.parentStudyId||!UUID.test(s.projectId||'')||!UUID.test(s.documentId||'')||!HASH.test(s.fingerprint||'')||!Array.isArray(s.sourceIds)||s.sourceIds.length>128||s.sourceIds.some(id=>!UUID.test(id))||new Set(s.sourceIds).size!==s.sourceIds.length)fail('Exact attached-material ownership is unavailable.');
  return structuredClone(s);
 }
 async function recheck(s){const current=await scope(s);if(!same(identity(current),identity(s))||!same([...current.sourceIds].sort(),[...s.sourceIds].sort())||current.canStandInReview!==s.canStandInReview)fail('Footage project or source ownership changed.');}
 function load(s){
  const location=file(s),exists=fs.existsSync(location);if(exists&&regular(location).size>2*1024*1024)fail('Saved footage journal exceeds its bounded size; existing bytes preserved.');
  const bytes=exists?fs.readFileSync(location,'utf8'):null,value=exists?parseJournal(bytes):{schema:'ar-create.study-footage.v1',scope:identity(s),revision:0,ranges:[],operations:[]};
  if(!exact(value,['schema','scope','revision','ranges','operations'])||value.schema!=='ar-create.study-footage.v1'||!same(value.scope,identity(s))||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.ranges)||value.ranges.length>1000||!Array.isArray(value.operations)||value.operations.length>2000||value.revision!==value.operations.length)fail('Saved footage references are corrupt or belong to an earlier binding; existing bytes preserved.');
  const ids=new Set();for(const row of value.ranges){if(!exact(row,['id','sourceId','sourceHash','metadataHash','metadata','inTicks','outTicks','label','decision','decisionRole','provenance','operationId'])||!UUID.test(row.id)||ids.has(row.id)||!UUID.test(row.sourceId)||!HASH.test(row.sourceHash)||!HASH.test(row.metadataHash)||hash(row.metadata)!==row.metadataHash||!validRange(row,row.metadata)||!validRole(row)||!text(row.label,500)||!['proposed','keep','check','reject'].includes(row.decision)||!['proposal','human','stand-in'].includes(row.decisionRole)||!UUID.test(row.operationId)||!text(row.provenance?.actor,100)||!Number.isFinite(Date.parse(row.provenance?.at))||row.decision==='proposed'&&row.decisionRole!=='proposal'||row.decision!=='proposed'&&row.decisionRole==='proposal'||row.decisionRole==='human'&&!HUMAN_ACTORS.includes(row.provenance.actor)||row.decisionRole==='stand-in'&&!AGENT_ACTORS.includes(row.provenance.actor))fail('Saved footage range is invalid; existing bytes preserved.');ids.add(row.id);}
  const ops=new Set();for(const op of value.operations){if(!exact(op,['operationId','requestHash','rangeId','revision','provenance','decisionRole','range'])||!UUID.test(op.operationId)||ops.has(op.operationId)||!HASH.test(op.requestHash)||!ids.has(op.rangeId)||!Number.isSafeInteger(op.revision)||op.revision<1||op.revision>value.revision||op.range?.id!==op.rangeId||op.range?.operationId!==op.operationId||op.range?.decisionRole!==op.decisionRole||!same(op.range?.provenance,op.provenance)||!validRole(op.range)||!validRange(op.range,op.range.metadata)||hash(op.range.metadata)!==op.range.metadataHash)fail('Saved footage operation is invalid; existing bytes preserved.');ops.add(op.operationId);}
  return {value,bytes,expected:{revision:value.revision,hash:bytes===null?hash(value):digest(bytes)}};
 }
 function parseJournal(bytes){try{return JSON.parse(bytes);}catch{fail('Saved footage journal is unreadable; existing bytes preserved.');}}
 function validRole(row){return row&&['proposal','human','stand-in'].includes(row.decisionRole)&&[...HUMAN_ACTORS,...AGENT_ACTORS].includes(row.provenance?.actor)&&(row.decisionRole==='human'?HUMAN_ACTORS.includes(row.provenance.actor):row.decisionRole==='stand-in'?AGENT_ACTORS.includes(row.provenance.actor):true)&&(row.decision==='proposed')===(row.decisionRole==='proposal');}
 function validRange(row,m){return m&&exact(m.timebase,['numerator','denominator'])&&[m.timebase.numerator,m.timebase.denominator].every(v=>Number.isSafeInteger(v)&&v>0)&&Number.isSafeInteger(m.startTicks+m.durationTicks)&&m.durationTicks>0&&Number.isSafeInteger(m.startTicks)&&Number.isSafeInteger(m.durationTicks)&&Number.isSafeInteger(row.inTicks)&&Number.isSafeInteger(row.outTicks)&&row.inTicks>=m.startTicks&&row.outTicks>row.inTicks&&row.outTicks<=m.startTicks+m.durationTicks;}
 async function source(s,id,withMetadata=true){
  if(!s.sourceIds.includes(id))fail('This source is not attached to the exact project.',404);
  const original=await library.snapshot(id),type=TYPES[path.extname(original.rel_path||'').toLowerCase()];
  if(original.id!==id||!HASH.test(original.hash||'')||original.missing||original.sourceUnavailable||!type)fail('Attached video original is unavailable or unsupported.',404);
  if(!withMetadata)return {original,type};
  let metadata;try{metadata=footageMetadata(await probe(original.path));}catch{fail('Exact original video timing metadata is unavailable.',503);}
  const before=original.hash;
  const after=await library.snapshot(id);if(after.id!==id||after.hash!==before||after.path!==original.path)fail('Original video changed during metadata inspection.');
  return {original,type,metadata,metadataHash:hash(metadata)};
 }
 const previewURL=(s,id,h)=>'/api/study/footage/preview?'+new URLSearchParams({bindingId:s.bindingId,parentStudyId:s.parentStudyId,sourceId:id,expectedHash:h});
 async function view(s,loaded){
  const sources=[],byId=new Map();
  for(const id of s.sourceIds){
   try{const {original,type,metadata,metadataHash}=await source(s,id);const item={id,title:original.title||original.name||'Video original',hash:original.hash,contentType:type,metadata,metadataHash,available:true,previewUrl:previewURL(s,id,original.hash)};sources.push(item);byId.set(id,item);}
   catch(error){if(error.status===404&&!loaded.value.ranges.some(row=>row.sourceId===id)){continue;}sources.push({id,available:false,reason:'Original video or exact timing metadata is unavailable.'});}
  }
  const ranges=loaded.value.ranges.map(row=>{const original=byId.get(row.sourceId),stale=!original||original.hash!==row.sourceHash||original.metadataHash!==row.metadataHash,unit=row.metadata.timebase.numerator/row.metadata.timebase.denominator;return {...structuredClone(row),stale,available:!!original&&!stale,...(!stale?{previewUrl:original.previewUrl+'#t='+((row.inTicks-row.metadata.startTicks)*unit)+','+((row.outTicks-row.metadata.startTicks)*unit)}:{reason:'Original or timing metadata changed; saved range is retained for review.'})};});
  await recheck(s);
  return {schema:'ar-create.study-footage.v1',...identity(s),expected:loaded.expected,sources,ranges,canStandInReview:s.canStandInReview===true,coverage:{kind:'attached-library-originals-only',livePremiereSync:false,trimmedExport:false,outputPlacement:false,finalOutputApproval:false},history:structuredClone(loaded.value.operations)};
 }
 return {
  async list(input){if(!exact(input,['bindingId','parentStudyId']))fail('Use exact footage scope fields.',400);const s=await scope(input);return serial(file(s),()=>view(s,load(s)));},
  async save(input){
   if(!exact(input,['bindingId','parentStudyId','operationId','expected','sourceId','sourceHash','metadataHash','inTicks','outTicks','label','decision'],['rangeId'])||!UUID.test(input.operationId)||!UUID.test(input.sourceId)||input.rangeId!==undefined&&!UUID.test(input.rangeId)||!HASH.test(input.sourceHash)||!HASH.test(input.metadataHash)||!text(input.label,500)||!['proposed','keep','check','reject'].includes(input.decision)||!exact(input.expected,['revision','hash'])||!Number.isSafeInteger(input.expected.revision)||!HASH.test(input.expected.hash))fail('Use exact saved footage scope, source, timing and range fields.',400);
   input=structuredClone(input);const s=await scope(input),actor=currentActor();if(!actor||!HUMAN_ACTORS.includes(actor.actor)&&!AGENT_ACTORS.includes(actor.actor))fail('Footage changes require an explicit known actor.',403);
   const human=HUMAN_ACTORS.includes(actor.actor),decisionRole=input.decision==='proposed'?'proposal':human?'human':s.canStandInReview===true?'stand-in':null;
   if(!decisionRole)fail('Agents may propose footage ranges; only registered copies permit stand-in selection review.',403);
   return serial(file(s),async()=>{
    const loaded=load(s),current=await source(s,input.sourceId);if(current.original.hash!==input.sourceHash||current.metadataHash!==input.metadataHash)fail('Original video or timing metadata changed; reopen it before saving.');
    if(!validRange(input,current.metadata))fail('Range must retain exact original ticks within its source duration.',400);
    const requestHash=hash({input,scope:identity(s),actor:actor.actor,client:actor.client,decisionRole}),prior=loaded.value.operations.find(op=>op.operationId===input.operationId);
    if(prior){if(prior.requestHash!==requestHash)fail('This operation already owns another exact footage request.');return {...await view(s,loaded),alreadySaved:true,receipt:structuredClone(prior)};}
    if(!same(input.expected,loaded.expected))fail('Footage ranges changed; reopen before saving.');
    if(loaded.value.operations.length>=2000)fail('Saved footage history reached its bounded limit.');
    const id=input.rangeId||input.operationId;if(input.rangeId&&!loaded.value.ranges.some(row=>row.id===id&&row.sourceId===input.sourceId))fail('Choose an existing range of this exact original.');
    if(!input.rangeId&&loaded.value.ranges.some(row=>row.id===id))fail('Range identity already exists.');
    const stamp=provenance(),range={id,sourceId:input.sourceId,sourceHash:input.sourceHash,metadataHash:input.metadataHash,metadata:current.metadata,inTicks:input.inTicks,outTicks:input.outTicks,label:input.label,decision:input.decision,decisionRole,provenance:stamp,operationId:input.operationId};
    const next=structuredClone(loaded.value);if(input.rangeId)next.ranges=next.ranges.map(row=>row.id===id?range:row);else next.ranges.push(range);next.revision++;
    const receipt={operationId:input.operationId,requestHash,rangeId:id,revision:next.revision,provenance:stamp,decisionRole,range:structuredClone(range)};next.operations.push(receipt);
    if(next.ranges.length>1000)fail('Saved footage range limit reached.');
    await recheck(s);const final=await source(s,input.sourceId,false);if(final.original.hash!==input.sourceHash)fail('Original changed before range publication.');await recheck(s);
    const bytes=JSON.stringify(next,null,2)+'\n';if(Buffer.byteLength(bytes)>2*1024*1024)fail('Saved footage references exceed the bounded journal size.');
    atomicWrite(file(s),bytes,loaded.bytes===null?{exclusive:true}:{expectedHash:loaded.expected.hash});
    return {...await view(s,load(s)),alreadySaved:false,receipt};
   });
  },
  async preview(input){
   if(!exact(input,['bindingId','parentStudyId','sourceId','expectedHash'])||!UUID.test(input.sourceId)||!HASH.test(input.expectedHash))fail('Use one exact attached original and hash.',400);
   const s=await scope(input),{original,type}=await source(s,input.sourceId,false);if(original.hash!==input.expectedHash)fail('Original video changed; reopen before playback.');
   const blob=await library.blob(input.sourceId);if(blob.source?.id!==input.sourceId||blob.file!==original.path)fail('Library original ownership changed before playback.');
   const after=await library.snapshot(input.sourceId);if(after.hash!==input.expectedHash||after.path!==blob.file)fail('Original video changed before playback.');await recheck(s);
   return {...blob,contentType:type,expectedHash:input.expectedHash};
  }
 };
}
