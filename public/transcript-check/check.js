// The transcript check screen. Reads /api/transcript-check/<jobId>; every decision and every typed change is Adrian's
// tap on this page and goes back through the server, which writes through the recording's own correction boundary.
//
// Listening: tap any word to hear the talk from just before it; the word being said lights up, and a player at the
// bottom goes back five seconds or pauses. Typing: the paragraph last tapped offers "Edit this paragraph", which opens
// the whole paragraph as text; the server spreads the new words back over the transcript's lines. Suggestions sit
// on top: each opens a card whose Hear plays the line before through the line after.
const job = new URLSearchParams(location.search).get('job') || '';
const api = '/api/transcript-check/' + encodeURIComponent(job);
const $ = (id) => document.getElementById(id);
const audio = $('audio');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const NAME = { ear: 'Needs your ear', sure: 'Sure fix', notyou: 'Probably not you' };
const DONE = { used: 'Used', kept: 'Kept as you said it', 'left-out': 'Left out of the talk', edited: 'Changed by you' };

let state = null, open = null, stopAt = null, playing = null, heardOnce = false, busy = false, error = null, last = null, toastTimer = null;
let active = null, editing = null, wordIndex = [];

/* ---------- listening ---------- */
audio.addEventListener('timeupdate', () => {
  if (stopAt !== null && audio.currentTime >= stopAt) { audio.pause(); stopAt = null; }
  paintNow(); paintPlayer();
});
audio.addEventListener('play', paintPlayer);
audio.addEventListener('pause', () => { if (playing) { playing.classList.remove('playing'); playing = null; } paintPlayer(); });
audio.addEventListener('loadedmetadata', paintPlayer);
function play(from, to, btn) {
  if (playing) playing.classList.remove('playing');
  audio.currentTime = Math.max(0, from - 1); stopAt = to == null ? null : to + 1; audio.play().catch(() => {});
  if (btn) { btn.classList.add('playing'); playing = btn; }
  heardOnce = true;
}
/* The word being said, found by time among the words on screen. */
function paintNow() {
  const t = audio.currentTime; let lo = 0, hi = wordIndex.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (wordIndex[mid][0] <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  const prev = document.querySelector('.w.now'); const el = at >= 0 && !audio.paused ? wordIndex[at][1] : null;
  if (prev && prev !== el) prev.classList.remove('now');
  if (el && !el.classList.contains('now')) el.classList.add('now');
}
function paintPlayer() {
  $('play').classList.toggle('playing', !audio.paused);
  $('play').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
  $('clock').textContent = mmss(audio.currentTime || 0) + (Number.isFinite(audio.duration) ? ' / ' + mmss(audio.duration) : '');
}
$('play').onclick = () => { if (audio.paused) { stopAt = null; audio.play().catch(() => {}); heardOnce = true; } else audio.pause(); };
$('back').onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 5); if (audio.paused) { stopAt = null; audio.play().catch(() => {}); } };

const B = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.innerHTML = label; b.onclick = fn; return b; };

