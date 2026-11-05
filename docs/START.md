# AR Create: start here

Read [AGENTS.md](../AGENTS.md) first: it says which CLI to run, where code may be edited, and how to drive the browser as an agent. This page is enough to act. Intent lives in [product/PRODUCT.md](product/PRODUCT.md); capabilities and revision evidence are in [status/CURRENT.md](status/CURRENT.md).

## The product in one view

**Library** holds every source and personal note once, with a permanent identity. **Collections** are reusable inquiries over Library sources: questions, evidence, evolving understanding. **Pieces** are independently edited expressions (article, carousel, script, post, shared note). **Projects** optionally connect Collections and Pieces. Twelve **sections** are entrances to that work, never gates. Groups: Gather (01-02), Develop (03-04), Make (05-09), Deliver (10-12).

### Sections: one name each

| ID | Canonical label | Aliases in older text and code | Brief |
|---|---|---|---|
| 01 | Material | Intake | [01](product/sections/01-material.md) |
| 02 | Source | Transcripts & sources, Transcript | [02](product/sections/02-transcripts.md) |
| 03 | Research | Learning | [03](product/sections/03-research.md) |
| 04 | Direction | Pick, Concept | [04](product/sections/04-direction.md) |
| 05 | Write | Draft | [05](product/sections/05-draft.md) |
| 06 | Read | Read & refine | [06](product/sections/06-read-refine.md) |
| 07 | Check | Check changes, Checked | [07](product/sections/07-check-changes.md) |
| 08 | Media | Photos | [08](product/sections/08-media.md) |
| 09 | Arrange | Placed | [09](product/sections/09-arrange.md) |
| 10 | Audience | Review & release, Look | [10](product/sections/10-review-release.md) |
| 11 | Share | Share & celebrate, Feedback | [11](product/sections/11-share-celebrate.md) |
| 12 | Outputs | Published & complete, Confirmed | [12](product/sections/12-published-complete.md) |

### Code names to product concepts

| Code name | Product concept |
|---|---|
| `study`, `document-study`, `donor/study` | The app itself. The page is `/document-study/index.html`; `runtime/` is the server. `mcp/study` and `tools/concept-cli.mjs` remain only as aliases for older callers; the entrance is `agents/cli/ar-create.mjs` (and `agents/mcp/server.mjs`). |
| `donor` | Code copied in from other projects (`mag`, `study`, `teajia`, `wordforge`); not product vocabulary. |
| `wordforge` | A markdown bridge copied from i64os. Unrelated to i64os's oracle writing tool. |
| `mag`, `magazine` | The Teajia magazine services, being folded into AR Create as one writer over the vault. |
| `first-flow` | The original Magazine first-run flow: project binding and research preparation. Still routed; its commands sit under Research. |
| `shared-article`, `shared-carousel` | Pieces of kind article and carousel (the proposal and accept path). |
| `pieces` (API, data) | The saved technical workspace records, not the product term. Pieces are expressions. |
| `inquiry`, `inquiries` (API) | A Collection with its own learning record. |
| `concept`, `concepts` (API, CLI `project`) | The shared Markdown brief of a Project: your thoughts, provisional ideas, source links, saved as human direction. |
| `collection` (Library) | A named grouping of sources, a UUID in `library-index.json`. Not an inquiry. |
| `collection` (`create-collection`, "authored collection root") | The pre-output project folder. Same thing as the **working root** below. |
| `project`, `parentStudyId` | A Project's identity in the older APIs. Agents pass `parentStudyId`. |
| working root | `study-draft-copies/copies/<bindingUUID>/workflow/Workflow/`, holding `DEV - Collection.md` and the Piece's working text. |

## The screen: approved Combined workspace

