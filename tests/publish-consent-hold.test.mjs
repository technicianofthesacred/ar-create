// Every way out of AR Create (publish, mark published, export for posting, ready to post) asks the consent desk's one hold
// check first. While anyone on the piece is unanswered the path refuses in plain English, naming who and linking to the desk
// (HTTP 423, CLI exit 4). Adrian's answer, or his override with a reason, lets it through again. Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto, {randomUUID, createHash} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createConsentDesk, releaseState, blockerWords} from '../runtime/services/consent-desk.mjs';
import {createInstagramStudio, handleInstagram} from '../runtime/services/instagram-studio.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {EXIT} from '../agents/lib/client.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {magazineServer} from './helpers/magazine-server.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';

const ADRIAN = 'human:adrian', AGENT = 'agent:claude-code';
const repo = path.resolve(import.meta.dirname, '..');
const sha = s => createHash('sha256').update(s).digest('hex');

/** The consent desk as an agent and Adrian use it: the same commands, over the CLI. */
function desk(cli, scope) {
  const read = async () => { const r = await cli(['call', 'consent.desk'], scope); assert.equal(r.exitCode, 0, JSON.stringify(r.result)); return r.result; };
  const write = async (name, body, actor = AGENT) => { const d = await read(); return cli(['call', name], {...scope, operationId: randomUUID(), expectedRevision: d.revision, expectedHash: d.hash, ...body}, actor); };
  const ok = async (name, body, actor) => { const r = await write(name, body, actor); assert.equal(r.exitCode, 0, name + ' ' + JSON.stringify(r.result)); return r.result; };
  return {
    read, write, ok,
    async addPerson(name, appears = ['named']) { const d = await ok('consent.people.record', {person: {name, appears}}); return d.people.find(p => p.name === name).id; },
    answer: (personId, state) => ok('consent.people.answer', {personId, state}, ADRIAN),
    override: reason => ok('consent.share.override', {reason}, ADRIAN),
  };
}
/** What a refused publish path says: 423 over HTTP, exit 4 and a plain reason over the CLI. */
function assertHeld(r, {who, scope}) {
  assert.equal(r.exitCode, EXIT.locked, JSON.stringify(r.result));
  assert.equal(r.result.error, 'consent_hold');
  const text = r.result.details.error;
  assert.match(text, /on hold for consent/i);
  for (const name of who) assert.match(text, new RegExp(name));
  assert.ok(text.includes('/document-study/index.html#consent=' + encodeURIComponent(scope.parentStudyId)), 'links to the consent desk: ' + text);
  assert.equal(r.result.details.code, 'consent-hold');
  assert.equal(r.result.details.hold.held, true);
  assert.ok(!/—/.test(text), 'no em dashes in what a person reads');
}

test('the one hold check names who is unanswered, in plain English, and reads the same record the desk shows', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hold-unit-'));
  const consent = createConsentDesk({dataDir: dir});
  assert.equal(consent.holdFor([{parentStudyId: 'nobody-listed'}]), null, 'a piece with no record is not held');
  assert.equal(consent.holdFor([{parentStudyId: undefined}, null]), null, 'a path with no project is not held');
  assert.equal(blockerWords({name: 'Maya', reason: 'not asked yet'}), 'Maya has not been asked yet');
  assert.equal(blockerWords({name: 'Maya', reason: 'asked, no answer yet'}), 'Maya has not answered yet');
  assert.equal(blockerWords({name: 'Tom', reason: 'said no'}), 'Tom said no');
  assert.equal(blockerWords({name: 'Tom', reason: 'now named and pictured since answering'}), 'Tom agreed before they also appeared as named and pictured');
  const state = releaseState({parentStudyId: 'p', pieceKey: 'main', revision: 0, claims: [], share: {comfort: null, accuracy: null, override: null, release: null},
    people: [{id: 'a', name: 'Maya', appears: ['named'], consent: {state: 'not-asked'}}, {id: 'b', name: 'Tom', appears: ['quoted'], consent: {state: 'asked'}}, {id: 'c', name: 'Ines', appears: ['named'], consent: {state: 'yes', appearsAtAnswer: ['named']}}]});
  assert.equal(state.publishHold.held, true);
  assert.equal(state.publishHold.summary, 'Maya has not been asked yet and Tom has not answered yet.');
  assert.deepEqual(state.publishHold.who.map(w => w.name), ['Maya', 'Tom']);
  assert.equal(state.publishHold.link, '/document-study/index.html#consent=p');
});

