// Magazine stories in the standing reads: each registered, active story that is nobody's original is a subject of its
// own (id = the story id), answers in the same shape, shows the Magazine's own words, and reading writes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from '../runtime/server.mjs';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';

const AGENT = {'X-AR-Actor': 'agent:claude-code', 'X-AR-Client': 'http'};
const DRAFT = 'Workflow/3-Develop/DEV - Clay Teacher (story).md', SOURCE = 'Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md';

async function home(t, {original = false, originalPath = DRAFT, originalsRoot = null, archive = ['UI-flow-part-01'], extra = {}} = {}) {
 const f = buildMagazineFixture({extra}); t.after(f.cleanup);
 const plan = planRegistration({vault: f.vault, files: f.files, archived: archive});
 fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
 fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name, number: p.number, archived: p.archived}))}));
 for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
 const drafts = original ? {clay: {parentStudyKey: 'clay-subject', partKey: 'article', title: 'Clay original', path: originalPath, support: [[SOURCE, 'source']]}} : {};
 const server = await createServer({dataDir: f.data, publicDir: path.resolve('public'), researchEnabled: false, studyOriginalRoots: {vaultRoot: originalsRoot ? originalsRoot(f) : f.vault, filesRoot: f.files, catalog: {projects: {}, drafts}}, magazineVault: {vaultRoot: f.vault, filesRoot: f.files, writable: true}});
 await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => {server.closeAllConnections?.(); server.close(r);}));
 const base = 'http://127.0.0.1:' + server.address().port;
 const get = async p => {const r = await fetch(base + p, {headers: AGENT}); return {status: r.status, value: await r.json()};};
 return {f, get, base};
}
const keep = tree => Object.fromEntries(Object.entries(tree).filter(([n]) => !n.startsWith('journal/')));

