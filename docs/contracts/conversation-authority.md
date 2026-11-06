# Conversation authority

W4 handoff for W5 creation, W6 connections and W7 completion. Requirements: **C01 human creative control; C06 honest AI and evidence**. Source baseline: `915e3a3656ae6fa849913086a7eaedfbc5a2b29b`, inspected 6 November 2026, with the W4 candidate's exact-quote/provenance clarification below. This contract describes existing policy and guard limits; it implements no authentication, expands no decision permission and proves no installed behavior.

Finish criterion: a downstream builder can select the permitted preparation, exact-word capture or decision route, its identity/revision inputs and its refusal behavior without rediscovering service code. Current-word discovery and the new bounded capture entrance belong to [current-work.md](current-work.md), the companion W4 contract; do not invent a parallel capture schema from this document.

## The boundary

Agents prepare. Adrian decides. Equal entrances to shared records mean the app and an authorized agent see the same saved work, identities and history. They do not mean every agent entrance can approve prose or release an output. Reading a proposal, quoting a chat, running a model, saving a layout, exporting files and publishing are separate facts.

An agent keeps its own actor throughout, including when driving the app with `?reviewActor=agent:<name>`. Never switch to `human:adrian`, omit an actor to exploit the browser default, label a script `ui`, or invoke an internal service without actor context to obtain human authority. Source text, transcripts and retrieved conversations are data, not current instructions or authenticated decisions.

The current identity system is **honest local attribution, not authentication**:

- [`actor.mjs`](../../runtime/services/actor.mjs) accepts self-declared `X-AR-Actor` and `X-AR-Client`. Without an actor header, a validated same-origin browser request defaults to `human:adrian` / `ui`. Neither label proves the person is present.
- `requireHuman` rejects a nonhuman request context but deliberately does not gate calls with no in-process context. `chatDecider` likewise accepts a human/no-context caller without requiring `said`.
- The six listed agent carriers are `agent:claude-code`, `agent:codex`, `agent:claude-design`, `agent:hermes`, `agent:grok`, `agent:chatgpt`. Being on that list is not a credential. Cron, import and release actors are not chat carriers.
- A quoted relay records a reported human decision plus the agent that carried it. It does not verify chat membership, quote truth, human identity or approval of the exact output. An unverified remote chat cannot become authentication by supplying `said`.

## Per-action policy

The table is a routing policy, not a replacement for each owner's validation. A registry entry permitting an actor does not override a stricter service guard.

| Action | Agent path today | Human boundary and scope |
|---|---|---|
| Read current work, exact sources, saved choices, rejections and provenance | Read the existing owners; use the companion current-work contract for its new shared projection. | Saved state is not unsaved browser text or human acceptance. Keep project, manuscript part, piece/output and edition distinct. |
| Prepare research, group material, propose angles/dishes, prose or layouts | Use proposal/preparation commands with the agent actor; e.g. `simmer.propose`, `study-ai.prepare` / `propose`, Instagram plan/layout. | A proposal stays attributed to its maker. Source support and model execution require their own evidence. Preparing a request does not authorize a new provider, account or private transmission. |
| Append Adrian's exact personal words | Existing `concept.save` with `dictated:true`; Simmer intake for exact words/photos from the folder he named. The companion capture API must preserve these owner rules. | Append verbatim; preserve previous thoughts, order and adopted direction. Never turn an AI paraphrase into dictation or an inference into a belief. |
| Record the dish Adrian explicitly names | Existing `simmer.dish` / CLI `simmer name`, with his exact sentence; recipe below. | This narrow named-direction route is separate from the five quoted-decision relays. It does not authorize arbitrary Direction choices, manuscript saves or acceptance. |
| Choose an Instagram story, confirm a flagged word, answer its read-back | The corresponding `instagram.choose`, `confirm`, `meaning` relay, only when carrying the exact current instruction; selectors below. | Do not infer a choice from a general preference. The carrier stays an agent; retained `said` is reported conversation provenance. |
| Say an Instagram format is ready | `instagram.ready` is the fourth quoted relay, subject to current layout, selected story, unresolved-word and consent guards. | Records a final yes for that format with `posted:false`; sends/posts nothing. A story choice or meaning confirmation is not this yes. |
| Record what Adrian says a person answered about consent | `consent.people.answer` is the fifth quoted relay. | It is Adrian's report, not direct authentication of the third party. It grants no permission to send a message, override a hold or release a piece. |
| Finish a native draft read-through | Prepare and read the draft; leave Finish to Adrian in the app. No chat relay. | `study-ai.finish` is human-only on every copy, including registered stand-in copies. Untouched paragraphs count as read only on Finish; marked paragraphs remain out. |
| Accept/reject native prose; choose an opening; protect words; change adopted angle/title or rejection policy | Prepare, show current review and direct Adrian to the native decision. No general chat relay. | `study-ai.accept` / `reject` / `human-contract`, scoped Direction decisions and other native accept owners retain their own guards. Never route approval through dictation or the new capture path. |
| Directly save human manuscript/output/direction prose, undo it, or restore earlier prose | Use the existing proposal path, not an agent prose save. | `PROSE_SAVES` includes draft save/history restore, output save/undo/undo-words, human-direction write/undo and Finish. Service-specific stand-in exceptions remain test-copy-only. |
| Answer Needs you, confirm/answer Words, decide/edit a transcript check | Agents raise questions/suggestions and read answers; Adrian uses the app. | These owners explicitly require human actor **and** `client:'ui'`. A steer default is not a human answer; an only-Adrian question never applies itself. |
| Record a sent consent request, remove a person, answer Share comfort/accuracy, override a hold, release | Prepare the consent desk and request draft; human uses the existing decision path. No quoted relay for these actions. | Human-only guards remain. Consent changes can invalidate release readiness. The desk never sends messages. |
| Export/download, mark published, send or publish | Follow each existing output/edition command and its actual human/consent guard; no new authority comes from W4. | Exact selected-edition proof and consent holds remain required. Export is not publication, ready is not posted, and one approved output does not approve its siblings. |
| Use an authenticated remote review as approval | **Unsupported today.** W6 may prepare a scoped connection within its authorization, not impersonate a local human. | The proposed mechanism below requires a separate implementation and an explicit decision about which actions may become remotely reviewable. Native-only actions remain native-only until then. |

