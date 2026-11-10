// Accounts: where a post goes. An account is a label and a destination, nothing more: a name, the service (instagram
// for now), a handle, the link people are sent to, and the looks that post there. It holds no credentials and nothing
// here posts or touches the network. A look can post to several accounts; the account is chosen per post.
//
// Shipped starting accounts live in the repository (editorial/accounts/<id>.json). What Adrian or an assistant adds or
// changes lives in the home's data (data/accounts/<id>.json, with its revision, who saved it and the last operations).
// A home account wins over the shipped one with the same id. Every save is checked against the revision and hash that
// were read, stamped with its actor, and journaled by the server like every other command. Twin of runtime/services/looks.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {StateError} from '../store.mjs';
import {currentActor,requireWriteActor} from './actor.mjs';
import {atomicWrite,ensurePrivateDirectory,regular} from './files.mjs';
import {checkLookId,sharedLooks,slug} from './looks.mjs';

export const SHIPPED_ACCOUNTS=fileURLToPath(new URL('../../editorial/accounts/',import.meta.url));
const SCHEMA='ar-create.account.v1',ID=/^[a-z0-9][a-z0-9-]{0,40}$/,SERVICE=/^[a-z0-9][a-z0-9-]{0,30}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const LINK=/^(?:https?:\/\/)?(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?::\d{1,5})?(?:[\/?#][A-Za-z0-9\-._~:\/?#\[\]@!$&()*+,;=%]*)?$|^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:[\/?#][A-Za-z0-9\-._~:\/?#\[\]@!$&()*+,;=%]*)?$/,HANDLE=/^@?[A-Za-z0-9._-]{0,60}$/,MAX_LOOKS=20,MAX_LINK=300,MAX_NAME=80;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
export const checkAccountId=id=>{if(typeof id!=='string'||!ID.test(id))fail('An account id is lower-case letters, digits and dashes, like teajia or mandala-codes.');return id;};
const plain=value=>typeof value==='string'&&!/[\u0000-\u001f\u007f\u0080-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/.test(value);

/** Check and tidy the fields of one account; every value is a plain string or a list of look ids. */
export function cleanFields(input,{lookExists=()=>true}={}){
 const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' '):'';
 if(!name||name.length>MAX_NAME||!plain(name)||/[<>]/.test(name))fail('An account needs a plain name of up to '+MAX_NAME+' characters, without < or >.');
 const service=input.service===undefined?'instagram':input.service;
 if(typeof service!=='string'||!SERVICE.test(service))fail('The service is a short lower-case word, like instagram.');
 const handle=input.handle===undefined||input.handle===null?'':input.handle;
 if(typeof handle!=='string'||!HANDLE.test(handle))fail('A handle is letters, digits, dots, dashes and underscores (it may be empty).');
 // The link is only ever kept as the text it was given: nothing opens it, fetches it or checks it.
 const link=input.link===undefined||input.link===null?'':input.link;
 if(typeof link!=='string'||link.length>MAX_LINK||!plain(link)||(link!==''&&!LINK.test(link)))fail('The link is empty, an http:// or https:// address, or a plain domain such as example.com/page, of up to '+MAX_LINK+' characters.');
 const looks=input.looks;
 if(!Array.isArray(looks)||looks.length>MAX_LOOKS)fail('looks is a list of up to '+MAX_LOOKS+' look ids that post to this account.');
 for(const l of looks){checkLookId(l);if(!lookExists(l))fail('No look has the id '+l+'. Save the look first, or leave it out.',422);}
 if(new Set(looks).size!==looks.length)fail('A look is listed twice.');
 return {name,service,handle,link,looks:[...looks]};
}

export function createAccounts({dataDir,shippedDir=SHIPPED_ACCOUNTS,looks=null}={}){
 if(!dataDir)throw Error('Accounts need the data folder.');
 const homeFile=id=>path.join(dataDir,'accounts',id+'.json'),shipFile=id=>path.join(shippedDir,id+'.json');
 const lookStore=()=>looks||sharedLooks({dataDir});
 const queues=new Map(),serial=(id,fn)=>{const run=(queues.get(id)||Promise.resolve()).then(fn,fn);queues.set(id,run.catch(()=>{}));return run;};
 const readJson=file=>{try{regular(file);return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(error.code==='ENOENT'||error.status===404)return null;if(error instanceof SyntaxError)return null;throw error;}};
 const hashOf=f=>digest(JSON.stringify({name:f.name,service:f.service,handle:f.handle,link:f.link,looks:f.looks}));
 /** One account as it stands: the home copy if there is one, else the shipped copy. Null when neither exists. */
 function load(id){
  checkAccountId(id);
  const home=readJson(homeFile(id)),ship=readJson(shipFile(id));
  const rec=home||ship;if(!rec||rec.schema!==SCHEMA||rec.id!==id)return null;
  const fields={name:String(rec.name||id),service:String(rec.service||'instagram'),handle:String(rec.handle||''),link:String(rec.link||''),looks:Array.isArray(rec.looks)?rec.looks.filter(l=>typeof l==='string'&&ID.test(l)):[]};
  return {id,...fields,home:!!home,shipped:!!ship,revision:home?.revision||0,updatedBy:home?.updatedBy||null,updatedAt:home?.updatedAt||null,operations:home?.operations||[],hash:hashOf(fields)};
 }
 const ids=()=>{const seen=new Set();for(const dir of [shippedDir,path.join(dataDir,'accounts')])try{for(const n of fs.readdirSync(dir)){const m=/^(.+)\.json$/.exec(n);if(m&&ID.test(m[1]))seen.add(m[1]);}}catch{}return [...seen].sort();};
 const describe=a=>({id:a.id,name:a.name,service:a.service,handle:a.handle,link:a.link,looks:a.looks,source:a.home?(a.shipped?'home, changing the shipped account':'home'):'shipped',revision:a.revision,hash:a.hash,updatedBy:a.updatedBy,updatedAt:a.updatedAt});
 const all=()=>ids().map(load).filter(Boolean);
 /** Every account, in id order. With `look`, each says whether that look may post to it, and `forLook` lists the ids that may. */
 async function list({look}={}){
  const rows=all().map(describe);
  if(look===undefined||look===null||look==='')return {accounts:rows};
  checkLookId(look);
  const out=rows.map(a=>({...a,postsLook:a.looks.includes(look)}));
  return {look,accounts:out,forLook:out.filter(a=>a.postsLook).map(a=>a.id)};
 }
 async function read({id}={}){const a=load(checkAccountId(id));if(!a)fail('No account has that id.',404);return {...describe(a),operations:a.operations.slice(0,20)};}
 /** The account a post goes to when its plan names none: the first (by id) that lists the plan's look; null if none does. */
 function defaultFor(lookId){return all().find(a=>a.looks.includes(lookId))||null;}
 /** A small, plain description of an account for a plan or an export; null when there is none. */
 const brief=a=>a?{id:a.id,name:a.name,service:a.service,handle:a.handle,link:a.link}:null;
 const get=id=>{try{return load(id);}catch{return null;}};

 /**
  * Save an account to the home. {id? (default: from the name), operationId, name, service?, handle?, link?, looks,
  * expectedRevision, expectedHash} (the expected pair is needed when the account already exists, shipped or home).
  * It is filing, not publishing: owner or assistant. The actor is stamped and the server journals the write.
  */
 async function save(input){
  requireWriteActor();
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  if(!UUID.test(input.operationId||''))fail('Every write needs a fresh operationId (a UUID).');
  const id=checkAccountId(input.id===undefined?slug(input.name):input.id);
  const fields=cleanFields(input,{lookExists:l=>!!lookStore().load(l)});
  return serial(id,async()=>{
   const before=load(id),actor=currentActor()?.actor||'';
   if(before?.operations.some(o=>o.operationId===input.operationId))return read({id});
   if(before&&(input.expectedRevision!==before.revision||input.expectedHash!==before.hash)){
    if(!Number.isSafeInteger(input.expectedRevision)||!HASH.test(input.expectedHash||''))fail('This account exists. Read it and send its expectedRevision and expectedHash.');
    fail('This account changed since you read it. Read it again; nothing was overwritten.',409);
   }
   ensurePrivateDirectory(dataDir,'accounts');
   const revision=(before?.revision||0)+1,at=new Date().toISOString(),what=before?(before.home?'change':'change the shipped account'):'new account';
   const record={schema:SCHEMA,id,...fields,revision,updatedBy:actor,updatedAt:at,operations:[{operationId:input.operationId,revision,actor,what,at},...(before?.operations||[])].slice(0,80)};
   atomicWrite(homeFile(id),JSON.stringify(record,null,1)+'\n');
   return read({id});
  });
 }
 return {list,read,save,load:get,defaultFor,brief,all};
}

const instances=new Map();
export function sharedAccounts({dataDir}){let found=instances.get(dataDir);if(!found){found=createAccounts({dataDir});instances.set(dataDir,found);}return found;}

/** /api/accounts, /api/account and /api/account/save. */
export async function handleAccounts(request,response,{dataDir,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid'),route=url.pathname;
 if(route!=='/api/accounts'&&route!=='/api/account'&&!route.startsWith('/api/account/'))return false;
 const accounts=sharedAccounts({dataDir});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 const only=keys=>{const extra=[...url.searchParams.keys()].find(k=>!keys.includes(k));if(extra)fail('Unknown query field: '+extra+'.');};
 try{
  const GET={'/api/accounts':()=>{only(['look']);return accounts.list({look:url.searchParams.get('look')??undefined});},'/api/account':()=>{only(['id']);return accounts.read({id:url.searchParams.get('id')});}};
  if(request.method==='GET'||request.method==='HEAD'){
   if(GET[route])return send(200,await GET[route]()),true;
   if(route==='/api/account/save'){response.setHeader('Allow','POST');fail('Use POST.',405);}
   fail('Unknown account action.',404);
  }
  if(route!=='/api/account/save'){if(GET[route]){response.setHeader('Allow','GET');fail('Use GET.',405);}fail('Unknown account action.',404);}
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  checkWrite?.();
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>256*1024)fail('That is too large for one request.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the request as JSON.');}
  request.arInput={operationId:input?.operationId,expectedRevision:input?.expectedRevision,expectedHash:input?.expectedHash,scope:{kind:'account',id:typeof input?.id==='string'?input.id:(typeof input?.name==='string'?slug(input.name):null)}};
  send(200,await accounts.save(input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The account could not be read or saved. Nothing was changed.'});}
 return true;
}
