import type { JSONContent } from '@tiptap/core';
import { structuredMarkdown, plainText, passageCandidateIssue, type Manuscript, type Paragraph } from './document';
import { markdownToDoc, docToMarkdown } from '../donors/wordforge/wf-block-markdown';
// The first-draft service uses the same DEV grammar as the visual review.
export {parseWholeDraft} from './wholeDraft';

const RESERVED = '<!-- ar-create:';
const END = '<!-- ar-create:end -->\n';
const identity = (value: string): string => {
  if (typeof value !== 'string' || !value.length) throw new Error('Article identities must be nonempty strings.');
  try { return encodeURIComponent(value); } catch { throw new Error('Article identities require well-formed Unicode.'); }
};

export function validateArticleIdentity(document: Manuscript): void {
  identity(document.id);
  for (const passage of document.paragraphs) identity(passage.id);
  if (new Set(document.paragraphs.map(p => p.id)).size !== document.paragraphs.length) {
    throw new Error('Duplicate passage anchors cannot be imported.');
  }
  if (typeof document.title !== 'string' || /[\r\n]/.test(document.title) || document.title.includes(RESERVED)) {
    throw new Error('The article title cannot contain newlines or reserved anchors. Edit this document in the app.');
  }
  for (const passage of document.paragraphs) {
    if (structuredMarkdown(passage.doc).includes(RESERVED)) throw new Error('Passage wording contains a reserved article anchor. Edit this document in the app.');
  }
}

/** Same byte contract as article-persistence.mjs; JSON is the identity authority. */
export function renderArticle(document: Manuscript, projectId: string): string {
  validateArticleIdentity(document);
  return `<!-- ar-create:article v1 project=${identity(projectId)} document=${identity(document.id)} -->\n# ${document.title}\n\n` +
    document.paragraphs.map(paragraph => `<!-- ar-create:passage ${identity(paragraph.id)} -->\n${structuredMarkdown(paragraph.doc)}\n\n`).join('') + END;
}

// Only attributes and marks represented by the reused Markdown bridge may be edited.
// Extra node data is preserved on unchanged passages and protected from replacement.
const ATTRIBUTES: Record<string, string[]> = {
  doc: [], paragraph: ['sep'], heading: ['sep', 'level'], bulletList: ['sep', 'tight'],
  orderedList: ['sep', 'tight', 'start'], listItem: [], blockquote: ['sep'], text: [], hardBreak: [],
};
function supportedTree(node: JSONContent, parent?: string): boolean {
  const type = node.type || '';
  const attributes = ATTRIBUTES[type];
  if (!attributes || Object.keys(node).some(key => !['type', 'attrs', 'content', 'text', 'marks'].includes(key))) return false;
  if (Object.keys(node.attrs || {}).some(key => !attributes.includes(key))) return false;
  if (node.attrs?.sep != null && !['blank', 'line'].includes(node.attrs.sep)) return false;
  if (node.attrs?.tight != null && typeof node.attrs.tight !== 'boolean') return false;
  if (type === 'heading' && ![1, 2, 3].includes(node.attrs?.level)) return false;
  if (type === 'orderedList' && node.attrs?.start != null && (!Number.isSafeInteger(node.attrs.start) || node.attrs.start < 1)) return false;
  if (node.marks?.length && type !== 'text') return false;
  for (const mark of node.marks || []) {
    if (!['bold', 'italic', 'code'].includes(mark.type)) return false;
    if (Object.keys(mark).some(key => !['type', 'attrs'].includes(key))) return false;
    if (Object.keys(mark.attrs || {}).some(key => key !== 'markup' || mark.type === 'code')) return false;
    if (mark.attrs?.markup != null && !(mark.type === 'bold' ? ['**', '__'] : ['*', '_']).includes(mark.attrs.markup)) return false;
  }
  if (type === 'doc' && parent !== undefined) return false;
  if (['text', 'hardBreak'].includes(type)) return ['paragraph', 'heading'].includes(parent || '') && !node.content?.length;
  if (node.text !== undefined) return false;
  if (type === 'listItem' && !['bulletList', 'orderedList'].includes(parent || '')) return false;
  if (['bulletList', 'orderedList'].includes(type) && node.content?.some(child => child.type !== 'listItem')) return false;
  if (['paragraph', 'heading'].includes(type) && node.content?.some(child => !['text', 'hardBreak'].includes(child.type || ''))) return false;
  if (['doc', 'blockquote', 'listItem'].includes(type) && node.content?.some(child => ['text', 'hardBreak', 'listItem', 'doc'].includes(child.type || ''))) return false;
  return (node.content || []).every(child => supportedTree(child, type));
}

