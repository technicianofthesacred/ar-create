import fs from 'node:fs';
import {StateError} from '../store.mjs';
import {digest,regular,resolveInside,safeRel,atomicWrite,ensurePrivateDirectory} from './files.mjs';
import {provenance} from './actor.mjs';

// The same public-project/parent identities accepted by study-research-choices.
// Source paths are resolved only through the existing originals.list authority.
const PARENTS={hk:'hk',ancha:'ref-an-cha',collector:'ref-collector'};
const HASH=/^[a-f0-9]{64}$/;
const fail=(message,status=409)=>{throw new StateError(message,status)};
const text=(value,label,max=64*1024)=>{if(typeof value!=='string'||!value.trim()||!value.isWellFormed()||value.includes('\0')||Buffer.byteLength(value)>max)fail(label+' must contain bounded exact readable words.');return value;};
const fields=(value,allowed,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(label+' has unsupported fields.');};
const optional=(value,label)=>value==null||value===''?undefined:text(value,label);
const list=(value,label,min=0,max=200)=>{if(!Array.isArray(value)||value.length<min||value.length>max)fail(label+' must be a bounded array.');return value;};
const current=(projectKey,parentStudyId)=>({schema:'ar-create.study-derived-findings.v1',schemaVersion:1,kind:'source-backed-presentation-findings',canonicalRecord:false,projectKey,parentStudyId});
const unavailable=(base,state,reason)=>({...base,available:false,stale:state==='stale',freshness:{state,reason},verification:'No current source-backed derived findings are available.',summaryAuthorship:'',points:[]});
const plannableRole=role=>role==='research'||role==='research notes';

