import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,regular} from './files.mjs';
import {parseActor} from './actor.mjs';
import {validScope} from './presence.mjs';

/**
 * The append-only record of who did what: data/journal/<yyyy-mm>.jsonl, one
 * line per operation, written through the same atomic write as every other
 * record (whole-file replace guarded by the previous file's hash).
 * {ts, operationId, actor, client, scope:{kind,id}, kind, status, before, after, reason, to?, summary?}
 * status: pending | committed | rejected | conflict | handoff | needs-decision
 */
export const STATUSES=Object.freeze(['pending','committed','rejected','conflict','handoff','needs-decision']);
const MONTH=/^\d{4}-\d{2}\.jsonl$/;
export function createJournal({dataDir,now=()=>new Date()}={}){
 let queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const dir=()=>ensurePrivateDirectory(dataDir,'journal');
 function append(line){return serial(()=>{
  if(!STATUSES.includes(line.status))throw new StateError('Unknown journal status.',400);
  const at=now(),value={ts:at.toISOString(),operationId:line.operationId??null,actor:line.actor,client:line.client??null,scope:line.scope??{kind:'system',id:null},kind:line.kind,status:line.status,before:line.before??null,after:line.after??null,reason:line.reason??null,...(line.to?{to:line.to}:{}),...(line.summary?{summary:line.summary}:{}),...(line.options?{options:line.options}:{}),...(line.http?{http:line.http}:{})};
  const target=path.join(dir(),at.toISOString().slice(0,7)+'.jsonl'),stat=fs.lstatSync(target,{throwIfNoEntry:false});
  let previous=Buffer.alloc(0);if(stat){regular(target);previous=fs.readFileSync(target);}
  atomicWrite(target,Buffer.concat([previous,Buffer.from(JSON.stringify(value)+'\n')]),stat?{expectedHash:digest(previous)}:{exclusive:true});
  return value;
 });}
 async function read({kind,id,status,actor,since,limit=100}={}){
  await queue;
  const root=path.join(dataDir,'journal');if(!fs.existsSync(root))return {schema:'ar-create.journal.v1',lines:[]};
  const files=fs.readdirSync(root).filter(name=>MONTH.test(name)).sort().reverse(),out=[],max=Math.max(1,Math.min(Number(limit)||100,1000));
  for(const name of files){
   const lines=fs.readFileSync(path.join(root,name),'utf8').split('\n').filter(Boolean).reverse();
   for(const text of lines){let row;try{row=JSON.parse(text);}catch{continue;}
    if(kind&&row.scope?.kind!==kind||id&&row.scope?.id!==id||status&&row.status!==status||actor&&row.actor!==actor||since&&row.ts<=since)continue;
    out.push(row);if(out.length>=max)return {schema:'ar-create.journal.v1',lines:out};}
  }
  return {schema:'ar-create.journal.v1',lines:out};
 }
 const text=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b-\x1f]/.test(value))throw new StateError(label+' must be plain text up to '+max+' characters.',400);return value;};
 const fields=(input,allowed)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new StateError('Use only '+allowed.join(', ')+'.',400);};
 return {
  append,read,
  /** An agent finishes and names who goes next. */
  handoff(input,context){fields(input,['scope','to','summary','operationId']);const scope=validScope(input.scope);if(!scope)throw new StateError('A handoff needs scope:{kind,id}.',400);const to=parseActor(input.to);if(!to)throw new StateError('to must be an actor, for example human:adrian.',400);return append({operationId:input.operationId??null,actor:context.actor,client:context.client,scope,kind:'handoff',status:'handoff',to,summary:text(input.summary,'summary',280)});},
  /** An agent needs a decision only a human can make; the app shows it. */
  ask(input,context){fields(input,['scope','question','options','to','operationId']);const scope=validScope(input.scope);if(!scope)throw new StateError('A question needs scope:{kind,id}.',400);const to=input.to===undefined?'human:adrian':parseActor(input.to);if(!to)throw new StateError('to must be an actor.',400);if(input.options!==undefined&&(!Array.isArray(input.options)||input.options.length>5||input.options.some(o=>typeof o!=='string'||!o.trim()||o.length>80)))throw new StateError('options are up to five short choices.',400);return append({operationId:input.operationId??null,actor:context.actor,client:context.client,scope,kind:'ask',status:'needs-decision',to,summary:text(input.question,'question',280),...(input.options?{options:input.options}:{})});},
 };
}
