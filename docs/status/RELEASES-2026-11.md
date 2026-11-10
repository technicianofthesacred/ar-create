# November release reconciliation

Reconciled 10 November 2026 against Git, durable release receipts, installed release metadata and runtime health. [CURRENT](CURRENT.md) is the current status authority; [TODO](../../TODO.md) owns future work. This is the sanitized evidence index and historical correspondence, not another task list.

## What reached the installed app

| PR | Recorded installed software | Local release-record folder | Verified served assets |
|---|---|---|---:|
| 216 | `9bb522b960b90ca995c0a95ddb6cd94a8c0ca515` | `combined-pr216` | 14 |
| 218 | `47d2feeafd8782a14fb54b23b7ffed84a72f6128` | `media-interface-followup-r2` | 22 |
| 219 | `aa2de5390d11563b9869f8a2ba4433007299fd0d` | `sidebar-pr219` | 2 |
| 220 | `1989fd7be3a34718c4b673c5af815d22e814e2aa` | `material-original-followup` | 40 |
| 225 | `c5fa22e5cba88d8c981eabe91a049cbbc6b5da29` | `nov7-combined-release-r2` | 55 |
| 227 | `d0ef77d5597fe5ce7c65f6e5d87eb53aba439771` | `nov8-styling-recovery-batch-r3` | 59 |
| 228 | `cc832b1a1a971a5d9d6f165f7e1a1a92b451c1c5` | `nov8-recovery-capacity` | 59 |
| 229 | `f6c893b55ebece5c8874691c4ceadbc15ebcb944` | `nov8-recovery-owner-r2` | 59 |
| 230 | `af5350a974d5612ac1b3e373daea9979e8ad42cf` | `nov9-blank-source-article` | 59 |

Each listed publisher has a complete state with matching recorded head, installed revision, runtime revision and served-file hashes. Counts describe each packet's asset coverage, not the total application size. Local records are under `~/.codex/releases/ar-create/`; they are machine-local evidence, not bundled source or an active job. Read the final `state.json` and later result receipts before interpreting an older preparation handoff. Runtime can change after this snapshot: re-read the running release before new installed claims.

PR221 recording context, PR222 editorial presentation and the other composed source work reached the app through the combined release, rather than separate installed tags. PR226's recovery work was an input to PR227. Failed PR217 and earlier replacement candidates were not installed; compatible work was composed into later qualified candidates. The [frozen checklist](../history/delivery-checkpoint-2026-11-06.md) retains those earlier assignments without making them current blockers.

## Proof boundaries that matter

### Material, audio and browser Back

The final `postinstall32-batch` packet reports 32/32 unique item-opening/return checks on **PR229**, with zero inherited items. It includes exact saved content, unchanged sources and writing, real recording playback and literal browser Back to the same row/geometry/scroll, contextual audio and final canonical app opening. Read its `direct-results.json`, `custody-result.json`, `assets-result.json` and `gui-release.json`; the local release's postinstall records point to the private execution roots.

PR230 independently proves installed runtime and all 59 served assets. Its Material/Back interface files match the previously tested bytes. This correspondence is useful evidence; it does not rename the PR229 behavioral run as a fresh PR230 run.

The earlier item-4/item-10 Back/loading failures were diagnosed and archived, then passed in the final same-revision run. Baselines must be captured from a settled view: a background “Reading recordings…” repaint can temporarily shift layout. Preserve strict content/route/selection/geometry comparisons; wait for real readiness rather than weakening Back assertions.

### Recovery and preservation

PR228 installed but its separate postinstall recovery check failed under the real capacity constraint. PR229 resolved exclusive recovery-slot ownership, copied-session independence, timestamp-only Back restoration and the actual near-capacity case. Its `postinstall-state.json`, `installed-recovery-result.json` and `native-lease-proof.json` supersede that failure. Preserve retained records; clearing storage, deleting other sessions or sharing a writer slot without its exclusive lease is not a repair.

