import fs from 'node:fs';
import path from 'node:path';
import { StateError } from '../store.mjs';
import { atomicWrite, readJson, digest, resolveInside, regular } from './files.mjs';

// WordForge stack/template-files discipline: stable files, humanizing pointers,
// whole-body revision fingerprints. Copies seed once; projects reference files.
export function createGuidance({ dataDir, referenceDir }) {
  const dir = path.join(dataDir, 'guidance');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); resolveInside(dir, '', { directory: true });
  const names = { voice: 'voice-profile.md', positions: 'body-of-work.md', recipe: 'recipe.md' };
  const paths = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, path.join(dir, name)]));
  for (const [key, name] of Object.entries(names)) {
    if (!fs.lstatSync(paths[key], { throwIfNoEntry: false })) {
      let body = '';
      const reference = path.join(referenceDir, name);
      if (fs.existsSync(reference)) { regular(reference); body = fs.readFileSync(reference, 'utf8'); }
      // No invented recipe. Empty until an actual recipe is deliberately accepted.
      atomicWrite(paths[key], body, { exclusive: true });
    }
  }
  let pending = Promise.resolve();
  function read() {
    const bodies = {};
    for (const key of Object.keys(paths)) { resolveInside(dir, names[key]); regular(paths[key]); bodies[key] = fs.readFileSync(paths[key], 'utf8'); }
    const revision = digest(JSON.stringify(bodies));
    return { revision, ...bodies, paths, refs: Object.fromEntries(Object.keys(paths).map(key => [key, { id: `shared:${key}`, scope: 'shared', path: paths[key], hash: digest(bodies[key]) }])) };
  }
  return {
    get: async () => read(),
    put(input) {
      const op = pending.then(() => {
        if (!Object.hasOwn(paths, input.key) || typeof input.body !== 'string' || input.body.length > 256 * 1024) throw new StateError('Choose voice, positions or recipe and provide guidance text.');
        const current = read(); if (input.expectedRevision !== current.revision) throw new StateError('Shared guidance changed. Reload before saving.', 409);
        const history = path.join(dir, 'history'); fs.mkdirSync(history, { recursive: true, mode: 0o700 }); resolveInside(history, '', { directory: true });
        atomicWrite(path.join(history, `${input.key}-${current.refs[input.key].hash}.md`), current[input.key]);
        atomicWrite(paths[input.key], input.body); return read();
      }); pending = op.catch(() => {}); return op;
    },
  };
}
