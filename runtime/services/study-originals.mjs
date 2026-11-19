import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const MAX_JOB_BYTES = 64 * 1024;
const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every readable path is deliberately enumerated in the trusted catalog. A
// check-input selector must match its configured parent/part/path exactly; it
// never grants access to a caller-chosen file.

function stateError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkedRoot(root) {
  const absolute = path.resolve(root);
  const st = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!st || st.isSymbolicLink() || !st.isDirectory()) throw stateError('Original source root is unavailable.', 403);
  return fs.realpathSync(absolute);
}

function resolveExact(root, relative, { missing = false, allowJobReceipt = false } = {}) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0')) throw stateError('Invalid original path.', 403);
  const parts = relative.split('/');
  if (!parts.length || parts.some((part, index) => !part || part === '.' || part === '..' || (part.startsWith('.') && !(allowJobReceipt && index === 0 && part === '.transcription-jobs')))) throw stateError('Invalid original path.', 403);
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const st = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!st) {
      if (missing) return null;
      throw stateError('Original source was not found.', 404);
    }
    if (st.isSymbolicLink()) throw stateError('Symlink paths are not available.', 403);
    if (i < parts.length - 1 && !st.isDirectory()) throw stateError('Original path is not a directory.', 403);
    if (i === parts.length - 1 && !st.isFile()) throw stateError('Original source must be a regular file.', 403);
  }
  const real = fs.realpathSync(current);
  if (real !== root && !real.startsWith(root + path.sep)) throw stateError('Original path escapes its root.', 403);
  return current;
}

function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function readMarkdown(root, relative, role) {
  const file = resolveExact(root, relative, { missing: true });
  if (!file) return { name: path.basename(relative), path: relative, role, raw: null, hash: null, modifiedAt: null, missing: true };
  const stat = fs.statSync(file);
  if (stat.size > MAX_MARKDOWN_BYTES) throw stateError(`Original Markdown exceeds the ${MAX_MARKDOWN_BYTES} byte read limit: ${relative}`, 413);
  const bytes = fs.readFileSync(file);
  return { name: path.basename(relative), path: relative, role, raw: new TextDecoder('utf-8',{fatal:true}).decode(bytes), hash: digest(bytes), modifiedAt: stat.mtime.toISOString() };
}

// Audio selectors come only from the trusted project catalog; HTTP supplies an opaque id.
const AUDIO_TYPES={'.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.flac':'audio/flac'};
function readAudioReceipt(files,configuredFiles,configuredVault,entry){
  const file=resolveExact(files,`.transcription-jobs/${entry.id}.json`,{allowJobReceipt:true});
  if(fs.statSync(file).size>MAX_JOB_BYTES)throw stateError('Transcription receipt exceeds the read limit.',413);
  let receipt;try{receipt=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw stateError('Original audio receipt is invalid.',409);}
  // Resolve the configured relative selectors before trusting their receipt counterparts.
  const audioFile=resolveExact(files,entry.source);
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))throw stateError('Original audio receipt is invalid.',409);
  // A missing historical raw note does not invalidate the completed recording, but its path must be safe.
  resolveExact(checkedRoot(configuredVault),entry.raw,{missing:true});
  const expectedAudio=path.join(configuredFiles,entry.source),expectedRaw=path.join(configuredVault,entry.raw);
  if(receipt.id!==entry.id||receipt.state!=='done'||receipt.transcriptReady!==true||typeof receipt.source!=='string'||typeof receipt.originalSource!=='string'||path.resolve(receipt.source)!==expectedAudio||path.resolve(receipt.originalSource)!==expectedAudio)throw stateError('Original audio receipt does not match the verified recording.',409);
  if(typeof receipt.raw!=='string'||path.resolve(receipt.raw)!==expectedRaw)throw stateError('Original audio receipt has unexpected raw-source provenance.',409);
  const type=AUDIO_TYPES[path.extname(audioFile).toLowerCase()];if(!type)throw stateError('Unsupported original audio type.',415);
  return {file:audioFile,type,title:entry.title,hash:null,size:fs.statSync(audioFile).size,provenance:entry.playbackProvenance??entry.provenance};
}

