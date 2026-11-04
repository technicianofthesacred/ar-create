#!/usr/bin/env node
// mag — the magazine from a terminal or a /mag session, through AR Create's commands (never the files).
//
//   node tools/magazine/mag.mjs board                         the live board (same lines as mag-status)
//   node tools/magazine/mag.mjs read "<path>" [--out <file>]  prints {path, hash, kind}; the text goes to --out
//   node tools/magazine/mag.mjs put "<path>" --from <file> (--expect <hash> | --new) [--reason "<why>"]
//        writes the file's new text; --expect is the hash `read` gave you (a changed file answers 409,
//        never an overwrite). Drafts, CONTEXT, FEEDBACK and post words become a proposal for Adrian.
//   node tools/magazine/mag.mjs claim "<file name>" --story "<Story>" [--folder 0|1]
//   node tools/magazine/mag.mjs intake <claimId> [--file]       intake state; --file publishes a ready RAW
//   node tools/magazine/mag.mjs check "<DEV path>" [--source "<SRC path>"]
//   node tools/magazine/mag.mjs hold "<what this run is doing>" | release | lock
//   node tools/magazine/mag.mjs status-table | proposals | tidy | undo <operationId>
//
// Env: AR_CREATE_URL (default http://127.0.0.1:8841), AR_CREATE_ACTOR (default agent:claude-code).
// Exit codes are the CLI's: 0 ok, 1 failed, 2 usage, 3 conflict (re-read), 4 locked, 5 human-only.
import { realpathSync } from 'node:fs';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient, exitCodeFor, EXIT} from '../../agents/lib/client.mjs';

const FLAGS = {out: 1, from: 1, expect: 1, new: 0, reason: 1, story: 1, folder: 1, file: 0, source: 1};
function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (!(k in FLAGS)) throw new Error(`Unknown option ${a}.`); opt[k] = FLAGS[k] ? argv[++i] : true; if (FLAGS[k] && opt[k] === undefined) throw new Error(`${a} needs a value.`); } else pos.push(a); }
  return {pos, opt};
}

export async function main(argv, {env = process.env, fetchImpl = fetch, out = s => process.stdout.write(s)} = {}) {
  let parsed; try { parsed = parse(argv); } catch (e) { out(JSON.stringify({ok: false, error: e.message}) + '\n'); return EXIT.usage; }
  const {pos: [cmd, ...args], opt} = parsed;
  const client = createClient({url: env.AR_CREATE_URL || 'http://127.0.0.1:8841', actor: env.AR_CREATE_ACTOR || 'agent:claude-code', client: 'cli', fetchImpl, timeoutMs: 120000});
  const call = async (name, input = {}) => { const r = await client.call(name, input); return r; };
  const done = (r, print = v => JSON.stringify(v, null, 1)) => { out((r.ok ? print(r.body) : JSON.stringify({ok: false, status: r.status, error: r.body?.error, ...(r.body?.holder ? {holder: r.body.holder} : {})}, null, 1)) + '\n'); return exitCodeFor(r.status); };
  const op = () => randomUUID();
  switch (cmd) {
    case 'board': return done(await call('magazine.board'), b => b.text + (b.lock?.held ? `\nLock: ${b.lock.state}, ${b.lock.holder?.machine} since ${b.lock.holder?.since}\n` : '') + (b.proposals?.length ? `\nWaiting for Adrian's yes: ${b.proposals.map(p => p.path).join('; ')}\n` : ''));
    case 'read': {
      const r = await call('magazine.read', {path: args[0]});
      if (r.ok && opt.out) { if (r.body.text === null && r.body.exists) { out(JSON.stringify({ok: false, error: 'Not a text file.'}) + '\n'); return EXIT.failed; } fs.writeFileSync(opt.out, r.body.text ?? ''); }
      return done(r, b => JSON.stringify({path: b.path, exists: b.exists, hash: b.hash, kind: b.kind, class: b.class, ...(opt.out ? {savedTo: opt.out} : {text: b.text})}, null, 1));
    }
    case 'put': {
      if (!opt.from || (!opt.expect && !opt.new) || (opt.expect && opt.new)) { out(JSON.stringify({ok: false, error: 'put needs --from <file> and either --expect <hash from read> or --new.'}) + '\n'); return EXIT.usage; }
      return done(await call('magazine.write', {path: args[0], content: fs.readFileSync(opt.from, 'utf8'), expectedHash: opt.new ? null : opt.expect, operationId: op(), ...(opt.reason ? {reason: opt.reason} : {})}));
    }
    case 'claim': return done(await call('magazine.drops.claim', {name: args[0], story: opt.story, folder: Number(opt.folder ?? 0), operationId: op()}));
    case 'intake': return done(opt.file ? await call('magazine.intake.file', {claimId: args[0], operationId: op()}) : await call('magazine.intake', {claimId: args[0]}));
    case 'check': return done(await call('magazine.check', {draft: args[0], ...(opt.source ? {source: opt.source} : {})}), r => [...r.quotes.lines, ...r.splits.lines].join('\n'));
    case 'hold': return done(await call('magazine.lock.hold', {doing: args.join(' ') || 'a /mag run on this Mac'}));
    case 'release': return done(await call('magazine.lock.release'));
    case 'lock': return done(await call('magazine.lock.status'));
    case 'status-table': return done(await call('magazine.status.refresh', {operationId: op()}));
    case 'proposals': return done(await call('magazine.proposals', {status: 'open'}));
    case 'tidy': return done(await call('magazine.tidy'));
    case 'undo': return done(await call('magazine.undo', {undoOperationId: args[0], operationId: op()}));
    default: out(JSON.stringify({ok: false, error: 'Commands: board, read, put, claim, intake, check, hold, release, lock, status-table, proposals, tidy, undo.'}) + '\n'); return EXIT.usage;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stdout.write(JSON.stringify({ok: false, error: error.message}) + '\n'); process.exitCode = EXIT.failed; }
}
