import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {magazineServer} from './helpers/magazine-server.mjs';
import {main} from '../tools/magazine/mag.mjs';

const original = path.join(os.homedir(), 'builds', 'mag-status.mjs');
async function mag(s, args, actor = 'agent:claude-code') { let text = ''; const code = await main(args, {env: {AR_CREATE_URL: s.url, AR_CREATE_ACTOR: actor}, out: t => { text += t; }}); return {code, text}; }

test('/mag status through AR Create shows the same board lines as mag-status.mjs', {skip: !fs.existsSync(original) && 'mag-status.mjs is not on this machine'}, async t => {
  const s = await magazineServer(t);
  const theirs = execFileSync(process.execPath, [original], {env: {...process.env, MAG_VAULT: s.f.vault, MAG_FILES: s.f.files, MAG_DROPS: s.f.drops.join('|')}, encoding: 'utf8'});
  const ours = await mag(s, ['board']);
  assert.equal(ours.code, 0);
  assert.equal(ours.text.trimEnd(), theirs.trimEnd());
});

test('the thin client reads, writes with the hash it read, gets 409 (exit 3) on a stale hash, and a draft becomes a proposal', async t => {
  const s = await magazineServer(t), notes = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md', tmp = path.join(s.f.dir, 'n.md');
  const r = await mag(s, ['read', notes, '--out', tmp]); assert.equal(r.code, 0);
  const {hash} = JSON.parse(r.text);
  fs.appendFileSync(tmp, '- from the session\n');
  assert.equal((await mag(s, ['put', notes, '--from', tmp, '--expect', hash])).code, 0);
  assert.match(fs.readFileSync(path.join(s.f.vault, notes), 'utf8'), /from the session/);
  assert.equal((await mag(s, ['put', notes, '--from', tmp, '--expect', hash])).code, 3);
  assert.equal((await mag(s, ['put', notes, '--from', tmp])).code, 2, 'put without --expect or --new is refused');
  const dev = 'Workflow/3-Develop/DEV - Clay Teacher (story).md', d = path.join(s.f.dir, 'd.md');
  const rd = JSON.parse((await mag(s, ['read', dev, '--out', d])).text);
  fs.appendFileSync(d, '\nA new line.\n');
  const p = await mag(s, ['put', dev, '--from', d, '--expect', rd.hash, '--reason', 'editor pass']);
  assert.equal(p.code, 0); assert.equal(JSON.parse(p.text).proposed, true);
  assert.doesNotMatch(fs.readFileSync(path.join(s.f.vault, dev), 'utf8'), /A new line/);
  const hold = await mag(s, ['hold', '/mag resume']); assert.equal(hold.code, 0, hold.text);
  assert.match(fs.readFileSync(path.join(s.f.vault, 'Workflow/_mag-running.md'), 'utf8'), /^holder: ar-create$/m);
  assert.equal((await mag(s, ['release'])).code, 0);
  assert.ok(!fs.existsSync(path.join(s.f.vault, 'Workflow/_mag-running.md')));
});
