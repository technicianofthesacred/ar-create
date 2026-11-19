# Writing opening and Magazine formatting repair

Candidate branch: `codex/article-opening-formatting`, based on `b67a80f1`.
This repair is not installed. Visual approval, integration and installation are separate remaining steps.

## Observed behavior

A read-only browser open of one installed Magazine article took 3,333 ms to show the writing. Workspace catalog and standing requests took roughly 2.6–2.7 seconds; the exact manuscript read took 95 ms. Catalog discovery was validating every collection's captured source files and reading supporting originals before a selected article could open.

Write displayed some passages in read-only textareas and other passages as escaped plain text. Emphasis markers and list markers remained visible, and supported bold formatting was lost when the native projection was reduced to its words.

## Candidate behavior

- The existing study-draft catalog accepts `purpose: navigation`. The v3 desk and standing use this lighter discovery path. It retains identity, owner and binding metadata without opening captured source files. The ordinary full catalog and exact reads still validate source provenance and parent identity.
- Original discovery reads the current draft for its metadata rather than all its supporting documents. Current draft hashing and binding metadata reads still happen; there is no new long-lived cache.
- Write opens the exact selected Magazine draft directly; missing drafts still use the established catalog fallback.
- v3 Magazine Write and Read display semantic paragraphs, headings, quotations, emphasis and lists using existing reading classes. Native formatting is displayed only when its text exactly matches the visible projection. Original-only metadata is not passed to the renderer. Existing wording, answers and edit guards remain unchanged.
- On Adrian’s follow-up, removed the routine actor explanation from v3 Write and the Magazine editing-location paragraph. The existing destination is a compact “Edit in Magazine” link beside the story title. Author-only editing/decisions and actual error messages remain enforced.
- No CSS values, colors, button styles or global navigation were changed. The design card's named master file and guard test are absent from this source revision, so this repair reuses the existing reading classes instead.

## Verification and limits

The invented-data browser regression checks Write and Read, closed article questions, unchanged manuscript bytes, no content writes, navigation requests, no redundant successful-open Magazine catalog request, and no horizontal overflow at 1280, 670, 390 and 320 pixels in both themes. Matching before/after screenshots use the same invented manuscript and viewports. Its opening time does not establish performance on the real library.

The regression suite also covers stale provenance, foreign parents, fixture exclusions, safe Markdown, safe native formatting and hidden original-only text. The build passed. The final renderer suite passed 14 tests; the Read/story/shell suite passed 74 tests, and the UI/editing/recovery suite passed 89 tests. The broader `npm run test:changed` run completed across 196 files: 1,888 passed, one skipped, zero failures. After the header correction, the focused actor-permission and shell tests passed again, and the invented-data browser check verified the editing link reaches the same article and retains the return address.

After approval and an authorized release, remeasure the exact installed article and verify the live manuscript and question answers remain unchanged. Do not report the live delay fixed from invented-data timings alone.


## Release recovery, 19 November

The rebased release candidate's 198-file local run hit the publisher's 90-minute process limit without a final suite result. Its partial log is not a pass. The final emitted cases belonged to the unchanged v2 starting-Article tests. A traced complete run of that file passed all 13 cases and closed its server normally. The main-control v3 starting-Article file also passed all 13 cases and closed normally.

The candidate's complete v3 starting-Article diagnostic exposed one stale UI expectation: the assistant-empty-page test still required the routine actor paragraph Adrian asked to remove. Its expectation now checks that paragraph is absent and that the useful empty-Article guidance remains. Every existing read-only, no-save, no-local-storage and no-article-creation assertion is retained. The corrected focused guard passed. This is a test expectation repair for the approved interface, not permission to change author-only behavior.

The same durable publisher retains the interrupted log and control diagnostics. Its one recovery run waits for host capacity before starting the complete affected suite, with cleanup diagnostics retained. Assertion timeouts, required GitHub CI, the publication lock, exact-revision checks and real-article preservation checks remain enforced. No local timeout is treated as success.
