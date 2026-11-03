// Simmer: the board where a subject's material sits before it is named. This service owns only the board's
// layout and the words written on it (groups, block order, notes, answers, the commit sentence). Photos stay in
// Library and are referenced by source id; his exact words are Library passages, checked against the source text;
// the sentence Adrian sends is saved by the existing concept owner (human direction), never here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {StateError} from '../store.mjs';
import {currentActor,isHuman,requireWriteActor} from './actor.mjs';

const SCHEMA='ar-create.simmer-board.v1',PREFIX='/api/simmer/',MAX_BODY=2*1024*1024,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/,ID=/^[A-Za-z0-9._:-]{1,160}$/;
export const KINDS=Object.freeze(['photo','passage','mine','note','concept','question','choice','feeling','guidance','check','consent','voice','thread']);
// Adrian's own words: only a human writes these kinds, and only a human sets these fields on any block.
const HUMAN_KINDS=new Set(['mine','note']),HUMAN_FIELDS=['answer','reading','people','pick','held'],SENTENCE=['about','really','dish','reader'];
const fail=(message,status=400)=>{throw new StateError(message,status);};
const str=(v,what,max=8000)=>{if(v===undefined)return undefined;if(typeof v!=='string'||v.length>max)fail(what+' must be text up to '+max+' characters.');return v;};
const num=(v,what)=>{if(v===undefined)return undefined;if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e6)fail(what+' must be a finite number.');return Math.round(v);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const empty=subject=>({schema:SCHEMA,subject,title:'',revision:0,groups:[],links:[],forming:{dishes:[],dish:null,sentence:{about:'',really:'',dish:'',reader:''},sentAt:null},operations:[]});
const content=board=>JSON.stringify({groups:board.groups,links:board.links,forming:board.forming,title:board.title});
const withHash=board=>({...board,hash:digest(content(board))});

