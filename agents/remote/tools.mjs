import {z} from './sdk.mjs';
import {createClient} from '../lib/client.mjs';
import {createReplay,fail,stable} from './replay.mjs';

const id=z.string().uuid(),text=z.string().min(1).max(256),sha=z.string().regex(/^[a-f0-9]{64}$/);
const selector=z.strictObject({parentStudyId:text,rootBindingId:id.optional(),outputId:id.optional()}).refine(v=>!!v.rootBindingId===!!v.outputId,'An exact piece needs both rootBindingId and outputId.');
const expected=z.strictObject({revision:z.number().int().min(0),hash:sha});
const origin=z.strictObject({conversationId:z.string().min(1).max(191).optional(),messageId:text.optional(),captureId:id.optional(),historyCoverage:z.enum(['selected-only','upstream-unavailable']),saidAt:z.string().datetime().optional()}).refine(v=>!!v.captureId||!!v.conversationId&&!!v.messageId,'Supply reported conversation/message IDs or a stable captureId.');
export const toolDefinitions=[
 ['ar_create_projects','List only the projects granted to this authenticated connection.',z.strictObject({}),true],
 ['ar_create_current_work','Read exact owner-backed words, decisions, selected material and current guards. No unseen conversation or human approval is inferred.',z.strictObject({selector}),true],
 ['ar_create_validate_work','Keep prepared text unchanged beside fresh context. Changed context holds the preparation; even unchanged context grants no Apply permission.',z.strictObject({selector,expectedFingerprint:sha,preparedText:z.string().max(200000)}),true],
 ['ar_create_capture_contribution','Carry an explicitly supplied exact human excerpt. Its upstream identity remains caller-reported. Only append-thought/gather-words; no direction adoption, approval or Finish.',z.strictObject({operationId:id,origin,action:z.enum(['append-thought','gather-words']),target:z.strictObject({parentStudyId:text}),contribution:z.strictObject({role:z.literal('human'),text:z.string().min(1).max(8000)}),expected}),false],
 ['ar_create_save_preparation','Save provisional interpretation and unadopted suggestions, preserving exact human words and source choices. Requires current concept revision/hash; this is not manuscript prose.',z.strictObject({parentStudyId:text,operationId:id,expected,interpretation:z.string().max(16000),suggestions:z.string().max(16000)}),false],
 ['ar_create_prepare_proposal','Capture an exact native piece and chosen retained sources for a paragraph proposal. No model runs and no manuscript changes. An uncertain reply is never automatically rerun.',z.strictObject({selector,operationId:id,expectedFingerprint:sha,sourceIds:z.array(text).min(1).max(30)}),false],
 ['ar_create_proposal_context','Read the existing prepared context and freshness for one exact native piece request. Local paths and media bytes are not sent.',z.strictObject({selector,requestId:id}),true],
 ['ar_create_stage_proposal','Stage plain paragraph replacements under current owner guards; never accepts, rejects, protects or finishes. Proposal remains pending app review.',z.strictObject({selector,operationId:id,requestId:id,expectedFingerprint:sha,replacements:z.array(z.strictObject({id:text,words:z.string().min(1).max(12000)})).min(1).max(30)}),false],
 ['ar_create_changes','Poll only one granted project change scope, oldest-first with bootId. On reset reread current work; use current-work reads for native/output changes too.',z.strictObject({parentStudyId:text,since:z.number().int().min(0).optional(),bootId:id.optional(),limit:z.number().int().min(1).max(200).optional()}),true],
];
export const REMOTE_TOOLS=Object.freeze(toolDefinitions.map(([name])=>name));
const PRIVATE_KEYS=new Set(['path','paths','sourcePath','copiedPath','draftPath','localPath','filePath','absolutePath','rootPath','vaultRoot','filesRoot','dataDir','homeDir','unscopedQuestionCount','canStandInReview','canStandInContracts']);
/** Remove technical host locations, not authored text. Existing selected source
 * quotations and personal words remain byte-exact within the approved project. */
