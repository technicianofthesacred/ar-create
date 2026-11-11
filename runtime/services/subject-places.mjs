// Where a subject lives: its folder, tags, pin, archived flag, its hand-set order in its folder and, apart from that,
// its hand-set place on the desk (deskOrder; a place saved before the desk had its own order has none, and the desk
// then goes by pin time). One record per subject under
// data/subject-places/subjects/, and one list of folders (data/subject-places/folders.json) so an empty folder can
// exist and keep its place. The app, the CLI and MCP all read and change the same files through the commands in
// runtime/commands/subject-places.mjs. A subject with no saved place has none of these and behaves as it always did.
// Organising is not a decision only Adrian makes: assistants may file, pin, archive and reorder too, and every change
// carries its actor, a revision check and a journal line (written by the server after the answer, as for every command).
import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,readJson,regular} from './files.mjs';
import {currentActor,requireWriteActor} from './actor.mjs';
import {folderName,stableJson} from './library-folders.mjs';

const PLACE='ar-create.subject-place.v1',FOLDERS='ar-create.subject-folders.v1',VIEW='ar-create.subject-places.v1',FOLDER_VIEW='ar-create.subject-folders-view.v1';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/,ID=/^[A-Za-z0-9._:-]{1,160}$/,PLAIN_FILE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const MAX_DEPTH=8,MAX_TAGS=30,MAX_TAG=40,MAX_FOLDERS=500,MAX_REORDER=500,KEEP_OPS=50,KEEP_FOLDER_OPS=200,MAX_BODY=256*1024;
const PLACE_FIELDS=['folder','tags','pinned','pinnedAt','archived','order','deskOrder'];
// The fields a place can hold. `held` records which ones were ever set, so a carry-over fills only what is not saved yet.
const HELD=Object.freeze(['folder','tags','pinnedAt','archived','order','deskOrder']);
const FOLDER_ACTIONS={create:['path'],rename:['path','name'],reorder:['order'],remove:['path'],undo:['undoOperationId']};
/** The stamp on a place carried over from one browser's own storage the first time the app saw it. */
export const IMPORT_ACTOR='import:browser';
const fail=(message,status=400)=>{throw new StateError(message,status);};
const actorNow=()=>currentActor()?.actor||'unknown(in-process)';
const clientNow=()=>currentActor()?.client||null;
const object=(input,what)=>{if(!input||typeof input!=='object'||Array.isArray(input))fail(what+' must be a JSON object.');return input;};
const only=(input,allowed)=>{const extra=Object.keys(input).filter(k=>!allowed.includes(k));if(extra.length)fail('Unsupported field '+extra[0]+'. Use only '+allowed.join(', ')+'.');};
const content=p=>({folder:p.folder,tags:p.tags,pinnedAt:p.pinnedAt,archived:p.archived,order:p.order,...(p.deskOrder!==undefined&&p.deskOrder!==null?{deskOrder:p.deskOrder}:{})});
const placeHash=p=>digest(stableJson(content(p)));
const foldersHash=list=>digest(stableJson(list));
const key=folder=>stableJson(folder);
const within=(folder,prefix)=>prefix.length<=folder.length&&prefix.every((part,i)=>folder[i]===part);

