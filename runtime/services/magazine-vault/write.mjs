// Reading and writing bytes in the magazine folders, and nothing else.
// Every write is a compare-and-swap on the sha256 of the file's bytes, made under the one lock,
// atomically (a hidden temporary file in the same folder, fsync, rename; an exclusive hard link for a
// new file), and recorded with its before-bytes so it can be undone exactly.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {StateError} from '../../store.mjs';
import {cleanRelative} from './kinds.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
export const MAX_TEXT = 2 * 1024 * 1024;

/** A real directory root that never passes through a symlink at its last step. */
export function realRoot(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new StateError(`${label} must be an absolute folder.`, 503);
  const stat = fs.lstatSync(value, {throwIfNoEntry: false});
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) throw new StateError(`${label} is unavailable.`, 503);
  return {path: value, real: fs.realpathSync(value), dev: stat.dev, ino: stat.ino};
}

export function createRootIO(root, {label = 'Magazine folder', makeDirs = () => false} = {}) {
  const checkRoot = () => { const stat = fs.lstatSync(root.path, {throwIfNoEntry: false}); if (!stat || stat.isSymbolicLink() || stat.dev !== root.dev || stat.ino !== root.ino || fs.realpathSync(root.path) !== root.real) throw new StateError(`${label} changed under AR Create. Nothing was written.`, 409); };
  /** Absolute path of rel; parents must be real folders (created only where makeDirs allows). */
  function locate(rel, {create = false} = {}) {
    checkRoot();
    const parts = cleanRelative(rel).split('/');
    let at = root.path;
    for (let i = 0; i < parts.length; i++) {
      at = path.join(at, parts[i]);
      const last = i === parts.length - 1, stat = fs.lstatSync(at, {throwIfNoEntry: false});
      if (!stat) {
        if (last) break;
        const dirRel = parts.slice(0, i + 1).join('/');
        if (create && makeDirs(dirRel)) { fs.mkdirSync(at, {mode: 0o755}); continue; }
        if (create) throw new StateError(`The folder ${dirRel} does not exist, and AR Create does not make it.`, 404);
        return {abs: path.join(root.path, ...parts), missing: true};
      }
      if (stat.isSymbolicLink()) throw new StateError('Symlinks inside the magazine are refused.', 403);
      if (!last && !stat.isDirectory()) throw new StateError(`${parts.slice(0, i + 1).join('/')} is not a folder.`, 409);
    }
    return {abs: at, missing: !fs.existsSync(at)};
  }
  function read(rel) {
    const {abs, missing} = locate(rel);
    if (missing) return {rel, exists: false, hash: null, bytes: null};
    const stat = fs.lstatSync(abs);
    if (!stat.isFile()) throw new StateError(`${rel} is not a file.`, 409);
    if (stat.size > 64 * 1024 * 1024) throw new StateError(`${rel} is too large to read here.`, 413);
    const bytes = fs.readFileSync(abs);
    return {rel, exists: true, hash: sha256(bytes), bytes, size: stat.size, mtime: new Date(stat.mtimeMs).toISOString(), mode: stat.mode & 0o777, nlink: stat.nlink};
  }
  /** Syncthing leaves "<name>.sync-conflict-<date>-<id>.<ext>" beside a file both machines changed. */
  function conflictCopies(rel) {
    const {abs} = locate(rel), dir = path.dirname(abs), ext = path.extname(abs), stem = path.basename(abs, ext);
    let names = []; try { names = fs.readdirSync(dir); } catch { return []; }
    return names.filter(n => n.startsWith(stem + '.sync-conflict-') && n.endsWith(ext));
  }
  function fsyncDir(dir) { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  function writeTemp(dir, base, bytes, mode) {
    const temporary = path.join(dir, `.${base}.${randomUUID()}.ar-create.tmp`);
    const fd = fs.openSync(temporary, 'wx', mode);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.chmodSync(temporary, mode);
    return temporary;
  }
  /** One file: expectedHash null means "must not exist yet". bytes null means "remove". */
  function put(rel, expectedHash, bytes) {
    const {abs} = locate(rel, {create: bytes !== null});
    const current = read(rel);
    if (expectedHash === null ? current.exists : current.hash !== expectedHash) throw Object.assign(new StateError(`${rel} changed since it was read. Read it again; nothing was written.`, 409), {current: {rel, hash: current.hash}});
    if (current.exists && current.nlink > 1) throw new StateError(`${rel} is hard-linked; AR Create does not rewrite linked files.`, 403);
    const dir = path.dirname(abs);
    if (bytes === null) { if (current.exists) { fs.rmSync(abs); fsyncDir(dir); } return {rel, beforeHash: current.hash, afterHash: null}; }
    const temporary = writeTemp(dir, path.basename(abs), bytes, current.exists ? current.mode : 0o644);
    try {
      if (current.exists) {
        // Last look before replacing: another process may have changed it since the check above.
        if (sha256(fs.readFileSync(abs)) !== current.hash) throw new StateError(`${rel} changed during the save. Nothing was written.`, 409);
        fs.renameSync(temporary, abs);
      } else {
        try { fs.linkSync(temporary, abs); } catch (error) { if (error.code === 'EEXIST') throw new StateError(`${rel} appeared during the save. Nothing was written.`, 409); throw error; }
      }
      fsyncDir(dir);
    } finally { fs.rmSync(temporary, {force: true}); }
    return {rel, beforeHash: current.hash, afterHash: sha256(bytes)};
  }
  /** Move a file to a new name inside the same root (never over an existing file). */
  function move(fromRel, toRel, expectedHash) {
    const from = read(fromRel); if (!from.exists || from.hash !== expectedHash) throw new StateError(`${fromRel} changed since it was read.`, 409);
    const {abs: target} = locate(toRel, {create: true});
    fs.linkSync(locate(fromRel).abs, target);
    fs.rmSync(locate(fromRel).abs); fsyncDir(path.dirname(target)); fsyncDir(path.dirname(locate(fromRel).abs));
    return {from: fromRel, to: toRel, hash: expectedHash};
  }
  return {root, locate, read, put, move, conflictCopies};
}

/** Validate an expected hash: a 64-hex sha256, or null for "the file does not exist yet". */
export function expected(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !HASH.test(value)) throw new StateError('expectedHash must be the sha256 you read (64 hex), or null for a new file.', 400);
  return value;
}

/** Text in, UTF-8 bytes out, with the magazine's limits. */
export function textBytes(content) {
  if (typeof content !== 'string') throw new StateError('content must be text.', 400);
  if (content.includes('\0')) throw new StateError('content must not contain NUL.', 400);
  const bytes = Buffer.from(content, 'utf8');
  if (bytes.length > MAX_TEXT) throw new StateError('A magazine file is at most 2 MB.', 413);
  return bytes;
}
