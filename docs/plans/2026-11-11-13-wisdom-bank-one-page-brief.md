# Plan 13: the wisdom bank as one page (the brief)

**Status.** The wisdom bank was set apart into its own home thread on 11 November 2026; see [where it stands](../research/wisdom-bank/07-where-it-stands.md). Earlier status: Prepared 11 November 2026 and rewritten the same hour, after Adrian said the navigation and the suggested interface were "majorly flawed". It now starts from how he moves through the bank, with three ways shown small before one is built. It works in its own folder, so it does not change the earlier threads' files. **Changed again after it started:** Adrian then said how he wants to move, "a infinite zoom but with a strong structure everywhere" (correction 15 in the concept), so the kind of navigation is decided. The thread was told that stage one is no longer three kinds of navigation: at most two or three layouts of a strong structure on one zoomable surface, or one built directly. He also said of the drawn map, "This looks like a subway map" (correction 14): connections straight and labelled.

## Why

There are now two pages, made by two threads, and both have grown past the size at which a thread should stop:

- **The mock-ups** ([page](https://claude.ai/artifact/KyUE9ZY9bvArEynznJ5p1L), four passes): three places (Map, Express, Yours), a concept that opens in place at three depths, the full reading, his voice anywhere, a notebook, and a hand-written sample in the plain voice he approved. Its map holds a handful of concepts.
- **The huge map** ([page](https://claude.ai/artifact/23ou4as7hxG7DzVB2W6ALz)): an invented bank of 20,000 concepts and 2,000 works that he can zoom and move through, by work and by concept, measured at real size. Its wording is generated, and it does not hold his later corrections.

Adrian asked for both things in one: "the zooming in to the fine details and zooming out are also very, very important", and "I don't like that we have five different sections ... in that section it's built in the way that you don't have to switch to another section to open these things up." So the next step is one page. After his fifth reaction (correction 13 in the concept) it does not inherit the three-place layout: the way of moving is designed afresh, with collections and books first-class.

## How it is started

Repository `technicianofthesacred/ar-create`, starting from `claude/ar-create-ui-ux-review-71qso6` (which holds both pages, both handoffs and the concept), pushing to `claude/wisdom-bank-one-page`. The strongest model at medium effort, the level Adrian set for the mock-ups; high would be justified here, since design judgement is what has fallen short, and is his to choose.

## The text it receives

> You design how Adrian moves through his wisdom bank, and then build it as one page he can open on his phone. A standalone mock-up; nothing in the app changes. Read this whole brief first.
>
> **Where this stands, plainly.** Two earlier threads made pages. Adrian likes parts of them (the plain voice of the hand-written concepts, the three depths of a distillation, the full reading in five parts, zooming a large map). But after five passes he said, on 11 November: "Your way to navigate through different things is not good, they should not be pills to navigate through different things. This is gonna be a massive database of so much And you still haven't integrated the book collections or anything like that. You haven't really addressed my concerns about how to see all the topics inside of the book or inside of the data. Also your suggestions for UI is majorly flawed." So the navigation is the problem to solve, from the start, and you do not inherit the earlier layout. You may reuse its content and its reading.
>
> **Read these, and only these.**
> 1. `docs/research/wisdom-bank/04-concept.md`: only the section "Corrections since this page was written". Thirteen corrections in Adrian's own words. Every one is a requirement. Read them slowly; several say the same thing more than once because it was not heard: works and books kept whole, all their topics visible, both directions, a huge amount of data, calm reading, plain words.
> 2. `design/2026-11-wisdom-bank/HANDOFF.md`: the five passes of the first mock-ups and each of his reactions. Its page is `design/2026-11-wisdom-bank/index.html`; take the hand-written concepts, the tea work, the reading and the notebook from it.
> 3. `design/2026-11-wisdom-bank/zoom/HANDOFF.md`: the huge map, its measurements and what breaks first. Its parts are `head.html`, `a-data.js` (the generator) and `b-app.js` (the map).
> 4. `docs/research/wisdom-bank/05-map-precedents.md`: "Patterns that work" and "Patterns that fail".
>
> Read the page files as you need them. Do not explore the rest of the repository, do not run the app, and do not start sub-agents.
>
> **The question to answer first: how does a person move through a massive bank of books, talks and articles, and everything inside them?** What he has asked for, in his words: "one book may have a hundred concepts. It's important to be able to keep the book together in some sort of map as well so that we can refer to either"; "collect the concepts out of books and be able to browse in either direction"; "a huge map, connecting to other huge maps"; "the zooming and the navigation and the zooming out and zooming in and honing in on things are the first and foremost"; "only one or two sections, maybe three, and in that section it's built in the way that you don't have to switch to another section to open these things up"; "Expression should always be done on the place wherever I am."
>
> A thought from the coordinating thread, offered as a starting point and not as his words: people have moved through large bodies of knowledge for centuries with a few plain forms. A library has collections and shelves. A book has a table of contents that shows all of it at once, in its own order. An index runs the other way, from one idea to every place it appears. A map shows how things lie in relation. His two directions, by work and by concept, are a contents and an index. A design that makes those two feel like one continuous thing, with the map as a way of seeing and travelling and not as the only way in, may serve him better than a new invention. Test this against his words; do not adopt it if you find something better.
>
> **Stage one: show him three ways to move, small, before building any of them.** One page, phone first, the same invented bank in each: several collections, a few dozen works, one book of about a hundred topics, and concepts shared between works. For each way, show the same four moments: the whole bank; one collection; one book with all its topics visible; one topic opened, with the other works that hold it. Make the three genuinely different in how he moves, not three skins. Keep each rough but real enough to touch. Publish, lead with the link and one plain sentence on each way, give your recommendation, and wait for his choice. This stage should be quick.
>
> **Stage two: build the way he chooses as one page.**
> - The whole bank at real size (the generator and drawing from the zoom page can be reused), with collections and works first-class, and a book that shows all its topics.
> - A topic opens in place: one full plain sentence; then about three plain paragraphs; then the full reading in his order (what it is, what you do with it, how you embody it, ways to understand it more deeply, how it can be misunderstood, then the full passages and the source). He never switches section to go deeper or to come back out.
> - A place to land that is written by hand, in the plain voice he approved: a few whole works, including one of about a hundred units and the invented work on tea, with the kinds Idea, Practice, Step, Belief. The bank is one bank for many subjects, not only philosophy.
> - One small floating microphone that works wherever he is; a note is kept on what he is looking at. Expressing something (gathering what the bank holds on a feeling, ordering it, making a piece) also starts from wherever he is. One place holds all his notes.
> - His resonance, his learning marks (Met it, Understand it, Practising it, Can teach it) and his notes shape what he sees first.
>
> **Rules, each from his words.** Understood on first reading, in words a person would say aloud; never compressed labels. As long as understanding needs; the layout makes room for the words. The small view states what the thing is, never a warning about it. Separation by space and surface, not by typeface or label colour, and without spending reading width on frames. No pills for navigation. Few places; nothing opens by switching section. Sleek, minimal, highly functional. No sideways scrolling of the page. No sentences that describe the screen back to him. All content invented and marked Sample; no real person's or teacher's words; never the em dash character.
>
> **Hold at size and say so honestly.** After stage two, measure as the zoom page did and say what breaks first.
>
> **Bounds.** Every thread of Adrian's shares one usage allowance. Phone first (390 wide), one check at 1440. Small contact sheets, at most twice per stage. If your conversation passes about a third of its capacity, stop at the next clean point, write the handoff, push and say so; a fresh thread continues from the files. Do not make pass after pass in a thread that has outgrown itself: that is how the earlier pages drifted.
>
> **Deliver.** The pages under `design/2026-11-wisdom-bank/one/` on your branch, with a `HANDOFF.md` (the three ways and why, his choice in his words, what is hand-written, the measurements, what you were unsure of). Publish each stage for his phone and lead your message with the link.
>
> **Who coordinates.** The coordinating thread is `session_017kitFgZ5x2SMHzVzcAbotm`; its record is `docs/plans/2026-11-11-manager-handoff.md`, and this brief is plan 13 there. Begin each closing message with one plain line saying what is done and what you are waiting for, and send that line to the coordinator. A message from the coordinator may reach you late; check for one before you publish.
>
> **How Adrian wants to be answered.** A link or a picture first. Plain full sentences. No code, no commit hashes, no internal codes. Say what is finished, what is not, and what he must decide, with your recommendation. He often dictates by voice, and he reacts often and in detail: record each reaction in his words as it comes. He has been let down by five passes; do not tell him it is solved, show him.

## After it

- A trial of distilling one real work into units at three depths in this voice, since no mock-up can show whether real distillations land. It needs Adrian to name the work.
- The foundations note: how a bank this size is stored and found, fed by the measurements.
- Building inside version two's Research station.
