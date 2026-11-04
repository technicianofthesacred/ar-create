// Instagram studio: a voice transcript and photos in; two or three possible stories out, each with photos matched to
// the lines they belong to and the research worth doing; then, for the story Adrian picks or names, one strong default
// layout in a story, reel, post or carousel, his words exactly as he said them, and a caption drafted as a proposal.
//
// Who does what (AR Create's three bands): agents propose stories, matches, gaps, layouts and captions. Only Adrian
// picks or names the story, says who it is for, and gives the final yes. Nothing here posts to Instagram or sends
// anything: "ready" records his yes; he posts it himself.
//
// The transcript and photos stay in Library. A plan stores Library ids and hashes, and its lines are exact slices of the
// transcript text, so every word on a frame can be traced to what was said.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {StateError} from '../store.mjs';
import {currentActor,isHuman,requireWriteActor,chatDecider} from './actor.mjs';
import {FORMATS,CAPTION,FACTS,catalog,templateById,renderFrame,frameDocument,sheetDocument} from './instagram-templates.mjs';
import {deriveLines,deriveMoments,wholeness,detectFlags,correctedText,quotedSegments,coverage,loadTeaTerms,clock} from './instagram-transcript.mjs';
import {readLibraryFile} from './word-prompt.mjs';
import {sharedWordLibrary,libraryAsTerms} from './word-library.mjs';
export {deriveLines} from './instagram-transcript.mjs';

