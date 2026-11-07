// One shared transcription process: transcribe -> recognise words -> check they are right -> place each piece.
// This file is the recognise and check steps, joined to the recording owner and the Needs you list.
//
//   recognise  After a transcript exists: fix known mishearings of confirmed library words (one correction receipt, the
//              original transcript untouched), then find the words worth a second look.
//   check      Supported doubtful words from one real recording form one explicit review request on Needs you.
//              Adrian answers each word on the Words screen. That answer is remembered: his spelling becomes a library
//              entry or a new known mishearing, so the next recording, in any project, gets it right.
//   answer     Human-only, from the app. An agent can raise and read; it can never confirm a spelling.
//
// A transcript is only ever changed through the recording owner's correction receipts (transcript-corrections.mjs).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {recordingPurpose,recordingTitle,qualifiedWords,recordingContext,wordReason} from './recording-attention.mjs';
import {StateError} from '../store.mjs';
import {currentActor,isHuman} from './actor.mjs';
import {CATEGORIES} from './word-prompt.mjs';
import {findHits,findFixes,findDoubtful,findReplacements,mmss} from './word-recognise.mjs';

const RECORD_SCHEMA='ar-create.word-check.v1';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const ASK_KEEP='Keep all as heard',ASK_GO='Go through them';
const ANSWERS=['keep','right','suggestion','spelling'];
const SYSTEM={actor:'cron:shared-words',client:null};
const fail=(message,status=400)=>{throw new StateError(message,status);};
const uuidFrom=seed=>{const h=crypto.createHash('sha256').update(seed).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);};
const iso=ms=>new Date(ms).toISOString();
const clip=(s,n)=>String(s).length>n?String(s).slice(0,n-1).trimEnd()+'…':String(s);
const KIND_LABEL={'low-confidence':'Not sure it heard this right','unknown-name':'A name the library does not know','number':'A number or date','near-match':'Close to a word in the library'};

