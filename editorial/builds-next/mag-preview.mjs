// mag-preview — the Teajia magazine page, on this Mac only: http://localhost:8766/
//
//   node ~/builds/mag-preview.mjs
//
// The front page is Adrian's: every story, ordered by how close it is to done (a toggle flips it),
// in three groups: waiting on you, what Claude is working on, and live. Every choice he has to make
// is a button. The questions come from `Workflow/ASK - [Story].md` files that /mag writes as the work
// goes (format in mag-ask.mjs); a click writes the answer back into that file, so a new decision
// needs no new code here. He only ever opens something he can act on: a draft or a map to read,
// with that question's buttons at the bottom of the page.
//
// Also serves any magazine file as a readable page (/read/<path>), opens a story's Photos folder or
// the Drop folder in Finder, and takes a shared iCloud album link (then runs mag-photos).
// Writes only: answers into ASK files (and the record each names), album-link.txt in a story's Files
// folder. Binds to 127.0.0.1, so nothing is reachable from outside this Mac.
//
// Since 2026-10-21 every save goes through AR Create (mag-arc.mjs): on this Mac the page asks AR Create
// to write, as Adrian; off the Mac it writes as before inside the shared lock. Built from the original
// by AR Create's tools/magazine/make-page-proxy.mjs; edit there, not here.

