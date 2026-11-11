# Manager handoff, 11 November 2026

**If you are the coordinating thread and have just been compacted, read this file first. It is your memory.** It says who you are in this work, what is running, what is waiting, how the research keeps going, and how to stay cheap and sharp. Everything else is in the [plans index](2026-11-10-00-plans-from-the-review.md), the [review](../reviews/2026-11-10-use-and-interface-review.md) and the [wisdom bank synthesis](../research/wisdom-bank/03-synthesis.md).

## Your role

- You are the **identifier and coordinator**, not a builder. Adrian said on 10 November: "Better you are the identifier of problems rather than builder; write all details of discoveries and suggestions so we can continue anywhere."
- You find problems, write plans and briefs, start threads, read their short final documents, tell Adrian what is waiting for him, and keep this file and the plans index true.
- You do not change application code. You do not read other threads' transcripts. You do not hold screenshots.
- The checkout is `/home/user/ar-create` on branch `claude/ar-create-ui-ux-review-71qso6`. Commit documents there and push with `git push -u origin claude/ar-create-ui-ux-review-71qso6`. Pull request 233 carries that branch to `main`; it is open, and merging is Adrian's decision.

## How Adrian wants to be answered

- He judges by eye: lead with a link or a picture, never code or diffs.
- Plain full sentences, the names the app shows him, no commit hashes, no internal codes.
- Never use the em dash character.
- Say what is finished, what is not, and what he must decide. Make a recommendation; do not list options without one.
- Shell commands for him, if ever needed: one command per block, no comment lines, nothing to hand-edit.
- He often dictates by voice, so his messages can be loosely worded. Quote his words exactly when recording a decision.

## Threads

All AR Create threads were started from the review branch. Use these ids with the session tools.

| Thread | Id | Model | Pushes to | State, 11 November | Waiting for |
|---|---|---|---|---|---|
| Design round, now also the build of version two (plan 8) | `session_017kitFgr2vAJZqRoLJ8qibq` | Strongest, high, directing; Opus and Sonnet workers build and review | Mock-ups: `claude/ar-create-design-round`. Build: `claude/direction-d-build`, cut from `main` | **Direction D chosen** ("Gather, Research, Create, Share"). On 11 November Adrian told that thread: version two is the main app and opens by default, the existing workspace stays as Advanced, build all of it there. Shell, a fuller demo, slide studio and Looks are in; Home, Subject and Research are built and being corrected. Its handoff is `design/2026-11-better-interface/HANDOFF.md`; its contracts are `docs/plans/2026-11-11-direction-d-build.md` and `docs/plans/2026-11-11-version-two.md` on the build branch. Very large and the most expensive thread, about 328 dollars before the build began | Adrian's review of every version two screen. **Do not start another build thread for Direction D** |
| Demo that walks the whole chain (plan 7) | `session_017kitFeYtEjJcjysfvHwLhn` | Lighter | `claude/ar-create-walkable-demo` | Its status on 11 November reads: walkable demo built, verified and pushed. One thing left: exporting the Carousel in the demo needs a change to where the app looks for Chrome | Adrian's decision on that change, in that thread |
| Screens (plan 5, Stage A only) | `session_017kitFe4zT8nwXTejaJ2Px9` | Lighter | `claude/ar-create-screens` | Stage A built and pushed. Told to stop after Stage A | His approval, in that thread |
| Wisdom bank A: inventory | `session_017kitFdz6mRmrViNFV4MVnE` | Lighter | `claude/wisdom-bank-inventory` | **Done.** Report merged into the review branch. Could not read i64os | Nothing |
| Wisdom bank B: products and experience | `session_017kitFhcbpLL4v8im7zk9QD` | Lighter | `claude/wisdom-bank-products` | **Done.** Report merged. Phone page: claude.ai/artifact/NvGBsP5fr2j8NQijnJXs7Y | Nothing |
| Wisdom bank C: open source and the last thirty days | `session_017kitFhBGKJVhitAkQu3cjj` | Lighter | `claude/wisdom-bank-open-source` | **Done.** Report merged. Phone page: claude.ai/artifact/1qrxKj3R4k3H6rDM1aPidV. Last-thirty-days part is thin | Nothing |
| Wisdom bank A2: what i64os already has | `session_017kitFeXyfhfELhrqMLjAcW` | Lighter | i64os branch `claude/wisdom-bank-i64os-inventory` | **Done.** Report copied here as `docs/research/wisdom-bank/00b-i64os-inventory.md`; the synthesis is corrected | Nothing |
| Wisdom bank D1: the concept, with Adrian | `session_017kitFg72niPKF1xeotzZpx` | Strongest, medium | `claude/wisdom-bank-concept` | Started 11 November. Opens by interviewing him. Still small. It was started before the i64os inventory arrived, so tell it to read `00b-i64os-inventory.md` | His answers, in that thread |

