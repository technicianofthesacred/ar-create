// Where a subject stands (runtime/services/subject-standing.mjs, deciding with runtime/standing-rule.mjs): one subject's
// forms and steps with their states, and every subject's station, ring, next step and forms in one call for Home.
// Read-only, so any actor may call them; the app, the CLI (`standing subject <id>`, `standing all`) and MCP
// (ar_create_call) reach the same reads.
export const STANDING_COMMANDS = Object.freeze([
  ['GET', '/api/subject/standing', ['parentStudyId']],
  ['GET', '/api/subjects/standing', []],
]);
