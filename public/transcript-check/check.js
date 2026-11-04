// The transcript check screen. Reads /api/transcript-check/<jobId>; every decision is Adrian's tap on this page and
// goes back through the server, which writes corrections through the recording's own correction boundary.
const job = new URLSearchParams(location.search).get('job') || '';
const api = '/api/transcript-check/' + encodeURIComponent(job);
const $ = (id) => document.getElementById(id);
const audio = $('audio');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const NAME = { ear: 'Needs your ear', sure: 'Sure fix', notyou: 'Probably not you' };
const KEEP_CAP = /^(I\b|I'm|I've|I'll|I'd)/;

let state = null, open = null, stopAt = null, playing = null, heardOnce = false, busy = false, error = null;

audio.addEventListener('timeupdate', () => { if (stopAt !== null && audio.currentTime >= stopAt) { audio.pause(); stopAt = null; } });
audio.addEventListener('pause', () => { if (playing) { playing.classList.remove('playing'); playing = null; } });
function play(from, to, btn) {
  if (playing) playing.classList.remove('playing');
  audio.currentTime = Math.max(0, from - 1); stopAt = to + 1; audio.play().catch(() => {});
  if (btn) { btn.classList.add('playing'); playing = btn; }
  heardOnce = true;
}
const B = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.innerHTML = label; b.onclick = fn; return b; };

async function request(path, body) {
  const res = await fetch(api + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const value = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(value.error || 'Something went wrong. Nothing was changed.');
  return value;
}

/* Paragraphs split where the speaker paused for more than four seconds; a line that carries on the one before loses
   its capital, and a trailing "..." before it goes. Display only: the saved transcript is never touched by this. */
function paragraphs(segments) {
  const out = []; let cur = [];
  segments.forEach((s, i) => { if (cur.length && s.start - segments[i - 1].end > 4) { out.push(cur); cur = []; } cur.push({ ...s, show: s.text.trim() }); });
  if (cur.length) out.push(cur);
  for (const para of out) para.forEach((s, k) => {
    if (k === 0) { s.show = s.show.charAt(0).toUpperCase() + s.show.slice(1); return; }
    const prev = para[k - 1], openPrev = prev.text.trim().endsWith('...') || !/[.?!]$/.test(prev.text.trim());
    if (openPrev) { if (prev.show.endsWith('...')) prev.show = prev.show.slice(0, -3); if (!KEEP_CAP.test(s.show)) s.show = s.show.charAt(0).toLowerCase() + s.show.slice(1); }
  });
  return out;
}

const heard = (p) => p.indexes.map((i) => state.segments[i].text.trim()).join(' ');
const fixFor = (p, i) => (p.fixes || []).find((f) => f.index === i)?.text ?? state.segments[i].text.trim();
const stateOf = (p) => p.decision ? p.decision.action : 'open';
const openProblems = () => state.problems.filter((p) => !p.decision);

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
  if (c.state === 'running') box('<b>Reading your talk for anything that needs a look.</b> Usually about a minute. You can read the transcript meanwhile.');
  else if (c.state === 'failed') box('<b>The suggestions did not come through.</b> ' + esc(c.error || ''), B('Try again', 'main', async () => { state = await request('/suggest', { again: true }); render(); setTimeout(poll, 4000); }));
  else if (c.state === 'none') box('<b>Suggestions are not available on this Mac.</b> ' + esc(error || 'The transcript is below to read.'));
  else if (c.stale) box('<b>The transcript was changed somewhere else since these suggestions were made.</b> They may not match every line.', B('Make new suggestions', '', async () => { state = await request('/suggest', { again: true }); render(); setTimeout(poll, 4000); }));
}

