# Stage 7: confirming is his alone, and a captured source can be stopped (design brief)

Design only. Nothing here is built. Written 12 November 2026 against `main` (branch
`claude/v2-confirm-his-alone-stop-source`, equal to main). Line numbers are from that commit; re-find them before
editing. Builds on `v2-12-capture-sources.md` (stage 6): read its Decisions 1, 2, 6 and 8 and its five reviews first.

## In plain words

Only Adrian can mark material or a transcript reviewed. An assistant that tries, by any button, command or route, is
refused with a plain sentence and nothing is written. Everything else an assistant does today still works: preparing
research, naming speakers, correcting segments, withdrawing a review. On the Sources list (subject page and Check)
each source Check reads gets one quiet control, "Stop using for Check". Pressing it adds one line to the same
append-only record; nothing is deleted. Check stops reading that source, an earlier result reads out of date, and if
no source for quotes is left Check waits with "No source to check against yet".

## What marks reviewed today (measured from the code)

| path | file and line | who today |
| --- | --- | --- |
| `first-flow.source-review` (`reviewed:true`) | `runtime/services/first-flow.mjs` 240 to 247; route `runtime/commands.mjs` 536 | any actor |
| `first-flow.prepare`, plain branch: `sourceReviews` | `first-flow.mjs` 252 to 253 (`f.reviews[id]=s.hash; stampReview`) | any actor |
| `first-flow.prepare`, study scope branch (`study.research.brief.prepare`) | `first-flow.mjs` 188 to 199 and 251 | human with proof; an agent only as stand-in on a registered structure-test copy |
| `POST /transcription/{id}/review` | `transcript-corrections.mjs` 165; dispatched `recordings.mjs` 172; registry is one entry for every action, `commands.mjs` 180 | any actor |
| older Magazine route `review` | `runtime/services/magazine/jobs.mjs` 229 to 231 | unreachable: `recordings.mjs` 163 to 197 answers every `/review` POST first |

Callers that press these: the existing workspace (`public/document-study/stage-flow.js` 117, the "Use this source"
box sends `first-flow.source-review`; 115, "Analyze" and "Prepare" resend `sourceReviews` from the tab's local list;
115, "Review and save" posts `/transcription/{id}/review`), the recording workshop page
(`magazine/workshop-ui.mjs` 189, "Mark reviewed", which sends no `expected` and so is refused 409 for everyone today
by `checkExpected`, `transcript-corrections.mjs` 119), and version two's "Confirm this transcript"
(`public/v2/screens/subject.js` 662 to 680: `recover`, `speakers`, then `review`).

Not marking reviewed, already his: setting material aside and restoring it (`first-flow.material-triage`, in
`HUMAN_ONLY`, `commands.mjs` 218); keeping a recording as a source (`recordings.source`, `recordings.mjs` 122);
capturing for Check (`study-draft.capture-sources`, 218 and `study-draft-copies.mjs` 265).

A hole found while reading: the existing workspace adds the tab's actor only to `/api/` requests
(`public/document-study/review-mode.js` 14 to 15). Its `/transcription/` POSTs carry no actor header, and a request with
the app's own Origin and no header is read as Adrian (`runtime/services/actor.mjs` 92 to 93). So an assistant driving
that page with `?reviewActor=agent:codex` and pressing "Review and save" is stamped `human:adrian` today.

## Decision 1: `first-flow.prepare` stays open; only adding a review is refused, with 403 for the whole call

Found: the plain branch writes a review for any `sourceReviews` entry whose source is not a recording transcript and
whose hash is the current one (`first-flow.mjs` 253), then refuses if the source is still unreviewed. The existing
workspace resends every locally ticked source on every "Analyze" (`stage-flow.js` 115), so most entries name a review
that is already on file. The piece A review's note that "the prepare branch is already human-only (lines 184 to 193)"
covers only the study scope branch; the plain route is open.

Options: (a) make the whole command human-only: breaks an assistant preparing research, refused. (b) drop the
assistant's entries silently: hides a refusal, refused. (c) refuse the whole call with 403 when an entry would add a
review that is not on file; accept entries that change nothing.

