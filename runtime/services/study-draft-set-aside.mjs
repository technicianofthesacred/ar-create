// Words of Adrian's kept off the page: the unsaved paragraphs he did not keep when two versions met, words a closed tab
// left on a device that he chose to leave out, or words a save could not deliver. They are his only (an assistant gets
// 403), they are never written into the draft by this store, and nothing here is ever changed or removed: each set-aside
// is one read-only file named by its operation id, so the same operation sent twice is answered with the first answer and
// a different request under that id is refused.
//   study-draft.set-aside       (human, write)  {bindingId, parentStudyId, operationId, reason, expected?, paragraphs:[{id?, words, baseHash?, savedHash?}]}
//   study-draft.set-aside.list  (any, read)     {bindingId, parentStudyId} -> {items, damaged}
import fs from 'node:fs';import path from 'node:path';
import {StateError} from '../store.mjs';import {atomicWrite,digest,ensurePrivateDirectory,regular} from './files.mjs';
import {currentActor,HUMAN_ACTORS} from './actor.mjs';

export const SET_ASIDE_SCHEMA='ar-create.study-draft-set-aside.v1';
export const SET_ASIDE_REASONS=Object.freeze(['conflict','recovery','failed-save']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,SHA=/^[a-f0-9]{64}$/;
const MAX_PARAGRAPHS=500,MAX_WORDS=200*1024,MAX_TOTAL=2*1024*1024;
const fail=(message,status=409)=>{throw new StateError(message,status);};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const entryHash=e=>{const {entryHash:_,...rest}=e;return digest(stable(rest));};

/** binding(input) returns the owned draft (it refuses a wrong parent or a missing draft); room(b) is the draft's own folder. */
export function createStudyDraftSetAside({binding,room}){
 const folder=b=>path.join(room(b),'set-aside');
 function humanOnly(){const actor=currentActor()?.actor;if(!actor||!HUMAN_ACTORS.includes(actor))fail('Setting words aside is for Adrian to do'+(actor?'; '+actor+' may not.':'.'),403);}
 function fields(input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Malformed request.',400);
  const allowed=['bindingId','parentStudyId','operationId','reason','expected','paragraphs'];
  if(Object.keys(input).some(k=>!allowed.includes(k)))fail('Malformed request: unsupported fields are refused.',400);
  if(!uuid.test(input.operationId||''))fail('Operation UUID required.',400);
  if(!uuid.test(input.bindingId||''))fail('Owned draft binding UUID required.',400);
  if(!SET_ASIDE_REASONS.includes(input.reason))fail('Say why these words are set aside: '+SET_ASIDE_REASONS.join(', ')+'.',400);
  if(input.expected!==undefined&&(input.expected===null||typeof input.expected!=='object'||Array.isArray(input.expected)||Buffer.byteLength(JSON.stringify(input.expected))>4096))fail('expected, when sent, is the draft revision the words were written against.',400);
  const list=input.paragraphs;
  if(!Array.isArray(list)||!list.length||list.length>MAX_PARAGRAPHS)fail('Send one to '+MAX_PARAGRAPHS+' paragraphs.',400);
  let total=0;
  for(const p of list){
   if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['id','words','baseHash','savedHash'].includes(k)))fail('Each paragraph is {id?, words, baseHash?, savedHash?}.',400);
   if(typeof p.words!=='string'||!p.words.trim()||p.words.length>MAX_WORDS||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(p.words))fail('Each paragraph needs its words as plain text.',400);
   if(p.id!==undefined&&p.id!==null&&(typeof p.id!=='string'||!p.id||p.id.length>128||/[\x00-\x1f\x7f]/.test(p.id)))fail('A paragraph id, when sent, is the id it had on the page.',400);
   for(const k of ['baseHash','savedHash'])if(p[k]!==undefined&&p[k]!==null&&!SHA.test(p[k]))fail(k+' is the hash of those words.',400);
   total+=Buffer.byteLength(p.words);
  }
  if(total>MAX_TOTAL)fail('That is more than 2 MB of words to set aside at once.',413);
 }
 function read(b){
  const dir=folder(b),items=[],damaged=[];
  if(!fs.lstatSync(dir,{throwIfNoEntry:false}))return {items,damaged};
  for(const name of fs.readdirSync(dir).sort()){
   if(name.endsWith('.tmp'))continue;// a write in progress
   if(!/^[0-9a-f-]{36}\.json$/i.test(name)){damaged.push(name);continue;}
   try{
    const file=path.join(dir,name);regular(file);const e=JSON.parse(fs.readFileSync(file,'utf8'));
    if(e?.schema!==SET_ASIDE_SCHEMA||e.bindingId!==b.id||e.parentStudyId!==b.parentStudyId||e.operationId+'.json'!==name||e.entryHash!==entryHash(e))throw new Error('changed');
    items.push(e);
   }catch{damaged.push(name);}
  }
  items.sort((a,b)=>String(a.at).localeCompare(String(b.at))||a.operationId.localeCompare(b.operationId));
  return {items,damaged};
 }
 /** Keeps his words aside. Never opens or writes the draft. */
 function setAside(input){
  humanOnly();fields(input);
  const b=binding(input),dir=ensurePrivateDirectory(room(b),'set-aside'),file=path.join(dir,input.operationId.toLowerCase()+'.json');
  const inputHash=digest(stable({bindingId:input.bindingId,parentStudyId:input.parentStudyId,reason:input.reason,expected:input.expected??null,paragraphs:input.paragraphs.map(p=>({id:p.id??null,words:p.words,baseHash:p.baseHash??null,savedHash:p.savedHash??null}))}));
  if(fs.lstatSync(file,{throwIfNoEntry:false})){
   regular(file);const was=JSON.parse(fs.readFileSync(file,'utf8'));
   if(was.inputHash!==inputHash||was.entryHash!==entryHash(was))fail('This operation ID already belongs to a different set-aside.');
   return {entry:was,replayed:true,...read(b)};
  }
  const entry={schema:SET_ASIDE_SCHEMA,bindingId:b.id,parentStudyId:b.parentStudyId,operationId:input.operationId.toLowerCase(),inputHash,actor:currentActor().actor,at:new Date().toISOString(),reason:input.reason,
   expected:input.expected??null,paragraphs:input.paragraphs.map(p=>({id:p.id??null,words:p.words,wordsHash:digest(p.words),baseHash:p.baseHash??null,savedHash:p.savedHash??null}))};
  entry.entryHash=entryHash(entry);
  atomicWrite(file,JSON.stringify(entry,null,2),{exclusive:true});fs.chmodSync(file,0o400);
  return {entry,replayed:false,...read(b)};
 }
 function list(input){
  if(!input||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim())fail('Parent study ID required.',400);
  if(!uuid.test(input.bindingId||''))fail('Owned draft binding UUID required.',400);
  const b=binding(input);return {bindingId:b.id,parentStudyId:b.parentStudyId,...read(b)};
 }
 return {setAside,list};
}