/** Noncanonical source-backed proposals; originals and editorial decisions remain read-only. */
export function createStudyDerivedFindings({dataDir,originals}={}){
 if(typeof originals?.list!=='function')throw TypeError('Supply the authoritative existing originals.list service.');
 resolveInside(dataDir,'',{directory:true});
 async function read(input,candidate=null){
  fields(input,['projectKey','parentStudyId'],'Derived findings request');
  const {projectKey,parentStudyId}=input;
  if(!Object.hasOwn(PARENTS,projectKey))fail('Unsupported derived-findings project.',404);
  if(PARENTS[projectKey]!==parentStudyId)fail('Derived findings belong to another parent study.');
  const base=current(projectKey,parentStudyId),root=resolveInside(dataDir,'study-derived-findings',{missing:true,directory:true});
  if(!candidate&&!fs.existsSync(root))return unavailable(base,'unavailable','No private derived findings are saved for this project.');
  const file=candidate?null:resolveInside(root,digest(projectKey)+'.json',{missing:true});
  if(!candidate&&!fs.existsSync(file))return unavailable(base,'unavailable','No private derived findings are saved for this project.');
  if(!candidate&&regular(file).size>2*1024*1024)fail('Derived findings exceed their read bound.',413);
  const raw=candidate?Buffer.from(candidate):fs.readFileSync(file),exportHash=digest(raw);let saved;
  if(raw.length>2*1024*1024)fail('Derived findings exceed their read bound.',413);
  try{saved=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{fail('Saved derived findings are malformed; preserve the private record.');}
  fields(saved,['schemaVersion','kind','projectKey','exportedOn','origin','approvalScope','canonicalRecord','importPolicy','sources','points'],'Saved derived findings');
  if(saved.schemaVersion!==1||saved.kind!==base.kind||saved.canonicalRecord!==false||saved.projectKey!==projectKey)fail('Derived findings schema, project or noncanonical identity changed.');
  optional(saved.origin,'Summary origin');optional(saved.approvalScope,'Approval scope');optional(saved.importPolicy,'Import policy');optional(saved.exportedOn,'Export date');
  const descriptors=new Map();
  for(const source of list(saved.sources,'Declared source records',1,64)){
   fields(source,['id','relativePath','absolutePath','hash'],'Declared source');text(source.id,'Source identity',256);safeRel(source.relativePath,false);
   if(!HASH.test(source.hash||'')||descriptors.has(source.id)||[...descriptors.values()].some(s=>s.path===source.relativePath))fail('Declared source identity/path/hash must be exact and unique.');
   // absolutePath is producer provenance only; it is never opened or returned.
   descriptors.set(source.id,{id:source.id,path:source.relativePath,hash:source.hash});
  }
  const originalsSnapshot=await originals.list(projectKey);
  if(originalsSnapshot?.projectKey!==projectKey||!Array.isArray(originalsSnapshot.records))fail('Original catalog belongs to another project.');
  const records=new Map();
  for(const record of originalsSnapshot.records){if(typeof record.path!=='string'||records.has(record.path))fail('Original catalog path identity is ambiguous.');safeRel(record.path,false);records.set(record.path,record);}
  const stale=[];
  for(const source of descriptors.values()){
   const record=records.get(source.path);if(!record)fail('Derived finding names a source outside the existing original project catalog.');
   if(record.missing||typeof record.raw!=='string'){stale.push('Original source is unavailable: '+source.path);continue;}
   if(!HASH.test(record.hash||'')||digest(record.raw)!==record.hash)fail('Original catalog source bytes and hash disagree.');
   if(record.hash!==source.hash)stale.push('Original source revision changed: '+source.path);
  }
  const verifiedSpan=(span,spoken=false)=>{
   fields(span,['recordId','recordPath','recordHash','excerpt','excerptHash','start','end','offsetUnit','lineStart','lineEnd',...(spoken?['speaker','location','quote']:[])],'Finding excerpt');
   const descriptor=descriptors.get(span.recordId);if(!descriptor||span.recordPath!==descriptor.path||span.recordHash!==descriptor.hash)fail('Finding excerpt source identity/hash differs from its declared record.');
   text(span.excerpt,'Exact excerpt');
   if(span.offsetUnit!=='UTF-16 code units'||!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.end)||span.start<0||span.end<=span.start||!HASH.test(span.excerptHash||'')||digest(span.excerpt)!==span.excerptHash)fail('Finding excerpt span/hash is invalid.');
   if(spoken){text(span.speaker,'Declared speaker',256);text(span.location,'Declared time/scene',256);if(text(span.quote,'Exact quotation')!==span.excerpt)fail('Quotation must equal its complete exact excerpt.');}
   const record=records.get(descriptor.path);
   if(!stale.length){
    if(span.end>record.raw.length||record.raw.slice(span.start,span.end)!==span.excerpt)fail('Finding excerpt no longer matches its exact original UTF-16 range.');
    // Older producer manifests count LF/CRLF only; new saves also recognize bare CR.
    for(const [key,offset]of [['lineStart',span.start],['lineEnd',span.end]])if(span[key]!==undefined&&(!Number.isSafeInteger(span[key])||![record.raw.slice(0,offset).split(/\r?\n/).length,record.raw.slice(0,offset).split(/\r\n|\r|\n/).length].includes(span[key])))fail('Finding excerpt line provenance changed.');
   }
   return {record,span};
  };
  const pointIds=new Set(),normalized=[];
  for(const point of list(saved.points,'Derived presentation points',1,200)){
   fields(point,['id','title','kind','clarity','spoken','retainedEvidence','existingEvidenceDescription','existingContext','query','verification','summaryAuthorship','narration','humanDecision','provenance','saveRequestHash'],'Derived presentation point');
   text(point.id,'Finding identity',256);if(pointIds.has(point.id))fail('Derived finding identity must be unique.');pointIds.add(point.id);
   text(point.title,'Finding title',1024);text(point.summaryAuthorship,'Summary authorship');text(point.verification,'Retained verification declaration');
   fields(point.clarity,['supported','uncertain','storyImplication'],'Authored finding clarity');for(const key of ['supported','uncertain','storyImplication'])text(point.clarity[key],'Authored '+key);
   if(point.narration!=null||point.humanDecision!=null)fail('Derived presentation cannot import narration or human inclusion decisions.');
   for(const key of ['kind','existingEvidenceDescription','existingContext','query'])optional(point[key],key);
   const speech=list(point.spoken,'Exact quoted excerpts').map(span=>verifiedSpan(span,true)),evidence=list(point.retainedEvidence,'Retained research excerpts').map(span=>verifiedSpan(span));
   if(!speech.length&&!evidence.length)fail('Each derived finding needs at least one exact source excerpt.');
   const anchor=evidence.find(({record,span})=>!stale.length&&plannableRole(record.role)&&record.raw.indexOf(span.excerpt)===span.start&&record.raw.lastIndexOf(span.excerpt)===span.start),canPlan=!!anchor;
   const provenance=({record,span},planning=false)=>({name:record.name||record.path,path:record.path,hash:span.recordHash,role:record.role,raw:span.excerpt,sourceOrigin:'authoritative-original-record',excerptHash:span.excerptHash,sourceRange:{from:span.start,to:span.end,offsetUnit:span.offsetUnit},...(span.lineStart!==undefined?{lineStart:span.lineStart,lineEnd:span.lineEnd}:{}),...(planning?{recordPath:record.path,recordHash:span.recordHash}:{})});
   const ordered=anchor?[provenance(anchor,true),...evidence.filter(item=>item!==anchor).map(item=>provenance(item)),...speech.map(item=>provenance(item))]:[...evidence.map(item=>provenance(item)),...speech.map(item=>provenance(item))];
   normalized.push({id:'derived-'+digest(projectKey+'\n'+point.id).slice(0,24),derivedId:point.id,...(point.provenance?{provenance:structuredClone(point.provenance)}:{}),title:point.title,kind:point.kind||'Derived presentation finding',clarity:structuredClone(point.clarity),spoken:speech.map(({record,span})=>({quote:span.quote,speaker:span.speaker,location:span.location,sourcePath:record.path,sourceHash:span.recordHash,sourceRole:record.role,sourceRange:{from:span.start,to:span.end},quotationKind:/context/i.test(record.role)?'written-source-words':'source-words',attribution:'producer-declared-speaker-location-with-exact-original-source-span',attributionVerified:false})),sources:ordered,originalText:anchor?.span.excerpt||'',pointKey:anchor?anchor.record.path+'\n'+anchor.span.excerpt:null,canPlan,...(!canPlan?{planReason:'No unique current research-note excerpt can be used by the existing editorial-choice owner.'}:{}),summaryAuthorship:point.summaryAuthorship,verification:point.verification,verificationScope:'source-integrity-only-not-independent-factual-verification',freshness:{state:stale.length?'stale':'current',exportHash},truthStatus:{state:'derived-presentation-summary',verification:'not-independently-verified-by-this-service',assessment:'Existing authored noncanonical summary; exact excerpts checked, factual claims and attribution declarations not newly assessed.'},stale:!!stale.length,decision:{state:'read-only',included:null,authority:'derived-presentation-only'},...(point.existingEvidenceDescription?{existingEvidenceDescription:point.existingEvidenceDescription}:{}),...(point.existingContext?{existingContext:point.existingContext}:{}),...(point.query?{query:point.query}:{})});
  }
  if(!candidate){regular(file);resolveInside(root,digest(projectKey)+'.json');}
  if(!candidate&&digest(fs.readFileSync(file))!==exportHash)fail('Derived findings changed during read-only validation.');
  if(stale.length)return {...unavailable(base,'stale',stale.join(' ')),exportHash};
  // Two findings sharing one choice identity would overwrite each other. Keep
  // both visible but decline plan-writing until their anchor identity is explicit.
  const duplicateAnchors=new Set(normalized.filter(p=>p.canPlan&&normalized.filter(other=>other.pointKey===p.pointKey).length!==1).map(p=>p.pointKey));
  for(const point of normalized.filter(p=>p.canPlan))if(duplicateAnchors.has(point.pointKey)){point.canPlan=false;point.planReason='Several derived findings share the same exact research-choice identity.';delete point.sources[0].recordHash;delete point.sources[0].recordPath;point.originalText='';point.pointKey=null;}
  return {...base,available:true,stale:false,exportHash,freshness:{state:'current',scope:'exact-export-and-declared-original-record-hashes',sourceHashes:[...descriptors.values()]},summaryOrigin:saved.origin||null,approvalScope:saved.approvalScope||null,canonicalRecord:false,verification:'Exact declared source hashes and excerpt ranges checked; no new independent factual verification or attribution assessment.',summaryAuthorship:[...new Set(normalized.map(p=>p.summaryAuthorship))].join('\n'),verificationProof:{sourceIntegrity:'checked',independentFactCheck:false,attributionAssessment:false},points:normalized};
 }
 let pending=Promise.resolve();
 const saveFields=['projectKey','parentStudyId','operationId','expectedExportHash','title','sourcePath','sourceHash','from','to','quote','speaker','location','clarity'];
 function save(input){
  const task=pending.then(async()=>{
   fields(input,saveFields,'Finding save');
   if(saveFields.some(key=>!Object.hasOwn(input,key)))fail('Supply one complete proposed finding.',400);
   const {projectKey,parentStudyId}=input,scope={projectKey,parentStudyId};
   const before=await read(scope);
   if(before.stale)fail('Existing finding sources changed; refresh before saving.');
   if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.operationId||''))fail('Finding operation UUID required.',400);
   if(input.expectedExportHash!==null&&!HASH.test(input.expectedExportHash||''))fail('Supply the current findings hash.',400);
   text(input.title,'Finding title',1024);text(input.speaker,'Speaker',256);text(input.location,'Transcript locator',1024);
   fields(input.clarity,['supported','uncertain','storyImplication'],'Proposed clarity');
   for(const key of ['supported','uncertain','storyImplication'])text(input.clarity[key],'Proposed '+key);
   const requestHash=digest(JSON.stringify(saveFields.map(key=>[key,key==='clarity'?['supported','uncertain','storyImplication'].map(k=>input.clarity?.[k]):input[key]])));
   const root=resolveInside(dataDir,'study-derived-findings',{missing:true,directory:true});
   const file=before.available?resolveInside(root,digest(projectKey)+'.json'):null;
   let saved;
   if(file){
    regular(file);const bytes=fs.readFileSync(file);
    if(digest(bytes)!==before.exportHash)fail('Findings changed. Refresh before saving.');
    saved=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   }else saved={schemaVersion:1,kind:'source-backed-presentation-findings',canonicalRecord:false,projectKey,origin:'Proposed source-backed findings saved through AR Create.',sources:[],points:[]};
   const prior=saved.points.find(point=>point.id===input.operationId);
   if(prior){
    if(prior.saveRequestHash!==requestHash)fail('This operation already saved a different finding.');
    return before;
   }
   if((before.exportHash||null)!==input.expectedExportHash)fail('Findings changed. Refresh before saving.');
   safeRel(input.sourcePath,false);
   const listed=await originals.list(projectKey),matches=listed?.projectKey===projectKey&&Array.isArray(listed.records)?listed.records.filter(r=>r.path===input.sourcePath):[];
   if(matches.length!==1)fail('Choose one exact original source.');
   const [record]=matches;
   if(record.role!=='source'||record.missing||typeof record.raw!=='string'||record.hash!==input.sourceHash||digest(record.raw)!==input.sourceHash||!Number.isSafeInteger(input.from)||!Number.isSafeInteger(input.to)||input.from<0||input.to<=input.from||record.raw.slice(input.from,input.to)!==input.quote)fail('The original source or passage changed. Select it again.');
   text(input.quote,'Source quote',32768);
   if(input.quote.length>8192||input.to-input.from!==input.quote.length)fail('Exact source passage range required.');
   let descriptor=saved.sources.find(source=>source.relativePath===record.path);
   if(descriptor&&descriptor.hash!==record.hash)fail('Declared source changed; refresh before saving.');
   if(!descriptor){descriptor={id:'source-'+digest(record.path).slice(0,24),relativePath:record.path,hash:record.hash};saved.sources.push(descriptor);}
   const span={recordId:descriptor.id,recordPath:record.path,recordHash:record.hash,excerpt:input.quote,excerptHash:digest(input.quote),start:input.from,end:input.to,offsetUnit:'UTF-16 code units',lineStart:record.raw.slice(0,input.from).split(/\r\n|\r|\n/).length,lineEnd:record.raw.slice(0,input.to).split(/\r\n|\r|\n/).length};
   const author=provenance();
   saved.points.push({id:input.operationId,title:input.title,kind:'Proposed source-backed finding',clarity:structuredClone(input.clarity),spoken:[{...span,quote:input.quote,speaker:input.speaker,location:input.location}],retainedEvidence:[],summaryAuthorship:'Proposed interpretation by '+author.actor+'; not adopted editorial direction.',verification:'Exact source hash and transcript span checked; speaker attribution and recording timing remain transcript declarations.',narration:null,humanDecision:null,provenance:author,saveRequestHash:requestHash});
   const bytes=JSON.stringify(saved,null,2)+'\n';
   const checked=await read(scope,bytes);
   if(!checked.available||checked.stale)fail('Source changed while preparing the finding.');
   ensurePrivateDirectory(dataDir,'study-derived-findings');
   const destination=resolveInside(dataDir,'study-derived-findings/'+digest(projectKey)+'.json',{missing:true});
   atomicWrite(destination,bytes,before.exportHash?{expectedHash:before.exportHash}:{exclusive:true});
   return checked;
  });
  pending=task.catch(()=>{});return task;
 }
 return {read:input=>read(input),save};
}
