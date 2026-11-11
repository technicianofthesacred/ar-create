// Research topics and groups: a thin layer of records over the research the app already keeps. A topic is, wherever it
// can be, an inquiry (a Library Collection with its own learning record, runtime/services/inquiry-interface-routes.mjs):
// its name, its sources and the subjects it is used in (accepted Project associations) stay with Library. What Library
// does not hold lives here, one small record per topic under data/research-topics/topics/: where it came from (a
// conversation, a fact check, things he saved, his note, or started by him), its state, its group, pointers to the
// research answers and findings that belong to it, the one line he takes from it, and the waiting things he left for
// later. A group (data/research-topics/groups/) is a set of topics with a shared list of Library sources, ticked for
// asking, a folder path and plain settings. Pointers, never copies: nothing here holds a finding's or a source's words.
//
// Nothing is migrated. A topic with no record of its own is read on the fly from what is there (an inquiry, a subject's
// own research, a Library topic tag on things he saved) and a record is written only when something about it changes.
// Assistants file and propose; keeping a proposal, letting a topic go, taking that back and his own line are his alone.
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,readJson,regular} from './files.mjs';
import {currentActor,isHuman} from './actor.mjs';
import {folderName,stableJson} from './library-folders.mjs';

const TOPIC='ar-create.research-topic.v1',GROUP='ar-create.research-group.v1',LIST='ar-create.research-topics.v1',VIEW='ar-create.research-topic-view.v1',GROUP_VIEW='ar-create.research-group-view.v1',GROUPS='ar-create.research-groups.v1',ASK='ar-create.research-ask.v1';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/,SUBJECT=/^[A-Za-z0-9._:-]{1,160}$/,PLAIN_FILE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const ORIGINS=Object.freeze({conversation:'From a conversation','fact-check':'From a fact check',saved:'From things you saved',note:'From your note',started:'You started it',subject:'From the research for',library:'From your Library'});
const REF_KINDS=Object.freeze(['source','recording','note','consent-claim','library-topic']);
// What an assistant must point at for each kind of origin: the conversation (a recording or source), the fact check (a
// claim on a consent desk), the things he saved (a Library topic or source), the note (a Library source).
const ASSISTANT_REFS=Object.freeze({conversation:['source','recording'],'fact-check':['consent-claim'],saved:['library-topic','source'],note:['note','source']});
const MAX_SCAN_SOURCES=1000,MAX_SCAN_BYTES=40*1024*1024,QUOTE=140;
const STATES=Object.freeze(['new','ready','quiet']);
const STATE_SAY=Object.freeze({ready:'Has something to say',quiet:'Gone quiet'});
const KEEP_OPS=50,WEEK=7*24*3600*1000,MAX_SOURCES=1000,MAX_POINTERS=200,MAX_LEFT=100,MAX_NAME=200,MAX_NOTE=280,MAX_TAKE=400,MAX_FOLDER=8;
const fail=(message,status=400)=>{throw new StateError(message,status);};
const actorNow=()=>currentActor()?.actor||'unknown(in-process)';
const clientNow=()=>currentActor()?.client||null;
const humanNow=()=>{const ctx=currentActor();return !ctx||isHuman(ctx.actor);};
const object=(input,what='The request')=>{if(!input||typeof input!=='object'||Array.isArray(input))fail(what+' must be a JSON object.');return input;};
const only=(input,allowed)=>{const extra=Object.keys(input).filter(k=>!allowed.includes(k));if(extra.length)fail('Unsupported field '+extra[0]+'. Use only '+allowed.join(', ')+'.');};
const words=(value,what,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value.replace(/\n/g,'')))fail(what+' is plain text of up to '+max+' characters.');return value.trim();};
const line=(value,what,max)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail(what+' is one plain line of up to '+max+' characters.');return value.trim();};
const uuidList=(value,what,max=MAX_SOURCES)=>{if(!Array.isArray(value)||value.length>max||value.some(v=>!UUID.test(v||''))||new Set(value).size!==value.length)fail(what+' is a list of up to '+max+' distinct Library source ids.');return [...value];};
const subjectId=value=>{if(typeof value!=='string'||!SUBJECT.test(value)||value==='.'||value==='..')fail('Name the subject by its project id (parentStudyId).');return value;};
const slug=text=>String(text).toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'topic';
const fingerprint=input=>digest(stableJson(input));
const sorted=list=>[...list].sort();

/** A topic's id says where it lives: a Collection's UUID, p-... (an assistant's proposal or his own new topic),
    subject.<parentStudyId> (a subject's own research), saved.<tag> (things he saved under one Library topic). */
export function topicKind(id){
 if(typeof id!=='string'||id.length>200)fail('Name the topic by its id.');
 if(UUID.test(id))return 'inquiry';
 if(/^p-[a-z0-9-]{4,80}$/.test(id))return 'proposal';
 if(id.startsWith('subject.')&&SUBJECT.test(id.slice(8)))return 'subject';
 if(/^saved\.[a-z0-9-]{1,60}$/.test(id))return 'saved';
 fail('That is not a topic id.',404);
}
function cleanOrigin(value){
 object(value,'origin');only(value,['kind','label','ref']);
 if(!Object.hasOwn(ORIGINS,value.kind)||value.kind==='subject'||value.kind==='library')fail('origin.kind is one of conversation, fact-check, saved, note or started.');
 const label=value.label===undefined?'':line(value.label,'origin.label',160);
 let ref=null;
 if(value.ref!==undefined&&value.ref!==null){
  object(value.ref,'origin.ref');only(value.ref,['kind','id','at','parentStudyId']);
  if(!REF_KINDS.includes(value.ref.kind))fail('origin.ref.kind is one of '+REF_KINDS.join(', ')+'.');
  ref={kind:value.ref.kind,id:line(value.ref.id,'origin.ref.id',200),...(value.ref.at!==undefined?{at:line(value.ref.at,'origin.ref.at',40)}:{}),...(value.ref.parentStudyId!==undefined?{parentStudyId:subjectId(value.ref.parentStudyId)}:{})};
  if(ref.kind==='consent-claim'&&!ref.parentStudyId)fail('A fact check is named by its subject (origin.ref.parentStudyId) and its claim id.');
  if(!ref.id)fail('origin.ref names the record it came from by its id.');
 }
 return {kind:value.kind,label,ref};
}
function cleanFolder(value){if(!Array.isArray(value)||value.length>MAX_FOLDER)fail('A folder is a list of up to '+MAX_FOLDER+' plain names, for example ["Research","Mandala"].');return value.map(folderName);}
function cleanFindings(value){
 if(!Array.isArray(value)||value.length>MAX_POINTERS)fail('findings is a list of up to '+MAX_POINTERS+' {parentStudyId, pointId}.');
 return value.map(v=>{object(v,'Each finding');only(v,['parentStudyId','pointId']);return {parentStudyId:subjectId(v.parentStudyId),pointId:line(v.pointId,'pointId',200)};});
}
const SETTINGS=Object.freeze({opensTopics:['propose','off']});
function cleanSettings(value,before={}){
 object(value,'settings');only(value,Object.keys(SETTINGS));
 const out={...before};for(const [k,allowed] of Object.entries(SETTINGS))if(Object.hasOwn(value,k)){if(!allowed.includes(value[k]))fail('settings.'+k+' is one of '+allowed.join(', ')+'.');out[k]=value[k];}
 return out;
}

