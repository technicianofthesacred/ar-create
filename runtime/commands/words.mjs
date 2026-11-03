// The shared word library's commands for the one registry (runtime/commands.mjs). The app, the CLI and MCP all reach it
// through these routes.
//   Agents read the library, suggest words (marked as theirs), trigger the recognise step and read what it found.
//   Only Adrian confirms a suggestion or answers a doubtful word, and the answer service also requires the app's own page.
export const WORDS_COMMANDS = Object.freeze([
  ['GET', '/api/words', ['q?', 'category? (person|place|tea-term|gene-key|hexagram|other)', 'status? (confirmed|proposed|all)', 'limit?']],
  ['GET', '/api/words/export'],
  ['GET', '/api/words/checks', ['all?']],
  ['GET', '/api/words/check', ['jobId']],
  ['POST', '/api/words/add'],
  ['POST', '/api/words/import'],
  ['POST', '/api/words/decide'],
  ['POST', '/api/words/recognise'],
  ['POST', '/api/words/answer'],
]);
/** Decisions only Adrian makes. */
export const WORDS_HUMAN_ONLY = Object.freeze(['POST /api/words/decide', 'POST /api/words/answer']);
/** Body fields agents most need, shown in /api/capabilities. */
export const WORDS_BODY = Object.freeze({
  '/api/words/add': ['operationId', 'spelling (<=120)', 'category? (person|place|tea-term|gene-key|hexagram|other)', 'variants? (<=40; text or {text, kind: heard|alias})', 'languages?', 'zh?', 'pinyin?', 'note? (<=300)', 'sets?', 'core?', 'source?:{kind,ref}'],
  '/api/words/import': ['operationId', 'source (tea-terms|oracle-cards)', 'path? (absolute .json; default is the standard file)'],
  '/api/words/decide': ['operationId', 'id', 'decision (confirm|reject)'],
  '/api/words/recognise': ['jobId (a recording with a finished transcript)', 'force? (run again)'],
  '/api/words/answer': ['operationId', 'jobId', 'key (from words.check)', 'choice (keep|right|suggestion|spelling)', 'spelling? (with choice spelling)', 'category?'],
});
