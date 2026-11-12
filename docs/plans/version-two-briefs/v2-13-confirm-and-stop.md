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

## Review of the design

Reviewed 12 November 2026 against this branch (equal to main), by reading every cited file and searching for every
writer of `reviewedBy`, `f.reviews` and `metadata.review`. Nothing was changed or built. Checked by reading, not by
running: the one test file tried (`tests/subject-standing.test.mjs`) could not start because the generated
`runtime/article-codec.mjs` is absent in this checkout, so the build has to be run before any builder relies on it.

Verdict: the design finds every path that marks reviewed, its line references are right, and the stop entry is inside
the hash chain. Three things must be corrected in the design before building. None changes the shape of the stage.

What was confirmed as the design says:

- The only writers of a review are `first-flow.mjs` 247, 251 and 253 and `transcript-corrections.mjs` 165. The older
  route at `magazine/jobs.mjs` 229 to 231 cannot be reached: `recordings.mjs` 163 to 179 uses the same strict path
  pattern, and for a POST to `review` it always answers or throws. `jobs.mjs` 208 writes a review field on a
  translation file only. No scheduled job, phone pickup, import, CLI or MCP routine, demo fill or walk marks reviewed.
- The existing workspace hole is real. `stage-flow.js` 12 sends plain `fetch`, `review-mode.js` 16 adds the actor only
  to `/api/` paths, and `actor.mjs` 92 to 93 reads a same-origin request with no header as `human:adrian`.
- Nobody but the existing workspace and tests sends `sourceReviews` to the plain `first-flow.prepare`
  (`stage-flow.js` 115). No assistant routine, script or demo fill does, so refusing an added review breaks no
  assistant flow, and an assistant preparing a subject whose material is already reviewed still works.
- Every edit to a transcript's words or speakers resets its review (`transcript-corrections.mjs` 47, 164).

### Must fix

1. **The 403 at the gate can be stepped round, so the check inside the service is the real one and must be written as
   such.** `server.mjs` 799 gives `guardHumanOnly` the raw request path, while routing uses other forms of it:
   `recordings.route` matches `new URL(request.url).pathname` (`server.mjs` 574, `recordings.mjs` 163), which folds
   `/transcription/x/../<id>/review` and `/transcription/<id>\review` into `/transcription/<id>/review`; neither
   spelling matches the registry pattern, so the gate finds no command and lets it through. The route map uses the
   decoded path (`server.mjs` 462, 760), so `/api/study-draft/capture-sources/sto%70` also passes the gate.
   Correction to Decision 4 and Decision 5: say that the service check is required, not a second look; put it first
   in `review` (before `lock`, `initialize` and `clean`, `transcript-corrections.mjs` 165, because `initialize` writes
   the mapping) and first in the stop command, so a refusal writes nothing and is 403 rather than 409. Correct
   Decision 8's "403 before the body is read" to "403, nothing written". Add both spellings and the encoded stop path
   to Decision 7's table, to `tests/review-human-only-http.test.mjs`, `tests/study-draft-stop-sources-http.test.mjs`
   and the attack list.