async function request(path, body) {
  const res = await fetch(api + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const value = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(value.error || 'Something went wrong. Nothing was changed.');
  return value;
}

const heard = (p) => p.indexes.map((i) => state.segments[i].text.trim()).join(' ');
const fixFor = (p, i) => (p.fixes || []).find((f) => f.index === i)?.text ?? state.segments[i].text.trim();
const openProblems = () => state.problems.filter((p) => !p.decision);
const around = (p) => [state.segments[Math.max(0, p.indexes[0] - 1)].start, state.segments[Math.min(state.segments.length - 1, p.indexes.at(-1) + 1)].end];

function nextOpen() {
  const ear = openProblems().filter((p) => p.tier === 'ear');
  return ear.find((p) => !open || p.indexes[0] > open.indexes[0]) || ear[0] || openProblems()[0] || null;
}

async function load() {
  try { state = await request(''); } catch (e) { $('notice').innerHTML = '<div class="notice"><b>This recording could not be opened.</b> ' + esc(e.message) + '</div>'; return; }
  if (state.check.state === 'none' && state.available) { try { state = await request('/suggest', {}); } catch (e) { error = e.message; } }
  audio.src = '/transcription/' + encodeURIComponent(job) + '/audio';
  $('open-view').href = '/transcription/' + encodeURIComponent(job) + '/view';
  render();
  if (state.check.state === 'running') setTimeout(poll, 4000);
}
async function poll() { try { state = await request(''); } catch { /* keep the last view */ } render(); if (state.check.state === 'running') setTimeout(poll, 4000); }

function renderNotice() {
  const n = $('notice'); n.innerHTML = ''; const c = state.check;
  const box = (html, btn) => { const d = document.createElement('div'); d.className = 'notice'; d.innerHTML = html; if (btn) d.append(btn); n.append(d); };
  if (c.state === 'running') box('<b>Reading your talk for anything that needs a look.</b> Usually under a minute. Tap any word to hear it meanwhile.');
  else if (c.state === 'failed') box('<b>The suggestions did not come through.</b> ' + esc(c.error || ''), B('Try again', 'main', async () => { state = await request('/suggest', { again: true }); render(); setTimeout(poll, 4000); }));
  else if (c.state === 'ready' && !state.problems.length) box('<b>Nothing in this talk needs a look.</b> Every line reads as it should. Tap any word to hear it, or any paragraph to change it.');
  else if (c.state === 'none') box('<b>Suggestions are not available on this Mac.</b> ' + esc(error || 'Tap any word to hear it, or any paragraph to change it.'));
  else if (c.stale) box('<b>The transcript was changed somewhere else since these suggestions were made.</b> They may not match every line.', B('Make new suggestions', '', async () => { state = await request('/suggest', { again: true }); render(); setTimeout(poll, 4000); }));
}

/* One line's words as spans that know when they were said; without word times, the line's start stands in. */
function wordsHTML(s) {
  const words = s.shown.split(/\s+/).filter(Boolean), times = s.words && s.words.length === words.length ? s.words : null;
  return words.map((w, k) => '<span class="w" data-t="' + (times ? times[k][0] : s.start) + '">' + esc(w) + '</span>').join(' ');
}

function render() {
  if (!state) return;
  if (open) open = state.problems.find((p) => p.id === open.id) || null;
  const ps = state.problems, left = openProblems(), easy = left.filter((p) => p.tier !== 'ear');
  const total = state.segments.length, touched = ps.reduce((a, p) => a + p.indexes.length, 0);
  $('fill').style.width = ps.length ? ((ps.length - left.length) / ps.length * 100) + '%' : '0';
  $('left').textContent = state.check.state !== 'ready' ? total + ' lines' : left.length ? left.length + ' left · ' + (total - touched) + ' of ' + total + ' lines need nothing' : 'All checked';
  $('next').style.visibility = left.length ? 'visible' : 'hidden';
  renderNotice();
  const e = $('easy'); e.innerHTML = '';
  if (easy.length) {
    const box = document.createElement('div'); box.className = 'easy';
    const s = easy.filter((p) => p.tier === 'sure').length, n = easy.filter((p) => p.tier === 'notyou').length;
    box.innerHTML = '<div class="t"><b>' + easy.length + ' easy ones ready.</b> Clear fixes, and lines from the room or invented in silence.<div class="dots">' + (s ? '<span class="dot sure">' + s + ' sure</span>' : '') + (n ? '<span class="dot notyou">' + n + ' not you</span>' : '') + '</div></div>';
    box.append(B('Apply all', open || editing !== null ? '' : 'main', applyEasy)); e.append(box);
  }
  const owner = new Map(ps.flatMap((p) => p.indexes.map((i) => [i, p])));
  const out = new Set(state.leftOut);
  const text = $('text'); text.innerHTML = '';
  state.paragraphs.forEach((indexes, k) => {
    if (editing === k) { text.append(editor(k)); return; }
    let html = '';
    for (const i of indexes) {
      const s = state.segments[i], p = owner.get(i);
      if (!p) { if (!out.has(i)) html += wordsHTML(s) + ' '; continue; }
      if (p.indexes[0] !== i) continue;
      const said = (p.decision ? DONE[p.decision.action] : NAME[p.tier]) + ': ' + heard(p);
      html += '<span class="m ' + (p.decision ? p.decision.action : p.tier) + (p === open ? ' focus' : '') + '" data-id="' + p.id + '" role="button" tabindex="0" aria-label="' + esc(said) + '">' + esc(heard(p)) + '</span> ';
    }
    if (!html.trim()) return;
    const el = document.createElement('p'); el.className = 'para' + (active === k ? ' active' : ''); el.dataset.p = k; el.innerHTML = html; text.append(el);
    if (active === k && !open) {
      const row = document.createElement('div'); row.className = 'para-row';
      const first = state.segments[indexes[0]], lastSeg = state.segments[indexes.at(-1)];
      const hb = B('<span class="tri"></span>Hear this paragraph', 'small', () => play(first.start, lastSeg.end, hb));
      row.append(B('Edit this paragraph', 'small edit', () => { editing = k; open = null; render(); const ta = text.querySelector('textarea'); ta?.focus(); }), hb);
      text.append(row);
    }
    if (open && indexes.includes(open.indexes[0])) text.append(card(open));
    const next = state.paragraphs[k + 1];
    if (next) {
      const gap = state.segments[next[0]].start - state.segments[indexes.at(-1)].end;
      if (gap >= 15) { const d = document.createElement('div'); d.className = 'quiet'; d.innerHTML = '<span>' + Math.round(gap) + ' seconds quiet</span>'; const qb = B('<span class="tri"></span>Hear', '', () => play(state.segments[indexes.at(-1)].end, state.segments[next[0]].start, qb)); d.append(qb); text.append(d); }
    }
  });
  wordIndex = [...text.querySelectorAll('.w')].map((el) => [Number(el.dataset.t), el]).sort((a, b) => a[0] - b[0]);
  $('finish').classList.toggle('on', state.check.state === 'ready' && !left.length && ps.length > 0);
}

/* The whole paragraph as plain text to type into. Saving sends it as it reads; the server places each word. */
function editor(k) {
  const indexes = state.paragraphs[k], out = new Set(state.leftOut);
  const value = indexes.filter((i) => !out.has(i)).map((i) => state.segments[i].shown).join(' ');
  const box = document.createElement('div'); box.className = 'editor';
  const ta = document.createElement('textarea'); ta.value = value; ta.setAttribute('aria-label', 'This paragraph, to change');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.addEventListener('input', grow); requestAnimationFrame(grow);
  const errBox = document.createElement('div'); errBox.className = 'err';
  const first = state.segments[indexes[0]], lastSeg = state.segments[indexes.at(-1)];
  const acts = document.createElement('div'); acts.className = 'acts';
  acts.append(B('Save', 'main', async () => {
    if (busy) return; busy = true;
    try {
      const result = await request('/edit', { indexes, text: ta.value, expected: state.expected });
      state = result; editing = null; render();
      if (result.lastEdit) showToast('Saved', { editId: result.lastEdit });
    } catch (e) { errBox.textContent = e.message; }
    finally { busy = false; }
  }));
  const row = document.createElement('div'); row.className = 'row';
  const hb = B('<span class="tri"></span>Hear', 'hear', () => play(first.start, lastSeg.end, hb));
  row.append(hb, B('Back 5s', '', () => { audio.currentTime = Math.max(0, audio.currentTime - 5); if (audio.paused) audio.play().catch(() => {}); }), B('Cancel', '', () => { editing = null; render(); }));
  acts.append(row);
  box.append(ta, errBox, acts);
  return box;
}

function decidedCard(p) {
  const c = document.createElement('div'); c.className = 'card decided';
  c.innerHTML = '<div class="head"><span class="chip ' + p.tier + '">' + NAME[p.tier] + '</span><span>' + DONE[p.decision.action] + '</span></div><div class="fix">' + esc(heard(p)) + '</div>';
  const acts = document.createElement('div'); acts.className = 'acts'; const row = document.createElement('div'); row.className = 'row';
  const errBox = document.createElement('div'); errBox.className = 'err';
  const [from, to] = around(p); const h = B('<span class="tri"></span>Hear', 'hear', () => play(from, to, h));
  row.append(h, B('Undo', 'undo', () => undo(p.id, errBox)), B('Close', '', () => { open = null; render(); }));
  for (const n of p.decision.names || []) {
    const line = document.createElement('div'); line.className = 'learn';
    if (n.remembered) line.innerHTML = '<span>' + esc(n.spelling) + ' is remembered for the next recordings.</span>';
    else { line.innerHTML = '<span>Spell <b>' + esc(n.spelling) + '</b> this way in every recording from now on?</span>'; line.append(B('Remember ' + esc(n.spelling), 'small', () => remember(p.id, n.spelling, errBox))); }
    c.append(line);
  }
  acts.append(row); c.append(errBox, acts); return c;
}

async function undo(id, errBox) {
  if (busy) return; busy = true;
  try { state = await request('/undo', { problemId: id, expected: state.expected }); open = state.problems.find((p) => p.id === id) || null; hideToast(); render(); focus(); }
  catch (e) { if (errBox) errBox.textContent = e.message; else showToast(e.message); }
  finally { busy = false; }
}
async function undoEdit(editId) {
  if (busy) return; busy = true;
  try { state = await request('/undo-edit', { editId, expected: state.expected }); hideToast(); render(); }
  catch (e) { showToast(e.message); }
  finally { busy = false; }
}
async function remember(id, spelling, errBox) {
  if (busy) return; busy = true;
  try { state = await request('/remember', { problemId: id, spelling }); showToast(spelling + ' is remembered for the next recordings'); render(); }
  catch (e) { if (errBox) errBox.textContent = e.message; else showToast(e.message); }
  finally { busy = false; }
}
function showToast(text, { undoId = null, learn = null, editId = null } = {}) {
  const t = $('toast'); t.innerHTML = '<span>' + esc(text) + '</span>';
  if (learn) t.append(B('Remember ' + esc(learn.spelling), 'small', () => remember(learn.id, learn.spelling, null)));
  if (undoId) t.append(B('Undo', 'small', () => undo(undoId, null)));
  if (editId) t.append(B('Undo', 'small', () => undoEdit(editId)));
  t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 7000);
}
function hideToast() { $('toast').classList.remove('on'); }

