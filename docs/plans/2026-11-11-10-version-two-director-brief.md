# Plan 10: a fresh director thread for the version two build

**Status.** Prepared on 11 November 2026 at Adrian's word: "Yes prepare the brief for a fresh director thread". **Not started.** Starting it means the design round thread stops building, which is Adrian's to say.

## Why

Adrian chose Direction D ("Gather, Research, Create, Share") and told the design round thread to build it as version two. That thread now carries the whole design conversation, about three quarters of a million tokens, and every step of the build re-reads all of it. On 11 November it spent the shared usage allowance for the window in about half an hour of building, and the wisdom bank concept thread stopped in mid-turn because of it.

The build does not need that conversation. It needs the chosen mock-up, the two contracts and the handoff file, which together are a few hundred lines. A fresh thread that starts from those does the same directing at a small fraction of the cost per step, and leaves room for the research.

Nothing about the build changes: the same branch, the same contracts, the same rule that the strongest model only directs while Opus and Sonnet build and review each other.

## What must be true before it starts

Checked from the pushed branches on 11 November, these are **not yet true**:

1. **Everything is pushed.** The design round reports that Home, Subject and Research are built and being corrected. The pushed branch `claude/direction-d-build` holds their files, but its record table still shows those three rows empty, and its last push is older than that report. A fresh thread can only see what is pushed.
2. **The record says where each piece stands.** In `docs/plans/2026-11-11-version-two.md`, rows 3, 4 and 6 are filled in: built by, reviewed by, and state.
3. **Adrian's review of the built screens is written down in his words.** What he said about Home, Subject and Research in version two, and the list of corrections still open, are in `design/2026-11-better-interface/HANDOFF.md`. This is the one thing that lives only in the design round's conversation, and the thing a new director most needs.
4. **No worker is still running** in the design round thread.

## The closing note for the design round

To be sent by the coordinator when Adrian says start. It asks for one last, small turn.

> From the coordinating thread, at Adrian's word. On 11 November he agreed to move the version two build into a fresh director thread that starts from your handoff file, because this thread has grown so large that each step spends a great deal of the shared usage allowance; it emptied the window today and stopped the research. Your work is the foundation of that thread and nothing in it is being redone.
>
> Please make one last, small turn, and start no new building:
> 1. Let any running worker finish or stop it, then commit and push everything on `claude/direction-d-build`, including work in progress on Home, Subject and Research. If something is half done, push it and say so; do not finish it first.
> 2. Fill in rows 3, 4 and 6 of the record in `docs/plans/2026-11-11-version-two.md`: built by, reviewed by, state.
> 3. Add to `design/2026-11-better-interface/HANDOFF.md` a section "Adrian's review of version two": what he said about each built screen, in his words, and the corrections still open, most important first. Add a line "Nothing is unpushed" when that is true. Push `claude/ar-create-design-round`.
> 4. Begin your closing message with one plain line: "Handed over; everything is pushed", or what is not.
>
> After that this thread stays as it is, for reference. Adrian's further review of version two goes to the new thread.

## The brief for the new thread

**How it is started.** Repository `technicianofthesacred/ar-create`, starting from and pushing to `claude/direction-d-build`. The strongest model. Effort: medium is recommended, since the thread directs and judges but does not design from nothing; Adrian agrees the level before it starts.

The text it receives:

