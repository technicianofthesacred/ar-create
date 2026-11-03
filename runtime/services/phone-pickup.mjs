// The Mac picks up recordings made on the phone oracle (mandalacodes) and gives them AR Create's better transcript.
//
//   phone records  ->  Groq draft on the phone (kept there as the raw record)
//   Mac pulls      ->  list what still waits for a better transcript, fetch each audio file
//   Mac transcribes -> the normal pipeline: Library import, library prompt, local transcription, recognise words
//                      (known mishearings fixed with a receipt, doubtful words onto Needs you)
//   Mac posts back ->  the result becomes a new version beside the phone's draft. The phone site decides what happens
//                      to words Adrian already edited; nothing is ever overwritten from here.
//
// Pull, never push: the phone and Cloudflare cannot reach this Mac, so the Mac asks. It asks only when told to: when
// AR Create starts (at most every 12 hours), from the "Check the phone" button, or from the `phone-pickup check`
// command. There is no timer that asks the phone site. A local-only watcher runs while a recording is being
// transcribed, so a finished one is posted back; it never lists the phone site.
//
// The pickup key (AR_PICKUP_TOKEN) is read at the moment it is needed, from the environment and then from Infisical.
// It is never written to disk, logged, returned or put in an error message.
//
// This file uses only Node built-ins so the whole flow can be tested with a fake phone site and a fake transcriber.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

export const KEY_NAME = 'AR_PICKUP_TOKEN';
export const DEFAULT_BASE_URL = 'https://mandalacodes.com';
/** The shared Infisical project's id. It is an identifier committed in every repo's .infisical.json, not a secret. */
export const INFISICAL_PROJECT_ID = '5f69e389-68a2-45a6-95f0-205ff96a3de8';
export const AUTO_CHECK_MIN_GAP_MS = 12 * 3600e3;
const MANUAL_COOLDOWN_MS = 10_000;
const KEY_CACHE_MS = 10 * 60_000;
const NO_KEY_CACHE_MS = 15_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_NEW_PER_CHECK = 5;
const MAX_ATTEMPTS = 3;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const WATCH_MS = 20_000;

export const SETUP = Object.freeze({
  title: 'Set up the phone pickup key',
  intro: 'The Mac needs one key to pick up recordings from the phone site. You make it once and store it in two places. The key is never shown on this page.',
  steps: Object.freeze([
    'Open Terminal on this Mac.',
    'Paste the one line below. It makes a fresh key, stores it for the phone site, and stores it for AR Create. It prints nothing secret.',
    'Come back here and press Check the phone.',
  ]),
  command: `K=$(openssl rand -hex 32) && printf %s "$K" | npx wrangler pages secret put ${KEY_NAME} --project-name mandalacodes && infisical secrets set --env=dev --path=/ --projectId ${INFISICAL_PROJECT_ID} ${KEY_NAME}="$K" && unset K`,
  note: 'The phone site starts using the new key straight away. Run the line again any time to change the key.',
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Reads the pickup key: environment first, then Infisical at call time. Returns {key, source} or {key:null}. */
export function createKeyReader({ env = process.env, run = runInfisical, now = Date.now } = {}) {
  let cached = null;
  return async function readKey() {
    if (cached && cached.until > now()) return cached.value;
    let value = { key: null, source: null };
    const fromEnv = env[KEY_NAME]?.trim();
    if (fromEnv && fromEnv.length >= 32) value = { key: fromEnv, source: 'environment' };
    else {
      let output = '';
      try { output = String(await run(['secrets', 'get', KEY_NAME, '--plain', '--silent', '--env=dev', '--path=/', `--projectId=${INFISICAL_PROJECT_ID}`]) ?? '').trim(); } catch { output = ''; }
      if (output.length >= 32 && /^[\x21-\x7e]+$/.test(output)) value = { key: output, source: 'infisical' };
    }
    cached = { value, until: now() + (value.key ? KEY_CACHE_MS : NO_KEY_CACHE_MS) };
    return value;
  };
}
/** Runs the Infisical CLI and returns only what it printed. Its errors are discarded: they can carry environment values. */
function runInfisical(args) {
  const home = os.homedir();
  const binary = process.env.INFISICAL_BIN || [path.join(home, '.local/bin/infisical')].find((file) => fs.existsSync(file)) || 'infisical';
  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout: 15_000, maxBuffer: 16 * 1024, env: { HOME: home, USER: process.env.USER || '', PATH: `${path.join(home, '.local/bin')}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}` } }, (error, stdout) => error ? reject(new Error('The key store could not be read.')) : resolve(stdout));
  });
}

