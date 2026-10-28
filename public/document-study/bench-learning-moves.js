/* Ephemeral exact targets from existing read owners. No task state or writes. */
import {reviewIssues} from '../lib/transcript-review-issues.js';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,SHA=/^[a-f0-9]{64}$/;
export const stable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const fail=message=>{throw Error(message);};
export const moveKey=row=>stable([row.kind,row.projectId,row.backendProjectId,row.documentId,row.jobId??row.requestId,row.segmentIndex??row.claimId]);
const row=(base,proof)=>{const out={...base,proof:stable(proof)};return {...out,key:moveKey(out)};};
export function researchMoves(base,flow){
 const r=flow.research;if(!r)return{rows:[],unknown:[]};
 if(r.stale||r.status!=='result-ready'||!UUID.test(r.requestId||'')||!SHA.test(r.hash||'')||!Array.isArray(r.editorial?.claims))return{rows:[],unknown:['Current Research findings are unavailable or stale.']};
 const hash=r.editorialHash||r.hash,claims=r.editorial.claims;if(!SHA.test(hash)||new Set(claims.map(c=>c.id)).size!==claims.length)return{rows:[],unknown:['Research claim identity is unavailable.']};
 const rows=[],unknown=[];
 for(const c of claims.filter(c=>c.flag)){
  if(typeof c.id!=='string'||!c.id||typeof c.quote!=='string'||!SHA.test(c.sourceHash||'')||!(flow.researchMaterials||flow.materials).some(m=>m.sourceId===c.sourceId&&m.hash===c.sourceHash)){unknown.push('A flagged Research source changed or is unavailable.');continue;}
  const decision=r.decisions?.[c.id];
  if(decision){if(decision.stale||decision.requestId!==r.requestId||decision.resultHash!==r.hash||decision.editorialHash!==hash||decision.claimId!==c.id||decision.quote!==c.quote||decision.sourceHash!==c.sourceHash){unknown.push('An earlier Research decision needs current source review.');}continue;}
  rows.push(row({...base,kind:'research',requestId:r.requestId,claimId:c.id,label:'Review flagged wording',title:c.statement||'Research finding'},[r.requestId,r.hash,hash,c,r.checking?.state??null]));
 }
 return{rows,unknown};
}
export function sourceMoves(base,material,snapshot){
 if(snapshot.jobId!==material.job.id||!snapshot.expected||snapshot.expected.jobId!==material.job.id||!SHA.test(snapshot.expected.revision||'')||snapshot.expected.markdownHash!==material.hash||!Array.isArray(snapshot.result?.segments)||!Array.isArray(snapshot.segments)||snapshot.external?.changed||snapshot.pending?.length)fail('The current recording needs inspection or correction recovery.');
 if(snapshot.reviewStatus==='reviewed')return[];
 return reviewIssues(snapshot.result).map(issue=>{
  const s=snapshot.segments[issue.index],original=snapshot.result.segments[issue.index];
  if(!s||s.index!==issue.index||s.identity!==material.job.id+':'+issue.index||s.text!==original.text||s.start!==original.start||s.end!==original.end||s.speaker!==original.speaker)fail('The exact recording passage identity is unavailable.');
  return row({...base,kind:'source',sourceId:material.sourceId,jobId:material.job.id,segmentIndex:issue.index,label:'Review source passage',title:material.title||'Recording',reasons:issue.reasons},[material.sourceId,material.hash,material.job.id,snapshot.expected,s,issue.reasons]);
 });
}
export async function readMoves(projectId,{get,maxRecordings=12,expectedOwner}={}){
 if(typeof projectId!=='string'||!projectId||typeof get!=='function')fail('Choose an exact existing project.');
 const binding=await get('/api/first-flow/binding?projectKey='+encodeURIComponent(projectId));
 if(binding.projectKey!==projectId||!UUID.test(binding.projectId||'')||!UUID.test(binding.documentId||'')||expectedOwner&&(binding.projectId!==expectedOwner.projectId||binding.documentId!==expectedOwner.documentId))fail('The saved project binding is unavailable.');
 const [materialRead,researchRead]=await Promise.allSettled([get('/api/first-flow/material-context?projectId='+encodeURIComponent(binding.projectId)),get('/api/first-flow/context?projectId='+encodeURIComponent(binding.projectId))]);
 const unavailable=[],flow={projectId:binding.projectId,materials:[]};
 const verify=(value,schema)=>{if(value?.schema!==schema||value.projectId!==binding.projectId||value.documentId!==binding.documentId||!SHA.test(value.hash||''))fail('The saved project/document context changed.');};
 if(materialRead.status==='fulfilled'){const c=materialRead.value;verify(c,'ar-create.first-flow-material-context.v1');if(!Array.isArray(c.records)||new Set(c.records.map(r=>r.id)).size!==c.records.length)fail('The attached material identities are unavailable.');flow.materials=c.records.filter(r=>!r.missing).map(r=>({sourceId:r.id,hash:r.hash,title:r.title,kind:r.kind,reviewed:r.review?.state==='reviewed',...(r.kind==='transcript'&&r.review?.transcript?.jobId?{job:{id:r.review.transcript.jobId}}:{})}));if(c.records.some(r=>r.missing))unavailable.push('Some attached material is unavailable.');if(c.records.some(r=>['audio','video'].includes(r.kind)))unavailable.push('Attached audio without an exact canonical transcript identity is not counted.');}else unavailable.push('Source membership is unavailable: '+materialRead.reason.message);
 if(researchRead.status==='fulfilled'){const c=researchRead.value;verify(c,'ar-create.first-flow-context.v1');if(c.available===true){if(!Array.isArray(c.sources)||!Array.isArray(c.lineDecisions)||!Array.isArray(c.artifacts))fail('The saved Research context is incomplete.');const decisions={};for(const decision of c.lineDecisions)decisions[decision.claimId]=decision;flow.research={requestId:c.requestId,status:'result-ready',hash:c.resultHash,editorialHash:c.editorialHash,stale:false,editorial:c.editorial,checking:c.checking,decisions,body:c.artifacts.find(a=>a.kind==='research')?.body||'',brief:c.artifacts.find(a=>a.kind==='brief')?.body||''};flow.researchMaterials=c.sources.map(source=>({sourceId:source.id,hash:source.hash}));}else if(c.available!==false)fail('The saved Research availability is unconfirmed.');}else unavailable.push('Research findings are unavailable: '+researchRead.reason.message);
 const base={projectId,backendProjectId:binding.projectId,documentId:binding.documentId},result=researchMoves(base,flow),recordings=[];result.unknown.push(...unavailable);result.snapshots={};
 const jobs=new Map();for(const m of flow.materials.filter(m=>m.job?.id&&['transcript','audio','video'].includes(m.kind))){const group=jobs.get(m.job.id)||[];group.push(m);jobs.set(m.job.id,group);}
 for(const group of jobs.values()){const transcripts=group.filter(m=>m.kind==='transcript'),chosen=transcripts.length?transcripts:group;if(chosen.length!==1){result.unknown.push('An attached recording has ambiguous source membership.');continue;}recordings.push(chosen[0]);}
 if(recordings.length>maxRecordings)result.unknown.push('Recording review is limited to '+maxRecordings+' attached recordings; further recordings were not counted.');
 let at=0;await Promise.all(Array.from({length:Math.min(2,recordings.length,maxRecordings)},async()=>{while(at<Math.min(recordings.length,maxRecordings)){const m=recordings[at++];try{if(!UUID.test(m.job.id)||!UUID.test(m.sourceId||'')||!SHA.test(m.hash||''))throw Error('An attached recording is not ready for exact review.');const snapshot=await get('/transcription/'+encodeURIComponent(m.job.id)+'/snapshot?readOnly=1');const rows=sourceMoves(base,m,snapshot);m.job={...m.job,state:'done',transcriptReady:true,url:'/transcription/'+encodeURIComponent(m.job.id)+'/view'};result.rows.push(...rows);if(rows.length)result.snapshots[m.job.id]=snapshot;}catch(e){result.unknown.push('An attached canonical transcript needs Source inspection before its flagged passages can be counted.');}}}));
 return {...result,binding,flow};
}
