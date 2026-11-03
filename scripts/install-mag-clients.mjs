#!/usr/bin/env node
// Install the magazine's clients outside this repo, from editorial/: the thin /mag and /arcreate skills
// (~/.claude/skills/mag, ~/.claude/skills/arcreate), the 8766 page that saves through AR Create
// (~/builds/mag-preview.mjs + mag-arc.mjs) and the mag-intake.sh shim (the original kept as
// ~/builds/mag-intake.legacy.sh for the VPS and innerstellar).
//
//   node scripts/install-mag-clients.mjs --dry-run            what would change; writes nothing
//   node scripts/install-mag-clients.mjs --apply              back up every original, then install
//   node scripts/install-mag-clients.mjs --restore <backup>   put a backup's originals back
//   node scripts/install-mag-clients.mjs --retire-mag-local [--apply]   M10: archive ~/builds/mag-local once nothing uses it
//   options: --skills-dir <dir> (default ~/.claude/skills), --builds-dir <dir> (default ~/builds),
//            --arc-url <url> (default http://127.0.0.1:8841), --skip-arc-check (tests only)
//
// It refuses, all or nothing, when any installed original is not the one the new version was built
// from (someone changed it since: rebuild with tools/magazine/editorial-pack.mjs / make-page-proxy.mjs),
// and --apply refuses unless AR Create answers with the magazine writable (the new page saves nothing
// without it). The page is not restarted here: `launchctl kickstart -k gui/$(id -u)/com.teajia.mag-page`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const repo = path.resolve(import.meta.dirname, '..');
const EDITORIAL = path.join(repo, 'editorial');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashOf = file => fs.existsSync(file) ? sha(fs.readFileSync(file)) : null;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Every committed version of a repo file, as sha256s. A file on disk that matches one of them was put there by an
 * earlier run of this installer, so a newer version may replace it. Outside a git checkout this knows none.
 */
export function committedVersions(from, {repoDir = repo} = {}) {
  const rel = path.relative(repoDir, from);
  if (rel.startsWith('..')) return [];
  try {
    const commits = execFileSync('git', ['-C', repoDir, 'log', '--format=%H', '--', rel], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).split('\n').filter(Boolean);
    const shas = new Set();
    for (const c of commits) { try { shas.add(sha(execFileSync('git', ['-C', repoDir, 'show', `${c}:${rel}`], {stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024}))); } catch {} }
    return [...shas];
  } catch { return []; }
}

/** Every file to install: {from (repo), to (absolute), originalSha (what it replaces, null for new), mode}. */
export function plan({skillsDir, buildsDir}) {
  const pack = readJson(path.join(EDITORIAL, 'MANIFEST.json')), next = readJson(path.join(EDITORIAL, 'builds-next', 'MANIFEST.json'));
  const sourceSha = new Map([...pack.files.map(f => [f.source.replace('~/.claude/skills/', ''), f.sha256]), ...pack.entries.map(e => [e.source.replace('~/.claude/skills/', ''), e.sha256])]);
  const rows = [];
  const walk = (dir, rel = '') => { for (const e of fs.readdirSync(path.join(dir, rel), {withFileTypes: true})) { const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(dir, r); else if (e.isFile()) rows.push(r); } };
  const skills = path.join(EDITORIAL, 'skills-next'); walk(skills);
  const files = rows.map(r => ({from: path.join(skills, r), to: path.join(skillsDir, r), label: '~/.claude/skills/' + r, originalSha: sourceSha.has(r) ? sourceSha.get(r) : null, isNew: !sourceSha.has(r), mode: 0o644}));
  files.push({from: path.join(EDITORIAL, 'builds-next', 'mag-preview.mjs'), to: path.join(buildsDir, 'mag-preview.mjs'), label: '~/builds/mag-preview.mjs', originalSha: next.files['mag-preview.mjs'].builtFrom.sha256, isNew: false, mode: 0o644});
  files.push({from: path.join(EDITORIAL, 'builds-next', 'mag-arc.mjs'), to: path.join(buildsDir, 'mag-arc.mjs'), label: '~/builds/mag-arc.mjs', originalSha: null, isNew: true, mode: 0o644});
  files.push({from: path.join(buildsDir, 'mag-intake.sh'), to: path.join(buildsDir, 'mag-intake.legacy.sh'), label: '~/builds/mag-intake.legacy.sh (the original, kept for other machines)', originalSha: next.files['mag-intake.sh']?.replaces?.sha256 ?? null, isNew: true, mode: 0o755, keepOriginal: true});
  files.push({from: path.join(EDITORIAL, 'builds-next', 'mag-intake.sh'), to: path.join(buildsDir, 'mag-intake.sh'), label: '~/builds/mag-intake.sh', originalSha: next.files['mag-intake.sh']?.replaces?.sha256 ?? null, isNew: false, mode: 0o755});
  return files;
}

