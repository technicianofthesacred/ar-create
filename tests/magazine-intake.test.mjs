import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createEventBus} from '../runtime/services/events.mjs';
import {withActor} from '../runtime/services/actor.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const AGENT = {actor: 'agent:claude-code', client: 'cli'};
function fakeEngine(dir) {
  const jobs = new Map();
  return {
    jobs, ready: () => true,
    start(story, file) { const id = randomUUID(); jobs.set(id, {id, story, file, state: 'running', stage: 'transcribe', transcriptReady: false, raw: null}); return id; },
    job: id => jobs.get(id) ? {...jobs.get(id)} : null,
    finish(id) { const raw = path.join(dir, `RAW-${id}.md`), text = `---\ntype: RAW\ntitle: "x"\naudio: "/isolated/copy.m4a"\nphotos: "/isolated/Photos"\n---\n\n# RAW – x\n\nWords from the recording.\n`; fs.writeFileSync(raw, text); Object.assign(jobs.get(id), {state: 'done', transcriptReady: true, raw, rawSha256: sha(Buffer.from(text))}); },
  };
}
function setup(t, {ready = true} = {}) {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const engine = fakeEngine(f.dir); if (!ready) engine.ready = () => false;
  const events = createEventBus();
  const vault = createMagazineVault({vaultRoot: f.vault, filesRoot: f.files, drops: f.drops, writable: true, dataDir: f.data, machine: 'studio-mac', intakeEngine: engine, events});
  return {f, vault, intake: vault.extra.intake, engine, events, as: fn => withActor(AGENT, fn)};
}

test('a dropped transcript is filed: copied into its story folder, RAW written once, and the drop emptied after', async t => {
  const {f, intake, as, events} = setup(t), dropped = fs.readFileSync(path.join(f.drop, 'Stone Carver.txt'));
  const r = await as(() => intake.claim({name: 'Stone Carver.txt', folder: 0, story: 'Stone Carver', operationId: randomUUID()}));
  assert.equal(r.filed, true, JSON.stringify(r));
  assert.equal(sha(fs.readFileSync(path.join(f.files, 'Stone Carver', 'Stone Carver.txt'))), sha(dropped));
  assert.ok(fs.statSync(path.join(f.files, 'Stone Carver', 'Photos')).isDirectory());
  const raw = fs.readFileSync(path.join(f.vault, 'Workflow/0-Inbox/RAW - Stone Carver.md'), 'utf8');
  assert.match(raw, /^type: RAW$/m); assert.match(raw, /Stone keeps the shape of the first mistake/);
  assert.ok(!fs.existsSync(path.join(f.drop, 'Stone Carver.txt')), 'the drop is emptied only after RAW exists');
  assert.equal(r.claim.drop.after, 'emptied');
  assert.ok(events.since(0).events.some(e => e.kind === 'recording.filed'));
});

test('a recording is copied, transcribed by the engine, and filed only when its RAW is ready; the drop waits until then', async t => {
  const {f, intake, engine, as} = setup(t);
  const c = await as(() => intake.claim({name: 'MIC001.m4a', folder: 0, story: 'Kiln Night', operationId: randomUUID()}));
  assert.equal(c.claim.state, 'transcribing');
  assert.ok(fs.existsSync(path.join(f.files, 'Kiln Night', 'MIC001.m4a'))); assert.ok(fs.existsSync(path.join(f.drop, 'MIC001.m4a')), 'the drop is kept while transcribing');
  await assert.rejects(as(() => intake.file({claimId: c.claim.claimId, operationId: randomUUID()})), e => e.status === 409 && /Still transcribing/.test(e.message));
  engine.finish(c.claim.jobId);
  const filed = await as(() => intake.file({claimId: c.claim.claimId, operationId: randomUUID()}));
  assert.equal(filed.filed, true);
  const raw = fs.readFileSync(path.join(f.vault, 'Workflow/0-Inbox/RAW - Kiln Night.md'), 'utf8');
  assert.match(raw, new RegExp('^audio: ' + JSON.stringify(path.join(f.files, 'Kiln Night', 'MIC001.m4a')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm'), 'RAW points at the FILES copy, not the isolated one');
  assert.ok(!fs.existsSync(path.join(f.drop, 'MIC001.m4a')));
  assert.equal((await as(() => intake.file({claimId: c.claim.claimId, operationId: randomUUID()}))).already, true);
});

test('the same bytes dropped again are refused while the first claim stands, and an existing RAW is never overwritten', async t => {
  const {f, intake, as} = setup(t), bytes = fs.readFileSync(path.join(f.drop, 'MIC001.m4a'));
  const op = randomUUID();
  await as(() => intake.claim({name: 'MIC001.m4a', folder: 0, story: 'Kiln Night', operationId: op}));
  assert.equal((await as(() => intake.claim({name: 'MIC001.m4a', folder: 0, story: 'Kiln Night', operationId: op}))).replay, true, 'a retried claim replays');
  fs.writeFileSync(path.join(f.phoneDrop, 'MIC001 copy.m4a'), bytes);
  await assert.rejects(as(() => intake.claim({name: 'MIC001 copy.m4a', folder: 1, story: 'Kiln Night Again', operationId: randomUUID()})), e => e.status === 409 && /already taken in/.test(e.message));
  assert.ok(fs.existsSync(path.join(f.phoneDrop, 'MIC001 copy.m4a')));
  fs.writeFileSync(path.join(f.drop, 'River.txt'), 'new words\n');
  await assert.rejects(as(() => intake.claim({name: 'River.txt', folder: 0, story: 'River Potter', operationId: randomUUID()})), e => e.status === 409 && /never overwritten/.test(e.message));
  assert.ok(fs.existsSync(path.join(f.drop, 'River.txt')));
});

test('without local transcription the recording stays in the drop folder (503), and nothing is copied', async t => {
  const {f, intake, as} = setup(t, {ready: false});
  await assert.rejects(as(() => intake.claim({name: 'MIC001.m4a', folder: 0, story: 'Kiln Night', operationId: randomUUID()})), e => e.status === 503);
  assert.ok(fs.existsSync(path.join(f.drop, 'MIC001.m4a'))); assert.ok(!fs.existsSync(path.join(f.files, 'Kiln Night')));
});

test('a file still downloading from iCloud is named as such, and hidden or unknown files are refused', async t => {
  const {f, intake, as} = setup(t);
  fs.writeFileSync(path.join(f.phoneDrop, '.Phone memo.m4a.icloud'), 'placeholder');
  await assert.rejects(as(() => intake.claim({name: 'Phone memo.m4a', folder: 1, story: 'Phone', operationId: randomUUID()})), e => e.status === 409 && /downloading from iCloud/.test(e.message));
  await assert.rejects(as(() => intake.claim({name: '../x.m4a', folder: 0, story: 'X', operationId: randomUUID()})), e => e.status === 400);
  fs.writeFileSync(path.join(f.drop, 'notes.docx'), 'x');
  await assert.rejects(as(() => intake.claim({name: 'notes.docx', folder: 0, story: 'X', operationId: randomUUID()})), e => e.status === 415);
});
