# Wisdom bank, thread B: products and what they feel like

Written 11 November 2026. Method: about 14 web searches, mostly third-party reviews plus some product pages. I did not open or sign up for anything. Most claims come from search result summaries, so each is marked **vendor claim**, **review**, or **unconfirmed** where it matters. Prices conflict between sources; check the product's own page before relying on any figure.

## 1. The answer on one page

**Nothing covers the whole thing.** Several products each cover a slice well. None keeps exact words, speaker and moment as the base unit, links nuggets across sources, shows a useful map, and helps you write with citations.

| Product | Take in and distil | Pure nugget with source | Links and map | Wander and resurface | Learn | Write with sources | Plain-file export | Phone, no computer | Agents can read and write |
|---|---|---|---|---|---|---|---|---|---|
| Recall | Strong (paste a link, get summary) | Partial (summary first) | Auto graph, tags | Spaced repetition of summaries | Quizzes | Weak | Yes, zipped Markdown (vendor claim) | Yes (cloud) | Unconfirmed |
| Readwise + Reader | Good (highlights, AI summaries) | Strong (your highlight, source kept) | Weak | Strong (Daily Review) | Strong (spaced repetition) | Weak | Yes (Obsidian, Notion and others) | Yes | Yes (API) |
| NotebookLM | Strong (YouTube transcripts) | Strong for citations (jumps to the passage) | Mind map per notebook | Weak | Audio overview, study guide | Strong inside the notebook | Weak (rigid, disputed) | Yes | No known |
| Glasp | Good (transcript highlights, summaries) | Good (highlights on the transcript) | Social, not a map | Weak | Weak | Weak | Yes (Markdown, Obsidian, JSON) | Partial | Unconfirmed |
| Snipd | Strong for podcasts only | Strong (snip, transcript, link back) | None | Medium | Medium | None | Yes (Obsidian, Readwise) | Yes | Via Readwise |
| Heptabase | Manual | Good for PDFs (card keeps page) | Strong (whiteboards) | Medium | Weak | Medium | Unclear | Weak on phone | Unconfirmed |
| Tana | Manual | Medium | Strong (supertags) | Medium | Weak | Medium | Open request | Yes | Yes (local API, MCP, Jan 2026) |
| Capacities | Manual | Medium | Good (typed objects, graph) | Medium | Weak | Medium | Yes (Markdown, JSON) | Yes, mobile reviews mixed | Unconfirmed |
| Obsidian (yours) | Plugins (YouTube, Fabric) | Whatever you build | Graph, Canvas | Weak by default | Plugin | Yours to build | Plain files | Yes | Via files |
| Logseq | Manual | Medium | Good | Medium | Built-in flashcards | Weak | Files (OG), DB beta | Weak | Unconfirmed |
| Zotero | Papers only | Strong (annotation links to page) | Weak | Weak | None | Strong (citations) | Yes | Partial | Via plugins |
| Mem | Manual plus AI | Weak | AI related | AI | None | Weak | Unconfirmed | Yes | Unconfirmed |

**Verdict: combine, and build the middle.**

1. **Do not adopt one product as the home.** The ones that distil best (Recall, NotebookLM) keep summaries, not pure words, and are walled gardens. The ones with pure highlights (Readwise, Snipd, Glasp) lack links and maps.
2. **Borrow the capture step.** The open Fabric `extract_wisdom` prompt already asks for exact quotes, ideas and insights from a transcript, and AR Create already fetches YouTube captions. Use that idea and keep the speaker and timestamp.
3. **Borrow the experience.** Readwise Daily Review for return visits, Snipd's snip for the unit, NotebookLM's click-a-citation-to-see-the-passage for trust, Heptabase and Capacities for a map that you arrange or that answers a question.
4. **Build the nugget, the links between sources, and the way out to a cited piece.** No product does these three for you.
5. **Keep plain files** (Markdown that Obsidian can open) as the base, so any of these tools can be tried on top without lock-in.

