import { localUrl } from '../../tools/concept-cli.mjs';
import { actorHeaders } from './actors.mjs';

/**
 * The one way agents reach AR Create: by command name, over loopback HTTP,
 * with the actor on every request. The CLI and the MCP server both use it.
 */
export const EXIT = Object.freeze({ ok: 0, failed: 1, usage: 2, conflict: 3, locked: 4, forbidden: 5 });
export function exitCodeFor(status) {
  if (status >= 200 && status < 300) return EXIT.ok;
  return status === 409 ? EXIT.conflict : status === 423 ? EXIT.locked : status === 403 ? EXIT.forbidden : EXIT.failed;
}
const optional = field => field.endsWith('?') ? field.slice(0, -1) : field;

/** Turn {name, input} into an HTTP request for one registry entry. */
export function buildRequest(command, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be a JSON object.');
  const body = structuredClone(input);
  const route = command.route.replace(/\{(\w+)\}/g, (_, key) => {
    if (typeof body[key] !== 'string' || !body[key]) throw new Error(`${command.name} needs "${key}" for its path.`);
    const value = encodeURIComponent(body[key]); delete body[key]; return value;
  });
  const query = new URLSearchParams();
  if (command.method === 'GET' || command.method === 'HEAD') {
    if (command.mode === 'input-json') { if (Object.keys(body).length) query.set('input', JSON.stringify(body)); }
    else for (const [key, value] of Object.entries(body)) for (const item of Array.isArray(value) ? value : [value]) query.append(key, typeof item === 'object' ? JSON.stringify(item) : String(item));
    return { method: command.method, path: route + (query.size ? '?' + query : ''), body: undefined };
  }
  if (command.mode === 'scope' || command.mode === 'scope-copy') {
    for (const key of (command.schema?.query || []).map(optional)) {
      if (body[key] === undefined) continue;
      query.set(key, String(body[key]));
      if (command.mode === 'scope') delete body[key];
    }
  }
  return { method: command.method, path: route + (query.size ? '?' + query : ''), body };
}

export function createClient({ url, actor, client = 'cli', fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const base = localUrl(url), headers = actorHeaders(actor, client);
  let capabilities = null;
  async function request(method, path, body) {
    const response = await fetchImpl(new URL(path, base), { method, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json', ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    let value; try { value = text ? JSON.parse(text) : null; } catch { value = { text }; }
    return { ok: response.ok, status: response.status, body: value };
  }
  async function listCommands({ refresh = false } = {}) {
    if (!capabilities || refresh) {
      const result = await request('GET', '/api/capabilities');
      if (!result.ok || !Array.isArray(result.body?.commands)) throw new Error(`Capabilities unavailable (${result.status}).`);
      capabilities = result.body;
    }
    return capabilities;
  }
  async function find(name) {
    const command = (await listCommands()).commands.find(item => item.name === name);
    if (!command) throw new Error(`Unknown command "${name}". Run list-commands.`);
    return command;
  }
  return {
    base, actor, client, request, listCommands, find,
    /** One attempt only; a mutation is never retried on an uncertain failure. */
    async call(name, input = {}) {
      const command = await find(name), built = buildRequest(command, input);
      return { command: name, ...await request(built.method, built.path, built.body) };
    },
  };
}
