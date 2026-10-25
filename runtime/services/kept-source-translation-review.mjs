// Read an explicitly registered immutable proposal receipt; never execute or save.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {StateError} from '../store.mjs';
import {prepareTranslationBatch} from '../../public/document-study/translation-readiness.js';
const MAX_BYTES=2*1024*1024;
const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const hash=v=>createHash('sha256').update(v).digest('hex');
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const identifier=v=>typeof v==='string'&&v.trim().length>0&&v.length<=240&&!/[\x00-\x1f\x7f]/.test(v);
const fail=()=>{throw new StateError('The saved translation review no longer matches this conversation. Refresh its current wording.',409);};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
export const translationReviewContextHash=session=>hash(JSON.stringify(canonical(session)));
function inspect(file){
 const stats=[];let at=file;
 while(true){const stat=fs.lstatSync(at);if(stat.isSymbolicLink()||(at===file?!stat.isFile():!stat.isDirectory()))throw Error('Saved translation review requires a regular file without symlink ancestors.');stats.push([at,stat]);const parent=path.dirname(at);if(parent===at)break;at=parent;}
 if(stats[0][1].size>MAX_BYTES)throw Error('Saved translation review exceeds its size limit.');
 return stats;
}
export function validateTranslationReviewConfig(value){
 if(value===undefined||value===null)return null;
 if(!fields(value,['file','expectedSha256','sessionId','sourceId','expectedRevision','expectedSourceHash','expectedContextHash'])||typeof value.file!=='string'||!path.isAbsolute(value.file)||path.resolve(value.file)!==value.file||/[\x00-\x1f\x7f]/.test(value.file)||!identifier(value.sessionId)||!identifier(value.sourceId)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.sourceId)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||!['expectedSha256','expectedSourceHash','expectedContextHash'].every(k=>sha(value[k])))throw Error('Saved translation review requires only its exact explicit file and conversation descriptor.');
 inspect(value.file);return structuredClone(value);
}
const sameStat=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode'].every(k=>a[k]===b[k]);
function receiptBytes(descriptor){
 const before=inspect(descriptor.file);let fd;
 try{
  fd=fs.openSync(descriptor.file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const initial=fs.fstatSync(fd);if(!initial.isFile()||initial.size>MAX_BYTES||!sameStat(initial,before[0][1]))fail();
  const bytes=Buffer.alloc(initial.size);let offset=0;
  while(offset<bytes.length){const count=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!count)fail();offset+=count;}
  if(!sameStat(initial,fs.fstatSync(fd))||hash(bytes)!==descriptor.expectedSha256.toLowerCase())fail();
  const after=inspect(descriptor.file);if(after.length!==before.length||before.some(([file,stat],i)=>file!==after[i][0]||!sameStat(stat,after[i][1])))fail();
  return JSON.parse(bytes.toString('utf8'));
 }finally{if(fd!==undefined)fs.closeSync(fd);}
}
export function createKeptSourceTranslationReview({read,config=null}={}){
 const descriptor=validateTranslationReviewConfig(config);
 return {async read(input){
  if(!fields(input,['sessionId','expectedRevision','expectedSourceHash'])||!identifier(input.sessionId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!sha(input.expectedSourceHash))throw new StateError('Select the exact conversation, revision and source fingerprint.',400);
  if(!descriptor)return {state:'unavailable',gate:'no-saved-review',applied:false,proposals:[],message:'No saved translation review is connected for this conversation.'};
  // The caller pins CURRENT state; receipt provenance always stays at preparation.
  function selected(state){const matches=state.sessions?.filter(s=>s.id===input.sessionId)||[];if(matches.length!==1)fail();const session=matches[0];if(input.sessionId!==descriptor.sessionId||state.revision!==input.expectedRevision||session.sourceId!==descriptor.sourceId||session.sourceHash!==input.expectedSourceHash)fail();return session;}
  try{
   const session=structuredClone(selected(await read())),contextHash=translationReviewContextHash(session),receipt=receiptBytes(descriptor),seen=new Set();
   if(!receipt||receipt.sourceId!==descriptor.sourceId||receipt.sourceHash!==descriptor.expectedSourceHash||receipt.applied!==false||!identifier(receipt.purpose)||!Array.isArray(receipt.proposals)||!receipt.proposals.length)fail();
   for(const proposal of receipt.proposals){if(!proposal||!identifier(proposal.turnId)||seen.has(proposal.turnId)||!identifier(proposal.label)||typeof proposal.current!=='string'||!proposal.current.trim()||typeof proposal.proposal!=='string'||!proposal.proposal.trim()||/\p{Script=Han}/u.test(proposal.proposal)||(proposal.uncertainty!==undefined&&typeof proposal.uncertainty!=='string'))fail();seen.add(proposal.turnId);}
   const fresh=input.expectedRevision===descriptor.expectedRevision&&input.expectedSourceHash===descriptor.expectedSourceHash&&contextHash===descriptor.expectedContextHash.toLowerCase();
   let batch,gaps;
   if(fresh){batch=prepareTranslationBatch(session,descriptor.expectedRevision);gaps=new Set(batch.gapIds);const turns=new Map(session.turns.map(t=>[t.id,t]));if(!gaps.size||receipt.proposals.length!==gaps.size||receipt.proposals.some(p=>!gaps.has(p.turnId)||p.current!==turns.get(p.turnId)?.text))fail();}
   if(translationReviewContextHash(selected(await read()))!==contextHash)fail();
   const common={savedReview:true,applied:false,...(receipt.proposals.some(p=>!Object.hasOwn(p,'uncertainty'))?{reviewNote:'Restored proposals. Translation uncertainty notes were not retained in this saved review.'}:{}),sourceContext:{sessionId:descriptor.sessionId,sourceId:descriptor.sourceId,expectedRevision:descriptor.expectedRevision,expectedSourceHash:descriptor.expectedSourceHash}};
   if(!fresh)return {...common,state:'earlier-review',readOnly:true,message:'Earlier translation proposals are preserved for reading. The conversation has changed since they were prepared.',currentSourceContext:{...input,sourceId:session.sourceId},proposals:receipt.proposals.map(p=>({turnId:p.turnId,text:p.proposal,uncertainty:p.uncertainty||'',currentAtPreparation:p.current}))};
   return {...common,state:'proposal-ready',message:'Saved translation proposals are ready to review. Source wording has not been changed.',proposals:batch.gapIds.map(turnId=>{const p=receipt.proposals.find(p=>p.turnId===turnId);return {turnId,text:p.proposal,uncertainty:p.uncertainty||''};}),preservedTurnIds:session.turns.filter(t=>!gaps.has(t.id)).map(t=>t.id)};
  }catch{fail();}
 }};
}
