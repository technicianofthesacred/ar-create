// Placed things on a slide, a look's assets, and templates of his own (a saved slide, or markup an assistant proposes).
// Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import IG from '../runtime/src/donors/mag/carousel/ig-templates.js';
import LAYOUTS from '../runtime/src/donors/mag/carousel/ig-original-layouts.json' with {type: 'json'};
import {ROWS, OLD_TWINS, hearCodes} from '../runtime/src/donors/mag/carousel/ig-codes.mjs';
import {checkPlaced, resolvePlaced, withPlaced} from '../runtime/src/donors/mag/carousel/ig-look-render.mjs';
import {checkMarkup, ALLOWED_TAGS, ALLOWED_STYLE} from '../runtime/src/donors/mag/carousel/ig-template-markup.mjs';
import {renderFrame, layoutIdToCode} from '../runtime/services/instagram-templates.mjs';
import {createLooks} from '../runtime/services/looks.mjs';
import {createTemplates} from '../runtime/services/templates.mjs';
import {cleanSvg} from '../runtime/services/svg-clean.mjs';
import {createInstagramStudio} from '../runtime/services/instagram-studio.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {describeRoutes} from '../runtime/commands.mjs';
import {run, SUGAR} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {VARIANTS} from './helpers/look-variants.mjs';

const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const as = (actor, fn) => withActor({actor, client: 'http'}, fn);
const op = () => crypto.randomUUID();
const ADRIAN = 'human:adrian', AGENT = 'agent:claude-code';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const base = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});

const TRANSCRIPT = 'Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.';
const T_ID = '11111111-2222-4333-8444-555555555555', T_HASH = crypto.createHash('sha256').update(TRANSCRIPT).digest('hex');
const PHOTO_ID = '22222222-3333-4444-8555-666666666666';
const library = {snapshot: async (id, {includeBody} = {}) => {
 if (id === T_ID) return {id, hash: T_HASH, path: '/x/talk.md', text: includeBody ? TRANSCRIPT : undefined};
 if (id === PHOTO_ID) return {id, hash: 'a'.repeat(64), path: '/x/bowl.jpg'};
 throw Error('missing');
}};
/** A plan with one story laid out as a carousel (two slides), in a door's look. */
async function plan(door = 'teajia', dataDir = tmp('placed-plan-')) {
 const s = createInstagramStudio({dataDir, library});
 const made = await as(AGENT, () => s.propose({operationId: op(), subject: 'proj-1', title: 'The mender', door, material: {transcripts: [{sourceId: T_ID, sourceHash: T_HASH}], photos: [{sourceId: PHOTO_ID, caption: 'A bowl'}]}}));
 const line = made.lines.find(l => l.text.startsWith('I think every crack'));
 const p = await as(AGENT, () => s.propose({...base(made), stories: [{title: 'Cracks', readback: 'Cracks record use.', dish: 'A carousel.', why: 'Strong.', reader: 'The maker', spine: [line.id], matches: []}]}));
 const laid = await as(AGENT, () => s.layout({...base(p), storyId: 'S1', format: 'carousel'}));
 return {s, p: laid, dataDir, line};
}

/* ---------- placed things ---------- */
test('placed things are checked and bounded: inside the slide, only the fields their kind takes', () => {
 const ok = checkPlaced([{kind: 'logo', asset: 'wordmark', x: 90, y: 1200, width: 120}, {kind: 'label', text: 'Invented label', x: 90, y: 90, width: 400}, {kind: 'rule', x: 90, y: 300, width: 900}]);
 assert.deepEqual(ok[0], {kind: 'logo', asset: 'wordmark', x: 90, y: 1200, width: 120, z: 0, tone: 'dark'});
 assert.deepEqual(ok[1], {kind: 'label', text: 'Invented label', size: 30, x: 90, y: 90, width: 400, z: 1, tone: 'dark', color: 'supporting'});
 assert.deepEqual(checkPlaced(undefined), []);
 for (const bad of [
  {kind: 'sticker', x: 0, y: 0, width: 10}, {kind: 'logo', x: 0, y: 0, width: 10}, {kind: 'logo', asset: '../x', x: 0, y: 0, width: 10},
  {kind: 'logo', asset: 'wordmark', x: 1000, y: 0, width: 100}, {kind: 'logo', asset: 'wordmark', x: -1, y: 0, width: 10}, {kind: 'logo', asset: 'wordmark', x: 0, y: 1300, width: 100},
  {kind: 'logo', asset: 'wordmark', x: 0.5, y: 0, width: 10}, {kind: 'logo', asset: 'wordmark', x: 0, y: 0, width: 0}, {kind: 'logo', asset: 'wordmark', x: 0, y: 0, width: 10, text: 'x'},
  {kind: 'logo', asset: 'wordmark', x: 0, y: 0, width: 10, src: '/x.png'}, {kind: 'logo', asset: 'wordmark', x: 0, y: 0, width: 10, tone: 'pink'}, {kind: 'logo', asset: 'wordmark', x: 0, y: 0, width: 10, z: 99},
  {kind: 'label', text: '<b>x</b>', x: 0, y: 0, width: 10}, {kind: 'label', text: 'x'.repeat(61), x: 0, y: 0, width: 10}, {kind: 'label', text: 'ok', x: 0, y: 0, width: 10, color: '#fff'},
  {kind: 'label', text: 'ok', size: 500, x: 0, y: 0, width: 10}, {kind: 'picture', asset: 'not a photo', x: 0, y: 0, width: 10}, {kind: 'rule', x: 0, y: 0, width: 10, asset: 'x'}])
  assert.throws(() => checkPlaced([bad]), e => e.status === 400, JSON.stringify(bad));
 assert.throws(() => checkPlaced(Array.from({length: 13}, () => ({kind: 'rule', x: 0, y: 0, width: 1}))), e => e.status === 400);
 assert.throws(() => checkPlaced([{kind: 'picture', asset: 'P9', x: 0, y: 0, width: 10}], {pictures: () => null}), /not in this plan/);
});

test('a slide with no placed things draws exactly as before, in every look', () => {
 const looks = createLooks({dataDir: tmp('placed-looks-')});
 for (const lookId of [null, 'teajia', 'art']) {
  const look = lookId && looks.roles(lookId);
  for (const id of ['canvas-P06-night', 'H6', 'AR-P1', 'canvas-N01-scroll-white']) for (const [slide, ctx] of Object.values(VARIANTS)) {
   if (look && lookId !== 'teajia' && /J0|B0|C0/.test(id)) continue;
   assert.equal(renderFrame(id, {...structuredClone(slide), placed: []}, {...ctx}, look), renderFrame(id, structuredClone(slide), {...ctx}, look), id);
  }
 }
});

