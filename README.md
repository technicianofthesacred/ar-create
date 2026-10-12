# AR Create — code-only local candidate

This package preserves Document Study as a standalone loopback companion. It is a review candidate, not the installed editor or a production deployment. The installed service on port 8841 and its data remain untouched.

Use Node 22 or newer. From this directory, run `npm run setup`, `npm run build`, then `npm test`. Dependencies have their own `runtime/package-lock.json`; they are not added to the parent i64 workspace.

For an empty checkout, set `AR_CREATE_DATA_DIR` to a new absolute private directory outside the repository and run `npm start`. The default candidate URL is `http://127.0.0.1:8854/document-study/index.html`. Port 8841 is refused. An occupied port is preserved. Without original roots, owned Draft and original-source capabilities report that they are unconfigured; browser writing remains visibly browser-only.

`npm run demo` creates an entirely invented two-project fixture in the OS temporary directory and starts the same candidate. Synthetic data is marked in the screen. It never reads the personal vault or installed user-data. Stop it with Ctrl+C. Delete its printed temporary directory when no longer needed.

For explicit configuration, copy `config.example.json` outside Git, supply an absolute data directory, and set `AR_CREATE_CONFIG` to that file. Original roots are opt-in and require an explicit `catalog.projects` and `catalog.drafts` allowlist; paths inside that catalog are relative to the configured read-only roots. Each draft definition uses `parentStudyKey`, `partKey`, `title`, `path`, `contextScope` and `support` (relative path/role pairs). IDs preserve the current Document Study adapter contracts. No original audio receipt mapping is shipped; use owned recording intake or prepare a separately reviewed mapping.

Optional Python/model configuration, yt-dlp, Firecrawl and Codex paths are explicit host configuration. None of their environments, credentials, account sessions or model weights are packaged. Codex execution is unavailable unless explicitly configured, and fresh research stays disabled. `sharedArticles:true` and bounded editorial execution remain the existing runtime policy. An original reading-page URL is also optional; no localhost:8766 donor is assumed.

The maintained correspondence TypeScript, article codec, template geometry and browser donor sources build with the locked dependencies. Generated bundles are ignored and rebuilt, not treated as editable source. No photo assets or brand wordmark are included. Licensed EB Garamond, Shippori Mincho and Noto Serif TC fonts retain their OFL files; absent optional export fonts/assets remain outside this candidate's verified scope.

`source-manifest.json` records every allowed imported source and its original/candidate hash. `npm run verify:package` checks those included bytes for excluded payloads and machine paths. `workflow-records.js`, `reference-data.js`, recordings, manuscripts, photographs, source captures, real-content fixtures, saved state, credentials, backups, logs and proof screenshots are not source dependencies and are excluded.

The local i64 entrance is preserved separately. This package does not change `I64OS_AR_CREATE_HOME`, move installed data, widen access, activate a cutover, publish content, or configure remote-device access. A later cutover needs preservation of current browser state, capture absolute paths, source bindings and ownership journals.

The initial packaging lock was preserved at commit 16dff2fa. A subsequent bounded security repair pins the matching Tiptap family to 3.30.5, ProseMirror view to 1.42.3 and its required shared model to 1.25.11. Optional Tiptap menus are pinned to the same family to avoid incompatible peers. No unrelated dependency versions changed. npm audit now reports one low finding in Readability 0.5.0; its 0.6.0 update remains a separate ingestion compatibility task. Review npm native install-script policy before optional terminal/provider/ASR use. Verification covers the local synthetic editor, not the complete creative/export suite.

Official advisories: [Tiptap Markdown parsing](https://github.com/advisories/GHSA-j95f-988m-3j2f), [ProseMirror paste validation](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w). The packaged Markdown bridge uses mdast and the browser uses native contenteditable; source tracing found no invocation of the vulnerable upstream helpers/paste view in this current screen. Fixing the installed graph protects later reuse.
