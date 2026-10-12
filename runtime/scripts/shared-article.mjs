#!/usr/bin/env node
// Local article wording adapter only. Preparing context is not authorization to
// transmit sources or personal thoughts to a provider. Human review stays in app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite, regular } from '../services/files.mjs';

const schema = 'ar-create.shared-article-config.v1';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maxRaw = 1024 * 1024;
export const help = `ar-create shared article — local preparation and proposals for one bound piece

node scripts/shared-article.mjs bind --server http://127.0.0.1:8771 --project-id UUID --document-id UUID --config /absolute/path/article.json
node scripts/shared-article.mjs read --config /absolute/path/article.json
node scripts/shared-article.mjs prepare --config /absolute/path/article.json [--source-ids UUID,UUID] [--include-thoughts true|false]
node scripts/shared-article.mjs propose --config /absolute/path/article.json --request-id UUID --file /absolute/path/proposal.md
node scripts/shared-article.mjs review --config /absolute/path/article.json --request-id UUID

Bind exclusively creates a config for the explicit local app and piece. Every command checks that piece is still open.
Prepare captures context and baseline files; it executes no model. Propose stages complete article Markdown for review.
Review and accept the wording in the app. There is no acceptance or publishing command.
`;
const required = { bind: ['server','project-id','document-id','config'], read: ['config'], prepare: ['config'], propose: ['config','request-id','file'], review: ['config','request-id'] };
const optional = { bind: [], read: [], prepare: ['source-ids','include-thoughts'], propose: [], review: [] };
function fail(message, status, details) { const error = new Error(message); if (status) error.status = status; if (details !== undefined) error.details = details; throw error; }
function identifier(value, label) { if (typeof value !== 'string' || !uuid.test(value)) fail(`${label} must be a lowercase UUID.`); return value; }
function absolute(value, label) { if (typeof value !== 'string' || !path.isAbsolute(value) || /[\x00-\x1f\x7f]/.test(value)) fail(`${label} must be an explicit absolute path.`); return value; }
export function localUrl(value) {
  let url; try { url = new URL(value); } catch { fail('Server must be an explicit HTTP localhost URL.'); }
  // Exact origin only: reject URL normalization tricks, credentials and redirects.
  if (typeof value !== 'string' || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(value) || url.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('Server must be an explicit HTTP localhost or 127.0.0.1 origin.');
  return url.origin;
}
function parse(args) {
  if (args.length === 1 && ['--help','-h','help'].includes(args[0])) return { help: true };
  const [command, ...rest] = args;
  if (!Object.hasOwn(required, command)) fail('Choose bind, read, prepare, propose or review. Use --help.');
  if (rest.length === 1 && rest[0] === '--help') return { help: true };
  const flags = {}, allowed = new Set([...required[command], ...optional[command]]);
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].startsWith('--') ? rest[i].slice(2) : '';
    if (!allowed.has(key) || Object.hasOwn(flags, key)) fail(`Unknown or repeated flag: ${rest[i]}`);
    const value = rest[i + 1];
    if (typeof value !== 'string' || !value.trim() || value.startsWith('--')) fail(`Missing value for --${key}.`);
    flags[key] = value;
  }
  for (const key of required[command]) if (!Object.hasOwn(flags, key)) fail(`Missing required --${key}.`);
  absolute(flags.config, '--config');
  if (flags['request-id']) identifier(flags['request-id'], '--request-id');
  if (flags.file) { absolute(flags.file, '--file'); if (path.extname(flags.file).toLowerCase() !== '.md') fail('--file must be a Markdown .md file.'); }
  if (flags['include-thoughts'] !== undefined && !['true','false'].includes(flags['include-thoughts'])) fail('--include-thoughts must explicitly be true or false.');
  if (flags['source-ids'] !== undefined) flags.sourceIds = flags['source-ids'].split(',').map(value => identifier(value, '--source-ids entry'));
  return { command, flags };
}
function configFile(file) {
  if (regular(file).size > 16 * 1024) fail('Config exceeds 16 KB.');
  let config; try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail('Invalid trusted config JSON. Bind a new config.'); }
  if (!config || config.schema !== schema || Object.keys(config).some(key => !['schema','url','projectId','documentId'].includes(key))) fail('Invalid trusted config. Bind a new explicit config.');
  config.url = localUrl(config.url);
  identifier(config.projectId, 'Config projectId'); identifier(config.documentId, 'Config documentId');
  return config;
}
function inputFile(file) {
  if (regular(file).size > maxRaw) fail('Article Markdown exceeds 1 MB.');
  const bytes = fs.readFileSync(file); if (bytes.length > maxRaw) fail('Article Markdown exceeds 1 MB.');
  const raw = bytes.toString('utf8');
  if (!Buffer.from(raw,'utf8').equals(bytes)) fail('Article Markdown must be valid UTF-8.');
  if (!raw.trim()) fail('Provide complete nonempty article Markdown.');
  return raw;
}
async function request(fetcher, config, endpoint, body) {
  const response = await fetcher(`${config.url}${endpoint}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  let result; try { result = await response.json(); } catch { fail('Local app returned invalid JSON.', response.status); }
  if (!response.ok) fail(typeof result?.error === 'string' ? result.error : typeof result?.message === 'string' ? result.message : 'Local app request failed.', response.status, result);
  return result;
}
function verifyCurrent(current, config) {
  if (current?.project?.id !== config.projectId || current?.document?.id !== config.documentId || current?.expected?.projectId !== config.projectId || current?.expected?.documentId !== config.documentId) fail('The open piece differs from this binding. Open the bound piece or create a new explicit binding.', 409);
  return current;
}
function verifyIdentity(result, config, requestId, review = false) {
  const record = review ? result?.proposal : result;
  if (record?.projectId !== config.projectId || record?.documentId !== config.documentId || (requestId && (review ? record.requestId : record.requestId ?? record.id) !== requestId)) fail('Local app response belongs to a different piece or request.', 409);
  if (review && (result?.document?.id !== config.documentId || result?.expected?.projectId !== config.projectId || result?.expected?.documentId !== config.documentId)) fail('Review response belongs to a different piece.', 409);
  return result;
}
export async function run(args, { fetcher = globalThis.fetch } = {}) {
  const parsed = parse(args); if (parsed.help) return { help };
  const { command, flags } = parsed;
  if (command === 'bind') {
    const config = { schema, url: localUrl(flags.server), projectId: identifier(flags['project-id'], '--project-id'), documentId: identifier(flags['document-id'], '--document-id') };
    if (fs.lstatSync(flags.config, { throwIfNoEntry: false })) fail('Config already exists. Choose a new explicit config; no file overwritten.', 409);
    const parent = fs.lstatSync(path.dirname(flags.config)); if (!parent.isDirectory() || parent.isSymbolicLink()) fail('Config parent must be an existing real directory.');
    verifyCurrent(await request(fetcher, config, '/api/shared-articles/current'), config);
    atomicWrite(flags.config, JSON.stringify(config, null, 2) + '\n', { exclusive: true });
    return { config: flags.config, ...config };
  }
  const config = configFile(flags.config);
  const current = verifyCurrent(await request(fetcher, config, '/api/shared-articles/current'), config);
  if (command === 'read') return current;
  if (command === 'prepare') {
    const result = verifyIdentity(await request(fetcher, config, '/api/shared-articles/prepare', { projectId: config.projectId, documentId: config.documentId, ...(flags.sourceIds ? { sourceIds: flags.sourceIds } : {}), ...(flags['include-thoughts'] !== undefined ? { includeThoughts: flags['include-thoughts'] === 'true' } : {}) }), config);
    identifier(result.id, 'Prepared request id'); if (result.modelExecuted !== false) fail('Preparation must not execute a model.');
    return result;
  }
  if (command === 'propose') return verifyIdentity(await request(fetcher, config, '/api/shared-articles/propose', { requestId: flags['request-id'], raw: inputFile(flags.file) }), config, flags['request-id']);
  return verifyIdentity(await request(fetcher, config, `/api/shared-articles/requests/${flags['request-id']}`), config, flags['request-id'], true);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then(result => process.stdout.write(result.help ?? JSON.stringify(result,null,2) + '\n')).catch(error => {
    process.stderr.write(JSON.stringify({ error: error.message, ...(error.status ? { status: error.status } : {}), ...(error.details !== undefined ? { details: error.details } : {}) }) + '\n');
    process.exitCode = 1;
  });
}
