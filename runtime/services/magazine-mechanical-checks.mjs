// Private execution receipts for the maintained, read-only Magazine quote/split checks.
// This owner never writes the vault, its editorial CHECK notes, or draft history.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {StateError} from '../store.mjs';
import {requireHuman, provenance} from './actor.mjs';
import {atomicWrite, digest, ensurePrivateDirectory, regular, safeRel} from './files.mjs';

const SCHEMA = 'ar-create.magazine-mechanical-check.v1';
const RESPONSE = 'ar-create.magazine-mechanical-check-response.v1';
const POINTER = 'ar-create.magazine-mechanical-check-pointer.v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const MAX_BYTES = 1024 * 1024, MAX_RECEIPTS = 256, MAX_CONTEXT = 64;
const CHECKER = fileURLToPath(new URL('./magazine-vault/checks.mjs', import.meta.url));
const SCOPE = Object.freeze({mechanicalOnly: true, checks: ['quotation-matching', 'neighbouring-quote-splits'], narration: 'not-verified', meaning: 'not-verified', facts: 'not-verified', language: 'not-verified', editorialApproval: 'not-granted', publicationReadiness: 'not-granted'});
const queues = new Map(), executing = new Set();
const fail = (message, status = 409) => new StateError(message, status);
const same = (a, b) => isDeepStrictEqual(a, b);
const stamp = () => new Date().toISOString();
const keys = ['parentStudyId', 'storyId', 'pieceId'];
function fields(input, run) {
  const required = [...keys, ...(run ? ['expectedDraftHash', 'expectedInputRevision', 'operationId'] : [])];
  const allowed = [...required, ...(!run ? ['checkId'] : [])];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(input, k))) throw fail('Send only the exact registered check identities and revision guards.', 400);
  for (const key of keys) if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 256 || /[\x00-\x1f\x7f]/.test(input[key])) throw fail('Invalid check identity.', 400);
  for (const key of run ? ['expectedDraftHash', 'expectedInputRevision'] : []) if (!SHA.test(input[key] || '')) throw fail('Exact check input hashes are required.', 400);
  for (const key of run ? ['operationId'] : ['checkId']) if ((run || input[key] !== undefined) && (typeof input[key] !== 'string' || !UUID.test(input[key]))) throw fail(`${key} must be a UUID.`, 400);
}
function rootValid(root) { return root?.scheme === 'canonical-directory-sha256-v1' && SHA.test(root.fingerprint || ''); }
function refValid(ref) { try { return ref && safeRel(ref.path, false) === ref.path && (ref.hash === null || SHA.test(ref.hash)); } catch { return false; } }
function resultValid(result, proof) {
  return result && same(result.draft, proof.draft) && same(result.source, proof.source) && same(result.context, proof.context) && typeof result.quotes?.ok === 'boolean' && Array.isArray(result.quotes.notFound) && Array.isArray(result.quotes.lines) && typeof result.splits?.ok === 'boolean' && Array.isArray(result.splits.splits) && Array.isArray(result.splits.lines);
}
const completedStatus = result => !result.quotes.ok || !result.splits.ok ? 'needs-review' : result.quotes.passages === 0 ? 'held' : 'checked';
const checksum = record => digest(JSON.stringify(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'integritySha256'))));

