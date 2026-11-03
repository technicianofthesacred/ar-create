// The truth and consent desk (How I Work, step 6). One record per piece: every claim and quote with the source
// moment it rests on, every person who appears with how they appear and their consent, and Share's two questions.
//
// Who may do what (Adrian, 3 Nov 2026, "When to ask Adrian"):
// - Agents find and link sources, raise doubtful claims, list people and how they appear, and draft a consent request.
// - Only Adrian records that a request was sent, sets a consent answer, answers Share's comfort and accuracy
//   questions, overrides the hold (with a reason) and gives the final yes to release.
// The command registry marks those routes human-only; each one also calls requireHuman() here, so an in-process
// caller that forgets the registry is still refused.
//
// AR Create never sends a message. "Sent" is a fact Adrian records after he sent it himself.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {StateError} from '../store.mjs';
import {currentActor,isHuman,requireHuman,provenance} from './actor.mjs';
import {atomicWrite,ensurePrivateDirectory} from './files.mjs';

export const SCHEMA='ar-create.consent-desk.v1';
export const APPEARS=Object.freeze(['named','pictured','quoted']);
export const CONSENT_STATES=Object.freeze(['not-asked','asked','yes','yes-with-changes','no']);
const ANSWERED=new Set(['yes','yes-with-changes','no']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/,PIECE=/^[A-Za-z0-9:_.-]{1,256}$/;
const MAX_CLAIMS=400,MAX_PEOPLE=200,MAX_OPERATIONS=1000;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function fields(value,allowed,what='Request'){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(what+' has unsupported fields. Allowed: '+allowed.join(', ')+'.');}
function text(value,what,max=4000,{required=true}={}){
 if(value===undefined&&!required)return undefined;
 if(typeof value!=='string'||value.length>max||value.includes('\0'))fail(what+' must be text up to '+max+' characters.');
 if(required&&!value.trim())fail(what+' cannot be empty.');
 return value;
}
const normal=s=>String(s).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();

function scopeOf(input){
 const parentStudyId=input.parentStudyId,pieceKey=input.pieceKey??'main';
 if(typeof parentStudyId!=='string'||!parentStudyId.trim()||parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(parentStudyId))fail('Name the project with its parentStudyId.');
 if(typeof pieceKey!=='string'||!PIECE.test(pieceKey))fail('pieceKey names the piece (letters, numbers, : _ . -); leave it out for the project\'s main piece.');
 return {parentStudyId,pieceKey};
}
const empty=scope=>({schema:SCHEMA,...scope,revision:0,claims:[],people:[],share:{comfort:null,accuracy:null,override:null,release:null},operations:[]});
const content=desk=>JSON.stringify({claims:desk.claims,people:desk.people,share:desk.share});
const stamp=()=>{const p=provenance();return {by:p.actor,client:p.client,at:p.at};};

/** Is this person's consent still open? Unanswered, or answered before they appeared in more ways than they agreed to. */
export function personBlocker(person){
 const c=person.consent||{state:'not-asked'};
 if(!ANSWERED.has(c.state))return c.state==='asked'?'asked, no answer yet':'not asked yet';
 const agreedTo=Array.isArray(c.appearsAtAnswer)?c.appearsAtAnswer:[];
 if(person.appears.some(a=>!agreedTo.includes(a)))return 'now '+person.appears.filter(a=>!agreedTo.includes(a)).join(' and ')+' since answering';
 if(c.state==='no')return 'said no';
 return null;
}

/** The release hold, computed from the record. Never stored, so it cannot drift from the people list. */
export function releaseState(desk){
 const blockers=desk.people.map(p=>({personId:p.id,name:p.name,reason:personBlocker(p)})).filter(b=>b.reason);
 const override=desk.share.override,covered=!!override&&blockers.every(b=>override.covers.includes(b.personId));
 const peopleHeld=blockers.length>0&&!covered;
 const comfort=desk.share.comfort?.answer||null,accuracy=desk.share.accuracy?.answer||null;
 const reasons=[];
 if(peopleHeld)reasons.push(blockers.length===1?blockers[0].name+' has not given consent ('+blockers[0].reason+').':blockers.length+' people have not given consent.');
 if(comfort!=='yes')reasons.push('You have not said you are comfortable sharing this.');
 if(accuracy!=='yes')reasons.push('You have not said it is accurate.');
 const ready=reasons.length===0;
 return {ready,held:peopleHeld,blockers,overridden:!!override&&covered&&blockers.length>0,override:override?{...override}:null,questions:{comfort,accuracy},reasons,
  released:desk.share.release?{...desk.share.release,current:ready&&desk.share.release.revisionAtRelease===desk.revision}:null};
}

function claimView(claim){
 const status=claim.doubt?'doubtful':claim.source?'sourced':'unsourced';
 const bare=v=>normal(v).replace(/^["']+|["']+$/g,'').trim();
 const fidelity=claim.kind==='quote'&&claim.source?.quote?(bare(claim.source.quote)===bare(claim.text)?'exact':'differs from source'):null;
 return {...structuredClone(claim),status,...(fidelity?{fidelity}:{})};
}

export function createConsentDesk({dataDir,library}={}){
 if(!dataDir)throw Error('The consent desk needs the data folder.');
 const dir=path.join(dataDir,'consent-desk'),queues=new Map();
 const fileOf=scope=>path.join(dir,digest(scope.parentStudyId).slice(0,40),digest(scope.pieceKey).slice(0,40)+'.json');
 const serial=(key,fn)=>{const run=(queues.get(key)||Promise.resolve()).then(fn,fn);queues.set(key,run.catch(()=>{}));return run;};
 function load(scope){
  let raw;try{raw=fs.readFileSync(fileOf(scope),'utf8');}catch(error){if(error.code==='ENOENT')return {desk:empty(scope),bytes:null};throw error;}
  let desk;try{desk=JSON.parse(raw);}catch{fail('This consent record cannot be read; it was left as it is.',409);}
  if(desk.schema!==SCHEMA||desk.parentStudyId!==scope.parentStudyId||desk.pieceKey!==scope.pieceKey)fail('This consent record belongs to another piece; it was left as it is.',409);
  return {desk,bytes:raw};
 }
 const hashOf=desk=>digest(content(desk));
 function view(desk){
  const {operations,...rest}=desk,claims=desk.claims.map(claimView);
  return {...structuredClone(rest),hash:hashOf(desk),claims,
   summary:{claims:claims.length,sourced:claims.filter(c=>c.status==='sourced').length,unsourced:claims.filter(c=>c.status==='unsourced').length,doubtful:claims.filter(c=>c.status==='doubtful').length,quotesDiffering:claims.filter(c=>c.fidelity==='differs from source').length,people:desk.people.length},
   release:releaseState(desk),
   journal:operations.slice(-30).reverse().map(o=>({operationId:o.operationId,action:o.action,by:o.by,at:o.at,summary:o.summary,...(o.reason?{reason:o.reason}:{})}))};
 }
 async function read(input){fields(input,['parentStudyId','pieceKey']);const scope=scopeOf(input);return view(load(scope).desk);}

 /** Library passages are checked against the source text, like Simmer's exact words; recordings and photos must exist. */
 async function checkSource(source){
  fields(source,['type','sourceId','sourceHash','start','quote','atMs','endMs','title'],'A source');
  if(!['library','recording','photo'].includes(source.type))fail('A source is a library passage, a recording moment or a photo.');
  if(!UUID.test(source.sourceId||''))fail('A source names its Library source id.');
  if(!library?.snapshot)fail('Library is not connected, so a source cannot be checked.',503);
  let snap;try{snap=await library.snapshot(source.sourceId,{includeBody:source.type!=='photo'});}catch(error){if(error?.status===503)throw error;fail('That Library source is unavailable.',404);}
  const out={type:source.type,sourceId:source.sourceId,title:text(source.title,'Source title',300,{required:false})||snap.title||snap.name||'Library source'};
  if(source.type==='library'){
   if(!HASH.test(source.sourceHash||'')||!Number.isSafeInteger(source.start)||source.start<0)fail('A library passage needs the exact sourceHash and character start from the Library read.');
   text(source.quote,'Passage',16384);
   if(snap.hash!==source.sourceHash||typeof snap.text!=='string'||snap.text.slice(source.start,source.start+source.quote.length)!==source.quote)fail('The source changed or the passage does not match it. Read the source again before linking.',409);
   Object.assign(out,{sourceHash:source.sourceHash,start:source.start,quote:source.quote});
  }else if(source.type==='recording'){
   if(!Number.isSafeInteger(source.atMs)||source.atMs<0)fail('A recording moment needs atMs, the time in milliseconds.');
   if(source.endMs!==undefined&&(!Number.isSafeInteger(source.endMs)||source.endMs<source.atMs))fail('endMs must be a time after atMs.');
   out.atMs=source.atMs;if(source.endMs!==undefined)out.endMs=source.endMs;
   if(source.quote!==undefined){text(source.quote,'Words at that moment',16384);if(typeof snap.text==='string'&&!normal(snap.text).includes(normal(source.quote)))fail('Those words are not in the recording\'s transcript. Check the moment before linking.',409);out.quote=source.quote;}
  }else{
   if(source.quote!==undefined||source.atMs!==undefined)fail('A photo source carries only its sourceId.');
  }
  return out;
 }

 /** One write: idempotent by operationId, refused when stale, serialized per piece. */
 async function write(action,input,allowed,apply){
  fields(input,['parentStudyId','pieceKey','operationId','expectedRevision','expectedHash',...allowed]);
  const scope=scopeOf(input);
  if(!UUID.test(input.operationId||'')||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!HASH.test(input.expectedHash||''))fail('A write needs operationId (a fresh UUID), expectedRevision and expectedHash from the read.');
  const fingerprint=digest(JSON.stringify({action,input}));
  return serial(fileOf(scope),async()=>{
   const {desk:before,bytes}=load(scope);
   const prior=before.operations.find(o=>o.operationId===input.operationId);
   if(prior){if(prior.fingerprint!==fingerprint)fail('That operationId was already used for a different change.',409);return view(before);}
   if(before.revision!==input.expectedRevision||hashOf(before)!==input.expectedHash)fail('This piece\'s consent record changed since you read it. Read it again; nothing was overwritten.',409);
   const desk=structuredClone(before),result=await apply(desk)||{};
   const who=stamp();
   desk.revision=before.revision+1;
   desk.operations.push({operationId:input.operationId,fingerprint,action,...who,summary:String(result.summary||action).slice(0,280),...(result.reason?{reason:result.reason}:{})});
   if(desk.operations.length>MAX_OPERATIONS)fail('This consent record has reached its history limit; nothing was changed.',413);
   const file=fileOf(scope);ensurePrivateDirectory(dataDir,path.join('consent-desk',path.basename(path.dirname(file))));
   atomicWrite(file,JSON.stringify(desk,null,1)+'\n',bytes===null?{exclusive:true}:{expectedHash:digest(bytes)});
   return view(desk);
  });
 }
 const claimIn=(desk,id)=>{if(!UUID.test(id||''))fail('Name the claim by its claimId.');const c=desk.claims.find(x=>x.id===id);if(!c)fail('That claim is not on this piece.',404);return c;};
 const personIn=(desk,id)=>{if(!UUID.test(id||''))fail('Name the person by their personId.');const p=desk.people.find(x=>x.id===id);if(!p)fail('That person is not on this piece.',404);return p;};
 const appearsOf=value=>{if(!Array.isArray(value)||!value.length||value.some(a=>!APPEARS.includes(a))||new Set(value).size!==value.length)fail('appears lists how they appear: named, pictured and/or quoted.');return APPEARS.filter(a=>value.includes(a));};

 // ---- claims: anyone may record, link and raise doubt (agents raise only the doubtful ones)
 const recordClaim=input=>write('claim.record',input,['claim'],async desk=>{
  fields(input.claim,['kind','text','where','source'],'A claim');
  if(!['claim','quote'].includes(input.claim.kind))fail('A claim is kind claim or quote.');
  if(desk.claims.length>=MAX_CLAIMS)fail('This piece already holds the most claims the desk keeps.',413);
  const claim={id:crypto.randomUUID(),kind:input.claim.kind,text:text(input.claim.text,'The claim as it reads in the piece',4000),where:text(input.claim.where,'Where it sits',300,{required:false})||'',source:input.claim.source?{...await checkSource(input.claim.source),linked:stamp()}:null,doubt:null,added:stamp()};
  desk.claims.push(claim);return {summary:(claim.source?'Recorded a sourced ':'Recorded an unsourced ')+claim.kind+'.'};
 });
 const linkClaim=input=>write('claim.link',input,['claimId','source'],async desk=>{
  const claim=claimIn(desk,input.claimId);claim.source={...await checkSource(input.source),linked:stamp()};
  return {summary:'Linked a '+claim.source.type+' source to a '+claim.kind+'.'};
 });
 const flagClaim=input=>write('claim.flag',input,['claimId','reason'],async desk=>{
  const claim=claimIn(desk,input.claimId);claim.doubt={reason:text(input.reason,'Why it is doubtful',1000),...stamp()};
  return {summary:'Raised a doubt on a '+claim.kind+'.',reason:claim.doubt.reason};
 });
 const clearFlag=input=>write('claim.clear',input,['claimId','note'],async desk=>{
  const claim=claimIn(desk,input.claimId);if(!claim.doubt)fail('That claim has no doubt raised.',409);
  const actor=currentActor()?.actor;
  // An agent may withdraw a doubt it raised itself; only Adrian clears someone else's.
  if(actor&&!isHuman(actor)&&claim.doubt.by!==actor)fail('Only Adrian clears a doubt someone else raised; '+actor+' may withdraw only its own.',403);
  const note=text(input.note,'Note',1000,{required:false});claim.doubt=null;
  return {summary:'Cleared the doubt on a '+claim.kind+'.',...(note?{reason:note}:{})};
 });

 // ---- people: anyone may list them, say how they appear and draft a request
 const recordPerson=input=>write('person.record',input,['person'],async desk=>{
  fields(input.person,['personId','name','appears','note'],'A person');
  const name=text(input.person.name,'Name',200),appears=appearsOf(input.person.appears),note=text(input.person.note,'Note',2000,{required:false});
  if(input.person.personId!==undefined){
   const person=personIn(desk,input.person.personId);
   Object.assign(person,{name,appears},note!==undefined?{note}:{});person.updated=stamp();
   return {summary:'Updated '+name+': '+appears.join(', ')+'.'};
  }
  if(desk.people.length>=MAX_PEOPLE)fail('This piece already lists the most people the desk keeps.',413);
  if(desk.people.some(p=>normal(p.name).toLowerCase()===normal(name).toLowerCase()))fail(name+' is already listed on this piece; update them with their personId.',409);
  desk.people.push({id:crypto.randomUUID(),name,appears,note:note||'',consent:{state:'not-asked'},request:null,sent:[],added:stamp()});
  return {summary:'Listed '+name+' ('+appears.join(', ')+').'};
 });
 const draftRequest=input=>write('person.draft-request',input,['personId','text'],async desk=>{
  const person=personIn(desk,input.personId);person.request={text:text(input.text,'Consent request',8000),...stamp()};
  return {summary:'Drafted a consent request for '+person.name+'. Not sent.'};
 });

 // ---- Adrian only
 const recordSent=input=>{requireHuman('Recording that a consent request was sent');return write('person.sent',input,['personId','sentAt','channel'],async desk=>{
  const person=personIn(desk,input.personId),sentAt=text(input.sentAt,'When you sent it',128),channel=text(input.channel,'How you sent it',200);
  person.sent.push({sentAt,channel,...stamp()});if(person.consent.state==='not-asked')person.consent={state:'asked',...stamp()};
  return {summary:'You sent '+person.name+' the consent request ('+channel+').'};
 });};
 const answer=input=>{requireHuman('Setting a consent answer');return write('person.answer',input,['personId','state','changes'],async desk=>{
  const person=personIn(desk,input.personId);
  if(!CONSENT_STATES.includes(input.state))fail('Consent is one of: '+CONSENT_STATES.join(', ')+'.');
  const changes=text(input.changes,'The changes they asked for',4000,{required:input.state==='yes-with-changes'});
  if(input.state!=='yes-with-changes'&&changes!==undefined)fail('Changes go with yes-with-changes only.');
  person.consent={state:input.state,...(changes?{changes}:{}),...(ANSWERED.has(input.state)?{appearsAtAnswer:[...person.appears]}:{}),...stamp()};
  return {summary:person.name+': '+input.state.replace(/-/g,' ')+'.'};
 });};
 const removePerson=input=>{requireHuman('Taking a person off the piece');return write('person.remove',input,['personId','reason'],async desk=>{
  const person=personIn(desk,input.personId),reason=text(input.reason,'Why they no longer appear',1000);
  desk.people=desk.people.filter(p=>p.id!==person.id);return {summary:'Took '+person.name+' off the piece.',reason};
 });};
 const shareAnswer=input=>{requireHuman('Answering Share');return write('share.answer',input,['question','answer','note'],async desk=>{
  if(!['comfort','accuracy'].includes(input.question))fail('Share asks two questions: comfort and accuracy.');
  if(!['yes','not-yet'].includes(input.answer))fail('Answer yes or not-yet.');
  const note=text(input.note,'Note',2000,{required:false});
  desk.share[input.question]={answer:input.answer,...(note?{note}:{}),revisionAtAnswer:desk.revision,...stamp()};
  return {summary:(input.question==='comfort'?'Comfortable sharing: ':'Accurate: ')+input.answer.replace('-',' ')+'.'};
 });};
 const override=input=>{requireHuman('Overriding the release hold');return write('share.override',input,['reason'],async desk=>{
  const reason=text(input.reason,'Why you are releasing without every answer',2000);
  const covers=desk.people.filter(p=>personBlocker(p)).map(p=>p.id);
  if(!covers.length)fail('Nobody is holding the release, so there is nothing to override.',409);
  desk.share.override={reason,covers,...stamp()};
  return {summary:'You overrode the hold for '+covers.length+(covers.length===1?' person.':' people.'),reason};
 });};
 const release=input=>{requireHuman('The final yes to release');return write('share.release',input,[],async desk=>{
  const state=releaseState(desk);if(!state.ready)fail('Release is on hold. '+state.reasons.join(' '),409);
  desk.share.release={revisionAtRelease:desk.revision+1,...stamp()};
  return {summary:'You said yes to release.'};
 });};

 /** Read-only: every person whose consent is still open, across all pieces, for a "needs you" list. */
 async function open(input={}){
  fields(input,['parentStudyId']);
  if(input.parentStudyId!==undefined)scopeOf({parentStudyId:input.parentStudyId});
  const items=[];let pieces=0;
  const projects=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^[a-f0-9]{40}$/.test(n)):[];
  for(const project of projects){
   if(input.parentStudyId!==undefined&&project!==digest(input.parentStudyId).slice(0,40))continue;
   for(const name of fs.readdirSync(path.join(dir,project)).filter(n=>/^[a-f0-9]{40}\.json$/.test(n))){
    let desk;try{desk=JSON.parse(fs.readFileSync(path.join(dir,project,name),'utf8'));}catch{continue;}
    if(desk?.schema!==SCHEMA)continue;pieces++;
    const state=releaseState(desk);
    for(const b of state.blockers){const person=desk.people.find(p=>p.id===b.personId);
     items.push({kind:'consent',band:'only-adrian',parentStudyId:desk.parentStudyId,pieceKey:desk.pieceKey,personId:b.personId,name:b.name,appears:person.appears,state:person.consent.state,reason:b.reason,requestDrafted:!!person.request,lastSent:person.sent.at(-1)?.sentAt||null,overridden:state.overridden,ifUnanswered:state.overridden?'Release goes ahead under your override.':'Release stays on hold.'});}
   }
  }
  return {schema:'ar-create.consent-open.v1',pieces,count:items.length,items};
 }
 return {read,open,recordClaim,linkClaim,flagClaim,clearFlag,recordPerson,draftRequest,recordSent,answer,removePerson,shareAnswer,override,release};
}
