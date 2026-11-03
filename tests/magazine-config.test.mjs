// The magazine settings travel config.mjs -> serve.mjs -> createServer, and writable:false (the default) refuses every magazine write.
// serve.mjs runs as a real child process against a synthetic magazine; the data folder is outside the checkout, as config.mjs requires.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';

const serve = path.resolve(import.meta.dirname, '../serve.mjs');
const freePort = () => new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => resolve(port)); }); });

async function start(t, magazineExtra = {}) {
  const f = buildMagazineFixture(), data = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-mag-config-')), port = await freePort();
  const staging = path.join(f.dir, 'staging');
  const config = path.join(f.dir, 'config.json');
  fs.writeFileSync(config, JSON.stringify({dataDir: data, port, allowScratchRoots: true, magazine: {vaultRoot: f.vault, filesRoot: f.files, drops: f.drops, exportStaging: staging, ...magazineExtra}}));
  const child = spawn(process.execPath, [serve], {env: {PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, AR_CREATE_CONFIG: config}, stdio: ['ignore', 'pipe', 'pipe']});
  let stderr = ''; child.stderr.on('data', d => { stderr += d; });
  // Wait for serve.mjs to exit before removing its data folder: a server still writing there made rmSync fail with ENOTEMPTY in CI and skip f.cleanup().
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; } fs.rmSync(data, {recursive: true, force: true}); f.cleanup(); });
  await new Promise((resolve, reject) => { child.stdout.on('data', d => { if (String(d).includes('AR Create:')) resolve(); }); child.on('exit', code => reject(new Error('serve.mjs exited ' + code + ': ' + stderr))); });
  const url = 'http://127.0.0.1:' + port;
  const call = async (method, route, body, actor = 'human:adrian') => { const r = await fetch(url + route, {method, headers: {'Content-Type': 'application/json', 'X-AR-Actor': actor, 'X-AR-Client': 'mag-page'}, ...(body ? {body: JSON.stringify(body)} : {})}); return {status: r.status, body: await r.json().catch(() => null)}; };
  return {f, data, url, call, staging, staged: () => treeHashes(f.dir)};
}

