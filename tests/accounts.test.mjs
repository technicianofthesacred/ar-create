// Accounts: where a post goes. A label and a destination, separate from looks. Invented content only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createAccounts, SHIPPED_ACCOUNTS} from '../runtime/services/accounts.mjs';
import {createInstagramStudio} from '../runtime/services/instagram-studio.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {describeRoutes} from '../runtime/commands.mjs';
import {run, SUGAR} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';

const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const as = (actor, fn) => withActor({actor, client: 'http'}, fn);
const op = () => crypto.randomUUID();
const ADRIAN = 'human:adrian', AGENT = 'agent:claude-code';
const accountsIn = (dataDir = tmp('accounts-')) => createAccounts({dataDir});
const SHIPPED = {teajia: ['teajia'], 'technician-of-the-sacred': ['art', 'mandala-codes', 'personal'], 'mandala-codes': ['mandala-codes']};

test('the three shipped accounts start with empty handles and links, and name the looks that post there', async () => {
 const a = accountsIn(), {accounts} = await a.list();
 assert.deepEqual(accounts.map(x => x.id), ['mandala-codes', 'teajia', 'technician-of-the-sacred']);
 for (const x of accounts) { assert.deepEqual(x.looks, SHIPPED[x.id]); assert.equal(x.handle, ''); assert.equal(x.link, ''); assert.equal(x.service, 'instagram'); assert.equal(x.source, 'shipped'); assert.equal(x.revision, 0); }
 assert.equal(accounts.find(x => x.id === 'technician-of-the-sacred').name, 'Technician of the Sacred');
 assert.ok(fs.existsSync(path.join(SHIPPED_ACCOUNTS, 'teajia.json')));
});

test('listing for a look says which accounts it may post to', async () => {
 const a = accountsIn(), mandala = await a.list({look: 'mandala-codes'});
 assert.deepEqual(mandala.forLook, ['mandala-codes', 'technician-of-the-sacred']);
 assert.deepEqual(mandala.accounts.map(x => [x.id, x.postsLook]), [['mandala-codes', true], ['teajia', false], ['technician-of-the-sacred', true]]);
 assert.deepEqual((await a.list({look: 'teajia'})).forLook, ['teajia']);
 await assert.rejects(a.list({look: 'Not an id'}), e => e.status === 400);
});

test('saving an account: strict ids, plain names, the link kept only as text, a revision check, and the home copy wins', async () => {
 const dataDir = tmp('accounts-save-'), a = accountsIn(dataDir);
 await assert.rejects(a.save({id: 'x', operationId: op(), name: 'X', looks: []}), e => e.status === 403 || /actor|write/i.test(e.message), 'a save needs a named actor');
 const save = (input, actor = AGENT) => as(actor, () => a.save({operationId: op(), ...input}));
 const made = await save({name: 'Pottery Notes', handle: '@pottery.notes', link: 'https://example.invalid/pottery', looks: ['art']});
 assert.equal(made.id, 'pottery-notes', 'the id comes from the name');
 assert.deepEqual([made.revision, made.updatedBy, made.link, made.handle, made.source], [1, AGENT, 'https://example.invalid/pottery', '@pottery.notes', 'home']);
 const file = path.join(dataDir, 'accounts', 'pottery-notes.json');
 assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).operations[0].actor, AGENT);
 // The same operation saves nothing twice.
 const again = await as(AGENT, () => a.save({operationId: JSON.parse(fs.readFileSync(file, 'utf8')).operations[0].operationId, name: 'Pottery Notes', looks: ['art'], id: 'pottery-notes'}));
 assert.equal(again.revision, 1);
 // Refusals, each plain.
 for (const bad of [{id: 'Bad Id'}, {id: '../x'}, {id: 'a/b'}, {name: ''}, {name: '<b>x</b>'}, {name: 'x'.repeat(81)}, {name: 'a\u0007b'}, {handle: 'has space'}, {handle: '<x>'}, {link: 'a b'}, {link: 'x"onmouseover="y'}, {link: 'x'.repeat(301)}, {service: 'Insta Gram'}, {looks: 'art'}, {looks: ['nobody']}, {looks: ['Art']}, {looks: ['art', 'art']}, {looks: ['../art']}])
  await assert.rejects(save({id: 'ok-id', name: 'Ok', looks: ['art'], ...bad}), e => e.status >= 400 && e.status < 500, JSON.stringify(bad));
 assert.ok(!fs.existsSync(path.join(dataDir, 'accounts', 'ok-id.json')), 'a refused save writes nothing');
 // A link is only text: it is never opened, so even an unreachable address saves.
 assert.equal((await save({id: 'far', name: 'Far', link: 'http://127.0.0.1:1/never', looks: []})).link, 'http://127.0.0.1:1/never');
 // The revision check, for home and for shipped accounts.
 await assert.rejects(save({id: 'pottery-notes', name: 'Pottery', looks: ['art']}), e => e.status === 400 && /expectedRevision/.test(e.message));
 await assert.rejects(save({id: 'pottery-notes', name: 'Pottery', looks: ['art'], expectedRevision: 0, expectedHash: made.hash}), e => e.status === 409);
 const shipped = await a.read({id: 'mandala-codes'});
 const changed = await save({id: 'mandala-codes', name: 'Mandala Codes', handle: 'mandalacodes', looks: ['mandala-codes', 'personal'], expectedRevision: 0, expectedHash: shipped.hash}, ADRIAN);
 assert.deepEqual([changed.source, changed.revision, changed.handle, changed.looks], ['home, changing the shipped account', 1, 'mandalacodes', ['mandala-codes', 'personal']]);
 assert.equal(accountsIn().load('mandala-codes').handle, '', 'the shipped account itself is untouched');
 assert.equal(a.load('mandala-codes').handle, 'mandalacodes', 'the home copy wins');
});

