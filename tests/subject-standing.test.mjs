// subject.standing and subjects.standing on a real server with an invented home filled by the demo filler: one
// subject's forms and steps, every subject in one cached read, and the cache kept right after a write.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import os from 'node:os';
import {createServer} from '../runtime/server.mjs';
import {createSubjectStanding} from '../runtime/services/subject-standing.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';

const ONLY = ['market-morning', 'an-old-idea-set-aside', 'questions-for-the-grower', 'water-and-leaf', 'a-teapot-for-guests', 'picking-before-dawn', 'shade-and-patience', 'the-first-cup', 'straw-over-the-rows'];
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

 // A suggestion made on the current words waits for the proposal owner's own answer: until then the list says Not known.
 const first = (await get('/api/subjects/standing')).subjects.find(s => s.id === 'demo-shade-and-patience');
 assert.ok(first.next === null || first.next.step === 'words');
 if (first.next === null) assert.equal(first.known, false);
 assert.equal((await get('/api/subject/standing?parentStudyId=demo-shade-and-patience')).facts.suggestions, 1, 'one subject waits for the answer');
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

 // Archived: resting, whatever its steps say, so Home never shows it at work.
 const shelved = moved.subjects.find(s => s.id === 'demo-water-and-leaf');
 if (shelved.archived) {assert.equal(shelved.station, 'resting'); assert.equal(shelved.resting, 'archived');}
 const old = (await get('/api/subjects/standing')).subjects.find(s => s.id === 'demo-an-old-idea-set-aside');
 if (old) {assert.equal(old.station, 'resting'); assert.equal(old.resting, 'archived');}

 // Nothing records whether a piece is out: no subject is called published or not, and Publish says Not known.
 assert.ok((await get('/api/subjects/standing')).subjects.every(s => s.published === null && s.station !== 'published'));
 assert.equal(cup.forms[0].steps.find(s => s.id === 'publish').state, 'unknown');

 // A piece made the way the Subject screen's Add a form makes it (study.outputs.create, kind post, from the subject's
 // own writing place) is counted at once, in the one subject and in the list.
 const mm = (await get('/api/study-draft/catalog')).collections.find(c => c.parentStudyId === 'demo-market-morning');
 const mmScope = {rootBindingId: mm.bindingId, parentStudyId: 'demo-market-morning'};
 assert.deepEqual((await get('/api/subject/standing?parentStudyId=demo-market-morning')).forms, []);
 const [mmNative, mmOuts] = await Promise.all([get('/api/study-draft/read?' + new URLSearchParams({bindingId: mm.bindingId, parentStudyId: 'demo-market-morning'})), get('/api/study/outputs?' + new URLSearchParams(mmScope))]);
 const made = await post('/api/study/outputs/create', {...mmScope, kind: 'post', sourceBindingId: mm.bindingId, expectedNative: mmNative.expected, expectedOutput: mmOuts.expectedOutput, operationId: crypto.randomUUID()}, 'human:adrian');
 const mmOne = await get('/api/subject/standing?parentStudyId=demo-market-morning');
 assert.deepEqual(mmOne.forms.map(f => [f.name, f.id]), [['Post', made.view.output.id]]);
 assert.ok(!mmOne.steps, 'no "Choose a form" once it has one');
 assert.deepEqual((await get('/api/subjects/standing')).subjects.find(s => s.id === 'demo-market-morning').forms.map(f => f.name), ['Post']);

 // A Carousel-only subject: its plan is its one form, with real steps, reaching Write, Read and Check.
 const plan = await post('/api/instagram/plan', {operationId: crypto.randomUUID(), subject: 'demo-a-teapot-for-guests', title: 'An invented plan', door: 'teajia'});
 const teapot = await get('/api/subject/standing?parentStudyId=demo-a-teapot-for-guests');
 assert.deepEqual(teapot.forms.map(f => f.id), [plan.id]); assert.equal(teapot.forms[0].name, 'Carousel');
 assert.ok(teapot.forms[0].steps.some(x => x.id === 'story') && teapot.forms[0].steps.some(x => x.id === 'posttext'));
 for (const sec of ['write', 'read', 'check']) assert.ok(teapot.reached.includes(sec), sec);
 assert.equal((await get('/api/subjects/standing')).subjects.find(s => s.id === 'demo-a-teapot-for-guests').forms[0].name, 'Carousel');

 // A subject made by a chat intake holds his words: they are material, never "Nothing yet".
 const intake = await post('/api/simmer/intake', {title: 'An invented intake', words: [{text: 'Invented words said in a chat about a teapot.'}], operationId: crypto.randomUUID()});
 const chat = (await get('/api/subjects/standing')).subjects.find(s => s.id === intake.subject);
 assert.ok(chat, 'the intake subject is listed'); assert.notEqual(chat.next?.step, 'have');
 const chatOne = await get('/api/subject/standing?parentStudyId=' + encodeURIComponent(intake.subject));
 assert.equal(chatOne.steps.find(x => x.id === 'have').state, 'done'); assert.equal(chatOne.facts.material.notes, 1);
 // More words for a filled demo subject count too.
 await post('/api/simmer/intake', {subject: 'demo-the-first-cup', words: [{text: 'More invented words about the first cup.'}], operationId: crypto.randomUUID()});
 assert.equal((await get('/api/subject/standing?parentStudyId=demo-the-first-cup')).facts.material.notes, 3);

 // A suggestion made before the words changed is stale: the app no longer offers it, and nor does this.
 const scope = {bindingId: by['demo-shade-and-patience'].forms[0] && (await get('/api/study-draft/catalog')).collections.find(c => c.parentStudyId === 'demo-shade-and-patience').bindingId, parentStudyId: 'demo-shade-and-patience'};
 const root = await get('/api/study-draft/read?' + new URLSearchParams(scope));
 await post('/api/study-draft/save', {...scope, operationId: crypto.randomUUID(), expected: root.expected, operations: [{kind: 'insert', id: crypto.randomUUID(), beforeId: root.projection.at(-1).id, raw: 'An invented paragraph added afterwards.'}]}, 'human:adrian');
 const offered = ((await get('/api/study-ai/requests?' + new URLSearchParams(scope))).items || []).filter(i => i.status === 'pending' && !i.stale).length;
 assert.equal(offered, 0, 'the app itself no longer offers it');
 const shade = await get('/api/subject/standing?parentStudyId=demo-shade-and-patience');
 assert.notEqual(shade.forms[0].steps.find(x => x.id === 'words').state, 'flag'); assert.equal(shade.facts.suggestions, 0);

 // The CLI reaches the same reads.
 // Asynchronously: the server answers from this same process.
 const cli = args => new Promise(resolve => execFile(process.execPath, ['agents/cli/ar-create.mjs', '--url', base, '--actor', 'agent:claude-code', ...args], {encoding: 'utf8', maxBuffer: 1 << 24}, (error, stdout, stderr) => resolve({status: error ? error.code : 0, stdout, stderr})));
 const one = await cli(['standing', 'subject', 'demo-the-first-cup']);
 assert.equal(one.status, 0, one.stderr); assert.equal(JSON.parse(one.stdout).next.step, 'check');
 const every = await cli(['standing', 'all']);
 assert.equal(every.status, 0, every.stderr); assert.equal(JSON.parse(every.stdout).count, (await get('/api/subjects/standing')).count);
});

