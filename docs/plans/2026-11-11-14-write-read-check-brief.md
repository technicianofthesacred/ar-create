# Plan 14: Write, Read and Check inside version two (the brief)

**Status.** Prepared 11 November 2026 at Adrian's word: "fix the small ones, then start Write, Read and Check". It starts as soon as the small fixes are pushed, on top of their branch, so the two do not change the same files at once.

## Why

Version two is on `main` and opens by default, but the heart of the work, writing, still happens in the old workspace. An author who starts an Article is sent to Advanced. The [author's walk](../reviews/2026-11-11-version-two-journey.md) found that "Write in Advanced" opens the Article even when he came from the Carousel, which is the third root problem of the first review, still open. This is the largest remaining difference from the sample he approved.

## What is at stake

Write holds Adrian's own words. Everything the app promises about them must hold exactly as before: his exact words, protections, saving, recovery and Undo; never last-write-wins; agents propose prose and never write it. A second editor written from nothing would have to earn all of that again. So the brief asks the director to bring the approved, tested writing inside version two, not to write a new one, and to tell Adrian how before building.

## How it is started

Repository `technicianofthesacred/ar-create`, starting from `claude/v2-small-fixes` (which is `main` plus the small fixes), pushing to `claude/v2-write-read-check`. The strongest model directing at medium effort, the level Adrian set for the last director; Opus and Sonnet build and review each other.

## The text it receives

> You are the director of the next stage of version two of AR Create: Write, Read and Check inside version two. You direct; you do not build. Read this whole brief first. Started by the coordinating thread at Adrian's word on 11 November 2026: "fix the small ones, then start Write, Read and Check".
>
> **Where things stand.** Version two (the interface Adrian chose, "Gather, Research, Create, Share") is merged to `main` and opens by default; the existing workspace stays as Advanced. Home, a subject, the slide studio, Looks and Research are built. Write, Read and Check still open in Advanced. Your branch starts from `main` plus four small fixes made today. Nothing has been released to his installed app and nothing has been seen with his real records.
>
> **Read these, and only these, to begin.**
> 1. `CLAUDE.md`: the rules, the never list, what is human-only, "Plan and visual approval", "Communicating clearly".
> 2. `docs/plans/2026-11-11-version-two.md`: the contract and record. Piece 7 is yours. "The shape", "Rules of the look" and "Rules for every worker" bind you and every worker.
> 3. `docs/plans/2026-11-11-version-two-open-corrections.md`: what is open, the tests known to fail, and the root problems as they stand.
> 4. `docs/plans/version-two-briefs/v2-common.md` and "Rules for every worker" in `docs/plans/2026-11-11-direction-d-build.md`.
> 5. The author's walk of version two, made today. Fetch it without changing branch: `git fetch origin "+refs/heads/claude/v2-journey-walk:refs/remotes/origin/claude/v2-journey-walk"`, then `git show origin/claude/v2-journey-walk:docs/reviews/2026-11-11-version-two-journey.md`. Findings 1, 2 and 4 are your work list beside piece 7.
>
> Do not read the editor's code or the sample's files yourself, and do not explore the repository. Workers read what their piece needs. The sample's Write screen is in `design/2026-11-better-interface/d-four-stations/` on branch `claude/ar-create-design-round`.
>
> **What must hold, above everything.** Write holds Adrian's own words.
> - His exact words, his protections, saving, recovery and Undo behave exactly as they do today. Never last-write-wins: on a conflict, both versions are kept.
> - Saving prose is his alone. An agent proposes and never writes prose; a page opened as an agent must be refused as it is today.
> - The page geometry of Write and Read that he approved stays ("Write keeps its approved page").
> - Version two and Advanced use the same commands and the same records, so they cannot drift. Version two keeps no private copy of a draft that Advanced does not also see, and the reverse.
> - Every existing test of Write, Read, Check, saving and recovery stays green, unchanged. Never skip or weaken one.
>
> **The approach to weigh first.** Bring the approved, tested writing inside version two's frame, reusing its code, rather than writing a second editor that must earn every protection again. Have one worker report, before anything is built, on what that takes and what it risks: how the existing Write, Read and Check are put together, what they depend on in the old page, and the two or three ways they could live inside version two (reused in place; reused within version two's page; rebuilt on the same commands), with the cost and the danger of each. Choose with that report in hand.
>
> **Then tell Adrian before building.** His first checkpoint applies with full force here, because it is his words. Your first message to him, after that report: in plain sentences, how Write will live inside version two, what will look different from today's Write and from the sample, what will stay exactly the same, and what you are unsure of. Keep working on groundwork that does not depend on his answer, and do not build the visible change until he says yes.
>
> **Your stage, and where it ends.**
> 1. Write, Read and Check inside version two for an Article: opened from the subject's step, on the right subject and the right piece, with a way back that keeps his place.
> 2. The same for a Carousel's words. Opening Write from a Carousel must open the Carousel's words, never the Article (the walk's second finding, and the first review's third root problem). Fix this for the door into Advanced as well, so the old workspace also opens the piece he came from.
> 3. A new Article can be started from version two (today its tile says "Write a few words first" and there is nowhere to write them).
> 4. One full check: `npm run build`, the whole `npm test`, `npm run verify:package`, `scripts/review-sideways.mjs --v2` plain and with `--stress`, and `scripts/review-advanced-addresses.mjs`. Say what failed before you began and what fails now.
> 5. One page for Adrian: before and after pictures at 1440 and 390 wide, dark and light, one plain sentence each. Bring the record and the open corrections up to date, push, and stop.
>
> Adding material without leaving version two (the walk's first finding: recordings, notes and photographs all open Advanced and lose the subject, and Capture has no screen of its own) is the stage after this. Take it on in this thread only if you finish the five steps above with your conversation under a third of its capacity; otherwise leave it, with a brief written for the next thread in `docs/plans/version-two-briefs/`.
>
> **How to direct without spending the allowance.** Every thread of Adrian's shares one usage allowance. The last stage cost about 96 dollars; aim well under that.
> - Each piece goes to a worker with a written brief: the files it may touch, the files it should read, what done looks like, the rules. Sonnet builds; Opus where the judgement is hard, and for review. The builder of a piece is never its reviewer. Each worker in its own git worktree.
> - One worker at a time unless two pieces share no file.
> - Workers do not commit to the build branch. You read the reviewer's report and a summary of the change, then merge.
> - Pictures as small contact sheets, looked at most twice. No full-size screenshots in your own conversation.
> - If an Opus worker is refused for usage, do not retry in a loop; use Sonnet with a second Sonnet reviewing and say so in the record.
> - If your conversation passes about a third of its capacity, stop at the next clean point, bring the record up to date, push and say so.
>
> **Things you must hold to.**
> - Only the demo: `npm run demo` on port 8854 with invented data, then `npm run demo:fill`. Never port 8841, the home, or the vault.
> - The existing workspace looks and behaves exactly as before, apart from opening the piece he came from.
> - Anything he would see is shown to him as pictures before it counts as done.
> - Push only to `claude/v2-write-read-check`. No pull request and no merge to `main` unless he tells you. A release to his installed app is run only on his Mac.
> - Writing in Write is human-only, so workers opening pages as an agent cannot type prose. Test saving and recovery through the existing tests and through whatever the test suite already uses to stand in for him; never by weakening the rule.
> - Separation by space and surface, not by typeface or label colour. His words, 11 November: "I feel like I'm having to sort your words with my head rather than enjoy reading." No sentence that describes the screen back to him. Nothing scrolls sideways.
>
> **From the wider work.** The small-fixes thread (`session_017kitFhaSpzSUfPZuRA9Cib`, branch `claude/v2-small-fixes`) may still change its branch if Adrian asks for an adjustment; bring its branch into yours when it does. The wisdom bank is set apart in its own thread and is not your concern; Research stays as it is.
>
> **Who coordinates.** The coordinating thread is `session_017kitFgZ5x2SMHzVzcAbotm`; its record is `docs/plans/2026-11-11-manager-handoff.md` on branch `claude/ar-create-ui-ux-review-71qso6`, and this brief is plan 14 there. At each junction, push and begin your closing message with one plain line saying what is done and what you are waiting for, and send that line to the coordinator.
>
> **How Adrian wants to be answered.** A link or a picture first, never code or diffs. Plain full sentences, the names the app shows him. No commit hashes, no internal codes. Never the em dash character. What is finished, what is not, what he must decide, with your recommendation. He often dictates by voice.

## After it

- Adding material inside version two (Capture), then Library and "Ask or find".
- The session on his Mac: the release and the first look with real records.
- One source list for a subject (plan 3).