const iso = (ms) => new Date(ms).toISOString();

export function createPhonePickup({ dataDir, readKey, fetcher = globalThis.fetch, local, words = null, baseUrl = DEFAULT_BASE_URL, now = Date.now, emit = () => {}, watchMs = WATCH_MS } = {}) {
  if (!dataDir || typeof readKey !== 'function' || !local) throw new Error('The phone pickup needs a data folder, a key reader and the local recording owner.');
  const dir = path.join(dataDir, 'phone-pickup'), segmentsDir = path.join(dir, 'segments'), stateFile = path.join(dir, 'state.json');
  const origin = new URL(baseUrl).origin;
  let running = null, watcher = null, lastCheckResult = null, lastManualAt = 0;

  const writeJson = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 1), { mode: 0o600 }); fs.renameSync(temp, file);
  };
  const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
  const recordFile = (id) => { if (!UUID.test(id || '')) throw new Error('Unknown recording.'); return path.join(segmentsDir, `${id}.json`); };
  const readRecord = (id) => readJson(recordFile(id));
  const saveRecord = (record) => { record.updatedAt = iso(now()); writeJson(recordFile(record.segmentId), record); return record; };
  const records = () => { try { return fs.readdirSync(segmentsDir).filter((n) => n.endsWith('.json')).map((n) => readJson(path.join(segmentsDir, n))).filter(Boolean); } catch { return []; } };
  const readState = () => readJson(stateFile) || {};
  const INFLIGHT = new Set(['downloaded', 'importing', 'imported', 'transcribing', 'transcribed']);

  async function call(key, route, init = {}) {
    const response = await fetcher(origin + route, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${key}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(60_000) });
    return response;
  }
  const refusal = (response) => response.status === 401 ? 'key-refused' : response.status === 503 ? 'phone-not-ready' : 'phone-error';

  /** Move one recording as far along as it can go right now. Throws {pickup:'state'} to stop the whole check. */
  async function drive(record, key) {
    const stop = (state) => Object.assign(new Error(state), { pickup: state });
    for (let step = 0; step < 8; step += 1) {
      if (record.phase === 'seen') {
        const ready = await local.ready();
        if (!ready?.ready) { record.note = ready?.problem || 'Transcription is not connected on this Mac.'; saveRecord(record); return 'waiting-engine'; }
        const response = await call(key, record.audioPath);
        if (!response.ok) throw stop(refusal(response));
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error('The audio was empty or too large.');
        record.audioSha256 = sha256(bytes); record.phase = 'importing'; saveRecord(record);
        const extension = /mp4|m4a|aac/i.test(record.mimeType || '') ? 'm4a' : /mpeg|mp3/i.test(record.mimeType || '') ? 'mp3' : /wav/i.test(record.mimeType || '') ? 'wav' : /ogg/i.test(record.mimeType || '') ? 'ogg' : 'webm';
        const imported = await local.importAudio({ name: `phone-${record.segmentId}.${extension}`, bytes, mimeType: record.mimeType });
        record.sourceId = imported.sourceId; record.phase = 'imported'; record.note = null; saveRecord(record);
      } else if (record.phase === 'importing') {
        // Interrupted between fetching the audio and saving where it went. Start that step again from the phone site.
        record.phase = 'seen'; saveRecord(record);
      } else if (record.phase === 'imported') {
        const job = await local.jobForSource(record.sourceId);
        if (!job) throw new Error('The recording was kept but its transcription job is missing.');
        record.jobId = job.id;
        if (job.state === 'saved') await local.startJob(job.id);
        record.phase = 'transcribing'; saveRecord(record);
      } else if (record.phase === 'transcribing') {
        const job = await local.jobForSource(record.sourceId);
        if (!job) throw new Error('The transcription job is missing.');
        if (job.state === 'failed') { record.failure = job.error || 'Transcription failed on this Mac.'; throw Object.assign(new Error(record.failure), { permanent: true }); }
        if (job.state === 'done' && job.transcriptReady) { record.phase = 'transcribed'; saveRecord(record); } else return 'transcribing';
      } else if (record.phase === 'transcribed') {
        if (words) { try { const checked = await words.recognise({ jobId: record.jobId }); record.wordsToCheck = checked?.items?.filter?.((i) => i.status === 'open').length ?? null; } catch { record.wordsToCheck = null; } }
        const payload = buildPayload(await local.readResult(record.jobId), record);
        const response = await call(key, `/api/oracle/pickup/segments/${record.segmentId}/transcript`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (response.status === 404) { record.phase = 'gone'; saveRecord(record); return 'gone'; }
        if (response.status === 409) return 'retry-later';
        if (!response.ok) throw stop(refusal(response));
        const body = await response.json().catch(() => ({}));
        record.phase = 'posted'; record.postedResult = body.result || 'applied'; record.postedAt = iso(now()); record.resultHash = payload.resultHash; saveRecord(record);
      } else return record.phase;
    }
    return record.phase;
  }

  /** The text Adrian reads, the word timing for the record, and who spoke. Built only from the finished local transcript. */
  function buildPayload(read, record) {
    const result = read?.result || {};
    const pieces = (Array.isArray(result.segments) ? result.segments : []).filter((s) => typeof s?.text === 'string' && s.text.trim());
    if (!pieces.length) throw Object.assign(new Error('No speech was found in this recording.'), { permanent: true });
    const text = pieces.map((s) => s.text.trim()).join(' ').replace(/\s+/g, ' ').trim();
    const speakers = Array.isArray(result.speakers) ? result.speakers : [];
    const round = (n) => Math.round(Number(n) * 1000) / 1000;
    return {
      outcome: 'improved',
      engine: 'ar-create',
      engineVersion: typeof result.metadata?.engine === 'string' && /^[A-Za-z0-9 ._-]{1,64}$/.test(result.metadata.engine) ? result.metadata.engine : undefined,
      text,
      resultHash: sha256(text),
      jobId: record.jobId, sourceId: record.sourceId,
      speakers: speakers.map((s) => ({ id: String(s.id ?? ''), name: typeof s.name === 'string' ? s.name : undefined })),
      segments: pieces.map((s) => ({
        start: round(s.start), end: round(s.end), text: s.text.trim(), ...(s.speaker ? { speaker: String(s.speaker) } : {}),
        ...(Array.isArray(s.words) ? { words: s.words.map((w) => ({ start: round(w.start), end: round(w.end), text: String(w.word ?? w.text ?? '').trim(), ...(Number.isFinite(w.probability) ? { p: round(w.probability) } : {}) })) } : {}),
      })),
    };
  }

  /** Give up on one recording politely: tell the phone site to stop offering it. The phone's draft is untouched. */
  async function setAside(record, key, reason) {
    try {
      const response = await call(key, `/api/oracle/pickup/segments/${record.segmentId}/transcript`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'skipped', reason: String(reason).slice(0, 280) }) });
      if (response.ok || response.status === 404) { record.phase = 'skipped'; record.error = String(reason).slice(0, 280); saveRecord(record); return true; }
    } catch { /* kept as failed; shown to Adrian */ }
    return false;
  }

  async function advanceOne(record, key, summary) {
    try {
      const outcome = await drive(record, key);
      if (record.phase === 'posted') summary.finished += 1;
      else if (outcome === 'transcribing') summary.transcribing += 1;
      else if (outcome === 'waiting-engine') { summary.waiting += 1; summary.problems.add(record.note); }
    } catch (error) {
      if (error.pickup) throw error;
      record.attempts = (record.attempts || 0) + 1; record.error = String(error.message || 'This recording could not be finished.').slice(0, 280);
      if (error.permanent || record.attempts >= MAX_ATTEMPTS) {
        if (await setAside(record, key, `The Mac could not improve this one: ${record.error}`)) summary.skipped += 1; else { record.phase = 'failed'; saveRecord(record); summary.failed += 1; }
      } else { saveRecord(record); summary.failed += 1; summary.problems.add(record.error); }
    }
  }

  const message = (s) => {
    if (s.state === 'needs-key') return 'Needs a pickup key, see setup.';
    if (s.state === 'key-refused') return 'The phone site did not accept the pickup key. Run the setup line again.';
    if (s.state === 'phone-not-ready') return 'The phone site has no pickup key yet. Run the setup line to give it one.';
    if (s.state === 'offline') return 'Could not reach the phone site. Check the internet and try again.';
    if (s.state === 'phone-error') return 'The phone site had a problem. Nothing was changed. Try again in a minute.';
    if (s.state === 'busy') return 'Already checking.';
    const bits = [];
    if (s.finished) bits.push(`${plural(s.finished, 'recording is', 'recordings are')} done and sent back`);
    if (s.transcribing) bits.push(`${plural(s.transcribing, 'recording is', 'recordings are')} being transcribed on this Mac`);
    if (s.waiting) bits.push(`${plural(s.waiting, 'recording is', 'recordings are')} waiting for transcription to be connected`);
    if (s.skipped) bits.push(`${plural(s.skipped, 'recording was', 'recordings were')} set aside`);
    if (s.failed) bits.push(`${plural(s.failed, 'recording', 'recordings')} will be tried again next time`);
    return bits.length ? bits.join('. ') + '.' : s.found ? 'Everything on the phone is already handled.' : 'Nothing new on the phone.';
  };

  /** One pickup. `reason` is 'button', 'command' or 'start'. Returns a plain summary; never throws. */
  async function check({ reason = 'command' } = {}) {
    if (running) return { state: 'busy', reason, found: 0, started: 0, finished: 0, transcribing: 0, waiting: 0, skipped: 0, failed: 0, problems: [], message: 'Already checking.' };
    if (reason !== 'start' && lastCheckResult && now() - lastManualAt < MANUAL_COOLDOWN_MS && lastCheckResult.state === 'ok') return { ...lastCheckResult, recent: true };
    running = (async () => {
      const summary = { state: 'ok', reason, found: 0, started: 0, finished: 0, transcribing: 0, waiting: 0, skipped: 0, failed: 0, problems: new Set(), checkedAt: iso(now()) };
      try {
        const { key } = await readKey();
        if (!key) summary.state = 'needs-key';
        else {
          const response = await call(key, '/api/oracle/pickup/segments?limit=20');
          if (!response.ok) summary.state = refusal(response);
          else {
            const body = await response.json().catch(() => ({}));
            const listed = Array.isArray(body.segments) ? body.segments.filter((s) => UUID.test(s?.id || '') && typeof s.audioPath === 'string' && s.audioPath.startsWith('/api/oracle/pickup/segments/')) : [];
            summary.found = listed.length;
            let newOnes = 0;
            for (const item of listed) {
              let record = readRecord(item.id);
              if (!record) {
                if (newOnes >= MAX_NEW_PER_CHECK) continue;
                newOnes += 1; summary.started += 1;
                record = saveRecord({ segmentId: item.id, phase: 'seen', audioPath: item.audioPath, mimeType: item.mimeType, durationMs: item.durationMs, recordedAt: item.recordedAt, hexagramNumber: item.hexagramNumber, draftChars: String(item.draft?.text || '').length, attempts: 0, firstSeenAt: iso(now()) });
              } else if (['posted', 'skipped', 'gone'].includes(record.phase)) {
                // Still listed although handled: the phone site will stop offering it once it has recorded our answer.
                continue;
              } else if (record.phase === 'failed') { record.phase = 'seen'; record.attempts = 0; record.error = null; }
              await advanceOne(record, key, summary);
            }
          }
        }
      } catch (error) {
        summary.state = error.pickup || 'offline';
      }
      const result = { ...summary, problems: [...summary.problems].filter(Boolean) };
      result.message = message(result);
      lastCheckResult = result; if (reason !== 'start') lastManualAt = now();
      writeJson(stateFile, { ...readState(), lastCheckedAt: result.checkedAt, last: result });
      emit('checked', { state: result.state });
      if (records().some((r) => INFLIGHT.has(r.phase) && r.phase !== 'importing')) watch();
      return result;
    })();
    try { return await running; } finally { running = null; }
  }

  /** Finish recordings whose transcription ended after the check returned. Local only: it never lists the phone site. */
  async function advance() {
    if (running) return;
    const waiting = records().filter((r) => ['imported', 'transcribing', 'transcribed'].includes(r.phase));
    if (!waiting.length) { stopWatching(); return; }
    let key; try { ({ key } = await readKey()); } catch { key = null; }
    if (!key) return;
    const summary = { finished: 0, transcribing: 0, waiting: 0, skipped: 0, failed: 0, problems: new Set() };
    running = (async () => { for (const record of waiting) { try { await advanceOne(record, key, summary); } catch { return; } } })();
    try { await running; } finally { running = null; }
    if (summary.finished) emit('finished', { count: summary.finished });
    if (!records().some((r) => ['imported', 'transcribing', 'transcribed'].includes(r.phase))) stopWatching();
  }
  function watch() { if (watcher || !watchMs) return; watcher = setInterval(() => { advance().catch(() => {}); }, watchMs); watcher.unref?.(); }
  function stopWatching() { if (watcher) { clearInterval(watcher); watcher = null; } }

  /** Whether a key exists, the last check, and what is in progress. Reads the key store, never the phone site. */
  async function status() {
    const { key, source } = await readKey();
    const all = records(), state = readState();
    return {
      schema: 'ar-create.phone-pickup.v1',
      state: key ? 'ready' : 'needs-key',
      keySource: key ? source : null,
      site: origin,
      lastCheckedAt: state.lastCheckedAt || null,
      last: state.last ? { ...state.last } : null,
      counts: {
        inProgress: all.filter((r) => INFLIGHT.has(r.phase)).length,
        sentBack: all.filter((r) => r.phase === 'posted').length,
        setAside: all.filter((r) => r.phase === 'skipped').length,
        needAttention: all.filter((r) => r.phase === 'failed').length,
      },
      message: key ? (state.last?.message || 'Ready. Press Check the phone.') : 'Needs a pickup key, see setup.',
      setup: SETUP,
    };
  }

  /** When AR Create starts: one automatic check, and only if the last one was more than 12 hours ago. */
  async function checkOnStart() {
    const { key } = await readKey();
    if (!key) return null;
    const last = Date.parse(readState().lastCheckedAt || '') || 0;
    if (now() - last < AUTO_CHECK_MIN_GAP_MS) { if (records().some((r) => ['imported', 'transcribing', 'transcribed'].includes(r.phase))) watch(); return null; }
    return check({ reason: 'start' });
  }

  return { check, status, advance, checkOnStart, stop: stopWatching, setup: () => SETUP };
}
