# Magazine integration plan: AR Create becomes the one home for /mag and /arcreate

Status: plan only, 21 October 2026. Nothing here is built. Review items it settles: F-04, F-28, B12, D3 in `03-multi-agent.md`, DM-5 and DM-8 in `04-dual-mode.md`. Adrian's instruction (2026-10-21): "/mag somehow integrated with it all."

Every fact below was read on 21 October from the files named. "Measured" means read or run by this survey; "reported" means taken from the review.

## 0. Four corrections to the review, measured

1. **AR Create on `origin/main` does not write the real magazine folder.** `runtime/services/recordings.mjs` builds its magazine config with `magVault: <dataDir>/recordings/vault`, and `magazine/isolated-config.mjs` refuses any runner whose `magFiles`/`magVault` sit outside AR Create's own folder. Its `Workflow/0-Inbox` is a private copy with the same name. F-04's "AR Create intake writes Workflow/0-Inbox" holds only for that copy.
2. **AR Create reads the real folder in four places and copies out of it in one.** `study-originals.mjs` (catalogued originals, read-only), `magazine-portfolio.mjs` (a read-only port of `mag-status.mjs`), `article-make.mjs:17` (a hard-coded path to the real Magazine folder, used to read `SYSTEM.md` and `TEMPLATE.md` into its prompt), and `carousel-make.mjs:70` / `article-make.mjs:76` (they read `~/.claude/skills/mag|arcreate/...` stage files into prompts). `study-draft-copies.mjs openCopy` copies a vault DEV into an AR Create working copy (`draftAuthority: 'owned-working-copy'`), and edits to that copy never go back. **That copy is the real second source of truth today, not a second writer.**
3. **The unlocked writers of the real folder are the page and the sessions, not AR Create.** The 8766 page (`~/builds/mag-preview.mjs`) writes through `/answer`, `/edit`, `/make`, `/redo`, `/lineup`, `/approve`, `/album` and `/upload`. It checks `_mag-running.md` only in `/run-mag`. `/mag` and `/arcreate` sessions write directly on three machines: the Mac, the VPS and innerstellar (they are synced by Syncthing; `.stfolder` sits in the folder). There is a fourth, currently dormant, writer: the i64os vault router stamps `i64os-routed*` frontmatter (`apps/core/lib/vault-ingest/frontmatter.ts:151`). 22 magazine files carry it, the last dated 2026-06-23.
4. **The vault path in the brief is wrong.** The magazine is at `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine/` (called MAG below). `~/Documents/Obsidian Vault/Brands/Teajia/Magazine/` does not exist. Recordings and photos are in FILES: `~/Documents/Files/1 Areas/Brands/Teajia/Magazine/`.

The duplicated machinery is real, though. AR Create's `runtime/services/magazine/*` is a line-for-line copy of `~/builds/mag-local/*`, with the config swapped for the isolated one. Its `reference/mag-ask.mjs` and `mag-edit.mjs` are copies of the `~/builds` ones, and `first-flow.mjs` / `article-make.mjs` re-implement the research → brief → directions → draft prompts that the skills hold.

## 1. Today

### 1a. /mag, step by step (`~/.claude/skills/mag/SKILL.md` + `stages/*.md`)

