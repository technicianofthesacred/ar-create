// `ar-create magazine board|story <id>|propose|status`, and the MCP tool listing the magazine.* commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {magazineServer} from './helpers/magazine-server.mjs';
import {apply} from '../tools/magazine/register.mjs';
import {run, SUGAR, USAGE} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';

const NOTES = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md', DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';

test('the magazine shortcut maps to the registry and is listed in --help', () => {
  assert.deepEqual(SUGAR.magazine, {board: 'magazine.board', story: 'magazine.story', propose: 'magazine.write', status: 'magazine.status.table'});
  assert.ok(USAGE.commands.includes('magazine board|story|propose|status'));
});

test('magazine board and magazine status read through the CLI', async t => {
  const s = await magazineServer(t);
  const board = await s.cli(['magazine', 'board']);
  assert.equal(board.exitCode, 0, JSON.stringify(board.result));
  assert.ok(board.result.board.some(row => /Clay Teacher/.test(JSON.stringify(row))));
  const same = await s.cli(['call', 'magazine.board'], {});
  assert.deepEqual(board.result.board, same.result.board, 'the shortcut is the same command');
  const status = await s.cli(['magazine', 'status']);
  const direct = await s.cli(['call', 'magazine.status.table'], {});
  assert.equal(status.exitCode, direct.exitCode);
  assert.deepEqual(status.result, direct.result);
});

test('magazine story <id> reads one story; a bare story or an extra word is a usage error', async t => {
  const s = await magazineServer(t);
  const r = await apply({mag: s.f.vault, files: s.f.files, data: s.f.data, verification: path.join(s.f.dir, 'verification')});
  assert.equal(r.applied, true);
  const story = await s.cli(['magazine', 'story', 'mag-clay-teacher']);
  assert.equal(story.exitCode, 0, JSON.stringify(story.result));
  assert.equal(story.result.draft.path, DEV);
  assert.equal((await s.cli(['magazine', 'story'])).exitCode, 2);
  assert.match((await s.cli(['magazine', 'story'])).result.error, /story <id>/);
  assert.equal((await s.cli(['magazine', 'board', 'extra'])).exitCode, 2);
  assert.equal((await s.cli(['magazine', 'nonsense'])).exitCode, 2);
});

test('magazine propose writes through magazine.write with a fresh operationId; a stale hash is a conflict, never an overwrite', async t => {
  const s = await magazineServer(t);
  const read = await s.cli(['call', 'magazine.read'], {path: NOTES});
  const first = await s.cli(['magazine', 'propose'], {path: NOTES, content: '- a proposed note\n', expectedHash: read.result.hash});
  assert.equal(first.exitCode, 0, JSON.stringify(first.result));
  assert.equal(first.result.written, true);
  assert.match(fs.readFileSync(path.join(s.f.vault, NOTES), 'utf8'), /a proposed note/);
  assert.equal(s.journal().find(l => l.kind === 'magazine.write').actor, 'agent:claude-code');
  const stale = await s.cli(['magazine', 'propose'], {path: NOTES, content: 'x', expectedHash: read.result.hash});
  assert.equal(stale.exitCode, 3);
  // An operationId the caller names is kept (a replay is the same write, not a new one).
  const id = randomUUID(), now = await s.cli(['call', 'magazine.read'], {path: NOTES});
  const named = await s.cli(['magazine', 'propose'], {path: NOTES, content: '- named\n', expectedHash: now.result.hash, operationId: id});
  assert.equal(named.exitCode, 0);
  const again = await s.cli(['magazine', 'propose'], {path: NOTES, content: '- named\n', expectedHash: now.result.hash, operationId: id});
  assert.equal(again.exitCode, 0); assert.equal(again.result.replay, true);
});

test('an agent proposing a draft gets a proposal, not a write: the DEV file is unchanged until Adrian accepts', async t => {
  const s = await magazineServer(t);
  const before = s.hashOf(DEV), read = await s.cli(['call', 'magazine.read'], {path: DEV});
  const proposed = await s.cli(['magazine', 'propose'], {path: DEV, content: read.result.text + '\nA proposed closing line.\n', expectedHash: read.result.hash});
  assert.equal(proposed.exitCode, 0, JSON.stringify(proposed.result));
  assert.equal(s.hashOf(DEV), before, 'prose is proposed, never written');
  assert.ok(proposed.result.proposalId || proposed.result.proposal, JSON.stringify(proposed.result));
});

test('MCP ar_create_list_commands lists every magazine.* command the registry has, with its human-only marks', async t => {
  const s = await magazineServer(t);
  const tools = createTools({url: s.url, actor: 'agent:codex'});
  const listed = await tools.callTool('ar_create_list_commands', {section: 'magazine'});
  const caps = await (await fetch(s.url + '/api/capabilities')).json();
  const registry = caps.commands.filter(c => c.name.startsWith('magazine.')).map(c => c.name).sort();
  assert.ok(registry.length >= 30, 'the magazine surface is there (' + registry.length + ')');
  assert.deepEqual(listed.commands.map(c => c.name).sort(), registry);
  const all = await tools.callTool('ar_create_list_commands', {});
  for (const name of ['magazine.board', 'magazine.story', 'magazine.write', 'magazine.status.table', 'magazine.proposal.accept']) assert.ok(all.commands.some(c => c.name === name), name);
  assert.deepEqual(listed.commands.find(c => c.name === 'magazine.proposal.accept').actors, ['human'], 'agents see which decisions are Adrian\'s');
  const board = await tools.callTool('ar_create_call', {name: 'magazine.board'});
  assert.ok(board.board.length >= 2);
});
