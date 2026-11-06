// Origin receipts link selected words to existing owners. They never approve prose or store a new editable summary.
import fs from 'node:fs';
import {simmerOperations} from './simmer-operations.mjs';
import path from 'node:path';
import {atomicWrite,ensurePrivateDirectory,readJson} from './files.mjs';
import {StateError} from '../store.mjs';
import {currentActor,withActor,CHAT_CARRIERS} from './actor.mjs';
import {originOf,originKey,fields,text,pin,UUID,digest,stable,uuidFrom,fail} from './conversation-origin.mjs';
const queues=new Map();
export function createConversationCapture({dataDir,concepts,boards,chat,instagram,checkpoint=async()=>{}}){
 const directory=()=>ensurePrivateDirectory(dataDir,'conversation-captures');
 const file=key=>path.join(directory(),key+'.json');
 const read=key=>readJson(file(key),null),write=r=>atomicWrite(file(r.id),JSON.stringify(r,null,2));
 const publicReceipt=r=>({schema:'ar-create.conversation-capture.v1',id:r.id,operationId:r.operationId,deliveryIds:r.deliveryIds||[r.operationId],ownerOperationId:r.ownerOperationId,origin:r.origin,carrier:r.carrier,action:r.action,target:r.target,contribution:r.contribution,status:r.status,at:r.at,originalExpected:r.expected,resumptions:r.resumptions||[],acknowledgement:r.acknowledgement||null,coverage:{captured:'selected-excerpt',upstream:r.origin.historyCoverage,completeConversation:false,missing:'All material outside the supplied excerpt is unobserved.'},authority:{authenticatedHuman:false,basis:r.action==='choose-story'||r.action==='name-direction'?'existing-carrier-reported-relay':'exact-dictation-not-editorial-approval'},...(r.error?{error:r.error,recovery:{command:'conversation.capture',operationId:r.operationId,ownerOperationId:r.ownerOperationId,expected:r.expected,action:r.action,rule:['gather-words','name-direction'].includes(r.action)?'Retry identical original input. If the board changed, inspect the owner receipt and current board first; then supply resume:{revision,hash} explicitly. Original expected and words stay unchanged.':'Retry identical input and original expected guards; the existing owner receipt is the only completion proof.'}}:{})});
 const list=parentStudyId=>fs.existsSync(path.join(dataDir,'conversation-captures'))?fs.readdirSync(directory()).filter(n=>n.endsWith('.json')).map(n=>readJson(path.join(directory(),n),null)).filter(r=>!parentStudyId||r.target.parentStudyId===parentStudyId).map(publicReceipt):[];
 async function prepare(action,target,contribution,expected,ownerOperationId,origin,at){
  if(action==='append-thought'){
   fields(target,['parentStudyId']);const before=await concepts.read({parentStudyId:target.parentStudyId});
   if(!before.structured)fail('This author page uses manual Markdown. Keep its words and capture through gather-words instead.',409);
   if(before.revision!==expected.revision||before.hash!==expected.hash)fail('The author page changed. Read it again; no contribution was appended.',409);
   return {parentStudyId:target.parentStudyId,operationId:ownerOperationId,expectedRevision:expected.revision,expectedHash:expected.hash,authorThoughts:(before.authorThoughts||'')+(before.authorThoughts?'\n\n':'')+contribution.text,aiInterpretation:before.aiInterpretation||'',suggestions:before.suggestions||'',sourceSelections:before.sourceSelections||[],dictated:true};
  }
  if(action==='gather-words'||action==='name-direction'){
   fields(target,['parentStudyId']);const b=boards.raw(target.parentStudyId);if(b.revision!==expected.revision||b.hash!==expected.hash)fail('The board changed. Read it again before capture.',409);
   return {subject:target.parentStudyId,operationId:ownerOperationId,expectedRevision:expected.revision,expectedHash:expected.hash,...(action==='gather-words'?{words:[{text:contribution.text,said:'typed'}]}:{sentence:contribution.text,said:'typed'})};
  }
  if(action==='choose-story'){
   fields(target,['parentStudyId','planId','storyId']);if(!UUID.test(target.planId))fail('Choose the exact plan UUID.');text(target.storyId,'storyId');
   const plan=await instagram.read({id:target.planId});if(plan.subject!==target.parentStudyId||!plan.stories.some(s=>s.id===target.storyId))fail('The story does not belong to this exact subject and plan.',409);
   if(plan.revision!==expected.revision||plan.hash!==expected.hash)fail('The proposed story changed. Read the current plan before carrying its choice.',409);
   return {id:target.planId,storyId:target.storyId,operationId:ownerOperationId,expectedRevision:expected.revision,expectedHash:expected.hash,said:{quote:contribution.text,via:'chat',at:origin.saidAt||at,origin}};
  }
  fail('This capture action is not permitted. Native acceptance, protection, rejection and Finish still require their existing human action.',403);
 }
 async function capture(input){
  fields(input,['operationId','origin','action','target','contribution','expected'],['resume']);input=structuredClone(input);
  if(!UUID.test(input.operationId||''))fail('Use a fresh delivery operation UUID.');
  const carrier=currentActor();if(!CHAT_CARRIERS.includes(carrier?.actor))fail('Conversation capture requires an honest agent carrier; a human header is not upstream authentication.',403);
  const origin=originOf(input.origin);fields(input.contribution,['role','text']);if(input.contribution.role!=='human')fail('Only an exact selected human contribution can use this capture path; agent interpretation is not a human decision.',403);text(input.contribution.text,'Exact contribution',8000);fields(input.target,['parentStudyId'],['planId','storyId']);text(input.target.parentStudyId,'parentStudyId');pin(input.expected);if(input.resume!==undefined){pin(input.resume);if(!['gather-words','name-direction'].includes(input.action))fail('Only an interrupted Simmer owner supports explicit resume guards.');}
  const identity={origin:originKey(origin),action:input.action,target:input.target},key=digest(identity),fingerprint=digest({...identity,contribution:input.contribution,expected:input.expected});
  const lock=path.resolve(dataDir)+':capture',previous=queues.get(lock)||Promise.resolve();
  const run=previous.then(async()=>{
   let receipt=read(key);
   // A delivery UUID is not reusable across other origins, targets or actions.
   const used=list().find(r=>r.deliveryIds.includes(input.operationId)&&r.id!==key);if(used)fail('This delivery operationId already identifies another action or target.',409);
   if(receipt){
    if(receipt.fingerprint!==fingerprint)fail('This origin/action/target already captured different words. Preserve that capture; use a distinct message for a new contribution.',409);
    if(['captured','captured-effect-held'].includes(receipt.status)){receipt.deliveryIds=[...new Set([...(receipt.deliveryIds||[receipt.operationId]),input.operationId])];write(receipt);return {...publicReceipt(receipt),replayed:true};}
    if(receipt.carrier.actor!==carrier.actor)fail('An interrupted capture must be resumed by its original carrier; the recorded input remains available.',409);
    if(stable(receipt.expected)!==stable(input.expected))fail('The interrupted capture retains its original owner guards. Read its held state before retrying.',409);
    receipt.deliveryIds=[...new Set([...(receipt.deliveryIds||[receipt.operationId]),input.operationId])];write(receipt);
   }else{
    if(input.resume!==undefined)fail('Resume only an existing held capture.',409);
    const at=new Date().toISOString(),ownerOperationId=uuidFrom(key);
    const ownerInput=await prepare(input.action,input.target,input.contribution,input.expected,ownerOperationId,origin,at);
    receipt={schema:'ar-create.conversation-capture-receipt.v1',id:key,fingerprint,operationId:input.operationId,deliveryIds:[input.operationId],ownerOperationId,origin,carrier:{actor:carrier.actor,client:carrier.client},action:input.action,target:structuredClone(input.target),contribution:structuredClone(input.contribution),expected:structuredClone(input.expected),ownerInput,status:'pending',at};write(receipt);
   }
   try{
    let resume=input.resume;
    if(resume&&!simmerOperations(dataDir).read(receipt.ownerOperationId)){
     // The board can change after capture prepares, before W3 starts its receipt.
     // Record the explicitly refreshed guard before starting that same owner UUID.
     receipt.initialOwnerInput??=structuredClone(receipt.ownerInput);
     receipt.ownerInput={...receipt.ownerInput,expectedRevision:resume.revision,expectedHash:resume.hash};
     receipt.resumptions=[...(receipt.resumptions||[]),{expected:structuredClone(resume),at:new Date().toISOString(),actor:carrier.actor}];write(receipt);resume=null;
    }
    const ownerInput={...receipt.ownerInput,...(resume?{resume:{expectedRevision:resume.revision,expectedHash:resume.hash}}:{})};
    const result=await withActor({...carrier,origin:receipt.origin},()=>receipt.action==='append-thought'?concepts.save(ownerInput):receipt.action==='choose-story'?instagram.choose(ownerInput):receipt.action==='gather-words'?chat.intake(ownerInput):chat.dish(ownerInput));
    await checkpoint('owner-committed',receipt,result);
    receipt.status=receipt.action==='name-direction'&&result.direction?.status!=='saved'?'captured-effect-held':'captured';receipt.acknowledgement={owner:receipt.action==='append-thought'?'concept':receipt.action==='choose-story'?'instagram-plan':'simmer',operationId:receipt.ownerOperationId,revision:result.revision,hash:result.hash,...(result.direction?{direction:result.direction}:{}),artifacts:receipt.action==='choose-story'?{planId:receipt.target.planId,storyId:receipt.target.storyId}:receipt.action==='append-thought'?{parentStudyId:receipt.target.parentStudyId,bindingId:result.bindingId}:{subject:receipt.target.parentStudyId,collectionId:result.collectionId||null,sourceIds:result.receipt?.photos?.map(p=>p.sourceId)||[],noteId:result.receipt?.note?.sourceId||result.receipt?.noteId||null}};delete receipt.error;write(receipt);return publicReceipt(receipt);
   }catch(error){receipt.status='held';receipt.error={status:error.status||503,message:error.message,ownerReceipt:error.receipt||null};write(receipt);const failure=Object.assign(new StateError('Contribution retained for recovery; owner action is held. '+error.message,error.status||503),{receipt:publicReceipt(receipt)});throw failure;}
  });
  const settled=run.catch(()=>{});queues.set(lock,settled);return run.finally(()=>{if(queues.get(lock)===settled)queues.delete(lock);});
 }
 function activityReceipts(){return list().filter(r=>['captured','captured-effect-held','held'].includes(r.status)).map(r=>({id:'conversation:'+r.id+':'+(r.status==='captured'?'committed':'partial'),operationId:r.operationId,actor:r.carrier.actor,client:r.carrier.client,scope:{kind:'project',id:r.target.parentStudyId},command:'conversation.capture',at:r.at,status:r.status==='captured'?'committed':'partial',before:r.originalExpected,after:r.acknowledgement?{revision:r.acknowledgement.revision??null,hash:r.acknowledgement.hash??null}:null,reason:r.status==='captured'?null:r.status==='captured-effect-held'?'Exact contribution retained; Direction adoption is held.':'Exact contribution retained; owner completion requires recovery.'}));}
 return {capture,list,activityReceipts};
}
