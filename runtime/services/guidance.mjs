import fs from 'node:fs';
import path from 'node:path';
import {provenance} from './actor.mjs';
import {guidanceRegions} from '../public/lib/guidance-body.js';
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
    return { revision, ...bodies, paths, editable: Object.fromEntries(Object.entries(bodies).map(([key, body]) => [key, guidanceRegions(body)])), refs: Object.fromEntries(Object.keys(paths).map(key => [key, { id: `shared:${key}`, scope: 'shared', path: paths[key], hash: digest(bodies[key]) }])) };
  }
  return {
    get: async () => read(),
    put(input) {
      const op = pending.then(() => {
        if (!Object.hasOwn(paths, input.key)) throw new StateError('Choose voice, positions or recipe.');
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
