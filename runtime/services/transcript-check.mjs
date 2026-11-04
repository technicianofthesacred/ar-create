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
  const quoted=typeof p.before==='string'&&typeof p.after==='string';
  const tier=p.tier==='ear'&&p.certain===true&&(quoted||Array.isArray(p.fixes)&&p.fixes.length)?'sure':p.tier;
  const indexes=p.indexes;
  if(!Array.isArray(indexes)||!indexes.length||indexes.length>8||indexes.some(i=>!Number.isInteger(i)||!segments[i]))fail('A suggestion points at lines that do not exist.');
  for(let k=1;k<indexes.length;k++)if(indexes[k]!==indexes[k-1]+1)fail('A suggestion must cover lines in a row.');
  if(indexes.some(i=>used.has(i)))fail('Two suggestions cover the same line.');
  const reason=typeof p.reason==='string'?p.reason.trim():'';
  if(!reason||reason.length>MAX_REASON||/[\r\n\x00]/.test(reason))fail('A suggestion needs a one-line reason.');
  let fixes=null;
  if(tier==='notyou'){if(quoted||p.fixes!=null&&!(Array.isArray(p.fixes)&&!p.fixes.length))fail('A line that is not the speaker takes no fix.');}
  else if(quoted){
   const lines=indexes.map(i=>({index:i,text:String(segments[i].text).trim()})),joined=lines.map(l=>l.text).join(' ');
   if(!p.before.trim()||!joined.includes(p.before))fail('A fix must quote words that are in its lines.');
   if(/[\r\n\x00]/.test(p.after)||p.after.length>MAX_TEXT)fail('A fix must be one line of words.');
   const spread=spreadEdit(lines,joined.replace(p.before,p.after));
   if(spread.emptied.length)fail('A fix cannot empty a whole line.');
   fixes=spread.changed.map(i=>({index:i,text:spread.texts[i]}));
   if(!fixes.length)fail('A fix must change something.');
  }
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

/**
 * Spreads one edit of a run of lines back over those lines. The edit is made to the lines' text read as one passage
 * (what Adrian sees and types into, or a model's find-and-replace); the transcript keeps one text per line, so each
 * word of the new passage is given to a line: a kept word stays with its line, a replacing word goes where the word it
 * replaced was, an added word joins the line before it. A line no edit touched keeps its stored text exactly ("raw");
 * a line left with no words is returned in "emptied", because a transcript line cannot be blank.
 * lines: [{index, text, raw?}] in order. Returns {texts: {index: newText}, emptied: [index], changed: [index]}.
 */
