# Plans from the 10 November review

Nine plans, each written so a builder can start without the chat they came from. They come from the [use and interface review](../reviews/2026-11-10-use-and-interface-review.md); finding numbers (U1, V3, M2, A1) point into it. **None is approved or started.** Each needs Adrian's yes on its own plan and, for anything he would see, before and after screenshots of the demo before it counts as done.

| # | Plan | What it gives Adrian | Size | Needs first |
|---|---|---|---|---|
| 1 | [Keep the subject](2026-11-10-01-keep-the-subject.md) | He always knows which subject he is in, and can find, rename, archive and restore one | Medium | Decision 1 |
| 2 | [Pieces and Write](2026-11-10-02-pieces-and-write.md) | The Article never disappears; Write opens the writing; mistakes can be undone | Medium | Decision 2 |
| 3 | [One source list](2026-11-10-03-one-source-list.md) | Material attached once shows in Source, Research, Write and to agents | Large | Decision 3, plan 1 |
| 4 | [Plain words](2026-11-10-04-plain-words.md) | One word per thing; Check and other messages say what happened and what to do | Small to medium | His choice of words |
| 5 | [Screens](2026-11-10-05-screens.md) | The broken layouts fixed; one header; a calmer phone | Medium | Decisions 5, 6, 8 |
| 6 | [Without the Mac](2026-11-10-06-without-the-mac.md) | The app, his phone and agents work with the Mac off | Large, in stages | Decision 9 |
| 7 | [A demo that walks the whole chain](2026-11-10-07-walkable-demo.md) | Anyone, anywhere, can test recording to finished piece on invented data | Small to medium | Nothing |
| 8 | [A noticeably better interface](2026-11-10-08-a-noticeably-better-interface.md) | Home as his desk, one page per subject, a path instead of thirteen doors, a calm writing page | A design round, then large | His choice from mock-ups |
| 9 | [The wisdom bank, an inquiry](2026-11-11-09-wisdom-bank-inquiry.md) | Paste a talk or book in; it is distilled into nuggets that link, map and feed his pieces | An inquiry in four parts, then large | His yes to start |
| 10 | [A fresh director thread for the version two build](2026-11-11-10-version-two-director-brief.md) | The same build of the interface he chose, at a fraction of the cost per step, leaving room for the research | Started 11 November | Nothing |
| 11 | [Wisdom bank mock-ups, the brief](2026-11-11-11-wisdom-bank-mockups-brief.md) | Four screens of the bank he can open on his phone and click through | Done 11 November, two passes | Nothing |
| 12 | [The wisdom bank at full size, zoom first](2026-11-11-12-wisdom-bank-zoom-brief.md) | An invented bank of hundreds of thousands of units that he can zoom and move through, by work and by concept | Page published 11 November | His reaction to its page |
| 13 | [The wisdom bank as one page](2026-11-11-13-wisdom-bank-one-page-brief.md) | The huge map and the reading joined: three places, zoom all the way into a hand-written reading without switching section | A brief, ready to start | His word to start |

Decision numbers are those in the review's "Decisions that belong to Adrian".

## Order

- **Plan 7 first.** It is small, changes nothing Adrian sees in his own app, and removes the blind spot every later plan would otherwise share: nobody off the Mac can test the chain from a recording to a checked piece.
- **Then 1 and 2**, which are independent of each other and make every later journey testable.
- **Then 3**, the largest change to how the parts connect.
- **4 and 5** can run beside 1 to 3, since they touch wording and layout. Plan 5's broken-layout fixes should not wait.
- **Plan 8 changes what plan 5 is for.** Adrian found plan 5's changes too small to notice. Plan 5's Stage A (broken things) still goes ahead; its restyling stages wait for the direction chosen in plan 8's design round, which can start at once because it makes mock-ups and does not touch the app.
- **Plan 6 is its own stream.** It starts with Adrian's decision on where the work lives and should not wait for the screens. Its first stage (inventory and a trial on the server with invented data) can begin at once.

## Rules every plan keeps

- Adrian's exact words, protections and rejection reasons are never changed or lost. Never last-write-wins: keep both versions.
- Agents propose; Adrian decides. No plan gives an agent a human-only action.
- Nothing touches the installed app, port 8841, the home's data, or the vault. Work is in a `claude/<name>` branch against `npm run demo`.
- Every fix ends by walking the journey in the review's Part 1 from start to finish, at desktop and phone width, and by running `npm test`.
- Stable hooks the look depends on (`id`, `data-*`, the `.workflowStep` buttons) keep their names (see `docs/product/LOOK.md`).
