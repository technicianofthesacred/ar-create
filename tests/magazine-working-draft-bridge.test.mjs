import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';

const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const OTHER = 'Workflow/3-Develop/DEV - River Potter (story).md';
const PUBLISHED = 'Writing/Clay edition.md';
const human = fn => withActor({actor: 'human:adrian', client: 'ui'}, fn);
const agent = fn => withActor({actor: 'agent:codex', client: 'cli'}, fn);
const sha = text => createHash('sha256').update(text).digest('hex');
const selection = {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working'};
function setup(t, {registered = true, writable = true} = {}) {
  const f = buildMagazineFixture({extra: {[OTHER]: '---\ntype: DEV\nstory: River Potter\n---\n\nOther working words.\n', [PUBLISHED]: '# An earlier edition\n\nEarlier words.\n'}});
  t.after(f.cleanup);
  if (registered) {
    const plan = planRegistration({vault: f.vault, files: f.files});
    fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
    fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
    for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  }
  const magazine = createMagazineVault({vaultRoot: f.vault, filesRoot: f.files, dataDir: f.data, writable, machine: 'synthetic-bridge'});
  // A read-only edition owner, supplied by server composition, never by request data.
  const editions = {read: input => {
    if (input.storyId !== selection.storyId || input.pieceId !== selection.pieceId || input.editionId !== 'published-1') throw Object.assign(Error('Unknown edition'), {status: 404});
    const text = fs.readFileSync(path.join(f.vault, PUBLISHED), 'utf8');
    return {...input, edition: 'published', text, hash: sha(text)};
  }};
  const bridge = createWorkingDraftBridge({magazine, editions});
  return {f, magazine, bridge, editions, read: rel => fs.readFileSync(path.join(f.vault, rel), 'utf8')};
}
const paragraph = view => view.paragraphs.find(p => p.text.startsWith('I met Mira'));
const editInput = view => ({...selection, block: paragraph(view).block, seen: paragraph(view).seen, text: 'I met Mira beside the quiet kiln.', operationId: randomUUID()});
const status = n => e => e.status === n;

test('same canonical DEV opens, edits, saves and reopens; earlier publication and other files stay exact', async t => {
  const {f, magazine, bridge, editions, read} = setup(t), before = treeHashes(f.vault), initial = read(DEV);
  const view = await bridge.read(selection);
  assert.equal(view.editable, true);
  assert.equal(view.document.hash, sha(initial));
  assert.equal(view.authority.kind, 'magazine');
  const input = editInput(view), saved = await human(() => bridge.edit(input));
  assert.equal(saved.changed, true);
  const reopened = await createWorkingDraftBridge({magazine, editions}).read(selection);
  assert.match(reopened.document.text, /beside the quiet kiln/);
  const full = await human(() => bridge.save({...selection, content: reopened.document.text + '\nA closing sentence.\n', expectedHash: reopened.document.hash, operationId: randomUUID()}));
  assert.equal(full.written, true);
  assert.match((await bridge.read(selection)).document.text, /A closing sentence/);
  const after = treeHashes(f.vault);
  for (const [rel, hash] of Object.entries(before)) if (rel !== DEV) assert.equal(after[rel], hash, rel);
  assert.deepEqual(Object.keys(after).filter(rel => !(rel in before)), ['Workflow/4-Review/EDITS - DEV - Clay Teacher (story).md']);
});

test('published and historical selection cannot become working authority or donor paragraph identity', async t => {
  const {bridge, f} = setup(t), before = treeHashes(f.vault);
  const published = {...selection, edition: 'published', editionId: 'published-1'};
  const view = await bridge.read(published);
  assert.equal(view.editable, false); assert.equal(view.paragraphs.length, 0);
  assert.match(view.document.text, /Earlier words/);
  for (const method of ['save', 'edit', 'undo']) await assert.rejects(human(() => bridge[method]({...published, operationId: randomUUID(), content: 'x', expectedHash: view.document.hash})), status(403));
  await assert.rejects(bridge.read({...published, edition: 'historical'}), status(409));
  await assert.rejects(human(() => bridge.edit({...selection, block: 'retained-block-66', seen: '0123456789ab', text: 'x', operationId: randomUUID()})), status(400));
  assert.deepEqual(treeHashes(f.vault), before);
});

test('stale paragraph and stale full-file save refuse without overwriting newer words', async t => {
  const {bridge, f, read} = setup(t), view = await bridge.read(selection), input = editInput(view);
  fs.writeFileSync(path.join(f.vault, DEV), read(DEV).replace('I met Mira', 'We met Mira'));
  const before = treeHashes(f.vault);
  await assert.rejects(human(() => bridge.edit(input)), status(409));
  await assert.rejects(human(() => bridge.save({...selection, content: view.document.text, expectedHash: view.document.hash, operationId: randomUUID()})), status(409));
  assert.deepEqual(treeHashes(f.vault), before);
});

test('lost edit/save responses replay original owner receipts across fresh adapters and reject changed input', async t => {
  const {bridge, magazine, f} = setup(t), view = await bridge.read(selection), input = editInput(view);
  await human(() => bridge.edit(input)); // Response lost before client observes it.
  const before = treeHashes(f.vault), fresh = createWorkingDraftBridge({magazine});
  const replay = await human(() => fresh.edit(input));
  assert.equal(replay.replay, true);
  assert.equal((await fresh.operation({...selection, operationId: input.operationId})).actor, 'human:adrian');
  await assert.rejects(human(() => fresh.edit({...input, text: 'Different retry'})), status(409));
  assert.deepEqual(treeHashes(f.vault), before);
  const current = await fresh.read(selection), save = {...selection, content: current.document.text + '\nSaved.\n', expectedHash: current.document.hash, operationId: randomUUID()};
  await human(() => fresh.save(save));
  assert.equal((await human(() => createWorkingDraftBridge({magazine}).save(save))).replay, true);
});

test('exact Undo uses existing receipt, survives lost response and restores DEV plus edit-log bytes', async t => {
  const {bridge, magazine, f} = setup(t), before = treeHashes(f.vault), view = await bridge.read(selection), input = editInput(view);
  await human(() => bridge.edit(input));
  assert.equal((await human(() => bridge.eligibleUndo({...selection, operationId: input.operationId}))).eligible, true);
  assert.equal((await agent(() => bridge.eligibleUndo({...selection, operationId: input.operationId}))).eligible, false);
  const undo = {...selection, undoOperationId: input.operationId, operationId: randomUUID()};
  await human(() => bridge.undo(undo));
  assert.deepEqual(treeHashes(f.vault), before);
  assert.equal((await bridge.operation({...selection, operationId: undo.operationId})).result.undone, input.operationId);
  assert.equal((await human(() => createWorkingDraftBridge({magazine}).undo(undo))).replay, true);
  assert.equal((await human(() => bridge.eligibleUndo({...selection, operationId: input.operationId}))).eligible, false);
});

test('Undo eligibility includes log changes; no partial restore when another changed file differs', async t => {
  const {bridge, f} = setup(t), input = editInput(await bridge.read(selection));
  await human(() => bridge.edit(input));
  fs.appendFileSync(path.join(f.vault, 'Workflow/4-Review/EDITS - DEV - Clay Teacher (story).md'), '\nLater log words.\n');
  const before = treeHashes(f.vault);
  assert.equal((await human(() => bridge.eligibleUndo({...selection, operationId: input.operationId}))).eligible, false);
  await assert.rejects(human(() => bridge.undo({...selection, undoOperationId: input.operationId, operationId: randomUUID()})), status(409));
  assert.deepEqual(treeHashes(f.vault), before);
});

test('unregistered/read-only state refuses; caller paths, authority, actor and title aliases are never accepted', async t => {
  const unregistered = setup(t, {registered: false});
  await assert.rejects(unregistered.bridge.read(selection), status(404));
  const {bridge, f} = setup(t, {writable: false}), before = treeHashes(f.vault), view = await bridge.read(selection);
  assert.equal(view.editable, false);
  await assert.rejects(human(() => bridge.edit(editInput(view))), status(503));
  const active = setup(t);
  for (const extra of [{path: DEV}, {authority: {writable: true}}, {actor: 'human:adrian'}, {editionId: 'published-1'}]) await assert.rejects(active.bridge.read({...selection, ...extra}), status(400));
  await assert.rejects(active.bridge.read({...selection, storyId: 'Clay Teacher'}), status(404));
  await assert.rejects(active.bridge.read({...selection, pieceId: 'mag-river-potter:article'}), status(404));
  await assert.rejects(active.bridge.save({...selection, content: 'x', expectedHash: view.document.hash, operationId: randomUUID()}), status(400));
  assert.deepEqual(treeHashes(f.vault), before);
});

test('agents retain maintained proposal semantics; arbitrary operation and sibling Undo cannot cross scope', async t => {
  const {bridge, magazine, f} = setup(t), view = await bridge.read(selection), before = treeHashes(f.vault);
  const proposed = await agent(() => bridge.save({...selection, content: view.document.text + '\nProposed words.\n', expectedHash: view.document.hash, operationId: randomUUID()}));
  assert.equal(proposed.proposed, true); assert.deepEqual(treeHashes(f.vault), before);
  await assert.rejects(agent(() => bridge.edit(editInput(view))), status(403));
  const other = await human(() => magazine.write({path: OTHER, content: 'Sibling edit.\n', expectedHash: magazine.read({path: OTHER}).hash, operationId: randomUUID()}));
  await assert.rejects(bridge.operation({...selection, operationId: other.operationId}), status(403));
  await assert.rejects(human(() => bridge.undo({...selection, undoOperationId: other.operationId, operationId: randomUUID()})), status(403));
  const receipt = await bridge.operation({...selection, operationId: proposed.operationId});
  assert.ok(receipt.changes.every(ch => !('before' in ch)));
  assert.equal((await human(() => bridge.eligibleUndo({...selection, operationId: proposed.operationId}))).eligible, false);
});

test('ambiguous registered identity and an edition with incorrect bytes never resolve', async t => {
  const {magazine, editions, bridge, f} = setup(t);
  const file = path.join(f.data, 'magazine/projects', selection.storyId + '.json');
  const project = JSON.parse(fs.readFileSync(file));
  project.pieces.push({...project.pieces.find(p => p.pieceId === selection.pieceId)});
  fs.writeFileSync(file, JSON.stringify(project));
  await assert.rejects(bridge.read(selection), status(409));
  const broken = createWorkingDraftBridge({magazine, editions: {read: input => ({...editions.read(input), hash: 'a'.repeat(64)})}});
  await assert.rejects(broken.read({...selection, edition: 'published', editionId: 'published-1'}), status(409));
});

test('pending wording and external conflict copies retain maintained refusals and all exact bytes', async t => {
  const {bridge, f} = setup(t), view = await bridge.read(selection);
  const pending = view.paragraphs.find(p => p.text.startsWith('She waits'));
  const before = treeHashes(f.vault);
  await assert.rejects(human(() => bridge.edit({...selection, block: pending.block, seen: pending.seen, text: 'Changed pending words.', operationId: randomUUID()})), status(409));
  assert.deepEqual(treeHashes(f.vault), before);
  fs.writeFileSync(path.join(f.vault, DEV.replace('.md', '.sync-conflict-20261022-ABC.md')), 'External version.\n');
  const conflicted = treeHashes(f.vault);
  assert.equal((await bridge.read(selection)).editable, false);
  await assert.rejects(human(() => bridge.edit(editInput(view))), status(409));
  await assert.rejects(human(() => bridge.save({...selection, content: 'Overwrite', expectedHash: view.document.hash, operationId: randomUUID()})), status(409));
  assert.deepEqual(treeHashes(f.vault), conflicted);
});
