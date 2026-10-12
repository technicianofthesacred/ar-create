// mag-check-quotes — the "Real words" check from the magazine SYSTEM.md.
// Every passage a draft puts in quotation marks ("…" or “…”), including pull
// quotes (> "…") and Adrian's own questions (*"…"*), must be found in its SRC
// transcript (or in Adrian's CONTEXT note), word for word and in order.
// Allowed: removed fillers, false starts and repeats (at most MAX_SKIP source
// words skipped between two kept words), cuts marked with "…", and [bracketed]
// fixes: a mishearing, or an editor's clearer wording for a phrase that would
// stop a reader (EDITOR.md); a bracket of up to 6 words stands for 1 to 6 words
// of the transcript.
//
// Text outside quotation marks is narration (Adrian's opening and close, and
// connecting lines, approved or not) and is not checked against the transcript;
// it is counted so nothing is silently skipped. Changed 2026-09-29: the old
// version read every plain paragraph as a quote, so approving a connecting line
// (removing its == marks) failed the check. In an older interview-shape
// draft, plain text under a **Name:** label (until the next heading) counts as
// that speaker's words and is checked too. Old version: _archive/mag-check-quotes.2026-09-29.mjs
//
//   node ~/builds/mag-check-quotes.mjs "<DEV file>" "<SRC file>" ["<CONTEXT file>" ...]
//
// Exit 0 = checked-pass OR no quotes (coverage distinguishes them);
// 1 = unmatched passage/invalid bracket; 2 = unsupported parsing/tokenization.

import fs from 'fs';
import { articleBody, unsupportedLetters } from './mag-article-body.mjs';

const MAX_SKIP = 4;
const [devPath, srcPath, ...extraPaths] = process.argv.slice(2);
if (!devPath || !srcPath) { console.error('Usage: node mag-check-quotes.mjs <DEV> <SRC>'); process.exit(2); }

const words = (t) => t.toLowerCase()
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9'\[\]\s]/g, ' ')
  .split(/\s+/).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);   // single quotes around words are quote marks, not apostrophes

// SRC: only the transcript part
const srcText = fs.readFileSync(srcPath, 'utf8');
const tStart = srcText.indexOf('## Full Transcript');
const extra = extraPaths.map(p => fs.readFileSync(p, 'utf8').replace(/%%[\s\S]*?%%/g, ' ')).join('\n');
const src = words(((tStart >= 0 ? srcText.slice(tStart) : srcText) + '\n' + extra).replace(/\*\*[^*]+:\*\*/g, ' '));

// DEV: body after the metadata divider, without notes, highlights, headings, labels
const dev = fs.readFileSync(devPath, 'utf8')
  .replace(/%%[\s\S]*?%%/g, ' ')
  .replace(/==[\s\S]*?==/g, ' … ')   // narration between quotes splits them: each quote is checked on its own
  .replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, '$1');   // glossary markers read as their text
