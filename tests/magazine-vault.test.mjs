import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createJournal} from '../runtime/services/journal.mjs';
import {createLeases} from '../runtime/services/leases.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import * as edits from '../runtime/reference/mag-edit.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const AGENT = {actor: 'agent:claude-code', client: 'cli'}, ADRIAN = {actor: 'human:adrian', client: 'mag-page'};
const as = (who, fn) => withActor(who, fn);
function setup(t, options = {}) {
  const f = buildMagazineFixture(options.fixture); t.after(f.cleanup);
  const journal = createJournal({dataDir: f.data}), leases = createLeases({dataDir: f.data});
  const vault = createMagazineVault({vaultRoot: f.vault, filesRoot: f.files, drops: f.drops, writable: options.writable ?? true, dataDir: f.data, machine: 'studio-mac', journal, leases, ...(options.vault || {})});
  const read = rel => fs.readFileSync(path.join(f.vault, rel), 'utf8');
  const hashOf = rel => sha(fs.readFileSync(path.join(f.vault, rel)));
  return {f, vault, read, hashOf, journal, leases};
}
const NOTES = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md', DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';

test('a working note saves directly with compare-and-swap; a stale hash answers 409 and changes nothing', async t => {
  const {f, vault, read, hashOf} = setup(t);
  const h = hashOf(NOTES);
  const ok = await as(AGENT, () => vault.write({path: NOTES, content: '- one note\n- two\n', expectedHash: h, operationId: randomUUID()}));
  assert.equal(ok.written, true); assert.equal(read(NOTES), '- one note\n- two\n'); assert.equal(ok.beforeHash, h);
  const before = treeHashes(f.vault);
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: h, operationId: randomUUID()})), e => e.status === 409);
  assert.deepEqual(treeHashes(f.vault), before);
  assert.ok(!fs.existsSync(path.join(f.vault, 'Workflow/_mag-running.md')), 'the transaction lock is gone after the write');
});

test('the same operationId replays the same result and refuses a different input', async t => {
  const {vault, hashOf} = setup(t), op = randomUUID(), h = hashOf(NOTES);
  const a = await as(AGENT, () => vault.write({path: NOTES, content: 'A\n', expectedHash: h, operationId: op}));
  const b = await as(AGENT, () => vault.write({path: NOTES, content: 'A\n', expectedHash: h, operationId: op}));
  assert.equal(b.replay, true); assert.equal(b.hash, a.hash);
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'B\n', expectedHash: h, operationId: op})), e => e.status === 409);
});

test('only Workflow working files are writable: rule files, Writing/, style, templates and the archive are refused', async t => {
  const {vault} = setup(t);
  for (const p of ['SYSTEM.md', 'TEMPLATE.md', 'Writing/Essay.md', 'Workflow/_style/gold-clay.md', 'Workflow/2-Guidance/MAP TEMPLATE.md', '_archive/old.md', 'Workflow/_mag-running.md', 'Elsewhere/x.md'])
    await assert.rejects(as(AGENT, () => vault.write({path: p, content: 'x', expectedHash: null, operationId: randomUUID()})), e => e.status === 403, p);
  for (const p of ['../outside.md', 'Workflow/.hidden.md', 'Workflow/3-Develop/DEV - X.sync-conflict-20261021-ABC.md'])
    await assert.rejects(as(AGENT, () => vault.write({path: p, content: 'x', expectedHash: null, operationId: randomUUID()})), e => e.status === 400, p);
  await assert.rejects(as(AGENT, () => vault.write({path: 'STATUS.md', content: 'x', expectedHash: null, operationId: randomUUID()})), e => e.status === 403 && /story table/.test(e.message));
  await assert.rejects(as(AGENT, () => vault.write({path: 'Workflow/4-Review/EDITS - DEV - Clay Teacher (story).md', content: 'x', expectedHash: null, operationId: randomUUID()})), e => e.status === 403);
});

test('RAW is written once: a second write or an overwrite is refused', async t => {
  const {vault, read} = setup(t), rel = 'Workflow/0-Inbox/RAW - Stone Carver.md';
  await as(AGENT, () => vault.write({path: rel, content: '# RAW – Stone Carver\n', expectedHash: null, operationId: randomUUID()}));
  await assert.rejects(as(AGENT, () => vault.write({path: rel, content: 'again', expectedHash: null, operationId: randomUUID()})), e => e.status === 409);
  await assert.rejects(as(AGENT, () => vault.write({path: rel, content: 'over', expectedHash: sha(Buffer.from('# RAW – Stone Carver\n')), operationId: randomUUID()})), e => e.status === 403);
  assert.equal(read(rel), '# RAW – Stone Carver\n');
});