The current design authority is the Combined workspace approved 30 October, recorded in [PRODUCT](product/PRODUCT.md#the-design-baseline) and its dated decision log. Home, Subjects, subject boards, piece tabs, Write/Read/Check modes, contextual sheets and visible Outputs are the approved direction. Earlier [C workbench previews](../design/three-directions/c-workbench/index.html) are historical references, not the current acceptance target.

Full desktop and phone, light and dark, functional and visual acceptance remains open. [CURRENT](status/CURRENT.md) separates source capabilities, recorded installed revision, measured test revision and acceptance limits. Regenerate it with fresh release and test inputs before using its snapshot to assess the running app; a source candidate or test run on another revision does not establish installed behavior.

To inspect current evidence without replacing the committed snapshot, run `node scripts/gen-status.mjs --tests <summary.json> --release "<home>/RELEASE.json" --out /tmp/ar-create-current.md`. The summary records the actual run’s `tests`, `pass`, `fail`, `skipped`, full `sha` and optional `at`. Plain TAP remains a measured run but cannot establish its revision; a matching full revision still does not imply all tests passed or human acceptance. Typography and product conventions remain in [PRODUCT](product/PRODUCT.md#design-baseline-and-typography).

## Where data lives

All paths are under the home's `data/`. Read them through the CLI, never directly.

| Folder or file | Holds |
|---|---|
| `library/`, `library-index.json` | Sources, personal notes, Library collections, evidence cards |
| `study-project-bindings/`, `pieces/`, `state.json` | Project and piece identities and saved workspace state |
| `study-draft-copies/` | Working roots and the Piece's working text |
| `workspaces/<projectId>/` | `HUMAN-DIRECTION.md` (the concept brief), its history |
| `articles/`, `carousels/`, `native-outputs/` | Output wording, editions, exports |
| `source-history/`, transcript owner | Transcript sessions and corrections |
| `simmer-boards/` | Simmer board layout per project: groups, block order, notes and answers, the commit sentence, the dish he named in chat and the Library Collection the board gathers into. Photos and his exact words stay in Library; the sent sentence is saved as the project's human direction |
| `instagram-plans/` | Instagram studio plans: Library ids of the transcript and photos, its lines and timestamped moments (exact slices), words to confirm and Adrian's confirmations, the coverage marks, proposed stories with read-backs, layouts per format, his choice and his yes. `<id>.asks.json` records which words were put on Needs you |
| `consent-desk/` | The truth and consent desk, one record per piece (`parentStudyId` + `pieceKey`, default `main`): claims and quotes with their source moment, people with how they appear and their consent, Share's comfort and accuracy answers, the override and the release. Agents use `consent desk|open|claim|link|flag|person|draft`; consent answers, recording a sent request, the Share answers, the override and the final yes are `human:adrian` only. Every way out is held while anyone is unanswered: Outputs exports and their downloads, Magazine `send`, `mark-published`, `export.save` and the working-HTML export, and the Instagram studio's Ready to post, frame PNGs and reel words. A held path answers 423 (CLI exit 4, `consent_hold`) with who is unanswered and a link to the desk; Adrian's override, or the answers, lets it through. A piece known by two ids (the app's project id and the Magazine story id `mag-<slug>`, tied together by the draft file) is held by a desk saved under either. An Instagram plan reads the desk of its `subject`; with none it uses the desk that links its Library sources, and with neither it refuses Ready to post ("Link this to a piece first so consent can be checked.") |
| `voice-corrections/` | Adrian's rewrites of machine paragraphs from a finished read-through: before, after, piece, and whether he approved, dropped or sent each one |
| `word-library/` | The shared word library (`library.json`: one entry per name or term with its mishearings and where it came from) and one record per checked recording (`recordings/<jobId>.json`: what was fixed and its receipt, the doubtful words, Adrian's answers). The transcription job reads `library.json` for its prompt; everything else goes through `words list|export|check|recognise|add`. Agents suggest words and never confirm them; answering a doubtful word and confirming a suggestion are `human:adrian` from the app only. See [WORDS](WORDS.md) |
| `transcript-checks/` | One record per checked recording (`<jobId>.json`): the model's suggestions for that transcript, sorted into sure fixes, lines that are probably not the speaker and lines that need Adrian's ear, each with its reason; and his decision on each (used with the exact words, kept as heard, or left out of the talk), who decided and when. A use writes through the recording owner's correction receipts; leaving a line out changes no transcript bytes. Screen: `/transcript-check/index.html?job=<jobId>`, linked from the recording view. Agents read and may ask for suggestions; deciding is `human:adrian` from the app's own page only |
| `i64os-directions.json` | Optional override `{"directionsDir": "<absolute path>"}`: where AR Create reads his voice (`voice-profile.md`, `body-of-work.md`) in one copy. With no file it finds the i64os checkout's `substrate/directions` under `~/Documents/Files/4 Coding/` or `~/Documents/Files/2 Areas/Coding/`; with neither present it uses the old local copies in `guidance/` |
| `phone-pickup/` | The phone pickup: `state.json` (last check) and one record per phone recording (where it got to, never audio or the key). See [PHONE-PICKUP](PHONE-PICKUP.md) |
| `journal/<yyyy-mm>.jsonl`, `leases/<kind>/<id>.json` | Who did what; who holds what |
| `provenance/`, `*-requests/` | Actor stamps, proposals awaiting a human |

## Actors, leases, journal

Actor values: `human:adrian`, `agent:claude-code|codex|claude-design|hermes|grok|chatgpt`, `cron:<name>`, `import:<source>`, `release:<sha>`. They are honest labels on this Mac, not authentication. Clients: `ui`, `cli`, `mcp`, `http`, `file`.

- **Browser**: the page's default author is `human:adrian`. An agent opens `http://127.0.0.1:8841/document-study/index.html?reviewActor=agent:<name>` so its actions are stamped as its own; an unlisted name blocks every request.
- **Lease**: `lease acquire --input '{"scope":{"kind":"project","id":"<parentStudyId>"},"reason":"..."}'`. Fifteen minutes, renewable. A live foreign lease answers 423 with the holder. Scope kinds: project, collection, draft, output, piece, source, share, concept, research, media, library.
- **Journal**: every committed, rejected or conflicting write is one line. `history` reads it.
- **Handoff**: `handoff --input '{"scope":{...},"to":"human:adrian","summary":"<=280 chars"}'` when you stop.
- **Ask**: `ask --input '{"scope":{...},"question":"<=280 chars","options":["a","b"]}'` for a decision only Adrian can make; it shows in the app.
- **Needs you**: `needs raise --input '{"band":"only-adrian"|"steer","question":"<=280","choices":[...],"about":"..."}'` puts a question on Home's one "Needs you" list; `needs list` (or `call needs-you --input '{"status":"all"}'`) reads it, including what Adrian answered and any steer default that applied. Only Adrian asks never apply themselves. A steer ask also needs `default` (one of the choices) and `applyAt` (ISO time the default applies if he does not answer). A step only a human takes (publish, send, consent) carries `link:{label,href}` to its screen. You raise and read; you never answer: `needs-you.answer` is human-only, from the app's own page.
- **Events**: `events --input '{"since":<cursor>}'` and the status `editor` field tell you whether Adrian has unsaved words.

## Recipe: read a project and save a concept note

With `AR_CREATE_URL`, `AR_CREATE_ACTOR` and `CLI` (the installed CLI path) set as in AGENTS.md:

Everything down to `library search` is read-only and safe to run first; the lease and save lines are writes.

```sh
node "$CLI" status
node "$CLI" project list
echo '{"parentStudyId":"<id>"}' | node "$CLI" project read --input -
echo '{"parentStudyId":"<id>","query":"<words>","limit":5}' | node "$CLI" library search --input -
echo '{"scope":{"kind":"project","id":"<id>"},"reason":"saving a concept note"}' | node "$CLI" lease acquire --input -
echo '{"parentStudyId":"<id>","operationId":"<new uuid>","expectedRevision":<n>,"expectedHash":"<hash>","authorThoughts":"<the read's thoughts, then Adrian's new words appended>","dictated":true,"aiInterpretation":"<yours, provisional>","suggestions":"","sourceSelections":[]}' | node "$CLI" project save --input -
echo '{"scope":{"kind":"project","id":"<id>"}}' | node "$CLI" lease release --input -
```

`project list` shows only projects that already have a concept. If `<id>` is missing, `project read` answers 404: run `project create` with `{"parentStudyId","title","operationId"}` first. Copy `expectedRevision` and `expectedHash` from the read. An agent writes `aiInterpretation`, `suggestions` and `sourceSelections`. Adrian's own words go in by dictation: keep `authorThoughts` exactly as read and append what he said, verbatim, at the end, with `"dictated":true`; the history marks that save as dictated through you. With nothing to append, copy `authorThoughts` unchanged and leave `dictated` out. Changing, reordering or deleting his thoughts, or the adopted direction, answers 403 (exit 5). If the read says `structured:false`, save the exact text as `body` instead of the four fields. A `sourceSelections` entry needs `sourceId`, `sourceHash`, `quote` and `start` copied from `library read`. Exit codes: 3 is 409 (re-read), 4 is 423, 5 is 403. Concept saves without an actor answer 400.

## Recipe: Simmer from a chat

Adrian gathers, it simmers, he names the dish, then it is drafted. `simmer intake` carries photos from a folder he names and his exact words into a Library Collection and onto the board (a new subject from `title`, or an existing `subject`); his words are saved as his, stamped `dictated` with the carrier. `simmer material <subject>` reads the board, the Collection's text and Direction. `simmer propose` adds an agent's groupings, reflection letter, two or three possible dishes, questions and feeling checks, each shown as proposed by that agent (it needs the board's `expectedRevision` and `expectedHash`). `simmer name` records the sentence he says when he names the dish, exactly, and makes it Direction's adopted direction unless Direction already holds a sentence he chose another way. Cron and import writers cannot carry his words. The full run is in `skills/ar-create-concepts/SKILL.md`.

## Releasing

Only `scripts/release.mjs` writes the installed app. Run it from a clean worktree of `origin/main`:

```sh
node scripts/release.mjs --home "$HOME/Library/Application Support/i64os/ar-create" --tag vYYYY.MM.DD-N --deps-from "<that worktree>" --built-by agent:<name>
```

Add `--dry-run` first to see what it would do. The rules:

- **`--tag <name>` is required.** It creates an annotated local tag and prints the push command; it never pushes.
- **The file list is computed by the release.** `source-manifest.json` is no longer tracked, and `scripts/refresh-manifest.mjs` is a read-only viewer (`--out <file>`). Nothing needs refreshing before a release.
- **CI must be green.** The release checks the GitHub check run named `ci` for the commit. `--no-ci-check "<reason>"` and `--hotfix "<reason>"` override it; both write the reason to the journal.
- **At most two releases a day per home.**
- **`--candidate`** builds a separate home for a trial and refuses 8841 and the permanent home.
- **`--deps-from`** is accepted only from inside the checkout or the home.
- `npm run build` regenerates `docs/CAPABILITIES.md`; commit the result.

It builds, swaps `service/`, keeps `service.prev/` and writes `RELEASE.json`. `--rollback` and `--verify` exist. It never touches `data/`, `config/` or `state/`, and never restarts anything. Whoever runs it is recorded in `builtBy`.

## Rules that do not bend

Keep Adrian's exact words, protections and rejection reasons. Never last-write-wins; keep both versions. Shared origins, independent expressions: a change flags other outputs and never rewrites them. Stale, dirty or unsupported work refuses to save. No new engine, database, provider or publication from docs alone. Present, connected, verified and human-accepted are four different states.

**Order of authority** (stated here once). For intent: the latest dated decision, then PRODUCT, the section brief, LOOK. For what is true today: CURRENT.md, then the code, which always wins over any document.