export function createMagazineMechanicalChecks({dataDir, magazine, working, originals, enabled = false} = {}) {
  if (!dataDir || !magazine?.projects?.project || typeof magazine.read !== 'function' || typeof magazine.extra?.checks?.run !== 'function' || !SHA.test(magazine.extra.checks.checkerRevision || '') || typeof working?.catalog !== 'function' || typeof working.read !== 'function' || typeof originals?.checkInputs !== 'function') throw new TypeError('Supply the private data directory and maintained Magazine, working draft and original input owners.');
  const dataRoot = path.resolve(dataDir);
  const loadedCheckerRevision = magazine.extra.checks.checkerRevision;
  const envelope = record => ({schema: RESPONSE, available: enabled === true, record});

  // The read path only inspects existing components; opening Check creates nothing.
  function directory(owner, create = false) {
    const relative = path.join('magazine', 'mechanical-checks', owner.key);
    try {
      const rootStat = fs.lstatSync(dataRoot, {throwIfNoEntry: false});
      if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw fail('Private check data directory is unavailable.', 403);
      if (create) return ensurePrivateDirectory(dataRoot, relative);
      let current = dataRoot;
      for (const part of relative.split(path.sep)) {
        current = path.join(current, part);
        const stat = fs.lstatSync(current, {throwIfNoEntry: false});
        if (!stat) return null;
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail('Private receipt folders must be real directories.', 403);
        if (part !== 'magazine' && (stat.mode & 0o077)) throw fail('Mechanical receipt folders must be private.', 403);
      }
      return current;
    } catch (error) { if (error.status) throw error; throw fail('Private receipt storage is unavailable; existing data was preserved.', 403); }
  }
  function load(file) {
    const stat = fs.lstatSync(file, {throwIfNoEntry: false});
    if (!stat) return null;
    try {
      regular(file);
      if (stat.size > MAX_BYTES) throw fail('Receipt exceeds its private size limit.', 413);
      if (stat.mode & 0o077) throw fail('Mechanical receipt files must be private.', 403);
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) { if (error.status) throw error; throw fail('Mechanical receipt is corrupt; existing data was preserved.'); }
  }
  function save(file, record) {
    const encoded = JSON.stringify(record);
    if (Buffer.byteLength(encoded) > MAX_BYTES) throw fail('Mechanical receipt exceeds its private size limit.', 413);
    atomicWrite(file, encoded + '\n');
  }
  function checkerRevision() {
    const stat = regular(CHECKER);
    if (stat.size > MAX_BYTES) throw fail('Maintained checker exceeds its size limit.', 413);
    if (digest(fs.readFileSync(CHECKER)) !== loadedCheckerRevision) throw fail('The maintained checker changed on disk. Restart its owner before running checks.');
    return loadedCheckerRevision;
  }
  async function ownerFor(input) {
    const catalog = await working.catalog();
    if (catalog?.schema !== 'ar-create.magazine-working-catalog.v1' || !catalog.configured || !catalog.registered || !rootValid(catalog.rootIdentity)) throw fail('The registered working Magazine folder is unavailable.');
    const stories = catalog.stories.filter(s => s.storyId === input.storyId);
    if (stories.length !== 1 || stories[0].archived) throw fail('Choose one active registered story.');
    const pieces = stories[0].pieces.filter(p => p.pieceId === input.pieceId);
    if (pieces.length !== 1 || !['article', 'article-part'].includes(pieces[0].kind)) throw fail('Choose one exact registered working article or part.');
    const piece = pieces[0]; safeRel(piece.relativePath, false);
    if (catalog.stories.flatMap(s => s.pieces || []).filter(p => p.relativePath === piece.relativePath).length !== 1) throw fail('The working draft path has ambiguous registration.');
    const partNumber = new RegExp('^' + input.storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':part-([1-9][0-9]*)$').exec(input.pieceId)?.[1];
    const partKey = partNumber || piece.part || 'article';
    const identity = {rootIdentity: catalog.rootIdentity, parentStudyId: input.parentStudyId, storyId: input.storyId, pieceId: input.pieceId, partKey, draftPath: piece.relativePath};
    const {partKey: _partKey, ...stableOwner} = identity;
    return {...identity, key: digest(JSON.stringify(stableOwner))};
  }
  async function evidence(input, owner) {
    const freshOwner = await ownerFor(input);
    if (!same(owner, freshOwner)) throw fail('The registered piece or canonical folder changed.');
    const view = await working.read({storyId: input.storyId, pieceId: input.pieceId, edition: 'working'});
    const draft = view?.document, authority = view?.authority;
    if (authority?.kind !== 'magazine' || authority.storyId !== input.storyId || authority.pieceId !== input.pieceId || authority.path !== owner.draftPath || draft?.path !== owner.draftPath || draft.kind !== 'DEV' || !draft.exists || typeof draft.text !== 'string' || digest(draft.text) !== draft.hash || draft.conflicts?.length) throw fail('The exact registered working draft is unavailable or conflicted.');
    const inputs = await originals.checkInputs({parentStudyKey: input.parentStudyId, partKey: owner.partKey, draftPath: owner.draftPath, expectedDraftHash: draft.hash});
    if (inputs?.schema !== 'ar-create.study-original-inputs.v1' || !same(inputs.rootIdentity, owner.rootIdentity) || inputs.parentStudyKey !== input.parentStudyId || inputs.partKey !== owner.partKey || inputs.draftPath !== owner.draftPath || inputs.draftHash !== draft.hash || !SHA.test(inputs.revision || '') || !Array.isArray(inputs.sources) || !Array.isArray(inputs.contexts) || inputs.contexts.length > MAX_CONTEXT) throw fail('Configured original inputs do not match this exact registered piece.');
    const project = magazine.projects.project(input.storyId);
    if (project.storyId !== input.storyId || project.archived || ![].concat(project.vaultRecords?.draft || []).some(r => r.rel === owner.draftPath)) throw fail('The registered draft relationship changed.');
    const seen = new Set([owner.draftPath]); let heldReason = null;
    function refs(rows, role, kind, field) {
      return rows.map(ref => {
        if (!refValid(ref) || ref.role !== role || seen.has(ref.path) || [].concat(project.vaultRecords[field] || []).filter(r => r.rel === ref.path).length !== 1) throw fail('Original support is ambiguous or is not explicitly registered to this story.');
        seen.add(ref.path);
        const file = magazine.read({path: ref.path});
        if (file.path !== ref.path || file.kind !== kind || file.hash !== ref.hash || (file.exists && (typeof file.text !== 'string' || digest(file.text) !== file.hash)) || file.conflicts?.length) throw fail('Original support bytes or kind changed.');
        if (!file.exists || ref.hash === null) heldReason = 'An explicitly configured original is unavailable; mechanical checks were not run.';
        return {path: ref.path, hash: ref.hash};
      });
    }
    const sources = refs(inputs.sources, 'source', 'SRC', 'src');
    const context = refs(inputs.contexts, 'context', 'CONTEXT', 'context');
    if (sources.length !== 1) heldReason = 'Exactly one explicitly configured SRC is required; mechanical checks were not run.';
    const proof = {rootIdentity: owner.rootIdentity, parentStudyId: input.parentStudyId, storyId: input.storyId, pieceId: input.pieceId, partKey: owner.partKey, draft: {path: owner.draftPath, hash: draft.hash}, source: sources.length === 1 ? sources[0] : null, context, inputRevision: inputs.revision, checkerRevision: checkerRevision()};
    return {proof, heldReason};
  }
  function validateRecord(record, owner, id) {
    const p = record?.proof;
    if (!record || record.schema !== SCHEMA || record.checkId !== id || record.operationId !== id || !UUID.test(id) || record.persisted !== true || !['running', 'checked', 'needs-review', 'held', 'failed', 'stale', 'interrupted'].includes(record.status) || !SHA.test(record.requestFingerprint || '') || !same(record.scope, SCOPE) || !SHA.test(record.integritySha256 || '') || checksum(record) !== record.integritySha256 || typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt)) || !p || !same(p.rootIdentity, owner.rootIdentity) || keys.some(k => p[k] !== owner[k]) || typeof p.partKey !== 'string' || !p.partKey || p.draft?.path !== owner.draftPath || !refValid(p.draft) || !SHA.test(p.draft.hash || '') || !(p.source === null || refValid(p.source)) || !Array.isArray(p.context) || p.context.length > MAX_CONTEXT || p.context.some(r => !refValid(r)) || !SHA.test(p.inputRevision || '') || !SHA.test(p.checkerRevision || '') || (record.result !== null && !resultValid(record.result, p)) || (['checked', 'needs-review'].includes(record.status) && (!record.result || completedStatus(record.result) !== record.status)) || (record.status !== 'running' && !Number.isFinite(Date.parse(record.finishedAt)))) throw fail('Mechanical receipt is corrupt or belongs to other work; existing data was preserved.');
    return record;
  }
  function stored(owner, id) {
    const dir = directory(owner); if (!dir) return null;
    const fromPointer = !id;
    if (!id) {
      const pointer = load(path.join(dir, 'current.json')); if (!pointer) return null;
      if (pointer.schema !== POINTER || !UUID.test(pointer.checkId || '') || Object.keys(pointer).length !== 2) throw fail('Mechanical receipt pointer is corrupt; existing data was preserved.');
      id = pointer.checkId;
    }
    const record = load(path.join(dir, id + '.json'));
    if (!record) { if (fromPointer) throw fail('Mechanical receipt pointer has no matching receipt.'); return null; }
    return validateRecord(record, owner, id);
  }
  async function current(record, input, owner) {
    if (record.status === 'running') return executing.has(dataRoot + '\0' + owner.key + '\0' + record.operationId) ? record : {...record, status: 'interrupted', error: 'This saved check was interrupted. Start a new operation to check again.'};
    if (record.status === 'interrupted') return record;
    try { if (!same(record.proof, (await evidence(input, owner)).proof)) return {...record, status: 'stale', staleReason: 'The draft, explicit originals, relationship or checker changed after this check.'}; }
    catch { return {...record, status: 'stale', staleReason: 'The exact registered inputs are no longer available for this receipt.'}; }
    return record;
  }
  async function perform(input, owner) {
    const requestFingerprint = digest(JSON.stringify(Object.fromEntries([...keys, 'expectedDraftHash', 'expectedInputRevision', 'operationId'].map(k => [k, input[k]]))));
    const existing = stored(owner, input.operationId);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw fail('That operationId was already used with different check inputs.');
      return envelope(await current(existing, input, owner));
    }
    const before = await evidence(input, owner);
    if (before.proof.draft.hash !== input.expectedDraftHash || before.proof.inputRevision !== input.expectedInputRevision) throw fail('Check inputs changed. Refresh the exact draft and original-input revision.');
    const dir = directory(owner, true);
    if (fs.readdirSync(dir).filter(name => UUID.test(name.slice(0, -5)) && name.endsWith('.json')).length >= MAX_RECEIPTS) throw fail('Mechanical check history reached its private receipt limit. Existing history was preserved.', 413);
    const record = {schema: SCHEMA, checkId: input.operationId, operationId: input.operationId, requestFingerprint, status: 'running', persisted: true, createdAt: stamp(), finishedAt: null, proof: before.proof, result: null, scope: structuredClone(SCOPE), provenance: provenance()};
    const file = path.join(dir, input.operationId + '.json');
    const persist = () => { record.integritySha256 = checksum(record); save(file, record); };
    executing.add(dataRoot + '\0' + owner.key + '\0' + input.operationId);
    persist(); save(path.join(dir, 'current.json'), {schema: POINTER, checkId: record.checkId});
    try {
      if (before.heldReason) { record.status = 'held'; record.notRun = true; record.reason = before.heldReason; }
      else {
        const result = await magazine.extra.checks.run({draft: before.proof.draft.path, source: before.proof.source.path, context: before.proof.context.map(r => r.path)});
        if (!resultValid(result, before.proof)) throw fail('The maintained checker did not return these exact input revisions.');
        record.result = result; record.status = completedStatus(result);
        if (record.status === 'held') record.reason = 'No supported quoted passages checked.';
      }
    } catch { record.status = 'failed'; record.error = 'The maintained mechanical checker failed; no editorial approval was granted.'; }
    // Revalidate even after a checker error: a reread racing an edit must be
    // identified as stale rather than mistaken for a current failed check.
    try { if (!same(before.proof, (await evidence(input, owner)).proof)) { record.status = 'stale'; record.staleReason = 'Inputs changed while the mechanical checks were running.'; } }
    catch { record.status = 'stale'; record.staleReason = 'Exact inputs became unavailable while the mechanical checks were running.'; }
    record.finishedAt = stamp();
    try { persist(); }
    catch (error) {
      // Leave a bounded failure instead of allowing a large/private checker output
      // to strand a running receipt or leak through an error response.
      if (error.status !== 413) throw error;
      record.result = null; record.status = 'failed'; record.error = 'Mechanical output exceeded the private receipt limit.'; persist();
    }
    return envelope(record);
  }
  return {
    async run(input) {
      fields(input, true); requireHuman('Saving a mechanical check receipt');
      if (enabled !== true) throw fail('Saving Magazine mechanical receipts is disabled.', 423);
      const owner = await ownerFor(input), queueKey = dataRoot + '\0' + owner.key;
      const previous = queues.get(queueKey) || Promise.resolve();
      const pending = previous.catch(() => {}).then(async () => {
        const activeKey = queueKey + '\0' + input.operationId;
        try { return await perform(input, owner); } finally { executing.delete(activeKey); }
      }); queues.set(queueKey, pending);
      try { return await pending; } finally { if (queues.get(queueKey) === pending) queues.delete(queueKey); }
    },
    async read(input) {
      fields(input, false); const owner = await ownerFor(input);
      const record = stored(owner, input.checkId);
      return envelope(record ? await current(record, input, owner) : null);
    },
  };
}
