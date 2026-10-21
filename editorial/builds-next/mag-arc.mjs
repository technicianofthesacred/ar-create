// mag-arc — how the magazine page (mag-preview.mjs) saves, now that AR Create is the magazine's one
// writer (Adrian, 2026-10-21, D1/D3). Installed to ~/builds/mag-arc.mjs by AR Create's
// scripts/install-mag-clients.mjs; the source of truth is editorial/builds-next/ in the AR Create repo.
//
// On this Mac (the default on macOS, or MAG_ARC_URL set): every save is a call to AR Create on
// 127.0.0.1:8841 as human:adrian through the page (X-AR-Client: mag-page). If AR Create is not
// running the page says so and saves nothing; it never falls back to writing the files itself.
// Off the Mac (VPS, innerstellar; MAG_ARC=legacy or no AR Create there): the page writes as before,
// but each save takes the shared lock (Workflow/_mag-running.md) first, so it never writes while a
// /mag run or AR Create holds it (D2).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

const mode = process.env.MAG_ARC || (process.env.MAG_ARC_URL || process.platform === 'darwin' ? 'ar-create' : 'legacy');
export const ARC = mode === 'ar-create';
export const ARC_URL = process.env.MAG_ARC_URL || 'http://127.0.0.1:8841';
const loopback = new URL(ARC_URL);
if (ARC && !['127.0.0.1', 'localhost', '[::1]'].includes(loopback.hostname)) throw new Error('MAG_ARC_URL must be AR Create on this machine (127.0.0.1).');

/** One AR Create command, as Adrian through the page. Returns {status, body}. */
export async function arc(route, input) {
  let response;
  try {
    response = await fetch(new URL(route, ARC_URL), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-AR-Actor': 'human:adrian', 'X-AR-Client': 'mag-page' },
      body: JSON.stringify({ ...input, operationId: input.operationId || randomUUID() }) });
  } catch (error) {
    return { status: 503, body: { ok: false, error: 'AR Create is not running on this Mac, so nothing was saved. Start AR Create and try again.' } };
  }
  let body; try { body = await response.json(); } catch { body = {}; }
  return { status: response.status, body: response.ok ? { ok: true, ...body } : { ok: false, error: body.error || `AR Create answered ${response.status}.`, ...(body.holder ? { holder: body.holder } : {}) } };
}
/** A read from AR Create (GET with query fields). */
export async function arcGet(route, query = {}) {
  try {
    const url = new URL(route, ARC_URL); for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    return { status: r.status, body: await r.json() };
  } catch { return { status: 503, body: { error: 'AR Create is not running on this Mac.' } }; }
}

// ── Off the Mac: the shared lock around each legacy save (D2) ──
const STALE = 2 * 3600e3;
export async function withLegacyLock(MAG, doing, fn) {
  const lock = path.join(MAG, 'Workflow/_mag-running.md');
  try {
    const text = fs.readFileSync(lock, 'utf8'), field = k => (text.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1] || '';
    const since = Date.parse(field('since')) || fs.statSync(lock).mtimeMs;
    if (Date.now() - since < STALE) { const e = new Error(`The magazine is being worked on on ${field('machine') || 'another machine'} since ${field('since') || 'recently'}${field('doing') ? ' (' + field('doing') + ')' : ''}. Nothing was saved; try again when it is done.`); e.status = 423; throw e; }
    const e = new Error(`A magazine lock from ${field('machine') || 'another machine'} is over 2 hours old. Clear it on the Mac (AR Create) before saving here.`); e.status = 423; throw e;
  } catch (error) { if (error.status === 423) throw error; if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(path.dirname(lock), '.' + path.basename(lock) + '.' + randomUUID() + '.tmp');
  fs.writeFileSync(temporary, `machine: ${os.hostname()}\nsince: ${new Date().toISOString()}\ndoing: ${doing}\nholder: mag-page\npid: ${process.pid}\nmode: transaction\n`, { flag: 'wx' });
  try { fs.linkSync(temporary, lock); }
  catch (error) { if (error.code === 'EEXIST') { const e = new Error('Another save took the magazine lock just now. Try again.'); e.status = 423; throw e; } throw error; }
  finally { fs.rmSync(temporary, { force: true }); }
  try { return await fn(); } finally { fs.rmSync(lock, { force: true }); }
}
