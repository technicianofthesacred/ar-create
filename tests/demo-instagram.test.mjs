// The demo seeding script: one invented Instagram plan with made slides, run twice gives the same plan, and it
// refuses any server that is not the invented demo. Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {seedInstagramDemo, assertInventedDemo} from '../scripts/demo-instagram.mjs';

async function demo(t, packageView) {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false, packageView});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => { await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
 return 'http://127.0.0.1:' + srv.address().port;
}

test('seeding gives one plan with made slides, a placed wordmark and seal, and both kinds of template, and is idempotent', async t => {
 const base = await demo(t, {syntheticFixtures: true});
 const a = await seedInstagramDemo(base), b = await seedInstagramDemo(base);
 assert.equal(a.id, b.id);
 assert.equal(a.link, base + '/document-study/index.html?instagram=' + a.id);
 assert.equal((await (await fetch(base + '/api/instagram/plans')).json()).plans.length, 1);
 const frames = b.plan.layouts.carousel.frames;
 assert.ok(frames.length >= 6);
 assert.equal(frames[0].placed.length, 2);
 const list = async q => (await (await fetch(base + '/api/templates' + q)).json()).templates;
 assert.equal((await list('?status=proposed')).length, 1);
 assert.equal((await list('')).filter(x => x.status === 'kept').length, 1);
 assert.notEqual(b.plan.status, 'ready');
});

test('seeding refuses a server that is not the invented demo, and port 8841', async t => {
 const base = await demo(t, {syntheticFixtures: false});
 await assert.rejects(seedInstagramDemo(base), /invented demo/);
 assert.equal((await (await fetch(base + '/api/instagram/plans')).json()).plans.length, 0);
 await assert.rejects(assertInventedDemo('http://127.0.0.1:8841'), /8841/);
});
