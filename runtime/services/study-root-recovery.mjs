import fs from 'node:fs';
import path from 'node:path';
import {atomicWrite, digest, regular} from './files.mjs';
import {StateError} from '../store.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const fail = message => { throw new StateError(message, 409); };
const text = bytes => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
function canonical(file, directory = false) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.resolve(file) !== file) fail('Recovery requires fixed canonical owner paths.');
  let current = path.parse(file).root;
  for (const segment of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail('Recovery refuses symlink paths.');
  }
  const stat = fs.lstatSync(file);
  if (fs.realpathSync(file) !== file || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) fail('Recovery owner path changed.');
  return stat;
}
function bytes(file, optional = false) {
  if (optional && !fs.lstatSync(file, {throwIfNoEntry: false})) { canonical(path.dirname(file), true); return null; }
  canonical(file); regular(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    if (before.size > 64 * 1024 * 1024) fail('Recovery proof exceeds file limit.');
    const raw = fs.readFileSync(fd), after = fs.fstatSync(fd), visible = fs.lstatSync(file);
    if (before.dev !== visible.dev || before.ino !== visible.ino || before.size !== raw.length || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail('Recovery evidence changed during read.');
    return raw;
  } finally { fs.closeSync(fd); }
}
const hashAt = (file, optional = false) => { const raw = bytes(file, optional); return raw === null ? null : digest(raw); };
function safeRel(rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || /[\\\x00-\x1f\x7f]/.test(rel) || rel.split('/').some(v => !v || v === '.' || v === '..' || v.startsWith('.'))) fail('Recovery refuses unsafe record paths.');
  return rel;
}
function projectionProof(raw, metadata, sourceKey) {
  if (metadata?.schema !== 'ar-create.bound-draft-correspondence.v1' || metadata.sourceKey !== sourceKey || metadata.fileHash !== digest(raw)) fail('Native DEV projection identity or bytes changed.');
  const value = text(raw);
  if (!Number.isSafeInteger(metadata.prefixLength) || metadata.prefixLength < 0 || !Array.isArray(metadata.blocks) || digest(value.slice(0, metadata.prefixLength)) !== metadata.prefixHash) fail('Native DEV projection prefix changed.');
  let offset = metadata.prefixLength;
  const ids = new Set();
  for (const block of metadata.blocks) {
    if (typeof block.id !== 'string' || !block.id || ids.has(block.id) || !Number.isSafeInteger(block.rawLength) || block.rawLength < 0 || !Number.isSafeInteger(block.separatorLength) || block.separatorLength < 0) fail('Native DEV projection metadata changed.');
    const body = value.slice(offset, offset + block.rawLength); offset += block.rawLength;
    const separator = value.slice(offset, offset + block.separatorLength); offset += block.separatorLength;
    if (digest(body) !== block.blockHash || digest(separator) !== block.separatorHash) fail('Native DEV projection block changed.');
    ids.add(block.id);
  }
  if (offset !== value.length) fail('Native DEV projection cannot retain exact bytes.');
  return [...ids];
}

/** Explicit, fixed-owner device-stamp recovery. This is not a generic rebind.
 * Call only while the owning draft service is serialized and quiescent.
 * Manuscripts, captures, correspondence and native operation receipts are never written.
 * Future sourceKey(b) must use b.draftSourceKey ?? its original hash expression. */