test('an agent\'s draft words become a proposal; Adrian accepts it; a stale proposal is never written', async t => {
  const {vault, read, hashOf} = setup(t), h = hashOf(DEV), before = read(DEV);
  const p = await as(AGENT, () => vault.write({path: DEV, content: before + '\nA proposed line.\n', expectedHash: h, operationId: randomUUID(), reason: 'editor pass'}));
  assert.equal(p.proposed, true); assert.equal(read(DEV), before, 'the draft is untouched until Adrian says yes');
  await assert.rejects(as(AGENT, () => vault.proposalAccept({proposalId: p.proposalId, operationId: randomUUID()})), e => e.status === 403);
  const accepted = await as(ADRIAN, () => vault.proposalAccept({proposalId: p.proposalId, operationId: randomUUID()}));
  assert.equal(accepted.written, true); assert.ok(read(DEV).endsWith('A proposed line.\n'));
  const q = await as(AGENT, () => vault.write({path: DEV, content: 'Another try.\n', expectedHash: hashOf(DEV), operationId: randomUUID()}));
  await as(ADRIAN, () => vault.write({path: DEV, content: read(DEV) + '\nAdrian typed this.\n', expectedHash: hashOf(DEV), operationId: randomUUID()}));
  await assert.rejects(as(ADRIAN, () => vault.proposalAccept({proposalId: q.proposalId, operationId: randomUUID()})), e => e.status === 409 && /stale/.test(e.message));
  assert.ok(read(DEV).endsWith('Adrian typed this.\n'));
  assert.equal(vault.proposalList({status: 'stale'}).proposals.length, 1);
});

test('a made post may be written directly only while it waits for his yes', async t => {
  const {vault, read, hashOf} = setup(t), rel = 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire.md';
  const waiting = read(rel).replace('A village opens its kiln.', 'A village opens its kiln together.');
  assert.equal((await as(AGENT, () => vault.write({path: rel, content: waiting, expectedHash: hashOf(rel), operationId: randomUUID()}))).written, true);
  const approvedText = read(rel).replace('status: for-your-yes', 'status: approved');
  assert.equal((await as(AGENT, () => vault.write({path: rel, content: approvedText, expectedHash: hashOf(rel), operationId: randomUUID()}))).proposed, true);
});

test('undo restores the exact bytes, refuses after a newer change, and agents undo only their own notes', async t => {
  const {vault, read, hashOf} = setup(t), original = read(NOTES);
  const w = await as(AGENT, () => vault.write({path: NOTES, content: 'changed\n', expectedHash: hashOf(NOTES), operationId: randomUUID()}));
  await assert.rejects(as({actor: 'agent:codex', client: 'cli'}, () => vault.undo({undoOperationId: w.operationId, operationId: randomUUID()})), e => e.status === 403);
  await as(AGENT, () => vault.undo({undoOperationId: w.operationId, operationId: randomUUID()}));
  assert.equal(read(NOTES), original);
  const w2 = await as(AGENT, () => vault.write({path: NOTES, content: 'again\n', expectedHash: hashOf(NOTES), operationId: randomUUID()}));
  await as(AGENT, () => vault.write({path: NOTES, content: 'newer\n', expectedHash: hashOf(NOTES), operationId: randomUUID()}));
  await assert.rejects(as(ADRIAN, () => vault.undo({undoOperationId: w2.operationId, operationId: randomUUID()})), e => e.status === 409);
  assert.equal(read(NOTES), 'newer\n');
  const created = await as(AGENT, () => vault.write({path: 'Workflow/3-Develop/RESEARCH - River Potter.md', content: '- found\n', expectedHash: null, operationId: randomUUID()}));
  const undoOp = randomUUID();
  await as(AGENT, () => vault.undo({undoOperationId: created.operationId, operationId: undoOp}));
  assert.equal(vault.read({path: 'Workflow/3-Develop/RESEARCH - River Potter.md'}).exists, false);
  assert.equal(fs.readFileSync(path.join(vault._dirs.undone, undoOp, 'RESEARCH - River Potter.md'), 'utf8'), '- found\n', 'an undone new file is kept, not deleted');
});

