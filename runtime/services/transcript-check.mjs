// Transcript check: a model reads a finished recording's transcript once and sorts what needs a human look, so Adrian
// listens only where it matters. Three kinds: sure fixes (a clear mishearing, applied in one tap), lines that are
// probably not the speaker (left out of the talk, never deleted from the transcript), and lines that need his ear (a
// suggestion with its reason, or a blank to type into). Everything else needs nothing from him.
//
// The model is Sonnet through the signed-in `claude` command (the same login Adrian uses; no API key), with no tools,
// no MCP servers and no settings: it reads the numbered lines and answers in JSON, nothing else.
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
import {spawn} from 'node:child_process';
import {executionEnvironment} from './artifact-execution.mjs';

export const CHECK_TIERS=Object.freeze(['sure','notyou','ear']);
const MAX_PROBLEMS=60,MAX_REASON=300,MAX_TEXT=2000;
const UUID=/^[a-f0-9-]{36}$/;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const mmss=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

/**
 * The model's answer, checked against the transcript it was given. A wrong shape throws; one suggestion that breaks
 * the contract is dropped and counted, so a single slip never costs the other suggestions. With {strict:true} any
 * broken suggestion throws (used by the tests to name each rule).
 */
export function validateSuggestions(raw,segments,{strict=false}={}){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.problems))fail('The suggestions are not in the expected shape.');
 const used=new Set(),out=[];let dropped=0;
 for(const p of raw.problems.slice(0,MAX_PROBLEMS*2)){
  try{
  if(!p||typeof p!=='object'||!CHECK_TIERS.includes(p.tier))fail('A suggestion has no known kind.');
  const tier=p.tier==='ear'&&p.certain===true&&Array.isArray(p.fixes)&&p.fixes.length?'sure':p.tier;
  const indexes=p.indexes;
  if(!Array.isArray(indexes)||!indexes.length||indexes.length>8||indexes.some(i=>!Number.isInteger(i)||!segments[i]))fail('A suggestion points at lines that do not exist.');
  for(let k=1;k<indexes.length;k++)if(indexes[k]!==indexes[k-1]+1)fail('A suggestion must cover lines in a row.');
  if(indexes.some(i=>used.has(i)))fail('Two suggestions cover the same line.');
  const reason=typeof p.reason==='string'?p.reason.trim():'';
  if(!reason||reason.length>MAX_REASON||/[\r\n\x00]/.test(reason))fail('A suggestion needs a one-line reason.');
  let fixes=null;
  if(tier==='notyou'){if(p.fixes!=null&&!(Array.isArray(p.fixes)&&!p.fixes.length))fail('A line that is not the speaker takes no fix.');}
  else if(p.fixes!=null){
   if(!Array.isArray(p.fixes)||!p.fixes.length)fail('A fix must name its lines.');
   fixes=p.fixes.map(f=>{if(!f||!indexes.includes(f.index)||typeof f.text!=='string'||!f.text.trim()||f.text.length>MAX_TEXT||/[\r\n\x00]/.test(f.text))fail('A fix must be one non-empty line for one of its own lines.');return {index:f.index,text:f.text.trim()};});
   if(new Set(fixes.map(f=>f.index)).size!==fixes.length)fail('A fix names the same line twice.');
   if(fixes.every(f=>segments[f.index].text.trim()===f.text))fail('A fix must change something.');
  }else if(tier==='sure')fail('A sure fix must say what it changes.');
  indexes.forEach(i=>used.add(i));
  out.push({id:crypto.randomUUID(),tier,indexes,fixes,reason});
  }catch(error){if(strict)throw error;dropped++;}
 }
 if(!out.length&&dropped)fail('None of the suggestions fitted the transcript.');
 const problems=out.sort((a,b)=>a.indexes[0]-b.indexes[0]).slice(0,MAX_PROBLEMS);
 return Object.assign(problems,{dropped:dropped+Math.max(0,out.length-MAX_PROBLEMS)});
}

