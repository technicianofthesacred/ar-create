// The step guide (runtime/agent-guide.mjs): every agent reaches the same guide (HTTP, CLI, MCP), every command it names
// is real and used as the registry allows, its document is current, and an agent following it walks a Magazine story
// from Gather to Publish with each step showing what the agent did.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from '../runtime/server.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {STEPS, guideCommands, guideFor, GUIDE_SCHEMA, AGENTS} from '../runtime/agent-guide.mjs';
import {SECTIONS} from '../runtime/standing-rule.mjs';
import {walk, WALKED} from '../scripts/walk-steps.mjs';
import {render, FILE} from '../scripts/gen-agent-steps.mjs';
import {run} from '../agents/cli/ar-create.mjs';
import {createTools} from '../agents/mcp/server.mjs';
import {actorFromClientInfo, validActor} from '../agents/lib/actors.mjs';

async function home(t) {
 const f = buildMagazineFixture({}); t.after(f.cleanup);
 const plan = planRegistration({vault: f.vault, files: f.files, archived: ['UI-flow-part-01']});
 fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive: true});
 fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema: INDEX_SCHEMA, vaultRoot: f.vault, filesRoot: f.files, stories: plan.stories.map(p => ({storyId: p.storyId, name: p.name, number: p.number, archived: p.archived}))}));
 for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId + '.json'), JSON.stringify(p));
 const server = await createServer({dataDir: f.data, publicDir: path.resolve('public'), researchEnabled: false, studyOriginalRoots: {vaultRoot: f.vault, filesRoot: f.files, catalog: {projects: {}, drafts: {}}}, magazineVault: {vaultRoot: f.vault, filesRoot: f.files, writable: true}});
 await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => {server.closeAllConnections?.(); server.close(r);}));
 const url = 'http://127.0.0.1:' + server.address().port;
 const get = async p => {const r = await fetch(url + p, {headers: {'X-AR-Actor': 'agent:hermes', 'X-AR-Client': 'http'}}); return {status: r.status, value: await r.json()};};
 return {f, url, get};
}

test('every command the guide names is real, and used the way the registry allows', {timeout: 120000}, async t => {
 const h = await home(t), caps = (await h.get('/api/capabilities')).value, by = new Map(caps.commands.map(c => [c.name, c]));
 assert.ok(by.get('agent.guide'), 'the guide is itself a command');
 assert.equal(by.get('agent.guide').readOnly, true);
 for (const g of guideCommands()) {
  const c = by.get(g.name); assert.ok(c, `${g.step} (${g.kind}) names ${g.name}, which is not a command`);
  const human = c.actors.includes('human');
  if (g.use === 'yours') assert.ok(human, `${g.name} is listed as his alone but is open to agents`);
  else assert.ok(!human, `${g.name} is listed for agents to ${g.use} but only Adrian may call it`);
  if (g.use === 'read') assert.equal(c.readOnly, true, `${g.name} is listed as a read but writes`);
 }
 for (const s of STEPS) assert.ok(Object.hasOwn(SECTIONS, s.id), `${s.id} is a step the story page knows`);
 for (const id of Object.keys(SECTIONS)) assert.ok(STEPS.some(s => s.id === id), `the story page's step ${id} has a guide entry`);
 for (const s of STEPS.filter(x => x.magazine)) assert.ok(WALKED.includes(s.id), `the walk covers the Magazine step ${s.id}`);
 for (const a of AGENTS) assert.ok(validActor(a.actor), a.actor);
});

test('docs/AGENT-STEPS.md is the guide, current', () => {
 assert.equal(fs.readFileSync(FILE, 'utf8'), render(), 'run node scripts/gen-agent-steps.mjs');
});

test('the guide reaches every agent: HTTP, the command line and MCP; with a story it carries each step as the story page shows it', {timeout: 120000}, async t => {
 const h = await home(t);
 const whole = await h.get('/api/agent/guide');
 assert.equal(whole.status, 200); assert.equal(whole.value.schema, GUIDE_SCHEMA); assert.equal(whole.value.steps.length, STEPS.length);
 const story = await h.get('/api/agent/guide?parentStudyId=mag-clay-teacher'), standing = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value;
 assert.equal(story.status, 200); assert.equal(story.value.story.kind, 'magazine');
 assert.deepEqual(story.value.story.ids, {parentStudyId: 'mag-clay-teacher', storyId: 'mag-clay-teacher', pieceId: 'mag-clay-teacher:article'});
 assert.deepEqual(story.value.forms[0].steps.map(s => [s.id, s.state, s.note]), standing.forms[0].steps.map(s => [s.id, s.state, s.note]));
 assert.deepEqual(story.value.story.next, standing.next);
 for (const s of story.value.forms[0].steps) assert.ok(Array.isArray(s.read) && Array.isArray(s.do) && Array.isArray(s.yours) && s.youGive && s.agentDoes, s.id);
 assert.equal((await h.get('/api/agent/guide?other=1')).status, 400);
 assert.equal((await h.get('/api/agent/guide?parentStudyId=nobody')).status, 404);
 const cli = await run(['--url', h.url, '--actor', 'agent:grok', 'guide', 'story', 'mag-clay-teacher'], {});
 assert.equal(cli.exitCode, 0, JSON.stringify(cli.result)); assert.equal(cli.result.story.id, 'mag-clay-teacher');
 const mcp = await createTools({url: h.url, actor: 'agent:chatgpt'}).callTool('ar_create_guide', {parentStudyId: 'mag-clay-teacher'});
 assert.deepEqual(mcp.forms, story.value.forms);
 assert.equal(actorFromClientInfo({name: 'claude-ai'}), 'agent:claude-code', 'the Claude desktop app is Claude');
 assert.deepEqual(guideFor(), whole.value);
});

test('an agent following the guide walks a Magazine story from Gather to Publish, and each step shows what it did', {timeout: 180000}, async t => {
 const h = await home(t);
 const before = (await h.get('/api/subject/standing?parentStudyId=mag-clay-teacher')).value.forms[0].steps;
 assert.equal(before.find(s => s.id === 'facts').note, 'Not looked into yet');
 const report = await walk({url: h.url, actor: 'agent:hermes', story: 'mag-clay-teacher'});
 assert.ok(report.ok, JSON.stringify(report.steps.filter(s => s.problems.length).map(s => [s.id, s.problems])));
 assert.deepEqual(report.steps.map(s => s.id), before.map(s => s.id));
 const row = id => report.steps.find(s => s.id === id);
 // An agent's research file shows on the step though it was made after the Magazine was registered.
 assert.equal(row('facts').after.state, 'done');
 assert.equal(row('dish').after.state, 'done');
 assert.match(row('words').after.note, /suggestions? waiting/);
 assert.match(row('yes').after.note, /drafted/);
 // His decisions were refused to the agent, on every step that has one walked.
 for (const id of ['facts', 'words', 'yes', 'publish']) assert.ok(row(id).refused.length && row(id).refused.every(r => r.status === 403), id);
 await assert.rejects(walk({url: 'http://127.0.0.1:8841', story: 'x'}), /never runs against the installed app/);
});