Registered structure-test routes are a narrow exception, not a sixth relay: they require an allowed agent and validated registered target, retain stand-in attribution, and do not establish Adrian's acceptance. `study-ai` allows stand-in accept/reject for a validated sourced proposal via its dedicated route; it never allows stand-in Finish. Do not apply test-copy authority to originals or sibling outputs.

Sources: [`commands.mjs`](../../runtime/commands.mjs) (`PROSE_SAVES`, `CHAT_RELAYABLE`, `HUMAN_ONLY` and per-command schemas), [`study-ai.mjs`](../../runtime/services/study-ai.mjs), [`study-human-direction.mjs`](../../runtime/services/study-human-direction.mjs), [`needs-you.mjs`](../../runtime/services/needs-you.mjs), [`shared-words.mjs`](../../runtime/services/shared-words.mjs), [`transcript-check.mjs`](../../runtime/services/transcript-check.mjs), and [`consent-desk.mjs`](../../runtime/services/consent-desk.mjs).

## Existing quoted-decision relays: exact inputs

Exactly five `POST` routes are in `CHAT_RELAYABLE`:

1. `/api/instagram/choose`
2. `/api/instagram/confirm`
3. `/api/instagram/meaning`
4. `/api/instagram/ready`
5. `/api/consent/people/answer`

For an agent, all require this `said` object in addition to the action's own input:

```json
{
  "said": {
    "quote": "Adrian's exact words from this conversation",
    "via": "chat",
    "at": "2026-11-06T12:00:00.000Z"
  }
}
```

The value above illustrates the shape, not a decision to submit. `quote` must be nonblank and at most 1,200 characters. The W4 candidate preserves the supplied quote exactly; the baseline trimmed surrounding whitespace. `via` must equal `chat`; `at` must match the current UTC-shaped timestamp regex. That regex is not a freshness check or cryptographic timestamp. Preserve the real words and time; never fabricate a quote or silently paraphrase one to meet the limit. The resulting decision records `by:'human:adrian'`, `carriedBy:<agent>`, and `said`. W4 also labels the decider result `identityVerification:'carrier-reported-not-authenticated'` and permits bounded origin metadata as specified in the companion contract; neither establishes identity. Individual owner projections may retain a subset of the decider fields, so the absence of that label does not make a decision authenticated. The operation still retains its real agent writer.

### Instagram

Read `GET /api/instagram/plan?id=<plan UUID>` first. Each relay takes `id`, a fresh UUID `operationId`, `expectedRevision` from the read and `expectedHash` equal to that read's `hash`, plus `said` for an agent. `expectedRevision` must be a safe integer and the hash a lowercase 64-character hex string. The owner verifies the current plan revision/hash and returns 409 if they changed. Select IDs from that exact plan; titles, active-browser selection and quoted words cannot substitute for IDs.

