// The Make rules come from the release's own editorial/ files; editorialSkillsDir stays an override.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ARTICLE_RULES, CAROUSEL_RULES, EDITORIAL_ROOT, ruleLocation} from '../runtime/services/editorial-rules.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const withEnv = (values, fn) => { const old = {}; for (const k of Object.keys(values)) { old[k] = process.env[k]; if (values[k] === null) delete process.env[k]; else process.env[k] = values[k]; } try { return fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } } };

test('the editorial folder is the repo\'s own, next to runtime/', () => { assert.equal(EDITORIAL_ROOT, path.join(repo, 'editorial')); });

test('with no override, every rule the article and carousel makers read is a file in editorial/ (the magazine pair excepted)', () => {
  withEnv({AR_CREATE_EDITORIAL_SKILL_ROOT: null, AR_CREATE_MAGAZINE_ROOT: null}, () => {
    for (const name of new Set([...ARTICLE_RULES, ...CAROUSEL_RULES])) {
      if (/TEMPLATE|SYSTEM/.test(name)) continue;
      const {root, rel} = ruleLocation(name);
      assert.equal(root, EDITORIAL_ROOT, name);
      assert.ok(fs.statSync(path.join(root, rel)).isFile(), `${name} -> ${rel}`);
      assert.ok(!root.includes('.claude'), 'nothing is read from ~/.claude/skills');
    }
    assert.deepEqual(ruleLocation('mag/stages/source.md'), {root: EDITORIAL_ROOT, rel: 'stages/mag/source.md'});
    assert.deepEqual(ruleLocation('arcreate/stages/make.md'), {root: EDITORIAL_ROOT, rel: 'stages/arcreate/make.md'});
    assert.deepEqual(ruleLocation('mag/LESSONS.md'), {root: EDITORIAL_ROOT, rel: 'LESSONS.md'});
    assert.deepEqual(ruleLocation('arcreate/brands/teajia.md'), {root: EDITORIAL_ROOT, rel: 'brands/teajia.md'});
    assert.throws(() => ruleLocation('mag/stages/unknown-stage.sh'), /No editorial rule file/);
    assert.throws(() => ruleLocation('mag/stages/../../x.md'), /No editorial rule file/);
  });
});

test('TEMPLATE.md and SYSTEM.md come from the configured magazine folder, and say so when there is none', () => {
  withEnv({AR_CREATE_EDITORIAL_SKILL_ROOT: null, AR_CREATE_MAGAZINE_ROOT: '/srv/example/Magazine'}, () => {
    assert.deepEqual(ruleLocation('mag/TEMPLATE.md'), {root: '/srv/example/Magazine', rel: 'TEMPLATE.md'});
    assert.deepEqual(ruleLocation('mag/SYSTEM.md'), {root: '/srv/example/Magazine', rel: 'SYSTEM.md'});
  });
  withEnv({AR_CREATE_EDITORIAL_SKILL_ROOT: null, AR_CREATE_MAGAZINE_ROOT: null}, () => assert.throws(() => ruleLocation('mag/SYSTEM.md'), /magazine\.vaultRoot/));
});

test('editorialSkillsDir overrides: the older layout wins, and the magazine pair falls back only when the override lacks it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-skills-'));
  try {
    fs.mkdirSync(path.join(dir, 'mag'), {recursive: true}); fs.writeFileSync(path.join(dir, 'mag/SYSTEM.md'), 'x');
    withEnv({AR_CREATE_EDITORIAL_SKILL_ROOT: dir, AR_CREATE_MAGAZINE_ROOT: '/srv/example/Magazine'}, () => {
      assert.deepEqual(ruleLocation('mag/stages/source.md'), {root: dir, rel: 'mag/stages/source.md'});
      assert.deepEqual(ruleLocation('arcreate/brands/teajia.md', {skillRoot: dir}), {root: dir, rel: 'arcreate/brands/teajia.md'});
      assert.deepEqual(ruleLocation('mag/SYSTEM.md'), {root: dir, rel: 'mag/SYSTEM.md'}, 'present in the override');
      assert.deepEqual(ruleLocation('mag/TEMPLATE.md'), {root: '/srv/example/Magazine', rel: 'TEMPLATE.md'}, 'missing in the override: the magazine');
      // A folder passed explicitly (a disposable fixture) stays self-contained.
      assert.deepEqual(ruleLocation('mag/TEMPLATE.md', {skillRoot: path.join(dir, 'fixture')}), {root: path.join(dir, 'fixture'), rel: 'mag/TEMPLATE.md'});
    });
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the carousel guide is always the repo\'s own, even when an older skill folder overrides the rest', () => {
  assert.ok(CAROUSEL_RULES.includes('arcreate/stages/carousel-guide.md'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-skills-'));
  try {
    withEnv({AR_CREATE_EDITORIAL_SKILL_ROOT: dir, AR_CREATE_MAGAZINE_ROOT: null}, () => {
      assert.deepEqual(ruleLocation('arcreate/stages/carousel-guide.md'), {root: EDITORIAL_ROOT, rel: 'stages/arcreate/carousel-guide.md'});
      assert.deepEqual(ruleLocation('arcreate/stages/carousel-guide.md', {skillRoot: dir}), {root: EDITORIAL_ROOT, rel: 'stages/arcreate/carousel-guide.md'});
      assert.deepEqual(ruleLocation('arcreate/stages/make.md'), {root: dir, rel: 'arcreate/stages/make.md'}, 'the others still follow the override');
    });
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  const guide = fs.readFileSync(path.join(EDITORIAL_ROOT, 'stages/arcreate/carousel-guide.md'), 'utf8');
  for (const part of ['## 1. The cover', '## 2. The swipe', '## 3. The visuals', '## The scroll test']) assert.ok(guide.includes(part), part);
  assert.doesNotMatch(guide, /\u2014/, 'no em dashes in Adrian\'s guide');
});

test('the two makers read their rules through the resolver, not from ~/.claude/skills', () => {
  for (const file of ['article-make.mjs', 'carousel-make.mjs']) {
    const text = fs.readFileSync(path.join(repo, 'runtime/services', file), 'utf8');
    assert.match(text, /editorial-rules\.mjs/, file);
    assert.doesNotMatch(text, /'\.claude'|homedir/, file + ' has no hard-coded home skills folder');
  }
});

test('both makers still load', async () => {
  assert.equal(typeof (await import('../runtime/services/article-make.mjs')).createArticleMake, 'function');
  assert.equal(typeof (await import('../runtime/services/carousel-make.mjs')).createCarouselMake, 'function');
});
