import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,readJson,ensurePrivateDirectory} from './files.mjs';
import {currentActor} from './actor.mjs';

// "Checked by you": a person confirmed an unclear transcript line as heard, unchanged.
// Kept beside the transcript, never written into it; it holds only while the line's
// words still have the same fingerprint.
export function createSourceLineChecks({dataDir}){
 const file=path.join(ensurePrivateDirectory(dataDir,'source-line-checks'),'checks.json');
 const read=()=>readJson(file,{schema:'ar-create.source-line-checks.v1',checks:[]});
 return {list:()=>read(),mark(input){
  const keys=['sessionId','turnId','textHash','operationId'];
  if(!input||typeof input!=='object'||Object.keys(input).some(k=>!keys.includes(k))||keys.some(k=>typeof input[k]!=='string'||!input[k]||input[k].length>256))throw new StateError('Choose one exact transcript line.',400);
  if(!/^[a-f0-9]{64}$/.test(input.textHash))throw new StateError('The line fingerprint is invalid.',400);
  const value=read(),prior=value.checks.find(c=>c.operationId===input.operationId);if(prior)return prior;
  const record={sessionId:input.sessionId,turnId:input.turnId,textHash:input.textHash,operationId:input.operationId,by:currentActor()?.actor||'unknown',at:new Date().toISOString()};
  value.checks=value.checks.filter(c=>!(c.sessionId===record.sessionId&&c.turnId===record.turnId)).concat(record);atomicWrite(file,JSON.stringify(value,null,2));return record;
 }};
}
