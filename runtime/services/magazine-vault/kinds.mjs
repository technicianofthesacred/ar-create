// What each file in the magazine folder (MAG) is, and who may write it.
//
// The allowlist follows MAG/.ai-draft-ok ("Claude may create and fill working files in Workflow/";
// "never edits a RAW transcript after it is made, never edits Writing/") and Adrian's D4 (2026-10-21):
// drafts and post words wait for his yes; working notes save directly, with undo.
//
// class:
//   note   working notes: any actor writes directly (compare-and-swap, undoable)
//   prose  words a reader sees: a human writes directly; an agent's write becomes a proposal
//   social a made thing for Instagram: an agent may write it only while it says "status: for-your-yes"
//          (the page's own yes gate); otherwise it is prose
//   raw    the transcript as recorded: created once, never overwritten
//   log    written only by its own command (EDITS by magazine.edit, exports by magazine.export)
//   board  STATUS.md: only its generated story table, through magazine.status.*
//   issue  MAG/Issues/**: only through magazine.issue.write
// Anything else (rule files, templates, _style, _briefs, _archive, the lock) is refused.
import {StateError} from '../../store.mjs';

const md = /\.md$/;
const ROWS = [
  // [pattern on the path relative to MAG, kind, class]
  [/^Workflow\/ASK - [^/]+\.md$/, 'ASK', 'note'],
  [/^Workflow\/_glossary-queue\.md$/, 'GLOSSARY', 'note'],
  [/^Workflow\/_page-feedback\.md$/, 'PAGE-FEEDBACK', 'note'],
  [/^Workflow\/0-Ideas\/[^/]+\.md$/, 'IDEA', 'note'],
  [/^Workflow\/0-Inbox\/RAW - [^/]+\.md$/, 'RAW', 'raw'],
  [/^Workflow\/1-Source\/SRC - [^/]+\.md$/, 'SRC', 'note'],
  [/^Workflow\/1-Source\/MOMENTS - [^/]+\.md$/, 'MOMENTS', 'note'],
  [/^Workflow\/1-Source\/CONTEXT - [^/]+\.md$/, 'CONTEXT', 'prose'],
  [/^Workflow\/2-Guidance\/MAP - [^/]+\.md$/, 'MAP', 'note'],
  [/^Workflow\/2-Guidance\/PLANS - [^/]+\.md$/, 'PLANS', 'note'],
  [/^Workflow\/3-Develop\/RESEARCH - [^/]+\.md$/, 'RESEARCH', 'note'],
  [/^Workflow\/3-Develop\/BRIEF - [^/]+\.md$/, 'BRIEF', 'note'],
  [/^Workflow\/3-Develop\/NOTES - [^/]+\.md$/, 'NOTES', 'note'],
  [/^Workflow\/3-Develop\/READ - [^/]+\.md$/, 'READ', 'note'],
  [/^Workflow\/3-Develop\/DEV - [^/]+\.md$/, 'DEV', 'prose'],
  [/^Workflow\/4-Review\/CHECK - [^/]+\.md$/, 'CHECK', 'note'],
  [/^Workflow\/4-Review\/SENSE - [^/]+\.md$/, 'SENSE', 'note'],
  [/^Workflow\/4-Review\/BLIND - [^/]+\.(md|txt)$/, 'BLIND', 'note'],
  [/^Workflow\/4-Review\/_blind\/[^/]+\.(md|txt)$/, 'BLIND', 'note'],
  [/^Workflow\/4-Review\/RATINGS-LOG\.md$/, 'RATINGS', 'note'],
  [/^Workflow\/4-Review\/EDITS - [^/]+\.md$/, 'EDITS', 'log'],
  [/^Workflow\/5-Social\/REQUESTS\.md$/, 'REQUESTS', 'note'],
  [/^Workflow\/5-Social\/(CAROUSEL|POST|REEL|VIDEO|SCRIPT) - [^/]+\.md$/, 'SOCIAL', 'social'],
  [/^Workflow\/5-Social\/(CAROUSEL|POST|REEL|VIDEO|SCRIPT) - [^/]+\/(slide-\d{2}\.png|caption\.txt)$/, 'EXPORT', 'log'],
  [/^Workflow\/6-Feedback\/FEEDBACK - [^/]+\.md$/, 'FEEDBACK', 'prose'],
  [/^STATUS\.md$/, 'STATUS', 'board'],
  [/^Issues\/(?:[^/]+\/)*[^/]+\.md$/, 'ISSUE', 'issue'],
];
const REFUSED = [
  [/(^|\/)Writing\//, 'Writing/ is never edited.'],
  [/^Workflow\/_mag-running\.md$/, 'The lock is held only by the lock service.'],
  [/TEMPLATE\.md$/, 'Templates are Adrian\'s rule files.'],
  [/^Workflow\/(_style|_briefs|_proposals)\//, 'Style, briefs and proposals are Adrian\'s rule files.'],
  [/^_archive\//, 'The archive changes only through magazine.tidy.'],
  [/^[^/]+\.md$/, 'Rule files at the top of the magazine (SYSTEM, TEMPLATE, EDITOR, RATING, WRITER-GUIDE, PAGE) are Adrian\'s.'],
];

/** Normalise and refuse unsafe relative paths (no traversal, no hidden parts, no conflict copies). */
export function cleanRelative(value) {
  if (typeof value !== 'string' || !value || value.length > 600 || value.startsWith('/') || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value)) throw new StateError('Name a file by its path inside the magazine folder, for example Workflow/1-Source/SRC - Tea Teacher.md.', 400);
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.') || p.includes('.sync-conflict-'))) throw new StateError('Hidden files, sync-conflict copies and traversal paths are refused.', 400);
  return parts.join('/');
}

/** {kind, class, rel} for an allowlisted path, else a 403 that says why. */
export function classify(value) {
  const rel = cleanRelative(value);
  const row = ROWS.find(([pattern]) => pattern.test(rel));
  if (row) return { rel, kind: row[1], class: row[2], text: md.test(rel) || /\.txt$/.test(rel) };
  const refusal = REFUSED.find(([pattern]) => pattern.test(rel));
  throw new StateError(refusal ? refusal[1] : `AR Create does not write ${rel}: only the working files in Workflow/ (see .ai-draft-ok).`, 403);
}

/** The story a working file is about, from its name ("SRC - Tea Teacher (Presence).md" -> "Tea Teacher (Presence)"). */
export function storyFromName(rel) {
  const base = rel.split('/').pop().replace(/\.(md|txt)$/, '');
  const m = base.match(/^(?:[A-Z]+ - )+(.+)$/);
  return m ? m[1].trim() : null;
}

/** A stable scope id for a story name: lowercase words joined by dashes. */
export function storyId(name) {
  const slug = String(name || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  if (!slug) throw new StateError('Name the story.', 400);
  return 'mag-' + slug;
}

/** Frontmatter as flat key: value pairs (the magazine's own simple form). */
export function frontmatter(text) {
  const fm = String(text).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] || '';
  const meta = {};
  for (const line of fm.split('\n')) { const m = line.match(/^([\w-]+):\s*(.*)$/); if (m) meta[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2'); }
  return { meta, keys: Object.keys(meta), raw: fm };
}
