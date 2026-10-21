// Stories as AR Create projects (D1: the bytes stay in the vault; AR Create keeps the index).
//
// project = one magazine story: {storyId, name, number, brandId:'teajia', origin:{kind:'magazine',
//   story, number}, archived, vaultRecords:{raw, src, context, research, brief, notes, map, plans, ask,
//   draft, edits, checks[], feedback, social[], ...}, pieces:[{pieceId, kind, rel, part?}]}
// Every vault record is {rel, sha256} as last seen. The index lives in <data>/magazine/.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {StateError} from '../../store.mjs';
import {readBoard} from './board.mjs';
import {classify, frontmatter, storyId} from './kinds.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lead = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
export const INDEX_SCHEMA = 'ar-create.magazine-index.v1', PROJECT_SCHEMA = 'ar-create.magazine-project.v1';
export const DEFAULT_ARCHIVED = Object.freeze(['UI-flow-part-01', 'UI-flow-part-02']);
const RECORD = {RAW: 'raw', SRC: 'src', CONTEXT: 'context', MOMENTS: 'moments', RESEARCH: 'research', BRIEF: 'brief', NOTES: 'notes', READ: 'read', MAP: 'map', PLANS: 'plans', ASK: 'ask', DEV: 'draft', EDITS: 'edits', CHECK: 'checks', SENSE: 'sense', FEEDBACK: 'feedback', SOCIAL: 'social'};
const MANY = new Set(['checks', 'social', 'notes', 'edits', 'src', 'draft', 'sense', 'research', 'brief', 'read', 'moments', 'plans', 'map']);

/** STATUS.md story entries: "**[N] Name: Title**". */
export function statusEntries(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) { const m = line.match(/^(?:-\s*)?\*\*\[(\d+)\]\s*(.+?)\*\*/); if (m) out.push({number: Number(m[1]), name: m[2].split(':')[0].trim(), heading: m[2].trim()}); }
  return out;
}

