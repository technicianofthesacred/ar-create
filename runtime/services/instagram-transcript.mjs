// The transcript side of the Instagram studio, with no AI anywhere in it. A 20-minute voice note goes in whole and is
// never replaced by a summary: it is read into sentences (lines) and numbered moments with timestamps, each an exact
// slice of the Library text. Nothing is dropped (the wholeness check counts every character), nothing is corrected
// (likely mishearings, names, numbers and dates are flagged for Adrian to confirm), and every moment ends up used,
// saved for later or skipped on purpose (the coverage map).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TIMESTAMP=/^\s*[[(]?(\d{1,2}):(\d{2})(?::(\d{2}))?[\])]?\s+/;
// A speaker label: capitalised words then a colon ("Mender:", "Speaker 2:"). "Here is the thing: ..." stays speech.
const SPEAKER=/^\s*([A-Z][\p{L}'’-]*(?: (?:[A-Z][\p{L}'’-]*|\d+)){0,2}):\s+/u;
const WORDS_PER_SECOND=2.5,MOMENT_WORDS=140;
const words=t=>String(t||'').trim().split(/\s+/).filter(Boolean).length;
const seconds=(h,m,s)=>s===undefined?Number(h)*60+Number(m):Number(h)*3600+Number(m)*60+Number(s);
export const clock=sec=>{sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0');};

/**
 * Lines of a transcript: paragraphs at blank lines, then sentences. A timestamp or speaker label at the start of a
 * sentence is kept aside as a label, never as speech. Each line is an exact slice: text === body.slice(start, end).
 */
export function deriveLines(sourceId,body,first=1){
 const lines=[],labels=[];let n=first,para=0;const re=/[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g;let p;
 while((p=re.exec(body))){
  const offset=p.index,chunk=p[0];let speaker='';para++;
  const sentence=/[^.!?…]+(?:[.!?…]+["”’)\]]*|$)/gu;let m;
  while((m=sentence.exec(chunk))){
   let raw=m[0],start=offset+m.index,at=null;
   const ts=TIMESTAMP.exec(raw);if(ts){at=seconds(ts[1],ts[2],ts[3]);labels.push([start,start+ts[0].length]);start+=ts[0].length;raw=raw.slice(ts[0].length);}
   const who=SPEAKER.exec(raw);if(who){speaker=who[1];labels.push([start,start+who[0].length]);start+=who[0].length;raw=raw.slice(who[0].length);}
   const lead=raw.length-raw.trimStart().length,trimmed=raw.trim();
   if(!trimmed)continue;
   start+=lead;lines.push({id:'L'+n++,sourceId,start,end:start+trimmed.length,speaker,para,...(at!==null?{at}:{}),text:trimmed});
  }
 }
 return {lines,labels};
}
/** Every non-space character of the transcript is in a line or a label; anything else is reported, never hidden. */
export function wholeness(body,lines,labels){
 const mark=new Uint8Array(body.length);for(const l of lines)mark.fill(1,l.start,l.end);for(const [a,b] of labels)mark.fill(2,a,b);
 let characters=0,inLines=0,inLabels=0;const missing=[];
 for(let i=0;i<body.length;i++){if(/\s/.test(body[i]))continue;characters++;if(mark[i]===1)inLines++;else if(mark[i]===2)inLabels++;else if(missing.length<5)missing.push(i);}
 return {characters,inLines,inLabels,missing:characters-inLines-inLabels,firstMissing:missing,words:words(body)};
}
/**
 * Numbered moments: a new one at every timestamp and paragraph, and inside a long paragraph every ~140 words at a
 * sentence end. Times come from the timestamps; between them they are estimated from the words (marked estimated).
 */
export function deriveMoments(sourceId,body,lines,first=1){
 const mine=lines.filter(l=>l.sourceId===sourceId),out=[];let cur=null,n=first,known=0,since=0;
 // Words left in each line's paragraph, so a long paragraph is never split into a stub of a few words.
 const left=new Array(mine.length);for(let i=mine.length-1;i>=0;i--)left[i]=words(mine[i].text)+(i+1<mine.length&&mine[i+1].para===mine[i].para&&mine[i+1].at===undefined?left[i+1]:0);
 for(const [i,l] of mine.entries()){
  if(!cur||l.at!==undefined||l.para!==cur.para||(cur.words>=MOMENT_WORDS&&left[i]>=50)){
   if(cur)out.push(cur);
   const at=l.at!==undefined?l.at:known+since/WORDS_PER_SECOND;
   if(l.at!==undefined){known=l.at;since=0;}
   cur={id:'M'+n++,sourceId,para:l.para,at:Math.round(at),estimated:l.at===undefined,lineIds:[],start:l.start,end:l.end,words:0,speakers:[]};
  }
  cur.lineIds.push(l.id);cur.end=l.end;const w=words(l.text);cur.words+=w;since+=w;if(l.speaker&&!cur.speakers.includes(l.speaker))cur.speakers.push(l.speaker);
 }
 if(cur)out.push(cur);
 for(const [i,m] of out.entries()){const next=out[i+1];m.until=next&&next.sourceId===m.sourceId?Math.max(m.at,next.at):Math.round(m.at+m.words/WORDS_PER_SECOND);m.text=body.slice(m.start,m.end);delete m.para;}
 return out;
}

/* ---------- doubtful words ---------- */
const NUMBER_WORDS='zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties';
const NUMBER=new RegExp('\\b(?:\\d[\\d,.:]*(?:s|st|nd|rd|th)?|(?:'+NUMBER_WORDS+')(?:[ -](?:one|'+NUMBER_WORDS+'))*)\\b','gi');
const MONTHS='January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mondays|Tuesdays|Wednesdays|Thursdays|Fridays|Saturdays|Sundays';
const DATE=new RegExp('\\b(?:'+MONTHS+')\\b','g');
const NOT_NAMES=new Set(['I','I\'m','I\'ll','I\'d','I\'ve','Okay','OK','Yes','No','Chinese','Japanese','English','Korean','Indian','American','European','God','Mr','Mrs','Ms','Dr','TV']);
// Variants made only of ordinary English words ("rock tea", "gold repair") are descriptions, not mishearings.
const COMMON=new Set('a the of and tea teas rock cliff gold repair bowl bowls pot pots clay purple sky blue high mountain full half handmade semi iron content waste water cinnamon green red black white yellow dark old raw ripe aged roasted fired kiln ware cup cups jar kettle charcoal'.split(' '));
const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let cachedTerms=null;
/** The Teajia tea-term library, if this Mac has it (AR_CREATE_TEA_TERMS, else ~/builds/tea-terms.json). Read-only. */
export function loadTeaTerms(file=process.env.AR_CREATE_TEA_TERMS||path.join(os.homedir(),'builds/tea-terms.json')){
 if(cachedTerms&&cachedTerms.file===file)return cachedTerms.terms;
 let terms=[];try{const v=JSON.parse(fs.readFileSync(file,'utf8'));terms=Array.isArray(v.terms)?v.terms:[];}catch{terms=[];}
 cachedTerms={file,terms};return terms;
}
function termMatchers(terms){
 const out=[];
 for(const t of terms||[]){if(!t||typeof t.en!=='string')continue;const canon=t.en.toLowerCase();
  for(const v of t.variants||[]){if(typeof v!=='string'||v.length<3)continue;const low=v.toLowerCase();if(low===canon)continue;if(low.split(/[\s'-]+/).every(w=>COMMON.has(w)))continue;
   out.push({re:new RegExp('(?<![\\p{L}])'+escapeRe(low).replace(/\\? /g,'[\\s-]+')+'(?![\\p{L}])','giu'),term:t});}}
 return out.sort((a,b)=>b.re.source.length-a.re.source.length);
}
/**
 * Words to confirm, found without guessing: tea terms heard in a known misheard or spoken form (with the library's
 * spelling as a suggestion, never applied), names and places (capitalised words inside a sentence), numbers and dates.
 */
export function detectFlags(lines,terms=[]){
 const matchers=termMatchers(terms),flags=[],canon=new Set((terms||[]).map(t=>String(t?.en||'').toLowerCase()));
 for(const l of lines){
  const taken=[];const free=(a,b)=>!taken.some(([x,y])=>a<y&&b>x);
  const add=(start,heard,kind,suggestion='',why='')=>{const end=start+heard.length;if(!heard.trim()||!free(start,end))return;taken.push([start,end]);flags.push({id:'F-'+l.id+'-'+start,lineId:l.id,start,heard,kind,suggestion,why,by:'studio'});};
  for(const {re,term} of matchers){re.lastIndex=0;let m;while((m=re.exec(l.text)))add(m.index,m[0],'tea-term',term.en+(term.zh?' · '+term.zh:'')+(term.pinyin?' · '+term.pinyin:''),'Heard as a spoken or misheard form of a '+(term.cat||'tea')+' term.');}
  DATE.lastIndex=0;let m;while((m=DATE.exec(l.text)))add(m.index,m[0],'date','','A date to confirm.');
  NUMBER.lastIndex=0;while((m=NUMBER.exec(l.text))){const v=m[0];if(/^\d{4}s?$/.test(v)&&+v.slice(0,4)>=1000&&+v.slice(0,4)<=2100)add(m.index,v,'date','','A year to confirm.');else add(m.index,v,'number','','A number to confirm.');}
  const name=/(?<=[\p{L},;'’"“]\s+)(?:[A-Z][\p{L}'’-]+)(?:\s+[A-Z][\p{L}'’-]+)*/gu;
  while((m=name.exec(l.text))){if(NOT_NAMES.has(m[0])||canon.has(m[0].toLowerCase())||new RegExp('^(?:'+MONTHS+')$').test(m[0]))continue;add(m.index,m[0],'name','','A name or place to confirm.');}
 }
 return flags;
}
/** A line as Adrian corrected it: each confirmed correction replaces exactly the words that were heard. */
export function correctedText(line,flags,confirmations){
 const fixes=flags.filter(f=>f.lineId===line.id&&confirmations[f.id]?.verdict==='corrected').sort((a,b)=>b.start-a.start);
 let t=line.text;for(const f of fixes)t=t.slice(0,f.start)+confirmations[f.id].correction+t.slice(f.start+f.heard.length);
 return t;
}
/** Quoted words (“...” or "...") inside a caption draft. */
export const quotedSegments=t=>[...String(t||'').matchAll(/[“"]([^”"]{3,})[”"]/g)].map(m=>m[1].trim());

/** Each moment's place: used (on which frame or in which caption), in a proposed story, saved, skipped or not yet placed. */
export function coverage(plan){
 const byLine=new Map();for(const m of plan.moments||[])for(const id of m.lineIds)byLine.set(id,m.id);
 const uses=new Map(),stories=new Map();const push=(map,k,v)=>{if(!k)return;const a=map.get(k)||[];if(!a.some(x=>JSON.stringify(x)===JSON.stringify(v)))a.push(v);map.set(k,a);};
 for(const [format,l] of Object.entries(plan.layouts||{})){
  l.frames.forEach((f,i)=>{for(const w of f.words)push(uses,byLine.get(w.lineId),{format,frame:i+1});});
  for(const part of l.caption?.parts||[])if(part.lineId)push(uses,byLine.get(part.lineId),{format,caption:part.kind});
 }
 for(const s of plan.stories||[])for(const id of s.spine)push(stories,byLine.get(id),s.id);
 const moments=(plan.moments||[]).map(m=>{const u=uses.get(m.id)||[],st=stories.get(m.id)||[],mark=plan.marks?.[m.id];
  const status=u.length?'used':mark?.status||(st.length?'in-story':'unplaced');
  return {id:m.id,at:m.at,until:m.until,estimated:m.estimated,status,uses:u,stories:st,why:mark?.why||'',markedBy:mark?.by||''};});
 const count=s=>moments.filter(m=>m.status===s).length;
 return {moments,counts:{used:count('used'),'in-story':count('in-story'),saved:count('saved'),skipped:count('skipped'),unplaced:count('unplaced')},total:moments.length};
}