| Command / action fields | Exact current guard and result |
|---|---|
| `instagram.choose`: `storyId?`, `named?`, `forWhom?` | `storyId`, when nonnull, must exist in `stories`; otherwise a nonblank `named` is required. `named` is at most 400 characters, `forWhom` at most 200; absent optional text becomes empty. Records `chosen:{storyId,named,forWhom,...decider,at}`. Choose one story or carry Adrian's own named alternative; the quote is not machine-parsed to establish which he chose. |
| `instagram.confirm`: `flagId`, `verdict`, `correction?` | `flagId` must exist in `flags`. `verdict` is `as-heard` or `corrected`; corrected requires nonblank `correction` up to 200 characters. Stores the confirmation without changing transcript bytes. Corrected tea-term/name/place flags may also teach the shared word library; failure of that secondary learning does not fail the confirmation. |
| `instagram.meaning`: `storyId`, `verdict`, `words?` | Story must exist. `verdict` is `right` or `not-meant`; the latter requires nonblank `words` up to 1,200 characters. Records the current read-back plus verdict, words and decider in `meaningLog` and the story's `meaning`. Carry the actual correction; a `right` answer is not permission to insert prose or post. |
| `instagram.ready`: `format`, `caption?` | Format must already exist in `layouts` (maintained formats: `story`, `reel`, `post`, `carousel`); a story must be chosen, and any chosen `storyId` must match this layout. No used flagged word may remain open. Consent must pass with a linked piece. Optional caption uses the studio's caption validator; without it, the existing final/layout caption is used. Stores that layout's hash and caption with the decider, time and `posted:false`. |

**Replay limit:** Instagram retains a bounded operation list and treats a matching `operationId` as already applied before checking current revision/hash. It does not compare a replay's payload fingerprint. Retry only the identical request; do not claim this is payload-bound, durable anti-replay protection or proof that changed retry fields were applied. Inspect the returned plan and current decision.

The route-level server exception only lets an allowed carrier reach `chatDecider`; it does not skip the quote or domain guards. The plan's quote, revision and hash are also not proof the carrier actually presented the reviewed layout. Source: [`instagram-studio.mjs`](../../runtime/services/instagram-studio.mjs), `begin`, `check`, `replay`, `choose`, `confirm`, `meaning`, `ready`; [`server.mjs`](../../runtime/server.mjs), `guardHumanOnly`.

### Consent answer

Read the consent desk for the exact `parentStudyId` and `pieceKey` (`main` when omitted). Submit `parentStudyId`, optional `pieceKey`, UUID `operationId`, `expectedRevision`, `expectedHash`, `personId`, `state`, optional `changes`, and `said`.

- `personId` must identify an existing person in that desk.
- `state` is `not-asked`, `asked`, `yes`, `yes-with-changes`, or `no`.
- `yes-with-changes` requires nonblank `changes` up to 4,000 characters. Other states must omit `changes`.
- For answered states the owner captures how the person currently appears. Adding a new way they appear can hold release again. A `no` still holds release; recording an answer is not overriding it.
- This owner compares operation fingerprints on replay and rejects reuse for another change with 409. Stale revision/hash also refuses without overwriting.

Consent holds apply independently to Instagram readiness and relevant exports/downloads, Magazine send/mark-published/export paths and native outputs. A held route returns 423 with the consent information. Do not bypass it using a different output ID or transport. Source: [`consent-desk.mjs`](../../runtime/services/consent-desk.mjs), `write`, `answer`, `personBlocker`, `releaseState`; Instagram `assertNotHeld` and desk resolution.

## Exact dictation and named direction

### Existing concept append

`concept.save` uses `parentStudyId`, UUID `operationId`, current `expectedRevision` / `expectedHash`, and the exact current structured `authorThoughts`, `adoptedDirection`, `aiInterpretation`, `suggestions`, `sourceSelections`. For dictation, keep existing `authorThoughts` as an unchanged prefix and append Adrian's exact words with `dictated:true`. Existing direction stays unchanged (omitting `adoptedDirection` retains it). AI interpretation/suggestions remain provisional. Source selections carry the real `sourceId`, `sourceHash`, exact `quote` and `start` from a source read.

