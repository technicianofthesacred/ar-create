#!/usr/bin/env node
// node-pty's spawn-helper must be executable, or every terminal dies.
//
// On macOS node-pty does not exec your command directly: it runs a small
// `spawn-helper` binary that sets up the pty first. That helper ships in the
// package's prebuilds, and it arrives WITHOUT its execute bit on this machine —
// so every spawn fails with the same unhelpful line, `posix_spawnp failed`,
// whatever you were trying to run.
//
// Found 2026-09-02, and it had nothing to do with what it looked like. The
// writing room's terminal reported "The room is error. posix_spawnp failed."
// and the obvious readings were all wrong: not the Claude account, not a
// missing CLI, not PATH. node-pty could not spawn `/bin/echo` either. The
// helper's permissions were `rw-r--r--`.
//
// This runs after every install so a reinstall cannot quietly take the terminal
// away again. It is deliberately silent when there is nothing to do, and it
// never fails the install — a permissions repair must not be able to break
// `npm install` for everyone.

import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PREBUILDS = 'node_modules/node-pty/prebuilds';

function main() {
  if (!existsSync(PREBUILDS)) return; // node-pty not installed here; nothing to do.

  const repaired = [];
  for (const platform of readdirSync(PREBUILDS)) {
    const helper = join(PREBUILDS, platform, 'spawn-helper');
    if (!existsSync(helper)) continue;
    const mode = statSync(helper).mode;
    // Already executable by the owner: leave it alone.
    if (mode & 0o100) continue;
    chmodSync(helper, mode | 0o755);
    repaired.push(helper);
  }

  if (repaired.length > 0) {
    console.log(`node-pty: restored the execute bit on ${repaired.length} spawn-helper binary(ies).`);
    console.log('Without it every terminal fails with "posix_spawnp failed".');
  }
}

try {
  main();
} catch (error) {
  // Never fail an install over this.
  console.warn(`node-pty permission check skipped: ${error instanceof Error ? error.message : error}`);
}
