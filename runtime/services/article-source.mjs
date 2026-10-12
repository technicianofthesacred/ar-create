/** Pure prepared-source contract. Source words/metadata are captured, never inferred by the provider. */
import {StateError} from '../store.mjs';
import {digest} from './files.mjs';
import {splitFrontmatter} from './wordforge-sources.mjs';
const marker='ar-create.source-unit:';
const cleanSpace=text=>text.replace(/\s+/gu,' ').trim();
const fields=['recording_id','language','transcription_review_status','review_status','reviewed_at','speaker_map','translation','translation_review_status','translation_coverage_status','translation_language','translation_stale','translation_source_language','translation_source_digest','translation_model','diarization_model','grade'];
const scalar=value=>{if(typeof value!=='string')return value??null;try{return JSON.parse(value);}catch{return value;}};
function capturedUnits(source){
 let body=source.text;const starts=[];
 // Existing SRC records carry notes/highlights outside the transcript. Keep
 // offsets into the full retained body while excluding only declared metadata.
 if(source.sourceRecord){const full=body.match(/^## Full Transcript\s*$/m);if(full){const end=full.index+full[0].length;body=body.slice(0,end).replace(/[^\r\n]/g,' ')+body.slice(end);}body=body.replace(/<!-- ar-create\.(?:source-unit|source-highlights|prepared-source):[^\n]* -->/g,value=>value.replace(/[^\r\n]/g,' '));}
 // Only explicit labels and times already in the retained text count. No speaker inference.
 const pattern=/^(?:\*\*([^\n*]+?):\*\*\s*|([^\n,:]+),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*:\s*|\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^\n:]+):\s*)/gm;
 for(const match of body.matchAll(pattern)){let speaker=match[1]||match[2]||match[5],locator=match[3]||match[4]||null;const timed=speaker.match(/^(.*?)\s*\[([^\]]+)\]$/);if(timed){speaker=timed[1];locator=timed[2];}let start=match.index+match[0].length;const ownTime=!locator&&body.slice(start).match(/^\[(\d{1,2}:\d{2}(?::\d{2})?(?:[–-]\d{1,2}:\d{2}(?::\d{2})?)?)\]\s*/);if(ownTime){locator=ownTime[1];start+=ownTime[0].length;}starts.push({labelStart:match.index,start,speaker:speaker.trim(),locator});}
 const units=[];
 function add(start,end,speaker=null,locator=null){while(start<end&&/\s/u.test(body[start]))start++;while(end>start&&/\s/u.test(body[end-1]))end--;if(start===end)return;units.push({id:digest(JSON.stringify([source.id,source.hash,start,end])),start,end,speaker,locator,text:body.slice(start,end)});}
 function paragraphs(start,end,speaker=null,locator=null){const text=body.slice(start,end);let at=0;const block=(from,to)=>{if(/^\s*#{1,6}\s/.test(body.slice(from,to))){speaker=null;locator=null;}add(from,to,speaker,locator);};for(const match of text.matchAll(/\n\s*\n/g)){block(start+at,start+match.index);at=match.index+match[0].length;}block(start+at,end);}
 if(!starts.length)paragraphs(0,body.length);
 else {paragraphs(0,starts[0].labelStart);for(let index=0;index<starts.length;index++){const item=starts[index];paragraphs(item.start,starts[index+1]?.labelStart??body.length,item.speaker,item.locator);}}
 return units;
}
export function captureArticleSource(source){
 if(typeof source.text!=='string'||!source.text.trim()||typeof source.hash!=='string'||!source.hash)throw new StateError('The selected source has no complete readable record.');
 const frontmatter=typeof source.raw==='string'?splitFrontmatter(source.raw).frontmatter:{},metadata={};
 for(const key of fields)if(frontmatter[key]!==undefined)metadata[key]=scalar(frontmatter[key]);
 const declared=metadata.grade??source.text.match(/^-\s*Grade(?: recorded in original)?:\s*(word for word|translated|summary only)\s*$/im)?.[1]??null;
 const grade=['word for word','translated','summary only'].includes(declared)?declared:'unknown';
 const originalReview=metadata.translation===true?(metadata.transcription_review_status??'unknown'):(source.pipelineStates?.review?.state??metadata.review_status??'unknown');
 const sourceRecord=scalar(frontmatter.type)==='SRC'||frontmatter.source_contract==='ar-create.source.v1';
 if(source.provenance?.kind==='article-prepared-source'&&Array.isArray(source.provenance.sourceIds))metadata.derived_from=[...source.provenance.sourceIds];
 const units=capturedUnits({...source,sourceRecord});
 return {id:source.id,title:source.title||source.name||'Source record',hash:source.hash,bodyHash:digest(source.text),kind:source.kind||'unknown',grade,originalReview,metadata,units};
}
const fillers=new Set(['um','umm','uh','uhh','erm','er','hmm','mm']);
const words=value=>(value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).map(word=>word.toLocaleLowerCase());
function allowedGap(text,start,end){const removed=words(text.slice(start,end));if(!removed.length)return /^\s*$/u.test(text.slice(start,end));const substantive=removed.filter(word=>!fillers.has(word));if(!substantive.length)return true;if(substantive.length>4)return false;const left=words(text.slice(0,start)),right=words(text.slice(end));return substantive.join(' ')===left.slice(-substantive.length).join(' ')||substantive.join(' ')===right.slice(0,substantive.length).join(' ');}
export function cleanedArticleSourceUnit(unit,ranges){
 if(!Array.isArray(ranges)||!ranges.length||ranges.length>1000)throw new StateError('Every prepared-source paragraph needs original text ranges.');
 let previous=0;const pieces=[];
 for(const range of ranges){if(!Array.isArray(range)||range.length!==2||!range.every(Number.isSafeInteger)||range[0]<previous||range[1]<=range[0]||range[1]>unit.text.length)throw new StateError('Prepared-source ranges overlap or escape their original paragraph.');if(!allowedGap(unit.text,previous,range[0]))throw new StateError('Source cleaning removed substantive words. Keep uncertain false starts or mishearings unchanged and flag them in notes.');pieces.push(unit.text.slice(range[0],range[1]));previous=range[1];}
 if(!allowedGap(unit.text,previous,unit.text.length))throw new StateError('Source cleaning removed substantive words.');
 const result=cleanSpace(pieces.join(' '));if(!result)throw new StateError('A prepared-source paragraph cannot silently disappear.');return result;
}
function line(value){return cleanSpace(String(value??'unknown')).replace(/[\r\n]/g,' ');}
function highlightUnits(inputs){const all=inputs.sources.flatMap(source=>source.units.map(unit=>({source,unit}))),speech=all.filter(item=>item.unit.speaker);return speech.length?speech:all;}
export function renderArticleSource(inputs,selections=null,highlights=null){
 const byUnit=selections?new Map(selections.map(item=>[item.unitId,item])):null;
 const title=inputs.sources.length===1?inputs.sources[0].title:'Selected source records';
 const lines=['---','type: SRC','status: for-your-yes',`title: ${JSON.stringify(title)}`,'source_contract: ar-create.source.v1','prepared_review: unreviewed','---','',`# ${line(title)}`,'','## Source Notes',''];
 for(const source of inputs.sources){lines.push(`- Source: ${line(source.title)} (ID ${source.id})`,`- Original SHA-256: ${source.hash}`,`- Grade recorded in original: ${source.grade}`,`- Original review: ${line(source.originalReview)}; prepared source: unreviewed`,`- Language recorded: ${line(source.metadata.language)}`,`- Translation recorded: ${Object.hasOwn(source.metadata,'translation')?line(source.metadata.translation):'unknown'}; translation review: ${line(source.metadata.translation_review_status)}; translation stale: ${line(source.metadata.translation_stale)}${Object.hasOwn(source.metadata,'translation_coverage_status')?'; translation coverage: '+line(source.metadata.translation_coverage_status):''}${Object.hasOwn(source.metadata,'translation_language')?'; translated language: '+line(source.metadata.translation_language):''}`,'');}
 const eligible=highlightUnits(inputs),highlightIds=highlights||eligible.slice(0,15).map(item=>item.unit.id);
 const rank=new Map(eligible.map((item,index)=>[item.unit.id,index]));
 if(!Array.isArray(highlightIds)||highlightIds.length<Math.min(10,eligible.length)||highlightIds.length>15||new Set(highlightIds).size!==highlightIds.length||highlightIds.some((id,index)=>!rank.has(id)||(index>0&&rank.get(id)<=rank.get(highlightIds[index-1]))))throw new StateError('Highlights must select actual source moments once, in chronological source order (10–15, or all moments in a shorter source).');
 lines.push('## Highlights',`<!-- ar-create.source-highlights:${JSON.stringify(highlightIds)} -->`,'');
 for(const id of highlightIds){const {source,unit}=eligible[rank.get(id)],excerpt=cleanSpace(unit.text),points=Array.from(excerpt),short=points.length>140?points.slice(0,140).join('')+'…':excerpt;lines.push(`- ${unit.locator?'['+line(unit.locator)+'] ':''}${short}${unit.speaker?' · '+line(unit.speaker):''} (source ${source.id})`);}
 lines.push('','## Full Transcript','');
 for(const source of inputs.sources){if(inputs.sources.length>1)lines.push(`### ${line(source.title)}`,'');for(const unit of source.units){const selected=byUnit?.get(unit.id),ranges=selected?.ranges||[[0,unit.text.length]],entry={sourceId:source.id,unitId:unit.id,ranges};lines.push(`<!-- ${marker}${JSON.stringify(entry)} -->`);if(unit.speaker)lines.push(`**${line(unit.speaker)}:**`);if(unit.locator)lines.push(`[${line(unit.locator)}]`);lines.push(cleanedArticleSourceUnit(unit,ranges),'');}}
 return lines.join('\n');
}
export function validateArticleSource(raw,inputs){
 const selections=[];for(const match of raw.matchAll(/<!-- ar-create\.source-unit:([^\n]+) -->/g)){let entry;try{entry=JSON.parse(match[1]);}catch{throw new StateError('The prepared source has an invalid original-evidence receipt.');}if(!entry||Object.keys(entry).sort().join(',')!=='ranges,sourceId,unitId'||typeof entry.sourceId!=='string'||typeof entry.unitId!=='string')throw new StateError('The prepared source has an invalid original-evidence receipt.');selections.push(entry);}
 const units=inputs.sources.flatMap(source=>source.units.map(unit=>({sourceId:source.id,unitId:unit.id})));
 if(selections.length!==units.length||selections.some((entry,index)=>entry.sourceId!==units[index].sourceId||entry.unitId!==units[index].unitId))throw new StateError('The prepared source omitted, duplicated or reordered original paragraphs or source identities.');
 const highlights=raw.match(/<!-- ar-create\.source-highlights:([^\n]+) -->/);if(!highlights)throw new StateError('The prepared source has no traceable Highlights receipt.');let highlightIds;try{highlightIds=JSON.parse(highlights[1]);}catch{throw new StateError('The prepared source has an invalid Highlights receipt.');}
 const expected=renderArticleSource(inputs,selections,highlightIds);
 if(raw.replace(/\r\n/g,'\n').trimEnd()!==expected.trimEnd())throw new StateError('The prepared source changed speaker, timing, grade, review metadata or substantive source words. Use the captured template and evidence ranges; paraphrased narration is not a transcript.');
 return {contract:inputs.schema,requestId:inputs.requestId,sourceIds:inputs.sources.map(source=>source.id),highlightUnitIds:highlightIds,traceabilityVerified:true,preparedReview:'unreviewed',references:inputs.sources.map(source=>({id:source.id,title:source.title,hash:source.hash,bodyHash:source.bodyHash,kind:source.kind,grade:source.grade,originalReview:source.originalReview,metadata:source.metadata,units:source.units.map(({text,...unit})=>unit)}))};
}
