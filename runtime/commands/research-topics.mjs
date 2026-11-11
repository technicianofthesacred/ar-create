// Research topics and groups (runtime/services/research-topics.mjs): a thin layer over the inquiries, findings and answers
// the app already keeps. Assistants read, file and propose; keeping a proposal, letting a topic go, taking that back,
// starting a topic of his own and his one line are Adrian's alone. The app, the CLI (`research ...`) and MCP
// (ar_create_call) reach the same records through these.
export const RESEARCH_TOPICS_COMMANDS = Object.freeze([
  ['GET', '/api/research-topics', ['group? (a group id, or none)', 'saying? (true: has something to say)', 'week? (true: made this week)', 'subject? (parentStudyId)', 'gone? (true: the ones let go)']],
  ['GET', '/api/research-topics/read', ['id']],
  ['GET', '/api/research-topics/subject', ['parentStudyId']],
  ['GET', '/api/research-topics/groups', []],
  ['GET', '/api/research-topics/group', ['id']],
  ['POST', '/api/research-topics/save'], ['POST', '/api/research-topics/propose'], ['POST', '/api/research-topics/link'],
  ['POST', '/api/research-topics/take'], ['POST', '/api/research-topics/let-go'], ['POST', '/api/research-topics/undo'], ['POST', '/api/research-topics/keep'], ['POST', '/api/research-topics/start'],
  ['POST', '/api/research-topics/group/save'], ['POST', '/api/research-topics/group/sources'], ['POST', '/api/research-topics/ask'],
]);
/** His own line, his decisions on proposals and his own new topics. */
export const RESEARCH_TOPICS_HUMAN_ONLY = Object.freeze(['POST /api/research-topics/take', 'POST /api/research-topics/let-go', 'POST /api/research-topics/undo', 'POST /api/research-topics/keep', 'POST /api/research-topics/start']);
/** Asking only reads. */
export const RESEARCH_TOPICS_READ_ONLY = Object.freeze(['POST /api/research-topics/ask']);
export const RESEARCH_TOPICS_UNDO = Object.freeze({ 'POST /api/research-topics/let-go': 'research-topics.undo' });
const TOPIC = ['id (a topic id from the list)', 'operationId', 'expectedRevision (0 for a topic not saved yet)', 'expectedHash (once saved)'];
export const RESEARCH_TOPICS_BODY = Object.freeze({
  '/api/research-topics/save': [...TOPIC, 'name?', 'groupId? (or null)', 'suggestedGroupId? (an assistant suggests; he says yes)', 'state? (new|ready|quiet)', 'note? (one line on why)', 'sourceIds? (Library source ids)', 'answers? (research answer ids)', 'findings?:[{parentStudyId,pointId}]', 'leave? (a waiting thing\'s key, for later)', 'unleave?', 'origin?:{kind,label?,ref?} (only for a topic made on the fly)'],
  '/api/research-topics/propose': ['operationId', 'name', 'origin:{kind: conversation|fact-check|saved|note, label? (e.g. "Mrs. Oda\'s recording, 21:04"), ref?:{kind: source|recording|subject|consent-claim|library-topic|answer|chat|note, id, at?, parentStudyId?}}', 'sourceIds?', 'note?', 'groupId?', 'suggestedGroupId?', 'subjects? (parentStudyIds)', 'answers?', 'findings?'],
  '/api/research-topics/link': [...TOPIC, 'parentStudyId', 'remove? (true)'],
  '/api/research-topics/take': [...TOPIC, 'text (his one line; empty clears it)'],
  '/api/research-topics/let-go': TOPIC,
  '/api/research-topics/undo': [...TOPIC, 'undoOperationId (the let go)'],
  '/api/research-topics/keep': TOPIC,
  '/api/research-topics/start': ['operationId', 'name (what he wants to understand)', 'sourceIds?', 'groupId?', 'subjects?'],
  '/api/research-topics/group/save': ['id? (omit to make one)', 'operationId', 'expectedRevision (0 for a new group)', 'expectedHash (once saved)', 'name?', 'folder? (e.g. ["Research","Mandala"])', 'settings?:{opensTopics: propose|off}'],
  '/api/research-topics/group/sources': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'action (add|remove|tick|untick)', 'sourceIds'],
  '/api/research-topics/ask': ['query (exact words to find)', 'groupId? (omit for everything)', 'limit? (1 to 20)'],
});
