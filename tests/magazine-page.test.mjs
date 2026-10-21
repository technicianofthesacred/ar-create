// The 8766 page with its saves going through AR Create (editorial/builds-next/mag-preview.mjs), run on
// the test port (8857) against the synthetic vault. The page's own helper modules are linked read-only
// from ~/builds; nothing outside the scratch folder is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {magazineServer} from './helpers/magazine-server.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';

const builds = path.join(os.homedir(), 'builds'), repo = path.resolve(import.meta.dirname, '..');
const LINKED = ['mag-edit.mjs', 'mag-ask.mjs', 'mag-config.mjs', 'mag-local', 'ig-templates.js', 'mag-look.js'];
const missing = LINKED.find(n => !fs.existsSync(path.join(builds, n)));
const PORT = 8857;

async function startPage(t, f, env) {
  const dir = path.join(f.dir, 'page'); fs.mkdirSync(dir, {recursive: true});
  for (const n of ['mag-preview.mjs', 'mag-arc.mjs']) fs.copyFileSync(path.join(repo, 'editorial/builds-next', n), path.join(dir, n));
  for (const n of LINKED) if (!fs.existsSync(path.join(dir, n))) fs.symlinkSync(path.join(builds, n), path.join(dir, n));
  // The page stops itself when its stdin closes: no signal is needed (a sandbox may refuse signals).
  fs.writeFileSync(path.join(dir, 'launch.mjs'), "process.stdin.on('end', () => process.exit(0)); process.stdin.resume(); await import('./mag-preview.mjs');\n");
  const child = spawn(process.execPath, [path.join(dir, 'launch.mjs')], {cwd: dir, env: {...process.env, HOME: path.join(f.dir, 'home'), MAG_VAULT: f.vault, MAG_FILES: f.files, MAG_DROPS: f.drops.join('|'), MAG_PREVIEW_PORT: String(PORT), MAG_TAILNET: '0', ...env}, stdio: ['pipe', 'pipe', 'pipe']});
  fs.mkdirSync(path.join(f.dir, 'home', 'builds'), {recursive: true});
  let log = '';
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('page did not start: ' + log)), 15000); const on = c => { log += c; if (/Magazine page:/.test(log)) { clearTimeout(timer); resolve(); } }; child.stdout.on('data', on); child.stderr.on('data', on); child.on('exit', code => { clearTimeout(timer); reject(new Error('page exited ' + code + ': ' + log)); }); });
  const stop = () => new Promise(r => { if (child.exitCode !== null) return r(); child.once('exit', r); child.stdin.end(); });
  t.after(stop);
  const post = async (route, body) => { const r = await fetch(`http://127.0.0.1:${PORT}${route}`, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: `http://127.0.0.1:${PORT}`}, body: JSON.stringify(body)}); return {status: r.status, body: await r.json()}; };
  return {post, stop};
}

test('the page saves through AR Create as Adrian (client mag-page); a held lock shows its holder; AR Create down saves nothing', {skip: missing && `~/builds/${missing} is not on this machine`}, async t => {
  const s = await magazineServer(t);
  const page = await startPage(t, s.f, {MAG_ARC_URL: s.url});
  const ask = 'Workflow/ASK - Clay Teacher.md';
  const a = await page.post('/answer', {file: ask, index: 0, title: 'The title', value: 'Open It Together'});
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.match(fs.readFileSync(path.join(s.f.vault, ask), 'utf8'), /- \[x\] Open It Together/);
  const line = s.journal().find(l => l.kind === 'magazine.ask.answer');
  assert.equal(line.actor, 'human:adrian'); assert.equal(line.client, 'mag-page');
  assert.equal((await page.post('/make', {kind: 'Reel', story: 'Clay Teacher'})).status, 200);
  assert.match(fs.readFileSync(path.join(s.f.vault, 'Workflow/5-Social/REQUESTS.md'), 'utf8'), /Reel · Clay Teacher/);
  const stale = await page.post('/lineup', {file: 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire.md', hash: '0'.repeat(64), slides: [{role: 'cover', text: 'x'}], caption: ''});
  assert.equal(stale.status, 409, 'a lineup saved against an older page is refused, not written over');
  fs.writeFileSync(path.join(s.f.vault, 'Workflow/_mag-running.md'), `machine: innerstellar\nsince: ${new Date().toISOString()}\ndoing: step 5, River Potter\n`);
  const held = await page.post('/redo', {step: 'Map', story: 'River Potter'});
  assert.equal(held.status, 423); assert.match(held.body.error, /innerstellar/);
  assert.doesNotMatch(fs.readFileSync(path.join(s.f.vault, 'Workflow/5-Social/REQUESTS.md'), 'utf8'), /Redo Map/);
  assert.equal((await page.post('/transcription/00000000-0000-0000-0000-000000000000/save', {})).status, 409, 'the old workshop saves are off');
  await page.stop();
  fs.rmSync(path.join(s.f.vault, 'Workflow/_mag-running.md'));
  const down = await startPage(t, s.f, {MAG_ARC_URL: 'http://127.0.0.1:9'});
  const before = fs.readFileSync(path.join(s.f.vault, 'Workflow/5-Social/REQUESTS.md'), 'utf8');
  const r = await down.post('/make', {kind: 'Post', story: 'River Potter'});
  assert.equal(r.status, 503); assert.match(r.body.error, /AR Create is not running/);
  assert.equal(fs.readFileSync(path.join(s.f.vault, 'Workflow/5-Social/REQUESTS.md'), 'utf8'), before);
});

test('off the Mac (legacy mode) the page writes as before, but only inside the shared lock', {skip: missing && `~/builds/${missing} is not on this machine`}, async t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const page = await startPage(t, f, {MAG_ARC: 'legacy'});
  assert.equal((await page.post('/make', {kind: 'Post', story: 'River Potter'})).status, 200);
  assert.match(fs.readFileSync(path.join(f.vault, 'Workflow/5-Social/REQUESTS.md'), 'utf8'), /Post · River Potter/);
  assert.ok(!fs.existsSync(path.join(f.vault, 'Workflow/_mag-running.md')), 'the lock is released after the save');
  fs.writeFileSync(path.join(f.vault, 'Workflow/_mag-running.md'), `machine: studio-mac\nsince: ${new Date().toISOString()}\ndoing: AR Create write\nholder: ar-create\n`);
  const held = await page.post('/make', {kind: 'Reel', story: 'River Potter'});
  assert.equal(held.status, 423); assert.match(held.body.error, /studio-mac/);
  assert.doesNotMatch(fs.readFileSync(path.join(f.vault, 'Workflow/5-Social/REQUESTS.md'), 'utf8'), /Reel · River Potter/);
});
