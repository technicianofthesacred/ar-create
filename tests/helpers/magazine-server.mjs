// A real AR Create server over a synthetic magazine, for HTTP and CLI tests.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from '../../runtime/server.mjs';
import {run} from '../../agents/cli/ar-create.mjs';
import {buildMagazineFixture} from './magazine-fixture.mjs';

const repo = path.resolve(import.meta.dirname, '..', '..');
const sha = b => createHash('sha256').update(b).digest('hex');
export async function magazineServer(t, {writable = true, fixture} = {}) {
  const f = buildMagazineFixture(fixture);
  const server = await createServer({dataDir: f.data, publicDir: path.join(repo, 'public'), researchEnabled: false, magazineVault: {vaultRoot: f.vault, filesRoot: f.files, drops: f.drops, writable, machine: 'studio-mac', exportStaging: path.join(f.dir, 'staging')}});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); f.cleanup(); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const cli = async (args, input, actor = 'agent:claude-code') => run(['--url', url, '--actor', actor, ...args, ...(input ? ['--input', '-'] : [])], {stdin: async () => JSON.stringify(input)});
  const page = async (route, input) => { const r = await fetch(url + route, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-AR-Actor': 'human:adrian', 'X-AR-Client': 'mag-page'}, body: JSON.stringify(input)}); return {status: r.status, body: await r.json()}; };
  const journal = () => { const dir = path.join(f.data, 'journal'); return fs.existsSync(dir) ? fs.readdirSync(dir).flatMap(n => fs.readFileSync(path.join(dir, n), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))) : []; };
  const hashOf = rel => sha(fs.readFileSync(path.join(f.vault, rel)));
  return {f, url, cli, page, journal, hashOf};
}