test('registered Magazine stories are subjects beside the others, with the story\'s own title and words', {timeout: 120000}, async t => {
 const h = await home(t);
 const all = (await h.get('/api/subjects/standing')).value, ids = all.subjects.map(s => s.id);
 assert.deepEqual(ids.sort(), ['mag-clay-teacher', 'mag-river-potter']);
 for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, 'safe in an address');
 const row = all.subjects.find(s => s.id === 'mag-clay-teacher');
 assert.equal(row.title, 'The Fire Was Kind');
 assert.equal(row.origin.kind, 'magazine');
 assert.equal(row.forms.length, 1);
 assert.equal(row.forms[0].name, 'Article');
 assert.deepEqual(row.forms[0].owner, {kind: 'magazine', storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article'});

 const one = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value, steps = Object.fromEntries(one.forms[0].steps.map(s => [s.id, s]));
 assert.equal(one.title, 'The Fire Was Kind');
 assert.equal(steps.words.state, 'done'); assert.match(steps.words.note, /^\d+ words?$/);
 assert.ok(one.facts.words.count > 20, 'the words are the draft\'s own');
 assert.equal(steps.have.state, 'done'); assert.match(steps.have.note, /notes?/);
 assert.equal(steps.have.note, '2 notes · 1 photograph'); assert.equal(steps.photos.note, 'None placed yet');
 assert.equal(steps.check.state, 'unknown', 'a CHECK file holds free notes the rule cannot read');
 assert.equal(steps.facts.state, 'todo', 'no research file: known not to be looked into');
 assert.equal(steps.dish.state, 'todo'); assert.match(steps.dish.note, /direction is written; the dish is not named yet/); assert.equal(one.facts.dish.text, '', 'the picked option is not passed on as his words');
 assert.equal(steps.publish.state, 'unknown', 'the Check is not known, so neither is whether it can go out');
 assert.equal(one.next, null, 'no next step is claimed past a step that is not known');
 assert.equal(one.published, false, 'the draft carries no published link');
 assert.equal(one.facts.check, null);

 // The second story: a source and a map, no draft yet. Its Article is empty and known to be.
 const river = (await h.get('/api/subject/standing?parentStudyId=mag-river-potter')).value, rs = Object.fromEntries(river.forms[0].steps.map(s => [s.id, s]));
 assert.equal(river.title, 'River Potter');
 assert.equal(rs.words.state, 'todo'); assert.equal(rs.words.note, 'Not started'); assert.equal(rs.dish.note, 'Not named yet');
 assert.equal(rs.check.state, 'wait'); assert.equal(rs.photos.state, 'wait');
 assert.equal(rs.dish.state === 'done', false, 'no direction was picked'); assert.equal(river.facts.dish.direction, false);
 assert.equal((await h.get('/api/subject/standing?parentStudyId=mag-nobody')).status, 404);
});

test('a story that is already a subject\'s original shows once, as that subject; archived stories do not show', {timeout: 120000}, async t => {
 const h = await home(t, {original: true});
 const ids = (await h.get('/api/subjects/standing')).value.subjects.map(s => s.id);
 assert.ok(!ids.includes('mag-clay-teacher'), 'Clay Teacher is the original of clay-subject');
 assert.ok(ids.includes('clay-subject') && ids.includes('mag-river-potter'));
 const archived = await home(t, {archive: ['UI-flow-part-01', 'River Potter']});
 assert.deepEqual((await archived.get('/api/subjects/standing')).value.subjects.map(s => s.id), ['mag-clay-teacher']);
});

test('reading the standing writes nothing, in the data folder or the vault, and a change to the draft shows on the next read', {timeout: 120000}, async t => {
 const h = await home(t);
 await h.get('/api/subjects/standing'); // settle anything a first read creates (caches live in memory only)
 const data = keep(treeHashes(h.f.data)), vault = treeHashes(h.f.vault);
 for (let i = 0; i < 3; i++) {await h.get('/api/subjects/standing'); await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher'); await h.get('/api/subject/standing?parentStudyId=mag-river-potter');}
 assert.deepEqual(keep(treeHashes(h.f.data)), data, 'nothing written in the data folder');
 assert.deepEqual(treeHashes(h.f.vault), vault, 'nothing written in the vault');
 const before = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value.facts.words.count;
 fs.appendFileSync(path.join(h.f.vault, DRAFT), '\nAn invented paragraph added outside the app, with several more words in it.\n');
 const after = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value.facts.words.count;
 assert.ok(after > before, 'the words are read again after the draft changed');
});

test('a Magazine story with a published link and a photograph marker says so', {timeout: 120000}, async t => {
 const h = await home(t);
 fs.rmSync(path.join(h.f.vault, 'Workflow/4-Review/CHECK - Clay Teacher (story, round 1).md'));
 const text = fs.readFileSync(path.join(h.f.vault, DRAFT), 'utf8');
 fs.writeFileSync(path.join(h.f.vault, DRAFT), text.replace('updated: 2026-10-10', 'updated: 2026-10-10\npublished: https://teajia.com/fire').replace('==She waits', '%%photo: kiln.jpg%%\n\n==She waits'));
 const one = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value, steps = Object.fromEntries(one.forms[0].steps.map(s => [s.id, s]));
 assert.equal(one.published, true); assert.equal(one.station, 'published');
 assert.equal(steps.publish.state, 'done');
 assert.equal(steps.photos.state, 'done'); assert.match(steps.photos.note, /1 placed/);
});

test('a proposal waiting on the draft\'s current words is a suggestion waiting; one on older words is not', {timeout: 120000}, async t => {
 const h = await home(t), headers = {...AGENT, 'Content-Type': 'application/json'};
 const read = async () => (await h.get('/api/magazine/read?path=' + encodeURIComponent(DRAFT))).value;
 const steps = async () => (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value;
 const draft = await read();
 const made = await fetch(h.base + '/api/magazine/write', {method: 'POST', headers, body: JSON.stringify({path: DRAFT, content: draft.text + '\nAn invented proposed line.\n', expectedHash: draft.hash, operationId: crypto.randomUUID()})});
 assert.equal(made.status, 200); assert.equal((await made.json()).proposed, true);
 let one = await steps(), words = one.forms[0].steps.find(x => x.id === 'words');
 assert.equal(one.facts.suggestions, 1); assert.equal(words.state, 'flag'); assert.equal(words.note, '1 suggestion waiting');
 assert.equal(one.next.step, 'words');
 fs.appendFileSync(path.join(h.f.vault, DRAFT), '\nAn invented outside change makes the proposal stale.\n');
 one = await steps(); assert.equal(one.facts.suggestions, 0, 'a proposal made on older words is no longer offered');
});

test('the invented demo Magazine gives a filled demo three stories, two with words', {timeout: 120000}, async t => {
 const {syntheticHome} = await import('../scripts/demo.mjs'), {addMagazineToSyntheticHome} = await import('../scripts/demo-magazine.mjs');
 const fixture = syntheticHome(); t.after(() => fs.rmSync(fixture.dir, {recursive: true, force: true}));
 await addMagazineToSyntheticHome(fixture);
 const config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const server = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, researchEnabled: false, packageView: {syntheticFixtures: true}});
 await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => {server.closeAllConnections?.(); server.close(r);}));
 const all = await (await fetch('http://127.0.0.1:' + server.address().port + '/api/subjects/standing', {headers: AGENT})).json();
 const stories = all.subjects.filter(s => s.origin?.kind === 'magazine');
 assert.deepEqual(stories.map(s => s.title).sort(), ['Bamboo Carver', 'The Loom Beside the Water', 'Where the Ash Settles']);
 assert.equal(all.subjects.length, 2 + 3, 'the two ordinary subjects stand beside them');
});