export function createStudyOriginals({ vaultRoot, filesRoot, catalog={projects:{},drafts:{}} }) {
  const PROJECTS=structuredClone(catalog.projects||{}),DRAFTS=catalog.drafts||{};
  const audioEntries=new Map();
  for(const project of Object.values(PROJECTS))for(const entry of project.audio||[]){
    if(!JOB_ID_RE.test(entry.id||'')||audioEntries.has(entry.id))throw stateError('Original audio catalog identity is invalid.',403);
    audioEntries.set(entry.id,entry);
  }
  if (!vaultRoot || !filesRoot) throw new TypeError('vaultRoot and filesRoot are required.');
  const vault = checkedRoot(vaultRoot);
  const files = checkedRoot(filesRoot);
  const configuredVault = path.resolve(vaultRoot);
  const configuredFiles = path.resolve(filesRoot);
  const checkDrafts = structuredClone(DRAFTS);
  const vaultStat = fs.statSync(vault);
  const rootIdentity = { scheme: 'canonical-directory-sha256-v1', fingerprint: digest(vault) };
  return {
    checkInputs(input) {
      const keys = ['parentStudyKey', 'partKey', 'draftPath', 'expectedDraftHash'];
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) throw stateError('Exact draft check identity is required.');
      for (const key of keys) {
        const limit = key === 'draftPath' ? 4096 : key === 'expectedDraftHash' ? 64 : 256;
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > limit || /[\u0000-\u001f\u007f]/.test(input[key])) throw stateError('Invalid draft check identity.');
      }
      if (!/^[0-9a-f]{64}$/.test(input.expectedDraftHash)) throw stateError('Invalid draft check hash.');
      let currentVault;
      try {
        currentVault = checkedRoot(configuredVault);
        const stat = fs.statSync(currentVault);
        if (currentVault !== vault || stat.dev !== vaultStat.dev || stat.ino !== vaultStat.ino) throw stateError('Original source root changed.', 409);
      } catch { throw stateError('Original source root changed or is unavailable.', 409); }
      // A caller can only select the exact maintained relationship. No path,
      // title or nearby-source inference confers a relationship or ownership.
      const matches = Object.values(checkDrafts).filter(config => config.parentStudyKey === input.parentStudyKey && config.partKey === input.partKey && config.path === input.draftPath);
      if (!matches.length) throw stateError('No configured check inputs match this draft.', 404);
      if (matches.length !== 1 || Object.values(checkDrafts).filter(config => config.path === input.draftPath).length !== 1) throw stateError('Configured draft check identity is ambiguous.', 409);
      const config = matches[0], paths = new Set([config.path]);
      if (!Array.isArray(config.support)) throw stateError('Configured draft support is invalid.', 409);
      for (const support of config.support) {
        if (!Array.isArray(support) || support.length !== 2 || typeof support[1] !== 'string' || paths.has(support[0])) throw stateError('Configured draft support is ambiguous.', 409);
        resolveExact(currentVault, support[0], { missing: true });
        paths.add(support[0]);
      }
      const current = originalDraft(currentVault, config);
      if (current.hash !== input.expectedDraftHash) throw stateError('Original draft changed before checking. Refresh before checking.', 409);
      const refs = new Map(config.support.filter(([, label]) => ['source', 'context'].includes(canonicalDraftRole(label))).map(([relative, label]) => [relative, readMarkdown(currentVault, relative, label)]));
      const finalVault = checkedRoot(configuredVault), finalStat = fs.statSync(finalVault);
      if (finalVault !== vault || finalStat.dev !== vaultStat.dev || finalStat.ino !== vaultStat.ino) throw stateError('Original source root changed during checking.', 409);
      const reference = role => config.support.filter(([, label]) => canonicalDraftRole(label) === role).map(([relative]) => ({ path: relative, hash: refs.get(relative).hash ?? null, role }));
      const metadata = { schema: 'ar-create.study-original-inputs.v1', rootIdentity: { ...rootIdentity }, parentStudyKey: input.parentStudyKey, partKey: input.partKey, draftPath: input.draftPath, draftHash: current.hash, sources: reference('source'), contexts: reference('context') };
      return { ...metadata, revision: digest(JSON.stringify(metadata)) };
    },
    list(projectKey) {
      if (!Object.hasOwn(PROJECTS, projectKey)) throw stateError('Unsupported original project.', 404);
      const project = PROJECTS[projectKey];
      const records = project.docs.map(([relative, role]) => readMarkdown(vault, relative, role));
      const audio=[],diagnostics=[];
      for(const entry of project.audio||[]){
        try{readAudioReceipt(files,configuredFiles,configuredVault,entry);audio.push({id:entry.id,title:entry.title,url:`/api/study-originals/audio?id=${entry.id}`,provenance:entry.listProvenance??entry.provenance});}
        catch(error){diagnostics.push(error.message);}
      }
      return { projectKey, records, audio, diagnostics, relatedProjects: (project.relatedProjects||[]).map(item => ({ ...item })) };
    },
    audio(id) {
      const entry=audioEntries.get(id);if(!entry)throw stateError('Original audio was not found.',404);
      return readAudioReceipt(files,configuredFiles,configuredVault,entry);
    },
    catalog() {
      return Object.entries(DRAFTS).map(([id, config]) => {
        // Discovery needs only the draft's metadata, not every supporting source.
        const current = originalDraft(vault, config);
        return { id, parentStudyKey: config.parentStudyKey, partKey: config.partKey, title: current.title, originalHash: current.hash, path: config.path, modifiedAt: current.modifiedAt, contextScope: config.contextScope };
      });
    },
    readDraft(originalId, expectedOriginalHash) {
      const config = Object.hasOwn(DRAFTS,originalId)?DRAFTS[originalId]:null;
      if (!config) throw stateError('Unsupported original draft.', 404);
      const { current, records, missing } = draftRecords(vault, config);
      if (expectedOriginalHash !== undefined && expectedOriginalHash !== current.hash) throw stateError('Original draft changed since it was listed. Refresh before reading.', 409);
      return { id: originalId, parentStudyKey: config.parentStudyKey, partKey: config.partKey, title: current.title, contextScope: config.contextScope, records, missing };
    },
  };
}


