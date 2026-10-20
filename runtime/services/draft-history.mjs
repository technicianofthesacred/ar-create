import {createHash} from 'node:crypto';
import {render,undo} from './draft-correspondence.mjs';
import {metadata,snapshot} from './draft-correspondence-metadata.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function validatedSnapshot(model,sourceKey){
 if(model?.schema!=='mag-dev-correspondence.v1'||model.sourceKey!==sourceKey||!hash(model.sourceKey)||!hash(model.fileHash)||typeof model.prefix!=='string'||!Array.isArray(model.blocks)||model.blocks.some(block=>!block||typeof block.id!=='string'||!block.id||typeof block.raw!=='string'||typeof block.separator!=='string'||!(block.origin===null||block.origin&&hash(block.origin.fileHash)&&hash(block.origin.blockHash)&&Number.isSafeInteger(block.origin.offset)&&block.origin.offset>=0)))fail('Historical correspondence schema or source identity changed.');
 const raw=render(model),record=metadata(model),validated=snapshot(raw,record,sourceKey);
 // Round-trip through the maintained metadata validator checks IDs, boundaries and exact bytes.
 if(JSON.stringify(validated)!==JSON.stringify(model))fail('Historical correspondence did not retain its exact snapshot.');
 return {raw,model:validated,metadataRaw:JSON.stringify(record,null,2)};
}
/** Reconstruct only a receipt-owned version; caller-provided snapshots never enter this path. */
export function historicalVersion({receipt,projectId,draftRelative,sourceKey,position}){
 if(receipt?.schema!=='ar-create.project-folder-operation.v1'||receipt.projectId!==projectId||receipt.state!=='committed'||!Array.isArray(receipt.changes)||!['before','after'].includes(position))fail('Exact committed owned historical receipt required.');
 const text=receipt.changes.find(change=>!change.area&&change.relativePath===draftRelative),meta=receipt.changes.find(change=>change.area==='binding-metadata'&&change.relativePath===projectId+'.draft-correspondence.json');
 if(position==='before'){
  const inverse=receipt.correspondenceInverse;if(inverse?.schema!=='mag-dev-inverse.v1'||!hash(inverse.afterHash)||!hash(inverse.afterSnapshotHash)||!meta||!hash(meta.beforeHash))fail('This earlier version cannot be reconstructed exactly.');
  const version=validatedSnapshot(inverse.before,sourceKey);
  if(version.model.fileHash!==receipt.expectedWorkflow?.draft||text&&text.beforeHash!==version.model.fileHash||digest(version.metadataRaw)!==meta.beforeHash)fail('Historical before snapshot differs from its recorded receipt proof.');
  return version;
 }
 if(!meta||typeof meta.after!=='string'||digest(meta.after)!==meta.afterHash)fail('This saved version has no exact correspondence proof.');
 const record=JSON.parse(meta.after),raw=text?.after;
 if(typeof raw==='string'){
  if(digest(raw)!==text.afterHash)fail('Historical version bytes changed.');
  return validatedSnapshot(snapshot(raw,record,sourceKey),sourceKey);
 }
 // Identity-only operations retain text bytes in their inverse, while changing correspondence.
 const before=historicalVersion({receipt,projectId,draftRelative,sourceKey,position:'before'});
 if(before.model.fileHash!==record.fileHash||receipt.correspondenceInverse.afterHash!==record.fileHash)fail('Historical unchanged text proof differs.');
 return validatedSnapshot(snapshot(before.raw,record,sourceKey),sourceKey);
}
export function canUndoVersion(input,currentModel,currentRaw){
 if(!currentModel)return false;
 try{historicalVersion({...input,position:'before'});undo(currentModel,currentRaw,input.receipt.correspondenceInverse);return true;}catch{return false;}
}
