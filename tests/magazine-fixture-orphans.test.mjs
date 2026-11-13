// A test run that is killed before its own cleanup must leave no server running and no fixture folder in the checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const repo = path.resolve(import.meta.dirname, '..');
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const until = async (check, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (check()) return true; await new Promise(r => setTimeout(r, 50)); } return check(); };

// A stand-in for one test file: it builds a fixture, starts a server process over it and then never cleans up.
const runner = `
import {spawn} from 'node:child_process';
import {buildMagazineFixture, ownChild} from './tests/helpers/magazine-fixture.mjs';
const f = buildMagazineFixture();
const server = ownChild(spawn(process.execPath, ['-e', "require('node:http').createServer(()=>{}).listen(0,'127.0.0.1');setInterval(()=>require('node:fs').writeFileSync(process.argv[1]+'/still-running.txt','x'),20)", f.data], {stdio: 'ignore'}));
process.send({dir: f.dir, pid: server.pid, mode: process.env.ORPHAN_MODE});
if (process.env.ORPHAN_MODE === 'throw') setTimeout(() => { throw Error('invented failure before cleanup'); }, 300);
else setInterval(() => {}, 1000);
`;
async function start(mode) {
  const child = spawn(process.execPath, ['--input-type=module', '--eval', runner], {cwd: repo, env: {...process.env, ORPHAN_MODE: mode}, stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  const [started] = await once(child, 'message');
  assert.equal(fs.existsSync(started.dir), true, 'the fixture exists while the run is alive');
  assert.equal(alive(started.pid), true, 'the server runs while the run is alive');
  await new Promise(r => setTimeout(r, 150));
  return {child, ...started};
}
async function gone(t, run) {
  t.after(() => { try { process.kill(run.pid, 'SIGKILL'); } catch {} fs.rmSync(run.dir, {recursive: true, force: true}); });
  assert.equal(await until(() => !alive(run.pid)), true, 'the server was stopped');
  assert.equal(await until(() => !fs.existsSync(run.dir)), true, 'the fixture folder was removed');
}

for (const signal of ['SIGKILL', 'SIGTERM']) test(`a run ended by ${signal} leaves no server and no fixture folder`, async t => {
  const run = await start('hang');
  const ended = once(run.child, 'exit'); run.child.kill(signal); await ended;
  await gone(t, run);
});

test('a run that throws before its cleanup leaves no server and no fixture folder', async t => {
  const run = await start('throw');
  await once(run.child, 'exit');
  await gone(t, run);
});
