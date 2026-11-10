// Templates of Adrian's own: a slide saved as a template (its layout and the things placed on it), or a new template an
// assistant wrote as markup. They sit beside the shipped Carousel layouts, each with a code he can say aloud.
//
// Records are plain files in the home's data: data/templates/<id>.json, one per template, a person can read. Who does
// what follows the app's three bands: Adrian's own saves are kept at once; an assistant's save or markup is a proposal,
// and only Adrian accepts it or turns it down (template.decide) or retires a kept one (template.retire).
//
// THE CODE LEDGER. A template takes the next free number in its row when it is kept (C5 after the shipped C1 to C4).
// data/templates/codes.json lists every code ever given out, with the template it went to, and is only ever added to:
// it is written before the template, and a code in it is never given again, even after its template is retired. The
// next free number in a row is one past the highest of the row's shipped layouts, every code the ledger holds and every
// code on a template file (retired ones too), so a lost ledger still cannot give a code twice. A ledger that is there but
// cannot be read gives no code at all. A code names one layout only: his codes never change, so when a later release
// ships a layout under a code he already holds, that shipped layout takes the next free number in its row in his home,
// recorded in the ledger ({shipped: true, shippedCode}) so it keeps that code from then on.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {StateError} from '../store.mjs';
import {currentActor,isHuman,requireWriteActor} from './actor.mjs';
import {atomicWrite,ensurePrivateDirectory,regular} from './files.mjs';
import {sharedLooks,checkLookId,slug} from './looks.mjs';
import {ROWS,entryForCode} from '../src/donors/mag/carousel/ig-codes.mjs';
import {OWN_ROWS} from '../src/donors/mag/carousel/ig-look-render.mjs';
import {checkMarkup} from '../src/donors/mag/carousel/ig-template-markup.mjs';

