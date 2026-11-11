# Plan 11: wisdom bank mock-ups (step D2), the brief

**Status.** The wisdom bank was parked on 11 November 2026; see [where it stands](../research/wisdom-bank/07-where-it-stands.md). The thread this brief started is closed. Earlier status: Prepared 11 November 2026, when [the concept](../research/wisdom-bank/04-concept.md) was written. **Started the same day** at his word, "Start the mock-ups, medium effort": thread `session_017kitFi8g4WwzxMRTZUwnmk`, pushing to `claude/wisdom-bank-mockups`.

## What it is for

Adrian's stated fear about the bank: "if it's not something that I can see, visualize, navigate, understand, there's not anything that I can do with it." The concept says what the bank is. This step lets him see and touch it: three screens he can open on his phone and click through, before anything is built in the app.

## How it is started

Repository `technicianofthesacred/ar-create`, starting from `claude/ar-create-ui-ux-review-71qso6`, pushing to `claude/wisdom-bank-mockups`. The strongest model. One thread, one direction, three screens, then it stops.

## The text it receives

> You make three clickable mock-ups of Adrian's wisdom bank, so he can judge it by eye. Mock-ups only: standalone pages, nothing in the app changes. Read this whole brief first.
>
> **Read these, and only these.**
> 1. `docs/research/wisdom-bank/04-concept.md`. This is the source of truth. Its section "Three screens to mock up next" is your assignment, and "My answers, verbatim" and "What the answers change" are Adrian's own words; hold to them.
> 2. `CLAUDE.md`, only the sections "Plan and visual approval" and "Communicating clearly".
> 3. For the look, so the bank reads as part of the app he has chosen (version two, "Gather, Research, Create, Share"): from branch `claude/direction-d-build`, the files `public/v2/shell/shell.css` and `public/v2/screens/research.css`, and the "Rules of the look" section of `docs/plans/2026-11-11-version-two.md`. Read them with `git fetch origin "+refs/heads/claude/direction-d-build:refs/remotes/origin/claude/direction-d-build"` and `git show`.
>
> Do not explore the rest of the repository, do not run the app, and do not start sub-agents.
>
> **The three screens**, as the concept describes them:
> 1. A source just after distilling: the whole talk as its concepts, all of them, the core ones brighter, lines showing how they connect.
> 2. One nugget with its neighbours: at a glance, then opened as a short stack of index cards; swiping to a neighbour should feel like walking.
> 3. "I have something to express": he speaks a feeling, nuggets from several traditions gather with what prepares each, he picks three, they join into a pathway (a research topic) with "make a piece".
>
> The three link to each other, so he can walk from the source to a nugget to the express screen and back.
>
> **Rules that come from Adrian.**
> - A nugget is a concept, not a best line. A work keeps all its concepts. Nothing is offered for discarding or deleting; resonance shows as brightness.
> - A concept is never shown alone; its neighbours are always in view.
> - Their exact words, a distillation, a reading through his lens, and his own response are four visibly different things, each labelled.
> - No sideways scrolling at any width. Slim and quiet: few type sizes, one interface face, Lora only for spoken words. No sentences that describe the screen back to him. It must be obvious what to do next without reading instructions.
> - Never the em dash.
>
> **The content must be lifelike and must not put words in real mouths.** The bank's whole promise is exact words, so a mock-up that invents a quote for a real teacher or a real book would break it on sight. Use invented speakers and invented talks, with a small "sample" mark on each screen, or quote a real public-domain text exactly and say where from. Never attribute invented words to a real person or tradition's named teacher.
>
> **Bounds, to keep this thread small.**
> - Phone first (390 wide). Then check 1440 once. Dark and light through the app's own tokens.
> - One direction. Do not make alternatives unless Adrian asks after seeing it.
> - The whole-bank map ("the big brain") is not in this thread. Screen 1's map is one work; screen 2's is one concept and its neighbours.
> - Look at your own pictures as small contact sheets, at most twice per screen.
> - If your conversation passes about a third of its capacity, stop, push, and say so.
>
> **Deliver.**
> - The pages under `design/2026-11-wisdom-bank/` on your branch, pushed, with a short `HANDOFF.md` beside them: what is drawn, what is invented, what you were unsure of.
> - One published page per screen, or one page holding all three, that Adrian can open on his phone. Lead your message to him with those links.
> - Then stop and wait for his reaction. Record what he says, in his words, in `HANDOFF.md`.
>
> **Who coordinates.** The coordinating thread is `session_017kitFgZ5x2SMHzVzcAbotm`; its record is `docs/plans/2026-11-11-manager-handoff.md`. Begin your closing message with one plain line saying what is done and what you are waiting for, and send that line to the coordinator if you can message another session.
>
> **How Adrian wants to be answered.** A link or a picture first. Plain full sentences. No code, no commit hashes, no internal codes. Say what is finished, what is not, and what he must decide, with your recommendation.

## After it

- His reaction decides whether a second pass is needed.
- The whole-map design study follows, starting from the survey of maps other people have built (`docs/research/wisdom-bank/05-map-precedents.md`, a separate small thread).
- Then the foundations note (step D3), then building inside version two's Research station.
