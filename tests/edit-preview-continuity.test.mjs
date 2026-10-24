import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(new URL('../runtime/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const script = fs.readFileSync(new URL('../public/document-study/draft-flow.js', import.meta.url), 'utf8');
// C01/C02/C04/C05/C06; S05/S06: one Write surface preserves its exact working buffer.
const STORAGE = 'ar-document-study-owned-drafts-v1';
const parent = 'invented-writing-project', primary = 'invented-first-part', sibling = 'invented-second-part';
const tick = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const plain = value => JSON.parse(JSON.stringify(value));
function savedResult(id, words = id === primary ? 'Saved first passage.' : 'Saved sibling passage.') {
  return {
    binding: {id, parentStudyId: parent, parentStudyKey: parent, originalId: id, partKey: id, title: id, authority: 'owned-working-copy', status: 'ready', canonicalOutputId: id + '-output'},
    raw: words,
    expected: {workflow: {draft: createHash('sha256').update(words).digest('hex')}, bindingHash: 'binding-' + id, correspondenceHash: 'paragraphs-' + id},
    projection: [{id: id + '-paragraph', blockKind: 'paragraph', safe: true, words, raw: words, blockHash: 'block-' + words}],
    history: [], paths: {draft: '/invented/' + id + '.md'}, context: {records: []}
  };
}
function fixture(t) {
  const dom = new JSDOM('<main id="app"></main>', {url: 'http://localhost/document-study/', runScripts: 'outside-only'});
  const w = dom.window, d = w.document, calls = [];
  const p = {id: parent, name: 'Invented writing project', view: 'record', viewedStage: 9, blocks: [], title: 'Invented title', history: [], note: null, originalNotes: [], rev: 1};
  let saveReply = async () => ({ok: false, status: 503, json: async () => ({error: 'Invented offline save; pending words retained.'})});
  w.localStorage.setItem('ar-document-study-draft-pieces-v1', JSON.stringify({ids: [parent]}));
  w.state = {projects: [p]}; w.current = () => p;
  w.selected = null; w.activeBlock = null; w.keyboardBlock = null; w.typingSession = null;
  w.esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  w.readonlyHTML = value => value; w.shortRecordName = value => value; w.WORKFLOW_RECORDS = {};
  w.toast = () => {}; w.commitTyping = () => {}; w.rememberPosition = () => {};
  w.blockHTML = block => '<' + block.tag + ' data-block="' + block.id + '">' + block.html + '</' + block.tag + '>';
  w.article = project => '<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">' + project.blocks.map(w.blockHTML).join('') + '</div><aside id="margin"></aside><div class="marginHint"></div>';
  w.phaseReader = () => '<p>Invented retained record</p>';
  w.render = () => { d.getElementById('app').innerHTML = p.view === 'article' ? w.article(p) : w.phaseReader(p); w.wireDocument(); };
  w.save = () => {};
  w.onTyping = editor => { p.blocks = [...editor.children].map(child => ({id: child.dataset.block, tag: child.tagName.toLowerCase(), html: child.innerHTML, source: 'Owned'})); };
  w.viewPhase = stage => { p.viewedStage = stage; p.view = 'record'; w.render(); };
  w.setView = view => { p.view = view; w.render(); };
  for (const name of ['undo', 'refreshDiscussion', 'wireDocument', 'openInstruction']) w[name] = () => {};
  w.workflowBar = () => ''; w.historicalNotice = () => '';
  Object.defineProperty(w, 'crypto', {value: webcrypto}); w.TextEncoder = TextEncoder;
  Object.defineProperty(d, 'scrollingElement', {value: d.documentElement});
  // Hold ordinary idle/retry timers so this suite measures the mode switch itself.
  // Explicit flush remains real, including its in-flight and failed recovery states.
  const timeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, delay, ...args) => delay >= 1000 ? 0 : timeout(fn, delay, ...args);
  w.fetch = async (url, options) => {
    const route = new URL(url, w.location.href), body = options?.body ? JSON.parse(options.body) : undefined;
    calls.push({path: route.pathname, query: Object.fromEntries(route.searchParams), body});
    if (route.pathname.endsWith('/catalog')) return {ok: true, json: async () => ({drafts: [primary, sibling].map(id => ({originalId: id, parentStudyId: parent, parentStudyKey: parent, bindingId: id, bindingStatus: 'ready', partKey: id, title: id}))})};
    if (route.pathname.endsWith('/read')) return {ok: true, json: async () => savedResult(route.searchParams.get('bindingId'))};
    if (route.pathname.endsWith('/save')) return saveReply(body);
    throw Error('Unexpected request ' + url);
  };
  w.eval(script);
  t.after(() => w.close());
  return {
    w, d, p, calls,
    disk: () => JSON.parse(w.localStorage.getItem(STORAGE)),
    open: async (id = primary) => { await w.studyDraft.openBinding({bindingId: id, parentStudyId: parent}); await tick(); },
    type: words => { const editor = d.getElementById('manuscript'); editor.firstElementChild.textContent = words; w.onTyping(editor); },
    setSaveReply: fn => { saveReply = fn; }
  };
}
function selection(f, start, end = start) {
  const editor = f.d.getElementById('manuscript'), text = editor.firstElementChild.firstChild;
  editor.focus();
  const range = f.d.createRange(); range.setStart(text, start); range.setEnd(text, end);
  const selected = f.w.getSelection(); selected.removeAllRanges(); selected.addRange(range);
  return {editor, range, text};
}
function assertEditingPosition(f, original, start, end, scroll) {
  assert.strictEqual(f.d.getElementById('manuscript'), original.editor, 'mode switches retain the existing editor owner');
  const range = f.w.getSelection().getRangeAt(0);
  assert.strictEqual(range.startContainer, original.text); assert.strictEqual(range.endContainer, original.text);
  assert.equal(range.startOffset, start); assert.equal(range.endOffset, end);
  assert.equal(original.editor.scrollTop, scroll.editor); assert.equal(f.d.scrollingElement.scrollTop, scroll.page);
}
function retainedWriting(f, id = primary) {
  const value = f.disk().documents[id];
  return plain({blocks: value.blocks, base: value.base, expected: value.expected, history: value.history, note: value.note, sequence: value.sequence, signature: value.signature, pending: value.pending ?? null, status: value.status, error: value.error ?? null, serverHistory: value.serverHistory});
}

for (const [name, start, end] of [['selection', 8, 22], ['caret', 19, 19]]) {
  test('Edit → Preview → Edit keeps unsaved words, exact ' + name + ' and scroll without a save or read', async t => {
    const f = fixture(t); await f.open();
    const words = 'Unsaved exact wording — 茶, ==still pending==. Second sentence.';
    f.type(words); f.p.history = [{label: 'Invented local revision', blocks: plain(f.p.blocks)}]; f.p.note = {anchor: primary + '-paragraph', text: 'Retained author note'}; f.w.save();
    const position = selection(f, start, end), scroll = {editor: 183, page: 407};
    position.editor.scrollTop = scroll.editor; f.d.scrollingElement.scrollTop = scroll.page;
    const before = retainedWriting(f), proof = plain(f.w.studyDraft.currentProof()), binding = plain(f.w.studyDraft.currentBinding()), requests = f.calls.length;
    f.w.studyDraft.read(); await tick();
    assert.equal(f.w.studyDraft.viewMode(), 'preview'); assert.equal(f.p.viewedStage, 5); assert.equal(f.p.view, 'article');
    assert.strictEqual(f.d.getElementById('manuscript'), position.editor); assert.equal(position.editor.getAttribute('contenteditable'), 'false'); assert.equal(position.editor.textContent, words);
    assert.equal(f.calls.length, requests, 'Preview never reads or flushes the working file');
    assert.deepEqual(retainedWriting(f), before); assert.deepEqual(plain(f.w.studyDraft.currentBinding()), binding); assert.deepEqual(plain(f.w.studyDraft.currentProof()), proof);
    f.w.studyDraft.edit(); await tick();
    assert.equal(f.w.studyDraft.viewMode(), 'edit'); assert.equal(position.editor.getAttribute('contenteditable'), 'true'); assert.equal(position.editor.textContent, words);
    assertEditingPosition(f, position, start, end, scroll); assert.deepEqual(retainedWriting(f), before); assert.equal(f.calls.length, requests);
  });
}

test('legacy stage 6 opens Preview of current working words in the single Write section', async t => {
  const f = fixture(t); await f.open(); f.type('Legacy route keeps these unsaved words.');
  const editor = f.d.getElementById('manuscript'), before = retainedWriting(f), requests = f.calls.length;
  f.w.viewPhase(6); await tick();
  assert.equal(f.p.viewedStage, 5); assert.equal(f.w.studyDraft.viewMode(), 'preview'); assert.strictEqual(f.d.getElementById('manuscript'), editor);
  assert.equal(editor.textContent, 'Legacy route keeps these unsaved words.'); assert.deepEqual(retainedWriting(f), before); assert.equal(f.calls.length, requests);
  f.w.viewPhase(5); await tick(); assert.equal(f.w.studyDraft.viewMode(), 'edit'); assert.strictEqual(f.d.getElementById('manuscript'), editor);
});

test('offline failed save retains its exact pending request and recovery while modes change', async t => {
  const f = fixture(t); await f.open(); f.type('Words retained after an invented failed save.'); await f.w.studyDraft.flush();
  const before = retainedWriting(f), requests = f.calls.length;
  assert.ok(before.pending); assert.equal(before.status, 'Recover save'); assert.equal(f.w.studyDraft.currentProof().dirty, true);
  f.w.studyDraft.read(); await tick();
  assert.equal(f.w.studyDraft.viewMode(), 'preview'); assert.equal(f.p.viewedStage, 5);
  assert.match(f.d.getElementById('app').textContent, /Words retained after an invented failed save/);
  assert.match(f.d.getElementById('app').textContent, /Recover save|offline save/);
  f.w.studyDraft.edit(); await tick();
  assert.deepEqual(retainedWriting(f), before); assert.equal(f.calls.length, requests, 'toggle never retries or replaces a pending request');
  assert.equal(f.calls.filter(call => call.body).length, 1); assert.equal(f.calls.some(call => /approve|discard|undo|recover/.test(call.path)), false);
});

test('delayed save stays bound to its owner while Preview and a different part are opened', async t => {
  const f = fixture(t); await f.open(); f.type('First owner words awaiting confirmation.');
  let release; const held = new Promise(resolve => { release = resolve; });
  f.setSaveReply(async () => { await held; return {ok: true, json: async () => savedResult(primary, 'First owner words awaiting confirmation.')}; });
  const saving = f.w.studyDraft.flush(); await tick();
  const pending = retainedWriting(f).pending, requests = f.calls.length; assert.ok(pending);
  f.w.studyDraft.read(); await tick(); assert.equal(f.calls.length, requests); assert.deepEqual(retainedWriting(f).pending, pending);
  await f.open(sibling);
  assert.equal(f.w.studyDraft.currentBinding().id, sibling); assert.equal(f.w.studyDraft.viewMode(), 'edit', 'new part does not inherit another part’s Preview');
  f.type('Second owner words must stay here.'); const second = retainedWriting(f, sibling); const position = selection(f, 7, 12);
  position.editor.scrollTop = 91; f.d.scrollingElement.scrollTop = 122;
  f.w.studyDraft.read(); await tick(); release(); await saving; await tick(); f.w.studyDraft.edit(); await tick();
  assert.equal(f.w.studyDraft.currentBinding().id, sibling); assert.equal(f.d.getElementById('manuscript').textContent, 'Second owner words must stay here.');
  assert.deepEqual(retainedWriting(f, sibling), second); assertEditingPosition(f, position, 7, 12, {editor: 91, page: 122});
  assert.equal(f.calls.filter(call => call.path.endsWith('/save')).length, 1, 'mode switches never submit a second owner save');
});
