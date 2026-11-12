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
brings its own (`ar-v3-write:`).

Tests: `tests/v3-shell.test.mjs`. Nothing scrolls sideways: `node scripts/review-sideways.mjs --v3` (or `--only=v3`).