const TRANSCRIPT = 'Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.';
const T_ID = '11111111-2222-4333-8444-555555555555', T_HASH = crypto.createHash('sha256').update(TRANSCRIPT).digest('hex');
const library = {snapshot: async (id, {includeBody} = {}) => { if (id === T_ID) return {id, hash: T_HASH, path: '/x/talk.md', text: includeBody ? TRANSCRIPT : undefined}; throw Error('missing'); }};
async function plan(door, dataDir = tmp('accounts-plan-')) {
 const s = createInstagramStudio({dataDir, library});
 const made = await as(AGENT, () => s.propose({operationId: op(), subject: 'proj-1', title: 'The mender', door, material: {transcripts: [{sourceId: T_ID, sourceHash: T_HASH}], photos: []}}));
 const line = made.lines.find(l => l.text.startsWith('I think every crack'));
 const p = await as(AGENT, () => s.propose({id: made.id, operationId: op(), expectedRevision: made.revision, expectedHash: made.hash, stories: [{title: 'Cracks', readback: 'Cracks record use.', dish: 'A carousel.', why: 'Strong.', reader: 'The maker', spine: [line.id], matches: []}]}));
 return {s, p, dataDir};
}
const base = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});

test('a plan resolves to the first account that lists its look, with no change to the plan or its hash', async () => {
 const expected = {teajia: 'teajia', art: 'technician-of-the-sacred', 'mandala-codes': 'mandala-codes', personal: 'technician-of-the-sacred', '': 'teajia'};
 for (const [door, id] of Object.entries(expected)) {
  const {s, p, dataDir} = await plan(door);
  assert.deepEqual([p.account.id, p.account.from, p.account.postsLook], [id, 'look', true], 'door ' + (door || '(none)'));
  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'instagram-plans', p.id + '.json'), 'utf8'));
  assert.equal(Object.hasOwn(stored, 'account'), false, 'nothing is written onto the plan');
  const old = crypto.createHash('sha256').update(JSON.stringify({subject: stored.subject, title: stored.title, door: stored.door, material: stored.material, lines: stored.lines, moments: stored.moments, flags: stored.flags, confirmations: stored.confirmations, marks: stored.marks, meaningLog: stored.meaningLog, stories: stored.stories, gaps: stored.gaps, heard: stored.heard, chosen: stored.chosen, layouts: stored.layouts, ready: stored.ready})).digest('hex');
  assert.equal((await s.read({id: p.id})).hash, old, 'the hash is as it was before accounts');
  assert.equal((await s.plans()).plans[0].account.id, id);
 }
});

