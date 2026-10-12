import fs from 'node:fs';
import path from 'node:path';
import { StateError } from '../store.mjs';
import { atomicWrite, digest, ensurePrivateDirectory, readJson, regular, safeRel } from './files.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PARENTS = { hk: 'hk', ancha: 'ref-an-cha', collector: 'ref-collector' };
const SCHEMA = 'ar-create.study-research-choices.v1';
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const fail = (message, status = 409) => { throw new StateError(message, status); };
export const researchPointId = (recordPath, originalText) => digest(recordPath + '\n' + originalText).slice(0, 24);

function markdown(state) {
  const lines = ['# Research choices', '', 'Explicit editorial plan for this owned working copy. These choices do not insert manuscript words or activate AI.', '', `Parent study: ${state.parentStudyId}`, `Owned draft binding: ${state.bindingId}`, ''];
  for (const c of state.choices) {
    lines.push(`## ${c.decision === 'include' ? 'Include' : 'Leave out'} · ${c.pointId}`, '', `Source: ${c.recordPath}`, `Source SHA-256: ${c.recordHash}`, `Receipt: ${c.operationId}`, ...(c.anchorId ? [`Draft paragraph anchor: ${c.anchorId}`] : []), '', 'Original research words:', '', ...c.originalText.split('\n').map(line => '> ' + line), '');
    if (c.narration) lines.push('Author narration / editorial intention:', '', ...c.narration.split('\n').map(line => '> ' + line), '');
  }
  return lines.join('\n');
}

/** Persists decisions only. The injected originals and drafts retain all source
 * and manuscript authority; this service never calls their save methods. */
