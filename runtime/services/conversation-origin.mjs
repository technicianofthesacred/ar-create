import {createHash} from 'node:crypto';
import {StateError} from '../store.mjs';
export const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const HASH=/^[a-f0-9]{64}$/;
export const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export const digest=v=>createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
export const fail=(message,status=400)=>{throw new StateError(message,status);};
export function fields(v,required,optional=[]){if(!v||typeof v!=='object'||Array.isArray(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>![...required,...optional].includes(k)))fail('Use the documented explicit fields; unknown or missing fields are refused.');}
export function text(v,label,max=256){if(typeof v!=='string'||!v.trim()||v.length>max||v.includes('\0'))fail(label+' must be nonempty text up to '+max+' characters.');return v;}
export function originOf(v){
 fields(v,['provider','client','historyCoverage'],['conversationId','messageId','captureId','saidAt']);
 for(const k of ['provider','client'])text(v[k],k,80);
 for(const k of ['conversationId','messageId'])if(v[k]!==undefined)text(v[k],k,256);
 if(!['selected-only','upstream-unavailable'].includes(v.historyCoverage))fail('Capture only the supplied excerpt; full upstream history is not established.');
 if(v.captureId!==undefined&&!UUID.test(v.captureId))fail('captureId must be a stable UUID.');
 if((!v.conversationId||!v.messageId)&&!v.captureId)fail('Without both chat and message references, keep a stable captureId for retries and handoff.');
 if(v.saidAt!==undefined&&(!/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v.saidAt)||!Number.isFinite(Date.parse(v.saidAt))))fail('saidAt must be an ISO UTC time.');
 return structuredClone(v);
}
export const originKey=o=>o.conversationId&&o.messageId?{provider:o.provider,conversationId:o.conversationId,messageId:o.messageId}:{provider:o.provider,captureId:o.captureId};
export const uuidFrom=value=>{const h=digest(value);return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);};
export function pin(v){fields(v,['revision','hash']);if(!Number.isSafeInteger(v.revision)||v.revision<0||!HASH.test(v.hash||''))fail('Use the owner revision and SHA-256 hash just read.');return v;}
