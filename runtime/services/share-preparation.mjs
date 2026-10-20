import fs from 'node:fs';
import path from 'node:path';
import {constants} from 'node:fs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const SCHEMA='ar-create.share-preparation.v1';
const PREPARATION=['recipient','link','message','language','tone','checks','translatedMessage'];
const clone=v=>structuredClone(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status,outcome:'not-applied'});};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=100000)=>typeof v==='string'&&v.length<=max&&!v.includes('\0');
function fields(value,allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('Unsupported fields; caller paths and output snapshots are refused.',400);}

/** Local human preparation only. Inject existing trusted output/files owners at composition time. */
export function createSharePreparation({dataDir,outputs,files,outputPrivatePrefix}={}){
 if(!outputs?.read||!files?.atomicWrite||!files?.resolveInside||!files?.ensurePrivateDirectory||!files?.digest||typeof outputPrivatePrefix!=='function')throw Error('Existing trusted native output and private filesystem owners are required.');
 const {digest,regular,atomicWrite,ensurePrivateDirectory,resolveInside}=files;
 const hash=v=>digest(typeof v==='string'?v:JSON.stringify(v));
 function validate(input,action){
  fields(input,['rootBindingId','parentStudyId','selectedOutputId','recipientId','targetEdition',...(action?['expected','expectedEdition','operationId',...action==='save'?['changes']:action==='fact'?['fact']:['undoOperationId']]:[])]);
  if(!UUID.test(input.rootBindingId||'')||!text(input.parentStudyId,256)||!input.parentStudyId||!UUID.test(input.selectedOutputId||'')||!(UUID.test(input.recipientId||'')||input.recipientId==='none'))fail('Exact native root, parent, output and recipient identities required.',400);
  if(input.targetEdition!==undefined&&!HASH.test(input.targetEdition))fail('Exact retained edition hash required.',400);
  if(action&&(!UUID.test(input.operationId||'')||!HASH.test(input.expectedEdition||'')||!plain(input.expected)||!Number.isSafeInteger(input.expected.revision)||input.expected.revision<0||!HASH.test(input.expected.hash||'')))fail('Operation UUID and expected record revision/hash and edition required.',400);
 }
 function ownedStat(file,directory=false){
  const s=fs.lstatSync(file);if(s.isSymbolicLink()||directory&&!s.isDirectory()||!directory&&(!s.isFile()||s.nlink!==1)||typeof process.getuid==='function'&&s.uid!==process.getuid())fail('Share paths must remain ordinary owned files/directories.',403);
  return s;
 }
 function ownedChain(root){
  const absolute=path.resolve(root);let current=path.parse(absolute).root;
  for(const segment of absolute.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,segment);const s=fs.lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory())fail('Symlink data paths are refused.',403);}
  ownedStat(absolute,true);
 }
 async function authority(input){
  ownedChain(dataDir);
  const scope={rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId};
  const view=await outputs.read({...scope,selectedOutputId:input.selectedOutputId});
  if(!same(view.scope,scope)||view.output?.id!==input.selectedOutputId||!view.photoScope?.projectId||!view.photoScope?.documentId||!view.wordOwner||!view.writingProof||!view.freshness||!view.outputBindings?.some(b=>b.outputId===input.selectedOutputId&&same(b.wordOwner,view.wordOwner)))fail('Exact maintained output ownership is unavailable.');
  // Sibling output index changes deliberately do not change this output's edition.
  const currentEdition=hash({output:view.output,wordOwner:view.wordOwner,writingProof:view.writingProof});
  const identity={...scope,...view.photoScope,outputId:view.output.id,recipientId:input.recipientId};
  const relative=outputPrivatePrefix(identity.projectId,identity.documentId)+'share/'+identity.outputId;
  if(typeof relative!=='string'||relative.startsWith('/')||relative.split('/').some(p=>!p||p==='..'||p==='.'||p.includes('\\')))fail('Trusted private output prefix is invalid.');
  return {identity,currentEdition,freshness:clone(view.freshness),relative};
 }
 function location(a,{create=false}={}){
  let current=dataDir;
  for(const part of a.relative.split('/')){
   const next=path.join(current,part),s=fs.lstatSync(next,{throwIfNoEntry:false});
   if(!s){if(!create)return null;ensurePrivateDirectory(current,part);}
   ownedStat(next,true);current=next;
  }
  const file=resolveInside(dataDir,a.relative+'/'+hash(a.identity.recipientId)+'.json',{missing:true});
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});if(stat)ownedStat(file);
  return file;
 }
 function snapshot(a){
  const file=location(a),stat=file&&fs.lstatSync(file,{throwIfNoEntry:false});
  if(!stat)return {file,bytes:null,record:{schema:SCHEMA,identity:a.identity,revision:0,editions:[],operations:[]}};
  regular(file);if(stat.size>8*1024*1024)fail('Share record exceeds the bounded local record size.');
  const bytes=fs.readFileSync(file,'utf8');let record;try{record=JSON.parse(bytes);}catch{fail('Share record cannot be read; existing bytes preserved.');}
  if(record.schema!==SCHEMA||!same(record.identity,a.identity)||!Number.isSafeInteger(record.revision)||record.revision<0||!Array.isArray(record.editions)||!Array.isArray(record.operations)||record.editions.some(e=>!HASH.test(e.edition)||!Array.isArray(e.facts)||e.preparation!==null&&!plain(e.preparation))||new Set(record.editions.map(e=>e.edition)).size!==record.editions.length)fail('Share record ownership or version is invalid; existing bytes preserved.');
  return {file,bytes,record};
 }
 const expected=s=>({revision:s.record.revision,hash:hash(s.bytes??'')});
 function render(a,s,input,receipt){
  const current=s.record.editions.find(e=>e.edition===a.currentEdition);
  const edition=input.targetEdition||current?.edition||s.record.editions.at(-1)?.edition||a.currentEdition;
  const selected=s.record.editions.find(e=>e.edition===edition);
  if(input.targetEdition&&!selected)fail('Requested earlier edition is not retained.',404);
  const outdated=edition!==a.currentEdition||a.freshness.stale;
  const last=s.record.operations.filter(o=>o.edition===edition&&['save','undo'].includes(o.action)).at(-1);
  const preparationUndo=last?.action==='save'&&hash(selected?.preparation??null)===last.afterPreparationHash?{operationId:last.operationId}:null;
  return {schema:SCHEMA,identity:clone(a.identity),expected:expected(s),currentEdition:a.currentEdition,targetEdition:edition,preparationUndo,preparation:clone(selected?.preparation??null),facts:clone(selected?.facts??[]),editions:clone(s.record.editions),review:{outdated,linkNeedsReview:!!selected?.preparation?.link&&outdated,reason:outdated?(a.freshness.reason||'This invitation concerns an earlier edition.'):null},...receipt?{receipt:clone(receipt)}:{}};
 }
 async function read(input){validate(input);const a=await authority(input);return render(a,snapshot(a),input);}
 function validateFact(fact,recipientId){
  const common=['kind','recordedBy'];
  if(!plain(fact)||fact.recordedBy!=='human')fail('Actual facts require an explicit human record.',400);
  if(fact.kind==='sent'){
   fields(fact,[...common,'sentAt','channel']);if(!text(fact.sentAt,128)||!fact.sentAt.trim()||!text(fact.channel,256)||!fact.channel.trim()||recipientId==='none')fail('Sent fact requires actual human supplied date and channel.',400);
  }else if(fact.kind==='reply'){
   fields(fact,[...common,'receivedAt','original','translation','proposedCorrection','affectedReference']);
   if(!text(fact.original)||!fact.original.trim()||recipientId==='none'||fact.receivedAt!==undefined&&fact.receivedAt!==null&&!text(fact.receivedAt,128))fail('Reply fact requires the original human supplied reply.',400);
   for(const k of ['translation','proposedCorrection','affectedReference'])if(fact[k]!==undefined&&!text(fact[k]))fail('Reply details require readable human supplied text.',400);
   if(fact.proposedCorrection&&!fact.affectedReference?.trim())fail('Proposed correction requires its affected output reference.',400);
  }else if(['not-applicable','closed'].includes(fact.kind)){
   fields(fact,[...common,'reason']);if(!text(fact.reason)||!fact.reason.trim())fail('Human fact requires a reason.',400);
  }else fail('Unsupported actual fact; no sending, reply or publication is inferred.',400);
 }
 async function mutate(action,input){
  validate(input,action);const a=await authority(input);const file=location(a,{create:true});const lock=file+'.lock';let fd,lockIdentity;
  function ownsLock(){
   if(fd===undefined||!lockIdentity)return false;
   let check;
   try{
    if(location(a)!==file)return false;
    const named=ownedStat(lock),held=fs.fstatSync(fd);
    if(named.dev!==lockIdentity.dev||named.ino!==lockIdentity.ino||held.dev!==named.dev||held.ino!==named.ino||held.nlink!==1)return false;
    check=fs.openSync(lock,constants.O_RDONLY|constants.O_NOFOLLOW);
    const opened=fs.fstatSync(check);
    if(opened.dev!==named.dev||opened.ino!==named.ino||fs.readFileSync(check,'utf8')!==input.operationId)return false;
    const final=fs.lstatSync(lock);
    return !final.isSymbolicLink()&&final.dev===named.dev&&final.ino===named.ino;
   }catch{return false;}finally{if(check!==undefined)fs.closeSync(check);}
  }
  function releaseOwnedLock(){
   try{if(ownsLock())fs.unlinkSync(lock);}finally{if(fd!==undefined){fs.closeSync(fd);fd=undefined;}}
  }
  try{
   fd=fs.openSync(lock,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
   lockIdentity=fs.fstatSync(fd);fs.writeFileSync(fd,input.operationId);fs.fsyncSync(fd);
   if(!ownsLock())fail('Share lock ownership changed during acquisition.');
  }catch(error){releaseOwnedLock();if(error.code==='EEXIST')fail('Share record is busy; retry this same operation after the other writer finishes.');throw error;}
  try{
   const before=snapshot(a),record=clone(before.record),fingerprint=hash({action,input}),prior=record.operations.find(o=>o.operationId===input.operationId);
   if(prior){if(prior.fingerprint!==fingerprint)fail('Operation ID already belongs to another exact preparation request.');return render(a,before,input,prior.receipt);}
   if(!same(input.expected,expected(before)))fail('Share record changed; refresh before saving.');
   if(input.expectedEdition!==a.currentEdition)fail('Output edition changed; review the retained invitation before saving.');
   const target=input.targetEdition||a.currentEdition;let entry=record.editions.find(e=>e.edition===target);
   if(!entry){if(target!==a.currentEdition)fail('Unknown earlier output edition cannot be created.');entry={edition:target,preparation:null,facts:[]};record.editions.push(entry);}
   const previous=clone(entry.preparation);
   if(action==='save'){
    fields(input.changes,PREPARATION);if(!Object.keys(input.changes).length||Object.values(input.changes).some(v=>!text(v))||input.recipientId==='none')fail('Preparation changes require readable fields for an actual recipient.',400);
    entry.preparation={...entry.preparation,...clone(input.changes)};
   }else if(action==='fact'){
    validateFact(input.fact,input.recipientId);entry.facts.push({...clone(input.fact),operationId:input.operationId,affectedOutput:{outputId:a.identity.outputId,edition:target}});
   }else{
    const op=record.operations.find(o=>o.operationId===input.undoOperationId),last=record.operations.filter(o=>o.edition===target&&['save','undo'].includes(o.action)).at(-1);
    if(!op||op.action!=='save'||op.edition!==target||op!==last||hash(entry.preparation)!==op.afterPreparationHash)fail('Saved preparation Undo no longer matches the exact current preparation.');
    entry.preparation=clone(op.beforePreparation);
   }
   const latest=await authority(input);if(latest.currentEdition!==a.currentEdition||!same(latest.identity,a.identity))fail('Output edition changed during save; preparation was not applied.');
   // Re-resolve after the asynchronous owner read; never follow a replaced sidecar or parent.
   if(location(a)!==file)fail('Share file ownership changed during save.');
   if(!ownsLock())fail('Share lock ownership changed during save; preparation was not applied.');
   const now=snapshot(a);if(!same(expected(now),expected(before)))fail('Share record changed during save; existing bytes preserved.');
   record.revision++;
   const receipt={operationId:input.operationId,revision:record.revision,action,edition:target};
   record.operations.push({operationId:input.operationId,fingerprint,action,edition:target,beforePreparation:previous,afterPreparationHash:hash(entry.preparation),receipt});
   const bytes=JSON.stringify(record,null,2)+'\n';if(Buffer.byteLength(bytes)>8*1024*1024)fail('Share history has reached the bounded local record limit; no bytes changed.');
   atomicWrite(file,bytes,before.bytes===null?{exclusive:true}:{expectedHash:hash(before.bytes)});
   return render(latest,{file,bytes,record},input,receipt);
  }finally{releaseOwnedLock();}
 }
 async function list(input){
  fields(input,['rootBindingId','parentStudyId','selectedOutputId']);
  const selector={...input,recipientId:'none'};validate(selector);const a=await authority(selector),file=location(a);
  if(!file)return {currentEdition:a.currentEdition,records:[]};
  const names=fs.readdirSync(path.dirname(file)).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
  if(names.length>200)fail('Recipient register exceeds the bounded local list size.');
  const records=names.sort().map(name=>{
   const found=resolveInside(dataDir,a.relative+'/'+name);const stat=ownedStat(found);if(stat.size>8*1024*1024)fail('Share record exceeds the bounded local record size.');
   let value;try{value=JSON.parse(fs.readFileSync(found,'utf8'));}catch{fail('Recipient register contains an unreadable record; existing bytes preserved.');}
   const recipientId=value.identity?.recipientId;
   if(!(UUID.test(recipientId||'')||recipientId==='none')||name!==hash(recipientId)+'.json')fail('Recipient register ownership is invalid.');
   const own={...a,identity:{...a.identity,recipientId}};return render(own,snapshot(own),{...input,recipientId});
  });
  return {currentEdition:a.currentEdition,records};
 }
 return {read,list,save:i=>mutate('save',i),appendFact:i=>mutate('fact',i),undo:i=>mutate('undo',i)};
}
