// Shared by memo-prepare and memo-finish: the phone memo on mandalacodes (pickup key) and this AR Create (an agent
// carrying Adrian's chat). Keys come from the environment and are never printed.
import crypto from 'node:crypto';

export const SITE = (process.env.MEMO_SITE_URL || 'https://mandalacodes.com').replace(/\/$/, '');
export const ARC = (process.env.AR_CREATE_URL || 'http://127.0.0.1:8855').replace(/\/$/, '');
const ACTOR = process.env.AR_CREATE_ACTOR || 'agent:claude-code';
export const op = () => crypto.randomUUID();

export function pickupKey() {
  const key = process.env.AR_PICKUP_TOKEN?.trim();
  if (!key) throw new Error('AR_PICKUP_TOKEN is not set (on the VPS: set -a; . /etc/ar-create-feeder.env; set +a).');
  return key;
}
/** The memo pickup on the phone site. `raw` returns the Response (for files). */
export async function site(path, {method = 'GET', body, type, raw = false} = {}) {
  const headers = {Authorization: `Bearer ${pickupKey()}`};
  if (type) headers['Content-Type'] = type; else if (body !== undefined && !(body instanceof Uint8Array)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${SITE}/api/oracle/pickup/${path}`, {method, headers, body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body)});
  if (raw) return response;
  const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!response.ok) throw new Error(`phone site ${method} ${path}: HTTP ${response.status} ${typeof json === 'object' ? json.error || '' : String(json).slice(0, 120)}`);
  return json;
}
/** AR Create's HTTP API as the agent. */
export async function arc(method, path, body) {
  const response = await fetch(ARC + path, {method, headers: {'X-AR-Actor': ACTOR, 'X-AR-Client': 'cli', ...(body ? {'Content-Type': 'application/json'} : {})}, body: body ? JSON.stringify(body) : undefined});
  const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!response.ok) throw new Error(`AR Create ${method} ${path}: HTTP ${response.status} ${typeof json === 'object' ? json.error || '' : String(json).slice(0, 160)}`);
  return json;
}
export const guard = p => ({id: p.id, operationId: op(), expectedRevision: p.revision, expectedHash: p.hash});
export const fail = message => { console.error(message); process.exit(1); };
