// Layout codes ("use C1, 2 and 5") and building a plan's layouts from them. Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import IG from '../runtime/src/donors/mag/carousel/ig-templates.js';
import {ROWS, ENTRIES, OLD_TWINS, hearCodes, entryForCode, resolvers} from '../runtime/src/donors/mag/carousel/ig-codes.mjs';
import {createInstagramStudio} from '../runtime/services/instagram-studio.mjs';
import {NEW_TEMPLATES, catalog, templateById, codeToLayoutId, layoutIdToCode, resolveLayoutId, renderFrame} from '../runtime/services/instagram-templates.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {describeRoutes, publicEntry} from '../runtime/commands.mjs';
import {run, SUGAR} from '../agents/cli/ar-create.mjs';

const ALL = [...Object.keys(IG.T), ...Object.keys(NEW_TEMPLATES)];

test('every layout has a code; no two layouts share one; every code names a real layout', () => {
 for (const id of ALL) assert.match(layoutIdToCode(id) || '', /^[A-Z]\d+$/, id + ' has no code');
 const codes = ENTRIES.map(e => e.code);
 assert.equal(new Set(codes).size, codes.length, 'a code appears twice in the table');
 assert.equal(new Set(ENTRIES.map(e => e.layout)).size, ENTRIES.length, 'a layout appears twice in the table');
 for (const e of ENTRIES) assert.ok(codeToLayoutId(e.code), e.code + ' names a missing layout (' + e.layout + ')');
 // Two different layouts never share a code, apart from an old hand-written layout and its canvas twin.
 const sharers = new Map();
 for (const id of ALL) { const c = layoutIdToCode(id); sharers.set(c, [...(sharers.get(c) || []), id]); }
 for (const [code, ids] of sharers) {
  const extra = ids.filter(id => id !== codeToLayoutId(code));
  assert.ok(extra.every(id => Object.hasOwn(OLD_TWINS, id)), code + ' is shared by ' + ids.join(', '));
 }
 assert.equal(ALL.length, ENTRIES.length + Object.keys(OLD_TWINS).length, 'every layout is the table\'s or an old twin');
});

test('codes follow the canvas rows and never skip a place in a row', () => {
 assert.deepEqual(ROWS.map(r => r.letter).join(''), 'CSPBMNFAJEYZR');
 for (const r of ROWS) r.items.forEach(([code], i) => assert.equal(code, r.letter + (i + 1)));
 assert.equal(layoutIdToCode('canvas-P06-night'), 'C1');
 assert.equal(layoutIdToCode('H1'), 'S1');
 assert.equal(layoutIdToCode('AR-S1'), 'R1');
 assert.equal(layoutIdToCode('AR-P1'), 'R4');
 assert.equal(entryForCode('e2').name, 'Come share a cup');
});

test('an old id shows as its canvas twin\'s code, and still resolves', () => {
 for (const [old, twin] of [['H6', 'C1'], ['F1', 'F1'], ['H4', 'P1'], ['H9', 'A3'], ['N9', 'M1'], ['M12', 'N1'], ['H10', 'E1']]) assert.equal(layoutIdToCode(old), twin);
 assert.equal(layoutIdToCode('H6'), layoutIdToCode('canvas-P06-night'));
 for (const old of Object.keys(OLD_TWINS)) assert.equal(resolveLayoutId(old), old, 'an id that exists is kept as it is');
 assert.equal(templateById('H6').id, 'H6');
});

test('a code resolves to a layout in any case, and unknown things come back unchanged', () => {
 assert.equal(codeToLayoutId('c1'), 'canvas-P06-night');
 assert.equal(codeToLayoutId(' C1 '), 'canvas-P06-night');
 assert.equal(codeToLayoutId('r3'), 'AR-R2');
 assert.equal(codeToLayoutId('C9'), null);
 assert.equal(resolveLayoutId('m2'), codeToLayoutId('M2'));
 assert.equal(resolveLayoutId('nonsense'), 'nonsense');
 assert.equal(resolveLayoutId(undefined), undefined);
 assert.ok(renderFrame('c1', {text: 'Hello'}, {}).includes('Hello'), 'rendering accepts a code');
 const own = resolvers({X: {}, 'canvas-A-x': {originalId: 'A'}});
 assert.equal(own.codeToLayoutId('C1'), null, 'a table entry without a layout in this catalogue resolves to nothing');
});