test('an original in a differently configured root, or an older round of the story, is still that story\'s subject', {timeout: 120000}, async t => {
 // The originals root is the folder above the Magazine, so the original's path starts with "Magazine/".
 const whole = await home(t, {original: true, originalsRoot: f => path.dirname(f.vault), originalPath: 'Magazine/' + DRAFT});
 const w = await whole.get('/api/subjects/standing'); assert.equal(w.status, 200, JSON.stringify(w.value)); let ids = w.value.subjects.map(s => s.id);
 assert.ok(ids.includes('clay-subject') && !ids.includes('mag-clay-teacher'), 'shown once, as the subject: ' + ids);
 // The original names another round of the story, not the one the Magazine now registers.
 const round = 'Workflow/3-Develop/DEV - Clay Teacher (updated).md';
 const older = await home(t, {original: true, originalPath: round, extra: {[round]: '---\ntype: DEV\nstory: Clay Teacher\ntitle: "Older"\n---\n\nAn invented older round.\n'}});
 const o = await older.get('/api/subjects/standing'); assert.equal(o.status, 200, JSON.stringify(o.value)); ids = o.value.subjects.map(s => s.id);
 assert.ok(!ids.includes('mag-clay-teacher') && ids.includes('mag-river-potter'), 'any round of the story is that story: ' + ids);
});

test('the newest decision counts, only a live teajia.com link is published, and a board sentence is his own', {timeout: 120000}, async t => {
 const h = await home(t), map = 'Workflow/2-Guidance/MAP - River Potter.md', file = p => path.join(h.f.vault, p);
 const dish = async id => (await h.get('/api/subject/standing?parentStudyId=' + id)).value;
 fs.appendFileSync(file(map), '- 2026-10-13: Direction: First idea (picked on the magazine page)\n- 2026-10-15: Direction: Changed my mind (picked on the magazine page)\n');
 let r = await dish('mag-river-potter');
 assert.equal(r.facts.dish.direction, true); assert.equal(r.facts.dish.named, false); assert.equal(r.facts.dish.text, '');
 assert.ok(!JSON.stringify(r).includes('Changed my mind') && !JSON.stringify(r).includes('First idea'), 'the option text is never passed on');
 fs.rmSync(file('Workflow/4-Review/CHECK - Clay Teacher (story, round 1).md'));
 const text = fs.readFileSync(file(DRAFT), 'utf8');
 for (const [value, out] of [['false', false], ['https://example.com/x', false], ['https://teajia.com/fire-was-kind', true]]) {
  fs.writeFileSync(file(DRAFT), text.replace('updated: 2026-10-10', 'updated: 2026-10-10\npublished: ' + value));
  assert.equal((await dish('mag-clay-teacher')).published, out, 'published: ' + value);
 }
});

test('the quick word count equals the working draft\'s own count', {timeout: 120000}, async t => {
 const h = await home(t), native = await import('../runtime/services/draft-correspondence.mjs');
 const text = fs.readFileSync(path.join(h.f.vault, DRAFT), 'utf8') + '\nA plain line, with "quotes" and an apostrophe\'s.\n\n## A heading\n\nShe waits ==before== she shapes %%note%% anything.\n\n> A quote line.\n\nSee [[term:clay|the clay]] here.\n';
 fs.writeFileSync(path.join(h.f.vault, DRAFT), text);
 const rows = native.projection(native.capture(text, 'mag-clay-teacher:article')).filter(r => String(r.words || '').trim());
 const want = rows.reduce((n, r) => n + r.words.trim().split(/\s+/).length, 0);
 const got = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value.facts.words;
 assert.equal(got.count, want); assert.equal(got.paragraphs, rows.filter(r => r.blockKind !== 'heading').length);
});
