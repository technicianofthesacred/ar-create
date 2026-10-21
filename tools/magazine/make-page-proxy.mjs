#!/usr/bin/env node
// Builds editorial/builds-next/mag-preview.mjs: the 8766 magazine page with every save going through
// AR Create (D3), from ~/builds/mag-preview.mjs by exact, anchored replacements. Each anchor must match
// exactly the expected number of times, or nothing is written: a changed original is a stop, not a guess.
// The source hash is recorded in editorial/builds-next/MANIFEST.json, and the installer refuses to
// install over an original whose hash differs.
//
//   node tools/magazine/make-page-proxy.mjs [--from ~/builds/mag-preview.mjs]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseFlags} from './inventory.mjs';

const repo = path.resolve(import.meta.dirname, '..', '..');
export const NEXT = path.join(repo, 'editorial', 'builds-next');
const sha = b => createHash('sha256').update(b).digest('hex');

const HELPERS = `
// ── Saves go through AR Create (mag-arc.mjs, 2026-10-21): AR Create is the magazine's one writer. ──
// On the Mac every save below is an AR Create command as human:adrian (client mag-page); off the Mac
// the old local write runs inside the shared lock. Reads stay here.
const arcDo = async (route, input) => { const r = await arc(route, input); if (!r.body.ok) { const e = new Error(r.body.error || 'AR Create refused the save.'); e.status = r.status; throw e; } return r.body; };
async function saveEdit(b) {
  if (!ARC) return withLegacyLock(MAG, 'a page edit', () => edit(MAG, String(b.file || ''), Number(b.b), String(b.h || ''), String(b.text ?? '')));
  return arcDo('/api/magazine/edit', { path: String(b.file || ''), block: Number(b.b), seen: String(b.h || ''), text: String(b.text ?? '') });
}
async function saveAnswer(b) {
  if (!ARC) return withLegacyLock(MAG, 'an answer on the page', () => answer(MAG, String(b.file || ''), Number(b.index), String(b.value || '')));
  return arcDo('/api/magazine/ask/answer', { path: String(b.file || ''), index: Number(b.index), value: String(b.value || ''), ...(typeof b.title === 'string' && b.title ? { title: b.title } : {}) });
}
async function saveRequest(b, legacy) {
  if (!ARC) return withLegacyLock(MAG, 'a request from the page', legacy);
  return arcDo('/api/magazine/requests/add', b.step !== undefined ? { step: String(b.step), story: String(b.story || '') } : { kind: String(b.kind || ''), story: String(b.story || '') });
}
async function saveBlind(b, legacy) {
  if (!ARC) return withLegacyLock(MAG, 'page feedback', legacy);
  return arcDo('/api/magazine/page-feedback/add', { story: String(b.story || ''), step: String(b.step || ''), q: String(b.q || ''), value: b.value === 'yes' ? 'yes' : 'no', ...(b.note ? { note: String(b.note) } : {}) });
}
async function saveLineupVia(b) {
  if (!ARC) return withLegacyLock(MAG, 'the lineup', () => saveLineup(String(b.file || ''), b.slides, b.caption));
  return arcDo('/api/magazine/lineup/save', { path: String(b.file || ''), slides: b.slides, caption: String(b.caption ?? ''), expectedHash: String(b.hash || '') });
}
async function saveApprove(b, rel, v, look) {
  if (!ARC) return withLegacyLock(MAG, 'a yes on the page', async () => { if (look) await exportSlides(rel); approveMade(rel, v); });
  if (look) { const staged = await exportSlides(rel, { staging: true }); await arcDo('/api/magazine/export/save', { path: rel, staged: staged.name, files: staged.files, caption: staged.caption }); }
  return arcDo('/api/magazine/approve', { path: rel, value: v, expectedHash: String(b.hash || '') });
}
async function saveAlbum(story, link) {
  if (!ARC) return withLegacyLock(MAG, 'an album link', () => { fs.mkdirSync(path.join(FILES, story, 'Photos'), { recursive: true }); fs.writeFileSync(path.join(FILES, story, 'album-link.txt'), link + '\\n'); });
  return arcDo('/api/magazine/album/link', { story, link });
}
// A file uploaded with a story name is taken in by AR Create (it copies, transcribes and files RAW).
async function claimDrop(story, dest, defer) {
  if (!ARC) return startIntake(story, dest, { defer });
  const r = await arcDo('/api/magazine/drops/claim', { name: path.basename(dest), folder: 0, story });
  return r.claim?.claimId || '';
}
const madeHash = m => magHash('sha256').update(m.raw).digest('hex');
// D4: words an agent proposed (a draft, Adrian's note, a feedback message, post words) wait here for his yes.
async function yesBanner() {
  const r = await arcGet('/api/magazine/proposals', { status: 'open' }), n = (r.body.proposals || []).length;
  return r.status !== 200 ? '<p class="d-ctx">AR Create is not running, so nothing can be saved right now.</p>' : n ? '<p class="d-ctx"><a href="/yes">' + n + (n === 1 ? ' piece of writing waits' : ' pieces of writing wait') + ' for your yes</a></p>' : '';
}
async function yesPage() {
  const list = await arcGet('/api/magazine/proposals', { status: 'open' });
  const rows = await Promise.all((list.body.proposals || []).map(p => arcGet('/api/magazine/proposal', { proposalId: p.proposalId })));
  const cards = rows.map(r => r.body).filter(p => p && p.proposalId).map(p => '<div class="q d-q" data-proposal="' + esc(p.proposalId) + '"><p class="d-eyebrow">' + esc(p.story || '') + ' · proposed by ' + esc(String(p.actor).replace(/^agent:/, '')) + '</p><h2 class="d-qt">' + esc(p.path.split('/').pop().replace(/\.md$/, '')) + '</h2>' + (p.reason ? '<p class="d-ctx">' + esc(p.reason) + '</p>' : '') + (p.stale ? '<p class="d-ctx">The file changed after these words were proposed, so they can only be turned down; ask for a fresh version.</p>' : '') + '<details' + (p.current.exists ? '' : ' hidden') + '><summary>As it is now</summary><div class="readall">' + render(p.current.text || '') + '</div></details><details open><summary>Proposed</summary><div class="readall">' + render(p.content) + '</div></details><div class="d-opts">' + (p.stale ? '' : '<button class="opt big rec" data-yes="' + esc(p.proposalId) + '">Yes, save these words</button>') + '<button class="opt big ghost" data-no="' + esc(p.proposalId) + '">Not these</button></div></div>').join('');
  return page('Waiting for your yes', '<div class="top"><a href="/">← Stories</a></div><h1>Waiting for your yes</h1>' + (list.status !== 200 ? '<p>AR Create is not running.</p>' : cards || '<p>Nothing waits for your yes.</p>'));
}
`;

