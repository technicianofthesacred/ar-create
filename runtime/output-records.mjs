import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const exact=(value,keys,optional=[])=>value&&typeof value==='object'&&!Array.isArray(value)&&keys.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>keys.includes(key)||optional.includes(key));
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export const outputRecordsExpected=document=>({revision:document.nativeOutputIndex?.revision??0,hash:hash(JSON.stringify({outputs:document.outputs,nativeOutputIndex:document.nativeOutputIndex??null}))});
export function validateOutputIndex(value,outputs,StateError){
 const fail=message=>{throw new StateError(message);};
 if(!exact(value,['schema','revision','records'])||value.schema!=='ar-create.native-output-index.v1'||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.records)||value.records.length>100)fail('Native output index requires bounded pointer metadata.');
 const ids=new Set();
 for(const record of value.records){
  if(!exact(record,['outputId','wordOwner','captureId','proofId','historyIds','createdAt','updatedAt'])||!['outputId','captureId','proofId'].every(key=>opaque(record[key]))||!Array.isArray(record.historyIds)||record.historyIds.length>100||!record.historyIds.every(opaque)||new Set(record.historyIds).size!==record.historyIds.length||!['createdAt','updatedAt'].every(key=>typeof record[key]==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(record[key])&&Number.isFinite(Date.parse(record[key]))))fail('Native output records contain only IDs and history dates.');
  const owner=record.wordOwner;
  if(!(exact(owner,['kind','bindingId','parentStudyId'])&&owner.kind==='native'&&opaque(owner.bindingId)&&opaque(owner.parentStudyId))&&!(exact(owner,['kind','projectId','documentId','outputId'])&&owner.kind==='carousel-words'&&['projectId','documentId','outputId'].every(key=>typeof owner[key]==='string'&&owner[key].trim())&&owner.outputId===record.outputId))fail('Output wording owner must be an explicit native or carousel pointer.');
  if(['article','post','product-listing'].includes(outputs.find(output=>output.id===record.outputId)?.kind)&&owner.kind!=='native')fail('Article words require a native owner.');
  if(ids.has(record.outputId)||!outputs.some(output=>output.id===record.outputId))fail('Native output pointers require unique existing outputs.');
  ids.add(record.outputId);
 }
 if(ids.size!==outputs.length)fail('Every persisted output requires its own metadata pointer.');
 return value;
}
export function outputPrivatePrefix(projectId,documentId){return `native-outputs/${hash(projectId)}/${hash(documentId)}/`;}
export function outputOperationInputHash(input){return hash(JSON.stringify({projectId:input.projectId,documentId:input.documentId,expectedOutput:{revision:input.expectedOutput.revision,hash:input.expectedOutput.hash},operationId:input.operationId,commandHash:input.commandHash}));}
