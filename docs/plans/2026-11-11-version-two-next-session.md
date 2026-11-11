# Version two: for the session that runs on Adrian's Mac

Written 11 November 2026 by the director thread that built version two on a cloud machine. Adrian's words: get it
"to the place where we can ship it so that I can then run another session like this but run it from the computer so
you can use the information that's on the computer."

Read CLAUDE.md first, then `2026-11-11-version-two.md` (the contract and record) and
`2026-11-11-version-two-open-corrections.md` (what is open). This page is only what a session on the Mac needs on top.

## What is on main

Version two is the app's default address. Home, New subject, Capture, a subject, the slide studio, Looks, Research
with its group and topic pages, and "Advanced" both ways are built, reviewed by a second model, and checked twice
against the sample Adrian approved (`design/2026-11-better-interface/d-four-stations/` on branch
`claude/ar-create-design-round`). The existing workspace is untouched apart from its link back, and every address
that opened it before still opens it.

Everything was built and checked on invented demo data. **Nothing has yet been seen with his real records.**

## What only the Mac can do

1. **The release.** He authorised shipping on 11 November ("you can ship it on your own"). The installed app becomes
   a recorded release of one `main` commit, made only by `scripts/release.mjs` from a fresh worktree of
   `origin/main`. Read the options at the top of that script and the last entry in
   `docs/status/RELEASES-2026-11.md` for the exact form used last time. Tell him before you run it and show him the
   result at `http://127.0.0.1:8841`.
2. **First look with real records.** Open version two as an assistant
   (`http://127.0.0.1:8841/v2/index.html?reviewActor=agent:<your-name>`) and walk Home, three or four subjects at
   different stages, a Carousel in the studio, Looks and Research. Compare what each subject says with the installed
   CLI's `standing subject <id>` and `standing all`. Look hardest at what the demo could not show:
   - the time of the first `standing all` after a restart with one to two hundred real subjects (measured on the demo:
     under two seconds at 150);
   - covers on the five desk cards and the top bar's desk chips (the demo has no photographs);
   - the tint under the bar for each look (it comes from the look recorded on a subject's Instagram plan);
   - "Needs you" with real questions, and the line for work an assistant has in hand;
   - Research findings, "What people say", and a group that holds real sources;
   - the Decide tab's count on a topic with something waiting.
3. **Pictures for him.** Before and after at 1440 and 390, dark and light, from the installed app, of anything that
   looks different with real records.

## What comes next, in order

1. **Write, Read and Check inside version two** (piece 7). The sample has its own Write screen; today version two
   opens them in Advanced. This is the largest remaining difference from the sample.
2. The open corrections, in the order of that file.
3. Capture inside version two, Library, and "Ask or find".
4. The wisdom bank inside Research, once its own thread has delivered mock-ups and a foundations note. A pathway there
   is the same thing as a research topic. Nothing in Research invents a unit for one idea.

## Things that will save time

- A test server is `npm run demo` (port 8854, invented data), then `npm run demo:fill` and `npm run demo:instagram`.
  The fill scripts ignore `AR_CREATE_PORT`; give them `AR_CREATE_URL` for any other port.
- `scripts/review-sideways.mjs` needs a demo already running on 8854 and, where Playwright is not a dependency,
  `AR_CREATE_PLAYWRIGHT=<path to playwright/index.mjs>`. `--v2` visits only version two.
- `scripts/review-advanced-addresses.mjs` walks every hand-off into the existing workspace.
- The known failing tests are named in the open corrections file. Run any other failure alone before counting it.