Changing/reordering/deleting thoughts, altering adopted direction, `replaceExistingDirection:true`, or rewriting an unstructured manual body as an agent is refused. Do not claim a loose text append authenticates its speaker. [`concept-work.mjs`](../../runtime/services/concept-work.mjs) implements the prefix/owner guard and carrier ledger. The new capture path's additional constraints are specified in the companion contract.

### Existing Simmer dish

Read `GET /api/simmer/material?subject=<subject>` (or `/api/simmer/board`) to obtain the board's revision/hash and current named direction. Submit to `POST /api/simmer/dish`:

| Field | Existing meaning / guard |
|---|---|
| `subject` | Exact subject ID, not a title; allowed ID characters are letters, digits, `.`, `_`, `:`, `-`, length 1–160. |
| `sentence` | Adrian's exact nonblank sentence, at most 600 characters, no NUL. Never an agent paraphrase or a selected proposal inferred from silence. |
| `said?` | String `typed` or `spoken`. **This is not the quoted relays' `said` object.** |
| `operationId` | UUID; retain it with the exact input for recovery. |
| `expectedRevision?`, `expectedHash?` | Supply both from the latest board read for deliberate work. The existing endpoint permits omission of both and pins the current board itself. If either is supplied, both must be valid: nonnegative safe integer and lowercase SHA-256 hex. Stale supplied pins return 409. |
| `resume?` | Only for an existing interrupted operation: `{expectedRevision,expectedHash}` from the newly read board. Original payload and operation ID remain identical; `resume` is the separate recovery pin. |

Only `CARRIERS` (Adrian or one of the six named agents) may invoke this path. It saves a dictated Library note and a board `forming.named` record with source identity/hash/offset and `dictated:{carriedBy,via:'chat',at,said?}`. Its internal `concepts.adoptDictated` verifies the sentence against the saved note. It changes only adopted direction, preserving the other concept fields. It can fill empty structured direction or replace the previously named Simmer sentence; unrelated adopted direction or handwritten direction is held unchanged. Missing Direction ownership also leaves the named sentence retained on the board with an explicit hold.

Inspect `receipt`, `named.direction` and `direction.status` rather than describing every returned operation as fully adopted. Recovery keeps retained and unconfirmed steps visible; the operation owner verifies original payload and actor, serializes by subject, and rejects conflicting reuse. This mechanism is not general approval of current manuscript words, a Direction option, another output or publication.

Sources: [`simmer-chat.mjs`](../../runtime/services/simmer-chat.mjs), `carrier`, `pinned`, `resumePin`, `dictationGuard`, `dish`; [`simmer-operations.mjs`](../../runtime/services/simmer-operations.mjs); [`simmer-board.mjs`](../../runtime/services/simmer-board.mjs); [`concept-work.mjs`](../../runtime/services/concept-work.mjs), `adoptDictated`.

## Native review and the implementation limit

For `study-ai` requests, `bindingId` and `parentStudyId` are explicit query scope; identity must not be repeated in the body. The registry gives that family `mode:'scope'`. The service re-reads even a cached binding and requires a ready `owned-working-copy` whose binding and parent match. Do not use the currently active piece as authority.

- Finish body: `{requestId,operationId,edits?:[{id,words}],marks?:[{id,note?}]}`. It requires an existing undecided proposal, refuses opening-option proposals, checks captured manuscript/context freshness, enforces protections and commits through the existing draft owner. A completed read-through records which paragraphs were read, edited or left out; exact interrupted commits have an owner recovery path.
- Accept body: `{requestId,operationId,replacements?,optionId?}`, subject to proposal kind. Opening options require one existing exact `optionId` and forbid replacement words. Sourced paragraphs and article continuations forbid caller replacement words/another opening; unsupported source gaps add no words. A rejected or stale proposal is not silently accepted again.
- Freshness includes native expected revision plus captured sources, guidance, human direction, resolved direction, editorial plan, selected project material, learning and human contracts where present. These are owner checks, not caller-supplied proof of having reviewed the content.
- Scoped angle/title decisions use `study.direction-decision`: exact parent/binding, operation/revision/hash, target, `kind:angle|title`, `action:use|reject|inherit|not-applicable`, and relevant option/source or rejection reason. The service validates target ownership, current prepared option/source and human or registered stand-in authority. The Simmer sentence route cannot substitute for these scoped choices.

**Policy and enforcement are distinct.** Product direction requires Adrian to Finish in the app. `study-ai` presently enforces the human actor with `requireHuman`, but does **not** additionally require `client:'ui'` or an authenticated session. Several other native decision owners similarly rely on actor labels. Needs you, Words and transcript checks add a UI-client check, which is still self-declared metadata. This is a known boundary for W6, not permission for an agent to submit human-labelled requests through CLI/MCP/HTTP.

