import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {magazineServer} from './helpers/magazine-server.mjs';
import {apply} from '../tools/magazine/register.mjs';
import * as edits from '../runtime/reference/mag-edit.mjs';
import {sideBySide} from '../runtime/services/magazine-vault/reconcile.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
async function registered(t) {
  const s = await magazineServer(t);
  const r = await apply({mag: s.f.vault, files: s.f.files, data: s.f.data, verification: path.join(s.f.dir, 'verification')});
  assert.equal(r.applied, true);
  return s;
}
function ownedCopy(f, text) {
  const id = randomUUID(), key = createHash('sha256').update(id).digest('hex'), draftRelative = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
  fs.mkdirSync(path.join(f.data, 'study-draft-copies', 'bindings'), {recursive: true});
  fs.writeFileSync(path.join(f.data, 'study-draft-copies', 'bindings', key + '.json'), JSON.stringify({schema: 'ar-create.study-draft-copy.v1', key, id, status: 'ready', parentStudyId: 'ref-clay', title: 'Clay Teacher', draftRelative}));
  const copy = path.join(f.data, 'study-draft-copies', 'copies', id, 'workflow', draftRelative);
  fs.mkdirSync(path.dirname(copy), {recursive: true}); fs.writeFileSync(copy, text);
  return id;
}

test('a registered story opens with its real vault draft, and a page edit lands in the vault with an EDITS line and the actor journalled', async t => {
  const s = await registered(t);
  const list = await s.cli(['call', 'magazine.stories'], {});
  assert.ok(list.result.stories.some(x => x.name === 'Clay Teacher' && x.brandId === 'teajia' && x.origin.number === 1));
  const story = await s.cli(['call', 'magazine.story'], {id: 'mag-clay-teacher'});
  assert.equal(story.exitCode, 0, JSON.stringify(story.result));
  assert.equal(story.result.draft.path, DEV); assert.match(story.result.draft.text, /I met Mira/);
  assert.equal(story.result.vaultRecords.draft[0].changedSinceRegistration, false);
  const {parts} = edits.splitBlocks(story.result.draft.text), index = parts.findIndex((p, i) => i % 2 === 0 && p.includes('I met Mira')) / 2;
  const r = await s.page('/api/magazine/edit', {path: DEV, block: index, seen: edits.hash(parts[index * 2]), text: 'I met Mira by the kilns.', operationId: randomUUID()});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(fs.readFileSync(path.join(s.f.vault, DEV), 'utf8'), /I met Mira by the kilns\./);
  assert.match(fs.readFileSync(path.join(s.f.vault, 'Workflow/4-Review/EDITS - DEV - Clay Teacher (story).md'), 'utf8'), /- after: I met Mira by the kilns\./);
  const line = s.journal().find(l => l.kind === 'magazine.edit');
  assert.equal(line.actor, 'human:adrian'); assert.equal(line.client, 'mag-page'); assert.deepEqual(line.scope, {kind: 'story', id: 'mag-clay-teacher'});
  const again = await s.cli(['call', 'magazine.story'], {id: 'mag-clay-teacher'});
  assert.equal(again.result.vaultRecords.draft[0].changedSinceRegistration, true);
});

test('no new working copy is made of a registered story while AR Create writes the vault', async t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  await apply({mag: f.vault, files: f.files, data: f.data, verification: path.join(f.dir, 'v')});
  const source = {records: [{role: 'draft', path: path.join(f.vault, DEV)}]};
  assert.match(createMagazineVault({vaultRoot: f.vault, dataDir: f.data, writable: true}).vaultBound(source), /registered magazine story/);
  assert.equal(createMagazineVault({vaultRoot: f.vault, dataDir: f.data, writable: false}).vaultBound(source), null, 'read-only: the old working-copy path stays open');
  assert.equal(createMagazineVault({vaultRoot: f.vault, dataDir: f.data, writable: true}).vaultBound({records: [{role: 'draft', path: '/x/DEV - Elsewhere.md'}]}), null);
});

test('D7: a different working copy is shown side by side and Adrian picks; nothing merges by itself', async t => {
  const s = await registered(t);
  const vaultText = fs.readFileSync(path.join(s.f.vault, DEV), 'utf8');
  const id = ownedCopy(s.f, vaultText.replace('I met Mira at the edge of the village, where the kilns stand in a row.', 'I met Mira in the working copy.'));
  const list = await s.cli(['call', 'magazine.reconcile'], {});
  const row = list.result.copies.find(c => c.bindingId === id);
  assert.equal(row.state, 'different'); assert.equal(row.story, 'Clay Teacher');
  const cmp = await s.cli(['call', 'magazine.reconcile.compare'], {bindingId: id});
  assert.ok(cmp.result.sideBySide.rows.some(r => r.kind === 'vault-only' && /kilns stand in a row/.test(r.vault)));
  assert.ok(cmp.result.sideBySide.rows.some(r => r.kind === 'copy-only' && /working copy/.test(r.copy)));
  assert.equal(fs.readFileSync(path.join(s.f.vault, DEV), 'utf8'), vaultText, 'comparing changes nothing');
  const input = {bindingId: id, choice: 'copy', expectedVaultHash: row.vaultHash, expectedCopyHash: row.copyHash, operationId: randomUUID()};
  assert.equal((await s.cli(['call', 'magazine.reconcile.choose'], input)).exitCode, 5);
  const chosen = await s.page('/api/magazine/reconcile/choose', input);
  assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
  assert.match(fs.readFileSync(path.join(s.f.vault, DEV), 'utf8'), /I met Mira in the working copy\./);
  assert.ok(fs.existsSync(path.join(chosen.body.archivedTo, 'binding.json')) && fs.existsSync(path.join(chosen.body.archivedTo, 'copy')), 'the copy is archived, not deleted');
  assert.equal((await s.cli(['call', 'magazine.reconcile'], {})).result.copies.length, 0);
});

test('D7: an equal working copy needs no choice beyond archiving, and keeping the vault leaves it byte-identical', async t => {
  const s = await registered(t), before = fs.readFileSync(path.join(s.f.vault, DEV));
  const id = ownedCopy(s.f, before.toString('utf8'));
  const row = (await s.cli(['call', 'magazine.reconcile'], {})).result.copies.find(c => c.bindingId === id);
  assert.equal(row.state, 'equal');
  const r = await s.page('/api/magazine/reconcile/choose', {bindingId: id, choice: 'vault', expectedVaultHash: row.vaultHash, expectedCopyHash: row.copyHash, operationId: randomUUID()});
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.written, null);
  assert.equal(sha(fs.readFileSync(path.join(s.f.vault, DEV))), sha(before));
});

test('sideBySide keeps reading order and marks only what differs', () => {
  const r = sideBySide('A\n\nB\n\nC', 'A\n\nX\n\nC');
  assert.deepEqual(r.rows.map(x => x.kind), ['same', 'copy-only', 'vault-only', 'same']);
});
