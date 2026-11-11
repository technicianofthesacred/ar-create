// Speed of the first look: a commands-only read of /api/capabilities, the client keeping it for the session, and
// subject standing reading less (one draft read per subject, a few subjects at a time, no waiting on suggestions).
// Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createSubjectStanding} from '../runtime/services/subject-standing.mjs';

const client = (() => {const ctx = {URLSearchParams, URL, JSON, Error, Promise, setTimeout, clearTimeout, console, crypto: globalThis.crypto, AbortSignal, module: {exports: {}}}; ctx.globalThis = ctx; vm.runInNewContext(fs.readFileSync(path.resolve('public/v2/shell/client.js'), 'utf8'), ctx); return ctx.module.exports;})();
const AGENT = {'X-AR-Actor': 'agent:claude-code', 'X-AR-Client': 'http'};

test('/api/capabilities?only=commands answers the commands and the release only; the full answer is unchanged', async t => {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => {await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true});});
 const base = 'http://127.0.0.1:' + srv.address().port, get = async p => (await fetch(base + p, {headers: AGENT})).json();
 const full = await get('/api/capabilities'), only = await get('/api/capabilities?only=commands');
 assert.deepEqual(Object.keys(only), ['schema', 'git', 'commands']);
 assert.deepEqual(only.commands, full.commands);
 assert.deepEqual(only.git, full.git);
 for (const key of ['library', 'transcription', 'retainedCarouselCopy', 'browserCarouselCopy', 'guidance']) assert.ok(key in full, key + ' stays in the full answer');
 for (const key of ['transcription', 'retainedCarouselCopy']) assert.ok(!(key in only), key + ' is not computed for the commands-only read');
});

const commandsBody = sha => ({schema: 'ar-create.capabilities.v1', git: {sha}, commands: [{name: 'a.read', method: 'GET', route: '/api/a', readOnly: true, schema: {query: []}, actors: ['any']}]});
const reply = body => ({ok: true, status: 200, text: async () => JSON.stringify(body)});
const memory = () => {const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v)};};

test('the client reads only the commands, keeps them for the session under the release, and does not wait for them again', async () => {
 const storage = memory(), asked = [];
 const first = client.createClient({base: 'http://x.test', search: '', storage, fetchImpl: async u => {asked.push(u); return reply(commandsBody('aaa111a'));}});
 assert.equal((await first.commands()).length, 1);
 assert.deepEqual(asked, ['http://x.test/api/capabilities?only=commands']);
 // A new page in the same session shows at once, even while the app has not answered.
 let release; const slow = new Promise(r => {release = r;});
 const second = client.createClient({base: 'http://x.test', search: '', storage, fetchImpl: async () => {await slow; return reply(commandsBody('bbb222b'));}});
 assert.equal((await second.commands())[0].name, 'a.read', 'answered from the kept list');
 // A new release is noticed by the one read made in the background, and the newer list is used from then on.
 const fresh = commandsBody('ddd444d'); fresh.commands.push({name: 'b.read', method: 'GET', route: '/api/b', readOnly: true, schema: {query: []}, actors: ['any']});
 release(); await new Promise(r => setTimeout(r, 20));
 const third = client.createClient({base: 'http://x.test', search: '', storage, fetchImpl: async () => reply(fresh)});
 assert.equal((await third.commands()).length, 1, 'still the kept list of the earlier release for the first call');
 await new Promise(r => setTimeout(r, 20));
 assert.equal((await third.commands()).length, 2, 'the newer release replaces it');
 assert.equal(JSON.parse(storage.getItem('v2.commands')).sha, 'ddd444d');
 // No storage, or a failing one, works as before.
 const bare = client.createClient({base: 'http://x.test', search: '', storage: {getItem() {throw new Error('no');}, setItem() {throw new Error('no');}}, fetchImpl: async () => reply(commandsBody('ccc333c'))});
 assert.equal((await bare.commands()).length, 1);
});

// Stand-in owners with invented records, enough for subject standing to read.
const owners = (extra = {}) => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speed-'));
 const ids = Array.from({length: 9}, (_, i) => ({parentStudyId: 'subject-' + i, bindingId: '0b5e3a3c-1f1e-4c7a-9f00-00000000000' + i, title: 'Subject ' + i}));
 const stats = {reads: 0, now: 0, max: 0, checkArgs: [], settles: 0};
 const drafts = {catalog: async () => ({collections: ids, outputBindings: [], drafts: []}),
  read: async input => {stats.reads++; stats.now++; stats.max = Math.max(stats.max, stats.now); await new Promise(r => setTimeout(r, 10)); stats.now--; return {projection: [{words: 'Invented words.'}], expected: {v: 1}, history: [], raw: 'Invented words.', binding: {id: input.bindingId}};}};
 const standing = createSubjectStanding({dataDir: dir, drafts, outputs: {read: async () => ({outputs: []})},
  checks: {read: async (input, known) => {stats.checkArgs.push(known); return null;}}, consentDesk: {read: async () => ({people: [], release: {}})},
  library: {tree: async () => ({sources: []})}, simmer: {boards: {read: async () => ({groups: [], forming: {}})}},
  instagram: {plans: async () => ({plans: []}), read: async () => null}, places: {read: async () => ({places: []})},
  settle: async () => {stats.settles++;}, ...extra});
 return {standing, stats, ids, done: () => fs.rmSync(dir, {recursive: true, force: true})};
};

