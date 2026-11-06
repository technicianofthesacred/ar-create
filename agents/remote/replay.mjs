import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {atomicWrite,readJson,ensurePrivateDirectory} from '../../runtime/services/files.mjs';
export const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
export const fail=(message,status=400,code='invalid_request',details)=>{throw Object.assign(Error(message),{status,code,details});};
/** Metadata-only delivery ledger, never another manuscript. A lost owner reply
 * leaves an explicit uncertain attempt; it is never automatically re-executed. */
export function createReplay({stateDir,now=()=>Date.now()}){
 const dir=ensurePrivateDirectory(stateDir,'deliveries');
 return async function once({principalId,tool,operationId,projectId,input},run){
  const id=hash([principalId,operationId]),file=path.join(dir,id+'.json'),inputHash=hash([tool,projectId,input]);
  const previous=readJson(file,null);
  if(previous){
   if(previous.inputHash!==inputHash)fail('This operation ID already names a different remote request.',409,'operation_reused');
   if(previous.status==='complete')return {...previous.result,replayed:true,receiptIsHistorical:true};
   fail('The earlier attempt has no confirmed reply. Read current work and its owner history before preparing a new operation; this request was not run again.',409,'outcome_uncertain',{operationId,tool,ownerOutcome:'unconfirmed'});
  }
  if(fs.readdirSync(dir).length>=10000)fail('Remote delivery history needs operator review before more writes.',503,'capacity');
  const record={schema:'ar-create.remote-delivery.v1',principalId,tool,operationId,projectId,inputHash,status:'started',at:new Date(now()).toISOString()};
  try{atomicWrite(file,JSON.stringify(record)+'\n',{exclusive:true});}catch(error){if(error.status===409||error.code==='EEXIST')fail('This operation is already in progress; read its result before retrying.',409,'operation_in_progress');throw error;}
  try{const result=await run();atomicWrite(file,JSON.stringify({...record,status:'complete',result})+'\n');return result;}
  catch(error){atomicWrite(file,JSON.stringify({...record,status:'unconfirmed',errorCode:error.code||'owner_refused',httpStatus:error.status||503})+'\n');throw error;}
 };
}
