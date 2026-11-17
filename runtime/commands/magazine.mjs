// The magazine's commands for the one registry (runtime/commands.mjs): the app, the CLI
// (agents/cli/ar-create.mjs call magazine.*), MCP and the 8766 page all reach the magazine through
// these routes, so every write is stamped with its actor, journalled and announced as an event.
// Human-only decisions are listed in MAGAZINE_HUMAN_ONLY; the service checks them again.
import {StateError} from '../store.mjs';

/** Decisions only Adrian makes. Agents may propose; these say yes. */
export const MAGAZINE_HUMAN_ONLY = Object.freeze([
  'POST /api/magazine/ask/answer', 'POST /api/magazine/edit', 'POST /api/magazine/lineup/save', 'POST /api/magazine/approve',
  'POST /api/magazine/export/save', 'POST /api/magazine/album/link', 'POST /api/magazine/lock/recover', 'POST /api/magazine/status/install',
  'POST /api/magazine/proposal/accept', 'POST /api/magazine/proposal/reject', 'POST /api/magazine/tidy/apply', 'POST /api/magazine/send',
  'POST /api/magazine/reconcile/choose', 'POST /api/magazine/mark-published',
]);
/** POST routes that only read (no actor needed, not journalled). */
export const MAGAZINE_READ_ONLY_POSTS = Object.freeze(['/api/magazine/send-check', '/api/magazine/check']);
/** Body fields agents most need, shown in /api/capabilities. */
export const MAGAZINE_BODY = Object.freeze({
  '/api/magazine/write': ['path', 'content', 'expectedHash (sha256 you read, or null for a new file)', 'operationId', 'reason?'],
  '/api/magazine/ask/set': ['path (Workflow/ASK - <story>.md)', 'content', 'expectedHash', 'operationId'],
  '/api/magazine/ask/answer': ['path', 'index', 'value', 'title?', 'operationId', 'storyId?', 'pieceId?', 'expectedHash?'],
  '/api/magazine/edit': ['path', 'block', 'seen (paragraph hash)', 'text', 'operationId'],
  '/api/magazine/requests/add': ['story', 'kind? (Carousel|Post|Reel|Video script)', 'step? (Redo step)', 'operationId'],
  '/api/magazine/page-feedback/add': ['story', 'step', 'q', 'value (yes|no)', 'note?', 'operationId'],
  '/api/magazine/lineup/save': ['path', 'slides', 'caption', 'expectedHash', 'operationId'],
  '/api/magazine/approve': ['path', 'value (yes|words|what should change)', 'expectedHash', 'operationId'],
  '/api/magazine/export/save': ['path', 'staged', 'files:[{name,sha256}]', 'caption?', 'operationId'],
  '/api/magazine/album/link': ['story', 'link', 'operationId'],
  '/api/magazine/drops/claim': ['name', 'folder (0 = Files Drop, 1 = phone drop)', 'story', 'operationId'],
  '/api/magazine/intake/file': ['claimId', 'operationId'],
  '/api/magazine/lock/hold': ['doing?', 'ttlMs?'], '/api/magazine/lock/release': [], '/api/magazine/lock/recover': ['expectedHash (of the lock file)'],
  '/api/magazine/status/refresh': ['operationId'], '/api/magazine/status/install': ['expectedHash (of STATUS.md)', 'operationId'],
  '/api/magazine/issue/write': ['path (Issues/…)', 'content', 'expectedHash', 'operationId'],
  '/api/magazine/proposal/accept': ['proposalId', 'operationId'], '/api/magazine/proposal/reject': ['proposalId', 'reason?', 'operationId'],
  '/api/magazine/undo': ['undoOperationId', 'operationId'],
  '/api/magazine/tidy/apply': ['operationId'],
  '/api/magazine/send-check': ['path (the DEV)', 'piece'], '/api/magazine/send': ['path', 'piece', 'expectedHash', 'operationId'],
  '/api/magazine/mark-published': ['path', 'link', 'expectedHash', 'operationId'],
  '/api/magazine/check': ['draft (DEV path)', 'source? (SRC path)', 'context?'],
  '/api/magazine/reconcile/choose': ['bindingId', 'choice (vault|copy)', 'expectedVaultHash', 'expectedCopyHash', 'operationId'],
});

/**
 * Routes for the registry's route map. `vault` is the magazine-vault service; `extra` adds the
 * intake (M5), checks (M6) and reconcile (D7) services when they are configured.
 */
