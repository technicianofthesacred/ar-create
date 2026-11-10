// Looks: a brand's colours, type, logo and rules, kept as a DESIGN.md, and any shared layout drawn in any look.
// Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import IG from '../runtime/src/donors/mag/carousel/ig-templates.js';
import {ROWS} from '../runtime/src/donors/mag/carousel/ig-codes.mjs';
import {TEAJIA_SOURCE, isSourceLook, drawInLook} from '../runtime/src/donors/mag/carousel/ig-look-render.mjs';
import {NEW_TEMPLATES, catalog, renderFrame, frameDocument, sheetDocument, layoutIdToCode, lookRefusal} from '../runtime/services/instagram-templates.mjs';
import {createLooks, SHIPPED_LOOKS, DOOR_LOOKS} from '../runtime/services/looks.mjs';
import {parseYaml, readDesign, fontFor} from '../runtime/services/look-design-md.mjs';
import {createInstagramStudio} from '../runtime/services/instagram-studio.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {describeRoutes} from '../runtime/commands.mjs';
import {run, SUGAR} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {VARIANTS} from './helpers/look-variants.mjs';

const TODAY = JSON.parse(fs.readFileSync(new URL('./fixtures/instagram-looks-teajia-today.json', import.meta.url), 'utf8')).hashes;
const ALL = [...Object.keys(IG.T), ...Object.keys(NEW_TEMPLATES)].sort();
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const looksIn = (dataDir = tmp('looks-')) => createLooks({dataDir});
const as = (actor, fn) => withActor({actor, client: 'http'}, fn);
const op = () => crypto.randomUUID();
const ADRIAN = 'human:adrian', AGENT = 'agent:claude-code';
const OWN = new Set(['J', 'Y', 'Z']);
const rowOf = id => layoutIdToCode(id)[0];
const SHARED = Object.keys(IG.T).filter(id => !OWN.has(rowOf(id)));
// Every value the layouts' markup was written with, and the Teajia type and marks.
const TEAJIA_LEFT = /#(?:1a1714|2a2622|3a3530|f3eada|cdc0a8|8d806b|a8874d|f4ece0|e6dbcc|d5c8b4|18130e|443a2c|9a8c78|8e6d2e|ede4d4|241f1a)\b|rgba\(\s*26\s*,\s*23\s*,\s*20|rgba\(\s*243\s*,\s*234\s*,\s*218|Caudex|EB Garamond|Shippori|Noto Serif TC|teajia-wordmark|teajiā|teajia\.com\/read <|[㐀-鿿]|data-pillar-seal/i;

test('every layout still draws byte for byte what it drew before looks existed', () => {
 assert.equal(Object.keys(TODAY).length, ALL.length * Object.keys(VARIANTS).length, 'the record covers every layout and every slide');
 for (const id of ALL) for (const [v, [slide, ctx]] of Object.entries(VARIANTS))
  assert.equal(sha(renderFrame(id, structuredClone(slide), {...ctx})), TODAY[id + '|' + v], id + ' (' + v + ') changed');
});

test('the teajia look draws every layout byte for byte as it was drawn before looks existed', () => {
 const teajia = looksIn().roles('teajia');
 assert.equal(isSourceLook(teajia), true, 'the shipped teajia look is the values the layouts were written with');
 for (const id of ALL) for (const [v, [slide, ctx]] of Object.entries(VARIANTS))
  assert.equal(sha(renderFrame(id, structuredClone(slide), {...ctx}, teajia)), TODAY[id + '|' + v], id + ' (' + v + ') changed in the teajia look');
});

