// Bounded preparation over the recording owner's existing correction receipts.
// No transcription execution, canonical save, decision, or second proposal store.
import path from 'node:path';
import {digest} from './files.mjs';
import {currentActor,HUMAN_ACTORS,AGENT_ACTORS,parseActor} from './actor.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>JSON.stringify(v,(_,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a,b)=>canonical(a)===canonical(b);
const fields=(input,keys)=>{if(!object(input)||Object.keys(input).some(k=>!keys.includes(k)))fail('Unsupported transcript proposal fields.',400);};
const plain=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&s.isWellFormed()&&!/[\r\n\x00-\x1f\x7f]/.test(s);
const boundary=(s,n)=>Number.isSafeInteger(n)&&n>=0&&n<=s.length&&!(n>0&&n<s.length&&/[\uD800-\uDBFF]/.test(s[n-1])&&/[\uDC00-\uDFFF]/.test(s[n]));
const actor=()=>{const value=currentActor()?.actor;if(![...HUMAN_ACTORS,...AGENT_ACTORS].includes(value))fail('An actual human or known agent actor is required to propose corrections.',403);return value;};
function indices(value){if(!Array.isArray(value)||!value.length||value.length>30||new Set(value).size!==value.length||value.some(n=>!Number.isSafeInteger(n)||n<0))fail('Select 1–30 exact transcript segments.',400);return value;}
/** readCandidate is a trusted retained-artifact owner, never a caller-supplied
 * path or candidate text. Absence honestly leaves retranscription disconnected. */
