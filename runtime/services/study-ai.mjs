import {createStudyAIExecution,NATIVE_EXECUTION_PURPOSES} from './study-ai-execution.mjs';
import {createArtifactExecution,executeCodexArtifacts} from './artifact-execution.mjs';
import {createStudyBridge} from './study-mcp-bridge.mjs';
import {proposalEditable} from './native-proposal-capability.mjs';
import {createProvenanceLedger,AGENT_ACTORS,currentActor,requireHuman} from './actor.mjs';
const WRITES=['prepare','propose','accept','reject','finish','humanContract','standInContract'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
/** Route the existing native bridge by explicit owned study identity, never active piece. */
export function createStudyAI({dataDir,drafts,humanDirection,editorialPlan,projectMaterial,learning,guidance,assistanceDirection,bridgeFactory=createStudyBridge,execution,validateStandInTarget,onExecutionChange,voiceCorrections=null}){
 const rooms=new Map(),ledger=createProvenanceLedger({dataDir});
 // Proposal records live in the bridge; who prepared, proposed and decided each is kept beside them.
 const who=(bindingId,key,action)=>{const found=ledger.lookup({area:'study-ai',scopeId:bindingId,key,action});return found.actor==='unknown(pre-provenance)'?null:found;};
 async function call(action,input,standIn=false){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Select an owned manuscript part.');
  const {bindingId,parentStudyId,...args}=structuredClone(input);
  if(!uuid.test(bindingId||'')||typeof parentStudyId!=='string'||!parentStudyId.trim()||parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(parentStudyId))fail('Choose an explicit owned manuscript and parent project.');
  if(!['read','prepare','context','propose','review','list','accept','reject','finish','contracts','humanContract','run','runStatus','cancel','standInContract'].includes(action))fail('Unknown manuscript proposal action.',404);
  // Ownership is verified even on a cached route. Rebound or absent manuscripts refuse.
  const current=await drafts.read({bindingId,parentStudyId});
  if(current.binding?.id!==bindingId||current.binding?.parentStudyId!==parentStudyId||current.binding?.authority!=='owned-working-copy'||current.readiness?.ready!==true)fail('Open a ready owned manuscript before preparing AI work.',409);
  if(['accept','reject','humanContract'].includes(action)&&!standIn)requireHuman('Manuscript decisions');
  // Finishing a read-through is Adrian's alone, on every copy: there is no stand-in finish.
  if(action==='finish')requireHuman('Finishing a read-through');
  if(action==='cancel')return executor.cancel({bindingId,parentStudyId,...args});
  if(action==='runStatus')return executor.status({bindingId,parentStudyId,...args});
  if(action==='run'){
   const input={bindingId,parentStudyId,...args};let prior;try{prior=await executor.status(input);}catch(error){if(error.status!==404)throw error;}
   if(prior)return executor.run(input);
   const prepared=await call('review',{bindingId,parentStudyId,requestId:args.requestId});if(!NATIVE_EXECUTION_PURPOSES.includes(prepared.purpose)||prepared.status!=='prepared'||prepared.stale)fail('This request already has a proposal or changed context. Review it or prepare a fresh request.',409);
   return executor.run(input);
  }
  const key=bindingId+'\0'+parentStudyId;
  if(!rooms.has(key))rooms.set(key,bridgeFactory({dataDir,drafts,binding:{bindingId,parentStudyId},humanDirection,editorialPlan,projectMaterial,learning,guidance,assistanceDirection,validateStandInTarget}));
  const bridge=rooms.get(key);if(typeof bridge[action]!=='function')fail('This proposal action is not connected.',503);
  if(['read','list','contracts'].includes(action)&&Object.keys(args).length)fail('Read actions do not accept extra fields.');
  let result=await bridge[action](args);
  // His rewrites of machine paragraphs become voice corrections he approves later.
  if(action==='finish'&&voiceCorrections){const read=result.readThrough||{};let queued=true;for(const edit of read.edited||[]){try{voiceCorrections.queue({before:edit.before,after:edit.after,piece:{parentStudyId,bindingId,title:current.binding?.title||null},requestId:args.requestId,paragraphId:edit.id,operationId:args.operationId});}catch(error){queued=false;console.error('Voice correction was not queued:',error.message);}}result={...result,voiceCorrectionsQueued:queued};}
  if(['read','review','contracts'].includes(action)&&AGENT_ACTORS.includes(currentActor()?.actor)&&typeof validateStandInTarget==='function'){try{await validateStandInTarget({bindingId,parentStudyId});result={...result,canStandInContracts:true,...(action==='review'&&result.purpose==='sourced-paragraph'?{canStandInReview:true}:{})};}catch(error){if(![403,404,409].includes(error.status))throw error;}}
  if(action==='review'){
   result={...result,proposedBy:who(bindingId,args.requestId,'propose')||who(bindingId,args.requestId,'prepare'),decidedBy:who(bindingId,args.requestId,'finish')||who(bindingId,args.requestId,'accept')||who(bindingId,args.requestId,'reject')};
   const runs=await executor.list({bindingId,parentStudyId}),run=runs.items.find(item=>item.requestId===args.requestId);
   if(run?.state==='failed'){const artifact=await executor.retainedResult({bindingId,parentStudyId,requestId:args.requestId,operationId:run.operationId});if(artifact)result={...result,heldResult:{execution:run,artifact}};}
  }
  if(action==='read')result={...result,aiExecution:executor.capabilities()};
  if(WRITES.includes(action)){const key=args.requestId||result?.requestId||result?.request?.id||result?.id||args.operationId;if(key){try{ledger.stamp({area:'study-ai',scopeId:bindingId,key,action});}catch(error){console.error('Proposal provenance was not recorded:',error.message);}}}
  if(action==='list'&&Array.isArray(result?.items)){const executions=await executor.list({bindingId,parentStudyId});return {...result,items:result.items.map(item=>({...item,...(NATIVE_EXECUTION_PURPOSES.includes(item.purpose)?{execution:executions.items.find(run=>run.requestId===item.id)||null}:{}),proposedBy:who(bindingId,item.id,'propose')||who(bindingId,item.id,'prepare'),decidedBy:who(bindingId,item.id,'finish')||who(bindingId,item.id,'accept')||who(bindingId,item.id,'reject')}))};}
  return action==='read'&&Array.isArray(result.projection)?{...result,projection:result.projection.map(row=>({...row,proposalEditable:proposalEditable(row)}))}:result;
 }
 const executor=createStudyAIExecution({dataDir,service:{call:(action,input)=>call(action,input)},execution:execution||createArtifactExecution({execute:packet=>executeCodexArtifacts({...packet,boundedEditorial:true})}),onChange:onExecutionChange});
 async function standInReview(input){
  if(!input||Object.keys(input).some(key=>!['bindingId','parentStudyId','action','requestId','operationId','reason'].includes(key))||!['accept','reject'].includes(input.action)||!uuid.test(input.requestId||'')||!uuid.test(input.operationId||'')||input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>2000))fail('Choose one exact test proposal decision.',400);
  if(!AGENT_ACTORS.includes(currentActor()?.actor)||typeof validateStandInTarget!=='function')fail('Stand-in review requires the registered test copy and an agent actor.',403);
  const {bindingId,parentStudyId,action,requestId,operationId,reason}=input;
  await validateStandInTarget({bindingId,parentStudyId});
  const proposal=await call('review',{bindingId,parentStudyId,requestId});if(proposal.purpose!=='sourced-paragraph'||proposal.canStandInReview!==true)fail('Choose this test copy’s sourced proposal.');
  return call(action,{bindingId,parentStudyId,requestId,...(action==='accept'?{operationId}:{...(reason?{standInReason:reason}:{})})},true);
 }
 async function standInContract(input){if(!AGENT_ACTORS.includes(currentActor()?.actor)||typeof validateStandInTarget!=='function')fail('Stand-in contracts require the registered test copy and agent actor.',403);await validateStandInTarget({bindingId:input?.bindingId,parentStudyId:input?.parentStudyId});return call('standInContract',input);}
 return {call:(action,input)=>call(action,input),standInReview,standInContract,wait:executor.wait};
}
