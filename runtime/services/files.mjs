import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { StateError } from '../store.mjs';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function safeRel(value, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > 1024 || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value) || path.isAbsolute(value)) throw new StateError('Use a relative library path.');
  const parts = value.split('/');
  if ((!allowEmpty && !value) || parts.some(p => p === '..' || p === '.' || p.startsWith('.') || p.includes('.sync-conflict-') || (!p && value))) throw new StateError('Hidden files, conflicts and traversal paths are not available.');
  return value;
}
export function regular(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new StateError('Source must be a regular file.', 403);
  if (stat.nlink > 1) throw new StateError('Linked files are read-only.', 403);
  return stat;
}
export function resolveInside(root, rel, { missing = false, directory = false, createParents = false } = {}) {
  safeRel(rel);
  let current = root;
  const parts = rel ? rel.split('/') : [];
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new StateError('Library root must be a real directory.', 403);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const final = i === parts.length - 1;
    if (!fs.existsSync(current) && !fs.lstatSync(current, { throwIfNoEntry: false })) {
      if (createParents && (!final || directory)) fs.mkdirSync(current, { mode: 0o700 });
      else if (final && missing) return current;
      else throw new StateError('Folder or source was not found.', 404);
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (!final && !stat.isDirectory())) throw new StateError('Symlink paths are not available.', 403);
    if (final && directory && !stat.isDirectory()) throw new StateError('Expected a folder.');
  }
  const real = fs.realpathSync(current);
  if (real !== fs.realpathSync(root) && !real.startsWith(fs.realpathSync(root) + path.sep)) throw new StateError('Path escapes the library.', 403);
  return current;
}
export function atomicWrite(file, bytes, { exclusive = false, expectedHash = null } = {}) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat) { regular(file); if (exclusive) throw new StateError('A different file already uses that name.', 409); }
  const temporary = `${file}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    if (expectedHash !== null && (!fs.existsSync(file) || digest(fs.readFileSync(file)) !== expectedHash)) throw new StateError('File changed during save. Refresh before saving.', 409);
    if (exclusive) fs.linkSync(temporary, file); else fs.renameSync(temporary, file);
    const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  } finally { if (fd !== undefined) fs.closeSync(fd); fs.rmSync(temporary, { force: true }); }
}
export function readJson(file, fallback) {
  if (!fs.existsSync(file)) return structuredClone(fallback);
  regular(file);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot read ${path.basename(file)}; existing data preserved: ${error.message}`); }
}

/** For trusted backend names (including private dot directories), not API paths. */
export function ensurePrivateDirectory(root, relative = '') {
  if (path.isAbsolute(relative) || relative.split(path.sep).some(p => p === '..') || relative.includes('\0')) throw new Error('Backend directory escapes its data root.');
  let current = root;
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Data root must be a real directory.');
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const found = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!found) fs.mkdirSync(current, { mode: 0o700 });
    else if (found.isSymbolicLink() || !found.isDirectory()) throw new Error('Backend directory cannot be a symlink or file.');
  }
  return current;
}