| Step (whose move) | What runs | Reads | Writes |
|---|---|---|---|
| Lock | the session | `MAG/Workflow/_mag-running.md` | the same file: `machine`, `since`, `doing`. Another machine under 2 h old → stop. Deleted at the end of the run. Plain write, not exclusive. |
| Board | `node ~/builds/mag-status.mjs` (runs as the skill loads) | MAG frontmatter and filenames, drop folders | nothing (read-only) |
| 1 Dropped in (Adrian) | drop folders (`MAG_DROPS` in `~/builds/mag-intake.config`: FILES `Drop/`, iCloud `Teajia Drop`), page `/upload` | — | the page saves into FILES `Drop/` |
| 1→2 Intake (Claude) | `~/builds/mag-intake.sh` → `mag-local/intake.mjs` (Whisper Large V3 MLX plus sherpa speaker separation, `~/Library/Application Support/Teajia/transcription-runtime`); text files go to the legacy bash path | the recording or transcript; `~/builds/tea-terms.json` | moves the file into `FILES/<story>/`, makes `Photos/`, puts a job in `FILES/.transcription-jobs/` (23 there) and `FILES/<story>/Transcription/<job>/`, adds `MAG/Workflow/0-Inbox/RAW - <story>.md` (hard-link publish, never overwritten), and exports to i64os (`i64-export.mjs`, project teajia / Transcripts) |
| 2 Source (Claude) | the session | RAW, SYSTEM.md §1, tea-terms | `1-Source/SRC - <story>.md`, `CONTEXT - <story>.md`, new variants in `tea-terms.json` |
| 3 Research + brief (Claude) | the session, following `arcreate/stages/research.md` and `brief.md` | SRC, the web (firecrawl) | `3-Develop/RESEARCH - …`, `BRIEF - …`, ledger questions in `ASK - …` |
| 3 Map (Claude) | `stages/map.md` | SRC, RESEARCH, `2-Guidance/MAP TEMPLATE.md` | `3-Develop/NOTES - …`, `2-Guidance/MAP - …` |
| 4 Your pick (Adrian) | page `/answer` → `mag-ask.mjs` | `ASK - …` | ticks in ASK; a dated line under "Adrian's decisions" in MAP (`record-to`) |
| 4→5 Plans, Draft (Claude) | `stages/develop.md`; `mag-check-quotes.mjs` | MAP, PLANS, TEMPLATE, `_style/gold-*.md` | `PLANS - …`, `3-Develop/DEV - <story> (story).md`, `_glossary-queue.md` |
| 5 Review (fresh agents) | `stages/review.md`: editor, two blind reads, rating; `mag-blind-text.mjs`, `mag-check-splits.mjs` | `_briefs/EDIT-BRIEF.md`, `BLIND-BRIEF.md`, EDITOR.md, RATING.md | the DEV (edited in place), `4-Review/CHECK - …` (49), `_blind/` (28), `SENSE - …`, NOTES |
| 6 Your read (Adrian) | page `/edit` → `mag-edit.mjs` (Google-Docs-style paragraph saves, `%%rework%%`) | DEV | the DEV, `4-Review/EDITS - <draft>.md` |
| 7 Changes checked (Claude) | quote and split checks | EDITS, DEV, SRC | CHECK |
| 8–9 Photos | Adrian drops into `FILES/<story>/Photos/`; `mag-photos.mjs` (iCloud shared album); the session places them | photos | photo notes in the DEV |
| 10 Look → publish (Adrian's word only) | `stages/publish.md`: a teajia worktree, `~/builds/mag-send.sh` → `teajia/scripts/mag-send.mjs`, vitest, PR | DEV, Photos | `teajia/src/pages/read/conversation/pieces/<piece>.story.ts`, `public/read/<slug>/`; `MAG/Issues/…`; `published:` in DEV |
| 11–12 Feedback | `FEEDBACK TEMPLATE.md` | RESEARCH "What we learned" | `6-Feedback/FEEDBACK - …` |
| Always | the session | — | `MAG/STATUS.md` (Adrian's board), ASK files, `WRITER-GUIDE.md` lessons, `_archive/Answered/` |
| Extra commands | `terms` (`tea-terms.mjs`), `tidy` (`mag-tidy.mjs`, `git mv` into `_archive/Superseded drafts/`) | — | queue rows; moved files |

The page at port 8766 (`com.teajia.mag-page`, 1,547 lines, also running on the VPS and innerstellar) is the desk: the story list, the 12-step bar, ASK buttons, live editing, "Make from this", the Instagram lineup and PNG export, the photo drop and the recordings workshop (`mag-local/workshop-ui.mjs`). `/run-mag` opens `claude "/mag resume"` (or `/arcreate <ask>`).

### 1b. /arcreate (`~/.claude/skills/arcreate/`)

1. **In:** Teajia hands the recording to /mag intake. Other brands follow their profile's "In" section, and no other profile exists yet.
2. **Clean record:** the magazine's SRC.
3. **Research** (`stages/research.md`) → `RESEARCH - …`, with ledger questions in ASK.
4. **Brief** (`stages/brief.md`) → `3-Develop/BRIEF - …`.
5. **Make on request** (`stages/make.md`): the page's `5-Social/REQUESTS.md` lines, then `5-Social/<KIND> - <story> - <words>.md` with `status: for-your-yes` → the page sets `words-yes` / `approved`. Re-cut runs automatically when the article reaches step 8. The look stage uses `~/builds/ig-templates.js`, and the page renders 1080×1350 PNGs.
6. **Brands** are in `brands/teajia.md` and `brands/_template.md` (five questions).

It takes the /mag lock and reads `mag/LESSONS.md`. It never calls AR Create, so its brief is a second brief beside AR Create's `/api/concept` (DM-5).

### 1c. AR Create today, magazine-related (`/private/tmp/wt-arc-mag` = `origin/main` 459a2d1)

| Service | Does | Real MAG/FILES? |
|---|---|---|
| `recordings.mjs` + `magazine/{intake,jobs,outputs,translation*,workshop-ui,conversation}.mjs` | the same transcription engine as `mag-local`, the recordings workshop, translation | isolated copy (`<data>/recordings/`). DM-8: no UI or agent caller. |
| `transcript-corrections.mjs`, `transcript-correction-ui.mjs`, `transcript-tool-connection.mjs` | segment and speaker correction, review, proposals | isolated |
| `ingestion.mjs` | YouTube, article and file intake ("adapted from Magazine's job pattern") | no |
| `first-flow.mjs` (+ `first-flow-editorial.mjs`) | research + brief + 2–3 directions via embedded Codex | no |
| `article-make.mjs` | the DEV draft from `mag/stages/source.md`, `arcreate/stages/research.md`, `brief.md`, `mag/stages/develop.md`, LESSONS, plus TEMPLATE and SYSTEM sections | reads the real SYSTEM and TEMPLATE |
| `carousel-make.mjs` | carousel words from `arcreate/stages/make.md`, `brands/teajia.md`, LESSONS | reads skill files |
| `magazine-portfolio.mjs` | the board, read-only, roots from `<data>/magazine-roots.json` | read-only |
| `study-originals.mjs` | a catalogued original reader, linking out to 8766 `/read/…` | read-only |
| `study-draft-copies.mjs` + `ar-project-folders.mjs` | working copies of a story: ASK answers (`reference/mag-ask.mjs`), paragraph edits plus the EDITS log (`reference/mag-edit.mjs`), receipts, undo, and the `_mag-running.md` lock taken with `wx` (exclusive create) | the bound root is the owned copy `<data>/…/workflow/`; real-root binding exists (`writableWorkingRecords`) but is unused |

### 1d. What is done twice

| Job | /mag or /arcreate copy | AR Create copy |
|---|---|---|
| Transcription + speakers | `~/builds/mag-local/*` | `runtime/services/magazine/*` (the same code) |
| Transcript clean-up (SRC) | session + SYSTEM §1 | `transcript-corrections.mjs` |
| Research, brief, directions/map | `arcreate/stages/research.md`, `brief.md`, `mag/stages/map.md` | `first-flow.mjs` |
| Draft | `mag/stages/develop.md` | `article-make.mjs` (reads the same stage files) |
| Carousel words | `arcreate/stages/make.md` | `carousel-make.mjs` (reads the same file) |
| ASK answers, live edits | `~/builds/mag-ask.mjs`, `mag-edit.mjs` | `reference/mag-ask.mjs`, `mag-edit.mjs` |
| Board | `mag-status.mjs`, `STATUS.md`, the 8766 desk | `magazine-portfolio.mjs`, Home |
| Stored draft | the vault DEV | the owned working copy (diverges) |

### 1e. Who writes what, and which lock

| Writer | Where | Lock today |
|---|---|---|
| /mag and /arcreate sessions (Mac, VPS, innerstellar) | MAG/Workflow, STATUS.md, Issues, WRITER-GUIDE, tea-terms.json, `_archive` | `_mag-running.md`, checked by hand, 2-hour staleness, not exclusive |
| 8766 page (all three machines) | ASK, DEV, EDITS, REQUESTS, 5-Social, Photos, Drop | none (only `/run-mag` checks) |
| mag-local intake | FILES/<story>, `.transcription-jobs`, RAW, the i64os export | none; RAW publish is exclusive (hard link) |
| mag-tidy | git moves inside the vault | none |
| i64os vault router | `i64os-routed*` frontmatter | none (dormant on this folder since June) |
| AR Create | its own data only | `wx` lock inside its owned copy, never the real one |

## 2. Target: one owner

### 2a. The rule

**On the Mac, the AR Create server (port 8841) is the only process that writes MAG/Workflow, `MAG/STATUS.md`, `MAG/Issues/` and the FILES story folders.** Sessions, the page, and later Hermes, Grok and ChatGPT go through its command registry: the CLI, MCP, or HTTP with `X-AR-Actor`. Every write is a compare-and-swap on the file's hash, stamped with the actor, journalled, and undoable where the kind allows.

**Storage stays where it is (D1).** The vault keeps the bytes, and AR Create keeps the index, receipts, journal, leases and events. Five reasons it stays put:
- Syncthing already replicates the vault to the VPS and innerstellar.
- The teajia publish tests read the vault DEV.
- The vault is a git repository (rollback and tidy history).
- Adrian reads it in Obsidian.
- `.ai-draft-ok` already scopes agent writes to `Workflow/`.

So the vault becomes "a read/write source behind one writer with one lock", and migration becomes registration, not copying (§4).

### 2b. The one lock

A new service, `runtime/services/magazine-vault/lock.mjs`, owns `MAG/Workflow/_mag-running.md`. It is the same file and meaning that /mag uses, so off-Mac runs still see it through Syncthing:

- It is created with `wx` and fsync, then removed after the transaction. This is the pattern in `ar-project-folders.mjs withRun`, generalised.
- The body becomes `machine`, `since`, `doing`, `holder: ar-create`, `actor`, `operation`, `pid`.
- **Same machine with a dead pid:** recovered automatically and journalled.
- **Another machine, under 2 hours old:** `423` with the holder's name, as /mag does today.
- **Another machine, 2 hours or older:** `423` with "needs recovery", plus a human-only `magazine lock recover` command.
- Story-level presence ("Claude is working on Tea Teacher") is a B8 lease of kind `story`, not this file. The file is held only for each write transaction, so the page and the sessions never wait on each other for minutes.

### 2c. Each /mag stage gets one owner

Sections are AR Create's twelve (`docs/sections/`). **Reuse** = the code is kept as it is and called through a command. **Move** = it moves into AR Create. **Retire** = it is deleted once its replacement is proven.

| /mag stage | AR Create section | Service / command | Moves | Reused as-is | Retired |
|---|---|---|---|---|---|
| Lock | (cross-cutting) | `magazine-vault/lock.mjs` | the lock semantics from SKILL.md into code | the `_mag-running.md` file and its 2 h rule | the hand-run lock steps in both SKILL.md files |
| Board, STATUS.md | Home / pieces list | `magazine-portfolio.mjs` → `magazine board`; `magazine-vault/status.mjs` regenerates STATUS.md's story table | the board logic (already ported) | `mag-status.mjs` stays as an offline fallback | the session's hand edits of the STATUS table (D6) |
| 1 Drop + intake | 01 Material | `recordings.mjs` gets a **magazine target**: for a brand-teajia project, `magFiles`/`magVault` bind to the real FILES/MAG through `magazine-vault`, not the isolated root. `material add-recording`; `magazine drops` lists and claims drop-folder files | the drop scan and the "move from Drop" rule from `mag-intake.sh` | `magazine/{intake,jobs,outputs}.mjs` (already the same as mag-local), the exclusive RAW publish, the transcription runtime | `~/builds/mag-local/` (after M5 has run green for one real story), `mag-intake.sh` becomes a 5-line shim that calls the CLI |
| 2 Source (SRC, CONTEXT) | 02 Transcripts | `transcript-corrections.mjs` for segment fixes; `magazine write --kind SRC\|CONTEXT` | — | `tea-terms.mjs` as a configured tool | — |
| 3 Research, brief | 03 Research | `first-flow.mjs` research+brief output saved as `RESEARCH`/`BRIEF` via `magazine write`; ledger → `magazine ask set` | the stage instructions → `editorial/stages/` (D5) | first-flow's evidence capture | the second brief (`/api/concept` and BRIEF become one record: BRIEF is the file, concept reads it) |
| 3 Map, 4 Pick | 04 Direction | `first-flow` directions → `MAP`; `ask.answer` with `record-to` (`reference/mag-ask.mjs`); `study-human-direction.mjs` reads the MAP decision | — | `mag-ask.mjs` format, record-to | `~/builds/mag-ask.mjs` write path (the page proxies) |
| 4→5 Plans, Draft | 05 Draft | `article-make.mjs` → a proposal; `draft accept` (human-only) writes the vault DEV through a **vault-bound** `ar-project-folders` binding (`draftAuthority: 'vault-bound'`) | the hard-coded `magazineRoot` → config | article-make's prompt assembly and checks | the owned working copy for magazine stories (§4 step 6) |
| 5 Review passes | 07 Check changes | `magazine write --kind CHECK\|BLIND\|SENSE\|NOTES`; fresh agents stay in the skill (Agent tool, sonnet) | `mag-check-quotes.mjs` and `mag-check-splits.mjs` → `magazine-vault/checks.mjs` (pure functions, unit-tested) | `mag-blind-text.mjs` | the `~/builds` copies of the checks |
| 6 Your read, live edits | 06 Read & refine | the `ar-project-folders` paragraph edit + EDITS log on the vault-bound DEV | — | `reference/mag-edit.mjs` (`%%rework%%`, the EDITS format) | `~/builds/mag-edit.mjs` write path (the page proxies) |
| 7 Changes checked | 07 Check changes | `study-draft-checks` + `magazine-vault/checks.mjs` | — | — | — |
| 8–9 Photos | 08 Media, 09 Arrange | `media-usage`; `material add-album` wraps `mag-photos.mjs` | — | `mag-photos.mjs` (never overwrites) | — |
| 10 Look, publish | 10 Review & release | `magazine send-check` runs `mag-send --check` (agent may); `magazine send` is `actors:['human']` and opens the teajia PR | — | `teajia/scripts/mag-send.mjs` and its vitest (the publish contract stays in teajia) | — |
| 11–12 Feedback, confirmed | 11 Share, 12 Published | `share-preparation.mjs` fills `FEEDBACK - …` from the template | — | the FEEDBACK template | — |
| Make (REQUESTS, 5-Social, IG look) | 10 / 12 outputs | `carousel-make.mjs` → `magazine write --kind CAROUSEL…` with `status: for-your-yes`; `approve` is human-only | `make.md` → `editorial/` | the page's lineup and PNG export (until the AR Create portrait template covers it) | — |
| tidy, terms | (maintenance) | `magazine tidy --dry-run\|--apply` (git mv via `mag-tidy.mjs`); `tea-terms` as a tool | — | `mag-tidy.mjs`, `tea-terms.mjs` | — |
| i64os transcript export | (cross-cutting) | event subscriber after RAW publish | — | `i64-export.mjs` | the export inside mag-local |

### 2d. The story list as AR Create projects and pieces

- **Project = story.** One AR Create collection per magazine story, created through the merged `createStudyCollection` (B6). New fields:
  - `brandId: 'teajia'`
  - `origin: {kind:'magazine', story:'<board name>', number:<STATUS number>}`
  - `vaultRecords: {raw, src, context, research, brief, notes, map, plans, ask, draft, edits, checks[], feedback, social[]}`: relative paths under MAG, each with its last seen hash.
- **Piece = a publishable part or output.** "An Cha Master" has pieces An Cha 1, 2 and 3 (DEV `part:`). Each project has one article piece by default and one piece per 5-Social file.
- The board is 10 stories (measured 21 Oct): An Cha Master, Lu Zhaokai, Shanyin Qiwu (live), Taiwan Tea Philosopher, Tea Teacher, Wood-Fired Potter, Yixing Masters, Hong Kong Day 1, Teaware Collector, Hong Kong, and UI-flow-part-01. UI-flow-part-01 and -02 are test recordings: register them as `archived` (D7).
- The story's step of 12 maps one to one onto AR Create's 12 sections, and Home shows "step N · whose move" from `magazine board`.

### 2e. The 8766 page

Phase 1 keeps the page, because Adrian chose the desk and uses it from his phone over Tailscale. **Its write endpoints become server-side proxies to `127.0.0.1:8841`** with `X-AR-Actor: human:adrian`, `client: mag-page`. AR Create stays loopback-only. Reads stay local. Phase 2 retires the page once the AR Create UI shows ASK buttons, live editing and the lineup (Track A). That is D3.

## 3. The skills become thin clients

The CLI contract is from review B6, being built on `claude/arc-backend`. Measured 21 Oct: no `agents/` or `runtime/commands.mjs` is committed there yet, so this plan names commands, not code.

`node <AR Create>/agents/cli/ar-create.mjs --actor agent:claude-code <subcommand>`, plus `call <command> --json '{…}'` for anything without sugar.

- **`/mag` SKILL.md** shrinks to about 60 lines:
  - It replaces the hand-run lock with nothing; AR Create holds the lock.
  - The board is `ar-create call magazine.board`.
  - Every "make/write file X" becomes `ar-create call magazine.write --kind … --story … --expected-hash …`, and every ASK becomes `magazine.ask.set`.
  - Intake becomes `material add-recording`.
  - The editor, blind and rating passes stay as fresh agents. They read through `magazine.read` and write through `magazine.write`.
  - The words, photos and working-with-Adrian rules (LESSONS.md) move to `editorial/LESSONS.md`. The skill points there.
  - Off-Mac (`hostname` is not this Mac, or 8841 is unreachable): the skill runs the **legacy path** described in D2, unchanged.
- **`/arcreate` SKILL.md:** research and brief call `first-flow` through `ar-create call research.run` / `magazine.write --kind RESEARCH|BRIEF`. Make calls `carousel.make` / `magazine.write --kind CAROUSEL|POST|REEL|VIDEO`. Brand selection reads `brand.read <id>`. Its stage files move to `editorial/stages/`.
- **Stage instructions** (`mag/stages/*.md`, `arcreate/stages/*.md`, LESSONS) move to the AR Create repo at `editorial/` (D5). `article-make.mjs` and `carousel-make.mjs` then read them from config `editorialRoot`, not `~/.claude/skills`, so the prompt pack is versioned with the code that uses it. Today `~/.claude/skills` and `~/builds` are not git repositories, and their only history is `.before-*` copies (measured).
- **Vault rule files** (`SYSTEM.md`, `TEMPLATE.md`, `EDITOR.md`, `RATING.md`, `WRITER-GUIDE.md`, `_briefs/`, `_style/`) stay in MAG. They are Adrian's editorial content and are read through `magazine-vault` with hashes.
- **Brand profiles:** `editorial/brands/<id>.md` (teajia, and `_template`). The AR Create field is **`project.brandId`**, and `brand.read <id>` returns the profile with its hash. A brand's write locations (Teajia: MAG/Workflow) come from config `brands.<id>.vaultRoot` / `filesRoot`, not from the prose profile.

## 4. Migrating the existing stories with zero data loss

Because the bytes stay in place, "migration" registers the stories and reconciles the two working copies. The coordinator executes this with Adrian's approval. No builder session runs it against real data.

1. **Rollback point.** Adrian commits the vault's pending magazine changes (`git status` shows 171 changed paths under `Brands/Teajia/Magazine`, measured; the vault repo has no remote). The commit SHA is recorded. FILES (1.5 GB) is not in git: record a hash manifest instead.
2. **Inventory (read-only).** `tools/magazine/inventory.mjs --mag <MAG> --files <FILES> --out <scratch>/inventory.json` lists every file under MAG (341) and FILES with its size, sha256, frontmatter keys, kind, story and archived flag, plus the 23 `.transcription-jobs`. It never prints body text. The summary goes to Adrian: stories, files per kind, and anything unparseable.
3. **Dry run.** `tools/magazine/register.mjs --dry-run` prints the project, piece and `vaultRecords` it would create for each story, flags ambiguity (two DEVs for one story, a CHECK naming a superseded draft) and writes nothing.
4. **Register.** With Adrian's yes: `register.mjs --apply` against the installed home **through the release (B3)**, never by a builder. It writes only AR Create index records (`data/magazine/index.json` + one binding per project) and a journal line `import:magazine-vault` per project.
5. **Hash proof.** Re-run the inventory and diff it against step 2. **Every MAG and FILES hash must be identical** (registration writes nothing there). The diff is saved to `HOME/verification/magazine-register-<date>.json`.
6. **Reconcile the owned working copies** (the two native stories in `draft-flow.js:5`, `ref-an-cha` and `hk`). For each one, compare the owned DEV hash with the vault DEV hash:
   - **Equal:** rebind it vault-bound and archive the owned copy (moved, not deleted, to `data/archive/owned-copies/`).
   - **Different:** show Adrian both versions side by side and let him choose per story (D7). Nothing is merged by itself.
7. **Rollback.** Remove `data/magazine/` and the new bindings, and restore the previous release. The vault is untouched by steps 2–5. If a later write step goes wrong, `git -C <vault> checkout <SHA> -- Brands/Teajia/Magazine` restores it. FILES writes are append-only (RAW, jobs, Photos), so rollback there means deleting what the journal lists.

## 5. Build steps (branch `claude/arc-mag`, one builder, run in order)

Owner `arc-mag` = this branch. Every step: synthetic vault fixture (`tests/fixtures/magazine/`: two stories, a drop folder, a live lock from another machine), demo port only, commit per step.

| Step | What | Files (arc-mag owns) | Verify | Depends on |
|---|---|---|---|---|
| M1 | Inventory + register tools, read-only by default | `tools/magazine/inventory.mjs`, `tools/magazine/register.mjs`, `tests/magazine-inventory.test.mjs` | inventory of the fixture is stable; `--dry-run` writes nothing (the fixture hash is unchanged) | — |
| M2 | `magazine-vault` service: bound real roots, the lock (§2b), CAS write by kind allowlist (Workflow kinds only, as in `.ai-draft-ok`; RAW write-once; never `Writing/`; STATUS.md and Issues only through their own commands), atomic writes, journal with actor | `runtime/services/magazine-vault/{index,lock,kinds,write}.mjs`, `tests/magazine-vault.test.mjs` | 409 on a stale hash; 423 on a foreign live lock; stale same-machine recovery; RAW refuses overwrite; a write outside Workflow refused | B5 (actor) |
| M3 | Commands: `magazine.board`, `.read`, `.write`, `.ask.set`, `.ask.answer` (human), `.drops`, `.lock.status`, `.lock.recover` (human), `.send-check`, `.send` (human), `.tidy`, `brand.read`. Exported as a list for the registry | `runtime/commands/magazine.mjs`, `tests/magazine-commands.test.mjs` | each command appears in `/api/capabilities`; human-only commands refuse `agent:*` | B6 |
| M4 | Projects from stories: `brandId`, `origin`, `vaultRecords`; vault-bound draft authority in the binding | `runtime/services/magazine-vault/projects.mjs`, `tests/magazine-projects.test.mjs` | a registered fixture story opens in the demo with its real DEV; an edit lands in the fixture vault with an EDITS line and a journal actor | M2, M3, B6 merged-collection |
| M5 | Intake to the real roots: the magazine target in recordings; the drop scan and claim; `material add-recording`; an event for the i64os export | `runtime/services/magazine-vault/intake.mjs` (wraps `magazine/jobs.mjs`, which is not edited) | fixture drop → FILES/<story>, RAW in the fixture Inbox, the drop emptied only after RAW exists; a second identical drop refused | M2; needs the recordings hook (below) |
| M6 | Checks as code: quotes and splits ported from `~/builds`, the same results on the fixture | `runtime/services/magazine-vault/checks.mjs`, `tests/magazine-checks.test.mjs` | output equals the `~/builds` scripts on 3 fixture drafts | — |
| M7 | Editorial pack: copy the stage files, LESSONS and brand profiles into `editorial/`, with a manifest of source hashes | `editorial/**`, `editorial/MANIFEST.json` | every file's hash equals its `~/.claude/skills` source at copy time | D5 |
| M8 | Page proxy: the 8766 write endpoints call 8841 (D3) | `~/builds/mag-preview.mjs` (outside the repo; keep a `.before-arc-proxy` copy) | the 8766 tests below on a fixture page; a lock-held write shows the holder | M3 |
| M9 | Thin skills: rewrite `/mag` and `/arcreate` SKILL.md and stages as CLI clients, with the off-Mac fallback kept | `~/.claude/skills/mag/**`, `~/.claude/skills/arcreate/**` | a dry `/mag status` through the CLI shows the same board lines as `mag-status.mjs` | M3, M7, B6 CLI |
| M10 | Retire: mag-local (after one real story runs through M5), `mag-intake.sh` → shim, the `~/builds` write paths of mag-ask/mag-edit, and owned copies for magazine stories | `~/builds/mag-intake.sh`, `~/builds/mag-local/` → `~/builds/_archive/` | nothing calls the retired paths (`grep`); the board is unchanged | M5, M8, §4 step 6 |
| M11 | Off-Mac (after Q4/D2): VPS/innerstellar write through an AR Create replica or the i64os proxy (B13) | — | — | B13, Q4 |

**Not owned by arc-mag, so no edits there:**
- `claude/arc-backend`: `runtime/server.mjs`, `runtime/commands.mjs`, `agents/**`, `tools/concept-cli.mjs`, `events.mjs`, `leases.mjs`, the B5 stamped services, `draft-flow.js`, `concept-work.mjs`.
- `claude/arc-ui`: `public/document-study/**`.
- `claude/arc-release`: `config.mjs`, `serve.mjs`, `scripts/**`, path constants, donors.

### Needs from other builders

- **arc-backend:**
  - The registry imports `runtime/commands/magazine.mjs` (one import plus a spread).
  - The actor middleware accepts `client: 'mag-page'`.
  - The lease kind `story` exists.
  - The event kinds `magazine.write`, `magazine.lock` and `recording.filed` exist.
  - `createStudyCollection` accepts and stores `brandId`, `origin` and `vaultRecords`.
  - `ar-project-folders.mjs` / `study-draft-copies.mjs` accept `draftAuthority: 'vault-bound'` with roots given by `magazine-vault` (a hook, not a rewrite).
  - `recordings.mjs` takes an optional `magazineTarget` factory.
- **arc-release:**
  - Config keys `magazine: {vaultRoot, filesRoot, drops[], writable:false}`, `brands.<id>`, `editorialRoot`, `tools.teaTerms`, `tools.magSend`.
  - The startup scratch-root refusal must allow the iCloud vault path.
  - Replace the hard-coded `magazineRoot` in `article-make.mjs:17` and the skill paths in `carousel-make.mjs` / `article-make.mjs` with `editorialRoot` and `magazine.vaultRoot`.
  - **Do not move `runtime/services/magazine/*` to `runtime/_donors/`**: `recordings.mjs` and `transcript-corrections.mjs` import it live. Only `runtime/src/donors/mag` is dormant.
  - The release manifest includes `editorial/**`.
- **arc-ui (phase 2):**
  - Home lists magazine projects as "step N of 12 · you/me".
  - ASK questions render as buttons in Direction and Read.
  - "Make from this" and the lineup.
- **i64os (separate repo):** exclude `Brands/Teajia/Magazine/` from the vault router's frontmatter stamping, or route it through `magazine.write` (D9).

## 6. Decisions only Adrian can make

| # | Decision | Recommendation |
|---|---|---|
| D1 | Where do the stories live? | Keep them in the vault; AR Create becomes its only writer and keeps the index. |
| D2 | What about /mag runs on the VPS and innerstellar (China)? | They keep writing directly under the shared lock until the VPS copy of AR Create exists. |
| D3 | What happens to the magazine page (8766)? | Keep it now, its buttons saving through AR Create; retire it when AR Create shows the same buttons. |
| D4 | Agents only propose prose: which magazine files count? | Drafts and post words wait for your yes; working notes (transcript, research, brief, notes, checks) save directly, with undo. |
| D5 | Where do the stage instructions and brand profiles live? | In the AR Create repo (`editorial/`), with version history. |
| D6 | STATUS.md | AR Create writes the story table; your own lines stay untouched. |
| D7 | The two AR Create story copies that may differ from the vault, and the two test recordings | You choose per story from a side-by-side view; the test recordings are archived. |
| D8 | Rollback point | Commit the vault's 171 pending magazine changes before migration. |
| D9 | The i64os vault router stamping magazine files | Exclude the magazine folder. |
