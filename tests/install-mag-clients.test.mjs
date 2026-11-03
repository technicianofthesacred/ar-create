import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {install, restoreBackup, plan, inspect, committedVersions} from '../scripts/install-mag-clients.mjs';
import {treeHashes, SCRATCH} from './helpers/magazine-fixture.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const home = os.homedir(), realSkills = path.join(home, '.claude', 'skills'), realBuilds = path.join(home, 'builds');
// A copy of the installed originals (read-only), so the installer can be run for real on scratch folders.
function scratchCopies(t) {
  const dir = path.join(SCRATCH, 'install-' + process.pid + '-' + Date.now()), skills = path.join(dir, 'skills'), builds = path.join(dir, 'builds');
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const f of plan({skillsDir: skills, buildsDir: builds})) {
    if (f.keepOriginal || f.isNew) continue;
    const real = f.to.startsWith(skills) ? path.join(realSkills, path.relative(skills, f.to)) : path.join(realBuilds, path.relative(builds, f.to));
    if (!fs.existsSync(real) || (f.originalSha && sha(fs.readFileSync(real)) !== f.originalSha)) return null;
    fs.mkdirSync(path.dirname(f.to), {recursive: true}); fs.copyFileSync(real, f.to);
  }
  return {dir, skills, builds};
}

test('install-mag-clients: dry run writes nothing; apply backs up, installs, keeps the original intake; restore puts it all back', async t => {
  const c = scratchCopies(t); if (!c) return t.skip('the installed originals changed since the new versions were built (or are not on this machine)');
  const before = {...treeHashes(c.skills), ...Object.fromEntries(Object.entries(treeHashes(c.builds)).map(([k, v]) => ['b/' + k, v]))};
  const dry = await install({skillsDir: c.skills, buildsDir: c.builds});
  assert.equal(dry.refused, 0); assert.ok(dry.changes >= 10);
  assert.deepEqual({...treeHashes(c.skills), ...Object.fromEntries(Object.entries(treeHashes(c.builds)).map(([k, v]) => ['b/' + k, v]))}, before);
  const originalIntake = fs.readFileSync(path.join(c.builds, 'mag-intake.sh'));
  const done = await install({skillsDir: c.skills, buildsDir: c.builds, apply: true, skipArcCheck: true});
  assert.equal(done.installed, dry.changes);
  assert.match(fs.readFileSync(path.join(c.skills, 'mag/SKILL.md'), 'utf8'), /AR Create is the magazine's one writer/);
  assert.ok(fs.existsSync(path.join(c.skills, 'mag/stages/legacy.md')));
  assert.equal(sha(fs.readFileSync(path.join(c.builds, 'mag-intake.legacy.sh'))), sha(originalIntake));
  assert.match(fs.readFileSync(path.join(c.builds, 'mag-preview.mjs'), 'utf8'), /from '\.\/mag-arc\.mjs'/);
  assert.ok((fs.statSync(path.join(c.builds, 'mag-intake.sh')).mode & 0o111) !== 0, 'the shim stays executable');
  const again = await install({skillsDir: c.skills, buildsDir: c.builds});
  assert.equal(again.changes, 0); assert.ok(again.files.every(f => f.action === 'already installed'));
  restoreBackup(done.backup);
  for (const [rel, hash] of Object.entries(before)) assert.equal(rel.startsWith('b/') ? sha(fs.readFileSync(path.join(c.builds, rel.slice(2)))) : sha(fs.readFileSync(path.join(c.skills, rel))), hash, rel);
  assert.ok(!fs.existsSync(path.join(c.builds, 'mag-arc.mjs')) && !fs.existsSync(path.join(c.skills, 'mag/stages/legacy.md')), 'added files are moved into the backup, not left behind');
});

test('install-mag-clients refuses everything when one original changed since the new version was built', async t => {
  const c = scratchCopies(t); if (!c) return t.skip('originals unavailable');
  fs.appendFileSync(path.join(c.skills, 'mag/stages/tidy.md'), '\nAn edit made after the pack was built.\n');
  const dry = await install({skillsDir: c.skills, buildsDir: c.builds});
  assert.ok(dry.files.some(f => f.file.endsWith('mag/stages/tidy.md') && /changed since/.test(f.action)));
  const before = treeHashes(c.skills);
  await assert.rejects(install({skillsDir: c.skills, buildsDir: c.builds, apply: true, skipArcCheck: true}), /Nothing was installed/);
  assert.deepEqual(treeHashes(c.skills), before);
});

test('install-mag-clients --apply refuses unless AR Create answers with the magazine writable', async t => {
  const c = scratchCopies(t); if (!c) return t.skip('originals unavailable');
  await assert.rejects(install({skillsDir: c.skills, buildsDir: c.builds, apply: true, arcUrl: 'http://127.0.0.1:9'}), /does not answer/);
  assert.ok(!fs.existsSync(path.join(c.builds, 'mag-arc.mjs')));
});

test('install-mag-clients replaces a file it installed itself earlier, and still refuses one someone else changed', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-clients-ours-')); t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const write = (name, text) => { const file = path.join(dir, name); fs.writeFileSync(file, text); return file; };
  const original = 'the pre-switch original\n', earlier = 'the thin skill as installed this morning\n', next = 'the thin skill with the Simmer section\n';
  const from = write('next.md', next);
  const row = (to, extra = {}) => ({from, to, label: path.basename(to), originalSha: sha(original), isNew: false, mode: 0o644, ...extra});
  const versions = file => (file === from ? [sha(earlier), sha(next)] : []);
  const [ours, theirs, untouched, addedEarlier, addedByHand] = inspect([
    row(write('ours.md', earlier)),
    row(write('theirs.md', 'edited by hand since\n')),
    row(write('untouched.md', original)),
    row(write('added-earlier.md', earlier), {originalSha: null, isNew: true}),
    row(write('added-by-hand.md', 'someone else\'s file\n'), {originalSha: null, isNew: true}),
  ], {versions});
  assert.equal(ours.action, 'replace');
  assert.equal(theirs.action, 'refuse: changed since the new version was built');
  assert.equal(untouched.action, 'replace');
  assert.equal(addedEarlier.action, 'replace');
  assert.equal(addedByHand.action, 'refuse: a file is already there that this did not make');
});

test('committedVersions knows every committed version of a shipped skill file', () => {
  const from = path.resolve(import.meta.dirname, '..', 'editorial', 'skills-next', 'arcreate', 'SKILL.md');
  const versions = committedVersions(from);
  if (!versions.length) return; // not a git checkout (an installed copy)
  assert.ok(versions.includes(sha(fs.readFileSync(from))), 'the committed file is one of its versions');
  assert.deepEqual(committedVersions(path.join(os.tmpdir(), 'outside.md')), []);
});