export function subjectId(value){if(typeof value!=='string'||!ID.test(value)||value==='.'||value==='..')fail('Name the subject by its project id (parentStudyId).');return value;}
export function cleanFolder(value){
 if(!Array.isArray(value)||value.length>MAX_DEPTH)fail('A folder is a list of up to '+MAX_DEPTH+' plain names, for example ["Tea"] or ["Art","Studio"]. An empty list means no folder.');
 return value.map(folderName);
}
export function cleanTags(value){
 if(!Array.isArray(value)||value.length>MAX_TAGS)fail('Tags are a list of up to '+MAX_TAGS+' short words.');
 const out=[],seen=new Set();
 for(const tag of value){
  if(typeof tag!=='string'||!tag.trim()||tag.trim().length>MAX_TAG||/[\u0000-\u001f\u007f]/.test(tag))fail('Each tag is a short plain word of up to '+MAX_TAG+' characters.');
  const t=tag.trim(),k=t.toLocaleLowerCase();if(!seen.has(k)){seen.add(k);out.push(t);}
 }
 return out;
}
function cleanPinnedAt(value){
 if(value===null)return null;
 if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value)))fail('pinnedAt is an ISO time, or null for not pinned.');
 return new Date(Date.parse(value)).toISOString();
}
function cleanOrder(value){if(value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e9)fail('order is a number (its hand-set position in the folder), or null.');return value;}
function cleanDeskOrder(value){if(value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e9)fail('deskOrder is a number (its hand-set place on the desk), or null.');return value;}
function cleanArchived(value){if(typeof value!=='boolean')fail('archived is true or false.');return value;}
const empty=parentStudyId=>({schema:PLACE,parentStudyId,folder:[],tags:[],pinnedAt:null,archived:false,order:null,held:[],revision:0,operations:[]});
function validatePlace(value,id){
 if(!value||value.schema!==PLACE||value.parentStudyId!==id||!Number.isSafeInteger(value.revision)||value.revision<1||!Array.isArray(value.operations))fail('This subject\'s place file is not readable; its bytes were kept.',409);
 cleanFolder(value.folder);cleanTags(value.tags);if(value.pinnedAt!==null)cleanPinnedAt(value.pinnedAt);cleanOrder(value.order);cleanArchived(value.archived);if(value.deskOrder!==undefined)cleanDeskOrder(value.deskOrder);
 // A place saved before `held` was kept holds every field.
 if(value.held===undefined)value.held=[...HELD];else if(!Array.isArray(value.held)||value.held.some(k=>!HELD.includes(k)))fail('This subject\'s place file is not readable; its bytes were kept.',409);
 return value;
}
function view(place,saved=place.revision>0){
 return {parentStudyId:place.parentStudyId,folder:[...place.folder],tags:[...place.tags],pinnedAt:place.pinnedAt,archived:place.archived,order:place.order,deskOrder:place.deskOrder??null,held:HELD.filter(k=>place.held.includes(k)),revision:place.revision,hash:placeHash(place),saved,
  ...(place.updatedAt?{updatedAt:place.updatedAt,updatedBy:place.updatedBy}:{}),...(place.importedFrom?{importedFrom:place.importedFrom,carriedBy:place.carriedBy}:{})};
}
const fingerprint=input=>digest(stableJson(input));

