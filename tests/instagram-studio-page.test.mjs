// The Instagram studio page's slide studio (piece 6 of Direction D), run in a DOM with invented records: codes before
// names in the layout chooser grouped by row, the code in the slide caption, the find field, saying codes, the look and
// the account, placed things, saving a slide as a template, and assistants' proposals that only Adrian accepts. Every
// action must call the one command an assistant would call. Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(new URL('../runtime/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const SCRIPT = fs.readFileSync(new URL('../public/document-study/instagram-studio.js', import.meta.url), 'utf8');
const CSS_TEXT = fs.readFileSync(new URL('../public/document-study/instagram-studio.css', import.meta.url), 'utf8');
const PLAN_ID = '11111111-2222-4333-8444-555555555555';

const T = (id, code, name, rowLetter, row, extra = {}) => ({id, code, name, rowLetter, row, kind: 'inner', formats: ['post', 'carousel', 'story'], photos: 1, textParts: 1, maxChars: 400, onlyIn: null, ...extra});
const TEMPLATES = [
 T('canvas-P06-night', 'C1', 'Night bleed', 'C', 'Covers', {kind: 'cover'}),
 T('H6', 'C1', 'Night bleed', 'C', 'Covers', {kind: 'cover'}),
 T('canvas-N13-cover-box', 'C2', 'Journey cover, logo in a box', 'C', 'Covers', {kind: 'cover'}),
 T('canvas-N06-box-top-black', 'B1', 'Black box top, quote', 'B', 'Full photo with a box', {maxChars: 16}),
 T('canvas-J01-jia-fill', 'J1', 'Invented jiā layout', 'J', 'The three jiā', {kind: 'single', onlyIn: 'teajia'}),
 T('own-mine', 'C5', 'Invented one of mine', 'C', 'Covers', {owner: true, looks: ['teajia'], kind: 'cover'}),
];
const ACCOUNTS = [{id: 'teajia', name: 'Teajia', looks: ['teajia']}, {id: 'technician-of-the-sacred', name: 'Technician of the Sacred', looks: ['art']}, {id: 'second-art', name: 'Invented second account', looks: ['art']}];
function planOf({look = 'teajia', account = {id: 'teajia', name: 'Teajia', from: 'plan', postsLook: true}, frames} = {}) {
 return {id: PLAN_ID, title: 'Invented plan', revision: 3, hash: 'a'.repeat(64), door: 'teajia', drawnIn: {id: look, from: look === 'teajia' ? 'door' : 'look'}, account,
  material: {transcripts: [], photos: []}, lines: [{id: 'L1', text: 'Invented words, said slowly, for a test.', speaker: ''}], moments: [], coverage: null,
  stories: [{id: 'S1', title: 'Invented story', dish: 'A dish', readback: 'It says this.', spine: ['L1'], matches: [], format: 'carousel', by: 'agent:claude-code'}],
  gaps: [], flags: [], flagStatus: [], chosen: {storyId: 'S1', named: '', forWhom: ''}, heard: null, ready: {}, publishHold: null,
  layouts: {carousel: {storyId: 'S1', format: 'carousel', builtBy: 'agent:claude-code', caption: {parts: [], text: '', by: ''}, captionFinal: null,
   frames: frames || [
    {templateId: 'H6', role: 'cover', words: [{lineId: 'L1', text: 'Invented words, said slowly, for a test.'}], label: '', credit: '', photos: []},
    {templateId: 'canvas-N06-box-top-black', role: 'inner', words: [{lineId: 'L1', text: 'Invented words'}], label: '', credit: '', photos: [], placed: [{kind: 'mark', asset: 'seal-home', x: 900, y: 72, width: 96, height: 96, z: 0, tone: 'dark'}]},
   ]}}};
}

