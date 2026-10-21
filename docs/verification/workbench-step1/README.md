# Workbench step 1 — review evidence

21 October 2026. Requirements C02, C05, C06 and S01–S12. Review candidate only; no installation, release, private-data read or original-record write.

## What this PR changes

The approved Workbench look now wraps all twelve existing section owners: a 66px unnumbered icon rail, contextual 240px panel, phone group navigation, and one Plus Jakarta Sans text scale. Library's Inbox opens the existing Material intake; panel entries forward existing Source, Research, Media and Outputs controls. They do not invent folders, research, counts or saved state. Nested storage, the real-library research console and Arrange templates/photo picker remain steps 2, 3 and 4, each in its own reviewed PR.

Visible A−/A+ controls scale the interface together. The manuscript is 16px/1.65 at default, with a 640px maximum measure; headings use the same approved 13/15/16/17px tokens. Template renders retain their own typography. Read and Write use identical current words, font, paragraph geometry and document origin. Source summaries and duplicate mobile toolbars no longer push those words to different positions. Their owner controls remain accessible through the existing bar/source tools.

The panel keeps each section's collapse preference. Keyboard navigation changes focus without changing a section; `[` leaves text inputs alone. The phone Media empty-state/opener now converge instead of endlessly moving each other around the title.

## Acceptance proof

- `screen-measurements.json`: all twelve sections at exact 1440px and 390px viewports, light and dark — 48 cases. No horizontal overflow and no visible text size/weight outside the approved tokens (template renders excluded). Read/Write geometry matches in all four combinations.
- `paragraph-geometry.json`: exact (zero-tolerance) x/y/width/height/font/size measurements for all five manuscript blocks in Read and Write, at both widths and in both themes.
- `save-switch-undo.json`: native typing/autosave, switching, return, reload and saved Undo on demo identities `hk`/`hk-article` and `ref-an-cha`/`ancha-1`. Both restored exact initial Markdown bytes and SHA-256 hashes. Content is entirely invented; this is not a private-content or real-phone test.
- `phone-controls.json`: all visible toolbar buttons have unobstructed hit targets in all twelve sections at 390px after the final compact-label correction.
- `zoom.json`: A+ persists across reload; Read/Write match at 112.5% on desktop and phone, and A− restores 100% through an unobstructed phone hit target.
- `test-comparison.json`: built unchanged main at `1e13b7b` has 323 tests, 316 passes and seven failures. Candidate has 331 tests, 324 passes and the identical seven failure names. The separate focused rail/bar run passes 26/26. This does not claim a green full suite or repair unrelated main failures.
- Targeted Impeccable detector: no findings on changed UI files.

Native screenshots from the earlier screen pass were inspected for desktop and phone layout. The subsequent browser screenshot endpoint timed out/returned a blank window; final refinements were therefore checked with native rendered DOM geometry rather than represented by stale screenshots. No accessibility permissions or browser restart were requested. The actual interactive demo is the review surface.

## Try it

Run `npm run build`, then `AR_CREATE_PORT=58641 npm run demo`. Open `http://127.0.0.1:58641/document-study/index.html`. The server creates a disposable synthetic home; it never reads the installed app or personal originals. The two invented projects exercise the same An Cha/Hong Kong route and part identities without importing their private words.

Review the rail/panel, all twelve section surfaces, text sizing, Read/Write alignment, switching and recovery. Do not merge or install on behalf of the human. After review, step 2 is nested Library/Media folders with real storage in the demo contract.
