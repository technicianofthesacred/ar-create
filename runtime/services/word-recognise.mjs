// Recognise: read a finished transcript against the word library.
//
// Pure functions over a transcript result ({segments:[{start,end,text,words?,avg_logprob?}]}) and the confirmed library
// entries. Nothing here writes, asks or fixes anything; shared-words.mjs does that with what these return.
//
//   findHits      which library words are in the talk, and how it was said
//   findFixes     known mishearings of confirmed words (variant kind `heard`), with the exact place of each
//   findDoubtful  words worth a second look: low-confidence words, names the library does not know, numbers and
//                 dates, and near-misses of a library word ("Lu Yo" for Lu Yu)
import {isCJK,norm,squash} from './word-prompt.mjs';

const TOKEN=/[\p{L}\p{N}](?:[\p{L}\p{N}'’\-]*[\p{L}\p{N}])?/gu;
const LOW_WORD=0.5;           // a word the model gave under half its confidence
const LOW_SEGMENT=-1;         // avg_logprob below this: the whole stretch was shaky
export const MAX_DOUBTFUL=40; // one 20-minute talk must not flood the list

// Words that are capitalised mid-sentence for ordinary reasons. Not a dictionary: only what would otherwise be noise.
const COMMON=new Set(('i i\'m i\'ll i\'ve i\'d monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december '
 +'english chinese japanese taiwanese indonesian balinese korean french german american european asian christmas god mr mrs ms dr okay ok yeah yes tea').split(' '));
const STOP=new Set(('the and but for you not with this that have from they what when your were been will would there their about which could other than then them these some into more also just like very much only over such even most make made many well know take people because really think going').split(' '));

const sentenceOf=(text,at)=>{
 const parts=[];let from=0;
 for(const m of text.matchAll(/[.!?…]+["”’)]*\s+/g)){parts.push([from,m.index+m[0].length]);from=m.index+m[0].length;}
 parts.push([from,text.length]);
 const [a,b]=parts.find(([s,e])=>at>=s&&at<e)||[0,text.length];
 const sentence=text.slice(a,b).trim();
 return sentence.length>240?'…'+text.slice(Math.max(0,at-110),at+110).trim()+'…':sentence;
};
const startsSentence=(text,index)=>{const before=text.slice(0,index).trimEnd();return !before||/[.!?…:"“(]$/.test(before);};
const word=w=>norm(String(w?.word??w?.text??'')).replace(/[^\p{L}\p{N} ]/gu,'').trim();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** Every spelling, alias and mishearing of every confirmed entry, as one searchable form. */
function formsOf(entries){
 const forms=[],spellings=new Set(entries.map(e=>norm(e.spelling)));
 for(const e of entries){
  for(const s of [e.spelling,e.zh,e.trad])if(s)forms.push({text:s,entry:e,kind:'spelling'});
  for(const v of e.variants||[]){
   if(!v.text)continue;
   // A mishearing that is another entry's spelling, or too short to trust, is recognised but never rewritten.
   const safe=v.kind!=='alias'&&!spellings.has(norm(v.text))&&(isCJK(v.text)?v.text.length>=2:squash(v.text).length>3);
   forms.push({text:v.text,entry:e,kind:v.kind==='alias'?'alias':safe?'heard':'alias'});
  }
 }
 return forms;
}
function matcher(form){
 const body=escape(form.text.trim()).replace(/\\?[\s\-]+/g,'[\\s\\-]+').replace(/['’]/g,'[\'’]');
 return isCJK(form.text)?new RegExp(body,'gu'):new RegExp('(?<![\\p{L}\\p{N}])'+body+'(?![\\p{L}\\p{N}])','giu');
}
function* matchesIn(text,forms,regexes){
 for(let i=0;i<forms.length;i++){
  const re=regexes[i];re.lastIndex=0;
  for(const m of text.matchAll(re))yield {form:forms[i],index:m.index,length:m[0].length,heard:m[0]};
 }
}
const prepared=entries=>{const forms=formsOf(entries).sort((a,b)=>b.text.length-a.text.length);return {forms,regexes:forms.map(matcher)};};

/** Which library words are in the talk. */
export function findHits(result,entries){
 const {forms,regexes}=prepared(entries),hits=new Map();
 for(const [index,segment] of (result.segments||[]).entries()){
  const taken=[];
  for(const m of matchesIn(segment.text||'',forms,regexes)){
   if(taken.some(([a,b])=>m.index<b&&m.index+m.length>a))continue;taken.push([m.index,m.index+m.length]);
   const hit=hits.get(m.form.entry.id)||{entryId:m.form.entry.id,spelling:m.form.entry.spelling,category:m.form.entry.category,count:0,heard:{},firstSegment:index,firstAt:segment.start};
   hit.count++;hit.heard[m.heard]=(hit.heard[m.heard]||0)+1;hits.set(m.form.entry.id,hit);
  }
 }
 return [...hits.values()].sort((a,b)=>b.count-a.count||a.spelling.localeCompare(b.spelling));
}

/** Known mishearings, replaced with the confirmed spelling. Returns one correction per segment that changes:
 *  {index, text} for the transcript owner, plus `changes` naming each swap for the receipt and the report. */
export function findFixes(result,entries){
 const {forms,regexes}=prepared(entries),corrections=[],changes=[];
 for(const [index,segment] of (result.segments||[]).entries()){
  const text=segment.text||'',taken=[],edits=[];
  for(const m of matchesIn(text,forms,regexes)){
   if(taken.some(([a,b])=>m.index<b&&m.index+m.length>a))continue;taken.push([m.index,m.index+m.length]);
   if(m.form.kind!=='heard'||m.heard===m.form.entry.spelling)continue;
   edits.push({from:m.index,to:m.index+m.length,heard:m.heard,entry:m.form.entry});
  }
  if(!edits.length)continue;
  edits.sort((a,b)=>b.from-a.from);
  let next=text;for(const e of edits)next=next.slice(0,e.from)+e.entry.spelling+next.slice(e.to);
  if(next===text||!next.trim())continue;
  corrections.push({index,text:next});
  for(const e of edits.reverse())changes.push({segmentIndex:index,start:segment.start,heard:e.heard,spelling:e.entry.spelling,entryId:e.entry.id,sentence:sentenceOf(text,e.from)});
 }
 return {corrections,changes};
}

const bound=n=>n<=7?1:2;
function distance(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const row=[i];let low=i;
  for(let k=1;k<=b.length;k++){const v=Math.min(prev[k]+1,row[k-1]+1,prev[k-1]+(a[i-1]===b[k-1]?0:1));row[k]=v;if(v<low)low=v;}
  if(low>limit)return limit+1;
  prev=row;
 }
 return prev[b.length];
}
const mmss=s=>{const t=Math.max(0,Math.round(s));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
export {mmss};

/** Words worth a second look. `kept` is how often Adrian already said "keep as heard" about a word (see the library). */
export function findDoubtful(result,entries,{kept={},max=MAX_DOUBTFUL}={}){
 const forms=formsOf(entries).filter(f=>!isCJK(f.text));
 const known=new Set(),index=new Map(); // known tokens; candidate forms by squashed length
 for(const f of forms){
  for(const w of norm(f.text).split(' '))if(w)known.add(w);
  const s=squash(f.text);if(s.length<4)continue;
  (index.get(s.length)||index.set(s.length,[]).get(s.length)).push({s,form:f,words:norm(f.text).split(' ').length});
 }
 const exact=new Set(forms.map(f=>squash(f.text)));
 const found=new Map();
 const add=(kind,text,segment,segmentIndex,at,score,extra={})=>{
  const key=kind+':'+squash(text),item=found.get(key);
  const sentence=sentenceOf(segment.text,at.char);
  if(item){item.occurrences++;if(item.times.length<5)item.times.push(at.time);item.score=Math.max(item.score,score);return;}
  found.set(key,{key,kind,word:text,segmentIndex,start:at.time,end:segment.end,sentence,occurrences:1,times:[at.time],score,suggestion:null,entryId:null,...extra});
 };
 for(const [segmentIndex,segment] of (result.segments||[]).entries()){
  const text=segment.text||'';if(!text.trim())continue;
  const shaky=Number.isFinite(segment.avg_logprob)&&segment.avg_logprob<LOW_SEGMENT;
  const weak=new Map(); // normalised word -> {prob,start}
  for(const w of segment.words||[]){const n=word(w);if(n&&Number.isFinite(w.probability)&&w.probability<LOW_WORD&&(!weak.has(n)||w.probability<weak.get(n).prob))weak.set(n,{prob:w.probability,start:w.start});}
  const tokens=[...text.matchAll(TOKEN)].map(m=>({text:m[0],index:m.index,n:norm(m[0])}));
  const timeOf=t=>weak.get(t.n)?.start??segment.start;
  const claimed=new Set();
  // 1. near-misses of a library word, over windows of one to three words
  for(let i=0;i<tokens.length;i++){
   for(let size=3;size>=1;size--){
    const win=tokens.slice(i,i+size);if(win.length<size||win.some((t,k)=>claimed.has(i+k)||isCJK(t.text)))continue;
    if(win.some((t,k)=>k&&!/^[\s'’\-,]*$/.test(text.slice(win[k-1].index+win[k-1].text.length,t.index))))continue;
    const joined=squash(win.map(t=>t.text).join(' '));
    if(joined.length<(size===1?5:4)||exact.has(joined)||win.every(t=>STOP.has(t.n)||known.has(t.n)))continue;
    const limit=bound(joined.length);let best=null;
    for(let len=joined.length-limit;len<=joined.length+limit;len++){
     for(const c of index.get(len)||[]){
      if(c.s===joined||c.words!==size)continue;
      const d=distance(joined,c.s,limit);
      if(d<=limit&&(!best||d<best.d))best={d,form:c.form};
     }
    }
    if(!best)continue;
    for(let k=0;k<size;k++)claimed.add(i+k);
    const shown=text.slice(win[0].index,win.at(-1).index+win.at(-1).text.length);
    add('near-match',shown,segment,segmentIndex,{time:timeOf(win[0]),char:win[0].index},100-best.d*5,{suggestion:best.form.entry.spelling,entryId:best.form.entry.id,category:best.form.entry.category});
    break;
   }
  }
  // 2. single words
  for(const [i,t] of tokens.entries()){
   if(claimed.has(i)||isCJK(t.text))continue;
   const letters=/^[\p{L}'’\-]+$/u.test(t.text);
   if(/\d/.test(t.text)){
    const digits=(t.text.match(/\d/g)||[]).length;
    if(digits>=2||/[,.:\/]/.test(t.text))add('number',t.text,segment,segmentIndex,{time:timeOf(t),char:t.index},40);
    continue;
   }
   if(!letters||t.n.length<3||known.has(t.n)||STOP.has(t.n))continue;
   const name=/^\p{Lu}/u.test(t.text)&&t.text!==t.text.toUpperCase()&&!startsSentence(text,t.index)&&!COMMON.has(t.n)&&(kept[t.n]||0)<2;
   const low=weak.has(t.n);
   if(low&&!COMMON.has(t.n))add('low-confidence',t.text,segment,segmentIndex,{time:timeOf(t),char:t.index},name?80:shaky?65:55);
   else if(name)add('unknown-name',t.text,segment,segmentIndex,{time:timeOf(t),char:t.index},shaky?60:50);
  }
 }
 const ranked=[...found.values()].sort((a,b)=>b.score-a.score||b.occurrences-a.occurrences||a.start-b.start);
 const kept_=ranked.slice(0,max).sort((a,b)=>a.start-b.start||a.word.localeCompare(b.word));
 return {items:kept_,dropped:Math.max(0,ranked.length-max),total:ranked.length};
}

/** Replace one thing Adrian confirmed everywhere it was heard in this talk. Used for his answers, never for the
 *  automatic pass. Whole words only, case-insensitive; spaces and hyphens in the heard form match either. */
export function findReplacements(result,from,to){
 const re=matcher({text:from}),corrections=[],changes=[];
 for(const [index,segment] of (result.segments||[]).entries()){
  const text=segment.text||'';re.lastIndex=0;
  const hits=[...text.matchAll(re)].filter(m=>m[0]!==to);
  if(!hits.length)continue;
  let next=text;for(const m of [...hits].reverse())next=next.slice(0,m.index)+to+next.slice(m.index+m[0].length);
  if(next!==text&&next.trim()){corrections.push({index,text:next});for(const m of hits)changes.push({segmentIndex:index,start:segment.start,heard:m[0],spelling:to});}
 }
 return {corrections,changes};
}
