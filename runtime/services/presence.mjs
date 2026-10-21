import {StateError} from '../store.mjs';

/**
 * Who is where, right now: {actor, client, session, stage, scope, dirty,
 * sequence, lastSeen}. In memory only and expires after ttlMs without a
 * heartbeat. The app posts it so agents see "Adrian has unsaved words";
 * agents post it so the app can show "Claude is working on part 2".
 */
export const SCOPE_KINDS=Object.freeze(['project','collection','draft','output','piece','source','share','concept','research','media','library']);
const ID=/^[A-Za-z0-9._:-]{1,256}$/;
const fail=message=>{throw new StateError(message,400);};
export function validScope(scope){
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).some(k=>!['kind','id'].includes(k))||!SCOPE_KINDS.includes(scope.kind)||typeof scope.id!=='string'||!ID.test(scope.id))return null;
 return {kind:scope.kind,id:scope.id};
}
export function createPresence({ttlMs=120_000,events=null,now=()=>Date.now()}={}){
 const rows=new Map();
 const prune=()=>{const cutoff=now()-ttlMs;for(const [key,row] of rows)if(Date.parse(row.lastSeen)<cutoff)rows.delete(key);};
 return {
  post(input,{actor,client}){
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['stage','scope','dirty','sequence','session','leaving'].includes(k)))fail('Presence takes stage, scope:{kind,id}, dirty, sequence and optional session.');
   const scope=validScope(input.scope);if(!scope)fail('Presence scope must be {kind,id} with a known kind ('+SCOPE_KINDS.join(', ')+').');
   if(typeof input.dirty!=='boolean')fail('dirty must be true or false.');
   if(!Number.isSafeInteger(input.sequence)||input.sequence<0)fail('sequence must be a nonnegative integer.');
   if(input.stage!==undefined&&(typeof input.stage!=='string'||input.stage.length>64||/[\x00-\x1f]/.test(input.stage)))fail('stage must be a short label.');
   if(input.session!==undefined&&(typeof input.session!=='string'||!ID.test(input.session)||input.session.length>64))fail('session must be a short opaque id.');
   const key=[actor,client,input.session||'',scope.kind,scope.id].join('\u0000'),prior=rows.get(key);
   prune();
   if(input.leaving===true){rows.delete(key);events?.emit({kind:'presence',scope,actor,client,revision:null,operationId:null,presence:{leaving:true}});return {presence:null,left:true};}
   // An older heartbeat arriving late never hides a newer one.
   if(prior&&input.sequence<prior.sequence)return {presence:prior,stale:true};
   const row=Object.freeze({actor,client,...(input.session?{session:input.session}:{}),stage:input.stage??null,scope,dirty:input.dirty,sequence:input.sequence,lastSeen:new Date(now()).toISOString()});
   rows.set(key,row);
   if(!prior||prior.dirty!==row.dirty||prior.stage!==row.stage)events?.emit({kind:'presence',scope,actor,client,revision:null,operationId:null,presence:{stage:row.stage,dirty:row.dirty,sequence:row.sequence}});
   return {presence:row,stale:false};
  },
  list({kind,id}={}){prune();return {schema:'ar-create.presence.v1',ttlMs,presence:[...rows.values()].filter(row=>(!kind||row.scope.kind===kind)&&(!id||row.scope.id===id))};},
 };
}