test('a foreign live lock answers 423 with the holder and writes nothing; an old one needs Adrian to clear it', async t => {
  const {f, vault, hashOf} = setup(t, {fixture: {foreignLock: {machine: 'innerstellar'}}});
  const before = treeHashes(f.vault);
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: hashOf(NOTES), operationId: randomUUID()})), e => e.status === 423 && e.holder.machine === 'innerstellar' && /innerstellar/.test(e.message));
  assert.deepEqual(treeHashes(f.vault), before);
  const lockFile = path.join(f.vault, 'Workflow/_mag-running.md');
  fs.writeFileSync(lockFile, `machine: innerstellar\nsince: ${new Date(Date.now() - 3 * 3600_000).toISOString()}\ndoing: step 5\n`);
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: hashOf(NOTES), operationId: randomUUID()})), e => e.status === 423 && e.lockState === 'needs-recovery');
  const status = vault.lockStatus(); assert.equal(status.state, 'needs-recovery');
  await assert.rejects(as(AGENT, () => vault.lockRecover({expectedHash: status.holder.hash})), e => e.status === 403);
  await assert.rejects(as(ADRIAN, () => vault.lockRecover({expectedHash: '0'.repeat(64)})), e => e.status === 409);
  assert.equal((await as(ADRIAN, () => vault.lockRecover({expectedHash: status.holder.hash}))).recovered, true);
  assert.equal((await as(AGENT, () => vault.write({path: NOTES, content: 'x\n', expectedHash: hashOf(NOTES), operationId: randomUUID()}))).written, true);
});

test('a lock this machine\'s AR Create left behind (its process gone) is recovered automatically and journalled', async t => {
  const {f, vault, hashOf, journal} = setup(t);
  fs.writeFileSync(path.join(f.vault, 'Workflow/_mag-running.md'), `machine: studio-mac\nsince: ${new Date().toISOString()}\ndoing: a write\nholder: ar-create\npid: 999999\nboot: old-boot\nmode: transaction\n`);
  assert.equal((await as(AGENT, () => vault.write({path: NOTES, content: 'x\n', expectedHash: hashOf(NOTES), operationId: randomUUID()}))).written, true);
  const lines = (await journal.read({})).lines;
  assert.ok(lines.some(l => l.kind === 'magazine.lock.recovered'));
  assert.equal(fs.readdirSync(vault._dirs['recovered-locks']).length, 1);
});

test('a /mag session lock on this Mac (not AR Create) is respected, not recovered', async t => {
  const {f, vault, hashOf} = setup(t);
  fs.writeFileSync(path.join(f.vault, 'Workflow/_mag-running.md'), `machine: studio-mac\nsince: ${new Date().toISOString()}\ndoing: step 3\n`);
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: hashOf(NOTES), operationId: randomUUID()})), e => e.status === 423);
});

test('a session hold shows other machines the run, lets our own writes through, and releases', async t => {
  const {f, vault, hashOf} = setup(t);
  await as(AGENT, () => vault.lockHold({doing: '/mag resume'}));
  const text = fs.readFileSync(path.join(f.vault, 'Workflow/_mag-running.md'), 'utf8');
  assert.match(text, /^machine: studio-mac$/m); assert.match(text, /^holder: ar-create$/m); assert.match(text, /^mode: session$/m);
  assert.equal((await as(AGENT, () => vault.write({path: NOTES, content: 'x\n', expectedHash: hashOf(NOTES), operationId: randomUUID()}))).written, true);
  assert.ok(fs.existsSync(path.join(f.vault, 'Workflow/_mag-running.md')), 'our own write does not drop the session hold');
  await vault.lockRelease();
  assert.ok(!fs.existsSync(path.join(f.vault, 'Workflow/_mag-running.md')));
});

test('read-only mode (writable:false) refuses every write with 503', async t => {
  const {f, vault, hashOf} = setup(t, {writable: false}), before = treeHashes(f.vault);
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: hashOf(NOTES), operationId: randomUUID()})), e => e.status === 503);
  assert.deepEqual(treeHashes(f.vault), before);
  assert.ok(vault.board().board.length >= 2, 'reading still works');
});

test('a Syncthing conflict copy beside a file blocks writing it', async t => {
  const {f, vault, hashOf} = setup(t);
  fs.writeFileSync(path.join(f.vault, 'Workflow/3-Develop/NOTES - Clay Teacher (story).sync-conflict-20261021-120000-ABCDEFG.md'), 'other machine\n');
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: hashOf(NOTES), operationId: randomUUID()})), e => e.status === 409 && /conflict copy/.test(e.message));
});

test('a story lease held by someone else answers 423 before any byte changes', async t => {
  const {vault, hashOf, leases} = setup(t);
  await leases.acquire({scope: {kind: 'story', id: 'mag-clay-teacher'}, reason: 'editor pass'}, {actor: 'agent:codex', client: 'cli'});
  await assert.rejects(as(AGENT, () => vault.write({path: NOTES, content: 'x', expectedHash: hashOf(NOTES), operationId: randomUUID()})), e => e.status === 423);
});

