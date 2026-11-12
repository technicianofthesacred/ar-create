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
  refusal, `study-project-material-context.mjs` line 31, "Selected parent material is missing, unreadable or
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
| `study-editorial-plan-context.mjs` lines 28, 33, 38, 48, 69 to 72 | no | it **fails closed** on any non-draft record an authored root without `collectionSource` holds (line 49), and on any record not in the vault original (line 70); a merge would stop assistance on every captured subject |
| `study-mcp-bridge.mjs` lines 342, 351, 353 | no | the same material already appears there as attached parent material; it would be listed twice, as a retained capture and as attached material (line 351 itself would not trip, because the added record's `id` starts with `added:`; corrected in review) |
| `study-research-sources.mjs` line 6 | no | the material is already allowed through `firstFlow.materialContext` (line 8) |
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
`study-editorial-plan-context.mjs` line 38 to 49 then refuses. It also keeps one edge safe: a fork or structure test whose
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

- `public/v2/screens/subject.js`: after `keepWithSubject` succeeds (line 781 to 789), the transcript row offers "Use
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

## Review, 12 November

Independent review, by a reader who did not write the brief. Every cited file and line was opened. Nothing was run:
this machine has no installed dependencies, so each finding is read from code and says so where a run is needed.
Six plain citation errors were corrected in place above (the material authority's refusal is line 31, the editorial
plan reader's refusal is line 49 and its range 38 to 49, the research sources line is 8, `keepWithSubject` starts at
line 781, and the research bridge reason was reworded). All other citations were found correct.

**Verdict: build with the corrections.** The storage design holds: a separate append-only file, the locked record
untouched, Check as the one reader. The faults are at the edges: the material authority it leans on cannot serve
the subject this is for, and the "reviewed" it trusts can be set by an assistant today.

### Must fix

1. **The material authority refuses the very subject this is built for.** Proof:
   `runtime/services/study-project-material-context.mjs` lines 12 to 20 and 27. `context()` needs a saved part
   connection under the key `owned-draft:<bindingId>`; without one, a draft that is not an output fork is refused
   at line 20 ("The selected child has no exact persisted root material owner."). That connection is made only by
   `first-flow.select` (`runtime/commands.mjs` line 529), which the existing workspace calls
   (`public/document-study/output-connection.js` line 199). New subject makes only the parent connection
   (`runtime/server.mjs` line 285, `createStudyCollection`), and nothing under `public/v2` calls `first-flow.select`.
   So on a subject begun in version two, Decision 3's call ends 409 before anything is copied. The brief's service
   tests use a fake material authority and would not see it. Correction: give the authority a parent-only method
   that shares lines 28 to 31 (parent connection, `firstFlow.materialContext`, the same eligible and reviewed
   test) and takes no part connection, and have capture call that. Do not create the part connection as a side
   effect of capture. Piece A's HTTP test must make its subject exactly as `home.js` line 488 does, with no
   `first-flow.select`, and attach through `study.material.attach`. Read from code, not run.

2. **"Reviewed" can be set by an assistant, with no record of who set it, so his one press can turn
   assistant-written text into a trusted source.** Proof: `first-flow.source-review` is open to any actor
   (`runtime/services/first-flow.mjs` lines 236 to 244; `docs/CAPABILITIES.md` line 397, "any"); its
   `humanDecision:true` is a field the caller types, not a check, and `operation()` (line 216) stores no actor.
   `first-flow.prepare` (line 249, "any") also marks a source reviewed from a caller's `sourceReviews`. For
   recordings, `POST /transcription/{id}/segment`, `/speakers` and `/review` are all open
   (`runtime/services/recordings.mjs` lines 153 to 156; `transcript-corrections.mjs` lines 162 and 163;
   CAPABILITIES line 472, "any"), and none records an author. Chain today, all assistant-callable:
   `sources.import` (any) a file of invented words, or rewrite a real transcript's segments; attach it
   (`study.material.attach` or `first-flow.attach`, any); mark it reviewed. The material then reads `eligible`,
   `review.state:'reviewed'` and the capture button appears. A rewritten transcript is captured with role
   `source`, the primary. Decision 8 calls this "noticed, not part of this piece" and question 6 defers it; it
   cannot be deferred, because capture is the first thing that turns "reviewed" into what Check trusts.
   Correction, in piece A: refuse a non-human actor inside `reviewSources`, inside the `sourceReviews` branch of
   `prepare`, and for the `review` action of the recording route (in the service, the way `registerSource` does at
   `recordings.mjs` line 108; the route pattern `/transcription/{id}/{action}` is one command, so the registry's
   `HUMAN_ONLY` set cannot single out `review`). Stamp `provenance()` on each review. Reviews made before that have
   no author: the capture entry must record `review.by` as unknown for them, and the screen must say so. An
   assistant editing a transcript already resets it to unreviewed (`transcript-corrections.mjs` lines 46 and 162),
   so once review is his alone the chain is closed.

3. **The brief does not say what he sees before pressing, and Check's held-state button captures every eligible
   source in one press.** Proof: Decision 11 piece B ("one button with the same call for the subject's eligible
   attached sources"); nothing in `public/v2/screens/check.js` lists sources (its only source wording is line 43),
   and the subject row shows a title and the word "Transcript" (`subject.js` line 610). The press is the only
   human gate, so it must name what it trusts. Correction: the control lists each source it will copy by title,
   kind, length, when it was reviewed and by whom (or "not recorded"), and who attached it; it captures only the
   ones listed and ticked; nothing is captured that he was not shown. After capture, Check's "Check details and
   saved proof" names the captured sources the result rests on (from `addedSources.records`, title and date).

4. **Under "reviewed only" the stage's finish line cannot be reached, and the brief leaves that to a question.**
   Proof: `scripts/review-journey.mjs` lines 84 to 87 (one speaker with `name: null`, review `unreviewed`);
   `reviewed()` at `first-flow.mjs` line 47; `reviewEligibility` at `runtime/services/magazine/outputs.mjs`
   line 10. Answer below ("The reviewed only rule"). Piece B is not done until the walk confirms the transcript
   inside version two.

### Should fix

5. **Only a recording transcript unlocks Check.** `perform()` holds unless a record has role `source`
   (`study-draft-checks.mjs` lines 180 and 181), and Decision 3 gives role `source` only to `kind==='transcript'`.
   "In plain words" promises "a transcript or note". A subject whose only material is a typed or pasted
   interview captures it as `context`, and Check stays "No source to check against yet" after he pressed "Use it
   for Check". Correction: either let him mark one captured non-recording source as the source of the quotes
   (recorded in the entry, his choice), or have the control say plainly that a note alone will not let Check run.

6. **Decision 9 changes the standing sentence on subjects that have no capture, and can send him to a Check that
   holds again.** `subject-standing.mjs` line 325. Today a held, no-source receipt goes stale as soon as he types
   (the proof's `draftHash` changes) and reads "Check again". With the proposed lines it reads "Not checked yet"
   and leads as Check, though there is still no source and the check will hold again. Correction: decide by what
   the draft has now. If the stale receipt never compared a source and the draft read (`read.context.records` plus
   `read.addedSources.records`) still has no role `source`, report held with `noSource:true` ("No source to check
   against yet"); only when a source now exists report `status:null` ("Not checked yet"). This is a wording change
   Adrian can see on Home and the subject page, so it needs a before and after picture even though it is in
   piece A.

7. **Pressing twice from a stale page is refused instead of settled.** Decision 1 lists both "already captured at
   the same hash: listed in `alreadyCaptured`" and "`null` when a record exists: 409". A second press with a new
   operation ID and the old `expectedSourcesHash` (double click, second tab) gets 409 for a request that would
   change nothing. Correction: state the order. First the operation ID replay; then, if every requested source is
   already captured at the same `copiedHash`, return 200 unchanged whatever `expectedSourcesHash` says; only then
   compare the hash. All entries of one call are appended in one atomic write.

8. **An operation ID can collide with the draft's own operations.** `inspect` (`study-draft-copies.mjs` line 249)
   and the provenance ledger (line 241) are both keyed by binding and operation ID. The brief checks the ID only
   against earlier capture entries. Correction: refuse (409) an operation ID that `owner(b).inspectOperation`
   already knows, or that equals `b.operationId` or `b.prepareOperationId`.

9. **A damaged added-sources file blocks Check for good, with no way back.** Decision 2 makes Check refuse and
   capture refuse (the first write is `exclusive`, later ones need a valid file). Correction: say what the way
   back is before building: a human-only, explicit "start the captured sources again" that moves the damaged file
   aside under a dated name and never deletes it, or a named manual step in the brief. Test that Write still saves.

10. **The cross-source quote match becomes the normal case.** Confirmed at
    `runtime/services/guards/mag-check-quotes.mjs` lines 37 to 40: the primary and every other file are joined
    into one word list, and up to four source words may be skipped between kept words (line 28), so a quote can
    start at the end of one source and finish at the start of the next. Today few drafts have two files; after
    capture, a transcript plus a note is ordinary. Also only the primary is cut to its "## Full Transcript" part
    (line 38), so a second captured transcript's heading, front matter and speaker names are matchable words.
    Correction: do question 7 (match each quote inside one source; cut every transcript to its transcript part)
    as a reviewed change to the guard and its pin before piece B lets him press, not after.

11. **Piece B is larger than it needs to be.** Two screens would each read `first-flow.material-context` (which
    needs the parent's project id, `commands.mjs` line 530) and `study-draft.read`, join them, and build the call.
    Correction: piece A adds one read, `GET /api/study-draft/capture-sources?bindingId&parentStudyId`, returning
    what can be captured (title, kind, hash, length, review and its author, attached by, already captured or not)
    and the current `sourcesHash`. Piece B puts the list and the press in one small shared file under
    `public/v2/shell/` with its own test, and `subject.js` and `check.js` each gain one call to it. The thread
    restyling those screens then has one line to carry in each.

12. **Size.** `readOwned` returns `raw` for every record, so 20 sources of 2 MB each would ride on every
    `study-draft.read`, including the read Write makes. `mcp/study/server.mjs` line 23 strips `context` from what
    assistants are sent but would pass `addedSources` through whole. Correction: cap the total (for example 4 MB
    across all current entries, 413 beyond), and strip `addedSources` to ids, titles and hashes in the assistant
    listings in piece A.

### Notes

13. **Confirmed: the locked record stays byte-identical and old records validate as before.** `capture()`
    (`study-draft-copies.mjs` line 32) and root recovery (`study-root-recovery.mjs` lines 95 to 108) read only
    paths named in the manifest; neither lists the capture folder, and no validator under `runtime/` does. Root
    recovery hashes the intent file (line 133), which the design does not touch. Fork, structure-test and
    collection seeds are built from `context.records` only (lines 60, 124, 144) and pinned in their own files.
    Check receipts compare `proof` only (line 195).
14. **Confirmed: a blanket merge into `context.records` is unsafe.** `study-editorial-plan-context.mjs` lines 38
    and 49 refuse an authored root that holds any non-draft record without a `collectionSource`, which would stop
    assistance on every captured subject. The research bridge reason was wrong as written and is corrected in the
    table: line 351 would not trip; the material would simply be listed twice.
15. **Confirmed: a receipt made before capture reads stale, never passed.** `read()` (line 195) rebuilds the proof
    through `evidence()`; a capture adds to `proof.sources`, so `same()` fails and the status is forced to
    `stale`. `check.js` line 28 treats stale as not current. A capture landing during a check is caught at
    line 188.
16. **Other readers.** Truth and consent does not read sources (agreed with Decision 3). Read does not. Carousels
    read role `source` from their own snapshot (`native-carousel-make.mjs` line 35), and a Post or a second
    Article is an output fork (`native-output-owner.mjs` lines 368 and 369) seeded from the locked capture, so on
    a New subject both stay "No source to check against yet" after capture. Question 5 covers Carousels only; add
    forks to it.
17. **A draft with no quotation marks reads "Checked" against any source.** The guard returns `not-applicable`
    and `perform()` line 186 maps that to `checked`. True today; after capture it will be seen on New subjects.
    Worth one honest line on the Check screen later ("No quoted words to compare").
18. **His own draft attached as material.** Nothing stops him capturing a file that holds the draft's own words,
    after which every quote matches. With finding 2 fixed only he can do it. A cheap guard: refuse a source whose
    bytes equal the draft's saved text.
19. **Human-only is a stated name, not a proof.** `runtime/services/actor.mjs` (comment above line 16) says the
    gate cannot stop a local process that calls itself Adrian, and the page defaults to `human:adrian` unless
    opened with `reviewActor`. This is true of every human-only command and is not made worse here.
20. **Interrupted run retried under a new operation ID** leaves an unnamed copy in `capture/`. Harmless (nothing
    lists the folder); say so in the brief so nobody later "cleans" it into a validator.
21. **423.** An assistant holding the draft's lease blocks his press, although capture does not touch the draft.
    Acceptable; the screen should say who holds it, as Write does.

### The "reviewed only" rule

Keep it; do not let a press capture an unreviewed transcript (option a would make the press mean "I have not
read this"). The commands that mark material reviewed are: for a recording transcript,
`POST /transcription/{id}/review` with `{expected, confirmed:true}` (`transcript-corrections.mjs` line 163), which
refuses until every speaker is named (`/speakers`, line 162) and no segment is unattributed; for other material,
`first-flow.source-review` (`first-flow.mjs` lines 236 to 244). Both are open to any actor today (finding 2).

The smallest honest way for the whole journey to work inside version two needs no new server command for the
review itself. Version two already reaches the recording route through the registry
(`.transcription.id.action`, `subject.js` line 739) and already reads the transcript's proof
(`transcript-check.id`, line 738). So, in piece B's shared file: the transcript row gains "Confirm this
transcript", which shows the transcript's words and speakers in place, asks for a name for each unnamed speaker
(one field for a Speak recording), and on his press calls `speakers` then `review` with `confirmed:true` and the
`expected` he was shown. Confirming rewrites the transcript file's review line, so its hash changes: confirm
first, then "Use the transcript", then "Use it for Check", or re-read the hash between presses; the walk must
prove the order. With finding 2 in piece A, an assistant's page shows the "is for Adrian to do" line instead.
The walk then types the speaker's name, confirms, and step 8 ends in a real result with no break and no visit
to the existing workspace. This is option (b), and it is small enough to do now rather than later.

## Code review of piece A

Independent, adversarial review of branch `claude/v2-capture-sources-a` (the build commit "Capture sources, piece A"),
12 November. Everything below was run, not only read: the service with a fake material authority, a real test server
over HTTP, and `npm run demo` on port 8854 (invented data; 8841 was never touched). Demonstrating tests are in
`tests/study-draft-capture-sources-review.test.mjs`. A test marked `todo` there states the corrected behaviour and
fails today; it starts passing when the correction lands. Line numbers are from the build commit.

**Verdict: merge after corrections.** The storage design is built as briefed and holds under attack: the locked
record and binding file stay byte-identical, the added record fails closed, the command is refused to every assistant
at the gate and in the service, and nothing else writes the record. The one must-fix is the hole the design review
already named (its finding 2), which the build left open, and which this review measured end to end.

### Must fix

1. **An assistant can make Check pass on words it wrote; Adrian's one press is the only human step, and the list he
   is shown cannot tell.** Files: `runtime/services/study-draft-copies.mjs` line 290 (`role:r.kind==='transcript'?
   'source':'context'`) and line 326 (the same rule in the list); `runtime/services/first-flow.mjs` line 236
   (`reviewSources`, open to any actor; `humanDecision:true` is a field the caller types);
   `runtime/services/wordforge-sources.mjs` line 54 (front matter `kind: transcript` makes any Markdown file a
   "transcript"). Proof: test "an assistant cannot make Check trust words it wrote" (todo), and the same chain run on
   the demo: as `agent:codex`, `sources.import` a Markdown file with `kind: transcript` front matter and an invented
   sentence (200, kind `transcript`); `study.material.attach` (200); `first-flow.select` (200);
   `first-flow.source-review` with `humanDecision:true` (200). The list then shows it as `kind:'transcript',
   reviewed:true, eligible:true, role:'source', review.by:'not recorded'`. Adrian presses once (200, captured as role
   `source`, the primary), his draft quotes the sentence, and Check returns `checked`. Nothing in the chain is a
   recording or a person. Correction, both parts, in piece A: (a) do the design review's finding 2: refuse a
   non-human actor inside `reviewSources` and in the `review` action of `/transcription/{id}/review`
   (`recordings.mjs` line 156; read from code, not run), and stamp `provenance()` on each review so `review.by` can
   name him; (b) give role `source` only to a canonical recording transcript
   (`r.review?.basis==='canonical-recording-review'`, which `first-flow.mjs` line 98 sets only when the transcript is
   managed by its recording), never from the file's own `kind`; everything else is `context`. (b) alone stops an
   invented file becoming the primary even before (a) lands. The `prepare` branch is already human-only
   (`first-flow.mjs` lines 184 to 193), so the design review's mention of it needs no change.

### Should fix

2. **The quote straddle (the builder's `test.todo`).** Answer: yes, it is reachable today on old drafts. Test "the
   straddle already passes on an old draft" (passes, pinned) opens a vault copy whose locked capture holds an SRC and
   a CONTEXT; a quote made of the SRC's last words and the CONTEXT's first words reads `checked`. The guard
   (`guards/mag-check-quotes.mjs` lines 37 to 40) joins every file into one word list and allows four skipped words
   at the join. Piece A does not make it worse for old drafts (they cannot take a capture) but makes it ordinary on
   new subjects, where a transcript plus a note is the usual set, and every non-primary file is matched whole
   (headings and titles included, not cut to "## Full Transcript"). Serious enough to fix before piece B lets him
   press; not a blocker for merging A, since it needs a writer to quote across two files and assistants cannot save
   prose. Smallest fix that leaves every old draft's result unchanged, with no change to the guard or its pin: in
   `perform()` (`study-draft-checks.mjs` lines 181 to 186), when the draft has no added records, call the guard
   exactly as today. When it has, call it once with the locked files exactly as today (if the locked capture has a
   `source`) and once per added file with that file alone as the SRC argument, and count a passage NOT FOUND only
   when every run reports it (bracket and unsupported counts do not depend on the source; take them from any run).
   Each added transcript is then also cut to its transcript part. The split guard keeps using the primary. Test:
   "a quote straddling the join of two captured files does not pass" (todo).

3. **Every draft read now carries the full text of every added source.** `readOwned` (`study-draft-copies.mjs`
   line 255, `addedForRead` keeps `records` with `raw`) returns up to 4 MB on every `study-draft.read` and in the
   reply to every Write save; `added()` (line 241) also reads and hashes every superseded copy on every read, and
   the 4 MB cap (line 297) counts only the latest copy per source, so recaptures grow the per-read cost without
   limit. Proof: test "a draft read does not carry the full text of added sources" (todo); on the demo the read
   returns `raw`. The assistant listings strip it, but `ar_create_call study-draft.read` and the CLI's `draft read`
   do not. Correction: keep `raw` out of the read shape (ids, titles, hashes, `copiedPath`) and let `evidence()`
   read the copy from `copiedPath`, which it already does and re-hashes.

4. **The list says a captured source is "not used" when Check still reads it.** `study-draft-copies.mjs` line 325
   puts `setAside` before the captured case, so a source captured and then set aside reads "You set this aside, so
   it is not used." while Decision 6 keeps it counting. Proof: test "the list does not say a captured source is
   unused while Check still reads it" (todo): the same draft's Check passes on it and its proof names it. Piece B
   would show this sentence. Correction: test `have` first; for a captured source say it is used for Check, and add
   "set aside since" or "changed in the Library since" when that is true.

5. **`parentContext` is not needed, and is a second way in that skips a check.**
   `study-project-material-context.mjs` line 38. The builder's own HTTP test notes, and `runtime/server.mjs` line 285
   shows, that New subject already makes the `owned-draft:<bindingId>` connection (through
   `studyOwnedPhotoBindings.select`), so the existing `context({bindingId,parentStudyId})` serves a subject begun in
   version two. It does not loosen which materials belong to which subject: on the demo, capturing material attached
   to subject B into subject A's draft is 400 ("Selected parent material is missing, unreadable or unreviewed."), and
   naming A's draft under B is 409 ("belongs to a different parent study"). It does skip the part connection and the
   "rooms must remain distinct" test. Correction: call `context()` and remove `parentContext`, or keep it with a test
   that it refuses wherever `context()` refuses.

6. **No way back from a damaged added-sources file** (design review finding 9, still open). Check and capture both
   refuse for good, and the list says the sources "need repair" with no repair to point to. Write still saves
   (confirmed). Correction: name the manual step in this brief now; a human-only "start the captured sources again"
   that moves the file aside under a dated name, later.

### Notes

7. **Confirmed refused to every assistant.** 403 at the gate and in the service for `agent:codex`,
   `agent:claude-code`, `agent:chatgpt`, `cron:*` and an unattributed in-process call; over HTTP, with an `actor`
   field added to the body, through the worktree CLI (`call study-draft.capture-sources`), and an assistant replaying
   Adrian's operation ID with other sources: all 403, nothing written. MCP over STDIO is covered by the builder's
   registry test (passes). The actor header is self-declared (`actor.mjs`), as for every human-only command.
8. **Confirmed fail closed.** A truncated, emptied, directory, symlinked or re-attributed `added-sources.json` reads
   as `{error}`, Check refuses 409, Write still saves (test, passes). With the file absent, Check falls back to the
   locked capture, which can only lose sources, never gain them.
9. **The chain has no secret.** A writer with file access who recomputes it, even with `actor:'agent:codex'`, is
   read as genuine (test, passes). This is the locked manifest's strength too, as the brief says, but the builder's
   forged-record test uses wrong hashes only, so it reads stronger than it is. Cheap extra: refuse an entry whose
   `actor` is not in `HUMAN_ACTORS`.
10. **423 cannot happen here.** `leases.check` lets Adrian override an assistant's lease (`leases.mjs` lines 66 to
    70), and only Adrian may call the command; on the demo, a capture under an assistant's draft lease is 200. The
    brief's "423" line is wrong; nothing to build.
11. **The own-draft guard matches exact bytes only** (line 291); one changed character passes it. Acceptable once
    finding 1 is fixed, since only Adrian could then make such a source eligible.
12. **Idempotence, races and crashes hold.** Same operation and input: unchanged; different input: 409; two
    presses at once (service and demo): one record; a crash between copy and record, retried with the same operation
    ID: completed once; a leftover copy with other bytes: kept and refused. Activity recovery reads the capture
    receipt (`committed` with `after.hash`), and a refused call settles its outbox entry.
13. **Other changes: no behaviour change found for existing screens or agents.** `setAside:true` on
    `first-flow.materialContext` changes that context's hash only for projects with a set-aside item; no consumer
    pins it across calls (the assistant bridge re-selects eligible records, which never carry the field; the
    workspace's moves reader and the footage scope ignore it). `has()` on relocation is read-only. The standing
    change applies only to a stale receipt that never compared a source on a draft that now has one; an old draft
    cannot reach it. The two assistant listings add `addedSources` (ids, titles, hashes) only when the file exists.
    `docs/CAPABILITIES.md` is unchanged by `npm run build`, so it was generated.
14. **Tests run.** The four test files the diff touches (59: 58 pass, 1 todo); 22 test files for the services it
    changes (169 pass); seven more that use the assistant draft-read tools (59 pass); the review file (3 pass, 4
    todo). Nothing failed, so nothing needed a rerun alone.

## Second code review of piece A

Second independent, adversarial review, of branch `claude/v2-capture-sources-a2` (piece A with the first review's
corrections), 12 November. One goal: make Check say "checked" on words that no source a person confirmed supports,
acting only as an assistant plus one honest press of the capture button by Adrian on whatever the list shows as
eligible. Everything below was run unless it says "read from code": the services with a fake material authority, a
real test server over HTTP, and `npm run demo` on port 8854 (invented data; 8841 was never touched). Demonstrating
tests are in `tests/study-draft-capture-sources-review-2.test.mjs`; a test marked `todo` states the corrected
behaviour and fails today. Line numbers are from the a2 branch.

**Verdict: merge after corrections.** The goal was not reached as an assistant: the reviewer stamp, the role rule, the
hash checks at the press, the stale receipts and the fail-closed record all held against every attempt listed under
Notes. One fault in the new per-file quote check does make Check say "checked" on an invented quote, but it needs a
particular draft, which an assistant cannot write. It is listed as must-fix because it turns a held result on main
into a passing one and the correction is two lines.

### Must fix

1. **A quote-check run that dies on one captured file is read as "every quote found there", so Check passes.**
   `runtime/services/study-draft-checks.mjs` lines 52 to 56 and 64 (`quoteRuns`). A passage counts as not found only
   when every run printed a `NOT FOUND:` line for it, and nothing checks that a run finished. The pinned guard
   recurses once per quoted word (`guards/mag-check-quotes.mjs`, `match`), so a single quoted passage of about 9,000
   words that does match one file overflows the stack in that file's run: exit 1, a stack trace, no `NOT FOUND:`
   lines. If that run is not the first, every other quote in the draft is counted as found. Proof: test "a guard run
   that dies on one captured file does not turn every quote into found" (todo): two captured files, a 12,000 word
   passage taken from the second, then an invented sentence; with one file captured Check reports both
   (`needs-review`), after the second capture it returns `checked`, "2 of 2 quoted passages found". The guard alone:
   exit 1 with `RangeError: Maximum call stack size exceeded` at 9,000 words, clean at 6,000. On main, and here when
   the dead run is the first or only run, the result is `unsupported` and Check is held (test "the same dead run as
   the first run is held", passes). Reach: it needs that long passage in the draft, and assistants cannot save prose,
   so this is not reachable by an assistant plus one press; a person would have to paste or accept it. Correction, in
   `quoteRuns` only: treat a run as valid only when its exit code is 0, 1 or 2 from the guard's own exit and its
   output has the "N of M quoted passages found" line with the same M as the first run; otherwise return that run's
   output and exit code unchanged (which reads `unsupported`, held), or throw so the record is `failed`. Never merge a
   run that has no summary line.

### Should fix

2. **A review made before this change now reads with two new fields, which makes waiting assistant suggestions
   stale.** `runtime/services/first-flow.mjs` lines 51 and 114: `reviewStamp` returns `{by:null, at:null}` when there
   is no stamp, and a recording's `review` always gains `by` and `at`; `runtime/services/transcript-corrections.mjs`
   line 144 adds `reviewedBy` (null for an old review) and `reviewedAt` to every reviewed transcript snapshot, which
   line 114 copies whole into `review.transcript`. The assistant bridge pins the selected material records when a
   suggestion is requested and compares them exactly at review and acceptance
   (`runtime/services/study-mcp-bridge.mjs` lines 179 to 182, called from `contextFreshness` line 281; read from
   code, not run end to end). So every suggestion that was requested with attached material before this release and
   is still waiting would be refused as "Selected parent material revision or exact review changed". Proof of the
   shape change: test "a review made before reviews were stamped reads with the same shape as before" (todo). The
   first review's note 13 covered `setAside` only. Correction: add `by` and `at` (and `reviewedBy`, `reviewedAt`)
   only when a stamp exists; an old record then reads byte for byte as on main, and `confirmedByHuman` already
   treats a missing `by` as not confirmed.

3. **An assistant can take Adrian's confirmation away.** `first-flow.mjs` lines 247 and 251 (`stampReview` on every
   review, whoever calls) and `transcript-corrections.mjs` line 165. An assistant that reviews the same bytes after
   him replaces his stamp with its own; the material then reads "Not confirmed by you yet" and the press is refused
   until he confirms again. It gains nothing, and a captured copy is not affected, but it can keep undoing his step.
   Proof: test "an assistant reviewing the same bytes after Adrian does not remove his confirmation" (todo); the
   same on the demo and, for a recording, in the pinned recording test. Correction: when the bytes already carry a
   person's stamp at this hash, a later review by anyone who is not a person leaves the stamp as it is (first-flow:
   skip `stampReview`; transcript: keep `review.by` and `reviewedAt` when the revision is unchanged).

4. **Words inside a comment in a captured note count as support.** `study-draft-checks.mjs` line 51: each captured
   file is the guard's first argument in its own run. The guard removes Obsidian comments (`%% ... %%`) only from
   its extra files, so on main a CONTEXT file's comments never support a quote, and here a captured note's do; the
   note's headings and title count too, as the first review said. Proof: test "words inside a comment in a captured
   note support a quote" (passes, pinned). He confirmed those bytes, so nothing unconfirmed gets in; it is a quiet
   difference from how the same kind of file is read on an old draft. Correction: strip `%%` comments from a captured
   `context` file before it is written to the check snapshot, or accept it and say so in Decision 3.

### Notes

5. **The reviewer stamp cannot be written by an assistant.** Tried over HTTP and on the demo: `by`, `actor`,
   `reviewedBy` or `metadata.review.by` typed into the body of `first-flow.source-review` (400, unknown key) and of
   `/transcription/{id}/review` (200, ignored, stamped as the assistant); a replay of Adrian's own review operation
   by an assistant (answers, changes nothing, stamp stays his); `chat` relay with `said` on the capture command (403).
   Read from code: `flow.json` gets `reviews` and `reviewedBy` only at `first-flow.mjs` lines 238, 247, 251 and 253,
   always from `provenance()`; no import, merge, concept save or file command writes it; the study research path
   stamps the caller, so an assistant stand-in is stamped as the assistant. Tests "an assistant cannot write the
   reviewer stamp on a note" and "an assistant cannot change a recording transcript after Adrian confirmed it" (pass).
6. **The stamp does not outlive the words.** After Adrian confirms a recording transcript, an assistant's segment
   edit clears the review (the list shows not reviewed, a new hash), its `speakers` call clears it even when no name
   changes, and its own review is stamped as its own; a press with the hash he was shown and with the new hash are
   both refused. Every writer of a transcript goes through `apply` or `speakers`, which reset the review; the older
   route in `magazine/jobs.mjs` writes a review with no `by`. For a note, changed bytes give a new hash, and both
   `reviewed()` and the stamp are tied to the hash. A second import of the same file name makes a new Library item
   and leaves the confirmed one as it was.
7. **Role `source` cannot be earned by a file.** It needs `basis: canonical-recording-review`, which needs a
   transcript in the recordings folder whose job file names that folder and whose JSON and Markdown match the last
   published pair. Keeping a recording as a source is his alone (403 for an assistant, tested). A note he confirmed
   is `context`; with only context files Check stays held ("No captured SRC available.", demo).
8. **The press compares bytes.** `sourceHash` is compared with a fresh read (409 or 400 on any change between the
   list and the press); the copy is taken from that same read; the list and the command use the same two functions
   for eligibility and role, so the list never showed eligible for something captured with another role. The list
   can say eligible where the press still refuses (the draft's own words, the 4 MB total): safe direction.
9. **Receipts.** A held receipt reads stale after the first capture and a passing one reads stale after a second
   capture (test, passes). Capturing a source again at bytes it had before makes an older receipt for those same
   bytes read current again, which is correct. `study-draft.check` called again with an old operation ID returns
   the stored record without the stale test; that is how main behaves, and the standing reads through `read`, which
   does test. The standing passes `stale` and `held` through unchanged; only "held, never compared, source now
   present" becomes "Not checked yet".
10. **Old drafts are identical to main.** A draft opened from a vault original (locked SRC and CONTEXT, eight
    paragraphs: found, not found, bracketed, cut, comment words, heading words, straddle) gives byte-identical quote
    output, split output, issues, proof and read keys on this branch and on a copy of `origin/main`.
11. **Draft read and Write save replies carry no added-source text** (demo: ids, titles, hashes, paths, lengths).
12. **Trivially short and bracket-only quotes pass, as on main.** A one-word quote passes against any file that
    holds the word, and a quote made only of bracketed phrases passes against any file with enough words (test,
    pinned). This is the pinned guard, unchanged, and the receipt already says bracket intent is not verified.
13. **The actor is a self-declared header for the whole app.** This command is no easier to spoof than the other
    human-only commands: the same gate, plus a second check in the service that also refuses an absent actor. A
    request with no actor header and an `Origin` header naming the app is read as Adrian for every command (demo:
    capture and Write save both pass the gate that way).
14. **Tests run.** The new review file (9: 6 pass, 3 todo). 64 test files that use the changed services, plus the
    four the diff touches (653 tests: 645 pass, 3 skipped, 3 todo, 2 fail). The two failures were run alone and fail
    the same way; neither touches this change: `native-language-edition.test.mjs` needs a headless renderer this
    machine lacks, and `native-language-proposal-owner.test.mjs` fails identically on a copy of `origin/main` here.

## Piece B, as built

Piece B is the smallest self-contained change, kept in marked blocks so the thread restyling these screens can carry it.

- `public/v2/screens/subject.js` (blocks marked "capture sources"): the recording's row offers "Confirm this transcript" when the transcript is ready and not confirmed by him. It opens in place with the words (read only, in the speech face), one name box per unnamed speaker and a primary "Confirm"; Confirm calls the recording's own `speakers` then `review` actions through `.transcription.id.action` as the page's actor, and the row then says "Confirmed by you". The words and the speakers are read with the same command's `recover` action, which only returns the transcript's current snapshot (the registry has no plain read of it). Once the transcript is kept and confirmed, the list from `study-draft.capture-sources.list` is shown (title, kind, "Confirmed by you"; what is not eligible with the list's own reason) with one primary "Use it for Check" that sends exactly the eligible ones shown to `study-draft.capture-sources`; on success "Check can now read this". The list is read again after every confirm and capture, so either order works.
- `public/v2/screens/check.js`: when the check is held only for want of a source, the same list and button are drawn below the sentence (through `v2.shared.subject.createCaptureSources`, read when the screen opens; without it Check does without). With nothing eligible it shows the reasons and a link back to the subject; a damaged record shows the list's sentence and no button. After a capture Check reads the draft and the receipt again and runs by itself.
- An assistant's page has every control; pressing shows the refusal and nothing is faked.
- `scripts/review-journey.mjs`: step 4 confirms the transcript and presses "Use it for Check"; step 8 asserts a real result (the held break is gone); step 9 no longer expects the held wording.
- Tests: `tests/v2-subject.test.mjs` and `tests/v2-check.test.mjs`.