const SCHEMA='ar-create.instagram-plan.v1',PREFIX='/api/instagram/',MAX_BODY=2*1024*1024;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/,SUBJECT=/^[A-Za-z0-9._:-]{0,160}$/;
export const DOORS=Object.freeze(['teajia','art','mandala-codes','personal']);
const FORMAT_NAMES=Object.keys(FORMATS),ROLES=['cover','inner','close'],GAP_STATUS=['open','checking','answered','resting'];
const FLAG_KINDS=['tea-term','name','place','number','date','other'],MARKS=['saved','skipped'];
const IMAGE=/\.(?:jpe?g|png|webp|heic|heif|gif|tiff?)$/i;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const text=(v,what,max,{required=false}={})=>{if(v===undefined||v===null){if(required)fail(what+' is required.');return '';}if(typeof v!=='string'||v.length>max)fail(what+' must be text up to '+max+' characters.');if(required&&!v.trim())fail(what+' is required.');return v;};
const list=(v,what,max)=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>max)fail(what+' must be a list of up to '+max+'.');return v;};
const actorNow=()=>currentActor()?.actor||'';
const human=()=>isHuman(actorNow());
export const hashtags=caption=>[...String(caption||'').matchAll(/(^|\s)#[\p{L}\p{N}_]+/gu)].length;

/** A spoken line's time on screen: about two and a half words a second, never under two seconds. */
export const secondsFor=words=>Math.min(30,Math.max(2,Math.round((String(words).trim().split(/\s+/).filter(Boolean).length/2.5+0.8)*10)/10));
const srtTime=sec=>{const ms=Math.round(sec*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(ms%1000).padStart(3,'0');};

const empty=()=>({schema:SCHEMA,id:'',subject:'',title:'',door:'',revision:0,material:{transcripts:[],photos:[]},lines:[],moments:[],flags:[],confirmations:{},marks:{},meaningLog:[],stories:[],gaps:[],heard:null,chosen:null,layouts:{},ready:{},operations:[]});
const content=p=>JSON.stringify({subject:p.subject,title:p.title,door:p.door,material:p.material,lines:p.lines,moments:p.moments,flags:p.flags,confirmations:p.confirmations,marks:p.marks,meaningLog:p.meaningLog,stories:p.stories,gaps:p.gaps,heard:p.heard,chosen:p.chosen,layouts:p.layouts,ready:p.ready});
const withHash=p=>({...p,hash:digest(content(p))});
// Lines a piece leans on: on a frame, quoted in a caption, or in a story's spine.
const usedLines=(p,format)=>{const out=new Set();for(const [f,l] of Object.entries(p.layouts||{})){if(format&&f!==format)continue;for(const fr of l.frames)for(const w of fr.words)out.add(w.lineId);for(const part of l.caption?.parts||[])if(part.lineId)out.add(part.lineId);}if(!format)for(const s of p.stories||[])for(const id of s.spine)out.add(id);return out;};
const openFlags=(p,lineIds)=>(p.flags||[]).filter(f=>lineIds.has(f.lineId)&&!p.confirmations?.[f.id]);
const layoutHash=l=>digest(JSON.stringify({storyId:l.storyId,format:l.format,frames:l.frames,caption:l.caption}));

export function createInstagramStudio({dataDir,library,teaTerms,consentDesk=null}={}){
 // The words to flag come from the shared word library (confirmed words and the mishearings Adrian taught it); with
 // nothing confirmed there yet, the Teajia tea-terms file is the fallback, as before.
 const libraryTerms=()=>{const lib=readLibraryFile(path.join(dataDir,'word-library','library.json')),words=(lib?.entries||[]).filter(e=>e.status==='confirmed');return words.length?libraryAsTerms(words):null;};
 const terms=()=>teaTerms??libraryTerms()??loadTeaTerms();
 if(!dataDir)throw Error('The Instagram studio needs the data folder.');
 const dir=path.join(dataDir,'instagram-plans'),queues=new Map();
 const file=id=>path.join(dir,id+'.json');
 const serial=(id,fn)=>{const run=(queues.get(id)||Promise.resolve()).then(fn,fn);queues.set(id,run.catch(()=>{}));return run;};
 const load=id=>{if(!UUID.test(id||''))fail('Name the plan by its id.');try{const p=JSON.parse(fs.readFileSync(file(id),'utf8'));if(p.schema!==SCHEMA||p.id!==id)fail('This plan file is not readable.',409);return p;}catch(error){if(error.code==='ENOENT')fail('No Instagram plan has that id.',404);throw error;}};
 const asksFile=id=>path.join(dir,id+'.asks.json');
 const readAsks=id=>{try{return JSON.parse(fs.readFileSync(asksFile(id),'utf8'));}catch{return {asked:[],asks:[]};}};
 // The consent desk this plan answers to: its subject (a project id), or, when it names none, the desk that already links the plan's
 // own Library sources. A plan that can be tied to neither has no desk to check, so its yes is refused until it is linked.
 const UNLINKED='Link this to a piece first so consent can be checked.';
 const scopesOf=p=>{
  if(p.subject)return [{parentStudyId:p.subject}];
  return consentDesk?.scopesLinkedTo([...(p.material?.transcripts||[]),...(p.material?.photos||[])].map(x=>x.sourceId))||[];
 };
 const unlinkedHold={held:true,unlinked:true,summary:UNLINKED,link:'',who:[],parentStudyId:'',pieceKey:'main'};
 // Null when nothing holds it. Shown on every read so the page can say why Ready to post is off; the same check refuses the yes.
 const holdOf=p=>{
  if(!consentDesk)return null;
  const scopes=scopesOf(p);if(!scopes.length)return unlinkedHold;
  try{return consentDesk.holdFor(scopes);}
  catch(error){return {held:true,summary:error.message,link:'',who:[],parentStudyId:scopes[0].parentStudyId,pieceKey:'main'};}
 };
 // requireLink: the yes needs a desk to check; the files that get posted are held only when a desk is found and holds them.
 const assertNotHeld=(p,what,{requireLink=false}={})=>{
  if(!consentDesk)return;
  const scopes=scopesOf(p);
  if(!scopes.length){if(requireLink)throw Object.assign(new StateError(UNLINKED,423),{hold:unlinkedHold});return;}
  consentDesk.assertNotHeld(scopes,what);
 };
 const view=p=>{const {operations,...rest}=withHash({...empty(),...p});const used=usedLines(rest);
  return {...rest,publishHold:holdOf(rest),coverage:coverage(rest),flagStatus:rest.flags.map(f=>({id:f.id,status:rest.confirmations[f.id]?.verdict||'open',inUse:used.has(f.lineId)})),asks:readAsks(p.id).asks};};
 const write=p=>{fs.mkdirSync(dir,{recursive:true});const tmp=file(p.id)+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(p,null,1));fs.renameSync(tmp,file(p.id));};
 function begin(input,{create=false}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  if(!UUID.test(input.operationId||''))fail('Every write needs a fresh operationId (a UUID).');
  if(create)return null;
  if(!Number.isSafeInteger(input.expectedRevision)||!HASH.test(input.expectedHash||''))fail('A change needs the expectedRevision and expectedHash you read.');
  return load(input.id);
 }
 function check(before,input){const cur=withHash(before);if(cur.revision!==input.expectedRevision||cur.hash!==input.expectedHash)fail('This plan changed since you read it. Read it again; nothing was overwritten.',409);}
 function commit(before,next,input,what){
  const actor=actorNow();
  const out={...next,schema:SCHEMA,revision:before.revision+1,updatedAt:new Date().toISOString(),updatedBy:actor,operations:[{operationId:input.operationId,revision:before.revision+1,actor,what},...(before.operations||[])].slice(0,80)};
  write(out);return view(out);
 }
 const replay=(p,input)=>p.operations?.some(o=>o.operationId===input.operationId);

 /* ---------- material: Library transcript and photos ---------- */
 async function readMaterial(material,before){
  if(material===undefined)return {material:before.material,lines:before.lines,moments:before.moments||[],autoFlags:(before.flags||[]).filter(f=>f.by==='studio')};
  if(!material||typeof material!=='object')fail('Material is {transcripts, photos}.');
  if(!library?.snapshot)fail('Library is not connected, so the transcript and photos cannot be checked.',503);
  const transcripts=[],lines=[],photos=[],moments=[];
  for(const t of list(material.transcripts,'Transcripts',6)){
   if(!t||!UUID.test(t.sourceId||'')||!HASH.test(t.sourceHash||''))fail('A transcript names its Library sourceId and sourceHash.');
   let s;try{s=await library.snapshot(t.sourceId,{includeBody:true});}catch{fail('That transcript is not in Library.',404);}
   if(s.hash!==t.sourceHash)fail('The transcript changed since you read it. Read it again.',409);
   if(typeof s.text!=='string'||!s.text.trim())fail('That Library source has no readable text.',400);
   const read=deriveLines(t.sourceId,s.text,lines.length+1),whole=wholeness(s.text,read.lines,read.labels);
   // The whole transcript, never less: if any character would fall outside the lines, refuse instead of losing it.
   if(whole.missing)fail('Reading this transcript would leave out '+whole.missing+' characters (first at '+whole.firstMissing[0]+'). Nothing was saved.',422);
   lines.push(...read.lines);const ms=deriveMoments(t.sourceId,s.text,read.lines,moments.length+1);moments.push(...ms);
   transcripts.push({sourceId:t.sourceId,sourceHash:t.sourceHash,title:text(t.title,'Transcript title',300)||s.title||s.name||'',wholeness:whole,moments:ms.length,duration:ms.length?ms[ms.length-1].until:0});
  }
  const seen=new Set();
  for(const [i,p] of list(material.photos,'Photos',60).entries()){
   if(!p||!UUID.test(p.sourceId||''))fail('A photo names its Library sourceId.');
   if(seen.has(p.sourceId))continue;seen.add(p.sourceId);
   let s;try{s=await library.snapshot(p.sourceId);}catch{fail('That photo is not in Library.',404);}
   if(!IMAGE.test(s.path||s.rel_path||s.name||''))fail('That Library source is not a photo.',400);
   const old=before.material.photos.find(x=>x.sourceId===p.sourceId);
   photos.push({id:old?.id||'P'+(i+1),sourceId:p.sourceId,caption:text(p.caption,'Photo caption',200)});
  }
  // Keep photo ids unique even when the list was reordered.
  const used=new Set();for(const p of photos){if(used.has(p.id)){let n=photos.length;while(used.has('P'+n))n++;p.id='P'+n;}used.add(p.id);}
  if(lines.length>2000)fail('That transcript is too long for one plan; split it.',413);
  return {material:{transcripts,photos},lines,moments,autoFlags:detectFlags(lines,terms())};
 }

 /* ---------- stories and gaps (proposals) ---------- */
 function readStories(input,lines,photos,before){
  if(input===undefined)return before.stories;
  const raw=list(input,'Stories',3),lineIds=new Set(lines.map(l=>l.id)),photoIds=new Set(photos.map(p=>p.id)),ids=new Set();
  if(!raw.length)fail('Propose at least one story.');
  return raw.map((s,i)=>{
   if(!s||typeof s!=='object')fail('Each story is an object.');
   const id=typeof s.id==='string'&&/^S[0-9]{1,3}$/.test(s.id)?s.id:'S'+(i+1);if(ids.has(id))fail('Story ids are unique.');ids.add(id);
   const spine=list(s.spine,'A story\'s lines',24);if(!spine.length)fail('Each story is built on lines from the transcript (spine).');
   for(const l of spine)if(!lineIds.has(l))fail('Line '+l+' is not in the transcript.');
   const matches=list(s.matches,'Photo matches',60).map(m=>{if(!m||!photoIds.has(m.photoId))fail('A match names a photo in this plan.');if(!lineIds.has(m.lineId))fail('A match names a line in the transcript.');return {photoId:m.photoId,lineId:m.lineId,why:text(m.why,'Why this photo',300)};});
   const format=s.format===undefined||s.format===''?'':s.format;if(format&&!FORMAT_NAMES.includes(format))fail('A story suggests story, reel, post or carousel.');
   const old=before.stories.find(x=>x.id===id),origin=human()?'human':'machine';
   if(old?.origin==='human'&&!human())fail('Story '+id+' was written by Adrian; propose a new one instead.',403);
   const story={id,title:text(s.title,'Story title',160,{required:true}),dish:text(s.dish,'The dish',400,{required:true}),
    // The read-back: what the story claims, in plain words, so Adrian can say "that's not what I meant" before drafting.
    readback:text(s.readback,'The read-back (what this story claims)',600,{required:true}),why:text(s.why,'Why it is a story',800),reader:text(s.reader,'Who it could be for',200),format,spine:[...spine],matches,origin,by:actorNow(),meaning:null};
   // His answer to the read-back stays only while the claim and its lines are the ones he answered.
   if(old?.meaning&&old.readback===story.readback&&same(old.spine,story.spine))story.meaning=old.meaning;
   return story;
  });
 }
 function readGaps(input,stories,before){
  if(input===undefined)return before.gaps;
  const storyIds=new Set(stories.map(s=>s.id)),ids=new Set();
  return list(input,'Research gaps',12).map((g,i)=>{
   if(!g||typeof g!=='object')fail('Each gap is an object.');
   const id=typeof g.id==='string'&&/^G[0-9]{1,3}$/.test(g.id)?g.id:'G'+(i+1);if(ids.has(id))fail('Gap ids are unique.');ids.add(id);
   const status=g.status??'open';if(!GAP_STATUS.includes(status))fail('A gap is open, checking, answered or resting.');
   const sources=list(g.sources,'Sources',8).map(s=>{const url=text(s?.url,'Source link',600);if(url&&!/^https?:\/\//i.test(url))fail('A source link starts with http.');return {title:text(s?.title,'Source title',200),url};});
   return {id,question:text(g.question,'The question',400,{required:true}),why:text(g.why,'Why it matters',600),storyIds:list(g.storyIds,'Stories',3).filter(s=>storyIds.has(s)),status,finding:text(g.finding,'What was found',2000),sources,by:actorNow()};
  });
 }

 /* ---------- layouts ---------- */
 const lineOf=(p,id)=>p.lines.find(l=>l.id===id);
 // A line that fits a template: the whole line, or its opening up to the last pause that fits. Always an exact slice.
 function fitLine(line,max){
  if(line.text.length<=max)return line.text;
  const head=line.text.slice(0,max),cut=Math.max(head.lastIndexOf(', '),head.lastIndexOf('; '),head.lastIndexOf(' - '));
  if(cut>max*0.4)return head.slice(0,cut);
  return head.slice(0,head.lastIndexOf(' ')>0?head.lastIndexOf(' '):max);
 }
 function photoFor(p,story,lineId,i){
  const m=story.matches.find(x=>x.lineId===lineId);if(m)return m.photoId;
  const pool=story.matches.length?[...new Set(story.matches.map(x=>x.photoId))]:p.material.photos.map(x=>x.id);
  return pool.length?pool[i%pool.length]:null;
 }
 const captionOf=(p,id)=>p.material.photos.find(x=>x.id===id)?.caption||'';
 /** The one strong default for a story in a format, built from its spine and photo matches. */
 function defaultFrames(p,story,format){
  const lines=story.spine.map(id=>lineOf(p,id)).filter(Boolean);
  if(!lines.length)fail('That story has no lines to lay out.');
  const strongest=(max)=>[...lines].sort((a,b)=>Math.abs(a.text.length-max*0.55)-Math.abs(b.text.length-max*0.55))[0];
  const frameFor=(templateId,line,i,role,extra={})=>{const t=templateById(templateId),ph=photoFor(p,story,line.id,i);return {templateId,role,words:[{lineId:line.id,text:fitLine(line,t.maxChars)}],label:'',credit:line.speaker||'',photos:ph?[{photoId:ph,x:50,y:50}]:[],...extra};};
  if(format==='story')return lines.slice(0,6).map((l,i)=>frameFor('AR-S1',l,i,i?'inner':'cover',{label:i===0?captionOf(p,photoFor(p,story,l.id,i)).slice(0,60):''}));
  if(format==='post'){const l=strongest(180);return [frameFor('AR-P1',l,0,'cover',{label:captionOf(p,photoFor(p,story,l.id,0)).slice(0,60)})];}
  if(format==='reel'){
   const cover=strongest(90),frames=[frameFor('AR-R2',cover,0,'cover',{credit:'',label:p.title.slice(0,60)})];let total=0;
   for(const [i,l] of lines.entries()){const f=frameFor('AR-R1',l,i,'inner');f.seconds=secondsFor(f.words[0].text);if(total+f.seconds>FORMATS.reel.maxSeconds)break;total+=f.seconds;frames.push(f);}
   return frames;
  }
  // Carousel: the Teajia door uses the Teajia catalog it already has; every other door uses Field note.
  const use=lines.slice(0,20);
  if(use.length<2)use.push(use[0]);
  if(p.door==='teajia')return use.map((l,i)=>{const two=story.matches.filter(m=>m.lineId===l.id).length>1;const id=i===0?'H6':two?'N9':i%2?'H1':'F1';const f=frameFor(id,l,i,i===0?'cover':'inner');if(two)f.photos=story.matches.filter(m=>m.lineId===l.id).slice(0,2).map(m=>({photoId:m.photoId,x:50,y:50}));return f;});
  return use.map((l,i)=>frameFor('AR-P1',l,i,i===0?'cover':'inner',{label:captionOf(p,photoFor(p,story,l.id,i)).slice(0,60)}));
 }
 function readFrames(p,format,frames){
  const f=FORMATS[format],[min,max]=f.frames;
  if(!Array.isArray(frames)||frames.length<min||frames.length>max)fail('A '+f.label.toLowerCase()+' has '+(min===max?min:min+' to '+max)+' frames.');
  const photoIds=new Set(p.material.photos.map(x=>x.id));let seconds=0;
  const out=frames.map((fr,i)=>{
   if(!fr||typeof fr!=='object')fail('Each frame is an object.');
   const t=templateById(fr.templateId);if(!t)fail('Frame '+(i+1)+': there is no template '+fr.templateId+'.');
   if(!t.formats.includes(format))fail('Frame '+(i+1)+': '+t.name+' is made for '+t.formats.join(' or ')+', not a '+format+'.');
   const role=fr.role??(i===0?'cover':'inner');if(!ROLES.includes(role))fail('A frame is a cover, inner or close.');
   // His words, exactly: every piece of text on a frame is a slice of a transcript line.
   const words=list(fr.words,'Words on a frame',3).map(w=>{const line=lineOf(p,w?.lineId);if(!line)fail('Frame '+(i+1)+': words name a transcript line.');if(typeof w.text!=='string'||!w.text.trim())fail('Frame '+(i+1)+': words are not empty.');const exact=line.text.includes(w.text),fixed=!exact&&correctedText(line,p.flags||[],p.confirmations||{}).includes(w.text);if(!exact&&!fixed)fail('Frame '+(i+1)+': these words are not what was said in '+line.id+'. His words are kept exactly; quote them or leave them out.',403);return {lineId:line.id,text:w.text,...(fixed?{corrected:true}:{})};});
   const joined=words.map(w=>w.text).join('\n\n');if(joined.length>t.maxChars)fail('Frame '+(i+1)+': '+joined.length+' characters is more than '+t.name+' holds ('+t.maxChars+').');
   if(fr.text!==undefined&&fr.text!==joined)fail('Frame '+(i+1)+': a frame\'s text is its quoted words only.',403);
   const photos=list(fr.photos,'Photos on a frame',t.photos).map(ph=>{if(!photoIds.has(ph?.photoId))fail('Frame '+(i+1)+': that photo is not in this plan.');const n=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):50;return {photoId:ph.photoId,x:n(ph.x),y:n(ph.y)};});
   const out={templateId:t.id,role,words,label:text(fr.label,'A label',60),credit:text(fr.credit,'A credit',60),photos};
   if(format==='reel'&&t.id!=='AR-R2'){const s=fr.seconds===undefined?secondsFor(joined||' '):Number(fr.seconds);if(!Number.isFinite(s)||s<1||s>30)fail('Frame '+(i+1)+': a beat lasts 1 to 30 seconds.');out.seconds=Math.round(s*10)/10;seconds+=out.seconds;}
   return out;
  });
  if(format==='reel'&&seconds>f.maxSeconds)fail('This reel runs '+Math.round(seconds)+' seconds; a reel holds '+f.maxSeconds+'.');
  return out;
 }
 function readCaption(c){
  const t=text(c,'The caption',CAPTION.maxChars);
  if(hashtags(t)>CAPTION.maxHashtags)fail('Instagram takes at most '+CAPTION.maxHashtags+' hashtags in a caption.');
  return t;
 }
 const anyLineHas=(p,q)=>p.lines.some(l=>l.text.includes(q)||correctedText(l,p.flags||[],p.confirmations||{}).includes(q));
 /**
  * A drafted caption in parts, each labelled: his exact words (quote, linked to its line and moment), a suggested
  * wording of a line (shown beside the original), or the agent's own draft. Quoted words inside a draft must be his
  * exact words; reworded speech has to be declared as a suggested wording.
  */
 function readCaptionParts(p,c){
  const raw=typeof c==='string'?[{kind:'draft',text:c}]:c&&Array.isArray(c.parts)?c.parts:fail('A caption is text or {parts:[...]}.');
  if(raw.length>12)fail('A caption has up to 12 parts.');
  const parts=raw.map((part,i)=>{
   const kind=part?.kind;
   if(kind==='quote'){const line=lineOf(p,part.lineId);if(!line)fail('Caption part '+(i+1)+': a quote names its transcript line.');const t=text(part.text,'A quote',600,{required:true});if(!line.text.includes(t)&&!correctedText(line,p.flags||[],p.confirmations||{}).includes(t))fail('Caption part '+(i+1)+': a quote is his exact words. Reworded speech is a "suggested" part, shown beside the original.',403);return {kind,lineId:line.id,text:t};}
   if(kind==='suggested'){const line=lineOf(p,part.lineId);if(!line)fail('Caption part '+(i+1)+': a suggested wording names the line it rewords.');return {kind,lineId:line.id,text:text(part.text??part.wording,'The suggested wording',600,{required:true}),original:line.text};}
   if(kind==='draft'){const t=text(part.text,'Draft text',CAPTION.maxChars,{required:true});for(const q of quotedSegments(t))if(!anyLineHas(p,q))fail('Caption part '+(i+1)+': “'+q.slice(0,60)+'” is in quotation marks but is not what was said. Quote him exactly, or make it a "suggested" part.',403);return {kind,text:t};}
   fail('Caption part '+(i+1)+': a part is a quote, suggested or draft.');
  });
  const joined=parts.map(x=>x.text).join('\n\n');readCaption(joined);
  return {parts,text:joined,by:actorNow()};
 }

 /* ---------- commands ---------- */
 async function templates(){return {formats:FORMATS,caption:CAPTION,facts:FACTS,doors:DOORS,templates:catalog()};}
 async function plans({subject}={}){
  let names=[];try{names=fs.readdirSync(dir).filter(n=>/^[a-f0-9-]{36}\.json$/i.test(n));}catch{}
  const out=[];for(const n of names){try{const p=JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));if(p.schema!==SCHEMA)continue;if(subject&&p.subject!==subject)continue;
   out.push({id:p.id,subject:p.subject,title:p.title,door:p.door,revision:p.revision,updatedAt:p.updatedAt||null,stories:p.stories.length,chosen:p.chosen?.storyId||(p.chosen?.named?'named':null),layouts:Object.keys(p.layouts),ready:Object.keys(p.ready||{})});}catch{}}
  return {plans:out.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))};
 }
 async function read({id}){return view(load(id));}
 /** The files that get posted (frame PNGs, the reel's words) are held with the yes. */
 async function assertPostable({id},what){assertNotHeld(load(id),what);}
 /** Create a plan, or change its proposals: material, stories, gaps and what Adrian was heard to say in chat. */
 async function propose(input){
  requireWriteActor();
  const create=!input?.id;begin(input,{create});
  const key=create?'new:'+input.operationId:input.id;
  return serial(key,async()=>{
   const before=create?{...empty(),id:crypto.randomUUID()}:load(input.id);
   if(!create){if(replay(before,input))return view(before);check(before,input);}
   for(const k of ['chosen','ready','layouts','lines'])if(input[k]!==undefined)fail(k==='lines'?'Lines are read from the transcript itself; send material instead.':k==='layouts'?'Lay out a story with instagram.layout.':'"'+k+'" is set by Adrian in the app ('+(k==='chosen'?'instagram.choose':'instagram.ready')+').',403);
   const subject=input.subject===undefined?before.subject:text(input.subject,'Subject',160);if(!SUBJECT.test(subject))fail('The subject is a project id.');
   const door=input.door===undefined?before.door:input.door;if(door&&!DOORS.includes(door))fail('A door is teajia, art, mandala-codes or personal.');
   const {material,lines,moments,autoFlags}=await readMaterial(input.material,before);
   const stories=readStories(input.stories,lines,material.photos,before);
   // Lines or photos may have moved under existing stories: every reference must still hold.
   const lineIds=new Set(lines.map(l=>l.id)),photoIds=new Set(material.photos.map(p=>p.id));
   for(const s of stories)if(s.spine.some(l=>!lineIds.has(l))||s.matches.some(m=>!lineIds.has(m.lineId)||!photoIds.has(m.photoId)))fail('Story '+s.id+' points at lines or photos that are no longer in the material. Propose the stories again with it.',409);
   const gaps=readGaps(input.gaps,stories,before);
   // Words to confirm: the studio's own finds plus any an agent adds (always an exact slice of a line). Never applied.
   const lineById=new Map(lines.map(l=>[l.id,l]));
   const keptAgent=(input.flags===undefined?(before.flags||[]).filter(x=>x.by!=='studio'):list(input.flags,'Words to confirm',200).map(x=>{
    const line=lineById.get(x?.lineId);if(!line)fail('A word to confirm names its line.');const heard=text(x.heard,'The words heard',120,{required:true});
    const at=Number.isSafeInteger(x.start)?x.start:line.text.indexOf(heard);if(at<0||line.text.slice(at,at+heard.length)!==heard)fail('"'+heard.slice(0,40)+'" is not in '+line.id+' as heard.');
    const kind=x.kind||'other';if(!FLAG_KINDS.includes(kind))fail('A word to confirm is a tea-term, name, place, number, date or other.');
    return {id:'F-'+line.id+'-'+at,lineId:line.id,start:at,heard,kind,suggestion:text(x.suggestion,'A suggestion',200),why:text(x.why,'Why',300),by:actorNow()};})).filter(x=>lineById.get(x.lineId)?.text.slice(x.start,x.start+x.heard.length)===x.heard);
   const flagMap=new Map();for(const x of [...autoFlags,...keptAgent])if(!flagMap.has(x.id))flagMap.set(x.id,x);else if(x.by!=='studio')flagMap.set(x.id,{...flagMap.get(x.id),...x,kind:x.kind,suggestion:x.suggestion||flagMap.get(x.id).suggestion});
   const flags=[...flagMap.values()];
   const confirmations=Object.fromEntries(Object.entries(before.confirmations||{}).filter(([k])=>flagMap.has(k)));
   // The coverage map: an agent marks each moment it does not use as saved for later or skipped on purpose.
   const momentIds=new Set(moments.map(m=>m.id)),marks=Object.fromEntries(Object.entries(before.marks||{}).filter(([k])=>momentIds.has(k)));
   for(const m of list(input.coverage,'Coverage marks',500)){if(!momentIds.has(m?.momentId))fail('A coverage mark names a moment ('+(m?.momentId||'none')+' is not one).');const old=marks[m.momentId];
    if(old&&isHuman(old.by)&&!human())fail('Adrian marked '+m.momentId+' himself; an agent leaves it.',403);
    if(m.status===null){delete marks[m.momentId];continue;}if(!MARKS.includes(m.status))fail('A moment is saved (for later) or skipped (on purpose).');
    marks[m.momentId]={status:m.status,why:text(m.why,'Why',300,{required:m.status==='skipped'}),by:actorNow(),at:new Date().toISOString()};}
   let heard=before.heard;
   if(input.heard!==undefined){if(input.heard===null)heard=null;else{const h=input.heard;if(!h||!stories.some(s=>s.id===h.storyId))fail('"heard" names the story Adrian named in chat.');heard={storyId:h.storyId,quote:text(h.quote,'What he said',400,{required:true}),by:actorNow(),at:new Date().toISOString()};}}
   // A layout made from lines that changed is dropped, never silently kept pointing at other words.
   const layouts={};for(const [f,l] of Object.entries(before.layouts))if(l.frames.every(fr=>fr.words.every(w=>{const x=lines.find(y=>y.id===w.lineId);return x&&(x.text.includes(w.text)||w.corrected);}))&&stories.some(s=>s.id===l.storyId))layouts[f]=l;
   const ready={};for(const [f,r] of Object.entries(before.ready||{}))if(layouts[f]&&layoutHash(layouts[f])===r.layoutHash)ready[f]=r;
   if(Object.keys(ready).length!==Object.keys(before.ready||{}).length&&!human())fail('Adrian already said yes to a piece built on this material. Ask him before changing it.',409);
   const chosen=before.chosen&&(!before.chosen.storyId||stories.some(s=>s.id===before.chosen.storyId))?before.chosen:null;
   if(before.chosen&&!chosen&&!human())fail('Adrian chose story '+before.chosen.storyId+'; it cannot be removed by an agent.',403);
   return commit(before,{...before,subject,title:input.title===undefined?before.title:text(input.title,'Title',200),door,material,lines,moments,flags,confirmations,marks,meaningLog:before.meaningLog||[],stories,gaps,heard,chosen,layouts,ready},input,'propose');
  });
 }
 /** Lay out one story in one format: the server's default (frames omitted) or the caller's frames, checked. */
 async function layout(input){
  requireWriteActor();begin(input);
  return serial(input.id,async()=>{
   const before=load(input.id);if(replay(before,input))return view(before);check(before,input);
   const format=input.format;if(!FORMAT_NAMES.includes(format))fail('Choose story, reel, post or carousel.');
   const story=before.stories.find(s=>s.id===input.storyId);if(!story)fail('That story is not in this plan.');
   if(before.ready?.[format]&&!human())fail('Adrian said this '+format+' is ready. Ask him before changing it.',409);
   if(story.meaning?.verdict==='not-meant')fail('Adrian said this story is not what he meant: “'+story.meaning.words+'”. Propose it again from his words before laying it out.',409);
   const frames=readFrames(before,format,input.frames===undefined?defaultFrames(before,story,format):input.frames);
   const old=before.layouts[format],caption=input.caption===undefined?(old?.storyId===story.id?old.caption:{parts:[],text:'',by:''}):readCaptionParts(before,input.caption);
   const next={storyId:story.id,format,frames,caption,captionFinal:old?.storyId===story.id&&old.captionFinal?old.captionFinal:null,builtBy:actorNow(),at:new Date().toISOString()};
   next.hash=layoutHash(next);
   const ready={...(before.ready||{})};delete ready[format];
   return commit(before,{...before,layouts:{...before.layouts,[format]:next},ready},input,'layout '+format);
  });
 }
 /** Adrian picks a proposed story, or names his own dish in his own words, and may say who it is for. */
 async function choose(input){
  const decider=chatDecider(input,'Naming the dish');begin(input);
  return serial(input.id,async()=>{
   const before=load(input.id);if(replay(before,input))return view(before);check(before,input);
   const storyId=input.storyId??null;if(storyId!==null&&!before.stories.some(s=>s.id===storyId))fail('That story is not in this plan.');
   const named=text(input.named,'Your name for it',400),forWhom=text(input.forWhom,'Who it is for',200);
   if(!storyId&&!named.trim())fail('Pick a story or name your own.');
   return commit(before,{...before,chosen:{storyId,named,forWhom,...decider,at:new Date().toISOString()}},input,decider.carriedBy?'choose (said in chat)':'choose');
  });
 }
 /** Adrian confirms a word that was flagged: as heard, or corrected in his own words. The transcript never changes. */
 async function confirm(input){
  const decider=chatDecider(input,'Confirming what was said');begin(input);
  return serial(input.id,async()=>{
   const before=load(input.id);if(replay(before,input))return view(before);check(before,input);
   const flag=(before.flags||[]).find(x=>x.id===input.flagId);if(!flag)fail('That word is not on the list to confirm.');
   const verdict=input.verdict;if(!['as-heard','corrected'].includes(verdict))fail('Confirm it as heard, or correct it.');
   const correction=verdict==='corrected'?text(input.correction,'Your correction',200,{required:true}):'';
   // His correction is remembered by the shared word library, so every later recording and plan gets it right.
   if(verdict==='corrected'&&['tea-term','name','place'].includes(flag.kind)){
    try{await sharedWordLibrary({dataDir}).learn({heard:flag.heard,spelling:correction,category:flag.kind==='tea-term'?'tea-term':flag.kind==='place'?'place':'other',from:{story:before.title||'',sentence:lineOf(before,flag.lineId)?.text||''},operationId:input.operationId},currentActor());}
    catch{/* the confirmation itself must never fail because the library could not be written */}
   }
   return commit(before,{...before,confirmations:{...(before.confirmations||{}),[flag.id]:{verdict,correction,heard:flag.heard,...decider,at:new Date().toISOString()}}},input,'confirm '+flag.id+(decider.carriedBy?' (said in chat)':''));
  });
 }
 /** Adrian answers a story's read-back: that's it, or not what he meant, in his exact words. Kept in a log. */
 async function meaning(input){
  const decider=chatDecider(input,'Saying what you meant');begin(input);
  return serial(input.id,async()=>{
   const before=load(input.id);if(replay(before,input))return view(before);check(before,input);
   const i=before.stories.findIndex(x=>x.id===input.storyId);if(i<0)fail('That story is not in this plan.');
   const verdict=input.verdict;if(!['right','not-meant'].includes(verdict))fail('Say "right" or "not-meant".');
   const words=text(input.words,'What you meant',1200,{required:verdict==='not-meant'});
   const entry={storyId:before.stories[i].id,readback:before.stories[i].readback,verdict,words,...decider,at:new Date().toISOString()};
   const stories=before.stories.map((x,j)=>j===i?{...x,meaning:{verdict,words,by:entry.by,...(decider.carriedBy?{carriedBy:decider.carriedBy,said:decider.said}:{}),at:entry.at}}:x);
   return commit(before,{...before,stories,meaningLog:[...(before.meaningLog||[]),entry].slice(-200)},input,'meaning '+entry.storyId+(decider.carriedBy?' (said in chat)':''));
  });
 }
 /** His final yes for one format, with the caption as he wants it. Records the yes; posts nothing. */
 async function ready(input){
  const decider=chatDecider(input,'The final yes');begin(input);
  return serial(input.id,async()=>{
   const before=load(input.id);if(replay(before,input))return view(before);check(before,input);
   assertNotHeld(before,'Marking this ready to post',{requireLink:true});
   const format=input.format,l=before.layouts[format];if(!l)fail('Nothing is laid out as a '+format+' yet.');
   if(!before.chosen)fail('Pick or name the story first.');
   if(before.chosen.storyId&&before.chosen.storyId!==l.storyId)fail('This '+format+' was made for another story than the one you chose.',409);
   const unsure=openFlags(before,usedLines(before,format));
   if(unsure.length)fail(unsure.length+' word'+(unsure.length>1?'s':'')+' in this '+format+' still need your confirmation ('+unsure.slice(0,3).map(x=>'“'+x.heard+'”').join(', ')+'). Confirm them first; nothing is corrected without you.',409);
   const caption=input.caption===undefined?(l.captionFinal??l.caption.text):readCaption(input.caption);
   const layouts={...before.layouts,[format]:{...l,captionFinal:caption}};
   return commit(before,{...before,layouts,ready:{...(before.ready||{}),[format]:{layoutHash:l.hash,caption,...decider,at:new Date().toISOString(),posted:false}}},input,'ready '+format+(decider.carriedBy?' (said in chat)':''));
  });
 }
 /* ---------- one way from the VPS feeder to the Mac ---------- */
 const HANDOFF='ar-create.instagram-handoff.v1';
 /** The plan as the VPS feeder hands it on: the whole plan, and each Library file it names with its hash. */
 async function handoffBundle({id}){
  const p=load(id),sources=[];
  for(const t of p.material.transcripts)sources.push({sourceId:t.sourceId,hash:t.sourceHash,kind:'transcript'});
  for(const ph of p.material.photos){let s;try{s=await library.snapshot(ph.sourceId);}catch{fail('A photo of this plan is no longer in Library.',409);}
   let hash=s.hash;if(!HASH.test(hash||'')&&library.blob)hash=(await library.blob(ph.sourceId)).source.hash;if(!HASH.test(hash||''))fail('A photo of this plan has no hash yet.',409);sources.push({sourceId:ph.sourceId,hash,kind:'photo'});}
  return {schema:HANDOFF,plan:withHash(p),sources};
 }
 /**
  * On the Mac: take in a plan the VPS feeder handed on. `local(source)` gives this Library's copy of a file (by hash),
  * or null. Nothing is adopted unless every file is here byte for byte and every line is still an exact slice of its
  * transcript. Adrian's decisions in it keep their record (who decided, his words, who carried them). A plan already
  * here at this revision or later is left alone; one changed here since is never overwritten.
  */
 async function adopt(bundle,local){
  const held=why=>({state:'held',why,planId:bundle?.plan?.id||null,revision:bundle?.plan?.revision??null});
  if(bundle?.schema!==HANDOFF||bundle.plan?.schema!==SCHEMA||!UUID.test(bundle.plan.id||'')||!Number.isSafeInteger(bundle.plan.revision))return held('That is not an Instagram plan from the VPS.');
  const incoming=bundle.plan;
  const map=new Map();
  for(const src of Array.isArray(bundle.sources)?bundle.sources:[]){const mine=await local(src);if(!mine||mine.hash!==src.hash||!UUID.test(mine.id||''))return held('A file of the plan "'+(incoming.title||incoming.id)+'" is not on this Mac exactly as on the VPS.');map.set(src.sourceId,{id:mine.id,hash:mine.hash});}
  const named=[...incoming.material.transcripts.map(t=>t.sourceId),...incoming.material.photos.map(ph=>ph.sourceId)];
  if(named.some(x=>!map.has(x)))return held('The plan names a file the VPS did not hand on.');
  const remap=x=>map.get(x).id;
  const plan={...incoming,material:{transcripts:incoming.material.transcripts.map(t=>({...t,sourceId:remap(t.sourceId),sourceHash:map.get(t.sourceId).hash})),photos:incoming.material.photos.map(ph=>({...ph,sourceId:remap(ph.sourceId)}))},
   lines:incoming.lines.map(l=>({...l,sourceId:remap(l.sourceId)})),moments:(incoming.moments||[]).map(m=>({...m,sourceId:remap(m.sourceId)}))};
  delete plan.hash;
  // Every line must still be an exact slice of this Mac's copy of its transcript.
  for(const t of plan.material.transcripts){let s;try{s=await library.snapshot(t.sourceId,{includeBody:true});}catch{return held('The transcript did not reach this Library.');}
   if(s.hash!==t.sourceHash||plan.lines.some(l=>l.sourceId===t.sourceId&&s.text.slice(l.start,l.end)!==l.text))return held('The plan\'s lines do not match the transcript on this Mac.');}
  if(withHash(incoming).hash!==incoming.hash)return held('The plan was changed on the way.');
  return serial(plan.id,async()=>{
   let here=null;try{here=load(plan.id);}catch(error){if(error.status!==404)throw error;}
   if(here){
    if(here.revision>=plan.revision)return {state:'already-here',planId:plan.id,revision:here.revision};
    if((here.operations||[]).some(o=>o.revision>(here.adoptedRevision||0)))return held('"'+(here.title||here.id)+'" was changed on this Mac since it came from the VPS; the newer VPS version was not taken in.');
   }
   const at=new Date().toISOString();
   const out={...plan,adoptedRevision:plan.revision,adoptedAt:at,operations:[{operationId:crypto.randomUUID(),revision:plan.revision,actor:'import:vps-feeder',what:'taken in from the VPS'},...(plan.operations||[])].slice(0,80)};
   write(out);
   return {state:'adopted',planId:plan.id,revision:plan.revision};
  });
 }
 /* ---------- reading the made piece ---------- */
 function slides(p,format){
  const l=p.layouts[format];if(!l)fail('Nothing is laid out as a '+format+' yet.',404);
  let start=0;
  return l.frames.map((fr,i)=>{const ctx={index:i,total:l.frames.length,start};if(fr.seconds)start+=fr.seconds;
   return {templateId:fr.templateId,ctx,slide:{role:fr.role,text:fr.words.map(w=>w.text).join('\n\n'),label:fr.label,credit:fr.credit,photos:fr.photos.map(ph=>({src:'/api/sources/blob?id='+encodeURIComponent(p.material.photos.find(x=>x.id===ph.photoId)?.sourceId||''),x:ph.x,y:ph.y}))}};});
 }
 async function render({id,format,frame}){const p=load(id),s=slides(p,format),n=Number(frame??0);if(!Number.isInteger(n)||n<0||n>=s.length)fail('No such frame.',404);return frameDocument(format,renderFrame(s[n].templateId,s[n].slide,s[n].ctx),(p.title||'Instagram')+' · '+(n+1));}
 async function sheet({id,format}){const p=load(id);return sheetDocument(format,slides(p,format).map(s=>renderFrame(s.templateId,s.slide,s.ctx)),p.title||'Instagram piece');}
 /** The reel's on-screen words as subtitles (SRT), each one exactly as it was said. */
 async function captions({id}){
  const p=load(id),l=p.layouts.reel;if(!l)fail('Nothing is laid out as a reel yet.',404);
  let t=0,n=1;const out=[];for(const fr of l.frames){if(!fr.seconds)continue;out.push(n+++'\n'+srtTime(t)+' --> '+srtTime(t+fr.seconds)+'\n'+fr.words.map(w=>w.text).join(' ')+'\n');t+=fr.seconds;}
  return out.join('\n');
 }
 return {templates,plans,read,assertPostable,propose,layout,choose,confirm,meaning,ready,render,sheet,captions,handoffBundle,adopt,asksFile,readAsks,openFlags:p=>openFlags(p,usedLines(p)),defaultFrames:(p,storyId,format)=>defaultFrames(p,p.stories.find(s=>s.id===storyId),format)};
}

