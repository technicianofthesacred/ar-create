# Full Workbench interface correction — isolated review candidate

Authority: `design/three-directions/c-workbench/index.html` and final `NOTES.md`. Requirements C01/C02/C04/C05/C06 and S01–S12. This supersedes the earlier rail/type-only visual claim; it does not change the installed app.

The candidate adopts the prototype palette, local Plus Jakarta Sans interface/type scale, local Lora source speech, global top bar, Bench/Pieces entrances, section folder panels, quiet stage headers, continuous Source layout, Research point/console split, Direction writing, one Write/Read measure, contextual tool drawer, Media contact sheet, whole portrait carousel, Audience and Share/Outputs presentation. Existing owners retain their original editors, controls, saved state, approval guards and receipts. No copied prototype source records, simulated saves or claimed live AI.

## Verified behavior

- Synthetic Hong Kong and An Cha: native typing, durable file save, switch to the other project and back, reload and exact saved Undo. Both initial draft hashes were restored. See the two preservation receipts.
- Read/Write: every fixture paragraph has identical text, x/y, width, height, font size, line-height and gap in light/dark at 1440px and 390px. See `read-write-geometry.json`.
- Real synthetic intake imported an invented text source through the original file input. Actual native output creation produced a persisted five-slide carousel; all five existing slide editors and template actions appear together. Initial previews are allowed to settle before measurement.
- A stale binding-cache edge was repaired so output creation readiness refreshes when the persisted working binding changes; typing alone does not repeatedly read it.
- Toolbar refresh retains the exact part picker and its selected value/handler. Understanding keeps its original record across inspector passes. Open tool drawers follow a changed story/owner. Focused regressions cover these cases plus header repaint on resize/theme changes.
- Twelve sections compared in both themes at 1440px and 390px. Browser-native screenshot capture timed out in this environment; the included comparison uses actual Chromium screen-media PDF rendering converted to images, together with native interaction and measured layout evidence. It is not real-phone proof or pixel-identical screenshot proof.

Global size controls were also compared in the same light theme in default, hover and keyboard-focus states. All measured size, weight, line-height, colors, padding, radius and focus outline agree; the font family name is a local alias for the same typeface. See `control-states.json`. Full UI-only tests: 348 / 341 passing / the same seven failures as main. Build passes; package proof is recorded after reviewed-manifest refresh.

## Deliberate differences / remaining scope

The prototype contains demonstration records and AI proposals. The app displays actual available synthetic records or honest empty/disabled/processing states, never those sample decisions. Check remains tied to the saved revision; it does not silently become another editable copy. Research console currently searches connected project records, not the whole Library or a live AI provider (ordered step 3). Nested Library/Media storage is a separate step-2 PR. Further template/photo-picker work remains ordered step 4; existing template artwork keeps its platform typography.

Human review is required before merge or installation. No installed-home, port 8841, private content, provider account or original source was changed.
