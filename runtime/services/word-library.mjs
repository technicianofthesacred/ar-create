// The shared word library: the one list of names and terms every transcription of Adrian's voice should get right.
//
// It lives at <data>/word-library/library.json. The server is the only writer (one serial queue, atomic file
// replace); the detached transcription job only ever reads the file, through word-prompt.mjs.
//
// An entry is one correct spelling plus the ways it is said or misheard:
//   category   person | place | tea-term | gene-key | hexagram | other
//   variants   {text, kind}  kind `heard` is a known mishearing or respelling and is fixed automatically (with a
//              receipt); kind `alias` is another valid name for the thing (Wilhelm's "Ch'ien" for The Creative) and is
//              only ever recognised, never rewritten.
//   status     confirmed (Adrian, or a trusted seed) | proposed (an agent suggested it; Adrian has not confirmed it)
// Only confirmed entries reach a prompt, a fix, or the export. Proposed ones wait for Adrian on the Words screen.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {StateError} from '../store.mjs';
import {currentActor,isHuman} from './actor.mjs';
import {LIBRARY_SCHEMA,CATEGORIES,CATEGORY_LABELS,PROMPT_TOKENS,isCJK,norm,squash,buildPrompt} from './word-prompt.mjs';

export {CATEGORIES,CATEGORY_LABELS};
export const EXPORT_SCHEMA='ar-create.word-library.export.v1';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const LIMITS=Object.freeze({spelling:120,variant:120,variants:40,note:300,sets:8,set:40,languages:5,listMax:300,keptMax:2000,fileMax:8*1024*1024});
const fail=(message,status=400)=>{throw new StateError(message,status);};
const fields=(input,allowed,what='the request')=>{
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Send '+what+' as one JSON object.');
 const extra=Object.keys(input).filter(k=>!allowed.includes(k));if(extra.length)fail('Unknown field: '+extra[0]+'.');
};
const text=(v,what,max,{required=false}={})=>{
 if(v===undefined||v===null||v===''){if(required)fail(what+' is required.');return '';}
 if(typeof v!=='string')fail(what+' must be text.');
 const t=v.replace(/\s+/g,' ').trim();
 if(required&&!t)fail(what+' is required.');
 if(t.length>max)fail(what+' is up to '+max+' characters.');
 if(/[\u0000-\u001f\u007f]/.test(t))fail(what+' cannot hold control characters.');
 return t;
};
const uuidFrom=seed=>{const h=crypto.createHash('sha256').update(seed).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);};
const iso=ms=>new Date(ms).toISOString();
const defaultLanguages=spelling=>isCJK(spelling)?['zh']:['en'];
const languagesOf=(v,spelling)=>{
 if(v===undefined)return defaultLanguages(spelling);
 if(!Array.isArray(v)||v.length>LIMITS.languages||v.some(l=>typeof l!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(l)))fail('languages are up to '+LIMITS.languages+' language codes such as en or zh.');
 return [...new Set(v)];
};
/** Trusted writers: Adrian, and the seed scripts that import for him. Everyone else proposes. */
export const trusted=actor=>typeof actor==='string'&&(isHuman(actor)||actor.startsWith('import:'));
const stamp=(context,now)=>({addedBy:context?.actor||'unknown(in-process)',addedAt:iso(now())});

function variantsOf(list,spelling,context,now,{what='variants'}={}){
 if(list===undefined)return [];
 if(!Array.isArray(list)||list.length>LIMITS.variants)fail(what+' are up to '+LIMITS.variants+' words.');
 const out=[],seen=new Set([norm(spelling)]);
 for(const item of list){
  const raw=typeof item==='string'?{text:item}:item;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Each variant is text or {text, kind}.');
  fields(raw,['text','kind','languages'],'a variant');
  const t=text(raw.text,'A variant',LIMITS.variant,{required:true}),kind=raw.kind===undefined?'heard':raw.kind;
  if(!['heard','alias'].includes(kind))fail('A variant is heard (a mishearing, fixed automatically) or alias (another valid name).');
  const key=norm(t);if(seen.has(key))continue;seen.add(key);
  out.push({text:t,kind,languages:languagesOf(raw.languages,t),...stamp(context,now)});
 }
 return out;
}