2. **The standing rule in Decision 5 is too wide and its claim about old drafts is wrong.** As written ("a receipt
   that reads `stale` while the draft now has no source is reported held, no source") it also fires when the added
   record is damaged (`read.addedSources.error`, no records, so `sourceNow` is false at `subject-standing.mjs` 328),
   where the true reason is the damage, and when the draft could not be read. It reverses assertions stage 6 pinned
   on purpose: `tests/subject-standing.test.mjs` 229 (a stale receipt claims nothing), 249 and 256 ("Check again"),
   and would wrongly flip 261 (damaged record). "Old drafts opened from a vault original always have their locked
   source" is not so: a vault draft whose support files include none labelled source, or whose source is missing,
   has none (`study-originals.mjs` 119, `study-draft-checks.mjs` 214 to 215), and those cannot take added sources
   (`study-draft-copies.mjs` 258). Correction: state the rule exactly: the draft read is present, it has no
   `addedSources.error`, no record with role `source` that is not missing, and the receipt reads `stale`; then
   `{status:'held', noSource:true, issues:0}`. A damaged record keeps "Check again". List the three assertions that
   change and the one that must not. Say plainly that the wording change reaches every draft with no source,
   including old vault drafts, forks and structure tests, and include one of those in the before and after pictures.
   See question 2 for Adrian.

3. **After a stop the subject page and Check would say different things.** The standing would say "No source to
   check against yet" at once, but Check shows its Sources block only for a receipt that is itself `held`
   (`check.js` 126, 276); after a stop the receipt is `stale`, so Check says out of date and offers "Check saved
   draft again", which then holds. The approved wording is that Check is held when no source for quotes is left.
   Correction to Decision 5 and piece 5: on Check, when the list reports `hasQuoteSource:false` and the receipt is
   stale, show the held words and the Sources block as for a held receipt, without running. Also state that
   `createCaptureSources` needs a separate callback for a stop: the one it has runs Check again by itself
   (`check.js` 123), which Decision 6 says must not happen after a stop.

### Should fix

1. **Refuse `reviewed:true` before the replay check.** `operation()` (`first-flow.mjs` 216) returns the current view
   for a repeated operation ID before the step runs, so an assistant repeating Adrian's own operation gets 200, not
   403. Nothing is written, but Decision 7's row "403 at the gate before any replay" is not true for
   `first-flow.source-review` or for `prepare`, which have no gate. Do the actor check at the top of `reviewSources`
   (line 240) and before `operation` in `prepare` where it can be, or reword the row.
2. **Decision 1 should name the source list.** Today's loop only reads an entry whose source is in `sourceIds`
   (`first-flow.mjs` 253). Say "an entry for a source in this call's `sourceIds`", so an entry for another source
   stays ignored as now, and test it.
3. **The stand-in on a structure-test copy still writes a review as an assistant** (`first-flow.mjs` 251, stamped
   with the assistant's name, in the copy's own flow file). That is a deliberate exception to "his alone by every
   path" and the approved text names both `sourceReviews` branches. Keep it, but say so to Adrian: question 3.
4. **Removing the last entry is not detected.** Decision 7 says removing a stop entry breaks the chain. That is true
   only for an entry in the middle; nothing pins the newest entry, so cutting the stop off the end leaves a valid
   record (`study-draft-copies.mjs` 246 to 252). Only someone with file access can do it, the same as today. Correct
   the row to say so.
5. **A repeat of an old capture after a stop answers "captured".** `captureSources` step 1 (281 to 282) returns the
   old entries for a repeated operation ID. Nothing is written and it is Adrian only, but the reply should give the
   present state: add `stopped` or leave the source out of `captured` when its latest entry is a stop.
6. **`again:true` on a source that is in use should settle, not fail.** Decision 6 answers 400. Two tabs make this
   ordinary: one pressed "Use for Check again", the other presses it too. Treat it as "already used" (step 3, 302).
7. **Keep the reader's new bookkeeping out of `records`.** `addedForRead` (256) spreads every field of a record into
   the draft read. The capture entry's `entryHash`, needed to check `stops`, must live in a separate map, or old
   drafts' reads change. The planned deep-equal test would catch it; say it in Decision 5.
8. **Add list keys only when they apply.** If every row gains `stopped:false` and `capturedHash:null`, assertions in
   the three capture test files that piece 1 owns may fail from piece 2's change. Add `capturedHash` only on a used
   row and `stopped`, `stoppedAt` only on a stopped row, or give those three files to one builder in sequence.
9. **Pin the workshop page's refusal.** The recording workshop page (`workshop-ui.mjs` 189) sends no actor, so an
   assistant driving it is read as Adrian and passes the new gate; its "Mark reviewed" fails only because it sends no
   `expected` (`transcript-corrections.mjs` 119). Add a test that a review with no `expected` is refused for
   everyone, with a comment that mending that page must first make it say who is pressing.
10. **Piece 4 must ship in the same release as piece 3.** Without it the existing workspace still stamps an
    assistant's "Review and save" as Adrian and the gate passes it. Say so in Decision 9. The fix itself is right and
    changes nothing for Adrian: with no actor chosen and no review mode the page is not patched and behaves as now;
    in review mode it adds `human:adrian` and `ui`, which is what the server already assumed. One visible difference
    to record: a tab opened with an unknown `reviewActor` now has its transcript reads refused too.
11. **Scope the promise about the Library label.** A file whose own front matter says `review_status: reviewed`
    reads "human review is recorded" in the Library and reaches research answers and prepared sources as a label
    (`library.mjs` 421 to 430, `research-answer.mjs` 69, `article-source.mjs` 30). An import can create such a file.
    It does not reach `reviewed()`, capture or Check, as the design says, but the attack list's goal ("get any
    material to read reviewed") fails on it as worded. Reword the goal to what the stage covers and tell Adrian:
    question 4.

### Notes

- Decision 2 and 3 are sound. Withdrawing a review and renaming speakers let an assistant undo his confirmation; that
  is unchanged from today and recorded in the journal.
- The assistant's Confirm sending only `review` is right for a second reason: today it would first save speaker
  names, which resets a confirmation Adrian already made (`subject.js` 670 to 672).
- A stop is by source, not by words. A second Library item with the same words is a different source. Only Adrian
  can confirm and capture it, so an assistant cannot use it to bring the words back; a captured note also supports
  quotes while any transcript is in use (`study-draft-checks.mjs` 54). Worth one plain sentence in Decision 6.
- An older release cannot read a record that holds a stop entry: it reads as damaged and Check holds
  (`study-draft-copies.mjs` 248). That is the safe direction, but the home should not be rolled back past this
  release once a stop has been written. Put it in the release note.
- The `keep` rule in `review` (`transcript-corrections.mjs` 165) becomes dead once non-humans are refused; leave or
  remove, no effect.
- A review POST will be journalled and announced as `.transcription.id.review` instead of `.transcription.id.action`.
  Listeners match by prefix (`subject-standing.mjs` 59, `subject.js` 229 to 232), so nothing breaks.
- The gate weakness in Must fix 1 is general: any human-only command with no check inside its service (for example
  `first-flow.material-triage`, which the design lists as already his) can be reached with an encoded path. It needs
  a deliberate caller, the same as a false actor header, and is outside this stage. Matching the gate on the same
  path the router uses (`server.mjs` 799) would close it and sits in piece 3's file; raise it separately.
- The build split is otherwise safe: no file has two builders, 3 follows 1 and 2, 5 is last, and each piece has its
  own tests.

### For Adrian (each answerable in one word)

1. Use again (the design's own question): yes is right.
2. A subject with no source whose words changed since its last held check: should it say "No source to check
   against yet" instead of "Check again", on every draft including old ones? Recommendation: yes.
3. May an assistant's stand-in still mark material reviewed inside its own test copy, never in a real subject?
   Recommendation: yes.
4. Leave the Library's "human review is recorded" label for a file that declares itself reviewed to a later stage?
   Recommendation: yes.

## Code review of piece 2 (stop, services)

Reviewed 12 November 2026 on commit "Stop a captured source counting: services and standing", in this worktree.
Nothing was changed except this section. Run: `node --test tests/study-draft-stop-sources.test.mjs
tests/subject-standing.test.mjs tests/study-draft-capture-sources*.test.mjs` (76 pass), and the wider draft, Check,
structure-test and standing files (300 pass, 0 fail). Probes were throwaway scripts outside the worktree, on invented
data in a temporary folder. One of them loaded the previous commit's `study-draft-copies.mjs` against the same data.

Verdict: the piece does what the design and its review ask, and the registry and HTTP piece can build on it as it
stands. No must-fix items. Shown by running:

- **Who may stop or bring back.** `humanOnly` is the first line of `stopSources` (`study-draft-copies.mjs` 350) and of
  `captureSources` (273). Every attempt by `agent:*`, `cron:*`, `import:*` and with no actor got 403 and left every
  file byte identical: a stop, a stop with junk input, a replay of Adrian's own stop operation ID, a bulk capture, and
  `again:true`. A bulk press that names a stopped source is 409 "You stopped using this for Check." and writes nothing.
  A replay of the old capture operation ID does not bring it back and now says `stopped`, which settles the review's
  should-fix 5. Another Library item with the same bytes is a different source and leaves the stop in place. Two
  service instances on one folder racing the same stop wrote one stop entry. The second instance settled as a double
  press. Two racing `again` presses wrote one capture entry. The losing instance got 409 from the write's hash check,
  and the second press settles within one instance.
- **The chain.** A stop entry has `sequence`, `previousHash` and an `entryHash` over every other key, and the reader
  checks its exact key set, a human actor, `stops` equal to the source's newest capture and no double stop (251).
  Each kind of change was read as damaged: a tampered field, an entry dropped from the middle, a re-hashed assistant
  stop, a stop pointing at an older capture, an extra key, a stop of a source never captured, and a repeated stop.
- **Readers agree.** After a stop, the read's `records`, Check's evidence (`study-draft-checks.mjs` 27), the list's
  `hasQuoteSource` and the standing's `sourceNow` all use the same set: the locked records plus the active added
  records with role `source` and not missing. The earlier receipt read `stale`. Check run again held with "No captured
  SRC available.", and the list marked the row stopped and not eligible.
- **Standing.** `noneLeft` (`subject-standing.mjs` 331) is exactly the review's must-fix 2, no wider. It requires a
  present draft read, no `addedSources.error`, no source record, and a `stale` receipt. In
  `tests/subject-standing.test.mjs` exactly three assertions changed, the three the review named. The one at 229 was
  strengthened (it now also checks `status` and `issues`). The damaged-record assertion ("Check again") is unchanged.
  A new test pins the damaged record and the missing draft read. No test was weakened.
- **Old records.** For a record with no stop entry, the draft read from this commit is byte for byte the previous
  commit's read (`JSON.stringify` equal, same data folder). The list differs only by `capturedHash` on used rows,
  which the design adds on purpose. Forks and structure tests made before and after a stop read and validate, with no
  `addedSources`. An older release reads a record holding a stop as damaged, which is the safe direction (see the
  review's note on rollback).
- **His words.** A stop or an `again` only appends to `added-sources.json` and may copy one file into `capture/`. The
  draft's projection was identical before and after a stop.
- **Words.** There is no em dash in any changed file.

### Must fix

None.

### Should fix

1. **Cutting the stop off the end gives the source back, which the record could not do before.**
   `tests/study-draft-stop-sources.test.mjs` 236 pins the cut, and its title says "as for the locked record". That
   comparison is wrong: the locked record is pinned by `captureHash` in the binding. Only the added record's newest
   entry is unanchored (`study-draft-copies.mjs` 246 to 257). Before this change, cutting the newest entry could only
   lose a source or go back to an older confirmed copy. Now it silently restores a source Adrian stopped. A probe
   confirmed it: the read went from one source to two, with no error. That breaks Decision 7's "sources can be lost,
   never gained". It needs file access, and anyone with file access could already forge a capture by re-chaining
   (no secret), so this makes an existing ability easier rather than adding a new one.
   Correction now: rename the test to say what it shows, and correct Decision 7's rows for "Remove the stop entry"
   and "Delete added-sources.json" to name this case.
   What would close it: anchor the head outside the file. Either the reader requires every `stopSources` operation
   stamped in the draft provenance ledger (already written for each stop, `study-draft-copies.mjs` 383) to appear in
   the chain, or each write records the record's newest `entryHash` beside the binding. Either one makes a cut need
   two coordinated edits. Neither defeats a forger with file access. It is not in this piece's scope, because the
   design review chose to reword, but it is cheap and could go in piece 3 if Adrian wants it.
2. **A replay of an old stop operation reports "stopped" after the source was used again.** `outcome()` in
   `stopSources` (`study-draft-copies.mjs` 359, returned at 361) always returns `stopped:[{sourceId,copiedHash}]`. A
   probe stopped the transcript, brought it back with `again`, and then repeated the first stop's operation ID. The
   reply named it as stopped while `document.addedSources.records` held it as used. This is the mirror of the review's
   should-fix 5, which was fixed for capture at 285. Correction: build the reply from `now.stopped`. Return
   `stopped:[...]` only when `now.stopped` holds this `sourceId` and `copiedHash`, else `stopped:[]` (or a
   `usedAgain:true`).
3. **The damaged-record refusal for a stop says "nothing was used".** At 358, `fail(ADDED_BROKEN)` answers a stop
   with "Captured sources for Check changed; nothing was used.", while capture adds " Nothing was added." (284).
   Correction: `fail(ADDED_BROKEN+' Nothing was stopped.')`, and update the matching regex in the test at 144.
4. **Two test titles claim more than they test.** At 64, "reads and lists exactly as it did, with no new keys"
   compares key names only, and the list rows do gain `capturedHash`. Correction: compare the read with a fixed
   expected value (or keep the probe's check against the previous commit), and retitle the list half "adds only
   `capturedHash` on used rows". At 170, "a copy, a stand-in and a fork refuse a stop" tests only a fork. Correction:
   add a structure-test copy, made with `cloneStructureTest` as at 250, expecting 409.
5. **`again:true` on a source in use recaptures rather than settling when its bytes changed.** At 294 a live source
   with `again` passes. With the same bytes it settles as already used, which the review's should-fix 6 asks for.
   With changed Library bytes it captures the new copy, which is what an ordinary press would do. That is harmless
   (Adrian only, confirmed bytes), but it differs from Decision 6's wording. Correction: say so in Decision 6, or
   treat `again` on a live source exactly like the same item without `again`. The latter is already the behaviour, so
   only the words change.

### Notes

- The stop's double press (366) settles with a new operation ID and writes no entry. The provenance ledger still
  stamps that ID (383), and `inspect` then answers 404 for it. Harmless. Piece 3 should not expect a receipt for a
  settled press.
- `inputHash` is not checked by the reader for stops or for captures. It is used only to tell replays apart, as
  before.
- The MCP `study_draft_read` (`agents/mcp/server.mjs` 70) shows `addedSources.records` only, so assistants will not
  see `stopped`. That is fine for this piece. Piece 3 may want to add it, read only.
- For the registry piece: the service refusals come first, so the gate is a second layer, as the review's must-fix 1
  asks. `stopSources` takes no `{material}` context, so the server only needs to compose it.

## Code review of piece 1 (review is his alone, services)

Reviewed 12 November 2026 against commit "Marking reviewed is his alone: services" in this worktree. Nothing in the
code was changed. Checked by running: the touched test files as asked (84 of 84 pass), the twelve other test files
that call a review path (`native-carousel-proposals`, `blank-source-article-http`, `collection-source-continuation`,
`language-connection-http`, `review-native-carousel-proposals`, `study-ai-proposal-drawer`, `synthetic-restore`,
`transcript-to-independent-outputs-journey`, `v2-subject`, `v2-write`, `v3-write`, `transcript-check`: 247 of 247
pass), and throwaway probes on invented data outside the worktree, one of them run against both this commit and the
commit before it.

Verdict: the refusal is in the right places and holds. No non-human or unattributed caller could end with a review
on file, or with Adrian's name on one, by any path tried. One change reaches Adrian's own calls, against Decision 1,
and must be put back.

What was proved by running:

- Odd actors, in process, for `reviewSources`, `prepare` and transcript `review`: `"human:adrian "`, `" human:adrian"`,
  `"human:adrian\n"`, `"Human:Adrian"`, `"HUMAN:ADRIAN"`, `["human:adrian"]`, `""`, `null`, no actor at all,
  `unknown(in-process)`, `release:abcdef1`, `human:someone`: each 403, every file byte identical. Over HTTP the header
  is trimmed by `parseActor` before the service sees it, so a padded header is Adrian by design (self-declared), not
  a hole.
- Replay: an assistant repeating Adrian's `source-review` operation is 403 before the replay. An assistant repeating
  his `prepare` operation with the same input gets 200 and the current view (the same fields `first-flow.get` already
  gives it), nothing written, his stamp unchanged. After the review is withdrawn, the replay does not bring it back:
  `operation()` returns the view without running the step. Harmless; see Should fix 2.
- Crafted `sourceReviews` as an assistant: a wrong hash then the right one for the same unreviewed note in one call,
  an unreviewed entry placed after a reviewed one, an entry with an extra `by` key: 403, flow unchanged. Duplicates of
  an entry already on file: prepared, stamp unchanged. An entry outside `sourceIds`: ignored (tested by the builder).
  An unreviewed source with no entry listed before one with an entry answers 409 ("Review the exact current
  source") instead of 403; nothing is written either way.
- The stand-in stays confined: `validateTarget` (`structure-tests.mjs` 13) accepts only a `parentStudyId` that starts
  `structure-test-`, the scope's project is that copy's own binding (`study-research-scope.mjs` 7), and an agent may
  not send `sourceReviews` or `humanDecision` there (`first-flow.mjs` 198). The builder's test proves the real
  subject's room is byte identical.
- Transcript edit paths: the transcript check's `edit` (Adrian, from the app) after his confirmation resets the review
  to unreviewed; an assistant is refused there already (`transcript-check.mjs` 236, `decider`). Every transcript-check
  write goes through `corrections.edit`, which resets (`transcript-corrections.mjs` 47). `propose` then `decide`
  apply as an assistant resets. `decide` reject of a hand edit to the Markdown keeps his review, correctly: it puts
  back exactly the bytes he confirmed.
- Order: `reviewSources` refuses before `operation`, so before the lock, the room and the replay. Transcript `review`
  refuses before `lock`, `initialize` and `clean`, so before `writer.lock` and the mapping. `prepare` refuses inside
  the step, after reads only; the one thing that can happen first is `state()` creating an empty room directory for
  a project never attached (`first-flow.mjs` 34), which was so before and fails on "Attach these Library sources"
  anyway.
- An assistant's ordinary prepare with no `sourceReviews`, or with entries already on file, prepares as before and
  moves no stamp. The one difference, intended by Decision 1: an old review on file with no stamp, or an assistant's,
  is no longer restamped with the assistant's name.
- "Reviewed by an assistant" stays tested by writing the old stamp in fixtures (`study-draft-capture-sources-review`
  30 to 33 and 55 to 57, `-review-2` 80 and 105, `transcript-look` 51 to 54, `review-human-only` 57). No test that was
  changed lost what it proved, with the one exception in Should fix 3. Refusal wording is plain and has no em dash.

### Must fix

1. **Adrian's prepare no longer restamps a review that is already on file.** `runtime/services/first-flow.mjs` 255:
   the new condition `&&f.reviews[id]!==s.hash` was added for everyone, not only for non-humans. Before, when Adrian
   pressed "Analyze" or "Prepare" with a ticked source whose review was on file but stamped by an assistant (or made
   before stamps, with none), `stampReview` put his name on it; now it stays the assistant's or none. Proved by one
   probe run on both commits: old stamp `agent:codex` or none, Adrian prepares with the entry; before: `human:adrian`
   both times; now: `agent:codex` and none. Such material keeps reading "Not confirmed by you yet" and cannot be
   used for Check, although he has just sent its exact hash. Decision 1 says "Adrian's calls take exactly today's
   path." Correction: keep today's body for humans and gate only the others, for example
   `if(!t?.managed&&reviews.some(r=>r.sourceId===id&&r.hash===s.hash)){if(!HUMAN_ACTORS.includes(currentActor()?.actor)){if(f.reviews[id]!==s.hash)requireHumanReview('Nothing was prepared.');}else{f.reviews[id]=s.hash;stampReview(f,id,s.hash);}}`.
   Add a test in `tests/review-human-only.test.mjs`: a fixture with an assistant's old stamp and one with no stamp,
   Adrian prepares with the entry, both read `human:adrian`.

### Should fix

1. **Test the transcript check's edit.** Decision 8 lists "a transcript check edit after his confirmation" among the
   resets; `tests/review-human-only.test.mjs` 117 tests `speakers`, `edit` and `decide` apply but not it. It passes
   when run (probe above), so add it: Adrian confirms, `createTranscriptCheck(...).edit` as `human:adrian` with client
   `ui`, the review reads unreviewed.
2. **Pin the `prepare` replay and say it in Decision 7.** The design's review asked for the replay row to be made
   true or reworded. `reviewSources` now refuses first; `prepare` still answers 200 to an assistant repeating his
   operation. It writes nothing and does not restore a withdrawn review, but neither is tested. Add to
   `tests/review-human-only.test.mjs`: replay is 200, every file byte identical, and after a withdrawal the review is
   still absent. Reword Decision 7's "Replay ... 403 at the gate before any replay" to name `prepare` as the exception.
3. **Keep the unknown-key refusal on `source-review` pinned.** `tests/study-draft-capture-sources-review-2.test.mjs`
   103 used to prove that `by` and `reviewedBy` in the body are refused 400. Now the assistant is refused 403 first,
   and no test anywhere sends an extra key to `source-review` and expects 400. Add one line there sending `by` as
   `human:adrian` (the actor) and expect 400, with the flow unchanged. Decision 7's row "Body fields ... 400 on
   source-review" should read 403 for anyone not human and 400 for him.
4. **`stampReview`'s keep rule is now reached only by the stand-in** (`first-flow.mjs` 52). The test that proved it
   ("an assistant reviewing the same bytes after Adrian does not remove his confirmation", `-review-2` 111) now ends
   at 403 and never reaches it. On a structure-test copy where Adrian reviewed first, an assistant's stand-in prepare
   still relies on it. Either add a test there (Adrian reviews in the copy, the stand-in prepares, his stamp stays)
   or note that the rule is kept on purpose for the stand-in.

### Notes

- The refusal names the actor by plain string concatenation (`first-flow.mjs` 14, `transcript-corrections.mjs`
  165). An array actor, possible only in process, reads "human:adrian may not", and padding shows as typed. Over HTTP
  neither can happen. `JSON.stringify(actor)` for anything not a plain known actor would make it exact; not needed now.
- The `keep` rule inside transcript `review` (`transcript-corrections.mjs` 165) is dead now that only humans reach
  it, as the design's review expected. Leave or remove; no effect.
- A refusal's status depends on the order of `sourceIds` (403 or 409, see above). Both write nothing. If the attack
  test is to assert 403 for "the right hash for an unreviewed note mixed with reviewed ones", it should list the
  reviewed ones first or accept either.
- The design listed `tests/study-first-flow.test.mjs` and `tests/study-draft-capture-sources.test.mjs` for change;
  neither needed it: both already review as Adrian.

### Can the registry piece build on this

Yes, once Must fix 1 is made; it touches only `first-flow.mjs` and its own test. The service checks are first in
both services, so piece 3's gate is a first look and the services stay the real check, as Must fix 1 of the design's
review asked. `first-flow.source-review` must stay "any" in the registry because withdrawing is open; the service
already separates the two.
