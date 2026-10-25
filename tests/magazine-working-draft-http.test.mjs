// Synthetic transport/owner proof, NOT production routes or a preview/editor.
// Uses the real bridge, actor resolver and Magazine writer. No working-copy API
// is aliased to it: the final test pins why that would not be native integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
import {resolveRequestActor, withActor} from '../runtime/services/actor.mjs';

const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const selection = {storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article', edition: 'working'};
const other = {storyId: 'mag-river-potter', pieceId: 'mag-river-potter:article', edition: 'working'};
const require = createRequire(new URL('../runtime/package.json', import.meta.url));
const {JSDOM} = require('jsdom');

async function fixture(t) {
  const f = buildMagazineFixture({extra: {'Workflow/3-Develop/DEV - River Potter (story).md': '---\ntype: DEV\nstory: River Potter\n---\n\nOther current draft.\n', 'Writing/Earlier edition.md': '# Earlier edition\n\nEarlier words.\n'}});
  t.after(f.cleanup);
  const plan = planRegistration({vault: f.vault, files: f.files});
  fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
  fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
  const makeBridge = () => createWorkingDraftBridge({magazine: createMagazineVault({vaultRoot: f.vault, filesRoot: f.files, writable: true, dataDir: f.data, machine: 'synthetic-http'})});
  let bridge = makeBridge(), origin;
  const allowed = new Set(['read', 'edit', 'save', 'operation', 'eligibleUndo', 'undo']);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, origin), action = url.pathname.slice('/synthetic/working-draft/'.length);
      if (!url.pathname.startsWith('/synthetic/working-draft/') || !allowed.has(action)) throw Object.assign(Error('Unknown synthetic test endpoint'), {status: 404});
      if (request.method !== 'GET' && request.method !== 'POST' || request.method === 'GET' && !['read', 'operation', 'eligibleUndo'].includes(action)) throw Object.assign(Error('Method not supported'), {status: 405});
      let input;
      if (request.method === 'GET') input = Object.fromEntries(url.searchParams);
      else {
        if (request.headers.origin !== origin) throw Object.assign(Error('Origin does not match this synthetic server'), {status: 403});
        let raw = '';
        for await (const chunk of request) { raw += chunk; if (raw.length > 250000) throw Object.assign(Error('Test request too large'), {status: 413}); }
        input = JSON.parse(raw);
      }
      const actor = resolveRequestActor(request, {appOrigins: [origin]});
      const result = await (actor ? withActor(actor, () => bridge[action](input)) : bridge[action](input));
      response.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify(result));
    } catch (error) { response.writeHead(error.status || 400, {'Content-Type': 'application/json'}).end(JSON.stringify({error: error.message})); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  t.after(() => new Promise(resolve => server.close(resolve)));
  const get = async (action, input = selection, headers = {}) => {
    const response = await fetch(origin + '/synthetic/working-draft/' + action + '?' + new URLSearchParams(input), {headers});
    return {status: response.status, body: await response.json()};
  };
  const post = async (action, input, headers = {}) => {
    const response = await fetch(origin + '/synthetic/working-draft/' + action, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, ...headers}, body: JSON.stringify(input)});
    return {status: response.status, body: await response.json()};
  };
  return {f, get, post, origin, reconnect: () => { bridge = makeBridge(); }};
}

test('real HTTP bridge saves same DEV, switches/reconnects, refuses stale 409 and exactly undoes without new copies', async t => {
  const s = await fixture(t), before = treeHashes(s.f.vault), initial = await s.get('read');
  assert.equal(initial.status, 200); assert.equal(initial.body.editable, true);
  const p = initial.body.paragraphs.find(p => p.text.startsWith('I met Mira'));
  const edit = {...selection, block: p.block, seen: p.seen, text: 'I met Mira beside a blue kiln.', operationId: randomUUID()};
  assert.equal((await s.post('edit', edit)).status, 200);
  assert.equal((await s.get('read', other)).body.document.text.includes('Other current draft.'), true);
  s.reconnect();
  const reopened = await s.get('read');
  assert.match(reopened.body.document.text, /beside a blue kiln/);
  const full = {...selection, content: reopened.body.document.text + '\nA final sentence.\n', expectedHash: reopened.body.document.hash, operationId: randomUUID()};
  assert.equal((await s.post('save', full)).body.written, true);
  s.reconnect();
  assert.match((await s.get('read')).body.document.text, /A final sentence/);
  assert.equal((await s.post('save', full)).body.replay, true, 'response-loss retry uses persisted owner receipt');
  const committed = treeHashes(s.f.vault);
  assert.equal((await s.post('edit', {...edit, operationId: randomUUID()})).status, 409);
  assert.equal((await s.post('save', {...full, content: 'Stale replacement', operationId: randomUUID()})).status, 409);
  assert.deepEqual(treeHashes(s.f.vault), committed);
  const actor = {'X-AR-Actor': 'human:adrian', 'X-AR-Client': 'ui'};
  assert.equal((await s.get('eligibleUndo', {...selection, operationId: full.operationId}, actor)).body.eligible, true);
  const undoSave = {...selection, undoOperationId: full.operationId, operationId: randomUUID()};
  assert.equal((await s.post('undo', undoSave)).status, 200);
  assert.equal((await s.get('read')).body.document.text, reopened.body.document.text);
  const undoEdit = {...selection, undoOperationId: edit.operationId, operationId: randomUUID()};
  assert.equal((await s.post('undo', undoEdit)).status, 200);
  s.reconnect();
  assert.equal((await s.post('undo', undoEdit)).body.replay, true);
  assert.deepEqual(treeHashes(s.f.vault), before, 'DEV, log, publication, source and sibling bytes restored/preserved');
  assert.equal(fs.existsSync(path.join(s.f.data, 'study-draft-copies')), false);
  const receipt = await s.get('operation', {...selection, operationId: edit.operationId});
  assert.equal(receipt.body.actor, 'human:adrian'); assert.equal(receipt.body.client, 'ui');
  assert.ok(receipt.body.changes.every(change => !('before' in change)));
});