Choice: (c). For an actor not in `HUMAN_ACTORS` (an absent actor counts as not human), before anything is written:
an entry that today's code would act on (`!t?.managed`, hash equal to the current hash) and whose `f.reviews[id]` is
not already that hash refuses the call: 403, "Confirming material is for Adrian to do; agent:codex may not. Nothing
was prepared." An entry already on file is accepted and changes nothing: no `stampReview` call for a non-human, so a
stamp is never moved. Entries today's code ignores (a transcript, a wrong hash) stay ignored for everyone, exactly as
now; the existing "Review the exact current source" refusal follows if the source is unreviewed. Adrian's calls take
exactly today's path. `operation()` (`first-flow.mjs` 216) saves only after the step returns, so a refusal writes
nothing.

The study scope stand-in stays: an agent may not send `sourceReviews` or `humanDecision` (403, line 196) and may only
work on a registered structure-test copy (line 197), whose parent is its own `structure-test-<id>` project
(`study-research-scope.mjs` 7 to 10), so its stand-in review lands in that copy's own flow file and never in a real
subject's. That copy cannot take captured sources (`study-draft-copies.mjs` 258). A test proves the confinement.

## Decision 2: withdrawing a review stays open; setting aside is already his

Found: `first-flow.source-review` with `reviewed:false` deletes the review and its stamp (`first-flow.mjs` 247).
Setting aside and restoring are `first-flow.material-triage`, already human-only.

Options: close withdrawing too (loses something an assistant could do), or keep it open.

Choice: keep `reviewed:false` open to every actor. It only takes trust away: the material stops being eligible, a
copy already captured keeps its pinned bytes, and the same assistant could already reset a transcript's review by
correcting one segment. The activity journal records who withdrew it. The route stays "any" in the registry; the
service refuses `reviewed:true` from anyone not human: 403, "Confirming material is for Adrian to do; agent:codex may
not. Nothing was changed."

## Decision 3: speaker names and segment corrections stay open

Verified in code that every write to a transcript's words or speakers resets its review:
`apply()` sets `review:{status:'unreviewed'}` (`transcript-corrections.mjs` 47) and serves `edit` (163), `decide`
apply (159), proposals and the transcript check's edits (`transcript-check.mjs` 308, 328, 347, 389, 406) and shared
words (`shared-words.mjs` 54); `speakers` sets unreviewed even when no name changes (164). Rejecting physical Markdown
edits republishes the current result unchanged (160), and `correctionsFromMarkdown` refuses any change to front
matter or the review line (21). The Library and the material authority tie a review to the current bytes
(`first-flow.mjs` 47; `sourceSnapshot` 143). So none of these can produce or keep a review on changed words.

Choice: open, as today.

## Decision 4: every caller that marks reviewed as a non-human, and what it gets

The gate for the transcript review: add `['POST','/transcription/{id}/review']` to the custom commands just before
the generic `['POST','/transcription/{id}/{action}']` (`commands.mjs` 180), and `'POST /transcription/{id}/review'`
to `HUMAN_ONLY` (218). `findCommand` takes the first pattern that matches, in list order (249 to 250), so
`guardHumanOnly` (`server.mjs` 458, run at 799) refuses an assistant and an unattributed caller before the body is
read, whichever name it called (`.transcription.id.review` or `.transcription.id.action` with `review`). The service
checks again inside `review` (absent actor refused too), as `registerSource` does. The registry, CLI, MCP and
`docs/CAPABILITIES.md` then list review as human.

