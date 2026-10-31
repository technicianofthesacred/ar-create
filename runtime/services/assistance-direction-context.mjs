import {createHash} from 'node:crypto';
const HASH=/^[a-f0-9]{64}$/;
const copy=value=>structuredClone(value);
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const same=(a,b)=>stable(a)===stable(b);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const key=value=>stable(value);
function requestOf(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['scopes','selectedScope','piece','manuscript','absentParts'].includes(k))||!!input.piece===!!input.manuscript||input.piece&&(Object.keys(input.piece).length!==3||!['rootBindingId','parentStudyId','selectedOutputId'].every(k=>typeof input.piece[k]==='string'))||input.manuscript&&(Object.keys(input.manuscript).length!==2||!['bindingId','parentStudyId'].every(k=>typeof input.manuscript[k]==='string')))fail('Supply only exact Direction selectors and either a registered native Piece or pre-output manuscript owner; caller text and word snapshots are refused.',400);
 return copy(input);
}
function proof(record){
 if(!['current','empty'].includes(record.status)||!record.scope||!record.stableUUID||!HASH.test(record.hash||'')||!Number.isSafeInteger(record.revision)||record.revision<0||record.revision>0&&!HASH.test(record.metadataHash||''))fail('A Direction origin is unavailable, changed or lacks its exact metadata proof.');
 if((record.sourceReferences||[]).some(r=>r.status!=='current-reference'))fail('A Direction source reference changed or is unavailable.');
 if(record.selector.scope==='collection'&&!HASH.test(record.library?.indexHash||''))fail('The exact Collection catalog proof is unavailable.');
 return {selector:copy(record.selector),scope:copy(record.scope),stableUUID:record.stableUUID,status:record.status,revision:record.revision,hash:record.hash,metadataHash:record.metadataHash??null,role:record.contributions?.role??null,library:copy(record.library??null),sourceReferences:copy(record.sourceReferences||[])};
}
/** Read-only assistance capture over the maintained resolver. This is neither
 * application authority nor an atomic multi-owner read/transaction lease. */