test('HTTP boundary keeps agent proposals and refuses foreign origin, actor override, retained IDs and arbitrary path', async t => {
  const s = await fixture(t), view = (await s.get('read')).body, before = treeHashes(s.f.vault);
  const save = {...selection, content: view.document.text + '\nProposed sentence.\n', expectedHash: view.document.hash, operationId: randomUUID()};
  assert.equal((await s.post('save', save, {'X-AR-Actor': 'agent:codex'})).body.proposed, true);
  assert.equal((await s.post('save', {...save, actor: 'human:adrian'})).status, 400);
  assert.equal((await s.post('save', save, {Origin: 'https://foreign.invalid'})).status, 403);
  const p = view.paragraphs.find(p => p.text.startsWith('I met Mira'));
  const edit = {...selection, block: p.block, seen: p.seen, text: 'Changed.', operationId: randomUUID()};
  assert.equal((await s.post('edit', edit, {'X-AR-Actor': 'agent:codex'})).status, 403);
  assert.equal((await s.post('edit', {...edit, block: 'retained-66'})).status, 400);
  assert.equal((await s.post('edit', {...edit, path: '../another-file.md'})).status, 400);
  assert.deepEqual(treeHashes(s.f.vault), before);
});

test('current native editor rejects an unadapted bridge response instead of inventing an owned-copy binding', async t => {
  const s = await fixture(t), before = treeHashes(s.f.vault), calls = [];
  const dom = new JSDOM('<main id="app"></main>', {url: s.origin + '/document-study/', runScripts: 'outside-only'}), w = dom.window;
  t.after(() => w.close());
  const p = {id: selection.storyId, name: 'Invented existing story', view: 'record', viewedStage: 1, blocks: [{id: 'local-only', tag: 'p', html: 'Earlier local words.'}], title: 'Invented working text', history: [], note: null, originalNotes: [], rev: 1};
  w.state = {projects: [p]}; w.current = () => p; w.studyCollectionWorkspace = {supports: id => id === p.id};
  w.selected = w.activeBlock = w.keyboardBlock = w.typingSession = null; w.structuredClone = structuredClone; w.crypto.randomUUID = randomUUID;
  w.fetch = async (url, options) => { calls.push(String(url)); assert.equal(options, undefined); assert.match(String(url), /^\/api\/study-draft\/read\?/); const response = await s.get('read'); return {ok: true, status: response.status, json: async () => response.body}; };
  w.esc = value => String(value ?? ''); w.readonlyHTML = value => value; w.shortRecordName = value => value; w.WORKFLOW_RECORDS = {};
  for (const name of ['article', 'render', 'save', 'onTyping', 'viewPhase', 'setView', 'blockHTML', 'undo', 'workflowBar', 'refreshDiscussion', 'phaseReader', 'historicalNotice', 'wireDocument', 'openInstruction', 'toast', 'commitTyping', 'rememberPosition']) w[name] = () => '';
  w.eval(fs.readFileSync(new URL('../public/document-study/draft-flow.js', import.meta.url), 'utf8'));
  await assert.rejects(w.studyDraft.openBinding({bindingId: selection.pieceId, parentStudyId: p.id}), /opened binding belongs to another working copy/);
  assert.equal(calls.length, 1); assert.equal(p.blocks[0].html, 'Earlier local words.');
  assert.deepEqual(treeHashes(s.f.vault), before);
  assert.equal(fs.existsSync(path.join(s.f.data, 'study-draft-copies')), false);
});
