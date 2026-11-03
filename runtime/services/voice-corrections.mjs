// Voice corrections from Adrian's read-through (3 November 2026).
//
// When Adrian finishes reading a machine draft, every paragraph he rewrote is
// queued here as a voice correction: the machine's words, his words and the
// piece they belong to. Nothing here edits a voice file. He approves or drops
// each one (human-only); approved ones are exported in the exact shape of the
// i64os `voice_correct` tool, which only queues them in the voice file. Routing
// a correction into the voice itself stays his separate gate in i64os
// (`voice_route`).
//
// AR Create has no working route to the i64os voice queue today: the copied
// Magazine i64 export needs i64os credentials and its worker was never copied
// in. So the queue lives here, and `export` is the hand-over.
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {provenance,requireHuman} from './actor.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,readJson} from './files.mjs';

export const VOICE_KEYS=Object.freeze(['voice-profile','body-of-work']);
const STATUSES=['pending','approved','dropped','sent'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ID=/^vc-[a-f0-9]{24}$/;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const line=value=>String(value??'').replace(/\s+/g,' ').trim();
const plain=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed())fail(`${label} must be ordinary text under ${max} characters.`);return value;};

/** The correction in Adrian's words, as `voice_correct` expects one line of text. */
export function correctionText(record){
 const title=line(record.piece?.title)||'a piece';
 const text=`In "${title}" a draft said: "${line(record.before)}". Adrian wrote instead: "${line(record.after)}".`;
 return record.note?`${text} His note: ${line(record.note)}`:text;
}

export function createVoiceCorrections({dataDir}){
 const dir=ensurePrivateDirectory(dataDir,'voice-corrections');
 const file=id=>{if(!ID.test(id||''))fail('Choose one voice correction by its id.');return path.join(dir,id+'.json');};
 const save=(record,exclusive=false)=>atomicWrite(file(record.id),JSON.stringify(record,null,2)+'\n',{exclusive});
 const read=id=>{const record=readJson(file(id),null);if(!record||record.id!==id)fail('That voice correction does not exist.',404);return record;};
 const all=()=>fs.readdirSync(dir).filter(name=>/^vc-[a-f0-9]{24}\.json$/.test(name)).map(name=>readJson(path.join(dir,name),null)).filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const view=record=>({...record,voiceCorrect:{key:record.key,text:correctionText(record),source:'ar-create · '+(line(record.piece?.title)||record.piece?.parentStudyId)}});

 return {
  /** Queue one rewritten paragraph. Idempotent per finish operation and paragraph. */
  queue({before,after,piece,requestId,paragraphId,operationId}){
   if(typeof before!=='string'||typeof after!=='string'||before===after||!after.trim())fail('A voice correction needs the machine words and different words from Adrian.');
   if(!piece||typeof piece.parentStudyId!=='string'||typeof piece.bindingId!=='string')fail('A voice correction needs its piece.');
   const id='vc-'+digest(String(operationId)+'\0'+String(paragraphId)).slice(0,24),existing=readJson(file(id),null);
   if(existing)return view(existing);
   const record={schema:'ar-create.voice-correction.v1',id,status:'pending',key:'voice-profile',before,after,note:null,
    piece:{parentStudyId:piece.parentStudyId,bindingId:piece.bindingId,title:typeof piece.title==='string'?piece.title:null},
    requestId:requestId||null,paragraphId:paragraphId||null,finishOperationId:operationId||null,queuedBy:provenance(),createdAt:new Date().toISOString()};
   save(record,true);return view(record);
  },
  list(query={}){
   const status=query.status||null,parentStudyId=query.parentStudyId||null;
   if(status&&!STATUSES.includes(status))fail('Choose pending, approved, dropped or sent.');
   const items=all().filter(r=>(!status||r.status===status)&&(!parentStudyId||r.piece?.parentStudyId===parentStudyId)).map(view);
   return {schema:'ar-create.voice-corrections.v1',counts:Object.fromEntries(STATUSES.map(s=>[s,all().filter(r=>r.status===s&&(!parentStudyId||r.piece?.parentStudyId===parentStudyId)).length])),items};
  },
  /** Adrian approves (optionally naming the file and adding his note) or drops one. */
  decide(input){
   requireHuman('Approving a voice correction');
   if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['id','decision','key','note','reason','operationId'].includes(k)))fail('Unsupported voice correction fields.');
   if(!UUID.test(input.operationId||''))fail('A fresh operation ID is required.');
   if(!['approve','drop'].includes(input.decision))fail('Choose approve or drop.');
   const record=read(input.id);
   if(record.decisionOperationId===input.operationId)return view(record);
   if(record.status!=='pending')fail(`This voice correction is already ${record.status}.`,409);
   if(input.decision==='approve'){
    if(input.reason!==undefined)fail('A reason belongs to a drop.');
    if(input.key!==undefined&&!VOICE_KEYS.includes(input.key))fail('Choose voice-profile or body-of-work.');
    if(input.note!==undefined&&input.note!==null&&input.note!=='')plain(input.note,2000,'Your note');
   }else if(input.key!==undefined||input.note!==undefined)fail('A drop takes only an optional reason.');
   else if(input.reason!==undefined&&input.reason!=='')plain(input.reason,2000,'The reason');
   const next={...record,status:input.decision==='approve'?'approved':'dropped',...(input.decision==='approve'?{key:input.key||record.key,note:input.note?input.note:null}:{dropReason:input.reason||null}),decidedBy:provenance(),decisionOperationId:input.operationId};
   save(next);return view(next);
  },
  /** Approved corrections in the shape of the i64os voice_correct tool. Read-only. */
  export(){
   const items=all().filter(r=>r.status==='approved').map(view).map(r=>({id:r.id,piece:r.piece,voiceCorrect:r.voiceCorrect}));
   return {schema:'ar-create.voice-corrections-export.v1',target:'i64os voice_correct (queues only; voice_route stays Adrian\'s)',how:'For each item, call voice_correct with voiceCorrect, then voice-corrections.sent with its id.',items};
  },
  /** Bookkeeping after an approved correction reached the i64os queue. Any actor. */
  sent(input){
   if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['id','operationId','ref'].includes(k)))fail('Unsupported voice correction fields.');
   if(!UUID.test(input.operationId||''))fail('A fresh operation ID is required.');
   if(input.ref!==undefined)plain(input.ref,500,'The reference');
   const record=read(input.id);
   if(record.sentOperationId===input.operationId)return view(record);
   if(record.status!=='approved')fail('Only an approved voice correction can be marked sent.',409);
   const next={...record,status:'sent',sentBy:provenance(),sentRef:input.ref||null,sentOperationId:input.operationId};
   save(next);return view(next);
  },
 };
}
