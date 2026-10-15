import {validatedEmptyProjectOrigin} from './article-origin';
import {articleContextReceipt} from './article-context-receipt';
import {preparedSourceReceipt} from './prepared-source';
import {readLocalDrafts,writeLocalDraft,clearLocalDraft} from '../../public/lib/local-drafts.js';
import {parseWholeDraft,validatedMagazineProvenance,sameWholeDraftReview,type WholeDraftCandidate} from './wholeDraft';
import type {Manuscript} from './document';
const prefix=(documentId:string)=>`whole-draft:${documentId}:`;
export const wholeDraftRecoveryKey=(candidate:WholeDraftCandidate)=>prefix(candidate.baseDocumentId)+candidate.baseRevision;
function envelope(candidate:WholeDraftCandidate){return {kind:'whole-draft-preview.v1',raw:candidate.raw,originalRaw:candidate.originalRaw,originalRawKind:candidate.originalRawKind,editorialReview:candidate.editorialReview,fileName:candidate.fileName,baseDocumentId:candidate.baseDocumentId,baseRevision:candidate.baseRevision,baseIdentity:candidate.baseIdentity,baseOrigin:candidate.baseOrigin,firstDraft:candidate.firstDraft,makeReceipt:candidate.makeReceipt,...(candidate.magazineProvenance!==undefined?{magazineProvenance:validatedMagazineProvenance(candidate.magazineProvenance)}:{})};}
export function saveWholeDraftRecovery(projectId:string,candidate:WholeDraftCandidate,previous?:WholeDraftCandidate):boolean {
 // Only a matching review may update its own recovery. An explicit drop is
 // the boundary before loading another review; a new delivery cannot erase it.
 const context={schema:'ar-create.document.v1',id:candidate.baseDocumentId,revision:candidate.baseRevision,title:candidate.title,paragraphs:candidate.paragraphs,outputs:[]} as Manuscript;
 const pending=readWholeDraftRecovery(projectId,context);
 if(pending&&!sameWholeDraftReview(pending,previous||candidate))return false;
 const key=wholeDraftRecoveryKey(candidate),text=JSON.stringify(envelope(candidate));
 writeLocalDraft(projectId,key,text,new Date().toISOString());
 return readLocalDrafts(projectId)[key]?.text===text;
}
export function readWholeDraftRecovery(projectId:string,document:Manuscript):WholeDraftCandidate|null {
 const entries=Object.entries(readLocalDrafts(projectId)).filter(([key])=>key.startsWith(prefix(document.id))).sort((a,b)=>b[1].savedAt.localeCompare(a[1].savedAt));
 for(const [key,entry] of entries){
  try{
   const record=JSON.parse(entry.text);
   if(record.kind!=='whole-draft-preview.v1'||record.baseDocumentId!==document.id||!Number.isSafeInteger(record.baseRevision)||record.baseRevision<0||typeof record.raw!=='string'||typeof record.fileName!=='string'||key!==prefix(record.baseDocumentId)+record.baseRevision)continue;
   if(record.baseOrigin!==undefined&&typeof record.baseIdentity!=='string')continue;
   // The captured revision survives reload; parsing cannot silently rebase a
   // waiting draft onto writing that changed while it was closed.
   return {...parseWholeDraft(record.raw,{...document,id:record.baseDocumentId,revision:record.baseRevision},record.fileName),originalRaw:typeof record.originalRaw==='string'&&new TextEncoder().encode(record.originalRaw).length<=256*1024?record.originalRaw:undefined,originalRawKind:typeof record.originalRaw==='string'?'captured-source':undefined,...(record.editorialReview&&typeof record.editorialReview==='object'&&!Array.isArray(record.editorialReview)?{editorialReview:record.editorialReview}:{}),...(record.baseOrigin!==undefined?{baseOrigin:validatedEmptyProjectOrigin(record.baseOrigin,projectId)}:{}),...(record.firstDraft&&/^[a-f0-9]{64}$/.test(record.firstDraft.artifactHash)&&/^[a-f0-9]{64}$/.test(record.firstDraft.completionHash)?{firstDraft:record.firstDraft}:{}),baseIdentity:typeof record.baseIdentity==='string'?record.baseIdentity:undefined,...(record.magazineProvenance!==undefined?{magazineProvenance:validatedMagazineProvenance(record.magazineProvenance)}:{}),...(record.makeReceipt&&typeof record.makeReceipt.requestId==='string'&&Array.isArray(record.makeReceipt.sourceIds)&&record.makeReceipt.sourceIds.every((id:unknown)=>typeof id==='string')?{makeReceipt:{requestId:record.makeReceipt.requestId,sourceIds:record.makeReceipt.sourceIds,...(record.makeReceipt.contextReceipt!==undefined?{contextReceipt:articleContextReceipt(record.makeReceipt.contextReceipt)}:{}),...(typeof record.makeReceipt.notes==='string'?{notes:record.makeReceipt.notes}:{}),...(record.makeReceipt.preparedSource!==undefined?{preparedSource:preparedSourceReceipt(record.makeReceipt.preparedSource)}:{})}}:{})};
  }catch{/* Corrupt device data never replaces accepted writing. */}
 }
 return null;
}
export function clearWholeDraftRecovery(projectId:string,documentId:string):void {
 for(const key of Object.keys(readLocalDrafts(projectId)))if(key.startsWith(prefix(documentId)))clearLocalDraft(projectId,key);
}