export function remoteView(value){
 if(Array.isArray(value))return value.map(remoteView);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([k])=>!PRIVATE_KEYS.has(k)).map(([k,v])=>[k,remoteView(v)]));
}
const media={delivery:'references-only',bytesAvailable:false,reason:'This connector does not transfer original media or exports. Open them in the local app; the Mac must be online.'};
export function createScopedTools({ownerUrl,stateDir,principal,assertActive=()=>principal,fetchImpl=fetch}){
 if(!['agent:claude-code','agent:chatgpt'].includes(principal?.actor)||!Array.isArray(principal.projectIds)||!Array.isArray(principal.tools)||principal.tools.some(t=>!REMOTE_TOOLS.includes(t)))throw Error('Configure an explicit supported agent, projects and tool allowlist.');
 const client=createClient({url:ownerUrl,actor:principal.actor,client:'mcp',fetchImpl}),once=createReplay({stateDir});
 async function active(){const current=await assertActive();if(current.id!==principal.id||stable(current)!==stable(principal))fail('The connection grant changed. Authorize the new grant before continuing.',401,'invalid_token');}
 async function owner(method,route,input){
  await active();let response;
  try{response=await client.request(method,route,input);}catch{fail('The authoritative workspace is offline or unavailable. Keep the original operation ID and prepared words; do not assume the write failed.',503,'owner_unavailable');}
  if(!response.ok){const status=[400,403,404,409,413,423].includes(response.status)?response.status:503;const code={403:'owner_forbidden',404:'owner_unavailable',409:'stale_owner',423:'owner_held',413:'owner_limit'}[status]||'owner_refused';fail(status===409?'The authoritative work changed. Keep both contributions, reread and deliberately prepare a new request.':status===423?'The owner is held. Read current work and resolve the existing hold in the app.':'The owner refused or could not complete this bounded action.',status,code);}
  return response.body;
 }
 function scope(projectId){if(!principal.projectIds.includes(projectId))fail('This connection has no access to that project.',403,'scope_forbidden');}
 async function packet(selected){scope(selected.parentStudyId);return owner('POST','/api/current-work/read',{selector:selected});}
 async function native(selected,current){
  if(!selected.outputId||!selected.rootBindingId||!current.piece?.wordOwner?.bindingId)fail('Choose a supported exact native piece from current work.',409,'native_piece_required');
  const binding={parentStudyId:selected.parentStudyId,bindingId:current.piece.wordOwner.bindingId};
  const read=await owner('GET','/api/study-ai/read?'+new URLSearchParams(binding));
  if(read.binding?.id!==binding.bindingId||read.binding?.parentStudyId!==binding.parentStudyId)fail('The owner no longer resolves this exact piece.',409,'scope_changed');
  return {binding,read};
 }
 async function fresh(selected,fingerprint){const current=await packet(selected);if(current.readConsistency?.status!=='stable-reread'||current.fingerprint!==fingerprint)fail('Context changed. Reread current work; the proposed words have not been applied.',409,'context_changed');return current;}
 function result(value){const clean=remoteView(value);if(Buffer.byteLength(JSON.stringify(clean))>2*1024*1024)fail('Selected context exceeds the remote response bound. Narrow the work in the app.',413,'context_too_large');return clean;}
 return {
  definitions:()=>toolDefinitions.filter(([name])=>principal.tools.includes(name)),
  async call(name,input={}){
   await active();const definition=toolDefinitions.find(([n])=>n===name);
   if(!definition||!principal.tools.includes(name))fail('This operation is not granted to this connection.',403,'tool_forbidden');
   const parsed=definition[2].safeParse(input);if(!parsed.success)fail('Use only the published tool fields and bounded valid values.',400,'invalid_arguments');const args=parsed.data;
   if(name==='ar_create_projects')return {schema:'ar-create.remote-projects.v1',projects:principal.projectIds.map(parentStudyId=>({parentStudyId})),principal:{id:principal.id,actor:principal.actor},authority:{authenticatedHuman:false,mayApply:false},media};
   const projectId=args.selector?.parentStudyId||args.target?.parentStudyId||args.parentStudyId;scope(projectId);
   if(name==='ar_create_current_work'){
    const current=await packet(args.selector);let proposalContext=null;
    if(args.selector.outputId&&current.piece?.wordOwner?.bindingId){const n=await native(args.selector,current);proposalContext={bindingId:n.binding.bindingId,expected:n.read.expected,paragraphs:n.read.projection.map(({id,words,blockHash,proposalEditable})=>({id,words,blockHash,proposalEditable})),sourceCatalog:(n.read.context?.records||[]).map(({id,role,missing,copiedHash})=>({id,role,missing:!!missing,hash:copiedHash}))};}
    return result({...current,proposalContext,remote:{principalId:principal.id,actor:principal.actor,media,review:{available:false,reason:'Acceptance and Finish require the existing app. No authenticated remote human review is implemented.'}}});
   }
   if(name==='ar_create_validate_work')return result(await owner('POST','/api/current-work/validate',args));
   if(name==='ar_create_changes')return result(await owner('GET','/api/events/since?'+new URLSearchParams({kind:'project',id:projectId,since:String(args.since??0),limit:String(args.limit??100),...(args.bootId?{bootId:args.bootId}:{})})));
   if(name==='ar_create_proposal_context'){
    const current=await packet(args.selector),n=await native(args.selector,current),q=new URLSearchParams({...n.binding,requestId:args.requestId});
    const review=await owner('GET','/api/study-ai/review?'+q),context=await owner('GET','/api/study-ai/context?'+q);return result({review,context,media,mayApply:false});
   }
   return once({principalId:principal.id,tool:name,operationId:args.operationId,projectId,input:args},async()=>{
    if(name==='ar_create_capture_contribution'){
     // Principal namespace prevents another authorized connection from claiming
     // this upstream origin. Reported IDs remain explicitly unverified.
     const reported=args.origin,origin={...reported,provider:principal.provider,client:principal.client,...(reported.conversationId?{conversationId:principal.id+':'+reported.conversationId}:{}),...(reported.captureId?{provider:principal.provider+':'+principal.id}:{})};
     const receipt=await owner('POST','/api/conversation/capture',{...args,origin});
     return result({schema:'ar-create.remote-capture.v1',operationId:args.operationId,receiptId:receipt.id,status:receipt.status,authority:{authenticatedHuman:false,mayApply:false},origin:{reported,carrierPrincipal:principal.id,ownerOrigin:origin},ownerOperationId:receipt.ownerOperationId||null});
    }
    if(name==='ar_create_save_preparation'){
     const before=await owner('GET','/api/concept?'+new URLSearchParams({parentStudyId:projectId}));
     if(before.revision!==args.expected.revision||before.hash!==args.expected.hash)fail('The concept changed. Keep this preparation and reread before a deliberate new request.',409,'stale_owner');
     const saved=await owner('POST','/api/concept/save',{parentStudyId:projectId,operationId:args.operationId,expectedRevision:args.expected.revision,expectedHash:args.expected.hash,authorThoughts:before.authorThoughts,adoptedDirection:before.adoptedDirection,aiInterpretation:args.interpretation,suggestions:args.suggestions,sourceSelections:before.sourceSelections});
     return {schema:'ar-create.remote-preparation.v1',operationId:args.operationId,status:'saved-provisional',revision:saved.revision,hash:saved.hash,mayApply:false};
    }
    const current=await fresh(args.selector,args.expectedFingerprint),n=await native(args.selector,current);
    if(name==='ar_create_prepare_proposal'){
     const allowed=new Set((n.read.context?.records||[]).filter(r=>!r.missing&&['source','context','research','brief','notes','map','plan'].includes(r.role)).map(r=>r.id));
     if(args.sourceIds.some(id=>!allowed.has(id)))fail('Select retained sources of this exact native piece; arbitrary Library IDs are not granted.',403,'source_forbidden');
     const prepared=await owner('POST','/api/study-ai/prepare?'+new URLSearchParams(n.binding),{sourceIds:args.sourceIds});
     if(stable(prepared.expected)!==stable(n.read.expected))fail('The native owner changed while context was captured. Inspect current work; this remote operation will not run again.',409,'context_changed');
     return {schema:'ar-create.remote-proposal.v1',operationId:args.operationId,requestId:prepared.id,status:'prepared',mayApply:false};
    }
    const q=new URLSearchParams({...n.binding,requestId:args.requestId}),review=await owner('GET','/api/study-ai/review?'+q);
    if(review.stale||review.status!=='prepared')fail('This proposal is no longer an undecided current preparation. Read its owner before continuing.',409,'proposal_held');
    await owner('POST','/api/study-ai/propose?'+new URLSearchParams(n.binding),{requestId:args.requestId,replacements:args.replacements});
    return {schema:'ar-create.remote-proposal.v1',operationId:args.operationId,requestId:args.requestId,status:'proposed-awaiting-app-review',mayApply:false};
   });
  },
 };
}
