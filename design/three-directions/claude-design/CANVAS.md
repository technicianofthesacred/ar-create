# Claude Design canvas: AR Create — three directions

Open: https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=Start+here.dc.html

## Direct page addresses (each opens on its own; checked 21 Oct)
- Start here: https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=Start%20here.dc.html
- A Document-led: https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=A%20Document-led.dc.html
- B Studio by subject: https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=B%20Studio%20by%20subject.dc.html
- C Workbench by resuming: https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=C%20Workbench%20by%20resuming.dc.html
- Compare: https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=Compare.dc.html

## Pages
- Start here — the brief in plain words, the 13 must-haves, what is honestly stubbed.
- A Document-led · B Studio by subject · C Workbench by resuming — each with the live prototype (desktop + 390px phone), the builder's tradeoffs, a critique against all 13 must-haves, and the top 3 fixes drawn as Now / Proposed variant sketches.
- Compare — the three prototypes side by side, a difference table and a recommendation.

## Critique scores (must-haves met fully, of 13)
- A Document-led: 11 met, 2 partial (projects not in view; carousel is a tall strip, not seen whole).
- B Studio by subject: 11 met, 2 partial (four header rows above the text; the 13-tab row runs past the edge at 1280).
- C Workbench: 9 met, 4 partial (two homes for Adrian's words; Write has two right-hand rails; Media "used in" hidden on new imports; the understanding column is a third rail that names one project under All and stays open on phone).

## Recommendation on the canvas
B's structure (subject list + board), with A's Write inside a piece and C's resume card at the top of B's Studio home.

## Notes
- Prototype copies on the canvas are the builders' final files (A 11:43, B 11:45, C 11:43 on 21 Oct), each checked byte-for-byte against disk after upload. If a builder changes index.html later, re-upload it to prototypes/<dir>/index.html.
- Builder files were not edited. Sources for these pages: directions.json + build_pages.py in this folder; verify_upload.sh checks a canvas copy against a local file.
- Links fixed 21 Oct ~12:00: page-to-page links were `?file=<page>`, which inside the editor's preview frame only rewrote the frame's own query string (dropping its access token), so the frame went blank and the editor reloaded Start here. They are now plain relative paths (`A%20Document-led.dc.html`), checked by clicking each Start-here link in the editor. Pages with live prototypes take 10–20 s to appear (blank while loading); Compare loads three prototypes and is slowest. The 404s in the console are the editor's own file lookups on every load, not canvas files.
- Links changed again 21 Oct ~12:10: in Present mode, links inside a page cannot move the page itself. Every page-to-page link is now the page's full claude.ai address and opens it in a new tab, in both the editor and Present mode. Start here says so, and says to allow pop-ups for claude.ai if nothing opens.