| caller | what it gets now | what changes |
| --- | --- | --- |
| Existing workspace, as Adrian | exactly as before | nothing he can see |
| Existing workspace, assistant tab: "Use this source" box | the lane's error line shows the server's sentence; the box redraws unticked (it follows `c.local.reviews`, set only on success, `stage-flow.js` 117) | none in that file |
| same: "Analyze", "Prepare" | works when every ticked source is already reviewed; otherwise the sentence, nothing prepared | none |
| same: "Review and save" | today stamped as Adrian (the hole above); after piece 4, 403 "This decision is human-only; agent:codex may propose but not decide." and no save | `review-mode.js` adds the tab's actor to same-origin `/transcription/` requests as well as `/api/` |
| same: speaker names, segment edits | work; after piece 4 stamped as the assistant, not as Adrian | as above |
| Recording workshop page "Mark reviewed" | refused 409 for everyone today (no `expected`); unchanged | none; noted |
| Version two "Confirm this transcript", Adrian | as before | none |
| same, assistant's page | today the server accepts names and an assistant review | the press sends only `review`; the gate refuses; the client's sentence shows ("Only Adrian can decide this. Codex can propose it, not do it.", `public/v2/shell/client.js` 60); nothing is written, typed names are not saved |
| Assistant routines (CLI, MCP, `agents/remote`) | no routine reviews; a raw `call` now gets 403 | none |
| Scheduled jobs (`cron:shared-words`, `cron:transcript-check`, phone pickup) | none reviews; their edits reset reviews | none |
| Demo fill (`scripts/demo-fill.mjs` 112 to 114) | acts as `agent:claude-code`, and `human:adrian` only for his decisions; makes no reviews | none |
| The journey walk (`scripts/review-journey.mjs` 263, 351 to 358) | opens `/v2/index.html` with no `reviewActor`, so it plays Adrian on invented demo data; its Confirm still works | none; it must still end step 8 in a real result |
| Tests that review as an assistant | 403 | listed in Decision 9, piece 1 |

The demo fill acts as an assistant except for his decisions; the walk acts as Adrian. Both stay as they are.

## Decision 5: the stop command and its record

**Name:** `study-draft.capture-sources.stop`, route `POST /api/study-draft/capture-sources/stop`, section `draft`.
`HUMAN_ONLY`; not in `PROSE_SAVES`, not in `CHAT_RELAYABLE`, no `UNDO` entry.

**Input** (exactly these keys, else 400), like its sibling:
`{bindingId, parentStudyId, operationId, expectedSourcesHash, sourceId, copiedHash}`. `expectedSourcesHash` is the
`sourcesHash` from the list he was shown (a string; there is no record to stop from otherwise). `copiedHash` names the
exact copy he saw used, so a recapture in another tab is not stopped blind.

