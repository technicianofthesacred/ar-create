// Teajia magazine split check: lists neighbouring quotes in a draft that the transcript holds as one
// paragraph, so one thought of theirs is not set as two quotes (TEMPLATE, "Quotation marks: the rules").
// Usage: node ~/builds/mag-check-splits.mjs "<DEV>" "<SRC>"
import fs from 'fs';
import { articleBody, unsupportedLetters } from './mag-article-body.mjs';
const [dev, src] = process.argv.slice(2);
if (!dev || !src) { console.error('Usage: node mag-check-splits.mjs <DEV> <SRC>'); process.exit(2); }
const norm = (t) => t.replace(/\[\[term:[^|]*\|([^\]]*)\]\]/g, '$1').replace(/%%[^%]*%%/g, '').replace(/\*\*/g, '').replace(/[“”"]/g, '').replace(/[‘’']/g, "'").replace(/[—–-]/g, ' ').replace(/[_*…]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
const srcParas = fs.readFileSync(src, 'utf8').split(/\n\s*\n/).map(norm);
let body;
try { body = articleBody(fs.readFileSync(dev, 'utf8')); } catch (error) { console.error(`UNSUPPORTED: ${error.message}`); process.exit(2); }
const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
let prev = null, between = [];
let quotes = 0, compared = 0, splits = 0, unsupported = 0;
for (const b of blocks) {
  const isQuote = /^>?\s*(?:\*?["“])/.test(b);
  if (/[「」『』«»]/u.test(b)) { unsupported++; prev = null; between = []; continue; }
  if (isQuote) {
    quotes++;
    if (unsupportedLetters(b.replace(/%%[\s\S]*?%%/g, ''))) { unsupported++; prev = null; between = []; continue; }
    const t = norm(b.replace(/^>\s*/, ''));
    if (prev) {
      compared++;
      const a = prev.t, head = t.slice(0, 40), tail = a.slice(-40);
      const together = srcParas.some((p) => { const i = p.indexOf(tail); const j = p.indexOf(head); return i >= 0 && j > i && j - (i + tail.length) < 40; });
      if (together) { splits++; console.log(`SPLIT (one paragraph in the transcript)${between.length ? ' across: ' + between.join(', ') : ''}\n  A: ${prev.raw.slice(0, 70)}\n  B: ${b.slice(0, 70)}\n`); }
    }
    prev = { t, raw: b }; between = [];
  } else if (/["“”]/.test(b.replace(/%%[\s\S]*?%%/g, ''))) {
    unsupported++; prev = null; between = [];
  } else if (/^%%(photo|photos|side|\/side|glyph|\/glyph|pull|on-photo|saying|ending)/.test(b)) {
    between.push(b.slice(2, b.indexOf(':') > 0 ? b.indexOf(':') : 12));
  } else { prev = null; between = []; }
}

console.log(`SPLIT COVERAGE: status=${unsupported ? "unsupported" : !quotes ? "not-applicable" : splits ? "split-detected" : "checked-no-split"}; quote-blocks=${quotes}; compared-pairs=${compared}; splits=${splits}; unsupported=${unsupported}.`);
console.log("Scope: donor neighbouring-block text heuristic only; not semantic thought or source fidelity verification.");
process.exit(unsupported ? 2 : 0);
