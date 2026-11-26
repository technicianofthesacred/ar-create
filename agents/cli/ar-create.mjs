#!/usr/bin/env node
import { realpathSync } from 'node:fs';
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
  instagram: { templates: 'instagram.templates', plans: 'instagram.plans', plan: 'instagram.plan.get', layout: 'instagram.layout', codes: 'instagram.plan.codes', look: 'instagram.look', account: 'instagram.account', placed: 'instagram.placed', template: 'instagram.template' },
  look: { list: 'looks', read: 'look', save: 'look.save', import: 'look.import' },
  asset: { list: 'look.assets', add: 'look.asset.add' },
  template: { list: 'templates', read: 'template', propose: 'template.propose', accept: 'template.decide', 'turn-down': 'template.decide', retire: 'template.retire' },
  account: { list: 'accounts', read: 'account', save: 'account.save' },
  phone: { status: 'phone-pickup', setup: 'phone-pickup.setup', check: 'phone-pickup.check' },
  piece: { list: 'pieces.get', create: 'pieces.post', switch: 'pieces.switch' },
  magazine: { board: 'magazine.board', story: 'magazine.story', propose: 'magazine.write', status: 'magazine.status.table' },
  consent: { desk: 'consent.desk', open: 'consent.open', claim: 'consent.claims.record', link: 'consent.claims.link', flag: 'consent.claims.flag', person: 'consent.people.record', draft: 'consent.people.draft-request' },
  simmer: { board: 'simmer.board.get', material: 'simmer.material', intake: 'simmer.intake', propose: 'simmer.propose', name: 'simmer.dish' },
  subject: { places: 'subject-places', place: 'subject-places.save', reorder: 'subject-places.reorder', folders: 'subject-places.folders.get', folder: 'subject-places.folders.post' },
  standing: { subject: 'subject.standing', all: 'subjects.standing' },
  guide: { all: 'agent.guide', story: 'agent.guide' },
  research: { topics: 'research-topics', topic: 'research-topics.read', subject: 'research-topics.subject', save: 'research-topics.save', propose: 'research-topics.propose', link: 'research-topics.link', groups: 'research-topics.groups', group: 'research-topics.group', 'group-save': 'research-topics.group.save', 'group-sources': 'research-topics.group.sources', ask: 'research-topics.ask' },
  draft: { catalog: 'study-draft.catalog', read: 'study-draft.read', open: 'study-draft.open', create: 'study-draft.create-collection', save: 'study-draft.save', undo: 'study-draft.undo', check: 'study-draft.check.get', inspect: 'study-draft.inspect.get', proposals: 'study-ai.requests' },
});
// Sugar verbs that take one positional value (put into the input under that key) or need a fresh id for a single attempt.
// `magazine story <id>`; `magazine propose --input {path, content, expectedHash}` (agents' prose becomes a proposal for Adrian;
// the operationId is generated unless the input names one).
// `instagram templates|plans`; `instagram plan <id>` reads one plan; `instagram layout --input` sets a story's frames (a frame's templateId may be a layout code).
// `instagram codes --plan <id> --say "use C1, 2 and 5"` reads the plan, then sets its carousel layouts from the codes through
// instagram.plan.codes (add --input '{"storyId":"S1","format":"carousel"}' to pick a story or format). It proposes a layout order only.
// `look list`; `look read <id>` gives the DESIGN.md, the roles a slide is drawn with and the look's files; `look import --input
// {text}` or {path} (a DESIGN.md inside the home) proposes a look and saves nothing; `look save --input {id, text,
// expectedRevision, expectedHash}` saves it to the home (a fresh operationId unless the input names one).
// `instagram look --plan <id> --look art` reads the plan, then sets the look it draws in (`--look door` draws in its
// door's look again). It proposes, like a layout; his yes stays his.
// `account list [--look art]` lists the accounts (with --look, which of them that look may post to); `account read <id>`; `account save --input
// {id?, name, service?, handle?, link?, looks:[...], expectedRevision, expectedHash}` files one in the home (a fresh operationId unless the
// input names one). An account is a label and a destination: nothing is posted. `instagram account --plan <id> --account <account id>`
// reads the plan, then sets where it posts (`--account auto` uses the first account that lists its look). It proposes, like a layout.
// `asset list <look id>` lists what can be placed on a slide in that look (its logo, marks and graphics); `asset add --input
// {id, asset:{id, name, kind, file, base64} or {id, name, kind: mark, text}, expectedRevision, expectedHash}` adds one (a png, or an
// svg made safe). `instagram placed --plan <id> --input {format, slide, placed:[...]}` reads the plan, then sets the things placed
// on that slide (a proposal, like a layout). `instagram template --input {id, format, slide, name, looks?}` saves a slide as a
// template: kept with its code for Adrian, a proposal for an assistant. `template list [--input {status}]`, `template read <id>`;
// `template propose --input {name, row, kind?, markup, looks?}` proposes a template from markup (checked by allowlist);
// `template accept|turn-down|retire <id>` read the template, then send his decision (Adrian's alone: exit 5 for an assistant).
// `words export` prints the versioned library snapshot (redirect it to a file); `words add|import|decide|answer --input` get a fresh
// operationId; `words check <jobId>` and `words recognise <jobId>` name the recording. Agents suggest words (marked as theirs);
// `words decide` and `words answer` are Adrian's alone (exit 5 for an agent).
// `subject places` reads every saved place and the folders ({parentStudyId} for one subject); `subject place` saves one
// subject's folder, tags, pin, archived or order with its expectedRevision; `subject reorder` sets a hand order for several;
// `subject folders` reads the folder list; `subject folder --input {action: create|rename|reorder|remove|undo, ...}` changes it.
// The writes get a fresh operationId unless the input names one.
// `standing subject <id>` says where one subject stands: its forms in order, each step's state and the one next step;
// `standing all` gives every subject's station, ring, next step and forms in one read (kept fresh as changes arrive).
// `guide all` gives the step guide (what Adrian gives and what an agent does at each step, with the commands in order);
// `guide story <id>` lays that story's standing over it: each step's state now and the next step. Start every piece of work here.
// `simmer board <subject>`, `simmer material <subject>`; `simmer intake|propose|name --input` get a fresh operationId
// unless the input names one (name one yourself when you may retry: a retry with the same id adds nothing twice).
// `research topics [--input {group?, saying?, week?, subject?}]` lists research topics; `research topic <id>` reads one with what it
// points to; `research subject <parentStudyId>` the topics a subject uses; `research propose --input {name, origin, ...}` proposes
// one for Adrian to keep or let go; `research save|link` file a topic; `research groups|group <id>|group-save|group-sources`;
// `research ask --input {query, groupId?}` finds exact words in the sources. Writes get a fresh operationId.
export const SUGAR_POSITIONAL = Object.freeze({ 'standing subject': 'parentStudyId', 'guide story': 'parentStudyId', 'magazine story': 'id', 'simmer board': 'subject', 'simmer material': 'subject', 'words check': 'jobId', 'words recognise': 'jobId', 'instagram plan': 'id', 'look read': 'id', 'account read': 'id', 'asset list': 'id', 'template read': 'id', 'research topic': 'id', 'research group': 'id', 'research subject': 'parentStudyId' });
const freshOperation = () => ({ operationId: randomUUID() });
export const SUGAR_DEFAULTS = Object.freeze({ 'magazine propose': freshOperation, 'simmer intake': freshOperation, 'simmer propose': freshOperation, 'simmer name': freshOperation, 'needs raise': freshOperation, 'words add': freshOperation, 'words import': freshOperation, 'words decide': freshOperation, 'words answer': freshOperation, 'look save': freshOperation, 'account save': freshOperation, 'asset add': freshOperation, 'instagram template': freshOperation, 'template propose': freshOperation, 'subject place': freshOperation, 'subject reorder': freshOperation, 'subject folder': freshOperation, 'research save': freshOperation, 'research propose': freshOperation, 'research link': freshOperation, 'research group-save': freshOperation, 'research group-sources': freshOperation });
const FLAGS = ['--url', '--actor', '--input', '--section', '--config', '--plan', '--say', '--look', '--account'];
export const USAGE = {
  usage: 'node agents/cli/ar-create.mjs --url http://127.0.0.1:PORT --actor ACTOR COMMAND [ARGS] [--input FILE|-]',
  commands: ['status', 'events', 'history', 'lease acquire|renew|release|list', 'handoff', 'ask', 'list-commands [--section S]', 'call NAME', ...Object.entries(SUGAR).map(([domain, verbs]) => `${domain} ${Object.keys(verbs).join('|')}`)],
  actors: ACTOR_VALUES,
  env: { AR_CREATE_URL: 'default for --url', AR_CREATE_ACTOR: 'default for --actor' },
  exitCodes: { 0: 'ok', 1: 'failed', 2: 'usage', 3: 'conflict (re-read; never force)', 4: 'locked: by another actor, or held for consent (read the consent desk; never force)', 5: 'forbidden (human-only)' },
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
  const answer = result => ({ exitCode: exitCodeFor(result.status), result: result.ok ? result.body : { ok: false, status: result.status, error: result.status === 409 ? 'revision_conflict' : result.status === 423 ? (result.body?.code === 'consent-hold' ? 'consent_hold' : 'locked') : result.status === 403 ? 'forbidden' : 'request_failed', command: result.command, details: result.body } });
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
  if (command === 'instagram' && rest[0] === 'codes') {
    if (rest.length !== 1 || !options.plan || typeof options.say !== 'string') return { exitCode: EXIT.usage, result: { ok: false, error: 'Use: instagram codes --plan <plan id> --say "use C1, 2 and 5" [--input {storyId?, format?}]' } };
    const read = await client.call('instagram.plan.get', { id: options.plan });
    if (!read.ok) return answer(read);
    return answer(await client.call('instagram.plan.codes', { operationId: randomUUID(), ...input, id: options.plan, expectedRevision: read.body.revision, expectedHash: read.body.hash, say: options.say }));
  }
  if (command === 'instagram' && rest[0] === 'look' && (options.plan || options.look)) {
    if (rest.length !== 1 || !options.plan || !options.look) return { exitCode: EXIT.usage, result: { ok: false, error: 'Use: instagram look --plan <plan id> --look <look id, or door>' } };
    const read = await client.call('instagram.plan.get', { id: options.plan });
    if (!read.ok) return answer(read);
    return answer(await client.call('instagram.look', { operationId: randomUUID(), ...input, id: options.plan, expectedRevision: read.body.revision, expectedHash: read.body.hash, look: options.look === 'door' ? null : options.look }));
  }
  if (command === 'instagram' && rest[0] === 'account' && (options.plan || options.account)) {
    if (rest.length !== 1 || !options.plan || !options.account) return { exitCode: EXIT.usage, result: { ok: false, error: 'Use: instagram account --plan <plan id> --account <account id, or auto>' } };
    const read = await client.call('instagram.plan.get', { id: options.plan });
    if (!read.ok) return answer(read);
    return answer(await client.call('instagram.account', { operationId: randomUUID(), ...input, id: options.plan, expectedRevision: read.body.revision, expectedHash: read.body.hash, account: options.account === 'auto' ? null : options.account }));
  }
  if (command === 'account' && rest[0] === 'list' && rest.length === 1 && options.look) return answer(await client.call('accounts', { ...input, look: options.look }));
  if (command === 'instagram' && rest[0] === 'placed') {
    if (rest.length !== 1 || !options.plan) return { exitCode: EXIT.usage, result: { ok: false, error: 'Use: instagram placed --plan <plan id> --input {format, slide, placed:[...]}' } };
    const read = await client.call('instagram.plan.get', { id: options.plan });
    if (!read.ok) return answer(read);
    return answer(await client.call('instagram.placed', { operationId: randomUUID(), ...input, id: options.plan, expectedRevision: read.body.revision, expectedHash: read.body.hash }));
  }
  if (command === 'template' && ['accept', 'turn-down', 'retire'].includes(rest[0])) {
    if (rest.length !== 2) return { exitCode: EXIT.usage, result: { ok: false, error: `Use: template ${rest[0]} <template id>` } };
    const read = await client.call('template', { id: rest[1] });
    if (!read.ok) return answer(read);
    const body = { operationId: randomUUID(), ...input, id: rest[1], expectedRevision: read.body.revision, expectedHash: read.body.hash };
    return answer(rest[0] === 'retire' ? await client.call('template.retire', body) : await client.call('template.decide', { ...body, decision: rest[0] }));
  }
  if (Object.hasOwn(SUGAR, command)) {
    const verb = rest[0], name = SUGAR[command][verb], key = `${command} ${verb}`, positional = SUGAR_POSITIONAL[key];
    if (!name || rest.length !== (positional ? 2 : 1)) return { exitCode: EXIT.usage, result: { ok: false, error: `Use: ${command} ${Object.keys(SUGAR[command]).map(v => SUGAR_POSITIONAL[`${command} ${v}`] ? `${v} <${SUGAR_POSITIONAL[`${command} ${v}`]}>` : v).join('|')}` } };
    return answer(await client.call(name, { ...(SUGAR_DEFAULTS[key]?.() || {}), ...input, ...(positional ? { [positional]: rest[1] } : {}) }));
  }
  return { exitCode: EXIT.usage, result: { ok: false, error: `Unknown command "${command}".`, ...USAGE } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { const { result, exitCode } = await run(process.argv.slice(2)); process.stdout.write(`${JSON.stringify(result)}\n`); process.exitCode = exitCode; }
  catch (error) { process.stdout.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = EXIT.failed; }
}