function card(p) {
  if (p.decision) return decidedCard(p);
  const c = document.createElement('div'); c.className = 'card';
  const order = state.problems.filter((x) => !x.decision), at = order.indexOf(p) + 1;
  c.innerHTML = '<div class="head"><span class="chip ' + p.tier + '">' + NAME[p.tier] + '</span><span>' + (at ? at + ' of ' + order.length + ' · ' : '') + mmss(state.segments[p.indexes[0]].start) + '</span></div><div class="heard">' + esc(heard(p)) + '</div>';
  const fix = document.createElement('div'); fix.className = 'fix';
  const typing = p.tier !== 'notyou' && !p.fixes;
  if (p.tier === 'notyou') { fix.textContent = 'Leave this out of the talk'; fix.classList.add('leave'); }
  else for (const i of p.indexes) { const line = document.createElement('span'); line.className = 'line'; line.dataset.index = i; line.textContent = fixFor(p, i); if (typing) line.contentEditable = 'true'; fix.append(line); fix.append(document.createTextNode(' ')); }
  const why = document.createElement('div'); why.className = 'why'; why.textContent = p.reason;
  const acts = document.createElement('div'); acts.className = 'acts';
  const errBox = document.createElement('div'); errBox.className = 'err';
  const go = () => { open = nextOpen(); render(); focus(); if (open && open.tier === 'ear' && heardOnce) { const [a, b] = around(open); play(a, b, document.querySelector('.card .hear')); } };
  const decide = async (action) => {
    if (busy) return; busy = true;
    const body = { problemId: p.id, action, expected: state.expected };
    if (action === 'use' && p.tier !== 'notyou') body.fixes = [...fix.querySelectorAll('.line')].map((l) => ({ index: Number(l.dataset.index), text: l.textContent.trim() })).filter((f) => f.text);
    try { state = await request('/decide', body); last = p.id; const done = state.problems.find((x) => x.id === p.id); const name = (done?.decision?.names || []).find((n) => !n.remembered); showToast(action === 'use' ? 'Used' : action === 'keep' ? 'Kept as you said it' : 'Left out of the talk', { undoId: p.id, learn: name ? { id: p.id, spelling: name.spelling } : null }); go(); }
    catch (e) { errBox.textContent = e.message; }
    finally { busy = false; }
  };
  acts.append(B(p.tier === 'notyou' ? 'Leave it out' : typing ? 'Save my words' : 'Use this', 'main', () => decide(p.tier === 'notyou' ? 'leave' : 'use')));
  const row = document.createElement('div'); row.className = 'row';
  const [from, to] = around(p); const h = B('<span class="tri"></span>Hear', 'hear', () => play(from, to, h)); row.append(h);
  row.append(p.tier !== 'notyou' ? B('Edit', '', () => { const k = state.paragraphs.findIndex((ix) => ix.includes(p.indexes[0])); editing = k; open = null; render(); document.querySelector('.editor textarea')?.focus(); }) : B('Close', '', () => { open = null; render(); }));
  row.append(B(p.tier === 'notyou' ? 'It is me' : 'Keep mine', 'keep', () => decide('keep')));
  acts.append(row);
  c.append(fix, why, errBox, acts);
  return c;
}

