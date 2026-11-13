# Version three: the frame, and how a screen plugs in

Version three is the default front since 12 November 2026: the app's own address (`/`) and `/v3` open
`/v3/index.html`, keeping the query. Version two stays at `/v2/index.html` (and `/v2`), exactly as on main apart from
its one link "Version three"; the existing workspace (Advanced) stays at `/document-study/index.html`. The plan is
`docs/plans/2026-11-12-write-read-check-build.md`, "Version three beside version two". The look is
`design/2026-11-write/` (NOTES.md binds).

**The frame** (`shell/frame.js`, `shell/frame.css`): the band (the top bar, one solid surface with a clear edge under
it: Home, Research, Looks, Library; the subjects on the desk; Find, Needs you, Capture, the theme switch, then two quiet
links, "Version two" and "Advanced"), the phone bar (Home, Research, Capture, Needs you), the message area and the main
area. One shell only is loaded: version two's `shell.js` and its top bar never are.

**The contract is version two's.** `frame.js` gives the global `v2` with the same names as version two's shell (see
`public/v2/README.md`): `v2.screen`, `v2.call`, `v2.href`, `ctx.setAdvanced`, `v2.ui`, `v2.shared` and the rest. So a
version two screen file runs here unchanged, and a version three screen is written to the same contract. Version two's
command client, shared parts and Capture are loaded from `/v2/shell/` as they are, so a fix to how a command is called
lands in both fronts.

**The route table is `index.html`.** Each screen is the file that registers its route. Every screen version three has
not built yet is version two's file (`/v2/screens/<name>.js` and its `.css`). A screen version three builds takes its
address over by replacing version two's two files in `index.html` with its own (`screens/<name>.js`, `.css`). Two files
may never claim one route or one id: the frame refuses the second. Routes are hash routes shared by both fronts
(`#/subject/<id>`, `#/write/<id>?piece=<output id>`...), so a link drawn by a borrowed screen lands on whichever screen
answers that route here, inside this frame.

**Screens version three has built.** Write (`write/:id`, `#/write/<subject>?piece=<output id>`) is version three's own:
`screens/write.js`, `write-page.js`, `write-margin.js`, `write-versions.js` and `write.css`, listed in `index.html` in
place of version two's `write.js` and `write.css`. It is a copy of version two's Write with the approved look (one
`plaintext-only` element per paragraph, the page as a sheet in Lora, the hairline under kept phrases, Focus, the
failed-save panel, the phone bar); the saving machinery is copied on purpose (plan, "Shared or copied"). It keeps the
shared name `v2.shared.write` that Read and Check, still version two's files, use for their piece bar and for finding
the piece: the bar is drawn by version three's Write, in its look, with the subject's name taken from the page title
the frame holds when Read and Check do not pass it, so all three tabs share one bar. Read and Check's own pages take
their `wr-` styles from `screens/write.css` (version two's `write.css` is no longer loaded here); their redo is a later
piece. Version two's files are not changed.

**Home** (route ``, the app's own address) is version three's own too: `screens/home.js` and `home.css`, listed in `index.html` in place of version two's two Home files. It is a copy of version two's Home (the same commands through `v2.call`, the same sections, controls and wording, and the same `v2.shared.home`) in the approved look: every class is `h3-`, every rule in `home.css` starts with `.v3-home`, the Needs you panel, each desk card and each folder group are paper, navigation is plain text with a line under the chosen one, Move up and Move down are always drawn, a desk card with no cover picture has no cover block, and the Needs you panel is tighter on a phone. Home keeps one key of its own on the device, `ar-v3-home-covers`: a JSON list of the ids of the desk subjects that had a cover picture last time (ids only, every read and write in try/catch), so a desk card keeps its cover block from first paint and the page does not jump when the covers arrive; when the covers have been read the list is updated to match. It never reads or writes version two's keys (the grouping and view choice, `ar-create-v2-home`, is shared on purpose). Test: `tests/v3-home.test.mjs`.

**Undo and Put back in Write.** The bar's Undo takes back only the latest saved change, and only when the app says it can be
undone. It never saves first and never reaches past that change: with unsaved words, a save running, or the app not
answering, it is off in its place and its name and title say why (typing is the browser's own Ctrl or Cmd Z). A change that
carried more than one paragraph is asked about first. What Undo takes back is captured first; the bar's status place then
offers Put back, which writes those exact words again through the ordinary save (a moved-on version becomes the newer-version
choice). The words are kept on the device under `ar-v3-write-back:<draft>`. A page opened as an agent has no Undo.

**Styles.** The page loads the app's tokens, version two's `shell.css`, `capture.css` and every version two screen's
styles (the borrowed screens need them), Graphite, then `frame.css` last. Every rule in `frame.css` starts with a
`.v3-` class, and the band and the phone bar sit outside `#v2-app`, where version two's frame rules are scoped, so
neither front's frame reaches the other's. The frame keeps to the approved system: the interface face only, sizes 13
and 14, weights 400 and 600, three text tones, corners of 6, quiet controls 32 tall (44 on the phone bar), navigation as
plain text with a line under where he is, nothing that moves on hover or focus, and a band of one line at one height
(48, the height version two's screens measure their sticky bars from).

**Links each way.** "Version two" opens `/v2/index.html#<the same route>`, so the subject, the piece and the section
carry; "Advanced" uses version two's `advanced({subject, piece, section})` mapping and names the way back (`?v2from=`).
Both carry an assistant's `?reviewActor=`. The theme is one choice for both fronts (`ar-create-v2-theme`).

**What a borrowed screen still does as version two does:** it keeps its own look (its piece bar, its page) inside the
new band, and its device store (`ar-v2-write:` for Write), because it is version two's file. Version three's own Write
brings its own (`ar-v3-write:<binding>`, or `:<n>` when another tab holds that key, one for each open tab under a Web
Lock; `ar-v3-write-story:` for a Magazine story). A closed tab's words are offered once, in place ("Put them back",
"Leave them out"); two versions of one paragraph stand in its place until he keeps one or both; the version he does
not keep goes to `study-draft.set-aside` (or `ar-v3-write-aside:<binding>` when the app does not answer). It never reads, writes, adopts or deletes version two's keys. Until Read and Check are redone here, their
quiet line "You have unsaved words in Write on this device" looks only for version two's key, so it does not mention
words kept by version three's Write.

Tests: `tests/v3-shell.test.mjs`, `tests/v3-write.test.mjs`, `tests/v3-write-start.test.mjs`, and in a real browser `tests/v3-write-editing.browser.mjs`. Nothing scrolls sideways: `node scripts/review-sideways.mjs --v3` (or `--only=v3`).
