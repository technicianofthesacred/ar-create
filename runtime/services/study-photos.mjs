import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const PHOTO_LIMIT=20*1024*1024;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const PHOTO_PREVIEW_KEYS=['projectId','documentId','bindingId','parentStudyId','sourceId','expectedHash'];
export function studyPhotoPreviewInput(url){if([...url.searchParams.keys()].some(key=>!PHOTO_PREVIEW_KEYS.includes(key))||PHOTO_PREVIEW_KEYS.some(key=>url.searchParams.getAll(key).length!==1))fail('Use one exact saved photograph preview identity.');return Object.fromEntries(PHOTO_PREVIEW_KEYS.map(key=>[key,url.searchParams.get(key)]));}
const previewURL=(scope,sourceId,expectedHash)=>'/api/study/photos/preview?'+new URLSearchParams({...scope,sourceId,expectedHash});
const stamp=stat=>[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs,stat.nlink].join(':');
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function image(bytes,name){
 if(typeof name!=='string'||!name||name.includes('\\')||name.startsWith('.')||/[\x00-\x1f\x7f]/.test(name))fail('Use a plain photograph filename.');if(name.includes('/')||name.length>240)fail('Use a plain photograph filename.');
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>PHOTO_LIMIT)fail('Photographs must be under 20 MB.',413);
 const ext=path.extname(name).toLowerCase();
 const jpeg=['.jpg','.jpeg'].includes(ext)&&bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=ext==='.png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR';
 const webp=ext==='.webp'&&bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!jpeg&&!png&&!webp)fail('Add a JPEG, PNG or WebP photograph with matching image bytes.',415);
 return jpeg?'image/jpeg':png?'image/png':'image/webp';
}
function photoBytes(source){
 const pathname=source.path,canonical=fs.realpathSync(pathname),before=fs.lstatSync(pathname);let fd;
 const regular=stat=>stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=PHOTO_LIMIT;
 if(!regular(before)||fs.realpathSync(pathname)!==canonical)fail('Photograph is unavailable or exceeds 20 MB.',413);
 try{
  fd=fs.openSync(canonical,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const opened=fs.fstatSync(fd);
  if(!regular(opened)||stamp(opened)!==stamp(before))fail('Photograph was replaced before reading. Refresh before previewing.',409);
  const bytes=Buffer.alloc(opened.size);let used=0;
  while(used<bytes.length){const count=fs.readSync(fd,bytes,used,bytes.length-used,used);if(!count)break;used+=count;}
  const after=fs.fstatSync(fd),current=fs.lstatSync(pathname);
  if(used!==bytes.length||!regular(after)||!regular(current)||stamp(after)!==stamp(opened)||stamp(current)!==stamp(opened)||fs.realpathSync(pathname)!==canonical||hash(bytes)!==source.hash)fail('Photograph changed during reading. Refresh before previewing.',409);
  return {bytes,mimeType:image(bytes,path.basename(source.rel_path))};
 }finally{if(fd!==undefined)fs.closeSync(fd);}
}
const text=(value,label,max)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))fail(label+' is too long or contains control characters.');return value;};
// This service receives stable study binding IDs; it never discovers by title or active piece.
export function createStudyPhotos({dataDir,library,resolveBinding,runtime}){
 if(typeof resolveBinding!=='function')throw Error('A trusted persisted study binding resolver is required.');
 const {atomicWrite,readJson,ensurePrivateDirectory}=runtime||{};
 if(![atomicWrite,readJson,ensurePrivateDirectory].every(fn=>typeof fn==='function'))throw Error('Existing runtime file helpers are required.');
 async function authorize(input){fileFor(input);const bound=await resolveBinding(input.projectId);if(!bound||bound.projectId!==input.projectId||bound.documentId!==input.documentId)fail('Unknown or mismatched persisted study binding.',403);return bound;}
 const dir=ensurePrivateDirectory(dataDir,'study-photos');let queue=Promise.resolve();
 const serial=fn=>{const op=queue.then(fn);queue=op.catch(()=>{});return op;};
 function fileFor({projectId,documentId}){if(!uuid.test(projectId||'')||!uuid.test(documentId||''))fail('A bound project and document are required.');return path.join(dir,hash(projectId)+'.json');}
 function load(input){const file=fileFor(input),record=readJson(file,null);if(record&&record.documentId!==input.documentId)fail('The project document binding changed.',409);return {file,record};}
 function persist(file,record){atomicWrite(file,JSON.stringify(record,null,2)+'\n');}
 async function owned(sourceId){const {file,source}=await library.blob(sourceId);if(source.rootId!=='library'||source.writable!==true)fail('Choose an owned library photograph. Connected originals remain unchanged.',403);const stat=fs.lstatSync(file);if(stat.size>PHOTO_LIMIT)fail('Photograph exceeds 20 MB.',413);const bytes=fs.readFileSync(file);return {...source,mimeType:image(bytes,path.basename(file)),sha256:hash(bytes)};}
 async function ensure(input){await authorize(input);let {file,record}=load(input);if(!record){const tree=await library.tree(),saved=await library.saveCollection({name:'Study photographs',sourceIds:[],expectedRevision:tree.revision});record={schema:'ar-create.study-photos.v1',projectId:input.projectId,documentId:input.documentId,collectionId:saved.collection.id,revision:0,photos:[]};persist(file,record);}return {file,record};}
 async function view(record){const tree=await library.tree(),collection=tree.collections.find(c=>c.id===record.collectionId);if(!collection)fail('The bound photo collection is missing; its binding is preserved.',409);const photos=[];for(const row of record.photos){try{const source=await owned(row.sourceId);photos.push({...row,name:path.basename(source.rel_path),url:'/api/sources/blob?id='+encodeURIComponent(row.sourceId),mimeType:source.mimeType,missing:false});}catch(error){photos.push({...row,missing:true,error:error.message});}}return {...record,photos,collectionName:collection.name};}
 // Inspection must not call ensure(), Library discovery/tree(), or blob(): those
 // authoring paths may create a collection or persist deferred Library hashes.
 async function inspect(input,selectedSourceId=null){
  const keys=['projectId','documentId','bindingId','parentStudyId'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(input,k))||!uuid.test(input.bindingId||'')||typeof input.parentStudyId!=='string'||!input.parentStudyId.trim()||input.parentStudyId.length>256||/[\x00-\x1f\x7f]/.test(input.parentStudyId))fail('Use the exact persisted photo project, document, manuscript and parent study.');
  const exact=async()=>{const bound=await authorize(input);if(bound.authority!=='owned-working-copy'||bound.bindingId!==input.bindingId||bound.ownedDraftId!==input.bindingId||bound.parentStudyId!==input.parentStudyId||bound.key!=='owned-draft:'+input.bindingId)fail('The photo collection belongs to another exact manuscript or parent study.',409);};
  await exact();const {record}=load(input),before=JSON.stringify(record),base={...input,readOnly:true};
  const unchanged=async()=>{await exact();if(JSON.stringify(load(input).record)!==before)fail('The photo collection changed during inspection. Refresh before reading.',409);};
  if(!record){await unchanged();return {...base,state:'not-created',collectionId:null,revision:null,photos:[]};}
  if(record.schema!=='ar-create.study-photos.v1'||record.projectId!==input.projectId||record.documentId!==input.documentId||!uuid.test(record.collectionId||'')||!Number.isSafeInteger(record.revision)||record.revision<0||!Array.isArray(record.photos)||record.photos.length>200||new Set(record.photos.map(p=>p?.sourceId)).size!==record.photos.length||record.photos.some(p=>!p||!uuid.test(p.sourceId||'')||typeof p.selected!=='boolean'||typeof p.caption!=='string'||typeof p.credit!=='string'))fail('The saved photo collection needs recovery; its details remain unchanged.',409);
  if(typeof library.collectionsSnapshot!=='function'||typeof library.snapshot!=='function')fail('Pure photo inspection is unavailable from the Library owner.',503);
  const index=await library.collectionsSnapshot(),matches=index.collections.filter(c=>c.id===record.collectionId);
  if(matches.length>1)fail('The exact saved photo collection is ambiguous.',409);
  const collection=matches[0],photos=[];
  for(const row of record.photos){
   const retained={...row,url:null,previewUnavailable:true,previewReason:'Original preview is unavailable in this read-only review.'};
   if(!collection){photos.push({...retained,missing:true,error:'The saved Library collection is missing; photo details are retained.'});continue;}
   if(!Array.isArray(collection.sourceIds)||!collection.sourceIds.includes(row.sourceId))fail('Saved photograph membership changed. Refresh before reading.',409);
   if(selectedSourceId&&row.sourceId!==selectedSourceId){photos.push(retained);continue;}
   try{const source=await library.snapshot(row.sourceId);if(source.id!==row.sourceId||source.rootId!=='library'||source.writable!==true)fail('This photograph no longer has its exact owned Library identity.',409);const {mimeType}=photoBytes(source);photos.push({...retained,name:path.basename(source.rel_path),mimeType,sha256:source.hash,missing:false,url:previewURL(input,row.sourceId,source.hash),previewUnavailable:false,previewReason:null});}
   catch(error){if(error.status===409)throw error;photos.push({...retained,missing:true,error:error.message});}
  }
  const latest=await library.collectionsSnapshot();if(latest.indexHash!==index.indexHash||latest.revision!==index.revision)fail('The Library photo collection changed during inspection. Refresh before reading.',409);
  await unchanged();return {...record,...base,state:collection?'ready':'collection-missing',collectionName:collection?.name??null,photos};
 }
 async function preview(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==PHOTO_PREVIEW_KEYS.length||PHOTO_PREVIEW_KEYS.some(key=>!Object.hasOwn(input,key))||!uuid.test(input.sourceId||'')||typeof input.expectedHash!=='string'||!(/^[a-f0-9]{64}$/).test(input.expectedHash))fail('Use the exact saved photograph and expected hash.');
  if(typeof library.collectionsSnapshot!=='function'||typeof library.snapshot!=='function')fail('Pure photo inspection is unavailable from the Library owner.',503);
  const scope=Object.fromEntries(PHOTO_PREVIEW_KEYS.slice(0,4).map(key=>[key,input[key]])),indexBefore=await library.collectionsSnapshot(),before=await inspect(scope,input.sourceId),photo=before.photos.find(p=>p.sourceId===input.sourceId);
  if(before.state!=='ready'||!photo||photo.missing||photo.previewUnavailable)fail('The exact saved photograph is unavailable in this manuscript.',404);
  if(photo.sha256!==input.expectedHash)fail('Photograph changed. Refresh its exact saved preview.',409);
  const source=await library.snapshot(input.sourceId);
  if(source.id!==input.sourceId||source.rootId!=='library'||source.writable!==true||source.hash!==input.expectedHash)fail('The photograph source identity or hash changed. Refresh before previewing.',409);
  const result=photoBytes(source),after=await inspect(scope,input.sourceId),indexAfter=await library.collectionsSnapshot();
  if(JSON.stringify(after)!==JSON.stringify(before)||indexBefore.indexHash!==indexAfter.indexHash||indexBefore.revision!==indexAfter.revision)fail('The saved photograph collection changed before previewing. Refresh before reading.',409);
  return {bytes:result.bytes,contentType:result.mimeType,contentLength:result.bytes.length,hash:input.expectedHash};
 }
 function revision(record,input){if(input.expectedRevision!==record.revision)fail('Photographs changed. Refresh before saving.',409);}
 return {
  preview:input=>{const captured=structuredClone(input);return serial(()=>preview(captured));},
  inspect:input=>{const captured=structuredClone(input);return serial(()=>inspect(captured));},
  list:input=>serial(async()=>view((await ensure(input)).record)),
  available:input=>serial(async()=>{await authorize(input);load(input);const tree=await library.tree();return {collections:tree.collections.map(c=>({id:c.id,name:c.name,sourceIds:c.sourceIds})),photos:tree.sources.filter(s=>s.rootId==='library'&&/\.(jpe?g|png|webp)$/i.test(s.rel_path)).map(s=>({sourceId:s.id,name:path.basename(s.rel_path),url:'/api/sources/blob?id='+encodeURIComponent(s.id)}))};}),
  add:input=>serial(async()=>{const {file,record}=await ensure(input);revision(record,input);if(record.photos.length>=200)fail('This collection holds at most 200 photographs.',413);let source;
   if(input.sourceId)source=await owned(input.sourceId);
   else{if(typeof input.base64!=='string'||input.base64.length>Math.ceil(PHOTO_LIMIT/3)*4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64))fail('Invalid or oversized image bytes.',413);const bytes=Buffer.from(input.base64,'base64');image(bytes,input.name);source=await library.retainAlbumPhoto({folder:'Projects/'+record.projectId+'/Photos',name:input.name,bytes,provenance:{kind:'study-photo-upload',projectId:record.projectId,documentId:record.documentId}});}
   if(record.photos.some(p=>p.sourceId===source.id))return view(record);
   const tree=await library.tree(),collection=tree.collections.find(c=>c.id===record.collectionId);if(!collection)fail('Bound photo collection missing.',409);await library.saveCollection({id:collection.id,name:collection.name,sourceIds:[...new Set([...collection.sourceIds,source.id])],expectedRevision:tree.revision});record.photos.push({sourceId:source.id,selected:true,caption:'',credit:''});record.revision++;persist(file,record);return view(record);
  }),
  update:input=>serial(async()=>{const {file,record}=await ensure(input);revision(record,input);const row=record.photos.find(p=>p.sourceId===input.sourceId);if(!row)fail('Photograph is not in this project.',404);if(typeof input.selected!=='boolean')fail('Selection must be explicit.');row.selected=input.selected;row.caption=text(input.caption,'Caption',2000);row.credit=text(input.credit,'Credit',300);record.revision++;persist(file,record);return view(record);})
 };
}
// Insert only these route entries into the existing authenticated local API table.
export function studyPhotoRoutes(service,url){const binding={projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId')};return {
 '/api/study/photos/preview':{GET:()=>service.preview(studyPhotoPreviewInput(url))},
 '/api/study/photos/inspect':{GET:()=>service.inspect({...binding,bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})},
 '/api/study/photos':{GET:()=>service.list(binding)},
 '/api/study/photos/available':{GET:()=>service.available(binding)},
 '/api/study/photos/add':{POST:input=>service.add(input)},
 '/api/study/photos/update':{POST:input=>service.update(input)}
};}
// Read the existing study-bindings registry without selecting/switching a piece.
// Authority is a ready persisted binding AND the exact recorded live piece/document.
export function createPersistedStudyPhotoBindingResolver({dataDir,store,runtime}){
 const {readJson,ensurePrivateDirectory}=runtime;
 return async projectId=>{
  if(!uuid.test(projectId||''))return null;
  const dir=ensurePrivateDirectory(dataDir,'study-project-bindings');
  const matches=fs.readdirSync(dir).filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).map(name=>readJson(path.join(dir,name),null)).filter(row=>row?.schema==='ar-create.study-binding.v1'&&row.status==='ready'&&row.projectId===projectId);
  if(matches.length!==1)return null;
  const bound=matches[0],{pieces}=await store.listPieces();
  const piece=pieces.find(row=>row.id===bound.projectId&&row.documentId===bound.documentId);
  return piece?{projectId:bound.projectId,documentId:bound.documentId}:null;
 };
}
