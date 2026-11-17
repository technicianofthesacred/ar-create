import {fields,text,UUID,HASH,digest,fail} from './conversation-origin.mjs';
import {readDirectionChoices,effectiveDirectionChoices} from '../../public/lib/direction-choice.js';
/** A disposable projection, never a summary write or a replacement wording authority. */
export function createCurrentWork({concepts,direction,boards,library,understanding,studyAI,presence,continuity,captures,needs}){
 function selector(v){fields(v,['parentStudyId'],['rootBindingId','outputId']);text(v.parentStudyId,'parentStudyId');if((v.rootBindingId!==undefined||v.outputId!==undefined)&&(!UUID.test(v.rootBindingId||'')||!UUID.test(v.outputId||'')))fail('A piece needs both its exact rootBindingId and outputId.');return structuredClone(v);}
 async function once(selected){
  const parentStudyId=selected.parentStudyId,concept=await concepts.snapshot({parentStudyId}),author=await direction.read({parentStudyId,scope:'project'}),board=await boards.read({subject:parentStudyId});
  // No collections() refresh on this read path: use the maintained snapshot owner.
  const catalog=await library.collectionsSnapshot(),collection=(catalog.collections||[]).find(c=>c.id===board.collectionId)||null,texts=[],sourceGaps=[];
  for(const sourceId of (collection?.sourceIds||[]).slice(0,40)){try{const source=await library.snapshot(sourceId,{includeBody:true});if(typeof source.text==='string')texts.push({sourceId,hash:source.hash,text:source.text.slice(0,32768),truncated:source.text.length>32768,provenance:source.provenance||null});}catch(error){sourceGaps.push({sourceId,status:'unavailable',reason:error.message});}}
  const material={groups:board.groups,texts,collection,operations:board.intakeOperations||[]};
  // Preserve the existing blocks field while including the board's other saved
  // human intention and its owner guards in the disposable context fingerprint.
  const boardContext={subject:board.subject,title:board.title,revision:board.revision,hash:board.hash,links:board.links,forming:board.forming};
  const request={scopes:[{selector:{scope:'project',parentStudyId}}],selectedScope:{scope:'project',parentStudyId},...(selected.outputId?{piece:{parentStudyId,rootBindingId:selected.rootBindingId,selectedOutputId:selected.outputId}}:{})};
  let understandingView=await understanding.resolve(request);
  if(selected.outputId&&understandingView.piece?.status!=='current')fail('This selected output is not current and uniquely owned by this subject/root.',409);
  const bindingId=understandingView.piece?.wordOwner?.bindingId||null,gaps=[...sourceGaps];
  let proposals=null,contracts=null;
  if(selected.outputId){
   request.scopes.push({selector:{scope:'output',parentStudyId,outputId:selected.outputId,bindingId:selected.rootBindingId}});
   if(bindingId)request.scopes.push({selector:{scope:'part',parentStudyId,bindingId}});
   // The initial projection resolved the exact owner. Read its proposal state
   // alongside the expanded projection, then confirm the owner before returning either.
   const readProposalState=async()=>{
    if(!bindingId)return {gap:{owner:'native-proposals',status:'not-applicable-or-unavailable',reason:'This output has no native paragraph owner; no Article contracts are borrowed.'}};
    let proposals=null;
    try{
     proposals=await studyAI.call('list',{parentStudyId,bindingId});
     return {proposals,contracts:await studyAI.call('contracts',{parentStudyId,bindingId})};
    }catch(error){
     return {proposals,gap:{owner:'native-proposals',status:'unavailable',reason:error.message}};
    }
   };
   const [expanded,proposalState]=await Promise.all([understanding.resolve(request),readProposalState()]);
   if(expanded.piece?.status!=='current'||(expanded.piece?.wordOwner?.bindingId||null)!==bindingId)fail('The selected piece owner changed during this read.',409);
   understandingView=expanded;
   proposals=proposalState.proposals??null;
   contracts=proposalState.contracts??null;
   if(proposalState.gap)gaps.push(proposalState.gap);
  }
  const scope=selected.outputId?{kind:'piece',parentStudyId,rootBindingId:selected.rootBindingId,outputId:selected.outputId}:{kind:'project',parentStudyId};
  let work=null;try{work=await continuity.read({scope});}catch(error){gaps.push({owner:'work-continuity',status:'unavailable',reason:error.message});}
  const allAsks=needs.peek().asks,ids=[parentStudyId,selected.outputId,bindingId].filter(Boolean),asks=allAsks.filter(a=>a.scope&&ids.includes(a.scope.id));
  const live=presence.list().presence.filter(p=>ids.includes(p.scope.id));
  const records=captures.list(parentStudyId),choices=readDirectionChoices(author.body),effective=effectiveDirectionChoices(author.body,{...(bindingId?{bindingId}:{}),...(selected.outputId?{outputId:selected.outputId}:{})});
  const packet={schema:'ar-create.current-work.v1',selector:selected,authority:{projection:true,mayApply:false,authenticatedHuman:false},intent:{revision:concept.revision,hash:concept.hash,body:concept.body,authorThoughts:concept.authorThoughts,adoptedDirection:concept.adoptedDirection,agentInterpretation:concept.aiInterpretation,unadoptedSuggestions:concept.suggestions},decisions:{choices,effective,contractHash:contracts?.hash||null,protections:contracts?.protections||[],rejectedProposals:contracts?.rejections||[],pieceGuidance:contracts?.pieceGuidance||[],coverage:bindingId?(contracts?'native-contracts-read':'native-contracts-unavailable'):'project-direction-only'},contributions:{captures:records,board:material.groups,boardContext,sourceTexts:material.texts,coverage:{completeConversation:false,captured:records.length?'selected-excerpts':'no-origin-captures',missing:'Unsupplied chat messages and older records without origin metadata remain unobserved.'}},sources:{selected:concept.sourceSelections||[],freshness:concept.sourceConnections||[],collection:material.collection,collectionIndex:{revision:catalog.revision,hash:catalog.indexHash},coverage:{kind:'recorded-links-only',limit:40,omittedCount:Math.max(0,(collection?.sourceIds?.length||0)-40)}},understanding:understandingView,piece:understandingView.piece||null,pending:{proposals,questions:asks,unscopedQuestionCount:allAsks.filter(a=>!a.scope).length,operations:material.operations||[],assignments:work?.data?.assignments||[]},presence:{observed:live.map(({lastSeen,...r})=>r),scopeCoverage:ids,limitation:'Presence expires; no reported editor does not prove that every client is clean.'},continuity:work,gaps,nextPermittedActions:[{action:'read-current-work',allowed:true},{action:'capture-exact-contribution',allowed:true},{action:'prepare-proposal',allowed:!!bindingId&&!!contracts&&!gaps.length&&!live.some(p=>p.dirty)&&understandingView.piece?.words?.status==='current'&&understandingView.readConsistency?.status==='stable-reread'&&understandingView.assistance?.scopeResolution!=='unresolved-overlap',requires:'Fresh owner guards and complete selected-source context; this packet is not write authority.'},{action:'accept-or-finish',allowed:false,requires:'Existing app human action; no authenticated remote approval mechanism is implemented.'}]};
  const fingerprint=digest(packet);return {...packet,fingerprint};
 }
 async function read(input){fields(input,['selector']);const selected=selector(input.selector);let before=await once(selected);for(let attempt=0;attempt<2;attempt++){const after=await once(selected);if(before.fingerprint===after.fingerprint)return {...after,readConsistency:{status:'stable-reread',reads:attempt+2}};before=after;}const {fingerprint,...changed}=before;changed.nextPermittedActions=[{action:'reread-current-work',allowed:true}];return {...changed,fingerprint:digest(changed),readConsistency:{status:'changed-during-read',reads:3}};}
 async function validate(input){fields(input,['selector','expectedFingerprint','preparedText']);if(!HASH.test(input.expectedFingerprint||''))fail('Use the current-work fingerprint captured during preparation.');if(typeof input.preparedText!=='string'||input.preparedText.length>200000)fail('Keep bounded prepared text unchanged.');const current=await read({selector:input.selector}),unchanged=current.readConsistency.status==='stable-reread'&&current.fingerprint===input.expectedFingerprint;return {schema:'ar-create.current-work-validation.v1',status:unchanged?'current-target-guards-required':'held-context-changed',mayApply:false,preparedText:input.preparedText,current,reason:unchanged?'Owner write guards and authority still apply.':'Preserve this preparation and current app words; reread and deliberately prepare again.'};}
 return {read,validate};
}
