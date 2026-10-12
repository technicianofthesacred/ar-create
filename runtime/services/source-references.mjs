// Conservative, complete inventory of the owned app's registered JSON and readable records.
// A matching ID is a collision even inside historical/escaped text. An incomplete
// or changing inventory cannot establish that a scanner-created ID is unused.
import fs from 'node:fs';import path from 'node:path';import {StateError} from '../store.mjs';
import {regular} from './files.mjs';
const referenceExtensions=new Set(['.json','.md','.markdown','.txt','.html','.log','.csv','.vtt','.srt']);
const stamp=stat=>[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');
export function assertUnusedSourceId({dataDir,index,sourceId,maxFiles=4096,maxBytes=128*1024*1024}){
 const needle=Buffer.from(sourceId),indexReferences={...index,sources:index.sources.filter(source=>source.id!==sourceId)};
 function ownedPath(rel){if(path.isAbsolute(rel)||rel.split(path.sep).some(part=>part==='..'||part==='.')||rel.includes('\0'))throw new StateError('Invalid owned reference path.',409);let current=dataDir;const parts=rel?rel.split(path.sep):[];const root=fs.lstatSync(current);if(!root.isDirectory()||root.isSymbolicLink())throw new StateError('The owned reference root is unsafe.',409);for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);const stat=fs.lstatSync(current);if(stat.isSymbolicLink()||(i<parts.length-1&&!stat.isDirectory()))throw new StateError('The owned reference inventory contains an unsafe link.',409);}return current;}
 if(Buffer.from(JSON.stringify(indexReferences)).includes(needle))throw new StateError('The selected file already has retained Library references. Its separate identity was preserved.',409);
 function inventory(){const files=[],signature=[],stack=[{rel:'',depth:0}];let visited=0;
  while(stack.length){const {rel,depth}=stack.pop();if(depth>40||++visited>20000)throw new StateError('The owned reference inventory is incomplete. No source identities were changed.',409);const folder=ownedPath(rel);if(!fs.lstatSync(folder).isDirectory())throw new StateError('The owned reference folder changed.',409);
   for(const name of fs.readdirSync(folder)){const child=path.join(rel,name),full=path.join(dataDir,child),stat=fs.lstatSync(full);if(stat.isSymbolicLink())throw new StateError('The owned reference inventory contains an unsafe link. No source identities were changed.',409);if(stat.isDirectory())stack.push({rel:child,depth:depth+1});else if(referenceExtensions.has(path.extname(name).toLowerCase())&&child!=='library-index.json'){regular(full);if(files.length>=maxFiles)throw new StateError('Too many owned records to prove this file has no references. No source identities were changed.',409);files.push({rel:child,stamp:stamp(stat),size:stat.size});}else if(name.endsWith('.tmp'))throw new StateError('An owned record is being written. Finish saving before reconnecting this file.',409);}
  }
  files.sort((a,b)=>a.rel.localeCompare(b.rel));for(const file of files)signature.push([file.rel,file.stamp]);return {files,signature:JSON.stringify(signature)};
 }
 const captured=inventory();let bytes=0;
 for(const file of captured.files){bytes+=file.size;if(bytes>maxBytes)throw new StateError('The owned reference inventory exceeds its verification bound. No source identities were changed.',409);const full=ownedPath(file.rel),descriptor=fs.openSync(full,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let contents;
  try{const stat=fs.fstatSync(descriptor);if(!stat.isFile()||stat.nlink!==1||stamp(stat)!==file.stamp)throw new StateError('An owned reference record changed. Save and preview again.',409);contents=fs.readFileSync(descriptor);if(stamp(fs.fstatSync(descriptor))!==file.stamp)throw new StateError('An owned reference record changed. Save and preview again.',409);}finally{fs.closeSync(descriptor);}
  // Corrupted/unregistered JSON might conceal references; never infer absence.
  let parsed;if(file.rel.endsWith('.json')){try{parsed=JSON.parse(contents.toString('utf8'));}catch{throw new StateError('An owned reference record is unreadable. No source identities were changed.',409);}}
  if(contents.includes(needle)||(parsed!==undefined&&JSON.stringify(parsed).includes(sourceId)))throw new StateError('The selected file already has retained workspace or request references. Its separate identity was preserved.',409);
 }
 if(inventory().signature!==captured.signature)throw new StateError('The owned reference inventory changed. Save and preview again.',409);
 return {files:captured.files.length,bytes};
}
