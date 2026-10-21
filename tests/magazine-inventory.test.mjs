import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {inventory, diffInventories} from '../tools/magazine/inventory.mjs';
import {dryRun, apply, rollback, summarize} from '../tools/magazine/register.mjs';

test('inventory lists every file with kind and hash, prints no body text, and is stable', async t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const a = await inventory({mag: f.vault, files: f.files}), b = await inventory({mag: f.vault, files: f.files});
  assert.deepEqual(diffInventories(a, b), []);
  assert.equal(a.mag.fileCount, Object.keys(treeHashes(f.vault)).filter(rel => !rel.split('/').some(p => p.startsWith('.'))).length);
  const dev = a.mag.files.find(x => x.rel === 'Workflow/3-Develop/DEV - Clay Teacher (story).md');
  assert.equal(dev.kind, 'DEV'); assert.equal(dev.class, 'prose'); assert.match(dev.sha256, /^[a-f0-9]{64}$/);
  assert.equal(a.mag.files.find(x => x.rel === 'SYSTEM.md').kind, null);
  const text = JSON.stringify(a);
  assert.ok(!text.includes('The clay remembers'), 'inventory must never carry story text');
  assert.ok(!text.includes('Stone keeps the shape'), 'inventory must never carry drop text');
  assert.equal(a.summary.perKind.DEV, 1);
});

test('register --dry-run plans projects, pieces and records, flags the test recording archived, and writes nothing', async t => {
  const f = buildMagazineFixture({extra: {'Workflow/3-Develop/DEV - Clay Teacher (story v2).md': '---\ntype: DEV\nstory: Clay Teacher\n---\n\nSecond draft.\n'}}); t.after(f.cleanup);
  const before = {...treeHashes(f.vault), ...Object.fromEntries(Object.entries(treeHashes(f.files)).map(([k, v]) => ['files/' + k, v]))};
  const plan = await dryRun({mag: f.vault, files: f.files});
  const after = {...treeHashes(f.vault), ...Object.fromEntries(Object.entries(treeHashes(f.files)).map(([k, v]) => ['files/' + k, v]))};
  assert.deepEqual(after, before, 'dry run must not change a byte');
  const clay = plan.stories.find(p => p.name === 'Clay Teacher');
  assert.equal(clay.number, 1); assert.equal(clay.brandId, 'teajia'); assert.deepEqual(clay.origin, {kind: 'magazine', story: 'Clay Teacher', number: 1});
  assert.equal(clay.vaultRecords.ask.rel, 'Workflow/ASK - Clay Teacher.md');
  assert.equal(clay.vaultRecords.context.rel, 'Workflow/1-Source/CONTEXT - Clay Teacher.md');
  assert.ok(clay.vaultRecords.social.some(s => s.rel.includes('CAROUSEL')));
  assert.ok(plan.ambiguities.some(a => a.story === 'Clay Teacher' && /two or more whole drafts/.test(a.reason)));
  const river = plan.stories.find(p => p.name === 'River Potter'); assert.equal(river.number, 2); assert.equal(river.vaultRecords.raw.rel, 'Workflow/0-Inbox/RAW - River Potter.md');
  assert.equal(plan.stories.find(p => p.name === 'UI-flow-part-01').archived, true);
  assert.ok(!JSON.stringify(summarize(plan)).includes('The clay remembers'));
  assert.ok(!fs.existsSync(path.join(f.data, 'magazine')));
});

test('register --apply writes only the index, proves every vault hash unchanged, is idempotent, and rolls back', async t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const before = treeHashes(f.vault), verification = path.join(f.dir, 'verification');
  const result = await apply({mag: f.vault, files: f.files, data: f.data, verification});
  assert.equal(result.applied, true, JSON.stringify(result)); assert.equal(result.identical, true);
  assert.deepEqual(treeHashes(f.vault), before);
  const proof = JSON.parse(fs.readFileSync(result.proofFile, 'utf8')); assert.equal(proof.identical, true); assert.deepEqual(proof.changes, []);
  const index = JSON.parse(fs.readFileSync(path.join(f.data, 'magazine', 'index.json'), 'utf8'));
  assert.ok(index.stories.some(s => s.name === 'Clay Teacher' && s.number === 1));
  const journal = fs.readdirSync(path.join(f.data, 'journal')).flatMap(n => fs.readFileSync(path.join(f.data, 'journal', n), 'utf8').trim().split('\n')).map(l => JSON.parse(l));
  assert.ok(journal.every(l => l.actor === 'import:magazine-vault' && l.kind === 'import:magazine-vault'));
  assert.equal(journal.length, index.stories.length);
  assert.equal((await apply({mag: f.vault, files: f.files, data: f.data, verification})).alreadyRegistered, true);
  const back = rollback({data: f.data}); assert.equal(back.rolledBack, true);
  assert.ok(!fs.existsSync(path.join(f.data, 'magazine'))); assert.ok(fs.existsSync(path.join(back.movedTo, 'index.json')));
});

test('register --apply rolls itself back when the vault changed during registration', async t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  let calls = 0;
  const now = () => { if (++calls === 1) fs.appendFileSync(path.join(f.vault, 'Workflow/3-Develop/NOTES - Clay Teacher (story).md'), '- someone else wrote\n'); return new Date(); };
  const result = await apply({mag: f.vault, files: f.files, data: f.data, verification: path.join(f.dir, 'verification'), now});
  assert.equal(result.applied, false); assert.equal(result.rolledBack, true);
  assert.deepEqual(result.changes.map(c => c.change), ['changed']);
  assert.ok(!fs.existsSync(path.join(f.data, 'magazine')));
});
