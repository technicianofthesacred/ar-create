// mag-edit — Adrian edits a draft right on its reading page: click a paragraph, change it, save.
// The page shows the words only; this file puts the marks back (the ==…== of a joining line, the
// "> " of a large line, glossary links, bold words, every %%…%% note), so his edit never breaks
// the draft. Each save is checked against the paragraph he saw (a hash), so a file that changed
// in the meantime is never overwritten, and every edit is logged for /mag to check the quotes.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Shared exact donor recognizer. URLs and unsuffixed paths are not inferred requests.
export const reworkSlashes=()=>/(^|[\s"'(])\/([^\/\n]+?)\/(?=$|[\s.,;:!?"')])/g;
export const editLogHeader=basename=>`---\ntype: Adrian's page edits\ndraft: ${basename}\n---\n\nAdrian's edits on the reading page. They are his and final: /mag runs the quote check after them and never undoes one. A \"rework\" line is words he wrapped in /slashes/: rewrite those words (keeping their meaning and the rules), then remove the mark.\n`;
const today = () => new Date().toISOString().slice(0, 10);
export const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

// Front matter, then the body split into blocks with their separators kept, so a rewrite
// changes nothing but the one block.
export function splitBlocks(md) {
  const fm = (md.match(/^---\n[\s\S]*?\n---\n/) || [''])[0];
  return { fm, parts: md.slice(fm.length).split(/(\n\s*\n)/) };
}

// The words of a block as a reader sees them: no notes, no marks.
export function plain(raw) {
  return raw
    .replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, '/$1/')
    .replace(/\s*%%[\s\S]*?%%/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,4}\s+/, '')
    .replace(/==([\s\S]*?)==/g, '$1')
    .replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

// Which blocks a reader may edit: paragraphs, large lines and headings, not notes, lists or tables.
export function editable(raw) {
  const t = raw.trim();
  if (!t || t === '---' || /^%%[\s\S]*%%$/.test(t) || /^\|/.test(t)) return false;
  if (/^[-*] /m.test(t) && t.split('\n').every(l => /^\s*([-*] |\d+\. )/.test(l) || /^\s+/.test(l))) return false;
  if (/^\*\*[^*]+:\*\*\s*$/m.test(t.split('\n')[0])) return false;
  return true;
}

// Recognition follows the held Magazine review helper: comments and code are not
// editorial proposals. Unlike its native editor, this plain-text API has no separate
// review decision, so pending words must survive unchanged and unambiguously.
const protectedMarks = /%%[\s\S]*?%%|<!--[\s\S]*?-->/g;
function pendingSpans(raw) {
  const masked = raw.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`/g, part => ' '.repeat(part.length));
  const spans = [...masked.matchAll(/==([\s\S]*?)==/g)].map(m => ({
    from: m.index, to: m.index + m[0].length, raw: raw.slice(m.index, m.index + m[0].length),
    words: plain(raw.slice(m.index + 2, m.index + m[0].length - 2)),
  }));
  // A broken/empty boundary must not be mistaken for accepted prose.
  if (masked.replace(/==([\s\S]*?)==/g, '').includes('==') || spans.some(span => !span.words))
    throw new Error('This pending review boundary cannot be edited safely; review it separately first.');
  return spans;
}
function uniquePosition(text, words) {
  const i = text.indexOf(words);
  return i >= 0 && text.indexOf(words, i + 1) < 0 ? i : -1;
}
function protectPending(raw, text) {
  const spans = pendingSpans(raw);
  if (!spans.length) return { text, formatting: raw, restore: s => s };
  if (text.includes('==') || text.includes('\0'))
    throw new Error('Pending review marks cannot be changed through a prose edit; review separately first.');
  const before = plain(raw);
  let lastBefore = 0, lastAfter = 0;
  const ranges = spans.map((span, i) => {
    const oldAt = uniquePosition(before, span.words), at = uniquePosition(text, span.words);
    if (oldAt < lastBefore || at < lastAfter)
      throw new Error('Pending wording changed, was removed, or is ambiguous; review it separately first.');
    lastBefore = oldAt + span.words.length;
    lastAfter = at + span.words.length;
    return { ...span, at, token: '\0' + '\x01'.repeat(i + 1) + '\0' };
  });
  // Shield the original proposal bytes from the donor's formatting/rework passes.
  let shielded = text, formatting = raw;
  for (const span of [...ranges].reverse()) {
    shielded = shielded.slice(0, span.at) + span.token + shielded.slice(span.at + span.words.length);
    formatting = formatting.slice(0, span.from) + span.token + formatting.slice(span.to);
  }
  return { text: shielded, formatting, restore: s => {
    for (const span of ranges) {
      if (uniquePosition(s, span.token) < 0) throw new Error('Pending review boundary could not be restored safely; nothing was saved.');
      s = s.replace(span.token, () => span.raw);
    }
    return s;
  }};
}

// Put the marks back around his new words.
function rebuild(raw, text) {
  const t = raw.trim().replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, '$1');
  const notes = (t.match(protectedMarks) || []);
  const bare = t.replace(protectedMarks, '').trim();
  const pending = protectPending(bare, text.trim().replace(/\r/g, ''));
  const formatting = pending.formatting;
  let s = pending.text;
  // Glossary links and bold words he kept: wrap them again, first place each one appears.
  for (const m of formatting.matchAll(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g)) {
    const i = s.indexOf(m[2]); if (i >= 0) s = s.slice(0, i) + `[[term:${m[1]}|${m[2]}]]` + s.slice(i + m[2].length);
  }
  for (const m of formatting.matchAll(/\*\*([^*]+)\*\*/g)) {
    const i = s.indexOf(m[1]); if (i >= 0 && !/\[\[term:[^\]]*$/.test(s.slice(0, i))) s = s.slice(0, i) + `**${m[1]}**` + s.slice(i + m[1].length);
  }
  const head = bare.match(/^(#{1,4})\s+/);
  if (head) s = head[1] + ' ' + s.replace(/\n+/g, ' ');
  if (bare.startsWith('>')) s = s.split('\n').map(l => '> ' + l).join('\n');
  s = pending.restore(s);
  return notes.length ? s + ' ' + notes.join(' ') : s;
}

// Save one edit. `index` is the block's place in the body; `seen` is the hash of the block he saw.
export function edit(mag, file, index, seen, text) {
  const abs = path.resolve(mag, file);
  // A draft, or Adrian's own context note (his opening and close), 2026-10-05.
  const isDraft = abs.startsWith(path.resolve(mag, 'Workflow/3-Develop') + path.sep) && path.basename(abs).startsWith('DEV - ');
  const isContext = abs.startsWith(path.resolve(mag, 'Workflow/1-Source') + path.sep) && path.basename(abs).startsWith('CONTEXT - ');
  const isMessage = abs.startsWith(path.resolve(mag, 'Workflow/6-Feedback') + path.sep) && path.basename(abs).startsWith('FEEDBACK - ');
  if (!(isDraft || isContext || isMessage) || !abs.endsWith('.md')) throw new Error('only a draft or your context note can be edited here');
  const md = fs.readFileSync(abs, 'utf8');
  const { fm, parts } = splitBlocks(md);
  const k = index * 2;
  if (!Number.isInteger(index) || k < 0 || k >= parts.length) throw new Error('that paragraph is gone; reload the page');
  const raw = parts[k];
  if (hash(raw) !== seen) throw new Error('the draft changed since you opened it; reload the page and try again');
  if (!editable(raw)) throw new Error('that part cannot be edited here');
  const before = plain(raw);
  const after = String(text || '').trim();
  // Words he wraps in slashes, /like this/, stay in place and are marked for Claude to rework.
  const slashes = reworkSlashes();
  const reworks = [...after.matchAll(slashes)].map(m => m[2]).filter(r => !before.includes('/' + r + '/'));
  const marked = after.replace(slashes, (m, pre, seg) => `${pre}%%rework%%${seg}%%/rework%%`);
  if (after === before) return { changed: false };
  if (!after) {
    if (pendingSpans(raw).length) throw new Error('Pending wording cannot be removed through a prose edit; review it separately first.');
    // Removed: drop the block and one separator next to it.
    if (k + 1 < parts.length) parts.splice(k, 2); else if (k > 0) parts.splice(k - 1, 2); else parts.splice(k, 1);
  } else {
    const t = raw.trim(), i = raw.indexOf(t);
    parts[k] = raw.slice(0, i) + rebuild(raw, marked) + raw.slice(i + t.length);
  }
  fs.writeFileSync(abs, fm + parts.join(''));
  // The log /mag reads: his edits are final, and the quotes get checked again.
  const log = path.join(mag, 'Workflow/4-Review', 'EDITS - ' + path.basename(abs));
  const entry = `\n## ${today()}\n- before: ${before.replace(/\n/g, ' ')}\n- after: ${after ? after.replace(/\n/g, ' ') : '(removed)'}\n` + reworks.map(r => `- rework: ${r}\n`).join('');
  if (!fs.existsSync(log)) fs.writeFileSync(log, editLogHeader(path.basename(abs)));
  fs.appendFileSync(log, entry);
  return { changed: true, removed: !after, raw: after ? parts[k] : '' };
}
