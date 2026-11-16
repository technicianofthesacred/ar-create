# Wisdom bank, thread C: open source and the last thirty days

Written 11 November 2026 from web search only. Nothing was installed, cloned or run. I did not run the last30days skill (see "How this was done"). Where a fact comes from my own memory and not from a page I saw, it is marked **(memory)**. Where sources disagreed or I could not confirm, it is marked **(unconfirmed)**. Many star counts and version numbers came from third-party listing pages, so treat them as roughly right, not exact.

## One page: the answer

### The kit (four things, one optional)

Nothing I found does what you describe end to end. No open-source tool I saw keeps an exact quote, its speaker and its moment in the video as a checked unit, links it across sources, and lets you wander it. So the kit is a set of borrowed parts around one thing you build: the nugget.

1. **Fabric's extract-wisdom patterns, as the distilling step.** Borrow the prompts, not the program. Its newest relevant pattern keeps who said each quote. Cost: nearly nothing, because a pattern is a text file.
2. **The "LLM wiki" shape (Karpathy's idea, shown in mcptube).** Raw sources are kept untouched and never edited. An agent writes and maintains plain Markdown pages beside them. This is the same rule you already have (sources once, agents propose). Borrow the layout and the "lint" habit, not the code.
3. **Sigma.js with graphology for the map.** A free (MIT) drawing library that handles thousands of points. The map is where most tools fail, so the work is in what it shows, not the library.
4. **ts-fsrs for "learn it".** A small free scheduler (JavaScript) for deciding which nugget to show again and when. It needs no database beyond a file.
5. **Optional: Quartz for a public garden**, only when you want to publish a linked set of notes as a website.

The part nobody gives you, and you must build: **a nugget whose quote is checked by exact text match against the stored transcript**, so the pure words can never drift into a paraphrase. That one check answers the biggest complaint about AI note tools.

### Table of projects and verdicts

| Project | Verdict | One-line reason |
|---|---|---|
| Fabric (extract_wisdom) | Borrow a part | Prompts for ideas, quotes and speaker credit. The Go program is not needed. |
| Karpathy LLM wiki pattern / mcptube | Borrow the idea | Right shape: untouched sources plus agent-kept Markdown pages. mcptube is Python and YouTube-only. |
| Sigma.js + graphology | Borrow (use as a library) | Draws large maps in the browser. MIT. |
| Cytoscape.js | Borrow if you want analysis | Better when you need clusters and paths, not only drawing. MIT. |
| ts-fsrs | Borrow (use as a library) | Small scheduler for "see it again". |
| Quartz | Use as it is, later | Publishes a Markdown folder as a linked website. |
| Obsidian (not open source, but you use it) | Keep as a viewer | Opens the same Markdown files and shows a graph. |
| Smart Connections (Obsidian plugin) | Leave for now | Related-note finding is good but it lives in Obsidian, and its licence may have changed (unconfirmed). |
| Open Notebook | Leave, read for ideas | Closest NotebookLM copy, but a Python service with its own database. |
| SurfSense | Leave | Team product with many connectors and a database. Too heavy. |
| Khoj | Leave | Large service, hosted version reportedly closed in April. |
| Karakeep | Leave | Good capture app, but a bookmark shelf, not a nugget bank. Own database. |
| Readeck, Wallabag, Omnivore | Leave | Read-it-later stores of whole articles. Omnivore's hosted service is dead. |
| LightRAG, GraphRAG | Leave for now | Build a graph with an AI automatically. Expensive, and the links are not yours. |
| Graphiti, Cognee | Leave | Need a graph database or heavier setup. Built for agent memory, not for reading. |
| Logseq, SiYuan, Trilium, Anytype, AFFiNE | Leave | Whole apps with their own storage. Wrong shape for a Node plain-file system. |
| React Flow, tldraw, Excalidraw | Leave for the map | Editors for diagrams you draw by hand. tldraw needs a licence key for production use. |
| Foam, TiddlyWiki | Leave | Fine tools, nothing you lack. |

### The last thirty days in five sentences

1. The big theme is Karpathy's "LLM wiki" idea (April, still spreading): let an agent keep a folder of Markdown pages current instead of searching raw documents every time, with Obsidian as the viewer; many small tools copied it, including one for YouTube.
2. The loudest complaint stays the same: capturing feels like progress and returning feels like homework, so notes pile up unread ("a second inbox"), and the full graph view is called "a poster".
3. Defenders say the graph works only with filters and a small local view, and only if someone curates it.
4. People keep reporting that AI summaries drop caveats and numbers, and that NotebookLM sometimes invents quotes, which is exactly why keeping the exact words matters.
5. Release news near you: Obsidian 1.15.0 (22 October) and its command line (since February) help agents write into a vault; GraphRAG added incremental updates on 8 October (unconfirmed, one source); Logseq's database version is still beta and warns of possible data loss.

## Full entries

Each entry: what it does, how alive, licence, built with, plain files or database, verdict. "Fit" means fit with a Node plain-files system on one small server where agents read and propose.

### 1. Fabric (danielmiessler/Fabric)
- **What it does.** A command-line tool that runs a library of prompts, called patterns, on text. `extract_wisdom` pulls ideas, insights and quotes. Its YouTube helper fetches a transcript (via yt-dlp) and pipes it to a pattern. A newer pattern, `extract_wisdom_with_attribution`, adds speaker-attributed quotes (release v1.4.387). A later release (v1.4.393) removed some older wisdom patterns.
- **Alive.** Yes. Releases up to at least v1.4.395 appear in release trackers. Exact dates were not shown **(unconfirmed)**.
- **Licence.** MIT **(memory, not confirmed on a page)**. Check the LICENSE file before copying text.
- **Built with.** Go. Patterns are plain Markdown prompt files.
- **Data.** No database. Plain files.
- **Fit.** The program does not fit (Go, separate tool). The patterns fit perfectly as text. Timestamps are not part of `extract_wisdom`; they need the separate timestamped-transcript option.
- **Verdict: borrow a part.** Take the prompt wording and the attribution idea. Add a rule that every quote must be found word for word in the transcript.

### 2. The "LLM wiki" pattern and mcptube (0xchamin/mcptube)
- **What it does.** Karpathy's gist describes an agent that incrementally maintains a folder of Markdown pages, with raw sources kept in a never-edit folder and a schema file telling the agent the rules. Common routine: ingest, query, lint (ask the agent to health-check the wiki). mcptube applies this to YouTube: it extracts transcripts, detects scene changes, describes frames with a vision model, and extracts knowledge.
- **Alive.** The idea spread widely from April 2026. mcptube had a Show HN in April and a PyPI package. Activity since then **(unconfirmed)**.
- **Licence.** mcptube shows MIT on its listings **(not confirmed on the repo)**. Karpathy's gist is an idea, not code.
- **Built with.** Python (mcptube). Markdown files.
- **Data.** Markdown plus its own index. A critic notes it does not scale to millions of documents, which is not your problem.
- **Fit.** The shape fits your rules almost exactly. The code does not (Python).
- **Verdict: borrow the idea.** It confirms the design: untouched sources, agent-maintained pages, a periodic health check. Read mcptube's ingest steps before designing yours.

### 3. Sigma.js with graphology (jacomyal/sigma.js)
- **What it does.** Draws large graphs in the browser with WebGL. graphology holds the graph data and has algorithms (clusters, neighbours).
- **Alive.** v3 is current. A v4 beta site exists. Version dates **(unconfirmed)**.
- **Licence.** MIT (one aggregator lists v3.0.3 as MIT; **confirm on the repo**).
- **Built with.** TypeScript, WebGL. A React wrapper exists. Plain JS works too.
- **Data.** None. You hand it nodes and links.
- **Fit.** Good: a browser library served from your Node server. One claim of 100,000 nodes at smooth speed is from a single secondary page, not checked. You will not need that many.
- **Verdict: borrow (use as a library).** But the library only draws. The real design question is what a useful map shows (see "What the complaints mean for you").

### 4. Cytoscape.js
- **What it does.** Graph drawing plus graph analysis (shortest paths, clustering, centrality).
- **Alive.** Mature, long-lived **(memory)**.
- **Licence.** MIT **(from one 2026 internal decision document and memory)**.
- **Built with.** JavaScript.
- **Fit.** Good, and easier than Sigma for small and medium maps with styling. One source suggests Cytoscape up to roughly 3,000 to 5,000 items, then Sigma.
- **Verdict: borrow if you want analysis.** For a bank of hundreds to low thousands of nuggets, either works. Pick on look and feel, not speed.

### 5. ts-fsrs (open-spaced-repetition)
- **What it does.** A JavaScript/TypeScript scheduler for the FSRS algorithm, the modern way to decide when you should see an item again. Anki has used FSRS since late 2023. Sources disagree on which Anki version made it default.
- **Alive.** Yes, listed as the FSRS-6 scheduler. Obsidian plugins and the Rember app use it. Next version FSRS-7 is described as likely the last major one (from a secondary source).
- **Licence.** MIT **(memory)**.
- **Fit.** Very good. It is pure calculation. You store a due date and a few numbers per nugget in your own files.
- **Caution.** FSRS is made for flashcards with a right answer. For "a thought I want to meet again", you will want a lighter "show me one today" rule, with FSRS only for nuggets you choose to learn. I found nothing on note resurfacing specifically.
- **Verdict: borrow (use as a library).**

### 6. Quartz (jackyzha0/quartz)
- **What it does.** Turns a Markdown folder (an Obsidian vault works) into a static website with backlinks, graph and search. Guides show a GitHub Action builds it and a host serves it. You can filter which notes are public.
- **Alive.** v4 is current. Version number not confirmed.
- **Licence.** MIT **(memory)**.
- **Built with.** TypeScript, Node.
- **Fit.** Good, and it matches "plain files". Useful later for sharing a garden. Not needed for your private reading.
- **Verdict: use as it is, when you want to publish.**

### 7. Obsidian and Smart Connections
- **Obsidian** is not open source, but it opens the same plain Markdown files you already keep. 1.15.0 shipped 22 October 2026. The command line (introduced February 2026) lets scripts control it, and 1.15.0 added commands to append or prepend content under a heading. Canvas links now count in the graph (1.12.4, 27 February).
- **Smart Connections** finds related notes with local embeddings, no key needed. One review says its licence moved in early 2026 from GPLv3 to a "source-available" licence, with a paid tier adding a visual graph **(unconfirmed, check the repo)**.
- **Verdict.** Obsidian: keep as an optional viewer, since it costs nothing and reads your files. Smart Connections: leave for now. The idea (suggest related nuggets by meaning) is worth borrowing later, but suggestions must arrive as proposals you accept.

### 8. Open Notebook (lfnovo/open-notebook)
- **What it does.** A self-hosted copy of NotebookLM: put in sources, chat with them with citations, make podcasts.
- **Alive.** Yes, popular. Star counts differ by source (about 17,700 to 28,000).
- **Licence.** MIT (confirmed by search results).
- **Built with.** Python, with a database and Docker.
- **Fit.** Poor. It has its own storage and service, and it is a chat tool, not a place to wander.
- **Verdict: leave.** Read how it shows citations.

### 9. Karakeep (karakeep-app/karakeep)
- **What it does.** Saves links, notes and images, tags them with AI, full-text search. Works with local models through Ollama.
- **Alive.** Yes. About 27,000 to 29,000 stars. Latest seen: v0.33.x, but sources disagree.
- **Licence.** AGPL-3.0. You may use it, but changes you serve over a network must be shared.
- **Built with.** TypeScript, Docker, own database.
- **Verdict: leave.** Good capture, wrong unit. It keeps whole pages, not nuggets.

### 10. LightRAG, GraphRAG, Graphiti, Cognee
- **What they do.** Build a graph of people, ideas and facts out of text automatically, then answer questions over it.
- **Alive.** Yes. GraphRAG 3.3.0 on 8 October 2026 added incremental updates; LightRAG 1.5.7 can add and remove documents **(one source, unconfirmed)**. Both reported as MIT. Graphiti is reported as Apache-2.0 from a mirror **(unconfirmed)**.
- **Data.** Graphiti needs a graph database (Neo4j by default, or FalkorDB, Kuzu, Neptune). Cognee can run embedded without one, by its own claim. LightRAG indexing costs about two to three times the source text in tokens; GraphRAG more (five to ten times, one source).
- **Fit.** Poor. An AI decides the links, and the links are not yours. A graph built that way is the "pretty and useless" map people complain about.
- **Verdict: leave for now.** Later, one narrow use could be a proposal tool: suggest possible links between nuggets for you to accept.

### 11. Khoj, SurfSense
- **Khoj.** Self-hosted AI assistant over your notes. AGPL-3.0. Its hosted cloud reportedly closed 15 April 2026 **(secondary source)**. Latest seen 2.0.0-beta.28 (26 March). **Leave.**
- **SurfSense.** An open NotebookLM alternative for teams with many connectors. Apache-2.0, about 13,600 stars. **Leave.**

### 12. Read-it-later: Readeck, Wallabag, Omnivore
- **Readeck.** Stores articles and videos, self-hosted, version 0.22 (4 March 2026), 0.22.2 mentioned in May. Licence not confirmed (I believe AGPL **(memory)**). A paid hosted version is planned. **Leave.**
- **Wallabag.** Long-standing PHP read-it-later. **(memory, not checked)** **Leave.**
- **Omnivore.** Hosted service shut down in November 2024 after the team joined ElevenLabs. Code remains but needs a database, search engine and several services. **Leave.**

### 13. Whole note apps: Logseq, SiYuan, Trilium, Anytype, AFFiNE, TiddlyWiki, Foam, Reor
- **Logseq.** The database version reached public beta (2.0.1) on 13 July 2026, with a warning that it can lose data. File graphs continue to work. It is moving *away* from plain Markdown as the main store, which is the opposite of what you want.
- **SiYuan.** AGPL-3.0 (confirmed). Own storage format.
- **Trilium, Anytype, AFFiNE, TiddlyWiki, Foam, Reor.** I did not verify these in this round **(memory only)**. All are whole apps.
- **Verdict: leave.** None is a library for a Node system. Read the Logseq beta's graph view rebuild if you want ideas for the map.

### 14. Drawing tools: React Flow, tldraw, Excalidraw
- **tldraw** needs a licence key in production; the free hobby licence keeps a "made with tldraw" mark and is non-commercial. A commercial licence is paid, price not published.
- **React Flow** (MIT core) and **Excalidraw** are editors for diagrams drawn by hand.
- **Verdict: leave.** Your map is generated from links, not drawn by hand. A canvas could come later for arranging a set of nuggets while writing, and that is where React Flow could be borrowed.

### Other things seen once and not examined
CocoIndex's podcast-to-knowledge-graph example (speakers, statements and entities, stored in SurrealDB); `notewise` (study notes per video); ViNote; `kgmd` (a command that builds a graph from Markdown files and offers it to agents, version 0.2.0 on 28 August 2026); Atlas (hosted, cited transcript passages); Memfect (local atomic notes, product page only). None looked better than the kit above. **kgmd** is the one to read if you want a quick way for agents to see a graph of a folder of Markdown.

## What the complaints mean for you

- **Collecting without returning.** The reported cause is that capture feels easy and retrieval feels like homework. Answer: put "return" first, not last. A daily few, a "continue where I was" door, and an easy way to write from nuggets, so each visit produces something.
- **Maps nobody uses.** The full graph is called a poster. The useful versions are small and local: one nugget and its neighbours, filtered by topic or source, with a place to stand. Design the map as a way to *move*, not a picture.
- **AI summaries that flatten.** Reported errors cluster in names, numbers, dates and quotes. Keep the words exact and verified, label the distillation as a distillation, and keep your own response apart.
- **Rewriting by hand.** One writer argues knowledge only builds if you rewrite material in your own words. That supports keeping a place for your response beside each nugget, never mixed in.

## Recent conversation, with dates

Search tools gave few dated links. Dates are given where the page showed one. Several pages showed none.

- **11 July to 13 July 2026.** Logseq 2.0.1, first public beta of the database version, with data-loss warning. [Logseq changelog thread](https://discuss.logseq.com/t/logseq-db-changelog/30013/37)
- **28 August 2026.** kgmd 0.2.0 on PyPI. [kgmd](https://pypi.org/project/kgmd/)
- **8 October 2026.** GraphRAG 3.3.0 with an update command (one source). [Comparison](https://particula.tech/blog/lightrag-vs-graphrag)
- **22 October 2026.** Obsidian 1.15.0. [Changelog](https://obsidian.md/changelog/2026-10-22-desktop-v1.15.0/)
- **Undated, recent.** An Ask HN thread (233 points, 214 comments) asked whether people hoard notes and links without acting; commenters mention reading AI summaries instead of the originals. [Thread](https://hacker-news-web.pages.dev/item/46826277)
- **June 2026.** A post says a "4,000 Obsidian notes and no way to find anything" confession did well on Hacker News, and argues AI summaries filter at capture but knowledge needs rewriting. [Post](https://www.youngju.dev/blog/culture/2026-06-12-personal-knowledge-management-ai-notes.en)
- **2026.** "Your second brain is write-only." [Article](https://www.toolsforhumans.ai/blog/your-second-brain-is-write-only-heres-why-most-notes-never-get-revisited)
- **2026.** "Your Knowledge Graph Is Not Your Second Brain." [Essay](https://whybeforewhat.substack.com/p/your-knowledge-graph-is-not-your)
- **2026.** Obsidian forum: "You all say the graph is useless, let me show you how to use it" (filters, a weekly review). [Forum](https://forum.obsidian.md/t/you-all-say-the-graph-is-useless-let-me-show-you-how-to-use-it/116738)
- **2026.** "Obsidian's graph view is beautiful and almost completely useless." [Post](https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful)
- **April 2026.** Show HN: mcptube, Karpathy's LLM wiki idea applied to YouTube videos. [Listing](https://hnshowcase.com/post/47754559/mcptube-karpathy-s-llm-wiki-idea-applied-to-youtube-videos)
- **April 2026 onward.** Karpathy's LLM wiki gist and the many copies. [Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- **2026.** A Reddit thread reports NotebookLM inventing quotes from archives, and a Google forum thread about a February regression in grounding (both second-hand). [Snapshot](https://reddit.sentinel-team.org/posts/1ss53l5/snapshots/2026-04-24T21%3A34%3A43.485698Z)
- **February 2026.** Anki's stewardship announced as moving to AnkiHub (one blog post, **unconfirmed**).

I could not find dated Reddit posts from the last thirty days in the Obsidian, PKMS or LocalLLaMA communities, nor dated X posts. That part is thin and I do not want to pretend otherwise.

## How this was done

- Web search only, in standard mode, about twenty queries. No page was opened in full; I worked from search summaries, so licences and dates marked unconfirmed need a look at the project page.
- I did **not** add or run the last30days skill. I chose web search with recent-date queries from the start rather than test whether the skill runs without keys. If you want a proper thirty-day sweep of Reddit, X and Hacker News, that skill is the better tool and should be tried next.
- About twenty-five projects were looked at. Fourteen got entries above.

## Sources

- Fabric releases: [v1.4.387](https://newreleases.io/project/github/danielmiessler/Fabric/release/v1.4.387), [v1.4.393](https://newreleases.io/project/github/danielmiessler/Fabric/release/v1.4.393), [Fabric on Smithery](https://smithery.ai/skills/danielmiessler/fabric), [Fabric yt helper notes](https://git.blob42.xyz/Archives/fabric/src/commit/2d28b5b185829374659e48d6afd982c684863dc7/helpers/README.md)
- Karakeep: [repo listing](https://awesome.ecosyste.ms/projects/github.com%2Fkarakeep-app%2Fkarakeep), [review](https://www.promptquorum.com/power-local-llm/karakeep-review)
- Open Notebook: [repo](https://github.com/lfnovo/open-notebook), [review](https://dev.to/andrew-ooo/open-notebook-review-self-hosted-notebooklm-alternative-1210)
- SurfSense: [repo](https://github.com/MODSetter/SurfSense), [listing](https://awesome.ecosyste.ms/projects/github.com%2Fmodsetter%2Fsurfsense)
- Khoj: [repo](https://github.com/khoj-ai/khoj), [review](https://dev.to/jovan_chan_9500711396d4e6/khoj-review-2026-your-self-hosted-ai-second-brain-28mi)
- Graph builders: [Cognee benchmark (vendor)](https://www.cognee.ai/knowledge-graph-memory-benchmarks), [LightRAG vs GraphRAG](https://particula.tech/blog/lightrag-vs-graphrag), [Graphiti repo](https://github.com/getzep/graphiti), [Graphiti database setup](https://help.getzep.com/graphiti/configuration/graph-db-configuration), [Cognee migration guide](https://www.cognee.ai/migrating-from-graphiti)
- Maps: [Sigma.js](https://sigmajs.org), [library comparison](https://dmccreary.github.io/graph-algorithms/library-analysis), [tldraw licence](https://tldraw.dev/legal/tldraw-license)
- Notes and plugins: [Obsidian changelog 1.15.0](https://obsidian.md/changelog/2026-10-22-desktop-v1.15.0/), [Smart Connections](https://community.obsidian.md/plugins/smart-connections), [Logseq DB changelog](https://discuss.logseq.com/t/logseq-db-changelog/30013/37), [SiYuan agreement](https://b3log.org/siyuan/en/eula.html)
- Read-it-later: [Omnivore repo](https://github.com/omnivore-app/omnivore), [Readeck in Linux Magazine](https://www.linux-magazine.com/Issues/2026/306/Readeck)
- Learning: [awesome-fsrs](https://github.com/open-spaced-repetition/awesome-fsrs), [FSRS Obsidian plugin](https://community.obsidian.md/plugins/fsrs)
- Wiki pattern: [mcptube](https://pypi.org/project/mcptube/), [mcptube Show HN](https://hnshowcase.com/post/47754559/mcptube-karpathy-s-llm-wiki-idea-applied-to-youtube-videos), [Karpathy gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), [Karpathy LLM Wiki Stack](https://github.com/ScrapingArt/Karpathy-LLM-Wiki-Stack)
- Others: [CocoIndex podcast to graph](https://cocoindex.io/docs/examples/podcast-to-knowledge-graph/), [kgmd](https://pypi.org/project/kgmd/), [notewise](https://github.com/whoisjayd/notewise)
- Complaints: see links in the recent conversation section.
