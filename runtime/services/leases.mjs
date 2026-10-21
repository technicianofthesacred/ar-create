import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {StateError} from '../store.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,regular} from './files.mjs';
import {validScope} from './presence.mjs';
import {isHuman} from './actor.mjs';

/**
 * Advisory leases: "I am working on this record". data/leases/<kind>/<id>.json
 * {schema, leaseId, scope, actor, client, reason, acquiredAt, expiresAt}.
 * 15 minutes, renewable by the holder. A write to a record under someone
 * else's live lease answers 423 with the holder, before any bytes change.
 * The holder is the actor; a human may release anyone's lease (force).
 */
export const LEASE_MS=15*60_000;
const SCHEMA='ar-create.lease.v1';
export function createLeases({dataDir,now=()=>Date.now(),events=null}={}){
 let queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const scopeOrFail=scope=>{const valid=validScope(scope);if(!valid||valid.id==='.'||valid.id==='..')throw new StateError('A lease needs scope:{kind,id} with a known kind and a plain id.',400);return valid;};
 // Reads never create folders; only acquire/release do.
 const file=(scope,create=false)=>path.join(create?ensurePrivateDirectory(dataDir,path.join('leases',scope.kind)):path.join(dataDir,'leases',scope.kind),scope.id+'.json');
 const readFile=(scope,create=false)=>{const target=file(scope,create);if(!fs.lstatSync(target,{throwIfNoEntry:false}))return {target,lease:null,bytes:null};regular(target);const bytes=fs.readFileSync(target);let lease=null;try{lease=JSON.parse(bytes);}catch{}return {target,lease:lease?.schema===SCHEMA?lease:null,bytes};};
 const live=lease=>!!lease&&Date.parse(lease.expiresAt)>now();
 const holder=lease=>({actor:lease.actor,client:lease.client,reason:lease.reason||null,acquiredAt:lease.acquiredAt,expiresAt:lease.expiresAt,leaseId:lease.leaseId});
 const locked=(lease,what='This record')=>Object.assign(new StateError(`${what} is being worked on by ${lease.actor} until ${lease.expiresAt}${lease.reason?' ('+lease.reason+')':''}. Wait, ask them to release it, or (human only) release it with force.`,423),{outcome:'not-applied',holder:holder(lease)});
 const write=(target,bytes,value)=>atomicWrite(target,JSON.stringify(value,null,2)+'\n',bytes===null?{exclusive:true}:{expectedHash:digest(bytes)});
 const ttl=value=>{if(value===undefined)return LEASE_MS;if(!Number.isSafeInteger(value)||value<1000||value>LEASE_MS)throw new StateError('ttlMs must be between 1000 and '+LEASE_MS+'.',400);return value;};
 const fields=(input,allowed)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new StateError('Use only '+allowed.join(', ')+'.',400);};
 return {
  /** Throw 423 when someone else holds a live lease on this record. */
  check(scope,context){
   const valid=validScope(scope);if(!valid||!context)return;
   const {lease}=readFile(valid);if(live(lease)&&lease.actor!==context.actor)throw locked(lease);
  },
  read(scope){const {lease}=readFile(scopeOrFail(scope));return live(lease)?lease:null;},
  acquire(input,context){return serial(()=>{
   fields(input,['scope','reason','ttlMs']);const scope=scopeOrFail(input.scope),{target,lease,bytes}=readFile(scope,true);
   if(input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>200))throw new StateError('reason must be a short sentence.',400);
   if(live(lease)&&lease.actor!==context.actor)throw locked(lease);
   const at=now(),renewing=live(lease),next={schema:SCHEMA,leaseId:renewing?lease.leaseId:randomUUID(),scope,actor:context.actor,client:context.client,reason:input.reason??lease?.reason??null,acquiredAt:renewing?lease.acquiredAt:new Date(at).toISOString(),renewedAt:new Date(at).toISOString(),expiresAt:new Date(at+ttl(input.ttlMs)).toISOString()};
   write(target,bytes,next);events?.emit({kind:renewing?'lease.renew':'lease.acquire',scope,actor:context.actor,client:context.client,revision:null,operationId:null,lease:holder(next)});
   return {lease:next,renewed:renewing};
  });},
  release(input,context){return serial(()=>{
   fields(input,['scope','leaseId','force']);const scope=scopeOrFail(input.scope),{target,lease,bytes}=readFile(scope,true);
   if(!lease)return {released:false,lease:null};
   if(live(lease)&&lease.actor!==context.actor){if(input.force!==true||!isHuman(context.actor))throw Object.assign(locked(lease),{status:423});}
   if(input.leaseId!==undefined&&input.leaseId!==lease.leaseId&&lease.actor===context.actor)throw new StateError('That lease was replaced; read the current lease first.',409);
   const ended={...lease,expiresAt:new Date(now()).toISOString(),releasedAt:new Date(now()).toISOString(),releasedBy:context.actor};
   write(target,bytes,ended);events?.emit({kind:'lease.release',scope,actor:context.actor,client:context.client,revision:null,operationId:null,lease:holder(ended)});
   return {released:true,lease:ended};
  });},
  list({kind,id}={}){
   const root=path.join(dataDir,'leases'),out=[];
   if(!fs.existsSync(root))return {schema:'ar-create.leases.v1',leases:[]};
   for(const k of fs.readdirSync(root)){if(kind&&k!==kind)continue;const dir=path.join(root,k);if(!fs.lstatSync(dir).isDirectory())continue;for(const name of fs.readdirSync(dir)){if(!name.endsWith('.json'))continue;const scopeId=name.slice(0,-5);if(id&&scopeId!==id)continue;const valid=validScope({kind:k,id:scopeId});if(!valid)continue;const {lease}=readFile(valid);if(live(lease))out.push(lease);}}
   return {schema:'ar-create.leases.v1',leases:out};
  },
 };
}
