// Photo selection projects existing owners. Only retain() writes, through Library.
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const SHA=/^[a-f0-9]{64}$/;
const MAX_BYTES=20*1024*1024,MAX_ITEMS=20000;
const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const plain=value=>JSON.stringify(value);
const description=value=>{if(typeof value!=='string'||value.length>2000||/[\u0000-\u001f\u007f%]/.test(value)||value.includes(' · ')||value.isWellFormed&&!value.isWellFormed())return '';return value.trim();};
export function magazinePhotoFormat(body){
 if(!Buffer.isBuffer(body)||!body.length||body.length>MAX_BYTES)fail('Photo is empty or exceeds the 20 MB limit.',413);
 if(body.length>=3&&body[0]===255&&body[1]===216&&body[2]===255)return {extension:'jpg',contentType:'image/jpeg'};
 if(body.length>=8&&body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {extension:'png',contentType:'image/png'};
 if(body.length>=6&&['GIF87a','GIF89a'].includes(body.subarray(0,6).toString('ascii')))return {extension:'gif',contentType:'image/gif'};
 if(body.length>=12&&body.subarray(0,4).toString('ascii')==='RIFF'&&body.subarray(8,12).toString('ascii')==='WEBP')return {extension:'webp',contentType:'image/webp'};
 if(body.length>=16&&body.subarray(4,8).toString('ascii')==='ftyp'&&['avif','avis'].includes(body.subarray(8,12).toString('ascii')))return {extension:'avif',contentType:'image/avif'};
 fail('This file is not a supported photo.',415);
}
const insertionIdentity=input=>hash(plain([input.rootId,input.sourceId]));
const identityName=/^[a-f0-9]{64}-[a-f0-9]{64}\.(jpg|png|gif|webp|avif)$/;
const token=(digest,format)=>`library-photo-${digest}.${format.extension}`;
function selector(value,{read=false}={}){
 const keys=read&&!Object.hasOwn(value||{},'sourceHash')?['rootId','sourceId','revision']:['rootId','sourceId','revision','sourceHash'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))||!SHA.test(value.rootId||'')||typeof value.sourceId!=='string'||value.sourceId.length>128||!SHA.test(value.revision||'')||!(SHA.test(value.sourceHash||'')||read&&(!Object.hasOwn(value,'sourceHash')||value.sourceHash===null)))fail('Select an exact current photo identity, revision and hash.');
 return value;
}
// Optional existing-asset transport proof; bytes remain the retained original.
const originTuple=(value,expectedHash)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===4&&['rootId','sourceId','revision','sourceHash'].every(k=>Object.hasOwn(value,k))&&['rootId','revision','sourceHash'].every(k=>SHA.test(value[k]||''))&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.sourceId||'')&&value.sourceHash===expectedHash?Object.fromEntries(['rootId','sourceId','revision','sourceHash'].map(k=>[k,value[k]])):null;
export function magazinePhotoOriginHeader(preview){const value=originTuple(preview?.retainedOrigin,preview?.hash);return value?Buffer.from(JSON.stringify(value)).toString('base64url'):null;}
export function readMagazinePhotoOriginHeader(header,expectedHash){
 if(header===null||header===undefined)return null;
 if(typeof header!=='string'||header.length>1024||!header.length||!/^[A-Za-z0-9_-]+$/.test(header))fail('The retained photograph origin proof is invalid.',409);
 let value;try{value=JSON.parse(Buffer.from(header,'base64url').toString('utf8'));}catch{fail('The retained photograph origin proof is invalid.',409);}
 const tuple=originTuple(value,expectedHash);if(!tuple||Buffer.from(JSON.stringify(tuple)).toString('base64url')!==header)fail('The retained photograph origin proof is invalid.',409);return tuple;
}
export function createMagazineLibraryPhotos({library,originals=null,publication=null}={}){
 if(!library?.photosSnapshot||!library?.binarySnapshot||!library?.retainAlbumPhoto)fail('The maintained Library photo owner is required.',503);
 let entries=new Map(),verified=new Map(),pending=Promise.resolve();
 const key=item=>plain([item.rootId,item.sourceId,item.revision,item.sourceHash]);
 const serialize=fn=>{const result=pending.then(fn);pending=result.catch(()=>{});return result;};
 const metadataKey=(item,revision)=>plain([item.rootId,item.sourceId,revision]);
 async function read(entry){
  if(entry.item.byteVerification==='unavailable')fail('This indexed photograph is unavailable. Refresh the library.',409);
  let result;
  if(entry.kind==='library')result=await library.binarySnapshot({id:entry.raw.id,rootHash:entry.raw.rootHash,...(entry.item.sourceHash?{expectedHash:entry.item.sourceHash}:{})});
  else if(entry.kind==='originals')result=await originals.open({id:entry.raw.id,expectedRevision:entry.raw.revision,...(entry.item.sourceHash?{expectedHash:entry.item.sourceHash}:{})});
  else result=await publication.preview({rootId:entry.item.rootId,sourceId:entry.item.sourceId,revision:entry.item.revision,...(entry.item.sourceHash?{sourceHash:entry.item.sourceHash}:{})});
  const format=magazinePhotoFormat(result.body),digest=hash(result.body),metadata=result.metadataRevision??(entry.kind==='originals'?result.revision:entry.metadataRevision);
  if(entry.item.sourceHash?(digest!==entry.item.sourceHash||format.contentType!==entry.item.contentType||entry.kind==='library'&&result.revision!==entry.item.revision):metadata!==entry.metadataRevision)fail('Photo bytes changed; reopen the photo library.',409);
  const item={...entry.item,revision:result.revision||entry.item.revision,sourceHash:digest,contentType:format.contentType,selectable:true,available:true,byteVerification:'verified'};
  if(!entry.item.sourceHash){const cacheKey=metadataKey(item,entry.metadataRevision),prior=verified.get(cacheKey);verified.set(cacheKey,{item,selectionVerified:prior?.selectionVerified===true});if(verified.size>MAX_ITEMS)verified.delete(verified.keys().next().value);entries.set(key(item),{...entry,item});}
  return {body:result.body,hash:digest,contentType:format.contentType,contentLength:result.body.length,name:item.name,description:item.description,sourceId:item.sourceId,rootId:item.rootId,revision:item.revision,file:token(digest,format)};
 }
 async function catalog(){
  const next=new Map(),items=[],coverage={complete:true,truncated:false,skipped:0,issues:[],limits:{maxItems:MAX_ITEMS,maxPhotoBytes:MAX_BYTES,discovery:'metadata-first'}};let retentionRows=[];
  const issue=(source,reason)=>{coverage.complete=false;coverage.skipped++;if(coverage.issues.length<50)coverage.issues.push({source,reason});};
  const mime=name=>({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',avif:'image/avif'}[String(name).split('.').at(-1).toLowerCase()]);
  function add(kind,raw,item,proof){
   if(items.length>=MAX_ITEMS){coverage.truncated=true;issue(kind,'catalog-item-limit');return;}
   try{
    let unavailable=proof.state==='unavailable'||!Number.isSafeInteger(proof.bytes)||proof.bytes<1||proof.bytes>MAX_BYTES;
    let contentType=proof.contentType||mime(item.name);if(proof.prefix)try{contentType=magazinePhotoFormat(Buffer.from(proof.prefix,'base64')).contentType;}catch{unavailable=true;}
    if(!contentType)fail('Unsupported photograph format.',415);
    const sourceHash=!unavailable&&SHA.test(proof.hash||'')?proof.hash:null,metadataRevision=proof.metadataRevision||proof.revision;
    let final={rootId:item.rootId,sourceId:item.sourceId,revision:proof.revision,metadataRevision,sourceHash,contentType,bytes:proof.bytes??0,name:text(item.name,240),description:description(item.description),storyLabel:text(item.storyLabel,240),sourceLabel:text(item.sourceLabel,240),relativePath:text(item.relativePath,1024),selectable:!!sourceHash&&!unavailable,available:!unavailable,byteVerification:unavailable?'unavailable':sourceHash?proof.state==='retained-origin-current-stat'?'retained-origin-current-stat':'indexed-current-stat':'pending',...(unavailable?{verificationReason:proof.reason||'The photograph is unavailable or outside its supported byte limit.'}:{})};
    if(!SHA.test(final.rootId)||!SHA.test(final.revision||'')||!SHA.test(metadataRevision||'')||!final.sourceId)fail('Photo provider returned an invalid identity.',409);
    final.originRef=kind==='publication'?{kind,rootId:final.rootId,relativePath:final.relativePath}:{kind,rootId:final.rootId,sourceId:final.sourceId};
    const cachedRecord=verified.get(metadataKey(final,metadataRevision)),cached=cachedRecord?.item;if(!sourceHash&&!unavailable&&cachedRecord?.selectionVerified)final={...final,revision:cached.revision,sourceHash:cached.sourceHash,contentType:cached.contentType,selectable:true,byteVerification:'verified'};
    const entry={kind,raw,item:final,metadataRevision};if(next.has(key(final)))fail('Photo provider returned an ambiguous identity.',409);next.set(key(final),entry);if(cached)next.set(key(cached),{...entry,item:cached});items.push(final);
    if(unavailable)issue(kind,proof.bytes>MAX_BYTES?'photo-size-limit':'photo-unavailable-or-changed');
   }catch(error){issue(kind,error.status===415?'unsupported-photo':'photo-unavailable-or-changed');}
  }
  try{
   const saved=await library.photosSnapshot({byteMetadata:true});retentionRows=saved.items.filter(row=>row.retainedPhoto);if(!saved.coverage.complete)for(const item of saved.coverage.issues)issue('library',item.reason);
   for(const row of saved.items){const proof=row.byteMetadata;if(!proof){issue('library','photo-metadata-proof-unavailable');continue;}
    add('library',row,{rootId:hash('library\0'+row.rootId+'\0'+row.rootHash),sourceId:row.id,name:row.name,description:row.description,storyLabel:'',sourceLabel:row.rootName,relativePath:row.relativePath},proof);
   }
  }catch{issue('library','catalog-unavailable');}
  const retainedByIdentity=new Map();for(const saved of retentionRows){const origin=saved.retainedOrigin;if(!origin||saved.originalHash!==origin.sourceHash||!SHA.test(saved.originalHash||''))continue;const key=plain([origin.rootId,origin.sourceId]),rows=retainedByIdentity.get(key)||[];rows.push(origin);retainedByIdentity.set(key,rows);}
  if(originals)try{
   const listed=await originals.list();if(listed.coverage?.truncated){coverage.truncated=true;issue('originals','scan-limit');}
   for(const problem of listed.coverage?.issues||[])if(!['unsupported','excluded','not-story-folder'].includes(problem.reason))issue('originals',problem.reason);
   for(const row of listed.items.filter(row=>row.kind==='photo')){const rootId=hash('original-photos'),proofs=[...new Set((retainedByIdentity.get(plain([rootId,row.id]))||[]).filter(origin=>origin.revision===row.revision).map(origin=>origin.sourceHash))],known=row.hash||(proofs.length===1?proofs[0]:null);add('originals',row,{rootId,sourceId:row.id,name:row.fileName,description:'',storyLabel:row.storyFolder,sourceLabel:'Original photos',relativePath:row.relativePath},{state:known?'retained-origin-current-stat':'pending',hash:known,revision:row.revision,metadataRevision:row.revision,bytes:row.bytes,contentType:row.contentType});}
  }catch{issue('originals','catalog-unavailable');}
  if(publication)try{
   const retainedOrigins=retentionRows.filter(row=>row.retainedOrigin&&row.originalHash===row.retainedOrigin.sourceHash&&SHA.test(row.originalHash||'')).map(row=>Object.fromEntries(['rootId','sourceId','revision','sourceHash'].map(key=>[key,row.retainedOrigin[key]]))),published=await publication.catalog({retainedOrigins});if(published.coverage?.complete===false||published.coverage?.truncated)issue('publication','catalog-incomplete');
   for(const row of published.items)add('publication',row,{...row,sourceLabel:'Publication photos'},{state:row.available===false?'unavailable':row.byteVerification==='retained-origin-current-stat'?'retained-origin-current-stat':'pending',hash:row.sourceHash,revision:row.revision,metadataRevision:row.metadataRevision||row.revision,bytes:row.bytes,contentType:row.contentType});
  }catch{issue('publication','catalog-unavailable');}
  // Immutable internal retention is a derivative, not another imported choice.
  // Preserve any derivative that itself became a selected parent identity: its
  // canonical placements still point to that UUID, even after the child is unused
  // or its mutable copy disappears. No byte-only identity joins or usage store.
  const identity=value=>plain([value.rootId,value.sourceId]),available=new Map(items.map(item=>[identity(item),item])),relations=[];
  for(const row of retentionRows){
   const origin=row.retainedOrigin,rootId=hash('library\0'+row.rootId+'\0'+row.rootHash),self=identity({rootId,sourceId:row.id});
   if(!origin||!SHA.test(row.originalHash||'')||origin.sourceHash!==row.originalHash||identity(origin)===self||row.retainedOriginRef&&(row.retainedOriginRef.rootId!==origin.rootId||row.retainedOriginRef.sourceId!==origin.sourceId))continue;
   const match=new RegExp('^'+row.originalHash+'(?:-('+insertionIdentity(origin)+'))?\\.(jpg|png|webp|gif|avif)$').exec(row.name);
   if(!match)continue;
   relations.push({row,origin,self,extension:match[2]});
  }
  const parentIdentities=new Set(relations.filter(({row,origin})=>available.get(identity(origin))?.sourceHash===row.originalHash).map(({origin})=>identity(origin))),hidden=new Set();
  // Browsing hides a proven indexed/stat-current mutable duplicate. This is
  // deliberately not certification of its immutable bytes: every actual use
  // still opens and hashes the selected original through the maintained owner.
  for(const {row,origin,self}of relations){
   const own=available.get(self),parent=available.get(identity(origin));
   if(!own||parentIdentities.has(self)||!parent||own.sourceHash!==row.originalHash||parent.sourceHash!==row.originalHash||parent.revision!==origin.revision||row.byteMetadata?.state!=='indexed-current-stat'||!row.originalMetadata?.available||row.originalMetadata.bytes!==own.bytes)continue;
   hidden.add(self);
  }
  const visible=items.filter(item=>!hidden.has(identity(item)));
  visible.sort((a,b)=>a.sourceLabel.localeCompare(b.sourceLabel)||a.relativePath.localeCompare(b.relativePath));entries=next;
  return {schema:'ar-create.magazine-library-photos.v1',revision:hash(plain(visible)),items:visible,coverage};
 }
 async function preview(input,{selection=false}={}){
  selector(input,{read:true});let entry=entries.get(key({...input,sourceHash:input.sourceHash??null}));
  // Old exact-SHA selectors remain usable after metadata-only discovery. The
  // selected read must prove both their actual hash and owner revision again.
  if(!entry&&SHA.test(input.sourceHash||''))entry=[...entries.values()].find(e=>e.item.rootId===input.rootId&&e.item.sourceId===input.sourceId);
  if(!entry)fail('Photo selection is stale or unavailable; reopen the photo library.',409);
  const result=await read(entry);if(input.sourceHash&&(result.hash!==input.sourceHash||result.revision!==input.revision))fail('The exact selected photo is stale or changed. Refresh the library.',409);const cache=verified.get(metadataKey(entry.item,entry.metadataRevision));if(cache&&(selection||SHA.test(input.sourceHash||'')))cache.selectionVerified=true;return result;
 }
 async function retainedSources(){const saved=await library.photosSnapshot();return saved.items.filter(row=>row.retainedPhoto&&SHA.test(row.originalHash||''));}
 async function retain(input){return serialize(async()=>{
  selector(input);const opened=await preview(input),format=magazinePhotoFormat(opened.body);
  // Replays reuse Library's original immutable copy; a changed mutable Library
  // file cannot silently become the saved placement's byte authority.
  for(const source of await retainedSources())if(source.originalHash===opened.hash&&!identityName.test(source.name)){const prior=await library.binarySnapshot({id:source.id,expectedHash:opened.hash,original:true});if(magazinePhotoFormat(prior.body).extension!==format.extension)fail('Retained photo format changed.',409);return {file:token(opened.hash,format),sourceId:source.id,rootId:opened.rootId,hash:opened.hash,contentType:format.contentType,contentLength:opened.contentLength,name:opened.name,description:opened.description};}
  const saved=await library.retainAlbumPhoto({folder:'Magazine photos',name:opened.hash+'.'+format.extension,bytes:opened.body,provenance:{kind:'magazine-library-photo',originalHash:opened.hash,description:opened.description,origin:{...input}}});
  const proof=await library.binarySnapshot({id:saved.id,expectedHash:opened.hash,original:true});magazinePhotoFormat(proof.body);
  return {file:token(opened.hash,format),sourceId:saved.id,rootId:opened.rootId,hash:opened.hash,contentType:format.contentType,contentLength:opened.contentLength,name:opened.name,description:opened.description};
 });}
 async function insertionTarget(input){
  selector(input);const entry=entries.get(key(input));if(!entry)fail('Photo selection is stale or unavailable.',409);
  const format=({'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/avif':'avif'}[entry.item.contentType]);
  // An existing legacy token keeps its original origin. Reuse only an exact
  // prior owner-recorded origin, never an arbitrary equal-byte photograph.
  const snapshot=await library.photosSnapshot(),saved=snapshot.items;
  const legacy=saved.filter(source=>source.retainedPhoto&&source.originalHash===input.sourceHash&&source.retainedOrigin?.rootId===input.rootId&&source.retainedOrigin?.sourceId===input.sourceId&&!identityName.test(source.name));
  if(legacy.length>1)fail('The retained photo origin is ambiguous.',409);
  const name=input.sourceHash+'-'+insertionIdentity(input)+'.'+format;
  if(!legacy.length&&saved.some(source=>source.relativePath==='Magazine photos/'+name&&(!source.retainedPhoto||source.originalHash!==input.sourceHash)))fail('The exact retained photo filename is already occupied; no file was overwritten.',409);
  return {name,file:legacy.length?token(input.sourceHash,{extension:format}):'library-photo-'+name,legacy:legacy[0]};
 }
 async function retainInsertion(input){return serialize(async()=>{
  const opened=await preview(input),format=magazinePhotoFormat(opened.body),target=await insertionTarget(input);
  const prior=target.legacy?[target.legacy]:(await retainedSources()).filter(source=>source.originalHash===opened.hash&&source.name===target.name);
  if(prior.length>1)fail('The retained photo identity is ambiguous.',409);
  if(prior[0]&&!target.legacy&&(prior[0].retainedOrigin?.rootId!==input.rootId||prior[0].retainedOrigin?.sourceId!==input.sourceId||prior[0].retainedOrigin?.sourceHash!==input.sourceHash))fail('The retained photograph origin changed.',409);
  let source=prior[0];if(!source)source=await library.retainAlbumPhoto({folder:'Magazine photos',name:target.name,bytes:opened.body,provenance:{kind:'magazine-library-photo',originalHash:opened.hash,description:opened.description,origin:{...input},originRef:entries.get(key(input)).item.originRef}});
  const proof=await library.binarySnapshot({id:source.id,expectedHash:opened.hash,original:true});if(magazinePhotoFormat(proof.body).extension!==format.extension)fail('Retained photo format changed.',409);
  await preview(input);const {body,...metadata}=opened;return {...metadata,file:target.file,sourceId:source.id};
 });}
 async function resolve(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||typeof input.file!=='string')fail('Use a retained photo token.');
  const match=/^library-photo-([a-f0-9]{64})(?:-([a-f0-9]{64}))?\.(jpg|png|gif|webp|avif)$/.exec(input.file);if(!match)fail('Use a retained photo token.');
  for(const source of await retainedSources())if(source.originalHash===match[1]&&(match[2]?source.name===match[1]+'-'+match[2]+'.'+match[3]:!identityName.test(source.name))){
   if(match[2]&&(!source.retainedOrigin||source.retainedOrigin.sourceHash!==match[1]||insertionIdentity(source.retainedOrigin)!==match[2]))fail('The retained photograph origin changed.',409);
   const result=await library.binarySnapshot({id:source.id,expectedHash:match[1],original:true}),format=magazinePhotoFormat(result.body);if(format.extension!==match[3])fail('Retained photo format does not match its token.',409);
   const recordedRef=source.retainedOriginRef&&source.retainedOriginRef.rootId===source.retainedOrigin?.rootId&&source.retainedOriginRef.sourceId===source.retainedOrigin?.sourceId?source.retainedOriginRef:null;
   const originRef=recordedRef||[...entries.values()].find(entry=>entry.item.rootId===source.retainedOrigin?.rootId&&entry.item.sourceId===source.retainedOrigin?.sourceId)?.item.originRef;
   return {body:result.body,hash:result.hash,contentType:format.contentType,contentLength:result.body.length,name:source.name,description:description(source.description),...(originRef?{originRef}:{}),...(source.retainedOrigin?{retainedOrigin:source.retainedOrigin}:{}),sourceId:source.id,rootId:hash('library\0'+source.rootId+'\0'+source.rootHash),file:input.file};
  }
  fail('Retained photo is unavailable in the existing Library.',404);
 }
 return {catalog,preview,retain,retainInsertion,insertionFile:async input=>(await insertionTarget(input)).file,resolve};
}
