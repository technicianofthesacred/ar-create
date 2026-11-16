# Wisdom bank: open-source projects and 2025-2026 pipelines (ingest, concepts, links, clusters, depth)

Written 13 November 2026. Extends prior-02 and prior-08; it does not repeat their verdicts on Fabric, mcptube, sift-kg's merge flow, Open Notebook, SurfSense, Khoj, Karakeep, Sigma, FSRS, Quartz.

**How verified.** Stars, last-push dates and licences come from the GitHub API on 13 Nov 2026 (marked GH). Feature descriptions come from web-search summaries of docs, READMEs and papers; I did not read the code. Anything marked (unverified) is from one secondary page or memory. "Stars" are a popularity guess, not quality.

**Plain-word glossary.** *Chunk* = a slice of text a few paragraphs long. *Embedding* = a list of numbers that captures meaning, so similar passages sit close. *Knowledge graph* = a map of named things (nodes) joined by labelled links (edges). *Community detection / Leiden* = an automatic way to find tightly connected groups in a graph. *Hard vs soft (overlapping) clusters* = hard means each item lives in exactly one group; soft means it can live in several, which is what you want.

---

## The headline finding

Nothing I found does your whole chain. The pieces exist in separate tools, and they differ on exactly the points you care about:

- **Exact quotes kept:** almost no project keeps verbatim quotes as a first-class thing. The graph tools keep a link from each extracted fact back to the *chunk of source text* it came from (good enough to show the quote beside it), but none checks that a quote really appears in the source. You add that check yourself (prior-08 already describes it).
- **Several depths of the same idea:** only two families do this at all, and both do it for *retrieval*, not for *reading*: RAPTOR (a tree of summaries) and GraphRAG-style community reports. Neither writes "one sentence / three paragraphs / full reading" for a single concept.
- **One concept in several clusters:** the popular graph tools (GraphRAG, Neo4j builder, txtai) use hard clusters. One idea sits in one group per level. Overlap is a gap everywhere.
- **Human confirms:** only LightRAG (merge dialog), sift-kg (approve/decline merges) and BERTopic (you can merge topics by hand in code) come close. Everyone else is "AI decides".

---

## The 5 most useful for this bank

### 1. RAPTOR (parthsarthi03/raptor): the depth idea, as a method
- **Plain words.** Cut documents into chunks, group similar chunks, have an AI write a summary of each group, then group *those summaries* and summarise again, up to a single top summary. You end with a tree: leaves are the original passages, higher levels are more general. Search can land on any level. ICLR 2024 paper.
- **Facts.** Stars 1,780; last commit **3 Sep 2024** (stale, though it is a reference implementation); MIT. GH.
- **Exact quotes?** Leaves are the original text, so yes at the bottom level, nothing checks it above.
- **Multi-level summaries?** Yes, that is the whole point (levels = depths). Grouping uses soft clustering in the paper (a passage can join more than one group; I recall this from the paper, not re-checked). The README says the tree can be saved and reloaded.
- **Several clusters per item?** Paper says yes (soft), code behaviour unverified.
- **Human confirm?** No.
- **Reuse?** Reuse the *idea* and the soft-clustering step, not the repo (unmaintained, Python, OpenAI default). RAGFlow (below) ships RAPTOR as a switch, which is the maintained route. For you the twist: your "depths" are per concept and written as teaching, so you would apply RAPTOR's recursion to *concepts* rather than raw chunks.
- Sources: https://github.com/parthsarthi03/raptor , https://arxiv.org/pdf/2401.18059v1.pdf

