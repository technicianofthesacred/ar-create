/**
 * quoteForms.ts — pure helpers for inserting quoted content at the cursor.
 *
 * Each export is a function `(passage) => Command` where `Command` is the
 * TipTap `Command` type (receives `CommandProps` and returns boolean).
 * Commands use the `chain` from `CommandProps` (not `editor.chain()`) so they
 * compose correctly when invoked via `editor.commands.command()` or inside
 * a `chain()` sequence.
 *
 * Forms per Section B:
 *   blockQuoteForm    — blockquoteAttributed node (default, verbatim block)
 *   inlineQuoteForm   — inlineQuote mark over inserted text run
 *   referenceCardForm — referenceCard node (margin aside, no inline)
 *   paraphraseForm    — paraphrase mark (OFF by default, FLAGGED)
 *
 * None of these trigger model calls. All insert verbatim passage content.
 */

import type { Command } from '@tiptap/core';

// ── Passage shape expected by all form helpers ─────────────────────────────

export interface Passage {
  passageId: string;
  sourceRef: string;
  sourceTitle: string;
  author: string;
  /** The verbatim text of the passage. */
  text: string;
}

// ── blockQuoteForm (default) ──────────────────────────────────────────────
// Inserts a blockquoteAttributed node containing the passage text.
// This is the default pull-in verb from PassageBank.

export function blockQuoteForm(passage: Passage): Command {
  return ({ chain }) => {
    const { passageId, sourceRef, sourceTitle, author, text } = passage;
    return chain()
      .focus()
      .insertContent({
        type: 'blockquoteAttributed',
        attrs: { passageId, sourceRef, sourceTitle, author },
        content: [
          {
            type: 'text',
            text,
          },
        ],
      })
      .run();
  };
}

// ── inlineQuoteForm ───────────────────────────────────────────────────────
// Inserts the passage text as an inline run bearing the inlineQuote mark.
// On-demand; not the default.

export function inlineQuoteForm(passage: Passage): Command {
  return ({ chain, state }) => {
    const { passageId, sourceRef, sourceTitle, author, text } = passage;
    const { $from, $to } = state.selection;
    const before = $from.parent.textBetween(0, $from.parentOffset, '', '\uFFFC').slice(-1);
    const after = $to.parent.textBetween($to.parentOffset, $to.parent.content.size, '', '\uFFFC').slice(0, 1);
    // Separators are our prose, not part of the attributed quotation. A fresh
    // unmarked boundary also keeps subsequently typed words outside its mark.
    const leading = before && !/\s|[(\[{]/u.test(before) && !/^\s/u.test(text) ? ' ' : '';
    const trailing = !/\s$/u.test(text) && (!after || !/[\s.,;:!?)}\]]/u.test(after)) ? ' ' : '';
    return chain()
      .focus()
      .insertContent([
        ...(leading ? [{ type: 'text', text: leading, marks: [] }] : []),
        { type: 'text', text, marks: [{ type: 'inlineQuote', attrs: { passageId, sourceRef, sourceTitle, author, form: 'quote' } }] },
        ...(trailing ? [{ type: 'text', text: trailing, marks: [] }] : []),
      ])
      .unsetMark('inlineQuote')
      .run();
  };
}

// ── referenceCardForm ─────────────────────────────────────────────────────
// Inserts a referenceCard node (margin/aside). Does not inline the passage
// into the prose flow.

export function referenceCardForm(passage: Passage): Command {
  return ({ chain }) => {
    const { passageId, sourceRef, sourceTitle, author, text } = passage;
    return chain()
      .focus()
      .insertContent({
        type: 'referenceCard',
        attrs: { passageId, sourceRef, sourceTitle, author, text },
      })
      .run();
  };
}

// ── paraphraseForm ────────────────────────────────────────────────────────
// Inserts the passage text bearing the paraphrase mark.
// OFF by default. Rendered FLAGGED so AI-adjacent prose is never silent.
// Caller must explicitly choose this form; PassageBank does not expose it
// as a primary action.

export function paraphraseForm(passage: Passage): Command {
  return ({ chain }) => {
    const { passageId, sourceRef, sourceTitle, author, text } = passage;
    return chain()
      .focus()
      .insertContent({
        type: 'text',
        text,
        marks: [
          {
            type: 'paraphrase',
            attrs: { passageId, sourceRef, sourceTitle, author, form: 'paraphrase' },
          },
        ],
      })
      .run();
  };
}
