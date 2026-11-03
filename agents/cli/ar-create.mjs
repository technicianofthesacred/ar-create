#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient, exitCodeFor, EXIT } from '../lib/client.mjs';
import { ACTOR_VALUES } from '../lib/actors.mjs';

/**
 * ar-create — the one CLI for every agent. JSON in (--input FILE or - for
 * stdin), JSON out (one line on stdout). Every request carries --actor.
 *
 *   node agents/cli/ar-create.mjs --url http://127.0.0.1:PORT --actor agent:claude-code status
 *   ... list-commands [--section draft]
 *   ... call <command-name> --input -
 *   ... project read --input -        (domain sugar; see SUGAR below)
 *
 * Exit codes: 0 ok, 1 failed, 2 usage, 3 conflict (409: re-read, never force),
 * 4 locked (423: someone holds a lease), 5 forbidden (403: human-only or Origin).
 */
export const SUGAR = Object.freeze({
  library: { tree: 'sources.tree', file: 'sources.file.get', search: 'concept.sources.search', read: 'concept.source', collections: 'collections.get' },
  collection: { list: 'inquiries.catalog', read: 'inquiries.read', create: 'inquiries.create', update: 'inquiries.update', save: 'inquiries.save', projects: 'inquiries.projects', undo: 'inquiries.learning.undo' },
  project: { list: 'concepts.get', create: 'concepts.post', read: 'concept', save: 'concept.save', direction: 'study.human-direction', capabilities: 'concept.capabilities' },
  needs: { list: 'needs-you', raise: 'needs-you.raise' },
  words: { list: 'words', export: 'words.export', add: 'words.add', import: 'words.import', decide: 'words.decide', recognise: 'words.recognise', checks: 'words.checks', check: 'words.check', answer: 'words.answer' },
  phone: { status: 'phone-pickup', setup: 'phone-pickup.setup', check: 'phone-pickup.check' },
  piece: { list: 'pieces.get', create: 'pieces.post', switch: 'pieces.switch' },
  magazine: { board: 'magazine.board', story: 'magazine.story', propose: 'magazine.write', status: 'magazine.status.table' },
  consent: { desk: 'consent.desk', open: 'consent.open', claim: 'consent.claims.record', link: 'consent.claims.link', flag: 'consent.claims.flag', person: 'consent.people.record', draft: 'consent.people.draft-request' },
  simmer: { board: 'simmer.board.get', material: 'simmer.material', intake: 'simmer.intake', propose: 'simmer.propose', name: 'simmer.dish' },
  draft: { catalog: 'study-draft.catalog', read: 'study-draft.read', open: 'study-draft.open', create: 'study-draft.create-collection', save: 'study-draft.save', undo: 'study-draft.undo', check: 'study-draft.check.get', inspect: 'study-draft.inspect.get', proposals: 'study-ai.requests' },
});
// Sugar verbs that take one positional value (put into the input under that key) or need a fresh id for a single attempt.
// `magazine story <id>`; `magazine propose --input {path, content, expectedHash}` (agents' prose becomes a proposal for Adrian;
// the operationId is generated unless the input names one).
// `words export` prints the versioned library snapshot (redirect it to a file); `words add|import|decide|answer --input` get a fresh
// operationId; `words check <jobId>` and `words recognise <jobId>` name the recording. Agents suggest words (marked as theirs);
// `words decide` and `words answer` are Adrian's alone (exit 5 for an agent).
// `simmer board <subject>`, `simmer material <subject>`; `simmer intake|propose|name --input` get a fresh operationId
// unless the input names one (name one yourself when you may retry: a retry with the same id adds nothing twice).
export const SUGAR_POSITIONAL = Object.freeze({ 'magazine story': 'id', 'simmer board': 'subject', 'simmer material': 'subject', 'words check': 'jobId', 'words recognise': 'jobId' });
const freshOperation = () => ({ operationId: randomUUID() });
export const SUGAR_DEFAULTS = Object.freeze({ 'magazine propose': freshOperation, 'simmer intake': freshOperation, 'simmer propose': freshOperation, 'simmer name': freshOperation, 'needs raise': freshOperation, 'words add': freshOperation, 'words import': freshOperation, 'words decide': freshOperation, 'words answer': freshOperation });
const FLAGS = ['--url', '--actor', '--input', '--section', '--config'];
export const USAGE = {
  usage: 'node agents/cli/ar-create.mjs --url http://127.0.0.1:PORT --actor ACTOR COMMAND [ARGS] [--input FILE|-]',
  commands: ['status', 'events', 'history', 'lease acquire|renew|release|list', 'handoff', 'ask', 'list-commands [--section S]', 'call NAME', ...Object.entries(SUGAR).map(([domain, verbs]) => `${domain} ${Object.keys(verbs).join('|')}`)],
  actors: ACTOR_VALUES,
  env: { AR_CREATE_URL: 'default for --url', AR_CREATE_ACTOR: 'default for --actor' },
  exitCodes: { 0: 'ok', 1: 'failed', 2: 'usage', 3: 'conflict (re-read; never force)', 4: 'locked by another actor', 5: 'forbidden (human-only)' },
};

