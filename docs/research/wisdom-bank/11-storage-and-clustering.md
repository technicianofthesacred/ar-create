# Wisdom bank: where to keep it, and how it decides groupings

Researched 13 November 2026. Extends the earlier papers (prior-08, prior-02, prior-WISDOM-BANK); nothing from them is repeated except where a decision depends on it. Plain words throughout. "Unverified" marks anything I could not confirm from a source I read.

---

## 1. Recommendation up front

**Storage: one ordinary SQLite file, with link tables, plus word search and meaning search inside the same file. No graph database.**

- SQLite is a database that lives in a single file on your Mac. Node apps like AR Create already use it easily. Nothing to install or run as a server.
- Concepts, passages, works and your own notes are tables. A "link" is a row saying "concept A relates to concept B, because...". A "cluster membership" is a row saying "concept X sits in cluster Y, with this strength, confirmed by Adrian on this date". One concept in many clusters is simply many rows. Nested sub-clusters are rows saying "cluster Y sits under cluster Z"; a cluster may have more than one parent.
- Word search: SQLite's built-in FTS5 (full-text search: finds exact words and phrases, ranks by relevance).
- Meaning search: the sqlite-vec add-on (stores "embeddings", lists of numbers that capture what a passage means, and finds the nearest ones). Pre-1.0 and compares against everything rather than using a shortcut index (see section 2), which is fine at your size.
- Keep the embeddings as a rebuildable side table. If sqlite-vec ever disappoints, the fallback is LanceDB (section 2) for the meaning part only, with SQLite staying the source of truth.
- **Cloudflare later, as a mirror, not the home.** D1 (Cloudflare's hosted SQLite) has the same table shape and supports FTS5, so the same design copies up for phone access. Vectorize (Cloudflare's meaning-search service) could hold the embeddings. Both fit your size. Local first, because you curate and want the files yours.

**Why no graph database:** your connections are shallow ("this concept, its neighbours, their clusters") and each one carries a sentence of reason. That is a join between tables, not a deep path-finding problem. Graph databases earn their keep for many-hop queries over millions of links. Also, the most obvious embedded one (Kuzu) was shut down in 2025 (below).

**Classification: the AI proposes, a confirmed cluster is a permanent thing with its own ID and name, and the algorithm never reshuffles confirmed clusters.**

1. Each new concept is compared with the existing clusters and gets a short list of "also fits" suggestions with scores. That is multi-label (one concept, several clusters) by design.
2. Concepts that fit nothing well go to an "unplaced" pile.
3. Now and then a clustering tool (HDBSCAN or BERTopic, section 4) runs over the unplaced pile only, and an AI model proposes a name and sub-clusters for each group it finds. You accept, rename, merge or reject.
4. A second signal, community detection (Leiden) over the link graph, suggests "these concepts are densely connected; is that a cluster?" Same accept/reject.
5. Taxonomy design: a polyhierarchy (a tree where a node may have several parents, as in the SKOS standard) for themes, plus separate facets (independent axes like tradition, kind of source, practice or teaching) that filter across it.

---

## 2. Part A: storage options

Repo facts below come from the GitHub API on 13 Nov 2026 (stars and last activity are "pushed" dates).

### The graph databases

