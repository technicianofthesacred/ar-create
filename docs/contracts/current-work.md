# Pick up current work across clients

W4 requirements: C01/C02/C03/C04/C06 and S03–S07. Finish criterion: a second client reads the same exact words, choices, origins and held work; permitted capture reaches the maintained owner once. This is a source-candidate contract, not installed-service or live-provider proof. The broader approval result is **CONTEXT_VERIFIED / DECISION_PARITY_PENDING**. See [conversation authority](conversation-authority.md) for the full existing per-action policy and proposed authenticated-review mechanism.

## Entrances

All calls use the existing local host/Origin restrictions and honest agent attribution. Send `X-AR-Actor: agent:claude-code` (or your actual supported agent), `X-AR-Client: cli|mcp|http` and `Content-Type: application/json`. Header values identify the caller; they do not authenticate a person. Read-only calls do not need human authority.

| Command | HTTP | Dedicated MCP tool | Effect |
| --- | --- | --- | --- |
| `current-work.contract` | GET `/api/current-work/contract` | `ar_create_call` | JSON Schema inputs, versions, effects and retry contract |
| `current-work.read` | POST `/api/current-work/read` | `ar_create_current_work` | Rebuild disposable context from existing owners |
| `current-work.validate` | POST `/api/current-work/validate` | `ar_create_validate_work` | Preserve prepared text; compare current context |
| `conversation.capture` | POST `/api/conversation/capture` | `ar_create_capture_contribution` | Exact selected contribution through one permitted owner |

All four are also available through `ar_create_call` and `node agents/cli/ar-create.mjs --url LOCAL_URL --actor agent:codex call COMMAND --input -` (omit `--input` for the contract). Capability records publish `inputSchema`; the contract declares JSON Schema 2020-12. Schema source: [current-work.mjs](../../runtime/contracts/current-work.mjs). Server validation remains authoritative, including conditional selectors and action limits.

## Read one exact project or piece

```json
{"selector":{"parentStudyId":"invented-kettle"}}
```

For a piece, also supply both `rootBindingId` and `outputId`, copied from the maintained output catalog. A root or title alone never chooses a piece. The exact output must belong uniquely to that project/root. Current native and carousel word owners remain independent. A legacy subject without a readable concept/collection root is unavailable through this bounded entrance; use its existing owner commands rather than inventing a project mapping.

The response is `ar-create.current-work.v1`:

| Field | Meaning and limit |
| --- | --- |
| `selector`, `fingerprint`, `readConsistency` | Exact request and SHA-256 of the returned owner projection. Two equal consecutive reads yield `stable-reread`; three changing reads yield `changed-during-read`. This is no transaction lock or permission to save. |
| `intent` | Exact concept body/revision/hash; personal thoughts, adopted direction, provisional AI interpretation and unadopted suggestions remain distinct. Manual Markdown stays manual. |
| `decisions` | Saved angle/title choices, events, rejected choices/reasons and effective target projection. For a native piece: contract hash, exact protections, rejected prose proposals and piece guidance, including their recorded attribution. Test stand-in decisions remain labelled stand-in. |
| `contributions` | Selected origin receipts and exact existing board blocks. `boardContext` includes subject/title, revision/hash, links and the complete saved `forming` intention/choices; all participate in freshness validation. `completeConversation:false` always; no unseen upstream conversation is claimed. |
| `sources` | Exact selected passages, source freshness, recorded collection membership and index revision/hash. Source text comes from no-refresh owner snapshots, bounded to 40 sources and 32,768 characters per text; omitted/truncated/unavailable material is explicit. Images remain references, not new copies. |
| `understanding`, `piece` | Existing current-understanding projection, scoped project/part/output records, connected learning, current own wording, expected owner guards and conflict/coverage information. Linked learning is background, not silently adopted direction. |
| `pending` | Native proposal records, scoped Needs you asks, unscoped-question count, active/recoverable Simmer operations and continuity assignments. A question is not repeated merely because the new client lacks its own chat history. Unscoped questions are not assigned to this project. |
| `presence` | Observed project/output/native editor entries and dirty state. Expired or absent presence does not prove every client is clean. |
| `continuity`, `gaps` | Existing owner work state and explicit missing/unavailable reads. No new task authority or editable summary. |
| `nextPermittedActions`, `authority` | Contextual guidance only. Owner guards, task authorization, source review and human decision requirements still apply. `mayApply:false`; native acceptance/Finish is unavailable through capture. |

No packet is saved as an editable master. Reading uses snapshots; it does not refresh the Library, select defaults or write prose. Owner-backed reads can maintain their existing local cache bookkeeping. A packet fingerprint changes on relevant saved owner/capture/presence state, including rejected choices. Missing context must be handled, not inferred away.

To validate prepared work, send `{selector, expectedFingerprint, preparedText}`. The response is `ar-create.current-work-validation.v1`, always `mayApply:false`. `current-target-guards-required` means unchanged context still needs the owner's exact write guards. `held-context-changed` returns the original `preparedText` unchanged beside current app context. Do not automatically rewrite or apply it. Existing proposal acceptance continues to use the native owner's own context guards.

## Capture exact selected human words

```js
// client is the maintained agents/lib/client.mjs createClient result.
// This example uses invented words; actual use requires the current task's instruction.
const before = await client.call('concept', {parentStudyId});
const input = {
  operationId: crypto.randomUUID(),
  origin: {
    provider: 'invented-provider', client: 'claude-code',
    conversationId: 'invented-chat', messageId: 'invented-message',
    historyCoverage: 'selected-only'
  },
  action: 'append-thought', target: {parentStudyId},
  contribution: {role: 'human', text: '  Keep the crack.\nThese are exact words.  '},
  expected: {revision: before.body.revision, hash: before.body.hash}
};
const receipt = await client.call('conversation.capture', input);
// Inspect receipt.ok, receipt.status and receipt.body; persist input for recovery.
```