function originalDraft(root, config) {
  const file = resolveExact(root, config.path);
  const stat = fs.statSync(file);
  if (stat.size > MAX_MARKDOWN_BYTES) throw stateError(`Original Markdown exceeds the ${MAX_MARKDOWN_BYTES} byte read limit: ${config.path}`, 413);
  const bytes = fs.readFileSync(file);
  const raw = bytes.toString('utf8');
  const title = /^title:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(raw)?.[1]?.trim();
  return { bytes, raw, hash: digest(bytes), modifiedAt: stat.mtime.toISOString(), title: title || config.title };
}

function canonicalDraftRole(label) {
  if (label === 'author context') return 'context';
  if (label === 'story map') return 'map';
  if (label === 'plan') return 'plan';
  if (label === 'research' || label === 'research notes') return 'research';
  if (label === 'series notes' || label === 'story notes' || label === 'raw debrief') return 'notes';
  if (label === 'brief') return 'brief';
  return 'source';
}

function draftRecords(root, config) {
  const current = originalDraft(root, config);
  const records = [{ id: 'draft', role: 'draft', path: config.path, raw: current.raw, hash: current.hash, modifiedAt: current.modifiedAt }];
  const missing = [];
  for (const [relative, roleLabel] of config.support) {
    const record = readMarkdown(root, relative, roleLabel);
    const role = canonicalDraftRole(roleLabel);
    if (record.missing) missing.push({ role, roleLabel, path: relative });
    else records.push({ id: `${role}:${relative}`, role, roleLabel, path: relative, raw: record.raw, hash: record.hash, modifiedAt: record.modifiedAt });
  }

  return { current, records, missing };
}
