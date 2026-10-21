// The magazine's live board, read from the files. A line-for-line port of ~/builds/mag-status.mjs
// (2026-10-21) with its folders passed in rather than read from mag-intake.config, so the same board
// comes from AR Create (magazine.board) and from the script; tests/magazine-board.test.mjs holds them
// to the same output on a synthetic vault. It never writes.
import fs from 'node:fs';
import path from 'node:path';
import {listAsks} from '../../reference/mag-ask.mjs';

export const STEPS = {1: 'Dropped in', 2: 'Source', 3: 'Map', 4: 'Your pick', 5: 'Draft', 6: 'Your read',
  7: 'Your changes in, checked', 8: 'Photos in the folder', 9: 'Photos placed', 10: 'Your look, then publish',
  11: 'Feedback sent', 12: 'Confirmed'};
export const WHO = {1: 'you', 2: 'me', 3: 'me', 4: 'you', 5: 'me', 6: 'you', 7: 'me', 8: 'you', 9: 'me', 10: 'you', 11: 'you', 12: 'me'};
const IMG = /\.(jpe?g|png|heic|webp|tiff?)$/i;

/** What waits in the drop folders (mag-config.mjs dropped(), same rules). */
export function dropped(drops) {
  const out = [];
  for (const dir of drops) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (n === '.DS_Store') continue;
      const m = n.match(/^\.(.+)\.icloud$/);
      if (m) out.push({name: m[1], path: path.join(dir, m[1]), folder: dir, downloading: true});
      else if (!n.startsWith('.') && !n.endsWith('.part')) out.push({name: n, path: path.join(dir, n), folder: dir, downloading: false});
    }
  }
  return out;
}