export function inspect(files, {versions = committedVersions} = {}) {
  return files.map(f => {
    const current = hashOf(f.to), source = fs.existsSync(f.from) ? fs.readFileSync(f.from) : null, next = source ? sha(source) : null;
    const ours = !f.keepOriginal && current !== null && current !== next && current !== f.originalSha && versions(f.from).includes(current);
    let action;
    if (!source) action = 'refuse: the new version is missing from the repo';
    else if (f.keepOriginal) action = current !== null ? (current === f.originalSha ? 'already installed' : 'refuse: a different legacy copy is already there') : next === f.originalSha ? 'copy original' : 'refuse: mag-intake.sh is not the original this was built for';
    else if (current === next) action = 'already installed';
    else if (current === null) action = f.isNew ? 'add' : 'refuse: the original is missing';
    else if (ours) action = 'replace';
    else if (f.isNew) action = 'refuse: a file is already there that this did not make';
    else if (f.originalSha && current !== f.originalSha) action = 'refuse: changed since the new version was built';
    else action = 'replace';
    return {...f, current, next, action};
  });
}

async function arcCheck(url) {
  try {
    const r = await fetch(new URL('/api/magazine/board', url), {signal: AbortSignal.timeout(10000)});
    const b = await r.json();
    if (!r.ok) return `AR Create answered ${r.status}: ${b.error || ''}`;
    if (b.writable !== true) return 'AR Create answers, but the magazine is read-only there (magazine.writable is false); the new page would save nothing.';
    return null;
  } catch { return `AR Create does not answer at ${url}; install it (with the magazine configured) first.`; }
}

export async function install({skillsDir, buildsDir, apply = false, arcUrl = 'http://127.0.0.1:8841', skipArcCheck = false, now = new Date()}) {
  const rows = inspect(plan({skillsDir, buildsDir}));
  const refused = rows.filter(r => r.action.startsWith('refuse'));
  const changes = rows.filter(r => ['replace', 'add', 'copy original'].includes(r.action));
  const backup = path.join(buildsDir, '_backups', 'mag-clients-' + now.toISOString().replace(/[:.]/g, '-'));
  const summary = {apply, backup: changes.some(r => r.action === 'replace') ? backup : null, files: rows.map(r => ({file: r.label, action: r.action})), refused: refused.length, changes: changes.length};
  if (!apply) return summary;
  if (refused.length) throw new Error('Nothing was installed; refused:\n' + refused.map(r => `  ${r.label}: ${r.action}`).join('\n'));
  if (!skipArcCheck) { const problem = await arcCheck(arcUrl); if (problem) throw new Error('Nothing was installed. ' + problem); }
  const restore = {schema: 'ar-create.mag-clients-backup.v1', at: now.toISOString(), files: []};
  for (const r of changes.filter(r => r.action === 'replace')) {
    const to = path.join(backup, 'files', r.to.replace(/^\/+/, ''));
    fs.mkdirSync(path.dirname(to), {recursive: true, mode: 0o700});
    fs.copyFileSync(r.to, to, fs.constants.COPYFILE_EXCL);
    restore.files.push({path: r.to, backup: to, sha256: r.current});
  }
  for (const r of changes.filter(r => r.action !== 'replace')) restore.files.push({path: r.to, backup: null, added: true});
  if (restore.files.some(f => f.backup)) fs.writeFileSync(path.join(backup, 'RESTORE.json'), JSON.stringify(restore, null, 1) + '\n', {flag: 'wx'});
  else { fs.mkdirSync(backup, {recursive: true, mode: 0o700}); fs.writeFileSync(path.join(backup, 'RESTORE.json'), JSON.stringify(restore, null, 1) + '\n', {flag: 'wx'}); }
  // Keep the original intake script before the shim replaces it.
  for (const r of [...changes.filter(r => r.keepOriginal), ...changes.filter(r => !r.keepOriginal)]) {
    fs.mkdirSync(path.dirname(r.to), {recursive: true});
    const temporary = path.join(path.dirname(r.to), '.' + path.basename(r.to) + '.' + randomUUID() + '.tmp');
    fs.copyFileSync(r.from, temporary); fs.chmodSync(temporary, r.mode);
    if (hashOf(r.to) !== r.current) { fs.rmSync(temporary); throw new Error(`${r.label} changed during the install; stopped. Restore with --restore ${backup}`); }
    fs.renameSync(temporary, r.to);
  }
  return {...summary, backup, installed: changes.length, next: 'Restart the page: launchctl kickstart -k gui/$(id -u)/com.teajia.mag-page'};
}

