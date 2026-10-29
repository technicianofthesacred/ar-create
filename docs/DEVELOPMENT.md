# Develop AR Create

Read [AGENTS.md](../AGENTS.md) and [START.md](START.md) first, then the relevant section brief in [product/sections](product/sections/README.md) and the current Delivery assignment before editing. Name the requirement IDs and observable finish criterion; report candidate, installed and accepted behavior separately.

## Start with this checkout

Canonical repository: `technicianofthesacred/ar-create`, branch `main`, is the only source of code and intent. i64 OS provides the entrance (`/ar-create`, in i64os PR #208) and no longer carries a copy of the app. Use an authorized local checkout, or Claude's GitHub integration for a code-only read. This document provides code/design context; it does not configure a provider account or share real content.

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
| Document-first Draft, Margin/Focus, continuous editing | `public/document-study/draft-surface.js`, `draft-surface.css` |
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
| The shell: sidebar, bar, work column, inspector | `public/document-study/shell.js`, `piece-state.js`, `checkpoint-rail.*`, `surface-bar.*`, `inspector.*`, `empty-states.*`, `tree.js`; gate: `tests/shell-gate.test.mjs` |
| One command registry, CLI and MCP for agents | `runtime/commands.mjs`, `agents/cli/ar-create.mjs`, `agents/mcp/server.mjs`, `agents/lib/` |
| Actor, events, presence, leases, journal | `runtime/services/actor.mjs`, `events.mjs`, `presence.mjs`, `leases.mjs`, `journal.mjs` |
| Recorded releases of the installed app | `scripts/release.mjs`, `scripts/refresh-manifest.mjs`, `source-manifest.json` |
| Synthetic inputs and focused checks | `fixtures/`, `scripts/demo.mjs`, `tests/` |

Paths in this table are relative to this repository root. Edit maintained source, then rebuild generated correspondence, codecs and browser template wrappers with `npm run build`. Generated outputs are ignored; editing them directly loses work on rebuild.

## Preserve while improving visuals

- Keep document-first reading, the project sidebar, Draft Margin/Focus and direct continuous typing. Typography follows the one rule in [PRODUCT: Typography](product/PRODUCT.md#typography); controls remain sans serif. Preserve the appropriate stage-specific tools; do not impose the Draft layout on every stage or add a third shell.
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

## Private content stays outside the code repository and the installed `service/`

Private content lives in the home's `data/`, never in this repository and never inside `service/` (the release refuses any file that is not in the manifest). Separately authorized private content backing, the private `teajia-magazine` repository, is allowed. A normal checkout starts empty without private roots. Use an explicit external data directory or an external config file through `AR_CREATE_DATA_DIR` / `AR_CREATE_CONFIG`. Read `README.md` for the exact config/catalog contract. Do not commit that private config, credentials or account sessions.

Never add real interviews/transcripts, manuscript copies, photographs/audio, immutable source captures, saved decisions/request histories, provider payloads, model weights, personal guidance, proof screenshots/logs or backups. In particular, `workflow-records.js` and `reference-data.js` were content bundles, not safe application code. Use invented fixtures for design and tests.

The runtime and the SDK have separate locks. Preserve the Tiptap/ProseMirror repair recorded in the source manifest. Runtime has a low Readability residual; the separate development SDK client has a high OAuth advisory. No OAuth/provider setup is included. SDK compatibility remediation and complete terminal/ASR/export acceptance remain separate work.

## Private storage and offline direction: planned, not installed

The agreed direction is separate code and content homes: private text/revision metadata available on the VPS and computer replicas, with offline computer editing; large originals primarily on explicitly selected computers, with private previews and media availability receipts. The chosen hosting/authentication, replica protocol, stable portable identities, conditional revision writes, queued offline work and conflict review still require implementation and synthetic acceptance. Do not claim the current localhost editor is synchronized, server-blind encrypted or accessible on a phone.

Never silently let last-write-wins discard a simultaneous edit. Preserve both variants, distinguish media previews from original bytes, keep synchronization distinct from encrypted/versioned backup, and prove restore. Phone offline editing and eviction/quota behavior are later bounded work. No private text upload, new networking exposure or file relocation is authorized by this design handoff.

## Current coverage

What works today is stated once, in [status/CURRENT.md](status/CURRENT.md). The older baseline table that lived here is retired.

## Living section design briefs

Read the [section brief index](product/sections/README.md) before changing a section’s purpose or interface. The twelve briefs are canonical developer requirements and proposed interactions, not claims of built functionality. Update the relevant brief and dated decision history as intent is discussed; keep implemented/verified/missing status separate and preserve independently progressing surface work.

Use the [developer workspace index](WORKSPACE.md) to find code, the twelve briefs, synthetic examples, host/config boundaries and external ownership receipts.

## Current interface-design direction — 15 October clarification

The author wants Claude Design to redesign this interface while unfinished operations are connected. First express each existing agreed function in its proper section, with the relevant inputs/actions/review and honest not-connected states. Do not wait for every backend function before preparing the interface, and do not present prototypes as successful research, saves or exports. [PRODUCT](product/PRODUCT.md) and the twelve briefs govern the full intended surface; preserve the installed working connections and the sole integrator's activation ownership.

Typography follows [PRODUCT: Typography](product/PRODUCT.md#typography). Material collects/organizes/processes; Source reads/corrects sessions. Research includes the original learning, evidence, speaker judgment and reusable brief before Direction. Checked shows revision-bound work or a useful not-run/empty/stale state. Arrange edits composition; Look presents the audience edition and review/export. The older coverage table is a package-baseline limitation record, not permission to omit the intended UI or proof of current installed coverage.

## Magazine photo-library references

S08/S09 reuse the existing Library asset owner. `GET /api/magazine/library-photos` combines indexed Library photos, configured story Photos folders and all supported files in the maintained publication image directories, including unused photos. Its coverage reports unavailable formats and bounded scans. Catalog and preview requests do not import assets or edit manuscripts. The original configured files remain unchanged.

An explicit photo choice uses the existing human-only Magazine preparation/save flow. Preparation is classified as a mutation because it retains one immutable private Library original; the manuscript changes only through the existing guarded save. The native operation accepts exact asset identity/revision/hash and a plain optional description, never a caller filename, file path, image bytes or trusted capability. Current owner, block and source proofs are checked before retaining. Interrupted saves and exact saved Undo keep their existing authority.

A canonical DEV photo directive may reference `library-photo-<sha256>.<format>`. This is an immutable Library reference, not a file to look up in the publication checkout. The maintained inspection, Audience and working HTML export resolve and verify its private retained bytes through the Library owner. Do not manufacture these tokens, copy selected private photos into Git, replace them with absolute paths, or silently fall back to a similarly named publication image. Ordinary publication outside these working-output readers needs its own explicit asset-staging integration; this connection does not publish or upload images.

## Responsive local review service

The existing human-facing loopback review service needs an Interactive macOS launchd resource class. An explicit Background class can throttle thousands of bounded filesystem metadata checks until catalogue requests expire, even when an ordinary process reads the same configured originals quickly. Preserve the same job owner, port, program, roots, origin restrictions and approval configuration; this is an execution policy, not a new content/profile owner.

Compare like-for-like process policy when diagnosing return failures. Record fixed-phase reader timing without private prose, and distinguish catalogue completion from a visibly mounted native Article. Restart acceptance ties each opening to that exact run's readiness receipt and new native/review process IDs; retained helper closures must not read an older run's receipt. A DOM node existing before paint is insufficient final screen proof.
