# Plan 13: the wisdom bank as one page (the brief)

**Status.** Prepared 11 November 2026. **Not started.** It starts at Adrian's word, because it takes over the files of a thread he is still directing.

## Why

There are now two pages, made by two threads, and both have grown past the size at which a thread should stop:

- **The mock-ups** ([page](https://claude.ai/artifact/KyUE9ZY9bvArEynznJ5p1L), four passes): three places (Map, Express, Yours), a concept that opens in place at three depths, the full reading, his voice anywhere, a notebook, and a hand-written sample in the plain voice he approved. Its map holds a handful of concepts.
- **The huge map** ([page](https://claude.ai/artifact/23ou4as7hxG7DzVB2W6ALz)): an invented bank of 20,000 concepts and 2,000 works that he can zoom and move through, by work and by concept, measured at real size. Its wording is generated, and it does not hold his later corrections.

Adrian asked for both things in one: "the zooming in to the fine details and zooming out are also very, very important", and "I don't like that we have five different sections ... in that section it's built in the way that you don't have to switch to another section to open these things up." So the next step is one page: the huge map becomes the Map place of the three-place structure, and zooming all the way in arrives at the hand-written reading without leaving.

## How it is started

Repository `technicianofthesacred/ar-create`, starting from `claude/ar-create-ui-ux-review-71qso6` (which holds both pages, both handoffs and the concept), pushing to `claude/wisdom-bank-one-page`. The strongest model at the effort Adrian agrees (medium recommended). When it starts, the two earlier threads are told to make no further changes, so one thread owns the files.

## The text it receives

> You join two mock-ups of Adrian's wisdom bank into one page he can open on his phone. A standalone page; nothing in the app changes. Read this whole brief first.
>
> **Read these, and only these.**
> 1. `docs/research/wisdom-bank/04-concept.md`: only the section "Corrections since this page was written". It holds twelve corrections in Adrian's own words. Every one is a requirement. Where anything else disagrees with them, they stand.
> 2. `design/2026-11-wisdom-bank/HANDOFF.md`: the passes of the first mock-ups, above all "Third pass", "Fourth pass" and "Adrian's reaction". Its page is `design/2026-11-wisdom-bank/index.html`.
> 3. `design/2026-11-wisdom-bank/zoom/HANDOFF.md`: the huge map, its measurements, what breaks first, "What I was unsure of", "Asked by the coordinating thread and not done here", and "Adrian's reaction" if he has given one. Its parts are `head.html`, `a-data.js` (the generator) and `b-app.js` (the map), joined by `build.sh`.
>
> Read the page files as you need them to do the work. Do not explore the rest of the repository, do not run the app, and do not start sub-agents.
>
> **What to make: one page, three places at most (Map, Express, Yours).**
> - **Map is the huge map.** The bank at real size from the zoom page, with its depths, the Works and Concepts switch, the trail, finding and narrowing. Zooming all the way in on a concept opens it in place, as the first mock-ups do: Glance, Medium, Full, then the full reading in his five-part order. He never switches section to go deeper or to come back out.
> - **A place to land that is written by hand.** The part of the bank he first arrives in is written with care, in the plain spoken voice he approved (the sample and the rewritten concepts are in the first mock-ups): a few whole works, including one of about a hundred units and the invented work on tea, with the kinds Idea, Practice, Step, Belief. Each unit has a short name for the map and a full plain name for reading. The generated remainder still reads as plain language. Say in your handoff which part is which.
> - **Works' maps interacting is central.** Each work is a map of all it holds, kept together; the maps join where works share a unit; moving between them is a main gesture, not a detail.
> - **His learning on the map.** Resonance, his learning marks (Met it, Understand it, Practising it, Can teach it) and where he has left notes shape what he sees first at every depth.
> - **One voice button, everywhere.** A note is kept on whatever he is looking at, at that depth. Yours holds all his notes, and "Read my notes with me".
> - **Express** as in the first mock-ups: he says what he wants to express, the bank gathers, he orders, and it leaves as a piece (an article, an Instagram post, a workshop, a research paper).
>
> **Rules, each from his words.** Understood on first reading, in words a person would say aloud; never compressed labels. As long as understanding needs; the layout makes room for the words. The small view states what the thing is, never a warning about it. Separation by space and surface, not by typeface or label colour, and without spending reading width on frames. The kinds of line feel native to the map. Sleek, minimal, highly functional. No sideways scrolling of the page. All content invented and marked Sample; no real person's or teacher's words; never the em dash character.
>
> **Hold at size and say so honestly.** Keep the zoom page's measurements table and repeat it after the join. Its two known gaps (the works side of one tradition is the slowest view; one tradition's lines tangle at ten times the size) may be improved if cheap, and must at least be restated truthfully.
>
> **Bounds.** Every thread of Adrian's shares one usage allowance. Phone first (390 wide), one check at 1440. One direction. Small contact sheets, at most twice per place. Publish in stages so he sees progress: first Map with the in-place opening and the hand-written landing area; then Express and Yours joined in. If your conversation passes about a third of its capacity, stop at the next clean point, write the handoff, push and say so; a fresh thread continues from the files.
>
> **Deliver.** The page under `design/2026-11-wisdom-bank/one/` on your branch, with a `HANDOFF.md` (what is joined, what is hand-written, the measurements, what you were unsure of). Publish it for his phone and lead your message with the link and three plain sentences on how to move. Then wait for his reaction and record it in his words.
>
> **Who coordinates.** The coordinating thread is `session_017kitFgZ5x2SMHzVzcAbotm`; its record is `docs/plans/2026-11-11-manager-handoff.md`, and this brief is plan 13 there. Begin your closing message with one plain line saying what is done and what you are waiting for, and send that line to the coordinator. A message from the coordinator may reach you late; check for one before you publish.
>
> **How Adrian wants to be answered.** A link or a picture first. Plain full sentences. No code, no commit hashes, no internal codes. Say what is finished, what is not, and what he must decide, with your recommendation. He often dictates by voice, and he reacts often and in detail: record each reaction in his words as it comes.

## After it

- A trial of distilling one real work into units at three depths in this voice, since no mock-up can show whether real distillations land. It needs Adrian to name the work.
- The foundations note: how a bank this size is stored and found, fed by the measurements.
- Building inside version two's Research station.