/** The mishearing test used on seed data whose variants are not labelled: a respelling close to the spelling is
 *  `heard` (fixed automatically); a different phrase (a synonym, "ripe puerh" for Shou Puerh) is an `alias`. */
function lev(a,b){const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const c=[i];for(let k=1;k<=n;k++)c[k]=Math.min(p[k]+1,c[k-1]+1,p[k-1]+(a[i-1]===b[k-1]?0:1));p=c;}return p[n];}
export function classifyVariant(spelling,variant){
 if(isCJK(variant))return 'heard';
 const a=squash(spelling.replace(/\(.*?\)/g,' ')),b=squash(variant);
 if(!a||!b||b.length<=3)return 'alias';
 return a[0]===b[0]&&lev(a,b)/Math.max(a.length,b.length)<=0.4?'heard':'alias';
}

// ---- seed parsers: pure, so they can be tested with invented data ----
const TEA_CATEGORY={person:'person',place:'place'};
/** ~/builds/tea-terms.json -> entry inputs. `core`, topic sets and the original tea-terms category are kept. */
export function parseTeaTerms(json){
 if(!json||!Array.isArray(json.terms))fail('That is not a tea-terms library: it has no terms list.');
 return json.terms.filter(t=>t&&typeof t.en==='string'&&t.en.trim()).map(t=>{
  const spelling=t.en.replace(/\s*\(.*?\)\s*/g,' ').replace(/\s+/g,' ').trim()||t.en.trim();
  const qualifier=(t.en.match(/\((.*?)\)/)||[])[1]||'';
  const languages=t.zh?['en','zh']:['en'];
  return {
   spelling,category:TEA_CATEGORY[t.cat]||'tea-term',topic:t.cat||'',languages,
   zh:t.zh||'',trad:t.trad||'',pinyin:t.pinyin||'',note:qualifier,sets:[...new Set(t.sets||[])].slice(0,LIMITS.sets),core:t.core===true,
   variants:(t.variants||[]).map(v=>({text:v,kind:classifyVariant(spelling,v),languages:isCJK(v)?['zh']:['en']})),
  };
 });
}
const FRAMEWORK_TERMS=Object.freeze([
 {spelling:'Gene Keys',variants:['jean keys','gene keyes']},{spelling:'Siddhi',variants:[]},{spelling:'Codon Ring',variants:[]},
 {spelling:'Human Design',variants:[]},{spelling:'I Ching',variants:['i-ching','iching']},{spelling:'Hologenetic Profile',variants:[]},
]);
/** mandalacodes/oracle/oracle_cards_complete.json -> the 64 hexagram names and the Gene Keys shadow, gift and siddhi
 *  names. `chinese` maps hexagram number -> {char, pinyin}. Wilhelm's romanisation in brackets becomes an alias. */