function render() {
  if (!state) return;
  if (open) open = state.problems.find((p) => p.id === open.id && !p.decision) || null;
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
    box.append(B('Apply all', open ? '' : 'main', applyEasy)); e.append(box);
  }
  const owner = new Map(ps.flatMap((p) => p.indexes.map((i) => [i, p])));
  const text = $('text'); text.innerHTML = '';
  const paras = paragraphs(state.segments);
  paras.forEach((para, k) => {
    let html = '', acc = [];
    const flush = () => { if (acc.length) { html += esc(acc.join(' ')) + ' '; acc = []; } };
    for (const s of para) {
      const p = owner.get(s.index);
      if (!p) { acc.push(s.show); continue; }
      if (p.indexes[0] !== s.index) continue;
      flush();
      html += '<span class="m ' + (p.decision ? p.decision.action : p.tier) + (p === open ? ' focus' : '') + '" data-id="' + p.id + '">' + esc(heard(p)) + '</span> ';
    }
    flush();
    if (!html.trim()) return;
    const el = document.createElement('p'); el.innerHTML = html; text.append(el);
    if (open && para.some((s) => s.index === open.indexes[0])) text.append(card(open));
    const next = paras[k + 1];
    if (next) { const gap = next[0].start - para.at(-1).end; if (gap >= 15) { const d = document.createElement('div'); d.className = 'quiet'; d.innerHTML = '<span>' + Math.round(gap) + ' seconds quiet</span>'; const hb = B('<span class="tri"></span>Hear', '', () => play(para.at(-1).end, next[0].start, hb)); d.append(hb); text.append(d); } }
  });
  $('finish').classList.toggle('on', state.check.state === 'ready' && !left.length && ps.length > 0);
}

function card(p) {
  const c = document.createElement('div'); c.className = 'card';
  const start = state.segments[p.indexes[0]].start, end = state.segments[p.indexes.at(-1)].end;
  c.innerHTML = '<div class="head"><span class="chip ' + p.tier + '">' + NAME[p.tier] + '</span><span>' + mmss(start) + '</span></div><div class="heard">' + esc(heard(p)) + '</div>';
  const fix = document.createElement('div'); fix.className = 'fix';
  const editing = p.tier !== 'notyou' && !p.fixes;
  if (p.tier === 'notyou') { fix.textContent = 'Leave this out of the talk'; fix.classList.add('leave'); }
  else for (const i of p.indexes) { const line = document.createElement('span'); line.className = 'line'; line.dataset.index = i; line.textContent = fixFor(p, i); if (editing) line.contentEditable = 'true'; fix.append(line); fix.append(document.createTextNode(' ')); }
  const why = document.createElement('div'); why.className = 'why'; why.textContent = p.reason;
  const acts = document.createElement('div'); acts.className = 'acts';
  const errBox = document.createElement('div'); errBox.className = 'err';
  const go = () => { open = nextOpen(); render(); focus(); if (open && open.tier === 'ear' && heardOnce) play(state.segments[open.indexes[0]].start, state.segments[open.indexes.at(-1)].end, document.querySelector('.card .hear')); };
  const decide = async (action) => {
    if (busy) return; busy = true;
    const body = { problemId: p.id, action, expected: state.expected };
    if (action === 'use' && p.tier !== 'notyou') body.fixes = [...fix.querySelectorAll('.line')].map((l) => ({ index: Number(l.dataset.index), text: l.textContent.trim() })).filter((f) => f.text);
    try { state = await request('/decide', body); go(); }
    catch (e) { errBox.textContent = e.message; }
    finally { busy = false; }
  };
  acts.append(B(p.tier === 'notyou' ? 'Leave it out' : editing ? 'Save my words' : 'Use this', 'main', () => decide(p.tier === 'notyou' ? 'leave' : 'use')));
  const row = document.createElement('div'); row.className = 'row';
  const h = B('<span class="tri"></span>Hear', 'hear', () => play(start, end, h)); row.append(h);
  row.append(p.tier !== 'notyou' && p.fixes ? B('Change', '', () => { const first = fix.querySelector('.line'); fix.querySelectorAll('.line').forEach((l) => { l.contentEditable = 'true'; }); first?.focus(); }) : B('Close', '', () => { open = null; render(); }));
  row.append(B(p.tier === 'notyou' ? 'It is me' : 'Keep mine', '', () => decide('keep')));
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
  } catch (e) { $('notice').insertAdjacentHTML('afterbegin', '<div class="notice"><b>Those could not be applied.</b> ' + esc(e.message) + '</div>'); }
  finally { busy = false; }
}

function focus() { const el = document.querySelector('.card'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
$('text').addEventListener('click', (e) => { const m = e.target.closest('.m'); if (!m) return; const p = state.problems.find((x) => x.id === m.dataset.id); if (!p || p.decision) return; open = p; render(); focus(); });
$('next').onclick = () => { open = nextOpen(); render(); focus(); };
load();
