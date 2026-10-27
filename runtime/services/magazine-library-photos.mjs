// Photo selection projects existing owners. Only retain() writes, through Library.
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const SHA=/^[a-f0-9]{64}$/;
const MAX_BYTES=20*1024*1024,MAX_ITEMS=20000,MAX_CATALOG_BYTES=1024*1024*1024;
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
function selector(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4||Object.keys(value).some(key=>!['rootId','sourceId','revision','sourceHash'].includes(key))||!SHA.test(value.rootId||'')||typeof value.sourceId!=='string'||value.sourceId.length>128||!SHA.test(value.revision||'')||!SHA.test(value.sourceHash||''))fail('Select an exact current photo identity, revision and hash.');
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
 let entries=new Map(),pending=Promise.resolve();
 const key=item=>plain([item.rootId,item.sourceId,item.revision,item.sourceHash]);
 const serialize=fn=>{const result=pending.then(fn);pending=result.catch(()=>{});return result;};
 async function read(entry){
  let result;
  if(entry.kind==='library')result=await library.binarySnapshot({id:entry.raw.id,rootHash:entry.raw.rootHash,expectedHash:entry.item.sourceHash});
  else if(entry.kind==='originals')result=await originals.open({id:entry.raw.id,expectedRevision:entry.raw.revision,expectedHash:entry.item.sourceHash});
  else result=await publication.preview({rootId:entry.item.rootId,sourceId:entry.item.sourceId,revision:entry.item.revision,sourceHash:entry.item.sourceHash});
  const format=magazinePhotoFormat(result.body),digest=hash(result.body);
  if(digest!==entry.item.sourceHash||format.contentType!==entry.item.contentType||entry.kind==='library'&&result.revision!==entry.item.revision)fail('Photo bytes changed; reopen the photo library.',409);
  return {body:result.body,hash:digest,contentType:format.contentType,contentLength:result.body.length,name:entry.item.name,description:entry.item.description,sourceId:entry.item.sourceId,rootId:entry.item.rootId,file:token(digest,format)};
 }
 async function catalog(){
  const next=new Map(),items=[],coverage={complete:true,truncated:false,skipped:0,issues:[],limits:{maxItems:MAX_ITEMS,maxPhotoBytes:MAX_BYTES,maxCatalogBytes:MAX_CATALOG_BYTES}};let total=0;
  const issue=(source,reason)=>{coverage.complete=false;coverage.skipped++;if(coverage.issues.length<50)coverage.issues.push({source,reason});};
  async function add(kind,raw,item,open){
   if(items.length>=MAX_ITEMS||total>=MAX_CATALOG_BYTES){coverage.truncated=true;issue(kind,'catalog-limit');return;}
   if(Number(raw.bytes)>MAX_BYTES){issue(kind,'photo-size-limit');return;}
   try{
    const result=await open(),format=magazinePhotoFormat(result.body),sourceHash=hash(result.body);total+=result.body.length;
    const final={rootId:item.rootId,sourceId:item.sourceId,revision:kind==='library'?result.revision:item.revision,sourceHash,contentType:format.contentType,bytes:result.body.length,name:text(item.name,240),description:description(item.description),storyLabel:text(item.storyLabel,240),sourceLabel:text(item.sourceLabel,240),relativePath:text(item.relativePath,1024),selectable:true};
    if(!SHA.test(final.rootId)||!SHA.test(final.revision)||!final.sourceId)fail('Photo provider returned an invalid identity.',409);
    // Recorded backing identity supports current-draft usage joins; equal bytes
    // from unrelated origins never establish a publication or Library relation.
    final.originRef=kind==='publication'?{kind,rootId:final.rootId,relativePath:final.relativePath}:{kind,rootId:final.rootId,sourceId:final.sourceId};
    const entry={kind,raw,item:final};if(next.has(key(final)))fail('Photo provider returned an ambiguous identity.',409);next.set(key(final),entry);items.push(final);
   }catch(error){issue(kind,error.status===415?'unsupported-photo':error.status===413?'photo-size-limit':'photo-unavailable-or-changed');}
  }
  try{
   const saved=await library.photosSnapshot();if(!saved.coverage.complete)for(const item of saved.coverage.issues)issue('library',item.reason);
   for(const row of saved.items){if(row.missing){issue('library','current-photo-missing');continue;}
    await add('library',row,{rootId:hash('library\0'+row.rootId+'\0'+row.rootHash),sourceId:row.id,revision:hash('library\0'+saved.indexHash+'\0'+row.rootHash+'\0'+row.id),name:row.name,description:row.description,storyLabel:'',sourceLabel:row.rootName,relativePath:row.relativePath},()=>library.binarySnapshot({id:row.id,rootHash:row.rootHash}));
   }
  }catch(error){issue('library','catalog-unavailable');}
  if(originals)try{
   const listed=await originals.list();if(listed.coverage?.truncated){coverage.truncated=true;issue('originals','scan-limit');}
   // Unsupported video/hidden entries do not imply unavailable eligible photos.
   for(const problem of listed.coverage?.issues||[])if(!['unsupported','excluded','not-story-folder'].includes(problem.reason))issue('originals',problem.reason);
   for(const row of listed.items.filter(row=>row.kind==='photo'))await add('originals',row,{rootId:hash('original-photos'),sourceId:row.id,revision:row.revision,name:row.fileName,description:'',storyLabel:row.storyFolder,sourceLabel:'Original photos',relativePath:row.relativePath},()=>originals.open({id:row.id,expectedRevision:row.revision}));
  }catch(error){issue('originals','catalog-unavailable');}
  if(publication)try{
   const published=await publication.catalog();if(published.coverage?.complete===false||published.coverage?.truncated)issue('publication','catalog-incomplete');
   for(const row of published.items)await add('publication',row,{...row,sourceLabel:'Publication photos'},()=>publication.preview({rootId:row.rootId,sourceId:row.sourceId,revision:row.revision,sourceHash:row.sourceHash}));
  }catch(error){issue('publication','catalog-unavailable');}
  items.sort((a,b)=>a.sourceLabel.localeCompare(b.sourceLabel)||a.relativePath.localeCompare(b.relativePath));entries=next;
  return {schema:'ar-create.magazine-library-photos.v1',revision:hash(plain(items)),items,coverage};
 }
 async function preview(input){selector(input);const entry=entries.get(key(input));if(!entry)fail('Photo selection is stale or unavailable; reopen the photo library.',409);return read(entry);}
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
