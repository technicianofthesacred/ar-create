// Read-only presentation of recording-owned reviews. No answers, transcript writes or new review authority.
import fs from 'node:fs';
import path from 'node:path';
import {findDoubtful,findFixes} from './word-recognise.mjs';
import {resolveInside,readJson} from './files.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const recordingAsk=a=>['recording-words','recording-check'].includes(a.scope?.kind);
const compact=s=>String(s||'').replace(/\s+/g,' ').trim();
const excerpt=(s,n=180)=>compact(s).slice(0,n);

export function recordingPurpose(job,segments=[]){
 if(job?.purpose==='test'||job?.purpose==='verification'||job?.isTest===true||job?.synthetic===true||job?.metadata?.purpose==='test')return 'test';
 const speech=compact(segments.map(s=>s.text).join(' ')).toLowerCase();
 // Whole microphone/system checks only. A work title or a mention of testing is not evidence of a test recording.
 if(speech.split(/\s+/).length<=24&&(
  /^(?:(?:mic(?:rophone)?|audio|recording|sound) (?:check|test)[.!?, ]*)?(?:test(?:ing)?[.!?, \d-]*)+$/.test(speech)||
  /^\w+ verification, the .+ speaks through .+, and the .+ is clear[.! ]*$/.test(speech)
 ))return 'test';
 return 'work';
}
export function recordingTitle(job,segments=[]){
 const title=compact(job?.story||job?.title);
 if(title&&!/^phone-[a-f0-9-]{36}$/i.test(title)&&!UUID.test(title))return excerpt(title,100);
 return excerpt(segments.find(s=>compact(s.text))?.text||'Untitled recording',90);
}
export function qualifiedWords(rec,snap,lib){
 const result=snap.result,possible=findDoubtful(result,lib.entries||[],{kept:lib.kept||{}}).items;
 const candidates=new Map(possible.map(i=>[i.key,i]));
 // A confirmed known mishearing offered on an already reviewed transcript is still supported evidence.
 for(const c of findFixes(result,lib.entries||[]).changes)candidates.set('near-match:'+c.heard.toLowerCase(),{suggestion:c.spelling,entryId:c.entryId});
 const currentEvidence=rec?.attentionVersion===2&&rec.basis===snap.expected.revision&&rec.libraryRevision===lib.revision;
 return (rec?.items||[]).filter(i=>i.status!=='open'||(((currentEvidence&&rec.qualifiedKeys?.includes(i.key))||(candidates.has(i.key)&&(candidates.get(i.key).suggestion||null)===(i.suggestion||null)&&(candidates.get(i.key).entryId||null)===(i.entryId||null)))&&result.segments[i.segmentIndex]?.text.includes(i.sentence)));
}
export function recordingContext(job,snap,item){
 const segments=snap.result.segments||[],index=item.segmentIndex??item.indexes?.[0];
 const last=item.indexes?.at(-1)??index;
 const from=segments[Math.max(0,index-1)],to=segments[Math.min(segments.length-1,last+1)];
 const start=Math.max(0,Number(from?.start)),end=Number(to?.end);
 let audioUrl=null;
 try{if(Number.isFinite(start)&&Number.isFinite(end)&&end>start){const file=resolveInside(path.dirname(path.dirname(job.output)),path.relative(path.dirname(path.dirname(job.output)),job.source));if(fs.statSync(file).isFile())audioUrl='/transcription/'+job.id+'/audio#t='+start+','+end;}}catch{/* Original unavailable; never invent a playable link. */}
 return {at:Number(segments[index]?.start)||0,start:Number.isFinite(start)?start:0,end:Number.isFinite(end)?end:0,audioUrl,
  context:segments.slice(Math.max(0,index-1),Math.min(segments.length,last+2)).map(s=>s.text).join(' ')};
}
export const wordReason=i=>i.kind==='near-match'?'A possible name or a previously confirmed mishearing.':i.kind==='number'?'The speech model was uncertain about this number.':i.kind==='unknown-name'?'The name is uncertain and is not in your confirmed vocabulary.':'The speech model was uncertain about this word.';

export function createRecordingAttention({dataDir,corrections,library}){
 return async asks=>{
  const groups=new Map(),out=[];
  for(const ask of asks){
   if(!recordingAsk(ask)||!['open','defaulted'].includes(ask.status)){out.push(ask);continue;}
   const id=ask.scope.id;if(!UUID.test(id||''))continue;
   if(!groups.has(id))groups.set(id,[]);groups.get(id).push(ask);
  }
  const lib=groups.size?await library.snapshot():null;
  for(const [id,rows] of groups){
   try{
    const job=readJson(path.join(dataDir,'recordings/.transcription-jobs',id+'.json'),null);
    if(job?.id!==id||job.state!=='done'||!job.transcriptReady)continue;
    const snap=corrections.read(id);if(recordingPurpose(job,snap.result.segments)==='test')continue;
    const words=readJson(path.join(dataDir,'word-library/recordings',id+'.json'),null);
    const checked=readJson(path.join(dataDir,'transcript-checks',id+'.json'),null);
    const wordItems=rows.some(a=>a.scope.kind==='recording-words')?qualifiedWords(words,snap,lib).filter(i=>i.status==='open'):[];
    const current=checked?.state==='ready'&&(checked.basis===snap.expected.revision||checked.ownRevisions?.includes(snap.expected.revision));
    const passages=rows.some(a=>a.scope.kind==='recording-check')&&current?(checked.problems||[]).filter(p=>!checked.decisions?.[p.id]&&p.reason?.trim()&&p.indexes?.length&&p.indexes.every(i=>snap.result.segments[i])):[];
    if(!wordItems.length&&!passages.length)continue;
    const title=recordingTitle(job,snap.result.segments),items=[
     ...passages.map(p=>({kind:'passage',text:p.indexes.map(i=>snap.result.segments[i].text).join(' '),proposed:p.fixes?.map(f=>f.text).join(' ')||null,reason:p.reason,...recordingContext(job,snap,p)})),
     ...wordItems.map(i=>({kind:'word',text:i.sentence,proposed:i.suggestion||null,reason:'Check “'+i.word+'”. '+wordReason(i),...recordingContext(job,snap,i)}))
    ];
    const distinct=[];for(const item of items){const same=distinct.find(i=>i.text===item.text&&i.start===item.start&&i.end===item.end&&(!i.proposed||!item.proposed||i.proposed===item.proposed));if(same){if(item.reason!==same.reason)same.reason+=' '+item.reason;if(!same.proposed)same.proposed=item.proposed;}else distinct.push(item);}
    const row=rows.find(a=>a.scope.kind==='recording-check')||rows[0];
    out.push({...row,status:'open',resolution:null,band:'only-adrian',default:null,applyAt:null,choices:[],about:title,
     question:'Review '+(passages.length?passages.length+' passage'+(passages.length===1?'':'s'):'')+(passages.length&&wordItems.length?' and ':'')+(wordItems.length?wordItems.length+' word'+(wordItems.length===1?'':'s'):'')+' in this recording.',
     recording:{jobId:id,title,recordedAt:job.recordedAt||null,wordCount:wordItems.length,passageCount:passages.length,items:distinct,
      wordsHref:wordItems.length?'/document-study/index.html#words/check/'+id:null,
      transcriptHref:passages.length?'/transcript-check/index.html?job='+id:null}});
   }catch{/* A missing or unsafe source cannot support a request for an editorial decision. */}
  }
  return out;
 };
}
