// Fill a running demo with invented work by calling the app's own entrances: the same requests the page makes.
// Where a step belongs to the author alone, this acts as the demo's author, which is acceptable only because the
// demo's home is invented and disposable. It refuses any address that is not a demo on 127.0.0.1.
import {randomUUID} from 'node:crypto';
import {toneWav,PHOTOS} from './demo-standin/media.mjs';

export function client(base){
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)||/:8841$/.test(base))throw Error('The demo seed only talks to a demo on 127.0.0.1, never the installed app on 8841.');
 const call=(actor)=>async(method,url,body,{allow=[]}={})=>{
  const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'ui'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
  if(!response.ok&&!allow.includes(response.status))throw Object.assign(Error(`${method} ${url} answered ${response.status}: ${String(text).slice(0,240)}`),{status:response.status,value});
  return value;};
 return {author:call('human:adrian'),agent:call('agent:claude-code'),base};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const uuid=()=>randomUUID();

export async function createSubject(api,title){
 const value=await api.author('POST','/api/study-draft/create-collection',{parentStudyId:uuid(),title,operationId:uuid()});
 return {title,bindingId:value.binding.id,parentStudyId:value.binding.parentStudyId};
}
export async function importFile(api,name,bytes){
 const value=await api.author('POST','/api/sources/import',{rootId:'library',folder:'',files:[{name,base64:bytes.toString('base64')}],urls:[]});
 const receipt=value.receipts?.[0];if(!receipt?.ok)throw Error('Import failed: '+JSON.stringify(receipt));return receipt.source.id;
}
/** Bring a recording in the way the page does, wait for its transcript, name the speakers and confirm the read-through. */
export async function recordingToSource(api,subject,{file,names,review=true}){
 const sourceId=await importFile(api,file,toneWav(48));
 const {jobs}=await api.author('GET','/api/recordings');const job=jobs.find(row=>row.sourceId===sourceId);if(!job)throw Error('The recording did not appear in Material.');
 await api.author('POST',`/transcription/${job.id}/start`,{});
 for(let i=0;;i++){await sleep(400);const {jobs:now}=await api.author('GET','/api/recordings'),row=now.find(item=>item.id===job.id);if(row.state==='done'&&row.transcriptReady)break;if(row.state==='failed')throw Error('Transcription failed: '+row.error);if(i>100)throw Error('Transcription did not finish.');}
 await api.author('GET',`/transcription/${job.id}/view`);
 let snapshot=await api.author('GET',`/transcription/${job.id}/snapshot`);
 if(names){const done=await api.author('POST',`/transcription/${job.id}/speakers`,{expected:snapshot.expected,names});snapshot=done.expected?done:await api.author('GET',`/transcription/${job.id}/snapshot`);}
 if(review){const done=await api.author('POST',`/transcription/${job.id}/review`,{expected:snapshot.expected,confirmed:true});snapshot=done.expected?done:await api.author('GET',`/transcription/${job.id}/snapshot`);}
 const registered=await api.author('POST','/api/recordings/source',{jobId:job.id,expected:snapshot.expected,operationId:uuid()});
 if(subject)await api.author('POST','/api/study/material/attach',{bindingId:subject.bindingId,parentStudyId:subject.parentStudyId,sourceIds:[registered.source.id],operationId:uuid()});
 return {jobId:job.id,sourceId:registered.source.id,rawSourceId:sourceId};
}
/** Keep a piece of attached material as lasting, the decision Material asks the author to make. */
export async function keepMaterial(api,projectId,sourceId,reason='Invented demo material kept as a lasting source.'){
 const flow=await api.author('GET',`/api/first-flow/material-context?projectId=${projectId}`);
 const record=flow.records.find(row=>row.id===sourceId);
 return api.author('POST','/api/first-flow/material-triage',{projectId,sourceId,expectedRevision:flow.revision,expectedHash:flow.hash,expectedSourceHash:record.hash,decision:'keep',reason,humanDecision:true,operationId:uuid()});
}
export {sleep,uuid,PHOTOS};

const scope=subject=>({bindingId:subject.bindingId,parentStudyId:subject.parentStudyId});
const query=subject=>new URLSearchParams(scope(subject)).toString();
/** Ask the stand-in AI for a proposal the way Write does, and wait until it is waiting for the author's decision. */
export async function askProposal(api,subject,{purpose,instruction,sourceIds=[],extra={}}){
 const prepared=await api.author('POST','/api/study-ai/prepare?'+query(subject),{purpose,instruction,sourceIds,...extra});
 const operationId=uuid();
 await api.author('POST','/api/study-ai/run',{...scope(subject),requestId:prepared.id,operationId});
 for(let i=0;;i++){await sleep(300);
  const status=await api.author('GET',`/api/study-ai/run?${query(subject)}&requestId=${prepared.id}&operationId=${operationId}`,undefined,{allow:[404]});
  if(status.state==='complete')break;if(status.state==='failed')throw Error('The stand-in AI did not answer: '+(status.error||status.message||JSON.stringify(status)));if(i>100)throw Error('The stand-in AI did not finish.');}
 return {requestId:prepared.id,operationId};
}
export const reviewProposal=(api,subject,requestId)=>api.author('GET',`/api/study-ai/review?${query(subject)}&requestId=${requestId}`);
export const acceptProposal=(api,subject,requestId)=>api.author('POST','/api/study-ai/accept?'+query(subject),{requestId,operationId:uuid()});
export const rejectProposal=async(api,subject,requestId,reason='Not the tone I want. Invented demo reason.')=>{const contracts=await api.author('GET','/api/study-ai/contracts?'+query(subject));return api.author('POST','/api/study-ai/reject?'+query(subject),{requestId,reason,humanDecision:true,expectedContractHash:contracts.hash});};
export const askResearch=async(api,subject,question,sourceIds)=>{
 const prepared=await api.author('POST','/api/study/research/prepare',{...scope(subject),question,sourceIds,cardIds:[]});
 await api.author('POST','/api/study/research/run',{...scope(subject),id:prepared.id});
 for(let i=0;;i++){await sleep(300);const answer=await api.author('GET',`/api/study/research/answer?${query(subject)}&id=${prepared.id}`);if(answer.status==='result-ready')return answer;if(['failed','needs-attention'].includes(answer.status)||answer.execution?.state==='failed')throw Error('Research did not answer: '+JSON.stringify(answer.execution||answer.error));if(i>100)throw Error('Research did not finish.');}
};
export const sourcesOf=async(api,subject)=>(await api.author('GET','/api/study/research?'+query(subject))).sources;
/** The author's read-through: paragraphs left alone count as read, rewrites go in as the author's words, marked ones stay out. */
export const finishProposal=(api,subject,requestId,{edits=[],marks=[]}={})=>api.author('POST','/api/study-ai/finish?'+query(subject),{requestId,operationId:uuid(),edits,marks});
export const draftState=(api,subject)=>api.author('GET','/api/study-draft/read?'+query(subject));