The review thread that started them all, and is the coordinator, is `session_017kitFgZ5x2SMHzVzcAbotm`.

**Every open thread has been told who coordinates** (11 November: the design round, the demo builder, the screens thread and the concept thread). Each was asked to push at a junction and to begin its closing message with one plain line saying what is done and what it is waiting for; that line is what a status call shows. The four finished research threads were not woken. **Tell every new thread the same in its brief**: the coordinator's id, where the handoff file is, the closing-line habit, and that it keeps to its own brief and branch. A thread can message the coordinator (the design round did on 11 November), and such a message wakes this thread; the coordinator still checks in, since not every thread will.

## The research stream (the wisdom bank): how to keep it going

Adrian called this "one of the most important things". The plan is [plan 9](2026-11-11-09-wisdom-bank-inquiry.md); the findings so far are on [one page](../research/wisdom-bank/03-synthesis.md).

**Where it stands.** Discovery is done, i64os included. The answer to "is this already built?" is no: combine borrowed parts and build the middle (the nugget, links across sources, a map that is a way to move, and the way out to a cited piece). His stated fear, and the main design requirement, is being able to see, navigate and return to what he keeps.

**The steps, each a fresh short thread:**

| Step | What | Model | Starts when | Ends with |
|---|---|---|---|---|
| A2 | Read i64os (**done**) | Lighter | Started | The i64os inventory file, now `00b-i64os-inventory.md` |
| D1 | Interview Adrian, write the concept (running) | Strongest, medium | Started | `docs/research/wisdom-bank/04-concept.md` and a phone page |
| D2 | Mock-ups of three screens, one direction first, phone first: a source just after distilling, one nugget with its neighbours, the daily return | Strongest, high, strictly bounded (see the rules below) | D1's concept is written and Adrian has read it. He has picked Direction D, so the mock-ups use its look and sit inside its Research station: the D2 brief names the `d-four-stations` files and the design handoff as its only design reading | Clickable pages and his reaction |
| D3 | Foundations: one short design note on what a nugget is on disk, how links are recorded, how the exact words stay tied to the source, how it is found by meaning, how agents read and propose | Strong, medium, short | D2's direction is chosen | `05-foundations.md` |
| Build | One plan per thread: capture and distil; the nugget and its check against the transcript; returning; links and the map; the way out | Lighter | D3 is accepted | Each with before and after pictures |

**What you do at each visit for this stream:**
1. Check A2 and D1 with one status call each.
2. When A2 is done: fetch its file from the i64os branch, copy it into `docs/research/wisdom-bank/` here as `00b-i64os-inventory.md`, and correct the "unverified" rows and the "still not known" list in the synthesis.
3. When D1 is done: fetch `claude/wisdom-bank-concept`, merge the concept document into the review branch, read its "three screens" and "open questions", and tell Adrian the questions.
4. When the conditions for D2 are met, write its brief and start it. Put the bounds from the rules below into the brief.
5. Keep [plan 9](2026-11-11-09-wisdom-bank-inquiry.md) and this table true.

**Research still worth doing, cheaply:**
- A proper last-thirty-days sweep with Adrian's own skill (`technicianofthesacred/last30days-skill`). Thread C did not run it. Try it in a small thread on the lighter model; if it needs keys, say so and let him decide.
- Adrian trying Recall, Readwise Reader and NotebookLM himself for twenty minutes each with one talk he loves. His eye will tell more than any review. Ask him what he liked and record it in the concept.
- Open the two or three most promising open-source projects' own pages (Fabric's patterns, Sigma.js, ts-fsrs) to confirm licences and dates, which thread C took from search summaries.

## The app stream: what happens next

Adrian chose Direction D on 11 November and told the design round to build it in its own thread as "version two", under `public/v2/`, with the existing workspace kept as Advanced. So the earlier plan (a build sheet, then separate builders) is withdrawn. The coordinator's work here is to keep the other threads from colliding with that build and to check its result against the review.

| When | Next step | Model |
|---|---|---|
| Version two's four screens are linked (the design round says so in its closing line) | A small fresh thread walks the review's journey (Part 1) on the version two demo with `scripts/review-journey.mjs` and `scripts/review-screens.mjs`, and reports which root problems (R1 to R3) and findings (U1 to U25) are closed, open, or moved to Advanced. Pictures stay in that thread; it publishes one page for Adrian | Lighter |
| The wisdom bank concept is written | Send it to the design round, so Research leaves a place for the nugget and does not invent one | Coordinator |
| Adrian answers the demo builder | If he wants it: check it against version two's own fuller demo (`npm run demo:fill`) first, so the chain from a recording to a checked piece is not built twice | Lighter |
| Adrian decides where the work lives when the Mac is off | Plan 6, stage 0 (measuring) | Lighter |

