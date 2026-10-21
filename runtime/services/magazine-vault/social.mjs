// Text changes the magazine page (8766) makes, ported verbatim from ~/builds/mag-preview.mjs
// (approveMade, saveLineup, the /make, /redo and /blind lines) as pure functions: text in, text out.
// AR Create applies them under the lock with a compare-and-swap; the page only asks.
export const MAKE_KINDS = Object.freeze(['Carousel', 'Post', 'Reel', 'Video script']);
export const STEP_NAMES = Object.freeze(['Drop', 'Source', 'Map', 'Pick', 'Draft', 'Read', 'Check', 'Photos', 'Layout', 'Look', 'Feedback', 'Done']);
const day = (now = new Date()) => now.toISOString().slice(0, 10);
const REQUESTS_HEAD = '---\ntype: Make requests\n---\n\n# Make requests\n\nAsked on the magazine page. /arcreate makes each from the story\'s brief, shows it to Adrian for his yes, then ticks the line.\n\n';
const FEEDBACK_HEAD = '---\ntype: Page feedback\n---\n\n# Could Adrian answer it coming in blind?\n\nEvery answer from the magazine page, newest last. A "no" is a page to fix: it lacked the context to decide.\n\n';

/** Yes, words-yes, or a change note on a made file (approveMade). */
export function approveMade(text, value, now = new Date()) {
  const today = day(now);
  if (value === 'words') return text.replace(/^status:\s*.*$/m, 'status: words-yes\nwords-approved: ' + today);
  const yes = value === 'yes';
  let t = text.replace(/^status:\s*.*$/m, 'status: ' + (yes ? 'approved' : 'change') + '\n' + (yes ? 'approved' : 'change-asked') + ': ' + today);
  if (!yes) t = t.replace(/\s*$/, '\n\n## Adrian\'s change (' + today + ')\n\n' + String(value).trim() + '\n');
  return t;
}

/** Rewrite the "## Slides" and "## Caption" sections and nothing else (saveLineup). */
export function saveLineup(text, slides, caption) {
  if (!Array.isArray(slides) || slides.length > 30) throw new Error('A lineup is up to 30 slides.');
  const one = s => String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/[\[\]]/g, '').trim();
  const list = slides.map((s, i) => (i + 1) + '. [' + one(s.role) + (one(s.credit) ? ' · ' + one(s.credit) : '') + (one(s.template) ? ' · template: ' + one(s.template) : '') + (one(s.photo) ? ' · photo: ' + one(s.photo) : '') + (one(s.crop) ? ' · crop: ' + one(s.crop) : '') + '] ' + one(s.text)).join('\n');
  let t = text;
  const put = (name, val) => { const re = new RegExp('^## ' + name + '[ \\t]*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))', 'm'); t = re.test(t) ? t.replace(re, () => '## ' + name + '\n\n' + val + '\n\n') : t.replace(/\s*$/, '\n\n## ' + name + '\n\n' + val + '\n'); };
  put('Slides', list); put('Caption', String(caption ?? '').trim());
  return t;
}

/** "Make from this" and "Redo <step>" lines in Workflow/5-Social/REQUESTS.md; null when already asked. */
export function requestLine(text, {kind, step, story}, now = new Date()) {
  if (typeof story !== 'string' || !story.trim() || /[\n\r]/.test(story) || story.length > 120) throw new Error('Name the story.');
  let what;
  if (step !== undefined) { if (!STEP_NAMES.includes(step)) throw new Error('not a step'); what = 'Redo ' + step + ' · ' + story; }
  else { if (!MAKE_KINDS.includes(kind)) throw new Error('not a request'); what = kind + ' · ' + story; }
  const t = text ?? REQUESTS_HEAD;
  if (t.split('\n').some(l => l.startsWith('- [ ]') && l.endsWith(what))) return null;
  return t.replace(/\s*$/, '\n') + '- [ ] ' + day(now) + ' ' + what + '\n';
}

/** "Could you answer it coming in blind?" line in Workflow/_page-feedback.md. */
export function pageFeedbackLine(text, {story, step, q, value, note}, now = new Date()) {
  const clean = v => String(v || '').replace(/[\r\n]+/g, ' ').slice(0, 500);
  const t = text ?? FEEDBACK_HEAD;
  return t.replace(/\s*$/, '\n') + '- ' + now.toISOString().slice(0, 16).replace('T', ' ') + ' · ' + clean(story) + ' · step ' + clean(step) + ' · ' + clean(q) + ' · ' + (value === 'yes' ? 'yes' : 'NEEDS MORE') + (note ? ': ' + clean(note) : '') + '\n';
}

/** The status: line of a made file's frontmatter. */
export const madeStatus = text => ((String(text).match(/^---\n([\s\S]*?)\n---/) || [, ''])[1].match(/^status:\s*(.*)$/m) || [])[1]?.trim().replace(/^"|"$/g, '') || '';