export function createSubjectPlaces({dataDir}={}){
 if(!dataDir)throw Error('Subject places need the data folder.');
 const root=()=>ensurePrivateDirectory(dataDir,'subject-places'),subjectsDir=()=>ensurePrivateDirectory(dataDir,path.join('subject-places','subjects'));
 // A readable name where the id allows one; any other id is named by its digest (never a readable id, which starts with a letter or digit).
 // Ids with capitals take the digest too: a Mac's disk does not tell "Abc" from "abc", and each needs its own file.
 const fileName=id=>(PLAIN_FILE.test(id)&&!/[A-Z]/.test(id)&&!id.endsWith('.tmp')?id:'_'+digest(id).slice(0,40))+'.json';
 const placeFile=id=>path.join(subjectsDir(),fileName(id));
 const foldersFile=()=>path.join(root(),'folders.json');
 let queue=Promise.resolve();
 const serial=fn=>{const run=queue.then(fn,fn);queue=run.catch(()=>{});return run;};

 function load(id){const file=placeFile(id);if(!fs.existsSync(file))return empty(id);return validatePlace(readJson(file,null),id);}
 function store(place){atomicWrite(placeFile(place.parentStudyId),JSON.stringify(place,null,1)+'\n');return place;}
 function all(){
  const dir=subjectsDir(),out=[],unreadable=[];
  for(const name of fs.readdirSync(dir).sort()){
   if(!name.endsWith('.json'))continue;
   try{const file=path.join(dir,name);regular(file);const value=JSON.parse(fs.readFileSync(file,'utf8'));if(fileName(value?.parentStudyId||'')!==name)throw Error('wrong name');out.push(validatePlace(value,value.parentStudyId));}
   catch{unreadable.push(name);}
  }
  return {places:out,unreadable};
 }
 function commitPlace(before,next,input,what,{actor=actorNow(),extra={},held=[]}={}){
  const revision=before.revision+1,at=new Date().toISOString();
  const op={operationId:input.operationId,revision,actor,client:clientNow(),at,what,fingerprint:fingerprint(input)};
  return store({schema:PLACE,parentStudyId:before.parentStudyId,folder:next.folder,tags:next.tags,pinnedAt:next.pinnedAt,archived:next.archived,order:next.order,...(next.deskOrder!==undefined&&next.deskOrder!==null?{deskOrder:next.deskOrder}:{}),held:HELD.filter(k=>before.held.includes(k)||held.includes(k)),revision,updatedAt:at,updatedBy:actor,
   ...(before.importedFrom?{importedFrom:before.importedFrom,carriedBy:before.carriedBy}:{}),...extra,operations:[op,...before.operations].slice(0,KEEP_OPS)});
 }
 /** The earlier answer to a retried operation, or null; a different request under the same id is refused. */
 function replayed(place,input){
  const prior=place.operations.find(op=>op.operationId===input.operationId);if(!prior)return null;
  if(prior.fingerprint!==fingerprint(input))fail('This operationId already belongs to a different change. Use a fresh one.',409);
  return {...view(place),replayed:true};
 }
 function expect(place,input){
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)fail('A change needs the expectedRevision you read (0 for a subject with no saved place).');
  if(input.expectedHash!==undefined&&!HASH.test(input.expectedHash||''))fail('expectedHash is the hash you read.');
  if(input.expectedRevision>0&&input.expectedHash===undefined)fail('A change to a saved place needs the expectedHash you read.');
  if(place.revision!==input.expectedRevision||(input.expectedHash!==undefined&&input.expectedHash!==placeHash(place)))fail('This subject\'s place changed since you read it. Read it again; nothing was overwritten.',409);
 }
 function begin(input,fields){
  object(input,'The request');only(input,fields);
  if(!UUID.test(input.operationId||''))fail('Every change needs a fresh operationId (a UUID).');
 }

 /** Every saved place (or one subject's, saved or not), with the folders. Subjects with no saved place are simply absent. */
 function read(input={}){
  object(input,'The request');only(input,['parentStudyId']);
  return serial(()=>{
   if(input.parentStudyId!==undefined){const id=subjectId(input.parentStudyId);return {schema:VIEW,places:[view(load(id))],folders:foldersView()};}
   const {places,unreadable}=all();
   return {schema:VIEW,places:places.map(p=>view(p)),...(unreadable.length?{unreadable}:{}),folders:foldersView(places)};
  });
 }
 /** Save one subject's place: any of folder, tags, pinned (or pinnedAt), archived, order. */
 function save(input){
  begin(input,['parentStudyId','operationId','expectedRevision','expectedHash',...PLACE_FIELDS]);
  const id=subjectId(input.parentStudyId);
  if(!PLACE_FIELDS.some(k=>Object.hasOwn(input,k)))fail('Name at least one of folder, tags, pinned, archived, order or deskOrder.');
  if(Object.hasOwn(input,'pinned')&&Object.hasOwn(input,'pinnedAt'))fail('Send pinned or pinnedAt, not both.');
  if(Object.hasOwn(input,'pinned')&&typeof input.pinned!=='boolean')fail('pinned is true or false.');
  const change={...(Object.hasOwn(input,'folder')?{folder:cleanFolder(input.folder)}:{}),...(Object.hasOwn(input,'tags')?{tags:cleanTags(input.tags)}:{}),...(Object.hasOwn(input,'pinnedAt')?{pinnedAt:cleanPinnedAt(input.pinnedAt)}:{}),
   ...(Object.hasOwn(input,'archived')?{archived:cleanArchived(input.archived)}:{}),...(Object.hasOwn(input,'order')?{order:cleanOrder(input.order)}:{}),
   ...(Object.hasOwn(input,'deskOrder')?{deskOrder:cleanDeskOrder(input.deskOrder)}:{})};
  return serial(()=>{
   const before=load(id),again=replayed(before,input);if(again)return again;
   expect(before,input);
   const next={...content(before),...change};
   if(Object.hasOwn(input,'pinned'))next.pinnedAt=input.pinned?before.pinnedAt||new Date().toISOString():null;
   return view(commitPlace(before,next,input,'saved',{held:PLACE_FIELDS.filter(k=>Object.hasOwn(input,k)).map(k=>k==='pinned'?'pinnedAt':k)}));
  });
 }
 /**
  * The browser's own filing, carried over once, field by field: a field the saved place already holds wins and is left
  * alone; a field it does not hold yet takes the browser's value. Nothing to fill answers carried:false and changes
  * nothing. Stamped import:browser, with who carried it.
  */
 function carry(input){
  begin(input,['parentStudyId','operationId','folder','tags','pinnedAt','archived','order']);
  const id=subjectId(input.parentStudyId);
  const offered={...(Object.hasOwn(input,'folder')?{folder:cleanFolder(input.folder)}:{}),...(Object.hasOwn(input,'tags')?{tags:cleanTags(input.tags)}:{}),...(Object.hasOwn(input,'pinnedAt')?{pinnedAt:cleanPinnedAt(input.pinnedAt)}:{}),
   ...(Object.hasOwn(input,'archived')?{archived:cleanArchived(input.archived)}:{}),...(Object.hasOwn(input,'order')?{order:cleanOrder(input.order)}:{})};
  return serial(()=>{
   const before=load(id),again=replayed(before,input);if(again)return {...again,carried:true};
   const fill=Object.keys(offered).filter(k=>!before.held.includes(k));
   if(!fill.length)return {...view(before),carried:false};
   const next={...content(before),...Object.fromEntries(fill.map(k=>[k,offered[k]]))};
   return {...view(commitPlace(before,next,input,'carried over from the browser: '+fill.join(', '),{actor:IMPORT_ACTOR,held:fill,extra:{importedFrom:'browser',carriedBy:actorNow()}})),carried:true,carriedFields:fill};
  });
 }
 /** Put several subjects in a hand-set order (0, 1, 2, ...) in one call; every expected revision is checked before anything is written. */
 function reorder(input){
  begin(input,['operationId','items','which']);
  // Which hand-set order this sets: 'folder' (the default, `order`, a subject's place in its folder) or 'desk'
  // (`deskOrder`, its place on the desk). Setting one never changes the other.
  if(input.which!==undefined&&!['folder','desk'].includes(input.which))fail('which is folder (the default) or desk.');
  const field=input.which==='desk'?'deskOrder':'order';
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>MAX_REORDER)fail('items lists 1 to '+MAX_REORDER+' subjects in their new order.');
  const items=input.items.map(item=>{object(item,'Each item');only(item,['parentStudyId','expectedRevision','expectedHash']);return {...item,parentStudyId:subjectId(item.parentStudyId)};});
  if(new Set(items.map(i=>i.parentStudyId)).size!==items.length)fail('Each subject appears once in items.');
  return serial(()=>{
   const loaded=items.map(item=>({item,before:load(item.parentStudyId)})),stale=[];
   for(const {item,before} of loaded){
    const prior=before.operations.find(op=>op.operationId===input.operationId);
    if(prior){if(prior.fingerprint!==fingerprint(input))fail('This operationId already belongs to a different change. Use a fresh one.',409);continue;}
    try{expect(before,item);}catch(error){if(error.status!==409)throw error;stale.push(item.parentStudyId);}
   }
   if(stale.length)fail('These subjects changed since you read them: '+stale.join(', ')+'. Read again; nothing was moved.',409);
   const places=loaded.map(({before},index)=>before.operations.some(op=>op.operationId===input.operationId)?before:commitPlace(before,{...content(before),[field]:index},input,field==='deskOrder'?'reordered on the desk':'reordered',{held:[field]}));
   return {schema:VIEW,places:places.map(p=>view(p)),...(loaded.every(({before})=>before.operations.some(op=>op.operationId===input.operationId))?{replayed:true}:{})};
  });
 }

 /* ---------- the list of folders ---------- */
 function loadFolders(){
  const value=readJson(foldersFile(),{schema:FOLDERS,revision:0,folders:[],operations:[]});
  if(value.schema!==FOLDERS||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.folders)||!Array.isArray(value.operations))fail('The subject folder list is not readable; its bytes were kept.',409);
  for(const f of value.folders)cleanFolder(f?.path);
  return value;
 }
 /** Saved folders in their order, then any folder a subject uses that is not on the list yet (with its parents). */
 function foldersView(places=all().places){
  const saved=loadFolders(),list=saved.folders.map(f=>f.path),known=new Set(list.map(key)),implicit=new Map();
  for(const p of places)for(let depth=1;depth<=p.folder.length;depth++){const f=p.folder.slice(0,depth);if(!known.has(key(f)))implicit.set(key(f),f);}
  const count=f=>places.filter(p=>key(p.folder)===key(f)).length;
  const last=saved.operations[0];
  return {schema:FOLDER_VIEW,revision:saved.revision,hash:foldersHash(list),
   folders:[...list.map(f=>({path:[...f],saved:true,count:count(f)})),...[...implicit.values()].sort((a,b)=>a.join('/').localeCompare(b.join('/'))).map(f=>({path:f,saved:false,count:count(f)}))],
   undoOperationId:last&&last.action!=='undo'&&stableJson(last.after)===stableJson(list)?last.operationId:null};
 }
 function readFolders(input={}){object(input,'The request');only(input,[]);return serial(()=>foldersView());}
 function changeFolders(input){
  object(input,'The request');
  const required=FOLDER_ACTIONS[input.action];if(!required)fail('Choose an action: '+Object.keys(FOLDER_ACTIONS).join(', ')+'.');
  begin(input,['action','operationId','expectedRevision','expectedHash',...required]);
  if(required.some(k=>!Object.hasOwn(input,k)))fail('The '+input.action+' action needs '+required.join(' and ')+'.');
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!HASH.test(input.expectedHash||''))fail('A folder change needs the expectedRevision and expectedHash you read.');
  const target=Object.hasOwn(input,'path')?cleanFolder(input.path):null;if(target&&!target.length)fail('Name the folder by its path, for example ["Tea"].');
  return serial(()=>{
   const saved=loadFolders(),list=saved.folders.map(f=>f.path),print=fingerprint(input);
   const prior=saved.operations.find(op=>op.operationId===input.operationId);
   if(prior){if(prior.fingerprint!==print)fail('This operationId already belongs to a different change. Use a fresh one.',409);return {...foldersView(),replayed:true};}
   if(saved.revision!==input.expectedRevision||foldersHash(list)!==input.expectedHash)fail('The folder list changed since you read it. Read it again; nothing was overwritten.',409);
   const places=all().places,inView=new Set(foldersView(places).folders.map(f=>key(f.path)));
   let after=list.map(f=>[...f]);const moved=[];
   if(input.action==='create'){
    // A folder subjects already use but the list does not hold yet is simply added to the list (so it keeps a place when emptied).
    if(list.some(f=>key(f)===key(target)))fail('There is already a folder '+target.join(' / ')+'.',409);
    for(let depth=1;depth<=target.length;depth++){const f=target.slice(0,depth);if(!after.some(x=>key(x)===key(f)))after.push(f);}
    if(after.length>MAX_FOLDERS)fail('The folder list is full ('+MAX_FOLDERS+').',409);
   }else if(input.action==='rename'){
    if(!inView.has(key(target)))fail('There is no folder '+target.join(' / ')+'.',404);
    const renamed=[...target.slice(0,-1),folderName(input.name)];
    if(key(renamed)===key(target))fail('That is already its name.');
    if(inView.has(key(renamed)))fail('There is already a folder '+renamed.join(' / ')+'.',409);
    const swap=f=>within(f,target)?[...renamed,...f.slice(target.length)]:f;
    after=after.map(swap);
    for(const p of places)if(within(p.folder,target))moved.push({place:p,from:p.folder,to:swap(p.folder)});
   }else if(input.action==='reorder'){
    if(!Array.isArray(input.order))fail('order lists every saved folder path in its new order.');
    const order=input.order.map(cleanFolder),keys=order.map(key);
    if(order.length!==list.length||new Set(keys).size!==keys.length||keys.some(k=>!list.some(f=>key(f)===k)))fail('order must list every saved folder exactly once.',409);
    after=order;
   }else if(input.action==='remove'){
    if(!list.some(f=>key(f)===key(target)))fail(inView.has(key(target))?'Subjects are filed in '+target.join(' / ')+'. Move them out first.':'There is no folder '+target.join(' / ')+'.',inView.has(key(target))?409:404);
    if(places.some(p=>within(p.folder,target)))fail('Subjects are filed in '+target.join(' / ')+'. Move them out first; a folder is removed only when it is empty.',409);
    if(list.some(f=>f.length>target.length&&within(f,target)))fail('Remove the folders inside '+target.join(' / ')+' first.',409);
    after=after.filter(f=>key(f)!==key(target));
   }else{
    const last=saved.operations[0];
    if(!last||last.action==='undo'||last.operationId!==input.undoOperationId||stableJson(last.after)!==stableJson(list))fail('Undo takes back only the last folder change, while nothing has changed since.',409);
    for(const m of last.moved||[]){const now=load(m.parentStudyId);if(now.revision!==m.revision||key(now.folder)!==key(m.to))fail('A subject that change moved has changed since. Nothing was undone.',409);moved.push({place:now,from:m.to,to:m.from});}
    after=last.before.map(f=>[...f]);
   }
   const revision=saved.revision+1,actor=actorNow(),at=new Date().toISOString();
   const receipts=moved.map(m=>{const written=commitPlace(m.place,{...content(m.place),folder:m.to},input,input.action==='undo'?'folder change undone':'folder renamed',{held:['folder']});return {parentStudyId:written.parentStudyId,from:m.from,to:m.to,revision:written.revision};});
   const op={operationId:input.operationId,action:input.action,fingerprint:print,resultRevision:revision,actor,client:clientNow(),at,before:list,after,...(receipts.length?{moved:receipts}:{})};
   atomicWrite(foldersFile(),JSON.stringify({schema:FOLDERS,revision,folders:after.map(f=>({path:f})),updatedAt:at,updatedBy:actor,operations:[op,...saved.operations].slice(0,KEEP_FOLDER_OPS)},null,1)+'\n');
   return {...foldersView(),receipt:{operationId:op.operationId,action:op.action,resultRevision:revision,...(receipts.length?{moved:receipts}:{})}};
  });
 }
 return {read,save,carry,reorder,readFolders,changeFolders};
}