/** Every file under MAG with its kind (or null), story guess and hash. Never returns body text. */
export function scanVault(vault) {
  const files = [];
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(vault, rel), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const r = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { walk(r); continue; }
      if (!entry.isFile()) { files.push({rel: r, kind: null, class: null, note: 'not a regular file'}); continue; }
      const bytes = fs.readFileSync(path.join(vault, r));
      let kind = null, cls = null; try { const c = classify(r); kind = c.kind; cls = c.class; } catch {}
      let meta = {}, keys = [], parse = 'ok';
      if (/\.md$/.test(r)) { try { const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); const fm = frontmatter(text); meta = fm.meta; keys = fm.keys; } catch { parse = 'not-utf8'; } }
      files.push({rel: r, size: bytes.length, sha256: sha(bytes), kind, class: cls, archived: r.startsWith('_archive/'), frontmatterKeys: keys, story: meta.story || null, title: meta.title || null, part: meta.part || null, aliases: aliasesOf(bytes), parse});
    }
  };
  walk('');
  return files;
}
function aliasesOf(bytes) {
  const fm = bytes.toString('utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  const out = [];
  const block = fm.match(/^aliases:\s*\n((?:\s+-.*\n?)+)/m); if (block) for (const l of block[1].split('\n')) { const v = l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim(); if (v) out.push(v); }
  const inline = fm.match(/^aliases:\s*\[(.*)\]/m); if (inline) out.push(...inline[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean));
  return out;
}

/** The registration plan for every story on the board. Pure reading. */
export function planRegistration({vault, files = '', drops = [], archived = DEFAULT_ARCHIVED, brandId = 'teajia'} = {}) {
  const board = readBoard({vault, files, drops});
  const scanned = scanVault(vault);
  const byRel = new Map(scanned.map(f => [f.rel, f]));
  const statusText = fs.existsSync(path.join(vault, 'STATUS.md')) ? fs.readFileSync(path.join(vault, 'STATUS.md'), 'utf8') : '';
  const entries = statusEntries(statusText);
  const stories = board.board.map(b => ({b, key: lead(b.story)}));
  const owner = file => {
    if (!file.kind || file.archived || ['STATUS', 'ISSUE', 'EXPORT', 'REQUESTS', 'GLOSSARY', 'PAGE-FEEDBACK', 'RATINGS', 'IDEA', 'BLIND', 'WRITER-GUIDE'].includes(file.kind)) return null;
    const base = file.rel.split('/').pop().replace(/\.(md|txt)$/, '').replace(/^EDITS - /, '').replace(/^[A-Z]+ - /, '');
    const names = [base, file.story, file.title, ...(file.aliases || [])].filter(Boolean).map(lead);
    const hits = stories.filter(s => names.some(n => n === s.key || n.startsWith(s.key)));
    return hits.length === 1 ? hits[0].b.story : hits.length > 1 ? {ambiguous: hits.map(h => h.b.story)} : null;
  };
  const projects = new Map(stories.map(({b}) => [b.story, {schema: PROJECT_SCHEMA, storyId: storyId(b.story), name: b.story, number: null, brandId, origin: {kind: 'magazine', story: b.story, number: null}, archived: archived.includes(b.story), step: b.step, who: b.who, vaultRecords: {}, pieces: [], flags: []}]));
  const ambiguities = [], unassigned = [];
  for (const file of scanned) {
    const who = owner(file);
    if (!who) { if (file.kind && !file.archived && !['STATUS', 'ISSUE', 'EXPORT'].includes(file.kind) && file.class !== 'log' && !['REQUESTS', 'GLOSSARY', 'PAGE-FEEDBACK', 'RATINGS', 'IDEA', 'BLIND', 'WRITER-GUIDE'].includes(file.kind)) unassigned.push(file.rel); continue; }
    if (who.ambiguous) { ambiguities.push({rel: file.rel, reason: 'matches more than one story', stories: who.ambiguous}); continue; }
    const p = projects.get(who), key = RECORD[file.kind]; if (!key) continue;
    const record = {rel: file.rel, sha256: file.sha256};
    if (MANY.has(key)) (p.vaultRecords[key] ||= []).push(record); else if (p.vaultRecords[key]) { p.vaultRecords[key] = [].concat(p.vaultRecords[key], record); } else p.vaultRecords[key] = record;
  }
  for (const p of projects.values()) {
    const entry = entries.find(e => lead(e.name) === lead(p.name) || lead(p.name).startsWith(lead(e.name)));
    if (entry) { p.number = entry.number; p.origin.number = entry.number; } else if (!p.archived) p.flags.push('not numbered on STATUS.md');
    const drafts = (p.vaultRecords.draft || []).map(r => ({...r, part: byRel.get(r.rel)?.part || null}));
    const parts = drafts.filter(d => d.part), whole = drafts.filter(d => !d.part);
    if (whole.length > 1) ambiguities.push({story: p.name, reason: 'two or more whole drafts (DEV) for one story; tidy keeps the newest', files: whole.map(d => d.rel)});
    p.pieces = [...whole.slice(0, 1).map(d => ({pieceId: p.storyId + ':article', kind: 'article', rel: d.rel})), ...parts.map(d => ({pieceId: p.storyId + ':part-' + String(d.part).match(/^\d+/)?.[0], kind: 'article-part', part: d.part, rel: d.rel})), ...(p.vaultRecords.social || []).map((s, i) => ({pieceId: p.storyId + ':social-' + (i + 1), kind: 'social', rel: s.rel}))];
    if (!p.pieces.length) p.pieces.push({pieceId: p.storyId + ':article', kind: 'article', rel: null});
    const draftBases = drafts.map(d => d.rel.split('/').pop().replace(/^DEV - /, '').replace(/\.md$/, '').replace(/\s*\(.*$/, ''));
    for (const c of p.vaultRecords.checks || []) { const base = c.rel.split('/').pop().replace(/^CHECK - /, '').replace(/\.md$/, '').replace(/\s*\(.*$/, ''); if (draftBases.length && !draftBases.some(d => lead(d) === lead(base))) ambiguities.push({story: p.name, reason: 'a CHECK names a draft that is not current', file: c.rel}); }
  }
  return {schema: 'ar-create.magazine-registration-plan.v1', vault, files, stories: [...projects.values()].sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name)), ambiguities, unassigned, boardErrors: board.errors, unmatched: board.unmatched, scanned: scanned.length};
}

/** The registered index and projects in <data>/magazine (read side; the register tool writes them). */
export function createMagazineProjects({dataDir}) {
  const dir = path.join(dataDir, 'magazine');
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  function index() { const file = path.join(dir, 'index.json'); if (!fs.existsSync(file)) return null; const value = readJson(file); if (value.schema !== INDEX_SCHEMA) throw new StateError('The magazine index has an unknown shape.', 500); return value; }
  function project(id) {
    const i = index(); if (!i) throw new StateError('No magazine stories are registered yet (tools/magazine/register.mjs --apply).', 404);
    const row = i.stories.find(s => s.storyId === id || s.name === id); if (!row) throw new StateError('That story is not registered.', 404);
    return readJson(path.join(dir, 'projects', row.storyId + '.json'));
  }
  function byFile(rel) { const i = index(); if (!i) return null; for (const row of i.stories) { const p = readJson(path.join(dir, 'projects', row.storyId + '.json')); for (const value of Object.values(p.vaultRecords)) for (const r of [].concat(value)) if (r.rel === rel) return p; } return null; }
  return {
    index, project, byFile,
    list() { const i = index(); return {schema: 'ar-create.magazine-projects.v1', registered: !!i, stories: i ? i.stories.map(s => ({...s, ...(() => { const p = readJson(path.join(dir, 'projects', s.storyId + '.json')); return {pieces: p.pieces, origin: p.origin, brandId: p.brandId}; })()})) : []}; },
    /** Vault-bound guard for study-draft-copies: a registered story's DEV is edited in place, never copied. */
    vaultBound(source) {
      const draft = source?.records?.find(r => r.role === 'draft');
      const base = draft?.path ? path.basename(draft.path) : null; if (!base) return null;
      const i = index(); if (!i) return null;
      for (const row of i.stories) { const p = readJson(path.join(dir, 'projects', row.storyId + '.json')); if ([].concat(p.vaultRecords.draft || []).some(r => path.basename(r.rel) === base)) return `${p.name} is a registered magazine story: its draft is edited in place in the vault (magazine.edit), not in a working copy.`; }
      return null;
    },
  };
}
