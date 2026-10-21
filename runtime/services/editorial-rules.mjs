import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {StateError} from '../store.mjs';

/**
 * Where the writing rules for "Make" come from. The rules are part of the release (editorial/, edited in this
 * repo); a host may still point editorialSkillsDir at a folder in the older skill layout, which then wins.
 * The names below are the stable names recorded with each request, in the older layout; this file maps them.
 */
export const EDITORIAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../editorial');
export const ARTICLE_RULES = Object.freeze(['mag/stages/source.md', 'arcreate/stages/research.md', 'arcreate/stages/brief.md', 'mag/stages/develop.md', 'mag/LESSONS.md', 'mag/TEMPLATE.md', 'mag/SYSTEM.md']);
export const CAROUSEL_RULES = Object.freeze(['arcreate/stages/make.md', 'arcreate/brands/teajia.md', 'mag/LESSONS.md']);
// These two live in the magazine itself, as /mag's instructions say; they are never copied into the repo.
const MAGAZINE_FILES = new Set(['mag/TEMPLATE.md', 'mag/SYSTEM.md']);
const IN_REPO = [
  [/^(mag|arcreate)\/stages\/([\w.-]+\.md)$/, m => `stages/${m[1]}/${m[2]}`],
  [/^mag\/LESSONS\.md$/, () => 'LESSONS.md'],
  [/^arcreate\/brands\/([\w.-]+\.md)$/, m => `brands/${m[1]}`],
];
/** The host's override folder (config editorialSkillsDir, exported by serve.mjs), or null: use the repo's editorial/ files. */
export const overrideRoot = () => process.env.AR_CREATE_EDITORIAL_SKILL_ROOT || null;
const magazineRoot = () => process.env.AR_CREATE_MAGAZINE_ROOT || null;

/**
 * {root, rel} for one rule name. skillRoot is the override (null = the repo's editorial/ files).
 * With the host's own override folder, TEMPLATE.md and SYSTEM.md fall back to the magazine folder when the
 * override lacks them; an explicitly supplied folder (a disposable fixture) stays self-contained.
 */
export function ruleLocation(name, {skillRoot = overrideRoot(), editorialRoot = EDITORIAL_ROOT} = {}) {
  const hostFallback = skillRoot === overrideRoot();
  if (MAGAZINE_FILES.has(name)) {
    if (skillRoot && (!hostFallback || fs.lstatSync(path.join(skillRoot, name), {throwIfNoEntry: false}))) return {root: skillRoot, rel: name};
    if (!magazineRoot()) throw new StateError(`The magazine rules (${path.basename(name)}) are in the magazine folder: set magazine.vaultRoot.`, 503);
    return {root: magazineRoot(), rel: path.basename(name)};
  }
  if (skillRoot) return {root: skillRoot, rel: name};
  for (const [pattern, to] of IN_REPO) { const m = name.match(pattern); if (m) return {root: editorialRoot, rel: to(m)}; }
  throw new StateError(`No editorial rule file is named ${name}.`, 500);
}