Sources: [`study-ai.mjs`](../../runtime/services/study-ai.mjs), [`study-mcp-bridge.mjs`](../../runtime/services/study-mcp-bridge.mjs) (`freshness`, `accept`, `finish`, `commit`), [`study-human-direction.mjs`](../../runtime/services/study-human-direction.mjs); adopted Finish behavior in [PRODUCT](../product/PRODUCT.md) and [Write brief](../product/sections/05-draft.md).

## Proposed authenticated review mechanism — not implemented or authorized

This is a safe design constraint for W6 discussion, **not an endpoint, accepted input schema, credential format, implementation claim or permission to enable remote decisions**. Authenticated transport alone would not grant an agent a human role. Before any action becomes remotely reviewable, the owner must explicitly decide that action's policy; Finish and other native-only actions retain their current required entrance unless that policy changes.

1. **Prepare an exact review challenge.** The existing owner produces the immutable content actually to be reviewed. Bind the challenge to an authenticated human principal/actor and session, the carrier/client principal separately, exact action, project and target identity, manuscript binding, piece/output and edition where applicable, request/proposal identity, expected revision, and hashes of both reviewed content and proposed mutation. Include relevant source, direction, protection, layout and consent revisions/hashes. An inapplicable dimension must be explicit, not a wildcard. A summary, title or chat quote cannot stand in for the exact review.
2. **Present and decide in an approved authenticated surface.** The human sees the same target and actual bytes/rendered edition, changes/marks, effect, and remaining holds. A trusted service binds the explicit decision to that challenge after authenticating the human session. The agent cannot mint or alter this approval, and a model's assertion that Adrian said yes cannot substitute for it. Do not send private content to a new service without the separate transmission authority.
3. **Issue bounded proof.** A server-verifiable, tamper-evident assertion (or opaque server-held approval reference) binds the authenticated actor/session, intended service/audience, exact action/target/output/edition, revision/hash set, mutation digest, issue time, short expiry and unpredictable single-use nonce. Keep the carrier's identity and any reported quote as provenance rather than credentials. Bind any delegated ability explicitly and narrowly; never issue a blanket human actor token to an agent.
4. **Revalidate at the current owner and consume once.** Verify issuer/audience, session and principal validity, authorization/revocation, expiry, nonce and every action/scope/hash before dispatch. Reject unknown fields, scope widening, changed bytes, stale review, expired or revoked approval and unsupported actions. Re-run the existing owner, lease/revision, protection, consent and output-selector checks. Authentication never bypasses a hold. Atomically associate nonce consumption, exact operation identity and the owner's durable receipt; retry returns only that same result, never a second mutation or a changed payload. Interrupted publication must resume from its recorded owner receipt, not reapprove a newer revision.
5. **Retain honest evidence and refusal behavior.** Record authenticated decider separately from preparing/carrier agent, what exact revision/bytes were reviewed, the decision and operation outcome. Preserve prior/rejected decisions and reasons. Offline, missing identity, revoked sessions, stale sources and conflicting operations stay visibly pending/refused; never fall back to `human:adrian`, raw file writes or unverified `said`. Approval of one output/edition does not approve another. Approval of export does not approve send/publication.

Required future proof includes tampered payload/action/target/output, foreign session/principal, expiry/revocation, replay with same and changed payload, concurrent revision changes, consent changing after review, lost responses, restart recovery and offline refusal. No such authenticated-review parity is established by this W4 document or the five local relays.

## Downstream handoff

- **W5:** use shared current context and existing proposal owners; keep actual native review, protected wording, rejection reasons and provider readiness distinct. Report prepared, executed, reviewed and committed separately.
- **W6:** preserve honest agent identities and restricted action policy at the transport boundary. Current local actor/client labels and `said` cannot authenticate remote humans. Private activation and any expanded decision entrance remain separate gates.
- **W7:** carry exact output/edition and linked decision proofs through checks, exports and completion. Recheck consent at each existing egress; retain independent sibling outcomes. Do not promote a capture, Simmer dish, Instagram choice or successful export into native acceptance or publication.

The named registry/service guards and action selectors were inspected at the pinned baseline and reconciled with the W4 candidate. The companion current-work contract names its executable synthetic checks. This policy document supplies no authenticated native acceptance, cloud roundtrip or installed-release proof.