test('subjects.standing reads a few subjects at a time, in order, and hands the Check the draft it already read', async () => {
 const f = owners();
 try {
  const all = await f.standing.all();
  assert.deepEqual(all.subjects.map(s => s.id), f.ids.map(s => s.parentStudyId), 'the order of the catalogue');
  assert.ok(f.stats.max > 1 && f.stats.max <= 4, 'between two and four at once, not ' + f.stats.max);
  assert.equal(f.stats.reads, 9, 'each draft read once for the standing, the Check reuses it');
  assert.equal(f.stats.checkArgs.length, 9);
  assert.ok(f.stats.checkArgs.every(known => known?.draft?.raw === 'Invented words.'), 'the Check was given the draft already read');
  assert.equal((await f.standing.all()).readAgain, 0, 'nothing read again when nothing changed');
 } finally {f.done();}
});

test('one subject does not wait for the proposal owner; the count arrives for the next read', async () => {
 const request = {binding: {bindingId: '0b5e3a3c-1f1e-4c7a-9f00-000000000000'}, expected: {v: 1}};
 let answer; const slow = new Promise(r => {answer = r;});
 const f = owners({suggestions: () => slow});
 // A pending suggestion made on the current words, as the proposal owner would hold it.
 try {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speed-req-')), id = '11111111-1111-4111-8111-111111111111';
  fs.mkdirSync(path.join(dir, 'study-mcp-requests', id), {recursive: true});
  fs.writeFileSync(path.join(dir, 'study-mcp-requests', id, 'request.json'), JSON.stringify({...request, createdAt: '2026-11-10T00:00:00Z'}));
  fs.writeFileSync(path.join(dir, 'study-mcp-requests', id, 'proposal.json'), '{}');
  const standing = createSubjectStanding({dataDir: dir,
   drafts: {catalog: async () => ({collections: [{parentStudyId: 'subject-0', bindingId: request.binding.bindingId, title: 'Subject 0'}], drafts: []}), read: async () => ({projection: [{words: 'Invented words.'}], expected: {v: 1}, history: []})},
   outputs: {read: async () => ({outputs: []})}, checks: {read: async () => null}, consentDesk: {read: async () => ({people: [], release: {}})},
   library: {tree: async () => ({sources: []})}, simmer: {boards: {read: async () => ({groups: [], forming: {}})}},
   instagram: {plans: async () => ({plans: []}), read: async () => null}, places: {read: async () => ({places: []})},
   suggestions: () => slow});
  const started = Date.now(), first = await standing.one({parentStudyId: 'subject-0'});
  assert.ok(Date.now() - started < 1000, 'answered without waiting');
  assert.equal(first.facts.suggestions, null, 'Not known for now');
  answer({items: [{status: 'pending', stale: false}]});
  await new Promise(r => setTimeout(r, 30));
  assert.equal((await standing.one({parentStudyId: 'subject-0'})).facts.suggestions, 1, 'the next read has it');
  fs.rmSync(dir, {recursive: true, force: true});
 } finally {f.done();}
});

test('a kept list from an older release: a command it lacks waits for the running release; rubbish and a failing store are survived', async () => {
 const older = commandsBody('old0001'), newer = commandsBody('new0002');
 newer.commands.push({name: 'subjects.standing', method: 'GET', route: '/api/subjects/standing', readOnly: true, schema: {query: []}, actors: ['any']});
 const storage = memory(); storage.setItem('v2.commands', JSON.stringify({sha: 'old0001', commands: older.commands}));
 const urls = [];
 const c = client.createClient({base: 'http://x.test', search: '', storage, fetchImpl: async u => {urls.push(u); await new Promise(r => setTimeout(r, 30)); return u.includes('capabilities') ? reply(newer) : reply({count: 0});}});
 assert.equal((await c.commands()).length, 1, 'shown from the kept list');
 assert.equal((await c.find('subjects.standing')).route, '/api/subjects/standing', 'found after waiting for the running release');
 assert.equal((await c.call('subjects.standing')).count, 0);
 await assert.rejects(c.find('no.such'), e => e.kind === 'refused');
 // A call that comes back 404 on a kept list is tried once on the fresh one.
 const storage2 = memory(); storage2.setItem('v2.commands', JSON.stringify({sha: 'old0001', commands: [{name: 'x.read', method: 'GET', route: '/api/old-x', readOnly: true, schema: {query: []}, actors: ['any']}]}));
 const moved = commandsBody('new0002'); moved.commands = [{name: 'x.read', method: 'GET', route: '/api/new-x', readOnly: true, schema: {query: []}, actors: ['any']}];
 const c2 = client.createClient({base: 'http://x.test', search: '', storage: storage2, fetchImpl: async u => {await new Promise(r => setTimeout(r, 20)); return u.includes('capabilities') ? reply(moved) : u.endsWith('/api/old-x') ? {ok: false, status: 404, text: async () => '{"error":"gone"}'} : reply({ok: 1});}});
 assert.deepEqual(await c2.call('x.read'), {ok: 1});
 // Rubbish in the store is dropped.
 for (const bad of ['{"sha":"s","commands":[null,{"name":"a"}]}', 'not json', '{"sha":"","commands":[]}']) {
  const s3 = memory(); s3.setItem('v2.commands', bad);
  const c3 = client.createClient({base: 'http://x.test', search: '', storage: s3, fetchImpl: async () => reply(commandsBody('fine003'))});
  assert.equal((await c3.find('a.read')).name, 'a.read');
 }
 const throwing = {getItem() {throw new Error('no');}, setItem() {throw new Error('no');}, removeItem() {throw new Error('no');}};
 assert.equal((await client.createClient({base: 'http://x.test', search: '', storage: throwing, fetchImpl: async () => reply(commandsBody('fine003'))}).find('a.read')).name, 'a.read');
});