async function studio({actor = 'human:adrian', plan = planOf(), reply = {}} = {}) {
 const dom = new JSDOM('<!doctype html><html><head><style>' + CSS_TEXT + '</style></head><body></body></html>', {url: 'http://studio.test/document-study/index.html', runScripts: 'outside-only', pretendToBeVisual: true});
 const w = dom.window, posts = [];
 let current = plan;
 w.crypto.randomUUID = () => webcrypto.randomUUID();
 w.CSS = {escape: v => String(v).replace(/["\\]/g, '\\$&')};
 w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
 w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
 w.arCreateUiActor = {actor};
 const json = (body, status = 200) => ({ok: status < 400, status, json: async () => body});
 w.fetch = async (url, options = {}) => {
  const u = new URL(url, 'http://studio.test'), q = k => u.searchParams.get(k);
  if (options.method === 'POST') {
   const body = JSON.parse(options.body); posts.push({path: u.pathname, body, actor: options.headers['X-AR-Actor']});
   const r = reply[u.pathname]; if (r) { const out = typeof r === 'function' ? r(body, current) : r; if (out.status >= 400) return json({error: out.error}, out.status); if (out.id === PLAN_ID) current = out; return json(out); }
   return json(current);
  }
  if (u.pathname === '/api/instagram/plans') return json({plans: [{id: PLAN_ID, title: 'Invented plan'}]});
  if (u.pathname === '/api/instagram/plan') return json(current);
  if (u.pathname === '/api/instagram/templates') return json({templates: TEMPLATES});
  if (u.pathname === '/api/looks') return json({looks: [{id: 'art', name: 'Invented Art name'}, {id: 'teajia', name: 'Teajia'}]});
  if (u.pathname === '/api/templates') return json({templates: [{id: 'own-proposed', name: 'Invented proposal', rowLetter: 'F', row: 'Full picture', formats: ['carousel'], looks: null, proposedBy: 'agent:claude-code', revision: 1, hash: 'b'.repeat(64)}], next: {C: 'C6', B: 'B4', F: 'F7'}});
  if (u.pathname === '/api/accounts') return json({look: q('look'), accounts: ACCOUNTS, forLook: ACCOUNTS.filter(a => a.looks.includes(q('look'))).map(a => a.id)});
  if (u.pathname === '/api/look/assets') return json({assets: q('id') === 'teajia' ? [{id: 'seal-home', name: 'Seal 家, home', kind: 'mark', text: '家'}] : [{id: 'wordmark', name: 'Invented wordmark', kind: 'logo'}]});
  if (u.pathname === '/api/look') return json({roles: null});
  return json({error: 'not in this test'}, 404);
 };
 w.eval(SCRIPT);
 await w.arInstagram.open({planId: PLAN_ID});
 const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
 const settle = () => new Promise(r => setTimeout(r, 20));
 return {w, $, $$, posts, settle, plan: () => current, close: async () => { w.document.body.textContent = ''; await new Promise(r => setTimeout(r, 30)); w.close(); }};
}

test('every layout in the chooser shows its code before its name, under its row and the row letter; old twins are not listed twice', async t => {
 const s = await studio(); t.after(s.close);
 const heads = s.$$('.igs-pbody .igs-group h3').map(h => h.textContent.replace(/\s+/g, ' ').trim());
 assert.deepEqual(heads, ['Proposed by assistants 1', 'Yours 1', 'C Covers 2', 'B Full photo with a box 1', 'J The three jiā 1']);
 const names = s.$$('[data-igs="use"] .igs-tname').map(n => n.textContent);
 assert.deepEqual(names, ['C5 Invented one of mine', 'C1 Night bleed', 'C2 Journey cover, logo in a box', 'B1 Black box top, quote', 'J1 Invented jiā layout']);
 for (const n of s.$$('[data-igs="use"] .igs-tname')) assert.equal(n.firstElementChild.className, 'igs-code', 'the code comes first');
 // The slide on the old id H6 is C1: its caption and its place in the strip say so, and C1 is the one pressed.
 assert.match(s.$('.igs-capline').textContent, /Slide 1 · Cover · C1 Night bleed/);
 assert.deepEqual(s.$$('.igs-frame figcaption .igs-code').map(c => c.textContent), ['C1', 'B1']);
 assert.equal(s.$('[data-igs="use"][aria-pressed="true"]').dataset.id, 'canvas-P06-night');
 // Each layout's picture is this slide drawn in it, read through the preview command.
 assert.match(s.$('[data-igs="use"][data-id="canvas-N13-cover-box"] iframe').getAttribute('src'), /^\/api\/instagram\/preview\?id=[^&]+&format=carousel&frame=0&layout=canvas-N13-cover-box&plain=1/, 'drawn without the slide\'s placed things');
 assert.doesNotMatch(s.$('.igs-big iframe').getAttribute('src'), /preview|plain/, 'the large slide keeps them');
});

test('the find field filters layouts by code or by name, and says when nothing matches', async t => {
 const s = await studio(); t.after(s.close);
 const visible = () => s.$$('[data-igs="use"]').filter(b => !b.closest('.igs-cell').hidden).map(b => b.querySelector('.igs-code').textContent);
 const find = s.$('[data-igs="filter"]');
 for (const [q, want] of [['c1', ['C1']], ['C 2', ['C2']], ['box', ['C2', 'B1']], ['b', ['B1']], ['', ['C5', 'C1', 'C2', 'B1', 'J1']]]) {
  find.value = q; find.dispatchEvent(new s.w.Event('input', {bubbles: true}));
  assert.deepEqual(visible(), want, q);
 }
 find.value = 'nothing like it'; find.dispatchEvent(new s.w.Event('input', {bubbles: true}));
 assert.equal(s.$('.igs-none').hidden, false);
 assert.ok(s.$$('.igs-pbody [data-group]').every(g => g.hidden), 'empty rows are hidden too');
});

test('pressing a layout calls instagram.layout for that slide only, cutting words at a pause to what the layout holds', async t => {
 const s = await studio(); t.after(s.close);
 s.$('[data-igs="slide"][data-n="0"]').click();
 s.$('[data-igs="use"][data-id="canvas-N06-box-top-black"]').click(); await s.settle();
 const p = s.posts.at(-1);
 assert.equal(p.path, '/api/instagram/layout');
 assert.equal(p.body.frames[0].templateId, 'canvas-N06-box-top-black');
 assert.equal(p.body.frames[0].words[0].text, 'Invented words', 'cut at the last pause that fits, an exact slice');
 assert.equal(p.body.frames[1].templateId, 'canvas-N06-box-top-black');
 assert.deepEqual(p.body.frames[1].placed, planOf().layouts.carousel.frames[1].placed, 'the other slide is sent as it was');
 assert.equal(p.body.expectedRevision, 3);assert.equal(p.body.expectedHash, 'a'.repeat(64));
});

test('the say line sends his words to instagram.plan.codes and says plainly what it used and what it could not', async t => {
 const s = await studio({reply: {'/api/instagram/plan/codes': (b, p) => ({...p, revision: 4, codes: {used: [{code: 'C2', name: 'Journey cover, logo in a box', slide: 1}], unused: [{code: 'C9', why: 'No layout has that code.'}]}})}}); t.after(s.close);
 const form = s.$('form[data-igs="say"]');
 assert.equal(form.querySelector('input').getAttribute('placeholder'), 'Say or type it: use C1, 2 and 5');
 form.querySelector('input').value = 'use C2 and 9';
 form.dispatchEvent(new s.w.Event('submit', {bubbles: true, cancelable: true})); await s.settle();
 assert.deepEqual(s.posts.at(-1), {path: '/api/instagram/plan/codes', actor: 'human:adrian', body: {...s.posts.at(-1).body, say: 'use C2 and 9', format: 'carousel', storyId: 'S1'}});
 const said = s.$$('.igs-heardline').map(p => p.textContent);
 assert.deepEqual(said, ['Built from what you said: slide 1 is C2 Journey cover, logo in a box.', 'Could not use C9: No layout has that code.']);
 assert.equal(s.$('form[data-igs="say"] input').value, 'use C2 and 9', 'what he said stays in the field to correct');
 // A line with no codes at all is the server's refusal, shown as it is.
 const t2 = await studio({reply: {'/api/instagram/plan/codes': {status: 400, error: 'No layout codes in that line. A code is a row letter and a number, like C1 or M2.'}}}); t.after(t2.close);
 const f2 = t2.$('form[data-igs="say"]');f2.querySelector('input').value = 'make it lighter';
 f2.dispatchEvent(new t2.w.Event('submit', {bubbles: true, cancelable: true})); await t2.settle();
 assert.match(t2.$('.igs-heardline.bad').textContent, /No layout codes in that line/);
});

test('the look shows the plan\'s look; a look that cannot draw a slide is not offered; rows of another brand leave the chooser', async t => {
 const withJia = planOf({frames: [{templateId: 'canvas-J01-jia-fill', role: 'cover', words: [{lineId: 'L1', text: 'Invented words'}], label: '', credit: '', photos: []}]});
 const s = await studio({plan: withJia}); t.after(s.close);
 assert.equal(s.$('[data-igs="look"][aria-pressed="true"]').dataset.id, 'teajia');
 const art = s.$('[data-igs="look"][data-id="art"]');
 assert.ok(art.disabled);assert.match(art.title, /Slide 1 of the Carousel uses J1, a Teajia layout/);
 const a = await studio({plan: planOf({look: 'art', account: {id: 'technician-of-the-sacred', name: 'Technician of the Sacred', from: 'look'}})}); t.after(a.close);
 assert.ok(!a.$$('[data-igs="use"]').some(b => /J1|C5/.test(b.textContent)), 'J rows and his Teajia-only template are not offered in Art');
});

test('changing the look of a plan whose account is written in chooses the new look\'s usual account in the same call, and says so', async t => {
 const s = await studio({reply: {'/api/instagram/look': (b, p) => ({...p, revision: 4, drawnIn: {id: b.look, from: 'look'}, account: {id: b.account, name: 'Technician of the Sacred', from: 'plan'}})}}); t.after(s.close);
 s.$('[data-igs="look"][data-id="art"]').click(); await s.settle(); await s.settle();
 const p = s.posts.at(-1);
 assert.equal(p.path, '/api/instagram/look');
 assert.deepEqual({look: p.body.look, account: p.body.account}, {look: 'art', account: 'technician-of-the-sacred'});
 assert.equal(s.$('.igs-note').textContent, 'Drawn in the Art look. Now posts to Technician of the Sacred.');
 // Art has two accounts here, so "Posts to" is a choice, and choosing one calls instagram.account.
 const choices = s.$$('[data-igs="account"]').map(b => b.textContent);
 assert.deepEqual(choices, ['Technician of the Sacred', 'Invented second account']);
 s.$('[data-igs="account"][data-id="second-art"]').click(); await s.settle();
 assert.deepEqual([s.posts.at(-1).path, s.posts.at(-1).body.account], ['/api/instagram/account', 'second-art']);
 // A plan whose account only follows its look sends the look alone.
 const f = await studio({plan: planOf({account: {id: 'teajia', name: 'Teajia', from: 'look'}})}); t.after(f.close);
 f.$('[data-igs="look"][data-id="art"]').click(); await f.settle(); await f.settle();
 assert.equal(Object.hasOwn(f.posts.at(-1).body, 'account'), false);
});

test('placed things: the look\'s marks are offered, placing, resizing and removing each call instagram.placed with the slide\'s whole list', async t => {
 const s = await studio(); t.after(s.close);
 s.$('[data-igs="slide"][data-n="1"]').click();
 s.$('[data-igs="ptab"][data-id="add"]').click();
 assert.deepEqual(s.$$('[data-igs="place"][data-id]').map(b => b.textContent), ['家Seal 家, home']);
 assert.equal(s.$$('.igs-big .igs-pl').length, 1, 'what is placed can be grabbed on the big slide');
 assert.equal(s.$('.igs-pl').getAttribute('tabindex'), '0', 'and reached by keyboard');
 s.$('[data-igs="place"][data-kind="rule"]').click(); await s.settle();
 let p = s.posts.at(-1);
 assert.equal(p.path, '/api/instagram/placed');assert.equal(p.body.slide, 2);assert.equal(p.body.format, 'carousel');
 assert.equal(p.body.placed.length, 2);assert.deepEqual(p.body.placed[1], {kind: 'rule', x: 410, y: 924, width: 260, height: 3});
 s.$('[data-igs="size"][data-n="0"][data-d="1"]').click(); await s.settle();
 p = s.posts.at(-1);assert.ok(p.body.placed[0].width > 96 && p.body.placed[0].width === p.body.placed[0].height, 'bigger, at its own shape');
 assert.ok(p.body.placed[0].x + p.body.placed[0].width <= 1080, 'never past the edge');
 s.$('[data-igs="unplace"][data-n="0"]').click(); await s.settle();
 assert.deepEqual(s.posts.at(-1).body.placed, []);
 const label = s.$('form[data-igs="label"]');label.querySelector('input').value = 'INVENTED 04';
 label.dispatchEvent(new s.w.Event('submit', {bubbles: true, cancelable: true})); await s.settle();
 assert.deepEqual(s.posts.at(-1).body.placed.at(-1), {kind: 'label', text: 'INVENTED 04', size: 30, x: 90, y: 114, width: 295});
});

test('save as a template shows the code it will get and calls instagram.template for this slide', async t => {
 const s = await studio({reply: {'/api/instagram/template': {id: 'own-new', code: 'C6', name: 'Invented save', status: 'kept'}}}); t.after(s.close);
 s.$('[data-igs="savet-open"]').click();
 assert.match(s.$('form[data-igs="savet"]').textContent, /It will be called C6, the next free code in Covers\./);
 const form = s.$('form[data-igs="savet"]');form.querySelector('[name="name"]').value = 'Invented save';
 form.dispatchEvent(new s.w.Event('submit', {bubbles: true, cancelable: true})); await s.settle();
 const p = s.posts.at(-1);
 assert.deepEqual({path: p.path, slide: p.body.slide, format: p.body.format, name: p.body.name, looks: p.body.looks}, {path: '/api/instagram/template', slide: 1, format: 'carousel', name: 'Invented save', looks: ['teajia']});
 assert.match(s.$('.igs-note').textContent, /Saved as C6, “Invented save”\. It is listed first under Yours\. Say C6 to use it again\./);
});

test('assistants\' proposals: Adrian sees Accept and Turn down and they call template.decide; an assistant only sees that it waits for him', async t => {
 const s = await studio({reply: {'/api/template/decide': {id: 'own-proposed', code: 'F7', name: 'Invented proposal', status: 'kept'}}}); t.after(s.close);
 assert.deepEqual(s.$$('.igs-prop button').map(b => b.textContent), ['Accept', 'Turn down']);
 s.$('[data-igs="accept"]').click(); await s.settle();
 const p = s.posts.at(-1);
 assert.deepEqual({path: p.path, id: p.body.id, decision: p.body.decision, rev: p.body.expectedRevision, hash: p.body.expectedHash}, {path: '/api/template/decide', id: 'own-proposed', decision: 'accept', rev: 1, hash: 'b'.repeat(64)});
 assert.match(s.$('.igs-note').textContent, /F7 now/);
 const a = await studio({actor: 'agent:claude-code'}); t.after(a.close);
 assert.equal(a.$$('[data-igs="accept"],[data-igs="turn-down"]').length, 0);
 assert.match(a.$('.igs-prop').textContent, /Waiting for Adrian/);
 a.$('[data-igs="savet-open"]').click();
 assert.match(a.$('form[data-igs="savet"]').textContent, /goes to Adrian as a proposal/);
});

test('nothing in the studio is set to scroll sideways: the made frames wrap', () => {
 assert.doesNotMatch(CSS_TEXT, /overflow-x:\s*(auto|scroll)/, 'no sideways scroll region in the studio');
 assert.match(CSS_TEXT, /\.igs-strip\{display:flex;flex-wrap:wrap/);
 const graphite = fs.readFileSync(new URL('../public/document-study/graphite-controls.css', import.meta.url), 'utf8');
 assert.equal(graphite.split('.igs-tile').length - 1, 2, 'picture tiles keep their own shape in both control sizes');
});

test('an empty Build says to type the codes first and calls nothing; there is no button that records sound', async t => {
 const s = await studio(); t.after(s.close);
 assert.equal(s.$('[data-igs="mic"]'), null);assert.doesNotMatch(SCRIPT, /SpeechRecognition|getUserMedia/);
 const form = s.$('form[data-igs="say"]');form.querySelector('input').value = '   ';
 const before = s.posts.length;
 form.dispatchEvent(new s.w.Event('submit', {bubbles: true, cancelable: true})); await s.settle();
 assert.equal(s.posts.length, before, 'nothing was sent');
 assert.equal(s.$('.igs-note').textContent, '');
 assert.equal(s.$('.igs-heardline.bad').textContent, 'Type the codes first, like “use C1, 2 and 5”.');
});

test('names he types, layout and account names and notes wrap rather than push the studio sideways', () => {
 const rule = sel => new RegExp('[^}]*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*\\{[^}]*overflow-wrap:anywhere[^}]*min-width:0');
 for (const sel of ['.igs-note', '.igs-capline p', '.igs-heardline', '.igs-one', '.igs-savet p', '.igs-panel h3', '.igs-prop .igs-tname', '.igs-on li>span', '.igs-tname']) assert.match(CSS_TEXT, rule(sel), sel);
 assert.match(CSS_TEXT, /\.igs \.igs-pills button\{max-width:100%;overflow:hidden;text-overflow:ellipsis\}/, 'a long account or look name is cut, with the whole name on hover');
});