The original physical browser window was not restored. Adrian authorized a replacement window, and both replacement tabs were preserved. Future agents must keep that provenance accurate and inspect current ownership before using the browser; old window numbers and a previous finish receipt are not a fresh lease.

### Live generation and the separate Article

PR230 adds optional exact source-owner fields to `study-draft.create-collection`: `sourceBindingId`, `sourceParentStudyId` and `expected`, alongside a new parent identity, title and operation ID. It creates a blank native body with immutable non-draft source captures. It copies no manuscript wording, transfers no original human decisions and introduces no competing authority. Editorial context validates the archival root/fork lineage; original-plan choices stay separate.

The 21 focused owner/HTTP tests cover stale/foreign refusal, idempotent creation and restart, immutable captures, ordinary Article-fork compatibility, original/sibling/history preservation and agent Finish refusal. An actual synthetic native screen displayed the pending proposal with an unchanged empty manuscript and agent Finish disabled. The preserved application source paths are `runtime/services/study-draft-copies.mjs`, `runtime/services/study-editorial-plan-context.mjs` and `runtime/commands.mjs`.

After installation, one explicit existing-account Codex request used nine retained source/context records and completed with `modelExecuted:true`. Its separate 18-paragraph / 1,328-word Article was left in editable human read-through. The original manuscript, sources, both tabs and recovery were preserved. The 10 November read-only check still finds a fresh pending proposal and no decision. This proves one real initial-Article journey; it does not prove human Finish, this real Article's subsequent save/Undo/Carousel cycle, or every provider/model. The transport reported Codex execution and usage; an exact underlying model/provider was not reported.

`nov9-blank-source-article/postinstall-result.json` points to the private generation, handoff, preservation and screenshot receipts. Private operation identities and content remain outside this repository. Its earlier `HANDOFF.json` saying “templates only” is a preparation record superseded by final publisher and postinstall results.

### Multiline targets, cloud and publication

The old LF/CRLF target restriction was repaired in PR229: exact contiguous unlocked plain paragraphs can be existing targets. Generated replacement entries remain ordinary single-line prose. This is not permission to normalize saved wording or replace the editor.

The separate synthetic Claude/ChatGPT OAuth qualification ended with grants revoked, connections removed and its temporary tunnel closed. No active private cloud exposure or remote human Finish is claimed. Export correspondence, consent preparation and software releases likewise do not mean a piece was sent or published.

## Operational lessons for the next release

- Preserve one immutable source revision and its own source/test/native/installed evidence. Never relabel a mutable preview or earlier run as proof for a newer revision.
- A LaunchAgent needs an explicit tool environment containing Node, npm and GitHub CLI. The PR230 dry run refused before installation because its default PATH lacked tools; setting the environment and testing the same official dry run repaired this. `AR_RELEASE_GH` supports an explicit GitHub CLI executable. No CI or signer gate was bypassed.
- Keep exact main/merge-parent/tree checks, publication serialization, clean-word and two-tab guards, the official installer, restart proof and served-byte checks. Use a durable machine observer for CI; terminal failure requires diagnosis rather than blind replay.
- A local proof packet may contain older failed or unarmed states. Final dated result receipts establish the resolved outcome; preserve the historical failures and explain their supersession.

## Reproduce the committed status snapshot

`WORKS.md` is the hand-maintained summary; `CURRENT.md` is generated. The sanitized input snapshots contain only release metadata and the recorded focused-test summary, not private application state.

```sh
node scripts/gen-status.mjs --tests docs/status/qualified-tests-2026-11-09.json --release docs/status/installed-release-2026-11-10.json
node scripts/gen-status.mjs --tests docs/status/qualified-tests-2026-11-09.json --release docs/status/installed-release-2026-11-10.json --check
```

For a new live assessment, supply freshly read release metadata and a genuine measured test summary. A matching full software revision is not a claim that every test ran, every layout passed or Adrian accepted the words.
