// The "needs you" list's commands for the one registry (runtime/commands.mjs). The app, the CLI and MCP all reach it
// through these routes. Agents raise asks and list them; answering is human-only, and the service further requires
// the app's own page (client ui), so no script can answer for Adrian.
export const NEEDS_YOU_COMMANDS = Object.freeze([
  ['GET', '/api/needs-you', ['status? (pending|open|defaulted|answered|all)', 'id?']],
  ['POST', '/api/needs-you/raise'],
  ['POST', '/api/needs-you/answer'],
]);
/** Decisions only Adrian makes. */
export const NEEDS_YOU_HUMAN_ONLY = Object.freeze(['POST /api/needs-you/answer']);
/** Body fields agents most need, shown in /api/capabilities. */
export const NEEDS_YOU_BODY = Object.freeze({
  '/api/needs-you/raise': ['operationId', 'band (only-adrian|steer)', 'question (<=280)', 'choices? (<=5, <=80 each)', 'about? (<=120, what it concerns)', 'scope?:{kind,id}', 'link?:{label,href} (a human-only step on its own screen; only-adrian)', 'default (steer only, one of choices)', 'applyAt (steer only, ISO time the default applies)'],
  '/api/needs-you/answer': ['operationId', 'id', 'choice (one of the ask\'s choices) or text'],
});
