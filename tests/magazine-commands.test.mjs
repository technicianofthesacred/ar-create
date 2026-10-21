import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const sha = b => createHash('sha256').update(b).digest('hex');
export async function magazineServer(t, {writable = true, fixture} = {}) {
  const f = buildMagazineFixture(fixture);
  const server = await createServer({dataDir: f.data, publicDir: path.join(repo, 'public'), researchEnabled: false, magazineVault: {vaultRoot: f.vault, filesRoot: f.files, drops: f.drops, writable, machine: 'studio-mac', exportStaging: path.join(f.dir, 'staging')}});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); f.cleanup(); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const cli = async (args, input, actor = 'agent:claude-code') => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
  const page = async (route, input) => { const r = await fetch(url + route, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-AR-Actor': 'human:adrian', 'X-AR-Client': 'mag-page'}, body: JSON.stringify(input)}); return {status: r.status, body: await r.json()}; };
  const journal = () => { const dir = path.join(f.data, 'journal'); return fs.existsSync(dir) ? fs.readdirSync(dir).flatMap(n => fs.readFileSync(path.join(dir, n), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))) : []; };
  const hashOf = rel => sha(fs.readFileSync(path.join(f.vault, rel)));
  return {f, url, cli, page, journal, hashOf};
}

const EXPECTED = ['magazine.board', 'magazine.read', 'magazine.write', 'magazine.ask.set', 'magazine.ask.answer', 'magazine.edit', 'magazine.drops', 'magazine.drops.claim', 'magazine.lock.status', 'magazine.lock.recover', 'magazine.lock.hold', 'magazine.send-check', 'magazine.send', 'magazine.tidy', 'magazine.tidy.apply', 'magazine.proposals', 'magazine.proposal.accept', 'magazine.undo', 'magazine.status.refresh', 'magazine.status.install', 'magazine.stories', 'brand.read'];

test('every magazine command is in /api/capabilities, with human-only decisions marked', async t => {
  const s = await magazineServer(t);
  const caps = await (await fetch(s.url + '/api/capabilities')).json();
  const names = new Map(caps.commands.map(c => [c.name, c]));
  for (const name of EXPECTED) assert.ok(names.has(name), name);
  for (const name of ['magazine.ask.answer', 'magazine.edit', 'magazine.lock.recover', 'magazine.send', 'magazine.proposal.accept', 'magazine.tidy.apply', 'magazine.status.install']) assert.deepEqual(names.get(name).actors, ['human'], name);
  assert.deepEqual(names.get('magazine.write').actors, ['any']);
  assert.equal(names.get('magazine.board').readOnly, true); assert.equal(names.get('magazine.send-check').readOnly, true);
  assert.equal(names.get('magazine.write').section, 'magazine');
  assert.deepEqual(names.get('magazine.read').schema.query, ['path']);
});

test('an agent writes a note through the CLI; it is journalled with its actor and story, and announced', async t => {
  const s = await magazineServer(t), rel = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md';
  const read = await s.cli(['call', 'magazine.read'], {path: rel});
  assert.equal(read.exitCode, 0, JSON.stringify(read.result)); assert.equal(read.result.kind, 'NOTES');
  const w = await s.cli(['call', 'magazine.write'], {path: rel, content: '- a new note\n', expectedHash: read.result.hash, operationId: randomUUID()});
  assert.equal(w.exitCode, 0, JSON.stringify(w.result)); assert.equal(w.result.written, true);
  const line = s.journal().find(l => l.kind === 'magazine.write');
  assert.equal(line.actor, 'agent:claude-code'); assert.equal(line.client, 'cli'); assert.equal(line.status, 'committed'); assert.deepEqual(line.scope, {kind: 'story', id: 'mag-clay-teacher'});
  const events = await (await fetch(s.url + '/api/events/since?since=0')).json();
  assert.ok(events.events.some(e => e.kind === 'magazine.write' && e.scope.id === 'mag-clay-teacher' && e.actor === 'agent:claude-code'));
  const stale = await s.cli(['call', 'magazine.write'], {path: rel, content: 'x', expectedHash: read.result.hash, operationId: randomUUID()});
  assert.equal(stale.exitCode, 3, 'a stale hash is a conflict (exit 3), never a silent overwrite');
  assert.equal(s.journal().filter(l => l.kind === 'magazine.write').at(-1).status, 'conflict');
});

