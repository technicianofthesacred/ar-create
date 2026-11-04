// Transcript check: a model reads a finished recording's transcript once and sorts what needs a human look, so Adrian
// listens only where it matters. Three kinds: sure fixes (a clear mishearing, applied in one tap), lines that are
// probably not the speaker (left out of the talk, never deleted from the transcript), and lines that need his ear (a
// suggestion with its reason, or a blank to type into). Everything else needs nothing from him.
//
// The model only proposes. Decisions are Adrian's, from the app's own page; a "use" writes through the recording
// owner's correction boundary (transcript-corrections.edit), so the first transcript, RAW and the audio stay untouched
// and a stale page is refused. "Leave out" changes no transcript bytes: it is recorded here and the check's corrected
// text omits the line. State lives in the home's data/transcript-checks/<jobId>.json, written only by this module.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {StateError} from '../store.mjs';
import {currentActor,requireHuman} from './actor.mjs';
import {atomicWrite,ensurePrivateDirectory,readJson} from './files.mjs';
import {executeCodexArtifacts,installedCodex,outputOnlyPrompt} from './artifact-execution.mjs';

export const CHECK_TIERS=Object.freeze(['sure','notyou','ear']);
const MAX_PROBLEMS=60,MAX_REASON=300,MAX_TEXT=2000;
const UUID=/^[a-f0-9-]{36}$/;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const mmss=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

/** The model's answer, checked against the transcript it was given. Throws on anything outside the contract. */
export function validateSuggestions(raw,segments){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.problems))fail('The suggestions are not in the expected shape.');
 if(raw.problems.length>MAX_PROBLEMS)fail('Too many suggestions; at most '+MAX_PROBLEMS+'.');
 const used=new Set(),out=[];
 for(const p of raw.problems){
  if(!p||typeof p!=='object'||!CHECK_TIERS.includes(p.tier))fail('A suggestion has no known kind.');
  const indexes=p.indexes;
  if(!Array.isArray(indexes)||!indexes.length||indexes.length>8||indexes.some(i=>!Number.isInteger(i)||!segments[i]))fail('A suggestion points at lines that do not exist.');
  for(let k=1;k<indexes.length;k++)if(indexes[k]!==indexes[k-1]+1)fail('A suggestion must cover lines in a row.');
  if(indexes.some(i=>used.has(i)))fail('Two suggestions cover the same line.');
  const reason=typeof p.reason==='string'?p.reason.trim():'';
  if(!reason||reason.length>MAX_REASON||/[\r\n\x00]/.test(reason))fail('A suggestion needs a one-line reason.');
  let fixes=null;
  if(p.tier==='notyou'){if(p.fixes!=null&&!(Array.isArray(p.fixes)&&!p.fixes.length))fail('A line that is not the speaker takes no fix.');}
  else if(p.fixes!=null){
   if(!Array.isArray(p.fixes)||!p.fixes.length)fail('A fix must name its lines.');
   fixes=p.fixes.map(f=>{if(!f||!indexes.includes(f.index)||typeof f.text!=='string'||!f.text.trim()||f.text.length>MAX_TEXT||/[\r\n\x00]/.test(f.text))fail('A fix must be one non-empty line for one of its own lines.');return {index:f.index,text:f.text.trim()};});
   if(new Set(fixes.map(f=>f.index)).size!==fixes.length)fail('A fix names the same line twice.');
   if(fixes.every(f=>segments[f.index].text.trim()===f.text))fail('A fix must change something.');
  }else if(p.tier==='sure')fail('A sure fix must say what it changes.');
  indexes.forEach(i=>used.add(i));
  out.push({id:crypto.randomUUID(),tier:p.tier,indexes,fixes,reason});
 }
 return out.sort((a,b)=>a.indexes[0]-b.indexes[0]);
}

