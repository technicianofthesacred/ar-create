/* Read-only preparation for the existing segment translation contract. No provider or writer. */
import {pairingInfo,isSourceBoundary} from './interpretation-view.js';
const han = text => /\p{Script=Han}/u.test(text || '');
export function isTranslationGap(turn) {
  return !isSourceBoundary(turn) && pairingInfo(turn).sourceLanguage==='zh' &&
    typeof turn.originalText==='string' && han(turn.originalText) &&
    turn.originalText===turn.text;
}
export function prepareTranslationBatch(session,revision) {
  if(!session?.id || !session.sourceId || !session.sourceHash || !Array.isArray(session.turns))throw Error('Read the current conversation before preparing translation.');
  const ids=session.turns.map(t=>t.id);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('Conversation turn identities are incomplete or duplicated.');
  return {sessionId:session.id,sourceId:session.sourceId,expectedSourceHash:session.sourceHash,expectedRevision:revision,language:'en',
    gapIds:session.turns.filter(isTranslationGap).map(t=>t.id),
    // Full context, including current human wording and boundaries, stays local until an authorized bridge exists.
    segments:session.turns.map(t=>({id:t.id,speaker:t.speaker??null,start:t.start??null,end:t.end??null,text:t.text,sourceText:t.originalText,sourceLanguage:pairingInfo(t).sourceLanguage,kind:t.kind,timestamp:t.timestamp}))};
}
export function translationReadiness(session,{loading=false,error='',stale=false}={}) {
  const count=session?.turns?.filter(isTranslationGap).length||0;
  if(loading)return {state:'busy',count,message:'Checking conversation wording…'};
  if(error)return {state:'error',count,message:'Conversation could not be checked. Refresh to check translation gaps.'};
  if(stale)return {state:'stale',count,message:'Conversation changed. Refresh before preparing translation.'};
  if(!session)return {state:'unavailable',count,message:'Open a conversation to check its English wording.'};
  if(!count)return {state:'ready',count,message:'No unchanged Chinese remarks need a separate translation.'};
  return {state:'unavailable',count,message:`${count} Chinese remark${count===1?' still needs':'s still need'} English translation. All remarks remain visible. Conversation translation is not connected here.`};
}
/** Validate a complete gap-only result; return detached proposals, never overwrite current words. */
export function validateTranslationBatch(session,revision,batch,result) {
  if(JSON.stringify(prepareTranslationBatch(session,revision))!==JSON.stringify(batch))throw Error('Conversation changed after preparation.');
  for(const key of ['sessionId','sourceId','expectedSourceHash','expectedRevision'])if(result?.[key]!==batch[key])throw Error('Translation result belongs to another conversation revision.');
  if(!Array.isArray(result.segments)||result.segments.length!==batch.gapIds.length)throw Error('Translation gap batch is incomplete.');
  const expected=new Set(batch.gapIds),seen=new Set();
  for(const item of result.segments){if(!expected.has(item.id)||seen.has(item.id)||typeof item.text!=='string'||!item.text.trim()||han(item.text))throw Error('Translation gap batch has invalid IDs or untranslated wording.');seen.add(item.id);}
  return batch.gapIds.map(id=>({id,text:result.segments.find(t=>t.id===id).text}));
}
