# Wisdom bank: what the three reports say together

11 November 2026. One page drawn from [the inventory](00-inventory.md), [products and experience](01-products-and-experience.md) and [open source and the last thirty days](02-open-source-and-recent.md). Written by the coordinating thread so the next thread reads this page first.

## The answer to "is this already built?"

**No single thing covers it. Combine, and build the middle.** All three reports agree.

- Products that distil best (Recall, NotebookLM) keep summaries, not the pure words, and keep them inside their own walls.
- Products that keep pure highlights (Readwise, Snipd, Glasp) do not link ideas across sources or map them.
- No open-source project keeps an exact quote, its speaker and its moment as a checked unit, links it across sources and lets you wander it.
- In Adrian's own systems the closest thing is AR Create's evidence card (exact quote, position, source). It has no speaker, no distillation, no response and no links to other cards.

## What to build: four things nobody gives him

1. **The nugget.** One idea: the exact words, the speaker, the moment in the source, a one-line distillation, and Adrian's own response kept apart. The quote is checked by exact match against the stored transcript, so pure words can never drift into a paraphrase.
2. **Links between nuggets across sources**, proposed by an agent and accepted by him.
3. **A map that is a way to move, not a picture.** Small and local: one nugget and its neighbours, filtered by topic or source. A full graph is "a poster".
4. **The way out**: from a chosen set of nuggets to an article, a script or the words for an artwork, each sentence able to show its source.

## What to borrow

| For | Borrow | From |
|---|---|---|
| Distilling a talk into quotes, ideas and insights with speaker credit | The prompts only | Fabric's "extract wisdom" patterns |
| The overall shape: sources kept untouched, an agent keeps plain pages beside them | The layout and the habit | The "LLM wiki" pattern |
| Coming back every day | A daily few, resurfacing | Readwise's Daily Review |
| The unit | A "snip": the moment, its transcript, a link back | Snipd |
| Trust | Click a citation, see the passage | NotebookLM |
| A map he arranges or that answers a question | Boards and typed objects | Heptabase, Capacities |
| Drawing a large map in the browser | A free library | Sigma.js with graphology |
| Deciding which nugget to show again, and when | A small free scheduler | ts-fsrs |
| A public garden of linked notes, later | Use as it is | Quartz |

Leave alone for now: tools that need their own database or service (Open Notebook, SurfSense, Khoj, Karakeep, Graphiti, Cognee), and tools that build the web of links automatically (GraphRAG, LightRAG), because the links would not be his.

## The traps, which are his stated fear

- **Collecting without returning.** Capture feels easy and retrieval feels like homework. Put "return" first: a daily few, a "continue where I was" door, and an easy way to write from nuggets, so each visit produces something.
- **Maps nobody uses.** Judge a map by whether it answers a question or moves him somewhere.
- **Summaries that flatten.** Errors cluster in names, numbers, dates and quotes. Keep the words exact and checked, label a distillation as a distillation, keep his response apart.
- **Structure before capture.** Capture must be one step. Sorting comes later, or is proposed.
- **The phone neglected.** He wants to read and receive on a phone.

## Why his current screens are not engaging

From the inventory: every screen is organised around work stages and file operations, not around ideas. "Words you kept never appear on the screen unless you open the source itself." Library "reads like a file manager"; an opened item "explains the filing system, not the idea".

## What is still not known

- **i64os was not read.** The inventory thread could not attach it, so everything about the shelf, the book search and the Research Hunt is unverified. A small follow-up thread was started on 11 November to read it.
- **The products were described from reviews, not used.** The surest check is Adrian trying two or three himself for twenty minutes each: Recall, Readwise Reader and NotebookLM, each with one talk he loves.
- **The last thirty days are thin.** His own last-thirty-days skill was not run. It is the better tool for a proper sweep of Reddit, X and Hacker News.
- **How full screens look.** The demo is nearly empty.

## What comes next

1. **Concept**, with Adrian in the conversation: a short interview, then one document saying what a nugget is, how it arrives, how he returns to it, how it leaves as a piece, and where it lives. No mock-ups yet.
2. **Experience mock-ups**, in a fresh thread: one direction first, three screens (a source after distilling, one nugget with its neighbours, the daily return), phone first.
3. **Foundations**: one short design note on storage and linking.
4. **Building**, on lighter models, one plan per thread.
