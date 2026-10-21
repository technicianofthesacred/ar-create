// The magazine's two text checks as pure functions, ported verbatim from ~/builds/mag-check-quotes.mjs
// and ~/builds/mag-check-splits.mjs (2026-10-21). Same rules, same printed lines; text in, results out.
// tests/magazine-checks.test.mjs holds them to the scripts' own output.
import {StateError} from '../../store.mjs';

const MAX_SKIP = 4, MAX_SPAN = 6;
const words = t => t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\[\]\s]/g, ' ').split(/\s+/).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);

/** "Real words": every quoted passage must be in the transcript (or Adrian's CONTEXT), in order. */
export function checkQuotes(devText, srcText, extraTexts = []) {
  const tStart = srcText.indexOf('## Full Transcript');
  const extra = extraTexts.map(t => t.replace(/%%[\s\S]*?%%/g, ' ')).join('\n');
  const src = words(((tStart >= 0 ? srcText.slice(tStart) : srcText) + '\n' + extra).replace(/\*\*[^*]+:\*\*/g, ' '));
  const dev = devText.replace(/%%[\s\S]*?%%/g, ' ').replace(/==[\s\S]*?==/g, ' … ').replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, '$1');
  const body = dev.split(/\n---\n/).slice(2).join('\n');
  const passages = []; let narration = 0, speaker = false;
  for (const para of body.split(/\n\s*\n/)) {
    const raw = para.split('\n').map(l => l.trim()).filter(Boolean);
    if (raw.some(l => l.startsWith('#'))) speaker = false;
    if (raw.some(l => /^\*\*[^*]+:\*\*$/.test(l))) speaker = true;
    const lines = para.split('\n').filter(l => l.trim() && !l.startsWith('#') && !/^\*\*[^*]+:\*\*\s*$/.test(l.trim()) && !/^\*\*[^*]+\*\*\s*$/.test(l.trim()));
    if (!lines.length) continue;
    const text = lines.join(' ').replace(/^>\s*/gm, '').replace(/\*\*/g, '').replace(/(^|\s)\*(?=["“])|(?<=["”])\*(?=\s|$)/g, '$1');
    const spans = [...text.matchAll(/["“]([^"”]+)["”]/g)].map(m => m[1]);
    if (!spans.length && speaker) spans.push(text);
    if (!spans.length) { if (words(text).length >= 3) narration++; continue; }
    for (const span of spans) for (const chunk of span.split(/…|\.\.\./)) { const w = words(chunk); if (w.length >= 3) passages.push({text: chunk.trim(), w}); }
  }
  const isBracket = t => t.startsWith('[');
  const joinBrackets = w => { const out = []; for (let i = 0; i < w.length; i++) { if (w[i].startsWith('[') && !w[i].endsWith(']')) { let j = i; while (j < w.length - 1 && !w[j].endsWith(']')) j++; out.push(w.slice(i, j + 1).join(' ')); i = j; } else out.push(w[i]); } return out; };
  const found = w0 => {
    const w = joinBrackets(w0);
    for (let s = 0; s < src.length; s++) {
      const memo = new Set();
      const match = (i, p) => {
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
  };
  const lines = [], notFound = [];
  for (const p of passages) if (!found(p.w)) { notFound.push(p.text); lines.push(`NOT FOUND: "${p.text.slice(0, 140)}${p.text.length > 140 ? '…' : ''}"`); }
  lines.push(`${passages.length - notFound.length} of ${passages.length} quoted passages found in the transcript.`);
  lines.push(`${narration} paragraphs with no quotation marks (Adrian's words, connecting lines) left unchecked.`);
  return {passages: passages.length, found: passages.length - notFound.length, notFound, narration, ok: notFound.length === 0, lines};
}

/** Neighbouring quotes the transcript holds as one paragraph (one thought set as two quotes). */
export function checkSplits(devText, srcText) {
  const norm = t => t.replace(/\[\[term:[^|]*\|([^\]]*)\]\]/g, '$1').replace(/%%[^%]*%%/g, '').replace(/\*\*/g, '').replace(/[“”"]/g, '').replace(/[‘’']/g, "'").replace(/[—–-]/g, ' ').replace(/[_*…]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
  const srcParas = srcText.split(/\n\s*\n/).map(norm);
  const body = devText.split('\n---\n').slice(2, -1).join('\n');
  const blocks = body.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const splits = [], lines = [];
  let prev = null, between = [];
  for (const b of blocks) {
    const isQuote = /^>?\s*"/.test(b);
    if (isQuote) {
      const t = norm(b.replace(/^>\s*/, ''));
      if (prev) {
        const a = prev.t, head = t.slice(0, 40), tail = a.slice(-40);
        const together = srcParas.some(p => { const i = p.indexOf(tail); const j = p.indexOf(head); return i >= 0 && j > i && j - (i + tail.length) < 40; });
        if (together) { splits.push({a: prev.raw, b, across: [...between]}); lines.push(`SPLIT (one paragraph in the transcript)${between.length ? ' across: ' + between.join(', ') : ''}\n  A: ${prev.raw.slice(0, 70)}\n  B: ${b.slice(0, 70)}\n`); }
      }
      prev = {t, raw: b}; between = [];
    } else if (/^%%(photo|photos|side|\/side|glyph|\/glyph|pull|on-photo|saying|ending)/.test(b)) between.push(b.slice(2, b.indexOf(':') > 0 ? b.indexOf(':') : 12));
    else { prev = null; between = []; }
  }
  return {splits, ok: splits.length === 0, lines};
}

/** magazine.check: both checks on a draft against its transcript (and Adrian's CONTEXT note). */
export function createMagazineChecks({vault}) {
  const text = rel => { const r = vault.read({path: rel}); if (!r.exists || r.text === null) throw new StateError(`${rel} is not a readable text file in the magazine.`, 404); return r; };
  return {
    run(input = {}) {
      if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['draft', 'source', 'context'].includes(k))) throw new StateError('Use draft, source (the SRC) and optional context (CONTEXT paths).', 400);
      const dev = text(input.draft);
      if (dev.kind !== 'DEV') throw new StateError('draft names a DEV file.', 400);
      let source = input.source, context = input.context;
      if (!source) {
        const board = vault.board().board, story = board.find(b => (b.files.DEV || []).includes(input.draft.split('/').pop()));
        source = story?.files.SRC?.length === 1 ? 'Workflow/1-Source/' + story.files.SRC[0] : null;
        if (!source) throw new StateError('Name the transcript (source): this story has ' + (story?.files.SRC?.length || 0) + ' SRC files.', 400);
        if (context === undefined && story?.files.CONTEXT?.length) context = 'Workflow/1-Source/' + story.files.CONTEXT[0];
      }
      const src = text(source), extras = [].concat(context || []).map(rel => text(rel));
      return {draft: {path: dev.path, hash: dev.hash}, source: {path: src.path, hash: src.hash}, context: extras.map(e => ({path: e.path, hash: e.hash})), quotes: checkQuotes(dev.text, src.text, extras.map(e => e.text)), splits: checkSplits(dev.text, src.text)};
    },
  };
}
