import {createHash} from 'node:crypto';
const HASH=/^[a-f0-9]{64}$/;
const copy=value=>structuredClone(value);
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const same=(a,b)=>stable(a)===stable(b);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const key=value=>stable(value);
function requestOf(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['scopes','selectedScope','piece'].includes(k))||!input.piece||Object.keys(input.piece).length!==3||!['rootBindingId','parentStudyId','selectedOutputId'].every(k=>typeof input.piece[k]==='string'))fail('Supply only explicit Direction selectors, selection and the exact native Piece tuple; caller text and word snapshots are refused.',400);
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
export function createAssistanceDirectionContext({resolver}={}){
 if(typeof resolver?.resolve!=='function')throw TypeError('Supply the existing current-understanding resolver.');
 async function capture(input){
  const request=requestOf(input),view=await resolver.resolve(request);
  if(view.schema!=='ar-create.current-understanding.projection.v1'||view.readConsistency?.status!=='stable-reread'||!['current','empty'].includes(view.status)||!view.current||view.selection?.mode!=='explicit-scope')fail('Exact Direction selection is unavailable, ambiguous or changed during reading.');
  const piece=view.piece;
  if(piece?.status!=='current'||piece.words?.status!=='current'||!same(piece.selector,request.piece)||!piece.wordOwner||!piece.scope)fail('The exact registered Piece and its current owner are unavailable.');
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
   records:records.map(r=>({reader:r.selector.scope==='collection'?'collectionDirection.read':'humanDirection.read',input:copy(r.selector),expected:{scope:copy(r.scope),revision:r.revision,hash:r.hash,metadataHash:r.metadataHash}})),
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
 return {capture,assertCurrent};
}
