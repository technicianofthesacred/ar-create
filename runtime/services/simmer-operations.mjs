// Durable coordination receipts, not another source or manuscript authority.
import fs from 'node:fs';
import path from 'node:path';
import {atomicWrite, ensurePrivateDirectory, digest} from './files.mjs';
import {StateError} from '../store.mjs';
const queues=new Map();
export const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const operationHash=value=>digest(stable(value));
export function simmerOperations(dataDir){
 const dir=()=>ensurePrivateDirectory(dataDir,'simmer-operations');
 const file=id=>path.join(dir(),digest(id)+'.json');
 const read=id=>{try{return JSON.parse(fs.readFileSync(file(id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const write=record=>{if(['partial','complete'].includes(record.status)){record.activity||=[];const status=record.status==='complete'?'committed':'partial';if(!record.activity.some(r=>r.status===status))record.activity.push({status,at:record.updatedAt||record.at,steps:structuredClone(record.steps)});}atomicWrite(file(record.operationId),JSON.stringify(record,null,2));return record;};
 const summary=r=>({operationId:r.operationId,kind:r.kind,subject:r.subject,status:r.status,at:r.at,updatedAt:r.updatedAt||r.at,steps:Object.fromEntries(Object.entries(r.steps).map(([key,step])=>[key,step.status==='running'?{...step,status:'unconfirmed'}:step])),recovery:r.status==='complete'?null:{action:'Retry the identical command with the same operationId. If the board changed, read it and include resume with its expectedRevision and expectedHash.',command:'simmer.'+r.kind,operationId:r.operationId},...(r.error?{error:r.error}:{})});
 const records=()=>fs.readdirSync(dir()).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(dir(),n),'utf8')));
 const list=subject=>records().filter(r=>r.subject===subject).map(summary);
 const activityReceipts=()=>records().flatMap(r=>(r.activity||[]).map(transition=>({id:'simmer:'+r.operationId+':'+transition.status,operationId:r.operationId,command:'simmer.'+r.kind,kind:r.kind,actor:r.actor,client:r.client,scope:{kind:'project',id:r.subject},at:transition.at,status:transition.status,after:{subject:r.subject,steps:transition.steps}})));

 const serial=(subject,fn)=>{const key=path.resolve(dataDir)+':'+subject,run=(queues.get(key)||Promise.resolve()).then(fn,fn);const settled=run.catch(()=>{});queues.set(key,settled);return run.finally(()=>{if(queues.get(key)===settled)queues.delete(key);});};
 const verify=(r,kind,input,actor)=>{if(r&&(r.kind!==kind||r.payloadHash!==operationHash(input)||r.actor!==actor))throw new StateError('This operationId already belongs to different input or a different carrier. Keep the original request, or start a new operation.',409);};
 return {read,write,summary,list,serial,verify,activityReceipts};
}
