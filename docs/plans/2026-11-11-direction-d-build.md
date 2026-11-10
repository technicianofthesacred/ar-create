# Direction D, first build: codes, looks, accounts, placed things

Approved by Adrian on 10 November 2026 (the "first night" in `design/2026-11-better-interface/BUILD-PLAN.md` on branch
`claude/ar-create-design-round`). One director, workers on other models, each piece reviewed by a second model before
it is kept. This file is the contract every worker follows and the running record of what is done.

## What Adrian asked for

1. Every Carousel layout has a short code he can say aloud ("use C1, 2 and 5"). Layouts keep growing.
2. A look per brand: colours, type, logo, its own marks and graphics, rules. A look file is a `DESIGN.md` for that
   brand, and can be pulled from a project that already has one, so nothing is rebuilt by hand.
3. Any layout can be drawn in any look. Marks and characters that belong to one brand stay with that brand.
4. Accounts are separate from looks. A look can post to several accounts; the account is chosen per post. More
   accounts will come.
5. A slide can carry placed things (logo, mark, graphic, picture). A slide can be saved as a new template. An
   assistant can add a new template.
6. One back end, many doors. Whatever he does by talking to an assistant or in the app updates the same records and
   files. Every assistant (Claude, ChatGPT, any other) reaches them through the same commands.
7. It works on the records he already has. Nothing he has made may stop working, and no sample data stands in for his.
8. No sideways scrolling on any screen at any width.

## Rules for every worker

- Work only inside the folder you are given. Never touch the running app's home, port 8841 or the vault. A test
  server is `npm run demo` on port 8854 only, and only the worker told to use it.
- **Every new ability is a command** in the one command registry (`runtime/commands.mjs`), so the page, the CLI
  (`agents/cli/ar-create.mjs`), the MCP server and plain HTTP all share it. Follow how the existing `instagram.*`
  commands are declared, who may call them, and how they stamp the actor and write the journal. Decisions that are
  Adrian's alone (publish, accept, confirm, choose, ready) stay human-only. Assistants propose.
- **Records are plain, named files** under the home's `data/`, written through the existing store helpers, never by
  hand: one folder per kind, one folder or file per thing, names a person can read. Shipped starting points live in
  the repository; what he makes or changes lives in the home and wins over the shipped copy.
- **Old records keep working with no migration step.** An old layout number (P06, H1, AR-P1) still resolves. An
  Instagram plan that only has a `door` resolves to that door's look and its usual account.
- Test first. Add focused tests beside the existing ones (`node --test`), with invented content only. Before you
  report, run `npm run build` and the whole `npm test`, and `npm run verify:package`. Never skip or weaken a test to
  get green. If a test that was green before you started is red, fix your change.
- Do not rename ids, `data-*` hooks or `.workflowStep` buttons that the look modules find (see
  `docs/product/LOOK.md`). Generated files are changed by changing their generator.
- Words on screen: plain, the names the app already shows (Carousel, Looks, Account, Template), no em dash.
- Screens: Graphite controls and the existing tokens, phone first, both themes, and nothing scrolls sideways at
  390, 700, 1000 or 1440 wide.
- Do not commit. Leave your changes in the working folder; the director commits after review.
- Report in under 250 words: what now works, the commands added, the files changed, the test counts before and
  after, and anything you were unsure of or left undone.

## The pieces, in order

1. **Codes.** One place gives every layout its code from its row and place (C covers, S photo beside words, P plates
   and bands, B full photo with a box, M several photographs, N chapters and numbers, F full picture, A single posts,
   J the three jiā, E closes, Y and Z the two earlier rows; the rows and order are the Instagram system canvas's, as
   in `design/2026-11-better-interface/make-slides-data.mjs` on the design branch). The other templates get codes too.
   A code is never reused. Anywhere a layout id is accepted, a code is accepted. `instagram.templates` returns code,
   row and name.
2. **Looks.** A look is a folder holding a `DESIGN.md` (front matter with colour, type and logo values; prose rules
   below) and its assets. Shipped looks for Teajia, Art, Mandala Codes and Personal, taken from the brand's own
   project where one exists. The renderer draws any layout in any look by role (ground, box, line, headline,
   supporting, label, accent, for dark and light), swaps the logo, and leaves out what belongs to another brand.
   Commands to list, read, save and import a look from a `DESIGN.md`.
3. **Accounts.** Records with a name, the service, and the looks that post there. A plan carries its account.
   Commands to list, save, and set the account on a plan.
4. **Placed things and templates.** A slide carries a list of placed things with kind, position and size, drawn by
   the renderer and exported with the slide. A command saves a slide as a template with the next free code in its
   row. A command lets an assistant add a template from markup, checked and made safe.
5. **Build by codes.** One command turns a spoken or typed line of codes into the layouts of a plan, in order.
6. **The studio shows it.** In the existing Instagram studio: codes on every layout, the look switch, the account,
   placed things, save as a template, and the line for saying codes.

A second track, in its own folder, with no change to any screen:

7. **Where a subject lives.** Folder, tags, pin and hand-set order move from the browser onto the subject's record on
   the server, with commands, so every door sees the same Home. What the browser already holds is carried over the
   first time it is seen, never lost.

## Record

| Piece | Built by | Reviewed by | State |
|---|---|---|---|
| 1 Codes | Sonnet | Opus | Done. Every layout has a code; old numbers still work; a code never picks an older layout of the same name |
| 2 Looks | | | |
| 3 Accounts | | | |
| 4 Placed things and templates | | | |
| 5 Build by codes | Sonnet | Opus | Done. `instagram.plan.codes` and `instagram codes --say`; canvas numbers said by mistake are explained, not guessed |
| 6 The studio shows it | | | |
| 7 Where a subject lives | | | |
