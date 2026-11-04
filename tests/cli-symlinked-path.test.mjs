// The CLIs must run when reached through a symlinked folder (/tmp and $TMPDIR
// are symlinks on macOS). Before this, the entry check compared the symlinked
// argv[1] with the resolved module URL, saw a mismatch and silently did nothing,
// which made the release script report "unsaved words" that did not exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the agent CLI answers when its folder is reached through a symlink', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-link-'));
  const link = path.join(dir, 'repo');
  fs.symlinkSync(repo, link);
  try {
    const run = spawnSync(process.execPath, [path.join(link, 'agents/cli/ar-create.mjs')], { encoding: 'utf8', timeout: 20000 });
    assert.notEqual(run.stdout.trim(), '', 'the CLI printed nothing through the symlinked path');
    const answer = JSON.parse(run.stdout);
    assert.equal(answer.ok, false);
    assert.match(answer.usage, /ar-create\.mjs/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