**Order of checks** (mirrors `captureSources`, `study-draft-copies.mjs` 266 to 322): human only, absent actor
refused (403, at the gate and in the service: "Stopping a source for Check is for Adrian to do; agent:codex may
not."); input (400); binding (404); `cannotTakeSources` (409); `capture(b)`; record absent (409, "Check reads no
added source here.") or damaged (409, the existing sentence); a replay of this `operationId` with the same input
returns the current answer, with other input 409; an operation ID the draft already uses (409, as in 284 to 286); the
source's latest entry is already a stop of this `copiedHash`: 200 unchanged, whatever the hash says (a double press);
the source is not used now or its current copy is not `copiedHash`: 409 "Check does not read this copy now. Look
again."; then `expectedSourcesHash` must equal the file's hash (409). Then one append.

**Entry** (appended to `entries`, same file, same chain):

```
{sequence, action:'stop', operationId, inputHash, actor, stoppedAt,
 sourceId, id,            // the stopped record's id, 'added:'+sourceId+':'+first 12 of copiedHash
 copiedHash, stops,       // stops = entryHash of the capture entry being stopped
 previousHash, entryHash} // exactly as for a capture entry
```

Capture entries have no `action` key (their `kind` is the material's kind, so `action` is the marker). The write is
the sibling's: in `serial`, prefix check (append only), `atomicWrite` with `expectedHash`, chmod 0400. No file is
copied or removed; the stopped copy stays on disk and in the record.

**Reader** `added(b)` (241 to 254): walk entries in order. An entry without `action` is validated exactly as today. A
stop entry must have exactly the keys above, a valid sequence and chain, `actor` in `HUMAN_ACTORS`, and `stops` equal
to the `entryHash` of the source's latest capture entry, not already stopped; anything else makes the record damaged
(`{error}`), as today. A stop removes the source from the latest-per-source map. Output adds
`stopped:[{sourceId,id,copiedHash,title,kind,stoppedAt,actor,operationId}]` only when at least one stop exists, and
`addedForRead` (256) passes it through, so a draft read with no stop is byte for byte what it is now.

**Readers.**
- Check: `evidence()` (`study-draft-checks.mjs` 26 to 27) reads `addedSources.records`, which no longer holds the
  stopped source. No change there.
- Receipts: `read()` rebuilds the proof; the stopped source leaves `proof.sources`, so every earlier receipt reads
  `stale` with the existing reason. A check running while a stop lands ends stale (the before and after compare).
- With no `role:'source'` left, `perform()` holds with "No captured SRC available." and Check's held state shows the
  Sources block (`check.js` 126, 276).
- Standing (`subject-standing.mjs` 324 to 329): add one rule to the fact builder: a receipt that reads `stale` while
  the draft now has no source (`sourceNow` false) is reported `{status:'held', noSource:true, issues:0}`, so the rule
  (`runtime/standing-rule.mjs` 163) says "No source to check against yet" on the subject page, Home's row and desk
  card. Old drafts opened from a vault original always have their locked source, so they are untouched. This also
  changes one case today: a new subject held for want of a source whose draft was then typed reads "No source to
  check against yet" instead of "Check again". That is a wording change he can see: before and after pictures.
- The list (`listCaptureSources`, 324 to 337) and `hasQuoteSource` use the active records, so a stopped source is
  not "Already used for Check". Each row gains `capturedHash` (when used), `stopped` and `stoppedAt`; a captured
  source no longer attached still gets a row from its entry, so it can always be stopped.
- `inspect` (352) returns `kind:'stopSources'` for a stop entry's operation ID; add `'stopSources'` to the
  provenance list (343).

**An old record with no stop entries:** validates, reads, lists and checks exactly as now; its receipts stay current.
Forks, structure tests and collection seeds read only the locked capture (stage 6 Decision 5) and are untouched.

## Decision 6: using a stopped source again

Options: (a) never again on this subject; (b) again only by an explicit, separate press; (c) silently again whenever
it is eligible. (c) is refused: "Use it for Check" sends every eligible row, so a stopped source would come back with
the next press for any other source.

Recommendation: (b). The list marks a stopped source not eligible, so the bulk press never sends it. The server
refuses a stopped source in `study-draft.capture-sources` (409, "You stopped using this for Check.") unless that
item says `again:true` (items become `{sourceId, sourceHash, again?}`; `again` on a source that is not stopped is
400). "Again" copies the current Library bytes, which must be confirmed by him like any capture, and appends an
ordinary capture entry. It needs one more row control, which Adrian has not approved: question 1. If he says no,
the server rule stays and a stop is final for that source on this subject.

Row words (no em dash anywhere):

| state | row says | control |
| --- | --- | --- |
| used | "Used for Check" | "Stop using for Check" |
| used, set aside since | "Used for Check. Set aside in the Library since." | "Stop using for Check" |
| used, changed since | "Used for Check. Changed in the Library since." | "Stop using for Check" |
| stopped | "Not used for Check. You stopped it." | "Use for Check again" (if question 1 is yes) |
| after Stop | toast "Check no longer reads this." | |
| assistant's page, any press | the client's 403 sentence | the same control, shown |

After a stop, Check does not run by itself (unlike after a capture): the result reads out of date and "Check again"
or the held step says what to do.

## Decision 7: other ways round, and whether each is closed

| way | result |
| --- | --- |
| Unattributed request (no header, no app Origin) to review or source-review | 403: the gate refuses no actor; the services refuse an absent actor |
| A page that omits the header but sends the app's Origin | read as Adrian by design (`actor.mjs` 8 to 16); piece 4 closes it for the existing workspace's own transcript calls; an assistant must open pages with `?reviewActor=` (CLAUDE.md) |
| Chat relay with his words | neither command is in `CHAT_RELAYABLE`; 403 |
| Body fields `actor`, `by`, `reviewedBy` | 400 on source-review (unknown key); ignored by transcript review, which stamps `provenance()` |
| Corrections, speakers, transcript check, shared words | reset the review (Decision 3) |
| Hand edits to transcript files | incoherent with `base.json`, read unreviewed; a writer with file access can forge anything, as today |
| Library front matter `review_status: reviewed` (`library.mjs` 421) | a Library label only ("source-declaration"); not read by `reviewed()` or capture; noted below |
| Translation review, research material review, output reviews | not material confirmation; not read by `reviewed()` or capture; unchanged |
| Bring a stopped source back by the bulk press | not eligible in the list; server refuses without `again` |
| A stale page's press | the stop changed `sourcesHash`; 409 |
| Delete `added-sources.json` | Check reads the locked capture only: sources can be lost, never gained |
| Remove the stop entry or forge one | broken chain or non-human stop: damaged, Check holds; re-chaining by hand passes (no secret, same as the locked record) |
| Fork or structure test after a stop | seeded from the locked capture only; unchanged |
| Replay Adrian's stop or capture operation as an assistant | 403 at the gate before any replay |
| `again:true` as an assistant | 403 (capture is already his alone) |

## Decision 8: tests

`tests/review-human-only.test.mjs` (new, service level, invented content):
- `reviewSources` with `reviewed:true` as each agent, `cron:x`, `import:y` and no actor: 403, `flow.json` byte
  identical; as Adrian: reviewed and stamped his. `reviewed:false` as an agent: withdrawn, as today.
- `prepare` as an agent: an entry for an unreviewed note is 403 and writes nothing (no request folder, flow
  unchanged); entries already on file pass and leave his stamp; an old record stamped by an assistant keeps that
  stamp; a transcript entry and a wrong-hash entry are ignored exactly as today.
- the study scope stand-in on a structure-test copy changes no real subject's flow file.
- `corrections.review` as an agent and with no actor: 403, every transcript file byte identical; as Adrian: stamped.
- `edit`, `speakers`, `decide` apply and a transcript check edit after his confirmation each reset the review.

`tests/review-human-only-http.test.mjs` (new): `POST /transcription/{id}/review` as each agent, unattributed, via
`.transcription.id.action` and `.transcription.id.review` names, through the CLI `call` and MCP `ar_create_call`: 403
before the body is read; the Magazine route's review branch is never reached; the registry lists
`.transcription.id.review` as human and `first-flow.source-review` as any.

`tests/study-draft-stop-sources.test.mjs` (new): stop as Adrian appends one entry and Check stops reading it; a
quote found only in the stopped copy is NOT FOUND; a receipt made before reads stale; stopping the only source holds
Check and the standing says "No source to check against yet"; a record with no stop reads deep-equal to main's read;
replay, double press, different input (409), stale hash (409), wrong `copiedHash` (409), source never captured (409),
damaged record (409); a stop entry by a non-human, one pointing at an older capture and one with an extra key each
read as damaged; `again` as Adrian brings it back and a recapture without `again` is 409; `inspect` gives
`stopSources`; forks and structure tests made before and after validate unchanged; root recovery still passes.

`tests/study-draft-stop-sources-http.test.mjs` (new): the route over HTTP as Adrian and as each agent (403, nothing
written); `tests/subject-standing.test.mjs`, `tests/command-registry.test.mjs`, `tests/prose-saves-human-only.test.mjs`
(add); `tests/review-mode.test.mjs` (the tab's actor on `/transcription/` POSTs; none added when no actor was chosen).

Screens: `tests/v2-subject.test.mjs`, `tests/v2-check.test.mjs`: the control only on used rows; the press sends the
row's `copiedHash` and the list's hash; a 403 is said once and the list is unchanged; the stopped row's words; the
assistant's Confirm sends only `review`.

**Attack list for the reviewer, acting as an assistant** (`tests/stage-7-attack.test.mjs`, and once on the demo):
get any material or transcript to read reviewed or confirmed, or a stopped source to count again, without a
`human:adrian` request: every row of Decision 7; the existing workspace with `?reviewActor=agent:codex` pressing
"Use this source", "Analyze" with a locally ticked unreviewed note, "Review and save", speakers then review; version
two's Confirm as an assistant; `first-flow.prepare` with crafted `sourceReviews` (duplicates, a transcript, the right
hash for an unreviewed note mixed with reviewed ones); the stand-in brief on a structure-test copy naming the real
subject's sources; a race of stop against capture and against Check; a stop then a stale tab's "Use it for Check".
Each must end refused or unchanged, with every file byte identical where nothing should change.

## Decision 9: the build split

Never two builders on one file; each piece runs `npm run build` and the tests it touches.

1. **Review is his alone, services** (parallel with 2): `runtime/services/first-flow.mjs`,
   `runtime/services/transcript-corrections.mjs`; tests `tests/review-human-only.test.mjs` (new) and the files that
   review as an assistant or with no actor today and must act as Adrian or expect 403:
   `runtime/services/material-request-seam.test.mjs`, `tests/first-flow-guidance.test.mjs`,
   `tests/material-triage.test.mjs`, `tests/study-first-flow.test.mjs`, `tests/study-draft-capture-sources.test.mjs`,
   `tests/study-draft-capture-sources-review.test.mjs`, `tests/study-draft-capture-sources-review-2.test.mjs`,
   `tests/transcript-look.test.mjs`. Records an assistant reviewed before this change are made in fixtures by writing
   the old stamp, so "Reviewed by an assistant" stays tested.
2. **Stop, services** (parallel with 1): `runtime/services/study-draft-copies.mjs`,
   `runtime/services/subject-standing.mjs`; `tests/study-draft-stop-sources.test.mjs` (new),
   `tests/subject-standing.test.mjs`.
3. **Registry and wiring** (after 1 and 2): `runtime/commands.mjs` (review entry, stop route, `BODY`, `HUMAN_ONLY`,
   `again` in the capture body), `runtime/server.mjs` (compose `stopStudySources`), `docs/CAPABILITIES.md`
   (generated), `tests/command-registry.test.mjs`, `tests/prose-saves-human-only.test.mjs`,
   `tests/review-human-only-http.test.mjs` (new), `tests/study-draft-stop-sources-http.test.mjs` (new).
4. **The existing workspace says who it is** (parallel with any): `public/document-study/review-mode.js`,
   `tests/review-mode.test.mjs`. No change Adrian can see.
5. **The screen control** (last; tell the version three thread, session_017kitFe2b6MQFZwy3MNMGpN, before touching
   these files and when merged; version three loads both files, `public/v3/index.html` 38 and 47):
   `public/v2/screens/subject.js` (the marked "capture sources" blocks only: Stop on used rows, the stopped row, the
   assistant's Confirm), `public/v2/screens/check.js` (its marked block: the same Sources block, without the capture
   button, inside "Check details and saved proof", so Stop is reachable when Check is not held),
   `tests/v2-subject.test.mjs`, `tests/v2-check.test.mjs`, `scripts/review-journey.mjs` (step 4 also asserts the
   used row offers "Stop using for Check" and does not press it; step 8 unchanged). Existing classes only.
   Then before and after pictures at 390 and 1440, dark and light: the subject's Sources list, Check's held block and
   details, Home's row for the changed standing case.
6. **Two reviews**: one of the whole stage, then one acting as an assistant with the attack list.

## Decision 10: for Adrian

1. **Use again.** May a source you stopped be used for Check again, by a "Use for Check again" control on its row?
   Recommendation: yes. (No means a stop is final for that source on that subject.)

## Noticed, not in this stage

- The Library calls a file whose own front matter says `review_status: reviewed` "human review is recorded"
  (`library.mjs` 421 and the card reason after it). It does not reach Check or capture, but the words claim more than
  the file proves.
- The recording workshop's "Mark reviewed" never succeeds (no `expected`), for anyone.
- The workshop page itself sends no actor; after this stage that only mislabels who corrected a segment or named a
  speaker, never who confirmed.
