// Magazine is read-only. A piece owns one editable physical Library copy;
// document state stores identity and origin, never another editable template body.
import {randomUUID} from 'node:crypto';
import {StateError,validateWritingTemplate,validateWritingTemplateSnapshot,WRITING_TEMPLATE_MAX_BYTES} from '../store.mjs';
import {digest} from './files.mjs';

const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
function bounded(raw) {
  if(typeof raw!=='string'||raw.includes('\0')||Buffer.byteLength(raw)>WRITING_TEMPLATE_MAX_BYTES)throw new StateError('Writing templates must be UTF-8 text under 128 KiB.',413);
}
function stamp(state){return {projectId:state.project.id,documentId:state.project.document?.id,revision:state.revision,attachment:structuredClone(state.project.document?.writingTemplate??null)};}
function assertUnchanged(store,captured,{revision=false}={}){
  const current=stamp(store.get());
  if(current.projectId!==captured.projectId||current.documentId!==captured.documentId||!same(current.attachment,captured.attachment)||(revision&&current.revision!==captured.revision))throw new StateError('The active piece or writing template changed. Reload before continuing.',409);
}
export async function readAttachedWritingTemplate({store,library,state=store.get()}) {
  const captured=stamp(state),attachment=captured.attachment;
  if(!attachment){assertUnchanged(store,captured);return {attachment:null,source:null};}
  validateWritingTemplate(attachment);
  let source;try{source=await library.read(attachment.sourceId);}catch{throw new StateError('The attached writing template file is missing or unavailable. Reattach a readable copy.',409);}
  assertUnchanged(store,captured);
  const receipt=source.provenance;
  if(source.rootId!=='library'||receipt?.kind!=='piece-writing-template'||receipt.documentId!==captured.documentId||receipt.projectId!==captured.projectId||receipt.attachmentId!==attachment.attachmentId||!same(receipt.source,attachment.source))throw new StateError('The attached writing template no longer matches its owned file receipt.',409);
  bounded(source.raw);
  if(digest(source.raw)!==source.hash)throw new StateError('The writing template file changed while reading. Reopen it.',409);
  return {attachment,source};
}
export function createWritingTemplates({store,library,magazine}) {
  function guard(input,{read=false}={}){
    const state=store.get(),document=state.project.document;
    if(typeof input.expectedProjectId!=='string'||typeof input.expectedDocumentId!=='string'||(!read&&(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)))throw new StateError('Writing template requires the expected piece, document and saved revision.');
    if(!document||state.project.id!==input.expectedProjectId||document.id!==input.expectedDocumentId||(!read&&state.revision!==input.expectedRevision))throw new StateError('The active piece changed. Reload before changing its writing template.',409);
    return state;
  }
  async function materialize(raw,source,state,restoredFromVersion=null){
    bounded(raw);validateWritingTemplate({sourceId:'pending',attachmentId:randomUUID(),attachedAt:new Date().toISOString(),source});
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(state.project.document.id))throw new StateError('This document identity cannot own a template folder. Use a document with a safe ID.');
    const attachmentId=randomUUID(),attachedAt=new Date().toISOString(),documentId=state.project.document.id;
    // UUID-based name prevents replacement from overwriting any earlier copy.
    const saved=await library.retainAlbumPhoto({folder:`Projects/${documentId}/Guidance`,name:`${attachmentId}-writing-template.md`,bytes:Buffer.from(raw),provenance:{kind:'piece-writing-template',binding:'unbound-unless-referenced-by-document',projectId:state.project.id,documentId,attachmentId,source:structuredClone(source),...(restoredFromVersion?{restoredFromVersion}:{})}});
    return {sourceId:saved.id,attachmentId,attachedAt,source:structuredClone(source)};
  }
  async function saveAttachment(state,attachment){
    assertUnchanged(store,stamp(state),{revision:true});
    state.project.document.writingTemplate=attachment;
    state.project.document.revision++;
    return store.put(state);
  }
  return {
    async attach(input){
      const state=guard(input),captured=stamp(state);
      const artifact=await magazine.read({artifactId:input.artifactId,expectedHash:input.expectedHash});
      assertUnchanged(store,captured,{revision:true});
      if(artifact.fileName!=='TEMPLATE.md')throw new StateError('Choose Magazine TEMPLATE.md for writing form. Other Magazine guidance cannot be attached.');
      bounded(artifact.raw);
      const attachment=await materialize(artifact.raw,{artifactId:input.artifactId,fileName:artifact.fileName,provenance:artifact.provenance},state);
      return saveAttachment(state,attachment);
    },
    async detach(input){const state=guard(input);return saveAttachment(state,null);},
    async get(input){const state=guard(input,{read:true});return readAttachedWritingTemplate({store,library,state});},
    async snapshot(input){
      const state=guard(input),captured=stamp(state),{attachment,source}=await readAttachedWritingTemplate({store,library,state});
      assertUnchanged(store,captured,{revision:true});
      const snapshot=attachment?{schema:'ar-create.writing-template-snapshot.v1',attachment,raw:source.raw,hash:source.hash,capturedAt:new Date().toISOString()}:null;
      validateWritingTemplateSnapshot(snapshot);return {snapshot};
    },
    async restoreCopy(input){
      const state=guard(input),captured=stamp(state),version=state.project.versions.find(v=>v.id===input.versionId);
      if(!version)throw new StateError('Saved version was not found.',404);
      const snapshot=version.writingTemplateSnapshot??null;
      validateWritingTemplateSnapshot(snapshot);
      if(!snapshot)return {attachment:null};
      const attachment=await materialize(snapshot.raw,snapshot.attachment.source,state,version.id);
      assertUnchanged(store,captured,{revision:true});
      return {attachment};
    },
  };
}
