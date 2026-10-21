# Status: what works today

Updated 21 October 2026. **This is the only status authority.** Product docs state intent; the three older status tables (the development guide's coverage table, the integration list's section map and the function flow's current status) now live here or are retired. Requirements are not proof; a row here is proof only of what it says.

## The installed app and this branch

- **Installed**: the home still runs the previous release. PR17 is merged at `761da68`; the reviewed release/fixture repair is candidate `a9ebf85`. The new installation is pending preservation rehearsal. The running app reports a recorded installed release at `/api/i64os/health` (`release.sha`); the previous unrecorded installation has no release SHA. Source implementation and candidate checks do not establish installed behavior.
- **Merged source**: recorded releases and config-driven private paths; actor-stamped mutations and human-only decisions; one command registry, CLI and MCP server; event stream, presence and advisory leases; append-only journal with handoff and ask; and the three-region shell. PR17 also implements human saves over an agent lease, Collection CLI catalog calls, the Home question/answer inbox, and Magazine command, editorial and thin-client paths. The bounded shell gate remains in `tests/shell-gate.test.mjs`.
- **Verification**: the author reports 312 tests with 307 passing and five baseline failures; this total and failure list are not independently verified here. The current fixture-overlay safety checks are reported 4/4 and the package check passed. These results do not mean the full suite is green. Do not add unrecorded failure names.
- **Release boundary**: the new release remains pending rehearsal. Provider execution, off-Mac access, private-content synchronization and human approvals remain separate gates.

## Remaining source limits

| Item | State |
|---|---|
| Hermes, Grok, ChatGPT reach AR Create | Their actor values are accepted by the CLI and MCP, but no connector or skill exists for them; Hermes in i64os only runs `--version`. This Mac only. |
| `/mag` as one writer over the vault | Magazine command, editorial and thin-client paths exist in merged source. A single writer over the Teajia `Workflow/` folder and its shared lock are not established by those paths. |
| Dormant provider code moved to `runtime/_donors/`; `runtime/src/shell` deleted | Not done. |
| Off-Mac agent access, data-folder `INDEX.md`, route/service split by domain | Not started. |

## Not started

These briefs describe features with no code behind them. Treat them as plans.

- **S01 Material first review**: Keep, Remove from working view, Permanently delete, Needs review with a reason. Only a "prepared, not connected" panel exists (`stage-work-surfaces.js`); there is no service or route, and permanent delete is not built.
- **S02 review cards**: Worth keeping, Needs your judgment, Removal candidates. No code.
- **S02 readable bilingual dialogue**: no Source-screen code; the dormant magazine translation services are not wired to it.
- **S05 voice and expression sheet** editable from the writing surface. No code.

## Installed checkpoints, 20 October

Standalone Collection learning, optional source-free Project connection, scoped current understanding/typed references/direction connections and work receipts are now installed alongside C3. Synthetic native proof covers pickup fallback, source/evidence acceptance and known/unknown impact, inherited direction/local override with sibling preservation, dirty context detours, bounded preparation/recovery and whole-Carousel completion facts. Exact installed bytes and read-only Learning library→same editor/words plus usable receipt controls are separately verified. These statements supersede older candidate-only notes below for those named edges, not all product functions.

Automatic one project-backed writing text at first typing, explicit earlier-browser-text reconciliation and expanded existing-receipt/session history are now installed as a separate bounded checkpoint. Synthetic native proof covers writes/conflicts/preview/new-operation restore/Undo; actual installed review is read-only and leaves existing earlier wording pending. Actual provider execution, private content-repository synchronization, device access, universal history and publication remain separate. See [the same integration list](../product/DESIGN-PASS-ADDITIONS.md#installed-connected-c3-checkpoint--20-october).

## Section by section

Scheduling and detailed proof remain on Delivery's existing checklist. This map gives the designer and builder one shared purpose/action/status/finish contract; it does not start twelve new implementations. Build is the sole shared integration/activation owner. Delivery sequences bounded helpers and source delivery; Root owns intent and final human acceptance.

| Section | Current connection state | Remaining observable finish criterion | Owner |
| --- | --- | --- | --- |
| 1 Material | Project folders, file/note intake, fresh-browser reconnection, Open material folder and Links & photo albums are installed and bounded checks pass. | Folder action verified on the actual selected project; same-project file/import discovery has synthetic proof. Actual supplied-album access remains untested; unsupported providers retain links, and saved links have no retry/refresh yet. | Build; Delivery verifies. |
| 2 Source | Kept lookup/reference plus native notes/compact reader and maintained correction/Undo owner are installed. Known legacy entrypoints were fenced; originals, notes and backups retained unchanged. | Notes → exact speech → correction/save/reload/stale refusal/exact Undo passed on synthetic content; installed kept dialogue navigation passed read-only. Preserve source-hash review states and eligible-Undo limits in the future UI; no ASR/translation/audio alignment inferred. | Sole Build owns the installed writer and controlled rollback; Delivery retains proof. |
| 3 Research | Independent Research now renders/edits the same substantial source-linked shared record without an output/part gate; agent/app/save/switch/reload/conflict/exact Undo verified on synthetic content. | Local shared-brief journey passes; real installed existing brief checked read-only. Broader retrieval/model/Atlas/book work remains unconnected. Current source hash is not factual verification; do not substitute freeform notes for every per-point capability. | Build owns installed connection; provider/account gates remain separate. |
| 4 Direction | Shared concept notes, exact personal words and explicit decisions persist; later manual sections survive guarded agent saves. | Same-record Research → Direction navigation is verified with no adoption/write. Deliberate output reuse remains separate; preserve rejected alternatives, local scope and editable shared brief without rewriting independent wording. | Build. |
| 5 Write | Existing direct editing and independent supported text drafts work. | The selected project/output uses the correct current wording through edit/save/switch/return/reload/Undo; source/decision changes never silently replace text. | Build; reuse completed preservation proof unless changed. |
| 6 Read | Existing continuous manuscript modes share the selected work. | Reading/return position and annotations remain tied to the same current output; unsupported format or earlier/unsaved view is explicit. | Build; verify changed combined journey. |
| 7 Check | Existing revision-bound review contracts are bounded; real provider/client access is not established. | Findings target the exact supported output/revision, distinguish not-run/empty/stale/error, and cannot mutate newer wording or imply a run that never happened. | Build for local routes; account/provider gate only when indispensable. |
| 8 Media | Saved native Article/Carousel occurrence lookup and actual Media → exact Article frame / Carousel slide-photo → same original source return are installed and boundedly verified. Photo swap, eligible Undo and native reorder update actual uses. | Coverage is one exact native root, not all Library or video. Unknown uses remain unknown; reorder topology retains its existing Undo limit. | Build; no new timeline or rescreening. |
| 9 Arrange | Existing article/portrait-carousel composition contracts are preserved. | Placement/order/caption edits and exact Undo persist on the chosen output/edition and agree with actual used-where data. | Build; reuse unchanged composition/export proof. |
| 10 Audience | Installed read-only designed Article/whole portrait sequence now reuses the maintained renderers; the combined synthetic journey downloaded exact HTML and eight 1080×1350 PNGs. Existing styles and real private data stayed unchanged. | Review the exact selected edition and produce only its supported artifact; stale source/photo or failure refuses safely and leaves recovery. | Build; no fabricated unsupported export. |
| 11 Share | Durable recipient/output/edition-scoped local invitations, replies, reviewed translations, correction references, explicit facts and saved Undo are installed and boundedly verified. Failed-save/newer-tail recovery retains exact fields. | Unsaved browser fields use this tab session; saved records persist on disk. Translation, sending and verified publication are not implied; source/edition drift flags earlier invitations. | Build for local contracts; human for real communication. |
| 12 Outputs | Existing project/output access and saved draft register work; authored-collection prose now correctly permits independent Post/Product listing creation, verified through native save/switch/reload/exact Undo. | Open the matching real project/output/edition, add a supported independent draft and retain honest review/export/publication status through return/reload. | Build. |

Material, bounded Source and local shared Research/Direction continuity are delivered. Remaining combined-output work includes the observed blank-collection root/topology edge: the authored-collection → Post/Product listing preflight mismatch is repaired and installed. Actual synthetic shared learning/root prose → both independent short formats → own editing/save/switch/reload/exact Undo passed, with prior notes/root/sibling output unchanged. The later combined Article/Carousel composition/Audience/export checkpoint is installed and boundedly verified. That checkpoint exposed lost unsent rapid visual edits; the subsequent installed recovery repair now preserves the complete tail before dispatch and restores it after forced reload, source conflict and offline failure without re-entry. Separate browser copies remain readable/downloadable; newer canonical words are held for explicit review, never automatically merged or overwritten. Audience/Arrange mode highlighting also matches the shown surface. This is bounded composition recovery proof, not completion of every dirty-draft detour or the whole application. Article topology and donor protections remain intact. This does not generate wording or prove broader Direction-to-all-format reuse. Provider, account and unsupported-format gates are recorded precisely; they do not stop independent local work. No new engine, database, source migration or provider activation is authorized by this map.

## Where proof lives

Dated receipts are in the installed home's `verification/` and, for history, in [docs/history](../history/). Candidate proof is labelled apart from installed behavior. Present in the interface, connected, verified and human-accepted are four different states.
