// Connection metadata only. Transcript content remains owned by the workshop.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {StateError} from '../store.mjs';
import {atomicWrite,digest,ensurePrivateDirectory,readJson,regular,resolveInside} from './files.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function transcriptConnectionOrigin(value){
 let url;try{url=new URL(value);}catch{throw new StateError('Use this local workspace origin.',403);}
 if(typeof value!=='string'||!/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/.test(value)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.origin!==value||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new StateError('Use this local workspace origin.',403);
 return url.origin;
}
export function createTranscriptToolConnection({dataDir,library,recordings}){
 const absoluteDataDir=fs.realpathSync(dataDir);
 async function capture(sourceId){
  const {source,file}=await library.blob(sourceId);
  if(source.id!==sourceId||source.rootId!=='recordings'||source.kind!=='transcript'||path.basename(source.rel_path||'')!=='transcript.md')throw new StateError('Choose this recording’s canonical Markdown transcript.',400);
  const bounded=resolveInside(path.join(absoluteDataDir,'recordings'),source.rel_path);
  if(file!==bounded||source.path!==file)throw new StateError('The selected transcript path changed. Open its workshop.',409);
  const stat=regular(file),hash=digest(fs.readFileSync(file));
  const managed=recordings.sourceSnapshot({...source,path:file});
  if(!managed.managed||!uuid.test(managed.jobId||'')||!managed.expected||managed.expected.jobId!==managed.jobId||managed.expected.markdownHash!==hash)throw new StateError('This source is not a verified managed transcript. Open its workshop.',409);
  const jobs=ensurePrivateDirectory(path.join(absoluteDataDir,'recordings'),'.transcription-jobs');
  const jobFile=path.join(jobs,managed.jobId+'.json'),job=readJson(jobFile,null);
  if(!job||job.id!==managed.jobId||job.state!=='done'||job.transcriptReady!==true||job.output!==path.dirname(file))throw new StateError('The recording identity changed. Open its workshop.',409);
  const receipts=path.join(path.dirname(file),'.corrections');
  if(fs.lstatSync(receipts,{throwIfNoEntry:false})){
   ensurePrivateDirectory(path.dirname(file),'.corrections');
   if(fs.lstatSync(path.join(receipts,'publication.json'),{throwIfNoEntry:false}))throw new StateError('Transcript publication requires workshop recovery.',409);
  }
  const jobHash=digest(fs.readFileSync(jobFile));
  return {source,file,managed,identity:JSON.stringify({sourceId,rel:source.rel_path,file,dev:stat.dev,ino:stat.ino,hash,jobHash,expected:managed.expected})};
 }
 return {async connect(input,origin){
  const url=transcriptConnectionOrigin(origin);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='sourceId')||!uuid.test(input.sourceId||''))throw new StateError('Choose one transcript source ID.');
  const first=await capture(input.sourceId);
  const last=await capture(input.sourceId);
  if(last.identity!==first.identity)throw new StateError('Transcript changed during connection preparation. Open its workshop.',409);
  const directory=ensurePrivateDirectory(absoluteDataDir,'transcript-tool-connections/'+randomUUID());
  const configPath=path.join(directory,'transcript-mcp.json');
  atomicWrite(configPath,JSON.stringify({schema:'ar-create.transcript-mcp-config.v1',url,sourceId:input.sourceId,jobId:first.managed.jobId},null,2)+'\n',{exclusive:true});
  fs.chmodSync(configPath,0o400);
  const adapter=path.join(repo,'tools/article-mcp/src/server.mjs'),skillPath=path.join(repo,'tools/article-mcp/SKILL.md');
  const available=[adapter,skillPath,path.join(repo,'tools/article-mcp/src/transcript.mjs')].every(file=>{try{regular(file);return true;}catch{return false;}});
  return {stage:'transcript',sourceTitle:first.source.title||first.source.name||'Transcript',sourceId:input.sourceId,jobId:first.managed.jobId,workshopUrl:`${url}/transcription/${first.managed.jobId}/view`,connection:{command:process.execPath,args:[adapter,'--repo',repo,'--config',configPath,'--data-dir',absoluteDataDir],skillPath,available},configPath,markdownPath:first.file,reviewStatus:first.managed.reviewStatus||'unreviewed',needsInspection:first.managed.coherent===false,inspectionReason:first.managed.reason||null};
 }};
}
