// The demo filler: a believable invented world through the app's own commands, the same on a second run, and never
// on a server that is not the invented demo. Invented content only; the whole 24-subject fill is tried on port 8854.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo, readBack, largeSubjects, STATES} from '../scripts/demo-fill.mjs';

async function demo(t, packageView) {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false, packageView});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => { await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
 return 'http://127.0.0.1:' + srv.address().port;
}
const ONLY = ['questions-for-the-grower', 'water-and-leaf', 'a-teapot-for-guests', 'picking-before-dawn', 'shade-and-patience', 'the-first-cup', 'straw-over-the-rows', 'circle-of-twelve', 'an-old-idea-set-aside'];

test('the fill gives subjects at each state with places, pins, tags, archive and Needs you, and a second run changes nothing', {timeout: 240000}, async t => {
 const base = await demo(t, {syntheticFixtures: true});
 const a = await fillDemo(base, {only: ONLY}), places = async () => (await (await fetch(base + '/api/subject-places')).json()).places;
 assert.deepEqual(a.unreached, []);
 const first = await places(), asks = async () => (await (await fetch(base + '/api/needs-you?status=all')).json()).asks.length;
 assert.equal(first.length, ONLY.length);
 assert.ok(first.every(p => p.saved && p.folder.length && p.tags.length), 'every subject has a folder and tags');
 assert.equal(first.filter(p => p.pinnedAt).length, 3, 'pinned');
 assert.equal(first.filter(p => p.archived).length, 1, 'archived');
 assert.ok(first.some(p => p.folder.join('/') === 'Tea/Gardens'), 'a nested folder');
 const stages = Object.fromEntries(a.readBack.rows.map(r => [r.id, r.stage]));
 assert.deepEqual([stages['demo-questions-for-the-grower'], stages['demo-water-and-leaf'], stages['demo-a-teapot-for-guests'], stages['demo-picking-before-dawn'], stages['demo-shade-and-patience'], stages['demo-the-first-cup'], stages['demo-straw-over-the-rows']], [0, 1, 2, 3, 4, 5, 6]);
 const shade = a.readBack.rows.find(r => r.id === 'demo-shade-and-patience');
 assert.equal(shade.suggestionsWaiting, 1);
 assert.equal(a.readBack.needsYou, 2, 'two things need him (the Carousel plan may raise more of its own)'); const asksBefore = await asks();
 const plans = (await (await fetch(base + '/api/instagram/plans')).json()).plans;
 assert.equal(plans.length, 1);
 assert.equal(plans[0].subject, 'demo-straw-over-the-rows');
 const piecesBefore = (await (await fetch(base + '/api/pieces')).json()).pieces.length, b = await fillDemo(base, {only: ONLY});
 assert.deepEqual(b.readBack.rows, a.readBack.rows, 'nothing doubled or changed');
 assert.deepEqual((await places()).map(p => [p.parentStudyId, p.revision]), first.map(p => [p.parentStudyId, p.revision]), 'no place was rewritten');
 assert.equal((await (await fetch(base + '/api/instagram/plans')).json()).plans.length, 1);
 assert.equal(await asks(), asksBefore); assert.equal(b.readBack.needsYou, 2);
 assert.equal((await (await fetch(base + '/api/pieces')).json()).pieces.length, piecesBefore, 'no workspace piece was added');
});

test('the fill refuses a server that is not the invented demo, and port 8841, and writes nothing', async t => {
 const base = await demo(t, {syntheticFixtures: false});
 await assert.rejects(fillDemo(base), /invented demo/);
 assert.equal((await (await fetch(base + '/api/subject-places')).json()).places.length, 0);
 assert.equal((await (await fetch(base + '/api/study-draft/catalog')).json()).collections.length, 0);
 await assert.rejects(fillDemo('http://127.0.0.1:8841'), /8841/);
});

test('--large makes about 150 subjects, long and short titles, folders and tags, with unique ids', () => {
 const all = largeSubjects();
 assert.ok(all.length + 24 >= 140 && all.length + 24 <= 160);
 assert.equal(new Set(all.map(r => r[0])).size, all.length);
 assert.ok(all.some(r => r[1].length > 60) && all.some(r => r[1].length < 12));
 assert.ok(all.every(r => r[2].length && r[3].length));
 assert.equal(STATES.length, 8);
});
