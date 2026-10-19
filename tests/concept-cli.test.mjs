import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { localUrl, run, validateInput } from '../tools/concept-cli.mjs';
const uuid = '592a3d55-9abe-4d0c-a47e-1beb7c2735fd';
const save = { parentStudyId: 'synthetic', operationId: uuid, expectedRevision: 2, expectedHash: 'a'.repeat(64), authorThoughts: 'Exact synthetic words.', aiInterpretation: '', suggestions: '', sourceSelections: [] };
const readArgs = ['--url', 'http://127.0.0.1:8854', 'read', '--input', '-'];
const inputOptions = value => ({ stdin: async () => JSON.stringify(value) });
test('accepts explicit loopback URLs and rejects remote/credentialed/ambiguous destinations', () => {
  for (const value of ['http://127.0.0.1:8854', 'http://localhost:8854', 'http://[::1]:8854']) assert.equal(localUrl(value), value);
  assert.equal(localUrl('http://localhost:80'), 'http://localhost');
  for (const value of ['https://localhost:8854', 'http://example.com:8854', 'http://127.0.0.1', 'http://localhost:0', 'http://localhost:70000', 'http://user:pass@localhost:8854', 'http://localhost:8854/api', 'http://localhost:8854/?url=x', 'http://localhost:8854/#x']) assert.throws(() => localUrl(value));
});
test('strict saves require caller operation ID and both revision guards', () => {
  assert.deepEqual(validateInput('save', save), save);
  for (const key of Object.keys(save)) { const altered = { ...save }; delete altered[key]; assert.throws(() => validateInput('save', altered), /Missing input field/); }
  for (const altered of [{ operationId: 'auto' }, { expectedRevision: -1 }, { expectedRevision: '2' }, { expectedHash: 'old' }, { expectedHash: 'A'.repeat(64) }, { approved: true }]) assert.throws(() => validateInput('save', { ...save, ...altered }));
});
test('source selections preserve exact offsets and refuse unknown metadata', () => {
  const source = { sourceId: 'source-1', sourceHash: 'b'.repeat(64), quote: 'Exact quote.', start: 0 };
  assert.equal(validateInput('save', { ...save, sourceSelections: [source] }).sourceSelections[0].quote, 'Exact quote.');
  for (const bad of [{ ...source, approved: true }, { ...source, start: -1 }, { ...source, sourceHash: 'stale' }]) assert.throws(() => validateInput('save', { ...save, sourceSelections: [bad] }));
});
test('refuses unknown commands, duplicate flags and prose argv before transport', async () => {
  for (const args of [['apply'], [...readArgs, 'private prose'], [...readArgs, '--url', 'http://localhost:8854'], ['--url', 'http://localhost:8854', '--config', 'x', 'list'], ['--url', 'http://localhost:8854', 'read']]) await assert.rejects(run(args, { fetchImpl: () => { throw new Error('must not request'); } }));
});
test('read uses encoded project identity and preserves full JSON receipt', async () => {
  const receipt = { revision: 3, hash: 'b'.repeat(64), path: '/synthetic/HUMAN-DIRECTION.md', authorThoughts: 'Words' };
  const result = await run(readArgs, { ...inputOptions({ parentStudyId: 'a&b' }), fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/api/concept'); assert.equal(url.searchParams.get('parentStudyId'), 'a&b'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    return Response.json(receipt);
  } });
  assert.deepEqual(result, { exitCode: 0, result: receipt });
});
test('a save conflict retains server details and makes exactly one attempt', async () => {
  let attempts = 0;
  const details = { error: 'stale', currentRevision: 3, currentHash: 'b'.repeat(64) };
  const result = await run(['--url', 'http://localhost:8854', 'save', '--input', '-'], { ...inputOptions(save), fetchImpl: async (_url, options) => {
    attempts++; assert.deepEqual(JSON.parse(options.body), save); return Response.json(details, { status: 409 });
  } });
  assert.equal(attempts, 1); assert.equal(result.exitCode, 3); assert.equal(result.result.error, 'revision_conflict'); assert.deepEqual(result.result.details, details);
});
test('an uncertain transport failure never retries a mutation', async () => {
  let attempts = 0;
  await assert.rejects(run(['--url', 'http://localhost:8854', 'create', '--input', '-'], { ...inputOptions({ parentStudyId: 'synthetic', title: 'Synthetic idea', operationId: uuid }), fetchImpl: async () => { attempts++; throw new Error('connection lost after write'); } }), /connection lost/);
  assert.equal(attempts, 1);
});
test('library search routes only bounded explicit query data', async () => {
  await run(['--url', 'http://localhost:8854', 'library-search', '--input', '-'], { ...inputOptions({ parentStudyId: 'synthetic', query: 'invented', limit: 5 }), fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/api/concept/sources/search'); assert.equal(options.method, 'POST'); assert.equal(JSON.parse(options.body).query, 'invented'); return Response.json({ results: [] });
  } });
});
test('real CLI process reads stdin, reaches local HTTP and emits machine-readable receipt', async () => {
  const requests = [];
  const server = http.createServer((request, response) => { requests.push(request.url); response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ parentStudyId: 'synthetic', revision: 1, hash: 'c'.repeat(64), path: '/synthetic/HUMAN-DIRECTION.md' })); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const cli = new URL('../tools/concept-cli.mjs', import.meta.url);
    const child = spawn(process.execPath, [fileURLToPath(cli), '--url', `http://127.0.0.1:${server.address().port}`, 'read', '--input', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
    child.stdin.end(JSON.stringify({ parentStudyId: 'synthetic' }));
    const [code] = await once(child, 'exit'); assert.equal(code, 0, stderr); assert.equal(JSON.parse(stdout).revision, 1); assert.deepEqual(requests, ['/api/concept?parentStudyId=synthetic']);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('raw save preserves manual direction and excludes structured replacement', () => {
  const raw = { parentStudyId: save.parentStudyId, operationId: uuid, expectedRevision: 2, expectedHash: save.expectedHash, body: '# Exact manual direction\n\nKeep these words.\n' };
  assert.equal(validateInput('save', raw).body, raw.body);
  assert.throws(() => validateInput('save', { ...raw, authorThoughts: 'replacement' }), /Choose exact body/);
  assert.throws(() => validateInput('save', { ...save, replaceExistingDirection: 'yes' }), /boolean/);
  assert.equal(validateInput('save', { ...save, replaceExistingDirection: true }).replaceExistingDirection, true);
});
test('source-first research does not require an existing concept', () => {
  assert.deepEqual(validateInput('library-search', { query: 'invented' }), { query: 'invented' });
  assert.deepEqual(validateInput('library-read', { sourceId: 'source-1' }), { sourceId: 'source-1' });
});

test('structured adopted direction is optional, explicit text and unavailable in raw mode', () => {
  assert.deepEqual(validateInput('save', save), save);
  assert.equal(validateInput('save', { ...save, adoptedDirection: 'An explicitly chosen synthetic direction.' }).adoptedDirection, 'An explicitly chosen synthetic direction.');
  assert.equal(validateInput('save', { ...save, adoptedDirection: '' }).adoptedDirection, '');
  assert.throws(() => validateInput('save', { ...save, adoptedDirection: true }), /adoptedDirection must be a string/);
  const raw = { parentStudyId: save.parentStudyId, operationId: uuid, expectedRevision: 2, expectedHash: save.expectedHash, body: '# Manual direction\n' };
  assert.throws(() => validateInput('save', { ...raw, adoptedDirection: 'inferred' }), /Choose exact body/);
});
