import {collectionPair,liveCollectionLink,resolvedCollectionLinks} from './donors/study/collection-relationships.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { StateError, MAX_BODY_BYTES } from '../store.mjs';
import { readFolder, splitFrontmatter, slugifyName } from './wordforge-sources.mjs';
import { normalizeSourceUrl } from './source-identity.mjs';
import { createScraper } from './wordforge-firecrawl.mjs';
import { atomicWrite, readJson, digest, safeRel, regular, resolveInside, ensurePrivateDirectory } from './files.mjs';
import {assertUnusedSourceId} from './source-references.mjs';

// A repeated quartet regex exhausts V8's stack on large recordings. Scan the
// alphabet once, checking quartet length and final padding separately.
function validBase64(value) {
  if (value.length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return !/[^A-Za-z0-9+/]/.test(value.slice(0, value.length - padding));
}

const TEXT = new Set(['.md', '.markdown', '.txt']);
const fileStamp = stat => `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
async function streamHash(file) { const hash=createHash('sha256'); for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex'); }
const now = () => new Date().toISOString();
function string(value, label, max = MAX_BODY_BYTES) { if (typeof value !== 'string' || value.length > max) throw new StateError(`${label} must be text under ${max} characters.`); return value; }

/** Adapted WordForge shelves and Board references, isolated from vault/db/runtime. */
export function createLibrary({ dataDir, connections = [], legacyState = () => ({ project: { sources: [] } }), extraction = null, urlIngestion = null, ingestionState = null, recordingState = null, recordingSourceSnapshot = null }) {
  const scrape = extraction ? createScraper(extraction) : null;
  const owned = path.join(dataDir, 'library');
  fs.mkdirSync(owned, { recursive: true, mode: 0o700 });
  resolveInside(owned, '', { directory: true });
  const recordingShelf = ensurePrivateDirectory(dataDir, 'recordings');
  const roots = [{ id: 'library', name: 'My library', path: fs.realpathSync(owned), writable: true }, { id: 'recordings', name: 'Recording files', path: fs.realpathSync(recordingShelf), writable: false, owner: 'ar-create-magazine' }];
  function configuredRoots(entries) {
    if (!Array.isArray(entries) || entries.length > 64) throw new StateError('Invalid explicitly configured read-only roots.');
    const configured=[];
    for (const entry of entries) {
      if (!entry || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || ['library', 'recordings'].includes(entry.id) || configured.some(r => r.id === entry.id) || typeof entry.path !== 'string' || !path.isAbsolute(entry.path)) throw new StateError('Invalid explicitly configured read-only root.');
      let configuredPath=entry.path,available=true;
      try{resolveInside(entry.path, '', { directory: true });configuredPath=fs.realpathSync(entry.path);}catch(error){if(error.code!=='ENOENT')throw error;available=false;}
      configured.push({ id: entry.id, name: entry.name || entry.id, path: configuredPath, writable: false,available });
    }
    return configured;
  }
  roots.push(...configuredRoots(connections));
  const indexFile = path.join(dataDir, 'library-index.json');
  let index = readJson(indexFile, { revision: 0, sources: [], collections: [], evidence: [], legacyImported: [] });
  if (!Array.isArray(index.sources) || !Array.isArray(index.collections) || !Array.isArray(index.evidence)) throw new Error('Invalid library index; files preserved.');
  // Old indexes acquire an empty optional edge registry without copying policy
  // or rewriting source/collection membership. Malformed records stay on disk.
  if (index.collectionRelationships === undefined) index.collectionRelationships = [];
  if (!Array.isArray(index.collectionRelationships) || index.collectionRelationships.some(item => !item || typeof item.id !== 'string' || typeof item.sourceId !== 'string' || typeof item.destinationId !== 'string' || item.sourceId === item.destinationId || !['accepted','detached'].includes(item.status) || item.relationshipType !== 'relates-to') || new Set(index.collectionRelationships.map(item=>item.id)).size !== index.collectionRelationships.length) throw new Error('Invalid library index; files preserved.');
  const folderMetadata = new Map();
  let pending = Promise.resolve();
  function serial(fn) { const op = pending.then(fn); pending = op.catch(() => {}); return op; }
  function persist() { index.revision++; atomicWrite(indexFile, JSON.stringify(index, null, 2)); }
  function persistCollectionRelationship(change) {
    const previous=structuredClone(index.collectionRelationships),revision=index.revision;
    try { change(); persist(); }
    catch(error) {
      // Atomic publication may have succeeded before a directory sync failed.
      // Disk is authoritative when readable; otherwise restore the prior view.
      try { index=readJson(indexFile,index);if(index.collectionRelationships===undefined)index.collectionRelationships=[]; }
      catch { index.collectionRelationships=previous;index.revision=revision; }
      throw error;
    }
  }
  function rootById(id = 'library', write = false) { const root = roots.find(r => r.id === id); if (!root) throw new StateError('Unknown configured library root.', 404); if (write && !root.writable) throw new StateError('Connected original roots are read-only.', 403); return root; }
  function publicSource(source) { const root = rootById(source.rootId); const { originalFile, ...metadata } = source; return { ...metadata, sourceUnavailable:root.available===false, ...(root.available===false?{cardEligibility:{eligible:false,reason:'The connected folder is unavailable. Reconnect it before reading or keeping a passage.'}}:{}), originalUrl: originalFile ? `/api/sources/blob?id=${encodeURIComponent(source.id)}&original=1` : null, path: path.join(root.path, source.rel_path), writable: root.writable, url: source.source_url || '', body: undefined }; }
  function sourceById(id) { const source = index.sources.find(s => s.id === id && !s.missing && !s.managedTerminalSnapshot); if (!source) throw new StateError('Source was not found. Refresh the library.', 404); return source; }
  function checkedFile(source, write = false) { const root = rootById(source.rootId, write);if(root.available===false)throw new StateError('The source folder is unavailable. Reconnect it and refresh the library.',503); const file = resolveInside(root.path, source.rel_path); if (write) regular(file); else { const stat = fs.lstatSync(file); if (!stat.isFile()) throw new StateError('Source must be a regular file.'); } return file; }
  function makeFolder(rootId, folder) { const root = rootById(rootId, true); safeRel(folder, false); resolveInside(root.path, folder, { directory: true, createParents: true }); }
  function savedFile(rootId, folder, name, bytes, provenance, legacyId) {
    const root = rootById(rootId, true); safeRel(folder); safeRel(name, false); if (name.includes('/')) throw new StateError('File name must not contain a folder.');
    resolveInside(root.path, folder, { directory: true, createParents: true });
    let rel = path.posix.join(folder, name); const ext = path.extname(name), stem = name.slice(0, name.length - ext.length); let number = 2;
    while (fs.lstatSync(path.join(root.path, rel), { throwIfNoEntry: false })) { if (number > 50) throw new StateError('Too many name collisions; no file overwritten.', 409); rel = path.posix.join(folder, `${stem}-${number++}${ext}`); }
    const file = resolveInside(root.path, rel, { missing: true }); atomicWrite(file, bytes, { exclusive: true });
    const stat = fs.lstatSync(file); const id = legacyId || randomUUID();
    const originals = path.join(dataDir, 'source-originals'); fs.mkdirSync(originals, { recursive: true, mode: 0o700 }); resolveInside(originals, '', { directory: true });
    const originalFile = path.join(originals, `${digest(id)}-${digest(bytes)}${ext}`); atomicWrite(originalFile, bytes, { exclusive: true });
    const source = { id, rootId: root.id, rel_path: rel, originalFile, hash: digest(bytes), fileStamp: fileStamp(stat), inode: `${stat.dev}:${stat.ino}`, provenance: { capturedAt: now(), ...provenance }, status: 'retained', missing: false };
    index.sources.push(source); return source;
  }
  function importLegacy() {
    for (const source of legacyState().project.sources) {
      if (index.legacyImported.includes(source.id)) continue;
      if (!index.sources.some(s => s.id === source.id)) savedFile('library', 'Earlier sources', `${slugifyName(source.title)}.md`, `---\ntitle: ${JSON.stringify(source.title)}\n${source.url ? `source_url: ${JSON.stringify(source.url)}\n` : ''}---\n\n${source.body}`, { kind: 'existing-workspace', originalId: source.id, originalUrl: source.url }, source.id);
      index.legacyImported.push(source.id);
    }
  }
  // Only the terminal's own recorded cwd can identify a managed snapshot.
  // A matching filename/header elsewhere is still ordinary user research.
  function terminalSnapshotPaths() {
    const result = new Set(), dir = path.join(dataDir, 'terminal');
    if (!fs.existsSync(dir)) return result;
    resolveInside(dataDir, 'terminal', { directory: true });
    for (const name of fs.readdirSync(dir).filter(name => /^[a-f0-9-]{36}\.json$/.test(name))) {
      let session; try { session = readJson(path.join(dir, name), null); } catch { continue; }
      if (!session || session.id !== name.slice(0, -5) || typeof session.cwd !== 'string' || !path.isAbsolute(session.cwd)) continue;
      try {
        const file = path.join(fs.realpathSync(session.cwd), 'accepted-manuscript.snapshot.md');
        if (!file.startsWith(roots[0].path + path.sep)) continue;
        const checked = resolveInside(roots[0].path, path.relative(roots[0].path, file)); regular(checked);
        const fd = fs.openSync(checked, 'r'); let prefix;
        try { const bytes = Buffer.alloc(256), length = fs.readSync(fd, bytes, 0, bytes.length, 0); prefix = bytes.subarray(0, length).toString('utf8'); } finally { fs.closeSync(fd); }
        if (/^<!-- Read-only-in-purpose saved manuscript snapshot; edits here are not accepted into the writing document automatically\. Revision [0-9]+\. -->\n\n/.test(prefix)) result.add(file);
      } catch { /* Unavailable/unrecognised files stay outside this narrow exclusion. */ }
    }
    return result;
  }
  function refresh() {
    const before = JSON.stringify(index); importLegacy();
    if (folderMetadata.size > 20000) folderMetadata.clear();
    const managedSnapshots = terminalSnapshotPaths();
    for (const source of index.sources) { if (source.rootId === 'library' && managedSnapshots.has(path.join(roots[0].path, source.rel_path))) source.managedTerminalSnapshot = true; else delete source.managedTerminalSnapshot; }
    const seen = new Set(); const incompleteRoots = new Set(); const trees = [];
    const unavailable=root=>{root.available=false;root.connectionError='Folder unavailable or its scan could not complete. Reconnect it and refresh.';incompleteRoots.add(root.id);trees.push({...root,tree:{rel_path:'',name:root.name,file_count:0,total_count:0,conflict_count:0,folders:[],files:[]}});};
    for (const root of roots) {
      let tree;
      try{resolveInside(root.path, '', { directory: true });const lexical=root.path.replace(/^\/(tmp|var)(?=\/|$)/,'/private/$1');if(fs.realpathSync(root.path)!==lexical)throw new StateError('A connected folder path changed into a symlink.',403);tree = readFolder(root.path, '', { count: 0, max: 20000, truncated: false, metadataCache: folderMetadata,throwOnReadError:true });root.available=true;delete root.connectionError;}
      catch{unavailable(root);continue;}
      if (root.id === 'library' && managedSnapshots.size) {
        const prune = folder => { folder.files = folder.files.filter(file => !managedSnapshots.has(path.join(root.path, file.rel_path))); for (const child of folder.folders) prune(child); folder.file_count = folder.files.length; folder.total_count = folder.file_count + folder.folders.reduce((total, child) => total + child.total_count, 0); };
        prune(tree);
      }
      if (root.id === 'recordings') { tree.files = tree.files.filter(file => !['runner-config.json', 'source-links.json'].includes(file.rel_path)); tree.file_count = tree.files.length; tree.total_count = tree.file_count + tree.folders.reduce((total, folder) => total + folder.total_count, 0); }
      if (tree.truncated) incompleteRoots.add(root.id);
      const flat = [];
      function collect(folder) { for (const file of folder.files) flat.push(file); for (const child of folder.folders) collect(child); }
      collect(tree);
      const inodeCounts = new Map(),scanStats=new Map();
      try{for (const meta of flat) { const stat = fs.lstatSync(resolveInside(root.path, meta.rel_path));scanStats.set(meta.rel_path,stat); const inode = `${stat.dev}:${stat.ino}`; inodeCounts.set(inode, (inodeCounts.get(inode) || 0) + 1); }}catch{unavailable(root);continue;}
      // Match the whole scan before mutating paths. Inode-first matching preserves
      // references across a name swap or a move whose old path now holds a new file.
      // Ambiguous hardlinks stay path-based; missing old inodes are never guessed.
      const previous=index.sources.filter(source=>source.rootId===root.id),matches=new Map(),claimed=new Set(),previousInodes=new Map(),previousPaths=new Map();
      for(const source of previous){previousPaths.set(source.rel_path,source);if(!source.missing){const candidates=previousInodes.get(source.inode)||[];candidates.push(source);previousInodes.set(source.inode,candidates);}}
      for(const meta of flat){const stat=scanStats.get(meta.rel_path),inode=`${stat.dev}:${stat.ino}`,candidates=previousInodes.get(inode)||[];if(inodeCounts.get(inode)===1&&candidates.length===1){matches.set(meta.rel_path,candidates[0]);claimed.add(candidates[0].id);}}
      for(const meta of flat)if(!matches.has(meta.rel_path)){const source=previousPaths.get(meta.rel_path);if(source&&!claimed.has(source.id)){matches.set(meta.rel_path,source);claimed.add(source.id);}}
      for (const meta of flat) {
        const file = resolveInside(root.path, meta.rel_path), stat = scanStats.get(meta.rel_path);
        const inode = `${stat.dev}:${stat.ino}`;
        let source = matches.get(meta.rel_path);
        if (!source) { source = { id: randomUUID(), rootId: root.id, provenance: { kind: root.writable ? 'external-file' : 'connected-root', capturedAt: now(), originalPath: file } }; index.sources.push(source); }
        const stamp = fileStamp(stat), changed = source.fileStamp !== stamp;
        const textFile = TEXT.has(path.extname(file).toLowerCase());
        let body = null, hash = changed ? null : source.hash ?? null;
        if (textFile && stat.size <= MAX_BODY_BYTES) {
          if (changed || source.hasReadableBody === undefined) { const bytes=fs.readFileSync(file); hash=digest(bytes);body=splitFrontmatter(bytes.toString('utf8'));source.hasReadableBody=Boolean(body.body.trim());source.processingStatus=body.frontmatter.processing_status;source.reviewDeclaration=body.frontmatter.review_status; }
          else body={frontmatter:{processing_status:source.processingStatus,review_status:source.reviewDeclaration,source_url:source.source_url,recording_id:source.recordingId},body:source.hasReadableBody?'present':''};
        }
        Object.assign(source, meta, { hash, fileStamp: stamp, hashStatus: hash ? 'verified' : 'deferred-until-open', inode, missing: false });
        source.status = textFile && stat.size > MAX_BODY_BYTES ? 'retained-text-too-large' : source.kind === 'audio' ? 'retained-needs-transcription' : source.kind === 'other' || source.kind === 'pdf' ? 'retained-needs-extraction' : ['link', 'web-extraction'].includes(source.provenance.kind) && body?.frontmatter.processing_status && body.frontmatter.processing_status !== 'ready' ? body.frontmatter.processing_status : 'ready';
        source.source_url ||= body?.frontmatter.source_url;
        if (body?.frontmatter.recording_id) source.recordingId = body.frontmatter.recording_id;
        if(source.ingestionJobId && ingestionState) { const job=ingestionState(source.ingestionJobId);if(job) { source.status = ({queued:'queued',running:'processing',done:'ready',attention:'needs-captions',failed:'needs-extraction',conflict:'conflict'})[job.state] || source.status;source.processingError=job.error || job.captionError || null;if(job.backend)source.provenance.extraction={jobId:job.id,backend:job.backend,rawFiles:job.rawFiles}; } }
        const recording = source.kind === 'audio' && recordingState ? recordingState(source.id) : null;
        const transcript = recordingSourceSnapshot?.({...source,path:file});
        if(transcript?.managed)source.transcriptState={coherent:transcript.coherent,reviewStatus:transcript.reviewStatus,reason:transcript.reason||null,jobId:transcript.jobId};else delete source.transcriptState;
        const reviewed = transcript?.managed ? transcript.coherent&&transcript.reviewStatus==='reviewed' : body?.frontmatter.review_status === 'reviewed' || recording?.reviewStatus === 'reviewed';
        const readable = Boolean(body?.body.trim());
        const extractionState = ['queued','processing','needs-extraction','conflict'].includes(source.status) ? source.status : source.status === 'retained-text-too-large' ? 'unavailable' : source.status === 'needs-captions' ? 'metadata-only' : source.kind === 'audio' ? 'not-applicable' : source.kind === 'pdf' || source.kind === 'other' ? 'unavailable' : 'ready';
        source.pipelineStates = {
          retention: { state: 'retained', originalAvailable: Boolean(source.originalFile) || !root.writable, hash: source.hash },
          extraction: { state: extractionState, method: source.provenance.extraction?.backend || source.provenance.backend || (body ? 'supplied-text' : 'none') },
          transcription: { state: source.kind === 'transcript' ? 'available' : source.kind === 'audio' ? recording?.state === 'unavailable' ? 'unavailable' : recording?.transcriptReady ? 'available' : recording?.state === 'running' ? 'processing' : recording?.state === 'failed' ? 'failed' : 'saved-only' : source.status === 'needs-captions' ? 'unavailable' : 'not-applicable', ...(recording?.state==='unavailable'?{reason:recording.reason}:{}), method: source.provenance.extraction?.backend === 'copied-i64os-yt-dlp' ? 'youtube-captions' : source.kind === 'audio' || source.recordingId ? 'magazine-local' : source.kind === 'transcript' ? 'supplied-transcript' : 'none' },
          review: { state: reviewed ? 'reviewed' : 'unreviewed', basis: transcript?.managed ? transcript.coherent?'recorded-workshop-snapshot':'transcript-needs-reconciliation' : reviewed ? recording?.reviewStatus === 'reviewed' ? 'recorded-workshop-review' : 'source-declaration' : 'no-human-review-recorded' },
        };
        source.cardEligibility = source.provenance?.kind === 'piece-writing-template' ? { eligible: false, reason: 'This is writing guidance for a piece, not source evidence.' } : { eligible: readable && source.status === 'ready', reason: readable && source.status === 'ready' ? reviewed ? 'Readable material; human review is recorded.' : 'Readable material; human review is still unrecorded.' : source.kind === 'audio' ? 'Choose its transcript before making a text card.' : 'Readable extraction is not ready.' };
        if(recording?.state==='unavailable')source.cardEligibility={eligible:false,reason:recording.reason};
        if(transcript?.managed&&!transcript.coherent)source.cardEligibility={eligible:false,reason:transcript.reason||'Open this recording’s transcript to review outside edits before using it.'};
        seen.add(source.id); Object.assign(meta, publicSource(source));
      }
      trees.push({ ...root, tree });
    }
    for (const source of index.sources) if (!seen.has(source.id) && !incompleteRoots.has(source.rootId)) source.missing = true;
    if (JSON.stringify(index) !== before) persist();
    return { revision: index.revision, roots: trees, sources: index.sources.filter(s => !s.missing && !s.managedTerminalSnapshot).map(publicSource), collections: index.collections, missingSources: index.sources.filter(s => s.missing&&!s.managedTerminalSnapshot).map(missingSummary), unavailableSources: index.sources.filter(s => !s.missing&&!s.managedTerminalSnapshot&&roots.find(root=>root.id===s.rootId)?.available===false).map(missingSummary) };
  }
  const externalRoot = root => root && !['library','recordings'].includes(root.id) && !root.writable;
  function missingSummary(source) {
    const root=roots.find(root=>root.id===source.rootId),external=externalRoot(root)&&source.provenance?.kind==='connected-root';
    return {id:source.id,rootId:source.rootId,rootName:root?.name||source.rootId,title:source.title||source.name||path.basename(source.rel_path),rel_path:source.rel_path,hash:source.hash||null,reconnectable:!!external&&/^[a-f0-9]{64}$/.test(source.hash||''),reason:!root?'Connect the original folder before reconciling this file.':!external?'Only a missing external file can be reconnected.':!/^[a-f0-9]{64}$/.test(source.hash||'')?'No verified captured hash; identity cannot be reconciled safely.':root.available===false?'Original folder unavailable.':'File missing.'};
  }
  function reconnectionPair(input) {
    const originals=index.sources.filter(source=>source.id===input.sourceId),targets=index.sources.filter(source=>source.id===input.targetId);
    if(originals.length!==1||targets.length!==1||input.sourceId===input.targetId)throw new StateError('Choose one retained missing identity and one current file.',409);
    const source=originals[0],target=targets[0],oldRoot=roots.find(root=>root.id===source.rootId),newRoot=rootById(target.rootId);
    if(!externalRoot(oldRoot)||source.provenance?.kind!=='connected-root'||!externalRoot(newRoot)||target.provenance?.kind!=='connected-root'||target.originalFile||source.managedTerminalSnapshot||target.managedTerminalSnapshot)throw new StateError('Choose missing and current files from explicitly connected read-only folders.',409);
    if(!/^[a-f0-9]{64}$/.test(source.hash||''))throw new StateError('The missing file has no verified captured hash. Its identity cannot be reconciled safely.',409);
    let absent=false;
    try{const previous=resolveInside(oldRoot.path,source.rel_path);if(fs.lstatSync(previous).isFile())throw new StateError('The original location still contains a file. No identity was changed.',409);}
    catch(error){if(error.code==='ENOENT'||error.status===404)absent=true;else throw error;}
    if(!absent||(!source.missing&&oldRoot.available!==false))throw new StateError('The original location is not confirmed missing. Refresh or reconnect its folder first.',409);
    if(target.missing||newRoot.available===false)throw new StateError('Choose an available current file.',409);
    const file=checkedFile(target),stat=regular(file);if(stat.size>128*1024*1024)throw new StateError('This file exceeds the bounded 128 MB reconnection check.',413);
    if(index.sources.some(other=>other.id!==source.id&&other.id!==target.id&&!other.missing&&other.inode===`${stat.dev}:${stat.ino}`))throw new StateError('The current file has an ambiguous indexed identity. No identity was changed.',409);
    return {source,target,oldRoot,newRoot,file,stat};
  }
  async function reconnectPreview(input={}) {
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['sourceId','targetId'].includes(key))||typeof input.sourceId!=='string'||typeof input.targetId!=='string')throw new StateError('Choose the missing source and an explicit current file.');
    refresh();const pair=reconnectionPair(input),hash=await streamHash(pair.file);
    if(hash!==pair.source.hash)throw new StateError('The chosen file does not match the captured SHA-256. It remains a separate source.',409);
    if(fileStamp(regular(checkedFile(pair.target)))!==fileStamp(pair.stat))throw new StateError('The chosen file changed while checking its bytes. Preview again.',409);
    const checkedReferences=assertUnusedSourceId({dataDir,index,sourceId:pair.target.id});
    return {source:{id:pair.source.id,title:pair.source.title||pair.source.name,rootId:pair.source.rootId,rootName:pair.oldRoot.name,rel_path:pair.source.rel_path,hash:pair.source.hash},target:{id:pair.target.id,title:pair.target.title||pair.target.name,rootId:pair.target.rootId,rootName:pair.newRoot.name,rel_path:pair.target.rel_path,path:pair.file,hash},checkedReferences,confirmation:{sourceId:pair.source.id,targetId:pair.target.id,expectedRevision:index.revision,expectedSourceHash:pair.source.hash,expectedTargetHash:hash,expectedTargetRootId:pair.target.rootId,expectedTargetPath:pair.target.rel_path,expectedTargetStamp:fileStamp(pair.stat)}};
  }
  async function reconnectMoved(input={}) {
    const keys=['sourceId','targetId','expectedRevision','expectedSourceHash','expectedTargetHash','expectedTargetRootId','expectedTargetPath','expectedTargetStamp','confirmed'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key))||!keys.every(key=>Object.hasOwn(input,key))||input.confirmed!==true||!Number.isSafeInteger(input.expectedRevision))throw new StateError('Preview and explicitly confirm this moved file before reconnecting it.');
    refresh();if(input.expectedRevision!==index.revision)throw new StateError('The Library changed after the preview. Preview the current file again.',409);
    const pair=reconnectionPair(input);
    if(pair.source.hash!==input.expectedSourceHash||pair.target.rootId!==input.expectedTargetRootId||pair.target.rel_path!==input.expectedTargetPath||fileStamp(pair.stat)!==input.expectedTargetStamp)throw new StateError('The selected source or destination changed after the preview. Preview again.',409);
    const hash=await streamHash(pair.file);if(hash!==input.expectedTargetHash||hash!==pair.source.hash)throw new StateError('The current file no longer matches the captured bytes. No identity was changed.',409);
    const checkedReferences=assertUnusedSourceId({dataDir,index,sourceId:pair.target.id});
    if(fileStamp(regular(checkedFile(pair.target)))!==input.expectedTargetStamp)throw new StateError('The selected current file changed. No identity was changed.',409);
    const from={rootId:pair.source.rootId,rootName:pair.oldRoot.name,rel_path:pair.source.rel_path,hash:pair.source.hash,inode:pair.source.inode},to={rootId:pair.target.rootId,rootName:pair.newRoot.name,rel_path:pair.target.rel_path,hash,inode:pair.target.inode};
    const receipt={id:randomUUID(),kind:'operator-confirmed-file-reconnection',confirmedAt:now(),from,to,absorbedTarget:{...pair.target},checkedReferences};
    const restored={...pair.source,...pair.target,id:pair.source.id,hash,hashStatus:'verified',provenance:pair.source.provenance,source_url:pair.source.source_url||pair.target.source_url,originalFile:pair.source.originalFile,reconciliationHistory:[...(pair.source.reconciliationHistory||[]),receipt]};
    index.sources=index.sources.filter(source=>source.id!==pair.target.id).map(source=>source.id===pair.source.id?restored:source);persist();refresh();
    return {source:publicSource(restored),receipt,revision:index.revision};
  }
  function read(id,{allowUnreconciled=false}={}) {
    refresh(); const source = sourceById(id), file = checkedFile(source); const extension = path.extname(file).toLowerCase();
    const readable = TEXT.has(extension); let raw = null, text = null;
    if (readable) { if (fs.statSync(file).size > MAX_BODY_BYTES) throw new StateError('Text exceeds the 2 MB reader limit.', 413); raw = fs.readFileSync(file, 'utf8'); text = splitFrontmatter(raw).body; }
    const transcript=recordingSourceSnapshot?.({...source,path:file});
    if(transcript?.managed&&!transcript.coherent&&!allowUnreconciled)throw new StateError(transcript.reason||'Open this recording’s transcript to review outside edits before using it.',409);
    const parts = source.rel_path.split('/'); const breadcrumbs = [{ name: rootById(source.rootId).name, rel_path: '' }, ...parts.slice(0, -1).map((name, i) => ({ name, rel_path: parts.slice(0, i + 1).join('/') }))];
    return { ...publicSource(source), raw, text, body: text, breadcrumbs, blobUrl: `/api/sources/blob?id=${encodeURIComponent(id)}` };
  }
  function expected(source, hash) { if (typeof hash !== 'string' || hash !== source.hash || digest(fs.readFileSync(checkedFile(source))) !== hash) throw new StateError('Source changed outside this edit. Refresh before saving.', 409); }
  return {
    setConnections: (entries, beforeCommit = () => {}) => serial(() => { const configured=configuredRoots(entries);beforeCommit();roots.splice(2,roots.length-2,...configured);folderMetadata.clear();return refresh(); }),
    reconnectPreview: input => serial(()=>reconnectPreview(input)), reconnectMoved: input => serial(()=>reconnectMoved(input)),
    // Existing indexed identity + current physical bytes; no scan, index save or extraction.
    snapshot: (id,{includeBody=false}={}) => serial(async()=>{
      const source=sourceById(id),file=checkedFile(source),stat=regular(file);
      if(!includeBody)return {...publicSource(source),path:file,hash:await streamHash(file)};
      let raw=null,text=null;const readable=TEXT.has(path.extname(file).toLowerCase())&&stat.size<=MAX_BODY_BYTES;
      if(readable){raw=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(file));text=splitFrontmatter(raw).body;}
      const hash=raw===null?await streamHash(file):digest(raw),transcript=recordingSourceSnapshot?.({...source,path:file,hash});
      if(fileStamp(regular(file))!==fileStamp(stat))throw new StateError('Source changed during read-only snapshot.',409);
      return {...publicSource(source),path:file,hash,raw,text,body:text,...(transcript?.managed?{transcriptState:{managed:true,...transcript}}:{})};
    }),
    tree: () => serial(refresh), read: (id,options) => serial(() => read(id,options)),
    blob: (id, original = false) => serial(async () => { refresh(); const source = original ? index.sources.find(s => s.id === id) : sourceById(id); if (!source) throw new StateError('Source was not found.', 404); let file; if (original) { if (!source.originalFile) throw new StateError('This connected file remains at its original location.', 404); file = resolveInside(path.join(dataDir, 'source-originals'), path.basename(source.originalFile)); regular(file); } else { file = checkedFile(source); if (!source.hash) {source.hash=await streamHash(file);source.hashStatus='verified';if(source.pipelineStates)source.pipelineStates.retention.hash=source.hash;persist();} } return { file, source: publicSource(source) }; }),
    folder: input => serial(() => { makeFolder(input.rootId, input.folder); return refresh(); }),
    retainAlbumPhoto: input => serial(() => { refresh(); const source=savedFile('library',input.folder,input.name,input.bytes,input.provenance); persist(); refresh(); return publicSource(source); }),
    import: input => serial(async () => {
      refresh(); rootById(input.rootId, true); safeRel(input.folder || '');
      if (!Array.isArray(input.files || []) || !Array.isArray(input.urls || []) || (input.files?.length || 0) + (input.urls?.length || 0) > 100) throw new StateError('Import up to 100 files or URLs.');
      const receipts = [];
      for (const file of input.files || []) {
        try { string(file.name, 'File name', 240); let bytes;
          if (typeof file.content === 'string') bytes = Buffer.from(string(file.content, 'File content'));
          else if (typeof file.base64 === 'string' && validBase64(file.base64)) bytes = Buffer.from(file.base64, 'base64');
          else throw new StateError('Provide UTF-8 content or valid base64 bytes.');
          if (bytes.length > 64 * 1024 * 1024) throw new StateError('File exceeds 64 MB.', 413);
          const source = savedFile(input.rootId, input.folder || '', file.name, bytes, { kind: 'upload', originalName: file.name, originalHash: digest(bytes) });
          persist(); refresh(); receipts.push({ ok: true, source: publicSource(source) });
        } catch (error) { receipts.push({ ok: false, name: file.name, error: error.message }); }
      }
      for (const raw of input.urls || []) {
        try {
          string(raw, 'URL', 2048); const url = new URL(raw); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new StateError('Use an HTTP or HTTPS source URL without credentials.');
          const identity = normalizeSourceUrl(raw); const existing = index.sources.find(s => !s.missing && s.source_url && normalizeSourceUrl(s.source_url) === identity);
          if (existing) { receipts.push({ ok: true, reused: true, source: publicSource(existing) }); continue; }
          let ripped = null, extractionError = null;
          if (scrape) { try {
            if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^[0-9.]+$/.test(url.hostname) || url.hostname.startsWith('[')) throw new StateError('Extraction requires a public source hostname.');
            ripped = await scrape(url.href, { onlyMainContent: true });
            if (!ripped.markdown?.trim()) throw new Error('Page returned no readable content.');
            if (Buffer.byteLength(ripped.markdown) > MAX_BODY_BYTES) throw new Error('Extracted text exceeds 2 MB.');
          } catch (error) { ripped = null; extractionError = error.message; } }
          const title = ripped?.title?.trim() || url.hostname + url.pathname;
          const note = `---\ntitle: ${JSON.stringify(title)}\nsource_url: ${JSON.stringify(url.href)}\nprocessing_status: ${urlIngestion ? 'queued' : 'needs-extraction'}\n---\n\n# ${title}\n\n${url.href}\n\nLink retained. ${extractionError ? `Extraction failed: ${extractionError}` : urlIngestion ? 'Local extraction is queued.' : 'Extraction is not configured.'} No article or transcript has been generated.\n`;
          const content = ripped ? `---\ntitle: ${JSON.stringify(title)}\nsource_url: ${JSON.stringify(url.href)}\nripped_at: ${now()}\nadded_by: operator\n---\n\n# ${title}\n\n> Source: <${url.href}>\n\n${ripped.markdown.trim()}\n` : note;
          const source = savedFile(input.rootId, input.folder || '', `${slugifyName(title)}.md`, content, { kind: ripped ? 'web-extraction' : 'link', originalUrl: url.href, identity, backend: ripped?.backend, extractionError });
          persist(); refresh();
          if (!ripped && urlIngestion) { const job = urlIngestion(publicSource(source)); source.ingestionJobId = job.id; source.status = 'queued'; persist(); receipts.push({ ok: true, jobId: job.id, source: publicSource(source) }); }
          else receipts.push({ ok: true, source: publicSource(source) });
        } catch (error) { receipts.push({ ok: false, url: raw, error: error.message }); }
      }
      return { receipts, revision: index.revision };
    }),
    write: input => serial(() => {
      refresh(); const source = sourceById(input.id); expected(source, input.expectedHash); const file = checkedFile(source, true); string(input.content, 'Source content');
      if (!TEXT.has(path.extname(file).toLowerCase())) throw new StateError('Only Markdown and text source bodies can be edited.');
      const old = fs.readFileSync(file, 'utf8'); const header = old.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); const content = input.raw === true ? input.content : (header?.[0] || '') + input.content;
      // Keep the pre-edit file outside the browseable shelf for exact recovery.
      const history = path.join(dataDir, 'source-history'); fs.mkdirSync(history, { recursive: true, mode: 0o700 }); resolveInside(history, '', { directory: true });
      atomicWrite(path.join(history, `${digest(Buffer.from(source.id))}-${source.hash}.txt`), old);
      atomicWrite(file, content, { expectedHash: source.hash }); refresh(); return read(source.id);
    }),
    rename: input => serial(() => {
      refresh(); const source = sourceById(input.id); expected(source, input.expectedHash); safeRel(input.toPath, false); const root = rootById(source.rootId, true), from = checkedFile(source, true);
      if (input.toPath === source.rel_path) return read(source.id);
      const to = resolveInside(root.path, input.toPath, { missing: true }); if (fs.lstatSync(to, { throwIfNoEntry: false })) throw new StateError('Destination already exists; no file overwritten.', 409);
      // Atomic no-clobber publication; unlink only after complete target exists.
      const originalStat = fs.lstatSync(from); fs.linkSync(from, to);
      const currentStat = fs.lstatSync(from);
      if (currentStat.ino !== originalStat.ino || currentStat.dev !== originalStat.dev || digest(fs.readFileSync(to)) !== source.hash) { fs.unlinkSync(to); throw new StateError('Source changed during rename. Refresh before moving.', 409); }
      fs.unlinkSync(from); source.rel_path = input.toPath; persist(); refresh(); return read(source.id);
    }),
    collections: () => serial(() => { refresh(); return { revision: index.revision, collections: index.collections }; }),
    collectionRelationships: collectionId => serial(() => { refresh(); return {revision:index.revision,relationships:resolvedCollectionLinks(index.collectionRelationships,index.collections,collectionId)}; }),
    linkCollections: input => serial(() => {
      refresh(); if(input.expectedRevision!==index.revision)throw new StateError('Library changed. Refresh the relationships before saving.',409);
      const {source,destination}=collectionPair(index.collections,input.sourceId,input.destinationId);
      const existing=liveCollectionLink(index.collectionRelationships,source.id,destination.id);
      if(existing)return{revision:index.revision,relationship:structuredClone(existing)};
      const relationship={id:randomUUID(),sourceId:source.id,destinationId:destination.id,sourceLabel:source.name,destinationLabel:destination.name,relationshipType:'relates-to',status:'accepted',createdAt:now(),updatedAt:now()};
      persistCollectionRelationship(()=>index.collectionRelationships.push(relationship));return{revision:index.revision,relationship:structuredClone(relationship)};
    }),
    detachCollectionRelationship: input => serial(() => {
      refresh();if(input.expectedRevision!==index.revision)throw new StateError('Library changed. Refresh the relationships before saving.',409);
      const relationship=index.collectionRelationships.find(item=>item.id===input.id);if(!relationship)throw new StateError('Collection relationship was not found.',404);
      if(relationship.status!=='detached')persistCollectionRelationship(()=>{relationship.status='detached';relationship.updatedAt=now();});
      return{revision:index.revision,relationship:structuredClone(relationship)};
    }),
    saveCollection: input => serial(() => {
      refresh(); if (input.expectedRevision !== index.revision) throw new StateError('Library changed. Refresh the collection before saving.', 409);
      string(input.name, 'Collection name', 200); if (!input.name.trim() || !Array.isArray(input.sourceIds) || input.sourceIds.length > 1000 || new Set(input.sourceIds).size !== input.sourceIds.length) throw new StateError('Use a name and unique source IDs.');
      input.sourceIds.forEach(sourceById); let collection = input.id ? index.collections.find(c => c.id === input.id) : null; if (input.id && !collection) throw new StateError('Collection was not found.', 404);
      if (!collection) { collection = { id: randomUUID(), added_by: 'local-operator', added_at: now() }; index.collections.push(collection); }
      Object.assign(collection, { name: input.name.trim(), sourceIds: [...input.sourceIds], updated_at: now() }); persist(); return { revision: index.revision, collection };
    }),
    evidence: () => serial(() => { refresh(); return { revision: index.revision, cards: index.evidence.map(card => { const source = index.sources.find(s => s.id === card.sourceId); return { ...structuredClone(card), stale: source?.missing || source?.managedTerminalSnapshot || !source || card.sourceHash !== source.hash, sourceMissing: source?.missing || source?.managedTerminalSnapshot || !source, sourceCurrentHash: source?.hash || null, sourcePath: source?.rel_path || null }; }) }; }),
    saveEvidence: input => serial(() => {
      refresh(); const source = sourceById(input.sourceId), content = read(source.id); string(input.quote, 'Quote', 100000);
      if (!source.cardEligibility.eligible) throw new StateError(source.cardEligibility.reason);
      if (!input.quote.trim() || !content.text?.includes(input.quote)) throw new StateError('Quote must occur verbatim in the readable source.');
      const offset = input.locator?.start ?? content.text.indexOf(input.quote); if (!Number.isSafeInteger(offset) || offset < 0 || content.text.slice(offset, offset + input.quote.length) !== input.quote) throw new StateError('Quote location does not match the source.');
      const card = { id: randomUUID(), sourceId: source.id, quote: input.quote, kind: ['quote', 'highlight', 'paraphrase', 'reference'].includes(input.kind) ? input.kind : 'quote', locator: { ...input.locator, start: offset, end: offset + input.quote.length }, sourceHash: source.hash, sourceTitle: source.title || source.name, sourceUrl: source.source_url || '', sourcePathAtCapture: source.rel_path, createdAt: now(), provenance: structuredClone(source.provenance) };
      index.evidence.push(card); persist(); return { card, revision: index.revision };
    }),
  };
}