test('the four shipped looks are filled from their real sources', async () => {
 const looks = looksIn();
 const list = (await looks.list()).looks;
 assert.deepEqual(list.map(l => l.id), ['art', 'mandala-codes', 'personal', 'teajia']);
 for (const l of list) { assert.equal(l.drawable, true, l.id + ': ' + l.problems.join(' ')); assert.equal(l.source, 'shipped'); assert.equal(l.revision, 0); }
 assert.deepEqual(DOOR_LOOKS, {teajia: 'teajia', art: 'art', 'mandala-codes': 'mandala-codes', personal: 'personal'});
 const teajia = looks.roles('teajia');
 assert.deepEqual(teajia.dark, {...TEAJIA_SOURCE.dark});
 assert.deepEqual(teajia.light, {...TEAJIA_SOURCE.light});
 assert.deepEqual(Object.values(teajia.fonts).map(f => f.family), ['Caudex', 'EB Garamond', 'Caudex']);
 assert.equal(teajia.logo.dark, '/ig-assets/teajia-wordmark.png');
 const teajiaText = (await looks.read({id: 'teajia'})).text;
 for (const rule of ['never pure black or white', 'covers, closes and single posts', 'No italics', 'at least 30px', 'never stretched', 'calm parts', '佳 excellence, 家 home, 嘉 celebration', 'one slide in a carousel has no words', 'Shippori Mincho', 'Noto Serif TC'])
  assert.ok(teajiaText.includes(rule), 'the teajia look says: ' + rule);
 // Art: the art site's own DESIGN.md, kept whole, with a slides block read from its token names.
 const art = await looks.read({id: 'art'});
 assert.match(art.text, /^---\nversion: alpha\nname: Adrian Rasmussen\n/);
 assert.match(art.text, /## Do's and Don'ts[\s\S]*Don't\*\* draw borders to separate things/);
 assert.deepEqual(art.roles.dark, {ground: '#262321', box: '#3d3226', line: '#524330', headline: '#f2efe9', supporting: '#c2beb8', label: '#8a857c', accent: '#c4aa7c'});
 assert.equal(art.roles.light.ground, '#f5f4f0');
 assert.equal(art.roles.light.accent, '#8a744e');
 assert.deepEqual(Object.values(art.roles.fonts).map(f => f.family), ['Cormorant Garamond', 'Lora', 'Plus Jakarta Sans']);
 assert.deepEqual(art.wanted, [{role: 'label', wanted: 'Karla', drawnIn: 'Plus Jakarta Sans'}], 'the font the site wants is kept, and drawn in the nearest one the app has');
 assert.equal(art.roles.logo.dark, '', 'no logo file in reach: the text wordmark');
 assert.equal(art.roles.logo.wordmark, 'Adrian Rasmussen');
 const mandala = await looks.read({id: 'mandala-codes'});
 assert.match(mandala.text, /^---\nname: Mandala Codes\n/);
 assert.equal(mandala.roles.dark.ground, '#262321');
 assert.equal(mandala.roles.light.ground, '#f5f4f0');
 assert.deepEqual(mandala.wanted.map(w => w.wanted), ['Iowan Old Style', 'Iowan Old Style']);
 const personal = await looks.read({id: 'personal'});
 assert.equal(personal.name, 'Personal');
 assert.match(personal.text, /starts as a copy of the Art look/);
 assert.deepEqual(personal.roles.dark, art.roles.dark);
 assert.deepEqual(personal.roles.fonts, art.roles.fonts);
 // Only font files the repository already has are drawn with.
 const files = [...fs.readdirSync('runtime/public/assets/fonts'), ...fs.readdirSync('runtime/public/ig-assets')].map(n => n.toLowerCase().replace(/[^a-z]/g, ''));
 for (const id of ['art', 'mandala-codes', 'personal', 'teajia']) for (const f of Object.values(looks.roles(id).fonts)) assert.ok(files.some(n => n.startsWith(f.family.toLowerCase().replace(/[^a-z]/g, ''))), f.family + ' has a font file');
 // Nothing but the DESIGN.md files came out of the brands' projects.
 for (const id of fs.readdirSync(SHIPPED_LOOKS)) assert.deepEqual(fs.readdirSync(path.join(SHIPPED_LOOKS, id)), ['DESIGN.md'], id);
});

test('every shared layout draws in every shipped look with no Teajia colour, type, characters or wordmark left', () => {
 const looks = looksIn();
 for (const look of ['art', 'mandala-codes', 'personal']) {
  const roles = looks.roles(look);
  for (const id of SHARED) for (const [v, [slide, ctx]] of Object.entries(VARIANTS)) {
   const html = renderFrame(id, structuredClone(slide), {...ctx}, roles);
   const left = html.match(TEAJIA_LEFT);
   assert.equal(left, null, id + ' (' + v + ') in ' + look + ' still has ' + left?.[0]);
   assert.ok(html.includes(roles.dark.ground) || html.includes(roles.light.ground), id + ' is drawn on the look\'s ground');
  }
  // The logo is the look's: here its name, set in its headline type.
  const cover = renderFrame('canvas-P06-night', {text: 'A line', role: 'cover'}, {}, roles);
  assert.match(cover, new RegExp('<div data-wordmark aria-label="' + roles.logo.wordmark + '"[^>]*font-family: \'Cormorant Garamond\''));
  // On a light post the wordmark takes the light headline colour.
  assert.match(renderFrame('canvas-P08-box-white', {text: 'A line'}, {}, roles), new RegExp('data-wordmark[^>]*color: ' + roles.light.headline + '"'));
  // A chapter character becomes a plain numeral; a seal is left out with its box.
  assert.match(renderFrame('canvas-M12-chapter', {text: 'A line'}, {}, roles), /<div data-chapter-number style="[^"]*">1<\/div>/);
  const seal = renderFrame('canvas-F05-full-seal', {text: 'A line'}, {}, roles);
  assert.ok(!seal.includes('writing-mode: vertical-rl') && !seal.includes('background: ' + roles.dark.accent), 'the seal and its gold box are gone');
  assert.ok(!renderFrame('H6', {text: 'A line', role: 'cover', pillar: '家'}, {}, roles).includes('data-pillar-seal'));
  // The close says where this brand's reader goes next.
  assert.ok(renderFrame('H10', {text: 'Title · link', role: 'close'}, {}, roles).includes(roles.link + ' <span'));
 }
});

test('Teajia\'s own rows are refused in another look with a plain reason, and drawn in its own', () => {
 const looks = looksIn(), art = looks.roles('art'), teajia = looks.roles('teajia');
 const own = ROWS.filter(r => OWN.has(r.letter)).flatMap(r => r.items.map(([code]) => code));
 assert.equal(own.length, 19);
 for (const code of own) {
  assert.throws(() => renderFrame(code, {text: 'A line'}, {}, art), e => e.status === 422 && new RegExp('^' + code + ' \\(.+\\) is one of Teajia\'s own layouts .+ not drawn in the Adrian Rasmussen look\\. Choose a shared layout, or the Teajia look\\.$').test(e.message), code);
  assert.ok(renderFrame(code, {text: 'A line'}, {}, teajia).length > 100);
 }
 assert.equal(lookRefusal('C1', art), null);
 const listed = catalog();
 assert.deepEqual(listed.filter(t => t.onlyIn === 'teajia').map(t => t.code).sort(), [...own].sort(), 'the catalogue says which layouts are Teajia\'s own');
 assert.ok(listed.filter(t => !OWN.has(t.rowLetter)).every(t => t.onlyIn === null));
});

test('the Story and reel layouts keep their own colours in every look', () => {
 const looks = looksIn();
 for (const look of ['teajia', 'art', 'mandala-codes', 'personal']) for (const id of Object.keys(NEW_TEMPLATES)) for (const [v, [slide, ctx]] of Object.entries(VARIANTS))
  assert.equal(sha(renderFrame(id, structuredClone(slide), {...ctx}, looks.roles(look))), TODAY[id + '|' + v], id + ' in ' + look);
});

test('the mapping happens once: a value is never mapped twice, and words on a slide are never touched', () => {
 // A look whose dark ground is Teajia's dark box, and whose box is Teajia's dark ground: a swap, not a chain.
 const look = {...looksIn().roles('art'), id: 'swap', dark: {...TEAJIA_SOURCE.dark, ground: TEAJIA_SOURCE.dark.box, box: TEAJIA_SOURCE.dark.ground}};
 const html = drawInLook('<div style="background: #1a1714; color: #f3eada"><div style="background: #2a2622">#1a1714 stays as written</div></div>', look);
 assert.equal(html, '<div style="background: #2a2622; color: #f3eada"><div style="background: #1a1714">#1a1714 stays as written</div></div>');
});

/* ---------- reading a DESIGN.md and proposing a look ---------- */
const INVENTED = `---
version: alpha
name: Invented Pottery
description: >-
  A made-up studio for this test,
  in two lines.
colors:
  primary: "#b5651d"   # clay
  background: "#1c1b19"
  surface: "#292724"
  on-background: "#efe9df"
  background-light: "#faf7f2"
  on-background-light: "#22201d"
typography:
  display:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: 48px
  body:
    fontFamily: Inter
  label-caps:
    fontFamily: Inter
    letterSpacing: "0.08em"
---

## Overview

An invented studio.
`;

test('the front matter is read as the DESIGN.md format writes it', () => {
 const doc = parseYaml('a: 1\nb: "#fff" # a comment\nc:\n  d: plain words\n  e: \'it\'\'s\'\nf: >-\n  one\n  two\nlist:\n  - x\n  - "y"\nflow: [a, b]\n');
 assert.deepEqual(doc, {a: 1, b: '#fff', c: {d: 'plain words', e: "it's"}, f: 'one two', list: ['x', 'y'], flow: ['a', 'b']});
 assert.throws(() => readDesign('no front matter'), e => e.status === 400);
 assert.throws(() => parseYaml('a: 1\na: 2'), /twice/);
 assert.deepEqual(fontFor('Karla'), {family: 'Plus Jakarta Sans', serif: false, wanted: 'Karla'});
 assert.deepEqual(fontFor('Lora'), {family: 'Lora', serif: true});
 assert.equal(fontFor('Some New Grotesk, sans-serif').family, 'Plus Jakarta Sans');
});

test('import keeps the file whole, adds a slides block from the token names, and reports every guess', async () => {
 const looks = looksIn();
 const p = await looks.propose({text: INVENTED});
 assert.equal(p.id, 'invented-pottery');
 const frontEnd = INVENTED.indexOf('\n---\n\n## Overview');
 assert.ok(p.text.startsWith(INVENTED.slice(0, frontEnd)), 'the front matter is kept as it was');
 assert.ok(p.text.endsWith(INVENTED.slice(frontEnd)), 'the prose is kept as it was');
 assert.match(p.text, /\nslides:\n  dark:\n    ground: "\{colors\.background\}"/);
 assert.equal(p.roles.dark.ground, '#1c1b19');
 assert.equal(p.roles.dark.box, '#292724');
 assert.equal(p.roles.dark.headline, '#efe9df');
 assert.equal(p.roles.dark.accent, '#b5651d');
 assert.equal(p.roles.light.ground, '#faf7f2');
 assert.equal(p.roles.light.headline, '#22201d');
 assert.equal(p.roles.fonts.label.family, 'Plus Jakarta Sans');
 const said = p.guesses.map(g => g.role);
 for (const role of ['dark.line', 'dark.supporting', 'dark.label', 'light.box', 'light.line', 'fonts.body', 'fonts.label', 'logo']) assert.ok(said.includes(role), role + ' is reported as a guess');
 assert.ok(!said.includes('dark.ground') && !said.includes('dark.accent'), 'clear names are not guesses');
 assert.ok(p.guesses.every(g => typeof g.why === 'string' && g.why.length > 20));
 assert.equal(p.existing, null);
 // Nothing was saved.
 assert.equal((await looks.list()).looks.length, 4);
 // A file with no clear names: roles by lightness and contrast, each said.
 const plain = await looks.propose({text: '---\nname: Plain\ncolors:\n  sand: "#e8dcc4"\n  night: "#141210"\n  rust: "#b0532c"\n---\n'});
 assert.equal(plain.roles.dark.ground, '#141210');
 assert.equal(plain.roles.light.ground, '#e8dcc4');
 assert.equal(plain.roles.dark.accent, '#b0532c');
 assert.match(plain.guesses.find(g => g.role === 'dark.ground').why, /darkest colour, night/);
 // A file that brings its own slides block keeps it.
 const own = await looks.propose({text: p.text, id: 'pottery'});
 assert.equal(own.keptOwnSlides, true);
 assert.equal(own.text, p.text);
 assert.deepEqual(own.guesses, []);
});

test('import reads a path only inside the home, and never the network', async () => {
 const home = tmp('look-home-'), dataDir = path.join(home, 'data');fs.mkdirSync(dataDir);
 const looks = createLooks({dataDir});
 fs.mkdirSync(path.join(home, 'imports'));fs.writeFileSync(path.join(home, 'imports', 'DESIGN.md'), INVENTED);
 assert.equal((await looks.propose({path: path.join(home, 'imports', 'DESIGN.md')})).from, 'path');
 const outside = path.join(tmp('elsewhere-'), 'DESIGN.md');fs.writeFileSync(outside, INVENTED);
 await assert.rejects(looks.propose({path: outside}), e => e.status === 403);
 await assert.rejects(looks.propose({path: 'https://example.com/DESIGN.md'}), e => e.status === 400 && /never fetched/.test(e.message));
 await assert.rejects(looks.propose({path: 'imports/DESIGN.md'}), e => e.status === 400);
 fs.symlinkSync(outside, path.join(home, 'imports', 'linked.md'));
 await assert.rejects(looks.propose({path: path.join(home, 'imports', 'linked.md')}), e => e.status === 403);
});

/* ---------- saving: the home copy wins ---------- */
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a0b6c6a50000000049454e44ae426082', 'hex').toString('base64');

test('a saved look goes to the home with its actor, revision and files, and wins over the shipped look', async () => {
 const dataDir = tmp('looks-save-'), looks = createLooks({dataDir});
 const p = await looks.propose({text: INVENTED});
 await assert.rejects(looks.save({id: 'pottery', operationId: op(), text: p.text}), e => e.status === 400 && /X-AR-Actor/.test(e.message), 'a write names its author');
 const first = await as(AGENT, () => looks.save({id: 'pottery', operationId: op(), text: p.text}));
 assert.equal(first.revision, 1);
 assert.equal(first.updatedBy, AGENT);
 assert.equal(first.source, 'home');
 assert.ok(fs.existsSync(path.join(dataDir, 'looks', 'pottery', 'DESIGN.md')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'looks', 'pottery', 'look.json'), 'utf8')).operations[0].actor, AGENT);
 // An existing look needs the revision and hash that were read.
 await assert.rejects(as(AGENT, () => looks.save({id: 'pottery', operationId: op(), text: p.text})), e => e.status === 400 && /expectedRevision/.test(e.message));
 await assert.rejects(as(AGENT, () => looks.save({id: 'pottery', operationId: op(), text: p.text, expectedRevision: 0, expectedHash: first.hash})), e => e.status === 409);
 // A logo file comes with the look and is served from it.
 const withLogo = p.text.replace('    dark: ""\n    light: ""', '    dark: "mark.png"\n    light: ""');
 await assert.rejects(as(ADRIAN, () => looks.save({id: 'pottery', operationId: op(), text: withLogo, expectedRevision: 1, expectedHash: first.hash})), e => e.status === 422 && /mark\.png/.test(e.message), 'a logo it does not have');
 const opId = op();
 const second = await as(ADRIAN, () => looks.save({id: 'pottery', operationId: opId, text: withLogo, assets: [{name: 'mark.png', base64: PNG}], expectedRevision: 1, expectedHash: first.hash}));
 assert.equal(second.revision, 2);
 assert.equal(second.updatedBy, ADRIAN);
 assert.equal(second.roles.logo.dark, '/api/look/asset?id=pottery&file=mark.png');
 assert.deepEqual(looks.asset({id: 'pottery', file: 'mark.png'}).bytes, Buffer.from(PNG, 'base64'));
 assert.equal((await as(ADRIAN, () => looks.save({id: 'pottery', operationId: opId, text: withLogo, assets: [{name: 'mark.png', base64: PNG}], expectedRevision: 1, expectedHash: first.hash}))).revision, 2, 'the same operation saves nothing twice');
 await assert.rejects(as(ADRIAN, () => looks.save({id: 'pottery', operationId: op(), text: withLogo, assets: [{name: 'mark.png', base64: Buffer.from('not an image').toString('base64')}], expectedRevision: 2, expectedHash: second.hash})), e => e.status === 415);
 // The look's own logo file replaces the wordmark.
 const html = renderFrame('canvas-P06-night', {text: 'A line', role: 'cover'}, {}, looks.roles('pottery'));
 assert.match(html, /<img src="\/api\/look\/asset\?id=pottery&amp;file=mark\.png" alt="Invented Pottery"/);
 // A look that cannot be drawn is not saved.
 await assert.rejects(as(ADRIAN, () => looks.save({id: 'broken', operationId: op(), text: INVENTED})), e => e.status === 422 && /no slides: block/.test(e.message));
 // Teajia's wordmark stays Teajia's.
 const borrowed = p.text.replace('    dark: ""', '    dark: "/ig-assets/teajia-wordmark.png"');
 await assert.rejects(as(ADRIAN, () => looks.save({id: 'borrowed', operationId: op(), text: borrowed})), e => e.status === 422 && /belongs to Teajia/.test(e.message));
 // The home copy of a shipped look wins over it.
 const shipped = await looks.read({id: 'teajia'});
 const golder = shipped.text.replace('gold: "#a8874d"', 'gold: "#b8974d"');
 const changed = await as(ADRIAN, () => looks.save({id: 'teajia', operationId: op(), text: golder, expectedRevision: 0, expectedHash: shipped.hash}));
 assert.equal(changed.source, 'home, changing the shipped look');
 assert.equal(changed.revision, 1);
 assert.equal(looks.roles('teajia').dark.accent, '#b8974d');
 const drawn = renderFrame('canvas-M12-chapter', {text: 'A line'}, {}, looks.roles('teajia'));
 assert.ok(drawn.includes('#b8974d') && !drawn.includes('#a8874d') && drawn.includes('壹'), 'his gold, and Teajia keeps its own characters');
 assert.equal(looksIn().roles('teajia').dark.accent, '#a8874d', 'the shipped look itself is untouched');
});

