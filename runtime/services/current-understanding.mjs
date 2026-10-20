import {createHash} from 'node:crypto';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const ROLE='human-authored-editorial-direction-not-evidence-or-source-quotation';
const copy=value=>structuredClone(value);
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const digest=value=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
const equal=(a,b)=>stable(a)===stable(b);
const readable=value=>typeof value==='string'&&value.trim()&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value);
const fail=message=>{throw Object.assign(Error(message),{status:400});};
function selector(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Use an explicit maintained scope selector.');
 const keys=Object.keys(input);
 if(input.scope==='collection'){
  if(keys.some(key=>!['scope','collectionId'].includes(key))||!UUID.test(input.collectionId||''))fail('Collection selector requires only its actual Library UUID.');
  return {scope:'collection',collectionId:input.collectionId};
 }
 if(!['project','part','output'].includes(input.scope)||!readable(input.parentStudyId)||keys.some(key=>!['scope','parentStudyId','bindingId','outputId'].includes(key)))fail('Use an explicit maintained project/part/output selector.');
 if(input.scope==='project'&&(input.bindingId!==undefined||input.outputId!==undefined)||input.scope==='part'&&(!UUID.test(input.bindingId||'')||input.outputId!==undefined)||input.scope==='output'&&(!UUID.test(input.outputId||'')||input.bindingId!==undefined&&!UUID.test(input.bindingId)))fail('Scope selector contains a missing or conflicting owned identity.');
 return {scope:input.scope,parentStudyId:input.parentStudyId,...(input.bindingId?{bindingId:input.bindingId}:{}),...(input.outputId?{outputId:input.outputId}:{})};
}
function scopeMatches(wanted,actual){return actual?.kind===wanted.scope&&(wanted.scope==='collection'?actual.collectionId===wanted.collectionId:actual.parentStudyId===wanted.parentStudyId&&actual.bindingId===wanted.bindingId&&actual.outputId===wanted.outputId&&UUID.test(actual.projectId||'')&&UUID.test(actual.documentId||''));}
const carouselToken=expected=>({projectId:expected?.projectId,documentId:expected?.documentId,outputId:expected?.outputId,outputHash:expected?.outputHash,markdownHash:expected?.markdownHash});
const pinMatches=(expected,record)=>!expected||expected.revision===record.revision&&expected.hash===record.hash;
function attribution(record,project){
 if(typeof project!=='function')return {status:'unknown',role:record.role,field:'body',gap:'Inject maintained conceptContextProjection to distinguish mixed concepts from ordinary direction.'};
 const projected=project(record.body);
 if(projected===null)return record.role===ROLE?{status:'ordinary-editorial-direction',adoptedDirection:record.body,role:ROLE,field:'body',publicationApproval:'not-established'}:{status:'unknown',role:record.role,field:'body'};
 if(projected?.sourceSnapshot?.body!==record.body||projected.sourceSnapshot.hash!==record.hash)return {status:'unknown',role:record.role,field:'body',gap:'Maintained attribution projection does not match the exact full body.'};
 return {status:'owner-projected',role:projected.role,attribution:projected.attribution,adoptedDirection:projected.body,personalThoughts:projected.personalThoughts?.body??null,agentProposed:projected.aiInterpretation?.body??null,unadoptedSuggestions:projected.suggestions?.body??null,unclassified:projected.unclassifiedMixedContent?.body??null,sourceReferences:copy(projected.libraryReferences?.records||[]),publicationApproval:'not-established',field:'body',sourceSnapshot:copy(projected.sourceSnapshot)};
}
/** Disposable read projection. No filesystem, source refresh, body writes, provider or persistent state. */
export function createCurrentUnderstandingResolver({library,humanDirection,collectionDirection,nativeOutputs,nativeWords,carouselWords,conceptContextProjection,workReferences}={}){
 async function references(contributions){
  const results=[];
  for(const reference of contributions.sourceReferences||[]){
   const base={...copy(reference),factualSupport:'not-established'};
   if(!UUID.test(reference.sourceId||'')||!HASH.test(reference.sourceHash||'')||!Number.isSafeInteger(reference.start)||reference.start<0||typeof reference.quote!=='string'){results.push({...base,status:'invalid-reference'});continue;}
   if(typeof library?.snapshot!=='function'){results.push({...base,status:'unavailable',gap:'Maintained no-refresh Library.snapshot is unavailable.'});continue;}
   try{const source=await library.snapshot(reference.sourceId,{includeBody:true});const valid=source?.id===reference.sourceId&&HASH.test(source.hash||'');results.push({...base,status:valid&&source.hash===reference.sourceHash&&typeof source.text==='string'&&source.text.slice(reference.start,reference.start+reference.quote.length)===reference.quote?'current-reference':'stale',currentHash:valid?source.hash:null});}catch(error){results.push({...base,status:'unavailable',gap:error.message});}
  }
  return results;
 }
 async function readRecord(entry){
  const wanted=entry.selector,base={selector:copy(wanted),sourceRecordKind:'human-direction',status:'unavailable',scope:null,stableUUID:null,revision:null,hash:null,body:null,contributions:{status:'unknown'}};
  let reader=humanDirection;
  if(wanted.scope==='collection'){
   if(typeof library?.collectionsSnapshot!=='function')return {...base,gap:'Library.collectionsSnapshot is absent: collections() refreshes sources and is intentionally not called.'};
   const catalog=await library.collectionsSnapshot(),rows=catalog?.collections?.filter(row=>row.id===wanted.collectionId);
   if(!Number.isSafeInteger(catalog?.revision)||!rows||rows.length!==1||!Array.isArray(rows[0].sourceIds))return {...base,status:'missing',gap:'Exact Collection UUID is absent or ambiguous in the maintained no-refresh Library catalog.'};
   Object.assign(base,{label:rows[0].name??null,library:{revision:catalog.revision,indexHash:HASH.test(catalog.indexHash||'')?catalog.indexHash:null,collectionId:rows[0].id,sourceIds:copy(rows[0].sourceIds)},stableUUID:rows[0].id});
   if(typeof collectionDirection?.read!=='function')return {...base,gap:'Bind maintained 38fa Collection direction owner to that same no-refresh Library lookup; no alternate inquiry store is read.'};
   reader=collectionDirection;
  }
  if(typeof reader?.read!=='function')return {...base,gap:'Maintained human-direction read is unavailable.'};
  let record;try{record=await reader.read(copy(wanted));}catch(error){return {...base,status:error.status===404?'missing':'unavailable',gap:error.message};}
  if(!record?.bound||!record.scope)return {...base,status:'missing',gap:'The maintained owner has no bound record for this exact selector.'};
  if(!scopeMatches(wanted,record.scope)||typeof record.body!=='string'||!Number.isSafeInteger(record.revision)||record.revision<0||!HASH.test(record.hash||'')||digest(record.body)!==record.hash)return {...base,status:'invalid-record',gap:'Owner identity, revision or actual full body hash does not match.'};
  const stableUUID=wanted.scope==='collection'?record.scope.collectionId:wanted.scope==='part'?record.scope.bindingId:wanted.scope==='output'?record.scope.outputId:record.scope.projectId;
  const status=record.externalEdit||record.stale||!pinMatches(entry.expected,record)?'stale':record.revision===0?'empty':'current';
  const contributions=attribution(record,conceptContextProjection),sourceReferences=await references(contributions);
  return {...base,status,scope:copy(record.scope),stableUUID,revision:record.revision,hash:record.hash,metadataHash:HASH.test(record.metadataHash||'')?record.metadataHash:null,body:record.body,updatedAt:record.updatedAt??null,externalEdit:!!record.externalEdit,field:'body',granularIdentity:'not-provided',contributions,sourceReferences,history:copy(record.history||[]),lifecycle:{current:record.externalEdit?'external-edit-requires-owner-review':'owner-current-record',history:'owner-supplied-history-not-reclassified',questionState:'not-inferred',protectedRanges:'not-inferred'}};
 }
 async function readPiece(input){
  if(!input)return null;
  const allowed=['rootBindingId','parentStudyId','selectedOutputId','expectedWords'];
  if(Object.keys(input).some(key=>!allowed.includes(key))||!UUID.test(input.rootBindingId||'')||!readable(input.parentStudyId)||!UUID.test(input.selectedOutputId||''))fail('Piece selector requires exact root binding, parent study and output UUID.');
  const group={rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId},base={selector:{...group,selectedOutputId:input.selectedOutputId},stableUUID:input.selectedOutputId,status:'unavailable',words:null};
  if(typeof nativeOutputs?.read!=='function')return {...base,gap:'Maintained native output catalog read is unavailable.'};
  let catalog;try{catalog=await nativeOutputs.read(group);}catch(error){return {...base,gap:error.message};}
  if(!equal(catalog?.scope,group))return {...base,status:'unowned-output',gap:'Maintained native root/parent scope changed.'};
  const matches=catalog.outputs?.filter(output=>output.id===input.selectedOutputId),bindings=catalog.outputBindings?.filter(row=>row.outputId===input.selectedOutputId);
  if(matches?.length!==1||bindings?.length!==1)return {...base,status:'unowned-output',gap:'Selected output has no unique maintained native output/word-owner binding.'};
  const owner=bindings[0].wordOwner,output=matches[0],scope={...group,projectId:catalog.photoScope?.projectId,documentId:catalog.photoScope?.documentId,outputId:output.id};
  if(!UUID.test(scope.projectId||'')||!UUID.test(scope.documentId||''))return {...base,status:'unowned-output',gap:'Exact physical Project/document UUIDs are missing.'};
  const result={...base,status:'current',scope,kind:output.kind,label:output.name??null,wordOwner:copy(owner),edition:{status:'not-selected',reason:'No immutable edition owner/selector was supplied; this is current own wording.'},expectedOutput:copy(catalog.expectedOutput),words:{status:'unavailable',body:null,hash:null,revision:null}};
  if(typeof workReferences?.read==='function'){
   const endpoint={kind:'piece',id:output.id,...group};
   try{const reference=await workReferences.read(endpoint);if(reference?.schema!=='ar-create.library-work-target.v1'||!equal(reference.endpoint,endpoint)||reference.authority?.kind!=='native-independent-output'||reference.authority.projectId!==scope.projectId||reference.authority.documentId!==scope.documentId||reference.authority.outputId!==output.id||reference.authority.rootBindingId!==group.rootBindingId||reference.authority.parentStudyId!==group.parentStudyId||!HASH.test(reference.edition?.hash||'')||!HASH.test(reference.workHash||''))return {...result,status:'unowned-output',gap:'Trusted independent Piece edition/authority does not match.'};result.edition={...copy(reference.edition),status:'owner-current-edition',workHash:reference.workHash,humanProjectMapping:reference.humanProjectMapping};result.editionFreshness=copy(reference.freshness??null);}catch(error){result.edition={status:'unavailable',gap:error.message};result.editionFreshness=null;}
  }
  let words;
  if(owner?.kind==='native'){
   if(owner.parentStudyId!==group.parentStudyId||!UUID.test(owner.bindingId||''))return {...result,status:'unowned-output',gap:'Native wording binding belongs to another parent.'};
   if(typeof nativeWords?.read!=='function')return {...result,words:{...result.words,gap:'Maintained nativeWords.read({bindingId,parentStudyId}) is unavailable; no captured wording fallback is used.'}};
   words=await nativeWords.read({bindingId:owner.bindingId,parentStudyId:owner.parentStudyId});
   if(words.binding?.id!==owner.bindingId||words.binding.parentStudyId!==owner.parentStudyId||words.binding.canonicalOutputId!==output.id||words.binding.authority!=='owned-working-copy'||words.binding.status!=='ready'||!words.readiness?.ready||typeof words.raw!=='string')return {...result,status:'unowned-output',gap:'Current native own-word snapshot is not the exact ready registered output.'};
   const actualHash=digest(words.raw),ownHash=words.expected?.workflow?.draft;
   if(ownHash!==actualHash)return {...result,words:{...result.words,status:'invalid-record',body:words.raw,gap:'Native expected draft hash differs from actual own bytes.'}};
   result.words={sourceRecordKind:'native-own-words',scope:{bindingId:owner.bindingId,parentStudyId:owner.parentStudyId,outputId:output.id},stableUUID:owner.bindingId,revision:copy(words.expected),hash:actualHash,body:words.raw,status:input.expectedWords&&!equal(input.expectedWords,words.expected)?'stale':'current',field:'raw',originalChanged:words.originalChanged??null,readiness:copy(words.readiness)};
  }else if(owner?.kind==='carousel-words'){
   if(owner.projectId!==scope.projectId||owner.documentId!==scope.documentId||owner.outputId!==scope.outputId)return {...result,status:'unowned-output',gap:'Carousel word owner differs from the exact physical output.'};
   if(typeof carouselWords?.readCarouselWords!=='function')return {...result,words:{...result.words,gap:'Maintained own-carousel words read is unavailable.'}};
   words=await carouselWords.readCarouselWords({projectId:owner.projectId,documentId:owner.documentId,outputId:owner.outputId,allowEditedMarkdown:true});
   if(typeof words.raw!=='string'||words.missing||words.output?.id!==output.id||words.expected?.projectId!==scope.projectId||words.expected.documentId!==scope.documentId||words.expected.outputId!==output.id||words.expected.markdownHash!==digest(words.raw))return {...result,words:{...result.words,status:'invalid-record',gap:'Own-carousel bytes/identity/hash are missing or inconsistent.'}};
   result.words={sourceRecordKind:'carousel-own-words',scope:copy(owner),stableUUID:output.id,revision:copy(words.expected),hash:words.expected.markdownHash,body:words.raw,status:words.externalEdit||input.expectedWords&&!equal(carouselToken(input.expectedWords),carouselToken(words.expected))?'stale':'current',field:'raw',originalChanged:words.originalChanged??null,readiness:copy(words.readiness)};
  }else return {...result,status:'unowned-output',gap:'Unsupported maintained wording owner; no captured wording fallback.'};
  return result;
 }
 async function readLinks(records,piece){
  const result={status:'unavailable',records:[],availableAssociations:[],reads:[],coverage:{kind:'unknown',unknownDependencies:['Accepted scoped links are unavailable.']}};
  if(typeof library?.typedRelationships!=='function'){result.gap='Same Library typedRelationships owner read is unavailable.';return result;}
  const endpoint=piece?.scope?{kind:'piece',id:piece.scope.outputId,rootBindingId:piece.scope.rootBindingId,parentStudyId:piece.scope.parentStudyId}:null;
  for(const record of records.filter(record=>record.selector.scope==='collection'&&record.scope)){
   const entity={kind:'collection',id:record.scope.collectionId};
   try{const view=await library.typedRelationships({entity,direction:'outgoing',includeDetached:true});if(view?.schema!=='ar-create.library-typed-relationships.v1'||!Number.isSafeInteger(view.revision)||!HASH.test(view.indexHash||'')||!Array.isArray(view.relationships))throw Error('Maintained typed-link revision/hash/records are incomplete.');result.reads.push({entity,revision:view.revision,indexHash:view.indexHash});result.coverage=copy(view.coverage);for(const link of view.relationships){if(link.from?.kind!=='collection'||link.from.id!==entity.id)continue;if(link.recordKind==='organizational-association'&&link.to?.kind==='project'){
     const to=link.to,anchor=link.projectAnchor,identity=anchor?.identity,valid=UUID.test(link.id||'')&&UUID.test(to.id||'')&&UUID.test(to.rootBindingId||'')&&readable(to.parentStudyId)&&['proposed','accepted','detached'].includes(link.status)&&anchor?.schema==='ar-create.named-project-authority.v1'&&equal(anchor.endpoint,to)&&anchor.humanProjectMapping==='existing-named-saved-workspace'&&anchor.project?.id===to.id&&HASH.test(anchor.proofHash||'')&&identity?.workspaceId===to.id&&identity.parentStudyId===to.parentStudyId&&identity.rootBindingId===to.rootBindingId&&typeof link.review?.needed==='boolean';
     if(!valid)throw Error('Maintained organizational Project authority is incomplete or mismatched.');
     const projects=records.filter(r=>r.selector.scope==='project'&&['current','empty'].includes(r.status)&&r.selector.parentStudyId===to.parentStudyId),rootMatches=piece?.status==='current'&&piece.scope.rootBindingId===to.rootBindingId&&piece.scope.parentStudyId===to.parentStudyId,projectMatches=projects.length===0||projects.some(r=>r.scope?.projectId===to.id);
     if(rootMatches&&projectMatches&&link.status!=='proposed')result.records.push(copy(link));
     else result.availableAssociations.push({...copy(link),context:link.status==='proposed'?'unadopted-proposal':!rootMatches?'native-root-not-selected':'explicit-project-scope-not-matched',directionInheritance:'not-implied'});
     continue;
    }
    const selectedPiece=endpoint&&equal(link.to,endpoint),projectWorkspace=link.to?.kind==='workspace'&&records.some(r=>r.selector.scope==='project'&&r.scope?.projectId===link.to.id);if((selectedPiece||projectWorkspace)&&UUID.test(link.id||'')&&['proposed','accepted','detached'].includes(link.status))result.records.push(copy(link));}}catch(error){result.reads.push({entity,status:'unavailable',gap:error.message});}
  }
  result.status=result.reads.some(read=>read.status==='unavailable')?'partial':'read';return result;
 }
 function located(record,locator){
  if(!record||!locator)return null;let text;
  if(locator.kind==='range'&&Number.isSafeInteger(locator.start)&&Number.isSafeInteger(locator.end)&&locator.start>=0&&locator.end>locator.start&&locator.end<=record.body?.length)text=record.body.slice(locator.start,locator.end);
  if(locator.kind==='field')text=({body:record.body,adoptedDirection:record.contributions?.adoptedDirection,authorThoughts:record.contributions?.personalThoughts,aiInterpretation:record.contributions?.agentProposed,suggestions:record.contributions?.unadoptedSuggestions})[locator.name];
  return typeof text==='string'&&HASH.test(locator.hash||'')&&digest(text)===locator.hash?text:null;
 }
 async function scopeReferenceProjection(records,piece,selected){
  const result={status:'unavailable',references:[],effective:[],origins:[],reads:[],precedence:'explicit-references-only-no-inferred-order',permissionGranted:false,coverage:'only-recorded-explicit-scope-references'};
  const relevant=record=>piece?.status==='current'?record.selector.scope!=='collection'&&record.selector.parentStudyId===piece.scope.parentStudyId&&(record.selector.scope==='project'||record.selector.scope==='output'&&record.selector.outputId===piece.scope.outputId||record.selector.scope==='part'&&[piece.scope.rootBindingId,piece.wordOwner?.bindingId].includes(record.selector.bindingId)):selected&&equal(record.selector,selected);
  const targets=records.filter(record=>record.scope&&['current','empty'].includes(record.status)&&relevant(record));
  for(const target of targets){
   const owner=target.selector.scope==='collection'?collectionDirection:humanDirection;
   if(typeof owner?.readScopeReferences!=='function'){result.reads.push({target:copy(target.selector),status:'unavailable',gap:'Maintained readScopeReferences is not connected.'});continue;}
   try{
    const view=await owner.readScopeReferences({target:copy(target.selector)});
    if(view?.schema!=='ar-create.direction-scope-references.v1'||!equal(view.target?.selector,target.selector)||!equal(view.target.scope,target.scope)||view.target.revision!==target.revision||view.target.hash!==target.hash||view.target.metadataHash!==target.metadataHash||!Array.isArray(view.references)||view.precedence!=='explicit-references-only-no-inferred-order')throw Error('Scope-reference target identity/body/metadata changed during read.');
    result.reads.push({target:copy(target.selector),scope:copy(view.target.scope),revision:view.target.revision,hash:view.target.hash,metadataHash:view.target.metadataHash,status:'read'});
    for(const reference of view.references){
     if(reference.schema!=='ar-create.direction-scope-reference.v1'||!UUID.test(reference.id||'')||!['linked-learning','inherit-direction','supersedes'].includes(reference.kind)||!['proposed','accepted','detached'].includes(reference.status)||!equal(reference.target?.selector,target.selector)||!equal(reference.target.scope,target.scope))throw Error('Scope-reference owner returned an invalid or foreign reference.');
     const row={...copy(reference),readTarget:copy(target.selector)};result.references.push(row);
     if(reference.status!=='accepted'||reference.review?.needed!==false)continue;
     let origin=result.origins.find(record=>equal(record.selector,reference.origin.selector));
     if(!origin){origin=await readRecord({selector:selector(reference.origin.selector)});result.origins.push(origin);}
     const validOrigin=origin.scope&&equal(origin.scope,reference.origin.scope)&&origin.revision===reference.origin.revision&&origin.hash===reference.origin.hash&&origin.status==='current';
     if(!validOrigin){row.resolverReview='Exact origin changed or is unavailable.';continue;}
     if(reference.supersededHere===true)continue;
     let text=located(origin,reference.origin.locator),locator=reference.origin.locator,identity=origin;
     if(reference.kind==='supersedes'){text=located(target,reference.replacement);locator=reference.replacement;identity=target;}
     if(text===null){row.resolverReview='Exact maintained field/range hash is unavailable; no fuzzy replacement.';continue;}
     const expectedApplicability={ 'linked-learning':'linked-learning','inherit-direction':'inherited-direction',supersedes:'explicit-local-override'}[reference.kind];
     if(reference.applicability!==expectedApplicability){row.resolverReview='Owner applicability is not an accepted current reference.';continue;}
     result.effective.push({referenceId:reference.id,kind:reference.kind,applicability:reference.applicability,role:reference.kind==='linked-learning'?'linked-background-not-editorial-instruction':ROLE,target:copy(target.selector),origin:copy(reference.origin),sourceRecord:{scope:copy(identity.scope),stableUUID:identity.stableUUID,revision:identity.revision,hash:identity.hash,metadataHash:identity.metadataHash},locator:copy(locator),text,...(reference.supersedesId?{supersedesId:reference.supersedesId}:{})});
    }
   }catch(error){result.reads.push({target:copy(target.selector),status:'unavailable',gap:error.message});}
  }
  result.status=result.reads.some(read=>read.status==='read')?(result.reads.some(read=>read.status==='unavailable')?'partial':'read'):'unavailable';return result;
 }
 function resolutionDetails(records,chainRecords,scopeReferences){
  const targets=records.filter(record=>scopeReferences.reads.some(read=>equal(read.target,record.selector)));
  return targets.map(target=>{
   const sameTarget=reference=>equal(reference.target,target.selector),effective=scopeReferences.effective.filter(sameTarget);
   const explicitOverrides=effective.filter(reference=>reference.kind==='supersedes').map(reference=>({referenceId:reference.referenceId,target:copy(reference.target),supersededReferenceIds:[reference.supersedesId],origin:copy(reference.origin),replacement:copy(reference.locator)}));
   const activeInheritedReferences=effective.filter(reference=>reference.kind==='inherit-direction').map(reference=>({referenceId:reference.referenceId,target:copy(reference.target),origin:copy(reference.origin),text:reference.text}));
   const ordinaryDirections=chainRecords.filter(record=>record.contributions.adoptedDirection&&(record.selector.scope==='project'||equal(record.selector,target.selector)||record.selector.scope==='part'&&target.selector.scope==='output')).map(record=>({selector:copy(record.selector),scope:copy(record.scope),revision:record.revision,hash:record.hash,field:record.contributions.status==='ordinary-editorial-direction'?'body':'adoptedDirection',text:record.contributions.adoptedDirection}));
   for(const field of ordinaryDirections)field.supersededHereBy=explicitOverrides.filter(reference=>equal(reference.origin.scope,field.scope)&&equal(reference.origin.selector,field.selector)&&reference.origin.revision===field.revision&&reference.origin.hash===field.hash&&reference.origin.locator?.kind==='field'&&reference.origin.locator.name===field.field&&reference.origin.locator.hash===digest(field.text)).map(reference=>reference.referenceId);
   const activeOrdinaryDirections=ordinaryDirections.filter(field=>field.supersededHereBy.length===0);
   const heldReferenceIds=scopeReferences.references.filter(reference=>equal(reference.readTarget,target.selector)&&reference.status==='accepted'&&reference.kind!=='linked-learning'&&(reference.review?.needed!==false||reference.resolverReview)).map(reference=>reference.id);
   // Only an exact whole-field origin pin removes that field from this target’s active count.
   // Ranges and other fields stay unresolved; a replacement already in ordinaryDirections is one input.
   const unresolved=activeOrdinaryDirections.length+activeInheritedReferences.length>1||explicitOverrides.length>0&&activeInheritedReferences.length>0||heldReferenceIds.length>0;
   return {target:copy(target.selector),status:unresolved?'unresolved-overlap':explicitOverrides.length?'explicit-overlap-references':'no-owner-override-resolution-inferred',explicitOverrides,activeInheritedReferences,ordinaryDirections,heldReferenceIds,overlapMeaning:'unresolved-or-unknown-no-semantic-inference',coverage:'exact-reference-and-target-only-no-blanket-resolution'};
  });
 }
 async function readOnce(request){
  const entries=request.scopes.map(value=>{if(value?.selector){if(Object.keys(value).some(key=>!['selector','expected'].includes(key)))fail('Scope wrapper refuses caller snapshots and extra fields.');if(value.expected&&(Object.keys(value.expected).some(key=>!['revision','hash'].includes(key))||!Number.isSafeInteger(value.expected.revision)||value.expected.revision<0||!HASH.test(value.expected.hash||'')))fail('Scope wrapper expected pin requires only actual revision/hash.');}return {selector:selector(value?.selector||value),...(value?.selector&&value.expected?{expected:copy(value.expected)}:{})};});
  if(new Set(entries.map(entry=>stable(entry.selector))).size!==entries.length)fail('Repeated scope selectors are ambiguous; supply each exact scope once.');
  const records=[];for(const entry of entries)records.push(await readRecord(entry));
  const piece=await readPiece(request.piece),links=await readLinks(records,piece),selected=request.selectedScope?selector(request.selectedScope):entries.length===1?entries[0].selector:null;
  if(selected&&!entries.some(entry=>equal(entry.selector,selected)))fail('Selected scope must be among the exact requested scopes.');
  const scopeReferences=await scopeReferenceProjection(records,piece,selected);
  let current=selected?records.find(record=>equal(record.selector,selected)):null,status=current?.status||(records.length>1?'ambiguous':'missing'),selection={scope:selected,mode:selected?'explicit-scope':'ambiguous'};
  if(request.overrideReference){const reference=request.overrideReference;if(Object.keys(reference).some(key=>!['scope','expected','reason'].includes(key)))fail('Reading reference refuses caller approval/override snapshots.');const target=selector(reference.scope);if(!readable(reference.reason)||!reference.expected||!records.some(record=>equal(record.selector,target)))fail('Override-reference navigation needs an exact requested scope, reason and revision/hash pin.');const candidate=records.find(record=>equal(record.selector,target));selection={scope:target,originalScope:selected,mode:'explicit-reading-reference',reason:reference.reason};current=pinMatches(reference.expected,candidate)?candidate:null;status=current?.status==='current'?'explicit-reference':'stale';}
  if(!['current','empty'].includes(current?.status))current=null;
  for(const record of records){const projectChain=piece?.status==='current'&&record.selector.scope==='project'&&record.selector.parentStudyId===piece.scope.parentStudyId;const acceptedLinks=record.selector.scope==='collection'?links.records.filter(link=>link.from.id===record.stableUUID&&link.status==='accepted'):[];const linked=acceptedLinks.length>0;if(linked)record.linkReview={needed:acceptedLinks.some(link=>link.review?.needed!==false),referenceIds:acceptedLinks.map(link=>link.id)};record.applicability=piece&&record.selector.scope==='collection'?(linked?'linked-learning':'unproven-collection-reference'):selected&&equal(record.selector,selected)?'local':projectChain?'inherited-direction':record.selector.scope==='collection'?'unproven-collection-reference':'separate-scope';}
  const chainRecords=records.filter(record=>piece?.status==='current'&&['current','empty'].includes(record.status)&&record.selector.scope!=='collection'&&record.selector.parentStudyId===piece.scope.parentStudyId&&(record.selector.scope==='project'||record.selector.scope==='output'&&record.selector.outputId===piece.scope.outputId||record.selector.scope==='part'&&[piece.scope.rootBindingId,piece.wordOwner?.bindingId].includes(record.selector.bindingId)));
  const scopeResolutionByTarget=resolutionDetails(records,chainRecords,scopeReferences);
  const inheritance={status:scopeReferences.status==='read'?'explicit-references-read':'not-established',scope:'collection-direction-and-explicit-overrides',existingProjectChain:{status:chainRecords.length?'validated':'not-selected-or-unavailable',records:chainRecords.map(record=>copy(record.selector))},gap:scopeReferences.status==='read'?'Only actual accepted owner references establish inheritance or local overrides. Additional precedence is not inferred.':'Explicit direction scope-reference reads are unavailable. No relationship or precedence is inferred from titles, memberships, common project, timestamps or caller references.',ordinaryProjectChain:records.filter(record=>record.applicability==='inherited-direction').map(record=>copy(record.selector)),collectionDefault:'background-only-when-explicitly-linked',competingDirections:'unresolved-without-owner-overlap-and-override-references'};
  const dependencyCoverage={status:'incomplete',reason:'Only explicitly requested and owner-referenced records are enumerated. Actual typed-link, scope-reference and current Piece-edition pins appear where connected. Unrecorded reverse uses and immutable historical edition selection remain unknown.'};
  const availableScopes=records.map(record=>({selector:copy(record.selector),scope:copy(record.scope),stableUUID:record.stableUUID,label:record.label??null,status:record.status,revision:record.revision,hash:record.hash}));
  const dependencyPiece=copy(piece);if(dependencyPiece){delete dependencyPiece.expectedOutput;if(dependencyPiece.words?.sourceRecordKind==='carousel-own-words')dependencyPiece.words.revision=carouselToken(dependencyPiece.words.revision);}
  const dependencies={records:records.map(record=>({selector:record.selector,scope:record.scope,stableUUID:record.stableUUID,status:record.status,revision:record.revision,hash:record.hash,metadataHash:record.metadataHash??null,library:record.library??null,role:record.contributions,sourceReferences:record.sourceReferences??null})),piece:dependencyPiece,links,scopeReferences,selection,inheritance,dependencyCoverage};
  return {schema:'ar-create.current-understanding.projection.v1',status,records,availableScopes,current:copy(current),selection,piece,links,scopeReferences,inheritance,dependencyCoverage,fingerprint:digest(dependencies),assistance:{mayApply:false,scopeResolution:scopeResolutionByTarget.some(target=>target.status==='unresolved-overlap')?'unresolved-overlap':scopeResolutionByTarget.some(target=>target.status==='explicit-overlap-references')?'explicit-overlap-references':'no-owner-override-resolution-inferred',scopeResolutionByTarget,reason:'A read projection is not application authority. Revalidate this fingerprint and existing target guards, preserving explicit reference and dependency coverage limits.'}};
 }
 async function resolve(request={}){
  if(!Array.isArray(request.scopes)||!request.scopes.length||request.scopes.length>32||Object.keys(request).some(key=>!['scopes','selectedScope','overrideReference','piece'].includes(key)))fail('Supply a bounded list of explicit scope selectors, optional selection/reference and exact Piece context.');
  const input=copy(request);let previous=await readOnce(input);
  for(let attempt=0;attempt<2;attempt++){const next=await readOnce(input);if(next.fingerprint===previous.fingerprint)return {...next,readConsistency:{status:'stable-reread',reads:attempt+2}};previous=next;}
  return {...previous,status:'context-changed',current:null,readConsistency:{status:'changed-during-read',reads:3},assistance:{mayApply:false,reason:'Context changed during bounded rereads; preserve prepared and human text for review.'}};
 }
 async function validatePending({request,expectedFingerprint,targetScope,preparedText,humanText}){
  let projection;try{projection=await resolve(request);}catch(error){return {status:'context-unavailable',mayApply:false,contextUnchanged:false,targetScope:copy(targetScope),preparedText,humanText,projection:null,reason:'Context unavailable—review this result. '+error.message};}
  const target=request.piece?{rootBindingId:request.piece.rootBindingId,parentStudyId:request.piece.parentStudyId,selectedOutputId:request.piece.selectedOutputId}:null;
  const unchanged=typeof expectedFingerprint==='string'&&expectedFingerprint===projection.fingerprint&&projection.readConsistency.status==='stable-reread'&&equal(targetScope,target);
  return {status:unchanged?'context-unchanged-target-guards-required':'context-changed',mayApply:false,contextUnchanged:unchanged,targetScope:copy(targetScope),preparedText,humanText,projection,reason:unchanged?'Context identity/version matches; existing target revision/hash guards and unresolved dependency coverage still apply.':'Context changed—review this result. Prepared text and human edits are returned unchanged.'};
 }
 return {resolve,validatePending};
}