### 2. LightRAG (HKUDS/LightRAG): the most usable graph-builder, with a human merge dialog
- **Plain words.** Reads documents, has an AI pull out named things and relations, stores a map, answers questions by walking it. Has a web screen.
- **Facts.** Stars 40,678; last push 12 Nov 2026; MIT. GH.
- **Exact quotes?** It stores which chunk IDs and file paths each entity and relation came from (up to a configurable cap, default 300 per entity; display of file paths capped at 100). So provenance = chunk-level, not verbatim-quote-level. Release notes say these lists can grow into the thousands (a known wart).
- **Multi-level summaries?** Not in the "depths" sense. It has dual-level retrieval (specific facts vs broad themes) but no stored summary tree.
- **Several clusters?** No cluster concept at all.
- **Human confirm?** **Yes, the best of the group**: web UI to edit an entity and a merge dialog that picks source and target and carries relationships over (PR #2266). Also selective deletion of a document, rebuilding only affected entities from a cache (README).
- **Cost note.** Prior-02 quotes about 2-3x the source text in tokens (secondary source).
- **Reuse?** Good as a *proposal engine* for "these concepts across works look linked": run it, read its entity list, import what you accept. Don't make it the home of your data; your concepts need your own schema.
- Sources: https://github.com/HKUDS/LightRAG , https://github.colasdn.workers.dev/HKUDS/LightRAG/pull/2266 , https://newreleases.io/project/github/HKUDS/LightRAG/release/v1.4.9.4 , https://neo4j.com/blog/developer/under-the-covers-with-lightrag/

### 3. Microsoft GraphRAG: the cluster-then-write-reports pattern
- **Plain words.** Builds the map, runs Leiden (a grouping algorithm) repeatedly to get groups of groups, then an AI writes a *report* for every group at every level (title, summary, key findings, importance score 1-10), bottom-up so higher reports reuse lower ones.
- **Facts.** Stars 36,639; last push 9 Nov 2026; MIT. GH. Reported 3.3.0 on 8 Oct 2026 added incremental updates (one secondary source, unverified).
- **Exact quotes?** Keeps text units linked to entities (memory, unverified here).
- **Multi-level summaries?** **Yes: this is the closest shipped thing to your "cluster with sub-clusters, each with a written summary".** Hierarchy depth is set by a max group size (default 10).
- **Several clusters?** **No.** Hierarchical Leiden gives nested, non-overlapping groups: each concept in one group per level. A 2026 paper argues k-core nesting is better than Leiden for knowledge graphs; also not overlapping.
- **Human confirm?** No. Expensive to index (prior-02: 5-10x text).
- **Reuse?** Copy the *report format* (title, summary, findings, importance) for your cluster pages. Don't adopt the engine: its groups are exclusive, you want overlap.
- Sources: https://www.mintlify.com/microsoft/graphrag/concepts/community-detection , https://github.com/microsoft/graphrag

### 4. Graphiti (getzep/graphiti): best provenance and "never overwrite" memory
- **Plain words.** Feeds in "episodes" (a transcript, a message, a chunk), extracts facts, and keeps every fact tied to the episodes that produced it. When something new contradicts an old fact, the old one is closed with an end date, not deleted.
- **Facts.** Stars 32,785; last push 11 Nov 2026; Apache-2.0. GH. Needs a graph database (Neo4j default; FalkorDB, Kuzu, Neptune per prior-02).
- **Exact quotes?** The raw episode text is stored as a node and every derived edge lists its episodes: the best "click a claim, see the raw source" model among open tools. Still no verbatim-quote check.
- **Multi-level summaries?** Entity summaries only. **Several clusters?** No cluster feature. **Human confirm?** No UI.
- **Reuse?** Copy the *data model*: raw source stays untouched; every concept points to every episode (talk section) that mentions it; changes are recorded, not overwritten. That matches "AI proposes, he confirms" and "link back to the original". The engine itself needs a graph DB: I would not run it.
- Sources: https://github.com/getzep/graphiti , https://zby.github.io/commonplace/agent-memory-systems/reviews/graphiti/ , https://mintlify.com/getzep/graphiti/concepts/nodes-and-edges

### 5. BERTopic (MaartenGr/BERTopic): the only mature tool for clusters you can steer, and the one that can do overlap
- **Plain words.** Embeds your passages, groups them, and has an AI name each group. Gives you a topic tree (hierarchical topics), lets you merge topics by hand, supports "zero-shot" (you supply topic names; it also finds new ones), and can merge two models over time so new material can reveal new topics.
- **Facts.** Stars 7,955; last push 5 Nov 2026; MIT. GH.
- **Exact quotes?** Works on whatever passages you feed it, so quotes stay as long as you feed them in as units. **Multi-level summaries?** Topic labels and hierarchy, not written depths. **Several clusters?** It can output a probability per topic for each document, so an item can belong to several (soft). Default is one topic per item; soft is an option (my recollection of the docs, not re-verified). **Human confirm?** Merge/reduce topics by code; a 2025 preprint adds LLM-assisted merging (not an official feature).
- **Reuse?** Strong fit for the *clustering step across hundreds of thousands of units*: runs on embeddings, needs no graph database, cheap compared with GraphRAG. Feed it concept one-liners (not raw chunks), keep top-N topic memberships per concept, show them to Adrian as proposals.
- Sources: https://github.com/MaartenGr/BERTopic , https://arxiv.org/pdf/2509.19365 , https://newsletter.maartengrootendorst.com/p/bertopic-what-is-so-special-about

---

## The rest

### Ingestion-to-graph platforms
- **Cognee** (topoteretes/cognee): 33,287 stars; pushed 13 Nov 2026; Apache-2.0 (GH). Steps: add files, "cognify" (AI extracts entities and relations, builds the map), then search mixing meaning and graph. Newer API renames this to remember/recall/forget/improve. Has OWL ontology support and can run on one Postgres database (secondary sources). A third-party YouTube-to-Cognee example exists (Sensible-Analytics/video_analysis, whisper + Cognee + Ollama; unverified quality). No depths, no overlap, no human screen. Verdict: leave; same job as LightRAG with heavier plumbing.
- **Neo4j LLM Knowledge Graph Builder** (Neo4j-labs/llm-graph-builder): 5,308 stars; pushed 1 Nov 2026; Apache-2.0 (GH). A web app: upload PDFs/YouTube/web pages, it builds a graph, and with Neo4j's data-science add-on runs Leiden grouping plus AI summaries of each group, with a stored chain document → chunk → entity and parent/child communities (vendor blog from early 2025, may have changed). Includes YouTube as a source type (from the Neo4j blogs on YouTube transcripts; unverified for the current version). Hard clusters. Needs Neo4j. Verdict: useful to *watch* as a demo of the chain, not to adopt.
- **KAG** (OpenSPG/KAG): 9,170 stars; last push **28 Jan 2026**; Apache-2.0 (GH). Chinese-led framework (Ant Group) that links graph and source chunks both ways and answers questions with logical steps. Aimed at expert-domain Q&A with a fixed schema. No depths, no overlap, no review screen found. Verdict: leave.
- **HippoRAG / HippoRAG 2** (OSU-NLP-Group/HippoRAG): 4,118 stars; pushed 6 Oct 2026; MIT (GH). A research method modelled on how memory links work: build a graph of extracted facts, then use PageRank (importance flowing along links) from the query's nodes to find related passages. Strength: finds multi-step connections across passages (a "link across works" signal). No summaries, clusters, or UI. Verdict: borrow the idea for *suggesting links between concepts*; a research code base.
- **nano-graphrag** (gusye1234/nano-graphrag): 4,005 stars; last push 27 Jan 2026; MIT (GH). A tiny (~1,100 lines per its own pitch, unverified) readable rewrite of GraphRAG, same hard hierarchical clusters and community reports. Verdict: the right thing to *read* if you want to understand GraphRAG's cluster-and-report step in an afternoon.
- **RAGFlow** (infiniflow/ragflow): 94,098 stars; pushed 13 Nov 2026; Apache-2.0 (GH). A whole document-chat product. Notably has RAPTOR as a built-in switch after parsing, plus a GraphRAG option with custom entity types, and a "Tree" template that builds hierarchical summaries (RAGFlow docs). Verdict: the maintained place to see RAPTOR in a real UI; too big to embed.
- **LlamaIndex PropertyGraphIndex** (run-llama/llama_index): 52,884 stars; pushed 11 Nov 2026; MIT (GH). A toolkit, not an app. Offers three extractors (free-form, loosely guided by your types, strict schema), and extracted facts carry a source ID back to the text chunk. Custom extractors possible. Verdict: only if you want to build your own pipeline in Python; you are on Node, so unlikely.
- **txtai** (neuml/txtai): 13,362 stars; pushed 12 Nov 2026; Apache-2.0 (GH). One library for search, a "semantic graph" and topic modelling by Louvain community detection (hard groups) over an embeddings index. Verdict: a light way to get clusters without an AI bill; hard groups only.
- **R2R** (SciPhi-AI/R2R): 8,089 stars; last push **7 Nov 2025** (stale, a year ago); MIT (GH). Retrieval service with graph extraction. Verdict: skip.
- **CocoIndex** (cocoindex-io/cocoindex): 11,889 stars; pushed 12 Nov 2026; Apache-2.0 (GH). Its podcast-to-graph example (YouTube, speaker-split transcript, two-step AI extraction, matching same-named people/concepts by meaning, stored in SurrealDB) is the most complete *YouTube talk to knowledge graph* recipe I found. It is an incremental pipeline engine: only reprocesses what changed, which matters at your scale. Verdict: read the example; the engine is a candidate for the "must scale" requirement but Python/Rust.

### Memory layers (built for AI agents, not for reading)
- **Mem0** (mem0ai/mem0): 68,896 stars; pushed 6 Nov 2026; Apache-2.0 (GH). Stores short facts pulled from chat. Open-source v3 reportedly dropped its graph and is add-only; graph is platform-only. A review calls its memories "easy to retrieve, hard to review as a claim". Verdict: wrong shape. The review's framing is useful, though: such extracted facts are *candidates*, not truth, which is your "AI proposes".
- **Hindsight** (vectorize-io/hindsight): 60,740 stars (GH; a mirror showed 0 and another listing ~1,055, so treat popularity as unreliable); pushed 13 Nov 2026; MIT. Agent memory with retain / recall / reflect and "mental models": user-curated summaries that update as memories grow. Postgres + pgvector. The "mental models" idea (a living summary the human curates) rhymes with your concept pages. Verdict: read, don't adopt.
- **Letta** (25,428 stars, pushed 18 Oct 2026, Apache-2.0, GH) and **MemOS** (12,377, pushed 11 Nov 2026, Apache-2.0, GH): agent memory systems; skip.

### Personal-knowledge and wiki-style tools
- **Basic Memory** (basicmachines-co/basic-memory): 4,562 stars; pushed 13 Nov 2026; **AGPL-3.0** (GH). Local AI memory as plain Markdown notes with links, readable in Obsidian; the AI reads and writes the notes. Closest to Karpathy's wiki pattern in a maintained product. AGPL means network-served changes must be shared. Verdict: study its note format; don't embed.
- **InfraNodus** (infranodus.com; MCP server repo infranodus/mcp-server-infranodus, 105 stars, pushed 11 Nov 2026, MIT per GH; the company says its underlying tools are AGPL, so check). The product is a hosted service: turns text into a word network, finds topical clusters and the *gaps between clusters*, and suggests ideas from those gaps. The open part is only a connector; the engine is paid and closed (as far as I could tell). Its clusters are built by modularity (hard groups). Verdict: the gap idea is the thing to copy ("which two clusters never touch yet?"), shown as a suggestion.
- **sift-kg** (juanceresa/sift-kg): 807 stars; pushed 12 May 2026; MIT (GH). Prior-08 covered the approve/decline merge flow. Added here: stores evidence, source documents, confidence and support counts per link; a dedicated verbatim-quote field is **not confirmed**. Small and young: good template to copy the review screen from.
- **mcptube**: 166 stars; last push 13 Apr 2026; GitHub shows **no licence** file (PyPI listings say MIT, so verify before copying). Covered in prior-02.
- **ytk** (pablomoli/ytk): 1 star, pushed today, MIT (GH). YouTube to plain-Markdown notes in a second-brain layout, local search and embeddings, AI enrichment through Anthropic's API. Brand new and tiny: a pattern, not a base.
- **notewise**: 10 stars; licence not stated (GH). Study notes per video; skip.
- **RAG_Techniques** (NirDiamant): 30,332 stars; licence "NOASSERTION" (unclear; GH). A cookbook of tutorials including RAPTOR and graph variants; useful for reading, not copying code.
- **Fabric** (danielmiessler/Fabric): now 44,616 stars; pushed 13 Nov 2026; MIT (GH). Covered in prior-02. One detail: extract_wisdom output sections are ideas, insights, quotes, habits, facts (+ recommendations in older versions); counts and rules differ by version, so read the current text file before copying. It is one pass per talk: no cross-talk links, no cluster, no depths. https://git.blob42.xyz/Archives/fabric/src/commit/b8cf16f69c6b9da06a5c4225af259ea268719a8f/patterns/extract_wisdom/system.md
- **Open Notebook**: now 41,915 stars; pushed 12 Nov 2026; MIT (GH). Prior-02 verdict stands. Facts added: Python/FastAPI back end, Next.js front end, SurrealDB, 18+ model providers, podcasts, REST API (secondary). Its "transformations" (reusable prompts run over a source) are the nearest thing to your multi-depth summaries, but I could not confirm the mechanics.
- **Khoj**: 38,121 stars; last push **2 Aug 2026** (cooling); AGPL-3.0 (GH). **SurfSense**: 16,859; pushed 12 Nov 2026; Apache-2.0 (GH). Verdicts unchanged.

### Karpathy-style "LLM wiki"
Already covered in prior-02/08. New: the pattern has no clustering step of its own; its only structure is an index page, a log and a "lint" health check. It is a good *storage* shape (untouched sources + agent-kept pages), but at hundreds of thousands of units a folder of Markdown pages with an index page stops being searchable by an agent reading it; you will need an embedding index beside it.

---

## Table (all verified numbers are GH, 13 Nov 2026)

| Project | Stars | Last push | Licence | Exact source kept | Multi-level summaries | One idea in many clusters | Human confirm | Reuse for bank |
|---|---|---|---|---|---|---|---|---|
| RAPTOR | 1,780 | Sep 2024 | MIT | leaves only | Yes (tree) | soft in paper (unverified in code) | No | Borrow idea |
| LightRAG | 40,678 | 12 Nov 2026 | MIT | chunk-level link | No | No clusters | Yes (merge/edit UI) | Proposal engine |
| MS GraphRAG | 36,639 | 9 Nov 2026 | MIT | text units (unverified) | Yes (reports) | No (nested, exclusive) | No | Copy report format |
| Graphiti | 32,785 | 11 Nov 2026 | Apache-2.0 | Yes (episode to edge) | entity summaries | No | No | Copy data model |
| BERTopic | 7,955 | 5 Nov 2026 | MIT | as fed in | labels + tree | optional soft | by code | Clustering step |
| Cognee | 33,287 | 13 Nov 2026 | Apache-2.0 | not confirmed | No | No | No | Leave |
| Neo4j builder | 5,308 | 1 Nov 2026 | Apache-2.0 | chain doc-chunk-entity | Yes (Leiden + summaries) | No | No | Watch |
| KAG | 9,170 | 28 Jan 2026 | Apache-2.0 | graph-chunk mutual index | No | No | not found | Leave |
| HippoRAG | 4,118 | 6 Oct 2026 | MIT | passages | No | No | No | Link-suggest idea |
| nano-graphrag | 4,005 | 27 Jan 2026 | MIT | as GraphRAG | Yes | No | No | Read to learn |
| RAGFlow | 94,098 | 13 Nov 2026 | Apache-2.0 | chunks | Yes (RAPTOR/Tree) | not found | UI chunk edit (unverified) | See RAPTOR in UI |
| LlamaIndex PG | 52,884 | 11 Nov 2026 | MIT | source ID per fact | No | No | No | Python toolkit |
| txtai | 13,362 | 12 Nov 2026 | Apache-2.0 | n/a | No | hard (Louvain) | No | Cheap clusters |
| R2R | 8,089 | Nov 2025 | MIT | chunks | No | No | No | Skip |
| CocoIndex | 11,889 | 12 Nov 2026 | Apache-2.0 | transcript spans (unverified) | No | No | No | Read the YouTube example |
| Mem0 | 68,896 | 6 Nov 2026 | Apache-2.0 | short facts | No | No | No | Skip |
| Hindsight | 60,740 | 13 Nov 2026 | MIT | not confirmed | mental models | not found | curated models | Read |
| Basic Memory | 4,562 | 13 Nov 2026 | AGPL-3.0 | notes | No | links | you edit notes | Study format |
| Fabric | 44,616 | 13 Nov 2026 | MIT | quotes by prompt, unchecked | No | No | No | Prompts |
| sift-kg | 807 | 12 May 2026 | MIT | evidence (quote unconfirmed) | No | No | Yes (approve/decline) | Copy review screen |
| InfraNodus MCP | 105 | 11 Nov 2026 | MIT (check) | n/a | No | hard | No | Copy gap idea |

---

## What nobody does yet (the part you would build)

1. **Concepts, not chunks, as the unit that gets summarised at three depths.** RAPTOR and GraphRAG summarise *groups of text*. No project writes, for one named concept, a one-sentence / three-paragraph / full version, each pointing at the exact quotes and source moments. Closest: RAPTOR's levels and Hindsight's "mental models".
2. **Overlapping clusters with sub-clusters.** Every cluster-then-summarise pipeline found (GraphRAG, Neo4j builder, txtai, InfraNodus) gives each item one group per level. Soft membership exists only as a BERTopic option and in the RAPTOR paper, with no tool joining that to written cluster summaries. Overlapping community detection exists as research code (e.g. LazyFox, C++), not wired to an AI.
3. **A verified quote.** Every tool trusts the AI's quote or only keeps the chunk it came from. A plain text-match check on every quote is yours to write.
4. **AI proposes, you confirm, across the whole chain.** Confirmation exists for merging names (LightRAG, sift-kg), never for "this concept belongs in these clusters", "these two concepts across works are linked" or "this summary is faithful".
5. **Mixing very different source types** (neuroscience paper, Buddhist teaching, practice, talk) in one bank with the source type as a visible property. The graph tools treat all text alike.
6. **Reading a concept from several works side by side** (agree / extend / contradict). Graphiti handles contradiction in time, not between authors.
7. **Scale proof.** Reported indexing costs (GraphRAG 5-10x, LightRAG 2-3x the text) are for thousands of documents. I found nobody showing 100,000+ units with human curation; the cheaper route is embeddings plus BERTopic-style clustering, with the AI used only to name and write.

## Suggested assembly (what to reuse)

- Storage and provenance shape: **Graphiti's model** (raw source untouched, every concept lists its source passages, changes recorded not overwritten).
- Distilling: **Fabric's prompts** + your exact-text check.
- Depths: **RAPTOR's recursion**, applied to concepts, written once and stored.
- Clustering: **BERTopic-style soft assignment** over concept embeddings; clusters named by AI; summary format from **GraphRAG's community reports**.
- Review screen: copy **sift-kg's** pending/approved/declined and **LightRAG's** merge dialog.
- Suggestions of links and gaps: **HippoRAG's** link-following and **InfraNodus's** "gap between clusters", both as proposals.

## Not verified
- Star counts for nothing marked GH. Code behaviour of RAPTOR soft clustering, BERTopic soft membership, RAGFlow's human chunk editing, CocoIndex span links. Cognee, Neo4j builder and KAG feature descriptions are from vendor/third-party pages. mcptube licence. InfraNodus engine licence. The first gh call batch had timeouts, so a few repos were fetched on retry; all numbers listed came from a successful call.

## Sources
- https://github.com/parthsarthi03/raptor , https://arxiv.org/pdf/2401.18059v1.pdf
- https://github.com/HKUDS/LightRAG , https://github.colasdn.workers.dev/HKUDS/LightRAG/pull/2266 , https://newreleases.io/project/github/HKUDS/LightRAG/release/v1.4.9.4
- https://github.com/microsoft/graphrag , https://www.mintlify.com/microsoft/graphrag/concepts/community-detection , https://arxiv.org/pdf/2603.05207
- https://github.com/getzep/graphiti , https://zby.github.io/commonplace/agent-memory-systems/reviews/graphiti/
- https://github.com/MaartenGr/BERTopic , https://arxiv.org/pdf/2509.19365
- https://github.com/topoteretes/cognee , https://dev.to/om_shree_0709/cognee-building-the-next-generation-of-memory-for-ai-agents-oss-3jm1
- https://github.com/Neo4j-labs/llm-graph-builder , https://neo4j.com/blog/developer/knowledge-graph-builder-first/
- https://github.com/OpenSPG/KAG , https://arxiv.org/pdf/2409.13731v2
- https://github.com/OSU-NLP-Group/HippoRAG , https://proceedings.mlr.press/v267/gutierrez25a.html
- https://github.com/infiniflow/ragflow , https://ragflow.io/docs/dev/enable_raptor , https://ragflow.io/docs/knowledge_compilation/built_in_templates_and_dedicated_configuration
- https://developers.llamaindex.ai/python/framework/module_guides/indexing/lpg_index_guide/
- https://github.com/neuml/txtai , https://dev.to/neuml/introducing-the-semantic-graph-1j09
- https://cocoindex.io/docs/examples/podcast-to-knowledge-graph/
- https://github.com/mem0ai/mem0 , https://zby.github.io/commonplace/agent-memory-systems/reviews/mem0/
- https://github.com/vectorize-io/hindsight , https://arxiv.org/html/2512.12818v1
- https://github.com/basicmachines-co/basic-memory
- https://infranodus.com/mcp/tools , https://glama.ai/mcp/servers/infranodus/mcp-server-infranodus
- https://github.com/juanceresa/sift-kg , https://zby.github.io/commonplace/agent-memory-systems/reviews/sift-kg/
- https://github.com/pablomoli/ytk , https://github.com/0xchamin/mcptube
- https://github.com/danielmiessler/Fabric , https://github.com/lfnovo/open-notebook
- LazyFox (overlapping communities): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10280410/