/* ---------- plans draw in their look ---------- */
const TRANSCRIPT = 'Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.\n\nMender: When I sit with one bowl for a whole day, my own day gets quieter.';
const T_ID = '11111111-2222-4333-8444-555555555555', T_HASH = crypto.createHash('sha256').update(TRANSCRIPT).digest('hex');
const PHOTO = '21111111-2222-4333-8444-555555555555';
const library = {snapshot: async (id, {includeBody} = {}) => { if (id === T_ID) return {id, hash: T_HASH, path: '/x/talk.md', text: includeBody ? TRANSCRIPT : undefined}; if (id === PHOTO) return {id, hash: 'b'.repeat(64), path: '/x/photo.jpg'}; throw Error('missing'); }};
async function plan(door) {
 const dataDir = tmp('looks-plan-'), s = createInstagramStudio({dataDir, library});
 const made = await as(AGENT, () => s.propose({operationId: op(), subject: 'proj-1', title: 'The mender', door, material: {transcripts: [{sourceId: T_ID, sourceHash: T_HASH}], photos: [{sourceId: PHOTO, caption: 'A bowl'}]}}));
 const line = made.lines.find(l => l.text.startsWith('I think every crack'));
 const p = await as(AGENT, () => s.propose({id: made.id, operationId: op(), expectedRevision: made.revision, expectedHash: made.hash, stories: [{title: 'Cracks', readback: 'Cracks record use.', dish: 'A carousel.', why: 'Strong.', reader: 'The maker', spine: [line.id, made.lines.find(l => l.text.startsWith('When I sit')).id], matches: [{photoId: 'P1', lineId: line.id, why: 'The seam.'}]}]}));
 return {s, p, dataDir, line};
}
const base = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});
const slideOf = f => ({role: f.role, text: f.words.map(w => w.text).join('\n\n'), label: f.label, credit: f.credit, photos: f.photos.map(ph => ({src: '/api/sources/blob?id=' + encodeURIComponent(PHOTO), x: ph.x, y: ph.y}))});

