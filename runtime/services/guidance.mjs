import fs from 'node:fs';
import path from 'node:path';
import {provenance} from './actor.mjs';
import {guidanceRegions} from '../public/lib/guidance-body.js';
import { StateError } from '../store.mjs';
import { atomicWrite, readJson, digest, resolveInside, regular } from './files.mjs';

// The i64os directions hold Adrian's voice in one copy (3 November 2026).
const I64OS_FILES = { voice: 'voice-profile.md', positions: 'body-of-work.md' };

// Where the i64os checkout keeps the directions, relative to the user's home, in the order they are tried.
export const DEFAULT_DIRECTIONS_LOCATIONS = [
  ['Documents', 'Files', '4 Coding', 'i64os', 'substrate', 'directions'],
  ['Documents', 'Files', '2 Areas', 'Coding', 'i64os', 'substrate', 'directions']
];

/** The first known i64os directions folder under `home`. One holding both voice files wins; otherwise the first
 * folder that exists, so a half-present checkout fails openly (503 on read) instead of silently using stale copies. */
export function defaultDirectionsDir(home) {
  if (typeof home !== 'string' || !path.isAbsolute(home)) return null;
  const found = DEFAULT_DIRECTIONS_LOCATIONS.map(parts => path.join(home, ...parts)).filter(dir => fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory());
  const whole = found.find(dir => Object.values(I64OS_FILES).every(name => fs.statSync(path.join(dir, name), { throwIfNoEntry: false })?.isFile()));
  return whole ?? found[0] ?? null;
}

/** Where AR Create reads the voice: a server option, else data/i64os-directions.json (the override), else the
 * i64os checkout's substrate/directions at a known location under `home`, else none (the local copies). */
export function resolveVoiceSource({ dataDir, option, home }) {
  let directionsDir = option;
  if (directionsDir === undefined) {
    const file = path.join(dataDir, 'i64os-directions.json');
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat) {
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('i64os directions config must be an owned regular file.');
      directionsDir = JSON.parse(fs.readFileSync(file, 'utf8'))?.directionsDir ?? null;
    } else {
      directionsDir = defaultDirectionsDir(home);
    }
  }
  if (directionsDir === null || directionsDir === false) return null;
  if (typeof directionsDir !== 'string' || !path.isAbsolute(directionsDir)) throw new Error('i64os directionsDir must be an absolute path.');
  return { kind: 'i64os', directionsDir };
}

