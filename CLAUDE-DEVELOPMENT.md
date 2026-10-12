# Develop AR Create in Claude

## Start with this checkout

Canonical repository: `technicianofthesacred/ar-create`, branch `main`. AR Create now has its own development home; i64 OS retains the host/launcher integration. The previous code-only package remains preserved in i64 until a separately verified transition. Select this private repository and branch in Claude's GitHub integration, or use your authorized local checkout. This document provides code/design context; it does not configure a provider account or share real content.

The packaged baseline includes the completed Material, Study AI continuity, and source-review → matching direction → exact native request checkpoints. Newer live work may still be in progress; use `source-manifest.json` to identify the exact copied code and hashes. Do not copy a live application's whole folder to update it. Bring in only a reviewed stable code delta, retain the private exclusions and keep the repaired runtime dependency overlay.

From the repository root, use Node 22 or newer and run these commands in order:

```sh
npm run setup
```

```sh
npm run build
```

```sh
npm run demo
```

Open `http://127.0.0.1:8854/document-study/index.html`. Demo mode creates two invented projects in a temporary directory outside Git. If that port is already occupied, preserve the listener and use a spare candidate port:

```sh
AR_CREATE_PORT=8859 npm run demo
```

The installed private editor uses port 8841. Candidate startup refuses that port. Do not replace its launcher, change the OS entrance's private home, migrate files, or activate a cutover as part of visual development.

## Source map

| Work | Source |
|---|---|
| Script/style mounting and document route | `public/document-study/index.html` |
| Project sidebar, document interaction, twelve checkpoints and browser state | `public/document-study/study.js`, `study.css` |
| Approved sans-serif Draft, Margin/Focus, continuous editing | `public/document-study/draft-surface.js`, `draft-surface.css` |
| Owned manuscript binding, save/recovery/Undo UI | `public/document-study/draft-flow.js`, `draft-flow.css` |
| Material intake, source display and hidden editorial annotations | `public/document-study/material-surface.js`, `material-surface.css`, `stage-flow.js` |
| Source choice/review, retained reads and Research → Direction → existing Draft | `public/document-study/source-continuation.js`, `source-continuation.css` |
| Scoped saved human direction | `public/document-study/human-direction.js`, `human-direction.css` |
| Before/proposed review and explicit Apply/Reject | `public/document-study/study-ai-proposals.js`, `study-ai-proposals.css` |
| Exact wording protection and reasoned release | `public/document-study/study-exact-wording.js`, `study-exact-wording.css` |
| Photos collection and stage mounting | `public/document-study/study-photos.js`, `study-photos.css`, `photos-stage.js` |
| Template geometry and maintained renderers | `public/document-study/donor/`, `runtime/src/donors/mag/carousel/` |
| Loopback startup and host-only configuration | `serve.mjs`, `config.mjs`, `config.example.json` |
| HTTP routes and current authorities | `runtime/server.mjs`, `runtime/store.mjs`, `runtime/services/` |
| Native exact-byte correspondence | `runtime/src/native/correspondence.ts` |
| Article codec and source-aware Markdown bridge | `runtime/src/workspaces/article-codec.ts`, `runtime/src/donors/wordforge/` |
| Six fixed-identity assistant tools | `mcp/study/server.mjs`, `mcp/study/README.md` |
| Synthetic inputs and focused checks | `fixtures/`, `scripts/demo.mjs`, `tests/` |

Paths in this table are relative to this repository root. Edit maintained source, then rebuild generated correspondence, codecs and browser template wrappers with `npm run build`. Generated outputs are ignored; editing them directly loses work on rebuild.

## Preserve while improving visuals

- Keep document-first sans-serif reading, the project sidebar, Draft Margin/Focus and direct continuous typing. Preserve the appropriate stage-specific tools; do not impose the Draft layout on every stage or add a third shell.
- Keep all twelve checkpoint entrances. The visible checkpoints do not claim every creative/export/publishing interaction is complete.
- Preserve exact human wording, original source/capture bytes, stable project/part/paragraph identities, scoped direction, independent outputs, revision checks and saved Undo. Browser-unsaved words must remain recoverable and must never be overwritten by a newer file automatically.
- Keep source speech/evidence distinct from human direction and proposed prose. Project research and matching-part research have different scopes. Adding material never regenerates approved text.
- Suggestions remain pending until a person explicitly applies or rejects them. Protection/rejection intent is part of captured context. Stale, switched, dirty or unsupported work must refuse mutation rather than pretend success.
- Keep the six assistant tools limited to read, prepare, context, propose, review and status. They expose no Apply/Reject or human-protection mutation. Synthetic proof is not live model execution.
- Keep compact defaults, readable actions, theme coherence and usable desktop/phone hit targets. Hide secondary provenance under disclosure, avoid horizontal overflow and needless vertical stacking. Inspect rendered light/dark/narrow screens for the changed surface.

