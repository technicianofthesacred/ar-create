/**
 * marks.ts — Section B mark/node definitions for the Composition Studio.
 *
 * Two-register model:
 *   - Prose with NO `sourced` mark  = common knowledge (unmarked)
 *   - Prose WITH `sourced` mark     = explicitly attributed claim
 *
 * There is NO common-knowledge mark — absence of `sourced` is the signal.
 *
 * Marks (inline):
 *   sourced          — attributed claim span. form:'inline'
 *   inlineQuote      — verbatim short quote run inline. form:'quote'
 *   paraphrase       — AI-adjacent restatement. OFF by default, FLAGGED. form:'paraphrase'
 *
 * Nodes (block):
 *   blockquoteAttributed  — verbatim block quote + attribution line
 *   referenceCard         — margin/aside card holding a passage
 */

import { Mark, Node, mergeAttributes } from '@tiptap/core';

// ── Common passage attribute shape ───────────────────────────────────────────
// Shared across all sourced marks and attributed nodes.

export interface PassageAttrs {
  passageId: string;
  sourceRef: string;
  sourceTitle: string;
  author: string;
}

function passageAttrDefs() {
  return {
    passageId: {
      default: null as string | null,
      parseHTML: (el: Element) => el.getAttribute('data-passage-id'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.passageId ? { 'data-passage-id': attrs.passageId as string } : {},
    },
    sourceRef: {
      default: null as string | null,
      parseHTML: (el: Element) => el.getAttribute('data-source-ref'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.sourceRef ? { 'data-source-ref': attrs.sourceRef as string } : {},
    },
    sourceTitle: {
      default: null as string | null,
      parseHTML: (el: Element) => el.getAttribute('data-source-title'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.sourceTitle ? { 'data-source-title': attrs.sourceTitle as string } : {},
    },
    author: {
      default: null as string | null,
      parseHTML: (el: Element) => el.getAttribute('data-author'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.author ? { 'data-author': attrs.author as string } : {},
    },
  };
}

// ── sourced ───────────────────────────────────────────────────────────────────
// The load-bearing mark. A span with this mark is an attributed claim.
// A span WITHOUT it is common knowledge. No explicit CK mark exists.
// Renders a subtle underline + hoverable ref via class `desk-sourced`.

export const SourcedMark = Mark.create({
  name: 'sourced',

  addAttributes() {
    return {
      ...passageAttrDefs(),
      form: {
        default: 'inline' as 'inline',
        parseHTML: (_el: Element) => 'inline',
        renderHTML: (_attrs: Record<string, unknown>) => ({ 'data-form': 'inline' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-passage-id][data-form="inline"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'desk-sourced' }), 0];
  },
});

// ── inlineQuote ───────────────────────────────────────────────────────────────
// Verbatim short quote run inline. Passage attrs + form:'quote'.
// Rendered with quotation styling via class `desk-inline-quote`.

export const InlineQuoteMark = Mark.create({
  name: 'inlineQuote',

  addAttributes() {
    return {
      ...passageAttrDefs(),
      form: {
        default: 'quote' as 'quote',
        parseHTML: (_el: Element) => 'quote',
        renderHTML: (_attrs: Record<string, unknown>) => ({ 'data-form': 'quote' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-passage-id][data-form="quote"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'desk-inline-quote' }), 0];
  },
});

// ── paraphrase ────────────────────────────────────────────────────────────────
// OFF by default. When used, FLAGGED visually so AI-adjacent prose is never
// silent. Passage attrs + form:'paraphrase'.
// Renders with a visible flag affordance via class `desk-paraphrase`.

export const ParaphraseMark = Mark.create({
  name: 'paraphrase',

  addAttributes() {
    return {
      ...passageAttrDefs(),
      form: {
        default: 'paraphrase' as 'paraphrase',
        parseHTML: (_el: Element) => 'paraphrase',
        renderHTML: (_attrs: Record<string, unknown>) => ({ 'data-form': 'paraphrase' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-passage-id][data-form="paraphrase"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'desk-paraphrase' }), 0];
  },
});

// ── blockquoteAttributed (node) ───────────────────────────────────────────────
// Block-level verbatim quote. Passage attrs on the node itself.
// Renders as a <blockquote> containing the passage text + an attribution footer.

export const BlockquoteAttributedNode = Node.create({
  name: 'blockquoteAttributed',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      passageId: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-passage-id'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.passageId ? { 'data-passage-id': attrs.passageId as string } : {},
      },
      sourceRef: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-source-ref'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.sourceRef ? { 'data-source-ref': attrs.sourceRef as string } : {},
      },
      sourceTitle: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-source-title'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.sourceTitle ? { 'data-source-title': attrs.sourceTitle as string } : {},
      },
      author: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-author'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.author ? { 'data-author': attrs.author as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'blockquote[data-passage-id]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['blockquote', mergeAttributes(HTMLAttributes, { class: 'desk-blockquote-attributed' }), 0];
  },
});

// ── referenceCard (node) ──────────────────────────────────────────────────────
// A margin/aside card holding a passage for reference without inlining it
// into the prose flow. Passage attrs on the node.

export const ReferenceCardNode = Node.create({
  name: 'referenceCard',
  group: 'block',
  content: 'inline*',
  defining: true,
  atom: true,

  addAttributes() {
    return {
      passageId: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-passage-id'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.passageId ? { 'data-passage-id': attrs.passageId as string } : {},
      },
      sourceRef: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-source-ref'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.sourceRef ? { 'data-source-ref': attrs.sourceRef as string } : {},
      },
      sourceTitle: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-source-title'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.sourceTitle ? { 'data-source-title': attrs.sourceTitle as string } : {},
      },
      author: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-author'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.author ? { 'data-author': attrs.author as string } : {},
      },
      text: {
        default: null as string | null,
        parseHTML: (el: Element) => el.getAttribute('data-text'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.text ? { 'data-text': attrs.text as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-passage-id]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['aside', mergeAttributes(HTMLAttributes, { class: 'desk-reference-card' }), 0];
  },
});