/* ---------- PNG export through the local headless Chrome the carousel export already uses ---------- */
// Playwright keeps its browsers in ~/Library/Caches on a Mac and ~/.cache on Linux (the VPS feeder), unless told otherwise.
export function playwrightRoots(env=process.env,home=os.homedir()){
 return [env.PLAYWRIGHT_BROWSERS_PATH,path.join(home,'Library/Caches/ms-playwright'),path.join(home,'.cache/ms-playwright')].filter(Boolean);
}
function chrome(){
 for(const root of playwrightRoots()){
  let dirs=[];try{dirs=fs.readdirSync(root).filter(d=>d.startsWith('chromium_headless_shell-')).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1]);}catch{}
  // Linux builds of the headless shell have shipped as chrome-linux/headless_shell and as chrome-headless-shell-linux64.
  for(const d of dirs)for(const [sub,name] of [['chrome-headless-shell-mac-arm64','chrome-headless-shell'],['chrome-headless-shell-mac-x64','chrome-headless-shell'],['chrome-headless-shell-linux64','chrome-headless-shell'],['chrome-linux','headless_shell']]){const bin=path.join(root,d,sub,name);if(fs.existsSync(bin))return bin;}
 }
 fail('PNG export is unavailable: no local headless Chrome was found. The frame still opens at full size.',503);
}
async function png(origin,{id,format,frame},studio){
 await studio.render({id,format,frame});
 const f=FORMATS[format],out=fs.mkdtempSync(path.join(os.tmpdir(),'ar-instagram-')),shot=path.join(out,'frame.png');
 try{
  const url=origin+PREFIX+'render?'+new URLSearchParams({id,format,frame:String(frame??0)});
  // Chrome refuses to start as root (the VPS feeder runs as root) unless its own sandbox is switched off.
  await promisify(execFile)(chrome(),[...(process.getuid?.()===0?['--no-sandbox']:[]),'--headless','--hide-scrollbars','--disable-gpu','--no-first-run','--force-device-scale-factor=1','--window-size='+f.width+','+f.height,'--virtual-time-budget=5000','--screenshot='+shot,url],{timeout:30000});
  return fs.readFileSync(shot);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
}

/**
 * Words still to confirm in what a piece uses go to Adrian's "Needs you" list as one Only-Adrian ask per new batch,
 * through the list's own route (needs-you.raise), with a link back to this plan. Agents never answer it.
 */
async function raiseNeeds(request,studio,plan){
 const open=studio.openFlags(plan),state=studio.readAsks(plan.id),fresh=open.filter(f=>!state.asked.includes(f.id));
 if(!fresh.length)return state.asks;
 const port=request.socket?.localPort,ctx=currentActor();if(!port||!ctx)return state.asks;
 const kinds=[...new Set(fresh.map(f=>({'tea-term':'tea terms',name:'names',place:'places',number:'numbers',date:'dates'})[f.kind]||'words'))].join(', ');
 const body={operationId:crypto.randomUUID(),band:'only-adrian',question:('Confirm '+fresh.length+' word'+(fresh.length>1?'s':'')+' heard in “'+(plan.title||'a voice note')+'” before they go on Instagram ('+kinds+'). Nothing is corrected without you.').slice(0,280),about:('Instagram · '+(plan.title||'voice note')).slice(0,120),link:{label:'Confirm the words',href:'/document-study/index.html?instagram='+plan.id}};
 const r=await fetch('http://127.0.0.1:'+port+'/api/needs-you/raise',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':ctx.actor,'X-AR-Client':ctx.client||'http'},body:JSON.stringify(body)});
 const v=await r.json().catch(()=>({}));
 const entry=r.ok?{askId:v.id||v.ask?.id||null,flags:fresh.map(f=>f.id),at:new Date().toISOString()}:{askId:null,flags:fresh.map(f=>f.id),at:new Date().toISOString(),error:v.error||('The Needs you list answered '+r.status)};
 const next={asked:r.ok?[...state.asked,...entry.flags]:state.asked,asks:[...state.asks,entry].slice(-50)};
 fs.writeFileSync(studio.asksFile(plan.id),JSON.stringify(next,null,1));
 return next.asks;
}
/**
 * On the VPS feeder: hand a plan on to the Mac through the memo it came from, on the phone site, with the pickup key.
 * The Mac takes it in at its next phone check. Nothing is posted anywhere else.
 */
export async function handOn(studio,input,{readKey=null,fetcher=globalThis.fetch,baseUrl=process.env.AR_PICKUP_BASE_URL||'https://mandalacodes.com'}={}){
 if(!input||!UUID.test(input.id||'')||!UUID.test(input.memoId||''))fail('Name the plan (id) and the memo it came from (memoId).');
 const bundle=await studio.handoffBundle({id:input.id});
 const {createKeyReader}=await import('./phone-pickup.mjs');
 const {key}=await (readKey||createKeyReader())();
 if(!key)fail('The pickup key is not set on this machine.',503);
 const body=JSON.stringify(bundle);
 const response=await fetcher(new URL(baseUrl).origin+'/api/oracle/pickup/memos/'+input.memoId+'/handoff',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(body))},body,redirect:'error',signal:AbortSignal.timeout(60_000)});
 const answer=await response.json().catch(()=>({}));
 if(!response.ok)fail('The phone site did not take the plan: '+(answer.error||'HTTP '+response.status)+'.',response.status===409?409:502);
 return {ok:true,planId:bundle.plan.id,revision:bundle.plan.revision,memoId:input.memoId,files:bundle.sources.length,handoff:answer.memo?.handoff||null};
}