export function createSharedWords({dataDir,library,corrections,needsYou,now=()=>Date.now(),onChange=()=>{}}={}){
 if(!dataDir||!library||!corrections||!needsYou)throw Error('The shared word check needs the data folder, the library, the recording owner and the Needs you list.');
 const dir=path.join(dataDir,'word-library'),recordsDir=path.join(dir,'recordings'),stateFile=path.join(dir,'state.json');
 const jobsDir=path.join(dataDir,'recordings','.transcription-jobs');
 let queue=Promise.resolve();
 const serial=fn=>{const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;};
 const recordFile=id=>{if(!UUID.test(id||''))fail('Name one recording by its id.');return path.join(recordsDir,id+'.json');};
 const readRecord=id=>{try{const v=JSON.parse(fs.readFileSync(recordFile(id),'utf8'));return v.schema===RECORD_SCHEMA?v:null;}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 const writeRecord=rec=>{
  fs.mkdirSync(recordsDir,{recursive:true,mode:0o700});
  const file=recordFile(rec.jobId),tmp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(rec,null,1),{mode:0o600});fs.renameSync(tmp,file);
 };
 const readJob=id=>{try{return JSON.parse(fs.readFileSync(path.join(jobsDir,id+'.json'),'utf8'));}catch{return null;}};
 const open=rec=>rec.items.filter(i=>i.status==='open').length;

 /** One correction receipt through the recording owner: propose it, then apply it. Used for automatic fixes of known
  *  mishearings and for the spellings Adrian confirms. The original wording stays in the receipt and in RAW. */
 function applyCorrections(jobId,corr,reason,kind){
  const before=corrections.read(jobId);
  const receipt=corrections.propose(jobId,{expected:before.expected,corrections:corr,reason:clip(reason,3900),kind});
  const current=corrections.read(jobId);
  corrections.decide(jobId,receipt.id,{decision:'apply',expected:current.expected});
  return receipt.id;
 }
 const reasonFor=(lead,changes)=>{
  const tally=new Map();for(const c of changes){const k='"'+c.heard+'" -> "'+c.spelling+'"';tally.set(k,(tally.get(k)||0)+1);}
  return lead+' · '+[...tally].map(([k,n])=>k+(n>1?' x'+n:'')).join(', ');
 };

 function askFor(rec){
  const n=open(rec),first=rec.items.find(i=>i.status==='open');
  const lead=n+(n===1?' word':' words')+' to check in "'+clip(rec.story,60)+'". First: "'+clip(first.word,40)+'" at '+mmss(first.start)+'.';
  return {operationId:uuidFrom(rec.jobId+':ask:'+rec.recognisedAt),band:'only-adrian',question:clip(lead+' Listen to the passage before deciding.',280),about:clip(rec.story,120),
   choices:[ASK_KEEP,ASK_GO],scope:{kind:'recording-words',id:rec.jobId}};
 }

 // ---- recognise ----
 async function recognise(input={},context=currentActor()){
  const allowed=['jobId','force'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))fail('Send jobId (and force, to run it again).');
  if(!UUID.test(input.jobId||''))fail('Name one recording by its id.');
  return serial(async()=>{
   const existing=readRecord(input.jobId);
   if(existing&&input.force!==true)return await settle(existing);
   const job=readJob(input.jobId);
   if(!job||job.state!=='done'||job.transcriptReady!==true)fail('That recording has no finished transcript yet.',404);
   let snap;try{snap=corrections.read(input.jobId);}catch(error){fail('The transcript could not be opened for checking: '+error.message,error.status===404?404:409);}
   if(recordingPurpose(job,snap.result.segments)==='test'){
    if(existing)return view(existing);
    const rec={schema:RECORD_SCHEMA,jobId:input.jobId,story:recordingTitle(job,snap.result.segments),recognisedAt:iso(now()),state:'excluded',exclusion:'Test recording',items:[],fixes:{applied:[],suggested:[]},askId:null};writeRecord(rec);return view(rec);
   }
   const lib=await library.snapshot(),entries=lib.entries;
   const reviewed=snap.reviewStatus==='reviewed';
   // 1. fix known mishearings of confirmed words, one receipt. A transcript Adrian already reviewed is never touched
   //    on its own: the fixes become suggestions to check instead.
   const beforeDoubt=findDoubtful(snap.result,entries,{kept:lib.kept});
   const found=findFixes(snap.result,entries);
   const rec={schema:RECORD_SCHEMA,jobId:input.jobId,story:job.story||'Recording',language:snap.result.language||job.language||null,recognisedAt:iso(now()),recognisedBy:context?.actor||SYSTEM.actor,
    attentionVersion:2,basis:null,libraryRevision:lib.revision,reviewedAtStart:reviewed,fixes:{receiptId:null,applied:[],suggested:[]},hits:[],items:[],dropped:0,askId:existing?.askId||null,state:'open'};
   if(found.corrections.length&&!reviewed){
    rec.fixes.receiptId=applyCorrections(input.jobId,found.corrections,reasonFor('shared words · known mishearings of confirmed words · fixed automatically',found.changes),'library-variant');
    rec.fixes.applied=found.changes;snap=corrections.read(input.jobId);
   }else if(found.changes.length)rec.fixes.suggested=found.changes;
   rec.hits=findHits(snap.result,entries).slice(0,40);
   // 2. doubtful words on the text as it now reads
   const doubt=findDoubtful(snap.result,entries,{kept:lib.kept});
   if(rec.fixes.applied.length)for(const old of beforeDoubt.items){
    const current=snap.result.segments[old.segmentIndex];
    if(current?.text.includes(old.word)&&!doubt.items.some(i=>i.key===old.key))doubt.items.push({...old,sentence:current.text});
   }
   rec.basis=snap.expected.revision;
   rec.dropped=doubt.dropped;
   const fromFixes=rec.fixes.suggested.map(c=>({key:'near-match:'+c.heard.toLowerCase(),kind:'near-match',word:c.heard,segmentIndex:c.segmentIndex,start:c.start,end:c.start,sentence:c.sentence,occurrences:1,times:[c.start],score:95,suggestion:c.spelling,entryId:c.entryId}));
   const merged=new Map();for(const item of [...fromFixes,...doubt.items])if(!merged.has(item.key))merged.set(item.key,item);
   const prior=new Map((existing?.items||[]).map(i=>[i.key,i]));
   rec.items=[...merged.values()].sort((a,b)=>a.start-b.start).map(i=>prior.get(i.key)&&prior.get(i.key).status!=='open'?prior.get(i.key):{...i,status:'open',answer:null});
   for(const old of prior.values())if(old.status!=='open'&&!merged.has(old.key))rec.items.push(old);
   rec.qualifiedKeys=rec.items.filter(i=>i.status==='open').map(i=>i.key);
   rec.state=open(rec)?'open':'done';
   // A run again keeps the ask while it is still open; once it was settled, new words get a fresh ask.
   if(rec.askId){let ask=null;try{ask=(await needsYou.list({id:rec.askId,status:'all'})).asks[0]||null;}catch{ask=null;}if(!ask||ask.status!=='open')rec.askId=null;}
   writeRecord(rec);
   const settled=await settle(rec);
   onChange(settled.state==='open'?'check-raised':'checked',{jobId:rec.jobId});
   return settled;
  });
 }

 /** Raise the one ask for a recording with words to check, and read back whether it has been settled. */
 async function settle(rec){
  if(rec.state==='open'&&open(rec)&&!rec.askId){
   const ask=await needsYou.raise(askFor(rec),SYSTEM);
   rec.askId=ask.id;writeRecord(rec);
  }
  return await reconcile(rec);
 }
 /** Only an explicit human Keep-all answer settles the words; absence or elapsed time grants no approval. */
 async function reconcile(rec){
  if(rec.state==='done'||!rec.askId)return view(rec);
  let ask=null;
  try{ask=(await needsYou.list({id:rec.askId,status:'all'})).asks[0]||null;}catch{ask=null;}
  const keepAll=ask?.status==='answered'&&ask.resolution?.via==='human'&&ask.resolution?.choice===ASK_KEEP;
  if(keepAll){
   const by=ask.resolution.by,at=iso(now());
   for(const item of rec.items)if(item.status==='open'){item.status='kept';item.answer={choice:'keep',by,at,via:'ask'};}
   rec.state='done';writeRecord(rec);
  }
  return view(rec);
 }
 const view=async rec=>{
  if(rec.state==='excluded')return {...rec,open:0,total:0};
  const job=readJob(rec.jobId);let snap;try{snap=corrections.read(rec.jobId);}catch{return {...rec,items:[],open:0,total:0,unavailable:true};}
  if(recordingPurpose(job,snap.result.segments)==='test')return {...rec,state:'excluded',items:[],open:0,total:0};
  const items=qualifiedWords(rec,snap,await library.snapshot());
  const count=items.filter(i=>i.status==='open').length;
  return {schema:RECORD_SCHEMA,...rec,story:recordingTitle(job,snap.result.segments),recordedAt:job?.recordedAt||null,open:count,total:items.length,
   items:items.map(i=>({...i,time:mmss(i.start),kindLabel:KIND_LABEL[i.kind]||i.kind,reason:wordReason(i),...recordingContext(job,snap,i)}))};
 };

 async function check({jobId}={}){
  if(!UUID.test(jobId||''))fail('Name one recording by its id.');
  return serial(async()=>{const rec=readRecord(jobId);if(!rec)fail('That recording has not been checked for words yet.',404);return await reconcile(rec);});
 }
 async function checks({all=false}={}){
  return serial(async()=>{
   const out=[];
   let names=[];try{names=fs.readdirSync(recordsDir).filter(n=>n.endsWith('.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
   for(const name of names){
    const rec=readRecord(name.slice(0,-5));if(!rec)continue;
    const seen=await reconcile(rec);
    if(all||seen.open)out.push({jobId:seen.jobId,story:seen.story,recognisedAt:seen.recognisedAt,state:seen.state,open:seen.open,total:seen.total,askId:seen.askId,fixed:seen.fixes.applied.length,receiptId:seen.fixes.receiptId});
   }
   return {schema:RECORD_SCHEMA,recordings:out.sort((a,b)=>Date.parse(b.recognisedAt)-Date.parse(a.recognisedAt))};
  });
 }

 // ---- answer ----
 async function answer(input,context=currentActor()){
  const allowed=['operationId','jobId','key','choice','spelling','category'];
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send the answer as one JSON object.');
  const extra=Object.keys(input).filter(k=>!allowed.includes(k));if(extra.length)fail('Unknown field: '+extra[0]+'.');
  // Only Adrian, only from the app's own page: no script, agent or MCP client is ever the voice here.
  if(!context||!isHuman(context.actor))fail('Confirming how a word is spelled is Adrian\'s; '+(context?.actor||'an unattributed caller')+' may raise and read, never answer.',403);
  if(context.client!=='ui')fail('Answer from the Words screen in the app, not from '+(context.client||'a script')+'. The record says who tapped it.',403);
  if(!UUID.test(input.operationId||''))fail('An answer needs a fresh operationId.');
  if(!UUID.test(input.jobId||''))fail('Name one recording by its id.');
  if(typeof input.key!=='string'||!input.key||input.key.length>200)fail('Name the word by its key.');
  if(!ANSWERS.includes(input.choice))fail('choice is keep, right, suggestion or spelling.');
  if(input.category!==undefined&&!CATEGORIES.includes(input.category))fail('category is one of '+CATEGORIES.join(', ')+'.');
  let typed='';
  if(input.choice==='spelling'){
   if(typeof input.spelling!=='string')fail('Write the spelling.');
   typed=input.spelling.replace(/\s+/g,' ').trim();
   if(!typed||typed.length>120||/[\u0000-\u001f\u007f]/.test(typed))fail('The spelling is 1 to 120 characters on one line.');
  }else if(input.spelling!==undefined)fail('Only "spelling" takes a written spelling.');
  return serial(async()=>{
   const rec=readRecord(input.jobId);if(!rec)fail('That recording has not been checked for words yet.',404);
   const item=rec.items.find(i=>i.key===input.key),qualified=await view(rec);
   if(item?.status==='open'&&!qualified.items.some(i=>i.key===item.key))fail('This word no longer has a supported suggestion in the current recording. Reopen the review.',409);
   if(!item)fail('That word is not on this recording\'s list.',404);
   if(item.status!=='open'){
    if(item.answer?.operationId===input.operationId)return await reconcile(rec);
    fail('That word is already settled ('+item.status+').',409);
   }
   rec.qualifiedKeys=qualified.items.filter(i=>i.status==='open').map(i=>i.key);
   const at=iso(now()),by=context.actor;
   const from={jobId:rec.jobId,story:rec.story,at:item.start,sentence:item.sentence};
   let receiptId=null,learned=null,spelling=null;
   if(input.choice==='keep'){
    if(item.kind==='unknown-name'||item.kind==='low-confidence')await library.noteKept(item.word);
    item.status='kept';
   }else if(input.choice==='right'){
    if(item.kind==='number')fail('A number or date is kept as heard or corrected; it is not added to the library.');
    const category=input.category||'other';
    learned=await library.learn({heard:'',spelling:item.word,category,from,operationId:input.operationId},context);
    item.status='remembered';spelling=item.word;
   }else{
    spelling=input.choice==='suggestion'?item.suggestion:typed;
    if(!spelling)fail('This word has no suggestion to use. Write the spelling instead.');
    // 1. fix what he confirmed, everywhere it was heard in this talk, as a correction receipt
    const swap=findReplacements(corrections.read(rec.jobId).result,item.word,spelling);
    if(swap.corrections.length)receiptId=applyCorrections(rec.jobId,swap.corrections,reasonFor('shared words · spelling confirmed by '+by,swap.changes),'library-answer');
    if(receiptId){const current=corrections.read(rec.jobId);rec.attentionVersion=2;rec.qualifiedKeys=qualified.items.filter(i=>i.status==='open').map(i=>i.key);for(const pending of rec.items)if(pending.status==='open'&&swap.corrections.some(c=>c.index===pending.segmentIndex)&&current.result.segments[pending.segmentIndex].text.includes(pending.word))pending.sentence=current.result.segments[pending.segmentIndex].text;rec.basis=current.expected.revision;}
    // 2. remember it. A number or date is corrected for this talk only; a word becomes part of the library.
    if(item.kind!=='number'){
     const category=input.category||item.category||'other';
     learned=await library.learn({heard:item.word,spelling,category,from,operationId:input.operationId},context);
    }
    item.status='corrected';
   }
   rec.libraryRevision=(await library.snapshot()).revision;
   item.answer={choice:input.choice,spelling,by,at,operationId:input.operationId,receiptId,remembered:learned?{entryId:learned.entry.id,created:learned.created,variant:learned.variant?.text||null}:null};
   if(!open(rec)){
    rec.state='done';
    // He has been through them all: settle the ask that brought him here.
    if(rec.askId){try{await needsYou.answer({operationId:uuidFrom(rec.jobId+':done'),id:rec.askId,choice:ASK_GO},context);}catch{/* the ask may have expired; the record is the truth */}}
   }
   writeRecord(rec);
   onChange('answered',{jobId:rec.jobId,key:item.key});
   return {...await view(rec),learned:learned?{entry:learned.entry,created:learned.created,variant:learned.variant||null}:null};
  });
 }

 // ---- watching ----
 const attempts=new Map();
 let timer=null;
 const readState=()=>{try{return JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{return null;}};
 /** The moment watching began, kept in a file so a restart does not move it. */
 const ensureSince=()=>{
  let state=readState();
  if(!state?.since){state={since:iso(now())};fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(stateFile,JSON.stringify(state),{mode:0o600});}
  return state;
 };
 /** Look for recordings that finished since the word check began watching, and recognise each once. Recordings that
  *  finished earlier are never touched on their own: ask for one by id (words.recognise) when you want it. */
 async function sweep(){
  const since=Date.parse(ensureSince().since);
  let names=[];try{names=fs.readdirSync(jobsDir).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n));}catch{return [];}
  const done=[];
  for(const name of names){
   const id=name.slice(0,-5);
   try{
    if(fs.statSync(path.join(jobsDir,name)).mtimeMs<since)continue;
    if(readRecord(id)||(attempts.get(id)||0)>=3)continue;
    const job=readJob(id);if(!job||job.state!=='done'||job.transcriptReady!==true||Date.parse(job.started)<since)continue;
    attempts.set(id,(attempts.get(id)||0)+1);
    await recognise({jobId:id},SYSTEM);done.push(id);
   }catch{/* try again next time, up to three times; the transcript itself is never at risk */}
  }
  return done;
 }
 function start(interval=30_000){if(timer)return;ensureSince();timer=setInterval(()=>{sweep().catch(()=>{});},interval);timer.unref?.();}
 function stop(){if(timer){clearInterval(timer);timer=null;}}

 return {recognise,check,checks,answer,sweep,start,stop};
}