export function createStudyRootRecovery({copyRoot, bindingId, parentStudyId, originalId, afterPublish} = {}) {
  if (!UUID.test(bindingId || '') || typeof parentStudyId !== 'string' || !parentStudyId || typeof originalId !== 'string' || !originalId) fail('Exact owned study identity required.');
  canonical(copyRoot, true);
  const key = digest(stable({parentStudyId, originalId}));
  const room = path.join(copyRoot, 'copies', bindingId);
  const intentFile = path.join(copyRoot, 'bindings', key + '.json');
  const area = path.join(room, 'metadata', 'ar-project-folder-bindings');
  const bindingFile = path.join(area, bindingId + '.json');
  const correspondenceFile = path.join(area, bindingId + '.draft-correspondence.json');
  const journalFile = id => path.join(area, bindingId + '-' + id + '.root-recovery.json');
  const sourceKey = b => b.draftSourceKey ?? digest(stable({projectId: b.projectId, workflow: b.roots.workflow, draft: b.records.draft}));

  let recoveryLock = null;
  function proof() {
    canonical(room, true); canonical(area, true);
    const adapterLock = fs.lstatSync(path.join(area, 'adapter.lock'), {throwIfNoEntry: false});
    if ((adapterLock && (!recoveryLock || adapterLock.ino !== recoveryLock.ino || adapterLock.dev !== recoveryLock.dev)) || fs.lstatSync(path.join(room, 'workflow', 'Workflow', '_mag-running.md'), {throwIfNoEntry: false})) fail('Pending owner operation or Magazine run requires recovery first.');
    const intentRaw = bytes(intentFile), intent = JSON.parse(text(intentRaw));
    if (intent.schema !== 'ar-create.study-draft-copy.v1' || intent.id !== bindingId || intent.key !== key || intent.parentStudyId !== parentStudyId || intent.originalId !== originalId || intent.status !== 'ready' || !SHA.test(intent.captureHash || '')) fail('Owned copy intent identity changed or is incomplete.');
    const bindingRaw = bytes(bindingFile), binding = JSON.parse(text(bindingRaw));
    if (binding.schema !== 'ar-create.project-folders.v1' || binding.projectId !== bindingId || binding.draftAuthority !== 'owned-working-copy' || !binding.roots || !binding.records || binding.records.draft !== intent.draftRelative || !/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(binding.records.draft) || binding.records.edits !== 'Workflow/4-Review/EDITS - ' + path.basename(binding.records.draft)) fail('Owned binding authority changed.');
    // This recovery is restricted to the minimal owned draft binding, not arbitrary media membership.
    if (!Array.isArray(binding.materials) || binding.materials.length || Object.keys(binding.records).some(k => !['draft', 'edits'].includes(k))) fail('Recovery cannot prove expanded owner membership.');
    const roots = [
      ['roots.media', binding.roots.media, path.join(room, 'media')],
      ['roots.workflow', binding.roots.workflow, path.join(room, 'workflow')],
      ['media', binding.media, path.join(room, 'media', 'Project')],
      ['derived', binding.derived, path.join(room, 'workflow', 'Derived')],
    ].map(([name, root, fixed]) => {
      if (!root || root.path !== fixed || !Number.isSafeInteger(root.dev) || !Number.isSafeInteger(root.ino)) fail('Recovery refuses changed canonical root paths.');
      const stat = canonical(fixed, true);
      if (stat.ino !== root.ino) fail('Recovery refuses changed root inodes.');
      return {name, path: fixed, ino: stat.ino, beforeDevice: root.dev, afterDevice: stat.dev};
    });
    const manifestFile = path.join(room, 'capture-manifest.json'), manifestRaw = bytes(manifestFile);
    if (digest(manifestRaw) !== intent.captureHash) fail('Captured manifest authority changed.');
    const manifest = JSON.parse(text(manifestRaw));
    if (manifest.schema !== 'ar-create.study-draft-capture.v1' || manifest.bindingId !== bindingId || manifest.parentStudyId !== parentStudyId || manifest.originalId !== originalId || !Array.isArray(manifest.records)) fail('Captured original identity changed.');
    const captureDir = path.join(room, 'capture'); canonical(captureDir, true);
    const captureIds = new Set(), capturePaths = new Set(), captures = [];
    for (const record of manifest.records) {
      if (typeof record.id !== 'string' || captureIds.has(record.id)) fail('Captured record identity changed.'); captureIds.add(record.id);
      if (record.missing) continue;
      if (!path.isAbsolute(record.copiedPath || '') || path.dirname(record.copiedPath) !== captureDir || capturePaths.has(record.copiedPath) || !SHA.test(record.sourceHash || '') || record.copiedHash !== record.sourceHash) fail('Captured original hash authority changed.');
      capturePaths.add(record.copiedPath);
      if (hashAt(record.copiedPath) !== record.copiedHash) fail('Read-only source capture changed.');
      captures.push({id: record.id, hash: record.copiedHash});
    }
    const drafts = manifest.records.filter(r => r.role === 'draft' && !r.missing);
    if (drafts.length !== 1 || drafts[0].sourceHash !== intent.originalHash) fail('Captured original DEV authority changed.');
    const workflow = {}, workflowRaw = {};
    for (const [name, rel] of Object.entries(binding.records)) {
      workflowRaw[name] = bytes(path.join(room, 'workflow', safeRel(rel)), name === 'edits');
      workflow[name] = workflowRaw[name] === null ? null : digest(workflowRaw[name]);
    }
    const correspondenceRaw = bytes(correspondenceFile), correspondence = JSON.parse(text(correspondenceRaw));
    const stableSourceKey = sourceKey(binding);
    if (!SHA.test(stableSourceKey)) fail('Stable correspondence source identity is invalid.');
    const paragraphIds = projectionProof(workflowRaw.draft, correspondence, stableSourceKey);
    const operations = [];
    for (const name of fs.readdirSync(area).filter(name => name.startsWith(bindingId + '-') && name.endsWith('.operation.json')).sort()) {
      const raw = bytes(path.join(area, name)), operation = JSON.parse(text(raw));
      if (operation.schema !== 'ar-create.project-folder-operation.v1' || operation.projectId !== bindingId || !UUID.test(operation.operationId || '') || name !== bindingId + '-' + operation.operationId + '.operation.json' || operation.state !== 'committed' || !Array.isArray(operation.changes)) fail('Pending or invalid native operation requires explicit operation recovery first.');
      const destinations = new Set();
      for (const change of operation.changes) {
        const destination = (change.area || 'workflow') + ':' + change.relativePath;
        if (destinations.has(destination) || typeof change.after !== 'string' || digest(change.after) !== change.afterHash || (change.area === 'binding-metadata' ? change.relativePath !== bindingId + '.draft-correspondence.json' : change.area !== undefined || !Object.values(binding.records).includes(change.relativePath))) fail('Native operation receipt contract changed.');
        destinations.add(destination);
      }
      if (operation.correspondenceInverse?.before?.sourceKey !== undefined && operation.correspondenceInverse.before.sourceKey !== stableSourceKey) fail('Saved Undo source identity changed.');
      operations.push({name, hash: digest(raw)});
    }
    return {binding, bindingRaw, intentRaw, audit: {schema: 'ar-create.study-root-recovery-proof.v1', bindingId, parentStudyId, originalId, roots, captures, paragraphIds, sourceKey: stableSourceKey, operations, expected: {bindingHash: digest(bindingRaw), correspondenceHash: digest(correspondenceRaw), workflow}, captureHash: intent.captureHash, intentHash: digest(intentRaw)}};
  }
  function contract(audit) {
    return {expected: audit.expected, captureHash: audit.captureHash, intentHash: audit.intentHash};
  }
  function validateInput(input) {
    if (!input || Object.keys(input).some(k => !['operationId', 'ownerDecision', 'expected', 'captureHash', 'intentHash'].includes(k)) || input.ownerDecision !== true || !UUID.test(input.operationId || '') || !input.expected || !SHA.test(input.captureHash || '') || !SHA.test(input.intentHash || '')) fail('Exact explicit recovery decision and proof contract required.');
  }
  function permittedAfter(binding, audit) {
    const updated = structuredClone(binding);
    updated.draftSourceKey = audit.sourceKey;
    updated.roots.media.dev = audit.roots[0].afterDevice;
    updated.roots.workflow.dev = audit.roots[1].afterDevice;
    updated.media.dev = audit.roots[2].afterDevice;
    updated.derived.dev = audit.roots[3].afterDevice;
    return JSON.stringify(updated, null, 2);
  }
  function recover(input) {
    validateInput(input);
    const current = proof(), file = journalFile(input.operationId), priorRaw = bytes(file, true);
    let journal;
    if (priorRaw) {
      journal = JSON.parse(text(priorRaw));
      if (journal.schema !== 'ar-create.study-root-recovery.v1' || journal.bindingId !== bindingId || journal.operationId !== input.operationId || stable(journal.request) !== stable(input) || !['prepared', 'committed'].includes(journal.state) || digest(journal.after) !== journal.afterHash) fail('Recovery journal identity changed.');
      if (journal.beforeHash !== input.expected.bindingHash || ![journal.beforeHash, journal.afterHash].includes(current.audit.expected.bindingHash) || permittedAfter(current.binding, journal.audit) !== journal.after || journal.audit.sourceKey !== current.audit.sourceKey) fail('Binding or repair contract changed after recovery preparation.');
      const unchanged = {...contract(current.audit), expected: {...current.audit.expected, bindingHash: journal.beforeHash}};
      if (stable(unchanged) !== stable({expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash}) || stable(current.audit.operations) !== stable(journal.audit.operations)) fail('Recovery evidence changed after interruption.');
    } else {
      if (stable(contract(current.audit)) !== stable({expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash})) fail('Recovery proof changed; inspect current owner evidence.');
      if (!current.audit.roots.some(root => root.beforeDevice !== root.afterDevice)) fail('No owned root device change requires recovery.');
      const after = permittedAfter(current.binding, current.audit);
      journal = {schema: 'ar-create.study-root-recovery.v1', bindingId, operationId: input.operationId, state: 'prepared', request: structuredClone(input), beforeHash: current.audit.expected.bindingHash, afterHash: digest(after), after, audit: current.audit};
      atomicWrite(file, JSON.stringify(journal, null, 2), {exclusive: true});
    }
    // Recheck the entire proof after preparing the durable journal; never weaken native CAS.
    const rechecked = proof();
    const normalized = {...contract(rechecked.audit), expected: {...rechecked.audit.expected, bindingHash: journal.beforeHash}};
    if (![journal.beforeHash, journal.afterHash].includes(rechecked.audit.expected.bindingHash) || stable(normalized) !== stable({expected: input.expected, captureHash: input.captureHash, intentHash: input.intentHash}) || stable(rechecked.audit.operations) !== stable(journal.audit.operations) || rechecked.audit.roots.some((root, i) => root.afterDevice !== journal.audit.roots[i].afterDevice || root.ino !== journal.audit.roots[i].ino || root.path !== journal.audit.roots[i].path)) fail('Recovery evidence changed before publication.');
    if (rechecked.audit.expected.bindingHash === journal.beforeHash) {
      atomicWrite(bindingFile, journal.after, {expectedHash: journal.beforeHash});
      afterPublish?.({bindingFile, journalFile: file});
    }
    journal.state = 'committed';
    atomicWrite(file, JSON.stringify(journal, null, 2), {expectedHash: hashAt(file)});
    const result = proof().audit;
    return {state: 'committed', operationId: input.operationId, audit: result, repaired: {bindingFile, journalFile: file, beforeHash: journal.beforeHash, afterHash: journal.afterHash, stableSourceKey: result.sourceKey}, contract: contract(result)};
  }
  function lockedRecover(input) {
    canonical(area, true);
    const lockFile = path.join(area, 'adapter.lock');
    let fd;
    try { fd = fs.openSync(lockFile, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') fail('Pending owner operation requires recovery first.'); throw error; }
    recoveryLock = fs.fstatSync(fd);
    try { return recover(input); } finally {
      fs.closeSync(fd);
      const current = fs.lstatSync(lockFile, {throwIfNoEntry: false});
      if (current && current.dev === recoveryLock.dev && current.ino === recoveryLock.ino) fs.unlinkSync(lockFile);
      recoveryLock = null;
    }
  }
  return {inspect: () => {const audit = proof().audit; return {audit, contract: contract(audit)};}, recover: lockedRecover};
}