/** One prompt per recording: numbered lines with their time and the words the speech model was unsure of. */
export function suggestionPrompt({title,segments,vocabulary=''}){
 const lines=segments.map((s,i)=>{const low=(s.words||[]).filter(w=>typeof w.probability==='number'&&w.probability<0.5).map(w=>String(w.word).trim()).filter(Boolean);return `${i} | ${mmss(s.start)} | ${s.text.trim()}${low.length?' | unsure: '+low.join(', '):''}`;});
 return [
  'You are checking a machine transcript of a recording so its speaker only has to listen where it matters. Recording: '+JSON.stringify(title||'Recording')+'.',
  'Each line below is "index | time | text", sometimes followed by words the speech model was unsure of. Lines are short pieces of speech; a sentence often runs across several lines, and long pauses are normal.',
  vocabulary?'Names and terms this speaker uses (spell them this way): '+vocabulary:'',
  'First read the whole talk to understand its subject, who is being talked about and the words its world uses. A speech model writes what a sound most resembles, not what makes sense, so look for every place a careful listener would stop: a word that makes no sense in this subject but sounds like one that does; a misspelled name of a person, place, tradition, technique or material; a phrase whose start was clipped; "you" or "I" where the speaker is plainly talking about someone else; a sentence split across lines with a word misheard at the join; a number or date that cannot be right.',
  'Sort the lines that need attention into three kinds:',
  '- "sure": the correct words are certain from the passage or a well-known term, and a careful listener would not need the audio to agree (a misspelled well-known tradition or place name; "the bread came out of the oven" heard as "the bred came out of the oven"). Give the fix. Use sure whenever your fix is the only sensible reading of those sounds in this talk and you would bet on it: most misspelled names and sound-alike swaps that restore an obvious sentence are sure. Use ear only when two readings are plausible or the meaning stays unclear.',
  '- "notyou": a line that is probably not the speaker: another person, another language, a stray character, or a phrase speech models invent in silence ("thank you for watching", "thank you to all the listeners"). No fix.',
  '- "ear": anything that looks wrong but needs the audio to settle. Give your best guess as the fix, chosen to fit the subject of the talk, and begin the reason with "A guess." when it is one; give "fixes": null when there is no sensible guess. Prefer flagging a line that reads as nonsense over leaving it.',
  'Rules: never invent facts or content; keep the speaker\'s own words and style; do not flag a line only because it is a fragment or plain spoken grammar; do not correct grammar the speaker would say aloud. Fixes replace a line\'s whole text, one entry per line you change, every text non-empty; when a word belongs on another line of the same suggestion, fix each line separately. A suggestion covers lines in a row and no line twice. At most '+MAX_PROBLEMS+' suggestions. A fix must change the text; never return a line unchanged.',
  'Reasons: one plain sentence under 25 words a non-technical person understands, no em dashes, no jargon.',
  'For every suggestion with a fix, also answer "certain": true when you would bet the fix is what was said, false otherwise. Be honest: a fix that only restores an obvious sentence or spelling is certain; a guess is not.',
  'Return JSON only: {"problems":[{"indexes":[n,...],"tier":"sure|notyou|ear","fixes":[{"index":n,"text":"..."}] or null,"certain":true|false,"reason":"..."}]}',
  '<transcript>\n'+lines.join('\n')+'\n</transcript>',
 ].filter(Boolean).join('\n\n');
}

/** The signed-in claude command: AR_CREATE_CLAUDE when set, else the first executable claude on PATH. */
export function installedClaude(inherited=process.env){
 const candidates=[...(inherited.AR_CREATE_CLAUDE?[inherited.AR_CREATE_CLAUDE]:[]),...(inherited.PATH||'').split(path.delimiter).filter(Boolean).map(dir=>path.join(dir,'claude')),...(inherited.HOME?[path.join(inherited.HOME,'.local/bin/claude')]:[])];
 return candidates.find(file=>{try{fs.accessSync(file,fs.constants.X_OK);return fs.statSync(file).isFile();}catch{return false;}})||null;
}
/** One read with no tools: prompt on stdin, the model's answer text back. Never echoes the transcript or provider logs. */
export function executeClaude({cwd,prompt,timeoutMs=600000,model='sonnet',claudePath=installedClaude(),spawnChild=spawn}){
 if(!claudePath)return Promise.reject(new StateError('The claude command is not installed on this Mac.',503));
 return new Promise((resolve,reject)=>{
  const child=spawnChild(claudePath,['-p','--model',model,'--output-format','json','--no-session-persistence','--tools','','--strict-mcp-config','--setting-sources',''],{cwd,env:executionEnvironment(),stdio:['pipe','pipe','pipe']});
  let out='',settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{child.kill('SIGTERM');done(new StateError('Reading the transcript took too long. Try again.',504));},timeoutMs);timer.unref?.();
  child.stdout.on('data',d=>{out+=d;if(out.length>8*1024*1024){child.kill('SIGTERM');done(new StateError('The answer was too long.',502));}});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
  child.on('error',()=>done(new StateError('The claude command could not start. Check that it is signed in.',503)));
  child.on('close',code=>{
   if(settled)return;
   let envelope;try{envelope=JSON.parse(out);}catch{return done(new StateError('The claude command gave an unreadable answer. Check that it is signed in.',502));}
   if(code!==0||envelope.is_error)return done(new StateError('The claude command could not finish this read. Check that it is signed in, then try again.',502));
   const text=String(envelope.result||'').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
   done(null,{text,model:typeof envelope.model==='string'?envelope.model:model});
  });
  child.stdin.end(prompt);
 });
}

