import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StateError } from '../store.mjs';
import { atomicWrite, readJson, digest, ensurePrivateDirectory, resolveInside, regular } from './files.mjs';
import {outputOwnership} from './output-ownership.mjs';
import {assertOutputEditorialReady} from '../src/workspaces/editorial-state.mjs';
export const MAX_EXPORT_BYTES = 32 * 1024 * 1024;
const extensions = { 'text/html': '.html', 'text/markdown': '.md', 'application/json': '.json' };
export function createExports({ dataDir, store }) {
  const dir = ensurePrivateDirectory(dataDir, 'exports');
  const owns=outputOwnership({dataDir,store});
  return {
    save(input) {
      if (!Object.hasOwn(extensions, input.mimeType) || typeof input.body !== 'string') throw new StateError('Export HTML, Markdown or JSON text.');
      if (Buffer.byteLength(input.body) > MAX_EXPORT_BYTES) throw new StateError('Export exceeds 32 MB.', 413);
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 240 || /[\x00-\x1f\x7f]/.test(input.name)) throw new StateError('Choose a readable export name.');
      if (typeof input.outputId !== 'string' || !input.outputId || input.outputId.length > 128 || !Number.isSafeInteger(input.manuscriptRevision) || input.manuscriptRevision < 0) throw new StateError('Record an output ID and manuscript revision.');
      if (input.mimeType === 'application/json') { try { JSON.parse(input.body); } catch { throw new StateError('JSON export must be valid JSON.'); } }
      const state = store.get(); const outputs = [state.project.document, ...state.project.versions.map(v => v.document)].filter(Boolean).flatMap(d => d.outputs || []);
      const output = outputs.find(o => o.id === input.outputId && o.manuscriptRevision === input.manuscriptRevision);
      if (!output) throw new StateError('Save this output and its manuscript revision before exporting.', 409);
      if(input.mimeType!=='application/json'){try{const owner=[state.project.document,...state.project.versions.map(version=>version.document)].find(document=>document?.outputs?.includes(output));assertOutputEditorialReady(output,{paragraphs:owner?.paragraphs,title:owner?.title});}catch(error){throw new StateError(error.message,409);}}
      const ext = extensions[input.mimeType]; const base = path.basename(input.name.replace(/\\/g, '/')).replace(/^[.]+/, '').replace(/[^\p{L}\p{N} _.-]/gu, '-').slice(0, 180) || 'output';
      const name = base.endsWith(ext) ? base : `${base}${ext}`;
      const id = randomUUID(); const folder = ensurePrivateDirectory(dir, id); const file = path.join(folder, name);
      const artifact = { id, projectId:state.project.id,documentId:[state.project.document,...state.project.versions.map(version=>version.document)].find(document=>document?.outputs?.includes(output))?.id??null,name, path: file, url: `/api/exports/${id}/file`, mimeType: input.mimeType, outputId: input.outputId, manuscriptRevision: input.manuscriptRevision, createdAt: new Date().toISOString(), hash: digest(input.body), sizeBytes: Buffer.byteLength(input.body), lineageVerification: 'saved-output-record' };
      atomicWrite(file, input.body, { exclusive: true }); atomicWrite(path.join(folder, '.manifest.json'), JSON.stringify(artifact, null, 2), { exclusive: true }); return { artifact };
    },
    list() { const artifacts = fs.readdirSync(dir).filter(id => /^[a-f0-9-]{36}$/.test(id)).map(id => { resolveInside(dir, id, { directory: true }); return readJson(path.join(dir, id, '.manifest.json'), null); }).filter(owns).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return { artifacts }; },
    file(id) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new StateError('Unknown export.', 404); const folder = resolveInside(dir, id, { directory: true }); const artifact = readJson(path.join(folder, '.manifest.json'), null); if (!artifact||artifact.id!==id||!owns(artifact)) throw new StateError('Export was not found in this piece.', 404); const file = resolveInside(folder, artifact.name); regular(file); return { artifact, file }; },
  };
}
