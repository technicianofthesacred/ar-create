import fs from 'node:fs';
import path from 'node:path';

const SHA = /^[a-f0-9]{7,40}$/;

/**
 * Which commit an installed (git-less) program is. Used only when the program has no `.git` to read.
 * 1. the `release` record serve.mjs already read from <home>/RELEASE.json and passed to createServer;
 * 2. else <home>/RELEASE.json itself, where <home> is the parent of an installed `service/` directory.
 * Returns a lowercase hex sha or null; never throws.
 */
export function releaseSha(serviceDir, release = null) {
  if (typeof release?.sha === 'string' && SHA.test(release.sha)) return release.sha;
  try {
    if (path.basename(serviceDir) !== 'service') return null;
    const record = JSON.parse(fs.readFileSync(path.join(path.dirname(serviceDir), 'RELEASE.json'), 'utf8'));
    return typeof record?.sha === 'string' && SHA.test(record.sha) ? record.sha : null;
  } catch { return null; }
}