test('a plan draws in its door\'s look; a teajia plan and a plan with no door draw exactly as before', async () => {
 for (const door of ['teajia', '']) {
  const {s, p} = await plan(door);
  assert.equal(p.look, undefined, 'no look is written onto a plan');
  assert.deepEqual(p.drawnIn, door ? {id: 'teajia', from: 'door'} : {id: 'teajia', from: 'default'});
  const laid = await as(AGENT, () => s.layout({...base(p), storyId: 'S1', format: 'carousel'}));
  const frames = laid.layouts.carousel.frames;
  for (const [n, f] of frames.entries())
   assert.equal(await s.render({id: p.id, format: 'carousel', frame: n}), frameDocument('carousel', renderFrame(f.templateId, slideOf(f), {index: n, total: frames.length, start: 0, format: 'carousel'}), 'The mender · ' + (n + 1)));
 }
 const {p} = await plan('art');
 assert.deepEqual(p.drawnIn, {id: 'art', from: 'door'});
});

test('a plan saved before looks keeps its hash, and its revision check still passes', async () => {
 const {s, p, dataDir} = await plan('art');
 const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'instagram-plans', p.id + '.json'), 'utf8'));
 assert.equal(Object.hasOwn(stored, 'look'), false);
 // The hash as it was computed before looks existed.
 const old = crypto.createHash('sha256').update(JSON.stringify({subject: stored.subject, title: stored.title, door: stored.door, material: stored.material, lines: stored.lines, moments: stored.moments, flags: stored.flags, confirmations: stored.confirmations, marks: stored.marks, meaningLog: stored.meaningLog, stories: stored.stories, gaps: stored.gaps, heard: stored.heard, chosen: stored.chosen, layouts: stored.layouts, ready: stored.ready})).digest('hex');
 assert.equal((await s.read({id: p.id})).hash, old);
});

