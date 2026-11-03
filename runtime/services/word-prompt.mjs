// The transcription prompt, built from the shared word library.
//
// This module is deliberately small and free of the app's runtime: the transcription job runs in its own detached
// process (runtime/services/magazine/jobs.mjs) and reads the library FILE through here. The server writes the file;
// nothing here writes.
//
// Whisper takes a prompt of roughly 220 tokens at most; the Teajia tea-terms tool keeps 160 for headroom, and so do we.
// Order matters because the budget cuts the list off: words Adrian has corrected before come first (they are the ones
// the model gets wrong), then the core words, then words that have been misheard, then the rest by category.
import fs from 'node:fs';

export const LIBRARY_SCHEMA = 'ar-create.word-library.v1';
export const PROMPT_TOKENS = 160;
/** Category ids and the order they take in the prompt. */
export const CATEGORIES = Object.freeze(['person', 'place', 'tea-term', 'hexagram', 'gene-key', 'other']);
export const CATEGORY_LABELS = Object.freeze({ person: 'Person', place: 'Place', 'tea-term': 'Tea term', 'gene-key': 'Gene Key', hexagram: 'Hexagram', other: 'Other' });

export const isCJK = s => /[㐀-鿿]/.test(s);
/** Lowercase, no tones, no apostrophes or hyphens: the form two spellings are compared in. */
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`\-‐–]/g, ' ').replace(/\s+/g, ' ').trim();
/** Same, with the spaces gone too: "Lu Yu" and "Luyu" meet here. */
export const squash = s => norm(s).replace(/[^\p{L}\p{N}]/gu, '');

// The budget estimate Teajia's tea-terms tool uses: about three Latin characters to a token, one and a half per CJK one.
export const tokens = s => Math.ceil(s.replace(/[㐀-鿿，。、]/g, '').length / 3) + Math.ceil((s.match(/[㐀-鿿，。、]/g) || []).length * 1.5);

const HEAD = { en: 'Names and terms in this conversation: ', zh: '以下是访谈中出现的名字和术语：' };
const TAIL = { en: '.', zh: '。' };
const SEP = { en: ', ', zh: '、' };

const heardVariants = e => (e.variants || []).filter(v => v.kind !== 'alias');
/** Plain lowercase English words are spelled correctly already: spend no budget on them. */
const needsHelp = e => e.core || heardVariants(e).length || e.source?.kind === 'confirmed-answer' || !/^[a-z ]+$/.test(e.spelling);

/** Entries in the order the budget should spend them. `prefer` is a list of sets or categories to lift within a tier. */
export function promptOrder(entries, { prefer = [] } = {}) {
  const want = new Set(prefer.map(norm));
  const lifted = e => (want.size && (want.has(norm(e.category)) || (e.sets || []).some(s => want.has(norm(s)))) ? 0 : 1);
  const tier = e => (e.source?.kind === 'confirmed-answer' ? 0 : e.core ? 1 : heardVariants(e).length ? 2 : 3);
  const rank = e => { const i = CATEGORIES.indexOf(e.category); return i < 0 ? CATEGORIES.length : i; };
  const learned = e => (e.source?.kind === 'confirmed-answer' ? -Date.parse(e.addedAt || 0) : 0);
  return entries.filter(e => e.status === 'confirmed' && needsHelp(e))
    .sort((a, b) => tier(a) - tier(b) || lifted(a) - lifted(b) || learned(a) - learned(b) || rank(a) - rank(b) || a.spelling.localeCompare(b.spelling));
}

/** The prompt for one language. Returns {prompt, words, tokens, budget}; prompt is '' when there is nothing to say. */
export function buildPrompt(entries, { language = 'en', budget = PROMPT_TOKENS, prefer = [] } = {}) {
  const zh = language === 'zh', key = zh ? 'zh' : 'en';
  const pick = e => (zh ? e.zh : e.spelling);
  const seen = new Set(), words = [];
  for (const e of promptOrder(entries, { prefer })) {
    const w = pick(e);
    if (!w || seen.has(w)) continue;
    const next = HEAD[key] + [...words, w].join(SEP[key]) + TAIL[key];
    if (tokens(next) > budget) break;
    seen.add(w); words.push(w);
  }
  if (!words.length) return { prompt: '', words: [], tokens: 0, budget, language: key };
  const prompt = HEAD[key] + words.join(SEP[key]) + TAIL[key];
  return { prompt, words, tokens: tokens(prompt), budget, language: key };
}

/** Read the library file (the server's copy). A missing or unreadable file is an empty library, never an error:
 *  the transcription then falls back to the tea-terms path. */
export function readLibraryFile(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value?.schema === LIBRARY_SCHEMA && Array.isArray(value.entries) ? value : null;
  } catch { return null; }
}

/** What the transcription job calls. */
export function promptFromFile(file, options = {}) {
  const library = readLibraryFile(file);
  return library ? buildPrompt(library.entries, options) : { prompt: '', words: [], tokens: 0, budget: options.budget ?? PROMPT_TOKENS, language: options.language === 'zh' ? 'zh' : 'en' };
}
