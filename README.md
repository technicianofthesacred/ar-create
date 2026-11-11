# AR Create — private code repository

**Agents start at [AGENTS.md](AGENTS.md), then [docs/START.md](docs/START.md).** Product intent is [What we are building](docs/product/PRODUCT.md); what works today is [docs/status/CURRENT.md](docs/status/CURRENT.md); open work is [TODO.md](TODO.md).

This repository is the canonical code-only AR Create development home. It preserves Document Study as a standalone loopback companion integrated with i64 OS. Source delivery is separate from runtime deployment: `node scripts/release.mjs` is the only thing that writes the installed `service/`. This checkout contains none of the private data. See [access](docs/CLAUDE-ACCESS.md).

Use Node 22 or newer. From this directory, run `npm run setup`, `npm run build`, then `npm test`. Dependencies have their own `runtime/package-lock.json`; they are not added to the parent i64 workspace.

For an empty checkout, set `AR_CREATE_DATA_DIR` to a new absolute private directory outside the repository and run `npm start`. The default candidate URL is `http://127.0.0.1:8854/document-study/index.html`. Port 8841 is refused. An occupied port is preserved. Without original roots, owned Draft and original-source capabilities report that they are unconfigured; browser writing remains visibly browser-only.

`npm run demo` creates an entirely invented two-project fixture in the OS temporary directory and starts the same candidate. Synthetic data is marked in the screen. It never reads the personal vault or installed user-data. Stop it with Ctrl+C. Delete its printed temporary directory when no longer needed.

For explicit configuration, copy `config.example.json` outside Git, supply an absolute data directory, and set `AR_CREATE_CONFIG` to that file. Original roots are opt-in and require an explicit `catalog.projects` and `catalog.drafts` allowlist; paths inside that catalog are relative to the configured read-only roots. Each draft definition uses `parentStudyKey`, `partKey`, `title`, `path`, `contextScope` and `support` (relative path/role pairs). IDs preserve the current Document Study adapter contracts. No original audio receipt mapping is shipped; use owned recording intake or prepare a separately reviewed mapping.

Optional Python/model configuration, yt-dlp, Firecrawl and Codex paths are explicit host configuration. None of their environments, credentials, account sessions or model weights are packaged. Codex execution is unavailable unless explicitly configured, and fresh research stays disabled. `sharedArticles:true` and bounded editorial execution remain the existing runtime policy. An original reading-page URL is also optional; no localhost:8766 donor is assumed.

For Write generation, set `tools.codex` to the absolute executable that has been tested with the existing sign-in. A desktop-bundled CLI and the CLI on `PATH` can be different versions; executable presence alone does not prove that the selected model works. Optional `execution.provider`, `execution.model` and `execution.reasoningEffort` select the existing Codex transport for this host only. Omitted model/effort inherit the CLI configuration. Verify a synthetic request through Write before calling the connection ready; returned wording remains a proposal until human Finish.

The maintained correspondence TypeScript, article codec, template geometry and browser donor sources build with the locked dependencies. Generated bundles are ignored and rebuilt, not treated as editable source. No photo assets or brand wordmark are included. Licensed EB Garamond, Shippori Mincho and Noto Serif TC fonts retain their OFL files; absent optional export fonts/assets remain outside this candidate's verified scope.

The current package manifest is computed from tracked source by `scripts/lib/manifest.mjs`; there is no committed manifest to refresh. `npm run verify:package` checks that source for excluded payloads and machine paths. `workflow-records.js`, `reference-data.js`, recordings, manuscripts, photographs, source captures, real-content fixtures, saved state, credentials, backups, logs and proof screenshots are not source dependencies and are excluded.

The local i64 entrance and permanent home are owned separately. The verified 18 October relocation preserved current native/browser state and validated i64 open/return. [Permanent-home source](docs/PERMANENT-HOME.md) describes the startup-only capability and generic launcher templates; normal candidate startup still refuses8841. This source handoff performs no live cutover, public/private-content upload or remote-device setup.

The initial packaging lock was preserved at commit 16dff2fa. A subsequent bounded security repair pins the matching Tiptap family to 3.30.5, ProseMirror view to 1.42.3 and its required shared model to 1.25.11. Optional Tiptap menus are pinned to the same family to avoid incompatible peers. No unrelated dependency versions changed. npm audit now reports one low finding in Readability 0.5.0; its 0.6.0 update remains a separate ingestion compatibility task. Review npm native install-script policy before optional terminal/provider/ASR use. Verification covers the local synthetic editor, not the complete creative/export suite.

Official advisories: [Tiptap Markdown parsing](https://github.com/advisories/GHSA-j95f-988m-3j2f), [ProseMirror paste validation](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w). The packaged Markdown bridge uses mdast and the browser uses native contenteditable; source tracing found no invocation of the vulnerable upstream helpers/paste view in this current screen. Fixing the installed graph protects later reuse.

The synced Study AI delta adds the separate `mcp/study` official STDIO adapter, exact human wording protections/rejection history and native proposal review. `npm run setup` installs both locks independently. The six assistant tools can read/prepare/context/propose/review/status; Apply, Reject and protection changes remain human actions in the UI. Synthetic delta checks run with `node --test tests/study-ai-delta.test.mjs` or `npm test --prefix mcp/study`. That source package alone connects no account. The installed PR230 host has separately completed a real initial-Article request through its existing Codex configuration; see CURRENT for the bounded proof and pending human review.

The separately locked MCP server and client are now 2.4.0 after the bounded SDK repair. The earlier development SDK 2.0.0 OAuth warning is historical. The synthetic cloud qualification was closed with grants revoked and the tunnel stopped; no active remote connection is implied. Read CURRENT and obtain a fresh audit before further dependency or network-client work. Runtime and MCP lockfiles remain separate.

## Living section design briefs

Read the [section brief index](docs/product/sections/README.md) before changing a section’s purpose or interface. The twelve briefs are canonical developer requirements and proposed interactions, not claims of built functionality. Update the relevant brief and dated decision history as intent is discussed; keep implemented/verified/missing status separate and preserve independently progressing surface work.

Repository history was extracted only from the reviewed i64 `apps/ar-create` subtree. See [repository provenance and preservation](docs/history/REPOSITORY-PROVENANCE.md) and [i64 host integration](docs/I64-INTEGRATION.md). Private data/configuration remain outside Git. The installed runtime/data have moved to the separately verified permanent home; source/history extraction did not migrate originals.

Use the [developer workspace index](docs/WORKSPACE.md) to find code, the twelve briefs, synthetic examples, host/config boundaries and external ownership receipts.
