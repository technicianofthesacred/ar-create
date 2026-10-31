import path from 'node:path';
import {createLanguageProposals} from './study-language-proposals.mjs';
import {createNativeLanguageProposalOwner} from './native-language-proposal-owner.mjs';
import {createShareLanguageProposalOwner} from './share-language-proposal-owner.mjs';
import {AGENT_ACTORS,currentActor} from './actor.mjs';
import {ensurePrivateDirectory,readJson} from './files.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),stable=v=>JSON.stringify(v,(_,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x),same=(a,b)=>stable(a)===stable(b);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const LANGUAGE_CONNECTION_ROUTES=Object.freeze({capabilities:'/api/study/language/capabilities',prepare:'/api/study/language/prepare',run:'/api/study/language/run',review:'/api/study/language/review',accept:'/api/study/language/accept',reject:'/api/study/language/reject',standInAccept:'/api/study/language/stand-in-accept',standInReject:'/api/study/language/stand-in-reject'});
/** Composition seam only: no HTTP installation, new store or provider setup.
 * Root supplies retained outputs/drafts/share/structureTests and optional existing
 * execution. Default transport remains the common service's installed Codex.
 *
 * HTTP wiring: GET capabilities/review; POST all other declared routes. Every
 * method takes {scope,...}; native scope is {kind:'audience-article',bindingId,
 * parentStudyId,outputId}; Share adds recipientId and kind:'share-message'.
 * Audience drawer GET query bindingId,parentStudyId,outputId (+requestId) must be
 * wrapped into the native scope by root. Share callers must explicitly supply
 * share scope including recipientId. Never infer a scope from active selection.
 * prepare adds targetLanguage/retainedTerms; run/review add requestId; decisions
 * add requestId/operationId; only genuine human accept/reject add humanDecision.
 * Preserve HTTP actor context with withActor. Do not accept actor/capability/source
 * records in bodies. Distinct stand-in routes call distinct methods below.
 */
export function createStudyLanguageConnection({dataDir,outputs,drafts,share,structureTests,execution}={}){
 if(!dataDir||!outputs?.read||!outputs.create||!drafts?.read||!drafts.save)throw Error('Connect the maintained native output and draft owners.');
 const records=ensurePrivateDirectory(dataDir,'language-proposals');
 function scope(value){
  const keys=value?.kind==='share-message'?['kind','bindingId','parentStudyId','outputId','recipientId']:['kind','bindingId','parentStudyId','outputId'];
  if(!object(value)||!['audience-article','share-message'].includes(value.kind)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k))||![value.bindingId,value.outputId,...(value.kind==='share-message'?[value.recipientId]:[])].every(id=>UUID.test(id||''))||typeof value.parentStudyId!=='string'||!value.parentStudyId.trim()||value.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(value.parentStudyId))fail('Choose one exact native Article or Share recipient scope.');
  return structuredClone(value);
 }
 function input(value,keys){if(!object(value)||Object.keys(value).some(k=>!keys.includes(k))||!Object.hasOwn(value,'scope'))fail('Use the exact scoped language request fields.');return scope(value.scope);}
 // Read only the common owner's existing request journal to admit its scope.
 // Calling common.review first would open the foreign request's source owner.
 function own(value,keys){const selected=input(value,keys);if(!UUID.test(value.requestId||''))fail('Exact language request UUID required.');const record=readJson(path.join(records,value.requestId+'.json'),null);if(!record||record.id!==value.requestId||!same(record.source?.scope,selected))fail('Language request is unavailable in this exact scope.',404);return selected;}
 async function registered(value){
  const selected=scope(value);if(!AGENT_ACTORS.includes(currentActor()?.actor)||typeof structureTests?.validateTarget!=='function')fail('Stand-in translation review requires the registered copy and an agent actor.',403);
  let target;try{target=await structureTests.validateTarget({bindingId:selected.bindingId,parentStudyId:selected.parentStudyId});}catch(error){if(error.status===404)fail('Stand-in translation review requires the registered copy.',403);throw error;}
  if(target?.root?.binding?.id!==selected.bindingId||target.root.binding.parentStudyId!==selected.parentStudyId||target.root.binding.origin!=='structure-test'||target.root.binding.kind!=='collection-root'||target.root.readiness?.ready!==true)fail('Stand-in translation scope is not the exact registered root.',403);return target;
 }
 const native=createNativeLanguageProposalOwner({dataDir,outputs,drafts,validateStandInTarget:registered});let shareOwner;
 function owner(value){const selected=scope(value);if(selected.kind==='audience-article')return native;if(!shareOwner){if(!share?.read||!share.save)fail('The maintained Share preparation owner is unavailable.',503);shareOwner=createShareLanguageProposalOwner({dataDir,share,validateStandInTarget:registered});}return shareOwner;}
 const service=createLanguageProposals({dataDir,readSource:value=>owner(value).readSource(value),applyReviewedTranslation:packet=>owner(packet.source.scope).applyReviewedTranslation(packet),validateStandInTarget:registered,...(execution?{execution}:{})});
 async function decorated(record,selected){if(!same(record.source?.scope,selected))fail('Language owner returned another source scope.',409);let canStandInReview=false;if(AGENT_ACTORS.includes(currentActor()?.actor)){try{await registered(selected);canStandInReview=true;}catch(error){if(![403,404,409].includes(error.status))throw error;}}return {...record,canStandInReview};}
 async function decision(action,value){const standIn=action.startsWith('standIn'),keys=['scope','requestId','operationId',...(standIn?[]:['humanDecision'])],selected=own(value,keys);if(standIn)await registered(selected);const {scope:unused,...args}=value;return decorated(await service[action](args),selected);}
 return {
  async capabilities(value){const selected=input(value,['scope']);await owner(selected).readSource(selected);let canStandInReview=false;if(AGENT_ACTORS.includes(currentActor()?.actor)){try{await registered(selected);canStandInReview=true;}catch(error){if(![403,404,409].includes(error.status))throw error;}}return {...service.capabilities(),scope:selected,canStandInReview};},
  async prepare(value){const selected=input(value,['scope','targetLanguage','retainedTerms']);return decorated(await service.prepare({scope:selected,targetLanguage:value.targetLanguage,...(value.retainedTerms!==undefined?{retainedTerms:value.retainedTerms}:{})}),selected);},
  async run(value){const selected=own(value,['scope','requestId']);return decorated(await service.run({requestId:value.requestId}),selected);},
  async review(value){const selected=own(value,['scope','requestId']);return decorated(await service.review({requestId:value.requestId}),selected);},
  accept:value=>decision('accept',value),reject:value=>decision('reject',value),standInAccept:value=>decision('standInAccept',value),standInReject:value=>decision('standInReject',value),
  async wait(value){own(value,['scope','requestId']);return service.wait(value.requestId);}
 };
}
