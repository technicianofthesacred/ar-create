import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {readBoard, boardText} from '../runtime/services/magazine-vault/board.mjs';

// The original lives outside the repo; it is only run (read-only, against the synthetic vault).
const original = path.join(os.homedir(), 'builds', 'mag-status.mjs');

test('magazine.board equals ~/builds/mag-status.mjs on the same vault (JSON and text)', {skip: !fs.existsSync(original) && 'mag-status.mjs is not on this machine'}, t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const env = {...process.env, MAG_VAULT: f.vault, MAG_FILES: f.files, MAG_DROPS: f.drops.join('|')};
  const theirs = JSON.parse(execFileSync(process.execPath, [original, '--json'], {env, encoding: 'utf8'}));
  const ours = readBoard({vault: f.vault, files: f.files, drops: f.drops});
  assert.deepEqual(ours.board.map(({files, ...rest}) => rest), theirs.board);
  for (const key of ['inbox', 'drop', 'unmatched', 'errors', 'steps', 'who']) assert.deepEqual(ours[key], theirs[key], key);
  const text = execFileSync(process.execPath, [original], {env, encoding: 'utf8'});
  assert.equal(boardText(ours, {date: text.match(/\((\d{4}-\d{2}-\d{2})\)/)[1]}), text);
});
