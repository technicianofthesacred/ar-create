// Speed of the first look: a commands-only read of /api/capabilities, the client keeping it for the session, and
// subject standing reading less (one draft read per subject, a few subjects at a time, no waiting on suggestions).
// Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
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