const instances=new Map();
/** One owner per data folder, so every door shares the same queue. */
export function sharedSubjectPlaces({dataDir}){if(!instances.has(dataDir))instances.set(dataDir,createSubjectPlaces({dataDir}));return instances.get(dataDir);}

const PREFIX='/api/subject-places';
/** One registration line in the server hands requests here; returns false for any other path. */
export async function handleSubjectPlaces(request,response,{dataDir,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid');
 if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))return false;
 const places=sharedSubjectPlaces({dataDir});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 try{
  const route=url.pathname.slice(PREFIX.length),reads={'':input=>places.read(input),'/folders':input=>places.readFolders(input)},writes={'/save':i=>places.save(i),'/carry':i=>places.carry(i),'/reorder':i=>places.reorder(i),'/folders':i=>places.changeFolders(i)};
  if(!Object.hasOwn(reads,route)&&!Object.hasOwn(writes,route))fail('Unknown subject place action.',404);
  if(request.method==='GET'){
   if(!Object.hasOwn(reads,route)){response.setHeader('Allow','POST');fail('Use POST.',405);}
   const query=Object.fromEntries(url.searchParams);if([...url.searchParams.keys()].length!==Object.keys(query).length)fail('Name each field once.');
   return send(200,await reads[route](query)),true;
  }
  if(request.method!=='POST'||!Object.hasOwn(writes,route)){response.setHeader('Allow',Object.hasOwn(writes,route)?(Object.hasOwn(reads,route)?'GET, POST':'POST'):'GET');fail('This action takes '+(Object.hasOwn(writes,route)?'POST':'GET')+'.',405);}
  checkWrite?.();requireWriteActor();
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('That request is too large.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the request as JSON.');}
  const i=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  // The journal and change notices: one subject's place is that project's record; a reorder or a folder change is the Home list's.
  request.arInput={operationId:i.operationId,...(Number.isSafeInteger(i.expectedRevision)?{expectedRevision:i.expectedRevision}:{}),...(typeof i.expectedHash==='string'?{expectedHash:i.expectedHash}:{}),
   ...(route==='/save'||route==='/carry'?(typeof i.parentStudyId==='string'?{parentStudyId:i.parentStudyId}:{}):{scope:{kind:'subjects',id:route==='/folders'?'folders':'places'}})};
  // A carry-over is an import from the browser's own storage, whoever's page carried it; the record keeps who that was.
  if(route==='/carry'&&request.arActor)request.arActor={...request.arActor,actor:IMPORT_ACTOR};
  send(200,await writes[route](input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The subject\'s place could not be read or saved. Nothing was changed.'});}
 return true;
}
