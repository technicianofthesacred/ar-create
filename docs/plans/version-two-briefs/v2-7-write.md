# Piece 7a: Write inside version two

You are the builder of one screen. Work only in the git worktree you are given, on its own branch. Do not push. Commit
your work in that worktree when you finish so the director can take it (one commit, plain message, no model name).

## Read first

1. `CLAUDE.md`, `docs/plans/2026-11-11-version-two.md` (all of it), "Rules for every worker" in
   `docs/plans/2026-11-11-direction-d-build.md`, `public/v2/README.md`, `docs/START.md`, `docs/product/LOOK.md`.
2. The sample Adrian approved by eye. Fetch it beside your worktree, never into it:
   `git fetch origin claude/ar-create-design-round && git worktree add <scratch>/design origin/claude/ar-create-design-round`.
   Open `design/2026-11-better-interface/d-four-stations/index.html#write` in a browser at 1440 and 390 wide, dark and
   light. Read the Write parts of its `app.js` and `app.css`, and its README and BUILD-PLAN. Take its layout, wording
   and behaviour. Do not copy its invented data or its kit files.
3. How the existing workspace does Write today: the Write section under `public/document-study/` (find the code that
   reads and saves the draft, shows an assistant's proposed words, accepts or rejects them, holds the record while he
   types, keeps unsaved words safe across a reload, and reports that he has unsaved words open). Version two must use
   the same commands and the same safety, not a second way.
4. `public/v2/screens/subject.js` (how a step opens its tool and how Write opens Advanced today) and
   `public/v2/shell/` (read only).

## What to build

A Write screen in version two for one piece of one subject, at an address that names the subject and the piece (for
example `write/:id` with `?piece=<output id>`; choose what fits the router and say what you chose).

- It looks as the sample's Write screen looks, at 1440 and 390, dark and light. The page he writes on keeps the look
  of the approved Write page in the existing workspace (its face, measure and spacing); the contract says "Write keeps
  its approved page". Where the two disagree about the page itself, the existing approved page wins; everywhere around
  it the sample wins.
- It shows only real records: the real draft of that piece, read through the commands.
- He can write and his words are saved through the same command the existing workspace uses, with the revision he
  read. A newer version on the server is never merged for him and never overwritten: show him both and let him choose.
  Unsaved words survive a reload, as they do in the existing workspace.
- His words are his. An assistant's words arrive as a proposal (as `magazine.write` and the existing proposal commands
  make them) and are shown where the sample shows them; only he can accept or reject. If the page is opened by an
  assistant (`?reviewActor=agent:...`), a save or a decision answers 403 and the screen shows that message plainly.
- Every part of the sample's Write screen that has no command behind it sits in the sample's place and says it is not
  built yet (`v2.ui.notBuilt`). No speech button: the browser's speech service would send his voice away.
- The top bar's Advanced, and an "Open in Advanced" on the screen, lead to the same subject, piece and the write
  section of the existing workspace.
- The Subject screen's Write step opens this screen instead of Advanced. Read and Check still open Advanced; they are
  the next stage.
- When another actor changes the draft or adds a proposal while the screen is open, the screen shows it (the change
  stream, `ctx.on`), without touching words he has typed and not yet saved.

Prefer no new command. If the job truly cannot be done with the existing ones, add the smallest command in
`runtime/commands.mjs` by the rules, and say so in your report.

## Files you may touch

- New: `public/v2/screens/write.js`, `public/v2/screens/write.css`, `tests/v2-write.test.mjs`.
- `public/v2/index.html`: only the two lines that load your screen.
- `public/v2/README.md`: only the route in the list of routes.
- `tests/v2-shell.test.mjs`: only the list of screens, if the new screen must be in it.
- `public/v2/screens/subject.js`: only where the Write step leads.
- `scripts/review-sideways.mjs`: only if it needs teaching how to reach your screen.
- Nothing under `public/document-study/`. Nothing else under `public/v2/shell/`. If you believe the shell must change,
  stop and say exactly what and why in your report instead of changing it.

## The rules that most often get broken

Only the six type sizes through the `--v2-t*` tokens. Only the app's colour tokens. No em dash anywhere. Nothing
scrolls sideways at 390, 700, 1000 or 1440. Keyboard reachable. Escape every record's text. Never `fetch` a command;
use `v2.call`. Never port 8841; never the home; a test server is `AR_CREATE_PORT=<your port> npm run demo`, filled
with `AR_CREATE_URL=http://127.0.0.1:<your port> npm run demo:fill`. Stop it when you finish.

## Done looks like

- In the demo: from Home, open a subject with an Article, press its Write step, land on the new screen, type a
  sentence, see it saved, reload and see it still there; open the same piece in Advanced and see the same words.
- An assistant's proposal made through the CLI or the command shows on the screen; accepting it as him puts the words
  in the draft; the same press as an assistant shows the 403 message.
- `npm run build`; your own tests and `tests/v2-shell.test.mjs` green; `node scripts/review-sideways.mjs
  --only=v2:<your id>` plain and with `--stress` clean; `node --test public/document-study/*.test.mjs` shows only the
  three known failures. Do not run the whole `npm test`; the director does.
- One contact sheet, a single PNG no wider than 1600 pixels: your screen at 1440 and 390, dark and light, beside the
  sample's Write at the same four. Save it where your task says.

## Report, under 250 words

What now works on screen and through which commands; the address you chose; files changed; every part shown as not
built yet and why; anything in the sample you could not match and why; test results with the names of any failures;
where the contact sheet is; anything you were unsure of. Plain sentences, no pasted code.