test('instagram.account sets where a plan posts, refuses an account that does not list its look, and keeps the layout\'s guards', async () => {
 const {s, p, dataDir} = await plan('mandala-codes');
 const set = await as(AGENT, () => s.setAccount({...base(p), account: 'technician-of-the-sacred'}));
 assert.deepEqual([set.account.id, set.account.from, set.account.name, set.revision, set.updatedBy], ['technician-of-the-sacred', 'plan', 'Technician of the Sacred', p.revision + 1, AGENT]);
 assert.ok(JSON.parse(fs.readFileSync(path.join(dataDir, 'instagram-plans', p.id + '.json'), 'utf8')).operations.some(o => o.actor === AGENT && o.what === 'account technician-of-the-sacred'));
 assert.notEqual(set.hash, p.hash, 'an account is part of the plan\'s content');
 await assert.rejects(as(AGENT, () => s.setAccount({...base(set), account: 'teajia'})), e => e.status === 422 && /Teajia does not post the mandala-codes look .*mandala-codes, technician-of-the-sacred/.test(e.message));
 await assert.rejects(as(AGENT, () => s.setAccount({...base(set), account: 'nobody'})), e => e.status === 404);
 await assert.rejects(as(AGENT, () => s.setAccount({...base(set), account: 'Not An Id'})), e => e.status === 400);
 await assert.rejects(as(AGENT, () => s.setAccount({...base(set)})), e => e.status === 400);
 await assert.rejects(as(AGENT, () => s.setAccount({...base(set), expectedRevision: set.revision - 1, account: 'mandala-codes'})), e => e.status === 409);
 // His yes: where a post goes needs his yes again, and an assistant cannot change it after.
 const laid = await as(AGENT, () => s.layout({...base(set), storyId: 'S1', format: 'carousel'}));
 const chosen = await as(ADRIAN, () => s.choose({...base(laid), storyId: 'S1'}));
 const ready = await as(ADRIAN, () => s.ready({...base(chosen), format: 'carousel'}));
 await assert.rejects(as(AGENT, () => s.setAccount({...base(ready), account: 'mandala-codes'})), e => e.status === 409 && /Ask him/.test(e.message));
 assert.deepEqual((await as(ADRIAN, () => s.setAccount({...base(ready), account: 'mandala-codes'}))).ready, {}, 'a changed account needs his yes again');
 // Back to the first account that lists the look.
 const cur = await s.read({id: p.id}), auto = await as(AGENT, () => s.setAccount({...base(cur), account: null}));
 assert.deepEqual([auto.account.id, auto.account.from], ['mandala-codes', 'look']);
});

test('an account that stops listing the plan\'s look says so, and a plan\'s own account survives a missing record', async () => {
 const {s, p, dataDir} = await plan('art');
 const a = createAccounts({dataDir});
 const set = await as(AGENT, () => s.setAccount({...base(p), account: 'technician-of-the-sacred'}));
 const tech = await a.read({id: 'technician-of-the-sacred'});
 await as(ADRIAN, () => a.save({operationId: op(), id: 'technician-of-the-sacred', name: tech.name, looks: ['mandala-codes'], expectedRevision: 0, expectedHash: tech.hash}));
 const after = await s.read({id: set.id});
 assert.equal(after.account.id, 'technician-of-the-sacred');
 assert.equal(after.account.postsLook, false);
 fs.writeFileSync(path.join(dataDir, 'instagram-plans', set.id + '.json'), fs.readFileSync(path.join(dataDir, 'instagram-plans', set.id + '.json'), 'utf8').replace('"technician-of-the-sacred"', '"gone"'));
 assert.deepEqual([(await s.read({id: set.id})).account.missing], [true]);
});

test('the account commands are in the registry, in the existing style', () => {
 const by = Object.fromEntries(describeRoutes({}).map(c => [c.name, c]));
 for (const name of ['accounts', 'account', 'account.save', 'instagram.account']) { assert.ok(by[name], name); assert.equal(by[name].section, 'outputs', name); }
 for (const name of ['accounts', 'account']) assert.equal(by[name].readOnly, true, name);
 for (const name of ['account.save', 'instagram.account']) { assert.equal(by[name].readOnly, false); assert.deepEqual(by[name].actors, ['any'], name + ' is open to the owner and assistants'); }
 assert.deepEqual(SUGAR.account, {list: 'accounts', read: 'account', save: 'account.save'});
 assert.equal(SUGAR.instagram.account, 'instagram.account');
});