function unsupportedMarkdown(words: string): boolean {
  // The donor intentionally treats these constructs as literal text. This bridge
  // refuses them on edits so a Markdown-looking feature cannot silently flatten.
  return /(^|\n)[ \t]*(?:`{3,}|~{3,}|(?:[-*_][ \t]*){3,}$|={3,}[ \t]*$|\[[^\]\n]+\]:|\|.*\|)/m.test(words) ||
    /!?\[[^\]\n]*\]\s*(?:\(|\[)/.test(words) || /<\/?[A-Za-z!][^>]*>/.test(words) ||
    /~~/.test(words) || /(^|\n)[ \t]*[-+*] \[[ xX]\]/.test(words);
}

function revisedParagraph(paragraph: Paragraph, words: string): Paragraph {
  if (paragraph.proposal) throw new Error(`Passage ${paragraph.id} has a waiting proposal. Review or drop it before editing the article.`);
  if (unsupportedMarkdown(structuredMarkdown(paragraph.doc)) || !supportedTree(paragraph.doc) || paragraph.doc.type !== 'doc') {
    throw new Error(`Passage ${paragraph.id} contains attributed source or unsupported rich content. Preserve its words exactly and edit it in the app.`);
  }
  if (unsupportedMarkdown(words)) throw new Error(`Passage ${paragraph.id} uses unsupported Markdown. Use paragraphs, headings 1–3, lists, quotations, bold, italic or inline code.`);
  const candidate = markdownToDoc(words);
  if (!supportedTree(candidate) || docToMarkdown(candidate) !== words || structuredMarkdown(candidate) !== words) {
    throw new Error(`Passage ${paragraph.id} is not a lossless canonical Markdown roundtrip. Restore its formatting or edit it in the app.`);
  }
  // The receipt survives a paraphrase rewrite. An exact quotation must survive
  // as exact words too; Markdown cannot turn its provenance into a new quote.
  const before = plainText(paragraph.doc), after = plainText(candidate);
  for (const source of paragraph.attributions) {
    if (source.form === 'paraphrase') continue;
    if (!source.excerpt || !before.includes(source.excerpt) || !after.includes(source.excerpt)) {
      throw new Error(`Passage ${paragraph.id} must preserve its exact attributed source wording. Edit source quotations in the app.`);
    }
  }
  const issue = passageCandidateIssue(paragraph, candidate);
  if (issue) throw new Error(`Passage ${paragraph.id}: ${issue}`);
  return { ...paragraph, doc: candidate, text: words };
}

export type ArticleChangeSummary = {
  titleChanged: boolean;
  previousTitle: string;
  proposedTitle: string;
  modifiedIds: string[];
  addedIds: string[];
  removedIds: string[];
  reordered: boolean;
  previousOrder: string[];
  proposedOrder: string[];
  requiresHumanReview: boolean;
  keptPoints: {paragraphId:string;id:string;text:string}[];
  boundaries: string[];
};
export type ArticleCandidate = { document: Manuscript; changedIds: string[]; summary: ArticleChangeSummary };

function decodeIdentity(encoded: string): string {
  let value: string;
  try { value = decodeURIComponent(encoded); } catch { throw new Error('An article anchor has malformed identity encoding.'); }
  if (identity(value) !== encoded) throw new Error('An article anchor has noncanonical identity encoding. Restore its exported anchor.');
  return value;
}

function protectedRemoval(paragraph: Paragraph): boolean {
  // Historical captured sources/Kept are evidence too, not disposable metadata.
  const records = [paragraph.acceptedFrom, ...(paragraph.acceptanceHistory || [])].filter(Boolean);
  return paragraph.attributions.length > 0 || paragraph.kept.length > 0 || unsupportedMarkdown(structuredMarkdown(paragraph.doc)) || !supportedTree(paragraph.doc) ||
    records.some(record => record!.sources?.length || record!.keptConstraints?.length);
}

function newPassage(id: string, words: string): Paragraph {
  if (id.length > 128 || !id.trim() || /[\u0000-\u001f\u007f]/.test(id)) throw new Error('New passage identity must be readable and at most 128 characters.');
  // Caller contract is an external AI-file proposal; no provider, personal
  // authorship, source, guidance, terminal session or acceptance is inferred.
  const paragraph: Paragraph = { id, text: '', doc: markdownToDoc(''), attributions: [], kept: [], origin: 'ai' };
  return revisedParagraph(paragraph, words);
}

/** Pure inbound candidate. It neither accepts, increments revision nor writes. */
export function parseArticle(raw: string, baseDocument: Manuscript, projectId: string): ArticleCandidate {
  validateArticleIdentity(baseDocument);
  identity(projectId);
  if (typeof raw !== 'string') throw new Error('Article Markdown must be a string.');
  if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024) throw new Error('Article Markdown exceeds the 2 MB document boundary.');
  // Match boundaries strictly rather than extracting Markdown from arbitrary text.
  const header = /^<!-- ar-create:article v1 project=([^ \n]+) document=([^ \n]+) -->\n# ([^\r\n]*)\n\n/.exec(raw);
  if (!header) throw new Error('The article preamble or title format changed. Restore the exported header.');
  if (decodeIdentity(header[1]) !== projectId || decodeIdentity(header[2]) !== baseDocument.id) {
    throw new Error('The article project or document anchor belongs to another saved document.');
  }
  const title = header[3];
  if (title !== baseDocument.title && title.length > 256) throw new Error('A proposed article title must be at most 256 characters.');
  if (title.includes(RESERVED)) throw new Error('The article title contains a reserved anchor.');
  let cursor = header[0].length;
  const sections: { id: string; words: string }[] = [];
  const seen = new Set<string>();
  while (raw.slice(cursor) !== END) {
    const anchor = /^<!-- ar-create:passage ([^ \n]+) -->\n/.exec(raw.slice(cursor));
    if (!anchor) throw new Error('A passage anchor or article end marker changed. Restore the exported boundaries.');
    const id = decodeIdentity(anchor[1]);
    if (seen.has(id)) throw new Error('Duplicate passage anchors cannot be imported.');
    seen.add(id);
    cursor += anchor[0].length;
    const next = raw.indexOf(RESERVED, cursor);
    if (next < 0 || raw.slice(cursor, next).slice(-2) !== '\n\n') {
      throw new Error('The passage anchor format or article end marker changed. Restore the exported boundaries.');
    }
    sections.push({ id, words: raw.slice(cursor, next - 2) });
    if (sections.length > 2000) throw new Error('An article may contain at most 2000 passages.');
    cursor = next;
  }
  const baseline = new Map(baseDocument.paragraphs.map(p => [p.id, p]));
  const modifiedIds: string[] = [], addedIds: string[] = [];
  const removedIds = baseDocument.paragraphs.filter(p => !seen.has(p.id)).map(p => p.id);
  const previousOrder = baseDocument.paragraphs.map(p => p.id), proposedOrder = sections.map(p => p.id);
  // Insertion/removal alone is not a reorder; compare surviving identities.
  const reordered = JSON.stringify(previousOrder.filter(id => seen.has(id))) !==
    JSON.stringify(proposedOrder.filter(id => baseline.has(id)));
  const titleChanged = title !== baseDocument.title;
  const edited = titleChanged || reordered || removedIds.length > 0 || sections.some(section =>
    !baseline.has(section.id) || section.words !== structuredMarkdown(baseline.get(section.id)!.doc));
  if (edited && (baseDocument.pendingResearchCandidate || baseDocument.paragraphs.some(p => p.proposal))) {
    throw new Error('The document has a waiting proposal. Review or drop it before proposing article-file edits.');
  }
  for (const id of removedIds) {
    if (protectedRemoval(baseline.get(id)!)) throw new Error(`Passage ${id} contains protected source, Kept or rich content and cannot be removed through Markdown. Review it in the app.`);
  }
  const paragraphs = sections.map(section => {
    const previous = baseline.get(section.id);
    if (!previous) { addedIds.push(section.id); return newPassage(section.id, section.words); }
    if (section.words === structuredMarkdown(previous.doc)) return previous;
    modifiedIds.push(section.id);
    return revisedParagraph(previous, section.words);
  });
  const document = edited ? { ...baseDocument, title, paragraphs } : baseDocument;
  if (renderArticle(document, projectId) !== raw) throw new Error('The article format cannot roundtrip losslessly. Restore its canonical formatting.');
  const boundaries = [
    'This is an unaccepted review candidate; the saved document revision and independent outputs remain unchanged.',
    'Source, guidance and authorship freshness are not verified by Markdown import.',
    'Kept ideas retain their exact saved constraints. Their meaning in revised wording requires human review.',
  ];
  if (reordered && paragraphs.some(p => p.kept.some(k => k.mode === 'point'))) boundaries.push('Reordered Kept points retain exact wording, but their meaning in the new context requires human review.');
  if (addedIds.length) boundaries.push('Added passages are external AI-file proposals. Their author/provider is unknown; no source or guidance provenance is inferred.');
  return { document, changedIds: [...modifiedIds, ...addedIds, ...removedIds], summary: {
    titleChanged, previousTitle: baseDocument.title, proposedTitle: title, modifiedIds, addedIds, removedIds,
    reordered, previousOrder, proposedOrder, requiresHumanReview: Boolean(edited),
    keptPoints: paragraphs.filter(p => modifiedIds.includes(p.id) || reordered).flatMap(p => p.kept.filter(k => k.mode === 'point').map(k => ({paragraphId:p.id,id:k.id,text:k.text}))), boundaries,
  } };
}
