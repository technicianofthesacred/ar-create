import fs from 'node:fs';
import {StateError} from '../store.mjs';
import {digest,regular,resolveInside,safeRel} from './files.mjs';

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

/** Read existing authored presentation summaries only. No originals writeback,
 * import, source discovery, model, manuscript save or editorial decision owner. */
export function createStudyDerivedFindings({dataDir,originals}={}){
 if(typeof originals?.list!=='function')throw TypeError('Supply the authoritative existing originals.list service.');
 resolveInside(dataDir,'',{directory:true});
 return {async read(input){
  fields(input,['projectKey','parentStudyId'],'Derived findings request');
  const {projectKey,parentStudyId}=input;
  if(!Object.hasOwn(PARENTS,projectKey))fail('Unsupported derived-findings project.',404);
  if(PARENTS[projectKey]!==parentStudyId)fail('Derived findings belong to another parent study.');
  const base=current(projectKey,parentStudyId),root=resolveInside(dataDir,'study-derived-findings',{missing:true,directory:true});
  if(!fs.existsSync(root))return unavailable(base,'unavailable','No private derived findings are saved for this project.');
  const file=resolveInside(root,digest(projectKey)+'.json',{missing:true});
  if(!fs.existsSync(file))return unavailable(base,'unavailable','No private derived findings are saved for this project.');
  if(regular(file).size>2*1024*1024)fail('Derived findings exceed their read bound.',413);
  const raw=fs.readFileSync(file),exportHash=digest(raw);let saved;
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
    for(const [key,offset]of [['lineStart',span.start],['lineEnd',span.end]])if(span[key]!==undefined&&(!Number.isSafeInteger(span[key])||span[key]!==record.raw.slice(0,offset).split(/\r?\n/).length))fail('Finding excerpt line provenance changed.');
   }
   return {record,span};
  };
  const pointIds=new Set(),normalized=[];
  for(const point of list(saved.points,'Derived presentation points',1,200)){
   fields(point,['id','title','kind','clarity','spoken','retainedEvidence','existingEvidenceDescription','existingContext','query','verification','summaryAuthorship','narration','humanDecision'],'Derived presentation point');
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
   normalized.push({id:'derived-'+digest(projectKey+'\n'+point.id).slice(0,24),derivedId:point.id,title:point.title,kind:point.kind||'Derived presentation finding',clarity:structuredClone(point.clarity),spoken:speech.map(({record,span})=>({quote:span.quote,speaker:span.speaker,location:span.location,sourcePath:record.path,sourceHash:span.recordHash,sourceRole:record.role,sourceRange:{from:span.start,to:span.end},quotationKind:/context/i.test(record.role)?'written-source-words':'source-words',attribution:'producer-declared-speaker-location-with-exact-original-source-span',attributionVerified:false})),sources:ordered,originalText:anchor?.span.excerpt||'',pointKey:anchor?anchor.record.path+'\n'+anchor.span.excerpt:null,canPlan,...(!canPlan?{planReason:'No unique current research-note excerpt can be used by the existing editorial-choice owner.'}:{}),summaryAuthorship:point.summaryAuthorship,verification:point.verification,verificationScope:'source-integrity-only-not-independent-factual-verification',freshness:{state:stale.length?'stale':'current',exportHash},truthStatus:{state:'derived-presentation-summary',verification:'not-independently-verified-by-this-service',assessment:'Existing authored noncanonical summary; exact excerpts checked, factual claims and attribution declarations not newly assessed.'},stale:!!stale.length,decision:{state:'read-only',included:null,authority:'derived-presentation-only'},...(point.existingEvidenceDescription?{existingEvidenceDescription:point.existingEvidenceDescription}:{}),...(point.existingContext?{existingContext:point.existingContext}:{}),...(point.query?{query:point.query}:{})});
  }
  regular(file);resolveInside(root,digest(projectKey)+'.json');
  if(digest(fs.readFileSync(file))!==exportHash)fail('Derived findings changed during read-only validation.');
  if(stale.length)return {...unavailable(base,'stale',stale.join(' ')),exportHash};
  // Two findings sharing one choice identity would overwrite each other. Keep
  // both visible but decline plan-writing until their anchor identity is explicit.
  const duplicateAnchors=new Set(normalized.filter(p=>p.canPlan&&normalized.filter(other=>other.pointKey===p.pointKey).length!==1).map(p=>p.pointKey));
  for(const point of normalized.filter(p=>p.canPlan))if(duplicateAnchors.has(point.pointKey)){point.canPlan=false;point.planReason='Several derived findings share the same exact research-choice identity.';delete point.sources[0].recordHash;delete point.sources[0].recordPath;point.originalText='';point.pointKey=null;}
  return {...base,available:true,stale:false,exportHash,freshness:{state:'current',scope:'exact-export-and-declared-original-record-hashes',sourceHashes:[...descriptors.values()]},summaryOrigin:saved.origin||null,approvalScope:saved.approvalScope||null,canonicalRecord:false,verification:'Exact declared source hashes and excerpt ranges checked; no new independent factual verification or attribution assessment.',summaryAuthorship:[...new Set(normalized.map(p=>p.summaryAuthorship))].join('\n'),verificationProof:{sourceIntegrity:'checked',independentFactCheck:false,attributionAssessment:false},points:normalized};
 }};
}
