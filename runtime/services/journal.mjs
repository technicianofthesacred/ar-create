import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
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
export const STATUSES=Object.freeze(['pending','committed','rejected','conflict','handoff','needs-decision','partial']);
const MONTH=/^\d{4}-\d{2}\.jsonl$/;
export function activityId(line){return line.activityId|| (line.operationId?digest(JSON.stringify([line.kind,line.operationId,line.status])):randomUUID());}
export function createJournal({dataDir,now=()=>new Date(),beforeAppend}={}){
 let queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const dir=()=>ensurePrivateDirectory(dataDir,'journal');
 let index=null;
 const files=()=>{const root=path.join(dataDir,'journal');return fs.existsSync(root)?fs.readdirSync(dir()).filter(name=>MONTH.test(name)).sort().reverse():[];};
 function rows(name){const target=path.join(dataDir,'journal',name);regular(target);return fs.readFileSync(target,'utf8');}
 function loadIndex(){if(index)return;index=new Map();for(const name of files())for(const text of rows(name).split('\n')){if(!text)continue;let row;try{row=JSON.parse(text);}catch{continue;}if(row.activityId||row.operationId)index.set(activityId(row),row);}}
 function appendOnce(line){return serial(()=>{
  if(!STATUSES.includes(line.status))throw new StateError('Unknown journal status.',400);
  loadIndex();const id=activityId(line);if(index.has(id))return {line:index.get(id),created:false};
  const at=now(),value={ts:line.ts||at.toISOString(),activityId:id,operationId:line.operationId??null,actor:line.actor,client:line.client??null,scope:line.scope??{kind:'system',id:null},kind:line.kind,status:line.status,before:line.before??null,after:line.after??null,reason:line.reason??null,...(line.to?{to:line.to}:{}),...(line.summary?{summary:line.summary}:{}),...(line.options?{options:line.options}:{}),...(line.http?{http:line.http}:{})};
  const target=path.join(dir(),at.toISOString().slice(0,7)+'.jsonl'),stat=fs.lstatSync(target,{throwIfNoEntry:false});
  let previous=Buffer.alloc(0);if(stat){regular(target);previous=fs.readFileSync(target);}
  beforeAppend?.(value);
  atomicWrite(target,Buffer.concat([previous,Buffer.from(JSON.stringify(value)+'\n')]),stat?{expectedHash:digest(previous)}:{exclusive:true});
  index.set(id,value);return {line:value,created:true};
 });}
 const append=async line=>(await appendOnce(line)).line;
 async function read({kind,id,status,actor,since,before,limit=100}={}){
  await queue;
  const filter=digest(JSON.stringify([kind||null,id||null,status||null,actor||null,since||null]));
  let cursor=null;
  if(before){try{cursor=JSON.parse(Buffer.from(before,'base64url').toString());}catch{}if(!cursor||cursor.v!==1||!MONTH.test(cursor.file)||!Number.isSafeInteger(cursor.offset)||cursor.offset<0||cursor.filter!==filter)throw new StateError('History cursor is invalid or belongs to another filter.',400);}
  const out=[],max=Math.max(1,Math.min(Number(limit)||100,1000));let nextCursor=null,hasMore=false;
  for(const name of files()){
   if(cursor&&name>cursor.file)continue;
   const text=rows(name);let end=cursor&&name===cursor.file?Math.min(cursor.offset,text.length):text.length;
   while(end>0){if(text[end-1]==='\n')end--;const start=text.lastIndexOf('\n',end-1)+1,raw=text.slice(start,end);end=start;
    let row;try{row=JSON.parse(raw);}catch{continue;}
    if(kind&&row.scope?.kind!==kind||id&&row.scope?.id!==id||status&&row.status!==status||actor&&row.actor!==actor||since&&row.ts<=since)continue;
    if(out.length===max){hasMore=true;break;}
    out.push(row);nextCursor=Buffer.from(JSON.stringify({v:1,file:name,offset:start,filter})).toString('base64url');
   }
   if(hasMore)break;
  }
  return {schema:'ar-create.journal.v1',lines:out,hasMore,nextCursor:hasMore?nextCursor:null};
 }
 const text=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b-\x1f]/.test(value))throw new StateError(label+' must be plain text up to '+max+' characters.',400);return value;};
 const fields=(input,allowed)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new StateError('Use only '+allowed.join(', ')+'.',400);};
 return {
  append,appendOnce,read,
  /** An agent finishes and names who goes next. */
  handoff(input,context){fields(input,['scope','to','summary','operationId']);const scope=validScope(input.scope);if(!scope)throw new StateError('A handoff needs scope:{kind,id}.',400);const to=parseActor(input.to);if(!to)throw new StateError('to must be an actor, for example human:adrian.',400);return append({operationId:input.operationId??null,actor:context.actor,client:context.client,scope,kind:'handoff',status:'handoff',to,summary:text(input.summary,'summary',280)});},
  /** An agent needs a decision only a human can make; the app shows it. */
  ask(input,context){fields(input,['scope','question','options','to','operationId']);const scope=validScope(input.scope);if(!scope)throw new StateError('A question needs scope:{kind,id}.',400);const to=input.to===undefined?'human:adrian':parseActor(input.to);if(!to)throw new StateError('to must be an actor.',400);if(input.options!==undefined&&(!Array.isArray(input.options)||input.options.length>5||input.options.some(o=>typeof o!=='string'||!o.trim()||o.length>80)))throw new StateError('options are up to five short choices.',400);return append({operationId:input.operationId??null,actor:context.actor,client:context.client,scope,kind:'ask',status:'needs-decision',to,summary:text(input.question,'question',280),...(input.options?{options:input.options}:{})});},
 };
}
