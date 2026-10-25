// Read-only projection of original story Photos folders. Catalog identity is a
// review selector, never a Library UUID, placement assertion or saved media copy.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const io=fs.promises;
const TYPES={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.heic':'image/heic','.mp4':'video/mp4','.mov':'video/quicktime','.m4v':'video/x-m4v'};
const DEFAULT_LIMITS={maxDepth:5,maxEntries:5000,maxOpenBytes:256*1024*1024};
const digest=value=>createHash('sha256').update(value).digest('hex');
const error=(message,status=400)=>Object.assign(Error(message),{status});
const proof=st=>digest([st.dev,st.ino,st.size,st.mtimeNs,st.ctimeNs,st.nlink].map(String).join(':'));
const excluded=name=>name.startsWith('.')||['drop','transcription','audio'].includes(name.toLowerCase());
export function createReviewMedia({filesRoot,limits={}}={}){
 if(typeof filesRoot!=='string'||!filesRoot||!limits||typeof limits!=='object'||Array.isArray(limits))throw error('A configured original media root and valid limits are required.');
 for(const key of Object.keys(limits))if(!(key in DEFAULT_LIMITS))throw error('Unknown media read limit.');
 const bounds={...DEFAULT_LIMITS,...limits};
 for(const [key,value] of Object.entries(bounds))if(!Number.isInteger(value)||value<(key==='maxDepth'?0:1)||value>DEFAULT_LIMITS[key])throw error('Media read limits exceed the supported bounds.');
 const configured=path.resolve(filesRoot);let root,rootStat;
 try{rootStat=fs.lstatSync(configured,{bigint:true});if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw Error();root=fs.realpathSync(configured);}catch{throw error('Original media root is unavailable or is a symlink.',403);}
 const rootIdentity=String(rootStat.dev)+':'+String(rootStat.ino);
 async function checkRoot(){try{const st=await io.lstat(configured,{bigint:true});if(st.isSymbolicLink()||!st.isDirectory()||String(st.dev)+':'+String(st.ino)!==rootIdentity||await io.realpath(configured)!==root)throw Error();}catch{throw error('Original media root changed or is unavailable.',409);}}
 async function checked(relative,{directory=false}={}){
  await checkRoot();const parts=relative.split('/');if(parts.some(p=>!p||p==='.'||p==='..'||p.startsWith('.')||p.includes('\\')||p.includes('\0')))throw error('Original media path is unavailable.',403);
  let file=root,st;
  try{for(let i=0;i<parts.length;i++){file=path.join(file,parts[i]);st=await io.lstat(file,{bigint:true});if(st.isSymbolicLink())throw error('Original media symlink is unavailable.',403);if(i<parts.length-1||directory){if(!st.isDirectory())throw error('Original media folder changed.',409);}else if(!st.isFile()||st.nlink!==1n)throw error('Original media must be a regular unlinked file.',403);}
   if(await io.realpath(file)!==path.join(root,...parts))throw error('Original media path changed.',409);
   return {file,stat:st};
  }catch(failure){if(failure.status)throw failure;throw error('Original media is unavailable.',404);}
 }
 let catalog=new Map();
 async function list(){
  await checkRoot();const items=[],next=new Map(),coverage={truncated:false,skipped:0,scanned:0,limits:{...bounds},issues:[]};
  const skip=(relative,reason)=>{coverage.skipped++;if(coverage.issues.length<30)coverage.issues.push({relativePath:relative,reason});};
  async function entries(relative,visitor){
   let dir;
   try{const target=relative?await checked(relative,{directory:true}):{file:root};dir=await io.opendir(target.file);for await(const entry of dir){coverage.scanned++;if(coverage.scanned>bounds.maxEntries){coverage.scanned=bounds.maxEntries;coverage.truncated=true;break;}await visitor(entry);if(coverage.truncated&&coverage.scanned===bounds.maxEntries)break;}}
   catch(failure){skip(relative,failure.status===403?'unsafe-entry':'folder-unavailable');}
  }
  async function photos(relative,storyFolder,depth){
   await entries(relative,async entry=>{
    const rel=relative+'/'+entry.name;if(excluded(entry.name)){skip(rel,'excluded');return;}
    if(entry.isSymbolicLink()){skip(rel,'symlink');return;}
    if(entry.isDirectory()){if(depth>=bounds.maxDepth){coverage.truncated=true;skip(rel,'depth-limit');return;}await photos(rel,storyFolder,depth+1);return;}
    const ext=path.extname(entry.name).toLowerCase(),contentType=TYPES[ext];if(!contentType||!entry.isFile()){skip(rel,'unsupported');return;}
    try{const {stat}=await checked(rel);const bytes=Number(stat.size);if(!Number.isSafeInteger(bytes))throw error('Media size is unsupported.');const id=digest(root+'\0'+rel),revision=proof(stat),row={id,relativePath:rel,storyFolder,fileName:entry.name,kind:contentType.startsWith('image/')?'photo':'video',bytes,mtime:new Date(Number(stat.mtimeMs)).toISOString(),revision,hash:null,hashState:'not-read',openable:bytes<=bounds.maxOpenBytes,contentType,formatValidation:'extension-only'};items.push(row);next.set(id,{relative:rel,revision,metadata:row});}catch{skip(rel,'unavailable-or-unsafe');}
   });
  }
  await entries('',async entry=>{
   if(excluded(entry.name)){skip(entry.name,'excluded');return;}if(!entry.isDirectory()||entry.isSymbolicLink()){skip(entry.name,'not-story-folder');return;}
   // Deliberately inspect only the exact Photos child, never siblings such as
   // source recordings, job metadata, drop folders or arbitrary story files.
   const rel=entry.name+'/Photos';try{await checked(rel,{directory:true});await photos(rel,entry.name,0);}catch(failure){if(failure.status!==404)skip(rel,'photos-unavailable-or-unsafe');}
  });
  await checkRoot();items.sort((a,b)=>a.relativePath.localeCompare(b.relativePath));catalog=next;return {items:items.map(row=>({...row})),coverage};
 }
 async function open(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['id','expectedRevision','expectedHash'].includes(key)))throw error('Use only the media identity, revision and optional hash fields.');
  const {id,expectedRevision,expectedHash}=input;if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)||!catalog.has(id))throw error('Choose an existing media catalog identity.',404);
  if(typeof expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(expectedRevision))throw error('The catalog revision is required.');
  if(expectedHash!==undefined&&(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash)))throw error('The expected media hash is invalid.');
  const entry=catalog.get(id);if(expectedRevision!==entry.revision)throw error('Original media changed; refresh the catalog.',409);
  const {file,stat}=await checked(entry.relative);if(proof(stat)!==expectedRevision)throw error('Original media changed; refresh the catalog.',409);
  if(stat.size>BigInt(bounds.maxOpenBytes))throw error('Original media exceeds the bounded byte read limit.',413);
  let handle;
  try{
   handle=await io.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const before=await handle.stat({bigint:true});if(!before.isFile()||before.nlink!==1n||proof(before)!==expectedRevision)throw error('Original media changed before reading.',409);
   const body=Buffer.alloc(Number(before.size));let offset=0;while(offset<body.length){const read=await handle.read(body,offset,body.length-offset,offset);if(!read.bytesRead)throw error('Original media changed during reading.',409);offset+=read.bytesRead;}
   const after=await handle.stat({bigint:true}),current=await checked(entry.relative);if(proof(after)!==expectedRevision||proof(current.stat)!==expectedRevision)throw error('Original media changed during reading.',409);
   const hash=digest(body);if(expectedHash!==undefined&&expectedHash!==hash)throw error('Original media hash changed.',409);
   return {body,contentType:entry.metadata.contentType,contentLength:body.length,hash,revision:expectedRevision,metadata:{...entry.metadata,hash,hashState:'exact-opened-bytes'}};
  }catch(failure){if(failure.status)throw failure;throw error('Original media is unavailable or changed.',409);}finally{await handle?.close();}
 }
 return {list,open};
}