`origin` requires provider/client and `historyCoverage:'selected-only'|'upstream-unavailable'`. Supply both conversation/message references when available, otherwise generate one stable `captureId` UUID and keep it for all retries/handoffs. Optional `saidAt` is ISO UTC. These are caller-reported provenance, not verified access to upstream chat. Never manufacture a message reference or call selected excerpts complete history.

| Action | Exact target | Expected guard | Existing effect |
| --- | --- | --- | --- |
| `append-thought` | `{parentStudyId}` | Concept revision/hash | Append exact text to structured personal thoughts; preserve old words, adopted direction and other fields. Manual Markdown refuses instead of being rewritten. |
| `gather-words` | `{parentStudyId}` | Simmer board revision/hash | Recoverable W3 intake retains one exact note, Library membership and board block. |
| `name-direction` | `{parentStudyId}` | Simmer board revision/hash | W3 dictated naming retains the sentence and attempts its existing guarded Direction adoption. A competing adopted direction stays held. |
| `choose-story` | `{parentStudyId,planId,storyId}` | Exact Instagram plan revision/hash | Existing quoted relay chooses that exact proposed story. Quote is at most 1,200 characters; no prose acceptance, format readiness or publication is implied. |

Other excerpts are bounded to 8,000 characters, and existing owner limits may be narrower. No trimming or paraphrasing occurs. `role:'assistant'`, human-header substitution, unknown actions, fabricated scope, stale guards and unapproved native decisions refuse. Content claiming to be a human quote remains an unverified carrier report; this API cannot authenticate a dishonest quote.

The acknowledgement is `ar-create.conversation-capture.v1`: origin, original carrier, exact contribution/action/target, original expected guard, receipt ID, delivery IDs, deterministic owner operation UUID, status and owner artifact/revision/hash links. `captured` confirms the bounded owner action; `captured-effect-held` means named words were retained but Direction adoption was held, with its exact reason. `held` includes recovery instructions and the owner receipt if available. None signifies manuscript approval or publishing.

## Duplicate delivery and recovery

The deduplication identity is origin provider + conversation/message (or stable fallback capture ID), **action + full target**. One message can carry different explicit actions. Exact words and the original expected revision/hash are immutable. Duplicate deliveries with new delivery UUIDs acknowledge the first capture without changing its carrier or owner revision. Reusing a delivery UUID on another origin/action/target refuses. Changed words or original guards require review; they cannot mutate the receipt.

The pending receipt is durable before invoking the owner. After a crash between owner commit and acknowledgement, retry the same original input. The deterministic owner UUID replays the existing owner receipt; equality of words alone is never completion proof. An interrupted action resumes only as its original carrier.

For a held `gather-words` or `name-direction`:

1. Read current work and the owner operation shown under `pending.operations` / `simmer.material`; inspect exactly what was saved and what is held.
2. If the board changed, read `simmer.board`. After deliberately reconciling the competing edit, retry the original capture input with optional `resume:{revision,hash}` from that board. Original words, target, expected and operation UUID remain unchanged.
3. W3 reuses its operation and original payload with the explicit resume pin. If the owner had not yet begun when the race occurred, capture records the explicit guard refresh before starting that same owner UUID. The first guard remains in `originalExpected`; the pre-start refresh is in `resumptions`.
4. Read the acknowledgement and current owner state. A Direction effect held by an existing different direction does not auto-replace it; use the existing human review flow. A failed freshness check is never a force option.

The preserved owner operation can also be recovered through the existing W3 route using its exact original input; then retry the original capture to acknowledge it. Capture receipts are recovery/audit links, not editable prose authorities. Current API limits do not import photographs or entire conversations; use W3's existing explicit intake for photos.

## Needs you and remaining decision gate

Needs you keeps one queue. Every projection exposes `execution:{status:'unverified',complete:false,operationId:null,...}` because this queue currently has no authoritative domain-completion link. A timed default is a selected choice, not evidence that the proposed work ran. The native card says **Default chosen** and **The work result is not yet verified**. Explicit answers likewise do not independently prove domain completion; inspect the responsible owner. Only-Adrian questions never default.

Remote native accept/reject, opening acceptance, exact-word protection/release, arbitrary adopted direction changes and Finish have no new authenticated approval entrance. Existing registered synthetic stand-in exceptions remain limited to their exact copies. W0 must separately adopt which actions, if any, the proposed scoped review mechanism may authorize. Quotes, timestamps, provider/client names and a self-declared human header cannot unlock them. W5/W6/W7 can use this verified context/capture subset now.

## Verification and rollback

Focused tests: `tests/current-work.test.mjs`, `tests/conversation-recovery.test.mjs`, `tests/current-work-snapshot.test.mjs`; native screen journey: `tests/current-work.browser.mjs` with `AR_CREATE_PLAYWRIGHT` and optional `AR_CREATE_CONTEXT_SHOTS`. These use invented sources, actual local owner files, HTTP, CLI and the MCP adapter. The snapshot checks exercise saved board intention/link changes and selected, changed, missing and unscanned Library files without starting a server. They do not execute an external model or prove remote provider authentication.

Rollback the W4 commit before activation; existing owners and prior manuscript/Undo histories remain their authorities. After use, preserve the private `conversation-captures` records and existing owner receipts for audit/recovery. Do not delete them to retry a decision, reassign a capture ID, or replay delivery against an older unguarded route.
