import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const MAX_JOB_BYTES = 64 * 1024;
const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every path here is deliberately enumerated. This module never accepts a path
// or project slug from the HTTP caller.

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

export function createStudyOriginals({ vaultRoot, filesRoot, catalog={projects:{},drafts:{}} }) {
  const PROJECTS=catalog.projects||{},DRAFTS=catalog.drafts||{};
  if (!vaultRoot || !filesRoot) throw new TypeError('vaultRoot and filesRoot are required.');
  const vault = checkedRoot(vaultRoot);
  const files = checkedRoot(filesRoot);
  const configuredVault = path.resolve(vaultRoot);
  const configuredFiles = path.resolve(filesRoot);
  return {
    list(projectKey) {
      if (!Object.hasOwn(PROJECTS, projectKey)) throw stateError('Unsupported original project.', 404);
      const project = PROJECTS[projectKey];
      const records = project.docs.map(([relative, role]) => readMarkdown(vault, relative, role));
      const audio=[],diagnostics=[];
      return { projectKey, records, audio, diagnostics, relatedProjects: (project.relatedProjects||[]).map(item => ({ ...item })) };
    },
    audio() { throw stateError('Original audio adapter is not configured; use owned recording intake.',503); },
    catalog() {
      return Object.entries(DRAFTS).map(([id, config]) => {
        const { current } = draftRecords(vault, config);
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
