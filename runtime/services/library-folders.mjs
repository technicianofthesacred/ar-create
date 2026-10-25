import {randomUUID} from 'node:crypto';
import {StateError} from '../store.mjs';
import {digest} from './files.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const domains=['library','media'],actions=['create','rename','reparent','link','move','unlink','remove','undo'];
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const fail=(message,status=409)=>{throw new StateError(message,status);};
const fields=(input,allowed)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))fail('Unsupported folder fields; use explicit filing identities.',400);};
function name(value){if(typeof value!=='string'||!value.trim()||value.length>200||/[\\/\u0000-\u001f\u007f]/.test(value)||['.','..'].includes(value.trim()))fail('Use a short folder name without paths or control characters.',400);return value.trim();}
const mediaKind=source=>['image','video'].includes(source.kind)?source.kind:/^video\//i.test(source.mimeType||source.mime||'')||/\.(mp4|mov|webm|m4v|mkv)$/i.test(source.rel_path||'')?'video':/^image\//i.test(source.mimeType||source.mime||'')?'image':null;
const media=source=>mediaKind(source)!==null;
function validateRows(rows){
 if(!Array.isArray(rows)||rows.length>5000||new Set(rows.map(r=>r?.id)).size!==rows.length)fail('Invalid or full folder registry; existing bytes preserved.');
 const byId=new Map(rows.map(r=>[r?.id,r]));
 for(const row of rows){
  if(!row||!UUID.test(row.id||'')||!domains.includes(row.domain)||row.name!==name(row.name)||row.parentId!==null&&!UUID.test(row.parentId||'')||!Array.isArray(row.sourceIds)||row.sourceIds.length>20000||row.sourceIds.some(id=>!UUID.test(id||''))||new Set(row.sourceIds).size!==row.sourceIds.length)fail('Invalid folder record; existing bytes preserved.');
  const seen=new Set([row.id]);let parent=row.parentId;
  while(parent!==null){const ancestor=byId.get(parent);if(!ancestor||ancestor.domain!==row.domain)fail('Folder parent is unavailable or belongs to another domain.');if(seen.has(parent))fail('Folder cycle is not allowed.');seen.add(parent);parent=ancestor.parentId;}
 }
}
export function validateLibraryFolders(value){
 validateRows(value.folders??[]);
 const ops=value.folderOperations??[];
 if(!Array.isArray(ops)||ops.length>10000||new Set(ops.map(o=>o?.operationId)).size!==ops.length)fail('Invalid or full folder operation history; existing bytes preserved.');
 for(const op of ops){if(!UUID.test(op?.operationId||'')||!HASH.test(op.fingerprint||'')||!domains.includes(op.domain)||!actions.includes(op.action)||!Number.isSafeInteger(op.resultRevision)||op.resultRevision<1)fail('Invalid folder operation receipt; existing bytes preserved.');validateRows(op.before);validateRows(op.after);if([...op.before,...op.after].some(r=>r.domain!==op.domain))fail('Invalid folder Undo domain.');}
 return value;
}
/** Uses Library's existing queue and exact-byte publication. Never owns source files. */
export function createLibraryFolders({serial,load,publish,publicSource}){
 function view(loaded,domain){
  const value=loaded.value,rows=(value.folders??[]).filter(row=>row.domain===domain),ops=(value.folderOperations??[]).filter(op=>op.domain===domain),last=ops.at(-1);
  const sourceMap=new Map(value.sources.filter(s=>!s.managedTerminalSnapshot&&(domain==='library'||media(s))).map(s=>[s.id,{...publicSource(s),...(mediaKind(s)?{mediaKind:mediaKind(s)}:{})}]));
  for(const row of rows)for(const id of row.sourceIds)if(!sourceMap.has(id))sourceMap.set(id,{id,title:'Unavailable source',name:'Unavailable source',sourceUnavailable:true,missing:true,blobUrl:`/api/sources/blob?id=${encodeURIComponent(id)}`});
  return {schema:'ar-create.library-folders.v1',domain,revision:value.revision,indexHash:loaded.hash,folders:structuredClone(rows.map(({domain:_,...row})=>row)),sources:[...sourceMap.values()],undoOperationId:last&&last.action!=='undo'&&stable(last.after)===stable(rows)?last.operationId:null};
 }
 function read(input={}){fields(input,['domain']);if(!domains.includes(input.domain))fail('Choose library or media folders.',400);return serial(()=>{const loaded=load();validateLibraryFolders(loaded.value);return view(loaded,input.domain);});}
 function change(input){
  input=structuredClone(input);
  return serial(()=>{
   fields(input,['domain','action','operationId','expectedRevision','expectedHash','folderId','parentId','name','sourceIds','undoOperationId']);
   const {domain,action}=input;
   if(!domains.includes(domain)||!actions.includes(action)||!UUID.test(input.operationId||'')||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!HASH.test(input.expectedHash||''))fail('Choose a domain/action, operation UUID and exact Library revision/hash.',400);
   const required={create:['name'],rename:['folderId','name'],reparent:['folderId','parentId'],link:['folderId','sourceIds'],move:['folderId','sourceIds'],unlink:['folderId','sourceIds'],remove:['folderId'],undo:['undoOperationId']}[action],optional=action==='create'?['parentId']:[];
   if(required.some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>!['domain','action','operationId','expectedRevision','expectedHash',...required,...optional].includes(k)))fail('Use the exact fields required for this folder action.',400);
   const loaded=load(),value=validateLibraryFolders(loaded.value),fingerprint=digest(stable(input)),prior=(value.folderOperations??[]).find(op=>op.operationId===input.operationId);
   if(prior){if(prior.fingerprint!==fingerprint)fail('Operation UUID already owns a different exact folder request.');return {...view(loaded,domain),receipt:receipt(prior),...(prior.selectedFolderId?{selectedFolderId:prior.selectedFolderId}:{}),replayed:true};}
   if(input.expectedRevision!==value.revision||input.expectedHash!==loaded.hash)fail('Library changed; refresh its exact revision and hash before filing.');
   if((value.folderOperations??[]).length>=10000)fail('Folder operation history is full; existing bytes preserved.');
   const next=structuredClone(value);next.folders??=[];next.folderOperations??=[];
   const before=structuredClone(next.folders.filter(r=>r.domain===domain));
   const folder=id=>{if(!UUID.test(id||''))fail('Use an existing folder UUID.',400);const row=next.folders.find(r=>r.id===id&&r.domain===domain);if(!row)fail('Folder was not found in this domain.',404);return row;};
   const parent=id=>{if(id!==null)folder(id);return id;};
   let selectedFolderId=input.folderId;
   if(action==='create'){selectedFolderId=randomUUID();next.folders.push({id:selectedFolderId,domain,name:name(input.name),parentId:parent(input.parentId??null),sourceIds:[]});}
   else if(action==='undo'){
    const last=next.folderOperations.filter(op=>op.domain===domain).at(-1);
    if(!last||last.action==='undo'||last.operationId!==input.undoOperationId||stable(last.after)!==stable(before))fail('Undo requires the exact last filing operation in this domain.');
    next.folders=[...next.folders.filter(r=>r.domain!==domain),...structuredClone(last.before)];selectedFolderId=undefined;
   }else{
    const row=folder(input.folderId);
    if(action==='rename')row.name=name(input.name);
    else if(action==='reparent')row.parentId=parent(input.parentId);
    else if(action==='remove'){if(row.sourceIds.length||next.folders.some(r=>r.parentId===row.id))fail('Remove only an empty folder without child folders.');next.folders=next.folders.filter(r=>r.id!==row.id);selectedFolderId=row.parentId;}
    else{
     if(!Array.isArray(input.sourceIds)||!input.sourceIds.length||input.sourceIds.length>20000||new Set(input.sourceIds).size!==input.sourceIds.length||input.sourceIds.some(id=>!UUID.test(id||'')))fail('Select unique existing source UUIDs.',400);
     for(const id of input.sourceIds){const matches=value.sources.filter(s=>s.id===id&&!s.managedTerminalSnapshot);if(action==='unlink'){if(!row.sourceIds.includes(id))fail('Source membership was not found.',404);}else if(matches.length!==1||domain==='media'&&!media(matches[0]))fail('Source was not found or is unsupported in this domain.',404);}
     const ids=new Set(input.sourceIds);
     if(action==='move')for(const other of next.folders)if(other.domain===domain)other.sourceIds=other.sourceIds.filter(id=>!ids.has(id));
     if(action==='unlink')row.sourceIds=row.sourceIds.filter(id=>!ids.has(id));else row.sourceIds=[...new Set([...row.sourceIds,...input.sourceIds])];
    }
   }
   const after=structuredClone(next.folders.filter(r=>r.domain===domain));
   next.revision=value.revision+1;
   const op={operationId:input.operationId,domain,action,fingerprint,resultRevision:next.revision,before,after,...selectedFolderId?{selectedFolderId}:{}};next.folderOperations.push(op);validateLibraryFolders(next);
   const saved=publish(loaded,next);return {...view(saved,domain),receipt:receipt(op),...selectedFolderId?{selectedFolderId}:{}};
  });
 }
 const receipt=({before,after,...op})=>structuredClone(op);
 return {read,change};
}