async function server(t) {
 const fixture = syntheticHome(), config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
 const srv = await createServer({dataDir: config.dataDir, publicDir: path.resolve('public'), studyOriginalRoots: config.studyOriginalRoots, sharedArticles: true, researchEnabled: false});
 await new Promise(r => srv.listen(0, '127.0.0.1', r));
 t.after(async () => { await new Promise(r => srv.close(r)); fs.rmSync(fixture.dir, {recursive: true, force: true}); });
 const url = 'http://127.0.0.1:' + srv.address().port;
 const cli = (args, input, actor = AGENT) => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
 const get = (route, actor = AGENT) => new Promise((resolve, reject) => http.get(url + route, {headers: {'X-AR-Actor': actor}}, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')})); }).on('error', reject));
 return {url, cli, get, dataDir: config.dataDir};
}

test('through the real server: list, read and save from the CLI, journaled, reached over MCP', async t => {
 const f = await server(t);
 const list = await f.cli(['account', 'list']);
 assert.equal(list.exitCode, 0, JSON.stringify(list.result));
 assert.deepEqual(list.result.accounts.map(a => a.id), ['mandala-codes', 'teajia', 'technician-of-the-sacred']);
 const forArt = await f.cli(['account', 'list', '--look', 'art']);
 assert.deepEqual(forArt.result.forLook, ['technician-of-the-sacred']);
 const read = await f.cli(['account', 'read', 'teajia']);
 assert.equal(read.result.name, 'Teajia');
 assert.notEqual((await f.cli(['account', 'read', 'nobody'])).exitCode, 0);
 const saved = await f.cli(['account', 'save'], {id: 'pottery-notes', name: 'Pottery Notes', handle: 'potterynotes', link: 'https://example.invalid/p', looks: ['art']}, 'agent:codex');
 assert.equal(saved.exitCode, 0, JSON.stringify(saved.result));
 assert.equal(saved.result.updatedBy, 'agent:codex');
 assert.ok(fs.existsSync(path.join(f.dataDir, 'accounts', 'pottery-notes.json')));
 assert.equal((await f.cli(['account', 'save'], {id: 'pottery-notes', name: 'P', looks: ['art'], expectedRevision: 0, expectedHash: saved.result.hash})).exitCode, 3, 'a stale save is a conflict');
 assert.equal((await f.cli(['account', 'save'], {id: 'Bad Id', name: 'P', looks: []})).exitCode, 1, 'a bad id is refused');
 const history = await f.cli(['history'], {kind: 'account', id: 'pottery-notes'});
 assert.ok(JSON.stringify(history.result).includes('"kind":"account.save"') && JSON.stringify(history.result).includes('agent:codex'), 'the save is journaled: ' + JSON.stringify(history.result).slice(0, 400));
 const tools = createTools({url: f.url, actor: 'agent:codex'});
 assert.ok((await tools.callTool('ar_create_call', {name: 'accounts', input: {}})).accounts.some(a => a.id === 'pottery-notes'));
 assert.equal((await tools.callTool('ar_create_call', {name: 'accounts', input: {look: 'art'}})).forLook.includes('pottery-notes'), true);
 const listed = await tools.callTool('ar_create_list_commands', {section: 'outputs'});
 for (const name of ['accounts', 'account', 'account.save', 'instagram.account']) assert.ok(listed.commands.some(c => c.name === name), name + ' over MCP');
});

test('instagram account from the CLI reads the plan, then sets its account', async () => {
 const calls = [], list = describeRoutes({});
 const fetchImpl = async (url, init) => {
  const u = new URL(url), body = init.body ? JSON.parse(init.body) : null; calls.push({path: u.pathname, body});
  const json = value => ({ok: true, status: 200, text: async () => JSON.stringify(value)});
  if (u.pathname === '/api/capabilities') return json({commands: list.map(({pattern, ...rest}) => rest)});
  if (u.pathname === '/api/instagram/plan') return json({id: 'plan-1', revision: 4, hash: 'h'.repeat(64)});
  return json({ok: true});
 };
 const args = tail => ['--url', 'http://127.0.0.1:8854', '--actor', AGENT, 'instagram', 'account', ...tail];
 assert.equal((await run(args(['--plan', 'plan-1', '--account', 'mandala-codes']), {fetchImpl})).exitCode, 0);
 const post = calls.find(c => c.path === '/api/instagram/account');
 assert.deepEqual({account: post.body.account, id: post.body.id, rev: post.body.expectedRevision}, {account: 'mandala-codes', id: 'plan-1', rev: 4});
 await run(args(['--plan', 'plan-1', '--account', 'auto']), {fetchImpl});
 assert.equal(calls.filter(c => c.path === '/api/instagram/account').at(-1).body.account, null);
 assert.equal((await run(args(['--plan', 'plan-1']), {fetchImpl})).exitCode, 2);
});

test('a link is empty, an http(s) address or a bare domain; script and scheme-less forms are refused; bidi names are refused', async () => {
 const a = accountsIn(), save = input => as(AGENT, () => a.save({operationId: op(), id: 'linky', name: 'Linky', looks: [], ...input}));
 for (const ok of ['', 'http://example.com', 'https://example.com/a/b?x=1#y', 'example.com', 'www.example.com/page', 'example.com:8080/x', 'http://127.0.0.1:8854/x'])
  assert.equal((await as(AGENT, () => a.save({operationId: op(), id: 'linky-' + crypto.randomBytes(3).toString('hex'), name: 'Linky', looks: [], link: ok}))).link, ok, 'allowed: ' + ok);
 for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>', 'vbscript:x', '//example.com', '///example.com', 'ftp://example.com', 'file:///etc/passwd', 'localhost', 'example', '/just/a/path', 'https://', 'javascript://example.com/%0aalert(1)', 'https://exa mple.com', 'https://example.com\\evil', 'https://example.com/"x'])
  await assert.rejects(save({link: bad}), e => e.status === 400, 'refused: ' + bad);
 for (const name of ['Evil‮Name', 'Zero​Width', 'Mark‏x', 'Iso⁦late', 'C1\u0085x'])
  await assert.rejects(save({name}), e => e.status === 400, JSON.stringify(name));
 assert.equal((await save({name: 'Café Ñandú'})).name, 'Café Ñandú');
});

test('changing a plan\'s look re-checks its own account and never switches it quietly', async () => {
 const {s, p} = await plan('art');
 const set = await as(AGENT, () => s.setAccount({...base(p), account: 'technician-of-the-sacred'}));
 await assert.rejects(as(AGENT, () => s.setLook({...base(set), look: 'teajia'})), e => e.status === 422 && /Technician of the Sacred.*teajia look.*Change the account first, or clear it/.test(e.message));
 assert.equal((await s.read({id: p.id})).account.id, 'technician-of-the-sacred', 'nothing changed');
 // A look the account does list is fine, and the account stays.
 const same = await as(AGENT, () => s.setLook({...base(set), look: 'mandala-codes'}));
 assert.deepEqual([same.look, same.account.id, same.account.from], ['mandala-codes', 'technician-of-the-sacred', 'plan']);
 // Clearing with null or "auto" in the same call falls back to the new look's usual account.
 for (const clear of [null, 'auto']) {
  const cur = await s.read({id: p.id}), moved = await as(AGENT, () => s.setLook({...base(cur), look: 'teajia', account: clear}));
  assert.deepEqual([moved.look, moved.account.id, moved.account.from], ['teajia', 'teajia', 'look'], String(clear));
  await as(AGENT, () => s.setLook({...base(moved), look: 'art', account: 'technician-of-the-sacred'}));
 }
 // Naming a specific account in the same call must list the new look.
 const cur = await s.read({id: p.id});
 await assert.rejects(as(AGENT, () => s.setLook({...base(cur), look: 'teajia', account: 'mandala-codes'})), e => e.status === 422);
 assert.equal((await as(AGENT, () => s.setLook({...base(cur), look: 'mandala-codes', account: 'mandala-codes'}))).account.id, 'mandala-codes');
 // The door's look again is checked too.
 const cur2 = await s.read({id: p.id});
 await assert.rejects(as(AGENT, () => s.setLook({...base(cur2), look: null})), e => e.status === 422, 'the door is art; mandala-codes does not list it');
 // A plan with no account of its own is not blocked.
 const {s: s2, p: p2} = await plan('art');
 assert.equal((await as(AGENT, () => s2.setLook({...base(p2), look: 'teajia'}))).account.id, 'teajia');
});

test('when he says ready, the resolved account is written into the plan; plans not ready keep their hash', async () => {
 const {s, p, dataDir} = await plan('mandala-codes');
 assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(dataDir, 'instagram-plans', p.id + '.json'), 'utf8')), 'account'), false);
 const laid = await as(AGENT, () => s.layout({...base(p), storyId: 'S1', format: 'carousel'}));
 assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(dataDir, 'instagram-plans', p.id + '.json'), 'utf8')), 'account'), false, 'a laid-out plan that is not ready gets no account written');
 const chosen = await as(ADRIAN, () => s.choose({...base(laid), storyId: 'S1'}));
 const ready = await as(ADRIAN, () => s.ready({...base(chosen), format: 'carousel'}));
 assert.deepEqual([ready.account.id, ready.account.from], ['mandala-codes', 'plan']);
 // An account added later with an earlier id does not move it.
 const a = createAccounts({dataDir});
 await as(ADRIAN, () => a.save({operationId: op(), id: 'aaa-first', name: 'First', looks: ['mandala-codes']}));
 assert.equal((await s.read({id: p.id})).account.id, 'mandala-codes');
 // An account he already chose stays as it was.
 const {s: s3, p: p3} = await plan('mandala-codes');
 const mine = await as(AGENT, () => s3.setAccount({...base(p3), account: 'technician-of-the-sacred'}));
 const l3 = await as(AGENT, () => s3.layout({...base(mine), storyId: 'S1', format: 'carousel'}));
 const c3 = await as(ADRIAN, () => s3.choose({...base(l3), storyId: 'S1'}));
 assert.equal((await as(ADRIAN, () => s3.ready({...base(c3), format: 'carousel'}))).account.id, 'technician-of-the-sacred');
});

