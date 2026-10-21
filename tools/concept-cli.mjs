#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validActor, actorHeaders } from '../agents/lib/actors.mjs';

const COMMANDS = new Set(['list', 'create', 'read', 'library-search', 'library-read', 'save', 'status']);
const SCHEMAS = {
  list: [], status: [], create: ['parentStudyId', 'title', 'operationId'],
  read: ['parentStudyId'], 'library-search': ['parentStudyId', 'query', 'limit'],
  'library-read': ['parentStudyId', 'sourceId'],
  save: ['parentStudyId', 'operationId', 'expectedRevision', 'expectedHash', 'authorThoughts', 'aiInterpretation', 'suggestions', 'sourceSelections', 'body', 'replaceExistingDirection', 'adoptedDirection'],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
export function localUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Provide an explicit local HTTP URL with a port.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || !/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[0-9]+\/?$/.test(value) || Number(url.port || 80) < 1 || Number(url.port || 80) > 65535
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('URL must use local HTTP, an explicit valid port, and no credentials, path, query or fragment.');
  }
  return url.origin;
}
export function validateInput(command, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be a JSON object.');
  for (const key of Object.keys(input)) if (!SCHEMAS[command].includes(key)) throw new Error(`Unknown input field: ${key}`);
  const required = command === 'create' ? ['parentStudyId', 'title', 'operationId']
    : command === 'save' ? ['parentStudyId', 'operationId', 'expectedRevision', 'expectedHash']
    : command === 'library-search' ? ['query']
    : command === 'library-read' ? ['sourceId'] : command === 'read' ? ['parentStudyId'] : [];
  if (command === 'save') {
    const structured = ['authorThoughts', 'aiInterpretation', 'suggestions', 'sourceSelections'];
    if (Object.hasOwn(input, 'body')) {
      if (typeof input.body !== 'string') throw new Error('body must be a string.');
      if (structured.some(key => Object.hasOwn(input, key)) || Object.hasOwn(input, 'replaceExistingDirection') || Object.hasOwn(input, 'adoptedDirection')) throw new Error('Choose exact body or structured fields, not both.');
    } else {
      required.push(...structured);
      if (Object.hasOwn(input, 'replaceExistingDirection') && typeof input.replaceExistingDirection !== 'boolean') throw new Error('replaceExistingDirection must be a boolean.');
    }
  }
  for (const key of required) if (!Object.hasOwn(input, key)) throw new Error(`Missing input field: ${key}`);
  for (const key of ['parentStudyId', 'title', 'query', 'sourceId']) {
    if (Object.hasOwn(input, key) && (typeof input[key] !== 'string' || !input[key].trim())) throw new Error(`${key} must be a nonempty string.`);
  }
  if (Object.hasOwn(input, 'operationId') && !UUID.test(input.operationId)) throw new Error('operationId must be an explicit UUID.');
  if (Object.hasOwn(input, 'expectedRevision') && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)) throw new Error('expectedRevision must be a nonnegative integer from the latest read.');
  if (Object.hasOwn(input, 'expectedHash') && (typeof input.expectedHash !== 'string' || !HASH.test(input.expectedHash))) throw new Error('expectedHash must be the SHA-256 hash from the latest read.');
  if (Object.hasOwn(input, 'limit') && (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 20)) throw new Error('limit must be an integer between 1 and 20.');
  for (const key of ['authorThoughts', 'aiInterpretation', 'suggestions', 'adoptedDirection']) if (Object.hasOwn(input, key) && typeof input[key] !== 'string') throw new Error(`${key} must be a string.`);
  if (Object.hasOwn(input, 'sourceSelections')) {
    if (!Array.isArray(input.sourceSelections)) throw new Error('sourceSelections must be an array.');
    for (const source of input.sourceSelections) {
      if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).some(key => !['sourceId', 'sourceHash', 'quote', 'start'].includes(key))
          || typeof source.sourceId !== 'string' || !source.sourceId || typeof source.sourceHash !== 'string' || !HASH.test(source.sourceHash)
          || typeof source.quote !== 'string' || !source.quote || !Number.isSafeInteger(source.start) || source.start < 0) throw new Error('Each source selection needs sourceId, sourceHash, exact quote and nonnegative start; unknown fields are refused.');
    }
  }
  return input;
}
function parseArgs(args) {
  let command;
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (['--url', '--config', '--input', '--actor'].includes(arg)) {
      const key = arg.slice(2);
      if (Object.hasOwn(options, key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Provide ${arg} exactly once with its value.`);
      options[key] = args[++i];
    } else if (!command && COMMANDS.has(arg)) command = arg;
    else throw new Error('Unknown command or argument; content belongs in --input JSON.');
  }
  if (!command) throw new Error('Choose list, create, read, library-search, library-read, save or status.');
  if (!!options.url === !!options.config) throw new Error('Provide exactly one of --url or --config.');
  return { command, ...options };
}
async function jsonFile(path, stdin) {
  const text = path === '-' ? await stdin() : await readFile(path, 'utf8');
  if (Buffer.byteLength(text) > 1024 * 1024) throw new Error('JSON input exceeds 1 MiB.');
  return JSON.parse(text);
}
export async function run(args, { fetchImpl = fetch, stdin = async () => {
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 1024 * 1024) throw new Error('JSON input exceeds 1 MiB.'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
} } = {}) {
  const options = parseArgs(args);
  if (options.help) return { exitCode: 0, result: { usage: 'node tools/concept-cli.mjs --url http://127.0.0.1:PORT [--actor agent:claude-code] COMMAND [--input FILE|-]', alias: 'Kept for one release; the full CLI is agents/cli/ar-create.mjs.', commands: [...COMMANDS], config: 'Use --config FILE instead of --url; JSON object: {"url":"http://127.0.0.1:PORT"}. Read docs/CONCEPT-AGENT.md first.' } };
  let endpoint = options.url;
  if (options.config) {
    const config = await jsonFile(options.config, stdin);
    if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(key => key !== 'url') || typeof config.url !== 'string') throw new Error('Config must contain only a url string.');
    endpoint = config.url;
  }
  const base = localUrl(endpoint);
  // Writes name their author; reads do not need one. --actor wins over AR_CREATE_ACTOR.
  const actor = options.actor ?? process.env.AR_CREATE_ACTOR;
  if (actor !== undefined && !validActor(actor)) throw new Error('--actor must be one of human:adrian, agent:claude-code, agent:codex, agent:claude-design, agent:hermes, agent:grok, agent:chatgpt, cron:<name>, import:<source>, release:<sha>.');
  if (!options.input && !['list', 'status'].includes(options.command)) throw new Error('This command requires --input FILE or --input -.');
  const input = validateInput(options.command, options.input ? await jsonFile(options.input, stdin) : {});
  const paths = { list: '/api/concepts', create: '/api/concepts', read: '/api/concept', save: '/api/concept/save', 'library-search': '/api/concept/sources/search', 'library-read': '/api/concept/source', status: '/api/concept/capabilities' };
  const post = ['create', 'save', 'library-search'].includes(options.command);
  const url = new URL(paths[options.command], base);
  if (!post) for (const [key, value] of Object.entries(input)) url.searchParams.set(key, value);
  const response = await fetchImpl(url, { method: post ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(actor ? actorHeaders(actor, 'cli') : {}), ...(post ? { 'Content-Type': 'application/json' } : {}) }, ...(post ? { body: JSON.stringify(input) } : {}), redirect: 'error', signal: AbortSignal.timeout(15000) });
  let result;
  try { result = await response.json(); } catch { throw new Error(`Server returned non-JSON response (${response.status}).`); }
  return response.ok ? { exitCode: 0, result } : { exitCode: response.status === 409 ? 3 : 1, result: { ok: false, status: response.status, error: response.status === 409 ? 'revision_conflict' : 'request_failed', details: result } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const { result, exitCode } = await run(process.argv.slice(2)); process.stdout.write(`${JSON.stringify(result)}\n`); process.exitCode = exitCode; }
  catch (error) { process.stdout.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = 1; }
}
