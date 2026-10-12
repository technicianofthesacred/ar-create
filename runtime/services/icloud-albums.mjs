// Adapted from Adrian's ~/builds/mag-photos.mjs: partition, webstream,
// webasseturls, largest derivative, GUID manifest and incremental numbering.
// Own storage only. Apple's undocumented public shared-stream API may change.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite, readJson, digest, ensurePrivateDirectory, resolveInside } from './files.mjs';
import { StateError } from '../store.mjs';
const B62='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const b62=s=>[...s].reduce((n,c)=>n*62+B62.indexOf(c),0);
const now=()=>new Date().toISOString();
export function isICloudAlbum(raw) {try {const u=new URL(raw);return ['www.icloud.com','icloud.com'].includes(u.hostname)&&/^\/sharedalbum\/?$/.test(u.pathname);}catch{return false;}}
export function albumToken(raw) {const u=new URL(raw);if(!isICloudAlbum(raw)||u.protocol!=='https:'||u.username||u.password||u.port||!/^#[A-Za-z0-9_-]{3,512}$/.test(u.hash))throw new StateError('Use a public HTTPS iCloud shared album link, including its complete # token.');return u.hash.slice(1);}
function allowed(url,asset=false) {const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||!(asset ? u.hostname==='icloud-content.com'||u.hostname.endsWith('.icloud-content.com') : /^p\d{1,4}-sharedstreams\.icloud\.com$/.test(u.hostname)))throw new Error('Apple returned an unsupported download host; no external address was requested.');return u;}
async function boundedFetch(fetcher,url,options,limit,asset=false,onChunk=null) {
  allowed(url,asset);const res=await fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(!res.ok&&res.status!==330)throw new Error(`iCloud answered ${res.status}. Check that Public Website is on for this album.`);
  const length=Number(res.headers.get('content-length'));if(length>limit){await res.body?.cancel();throw new Error('Apple response exceeds the import size limit.');}
  const chunks=[];let size=0;for await(const chunk of res.body){size+=chunk.length;onChunk?.(chunk.length);if(size>limit){await res.body.cancel().catch(()=>{});throw new Error('Apple response exceeds the import size limit.');}chunks.push(chunk);}
  return {res,bytes:Buffer.concat(chunks)};
}
export function createICloudAlbums({dataDir,library,fetcher=fetch}) {
  const dir=ensurePrivateDirectory(dataDir,'icloud-albums');let running=false;const progress=new Map();
  const files=()=>fs.readdirSync(dir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f));
  return {
    list(){return {albums:[...progress.values()].map(j=>structuredClone(j))};},
    async import(raw) {
      const token=albumToken(raw),id=digest(token);if(running)throw new StateError('An album is already importing. Wait for its result, then add this link again.',409);
      running=true;let job={id,url:raw,state:'importing',stage:'Opening album',completed:0,total:0,results:[]};progress.set(id,job);
      let manifestPath,manifest;
      try {
        manifestPath=resolveInside(dir,`${id}.json`,{missing:true});manifest=readJson(manifestPath,{downloaded:{}});
        const partition=token[0]==='A'?b62(token[1]):b62(token.slice(1,3));let host=`p${String(partition).padStart(2,'0')}-sharedstreams.icloud.com`;
        async function call(endpoint,body) {
          for(let hop=0;hop<3;hop++) {
            const {res,bytes}=await boundedFetch(fetcher,`https://${host}/${token}/sharedstreams/${endpoint}`,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)},2*1024*1024);
            if(res.status===330){const response=JSON.parse(bytes.toString('utf8'));host=response['X-Apple-MMe-Host']||res.headers.get('X-Apple-MMe-Host');allowed(`https://${host}`);continue;}return JSON.parse(bytes.toString('utf8'));
          }throw new Error('iCloud kept redirecting; import stopped.');
        }
        const stream=await call('webstream',{streamCtag:null});if(!Array.isArray(stream.photos))throw new Error('Apple returned no album photo list.');
        if(stream.photos.length>100)throw new Error('This album exceeds the 100-item import limit. Import a smaller shared album.');
        const album=String(stream.streamName||'iCloud album').slice(0,180);const safeName=album.replace(/[\x00-\x1f<>:"/\\|?*]/g,' ').trim().replace(/^\.+/,'')||'iCloud album';
        if(!manifest.folder){const other=files().map(f=>readJson(path.join(dir,f),{}));manifest.folder=other.some(m=>m.folder===safeName)?`${safeName} ${id.slice(0,8)}`:safeName;}
        manifest.album=album;manifest.url=raw;manifest.updated=now();manifest.downloaded ||= {};job.album=album;job.folder=manifest.folder;job.total=stream.photos.length;
        await library.folder({rootId:'library',folder:manifest.folder});
        const photos=stream.photos.filter(p=>(p.mediaAssetType||'image')!=='video');const fresh=[];
        for(const p of photos) {const saved=manifest.downloaded[p.photoGuid];let source=null;if(saved){try{source=await library.read(saved.sourceId);}catch{/* Missing local files can be imported again without overwriting others. */}}if(source){job.results.push({ok:true,state:'skipped',reused:true,name:saved.file,source,album});job.completed++;}else fresh.push(p);}
        for(const p of stream.photos.filter(p=>p.mediaAssetType==='video')){job.results.push({ok:true,state:'skipped',name:p.caption||p.photoGuid,error:'Video skipped; this importer retains photos.',album});job.completed++;}
        const urls=fresh.length?await call('webasseturls',{photoGuids:fresh.map(p=>p.photoGuid)}):{items:{}};
        const folder=resolveInside(path.join(dataDir,'library'),manifest.folder,{directory:true});let n=fs.readdirSync(folder).map(f=>parseInt(f,10)).filter(Number.isFinite).reduce((a,b)=>Math.max(a,b),0),totalBytes=0;
        for(const p of fresh) {
          const name=`${String(++n).padStart(2,'0')}.jpg`;job.stage=`Importing ${name}`;
          try {
            const best=Object.values(p.derivatives||{}).sort((a,b)=>Number(b.fileSize||0)-Number(a.fileSize||0))[0],item=best&&urls.items?.[best.checksum];if(!item)throw new Error('Apple supplied no download address for this photo.');
            if(totalBytes>=150*1024*1024)throw new Error('Album exceeds the 150 MB total download limit.');
            const url=`https://${item.url_location}${item.url_path}`;const {bytes}=await boundedFetch(fetcher,url,{},Math.min(25*1024*1024,150*1024*1024-totalBytes),true,length=>{totalBytes+=length;});
            if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error('The photo response is not a JPEG; it was not retained as an image.');
            const source=await library.retainAlbumPhoto({folder:manifest.folder,name,bytes,provenance:{kind:'icloud-album',originalUrl:raw,album,photoGuid:p.photoGuid,checksum:best.checksum,width:best.width,height:best.height,caption:p.caption||'',donor:'mag-photos.mjs'}});
            manifest.downloaded[p.photoGuid]={file:source.name,sourceId:source.id,hash:source.hash,width:best.width,height:best.height,caption:p.caption||''};manifest.updated=now();atomicWrite(manifestPath,JSON.stringify(manifest,null,2));job.results.push({ok:true,state:'imported',name:source.name,source,album});
          }catch(error){job.results.push({ok:false,state:'error',name,error:error.message,album});}
          job.completed++;
        }
        atomicWrite(manifestPath,JSON.stringify(manifest,null,2));job.state=job.results.some(r=>!r.ok)?'attention':'done';job.stage='Complete';
      }catch(error){job.state='error';job.error=error.message;job.stage='Import stopped';}
      finally{running=false;job.updatedAt=now();if(progress.size>20){const oldest=[...progress.keys()].find(key=>key!==id);progress.delete(oldest);}}
      const counts=Object.fromEntries(['imported','skipped','error'].map(state=>[state,job.results.filter(r=>r.state===state).length]));
      return {receipts:[{ok:!job.error&&!counts.error,url:raw,name:job.album||'iCloud album',state:job.state,error:job.error,albumImport:{...counts,folder:job.folder,album:job.album}},...job.results],album:structuredClone(job)};
    },
  };
}