const uuidFrom=seed=>{const h=crypto.createHash('sha256').update(seed).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);};
const clip=(v,n)=>String(v).length>n?String(v).slice(0,n-1).trimEnd()+'…':String(v);
const SYSTEM={actor:'cron:transcript-check',client:null};
/** The recording's name as Adrian gave it: the audio file's name without its extension. */
const titleOf=snap=>{const from=snap?.provenance?.audio||snap?.result?.metadata?.source;return from?path.basename(String(from)).replace(/\.[a-z0-9]{2,5}$/i,''):'A recording';};

/**
 * Names a use corrected: a capitalised word in the fix that replaced a different word at the same place in what was
 * heard (Navari to Newari). These are offered to the shared word library so the next recording spells them right.
 */
export function nameCorrections(heardText,fixText){
 const words=t=>String(t).split(/\s+/).map(w=>w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(Boolean);
 const a=words(heardText),b=words(fixText),out=[],seen=new Set();
 let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
 let j=0;while(j<a.length-i&&j<b.length-i&&a[a.length-1-j]===b[b.length-1-j])j++;
 const from=a.slice(i,a.length-j),to=b.slice(i,b.length-j);
 if(from.length===to.length)for(let k=0;k<to.length;k++){const w=to[k];if(w!==from[k]&&/^\p{Lu}[\p{L}'’-]{2,}$/u.test(w)&&!seen.has(w)){seen.add(w);out.push({heard:from[k],spelling:w});}}
 return out.slice(0,3);
}

export function createTranscriptCheck({dataDir,corrections,vocabulary=async()=>'',execute=executeClaude,available=()=>!!installedClaude(),timeoutMs=600000,needsYou=null,library=null}){
 /* One Needs you item per checked recording, with a link to the check screen. It never decides anything: it is
    taken off the list when every suggestion has a decision. A list that cannot be reached never blocks the check. */
 async function raiseAsk(id,record,title){
  if(!needsYou)return record;
  const open=record.problems.filter(p=>!record.decisions?.[p.id]);if(!open.length)return record;
  const ear=open.filter(p=>p.tier==='ear').length,easy=open.length-ear;
  const lead=(ear?ear+(ear===1?' line':' lines')+' in "'+clip(title,60)+'" may need your ear':'"'+clip(title,60)+'" is checked')+(easy?', and '+easy+' easy '+(easy===1?'one applies':'ones apply')+' in one tap.':'.');
  try{
   const ask=await needsYou.raise({operationId:uuidFrom(id+':check:'+record.startedAt),band:'only-adrian',question:clip(lead+' The rest of the talk needs nothing.',280),about:clip(title,120),
    choices:['Done'],scope:{kind:'recording-check',id},link:{label:'Check it',href:'/transcript-check/index.html?job='+id}},SYSTEM);
   return {...record,askId:ask?.id||ask?.ask?.id||null};
  }catch{return record;}
 }
 async function settleAsk(record){
  if(!needsYou||!record.askId||record.problems.some(p=>!record.decisions?.[p.id]))return record;
  try{await needsYou.answer({operationId:uuidFrom(record.jobId+':check-done:'+record.askId),id:record.askId,choice:'Done'},currentActor()||SYSTEM);}catch{/* already answered or gone: the record is the truth */}
  return {...record,askId:null};
 }
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
  const problems=(record?.problems||[]).map(p=>{const decision=decided.get(p.id)||null;
   if(decision?.action==='used'&&decision.fixes?.length&&decision.before?.length){const learned=new Set((decision.remembered||[]).map(r=>r.spelling));
    decision.names=nameCorrections(decision.before.map(b=>b.text).join(' '),decision.fixes.map(x=>x.text).join(' ')).map(n=>({...n,remembered:learned.has(n.spelling)}));}
   return {...p,decision};});
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
    if(!available())fail('The claude command is not set up on this Mac, so no suggestions can be made. The transcript is still here to read and correct.',503);
    const snap=corrections.read(id),record={schema:'ar-create.transcript-check.v1',jobId:id,state:'running',startedAt:new Date().toISOString(),startedBy:who(),basis:snap.expected.revision,problems:[],decisions:{}};
    save(id,record);
    const work=(async()=>{
     const cwd=fs.mkdtempSync(path.join(dir(),'.run-'));
     try{
      const prompt=suggestionPrompt({title:titleOf(snap),segments:snap.result.segments,vocabulary:await vocabulary().catch(()=>'')});
      const result=await execute({cwd,prompt,timeoutMs});
      let parsed;try{parsed=JSON.parse(result.text);}catch{fail('The suggestions came back unreadable. Try again.');}
      const problems=validateSuggestions(parsed,snap.result.segments);
      const title=titleOf(snap);
      save(id,await raiseAsk(id,{...record,state:'ready',finishedAt:new Date().toISOString(),model:result.model||null,problems:[...problems],dropped:problems.dropped},title));
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
    let applied=null,before=null;
    if(action==='use'){
     if(p.tier==='notyou')fail('Leave this line out, or keep it.');
     const chosen=Array.isArray(fixes)?fixes:p.fixes;
     if(!Array.isArray(chosen)||!chosen.length)fail('Type the words you said first.');
     const snap=corrections.read(id);
     const clean=chosen.map(f=>{if(!f||!p.indexes.includes(f.index)||typeof f.text!=='string'||!f.text.trim()||f.text.length>MAX_TEXT||/[\r\n\x00]/.test(f.text))fail('Each change must be one non-empty line inside this suggestion.');return {index:f.index,text:f.text.trim()};}).filter(f=>snap.segments[f.index].text.trim()!==f.text);
     before=clean.map(f=>({index:f.index,text:snap.segments[f.index].text}));
     if(clean.length){const after=corrections.edit(id,{expected,corrections:clean});record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);}
     applied=clean;
    }
    record.decisions[p.id]={action:action==='use'?'used':action==='keep'?'kept':'left-out',...(applied?{fixes:applied,before}:{}),at:new Date().toISOString(),by};
    save(id,await settleAsk(record));return view(id);
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
     const changes=new Map(open.map(p=>[p.id,p.fixes.filter(f=>snap.segments[f.index].text.trim()!==f.text)]));
     const all=[...changes.values()].flat();
     if(all.length){const after=corrections.edit(id,{expected,corrections:all});record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);}
     for(const p of open)record.decisions[p.id]={action:'used',fixes:changes.get(p.id),before:changes.get(p.id).map(f=>({index:f.index,text:snap.segments[f.index].text})),at,by,group:true};
    }else for(const p of open)record.decisions[p.id]={action:'left-out',at,by,group:true};
    save(id,await settleAsk(record));return view(id);
   });
  },
  /**
   * Take one decision back. A use is reversed through the same correction boundary, and only while every line it
   * changed still reads exactly as it left it; anything edited since is left alone and the undo is refused.
   */
  async undo(id,{problemId,expected}={}){
   decider();
   return serial(id,async()=>{
    const record=load(id);if(!record||record.state!=='ready')fail('There is no finished check for this recording.',409);
    const decision=record.decisions[problemId];if(!decision)fail('That suggestion has no decision to undo.',409);
    if(decision.action==='used'&&decision.fixes?.length){
     if(!Array.isArray(decision.before)||decision.before.length!==decision.fixes.length)fail('This change was made before undo existed; change it in the full transcript.',409);
     const snap=corrections.read(id);
     if(decision.fixes.some(f=>snap.segments[f.index]?.text.trim()!==f.text))fail('Those lines were changed again since. Change them in the full transcript.',409);
     const after=corrections.edit(id,{expected,corrections:decision.before.map(b=>({index:b.index,text:b.text}))});
     record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);
    }
    delete record.decisions[problemId];
    record.undone=[...(record.undone||[]),{problemId,action:decision.action,at:new Date().toISOString(),by:who()}].slice(-200);
    save(id,record);return view(id);
   });
  },
  /** Teach the shared word library a spelling Adrian just corrected here: the next recording in any project gets it right. */
  async remember(id,{problemId,spelling,category='other'}={}){
   decider();
   if(!library)fail('The word library is not available here.',503);
   return serial(id,async()=>{
    const record=load(id);const decision=record?.decisions?.[problemId];
    if(!decision||decision.action!=='used'||!decision.before?.length)fail('Use the fix first, then remember the spelling.',409);
    const name=nameCorrections(decision.before.map(b=>b.text).join(' '),decision.fixes.map(x=>x.text).join(' ')).find(n=>n.spelling===spelling);
    if(!name)fail('That spelling is not one this fix corrected.',400);
    const snap=corrections.read(id),first=decision.fixes[0],segment=snap.segments[first.index];
    const story=titleOf(snap);
    await library.learn({heard:name.heard,spelling:name.spelling,category,from:{jobId:id,story,at:segment?.start,sentence:clip(first.text,300)},operationId:uuidFrom(id+':remember:'+problemId+':'+name.spelling)},currentActor()||undefined);
    decision.remembered=[...(decision.remembered||[]),{spelling:name.spelling,heard:name.heard,at:new Date().toISOString(),by:who()}];
    save(id,record);return view(id);
   });
  },
  /** The talk as checked: current transcript text with left-out lines removed. For the steps that come after. */
  checkedText(id){const v=view(id),out=new Set(v.leftOut);return v.segments.filter(s=>!out.has(s.index)).map(s=>s.text.trim()).join(' ');},
 };
}
