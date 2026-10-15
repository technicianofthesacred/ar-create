// Device-local navigation preference; never part of manuscript autosaves.
export function outputSelectionKey(projectId:string,documentId:string):string {
 return 'ar-create:selected-output:'+JSON.stringify([projectId,documentId]);
}
export function resolveOutputSelection(outputs:readonly {id:string}[],selected:string|null):string|null {
 return outputs.some(output=>output.id===selected)?selected:outputs.at(-1)?.id||null;
}
export function readOutputSelection(projectId:string,documentId:string,outputs:readonly {id:string}[]):string|null {
 let selected:string|null=null;
 try{if(projectId&&documentId&&typeof window!=='undefined')selected=window.localStorage.getItem(outputSelectionKey(projectId,documentId));}catch{}
 return resolveOutputSelection(outputs,selected);
}
export function writeOutputSelection(projectId:string,documentId:string,selected:string|null):void {
 if(!projectId||!documentId)return;
 try{if(typeof window==='undefined')return;const storage=window.localStorage,key=outputSelectionKey(projectId,documentId);if(selected)storage.setItem(key,selected);else storage.removeItem(key);}catch{}
}
