// The "needs you" list: every question an agent has for Adrian, in one place, sorted into the two bands that
// reach him (3 Nov 2026, "When to ask Adrian"). The third band, work an agent handles and reports after, never
// becomes an ask, so it has no place here.
//
//   only-adrian  He decides; nobody waits on him to approve it. These never apply themselves, however long they sit.
//   steer        The agent picks a default and carries on. The ask names the default and the time it applies if he
//                does not answer. He may change it afterwards; the list shows it as "applied by default".
//
// Agents raise asks and read the list. They never answer: the answer is a human-only decision, and it must come from
// the app's own page (actor human:adrian, client ui), so a command line or an MCP client cannot answer for him.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRecordingAttention,recordingAsk} from './recording-attention.mjs';
import {sharedWordLibrary} from './word-library.mjs';
import {StateError} from '../store.mjs';
import {currentActor,isHuman,requireWriteActor} from './actor.mjs';

const SCHEMA='ar-create.needs-you.v1',PREFIX='/api/needs-you',MAX_BODY=64*1024;
export const BANDS=Object.freeze(['only-adrian','steer']);
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
// A link may only point back into the app, at the screen where a human-only click happens (publish, send, consent).
// The document study page, or one recording's transcript check screen.
const APP_LINK=/^(?:\/document-study\/index\.html(?:\?[A-Za-z0-9=&%._~:+-]{1,800})?|\/transcript-check\/index\.html\?job=[a-f0-9-]{36})$/;
const LIMITS=Object.freeze({question:280,choice:80,choices:5,about:120,text:500,label:60,openAsks:100,keepDays:30,horizonDays:30});
const DAY=24*60*60*1000;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const fields=(input,allowed)=>{if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');const extra=Object.keys(input).filter(k=>!allowed.includes(k));if(extra.length)fail('Unknown field: '+extra[0]+'.');};
const text=(v,what,max,{required=false}={})=>{
 if(v===undefined||v===null||v===''){if(required)fail(what+' is required.');return '';}
 if(typeof v!=='string')fail(what+' must be text.');
 const t=v.replace(/\s+/g,' ').trim();
 if(required&&!t)fail(what+' is required.');
 if(t.length>max)fail(what+' is up to '+max+' characters.');
 return t;
};

/** One list in one JSON file. `now` is injectable so the schedule can be tested without waiting. */
export function createNeedsYou({dataDir,now=()=>Date.now(),onChange=()=>{},recordingAttention=null}={}){
 if(!dataDir)throw Error('The needs-you list needs the data folder.');
 const dir=path.join(dataDir,'needs-you'),file=path.join(dir,'asks.json');
 let queue=Promise.resolve();
 const serial=fn=>{const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;};
 const load=()=>{
  try{const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.schema!==SCHEMA||!Array.isArray(value.asks))fail('The needs-you file is not readable.',409);return value;}
  catch(error){if(error.code==='ENOENT')return {schema:SCHEMA,asks:[]};throw error;}
 };
 const store=state=>{
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const tmp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(state,null,1),{mode:0o600});fs.renameSync(tmp,file);
 };
 const iso=ms=>new Date(ms).toISOString();

 // Steer defaults apply on schedule. Only a steer ask with a default ever applies itself; an Only-Adrian ask
 // is skipped here even if its file was edited by hand to carry one.
 function sweep(state){
  const at=now(),changed=[];
  for(const ask of state.asks){
   if(recordingAsk(ask)||ask.status!=='open'||ask.band!=='steer'||!ask.default||!ask.applyAt)continue;
   if(Date.parse(ask.applyAt)>at)continue;
   ask.status='defaulted';
   ask.resolution={choice:ask.default,text:'',by:'default',client:null,via:'default',at:iso(at),operationId:null};
   changed.push(ask);
  }
  const cutoff=at-LIMITS.keepDays*DAY,before=state.asks.length;
  state.asks=state.asks.filter(a=>a.status==='open'||Date.parse(a.resolution?.at||a.raisedAt)>cutoff);
  return {changed,pruned:state.asks.length!==before};
 }
 // Run a read or write against a fresh, swept state; persist only when something moved.
 const withState=(fn)=>serial(async()=>{
  const state=load(),swept=sweep(state);
  const result=await fn(state);
  if(swept.changed.length||swept.pruned||result?.dirty)store(state);
  for(const ask of swept.changed)onChange('defaulted',view(ask));
  for(const [kind,shown] of result?.notify||[])onChange(kind,shown);
  return result?.value??result;
 });

 const view=ask=>({id:ask.id,band:ask.band,question:ask.question,about:ask.about,choices:ask.choices,scope:ask.scope,link:ask.link,
  default:ask.default,applyAt:ask.applyAt,status:ask.status,raisedBy:ask.raisedBy,raisedClient:ask.raisedClient,raisedAt:ask.raisedAt,
  resolution:ask.resolution,earlier:ask.history.length,execution:{status:'unverified',complete:false,operationId:null,reason:'This queue records a choice, not a verified domain result. The responsible owner must report completion.'}});
 const rank=ask=>ask.status==='open'?(ask.band==='only-adrian'?0:1):ask.status==='defaulted'?2:3;
 const order=(a,b)=>rank(a)-rank(b)||(a.status==='open'&&a.band==='steer'?Date.parse(a.applyAt)-Date.parse(b.applyAt):Date.parse(b.resolution?.at||b.raisedAt)-Date.parse(a.resolution?.at||a.raisedAt)||Date.parse(a.raisedAt)-Date.parse(b.raisedAt));

 async function list({status='pending',id}={}){
  if(!['pending','open','defaulted','answered','all'].includes(status))fail('status is pending, open, defaulted, answered or all.');
  return withState(async state=>{
   let asks=state.asks;
   if(id!==undefined){if(!UUID.test(id))fail('id is an ask id.');asks=asks.filter(a=>a.id===id);}
   const keep={pending:a=>a.status==='open'||a.status==='defaulted',open:a=>a.status==='open',defaulted:a=>a.status==='defaulted',answered:a=>a.status==='answered',all:()=>true}[status];
   const visible=recordingAttention&&id===undefined?await recordingAttention(asks.map(view)):asks.map(view);
   const shown=visible.filter(keep).sort(order);
   const counted=id===undefined?visible:state.asks;
   const count=s=>counted.filter(a=>a.status===s).length;
   return {value:{schema:SCHEMA,now:iso(now()),status,asks:shown,counts:{open:count('open'),onlyAdrian:counted.filter(a=>a.status==='open'&&a.band==='only-adrian').length,steer:counted.filter(a=>a.status==='open'&&a.band==='steer').length,defaulted:count('defaulted'),answered:count('answered')}}};
  });
 }

 async function raise(input,context=currentActor()){
  fields(input,['operationId','band','question','choices','about','scope','link','default','applyAt']);
  if(!UUID.test(input.operationId||''))fail('A new ask needs a fresh operationId.');
  if(!BANDS.includes(input.band))fail('band is only-adrian or steer.');
  const question=text(input.question,'The question',LIMITS.question,{required:true}),about=text(input.about,'about',LIMITS.about);
  let choices=[];
  if(input.choices!==undefined){
   if(!Array.isArray(input.choices)||input.choices.length>LIMITS.choices)fail('choices are up to '+LIMITS.choices+' short options.');
   choices=input.choices.map(c=>text(c,'A choice',LIMITS.choice,{required:true}));
   if(new Set(choices.map(c=>c.toLowerCase())).size!==choices.length)fail('choices must differ from each other.');
  }
  let scope=null;
  if(input.scope!==undefined){
   const s=input.scope;if(!s||typeof s!=='object'||typeof s.kind!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(s.kind)||(s.id!==undefined&&s.id!==null&&(typeof s.id!=='string'||!/^[A-Za-z0-9._:-]{1,160}$/.test(s.id))))fail('scope is {kind,id} naming the record the ask is about.');
   scope={kind:s.kind,id:s.id??null};
  }
  let link=null;
  if(input.link!==undefined){
   const l=input.link;fields(l,['label','href']);
   if(typeof l.href!=='string'||!APP_LINK.test(l.href))fail('A link points back into the app: /document-study/index.html with an optional ?query, or a recording\'s /transcript-check/index.html?job=<id>.');
   link={label:text(l.label,'The link label',LIMITS.label,{required:true}),href:l.href};
  }
  let def=null,applyAt=null;
  if(input.band==='only-adrian'){
   if(input.default!==undefined||input.applyAt!==undefined)fail('An Only Adrian ask never applies itself, so it has no default and no time. Use band steer if the agent can pick and carry on.');
  }else{
   if(link)fail('A step that only a human takes (publish, send, consent) is Only Adrian. A steer ask cannot point at one.');
   if(!choices.length)fail('A steer ask lists the choices so the default is one of them.');
   def=text(input.default,'The default',LIMITS.choice,{required:true});
   if(!choices.includes(def))fail('The default must be one of the choices.');
   const when=typeof input.applyAt==='string'?Date.parse(input.applyAt):NaN;
   if(!Number.isFinite(when))fail('A steer ask needs applyAt, the ISO time its default applies.');
   if(when<=now())fail('applyAt must be in the future.');
   if(when>now()+LIMITS.horizonDays*DAY)fail('applyAt is within '+LIMITS.horizonDays+' days.');
   applyAt=iso(when);
  }
  // A step at another screen is done there; one tap here only says it is done.
  if(link&&!choices.length)choices=['Done'];
  return withState(state=>{
   const same=state.asks.find(a=>a.operationId===input.operationId);
   if(same)return {value:{...view(same),replay:true}};
   const open=state.asks.filter(a=>a.status==='open');
   // The same raiser asking the same open question again is the same ask, not a second one.
   const twin=open.find(a=>a.raisedBy===context.actor&&a.question===question&&a.band===input.band&&a.about===about);
   if(twin)return {value:{...view(twin),duplicate:true}};
   if(open.length>=LIMITS.openAsks)fail('There are already '+LIMITS.openAsks+' asks waiting. Settle or fold some before raising more.',429);
   const ask={id:crypto.randomUUID(),operationId:input.operationId,band:input.band,question,about,choices,scope,link,default:def,applyAt,status:'open',
    raisedBy:context.actor,raisedClient:context.client||null,raisedAt:iso(now()),resolution:null,history:[]};
   state.asks.push(ask);
   return {dirty:true,value:view(ask),notify:[['raised',view(ask)]]};
  });
 }

 async function answer(input,context=currentActor()){
  fields(input,['operationId','id','choice','text']);
  // Only Adrian, only from the app's own page. A command line, an MCP client or an agent is never the voice here.
  if(!context||!isHuman(context.actor))fail('This is Adrian\'s answer to give; '+(context?.actor||'an unattributed caller')+' may raise and read asks, never answer them.',403);
  if(context.client!=='ui')fail('Answer from the Home list in the app, not from '+(context.client||'a script')+'. The list records who tapped it.',403);
  if(!UUID.test(input.operationId||''))fail('An answer needs a fresh operationId.');
  if(!UUID.test(input.id||''))fail('Name the ask by its id.');
  return withState(state=>{
   const ask=state.asks.find(a=>a.id===input.id);
   if(!ask)fail('That ask is not on the list any more.',404);
   if(ask.resolution?.operationId===input.operationId||ask.history.some(h=>h.operationId===input.operationId))return {value:view(ask)};
   let choice='',free='';
   if(ask.choices.length){
    if(input.text!==undefined)fail('This ask has choices; tap one.');
    choice=text(input.choice,'A choice',LIMITS.choice,{required:true});
    if(!ask.choices.includes(choice))fail('That is not one of the choices.');
   }else{
    if(input.choice!==undefined)fail('This ask takes your own words.');
    free=text(input.text,'Your answer',LIMITS.text,{required:true});
   }
   // A later answer replaces the earlier one on the list; the earlier one stays in the record.
   if(ask.resolution)ask.history.push(ask.resolution);
   ask.status='answered';
   ask.resolution={choice,text:free,by:context.actor,client:context.client,via:'human',at:iso(now()),operationId:input.operationId};
   return {dirty:true,value:view(ask),notify:[['answered',view(ask)]]};
  });
 }

 return {list,raise,answer,setRecordingAttention:project=>{recordingAttention=project;},peek:()=>({asks:load().asks.map(view)}),sweep:()=>withState(()=>({value:null}))};
}

