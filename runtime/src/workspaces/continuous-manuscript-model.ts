import type {JSONContent} from '@tiptap/core';
import type {Manuscript,Paragraph} from './document';
import {structuredMarkdown} from './document';
export const PASSAGE_NODE='passage';
const clone=<T,>(value:T):T=>structuredClone(value);
const normalized=(value:any):any=>Array.isArray(value)?value.map(normalized):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined&&value[key]!==null).map(key=>[key,normalized(value[key])]).filter(([key,value])=>key!=='attrs'||Object.keys(value as object).length)):value;
const key=(value:unknown)=>JSON.stringify(normalized(value));
const same=(a:unknown,b:unknown)=>key(a)===key(b);
const unique=<T,>(rows:T[])=>rows.filter((row,index)=>rows.findIndex(other=>same(row,other))===index);
export function nodeSize(node:JSONContent):number{return node.type==='text'?(node.text||'').length:node.type==='hardBreak'?1:2+(node.content||[]).reduce((sum,child)=>sum+nodeSize(child),0);}
export function wrapManuscript(value:Manuscript|Paragraph[]):JSONContent{
 const paragraphs=Array.isArray(value)?value:value.paragraphs;
 return {type:'doc',content:paragraphs.map(p=>({type:PASSAGE_NODE,attrs:{id:p.id},content:clone(p.doc.content||[{type:'paragraph'}])}))};
}
export function unwrapPassages(doc:JSONContent):{id:string;doc:JSONContent}[]{
 if(doc.type!=='doc'||doc.content?.some(node=>node.type!==PASSAGE_NODE))throw Error('The manuscript must contain passage wrappers.');
 const ids=new Set<string>();return (doc.content||[]).map(node=>{
  const id=node.attrs?.id;if(typeof id!=='string'||!id||ids.has(id))throw Error('The manuscript passage IDs need normalization.');ids.add(id);
  return {id,doc:{type:'doc',content:clone(node.content||[])}};
 });
}
export type PassageRange={id:string;from:number;to:number;offset:number};
export function passageRanges(doc:JSONContent):PassageRange[]{let from=0;return (doc.content||[]).map(node=>{const size=nodeSize(node),range={id:node.attrs?.id,from,to:from+size,offset:from+1};from+=size;return range;});}
export function globalToLocal(doc:JSONContent,range:{from:number;to:number}):{paragraphId:string;from:number;to:number}|null{
 if(!Number.isInteger(range.from)||!Number.isInteger(range.to)||range.to<range.from)return null;
 const p=passageRanges(doc).find(p=>range.from>=p.offset&&range.to<=p.to-1);return p?{paragraphId:p.id,from:range.from-p.offset,to:range.to-p.offset}:null;
}
export function localToGlobal(doc:JSONContent,id:string,range:{from:number;to:number}):{from:number;to:number}|null{
 const p=passageRanges(doc).find(p=>p.id===id);if(!p||range.from<0||range.to<range.from||range.to>p.to-p.offset-1)return null;return {from:range.from+p.offset,to:range.to+p.offset};
}
export function normalizePassageIds(doc:JSONContent,createId:()=>string=()=>crypto.randomUUID(),preferred:Map<string,number>=new Map()):{doc:JSONContent;assigned:{index:number;id:string;previousId:string|null}[]}{
 const result=clone(doc),used=new Set<string>(),reserved=new Set((doc.content||[]).map(node=>node.attrs?.id).filter(id=>typeof id==='string'&&id));const assigned:{index:number;id:string;previousId:string|null}[]=[];
 for(const [index,node] of (result.content||[]).entries()){
  if(node.type!==PASSAGE_NODE)throw Error('The manuscript must contain passage wrappers.');
  const old=node.attrs?.id;let id=old;
  if(typeof id!=='string'||!id||used.has(id)||preferred.has(id)&&preferred.get(id)!==index){
   let attempts=0;do{if(++attempts>1000)throw Error('Could not assign a unique passage ID.');id=createId();}while(!id||used.has(id)||reserved.has(id));
   node.attrs={...node.attrs,id};assigned.push({index,id,previousId:typeof old==='string'&&old?old:null});
  }
  used.add(id);
 }
 return {doc:result,assigned};
}
export type PositionMapping={mapResult:(position:number,bias?:number)=>{pos:number;deleted?:boolean}};
export type ReconcileOptions={previousDoc?:JSONContent;mapping?:PositionMapping;assigned?:{index:number;id:string;previousId:string|null}[]};
export function createPassageMetadata(value:Manuscript|Paragraph[],options:{maxSnapshots?:number;maxBytes?:number;maxEntries?:number}={}){
 const initial=Array.isArray(value)?value:value.paragraphs,entries=new Map<string,Paragraph>(),snapshots=new Map<string,{rows:Paragraph[];bytes:number}>(),overrides=new Map<string,Partial<Paragraph>>();
 const maxSnapshots=options.maxSnapshots??128,maxBytes=options.maxBytes??8*1024*1024,maxEntries=options.maxEntries??4096;let bytes=0;
 for(const paragraph of initial)entries.set(paragraph.id,clone(paragraph));
 const topology=(doc:JSONContent)=>JSON.stringify((doc.content||[]).map(node=>node.attrs?.id));
 function remember(doc:JSONContent,rows:Paragraph[]){
  const signature=topology(doc),snapshot={rows:clone(rows),bytes:signature.length*2+JSON.stringify(rows).length*2};
  if(snapshots.has(signature)){bytes-=snapshots.get(signature)!.bytes;snapshots.delete(signature);}snapshots.set(signature,snapshot);bytes+=snapshot.bytes;
  while(snapshots.size>maxSnapshots||bytes>maxBytes&&snapshots.size>1){const oldest=snapshots.keys().next().value!;bytes-=snapshots.get(oldest)!.bytes;snapshots.delete(oldest);}
  const active=new Set(rows.map(p=>p.id));while(entries.size>maxEntries){const obsolete=[...entries.keys()].find(id=>!active.has(id));if(!obsolete)throw Error('The manuscript exceeds the passage metadata limit.');entries.delete(obsolete);}
 }
 remember(wrapManuscript(initial),initial);
 function metadataForSplit(parent:Paragraph,doc:JSONContent):Paragraph{
  const words=structuredMarkdown(doc);return {...clone(parent),kept:parent.kept.filter(k=>k.mode!=='verbatim'||words.includes(k.text)),attributions:clone(parent.attributions),proposal:undefined,acceptedFrom:undefined,acceptanceHistory:undefined};
 }
 function inheritReferences(rows:Paragraph[]){
  const ledger=[...entries.values()].flatMap(p=>p.attributions);
  for(const p of rows){const refs=new Map<string,string>();const visit=(node:JSONContent)=>{if(node.attrs?.passageId&&node.attrs?.sourceRef)refs.set(node.attrs.passageId,node.attrs.sourceRef);for(const mark of node.marks||[])if(mark.attrs?.passageId&&mark.attrs?.sourceRef)refs.set(mark.attrs.passageId,mark.attrs.sourceRef);for(const child of node.content||[])visit(child);};visit(p.doc);p.attributions=unique([...p.attributions,...ledger.filter(card=>refs.get(card.id)===card.sourceId)]);}
  return rows;
 }
 function reconcile(doc:JSONContent,input:ReconcileOptions={}):Paragraph[]{
  const wrappers=unwrapPassages(doc),restored=snapshots.get(topology(doc));
  if(restored){const rows=wrappers.map(wrapper=>{const stored=restored.rows.find(p=>p.id===wrapper.id)!;return {...clone(stored),...clone(overrides.get(wrapper.id)||{}),doc:same(stored.doc,wrapper.doc)?clone(stored.doc):clone(wrapper.doc),text:same(stored.doc,wrapper.doc)?stored.text:structuredMarkdown(wrapper.doc)};});inheritReferences(rows);for(const p of rows)entries.set(p.id,clone(p));return rows;}
  const rows=wrappers.map(wrapper=>{
   const assigned=input.assigned?.find(item=>item.id===wrapper.id),parent=assigned?.previousId?entries.get(assigned.previousId):undefined;
   const stored=entries.get(wrapper.id)||(parent?metadataForSplit(parent,wrapper.doc):undefined);
   const base=stored||{id:wrapper.id,doc:wrapper.doc,text:'',attributions:[],kept:[],origin:'his' as const};
   return {...clone(base),id:wrapper.id,doc:same(base.doc,wrapper.doc)?clone(base.doc):clone(wrapper.doc),text:same(base.doc,wrapper.doc)?base.text:structuredMarkdown(wrapper.doc)};
  });
  if(input.previousDoc&&input.mapping){
   const currentIds=new Set(rows.map(p=>p.id)),ranges=passageRanges(doc);
   for(const old of passageRanges(input.previousDoc)){
    if(currentIds.has(old.id))continue;const original=entries.get(old.id);if(!original)continue;
    // Retained interior content indicates a native join; fully deleted content stays in the Undo cache only.
    const interior=Math.min(old.to-2,old.offset+1),mapped=input.mapping.mapResult(interior,1);
    if(mapped.deleted)continue;const destination=ranges.find(p=>mapped.pos>=p.offset&&mapped.pos<=p.to-1),target=rows.find(p=>p.id===destination?.id);if(!target)continue;
    target.kept=unique([...target.kept,...clone(original.kept)]);target.attributions=unique([...target.attributions,...clone(original.attributions)]);
    const history=unique([...(target.acceptanceHistory||(target.acceptedFrom?[target.acceptedFrom]:[])),...(original.acceptanceHistory||(original.acceptedFrom?[original.acceptedFrom]:[]))]);if(history.length)target.acceptanceHistory=history;
   }
  }
  inheritReferences(rows);for(const p of rows)entries.set(p.id,clone(p));remember(doc,rows);return rows;
 }
 function update(next:Manuscript|Paragraph[]){
  const rows=Array.isArray(next)?next:next.paragraphs;
  for(const p of rows){const previous=entries.get(p.id);if(previous){const patch={...overrides.get(p.id)};for(const field of new Set([...Object.keys(previous),...Object.keys(p)])){if(['id','doc','text'].includes(field))continue;if(!same((previous as any)[field],(p as any)[field]))(patch as any)[field]=clone((p as any)[field]);}overrides.set(p.id,patch);}entries.set(p.id,clone(p));}
  remember(wrapManuscript(rows),rows);
 }
 return {reconcile,update,copy:(fromId:string,id:string,doc:JSONContent)=>{const source=entries.get(fromId);if(source)entries.set(id,{...metadataForSplit(source,doc),id,doc:clone(doc),text:structuredMarkdown(doc)});},get:(id:string)=>{const p=entries.get(id);return p?clone(p):undefined;},sync:update,clear:()=>{entries.clear();snapshots.clear();overrides.clear();bytes=0;},stats:()=>({entries:entries.size,snapshots:snapshots.size,bytes})};
}
export type PassageMetadata=ReturnType<typeof createPassageMetadata>;
