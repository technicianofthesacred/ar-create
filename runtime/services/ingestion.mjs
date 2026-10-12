// Durable detached intake adapted from Magazine's persisted job/dispatch pattern.
// Workers update only their scoped source file; the library's live refresh owns indexing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { atomicWrite, readJson, digest, ensurePrivateDirectory, resolveInside, regular } from './files.mjs';
import { createYouTubeCaptions, youtubeCapability } from './youtube-captions.mjs';
import { fetchReadableArticle, articleCapability } from './local-article.mjs';
import { normalizeSourceUrl } from './source-identity.mjs';
import { StateError } from '../store.mjs';
const here = fileURLToPath(import.meta.url);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const now = () => new Date().toISOString();
const canRetry = job => job?.state==='failed'||job?.state==='attention'&&/^[a-f0-9]{64}$/.test(job.resultHash||'');
const stamp = seconds => new Date(Math.floor(seconds * 1000)).toISOString().slice(11,19);
function jobFile(dir,id) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new StateError('Unknown ingestion job.',404); return path.join(dir,'.jobs',`${id}.json`); }
function jobs(dir) { return fs.readdirSync(path.join(dir,'.jobs')).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>readJson(path.join(dir,'.jobs',name),null)).filter(Boolean); }
function dispatch(dir) {
  const log=path.join(dir,'.worker.log'); if (fs.existsSync(log)) regular(log); const fd=fs.openSync(log,'a',0o600);
  try { const child=spawn(process.execPath,[here,'run',dir],{detached:true,stdio:['ignore',fd,fd],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}); child.unref(); child.on('error',()=>{}); } finally {fs.closeSync(fd);}
}
export function createUrlIngestion({dataDir, dispatchWorker = dispatch}={}) {
  const dir=ensurePrivateDirectory(dataDir,'ingestion'); ensurePrivateDirectory(dir,'.jobs'); ensurePrivateDirectory(dir,'Raw'); ensurePrivateDirectory(dir,'.work');
  const youtube=youtubeCapability(); const article=articleCapability();
  // A server restart resumes interrupted jobs without asking the model to poll.
  let resume=false;
  for(const job of jobs(dir)) if (job.state==='queued' || (job.state==='running'&&!alive(job.pid))) {job.state='queued';delete job.pid;atomicWrite(jobFile(dir,job.id),JSON.stringify(job));resume=true;}
  if(resume)dispatchWorker(dir);
  return {
    capabilities: {youtube,article,processing:'durable local URL jobs; no paid model'},
    schedule(source) {
      const existing=jobs(dir).find(job=>job.sourceId===source.id&&!['failed','conflict'].includes(job.state)); if(existing)return existing;
      const job={id:randomUUID(),sourceId:source.id,rootId:source.rootId,rel_path:source.rel_path,url:source.source_url,expectedHash:source.hash,state:'queued',stage:'queued',createdAt:now(),updatedAt:now(),rawFiles:[]};
      if(job.rootId!=='library')throw new StateError('URL processing writes only the owned library.');
      atomicWrite(jobFile(dir,job.id),JSON.stringify(job));dispatchWorker(dir);return job;
    },
    retry(id) {
      const job=readJson(jobFile(dir,id),null);if(!canRetry(job))throw new StateError('Retry a failed extraction or retained caption-attention job; conflicts require source review.',409);
      // Attention wrote a metadata note. Trust only that recorded output hash,
      // never the current file's hash: later user edits must still conflict.
      if(job.state==='attention')job.expectedHash=job.resultHash;
      job.state='queued';job.stage='queued';delete job.pid;delete job.error;delete job.captionError;delete job.completedAt;job.updatedAt=now();atomicWrite(jobFile(dir,id),JSON.stringify(job));dispatchWorker(dir);return job;
    },
    state(id) { return readJson(jobFile(dir,id),null); },
    list() {return {capabilities:this.capabilities,jobs:jobs(dir).map(job=>({...job,canRetry:canRetry(job),retryReason:canRetry(job)?null:job.state==='conflict'?'Review the changed source before replacing its text.':job.state==='attention'?'Saved metadata hash is unavailable; review this source before replacing it.':null,rawFiles:job.rawFiles.map(file=>({...file,url:`/api/ingestion/raw?id=${job.id}&file=${encodeURIComponent(file.name)}`}))})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};},
    raw(id,name) {const job=readJson(jobFile(dir,id),null); const entry=job?.rawFiles.find(file=>file.name===name);if(!entry)throw new StateError('Raw source file was not found.',404);return {file:resolveInside(path.join(dir,'Raw'),entry.name),type:entry.type};},
  };
}
export async function runQueue(dir,{extract = null, dispatchWorker = dispatch}={}) {
  ensurePrivateDirectory(path.dirname(dir),path.basename(dir)); ensurePrivateDirectory(dir,'.jobs'); ensurePrivateDirectory(dir,'Raw'); ensurePrivateDirectory(dir,'.work');
  const lock=path.join(dir,'.worker-lock.json'); let fd;
  try {fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.closeSync(fd);}
  catch(error) {if(error.code!=='EEXIST')throw error;const held=readJson(lock,null);if(held&&alive(held.pid))return;fs.rmSync(lock);return runQueue(dir,{extract,dispatchWorker});}
  const dataDir=path.dirname(dir),libraryRoot=path.join(dataDir,'library');
  const captions=createYouTubeCaptions({workDir:path.join(dir,'.work'),executable:process.env.AR_CREATE_YT_DLP||null});
  try {
    while(true) {
      const job=jobs(dir).filter(item=>item.state==='queued'||(item.state==='running'&&!alive(item.pid))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0]; if(!job)break;
      const save=()=>{job.updatedAt=now();atomicWrite(jobFile(dir,job.id),JSON.stringify(job));};job.state='running';job.stage='extract';job.pid=process.pid;save();
      try {
        const resolveTarget=()=>{const index=readJson(path.join(dataDir,'library-index.json'),null);const current=index?.sources.find(source=>source.id===job.sourceId&&!source.missing);if(!current||current.rootId!=='library')throw new StateError('Source is no longer available in the owned library.',409);job.rel_path=current.rel_path;return resolveInside(libraryRoot,current.rel_path);};
        let target=resolveTarget();regular(target);if(digest(fs.readFileSync(target))!==job.expectedHash)throw new StateError('Source changed before extraction; captured material was not overwritten.',409);
        const youtube=normalizeSourceUrl(job.url).startsWith('youtube:');
        if(!extract && !youtube && !articleCapability().ready)throw new Error(articleCapability().problem);
        const result=extract ? await extract(job.url,{youtube}) : youtube ? await captions.extract(job.url) : await fetchReadableArticle(job.url);
        job.stage='retain-raw';save();const retain=(name,content,type)=>{
          const track=name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160),hash=digest(content);let safe=`${job.id}-${track}`,destination=path.join(dir,'Raw',safe);
          if(fs.existsSync(destination)){regular(destination);if(digest(fs.readFileSync(destination))!==hash){safe=`${job.id}-${hash}-${track}`;destination=path.join(dir,'Raw',safe);}}
          // Recovery may return changed bytes for the same track. Keep both
          // immutable versions rather than replacing the prior raw evidence.
          if(fs.existsSync(destination)){regular(destination);if(digest(fs.readFileSync(destination))!==hash)throw new Error('Retained raw bytes differ; refusing overwrite.');}
          else atomicWrite(destination,content,{exclusive:true});
          if(!job.rawFiles.some(file=>file.name===safe))job.rawFiles.push({name:safe,originalName:name,type,hash});save();
        };
        if(youtube) for(const file of result.rawFiles||[])retain(file.name,file.content,'text/vtt; charset=utf-8');
        else if(result.rawHtml)retain('page.html',result.rawHtml,'text/plain; charset=utf-8');
        let body,title,status,header;
        if(youtube) {
          title=result.title||job.url;status=result.hasTranscript?'ready':'needs-captions';
          body=result.hasTranscript?result.segments.map(segment=>`[${stamp(segment.start)}–${stamp(segment.end)}] ${segment.text}`).join('\n\n'):'No captions were returned. Video metadata is retained; this is not a transcript.';
          header=`kind: ${result.hasTranscript?'transcript':'web'}\nvideo_id: ${JSON.stringify(result.videoId||'')}\nchannel: ${JSON.stringify(result.channel||'')}\npublished_at: ${JSON.stringify(result.published_at||'')}\nreview_status: unreviewed\n`;
          if(result.description)body=`## Description\n\n${result.description}\n\n## ${result.hasTranscript?'Timestamped captions':'Captions unavailable'}\n\n${body}`;
          job.captionError=result.captionError||null;job.backend='copied-i64os-yt-dlp';
        } else {
          title=result.title||job.url;body=result.textContent?.trim();if(!body||body.length<40)throw new Error('The page returned no substantial readable article text.');status='ready';header=`kind: web\nbyline: ${JSON.stringify(result.byline||'')}\npublished_at: ${JSON.stringify(result.publishDate||'')}\n`;job.backend='copied-i64os-readability';
        }
        const note=`---\ntitle: ${JSON.stringify(title)}\nsource_url: ${JSON.stringify(job.url)}\nprocessing_status: ${status}\ningestion_job_id: ${job.id}\n${header}ripped_at: ${now()}\n---\n\n# ${title}\n\n> Source: <${job.url}>\n\n${body}\n`;
        if(Buffer.byteLength(note)>2*1024*1024)throw new Error('Readable text exceeds the 2 MB source reader limit; raw evidence retained.');
        job.stage='save-source';save();target=resolveTarget();atomicWrite(target,note,{expectedHash:job.expectedHash});job.resultHash=digest(note);job.state=status==='ready'?'done':'attention';job.stage=status;job.completedAt=now();save();
      } catch(error) {job.state=error.status===409?'conflict':'failed';job.stage='attention';job.error=error.message.slice(0,1000);save();}
    }
  } finally {fs.rmSync(lock,{force:true});if(jobs(dir).some(job=>job.state==='queued'))dispatchWorker(dir);}
}
if(process.argv[2]==='run'&&process.argv[1]&&path.resolve(process.argv[1])===here) {
  const dir=process.argv[3];if(!dir||!path.isAbsolute(dir)||path.basename(dir)!=='ingestion')throw new Error('Use an isolated ingestion directory.');
  await runQueue(dir);
}