const instances=new Map();
/** The one list for a data folder. The HTTP handler and other services (the shared word check raises its asks here
 *  in-process) must use the same instance, so the file is never written from two queues. */
export function sharedNeedsYou({dataDir,events,recordings}){
 let list=instances.get(dataDir);
 if(!list){
  list=createNeedsYou({dataDir,onChange:(kind,ask)=>events?.emit({kind:'needs-you.'+kind,scope:{kind:'needs-you',id:ask.id},revision:null,actor:ask.resolution?.by||ask.raisedBy,client:ask.resolution?.client||ask.raisedClient,operationId:null})});
  // Defaults apply on schedule even when nobody has the list open.
  const timer=setInterval(()=>{list.sweep().catch(()=>{});},30_000);timer.unref?.();
  instances.set(dataDir,list);
 }
 if(recordings)list.setRecordingAttention(createRecordingAttention({dataDir,corrections:recordings.transcriptCorrections,library:sharedWordLibrary({dataDir})}));
 return list;
}
/** One registration line in the server hands requests here; returns false for any other path. */
export async function handleNeedsYou(request,response,{dataDir,events,recordings,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid');
 if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))return false;
 const list=sharedNeedsYou({dataDir,events,recordings});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 try{
  const route=url.pathname.slice(PREFIX.length);
  if(route===''){
   if(request.method!=='GET'){response.setHeader('Allow','GET');fail('Read the list with GET.',405);}
   const query=Object.fromEntries([...url.searchParams].filter(([k])=>['status','id'].includes(k)));
   if([...url.searchParams.keys()].some(k=>!['status','id'].includes(k)))fail('Use status or id.');
   send(200,await list.list(query));return true;
  }
  if(route!=='/raise'&&route!=='/answer')fail('Unknown needs-you action.',404);
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  checkWrite?.();requireWriteActor();
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('That is too large for one ask.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the ask as JSON.');}
  request.arInput=input;
  send(200,route==='/raise'?await list.raise(input):await list.answer(input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The list could not be read or saved. Nothing was changed.'});}
 return true;
}
