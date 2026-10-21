# Step 2: persistent nested Library and Media folders

Requirements C02/C04/C05/C06, S01/S08. This is stacked on the full Workbench interface correction. Neither PR installs anything.

Folders and memberships live in the existing Library index and use existing command, journal, actor and lease paths. Library and Media are separate domains. Filing preserves the original source ID and bytes; move/link/unlink alter memberships, never original files. Media recognizes image/video metadata without rewriting legacy source kinds. Empty-folder removal, cycle refusal, exact revision/hash guards, idempotence and eligible exact Undo are tested.

The existing project Inbox and current-piece photo surface remain entrances. All sources, Unsorted and nested folders use one bounded browser with search/type/sort, multiselect, preview/Back, filing, drag-to-folder and explicit non-drag alternatives. Original unsaved owner controls are preserved.

Focused proof: 13 browser tests and four storage/HTTP tests cover 2,000-source bounded rendering, unique recursive counts, preview/Back state, filing parameters, stale/offline refusal, nesting, independent domains, exact Undo, unchanged originals and legacy collections, MP4 eligibility and actual command lease behavior. Native Library proof creates a parent and nested child through UI, reloads and uses eligible saved Undo. See `native-hierarchy.json`. A separate native Media create → reload → saved Undo also restores its prior empty domain (`native-media.json`); an empty current-piece contact sheet cannot hide the reusable browser.

Limits: folder organization is logical metadata, not a physical source migration or cross-device synchronization. Native proof is synthetic and does not establish real private Media-file playback or phone-device behavior. Whole-Library Research remains step 3. Existing photographs/captions/placement owners are retained; step 4 still owns further picker work.