test('human-only magazine decisions refuse agents (exit 5) and take Adrian from the page', async t => {
  const s = await magazineServer(t), ask = 'Workflow/ASK - Clay Teacher.md';
  const agent = await s.cli(['call', 'magazine.ask.answer'], {path: ask, index: 0, value: 'Open It Together', operationId: randomUUID()});
  assert.equal(agent.exitCode, 5);
  const r = await s.page('/api/magazine/ask/answer', {path: ask, index: 0, value: 'Open It Together', title: 'The title', operationId: randomUUID()});
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.answered, true);
  const line = s.journal().find(l => l.kind === 'magazine.ask.answer' && l.status === 'committed');
  assert.equal(line.actor, 'human:adrian'); assert.equal(line.client, 'mag-page');
});

test('a foreign lock answers 423 through the CLI (exit 4) with the holder', async t => {
  const s = await magazineServer(t, {fixture: {foreignLock: {machine: 'innerstellar'}}}), rel = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md';
  const w = await s.cli(['call', 'magazine.write'], {path: rel, content: 'x', expectedHash: s.hashOf(rel), operationId: randomUUID()});
  assert.equal(w.exitCode, 4); assert.equal(w.result.details.holder.machine, 'innerstellar');
  const status = await s.cli(['call', 'magazine.lock.status'], {});
  assert.equal(status.result.state, 'busy');
});

test('the board through the CLI shows the stories and the read-only switch', async t => {
  const s = await magazineServer(t, {writable: false});
  const b = await s.cli(['call', 'magazine.board'], {});
  assert.equal(b.exitCode, 0); assert.equal(b.result.writable, false);
  assert.ok(b.result.board.some(x => x.story === 'River Potter'));
  const rel = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md';
  const w = await s.cli(['call', 'magazine.write'], {path: rel, content: 'x', expectedHash: s.hashOf(rel), operationId: randomUUID()});
  assert.equal(w.exitCode, 1); assert.equal(w.result.status, 503);
});

test('the STATUS story table is installed once by Adrian, then refreshed by anyone, touching nothing else', async t => {
  const s = await magazineServer(t);
  const before = fs.readFileSync(path.join(s.f.vault, 'STATUS.md'), 'utf8');
  assert.equal((await s.cli(['call', 'magazine.status.refresh'], {operationId: randomUUID()})).exitCode, 3, 'no table yet: a conflict that says to install it');
  assert.equal((await s.cli(['call', 'magazine.status.install'], {expectedHash: s.hashOf('STATUS.md'), operationId: randomUUID()})).exitCode, 5);
  assert.equal((await s.page('/api/magazine/status/install', {expectedHash: s.hashOf('STATUS.md'), operationId: randomUUID()})).status, 200);
  const r = await s.cli(['call', 'magazine.status.refresh'], {operationId: randomUUID()});
  assert.equal(r.exitCode, 0, JSON.stringify(r.result));
  const after = fs.readFileSync(path.join(s.f.vault, 'STATUS.md'), 'utf8');
  assert.match(after, /\| 1 \| Clay Teacher \| \d+ of 12, [^|]+ \| you \|/);
  const strip = text => text.replace(/\n?<!-- ar-create:story-table:start[\s\S]*?ar-create:story-table:end -->\n?/, '');
  assert.equal(strip(after).replace(/\n+/g, '\n'), before.replace(/\n+/g, '\n'), 'every line outside the table is unchanged');
});