test('over HTTP, render and sheet name the account in headers; an odd stored id gives no header and no 500', async t => {
 const dataDir = tmp('accounts-http-'), studio = createInstagramStudio({dataDir, library});
 const made = await as(AGENT, () => studio.propose({operationId: op(), subject: 'proj-1', title: 'The mender', door: 'mandala-codes', material: {transcripts: [{sourceId: T_ID, sourceHash: T_HASH}], photos: []}}));
 const line = made.lines.find(l => l.text.startsWith('I think every crack'));
 const p = await as(AGENT, () => studio.propose({id: made.id, operationId: op(), expectedRevision: made.revision, expectedHash: made.hash, stories: [{title: 'Cracks', readback: 'x.', dish: 'A carousel.', why: 'Strong.', reader: 'The maker', spine: [line.id], matches: []}]}));
 const laid = await as(AGENT, () => studio.layout({...base(p), storyId: 'S1', format: 'carousel'}));
 const accounts = createAccounts({dataDir});
 await as(ADRIAN, () => accounts.save({operationId: op(), id: 'cafe', name: 'Café Ñandú', looks: ['mandala-codes']}));
 await as(AGENT, () => studio.setAccount({...base(laid), account: 'cafe'}));
 const srv = http.createServer((req, res) => withActor({actor: AGENT, client: 'http'}, () => import('../runtime/services/instagram-studio.mjs').then(m => m.handleInstagram(req, res, {dataDir, library}))));
 await new Promise(r => srv.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => srv.close(r)));
 const get = route => new Promise((resolve, reject) => http.get('http://127.0.0.1:' + srv.address().port + route, res => { res.resume(); res.on('end', () => resolve({status: res.statusCode, headers: res.headers})); }).on('error', reject));
 for (const kind of ['render', 'sheet']) {
  const r = await get('/api/instagram/' + kind + '?id=' + p.id + '&format=carousel');
  assert.equal(r.status, 200, kind);
  assert.equal(r.headers['x-ar-account'], 'cafe');
  assert.equal(decodeURIComponent(r.headers['x-ar-account-name']), 'Café Ñandú');
 }
 const file = path.join(dataDir, 'instagram-plans', p.id + '.json');
 fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"account": "cafe"', '"account": "Bad\\r\\nX-Evil: 1"'));
 for (const kind of ['render', 'sheet']) {
  const r = await get('/api/instagram/' + kind + '?id=' + p.id + '&format=carousel');
  assert.equal(r.status, 200, kind + ' still answers');
  assert.equal(r.headers['x-ar-account'], undefined);
  assert.equal(r.headers['x-evil'], undefined);
 }
});