## 2. What the best feel like to use

I could not watch these products in use. These are descriptions from reviews and product pages, with links. Treat each as "reported", not "seen".

### Taking something in and getting it distilled
- **NotebookLM.** You add a YouTube link as a source. It reads the transcript, then you ask questions and get answers with numbered citations that point at the passage in the source. Reviews call this its best feature. Weakness: output stays inside the notebook. [Review](https://macmyths.com/google-notebooklm-guide-sources-citations-output-tools/), [limits](https://atlasworkspace.ai/blog/notebooklm-limitations)
- **Recall.** You save a link and get a summary and tags. Its pages say the library has chat, a graph and review. [Recall](https://www.recall.it/personal-knowledge-management)
- **Fabric extract_wisdom.** A command line prompt: pipe in a transcript, get IDEAS, INSIGHTS, QUOTES, HABITS. It asks for 15 to 30 exact quotes. Not a product for browsing, but the right shape of output. [Pattern](https://git.blob42.xyz/Archives/fabric/src/commit/4c14d1a19cb5b64d31a3fa3edb24f8cab6084fe8/patterns/extract_wisdom/system.md)

### Seeing one idea pure, with its source
- **Snipd.** While listening you tap to snip. You get the exact moment, a transcript excerpt, a short AI summary, your note, and a link back to that moment. Its Obsidian plugin writes all of that into your vault. This is the closest anyone gets to your "nugget". [Snipd plugin](https://community.obsidian.md/plugins/snipd-official)
- **Glasp.** You highlight lines in a YouTube transcript yourself and add a note. [Glasp](https://glasp.ai/posts/how-to-highlight-youtube-transcript)
- **Zotero.** Each highlight links to its exact page in the PDF and opens there. [Zotero Completion](https://community.obsidian.md/plugins/zotero-completion)
- **Heptabase.** PDF highlights become cards that stay linked to page and line (review claim). [Review](https://dev.to/pickuma/heptabase-review-visual-note-taking-for-thinking-through-problems-5daa)

### Seeing how ideas connect, usefully
- **Heptabase whiteboards.** You drag cards onto a board and arrange them to think about one problem. The map is made by you, per question. Reviews say it beats a linear editor for synthesis, but needs desktop and patience. [Review](https://dev.to/pickuma/heptabase-review-visual-note-taking-for-thinking-through-problems-5daa)
- **Capacities.** Typed objects (person, book, idea) linked with @. One review says the graph is most useful when it answers a question. [Review](https://blog.saner.ai/capacities-review)
- **Tana supertags.** Notes carry types and fields, so you can query them. Reported to pay off only after you learn the system. [Review](https://dev.to/pickuma/tana-review-an-outliner-based-pkm-tool-that-thinks-in-graphs-8l8)
- **Obsidian Smart Connections.** While you write, it lists related notes by meaning. Useful because it comes to you. [Plugin](https://community.obsidian.md/plugins/smart-connections) (unconfirmed which page; listing seen in search)

### Wandering and rediscovering
- **Readwise Daily Review.** A handful of old highlights arrive each day, by email or app, chosen by a spaced repetition schedule. This is the clearest answer to "collecting and never returning". [Readwise](https://readwise.io/upgrade)
- **Recall** reviews saved summaries on a schedule (vendor claim).
- **Evergreen notes** (see section 4) is the idea behind returning on purpose.

### Reading and learning
- **Readwise Reader.** A reading app with highlights, Ghostreader AI help and flashcards from what you read. [Review](https://www.asianefficiency.com/productivity/readwise-reader-review/)
- **NotebookLM audio overview.** Two voices discuss your sources. Praised in reviews as a pleasure to listen to, and criticised for daily caps. Not pure, since it paraphrases.
- **Logseq** turns any block into a flashcard without a plugin. **Orbit** and the mnemonic medium (section 4) build review into the text itself.

### From kept ideas to writing with sources
- **NotebookLM** gives cited answers and drafts but only inside the notebook and with rigid export.
- **Zotero with Obsidian** gives real citations, for papers.
- **No product found** goes from a set of nuggets to an article where each sentence shows its source. This is the gap.

## 3. Traps

- **Collecting without returning.** "A note that is never revisited might as well not exist." Remedies offered: spaced repetition, random resurfacing, scheduled review. [Write-only second brain](https://www.toolsforhumans.ai/blog/your-second-brain-is-write-only-heres-why-most-notes-never-get-revisited), [Collector's Fallacy](https://goodluckman.substack.com/p/the-collectors-fallacy-why-most-notetaking)
- **Graph views that look good and help nobody.** One author says a graph shows that connections exist, not which matter. Another says judge by the graph answering a question, not by its size. This is opinion from blogs, no study found. [PKM anti-patterns](https://www.dsebastien.net/ai-wiki-pkm-pkm-anti-patterns/)
- **AI summary as the most tempting form of collecting.** Summaries are reported to flatten tone and emphasis, drop the link to the earlier argument, misattribute speakers, and favour the start and end of long transcripts. A claim that AI summaries overgeneralise much more than the sources is from a vendor and I could not verify it. Safer use: a summary decides what to read in full. [When summaries go wrong](https://www.you-tldr.com/blog/when-ai-summaries-get-it-wrong), [accuracy test](https://you-tldr.com/blog/ai-video-summarization-accuracy-benchmark)
- **Structure before capture.** Capacities needs a structural choice for every item, which slows quick capture. Tana pays off after learning. [Capacities review](https://blog.saner.ai/capacities-review)
- **Phone neglected.** Heptabase board editing and Capacities mobile get criticism. Logseq mobile is limited. You want to read on a phone.
- **Walled gardens and rigid export.** NotebookLM export is called rigid in reviews (one July 2026 review says fixed, so conflicting). Tana full export is an open request. [NotebookLM limits](https://atlasworkspace.ai/blog/notebooklm-limitations)
- **Beta risk.** Logseq's database version is still beta, with reported data-loss risk and import problems. [Comparison](https://softpicker.com/obsidian-vs-logseq/)
- **Churn.** Products change fast: Tana renamed itself in March 2026, a community Tana MCP server was reportedly archived. Keep your data in files you own.

## 4. The ideas behind them

- **Atomic notes.** One idea per note, so it can be linked and reused. For you: one nugget is one idea with its exact words, never a bundle. Keep your response beside it, not inside it.
- **Evergreen notes (Matuschak).** Atomic, concept-oriented, densely linked, written to be revised over years, organised by association not folders. For you: the link between nuggets is where the value grows, and returning to them is part of the practice. [Andy's notes](https://notes.andymatuschak.org/Evergreen_notes)
- **Progressive summarising (Forte).** Layers: original, saved excerpts, bolded passages, highlighted passages, optional summary. Each pass is cheaper to read than the last. For you: keep the layers, but the base layer is the exact words, and the summary is always labelled as a summary. [Forte Labs](https://fortelabs.com/blog/progressive-summarization-iii-guidelines-and-principles/)
- **Commonplace book.** A long-standing practice of copying striking passages with their source into one book, organised for later use, such as by John Locke's indexing method (from general knowledge, not confirmed in this search). For you: this is nearly exactly your nugget, quote plus credit, so it is the right name to design toward.
- **Spaced repetition.** Reviewing items at growing intervals so they stay in memory. Matuschak and Nielsen's mnemonic medium (Quantum Country, Orbit) puts the review inside the reading. For you: a few nuggets a day, and a quiz asked of you rather than a pile you file. [Essay](https://markbernstein.org/Feb24/Howcanwedeveloptransformat.html)

## 5. What I could not confirm

- Official pricing for every product. Sources conflict.
- Whether Recall, Glasp, Capacities, Mem and Heptabase offer an API for agents.
- Exact current output of Fabric's `extract_wisdom` (read from mirrors).
- Heptabase export formats.
- How any of these look, since I read descriptions and did not see screens. Next step if wanted: someone watches 2 to 3 demo videos (Snipd, Heptabase, Readwise Daily Review) and captures screenshots.
- Thread C (open source) may find projects that fill the gaps above.

## Sources

- Recall: [personal knowledge management](https://www.recall.it/personal-knowledge-management), [pricing](https://www.recall.it/pricing), [Obsidian alternative](https://www.recall.it/obsidian-alternative), [review](https://tooliverse.ai/tools/recall)
- Readwise: [upgrade page](https://readwise.io/upgrade), [Reader review](https://www.asianefficiency.com/productivity/readwise-reader-review/), [developer review](https://dev.to/pickuma/readwise-reader-review-is-it-worth-it-for-developers-in-2026-33kf)
- NotebookLM: [guide](https://macmyths.com/google-notebooklm-guide-sources-citations-output-tools/), [limitations](https://atlasworkspace.ai/blog/notebooklm-limitations), [review](https://www.zemith.com/en/learn/notebooklm-review)
- Glasp: [YouTube summary](https://glasp.ai/features/youtube-summary), [highlight transcript](https://glasp.ai/posts/how-to-highlight-youtube-transcript)
- Snipd: [App Store](https://apps.apple.com/uz/app/id1557206126), [Obsidian plugin](https://community.obsidian.md/plugins/snipd-official)
- Heptabase: [review](https://dev.to/pickuma/heptabase-review-visual-note-taking-for-thinking-through-problems-5daa), [Product Hunt](https://www.producthunt.com/products/heptabase/reviews)
- Tana: [April 2026 update](https://outliner.tana.inc/blog/tana-current-april-2026), [review](https://dev.to/pickuma/tana-review-an-outliner-based-pkm-tool-that-thinks-in-graphs-8l8), [MCP guide](https://contextbolt.com/blog/tana-mcp/)
- Capacities: [product](https://capacities.io/product), [review](https://blog.saner.ai/capacities-review), [vs Obsidian](https://capacities.io/compare/obsidian)
- Obsidian plugins: [YTranscript](https://community.obsidian.md/plugins/ytranscript), [YouTube transcript fetcher](https://community.obsidian.md/plugins/youtube-transcript-fetcher)
- Logseq: [comparison](https://softpicker.com/obsidian-vs-logseq/), [researchers](https://ponder.ing/blog/logseq-vs-obsidian)
- Zotero: [Zotero Integration plugin](https://github.com/mgmeyers/obsidian-zotero-integration), [Zotero Completion](https://community.obsidian.md/plugins/zotero-completion)
- Mem: [review](https://blog.saner.ai/mem-ai-reviews), [G2](https://www.g2.com/products/mem-ai)
- Fabric: [extract_wisdom](https://git.blob42.xyz/Archives/fabric/src/commit/4c14d1a19cb5b64d31a3fa3edb24f8cab6084fe8/patterns/extract_wisdom/system.md)
- Failure accounts: [write-only second brain](https://www.toolsforhumans.ai/blog/your-second-brain-is-write-only-heres-why-most-notes-never-get-revisited), [Collector's Fallacy](https://goodluckman.substack.com/p/the-collectors-fallacy-why-most-notetaking), [PKM anti-patterns](https://www.dsebastien.net/ai-wiki-pkm-pkm-anti-patterns/), [summaries going wrong](https://www.you-tldr.com/blog/when-ai-summaries-get-it-wrong), [accuracy test](https://you-tldr.com/blog/ai-video-summarization-accuracy-benchmark)
- Ideas: [evergreen notes](https://notes.andymatuschak.org/Evergreen_notes), [progressive summarization](https://fortelabs.com/blog/progressive-summarization-iii-guidelines-and-principles/), [tools for thought essay](https://markbernstein.org/Feb24/Howcanwedeveloptransformat.html)
