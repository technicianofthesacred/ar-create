// A request adapter over the existing source owner. No job/store/acceptance writer.
import {createTranslationOneRunAdmission} from './translation-one-run-admission.mjs';
import {StateError} from '../store.mjs';
import {proposeKeptConversationTranslation} from './magazine/kept-conversation-translation.mjs';
const fail=(message,status=400)=>{throw new StateError(message,status);};
export function createKeptSourceTranslationRequests({read,config=null,admissionDataDir=null}={}){
  // Only the host-created service supplies this snapshot; HTTP input cannot opt in.
  const startup=structuredClone(config||{}),active=new Set(),approvedSources=new Set(Array.isArray(config?.translation?.keptConversations?.sourceIds)?config.translation.keptConversations.sourceIds.filter(id=>typeof id==='string'&&id):[]);
  const admit=createTranslationOneRunAdmission({oneRunId:startup.translation?.keptConversations?.oneRunId,dataDir:admissionDataDir,scope:'owner'});
  const permission={execution:startup.translation?.keptConversations?.enabled===true,shareContext:startup.translation?.keptConversations?.shareEntireContext===true};
  return {async propose(input){
    const keys=['sessionId','expectedRevision','expectedSourceHash'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||typeof input.sessionId!=='string'||!input.sessionId||!Number.isSafeInteger(input.expectedRevision)||!/^[a-f0-9]{64}$/i.test(input.expectedSourceHash||''))fail('Use the exact selected conversation, revision and source fingerprint.');
    if(!permission.execution||!permission.shareContext)return proposeKeptConversationTranslation({config:startup,permission});
    if(!approvedSources.size)return {state:'unavailable',gate:'source-context-not-authorized',message:'No conversation is approved for account context sharing in this workspace.',applied:false,proposals:[]};
    if(typeof read!=='function')fail('Kept conversations are not connected.',503);
    const current=await read(),session=current.sessions?.find(s=>s.id===input.sessionId);
    if(!session)fail('This kept conversation is unavailable.',404);
    if(!approvedSources.has(session.sourceId))return {state:'unavailable',gate:'source-context-not-authorized',message:'This conversation is not approved for account context sharing.',applied:false,proposals:[]};
    if(current.revision!==input.expectedRevision||session.sourceHash!==input.expectedSourceHash)fail('The conversation changed before translation. Refresh its current wording.',409);
    if(active.has(input.sessionId))fail('English proposals are already being prepared for this conversation.',409);
    // Pin the bridge initial snapshot before context transmission. Later reads are
    // compared in full by the bridge and retain its existing stale result contract.
    const pinnedSourceId=session.sourceId;active.add(input.sessionId);let contextPinned=false;
    try{return await proposeKeptConversationTranslation({config:startup,permission,readCurrent:async()=>{const state=await read(),selected=state.sessions?.find(s=>s.id===input.sessionId);if(!contextPinned){if(!selected)fail('This kept conversation is unavailable.',404);if(selected.sourceId!==pinnedSourceId||!approvedSources.has(selected.sourceId)||state.revision!==input.expectedRevision||selected.sourceHash!==input.expectedSourceHash)fail('The selected conversation changed before its context could be used. Refresh its current wording.',409);admit();contextPinned=true;}return {revision:state.revision,session:selected||null};}});}
    finally{active.delete(input.sessionId);}
  }};
}
