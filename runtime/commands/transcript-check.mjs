// The transcript check's commands for the one registry (runtime/commands.mjs). The app, the CLI and MCP all reach it
// through these routes.
//   Anyone may read a recording's check and ask the model to read the transcript for problems (a proposal).
//   Only Adrian decides, and the service also requires the app's own page: a decision can change transcript text.
export const TRANSCRIPT_CHECK_COMMANDS = Object.freeze([
  ['GET', '/api/transcript-check/{id}'],
  ['POST', '/api/transcript-check/{id}/suggest'],
  ['POST', '/api/transcript-check/{id}/decide'],
  ['POST', '/api/transcript-check/{id}/decide-group'],
  ['POST', '/api/transcript-check/{id}/undo'],
  ['POST', '/api/transcript-check/{id}/remember'],
  ['POST', '/api/transcript-check/{id}/edit'],
  ['POST', '/api/transcript-check/{id}/undo-edit'],
]);
/** Decisions only Adrian makes. */
export const TRANSCRIPT_CHECK_HUMAN_ONLY = Object.freeze(['POST /api/transcript-check/{id}/decide', 'POST /api/transcript-check/{id}/decide-group', 'POST /api/transcript-check/{id}/undo', 'POST /api/transcript-check/{id}/remember', 'POST /api/transcript-check/{id}/edit', 'POST /api/transcript-check/{id}/undo-edit']);
/** Body fields agents most need, shown in /api/capabilities. */
export const TRANSCRIPT_CHECK_BODY = Object.freeze({
  '/api/transcript-check/{id}/suggest': ['again? (read the transcript again)'],
  '/api/transcript-check/{id}/decide': ['problemId', 'action (use|keep|leave)', 'fixes? ([{index, text}] Adrian\'s own words)', 'expected (from the check)'],
  '/api/transcript-check/{id}/decide-group': ['tier (sure|notyou)', 'expected (from the check)'],
  '/api/transcript-check/{id}/undo': ['problemId', 'expected (from the check)'],
  '/api/transcript-check/{id}/edit': ['indexes (lines in a row)', 'text (the passage as Adrian typed it)', 'expected (from the check)'],
  '/api/transcript-check/{id}/undo-edit': ['editId', 'expected (from the check)'],
  '/api/transcript-check/{id}/remember': ['problemId', 'spelling (a name this fix corrected)', 'category? (person|place|tea-term|gene-key|hexagram|other)'],
});
