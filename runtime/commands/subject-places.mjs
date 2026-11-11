// Where a subject lives (runtime/services/subject-places.mjs): its folder, tags, pin, archived flag and hand-set order,
// and the list of folders. Ordinary organising, so assistants may call every one of these; the app, the CLI
// (`subject places|place|reorder|folders|folder`) and MCP (ar_create_call) reach the same records through them.
export const SUBJECT_PLACES_COMMANDS = Object.freeze([
  ['GET', '/api/subject-places', ['parentStudyId?']],
  ['POST', '/api/subject-places/save'],
  ['POST', '/api/subject-places/reorder'],
  ['POST', '/api/subject-places/carry'],
  ['GET', '/api/subject-places/folders', []],
  ['POST', '/api/subject-places/folders'],
]);
/** Nothing here is a decision only Adrian makes. */
export const SUBJECT_PLACES_HUMAN_ONLY = Object.freeze([]);
/** Folder changes can be taken back, as Library's folders can. */
export const SUBJECT_PLACES_UNDO = Object.freeze({ 'POST /api/subject-places/folders': 'subject-places.folders.post' });
/** Body fields agents most need, shown in /api/capabilities. */
export const SUBJECT_PLACES_BODY = Object.freeze({
  '/api/subject-places/save': ['parentStudyId', 'operationId', 'expectedRevision (0 when the subject has no saved place)', 'expectedHash (required once saved)', 'folder? (list of plain names, e.g. ["Art","Studio"]; [] for none)', 'tags? (short plain words)', 'pinned? (true|false) or pinnedAt? (ISO time|null)', 'archived? (true|false)', 'order? (number|null, its hand-set position in the folder)', 'deskOrder? (number|null, its hand-set place on the desk; apart from order)'],
  '/api/subject-places/reorder': ['operationId', 'items:[{parentStudyId, expectedRevision, expectedHash?}] (in the new order; each gets order 0, 1, 2, ...)', 'which? (folder, the default, sets order; desk sets deskOrder; neither changes the other)'],
  '/api/subject-places/carry': ['parentStudyId', 'operationId', 'folder?', 'tags?', 'pinnedAt?', 'archived?', 'order? (the browser\'s own filing, carried over once; when a place is already saved the saved one wins and nothing changes)'],
  '/api/subject-places/folders': ['action (create|rename|reorder|remove|undo)', 'operationId', 'expectedRevision', 'expectedHash', 'path? (create, rename, remove: e.g. ["Tea"])', 'name? (rename: the new last name)', 'order? (reorder: every saved folder path, in order)', 'undoOperationId? (undo: the last change)'],
});