const U = () => randomUUID(), H = 'a'.repeat(64);
const NOTES = 'Workflow/3-Develop/NOTES - Clay Teacher (story).md', DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md', MADE = 'Workflow/5-Social/CAROUSEL - Clay Teacher - the fire.md', ASK = 'Workflow/ASK - Clay Teacher.md';
// A well-formed body for each write route, so it gets as far as the writable check rather than failing on its shape.
const BODIES = {
  '/api/magazine/working-draft/save': {storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',content:'x',expectedHash:H,operationId:U()},
  '/api/magazine/working-draft/edit': {storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',block:0,seen:'a'.repeat(12),text:'x',operationId:U()},
  '/api/magazine/working-draft/undo': {storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',undoOperationId:U(),operationId:U()},
  '/api/magazine/write': {path: NOTES, content: 'x', expectedHash: H, operationId: U()},
  '/api/magazine/ask/set': {path: ASK, content: 'x', expectedHash: H, operationId: U()},
  '/api/magazine/ask/answer': {path: ASK, index: 0, value: 'x', operationId: U()},
  '/api/magazine/edit': {path: DEV, block: 0, seen: H, text: 'x', operationId: U()},
  '/api/magazine/requests/add': {story: 'Clay Teacher', kind: 'Post', operationId: U()},
  '/api/magazine/page-feedback/add': {story: 'Clay Teacher', step: 'Redo', q: 'q', value: 'yes', operationId: U()},
  '/api/magazine/lineup/save': {path: MADE, slides: [], caption: 'x', expectedHash: H, operationId: U()},
  '/api/magazine/approve': {path: MADE, value: 'yes', expectedHash: H, operationId: U()},
  '/api/magazine/export/save': {path: MADE, staged: 'x', files: [], operationId: U()},
  '/api/magazine/album/link': {story: 'Clay Teacher', link: 'https://www.icloud.com/sharedalbum/#B0example', operationId: U()},
  '/api/magazine/drops/claim': {name: 'Stone Carver.txt', folder: 0, story: 'Stone Carver', operationId: U()},
  '/api/magazine/intake/file': {claimId: U(), operationId: U()},
  '/api/magazine/lock/hold': {doing: 'test'},
  '/api/magazine/lock/recover': {expectedHash: H},
  '/api/magazine/status/refresh': {operationId: U()},
  '/api/magazine/status/install': {expectedHash: H, operationId: U()},
  '/api/magazine/issue/write': {path: 'Issues/Example.md', content: 'x', expectedHash: null, operationId: U()},
  '/api/magazine/proposal/accept': {proposalId: U(), operationId: U()},
  '/api/magazine/proposal/reject': {proposalId: U(), operationId: U()},
  '/api/magazine/undo': {undoOperationId: U(), operationId: U()},
  '/api/magazine/tidy/apply': {operationId: U()},
  '/api/magazine/send': {path: DEV, piece: 1, expectedHash: H, operationId: U()},
  '/api/magazine/mark-published': {path: DEV, link: 'https://example.test/story', expectedHash: H, operationId: U()},
  '/api/magazine/reconcile/choose': {bindingId: U(), choice: 'vault', expectedVaultHash: H, expectedCopyHash: H, operationId: U()},
  // Routes added after the sweep was written (shapes from runtime/commands.mjs BODY).
  '/api/magazine/library-photos/album': {action: 'link', folderId: U(), operationId: U(), expectedRevision: 0, expectedHash: H, photo: {rootId: 'library', sourceId: U(), revision: 0, sourceHash: H}},
  '/api/magazine/mechanical-check': {parentStudyId: 'p', storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', expectedDraftHash: H, expectedInputRevision: 0, operationId: U()},
  '/api/magazine/working-draft/export': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', expectedHash: H, renderRevision: H, name: 'x.html', body: '<!doctype html><p>x</p>'},
  '/api/magazine/working-draft/ai/propose': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', parentStudyId: 'p', expectedHash: H, contextHash: H, operationId: U(), claims: [], gaps: []},
  '/api/magazine/working-draft/ai/run': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', parentStudyId: 'p', expectedHash: H, contextHash: H, operationId: U()},
  '/api/magazine/working-draft/ai/accept': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', parentStudyId: 'p', expectedHash: H, contextHash: H, operationId: U(), proposalId: U(), proposalHash: H},
  '/api/magazine/working-draft/ai/reject': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', parentStudyId: 'p', expectedHash: H, contextHash: H, operationId: U(), proposalId: U(), proposalHash: H},
  '/api/magazine/working-draft/share-feedback/prepare-paragraph': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', expectedHash: H, registeredFeedbackPath: 'x.md', expectedFeedbackHash: H, block: 0, seen: 'a'.repeat(12), text: 'x'},
  '/api/magazine/working-draft/share-feedback/prepare-mapping': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', expectedHash: H, registeredFeedbackPath: 'x.md', expectedFeedbackHash: H},
  '/api/magazine/working-draft/share-feedback/prepare': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', expectedHash: H, registeredFeedbackPath: 'x.md', expectedFeedbackHash: H, content: 'x'},
  '/api/magazine/working-draft/share-feedback/save': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', expectedHash: H, registeredFeedbackPath: 'x.md', expectedFeedbackHash: H, content: 'x', operationId: U()},
  '/api/magazine/working-draft/share-feedback/undo': {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working', expectedHash: H, registeredFeedbackPath: 'x.md', expectedFeedbackHash: H, undoOperationId: U(), operationId: U()},
};
// Not writes: reads that happen to be POST, and releasing a lock nobody holds.
const NOT_WRITES = new Set(['/api/magazine/working-draft/prepare', '/api/magazine/send-check', '/api/magazine/check', '/api/magazine/lock/release']);
// These need something to already exist (an intake, a proposal, a past operation, a binding); with nothing there they answer 404 or 400 before the writable check.
const NEEDS_EXISTING = new Set(['/api/magazine/working-draft/save', '/api/magazine/working-draft/edit', '/api/magazine/working-draft/undo', '/api/magazine/intake/file', '/api/magazine/proposal/accept', '/api/magazine/undo', '/api/magazine/reconcile/choose', '/api/magazine/mark-published', '/api/magazine/send', '/api/magazine/issue/write', '/api/magazine/ask/set', '/api/magazine/ask/answer', '/api/magazine/lineup/save', '/api/magazine/approve', '/api/magazine/export/save', '/api/magazine/album/link', '/api/magazine/edit',
  // No registered story, proposal, photo or connected Direction in this fixture, so these stop before the writable check.
  // Vault writers among them still gate on writable: ai/run+propose need an editable (writable) draft, accept/reject go through requireWritable.
  // album (Library membership), export (export register) and mechanical-check (receipts) write AR Create's own records, not the vault.
  '/api/magazine/library-photos/album', '/api/magazine/working-draft/export', '/api/magazine/working-draft/ai/accept', '/api/magazine/working-draft/ai/reject', '/api/magazine/working-draft/ai/run', '/api/magazine/working-draft/ai/propose']);

test('the configured magazine reaches the server: vault, Files folder and both drop folders in order; writable defaults to false', async t => {
  const s = await start(t);
  const status = await s.call('GET', '/api/magazine/board');
  assert.equal(status.status, 200);
  assert.ok(status.body.board.length >= 2, 'the vault folder from config is the one read');
  fs.writeFileSync(path.join(s.f.phoneDrop, 'Phone memo.m4a'), 'synthetic');
  const drops = await s.call('GET', '/api/magazine/drops');
  assert.deepEqual([...new Set(drops.body.drops.map(d => d.folder))], s.f.drops, 'MAG_DROPS order: the Files Drop is folder 0, the phone drop folder 1');
  assert.ok(drops.body.drops.some(d => d.name === 'Phone memo.m4a'));
  const lock = await s.call('GET', '/api/magazine/lock/status');
  assert.equal(lock.status, 200);
});

test('writable:false (the default) refuses every magazine write and changes no byte', async t => {
  const s = await start(t), before = s.staged();
  const caps = await (await fetch(s.url + '/api/capabilities')).json();
  const writes = caps.commands.filter(c => c.section === 'magazine' && c.method === 'POST' && !NOT_WRITES.has(c.route));
  assert.ok(writes.length >= 20, 'the sweep covers the whole write surface (' + writes.length + ')');
  const missing = writes.filter(c => !BODIES[c.route]).map(c => c.route);
  assert.deepEqual(missing, [], 'every write route has a sweep body: add one for a new route');
  const seen = {};
  for (const c of writes) {
    const answer = await s.call('POST', c.route, BODIES[c.route]);
    seen[c.route] = answer.status;
    assert.ok(answer.status >= 400, `${c.route} must not succeed (${answer.status})`);
    if (!NEEDS_EXISTING.has(c.route)) assert.equal(answer.status, 503, `${c.route}: ${JSON.stringify(answer.body)}`);
    if (answer.status === 503) assert.match(answer.body.error, /read-only|magazine\.writable|not configured|not connected|configured and writable|Nothing was written/i);
  }
  // As an agent too: the agent's own answer is 503 or 403 (a human-only decision), never a write.
  for (const route of ['/api/magazine/write', '/api/magazine/requests/add', '/api/magazine/lock/hold']) {
    const answer = await s.call('POST', route, BODIES[route], 'agent:claude-code');
    assert.ok([503, 403].includes(answer.status), route + ' ' + answer.status);
  }
  assert.deepEqual(s.staged(), before, 'no file in the vault, Files or drops changed');
  assert.equal(fs.existsSync(path.join(s.f.vault, 'Workflow/_mag-running.md')), false, 'no lock was taken');
  assert.equal(fs.existsSync(s.staging), false);
  const ops = path.join(s.data, 'magazine/operations');
  assert.deepEqual(fs.existsSync(ops) ? fs.readdirSync(ops) : [], [], 'no operation record');
  assert.equal((await s.call('GET', '/api/magazine/board')).status, 200, 'reading still works');
});

test('writable:true in the config turns writing on (the other half of the switch)', async t => {
  const s = await start(t, {writable: true});
  const read = await s.call('GET', '/api/magazine/read?path=' + encodeURIComponent(NOTES));
  assert.equal(read.status, 200);
  const hash = read.body.sha256 || read.body.hash || read.body.contentHash;
  assert.ok(hash, JSON.stringify(Object.keys(read.body)));
  const wrote = await s.call('POST', '/api/magazine/write', {path: NOTES, content: '- one note\n- a second\n', expectedHash: hash, operationId: U()}, 'agent:claude-code');
  assert.equal(wrote.status, 200, JSON.stringify(wrote.body));
  assert.match(fs.readFileSync(path.join(s.f.vault, NOTES), 'utf8'), /a second/);
});
