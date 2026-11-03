import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPack, PACK, REPO_ONLY, EDITORIAL} from '../tools/magazine/editorial-pack.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';

test('editorial/ holds every stage file, LESSONS and brand profile, each matching its manifest hash', t => {
  const skills = path.join(os.homedir(), '.claude', 'skills');
  const result = verifyPack({skills: fs.existsSync(skills) ? skills : null});
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.equal(result.files, PACK.length + REPO_ONLY.length);
  for (const to of [...PACK.map(([p]) => p), ...REPO_ONLY]) assert.ok(fs.statSync(path.join(EDITORIAL, to)).isFile(), to);
  if (result.drift.length) t.diagnostic('Installed skills changed since the copy (the coordinator re-copies before installing): ' + result.drift.join(', '));
});

test('brand.read returns the Teajia profile from editorial/ with its hash', t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const vault = createMagazineVault({vaultRoot: f.vault, dataDir: f.data, editorialRoot: EDITORIAL});
  const brand = vault.brandRead({id: 'teajia'});
  assert.equal(brand.hash, createHash('sha256').update(fs.readFileSync(path.join(EDITORIAL, 'brands/teajia.md'))).digest('hex'));
  assert.throws(() => vault.brandRead({id: '../x'}), e => e.status === 400);
  assert.throws(() => vault.brandRead({id: 'nobody'}), e => e.status === 404);
});

test('brand.read serves the art, Mandala Codes and personal profiles (door notes, 3 Nov 2026)', t => {
  const f = buildMagazineFixture(); t.after(f.cleanup);
  const vault = createMagazineVault({vaultRoot: f.vault, dataDir: f.data, editorialRoot: EDITORIAL});
  for (const id of ['art', 'mandala-codes', 'personal']) {
    const brand = vault.brandRead({id});
    assert.equal(brand.path, 'editorial/brands/' + id + '.md');
    assert.match(brand.text, /^\*\*Covers:\*\*/m, id);
    assert.ok(fs.existsSync(path.join(EDITORIAL, 'skills-next', 'arcreate', 'brands', id + '.md')), id + ' installs with /arcreate');
  }
});
