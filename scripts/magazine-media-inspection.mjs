// Read-only projection of maintained Magazine publication photographs. No media store.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createRequire} from 'node:module';
import {planMagazinePlacementMove,planMagazinePlacementFocus,planMagazinePlacementAspect,planMagazinePlacementReplace} from '../runtime/services/magazine-placement-plan.mjs';
import * as native from '../runtime/services/draft-correspondence.mjs';
const require = createRequire(new URL('../runtime/package.json', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const HEX = /^[a-f0-9]{64}$/;
const MAX_ASSET = 20 * 1024 * 1024;
const MIME = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'};
function fail(message, status = 409) { throw Object.assign(new Error(message), {status}); }
function fields(input, keys) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !keys.includes(k)) || keys.some(k => typeof input[k] !== 'string' || !input[k] || input[k].length > 500)) fail('Send exact Magazine selection and revision fields.', 400);
  if (['expectedHash','sourceId','sourceHash','revision'].some(k => input[k] !== undefined && !HEX.test(input[k]))) fail('Send the exact working hash.', 400);
}
function regular(root, relative, max) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(x => !x || x === '.' || x === '..' || x.startsWith('.')) || /[\x00-\x1f]/.test(relative)) fail('Unsafe publication file.');
  let file = root;
  const ancestors = [];
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(root) !== root) fail('Publication checkout changed.');
  ancestors.push([rootStat.dev,rootStat.ino]);
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    const st = fs.lstatSync(file, {throwIfNoEntry:false});
    if (!st || st.isSymbolicLink()) fail('Publication file is unavailable or unsafe.');
    if (file !== path.join(root, relative)) {
      if (!st.isDirectory()) fail('Unsafe publication directory.');
      ancestors.push([st.dev,st.ino]);
    }
  }
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > max || stat.size < 1 || fs.realpathSync(file) !== file) fail('Publication file exceeds its supported bounds.');
  return {file, stat, ancestors:JSON.stringify(ancestors)};
}
function stamp(st) { return [st.dev,st.ino,st.size,st.mtimeMs,st.ctimeMs].join(':'); }
function readChecked(root, relative, max) {
  const before = regular(root, relative, max);
  const fd = fs.openSync(before.file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let bytes;
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || stamp(opened) !== stamp(before.stat)) fail('Publication file changed before reading.');
    const buffer = Buffer.alloc(before.stat.size + 1);
    const read = fs.readSync(fd,buffer,0,buffer.length,0);
    bytes = buffer.subarray(0,read);
    const finished = fs.fstatSync(fd);
    if (!finished.isFile() || finished.nlink !== 1 || stamp(finished) !== stamp(before.stat)) fail('Publication file changed while reading.');
  } finally { fs.closeSync(fd); }
  const after = regular(root, relative, max);
  if (before.ancestors !== after.ancestors || stamp(before.stat) !== stamp(after.stat) || bytes.length !== after.stat.size) fail('Publication file changed while reading.');
  return {relative, hash:sha(bytes), stamp:stamp(after.stat), bytes};
}
function imageType(bytes, extension) {
  const type = MIME[extension];
  const valid = type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : type === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : type === 'image/webp' ? bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
    : type === 'image/gif' ? /^GIF8[79]a$/.test(bytes.toString('ascii',0,6)) : false;
  if (!valid) fail('Unsupported publication image bytes.');
  return type;
}
function placements(story, origins = null) {
  const result = [];
  function add(shot, structuralPath, block = {}) {
    if (!shot || typeof shot.file !== 'string' || typeof shot.slot !== 'string') fail('Invalid maintained photograph placement.');
    const crop = {};
    for (const k of ['x','y']) if (shot[k] !== undefined) { if (!Number.isFinite(shot[k]) || shot[k] < 0 || shot[k] > 1) fail('Invalid photograph focal point.'); crop[k] = shot[k]; }
    if (block.aspect !== undefined) { if (typeof block.aspect !== 'string' || !/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(block.aspect)) fail('Invalid photograph aspect.'); crop.aspect = block.aspect; }
    result.push({file:shot.file,slot:shot.slot,structuralPath,label:structuralPath, ...(typeof shot.alt === 'string' ? {alt:shot.alt.slice(0,2000)} : {}), ...(Object.keys(crop).length ? {crop} : {})});
    if (origins?.has(shot)) Object.defineProperty(result.at(-1), 'nativeOrigin', {value:origins.get(shot), enumerable:false});
    if (result.length > 256) fail('Too many publication photograph placements.', 413);
  }
  function walk(blocks, at, depth = 0) {
    if (!Array.isArray(blocks) || blocks.length > 2000 || depth > 8) fail('Unsupported maintained article structure.');
    blocks.forEach((b,i) => {
      const key = `${at}/${i}/${b.kind}`;
      if (b.shot) add(b.shot,key,b);
      if (b.kind === 'photos') { if (!Array.isArray(b.shots) || b.shots.length > 256) fail('Invalid photo group.'); b.shots.forEach((s,k) => add(s,`${key}/${k}`,b)); }
      if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks,key,depth+1);
    });
  }
  if (story.portrait) add(story.portrait,'portrait');
  walk(story.opening,'opening');
  if (!Array.isArray(story.parts) || story.parts.length > 256 || !story.ending) fail('Unsupported maintained article structure.');
  story.parts.forEach((p,i) => { if (p.opener) add(p.opener,`parts/${i}/opener`); walk(p.blocks,`parts/${i}/blocks`); });
  walk(story.ending.blocks,'ending/blocks');
  if (story.ending.shot) add(story.ending.shot,'ending/shot',story.ending);
  return result;
}
// Origin tracing is optional read-only evidence. Any disagreement preserves the
// maintained parser's original photo view, never an inferred editable placement.
const UPSTREAM_PARSER = 'ffdb7750eef1bbd91b9e0ff22284c3d9ab019ed98f4e7aa999cac67e683772ef';
const UPSTREAM_SPEC = '71bee216b1066f44392c82d691fffa43cb0d28d132fe15d038fb07f69e115eae';
async function loadOriginParser() {
  const donorRoot = fs.realpathSync(new URL('../runtime/src/donors/mag/', import.meta.url));
  const {build} = require('esbuild');
  const checked = [];
  const result = await build({stdin:{contents:"export {draftBody,parseDraft} from './mag-send.ts';",resolveDir:donorRoot,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'fixed-origin-parser',setup(builder) {
    builder.onResolve({filter:/^[^./]/},()=>fail('Origin parser must use reviewed local code.'));
    builder.onLoad({filter:/.*/},args=>{
      const relative=path.relative(donorRoot,args.path);
      if(!['mag-send.ts','spec.ts'].includes(relative)) fail('Unsupported origin parser dependency.');
      const record=readChecked(donorRoot,relative,1024*1024);checked.push(record);
      return {contents:record.bytes.toString('utf8'),loader:'ts'};
    });
  }}]});
  for(const record of checked) if(readChecked(donorRoot,record.relative,1024*1024).hash!==record.hash) fail('Origin parser changed.');
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
function exactOrigins(resolved, body, range, observations) {
  const {text,hash:fileHash}=resolved.document, projection=resolved.projection;
  if(!Array.isArray(projection)||!projection.length||projection.length>4096) throw Error('projection-unavailable');
  const integer=v=>Number.isSafeInteger(v)&&v>=0;
  if(!range||range.offsetUnit!=='utf16'||!integer(range.start)||!integer(range.end)||range.start>range.end||range.end>text.length||text.slice(range.start,range.end)!==body) throw Error('body-range-mismatch');
  const ids=new Set();let previousEnd=0;
  for(const [index,row] of projection.entries()) {
    const origin=row?.origin;
    if(!row||row.id!=='magazine:'+encodeURIComponent(resolved.authority.pieceId)+':'+index||ids.has(row.id)||typeof row.raw!=='string'||!row.raw||!origin||origin.fileHash!==fileHash||!HEX.test(row.blockHash)||row.blockHash!==origin.blockHash||sha(row.raw)!==row.blockHash||!integer(origin.offset)||origin.offset<previousEnd||text.slice(origin.offset,origin.offset+row.raw.length)!==row.raw) throw Error('projection-mismatch');
    ids.add(row.id);previousEnd=origin.offset+row.raw.length;
  }
  if(!observations.length||observations.length>256) throw Error('occurrences-unavailable');
  const origins=new WeakMap(),groups=new Map();
  for(const {shot,origin:o} of observations) {
    if(!shot||typeof shot!=='object'||origins.has(shot)||!o||o.offsetUnit!=='utf16'||!['photo','photos','side','on-photo','saying'].includes(o.kind)||!['cover','opener','wide','bleed','photos','side','on-photo','ending'].includes(o.role)||!['chunkStart','chunkEnd','directiveStart','directiveEnd','groupIndex','groupSize','depth'].every(k=>integer(o[k]))||o.groupSize<1||o.groupSize>256||o.groupIndex>=o.groupSize||o.depth>8||o.chunkStart>o.directiveStart||o.directiveStart>=o.directiveEnd||o.directiveEnd>o.chunkEnd||o.chunkEnd>body.length) throw Error('occurrence-mismatch');
    const chunkStart=range.start+o.chunkStart,chunkEnd=range.start+o.chunkEnd,directiveStart=range.start+o.directiveStart,directiveEnd=range.start+o.directiveEnd;
    const matches=projection.filter(row=>row.safe===false&&row.origin.offset<=chunkStart&&row.origin.offset+row.raw.length>=chunkEnd);
    if(matches.length!==1) throw Error('protected-block-mismatch');
    const row=matches[0],directive=text.slice(directiveStart,directiveEnd);
    if(!directive.startsWith('%%'+o.kind+':')||!directive.endsWith('%%')||text.slice(chunkStart,chunkEnd)!==row.raw.trim()) throw Error('directive-range-mismatch');
    const key=directiveStart+':'+directiveEnd,group=groups.get(key)||{blockId:row.id,size:o.groupSize,kind:o.kind,role:o.role,depth:o.depth,indexes:new Set()};
    if(group.blockId!==row.id||group.size!==o.groupSize||group.kind!==o.kind||group.role!==o.role||group.depth!==o.depth||group.indexes.has(o.groupIndex)) throw Error('group-mismatch');
    group.indexes.add(o.groupIndex);groups.set(key,group);
    origins.set(shot,Object.freeze({blockId:row.id,fileHash,blockHash:row.blockHash,blockOffset:row.origin.offset,chunkStart,chunkEnd,directiveStart,directiveEnd,offsetUnit:'utf16',kind:o.kind,role:o.role,groupIndex:o.groupIndex,groupSize:o.groupSize,depth:o.depth}));
  }
  for(const group of groups.values()) if(group.indexes.size!==group.size) throw Error('group-mismatch');
  return origins;
}
export function createMagazineMediaInspection({repoRoot, resolveWorking, originTrace}) {
  if (typeof repoRoot !== 'string' || !path.isAbsolute(repoRoot) || typeof resolveWorking !== 'function') throw new TypeError('Supply a trusted checkout and exact working resolver.');
  if (fs.lstatSync(repoRoot).isSymbolicLink()) throw new TypeError('The configured checkout must be a direct directory.');
  // Trusted constructor-only test capability. It is never read from a request,
  // route, environment or user configuration; production callers omit it.
  const tracing = originTrace === undefined ? Object.freeze({parserHash:UPSTREAM_PARSER,specHash:UPSTREAM_SPEC,loadParser:loadOriginParser}) : originTrace;
  if (!tracing || Object.keys(tracing).some(k=>!['parserHash','specHash','loadParser'].includes(k)) || !HEX.test(tracing.parserHash) || !HEX.test(tracing.specHash) || typeof tracing.loadParser!=='function') throw new TypeError('Supply trusted origin parser code and pins.');
  const traceCapability=Object.freeze({parserHash:tracing.parserHash,specHash:tracing.specHash,loadParser:tracing.loadParser});
  const root = fs.realpathSync(repoRoot), rootStat = fs.lstatSync(root), rootId = digest(['magazine-publication',root]);
  let snapshot = null;
  function guardRoot() { const current = fs.lstatSync(root); if (fs.lstatSync(repoRoot).isSymbolicLink() || fs.realpathSync(repoRoot) !== root || current.isSymbolicLink() || !current.isDirectory() || current.dev !== rootStat.dev || current.ino !== rootStat.ino) fail('Publication checkout changed.'); }
  async function working(input) {
    guardRoot();
    const value = await resolveWorking({storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash});
    const {document,authority,target} = value || {};
    if (authority?.kind !== 'magazine' || authority.storyId !== input.storyId || authority.pieceId !== input.pieceId || typeof document?.text !== 'string' || Buffer.byteLength(document.text) > 2*1024*1024 || document.hash !== input.expectedHash || sha(document.text) !== input.expectedHash || typeof target?.nativeProjectId !== 'string' || !target.nativeProjectId || typeof target?.artifactId !== 'string' || !target.artifactId || target.hash !== input.expectedHash) fail('The exact working owner or draft hash changed.');
    return value;
  }
  async function modules() {
    const {build} = require('esbuild');
    const checked = new Map(); let total = 0;
    const result = await build({stdin:{contents:"export {CONVERSATIONS} from './src/pages/read/conversation/pieces/index.ts'; export {draftBody,parseDraft,memoryOf} from './src/pages/read/conversation/magSend.ts';",resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'bounded-magazine-code',setup(builder) {
      builder.onResolve({filter:/^[^./]/}, args => { fail('Publication modules must use local maintained source.'); });
      builder.onLoad({filter:/.*/}, args => {
        const relative = path.relative(root,args.path).split(path.sep).join('/');
        if (!relative.startsWith('src/pages/read/conversation/') || !/\.(?:ts|tsx|js|mjs)$/.test(relative)) fail('Unsupported publication module.');
        const record = readChecked(root,relative,1024*1024); total += record.bytes.length;
        if (checked.size >= 128 || total > 8*1024*1024) fail('Publication code exceeds bounded reader limits.',413);
        checked.set(relative,{...record,bytes:undefined});
        return {contents:record.bytes.toString('utf8'),loader:relative.endsWith('.tsx')?'tsx':relative.endsWith('.ts')?'ts':'js'};
      });
    }}]});
    guardRoot();
    const api = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
    // esbuild loads independent modules concurrently. Revision identity follows
    // exact source bytes and paths, never callback completion order.
    return {api,code:[...checked.values()].sort((a,b)=>a.relative<b.relative?-1:a.relative>b.relative?1:0)};
  }
  function guardCode(code) { for (const r of code) { const current = regular(root,r.relative,1024*1024); if (stamp(current.stat) !== r.stamp && readChecked(root,r.relative,1024*1024).hash !== r.hash) fail('Publication code changed; inspect again.'); } }
  async function publicationContext(input,{allowMissing=false}={}) {
    fields(input,['storyId','pieceId','expectedHash']);
    const resolved = await working(input);
    const fm = resolved.document.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
    const urlText = fm.match(/^published:\s*(https?:\/\/\S+)/m)?.[1];
    if(!/^published:/m.test(fm)&&allowMissing)return {resolved,code:[],spec:null,url:null};
    const {api,code}=await modules();
    let url; try { url = new URL(urlText); } catch { fail('This exact working draft has no explicit publication URL.'); }
    if (!['www.teajia.com','teajia.com'].includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !/^\/read\/[a-z0-9-]+$/.test(url.pathname)) fail('Unsupported explicit publication URL.');
    const matches = api.CONVERSATIONS?.filter(s => s.path === url.pathname && s.slug === url.pathname.split('/').at(-1));
    if (matches?.length !== 1) fail('Publication identity is missing or ambiguous.');
    const spec = matches[0];
    if (spec.images !== spec.path + '/') fail('Unsupported publication image directory.');
    return {resolved,api,code,spec,url};
  }
  async function publicationReference(input) {
    const {resolved,code,spec,url}=await publicationContext(input,{allowMissing:true});
    guardCode(code);await working(input);
    const workingOwnerRef={projectId:input.storyId,pieceId:input.pieceId,editionId:'working',artifactId:resolved.target.artifactId,hash:input.expectedHash};
    const id=url?digest(['recorded-publication-reference',rootId,url.href]):null;
    const revision=digest([workingOwnerRef,code.map(r=>[r.relative,r.hash]),id,url?.href||null]);
    const title=typeof spec?.title==='string'?spec.title:Array.isArray(spec?.title)&&spec.title.every(v=>typeof v==='string')?spec.title.join(' '):'Recorded article';
    return {schema:'ar-create.magazine-publication-reference.v1',revision,workingOwnerRef,nativeProjectId:resolved.target.nativeProjectId,publication:url?{id,url:url.href,title:title.trim()||'Recorded article',recordedBy:'working-draft-frontmatter',edition:null,date:null}:null};
  }
  async function inspect(input) { return (await inspectEdition(input)).media; }
  async function inspectEdition(input) {
    const {resolved,api,code,spec}=await publicationContext(input);
    const memory = api.memoryOf(spec), originalBody = api.draftBody(resolved.document.text).body;
    const parsed = api.parseDraft(originalBody,memory);
    let rows = placements(parsed), originTrace={status:'unavailable',reason:'projection-unavailable'};
    if(Array.isArray(resolved.projection)&&resolved.projection.length) {
      try {
        const pinCode=()=>{const parser=readChecked(root,'src/pages/read/conversation/magSend.ts',1024*1024),specCode=readChecked(root,'src/pages/read/conversation/spec.ts',1024*1024);if(parser.hash!==traceCapability.parserHash||specCode.hash!==traceCapability.specHash)throw Error('upstream-code-mismatch');};
        pinCode();
        const traced=await traceCapability.loadParser(), observations=[];let range;
        const body=traced.draftBody(resolved.document.text,value=>{if(range)throw Error('body-range-mismatch');range=value;}).body;
        if(body!==originalBody) throw Error('body-range-mismatch');
        const copy=traced.parseDraft(body,memory,(shot,origin)=>observations.push({shot,origin}));
        if(JSON.stringify(copy)!==JSON.stringify(parsed)) throw Error('parser-parity-mismatch');
        pinCode();
        const origins=exactOrigins(resolved,body,range,observations), tracedRows=placements(copy,origins);
        if(tracedRows.length!==observations.length||tracedRows.some(row=>!row.nativeOrigin)||JSON.stringify(tracedRows)!==JSON.stringify(rows)) throw Error('occurrence-coverage-mismatch');
        rows=tracedRows;originTrace={status:'ready',offsetUnit:'utf16',occurrences:observations.length,blocks:new Set(tracedRows.map(r=>r.nativeOrigin.blockId)).size};
      } catch(error) {
        const known=['projection-unavailable','body-range-mismatch','projection-mismatch','occurrences-unavailable','occurrence-mismatch','protected-block-mismatch','directive-range-mismatch','group-mismatch','upstream-code-mismatch','parser-parity-mismatch','occurrence-coverage-mismatch'];
        originTrace={status:'unavailable',reason:known.includes(error.message)?error.message:'trace-unavailable'};
      }
    }
    const files = new Map(), ownerRef = {projectId:input.storyId,pieceId:input.pieceId,editionId:'working',artifactId:resolved.target.artifactId,hash:input.expectedHash};
    let bytesTotal = 0;
    for (const row of rows) if (!files.has(row.file)) {
      if (path.basename(row.file) !== row.file) fail('Unsafe publication asset name.');
      const relative = `public${spec.images}${row.file}`, record = readChecked(root,relative,MAX_ASSET);
      bytesTotal += record.bytes.length; if (bytesTotal > 200*1024*1024) fail('Publication images exceed bounded reader limits.',413);
      const contentType = imageType(record.bytes,path.extname(row.file).toLowerCase());
      files.set(row.file,{...record,bytes:undefined,contentType,sourceId:digest([rootId,relative]),size:record.bytes.length});
    }
    guardCode(code);
    await working(input);
    const scope = digest([rootId,input.storyId,input.pieceId,input.expectedHash,ownerRef.artifactId]);
    const revision = digest([scope,code.map(r=>[r.relative,r.hash]),[...files.values()].map(r=>[r.sourceId,r.hash]),rows]);
    const sources = [...files.entries()].map(([name,r]) => {
      const sourceRef = {rootId,sourceId:r.sourceId,relativePath:r.relative.replace(/^public\//,''),hash:r.hash};
      return {id:r.sourceId,name,title:rows.find(p=>p.file===name)?.alt || name,sourceRef,ownerRef,previewKind:'magazine-publication',placements:rows.filter(p=>p.file===name).map(p=>({placementId:digest([scope,p.structuralPath,p.slot]),outputId:input.pieceId,editionId:'working',projectId:input.storyId,pieceId:input.pieceId,hash:input.expectedHash,sourceRef,label:p.label,slot:p.slot,structuralPath:p.structuralPath,...(p.crop?{crop:p.crop}:{}),...(p.alt?{alt:p.alt}:{}),...(p.nativeOrigin?{nativeOrigin:p.nativeOrigin}:{})}))};
    });
    snapshot = {input:{...input},scope,revision,code,files:new Map([...files.values()].map(r=>[r.sourceId,r])),ownerRef};
    const media={schema:'ar-create.magazine-media-inspection.v1',scope,revision,ownerRef,sources,originTrace,limitations:['Publication photographs; original camera files and album provenance are not established.','Placements come from this exact working draft. Live publication photo overrides and retained browser editions are separate.','Alternative text is not a caption or credit.']};
    return {media,parsed,spec,code,files};
  }
  async function workingEdition(input) {
    const {media,parsed,spec,code,files}=await inspectEdition(input);
    // The maintained canvas's nested Words surface supports only these forms.
    // Refuse anything it would omit rather than showing an incomplete edition.
    const walk=(blocks,nested=false,depth=0)=>{
      if(!Array.isArray(blocks)||depth>8)fail('Unsupported working article blocks.');
      for(const b of blocks){
        if(!b||!['q','a','n','line','side','glyph','photos','wide','bleed','on-photo'].includes(b.kind))fail('Unsupported working article block.');
        if(nested&&(!['q','a','n','line'].includes(b.kind)||b.kind==='line'&&b.follow))fail('This nested article layout cannot be rendered completely.');
        if(b.kind==='side'||b.kind==='glyph')walk(b.blocks,true,depth+1);
      }
    };
    walk(parsed.opening);for(const p of parsed.parts)walk(p.blocks);walk(parsed.ending.blocks);
    if(typeof parsed.intro!=='string'||typeof parsed.ending.saying?.text!=='string')fail('The working article is incomplete.');
    const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value||{},k)).map(k=>[k,structuredClone(value[k])]));
    const metadata=pick(spec,['slug','path','images','source','pageTitle','title','dek','form','credit']);
    metadata.subject=pick(spec.subject,['name','nameCn','role','href']);
    metadata.speakers=pick(spec.speakers,['author','subject']);
    metadata.author={...pick(spec.author,['name']),links:(spec.author?.links||[]).map(link=>pick(link,['label','href']))};
    metadata.next=(spec.next||[]).map(link=>pick(link,['to','kicker','title','blurb']));
    if(spec.share)metadata.share={...pick(spec.share,['line']),...(spec.share.photo?{photo:pick(spec.share.photo,['slot','file','alt','x','y'])}:{})};
    // Story fields come exclusively from this parse. In particular, absent
    // portrait/hook/closing never fall back to a previous publication's words.
    const currentSpec={...metadata,...pick(parsed,['portrait','intro','hook','opening','parts','ending','closing'])};
    for(const asset of files.values())if(readChecked(root,asset.relative,MAX_ASSET).hash!==asset.hash)fail('Publication photograph changed; inspect again.');
    guardCode(code);await working(input);guardCode(code);
    for(const asset of files.values())if(readChecked(root,asset.relative,MAX_ASSET).hash!==asset.hash)fail('Publication photograph changed; inspect again.');
    return {schema:'ar-create.magazine-working-edition.v1',revision:media.revision,ownerRef:media.ownerRef,spec:currentSpec,media};
  }
  // Read-only preparation: final prepare/save/Undo still use the maintained
  // native owner. Expose a hash so the client can verify that owner's prepared
  // candidate before requesting its existing CAS save; never accept caller raw.
  async function planMove(input) {
    fields(input,['storyId','pieceId','expectedHash','revision','placementId','beforeId']);
    const selection={storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash};
    const inspection=await inspect(selection);
    const {resolved,api,spec,code}=await publicationContext(selection);
    const plan=planMagazinePlacementMove({inspection,working:resolved,request:input});
    const model=native.capture(resolved.document.text,input.pieceId);
    model.blocks.forEach((block,i)=>{block.id='magazine:'+encodeURIComponent(input.pieceId)+':'+i;});
    const candidate=native.apply(model,resolved.document.text,plan.operations);
    if(candidate.reworks?.length||candidate.snapshot.prefix!==model.prefix||candidate.snapshot.blocks.length!==model.blocks.length) fail('The photo move would change other draft content.');
    const before=new Map(model.blocks.map(block=>[block.id,block.raw]));
    if(candidate.snapshot.blocks.some(block=>before.get(block.id)!==block.raw)||new Set(candidate.snapshot.blocks.map(block=>block.id)).size!==before.size) fail('The photo move would change draft words or layout content.');
    const original=api.parseDraft(api.draftBody(resolved.document.text).body,api.memoryOf(spec));
    const reparsed=api.parseDraft(api.draftBody(candidate.raw).body,api.memoryOf(original));
    const photoMeaning=story=>placements(story).map(({file,alt,crop})=>JSON.stringify({file,alt,crop})).sort();
    if(JSON.stringify(photoMeaning(original))!==JSON.stringify(photoMeaning(reparsed))) fail('The photo move would change a photo or its crop.');
    guardCode(code);await working(selection);
    return Object.freeze({...plan,schema:'ar-create.magazine-placement-plan.v1',expectedContentHash:sha(candidate.raw)});
  }
  async function planFocus(input) {
    if(!input||typeof input!=='object'||!['x','y'].every(k=>typeof input[k]==='number'&&Number.isFinite(input[k])&&input[k]>=0&&input[k]<=1))fail('Choose a photo focus from zero to one.',400);
    const {x,y,...proof}=input;fields(proof,['storyId','pieceId','expectedHash','revision','placementId']);
    const selection={storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash},inspection=await inspect(selection);
    const {resolved,api,spec,code}=await publicationContext(selection),plan=planMagazinePlacementFocus({inspection,working:resolved,request:input});
    const model=native.capture(resolved.document.text,input.pieceId);model.blocks.forEach((block,i)=>{block.id='magazine:'+encodeURIComponent(input.pieceId)+':'+i;});
    const candidate=native.apply(model,resolved.document.text,plan.operations),selectedId=plan.operations[0].id;
    if(candidate.reworks?.length||candidate.snapshot.prefix!==model.prefix||candidate.snapshot.blocks.length!==model.blocks.length||candidate.snapshot.blocks.some((b,i)=>b.id!==model.blocks[i].id||b.separator!==model.blocks[i].separator||b.id!==selectedId&&b.raw!==model.blocks[i].raw))fail('The focus adjustment would change other draft content.');
    const original=api.parseDraft(api.draftBody(resolved.document.text).body,api.memoryOf(spec)),reparsed=api.parseDraft(api.draftBody(candidate.raw).body,api.memoryOf(original));
    const selected=inspection.sources.flatMap(s=>s.placements).find(p=>p.placementId===input.placementId),before=placements(original),after=placements(reparsed);
    const wanted=structuredClone(before),at=wanted.findIndex(p=>p.structuralPath===selected.structuralPath);
    if(at<0)fail('The selected photo occurrence changed.');wanted[at].crop={...wanted[at].crop,x,y};
    if(!isDeepStrictEqual(wanted,after))fail('The focus adjustment would change another photo, caption or layout.');
    guardCode(code);const current=await working(selection);if(!current.supportedNativeOperations?.includes('photoFocus'))fail('The working editor no longer supports photo focus.');
    return Object.freeze({...plan,schema:'ar-create.magazine-placement-plan.v1',expectedContentHash:sha(candidate.raw)});
  }
  async function planAspect(input) {
    fields(input,['storyId','pieceId','expectedHash','revision','placementId','aspect']);
    if(!['4/3','4/5','1/1'].includes(input.aspect))fail('Choose a supported photo shape.',400);
    const selection={storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash},inspection=await inspect(selection);
    const {resolved,api,spec,code}=await publicationContext(selection),plan=planMagazinePlacementAspect({inspection,working:resolved,request:input});
    const model=native.capture(resolved.document.text,input.pieceId);model.blocks.forEach((block,i)=>{block.id='magazine:'+encodeURIComponent(input.pieceId)+':'+i;});
    const candidate=native.apply(model,resolved.document.text,plan.operations),selectedId=plan.operations[0].id;
    if(candidate.reworks?.length||candidate.snapshot.prefix!==model.prefix||candidate.snapshot.blocks.length!==model.blocks.length||candidate.snapshot.blocks.some((b,i)=>b.id!==model.blocks[i].id||b.separator!==model.blocks[i].separator||b.id!==selectedId&&b.raw!==model.blocks[i].raw))fail('The shape adjustment would change other draft content.');
    const original=api.parseDraft(api.draftBody(resolved.document.text).body,api.memoryOf(spec)),reparsed=api.parseDraft(api.draftBody(candidate.raw).body,api.memoryOf(original));
    const selected=inspection.sources.flatMap(s=>s.placements).find(p=>p.placementId===input.placementId),before=placements(original),after=placements(reparsed);
    const wanted=structuredClone(before),at=wanted.findIndex(p=>p.structuralPath===selected.structuralPath);
    if(at<0)fail('The selected photo occurrence changed.');wanted[at].crop={...wanted[at].crop,aspect:input.aspect};
    if(!isDeepStrictEqual(wanted,after))fail('The shape adjustment would change another photo, caption or layout.');
    // Compare the entire maintained article as well as its occurrence view.
    // Only this top-level wide block's aspect may differ after reparsing.
    const expected=structuredClone(original),match=selected.structuralPath.match(/^(opening|parts\/(\d+)\/blocks)\/(\d+)\/wide$/);
    const block=match&&(match[1]==='opening'?expected.opening:expected.parts[Number(match[2])]?.blocks)?.[Number(match[3])];
    if(!block||block.kind!=='wide')fail('The selected photo layout changed.');
    block.aspect=input.aspect;
    if(!isDeepStrictEqual(expected,reparsed))fail('The shape adjustment would change article words or layout.');
    guardCode(code);const current=await working(selection);
    if(!current.supportedNativeOperations?.includes('photoAspect')||current.target.artifactId!==plan.ownerRef.artifactId||current.target.nativeProjectId!==resolved.target.nativeProjectId)fail('The working editor or photo owner changed.');
    return Object.freeze({...plan,schema:'ar-create.magazine-placement-plan.v1',expectedContentHash:sha(candidate.raw)});
  }
  async function planReplace(input) {
    fields(input,['storyId','pieceId','expectedHash','revision','placementId','replacementPlacementId','sourceId','sourceHash']);
    const selection={storyId:input.storyId,pieceId:input.pieceId,expectedHash:input.expectedHash},inspection=await inspect(selection);
    const {resolved,api,spec,code}=await publicationContext(selection),plan=planMagazinePlacementReplace({inspection,working:resolved,request:input});
    const model=native.capture(resolved.document.text,input.pieceId);model.blocks.forEach((block,i)=>{block.id='magazine:'+encodeURIComponent(input.pieceId)+':'+i;});
    const candidate=native.apply(model,resolved.document.text,plan.operations),selectedId=plan.operations[0].id;
    if(candidate.reworks?.length||candidate.snapshot.prefix!==model.prefix||candidate.snapshot.blocks.length!==model.blocks.length||candidate.snapshot.blocks.some((b,i)=>b.id!==model.blocks[i].id||b.separator!==model.blocks[i].separator||b.id!==selectedId&&b.raw!==model.blocks[i].raw))fail('The replacement would change other draft content.');
    const original=api.parseDraft(api.draftBody(resolved.document.text).body,api.memoryOf(spec)),reparsed=api.parseDraft(api.draftBody(candidate.raw).body,api.memoryOf(original));
    const all=inspection.sources.flatMap(s=>s.placements),selected=all.find(p=>p.placementId===input.placementId),source=all.find(p=>p.placementId===input.replacementPlacementId);
    const expected=structuredClone(original),blockAt=(story,structuralPath)=>{const match=structuralPath.match(/^(opening|parts\/(\d+)\/blocks)\/(\d+)\/(wide|bleed)$/);return match&&(match[1]==='opening'?story.opening:story.parts[Number(match[2])]?.blocks)?.[Number(match[3])];};
    const block=blockAt(expected,selected.structuralPath),donor=blockAt(original,source.structuralPath);
    if(!block?.shot||!donor?.shot)fail('The selected photo layout changed.');
    block.shot.file=donor.shot.file;block.shot.alt=donor.shot.alt;block.shot.slot=donor.shot.slot;
    if(!isDeepStrictEqual(expected,reparsed))fail('The replacement would change article words, layout, crop or other photographs.');
    const files=snapshot?.files;
    if(!files||snapshot.revision!==inspection.revision)fail('The photo catalog changed; inspect again.');
    const guardAssets=()=>{for(const asset of files.values())if(readChecked(root,asset.relative,MAX_ASSET).hash!==asset.hash)fail('Publication photograph changed; inspect again.');};
    guardAssets();guardCode(code);const current=await working(selection);guardCode(code);guardAssets();
    if(!current.supportedNativeOperations?.includes('photoReplace')||current.target.artifactId!==plan.ownerRef.artifactId||current.target.nativeProjectId!==resolved.target.nativeProjectId)fail('The working editor or photo owner changed.');
    return Object.freeze({...plan,schema:'ar-create.magazine-placement-plan.v1',expectedContentHash:sha(candidate.raw)});
  }
  async function preview(input) {
    fields(input,['storyId','pieceId','expectedHash','sourceId','sourceHash','revision']);
    const s = snapshot;
    if (!s || s.revision !== input.revision || ['storyId','pieceId','expectedHash'].some(k=>s.input[k]!==input[k])) fail('Inspect this exact Magazine photo revision again.');
    await working(input); guardCode(s.code);
    for (const asset of s.files.values()) {
      const current = regular(root,asset.relative,MAX_ASSET);
      if (stamp(current.stat) !== asset.stamp && readChecked(root,asset.relative,MAX_ASSET).hash !== asset.hash) fail('Publication photo revision changed; inspect again.');
    }
    const r = s.files.get(input.sourceId);
    if (!r || r.hash !== input.sourceHash) fail('Photograph is not in this exact revision.');
    const current = readChecked(root,r.relative,MAX_ASSET);
    if (current.hash !== r.hash) fail('Publication photograph changed; inspect again.');
    await working(input);
    return {body:current.bytes,contentType:r.contentType,contentLength:current.bytes.length,hash:r.hash,revision:s.revision};
  }
  const safe = action => async input => {
    try { return await action(input); }
    catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) throw error;
      throw Object.assign(new Error('Publication photographs are unavailable; inspect the working draft again.'), {status:409, cause:error});
    }
  };
  return {inspect:safe(inspect),workingEdition:safe(workingEdition),preview:safe(preview),publicationReference:safe(publicationReference),planMove:safe(planMove),planFocus:safe(planFocus),planAspect:safe(planAspect),planReplace:safe(planReplace)};
}