/** [description, find, replace, expected count] */
export const EDITS = [
  ['header note', "// folder. Binds to 127.0.0.1, so nothing is reachable from outside this Mac.", "// folder. Binds to 127.0.0.1, so nothing is reachable from outside this Mac.\n//\n// Since 2026-10-21 every save goes through AR Create (mag-arc.mjs): on this Mac the page asks AR Create\n// to write, as Adrian; off the Mac it writes as before inside the shared lock. Built from the original\n// by AR Create's tools/magazine/make-page-proxy.mjs; edit there, not here.", 1],
  ['imports', "import { renderLocalJob, renderRecordings, LOCAL_JOB_JS, LOCAL_TRANSCRIPT_CSS } from './mag-local/workshop-ui.mjs';", "import { renderLocalJob, renderRecordings, LOCAL_JOB_JS, LOCAL_TRANSCRIPT_CSS } from './mag-local/workshop-ui.mjs';\nimport { ARC, arc, arcGet, withLegacyLock } from './mag-arc.mjs';\nimport { createHash as magHash, randomUUID as magUuid } from 'crypto';", 1],
  ['helpers', "const app = http.createServer(async (req, res) => {", HELPERS + "\nconst app = http.createServer(async (req, res) => {", 1],
  ['workshop writes', "  if (await handleLocalRoute(req, res, url)) return;", "  // The recordings workshop's saves belong to AR Create now; the page keeps showing it read-only.\n  if (ARC && req.method === 'POST' && url.pathname.startsWith('/transcription')) return json(res, 409, { ok: false, error: 'Recordings are worked on in AR Create now (Material). Nothing was saved here.' });\n  if (await handleLocalRoute(req, res, url)) return;", 1],
  ['upload intake', "      out.on('finish', () => {", "      out.on('finish', async () => {", 1],
  ['upload claim', "        const job = story || automaticStory ? startIntake(story || automaticStory, dest, {defer:url.searchParams.get('defer')==='1'}) : '';", "        let job = '';\n        if (story || automaticStory) { try { job = await claimDrop(story || automaticStory, dest, url.searchParams.get('defer')==='1'); } catch (e) { return json(res, e.status || 409, { ok: false, error: 'Saved in the drop folder, but not taken in: ' + e.message, file: path.basename(dest) }); } }", 1],
  ['edit', "const r = edit(MAG, String(b.file || ''), Number(b.b), String(b.h || ''), String(b.text ?? ''));", "const r = await saveEdit(b);", 1],
  ['redo', "        if (!t.split('\\n').some(l => l.startsWith('- [ ]') && l.endsWith('Redo ' + step + ' · ' + story))) fs.writeFileSync(f, t.replace(/\\s*$/, '\\n') + line + '\\n');", "        await saveRequest(b, () => { if (!t.split('\\n').some(l => l.startsWith('- [ ]') && l.endsWith('Redo ' + step + ' · ' + story))) fs.writeFileSync(f, t.replace(/\\s*$/, '\\n') + line + '\\n'); });", 1],
  ['blind', "        fs.writeFileSync(f, t.replace(/\\s*$/, '\\n') + '- ' + new Date().toISOString().slice(0, 16).replace('T', ' ')", "        await saveBlind(b, () => fs.writeFileSync(f, t.replace(/\\s*$/, '\\n') + '- ' + new Date().toISOString().slice(0, 16).replace('T', ' ')", 1],
  ['blind close', "(b.note ? ': ' + clean(b.note) : '') + '\\n');\n        return json(res, 200, { ok: true });", "(b.note ? ': ' + clean(b.note) : '') + '\\n'));\n        return json(res, 200, { ok: true });", 1],
  ['lineup', "saveLineup(String(b.file || ''), b.slides, b.caption); return json(res, 200, { ok: true }); }", "const lr = await saveLineupVia(b); return json(res, 200, { ok: true, ...(lr && lr.hash ? { hash: lr.hash } : {}) }); }", 1],
  ['approve', "        if (look) await exportSlides(rel); approveMade(rel, v); return json(res, 200, { ok: true }); }", "        await saveApprove(b, rel, v, look); return json(res, 200, { ok: true }); }", 1],
  ['make', "        if (!t.split('\\n').some(l => l.endsWith(kind + ' · ' + story) && l.startsWith('- [ ]'))) fs.writeFileSync(f, t.replace(/\\s*$/, '\\n') + line + '\\n');", "        await saveRequest(b, () => { if (!t.split('\\n').some(l => l.endsWith(kind + ' · ' + story) && l.startsWith('- [ ]'))) fs.writeFileSync(f, t.replace(/\\s*$/, '\\n') + line + '\\n'); });", 1],
  ['answer', "answer(MAG, String(b.file || ''), Number(b.index), String(b.value || '')); return json(res, 200, { ok: true }); }", "await saveAnswer(b); return json(res, 200, { ok: true }); }", 1],
  ['album', "        fs.mkdirSync(path.join(FILES, story, 'Photos'), { recursive: true });\n        fs.writeFileSync(path.join(FILES, story, 'album-link.txt'), link + '\\n');", "        await saveAlbum(story, link);", 1],
  ['status codes', "    } catch (e) { return json(res, 400, { ok: false, error: e.message }); }", "    } catch (e) { return json(res, e.status || 400, { ok: false, error: e.message }); }", 1],
  ['export staging', "async function exportSlides(rel) {\n  const m = madeFile(rel), { slides, caption } = lookSlides(m), dir = exportDir(m.abs), bin = chrome();", "async function exportSlides(rel, opts = {}) {\n  // With AR Create the slides are rendered into the page's cache (export staging); AR Create copies them into the vault.\n  const stagedName = 'x' + Date.now() + '-' + magUuid().slice(0, 8);\n  const m = madeFile(rel), { slides, caption } = lookSlides(m), dir = opts.staging ? path.join(CACHE, 'export', stagedName) : exportDir(m.abs), bin = chrome();", 1],
  ['export result', "  fs.writeFileSync(path.join(dir, 'caption.txt'), caption + '\\n');\n  return slides.length;", "  fs.writeFileSync(path.join(dir, 'caption.txt'), caption + '\\n');\n  if (opts.staging) return { name: stagedName, caption, files: slides.map((_, i) => { const name = 'slide-' + String(i + 1).padStart(2, '0') + '.png'; return { name, sha256: magHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex') }; }) };\n  return slides.length;", 1],
  ['question titles', 'data-index="${q.index}" data-value="', 'data-index="${q.index}" data-title="${esc(q.title)}" data-value="', 2],
  ['form titles', '<form class="other" data-file="${esc(file)}" data-index="${q.index}"', '<form class="other" data-file="${esc(file)}" data-index="${q.index}" data-title="${esc(q.title)}"', 2],
  ['lineup hash', `'<div class="q d-q d-made d-lineup" data-file="' + esc(m.file) + '">`, `'<div class="q d-q d-made d-lineup" data-file="' + esc(m.file) + '" data-hash="' + madeHash(m) + '">`, 1],
  ['look hash', `'<div class="q d-q d-made d-look" data-file="' + esc(m.file) + '" data-story="`, `'<div class="q d-q d-made d-look" data-file="' + esc(m.file) + '" data-hash="' + madeHash(m) + '" data-story="`, 1],
  ['js lineup', "const r=await post('/lineup',{file:box.dataset.file,slides,caption:box.querySelector('.ln-caption').value});", "const r=await post('/lineup',{file:box.dataset.file,hash:box.dataset.hash,slides,caption:box.querySelector('.ln-caption').value});if(r.ok&&r.hash)box.dataset.hash=r.hash;", 1],
  ['js answer', "post('/answer',{file:o.dataset.file,index:+o.dataset.index,value:o.dataset.value})", "post('/answer',{file:o.dataset.file,index:+o.dataset.index,title:o.dataset.title,value:o.dataset.value})", 1],
  ['js answer form', "post('/answer',{file:f.dataset.file,index:+f.dataset.index,value:v})", "post('/answer',{file:f.dataset.file,index:+f.dataset.index,title:f.dataset.title,value:v})", 1],
  ['js words', "post('/approve',{file:aw.dataset.approveWords,value:'words'})", "post('/approve',{file:aw.dataset.approveWords,hash:box.dataset.hash,value:'words'})", 1],
  ['js yes', "post('/approve',{file:ap.dataset.approve,value:'yes'})", "post('/approve',{file:ap.dataset.approve,hash:(ap.closest('[data-hash]')||{dataset:{}}).dataset.hash,value:'yes'})", 1],
  ['yes page', "  if (url.pathname === '/') {\n    html = page('Teajia Magazine', frontPage(", "  if (ARC && url.pathname === '/yes') {\n    html = await yesPage();\n  } else if (url.pathname === '/') {\n    html = page('Teajia Magazine', (ARC ? await yesBanner() : '') + frontPage(", 1],
  ['yes save', "      if (url.pathname === '/answer') { await saveAnswer(b);", "      if (url.pathname === '/proposal') { if (!ARC) return json(res, 404, { ok: false, error: 'not found' }); await arcDo(b.yes === true ? '/api/magazine/proposal/accept' : '/api/magazine/proposal/reject', { proposalId: String(b.id || '') }); return json(res, 200, { ok: true }); }\n      if (url.pathname === '/answer') { await saveAnswer(b);", 1],
  ['js yes buttons', "  const cc=e.target.closest('[data-copy-cap]');", "  const py=e.target.closest('[data-yes],[data-no]');\n  if(py){py.disabled=true;const r=await post('/proposal',{id:py.dataset.yes||py.dataset.no,yes:!!py.dataset.yes});if(r.ok)location.reload();else{py.disabled=false;toast(r.error)}return}\n  const cc=e.target.closest('[data-copy-cap]');", 1],
  ['js change', "post('/approve',{file:f.dataset.file,value:v0})", "post('/approve',{file:f.dataset.file,hash:(f.closest('[data-hash]')||{dataset:{}}).dataset.hash,value:v0})", 1],
];

export function buildProxy(original) {
  let text = original;
  for (const [what, find, replace, count] of EDITS) {
    const n = text.split(find).length - 1;
    if (n !== count) throw new Error(`The page changed: "${what}" was expected ${count} time(s) and found ${n}. Nothing was written.`);
    text = text.split(find).join(replace);
  }
  return text;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const flags = parseFlags(process.argv.slice(2), {from: 'value'});
    const from = flags.from || path.join(os.homedir(), 'builds', 'mag-preview.mjs');
    const original = fs.readFileSync(from, 'utf8'), next = buildProxy(original);
    fs.mkdirSync(NEXT, {recursive: true});
    fs.writeFileSync(path.join(NEXT, 'mag-preview.mjs'), next);
    const manifestFile = path.join(NEXT, 'MANIFEST.json');
    const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {schema: 'ar-create.builds-next.v1', files: {}};
    manifest.files['mag-preview.mjs'] = {installsTo: '~/builds/mag-preview.mjs', builtFrom: {sha256: sha(original), bytes: Buffer.byteLength(original)}, sha256: sha(next)};
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
    console.log(JSON.stringify({wrote: 'editorial/builds-next/mag-preview.mjs', edits: EDITS.length, from: sha(original).slice(0, 12)}));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
