// Recording-owned correction boundary. Never grants Library write permission.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {StateError} from '../store.mjs';
import {provenance} from './actor.mjs';
import {atomicWrite, digest, ensurePrivateDirectory, readJson, regular, resolveInside} from './files.mjs';
import {markdownTranscript, readableTranscript, timestamp, reviewEligibility} from './magazine/outputs.mjs';
import {markdownText} from './magazine/conversation.mjs';
import {translationStatus,loadTranslation,writeTranslationOutputs} from './magazine/translation.mjs';
const fail = message => { throw new StateError(message,409); };
const json = value => JSON.stringify(value,null,2)+'\n';
const text = file => { regular(file); return fs.readFileSync(file,'utf8'); };
const hash = file => { regular(file); return digest(fs.readFileSync(file)); };
const allowed = new Set(['index','text','speaker']);
function prefix(job,result,config){return markdownTranscript(job,{...result,segments:[]},config).replace(/\n+$/,'\n\n');}
function label(result,id){return id === null ? 'Unassigned' : result.speakers.findIndex(s=>s.id===id) >= 0 ? result.speakers.find(s=>s.id===id).name || `Speaker ${result.speakers.findIndex(s=>s.id===id)+1}` : null;}
function segmentMarkdown(job,result,index){const s=result.segments[index];return `<!-- ar-segment:${job.id}:${index} -->\n**${markdownText(label(result,s.speaker))} [${timestamp(s.start)}–${timestamp(s.end)}]:** ${markdownText(s.text.trim())}`;}
export function physicalTranscriptMarkdown(job,result,config){return prefix(job,result,config)+result.segments.map((_,i)=>segmentMarkdown(job,result,i)).join('\n\n')+'\n';}
function correctionsFromMarkdown(job,result,base,edited,config){
 const pre=prefix(job,result,config);if(!edited.startsWith(pre))fail('Only existing segment words and known speaker labels may change. Frontmatter, review and recording details must stay unchanged.');
 const blocks=edited.slice(pre.length).replace(/\n$/,'').split('\n\n');if(blocks.length!==result.segments.length)fail('Segment insertion, removal, splitting and reordering are not supported. Saved Markdown is preserved.');
 const changes=[];
 for(let i=0;i<blocks.length;i++){
  const marker=`<!-- ar-segment:${job.id}:${i} -->\n`;if(!blocks[i].startsWith(marker))fail('Segment identity changed. Restore its marker before inspecting again.');
  const segment=result.segments[i],body=blocks[i].slice(marker.length),known=[null,...result.speakers.map(s=>s.id)];
  const matches=known.filter(s=>body.startsWith(`**${markdownText(label(result,s))} [${timestamp(segment.start)}–${timestamp(segment.end)}]:** `));
  if(matches.length!==1)fail('Speaker must match one known, uniquely named speaker; segment timestamps must stay unchanged.');
  const speaker=matches[0],heading=`**${markdownText(label(result,speaker))} [${timestamp(segment.start)}–${timestamp(segment.end)}]:** `;
  const words=body.slice(heading.length),decoded=words.replace(/\\([\\`*_[\]<>#])/g,'$1');
  if(markdownText(decoded)!==words||!decoded.trim()||decoded.length>12000||/[\r\n\x00]/.test(decoded))fail('Use plain segment wording on its existing line. Unsupported Markdown is preserved for manual recovery.');
  if(decoded!==segment.text||speaker!==segment.speaker)changes.push({index:i,text:decoded,speaker});
 }
 if(physicalTranscriptMarkdown(job,result,config)!==base)fail('The captured segment mapping no longer matches the transcript.');
 return changes;
}
function apply(result,corrections){
 if(!Array.isArray(corrections)||!corrections.length||corrections.length>result.segments.length)throw new StateError('Provide bounded existing segment corrections.');
 const next=structuredClone(result),seen=new Set();
 for(const c of corrections){
  if(!c||typeof c!=='object'||Object.keys(c).some(k=>!allowed.has(k))||!Number.isInteger(c.index)||!next.segments[c.index]||seen.has(c.index))throw new StateError('Invalid segment correction.');seen.add(c.index);
  const s=next.segments[c.index],newText=c.text===undefined?s.text:c.text,newSpeaker=c.speaker===undefined?s.speaker:c.speaker;
  if(typeof newText!=='string'||!newText.trim()||newText.length>12000||/[\r\n\x00]/.test(newText)||!(newSpeaker===null||next.speakers.some(s=>s.id===newSpeaker)))throw new StateError('Use existing segment text and known speaker IDs only.');
  if(s.text!==newText.trim()){s.words=[];s.word_timestamps_status='invalidated_by_text_edit';}else if(s.speaker!==newSpeaker){for(const word of s.words||[])word.speaker=newSpeaker;}
  s.text=newText.trim();s.speaker=newSpeaker;
 }
 next.metadata={...next.metadata,review:{status:'unreviewed',reviewedAt:null}};return next;
}
export function createTranscriptCorrections({dir,config,afterPublishFile=null}){
 function existingPrivateDirectory(root,name){for(const file of [root,path.join(root,name)]){let stat;try{stat=fs.lstatSync(file);}catch{fail('Existing transcript mapping directory is unavailable.');}if(!stat.isDirectory()||stat.isSymbolicLink())fail('Existing transcript mapping directory is unavailable.');}return path.join(root,name);}
 function files(id,readOnly=false){
  if(!/^[a-f0-9-]{36}$/.test(id))throw new StateError('Unknown recording.',404);
  const jobs=readOnly?existingPrivateDirectory(dir,'.transcription-jobs'):ensurePrivateDirectory(dir,'.transcription-jobs'),jobFile=path.join(jobs,id+'.json');
  if(readOnly)regular(jobFile);
  const jobRaw=readOnly?text(jobFile):null,job=readOnly?JSON.parse(jobRaw):readJson(jobFile,null);
  if(!job||job.id!==id||job.state!=='done'||!job.transcriptReady||typeof job.output!=='string')throw new StateError('Transcript is not ready.',404);
  const output=resolveInside(dir,path.relative(dir,job.output),{directory:true});
  const receipts=readOnly?existingPrivateDirectory(output,'.corrections'):ensurePrivateDirectory(output,'.corrections');
  return {job,output,receipts,readOnly,...(readOnly?{jobInputHash:digest(jobRaw)}:{}),paths:{json:path.join(output,'transcript.json'),md:path.join(output,'transcript.md'),txt:path.join(output,'transcript.txt'),job:jobFile,base:path.join(receipts,'base.json')}};
 }
 function target(f,role){if(f.paths[role])return f.paths[role];if(/^(?:translation\.[a-z]{2,3}(?:-[A-Za-z]{2,4})?\.(?:json|md|txt)|bilingual\.[a-z]{2,3}(?:-[A-Za-z]{2,4})?\.md)$/.test(role))return path.join(f.output,role);fail('Unknown publication file.');}
 function protectedFiles(f){
  const audio=resolveInside(dir,path.relative(dir,f.job.source));
  const rawRoot=f.readOnly?resolveInside(dir,'vault/Workflow/0-Inbox',{directory:true}):ensurePrivateDirectory(dir,'vault/Workflow/0-Inbox');
  if(typeof f.job.raw!=='string')fail('Immutable RAW is missing; correction requires recovery.');
  const raw=resolveInside(rawRoot,path.relative(rawRoot,f.job.raw));const rawHash=hash(raw);
  if(f.job.rawCandidateSha256&&rawHash!==f.job.rawCandidateSha256)fail('Immutable RAW changed; correction requires recovery.');
  const alignment=path.join(f.output,'transcribe.json');
  return {audioHash:hash(audio),rawHash,alignmentHash:fs.existsSync(alignment)?hash(alignment):null};
 }
 function lock(id,operation){
  const f=files(id),file=path.join(f.receipts,'writer.lock');
  if(fs.existsSync(file)){regular(file);const pid=Number(text(file));let live=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')live=false;}if(live)fail('A transcript write is in progress. Inspect again when it finishes.');fs.rmSync(file);}
  fs.writeFileSync(file,String(process.pid),{flag:'wx',mode:0o600});
  try{recover(f);return operation(f);}finally{fs.rmSync(file,{force:true});}
 }
 function recover(f){
  const pending=path.join(f.receipts,'publication.json');if(!fs.existsSync(pending))return;
  const receipt=readJson(pending,null);if(receipt.jobId!==f.job.id)fail('Publication identity needs recovery.');
  const guards=protectedFiles(f);if(JSON.stringify(guards)!==JSON.stringify(receipt.protected))fail('RAW, audio or alignment changed during publication.');
  for(const [role,entry] of Object.entries(receipt.files)){
   const file=target(f,role),current=fs.existsSync(file)?text(file):null;
   if(current!==entry.before&&current!==entry.after)fail('Unexpected edit during publication. Exact old and new bytes remain in the receipt; restore a matching version before retrying recovery.');
  }
  for(const [role,entry] of Object.entries(receipt.files)){const file=target(f,role),current=fs.existsSync(file)?text(file):null;if(current!==entry.after)atomicWrite(file,entry.after,{expectedHash:current===null?null:digest(current),exclusive:current===null});}
  atomicWrite(path.join(f.receipts,receipt.id+'.publication.json'),json({...receipt,status:'committed'}));
  const proposalFile=path.join(f.receipts,receipt.id+'.proposal.json'),proposal=readJson(proposalFile,null);if(proposal?.status==='pending'&&['applied','rejected'].includes(receipt.status))atomicWrite(proposalFile,json({...proposal,status:receipt.status,decidedAt:new Date().toISOString()}));
  fs.rmSync(pending);f.job=readJson(f.paths.job,null);
 }
 function publish(f,result,md,{id=randomUUID(),status='applied',expected=null}={}){
  const before=Object.fromEntries(Object.entries(f.paths).map(([role,file])=>[role,fs.existsSync(file)?text(file):null]));
  const nextJob={...f.job};delete nextJob.saved;
  const base={version:1,jobId:f.job.id,json:json(result),markdown:md};
  const after={json:json(result),md,txt:readableTranscript(result),job:json(nextJob),base:json(base)};
  const stage=ensurePrivateDirectory(f.receipts,'projection-'+id);
  try{for(const status of translationStatus(f.job,result)){if(['running','queued'].includes(status.state))continue;const translated=loadTranslation(f.job,result,status.language);if(translated)writeTranslationOutputs(config,{...f.job,output:stage},result,translated);}for(const name of fs.readdirSync(stage)){const file=target(f,name);before[name]=fs.existsSync(file)?text(file):null;after[name]=text(path.join(stage,name));}}finally{fs.rmSync(stage,{recursive:true,force:true});}
  if(expected)checkExpected(snapshot(f),expected);
  const receipt={id,jobId:f.job.id,status,protected:protectedFiles(f),files:Object.fromEntries(Object.keys(after).map(role=>[role,{before:before[role],after:after[role]}]))};
  atomicWrite(path.join(f.receipts,'publication.json'),json(receipt));
  for(const [role,entry] of Object.entries(receipt.files)){atomicWrite(target(f,role),entry.after,{expectedHash:entry.before===null?null:digest(entry.before),exclusive:entry.before===null});afterPublishFile?.(role,receipt);}
  recover(f);return snapshot(f);
 }
 function initialize(f){
  if(fs.existsSync(f.paths.base))return;
  const result=JSON.parse(text(f.paths.json)),existing=fs.existsSync(f.paths.md)?text(f.paths.md):null;
  if(existing!==null&&existing!==markdownTranscript(f.job,result,config)&&existing!==physicalTranscriptMarkdown(f.job,result,config))fail('An uncaptured physical Markdown edit already exists. It is preserved; reconcile it with the structured transcript before enabling segment mapping.');
  publish(f,result,physicalTranscriptMarkdown(f.job,result,config),{status:'mapping-initialized'});
 }
 function snapshot(f){
  const raw=text(f.paths.json),markdown=text(f.paths.md),result=JSON.parse(raw),base=readJson(f.paths.base,null);
  const workingText=text(f.paths.txt);if(workingText!==readableTranscript(result))fail('Physical plain-text transcript changed outside the correction boundary. Its bytes are preserved for recovery.');
  const guards=protectedFiles(f),expected={jobId:f.job.id,textHash:digest(workingText),jsonHash:digest(raw),markdownHash:digest(markdown),jobHash:hash(f.paths.job),revision:digest(raw+'\0'+markdown),...guards};
  const external=base&&markdown!==base.markdown;
  if(base&&raw!==base.json)fail('Structured transcript changed outside its correction boundary. Saved files are preserved for recovery.');
  let corrections=null,problem=null;if(external){try{corrections=correctionsFromMarkdown(f.job,result,base.markdown,markdown,config);}catch(error){problem=error.message;}}
  const pending=fs.readdirSync(f.receipts).filter(name=>name.endsWith('.proposal.json')).map(name=>readJson(path.join(f.receipts,name),null)).filter(r=>r.status==='pending').map(r=>({id:r.id,reason:r.reason,kind:r.kind}));
  return {jobId:f.job.id,path:f.paths.md,expected,markdown,result,segments:result.segments.map((s,index)=>({index,identity:`${f.job.id}:${index}`,start:s.start,end:s.end,speaker:s.speaker,text:s.text})),provenance:{audio:f.job.source,raw:f.job.raw,alignment:path.join(f.output,'transcribe.json')},reviewStatus:external?'unreviewed':result.metadata?.review?.status||'unreviewed',external:{changed:!!external,supported:external?!problem:true,problem,corrections},pending};
 }
 function checkExpected(current,expected){if(!expected||Object.keys(current.expected).some(key=>expected[key]!==current.expected[key])||Object.keys(expected).some(key=>!(key in current.expected)))fail('Transcript changed since inspection. Inspect the current file before applying or reviewing.');}
 function noActiveTranslation(f,result){if(translationStatus(f.job,result).some(s=>['running','queued'].includes(s.state)))fail('Wait for the current translation to finish before changing, reviewing or saving its source.');}
 function clean(f,expected){const current=snapshot(f);noActiveTranslation(f,current.result);checkExpected(current,expected);if(current.external.changed)fail('Physical Markdown has pending edits. Inspect and apply or reject them first.');return current;}
 function proposal(f,{expected,corrections,reason='',kind='correction'}){
  const current=snapshot(f);checkExpected(current,expected);if(kind==='correction'&&current.external.changed)fail('Inspect the physical Markdown edits before proposing another correction.');
  const next=apply(current.result,corrections),id=randomUUID(),receipt={version:1,id,jobId:f.job.id,kind,status:'pending',createdAt:new Date().toISOString(),reason:String(reason).slice(0,4000),expected,corrections,before:{json:text(f.paths.json),markdown:current.markdown},after:{json:json(next),markdown:physicalTranscriptMarkdown(f.job,next,config)},changes:corrections.map(c=>({index:c.index,start:current.result.segments[c.index].start,end:current.result.segments[c.index].end,before:{text:current.result.segments[c.index].text,speaker:current.result.segments[c.index].speaker},after:{text:next.segments[c.index].text,speaker:next.segments[c.index].speaker}}))};
  atomicWrite(path.join(f.receipts,id+'.proposal.json'),json(receipt),{exclusive:true});return receipt;
 }
 return {
  recoveryInfo(id){const f=files(id),pending=readJson(path.join(f.receipts,'publication.json'),null);return {jobId:id,path:f.paths.md,publicationId:pending?.id||null,files:pending?Object.entries(pending.files).filter(([role])=>['json','md','txt'].includes(role)).map(([role,entry])=>({role,path:f.paths[role],current:fs.existsSync(f.paths[role])?text(f.paths[role]):null,before:entry.before,after:entry.after})):[],reason:pending?'Restore an exact recorded before/after version for any unexpectedly edited file, then recover. Recovery preserves RAW, audio and alignment.':'No pending publication. Existing uncaptured edits require manual reconciliation; nothing will overwrite them.'};},
  sourceSnapshot(source){
   if(source?.rootId!=='recordings'||!/(^|\/)transcript\.(md|txt|json)$/.test(source.rel_path||''))return {managed:false};
   try{
    const physical=source.path||path.join(dir,source.rel_path),output=path.dirname(physical),id=path.basename(output);
    if(!/^[a-f0-9-]{36}$/.test(id))return {managed:false};
    const job=readJson(path.join(dir,'.transcription-jobs',id+'.json'),null);
    if(!job)return {managed:false};
    if(typeof job.output!=='string'||path.resolve(job.output)!==path.resolve(output))throw new StateError('Saved transcript location differs from its recording. Reconnect or recover the saved recording before using this transcript.',409);
    resolveInside(dir,path.relative(dir,physical));regular(physical);
    const receiptDir=path.join(output,'.corrections');
    if(fs.existsSync(path.join(receiptDir,'publication.json')))return {managed:true,coherent:false,reviewStatus:'unreviewed',jobId:id,reason:'Transcript publication requires recovery.'};
    const base=readJson(path.join(receiptDir,'base.json'),null),result=JSON.parse(text(path.join(output,'transcript.json'))),markdown=text(path.join(output,'transcript.md'));
    const coherent=base ? base.json===text(path.join(output,'transcript.json'))&&base.markdown===markdown&&readableTranscript(result)===text(path.join(output,'transcript.txt')) : markdown===markdownTranscript(job,result,config);
    const expected={jobId:id,jsonHash:hash(path.join(output,'transcript.json')),markdownHash:digest(markdown),revision:digest(text(path.join(output,'transcript.json'))+'\0'+markdown)};
    const rv=coherent&&result.metadata?.review?.status==='reviewed'?result.metadata.review:null;
    return {managed:true,coherent,reviewStatus:coherent?result.metadata?.review?.status||'unreviewed':'unreviewed',...(rv?{reviewedBy:typeof rv.by==='string'?rv.by:null,reviewedAt:rv.reviewedAt||null}:{}),jobId:id,expected,reason:coherent?null:'Physical transcript edits need inspection in the recording workshop.'};
   }catch(error){return {managed:true,coherent:false,reviewStatus:'unreviewed',reason:error.message};}
  },
  // Inspection never initializes, recovers or acquires the writer's lock.
  peek(id){const f=files(id,true);if(!fs.existsSync(f.paths.base))fail('Open the canonical Source transcript to initialize its mapping before read-only inspection.');const mappingHash=hash(f.paths.base),guard=()=>{if(hash(f.paths.base)!==mappingHash||hash(f.paths.job)!==f.jobInputHash)fail('Transcript mapping or recording changed during inspection.');if(fs.existsSync(path.join(f.receipts,'writer.lock'))||fs.existsSync(path.join(f.receipts,'publication.json')))fail('Transcript writer or publication recovery is in progress.');for(const name of fs.readdirSync(f.receipts).filter(name=>name.endsWith('.proposal.json')))regular(path.join(f.receipts,name));};guard();const before=snapshot(f);guard();const after=snapshot(f);guard();if(JSON.stringify(before)!==JSON.stringify(after))fail('Transcript changed during read-only inspection.');return before;},
  read:id=>lock(id,f=>{initialize(f);return snapshot(f);}),
  propose:(id,input)=>lock(id,f=>{initialize(f);return proposal(f,input);}),
  proposeMarkdown:(id,{expected,markdown})=>lock(id,f=>{initialize(f);const current=clean(f,expected);if(typeof markdown!=='string'||Buffer.byteLength(markdown)>2*1024*1024)throw new StateError('Markdown exceeds the supported size.');const changes=correctionsFromMarkdown(f.job,current.result,readJson(f.paths.base,null).markdown,markdown,config);return proposal(f,{expected,corrections:changes,kind:'visual-markdown',reason:'Same-file Markdown correction'});}),
  inspectExternal:(id,expected)=>lock(id,f=>{initialize(f);const current=snapshot(f);checkExpected(current,expected);if(!current.external.changed)throw new StateError('No physical Markdown edits to inspect.');if(!current.external.supported)fail(current.external.problem);if(!current.external.corrections.length)fail('No supported segment changes found.');return proposal(f,{expected,corrections:current.external.corrections,kind:'physical-markdown',reason:'Physical Markdown edits'});}),
  inspect:(id,receiptId)=>lock(id,f=>{initialize(f);if(!/^[a-f0-9-]{36}$/.test(receiptId))throw new StateError('Unknown correction.',404);const receipt=readJson(path.join(f.receipts,receiptId+'.proposal.json'),null);if(!receipt||receipt.jobId!==id)throw new StateError('Unknown correction.',404);const current=snapshot(f);return {...receipt,current:current.expected,stale:JSON.stringify(receipt.expected)!==JSON.stringify(current.expected)};}),
  decide:(id,receiptId,{decision,expected}={})=>lock(id,f=>{
   initialize(f);if(!/^[a-f0-9-]{36}$/.test(receiptId))throw new StateError('Unknown correction.',404);
   const file=path.join(f.receipts,receiptId+'.proposal.json'),r=readJson(file,null);if(!r||r.jobId!==id||r.status!=='pending')fail('Correction is no longer pending.');if(!['apply','reject'].includes(decision))throw new StateError('Choose Apply or Reject.');
   const current=snapshot(f);checkExpected(current,expected);checkExpected(current,r.expected);
   const candidate=apply(current.result,r.corrections);if(r.before.json!==text(f.paths.json)||r.before.markdown!==current.markdown||r.after.json!==json(candidate)||r.after.markdown!==physicalTranscriptMarkdown(f.job,candidate,config))fail('Correction receipt bytes changed. Original files and receipt are preserved for recovery.');
   if(decision==='apply'){noActiveTranslation(f,current.result);publish(f,JSON.parse(r.after.json),r.after.markdown,{id:receiptId,expected});}
   else if(r.kind==='physical-markdown')publish(f,current.result,readJson(f.paths.base,null).markdown,{id:receiptId,status:'rejected',expected});
   atomicWrite(file,json({...r,status:decision==='apply'?'applied':'rejected',decidedAt:new Date().toISOString()}));return snapshot(f);
  }),
  edit:(id,{expected,corrections})=>lock(id,f=>{initialize(f);const current=clean(f,expected),next=apply(current.result,corrections);return publish(f,next,physicalTranscriptMarkdown(f.job,next,config),{expected});}),
  speakers:(id,{expected,names})=>lock(id,f=>{initialize(f);const current=clean(f,expected),next=structuredClone(current.result);if(!names||typeof names!=='object'||Array.isArray(names))throw new StateError('Expected speaker names.');for(const [id,name] of Object.entries(names)){const s=next.speakers.find(s=>s.id===id);if(!s||typeof name!=='string'||name.length>120||/[\x00-\x1f]/.test(name))throw new StateError('Invalid speaker name.');s.name=name.trim()||null;}next.metadata={...next.metadata,review:{status:'unreviewed',reviewedAt:null}};return publish(f,next,physicalTranscriptMarkdown(f.job,next,config),{expected});}),
  review:(id,{expected,confirmed})=>lock(id,f=>{initialize(f);const current=clean(f,expected);if(confirmed!==true||!reviewEligibility(current.result))throw new StateError('Name every speaker and resolve unattributed segments before confirming review.');const next=structuredClone(current.result);const by=provenance();next.metadata={...next.metadata,review:{status:'reviewed',reviewedAt:by.at,inspectedRevision:current.expected.revision,by:by.actor}};return publish(f,next,physicalTranscriptMarkdown(f.job,next,config),{expected});}),
  save:(id,{expected}={})=>lock(id,f=>{initialize(f);const current=clean(f,expected),base=`/transcription/${id}`,saved={state:'saved',savedAt:new Date().toISOString(),inspectedRevision:current.expected.revision,files:[{kind:'original',format:'md',name:`Transcript - ${f.job.story}.md`,url:base+'/transcript.md'},{kind:'structured',format:'json',name:`Transcript - ${f.job.story}.json`,url:base+'/transcript.json'}],excludedTranslations:[]};
   for(const status of translationStatus(f.job,current.result)){const translated=loadTranslation(f.job,current.result,status.language);if(status.state!=='complete'||status.stale||status.outdated||!translated||translated.stale||translated.outdated){saved.excludedTranslations.push({language:status.language,reason:'Translation needs updating.'});continue;}saved.files.push({kind:'bilingual',language:status.language,format:'md',url:base+'/bilingual.md?language='+encodeURIComponent(status.language)},{kind:'translation',language:status.language,format:'md',url:base+'/translation.md?language='+encodeURIComponent(status.language)});}
   atomicWrite(f.paths.job,json({...f.job,saved}),{expectedHash:current.expected.jobHash});return {...snapshot(f),saved};}),
  recover:id=>lock(id,f=>{initialize(f);return snapshot(f);}),
 };
}
