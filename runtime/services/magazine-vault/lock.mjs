// The one magazine lock: MAG/Workflow/_mag-running.md, the same file and meaning /mag has used since
// 2026-10-06, so a /mag run on the VPS or innerstellar still sees it through Syncthing and stops.
//
//   machine: <hostname>        since: <ISO time>      doing: <what>
//   holder: ar-create          actor: <who asked>     operation: <operation id>
//   pid: <process id>          boot: <this process's boot id>     mode: transaction | session
//
// AR Create holds it only for each write (mode: transaction: created exclusively, fsync'd, removed
// after), or for a whole /mag run on this Mac (mode: session, from magazine.lock.hold) so the other
// machines see the run. Rules for a lock already there:
//   - ours (this boot) in session mode: our own writes go ahead.
//   - this machine, holder ar-create, its process gone: recovered automatically (journalled).
//   - anyone else under 2 hours old: 423 with the holder, as /mag does.
//   - anyone else 2 hours or older, or unreadable: 423 "needs recovery"; only a human recovers it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {StateError} from '../../store.mjs';

export const LOCK_REL = 'Workflow/_mag-running.md';
export const STALE_MS = 2 * 3600_000;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const alive = pid => { if (!Number.isSafeInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };

export function parseLock(text) {
  const fields = {};
  for (const line of String(text).split(/\r?\n/)) { const m = line.match(/^\s*([a-z]+):\s*(.*?)\s*$/i); if (m && !Object.hasOwn(fields, m[1].toLowerCase())) fields[m[1].toLowerCase()] = m[2]; }
  return fields;
}
function render(fields) {
  return ['machine', 'since', 'doing', 'holder', 'actor', 'operation', 'pid', 'boot', 'mode', 'until'].filter(k => fields[k] !== undefined && fields[k] !== null).map(k => `${k}: ${String(fields[k]).replace(/[\r\n]+/g, ' ')}`).join('\n') + '\n';
}

export function createVaultLock({vaultRoot, machine = os.hostname(), pid = process.pid, bootId = randomUUID(), now = () => Date.now(), staleMs = STALE_MS, onRecover = () => {}} = {}) {
  const file = path.join(vaultRoot, LOCK_REL);
  let queue = Promise.resolve();
  const serial = fn => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };

  function read() {
    const stat = fs.lstatSync(file, {throwIfNoEntry: false});
    if (!stat) return null;
    if (stat.isSymbolicLink() || !stat.isFile()) return {bytes: Buffer.alloc(0), fields: {}, hash: null, mtimeMs: stat.mtimeMs, unreadable: true};
    const bytes = fs.readFileSync(file), fields = parseLock(bytes.toString('utf8'));
    return {bytes, fields, hash: sha(bytes), mtimeMs: stat.mtimeMs, unreadable: !fields.machine};
  }
  const sinceOf = lock => { const at = Date.parse(lock.fields.since || ''); return Number.isFinite(at) ? at : lock.mtimeMs; };
  /** What the lock file says, in plain terms, and what a write would meet. */
  function describe(lock = read()) {
    if (!lock) return {held: false, state: 'free'};
    const at = sinceOf(lock), age = now() - at, f = lock.fields;
    const holder = {machine: f.machine || null, since: f.since || new Date(lock.mtimeMs).toISOString(), doing: f.doing || null, holder: f.holder || 'mag-session', actor: f.actor || null, mode: f.mode || (f.holder === 'ar-create' ? 'transaction' : 'session'), until: f.until || null, hash: lock.hash};
    const sameMachine = f.machine === machine, ours = f.holder === 'ar-create' && sameMachine;
    const expired = f.until && Date.parse(f.until) <= now();
    if (ours && f.boot === bootId && (f.mode === 'session') && !expired) return {held: true, state: 'ours', holder};
    if (ours && (f.boot === bootId || !alive(Number(f.pid)) || Number(f.pid) === pid || expired)) return {held: true, state: 'recoverable', holder};
    if (lock.unreadable) return {held: true, state: 'needs-recovery', holder, reason: 'The lock file cannot be read.'};
    if (age >= staleMs) return {held: true, state: 'needs-recovery', holder, reason: `Held by ${holder.machine} since ${holder.since}, over 2 hours: it may be a run that stopped. Only Adrian can clear it.`};
    return {held: true, state: 'busy', holder};
  }
  const locked = (status) => Object.assign(new StateError(status.state === 'needs-recovery'
    ? `The magazine lock needs recovery: ${status.reason}`
    : `The magazine is being worked on by ${status.holder.holder === 'ar-create' ? 'AR Create' : '/mag'} on ${status.holder.machine} since ${status.holder.since}${status.holder.doing ? ' (' + status.holder.doing + ')' : ''}. Wait for it to finish.`, 423), {outcome: 'not-applied', holder: status.holder, lockState: status.state});

  function create(fields) {
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, render(fields)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.linkSync(temporary, file); }
    catch (error) { if (error.code === 'EEXIST') return false; throw error; }
    finally { fs.rmSync(temporary, {force: true}); }
    const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    return true;
  }
  function removeIf(hash) {
    const lock = read(); if (!lock || lock.hash !== hash) return false;
    fs.rmSync(file, {force: true}); return true;
  }
  function recoverStale(status, lock, why) {
    if (!removeIf(lock.hash)) return false;
    onRecover({at: new Date(now()).toISOString(), why, previous: status.holder, bytes: lock.bytes.toString('utf8')});
    return true;
  }
  function fieldsFor(context, mode, extra = {}) {
    return {machine, since: new Date(now()).toISOString(), doing: context.doing || context.operation || 'AR Create write', holder: 'ar-create', actor: context.actor || null, operation: context.operation || null, pid, boot: bootId, mode, ...extra};
  }

  return {
    file, machine, bootId,
    status: () => describe(),
    /** Run fn while holding the lock for one transaction (or inside our own session hold). */
    transaction(context, fn) {
      return serial(async () => {
        if (!fs.existsSync(path.dirname(file))) throw new StateError('The magazine Workflow folder is unavailable.', 503);
        for (let attempt = 0; attempt < 3; attempt++) {
          const lock = read(), status = describe(lock);
          if (status.state === 'ours') return await fn({mode: 'session'});
          if (status.state === 'recoverable') { recoverStale(status, lock, 'AR Create on this machine left the lock behind (its process is gone).'); continue; }
          if (status.held) throw locked(status);
          const fields = fieldsFor(context, 'transaction');
          if (!create(fields)) continue;
          const mine = read();
          try { return await fn({mode: 'transaction'}); }
          finally { removeIf(mine.hash); }
        }
        throw locked(describe());
      });
    },
    /** Hold the lock for a whole /mag run on this Mac, so the VPS and innerstellar see it. */
    hold(context, {ttlMs = STALE_MS - 60_000} = {}) {
      return serial(() => {
        if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs >= STALE_MS) throw new StateError('A session hold lasts between 1 minute and just under 2 hours.', 400);
        const lock = read(), status = describe(lock), until = new Date(now() + ttlMs).toISOString();
        if (status.state === 'recoverable') recoverStale(status, lock, 'AR Create on this machine left the lock behind (its process is gone).');
        else if (status.state === 'ours') { const fields = {...lock.fields, doing: context.doing || lock.fields.doing, until, actor: context.actor || lock.fields.actor}; const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`); fs.writeFileSync(temporary, render(fields), {mode: 0o600}); fs.renameSync(temporary, file); return {held: true, renewed: true, ...describe()}; }
        else if (status.held) throw locked(status);
        if (!create(fieldsFor(context, 'session', {until}))) throw locked(describe());
        return {held: true, renewed: false, ...describe()};
      });
    },
    /** End our own session hold. */
    release() {
      return serial(() => { const lock = read(), status = describe(lock); if (status.state !== 'ours') return {released: false, ...status}; removeIf(lock.hash); return {released: true, state: 'free', held: false}; });
    },
    /** Human only (checked by the caller): clear a lock another machine or run left behind. */
    recover({expectedHash}) {
      return serial(() => {
        const lock = read(); if (!lock) return {recovered: false, state: 'free'};
        if (typeof expectedHash !== 'string' || expectedHash !== lock.hash) throw new StateError('The lock changed since you looked at it. Read magazine.lock.status again.', 409);
        const status = describe(lock);
        if (status.state === 'busy') throw locked(status);
        if (status.state === 'ours') throw new StateError('AR Create holds this lock for a run; release it instead.', 409);
        if (!recoverStale(status, lock, 'Adrian cleared it.')) throw new StateError('The lock changed while clearing it.', 409);
        return {recovered: true, previous: status.holder};
      });
    },
  };
}