/**
 * M10: retire ~/builds/mag-local (moved to ~/builds/_archive, never deleted) only when nothing installed
 * still imports it and AR Create's journal shows a real recording filed through its own intake.
 */
export async function retireMagLocal({buildsDir, skillsDir, arcUrl = 'http://127.0.0.1:8841', apply = false, now = new Date()}) {
  const callers = [];
  const scan = (root, rel = '') => { let entries = []; try { entries = fs.readdirSync(path.join(root, rel), {withFileTypes: true}); } catch { return; }
    for (const e of entries) { const r = rel ? rel + '/' + e.name : e.name; if (/^(_archive|_backups|mag-local|node_modules)$/.test(e.name) || e.name.startsWith('.') || /\.before-/.test(e.name)) continue;
      if (e.isDirectory()) { if (r.split('/').length < 4) scan(root, r); continue; }
      if (/\.(mjs|js|sh|md)$/.test(e.name) && /mag-local\/|startLocalIntake/.test(fs.readFileSync(path.join(root, r), 'utf8'))) callers.push(path.join(root, r)); } };
  scan(buildsDir); scan(skillsDir);
  // Notes and docs in ~/builds that mention mag-local are not callers.
  for (let i = callers.length - 1; i >= 0; i--) if (callers[i].startsWith(buildsDir + path.sep) && callers[i].endsWith('.md')) callers.splice(i, 1);
  let proof = null;
  try { const r = await fetch(new URL('/api/journal?status=committed&limit=1000', arcUrl), {signal: AbortSignal.timeout(10000)}); const j = await r.json(); proof = (j.lines || []).find(l => l.kind === 'magazine.intake.file') || null; } catch {}
  const blockers = [...callers.map(c => 'still uses mag-local: ' + c), ...(proof ? [] : ['no recording has been filed through AR Create yet (magazine.intake.file in its journal)'])];
  const target = path.join(buildsDir, '_archive', 'mag-local-' + now.toISOString().slice(0, 10));
  if (!apply || blockers.length) return {apply: apply && !blockers.length, from: path.join(buildsDir, 'mag-local'), to: target, blockers, proof: proof ? {at: proof.ts, scope: proof.scope} : null};
  fs.mkdirSync(path.dirname(target), {recursive: true}); fs.renameSync(path.join(buildsDir, 'mag-local'), target);
  return {apply: true, movedTo: target, blockers: []};
}

export function restoreBackup(backup) {
  const restore = readJson(path.join(backup, 'RESTORE.json')), done = [];
  for (const f of restore.files) {
    if (f.backup) { fs.copyFileSync(f.backup, f.path); done.push({file: f.path, restored: true}); }
    else if (f.added && fs.existsSync(f.path)) { const keep = path.join(backup, 'removed', path.basename(f.path)); fs.mkdirSync(path.dirname(keep), {recursive: true}); fs.renameSync(f.path, keep); done.push({file: f.path, removedTo: keep}); }
  }
  return {restored: done};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2), opt = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (['--dry-run', '--apply', '--skip-arc-check', '--retire-mag-local'].includes(a)) opt[a.slice(2)] = true; else if (['--restore', '--skills-dir', '--builds-dir', '--arc-url'].includes(a)) opt[a.slice(2)] = argv[++i]; else { console.error('Unknown option ' + a); process.exit(2); } }
  const skillsDir = opt['skills-dir'] || path.join(os.homedir(), '.claude', 'skills'), buildsDir = opt['builds-dir'] || path.join(os.homedir(), 'builds');
  try {
    if (opt.restore) console.log(JSON.stringify(restoreBackup(opt.restore), null, 1));
    else if (opt['retire-mag-local']) console.log(JSON.stringify(await retireMagLocal({skillsDir, buildsDir, arcUrl: opt['arc-url'], apply: !!opt.apply}), null, 1));
    else if (!!opt['dry-run'] === !!opt.apply) throw new Error('Choose --dry-run or --apply (or --restore <backup>).');
    else console.log(JSON.stringify(await install({skillsDir, buildsDir, apply: !!opt.apply, arcUrl: opt['arc-url'], skipArcCheck: !!opt['skip-arc-check']}), null, 1));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
