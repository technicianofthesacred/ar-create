import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {checkQuotes, checkSplits} from '../runtime/services/magazine-vault/checks.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';

const builds = path.join(os.homedir(), 'builds');
const SRC = 'Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md', CONTEXT = 'Workflow/1-Source/CONTEXT - Clay Teacher.md';
const DRAFTS = {
  'Workflow/3-Develop/DEV - Clay Teacher (story).md': null, // the fixture's: one quote is not in the transcript
  'Workflow/3-Develop/DEV - Clay Teacher (split).md': '---\ntype: DEV\n---\n\nmeta\n\n---\n\n"The clay remembers every hand that pressed it, so I never hurry the wedging."\n\n%%photo: kiln.jpg%%\n\n"You have to listen to it before you shape it."\n\n---\n',
  'Workflow/3-Develop/DEV - Clay Teacher (clean).md': '---\ntype: DEV\n---\n\nmeta\n\n---\n\n**Mira:**\n\nIt tells me whether the fire was kind.\n\n"Some years it [is kind] and some years it teaches us patience."\n\n"I came for the cups and stayed for the silence."\n\n> "nobody speaks until the first cup is out"\n\n---\n',
};
const extra = Object.fromEntries(Object.entries(DRAFTS).filter(([, v]) => v));

test('quote and split checks equal the ~/builds scripts on three drafts', {skip: !fs.existsSync(path.join(builds, 'mag-check-quotes.mjs')) && 'the ~/builds checks are not on this machine'}, t => {
  const f = buildMagazineFixture({extra}); t.after(f.cleanup);
  const at = rel => path.join(f.vault, rel), read = rel => fs.readFileSync(at(rel), 'utf8');
  const run = (script, args) => { try { return {code: 0, out: execFileSync(process.execPath, [path.join(builds, script), ...args], {encoding: 'utf8'})}; } catch (e) { return {code: e.status, out: e.stdout}; } };
  for (const dev of Object.keys(DRAFTS)) {
    const q = checkQuotes(read(dev), read(SRC), [read(CONTEXT)]), theirs = run('mag-check-quotes.mjs', [at(dev), at(SRC), at(CONTEXT)]);
    assert.equal(q.lines.join('\n') + '\n', theirs.out, dev); assert.equal(q.ok ? 0 : 1, theirs.code, dev);
    const s = checkSplits(read(dev), read(SRC)), split = run('mag-check-splits.mjs', [at(dev), at(SRC)]);
    assert.equal(s.lines.map(l => l + '\n').join(''), split.out, dev);
  }
});

test('magazine.check runs both checks on a draft, finding its transcript and context from the board', t => {
  const f = buildMagazineFixture({extra}); t.after(f.cleanup);
  const vault = createMagazineVault({vaultRoot: f.vault, dataDir: f.data, writable: false});
  const r = vault.extra.checks.run({draft: 'Workflow/3-Develop/DEV - Clay Teacher (story).md'});
  assert.equal(r.source.path, SRC); assert.deepEqual(r.context.map(c => c.path), [CONTEXT]);
  assert.equal(r.quotes.ok, false); assert.deepEqual(r.quotes.notFound, ['The river taught me to throw thin walls.']);
  const split = vault.extra.checks.run({draft: 'Workflow/3-Develop/DEV - Clay Teacher (split).md', source: SRC});
  assert.equal(split.splits.splits.length, 1); assert.deepEqual(split.splits.splits[0].across, ['photo']);
  const clean = vault.extra.checks.run({draft: 'Workflow/3-Develop/DEV - Clay Teacher (clean).md', source: SRC, context: CONTEXT});
  assert.equal(clean.quotes.ok, true, JSON.stringify(clean.quotes));
});