function cleanBlock(b){
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Each block must be an object.');
 if(!ID.test(b.id||''))fail('Each block needs a stable id.');if(!KINDS.includes(b.kind))fail('Unknown block kind: '+b.kind+'.');
 if(!['human','machine'].includes(b.origin))fail('A block says whether a human or a machine made it.');
 const out={id:b.id,kind:b.kind,origin:b.origin,by:str(b.by,'Author',80)||'',text:str(b.text,'Block text')??'',wide:!!b.wide};
 for(const k of ['answer','reading','caption','people','term','termNative','status','pick','label'])if(b[k]!==undefined)out[k]=str(b[k],k,4000);
 if(b.held!==undefined)out.held=!!b.held;
 if(b.reader!==undefined)out.reader=!!b.reader;
 if(b.options!==undefined){if(!Array.isArray(b.options)||b.options.length>8)fail('Options are a short list.');out.options=b.options.map(o=>str(o,'Option',120));}
 if(b.source!==undefined){const s=b.source;if(!s||typeof s!=='object'||!UUID.test(s.sourceId||''))fail('A passage names its Library source.');out.source={sourceId:s.sourceId,sourceHash:s.sourceHash,quote:str(s.quote,'Quote',16384),start:s.start,title:str(s.title,'Source title',300)||'',speaker:str(s.speaker,'Speaker',120)||''};if(!HASH.test(s.sourceHash||'')||!Number.isSafeInteger(s.start)||s.start<0||!s.quote)fail('A passage needs its exact source hash, start and quote.');}
 if(b.photo!==undefined){if(!b.photo||!UUID.test(b.photo.sourceId||''))fail('A photo names its Library source.');out.photo={sourceId:b.photo.sourceId};}
 if(b.audio!==undefined){if(!b.audio||!UUID.test(b.audio.sourceId||''))fail('A voice moment names its Library recording.');out.audio={sourceId:b.audio.sourceId,startMs:num(b.audio.startMs,'Start')??0,endMs:num(b.audio.endMs,'End')??0};}
 if(b.kind==='passage'){if(!out.source)fail('His exact words come from a Library passage.');if(out.text!==out.source.quote)fail('A passage shows the exact quote, unchanged.',403);}
 return out;
}
function cleanBoard(input,subject){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Send the whole board.');
 const groups=input.groups;if(!Array.isArray(groups)||groups.length>60)fail('A board holds up to 60 groups.');
 const seen=new Set(),out={groups:[],links:[],forming:null,title:str(input.title,'Title',300)||''};
 for(const g of groups){
  if(!g||typeof g!=='object'||!ID.test(g.id||''))fail('Each group needs a stable id.');if(seen.has(g.id))fail('Group ids are unique.');seen.add(g.id);
  if(!Array.isArray(g.blocks)||g.blocks.length>200)fail('A group holds up to 200 blocks.');
  const blocks=g.blocks.map(cleanBlock);for(const b of blocks){if(seen.has(b.id))fail('Block ids are unique.');seen.add(b.id);}
  out.groups.push({id:g.id,title:str(g.title,'Group name',200)??'',sub:str(g.sub,'Group note',200)||'',x:num(g.x,'x')??0,y:num(g.y,'y')??0,w:num(g.w,'Width')??502,resting:!!g.resting,origin:g.origin==='machine'?'machine':'human',by:str(g.by,'Author',80)||'',blocks});
 }
 const links=input.links??[];if(!Array.isArray(links)||links.length>200)fail('Links are pairs of block ids.');
 for(const l of links){if(!Array.isArray(l)||l.length!==2||!l.every(id=>seen.has(id)))continue;out.links.push([l[0],l[1]]);}
 const f=input.forming||{},sentence=f.sentence||{};
 const dishes=f.dishes??[];if(!Array.isArray(dishes)||dishes.length>12)fail('Up to 12 possible dishes.');
 out.forming={dishes:dishes.map(d=>{if(!d||!ID.test(d.id||''))fail('Each dish needs an id.');return {id:d.id,title:str(d.title,'Dish',200)||'',why:str(d.why,'Why',600)||'',origin:d.origin==='machine'?'machine':'human',by:str(d.by,'Author',80)||''};}),dish:f.dish&&ID.test(f.dish)?f.dish:null,sentence:Object.fromEntries(SENTENCE.map(k=>[k,str(sentence[k],'Sentence',600)||''])),sentAt:typeof f.sentAt==='string'&&f.sentAt.length<40?f.sentAt:null};
 return out;
}
const blocksOf=board=>{const m=new Map();for(const g of board.groups)for(const b of g.blocks)m.set(b.id,b);return m;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Agents propose blocks, groups and dishes; they never write or change Adrian's words, choices or holds.
function guardAgent(before,next,actor){
 const refuse=what=>fail(what+' is Adrian\'s; '+actor+' may propose blocks and groups, never write his words.',403);
 const old=blocksOf(before),now=blocksOf(next);
 for(const [id,b] of now){const o=old.get(id);
  if(!o){if(b.origin!=='machine'||HUMAN_KINDS.has(b.kind))refuse('A note or his own words');if(HUMAN_FIELDS.some(k=>b[k]!==undefined&&b[k]!==''&&b[k]!==false))refuse('An answer, reading, pick or hold');continue;}
  if(o.origin==='human'){if(!same(o,b))refuse('A block he wrote');continue;}
  for(const k of [...HUMAN_FIELDS,'kind','origin'])if(!same(o[k],b[k]))refuse('The '+k+' on a block');
 }
 for(const [id,o] of old)if(!now.has(id)&&o.origin==='human')refuse('Removing a block he wrote');
 const og=new Map(before.groups.map(g=>[g.id,g]));for(const g of next.groups){const o=og.get(g.id);if(o&&o.origin==='human'&&o.title!==g.title)refuse('A group name he chose');if(!o&&g.origin!=='machine')refuse('A group he made');}
 if(!same(before.forming.sentence,next.forming.sentence))refuse('The sentence');if(before.forming.dish!==next.forming.dish)refuse('Naming the dish');if(before.forming.sentAt!==next.forming.sentAt)refuse('Sending to Direction');
 const od=new Map(before.forming.dishes.map(d=>[d.id,d]));for(const d of next.forming.dishes){const o=od.get(d.id);if(o?.origin==='human'&&!same(o,d))refuse('A dish he named');if(!o&&d.origin!=='machine')refuse('A dish he named');}
 for(const [id,o] of od)if(o.origin==='human'&&!next.forming.dishes.some(d=>d.id===id))refuse('A dish he named');
}
// His exact words stay exact: an existing passage never changes, and a new one must match the Library text now.
async function guardPassages(before,next,library){
 const old=blocksOf(before);
 for(const b of blocksOf(next).values()){if(b.kind!=='passage')continue;const o=old.get(b.id);
  if(o){if(o.kind!=='passage'||!same(o.source,b.source)||o.text!==b.text)fail('His exact words are protected. They can be quoted, never changed.',403);continue;}
  if(!library?.snapshot)fail('Library is not connected, so a new passage cannot be checked against its source.',503);
  let s;try{s=await library.snapshot(b.source.sourceId,{includeBody:true});}catch{fail('That Library source is unavailable.',404);}
  if(s.hash!==b.source.sourceHash||typeof s.text!=='string'||s.text.slice(b.source.start,b.source.start+b.source.quote.length)!==b.source.quote)fail('The source changed or the quote does not match it. Search again before adding.',409);
 }
}

export function createSimmerBoards({dataDir,library}={}){
 if(!dataDir)throw Error('Simmer needs the data folder.');
 const dir=path.join(dataDir,'simmer-boards'),queues=new Map();
 const file=subject=>path.join(dir,digest(subject).slice(0,40)+'.json');
 const serial=(subject,fn)=>{const run=(queues.get(subject)||Promise.resolve()).then(fn,fn);queues.set(subject,run.catch(()=>{}));return run;};
 const load=subject=>{try{const value=JSON.parse(fs.readFileSync(file(subject),'utf8'));if(value.schema!==SCHEMA||value.subject!==subject)fail('This board file is not readable.',409);return value;}catch(error){if(error.code==='ENOENT')return empty(subject);throw error;}};
 const view=board=>{const {operations,...rest}=withHash(board);return rest;};
 function subjectOf(v){if(typeof v!=='string'||!ID.test(v))fail('Name the subject by its project id.');return v;}
 async function read({subject}){subject=subjectOf(subject);return view(load(subject));}
 async function save(input){
  if(!input||typeof input!=='object')fail('Send a board save.');const subject=subjectOf(input.subject);
  if(!UUID.test(input.operationId||'')||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!HASH.test(input.expectedHash||''))fail('A save needs operationId, expectedRevision and expectedHash.');
  return serial(subject,async()=>{
   const before=load(subject),current=withHash(before);
   if(before.operations?.some(o=>o.operationId===input.operationId))return view(before);
   if(current.revision!==input.expectedRevision||current.hash!==input.expectedHash)fail('This board changed since you opened it. Reload it; nothing was overwritten.',409);
   const next=cleanBoard(input.board,subject),actor=currentActor()?.actor||'';
   if(!isHuman(actor))guardAgent(before,next,actor||'an unattributed caller');
   await guardPassages(before,next,library);
   const board={schema:SCHEMA,subject,title:next.title||before.title,revision:before.revision+1,groups:next.groups,links:next.links,forming:next.forming,updatedAt:new Date().toISOString(),updatedBy:actor,operations:[{operationId:input.operationId,revision:before.revision+1,actor},...(before.operations||[])].slice(0,50)};
   fs.mkdirSync(dir,{recursive:true});const tmp=file(subject)+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(board,null,1));fs.renameSync(tmp,file(subject));
   return view(board);
  });
 }
 return {read,save};
}

const instances=new Map();
/** One registration line in the server hands requests here; returns false for any other path. */
export async function handleSimmer(request,response,{dataDir,library}){
 const url=new URL(request.url||'/','http://local.invalid');if(!url.pathname.startsWith(PREFIX))return false;
 let boards=instances.get(dataDir);if(!boards){boards=createSimmerBoards({dataDir,library});instances.set(dataDir,boards);}
 const send=(status,body)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 try{
  if(url.pathname!==PREFIX+'board')fail('Unknown Simmer action.',404);
  if(request.method==='GET')return send(200,await boards.read({subject:url.searchParams.get('subject')})),true;
  if(request.method!=='POST')fail('Read with GET, save with POST.',405);
  requireWriteActor();
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('This board is too large to save.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the board as JSON.');}
  send(200,await boards.save(input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The board could not be saved. Nothing was changed.'});}
 return true;
}
