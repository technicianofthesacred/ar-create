/**
 * The actor vocabulary agents send as X-AR-Actor. Mirrors
 * runtime/services/actor.mjs, which is the server-side authority; kept
 * dependency-free so the CLI and MCP load nothing from the server.
 */
export const ACTOR_VALUES = Object.freeze(['human:adrian', 'agent:claude-code', 'agent:codex', 'agent:claude-design', 'agent:hermes', 'agent:grok', 'agent:chatgpt', 'agent:duet', 'cron:<name>', 'import:<source>', 'release:<sha>']);
export const CLIENT_VALUES = Object.freeze(['ui', 'cli', 'mcp', 'http', 'file', 'mag-page']);
const FIXED = new Set(ACTOR_VALUES.filter(value => !value.includes('<')));
export function validActor(value) {
  if (typeof value !== 'string') return false;
  if (FIXED.has(value)) return true;
  return /^(cron|import):[a-z0-9][a-z0-9._-]{0,63}$/.test(value) || /^release:[a-f0-9]{7,40}$/.test(value);
}
export function actorHeaders(actor, client) {
  if (!validActor(actor)) throw new Error(`Actor must be one of ${ACTOR_VALUES.join(', ')}.`);
  if (!CLIENT_VALUES.includes(client)) throw new Error(`Client must be one of ${CLIENT_VALUES.join(', ')}.`);
  return { 'X-AR-Actor': actor, 'X-AR-Client': client };
}
/** Map an MCP client's self-reported name to an actor, when it is recognisable. */
export function actorFromClientInfo(info) {
  const name = String(info?.name || '').toLowerCase();
  if (/codex/.test(name)) return 'agent:codex';
  if (/duet/.test(name)) return 'agent:duet';
  // Claude Code reports claude-code; the Claude desktop app reports claude-ai.
  if (/claude[-_ ]?(code|ai)/.test(name)) return 'agent:claude-code';
  if (/hermes/.test(name)) return 'agent:hermes';
  if (/grok/.test(name)) return 'agent:grok';
  if (/chatgpt|openai/.test(name)) return 'agent:chatgpt';
  return null;
}
