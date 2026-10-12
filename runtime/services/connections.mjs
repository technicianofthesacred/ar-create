import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {StateError} from '../store.mjs';
import {atomicWrite,digest,regular,resolveInside} from './files.mjs';

const MAX_CONFIG_BYTES=65536;
const inside=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
function rootRecord(entry){
 if(!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(entry.id)||['library','recordings'].includes(entry.id)||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>128||typeof entry.path!=='string'||!path.isAbsolute(entry.path)||entry.path.length>4096||/[\x00-\x1f\x7f]/.test(entry.path))throw new StateError('Invalid saved folder connection.');
 return {id:entry.id,name:entry.name.trim(),path:path.resolve(entry.path)};
}
function readConfig(file){
 const stat=fs.lstatSync(file,{throwIfNoEntry:false});if(!stat)return {value:null,hash:null};regular(file);if(stat.size>MAX_CONFIG_BYTES)throw new StateError('Saved folder connections exceed the configuration limit.',413);
 const bytes=fs.readFileSync(file);let value;try{value=JSON.parse(bytes);}catch{throw new StateError('Cannot read saved folder connections; existing configuration is preserved.');}return {value,hash:digest(bytes)};
}
// Browser setup selects one explicit subtree. Existing operator configuration
// remains supported; this boundary never discovers folders or grants OS access.
export function validateConnectedFolder(value,{dataDir,roots=[]}={}){
 if(typeof value!=='string'||!path.isAbsolute(value)||value.length>4096||/[\x00-\x1f\x7f]/.test(value)||value.split(path.sep).includes('..'))throw new StateError('Enter an absolute folder path without traversal.');
 const candidate=path.resolve(value),parts=candidate.split(path.sep).filter(Boolean);
 if(parts.some(part=>part.startsWith('.')))throw new StateError('Hidden or credential folders cannot be connected.',403);
 const denied=['/System','/Library','/Applications','/usr','/bin','/sbin','/etc','/private/etc','/proc','/sys','/dev','/opt','/private/var/root','/private/var/db','/private/var/log','/private/var/run'];
 if(candidate===path.parse(candidate).root||candidate===os.homedir()||['/Users','/Volumes','/private','/var','/private/var','/tmp','/private/tmp'].includes(candidate)||denied.some(root=>inside(root,candidate)))throw new StateError('Choose a specific documents folder, not a home, system or temporary root.',403);
 let current=path.parse(candidate).root;
 for(const part of parts){current=path.join(current,part);let stat;try{stat=fs.lstatSync(current);}catch(error){if(['ENOENT','EACCES','EPERM'].includes(error.code))throw new StateError('Folder unavailable. Check its path, mounted drive and existing access, then retry.',503);throw error;}
  // macOS has these fixed system aliases. User-created symlink paths stay blocked.
  if(stat.isSymbolicLink()&&!(['/tmp','/var'].includes(current)&&fs.realpathSync(current)==='/private'+current))throw new StateError('Choose the real folder path; symlink connections are not available.',403);
 }
 resolveInside(candidate,'',{directory:true});const canonical=fs.realpathSync(candidate),owned=fs.realpathSync(dataDir);
 if(denied.some(root=>inside(root,canonical)))throw new StateError('System folders cannot be connected.',403);
 if(inside(owned,canonical)||inside(canonical,owned))throw new StateError('The private workspace and its parent folders cannot be connected.',403);
 if(roots.some(root=>inside(root.path,canonical)||inside(canonical,root.path)))throw new StateError('This folder or an overlapping folder is already connected.',409);
 return canonical;
}

function savedState(value,fallback=[]){
 const entries=value===null?fallback:Array.isArray(value)?value:value.roots;
 if(!Array.isArray(entries)||entries.length>64)throw new StateError('Invalid saved folder connections.');
 const state={version:1,revision:!Array.isArray(value)&&Number.isSafeInteger(value?.revision)&&value.revision>=0?value.revision:0,roots:entries.map(entry=>rootRecord({...entry,name:entry.name||entry.id})),removed:(!Array.isArray(value)&&Array.isArray(value?.removed)?value.removed:[]).map(rootRecord)};
 if(state.removed.length>128||new Set([...state.roots,...state.removed].map(root=>root.id)).size!==state.roots.length+state.removed.length)throw new StateError('Duplicate or excessive saved folder connections.');
 return state;
}
export function createConnections({dataDir,library,connections=[],editable=true,reason='Connections are managed by runtime configuration.'}){
 const file=path.join(dataDir,'connections.json'),initial=editable?readConfig(file):{value:null,hash:null};let expectedFileHash=initial.hash;
 let state=savedState(initial.value,connections);
 let pending=Promise.resolve();const serial=fn=>{const op=pending.then(fn);pending=op.catch(()=>{});return op;};
 function guard(input){if(!editable)throw new StateError(reason,403);if(input?.expectedRevision!==state.revision||readConfig(file).hash!==expectedFileHash)throw new StateError('Folder connections changed. Refresh before trying again.',409);}
 function inventory(catalog){return {revision:state.revision,editable,...(!editable?{reason}:{}),roots:state.roots.map(root=>{const scanned=catalog.roots.find(item=>item.id===root.id);return {...root,writable:false,available:scanned?.available!==false,sourceCount:catalog.sources.filter(source=>source.rootId===root.id).length,...(scanned?.available===false?{problem:scanned.connectionError||'Folder unavailable. Restore it and retry.'}:{})};})};}
 async function commit(next){next.revision=state.revision+1;const bytes=JSON.stringify(next,null,2);if(Buffer.byteLength(bytes)>MAX_CONFIG_BYTES)throw new StateError('Too many saved folder connections.',413);
  const catalog=await library.setConnections(next.roots,()=>{if(readConfig(file).hash!==expectedFileHash)throw new StateError('Folder connections changed. Refresh before trying again.',409);atomicWrite(file,bytes);expectedFileHash=digest(bytes);state=next;});return inventory(catalog);
 }
 return {
  list:()=>serial(async()=>{
   if(editable){const current=readConfig(file);if(current.hash!==expectedFileHash){if(current.value===null)throw new StateError('Saved folder configuration was removed outside the app. Existing connections are preserved.',409);const next=savedState(current.value);next.revision=Math.max(next.revision,state.revision+1);const catalog=await library.setConnections(next.roots,()=>{state=next;expectedFileHash=current.hash;});return inventory(catalog);}}
   return inventory(await library.tree());
  }),
  add:input=>serial(async()=>{guard(input);if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>128||/[\x00-\x1f\x7f]/.test(input.name))throw new StateError('Give the folder a name under 128 characters.');if(state.roots.length>=32)throw new StateError('Connect up to 32 folders.');const canonical=validateConnectedFolder(input.path,{dataDir,roots:state.roots}),previous=state.removed.find(root=>root.path===canonical),root={id:previous?.id||'folder-'+randomUUID(),name:input.name.trim(),path:canonical};return commit({...state,roots:[...state.roots,root],removed:state.removed.filter(item=>item.id!==root.id)});}),
  remove:input=>serial(async()=>{guard(input);const root=state.roots.find(item=>item.id===input.id);if(!root)throw new StateError('Folder connection was not found.',404);if(state.removed.length>=128)throw new StateError('The retained connection identity limit is reached. Existing references are preserved.',409);return commit({...state,roots:state.roots.filter(item=>item.id!==root.id),removed:[...state.removed,root]});}),
 };
}