export function createMagazineRoutes(vault, extra = {}) {
  // The story a write touched becomes its event/journal scope (afterRequest reads input.scope).
  const write = fn => async input => {
    const {scope, ...clean} = input;
    const out = await fn(clean);
    if (out?.scope && out.scope.kind === 'story') input.scope = out.scope;
    return out;
  };
  const need = (service, label) => { if (!service) throw new StateError(label + ' is not configured in this AR Create.', 503); return service; };
  return ({url}) => ({
    '/api/magazine/board': {GET: () => vault.board()},
    '/api/magazine/read': {GET: () => vault.read({path: url.searchParams.get('path')})},
    '/api/magazine/stories': {GET: () => vault.projects.list()},
    '/api/magazine/story': {GET: () => vault.story({id: url.searchParams.get('id')})},
    '/api/magazine/article-questions': {GET: () => vault.articleQuestions({storyId: url.searchParams.get('storyId'), pieceId: url.searchParams.get('pieceId')})},
    '/api/magazine/write': {POST: write(input => vault.write(input))},
    '/api/magazine/ask/set': {POST: write(input => vault.askSet(input))},
    '/api/magazine/ask/answer': {POST: write(input => vault.askAnswer(input))},
    '/api/magazine/edit': {POST: write(input => vault.edit(input))},
    '/api/magazine/requests/add': {POST: write(input => vault.requestsAdd(input))},
    '/api/magazine/page-feedback/add': {POST: write(input => vault.pageFeedback(input))},
    '/api/magazine/lineup/save': {POST: write(input => vault.lineupSave(input))},
    '/api/magazine/approve': {POST: write(input => vault.approve(input))},
    '/api/magazine/export/save': {POST: write(input => vault.exportSave(input))},
    '/api/magazine/album/link': {POST: write(input => vault.albumLink(input))},
    '/api/magazine/drops': {GET: () => vault.drops()},
    '/api/magazine/drops/claim': {POST: write(input => need(extra.intake, 'Magazine intake').claim(input))},
    '/api/magazine/intake': {GET: () => need(extra.intake, 'Magazine intake').read({claimId: url.searchParams.get('claimId')})},
    '/api/magazine/intake/file': {POST: write(input => need(extra.intake, 'Magazine intake').file(input))},
    '/api/magazine/lock/status': {GET: () => vault.lockStatus()},
    '/api/magazine/lock/hold': {POST: input => vault.lockHold(input)},
    '/api/magazine/lock/release': {POST: () => vault.lockRelease()},
    '/api/magazine/lock/recover': {POST: input => vault.lockRecover(input)},
    '/api/magazine/status/table': {GET: () => vault.statusTable()},
    '/api/magazine/status/refresh': {POST: write(input => vault.statusRefresh(input))},
    '/api/magazine/status/install': {POST: write(input => vault.statusInstall(input))},
    '/api/magazine/issue/write': {POST: write(input => vault.issueWrite(input))},
    '/api/magazine/proposals': {GET: () => vault.proposalList({status: url.searchParams.get('status') || 'open', story: url.searchParams.get('story') || undefined})},
    '/api/magazine/proposal': {GET: () => vault.proposalRead({proposalId: url.searchParams.get('proposalId')})},
    '/api/magazine/proposal/accept': {POST: write(input => vault.proposalAccept(input))},
    '/api/magazine/proposal/reject': {POST: write(input => vault.proposalReject(input))},
    '/api/magazine/undo': {POST: write(input => vault.undo(input))},
    '/api/magazine/operation': {GET: () => vault.operation({operationId: url.searchParams.get('operationId')})},
    '/api/magazine/tidy': {GET: () => vault.tidy({})},
    '/api/magazine/tidy/apply': {POST: write(input => vault.tidy({...input, apply: true}))},
    '/api/magazine/send-check': {POST: input => vault.sendCheck(input)},
    '/api/magazine/send': {POST: write(input => vault.send(input))},
    '/api/magazine/send/approval': {GET: () => vault.sendApproval({path: url.searchParams.get('path')})},
    '/api/magazine/mark-published': {POST: write(input => vault.markPublished(input))},
    '/api/magazine/check': {POST: input => need(extra.checks, 'Magazine checks').run(input)},
    '/api/magazine/reconcile': {GET: () => need(extra.reconcile, 'Working-copy reconcile').list()},
    '/api/magazine/reconcile/compare': {GET: () => need(extra.reconcile, 'Working-copy reconcile').compare({bindingId: url.searchParams.get('bindingId')})},
    '/api/magazine/reconcile/choose': {POST: write(input => need(extra.reconcile, 'Working-copy reconcile').choose(input))},
    '/api/brand/read': {GET: () => vault.brandRead({id: url.searchParams.get('id')})},
  });
}