const topicContent=t=>({kind:t.kind,collectionId:t.collectionId,subject:t.subject,tag:t.tag,name:t.name,origin:t.origin,status:t.status,state:t.state,note:t.note,groupId:t.groupId,suggestedGroupId:t.suggestedGroupId,subjects:t.subjects,sourceIds:t.sourceIds,answers:t.answers,findings:t.findings,take:t.take,left:t.left});
const groupContent=g=>({name:g.name,folder:g.folder,sources:g.sources,unticked:g.unticked,settings:g.settings});
const topicHash=t=>digest(stableJson(topicContent(t)));
const groupHash=g=>digest(stableJson(groupContent(g)));

/**
 * owners: the existing services this layer reads and asks, all optional so a home without one still answers:
 *  catalog() -> {revision, indexHash, collections:[{id,name,sourceIds,added_at,added_by}]}   (inquiries.catalog)
 *  inquiry(collectionId) -> {collection, record:{body,revision,hash,metadataHash,updatedAt}, sources:[{id,title,missing}]}
 *  saveCollection({id?, name, sourceIds, expectedRevision}) -> {collection}                     (inquiries.create / update)
 *  associations() -> [{id, collectionId, parentStudyId, status}]                                 (Library project associations)
 *  link({collectionId, parentStudyId, accept}) -> {status}                                       (inquiries.association.*)
 *  relationships(collectionId) -> [{sourceId, relationshipType, status, quote?}]                 (sources that support or challenge it)
 *  subjects() -> [{parentStudyId, title, bindingId}]
 *  subjectResearch({parentStudyId, bindingId}) -> {answers:[{id,question,status,keptAt,createdAt}], findings:[{id,title,supported,uncertain,spoken:[{quote,speaker,location}]}], sourceIds:[]}
 *  sources(ids) -> [{id,title,kind,missing}]
 *  libraryTopics() -> [{sourceId, topics:[...]}]                                                 (his own Library topics)
 *  search({query, limit}) -> {results:[{sourceId,title?,quote,context,start}]}                   (the literal Library search)
 *  atlas({query}) -> {items, available}                                                          (the local Atlas search)
 */