async function applyEasy() {
  if (busy) return; busy = true;
  try {
    if (openProblems().some((p) => p.tier === 'sure')) state = await request('/decide-group', { tier: 'sure', expected: state.expected });
    if (openProblems().some((p) => p.tier === 'notyou')) state = await request('/decide-group', { tier: 'notyou', expected: state.expected });
    if (open && open.decision) open = null;
    render();
    const named = state.problems.flatMap((p) => (p.decision?.group && p.decision.names ? p.decision.names.filter((n) => !n.remembered).map((n) => ({ id: p.id, spelling: n.spelling })) : []));
    if (named.length) showToast('Easy ones applied', { learn: named[0] });
  } catch (e) { $('notice').insertAdjacentHTML('afterbegin', '<div class="notice"><b>Those could not be applied.</b> ' + esc(e.message) + '</div>'); }
  finally { busy = false; }
}

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
function focus() { const el = document.querySelector('.card'); if (el) { el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); el.querySelector('.btn.main, .undo')?.focus({ preventScroll: true }); } }
$('text').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('m')) { e.preventDefault(); e.stopPropagation(); e.target.click(); } });
$('text').addEventListener('click', (e) => {
  const m = e.target.closest('.m');
  if (m) { const p = state.problems.find((x) => x.id === m.dataset.id); if (!p) return; open = p; editing = null; render(); focus(); return; }
  const w = e.target.closest('.w');
  if (w) { const para = w.closest('.para'); const k = Number(para?.dataset.p); open = null; if (active !== k) { active = k; render(); } play(Number(w.dataset.t), null, null); }
});
$('next').onclick = () => { open = nextOpen(); editing = null; render(); focus(); };
/* Keys for a keyboard, ignored while typing: Enter does the gold action, H hears, K keeps, N goes to the next, Z undoes the last, Esc closes, Space plays or pauses. */
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const cardEl = document.querySelector('.card'), click = (sel) => { const b = cardEl?.querySelector(sel); if (b) { e.preventDefault(); b.click(); } };
  const key = e.key.toLowerCase();
  if (key === 'enter') click('.btn.main');
  else if (key === 'h') click('.hear');
  else if (key === 'k') click('.keep');
  else if (key === 'n') { e.preventDefault(); $('next').click(); }
  else if (key === 'z' && last) { e.preventDefault(); undo(last, null); }
  else if (key === ' ' && !e.target.closest?.('button')) { e.preventDefault(); $('play').click(); }
  else if (key === 'escape') { if (editing !== null) { editing = null; render(); } else if (open) { open = null; render(); } }
});
load();