test('placed things are drawn on top of the layout, at their place, in the look\'s own colours and assets', () => {
 const looks = createLooks({dataDir: tmp('placed-draw-')}), teajia = looks.roles('teajia'), art = looks.roles('art');
 const placed = checkPlaced([{kind: 'logo', asset: 'wordmark', x: 90, y: 1180, width: 126, height: 50}, {kind: 'mark', asset: 'seal-home', x: 900, y: 72, width: 88}, {kind: 'rule', x: 90, y: 1160, width: 900, color: 'accent'}, {kind: 'label', text: 'Invented', x: 90, y: 72, width: 500, tone: 'light', color: 'headline'}]);
 const html = renderFrame('canvas-P06-night', {text: 'A line', role: 'cover', placed}, {}, teajia);
 assert.ok(html.endsWith('</div></div>'), 'the things sit inside the slide frame');
 assert.match(html, /<div data-placed="logo" data-placed-index="0" style="position:absolute;left:90px;top:1180px;width:126px;height:50px;z-index:1;overflow:hidden"><img src="\/ig-assets\/teajia-wordmark.png"/);
 assert.match(html, /data-placed="mark"[^>]*left:900px;top:72px;width:88px;height:88px;[^>]*background:#a8874d;color:#1a1714;[^>]*>家<\/div>/);
 assert.match(html, /data-placed="rule"[^>]*width:900px;height:2px;z-index:3;background:#a8874d/);
 assert.match(html, /data-placed="label"[^>]*color:#18130e">Invented<\/div>/);
 assert.ok(html.indexOf('data-placed') > html.indexOf('data-text-zone'), 'drawn after the layout, so on top');
 // In the art look: its text wordmark in its own type and colour; Teajia's seal is left out, never borrowed.
 const inArt = renderFrame('canvas-P06-night', {text: 'A line', role: 'cover', placed}, {}, art);
 assert.match(inArt, /data-placed="logo"[^>]*font-family:'Cormorant Garamond'[^>]*color:#f2efe9">Adrian Rasmussen<\/div>/);
 assert.ok(!inArt.includes('家') && !inArt.includes('teajia-wordmark'), 'no Teajia mark or wordmark in another look');
 const {leftOut} = resolvePlaced(placed, art);
 assert.deepEqual(leftOut.map(l => [l.index, l.asset]), [[1, 'seal-home']]);
 assert.match(leftOut[0].why, /Adrian Rasmussen look has no asset seal-home/);
 // A logo asset placed as a mark is the wrong kind, and is left out too.
 assert.match(resolvePlaced(checkPlaced([{kind: 'mark', asset: 'wordmark', x: 0, y: 0, width: 10}]), teajia).leftOut[0].why, /is a logo/);
 // Story layouts take placed things too, in their own 1920-high frame.
 assert.match(renderFrame('AR-S1', {text: 'x', placed: checkPlaced([{kind: 'rule', x: 0, y: 1800, width: 1080}], {height: 1920})}, {}), /data-placed="rule"[^>]*top:1800px/);
 // With no things to draw, the card is unchanged.
 assert.equal(withPlaced('<div>x</div>', [], teajia), '<div>x</div>');
});

test('a plan keeps its placed things through save and read, draws them in the preview and the sheet, and reports what its look lacks', async () => {
 const {s, p} = await plan('teajia');
 const before = await s.render({id: p.id, format: 'carousel', frame: 0});
 const set = await as(AGENT, () => s.setPlaced({...base(p), format: 'carousel', slide: 1, placed: [{kind: 'mark', asset: 'seal-home', x: 900, y: 72, width: 88}, {kind: 'picture', asset: PHOTO_ID, x: 600, y: 600, width: 300}]}));
 assert.equal(set.revision, p.revision + 1);
 assert.deepEqual(set.layouts.carousel.frames[0].placed.map(t => [t.kind, t.asset]), [['mark', 'seal-home'], ['picture', 'P1']], 'a picture is kept as the plan\'s photo id');
 assert.equal(Object.hasOwn(set.layouts.carousel.frames[1], 'placed'), false, 'a slide with none carries no list');
 const read = await s.read({id: p.id});
 assert.deepEqual(read.layouts.carousel.frames[0].placed, set.layouts.carousel.frames[0].placed);
 const page = await s.render({id: p.id, format: 'carousel', frame: 0});
 assert.notEqual(page, before);
 assert.match(page, /data-placed="mark"[^>]*>家<\/div>/);
 assert.match(page, /data-placed="picture"[^>]*><img src="\/api\/sources\/blob\?id=22222222-3333-4444-8555-666666666666"/);
 assert.match(await s.sheet({id: p.id, format: 'carousel'}), /data-placed="mark"/);
 assert.equal(read.placedLeftOut, undefined, 'nothing is left out in its own look');
 // Moved to the art look, the seal is left out and said so; the picture stays.
 const art = await as(ADRIAN, () => s.setLook({...base(read), look: 'art', account: 'auto'}));
 assert.deepEqual(art.placedLeftOut.map(l => [l.format, l.slide, l.asset]), [['carousel', 1, 'seal-home']]);
 const inArt = await s.render({id: p.id, format: 'carousel', frame: 0});
 assert.ok(!inArt.includes('data-placed="mark"') && inArt.includes('data-placed="picture"'));
 // Refusals keep the plan as it was.
 await assert.rejects(as(AGENT, () => s.setPlaced({...base(art), format: 'carousel', slide: 1, placed: [{kind: 'logo', asset: 'wordmark', x: 1070, y: 0, width: 20}]})), e => e.status === 400 && /right edge/.test(e.message));
 await assert.rejects(as(AGENT, () => s.setPlaced({...base(art), format: 'carousel', slide: 9, placed: []})), e => e.status === 400);
 await assert.rejects(as(AGENT, () => s.setPlaced({...base(art), format: 'carousel', slide: 1, placed: [{kind: 'picture', asset: 'P7', x: 0, y: 0, width: 10}]})), /not in this plan/);
 await assert.rejects(as(AGENT, () => s.setPlaced({...base(art), expectedRevision: 1, format: 'carousel', slide: 1, placed: []})), e => e.status === 409);
 const cleared = await as(AGENT, () => s.setPlaced({...base(art), format: 'carousel', slide: 1, placed: []}));
 assert.equal(Object.hasOwn(cleared.layouts.carousel.frames[0], 'placed'), false);
});

/* ---------- a look's assets ---------- */
test('the shipped looks list their assets: Teajia its wordmark and three seals, the others only their text wordmark', async () => {
 const looks = createLooks({dataDir: tmp('assets-')});
 const teajia = await looks.assets({id: 'teajia'});
 assert.deepEqual(teajia.assets.map(a => [a.id, a.kind, a.text || a.file]), [['wordmark', 'logo', '/ig-assets/teajia-wordmark.png'], ['seal-excellence', 'mark', '佳'], ['seal-home', 'mark', '家'], ['seal-celebration', 'mark', '嘉']]);
 for (const id of ['art', 'mandala-codes', 'personal']) {
  const a = await looks.assets({id});
  assert.deepEqual(a.assets.map(x => [x.id, x.kind, x.file ?? null]), [['wordmark', 'logo', null]], id);
  assert.deepEqual(a.problems, []);
 }
});

test('adding a png or an svg to a look: the svg is made safe, the file goes in the home, the asset in its DESIGN.md', async () => {
 const dataDir = tmp('assets-add-'), looks = createLooks({dataDir});
 const art = await looks.read({id: 'art'});
 const add = (asset, extra = {}, actor = AGENT) => as(actor, async () => { const cur = await looks.read({id: 'art'}); return looks.addAsset({id: 'art', operationId: op(), expectedRevision: cur.revision, expectedHash: cur.hash, asset, ...extra}); });
 const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><style>@import url(https://example.invalid/x.css);</style><foreignObject><div>x</div></foreignObject><circle cx="5" cy="5" r="4" fill="url(#g)" onclick="x()"/><use xlink:href="https://example.invalid/a.svg#b"/><use href="#ok"/><image href="https://example.invalid/a.png"/><a href="javascript:alert(1)"><rect width="1" height="1"/></a><path d="M0 0" style="fill:url(https://example.invalid/p)"/></svg>';
 const withSvg = await add({id: 'spiral', name: 'Spiral', kind: 'graphic', file: 'spiral.svg', base64: Buffer.from(svg).toString('base64')});
 assert.equal(withSvg.revision, 1);
 assert.equal(withSvg.source, 'home, changing the shipped look');
 const kept = fs.readFileSync(path.join(dataDir, 'looks', 'art', 'spiral.svg'), 'utf8');
 for (const gone of ['script', 'alert', 'onload', 'onclick', 'foreignObject', 'example.invalid', 'javascript', '<image', '<style', '@import']) assert.ok(!kept.includes(gone), 'removed: ' + gone);
 assert.ok(kept.includes('<circle cx="5" cy="5" r="4" fill="url(#g)"/>') && kept.includes('<use href="#ok"/>'), 'the drawing itself is kept');
 const withPng = await add({id: 'stamp', name: 'Stamp', kind: 'mark', file: 'stamp.png', base64: PNG});
 const text = (await looks.read({id: 'art'})).text;
 assert.match(text, /assets:\n  wordmark:\n    name: "Adrian Rasmussen wordmark"\n    kind: logo\n  spiral:\n    name: "Spiral"\n    kind: graphic\n    file: "spiral.svg"\n  stamp:/);
 assert.equal(text.match(/^assets:/gm).length, 1, 'one assets block');
 assert.match(text, /^---\nversion: alpha\nname: Adrian Rasmussen\n/, 'the rest of the file is kept');
 const listed = await looks.assets({id: 'art'});
 assert.deepEqual(listed.assets.map(a => a.id), ['wordmark', 'spiral', 'stamp']);
 assert.match(listed.assets[1].src, /^\/api\/look\/asset\?id=art&file=spiral.svg$/);
 assert.equal(looks.asset({id: 'art', file: 'spiral.svg'}).type, 'image/svg+xml');
 // The placed graphic draws from the look's own file.
 assert.match(renderFrame('canvas-P06-night', {text: 'x', role: 'cover', placed: checkPlaced([{kind: 'graphic', asset: 'spiral', x: 0, y: 0, width: 100}])}, {}, looks.roles('art')), /<img src="\/api\/look\/asset\?id=art&amp;file=spiral.svg" alt="Spiral"/);
 assert.equal(withPng.revision, 2);
 // A mark of characters needs no file.
 assert.equal((await add({id: 'dot', name: 'Dot', kind: 'mark', text: '◎'})).revision, 3);
 // Refusals, and nothing is written for them.
 for (const [asset, status] of [
  [{id: 'bad', name: 'Bad', kind: 'graphic', file: 'bad.svg', base64: Buffer.from('<!DOCTYPE svg [<!ENTITY x "y">]><svg/>').toString('base64')}, 415],
  [{id: 'bad', name: 'Bad', kind: 'graphic', file: 'bad.svg', base64: Buffer.from('<html><script>x</script></html>').toString('base64')}, 415],
  [{id: 'bad', name: 'Bad', kind: 'graphic', file: 'bad.png', base64: Buffer.from('not a png').toString('base64')}, 415],
  [{id: 'bad', name: 'Bad', kind: 'graphic', file: 'bad.gif', base64: PNG}, 400],
  [{id: 'Bad Id', name: 'Bad', kind: 'graphic', file: 'b.png', base64: PNG}, 400],
  [{id: 'bad', name: 'Bad', kind: 'sticker', file: 'b.png', base64: PNG}, 400],
  [{id: 'bad', name: '<b>x</b>', kind: 'graphic', file: 'b.png', base64: PNG}, 422],
  [{id: 'bad', name: 'Bad', kind: 'graphic', text: '佳'}, 422],
  [{id: 'spiral', name: 'Again', kind: 'graphic', file: 'other.png', base64: PNG}, 409],
  [{id: 'other', name: 'Again', kind: 'graphic', file: 'spiral.svg', base64: PNG}, 409]])
  await assert.rejects(add(asset), e => e.status === status, JSON.stringify(asset).slice(0, 80) + ' -> ' + status);
 assert.ok(!fs.existsSync(path.join(dataDir, 'looks', 'art', 'bad.svg')) && !fs.existsSync(path.join(dataDir, 'looks', 'art', 'bad.png')));
 await assert.rejects(as(AGENT, () => looks.addAsset({id: 'art', operationId: op(), expectedRevision: 0, expectedHash: art.hash, asset: {id: 'late', name: 'Late', kind: 'mark', text: 'x'}})), e => e.status === 409, 'a stale add is a conflict');
 // The Teajia wordmark stays Teajia's.
 const cur = await looks.read({id: 'art'});
 await assert.rejects(as(AGENT, () => looks.save({id: 'art', operationId: op(), expectedRevision: cur.revision, expectedHash: cur.hash, text: cur.text.replace('    file: "spiral.svg"', '    file: "/ig-assets/teajia-wordmark.png"')})), e => e.status === 422 && /belongs to Teajia/.test(e.message));
});

test('cleanSvg refuses what it cannot make safe and removes the rest', () => {
 assert.throws(() => cleanSvg(Buffer.from('<svg><g></svg>')), e => e.status === 415);
 assert.throws(() => cleanSvg(Buffer.from('<svg></svg><script>x</script>')), e => e.status === 415);
 assert.throws(() => cleanSvg(Buffer.from('plain text')), e => e.status === 415);
 assert.throws(() => cleanSvg(Buffer.alloc(0)), e => e.status === 415);
 const out = cleanSvg(Buffer.from('<svg viewBox="0 0 1 1"><g ONMOUSEOVER="x" transform="scale(1)"><animate attributeName="href" to="javascript:x"/><set attributeName="x"/><rect xml:base="http://e.invalid/" width="1"/></g><!-- note --><![CDATA[ x ]]></svg>'));
 assert.equal(out.bytes.toString('utf8'), '<svg viewBox="0 0 1 1"><g transform="scale(1)"><rect width="1"/></g></svg>\n');
 assert.deepEqual(out.removed, ['CDATA', 'animate', 'event handlers', 'outside references', 'set']);
});

/* ---------- markup templates ---------- */
const GOOD = '<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; background: {dark.ground}; color: {dark.headline}; font-family: {fonts.body}">'
 + '<div data-slot="0" style="position: absolute; left: 0; top: 0; width: 1080px; height: 880px; overflow: hidden"><img src="__IG_PHOTO_0__"></div>'
 + '<div data-text-zone style="position: absolute; left: 90px; right: 90px; top: 940px; bottom: 90px; display: flex; flex-direction: column; gap: 22px">'
 + '<div data-edit="label" style="font-family: {fonts.label}; font-size: 30px; letter-spacing: 0.16em; color: {dark.supporting}; text-transform: uppercase">__IG_LABEL__</div>'
 + '<div data-edit="text" data-base-font-size="52" style="font-size: 52px; line-height: 1.1; white-space: pre-wrap">__IG_TEXT_0__</div>'
 + '<div style="border-top: 1px solid {dark.line}; padding-top: 16px; font-family: {fonts.label}; font-size: 30px; color: {dark.accent}">THE FULL STORY</div>'
 + '<img src="__IG_LOGO__" alt="x" style="width: 101px; height: 40px; object-fit: contain; display: block"></div></div>';

test('the allowlist is the shipped catalogue\'s own: every tag, attribute and style it draws is on it, and its shared layouts pass', () => {
 const props = new Set(), tags = new Set(), attrs = new Set();
 for (const id of Object.keys(IG.T)) for (const [slide, ctx] of Object.values(VARIANTS)) {
  const html = IG.render(id, structuredClone(slide), {...ctx});
  for (const m of html.matchAll(/<([a-zA-Z0-9]+)([^>]*)>/g)) { tags.add(m[1]); for (const a of m[2].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g)) { attrs.add(m[1] + ' ' + a[1]); if (a[1] === 'style') for (const d of (a[2] || '').split(';')) if (d.includes(':')) props.add(d.slice(0, d.indexOf(':')).trim()); } }
 }
 // Left off on purpose: the shorthand the renderer itself writes for "photo needed", and the marks the renderer adds (the pillar seal).
 const notOffered = new Set(['font', 'div data-pillar-seal']);
 for (const t of tags) assert.ok(Object.hasOwn(ALLOWED_TAGS, t), t);
 for (const a of attrs) if (!notOffered.has(a)) assert.ok(Object.hasOwn(ALLOWED_TAGS[a.split(' ')[0]], a.split(' ')[1]), a);
 for (const p of props) if (!notOffered.has(p)) assert.ok(Object.hasOwn(ALLOWED_STYLE, p), p);
 assert.deepEqual(Object.keys(ALLOWED_STYLE).filter(p => !props.has(p)), [], 'nothing on the list that the catalogue does not use');
 // Every layout of the shared rows passes the check as written (bar those carrying Teajia's characters).
 const shared = new Set(ROWS.filter(r => !['J', 'Y', 'Z'].includes(r.letter)).flatMap(r => r.items.map(([code]) => code)));
 let passed = 0;
 for (const [id, l] of Object.entries(LAYOUTS)) {
  const code = layoutIdToCode(id);
  if (!shared.has(code) || /[㐀-鿿]/.test(l.html)) continue;
  assert.doesNotThrow(() => checkMarkup(l.html.replace(/ style="__IG_STYLE_\d__"/g, '')), id + ' (' + code + ')');
  passed++;
 }
 assert.ok(passed >= 35, passed + ' shared layouts pass');
});

test('good markup is kept in the catalogue\'s own values, so it draws in any look like a shipped layout', () => {
 const checked = checkMarkup(GOOD);
 assert.deepEqual([checked.photos, checked.textParts, checked.label, checked.logo], [1, 1, true, true]);
 assert.match(checked.markup, /^<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; background: #1a1714; color: #f3eada; font-family: 'EB Garamond', Georgia, serif">/);
 assert.ok(checked.markup.includes('<img src="__IG_PHOTO_0__" alt="">') && checked.markup.includes('<img src="__IG_LOGO__" alt="teajiā"'));
 // A value a look gives a role stands for that role.
 const looks = createLooks({dataDir: tmp('markup-')}), art = looks.roles('art');
 assert.match(checkMarkup(GOOD.replace('{dark.headline}', art.dark.headline), {looks: [art]}).markup, /color: #f3eada/);
 assert.throws(() => checkMarkup(GOOD.replace('{dark.headline}', art.dark.headline)), /not one of the look's roles/);
 const own = {markup: checked.markup, textParts: 1, row: 'C'};
 const inArt = renderFrame(null, {text: 'Invented words', label: 'A label', photos: [{src: '/x/a.jpg', x: 20, y: 30}]}, {}, art, {own});
 assert.ok(inArt.includes('background: ' + art.dark.ground) && inArt.includes('Invented words') && inArt.includes('object-position:20% 30%'));
 assert.ok(!/#1a1714|#f3eada|teajia-wordmark|EB Garamond/.test(inArt), 'nothing of Teajia\'s is left in the art look');
 assert.match(inArt, /data-wordmark aria-label="Adrian Rasmussen"/);
});

test('markup is refused for anything not on the allowlist, each with its reason', () => {
 const root = body => '<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden">' + body + '<div data-edit="text">__IG_TEXT_0__</div></div>';
 const refused = {
  script: root('<script>alert(1)</script>'), style: root('<style>div{}</style>'), link: root('<link rel="stylesheet" href="/x.css">'), iframe: root('<iframe src="/x"></iframe>'),
  object: root('<object data="/x"></object>'), embed: root('<embed src="/x">'), svg: root('<svg><foreignObject><div>x</div></foreignObject></svg>'), foreignObject: root('<foreignObject></foreignObject>'),
  meta: root('<meta http-equiv="refresh" content="0">'), base: root('<base href="/">'), a: root('<a href="/x">x</a>'), form: root('<form></form>'), input: root('<input>'),
  'event handler': root('<div onclick="x()"></div>'), 'event handler upper case': root('<div ONMOUSEOVER="x()"></div>'), 'event handler on img': root('<img src="__IG_PHOTO_0__" onerror="x()">'),
  'unknown attribute': root('<div class="x"></div>'), 'id attribute': root('<div id="x"></div>'), 'single-quoted attribute': root("<div style='color: red'></div>"),
  'external image': root('<img src="https://example.invalid/a.png">'), 'protocol-relative image': root('<img src="//example.invalid/a.png">'), 'site image': root('<img src="/ig-assets/teajia-wordmark.png">'),
  'data url image': root('<img src="data:image/png;base64,AAAA">'), 'url to an address': root('<div style="background-image: url(/x.png)"></div>'), 'url to a site': root('<div style="background-image: url(https://example.invalid/x.png)"></div>'),
  'url in another property': root('<div style="background: url(__IG_PHOTO_0__)"></div>'), 'javascript url': root('<div style="background-image: url(javascript:x)"></div>'),
  'unknown style': root('<div style="transform: rotate(3deg)"></div>'), 'position fixed': root('<div style="position: fixed"></div>'), important: root('<div style="color: {dark.headline} !important"></div>'),
  'css escape': root('<div style="col\\6f r: red"></div>'), 'css comment': root('<div style="color: /* x */ {dark.headline}"></div>'), expression: root('<div style="width: expression(1)"></div>'),
  'colour not a role': root('<div style="color: #ff0000"></div>'), 'named colour': root('<div style="color: red"></div>'), 'rgb colour': root('<div style="color: rgb(1,2,3)"></div>'),
  'font not allowed': root('<div style="font-family: Comic Sans MS"></div>'), 'wider than the slide': root('<div style="width: 1081px"></div>'), 'left of the slide': root('<div style="left: -10px"></div>'),
  'below the slide': root('<div style="top: 1400px"></div>'), 'too tall': root('<div style="height: 1351px"></div>'), 'percent over': root('<div style="width: 120%"></div>'), 'em size': root('<div style="width: 50em"></div>'),
  'root wrong size': '<div style="width: 1080px; height: 1920px; position: relative; overflow: hidden"><div>__IG_TEXT_0__</div></div>',
  'root not clipped': '<div style="width: 1080px; height: 1350px; position: relative"><div>__IG_TEXT_0__</div></div>',
  'two roots': root('') + '<div></div>', 'text outside the root': root('') + 'hello', 'not a div root': '<span style="width: 1080px; height: 1350px; position: relative; overflow: hidden">__IG_TEXT_0__</span>',
  'fixed sentence': root('<div>Here are some words he never said, typed in.</div>'), 'too many fixed labels': root('<div>ONE</div><div>TWO</div><div>THREE</div><div>FOUR</div>'), 'html in label': root('<div>A &amp; B</div>'),
  'unknown slot': root('<div>__IG_HEADLINE__</div>'), 'photo slot out of range': root('<img src="__IG_PHOTO_9__">'), 'slot not whole': root('<div>__IG_TEXT_0__ and more</div>'),
  'photo slot gap': root('<img src="__IG_PHOTO_1__">'), 'photo slot twice': root('<img src="__IG_PHOTO_0__"><img src="__IG_PHOTO_0__">'), 'text slot gap': root('<div>__IG_TEXT_2__</div>'),
  'slot in an attribute': root('<div aria-label="__IG_LABEL__"></div>'), 'logo slot as text': root('<div>__IG_LOGO__</div>'),
  comment: root('<!-- hi -->'), doctype: '<!DOCTYPE html>' + root(''), 'unclosed tag': '<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden"><div>__IG_TEXT_0__</div>',
  'wrong close': root('<div><span></div></span>'), 'stray <': root('<div>a < b</div>'), 'bidi control': root('<div>\u202eABC</div>'), 'no slots': '<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden"></div>',
  'srcset': root('<img src="__IG_PHOTO_0__" srcset="https://example.invalid/a.png 2x">'), 'data attribute free text': root('<div data-edit="script"></div>'), 'lang free text': root('<div lang="javascript:x"></div>'),
 };
 for (const [why, markup] of Object.entries(refused)) assert.throws(() => checkMarkup(markup), e => e.status === 400 && e.refused === true && typeof e.message === 'string' && e.message.length > 10, why);
 assert.throws(() => checkMarkup(''), e => e.refused);
 assert.throws(() => checkMarkup('x'.repeat(70 * 1024)), e => e.refused);
 assert.throws(() => checkMarkup(root('<div>'.repeat(30) + '</div>'.repeat(30))), /deep/);
 // Each refusal names what was wrong.
 assert.throws(() => checkMarkup(refused.script), /<script> is not allowed/);
 assert.throws(() => checkMarkup(refused['event handler']), /Event handlers \(onclick\)/);
 assert.throws(() => checkMarkup(refused['external image']), /outside address/);
 assert.throws(() => checkMarkup(refused['url to an address']), /url\(\) to anything but a photo slot/);
 assert.throws(() => checkMarkup(refused['wider than the slide']), /outside the 1080 by 1350 slide/);
 assert.throws(() => checkMarkup(refused['unknown style']), /transform is not one the shipped layouts use/);
});

/* ---------- templates of his own ---------- */
test('saving a slide as a template: his is kept with the next free code in its row, used by id or code, and listed as his', async () => {
 const {s, p, dataDir} = await plan('teajia');
 const withThings = await as(AGENT, () => s.setPlaced({...base(p), format: 'carousel', slide: 1, placed: [{kind: 'mark', asset: 'seal-home', x: 900, y: 72, width: 88}, {kind: 'picture', asset: 'P1', x: 0, y: 0, width: 100}]}));
 assert.equal(withThings.layouts.carousel.frames[0].templateId, 'H6', 'the first slide is Night bleed (C1)');
 const saved = await as(ADRIAN, () => s.saveTemplate({id: p.id, operationId: op(), format: 'carousel', slide: 1, name: 'Night bleed with the home seal'}));
 assert.deepEqual([saved.status, saved.code, saved.row, saved.base, saved.looks, saved.createdBy], ['kept', 'C5', 'C', 'H6', ['teajia'], ADRIAN]);
 assert.deepEqual(saved.placed.map(t => t.asset), ['seal-home'], 'the plan\'s picture stays with the plan');
 assert.match(saved.leftOut, /1 picture from the plan stays with the plan/);
 const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'templates', saved.id + '.json'), 'utf8'));
 assert.equal(onDisk.id, saved.id);
 assert.match(saved.id, /^own-night-bleed-with-the-home-seal$/);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'templates', 'codes.json'), 'utf8')).given.map(g => [g.code, g.templateId]), [['C5', saved.id]]);
 // Beside the shipped layouts, marked as his.
 const listed = (await s.templates()).templates, mine = listed.find(t => t.id === saved.id);
 assert.deepEqual([mine.code, mine.owner, mine.group, mine.row, mine.kind], ['C5', true, 'Yours', 'Covers', 'cover']);
 assert.ok(listed.findIndex(t => t.id === saved.id) > listed.findIndex(t => t.code === 'R4'), 'after the shipped layouts');
 // Used by code and by id.
 const cur = await s.read({id: p.id});
 const byCode = await as(AGENT, () => s.layout({...base(cur), storyId: 'S1', format: 'carousel', frames: cur.layouts.carousel.frames.map((f, i) => ({...f, templateId: i === 1 ? 'c5' : f.templateId}))}));
 assert.equal(byCode.layouts.carousel.frames[1].templateId, saved.id);
 const drawn = await s.render({id: p.id, format: 'carousel', frame: 1});
 assert.match(drawn, /data-placed="mark"[^>]*>家<\/div>/, 'the template\'s placed things draw on the slide that uses it');
 const said = await as(AGENT, () => s.codes({...base(byCode), say: 'use C5 and C1'}));
 assert.deepEqual(said.codes.used.map(u => [u.code, u.layout]), [['C5', saved.id], ['C1', 'canvas-P06-night']]);
 assert.deepEqual(hearCodes('C5').unknown.map(u => u.code), ['C5'], 'without the home\'s codes, C5 names nothing');
 assert.deepEqual(hearCodes('C5', {known: ['C5']}).usable, ['C5']);
});

test('an assistant\'s template is a proposal: only Adrian accepts it (it takes its code then) or turns it down, and a retired code is never given again', async () => {
 const {s, p, dataDir} = await plan('teajia');
 const t = createTemplates({dataDir});
 const proposed = await as(AGENT, () => s.saveTemplate({id: p.id, operationId: op(), format: 'carousel', slide: 2, name: 'Invented quiet slide', looks: 'all'}));
 assert.deepEqual([proposed.status, proposed.code, proposed.proposedBy, proposed.looks], ['proposed', null, AGENT, null]);
 assert.ok(!(await s.templates()).templates.some(x => x.id === proposed.id), 'a proposal is not offered');
 const cur = await s.read({id: p.id});
 await assert.rejects(as(AGENT, () => s.layout({...base(cur), storyId: 'S1', format: 'carousel', frames: cur.layouts.carousel.frames.map(f => ({...f, templateId: proposed.id}))})), /no template/);
 // The decision is his.
 await assert.rejects(as(AGENT, () => t.decide({id: proposed.id, operationId: op(), decision: 'accept', expectedRevision: 1, expectedHash: proposed.hash})), e => e.status === 403);
 await assert.rejects(as(ADRIAN, () => t.decide({id: proposed.id, operationId: op(), decision: 'accept', expectedRevision: 1, expectedHash: 'f'.repeat(64)})), e => e.status === 409);
 const markup = await as(AGENT, () => t.propose({operationId: op(), name: 'Invented markup cover', row: 'C', markup: GOOD}));
 assert.deepEqual([markup.status, markup.code, markup.from, markup.photos], ['proposed', null, 'markup', 1]);
 const turned = await as(ADRIAN, () => t.decide({id: markup.id, operationId: op(), decision: 'turn-down', expectedRevision: markup.revision, expectedHash: markup.hash}));
 assert.deepEqual([turned.status, turned.code, turned.decidedBy], ['turned-down', null, ADRIAN]);
 await assert.rejects(as(ADRIAN, () => t.decide({id: markup.id, operationId: op(), decision: 'accept', expectedRevision: turned.revision, expectedHash: turned.hash})), e => e.status === 409);
 const accepted = await as(ADRIAN, () => t.decide({id: proposed.id, operationId: op(), decision: 'accept', expectedRevision: proposed.revision, expectedHash: proposed.hash}));
 const row = accepted.row, shipped = ROWS.find(r => r.letter === row).items.length;
 assert.deepEqual([accepted.status, accepted.code, accepted.decidedBy], ['kept', row + (shipped + 1), ADRIAN], 'the turned-down proposal took no code');
 // Used on a slide, then retired: no longer offered, the slide keeps drawing, and its code is never given again.
 const use = await as(AGENT, () => s.layout({...base(cur), storyId: 'S1', format: 'carousel', frames: cur.layouts.carousel.frames.map((f, i) => ({...f, templateId: i === 1 ? accepted.id : f.templateId}))}));
 await assert.rejects(as(AGENT, () => t.retire({id: accepted.id, operationId: op(), expectedRevision: accepted.revision, expectedHash: accepted.hash})), e => e.status === 403);
 const retired = await as(ADRIAN, () => t.retire({id: accepted.id, operationId: op(), expectedRevision: accepted.revision, expectedHash: accepted.hash}));
 assert.equal(retired.status, 'retired');
 assert.ok(!(await s.templates()).templates.some(x => x.id === accepted.id), 'not offered');
 assert.ok((await s.render({id: p.id, format: 'carousel', frame: 1})).length > 200, 'the plan that uses it keeps drawing');
 const again = await as(AGENT, () => s.setPlaced({...base(use), format: 'carousel', slide: 1, placed: []}));
 assert.equal(again.layouts.carousel.frames[1].templateId, accepted.id, 'a slide that uses it keeps it through other changes');
 const fresh = await s.read({id: p.id});
 await assert.rejects(as(AGENT, () => s.layout({...base(fresh), storyId: 'S1', format: 'story', frames: [{templateId: accepted.id, words: fresh.layouts.carousel.frames[0].words}]})), /retired/);
 const kept = fs.readFileSync(path.join(dataDir, 'templates', accepted.id + '.json'));
 fs.rmSync(path.join(dataDir, 'templates', accepted.id + '.json'));
 const next = await as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented after', row, markup: GOOD}));
 assert.equal(next.code, row + (shipped + 2), 'the next code skips the retired one, even with its file gone');
 assert.equal(t.nextCode(row).code, row + (shipped + 3));
 fs.writeFileSync(path.join(dataDir, 'templates', accepted.id + '.json'), kept);
 // The same operation twice makes one template.
 const opId = op(), one = await as(AGENT, () => t.propose({operationId: opId, name: 'Once', row: 'M', markup: GOOD})), two = await as(AGENT, () => t.propose({operationId: opId, name: 'Once', row: 'M', markup: GOOD}));
 assert.equal(one.id, two.id);
 // A template for one look is offered only in that look.
 const artOnly = await as(ADRIAN, () => t.propose({operationId: op(), name: 'Art only', row: 'S', markup: GOOD, looks: ['art']}));
 assert.deepEqual((await t.list({look: 'teajia'})).templates.filter(x => x.id === artOnly.id), []);
 const plain = await s.read({id: p.id});
 await assert.rejects(as(AGENT, () => s.layout({...base(plain), storyId: 'S1', format: 'carousel', frames: plain.layouts.carousel.frames.map((f, i) => ({...f, templateId: i === 0 ? artOnly.code : f.templateId}))})), e => e.status === 422 && /template for the art look/.test(e.message));
 // Refused proposals.
 for (const bad of [{row: 'Q'}, {row: 'C', kind: 'poster'}, {name: ''}, {name: '<x>'}, {markup: GOOD.replace('{dark.ground}', 'url(https://example.invalid/x)')}, {looks: ['nobody']}])
  await assert.rejects(as(AGENT, () => t.propose({operationId: op(), name: 'Bad', row: 'C', markup: GOOD, ...bad})), e => e.status >= 400 && e.status < 500, JSON.stringify(bad));
 await assert.rejects(as(AGENT, () => t.propose({operationId: op(), name: 'Bad', row: 'C', markup: GOOD.replace('<img src="__IG_LOGO__"', '<img onerror="x()" src="__IG_LOGO__"')})), e => e.status === 422 && /refused: Event handlers/.test(e.message));
});

/* ---------- the commands, the CLI and MCP ---------- */
test('the template, asset and placed commands are in the registry; deciding and retiring are his alone', () => {
 const by = Object.fromEntries(describeRoutes({}).map(c => [c.name, c]));
 for (const name of ['templates', 'template', 'template.propose', 'template.decide', 'template.retire', 'look.assets', 'look.asset.add', 'instagram.template', 'instagram.placed']) { assert.ok(by[name], name); assert.equal(by[name].section, 'outputs', name); }
 for (const name of ['templates', 'template', 'look.assets']) assert.equal(by[name].readOnly, true, name);
 for (const name of ['template.propose', 'look.asset.add', 'instagram.template', 'instagram.placed']) assert.deepEqual(by[name].actors, ['any'], name);
 for (const name of ['template.decide', 'template.retire']) assert.deepEqual(by[name].actors, ['human'], name);
 assert.deepEqual(SUGAR.template, {list: 'templates', read: 'template', propose: 'template.propose', accept: 'template.decide', 'turn-down': 'template.decide', retire: 'template.retire'});
 assert.deepEqual(SUGAR.asset, {list: 'look.assets', add: 'look.asset.add'});
 assert.equal(SUGAR.instagram.placed, 'instagram.placed');
 assert.equal(SUGAR.instagram.template, 'instagram.template');
});

test('through the real server: assets, a markup proposal, his decision, journaled, and reached over MCP', async t => {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => { await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
 const url = 'http://127.0.0.1:' + srv.address().port;
 const cli = (args, input, actor = AGENT) => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
 const assets = await cli(['asset', 'list', 'teajia']);
 assert.equal(assets.exitCode, 0, JSON.stringify(assets.result));
 assert.deepEqual(assets.result.assets.map(a => a.id), ['wordmark', 'seal-excellence', 'seal-home', 'seal-celebration']);
 const look = await cli(['look', 'read', 'mandala-codes']);
 const added = await cli(['asset', 'add'], {id: 'mandala-codes', expectedRevision: look.result.revision, expectedHash: look.result.hash, asset: {id: 'ring', name: 'Ring', kind: 'graphic', file: 'ring.svg', base64: Buffer.from('<svg viewBox="0 0 2 2"><circle r="1" onload="x()"/></svg>').toString('base64')}}, 'agent:codex');
 assert.equal(added.exitCode, 0, JSON.stringify(added.result));
 const served = await fetch(url + '/api/look/asset?id=mandala-codes&file=ring.svg');
 assert.equal(served.headers.get('content-type'), 'image/svg+xml');
 assert.match(served.headers.get('content-security-policy'), /default-src 'none'.*sandbox/);
 assert.ok(!(await served.text()).includes('onload'));
 const proposed = await cli(['template', 'propose'], {name: 'Invented server cover', row: 'C', markup: GOOD}, 'agent:codex');
 assert.equal(proposed.exitCode, 0, JSON.stringify(proposed.result));
 assert.equal(proposed.result.status, 'proposed');
 assert.equal((await cli(['template', 'propose'], {name: 'Bad', row: 'C', markup: GOOD.replace('{dark.line}', '#123456')})).exitCode, 1, 'refused markup');
 assert.equal((await cli(['template', 'accept', proposed.result.id])).exitCode, 5, 'an assistant cannot accept');
 const accepted = await cli(['template', 'accept', proposed.result.id], null, ADRIAN);
 assert.equal(accepted.exitCode, 0, JSON.stringify(accepted.result));
 assert.equal(accepted.result.code, 'C5');
 assert.ok((await cli(['instagram', 'templates'])).result.templates.some(x => x.code === 'C5' && x.owner === true));
 assert.equal((await cli(['template', 'list'], {status: 'kept'})).result.templates[0].id, proposed.result.id);
 const history = JSON.stringify((await cli(['history'], {kind: 'template', id: proposed.result.id})).result);
 assert.ok(history.includes('"kind":"template.propose"') && history.includes('"kind":"template.decide"') && history.includes('agent:codex') && history.includes(ADRIAN), 'journaled: ' + history.slice(0, 300));
 assert.ok(JSON.stringify((await cli(['history'], {kind: 'look', id: 'mandala-codes'})).result).includes('"kind":"look.asset.add"'));
 const tools = createTools({url, actor: 'agent:codex'});
 const listed = await tools.callTool('ar_create_list_commands', {section: 'outputs'});
 for (const name of ['templates', 'template', 'template.propose', 'template.decide', 'template.retire', 'look.assets', 'look.asset.add', 'instagram.template', 'instagram.placed']) assert.ok(listed.commands.some(c => c.name === name), name + ' over MCP');
 assert.equal((await tools.callTool('ar_create_call', {name: 'templates', input: {}})).templates[0].code, 'C5');
 assert.deepEqual((await tools.callTool('ar_create_call', {name: 'look.assets', input: {id: 'mandala-codes'}})).assets.map(a => a.id), ['wordmark', 'ring']);
});

test('instagram placed from the CLI reads the plan, then sets the slide\'s things', async () => {
 const calls = [], list = describeRoutes({});
 const fetchImpl = async (url, init) => {
  const u = new URL(url), body = init.body ? JSON.parse(init.body) : null; calls.push({path: u.pathname, body});
  const json = value => ({ok: true, status: 200, text: async () => JSON.stringify(value)});
  if (u.pathname === '/api/capabilities') return json({commands: list.map(({pattern, ...rest}) => rest)});
  if (u.pathname === '/api/instagram/plan') return json({id: 'plan-1', revision: 4, hash: 'h'.repeat(64)});
  if (u.pathname === '/api/template') return json({id: 'own-x', revision: 2, hash: 'g'.repeat(64)});
  return json({ok: true});
 };
 const args = tail => ['--url', 'http://127.0.0.1:8854', '--actor', AGENT, ...tail];
 assert.equal((await run(args(['instagram', 'placed', '--plan', 'plan-1', '--input', '-']), {fetchImpl, stdin: async () => JSON.stringify({format: 'carousel', slide: 1, placed: []})})).exitCode, 0);
 const post = calls.find(c => c.path === '/api/instagram/placed');
 assert.deepEqual({id: post.body.id, rev: post.body.expectedRevision, slide: post.body.slide}, {id: 'plan-1', rev: 4, slide: 1});
 await run(args(['template', 'turn-down', 'own-x']), {fetchImpl});
 assert.deepEqual((({id, decision, expectedRevision}) => ({id, decision, expectedRevision}))(calls.find(c => c.path === '/api/template/decide').body), {id: 'own-x', decision: 'turn-down', expectedRevision: 2});
 await run(args(['template', 'retire', 'own-x']), {fetchImpl});
 assert.equal(calls.find(c => c.path === '/api/template/retire').body.expectedRevision, 2);
 assert.equal((await run(args(['instagram', 'placed']), {fetchImpl})).exitCode, 2);
});

/* ---------- review fixes ---------- */
test('a code names one layout: a shipped layout whose code his template holds takes the next free code in his home, and keeps it', async () => {
 const {s, p, dataDir} = await plan('teajia');
 const t = createTemplates({dataDir});
 const mine = await as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented clash', row: 'C', markup: GOOD}));
 assert.equal(mine.code, 'C5');
 // Force the clash a later release could bring: his template holds C1, the code of a shipped layout.
 const file = path.join(dataDir, 'templates', mine.id + '.json'), ledgerFile = path.join(dataDir, 'templates', 'codes.json');
 fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"code": "C5"', '"code": "C1"'));
 fs.writeFileSync(ledgerFile, fs.readFileSync(ledgerFile, 'utf8').replace('"code": "C5"', '"code": "C1"').replace('"number": 5', '"number": 1'));
 const listed = (await s.templates()).templates;
 const night = listed.find(x => x.id === 'canvas-P06-night');
 assert.deepEqual([night.code, night.shippedCode], ['C5', 'C1'], 'the shipped layout takes the next free number in its row here');
 assert.equal(listed.find(x => x.id === mine.id).code, 'C1', 'his code never changes');
 // Every code names one layout (an old hand-written twin shares its canvas layout's code, as before).
 const byCode = new Map();
 for (const x of listed) if (x.code && !Object.hasOwn(OLD_TWINS, x.id)) byCode.set(x.code, [...(byCode.get(x.code) || []), x.id]);
 for (const [code, ids] of byCode) assert.equal(ids.length, 1, code + ' names ' + ids.join(' and '));
 const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).given;
 assert.deepEqual(ledger.filter(g => g.shipped).map(g => [g.code, g.shippedCode]), [['C5', 'C1']], 'the move is recorded');
 // Stable from then on, and heard that way.
 assert.equal((await s.templates()).templates.find(x => x.id === 'canvas-P06-night').code, 'C5');
 assert.equal(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).given.length, 2);
 const now = await s.read({id: p.id});
 const said = await as(AGENT, () => s.codes({...base(now), say: 'use C1 and C5'}));
 assert.deepEqual(said.codes.used.map(u => [u.code, u.layout]), [['C1', mine.id], ['C5', 'canvas-P06-night']]);
 // The next template in the row skips both.
 assert.equal((await as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented next', row: 'C', markup: GOOD}))).code, 'C6');
});

test('the ledger never gives a code twice: a ledger that cannot be read refuses, and a lost one is rebuilt from the templates on disk', async () => {
 const dataDir = tmp('ledger-'), t = createTemplates({dataDir});
 const first = await as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented first', row: 'M', markup: GOOD}));
 assert.equal(first.code, 'M6');
 const retired = await as(ADRIAN, () => t.retire({id: first.id, operationId: op(), expectedRevision: first.revision, expectedHash: first.hash}));
 const ledgerFile = path.join(dataDir, 'templates', 'codes.json');
 // Corrupt: no code is given, and nothing changes.
 fs.writeFileSync(ledgerFile, '{"schema": "ar-create.template-codes.v1", "given": [');
 const before = fs.readdirSync(path.join(dataDir, 'templates')).sort();
 await assert.rejects(as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented second', row: 'M', markup: GOOD})), e => e.status === 422 && /cannot be read, so no code is given out/.test(e.message));
 assert.deepEqual(fs.readdirSync(path.join(dataDir, 'templates')).sort(), before, 'no template was written');
 assert.equal(fs.readFileSync(ledgerFile, 'utf8'), '{"schema": "ar-create.template-codes.v1", "given": [');
 const pending = await as(AGENT, () => t.propose({operationId: op(), name: 'Invented proposal', row: 'M', markup: GOOD}));
 await assert.rejects(as(ADRIAN, () => t.decide({id: pending.id, operationId: op(), decision: 'accept', expectedRevision: pending.revision, expectedHash: pending.hash})), e => e.status === 422);
 assert.equal((await t.read({id: pending.id})).status, 'proposed', 'the proposal is untouched');
 assert.throws(() => t.nextCode('M'), e => e.status === 422);
 // A ledger with the wrong shape is not readable either.
 fs.writeFileSync(ledgerFile, JSON.stringify({schema: 'something-else', given: []}));
 await assert.rejects(as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented third', row: 'M', markup: GOOD})), e => e.status === 422);
 // Missing: the templates on disk (the retired one too) still hold their codes.
 fs.rmSync(ledgerFile);
 assert.equal(retired.code, 'M6');
 const accepted = await as(ADRIAN, () => t.decide({id: pending.id, operationId: op(), decision: 'accept', expectedRevision: pending.revision, expectedHash: pending.hash}));
 assert.equal(accepted.code, 'M7', 'the retired M6 is not given again');
 assert.deepEqual(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).given.map(g => g.code), ['M7']);
});

test('the outer slide takes no offset, so the whole slide cannot be shifted', () => {
 for (const prop of ['left: 10px', 'top: 0', 'right: 0', 'bottom: 20px', 'inset: 0'])
  assert.throws(() => checkMarkup('<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; ' + prop + '"><div>__IG_TEXT_0__</div></div>'), e => e.refused && /outer <div> takes no/.test(e.message), prop);
 assert.doesNotThrow(() => checkMarkup('<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden"><div style="position: absolute; left: 10px; top: 0">__IG_TEXT_0__</div></div>'), 'offsets inside the slide are fine');
});

test('svg cleaning judges elements and attributes by their local name, whatever the prefix', () => {
 const svg = '<s:svg xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><s:script>alert(1)</s:script><s:foreignObject><p>x</p></s:foreignObject><s:rect s:onclick="x()" x:onload="y()" width="1"/><s:use s:href="https://example.invalid/a#b"/><s:a q:href="javascript:x"><s:circle r="1"/></s:a><s:g foo:base="http://e.invalid/"/></s:svg>';
 const out = cleanSvg(Buffer.from(svg)).bytes.toString('utf8');
 for (const gone of ['script', 'alert', 'foreignObject', 'onclick', 'onload', 'example.invalid', 'javascript', 'e.invalid', '<s:a']) assert.ok(!out.includes(gone), gone + ' is gone: ' + out);
 assert.match(out, /<s:rect width="1"\/>/);
 assert.match(out, /^<s:svg /);
});

test('saying a retired template\'s code is reported as not used, and the other codes still apply', async () => {
 const {s, p, dataDir} = await plan('teajia');
 const t = createTemplates({dataDir});
 const kept = await as(ADRIAN, () => t.propose({operationId: op(), name: 'Invented to retire', row: 'C', markup: GOOD}));
 await as(ADRIAN, () => t.retire({id: kept.id, operationId: op(), expectedRevision: kept.revision, expectedHash: kept.hash}));
 const said = await as(AGENT, () => s.codes({...base(p), say: 'use ' + kept.code + ' and C1'}));
 assert.deepEqual(said.codes.used.map(u => [u.code, u.slide]), [['C1', 2]]);
 assert.deepEqual(said.codes.unused.map(u => u.code), [kept.code]);
 assert.match(said.codes.unused[0].why, /is retired, so it is no longer offered\. Slide 1 keeps its layout\./);
 assert.equal(said.layouts.carousel.frames[0].templateId, p.layouts.carousel.frames[0].templateId);
});

test('every fixed word of a proposed template is shown plainly on its record', async () => {
 const t = createTemplates({dataDir: tmp('fixed-')});
 const proposed = await as(AGENT, () => t.propose({operationId: op(), name: 'Invented with words', row: 'E', markup: GOOD.replace('</div></div>', '<div>READ MORE</div></div></div>')}));
 const read = await t.read({id: proposed.id});
 assert.deepEqual(read.fixedWords, ['THE FULL STORY', 'READ MORE']);
 assert.throws(() => checkMarkup(GOOD.replace('THE FULL STORY', 'A'.repeat(33))), e => e.refused && /up to 32/.test(e.message));
 assert.deepEqual(checkMarkup(GOOD).fixedWords, ['THE FULL STORY']);
});