test('Outputs: exporting, and downloading an export, refuse while a person is unanswered; consent or Adrian\'s override lets them through', async t => {
  // A real article output over HTTP (the same fixture the Outputs export test uses), then the consent desk for its project.
  const dataDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hold-outputs-')));
  const vault = path.join(dataDir, 'original-vault'), files = path.join(dataDir, 'original-files'); fs.mkdirSync(vault); fs.mkdirSync(files);
  const originals = [['Workflow/3-Develop/DEV - An Cha 1 (story).md', '---\ntype: DEV\ntitle: Synthetic HTTP\n---\n\nExact original words.\n'], ['Workflow/1-Source/SRC - An Cha Master (Dark Tea & Organic Farming).md', 'Synthetic source, not a private fixture.']];
  for (const [rel, body] of originals) { const file = path.join(vault, rel); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, body); }
  const server = await createServer({dataDir, publicDir: path.join(dataDir, 'public'), studyOriginalRoots: {vaultRoot: vault, filesRoot: files, catalog: {projects: {}, drafts: {'ancha-1': {parentStudyKey: 'ref-an-cha', partKey: '1', title: 'Synthetic HTTP', path: originals[0][0], contextScope: 'Invented HTTP fixture only.', support: [[originals[1][0], 'source']]}}}}, sharedArticles: true, researchEnabled: false});
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(async () => { await new Promise(r => server.close(r)); fs.rmSync(dataDir, {recursive: true, force: true}); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = async route => { const r = await fetch(base + route); return {status: r.status, value: await r.json().catch(() => ({}))}; };
  const post = async (route, input) => { const r = await fetch(base + route, {method: 'POST', headers: {Origin: base, 'Content-Type': 'application/json'}, body: JSON.stringify(input)}); return {status: r.status, value: await r.json().catch(() => ({}))}; };
  const okPost = async (route, input) => { const r = await post(route, input); assert.equal(r.status, 200, JSON.stringify(r.value)); return r.value; };
  const row = {originalId: 'ancha-1', originalHash: sha(originals[0][1])};
  const native = await okPost('/api/study-draft/open', {...row, parentStudyId: 'ref-an-cha', operationId: randomUUID()});
  await okPost('/api/first-flow/select', {projectKey: 'ref-an-cha', title: 'Synthetic parent', operationId: randomUUID()});
  await okPost('/api/study/photos/select', {bindingId: native.binding.id, parentStudyId: 'ref-an-cha', operationId: randomUUID()});
  const group = {rootBindingId: native.binding.id, parentStudyId: 'ref-an-cha'};
  const empty = (await get('/api/study/outputs?' + new URLSearchParams(group))).value;
  const created = await okPost('/api/study/outputs/create', {...group, kind: 'article', sourceBindingId: native.binding.id, expectedNative: native.expected, expectedOutput: empty.expectedOutput, operationId: randomUUID()});
  const selected = (await get('/api/study/outputs?' + new URLSearchParams({...group, selectedOutputId: created.view.output.id}))).value;
  const exportBody = name => ({...group, kind: 'article', selectedOutputId: selected.output.id, expectedOutput: selected.expectedOutput, expectedNative: selected.writingProof.expected, manuscriptRevision: selected.output.manuscriptRevision, name, mimeType: 'text/markdown', body: 'Exact original words.\n'});

  const cli = async (args, input, actor = AGENT) => run(['--url', base, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
  const scope = {parentStudyId: 'ref-an-cha', pieceKey: 'main'}, d = desk(cli, scope);
  const maya = await d.addPerson('Maya', ['pictured']);

  // Held: the export is refused before anything is saved, as an agent over the CLI and as the page over HTTP.
  const refused = await cli(['call', 'study.outputs.export'], exportBody('held.md'));
  assertHeld(refused, {who: ['Maya has not been asked yet'], scope});
  const page = await post('/api/study/outputs/export', exportBody('held.md'));
  assert.equal(page.status, 423); assert.equal(page.value.code, 'consent-hold'); assert.match(page.value.error, /Maya has not been asked yet/);
  assert.equal((await get('/api/study/outputs/exports?' + new URLSearchParams({...group, selectedOutputId: selected.output.id}))).value.exports.length, 0, 'nothing was saved while held');

  // Adrian records Maya's yes: the export goes through.
  await d.answer(maya, 'yes');
  const saved = await post('/api/study/outputs/export', exportBody('synthetic.md'));
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const fileUrl = (saved.value.artifact?.url || saved.value.export?.files?.[0]?.url || saved.value.exports?.[0]?.files?.[0]?.url);
  assert.ok(fileUrl, 'the saved export has a file link: ' + JSON.stringify(saved.value).slice(0, 300));
  assert.equal((await fetch(base + fileUrl)).status, 200, 'the file downloads while nothing holds it');

  // A new person appears: the same file is held again for download, and a second export is refused.
  await d.addPerson('Tom', ['quoted']);
  const download = await fetch(base + fileUrl);
  assert.equal(download.status, 423); const downloadBody = await download.json(); assert.match(downloadBody.error, /Tom has not been asked yet/); assert.match(downloadBody.error, /Downloading this export/);
  assert.equal((await post('/api/study/outputs/export', exportBody('second.md'))).status, 423);

  // Adrian overrides, with his reason: both go through. The reason is on the desk's journal.
  await d.override('Tom has said yes by phone and I am recording it on Friday.');
  assert.equal((await fetch(base + fileUrl)).status, 200);
  assert.equal((await post('/api/study/outputs/export', exportBody('second.md'))).status, 200);
  assert.match(JSON.stringify((await d.read()).journal), /Tom has said yes by phone/);
});

test('Outputs: the older workspace export routes are held by the workspace project', async t => {
  const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
  const server = await createServer({dataDir: config.dataDir, publicDir: path.join(repo, 'public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false});
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(async () => { await new Promise(r => server.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const cli = async (args, input, actor = AGENT) => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
  const projectId = (await (await fetch(url + '/api/state')).json()).project.id;
  const scope = {parentStudyId: projectId, pieceKey: 'main'}, d = desk(cli, scope);
  const maya = await d.addPerson('Maya');
  for (const [name, route] of [['exports', '/api/exports'], ['carousel.exports', '/api/carousel/exports']]) {
    const command = (await (await fetch(url + '/api/capabilities')).json()).commands.find(c => c.route === route && c.method === 'POST');
    assert.ok(command, route + ' is a registered command');
    const held = await cli(['call', command.name], {});
    assertHeld(held, {who: ['Maya'], scope});
  }
  await d.answer(maya, 'yes');
  for (const route of ['/api/exports', '/api/carousel/exports']) {
    const r = await fetch(url + route, {method: 'POST', headers: {Origin: url, 'Content-Type': 'application/json', 'X-AR-Actor': AGENT}, body: '{}'});
    assert.notEqual(r.status, 423, route + ' is no longer held (the service then judges the empty request on its own terms)');
  }
});

test('Magazine: Adrian\'s publish yes (magazine.send) refuses while a person is unanswered and works after their consent', async t => {
  const m = await magazineServer(t), DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
  const scope = {parentStudyId: 'mag-clay-teacher', pieceKey: 'main'}, d = desk(m.cli, scope), maya = await d.addPerson('Maya', ['named', 'quoted']);
  const send = () => m.cli(['call', 'magazine.send'], {path: DEV, piece: 'clay-teacher', expectedHash: m.hashOf(DEV), operationId: randomUUID()}, ADRIAN);
  assertHeld(await send(), {who: ['Maya has not been asked yet'], scope});
  assert.equal((await m.cli(['call', 'magazine.send.approval'], {path: DEV})).result.hold.summary, 'Maya has not been asked yet.', 'the approval read says it too');
  await d.ok('consent.people.sent', {personId: maya, sentAt: '2026-11-03', channel: 'WeChat'}, ADRIAN);
  assert.match((await send()).result.details.error, /Maya has not answered yet/);
  await d.answer(maya, 'yes');
  const sent = await send(); assert.equal(sent.exitCode, 0, JSON.stringify(sent.result)); assert.equal(sent.result.approved, true);
});

test('Magazine: marking a draft published refuses while held and works after Adrian\'s override', async t => {
  const m = await magazineServer(t), DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
  const scope = {parentStudyId: 'mag-clay-teacher', pieceKey: 'main'}, d = desk(m.cli, scope);
  // His publish yes came first, while nobody was listed.
  const hash = m.hashOf(DEV), approved = await m.cli(['call', 'magazine.send'], {path: DEV, piece: 'clay-teacher', expectedHash: hash, operationId: randomUUID()}, ADRIAN);
  assert.equal(approved.exitCode, 0, JSON.stringify(approved.result));
  await d.addPerson('Maya'); await d.addPerson('Tom', ['pictured']);
  const mark = () => m.cli(['call', 'magazine.mark-published'], {path: DEV, link: 'https://teajia.com/read/clay-teacher', expectedHash: hash, operationId: randomUUID()}, ADRIAN);
  const held = await mark(); assertHeld(held, {who: ['Maya has not been asked yet', 'Tom has not been asked yet'], scope});
  assert.equal(m.hashOf(DEV), hash, 'the draft was not touched');
  await d.override('Both said yes in the interview itself; the recording is the record.');
  const done = await mark(); assert.equal(done.exitCode, 0, JSON.stringify(done.result));
  assert.match(fs.readFileSync(path.join(m.f.vault, DEV), 'utf8'), /published: https:\/\/teajia\.com\/read\/clay-teacher/);
  // A person added after the override holds it again: the override covered only who was listed.
  await d.addPerson('Ines');
  assertHeld(await mark(), {who: ['Ines has not been asked yet'], scope});
});

test('Magazine: saving the approved slides for posting is held through the story the made file belongs to', async t => {
  const m = await magazineServer(t), MADE = 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire.md';
  // Register the story as the live app does, so the made file resolves to the story id the desk is keyed by.
  const plan = planRegistration({vault: m.f.vault, files: m.f.files}); fs.mkdirSync(path.join(m.f.data, 'magazine/projects'), {recursive: true});
  fs.writeFileSync(path.join(m.f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: m.f.vault, filesRoot: m.f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(m.f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  const scope = {parentStudyId: 'mag-clay-teacher', pieceKey: 'main'}, d = desk(m.cli, scope), maya = await d.addPerson('Maya', ['pictured']);
  const staging = path.join(m.f.dir, 'staging', 'fire'); fs.mkdirSync(staging, {recursive: true});
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');
  fs.writeFileSync(path.join(staging, 'slide-01.png'), png);
  const save = () => m.cli(['call', 'magazine.export.save'], {path: MADE, staged: 'fire', files: [{name: 'slide-01.png', sha256: sha(png)}], caption: 'The fire.', operationId: randomUUID()}, ADRIAN);
  assertHeld(await save(), {who: ['Maya has not been asked yet'], scope});
  assert.ok(!fs.existsSync(path.join(m.f.vault, 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire/slide-01.png')), 'no slide was written while held');
  await d.answer(maya, 'yes');
  const saved = await save(); assert.equal(saved.exitCode, 0, JSON.stringify(saved.result)); assert.equal(saved.result.saved ?? saved.result.result?.saved, 1);
});

test('Magazine: the article\'s HTML export and its download are held by the story', async t => {
  const m = await magazineServer(t), DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
  const plan = planRegistration({vault: m.f.vault, files: m.f.files}); fs.mkdirSync(path.join(m.f.data, 'magazine/projects'), {recursive: true});
  fs.writeFileSync(path.join(m.f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: m.f.vault, filesRoot: m.f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(m.f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  const scope = {parentStudyId: 'mag-clay-teacher', pieceKey: 'main'}, d = desk(m.cli, scope), maya = await d.addPerson('Maya');
  const payload = {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', expectedHash: m.hashOf(DEV), renderRevision: 'a'.repeat(64), name: 'invented.html', body: '<!doctype html><html><p>Invented.</p></html>'};
  const send = (extra = {}) => fetch(m.url + '/api/magazine/working-draft/export', {method: 'POST', headers: {'content-type': 'application/json', origin: m.url, 'x-ar-actor': ADRIAN}, body: JSON.stringify({...payload, ...extra})});
  const held = await send(); assert.equal(held.status, 423); assert.match((await held.json()).error, /Maya has not been asked yet/);
  // The page also names its own project; that desk holds the export as well.
  const pageScope = {parentStudyId: 'page-project-1', pieceKey: 'main'}, pageDesk = desk(m.cli, pageScope); await pageDesk.addPerson('Tom', ['quoted']);
  await d.answer(maya, 'yes');
  const heldByPage = await send({parentStudyId: 'page-project-1'}); assert.equal(heldByPage.status, 423); assert.match((await heldByPage.json()).error, /Tom has not been asked yet/);
  const exported = await send(); assert.equal(exported.status, 200, await exported.clone().text());
  const {artifact} = await exported.json();
  assert.equal((await fetch(m.url + artifact.url)).status, 200);
  await d.addPerson('Ines');
  const download = await fetch(m.url + artifact.url); assert.equal(download.status, 423); assert.match((await download.json()).error, /Downloading this export is on hold/);
});

// ---- Instagram studio: ready to post, and the files that get posted
const T_ID = '11111111-2222-4333-8444-555555555555', TRANSCRIPT = 'Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.\n\nMender: When I sit with one bowl for a whole day, my own day gets quieter.\n';
const T_HASH = sha(TRANSCRIPT), PHOTO = '21111111-2222-4333-8444-555555555555';
const library = {snapshot: async (id, {includeBody} = {}) => id === T_ID ? {id, hash: T_HASH, path: '/x/talk.md', text: includeBody ? TRANSCRIPT : undefined} : {id, hash: 'b'.repeat(64), path: '/x/photo.jpg'}};
const as = (actor, fn) => withActor({actor, client: 'http'}, fn);
async function instagramPlan(dataDir, studio, subject) {
  const created = await as(AGENT, () => studio.propose({operationId: randomUUID(), subject, title: 'The mender', door: 'art', material: {transcripts: [{sourceId: T_ID, sourceHash: T_HASH}], photos: [{sourceId: PHOTO, caption: 'The mended bowl'}]}}));
  const id = line => created.lines.find(l => l.text.startsWith(line)).id;
  const story = {title: 'Every crack is a record', readback: 'Cracks record the hands that used the bowl.', dish: 'A post about marks of use.', why: 'The strongest line.', reader: 'Anyone who mends', format: 'post', spine: [id('I think every crack')], matches: [{photoId: created.material.photos[0].id, lineId: id('I think every crack'), why: 'The bowl.'}]};
  const planned = await as(AGENT, () => studio.propose({id: created.id, operationId: randomUUID(), expectedRevision: created.revision, expectedHash: created.hash, stories: [story]}));
  const chosen = await as(ADRIAN, () => studio.choose({id: planned.id, operationId: randomUUID(), expectedRevision: planned.revision, expectedHash: planned.hash, storyId: planned.stories[0].id, forWhom: 'friends'}));
  const laid = await as(AGENT, () => studio.layout({id: chosen.id, operationId: randomUUID(), expectedRevision: chosen.revision, expectedHash: chosen.hash, storyId: chosen.stories[0].id, format: 'post'}));
  return laid;
}

test('Instagram studio: Ready to post, the frame PNGs and the reel words refuse while held, and the plan says why', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hold-ig-'));
  const consent = createConsentDesk({dataDir, library}), studio = createInstagramStudio({dataDir, library, consentDesk: consent});
  const subject = 'proj-ig-1', scope = {parentStudyId: subject, pieceKey: 'main'};
  let plan = await instagramPlan(dataDir, studio, subject);
  assert.equal(plan.publishHold, null, 'nothing listed, nothing held');
  // Maya is listed and has not been asked.
  const rec = (name, body, actor = AGENT) => as(actor, async () => { const d = await consent.read(scope); return consent[name]({...scope, operationId: randomUUID(), expectedRevision: d.revision, expectedHash: d.hash, ...body}); });
  let state = await rec('recordPerson', {person: {name: 'Maya', appears: ['pictured']}});
  const maya = state.people[0].id;
  plan = await as(ADRIAN, () => studio.read({id: plan.id}));
  assert.equal(plan.publishHold.held, true); assert.equal(plan.publishHold.summary, 'Maya has not been asked yet.'); assert.equal(plan.publishHold.link, '/document-study/index.html#consent=proj-ig-1');
  const ready = () => as(ADRIAN, () => studio.ready({id: plan.id, operationId: randomUUID(), expectedRevision: plan.revision, expectedHash: plan.hash, format: 'post'}));
  await assert.rejects(ready(), e => e.status === 423 && /Marking this ready to post is on hold for consent\. Maya has not been asked yet\./.test(e.message) && e.hold?.held === true);
  await assert.rejects(as(AGENT, () => studio.assertPostable({id: plan.id}, 'Saving this frame for posting')), e => e.status === 423);
  // The page asks over HTTP; a stand-in request and response show the status and body it gets.
  const http = async (pathAndQuery, method = 'GET') => { const out = {}; const request = {url: pathAndQuery, method, headers: {}, socket: {}}, response = {writeHead(status, headers) { out.status = status; out.headers = headers; }, end(body) { out.body = body; }};
    await withActor({actor: AGENT, client: 'http'}, () => handleInstagram(request, response, {dataDir, library, consentDesk: consent})); return out; };
  const png = await http('/api/instagram/png?id=' + plan.id + '&format=post&frame=0');
  assert.equal(png.status, 423); assert.equal(JSON.parse(png.body).code, 'consent-hold'); assert.match(JSON.parse(png.body).error, /Maya has not been asked yet/);
  // Adrian answers: the yes is recorded.
  await rec('answer', {personId: maya, state: 'yes'}, ADRIAN);
  plan = await as(ADRIAN, () => studio.read({id: plan.id}));
  assert.equal(plan.publishHold, null);
  const done = await ready(); assert.equal(done.ready.post.posted, false); assert.equal(done.ready.post.by, ADRIAN);
  // Someone new holds the files again; the override lets the reel words and frames through, with Adrian's reason.
  await rec('recordPerson', {person: {name: 'Tom', appears: ['quoted']}});
  plan = await as(ADRIAN, () => studio.read({id: plan.id}));
  assert.equal(plan.publishHold.held, true); assert.ok(plan.ready.post, 'his earlier yes is kept, and shown as held again');
  await assert.rejects(as(AGENT, () => studio.assertPostable({id: plan.id}, 'Saving the on-screen words for posting')), e => e.status === 423);
  await rec('override', {reason: 'Tom is my brother and said yes at the table.'}, ADRIAN);
  await as(AGENT, () => studio.assertPostable({id: plan.id}, 'Saving the on-screen words for posting'));
  assert.equal((await as(ADRIAN, () => studio.read({id: plan.id}))).publishHold, null);
});

test('Instagram studio: a plan with no named project finds its desk through its own sources, or refuses Ready to post until it is linked', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hold-ig-free-'));
  const consent = createConsentDesk({dataDir, library}), studio = createInstagramStudio({dataDir, library, consentDesk: consent});
  const UNLINKED = 'Link this to a piece first so consent can be checked.';
  let plan = await instagramPlan(dataDir, studio, '');
  assert.equal(plan.subject, '');
  assert.deepEqual({held: plan.publishHold.held, unlinked: plan.publishHold.unlinked, summary: plan.publishHold.summary}, {held: true, unlinked: true, summary: UNLINKED});
  const ready = () => as(ADRIAN, () => studio.ready({id: plan.id, operationId: randomUUID(), expectedRevision: plan.revision, expectedHash: plan.hash, format: 'post'}));
  await assert.rejects(ready(), e => e.status === 423 && e.message === UNLINKED && e.hold?.unlinked === true);
  // The files are held only by a real hold: with no desk to ask, they are not blocked by this rule.
  await as(AGENT, () => studio.assertPostable({id: plan.id}, 'Saving this frame for posting'));
  // A desk that links this plan's transcript is its project. Maya there has not been asked.
  const scope = {parentStudyId: 'proj-from-source', pieceKey: 'main'};
  const rec = (name, body, actor = AGENT) => as(actor, async () => { const d = await consent.read(scope); return consent[name]({...scope, operationId: randomUUID(), expectedRevision: d.revision, expectedHash: d.hash, ...body}); });
  const quote = 'I think every crack is a record of the hands that used it.', start = TRANSCRIPT.indexOf(quote);
  await rec('recordClaim', {claim: {kind: 'quote', text: quote, source: {type: 'library', sourceId: T_ID, sourceHash: T_HASH, start, quote}}});
  const maya = (await rec('recordPerson', {person: {name: 'Maya', appears: ['quoted']}})).people[0].id;
  plan = await as(ADRIAN, () => studio.read({id: plan.id}));
  assert.equal(plan.publishHold.unlinked, undefined, 'it found a desk');
  assert.equal(plan.publishHold.parentStudyId, 'proj-from-source'); assert.equal(plan.publishHold.summary, 'Maya has not been asked yet.');
  await assert.rejects(ready(), e => e.status === 423 && /Maya has not been asked yet/.test(e.message));
  await rec('answer', {personId: maya, state: 'yes'}, ADRIAN);
  plan = await as(ADRIAN, () => studio.read({id: plan.id}));
  assert.equal(plan.publishHold, null);
  assert.ok((await ready()).ready.post, 'ready works once the desk it belongs to has answers');
});

test('the desk resolves every id a piece is known by, in both directions, and a failing lookup never hides the asked id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hold-alias-'));
  const links = {'app-project-1': ['mag-clay'], 'mag-clay': ['app-project-1']};
  const consent = createConsentDesk({dataDir: dir, library, aliases: id => links[id] || []});
  const write = async (scope, name, body, actor = AGENT) => { const d = await consent.read(scope); return consent[name]({...scope, operationId: randomUUID(), expectedRevision: d.revision, expectedHash: d.hash, ...body}); };
  return (async () => {
    const appScope = {parentStudyId: 'app-project-1', pieceKey: 'main'};
    await as(AGENT, () => write(appScope, 'recordPerson', {person: {name: 'Maya', appears: ['named']}}));
    assert.equal(consent.holdFor([{parentStudyId: 'mag-clay'}]).parentStudyId, 'app-project-1', 'a desk saved under the app id holds the story id');
    assert.equal(consent.holdFor([{parentStudyId: 'app-project-1'}]).parentStudyId, 'app-project-1');
    assert.equal(consent.holdFor([{parentStudyId: 'unrelated'}]), null);
    const broken = createConsentDesk({dataDir: dir, library, aliases: () => { throw Error('lookup failed'); }});
    assert.equal(broken.holdFor([{parentStudyId: 'app-project-1'}]).held, true, 'a failing alias lookup still checks the id it was asked');
  })();
});

test('Magazine: a desk saved only under the app\'s own project id still holds Magazine send, mark-published and the exports', async t => {
  // The app opens a story under its own project id (here "app-project-clay"), which the original catalog ties to the draft file.
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md', SRC = 'Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md';
  const plan = planRegistration({vault: f.vault, files: f.files}); fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
  fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  const server = await createServer({dataDir: f.data, publicDir: path.join(repo, 'public'), researchEnabled: false,
    studyOriginalRoots: {vaultRoot: f.vault, filesRoot: f.files, catalog: {projects: {}, drafts: {'clay-1': {parentStudyKey: 'app-project-clay', partKey: '1', title: 'Clay Teacher', path: DEV, contextScope: 'Invented.', support: [[SRC, 'source']]}}}},
    magazineVault: {vaultRoot: f.vault, filesRoot: f.files, drops: f.drops, writable: true, machine: 'studio-mac', exportStaging: path.join(f.dir, 'staging')}});
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(async () => { await new Promise(r => server.close(r)); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const cli = async (args, input, actor = AGENT) => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
  const hashOf = rel => sha(fs.readFileSync(path.join(f.vault, rel)));
  // The desk exists ONLY under the app's project id. Nothing is saved under mag-clay-teacher.
  const appScope = {parentStudyId: 'app-project-clay', pieceKey: 'main'}, d = desk(cli, appScope), maya = await d.addPerson('Maya', ['pictured']);
  const underStory = await cli(['call', 'consent.desk'], {parentStudyId: 'mag-clay-teacher', pieceKey: 'main'}); assert.deepEqual([underStory.result.revision, underStory.result.people], [0, []], 'nothing is saved under the story id');
  const send = () => cli(['call', 'magazine.send'], {path: DEV, piece: 'clay-teacher', expectedHash: hashOf(DEV), operationId: randomUUID()}, ADRIAN);
  assertHeld(await send(), {who: ['Maya has not been asked yet'], scope: appScope});
  const hash = hashOf(DEV);
  assert.equal((await cli(['call', 'magazine.send.approval'], {path: DEV})).result.hold.parentStudyId, 'app-project-clay');
  const exp = await fetch(url + '/api/magazine/working-draft/export', {method: 'POST', headers: {'content-type': 'application/json', origin: url, 'x-ar-actor': ADRIAN}, body: JSON.stringify({storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', expectedHash: hash, renderRevision: 'a'.repeat(64), name: 'x.html', body: '<!doctype html><p>x</p>'})});
  assert.equal(exp.status, 423); assert.match((await exp.json()).error, /Maya has not been asked yet/);
  await d.answer(maya, 'yes');
  const sent = await send(); assert.equal(sent.exitCode, 0, JSON.stringify(sent.result));
  // Mark-published is held the same way once someone new is on the app's desk, and Adrian's override there releases it.
  await d.addPerson('Tom', ['quoted']);
  const mark = () => cli(['call', 'magazine.mark-published'], {path: DEV, link: 'https://teajia.com/read/clay-teacher', expectedHash: hash, operationId: randomUUID()}, ADRIAN);
  assertHeld(await mark(), {who: ['Tom has not been asked yet'], scope: appScope});
  await d.override('Tom confirmed by voice note.');
  const done = await mark(); assert.equal(done.exitCode, 0, JSON.stringify(done.result));
});

test('every held path is on the registry as a normal command and the CLI documents exit 4 for a hold', async t => {
  const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
  const server = await createServer({dataDir: config.dataDir, publicDir: path.join(repo, 'public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false});
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(async () => { await new Promise(r => server.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
  const url = 'http://127.0.0.1:' + server.address().port, caps = await (await fetch(url + '/api/capabilities')).json();
  for (const [method, route] of [['POST', '/api/study/outputs/export'], ['POST', '/api/exports'], ['POST', '/api/carousel/exports'], ['POST', '/api/magazine/working-draft/export'], ['POST', '/api/magazine/send'], ['POST', '/api/magazine/mark-published'], ['POST', '/api/magazine/export/save'], ['POST', '/api/instagram/ready'], ['GET', '/api/instagram/png'], ['GET', '/api/instagram/captions']])
    assert.ok(caps.commands.some(c => c.method === method && c.route === route), method + ' ' + route + ' is registered');
  const help = await run(['--help'], {});
  assert.match(JSON.stringify(help.result.exitCodes), /held for consent/);
});
