# Plan 9: the wisdom bank, an inquiry before any building

**Status.** **Set apart on 11 November 2026 into its own home thread, so that this work stays focused on building AR Create.** Its state is on one page: [where it stands](../research/wisdom-bank/07-where-it-stands.md). Before that: an inquiry. The three discovery threads reported on 11 November; their reports and a one-page synthesis are in `docs/research/wisdom-bank/`. i64os has since been read too (`00b-i64os-inventory.md`), and the concept is written from an interview with Adrian: `docs/research/wisdom-bank/04-concept.md`. The brief for the mock-ups is [plan 11](2026-11-11-11-wisdom-bank-mockups-brief.md). Nothing is designed or built. The running state is kept in the [manager handoff](2026-11-11-manager-handoff.md). Written 11 November 2026 from Adrian's words, with a first quick look at what already exists.

## What Adrian asked for, in his words

> "If there's something that is very potent or thought provoking, whether it's somebody's book or work or ideas, I should be able to post that YouTube video in, and it would not only reference that person's YouTube, but it would also distill the YouTube. Take all of the concepts and the bits of information and put it together into some sort of wisdom bank. That portion can be deeper researched, it can be cross-linked, it can be mapped to other things as: hey, something similar, or related. This essentially is what research is. You find something that really resonates, that you really respect, and it becomes this building block of the wisdom that you assimilate and learn to guide yourself and share with others in your work, in your creations."

His two questions:

1. "Is there anything already built like this online that covers a large portion of this?"
2. "How do we take all these bits of wisdom and knowledge and nuggets and contain them in the purity of what that is, make it fun to understand it and to receive the wisdom from it, interconnect them to each other, and then be able to create these readable articles that source the right places, or are shared in videos, or shared through the art that I am creating."

And the aim: "something structurally durable and integratable into everything I'm doing", without spending tokens carelessly.

## Adrian's correction, same day: the experience comes first

> "My biggest risk is actually going back over the things: being able to access and understand the concepts that are exciting for me that I am working on. The interconnection and all this, if it's not something that I can see, visualize, navigate, understand, there's not anything that I can do with it."

> "It's about capturing these nuggets, interconnecting them into my creation platform. Collecting them but being able to browse through them, to use them as my reading platform, to learn them, to use them as the inspiration for the art, to assimilate them, to interconnect them. All of this is not done in a way that is exciting, that is engaging, or that is usable currently. The interface and the end result for all of these are a far way off from what it should be. So this is the other aspect that is kind of first and foremost."

> "If there is some conversation, some last thirty days, or GitHub repositories that have already built some of this out, I don't have to build it all a hundred percent."

What this changes:

- **The experience leads; storage follows.** The question that decides success is whether he can see, wander, read, learn from and use what he has kept. Part 2 becomes an experience design with clickable mock-ups, and part 3 (foundations) serves it.
- **The landscape is split in two and widened**: products and what using them feels like; and open-source projects plus what people building these tools have been saying in the last thirty days, including where such tools fail (collecting without ever returning; a graph that is pretty and useless).
- **The inventory also looks at how his existing screens feel**, with pictures, not only at what they store.

**The fan-out as started on 11 November** (three threads on the lighter model, side by side):

| Thread | Answers | Output |
|---|---|---|
| A. Inventory | What he already has in i64os and AR Create, what it stores, and why it is not engaging to return to | `docs/research/wisdom-bank/00-inventory.md` |
| B. Products and experience | Which existing products come closest, and what seeing, browsing, reading, learning and assimilating feels like in the best of them | `docs/research/wisdom-bank/01-products-and-experience.md` |
| C. Open source and the last thirty days | Which GitHub projects have already built parts he could adopt or borrow, and what builders and users are saying now | `docs/research/wisdom-bank/02-open-source-and-recent.md` |

Then, when all three are in: **D. the experience design**, on the strongest model at high effort, with Adrian in the conversation, as clickable mock-ups filled with lifelike nuggets. Then the foundations note. The four-part table below still describes the questions; this fan-out is how they are being run.

## What already exists (a first quick look, 11 November)

Much of this has been started, in two places. Any new work must begin from these, not beside them.

**In i64os**
- **The shelf** at `/read`: 189 real notes. Each opens at three depths (summary, analysis, full transcript) with six verdicts (Integrate, Stack, Write, Build, File, Trash) and named stacks (i64os `HANDOFF-SHELF.md`). This is already "take something in and distil it".
- **Library search** over books, with chunks, notebooks and "beliefs by domain" (`apps/core/lib/library/`).
- **The Research Hunt**: proposes viewpoints, reads widely for each, and sorts each fact as settled, contested or fringe, with sources; one pile per topic (`apps/core/lib/research/`, i64os `todo/plans/arcreate-hunt-link.md`).
- A survey of open-source research tools was made on 1 November (linked from that plan).

**In AR Create**
- **Library**: every source once, with a permanent identity; YouTube captions (`runtime/services/youtube-captions.mjs`), a "YouTube not yet watched" filter, folders and topics.
- **Collections** (inquiries): "reusable inquiries over Library sources: questions, evidence, evolving understanding" (`docs/START.md`), with their own commands for agents.
- **Research**: questions, saved answers, evidence marked Supported or Uncertain, a reusable brief, Tea Atlas lookup.
- **Intent already recorded** in `docs/product/PRODUCT.md`: "Curated personal resource library" (18 October) and "Mixed-origin topic learning" (20 October): one topic may combine several YouTube videos, transcripts and personal notes; learning should surface aspects "the author may not yet know to ask"; keep the actual video link, title, channel and timestamps.