/** One prompt per recording: numbered lines with their time and the words the speech model was unsure of. */
export function suggestionPrompt({title,segments,vocabulary=''}){
 const lines=segments.map((s,i)=>{const low=(s.words||[]).filter(w=>typeof w.probability==='number'&&w.probability<0.5).map(w=>String(w.word).trim()).filter(Boolean);return `${i} | ${mmss(s.start)} | ${s.text.trim()}${low.length?' | unsure: '+low.join(', '):''}`;});
 return [
  'You are checking a machine transcript of a recording so its speaker only has to listen where it matters. Recording: '+JSON.stringify(title||'Recording')+'.',
  'Each line below is "index | time | text", sometimes followed by words the speech model was unsure of. Lines are short pieces of speech; a sentence often runs across several lines, and long pauses are normal.',
  vocabulary?'Names and terms this speaker uses (spell them this way): '+vocabulary:'',
  'Sort only the lines that need attention into three kinds:',
  '- "sure": a clear mishearing whose correct words are certain from the same passage or a known term (a misspelled tradition name, "each can came from a rock" after crushing pigments meaning "each color"). Give the fix.',
  '- "notyou": a line that is probably not the speaker: another person, another language, a stray character, or a phrase speech models invent in silence ("thank you for watching", "thank you to all the listeners"). No fix.',
  '- "ear": anything uncertain. Give your best guess as the fix and begin the reason with "A guess." when it is one; give "fixes": null when there is no sensible guess.',
  'Rules: never invent facts or content; keep the speaker\'s own words and style; do not flag a line only because it is a fragment or plain spoken grammar; do not correct grammar the speaker would say aloud. Fixes replace a line\'s whole text, one entry per line you change, every text non-empty; when a word belongs on another line of the same suggestion, fix each line separately. A suggestion covers lines in a row and no line twice. At most '+MAX_PROBLEMS+' suggestions; leave out anything doubtful but harmless.',
  'Reasons: one plain sentence under 25 words a non-technical person understands, no em dashes, no jargon.',
  'Return JSON only: {"problems":[{"indexes":[n,...],"tier":"sure|notyou|ear","fixes":[{"index":n,"text":"..."}] or null,"reason":"..."}]}',
  '<transcript>\n'+lines.join('\n')+'\n</transcript>',
 ].filter(Boolean).join('\n\n');
}

