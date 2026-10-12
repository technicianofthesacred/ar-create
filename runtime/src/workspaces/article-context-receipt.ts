import type {WritingContextSelection} from './context-selection';
export type ArticleContextReceipt={projectId:string;requestId:string;contextHash:string;promptHash:string;selection?:WritingContextSelection;items:{kind:string;id:string;role:string;hash:string;reviewState:string}[]};
/** Only immutable references travel into a new piece; captured words stay in the originating request. */
export function articleContextReceipt(input:unknown):ArticleContextReceipt {
 const value=input as ArticleContextReceipt;
 if(!value||typeof value.projectId!=='string'||!value.projectId||typeof value.requestId!=='string'||!value.requestId||![value.contextHash,value.promptHash].every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash))||!Array.isArray(value.items)||value.items.length>100||value.items.some(item=>!item||!['kind','id','role','hash','reviewState'].every(key=>typeof (item as any)[key]==='string')||!/^[a-f0-9]{64}$/.test(item.hash)))throw Error('The captured article context receipt is invalid. Reopen the original request.');
 if(value.selection){
  const selection=value.selection,groups=['reflectionIds','positionIds','claimIds','accountIds','answerIds'] as const;
  if(typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(key=>![...groups,'inspectedFiles'].includes(key)))throw Error('The selected context references are invalid.');
  let count=0;
  for(const key of groups){const ids=selection[key]||[];if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id||id.length>128)||new Set(ids).size!==ids.length)throw Error('The selected context IDs are invalid.');count+=ids.length;}
  const files=selection.inspectedFiles||[];
  if(!Array.isArray(files)||files.some(file=>!file||!/^[a-f0-9]{64}$/.test(file.hash)||!(file.kind==='source'&&typeof file.sourceId==='string'&&file.sourceId&&Object.keys(file).every(key=>['kind','sourceId','hash'].includes(key))||file.kind==='guidance'&&['voice','positions','recipe'].includes(file.key)&&Object.keys(file).every(key=>['kind','key','hash'].includes(key))))||count+files.length>100)throw Error('The inspected context references are invalid.');
 }
 return structuredClone({projectId:value.projectId,requestId:value.requestId,contextHash:value.contextHash,promptHash:value.promptHash,...(value.selection?{selection:value.selection}:{}),items:value.items});
}