**What seems to be missing** (to be confirmed by the inventory):
- **The nugget itself**: one idea, kept pure (the exact words, who said them, the moment in the source), with Adrian's own response kept beside it and never mixed in.
- **Links between nuggets across sources**, and a map of them.
- **A way of receiving it that is a pleasure**, not a filing task.
- **One home.** Today the shelf (i64os) and the Library (AR Create) are separate, and i64os's own to-do list already says "Make AR Create the one writing system and stop building writing tools twice".
- **The path out**: from nuggets to an article, a video script or an artwork's text that cites the right places.

## The inquiry, in four parts

Each part ends in one short document in this folder, so the next part reads two pages, not a chat.

| # | Part | Question it answers | Model | Why that model | Output |
|---|---|---|---|---|---|
| 0 | **Inventory** | What do I already have, what runs on real material, where do the two systems overlap, what is truly missing? | Sonnet | Fact-finding across two codebases; read-only | `docs/research/wisdom-bank/00-inventory.md` |
| 1 | **Landscape** | Is something already built that covers most of this? What should be borrowed, and what is unique to Adrian's need? | Sonnet with web search | Gathering and comparing; no code | `docs/research/wisdom-bank/01-landscape.md` |
| 2 | **Direction** | What is this, how does it feel, how does a nugget connect to others and flow into pieces? | The strongest model, high effort, with Adrian in the conversation | Product judgement; his intent decides it | `docs/research/wisdom-bank/02-direction.md` and mock-ups of the key screens |
| 3 | **Foundations** | How is it stored, linked and kept, so it lasts and fits AR Create, the vault, agents and working without the Mac? | Opus or the strongest model, as one short design note | Risky thinking, little typing | `docs/research/wisdom-bank/03-foundations.md` |

**Order.** Parts 0 and 1 run first and side by side: they are cheap and independent. Part 2 starts only when both are in, so the expensive thread spends its effort on judgement, not on rediscovery. Part 3 follows part 2. Building comes after, on lighter models, one plan per thread.

### Part 0: inventory (brief)

Read-only, across both repositories. For each of: the i64os shelf, i64os Library search, the Research Hunt, i64os capture and ingest, AR Create's Library, Collections, Research, Tea Atlas, YouTube captions, the word library, and the Obsidian vault conventions:
- what it does today, in two sentences;
- whether it runs on real material or only exists as code (from the status documents, not by opening private data);
- what unit it stores (a note, a chunk, a claim, a card), with what identity and links;
- how something gets in and how it gets out.

Then one table of overlaps, and one list of what the wisdom bank needs that nothing provides. No recommendations beyond "reuse this, merge these, this is missing".

### Part 1: landscape (brief)

Answer Adrian's first question honestly: which existing products or open-source tools cover a large part of "paste a video, distil it, keep the nuggets, link and map them, write from them with sources". For each serious candidate: what it does well, what it lacks for him, whether his material can be exported in plain files, what it costs, and whether it can run without his Mac. Include the ideas behind them (atomic notes, progressive summarising, commonplace books) as well as the tools.

Candidates to check first. These are from memory and must be verified, since products change: Recall, Readwise Reader, NotebookLM, Glasp, Snipd, Heptabase, Tana, Logseq, Obsidian with its plugins (Adrian already uses Obsidian), Zotero, and the open-source Fabric patterns (one is called "extract wisdom" and is made for exactly this kind of distilling). Reuse the 1 November survey of research tools rather than repeating it.

End with a plain verdict: adopt one, borrow from several, or build, and which parts.

### Part 2: direction (brief)

Starts with a short interview of Adrian (five to eight questions, answered by voice is fine), kept verbatim. Then:
- **The unit.** What a nugget is: the exact words, the speaker, the moment in the source, a one-line distillation, Adrian's own response, and its links. Source speech, his reflection and AI synthesis stay visibly different, as AR Create already requires.
- **The flow.** Paste a link; it is fetched and distilled; proposed nuggets arrive for him to keep, reword or discard; links to what he already holds are proposed, never applied silently; he can ask for deeper research on any one.
- **Receiving it.** How it is a pleasure: reading, listening, a daily few, a map he can wander.
- **The way out.** From a set of nuggets to an article, a script or the words for an artwork, each sentence able to show where it came from.
- **Where it lives.** One home, and what happens to the shelf and the Library.
- Mock-ups of three screens (a source after distilling, a nugget, the map), in the visual direction chosen in the design round (plan 8).

### Part 3: foundations (brief)

One design note, no building. It must respect what is already decided:
- sources are stored once with a permanent identity; nothing of Adrian's is overwritten; never last-write-wins;
- files a person can read (Markdown that Obsidian can open) for the nuggets and their links, with any search index derived from them and rebuildable;
- no new engine or database without a recorded decision (`docs/START.md`, "Rules that do not bend");
- agents propose, Adrian decides; every write names its author;
- it fits plan 3 (one source list for each subject) and plan 6 (one home on the always-on server, pCloud as the carrier).

It answers: what is one nugget on disk; how a link is recorded; how the exact words stay tied to the source moment when a transcript is corrected; how large this can grow; how it is found by meaning, not only by exact words; how an agent reads and proposes into it.

## Principles to hold from the start

- **Purity.** The source's exact words and Adrian's words about them are different things and are never blended. A distillation is labelled as a distillation.
- **Credit.** Every nugget keeps its source, speaker and moment, so anything written from it can cite properly. Other people's ideas are quoted and credited, not absorbed.
- **One home.** Do not build this a third time.
- **Pleasure is a requirement**, not decoration.
- **Cheap first.** Find out what exists before designing; design before building.

## Decisions needed first

- Adrian's yes to start parts 0 and 1.
- Whether the home is AR Create (suggested, since it is meant to be the one writing system), with the i64os shelf feeding it.