export function createResearchTopics({dataDir,owners={}}={}){
 if(!dataDir)throw Error('Research topics need the data folder.');
 const topicsDir=()=>ensurePrivateDirectory(dataDir,path.join('research-topics','topics'));
 const groupsDir=()=>ensurePrivateDirectory(dataDir,path.join('research-topics','groups'));
 const fileName=id=>(PLAIN_FILE.test(id)&&!/[A-Z]/.test(id)&&!id.endsWith('.tmp')?id:'_'+digest(id).slice(0,40))+'.json';
 let queue=Promise.resolve();
 const serial=fn=>{const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;};
 const ask=async(name,...args)=>{const fn=owners[name];if(typeof fn!=='function')return null;return fn(...args);};
 // A read from another owner that is refused or unavailable (a missing record, a subject with no research) shows nothing
 // rather than failing the whole page; a fault in the code still surfaces.
 const quietly=async(name,fallback,...args)=>{try{return (await ask(name,...args))??fallback;}catch(error){if(Number.isInteger(error?.status))return fallback;throw error;}};

 /* ---------- stored records ---------- */
 function readRecord(dir,id,schema){
  const file=path.join(dir,fileName(id));if(!fs.existsSync(file))return null;
  regular(file);const value=readJson(file,null);
  if(!value||value.schema!==schema||value.id!==id||!Number.isSafeInteger(value.revision)||value.revision<1||!Array.isArray(value.operations))fail('This research record is not readable; its bytes were kept.',409);
  return value;
 }
 function allRecords(dir,schema){
  const out=[],unreadable=[];
  for(const name of fs.readdirSync(dir).sort()){
   if(!name.endsWith('.json'))continue;
   try{const value=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));regular(path.join(dir,name));if(value?.schema!==schema||fileName(value.id||'')!==name)throw Error('wrong');out.push(value);}catch{unreadable.push(name);}
  }
  return {records:out,unreadable};
 }
 const loadTopic=id=>readRecord(topicsDir(),id,TOPIC);
 const loadGroup=id=>readRecord(groupsDir(),id,GROUP);
 function commit(dir,before,next,input,what,{schema}){
  const revision=(before?.revision||0)+1,at=new Date().toISOString(),actor=actorNow();
  const op={operationId:input.operationId,revision,actor,client:clientNow(),at,what,fingerprint:fingerprint(input),...(next.__undo?{undo:next.__undo}:{})};
  const {__undo,...clean}=next;
  const record={...clean,schema,revision,createdAt:before?.createdAt||at,createdBy:before?.createdBy||actor,updatedAt:at,updatedBy:actor,operations:[op,...(before?.operations||[])].slice(0,KEEP_OPS)};
  atomicWrite(path.join(dir,fileName(record.id)),JSON.stringify(record,null,1)+'\n');
  return record;
 }
 function replayed(record,input){
  const prior=record?.operations.find(op=>op.operationId===input.operationId);if(!prior)return false;
  if(prior.fingerprint!==fingerprint(input))fail('This operationId already belongs to a different change. Use a fresh one.',409);
  return true;
 }
 function expect(current,input,what){
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)fail('A change needs the expectedRevision you read (0 for one that is not saved yet).');
  if(input.expectedHash!==undefined&&!HASH.test(input.expectedHash||''))fail('expectedHash is the hash you read.');
  const revision=current?.revision||0;
  if(revision!==input.expectedRevision)fail('This '+what+' changed since you read it. Read it again; nothing was overwritten.',409);
  if(revision>0&&input.expectedHash===undefined)fail('A change to a saved '+what+' needs the expectedHash you read.');
  if(revision!==input.expectedRevision||(revision>0&&input.expectedHash!==(what==='group'?groupHash(current):topicHash(current))))fail('This '+what+' changed since you read it. Read it again; nothing was overwritten.',409);
 }
 function begin(input,fields){object(input);only(input,fields);if(!UUID.test(input.operationId||''))fail('Every change needs a fresh operationId (a UUID).');}

 /* ---------- what is there already ---------- */
 let associationCache=null;const researchSeen=new Map();let scanning=null;
 const breathe=()=>new Promise(r=>setImmediate(r));
 /** Which subjects have research of their own (kept answers or saved findings), for the list. It is learned in the
     background, one subject at a time with a pause between, kept until the change stream says research changed (or ten
     minutes pass), and never holds the list: the list waits a moment at most and shows what is known. Reading a topic or
     a subject always asks afresh. */
 function learnResearch(subjects){
  if(scanning)return scanning;
  scanning=(async()=>{for(const s of subjects){const seen=researchSeen.get(s.parentStudyId);if(seen&&Date.now()-seen.at<600000)continue;
   let value=false,result=null;try{result=await quietly('subjectResearch',null,s);value=!!(result&&(result.answers?.length||result.findings?.length));}catch{}
   researchSeen.set(s.parentStudyId,{at:Date.now(),value,result});await breathe();}})().finally(()=>{scanning=null;});
  return scanning;
 }
 async function knownResearch(subjects,waitMs=300,all=subjects){
  if(typeof owners.subjectResearch!=='function'||!subjects.length)return new Set();
  const run=learnResearch(all);await Promise.race([run,new Promise(r=>setTimeout(r,waitMs).unref?.())]);
  return new Set(subjects.filter(s=>researchSeen.get(s.parentStudyId)?.value).map(s=>s.parentStudyId));
 }
 const forgetResearch=()=>researchSeen.clear();
 async function world(){
  const catalog=await quietly('catalog',{revision:0,collections:[]});
  // Library keeps its associations in the same index as its collections, so an unchanged index hash means unchanged associations.
  if(!catalog.indexHash||associationCache?.hash!==catalog.indexHash)associationCache={hash:catalog.indexHash||null,value:await quietly('associations',[],catalog.indexHash||null)};
  const associations=associationCache.value;
  const [subjects,sidecars,groups]=[await quietly('subjects',[]),allRecords(topicsDir(),TOPIC),allRecords(groupsDir(),GROUP)];
  const subjectsById=new Map(subjects.map(s=>[s.parentStudyId,s]));
  const byCollection=new Map(),stored=new Map();
  for(const t of sidecars.records){stored.set(t.id,t);if(t.collectionId)byCollection.set(t.collectionId,t);}
  return {catalog,collections:new Map((catalog.collections||[]).map(c=>[c.id,c])),associations,subjects,subjectsById,stored,byCollection,groups:groups.records,unreadable:[...sidecars.unreadable,...groups.unreadable]};
 }
 const usesOf=(w,collectionId)=>w.associations.filter(a=>a.collectionId===collectionId&&a.status!=='detached');
 /** A topic as it is now: its own record if saved, else made on the fly from what is there. */
 function virtualInquiry(w,collection){
  const uses=usesOf(w,collection.id).filter(a=>a.status==='accepted'),first=uses[0]?w.subjectsById.get(uses[0].parentStudyId):null;
  const origin=first?{kind:'subject',label:first.title||uses[0].parentStudyId,ref:{kind:'subject',id:uses[0].parentStudyId}}:{kind:collection.added_by==='chat'?'conversation':'library',label:'',ref:null};
  return {schema:TOPIC,id:collection.id,kind:'inquiry',collectionId:collection.id,subject:null,tag:null,name:null,origin:{...origin,at:collection.added_at||null},status:'kept',state:'new',note:'',groupId:null,suggestedGroupId:null,subjects:[],sourceIds:[],answers:[],findings:[],take:null,left:[],revision:0,operations:[],createdAt:collection.added_at||null,createdBy:null};
 }
 function virtualSubject(w,parentStudyId){
  const s=w.subjectsById.get(parentStudyId);
  return {schema:TOPIC,id:'subject.'+parentStudyId,kind:'subject',collectionId:null,subject:parentStudyId,tag:null,name:(s?.title||parentStudyId)+': research',origin:{kind:'subject',label:s?.title||parentStudyId,ref:{kind:'subject',id:parentStudyId},at:null},status:'kept',state:'new',note:'',groupId:null,suggestedGroupId:null,subjects:[parentStudyId],sourceIds:[],answers:[],findings:[],take:null,left:[],revision:0,operations:[],createdAt:null,createdBy:null};
 }
 function virtualSaved(tag,sourceIds,at){
  return {schema:TOPIC,id:'saved.'+slug(tag),kind:'saved',collectionId:null,subject:null,tag,name:tag,origin:{kind:'saved',label:sourceIds.length+' things you saved',ref:{kind:'library-topic',id:tag},at},status:'proposed',state:'new',note:'',groupId:null,suggestedGroupId:null,subjects:[],sourceIds,answers:[],findings:[],take:null,left:[],revision:0,operations:[],createdAt:at,createdBy:'import:library-topics',proposedBy:'import:library-topics'};
 }
 /** Things he saved under one Library topic (two or more of them) that no topic covers yet. */
 async function savedSuggestions(w){
  const rows=await quietly('libraryTopics',[]),byTag=new Map();
  for(const row of rows)for(const tag of row.topics||[]){const k=slug(tag);if(!byTag.has(k))byTag.set(k,{tag,ids:[]});byTag.get(k).ids.push(row.sourceId);}
  const names=new Set([...w.collections.values()].map(c=>slug(c.name)));for(const t of w.stored.values())if(t.name)names.add(slug(t.name));
  const out=[];const now=new Date().toISOString();
  for(const [k,{tag,ids}] of byTag){if(ids.length<2||names.has(k)||w.stored.has('saved.'+k))continue;out.push(virtualSaved(tag,sorted(ids),now));}
  return out;
 }
 async function resolve(w,id){
  const kind=topicKind(id),saved=w.stored.get(id);
  if(saved)return saved;
  if(kind==='inquiry'){const sidecar=w.byCollection.get(id);if(sidecar)return sidecar;const c=w.collections.get(id);if(!c)fail('There is no topic '+id+'.',404);return virtualInquiry(w,c);}
  if(kind==='subject'){const sid=id.slice(8);if(!w.subjectsById.has(sid))fail('There is no subject '+sid+'.',404);return virtualSubject(w,sid);}
  if(kind==='saved'){const found=(await savedSuggestions(w)).find(t=>t.id===id);if(!found)fail('Nothing you saved is filed under that topic now.',404);return found;}
  fail('There is no topic '+id+'.',404);
 }
 const nameOf=(w,t)=>t.collectionId?w.collections.get(t.collectionId)?.name||t.name||'Topic':t.name||'Topic';
 const sourceIdsOf=(w,t)=>t.collectionId?[...(w.collections.get(t.collectionId)?.sourceIds||[])]:[...t.sourceIds];
 function usedIn(w,t){
  const out=new Map();
  if(t.collectionId)for(const a of usesOf(w,t.collectionId))out.set(a.parentStudyId,{parentStudyId:a.parentStudyId,title:w.subjectsById.get(a.parentStudyId)?.title||a.parentStudyId,status:a.status==='accepted'?'used':'proposed',associationId:a.id});
  for(const sid of [...(t.subject?[t.subject]:[]),...t.subjects])if(!out.has(sid))out.set(sid,{parentStudyId:sid,title:w.subjectsById.get(sid)?.title||sid,status:'used'});
  return [...out.values()];
 }
 /** The things waiting for him on this topic, one at a time. Each can be left for later. */
 function waiting(w,t){
  const out=[];
  if(t.status==='proposed')out.push({key:'keep',kind:'keep',title:'Keep this topic?',detail:t.note||originSay(w,t),choices:['keep','let-go','not-now']});
  const g=t.suggestedGroupId&&t.suggestedGroupId!==t.groupId?w.groups.find(x=>x.id===t.suggestedGroupId):null;
  if(g&&t.status!=='let-go')out.push({key:'group:'+g.id,kind:'group',groupId:g.id,title:'Put it in '+g.name+'?',detail:'Suggested so it sits with the topics it belongs with.',choices:['yes','not-now']});
  for(const u of usedIn(w,t))if(u.status==='proposed')out.push({key:'use:'+u.parentStudyId,kind:'use',parentStudyId:u.parentStudyId,title:'Use this for '+u.title+'?',detail:'An assistant linked this topic to the subject. It is used there once you say yes.',choices:['yes','not-now']});
  const left=new Set(t.left);
  return {now:out.filter(x=>!left.has(x.key)),left:out.filter(x=>left.has(x.key))};
 }
 function originSay(w,t){const o=t.origin||{};const base=ORIGINS[o.kind]||'';return o.label?base+(o.kind==='subject'?' ':' · ')+o.label:base;}
 function summary(w,t){
  const wait=waiting(w,t),uses=usedIn(w,t),madeAt=t.origin?.at||t.createdAt||null;
  const ready=t.state==='ready'||wait.now.length>0;
  return {id:t.id,kind:t.kind,name:nameOf(w,t),saved:t.revision>0,revision:t.revision,origin:{kind:t.origin?.kind||null,label:t.origin?.label||'',say:originSay(w,t),ref:t.origin?.ref||null,at:madeAt},
   status:t.status,state:t.state,stateSay:wait.now.length&&t.state!=='ready'?(wait.now[0].kind==='keep'?'Waiting for you':'Something to decide'):STATE_SAY[t.state]||'',note:t.note,
   groupId:t.groupId,suggestedGroupId:t.suggestedGroupId&&t.suggestedGroupId!==t.groupId?t.suggestedGroupId:null,sourceCount:sourceIdsOf(w,t).length,usedIn:uses.filter(u=>u.status==='used').map(u=>({parentStudyId:u.parentStudyId,title:u.title})),
   hasSomethingToSay:t.status!=='let-go'&&ready,waiting:wait.now.length,madeThisWeek:!!madeAt&&Date.now()-Date.parse(madeAt)<WEEK,madeForYou:t.status!=='let-go'&&(t.status==='proposed'||!!t.proposedBy)&&!!madeAt&&Date.now()-Date.parse(madeAt)<WEEK,proposedBy:t.proposedBy||null};
 }
 async function allTopics(w){
  const out=[];const seen=new Set();
  for(const t of w.stored.values()){out.push(t);seen.add(t.id);if(t.collectionId)seen.add(t.collectionId);}
  for(const c of w.collections.values())if(!seen.has(c.id))out.push(virtualInquiry(w,c));
  // A subject's own research made on the fly: only for a subject no inquiry is used in, and only when it has research.
  const linked=new Set([...w.associations.filter(a=>a.status==='accepted').map(a=>a.parentStudyId),...[...w.stored.values()].flatMap(t=>[t.subject,...t.subjects]).filter(Boolean)]);
  const open=w.subjects.filter(s=>!linked.has(s.parentStudyId)&&!seen.has('subject.'+s.parentStudyId)),has=await knownResearch(open,300,[...open,...w.subjects.filter(s=>!open.includes(s))]);
  for(const s of open)if(has.has(s.parentStudyId))out.push(virtualSubject(w,s.parentStudyId));
  out.push(...await savedSuggestions(w));
  return out;
 }

 /* ---------- reads ---------- */
 /** Topics with filters: group (an id, or "none"), saying (has something to say), week (made this week), subject, gone (let go). */
 function list(input={}){
  object(input);only(input,['group','saying','week','subject','gone']);
  const flag=v=>v===true||v==='true'||v==='1';
  return serial(async()=>{
   const w=await world(),rows=(await allTopics(w)).map(t=>summary(w,t));
   const live=rows.filter(r=>r.status!=='let-go');
   let picked=flag(input.gone)?rows.filter(r=>r.status==='let-go'):live;
   if(input.group!==undefined)picked=picked.filter(r=>input.group==='none'?!r.groupId:r.groupId===input.group);
   if(flag(input.saying))picked=picked.filter(r=>r.hasSomethingToSay);
   if(flag(input.week))picked=picked.filter(r=>r.madeThisWeek);
   if(input.subject!==undefined){const sid=subjectId(input.subject);picked=picked.filter(r=>r.usedIn.some(u=>u.parentStudyId===sid));}
   const groups=w.groups.map(g=>({id:g.id,name:g.name,folder:g.folder,count:live.filter(r=>r.groupId===g.id).length,saying:live.filter(r=>r.groupId===g.id&&r.hasSomethingToSay).length})).sort((a,b)=>a.name.localeCompare(b.name));
   return {schema:LIST,topics:picked.sort((a,b)=>a.name.localeCompare(b.name)),groups,
    counts:{all:live.length,week:live.filter(r=>r.madeForYou).length,saying:live.filter(r=>r.hasSomethingToSay).length,none:live.filter(r=>!r.groupId).length,gone:rows.length-live.length},
    ...(w.unreadable.length?{unreadable:w.unreadable}:{})};
  });
 }
 /** One topic with what it points to resolved through the existing research owners. */
 function read(input={}){
  object(input);only(input,['id']);
  return serial(async()=>{
   const w=await world(),t=await resolve(w,input.id),uses=usedIn(w,t),ids=sourceIdsOf(w,t);
   let learning=null,collectionSources=null;
   if(t.collectionId){const inq=await quietly('inquiry',null,t.collectionId);if(inq){learning=inq.record?{body:typeof inq.record.body==='string'?inq.record.body:'',revision:inq.record.revision,hash:inq.record.hash,metadataHash:inq.record.metadataHash??null,updatedAt:inq.record.updatedAt||null}:null;collectionSources=inq.sources||null;}}
   const sources=(collectionSources||await quietly('sources',[],ids)).map(s=>({id:s.id,title:s.title||'Source',kind:s.kind||null,missing:!!s.missing,url:s.url||null}));
   // What people say: sources that support or challenge it (Library relationships), and findings saved for its subjects.
   const said=[],spoken=[],answers=[],findings=[];
   if(t.collectionId){
    const rel=await quietly('relationships',[],t.collectionId),title=id=>sources.find(s=>s.id===id)?.title||'A source';
    const agree=rel.filter(r=>r.relationshipType==='supports'&&r.status!=='detached'),dispute=rel.filter(r=>r.relationshipType==='challenges'&&r.status!=='detached');
    if(agree.length||dispute.length)said.push({text:'What its sources say about it',agree:[...new Set(agree.map(r=>title(r.sourceId)))],dispute:[...new Set(dispute.map(r=>title(r.sourceId)))],from:'relationships'});
    for(const r of rel)if(r.quote&&r.status!=='detached')spoken.push({quote:r.quote,speaker:title(r.sourceId),location:'',from:'evidence',sourceId:r.sourceId});
   }
   const wanted=new Set(t.findings.map(f=>f.parentStudyId+'\u0000'+f.pointId)),answerIds=new Set(t.answers);
   // Each subject's own research, as the background look last read it (the change stream clears it); one not read yet
   // is asked now, within a short wait, and a slow one is said to be still reading rather than holding the page.
   const deadline=Date.now()+600;let pending=0;
   for(const u of uses.filter(u=>u.status==='used')){
    const s=w.subjectsById.get(u.parentStudyId);if(!s)continue;
    let seen=researchSeen.get(s.parentStudyId);
    if(!seen||Date.now()-seen.at>=600000){
     const ask=quietly('subjectResearch',null,s).then(result=>{const v={at:Date.now(),value:!!(result&&(result.answers?.length||result.findings?.length)),result};researchSeen.set(s.parentStudyId,v);return v;},()=>null);
     seen=await Promise.race([ask,new Promise(r=>setTimeout(()=>r(null),Math.max(0,deadline-Date.now())).unref?.())]);
     if(!seen){pending++;continue;}
    }
    const r=seen.result;if(!r)continue;
    for(const a of r.answers||[])if(!t.answers.length||answerIds.has(a.id))answers.push({...a,parentStudyId:u.parentStudyId});
    for(const p of r.findings||[]){
     if(t.findings.length&&!wanted.has(u.parentStudyId+'\u0000'+p.id))continue;
     findings.push({parentStudyId:u.parentStudyId,pointId:p.id,title:p.title});
     said.push({text:p.title,agree:p.supported?[p.supported]:[],dispute:p.uncertain?[p.uncertain]:[],from:'finding',parentStudyId:u.parentStudyId,pointId:p.id});
     for(const sp of p.spoken||[])spoken.push({quote:sp.quote,speaker:sp.speaker||'',location:sp.location||'',from:'finding',parentStudyId:u.parentStudyId,pointId:p.id});
    }
   }
   const wait=waiting(w,t),group=t.groupId?w.groups.find(g=>g.id===t.groupId):null;
   return {schema:VIEW,...summary(w,t),hash:t.revision>0?topicHash(t):null,collectionId:t.collectionId,subject:t.subject,tag:t.tag,
    group:group?{id:group.id,name:group.name,folder:group.folder}:null,usedIn:uses,learning,sources,said,spoken,answers,findings,
    take:t.take?{text:t.take.text,at:t.take.at}:null,waitingNow:wait.now,waitingLeft:wait.left,researchPending:pending,
    ...(t.collectionId?{libraryRevision:w.catalog.revision}:{}),
    lastChange:t.operations[0]?{what:t.operations[0].what,actor:t.operations[0].actor,at:t.operations[0].at,operationId:t.operations[0].operationId,undo:!!t.operations[0].undo}:null};
  });
 }
 /** For a subject: the topics it uses (and the one made on the fly from its own research, when it has some). */
 function forSubject(input={}){
  object(input);only(input,['parentStudyId']);const sid=subjectId(input.parentStudyId);
  return serial(async()=>{
   const w=await world(),out=[];
   for(const t of await allTopics(w)){if(t.status==='let-go')continue;const s=summary(w,t);if(usedIn(w,t).some(u=>u.parentStudyId===sid))out.push({...s,use:usedIn(w,t).find(u=>u.parentStudyId===sid).status});}
   if(!out.length&&w.subjectsById.has(sid)){const r=await quietly('subjectResearch',null,w.subjectsById.get(sid));if(r&&(r.answers?.length||r.findings?.length))out.push({...summary(w,virtualSubject(w,sid)),use:'used'});}
   return {schema:LIST,parentStudyId:sid,topics:out};
  });
 }

 /* ---------- writes on a topic ---------- */
 function baseOf(t){const {schema,revision,createdAt,createdBy,updatedAt,updatedBy,operations,...rest}=t;return rest;}
 async function changeTopic(input,fields,what,apply){
  begin(input,['id','operationId','expectedRevision','expectedHash',...fields]);
  return serial(async()=>{
   const w=await world(),t=await resolve(w,input.id),stored=t.revision>0?t:null;
   if(replayed(stored,input))return {...summary(w,t),hash:topicHash(t),replayed:true};
   expect(stored,input,'topic');
   const next=await apply({...baseOf(t)},w,t);
   const written=commit(topicsDir(),stored,next,input,typeof what==='function'?what(next):what,{schema:TOPIC});
   const after=await world();
   return {...summary(after,written),hash:topicHash(written),operationId:input.operationId};
  });
 }
 /** File a topic: its name, group, suggested group, state and note, its sources (pointers), answers and findings, or leave a waiting thing for later. */
 function save(input){
  const fields=['name','groupId','suggestedGroupId','state','note','sourceIds','answers','findings','leave','unleave','origin'];
  object(input);
  if(!fields.some(k=>Object.hasOwn(input,k)))fail('Name at least one of '+fields.join(', ')+'.');
  // Leaving a waiting thing for later, or bringing it back, is his: an assistant must not hide what waits for him.
  if((Object.hasOwn(input,'leave')||Object.hasOwn(input,'unleave'))&&!humanNow())fail('Only Adrian leaves a waiting thing for later or brings it back. An assistant may not hide what waits for him.',403);
  return changeTopic(input,fields,'saved',async(next,w,t)=>{
   if(t.status==='let-go'&&!Object.hasOwn(input,'unleave'))fail('This topic was let go. Take that back first.',409);
   if(Object.hasOwn(input,'name')){
    const name=words(input.name,'A topic name',MAX_NAME);
    if(t.collectionId){const c=w.collections.get(t.collectionId);if(!c)fail('Its Library collection is gone.',409);if(c.name!==name)await ask('saveCollection',{id:c.id,name,sourceIds:c.sourceIds,expectedRevision:w.catalog.revision});}
    else next.name=name;
   }
   if(Object.hasOwn(input,'sourceIds')){
    const ids=uuidList(input.sourceIds,'sourceIds');
    if(t.collectionId){const c=w.collections.get(t.collectionId);if(!c)fail('Its Library collection is gone.',409);if(stableJson(c.sourceIds)!==stableJson(ids))await ask('saveCollection',{id:c.id,name:c.name,sourceIds:ids,expectedRevision:w.catalog.revision});}
    else next.sourceIds=ids;
   }
   for(const k of ['groupId','suggestedGroupId'])if(Object.hasOwn(input,k)){if(input[k]===null)next[k]=null;else{if(!w.groups.some(g=>g.id===input[k]))fail('There is no group '+input[k]+'.',404);next[k]=input[k];}}
   if(Object.hasOwn(input,'groupId')&&next.groupId&&next.suggestedGroupId===next.groupId)next.suggestedGroupId=null;
   if(Object.hasOwn(input,'state')){if(!STATES.includes(input.state))fail('state is one of '+STATES.join(', ')+'.');next.state=input.state;}
   if(Object.hasOwn(input,'note'))next.note=line(input.note,'note',MAX_NOTE);
   if(Object.hasOwn(input,'answers')){if(!Array.isArray(input.answers)||input.answers.length>MAX_POINTERS||input.answers.some(a=>!UUID.test(a||'')))fail('answers is a list of research answer ids.');next.answers=[...new Set(input.answers)];}
   if(Object.hasOwn(input,'findings'))next.findings=cleanFindings(input.findings);
   if(Object.hasOwn(input,'origin')){if(t.revision>0&&t.origin&&!['subject','library'].includes(t.origin.kind))fail('Where a topic came from is kept as it was first said.',409);next.origin={...await checkOrigin(cleanOrigin(input.origin)),at:t.origin?.at||new Date().toISOString()};}
   if(Object.hasOwn(input,'leave')){const key=line(input.leave,'leave',120);if(!next.left.includes(key))next.left=[...next.left,key].slice(-MAX_LEFT);}
   if(Object.hasOwn(input,'unleave')){if(t.status==='let-go')fail('This topic was let go. Take that back first.',409);const key=line(input.unleave,'unleave',120);next.left=next.left.filter(k=>k!==key);}
   return next;
  });
 }
 /** His one line of what he takes from it. His alone. */
 function take(input){
  if(!humanNow())fail('What you take from a topic is yours to write. An assistant may not write it.',403);
  return changeTopic(input,['text'],'his line',async next=>{const text=typeof input.text==='string'?input.text.trim():fail('text is his one line.');if(text.length>MAX_TAKE||/[\u0000-\u001f\u007f]/.test(text))fail('His line is one plain line of up to '+MAX_TAKE+' characters.');next.take=text?{text,by:actorNow(),at:new Date().toISOString()}:null;return next;});
 }
 /** Let a topic go: it will not be opened or suggested again. His alone, with Undo. */
 function letGo(input){
  if(!humanNow())fail('Letting a topic go is Adrian\'s decision. An assistant may propose, not decide.',403);
  return changeTopic(input,[],'let go',async(next,w,t)=>{if(t.status==='let-go')fail('This topic was already let go.',409);next.__undo={status:t.status};next.status='let-go';return next;});
 }
 /** Take back the last let go, while nothing has changed since. */
 function undo(input){
  if(!humanNow())fail('Taking back a decision is Adrian\'s alone.',403);
  return changeTopic(input,['undoOperationId'],'undone',async(next,w,t)=>{
   const last=t.operations[0];if(!last||!last.undo||last.operationId!==input.undoOperationId)fail('Undo takes back only the last let go on this topic, while nothing has changed since.',409);
   next.status=last.undo.status;return next;
  });
 }
 /** Keep a proposal (an assistant's, or things he saved under one topic): it becomes an inquiry in Library. His alone. */
 function keep(input){
  if(!humanNow())fail('Keeping a proposed topic is Adrian\'s decision. An assistant may propose, not decide.',403);
  return changeTopic(input,[],'kept',async(next,w,t)=>{
   if(t.status!=='proposed')fail('Only a proposed topic waits to be kept.',409);
   const made=await ask('saveCollection',{name:nameOf(w,t),sourceIds:sourceIdsOf(w,t),expectedRevision:w.catalog.revision});
   if(!made?.collection?.id)fail('Library could not make the topic\'s collection. Nothing was kept.',503);
   next.status='kept';next.collectionId=made.collection.id;next.name=made.collection.name;next.sourceIds=[];
   for(const sid of next.subjects){try{await ask('link',{collectionId:made.collection.id,parentStudyId:sid,accept:true});}catch{}}
   return next;
  });
 }
 /** Where a topic came from. He may say it plainly; an assistant may never say he started it, and must name the real
     record it came from (the conversation, the fact check, the things he saved, the note), which is looked up. */
 async function checkOrigin(origin){
  if(humanNow())return origin;
  if(origin.kind==='started')fail('Only Adrian starts a topic. An assistant proposes one and says where it came from.',403);
  const allowed=ASSISTANT_REFS[origin.kind];
  if(!origin.ref||!allowed.includes(origin.ref.kind))fail('Say which record it came from: origin.ref with kind '+allowed.join(' or ')+' and its id.',400);
  const ref=origin.ref,missing=()=>fail('There is no '+ref.kind.replace('-',' ')+' '+ref.id+' to have come from.',404);
  if(['source','recording','note'].includes(ref.kind)){
   if(typeof owners.sources!=='function')fail('Sources cannot be checked in this home.',503);
   const [s]=await owners.sources([ref.id]);if(!s||s.missing)missing();
  }else if(ref.kind==='library-topic'){
   if(typeof owners.libraryTopics!=='function')fail('Library topics cannot be checked in this home.',503);
   const k=slug(ref.id);if(!(await owners.libraryTopics()).some(r=>(r.topics||[]).some(t=>slug(t)===k)))missing();
  }else if(ref.kind==='consent-claim'){
   if(typeof owners.claim!=='function')fail('Fact checks cannot be checked in this home.',503);
   let claim=null;try{claim=await owners.claim({parentStudyId:ref.parentStudyId,id:ref.id});}catch(error){if(!Number.isInteger(error?.status))throw error;}
   if(!claim)missing();
  }
  return origin;
 }
 /** An assistant proposes a topic (from a conversation, a fact check, things he saved, his note): he keeps it or lets it go. */
 function propose(input){
  begin(input,['operationId','name','origin','sourceIds','note','groupId','suggestedGroupId','subjects','answers','findings']);
  const name=words(input.name,'A topic name',MAX_NAME),cleaned=cleanOrigin(input.origin);
  const sourceIds=input.sourceIds===undefined?[]:uuidList(input.sourceIds,'sourceIds'),subjects=input.subjects===undefined?[]:[...new Set(input.subjects.map(subjectId))];
  return serial(async()=>{
   const w=await world(),id='p-'+input.operationId.toLowerCase(),origin=await checkOrigin(cleaned);
   const existing=loadTopic(id);if(existing){if(replayed(existing,input))return {...summary(w,existing),hash:topicHash(existing),replayed:true};fail('This operationId already made a topic.',409);}
   for(const k of ['groupId','suggestedGroupId'])if(input[k]!=null&&!w.groups.some(g=>g.id===input[k]))fail('There is no group '+input[k]+'.',404);
   if(input.findings!==undefined)cleanFindings(input.findings);
   const human=humanNow();
   const record={id,kind:'proposal',collectionId:null,subject:null,tag:null,name,origin:{...origin,at:new Date().toISOString()},status:human?'kept':'proposed',state:'new',note:input.note===undefined?'':line(input.note,'note',MAX_NOTE),
    groupId:input.groupId??null,suggestedGroupId:input.suggestedGroupId??null,subjects,sourceIds,answers:input.answers?[...new Set(input.answers)]:[],findings:input.findings?cleanFindings(input.findings):[],take:null,left:[],proposedBy:human?null:actorNow()};
   const written=commit(topicsDir(),null,record,input,human?'started':'proposed',{schema:TOPIC});
   return {...summary(await world(),written),hash:topicHash(written),operationId:input.operationId};
  });
 }
 /** He starts a topic himself: an inquiry in Library, with where it came from kept here. */
 function start(input){
  if(!humanNow())fail('Starting a topic of his own is Adrian\'s. An assistant proposes one instead.',403);
  begin(input,['operationId','name','sourceIds','groupId','subjects']);
  const name=words(input.name,'What you want to understand',MAX_NAME),sourceIds=input.sourceIds===undefined?[]:uuidList(input.sourceIds,'sourceIds'),subjects=input.subjects===undefined?[]:[...new Set(input.subjects.map(subjectId))];
  return serial(async()=>{
   const id='p-'+input.operationId.toLowerCase(),existing=loadTopic(id);
   const w=await world();
   if(existing){if(replayed(existing,input))return {...summary(w,existing),hash:topicHash(existing),replayed:true};fail('This operationId already made a topic.',409);}
   if(input.groupId!=null&&!w.groups.some(g=>g.id===input.groupId))fail('There is no group '+input.groupId+'.',404);
   const made=await ask('saveCollection',{name,sourceIds,expectedRevision:w.catalog.revision});
   if(made&&!made.collection?.id)fail('Library could not make the topic\'s collection. Nothing was started.',503);
   const record={id,kind:'proposal',collectionId:made?.collection?.id||null,subject:null,tag:null,name,origin:{kind:'started',label:'',ref:null,at:new Date().toISOString()},status:'kept',state:'new',note:'',groupId:input.groupId??null,suggestedGroupId:null,subjects:made?[]:subjects,sourceIds:made?[]:sourceIds,answers:[],findings:[],take:null,left:[],proposedBy:null};
   if(made)for(const sid of subjects){try{await ask('link',{collectionId:made.collection.id,parentStudyId:sid,accept:true});}catch{record.subjects.push(sid);}}
   const written=commit(topicsDir(),null,record,input,'started',{schema:TOPIC});
   return {...summary(await world(),written),hash:topicHash(written),operationId:input.operationId};
  });
 }
 /** Use a topic for a subject. For an inquiry this is Library's Project association: an assistant's link is proposed and
     waits for his yes; his own is used at once. For a topic with no inquiry yet it is a pointer kept here. */
 function link(input){
  return changeTopic(input,['parentStudyId','remove'],input.remove?'unlinked':'linked',async(next,w,t)=>{
   const sid=subjectId(input.parentStudyId);if(!w.subjectsById.has(sid))fail('There is no subject '+sid+'.',404);
   if(input.remove!==undefined&&typeof input.remove!=='boolean')fail('remove is true or false.');
   if(input.remove){if(t.collectionId&&usesOf(w,t.collectionId).some(a=>a.parentStudyId===sid))fail('This topic is used there through Library. Detach it in Advanced, where the connection is kept.',409);next.subjects=next.subjects.filter(s=>s!==sid);return next;}
   if(t.collectionId){const r=await ask('link',{collectionId:t.collectionId,parentStudyId:sid,accept:humanNow()});if(!r)fail('Subjects cannot be linked in this home.',503);next.left=next.left.filter(k=>k!=='use:'+sid);}
   else if(!next.subjects.includes(sid)&&t.subject!==sid)next.subjects=[...next.subjects,sid];
   return next;
  });
 }

 /* ---------- groups ---------- */
 const groupTopics=async(w,id)=>(await allTopics(w)).filter(t=>t.groupId===id&&t.status!=='let-go');
 async function groupView(w,g){
  const topics=await groupTopics(w,g.id),fromTopics=new Map();
  for(const t of topics)for(const sid of sourceIdsOf(w,t)){if(!fromTopics.has(sid))fromTopics.set(sid,[]);fromTopics.get(sid).push(t.id);}
  const own=new Set(g.sources.map(s=>s.sourceId)),ids=[...new Set([...g.sources.map(s=>s.sourceId),...fromTopics.keys()])];
  const info=new Map((await quietly('sources',[],ids)).map(s=>[s.id,s]));
  const unticked=new Set(g.unticked);
  const sources=ids.map(id=>({id,title:info.get(id)?.title||'Source',kind:info.get(id)?.kind||null,missing:!!info.get(id)?.missing||!info.has(id),ticked:own.has(id)?g.sources.find(s=>s.sourceId===id).ticked:!unticked.has(id),from:own.has(id)?'group':'topic',topics:fromTopics.get(id)||[]}));
  const uses=new Map();for(const t of topics)for(const u of usedIn(w,t))if(u.status==='used')uses.set(u.parentStudyId,{parentStudyId:u.parentStudyId,title:u.title});
  const answers=[];for(const t of topics)for(const a of t.answers)answers.push(a);
  return {schema:GROUP_VIEW,id:g.id,name:g.name,folder:g.folder,settings:g.settings,revision:g.revision,hash:groupHash(g),saved:g.revision>0,sources,topics:topics.map(t=>summary(w,t)).sort((a,b)=>a.name.localeCompare(b.name)),usedIn:[...uses.values()],
   ask:askAbility(),lastChange:g.operations?.[0]?{what:g.operations[0].what,actor:g.operations[0].actor,at:g.operations[0].at}:null};
 }
 const askAbility=()=>({find:typeof owners.readSource==='function',atlas:typeof owners.atlas==='function',answers:false,needs:'Answers written in sentences from these sources need an AI provider, which this app does not have set up for asking yet.'});
 function groups(input={}){object(input);only(input,[]);return serial(async()=>{const w=await world(),live=(await allTopics(w)).filter(t=>t.status!=='let-go');return {schema:GROUPS,groups:w.groups.map(g=>({id:g.id,name:g.name,folder:g.folder,revision:g.revision,hash:groupHash(g),count:live.filter(t=>t.groupId===g.id).length,sourceCount:g.sources.length})).sort((a,b)=>a.name.localeCompare(b.name))};});}
 function readGroup(input={}){object(input);only(input,['id']);return serial(async()=>{const w=await world(),g=w.groups.find(x=>x.id===input.id);if(!g)fail('There is no group '+input.id+'.',404);return groupView(w,g);});}
 /** Make a group or change its name, folder or settings. */
 function saveGroup(input){
  begin(input,['id','operationId','expectedRevision','expectedHash','name','folder','settings']);
  return serial(async()=>{
   const w=await world();let id=input.id,before=null;
   if(id!==undefined){if(typeof id!=='string'||!/^g-[a-z0-9-]{1,80}$/.test(id))fail('A group id looks like g-mandala.');before=loadGroup(id);if(!before)fail('There is no group '+id+'.',404);}
   else{if(input.name===undefined)fail('A new group needs a name.');const base='g-'+slug(input.name);id=base;let n=2;while(loadGroup(id)){const prior=loadGroup(id);if(prior.operations.some(op=>op.operationId===input.operationId))break;id=base+'-'+n++;}before=loadGroup(id);}
   if(before&&replayed(before,input))return {...await groupView(w,before),replayed:true};
   if(before||input.id!==undefined)expect(before,input,'group');else if(input.expectedRevision!==undefined&&input.expectedRevision!==0)fail('A new group starts at expectedRevision 0.');
   const name=input.name!==undefined?words(input.name,'A group name',MAX_NAME):before.name;
   if(w.groups.some(g=>g.id!==id&&g.name.toLocaleLowerCase()===name.toLocaleLowerCase()))fail('There is already a group called '+name+'.',409);
   const next={id,name,folder:input.folder!==undefined?cleanFolder(input.folder):before?.folder||['Research',folderName(name)],sources:before?.sources||[],unticked:before?.unticked||[],settings:input.settings!==undefined?cleanSettings(input.settings,before?.settings||{opensTopics:'propose'}):before?.settings||{opensTopics:'propose'}};
   const written=commit(groupsDir(),before,next,input,before?'group changed':'group made',{schema:GROUP});
   return groupView(await world(),written);
  });
 }
 /** Add or remove a group's own sources, or tick and untick any source it holds (ticked ones are the ones it is asked from). */
 function groupSources(input){
  begin(input,['id','operationId','expectedRevision','expectedHash','action','sourceIds']);
  if(!['add','remove','tick','untick'].includes(input.action))fail('action is add, remove, tick or untick.');
  const ids=uuidList(input.sourceIds,'sourceIds',200);if(!ids.length)fail('Name at least one source.');
  return serial(async()=>{
   const w=await world(),before=loadGroup(input.id);if(!before)fail('There is no group '+input.id+'.',404);
   if(replayed(before,input))return {...await groupView(w,before),replayed:true};
   expect(before,input,'group');
   const view=await groupView(w,before),held=new Map(view.sources.map(s=>[s.id,s]));
   let sources=before.sources.map(s=>({...s})),unticked=[...before.unticked];
   if(input.action==='add'){const known=new Set((await quietly('sources',[],ids)).filter(s=>!s.missing).map(s=>s.id));const missing=ids.filter(id=>!known.has(id));if(typeof owners.sources==='function'&&missing.length)fail('Not in the Library: '+missing.join(', ')+'.',404);for(const id of ids)if(!sources.some(s=>s.sourceId===id))sources.push({sourceId:id,ticked:true});unticked=unticked.filter(id=>!ids.includes(id));}
   else if(input.action==='remove'){const fromTopic=ids.filter(id=>held.get(id)?.from==='topic');if(fromTopic.length)fail('That source comes with one of its topics. Untick it here, or take it out of the topic.',409);sources=sources.filter(s=>!ids.includes(s.sourceId));}
   else{const gone=ids.filter(id=>!held.has(id));if(gone.length)fail('This group does not hold '+gone.join(', ')+'.',404);const on=input.action==='tick';for(const id of ids){const own=sources.find(s=>s.sourceId===id);if(own)own.ticked=on;else unticked=on?unticked.filter(x=>x!==id):[...new Set([...unticked,id])];}}
   const written=commit(groupsDir(),before,{...baseGroup(before),sources,unticked},input,'sources '+input.action,{schema:GROUP});
   return groupView(await world(),written);
  });
 }
 const baseGroup=g=>({id:g.id,name:g.name,folder:g.folder,sources:g.sources,unticked:g.unticked,settings:g.settings});

 /* ---------- asking ---------- */
 /** Ask a group, or everything: the places the sources themselves use these words, ignoring capitals. Each source is read
    through Library one at a time, with a pause between, up to a limit; what was not searched is said exactly. Everything
    is also asked of the Atlas. It never writes an answer in sentences: that needs an AI provider, and says so. */
 async function scan(ids,query,limit){
  const needle=query.toLowerCase(),found=[];let searched=0,matched=0,unreadable=0,bytes=0;
  for(const id of ids){
   if(searched>=MAX_SCAN_SOURCES||bytes>=MAX_SCAN_BYTES)break;
   searched++;let s=null;
   try{s=await owners.readSource(id);}catch(error){if(!Number.isInteger(error?.status))throw error;}
   if(!s||typeof s.text!=='string'){unreadable++;await breathe();continue;}
   bytes+=s.text.length;const at=s.text.toLowerCase().indexOf(needle);
   if(at>=0){matched++;if(found.length<limit){const from=Math.max(0,at-QUOTE),to=Math.min(s.text.length,at+needle.length+QUOTE);found.push({sourceId:id,title:s.title,quote:(from?'…':'')+s.text.slice(from,to).trim()+(to<s.text.length?'…':''),start:at});}}
   await breathe();
  }
  return {found,searched,matched,unreadable,total:ids.length,notSearched:ids.length-searched};
 }
 async function askSources(input={}){
  object(input);only(input,['query','groupId','limit']);
  const query=words(input.query,'What you are looking for',256),limit=input.limit===undefined?10:input.limit;
  if(!Number.isSafeInteger(limit)||limit<1||limit>20)fail('limit is a whole number from 1 to 20.');
  let ids,scope;
  if(input.groupId!==undefined){const w=await world(),g=w.groups.find(x=>x.id===input.groupId);if(!g)fail('There is no group '+input.groupId+'.',404);ids=(await groupView(w,g)).sources.filter(s=>s.ticked&&!s.missing).map(s=>s.id);scope={kind:'group',id:input.groupId,sources:ids.length};}
  else{ids=typeof owners.allSourceIds==='function'?await owners.allSourceIds():[];scope={kind:'everything',sources:ids.length};}
  const ability=askAbility();
  if(scope.kind==='group'&&!ids.length)return {schema:ASK,query,scope,found:[],atlas:[],ability,searched:{sources:0,of:0,notSearched:0,unreadable:0},said:'Tick at least one source to look in.'};
  if(!ability.find)return {schema:ASK,query,scope,found:[],atlas:[],ability,searched:{sources:0,of:ids.length,notSearched:ids.length,unreadable:0},said:'Sources cannot be searched in this home.'};
  const r=await scan(ids,query,limit);
  let atlas=[];if(scope.kind==='everything'&&ability.atlas){const a=await quietly('atlas',null,{query,limit:5});atlas=(a?.items||[]).map(i=>({title:i.title||'Atlas article',quote:i.locator?.quote||'',articleId:i.articleId||null}));}
  const where=scope.kind==='group'?'the ticked sources':'your sources',plural=(n,w)=>n+' '+w+(n===1?'':'s');
  const parts=[r.found.length||atlas.length?(r.matched>r.found.length?`${plural(r.matched,'source')} use${r.matched===1?'s':''} these words; here are the first ${r.found.length}.`:'These are the places '+where+' use these words.'):r.notSearched?'None of the sources searched uses these words.':'None of '+where+' uses these words.'];
  parts.push(r.notSearched?`Searched ${r.searched} of ${r.total} sources; ${r.notSearched} were not searched, because one search reads at most ${MAX_SCAN_SOURCES} sources or ${MAX_SCAN_BYTES/1024/1024} MB.`:`Searched all ${plural(r.total,'source')}.`);
  if(r.unreadable)parts.push(plural(r.unreadable,'source')+' could not be read as text (pictures, or files that are gone).');
  return {schema:ASK,query,scope,found:r.found,atlas,ability,searched:{sources:r.searched,of:r.total,notSearched:r.notSearched,unreadable:r.unreadable,matched:r.matched},said:parts.join(' ')};
 }

 // Every door answers with a promise, a refusal included.
 const methods={list,read,forSubject,save,take,letGo,undo,keep,propose,start,link,groups,readGroup,saveGroup,groupSources,ask:askSources};
 return Object.freeze({...Object.fromEntries(Object.entries(methods).map(([k,fn])=>[k,async input=>fn(input)])),forgetResearch});
}