export function createTranscriptCheck({dataDir,corrections,vocabulary=async()=>'',execute=executeCodexArtifacts,available=()=>!!installedCodex(),timeoutMs=600000}){
 if(!corrections)throw new Error('The transcript check needs the recording owner\'s corrections.');
 const dir=()=>{ensurePrivateDirectory(dataDir,'transcript-checks');return path.join(dataDir,'transcript-checks');};
 const file=id=>{if(!UUID.test(id||''))fail('Unknown recording.',404);return path.join(dir(),id+'.json');};
 const load=id=>readJson(file(id),null);
 const save=(id,record)=>{atomicWrite(file(id),JSON.stringify(record,null,1)+'\n');return record;};
 const running=new Map();
 const queues=new Map();
 const serial=(id,work)=>{const next=(queues.get(id)||Promise.resolve()).then(work,work);queues.set(id,next.catch(()=>undefined));return next;};
 const who=()=>{const a=currentActor();return a?{actor:a.actor,client:a.client||null}:{actor:'system',client:null};};
 function decider(){requireHuman('Deciding a transcript check');const a=currentActor();if(a&&a.client!=='ui')fail('Decide from the check screen in the app, not from '+(a.client||'a script')+'. The record says who tapped it.',403);return who();}

 function view(id){
  const snap=corrections.read(id),record=load(id);
  const decided=new Map(Object.entries(record?.decisions||{}));
  const problems=(record?.problems||[]).map(p=>({...p,decision:decided.get(p.id)||null}));
  const leftOut=problems.filter(p=>p.decision?.action==='left-out').flatMap(p=>p.indexes);
  return {
   schema:'ar-create.transcript-check.v1',jobId:id,expected:snap.expected,reviewStatus:snap.reviewStatus,
   segments:snap.segments.map(s=>({index:s.index,start:s.start,end:s.end,text:s.text})),
   check:record?{state:record.state,startedAt:record.startedAt,finishedAt:record.finishedAt||null,error:record.error||null,model:record.model||null,stale:record.state==='ready'&&record.basis!==snap.expected.revision&&!record.ownRevisions?.includes(snap.expected.revision)}:{state:'none'},
   problems,leftOut,available:available(),
  };
 }

 return {
  view,
  /** Start the model's read of this transcript. Runs once at a time per recording; a finished check is kept unless `again`. */
  suggest(id,{again=false}={}){
   return serial(id,async()=>{
    const existing=load(id);
    if(existing?.state==='running'&&running.has(id))return view(id);
    if(existing?.state==='ready'&&!again)return view(id);
    if(!available())fail('The model that reads transcripts is not set up on this Mac. The transcript is still here to read and correct.',503);
    const snap=corrections.read(id),record={schema:'ar-create.transcript-check.v1',jobId:id,state:'running',startedAt:new Date().toISOString(),startedBy:who(),basis:snap.expected.revision,problems:[],decisions:{}};
    save(id,record);
    const work=(async()=>{
     const cwd=fs.mkdtempSync(path.join(dir(),'.run-'));
     try{
      const prompt=suggestionPrompt({title:snap.result?.metadata?.source?path.basename(String(snap.result.metadata.source)):'Recording',segments:snap.result.segments,vocabulary:await vocabulary().catch(()=>'')});
      const result=await execute({cwd,prompt:outputOnlyPrompt(prompt,['suggestions.json']),names:['suggestions.json'],timeoutMs});
      const problems=validateSuggestions(JSON.parse(result.response.artifacts['suggestions.json']),snap.result.segments);
      save(id,{...record,state:'ready',finishedAt:new Date().toISOString(),model:result.model||null,problems});
     }catch(error){save(id,{...record,state:'failed',finishedAt:new Date().toISOString(),error:error.status?error.message:'The transcript could not be read for problems. Try again.'});}
     finally{fs.rmSync(cwd,{recursive:true,force:true});running.delete(id);}
    })();
    running.set(id,work);
    return view(id);
   });
  },
  wait:id=>running.get(id)||Promise.resolve(),
  /** One decision: use (optionally with Adrian's own words), keep as heard, or leave the lines out of the talk. */
  async decide(id,{problemId,action,fixes,expected}={}){
   const by=decider();
   return serial(id,async()=>{
    const record=load(id);if(!record||record.state!=='ready')fail('There is no finished check for this recording.',409);
    const p=record.problems.find(x=>x.id===problemId);if(!p)fail('That suggestion is not in this check.',404);
    if(!['use','keep','leave'].includes(action))fail('Choose use, keep or leave.');
    if(action==='leave'&&p.tier!=='notyou')fail('Only a line that is probably not the speaker can be left out.');
    let applied=null;
    if(action==='use'){
     if(p.tier==='notyou')fail('Leave this line out, or keep it.');
     const chosen=Array.isArray(fixes)?fixes:p.fixes;
     if(!Array.isArray(chosen)||!chosen.length)fail('Type the words you said first.');
     const snap=corrections.read(id);
     const clean=chosen.map(f=>{if(!f||!p.indexes.includes(f.index)||typeof f.text!=='string'||!f.text.trim()||f.text.length>MAX_TEXT||/[\r\n\x00]/.test(f.text))fail('Each change must be one non-empty line inside this suggestion.');return {index:f.index,text:f.text.trim()};}).filter(f=>snap.segments[f.index].text.trim()!==f.text);
     if(clean.length){const after=corrections.edit(id,{expected,corrections:clean});record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);}
     applied=clean;
    }
    record.decisions[p.id]={action:action==='use'?'used':action==='keep'?'kept':'left-out',...(applied?{fixes:applied}:{}),at:new Date().toISOString(),by};
    save(id,record);return view(id);
   });
  },
  /** The two groups that need only a glance: every open sure fix in one correction, every open not-the-speaker line left out. */
  async decideGroup(id,{tier,expected}={}){
   const by=decider();
   return serial(id,async()=>{
    const record=load(id);if(!record||record.state!=='ready')fail('There is no finished check for this recording.',409);
    if(!['sure','notyou'].includes(tier))fail('Only sure fixes and lines that are not the speaker can be done together.');
    const open=record.problems.filter(p=>p.tier===tier&&!record.decisions[p.id]);
    if(!open.length)return view(id);
    const at=new Date().toISOString();
    if(tier==='sure'){
     const snap=corrections.read(id);
     const all=open.flatMap(p=>p.fixes).filter(f=>snap.segments[f.index].text.trim()!==f.text);
     if(all.length){const after=corrections.edit(id,{expected,corrections:all});record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);}
     for(const p of open)record.decisions[p.id]={action:'used',fixes:p.fixes,at,by,group:true};
    }else for(const p of open)record.decisions[p.id]={action:'left-out',at,by,group:true};
    save(id,record);return view(id);
   });
  },
  /** The talk as checked: current transcript text with left-out lines removed. For the steps that come after. */
  checkedText(id){const v=view(id),out=new Set(v.leftOut);return v.segments.filter(s=>!out.has(s.index)).map(s=>s.text.trim()).join(' ');},
 };
}