const instances=new Map();
/** One registration line in the server hands requests here; returns false for any other path. */
export async function handleInstagram(request,response,{dataDir,library,consentDesk=null}){
 const url=new URL(request.url||'/','http://local.invalid');if(!url.pathname.startsWith(PREFIX))return false;
 let studio=instances.get(dataDir);if(!studio){studio=createInstagramStudio({dataDir,library,consentDesk});instances.set(dataDir,studio);}
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const send=(status,body)=>{response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(body));};
 const q=k=>url.searchParams.get(k)??undefined;
 try{
  const action=url.pathname.slice(PREFIX.length);
  const GET={templates:()=>studio.templates(),plans:()=>studio.plans({subject:q('subject')}),plan:()=>studio.read({id:q('id')})};
  const POST={plan:i=>studio.propose(i),layout:i=>studio.layout(i),choose:i=>studio.choose(i),confirm:i=>studio.confirm(i),meaning:i=>studio.meaning(i),ready:i=>studio.ready(i),handoff:i=>handOn(studio,i)};
  if(request.method==='GET'||request.method==='HEAD'){
   if(GET[action])return send(200,await GET[action]()),true;
   const args={id:q('id'),format:q('format'),frame:q('frame')===undefined?0:Number(q('frame'))};
   if(action==='render'||action==='sheet'){const html=await (action==='render'?studio.render(args):studio.sheet(args));response.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8',"Content-Security-Policy":"default-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'unsafe-inline'"});response.end(html);return true;}
   if(action==='captions'||action==='png')await studio.assertPostable({id:q('id')},action==='png'?'Saving this frame for posting':'Saving the on-screen words for posting');
   if(action==='captions'){const srt=await studio.captions(args);response.writeHead(200,{...headers,'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="reel-captions.srt"'});response.end(srt);return true;}
   if(action==='png'){const port=request.socket?.localPort;if(!port)fail('PNG export needs the running app.',503);const bytes=await png('http://127.0.0.1:'+port,args,studio);response.writeHead(200,{...headers,'Content-Type':'image/png','Content-Disposition':'inline; filename="'+args.format+'-'+(args.frame+1)+'.png"'});response.end(bytes);return true;}
   fail('Unknown Instagram action.',404);
  }
  if(request.method!=='POST')fail('Read with GET, change with POST.',405);
  if(!POST[action])fail('Unknown Instagram action.',404);
  if(request.headers.origin&&request.headers.origin!==new URL(request.url,'http://'+request.headers.host).origin)fail('Foreign-origin request refused.',403);
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  requireWriteActor();
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('That request is too large.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send JSON.');}
  const result=await POST[action](input);
  if((action==='plan'||action==='layout')&&!isHuman(actorNow()))result.asks=await raiseNeeds(request,studio,result).catch(()=>result.asks);
  send(200,result);
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The Instagram studio could not do that. Nothing was changed.',...(error.hold?{code:'consent-hold',hold:error.hold}:{})});}
 return true;
}