let body;
try { body = articleBody(dev); } catch (error) { console.error(`UNSUPPORTED: ${error.message}`); process.exit(2); }
const passages = [];
let narration = 0;
let quotedSpans = 0, unsupported = 0, bracketFailures = 0;
let speaker = false;   // older interview-shape drafts: words under a **Name:** label, without quotation marks
for (const para of body.split(/\n\s*\n/)) {
  const raw = para.split('\n').map(l => l.trim()).filter(Boolean);
  if (raw.some(l => l.startsWith('#'))) speaker = false;
  if (raw.some(l => /^\*\*[^*]+:\*\*$/.test(l))) speaker = true;
  const lines = para.split('\n').filter(l => l.trim() && !l.startsWith('#') && !/^\*\*[^*]+:\*\*\s*$/.test(l.trim()) && !/^\*\*[^*]+\*\*\s*$/.test(l.trim()));   // speaker labels and bold section titles are not quotes
  if (!lines.length) continue;
  const text = lines.join(' ').replace(/^>\s*/gm, '').replace(/\*\*/g, '').replace(/(^|\s)\*(?=["“])|(?<=["”])\*(?=\s|$)/g, '$1');
  if (/[「」『』«»]/u.test(text)) { unsupported++; console.log('UNSUPPORTED: quotation delimiter outside the supported double-quote grammar.'); }
  const spans = [...text.matchAll(/["“]([^"”]*)["”]/g)].map(m => m[1]);
  if (/["“”]/.test(text.replace(/["“]([^"”]*)["”]/g, ''))) { unsupported++; console.log('UNSUPPORTED: unbalanced quotation marks.'); }
  if (!spans.length && speaker) spans.push(text);   // a turn under a speaker label is their words
  if (!spans.length) { if (words(text).length >= 3) narration++; continue; }
  for (const span of spans) {
    quotedSpans++;
    if (unsupportedLetters(span)) { unsupported++; console.log('UNSUPPORTED: quoted letters outside ASCII word tokenization.'); continue; }
    const brackets = [...span.matchAll(/\[([^\[\]]*)\]/g)];
    if (span.replace(/\[[^\[\]]*\]/g, '').match(/[\[\]]/) || brackets.some(match => words(match[1]).length < 1 || words(match[1]).length > 6)) {
      bracketFailures++; console.log('INVALID BRACKET: require 1 to 6 inserted words and balanced brackets.'); continue;
    }
    let chunks = 0;
    for (const chunk of span.split(/…|\.\.\./)) {
      const w = words(chunk);
      if (w.length) { passages.push({ text: chunk.trim(), w }); chunks++; }
    }
    if (!chunks) { unsupported++; console.log('UNSUPPORTED: quoted span has no supported word tokens.'); }
  }
}

const MAX_SPAN = 6;   // a [bracketed phrase] stands for 1 to MAX_SPAN transcript words
const isBracket = (t) => t.startsWith('[');
function joinBrackets(w) {   // "[tea's", "natural", "compounds]" -> one token "[tea's natural compounds]"
  const out = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i].startsWith('[') && !w[i].endsWith(']')) {
      let j = i; while (j < w.length - 1 && !w[j].endsWith(']')) j++;
      out.push(w.slice(i, j + 1).join(' ')); i = j;
    } else out.push(w[i]);
  }
  return out;
}
function found(w0) {
  const w = joinBrackets(w0);
  for (let s = 0; s < src.length; s++) {
    const memo = new Set();
    const match = (i, p) => {   // w[i..] matches src from position p
      if (i === w.length) return true;
      const key = i * 1e7 + p; if (memo.has(key)) return false; memo.add(key);
      const want = w[i];
      for (let k = p; k <= Math.min(p + (i === 0 ? 0 : MAX_SKIP), src.length - 1); k++) {
        if (isBracket(want)) { for (let span = 1; span <= MAX_SPAN && k + span <= src.length; span++) if (match(i + 1, k + span)) return true; }
        else if (src[k] === want && match(i + 1, k + 1)) return true;
      }
      return false;
    };
    if (match(0, s)) return true;
  }
  return false;
}

let bad = 0;
for (const p of passages) {
  if (!found(p.w)) { bad++; console.log(`NOT FOUND: "${p.text.slice(0, 140)}${p.text.length > 140 ? '…' : ''}"`); }
}
console.log(`${passages.length - bad} of ${passages.length} quoted passages found in the transcript.`);
const status = bad || bracketFailures ? 'failed' : unsupported ? 'unsupported' : quotedSpans ? 'checked-pass' : 'not-applicable';
console.log(`QUOTE COVERAGE: status=${status}; visible-spans=${quotedSpans}; checked-chunks=${passages.length}; unsupported=${unsupported}; invalid-brackets=${bracketFailures}.`);
console.log('Scope: ASCII word order with donor filler/cut/bracket allowances; narration, meaning, and %%was%% provenance are not verified.');
console.log(`${narration} paragraphs with no quotation marks (Adrian's words, connecting lines) left unchecked.`);
process.exit(bad || bracketFailures ? 1 : unsupported ? 2 : 0);