test('hearing codes: letters carry over, number words work, ordinary lines have no codes', () => {
 assert.deepEqual(hearCodes('use C1, 2 and 5').codes, ['C1', 'C2', 'C5']);
 assert.deepEqual(hearCodes('C one, M two and five, then E two').codes, ['C1', 'M2', 'M5', 'E2']);
 assert.deepEqual(hearCodes('c2 s4 p1').codes, ['C2', 'S4', 'P1']);
 assert.deepEqual(hearCodes('make it like the last one but lighter').codes, []);
 assert.deepEqual(hearCodes('').codes, []);
 assert.deepEqual(hearCodes(undefined).codes, []);
 assert.deepEqual(hearCodes('2 and 3, then C1').codes, ['C1'], 'a lone number before any letter is ignored');
 assert.deepEqual(hearCodes('C1. 2 is lovely').codes, ['C1'], 'a full stop ends the carry');
 assert.deepEqual(hearCodes("it's two o'clock, so use B two").codes, ['B2']);
 assert.deepEqual(hearCodes('use C twenty').codes, ['C20']);
});

test('ordinary speech is not read as codes', () => {
 assert.deepEqual(hearCodes('I have a 2 year old').codes, []);
 assert.deepEqual(hearCodes('We took a 3 hour walk with a 2 minute rest').codes, []);
 assert.deepEqual(hearCodes('C1 with 2 photos').codes, ['C1'], 'a number is not carried across other words');
 assert.deepEqual(hearCodes('use C1 for 2 photos and 5 words').codes, ['C1']);
 assert.deepEqual(hearCodes('A2 and a2').codes, ['A2', 'A2'], 'written together is always a code');
 assert.deepEqual(hearCodes('use a 2').codes, ['A2'], 'a spaced letter after "use" is a code');
 assert.deepEqual(hearCodes('C1, a 2').codes, ['C1', 'A2'], 'and straight after another code');
 assert.deepEqual(hearCodes('C1, 2 and 5').codes, ['C1', 'C2', 'C5'], 'commas and "and" still carry');
 assert.deepEqual(hearCodes('C1 then 2').codes, ['C1', 'C2']);
 assert.deepEqual(hearCodes('C1 2 5').codes, ['C1', 'C2', 'C5'], 'plain spaces between codes carry');
});