import { splitBlocks, plain, editable, hash, edit } from './mag-edit.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile, execFileSync, spawn } from 'child_process';
import { listAsks, answer } from './mag-ask.mjs';
import { dropped, DROPS } from './mag-config.mjs';
import os from 'os';
import { createRequire } from 'module';
// fileURLToPath, not .pathname: on Windows .pathname gives "/C:/…", which joins into "C:\\C:\\…".
const IG_FILE = (await import('url')).fileURLToPath(new URL('./ig-templates.js', import.meta.url));
const IG_SRC = fs.readFileSync(IG_FILE, 'utf8').replace(/^if \(typeof module[^\n]*$/m, '');
const IG = createRequire(import.meta.url)('./ig-templates.js');
const LOOK_JS = fs.readFileSync(new URL('./mag-look.js', import.meta.url), 'utf8');
// mag-local-v1
import { startLocalIntake, localJobs, handleLocalRoute } from './mag-local/jobs.mjs';
import { renderLocalJob, renderRecordings, LOCAL_JOB_JS, LOCAL_TRANSCRIPT_CSS } from './mag-local/workshop-ui.mjs';
import { ARC, arc, withLegacyLock } from './mag-arc.mjs';
import { createHash as magHash, randomUUID as magUuid } from 'crypto';

const HOME = process.env.HOME;
const FILES = process.env.MAG_FILES || (() => {
  try {
    const m = fs.readFileSync(path.join(HOME, 'builds/mag-intake.config'), 'utf8').match(/MAG_FILES:=([^}]+)\}/);
    return m ? m[1].replace('$HOME', HOME) : '';
  } catch { return ''; }
})();
const PORT = Number(process.env.MAG_PREVIEW_PORT || 8766);
const MAG = process.env.MAG_VAULT ||
  path.join(HOME, 'Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const href = (rel) => '/read/' + rel.split('/').map(p => encodeURIComponent(p).replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16))).join('/');
const lead = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');

// ── Reading a file ──────────────────────────────────────────────────────
function inline(s) {
  s = esc(String(s).replace(/(^|[\s(\[>—-])"/g, '$1\u201c').replace(/"/g, '\u201d'));
  s = s.replace(/(?<!\[)\[([^\[\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, '<span class="rework" title="marked for rework">$1</span>');
  s = s.replace(/%%([\s\S]*?)%%/g, (m, t) => '<span class="note' + (/^you\b/i.test(t) ? ' you' : '') + '">' + t + '</span>');
  s = s.replace(/==([\s\S]*?)==/g, '<mark>$1</mark>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g, '<span class="term" title="glossary: $1">$2</span>');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<span class="wl">$1</span>');
  return s;
}
// The inside of one edited block, for the page to swap in without reloading.
function blockHtml(raw) {
  const t = raw.trim();
  const h = t.match(/^#{1,4}\s+(.*)$/s);
  if (h) return inline(h[1]);
  if (t.startsWith('>')) return inline(t.replace(/^>\s?/gm, ''));
  return t.split('\n').map(inline).join('<br>');
}
function editsFor(rel) {
  const log = path.join(MAG, 'Workflow/4-Review', 'EDITS - ' + path.basename(rel));
  const map = new Map(); let txt = ''; try { txt = fs.readFileSync(log, 'utf8'); } catch { return map; }
  const norm = t => t.replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
  for (const ch of txt.split(/\n## /).slice(1)) { const day = ch.slice(0, 10), b = (ch.match(/^- before: (.*)$/m) || [])[1], a = (ch.match(/^- after: (.*)$/m) || [])[1];
    if (a && a !== '(removed)') { const prev = b ? map.get(norm(b)) : null; if (prev) map.delete(norm(b)); const orig = prev ? prev.before : (b || ''); if (norm(orig) !== norm(a)) map.set(norm(a), { before: orig, day: prev ? prev.day : day }); } }
  map.norm = norm; return map;
}
function render(md, editFile = '') {
  const edits = editFile && /^Workflow\/3-Develop\/DEV - /.test(editFile) ? editsFor(editFile) : null;
  // A draft is editable on its page: each paragraph carries its place and a hash of what was shown.
  const { parts } = splitBlocks(md);
  const out = [];
  for (let k = 0; k < parts.length; k += 2) {
    const block = parts[k];
    const t = block.trim();
    if (!t) continue;
    const ev = edits && edits.size && editable(block) ? edits.get(edits.norm(plain(block))) : null;
    const ed = editFile && editable(block) ? ` data-b="${k / 2}" data-h="${hash(block)}" data-plain="${esc(plain(block))}"` + (ev ? ` data-was="${esc(ev.before)}" data-when="${ev.day}"` : '') : '';
    if (/^%%[\s\S]*%%$/.test(t)) { out.push(`<p class="note block${/^%%you\b/i.test(t) ? ' you' : ''}">${inline(t.slice(2, -2))}</p>`); continue; }
    if (t === '---') { out.push('<hr>'); continue; }
    const h = t.match(/^(#{1,4})\s+(.*)$/s);
    if (h) { const n = Math.min(h[1].length, 3), [first, ...more] = h[2].split('\n'), rest = more.filter(l => l.trim());
      if (!rest.length) { out.push(`<h${n}${ed}>${inline(first)}</h${n}>`); continue; }
      const body = rest.every(l => /^\s*([-*] |\d+\. )/.test(l) || /^\s+/.test(l)) ? '<ul>' + rest.map(l => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('') + '</ul>' : `<p>${rest.map(inline).join('<br>')}</p>`;
      out.push(`<div class="hblock"><h${n}>${inline(first)}</h${n}>${body}</div>`); continue; }
    if (t.startsWith('>')) { out.push(`<blockquote${ed}>${inline(t.replace(/^>\s?/gm, ''))}</blockquote>`); continue; }
    const lead = t.match(/^(%%[^\n]*%%)\n(>[\s\S]*)$/);
    if (lead) { out.push(`<p class="note block">${inline(lead[1].slice(2, -2))}</p>`, `<blockquote${ed}>${inline(lead[2].replace(/^>\s?/gm, ''))}</blockquote>`); continue; }
    if (/^[-*] /m.test(t) && t.split('\n').every(l => /^\s*([-*] |\d+\. )/.test(l) || /^\s+/.test(l))) {
      out.push('<ul>' + t.split('\n').map(l => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('') + '</ul>'); continue;
    }
    if (/^\|/.test(t)) { out.push(`<pre>${esc(t)}</pre>`); continue; }
    const lines = t.split('\n');
    const label = lines[0].match(/^\*\*([^*]+):\*\*\s*$/);
    if (label) { out.push(`<p class="speaker">${esc(label[1])}</p><p>${inline(lines.slice(1).join(' '))}</p>`); continue; }
    const said = /^["\u201c]/.test(t) ? ' class="said"' : /^==[\s\S]*==(\s*%%[\s\S]*%%)?$/.test(t) ? ' class="mine"' : '';
    out.push(`<p${said}${ed}>${lines.map(inline).join('<br>')}</p>`);
  }
  const body = out.join('\n');
  return editFile ? `<div class="editable" data-file="${esc(editFile)}">${body}</div>` : body;
}

// ── The data: the board (steps, photos, live) and the questions ─────────
function data() {
  let board = [];
  try { board = JSON.parse(execFileSync('node', [path.join(HOME, 'builds/mag-status.mjs'), '--json'], { encoding: 'utf8', env: process.env })).board; } catch {}
  const asks = listAsks(MAG);
  for (const b of board) {
    b.askFile = (asks.find(a => lead(a.story) === lead(b.story) || lead(a.story).startsWith(lead(b.story))) || {}).file || '';
    b.questions = b.askFile ? asks.find(a => a.file === b.askFile).questions : [];
    b.title = b.published
      ? b.published.replace(/\/$/, '').split('/').pop().split('-').map((w, i) => i && /^(and|of|the|a)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)).join(' ')
      : b.story;
  }
  return board;
}

// What Claude is doing at each of his steps, in plain words.
const DOING = { 2: 'Preparing the transcript', 3: 'Making the map', 5: 'Writing and editing the draft', 7: 'Folding in your changes and checking every quote',
  9: 'Placing the photos', 12: 'Filing their replies' };

// ── Pieces of the page ──────────────────────────────────────────────────
const bar = (step) => `<div class="bar" title="Step ${step} of 12">${Array.from({ length: 12 }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>`;

function questionHtml(q, file) {
  const id = `${file}#${q.index}`;
  if (!q.open) {
    return `<div class="q done"><span class="check">✓</span><span class="qt">${esc(q.title)}</span><span class="val">${esc(q.value)}</span>` +
      `<button class="link" data-reopen="${esc(id)}">Change</button><div class="reopen" hidden>${questionHtml({ ...q, open: true }, file).replace('class="q"', 'class="q inner"')}</div></div>`;
  }
  const opts = q.options.map(o => `<button class="opt${o.recommended ? ' rec' : ''}${o.chosen ? ' chosen' : ''}" data-file="${esc(file)}" data-index="${q.index}" data-title="${esc(q.title)}" data-value="${esc(o.label)}">${esc(o.label)}${o.recommended ? '<small>my pick</small>' : ''}</button>`).join('');
  const other = (q.other || q.text) ? `<form class="other" data-file="${esc(file)}" data-index="${q.index}" data-title="${esc(q.title)}"${q.text ? '' : ' hidden'}><input name="v" placeholder="${q.text ? 'Type it here' : 'Say what instead'}" value="${esc(q.text ? q.answer : '')}"><button class="save" type="submit">Save</button></form>` : '';
  const otherBtn = q.other && !q.text ? `<button class="opt ghost" data-show-other>${esc(q.otherLabel || "Something else")}…</button>` : '';
  const read = q.read ? (q.reads || [q.read]).map(r => `<a class="read" href="${href(r.file)}">${esc(r.label)} →</a>`).join(' &nbsp; ') : '';
  return `<div class="q"><div class="qt">${esc(q.title)}</div>${q.context.length ? `<p class="ctx">${inline(q.context.join(' '))}</p>` : ''}${read}` +
    `<div class="opts">${opts}${otherBtn}</div>${other}</div>`;
}

// ── The ledger: every line research changed in a story, on one screen (Adrian chose it, 2026-10-04) ──
// Each row shows what was said with the words that change struck, and the chosen version's new words
// in bronze, so he decides on the words themselves. The buttons are ordinary answer buttons.
function wordDiff(a, b) {
  const A = a ? a.split(' ') : [], B = b ? b.split(' ') : [], n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push(esc(A[i])); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`<del>${esc(A[i++])}</del>`);
    else out.push(`<ins>${esc(B[j++])}</ins>`);
  }
  while (i < n) out.push(`<del>${esc(A[i++])}</del>`);
  while (j < m) out.push(`<ins>${esc(B[j++])}</ins>`);
  return out.join(' ');
}

function ledgerHtml(qs, file) {
  const STD = ['Suggested', 'As said', 'Cut'];
  const pick = q => q.open ? 'Suggested' : q.value;
  const n = { Suggested: 0, 'As said': 0, Cut: 0, mine: 0 };
  const rows = qs.map(q => {
    const L = q.line, chosen = pick(q), mine = !STD.includes(chosen);
    n[mine ? 'mine' : chosen]++;
    const text = chosen === 'As said' ? L.said : chosen === 'Cut' ? '' : mine ? chosen : (L.suggested || '');
    const telling = chosen === 'Suggested' && /^yes$/i.test(L.telling || '');
    const body = telling ? `<del>${esc(L.said)}</del> <ins class="tell">${esc(text)}</ins>` : wordDiff(L.said, text);
    const opts = STD.map(lbl => `<button class="opt lg-opt${lbl === chosen ? (q.open ? ' pre' : ' on') : ''}" data-file="${esc(file)}" data-index="${q.index}" data-title="${esc(q.title)}" data-value="${esc(lbl)}">${lbl}</button>`).join('') +
      `<button class="opt lg-opt${mine ? ' on' : ''}" data-show-other>My words</button>`;
    const form = `<form class="other" data-file="${esc(file)}" data-index="${q.index}" data-title="${esc(q.title)}" hidden><input name="v" placeholder="Say it your way" value="${esc(mine ? chosen : '')}"><button class="save" type="submit">Save</button></form>`;
    return `<div class="q lg-row${q.open ? ' open' : ''}" data-index="${q.index}"><div class="lg-who">${esc(L.who || '')}<span>${esc(L.at || '')}</span></div>` +
      `<div class="lg-main"><p class="lg-text">${body}${telling ? '<span class="lg-tag">your telling</span>' : ''}</p>${L.why ? `<p class="lg-why">${inline(L.why)}</p>` : ''}<div class="lg-opts">${opts}</div>${form}</div></div>`;
  }).join('');
  const parts = [`${n.Suggested} as I suggested`]; if (n['As said']) parts.push(`${n['As said']} as said`); if (n.Cut) parts.push(`${n.Cut} cut`); if (n.mine) parts.push(`${n.mine} in your words`);
  const left = qs.filter(q => q.open).length;
  const all = left ? `<button class="lg-all" data-all="${esc(JSON.stringify(qs.filter(q => q.open).map(q => q.index)))}" data-file="${esc(file)}">Take every suggestion</button>` : '';
  return `<section class="ledger"><div class="lg-head"><div><p class="lg-eyebrow">${qs.length} lines research changed${left ? ` · ${left} not yet settled` : ' · all settled'}</p><h3>${parts.join(', ')}</h3></div>${all}</div>${rows}</section>`;
}

function photosHtml(b, remote) {
  const n = b.photos || 0;
  const what = b.published ? 'On the live page' : n ? `${n} photo${n === 1 ? '' : 's'}` : 'No photos yet';
  // "Open folder" opens Finder on the Mac, so it only shows on the Mac itself, not on the phone.
  return `<div class="photos"><span>${what}${b.album ? ' · shared album linked' : ''}</span>` +
    (remote ? '' : `<a class="mini" href="${esc(new URL(b.photosLink).pathname)}" data-open>Open folder</a>`) +
    `<button class="mini" data-show-album>Shared album link</button>` +
    `<form class="album" data-story="${esc(b.story)}" hidden><input name="link" placeholder="https://www.icloud.com/sharedalbum/#…"><button class="save" type="submit">Add</button></form></div>`;
}

function card(b, remote) {
  const lines = b.questions.filter(q => q.line && q.line.said);
  const ledger = lines.length ? ledgerHtml(lines, b.askFile) : '';
  const rest = b.questions.filter(q => !(q.line && q.line.said));
  const open = rest.filter(q => q.open);
  const answered = rest.filter(q => !q.open);
  const linesOpen = lines.some(q => q.open);
  const kind = open.length || linesOpen ? 'you' : b.step >= 11 && b.who !== 'you' ? 'live' : b.who === 'you' ? 'you' : 'me';
  const doing = answered.length && !open.length ? 'You answered; I act on it the next time /mag runs' : DOING[b.step] || b.stepName;
  const head = `<div class="head"><div><h2>${esc(b.title)}</h2><p class="meta">Step ${b.step} of 12 · ${esc(b.stepName)}</p></div>${bar(b.step)}</div>`;
  let body = '';
  if (kind === 'you') {
    body = open.map(q => questionHtml(q, b.askFile)).join('') + ledger + answered.map(q => questionHtml(q, b.askFile)).join('');
    if (!b.questions.length) body = `<p class="ctx">Waiting on you: ${esc(b.stepName.toLowerCase())}. I'll put the question here as buttons on my next run.</p>`;
  } else body = `<p class="doing">${esc(doing)}</p>` + ledger + answered.map(q => questionHtml(q, b.askFile)).join('');
  const live = b.published ? `<a class="mini" href="${esc(b.published)}">Live page</a>` : '';
  return { kind, html: `<article class="card ${kind}" data-step="${b.step}">${head}${body}<div class="foot">${photosHtml(b, remote)}${live}</div></article>` };
}

// ── Upload: the easiest way in, from the Mac or the phone ───────────────
// The file is streamed into the first drop folder. With a story name, intake starts at once in the
// background (transcribing a recording takes minutes), so the story is at step 2 by the next /mag.
// Each intake is a job with a small JSON record, so the page can say what is running or what failed.
const MAX_UPLOAD = 4 * 1024 ** 3;
const startIntake = startLocalIntake;
const jobs = localJobs;
// A drop zone like Google Drive: drag several files onto it, or tap it to pick several. Each file
// uploads on its own with its own bar. One file with a story name starts intake straight away; several
// files land in the drop folder for /mag to sort out (a recording and its voice note, parts, and so on).
const UPLOAD = `<form class="upload card">
<label class="zone"><input type="file" name="file" multiple accept="audio/*,video/*,.m4a,.mp3,.wav,.mov,.mp4,.txt,.md,.docx,.rtf,.srt,.vtt">
<span class="big">Drop recordings or transcripts here</span><span class="small">or tap to choose · several at once is fine</span></label>
<div class="other"><input name="story" placeholder="Story name, for a single file (optional): recordings start automatically"></div>
<div class="queue"></div></form>`;

// The other ways in, all landing in a drop folder that /mag takes in the same way.
const HOW_TO_DROP = `<details class="how"><summary>Other ways to drop a file</summary>
<p><strong>On this computer:</strong> put it in the Drop folder (the button opens it).</p>
<p><strong>From your phone, iCloud:</strong> Voice Memos → Share → Save to Files → iCloud Drive → Teajia Drop.</p>
<p><strong>From your phone, pCloud:</strong> upload it to Files → 1 Areas → Brands → Teajia → Magazine → Drop. pCloud can take a while to reach the Mac.</p>
<p>Then tell me <code>/mag</code> and I take it in.</p></details>`;

// ── The desk (Adrian chose layout E, 2026-10-04): stories down the left, the chosen story's 12 steps
// across the top, one question at a time, and around it what to read, make, photos and what I do next.
const STEP_NAMES = ['Drop','Source','Map','Pick','Draft','Read','Check','Photos','Layout','Look','Feedback','Done'];
// What each step needs, and from whom. Step 5 is mine until the draft exists, then it waits on his read.
const STEP_NEED = { 1: ['you', 'Drop the recording in. That is all.'], 2: ['me', 'Turn the recording into a clean transcript and check the facts.'],
  3: ['me', 'Write two or three ways the story could go, with titles.'], 4: ['you', 'Pick the direction and the title. The draft follows from them.'],
  5: ['me', 'Write the draft from your pick.'], 6: ['you', 'Read the draft. Click any line to change it, then say good or what to change.'],
  7: ['me', 'Fold in your changes and check every quote against the recording.'], 8: ['you', 'Put the story\'s photos in its folder, in any order.'],
  9: ['me', 'Place each photo beside the passage it shows.'], 10: ['you', 'Look at the finished page, then say publish.'],
  11: ['you', 'Send the thank-you message on WeChat, then press Sent.'], 12: ['me', 'File their reply and correct the page with your yes.'] };
// The story so far, from the story's own files, so any step can be answered coming in blind:
// who and where (SRC header), what it is about (the map's pick, else the brief's line), his own opening
// (CONTEXT), and what he has already decided (the map's dated decisions).
function storyFiles(b) {
  const W = path.join(MAG, 'Workflow');
  const find = (dir, kind) => { try { return fs.readdirSync(path.join(W, dir)).filter(f => f.startsWith(kind + ' - ') && lead(f.slice(kind.length + 3)) === lead(b.story)).map(f => path.join(W, dir, f)); } catch { return []; } };
  return { src: find('1-Source', 'SRC')[0], ctx: find('1-Source', 'CONTEXT')[0], map: find('2-Guidance', 'MAP')[0], brief: find('3-Develop', 'BRIEF')[0] };
}
const readOr = p => { try { return p ? fs.readFileSync(p, 'utf8') : ''; } catch { return ''; } };
const plainText = t => t.replace(/%%[\s\S]*?%%/g, '').replace(/==|\*\*|\*|_|\[\[term:[^|]+\||\]\]/g, '').replace(/\s+/g, ' ').trim();
function storySoFar(b) {
  const f = storyFiles(b), src = readOr(f.src), ctx = readOr(f.ctx), map = readOr(f.map), brief = readOr(f.brief);
  const head = k => (src.match(new RegExp('^\\*\\*' + k + ':\\*\\*\\s*(.+)$', 'm')) || [])[1] || '';
  const who = [head('Story Subject'), head('Location'), head('Interview Date')].filter(Boolean).map(plainText).join(' · ');
  const decisions = (map.split(/^## Adrian's decisions.*$/m)[1] || '').split(/^## /m)[0].split('\n').filter(l => /^- \d{4}-\d\d-\d\d:/.test(l))
    .map(l => plainText(l.replace(/^- \d{4}-\d\d-\d\d:\s*/, '').replace(/\s*\(picked on the magazine page\)\s*$/, '')));
  const settled = (map.split(/^## Settled before the map.*$/m)[1] || '').split(/^## /m)[0].split('\n').filter(l => /^- \d{4}/.test(l)).map(l => plainText(l.replace(/^- \d{4}-\d\d-\d\d:\s*/, '')));
  const aboutDecision = decisions.find(d => /about|which way|direction|story stand|angle/i.test(d));
  const line = (brief.split(/^## The line it stands on.*$/m)[1] || '').split(/^## /m)[0].trim().split('\n')[0];
  const mapLine = (map.match(/^\*\*(One|Two|Three)[^*]+\*\*/m) || [''])[0];
  const about = aboutDecision ? aboutDecision.replace(/^.*?\?\s*:\s*|^.*?:\s*/, '') : plainText(line || mapLine);
  const opening = plainText(((ctx.split(/^### Opening.*$/m)[1] || '').split(/^#{2,3} /m)[0].split('\n').filter(l => l.trim() && !/^Adrian's own|^>/.test(l))[0] || ''));
  const tidy = d => { const m = d.match(/^(.*?)\?\s*:\s*(.+)$/); if (!m) return d.replace(/\s*\("[^"]*"\)\.?$/, '');
    const q = m[1].toLowerCase(), v = m[2];
    const label = /keep these titles/.test(q) ? 'Titles for parts 2 and 3' : /title/.test(q) ? (m[1].match(/part \d/i) ? 'Title, ' + m[1].match(/part \d/i)[0].toLowerCase() : 'Title') : /read/.test(q) ? 'Your read' : /keep these titles/.test(q) ? 'Other titles' : /remember|saw|see/.test(q) ? 'What you remember' : m[1];
    return label + ': ' + v.replace(/^./, c => c.toLowerCase()); };
  const done = settled.concat(decisions).filter(d => d !== aboutDecision).slice(-4).map(tidy);
  const go = (label, url) => url ? '<a href="' + url + '">' + label + '</a>' : '';
  const stepUrl = n => b.step >= n ? deskUrl(b.story) + '&step=' + n : '';
  const relOf = p => p ? href(path.relative(MAG, p)) : '';
  const row = (k, link, v) => v ? '<div class="d-sf-row"><dt><span>' + k + '</span>' + link + '</dt><dd>' + v + '</dd></div>' : '';
  const rows = row('Who', go('transcript', stepUrl(2)), esc(who)) +
    row('About', go('change', stepUrl(3)), esc(about)) +
    row('Opening', go('edit', relOf(f.ctx)), esc(opening.length > 260 ? opening.slice(0, 257).replace(/\s\S*$/, '') + '…' : opening)) +
    (done.length ? row('Decided', go('change', stepUrl(4)), '<ul>' + done.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul>') : '');
  return rows ? '<section class="d-sofar"><p class="d-eyebrow">The story so far</p><dl>' + rows + '</dl></section>' : '';
}

// ── 2. Any step can be opened, and redone ──────────────────────────────────────────
function stepPanel(b, n, remote) {
  const W = 'Workflow/', f = storyFiles(b), rel = p => path.relative(MAG, p);
  const links = [];
  const add = (label, p) => { if (p && fs.existsSync(p)) links.push('<a href="' + href(rel(p)) + '">' + esc(label) + ' →</a>'); };
  if (n === 2) { add('The clean transcript', f.src); add('What research found', path.join(MAG, W + '3-Develop/RESEARCH - ' + b.story + '.md')); }
  if (n === 3 || n === 4) add('The map', f.map);
  if ((n === 5 || n === 6 || n === 9) && b.newestDraft) add('The draft', path.join(MAG, W + '3-Develop/' + b.newestDraft));
  if (n === 7 && b.newestCheck) add('The checks', path.join(MAG, W + '4-Review/' + b.newestCheck));
  if (n === 11) add('The thank-you message', path.join(MAG, W + '6-Feedback/FEEDBACK - ' + b.title + '.md'));
  if ((n === 10 || n === 11 || n === 12) && b.published) links.push('<a href="' + esc(b.published) + '">The live page →</a>');
  if (n === 1 && !remote) links.push('<a href="' + esc(new URL(b.photosLink).pathname.replace(/\/photos\//, '/photos/')) + '" data-open>The story\'s folder</a>');
  const [who] = STEP_NEED[n] || ['me'];
  const name = STEP_NAMES[n - 1];
  const asked = makeRequests().some(r => r.story === b.story && r.kind === 'Redo ' + name);
  const redo = n >= b.step ? '' : asked ? '<p class="d-asked">You asked me to redo this step. I will on the next /mag.</p>'
    : '<button class="opt big ghost" data-redo="' + esc(name) + '" data-story="' + esc(b.story) + '">' + (who === 'me' ? 'Ask me to redo the ' + name.toLowerCase() : 'Put this step back to you') + '</button>';
  return '<section class="d-q d-past"><p class="d-eyebrow d-move">Step ' + n + ' of 12 · ' + esc(name) + (n === b.step ? ' · where the story is now' : ' · done') + '</p>' +
    '<h2 class="d-qt">' + esc(n < b.step ? STEP_DONE[n] : (STEP_NEED[n] || ['', ''])[1]) + '</h2>' +
    (links.length ? '<p class="d-reads"><span>What it made</span>' + links.join('') + '</p>' : '<p class="d-ctx">Nothing to open for this step.</p>') +
    '<div class="d-opts">' + redo + '</div><div class="d-nav"><a href="' + deskUrl(b.story) + '">Back to your move</a></div></section>';
}

// A thank-you message: the section to send (editable, with Copy) and the English beside it for reference.
function messageView(md, rel, file) {
  const html = render(md, rel);
  // Split the rendered page at its section headings, keeping the editable blocks as they are.
  const sections = {}; let cur = 'intro';
  for (const piece of html.split(/(?=<h2[ >])/)) {
    const m = piece.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (m) cur = m[1].replace(/<[^>]+>/g, '').toLowerCase();
    sections[cur] = (sections[cur] || '') + (m ? piece.slice(m[0].length) : piece);
  }
  const pick = re => Object.keys(sections).find(k => re.test(k));
  const strip = h => (h || '').replace(/<hr>/g, '');
  const zh = pick(/chinese|send this/), en = pick(/english|what it says/);
  if (!zh) return '<div class="d-doc">' + html + '</div>';
  return '<div class="d-msg"><div class="d-msg-head"><span>The message to send · type in it to change any word</span><button class="opt small" data-copy-msg>Copy the message</button></div>' +
    '<div class="editable d-msg-zh" lang="zh" data-file="' + esc(rel) + '">' + strip(sections[zh]).replace(/^\s*<div class="editable"[^>]*>|<\/div>\s*$/g, '') + '</div>' +
    (en ? '<p class="d-eyebrow d-msg-en-label">What it says in English</p><div class="d-msg-en">' + strip(sections[en]).replace(/ data-b="\d+"/g, '') + '</div>' : '') +
    '<p class="d-msg-foot"><a href="' + href(file) + '">Open the full file, with my notes →</a></p></div>';
}

// What is waiting, said as the things to do, in the order they come.
function todoOf(it) {
  if (it === 'ledger') return 'settle the lines research changed';
  if (it.body !== undefined) return 'approve the ' + it.kind.toLowerCase() + ' I made';
  const t = it.title.toLowerCase();
  if (/title/.test(t)) return 'choose the title';
  if (/draft|parts/.test(t) && /read/.test(t)) return 'read the draft';
  if (/remember/.test(t)) return 'add what you remember';
  if (/what did you see|what you saw/.test(t)) return 'add what you saw';
  if (/way|direction|stand on|angle/.test(t)) return 'pick the direction';
  if (/sent|message/.test(t)) return 'send the thank-you message';
  return 'answer: ' + it.title.replace(/\?$/, '');
}
const STEP_DONE = { 1: 'You dropped the recording in.', 2: 'I made the clean transcript and checked the facts.', 3: 'I wrote two or three ways the story could go, with titles.',
  4: 'You picked the direction and the title.', 5: 'I wrote the draft from your pick.', 6: 'You read the draft and said what to change.', 7: 'I folded in your changes and checked every quote.',
  8: 'You put the photos in its folder.', 9: 'I placed each photo beside its passage.', 10: 'You looked at the finished page and said publish.', 11: 'You sent the thank-you message.', 12: 'I filed their reply.' };
function needLine(b, items) {
  let [who, what] = STEP_NEED[b.step] || ['me', ''];
  if (items.length) { who = 'you'; const t = [...new Set(items.map(todoOf))]; what = (t.length > 1 ? t.slice(0, -1).join(', ') + ' and ' + t[t.length - 1] : t[0]) + '.'; what = what[0].toUpperCase() + what.slice(1); }
  return '<p class="d-need ' + who + '"><b>' + (who === 'you' ? 'Your step' : 'My step') + '</b> ' + esc(what) + '</p>';
}
const THEN = { 1: 'Take it in and turn it into text.', 2: 'Clean the transcript and check the facts.', 3: 'Write the map.', 4: 'Write the draft from your picks.',
  5: 'Fold in your read, then check every quote against the recording.', 6: 'Fold in your changes, then check every quote.', 7: 'Wait for the photos; the words are ready.',
  8: 'Place the photos.', 9: 'Show you the page with photos in.', 10: 'Publish when you say so.', 11: 'File their reply and correct the live page with your yes.', 12: 'Nothing. It is done.' };
const REQUESTS = () => path.join(MAG, 'Workflow/5-Social/REQUESTS.md');
function makeRequests() { try { return fs.readFileSync(REQUESTS(), 'utf8').split('\n').map(l => l.match(/^- \[ \] (\S+) (.+?) · (.+)$/)).filter(Boolean).map(m => ({ date: m[1], kind: m[2], story: m[3] })); } catch { return []; } }
// Made things (carousels, posts, reels, scripts) /arcreate saved for his yes: Workflow/5-Social/*.md with
// frontmatter "story: <story>" and "status: for-your-yes". Yes sets "status: approved"; Change sets "status: change"
// and keeps his note under "## Adrian's change".
function madeFor(story) {
  const dir = path.join(MAG, 'Workflow/5-Social');
  let files = []; try { files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'REQUESTS.md'); } catch {}
  return files.map(f => { const t = fs.readFileSync(path.join(dir, f), 'utf8'); const fm = (t.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
    const get = k => ((fm.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1] || '').trim().replace(/^"|"$/g, '');
    return { file: 'Workflow/5-Social/' + f, story: get('story'), status: get('status'), stage: get('stage'), raw: t, kind: get('kind') || f.split(' - ')[0], body: t.replace(/^---\n[\s\S]*?\n---\n?/, '') }; })
    .filter(m => m.story === story && m.status === 'for-your-yes');
}
function approveMade(rel, value) {
  const abs = path.resolve(MAG, rel);
  if (!abs.startsWith(path.resolve(MAG, 'Workflow/5-Social') + path.sep) || !abs.endsWith('.md')) throw new Error('not a made file');
  let t = fs.readFileSync(abs, 'utf8'); const today = new Date().toISOString().slice(0, 10);
  const yes = value === 'yes';
  // Stop 1 of a carousel: yes to the words only. /arcreate then places photos and templates for stop 2.
  if (value === 'words') { fs.writeFileSync(abs, t.replace(/^status:\s*.*$/m, 'status: words-yes\nwords-approved: ' + today)); return; }
  t = t.replace(/^status:\s*.*$/m, 'status: ' + (yes ? 'approved' : 'change') + '\n' + (yes ? 'approved' : 'change-asked') + ': ' + today);
  if (!yes) t = t.replace(/\s*$/, '\n\n## Adrian\'s change (' + today + ')\n\n' + String(value).trim() + '\n');
  fs.writeFileSync(abs, t);
}
// The words lineup (stop 1 of a carousel). The file holds "## Slides", one numbered line per slide:
// "1. [cover] words" or "3. [quote · Mathew, Pu'er Medicine] words", and "## Caption" below it.
// Reordering, editing and cutting on the page rewrite those two sections and nothing else.
const sectionOf = (body, name) => (body.split(new RegExp('^## ' + name + '\\s*$', 'm'))[1] || '').split(/^## /m)[0];
function lineupOf(body) {
  const slides = sectionOf(body, 'Slides').split('\n').map(l => l.match(/^\d+\.\s*\[([^\]]+)\]\s*(.*)$/)).filter(Boolean)
    .map(m => { const parts = m[1].split(/\s+·\s+/).map(s => s.trim()), field = k => (parts.find(p => new RegExp('^' + k + ':', 'i').test(p)) || '').replace(/^\w+:\s*/, '');
      return { role: parts[0], credit: parts.slice(1).filter(p => !/^(photo|template|crop):/i.test(p)).join(' · '), photo: field('photo'), template: field('template'), crop: field('crop'), text: m[2].trim() }; });
  return { slides, caption: sectionOf(body, 'Caption').trim() };
}
function saveLineup(rel, slides, caption) {
  const abs = path.resolve(MAG, rel);
  if (!abs.startsWith(path.resolve(MAG, 'Workflow/5-Social') + path.sep) || !abs.endsWith('.md')) throw new Error('not a made file');
  const one = s => String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/[\[\]]/g, '').trim();
  const list = slides.map((s, i) => (i + 1) + '. [' + one(s.role) + (one(s.credit) ? ' · ' + one(s.credit) : '') + (one(s.template) ? ' · template: ' + one(s.template) : '') + (one(s.photo) ? ' · photo: ' + one(s.photo) : '') + (one(s.crop) ? ' · crop: ' + one(s.crop) : '') + '] ' + one(s.text)).join('\n');
  let t = fs.readFileSync(abs, 'utf8');
  const put = (name, val) => { const re = new RegExp('^## ' + name + '[ \\t]*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))', 'm');
    t = re.test(t) ? t.replace(re, () => '## ' + name + '\n\n' + val + '\n\n') : t.replace(/\s*$/, '\n\n## ' + name + '\n\n' + val + '\n'); };
  put('Slides', list); put('Caption', String(caption ?? '').trim());
  fs.writeFileSync(abs, t);
}
function lineupHtml(m, pos, total, prev, next) {
  const { slides, caption } = lineupOf(m.body);
  const cards = slides.map(s => '<div class="ln-card" data-role="' + esc(s.role) + '" data-credit="' + esc(s.credit) + '" data-photo="' + esc(s.photo) + '">' +
    '<div class="ln-slide ln-' + esc(s.role.toLowerCase()) + '"><span class="ln-role">' + esc(s.role) + '</span>' +
    '<div class="ln-text" contenteditable="true" spellcheck="true">' + esc(s.text) + '</div>' +
    (s.credit ? '<span class="ln-credit">' + esc(s.credit) + '</span>' : '') + '<span class="ln-photo">' + (s.photo ? 'Photo: ' + esc(s.photo) : 'Photo matched after the words') + '</span>' + '</div>' +
    '<div class="ln-foot"><span class="ln-n"></span><button class="ln-cut" type="button">Cut</button></div></div>').join('');
  return '<div class="q d-q d-made d-lineup" data-file="' + esc(m.file) + '" data-hash="' + madeHash(m) + '"><p class="d-eyebrow d-move">Your move · ' + pos + ' of ' + total + '</p>' +
    '<h2 class="d-qt">Are these the words for the ' + esc(m.kind.toLowerCase()) + '?</h2>' +
    '<p class="d-ctx">One card is one slide, in the order people swipe. Cut from the article: it hooks, tells enough, and stops short so people read the full story. Drag a card to move it, click the words to change them. Photos from the story folder are matched to the slides next, then the layouts.</p>' +
    (() => { const ch = sectionOf(m.body, 'What changed').split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return ch.length ? '<div class="ln-changed"><p class="d-eyebrow">Re-cut from the finished article</p><ul>' + ch.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' : ''; })() +
    '<div class="ln-row">' + cards + '</div>' +
    '<p class="d-eyebrow ln-caplab">Caption</p><textarea class="ln-caption" rows="4">' + esc(caption) + '</textarea>' +
    '<p class="ln-saved" aria-live="polite"></p>' +
    '<div class="d-opts"><button class="opt big rec" data-approve-words="' + esc(m.file) + '">Yes, these words<small>then photos and layouts</small></button><button class="opt big ghost" data-show-other>Change this…</button></div>' +
    '<form class="other made" data-file="' + esc(m.file) + '" hidden><input name="v" placeholder="What should change"><button class="save" type="submit">Save</button></form>' +
    '<div class="d-nav"><a href="' + prev + '">Back</a><a class="skip" href="' + next + '">Skip for now</a></div></div>';
}
// Stop 2, the look: the approved words placed in real templates with real photos from the story's folder.
// Photos are matched by /arcreate; here Adrian moves slides, switches a slide's layout, swaps a photo and tunes its crop.
const IMG_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const CACHE = path.join(path.dirname(IG_FILE), '.mag-cache');
// iPhone photos arrive as HEIC, which browsers can't show. Convert once to a JPEG copy in the cache (the
// original is never touched) and redo it only if the original changes.
function photoPath(story, file) {
  const src = path.join(FILES, story, 'Photos', file);
  if (!/\.(heic|heif)$/i.test(file) || !fs.existsSync(src)) return src;
  const out = path.join(CACHE, 'photos', story, file + '.jpg');
  try { if (fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) return out; } catch {}
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '2400', src, '--out', out], { stdio: 'ignore' });
  return out;
}
// Export: each slide of an approved carousel saved as a 1080 x 1350 PNG beside its file, plus the caption,
// by the headless Chrome Playwright keeps on this Mac (newest copy). The folder is in the vault, so it syncs to the phone.
function lookSlides(m) {
  const { slides, caption } = lineupOf(m.body);
  return { caption, slides: slides.map(s => { const files = s.photo ? s.photo.split(/\s*,\s*/) : [], crops = s.crop ? s.crop.split(/\s*,\s*/) : [];
    return { role: s.role, credit: s.credit, text: s.text, template: s.template || IG.options({ role: s.role, photos: files.map(() => ({ src: 'x' })) })[0],
      photos: files.map((f, i) => { const c = (crops[i] || '50/50').split('/'); return { file: f === '-' ? '' : f, x: +c[0] || 50, y: +c[1] || 50 }; }) }; }) };
}
function madeFile(rel) {
  const abs = path.resolve(MAG, rel);
  if (!abs.startsWith(path.resolve(MAG, 'Workflow/5-Social') + path.sep) || !abs.endsWith('.md') || !fs.existsSync(abs)) throw new Error('not a made file');
  const raw = fs.readFileSync(abs, 'utf8'), fm = (raw.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const get = k => ((fm.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1] || '').trim();
  return { abs, raw, story: get('story'), stage: get('stage'), label: get('label') || get('story'), body: raw.replace(/^---\n[\s\S]*?\n---\n?/, '') };
}
const exportDir = abs => abs.replace(/\.md$/, '');
function chrome() {
  const root = path.join(HOME, 'Library/Caches/ms-playwright');
  const dirs = (() => { try { return fs.readdirSync(root).filter(d => d.startsWith('chromium_headless_shell-')).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]); } catch { return []; } })();
  for (const d of dirs) { const p = path.join(root, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  throw new Error('No headless Chrome found. Run: npx playwright install chromium-headless-shell');
}
async function exportSlides(rel, opts = {}) {
  // With AR Create the slides are rendered into the page's cache (export staging); AR Create copies them into the vault.
  const stagedName = 'x' + Date.now() + '-' + magUuid().slice(0, 8);
  const m = madeFile(rel), { slides, caption } = lookSlides(m), dir = opts.staging ? path.join(CACHE, 'export', stagedName) : exportDir(m.abs), bin = chrome();
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // All slides at once: each is its own short-lived headless Chrome, so the wait is one slide, not eight.
  await Promise.all(slides.map((_, i) => {
    const out = path.join(dir, 'slide-' + String(i + 1).padStart(2, '0') + '.png');
    return new Promise((ok, no) => execFile(bin, ['--headless', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1350', '--virtual-time-budget=6000',
      '--screenshot=' + out, 'http://127.0.0.1:' + PORT + '/ig-slide?file=' + encodeURIComponent(rel) + '&i=' + i], { timeout: 60000 }, e => e && !fs.existsSync(out) ? no(e) : ok()));
  }));
  fs.writeFileSync(path.join(dir, 'caption.txt'), caption + '\n');
  if (opts.staging) return { name: stagedName, caption, files: slides.map((_, i) => { const name = 'slide-' + String(i + 1).padStart(2, '0') + '.png'; return { name, sha256: magHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex') }; }) };
  return slides.length;
}
function readyHtml(story) {
  const dir = path.join(MAG, 'Workflow/5-Social'); let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.md')); } catch {}
  return files.map(f => { const x = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!/^status:\s*approved\s*$/m.test(x) || (x.match(/^story:\s*(.*)$/m) || [])[1]?.trim() !== story) return '';
    const folder = f.replace(/\.md$/, ''), abs = path.join(dir, folder); let pngs = [];
    try { pngs = fs.readdirSync(abs).filter(p => /^slide-\d+\.png$/.test(p)).sort(); } catch {}
    if (!pngs.length) return '';
    const cap = (() => { try { return fs.readFileSync(path.join(abs, 'caption.txt'), 'utf8').trim(); } catch { return ''; } })();
    const u = p => '/ig-out/' + encodeURIComponent(folder) + '/' + encodeURIComponent(p);
    return '<section class="ig-ready"><p class="d-eyebrow">Ready to post · ' + pngs.length + ' slides, saved in the vault</p><div class="ig-ready-row">' +
      pngs.map(p => '<a href="' + u(p) + '" download><img src="' + u(p) + '" alt="' + esc(p) + '"></a>').join('') + '</div>' +
      (cap ? '<p class="ig-cap">' + esc(cap) + '</p><button class="mini" data-copy-cap="' + esc(cap) + '">Copy caption</button>' : '') +
      '<p class="ig-where">Workflow/5-Social/' + esc(folder) + '</p></section>'; }).join('');
}
function storyPhotos(story) { try { return fs.readdirSync(path.join(FILES, story, 'Photos')).filter(f => IMG_EXT.test(f) && !f.startsWith('.')).sort(); } catch { return []; } }
function lookHtml(m, pos, total, prev, next) {
  const { slides, caption } = lineupOf(m.body);
  const fm = k => ((m.raw || '').match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1] || '';
  const data = { slides: slides.map(s => { const files = s.photo ? s.photo.split(/\s*,\s*/) : [], crops = s.crop ? s.crop.split(/\s*,\s*/) : [];
      return { role: s.role, credit: s.credit, text: s.text, template: s.template || IG.options({ role: s.role, photos: files.map(() => ({ src: 'x' })) })[0],
        photos: files.map((f, i) => { const c = (crops[i] || '50/50').split('/'); return { file: f === '-' ? '' : f, x: +c[0] || 50, y: +c[1] || 50 }; }) }; }),
    photos: storyPhotos(m.story), layouts: Object.fromEntries(Object.entries(IG.T).map(([k, v]) => [k, v.name])) };
  const label = fm('label').trim() || m.story;
  return '<div class="q d-q d-made d-look" data-file="' + esc(m.file) + '" data-hash="' + madeHash(m) + '" data-story="' + esc(m.story) + '" data-label="' + esc(label) + '"><p class="d-eyebrow d-move">Your move · ' + pos + ' of ' + total + '</p>' +
    '<h2 class="d-qt">Is this ' + esc(m.kind.toLowerCase()) + ' ready to post?</h2>' +
    '<p class="d-ctx">Your words, with the photos I matched from this story\'s folder. Drag a slide to move it. Tap a slide to change it: pick another layout, drag a photo from the strip onto it, or drag inside a photo to move the crop.</p>' +
    '<script type="application/json" class="lk-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>' +
    '<div class="lk-row"></div>' +
    '<div class="lk-edit"><div class="lk-big"></div><div class="lk-side"><p class="d-eyebrow">Layouts for this slide</p><div class="lk-alts"></div>' +
    '<p class="d-eyebrow">Photos from this story · drag one onto the slide</p><div class="lk-tray"></div></div></div>' +
    '<p class="d-eyebrow ln-caplab">Caption</p><textarea class="ln-caption" rows="4">' + esc(caption) + '</textarea>' +
    '<p class="ln-saved" aria-live="polite"></p>' +
    '<div class="d-opts"><button class="opt big rec" data-approve="' + esc(m.file) + '">Yes, it is good<small>saves the slides as images</small></button><button class="opt big ghost" data-show-other>Change this…</button></div>' +
    '<form class="other made" data-file="' + esc(m.file) + '" hidden><input name="v" placeholder="What should change"><button class="save" type="submit">Save</button></form>' +
    '<div class="d-nav"><a href="' + prev + '">Back</a><a class="skip" href="' + next + '">Skip for now</a></div></div>';
}
function madeHtml(m, pos, total, prev, next) {
  if (m.stage === 'words') return lineupHtml(m, pos, total, prev, next);
  if (m.stage === 'look') return lookHtml(m, pos, total, prev, next);
  return '<div class="q d-q d-made"><p class="d-eyebrow d-move">Your move · ' + pos + ' of ' + total + '</p><h2 class="d-qt">Is this ' + esc(m.kind.toLowerCase()) + ' good to go?</h2>' +
    '<div class="d-doc">' + render(m.body) + '</div>' +
    '<div class="d-opts"><button class="opt big rec" data-approve="' + esc(m.file) + '">Yes, it is good<small>my pick</small></button><button class="opt big ghost" data-show-other>Change this…</button></div>' +
    '<form class="other made" data-file="' + esc(m.file) + '" hidden><input name="v" placeholder="What should change"><button class="save" type="submit">Save</button></form>' +
    '<div class="d-nav"><a href="' + prev + '">Back</a><a class="skip" href="' + next + '">Skip for now</a></div></div>';
}
// Everything waiting on Adrian in one story: the research ledger counts once, made things count each.
function itemsOf(b) {
  const open = b.questions.filter(q => q.open);
  return (open.some(isLines) ? ['ledger'] : []).concat(madeFor(b.story), open.filter(q => !isLines(q)));
}
// What is waiting for me (Claude): answers given but not yet acted on, page requests, new recordings.
function waitingForMe(board) {
  const answers = board.reduce((n, b) => n + b.questions.filter(q => !q.open && !isLines(q)).length + (b.questions.some(isLines) && !b.questions.some(q => isLines(q) && q.open) ? 1 : 0), 0);
  const requests = makeRequests().length;
  let drops = 0; try { drops = dropped().length; } catch {}
  const parts = []; if (answers) parts.push(answers + ' answer' + (answers > 1 ? 's' : '')); if (requests) parts.push(requests + ' request' + (requests > 1 ? 's' : '')); if (drops) parts.push(drops + ' new recording' + (drops > 1 ? 's' : ''));
  return parts.join(', ').replace(/, ([^,]*)$/, ' and $1');
}
const exists = rel => { try { return fs.existsSync(path.join(MAG, rel)); } catch { return false; } };
const isLines = q => q.line && q.line.said;
const deskUrl = (story, q) => '/?s=' + encodeURIComponent(story) + (q != null ? '&q=' + q : '');

const draftName = b => String(b.newestDraft || '').replace(/ \(\d{4}-\d\d-\d\d\)$/, '');
function readsFor(b, raw) {
  const out = [];
  if (b.newestDraft) out.push(['The draft', 'Workflow/3-Develop/' + draftName(b)]);
  if (exists('Workflow/2-Guidance/MAP - ' + b.story + '.md')) out.push(['The map', 'Workflow/2-Guidance/MAP - ' + b.story + '.md']);
  if (exists('Workflow/3-Develop/RESEARCH - ' + b.story + '.md')) out.push(['What you can now share', 'Workflow/3-Develop/RESEARCH - ' + b.story + '.md']);
  if (exists('Workflow/6-Feedback/FEEDBACK - ' + b.title + '.md')) out.push(['The feedback message', 'Workflow/6-Feedback/FEEDBACK - ' + b.title + '.md']);
  if (raw) return out;
  return out.map(([l, f]) => '<a href="' + (/^Workflow\/3-Develop\/DEV - /.test(f) ? deskUrl(b.story) + '&read=' + encodeURIComponent(f) : href(f)) + '">' + esc(l) + '</a>').concat(b.published ? ['<a href="' + esc(b.published) + '">The live page</a>'] : []);
}

function pathHtml(step, story, open) {
  return '<div class="d-path">' + STEP_NAMES.map((n, i) => { const st = i + 1, c = (st < step ? 'past' : st === step ? 'now' : '') + (st === open ? ' open' : '');
    const inner = '<i></i><span>' + esc(n) + '</span>';
    return st <= step && story ? '<a class="d-stop ' + c + '" href="' + deskUrl(story) + '&step=' + st + '" title="Open the ' + esc(n.toLowerCase()) + ' step">' + inner + '</a>' : '<div class="d-stop ' + c + '">' + inner + '</div>'; }).join('') + '</div>';
}

function docHtml(r) { const abs = path.resolve(MAG, r.file); if (!abs.startsWith(path.resolve(MAG) + path.sep) || !fs.existsSync(abs)) return '';
    const rel = path.relative(MAG, abs), editable = /^Workflow\/3-Develop\/DEV - .*\.md$/.test(rel);
    if (rel.startsWith('Workflow/6-Feedback/FEEDBACK - ')) return messageView(fs.readFileSync(abs, 'utf8'), rel, r.file);
    const md = fs.readFileSync(abs, 'utf8'), clean = editable && md.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').filter(l => l.trim() === '---').length >= 2;
    const hasMine = /==[^=]+==/.test(md);
    return '<div class="d-doc' + (clean ? ' clean' : '') + '"><p class="d-doc-top"><span>' + (editable ? '' : esc(r.label.replace(/^Read /, ''))) + '</span>' + (editable ? '<a class="notes-toggle" href="' + href(r.file) + '?notes=1">Open with working notes</a>' : '<a href="' + href(r.file) + '">Open with working notes →</a>') + '</p>' + render(fs.readFileSync(abs, 'utf8'), editable ? rel : '') + '</div>'; }
function oneQuestion(q, file, b, pos, total, prev, next) {
  const opts = q.options.map(o => '<button class="opt big' + (o.recommended ? ' rec' : '') + (o.chosen ? ' chosen' : '') + '" data-file="' + esc(file) + '" data-index="' + q.index + '" data-value="' + esc(o.label) + '">' + esc(o.label) + (o.recommended ? '<small>my pick</small>' : '') + '</button>').join('');
  const other = (q.other || q.text) ? '<form class="other d-write" data-file="' + esc(file) + '" data-index="' + q.index + '"' + (q.text ? '' : ' hidden') + '><textarea name="v" rows="' + (q.text ? 5 : 3) + '" placeholder="' + (q.text ? 'Write it here, as much or as little as you like' : 'Say what instead') + '">' + esc(q.text ? q.answer : '') + '</textarea><button class="save" type="submit">Save</button></form>' : '';
  const otherBtn = q.other && !q.text ? '<button class="opt big ghost" data-show-other>' + esc(q.otherLabel || 'Something else') + '…</button>' : '';
  const reads = q.read ? (q.reads || [q.read]) : [];
  const docs = reads.map(docHtml).join('');
  const read = docs || reads.map(r => '<a class="read" href="' + href(r.file) + '">' + esc(r.label) + ' →</a>').join(' ');
  return '<div class="q d-q"><p class="d-eyebrow d-move">Your move · ' + pos + ' of ' + total + '</p><h2 class="d-qt">' + esc(q.title) + '</h2>' +
    (q.context.length ? '<p class="d-ctx">' + inline(q.context.join(' ')) + '</p>' : '') + read +
    '<div class="d-opts">' + opts + otherBtn + '</div>' + other +
    '<div class="d-nav"><a href="' + prev + '">Back</a><a class="skip" href="' + next + '">Skip for now</a></div></div>';
}

function frontPage(remote, sel, qi, stepParam, readParam) {
  const board = data();
  const isLive = b => !!b.published || b.step >= 11;
  const openOf = b => itemsOf(b);
  const waiting = board.filter(b => openOf(b).length);
  const cur = board.find(b => b.story === sel) || waiting[0] || board[0];
  const left = board.reduce((n, b) => n + openOf(b).length, 0);
  // Left: drop in, then every story (waiting first, closest to done first), then what is with me.
  const order = [...board].sort((a, b) => (openOf(b).length > 0) - (openOf(a).length > 0) || b.step - a.step);
  const rows = order.map(b => { const n = openOf(b).length;
    return '<a class="d-row' + (cur && b.story === cur.story ? ' on' : '') + '" href="' + deskUrl(b.story) + '"><span class="d-row-top"><span class="d-row-title">' + esc(b.title) + '</span><span class="d-row-n">' + (n ? n : '') + '</span></span>' +
      '<span class="d-row-step">' + (isLive(b) ? 'Live · ' : '') + esc(STEP_NAMES[b.step - 1] || '') + '</span></a>'; }).join('');
  const busy = jobs().filter(j => j.state === 'running' || j.state === 'queued');
  const withMe = busy.map(j => '<p class="d-me"><span>' + esc(j.story || j.file || 'A recording') + '</span>Turning it into text</p>').join('') +
    board.filter(b => !openOf(b).length && b.who !== 'you' && !isLive(b)).map(b => '<p class="d-me"><a href="' + deskUrl(b.story) + '">' + esc(b.title) + '</a>' + esc(DOING[b.step] || b.stepName) + '</p>').join('');
  const side = '<aside class="d-side"><p class="d-eyebrow">Teajia Magazine</p>' + (() => { const mine = waitingForMe(board);
      return '<div class="d-turns"><p class="d-turn"><b>Your turn</b><span>' + (left ? left + ' thing' + (left > 1 ? 's' : '') + ', in the stories below' : 'Nothing. Everything is with me.') + '</span></p>' +
        '<p class="d-turn me"><b>My turn</b><span>' + (mine ? mine + '. <button class="d-copy" data-run-mag title="Opens Terminal on this Mac and starts /mag">Run /mag</button>' : 'Nothing waiting for me.') + ' <button class="d-copy" data-show-arc title="Make content from a recording, for any brand">Arcreate</button></span></p>' +
      '<form class="d-arc d-write" hidden><textarea name="v" rows="3" placeholder="What should I make, and from which recording? For example: a carousel from the Lu Zhaokai conversation, or research the new Hong Kong recording."></textarea><button class="save" type="submit">Start</button></form></div>'; })() +
    UPLOAD.replace('class="upload card"', 'class="upload d-drop"').replace('Drop recordings or transcripts here', 'Add a recording').replace('or tap to choose · several at once is fine', 'Drop audio or a transcript here, from the Mac or the phone') +
    '<nav class="d-list">' + rows + '</nav>' + (withMe ? '<p class="d-eyebrow d-gap">With me</p>' + withMe : '') +
    '<p class="d-tools"><a href="/transcription">Recordings →</a></p></aside>';
  if (!cur) return '<div class="desk">' + side + '<main class="d-main"><p class="d-ctx">No stories yet. Add a recording to start one.</p></main></div>';

  // Right: the chosen story.
  const b = cur, open = openOf(b);
  const openStep = Math.min(Number(stepParam) || 0, b.step);
  const lines = b.questions.filter(isLines), linesOpen = lines.some(q => q.open);
  const asks = open.filter(q => !isLines(q));
  const items = itemsOf(b);
  const k = Math.min(Math.max(0, Number(qi) || 0), Math.max(0, items.length - 1));
  let move = '';
  if (items.length) {
    const it = items[k], prev = deskUrl(b.story, Math.max(0, k - 1)), next = deskUrl(b.story, (k + 1) % items.length);
    move = it === 'ledger'
      ? '<div class="d-q"><p class="d-eyebrow d-move">Your move · ' + (k + 1) + ' of ' + items.length + '</p><h2 class="d-qt">Settle the lines research changed</h2>' + ledgerHtml(lines, b.askFile) + '<div class="d-nav"><a href="' + prev + '">Back</a><a class="skip" href="' + next + '">Skip for now</a></div></div>'
      : it.body !== undefined ? madeHtml(it, k + 1, items.length, prev, next) : oneQuestion(it, b.askFile, b, k + 1, items.length, prev, next);
  } else if (false) move = '';
  if (openStep) move = stepPanel(b, openStep, remote);
  else if (!items.length && b.step === 8) move = '<div class="d-q photos d-photos"><h2 class="d-qt">Add the photos</h2><p class="d-ctx">' + (b.photos ? b.photos + ' in the folder so far. ' : '') + 'Any order; I place each one beside the passage it shows.</p>' +
      '<div class="d-opts">' + (remote ? '' : '<a class="opt big" href="' + esc(new URL(b.photosLink).pathname) + '" data-open>Open the photos folder</a>') + '<button class="opt big ghost" data-show-album>Paste a shared album link…</button></div>' +
      '<form class="album" data-story="' + esc(b.story) + '" hidden><input name="link" placeholder="https://www.icloud.com/sharedalbum/#…"><button class="save" type="submit">Add</button></form></div>';
  else if (!items.length) move = '<div class="d-q"><h2 class="d-qt">Nothing needs you here.</h2><p class="d-ctx"><button class="d-copy" data-run-mag title="Opens Terminal on this Mac and starts /mag">Run /mag</button> and I will do my step now.</p></div>';
  if (readParam && !openStep) { const abs = path.resolve(MAG, readParam);
    const showsIt = items.length && items[k] !== 'ledger' && items[k].body === undefined && (items[k].reads || (items[k].read ? [items[k].read] : [])).some(r => path.resolve(MAG, r.file) === abs);
    if (!showsIt && abs.startsWith(path.resolve(MAG) + path.sep) && abs.endsWith('.md') && fs.existsSync(abs)) { const label = (readsFor(b, true).find(([l, f]) => path.resolve(MAG, f) === abs) || [path.basename(abs, '.md')])[0];
      move = '<div class="q d-q"><p class="d-eyebrow d-move">Reading</p><h2 class="d-qt">' + esc(label) + '</h2>' + docHtml({ file: path.relative(MAG, abs), label }) + (items.length ? '<div class="d-nav"><a href="' + deskUrl(b.story, k) + '">Back to your move</a></div>' : '') + '</div>'; } }
  const also = items.map((it, j) => j === k ? '' : '<a href="' + deskUrl(b.story, j) + '">' + esc(it === 'ledger' ? 'Settle the lines research changed' : it.body !== undefined ? 'Is this ' + it.kind.toLowerCase() + ' good to go?' : it.title) + '</a>').join('');
  const decided = b.questions.filter(q => !q.open && !isLines(q)).map(q => '<p>' + esc(q.title.replace(/\?$/, '')) + ': <span>' + esc(q.value) + '</span> <button class="link" data-reopen-desk="' + q.index + '">Change</button></p>' +
      '<div class="reopen" hidden>' + questionHtml({ ...q, open: true }, b.askFile).replace('class="q"', 'class="q inner"') + '</div>').join('') +
    (lines.length && !linesOpen ? '<p>Lines research changed: <span>all settled</span></p>' : '');
  const asked = makeRequests().filter(r => r.story === b.story);
  const makes = ['Carousel', 'Post', 'Reel', 'Video script'].map(kd => '<button class="opt small' + (asked.some(r => r.kind === kd) ? ' chosen' : '') + '" data-make="' + esc(kd) + '" data-story="' + esc(b.story) + '">' + kd + '</button>').join('');
  const askedLine = asked.length ? '<p class="d-asked">Asked for ' + asked.map(r => 'a ' + r.kind.toLowerCase()).join(', ') + ' from this story. It will appear here for your yes.</p>' : '';
  // Carousels past stop 1: the words are his, photos and layouts are with me.
  const placing = (() => { try { return fs.readdirSync(path.join(MAG, 'Workflow/5-Social')).filter(f => f.endsWith('.md')).filter(f => { const x = fs.readFileSync(path.join(MAG, 'Workflow/5-Social', f), 'utf8'); return /^status:\s*words-yes\s*$/m.test(x) && (x.match(/^story:\s*(.*)$/m) || [])[1]?.trim() === b.story; }).length; } catch { return 0; } })();
  const placingLine = placing ? '<p class="d-asked">Carousel words approved. Next I place the photos from this story\'s folder and pick the layouts, then it comes back here for your eye.</p>' : '';
  const photos = (b.published ? 'On the live page' : b.photos ? b.photos + ' photo' + (b.photos === 1 ? '' : 's') : 'None yet. They can come any time; the words never wait for them.') + (b.album ? ' · shared album linked' : '');
  const qTitle = openStep ? 'Step ' + openStep + ' panel' : items.length ? (items[k] === 'ledger' ? 'Settle the lines research changed' : items[k].body !== undefined ? 'Made: ' + items[k].kind : items[k].title) : 'Nothing needs you';
  const blind = '<div class="d-blind" data-story="' + esc(b.story) + '" data-step="' + b.step + '" data-q="' + esc(qTitle) + '"><span>Could you answer this coming in blind?</span><button class="opt small" data-blind="yes">Yes</button><button class="opt small" data-blind="no">I need more</button>' +
    '<form class="d-blind-more" hidden><textarea name="v" rows="2" placeholder="What was missing? A word is enough."></textarea><button class="save" type="submit">Send</button></form></div>';
  const main = '<main class="d-main"><div class="d-head"><div><h2 class="d-title">' + esc(b.title) + '</h2>' +
    '<p class="d-reads"><span>Read</span>' + (readsFor(b).join('') || '<em>nothing yet</em>') + '</p></div>' +
    '<div class="d-make"><p class="d-eyebrow">Make from this</p><div class="d-make-btns">' + makes + '</div></div></div>' + askedLine + placingLine + readyHtml(b.story) + '<p class="d-eyebrow d-stepline">Step ' + b.step + ' of 12 · ' + esc(STEP_NAMES[b.step - 1] || '') + '</p>' + pathHtml(b.step, b.story, openStep) + needLine(b, items) + move +
    storySoFar(b) + blind + '</main>';
  const reading = /<div class="editable" data-file="Workflow\/3-Develop\/DEV - /.test(main);
  return '<div class="desk' + (sel ? ' has-sel' : '') + (reading ? ' reading' : '') + '">' + side + '<a class="d-back" href="/">← All stories</a>' + main + '</div>';
}

function oldFrontPage(remote) {
  const board = data();
  const groups = { you: [], me: [], live: [] };
  for (const b of board) { const c = card(b, remote); groups[c.kind].push(c.html); }
  const section = (k, title, empty) => `<section data-group="${k}"><h3>${title} <span class="count">${groups[k].length}</span></h3>${groups[k].join('') || `<p class="empty">${empty}</p>`}</section>`;
  return `<header><div><p class="eyebrow">Teajia Magazine</p><h1>Stories</h1></div>` +
    `<div class="tools"><div class="seg" role="group"><button data-sort="done">Closest to done</button><button data-sort="start">Closest to start</button></div>` +
    `<a class="mini" href="/transcription">Transcription →</a></div></header>` +
    section('you', 'Waiting on you', 'Nothing. Everything is on my side.') +
    section('me', 'I\'m working on it', 'Nothing in progress.') +
    section('live', 'Live', 'Nothing live yet.');
}


// mag-transcription-page-v1
// mag-recordings-library-v1
function transcriptionHome(remote) { return renderRecordings(jobs(),remote); }

// ── Look: one typeface everywhere, Claude-style ─────────────────────────
const CSS = LOCAL_TRANSCRIPT_CSS + `:root{--bg:#faf9f5;--panel:#fff;--text:#1f1e1d;--body:#3d3d3a;--dim:#73726c;--line:#e8e6dc;--hover:#f0eee6;--accent:#c96442;--accent-soft:#f6e6de;--mark:#f5e3c8;--note:#f0eee6;--ok:#4f7a4f}
@media (prefers-color-scheme:dark){:root{--bg:#262624;--panel:#30302e;--text:#f5f4ef;--body:#dcdad2;--dim:#a3a19a;--line:#3e3e3a;--hover:#393936;--accent:#d97757;--accent-soft:#4a3329;--mark:#4a3b26;--note:#353532;--ok:#8fbf8f}}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--body);font:15px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.col{max-width:760px;margin:0 auto;padding:28px 20px 96px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
h1,h2,h3{color:var(--text);font-weight:600;letter-spacing:-.01em;line-height:1.25;margin:0}
h1{font-size:26px}h2{font-size:17px}h3{font-size:13px;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin:34px 0 12px}
p{margin:0 0 1em}ul{padding-left:1.2em}li{margin:4px 0}hr{border:0;border-top:1px solid var(--line);margin:32px 0}
button,input{font:inherit}
.eyebrow{font-size:12px;color:var(--dim);margin:0 0 2px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:6px}
.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.seg{display:inline-flex;background:var(--note);border-radius:8px;padding:2px}
.seg button{border:0;background:none;color:var(--dim);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:13px}
.seg button.on{background:var(--panel);color:var(--text);box-shadow:0 0 0 1px var(--line)}
.count{font-weight:500;color:var(--dim);margin-left:4px}
.empty{color:var(--dim);font-size:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:0 0 12px}
.card.you{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.meta{font-size:13px;color:var(--dim);margin:2px 0 0}
.bar{display:flex;gap:3px;margin-top:6px;flex:none}.bar i{width:9px;height:6px;border-radius:2px;background:var(--line)}.bar i.on{background:var(--accent)}
.card.live .bar i.on{background:var(--ok)}
.doing{margin:12px 0 0;color:var(--body)}
.q{border-top:1px solid var(--line);margin-top:14px;padding-top:14px}.q.inner{border:0;margin:8px 0 0;padding:0}
.qt{color:var(--text);font-weight:600}
.ctx{color:var(--body);margin:4px 0 8px;font-size:14px}
.read{display:inline-block;font-size:14px;font-weight:500;margin:0 0 10px}
.opts{display:flex;flex-wrap:wrap;gap:8px}
.opt{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:14px;text-align:left}
.opt:hover{background:var(--hover)}
.opt.rec{border-color:var(--accent)}
.opt small{display:block;font-size:11px;color:var(--accent);margin-top:1px}
.opt.chosen{background:var(--accent);border-color:var(--accent);color:#fff}.opt.chosen small{color:#fff}
.opt.ghost{color:var(--dim)}
.other,.album{display:flex;gap:8px;margin-top:8px}
.other input,.album input{flex:1;min-width:0;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:7px 10px}
.save{border:0;background:var(--accent);color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-weight:500}
.q.done{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;font-size:14px}
.q.done .qt{font-weight:500;color:var(--dim)}.q.done .val{color:var(--text)}.check{color:var(--ok);font-weight:700}
.q.done .reopen{flex-basis:100%}
.link{border:0;background:none;color:var(--accent);cursor:pointer;padding:0;font-size:13px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--dim)}
.photos{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1}.photos form{flex-basis:100%}
.mini{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:7px;padding:4px 10px;font-size:13px;cursor:pointer}
.mini:hover{background:var(--hover);text-decoration:none}
.how{margin:10px 0 0;font-size:14px;color:var(--body)}.how summary{color:var(--dim);font-size:13px}.how p{margin:6px 0}.dropped{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0;padding:6px 0}.dropped span{color:var(--dim);font-size:13px}
.upload{margin:14px 0 6px}.zone{display:flex;flex-direction:column;align-items:center;gap:4px;border:1.5px dashed var(--line);border-radius:10px;padding:26px 16px;cursor:pointer;text-align:center}.zone:hover,.zone.over{border-color:var(--accent);background:var(--accent-soft)}.zone input{display:none}.zone .big{color:var(--text);font-weight:600}.zone .small{color:var(--dim);font-size:13px}.queue{margin-top:6px}.up{display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:13px;padding:8px 0;border-top:1px solid var(--line)}.up em{font-style:normal;color:var(--dim)}.up .progress{grid-column:1/-1;margin-top:4px}.up.bad em{color:var(--accent)}.upload input[type=file]{margin:6px 0 2px;font-size:14px;color:var(--body);max-width:100%}.progress{height:4px;background:var(--line);border-radius:3px;margin-top:10px;overflow:hidden}.progress i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:14px}
/* A file read as a page: the same typeface, a calmer measure. */
.doc{font-size:16px;line-height:1.75}
.doc h1{font:500 34px/1.15 "Newsreader",Georgia,serif;color:var(--text);margin:8px 0 22px;letter-spacing:0}.doc h2{font:500 22px/1.3 "Newsreader",Georgia,serif;color:var(--text);margin:34px 0 10px;letter-spacing:0}.doc h3{font:500 18px/1.35 "Newsreader",Georgia,serif;margin:26px 0 8px;text-transform:none;letter-spacing:0;color:var(--text)}
.doc blockquote{margin:24px 0;padding-left:16px;border-left:3px solid var(--accent);font-size:19px;line-height:1.45;color:var(--text);font-style:italic}
.top{font-size:13px;margin-bottom:22px}.top a{color:var(--dim)}
.note{font-size:12.5px;line-height:1.5;color:var(--dim);background:var(--note);padding:2px 6px;border-radius:5px}
.note.block{display:block;padding:9px 12px;border-radius:8px}
mark{background:var(--mark);color:var(--text);padding:0 3px;border-radius:3px}
.term{border-bottom:1px dotted var(--accent);color:var(--text)}
.speaker{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:22px 0 6px}
code{font:13px ui-monospace,Menlo,monospace;background:var(--note);padding:1px 5px;border-radius:5px}
pre{white-space:pre-wrap;font-size:13px;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.decide{margin-top:40px}.decide h3{margin-top:0}
.editable [data-b]{cursor:text;border-radius:6px;transition:background .15s}.editable [data-b]:hover{background:var(--note)}.editing{outline:none;cursor:text}.editable [data-b].editing:hover{background:transparent}.edit-bar{position:absolute;z-index:50;display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:var(--bg);padding:4px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.35)}.edit-bar .opt{padding:5px 10px;font-size:13px}.edit-hint{font-size:12px;color:var(--dim)}.just-saved{animation:saved 2s}.rework{background:rgba(255,196,0,.28);border-bottom:2px wavy rgba(230,160,0,.9)}@keyframes saved{from{background:var(--note)}to{background:transparent}}@media (max-width:560px){.head{flex-direction:column;gap:6px}.bar i{width:7px}}
.ledger{--lg-bronze:#9a6f3f;--lg-serif:"Newsreader",Georgia,"Times New Roman",serif;--lg-sans:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif;margin:14px 0 6px;font-family:var(--lg-sans)}
@media (prefers-color-scheme:dark){.ledger{--lg-bronze:#c9a06c}}
.lg-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;padding-bottom:12px}
.lg-eyebrow{margin:0 0 4px;font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--dim)}
.ledger h3{margin:0;text-transform:none;letter-spacing:normal;font-family:var(--lg-serif);font-weight:500;font-size:24px;line-height:1.2;color:var(--text);text-wrap:balance}
.lg-all{background:none;border:0;padding:10px 0;font:500 14px var(--lg-sans);color:var(--lg-bronze);cursor:pointer}.lg-all:hover{color:var(--text)}
.ledger .q.lg-row{display:grid;grid-template-columns:76px minmax(0,1fr);gap:18px;align-items:baseline;border:0;border-top:1px solid var(--line);border-radius:0;padding:14px 0;margin:0;background:none}
.lg-who{font-size:13px;line-height:1.4;color:var(--body)}.lg-who span{display:block;color:var(--dim);font-variant-numeric:tabular-nums}
.lg-text{margin:0;font-family:var(--lg-serif);font-size:19px;line-height:1.5;color:var(--text)}
.lg-text del{color:var(--dim);text-decoration:line-through;text-decoration-color:var(--dim)}
.lg-text ins{text-decoration:none;color:var(--lg-bronze)}.lg-text ins.tell{font-style:italic}
.lg-tag{font:500 11px var(--lg-sans);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-left:8px}
.lg-why{margin:6px 0 0;font-size:13.5px;line-height:1.5;color:var(--dim)}
.lg-opts{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:6px}
.ledger .opt.lg-opt{background:none;border:0;border-radius:0;padding:8px 0;min-height:36px;font:400 14px var(--lg-sans);color:var(--dim);cursor:pointer}
.ledger .opt.lg-opt:hover{color:var(--text)}
.ledger .opt.lg-opt.pre{color:var(--body);text-decoration:underline dotted;text-underline-offset:6px}
.ledger .opt.lg-opt.on{color:var(--lg-bronze);text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1px}
.ledger form.other{margin-top:6px}
@media (max-width:560px){.ledger .q.lg-row{grid-template-columns:1fr;gap:4px}.lg-who span{display:inline;margin-left:8px}}
/* The whole page in the ledger's look (Adrian, 2026-10-04): warm dark ground, aged bronze, Newsreader headings, choices as words. */
:root{--bg:#17140f;--panel:#1f1a15;--text:#ece3d4;--body:#d2c7b5;--dim:#9b8e7b;--line:#362e25;--hover:#28221b;--accent:#bf955f;--accent-soft:rgba(191,149,95,.14);--mark:#3d3020;--note:#28221b;--ok:#93ad88;color-scheme:dark}
body{font-family:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif}
.col{max-width:1040px;padding-left:24px;padding-right:24px}
.card{border-radius:4px;padding:26px 30px}
.card.you{border-color:var(--line)}
.card h2,.head h2{font-family:"Newsreader",Georgia,serif;font-weight:500;font-size:28px;letter-spacing:0;color:var(--text)}
.qt{font-family:"Newsreader",Georgia,serif;font-weight:500;font-size:21px;color:var(--text)}
.q.done .qt{font-size:17px;color:var(--dim)}
a,.read{color:var(--accent)}
.opts{gap:4px 22px}
.opt{background:none;border:0;border-radius:0;padding:8px 0;min-height:36px;font-size:15px;color:var(--dim);text-align:left}
.opt:hover{background:none;color:var(--text)}
.opt.rec{border:0;color:var(--body);text-decoration:underline dotted;text-underline-offset:6px}
.opt small{display:inline;margin-left:8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);text-decoration:none}
.opt.chosen{background:none;border:0;color:var(--accent);text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1px}
.opt.chosen small{color:var(--dim)}
.opt.ghost{color:var(--dim)}
.other input,.album input{border:0;border-bottom:1px solid var(--line);border-radius:0;background:none;padding:8px 2px;font-size:15px}
.other input:focus,.album input:focus{outline:none;border-bottom-color:var(--accent)}
.save{background:none;color:var(--accent);border-radius:0;padding:8px 0 8px 12px}
.mini{background:none;border:0;border-radius:0;padding:6px 0;margin-right:16px;color:var(--dim)}.mini:hover{color:var(--text)}
.ledger{--lg-bronze:var(--accent)}
/* The desk, layout E (2026-10-04) */
.col:has(.desk){max-width:none;padding:0}
.desk{display:grid;grid-template-columns:340px minmax(0,1fr);min-height:100vh}
.d-eyebrow{margin:0;font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--dim)}
.d-side{background:var(--panel);border-right:1px solid var(--line);padding:32px 0 48px;min-width:0}
.d-side>.d-eyebrow,.d-count{padding:0 28px}
.d-count{margin:6px 0 0;font:500 28px/1.2 "Newsreader",Georgia,serif;color:var(--text)}
.d-drop{margin:18px 20px;background:var(--p2);border:1px solid var(--line);border-radius:3px;padding:12px 16px}
.d-drop .zone{border:0;border-radius:0;padding:6px 0;align-items:flex-start;text-align:left;gap:4px}
.d-drop .zone:hover,.d-drop .zone.over{background:none}
.d-drop .zone .big{font:500 19px "Newsreader",Georgia,serif;color:var(--text)}
.d-drop .zone .small{font-size:13px;color:var(--dim)}
.d-drop .other{margin-top:6px}.d-drop .other input{font-size:13.5px}
.d-list{display:flex;flex-direction:column}
.d-row{display:flex;flex-direction:column;gap:3px;padding:13px 28px;text-decoration:none}
.d-row:hover{background:var(--p2)}.d-row.on{background:var(--p4)}
.d-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.d-row-title{font:500 19px/1.3 "Newsreader",Georgia,serif;color:var(--text)}
.d-row-n{font-size:13px;color:var(--accent)}
.d-live{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.d-dots{display:flex;gap:3px;margin-top:6px}.d-dots i{width:14px;height:3px;background:var(--line)}.d-dots i.past{background:var(--accent)}.d-dots i.now{background:var(--warm)}
.d-gap{padding:26px 28px 8px!important}
.d-me{margin:0;padding:6px 28px;font-size:13.5px;line-height:1.45;color:var(--dim)}.d-me span,.d-me a{display:block;color:var(--body);text-decoration:none}
.d-tools{padding:22px 28px 0;margin:0;font-size:14px}.d-tools a{text-decoration:none}
.d-back{display:none}
.d-main{padding:40px 64px 96px;display:flex;flex-direction:column;gap:28px;min-width:0}
.d-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap}
.d-title{margin:0;font:500 40px/1.1 "Newsreader",Georgia,serif;color:var(--text)}
.d-reads{display:flex;flex-wrap:wrap;gap:6px 20px;margin:12px 0 0;font-size:14.5px}.d-reads span{color:var(--dim)}.d-reads a{font-weight:500;text-decoration:none}.d-reads em{color:var(--dim);font-style:normal}
.d-make{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.d-make-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.opt.small{min-height:38px;padding:8px 16px;font-size:13.5px}
.d-asked{margin:-12px 0 0;font-size:14.5px;color:var(--warm)}
.d-stepline{display:none}
.d-path{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}
.d-stop{display:flex;flex-direction:column;gap:8px;min-width:0}.d-stop i{display:block;height:3px;background:var(--line)}
.d-stop span{font-size:12px;line-height:1.3;color:var(--dim)}
.d-stop.past i{background:var(--accent)}.d-stop.past span{color:var(--body)}
.d-stop.now i{background:var(--warm)}.d-stop.now span{color:var(--warm);font-weight:500}
.d-q{border-top:1px solid var(--line);padding-top:26px;max-width:780px;display:flex;flex-direction:column;gap:14px}
.d-move{color:var(--accent)}
.d-qt{margin:0;font:500 34px/1.2 "Newsreader",Georgia,serif;color:var(--text)}
.d-ctx{margin:0;font-size:16px;line-height:1.6;color:var(--dim)}
.d-q .read{margin:0}
.d-opts{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-top:4px}
.opt.big{min-width:min(520px,100%);justify-content:space-between;font-size:16px;min-height:52px;padding:14px 22px}
.d-q form.other{max-width:620px}
.d-nav{display:flex;justify-content:space-between;max-width:520px;font-size:15px}.d-nav a{color:var(--dim);text-decoration:none;padding:10px 0}.d-nav a.skip{color:var(--accent)}
.d-q .ledger{margin-top:0}
.d-foot{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:32px;border-top:1px solid var(--line);padding-top:20px}
.d-foot>div{display:flex;flex-direction:column;gap:8px;min-width:0}
.d-foot{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))!important}
.d-foot .d-photos{align-items:flex-start}
.d-q .d-copy{font-size:14px}
/* Calm desk (2026-10-05) */
.desk .d-eyebrow{text-transform:none;letter-spacing:0;font-size:12.5px}
.d-side .upload .other{display:none}
.d-side .upload:has(.queue:not(:empty)) .other{display:flex}
.d-drop{background:transparent;border-color:var(--line);padding:10px 14px;margin:16px 20px 10px}
.d-drop .zone .big{font:500 15px "Instrument Sans",Helvetica,sans-serif;color:var(--body)}
.d-drop .zone .small{font-size:12px}
.d-turns{gap:6px;padding:8px 28px 2px}
.d-turn{flex-direction:row;flex-wrap:wrap;gap:0 8px;font-size:13px;align-items:baseline}
.d-turns .d-turn b{font:500 15px "Instrument Sans",Helvetica,sans-serif!important;color:var(--text)}.d-turns .d-turn.me b{color:var(--body)}
.d-turn.me b{color:var(--body)}
.d-row{padding:11px 28px}
.d-row-title{font-size:17px}
.d-row-step{font-size:12px;color:var(--dim)}
.d-row.on .d-row-step{color:var(--warm)}
.d-row-n{font-size:12px}
.d-me{font-size:12.5px}
.d-make .d-eyebrow{display:none}
.d-make-btns .opt.small{min-height:32px;padding:5px 12px;font-size:12.5px;background:transparent}
.d-reads{font-size:14px;gap:4px 16px}.d-reads span{display:none}
.d-path{opacity:.85}
.d-need{font-size:13px}
.d-q{gap:12px}
.d-move{color:var(--dim)!important}
.d-qt{font-size:30px}
.d-ctx{max-width:68ch;font-size:15.5px}
.opt small{text-transform:none!important;letter-spacing:0!important;font-size:11.5px!important}
.d-nav{font-size:14px}
.d-sofar{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;padding:18px 0 0}
.d-sofar dd{color:var(--body)}
.d-sofar dt a{background:transparent;min-height:24px;padding:2px 8px;font-size:11.5px}
.d-blind{font-size:12.5px;border-top:0;padding-top:4px}
.d-blind .opt.small{min-height:28px;padding:3px 10px;font-size:12px;background:transparent}
/* Calm reading page */
.readcalm .editable>:not(hr ~ *),.readcalm .editable>hr,.readcalm .editable>hr ~ hr ~ *{display:none}
.readcalm .note:not(.you),.readcalm p.note.block:not(.you){display:none}
.doc .editable>*{max-width:68ch}
.doc mark{background:none;color:inherit;padding:0;border-radius:0;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--accent) 60%,transparent);text-decoration-thickness:1px;text-underline-offset:5px}
.doc blockquote strong{font-weight:inherit}
.doc strong{font-weight:500}
.doc em{font-style:normal}
.editable [data-b]:hover,.editable [data-b].live:hover{background:transparent!important}
.doc-status{opacity:0;transition:opacity .3s}.doc-status.show{opacity:1}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.notes-toggle{font-size:12.5px;color:var(--dim);text-decoration:none}.notes-toggle:hover{color:var(--text)}
/* Working notes on the side, like Google Docs comments (2026-10-05) */
.has-rail .editable{position:relative}
.has-rail .editable [data-b] .note,.has-rail .editable>.note,.has-rail .editable>p.note.block{display:none!important}
.rail{position:absolute;top:0;left:calc(var(--measure) + 44px);width:min(260px,calc(100% - var(--measure) - 52px))}
.rail-off .rail{display:none}
.rail .card{position:absolute;left:0;right:0;padding:9px 12px;border-radius:6px;background:color-mix(in srgb,var(--text) 5%,transparent);font:400 13px/1.5 "Instrument Sans","Helvetica Neue",Helvetica,sans-serif;color:var(--dim);cursor:pointer;transition:background .15s,color .15s,left .15s}
.rail .card b{display:block;font-weight:500;font-size:11.5px;color:var(--dim);margin-bottom:2px}
.rail .card.you{color:var(--warm)}
.rail .card.on{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--text);left:-8px}
body .editable .noted,body .editable [data-b].live.noted,body .editable [data-b].live.noted:focus,body .editable [data-b].live.noted:hover{background:color-mix(in srgb,var(--warm) 16%,transparent)!important;box-shadow:0 0 0 6px color-mix(in srgb,var(--warm) 16%,transparent)!important;border-radius:2px!important}
/* Pull quotes in italic (2026-10-05) */
.doc blockquote,.d-doc blockquote,.doc blockquote *,.d-doc blockquote *{font-style:italic!important}
.rail .card.flag{background:color-mix(in srgb,var(--warm) 10%,transparent);color:var(--body)}.rail .card.flag b{color:var(--warm)}
.rail .group .row{display:block}.rail .group .row+.row{margin-top:8px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--text) 10%,transparent)}
/* Every note on a passage shows; no folding (2026-10-05) */
.rail .more-link{display:none!important}
.rail .more-link{display:block;margin-top:6px;padding:0;border:0;background:none;font:400 12px "Instrument Sans",Helvetica,sans-serif;color:var(--dim);cursor:pointer}.rail .more-link:hover{color:var(--text)}
.rail .row b{display:block;font-weight:500;font-size:11.5px;color:var(--dim);margin-bottom:2px}.rail .row.flag b,.rail .row.edit b{color:var(--warm)}.rail .row.on{color:var(--text)}
.rail .group.open .row:not(.on){opacity:.75}.rail .group.open:not(:has(.row:not(.on))) .row{opacity:1}
/* Phone: cards under their passage */
.editable>.rail.rail-inline{position:static;left:auto;width:auto;max-width:var(--measure);margin:-4px 0 16px}
.rail.rail-inline .card{position:relative;top:auto!important;left:0!important}
.rail .row .swap{display:block}
/* Story lines about 88 characters (Adrian, 2026-10-05) */
:root{--measure:35rem}.col.doc{max-width:1220px}
.run-log{position:fixed;right:16px;bottom:16px;z-index:70;width:min(460px,calc(100vw - 32px));max-height:50vh;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.35)}.run-log-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;font:500 13px "Instrument Sans",Helvetica,sans-serif;color:var(--text)}.run-log-head button{border:0;background:none;color:var(--dim);cursor:pointer;font:inherit}.run-log pre{margin:0;padding:0 14px 14px;overflow:auto;white-space:pre-wrap;font:400 13px/1.55 "Instrument Sans",Helvetica,sans-serif;color:var(--body)}
::highlight(mag-notes){background-color:var(--hl)}
::highlight(mag-active){background-color:var(--hl-on);color:var(--text)}
::highlight(mag-edited){background-color:rgba(230,200,150,.14);text-decoration:underline;text-decoration-color:rgba(230,200,150,.7);text-underline-offset:3px}
.rail .row .diff{display:block;white-space:pre-line;color:var(--body)}
.rail .row .undo{display:block;margin-top:6px;padding:0;background:none;border:0;font:500 12.5px "Instrument Sans",Helvetica,sans-serif;color:var(--warm);cursor:pointer;text-decoration:underline;text-underline-offset:3px}.rail .row .undo:disabled{opacity:.6;cursor:default}
.doc-status{font-size:14px!important;padding:8px 14px!important;border-color:var(--accent)!important;color:var(--text)!important}.doc-status.done{color:var(--warm)!important}
@media (max-width:700px){.doc-status{left:50%;right:auto!important;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom))!important}}
.rail .card:hover{background:color-mix(in srgb,var(--text) 9%,transparent)}
.rail .card.on{box-shadow:0 6px 18px rgba(0,0,0,.45);background:color-mix(in srgb,var(--warm) 22%,var(--bg))!important;color:var(--text)!important}.rail .card.on b{color:var(--warm)}
.readcalm .editable>.rail,.readall .editable>.rail{display:block!important}
body.rail-off .editable>.rail{display:none!important}
.d-doc.clean .editable>.rail{display:block!important}
.rail .card.edit{color:var(--body)}.rail .card.edit b{color:var(--warm)}
.rail .card span{display:block}
.doc h2,.d-doc h2{margin:1.9em 0 .55em!important}.doc h3,.d-doc h3{margin:1.6em 0 .45em!important}
.d-doc-top .notes-toggle{font-size:12.5px;letter-spacing:0;color:var(--dim)}
@media (min-width:861px){.desk.reading{grid-template-columns:minmax(0,1fr)}.desk.reading>.d-side{display:none}.desk.reading .d-q{max-width:1220px}.desk.reading>.d-back{display:block;padding:24px 64px 0;font-size:13px;color:var(--dim);text-decoration:none}.desk.reading>.d-back:hover{color:var(--text)}}
/* Easier to read and edit (2026-10-05) */
.d-doc p,.d-doc li{font-family:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif!important;font-size:16px!important;line-height:1.7!important;color:var(--body)!important;margin:0 0 .85em!important;max-width:var(--measure)}
.d-doc p.said{color:var(--text)!important}
.d-doc p.mine,.d-doc p mark,.d-doc.clean p mark{color:color-mix(in srgb,var(--warm) 45%,var(--dim))!important;text-decoration:none!important;background:none!important}
.d-doc blockquote{font-family:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif!important;border-left:0!important;padding:0!important;margin:1.6em 0!important;font-size:21px!important;line-height:1.45!important;color:var(--text)!important;font-style:normal!important;max-width:var(--measure)}
.d-doc .term{border-bottom:0!important;color:inherit!important}
.d-doc blockquote strong{font-weight:inherit!important;color:inherit!important}
.doc .editable>*{max-width:var(--measure)!important;overflow-wrap:break-word}
.doc p,.doc li{margin:0 0 .85em!important}
.doc p.said{color:var(--text)!important}
.doc p.mine,.doc p mark{color:color-mix(in srgb,var(--warm) 45%,var(--dim))!important}
.doc p{color:var(--body)}
.doc blockquote{border-left:0!important;padding:0!important;margin:1.6em 0!important;font-size:21px!important;line-height:1.45!important;color:var(--text)!important}
.doc .term{border-bottom:0!important;color:inherit!important}
.editable [data-b].live{position:relative}
.editable [data-b].live:focus::before{content:"";position:absolute;left:-16px;top:.35em;bottom:.35em;width:2px;background:color-mix(in srgb,var(--accent) 70%,transparent);border-radius:1px}
/* My connecting lines: a warmer tone of the same text, no line drawn (2026-10-05). */
.doc mark,.d-doc mark,.d-doc.clean mark{background:none!important;padding:0!important;text-decoration:none!important;color:color-mix(in srgb,var(--warm) 55%,var(--body))!important}
.d-msg{border:1px solid var(--line);border-radius:3px;background:var(--p1);padding:18px 22px;max-width:860px}
.d-msg-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:12.5px;color:var(--dim)}
.d-msg-zh p,.d-msg-zh [data-b]{font-family:"Instrument Sans","PingFang SC","Hiragino Sans GB",sans-serif;font-size:17px;line-height:1.8;color:var(--text);margin:0 0 14px}
.d-msg-en-label{margin:20px 0 8px!important;padding-top:14px;border-top:1px solid var(--line)}
.d-msg-en p{font-family:"Instrument Sans",Helvetica,sans-serif;font-size:14px;line-height:1.65;color:var(--dim);margin:0 0 10px}
.d-msg-foot{margin:14px 0 0;font-size:12.5px}.d-msg-foot a{text-decoration:none;color:var(--dim)}.d-msg-foot a:hover{color:var(--text)}
.editable [data-b].live,.editable [data-b].live:hover,.editable [data-b].live:focus{background:transparent!important;box-shadow:none!important;outline:none;border-radius:0;cursor:text}
.editable .note[contenteditable=false]{user-select:none}
.doc-status{position:fixed;right:18px;bottom:16px;z-index:60;font:400 12.5px "Instrument Sans",Helvetica,sans-serif;color:var(--dim);background:var(--p1);border:1px solid var(--line);border-radius:3px;padding:6px 10px;pointer-events:none}
.doc-status.bad{color:var(--warm);border-color:var(--accent)}
.edit-bar{position:fixed!important;left:50%!important;top:auto!important;bottom:22px;transform:translateX(-50%);z-index:60;display:flex!important;flex-wrap:nowrap;align-items:center;gap:8px;margin:0;padding:8px 10px!important;background:var(--p2)!important;border:1px solid var(--line)!important;border-radius:4px!important;box-shadow:0 10px 30px rgba(0,0,0,.45)!important;max-width:calc(100vw - 32px)}
.edit-bar .edit-hint{font-size:12.5px;color:var(--dim);white-space:nowrap;margin-left:6px}
@media (max-width:640px){.edit-bar{flex-wrap:wrap}.edit-bar .edit-hint{white-space:normal}}
.editable .editing{background:transparent!important;box-shadow:inset 0 -1px 0 var(--accent)}
.doc p,.doc li,.doc ul,.doc .speaker{font-family:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif;font-size:16px;line-height:1.7;color:var(--body);font-weight:400}
.doc li{margin:4px 0}.doc ul{padding-left:20px;margin:8px 0 14px}
.doc strong{font-weight:600;color:var(--text)}
.doc code{font-size:13px}
.doc .note.block,.doc p.note{font-size:13.5px;line-height:1.6}
.doc blockquote{font-family:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif;font-size:18px;font-style:normal}
.hblock{margin:0}
.d-sofar{border:1px solid var(--line);border-radius:3px;background:var(--p1);padding:16px 20px;max-width:860px;margin-top:12px}
.d-sofar dl{margin:10px 0 0;display:flex;flex-direction:column;gap:10px}
.d-sf-row{display:grid;grid-template-columns:88px minmax(0,1fr);gap:16px}
.d-sofar dt{display:flex;flex-direction:column;align-items:flex-start;gap:6px}.d-sofar dt a{display:inline-flex;align-items:center;min-height:26px;padding:3px 9px;background:var(--p2);border:1px solid var(--line);border-radius:3px;font:500 11.5px "Instrument Sans",Helvetica,sans-serif;letter-spacing:.02em;color:var(--body);text-decoration:none}.d-sofar dt a:hover{border-color:color-mix(in srgb,var(--accent) 55%,var(--line));color:var(--text)}
.d-sofar dt{font-size:12.5px;color:var(--dim);padding-top:2px}
.d-sofar dd{margin:0;font:400 16px/1.5 "Newsreader",Georgia,serif;color:var(--text)}
.d-sofar ul{margin:0;padding-left:18px}.d-sofar li{margin:2px 0}
a.d-stop{text-decoration:none}a.d-stop:hover span{color:var(--text)}a.d-stop.open span{color:var(--text);text-decoration:underline;text-underline-offset:5px}
.d-write{flex-direction:column;align-items:stretch;max-width:680px}
.d-write textarea,.d-blind-more textarea{width:100%;min-height:120px;resize:vertical;background:var(--p1);border:1px solid var(--line);border-radius:3px;color:var(--text);padding:14px 16px;font:400 17px/1.55 "Newsreader",Georgia,serif}
.d-write textarea:focus,.d-blind-more textarea:focus{outline:none;border-color:var(--accent)}
.d-write .save{align-self:flex-start;margin:8px 0 0}
.d-blind{display:flex;flex-wrap:wrap;align-items:center;gap:10px;border-top:1px solid var(--line);padding-top:18px;margin-top:8px;font-size:14px;color:var(--dim);max-width:860px}
.d-blind-more{flex-basis:100%;display:flex;flex-direction:column;gap:8px}.d-blind-more textarea{min-height:64px;font-size:15px}.d-blind-more .save{align-self:flex-start}
@media (max-width:860px){.d-sf-row{grid-template-columns:1fr;gap:2px}}
/* Serif for titles only; every other line of writing in the sans (Adrian, 2026-10-05). */
.d-sofar dd,.lg-text,.d-doc p,.d-doc li,.d-doc blockquote,.d-write textarea,.d-blind-more textarea,.d-foot>div>a,.d-q .opt,.d-me,.d-ctx{font-family:"Instrument Sans","Helvetica Neue",Helvetica,sans-serif}
.d-sofar dd{font-size:15px;line-height:1.55}.lg-text{font-size:16px;line-height:1.6}.d-doc p,.d-doc li,.d-doc blockquote{font-size:16px;line-height:1.7}.d-write textarea{font-size:15.5px}
.d-stop span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.d-need{margin:-14px 0 0;font-size:13.5px;line-height:1.4;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.d-need b{font-weight:500;margin-right:6px;color:var(--body)}.d-need.you b{color:var(--warm)}
@media (max-width:860px){.d-need{white-space:normal}}
.d-foot p{margin:0;font-size:14px;line-height:1.5;color:var(--body)}.d-foot p span{color:var(--warm)}
.d-foot>div>a{font:400 16px/1.4 "Newsreader",Georgia,serif;color:var(--body);text-decoration:none}.d-foot>div>a:hover{color:var(--text)}
.d-foot .d-dim{color:var(--dim)}
.d-photos{display:flex!important;flex-direction:column;gap:8px}.d-photo-links{display:flex;flex-wrap:wrap;gap:4px 16px}
.d-foot .link{background:none;border:0;padding:0;color:var(--accent);font-size:13px;cursor:pointer}
.d-photos,.d-photos *{text-align:left}
.d-doc{border:1px solid var(--line);border-radius:3px;background:var(--p1);padding:22px 26px}
.d-doc-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;font-size:12px;letter-spacing:.06em;color:var(--dim)}.d-doc-top a{text-decoration:none}
.d-doc p,.d-doc li,.d-doc blockquote{font-family:"Newsreader",Georgia,serif;font-size:18px;line-height:1.65;color:var(--text)}
.d-doc h1,.d-doc h2,.d-doc h3{font-family:"Newsreader",Georgia,serif;font-weight:500;color:var(--text)}
.d-q:has(.d-doc){max-width:860px}
.d-turns{display:flex;flex-direction:column;gap:10px;padding:10px 28px 4px}
.d-turn{margin:0;display:flex;flex-direction:column;gap:2px;font-size:14px;line-height:1.5;color:var(--body)}
.d-turn b{font:500 22px/1.2 "Newsreader",Georgia,serif;color:var(--text)}
.d-turn.me b{color:var(--dim)}.d-turn.me span{color:var(--dim)}
.d-copy{background:var(--accent-soft);border:1px solid var(--accent);border-radius:3px;color:var(--warm);font:500 13px ui-monospace,Menlo,monospace;padding:1px 7px;cursor:pointer}
.d-whose{margin:8px 0 0;font-size:14px;letter-spacing:.02em;color:var(--dim)}.d-whose.you{color:var(--warm)}
.d-doc.clean .editable>:not(hr ~ *),.d-doc.clean .editable>hr,.d-doc.clean .editable>hr ~ hr ~ *{display:none}
.d-doc.clean .note:not(.you){display:none}
.d-doc .note.you{display:block;margin:10px 0;padding:10px 14px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:3px;font:400 14px "Instrument Sans",Helvetica,sans-serif;color:var(--warm)}
.d-doc mark{background:none;color:inherit;text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:1px;text-underline-offset:5px}
.d-mine-key{font-style:normal;color:var(--warm);margin-left:6px}
.d-row-title{overflow-wrap:anywhere;min-width:0}
.d-doc p.d-doc-top{font:400 12px "Instrument Sans",Helvetica,sans-serif;letter-spacing:.06em;color:var(--dim);line-height:1.4}
@media (max-width:1060px){.d-stepline{display:block}.d-stop span{display:none}.d-foot{grid-template-columns:1fr 1fr}.d-path{margin-top:-14px}}
@media (max-width:860px){
 .desk{grid-template-columns:1fr}
 .desk.has-sel .d-side{display:none}
 .desk:not(.has-sel) .d-main{display:none}
 .desk.has-sel .d-back{display:block;padding:18px 16px 0;font-size:14px;text-decoration:none}
 .d-side{border-right:0}
 .d-main{padding:20px 16px 72px;gap:22px}
 .d-title{font-size:32px}.d-qt{font-size:27px}
 .d-make{align-items:flex-start}.d-make-btns{justify-content:flex-start}
 .d-stepline{display:block}.d-stop span{display:none}
 .d-foot{grid-template-columns:1fr 1fr;gap:22px}
 .opt.big{min-width:100%}
}
@media (max-width:560px){.card{padding:18px 16px}.col{padding-left:12px;padding-right:12px}}
/* Classy buttons (Adrian, 2026-10-04): a quiet raised tone, a hairline edge, bronze when it is the pick. */
.opts{gap:10px}
.opt,.ledger .opt.lg-opt,.lg-all,.save{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:10px 20px;background:var(--p2);border:1px solid var(--line);border-radius:3px;color:var(--body);font:500 14px "Instrument Sans","Helvetica Neue",Helvetica,sans-serif;letter-spacing:.02em;text-decoration:none;cursor:pointer;transition:border-color .15s,background .15s,color .15s}
.opt:hover,.ledger .opt.lg-opt:hover,.lg-all:hover,.save:hover{background:var(--p4);border-color:color-mix(in srgb,var(--accent) 45%,var(--line));color:var(--text)}
.opt.rec,.ledger .opt.lg-opt.pre{border-color:color-mix(in srgb,var(--accent) 80%,var(--line));color:var(--text);text-decoration:none}
.opt.chosen,.ledger .opt.lg-opt.on{background:rgba(191,149,95,.16);border-color:var(--accent);color:var(--warm);text-decoration:none}
.opt small{margin:0;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.opt.chosen small{color:#c9a876}
.lg-opts{gap:10px;margin-top:10px}
.lg-all,.save{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 55%,var(--line))}
.save{margin-left:8px}
/* The words lineup: each card is one 4:5 slide, drawn in the post's own espresso and cream. */
.ln-row{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0 6px}
.ln-card{width:228px;touch-action:none;user-select:none}
.ln-card.ln-lift{opacity:.35}
.ln-ghost{position:fixed;pointer-events:none;z-index:50;opacity:.9;transform:rotate(-2deg)}
.ln-slide{width:228px;height:285px;box-sizing:border-box;background:#1a1714;border:1px solid #3a3530;border-radius:3px;padding:16px 16px 14px;display:flex;flex-direction:column;gap:6px;cursor:grab;position:relative}
.ln-card.ln-over .ln-slide{outline:2px solid #a8874d;outline-offset:2px}
.ln-role{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a8874d}
.ln-text{flex:1;font-family:"Newsreader",Georgia,serif;font-size:19px;line-height:1.35;color:#f3eada;overflow:auto;cursor:text;outline:none;border-radius:2px}
.ln-text:focus{background:var(--p3)}
.ln-text:empty::before{content:"photo only, no words";color:#8d806b;font-style:normal}
.ln-credit{font-size:12px;color:#cdc0a8}
.ln-photo{font-size:12px;line-height:1.4;color:#8d806b;border-top:1px solid #3a3530;padding-top:7px}
.ln-quote .ln-text::before,.ln-quote .ln-text::after{content:none}
.ln-cover,.ln-close{background:var(--p3)}
.ln-foot{display:flex;justify-content:space-between;align-items:center;margin-top:5px;font-size:12px;color:var(--dim)}
.ln-cut{background:none;border:0;color:var(--dim);font:inherit;cursor:pointer;padding:6px 0 6px 10px}
.ln-cut:hover{color:var(--accent)}
.ln-caplab{margin-top:18px}
.ln-caption{width:100%;max-width:680px;box-sizing:border-box;min-height:96px;resize:vertical;background:var(--p1);border:1px solid var(--line);border-radius:3px;color:var(--text);font:15px/1.6 "Instrument Sans",system-ui,sans-serif;padding:10px 12px}
.ln-caption:focus{outline:none;border-color:var(--accent)}
.ln-changed{border:1px solid var(--line);border-radius:3px;padding:12px 16px;margin:14px 0 0;max-width:680px}.ln-changed ul{margin:6px 0 0;padding-left:18px;font-size:15px;line-height:1.6}
/* The look step: slides drawn at true 4:5 from the real templates, scaled down. */
.lk-row{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0 8px}
.lk-card{cursor:grab;touch-action:none;user-select:none}
.lk-card.on .lk-frame{outline:2px solid #a8874d;outline-offset:3px}
.lk-card.lift{opacity:.35}
.lk-card.hot .lk-frame{outline:2px dashed #a8874d;outline-offset:3px}
.lk-foot{font-size:12px;color:var(--dim);margin-top:6px;max-width:168px}.lk-foot b{color:var(--accent);font-weight:500}
.lk-frame{position:relative;overflow:hidden;border-radius:2px;background:#1a1714}
.lk-scale{width:1080px;height:1350px;transform-origin:0 0;position:absolute;left:0;top:0}
.lk-ghost{position:fixed;z-index:60;pointer-events:none;opacity:.9;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.lk-edit{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;border-top:1px solid var(--line);padding-top:20px;margin-top:10px}
/* Words, fades and the logo sit over the photo; let drags reach the photo under them. */
.lk-big .lk-scale div,.lk-big .lk-scale img{pointer-events:none}.lk-big .lk-scale [data-slot],.lk-big .lk-scale [data-slot] img{pointer-events:auto}
.lk-big [data-slot]{cursor:move;touch-action:none}
.lk-big [data-slot].hot{outline:6px solid #a8874d;outline-offset:-6px}
.lk-big{flex:none;position:sticky;top:12px}.lk-side{flex:1 1 260px;min-width:0}
.lk-alts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px}
.lk-alt{background:none;border:0;padding:0;cursor:pointer;color:var(--dim);font:12px/1.4 "Instrument Sans",system-ui,sans-serif;text-align:left;display:flex;flex-direction:column;gap:5px;width:84px}
.lk-alt:hover .lk-frame{outline:1px solid #a8874d;outline-offset:2px}
.lk-tray{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.lk-ph{width:64px;height:80px;object-fit:cover;border-radius:2px;cursor:grab;touch-action:none;user-select:none}
.ig-ready{border:1px solid var(--line);border-radius:3px;padding:14px 16px;margin:16px 0}
.ig-ready-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}.ig-ready-row img{width:96px;height:120px;object-fit:cover;display:block;border-radius:2px}
.ig-cap{font-size:15px;line-height:1.6;max-width:680px;margin:0 0 8px}.ig-where{font-size:12px;color:var(--dim);margin:8px 0 0}
.ln-saved{font-size:13px;color:var(--dim);min-height:18px;margin:6px 0 0}
/* Light and dark (2026-10-05). Dark stays the default look; light follows the research-report page. */
:root{--warm:#e6c896;--p1:#1b1712;--p2:#221d17;--p3:#2a2622;--p4:#2a241c;--hl:rgba(230,200,150,.20);--hl-on:rgba(230,200,150,.32)}
:root[data-theme="light"]{--bg:#f3f1ec;--panel:#ebe7df;--text:#1f1d1a;--body:#2e2b27;--dim:#6b665d;--line:#d6d1c6;--hover:#e7e2d8;--accent:#8a6534;--accent-soft:rgba(138,101,52,.12);--mark:#efe2c6;--note:#e7e2d8;--ok:#4f7a4f;--warm:#7a5526;--p1:#ebe7df;--p2:#e6e1d7;--p3:#e1dbcf;--p4:#e6e0d4;--hl:rgba(242,200,90,.22);--hl-on:rgba(242,190,60,.55);color-scheme:light}
:root[data-theme="light"] .rail .card{background:#e9e5dc}
:root[data-theme="light"] .rail .card.on{background:#fbf8f1!important;box-shadow:0 4px 16px rgba(60,45,20,.18)}
:root[data-theme="light"] .rail .card.flag{background:#efe4cc}
:root[data-theme="light"] a{color:#2f5d6b}
:root[data-theme="light"] .doc p.mine,:root[data-theme="light"] .doc p mark,:root[data-theme="light"] .d-doc p.mine,:root[data-theme="light"] .d-doc p mark{color:#7a5526!important}
.theme-toggle{position:fixed;top:12px;right:16px;z-index:60;border:0;background:none;padding:6px 8px;font:400 12.5px "Instrument Sans",Helvetica,sans-serif;color:var(--dim);cursor:pointer}.theme-toggle:hover{color:var(--text)}
`;

// Buttons post the choice; the page reloads with the answer in place.
const JS = LOCAL_JOB_JS + `
const post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
// The words lineup: drag a card to move it, click the words to change them; every change saves itself.
function lnNumber(box){box.querySelectorAll('.ln-card').forEach((c,i)=>{c.querySelector('.ln-n').textContent='Slide '+(i+1)})}
async function lnSave(box){const slides=[...box.querySelectorAll('.ln-card')].map(c=>({role:c.dataset.role,credit:c.dataset.credit,photo:c.dataset.photo,template:'',crop:'',text:c.querySelector('.ln-text').innerText.replace(/\\s+/g,' ').trim()}));
  const out=box.querySelector('.ln-saved');const r=await post('/lineup',{file:box.dataset.file,hash:box.dataset.hash,slides,caption:box.querySelector('.ln-caption').value});if(r.ok&&r.hash)box.dataset.hash=r.hash;
  out.textContent=r.ok?'Saved':'Not saved: '+r.error;if(r.ok)setTimeout(()=>{if(out.textContent==='Saved')out.textContent=''},1800);return r}
document.querySelectorAll('.d-lineup').forEach(box=>{lnNumber(box);
  box.addEventListener('focusout',e=>{if(e.target.matches('.ln-text,.ln-caption'))lnSave(box)});
  box.addEventListener('pointerdown',e=>{const card=e.target.closest('.ln-card');if(!card||e.target.closest('.ln-cut')||e.button)return;
    const x0=e.clientX,y0=e.clientY;let ghost=null,over=null;
    const move=ev=>{if(!ghost){if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<6)return;getSelection().removeAllRanges();if(document.activeElement)document.activeElement.blur();
        ghost=card.querySelector('.ln-slide').cloneNode(true);ghost.classList.add('ln-ghost');document.body.appendChild(ghost);card.classList.add('ln-lift')}
      ev.preventDefault();ghost.style.left=(ev.clientX-114)+'px';ghost.style.top=(ev.clientY-40)+'px';
      const u=document.elementFromPoint(ev.clientX,ev.clientY),t=u&&u.closest('.ln-card');if(over&&over!==t)over.classList.remove('ln-over');over=t&&t!==card&&box.contains(t)?t:null;if(over)over.classList.add('ln-over')};
    const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);if(!ghost)return;ghost.remove();card.classList.remove('ln-lift');
      if(over){over.classList.remove('ln-over');const cards=[...box.querySelectorAll('.ln-card')];over.parentNode.insertBefore(card,cards.indexOf(card)<cards.indexOf(over)?over.nextSibling:over);lnNumber(box);lnSave(box)}};
    addEventListener('pointermove',move);addEventListener('pointerup',up)});
});
let runTimer;const showRunLog=()=>{let p=document.querySelector('.run-log');if(!p){p=document.createElement('div');p.className='run-log';p.innerHTML='<div class="run-log-head"><b>Running on the server</b><button type="button">Close</button></div><pre></pre>';p.querySelector('button').onclick=()=>{clearInterval(runTimer);p.remove()};document.body.appendChild(p)}const pre=p.querySelector('pre');const tick=async()=>{const r=await post('/run-log',{});if(!r.ok)return;pre.textContent=r.text;pre.scrollTop=pre.scrollHeight;if(!r.running){clearInterval(runTimer);p.querySelector('b').textContent='Done on the server'}};clearInterval(runTimer);tick();runTimer=setInterval(tick,4000)};
const toast=t=>{const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)};
document.addEventListener('click',async e=>{
  const o=e.target.closest('.opt[data-value]');
  if(o){o.disabled=true;const r=await post('/answer',{file:o.dataset.file,index:+o.dataset.index,title:o.dataset.title,value:o.dataset.value});if(r.ok)location.reload();else{o.disabled=false;toast(r.error)}return}
  if(e.target.closest('[data-show-other]')){const f=e.target.closest('.q').querySelector('form.other');f.hidden=false;f.querySelector('input').focus();return}
  const all=e.target.closest('.lg-all');
  if(all){all.disabled=true;for(const i of JSON.parse(all.dataset.all)){const r=await post('/answer',{file:all.dataset.file,index:i,value:'Suggested'});if(!r.ok){toast(r.error);all.disabled=false;return}}location.reload();return}
  const aw=e.target.closest('[data-approve-words]');
  if(aw){aw.disabled=true;const box=aw.closest('.d-lineup');const s=await lnSave(box);if(!s.ok){aw.disabled=false;return}const r=await post('/approve',{file:aw.dataset.approveWords,hash:box.dataset.hash,value:'words'});if(r.ok)location.reload();else{aw.disabled=false;toast(r.error)}return}
  const lc=e.target.closest('.ln-cut');
  if(lc){const box=lc.closest('.d-lineup');lc.closest('.ln-card').remove();lnNumber(box);lnSave(box);return}
  const ap=e.target.closest('[data-approve]');
  if(ap){ap.disabled=true;if(ap.closest('.d-look'))ap.firstChild.textContent='Saving the slides as images…';const r=await post('/approve',{file:ap.dataset.approve,hash:(ap.closest('[data-hash]')||{dataset:{}}).dataset.hash,value:'yes'});if(r.ok)location.reload();else{ap.disabled=false;toast(r.error)}return}
  const cc=e.target.closest('[data-copy-cap]');
  if(cc){try{await navigator.clipboard.writeText(cc.dataset.copyCap);toast('Caption copied')}catch(_){toast('Select the caption and copy it')}return}
  const cm=e.target.closest('[data-copy-msg]');
  if(cm){const z=cm.closest('.d-msg').querySelector('.d-msg-zh');const c=z.cloneNode(true);c.querySelectorAll('.note').forEach(n=>n.remove());c.querySelectorAll('br').forEach(b=>b.replaceWith('\\n'));const parts=[...c.querySelectorAll('[data-b],p')].map(p=>p.textContent.trim()).filter(Boolean);const text=(parts.length?parts.join('\\n\\n'):c.textContent).trim();
    try{await navigator.clipboard.writeText(text);toast('Copied. Paste it into WeChat.')}catch(_){const r=document.createRange();r.selectNodeContents(z);const sl=getSelection();sl.removeAllRanges();sl.addRange(r);toast('Selected. Press Cmd+C to copy.')}return}
  const sa=e.target.closest('[data-show-arc]');
  if(sa){const f=document.querySelector('.d-arc');if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector('textarea').focus()}return}
  const rm=e.target.closest('[data-run-mag]');
  if(rm){rm.disabled=true;const r=await post('/run-mag',{});if(r.ok){toast(r.elsewhere?'Another machine is running /mag right now':r.already?'Already running':r.vps?'Started on the server. Its progress shows below.':'Opening Terminal and starting /mag');if(r.vps||(r.already&&!r.elsewhere))showRunLog();setTimeout(()=>{rm.disabled=false},4000)}else{rm.disabled=false;toast(r.error)}return}
  const cp=e.target.closest('[data-copy]');
  if(cp){try{await navigator.clipboard.writeText(cp.dataset.copy);toast('Copied /mag')}catch(_){toast('Type /mag in Claude')}return}
  const rq=e.target.closest('[data-redo]');
  if(rq){rq.disabled=true;const r=await post('/redo',{step:rq.dataset.redo,story:rq.dataset.story});if(r.ok)location.reload();else{rq.disabled=false;toast(r.error)}return}
  const bl=e.target.closest('[data-blind]');
  if(bl){const box=bl.closest('.d-blind');if(bl.dataset.blind==='no'){box.querySelector('.d-blind-more').hidden=false;box.querySelector('textarea').focus();return}
    const r=await post('/blind',{story:box.dataset.story,step:box.dataset.step,q:box.dataset.q,value:'yes'});if(r.ok){box.innerHTML='<span>Thanks. Noted that this one was clear.</span>'}else toast(r.error);return}
  const mk=e.target.closest('[data-make]');
  if(mk){mk.disabled=true;const r=await post('/make',{kind:mk.dataset.make,story:mk.dataset.story});if(r.ok)location.reload();else{mk.disabled=false;toast(r.error)}return}
  const rd=e.target.closest('[data-reopen-desk]');if(rd){const r=rd.parentElement.nextElementSibling;if(r)r.hidden=!r.hidden;return}
  if(e.target.closest('[data-show-album]')){const f=e.target.closest('.photos').querySelector('form.album');f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus();return}
  const ro=e.target.closest('[data-reopen]');if(ro){const r=ro.parentElement.querySelector('.reopen');r.hidden=!r.hidden;return}
  const op=e.target.closest('a[data-open]');if(op){e.preventDefault();fetch(op.getAttribute('href')).then(()=>toast('Opened in Finder'));return}
  const s=e.target.closest('[data-sort]');if(s){try{localStorage.setItem('magSort',s.dataset.sort)}catch(_){};sortCards(s.dataset.sort)}
});
document.addEventListener('submit',async e=>{
  const af=e.target.closest('.d-arc');
  if(af){e.preventDefault();const v=af.querySelector('textarea').value.trim();if(!v){toast('Say what to make first.');return}const bt=af.querySelector('button');bt.disabled=true;const r=await post('/run-mag',{arc:v});bt.disabled=false;if(r.ok){af.hidden=true;af.querySelector('textarea').value='';toast(r.elsewhere?'Another machine is running right now':r.already?'Already running':r.vps?'Started on the server. Its progress shows below.':'Opening Terminal and starting /arcreate');if(r.vps||(r.already&&!r.elsewhere))showRunLog()}else toast(r.error);return}
  e.preventDefault();const f=e.target;
  if(f.classList.contains('upload'))return;
  if(f.classList.contains('d-blind-more')){const box=f.closest('.d-blind');const r=await post('/blind',{story:box.dataset.story,step:box.dataset.step,q:box.dataset.q,value:'no',note:f.querySelector('textarea').value.trim()});if(r.ok){box.innerHTML='<span>Thanks. I will add the missing context to this page.</span>'}else toast(r.error);return}
  if(f.classList.contains('made')){const v0=f.querySelector('input').value.trim();if(!v0)return;const r=await post('/approve',{file:f.dataset.file,hash:(f.closest('[data-hash]')||{dataset:{}}).dataset.hash,value:v0});if(r.ok)location.reload();else toast(r.error);return}
  const v=f.querySelector('textarea,input').value.trim();if(!v)return;
  if(f.classList.contains('other')){const r=await post('/answer',{file:f.dataset.file,index:+f.dataset.index,title:f.dataset.title,value:v});if(r.ok)location.reload();else toast(r.error)}
  if(f.classList.contains('album')){const r=await post('/album',{story:f.dataset.story,link:v});toast(r.ok?'Album linked. Downloading the photos now…':r.error);if(r.ok)setTimeout(()=>location.reload(),4000)}
});
// Uploads: one at a time, each with its own row and bar; the page refreshes when the last one lands.
function uploadAll(files){
  // mag-conversation-upload-v2
  if(document.querySelector("[data-upload-preview]") && [...files].every(f=>/\.(m4a|mp3|wav|mov|mp4|aac|flac|ogg|opus|webm|mkv|aiff?)$/i.test(f.name))){prepareRecordingUpload(files);return}
  const form=document.querySelector('form.upload');if(!form||!files.length)return;
  const story=files.length===1?form.story.value.trim():'';
  const queue=form.querySelector('.queue');
  const rows=[...files].map(file=>{const r=document.createElement('div');r.className='up';r.innerHTML='<span></span><em>waiting</em><div class="progress"><i></i></div>';r.querySelector('span').textContent=file.name;queue.appendChild(r);return {file,r}});
  let failed=0,takingIn=0;
  const next=i=>{
    if(i>=rows.length){toast(failed?failed+' did not upload':(takingIn?'Uploaded. Transcribing locally now.':'Uploaded. They are in the drop folder.'));if(!failed)setTimeout(()=>location.reload(),1200);return}
    const {file,r}=rows[i];const fill=r.querySelector('i');const st=r.querySelector('em');st.textContent='uploading';
    const x=new XMLHttpRequest();
    x.open('POST','/upload?name='+encodeURIComponent(file.name)+'&story='+encodeURIComponent(story));
    x.upload.onprogress=ev=>{if(ev.lengthComputable)fill.style.width=(100*ev.loaded/ev.total)+'%'};
    x.onload=()=>{let res={};try{res=JSON.parse(x.responseText)}catch(_){}
      if(res.ok){if(res.job)takingIn++;st.textContent=res.job?'transcribing locally':'done';fill.style.width='100%'}else{failed++;st.textContent=res.error||'failed';r.classList.add('bad')}next(i+1)};
    x.onerror=()=>{failed++;st.textContent='failed: is the Mac awake?';r.classList.add('bad');next(i+1)};
    x.send(file);
  };
  next(0);
}
document.addEventListener('change',e=>{if(e.target.matches('form.upload input[type=file]')){uploadAll(e.target.files);e.target.value=''}});
const zone=document.querySelector('.zone');
if(zone){
  ['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();zone.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();if(t==='drop'||!e.relatedTarget)zone.classList.remove('over')}));
  document.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');uploadAll(e.dataTransfer.files)});
}
function sortCards(k){
  document.querySelectorAll('[data-sort]').forEach(b=>b.classList.toggle('on',b.dataset.sort===k));
  document.querySelectorAll('section[data-group]').forEach(sec=>{[...sec.querySelectorAll('.card')].sort((a,b)=>(k==='done'?-1:1)*(a.dataset.step-b.dataset.step)).forEach(c=>sec.appendChild(c))});
}
let k='done';try{k=localStorage.getItem('magSort')||'done'}catch(_){}
if(document.querySelector('[data-sort]'))sortCards(k);

// Click any paragraph of a draft to edit it in place. You type straight into the paragraph: same
// width, same lines, nothing moves. The buttons float just under it. Words wrapped in /slashes/ are
// marked for Claude to rework. Removing every word removes the paragraph.
let editing=null;
document.addEventListener('click',async e=>{
  if(!editing||editing.el.contains(e.target)||e.target.closest('.edit-bar'))return;
  e.preventDefault();e.stopImmediatePropagation();
  const t=e.target,x=e.clientX,y=e.clientY;
  if(!(await editing.finish()))return;
  const a=t.closest('a[href]');
  if(a){location.href=a.href;return}
  t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
},true);
document.addEventListener('click',e=>{
  const el=e.target.closest('.editable [data-b]');
  if(!el||e.target.closest('a')||el.isContentEditable||el.classList.contains('live'))return;
  if(document.querySelector('.edit-bar'))return;
  const file=el.closest('.editable').dataset.file;
  const html=el.innerHTML,x=e.clientX,y=e.clientY;
  const h0=el.getBoundingClientRect().height;el.style.minHeight=h0+'px';
  el.querySelectorAll('.note').forEach(n=>n.remove());el.querySelectorAll('.rework').forEach(r=>r.replaceWith('/'+r.textContent+'/'));el.contentEditable='plaintext-only';el.classList.add('editing');el.focus({preventScroll:true});
  const r0=document.caretRangeFromPoint&&document.caretRangeFromPoint(x,y);
  if(r0&&el.contains(r0.startContainer)){const sel=getSelection();sel.removeAllRanges();sel.addRange(r0)}
  const bar=document.createElement('div');bar.className='edit-bar';
  const mk=(t,c)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.className=c;bar.appendChild(b);return b};
  const save=mk('Save','opt chosen'),cancel=mk('Cancel','opt'),del=mk('Remove','opt');
  const hint=document.createElement('span');hint.className='edit-hint';hint.textContent='Click anywhere else to save · /words/ = rework · Esc cancel';bar.appendChild(hint);
  document.body.appendChild(bar);
  const ro={disconnect(){}};
  bar.addEventListener('mousedown',ev=>ev.preventDefault());
  const end=()=>{editing=null;ro.disconnect();bar.remove();el.style.minHeight='';el.contentEditable='false';el.removeAttribute('contenteditable');el.classList.remove('editing')};
  const cancelIt=()=>{el.innerHTML=html;end()};
  const send=async text=>{save.disabled=del.disabled=true;
    const r=await post('/edit',{file,b:+el.dataset.b,h:el.dataset.h,text});
    if(!r.ok){save.disabled=del.disabled=false;toast(r.error);return false}
    end();
    if(r.removed){const n=+el.dataset.b;el.closest('.editable').querySelectorAll('[data-b]').forEach(q=>{if(+q.dataset.b>n)q.dataset.b=+q.dataset.b-1});el.remove();toast('Removed');return true}
    if(r.html!==undefined){el.innerHTML=r.html;el.dataset.h=r.h;el.dataset.plain=r.plain}else el.innerHTML=html;
    el.classList.remove('just-saved');void el.offsetWidth;el.classList.add('just-saved');toast(r.changed?'Saved':'No change');return true};
  editing={el,finish:async()=>{if(el.innerText.trim()===String(el.dataset.plain||'').trim()){cancelIt();return true}return send(el.innerText)}};
  save.onclick=()=>send(el.innerText);cancel.onclick=cancelIt;
  del.onclick=()=>{if(confirm('Remove this paragraph from the draft?'))send('')};
  el.addEventListener('keydown',function k(ev){if(!el.isContentEditable){el.removeEventListener('keydown',k);return}
    if(ev.key==='Escape'){ev.preventDefault();cancelIt()}
    if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();send(el.innerText)}});
});

// ── One live document (2026-10-05) ──
// Each paragraph keeps its look; working notes are islands you cannot type into and are never saved as words.
(function(){
  const docs=[...document.querySelectorAll('.editable')];if(!docs.length)return;
  const status=document.createElement('div');status.className='doc-status';status.textContent='';document.body.appendChild(status);
  let hideT;const say=(t,bad)=>{status.textContent=t;status.classList.toggle('bad',!!bad);status.classList.add('show');clearTimeout(hideT);status.classList.toggle('done',t==='Saved'||t==='Removed');if(!bad&&t!=='Saving…'&&!/^Editing/.test(t))hideT=setTimeout(()=>status.classList.remove('show'),3000)};
  const textOf=el=>{const c=el.cloneNode(true);c.querySelectorAll('.note').forEach(n=>n.remove());c.querySelectorAll('.rework').forEach(r=>r.replaceWith('/'+r.textContent+'/'));c.querySelectorAll('br').forEach(b=>b.replaceWith('\\n'));return c.textContent.replace(/ /g,' ').replace(/[“”]/g,'"').trim()};
  let queue=Promise.resolve();const timers=new Map();
  const save=el=>{clearTimeout(timers.get(el));timers.delete(el);
    queue=queue.then(async()=>{
      if(!el.isConnected)return;const now=textOf(el);if(now===el.dataset.orig)return;
      const file=el.closest('.editable').dataset.file;say('Saving…');
      const r=await post('/edit',{file,b:+el.dataset.b,h:el.dataset.h,text:now});
      if(!r.ok){say(r.error||'Could not save. Reload the page.',true);return}
      if(r.removed){const n=+el.dataset.b;el.closest('.editable').querySelectorAll('[data-b]').forEach(q=>{if(+q.dataset.b>n)q.dataset.b=+q.dataset.b-1});el.remove()}
      else{if(!el.dataset.was&&!el.dataset.whenSet){el.dataset.when=new Date().toISOString().slice(0,10);el.dataset.whenSet='1';el.dataset.was=el.dataset.orig||''}el.dataset.h=r.h;el.dataset.orig=now;if(document.activeElement!==el&&r.html!==undefined){el.innerHTML=r.html;prep(el)}}
      say(r.removed?'Removed':'Saved');if(!r.removed)el.dispatchEvent(new CustomEvent('mag-saved',{bubbles:true}));
    });return queue};
  const prep=el=>{el.querySelectorAll('.note').forEach(n=>n.contentEditable='false')};
  for(const doc of docs)for(const el of doc.querySelectorAll('[data-b]')){
    prep(el);el.dataset.orig=textOf(el);el.contentEditable='plaintext-only';el.spellcheck=false;el.classList.add('live');
    el.addEventListener('input',()=>{clearTimeout(timers.get(el));say('Editing · saves by itself');timers.set(el,setTimeout(()=>save(el),1200))});
    el.addEventListener('blur',()=>save(el));
    el.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();el.blur()}});
  }
  {const tb=document.querySelector('[data-theme-toggle]');if(tb){const cur=()=>document.documentElement.dataset.theme==='light'?'light':'dark';const lab=()=>{tb.textContent=cur()==='light'?'Dark':'Light'};lab();tb.addEventListener('click',()=>{const n=cur()==='light'?'dark':'light';document.documentElement.dataset.theme=n;try{localStorage.setItem('magTheme',n)}catch(_){}lab()})}}
  // Working notes and your edits as comments in a side column, beside the paragraph they belong to (like Google Docs).
  const names={was:'Earlier wording','was, as adrian said it':'As you said it',pull:'Pull quote','speaker?':'Who said this?',you:'Your note',check:'Check',source:'Source'};
  const fmtDay=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch(_){return d}};
  // Pull-quote layout codes in plain words: xl / l / m size, hook, follow.
  const SHOW_OWN_EDITS=false;
  const SKIP=['pull','photos','photo','side','saying','on-photo','glyph','ending','sources','quotes joined','your seven lines'];
  const KINDS=[['was, as adrian said it','As you said it'],['was','Earlier wording'],['heard','The recording said'],['speaker?','Who said this?',1],['adrian','Needs you',1],['check','Check this',1],['you','Your note'],['source','Where this comes from']];
  // Working shorthand in plain words: file names become what they are, Adrian becomes you.
  const plainWords=(t,key)=>{let x=t.replace(/Adrian's own research,? */g,'').replace(/What Adrian knows/g,'What you know').replace(/Adrian's/g,'your').replace(/(^|[^A-Za-z])Adrian(?![A-Za-z])/g,'$1you').replace(/(^|[^A-Za-z])SRC(?: - [^,;)]*)?(?![A-Za-z])/g,'$1the transcript').replace(/(^|[^A-Za-z])CONTEXT,? */g,'$1your background notes, ').replace(/(^|[^A-Za-z])RESEARCH(?![A-Za-z])/g,'$1the research notes').replace(/(^|[^A-Za-z])MAP(?![A-Za-z])/g,'$1the map').replace(/, *$/,'').trim();if(key==='source'){const fromTalk=/the transcript/.test(x);x='From '+x.replace(/^your background notes, *$/,'your background notes')+(fromTalk?'':'. Not from the conversation.');}return x};
  const pullWords=t=>{const size={xl:'Set extra large',l:'Set large',m:'Set medium',follow:'the story carries straight on after it',hook:'the hook'};const out=[];let rest=t.trim(),m;while((m=rest.match(/^(xl|l|m|follow|hook)(?=$|[ ,])[ ,]*/i))){out.push(size[m[1].toLowerCase()]);rest=rest.slice(m[0].length)}const sx=out.concat(rest?[rest]:[]).join(', ');return sx?sx[0].toUpperCase()+sx.slice(1):t};
  const clip=t=>t.length>160?t.slice(0,157).trim()+'…':t;
  for(const ed of document.querySelectorAll('.doc .editable[data-file],.d-doc .editable[data-file]')){
    if(!(ed.querySelector('.note')||ed.querySelector('[data-was]')))continue;
    document.body.classList.add('has-rail');ed.classList.add('railed');
    let off=false;try{off=localStorage.getItem('magRailOff')==='1'}catch(_){}
    document.body.classList.toggle('rail-off',off);
    const box=ed.closest('.d-doc')||document;const tg=box.querySelector('.notes-toggle');
    if(tg){tg.textContent=off?'Show notes and edits':'Hide notes and edits';tg.addEventListener('click',ev=>{ev.preventDefault();off=!off;document.body.classList.toggle('rail-off',off);tg.textContent=off?'Show notes and edits':'Hide notes and edits';try{localStorage.setItem('magRailOff',off?'1':'0')}catch(_){}})}
    const rail=document.createElement('div');rail.className='rail';ed.appendChild(rail);
    const anchorOf=n=>{if(n.parentElement===ed&&/^pull:/i.test(n.textContent.trim())){let b=n.nextElementSibling;while(b&&(b.classList.contains('note')||!b.offsetHeight))b=b.nextElementSibling;if(b)return b}
      if(n.parentElement!==ed)return n.closest('[data-b],p,blockquote,h1,h2,h3,li');let a=n.previousElementSibling;while(a&&(a.classList.contains('note')||!a.offsetHeight))a=a.previousElementSibling;return a||n.nextElementSibling};
    let busy=false,activeA=null,pairs=[];
    // The exact words a comment is about, as ranges, so only those light up (like Docs).
    const textNodes=a=>{const w=document.createTreeWalker(a,NodeFilter.SHOW_TEXT,{acceptNode:t=>t.parentElement.closest('.note,.rail')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});const out=[];let n,pos=0;while((n=w.nextNode())){out.push({n,pos});pos+=n.data.length}return {out,text:out.map(o=>o.n.data).join('')}};
    const rangeAt=(tn,s,e)=>{if(e<=s)return null;const r=document.createRange();let ok=0;for(const {n,pos} of tn.out){const L=n.data.length;if(!ok&&s<=pos+L){r.setStart(n,Math.max(0,s-pos));ok=1}if(ok&&e<=pos+L){r.setEnd(n,Math.max(0,e-pos));return r}}return ok?r:null};
    const sentenceBefore=(txt,end)=>{let e=end;while(e>0&&/\\s/.test(txt[e-1]))e--;let s=0;const re=/[.!?]["”’)]?\\s+/g;let m;while((m=re.exec(txt))&&m.index+m[0].length<e)s=m.index+m[0].length;return [s,e]};
    const quoteNorm=t=>t.replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
    // What changed between the earlier wording and now, word by word: [{old,neu,s,e}] with s/e the span in the new text.
    const diffWords=(was,now)=>{const tok=x=>{const o=[];const re=/\\S+/g;let m;while((m=re.exec(x)))o.push({w:m[0],i:m.index});return o};const A=tok(quoteNorm(was)),B=tok(quoteNorm(now));
      const L=Array.from({length:A.length+1},()=>new Int32Array(B.length+1));for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)L[i][j]=A[i].w===B[j].w?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
      const hunks=[];let h=null;let i=0,j=0;const close=()=>{if(h){hunks.push(h);h=null}};
      while(i<A.length||j<B.length){if(i<A.length&&j<B.length&&A[i].w===B[j].w){close();i++;j++}else if(j>=B.length||(i<A.length&&L[i+1][j]>=L[i][j+1])){h=h||{a:[],b:[],at:j};h.a.push(i);i++}else{h=h||{a:[],b:[],at:j};h.b.push(j);j++}}close();
      return hunks.map(h=>{let s,e;if(h.b.length){s=B[h.b[0]].i;const z=B[h.b[h.b.length-1]];e=z.i+z.w.length}else{const k=Math.min(h.at,B.length-1);if(k>=0){s=B[k].i;e=s+B[k].w.length}}return {old:h.a.map(k=>A[k].w).join(' '),neu:h.b.map(k=>B[k].w).join(' '),s,e}})};
    const diffLine=hs=>{const one=h=>h.old&&h.neu?'“'+h.old+'” → “'+h.neu+'”':h.neu?'Added “'+h.neu+'”':'Removed “'+h.old+'”';const shown=hs.slice(0,3).map(one).join('\\n');return hs.length>3?shown+'\\n…and '+(hs.length-3)+' more':shown};
    // The words of a sentence that differ from its earlier wording (only when the two clearly share most words).
    const changedIn=(tn,s0,e0,old)=>{const tk=(str,off)=>{const o=[];const re=/[^ ]+/g;let m;while((m=re.exec(str)))o.push({r:m[0],w:[...m[0].toLowerCase()].filter(c=>/[a-z0-9']/.test(c)).join(''),i:m.index+off,len:m[0].length});return o.filter(x=>x.w)};const A=tk(quoteNorm(old),0),B=tk(quoteNorm(tn.text.slice(s0,e0)),s0);const none=Object.assign([],{pairs:[]});if(A.length<3||!B.length)return none;const L=Array.from({length:A.length+1},()=>new Int16Array(B.length+1));for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)L[i][j]=A[i].w===B[j].w?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);const ops=[];let a=0,b=0;while(a<A.length||b<B.length){if(a<A.length&&b<B.length&&A[a].w===B[b].w){ops.push(['=',a,b]);a++;b++}else if(b>=B.length||(a<A.length&&L[a+1][b]>=L[a][b+1])){ops.push(['-',a]);a++}else{ops.push(['+',b]);b++}}let f=ops.findIndex(o=>o[0]==='='),l=ops.length-1;while(l>=0&&ops[l][0]!=='=')l--;if(f<0)return none;const lead=ops.slice(0,f).filter(o=>o[0]==='-'),tail=ops.slice(l+1).filter(o=>o[0]==='-');ops.splice(0,ops.length,...lead,...ops.slice(f,l+1),...tail);const keep=new Set(ops.filter(o=>o[0]==='=').map(o=>o[2]));if(keep.size<A.length/2)return none;const inWin=new Set(ops.filter(o=>o[0]!=='-').map(o=>o[o[0]==='='?2:1]));const pairs=[];let po=[],pn=[];const flush=()=>{if(po.length||pn.length)pairs.push([po.map(k=>A[k].r).join(' '),pn.map(k=>B[k].r).join(' ')]);po=[];pn=[]};for(const o of ops){if(o[0]==='=')flush();else if(o[0]==='-')po.push(o[1]);else pn.push(o[1])}flush();const rs=[];let st=-1;for(let k=0;k<=B.length;k++){const ch=k<B.length&&inWin.has(k)&&!keep.has(k);if(ch&&st<0)st=k;if(!ch&&st>=0){rs.push(rangeAt(tn,B[st].i,B[k-1].i+B[k-1].len));st=-1}}return Object.assign(rs,{pairs,score:keep.size/A.length-pairs.length*0.01})};
    const rangesFor=p=>{const tn=textNodes(p.a);if(!tn.text.trim())return [];
      if(p.edit){const was=p.a.dataset.was||'';if(!was)return [rangeAt(tn,0,tn.text.length)].filter(Boolean);return diffWords(was,tn.text).filter(h=>h.s!==undefined).map(h=>rangeAt(tn,h.s,h.e)).filter(Boolean)}
      if(false){const was='',now='';
        const tok=s=>{const o=[];const re=/\\S+/g;let m;while((m=re.exec(s)))o.push({w:m[0],i:m.index});return o};const A=tok(was),B=tok(now);
        const L=Array.from({length:A.length+1},()=>new Int16Array(B.length+1));for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)L[i][j]=A[i].w===B[j].w?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
        const keep=new Set();for(let i=0,j=0;i<A.length&&j<B.length;){if(A[i].w===B[j].w){keep.add(j);i++;j++}else if(L[i+1][j]>=L[i][j+1])i++;else j++}
        const rs=[];let st=-1;for(let j=0;j<=B.length;j++){const ch=j<B.length&&!keep.has(j);if(ch&&st<0)st=j;if(!ch&&st>=0){rs.push(rangeAt(tn,B[st].i,B[j-1].i+B[j-1].w.length));st=-1}}
        if(!rs.length&&B.length){const j=[...Array(B.length).keys()].find(j=>!keep.has(j)||j===B.length-1);rs.push(rangeAt(tn,B[j].i,B[j].i+B[j].w.length))}
        return rs.filter(Boolean)}
      // A word-change note highlights only the words it names that are still on the page (“Ancha” finds “An Cha”); with an arrow, the new words. Nothing found, nothing lit.
      // A transcriber fix: light the [bracketed] words just before the note; the card keeps the misheard words.
      if(p.n&&/^heard/i.test(p.n.textContent.trim())&&p.a.contains(p.n)){let before=0;for(const {n:t,pos} of tn.out){if(p.n.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_PRECEDING)before=pos+t.data.length}const head=tn.text.slice(0,before);const e1=head.lastIndexOf(']'),s1=head.lastIndexOf('[',e1);return s1>=0&&e1>s1?[rangeAt(tn,s1,e1+1)].filter(Boolean):[]}
      if(p.n&&/^(was|heard)/i.test(p.n.textContent.trim())){const t=p.n.textContent;const phr=t.includes('→')?[...t.matchAll(/→ *[“"]([^”"]+)/g)].map(m=>m[1]):[...t.matchAll(/[“"]([^”"]+)[”"]/g)].map(m=>m[1]);const keep=ch=>/[a-z0-9]/.test(ch);const low=tn.text.toLowerCase();let norm='';const idx=[];for(let i=0;i<low.length;i++)if(keep(low[i])){norm+=low[i];idx.push(i)}const rs=[],miss=[],sum=[];for(const ph of phr){const q=[...ph.toLowerCase()].filter(keep).join('');if(q.length<3)continue;const at=norm.indexOf(q);if(at<0){miss.push(ph);continue}const s1=idx[at],e1=idx[at+q.length-1]+1;rs.push(rangeAt(tn,s1,e1));const now=tn.text.slice(s1,e1);if(now!==ph)sum.push([ph,now])}if(miss.length&&p.a.contains(p.n)){let before=0;for(const {n:t,pos} of tn.out){if(p.n.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_PRECEDING)before=pos+t.data.length}const spans=[];let st0=0;const sre=/[.!?][”’")]?(?: +|$)/g;let sm;while((sm=sre.exec(tn.text))){spans.push([st0,sm.index+sm[0].length]);st0=sm.index+sm[0].length;if(!sm[0].length)sre.lastIndex++}if(st0<tn.text.length)spans.push([st0,tn.text.length]);for(const ph of miss){let best=null;for(const [a0,b0] of spans){const r=changedIn(tn,a0,b0,ph);if(r.pairs.length&&(!best||r.score>best.score))best=r}if(best){rs.push(...best);sum.push(...best.pairs)}else{const head=tn.text.slice(0,before);const e1=head.lastIndexOf(']'),s1=head.lastIndexOf('[',e1);if(s1>=0&&e1>s1){rs.push(rangeAt(tn,s1,e1+1));sum.push([ph,tn.text.slice(s1,e1+1)])}}}}const ap=t.includes("→")?[...t.matchAll(/[“"]([^”"]+)[”"] *→ *[“"]([^”"]+)[”"]/g)].map(m=>[m[1],m[2]]):[];if(ap.length){sum.length=0;sum.push(...ap)}p.summary=sum;return rs.filter(Boolean)}
      const n=p.n;if(!n||!p.a.contains(n))return [rangeAt(tn,0,tn.text.length)].filter(Boolean);
      let before=0;for(const {n:t,pos} of tn.out){if(n.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_PRECEDING)before=pos+t.data.length}
      let prev=n.previousSibling;while(prev&&prev.nodeType===3&&!prev.data.trim())prev=prev.previousSibling;
      if(prev&&prev.nodeType===1&&/^(MARK|STRONG|EM|SPAN)$/.test(prev.tagName)&&!prev.classList.contains('note')){const sub=textNodes(prev).out[0];if(sub){const start=tn.out.find(o=>o.n===sub.n);if(start)return [rangeAt(tn,start.pos,before)].filter(Boolean)}}
      const [s,e]=sentenceBefore(tn.text,before);return [rangeAt(tn,s,e)].filter(Boolean)};
    const canHL=!!(window.CSS&&CSS.highlights&&window.Highlight);
    const paintEdited=()=>{if(!canHL)return;const rs=[];for(const p of pairs)if(p.edit)try{rs.push(...rangesFor(p))}catch(_){}const prev=CSS.highlights.get('mag-edited');const all=prev?[...prev].filter(r=>!ed.contains(r.startContainer)):[];all.push(...rs);if(all.length)CSS.highlights.set('mag-edited',new Highlight(...all));else CSS.highlights.delete('mag-edited')};
    const paint=list=>{if(!canHL)return;const rs=[];for(const p of list)try{rs.push(...rangesFor(p))}catch(_){}if(rs.length)CSS.highlights.set('mag-active',new Highlight(...rs));else CSS.highlights.delete('mag-active')};
    let activeC=null,boxes=[];
    const place=()=>{const top0=ed.getBoundingClientRect().top;let floor=0;for(const {box,a} of boxes){const top=Math.max(a.getBoundingClientRect().top-top0,floor);box.style.top=top+'px';floor=top+box.offsetHeight+8}};
    const activate=(a,c)=>{activeA=a;activeC=c||null;const lit=pairs.filter(p=>p.a===a&&(!c||p.c===c));for(const p of pairs){const v=lit.includes(p);p.c.classList.toggle('on',v);p.a.classList.toggle('noted',v&&!canHL)}for(const {box,a:ba} of boxes){const v=ba===a;box.classList.toggle('on',v);box.classList.toggle('open',v)}place();paint(lit)};
    const layout=()=>{if(busy)return;busy=true;rail.textContent='';const side=ed.clientWidth>=820;rail.style.display=side?'':'none';ed.querySelectorAll('.rail.rail-inline').forEach(x=>x.remove());pairs=[];const top0=ed.getBoundingClientRect().top;const items=[];
      for(const n of ed.querySelectorAll('.note')){if(rail.contains(n))continue;const a=anchorOf(n);if(!a||!a.offsetHeight)continue;
        // Only what is worth your eye: flags, word changes, where a fact comes from, your own notes. Layout codes stay out.
        const raw=n.textContent.trim();if(!raw)continue;const lw=raw.toLowerCase();
        if(lw.startsWith('/')||SKIP.some(k=>lw.startsWith(k)&&!/[a-z]/.test(lw.charAt(k.length))))continue;
        const ci=raw.indexOf(':');const key=ci>0&&ci<60?lw.slice(0,ci).trim():'';const kind=key?KINDS.find(k=>key===k[0]||key.startsWith(k[0])):null;
        const c=document.createElement('div');c.className='card'+(n.classList.contains('you')?' you':'')+(kind&&kind[2]?' flag':'');
        if(kind){const b=document.createElement('b');b.textContent=kind[1];c.appendChild(b);c.appendChild(document.createTextNode(plainWords(raw.slice(ci+1).trim(),kind[0])))}else c.textContent=plainWords(raw,'');
        items.push({a,c,n})}
      for(const a of (SHOW_OWN_EDITS?ed.querySelectorAll('[data-was]'):[])){if(!a.offsetHeight)continue;const c=document.createElement('div');c.className='card edit';
        const b=document.createElement('b');b.textContent='You changed this'+(a.dataset.when?' · '+fmtDay(a.dataset.when):'');c.appendChild(b);
        const w=document.createElement('span');w.className='diff';const now=textNodes(a).text;const hs=a.dataset.was?diffWords(a.dataset.was,now):[];w.textContent=!a.dataset.was?'New paragraph':hs.length?diffLine(hs):'Spacing or punctuation only';c.appendChild(w);
        if(a.dataset.was){const u=document.createElement('button');u.type='button';u.className='undo';u.textContent='Put back the earlier wording';c.appendChild(u);
          u.addEventListener('click',async ev=>{ev.stopPropagation();u.disabled=true;u.textContent='Putting it back…';
            const r=await post('/edit',{file:ed.dataset.file,b:+a.dataset.b,h:a.dataset.h,text:a.dataset.was});
            if(!r.ok){u.disabled=false;u.textContent='Put back the earlier wording';alert(r.error||'Could not undo. Reload the page.');return}
            if(r.html!==undefined){a.innerHTML=r.html;a.dataset.h=r.h;a.dataset.plain=r.plain;a.dataset.orig=r.plain}
            delete a.dataset.when;delete a.dataset.whenSet;a.removeAttribute('data-was')})}
        items.push({a,c,edit:true})}
      items.sort((x,y)=>x.a.getBoundingClientRect().top-y.a.getBoundingClientRect().top);
      // One card per passage, like a Docs thread: the most important note shows, the rest fold under it.
      const rank=c=>c.classList.contains('flag')?0:c.classList.contains('edit')?1:c.classList.contains('you')?2:/^Where this/.test(c.textContent)?4:3;
      const groups=[];for(const it of items){let g=groups.find(g=>g.a===it.a);if(!g){g={a:it.a,list:[]};groups.push(g)}if(!g.list.some(x=>x.c.textContent===it.c.textContent))g.list.push(it)}
      boxes=[];for(const g of groups){g.list.sort((x,y)=>rank(x.c)-rank(y.c));const box=document.createElement('div');box.className='card group'+(g.list.some(x=>x.c.classList.contains('flag'))?' flag':'');
        g.list.forEach((it,k)=>{it.c.className=it.c.className.replace(/^card/,'row')+(k?' more':'');box.appendChild(it.c);pairs.push({a:g.a,c:it.c,n:it.n,edit:it.edit,box});
          it.c.addEventListener('click',ev=>{ev.stopPropagation();activate(g.a,it.c);const r=g.a.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-40)g.a.scrollIntoView({block:'center',behavior:'smooth'})})});
        if(g.list.length>1){const m=document.createElement('button');m.type='button';m.className='more-link';m.textContent=(g.list.length-1)+' more on this passage';box.appendChild(m);m.addEventListener('click',ev=>{ev.stopPropagation();activate(g.a)})}
        if(side){rail.appendChild(box);boxes.push({box,a:g.a})}else{let at=g.a;while(at.parentElement&&at.parentElement!==ed)at=at.parentElement;const w=document.createElement('div');w.className='rail rail-inline';w.contentEditable='false';w.appendChild(box);let nx=at.nextElementSibling;while(nx&&(nx.classList.contains('note')||nx.classList.contains('rail-inline')))nx=nx.nextElementSibling;ed.insertBefore(w,nx)}}
      place();
      if(canHL){const rs=[];for(const p of pairs)try{rs.push(...rangesFor(p))}catch(_){}if(rs.length)CSS.highlights.set('mag-notes',new Highlight(...rs));else CSS.highlights.delete('mag-notes');let changed=false;for(const p of pairs){if(!p.summary||!p.summary.length||p.c.dataset.summed)continue;const b=p.c.querySelector('b');p.c.title=p.c.textContent;[...p.c.childNodes].forEach(x=>{if(x!==b)x.remove()});for(const [o,nw] of p.summary){const d=document.createElement('span');d.className='swap';d.textContent=(o?'“'+o+'”':'(added)')+' → '+(nw?'“'+nw+'”':'(removed)');p.c.appendChild(d)}p.c.dataset.summed='1';changed=true}if(changed)place()}paintEdited();
      if(activeA&&activeA.isConnected)activate(activeA,activeC&&pairs.find(p=>p.c.textContent===activeC.textContent)?.c);else if(canHL)CSS.highlights.delete('mag-active');busy=false};
    ed.addEventListener('focusin',ev=>{const a=ev.target.closest('[data-b]');if(a&&pairs.some(p=>p.a===a))activate(a)});
    document.addEventListener('click',ev=>{if(ev.target.closest&&ev.target.closest('.rail'))return;const a=ev.target.closest&&ev.target.closest('.editable [data-b],.editable p,.editable blockquote,.editable h2,.editable h3');if(a&&ed.contains(a)&&pairs.some(p=>p.a===a)){activate(a);return}if(activeA)activate(null)});
    layout();let t;const again=()=>{clearTimeout(t);t=setTimeout(layout,150)};
    addEventListener('resize',again);if(document.fonts)document.fonts.ready.then(layout);
    new MutationObserver(ms=>{const railNode=x=>x.nodeType===1&&x.classList.contains('rail');if(ms.some(m=>!(m.target.closest&&m.target.closest('.rail'))&&m.target!==rail&&!(m.type==='childList'&&[...m.addedNodes,...m.removedNodes].every(railNode))&&(m.type!=='attributes'||m.attributeName==='data-was')))again()}).observe(ed,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-was']});
  }
  // Leaving the page with an unsaved paragraph: send it on the way out.
  addEventListener('beforeunload',()=>{for(const el of timers.keys()){const now=textOf(el);if(now!==el.dataset.orig)navigator.sendBeacon('/edit',JSON.stringify({file:el.closest('.editable').dataset.file,b:+el.dataset.b,h:el.dataset.h,text:now}))}});
})();
`;

const page = (title, body, doc = false) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Instrument+Sans:ital,wght@0,400;0,500;1,400;1,500&family=Caudex:wght@400;700&family=EB+Garamond:wght@400;500&display=swap"><script>try{var t=localStorage.getItem('magTheme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script><style>${CSS}</style></head><body><button class="theme-toggle" type="button" data-theme-toggle>Light</button><div class="col${doc ? ' doc' : ''}">${body}</div><script>${JS}</script><script>${IG_SRC}
${LOOK_JS}</script></body></html>`;

function readBody(req) {
  return new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 20000) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d)); } catch (e) { no(e); } }); });
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };


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
  if (!ARC) return withLegacyLock(MAG, 'an album link', () => { fs.mkdirSync(path.join(FILES, story, 'Photos'), { recursive: true }); fs.writeFileSync(path.join(FILES, story, 'album-link.txt'), link + '\n'); });
  return arcDo('/api/magazine/album/link', { story, link });
}
// A file uploaded with a story name is taken in by AR Create (it copies, transcribes and files RAW).
async function claimDrop(story, dest, defer) {
  if (!ARC) return startIntake(story, dest, { defer });
  const r = await arcDo('/api/magazine/drops/claim', { name: path.basename(dest), folder: 0, story });
  return r.claim?.claimId || '';
}
const madeHash = m => magHash('sha256').update(m.raw).digest('hex');

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  // The recordings workshop's saves belong to AR Create now; the page keeps showing it read-only.
  if (ARC && req.method === 'POST' && url.pathname.startsWith('/transcription')) return json(res, 409, { ok: false, error: 'Recordings are worked on in AR Create now (Material). Nothing was saved here.' });
  if (await handleLocalRoute(req, res, url)) return;
  // Same-origin only for anything that writes: a page on another site can't post here.
  // Reached over Tailscale (the phone) rather than on this Mac: hide what only works at the Mac.
  const remote = !/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.localAddress || '');
  if (req.method === 'POST') {
    // Only this page may write: the browser's Origin must be the address the page was opened at.
    const origin = req.headers.origin || '';
    if (origin && origin !== `http://${req.headers.host}`) return json(res, 403, { ok: false, error: 'not from this page' });
    if (url.pathname === '/upload') {
      // The body is the file itself; its name and the story come in the address.
      const name = path.basename(String(url.searchParams.get('name') || '')).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 120);
      const story = String(url.searchParams.get('story') || '').trim().replace(/[\/\\]/g, '-').slice(0, 80);
      if (!name || name.startsWith('.')) return json(res, 400, { ok: false, error: 'no file name' });
      if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD) return json(res, 413, { ok: false, error: 'That file is over 4 GB' });
      const drop = DROPS[0];
      fs.mkdirSync(drop, { recursive: true });
      let dest = path.join(drop, name);
      for (let n = 2; fs.existsSync(dest); n++) dest = path.join(drop, name.replace(/(\.[^.]*)?$/, ` ${n}$1`));
      const part = dest + '.part';
      const out = fs.createWriteStream(part);
      let size = 0;
      req.on('data', c => { size += c.length; if (size > MAX_UPLOAD) req.destroy(); });
      req.pipe(out);
      out.on('finish', async () => {
        if (size === 0) { fs.rmSync(part, { force: true }); return json(res, 400, { ok: false, error: 'the file was empty' }); }
        fs.renameSync(part, dest);
        const automaticStory = /\.(?:m4a|mp3|wav|mov|mp4|aac|flac|ogg|opus|aiff?|wma|webm|mkv|mpeg|mpg|m4v|caf|3gp)$/i.test(dest) ? path.basename(dest, path.extname(dest)).slice(0, 80) : '';
        let job = '';
        if (story || automaticStory) { try { job = await claimDrop(story || automaticStory, dest, url.searchParams.get('defer')==='1'); } catch (e) { return json(res, e.status || 409, { ok: false, error: 'Saved in the drop folder, but not taken in: ' + e.message, file: path.basename(dest) }); } }
        json(res, 200, { ok: true, file: path.basename(dest), job });
      });
      req.on('error', () => fs.rmSync(part, { force: true }));
      req.on('aborted', () => fs.rmSync(part, { force: true }));
      return;
    }
    try {
      const b = await readBody(req);
      if (url.pathname === '/edit') { const r = await saveEdit(b); return json(res, 200, r.raw ? { ok: true, changed: r.changed, html: blockHtml(r.raw), h: hash(r.raw), plain: plain(r.raw) } : { ok: true, changed: r.changed, removed: !!r.removed }); }
      const runPrompt = b.arc ? '/arcreate ' + String(b.arc).replace(/[\r\n]+/g, ' ').trim().slice(0, 600) : '/mag resume';
      if (url.pathname === '/run-mag' && b.arc !== undefined && !String(b.arc).trim()) return json(res, 400, { ok: false, error: 'Say what to make first.' });
      if (url.pathname === '/run-mag' && process.platform !== 'darwin') {
        const runDir = path.join(HOME, 'mag-run'), lock = path.join(MAG, 'Workflow/_mag-running.md');
        fs.mkdirSync(runDir, { recursive: true });
        if (globalThis.magRun && globalThis.magRun.exitCode === null) return json(res, 200, { ok: true, already: true });
        try { if (Date.now() - fs.statSync(lock).mtimeMs < 2 * 3600e3) return json(res, 200, { ok: true, already: true, elsewhere: true }); } catch {}
        if (b.dry) return json(res, 200, { ok: true, dry: true });
        const out = fs.openSync(path.join(runDir, 'last-run.jsonl'), 'w');
        globalThis.magRun = spawn(process.platform === 'win32' ? path.join(process.env.APPDATA || '', 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe') : 'claude', ['-p', runPrompt, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(node:*) Bash(ls:*) Bash(date:*) Bash(hostname) Read Edit Write Glob Grep', '--output-format', 'stream-json', '--verbose'], { cwd: MAG, env: process.env, stdio: ['ignore', out, out] });
        globalThis.magRunStarted = Date.now();
        // Run under the main account (where Claude is signed in), the synced files must stay the sync account's.
        if (process.getuid && process.getuid() === 0) globalThis.magRun.on('exit', () => execFile('chown', ['-R', 'vaultsync:vaultsync', path.dirname(MAG), HOME + '/mag-run'], () => {}));
        return json(res, 200, { ok: true, vps: true });
      }
      if (url.pathname === '/run-mag') {
        if (remote) return json(res, 403, { ok: false, error: 'Run it on the Mac: this opens a window there.' });
        if (Date.now() - (globalThis.lastMagRun || 0) < 60000) return json(res, 200, { ok: true, already: true });
        globalThis.lastMagRun = Date.now();
        const dir = path.join(HOME, 'Documents/Files/4 Coding/teajia');
        const cmd = path.join(os.tmpdir(), 'run-mag.command');
        fs.writeFileSync(cmd, '#!/bin/zsh -l\n# Opened by the magazine page.\ncd ' + JSON.stringify(dir) + ' || cd ~\nclear\nexec claude ' + "'" + (b.arc ? runPrompt : '/mag').replace(/'/g, "'\\''") + "'" + '\n', { mode: 0o755 });
        fs.chmodSync(cmd, 0o755);
        if (b.dry) return json(res, 200, { ok: true, dry: true, file: cmd });
        execFile('open', ['-a', 'Terminal', cmd], err => {});
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/run-log') {
        let lines = []; try { lines = fs.readFileSync(path.join(HOME, 'mag-run/last-run.jsonl'), 'utf8').split('\n'); } catch {}
        const said = lines.map(l => { try { const j = JSON.parse(l); if (j.type === 'assistant') return (j.message.content || []).filter(c => c.type === 'text').map(c => c.text).join(''); if (j.type === 'result') return '\n— finished —'; } catch {} return ''; }).filter(Boolean).join('\n\n');
        const running = globalThis.magRun && globalThis.magRun.exitCode === null;
        return json(res, 200, { ok: true, running, text: said || (running ? 'Starting…' : 'Nothing has run here yet.') });
      }
      if (url.pathname === '/redo') {
        const step = String(b.step || ''), story = String(b.story || '');
        if (!STEP_NAMES.includes(step) || !story || /[\n\r]/.test(story)) return json(res, 400, { ok: false, error: 'not a step' });
        const f = REQUESTS(); let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { t = '---\ntype: Make requests\n---\n\n# Make requests\n\n'; }
        const line = '- [ ] ' + new Date().toISOString().slice(0, 10) + ' Redo ' + step + ' · ' + story;
        await saveRequest(b, () => { if (!t.split('\n').some(l => l.startsWith('- [ ]') && l.endsWith('Redo ' + step + ' · ' + story))) fs.writeFileSync(f, t.replace(/\s*$/, '\n') + line + '\n'); });
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/blind') {
        const f = path.join(MAG, 'Workflow/_page-feedback.md'); let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { t = '---\ntype: Page feedback\n---\n\n# Could Adrian answer it coming in blind?\n\nEvery answer from the magazine page, newest last. A "no" is a page to fix: it lacked the context to decide.\n\n'; }
        const clean = v => String(v || '').replace(/[\r\n]+/g, ' ').slice(0, 500);
        await saveBlind(b, () => fs.writeFileSync(f, t.replace(/\s*$/, '\n') + '- ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + clean(b.story) + ' · step ' + clean(b.step) + ' · ' + clean(b.q) + ' · ' + (b.value === 'yes' ? 'yes' : 'NEEDS MORE') + (b.note ? ': ' + clean(b.note) : '') + '\n'));
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/lineup') { if (!Array.isArray(b.slides)) return json(res, 400, { ok: false, error: 'no slides' }); const lr = await saveLineupVia(b); return json(res, 200, { ok: true, ...(lr && lr.hash ? { hash: lr.hash } : {}) }); }
      if (url.pathname === '/approve') { const rel = String(b.file || ''), v = String(b.value || ''), look = v === 'yes' && madeFile(rel).stage === 'look';
        await saveApprove(b, rel, v, look); return json(res, 200, { ok: true }); }
      if (url.pathname === '/make') {
        const kind = String(b.kind || ''), story = String(b.story || '');
        if (!['Carousel', 'Post', 'Reel', 'Video script'].includes(kind) || !story || /[\n\r]/.test(story)) return json(res, 400, { ok: false, error: 'not a request' });
        const f = REQUESTS(); let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { t = '---\ntype: Make requests\n---\n\n# Make requests\n\nAsked on the magazine page. /arcreate makes each from the story\'s brief, shows it to Adrian for his yes, then ticks the line.\n\n'; }
        const line = '- [ ] ' + new Date().toISOString().slice(0, 10) + ' ' + kind + ' · ' + story;
        await saveRequest(b, () => { if (!t.split('\n').some(l => l.endsWith(kind + ' · ' + story) && l.startsWith('- [ ]'))) fs.writeFileSync(f, t.replace(/\s*$/, '\n') + line + '\n'); });
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/answer') { await saveAnswer(b); return json(res, 200, { ok: true }); }
      if (url.pathname === '/album') {
        const story = String(b.story || ''); const link = String(b.link || '').trim();
        if (!FILES || !story || story.includes('/') || story.startsWith('.')) return json(res, 400, { ok: false, error: 'unknown story' });
        if (!/^https:\/\/(www\.)?icloud\.com\/sharedalbum\/#[A-Za-z0-9]+$/.test(link)) return json(res, 400, { ok: false, error: 'That is not a shared album link (it starts https://www.icloud.com/sharedalbum/#)' });
        await saveAlbum(story, link);
        const p = spawn('node', [path.join(HOME, 'builds/mag-photos.mjs'), story], { detached: true, stdio: ['ignore', fs.openSync('/tmp/mag-photos.log', 'a'), fs.openSync('/tmp/mag-photos.log', 'a')] });
        p.unref();
        return json(res, 200, { ok: true });
      }
    } catch (e) { return json(res, e.status || 400, { ok: false, error: e.message }); }
    return json(res, 404, { ok: false, error: 'not found' });
  }

  let html;
  if (url.pathname === '/') {
    html = page('Teajia Magazine', frontPage(remote, url.searchParams.get('s') || '', url.searchParams.get('q'), url.searchParams.get('step'), url.searchParams.get('read')));
  } else if (url.pathname === '/transcription' || url.pathname === '/transcription/') {
    html = page('Local transcription', transcriptionHome(remote));
  } else if (url.pathname === '/read' || url.pathname.startsWith('/read/')) {
    const rel = url.pathname === '/read' ? (url.searchParams.get('f') || '') : decodeURIComponent(url.pathname.slice('/read/'.length));
    const abs = path.resolve(MAG, rel);
    if (!abs.startsWith(path.resolve(MAG) + path.sep) || !abs.endsWith('.md') || !fs.existsSync(abs)) { res.writeHead(404); return res.end('Not found'); }
    // At the bottom of a map or draft: the questions that ask about it, as buttons, so reading ends in deciding.
    const here = listAsks(MAG).flatMap(a => a.questions.filter(q => q.read && (q.reads || [q.read]).some(r => path.resolve(MAG, r.file) === abs)).map(q => questionHtml({ ...q, read: null, reads: null }, a.file)));
    const decide = here.length ? `<section class="decide"><h3>Decide</h3><div class="card you">${here.join('')}</div></section>` : '';
    const mdText = fs.readFileSync(abs, 'utf8'), relPath = path.relative(MAG, abs), isDraft = /^Workflow\/3-Develop\/DEV - /.test(relPath);
    if (isDraft && url.searchParams.get('notes') !== '1') { const owner = data().find(x => draftName(x) === path.basename(relPath)); if (owner) { res.writeHead(302, { location: deskUrl(owner.story) + '&read=' + encodeURIComponent(relPath) }); return res.end(); } }
    const showNotes = url.searchParams.get('notes') === '1';
    const calm = isDraft && !showNotes && mdText.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').filter(l => l.trim() === '---').length >= 2;
    const notesLink = isDraft ? `<a class="notes-toggle" href="${url.pathname}${showNotes ? '' : '?notes=1'}">${showNotes ? 'Hide working notes' : 'Show working notes'}</a>` : '';
    html = page(path.basename(rel, '.md'), `<div class="top"><a href="/">← Stories</a>${notesLink}</div>` + `<div class="${calm ? 'readcalm' : 'readall'}">` + render(mdText, /^Workflow\/(3-Develop\/DEV|1-Source\/CONTEXT) - .*\.md$/.test(relPath) ? relPath : '') + '</div>' + decide, true);
  } else if (url.pathname === '/ig-slide') {
    // One slide at full size, for the export to photograph. Local only.
    if (remote) { res.writeHead(404); return res.end('Not found'); }
    const m = madeFile(url.searchParams.get('file') || ''), { slides } = lookSlides(m), s = slides[Number(url.searchParams.get('i')) || 0];
    if (!s) { res.writeHead(404); return res.end('Not found'); }
    const slide = { role: s.role, text: s.text, credit: s.credit, label: m.label, photos: s.photos.map(p => ({ src: p.file ? '/img/' + encodeURIComponent(m.story) + '/' + encodeURIComponent(p.file) : '', x: p.x, y: p.y })) };
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caudex:wght@400;700&family=EB+Garamond:wght@400;500&display=swap"><style>html,body{margin:0;background:#1a1714}</style></head><body>' + IG.render(s.template, slide, {}) + '</body></html>');
  } else if (url.pathname.startsWith('/ig-out/')) {
    const parts = url.pathname.split('/').slice(2).map(decodeURIComponent);
    if (parts.length !== 2 || parts.some(p => !p || p.startsWith('.') || p.includes('/') || p.includes('\\')) || !/^slide-\d+\.png$/.test(parts[1])) { res.writeHead(404); return res.end('Not found'); }
    const file = path.join(MAG, 'Workflow/5-Social', parts[0], parts[1]);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); return fs.createReadStream(file).pipe(res);
  } else if (url.pathname.startsWith('/img/') || url.pathname === '/ig-assets/teajia-wordmark.png') {
    // A story's photo (read-only) or the wordmark, for the look step. Nothing outside those folders.
    const parts = url.pathname.split('/').slice(2).map(decodeURIComponent);
    const file = url.pathname.startsWith('/img/') ? (parts.length === 2 && FILES && !parts.some(p => !p || p.startsWith('.') || p.includes('/') || p.includes('\\')) && IMG_EXT.test(parts[1]) ? photoPath(parts[0], parts[1]) : '') : path.join(path.dirname(IG_FILE), 'ig-assets', 'teajia-wordmark.png');
    if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[path.extname(file).slice(1).toLowerCase()];
    res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=300' }); return fs.createReadStream(file).pipe(res);
  } else if (url.pathname.startsWith('/photos/') || url.pathname === '/drop') {
    if (remote) { res.writeHead(404); return res.end('Not on the phone: this opens Finder on the Mac.'); }
    const name = url.pathname === '/drop' ? 'Drop' : decodeURIComponent(url.pathname.slice('/photos/'.length));
    if (!FILES || !name || name.includes('/') || name.startsWith('.')) { res.writeHead(404); return res.end('Not found'); }
    const dir = url.pathname === '/drop' ? path.join(FILES, 'Drop') : path.join(FILES, name, 'Photos');
    fs.mkdirSync(dir, { recursive: true });
    if (!process.env.MAG_NO_FINDER) execFile('open', [dir], () => {});
    html = page(name, `<div class="top"><a href="/">← Stories</a></div><p>Opened in Finder: ${esc(dir.replace(HOME + '/', ''))}</p>`);
  } else { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
});

// This Mac, and its Tailscale address (100.64.0.0/10) so the phone can open the page on the tailnet.
// Nothing else: no other network can reach it. MAG_TAILNET=0 turns the tailnet address off.
const handler = app.listeners('request')[0];
app.listen(PORT, '127.0.0.1', () => console.log(`Magazine page: http://localhost:${PORT}/`));
// Tailscale may connect after this starts (at login it usually does), so look again every minute
// and serve any tailnet address that has appeared.
const served = new Set();
function bindTailnet() {
  if (process.env.MAG_TAILNET === '0') return;
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(a => a && a.family === 'IPv4' && /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address)).map(a => a.address);
  for (const ip of ips) {
    if (served.has(ip)) continue;
    served.add(ip);
    http.createServer(handler).listen(PORT, ip, () => console.log(`On your phone (Tailscale): http://${ip}:${PORT}/`))
      .on('error', e => { served.delete(ip); console.log(`Tailscale address ${ip} not served yet: ${e.message}`); });
  }
}
bindTailnet();
setInterval(bindTailnet, 60000).unref?.();