test('Adrian\'s page edit goes through the unchanged mag-edit donor: the paragraph changes and EDITS logs it', async t => {
  const {vault, read} = setup(t);
  const {parts} = edits.splitBlocks(read(DEV));
  const index = parts.findIndex((p, i) => i % 2 === 0 && p.includes('I met Mira')) / 2;
  await assert.rejects(as(AGENT, () => vault.edit({path: DEV, block: index, seen: edits.hash(parts[index * 2]), text: 'x', operationId: randomUUID()})), e => e.status === 403);
  const r = await as(ADRIAN, () => vault.edit({path: DEV, block: index, seen: edits.hash(parts[index * 2]), text: 'I met Mira at the edge of the village, by the kilns.', operationId: randomUUID()}));
  assert.equal(r.changed, true); assert.match(read(DEV), /by the kilns\./);
  const log = read('Workflow/4-Review/EDITS - DEV - Clay Teacher (story).md');
  assert.match(log, /- before: I met Mira at the edge of the village, where the kilns stand in a row\./); assert.match(log, /- after: I met Mira at the edge of the village, by the kilns\./);
  await assert.rejects(as(ADRIAN, () => vault.edit({path: DEV, block: index, seen: edits.hash(parts[index * 2]), text: 'stale', operationId: randomUUID()})), e => e.status === 409);
});

test('an answer on the page ticks the ASK option and records the decision on the map, through the unchanged mag-ask donor', async t => {
  const {vault, read} = setup(t);
  await assert.rejects(as(AGENT, () => vault.askAnswer({path: 'Workflow/ASK - Clay Teacher.md', index: 0, value: 'Open It Together', operationId: randomUUID()})), e => e.status === 403);
  await assert.rejects(as(ADRIAN, () => vault.askAnswer({path: 'Workflow/ASK - Clay Teacher.md', index: 0, value: 'Open It Together', title: 'Another question', operationId: randomUUID()})), e => e.status === 409);
  const r = await as(ADRIAN, () => vault.askAnswer({path: 'Workflow/ASK - Clay Teacher.md', index: 0, value: 'Open It Together', title: 'The title', operationId: randomUUID()}));
  assert.equal(r.answered, true); assert.equal(r.recorded, 'Workflow/2-Guidance/MAP - Clay Teacher.md');
  assert.match(read('Workflow/ASK - Clay Teacher.md'), /- \[x\] Open It Together/);
  assert.match(read('Workflow/2-Guidance/MAP - Clay Teacher.md'), /The title: Open It Together \(picked on the magazine page\)/);
  const op = vault.operation({operationId: r.operationId}); assert.equal(op.changes.length, 2); assert.equal(op.actor, 'human:adrian');
});

test('page requests, feedback, lineup and approval are applied under the lock; lineup and approval need the hash the page saw', async t => {
  const {vault, read, hashOf} = setup(t), made = 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire.md';
  await as(ADRIAN, () => vault.requestsAdd({kind: 'Post', story: 'Clay Teacher', operationId: randomUUID()}));
  assert.equal((await as(ADRIAN, () => vault.requestsAdd({kind: 'Post', story: 'Clay Teacher', operationId: randomUUID()}))).changed, false, 'the same open request is not added twice');
  await as(ADRIAN, () => vault.requestsAdd({step: 'Map', story: 'River Potter', operationId: randomUUID()}));
  assert.match(read('Workflow/5-Social/REQUESTS.md'), /- \[ \] \d{4}-\d{2}-\d{2} Post · Clay Teacher\n- \[ \] \d{4}-\d{2}-\d{2} Redo Map · River Potter\n/);
  await as(ADRIAN, () => vault.pageFeedback({story: 'Clay Teacher', step: '4', q: 'The title', value: 'no', note: 'needs the map', operationId: randomUUID()}));
  assert.match(read('Workflow/_page-feedback.md'), /Clay Teacher · step 4 · The title · NEEDS MORE: needs the map/);
  await assert.rejects(as(ADRIAN, () => vault.lineupSave({path: made, slides: [], caption: '', expectedHash: '0'.repeat(64), operationId: randomUUID()})), e => e.status === 409);
  await as(ADRIAN, () => vault.lineupSave({path: made, slides: [{role: 'cover', text: 'Kind fire'}], caption: 'New caption', expectedHash: hashOf(made), operationId: randomUUID()}));
  assert.match(read(made), /## Slides\n\n1\. \[cover\] Kind fire\n\n## Caption\n\nNew caption\n/);
  await as(ADRIAN, () => vault.approve({path: made, value: 'words', expectedHash: hashOf(made), operationId: randomUUID()}));
  assert.match(read(made), /^status: words-yes$/m);
});

test('the board reads like mag-status and carries the lock and open proposals', async t => {
  const {vault} = setup(t);
  const b = vault.board();
  assert.ok(b.board.some(s => s.story === 'Clay Teacher' && s.open === 2));
  assert.match(b.text, /- Clay Teacher: step \d+ of 12/);
  assert.equal(b.lock.state, 'free'); assert.deepEqual(b.proposals, []);
  assert.ok(b.drop.some(d => d.name === 'Stone Carver.txt'));
});
