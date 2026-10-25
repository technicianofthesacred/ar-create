import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStudyResearchChoices, researchPointId } from './study-research-choices.mjs';
import { digest } from './files.mjs';

function snapshot(root) {
  const entries = [];
  const visit = (dir, prefix = '') => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name), relative = path.join(prefix, name), stat = fs.lstatSync(full);
      if (stat.isDirectory()) { entries.push([relative, 'directory']); visit(full, relative); }
      else if (stat.isSymbolicLink()) entries.push([relative, 'symlink', fs.readlinkSync(full)]);
      else entries.push([relative, 'file', fs.readFileSync(full, 'hex')]);
    }
  };
  visit(root);
  return entries;
}

function fixture(t) {
  const dataDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'study-research-choices-')));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const bindingId = randomUUID();
  const expected = { workflow: { draft: digest('synthetic-draft') } };
  const record = { path: 'Workflow/3-Develop/NOTES - Synthetic.md', role: 'research notes', raw: 'One exact research passage.' };
  record.hash = digest(record.raw);
  let draftExpected = expected;
  const drafts = { read: async () => ({
    binding: { id: bindingId, parentStudyId: 'hk', authority: 'owned-working-copy', status: 'ready' },
    expected: draftExpected,
    readiness: { ready: true },
    projection: [],
  }) };
  const originals = { list: async projectKey => ({ projectKey, records: [record] }) };
  const service = createStudyResearchChoices({ dataDir, originals, drafts });
  const selector = { projectKey: 'hk', parentStudyId: 'hk', bindingId };
  const saveInput = async operationId => {
    const current = await service.read(selector);
    return {
      ...selector,
      pointId: researchPointId(record.path, record.raw),
      recordPath: record.path,
      recordHash: record.hash,
      originalText: record.raw,
      decision: 'include',
      expected: draftExpected,
      sourceExpected: current.sourceExpected,
      operationId,
    };
  };
  return { dataDir, bindingId, expected, record, selector, service, saveInput, setDraftExpected: value => { draftExpected = value; } };
}

test('constructing and reading with an absent root leaves the filesystem unchanged', async t => {
  const f = fixture(t), root = path.join(f.dataDir, 'study-research-choices'), before = snapshot(f.dataDir);
  const read = await f.service.read(f.selector);
  assert.deepEqual(read.choices, []);
  assert.deepEqual(read.receiptIds, []);
  assert.equal(fs.existsSync(root), false);
  assert.deepEqual(snapshot(f.dataDir), before);
});

test('reading an absent binding under an existing root does not create its directory', async t => {
  const f = fixture(t), root = path.join(f.dataDir, 'study-research-choices');
  fs.mkdirSync(root);
  const before = snapshot(f.dataDir), read = await f.service.read(f.selector);
  assert.deepEqual(read.choices, []);
  assert.equal(fs.existsSync(path.join(root, f.bindingId)), false);
  assert.deepEqual(snapshot(f.dataDir), before);
});

test('read refuses an existing symlinked binding path without changing it', async t => {
  const f = fixture(t), root = path.join(f.dataDir, 'study-research-choices');
  fs.mkdirSync(root);
  const target = path.join(f.dataDir, 'unrelated');
  fs.mkdirSync(target);
  fs.symlinkSync(target, path.join(root, f.bindingId));
  const before = snapshot(f.dataDir);
  await assert.rejects(f.service.read(f.selector), /real directories/);
  assert.deepEqual(snapshot(f.dataDir), before);
});

test('save creates its directories, reload is idempotent, and changed proofs mark the saved choice stale', async t => {
  const f = fixture(t), operationId = randomUUID(), input = await f.saveInput(operationId);
  const saved = await f.service.save(input), afterSave = snapshot(f.dataDir);
  assert.equal(saved.choices.length, 1);
  assert.equal(saved.choices[0].stale, false);
  const reloaded = await f.service.read(f.selector);
  assert.deepEqual(reloaded.choices, saved.choices);
  assert.deepEqual(snapshot(f.dataDir), afterSave);
  assert.deepEqual(await f.service.save(input), saved);
  assert.deepEqual(snapshot(f.dataDir), afterSave);

  f.setDraftExpected({ workflow: { draft: digest('changed-synthetic-draft') } });
  const stale = await f.service.read(f.selector);
  assert.equal(stale.choices[0].stale, true);
  assert.equal(stale.choices[0].draftStale, true);
  assert.deepEqual(snapshot(f.dataDir), afterSave);
});
