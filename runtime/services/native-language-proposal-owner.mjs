import path from 'node:path';
import fs from 'node:fs';
import {atomicWrite,ensurePrivateDirectory,readJson,digest,regular} from './files.mjs';
import {capture as captureDraft,apply as applyDraft,inlineMap} from './draft-correspondence.mjs';
import {proposalEditable} from './native-proposal-capability.mjs';
import {AGENT_ACTORS,HUMAN_ACTORS,currentActor} from './actor.mjs';
import {createStudyBridge} from './study-mcp-bridge.mjs';
import {languageDerivativeSpans} from './language-derivative-spans.mjs';
import {validateLanguageTranslation} from './study-language-proposals.mjs';
const fail=(m,status=409)=>{throw Object.assign(Error(m),{status});};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x),same=(a,b)=>stable(a)===stable(b);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const operation=(id,kind)=>{const h=digest(id+':'+kind).slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;};
/** Article-only adapter. Original and sibling words are never write targets. */
export function createNativeLanguageProposalOwner({dataDir,outputs,drafts,validateStandInTarget,captureContracts}){
 const root=ensurePrivateDirectory(dataDir,'native-language-acceptance'),contractOwners=new Map();
 const contractsFor=async binding=>{if(typeof captureContracts==='function')return captureContracts(binding);const key=binding.bindingId+'\0'+binding.parentStudyId;if(!contractOwners.has(key))contractOwners.set(key,createStudyBridge({dataDir,drafts,binding}));return contractOwners.get(key).contracts();};
 function scopeCheck(scope){if(!scope||Object.keys(scope).some(k=>!['kind','bindingId','parentStudyId','outputId'].includes(k))||scope.kind!=='audience-article'||!uuid.test(scope.bindingId||'')||!uuid.test(scope.outputId||'')||typeof scope.parentStudyId!=='string'||!scope.parentStudyId.trim())fail('Select one native Audience Article.',400);return {rootBindingId:scope.bindingId,parentStudyId:scope.parentStudyId,selectedOutputId:scope.outputId};}
 async function selected(scope){const input=scopeCheck(scope),view=await outputs.read(input);if(view.output?.id!==scope.outputId||view.output.kind!=='article'||view.wordOwner?.kind!=='native'||!view.wordOwner.bindingId)fail('Choose a native Article word owner.');const own=await drafts.read({bindingId:view.wordOwner.bindingId,parentStudyId:scope.parentStudyId});if(own.readiness?.ready!==true||!Array.isArray(own.projection)||own.raw!==undefined&&view.writingProof?.rawHash!==digest(own.raw))fail('Native Article words changed; refresh its existing output first.');
  return {input,view,own,rows:own.projection};}
 async function readSource(scope){
  const {view,own,rows}=await selected(scope),contracts=await contractsFor({bindingId:own.binding.id,parentStudyId:scope.parentStudyId});
  if(contracts&&(!same(contracts.binding,{bindingId:own.binding.id,parentStudyId:scope.parentStudyId})||!Array.isArray(contracts.protections)))fail('Translation contract snapshot belongs to another native owner.');
  const protections=contracts?.protections.filter(p=>p.active)||[],held=[],preserved=[],units=[];
  // The maintained Audience mapper owns the distinction between reader passages
  // and private title/credit/separator metadata. Retain those exact native bytes
  // in the derivative; they are neither translation units nor missing prose.
  const readerSpans=languageDerivativeSpans(own,{...scope,documentId:view.document?.id}),metadata=new Set(readerSpans.filter(row=>row.disposition==='private-credit-title-separator-metadata').map(row=>row.id));
  for(const p of protections)if(!rows.some(row=>row.id===p.paragraphId))held.push({paragraphId:p.paragraphId,reason:'Protected wording no longer has its exact native paragraph.'});
  for(const [blockIndex,row]of rows.entries()){
   if(!row.words?.trim())continue;if(metadata.has(row.id)){preserved.push({paragraphId:row.id,rawHash:digest(row.raw),kind:'audience-private-metadata',readerVisible:false});continue;}const map=readerSpans.find(r=>r.id===row.id)?.map;
   if(!map||!map.safe||!['paragraph','heading','blockquote'].includes(map.blockKind)||map.reworks.length){held.push({paragraphId:row.id,rawHash:digest(row.raw),words:row.words,reason:'Unsupported native markup remains untranslated and unchanged.'});continue;}
   const selectedProtections=protections.filter(p=>p.paragraphId===row.id),frozen=[];let diverged=false;
   for(const p of selectedProtections){const at=map.words.indexOf(p.text);if(!p.text||at<0||at!==map.words.lastIndexOf(p.text)){held.push({paragraphId:row.id,reason:'Protected wording changed or is ambiguous; release or reselect it first.'});diverged=true;break;}frozen.push({from:at,to:at+p.text.length,text:p.text,kind:'protected-phrase'});}
   if(diverged)continue;
   // Native mapping runs own every byte boundary. Adjacent plain characters
   // merge; formatting delimiters and locked identities split translation units.
   const runs=[];
   for(const r of map.runs){if(r.to<=r.from)continue;const from=Math.max(0,r.from),to=Math.min(map.words.length,r.to);if(to<=from)continue;if(r.locked){if(!row.raw.slice(r.rawFrom,r.rawTo).startsWith('[[term:'))held.push({paragraphId:row.id,from,to,reason:'Locked source wording requires its native owner; this span remains untranslated.'});preserved.push({paragraphId:row.id,from,to,text:map.words.slice(from,to),kind:'locked-native-identity'});continue;}const last=runs.at(-1);if(last&&last.to===from&&last.rawTo===r.rawFrom){last.to=to;last.rawTo=r.rawTo;}else runs.push({from,to,rawFrom:r.rawFrom,rawTo:r.rawTo});}
   for(const range of frozen)preserved.push({paragraphId:row.id,...range});
   for(const run of runs){let ranges=[run];for(const fixed of frozen)ranges=ranges.flatMap(r=>fixed.to<=r.from||fixed.from>=r.to?[r]:[...(fixed.from>r.from?[{...r,to:fixed.from}]:[]),...(fixed.to<r.to?[{...r,from:fixed.to}]:[])]);
    for(const range of ranges){let from=range.from,to=range.to;while(from<to&&/\s/.test(map.words[from]))from++;while(to>from&&/\s/.test(map.words[to-1]))to--;const unquotedFrom=from,unquotedTo=to;while(from<to&&/["“”'‘’]/.test(map.words[from]))from++;while(to>from&&/["“”'‘’]/.test(map.words[to-1]))to--;if(from>unquotedFrom)preserved.push({paragraphId:row.id,from:unquotedFrom,to:from,text:map.words.slice(unquotedFrom,from),kind:'reader-quote-frame'});if(to<unquotedTo&&to>=from)preserved.push({paragraphId:row.id,from:to,to:unquotedTo,text:map.words.slice(to,unquotedTo),kind:'reader-quote-frame'});if(to<=from||!/[\p{L}\p{N}]/u.test(map.words.slice(from,to)))continue;const id=from===0&&to===map.words.length?row.id:row.id+':'+from+':'+to;units.push({id,text:map.words.slice(from,to),role:map.blockKind==='heading'?'author-heading':map.blockKind==='blockquote'?'author-quoted-words':'author-words',pointer:{bindingId:own.binding.id,paragraphId:row.id,blockIndex,from,to,rawFrom:run.rawFrom+from-run.from,rawTo:run.rawFrom+to-run.from,blockHash:row.blockHash,rawHash:digest(row.raw),blockKind:map.blockKind,level:map.level??null,paragraphText:map.words}});}
   }
  }
  if(!units.length)fail('No supported native text runs need translation.');
  return {scope:structuredClone(scope),proof:{output:structuredClone(view.output),writingProof:structuredClone(view.writingProof),wordOwner:structuredClone(view.wordOwner),expected:structuredClone(own.expected),...(contracts?{contracts:structuredClone(contracts),contractsHash:digest(stable(contracts))}:{}),translationCoverage:{complete:!held.length,held,preserved},nativeRows:rows.map(row=>({id:row.id,raw:row.raw,words:row.words}))},units};
 }
 async function applyReviewedTranslation(packet){
  const {source,proposal,targetLanguage,operationId,requestId,decision}=packet;if(!uuid.test(operationId||'')||!uuid.test(requestId||'')||targetLanguage!=='zh-Hans'||!decision||decision.operationId!==operationId||decision.action!=='accepted'||decision.actor!==currentActor()?.actor)fail('Exact reviewed translation decision required.',403);
  const check=async()=>{if(currentActor()?.actor!==decision.actor)fail('Translation decision actor changed.',403);if(decision.role==='human'){if(!HUMAN_ACTORS.includes(decision.actor))fail('Human review required.',403);}else if(decision.role==='stand-in'){if(!AGENT_ACTORS.includes(decision.actor)||typeof validateStandInTarget!=='function')fail('Registered-copy stand-in required.',403);await validateStandInTarget(source.scope);}else fail('Unknown translation review role.',403);if(!same(await readSource(source.scope),source))fail('Translation source changed.');};
  if(!same(validateLanguageTranslation({translations:proposal.units.map(({id,text,uncertainty})=>({id,text,uncertainty}))},source,packet.retainedTerms),proposal)||proposal.units.some(u=>u.uncertainty.length))fail('Complete reviewed translation without uncertainty required.');
  if(source.proof.translationCoverage?.complete!==true)fail('This translation is partial; held native rows cannot become a complete language edition.');
  for(const unit of proposal.units)if(!proposalEditable({safe:true,blockKind:'paragraph',raw:unit.text,words:unit.text})||/[\r\n]/.test(unit.text))fail('Keep translated native paragraphs as supported plain text.');
  await check();const name=path.join(root,operationId+'.json');let intent=readJson(name,null);const binding={requestId,operationId,sourceHash:digest(stable(source)),proposalHash:digest(stable(proposal)),decision};if(intent&&!same(intent.binding,binding))fail('Language acceptance operation already has another proposal.');
  const persist=()=>atomicWrite(name,JSON.stringify(intent,null,2)+'\n');
  if(!intent){const current=await selected(source.scope);intent={schema:'ar-create.native-language-acceptance.v1',binding,create:{...current.input,selectedOutputId:undefined,kind:'article',sourceOutputId:source.scope.outputId,targetLanguage,expectedSourceWords:current.view.writingProof,expectedOutput:current.view.expectedOutput,operationId:operation(operationId,'create')}};delete intent.create.selectedOutputId;persist();}
  if(intent.result)return structuredClone(intent.result);
  await check();const created=await outputs.create(intent.create),child=created.view;if(child.output.languageEdition?.sourceOutputId!==source.scope.outputId||child.wordOwner.bindingId===source.proof.wordOwner.bindingId||child.output.id===source.scope.outputId)fail('Language child lineage differs; no word write allowed.');
  if(!intent.save){
   const current=await drafts.read({bindingId:child.wordOwner.bindingId,parentStudyId:source.scope.parentStudyId});
   if(current.projection.length!==source.proof.nativeRows.length||current.projection.some((row,i)=>row.raw!==source.proof.nativeRows[i].raw))fail('New language child no longer matches the reviewed source.');
   let model=captureDraft(current.raw,'language-child-validation'),raw=current.raw;if(model.blocks.length!==current.projection.length)fail('Language child mapping changed.');model.blocks.forEach((block,i)=>{if(block.raw!==current.projection[i].raw)fail('Language child mapping changed.');block.id=current.projection[i].id;});const operations=[];
   const changes=proposal.units.map(unit=>({unit,pointer:source.units.find(u=>u.id===unit.id).pointer})).sort((a,b)=>b.pointer.blockIndex-a.pointer.blockIndex||b.pointer.rawFrom-a.pointer.rawFrom);
   for(const {unit,pointer}of changes){const row=current.projection[pointer.blockIndex],block=model.blocks.find(b=>b.id===row.id),original=source.units.find(u=>u.id===unit.id);if(unit.text===original.text)continue;const op={kind:'reviewedLanguageText',id:row.id,from:pointer.rawFrom,to:pointer.rawTo,insert:unit.text,seenBlockHash:digest(block.raw)},changed=applyDraft(model,raw,[op],{reviewedLanguageDerivative:{operationsHash:digest(stable([op]))}});operations.push(op);model=changed.snapshot;raw=changed.raw;}
   if(!operations.length)fail('Translation contains no changed words.');intent.save={bindingId:current.binding.id,parentStudyId:source.scope.parentStudyId,operationId:operation(operationId,'words'),expected:current.expected,operations,sourceBindingId:source.proof.wordOwner.bindingId,sourceOutputId:source.scope.outputId,sourceExpected:source.proof.expected,sourceRawHash:source.proof.writingProof.rawHash,sourceCaptureHash:digest(stable(source)),sourceUnits:source.units,requestId,targetLanguage,targetOutputId:child.output.id,decision};intent.candidateHash=digest(raw);persist();
  }
  // Reconstruct the exact operation packet from the immutable reviewed source,
  // even on a response-loss retry; an edited intent cannot widen its spans.
  const currentChild=await drafts.read({bindingId:child.wordOwner.bindingId,parentStudyId:source.scope.parentStudyId}),expectedRows=new Map(source.proof.nativeRows.map((row,i)=>[currentChild.projection[i]?.id,row.raw])),expectedOperations=[];
  for(const {unit,pointer}of proposal.units.map(unit=>({unit,pointer:source.units.find(u=>u.id===unit.id).pointer})).sort((a,b)=>b.pointer.blockIndex-a.pointer.blockIndex||b.pointer.rawFrom-a.pointer.rawFrom)){if(unit.text===source.units.find(u=>u.id===unit.id).text)continue;const id=currentChild.projection[pointer.blockIndex]?.id,raw=expectedRows.get(id);if(typeof raw!=='string')fail('Language child source row identity changed.');expectedOperations.push({kind:'reviewedLanguageText',id,from:pointer.rawFrom,to:pointer.rawTo,insert:unit.text,seenBlockHash:digest(raw)});expectedRows.set(id,raw.slice(0,pointer.rawFrom)+unit.text+raw.slice(pointer.rawTo));}
  if(!same(intent.save.operations,expectedOperations)||!same(intent.save.sourceUnits,source.units)||!same(intent.save.decision,decision)||intent.save.sourceCaptureHash!==digest(stable(source))||intent.save.targetOutputId!==child.output.id)fail('Retained language save no longer matches its reviewed translation spans.');
  await check();const sourceNow=await selected(source.scope),sourceFile=sourceNow.own.paths.draft;
  const saved=await drafts.saveReviewedLanguage(intent.save,{validateReview:async reviewedInput=>{if(!same(reviewedInput,intent.save))fail('Language child save differs from the exact immutable review capability.');await check();const value=await outputs.read({...scopeCheck(source.scope),selectedOutputId:child.output.id});if(value.output?.languageEdition?.sourceOutputId!==source.scope.outputId||value.output.language!=='zh-Hans'||value.wordOwner?.bindingId!==intent.save.bindingId)fail('The reviewed target is not this exact Chinese language child.');},beforeIntent:()=>{regular(sourceFile);if(digest(fs.readFileSync(sourceFile))!==source.proof.writingProof.rawHash)fail('Translation source changed before native intent.');if(currentActor()?.actor!==decision.actor)fail('Review actor changed before native intent.',403);}});
  if(digest(saved.raw)!==intent.candidateHash)fail('Language child changed after its exact reviewed translation; inspect the saved decision.');
  if(!intent.refresh){const now=await outputs.read({...scopeCheck(source.scope),selectedOutputId:child.output.id});intent.refresh={...scopeCheck(source.scope),selectedOutputId:child.output.id,expectedOutput:now.expectedOutput,expectedNative:saved.expected,operationId:operation(operationId,'refresh')};persist();}
  await check();const refreshed=await outputs.refreshSelectedArticle(intent.refresh);intent.result={outputId:child.output.id,bindingId:child.wordOwner.bindingId,language:targetLanguage,decisionRole:decision.role,actor:decision.actor,view:refreshed.view};persist();return structuredClone(intent.result);
 }
 return {readSource,applyReviewedTranslation};
}
