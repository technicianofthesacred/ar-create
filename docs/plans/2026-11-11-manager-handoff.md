# Manager handoff, 11 November 2026

One page for whoever coordinates this work next: a compacted version of the review thread, a fresh thread, or Adrian himself. It says what is running, what is waiting, and how to keep the work cheap and sharp. Everything else is in the [plans index](2026-11-10-00-plans-from-the-review.md) and the [review](../reviews/2026-11-10-use-and-interface-review.md).

## Threads

All were started from the branch `claude/ar-create-ui-ux-review-71qso6`, which holds the review, the plans and two review scripts. Pull request 233 brings that branch to `main`; it is open and not merged.

| Thread | Model | Branch it pushes to | State on 11 November | Waiting for |
|---|---|---|---|---|
| Design round (plan 8) | Strongest, high | `claude/ar-create-design-round` | Has published four directions (A Board, B Path, C Work, D Gather, Research, Create, Share) and is still working. Very large context | Adrian's choice of direction |
| Demo that walks the whole chain (plan 7) | Lighter | `claude/ar-create-walkable-demo` | Stopped with a question for Adrian | His answer in that thread |
| Screens (plan 5, Stage A only) | Lighter | `claude/ar-create-screens` | Stage A built and pushed. Told to stop after Stage A | His approval of Stage A in that thread |
| Wisdom bank A: inventory (plan 9) | Lighter | `claude/wisdom-bank-inventory` | Started 11 November | Its report |
| Wisdom bank B: products and experience | Lighter | `claude/wisdom-bank-products` | Started 11 November | Its report |
| Wisdom bank C: open source and the last thirty days | Lighter | `claude/wisdom-bank-open-source` | Started 11 November | Its report |

Session ids, for the tools that need them: design round `session_017kitFgr2vAJZqRoLJ8qibq`; demo `session_017kitFeYtEjJcjysfvHwLhn`; screens `session_017kitFe4zT8nwXTejaJ2Px9`; wisdom A `session_017kitFdz6mRmrViNFV4MVnE`; wisdom B `session_017kitFhcbpLL4v8im7zk9QD`; wisdom C `session_017kitFhBGKJVhitAkQu3cjj`. The review thread that started them all is `session_017kitFgZ5x2SMHzVzcAbotm`.

## What happens next, and who starts it

| When | Next step | Model |
|---|---|---|
| Adrian picks a design direction | A fresh thread writes the build sheet for the chosen direction (each screen with sizes, states and target pictures), reading only the chosen mock-up files and plan 8. The design round thread is then closed | Strongest, one short thread |
| The build sheet exists and the demo (plan 7) is done | Builders, one plan per fresh thread, one after another where files overlap: the subject page with plan 1, then Home, then Write with plan 2 | Lighter |
| Wisdom bank A, B and C have all reported | A fresh thread designs the experience (plan 9, part 2) with Adrian in the conversation, reading the three short reports, not the three chats | Strongest, high, kept short |
| That design is chosen | One short design note on storage and linking (plan 9, part 3) | Strong, one short thread |
| Adrian decides where the work lives when the Mac is off | Plan 6, stage 0 (measuring) | Lighter |

## Decisions still with Adrian

The nine in the review's "Decisions that belong to Adrian", the choice of design direction, the choice of a "classy" reference, whether AR Create is the home of the wisdom bank, and merging pull request 233.

## How to run this cheaply and well

What the first two days showed: the cost of a thread follows how much it carries and how many steps it takes, far more than which model it runs. Every step re-reads everything the thread holds. The one long thread on the strongest model cost about forty times a short thread on the lighter one.

1. **Short threads.** One plan, or one stage of a plan, per thread. End the thread when its deliverable is delivered.
2. **Hand over through a file, not a chat.** Each thread ends by writing a short document in the repository. The next thread reads that document.
3. **Fresh thread at every junction.** When a thread passes roughly a third of its capacity and the task is changing shape, write a handoff and start fresh rather than carrying on. Compacting is the fallback when a thread must continue.
4. **Keep pictures out of the coordinating thread.** Screenshots are the heaviest thing a thread can hold. Builders and designers show Adrian pictures in their own threads.
5. **The coordinator never reads another thread's transcript.** It reads that thread's final document, or asks it for a five-line status.
6. **Strong model for judgement, lighter model for typing.** Strong: choosing a direction, a design note that changes how records connect, anything that moves real data. Lighter: fact-finding, building to a clear plan, repairs, tests.
7. **Split a long strong-model job into stages**, each in its own thread: explore, then narrow, then finish. Three short threads cost far less than one long one and each starts clear-headed.
8. **Do not run two builders on the same files at once.**
9. **No watching or polling.** A coordinator is opened at a junction, does its work, and stops.
10. **A good brief is the best saving.** It should hold Adrian's own words, what must not change, what to deliver and in what form, and when to stop.

## What a coordinator does at each visit

1. Read this file and the plans index.
2. Check each thread's state (one status call each), without opening transcripts.
3. Tell Adrian which threads are waiting for him.
4. If a junction has been reached, write the next brief and start the next thread.
5. Update the tables above and push.