// WordForge stack/template-files discipline: stable files, humanizing pointers,
// whole-body revision fingerprints. Copies seed once; projects reference files.
// With a voice source, voice and positions are read from the i64os directions
// (read-only here) and the local copies are no longer used. Recipe stays local.
export function createGuidance({ dataDir, referenceDir, voiceSource = null }) {
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
  const external = key => voiceSource?.kind === 'i64os' && Object.hasOwn(I64OS_FILES, key);
  const sourceOf = key => external(key)
    ? { kind: 'i64os', path: path.join(voiceSource.directionsDir, I64OS_FILES[key]), readOnly: true }
    : { kind: key === 'recipe' ? 'ar-create' : 'ar-create-copy', path: paths[key], readOnly: false };
  let pending = Promise.resolve();
  function read() {
    const bodies = {}, sources = {}, readPaths = {};
    for (const key of Object.keys(paths)) {
      sources[key] = sourceOf(key); readPaths[key] = sources[key].path;
      if (external(key)) {
        try { regular(readPaths[key]); bodies[key] = fs.readFileSync(readPaths[key], 'utf8'); }
        catch { throw new StateError(`Your voice lives in i64os, and ${I64OS_FILES[key]} could not be read at ${voiceSource.directionsDir}. Writing guidance is unavailable until it can.`, 503); }
      } else { resolveInside(dir, names[key]); regular(paths[key]); bodies[key] = fs.readFileSync(paths[key], 'utf8'); }
    }
    const revision = digest(JSON.stringify(bodies));
    return { revision, ...bodies, paths: readPaths, sources, editable: Object.fromEntries(Object.entries(bodies).map(([key, body]) => [key, guidanceRegions(body)])), refs: Object.fromEntries(Object.keys(paths).map(key => [key, { id: `shared:${key}`, scope: 'shared', path: readPaths[key], hash: digest(bodies[key]) }])) };
  }
  return {
    get: async () => read(),
    put(input) {
      const op = pending.then(() => {
        if (!Object.hasOwn(paths, input.key)) throw new StateError('Choose voice, positions or recipe.');
        // One copy: AR Create never edits the i64os voice files. Draft edits queue as voice corrections instead.
        if (external(input.key)) throw new StateError('Your voice lives in i64os and is read-only here. Changes to drafts queue as voice corrections you approve.', 409);
        const editing = input.acceptedRegions !== undefined;
        const current = read();
        let body = input.body, receiptFile, fingerprint, receipt;
        if (editing) {
          if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.operationId || '')) throw new StateError('A fresh operation ID is required.');
          if (!Array.isArray(input.acceptedRegions) || input.acceptedRegions.some(value => typeof value !== 'string')) throw new StateError('Provide ordinary guidance text.');
          const operations = path.join(dir, 'operations'); fs.mkdirSync(operations, {recursive:true,mode:0o700}); resolveInside(operations,'',{directory:true});
          receiptFile = path.join(operations, input.operationId + '.json');
          fingerprint = digest(JSON.stringify(input)); receipt = readJson(receiptFile, null);
          if (receipt && receipt.fingerprint !== fingerprint) throw new StateError('This operation ID already belongs to another guidance edit.',409);
          if (receipt && (receipt.status === 'saved' || current[input.key] === receipt.body)) {
            if (receipt.status !== 'saved') atomicWrite(receiptFile,JSON.stringify({...receipt,status:'saved'}));
            return {...current,operationId:input.operationId,operationApplied:true};
          }
          if (input.expectedHash !== current.refs[input.key].hash) throw new StateError('This guidance file changed. Compare your recovery text with the current sheet.',409);
          const projection = current.editable[input.key]; let index = 0;
          if (input.acceptedRegions.length !== projection.regions.filter(region=>!region.pending).length) throw new StateError('Guidance sections changed. Reopen the sheet.',409);
          if (input.acceptedRegions.some(value=>/<!--\s*VOICE-QUEUE-(?:START|END)\s*-->|^ {0,3}#{1,6}[ \t]+Strengthenings[ \t]+queue\b/im.test(value))) throw new StateError('Pending queue markers belong to the read-only suggestions.');
          body = projection.prefix + projection.regions.map(region=>region.pending?region.raw:input.acceptedRegions[index++]).join('');
          // Edits may not change accepted/pending boundaries through Markdown fences or headings.
          const after = guidanceRegions(body);
          if (JSON.stringify(after.regions.filter(region=>region.pending).map(region=>region.raw)) !== JSON.stringify(projection.regions.filter(region=>region.pending).map(region=>region.raw)) || after.prefix !== projection.prefix) throw new StateError('This edit changes pending suggestions or metadata. Keep their boundaries intact.');
        }
        if (typeof body !== 'string' || Buffer.byteLength(body) > 256 * 1024) throw new StateError('Provide guidance text up to 256 KiB.');
        if (input.expectedRevision !== current.revision) throw new StateError('Shared guidance changed. Reload before saving.', 409);
        const history = path.join(dir, 'history'); fs.mkdirSync(history, { recursive: true, mode: 0o700 }); resolveInside(history, '', { directory: true });
        atomicWrite(path.join(history, `${input.key}-${current.refs[input.key].hash}.md`), current[input.key]);
        if (editing) atomicWrite(receiptFile, JSON.stringify({fingerprint,status:'prepared',body,author:provenance()}));
        atomicWrite(paths[input.key], body, {expectedHash:current.refs[input.key].hash});
        if (editing) atomicWrite(receiptFile,JSON.stringify({fingerprint,status:'saved',body,author:provenance()}));
        return {...read(),...(editing?{operationId:input.operationId,operationApplied:true}:{})};
      }); pending = op.catch(() => {}); return op;
    },
  };
}