test('a leading zero is the canvas number, never a code', () => {
 const p = hearCodes('use P06');
 assert.deepEqual(p.usable, []);
 assert.deepEqual(p.unknown.map(u => u.code), ['P06']);
 assert.equal(p.unknown[0].reason, "P06 is the canvas's number for C1. Say C1.");
 const c = hearCodes('C01 and 02');
 assert.deepEqual(c.usable, []);
 assert.match(c.unknown[0].reason, /^C01 is the canvas's number for Y1/);
 assert.match(c.unknown[1].reason, /^C02 is the canvas's number for Y2/);
 assert.deepEqual(hearCodes('c1').usable, ['C1']);
});

test('codes that name no layout are reported, not guessed', () => {
 const h = hearCodes('use C1, 2 and 5');
 assert.deepEqual(h.usable, ['C1', 'C2']);
 assert.equal(h.unknown.length, 1);
 assert.equal(h.unknown[0].code, 'C5');
 assert.match(h.unknown[0].reason, /Row C \(Covers\) has 4 layouts/);
 const q = hearCodes('q3 and s 9 and c0');
 assert.deepEqual(q.unknown.map(u => u.code), ['Q3', 'S9', 'C0']);
 assert.match(q.unknown[0].reason, /no row Q/);
 assert.deepEqual(q.usable, []);
});

test('instagram.templates lists every layout in canvas row order with code, row, plain name and kind', async () => {
 const list = catalog();
 assert.equal(list.length, ALL.length);
 for (const t of list) for (const k of ['id', 'code', 'row', 'rowLetter', 'name', 'kind', 'formats', 'photos', 'roles', 'maxChars', 'look', 'group']) assert.ok(t[k] !== undefined && t[k] !== null, t.id + ' lacks ' + k);
 assert.deepEqual(list.slice(0, 5).map(t => t.code), ['C1', 'C1', 'C2', 'C3', 'C4'], 'the first row, the old twin right after its canvas layout');
 assert.deepEqual(list.slice(0, 2).map(t => t.id), ['canvas-P06-night', 'H6']);
 assert.equal(list[0].row, 'Covers');
 assert.equal(list[0].rowLetter, 'C');
 assert.equal(list[0].name, 'Night bleed');
 assert.equal(list[0].kind, 'cover');
 assert.equal(list.at(-1).code, 'R4');
 assert.equal(list.find(t => t.id === 'canvas-C05-close-teajia-dark').kind, 'close');
 const rank = new Map(ENTRIES.map((e, i) => [e.code, i]));
 assert.deepEqual(list.map(t => rank.get(t.code)), [...list.map(t => rank.get(t.code))].sort((a, b) => a - b));
 const studio = createInstagramStudio({dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ig-codes-')), library: {}});
 const answer = await studio.templates();
 assert.ok(answer.formats && answer.caption && answer.facts && answer.doors, 'the fields it had are still there');
 assert.equal(answer.templates[0].code, 'C1');
 assert.ok(answer.templates.every(t => t.catalogName !== undefined), 'the catalogue\'s own name is kept');
});

test('the browser copy of the catalogue carries the codes', async () => {
 const file = path.resolve('public/document-study/donor/ig-templates.browser.js');
 if (!fs.existsSync(file)) return; // made by npm run build
 const context = vm.createContext({});
 context.window = context;
 for (const name of ['layouts.js', 'catalog-browser.js', 'ig-templates.browser.js']) vm.runInContext(fs.readFileSync(path.join(path.dirname(file), name), 'utf8'), context);
 const window = context;
 assert.equal(window.STUDY_CATALOG['canvas-P06-night'].code, 'C1');
 assert.equal(window.STUDY_CATALOG.H6.code, 'C1');
 assert.equal(window.STUDY_CATALOG_CODES.layouts[0].code, 'C1');
 assert.ok(Object.keys(window.STUDY_CATALOG).every(id => window.STUDY_CATALOG[id].code), 'every browser layout has a code');
});

/* ---------- build a plan's layouts by codes ---------- */
const TRANSCRIPT = 'Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.\n\nMender: When I sit with one bowl for a whole day, my own day gets quieter.\n\nMender: A mended bowl is like a person who kept going. I want to teach this, so the craft does not stop with me.';
const T_ID = '11111111-2222-4333-8444-555555555555', T_HASH = crypto.createHash('sha256').update(TRANSCRIPT).digest('hex');
const PHOTOS = ['21111111-2222-4333-8444-555555555555', '31111111-2222-4333-8444-555555555555', '41111111-2222-4333-8444-555555555555'];
const library = {snapshot: async (id, {includeBody} = {}) => { if (id === T_ID) return {id, hash: T_HASH, path: '/x/talk.md', text: includeBody ? TRANSCRIPT : undefined}; const i = PHOTOS.indexOf(id); if (i >= 0) return {id, hash: 'b'.repeat(64), path: '/x/photo-' + i + '.jpg'}; throw Error('missing'); }};
const as = (actor, fn) => withActor({actor, client: 'http'}, fn);
const op = () => crypto.randomUUID();
const ADRIAN = 'human:adrian', AGENT = 'agent:claude-code';
const material = {transcripts: [{sourceId: T_ID, sourceHash: T_HASH}], photos: PHOTOS.map((sourceId, i) => ({sourceId, caption: ['The mended bowl', 'Kettle over coals', 'By the river'][i]}))};
const stories = lines => { const id = t => lines.find(l => l.text.startsWith(t)).id; return [
 {title: 'Every crack is a record', readback: 'Cracks record the people who used the bowl.', dish: 'A reel about marks of use.', why: 'The strongest line.', reader: 'The maker', format: 'reel', spine: [id('I think every crack'), id('A mended bowl'), id('I want to teach')], matches: [{photoId: 'P1', lineId: id('I think every crack'), why: 'The seam.'}, {photoId: 'P3', lineId: id('I want to teach'), why: 'Open water.'}]},
 {title: 'A quieter day', readback: 'A day with one bowl is quieter.', dish: 'A story about slowing down.', why: 'Simple and true.', reader: 'The daily meditator', format: 'story', spine: [id('When I sit')], matches: [{photoId: 'P2', lineId: id('When I sit'), why: 'The kettle.'}]},
]; };
async function start(door = 'art') {
 const s = createInstagramStudio({dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ig-codes-')), library});
 const created = await as(AGENT, () => s.propose({operationId: op(), subject: 'proj-1', title: 'The mender', door, material}));
 const p = await as(AGENT, () => s.propose({id: created.id, operationId: op(), expectedRevision: created.revision, expectedHash: created.hash, stories: stories(created.lines)}));
 return {s, p};
}
const base = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});

test('a spoken line sets the carousel layouts in order, through the same path as instagram.layout', async () => {
 const {s, p} = await start('teajia');
 const out = await as(AGENT, () => s.codes({...base(p), storyId: 'S1', say: 'use C1, 2 and 4'}));
 assert.deepEqual(out.layouts.carousel.frames.map(f => f.templateId), ['canvas-P06-night', 'canvas-N13-cover-box', 'canvas-M03-grid-box']);
 assert.deepEqual(out.codes.used.map(u => [u.code, u.slide]), [['C1', 1], ['C2', 2], ['C4', 3]]);
 assert.deepEqual(out.codes.unused, []);
 assert.equal(out.revision, p.revision + 1);
 assert.equal(out.updatedBy, AGENT);
 assert.equal(out.layouts.carousel.builtBy, AGENT);
 assert.equal(out.layouts.carousel.storyId, 'S1');
 assert.ok(out.layouts.carousel.frames.every(f => f.words.every(w => out.lines.find(l => l.id === w.lineId).text.includes(w.text))), 'words stay his exact slices');
 const html = await s.render({id: p.id, format: 'carousel', frame: 1});
 assert.match(html, /<!doctype html>/);
 const plan = JSON.parse(fs.readFileSync(path.join(s.asksFile(p.id), '..', p.id + '.json'), 'utf8'));
 assert.ok(plan.operations.some(o => o.actor === AGENT && /^codes carousel C1 C2 C4/.test(o.what)), 'the journal line says what was done');
});

test('codes may be given as a list, any case, and an old plan\'s ids are untouched', async () => {
 const {s, p} = await start('teajia');
 const out = await as(AGENT, () => s.codes({...base(p), storyId: 'S1', codes: ['s1', 'P1']}));
 assert.deepEqual(out.layouts.carousel.frames.slice(0, 2).map(f => f.templateId), ['H1', 'canvas-P04-plate-black']);
 assert.equal(out.layouts.carousel.frames[2].templateId, 'F1', 'the third slide keeps its layout');
 // instagram.layout takes a code or an old id in a frame, and stores the real id.
 const line = out.lines.find(l => l.text.startsWith('I think every crack'));
 const frames = ['H6', 'c2'].map(templateId => ({templateId, words: [{lineId: line.id, text: line.text}], photos: [{photoId: 'P1'}]}));
 const set = await as(AGENT, () => s.layout({...base(out), storyId: 'S1', format: 'carousel', frames}));
 assert.deepEqual(set.layouts.carousel.frames.map(f => f.templateId), ['H6', 'canvas-N13-cover-box']);
});

test('use F1 stores the canvas layout for F1, not the old hand-written F1', async () => {
 const {s, p} = await start('teajia');
 const out = await as(AGENT, () => s.codes({...base(p), storyId: 'S1', say: 'use F1'}));
 assert.equal(out.layouts.carousel.frames[0].templateId, 'canvas-F01-full-quote');
 assert.equal(out.codes.used[0].layout, 'canvas-F01-full-quote');
 const line = out.lines.find(l => l.text.startsWith('I think every crack'));
 const frames = ['F1', 'F1'].map(templateId => ({templateId, words: [{lineId: line.id, text: line.text}], photos: [{photoId: 'P1'}]}));
 const old = await as(AGENT, () => s.layout({...base(out), storyId: 'S1', format: 'carousel', frames}));
 assert.equal(old.layouts.carousel.frames[0].templateId, 'F1', 'an old frame sent to instagram.layout keeps its id');
 const zero = await as(AGENT, () => s.codes({...base(old), storyId: 'S1', say: 'P06 and C2'}));
 assert.deepEqual(zero.codes.unused.map(u => u.code), ['P06']);
 assert.match(zero.codes.unused[0].why, /canvas's number for C1/);
});

test('more codes than slides: the extra codes are reported and no slide is invented', async () => {
 const {s, p} = await start('teajia');
 const out = await as(AGENT, () => s.codes({...base(p), storyId: 'S2', say: 'C1, C2, C3 and C4'}));
 assert.equal(out.layouts.carousel.frames.length, 2, 'the quieter story has two slides');
 assert.deepEqual(out.codes.used.map(u => u.code), ['C1', 'C2']);
 assert.deepEqual(out.codes.unused.map(u => u.code), ['C3', 'C4']);
 assert.match(out.codes.unused[0].why, /only 2 slides/);
});

test('fewer codes than slides: the later slides keep the layout they have', async () => {
 const {s, p} = await start('teajia');
 const before = await as(AGENT, () => s.layout({...base(p), storyId: 'S1', format: 'carousel'}));
 const out = await as(AGENT, () => s.codes({...base(before), storyId: 'S1', say: 'use C3'}));
 const was = before.layouts.carousel.frames, now = out.layouts.carousel.frames;
 assert.equal(now.length, was.length);
 assert.equal(now[0].templateId, 'canvas-M01-triptych');
 assert.deepEqual(now.slice(1).map(f => f.templateId), was.slice(1).map(f => f.templateId));
});

test('codes that name no layout, or a layout made for another format, are reported and their slide keeps its layout', async () => {
 const {s, p} = await start();
 const out = await as(AGENT, () => s.codes({...base(p), storyId: 'S1', say: 'C1, C9 and R1'}));
 assert.deepEqual(out.codes.used.map(u => u.code), ['C1']);
 assert.deepEqual(out.codes.unused.map(u => u.code), ['C9', 'R1']);
 assert.match(out.codes.unused[0].why, /has 4 layouts/);
 assert.match(out.codes.unused[1].why, /made for story/);
 assert.equal(out.layouts.carousel.frames[1].templateId, 'AR-P1');
 await assert.rejects(as(AGENT, () => s.codes({...base(out), storyId: 'S1', say: 'C9'})), e => e.status === 400, 'nothing usable is an error, not a silent save');
 await assert.rejects(as(AGENT, () => s.codes({...base(out), storyId: 'S1', say: 'make it like the last one but lighter'})), e => e.status === 400 && /No layout codes/.test(e.message));
});

test('a code changes a layout only: words that do not fit the new layout are cut to an exact slice', async () => {
 const {s, p} = await start();
 const out = await as(AGENT, () => s.codes({...base(p), storyId: 'S1', say: 'R4'}));
 assert.equal(out.layouts.carousel.frames[0].templateId, 'AR-P1');
 for (const f of out.layouts.carousel.frames) assert.ok(f.words.map(w => w.text).join('\n\n').length <= NEW_TEMPLATES['AR-P1'].maxChars);
});

test('the same revision checks, actor rules and replay as instagram.layout', async () => {
 const {s, p} = await start();
 await assert.rejects(as(AGENT, () => s.codes({...base(p), expectedRevision: p.revision - 1, storyId: 'S1', say: 'C1'})), e => e.status === 409);
 await assert.rejects(as(AGENT, () => s.codes({id: p.id, operationId: op(), storyId: 'S1', say: 'C1'})), e => e.status === 400, 'needs the revision and hash it read');
 await assert.rejects(as(AGENT, () => s.codes({...base(p), storyId: 'S9', say: 'C1'})), e => e.status === 400);
 await assert.rejects(as(AGENT, () => s.codes({...base(p), say: 'C1'})), e => e.status === 400, 'two stories and none chosen: say which');
 const same = base(p);
 const first = await as(AGENT, () => s.codes({...same, storyId: 'S1', say: 'C1, C2'}));
 const again = await as(AGENT, () => s.codes({...same, storyId: 'S1', say: 'C1, C2'}));
 assert.equal(again.revision, first.revision, 'the same operation changes nothing twice');
 // It proposes a layout order only: his yes and his choice stay his.
 const chosen = await as(ADRIAN, () => s.choose({id: p.id, operationId: op(), expectedRevision: first.revision, expectedHash: first.hash, storyId: 'S1'}));
 const ready = await as(ADRIAN, () => s.ready({id: p.id, operationId: op(), expectedRevision: chosen.revision, expectedHash: chosen.hash, format: 'carousel'}));
 await assert.rejects(as(AGENT, () => s.codes({...base(ready), storyId: 'S1', say: 'C1'})), e => e.status === 409, 'an agent cannot change what he said yes to');
 const him = await as(ADRIAN, () => s.codes({...base(ready), storyId: 'S1', say: 'C3'}));
 assert.equal(him.layouts.carousel.frames[0].templateId, 'canvas-M01-triptych');
 assert.equal(him.ready.carousel, undefined, 'a changed layout needs his yes again');
});

test('the story defaults to the chosen one', async () => {
 const {s, p} = await start();
 const chosen = await as(ADRIAN, () => s.choose({...base(p), storyId: 'S2'}));
 const out = await as(AGENT, () => s.codes({...base(chosen), say: 'F1'}));
 assert.equal(out.layouts.carousel.storyId, 'S2');
});

test('instagram.plan.codes is in the registry, open to assistants, and reachable from the CLI', async () => {
 const list = describeRoutes({});
 const cmd = list.find(c => c.name === 'instagram.plan.codes');
 assert.ok(cmd);
 assert.equal(cmd.method, 'POST');
 assert.equal(cmd.readOnly, false);
 assert.deepEqual(cmd.actors, ['any'], 'assistants and the owner may both call it');
 assert.deepEqual(list.find(c => c.name === 'instagram.ready').actors, ['human'], 'his yes stays human-only');
 assert.equal(SUGAR.instagram.codes, 'instagram.plan.codes');
 const calls = [];
 const fetchImpl = async (url, init) => {
  const u = new URL(url), body = init.body ? JSON.parse(init.body) : null;
  calls.push({method: init.method, path: u.pathname, search: u.search, body, actor: init.headers['X-AR-Actor'] || init.headers['x-ar-actor']});
  const json = value => ({ok: true, status: 200, text: async () => JSON.stringify(value)});
  if (u.pathname === '/api/capabilities') return json({commands: list.map(publicEntry)});
  if (u.pathname === '/api/instagram/plan') return json({id: 'plan-1', revision: 7, hash: 'h'.repeat(64)});
  return json({ok: true, codes: {used: [], unused: []}});
 };
 const answer = await run(['--url', 'http://127.0.0.1:8854', '--actor', 'agent:claude-code', 'instagram', 'codes', '--plan', 'plan-1', '--say', 'use C1, 2 and 5'], {fetchImpl});
 assert.equal(answer.exitCode, 0);
 const post = calls.find(c => c.path === '/api/instagram/plan/codes');
 assert.equal(post.method, 'POST');
 assert.equal(post.body.say, 'use C1, 2 and 5');
 assert.equal(post.body.id, 'plan-1');
 assert.equal(post.body.expectedRevision, 7);
 assert.match(post.body.operationId, /^[0-9a-f-]{36}$/);
 const bad = await run(['--url', 'http://127.0.0.1:8854', '--actor', 'agent:claude-code', 'instagram', 'codes', '--plan', 'plan-1'], {fetchImpl});
 assert.equal(bad.exitCode, 2);
});
