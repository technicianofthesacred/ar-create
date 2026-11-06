import fs from 'node:fs';
import path from 'node:path';
import {atomicWrite,ensurePrivateDirectory,readJson,regular,withoutAtomicWriteObserver} from './files.mjs';
import {activityId} from './journal.mjs';

const RECEIPTS=new Set(['ar-create.study-human-direction-operation.v1','ar-create.work-continuity-operation.v1','ar-create.magazine-operation.v1']);
const ownerPath=(schema,rel,operationId)=>{
 if(path.basename(rel)!==operationId+'.json')return false;
 if(schema==='ar-create.study-human-direction-operation.v1')return /^workspaces\/.+\/human-direction-history\/[^/]+\.json$/.test(rel);
 if(schema==='ar-create.work-continuity-operation.v1')return /^(workspaces\/work-continuity\/[^/]+|native-outputs\/[^/]+\/[^/]+\/continuity\/[^/]+)\/history\/[^/]+\.json$/.test(rel);
 return schema==='ar-create.magazine-operation.v1'&&rel==='magazine/operations/'+operationId+'.json';
};
const committed=r=>r&&(r.status==='committed'||r.state==='committed');
const version=r=>({revision:r?.after?.revision??r?.result?.revision??null,hash:r?.after?.hash??r?.result?.hash??null});
/** Activity is a projection, never an owner or a recovery writer. Pending
 * descriptors precede the owner's atomic receipt rename; only a committed
 * receipt can promote one. No manuscript, request body or credentials are copied.
 */
export function createActivityRecovery({dataDir,journal,events,readNativeReceipt,ownerReceipts=()=>[],fault}={}){
 const root=()=>ensurePrivateDirectory(dataDir,'activity-outbox');
 const save=value=>withoutAtomicWriteObserver(()=>atomicWrite(path.join(root(),value.id+'.json'),JSON.stringify(value)+'\n'));
 const relative=file=>{const rel=path.relative(dataDir,file);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))return null;return rel;};
 function receiptFile(rel){
  if(typeof rel!=='string'||path.isAbsolute(rel)||rel.split(path.sep).some(p=>p==='..'||p==='.'||!p))throw Error('Invalid activity receipt path.');
  let file=dataDir;for(const part of rel.split(path.sep)){file=path.join(file,part);const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Activity receipt path is linked.');}regular(file);return file;
 }
 function observe(getMeta,{file,bytes,phase,observed}){
  if(phase==='after'){
   fault?.('after-owner-commit',observed);
   // Keep a small durable acknowledgement so a mutable receipt's later update
   // cannot erase an operation already seen committed by this request.
   save({...observed,verified:true});return;
  }
  if(!file.endsWith('.json'))return;const meta=getMeta();if(!meta?.operationId)return;
  let receipt;try{receipt=JSON.parse(String(bytes));}catch{return;}
  if(!RECEIPTS.has(receipt?.schema)||receipt.operationId!==meta.operationId||!committed(receipt))return;
  const rel=relative(file);if(!rel||!ownerPath(receipt.schema,rel,receipt.operationId))return;
  const line={...meta,ts:meta.ts||new Date().toISOString(),status:'committed',after:version(receipt)},id=activityId(line);
  const descriptor={schema:'ar-create.activity-outbox.v1',id,line,receipt:{path:rel,schema:receipt.schema,operationId:receipt.operationId},verified:false};
  save(descriptor);fault?.('before-owner-commit',descriptor);return descriptor;
 }
 function beginNative(line,input){
  if(!readNativeReceipt||!input?.bindingId||!input?.parentStudyId||!input?.operationId)return;
  const value={schema:'ar-create.activity-outbox.v1',id:activityId({...line,status:'committed'}),line:{...line,ts:line.ts||new Date().toISOString(),status:'committed'},native:{bindingId:input.bindingId,parentStudyId:input.parentStudyId,operationId:input.operationId},verified:false};
  const file=path.join(root(),value.id+'.json');if(!fs.existsSync(file))save(value);
 }
 function recordResponse(line){
  const id=activityId(line),file=path.join(root(),id+'.json'),prior=readJson(file,null);
  if(prior?.line?.ts)line={...line,ts:prior.line.ts};
  save({schema:'ar-create.activity-outbox.v1',id,line,verified:true});
  if(line.status!=='committed'){
   const pendingFile=path.join(root(),activityId({...line,status:'committed'})+'.json'),pending=readJson(pendingFile,null);
   if(pending?.native&&!pending.verified)save({...pending,settled:true});
  }
 }
 function pending(){return fs.readdirSync(root()).filter(n=>/^[a-f0-9-]+\.json$/.test(n)).map(name=>readJson(path.join(root(),name),null)).map(value=>({operationId:value.line.operationId,kind:value.line.kind,scope:value.line.scope,state:value.verified?'publication-pending':'owner-receipt-unresolved'}));}

 const announced=new Set();
 function announce(line,id,pending=false){
  if(!['committed','partial'].includes(line.status)||announced.has(id))return;
  announced.add(id);events?.emit({kind:line.kind,scope:line.scope,revision:line.after?.revision??null,actor:line.actor,client:line.client,operationId:line.operationId,activityId:id,status:line.status,...(pending?{activityPending:true}:{})});
 }
 async function publish(line){
  try{const result=await journal.appendOnce(line);if(result.created)announce(line,result.line.activityId);return result;}
  catch(error){announce(line,activityId(line),true);throw error;}
 }
 let queue=Promise.resolve();
 function reconcile(){const work=queue.then(async()=>{
  let published=0,unresolved=0;
  for(const name of fs.readdirSync(root()).filter(n=>/^[a-f0-9-]+\.json$/.test(n))){
   const file=path.join(root(),name),value=readJson(file,null);if(value?.schema!=='ar-create.activity-outbox.v1'||value.id+'.json'!==name)throw Error('Invalid activity descriptor.');
   let line=value.line;
   if(value.receipt&&!ownerPath(value.receipt.schema,value.receipt.path,value.receipt.operationId))throw Error('Activity receipt is outside its owner.');
   if(!value.verified){
    let receipt;try{receipt=value.native?(await readNativeReceipt(value.native))?.receipt:readJson(receiptFile(value.receipt.path),null);}catch(error){if(value.settled&&(error.code==='ENOENT'||error.status===404)){fs.rmSync(file);continue;}unresolved++;continue;}
    if(!committed(receipt)||receipt.operationId!==line.operationId||value.receipt&&receipt.schema!==value.receipt.schema){unresolved++;continue;}
    line={...line,after:version(receipt)};save({...value,line,verified:true});
   }
   const result=await publish(line);if(result.created)published++;
   // Projection completed. Keep only undelivered descriptors; journal's stable
   // activity ID makes append-then-crash replay idempotent.
   fault?.('after-journal-commit',value);fs.rmSync(file);
  }
  for(const row of await ownerReceipts()){
   if(!['committed','partial'].includes(row.status))continue;
   const line={activityId:row.id,operationId:row.operationId,kind:row.command,actor:row.actor,client:row.client,scope:row.scope,ts:row.at,status:row.status,after:row.after};
   const result=await publish(line);if(result.created)published++;
  }
  return {published,unresolved,pending:pending(),coverage:{receiptRecovery:['human-direction','work-continuity','magazine','native-draft','registered-owner-projections'],otherWrites:'post-response outbox; owner-to-response crash recovery not guaranteed'}};
 });queue=work.catch(()=>{});return work;}
 return {observe,beginNative,recordResponse,reconcile};
}