## Verify proportionately

For adapter/proposal/context changes:

```sh
node --test tests/study-ai-delta.test.mjs
```

For source selection/review and direction continuation:

```sh
node --test tests/source-continuation.test.mjs runtime/services/material-request-seam.test.mjs
```

For native persistence changes:

```sh
node --test tests/synthetic-save.test.mjs
```

For package/privacy/configuration changes:

```sh
npm run verify:package
```

```sh
npm test
```

Run only affected checks while editing, then a coherent verification and native synthetic screen/file journey. A visual-only edit does not need repeated unchanged backend suites. Refresh only the reviewed manifest entries for deliberately changed source; do not drop the allowlist scan to make it pass.

## Private content remains outside Git

A normal checkout starts empty without private roots. Use an explicit external data directory or an external config file through `AR_CREATE_DATA_DIR` / `AR_CREATE_CONFIG`. Read `README.md` for the exact config/catalog contract. Do not commit that private config, credentials or account sessions.

Never add real interviews/transcripts, manuscript copies, photographs/audio, immutable source captures, saved decisions/request histories, provider payloads, model weights, personal guidance, proof screenshots/logs or backups. In particular, `workflow-records.js` and `reference-data.js` were content bundles, not safe application code. Use invented fixtures for design and tests.

The runtime and the SDK have separate locks. Preserve the Tiptap/ProseMirror repair recorded in the source manifest. Runtime has a low Readability residual; the separate development SDK client has a high OAuth advisory. No OAuth/provider setup is included. SDK compatibility remediation and complete terminal/ASR/export acceptance remain separate work.

## Private storage and offline direction: planned, not installed

The agreed direction is separate code and content homes: private text/revision metadata available on the VPS and computer replicas, with offline computer editing; large originals primarily on explicitly selected computers, with private previews and media availability receipts. The chosen hosting/authentication, replica protocol, stable portable identities, conditional revision writes, queued offline work and conflict review still require implementation and synthetic acceptance. Do not claim the current localhost editor is synchronized, server-blind encrypted or accessible on a phone.

Never silently let last-write-wins discard a simultaneous edit. Preserve both variants, distinguish media previews from original bytes, keep synchronization distinct from encrypted/versioned backup, and prove restore. Phone offline editing and eviction/quota behavior are later bounded work. No private text upload, new networking exposure or file relocation is authorized by this design handoff.

## Current coverage for design work

| Checkpoints | Preserved working baseline | Still incomplete |
|---|---|---|
| 1–2 Material | Owned intake/source display, exact saved review and scoped human direction; annotations disclosed | New real recording/ASR/correction workflow is not accepted by the synthetic checkout |
| 3–4 Research / Pick | Selected eligible source capture, retained source reads, durable review, matching direction, exact existing Draft continuation | Fresh live research and full new-output generation remain disabled/unverified |
| 5–6 Draft / Read | Continuous native edits, Margin/Focus, scoped proposals, human Apply/Reject, exact wording protection and saved Undo | Complete new manuscripts and arbitrary complex formatting proposals are outside this checkpoint |
| 7 Checked | Existing mechanical quote/split checks and stale-state behavior | Full editorial/semantic certification is not claimed |
| 8–10 Photos / Placed / Look | Owned photo collection and retained template/render machinery | Complete original-media mapping, composition, export and publication acceptance remain unfinished |
| 11–12 Feedback / Confirmed | Retained checkpoint entrances | Full delivery/feedback/final confirmation workflow remains unfinished |

Claims marked unresolved in retained research must remain recorded statements requiring evidence; source retention does not turn them into supported facts. Source additions or reviews outside a selected request must not silently enter that request or change its exact scoped intent.

## Living section design briefs

Read the [section brief index](docs/sections/README.md) before changing a section’s purpose or interface. The twelve briefs are canonical developer requirements and proposed interactions, not claims of built functionality. Update the relevant brief and dated decision history as intent is discussed; keep implemented/verified/missing status separate and preserve independently progressing surface work.

Use the [developer workspace index](docs/WORKSPACE.md) to find code, the twelve briefs, synthetic examples, host/config boundaries and external ownership receipts.
