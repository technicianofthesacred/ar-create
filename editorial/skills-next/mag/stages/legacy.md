# Off this Mac: the VPS and innerstellar

AR Create runs only on the Mac (Adrian's D2, 2026-10-21). On another machine, /mag works as it did before 2026-10-21, writing the files directly, with two changes: the lock is taken exactly as below, and nothing on the Mac's AR Create is called. MAG and FILES come from the `MAG_VAULT` and `MAG_FILES` settings, not the Mac paths.

## One /mag at a time, on any machine

1. Read `Workflow/_mag-running.md` in MAG. If it exists and its `since:` is under 2 hours old, stop and tell Adrian in one line which machine is working and since when (`holder: ar-create` means AR Create on the Mac). Do nothing else. If it is older than 2 hours, also stop: only Adrian clears an old lock, from AR Create on the Mac.
2. Otherwise create it (never over an existing one): `machine: <hostname>`, `since: <date and time>`, `doing: <the step>`, `holder: mag-session`. Update `doing` as you move between stories.
3. Delete it as the last thing of the run, even if the run stopped early.

## Writing

- Make and fill files in `Workflow/` only (see `MAG/.ai-draft-ok`), keep STATUS.md and the issue indexes in `Issues/` up to date. Never edit a RAW file or anything in `Writing/`. Never change a line Adrian added or changed.
- Drafts, his CONTEXT note, FEEDBACK messages and post words: write them, but say in the ASK file that they wait for his yes (the Mac's AR Create will show them as changed files when it next reads the folder).
- Intake: `bash ~/builds/mag-intake.sh "Title" "<file in Drop>" ["<voice note>"] [--lang zh|en|auto] [--terms clay,puerh]` (the file moves into `…/Magazine/[Title]/`; RAW lands in `Workflow/0-Inbox/`; RAW is never overwritten).
- Tidy: `node ~/builds/mag-tidy.mjs`, then `--apply`.
- The page on this machine (`mag-preview.mjs` with `MAG_ARC=legacy`) takes the same lock for each save.

Everything else follows the stage files as written.
