#!/usr/bin/env node
// Register the magazine's stories as AR Create projects (D1: the bytes stay in the vault).
//
//   node tools/magazine/register.mjs --dry-run --mag <MAG> --files <FILES>
//        prints the projects, pieces and vault records it would register, and every ambiguity.
//        Opens both folders read-only. Writes nothing anywhere.
//   node tools/magazine/register.mjs --apply --mag <MAG> --files <FILES> --data <AR Create data dir> --verification <dir>
//        writes <data>/magazine/index.json, one <data>/magazine/projects/<story>.json per story and one
//        journal line (actor import:magazine-vault) per story. Then inventories MAG and FILES again and
//        requires every hash to be identical to the inventory taken before (the hash proof, saved to
//        <verification>/magazine-register-<date>.json). If any differ, the registration is rolled back.
//   node tools/magazine/register.mjs --rollback --data <dir>
//        moves <data>/magazine to <data>/archive/magazine-<time>/ (nothing is deleted).
//
// Run --apply only through the release (B3), with Adrian's yes, never from a builder session.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inventory, diffInventories, parseFlags} from './inventory.mjs';
import {planRegistration, INDEX_SCHEMA, DEFAULT_ARCHIVED} from '../../runtime/services/magazine-vault/projects.mjs';
import {createJournal} from '../../runtime/services/journal.mjs';

const ACTOR = 'import:magazine-vault';
const stable = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x, 1);

function writeExclusive(file, text) { fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700}); fs.writeFileSync(file, text, {flag: 'wx', mode: 0o600}); }

export function summarize(plan) {
  return {
    stories: plan.stories.map(p => ({number: p.number, story: p.name, storyId: p.storyId, archived: p.archived, step: p.step, who: p.who, pieces: p.pieces.map(x => x.kind + (x.part ? ' ' + x.part : '')), records: Object.fromEntries(Object.entries(p.vaultRecords).map(([k, v]) => [k, [].concat(v).length])), flags: p.flags})),
    ambiguities: plan.ambiguities, unassigned: plan.unassigned, boardErrors: plan.boardErrors, scannedFiles: plan.scanned,
  };
}

export async function dryRun({mag, files, archived = DEFAULT_ARCHIVED}) {
  return planRegistration({vault: mag, files, archived});
}

export async function apply({mag, files, data, verification, archived = DEFAULT_ARCHIVED, now = () => new Date()}) {
  if (!data || !path.isAbsolute(data) || !fs.statSync(data).isDirectory()) throw new Error('--data must name the AR Create data folder.');
  if (!verification || !path.isAbsolute(verification)) throw new Error('--verification must name an absolute folder for the hash proof.');
  const dir = path.join(data, 'magazine');
  const before = await inventory({mag, files});
  const plan = planRegistration({vault: mag, files, archived});
  const registeredAt = now().toISOString();
  const index = {schema: INDEX_SCHEMA, registeredAt, by: ACTOR, vaultRoot: mag, filesRoot: files || null, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name, number: p.number, archived: p.archived}))};
  const existing = fs.existsSync(path.join(dir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) : null;
  if (existing) {
    const same = stable(existing.stories) === stable(index.stories) && plan.stories.every(p => { const f = path.join(dir, 'projects', p.storyId + '.json'); return fs.existsSync(f) && stable({...JSON.parse(fs.readFileSync(f, 'utf8')), registeredAt: null}) === stable({...p, registeredAt: null}); });
    if (same) return {applied: false, alreadyRegistered: true, stories: index.stories.length};
    throw new Error('A different magazine registration already exists. Roll it back first (--rollback); nothing was written.');
  }
  const journal = createJournal({dataDir: data});
  const written = [];
  try {
    for (const p of plan.stories) { const file = path.join(dir, 'projects', p.storyId + '.json'); writeExclusive(file, JSON.stringify({...p, registeredAt}, null, 1) + '\n'); written.push(file); }
    writeExclusive(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n'); written.push(path.join(dir, 'index.json'));
    for (const p of plan.stories) await journal.append({operationId: null, actor: ACTOR, client: 'file', scope: {kind: 'story', id: p.storyId}, kind: 'import:magazine-vault', status: 'committed', after: {revision: null, hash: null}, summary: `Registered ${p.name} (${p.pieces.length} piece(s), ${Object.keys(p.vaultRecords).length} record kinds).`});
  } catch (error) { for (const file of written.reverse()) fs.rmSync(file, {force: true}); throw error; }
  const after = await inventory({mag, files});
  const changes = diffInventories(before, after);
  const proof = {schema: 'ar-create.magazine-register-proof.v1', at: now().toISOString(), mag, files: files || null, before: {mag: before.mag.fileCount, files: before.filesRoot.fileCount}, after: {mag: after.mag.fileCount, files: after.filesRoot.fileCount}, identical: changes.length === 0, changes};
  fs.mkdirSync(verification, {recursive: true, mode: 0o700});
  const proofFile = path.join(verification, `magazine-register-${registeredAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(proofFile, JSON.stringify(proof, null, 1) + '\n', {mode: 0o600});
  if (changes.length) { rollback({data, now}); return {applied: false, rolledBack: true, proofFile, changes}; }
  return {applied: true, stories: plan.stories.length, proofFile, identical: true};
}

export function rollback({data, now = () => new Date()}) {
  const dir = path.join(data, 'magazine');
  if (!fs.existsSync(dir)) return {rolledBack: false, reason: 'nothing registered'};
  const target = path.join(data, 'archive', 'magazine-' + now().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  fs.renameSync(dir, target);
  return {rolledBack: true, movedTo: target};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const flags = parseFlags(process.argv.slice(2), {'dry-run': 'flag', apply: 'flag', rollback: 'flag', mag: 'value', files: 'value', data: 'value', verification: 'value', archive: 'value', out: 'value'});
    const modes = ['dry-run', 'apply', 'rollback'].filter(m => flags[m]);
    if (modes.length !== 1) throw new Error('Choose exactly one of --dry-run, --apply, --rollback.');
    const archived = flags.archive ? flags.archive.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_ARCHIVED;
    if (flags['dry-run']) { const plan = await dryRun({mag: flags.mag, files: flags.files, archived}); if (flags.out) fs.writeFileSync(flags.out, JSON.stringify(plan, null, 1) + '\n', {mode: 0o600}); console.log(JSON.stringify(summarize(plan), null, 1)); }
    else if (flags.apply) console.log(JSON.stringify(await apply({mag: flags.mag, files: flags.files, data: flags.data, verification: flags.verification, archived}), null, 1));
    else console.log(JSON.stringify(rollback({data: flags.data}), null, 1));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
