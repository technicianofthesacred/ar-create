// Adapted for ar-create: structured JSON is canonical; Study extensions retain attribution.
import React, { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { SourcedMark, InlineQuoteMark, ParaphraseMark, BlockquoteAttributedNode, ReferenceCardNode } from '../study/marks';
import { docToMarkdown, markdownToDoc, passageEditorExtensions } from './wf-block-markdown';

// One paragraph block of a passage as a live editor. It is always the editor:
// there is no rendered form that swaps for a raw one on click, so a click puts
// the caret where it landed and nothing above or below it moves or restyles.
// Headings read as headings, the keyword line as italics, and the markdown
// underneath is never on screen; wf-block-markdown carries it both ways.
//
// A drag over the words is the keep gesture. The editor reports every
// selection to the room, which decides whether it is long enough to act on.

// The live editor behind a paragraph's root element. Tests reach the editor
// this way to place the caret and select words, because jsdom has no layout
// for a real click to land on.
const editors = new WeakMap<Element, Editor>();
export function registerParagraphEditor(element:Element,editor:Editor){editors.set(element,editor);}
export function unregisterParagraphEditor(element:Element){editors.delete(element);}
export function paragraphEditorFor(element: Element | null): Editor | undefined {
  return element ? editors.get(element) : undefined;
}

export function InlineParagraph({ text, label, onChange, onBlur, onSelect, doc, onDocumentChange, onEditor, onBoundaryKey }: {
  text: string;
  doc?: JSONContent;
  onDocumentChange?: (doc: JSONContent) => void;
  onEditor?: (editor: Editor) => void;
  onBoundaryKey?: (editor: Editor, event: KeyboardEvent) => boolean;
  label: string;
  onChange: (text: string) => void;
  // The paragraph's current words, so the room can save them if they changed.
  onBlur: (text: string) => void;
  // The selected words, or an empty string when nothing is selected.
  onSelect: (picked: string) => void;
}) {
  // The last markdown this editor produced. An incoming `text` that matches
  // it is our own edit coming back through the room's state and must not
  // reset the document (that would throw the caret); anything else is a real
  // change from outside (a taken redo, a reload) and replaces the words.
  const emitted = useRef(text);
  const emittedDoc = useRef(doc ? JSON.stringify(doc) : null);
  // React may commit an earlier onUpdate snapshot after a later native
  // keystroke has reached ProseMirror. Those are acknowledgements of our own
  // edits, not instructions to replace the live document/selection.
  const ownSnapshots = useRef<string[]>([]);
  const callbacks = useRef({ onChange, onBlur, onSelect, onDocumentChange, onBoundaryKey });
  callbacks.current = { onChange, onBlur, onSelect, onDocumentChange, onBoundaryKey };

  const editor = useEditor({
    extensions: [...passageEditorExtensions(), SourcedMark, InlineQuoteMark, ParaphraseMark, BlockquoteAttributedNode, ReferenceCardNode],
    content: doc ?? markdownToDoc(text),
    editorProps: {
      handleKeyDown: (view,event) => {const live=editors.get(view.dom);return !!live&&!!callbacks.current.onBoundaryKey?.(live,event);},
      attributes: {
        class: 'wr-paragraph-editor wf-passage-document',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: live }) => {
      const markdown = docToMarkdown(live.getJSON());
      emitted.current = markdown;
      emittedDoc.current = JSON.stringify(live.getJSON());
      ownSnapshots.current.push(emittedDoc.current);
      if (ownSnapshots.current.length > 64) ownSnapshots.current.shift();
      callbacks.current.onChange(markdown);
      callbacks.current.onDocumentChange?.(live.getJSON());
    },
    onBlur: () => {
      callbacks.current.onBlur(emitted.current);
      ownSnapshots.current = [];
    },
    onSelectionUpdate: ({ editor: live }) => {
      const { from, to, empty } = live.state.selection;
      callbacks.current.onSelect(empty ? '' : live.state.doc.textBetween(from, to, '\n'));
    },
  }, []);

  useEffect(() => {
    if (!editor) return;
    editors.set(editor.view.dom, editor);
    onEditor?.(editor);
    return () => { editors.delete(editor.view.dom); };
  }, [editor]);

  // The label changes when a machine paragraph becomes Adrian's.
  useEffect(() => {
    if (!editor || editor.view.dom.getAttribute('aria-label') === label) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: 'wr-paragraph-editor wf-passage-document',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': label,
          spellcheck: 'true',
        },
      },
    });
  }, [editor, label]);

  useEffect(() => {
    if (!editor) return;
    const incoming = doc ?? markdownToDoc(text);
    // The schema normalizes attribute order/defaults, so an equivalent saved
    // JSON object is also an acknowledgement rather than a caret reset.
    const incomingNode = editor.schema.nodeFromJSON(incoming);
    const key = JSON.stringify(incomingNode.toJSON());
    if (incomingNode.eq(editor.state.doc) || key === emittedDoc.current || ownSnapshots.current.includes(key)) return;
    ownSnapshots.current = [];
    emitted.current = text;
    emittedDoc.current = key;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, text, doc]);

  return <EditorContent editor={editor} />;
}