test('a resolved suggestion count sends one change for its subject, and that change starts no new wait', async () => {
 const {createEventBus} = await import('../runtime/services/events.mjs');
 const events = createEventBus(), seen = [];
 events.subscribe(e => seen.push(e));
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speed-ev-')), id = '11111111-1111-4111-8111-111111111111', B = '0b5e3a3c-1f1e-4c7a-9f00-000000000000';
 fs.mkdirSync(path.join(dir, 'study-mcp-requests', id), {recursive: true});
 fs.writeFileSync(path.join(dir, 'study-mcp-requests', id, 'request.json'), JSON.stringify({binding: {bindingId: B}, expected: {v: 1}, createdAt: '2026-11-10T00:00:00Z'}));
 fs.writeFileSync(path.join(dir, 'study-mcp-requests', id, 'proposal.json'), '{}');
 let asked = 0;
 const standing = createSubjectStanding({dataDir: dir, events,
  drafts: {catalog: async () => ({collections: [{parentStudyId: 'subject-0', bindingId: B, title: 'Subject 0'}], drafts: []}), read: async () => ({projection: [{words: 'Invented words.'}], expected: {v: 1}, history: []})},
  outputs: {read: async () => ({outputs: []})}, checks: {read: async () => null}, consentDesk: {read: async () => ({people: [], release: {}})},
  library: {tree: async () => ({sources: []})}, simmer: {boards: {read: async () => ({groups: [], forming: {}})}},
  instagram: {plans: async () => ({plans: []}), read: async () => null}, places: {read: async () => ({places: []})},
  suggestions: async () => {asked++; return {items: [{status: 'pending', stale: false}]};}});
 try {
  assert.equal((await standing.one({parentStudyId: 'subject-0'})).facts.suggestions, null);
  await new Promise(r => setTimeout(r, 50));
  const told = seen.filter(e => e.kind === 'standing.suggestions');
  assert.equal(told.length, 1); assert.deepEqual(told[0].scope, {kind: 'subject', id: 'subject-0'});
  assert.equal((await standing.one({parentStudyId: 'subject-0'})).facts.suggestions, 1);
  await standing.all(); await new Promise(r => setTimeout(r, 50));
  assert.equal(asked, 1, 'the event started no second wait');
  assert.equal(seen.filter(e => e.kind === 'standing.suggestions').length, 1, 'and no second event');
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});

test('a subject read straight after a write answers sees it, even while Home reads at the same time', {timeout: 120000}, async t => {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false, packageView: {syntheticFixtures: true}});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => {await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true});});
 const base = 'http://127.0.0.1:' + srv.address().port;
 const {fillDemo} = await import('../scripts/demo-fill.mjs');
 await fillDemo(base, {only: ['shade-and-patience', 'the-first-cup']});
 const get = async p => (await fetch(base + p, {headers: AGENT})).json();
 const subject = 'demo-the-first-cup';
 let stale = 0;
 for (let i = 0; i < 30; i++) {
  const before = (await get('/api/subject/standing?parentStudyId=' + subject)).facts.asks || 0;
  // Home keeps reading, staggered, while the write runs.
  let reading = true; const homeLoop = (async () => {while (reading) {await get('/api/subjects/standing'); await new Promise(r => setTimeout(r, 1));}})();
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 25)));
  const raised = await fetch(base + '/api/needs-you/raise', {method: 'POST', headers: {...AGENT, 'Content-Type': 'application/json'}, body: JSON.stringify({operationId: crypto.randomUUID(), band: 'only-adrian', question: 'Invented question ' + i + '?', choices: ['Yes', 'No'], about: 'Invented.', scope: {kind: 'project', id: subject}})});
  assert.equal(raised.status, 200);
  const after = (await get('/api/subject/standing?parentStudyId=' + subject)).facts.asks || 0;
  if (after !== before + 1) stale++;
  reading = false; await homeLoop;
 }
 assert.equal(stale, 0, 'the subject never served the state from before the write');
});
