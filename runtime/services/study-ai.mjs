import {createStudyBridge} from './study-mcp-bridge.mjs';
import {proposalEditable} from './native-proposal-capability.mjs';
import {createProvenanceLedger} from './actor.mjs';
const WRITES=['prepare','propose','accept','reject','humanContract'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
/** Route the existing native bridge by explicit owned study identity, never active piece. */
export function createStudyAI({dataDir,drafts,humanDirection,editorialPlan,projectMaterial,learning,guidance,bridgeFactory=createStudyBridge}){
 const rooms=new Map(),ledger=createProvenanceLedger({dataDir});
 // Proposal records live in the bridge; who prepared, proposed and decided each is kept beside them.
 const who=(bindingId,key,action)=>{const found=ledger.lookup({area:'study-ai',scopeId:bindingId,key,action});return found.actor==='unknown(pre-provenance)'?null:found;};
 async function call(action,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Select an owned manuscript part.');
  const {bindingId,parentStudyId,...args}=structuredClone(input);
  if(!uuid.test(bindingId||'')||typeof parentStudyId!=='string'||!parentStudyId.trim()||parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(parentStudyId))fail('Choose an explicit owned manuscript and parent project.');
  if(!['read','prepare','context','propose','review','list','accept','reject','contracts','humanContract'].includes(action))fail('Unknown manuscript proposal action.',404);
  // Ownership is verified even on a cached route. Rebound or absent manuscripts refuse.
  const current=await drafts.read({bindingId,parentStudyId});
  if(current.binding?.id!==bindingId||current.binding?.parentStudyId!==parentStudyId||current.binding?.authority!=='owned-working-copy'||current.readiness?.ready!==true)fail('Open a ready owned manuscript before preparing AI work.',409);
  const key=bindingId+'\0'+parentStudyId;
  if(!rooms.has(key))rooms.set(key,bridgeFactory({dataDir,drafts,binding:{bindingId,parentStudyId},humanDirection,editorialPlan,projectMaterial,learning,guidance}));
  const bridge=rooms.get(key);if(typeof bridge[action]!=='function')fail('This proposal action is not connected.',503);
  if(['read','list','contracts'].includes(action)&&Object.keys(args).length)fail('Read actions do not accept extra fields.');
  const result=await bridge[action](args);
  if(WRITES.includes(action)){const key=args.requestId||result?.requestId||result?.request?.id||args.operationId;if(key){try{ledger.stamp({area:'study-ai',scopeId:bindingId,key,action});}catch(error){console.error('Proposal provenance was not recorded:',error.message);}}}
  if(action==='list'&&Array.isArray(result?.items))return {...result,items:result.items.map(item=>({...item,proposedBy:who(bindingId,item.id,'propose')||who(bindingId,item.id,'prepare'),decidedBy:who(bindingId,item.id,'accept')||who(bindingId,item.id,'reject')}))};
  return action==='read'&&Array.isArray(result.projection)?{...result,projection:result.projection.map(row=>({...row,proposalEditable:proposalEditable(row)}))}:result;
 }
 return {call};
}
