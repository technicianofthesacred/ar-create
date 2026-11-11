// subject.standing and subjects.standing on a real server with an invented home filled by the demo filler: one
// subject's forms and steps, every subject in one cached read, and the cache kept right after a write.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

const ONLY = ['questions-for-the-grower', 'water-and-leaf', 'a-teapot-for-guests', 'picking-before-dawn', 'shade-and-patience', 'the-first-cup', 'straw-over-the-rows'];
const AGENT = {'X-AR-Actor': 'agent:claude-code', 'X-AR-Client': 'http'};

test('where subjects stand: one subject, all subjects, from CLI and HTTP, and fresh after a write', {timeout: 300000}, async t => {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false, packageView: {syntheticFixtures: true}});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => {await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true});});
 const base = 'http://127.0.0.1:' + srv.address().port;
 const get = async p => {const r = await fetch(base + p, {headers: AGENT}); const v = await r.json(); assert.equal(r.status, 200, p + ': ' + v.error); return v;};
 const post = async (p, body, actor = 'agent:claude-code') => {const r = await fetch(base + p, {method: 'POST', headers: {...AGENT, 'X-AR-Actor': actor, 'Content-Type': 'application/json'}, body: JSON.stringify(body)}); const v = await r.json(); assert.equal(r.status, 200, p + ': ' + v.error); return v;};
 const fill = await fillDemo(base, {only: ONLY});
 assert.deepEqual(fill.unreached, []);

 // In the one registry: read-only, any actor.
 const caps = await get('/api/capabilities');
 for (const name of ['subject.standing', 'subjects.standing']) {const c = caps.commands.find(x => x.name === name); assert.ok(c, name); assert.equal(c.readOnly, true); assert.deepEqual(c.actors, ['any']); assert.equal(c.method, 'GET');}

 const all = await get('/api/subjects/standing'), by = Object.fromEntries(all.subjects.map(s => [s.id, s]));
 assert.equal(all.schema, 'ar-create.subjects-standing.v1');
 const expect = {
  'demo-questions-for-the-grower': ['gather', 'have'],
  'demo-water-and-leaf': ['research', 'facts'],
  'demo-a-teapot-for-guests': ['research', 'facts'],
  'demo-picking-before-dawn': ['research', 'facts'],
  'demo-shade-and-patience': ['create', 'words'],
  'demo-the-first-cup': ['create', 'check'],
 };
 for (const [id, [station, step]] of Object.entries(expect)) {assert.equal(by[id].station, station, id); assert.equal(by[id].next?.step, step, id); assert.equal(by[id].known, true, id);}
 assert.equal(by['demo-shade-and-patience'].next.note, '1 suggestion waiting');
 assert.equal(by['demo-shade-and-patience'].asks, 1, 'the open question about it');
 assert.deepEqual(by['demo-shade-and-patience'].folder, ['Tea', 'Gardens'], 'where it lives');
 const straw = by['demo-straw-over-the-rows'];
 assert.deepEqual(straw.forms.map(f => f.name), ['Article', 'Carousel']);
 assert.equal(straw.next.form, straw.forms[0].key, 'the next step is the first unfinished form\'s');
 assert.ok(straw.forms[1].total > 0 && straw.forms[1].next, 'the Carousel has real steps');
 for (const s of all.subjects) {assert.ok(!('steps' in s)); assert.ok(s.ring >= 0 && s.ring <= 1);}

 // One subject: every step of every form.
 const cup = await get('/api/subject/standing?parentStudyId=demo-the-first-cup');
 const words = cup.forms[0].steps.find(s => s.id === 'words'), check = cup.forms[0].steps.find(s => s.id === 'check');
 assert.equal(words.state, 'done'); assert.equal(check.state, 'next'); assert.equal(check.section, 'check');
 const water = await get('/api/subject/standing?parentStudyId=demo-water-and-leaf');
 assert.equal(water.steps.find(s => s.id === 'have').note, '2 notes', 'a voice note and notes are material');
 assert.ok(!JSON.stringify(water).includes('Nothing yet'));
 assert.equal((await fetch(base + '/api/subject/standing?parentStudyId=no-such-subject')).status, 404);
 assert.equal((await fetch(base + '/api/subject/standing')).status, 400);

 // Warm: nothing is read again.
 assert.equal((await get('/api/subjects/standing')).readAgain, 0);

 // A change to one subject's material re-reads that subject only, and shows in the next read.
 const {projectId} = await get('/api/first-flow/binding?projectKey=demo-water-and-leaf');
 await post('/api/sources/import', {rootId: 'library', folder: 'Projects/' + projectId, urls: [], files: [{name: 'Another invented note.md', content: 'An invented note.\n'}]});
 const after = await get('/api/subjects/standing');
 assert.equal(after.readAgain, 1, 'only the subject the change touched');
 assert.equal((await get('/api/subject/standing?parentStudyId=demo-water-and-leaf')).steps.find(s => s.id === 'have').note, '3 notes');

 // His direction, then his place: each shows in the next read.
 const d = await get('/api/study/human-direction?parentStudyId=demo-water-and-leaf');
 await post('/api/study/human-direction/write', {parentStudyId: 'demo-water-and-leaf', scope: 'project', operationId: crypto.randomUUID(), expectedRevision: d.revision, expectedHash: d.hash, body: 'An invented direction.'}, 'human:adrian');
 assert.match((await get('/api/subject/standing?parentStudyId=demo-water-and-leaf')).steps.find(s => s.id === 'dish').note, /direction is written/);
 const place = (await get('/api/subject-places?parentStudyId=demo-water-and-leaf')).places[0];
 await post('/api/subject-places/save', {parentStudyId: 'demo-water-and-leaf', operationId: crypto.randomUUID(), expectedRevision: place.revision, ...(place.saved ? {expectedHash: place.hash} : {}), archived: !place.archived});
 const moved = await get('/api/subjects/standing');
 assert.equal(moved.subjects.find(s => s.id === 'demo-water-and-leaf').archived, !place.archived);
 assert.ok(moved.readAgain <= 1);

 // The CLI reaches the same reads.
 // Asynchronously: the server answers from this same process.
 const cli = args => new Promise(resolve => execFile(process.execPath, ['agents/cli/ar-create.mjs', '--url', base, '--actor', 'agent:claude-code', ...args], {encoding: 'utf8', maxBuffer: 1 << 24}, (error, stdout, stderr) => resolve({status: error ? error.code : 0, stdout, stderr})));
 const one = await cli(['standing', 'subject', 'demo-the-first-cup']);
 assert.equal(one.status, 0, one.stderr); assert.equal(JSON.parse(one.stdout).next.step, 'check');
 const every = await cli(['standing', 'all']);
 assert.equal(every.status, 0, every.stderr); assert.equal(JSON.parse(every.stdout).count, all.count);
});