export function createStudyResearchChoices({ dataDir, originals, drafts } = {}) {
  if (!originals?.list || !drafts?.read) throw new TypeError('Trusted originals.list and drafts.read are required.');
  const root = ensurePrivateDirectory(dataDir, 'study-research-choices');
  let pending = Promise.resolve();
  const serial = fn => { const result = pending.then(fn); pending = result.catch(() => {}); return result; };
  function identity(input, saving = false) {
    const fields = ['projectKey', 'bindingId', 'parentStudyId', ...(saving ? ['pointId', 'recordPath', 'recordHash', 'originalText', 'decision', 'narration', 'anchorId', 'expected', 'sourceExpected', 'operationId'] : [])];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !fields.includes(k))) fail('Malformed research-choice request; unsupported fields refused.', 400);
    if (!Object.hasOwn(PARENTS, input.projectKey)) fail('Unsupported research project.', 404);
    if (PARENTS[input.projectKey] !== input.parentStudyId) fail('Research belongs to a different parent study.');
    if (!UUID.test(input.bindingId || '')) fail('Owned draft binding UUID required.', 400);
    if (saving && !UUID.test(input.operationId || '')) fail('Operation UUID required.', 400);
  }
  async function authority(input) {
    const draft = await drafts.read({ bindingId: input.bindingId, parentStudyId: input.parentStudyId });
    if (draft?.binding?.id !== input.bindingId || draft.binding.parentStudyId !== input.parentStudyId || draft.binding.authority !== 'owned-working-copy' || draft.binding.status !== 'ready' || !draft.expected || draft.readiness?.ready === false) fail('A ready owned working copy is required.');
    const listed = await originals.list(input.projectKey);
    if (listed?.projectKey !== input.projectKey || !Array.isArray(listed.records)) fail('Trusted research catalog changed.');
    const sourceRecords = listed.records.map(r => ({ path: r.path, hash: r.hash ?? null, missing: r.missing === true || r.raw === null })).sort((a, b) => a.path.localeCompare(b.path));
    const sourceExpected = digest(stable(sourceRecords));
    return { draft, sourceExpected, sourceRecords, records: listed.records.filter(r => r.role === 'research' || r.role === 'research notes') };
  }
  function paths(input) {
    const room = ensurePrivateDirectory(root, input.bindingId.toLowerCase());
    return { choices: path.join(room, 'choices.md'), journal: path.join(room, 'journal.json') };
  }
  function state(input, files) {
    const value = readJson(files.journal, { schema: SCHEMA, projectKey: input.projectKey, parentStudyId: input.parentStudyId, bindingId: input.bindingId, choices: [], receipts: [], markdownHash: null });
    if (value.schema !== SCHEMA || value.bindingId !== input.bindingId || value.parentStudyId !== input.parentStudyId || value.projectKey !== input.projectKey || !Array.isArray(value.choices) || !Array.isArray(value.receipts)) fail('Research-choice journal identity changed.');
    const stat = fs.lstatSync(files.choices, { throwIfNoEntry: false });
    let currentHash = null;
    if (stat) { regular(files.choices); currentHash = digest(fs.readFileSync(files.choices)); }
    const allowed = value.pending ? [value.markdownHash, digest(value.pending.markdown)] : [value.markdownHash];
    if (!allowed.includes(currentHash)) fail('Owned research-choice Markdown changed externally; existing words preserved.');
    return value;
  }
  function sourceFor(records, choice) {
    return records.find(r => r.path === choice.recordPath && !r.missing && typeof r.raw === 'string');
  }
  function exactPoint(record, choice) {
    if (!record || record.hash !== choice.recordHash || digest(record.raw) !== record.hash) return false;
    const at = record.raw.indexOf(choice.originalText);
    return at !== -1 && record.raw.indexOf(choice.originalText, at + 1) === -1;
  }
  function response(value, files, current) {
    if (value.pending) fail('Research-choice save is incomplete. Retry the same operation to finish it.');
    const choices = value.choices.map(c => {
      const sourceStale = c.sourceExpected !== current.sourceExpected || !exactPoint(sourceFor(current.records, c), c);
      const draftStale = stable(c.expected) !== stable(current.draft.expected);
      return { ...c, sourceStale, draftStale, stale: sourceStale || draftStale };
    });
    return { bindingId: value.bindingId, parentStudyId: value.parentStudyId, projectKey: value.projectKey, choices, expected: current.draft.expected, sourceExpected: current.sourceExpected, sourceRecords: current.sourceRecords, paths: files, authority: 'owned-working-copy', purpose: 'editorial-plan-only', receiptIds: value.receipts.map(r => r.operationId) };
  }
  async function save(input) {
    identity(input, true);
    safeRel(input.recordPath, false);
    if (typeof input.originalText !== 'string' || !input.originalText.trim() || Buffer.byteLength(input.originalText) > 64 * 1024 || input.originalText.includes('\0')) fail('Exact readable research words required.', 400);
    if (input.pointId !== researchPointId(input.recordPath, input.originalText)) fail('Research point identity does not match its exact source words.');
    if (!['include', 'leave-out'].includes(input.decision)) fail('Choose Include or Leave out explicitly.', 400);
    if (input.narration !== undefined && (typeof input.narration !== 'string' || Buffer.byteLength(input.narration) > 16 * 1024 || input.narration.includes('\0'))) fail('Narration must be readable text within the limit.', 400);
    const current = await authority(input), files = paths(input), value = state(input, files), requestHash = digest(stable(input));
    const prior = value.receipts.find(r => r.operationId === input.operationId);
    if (prior) { if (prior.requestHash !== requestHash) fail('Operation UUID already belongs to a different decision.'); return response(value, files, current); }
    if (value.pending && (value.pending.operationId !== input.operationId || value.pending.requestHash !== requestHash)) fail('Finish the pending research-choice operation first.');
    if (!value.pending) {
      if (input.sourceExpected !== current.sourceExpected) fail('Original sources changed. Refresh before choosing.');
      if (!exactPoint(sourceFor(current.records, input), input)) fail('Research source changed or selected words are not unique. Refresh before choosing.');
      if (input.anchorId !== undefined && (typeof input.anchorId !== 'string' || !current.draft.projection?.some(p => p.id === input.anchorId && p.blockKind === 'paragraph'))) fail('Choose a current owned draft paragraph as the editorial anchor.');
      if (!input.expected || stable(input.expected) !== stable(current.draft.expected)) fail('Owned draft changed. Refresh before choosing.');
      const choice = { pointId: input.pointId, recordPath: input.recordPath, recordHash: input.recordHash, originalText: input.originalText, decision: input.decision, narration: input.narration || '', anchorId: input.anchorId || null, sourceExpected: input.sourceExpected, expected: structuredClone(input.expected), operationId: input.operationId, updatedAt: new Date().toISOString() };
      const next = { ...value, choices: [...value.choices.filter(c => c.pointId !== input.pointId), choice], receipts: [...value.receipts, { operationId: input.operationId, requestHash, pointId: input.pointId, decision: input.decision, savedAt: choice.updatedAt }] };
      value.pending = { operationId: input.operationId, requestHash, next, markdown: markdown(next) };
      const stat = fs.lstatSync(files.journal, { throwIfNoEntry: false });
      atomicWrite(files.journal, JSON.stringify(value, null, 2), stat ? { expectedHash: digest(fs.readFileSync(files.journal)) } : { exclusive: true });
    }
    atomicWrite(files.choices, value.pending.markdown);
    const completed = { ...value.pending.next, markdownHash: digest(value.pending.markdown) };
    atomicWrite(files.journal, JSON.stringify(completed, null, 2));
    return response(completed, files, current);
  }
  return {
    read: input => serial(async () => { identity(input); const current = await authority(input), files = paths(input); return response(state(input, files), files, current); }),
    save: input => serial(() => save(structuredClone(input))),
  };
}
