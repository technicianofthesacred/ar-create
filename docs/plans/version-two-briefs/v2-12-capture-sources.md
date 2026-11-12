# Stage 6: Check can read a new subject's sources (design brief)

Design only. Nothing here is built. Written 12 November 2026 against `main` at the stage 6 record (PR 242). Line
numbers are from that commit; re-find them before editing. Read `v2-common.md` and "Rules for every worker" in
`docs/plans/2026-11-11-direction-d-build.md` first; both apply.

## In plain words

A new button, "Use it for Check", copies a transcript or note you have attached to a subject and reviewed into that
piece's private folder, so Check has something to compare your quotes against. Check will then trust exactly the copy
made when you pressed it, and nothing else: not the Library's later changes, not material you set aside, not
anything an assistant adds. It never touches your words; the draft file is not opened for writing. Only you can press
it; an assistant asking gets a refusal. A check made before the copy shows as out of date, never as passed. The copy
can be added to but never quietly rewritten.

## What is wrong today (measured from the code)

- Check reads its sources only from the draft's locked capture: `evidence()` in
  `runtime/services/study-draft-checks.mjs` line 26 takes `draft.context.records` with role `source` or `context`;
  `perform()` (line 168) holds with "No captured SRC available." when none has role `source` (line 181).
- `draft.context` is `capture(b)` (`runtime/services/study-draft-copies.mjs` line 32), the `capture-manifest.json`
  written once, exclusive and mode 0400, by `finishCopy` (line 134 to 141) and pinned by `b.captureHash` in the
  binding intent file.
- A subject made from New subject is `study-draft.create-collection` with no `sourceBindingId`
  (`public/v2/screens/home.js` line 488), so `createCollection` (line 72) captures only the blank draft (line 91).
- `study.material.attach` (commands.mjs line 396, `first-flow.mjs` `study.attach` line 201), `first-flow.attach`
  and `recordings.source` change the subject's material list only. Nothing carries material into the draft room.
- The Article on a New subject is the root draft itself, registered as an output (`outputCatalog`,
  `study-draft-copies.mjs` line 27, kind `existing-native-output-registration`), so Check runs on the root's
  `bindingId`. Confirm this on the demo in piece A's HTTP test; it was read from code, not run.

## Decision 1: the command

**Name:** `study-draft.capture-sources`. Route `POST /api/study-draft/capture-sources`; `nameOf`
(commands.mjs line 152) gives the name, and the `study-draft` prefix puts it in section `draft` (line 146).

**Input** (exactly these keys, else 400; checked with `inputFields` style, `study-draft-copies.mjs` line 57):

| field | meaning |
| --- | --- |
| `bindingId` | the subject's root draft (UUID) |
| `parentStudyId` | the subject |
| `operationId` | fresh UUID |
| `expectedSourcesHash` | `addedSources.hash` from the last `study-draft.read`, or `null` when the read had no `addedSources` |
| `sources` | 1 to 20 entries `{sourceId, sourceHash}`: the Library source and the hash he saw it at |

The approved sketch named this `sourceIds` with an "expected revision/hash". The draft's own `expected` is not asked
for: the command never touches the draft, so a word typed in another tab must not refuse it. The record that can go
stale is the added-sources file, so its hash is the expected hash. Each source carries its hash so a source changed
in the Library after he looked is refused rather than captured blind.

**Output** (200): `{document, captured:[{sourceId, id, role, copiedHash}], alreadyCaptured:[sourceId], sourcesHash}`
where `document` is `readOwned(b)` (so the screen gets the new `addedSources` in the same reply).

**Errors**

