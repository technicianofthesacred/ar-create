import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createMagazineMechanicalChecks} from '../runtime/services/magazine-mechanical-checks.mjs';
import {withActor} from '../runtime/services/actor.mjs';

const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const SRC = 'Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md';
const CONTEXT = 'Workflow/1-Source/CONTEXT - Clay Teacher.md';
const SIBLING = 'Workflow/1-Source/SRC - River Potter.md';
const identity = {parentStudyId: 'native-parent', storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article'};
const sha = v => createHash('sha256').update(v).digest('hex');
const human = fn => withActor({actor: 'human:adrian', client: 'ui'}, fn);
const hasStatus = status => error => error.status === status;
function setup(t, options = {}) {
  const f = buildMagazineFixture(options); t.after(f.cleanup);
  const plan = planRegistration({vault: f.vault, files: f.files});
  fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
  fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  const magazine = createMagazineVault({vaultRoot: f.vault, filesRoot: f.files, dataDir: f.data, writable: true, machine: 'synthetic-mechanical'});
  const working = createWorkingDraftBridge({magazine});
  const config = {parentStudyKey: identity.parentStudyId, partKey: 'article', path: DEV, support: [[SRC, 'source'], [CONTEXT, 'author context']]};
  const originalsFor = (entry = config) => createStudyOriginals({vaultRoot: f.vault, filesRoot: f.files, catalog: {projects: {}, drafts: {invented: entry}}});
  const originals = originalsFor();
  const service = (opts = {}) => createMagazineMechanicalChecks({dataDir: f.data, magazine, working, originals, enabled: true, ...opts});
  const inputs = async (owner = originals) => {
    const expectedDraftHash = sha(fs.readFileSync(path.join(f.vault, DEV)));
    const i = owner.checkInputs({parentStudyKey: identity.parentStudyId, partKey: 'article', draftPath: DEV, expectedDraftHash});
    return {...identity, expectedDraftHash, expectedInputRevision: i.revision, operationId: randomUUID()};
  };
  const projectFile = path.join(f.data, 'magazine/projects', identity.storyId + '.json');
  const projectChange = fn => { const p = JSON.parse(fs.readFileSync(projectFile)); fn(p); fs.writeFileSync(projectFile, JSON.stringify(p)); };
  const receiptFiles = () => fs.readdirSync(path.join(f.data, 'magazine/mechanical-checks'), {recursive: true}).map(p => path.join(f.data, 'magazine/mechanical-checks', p)).filter(p => p.endsWith('.json') && !p.endsWith('current.json'));
  return {f, magazine, working, originals, originalsFor, config, service, inputs, projectChange, receiptFiles};
}
function rewriteReceipt(file, fn) {
  const r = JSON.parse(fs.readFileSync(file)); fn(r);
  delete r.integritySha256; r.integritySha256 = sha(JSON.stringify(r));
  fs.writeFileSync(file, JSON.stringify(r), {mode: 0o600});
}

test('opening Check and pure checks create no receipts; persistence is default-off and human-only', async t => {
  const f = setup(t), before = treeHashes(f.f.data), vault = treeHashes(f.f.vault);
  const disabled = f.service({enabled: false}), args = await f.inputs();
  assert.deepEqual(await disabled.read(identity), {schema: 'ar-create.magazine-mechanical-check-response.v1', available: false, record: null});
  f.magazine.extra.checks.run({draft: DEV, source: SRC, context: [CONTEXT]});
  await assert.rejects(human(async () => disabled.run(args)), hasStatus(423));
  const defaultOff = createMagazineMechanicalChecks({dataDir: f.f.data, magazine: f.magazine, working: f.working, originals: f.originals});
  await assert.rejects(defaultOff.run(args), hasStatus(423));
  await assert.rejects(withActor({actor: 'agent:codex', client: 'cli'}, () => f.service().run(args)), hasStatus(403));
  assert.deepEqual(treeHashes(f.f.data), before); assert.deepEqual(treeHashes(f.f.vault), vault);
});

test('real checks save exact durable proof/result, survive a new owner and preserve vault, mtimes and existing saved Undo', async t => {
  const f = setup(t), view = await f.working.read({storyId: identity.storyId, pieceId: identity.pieceId, edition: 'working'});
  const save = await human(async () => f.working.save({storyId: identity.storyId, pieceId: identity.pieceId, edition: 'working', expectedHash: view.document.hash, content: view.document.text + '\nA saved invented closing line.\n', operationId: randomUUID()}));
  const vault = treeHashes(f.f.vault), data = treeHashes(f.f.data), times = Object.keys(vault).map(p => [p, fs.statSync(path.join(f.f.vault, p)).mtimeMs]);
  const pure = f.magazine.extra.checks.run({draft: DEV, source: SRC, context: [CONTEXT]});
  const args = await f.inputs(), saved = await human(async () => f.service().run(args));
  assert.equal(saved.available, true); assert.equal(saved.record.status, 'needs-review'); assert.equal(saved.record.persisted, true);
  assert.deepEqual(saved.record.result, pure); assert.equal(saved.record.proof.parentStudyId, identity.parentStudyId);
  assert.equal(saved.record.proof.inputRevision, args.expectedInputRevision); assert.match(saved.record.proof.checkerRevision, /^[0-9a-f]{64}$/);
  assert.equal(saved.record.scope.editorialApproval, 'not-granted'); assert.ok(!JSON.stringify(saved.record).includes(f.f.vault));
  assert.deepEqual((await f.service().read(identity)).record, saved.record);
  assert.deepEqual((await f.service().read({...identity, checkId: args.operationId})).record, saved.record);
  assert.deepEqual(treeHashes(f.f.vault), vault); assert.deepEqual(times.map(([p]) => [p, fs.statSync(path.join(f.f.vault, p)).mtimeMs]), times);
  for (const [p, h] of Object.entries(data)) assert.equal(treeHashes(f.f.data)[p], h, p);
  assert.equal((await human(async () => f.working.eligibleUndo({storyId: identity.storyId, pieceId: identity.pieceId, edition: 'working', operationId: save.operationId}))).eligible, true);
});

test('same operation replays without execution or pointer regression; changed request reuse conflicts', async t => {
  const f = setup(t), checker = f.magazine.extra.checks.run; let count = 0;
  f.magazine.extra.checks.run = input => { count++; return checker(input); };
  const service = f.service(), args = await f.inputs(), first = await human(async () => service.run(args));
  const secondArgs = await f.inputs(), second = await human(async () => service.run(secondArgs));
  assert.deepEqual((await human(async () => f.service().run(args))).record, first.record); assert.equal(count, 2);
  assert.equal((await service.read(identity)).record.checkId, second.record.checkId);
  await assert.rejects(human(async () => service.run({...args, expectedInputRevision: 'a'.repeat(64)})), hasStatus(409));
  fs.appendFileSync(path.join(f.f.vault, DEV), '\nNew wording.\n');
  assert.equal((await human(async () => service.run(args))).record.status, 'stale'); assert.equal(count, 2);
});

test('draft, source, context, configured relationships and checker revisions stale saved checks; siblings do not', async t => {
  for (const target of [DEV, SRC, CONTEXT, SIBLING]) await t.test(target, async t => {
    const f = setup(t), service = f.service(); await human(async () => service.run(await f.inputs()));
    fs.appendFileSync(path.join(f.f.vault, target), '\nNew invented words.\n');
    const data = treeHashes(f.f.data), read = await service.read(identity);
    assert.equal(read.record.status, target === SIBLING ? 'needs-review' : 'stale'); assert.deepEqual(treeHashes(f.f.data), data);
  });
  const f = setup(t); await human(async () => f.service().run(await f.inputs()));
  const altered = f.originalsFor({...f.config, support: [[SRC, 'source']]});
  assert.equal((await f.service({originals: altered}).read(identity)).record.status, 'stale');
  f.projectChange(p => { p.vaultRecords.src = []; });
  assert.equal((await f.service().read(identity)).record.status, 'stale');
  const checker = setup(t), saved = await human(async () => checker.service().run(await checker.inputs()));
  const originalRead = fs.readFileSync;
  const mock = t.mock.method(fs, 'readFileSync', function(file, ...args) { const raw = originalRead.call(this, file, ...args); return String(file).endsWith('/magazine-vault/checks.mjs') ? Buffer.concat([Buffer.from(raw), Buffer.from('\n// changed checker\n')]) : raw; });
  assert.equal((await checker.service().read(identity)).record.status, 'stale'); mock.mock.restore();
  assert.equal((await checker.service().read(identity)).record.checkId, saved.record.checkId);
});

test('exact input guards refuse forged fields, wrong owners, missing joins, duplicates and stale expectations', async t => {
  const f = setup(t), service = f.service(), args = await f.inputs(), before = treeHashes(f.f.data);
  for (const extra of [{path: DEV}, {result: {}}, {status: 'checked'}, {scope: {}}, {artifactId: 'browser-claim'}]) await assert.rejects(human(async () => service.run({...args, ...extra})), hasStatus(400));
  for (const input of [{...args, expectedDraftHash: 'b'.repeat(64)}, {...args, expectedInputRevision: 'b'.repeat(64)}, {...args, parentStudyId: 'wrong-parent'}, {...args, pieceId: 'mag-clay-teacher:part-99'}]) await assert.rejects(human(async () => service.run(input)));
  await assert.rejects(service.read({...identity, checkId: '../outside'}), hasStatus(400));
  const duplicate = f.originalsFor({...f.config, support: [[SRC, 'source'], [SRC, 'source']]});
  await assert.rejects(human(async () => f.service({originals: duplicate}).run(args)), hasStatus(409));
  f.projectChange(p => { p.pieces.push({...p.pieces[0]}); });
  await assert.rejects(human(async () => service.run(args)), hasStatus(409));
  assert.deepEqual(treeHashes(f.f.data), {...before, ['magazine/projects/' + identity.storyId + '.json']: sha(fs.readFileSync(path.join(f.f.data, 'magazine/projects', identity.storyId + '.json')))});
});

test('missing explicit source or context is held without checker execution; no implicit fallback', async t => {
  for (const missing of ['source', SRC, CONTEXT]) await t.test(missing, async t => {
    const f = setup(t); let count = 0; f.magazine.extra.checks.run = () => { count++; throw Error('must not run'); };
    let originals = f.originals;
    if (missing === 'source') originals = f.originalsFor({...f.config, support: [[CONTEXT, 'author context']]});
    else fs.unlinkSync(path.join(f.f.vault, missing));
    const service = f.service({originals}), args = await f.inputs(originals), saved = await human(async () => service.run(args));
    assert.equal(saved.record.status, 'held'); assert.equal(saved.record.notRun, true); assert.equal(saved.record.result, null); assert.equal(count, 0);
    assert.equal((await f.service({originals}).read(identity)).record.status, 'held');
  });
});

test('running receipts are visible during execution and interrupted after crash; failed/corrupt receipts never pass', async t => {
  const f = setup(t), checker = f.magazine.extra.checks.run; let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  f.magazine.extra.checks.run = async input => { entered(); await new Promise(resolve => { release = resolve; }); return checker(input); };
  const service = f.service(), args = await f.inputs(), pending = human(async () => service.run(args)); await started;
  assert.equal((await service.read(identity)).record.status, 'running'); release(); await pending;
  const file = f.receiptFiles()[0]; rewriteReceipt(file, r => { r.status = 'running'; r.result = null; r.finishedAt = null; });
  const before = treeHashes(f.f.data);
  assert.equal((await f.service().read(identity)).record.status, 'interrupted');
  assert.equal((await human(async () => f.service().run(args))).record.status, 'interrupted'); assert.deepEqual(treeHashes(f.f.data), before);
  fs.writeFileSync(file, '{broken', {mode: 0o600});
  await assert.rejects(service.read(identity), hasStatus(409));
  const other = setup(t); other.magazine.extra.checks.run = () => { throw Error('private source payload must not escape'); };
  const failed = await human(async () => other.service().run(await other.inputs()));
  assert.equal(failed.record.status, 'failed'); assert.equal(failed.record.result, null); assert.ok(!JSON.stringify(failed).includes('private source payload'));
});

test('same owner serializes across service instances, detects mid-check edits and keeps latest history pointer', async t => {
  const f = setup(t), checker = f.magazine.extra.checks.run; let release, entered; let calls = 0;
  const started = new Promise(resolve => { entered = resolve; });
  f.magazine.extra.checks.run = async input => { calls++; if (calls === 1) { entered(); await new Promise(resolve => { release = resolve; }); } return checker(input); };
  const firstArgs = await f.inputs(), secondArgs = await f.inputs();
  const first = human(async () => f.service().run(firstArgs)); await started;
  const second = human(async () => f.service().run(secondArgs)); await Promise.resolve(); assert.equal(calls, 1);
  release(); await first; const latest = await second;
  assert.equal(calls, 2); assert.equal((await f.service().read(identity)).record.checkId, latest.record.checkId); assert.equal(f.receiptFiles().length, 2);
  f.magazine.extra.checks.run = input => { const result = checker(input); fs.appendFileSync(path.join(f.f.vault, CONTEXT), '\nChanged during check.\n'); return result; };
  const stale = await human(async () => f.service().run(await f.inputs())); assert.equal(stale.record.status, 'stale');
});

test('private storage rejects symlinks, hardlinks, public permissions, corrupt pointers and bounded history overflow', async t => {
  const f = setup(t), service = f.service(), args = await f.inputs(); await human(async () => service.run(args));
  const file = f.receiptFiles()[0], bytes = fs.readFileSync(file), dir = path.dirname(file), pointer = path.join(dir, 'current.json');
  fs.unlinkSync(file); fs.symlinkSync(path.join(f.f.vault, SRC), file);
  await assert.rejects(service.read(identity), hasStatus(403)); fs.unlinkSync(file);
  fs.writeFileSync(file, bytes, {mode: 0o600}); fs.linkSync(file, path.join(dir, 'linked.json'));
  await assert.rejects(service.read(identity), hasStatus(403)); fs.unlinkSync(path.join(dir, 'linked.json'));
  fs.chmodSync(file, 0o644); await assert.rejects(service.read(identity), hasStatus(403)); fs.chmodSync(file, 0o600);
  fs.writeFileSync(pointer, JSON.stringify({schema: 'ar-create.magazine-mechanical-check-pointer.v1', checkId: randomUUID()}));
  await assert.rejects(service.read(identity), hasStatus(409));
  fs.writeFileSync(pointer, JSON.stringify({schema: 'ar-create.magazine-mechanical-check-pointer.v1', checkId: args.operationId}));
  for (let i = 0; i < 255; i++) fs.writeFileSync(path.join(dir, randomUUID() + '.json'), '{}', {mode: 0o600});
  await assert.rejects(human(async () => service.run({...args, operationId: randomUUID()})), hasStatus(413)); assert.equal(f.receiptFiles().length, 256);
  const g = setup(t); fs.mkdirSync(path.join(g.f.data, 'other'), {mode: 0o700}); fs.symlinkSync(path.join(g.f.data, 'other'), path.join(g.f.data, 'magazine/mechanical-checks'));
  await assert.rejects(g.service().read(identity), hasStatus(403)); await assert.rejects(human(async () => g.service().run(await g.inputs())), hasStatus(403));
});

test('a changed input reread by the checker is stale, and oversized output becomes a bounded failure', async t => {
  const f = setup(t), checker = f.magazine.extra.checks.run;
  f.magazine.extra.checks.run = input => { fs.appendFileSync(path.join(f.f.vault, SRC), '\nChanged just before checker read.\n'); return checker(input); };
  const stale = await human(async () => f.service().run(await f.inputs()));
  assert.equal(stale.record.status, 'stale'); assert.equal(stale.record.result, null);
  const g = setup(t), check = g.magazine.extra.checks.run;
  g.magazine.extra.checks.run = input => { const r = check(input); r.quotes.lines.push('x'.repeat(1024 * 1024)); return r; };
  const large = await human(async () => g.service().run(await g.inputs()));
  assert.equal(large.record.status, 'failed'); assert.equal(large.record.result, null);
  assert.equal((await g.service().read(identity)).record.status, 'failed');
  assert.ok(fs.statSync(g.receiptFiles()[0]).size < 16384);
});

test('original root mismatch, support symlinks and removed registration fail closed without receipt writes', async t => {
  const f = setup(t), args = await f.inputs();
  const other = setup(t), wrongRoot = f.service({originals: other.originals});
  await assert.rejects(human(async () => wrongRoot.run(args)), hasStatus(409));
  fs.unlinkSync(path.join(f.f.vault, SRC)); fs.symlinkSync(path.join(other.f.vault, SRC), path.join(f.f.vault, SRC));
  await assert.rejects(human(async () => f.service().run(args)), hasStatus(403));
  assert.equal(fs.existsSync(path.join(f.f.data, 'magazine/mechanical-checks')), false);
  const g = setup(t); await human(async () => g.service().run(await g.inputs()));
  g.projectChange(p => { p.vaultRecords.context = null; });
  assert.equal((await g.service().read(identity)).record.status, 'stale');
});

test('numeric native part identity joins its configured parent independently of a display part label', async t => {
  const partPath = 'Workflow/3-Develop/DEV - Clay Teacher (part one).md';
  const f = setup(t, {extra: {[partPath]: '---\ntype: DEV\nstory: Clay Teacher\npart: 1 of 3\n---\n\nMetadata\n\n---\n\n"The clay remembers every hand that pressed it."\n\n---\n'}});
  const originals = f.originalsFor({...f.config, path: partPath, partKey: '1'});
  const expectedDraftHash = sha(fs.readFileSync(path.join(f.f.vault, partPath)));
  const revision = originals.checkInputs({parentStudyKey: identity.parentStudyId, partKey: '1', draftPath: partPath, expectedDraftHash}).revision;
  const args = {...identity, pieceId: identity.storyId + ':part-1', expectedDraftHash, expectedInputRevision: revision, operationId: randomUUID()};
  const saved = await human(async () => f.service({originals}).run(args));
  assert.equal(saved.record.proof.partKey, '1'); assert.equal(saved.record.proof.draft.path, partPath); assert.equal(saved.record.status, 'checked');
});

test('checker receipts attest loaded owner code and refuse disk drift before or after service construction', async t => {
  for (const stage of ['before-constructor', 'after-constructor']) await t.test(stage, async t => {
    const f = setup(t), args = await f.inputs(), originalChecker = f.magazine.extra.checks.run;
    const saved = await human(async () => f.service().run(args));
    const loadedRevision = f.magazine.extra.checks.checkerRevision;
    assert.equal(saved.record.proof.checkerRevision, loadedRevision);
    assert.equal(Object.getOwnPropertyDescriptor(f.magazine.extra.checks, 'checkerRevision').writable, false);
    let executions = 0; f.magazine.extra.checks.run = input => { executions++; return originalChecker(input); };
    let service = stage === 'after-constructor' ? f.service() : null;
    const readFile = fs.readFileSync;
    const mock = t.mock.method(fs, 'readFileSync', function(file, ...args) {
      const raw = readFile.call(this, file, ...args);
      return String(file).endsWith('/magazine-vault/checks.mjs') ? Buffer.concat([Buffer.from(raw), Buffer.from('\n// simulated later disk revision\n')]) : raw;
    });
    service ||= f.service();
    const before = treeHashes(f.f.data);
    await assert.rejects(human(async () => service.run({...args, operationId: randomUUID()})), error => error.status === 409 && /checker changed on disk/.test(error.message));
    assert.equal(executions, 0); assert.deepEqual(treeHashes(f.f.data), before);
    assert.equal((await service.read(identity)).record.status, 'stale');
    assert.equal((await human(async () => service.run(args))).record.status, 'stale');
    mock.mock.restore();
    assert.equal((await service.read(identity)).record.status, saved.record.status);
  });
});

test('checker drift during a run stales its loaded-code proof and a fresh owner revision stales older receipts', async t => {
  const f = setup(t), args = await f.inputs(), realChecker = f.magazine.extra.checks;
  const service = f.service(), readFile = fs.readFileSync;
  const completed = await human(async () => service.run(args));
  const loadedRevision = realChecker.checkerRevision;
  let diskDrift = false, changedRevision;
  const mock = t.mock.method(fs, 'readFileSync', function(file, ...rest) {
    const raw = readFile.call(this, file, ...rest);
    if (!diskDrift || !String(file).endsWith('/magazine-vault/checks.mjs')) return raw;
    const changed = Buffer.concat([Buffer.from(raw), Buffer.from('\n// simulated fresh loaded owner\n')]);
    changedRevision = sha(changed); return changed;
  });
  const run = realChecker.run;
  realChecker.run = input => { const result = run(input); diskDrift = true; return result; };
  const stale = await human(async () => service.run({...args, operationId: randomUUID()}));
  assert.equal(stale.record.status, 'stale'); assert.equal(stale.record.proof.checkerRevision, loadedRevision);
  assert.notEqual(stale.record.proof.checkerRevision, changedRevision);
  // A trusted dependency wrapper stands in for the next process/module owner;
  // the maintained source file itself is never changed by this test.
  const freshChecks = {checkerRevision: changedRevision, run};
  const freshMagazine = {...f.magazine, extra: {...f.magazine.extra, checks: freshChecks}};
  const freshService = f.service({magazine: freshMagazine});
  assert.equal((await freshService.read({...identity, checkId: completed.record.checkId})).record.status, 'stale');
  mock.mock.restore();
  assert.equal((await service.read({...identity, checkId: completed.record.checkId})).record.status, completed.record.status);
});

test('a completed pure check with no supported quoted passages persists held coverage without a false pass', async t => {
  const f = setup(t);
  fs.writeFileSync(path.join(f.f.vault, DEV), '---\ntype: DEV\nstory: Clay Teacher\n---\n\nMetadata\n\n---\n\nInvented narration without supported quotation marks.\n\n---\n');
  const pure = f.magazine.extra.checks.run({draft: DEV, source: SRC, context: [CONTEXT]});
  assert.equal(pure.quotes.passages, 0); assert.equal(pure.quotes.ok, true); assert.equal(pure.splits.ok, true);
  const saved = await human(async () => f.service().run(await f.inputs()));
  assert.equal(saved.record.status, 'held'); assert.equal(saved.record.reason, 'No supported quoted passages checked.');
  assert.equal(saved.record.notRun, undefined); assert.deepEqual(saved.record.result, pure);
  const reopened = await f.service().read(identity);
  assert.deepEqual(reopened.record, saved.record);
});
