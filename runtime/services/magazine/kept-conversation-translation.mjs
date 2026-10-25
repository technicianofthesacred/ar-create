// Code-only connection: kept source snapshots -> existing account packet executor
// -> validated proposals. No route, recording job, source writer or saved state.
import {runConversationTranslation} from '../../../public/document-study/conversation-translation-bridge.js';
import {makeChatGPTBatch,mergeChatGPTBatch} from './chatgpt-translation.mjs';
import * as account from './openai-translation.mjs';
import {digest} from '../files.mjs';
const unavailable=(gate,message)=>({state:'unavailable',gate,message,applied:false,proposals:[]});
export async function proposeKeptConversationTranslation({config={},permission,readCurrent}={}){
  if(config?.translation?.keptConversations?.enabled!==true)return unavailable('kept-conversation-execution-disabled','Kept-conversation execution is disabled in configuration.');
  if(config.translation.keptConversations.shareEntireContext!==true||permission?.execution!==true||permission?.shareContext!==true)return unavailable('entire-context-sharing-not-authorized','Execution and sharing the entire conversation context require explicit permission.');
  if(typeof config.translation.codexPath!=='string'||!config.translation.codexPath.trim())return unavailable('account-executor-not-configured','The maintained account executable is not configured.');
  // One bounded account run across every packet; a later batch cannot reset the
  // trusted proxy deadline or continue launching work after its budget expires.
  const budget=config.translation.timeoutMs??240000;
  if(!Number.isSafeInteger(budget)||budget<1000||budget>600000)return unavailable('invalid-execution-budget','Translation requires a bounded execution deadline.');
  const deadline=Date.now()+budget,requestFingerprints=[];
  const execute=typeof account.executeKeptConversationPacket==='function'?async packet=>{
    // The gap digest alone cannot bind surrounding human edits or source identity.
    // Fingerprint the exact full packet and maintained model; no cache is created.
    const remaining=deadline-Date.now();if(remaining<=0)throw Error('Translation time limit reached. No source wording was changed.');
    requestFingerprints.push(digest(JSON.stringify({model:account.TRANSLATION_MODEL,packet})));
    return account.executeKeptConversationPacket({...config,translation:{...config.translation,timeoutMs:remaining}},packet,permission);
  }:undefined;
  const result=await runConversationTranslation({readCurrent,makePacket:makeChatGPTBatch,validateTranslation:mergeChatGPTBatch,execute,permission});
  return requestFingerprints.length?{...result,execution:{engine:'openai-account',model:account.TRANSLATION_MODEL,requestsAttempted:requestFingerprints.length,requestFingerprints}}:result;
}