export function parseOracleCards(json,chinese={}){
 const cards=(json?.codon_rings||[]).flatMap(r=>r.cards||[]);
 if(!cards.length)fail('That is not the oracle library: it has no cards.');
 const out=[],keys=new Map(),seen=new Set();
 for(const card of cards){
  const number=card.number,name=String(card.iching?.hexagram_name||'');
  const m=/^(.*?)\s*\((.*?)\)\s*$/.exec(name),spelling=(m?m[1]:name).trim();
  if(spelling&&!seen.has(norm(spelling))){
   seen.add(norm(spelling));
   out.push({spelling,category:'hexagram',languages:['en'],zh:chinese[number]?.char||'',pinyin:chinese[number]?.pinyin||'',note:'Hexagram '+number,sets:['oracle'],
    variants:m&&norm(m[2])!==norm(spelling)?[{text:m[2].trim(),kind:'alias'}]:[]});
  }
  for(const [role,term] of Object.entries({Shadow:card.gene_keys?.shadow,Gift:card.gene_keys?.gift,Siddhi:card.gene_keys?.siddhi})){
   const t=String(term||'').trim();if(!t)continue;
   const k=norm(t),line='Gene Key '+number+' '+role.toLowerCase();
   if(keys.has(k)){keys.get(k).note+='; '+line;continue;}
   const entry={spelling:t,category:'gene-key',languages:['en'],note:line,sets:['oracle'],variants:[]};
   keys.set(k,entry);out.push(entry);
  }
 }
 for(const t of FRAMEWORK_TERMS)if(!seen.has(norm(t.spelling))){seen.add(norm(t.spelling));out.push({spelling:t.spelling,category:'other',languages:['en'],note:'Oracle framework',sets:['oracle'],variants:t.variants.map(v=>({text:v,kind:'heard'}))});}
 return out;
}
function parseChineseHexagrams(source){
 const out={};
 for(const m of String(source).matchAll(/(\d+):\s*\{\s*char:\s*'([^']*)'\s*,\s*pinyin:\s*'([^']*)'/g))out[Number(m[1])]={char:m[2],pinyin:m[3]};
 return out;
}
const SEEDS={
 'tea-terms':{file:()=>path.join(os.homedir(),'builds','tea-terms.json'),ref:'tea-terms.json'},
 'oracle-cards':{file:()=>path.join(os.homedir(),'Documents','Files','4 Coding','mandalacodes','oracle','oracle_cards_complete.json'),ref:'oracle_cards_complete.json'},
};
function readSeedFile(file){
 let stat;try{stat=fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')fail('That file is not there: '+path.basename(file)+'.',404);throw error;}
 if(!stat.isFile()||stat.isSymbolicLink())fail('A seed must be a regular file.');
 if(stat.size>LIMITS.fileMax)fail('That file is larger than 8 MB.');
 return fs.readFileSync(file);
}

/** One library, one JSON file. `now` is injectable so tests control time. */
export function createWordLibrary({dataDir,now=()=>Date.now(),onChange=null}={}){
 if(!dataDir)throw Error('The word library needs the data folder.');
 const dir=path.join(dataDir,'word-library'),file=path.join(dir,'library.json');
 let queue=Promise.resolve();
 const listeners=new Set(onChange?[onChange]:[]);
 const notify=(kind,detail)=>{for(const listener of listeners){try{listener(kind,detail);}catch{/* a listener must never break a write */}}};
 const serial=fn=>{const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;};
 const empty=()=>({schema:LIBRARY_SCHEMA,revision:0,updatedAt:null,entries:[],kept:{}});
 const load=()=>{
  try{const v=JSON.parse(fs.readFileSync(file,'utf8'));if(v.schema!==LIBRARY_SCHEMA||!Array.isArray(v.entries))fail('The word library file is not readable.',409);v.kept||={};return v;}
  catch(error){if(error.code==='ENOENT')return empty();throw error;}
 };
 const store=state=>{
  state.revision+=1;state.updatedAt=iso(now());
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const tmp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(state,null,1),{mode:0o600});fs.renameSync(tmp,file);
 };
 const write=fn=>serial(async()=>{const state=load(),result=await fn(state);if(result?.dirty){store(state);notify(result.kind||'changed',{revision:state.revision});}return result?.value??result;});
 const byKey=(state,spelling)=>state.entries.find(e=>norm(e.spelling)===norm(spelling));
 const summary=state=>{
  const confirmed=state.entries.filter(e=>e.status==='confirmed'),byCategory=Object.fromEntries(CATEGORIES.map(c=>[c,confirmed.filter(e=>e.category===c).length]));
  return {total:confirmed.length,proposed:state.entries.filter(e=>e.status==='proposed'||(e.proposedVariants||[]).length).length,byCategory};
 };

 function cleanEntry(input,context){
  const spelling=text(input.spelling,'The spelling',LIMITS.spelling,{required:true});
  const category=input.category===undefined?'other':input.category;
  if(!CATEGORIES.includes(category))fail('category is one of '+CATEGORIES.join(', ')+'.');
  const sets=input.sets===undefined?[]:input.sets;
  if(!Array.isArray(sets)||sets.length>LIMITS.sets)fail('sets are up to '+LIMITS.sets+' short names.');
  return {
   spelling,category,topic:text(input.topic,'topic',LIMITS.set),languages:languagesOf(input.languages,spelling),
   zh:text(input.zh,'zh',60),trad:text(input.trad,'trad',60),pinyin:text(input.pinyin,'pinyin',80),note:text(input.note,'note',LIMITS.note),
   sets:sets.map(s=>text(s,'A set',LIMITS.set,{required:true})),core:input.core===true,
   variants:variantsOf(input.variants,spelling,context,now),
  };
 }
 /** Add variants the entry lacks (never the spelling itself, never one a different entry already owns as its spelling). */
 function mergeVariants(state,entry,variants){
  const have=new Set([norm(entry.spelling),...entry.variants.map(v=>norm(v.text))]),added=[];
  for(const v of variants){
   const k=norm(v.text);if(have.has(k))continue;
   const owner=byKey(state,v.text);if(owner&&owner!==entry&&v.kind==='heard')continue;
   have.add(k);entry.variants.push(v);added.push(v);
  }
  return added;
 }
 const needHuman=(what,context)=>{if(!context||!isHuman(context.actor))fail(what+' is Adrian\'s to decide; '+(context?.actor||'an unattributed caller')+' may suggest words, never confirm them.',403);};

 // ---- reads ----
 async function list({q='',category,status,limit=LIMITS.listMax,recent=8}={}){
  if(category!==undefined&&category!==''&&!CATEGORIES.includes(category))fail('category is one of '+CATEGORIES.join(', ')+'.');
  if(status!==undefined&&status!==''&&!['confirmed','proposed','all'].includes(status))fail('status is confirmed, proposed or all.');
  const n=Math.min(LIMITS.listMax,Math.max(1,Number(limit)||LIMITS.listMax));
  return serial(()=>{
   const state=load(),needle=norm(q),want=status||'confirmed';
   let rows=state.entries.filter(e=>want==='all'||e.status===want||(want==='proposed'&&(e.proposedVariants||[]).length));
   if(category)rows=rows.filter(e=>e.category===category);
   if(needle)rows=rows.filter(e=>[e.spelling,e.zh,e.trad,e.pinyin,e.note,...e.variants.map(v=>v.text)].some(s=>norm(s).includes(needle)));
   rows=[...rows].sort((a,b)=>a.spelling.localeCompare(b.spelling,'en',{sensitivity:'base'}));
   const learned=state.entries.filter(e=>e.status==='confirmed'&&(e.source?.kind==='confirmed-answer'||e.variants.some(v=>v.source?.kind==='confirmed-answer')))
    .sort((a,b)=>Date.parse(lastLearned(b))-Date.parse(lastLearned(a))).slice(0,recent);
   return {schema:LIBRARY_SCHEMA,revision:state.revision,counts:summary(state),categories:CATEGORIES.map(id=>({id,label:CATEGORY_LABELS[id]})),matched:rows.length,entries:rows.slice(0,n),recent:learned};
  });
 }
 const lastLearned=e=>[e.source?.kind==='confirmed-answer'?e.addedAt:null,...e.variants.filter(v=>v.source?.kind==='confirmed-answer').map(v=>v.addedAt)].filter(Boolean).sort().at(-1)||e.addedAt;

 /** Confirmed entries as the recogniser and prompt builder see them. */
 const entries=()=>serial(()=>structuredClone(load().entries.filter(e=>e.status==='confirmed')));
 const snapshot=()=>serial(()=>{const s=load();return {revision:s.revision,entries:structuredClone(s.entries.filter(e=>e.status==='confirmed')),kept:{...s.kept}};});
 const filePath=()=>file;

 // ---- writes ----
 /** Agents and cron jobs propose; Adrian and his seed scripts add. */
 async function add(input,context=currentActor()){
  fields(input,['operationId','spelling','category','variants','languages','zh','trad','pinyin','note','sets','core','topic','source']);
  if(!UUID.test(input.operationId||''))fail('A new word needs a fresh operationId.');
  if(!context)fail('Writes need an actor.',400);
  const clean=cleanEntry(input,context),confirmed=trusted(context.actor);
  let source={kind:'manual',ref:''};
  if(input.source!==undefined){
   fields(input.source,['kind','ref'],'source');
   if(input.source.kind!==undefined&&!['manual','conversation','recording','book','other'].includes(input.source.kind))fail('source.kind is manual, conversation, recording, book or other.');
   source={kind:input.source.kind||'manual',ref:text(input.source.ref,'source.ref',200)};
  }
  return write(state=>{
   const replay=state.entries.find(e=>e.operationId===input.operationId);if(replay)return {value:{entry:replay,replay:true}};
   const found=byKey(state,clean.spelling);
   if(found){
    if(confirmed){
     const added=mergeVariants(state,found,clean.variants);
     let promoted=false;if(found.status==='proposed'){found.status='confirmed';found.confirmedBy=context.actor;found.confirmedAt=iso(now());promoted=true;}
     return {dirty:added.length>0||promoted,kind:'changed',value:{entry:found,existing:true,addedVariants:added.map(v=>v.text),promoted}};
    }
    const have=new Set([norm(found.spelling),...found.variants.map(v=>norm(v.text)),...(found.proposedVariants||[]).map(v=>norm(v.text))]);
    const fresh=clean.variants.filter(v=>!have.has(norm(v.text))).map(v=>({...v,proposedBy:context.actor}));
    if(fresh.length){found.proposedVariants=[...(found.proposedVariants||[]),...fresh];}
    return {dirty:fresh.length>0,kind:'proposed',value:{entry:found,existing:true,proposedVariants:fresh.map(v=>v.text)}};
   }
   const entry={id:crypto.randomUUID(),operationId:input.operationId,...clean,status:confirmed?'confirmed':'proposed',source,...stamp(context,now),
    ...(confirmed?{confirmedBy:context.actor,confirmedAt:iso(now())}:{proposedBy:context.actor})};
   state.entries.push(entry);
   return {dirty:true,kind:confirmed?'added':'proposed',value:{entry}};
  });
 }

 /** Adrian's yes or no on a suggestion: an agent's proposed word, or a mishearing an agent suggested for a word he has. */
 async function decide(input,context=currentActor()){
  fields(input,['operationId','id','decision']);
  needHuman('Confirming a word',context);
  if(!UUID.test(input.operationId||''))fail('A decision needs a fresh operationId.');
  if(!UUID.test(input.id||''))fail('Name the word by its id.');
  if(!['confirm','reject'].includes(input.decision))fail('decision is confirm or reject.');
  return write(state=>{
   const entry=state.entries.find(e=>e.id===input.id);if(!entry)fail('That word is not in the library.',404);
   const pending=entry.status==='proposed'||(entry.proposedVariants||[]).length>0;
   if(!pending)return {value:{entry,unchanged:true}};
   if(input.decision==='reject'){
    if(entry.status==='proposed'){state.entries=state.entries.filter(e=>e!==entry);return {dirty:true,kind:'rejected',value:{removed:entry.id,spelling:entry.spelling}};}
    entry.proposedVariants=[];return {dirty:true,kind:'rejected',value:{entry}};
   }
   if(entry.status==='proposed'){entry.status='confirmed';entry.confirmedBy=context.actor;entry.confirmedAt=iso(now());}
   const proposed=(entry.proposedVariants||[]).map(({proposedBy,...v})=>({...v,addedBy:proposedBy||v.addedBy,confirmedBy:context.actor}));
   entry.proposedVariants=[];
   const added=mergeVariants(state,entry,proposed);
   return {dirty:true,kind:'confirmed',value:{entry,addedVariants:added.map(v=>v.text)}};
  });
 }

 /** Remember Adrian's confirmed spelling: a new entry, or a new mishearing on the entry that already has it. */
 async function learn({heard,spelling,category='other',from={},operationId},context=currentActor()){
  needHuman('Teaching the library a spelling',context);
  const clean=text(spelling,'The spelling',LIMITS.spelling,{required:true}),said=text(heard,'The heard word',LIMITS.variant);
  if(!CATEGORIES.includes(category))fail('category is one of '+CATEGORIES.join(', ')+'.');
  const source={kind:'confirmed-answer',recording:from.jobId||'',story:text(from.story,'story',120),at:Number.isFinite(from.at)?from.at:null,sentence:text(from.sentence,'sentence',300),operationId:operationId||''};
  return write(state=>{
   let entry=byKey(state,clean),created=false,variant=null;
   if(!entry){
    entry={id:crypto.randomUUID(),operationId:operationId||crypto.randomUUID(),spelling:clean,category,topic:'',languages:defaultLanguages(clean),zh:'',trad:'',pinyin:'',note:'',sets:[],core:false,variants:[],
     status:'confirmed',source,...stamp(context,now),confirmedBy:context.actor,confirmedAt:iso(now())};
    state.entries.push(entry);created=true;
   }else if(entry.status==='proposed'){entry.status='confirmed';entry.confirmedBy=context.actor;entry.confirmedAt=iso(now());}
   if(said&&norm(said)!==norm(clean)){
    const k=norm(said);
    const existing=entry.variants.find(v=>norm(v.text)===k);
    if(existing){if(existing.kind==='alias'){/* he says it is a mishearing: it becomes one */existing.kind='heard';existing.source=source;}}
    else{variant={text:said,kind:'heard',languages:languagesOf(undefined,said),...stamp(context,now),source};entry.variants.push(variant);}
   }
   return {dirty:created||!!variant,kind:'learned',value:{entry,created,variant}};
  });
 }

 /** How many times he has said "keep as heard" about a word, so the check stops asking after the second. */
 async function noteKept(word){
  const k=norm(word);if(!k)return 0;
  return write(state=>{
   const keys=Object.keys(state.kept);if(keys.length>=LIMITS.keptMax&&!(k in state.kept))delete state.kept[keys[0]];
   state.kept[k]=(state.kept[k]||0)+1;return {dirty:true,kind:'kept',value:state.kept[k]};
  });
 }

 /** Seed from a file that already exists. The source file is only ever read. */
 async function importFrom(input,context=currentActor()){
  fields(input,['operationId','source','path']);
  if(!context||!trusted(context.actor))fail('Seeding the library is for Adrian or an import script; '+(context?.actor||'an unattributed caller')+' may suggest single words instead.',403);
  if(!UUID.test(input.operationId||''))fail('An import needs a fresh operationId.');
  const seed=SEEDS[input.source];if(!seed)fail('source is '+Object.keys(SEEDS).join(' or ')+'.');
  let where=seed.file();
  if(input.path!==undefined){
   if(typeof input.path!=='string'||!path.isAbsolute(input.path)||path.extname(input.path)!=='.json')fail('path is the absolute path of a .json file.');
   where=input.path;
  }
  const bytes=readSeedFile(where),sha=crypto.createHash('sha256').update(bytes).digest('hex');
  let json;try{json=JSON.parse(bytes.toString('utf8'));}catch{fail('That file is not readable JSON.');}
  let parsed;
  if(input.source==='tea-terms')parsed=parseTeaTerms(json);
  else{
   let chinese={};
   try{chinese=parseChineseHexagrams(fs.readFileSync(path.join(path.dirname(where),'..','data','hexagramChinese.ts'),'utf8'));}catch{/* the Chinese names are a nicety */}
   parsed=parseOracleCards(json,chinese);
  }
  const source={kind:'import',ref:seed.ref,sha256:sha.slice(0,16),operationId:input.operationId};
  return write(state=>{
   if(state.imports?.[input.operationId])return {value:{...state.imports[input.operationId],replay:true}};
   let created=0,updated=0,unchanged=0;
   for(const raw of parsed){
    const clean=cleanEntry({...raw,variants:undefined},context),variants=variantsOf(raw.variants,clean.spelling,context,now);
    const found=byKey(state,clean.spelling);
    if(!found){
     state.entries.push({id:uuidFrom(input.source+':'+norm(clean.spelling)+':'+clean.category),operationId:null,...clean,variants,status:'confirmed',source,...stamp(context,now),confirmedBy:context.actor,confirmedAt:iso(now())});
     created++;continue;
    }
    // A repeat import adds what is new and never removes or changes what Adrian taught the library.
    const added=mergeVariants(state,found,variants);
    let touched=added.length>0;
    for(const key of ['zh','trad','pinyin','topic'])if(!found[key]&&clean[key]){found[key]=clean[key];touched=true;}
    if(found.status==='proposed'){found.status='confirmed';found.confirmedBy=context.actor;found.confirmedAt=iso(now());touched=true;}
    touched?updated++:unchanged++;
   }
   const result={source:input.source,file:path.basename(where),sha256:source.sha256,entries:parsed.length,created,updated,unchanged};
   state.imports={...(state.imports||{}),[input.operationId]:result};
   const ids=Object.keys(state.imports);if(ids.length>20)delete state.imports[ids[0]];
   return {dirty:true,kind:'imported',value:result};
  });
 }

 // ---- outputs ----
 /** The prompt Whisper gets. Empty when the library has nothing confirmed. */
 async function promptFor({language='en',prefer=[],budget=PROMPT_TOKENS}={}){return buildPrompt(await entries(),{language,prefer,budget});}

 /** A versioned snapshot other projects import at deploy. Shape documented in docs/WORDS.md. */
 async function exportSnapshot(){
  const state=await serial(()=>load());
  const confirmed=state.entries.filter(e=>e.status==='confirmed');
  const out=confirmed.map(e=>({
   id:e.id,spelling:e.spelling,category:e.category,languages:e.languages,
   ...(e.zh?{zh:e.zh}:{}),...(e.trad?{trad:e.trad}:{}),...(e.pinyin?{pinyin:e.pinyin}:{}),...(e.note?{note:e.note}:{}),
   ...(e.sets?.length?{sets:e.sets}:{}),...(e.core?{core:true}:{}),
   variants:e.variants.map(v=>({text:v.text,kind:v.kind,languages:v.languages})),
   source:{kind:e.source?.kind||'manual',...(e.source?.ref?{ref:e.source.ref}:{})},addedBy:e.addedBy,addedAt:e.addedAt,
  })).sort((a,b)=>a.spelling.localeCompare(b.spelling,'en',{sensitivity:'base'})||a.id.localeCompare(b.id));
  const contentHash=crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');
  return {
   schema:EXPORT_SCHEMA,version:state.revision+'.'+contentHash.slice(0,8),libraryRevision:state.revision,contentHash,exportedAt:iso(now()),
   counts:{entries:out.length,byCategory:Object.fromEntries(CATEGORIES.map(c=>[c,out.filter(e=>e.category===c).length]))},
   categories:CATEGORIES.map(id=>({id,label:CATEGORY_LABELS[id]})),
   promptBudgetTokens:PROMPT_TOKENS,
   prompts:{en:buildPrompt(confirmed,{language:'en'}).prompt,zh:buildPrompt(confirmed,{language:'zh'}).prompt},
   entries:out,
  };
 }

 return {list,entries,snapshot,filePath,add,decide,learn,noteKept,importFrom,promptFor,exportSnapshot,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);}};
}

const shared=new Map();
/** The one library for a data folder. Everything in the server that writes the library (the Words routes, the Instagram
 *  studio remembering a correction) must use this instance, so the file is only ever written from one queue. */
export function sharedWordLibrary({dataDir}){
 if(!shared.has(dataDir))shared.set(dataDir,createWordLibrary({dataDir}));
 return shared.get(dataDir);
}

/** The library in the shape the Instagram studio's flagging reads (the Teajia tea-terms shape): {en, zh, pinyin, cat, variants}.
 *  Mishearings and aliases both become things to flag; the library's spelling is the suggestion, never applied. */
export function libraryAsTerms(entries){
 return entries.filter(e=>e.status==='confirmed').map(e=>({en:e.spelling,zh:e.zh||'',pinyin:e.pinyin||'',cat:e.topic||(e.category==='tea-term'?'tea':(CATEGORY_LABELS[e.category]||e.category).toLowerCase()),variants:(e.variants||[]).map(v=>v.text)}));
}
