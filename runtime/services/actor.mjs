import fs from 'node:fs';
import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {StateError} from '../store.mjs';
import {atomicWrite,ensurePrivateDirectory,readJson} from './files.mjs';

/**
 * Who wrote a record. Every mutation carries an actor and a client, resolved
 * once at the HTTP boundary and read back by services through a per-request
 * context, so service input schemas never change.
 *
 * Self-declared on this Mac: the actor is an honest label, not authentication.
 * Human-only checks stop an agent from accepting its own proposal by mistake;
 * they cannot stop a local process that lies about being Adrian.
 */
export const LEGACY_ACTOR='unknown(pre-provenance)';
export const IN_PROCESS_ACTOR='unknown(in-process)';
export const HUMAN_ACTORS=Object.freeze(['human:adrian']);
export const AGENT_ACTORS=Object.freeze(['agent:claude-code','agent:codex','agent:claude-design','agent:hermes','agent:grok','agent:chatgpt']);
export const CLIENTS=Object.freeze(['ui','cli','mcp','http','file','mag-page']);
const SLUG=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const SHA=/^[a-f0-9]{7,40}$/;

export function parseActor(value){
 if(typeof value!=='string')return null;
 const actor=value.trim();
 if(HUMAN_ACTORS.includes(actor)||AGENT_ACTORS.includes(actor))return actor;
 const [kind,...rest]=actor.split(':'),name=rest.join(':');
 if(rest.length!==1)return null;
 if((kind==='cron'||kind==='import')&&SLUG.test(name))return actor;
 if(kind==='release'&&SHA.test(name))return actor;
 return null;
}
export function parseClient(value){return typeof value==='string'&&CLIENTS.includes(value.trim())?value.trim():null;}
export const isHuman=actor=>typeof actor==='string'&&actor.startsWith('human:');

const storage=new AsyncLocalStorage();
/** Run fn with an actor context. Nested calls inherit it. */
export function withActor(context,fn){return storage.run(Object.freeze({actor:context.actor,client:context.client}),fn);}
/** The actor of the current request, or null when called in-process (tests, startup). */
export function currentActor(){return storage.getStore()||null;}
/** Fields stamped into an operation record. */
export function provenance(){const ctx=currentActor();return {actor:ctx?.actor||IN_PROCESS_ACTOR,client:ctx?.client||null,at:new Date().toISOString()};}
/** Read a stored record's author; records written before stamping read as legacy. */
export function authorOf(record){
 const p=record&&typeof record==='object'?(record.provenance&&typeof record.provenance==='object'?record.provenance:record):null;
 const actor=typeof p?.actor==='string'&&(parseActor(p.actor)||p.actor.startsWith('unknown('))?p.actor:LEGACY_ACTOR;
 return {actor,client:parseClient(p?.client)};
}
/** Refuse a non-human actor. In-process calls (no request context) are not gated here. */
export function requireHuman(what='This action'){
 const ctx=currentActor();
 if(ctx&&!isHuman(ctx.actor))throw new StateError(`${what} is human-only; ${ctx.actor} may propose but not decide.`,403);
}

/**
 * Resolve the actor of an HTTP request.
 * - X-AR-Actor present: must be a known value (400 otherwise); X-AR-Client optional (default http).
 * - absent, same-origin browser (validated Origin equals this app's origin): human:adrian via ui.
 * - otherwise null. The write path then refuses (requireWriteActor), after the
 *   route's own method and Origin checks so their 405/403 answers are unchanged.
 */
export function resolveRequestActor(request,{appOrigins}){
 const header=request.headers['x-ar-actor'],clientHeader=request.headers['x-ar-client'];
 if(header!==undefined){
  const actor=parseActor(Array.isArray(header)?header.join(','):header);
  if(!actor)throw new StateError('X-AR-Actor must be human:adrian, agent:claude-code|codex|claude-design|hermes|grok|chatgpt, cron:<name>, import:<source> or release:<sha>.',400);
  let client='http';
  if(clientHeader!==undefined){client=parseClient(Array.isArray(clientHeader)?clientHeader.join(','):clientHeader);if(!client)throw new StateError('X-AR-Client must be ui, cli, mcp, http, file or mag-page.',400);}
  return {actor,client};
 }
 const origin=request.headers.origin;
 if(origin&&appOrigins.includes(origin))return {actor:'human:adrian',client:'ui'};
 return null;
}
/** Called on every write path once Origin is known to be local. */
export function requireWriteActor(){
 if(!currentActor())throw new StateError('Writes need an X-AR-Actor header (for example agent:claude-code) and X-AR-Client (cli, mcp or http).',400);
}

/**
 * Provenance for operation records that live in code this module cannot
 * change (draft receipts, transcript sessions, proposal requests). One file
 * per (area, scope, key, action); the first writer is kept on replay.
 */
const SAFE=/^[A-Za-z0-9._:-]{1,200}$/;
const part=value=>{const text=String(value);if(!SAFE.test(text)||text==='.'||text==='..')throw new StateError('Provenance key is not a safe name.',400);return text;};
export function createProvenanceLedger({dataDir}){
 const root=()=>ensurePrivateDirectory(dataDir,'provenance');
 const file=({area,scopeId,key,action='write'})=>{const dir=ensurePrivateDirectory(root(),path.join(part(area),part(scopeId)));return path.join(dir,part(key)+'.'+part(action)+'.json');};
 return {
  stamp(entry){
   if(!entry?.key)return null;
   const target=file(entry),stamp={schema:'ar-create.provenance.v1',area:entry.area,scopeId:String(entry.scopeId),key:String(entry.key),action:entry.action||'write',...provenance()};
   if(fs.existsSync(target))return readJson(target,null);
   try{atomicWrite(target,JSON.stringify(stamp,null,2)+'\n',{exclusive:true});}catch(error){if(error.status!==409)throw error;}
   return stamp;
  },
  lookup(entry){
   try{const target=file(entry);if(!fs.existsSync(target))return {actor:LEGACY_ACTOR,client:null};return authorOf(readJson(target,null));}
   catch{return {actor:LEGACY_ACTOR,client:null};}
  },
 };
}
