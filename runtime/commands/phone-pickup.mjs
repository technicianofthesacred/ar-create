// The phone pickup's commands for the one registry (runtime/commands.mjs). The app, the CLI and MCP all reach it through
// these routes. Checking is on demand only: there is no timer that asks the phone site.
export const PHONE_PICKUP_COMMANDS = Object.freeze([
  ['GET', '/api/phone-pickup'],
  ['GET', '/api/phone-pickup/setup'],
  ['POST', '/api/phone-pickup/check'],
]);
/** Nothing here is Adrian's alone: the transcript that comes back waits for his say on the phone site if he edited it. */
export const PHONE_PICKUP_HUMAN_ONLY = Object.freeze([]);
export const PHONE_PICKUP_BODY = Object.freeze({
  '/api/phone-pickup/check': ['(no fields) asks the phone site once for recordings that still wait for a better transcript'],
});
