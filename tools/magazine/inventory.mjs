#!/usr/bin/env node
// Read-only inventory of the magazine folders: every file's path, size, sha256, kind and frontmatter
// keys under MAG, every file's path, size and sha256 under FILES, and the transcription jobs. It never
// prints or saves body text, and it opens every file read-only.
//
//   node tools/magazine/inventory.mjs --mag <MAG> --files <FILES> [--out <file.json>]
//
// stdout: a summary (counts per kind, stories, anything unparseable). --out: the full inventory, which
// register.mjs compares before and after to prove registration changed no byte.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {scanVault} from '../../runtime/services/magazine-vault/projects.mjs';

const hashFile = file => new Promise((resolve, reject) => { const h = createHash('sha256'); fs.createReadStream(file).on('data', c => h.update(c)).on('error', reject).on('end', () => resolve(h.digest('hex'))); });

export async function inventoryFiles(root) {
  const out = [];
  if (!root || !fs.existsSync(root)) return out;
  const walk = async rel => {
    for (const entry of fs.readdirSync(path.join(root, rel), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.DS_Store' || entry.name === '.stfolder') continue;
      const r = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { await walk(r); continue; }
      if (!entry.isFile()) { out.push({rel: r, special: true}); continue; }
      const abs = path.join(root, r);
      out.push({rel: r, size: fs.statSync(abs).size, sha256: await hashFile(abs)});
    }
  };
  await walk('');
  return out;
}

export async function inventory({mag, files}) {
  if (!mag || !fs.statSync(mag).isDirectory()) throw new Error('--mag must name the magazine folder.');
  const vault = scanVault(mag);
  const filesList = await inventoryFiles(files);
  const perKind = {}, perClass = {};
  for (const f of vault) { perKind[f.kind || '(other)'] = (perKind[f.kind || '(other)'] || 0) + 1; perClass[f.class || '(not written by AR Create)'] = (perClass[f.class || '(not written by AR Create)'] || 0) + 1; }
  const jobs = filesList.filter(f => /^\.transcription-jobs\/[a-f0-9-]{36}\.json$/.test(f.rel)).length;
  return {
    schema: 'ar-create.magazine-inventory.v1', createdAt: new Date().toISOString(),
    mag: {root: mag, fileCount: vault.length, files: vault.map(({aliases, title, ...rest}) => rest)},
    filesRoot: {root: files || null, fileCount: filesList.length, totalBytes: filesList.reduce((n, f) => n + (f.size || 0), 0), files: filesList, transcriptionJobs: jobs},
    summary: {perKind, perClass, unparseable: vault.filter(f => f.parse !== 'ok').map(f => f.rel), special: filesList.filter(f => f.special).map(f => f.rel), transcriptionJobs: jobs},
  };
}

/** Files whose hash, size or presence differs between two inventories. */
export function diffInventories(before, after) {
  const changes = [];
  for (const [label, a, b] of [['mag', before.mag.files, after.mag.files], ['files', before.filesRoot.files, after.filesRoot.files]]) {
    const left = new Map(a.map(f => [f.rel, f.sha256])), right = new Map(b.map(f => [f.rel, f.sha256]));
    for (const [rel, hash] of left) if (!right.has(rel)) changes.push({root: label, rel, change: 'removed'}); else if (right.get(rel) !== hash) changes.push({root: label, rel, change: 'changed'});
    for (const rel of right.keys()) if (!left.has(rel)) changes.push({root: label, rel, change: 'added'});
  }
  return changes;
}

export function parseFlags(argv, allowed) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`Unexpected argument ${a}.`);
    const key = a.slice(2), spec = allowed[key];
    if (spec === undefined) throw new Error(`Unknown option ${a}.`);
    if (spec === 'flag') out[key] = true; else { if (argv[i + 1] === undefined) throw new Error(`${a} needs a value.`); out[key] = argv[++i]; }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const flags = parseFlags(process.argv.slice(2), {mag: 'value', files: 'value', out: 'value'});
    const result = await inventory({mag: flags.mag, files: flags.files});
    if (flags.out) fs.writeFileSync(flags.out, JSON.stringify(result, null, 1) + '\n', {mode: 0o600});
    console.log(JSON.stringify({mag: result.mag.root, magFiles: result.mag.fileCount, filesRoot: result.filesRoot.root, filesFiles: result.filesRoot.fileCount, filesBytes: result.filesRoot.totalBytes, ...result.summary, out: flags.out || null}, null, 1));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
