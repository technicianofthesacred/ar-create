// Exact traceability receipts beside the draft. Never writes manuscript or source bytes.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {atomicWrite,ensurePrivateDirectory,digest,readJson} from './files.mjs';
import {currentActor,requireWriteActor} from './actor.mjs';
import {StateError} from '../store.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys.sort().join(',');
const fail=(message,status=409)=>{throw new StateError(message,status);};
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const readable=(value,max)=>typeof value==='string'&&value.length<=max&&value.isWellFormed()&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const range=(o,text,field)=>Number.isSafeInteger(o.from)&&Number.isSafeInteger(o.to)&&o.from>=0&&o.to>o.from&&o.to<=text.length&&typeof o[field]==='string'&&o[field].trim()&&text.slice(o.from,o.to)===o[field]&&!(o.from>0&&/[\uDC00-\uDFFF]/.test(text[o.from]))&&!(o.to<text.length&&/[\uDC00-\uDFFF]/.test(text[o.to]));
export function createStudyQuoteLinks({dataDir,drafts}){
 const root=ensurePrivateDirectory(dataDir,'study-quote-links');
 const scope=input=>{
  if(!uuid.test(input.bindingId||'')||typeof input.parentStudyId!=='string'||!input.parentStudyId||input.parentStudyId.length>256)fail('Choose one exact native draft.',400);
  return {bindingId:input.bindingId,parentStudyId:input.parentStudyId};
 };
 const directory=s=>ensurePrivateDirectory(root,digest(stable(s)));
 const file=(s,id)=>{if(!uuid.test(id||''))fail('Choose an exact quote link.',400);return path.join(directory(s),id+'.json');};
 async function read(s){const d=await drafts.read(s);if(d.binding?.id!==s.bindingId||d.binding?.parentStudyId!==s.parentStudyId||d.readiness?.ready===false)fail('The exact saved native draft is unavailable.');return d;}
 function validate(record,d){
  if(!isDeepStrictEqual(record.expected,d.expected))fail('The saved draft revision changed. Select the quote again.');
  const p=record.paragraph,row=d.projection?.find(r=>r.id===p.id);
  if(!row||row.safe===false||row.blockHash!==p.blockHash||!range(p,row.words,'text'))fail('The linked paragraph or exact words changed. Select the quote again.');
  const sources=[...(d.context?.records||[]),...(d.addedSources?.records||[])],s=record.source;
  const matches=sources.filter(r=>r.id===s.id&&!r.missing&&['source','transcript'].includes(r.role));
  if(matches.length!==1)fail('The captured original source is unavailable or ambiguous.');
  const source=matches[0],raw=source.raw;
  if(typeof raw!=='string'||digest(raw)!==s.hash||source.copiedHash!==s.hash||!range(s,raw,'quote')||p.text!==s.quote)fail('The source revision or exact passage changed. Select the quote again.');
  return {id:s.id,hash:s.hash,title:path.basename(source.sourcePath||source.id),before:raw.slice(Math.max(0,s.from-500),s.from),quote:s.quote,after:raw.slice(s.to,s.to+500),from:s.from,to:s.to};
 }
 const publicLink=(r,d)=>{try{validate(r,d);return {id:r.id,paragraph:r.paragraph,source:r.source,active:true};}catch(e){return {id:r.id,paragraph:r.paragraph,source:r.source,active:false,reason:e.message};}};
 return {
  async create(input){
   requireWriteActor();
   if(!exact(input,['bindingId','parentStudyId','operationId','expected','paragraph','source'])||!exact(input.paragraph,['id','blockHash','from','to','text'])||!exact(input.source,['id','hash','from','to','quote'])||!uuid.test(input.operationId||''))fail('Use the exact paragraph and captured-source quote contract.',400);
   if(!readable(input.paragraph.id,1024)||!readable(input.source.id,1024)||!readable(input.paragraph.text,12000)||!readable(input.source.quote,12000)||!(/^[a-f0-9]{64}$/).test(input.paragraph.blockHash)||!(/^[a-f0-9]{64}$/).test(input.source.hash)||!input.expected||typeof input.expected!=='object'||Array.isArray(input.expected)||stable(input.expected).length>16000)fail('Quote link fields exceed the exact bounded contract.',400);
   const s=scope(input),requestHash=digest(stable(input)),target=file(s,input.operationId),prior=readJson(target,null),actor=currentActor();
   if(prior&&(prior.requestHash!==requestHash||prior.actor!==actor.actor))fail('This operation belongs to a different quote link.');
   if(!prior&&fs.readdirSync(directory(s)).filter(n=>n.endsWith('.json')).length>=2000)fail('Too many quote links for this draft.',413);
   const d=await read(s),record={schema:'ar-create.study-quote-link.v1',id:input.operationId,...s,expected:input.expected,paragraph:input.paragraph,source:input.source,requestHash,actor:actor.actor,client:actor.client,createdAt:prior?.createdAt||new Date().toISOString()};
   validate(record,d);
   if(!prior)atomicWrite(target,JSON.stringify(record,null,2)+'\n',{exclusive:true});
   return {link:publicLink(record,d),replay:!!prior};
  },
  async list(input){const s=scope(input),d=await read(s),dir=directory(s),names=fs.readdirSync(dir).filter(n=>uuid.test(n.slice(0,-5))&&n.endsWith('.json'));if(names.length>2000)fail('Too many quote links for this draft.',413);return {expected:d.expected,links:names.map(n=>readJson(path.join(dir,n),null)).filter(r=>r&&r.bindingId===s.bindingId&&r.parentStudyId===s.parentStudyId).map(r=>publicLink(r,d))};},
  async source(input){const s=scope(input),record=readJson(file(s,input.id),null);if(!record||record.bindingId!==s.bindingId||record.parentStudyId!==s.parentStudyId)fail('This quote link is unavailable.',404);const d=await read(s);return {expected:d.expected,link:publicLink(record,d),source:validate(record,d)};}
 };
}