| Option | Plain words | Fit for 100k+ units, one person | Local? | Cost / licence | Maturity (verified facts) |
|---|---|---|---|---|---|
| **Kuzu** | An embedded graph database (a library, like SQLite, no server) | Technically fine, but see status | Yes | MIT, free | **Dead as an official project.** Repo archived 10 Oct 2025, last release v0.11.3. Apple agreed to buy the company on 9 Oct 2025; it only became public in Feb 2026. Do not start on it. |
| **LadybugDB** (Kuzu's community fork) | Kuzu revived by volunteers | Probably fine, young | Yes | MIT, free | Repo active (pushed 13 Nov 2026, v0.22.3 on 7 Nov 2026, about 1.9k stars). One source gave older version numbers, so versions vary by source. New and small team: a risk for a bank meant to last decades. |
| **Neo4j** | The best-known graph database, runs as a server | Fits easily | Yes (server process, needs Java) | Community edition GPL-3.0 (listed on GitHub); features like multiple databases are paid (general knowledge, unverified) | Most mature. Heavy for one person on a Mac, and a second system to keep running. |
| **FalkorDB** | Fast graph database, runs inside Redis-style server | Fits | Yes (server) | SSPL licence (a copyleft licence aimed at cloud resellers; fine for personal use, read terms if you ever offer it as a service) | Active, about 10.5k stars, pushed daily. |
| **Memgraph** | In-memory graph database, server | Fits if RAM allows | Yes (server) | Business Source Licence (not open source in the strict sense). I could not confirm terms for personal use: verify. | Active, about 4.7k stars. |
| **SurrealDB** | One database that stores documents, graph links and vectors, server or embedded | Fits | Yes | Business Source Licence; company states free for production use except reselling it as a service; each release becomes Apache-2.0 after four years | Active, about 33k stars. All-in-one is attractive, but it is its own query language and ecosystem, a bigger bet than SQLite. |

Sources: [Kuzu repo](https://github.com/kuzudb/kuzu), [Kuzu archived: pin, fork or migrate](https://oneuptime.com/blog/post/2026-08-12-kuzu-archived-pin-0-11-3-fork-or-migrate/markdown), [Apple deal (BetaKit)](https://betakit.com/apple-strikes-deal-to-acquire-canadian-database-software-startup-kuzu/), [LadybugDB repo](https://github.com/LadybugDB/ladybug), [FalkorDB licence](https://docs.falkordb.com/license.html), [SurrealDB licence](https://surrealdb.com/license.md), [Neo4j repo](https://github.com/neo4j/neo4j), [Memgraph repo](https://github.com/memgraph/memgraph).

Prior research already warned that Graphiti and Cognee need a graph database; none of those tools is needed if you do not adopt them.

### The meaning-search (vector) options

| Option | Plain words | Fit | Local? | Cost / licence | Maturity |
|---|---|---|---|---|---|
| **sqlite-vec** | Add-on that gives SQLite meaning search | Good up to a few hundred thousand, then slower: it checks every vector (brute force) so time grows in a straight line. Reports: about 25 ms per query at 1M vectors of 384 numbers (one blog), 3 GB for 1M at 768 numbers. Blog figures, not controlled tests. | Yes, inside the file | Apache-2.0, free | Pre-1.0: v0.1.9 (31 Mar 2026), alpha tags and commits as late as 18 May 2026, about 8.3k stars. Sole-maintainer feel. Usable, but expect rough edges. |
| **LanceDB** | An embedded library storing vectors in a folder of files, with word search (BM25) and a hybrid mode that merges both | Built for far more than you need; vendor demo shows full-text search over 41M Wikipedia docs | Yes, in Node, no server | Apache-2.0, free | Very active: v0.41.0 on 29 Oct 2026, about 11.9k stars. Node version requirement unclear (20 vs 22: check). Keeps a second store beside your tables. |
| **Chroma** | Easy vector store, embedded or server | Fits | Yes | Apache-2.0 | Active, about 29.7k stars. Fine, but adds nothing over the two above for your shape. |
| **Qdrant** | Dedicated vector server in Rust | Overkill for one person, excellent at scale | Yes (server) | Apache-2.0 | Active, about 35.5k stars. |
| **pgvector** | Meaning search inside Postgres | Fits; needs Postgres running | Yes (server) | Postgres-style licence | Active, about 23.7k stars. Only sensible if you move the whole bank to Postgres. |
| **Cloudflare Vectorize** | Cloudflare's hosted meaning search | Each index holds up to 20,000,000 vectors of up to 1,536 numbers; topK (results returned per query) only 50 with metadata. | No (cloud only; local emulation not checked) | Free tier 5M stored dimensions, paid first 10M stored and 50M queried dimensions per month included, then small rates. Cloudflare's own example: 250k vectors of 768 numbers and 500k queries a month is about $5.86. | Production service. |

Sources: [sqlite-vec](https://github.com/asg017/sqlite-vec), [state of vector search in SQLite](https://marcobambini.substack.com/p/the-state-of-vector-search-in-sqlite), [LanceDB hybrid search](https://lancedb.com/docs/search/hybrid-search), [LanceDB full-text at 41M docs](https://www.lancedb.com/blog/feature-full-text-search), [Vectorize limits](https://developers.cloudflare.com/vectorize/platform/limits/), [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/). Chroma, Qdrant and pgvector facts are repo stats only; I did not read their docs (unverified beyond that).

Rough size sums (my arithmetic, not from a source): 300,000 units at 768 numbers each, stored as 4-byte decimals, is about 0.9 GB. That fits on any Mac and in one file. Hundreds of thousands of units is within sqlite-vec's comfortable range; millions is where you would switch the meaning part to LanceDB.

### Hybrid word+meaning in one file, and plain SQLite

- Several hobby projects do exactly this (FTS5 for words, sqlite-vec for meaning, merged by rank). One reports 23 ms over about 50,000 passages (from the earlier research). I found no measured test at 100,000+ documents: **verify with your own data early**, it is a one-day test.
- LanceDB does hybrid search natively and is the cleaner alternative if you prefer one tool.

### Cloudflare D1 + Vectorize

- **D1** (hosted SQLite): paid plan, 10 GB per database (free: 500 MB), 1 TB per account, rows up to 2 MB, 30-second query cap, 100 bound parameters per query, 100 columns per table, Time Travel (restore to a past moment) for 30 days. FTS5 is supported. Source: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/). Recursive queries (needed to walk "cluster under cluster under cluster") were not confirmed on D1 (unverified; SQLite itself supports them).
- 10 GB is plenty for text of hundreds of thousands of units; the embeddings, not the text, would be the bulk, and those can live in Vectorize.
- Your own earlier notes (memory): Workers die at 10 ms CPU per request on the free plan, so any heavy work (clustering, re-ranking) must happen on the Mac or a job, not in a Worker. Curation edits are tiny and fit.

### Shape I recommend (plain)

| Table | Holds |
|---|---|
| works | the talk, book, article, with source and link to the full original |
| passages | exact quotes with where they came from (before and after context kept, per the W3C way noted earlier) |
| concepts | one per idea, with its three depths of text |
| concept_passage | which passages support which concept |
| concept_link | A relates to B, kind of relation, a sentence of reason, who proposed (AI or Adrian), state (proposed / confirmed / rejected) |
| clusters | a named grouping with a permanent ID; kind (theme or facet); human name; state |
| cluster_parent | cluster Y sits under cluster Z (many parents allowed; the app refuses loops) |
| concept_cluster | concept X is in cluster Y, strength 0 to 1, state, confirmed-by-Adrian date |
| embeddings (+ FTS5 index) | meaning vectors and word index, rebuildable |
| proposals | everything the AI suggested that Adrian has not yet decided, with its reasoning |

Rejected suggestions are kept (state "rejected"), so the AI does not offer the same thing again.

---

## 3. Part B: how AI-era systems decide groupings

### Methods, and whether they allow "one concept in several clusters" and "nested sub-clusters"

| Method | Plain words | Several clusters per item? | Nested? | Verdict for you |
|---|---|---|---|---|
| **BERTopic** | Turns texts into meaning vectors, groups them (HDBSCAN), names each group from its typical words | Normally one topic per item. `approximate_distribution` gives a mix per item but the docs say it is an approximation, less accurate than the normal assignment | Yes: `hierarchical_topics` builds a merge tree; `reduce_topics` merges topics | Good as a finder of *candidate* groups. Not the owner of your structure. |
| **HDBSCAN** (the grouping step inside BERTopic) | Finds dense groups, leaves odd points unassigned | Yes, softly: `all_points_membership_vectors()` gives each point a probability for each cluster; `membership_vector()` does it for new points. Needs `prediction_data=True`; docs call soft clustering "somewhat experimental" | One condensed tree, not a curated hierarchy | Useful for the "unplaced pile" step. |
| **Leiden** (community detection) | Splits a graph of links into densely connected communities | No: one community per node at each level | Yes: levels from fine to coarse (Microsoft's GraphRAG uses it this way, writing a report per community) | Good second opinion on the link graph. Randomised, so results can shift when the graph changes. |
| **Overlapping community detection** (SLPA, OSLOM, COPRA, BigCLAM, clique percolation) | Same idea as Leiden but nodes may belong to several communities | Yes | Mostly flat | 2013 survey (14 methods): SLPA and OSLOM do best when overlap is low; real networks usually overlap in under 30% of nodes, each in 2 or 3 communities. Research code, not a Node library. Low priority; it is a lot of machinery for something the AI-plus-you step does directly. |
| **LLM-built taxonomies** (TnT-LLM, TaxoAdapt, SCYCHIC, others) | A language model reads samples, writes category names and definitions, then refines them in rounds; can be re-run inside each category for sub-levels | Yes, if you ask for multi-label | Yes | **The best match.** TnT-LLM (Microsoft, KDD 2024) generates and refines a taxonomy, then uses the model to label a sample and trains a cheap classifier for the rest. TaxoAdapt (ACL 2025) grows a taxonomy wider and deeper as new papers arrive. An Amazon human-in-the-loop system (CHIIR 2026) lets the AI map new documents to nodes and experts approve before the taxonomy changes. |
| **SKOS** (W3C vocabulary standard) | A standard way to store "this concept is broader than that one" | Yes: nothing stops a concept having several broader concepts | Yes | Use as the *model*, not a product. Rule: no loops. Separate "concept schemes" or "collections" act as facets. |
| **Faceted classification** | Independent axes (tradition, kind of source, theme) instead of one tree | Yes, by design | Within each axis | Use: stops the tree from trying to hold everything. Your examples (neuroscience, Buddhist teaching, practices, YouTube talks) are really facets that cross the themes. |

Sources: [BERTopic distribution](https://maartengr.github.io/BERTopic/getting_started/distribution/distribution.html), [BERTopic repo](https://github.com/MaartenGr/BERTopic), [HDBSCAN soft clustering](https://hdbscan.readthedocs.io/en/latest/soft_clustering.html), [Leiden in igraph](https://r.igraph.org/reference/cluster_leiden.html), [GraphRAG community detection](https://www.mintlify.com/microsoft/graphrag/concepts/community-detection), [overlapping community comparison (Xie et al.)](https://www.arxiv.org/pdf/1110.5813), [TnT-LLM paper](https://arxiv.org/pdf/2403.12173v1.pdf), [TnT-LLM at Microsoft](https://www.microsoft.com/en-us/research/publication/tnt-llm-text-mining-at-scale-with-large-language-models/), [TaxoAdapt](https://www.arxiv.org/abs/2506.10737), [SCYCHIC](https://arxiv.org/pdf/2504.13834v4), [context-aware taxonomy generation](https://arxiv.org/pdf/2509.19125.pdf), [Amazon interactive taxonomy development](https://assets.amazon.science/26/6c/53d55e3942559b1f82dda74bde90/scipub-approval152129-42392229-interactive-taxonomy-development-with-hybrid-methods.pdf), [SKOS reference](https://www.w3.org/TR/2009/PR-skos-reference-20090615/skos.html), [SKOS polyhierarchy and collections (ARDC guide)](https://documentation.ardc.edu.au/rva/browse-visualisation-guide-for-publishers), [SKOS design choices](https://arxiv.org/pdf/1302.1224).

### Which methods allow both overlap and nesting

Only two things do both properly: (a) an LLM asked to place each concept in as many fitting nodes as it deserves, inside a taxonomy it can grow, and (b) a SKOS-style polyhierarchy that you store yourself. The statistical tools (BERTopic, Leiden) give you either nesting or approximate overlap, not a curated version of both. So the clustering tools suggest, and the structure you keep is the SKOS-style one.

### Keeping clusters steady when new material arrives

What the sources show:
- Topic models are known to give different results from different random starts, in both topic wording and which topic each document lands in. [Evaluating stability](https://par.nsf.gov/servlets/purl/10464095) and [Holistic evaluations](https://arxiv.org/pdf/2507.23364).
- BERTopic's default clustering cannot learn incrementally. The documented workaround is to train a second model on the new material and **merge** it into the base model: topics that are similar enough (a threshold you set, `min_similarity`) are treated as the same, the rest become new topics. I could not confirm from the sources whether the hierarchy and mixed assignments survive a merge. [Merge guide mirror](https://huggingface.co/kisejin/TopicModelingRepo/blob/main/BERTopic/docs/getting_started/merge/merge.md).
- A 2026 preprint on lifelong topic modelling measures stability with ARI (a score of how much two groupings agree) and drift as how far a cluster's centre moves. [CobwebTM](https://arxiv.org/pdf/2604.14489). A 2025 evaluation gave BERTopic about 52% on a transition measure for month-by-month updates (not a pure stability figure). [Dynamic topic modelling evaluation](https://arxiv.org/pdf/2508.00710).
- I found no paper that measures taxonomy drift when LLM-built taxonomies grow. TaxoAdapt lists inaccuracy on new or very specific concepts as a limit.

What that means for the design (my reasoning, not a sourced finding):
1. **Assign, don't re-cluster.** New concepts are placed into existing confirmed clusters. Re-clustering the whole bank each time is exactly what makes groupings jump.
2. **A confirmed cluster is a name and an ID chosen by you, not a computed object.** Its centre point can be recalculated from its members, but members never leave without your say.
3. **Re-clustering is a periodic proposal, shown as a difference**: "12 concepts would move; 3 new clusters; 2 clusters could merge". Accept item by item. Use a fixed random seed so repeated runs are comparable.
4. Keep confidence and "proposed / confirmed / rejected" on every membership and link. Unconfirmed items show lighter in the interface; confirmed ones are the bank.
5. Every cluster description is regenerated only when its membership changes and you approve it (GraphRAG's per-community reports show the cost: smaller communities mean many more reports).

### Human-in-the-loop, as practised

- Amazon's system (CHIIR 2026): the model summarises documents and proposes mappings to existing nodes; experts review before anything changes. Same shape as yours.
- The merge-proposal pattern of sift-kg (pending / approved / declined, with reasoning and confidence) was already noted in prior-08; it fits the "proposals" table above.
- Risk the earlier research already flagged: over-merging and invented quotes. Keep quotes verified by exact-text check; let the AI propose merges but never apply them.

---

## 4. What to do first (smallest useful steps)

1. Load about 50,000 test passages into SQLite with FTS5 and sqlite-vec; time the searches. This settles the "verify at 100k" gap in one day. If slow, move only the vectors to LanceDB.
2. Build the tables above with proposed / confirmed / rejected states from day one; retrofitting that is painful.
3. Write the "also fits" step (LLM plus embedding score, multi-label) and the "unplaced pile" before any clustering tool.
4. Try BERTopic or HDBSCAN soft membership over only the unplaced pile, once there is enough material to look at.
5. Leave Leiden and overlapping-community methods until you have a few thousand confirmed links.

## 5. Not verified / watch

- Vector tool facts for Chroma, Qdrant, pgvector come from repo stats only.
- Memgraph personal-use terms; Neo4j edition limits (general knowledge).
- LadybugDB's long-term backing and exact current version (sources disagree on version numbers).
- LanceDB Node version requirement (20 vs 22).
- D1 support for recursive queries; Vectorize local emulation.
- BERTopic hierarchy and mixed assignments after a merge.
- All performance figures for sqlite-vec are from blogs, not controlled tests.
- Fuzzy c-means and other classical soft clustering were not researched here.
