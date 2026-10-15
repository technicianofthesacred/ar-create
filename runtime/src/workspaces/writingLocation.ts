// Device-local navigation hints only. The manuscript remains the sole source
// of writing; this record never contains text, sources, titles or editor JSON.
export type WritingView='continuous'|'focus';
export type WritingSelection={from:number;to:number};
export type WritingLocation={activeId?:string;view:WritingView;scrolls:Record<WritingView,number>;selections:Record<string,WritingSelection>};
const STORAGE_KEY='ar-create:writing-locations:v1',MAX_ENTRIES=20,MAX_SELECTIONS=100,MAX_BYTES=100000;
export const writingLocationKey=(projectId:string,documentId:string)=>JSON.stringify([projectId,documentId]);
const safeId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=1024;
const position=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.min(Math.floor(value),10000000):0;
function clean(value:any):WritingLocation{
 const selections:Record<string,WritingSelection>=Object.create(null);
 if(value?.selections&&typeof value.selections==='object')for(const [id,selection] of Object.entries(value.selections).slice(-MAX_SELECTIONS)){
  const saved=selection as any;if(safeId(id)&&typeof saved?.from==='number'&&typeof saved?.to==='number'&&Number.isFinite(saved.from)&&Number.isFinite(saved.to)&&saved.from>=0&&saved.to>=0)selections[id]={from:position(saved.from),to:position(saved.to)};
 }
 return {activeId:safeId(value?.activeId)?value.activeId:undefined,view:value?.view==='focus'?'focus':'continuous',scrolls:{continuous:position(value?.scrolls?.continuous),focus:position(value?.scrolls?.focus)},selections};
}
function storage(){try{return typeof window!=='undefined'?window.localStorage:undefined;}catch{return undefined;}}
function readEntries():Array<WritingLocation&{key:string;updatedAt:number}>{
 try{const raw=storage()?.getItem(STORAGE_KEY);if(!raw||raw.length>MAX_BYTES)return [];const value=JSON.parse(raw);if(value?.version!==1||!Array.isArray(value.entries))return [];
  return value.entries.filter((entry:any)=>safeId(entry?.key)).map((entry:any)=>({...clean(entry),key:entry.key,updatedAt:typeof entry.updatedAt==='number'&&Number.isFinite(entry.updatedAt)?entry.updatedAt:0})).slice(-MAX_ENTRIES);
 }catch{return [];}
}
export function readWritingLocation(projectId:string,documentId:string,paragraphIds:string[]):WritingLocation{
 const location=clean(readEntries().find(entry=>entry.key===writingLocationKey(projectId,documentId)));reconcileWritingLocation(location,paragraphIds);return location;
}
export function reconcileWritingLocation(location:WritingLocation,paragraphIds:string[]){
 const existing=new Set(paragraphIds);for(const id of Object.keys(location.selections))if(!existing.has(id))delete location.selections[id];
 if(!location.activeId||!existing.has(location.activeId)){location.activeId=paragraphIds[0];location.scrolls.focus=0;}
}
export function saveWritingLocation(projectId:string,documentId:string,location:WritingLocation){
 const key=writingLocationKey(projectId,documentId);if(!safeId(key))return;
 try{const entries=readEntries().filter(entry=>entry.key!==key);entries.push({...clean(location),key,updatedAt:Date.now()});let retained=entries.slice(-MAX_ENTRIES),raw=JSON.stringify({version:1,entries:retained});while(raw.length>MAX_BYTES&&retained.length>1){retained=retained.slice(1);raw=JSON.stringify({version:1,entries:retained});}if(raw.length<=MAX_BYTES)storage()?.setItem(STORAGE_KEY,raw);}catch{/* Quota/private mode must never interrupt writing. */}
}
export function clampedWritingSelection(selection:WritingSelection,size:number):WritingSelection{
 const end=Math.max(1,size-1),from=Math.max(1,Math.min(position(selection.from),end)),to=Math.max(1,Math.min(position(selection.to),end));return {from:Math.min(from,to),to:Math.max(from,to)};
}