export function spreadEdit(lines,newText){
 const tokens=lines.flatMap(l=>String(l.text).split(/\s+/).filter(Boolean).map(w=>({w,owner:l.index})));
 const next=String(newText).split(/\s+/).filter(Boolean);
 if(tokens.length>1500||next.length>1500)fail('That passage is too long to change at once.');
 const n=tokens.length,m=next.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=tokens[i].w===next[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const owned=new Map(lines.map(l=>[l.index,[]])),touched=new Set();
 // Inside a replaced stretch each new word goes to the line of the old word it most resembles ("Agate" joins the
 // line that said "Aged"), words with no likeness follow their neighbour, and line order never runs backwards.
 const norm=w=>w.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const pairs=w=>{const t=norm(w),out=new Set();for(let k=0;k<t.length-1;k++)out.add(t.slice(k,k+2));if(t.length===1)out.add(t);return out;};
 const like=(a,b)=>{const A=pairs(a),B=pairs(b);if(!A.size||!B.size)return 0;let both=0;for(const x of A)if(B.has(x))both++;return 2*both/(A.size+B.size)+(norm(a)[0]&&norm(a)[0]===norm(b)[0]?.2:0);};
 let i=0,j=0,lastOwner=null;const deleted=[],added=[];
 const resolve=nextOwner=>{
  if(!added.length){deleted.length=0;return;}
  let owners;
  if(!deleted.length)owners=added.map(()=>lastOwner??nextOwner??lines[0]?.index);
  else{
   owners=added.map(w=>{let best=null,score=.45;for(const d of deleted){const v=like(w,d.w);if(v>score){score=v;best=d.owner;}}return best;});
   const first=owners.find(o=>o!=null)??deleted[0].owner;
   for(let k=0;k<owners.length;k++)owners[k]=owners[k]??(k?owners[k-1]:first);
   for(let k=1;k<owners.length;k++)if(owners[k]<owners[k-1])owners[k]=owners[k-1];
  }
  added.forEach((w,k)=>{owned.get(owners[k]).push(w);touched.add(owners[k]);});
  added.length=0;deleted.length=0;
 };
 while(i<n||j<m){
  if(i<n&&j<m&&tokens[i].w===next[j]){resolve(tokens[i].owner);owned.get(tokens[i].owner).push(next[j]);lastOwner=tokens[i].owner;i++;j++;}
  else if(i<n&&(j>=m||dp[i+1][j]>=dp[i][j+1])){deleted.push(tokens[i]);touched.add(tokens[i].owner);i++;}
  else{added.push(next[j]);j++;}
 }
 resolve(null);
 const texts={},emptied=[],changed=[];
 for(const l of lines){
  const words=owned.get(l.index);
  if(!touched.has(l.index)){texts[l.index]=l.raw??l.text;continue;}
  if(!words.length){emptied.push(l.index);continue;}
  const text=words.join(' ');texts[l.index]=text;if(text!==(l.raw??l.text))changed.push(l.index);
 }
 return {texts,emptied,changed};
}

/**
 * The talk as it reads: lines grouped into paragraphs where the speaker paused more than four seconds, and each line's
 * text as shown (a line that carries on the one before loses its capital; a trailing "..." before it goes). Display only:
 * a line is stored in its own words until an edit touches it.
 */
const KEEP_CAP=/^(I\b|I'm|I've|I'll|I'd)/;
export function readingOf(segments){
 const paragraphs=[];let cur=[];
 segments.forEach((s,i)=>{if(cur.length&&s.start-segments[i-1].end>4){paragraphs.push(cur);cur=[];}cur.push(i);});
 if(cur.length)paragraphs.push(cur);
 const shown=segments.map(s=>String(s.text).trim());
 for(const para of paragraphs)para.forEach((i,k)=>{
  if(k===0){shown[i]=shown[i].charAt(0).toUpperCase()+shown[i].slice(1);return;}
  const prev=String(segments[para[k-1]].text).trim(),open=prev.endsWith('...')||!/[.?!]$/.test(prev);
  if(open){if(shown[para[k-1]].endsWith('...'))shown[para[k-1]]=shown[para[k-1]].slice(0,-3);if(!KEEP_CAP.test(shown[i]))shown[i]=shown[i].charAt(0).toLowerCase()+shown[i].slice(1);}
 });
 return {paragraphs,shown};
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
  '- "ear": anything that looks wrong but needs the audio to settle. Give your best guess as the fix, chosen to fit the subject of the talk, and begin the reason with "A guess." when it is one; leave out "before" and "after" when there is no sensible guess. Prefer flagging a line that reads as nonsense over leaving it.',
  'Rules: never invent facts or content; keep the speaker\'s own words and style; do not flag a line only because it is a fragment or plain spoken grammar; do not correct grammar the speaker would say aloud. A fix quotes the exact words to replace as "before" (copied character for character from its lines, punctuation included, just long enough to be unique) and gives "after", the words that replace them; read across the line breaks, so a fix may run from one line into the next, and leave every other word as it is. A suggestion covers lines in a row and no line twice. At most '+MAX_PROBLEMS+' suggestions. A fix must change the text; never return a line unchanged.',
  'Reasons: one plain sentence under 25 words a non-technical person understands, no em dashes, no jargon.',
  'For every suggestion with a fix, also answer "certain": true when you would bet the fix is what was said, false otherwise. Be honest: a fix that only restores an obvious sentence or spelling is certain; a guess is not.',
  'Return JSON only: {"problems":[{"indexes":[n,...],"tier":"sure|notyou|ear","before":"exact words","after":"replacement","certain":true|false,"reason":"..."}]} (no "before" or "after" for notyou, or for an ear check with no guess)',
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
  const edits=record?.edits||[];
  const leftOut=[...new Set([...problems.filter(p=>p.decision?.action==='left-out').flatMap(p=>p.indexes),...edits.flatMap(e=>e.emptied||[])])].sort((a,b)=>a-b);
  const reading=readingOf(snap.segments);
  return {
   schema:'ar-create.transcript-check.v1',jobId:id,expected:snap.expected,reviewStatus:snap.reviewStatus,
   segments:snap.segments.map((s,i)=>{const words=(snap.result.segments[i]?.words||[]).filter(w=>Number.isFinite(w.start)).map(w=>[Math.round(w.start*100)/100,Math.round(w.end*100)/100]);return {index:s.index,start:s.start,end:s.end,text:s.text,shown:reading.shown[i],...(words.length?{words}:{})};}),
   paragraphs:reading.paragraphs,
   edits:edits.map(e=>({id:e.id,indexes:e.indexes,at:e.at})),
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
  /**
   * Adrian types over any run of lines (usually a paragraph) as it reads on the page. The new words are spread over the
   * lines and written through the correction boundary; a line he emptied is left out of the talk. Any suggestion on a
   * line he changed is settled as edited, since his words now stand there.
   */
  async edit(id,{indexes,text,expected}={}){
   const by=decider();
   return serial(id,async()=>{
    const snap=corrections.read(id);
    if(!Array.isArray(indexes)||!indexes.length||indexes.length>400||indexes.some((i,k)=>!Number.isInteger(i)||!snap.segments[i]||(k&&i!==indexes[k-1]+1)))fail('Choose lines that follow each other.');
    if(typeof text!=='string'||text.length>40000||/[\x00]/.test(text))fail('Send the passage as text.');
    const clean=text.replace(/\s+/g,' ').trim();if(!clean)fail('To take a passage out, leave it out line by line; an empty passage is not saved.');
    const reading=readingOf(snap.segments);
    const spread=spreadEdit(indexes.map(i=>({index:i,text:reading.shown[i],raw:snap.segments[i].text})),clean);
    if(!spread.changed.length&&!spread.emptied.length)return view(id);
    const record=load(id)||{schema:'ar-create.transcript-check.v1',jobId:id,state:'none',problems:[],decisions:{}};
    const before=[...spread.changed,...spread.emptied].map(i=>({index:i,text:snap.segments[i].text}));
    const changes=spread.changed.map(i=>({index:i,text:spread.texts[i]}));
    if(changes.length){const after=corrections.edit(id,{expected,corrections:changes});record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);}
    const edit={id:crypto.randomUUID(),indexes,changes,before,emptied:spread.emptied,at:new Date().toISOString(),by};
    record.edits=[...(record.edits||[]),edit];
    const touched=new Set([...spread.changed,...spread.emptied]);
    record.decisions=record.decisions||{};
    for(const p of record.problems||[])if(!record.decisions[p.id]&&p.indexes.some(i=>touched.has(i)))record.decisions[p.id]={action:'edited',byEdit:edit.id,at:edit.at,by};
    save(id,await settleAsk(record));return {...view(id),lastEdit:edit.id};
   });
  },
  /** Take one of Adrian's own edits back, while the lines still read as it left them. */
  async undoEdit(id,{editId,expected}={}){
   decider();
   return serial(id,async()=>{
    const record=load(id);const edit=record?.edits?.find(e=>e.id===editId);if(!edit)fail('That change is not in this check.',404);
    const snap=corrections.read(id);
    if(edit.changes.some(c=>snap.segments[c.index]?.text.trim()!==c.text))fail('Those lines were changed again since. Change them on the page.',409);
    const back=edit.before.filter(b=>snap.segments[b.index]?.text!==b.text).map(b=>({index:b.index,text:b.text}));
    if(back.length){const after=corrections.edit(id,{expected,corrections:back});record.ownRevisions=[...(record.ownRevisions||[]),after.expected.revision].slice(-200);}
    record.edits=record.edits.filter(e=>e.id!==editId);
    for(const [pid,d] of Object.entries(record.decisions||{}))if(d.byEdit===editId)delete record.decisions[pid];
    save(id,record);return view(id);
   });
  },
  /** The talk as checked: current transcript text with left-out lines removed. For the steps that come after. */
  checkedText(id){const v=view(id),out=new Set(v.leftOut);return v.segments.filter(s=>!out.has(s.index)).map(s=>s.text.trim()).join(' ');},
 };
}
