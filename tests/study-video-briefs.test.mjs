import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {withActor} from '../runtime/services/actor.mjs';
import {digest} from '../runtime/services/files.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';

async function fixture(t, {duplicate = false, role = 'source'} = {}) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'video-brief-')));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const dataDir = path.join(directory, 'data');
  fs.mkdirSync(dataDir);

  const sourcePath = 'transcript.md';
  const quote = 'Steam rose above the kettle.';
  const before = 'An invented interview. 🍵\r\n';
  const after = '\r\nThe speaker paused.';
  const raw = before + quote + after;
  const sourceFile = path.join(directory, sourcePath);
  fs.writeFileSync(sourceFile, raw);
  fs.writeFileSync(path.join(directory, 'other.md'), raw);

  const docs = [[sourcePath, role]];
  if (duplicate) docs.push([sourcePath, 'source']);
  const originals = createStudyOriginals({
    vaultRoot: directory,
    filesRoot: directory,
    catalog: {projects: {hk: {docs}, ancha: {docs: [['other.md', 'source']]}}},
  });
  const {createStudyVideoBriefs} = await import('../runtime/services/study-video-briefs.mjs');
  const open = () => createStudyVideoBriefs({dataDir, originals});
  const scope = {projectKey: 'hk', parentStudyId: 'hk'};
  const input = {
    ...scope,
    title: 'Tea video brief',
    findingId: 'finding.invented.steam',
    operationId: randomUUID(),
    sourcePath,
    sourceHash: digest(raw),
    from: before.length,
    to: before.length + quote.length,
    quote,
  };

  return {open, scope, input, sourceFile, before, after, raw};
}

test('a proposed brief reopens with its exact original passage and nearby text', async t => {
  const {open, scope, input, before, after, raw, sourceFile} = await fixture(t);
  assert.deepEqual(await open().list(scope), {briefs: []});
  const {brief} = await withActor({actor: 'agent:codex', client: 'ui'}, () => open().add(input));
  assert.equal(brief.id, input.operationId);
  assert.equal(brief.findingId, input.findingId);
  assert.equal(brief.provenance.actor, 'agent:codex');
  assert.deepEqual((await open().list(scope)).briefs, [brief]);
  const reopened = await open().resolve({...scope, id: brief.id});
  assert.deepEqual(reopened.brief, brief);
  assert.deepEqual(reopened.source, {
    title: 'transcript.md',
    path: input.sourcePath,
    hash: input.sourceHash,
    before,
    quote: input.quote,
    after,
    line: 2,
  });
  assert.equal(fs.readFileSync(sourceFile, 'utf8'), raw);
});

test('concurrent replay saves a single brief and rejects a conflicting payload', async t => {
  const {open, scope, input} = await fixture(t);
  const repeated = await Promise.all([open().add(input), open().add(input)]);
  assert.deepEqual(repeated[0], repeated[1]);
  await assert.rejects(open().add({...input, title: 'Different brief'}), {status: 409});
  assert.deepEqual((await open().list(scope)).briefs, [repeated[0].brief]);
});

test('a changed original keeps the saved brief visible and refuses its old citation', async t => {
  const {open, scope, input, sourceFile, raw} = await fixture(t);
  const {brief} = await open().add(input);
  fs.writeFileSync(sourceFile, raw + '\nNew source revision');
  assert.deepEqual((await open().list(scope)).briefs, [brief]);
  await assert.rejects(open().resolve({...scope, id: brief.id}), {status: 409});
  await assert.rejects(open().add({...input, operationId: randomUUID()}), {status: 409});
});

test('a brief cannot cite another subject, the wrong exact range, or a duplicated source identity', async t => {
  const {open, scope, input} = await fixture(t);
  await assert.rejects(open().add({...input, parentStudyId: 'ref-an-cha'}), {status: 409});
  await assert.rejects(open().add({...input, sourcePath: 'other.md'}), {status: 409});
  await assert.rejects(open().add({...input, from: input.from + 1, to: input.to + 1}), {status: 409});
  assert.deepEqual((await open().list(scope)).briefs, []);
  const duplicate = await fixture(t, {duplicate: true});
  await assert.rejects(duplicate.open().add(duplicate.input), {status: 409});
});

test('research-note text cannot be saved as a citation to the original transcript', async t => {
  const {open, input} = await fixture(t, {role: 'research'});
  await assert.rejects(open().add(input), {status: 409});
});