**Overlaps to watch.** Plans 1, 2 and 3 were written for the existing workspace; version two may close them by design or leave them in Advanced, which the journey walk will tell. Plan 5 (screens) now concerns Advanced only; its Stage A is built and awaiting approval, and its later stages are withdrawn. Plan 7 (the walkable demo) overlaps in part with version two's fuller demo. Version two's Research station (topics, groups of sources) and the wisdom bank are the same territory: one home.

## Decisions still with Adrian

- His review of the version two screens, in the design round thread. (His choice of direction is made: Direction D.)
- His answer to the demo thread's question, and his approval of the screens thread's Stage A.
- The nine decisions in the review's "Decisions that belong to Adrian", including where the work lives when the Mac is off.
- Whether the wisdom bank lives inside version two's Research station (suggested yes; the concept thread will ask him).
- Merging pull request 233.
- Whether the build should move out of the very large design round thread into a fresh director thread that starts from its handoff file (suggested yes at the next natural pause, for cost; his call, since he told that thread to build there).

## How to run this cheaply and well

What the first two days showed: the cost of a thread follows how much it carries and how many steps it takes, far more than which model it runs. Every step re-reads everything the thread holds. On 11 November the design round, one long thread on the strongest model at high effort, had cost about 309 dollars. The three research threads on the lighter model cost about one dollar each and finished in minutes. The review thread had cost about 35 dollars a day earlier.

1. **Short threads.** One plan, or one stage of a plan, per thread. End the thread when its deliverable is delivered.
2. **Hand over through a file, not a chat.** Each thread ends by writing a short document in the repository. The next thread reads that document.
3. **Fresh thread at every junction.** Compacting is the fallback when a thread must continue.
4. **Keep pictures out of the coordinating thread.**
5. **The coordinator never reads another thread's transcript.** Use one status call, or fetch the thread's final document.
6. **Strong model for judgement, lighter model for typing.**
7. **Bound every strong-model thread in its brief:** name the files it may read; say "do not explore the rest of the repository"; one direction before three; phone first; look at its own pictures as small contact sheets and at most twice; no sub-agents; stop and write a handoff after the deliverable, or if its context passes about a third of capacity.
8. **Split a long strong-model job into stages**, each in its own thread: concept, then mock-ups, then foundations.
9. **Do not run two builders on the same files at once.**
10. **No constant watching.** On 11 November Adrian said: "Please continue all of the coordinating. Make sure all of the sessions knows that you are doing this." So the coordinator now visits by itself as well as when he opens it: at the end of each visit it schedules one next visit (a single reminder to this thread, never a repeating timer). About three hours ahead while threads are moving; once or twice a day when everything is waiting on Adrian; none when nothing is open. A visit is five cheap steps (see the end of this file), not a transcript read.
11. **A good brief is the best saving.** It holds Adrian's own words, what must not change, what to deliver and in what form, and when to stop.
12. **All threads share one usage allowance.** On 11 November the allowance for the five-hour window ran out while the version two build was running in the design round thread, and the concept thread stopped in mid-turn with it. A thread stopped this way shows "failed" with a usage-limit note in its status; restart it with one message telling it to check what is saved and finish the turn that was cut off. When the research matters, do not let one very large thread spend the window: say so to Adrian.
13. **Routine coordination runs at medium effort.** Use high only for writing a brief at a big junction.

## Practical facts for starting threads

- Start a thread with the session tool: the repository URL, the review branch as the starting revision (until pull request 233 is merged, then `main`), a branch of its own to push to, and the model. Model ids: `claude-fable-5-2` (strongest), `claude-opus-5-5`, `claude-sonnet-5-5` (lighter), `claude-haiku-5-5`.
- Set an effort level only when Adrian has asked for or agreed to one.
- A thread cannot always attach a second repository (thread A was refused i64os). Start a thread directly in the repository it must read.
- A message sent to another thread arrives marked as from this thread, not from Adrian. Quote his exact words in it.
- The demo runs with `npm run setup`, `npm run build`, `npm run demo` (port 8854, invented data). A background demo server is stopped after about two hours.
- Never touch port 8841, the installed home, or the vault. Never commit private content. `npm run verify:package` must pass before pushing.

## What the coordinator does at each visit

1. Read this file.
2. Check each open thread's state with one status call, without opening transcripts.
3. Tell Adrian which threads are waiting for him, first.
4. If a junction has been reached, write the next brief and start the next thread.
5. Update the tables above and push.
6. Schedule the next visit (rule 10), and say in the reply when it is.
