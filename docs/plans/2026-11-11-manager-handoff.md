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
| Design round (plan 8) | `session_017kitFgr2vAJZqRoLJ8qibq` | Strongest, high | `claude/ar-create-design-round` | Four directions published as pages: A Board, B Path, C Work, D "Gather, Research, Create, Share". Still active with Adrian. Very large and by far the most expensive thread | Adrian's choice of direction. Asked on 11 November to write a handoff file at its next pause |
| Demo that walks the whole chain (plan 7) | `session_017kitFeYtEjJcjysfvHwLhn` | Lighter | `claude/ar-create-walkable-demo` | Stopped with a question for Adrian | His answer, in that thread |
| Screens (plan 5, Stage A only) | `session_017kitFe4zT8nwXTejaJ2Px9` | Lighter | `claude/ar-create-screens` | Stage A built and pushed. Told to stop after Stage A | His approval, in that thread |
| Wisdom bank A: inventory | `session_017kitFdz6mRmrViNFV4MVnE` | Lighter | `claude/wisdom-bank-inventory` | **Done.** Report merged into the review branch. Could not read i64os | Nothing |
| Wisdom bank B: products and experience | `session_017kitFhcbpLL4v8im7zk9QD` | Lighter | `claude/wisdom-bank-products` | **Done.** Report merged. Phone page: claude.ai/artifact/NvGBsP5fr2j8NQijnJXs7Y | Nothing |
| Wisdom bank C: open source and the last thirty days | `session_017kitFhBGKJVhitAkQu3cjj` | Lighter | `claude/wisdom-bank-open-source` | **Done.** Report merged. Phone page: claude.ai/artifact/1qrxKj3R4k3H6rDM1aPidV. Last-thirty-days part is thin | Nothing |
| Wisdom bank A2: what i64os already has | `session_017kitFeXyfhfELhrqMLjAcW` | Lighter | i64os branch `claude/wisdom-bank-i64os-inventory` | Started 11 November | Its report, a file in the i64os repository: `docs/research/wisdom-bank-i64os-inventory.md` |
| Wisdom bank D1: the concept, with Adrian | `session_017kitFg72niPKF1xeotzZpx` | Strongest, medium | `claude/wisdom-bank-concept` | Started 11 November. Opens by interviewing him | His answers, in that thread |

The review thread that started them all, and is the coordinator, is `session_017kitFgZ5x2SMHzVzcAbotm`.

## The research stream (the wisdom bank): how to keep it going

Adrian called this "one of the most important things". The plan is [plan 9](2026-11-11-09-wisdom-bank-inquiry.md); the findings so far are on [one page](../research/wisdom-bank/03-synthesis.md).

**Where it stands.** Discovery is done except for i64os. The answer to "is this already built?" is no: combine borrowed parts and build the middle (the nugget, links across sources, a map that is a way to move, and the way out to a cited piece). His stated fear, and the main design requirement, is being able to see, navigate and return to what he keeps.

**The steps, each a fresh short thread:**

| Step | What | Model | Starts when | Ends with |
|---|---|---|---|---|
| A2 | Read i64os (running) | Lighter | Started | The i64os inventory file |
| D1 | Interview Adrian, write the concept (running) | Strongest, medium | Started | `docs/research/wisdom-bank/04-concept.md` and a phone page |
| D2 | Mock-ups of three screens, one direction first, phone first: a source just after distilling, one nugget with its neighbours, the daily return | Strongest, high, strictly bounded (see the rules below) | D1's concept is written and Adrian has read it. Better still, after he has picked a design direction in plan 8, so the bank looks like the same app | Clickable pages and his reaction |
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

| When | Next step | Model |
|---|---|---|
| Adrian picks a design direction | A fresh thread writes the build sheet for the chosen direction (each screen with sizes, states and target pictures), reading only the chosen mock-up files and plan 8. The design round thread is then closed | Strongest, one short thread |
| The build sheet exists and the demo (plan 7) is done | Builders, one plan per fresh thread, one after another where files overlap: the subject page with plan 1, then Home, then Write with plan 2 | Lighter |
| Then | Plan 3 (one source list): a short design note first, then a builder | Strong for the note, lighter to build |
| Adrian decides where the work lives when the Mac is off | Plan 6, stage 0 (measuring) | Lighter |

## Decisions still with Adrian

- His choice of design direction (plan 8), and one or two references he finds classy.
- His answer to the demo thread's question, and his approval of the screens thread's Stage A.
- The nine decisions in the review's "Decisions that belong to Adrian", including where the work lives when the Mac is off.
- Whether AR Create is the home of the wisdom bank (suggested yes).
- Merging pull request 233.
- Whether to wind down the design round thread once he has chosen.

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
10. **No watching or polling.** The coordinator is opened at a junction, does its work, and stops.
11. **A good brief is the best saving.** It holds Adrian's own words, what must not change, what to deliver and in what form, and when to stop.
12. **Routine coordination runs at medium effort.** Use high only for writing a brief at a big junction.

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
