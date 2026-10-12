import {safePassageHref} from './passage-links.mjs';
// wf-block-markdown: the block-level bridge between a passage's stored
// markdown and the Tiptap document the passage editor holds live.
//
// The sibling wf-inline-markdown.ts round-trips ONE paragraph's inline marks
// for the legacy manuscript, whose block model is one <p> per prose block.
// The passage editor is different: a prose block on the passages surface is a
// whole document (a keyword line, headings, paragraphs, lists) and it is
// edited as one, so this bridge covers exactly the block nodes those passages
// use: paragraph, heading 1 to 3, bullet and ordered list, blockquote, hard
// break, plus bold, italic and code. New article imports may additionally
// opt into safe inline links; existing stored Markdown is never reparsed for links.
//
// The contract is byte equality: load a stored passage, serialise it back
// with no edits, and the bytes are the same. That matters because the claim
// engine compares the live words against the machine's words, and a bridge
// that re-spaced or re-marked the text on load would make every untouched
// paragraph look edited. To hold the contract the document remembers the
// three things markdown does not encode in its tree: whether a block was
// separated from the one before it by a blank line or a single newline
// (`sep`), whether a list was tight or loose (`tight`), and which delimiter an
// emphasis mark used (`markup`, so `_Keywords:_` stays underscored).
//
// No new dependency: the parser is mdast-util-from-markdown, which
// react-markdown (a direct dependency, already rendering passages elsewhere
// in wordforge) pulls in, the same reuse wf-inline-markdown.ts documents for
// remark-parse. The serialiser is a small hand-written walk over the
// editor's JSON.

import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Node as MdNode, Parent as MdParent, PhrasingContent, RootContent } from 'mdast';
import { Extension, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

export type BlockSeparator = 'blank' | 'line' | null;

// ── Parser ──────────────────────────────────────────────────────────────────

import {PARSE_OPTIONS,LINK_PARSE_OPTIONS} from './wf-markdown-options.mjs';

function separatorBefore(node: MdNode, previous: MdNode | null): BlockSeparator {
  if (!previous?.position || !node.position) return 'blank';
  return node.position.start.line === previous.position.end.line + 1 ? 'line' : 'blank';
}

// The delimiter an emphasis mark was written with, read off the source.
function delimiterAt(source: string, node: MdNode, fallback: string): string {
  const offset = node.position?.start.offset;
  if (typeof offset !== 'number') return fallback;
  const two = source.slice(offset, offset + 2);
  if (two === '**' || two === '__') return two;
  const one = source[offset];
  return one === '*' || one === '_' ? one : fallback;
}

function inlineChildren(nodes: PhrasingContent[], source: string, marks: JSONContent[] = []): JSONContent[] {
  const out: JSONContent[] = [];
  const text = (value: string, extra: JSONContent[] = []) => {
    const all = [...marks, ...extra].map((mark) => ({ type: mark.type as string, attrs: { ...mark.attrs } }));
    // A newline inside a text node is a soft break in the source.
    value.split('\n').forEach((piece, index) => {
      if (index > 0) out.push({ type: 'hardBreak' });
      if (piece) out.push(all.length ? { type: 'text', text: piece, marks: all } : { type: 'text', text: piece });
    });
  };
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        text(node.value);
        break;
      case 'strong':
        out.push(...inlineChildren(node.children, source, [...marks, { type: 'bold', attrs: { markup: delimiterAt(source, node, '**') } }]));
        break;
      case 'emphasis':
        out.push(...inlineChildren(node.children, source, [...marks, { type: 'italic', attrs: { markup: delimiterAt(source, node, '_') } }]));
        break;
      case 'inlineCode':
        text(node.value, [{ type: 'code', attrs: {} }]);
        break;
      case 'link': {
        if(!safePassageHref(node.url))throw new Error('The draft contains an unsafe citation URL. Review that link before importing.');
        const labelEnd=node.children.at(-1)?.position?.end.offset,end=node.position?.end.offset;
        const destination=typeof labelEnd==='number'&&typeof end==='number'?source.slice(labelEnd,end):null;
        out.push(...inlineChildren(node.children,source,[...marks,{type:'link',attrs:{href:node.url,title:node.title??null,markdownDestination:destination}}]));
        break;
      }
      case 'break':
        out.push({ type: 'hardBreak' });
        break;
      default:
        // Anything the parser still emits keeps its words rather than losing
        // them; with the constructs above disabled this should not happen.
        if ('value' in node && typeof node.value === 'string') text(node.value);
        else if ('children' in node) out.push(...inlineChildren((node as MdParent).children as PhrasingContent[], source, marks));
    }
  }
  return out;
}