test('instagram.look sets the look a plan draws in, as a proposal with the layout\'s guards', async () => {
 const {s, p, line} = await plan('art');
 const laid = await as(AGENT, () => s.layout({...base(p), storyId: 'S1', format: 'carousel', frames: ['C1', 'S1'].map(templateId => ({templateId, words: [{lineId: line.id, text: line.text}], photos: [{photoId: 'P1'}]}))}));
 const art = await s.render({id: p.id, format: 'carousel', frame: 0});
 assert.ok(art.includes('#262321') && !TEAJIA_LEFT.test(art.replace(/<style>[\s\S]*?<\/style>/, '')), 'an art plan draws in the art look');
 const set = await as(AGENT, () => s.setLook({...base(laid), look: 'mandala-codes'}));
 assert.equal(set.look, 'mandala-codes');
 assert.deepEqual(set.drawnIn, {id: 'mandala-codes', from: 'look'});
 assert.equal(set.revision, laid.revision + 1);
 assert.equal(set.updatedBy, AGENT);
 assert.ok(JSON.parse(fs.readFileSync(path.join(s.asksFile(p.id), '..', p.id + '.json'), 'utf8')).operations.some(o => o.actor === AGENT && o.what === 'look mandala-codes'));
 await assert.rejects(as(AGENT, () => s.setLook({...base(set), expectedRevision: set.revision - 1, look: 'art'})), e => e.status === 409);
 await assert.rejects(as(AGENT, () => s.setLook({...base(set), look: 'nobody'})), e => e.status === 404);
 await assert.rejects(as(AGENT, () => s.setLook({...base(set), look: 'Not an id'})), e => e.status === 400);
 await assert.rejects(as(AGENT, () => s.setLook({...base(set)})), e => e.status === 400);
 // With a look of its own, Teajia's own layouts are refused at layout time, plainly; a code for one is reported.
 await assert.rejects(as(AGENT, () => s.layout({...base(set), storyId: 'S1', format: 'carousel', frames: ['C1', 'J1'].map(templateId => ({templateId, words: [{lineId: line.id, text: line.text}], photos: []}))})), e => e.status === 422 && /Frame 2: J1 .* is one of Teajia's own layouts/.test(e.message));
 const coded = await as(AGENT, () => s.codes({...base(set), storyId: 'S1', say: 'C2 and J1'}));
 assert.deepEqual(coded.codes.unused.map(u => u.code), ['J1']);
 assert.match(coded.codes.unused[0].why, /Teajia's own layouts/);
 // His yes: a look changes how every format draws, so it needs his yes again, and an assistant cannot change it after.
 const chosen = await as(ADRIAN, () => s.choose({...base(coded), storyId: 'S1'}));
 const ready = await as(ADRIAN, () => s.ready({...base(chosen), format: 'carousel'}));
 await assert.rejects(as(AGENT, () => s.setLook({...base(ready), look: 'art'})), e => e.status === 409 && /Ask him/.test(e.message));
 const his = await as(ADRIAN, () => s.setLook({...base(ready), look: 'art'}));
 assert.deepEqual(his.ready, {}, 'a changed look needs his yes again');
 // Back to the door's look.
 const door = await as(AGENT, () => s.setLook({...base(his), look: null}));
 assert.equal(door.look, undefined);
 assert.deepEqual(door.drawnIn, {id: 'art', from: 'door'});
});

test('a look a plan\'s slides cannot be drawn in is refused; an older plan keeps drawing Teajia\'s own layouts from its door', async () => {
 const {s, p, line} = await plan('personal');
 // Before looks, an assistant could lay a personal plan out in a Teajia-only layout. It still draws, as before.
 const laid = await as(AGENT, () => s.layout({...base(p), storyId: 'S1', format: 'story', frames: [{templateId: 'Y4', words: [{lineId: line.id, text: line.text}], photos: [{photoId: 'P1'}]}]}));
 const f = laid.layouts.story.frames[0], before = renderFrame('canvas-C04-cover-teajia-dark', slideOf(f), {index: 0, total: 1, start: 0, format: 'story'});
 assert.equal(await s.render({id: p.id, format: 'story', frame: 0}), frameDocument('story', before, 'The mender · 1'));
 await assert.rejects(as(AGENT, () => s.setLook({...base(laid), look: 'art'})), e => e.status === 422 && /The story's slide 1: Y4 .* Teajia's own layouts/.test(e.message));
 const teajia = await as(AGENT, () => s.setLook({...base(laid), look: 'teajia'}));
 assert.equal(teajia.look, 'teajia');
 assert.equal(await s.sheet({id: p.id, format: 'story'}), sheetDocument('story', [before], 'The mender'));
});

/* ---------- the commands, the CLI and MCP ---------- */
test('the look commands are in the registry, in the existing style', () => {
 const list = describeRoutes({}), by = Object.fromEntries(list.map(c => [c.name, c]));
 for (const name of ['looks', 'look', 'look.asset', 'look.save', 'look.import', 'instagram.look']) { assert.ok(by[name], name); assert.equal(by[name].section, 'outputs', name); }
 for (const name of ['looks', 'look', 'look.asset', 'look.import']) assert.equal(by[name].readOnly, true, name);
 for (const name of ['look.save', 'instagram.look']) { assert.equal(by[name].readOnly, false); assert.deepEqual(by[name].actors, ['any'], name + ' is open to the owner and assistants'); }
 assert.deepEqual(by['instagram.ready'].actors, ['human']);
 assert.deepEqual(SUGAR.look, {list: 'looks', read: 'look', save: 'look.save', import: 'look.import'});
 assert.equal(SUGAR.instagram.look, 'instagram.look');
});

async function server(t) {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => { await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
 const url = 'http://127.0.0.1:' + srv.address().port;
 const cli = (args, input, actor = AGENT) => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
 const get = route => new Promise((resolve, reject) => http.get(url + route, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks)})); }).on('error', reject));
 return {url, cli, get, dataDir: config.dataDir};
}