- 400: unknown or missing keys, bad UUIDs, empty or over-long `sources`, duplicate `sourceId`.
- 400: a source not attached to this subject, set aside, unreadable or not reviewed (the material authority's own
  refusal, `study-project-material-context.mjs` line 33, "Selected parent material is missing, unreadable or
  unreviewed.").
- 403: any actor that is not in `HUMAN_ACTORS` (`runtime/services/actor.mjs` line 19). Twice: at the HTTP gate
  (`guardHumanOnly`, `runtime/server.mjs` line 457, from the registry's `HUMAN_ONLY` set) and again inside the
  service (`currentActor()?.actor`, as `undo` does at `study-draft-copies.mjs` line 249), so an in-process caller
  that skips the registry is still refused. Unlike `undo`, an absent actor is refused too.
- 404: binding not found (`binding()`, line 28).
- 409: binding not `ready`; binding is not an authored root (see Decision 3); binding is listed in the relocation
  manifest (`createStudyOwnedRelocation`); `expectedSourcesHash` differs from the file now; a `sourceHash` differs from
  the material's current hash; the operation ID already belongs to a different input; the added-sources file fails
  validation.
- 413: a source over 2 MB (the limit `original()` uses, line 29).
- 423: someone else holds the draft's lease. Nothing new to build: the route-map path calls `leases.check` with
  `scopeOf` (server.mjs line 768, `runtime/services/events.mjs` line 43), which gives `{kind:'draft', id:bindingId}`,
  the same lease as `study-draft.save`.

**Idempotence.** Each entry records `operationId` and `inputHash = digest(stable(input))`. The same operation ID with
the same input returns the current document and changes nothing; with a different input it is 409. A source already
captured at the same `copiedHash` is reported in `alreadyCaptured` and not copied again, so pressing twice never makes
two. An interrupted run (copy written, record not) is finished by retrying the same operation ID: copies are named
`added-<operationId>-<n>.md`, and an existing copy whose bytes match is reused, as `finishCopy` does (line 137).

**Where it is registered** (one registry, so the CLI, MCP and capabilities list pick it up with no other change):

- `runtime/commands.mjs` route map next to `/api/study-draft/open` (line 481):
  `'/api/study-draft/capture-sources': {POST:input=>draftCall(()=>captureStudySources(input))}`.
- `BODY` (line 105 to 108): `['bindingId','parentStudyId','operationId','expectedSourcesHash','sources:[{sourceId,sourceHash}]']`.
- `HUMAN_ONLY` (line 217): add `'POST /api/study-draft/capture-sources'`. Not in `PROSE_SAVES` (it writes no prose),
  not in `CHAT_RELAYABLE`, no `UNDO` entry (the record is append-only; see question 3).
- `runtime/server.mjs`: compose `captureStudySources=input=>studyDrafts.captureSources(input,{material:studyProjectMaterial})`
  after line 309, and pass it in the services object at line 428; destructure it at commands.mjs line 261.
- `npm run build` regenerates `docs/CAPABILITIES.md`.
- Activity: the server opens a native activity descriptor for every `study-draft.*` write that carries `bindingId`,
  `parentStudyId` and `operationId` (server.mjs line 800, `activity-recovery.mjs` `beginNative` line 42). Its crash
  recovery asks `studyDrafts.inspect` for a receipt. Extend `inspect` (in the API object, line 249): when
  `operationId` names an added-sources entry, return `{receipt:{state:'committed', operationId, kind:'captureSources',
  after:{hash:sourcesHash}}}`; otherwise unchanged (404 for unknown stays). Add `'captureSources'` to the
  `withDraftProvenance` list (line 240) so "who did it" is stamped like every other draft operation.

## Decision 2: where the appended sources are recorded

**Files** (all inside the draft's own room, `dirs(b)` line 30, `copies/<bindingId>/`):

- `capture/added-<operationId>-<n>.md`: the copied bytes of one source, written `exclusive`, then mode 0400.
- `added-sources.json`: the append-only record.

**Format** (`ar-create.study-draft-added-sources.v1`):

```
{schema, bindingId, parentStudyId, captureHash,          // captureHash = b.captureHash: the locked record it extends
 entries:[{sequence, operationId, inputHash, actor, capturedAt,
           id,                                          // 'added:' + sourceId + ':' + first 12 of copiedHash
           sourceId, role, kind, title, sourcePath, libraryHash,
           review:{state:'reviewed', basis},             // copied from the material record
           copiedName, copiedHash,                       // copiedHash = digest of the copied bytes
           previousHash,                                 // entryHash of the entry before, or captureHash for the first
           entryHash}]}                                  // digest(stable(entry without entryHash))
```

**Pinning.** Each copy is pinned by `copiedHash`; each entry by `entryHash`; the chain by `previousHash`, which
starts at the locked manifest's hash, so the added record cannot be moved to another draft or survive a different
locked capture. The whole file's hash (`sourcesHash`) is what a caller sends back as `expectedSourcesHash`. Writes go
through `atomicWrite` (`files.mjs`): `{exclusive:true}` for the first, `{expectedHash:<old file digest>}` after, then
chmod 0400. Before writing, the service checks inside the `serial` queue (line 21) that the old entries are an exact
prefix of the new list: append only.

The binding intent file is **not** changed. Two reasons: root recovery hashes it (`intentHash`,
`study-root-recovery.mjs` line 133 to 136), and the atomic rename already makes the file either old or new. Not
anchoring the head outside the file is the same strength as today: the locked manifest is pinned only by a field in
a file in the same data folder.

**The locked record stays byte-identical.** `capture-manifest.json` is never opened for writing; `capture()` still
checks it against `b.captureHash` (line 32). The new copies use the `added-` prefix, so they never collide with the
locked copies (`<index>-<name>`, line 137). Nothing enumerates the capture folder (`capture()` and root recovery read
only paths named in the manifest), so an extra file there changes no existing check. A test must still run root
recovery `inspect` after a capture and see it pass.

**Reader.** A new `added(b)` in `study-draft-copies.mjs`, beside `capture(b)`: absent file means `null`; otherwise
validate schema, identity, `captureHash===b.captureHash`, contiguous `sequence`, the chain, each `entryHash`,
`copiedName` against `/^added-[0-9a-f-]{36}-\d+\.md$/`, `regular()` on each copy and its digest, and strict UTF-8
decode. It returns `{hash, records}` where `records` keeps **the latest entry for each `sourceId`** (see Decision 6),
each shaped like a locked record plus `added:true`: `{id, role, kind, title, sourceId, sourcePath, libraryHash,
copiedPath:path.join(dirs(b).capture, copiedName), copiedHash, raw, capturedAt, actor, operationId, added:true}`.

A broken added file must never stop Write. So `added(b)` does not throw from `readOwned`; it returns
`{error:'Captured sources for Check changed; nothing was used.'}` and Check refuses on that (409) instead.

**Where it is merged.** Here the approved proposal ("merge it into `context.records` when Check and the other readers
load the draft") is changed, because the code makes a blanket merge unsafe (see the reader table):
`readOwned` (line 52 to 55) leaves `context` exactly as today and adds `...(added?{addedSources:added}:{})` beside
it. The key is absent when there is no file, so every existing draft reads byte-for-byte as before. Check merges the
two in one place, `evidence()` line 26:

```
if (draft.addedSources?.error) throw fail(draft.addedSources.error);
const records = [...(draft.context?.records || []), ...(draft.addedSources?.records || [])]
  .filter(r => ['source','context'].includes(r.role) && !r.missing);
```

Everything after line 26 is unchanged: the copy is re-read from `copiedPath`, re-hashed, compared with `raw`, and the
proof lists `{id, role, hash}` for each. Locked records come first, so a draft that already had an SRC keeps it as the
primary source; on a New subject the first captured transcript becomes the primary.

**Every reader of `context.records`, and whether it sees the added sources**

| reader | sees added? | why |
| --- | --- | --- |
| `study-draft-checks.mjs` `evidence` line 26 (Check and its receipts) | yes | the purpose |
| `subject-standing.mjs` line 324 (through `checks.read` with the same `evidence`) | yes | standing follows Check |
| `study-draft-copies.mjs` `readOwned` line 55 (returns `context`) | no, beside it | keeps every old read identical |
| `capturedRecordMetadata` line 33 (catalog) | no | lists the locked capture only; a later piece may list both |
| `collectionSeed` line 60, `createCollection` `readSource` line 77 | no | a collection seeded later keeps today's seed shape |
| `structureSeed` line 124, `cloneStructureTest` | no | stand-in copies stay seeded from the locked capture |
| `forkSeed` line 144, `fork` | no | see Decision 5 |
| `study-editorial-plan-context.mjs` lines 28, 33, 38, 48, 69 to 72 | no | it **fails closed** on any non-draft record an authored root without `collectionSource` holds (line 48), and on any record not in the vault original (line 70); a merge would stop assistance on every captured subject |
| `study-mcp-bridge.mjs` lines 342, 351, 353 | no | the same material already appears there as attached parent material; seeing it twice trips "Source origin is ambiguous" (line 351) |
| `study-research-sources.mjs` line 6 | no | the material is already allowed through `firstFlow.materialContext` (line 9) |
| `study-direction-options.mjs` line 16 | no | reads map and plan roles only |
| `native-output-factory.mjs` line 92, `native-output-owner.mjs` line 593, `native-carousel-make.mjs` line 35 | no | Carousel and output snapshots keep their own captured sources; Carousel Check is outside this piece (question 5) |
| `structure-test-records.mjs` lines 17 to 32 | no | structure tests only; capture is refused there |
| `source-translation-proposals.mjs` line 28 | no | translation of an added source is not offered |
| `study-root-recovery.mjs` line 95 | no | reads the manifest bytes, which do not change |
| `agents/remote/tools.mjs` line 86, `agents/mcp/server.mjs` line 69, `mcp/study/server.mjs` line 23 | no | agent listings; they may show `addedSources` read-only later |
| `public/document-study/*` (combined-subjects 58, study-ai-proposals 51 and 114, combined-sheets 114, draft-flow 478, source-continuation 38) | no | old workspace; unchanged |
| `public/v2/*` | none read `context` | |
| `requests.mjs` line 84 | n/a | a different `context` (request context) |

## Decision 3: which materials qualify, and consent

**Qualifies:** attached to this subject, reviewed, not set aside, readable, at the hash he saw. Do not re-decide any of
this: call the existing authority `studyProjectMaterial.context({bindingId, parentStudyId}, {sourceIds})`
(`study-project-material-context.mjs` line 25). It resolves the parent and part bindings, reads
`firstFlow.materialContext` (`first-flow.mjs` line 98 to 115) and refuses any source that is not `eligible` with
`review.state==='reviewed'` and text. `eligible` already means not set aside (`materialDecisions[id].decision!==
'set-aside'`), readable, card-eligible and reviewed (`reviewed()`, line 47: a recording transcript must be coherent
and confirmed in the recording workshop at the current hash; other material needs the first-flow source review at
the current hash). Then compare each record's `hash` with the `sourceHash` sent (409 on a difference) and copy
`raw`.

**Role.** A recording transcript (`kind==='transcript'`) is captured with role `source`; any other material with role
`context`. Check's quote guard reads every `source` and `context` file; its split guard and its "held, no source"
rule use the first `source` (lines 181 to 184), which is what a transcript is for.

**Which drafts accept a capture:** only an authored root: `b.kind==='collection-root'`, `b.origin==='authored-
collection'`, status `ready`, not in the relocation manifest. Refused with 409: `structure-test` copies (agent
stand-ins), `output-fork` drafts (their sources are their seed; Decision 5), and drafts opened from a vault original
(they already carry the original's SRC; question 4).

**Consent.** The existing mechanism is the truth and consent desk (`runtime/services/consent-desk.mjs`): people on a
piece, each with an answer (`personBlocker` line 49), and one hold computed from them (`releaseState` line 71,
`holdFor` line 123, `assertNotHeld` line 148) that every way out reads: publish, mark published, export for posting,
ready to post (PRODUCT.md "Every way out respects the consent hold", 3 November). People are not linked to sources;
there is no per-source or per-speaker consent record anywhere. The one gate on other people's speech before use is
the transcript review itself, which refuses until every speaker is named and no segment is unattributed
(`transcript-corrections.mjs` line 163, `magazine/outputs.mjs` `reviewEligibility`).

So the design does **not** invent a capture-time consent hold, and capture does not consult the desk. Capturing is a
private copy inside his own data, the same as `study-draft.open` copying a vault SRC that holds other people's words,
and the desk's hold still stops every way out of the piece. Gating capture on the desk would hold Check on almost
every subject with a person in it, since people are usually unanswered until a piece is nearly done, and checking
their quotes before asking them is the useful order. Question 2 asks Adrian to confirm this.

## Decision 4: a check receipt made before the capture

Nothing to change: the existing rule already turns it stale. `read()` (`study-draft-checks.mjs` line 195) recomputes
`evidence()` and returns `{...record, status:'stale', staleReason:'This receipt covers an earlier draft or source
revision.'}` whenever `record.proof` differs. A capture adds entries to `proof.sources`, so every earlier receipt
(held, checked or needs-review) differs and reads stale. A check running while a capture lands is caught by the
before and after comparison in `perform()` (line 188). The Check screen already treats a stale receipt as not current
(`check.js` `receiptCurrent` line 28). Recapturing a changed source changes the record `id` and hash, so it stales
receipts too. A test must show a held receipt and a checked receipt both reading `stale` after a capture, never
`checked`.

## Decision 5: earlier forks and structure tests

They keep their old seeds, for three reasons. Their seeds are separate files written once, mode 0400, and pinned in
their own binding (`fork-seed.json` and `b.seedHash`, checked in `fork` lines 168 to 173; `structure-test-seed.json`
and `b.structureTestSeedHash`, checked in `validateStructureTest` line 50; `collection-source-seed.json` and
`b.collectionSourceSeedHash`, `validateCollectionSource` line 69). The capture writes only in the root's own room.
And what they pin about the parent is `b.captureHash` (`structureTest.captureHash` line 109, `collectionSource.
captureHash` line 83, `derivedFrom.captureHash` line 164), which does not change because the locked manifest does not.

Forks and structure tests made **after** a capture also seed from `context.records` only, so they do not inherit the
added sources. That is deliberate: inheriting them would put non-draft records into an authored child that
`study-editorial-plan-context.mjs` line 39 to 48 then refuses. It also keeps one edge safe: a fork or structure test whose
intent was written before a capture but whose seed file was not yet saved rebuilds exactly the seed its hash expects,
because the seed builders never read `addedSources`.

## Decision 6: a captured source later set aside or changed in the Library

The pinned copy stays and Check keeps reading it: it is what he chose, at the hash he saw. Set aside or edited in the
Library, the copy in the draft room is untouched (mode 0400, hash-pinned), so Check's result does not move by itself.

- Changed in the Library: pressing "Use it for Check" again with the new hash appends a new entry; the reader keeps
  the latest entry per `sourceId`, so Check reads only the new copy and every earlier receipt goes stale. The old copy
  stays on disk and in the record.
- Set aside: the command refuses to capture it again (not eligible), and the existing copy keeps counting (question 3).
- Does Check say anything? Not in piece A. Piece B may add one quiet line to the Check screen, only if Adrian wants it
  (question 3): "A source this check reads has changed in the Library since you used it." It would compare
  `addedSources.records[].libraryHash` with `first-flow.material-context`.

## Decision 7: the command never changes his words

It writes exactly these, all under `copies/<bindingId>/` or the provenance ledger:

1. `capture/added-<operationId>-<n>.md` (new files only, exclusive).
2. `added-sources.json`.
3. The draft provenance ledger stamp (`createProvenanceLedger`, line 238).

Plus, outside the service, the activity outbox and journal line every write gets. It does not call `owner(b)`, so the
project-folder owner, the `workflow/` tree (where `Workflow/3-Develop/DEV - Collection.md`, his words, lives),
`metadata/` (correspondence and receipts), `media/`, `capture-manifest.json` and the binding intent file are never
opened for writing. Test: hash every file under `workflow/`, `metadata/` and `media/`, the manifest and the intent
file before and after, and assert `read.expected` and `read.raw` are identical.

## Decision 8: no other way for an assistant to get the same effect

| path that writes a capture folder or a draft's context | closed because |
| --- | --- |
| `study-draft.capture-sources` | human-only at the gate and in the service (403) |
| `finishCopy` (line 134) | writes a manifest only when none exists (`exclusive`); every caller makes a new binding |
| `study-draft.open` (`openCopy` line 125) | keyed by subject and vault original; makes a separate binding from a trusted original, never touches the root |
| `study-draft.create-collection` (line 72) | keyed by subject; the root already exists, so a second call with `sourceBindingId` is refused ("Collection already has a different native creation identity", line 79) |
| `study.outputs` fork (`fork` line 151) | makes a new binding seeded from the locked capture |
| `study.structure-tests` (`cloneStructureTest` line 95) | agent only, but on a new subject `structure-test-<operationId>` |
| `study-draft.recover`, `study-draft.root-recovery` | read the manifest; root recovery says it never writes captures (`study-root-recovery.mjs` line 59) and needs `ownerDecision` |
| writing `added-sources.json` or a copy by hand | not a command; the reader refuses a broken chain or hash and Check then refuses |
| `study.material.attach`, `first-flow.attach`, `recordings.source`, source review | change the material list only; Check never reads it |

Noticed, not part of this piece: `first-flow.source-review` and `POST /transcription/{id}/review` are not in
`HUMAN_ONLY`, so an assistant can mark material reviewed. That can make a source eligible; it cannot capture it.
Question 6 asks whether review should become his alone.

## Decision 9: the standing

Today: no receipt reads "Not checked yet" and leads as "Check"; a held receipt with no source reads "No source to
check against yet" (`standing-rule.mjs` line 163, generated copy `public/v2/shell/standing.js` line 164, built by
`runtime/scripts/build-standing.mjs`). After a capture the held receipt reads `stale` (Decision 4), so the fact
builder sends `status:'stale', noSource:false` and the rule falls to "Check again" (line 164), not "Check".

Smallest change, in the fact builder only, `runtime/services/subject-standing.mjs` line 325: a receipt that never
compared anything (its own `quote.status==='held'` and no `role:'source'` in its `proof.sources`) and now reads
`stale` is reported as `status:null`, so the rule says "Not checked yet" and the next step is "Check", as before:

```
const v = c?.value, never = v?.quote?.status === 'held' && Array.isArray(v?.proof?.sources) && !v.proof.sources.some(x => x?.role === 'source');
facts.check = c ? {status: v?.status === 'stale' && never ? null : v?.status || null, issues: (v?.issues || []).length, noSource: v?.status === 'held' && never} : null;
```

`standing-rule.mjs` and its generated copy do not change, so the build changes nothing in `public/v2/shell/`. The
subject page re-reads on `study-draft` events already (`subject.js` line 226).

## Decision 10: tests

`tests/study-draft-capture-sources.test.mjs` (new; invented content; the service with a fake material authority, and
one HTTP pass on a real test server):

- An authored root with a reviewed, attached transcript: capture copies it, `addedSources` lists it with role
  `source`, and Check ends `checked` on a quote taken word for word from it.
- Before the capture the same draft's Check is `held` ("No captured SRC available.").
- `capture-manifest.json` and the binding intent file are byte-identical before and after; `capture()` still passes.
- Every file under `workflow/`, `metadata/`, `media/` is byte-identical; `read.raw` and `read.expected` unchanged.
- A draft with no capture reads exactly as before (no `addedSources` key; deep-equal to a read taken on main's shape).
- Same `operationId`, same input: second call changes nothing and returns the same `sourcesHash`.
- Same `operationId`, different input: 409.
- The same source twice in one call: 400; already captured at the same hash: listed in `alreadyCaptured`, no new file.
- Stale `expectedSourcesHash`: 409. `null` when a record exists: 409.
- `sourceHash` differing from the Library's current hash: 409, nothing written.
- Source not attached, unreviewed transcript, set aside, unreadable: 400 each, nothing written.
- Structure-test copy, output fork, vault-opened copy: 409 each.
- Interrupted after the copy, before the record (fault hook): retrying the same `operationId` completes it once.
- Added-sources file edited, an entry removed, a copy's bytes changed, a copy renamed: `read` still succeeds with
  `addedSources.error`; Write saves still work; Check refuses 409.
- Recapture after the Library source changed: Check reads only the new copy; both files remain.
- Root recovery `inspect` passes after a capture.
- A fork and a structure test made before the capture keep their seed hashes and validate; ones made after carry no
  added sources.
- `inspect` returns a committed receipt for a capture's operation ID and 404 for an unknown one.
- **Adversarial, agent:** `agent:claude-code`, `agent:codex` and an unattributed in-process call each get 403 at the
  service; over HTTP with an agent actor, 403 and no file written.
- **Adversarial, Check must not pass on unsupported words** (each ends `needs-review` with a quote `NOT FOUND`, never
  `checked`): an invented quote; a quote found only in an attached but uncaptured source; a quote found only in a
  set-aside source; a quote found only in the old copy after a recapture; a quote found only in a file an agent
  placed in `capture/` and named in a forged `added-sources.json` (Check refuses 409 before running); a quote found
  only in the Library's changed version, not the captured one.
- **Known gap, recorded as `test.todo`:** a quote made from the last words of one captured source and the first words
  of the next passes, because the pinned guard (`guards/mag-check-quotes.mjs`, hash in `pins`) joins all source files
  into one word stream. This is true today for SRC plus CONTEXT; more sources make it likelier (question 7).

`tests/draft-check-flow.test.mjs` (add):

- A held receipt and a checked receipt made before a capture both read `stale` after it, with the existing
  `staleReason`.
- A check running when a capture lands ends `stale`.

`tests/subject-standing.test.mjs` (add):

- Held for want of a source: "No source to check against yet"; after a capture: "Not checked yet", next step "Check";
  after a real check: "Checked".
- A stale receipt that did compare sources still reads "Check again".

`tests/command-registry.test.mjs` and `tests/prose-saves-human-only.test.mjs` (add):

- `study-draft.capture-sources` is in the registry, section `draft`, `actors:['human']`, no `relay`, no `undo`, and
  `docs/CAPABILITIES.md` lists it.

## Decision 11: the build split

**Piece A** (merge first; touches no file under `public/v2/screens/`):

- `runtime/services/study-draft-copies.mjs` (`captureSources`, `added`, `readOwned`, `inspect`, provenance list)
- `runtime/services/study-draft-checks.mjs` (line 26 only)
- `runtime/services/subject-standing.mjs` (line 325 only)
- `runtime/commands.mjs`, `runtime/server.mjs`
- `docs/CAPABILITIES.md` (generated)
- `tests/study-draft-capture-sources.test.mjs`, `tests/draft-check-flow.test.mjs`, `tests/subject-standing.test.mjs`,
  `tests/command-registry.test.mjs`, `tests/prose-saves-human-only.test.mjs`
- Then the second review stage 6 asks for, by a fresh model whose job is to make Check pass on words no captured
  source supports.

**Piece B** (after A is merged, and only after telling the Write, Read and Check thread
(session_017kitFe2b6MQFZwy3MNMGpN, branch `claude/v2-write-read-check`) and agreeing an order, because it holds
`check.js` and `subject.js`):

- `public/v2/screens/subject.js`: after `keepWithSubject` succeeds (line 779 to 789), the transcript row offers "Use
  it for Check" when the subject has a root draft and the material is reviewed; it reads `first-flow.material-context`
  for the hash and `study-draft.read` for `addedSources.hash`, then calls `study-draft.capture-sources`. For an
  agent page it shows the same "is for Adrian to do" line the transcript row already uses (line 607).
- `public/v2/screens/check.js`: in the held state, where "Capture the source transcript before checking." is said
  (line 43, shown through `heldWhy` line 65), one button with the same call for the subject's eligible attached
  sources; after it, the receipt shows stale and "Check saved draft again" runs a real check.
- `scripts/review-journey.mjs`: step 8 presses the capture where the screen offers it, then Check, and asserts a
  finished result (`kind` `ok` or `review`); `HELD_BREAK` (line 115) goes. Step 8b unchanged.
- `tests/v2-subject.test.mjs`, `tests/v2-check.test.mjs` (the offer appears only when it should; a 403 is said once).
- No change to styles beyond reusing existing classes.

## Decision 12: questions for Adrian

1. **The journey's transcript is not reviewed, and version two cannot review one.** "Use the transcript" keeps a
   transcript as it is (`recordings.mjs` `registerSource`, line 107); confirming it needs every speaker named in the
   recording workshop, which only the existing workspace has; the walk's transcript is `unreviewed` (line 87 of the
   walk). So under "reviewed only", step 8 cannot end in a result without leaving version two. Choose: (a) let his
   own press capture an unreviewed transcript, recorded as unreviewed in the entry; (b) keep reviewed only and add
   "Confirm this transcript" to version two, which needs naming speakers there; (c) keep reviewed only and let the
   walk confirm it in the existing workspace, a counted break. Recommendation: (b) later, (c) now, so Check never
   trusts a transcript he has not confirmed.
2. Should an unanswered person on the consent desk stop a source being used for Check? Recommendation: no; the hold
   stays on every way out of the piece, as now.
3. Should he be able to stop a captured source counting (a set-aside or wrong recording)? Recommendation: yes, later,
   as an appended "no longer used" entry, never by deleting; until then a set-aside source keeps counting, and Check
   shows one quiet line when a used source changed in the Library.
4. Should a draft opened from a vault original also accept added sources? Recommendation: not now; it already reads
   its original's SRC, and the editorial plan reader compares its sources with the original.
5. Should a Carousel made from a New subject be checkable from the same captured sources? Recommendation: a separate
   piece; Carousels keep their own source snapshot today.
6. Should marking material reviewed be his alone (`first-flow.source-review` and transcript review are open to
   assistants today)? Recommendation: yes, as its own small change.
7. Should the pinned quote guard match each quote inside one source, not across two joined files? Recommendation:
   yes, as a separate reviewed change to the guard and its pin.