function blockChildren(nodes: RootContent[], source: string): JSONContent[] {
  const out: JSONContent[] = [];
  let previous: MdNode | null = null;
  for (const node of nodes) {
    const sep = separatorBefore(node, previous);
    switch (node.type) {
      case 'paragraph': {
        const content = inlineChildren(node.children, source);
        out.push(content.length ? { type: 'paragraph', attrs: { sep }, content } : { type: 'paragraph', attrs: { sep } });
        break;
      }
      case 'heading': {
        const content = inlineChildren(node.children, source);
        out.push(content.length
          ? { type: 'heading', attrs: { sep, level: node.depth }, content }
          : { type: 'heading', attrs: { sep, level: node.depth } });
        break;
      }
      case 'list': {
        const items = node.children.map((item) => {
          const content = blockChildren(item.children, source);
          return content.length ? { type: 'listItem', content } : { type: 'listItem', content: [{ type: 'paragraph' }] };
        });
        out.push(node.ordered
          ? { type: 'orderedList', attrs: { sep, tight: !node.spread, start: node.start ?? 1 }, content: items }
          : { type: 'bulletList', attrs: { sep, tight: !node.spread }, content: items });
        break;
      }
      case 'blockquote':
        out.push({ type: 'blockquote', attrs: { sep }, content: blockChildren(node.children, source) });
        break;
      default:
        // An unknown block keeps its words as a paragraph.
        if ('children' in node) out.push({ type: 'paragraph', attrs: { sep }, content: inlineChildren((node as MdParent).children as PhrasingContent[], source) });
        else if ('value' in node && typeof node.value === 'string') out.push({ type: 'paragraph', attrs: { sep }, content: [{ type: 'text', text: node.value }] });
    }
    previous = node;
  }
  return out;
}

/** Stored passage markdown to a Tiptap document (JSON). */
export function markdownToDoc(text: string,options:{links?:boolean}={}): JSONContent {
  const content = blockChildren(fromMarkdown(text, options.links?LINK_PARSE_OPTIONS:PARSE_OPTIONS).children, text);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph', attrs: { sep: 'blank' } }] };
}

// ── Serialiser ──────────────────────────────────────────────────────────────

// Markdown characters typed into plain prose that would be misread as
// formatting on the next load. Only what this bridge interprets is escaped,
// and only where it would bind: a backslash before punctuation, an emphasis
// delimiter that is not floating in whitespace (an underscore inside a word
// never opens emphasis, so it stays), and a backtick.
export {docToMarkdown} from './wf-block-serialize.mjs';

// ── Editor extensions ───────────────────────────────────────────────────────

// The attributes the bridge relies on, kept off the DOM (rendered: false) so
// they never show and never parse from pasted html.
export const PassageMarkdownAttributes = Extension.create({
  name: 'passageMarkdownAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote'],
        attributes: { sep: { default: null, rendered: false } },
      },
      {
        types: ['bulletList', 'orderedList'],
        attributes: { tight: { default: true, rendered: false } },
      },
      {types:['link'],attributes:{markdownDestination:{default:null,rendered:false}}},
      {
        types: ['bold', 'italic'],
        attributes: { markup: { default: null, rendered: false } },
      },
    ];
  },
});

/** The extension set for one passage editor: exactly the nodes the bridge
 *  serialises, nothing the passages do not use. */
export function passageEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      link: {autolink:false,linkOnPaste:false,openOnClick:false,isAllowedUri:safePassageHref,HTMLAttributes:{target:'_blank',rel:'noopener noreferrer',class:null}},
      underline: false,
      dropcursor: false,
      gapcursor: false,
      trailingNode: false,
    }),
    PassageMarkdownAttributes,
  ];
}
