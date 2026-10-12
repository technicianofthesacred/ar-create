// Read-only extraction adapted from ~/builds/mag-status.mjs (identity/stage),
// mag-ask.mjs (question parser), mag-preview.mjs (grouped attention).
// Deliberately imports none of those executables or their writable helpers.
import {lstat, realpath, readdir, open} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const LIMITS={fileBytes:2*1024*1024,totalBytes:64*1024*1024,entries:10000,depth:12};
const STEPS={2:'Source',3:'Map',4:'Your pick',5:'Draft',6:'Your read',11:'Feedback'};
const GUIDANCE=/^(?:TEMPLATE(?:-CHANGELOG)?|SYSTEM|WRITER-GUIDE|EDITOR|RATING|PAGE|_Workflow)\.md$/i;
const STAGE_DIR={RAW:'0-Inbox',CONTEXT:'1-Source',SRC:'1-Source',MAP:'2-Guidance',PLANS:'2-Guidance',DEV:'3-Develop',CHECK:'4-Review',FEEDBACK:'6-Feedback'};
const authoritative=a=>!a.archived&&(a.kind==='ASK'?/^Workflow\/ASK - [^/]+\.md$/.test(a.relativePath):STAGE_DIR[a.kind]&&a.relativePath===`Workflow/${STAGE_DIR[a.kind]}/${a.fileName}`);
const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const clean=value=>String(value||'').trim().replace(/^(['"])([\s\S]*)\1$/,'$2');
const norm=value=>clean(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const lead=value=>norm(value).split(/\s+/).slice(0,2).join(' ');
const baseName=a=>a.fileName.replace(/^[A-Z]+ - /,'').replace(/\.(md|txt)$/i,'').replace(/\s*\(.*$/,'').trim();
const newest=items=>[...items].sort((a,b)=>b.mtime.localeCompare(a.mtime)||a.relativePath.localeCompare(b.relativePath))[0]||null;
const dateOf=(a,key)=>a?clean(a.meta[key]).match(/^\d{4}-\d{2}-\d{2}/)?.[0]||a.mtime.slice(0,10):'';

function frontmatter(raw) {
 const fm=raw.replace(/\r\n/g,'\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1]||'';
 const meta={};for(const line of fm.split('\n')){const m=line.match(/^([\w-]+):\s*(.*)$/);if(m)meta[m[1]]=clean(m[2]);}
 const aliases=[];
 const inline=fm.match(/^aliases:\s*\[([^\n]*)\]/m);
 if(inline)for(const m of inline[1].matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|([^,]+)(?:,|$)/g)){const v=clean(m[1]??m[2]??m[3]);if(v)aliases.push(v);}
 const block=fm.match(/^aliases:\s*\n((?:[ \t]+-.*(?:\n|$))+)/m);
 if(block)aliases.push(...block[1].split('\n').map(l=>clean(l.replace(/^\s*-\s*/,''))).filter(Boolean));
 return {meta,aliases,fm};
}

// Pure reading half of parseAsk, including every read link and research-line field.
function parseAsk(raw) {
 const body=raw.replace(/\r\n/g,'\n').replace(/^---\n[\s\S]*?\n---\n?/,'');
 return body.split(/^## /m).slice(1).map((chunk,index)=>{
  const [title,...lines]=chunk.split('\n');const q={index,title:title.trim(),context:[],reads:[],options:[],other:false,text:false,answer:'',answered:''};
  for(const rawLine of lines){const l=rawLine.trim();let m;if(!l)continue;
   if((m=l.match(/^read:\s*([^|]+?)\s*(?:\|\s*(.+))?$/)))q.reads.push({file:m[1],label:m[2]||'Read it'});
   else if((m=l.match(/^- \[( |x|X)\]\s*(.+)$/))){const recommended=/\(recommended\)\s*$/i.test(m[2]);q.options.push({label:m[2].replace(/\s*\(recommended\)\s*$/i,''),recommended,chosen:m[1]!==' '});}
   else if((m=l.match(/^- other(?::\s*(.+))?$/i))){q.other=true;q.otherLabel=m[1]||'';}
   else if((m=l.match(/^answer:\s*(.*)$/))){q.text=true;q.answer=m[1];}
   else if((m=l.match(/^answered:\s*(.*)$/)))q.answered=m[1];
   else if((m=l.match(/^(who|at|said|suggested|why|telling):\s*(.*)$/)))(q.line||={})[m[1]]=m[2];
   else if(!/^#/.test(l))q.context.push(l);
  }
  q.value=q.options.find(o=>o.chosen)?.label||q.answer;q.open=!q.answered;return q;
 });
}

function boardEntries(a) {
 if(!a)return [];
 const lines=a.raw.replace(/\r\n/g,'\n').split('\n');const entries=[];let section='',current=null;
 for(const line of lines){if(/^## /.test(line)){section=line.slice(3);current=null;continue;}
  const m=line.match(/^(?:-\s*)?\*\*\[(\d+)\]\s*(.+?)\*\*(.*)$/);
  if(m){current={number:m[1],name:m[2].split(':')[0].trim(),heading:m[2]+m[3],section,text:line,artifact:publicArtifact(a)};entries.push(current);}
  else if(current)current.text+='\n'+line;
 }
 return entries;
}
function publicArtifact(a) {
 const {raw,meta,aliases,fm,...result}=a;return result;
}

async function rootInfo(root) {
 const info=await lstat(root.path).catch(()=>{throw fail(400,`Configured Magazine root unavailable: ${root.id}`);});
 if(info.isSymbolicLink()||!info.isDirectory())throw fail(400,`Configured Magazine root must be a real directory (no symlink): ${root.id}`);
 return {...root,canonical:await realpath(root.path),dev:info.dev,ino:info.ino};
}
async function checkedPath(root,relativePath) {
 const pieces=relativePath.split('/');
 if(!relativePath||pieces.some(p=>!p||p==='.'||p==='..'||p.startsWith('.'))||path.isAbsolute(relativePath)||relativePath.includes('\\'))throw fail(400,'Invalid Magazine artifact path.');
 const currentRoot=await lstat(root.path);
 if(currentRoot.isSymbolicLink()||currentRoot.dev!==root.dev||currentRoot.ino!==root.ino||await realpath(root.path)!==root.canonical)throw fail(409,'Magazine root changed. Refresh the portfolio.');
 let abs=root.path;for(let i=0;i<pieces.length;i++){
  abs=path.join(abs,pieces[i]);const stat=await lstat(abs);
  if(stat.isSymbolicLink())throw fail(409,'Magazine symlink rejected. Refresh the portfolio.');
  if(i<pieces.length-1&&!stat.isDirectory())throw fail(409,'Magazine directory changed. Refresh the portfolio.');
 }
 const real=await realpath(abs);
 if(!real.startsWith(root.canonical+path.sep))throw fail(409,'Magazine artifact escaped its configured root.');
 return abs;
}
async function readBounded(root,relativePath) {
 const abs=await checkedPath(root,relativePath);
 const handle=await open(abs,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await handle.stat();
  if(!before.isFile()||before.size>LIMITS.fileBytes)throw fail(413,'Magazine file size/type limit exceeded.');
  // A bounded buffer remains bounded even if another process grows the file.
  const buffer=Buffer.alloc(LIMITS.fileBytes+1);let length=0;
  while(length<buffer.length){const {bytesRead}=await handle.read(buffer,length,buffer.length-length,length);if(!bytesRead)break;length+=bytesRead;}
  if(length>LIMITS.fileBytes)throw fail(413,'Magazine file size limit exceeded.');
  const after=await handle.stat(),visible=await lstat(await checkedPath(root,relativePath));
  if(before.dev!==visible.dev||before.ino!==visible.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw fail(409,'Magazine artifact changed while reading. Refresh the portfolio.');
  const bytes=buffer.subarray(0,length);
  let raw;try{raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw fail(415,'Magazine artifact is not UTF-8 text.');}
  if(raw.includes('\0'))throw fail(415,'Magazine artifact is not text.');
  return {raw,hash:sha(bytes),bytes:length,mtime:new Date(after.mtimeMs).toISOString()};
 }finally{await handle.close();}
}

async function scan(roots) {
 const artifacts=[],diagnostics=[];let entries=0,totalBytes=0,stopped=false;
 for(const root of roots){
  async function walk(relative='',depth=0){
   if(stopped)return;if(depth>LIMITS.depth){diagnostics.push(`Depth limit reached: ${root.id}/${relative}`);return;}
   let children;try{if(relative)await checkedPath(root,relative);children=await readdir(path.join(root.path,relative),{withFileTypes:true});}catch(e){diagnostics.push(`Cannot read directory ${root.id}/${relative}: ${e.message}`);return;}
   children.sort((a,b)=>a.name.localeCompare(b.name));
   for(const child of children){if(stopped)return;if(++entries>LIMITS.entries){diagnostics.push('Magazine entry limit reached; portfolio is incomplete.');stopped=true;return;}
    if(child.name.startsWith('.'))continue;
    const rel=[relative,child.name].filter(Boolean).join('/');
    if(child.isSymbolicLink()){diagnostics.push(`Skipped symlink: ${root.id}/${rel}`);continue;}
    if(child.isDirectory()){await walk(rel,depth+1);continue;}
    if(!child.isFile()||!(/\.(md|txt)$/i.test(child.name)))continue;
    try{
     const content=await readBounded(root,rel);totalBytes+=content.bytes;
     if(totalBytes>LIMITS.totalBytes){diagnostics.push('Magazine total size limit reached; portfolio is incomplete.');stopped=true;return;}
     const fm=frontmatter(content.raw);const kind=child.name.match(/^([A-Z]+) - /)?.[1]||(/^\w+$/.test(fm.meta.type||'')?fm.meta.type.toUpperCase():'FILE');
     artifacts.push({artifactId:'mag_'+sha(root.id+'\0'+root.canonical+'\0'+rel),hash:content.hash,fileName:child.name,relativePath:rel,kind,archived:rel.startsWith('_archive/'),mtime:content.mtime,title:fm.meta.title||'',part:fm.meta.part||'',provenance:{rootId:root.id,rootLabel:root.label,rootPath:root.path,relativePath:rel,sha256:content.hash,readOnly:true},raw:content.raw,...fm});
    }catch(e){diagnostics.push(`Skipped ${root.id}/${rel}: ${e.message}`);}
   }
  }
  await walk();
 }
 return {artifacts,diagnostics};
}

function portfolio(artifacts,roots,diagnostics) {
 const stories=[],unassigned=[],guidance=[];
 for(const root of roots){
  const files=artifacts.filter(a=>a.provenance.rootId===root.id);
  const rootStories=[];
  function add(name,context=null){let s=rootStories.find(s=>norm(s.name)===norm(name));if(!s){s={id:'story_'+sha(root.id+'\0'+norm(name)),name,context,artifacts:[],names:new Set([norm(name),norm(context?.meta.story)])};rootStories.push(s);}return s;}
  for(const a of files.filter(a=>a.kind==='CONTEXT').sort((a,b)=>Number(a.archived)-Number(b.archived))){const s=add(baseName(a),a);s.artifacts.push(a);}
  function matches(names){
   const normalized=names.map(norm).filter(Boolean);
   const primary=rootStories.filter(s=>normalized.includes(norm(s.name)));
   if(primary.length)return primary;
   const exact=rootStories.filter(s=>normalized.some(n=>s.names.has(n)||[...s.names].some(x=>x&&n.startsWith(x+' '))));
   if(exact.length)return exact;
   return rootStories.filter(s=>normalized.some(n=>lead(n)&&[...s.names].some(x=>x&&lead(x)===lead(n))));
  }
  // SRC/RAW roots cover intake without CONTEXT. A lone DEV covers recovered writing.
  for(const a of files.filter(a=>['SRC','RAW','DEV'].includes(a.kind)&&authoritative(a))){
   const candidates=matches([baseName(a),a.meta.story,...a.aliases]);
   if(!candidates.length){const s=add(baseName(a));s.names.add(norm(a.meta.story));}
  }
  for(const a of files.filter(a=>a.kind==='DEV'&&a.archived))if(!matches([baseName(a),a.meta.story,...a.aliases]).length)add(baseName(a));
  for(const a of files){
   if(a.kind==='CONTEXT')continue;
   if(GUIDANCE.test(a.fileName)||/TEMPLATE\.md$/i.test(a.fileName)||a.relativePath.startsWith('Workflow/_style/')){guidance.push(publicArtifact(a));continue;}
   if(a.fileName==='STATUS.md'){guidance.push(publicArtifact(a));continue;}
   // Explicit story fields first, then the filename, then aliases. Multi-source
   // combined drafts retain primary identity instead of merging both stories.
   let candidates=a.meta.story?matches([a.meta.story]):[];
   if(!candidates.length)candidates=matches([baseName(a)]);
   if(!candidates.length)candidates=matches(a.aliases);
   if(candidates.length===1){const s=candidates[0];s.artifacts.push(a);for(const n of a.aliases)s.names.add(norm(n));if(a.kind==='DEV')s.names.add(norm(a.title));}
   else{unassigned.push(publicArtifact(a));if(candidates.length>1)diagnostics.push(`Ambiguous story identity: ${root.id}/${a.relativePath}`);}
  }
  const board=boardEntries(files.find(a=>a.relativePath==='STATUS.md'));
  for(const entry of board){const candidates=matches([entry.name]);if(candidates.length===1)candidates[0].board=entry;else if(!candidates.length)add(entry.name).board=entry;else diagnostics.push(`Ambiguous STATUS entry [${entry.number}]: ${entry.name}`);}
  const byPath=new Map(files.map(a=>[a.relativePath,a]));
  for(const s of rootStories){
   const active=s.artifacts.filter(a=>authoritative(a)),of=kind=>active.filter(a=>a.kind===kind),devs=of('DEV').filter(a=>!a.meta.superseded);
   const partNumbers=[...new Set(devs.map(a=>a.part.match(/^\d+/)?.[0]).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
   const partFiles=partNumbers.map(p=>newest(devs.filter(a=>a.part.match(/^\d+/)?.[0]===p)));
   const checkFor=a=>newest(of('CHECK').filter(c=>norm(baseName(c))===norm(baseName(a))||c.meta.for===a.fileName));
   for(const a of partFiles){const c=checkFor(a);a.fileStage=c&&c.mtime>=a.mtime?'draft checked':c?'draft; check is older':'draft; no matching check';a.flags=c&&c.mtime<a.mtime?['This part is newer than its newest check.']:!c?['No matching check file for this part.']:[];}
   const dev=newest(devs),check=dev?.part?checkFor(dev):newest(of('CHECK')),map=newest(of('MAP')),raw=newest(of('RAW'));
   const mapCreated=dateOf(map,'created'),devUpdated=dateOf(dev,'updated'),ctx=s.context&&!s.context.archived?s.context:null;
   const decisions=(map?.raw.split(/^## Adrian's decisions.*$/m)[1]||'').split(/^## /m)[0];
   const decided=[...decisions.matchAll(/\d{4}-\d{2}-\d{2}/g)].some(m=>m[0]>=mapCreated);
   const rebuild=ctx?.meta.rebuild?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'',reading=ctx?.meta.reading?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'';
   const published=devs.map(a=>a.meta.published||'').find(Boolean)||'';
   let stage=rebuild&&!(map&&mapCreated>=rebuild)?`rebuild since ${rebuild}, new map to make`
    :published?of('FEEDBACK').length?'live, feedback message filled':'live, no feedback file yet'
    :raw&&!of('SRC').length?'RAW in Inbox, needs SRC'
    :map&&(!dev||mapCreated>devUpdated)?decided?'map decided, next draft not written yet':"map, waiting on Adrian's pick"
    :reading&&dev&&devUpdated<=reading?`out for Adrian's read since ${reading}`
    :dev&&check&&check.mtime>=dev.mtime?'draft checked':dev?'draft':map?'map':of('PLANS').length?'plans':of('SRC').length?'source, no map':ctx?'context only':'archived writing only';
   if(partFiles.length>1&&['draft','draft checked'].includes(stage))stage=partFiles.every(a=>a.fileStage==='draft checked')?'draft checked':partFiles.some(a=>a.fileStage==='draft checked')?'drafts; checks vary by part':'draft';
   const fileStage=stage;let step=stage.startsWith('live')?11:stage==='draft checked'||stage.startsWith('out for')?6:stage.startsWith('draft')||stage.startsWith('map decided')||stage==='plans'?5:stage.startsWith('map, waiting')?4:stage.startsWith('source')||stage.startsWith('rebuild')?3:2;
   if(stage==='archived writing only')step=null;
   const flags=[];
   if(dev&&check&&check.mtime<dev.mtime)flags.push('Newest draft is newer than its newest check.');
   const marks=devs.reduce((n,a)=>n+(a.raw.replace(/^---[\s\S]*?---/,'').match(/==[^=\n]+==/g)||[]).length,0);
   if(marks)flags.push(`${marks} connecting line(s) still awaiting approval (==…==).`);
   if(!s.board)flags.push('No matching entry on STATUS.md.');
   else{
    if(dev&&!published&&!s.board.text.includes(dev.fileName.replace(/\.md$/,'')))flags.push('STATUS.md does not name the newest draft.');
    if(/FOLDED INTO\s*\[\d+\]/i.test(s.board.heading)){stage=s.board.heading.match(/FOLDED INTO\s*\[\d+\][^·\n]*/i)[0].toLowerCase();step=null;flags.push(`STATUS.md records a folded story; files separately show: ${fileStage}.`);}
    else if(/^Dropped$/i.test(s.board.section)||s.artifacts.some(a=>a.relativePath.startsWith('_archive/Dropped - '))){stage='dropped (originals retained)';step=null;}
    else if(/Published/i.test(s.board.section)!==!!published)flags.push(`STATUS.md section “${s.board.section}” and file publication marker disagree.`);
    if(/Draft.*waiting/i.test(s.board.section)&&!['draft','draft checked'].includes(fileStage)&&!fileStage.startsWith('out for'))flags.push(`STATUS.md says draft waiting; files show: ${fileStage}.`);
    if(/Source ready/i.test(s.board.section)&&dev)flags.push(`STATUS.md groups this story under source ready; files show: ${fileStage}.`);
   }
   if(s.artifacts.length&&!active.length&&s.artifacts.some(a=>a.relativePath.startsWith('_archive/Dropped - '))){stage='dropped (originals retained)';step=null;}
   const questions=s.artifacts.filter(a=>a.kind==='ASK').sort((a,b)=>Number(a.archived)-Number(b.archived)).flatMap(a=>parseAsk(a.raw).map(q=>({...q,archived:a.archived,artifact:publicArtifact(a),reads:q.reads.map(r=>({...r,artifact:byPath.has(r.file)?publicArtifact(byPath.get(r.file)):undefined}))})));
   const currentQs=questions.filter(q=>!q.archived),openQs=currentQs.filter(q=>q.open),answered=currentQs.filter(q=>!q.open);
   const attentionCount=openQs.filter(q=>!q.line?.said).length+(openQs.some(q=>q.line?.said)?1:0);
   const who=step===null?'unknown':openQs.length?'you':answered.length?'me':[4,6,11].includes(step)?'you':'me';
   const parts=partFiles.map(publicArtifact);
   stories.push({id:s.id,name:s.name,stage,fileStage,step,stepName:STEPS[step]||'Historical',who,board:s.board||null,flags,artifacts:s.artifacts.map(publicArtifact).sort((a,b)=>Number(a.archived)-Number(b.archived)||b.mtime.localeCompare(a.mtime)),latestDraft:dev?publicArtifact(dev):null,parts,questions,attentionCount,openCount:openQs.length,answeredCount:answered.length,published});
  }
 }
 // Donor attention order: human questions, then answers needing action, then rest.
 stories.sort((a,b)=>Number(b.attentionCount>0)-Number(a.attentionCount>0)||Number(b.answeredCount>0)-Number(a.answeredCount>0)||a.name.localeCompare(b.name));
 return {roots:roots.map(({id,label,path})=>({id,label,path})),stories,guidance,unassigned,diagnostics};
}

export function createMagazinePortfolio({roots}={}) {
 if(!Array.isArray(roots))throw fail(400,'Explicit Magazine roots configuration required.');
 const configured=roots.map((r,i)=>{
  if(!r||typeof r.path!=='string'||!path.isAbsolute(r.path)||typeof r.id!=='string'||!/^[\w-]{1,80}$/.test(r.id))throw fail(400,`Invalid configured Magazine root at ${i}.`);
  return {id:r.id,label:typeof r.label==='string'?r.label:r.id,path:path.resolve(r.path)};
 });
 if(new Set(configured.map(r=>r.id)).size!==configured.length)throw fail(400,'Duplicate Magazine root id.');
 let catalog=new Map();
 async function collect(){
  const resolved=await Promise.all(configured.map(rootInfo));
  if(resolved.some((r,i)=>resolved.some((x,j)=>i!==j&&(r.canonical===x.canonical||r.canonical.startsWith(x.canonical+path.sep)))))throw fail(400,'Overlapping configured Magazine roots.');
  const result=await scan(resolved);catalog=new Map(result.artifacts.map(a=>[a.artifactId,{a,root:resolved.find(r=>r.id===a.provenance.rootId)}]));
  return portfolio(result.artifacts,resolved,result.diagnostics);
 }
 return {
  async list(){const result=await collect();if(!configured.length)result.diagnostics.push('No Magazine workflow root configured.');return result;},
  async read({artifactId,expectedHash}={}){
   if(typeof artifactId!=='string'||!/^mag_[a-f0-9]{64}$/.test(artifactId))throw fail(404,'Unknown Magazine artifact.');
   if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash))throw fail(400,'Expected artifact hash required.');
   if(!catalog.has(artifactId))await collect();
   const item=catalog.get(artifactId);if(!item)throw fail(404,'Magazine artifact no longer available. Refresh the portfolio.');
   let content;try{content=await readBounded(item.root,item.a.relativePath);}catch(e){if(e.status)throw e;throw fail(409,'Magazine artifact changed or disappeared. Refresh the portfolio.');}
   if(content.hash!==expectedHash)throw fail(409,'Magazine artifact changed. Refresh the portfolio before reading or loading a copy.');
   return {raw:content.raw,fileName:item.a.fileName,provenance:{...item.a.provenance,sha256:content.hash}};
  }
 };
}
