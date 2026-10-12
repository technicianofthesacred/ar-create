export type InspectedFile={kind:'source';sourceId:string;hash:string}|{kind:'guidance';key:'voice'|'positions'|'recipe';hash:string};
export type WritingContextSelection={reflectionIds?:string[];positionIds?:string[];claimIds?:string[];accountIds?:string[];answerIds?:string[];inspectedFiles?:InspectedFile[]};
export type TerminalHandoff={nonce:number;file?:InspectedFile;prompt:string;title?:string;preparedArticle?:{request:{id:string};projectId:string;documentId:string;state:string}};
export const contextCount=(value?:WritingContextSelection)=>value?(['reflectionIds','positionIds','claimIds','accountIds','answerIds'] as const).reduce((count,key)=>count+(value[key]?.length||0),value.inspectedFiles?.length||0):0;
export const fileIdentity=(file:InspectedFile)=>file.kind==='source'?'source:'+file.sourceId:'guidance:'+file.key;
export function withInspectedFile(context:WritingContextSelection,file:InspectedFile):WritingContextSelection{return {...context,inspectedFiles:[...(context.inspectedFiles||[]).filter(existing=>fileIdentity(existing)!==fileIdentity(file)),file]};}
