# Workbench step 2 — saved Library and Media folders

**Goal:** Implement the already-approved Workbench nested-folder browser with durable filing, without installation or changing writing/recovery authority. Requirements C02/C03/C04/C05/C06, S01/S08. Human approved the design and step 1; no new design selection is needed.

## Contract and boundaries

- Existing `library-index.json` remains the single owner. An optional additive folder registry stores logical hierarchy and source-ID memberships for `library` and `media` domains. Originals, physical paths, source identities, old collections, evidence and output placement records do not move or change. No new database or dependency.
- GET `/api/library/folders?domain=library|media` returns `{schema:'ar-create.library-folders.v1',domain,revision,indexHash,folders,sources,undoOperationId}`. Folder `{id,name,parentId,sourceIds}`; parent null means root. Sources use the existing public Library metadata/blob references. Media includes images/videos. Preserve unavailable references visibly.
- POST `/api/library/folders` accepts `{domain,action,operationId,expectedRevision,expectedHash,folderId?,parentId?,name?,sourceIds?,undoOperationId?}`. Actions: `create`, `rename`, `reparent`, `link`, `move`, `unlink`, `remove`, `undo`. Responses return the updated GET view plus receipt and optional `selectedFolderId`. Link preserves existing memberships; move replaces memberships only in this domain; unlink removes only one membership; remove refuses folders containing children or items. Undo restores the exact preceding filing state, not source files. Reject cycles, wrong-domain parents, stale guards, changed UUID payloads and unsupported IDs. Normal command registry actor/lease/journal applies to UI/CLI/MCP alike.
- Keep the 66px rail, adjacent 240px panel, type tokens, visible A−/A+, Read/Write parity and all twelve section handlers. Library Inbox remains the original Material surface. All sources/Unsorted/nested folders open the approved one-line/two-line browser in the work area. Media adds the same browser; the existing current-piece contact sheet remains directly reachable. Browse/preview does not approve, edit or place anything.
- Folder panel supports expanding, create/rename/nest, breadcrumbs, recursive unique counts, keyboard actions, drag-to-folder and a non-drag filing alternative. Work list supports search/type filtering/sort, multi-select, link/move/unlink, exact one-item preview and return to the same list position. Virtualize large lists. Browser-local preferences may remember navigation only; source/folder data comes from the service.

## Parallel ownership

1. Storage owner: `runtime/services/library-folders.mjs`, bounded integration in `runtime/services/library.mjs` and `runtime/commands.mjs`, plus `tests/library-folders.test.mjs`. Test persistence/re-open, independent domains, cycles, unique recursive counts/membership, stale writes, idempotence, Undo and unchanged originals/legacy records. Start with failing tests; no frontend edits.
2. Browser owner: `public/document-study/folder-browser.js`, `folder-browser.css`, `tests/folder-browser.test.mjs`. Use the API above and approved Workbench layout; no backend or rail edits. Expose `window.workbenchFolderBrowser` with `panelSpec(domain)` and `refresh()`. Register with `c3Workbench.registerPanel(1|8,spec)`. Spec has `{name,open,aria,rows:()=>state,body:data=>html,press:key=>...,afterRender:node=>...}`; panel body is owned by this spec only, avoiding competing decorators. Use the existing shell registry after rail. Native existing intake/contact-sheet routes remain reachable.
3. Root: add that narrow rail extension hook and load the browser module/styles, synthetic demo fixture, docs/manifest, end-to-end review and the separate PR. Do not overlap owners' files.

## Finish checks

- Focused service/UI tests, one final full `npm test` compared by exact failing names against main, package allowlist verification.
- Synthetic native demo: create a three-level folder, file the same source in two folders, move a folder, reject a cycle, rename, search/preview, reload/restart and see durable hierarchy; Undo restores exact memberships. Repeat Media with actual invented image bytes and a video metadata fixture, preserving original hashes and usage references. Check 2,000-item virtualized list bounds without huge default fixture.
- Repeat Read/Write geometry, An Cha/Hong Kong identity opening and edit/save/switch/reload/saved Undo. Inspect light/dark desktop/390px screens and visible-control hit targets. Record synthetic evidence, not private content.
- Source-only PR based on reviewed step 1 while #20 remains open; do not merge either PR or install. Steps 3/4 stay separate.

## Latest human correction — exact reference, 21 October

The exact intended design is https://claude.ai/artifact/8p78JP1HLJYKQXXVFQoMj9. The human says the demo does not fully apply it. Step 1 proves navigation, typography and preserved interactions, not full visual parity. Many section layouts remain from the prior interface. Do not equate its 48 default-screen geometry checks with a comparison against every approved Workbench screen.

The available browser currently shows “Sign in to view this page” for that artifact. No source mapping for this ID was found in the repository; do not assert that the saved C Workbench revision is byte-identical to this artifact. New UI implementation is paused pending access/source verification. Bounded folder-storage implementation may continue independently. Preserve all current candidate work.

Known gaps relative to the saved repository prototype include the Bench/resume layout, complete per-section work-area compositions, real Library/Media browser surfaces, Research detail/console split, and tool-drawer behavior. Saved folder functions, Research retrieval and Arrange templates were already divided into later PRs; those functional boundaries do not excuse retaining the wrong approved visual surface. Compare the exact reference screen by screen before claiming full design application.

## Latest human correction — 21 October

The repository prototype `design/three-directions/c-workbench/` is the authoritative reference. No artifact login is needed. Apply the complete interface and each section layout, not merely rail and typography. Preserve actual owners and connections; verify against the rendered prototype. This supersedes the earlier visual-authority pause. Demo only; no installation.