export function createSourceTranscriptProposals({library,recordings,readCandidate=null}={}){
 const owner=recordings?.transcriptCorrections;
 async function capture({sourceId,jobId,expected}={}){
  if((sourceId!==undefined)===(jobId!==undefined)||!UUID.test(sourceId??jobId??'')||!object(expected))fail('Select one exact transcript source or recording and saved revision.',400);
  if(typeof owner?.peek!=='function')fail('The retained recording transcript owner is unavailable.',503);
  let snapshot;
  if(jobId!==undefined){snapshot=owner.peek(jobId);if(snapshot.jobId!==jobId||snapshot.expected?.jobId!==jobId||snapshot.external?.changed||!same(snapshot.expected,expected)||!HASH.test(snapshot.expected.audioHash||'')||!HASH.test(snapshot.expected.markdownHash||'')||!HASH.test(snapshot.expected.revision||''))fail('The selected recording transcript or audio changed. Inspect its current wording first.');}
  else{
   if(typeof library?.blob!=='function'||typeof recordings?.sourceSnapshot!=='function')fail('The retained recording transcript owner is unavailable.',503);
   const {source}=await library.blob(sourceId);if(source?.id!==sourceId||source.rootId!=='recordings'||source.kind!=='transcript'||path.basename(source.rel_path||'')!=='transcript.md')fail('Select the canonical recording transcript, not an imported conversation or original file.',400);
   const mapped=recordings.sourceSnapshot(source);if(mapped.managed!==true||mapped.coherent!==true||!UUID.test(mapped.jobId||'')||mapped.expected?.jobId!==mapped.jobId)fail('Open and reconcile this transcript in its existing workshop first.');
   snapshot=owner.peek(mapped.jobId);if(snapshot.jobId!==mapped.jobId||snapshot.external?.changed||!same(snapshot.expected,expected)||mapped.expected.revision!==snapshot.expected.revision||mapped.expected.markdownHash!==snapshot.expected.markdownHash||source.hash!==snapshot.expected.markdownHash)fail('The selected transcript changed. Inspect its current wording first.');
  }
  if(!Array.isArray(snapshot.segments)||snapshot.segments.length>10000)fail('This transcript exceeds the bounded source reader.');
  return {...sourceId!==undefined?{sourceId}:{},jobId:snapshot.jobId,expected:structuredClone(snapshot.expected),segments:snapshot.segments,pending:snapshot.pending||[]};
 }
 function selected(capture,values){const wanted=indices(values),rows=wanted.map(index=>{const matches=capture.segments.filter(s=>s.index===index);if(matches.length!==1||!plain(matches[0].text,12000))fail('A selected transcript segment is unavailable.');return matches[0];});if(rows.reduce((n,r)=>n+r.text.length,0)>120000)fail('Select at most 120,000 characters of source wording.',400);return rows;}
 async function termPlan(input){
  fields(input,['sourceId','jobId','expected','find','replace','segmentIndexes','occurrences']);if(!plain(input.find,160)||!plain(input.replace,160)||input.find===input.replace)fail('Supply distinct literal terms under 160 characters.',400);
  const source=await capture(input),rows=selected(source,input.segmentIndexes),matches=[];
  for(const row of rows)for(let from=0;(from=row.text.indexOf(input.find,from))!==-1;from+=input.find.length){matches.push({index:row.index,from,to:from+input.find.length,before:input.find,after:input.replace,context:{before:row.text.slice(Math.max(0,from-40),from),after:row.text.slice(from+input.find.length,from+input.find.length+40)}});if(matches.length>200)fail('Narrow the selection to at most 200 literal occurrences.',400);}
  return {source,rows,matches};
 }
 function response(source,changes,extra={}){return {...source.sourceId?{sourceId:source.sourceId}:{},jobId:source.jobId,expected:structuredClone(source.expected),applied:false,canApply:false,role:'source-correction-proposal',changes,...extra};}
 async function propose(source,changes,kind,details={}){
  const actual=actor();if(!changes.length)fail('No changed selected wording to propose.',400);if(changes.some(row=>row.after.text!==row.after.text.trim()))fail('Keep segment edge whitespace unchanged; the transcript owner stores trimmed wording.',400);const corrections=changes.map(row=>({index:row.index,text:row.after.text}));
  // Revalidate immediately before the existing owner's lock/expected check.
  await capture({...source.sourceId?{sourceId:source.sourceId}:{jobId:source.jobId},expected:source.expected});
  const proof=digest(canonical({...source.sourceId?{sourceId:source.sourceId}:{jobId:source.jobId},expected:source.expected,corrections,kind,details,actor:actual})),reason=kind+' · proposal · '+actual+' · '+proof+(details.uncertainty?.length?' · '+details.uncertainty.join(' / '):'');if(reason.length>4000)fail('Candidate uncertainty exceeds its review receipt.',400);
  const existing=source.pending.filter(p=>p.reason===reason&&p.kind==='correction');if(existing.length>1)fail('Several pending receipts match. Review them in the existing workshop.');
  if(existing.length===1)return response(source,changes,{receiptId:existing[0].id,status:'pending',createdBy:actual,reused:true,...details});
  if(typeof owner.propose!=='function')fail('The maintained pending correction writer is unavailable.',503);
  const receipt=owner.propose(source.jobId,{expected:source.expected,corrections,reason});if(!same(receipt.changes,changes))fail('The pending correction changed more than the selected wording.');if(receipt.jobId!==source.jobId||receipt.status!=='pending'||!same(receipt.expected,source.expected)||!same(receipt.corrections,corrections)||!UUID.test(receipt.id||''))fail('The pending correction receipt did not match its exact source.');
  return response(source,changes,{receiptId:receipt.id,status:'pending',createdBy:actual,reused:false,...details});
 }
 async function candidatePlan(input){
  fields(input,['sourceId','jobId','expected','candidateId','segmentIndexes']);if(!UUID.test(input.candidateId||''))fail('Select an exact retained retranscription candidate.',400);if(typeof readCandidate!=='function')fail('No retained retranscription candidate reader is connected.',503);
  const source=await capture(input),rows=selected(source,input.segmentIndexes),candidate=await readCandidate({sourceId:source.sourceId,jobId:source.jobId,candidateId:input.candidateId,segmentIndexes:rows.map(r=>r.index)});
  fields(candidate,['id','sourceId','jobId','sourceAudioHash','baselineRevision','segments','artifactHash','engine','actor']);
  if(candidate.id!==input.candidateId||candidate.sourceId!==source.sourceId||candidate.jobId!==source.jobId||candidate.sourceAudioHash!==source.expected.audioHash||!HASH.test(candidate.sourceAudioHash||'')||candidate.baselineRevision!==source.expected.revision||!HASH.test(candidate.artifactHash||'')||!plain(candidate.engine,120)||!parseActor(candidate.actor)||!Array.isArray(candidate.segments)||candidate.segments.length!==rows.length)fail('The retained candidate belongs to a different source, audio or baseline.');
  const seen=new Set();for(const row of candidate.segments){fields(row,['index','start','end','speaker','text','uncertainty']);if(!Number.isSafeInteger(row.index)||!rows.some(r=>r.index===row.index)||seen.has(row.index)||!plain(row.text,12000)||typeof row.uncertainty!=='string'||row.uncertainty.length>300||!row.uncertainty.isWellFormed())fail('The retained candidate segment mapping is unsupported.');seen.add(row.index);}
  const changes=[],uncertainty=[];for(const row of rows){const next=candidate.segments.find(r=>r.index===row.index);if(!next||next.start!==row.start||next.end!==row.end||next.speaker!==row.speaker)fail('The candidate changes selected timing or speaker identity; compare it in the recording workshop.');if(next.uncertainty)uncertainty.push('Segment '+row.index+': '+next.uncertainty);if(next.text!==row.text)changes.push({index:row.index,start:row.start,end:row.end,before:{text:row.text,speaker:row.speaker},after:{text:next.text,speaker:row.speaker}});}
  await capture(input);
  return {source,changes,details:{candidate:{id:candidate.id,artifactHash:candidate.artifactHash,engine:candidate.engine,actor:candidate.actor,role:'candidate-not-source'},uncertainty}};
 }
 return {
  capabilities:()=>({repeatedTerms:!!owner?.peek&&!!owner?.propose,retranscriptionCandidates:!!library?.blob&&!!recordings?.sourceSnapshot&&!!owner?.peek&&!!owner?.propose&&typeof readCandidate==='function',executesTranscription:false,acceptance:'existing-workshop-review-only'}),
  previewTerms:async input=>{const {source,rows,matches}=await termPlan(input);return response(source,matches,{segmentIndexes:rows.map(r=>r.index),matchMode:'literal-case-sensitive',selectionRequired:true});},
  proposeTerms:async input=>{const {source,rows,matches}=await termPlan(input);if(!Array.isArray(input.occurrences)||!input.occurrences.length||input.occurrences.length>200)fail('Choose explicit occurrences from the literal preview.',400);const wanted=new Set(),selected=[];for(const item of input.occurrences){fields(item,['index','from','to']);const key=canonical(item);if(wanted.has(key)||!matches.some(m=>m.index===item.index&&m.from===item.from&&m.to===item.to))fail('An occurrence changed or was not in the exact selected preview.');wanted.add(key);selected.push(item);}
   const changes=[];for(const row of rows){const occurrences=selected.filter(m=>m.index===row.index).sort((a,b)=>b.from-a.from);if(!occurrences.length)continue;let text=row.text,last=row.text.length;for(const m of occurrences){if(!boundary(row.text,m.from)||!boundary(row.text,m.to)||m.to>last)fail('The selected term boundaries overlap or split a Unicode character.');text=text.slice(0,m.from)+input.replace+text.slice(m.to);last=m.from;}if(!plain(text,12000))fail('The corrected segment exceeds its existing source limit.',400);changes.push({index:row.index,start:row.start,end:row.end,before:{text:row.text,speaker:row.speaker},after:{text,speaker:row.speaker}});}return propose(source,changes,'Repeated term');},
  compareCandidate:async input=>{const {source,changes,details}=await candidatePlan(input);return response(source,changes,details);},
  proposeCandidate:async input=>{const {source,changes,details}=await candidatePlan(input);return propose(source,changes,'Retranscription candidate',details);},
 };
}