export function createAssistanceDirectionContext({resolver,humanDirection,collectionDirection=humanDirection,library,drafts}={}){
 if(typeof resolver?.resolve!=='function')throw TypeError('Supply the existing current-understanding resolver.');
 async function capture(input){
  const request=requestOf(input),{manuscript,absentParts=[],...resolverRequest}=request,view=await resolver.resolve(manuscript?{...resolverRequest,manuscript}:resolverRequest);
  if(view.schema!=='ar-create.current-understanding.projection.v1'||view.readConsistency?.status!=='stable-reread'||!['current','empty'].includes(view.status)||!view.current||view.selection?.mode!=='explicit-scope')fail('Exact Direction selection is unavailable, ambiguous or changed during reading.');
  let piece=manuscript?view.nativeManuscript:view.piece;
  if(manuscript){
   if(typeof drafts?.read!=='function')fail('Exact native manuscript owner is unavailable.');const owned=await drafts.read(manuscript),target=view.records.find(r=>same(r.selector,request.selectedScope));
   if(owned.binding?.id!==manuscript.bindingId||owned.binding.parentStudyId!==manuscript.parentStudyId||owned.binding.authority!=='owned-working-copy'||owned.binding.status!=='ready'||!owned.readiness?.ready||owned.binding.canonicalOutputId||target?.scope?.kind!=='part'||target.scope.bindingId!==manuscript.bindingId||target.scope.parentStudyId!==manuscript.parentStudyId||request.scopes.some(s=>s.scope==='output'||s.scope==='part'&&s.bindingId!==manuscript.bindingId||s.parentStudyId!==manuscript.parentStudyId))fail('Pre-output manuscript context needs its exact ready native part and physical Project/document; registered outputs require exact Piece mode.');
   if(piece?.status!=='current'||piece.scope?.projectId!==target.scope.projectId||piece.scope?.documentId!==target.scope.documentId)fail('Maintained native manuscript scope resolution is unavailable.');
  }
  if(piece?.status!=='current'||piece.words?.status!=='current'||!same(piece.selector,request.piece||request.manuscript)||!piece.wordOwner||!piece.scope)fail('The exact registered Piece and its current owner are unavailable.');
  const absent=[];if(!Array.isArray(absentParts)||absentParts.length>1)fail('Use at most one exact absent native part guard.');
  for(const selector of absentParts){if(!selector||Object.keys(selector).sort().join(',')!=='bindingId,parentStudyId,scope'||selector.scope!=='part'||selector.parentStudyId!==piece.scope.parentStudyId||piece.wordOwner.kind!=='native'||selector.bindingId!==piece.wordOwner.bindingId||request.scopes.some(s=>same(s,selector))||typeof humanDirection?.read!=='function')fail('Absent Direction guard does not belong to this exact native child.');const record=await humanDirection.read(selector);if(record.scope!==null||record.bound!==false||record.revision!==0||record.hash!==hash('')||record.metadataHash!=null)fail('The previously absent native part Direction now has an owner. Prepare current context.');absent.push({reader:'humanDirection.read',input:copy(selector),expected:{scope:null,revision:0,hash:hash(''),metadataHash:null}});}
  const refs=view.scopeReferences;
  if(refs?.status!=='read'||!Array.isArray(refs.references)||!Array.isArray(refs.effective)||refs.reads.some(r=>r.status!=='read'))fail('Exact Direction reference reads are unavailable.');
  if(refs.references.some(r=>r.status==='accepted'&&(r.review?.needed!==false||r.resolverReview)))fail('An accepted Direction origin/reference changed or is unavailable; preserve the proposal for review.');
  const records=[],bySelector=new Map();
  for(const raw of [...view.records,...refs.origins]){
   const record=proof(raw),id=key(record.selector),prior=bySelector.get(id);
   if(prior){if(!same(prior,record))fail('A Direction selector has ambiguous origin or metadata identity.');continue;}
   if(record.selector.scope!=='collection'&&record.selector.parentStudyId!==piece.scope.parentStudyId)fail('Direction belongs to another Piece parent.');
   if(record.selector.scope==='output'&&(record.scope.outputId!==piece.scope.outputId||record.scope.projectId!==piece.scope.projectId||record.scope.documentId!==piece.scope.documentId||record.scope.bindingId!==piece.scope.rootBindingId))fail('Output Direction does not belong to the exact physical Piece.');
   if(record.selector.scope==='part'&&![piece.scope.rootBindingId,piece.wordOwner.bindingId].includes(record.selector.bindingId))fail('Part Direction belongs to another native owner.');
   bySelector.set(id,record);records.push(record);
  }
  const resolutions=copy(view.assistance?.scopeResolutionByTarget);
  if(!Array.isArray(resolutions)||!resolutions.length)fail('The maintained resolver did not provide target resolution records.');
  const instructions=[],instructionIds=new Map();
  const add=entry=>{const id=hash({target:entry.target,scope:entry.sourceRecord.scope,locator:entry.locator,text:entry.text}),prior=instructionIds.get(id);if(prior){prior.referenceIds=[...new Set([...prior.referenceIds,...entry.referenceIds])].sort();prior.bases=[...new Set([...prior.bases,...entry.bases])].sort();return;}instructionIds.set(id,entry);instructions.push(entry);};
  for(const resolution of resolutions){
   // These flags and fields are the resolver's exact override decision. No new
   // precedence, semantic comparison or default Collection inheritance is made.
   for(const field of resolution.ordinaryDirections||[]){
    if(field.supersededHereBy?.length)continue;
    const record=bySelector.get(key(field.selector));if(!record||!same(record.scope,field.scope)||record.revision!==field.revision||record.hash!==field.hash)fail('Ordinary Direction field has no matching exact owner proof.');
    add({target:copy(resolution.target),role:'human-authored-editorial-direction-not-evidence-or-source-quotation',text:field.text,sourceRecord:copy(record),locator:{kind:'field',name:field.field,hash:hash(field.text)},referenceIds:[],bases:['ordinary-scope']});
   }
  }
  for(const effective of refs.effective.filter(r=>r.kind!=='linked-learning'))add({target:copy(effective.target),role:effective.role,text:effective.text,sourceRecord:copy(effective.sourceRecord),origin:copy(effective.origin),locator:copy(effective.locator),referenceIds:[effective.referenceId],bases:[effective.applicability]});
  const background=copy(refs.effective.filter(r=>r.kind==='linked-learning'));
  const references=refs.references.map(({readTarget,resolverReview,...owner})=>({target:copy(readTarget),record:copy(owner)}));
  const guards={
   records:[...records.map(r=>({reader:r.selector.scope==='collection'?'collectionDirection.read':'humanDirection.read',input:copy(r.selector),expected:{scope:copy(r.scope),revision:r.revision,hash:r.hash,metadataHash:r.metadataHash}})),...absent],
   references:refs.reads.map(r=>({reader:'humanDirection.readScopeReferences',input:{target:copy(r.target)},expected:{scope:copy(r.scope),revision:r.revision,hash:r.hash,metadataHash:r.metadataHash,referencesHash:hash(references.filter(x=>same(x.target,r.target)).map(x=>x.record))}})),
   collections:records.filter(r=>r.library).map(r=>({reader:'library.collectionsSnapshot',input:{},expected:copy(r.library)})),
   sources:records.flatMap(r=>r.sourceReferences.map(s=>({reader:'library.snapshot',args:[s.sourceId,{includeBody:true}],expected:{id:s.sourceId,hash:s.sourceHash,start:s.start,end:s.start+s.quote.length,quoteHash:hash(s.quote)}}))),
   pieceOwner:{selector:copy(piece.selector),scope:copy(piece.scope),kind:piece.kind,wordOwner:copy(piece.wordOwner)},
   enforcement:'Re-read these exact maintained owners and compare their guards at the writer boundary. Existing Piece/CAS/lease guards remain separate; this capture does not provide a cross-owner transaction lease or guessed file paths.'
  };
  const unresolved=resolutions.some(r=>r.status==='unresolved-overlap'),dependencies={request,pieceOwner:guards.pieceOwner,records,references,resolutions,instructions,background,guards,coverage:copy(view.dependencyCoverage)};
  return {schema:'ar-create.assistance-direction-context.v1',role:'captured-editorial-context-not-evidence-approved-prose-or-application-authority',request,records,references,instructions,background,resolutions,guards,dependencyCoverage:copy(view.dependencyCoverage),fingerprint:hash(dependencies),acceptance:{ready:!unresolved,reason:unresolved?'Current Direction overlap is unresolved. Preparation may retain alternatives; acceptance must wait for the maintained owner to resolve it.':'Direction records and explicit resolver resolution are current. Existing target and final-transaction guards remain required.'},mayApply:false};
 }
 async function assertCurrent(input){
  if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['request','expectedFingerprint'].includes(k))||!HASH.test(input.expectedFingerprint||''))fail('Use the exact selector request and captured Direction fingerprint only.',400);
  const current=await capture(input.request);if(current.fingerprint!==input.expectedFingerprint)fail('Captured Direction, inheritance or override metadata changed; preserve proposed and human wording.');if(!current.acceptance.ready)fail(current.acceptance.reason);return current;
 }
 async function captureForBinding(binding){
  if(typeof drafts?.read!=='function')fail('Native manuscript Direction ownership is unavailable.');const current=await drafts.read(binding),owner=current.binding;if(owner?.id!==binding.bindingId||owner.parentStudyId!==binding.parentStudyId||owner.authority!=='owned-working-copy'||!current.readiness?.ready)fail('Exact native manuscript binding changed.');
  const project={scope:'project',parentStudyId:binding.parentStudyId},part={scope:'part',parentStudyId:binding.parentStudyId,bindingId:binding.bindingId};
  if(!owner.canonicalOutputId)return capture({scopes:[project,part],selectedScope:part,manuscript:copy(binding)});
  const rootBindingId=owner.sourceBindingId||binding.bindingId,root={scope:'part',parentStudyId:binding.parentStudyId,bindingId:rootBindingId},output={scope:'output',parentStudyId:binding.parentStudyId,bindingId:rootBindingId,outputId:owner.canonicalOutputId};
  const independent=rootBindingId!==binding.bindingId,partRecord=independent?await humanDirection.read(part):null,absentPart=independent&&partRecord.bound===false&&partRecord.scope===null;const result=await capture({scopes:[project,...(!independent?[root]:!absentPart?[part]:[]),output],...(absentPart?{absentParts:[part]}:{}),selectedScope:output,piece:{rootBindingId,parentStudyId:binding.parentStudyId,selectedOutputId:owner.canonicalOutputId}});
  if(result.guards.pieceOwner.wordOwner.bindingId!==binding.bindingId)fail('Registered Piece has another native wording owner.');return result;
 }
 async function captureWriteGuard(captured){
  const current=await assertCurrent({request:captured.request,expectedFingerprint:captured.fingerprint}),g=current.guards,checks=[];
  for(const [owner,records]of [[humanDirection,g.records.filter(r=>r.reader==='humanDirection.read')],[collectionDirection,g.records.filter(r=>r.reader==='collectionDirection.read')]]){
   if(!records.length&&owner!==humanDirection)continue;if(typeof owner?.captureReadGuard!=='function')fail('Direction owner final-read guard is unavailable.');checks.push(await owner.captureReadGuard({records,references:owner===humanDirection?g.references:[]}));
  }
  if(g.collections.length||g.sources.length){if(typeof library?.captureReadGuard!=='function')fail('Library final-read guard is unavailable.');checks.push(await library.captureReadGuard({collections:g.collections,sources:g.sources}));}
  // Recheck the full resolver after asynchronous guard preparation, before any
  // writer queue. Final publication uses only the synchronous owner capabilities.
  await assertCurrent({request:captured.request,expectedFingerprint:captured.fingerprint});const validate=()=>{for(const guard of checks){const checked=guard.validate();if(checked&&typeof checked.then==='function')fail('Owner final-read guard must be synchronous.');}};validate();return Object.freeze({validate});
 }
 return {capture,assertCurrent,captureForBinding,captureWriteGuard};
}
