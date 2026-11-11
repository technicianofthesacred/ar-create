// Looks: a brand's colours, type, logo, marks and rules, kept as a DESIGN.md in one folder per look.
//
// Shipped starting looks live in the repository (editorial/looks/<id>/). What Adrian or an assistant makes or changes
// lives in the home's data (data/looks/<id>/: DESIGN.md, its asset files, and look.json with the revision, who saved it
// and the last operations). A home look wins over the shipped look with the same id. Every save is checked against the
// revision and hash that were read, stamped with its actor, and journaled by the server like every other command.
//
// Mount: one registration line in runtime/server.mjs hands requests here and returns false for any other path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {StateError} from '../store.mjs';
import {currentActor,requireWriteActor} from './actor.mjs';
import {atomicWrite,ensurePrivateDirectory,regular} from './files.mjs';
import {readDesign,resolveSlides,proposeSlides,withSlides,readAssets,withAssets,MAX_DESIGN_BYTES,MAX_LOOK_ASSETS} from './look-design-md.mjs';
import {cleanSvg} from './svg-clean.mjs';
import {ASSET_KINDS,ASSET_ID} from '../src/donors/mag/carousel/ig-look-render.mjs';

export const SHIPPED_LOOKS=fileURLToPath(new URL('../../editorial/looks/',import.meta.url));
/** The look an Instagram plan draws in when it names none: its door's. */
export const DOOR_LOOKS=Object.freeze({teajia:'teajia',art:'art','mandala-codes':'mandala-codes',personal:'personal'});
export const DEFAULT_LOOK='teajia';
const SCHEMA='ar-create.look.v1',ID=/^[a-z0-9][a-z0-9-]{0,40}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const ASSET=/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(?:png|jpe?g|webp|svg)$/,MAX_ASSET=2*1024*1024,MAX_ASSETS=8;
const TYPES={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'};
const fail=(message,status=400)=>{throw new StateError(message,status);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const typeOf=name=>TYPES[name.split('.').pop().toLowerCase()];
// The first bytes each image type starts with; a file that says png must be one.
const looksLike=(name,bytes)=>({'image/png':b=>b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),'image/jpeg':b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff,'image/webp':b=>b.subarray(0,4).toString('latin1')==='RIFF'&&b.subarray(8,12).toString('latin1')==='WEBP','image/svg+xml':()=>true})[typeOf(name)](bytes);
export const assetUrl=(id,file)=>'/api/look/asset?'+new URLSearchParams({id,file});
export const checkLookId=id=>{if(typeof id!=='string'||!ID.test(id))fail('A look id is lower-case letters, digits and dashes, like art or mandala-codes.');return id;};
export const slug=name=>String(name||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'look';

export function createLooks({dataDir,shippedDir=SHIPPED_LOOKS}={}){
 if(!dataDir)throw Error('Looks need the data folder.');
 const homeDir=id=>path.join(dataDir,'looks',id),shipDir=id=>path.join(shippedDir,id);
 const queues=new Map(),serial=(id,fn)=>{const run=(queues.get(id)||Promise.resolve()).then(fn,fn);queues.set(id,run.catch(()=>{}));return run;};
 const readText=file=>{try{regular(file);return fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT'||error.status===404)return null;throw error;}};
 const filesIn=dir=>{try{return fs.readdirSync(dir).filter(n=>ASSET.test(n)&&fs.lstatSync(path.join(dir,n)).isFile()).sort();}catch{return [];}};
 const meta=id=>{try{return JSON.parse(fs.readFileSync(path.join(homeDir(id),'look.json'),'utf8'));}catch{return null;}};
 const hashOf=(text,assets)=>digest(JSON.stringify({text,assets:assets.map(a=>[a.name,a.sha256])}));
 /** One look as it stands: the home copy if there is one, else the shipped copy. Null when neither exists. */
 function load(id){
  checkLookId(id);
  const homeText=readText(path.join(homeDir(id),'DESIGN.md')),shipText=readText(path.join(shipDir(id),'DESIGN.md'));
  if(homeText===null&&shipText===null)return null;
  const home=homeText!==null,text=home?homeText:shipText,m=home?meta(id):null;
  // A home look may name files from its shipped folder too; its own win.
  const names=new Map();for(const n of filesIn(shipDir(id)))names.set(n,path.join(shipDir(id),n));if(home)for(const n of filesIn(homeDir(id)))names.set(n,path.join(homeDir(id),n));
  const assets=[...names].map(([name,file])=>({name,url:assetUrl(id,name),type:typeOf(name),bytes:fs.statSync(file).size,sha256:digest(fs.readFileSync(file)),from:file.startsWith(homeDir(id))?'home':'shipped'}));
  return {id,text,home,shipped:shipText!==null,assets,files:names,revision:m?.revision||0,updatedBy:m?.updatedBy||null,updatedAt:m?.updatedAt||null,operations:m?.operations||[],hash:hashOf(text,assets)};
 }
 const ids=()=>{const seen=new Set();for(const dir of [shippedDir,path.join(dataDir,'looks')])try{for(const n of fs.readdirSync(dir))if(ID.test(n)&&fs.existsSync(path.join(dir,n,'DESIGN.md')))seen.add(n);}catch{}return [...seen].sort();};
 function describe(l){
  let doc={},body='',problems=[],roles=null;
  try{({doc,body}=readDesign(l.text));({roles,problems}=resolveSlides(doc,{id:l.id,assetUrl:f=>assetUrl(l.id,f)}));}catch(error){problems=[error.message];}
  if(roles)for(const t of ['dark','light']){const v=roles.logo[t];if(v&&!v.startsWith('/api/look/asset?')&&!v.startsWith('/'))problems.push('The '+t+' logo is not a file this look has.');
   const file=v?.startsWith('/api/look/asset?')?new URLSearchParams(v.split('?')[1]).get('file'):null;if(file&&!l.files.has(file)){problems.push('The '+t+' logo names '+file+', which is not in this look\'s folder.');}}
  if(roles&&l.id!=='teajia'&&[roles.logo.dark,roles.logo.light].some(v=>/teajia-wordmark/i.test(v)))problems.push('The teajiā wordmark belongs to Teajia; give this look its own logo file, or leave the logo empty for its name.');
  // The assets: block: what can be placed on a slide in this look. A problem there is reported; it never stops the look drawing.
  let placeable=[],assetProblems=[];
  try{({assets:placeable,problems:assetProblems}=readAssets(doc,{id:l.id,hasFile:f=>l.files.has(f),assetUrl:f=>assetUrl(l.id,f)}));}catch(error){assetProblems=[error.message];}
  if(problems.length)roles=null;
  if(roles)roles.assets=Object.fromEntries(placeable.map(a=>[a.id,a]));
  const wanted=roles?Object.entries(roles.fonts).filter(([,f])=>f.wanted).map(([role,f])=>({role,wanted:f.wanted,drawnIn:f.family})):[];
  return {id:l.id,name:String(doc.name||l.id),description:typeof doc.description==='string'?doc.description.trim():'',source:l.home?(l.shipped?'home, changing the shipped look':'home'):'shipped',
   revision:l.revision,hash:l.hash,updatedBy:l.updatedBy,updatedAt:l.updatedAt,drawable:!!roles,problems,wanted,roles,placeable,assetProblems,assets:l.assets.map(({name,url,type,bytes,from})=>({name,url,type,bytes,from})),body};
 }
 async function list(){return {looks:ids().map(id=>{const {roles,body,placeable,...rest}=describe(load(id));return rest;}),doors:DOOR_LOOKS};}
 async function read({id}={}){const l=load(checkLookId(id));if(!l)fail('No look has that id.',404);const {body,...rest}=describe(l);return {...rest,text:l.text,operations:l.operations.slice(0,20)};}
 /** The resolved roles a renderer draws with; refuses a look that cannot be drawn. */
 function roles(id){const l=load(checkLookId(id));if(!l)fail('No look has the id '+id+'.',404);const d=describe(l);if(!d.roles)fail('The '+d.name+' look cannot be drawn yet: '+d.problems.join(' '),422);return d.roles;}
 /** A file of a look, for the page and the renderer: {bytes, type}. */
 function asset({id,file}={}){const l=load(checkLookId(id));if(!l||typeof file!=='string'||!l.files.has(file))fail('That look has no such file.',404);const at=l.files.get(file);regular(at);return {bytes:fs.readFileSync(at),type:typeOf(file)};}

 /**
  * Save a look to the home. {id, operationId, text (the whole DESIGN.md), assets?:[{name, base64}], expectedRevision,
  * expectedHash} (the expected pair is needed when the look already exists, shipped or home). The DESIGN.md must have
  * a slides: block that can be drawn. Owner or assistant; the actor is stamped and the server journals the write.
  */
 async function save(input){
  requireWriteActor();
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  const id=checkLookId(input.id);
  if(!UUID.test(input.operationId||''))fail('Every write needs a fresh operationId (a UUID).');
  if(typeof input.text!=='string'||!input.text.trim())fail('Send the whole DESIGN.md as text.');
  if(Buffer.byteLength(input.text)>MAX_DESIGN_BYTES)fail('A DESIGN.md is at most '+MAX_DESIGN_BYTES/1024+' KB.',413);
  const incoming=(input.assets??[]);if(!Array.isArray(incoming)||incoming.length>MAX_ASSETS)fail('assets is a list of up to '+MAX_ASSETS+' files.');
  const files=incoming.map(a=>{if(!a||typeof a.name!=='string'||!ASSET.test(a.name))fail('An asset is {name, base64}, named like logo-dark.png (png, jpg or webp).');if(typeof a.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(a.base64))fail(a.name+': send the file as base64.');
   let bytes=Buffer.from(a.base64,'base64');if(!bytes.length||bytes.length>MAX_ASSET)fail(a.name+' must be a file of up to 2 MB.',413);if(!looksLike(a.name,bytes))fail(a.name+' is not the image its name says.',415);
   // An SVG is kept only once it is made safe: no scripts, event handlers, embedded pages or outside references.
   if(typeOf(a.name)==='image/svg+xml')bytes=cleanSvg(bytes).bytes;
   return {name:a.name,bytes};});
  if(new Set(files.map(f=>f.name)).size!==files.length)fail('Two assets have the same name.');
  return serial(id,async()=>{
   const before=load(id),actor=currentActor()?.actor||'';
   if(before?.operations.some(o=>o.operationId===input.operationId))return read({id});
   if(before&&(input.expectedRevision!==before.revision||input.expectedHash!==before.hash)){
    if(!Number.isSafeInteger(input.expectedRevision)||!HASH.test(input.expectedHash||''))fail('This look exists. Read it and send its expectedRevision and expectedHash.');
    fail('This look changed since you read it. Read it again; nothing was overwritten.',409);
   }
   // Check the result before anything is written: it must be a DESIGN.md this app can draw, and its logo files present.
   const names=new Map(before?.files||[]);for(const f of files)names.set(f.name,'(new)');
   const trial=describe({id,text:input.text,home:true,shipped:!!before?.shipped,assets:[],files:names,revision:0,operations:[]});
   if(!trial.roles)throw Object.assign(new StateError('This look cannot be drawn yet: '+trial.problems.join(' '),422),{problems:trial.problems});
   if(trial.assetProblems.length)throw Object.assign(new StateError('This look\'s assets: block has problems: '+trial.assetProblems.join(' '),422),{problems:trial.assetProblems});
   const dir=ensurePrivateDirectory(dataDir,path.join('looks',id));
   for(const f of files)atomicWrite(path.join(dir,f.name),f.bytes);
   atomicWrite(path.join(dir,'DESIGN.md'),input.text);
   const revision=(before?.revision||0)+1,at=new Date().toISOString(),what=before?(before.home?'change':'change the shipped look'):'new look';
   const record={schema:SCHEMA,id,revision,updatedBy:actor,updatedAt:at,operations:[{operationId:input.operationId,revision,actor,what:what+(files.length?' with '+files.map(f=>f.name).join(', '):''),at},...(before?.operations||[])].slice(0,80)};
   atomicWrite(path.join(dir,'look.json'),JSON.stringify(record,null,1)+'\n');
   // The server journals the write and announces it to watchers, like every other command.
   return read({id});
  });
 }

 /**
  * Propose a look from a DESIGN.md: given as text, or as a path to a file inside the home's own folders. Never fetches
  * from the network. The file is kept whole; a slides: block is added when it has none (by token name where the names
  * are clear, else by lightness and contrast) and every guess is reported. Nothing is saved: save the returned text
  * with look.save when it is right.
  */
 async function propose(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  let text=input.text,from='text';
  if(text===undefined){
   const p=input.path;
   if(typeof p!=='string'||!p)fail('Send the DESIGN.md as text, or a path to it inside AR Create\'s home folder.');
   if(/^[a-z][a-z0-9+.-]*:\/\//i.test(p))fail('Looks are never fetched from the network. Paste the DESIGN.md text instead.');
   if(!path.isAbsolute(p))fail('Give the full path to the DESIGN.md.');
   const home=path.dirname(path.resolve(dataDir));let real;
   try{real=fs.realpathSync(p);}catch{fail('No file is at that path.',404);}
   const root=fs.realpathSync(home);
   if(real!==p&&fs.lstatSync(p).isSymbolicLink())fail('Linked files are not read; give the file itself.',403);
   if(!real.startsWith(root+path.sep))fail('Only a DESIGN.md inside AR Create\'s home folder can be read by path. Paste anything else as text.',403);
   if(!/\.md$/i.test(real))fail('A look is read from a .md file.');
   const stat=regular(real);if(stat.size>MAX_DESIGN_BYTES)fail('A DESIGN.md is at most '+MAX_DESIGN_BYTES/1024+' KB.',413);
   text=fs.readFileSync(real,'utf8');from='path';
  }
  if(typeof text!=='string'||!text.trim())fail('The DESIGN.md is empty.');
  const {doc}=readDesign(text);
  const id=input.id===undefined?slug(doc.name):checkLookId(input.id);
  let guesses=[],kept=false,out=text;
  if(doc.slides&&typeof doc.slides==='object'){kept=true;}
  else{const p=proposeSlides(doc);guesses=p.guesses;out=withSlides(text,p.slides,['Proposed by AR Create\'s look import. Check each guess below, then save.',...guesses.map(g=>'- '+g.role+': '+g.why.replace(/\s+/g,' '))]);}
  const existing=load(id),d=describe({id,text:out,home:false,shipped:false,assets:[],files:existing?.files||new Map(),revision:0,operations:[]});
  return {id,name:d.name,from,text:out,keptOwnSlides:kept,guesses,roles:d.roles,problems:d.problems,wanted:d.wanted,
   existing:existing?{revision:existing.revision,hash:existing.hash,source:existing.home?'home':'shipped'}:null,
   next:existing?'Save it with look.save, sending id, text, operationId and the existing revision and hash.':'Save it with look.save, sending id, text and a fresh operationId.'};
 }
 /** What can be placed on a slide in a look: its assets: block, resolved, with any problems. */
 async function assets({id}={}){const l=load(checkLookId(id));if(!l)fail('No look has that id.',404);const d=describe(l);return {id:d.id,name:d.name,revision:d.revision,hash:d.hash,assets:d.placeable,problems:d.assetProblems};}
 /**
  * Add a mark, graphic or logo to a look: {id, operationId, expectedRevision, expectedHash, asset:{id, name, kind, file,
  * base64}} (a png, or an svg made safe), or {..., asset:{id, name, kind:'mark', text}} for a mark drawn from characters.
  * The file goes into the look's folder in the home and the asset into its DESIGN.md's assets: block, through look.save,
  * so it has the same revision check, actor stamp and journal line. A shipped look becomes a home copy.
  */
 async function addAsset(input){
  requireWriteActor();
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a JSON object.');
  const id=checkLookId(input.id),a=input.asset;
  if(!a||typeof a!=='object'||Array.isArray(a))fail('Send the asset: {id, name, kind, file, base64} or, for a mark of characters, {id, name, kind: mark, text}.');
  if(typeof a.id!=='string'||!ASSET_ID.test(a.id))fail('An asset id is lower-case letters, digits and dashes, like seal-home.');
  if(!ASSET_KINDS.includes(a.kind))fail('An asset is a '+ASSET_KINDS.join(', ')+'.');
  const l=load(id);if(!l)fail('No look has that id.',404);
  let doc;try{({doc}=readDesign(l.text));}catch(error){fail('This look\'s DESIGN.md cannot be read: '+error.message,422);}
  const current=readAssets(doc,{id,hasFile:f=>l.files.has(f),assetUrl:f=>assetUrl(id,f)}).assets;
  if(current.some(x=>x.id===a.id))fail('The '+id+' look already has an asset '+a.id+'. Choose another id.',409);
  if(current.length>=MAX_LOOK_ASSETS)fail('A look lists up to '+MAX_LOOK_ASSETS+' assets.');
  let files=[],entry={id:a.id,name:a.name,kind:a.kind};
  if(a.text!==undefined){if(a.base64!==undefined||a.file!==undefined)fail('A mark of characters has text and no file.');entry.text=a.text;}
  else{
   if(typeof a.file!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(?:png|svg)$/.test(a.file))fail('The file is named like seal.png or mark.svg (png or svg).');
   if(l.files.has(a.file))fail('The '+id+' look already has a file '+a.file+'. Name it differently.',409);
   files=[{name:a.file,base64:a.base64}];entry.file=a.file;
  }
  const text=withAssets(l.text,[...current.map(({src,...x})=>x),entry]);
  return save({id,operationId:input.operationId,text,assets:files,expectedRevision:input.expectedRevision,expectedHash:input.expectedHash});
 }
 return {list,read,roles,asset,save,propose,load,ids,assets,addAsset};
}

const instances=new Map();
export function sharedLooks({dataDir}){let found=instances.get(dataDir);if(!found){found=createLooks({dataDir});instances.set(dataDir,found);}return found;}

/** /api/looks, /api/look, /api/look/asset, /api/look/save and /api/look/import. */
export async function handleLooks(request,response,{dataDir,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid'),route=url.pathname;
 if(route!=='/api/looks'&&route!=='/api/look'&&!route.startsWith('/api/look/'))return false;
 const looks=sharedLooks({dataDir});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 const only=keys=>{const extra=[...url.searchParams.keys()].find(k=>!keys.includes(k));if(extra)fail('Unknown query field: '+extra+'.');};
 try{
  const GET={'/api/looks':()=>{only([]);return looks.list();},'/api/look':()=>{only(['id']);return looks.read({id:url.searchParams.get('id')});},'/api/look/assets':()=>{only(['id']);return looks.assets({id:url.searchParams.get('id')});}};
  const POST={'/api/look/save':i=>looks.save(i),'/api/look/import':i=>looks.propose(i),'/api/look/asset/add':i=>looks.addAsset(i)};
  const WRITES=new Set(['/api/look/save','/api/look/asset/add']);
  if(request.method==='GET'||request.method==='HEAD'){
   if(route==='/api/look/asset'){only(['id','file']);const {bytes,type}=looks.asset({id:url.searchParams.get('id'),file:url.searchParams.get('file')});response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':type==='image/svg+xml'?"default-src 'none'; style-src 'unsafe-inline'; sandbox":"default-src 'none'"});response.end(request.method==='HEAD'?undefined:bytes);return true;}
   if(GET[route])return send(200,await GET[route]()),true;
   if(POST[route]){response.setHeader('Allow','POST');fail('Use POST.',405);}
   fail('Unknown look action.',404);
  }
  if(!POST[route]){if(GET[route]||route==='/api/look/asset'){response.setHeader('Allow','GET');fail('Use GET.',405);}fail('Unknown look action.',404);}
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  if(WRITES.has(route))checkWrite?.();
  else if(request.headers.origin&&request.headers.origin!==new URL(request.url,'http://'+request.headers.host).origin)fail('Foreign-origin request refused.',403);
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>24*1024*1024)fail('That is too large for one request.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the request as JSON.');}
  if(WRITES.has(route))request.arInput={operationId:input?.operationId,expectedRevision:input?.expectedRevision,expectedHash:input?.expectedHash,scope:{kind:'look',id:typeof input?.id==='string'?input.id:null}};
  send(200,await POST[route](input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The look could not be read or saved. Nothing was changed.',...(error.problems?{problems:error.problems}:{})});}
 return true;
}
