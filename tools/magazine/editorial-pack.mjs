#!/usr/bin/env node
// D5: the stage instructions, LESSONS and brand profiles live in this repo under editorial/, versioned
// with the code that reads them. This copies them from the installed skills once and records each
// source's hash in editorial/MANIFEST.json; --verify proves the pack still matches its manifest and
// says which installed sources have drifted since.
//
//   node tools/magazine/editorial-pack.mjs --copy  [--skills ~/.claude/skills]
//   node tools/magazine/editorial-pack.mjs --verify [--skills ~/.claude/skills]
import { realpathSync } from 'node:fs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseFlags} from './inventory.mjs';

const repo = path.resolve(import.meta.dirname, '..', '..');
export const EDITORIAL = path.join(repo, 'editorial');
const sha = b => createHash('sha256').update(b).digest('hex');
/** [repo path under editorial/, path under the skills folder] */
export const PACK = [
  ['LESSONS.md', 'mag/LESSONS.md'],
  ...['ask', 'develop', 'intake', 'map', 'photos', 'preview', 'publish', 'research', 'review', 'source', 'status', 'terms', 'tidy'].map(n => [`stages/mag/${n}.md`, `mag/stages/${n}.md`]),
  ...['brief', 'make', 'research'].map(n => [`stages/arcreate/${n}.md`, `arcreate/stages/${n}.md`]),
  ['brands/teajia.md', 'arcreate/brands/teajia.md'], ['brands/_template.md', 'arcreate/brands/_template.md'],
];
/** Brand profiles written outside the skills (i64os door notes, answered by Adrian on 3 Nov 2026). They are in the
 * manifest with their own source; --copy keeps their entries instead of copying them from the skills. */
export const REPO_ONLY = ['brands/art.md', 'brands/mandala-codes.md', 'brands/personal.md', 'stages/arcreate/carousel-guide.md'];
/** The skill entry files are replaced, not copied (editorial/skills-next); their hashes are kept so the installer can refuse a drifted original. */
export const ENTRIES = ['mag/SKILL.md', 'arcreate/SKILL.md'];

export function copyPack({skills, now = new Date()}) {
  const files = [], entries = [];
  for (const [to, from] of PACK) {
    const bytes = fs.readFileSync(path.join(skills, from));
    fs.mkdirSync(path.dirname(path.join(EDITORIAL, to)), {recursive: true});
    fs.writeFileSync(path.join(EDITORIAL, to), bytes);
    files.push({path: to, source: '~/.claude/skills/' + from, sha256: sha(bytes)});
  }
  const prior = fs.existsSync(path.join(EDITORIAL, 'MANIFEST.json')) ? JSON.parse(fs.readFileSync(path.join(EDITORIAL, 'MANIFEST.json'), 'utf8')).files : [];
  for (const to of REPO_ONLY) { const kept = prior.find(f => f.path === to); if (kept) files.push({...kept, sha256: sha(fs.readFileSync(path.join(EDITORIAL, to)))}); }
  for (const from of ENTRIES) entries.push({source: '~/.claude/skills/' + from, sha256: sha(fs.readFileSync(path.join(skills, from)))});
  const manifest = {schema: 'ar-create.editorial-manifest.v1', copiedAt: now.toISOString(), note: 'D5 (2026-10-21): copied from the installed skills; edit here, not there, once the thin skills are installed.', files, entries};
  fs.writeFileSync(path.join(EDITORIAL, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
  return manifest;
}

export function verifyPack({skills = null} = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(EDITORIAL, 'MANIFEST.json'), 'utf8'));
  const problems = [], drift = [];
  for (const f of manifest.files) {
    const at = path.join(EDITORIAL, f.path);
    if (!fs.existsSync(at)) problems.push(`${f.path} is missing`); else if (sha(fs.readFileSync(at)) !== (f.editedSha256 ?? f.sha256)) problems.push(`${f.path} differs from its manifest hash (edited after copying: update the manifest with --copy or record why)`);
    if (skills) { const src = path.join(skills, f.source.replace('~/.claude/skills/', '')); if (fs.existsSync(src) && sha(fs.readFileSync(src)) !== f.sha256) drift.push(f.source); }
  }
  if (skills) for (const e of manifest.entries) { const src = path.join(skills, e.source.replace('~/.claude/skills/', '')); if (fs.existsSync(src) && sha(fs.readFileSync(src)) !== e.sha256) drift.push(e.source); }
  return {ok: problems.length === 0, files: manifest.files.length, problems, drift};
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const flags = parseFlags(process.argv.slice(2), {copy: 'flag', verify: 'flag', skills: 'value'});
    const skills = flags.skills || path.join(os.homedir(), '.claude', 'skills');
    if (!!flags.copy === !!flags.verify) throw new Error('Choose --copy or --verify.');
    const out = flags.copy ? copyPack({skills}) : verifyPack({skills});
    console.log(JSON.stringify(flags.copy ? {copied: out.files.length, entries: out.entries.length} : out, null, 1));
    if (flags.verify && !out.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