// A read that fails, and a subject long untouched, with stand-in owners holding invented records.
test('a failed read is Not known and never nothing; a subject untouched for months rests', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standing-')), B = '0b5e3a3c-1f1e-4c7a-9f00-000000000001';
 // Its writing place lists one piece in the output index, so the output owner is asked (and, in the first case, fails).
 const P = '0b5e3a3c-1f1e-4c7a-9f00-000000000002', D = '0b5e3a3c-1f1e-4c7a-9f00-000000000003', sha = v => crypto.createHash('sha256').update(v).digest('hex');
 fs.mkdirSync(path.join(dir, 'study-owned-photo-bindings')); fs.writeFileSync(path.join(dir, 'study-owned-photo-bindings', B + '.json'), JSON.stringify({bindingId: B, parentStudyId: 'invented', projectId: P, documentId: D}));
 fs.mkdirSync(path.join(dir, 'articles', sha(P), sha(D)), {recursive: true}); fs.writeFileSync(path.join(dir, 'articles', sha(P), sha(D), 'article.json'), JSON.stringify({project: {document: {nativeOutputIndex: {records: [{outputId: 'o1'}]}}}}));
 const owners = (outputs, modifiedAt) => createSubjectStanding({dataDir: dir, now: () => Date.parse('2026-11-11T12:00:00Z'),
  drafts: {catalog: async () => ({collections: [{parentStudyId: 'invented', title: 'Invented', bindingId: B}], outputBindings: [{parentStudyId: 'invented', bindingId: B}], drafts: []}), read: async () => ({projection: [{words: 'Invented words.'}], expected: {v: 1}, history: [{modifiedAt}]})},
  outputs: {read: outputs}, checks: {read: async () => null}, consentDesk: {read: async () => ({people: [], release: {}})},
  library: {tree: async () => ({sources: []})}, simmer: {boards: {read: async () => ({groups: [], forming: {}})}},
  instagram: {plans: async () => ({plans: []}), read: async () => null}, places: {read: async () => ({places: []})}});
 try {
  const broken = await owners(async () => {throw new Error('invented failure');}, '2026-11-10T00:00:00Z').one({parentStudyId: 'invented'});
  assert.equal(broken.facts.pieces, null); assert.equal(broken.steps.find(x => x.id === 'form').state, 'unknown');
  assert.equal(broken.next, null); assert.equal(broken.known, false);
  assert.ok(!JSON.stringify(broken).includes('No Article or Carousel yet'));
  const idle = await owners(async () => ({outputs: [{id: 'o1', kind: 'article', placements: [], createdAt: '2026-01-01T00:00:00Z'}]}), '2026-01-02T00:00:00Z').all();
  assert.equal(idle.subjects[0].station, 'resting'); assert.equal(idle.subjects[0].resting, 'untouched');
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
