#!/usr/bin/env node
// Runs only the test files your change can reach, so you hear about most breaks in about a
// minute instead of waiting for CI's full suite. CI still runs every test; this is the quick
// check before you push, not a replacement.
//
// Usage: npm run test:changed            run the reached tests
//        npm run test:changed -- --list  only print which test files would run
//        npm run test:changed -- --base <ref>   compare with <ref> instead of origin/main
//
// "Changed" = files that differ from where your branch left origin/main, plus uncommitted and
// untracked files. A test file is picked when it is changed itself, when it reaches a changed
// file through its local imports (followed through runtime, scripts, helpers and so on), or when
// it or anything it imports names a changed file in a quoted string (tests that spawn a script
// or load a page by path). Run `git fetch origin` first if main has moved a lot.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import os from 'node:os';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim();
process.chdir(root);
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const baseRef = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/main';

const git = (...a) => execFileSync('git', a, {encoding: 'utf8'}).split('\n').map(s => s.trim()).filter(Boolean);
let base;
try { base = git('merge-base', 'HEAD', baseRef)[0]; } catch {
  console.error(`Cannot find where this branch left ${baseRef}. Run \`git fetch origin\`, or pass --base <ref>.`);
  process.exit(2);
}
const changed = [...new Set([
  ...git('diff', '--name-only', base, 'HEAD'),
  ...git('diff', '--name-only', 'HEAD'),
  ...git('ls-files', '--others', '--exclude-standard'),
])];

if (!changed.length) { console.log('Nothing changed from ' + baseRef + '; no tests to run.'); process.exit(0); }

const allTests = fs.readdirSync('tests').filter(f => f.endsWith('.test.mjs')).map(f => 'tests/' + f).sort();

// A dependency or install change can reach anything, so it gets the whole suite. A package.json
// edit that leaves its dependency lists alone (a new npm script, say) does not.
const depsOf = text => { try { const j = JSON.parse(text); return JSON.stringify([j.dependencies, j.devDependencies, j.optionalDependencies, j.overrides, j.engines]); } catch { return null; } };
const whole = changed.filter(f => {
  if (/(^|\/)package-lock\.json$/.test(f)) return true;
  if (!/(^|\/)package\.json$/.test(f)) return false;
  let before = null;
  try { before = execFileSync('git', ['show', `${base}:${f}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}); } catch {}
  const now = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  return before === null || now === null || depsOf(before) !== depsOf(now);
});

// Local import graph: relative specifiers in static imports, re-exports and literal dynamic imports.
const importRe = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const stringRe = /['"`]([^'"`\s]{2,200})['"`]/g;
const cache = new Map();
function read(file) {
  if (!cache.has(file)) {
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch {}
    const imports = [];
    for (const m of text.matchAll(importRe)) {
      const target = path.relative(root, path.resolve(path.dirname(path.resolve(root, file)), m[1].split('?')[0]));
      if (!target.startsWith('..') && !target.includes('node_modules')) imports.push(target);
    }
    const strings = new Set([...text.matchAll(stringRe)].map(m => m[1]));
    cache.set(file, {imports, strings});
  }
  return cache.get(file);
}
function closure(test) {
  const seen = new Set([test]), queue = [test];
  while (queue.length) for (const next of read(queue.shift()).imports) if (!seen.has(next) && /\.(mjs|js|cjs)$/.test(next)) { seen.add(next); queue.push(next); }
  return seen;
}
// A changed file is "named" by a quoted string that ends with its path or its file name.
const named = (strings, file) => {
  const base = path.basename(file);
  for (const s of strings) if (s === file || s.endsWith('/' + file) || s === base || s.endsWith('/' + base)) return true;
  return false;
};

let picked;
let why = new Map();
if (whole.length) {
  picked = allTests;
  console.log(`${whole.join(', ')} changed, so every test file runs.`);
} else {
  picked = allTests.filter(test => {
    const reach = closure(test);
    // A package.json that reached here changed only scripts or metadata; hundreds of tests
    // mention "package.json" by name, so it would otherwise pick most of the suite.
    for (const file of changed.filter(f => !/(^|\/)package\.json$/.test(f))) {
      if (reach.has(file)) { why.set(test, file); return true; }
      for (const f of reach) if (named(read(f).strings, file)) { why.set(test, file); return true; }
    }
    return false;
  });
}

console.log(`${changed.length} changed file(s) since ${baseRef}: ${picked.length} of ${allTests.length} test files reach them.`);
if (listOnly || !picked.length) {
  for (const t of picked) console.log('  ' + t + (why.get(t) ? '  <- ' + why.get(t) : ''));
  if (!picked.length) console.log('No test file reaches these changes. CI still runs the full suite.');
  process.exit(0);
}
if (!fs.existsSync('runtime/article-codec.mjs')) console.log('runtime/article-codec.mjs is missing; run `npm run build` first or about 200 tests fail with a missing module.');

// Two files at a time on macOS, as CI does on the Mac, to keep real Chromium and servers from crowding each other.
const flags = os.platform() === 'darwin' ? ['--test-concurrency=2'] : [];
const started = Date.now();
const run = spawnSync(process.execPath, ['--test', ...flags, ...picked], {stdio: 'inherit'});
console.log(`\ntest:changed: ${picked.length} test files in ${Math.round((Date.now() - started) / 1000)}s, ${run.status === 0 ? 'all passed' : 'FAILED'}. CI runs the full suite.`);
process.exit(run.status ?? 1);