export function readBoard({vault, files = '', drops = [], previewPort = 8766}) {
  const MAG = vault, W = path.join(MAG, 'Workflow');
  const list = dir => { try { return fs.readdirSync(path.join(W, dir)).filter(f => f.endsWith('.md')); } catch { return []; } };
  const front = file => { try { const t = fs.readFileSync(file, 'utf8'); const m = t.match(/^---\n([\s\S]*?)\n---/); return {text: t, fm: m ? m[1] : ''}; } catch { return {text: '', fm: ''}; } };
  const aliases = fm => {
    const out = [];
    const block = fm.match(/^aliases:\s*\n((?:\s+-.*\n?)+)/m);
    if (block) for (const l of block[1].split('\n')) { const v = l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim(); if (v) out.push(v); }
    const inline = fm.match(/^aliases:\s*\[(.*)\]/m);
    if (inline) out.push(...inline[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean));
    const story = fm.match(/^story:\s*(.+)$/m);
    if (story) out.push(story[1].trim());
    return out;
  };
  const lead = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
  const titleOf = (f, kind) => f.replace(new RegExp(`^${kind} - `), '').replace(/\.md$/, '');
  const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
  const day = ms => ms ? new Date(ms).toISOString().slice(0, 10) : '';
  const PREVIEW = `http://localhost:${previewPort}`;
  const FILES = files;
  const albumLinked = story => fs.existsSync(path.join(FILES, story, 'album-link.txt'));
  const photoCount = story => { try { return fs.readdirSync(path.join(FILES, story, 'Photos')).filter(f => IMG.test(f)).length; } catch { return null; } };
  const urlPath = p => p.split('/').map(x => encodeURIComponent(x).replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16))).join('/');
  const errors = [];
  const asks = listAsks(MAG);
  const stories = list('1-Source').filter(f => f.startsWith('CONTEXT - ')).map(f => { const name = titleOf(f, 'CONTEXT'); return {name, key: lead(name), files: {CONTEXT: [f]}}; });
  for (const f of list('0-Inbox').filter(f => f.startsWith('RAW - '))) {
    const name = titleOf(f, 'RAW');
    if (!stories.some(s => lead(name) === s.key || lead(name).startsWith(s.key))) stories.push({name, key: lead(name), files: {}});
  }
  if (!stories.length) errors.push(`no CONTEXT files found under ${W}/1-Source`);
  const kinds = [['0-Inbox', 'RAW'], ['1-Source', 'SRC'], ['2-Guidance', 'MAP'], ['2-Guidance', 'PLANS'], ['3-Develop', 'DEV'], ['3-Develop', 'NOTES'], ['4-Review', 'CHECK'], ['6-Feedback', 'FEEDBACK']];
  const unmatched = [];
  for (const [dir, kind] of kinds) {
    for (const f of list(dir).filter(f => f.startsWith(`${kind} - `))) {
      const p = path.join(W, dir, f);
      const {fm} = front(p);
      const names = [titleOf(f, kind), ...aliases(fm)].map(lead);
      const s = stories.find(st => names.some(n => n === st.key || n.startsWith(st.key)));
      if (!s) { if (kind !== 'FEEDBACK') unmatched.push(`${dir}/${f}`); continue; }
      (s.files[kind] ||= []).push(f);
    }
  }
  for (const f of list('6-Feedback').filter(f => f.startsWith('FEEDBACK - ') && f !== 'FEEDBACK TEMPLATE.md')) {
    const t = lead(titleOf(f, 'FEEDBACK'));
    const s = stories.find(st => (st.files.DEV || []).some(d => lead(front(path.join(W, '3-Develop', d)).fm.match(/^title:\s*['"]?(.+?)['"]?$/m)?.[1] || '') === t));
    if (s) (s.files.FEEDBACK ||= []).push(f);
  }
  const statusText = front(path.join(MAG, 'STATUS.md')).text;
  const board = [];
  for (const s of stories) {
    const newest = (kind, dir) => (s.files[kind] || []).map(f => ({f, t: mtime(path.join(W, dir, f))})).sort((a, b) => b.t - a.t)[0];
    const dev = newest('DEV', '3-Develop'), check = newest('CHECK', '4-Review'), map = newest('MAP', '2-Guidance'), raw = newest('RAW', '0-Inbox');
    const devPath = dev && path.join(W, '3-Develop', dev.f);
    const devFm = devPath ? front(devPath) : {text: '', fm: ''};
    const published = (devFm.fm.match(/^published:\s*(\S+)/m) || [])[1] || (s.files.DEV || []).map(d => (front(path.join(W, '3-Develop', d)).fm.match(/^published:\s*(\S+)/m) || [])[1]).find(Boolean) || '';
    const unapproved = devFm.text ? (devFm.text.replace(/^---[\s\S]*?---/, '').match(/==[^=\n]+==/g) || []).length : 0;
    const youNotes = devFm.text ? (devFm.text.match(/%%you:/g) || []).length : 0;
    const mapText = map ? front(path.join(W, '2-Guidance', map.f)).text : '';
    const decisions = (mapText.split(/^## Adrian's decisions.*$/m)[1] || '').split(/^## /m)[0];
    const mapCreated = (mapText.match(/^created:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || (map ? day(map.t) : '');
    const devUpdated = (devFm.fm.match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || (dev ? day(dev.t) : '');
    const mapDecided = [...decisions.matchAll(/(\d{4}-\d{2}-\d{2})/g)].some(m => m[1] >= mapCreated);
    const mapAhead = map && (!dev || mapCreated > devUpdated);
    const parts = (s.files.DEV || []).map(d => ({d, part: (front(path.join(W, '3-Develop', d)).fm.match(/^part:\s*(\d+)/m) || [])[1]})).filter(x => x.part).sort((a, b) => a.part - b.part).map(x => `part ${x.part}: ${x.d}`);
    const ctxFm = front(path.join(W, '1-Source', (s.files.CONTEXT || [])[0] || '-')).fm;
    const rebuildDate = (ctxFm.match(/^rebuild:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || '';
    const rebuilding = rebuildDate && !(map && ((mapText.match(/^created:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || '') >= rebuildDate);
    const readingDate = (ctxFm.match(/^reading:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || '';
    const outForRead = readingDate && dev && devUpdated <= readingDate;
    let stage;
    if (rebuilding) stage = `rebuild since ${rebuildDate}, new map to make`;
    else if (published && (s.files.FEEDBACK || []).length) stage = 'live, feedback message filled';
    else if (published) stage = 'live, no feedback file yet';
    else if (raw && !(s.files.SRC || []).length) stage = 'RAW in Inbox, needs SRC';
    else if (mapAhead) stage = mapDecided ? 'map decided, next draft not written yet' : 'map, waiting on Adrian\'s pick';
    else if (outForRead) stage = `out for Adrian's read since ${readingDate}`;
    else if (dev && check && check.t >= dev.t) stage = 'draft checked';
    else if (dev) stage = 'draft';
    else if (map) stage = 'map';
    else if ((s.files.PLANS || []).length) stage = 'plans';
    else if ((s.files.SRC || []).length) stage = 'source, no map';
    else stage = 'context only';
    const step = stage.startsWith('live') ? 11 : stage === 'draft checked' || stage.startsWith('out for') ? 6 : stage === 'draft' ? 5
      : stage.startsWith('map decided') || stage === 'plans' ? 5 : stage.startsWith('map, waiting') ? 4
      : stage.startsWith('source') || stage.startsWith('rebuild') ? 3 : 2;
    const readFile = stage.startsWith('map, waiting') && map ? `Workflow/2-Guidance/${map.f}` : dev ? `Workflow/3-Develop/${dev.f}` : '';
    const read = readFile ? `${PREVIEW}/read/${urlPath(readFile)}` : '';
    const photos = photoCount(s.name), album = albumLinked(s.name), photosLink = `${PREVIEW}/photos/${urlPath(s.name)}`;
    const flags = [];
    if (dev && check && check.t < dev.t) flags.push(`newest draft (${day(dev.t)}) is newer than its newest check (${day(check.t)})`);
    if (unapproved) flags.push(`${unapproved} connecting line(s) still awaiting approval (==…==)`);
    if (!statusText.toLowerCase().includes(s.name.toLowerCase().split(' ').slice(0, 2).join(' '))) flags.push('not mentioned on STATUS.md');
    if (dev && !statusText.includes(dev.f.replace(/\.md$/, '')) && !published) flags.push(`STATUS.md does not name the newest draft "${dev.f.replace(/\.md$/, '')}"`);
    const ask = asks.find(a => lead(a.story) === s.key || lead(a.story).startsWith(s.key));
    const openQs = ask ? ask.questions.filter(q => q.open) : [];
    const answeredQs = ask ? ask.questions.filter(q => !q.open) : [];
    const who = openQs.length ? 'you' : answeredQs.length ? 'me' : WHO[step];
    board.push({story: s.name, step, stepName: STEPS[step], who, ask: ask ? ask.file : '', open: openQs.length,
      answered: answeredQs.map(q => q.title + ': ' + q.value), stage, read, photos, album, photosLink, newestDraft: dev ? `${dev.f} (${day(dev.t)})` : '', newestCheck: check ? `${check.f} (${day(check.t)})` : '',
      map: map ? `${map.f}${mapDecided ? ', decided' : ', no pick yet'}` : '', parts, published, youNotes, flags,
      // Added for AR Create (not in mag-status): the files each story owns, by kind.
      files: structuredClone(s.files)});
  }
  const inbox = list('0-Inbox').filter(f => f.startsWith('RAW - ') && !stories.some(s => (s.files.RAW || []).includes(f)));
  const drop = dropped(drops);
  return {board, inbox, drop, unmatched, errors, steps: STEPS, who: WHO};
}

/** The board as the same text mag-status.mjs prints (the date line aside). */
export function boardText(result, {date = new Date().toISOString().slice(0, 10)} = {}) {
  const lines = [`Magazine board, read from the files (${date}). STATUS.md holds the notes; this is the check on it.`];
  for (const e of result.errors) lines.push(`! ${e}`);
  for (const f of result.drop) lines.push(`! NEW in a drop folder (step 1 of 12, needs intake${f.downloading ? '; still downloading from iCloud, intake fetches it' : ''}): ${f.path}`);
  for (const f of result.inbox) lines.push(`! NEW RECORDING in the Inbox with no story yet: ${f}`);
  for (const b of result.board) {
    lines.push(`\n- ${b.story}: step ${b.step} of 12, ${b.stepName}, ${b.who} (${b.stage})${b.published ? ` (${b.published})` : ''}`);
    if (b.read) lines.push(`  read: ${b.read}`);
    lines.push(`  photos: ${b.photos === null ? 'no folder yet' : b.photos ? `${b.photos} in the folder` : 'none yet'}${b.album ? ', shared album linked (mag-photos pulls new ones)' : ''}, ${b.photosLink}`);
    if (b.newestDraft) lines.push(`  draft: ${b.newestDraft}${b.youNotes ? `, ${b.youNotes} note(s) for Adrian` : ''}`);
    if (b.newestCheck) lines.push(`  check: ${b.newestCheck}`);
    if (b.map) lines.push(`  map: ${b.map}`);
    for (const p of b.parts) lines.push(`  ${p}`);
    if (b.open) lines.push(`  ${b.open} question(s) waiting on Adrian on the magazine page (${b.ask})`);
    for (const a of b.answered) lines.push(`  ANSWERED on the page, act on it: ${a}`);
    for (const fl of b.flags) lines.push(`  ! ${fl}`);
  }
  if (result.unmatched.length) lines.push(`\nFiles that belong to no story (rename, or add the story's name to their aliases): ${result.unmatched.join('; ')}`);
  return lines.join('\n') + '\n';
}