test('through the real server: list, read, import and save from the CLI, journaled, and reached over MCP', async t => {
 const f = await server(t);
 const list = await f.cli(['look', 'list']);
 assert.equal(list.exitCode, 0, JSON.stringify(list.result));
 assert.deepEqual(list.result.looks.map(l => l.id), ['art', 'mandala-codes', 'personal', 'teajia']);
 const read = await f.cli(['look', 'read', 'art']);
 assert.equal(read.exitCode, 0);
 assert.equal(read.result.roles.dark.ground, '#262321');
 assert.match(read.result.text, /^---\nversion: alpha/);
 assert.notEqual((await f.cli(['look', 'read', 'nobody'])).exitCode, 0);
 const proposed = await f.cli(['look', 'import'], {text: INVENTED, id: 'pottery'}, 'agent:codex');
 assert.equal(proposed.exitCode, 0, JSON.stringify(proposed.result));
 assert.ok(proposed.result.guesses.length > 0);
 const saved = await f.cli(['look', 'save'], {id: 'pottery', text: proposed.result.text, assets: [{name: 'mark.png', base64: PNG}]}, 'agent:codex');
 assert.equal(saved.exitCode, 0, JSON.stringify(saved.result));
 assert.equal(saved.result.updatedBy, 'agent:codex');
 assert.ok(fs.existsSync(path.join(f.dataDir, 'looks', 'pottery', 'mark.png')));
 const stale = await f.cli(['look', 'save'], {id: 'pottery', text: proposed.result.text, expectedRevision: 0, expectedHash: saved.result.hash});
 assert.equal(stale.exitCode, 3, 'a stale save is a conflict');
 const asset = await f.get('/api/look/asset?id=pottery&file=mark.png');
 assert.equal(asset.status, 200);
 assert.equal(asset.type, 'image/png');
 assert.equal((await f.get('/api/look/asset?id=pottery&file=../look.json')).status, 404);
 const history = await f.cli(['history'], {kind: 'look', id: 'pottery'});
 assert.equal(history.exitCode, 0);
 assert.ok(JSON.stringify(history.result).includes('"kind":"look.save"') && JSON.stringify(history.result).includes('agent:codex'), 'the save is journaled: ' + JSON.stringify(history.result).slice(0, 400));
 const tools = createTools({url: f.url, actor: 'agent:codex'});
 const viaMcp = await tools.callTool('ar_create_call', {name: 'looks', input: {}});
 assert.ok(viaMcp.looks.some(l => l.id === 'pottery'));
 const listed = await tools.callTool('ar_create_list_commands', {section: 'outputs'});
 for (const name of ['looks', 'look', 'look.save', 'look.import', 'instagram.look']) assert.ok(listed.commands.some(c => c.name === name), name + ' over MCP');
 const outside = path.join(tmp('elsewhere-'), 'DESIGN.md');fs.writeFileSync(outside, INVENTED);
 assert.equal((await f.cli(['look', 'import'], {path: outside})).exitCode, 5, 'a path outside the home is refused');
});