/** The human's editor state among presence rows: dirty/sequence/lastSeen. */
export function editorOf(rows) { const human = rows.find(row => String(row.actor).startsWith('human:')); return human ? { dirty: !!human.dirty, sequence: human.sequence, lastSeen: human.lastSeen, stage: human.stage, scope: human.scope } : { dirty: false, sequence: null, lastSeen: null }; }
export function parseArgs(args, env = process.env) {
  const options = {}, positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (FLAGS.includes(arg)) {
      const key = arg.slice(2);
      if (Object.hasOwn(options, key) || args[i + 1] === undefined || (args[i + 1].startsWith('--') && args[i + 1] !== '-')) throw new Error(`Provide ${arg} exactly once with its value.`);
      options[key] = args[++i];
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}; content belongs in --input JSON.`);
    else positional.push(arg);
  }
  options.url ??= env.AR_CREATE_URL;
  options.actor ??= env.AR_CREATE_ACTOR;
  if (!positional.length) throw new Error('Choose a command. Run --help.');
  if (!options.url) throw new Error('Provide --url http://127.0.0.1:PORT (or AR_CREATE_URL).');
  if (!options.actor) throw new Error('Provide --actor (for example agent:claude-code) or AR_CREATE_ACTOR. Every request names its author.');
  return { ...options, positional };
}
async function readInput(path, stdin) {
  if (!path) return {};
  const text = path === '-' ? await stdin() : await readFile(path, 'utf8');
  if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new Error('JSON input exceeds 4 MiB.');
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Input must be a JSON object.');
  return value;
}
const defaultStdin = async () => { const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk); return Buffer.concat(chunks).toString('utf8'); };

export async function run(args, { fetchImpl = fetch, stdin = defaultStdin, env = process.env } = {}) {
  let options;
  try { options = parseArgs(args, env); } catch (error) { return { exitCode: EXIT.usage, result: { ok: false, error: error.message, ...USAGE } }; }
  if (options.help) return { exitCode: EXIT.ok, result: USAGE };
  let client;
  try { client = createClient({ url: options.url, actor: options.actor, client: 'cli', fetchImpl }); }
  catch (error) { return { exitCode: EXIT.usage, result: { ok: false, error: error.message } }; }
  const [command, ...rest] = options.positional, input = await readInput(options.input, stdin);
  const answer = result => ({ exitCode: exitCodeFor(result.status), result: result.ok ? result.body : { ok: false, status: result.status, error: result.status === 409 ? 'revision_conflict' : result.status === 423 ? 'locked' : result.status === 403 ? 'forbidden' : 'request_failed', command: result.command, details: result.body } });
  if (command === 'list-commands') {
    const caps = await client.listCommands();
    const commands = caps.commands.filter(item => !options.section || item.section === options.section);
    return { exitCode: EXIT.ok, result: { schema: caps.schema, git: caps.git, count: commands.length, commands } };
  }
  if (command === 'call') {
    if (rest.length !== 1) return { exitCode: EXIT.usage, result: { ok: false, error: 'Use: call COMMAND-NAME [--input FILE|-]' } };
    return answer(await client.call(rest[0], input));
  }
  if (command === 'history') {
    // --input {kind, id, status, actor, since, limit}: journal lines, newest first.
    return answer(await client.call('journal', input));
  }
  if (command === 'lease') {
    // lease acquire|renew --input {scope:{kind,id}, reason?, ttlMs?}; lease release --input {scope, leaseId?, force?}; lease list --input {kind?, id?}
    const verb = rest[0], names = { acquire: 'leases.acquire', renew: 'leases.acquire', release: 'leases.release', list: 'leases' };
    if (!names[verb] || rest.length !== 1) return { exitCode: EXIT.usage, result: { ok: false, error: 'Use: lease acquire|renew|release|list --input -' } };
    return answer(await client.call(names[verb], input));
  }
  if (command === 'handoff') {
    // --input {scope:{kind,id}, to: actor, summary (<=280), operationId?}
    return answer(await client.call('journal.handoff', input));
  }
  if (command === 'ask') {
    // --input {scope:{kind,id}, question (<=280), options?: [<=5], to?: actor (default human:adrian)}
    return answer(await client.call('journal.ask', input));
  }
  if (command === 'events') {
    // --input {since, kind, id, limit}; pass the returned cursor as since next time.
    return answer(await client.call('events.since', input));
  }
  if (command === 'status') {
    // --input {since, kind, id} narrows presence and recent events to one record.
    const caps = await client.listCommands(), filter = { ...(input.kind ? { kind: input.kind } : {}), ...(input.id ? { id: input.id } : {}) };
    const presence = await client.call('presence.get', filter), changes = await client.call('events.since', { since: input.since ?? 0, limit: 20, ...filter });
    return { exitCode: EXIT.ok, result: { release: caps.git?.sha ?? null, url: client.base, actor: client.actor, git: caps.git, commands: caps.commands.length, sections: [...new Set(caps.commands.map(item => item.section))].sort(), presence: presence.ok ? presence.body.presence : [], editor: editorOf(presence.ok ? presence.body.presence : []), events: changes.ok ? changes.body : null } };
  }
  if (Object.hasOwn(SUGAR, command)) {
    const verb = rest[0], name = SUGAR[command][verb], key = `${command} ${verb}`, positional = SUGAR_POSITIONAL[key];
    if (!name || rest.length !== (positional ? 2 : 1)) return { exitCode: EXIT.usage, result: { ok: false, error: `Use: ${command} ${Object.keys(SUGAR[command]).map(v => SUGAR_POSITIONAL[`${command} ${v}`] ? `${v} <${SUGAR_POSITIONAL[`${command} ${v}`]}>` : v).join('|')}` } };
    return answer(await client.call(name, { ...(SUGAR_DEFAULTS[key]?.() || {}), ...input, ...(positional ? { [positional]: rest[1] } : {}) }));
  }
  return { exitCode: EXIT.usage, result: { ok: false, error: `Unknown command "${command}".`, ...USAGE } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const { result, exitCode } = await run(process.argv.slice(2)); process.stdout.write(`${JSON.stringify(result)}\n`); process.exitCode = exitCode; }
  catch (error) { process.stdout.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = EXIT.failed; }
}