> You are the director of the version two build of AR Create. You direct; you do not build. Read this whole brief before anything else.
>
> **What this is.** On 11 November 2026 Adrian chose the interface he calls version two (the mock-up "Direction D: Gather, Research, Create, Share"). In his words, as recorded by the thread before you: version two is the main app and opens by default; the existing workspace stays as Advanced; build all of it; the director is the strongest model and only directs; Opus and Sonnet build and review each other. A long design thread did the mock-ups and began the build. You take over the build from its handoff file, so that the work continues without carrying that conversation.
>
> **Read these, and only these, to begin.** They are short.
> 1. `CLAUDE.md` in the repository root (the rules of the app, how Adrian wants to be answered, what needs his approval).
> 2. `docs/plans/2026-11-11-version-two.md` (the contract and the record for version two).
> 3. `docs/plans/2026-11-11-direction-d-build.md` (the first contract; its "Rules for every worker" bind every worker you start).
> 4. `public/v2/README.md` (how a screen registers with the shell).
> 5. From the branch `claude/ar-create-design-round`, without checking it out: `design/2026-11-better-interface/HANDOFF.md`, then `BUILD-PLAN.md` beside it. Read them with `git fetch origin "+refs/heads/claude/ar-create-design-round:refs/remotes/origin/claude/ar-create-design-round"` and `git show origin/claude/ar-create-design-round:design/2026-11-better-interface/HANDOFF.md`.
>
> Do not read the mock-up's script and style files yourself, and do not explore the rest of the repository. A worker reads the files its piece needs. If the handoff's section "Adrian's review of version two" is missing or the record's rows are empty, stop and say so in one line; do not guess.
>
> **Your stage, and where it ends.** One stage per thread. Yours is:
> 1. Bring in the corrections still open on Home, Subject and Research, from the handoff's list, most important first.
> 2. Bring the screens together: every link between Home, a subject, the slide studio, Looks and Research works, at phone and desktop width, in both themes.
> 3. One full check: `npm run build`, the whole `npm test`, `npm run verify:package`, and `scripts/review-sideways.mjs` plain and with `--stress`. Say plainly what failed before you began (the handoff names three workspace page tests that fail on untouched `main`) and what fails now.
> 4. One page for Adrian: before and after pictures of each screen in the demo, 1440 and 390 wide, dark and light, with one plain sentence each. He judges by eye; this page is the deliverable.
> 5. Bring `HANDOFF.md` and the record up to date, push, and stop.
>
> Bringing Write, Read and Check inside version two (piece 7) is the next thread, not yours. So is anything in "Still to do" that is not listed above.
>
> **How to direct without spending the allowance.** Every thread of Adrian's shares one usage allowance, and a research stream he calls one of the most important things runs beside you.
> - Give each piece to a worker (a sub-agent) with a written brief: the files it may touch, the files it should read, what done looks like, and the contract's rules. Sonnet for building; Opus for building where the judgement is hard, and for review. The builder of a piece is never its reviewer.
> - One worker at a time, unless two pieces share no file. Never two on the same file.
> - Workers do not commit. You read the reviewer's report and the diff summary, then commit. Do not read whole files a worker has written unless the review disagrees with the report.
> - Pictures: ask workers for one small contact sheet per screen. Look at a sheet at most twice. Never load full-size screenshots into your own conversation.
> - Keep your own messages short. No running commentary.
> - If your conversation passes about a third of its capacity, stop at the next clean point, bring the handoff and record up to date, push, and say so. A fresh thread continues from the file.
>
> **Things you must hold to.**
> - Never the installed app, port 8841, the home's data or the vault. A test server is `npm run demo` on port 8854 with invented data, then `npm run demo:fill`.
> - The existing workspace under `public/document-study/` looks and behaves exactly as before.
> - Adrian's two checkpoints in `CLAUDE.md` stand. The contract is the approved plan. Anything outside it is a change to the plan: send it to him and wait. Anything he would see is shown to him as pictures before it counts as done.
> - No pull request and no release unless he asks.
> - Agents propose; Adrian decides. Human-only decisions stay human-only.
> - No sample content shown as if it were his.
>
> **Three things from the wider work that touch yours.**
> 1. **Research has a sibling inquiry, the wisdom bank.** Adrian wants to paste a talk in and have it distilled into nuggets (the exact words, the speaker, the moment in the source, his own response kept apart), linked across sources, with a map he can move through, a daily return, and a way out to a cited piece. Its home is very likely your Research station. The findings are one page, `docs/research/wisdom-bank/03-synthesis.md` on branch `claude/ar-create-ui-ux-review-71qso6`; the concept is being written on branch `claude/wisdom-bank-concept` as `docs/research/wisdom-bank/04-concept.md`. In this stage, do not build or invent a unit for one idea. Topics and groups of sources stand as they are. Leave room; the concept will say what goes there.
> 2. **The review's three root problems.** Add one line each to the record saying whether version two closes it: the app did not hold the current subject; one subject had five source lists that disagreed; "Write" meant whichever piece was opened last. Detail is in `docs/reviews/2026-11-10-use-and-interface-review.md` on the review branch; a worker may read it, you need not.
> 3. **Two sibling branches, neither merged:** `claude/ar-create-walkable-demo` (a demo that walks from a recording to a checked piece) and `claude/ar-create-screens` (fixes to broken layouts in the existing workspace). Do not merge or copy from them without Adrian's word; name any overlap you meet.
>
> **Who coordinates.** The coordinating thread is `session_017kitFgZ5x2SMHzVzcAbotm`. Its record is `docs/plans/2026-11-11-manager-handoff.md` on branch `claude/ar-create-ui-ux-review-71qso6`. At each junction, push and begin your closing message with one plain line saying what is done and what you are waiting for. If you can message another session, one line to the coordinator at a junction is welcome.
>
> **How Adrian wants to be answered.** Lead with a link or a picture, never code or diffs. Plain full sentences, the names the app shows him. No commit hashes, no internal codes. Never the em dash. Say what is finished, what is not, and what he must decide, with your recommendation.
>
> **Your first message to him** is short: one line that you have taken over from the handoff, the list of corrections you will bring in, in order, and anything in the handoff you could not follow. Then begin; the contract is already approved.

## After it starts

- The design round thread is left as it is, for reference. Nothing is sent to it again except the wisdom bank concept, which now goes to the new thread instead.
- The coordinator records the new thread in the manager handoff, and plans the next stage (piece 7, Write, Read and Check inside version two) as its own thread when this one hands over.
- When this stage ends, a small thread on the lighter model walks the review's journey on version two and reports which findings are closed.

## What Adrian decides

- **Start**, which stops building in the design round thread.
- **The effort level** of the new director: medium recommended.