test('instagram look from the CLI reads the plan, then sets its look', async () => {
 const calls = [], list = describeRoutes({});
 const fetchImpl = async (url, init) => {
  const u = new URL(url), body = init.body ? JSON.parse(init.body) : null;calls.push({path: u.pathname, body});
  const json = value => ({ok: true, status: 200, text: async () => JSON.stringify(value)});
  if (u.pathname === '/api/capabilities') return json({commands: list.map(({pattern, ...rest}) => rest)});
  if (u.pathname === '/api/instagram/plan') return json({id: 'plan-1', revision: 4, hash: 'h'.repeat(64)});
  return json({ok: true});
 };
 const answer = await run(['--url', 'http://127.0.0.1:8854', '--actor', AGENT, 'instagram', 'look', '--plan', 'plan-1', '--look', 'art'], {fetchImpl});
 assert.equal(answer.exitCode, 0);
 const post = calls.find(c => c.path === '/api/instagram/look');
 assert.deepEqual({look: post.body.look, id: post.body.id, rev: post.body.expectedRevision}, {look: 'art', id: 'plan-1', rev: 4});
 await run(['--url', 'http://127.0.0.1:8854', '--actor', AGENT, 'instagram', 'look', '--plan', 'plan-1', '--look', 'door'], {fetchImpl});
 assert.equal(calls.filter(c => c.path === '/api/instagram/look').at(-1).body.look, null);
});