export const TEMPLATE_SCHEMA='ar-create.template.v1',LEDGER_SCHEMA='ar-create.template-codes.v1';
export const OWN_ID=/^own-[a-z0-9][a-z0-9-]{0,48}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/,KINDS=['cover','inner','single','close'],STATUSES=['kept','proposed','turned-down','retired'];
const ROLES_OF=Object.freeze({cover:['cover'],inner:['inner'],close:['close'],single:['cover','inner']});
const fail=(message,status=400)=>{throw new StateError(message,status);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const rowOf=letter=>ROWS.find(r=>r.letter===letter)||null;
const plainName=v=>typeof v==='string'&&v.trim()&&v.trim().length<=80&&!/[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/.test(v);
const actorNow=()=>currentActor()?.actor||'';
const needHuman=what=>{const a=actorNow();if(!isHuman(a))fail(what+' is Adrian\'s to decide; '+(a||'an unattributed caller')+' may propose templates, never '+(what.toLowerCase())+'.',403);};

export function createTemplates({dataDir,looks=null}={}){
 if(!dataDir)throw Error('Templates need the data folder.');
 const dir=path.join(dataDir,'templates'),ledgerFile=path.join(dir,'codes.json'),file=id=>path.join(dir,id+'.json');
 const lookStore=()=>looks||sharedLooks({dataDir});
 let queue=Promise.resolve();
 const serial=fn=>{const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;};
 const readJson=f=>{try{regular(f);return JSON.parse(fs.readFileSync(f,'utf8'));}catch(error){if(error.code==='ENOENT'||error.status===404||error instanceof SyntaxError)return null;throw error;}};
 const CODE=/^([A-Z])(\d{1,3})$/;
 const UNREADABLE='The code ledger (templates/codes.json) is there but cannot be read, so no code is given out: a code must never be given twice. Nothing was changed. Restore the file, or move it aside and the next codes are worked out from the templates on disk.';
 /** The ledger of every code given out: {state: ok, missing or unreadable, given:[{code, row, number, templateId | shipped+shippedCode, by, at}]}. */
 function ledger(){
  let raw;
  try{regular(ledgerFile);raw=fs.readFileSync(ledgerFile,'utf8');}catch(error){if(error.code==='ENOENT'||error.status===404)return {state:'missing',given:[]};return {state:'unreadable',given:[]};}
  try{const l=JSON.parse(raw);if(l?.schema===LEDGER_SCHEMA&&Array.isArray(l.given)&&l.given.every(g=>g&&typeof g.code==='string'&&CODE.test(g.code)))return {state:'ok',given:l.given};}catch{}
  return {state:'unreadable',given:[]};
 }
 const writeLedger=given=>{ensurePrivateDirectory(dataDir,'templates');atomicWrite(ledgerFile,JSON.stringify({schema:LEDGER_SCHEMA,given},null,1)+'\n');};
 /** The next free number in a row: one past its shipped layouts, the ledger's codes there and every template file's code there. */
 function freeCode(letter,given){
  const row=rowOf(letter);if(!row)fail('There is no row '+letter+'.');
  const taken=[...given.map(g=>g.code),...all().map(r=>r.code)].map(c=>CODE.exec(String(c||''))).filter(m=>m&&m[1]===letter).map(m=>Number(m[2]));
  const n=Math.max(row.items.length,...taken)+1;
  return {code:letter+n,row:letter,number:n};
 }
 function nextCode(letter){const l=ledger();if(l.state==='unreadable')fail(UNREADABLE,422);return freeCode(letter,l.given);}
 /**
  * Shipped layouts whose code one of his templates holds in this home, each moved to the next free number in its row
  * here: Map shipped code -> code in this home. A new clash is recorded in the ledger at once, so the move is stable.
  * With an unreadable ledger nothing is written, and a clashing shipped layout has no code here until it is restored.
  */
 function shippedMoves(){
  const l=ledger(),moves=new Map(),held=new Set();
  for(const g of l.given)if(g.shipped&&typeof g.shippedCode==='string')moves.set(g.shippedCode,g.code);else held.add(g.code);
  for(const r of all())if(r.code)held.add(r.code);
  const clashes=[...held].filter(c=>entryForCode(c)&&!moves.has(c)).sort();
  if(clashes.length&&l.state!=='unreadable'){
   const given=[...l.given],at=new Date().toISOString();
   for(const c of clashes){const next=freeCode(c[0],given);given.push({code:next.code,row:next.row,number:next.number,shipped:true,shippedCode:c,layout:entryForCode(c).layout,by:'ar-create',at});moves.set(c,next.code);}
   writeLedger(given);
  }
  return {moves,held};
 }
 const load=id=>{if(typeof id!=='string'||!OWN_ID.test(id))return null;const r=readJson(file(id));return r&&r.schema===TEMPLATE_SCHEMA&&r.id===id?r:null;};
 const all=()=>{let names=[];try{names=fs.readdirSync(dir).filter(n=>/^own-[a-z0-9-]+\.json$/.test(n));}catch{}return names.map(n=>load(n.slice(0,-5))).filter(Boolean);};
 const content=r=>({name:r.name,code:r.code,status:r.status,from:r.from,base:r.base??null,markup:r.markup??null,fixedWords:r.fixedWords??[],placed:r.placed,looks:r.looks,row:r.row,kind:r.kind,photos:r.photos,textParts:r.textParts});
 const hashOf=r=>digest(JSON.stringify(content(r)));
 const view=r=>({...r,operations:(r.operations||[]).slice(0,20),hash:hashOf(r)});
 /**
  * A template as the catalogue lists it, beside the shipped layouts: {id, name, code, row, rowLetter, kind, formats,
  * photos, roles, textParts, maxChars, looks, owner: true, from, status, ...}. `base` is the layout a saved slide came from.
  */
 function entry(r){
  const row=rowOf(r.row);
  return {id:r.id,name:r.name,catalogName:r.name,code:r.code||null,row:row?row.row:null,rowLetter:r.row,kind:r.kind,formats:r.formats||['post','carousel','story'],photos:r.photos,roles:r.roles||ROLES_OF[r.kind],
   textParts:r.textParts,maxChars:r.maxChars||400,look:Array.isArray(r.looks)?r.looks[0]:null,looks:r.looks,group:'Yours',isNew:false,owner:true,from:r.from,base:r.base??null,status:r.status,
   onlyIn:Object.hasOwn(OWN_ROWS,r.row)?'teajia':null,frameHeight:r.frameHeight||1350};
 }
 /** An owner template by its id or its code (any case); null when none has it. A code is read from the template files. */
 function find(value){
  if(typeof value!=='string')return null;
  if(OWN_ID.test(value))return load(value);
  const code=value.trim().toUpperCase();if(!CODE.test(code))return null;
  return all().find(r=>r.code===code)||null;
 }
 /**
  * What a code names in this home: {own: template} (one of his), {shipped: code in the table} (a shipped layout moved
  * here because his template holds its code), {held: true} (given to a template that is no longer on file: it names
  * nothing, and is never given again), or null (the shipped table's own code, untouched here).
  */
 function resolveCode(value){
  const code=String(value??'').trim().toUpperCase();if(!CODE.test(code))return null;
  const own=all().find(r=>r.code===code);if(own)return {own};
  const {moves,held}=shippedMoves();
  for(const [shipped,here] of moves)if(here===code)return {shipped};
  return held.has(code)?{held:true}:null;
 }
 /** Every code this home adds: his templates' and the moved shipped layouts', for hearing codes said aloud. */
 const codes=()=>{const {moves}=shippedMoves();return [...all().map(r=>r.code).filter(Boolean),...moves.values()];};
 async function list({status='kept',look}={}){
  if(status!=='all'&&!STATUSES.includes(status))fail('status is kept, proposed, turned-down, retired or all.');
  if(look!==undefined&&look!==null&&look!=='')checkLookId(look);
  const rows=all().filter(r=>status==='all'||r.status===status).filter(r=>!look||r.looks===null||r.looks.includes(look));
  rows.sort((a,b)=>String(a.code||'~').localeCompare(String(b.code||'~'),'en',{numeric:true})||String(a.createdAt).localeCompare(String(b.createdAt)));
  return {templates:rows.map(r=>({...entry(r),hash:hashOf(r),revision:r.revision,proposedBy:r.proposedBy||null,decidedBy:r.decidedBy||null,createdAt:r.createdAt})),ledger:ledger().given.map(({code,templateId,shippedCode,at})=>({code,...(shippedCode?{shippedCode}:{templateId}),at}))};
 }
 async function read({id}={}){const r=load(id);if(!r)fail('No template has that id.',404);return {...view(r),entry:entry(r)};}

 const checkLooks=value=>{
  if(value===undefined||value===null||value==='all')return null;
  const list=typeof value==='string'?[value]:value;
  if(!Array.isArray(list)||!list.length||list.length>20)fail('looks is "all", one look id, or a list of look ids.');
  for(const l of list){checkLookId(l);if(!lookStore().load(l))fail('No look has the id '+l+'.',422);}
  if(new Set(list).size!==list.length)fail('A look is listed twice.');
  return [...list];
 };
 const uniqueId=name=>{const base='own-'+slug(name).slice(0,40);let id=base,n=2;while(fs.existsSync(file(id)))id=base+'-'+n++;return id;};
 const replayed=operationId=>all().find(r=>(r.operations||[]).some(o=>o.operationId===operationId))||null;
 /** Give a kept template its code: the ledger is written first, so the code is spent even if the template write fails. */
 function giveCode(r,actor){
  const l=ledger();if(l.state==='unreadable')fail(UNREADABLE,422);
  const next=freeCode(r.row,l.given),at=new Date().toISOString();
  writeLedger([...l.given,{code:next.code,row:next.row,number:next.number,templateId:r.id,by:actor,at}]);
  return next.code;
 }
 function create(fields,input,what){
  const actor=actorNow(),at=new Date().toISOString(),human=isHuman(actor);
  const r={schema:TEMPLATE_SCHEMA,id:uniqueId(fields.name),...fields,code:null,status:human?'kept':'proposed',revision:1,createdAt:at,createdBy:actor,...(human?{}:{proposedBy:actor}),operations:[{operationId:input.operationId,revision:1,actor,what,at}]};
  ensurePrivateDirectory(dataDir,'templates');
  if(human)r.code=giveCode(r,actor);
  atomicWrite(file(r.id),JSON.stringify(r,null,1)+'\n');
  return r;
 }
 const common=input=>{
  requireWriteActor();
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  if(!UUID.test(input.operationId||''))fail('Every write needs a fresh operationId (a UUID).');
  if(!plainName(input.name))fail('A template needs a plain name of up to 80 characters, without < or >.');
 };

 /**
  * Keep a slide as a template (called by the Instagram studio, which reads the plan): {operationId, name, looks?,
  * base, row, kind, placed, photos, textParts, maxChars, formats, roles, frameHeight, from:{planId, format, slide}}, or
  * markup in place of base when the slide was drawn from a markup template. Adrian's is kept with its code at once; an
  * assistant's is a proposal he accepts or turns down.
  */
 async function fromSlide(input){
  common(input);
  return serial(async()=>{
   const again=replayed(input.operationId);if(again)return read({id:again.id});
   if(!rowOf(input.row))fail('This slide\'s layout has no row, so a template made from it has no code to take.',422);
   const fields={name:input.name.trim(),from:'slide',...(input.markup?{markup:input.markup,fixedWords:Array.isArray(input.fixedWords)?input.fixedWords:[]}:{base:input.base}),placed:input.placed||[],looks:checkLooks(input.looks),row:input.row,kind:KINDS.includes(input.kind)?input.kind:rowOf(input.row).kind,
    photos:input.photos,textParts:input.textParts,maxChars:input.maxChars,formats:input.formats,roles:input.roles,frameHeight:input.frameHeight,source:input.source};
   const r=create(fields,input,'save slide '+input.source.slide+' of '+input.source.format+' as a template');
   return read({id:r.id});
  });
 }
 /**
  * An assistant (or Adrian) proposes a new template as markup: {operationId, name, row (a row letter), kind?, markup,
  * looks? (default every look)}. The markup is checked by allowlist (ig-template-markup.mjs) and kept in the catalogue's
  * own form. It is a proposal until Adrian accepts it; his own is kept at once.
  */
 async function propose(input){
  common(input);
  const row=typeof input.row==='string'?input.row.trim().toUpperCase():'';
  if(!rowOf(row))fail('Name the row the template belongs in, by its letter: '+ROWS.map(r=>r.letter+' ('+r.row+')').join(', ')+'.');
  if(input.kind!==undefined&&!KINDS.includes(input.kind))fail('kind is cover, inner, single or close.');
  const lookIds=checkLooks(input.looks);
  const resolved=(lookIds||lookStore().ids()).map(id=>{try{return lookStore().roles(id);}catch{return null;}}).filter(Boolean);
  let checked;
  try{checked=checkMarkup(input.markup,{looks:resolved});}catch(error){if(error.refused)fail('This template is refused: '+error.message,422);throw error;}
  return serial(async()=>{
   const again=replayed(input.operationId);if(again)return read({id:again.id});
   const kind=input.kind||rowOf(row).kind;
   // Every fixed word the template carries is kept on the record, plainly, so he sees them all before he accepts.
  const r=create({name:input.name.trim(),from:'markup',markup:checked.markup,fixedWords:checked.fixedWords,placed:[],looks:lookIds,row,kind,photos:checked.photos,textParts:checked.textParts,maxChars:400,formats:['post','carousel','story'],roles:ROLES_OF[kind],frameHeight:1350},input,'propose a template from markup');
   return read({id:r.id});
  });
 }
 function change(input,what,apply){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  if(!UUID.test(input.operationId||''))fail('Every write needs a fresh operationId (a UUID).');
  return serial(async()=>{
   const before=load(input.id);if(!before)fail('No template has that id.',404);
   if((before.operations||[]).some(o=>o.operationId===input.operationId))return read({id:before.id});
   if(!Number.isSafeInteger(input.expectedRevision)||!HASH.test(input.expectedHash||''))fail('Read the template and send its expectedRevision and expectedHash.');
   if(input.expectedRevision!==before.revision||input.expectedHash!==hashOf(before))fail('This template changed since you read it. Read it again; nothing was changed.',409);
   const actor=actorNow(),at=new Date().toISOString(),next={...before};
   const said=apply(next,actor,at);
   next.revision=before.revision+1;
   next.operations=[{operationId:input.operationId,revision:next.revision,actor,what:said||what,at},...(before.operations||[])].slice(0,80);
   atomicWrite(file(next.id),JSON.stringify(next,null,1)+'\n');
   return read({id:next.id});
  });
 }
 /** Adrian accepts a proposed template (it takes the next free code in its row) or turns it down: {operationId, id, decision: accept|turn-down, expectedRevision, expectedHash}. */
 async function decide(input){
  needHuman('Accepting or turning down a template');
  const decision=input?.decision;if(!['accept','turn-down'].includes(decision))fail('decision is accept or turn-down.');
  return change(input,decision,(r,actor,at)=>{
   if(r.status!=='proposed')fail('This template is '+r.status+', not a proposal.',409);
   if(decision==='turn-down'){Object.assign(r,{status:'turned-down',decidedBy:actor,decidedAt:at});return 'turn down';}
   Object.assign(r,{status:'kept',decidedBy:actor,decidedAt:at});r.code=giveCode(r,actor);return 'accept as '+r.code;
  });
 }
 /** Adrian retires a kept template: it is no longer offered, plans that use it keep drawing, and its code is never given again. */
 async function retire(input){
  needHuman('Retiring a template');
  return change(input,'retire',(r,actor,at)=>{if(r.status!=='kept')fail('Only a kept template is retired; this one is '+r.status+'.',409);Object.assign(r,{status:'retired',retiredBy:actor,retiredAt:at});return 'retire '+r.code;});
 }
 return {list,read,find,resolveCode,shippedMoves,entry,codes,nextCode,fromSlide,propose,decide,retire,all,load};
}

const instances=new Map();
export function sharedTemplates({dataDir}){let found=instances.get(dataDir);if(!found){found=createTemplates({dataDir});instances.set(dataDir,found);}return found;}

/** /api/templates, /api/template, /api/template/propose, /api/template/decide and /api/template/retire. */
export async function handleTemplates(request,response,{dataDir,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid'),route=url.pathname;
 if(route!=='/api/templates'&&route!=='/api/template'&&!route.startsWith('/api/template/'))return false;
 const templates=sharedTemplates({dataDir});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 const only=keys=>{const extra=[...url.searchParams.keys()].find(k=>!keys.includes(k));if(extra)fail('Unknown query field: '+extra+'.');};
 try{
  const GET={'/api/templates':()=>{only(['status','look']);return templates.list({status:url.searchParams.get('status')??undefined,look:url.searchParams.get('look')??undefined});},'/api/template':()=>{only(['id']);return templates.read({id:url.searchParams.get('id')});}};
  const POST={'/api/template/propose':i=>templates.propose(i),'/api/template/decide':i=>templates.decide(i),'/api/template/retire':i=>templates.retire(i)};
  if(request.method==='GET'||request.method==='HEAD'){
   if(GET[route])return send(200,await GET[route]()),true;
   if(POST[route]){response.setHeader('Allow','POST');fail('Use POST.',405);}
   fail('Unknown template action.',404);
  }
  if(!POST[route]){if(GET[route]){response.setHeader('Allow','GET');fail('Use GET.',405);}fail('Unknown template action.',404);}
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  checkWrite?.();
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>256*1024)fail('That is too large for one request.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the request as JSON.');}
  const scope=id=>({operationId:input?.operationId,expectedRevision:input?.expectedRevision,expectedHash:input?.expectedHash,scope:{kind:'template',id}});
  request.arInput=scope(typeof input?.id==='string'?input.id:null);
  const result=await POST[route](input);
  // A proposal is journaled under the template it made.
  if(typeof result?.id==='string')request.arInput=scope(result.id);
  send(200,result);
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The template could not be read or saved. Nothing was changed.'});}
 return true;
}
