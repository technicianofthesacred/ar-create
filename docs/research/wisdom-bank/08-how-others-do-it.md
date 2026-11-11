# Wisdom bank: how others have built this

Research thread, 11 November 2026. Written for Adrian to read on a phone.

**How this was done, and the limit on it.** I ran about twenty-six web searches across the eight problems. I could not open the pages themselves: the sandbox blocks every outside site except the search tool, and two attempts to read pages directly (one myself, one through a page reading helper) both failed. So every claim below comes from what a search result said about a page, not from reading the page, and I mark that wherever it matters. Nothing here is from memory. Where a search turned up nothing, I say so. The surest way to deepen this report is to allow the sites named in "What I could not verify" at the end and re-read the key pages.

---

**Added later the same day.** Adrian, as passed on by the home thread, 11 November 2026: "Yeah, not just all of this, but also the way that people connect these hive minds or knowledge graphs together. Especially with AI, a lot of people are trying to do this sort of thing. I have not been sold on your UI design yet. So I'm more looking at copying something out there and iterating it or making it better." That added a ninth question (how people connect knowledge graphs and "hive minds", and AI built on top of them) and moved the most useful part of this report to the interface shortlist at the top of the phone page. I could not get screenshots or videos, because the sandbox blocks outside sites. Each candidate below has an address you can open and try on your phone.

---

## One page for your phone

### Real interfaces you could copy and improve, strongest first

None of these matches your words on its own. Together they cover the parts, and the first is where I would start.

1. **WorkFlowy (copy this first).** Tap any item and it becomes the whole page, with a trail of where you are at the top. Open and close items in place, at any depth, with no new pages. The text is plain and reads well on a phone. It is the nearest thing to your "expand and contract in place" and "mind map" words. *Falls short:* it is a strict tree, one parent per item, which is exactly the "categories and subcategories" shape you rejected. Its own blog says expanding everything can lock it up, and a user in the comments reported slow loading at about 30,000 items. No figure found for hundreds of thousands. Closed source, so you would copy the behaviour, not the code. Alive. Try it: [workflowy.com](https://workflowy.com/learn/bullets). [How zoom works](https://workflowy.com/help/bullets.md), [the lock-up warning](https://blog.workflowy.com/why-we-disabled-expand-all-by-double-clicking-on-the-page-title-and-logo/).

2. **Apple's Embedding Atlas (copy this for the far view and the filters).** A whole collection as one map you zoom and pan in the browser, smooth up to millions of points. Names for regions appear by themselves as you zoom, and you can search and filter by any field, which is your "subjects as filters over one whole". *Falls short:* it shows points, not readable text, so there is nothing to read at three depths, and the connections are only closeness. Open source under the MIT licence, which means you can build on it. Alive (released 2025). Try it: [demo and docs](https://apple.github.io/embedding-atlas/). [Paper](https://arxiv.org/html/2505.06386v1), [news write-up](https://www.infoq.com/news/2025/11/embedding-atlas).

3. **TheBrain (copy this for connections that are plain and many-to-many).** One thing sits in the middle, its more general things above, its more specific things below, and its related things at the side. An item can have several parents, so nothing is trapped in one category. *Falls short:* it shows one neighbourhood at a time, not an infinite surface, and it is closed software. One reviewer notes the layout has barely changed in five years. Two open source projects copy the layout: K-Plex and Synapses for Obsidian. Alive. Try it: [TheBrain 12](https://thebrain.com/thebrain12), [the web version works without installing](https://thebrain.com/blog/enabling-ubiquitous-non-linear-visual-knowledge), [how relationships work](https://help.thebrain.com/androidphone/thoughtrelationships.html), [K-Plex](https://github.com/zsviczian/kplex/wiki).

4. **Sefaria (copy this for reading at depth and plain connections).** You read one text and open a side panel listing what connects to this passage, as plain rows: commentaries, parallels, topics. Topic pages list their sources in ranked order, and people build their own sheets from the passages. *Falls short:* it has no zoomable surface and no depths of one idea written for a newcomer. Open data and a public interface for builders. Alive. Try it: [sefaria.org](https://designing-knowledge.siggraph.org/wp/?p=126). [Developer pages](https://developers.sefaria.org/docs/powered-by-sefaria).

5. **Watch list, small and unproven: Nodus and the Obsidian Semantic Map Canvas plugin.** Both show title-only cards when zoomed out and full notes when zoomed in, which is the shape of what you describe. Each is one person's project, and I found no evidence of use at scale. [Nodus](https://sorenwacker.github.io/nodus/features), [Semantic Map Canvas](https://www.obsidianstats.com/plugins/semantic-map-canvas).

**My recommendation.** Copy WorkFlowy's way of moving first: tap to zoom into anything, a trail at the top, open and close in place. It is simple, proven on phones and readable. Then fix its one flaw by letting an item live in several places, as TheBrain does, and show connections as plain labelled rows beside the text, as Sefaria does. Put Embedding Atlas's kind of map at the far end of the zoom, with names appearing as you move in, and subjects as filters on it. That is a combination, not one product, and I have not seen anyone join the near-text view and the far map into one continuous zoom. That join is the thing worth testing first.

### The eight things most worth learning


1. **The idea is more than a century old, and it was built by hand at huge cost.** Mortimer Adler's Syntopicon gathered 102 "great ideas" and about 3,000 sub-topics across the Great Books, with a staff of up to 72 people. It was budgeted at two years and took eight, and one account puts the labour at over 400,000 hours. Even Adler called the list of 102 "arbitrary", and the work faded. Nave's Topical Bible did the same for scripture: over 20,000 topics and more than 100,000 references, compiled over about fourteen years, and organised by subject rather than by word, so one verse sits under many headings. What you can take: the shape is proven and loved. What was missing was cheap labour and a way to grow without a fixed list. [Syntopicon](https://en.wikipedia.org/wiki/A_Syntopicon), [Nave's](https://en.wikipedia.org/wiki/Nave%27s_Topical_Bible).

2. **Sefaria is the closest living system to your bank, and it is open.** It is a free library of Jewish texts with about 17,700 topics, roughly 20,000 links between topics, a ranked list of source passages under each topic, and "source sheets" where people build their own teaching from the texts. It is run as open data with a public interface for other builders. This is a concept page that holds exact passages from many works plus a person's own arrangement, working at real size. [Sefaria](https://designing-knowledge.siggraph.org/wp/?p=126), [developer pages](https://developers.sefaria.org/docs/powered-by-sefaria).

3. **Two grades of "the same" is how a scholarly project handles cross-tradition matching.** SuttaCentral lists parallel teachings across Buddhist traditions and marks each as a "full parallel" (likely a common source) or a "partial parallel" (clearly incomplete agreement). Full parallels may be chained (if A matches B and B matches C, A matches C); partial ones may not. Its own notes admit some collections are checked thoroughly and others less so. What you can take: do not make one yes or no for "same concept". Use at least two grades, and never chain the weak one. [SuttaCentral method](https://dhammatalks.net/suttacentral/sc2016/sc/methodology.html), [how parallels are stored](https://github.com/suttacentral/suttacentral/wiki/Parallels-information).

4. **A merge tool already exists that works the way you want: the AI proposes, you confirm.** An open source tool called sift-kg removes obvious duplicates with plain rules first, then asks a language model about what is left, in overlapping batches so duplicates are not missed at the edges. Each proposal carries a suggested name, the model's reasoning and a confidence score, and sits as pending, approved or declined. It also files "this extends that" (deep learning and machine learning) as a separate relation instead of merging them. This is a small, real template for your "proposed, you say yes". It is one project's documentation, not a standard. [sift-kg](https://www.mintlify.com/juanceresa/sift-kg/concepts/entity-resolution).

5. **Exact quotes can be guaranteed, but only by code, not by asking the model nicely.** The working method in several projects: the model returns a quote, then ordinary code checks that the quote appears word for word in the source text (after tidying spaces and punctuation). If it does not, it is rejected. Models do invent quotes that read well, and a practitioner's report says a trailing "..." was the giveaway. One limit: a real quote can still be attached to a claim it does not support, so the check proves the words exist, not that the concept is right. [Verification approach](https://benwhalley.github.io/soak/explanation/quote-verification-approach.html), [a model caught inventing evidence](https://dev.to/hannune/how-i-caught-my-llm-fabricating-its-own-evidence-1i8d).

6. **There is a standard way to point at a passage that survives edits.** The web's annotation standard stores a quote as the exact words plus a little text just before and after. That makes it findable even if the page changes, and it copes with the same words appearing twice. Your passages could be kept the same way, as well as by position. [W3C selectors in practice](https://anchorpoint.readthedocs.io/en/stable/api/selectors.html).

7. **Layered depth has been built several times, mostly as prototypes, and the common trick is to write each depth once and store it.** Perlin and Fox's 1993 "Pad" zoomed from a title to an abstract to an outline to full text. Recent versions use a language model: Rambler (zoomable gists of dictated text), Qlarify (tap a phrase in a paper's abstract to expand it) and TreeReader (every section as expandable key points, with a way to check each against the source). One developer stores each zoom level as its own file. The honest limit: I found demos and papers, and no study showing readers learn better. And none of them write the depths as teaching in plain spoken words, which is what you asked for. [Overview of these](https://www.arj.no/2025/12/27/stretchtext-llm/), [Rambler](https://www.arxiv.org/pdf/2401.10838), [TreeReader](https://arxiv.org/pdf/2507.18945v1.pdf).

8. **At very large size, the thing that works is drawing only what is near, and the thing that fails is a page full of separate elements.** Nomic's map tool draws tens of millions of points in a browser by storing them in a tile-like tree and sending only what is in view. A developer reports that canvases built from ordinary page elements start to lag around 1,000 items, while a graphics based one reached 60,000 cards before slowing. Heptabase's own help page tells users to split big whiteboards into smaller ones because of lag. What you can take: build the zoomable surface as tiles from the start. [Nomic Atlas](https://docs.nomic.ai/atlas/how-atlas-works/key_terms), [Deepscatter](https://www.github.com/nomic-ai/deepscatter), [60,000 cards](https://thebiggish.pages.dev/news/developer-pushes-pixi-js-infinite-canvas-to-60-000-cards-before-performance-breaks), [Heptabase lag](https://support.heptabase.com/en/articles/11430704-troubleshooting-performance-and-lag-issues-in-heptabase).

### What could be reused or built on instead of started from scratch

- **The merge proposal flow of sift-kg** (pending, approved, declined; reasoning and confidence on each; "extends" kept apart from "same"). Reuse the pattern for certain. Check its licence before using any code.
- **The quote check**: a few lines of ordinary code. Build it once and every distilling run uses it.
- **The W3C way of storing a quote** (exact words, a little before, a little after). A free standard.
- **Karpathy's "LLM wiki" layout** from April 2026: sources never edited, pages kept by an agent, an index, a log, and a periodic health check. Earlier threads already covered the idea. New here: it has since spread into many projects that ingest books and talks (WikiNow reads epub books and transcribes audio with Whisper, llmwiki records where each source came from, WikiLoom commits every change to git). All young and personal, so borrow the layout, not the code. [Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), [WikiNow](https://github.com/LangModule/wikinow), [WikiLoom](https://pypi.org/project/wikiloom), [llmwiki](https://pypi.org/project/llmwiki/0.7.9/).
- **Search in one local database file**: several projects combine word search and meaning search in a single SQLite file, with one reporting 23 millisecond searches over about 50,000 passages. Nothing I found measured 100,000 documents. [Example](https://blakecrosley.com/blog/hybrid-retriever-obsidian).
- **Sefaria and SuttaCentral as living references** you can study and, for their open texts and data, build on. Check each licence.

### What nobody seems to have solved

- **Judging "the same concept" across traditions with a person confirming it, at the scale of thousands.** SuttaCentral does it with scholars over years. The tools that automate it are built for company data (names, products), not for ideas.
- **Teaching text at three depths, written for a person, kept true to the passages.** The zoom prototypes shorten text. None write a plain sentence, then three paragraphs, then a full reading with misunderstandings and practices.
- **One zoomable surface that is both huge and structured, and stays where you left it.** Tools show millions of points, but as a scatter map. The layout research covers keeping things in place as a graph changes, but I found nothing about keeping a map of ideas stable as new works join.
- **Your own voice fused into the source material and kept visibly yours,** as part of the learning. The nearest are Sefaria's source sheets and the Agora's one topic with many contributors, neither with a tracked sense of what you understand.
- **From a line of concepts to an outline for a piece, with every quote credited.** Earlier threads found no product. I found none either.

---

# The detail, by problem

## 1. Distilling a real work into concepts

**What exists (all from search results, no page opened).**
- *SpineDigest*, an open source command line tool: takes a book (epub, Markdown or plain text), groups passages by meaning using a classical algorithm rather than a model, then has one model write a summary while others critique it against the source. It builds a graph of how concepts relate across the book. [Description](https://dev.to/cookcoco/i-built-an-open-source-tool-to-distill-books-into-knowledge-graphs-fbo).
- A research framework for turning e-books into concept maps: split into sections, extract concepts per section, find relations, merge into one map. Tested with GPT-4o on Python course material only. [Framework](https://scrapbox.io/nishio-en/A%20Framework%20for%20Constructing%20Concept%20Maps%20from%20E-Books%20Using%20Large%20Language%20Models:%20Challenges%20and%20Future%20Directions).
- A dissertation reporting that **working one section at a time gave the best results across ten subject areas, and the humanities did worse than the others.** This is the most useful single finding here for you: it says where to cut a work (sections, not the whole book and not single sentences), and that your kind of material is the harder kind. [Emory dissertation](https://etd.library.emory.edu/downloads/q524jq28m?locale=en).
- BibiGPT (videos to a personal graph) and the LLM-wiki projects above. These are product or hobby write-ups with no measured quality. [BibiGPT](https://bibigpt.co/blog/posts/build-knowledge-graph-from-videos-bibigpt-method-2026).

**Human methods.** Progressive summarization (Tiago Forte) layers highlights over highlights in a single note. Critics say the name misleads (Nick Milo calls it "just in time" summarising), and that it was designed for one person facing too much information, not for a shared or growing body. [Critique](https://medium.com/@nickmilo22/why-progressive-summarization-must-die-c2635d1f79f1), [Commons note](https://commons-os.github.io/patterns/progressive-summarization/). Long-term users' accounts say simpler capture often won: a plain collection of what sparked them, tags, and treating every note as unfinished. [A decade of Zettelkasten](https://goryugo.com/en/zettelkasten), [Why one writer left Zettelkasten](https://knowledgework.substack.com/p/why-i-ditched-zettelkasten-for-a), [Two years with Papers](https://dev.to/kevinten10/the-brutal-truth-about-building-your-personal-knowledge-base-what-two-years-with-papers-taught-me-4nf). All anecdote.

**The Syntopicon as a method.** Staff read the Great Books and logged where each of the 102 ideas appeared, with about 3,000 sub-topics beneath them. Sources disagree on the corpus (431 or 443 works) and on the exact topic count (2,987 or about 3,000). I did not find the exact reference format or how the 102 were chosen. [Overview](https://en.wikipedia.org/wiki/A_Syntopicon), [The Conversation on 102 ideas](https://theconversation.com/encyclopedia-britannica-once-published-a-catalogue-of-humanitys-102-great-ideas-and-it-created-more-questions-than-answers-220606). Nave's did topic-first compilation, and also kept "instances of" under a topic. [Nave's](https://www.swordsearcher.com/bible-study-library/naves-topical-bible.html).

**What this means for you.** No system found does the whole job (every concept in a work, each with its exact passages, in words a person would say aloud). The pieces exist separately: section-by-section reading, a critique step, a code check for quotes. The human-written ancestors prove people value it. **Where it fails:** humanities text scored worse, models invent quotes, and summaries flatten. The one trial that matters, one real work Adrian knows well, has still not been done.

## 2. Judging "the same concept" across works and traditions

- **sift-kg** (above): plain rules first, then a model in overlapping batches of 100 with 20 repeated, proposals saved as pending, approved or declined, "extends" kept apart from "same". [Docs](https://www.mintlify.com/juanceresa/sift-kg/concepts/entity-resolution), [workflow](https://mintlify.com/juanceresa/sift-kg/guides/resolution-workflow).
- A 2026 demo (LLM-CER) offers a person-checks-each-group mode for company-style record matching. [Paper](https://www.vldb.org/pvldb/vol19/p4746-ke.pdf).
- **SuttaCentral**: full versus partial parallels, kept in a plain JSON file, attached sometimes to a single verse or paragraph, with weaker coverage flagged openly. BuddhaNexus finds matches automatically by repeated wording of at least 30 characters, which finds borrowed phrasing but not the same idea in different words. [Parallels wiki](https://github.com/suttacentral/suttacentral/wiki/Parallels-information), [BuddhaNexus](https://buddhanexus2.kc-tbts.uni-hamburg.de/db/pli).
- **The Agora**: a topic name is the concept, and many people's notes sit beneath it. The project says one name resolving to many contributions is "not only fine, but considered desirable". I found no description of how conflicts are settled. [Agora](https://github.com/flancian/agora), [The Agora is a social knowledge graph](https://1.anagora.org/The%20Agora%20is%20a%20Social%20Knowledge%20Graph).
- **Argdown and Kialo**: claims as shared pieces that many arguments reuse. Argdown is plain text, so the same claim can be reused across documents. I found no feature comparing authors on one claim. [Argdown](https://argdown.org/), [Kialo](https://Www.Wikipedia.org/wiki/Kialo).

**Take:** three grades are better than two: same, close (one extends or partly overlaps the other), and related. Matching by wording finds quotes of quotes, not the same teaching said differently, so meaning-based matching proposes and a person decides. The gap: all of these assume entities with names. Ideas such as "everything is perfect" and "nothing to attain" have no shared name, and nothing I found tests that.

## 3. Layered depth of one idea

- **Stretchtext** (the idea): stay in one document and expand or collapse inline, instead of opening another page. Simple summaries, popups and accordions give only two layers. [Essay](https://www.arj.no/2025/12/27/stretchtext-llm/).
- **Perlin and Fox (1993):** title, abstract, outline, full text as you zoom. A patent notes this needs levels written ahead of time. [Patent](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7650562).
- **Rambler** zooms through gists of dictated speech. **Qlarify** expands a selected phrase recursively. **TreeReader** shows each section as expandable key points and lets you check a summary against the source. [Rambler](https://www.arxiv.org/pdf/2401.10838), [Qlarify](https://notes.andymatuschak.org/zYDaEHgMh5jBEwnvSF8bE2q), [TreeReader](https://arxiv.org/pdf/2507.18945v1.pdf).
- **Summaries Tree** (Nieman Lab) and a developer's **zoomable document** that stores each level as its own file. [Nieman](https://niemanlab.org/?p=234075), [Zoomable document](https://longform.social/post/did:plc:mracrip6qu3vw46nbewg44sm/3mhnqy4jndj2k).

**Take:** keep each depth as written text, stored, not squeezed on the fly: his rule that length is set by understanding, not card size, means a depth cannot be a trimmed version of the one below. Keep a link from each depth to the passages beneath it, as TreeReader does. **Fails:** the research is prototypes with small tests, and the layers are summaries. His small view says what the teaching *is* in one plain sentence, which is a different job.

## 4. One zoomable surface at very large size

- **Nomic Atlas and Deepscatter:** WebGL drawing, data in a tile-like tree stored in Arrow files, labels for regions made automatically. Hosted by Nomic, with the drawing library open on GitHub (I did not confirm its licence). [Key terms](https://docs.nomic.ai/atlas/how-atlas-works/key_terms), [blog](https://home.nomic.ai/blog/posts/why-are-web-browsers-the-best-data-browsers).
- **Embedding Atlas (2025) and WizMap:** academic and open tools for exploring millions of points. [Paper](https://arxiv.org/html/2505.06386v1), [WizMap](https://arxiv.org/html/2306.09328v1).
- **Cosmograph:** a graphics card drawn graph, claimed to reach about a million nodes. The licence is unclear: the main library says it is closed source, and the engine shows MIT in one listing and a non-commercial licence in another. Check before relying on it. [Concept](https://cosmograph.app/docs-general/concept/), [README](https://cdn.jsdelivr.net/npm/@cosmograph/cosmograph@2.3.2/README.md).
- **Heptabase and Kinopio:** reviews say Heptabase stays smooth with thousands of cards, while its own help page says lag comes from many elements on one whiteboard and advises splitting. A Kinopio user asked for more space. [Heptabase review](https://aiindigo.com/blog/heptabase-review-2026-the-visual-knowledge-base-for-deep-thinkers), [forum](https://forum.kinopio.club/t/larger-infinite-canvas/1180).
- **The original zoomable interfaces (Pad++, Jazz):** semantic zoom (more detail as you zoom in) and the need for a steady high frame rate as the space grows. I did not retrieve the retrospectives on why they faded, so I cannot say. [Pad++ experience](https://www.umiacs.umd.edu/node/12174), [Jazz](https://www.lri.fr/~mbl/Teach/SituatedComputing/2017/papers/ZUI/jazz-uist00-bederson.pdf).
- **Staying stable so people learn where things are:** graph drawing research agrees on three tricks: anchor most of the layout and let only a few things move, place new items gently near their neighbours, and compute a first layout before the person explores so a revisited area looks the same each time. Stable treemaps (rectangles that keep their place as data changes) exist. The search did not cover what happens when embedding-based maps change as points are added. [Foresighted layout](https://diglib.eg.org/items/81db96dd-1ebc-4b7d-8a5c-ba927921f5ff/full), [incremental layout](https://vis.cs.ucdavis.edu/papers/tarik_incremental.pdf), [EvoCells](https://www.scitepress.org/Papers/2018/66171/66171.pdf).

**Take:** (a) tile and draw only what is in view; (b) give each concept a fixed home from a structure that is decided once, because force-directed layouts that wander are the very thing that produces the "hairball" and the subway map; (c) when a new work arrives, place its concepts beside their nearest neighbours and leave the rest alone. **What people keep using versus abandon:** I found tools being used today (Atlas, Cosmograph, Heptabase) but no retention data, so "kept" versus "abandoned" is not established. **Open:** none of these maps are structured text you read at every depth, they are scatter views.

## 5. Showing connections plainly

Reports from Obsidian users agree: the full graph becomes a hairball; past roughly 200 notes the physics layout stops helping; people use the local view (one note and its neighbours); and the graph helps most when it answers a question or you filter it. Alternatives that appear: a radial view centred on one note, hubs of concepts instead of dense cross-links, link types (parent, child, sibling) that give structure, and numbers instead of pictures at large size. Most sources are forum posts and blogs, some promotional. [Forum thread](https://forum.obsidian.md/t/whats-the-point-of-the-graph-view-how-are-you-using-it/71316), [Graph is beautiful and almost useless](https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful), [Advanced Graph View for 5,000 to 50,000 notes](https://www.obsidianstats.com/plugins/graph-insight), [radial view](https://community.obsidian.md/plugins/mapa-neuronal), [concept hubs](https://dev.to/whoffagents/my-obsidian-vault-was-a-pile-of-disconnected-islands-ten-concept-hubs-turned-it-into-a-brain-3db5).

Sefaria shows another way: a connection is a plain row on the passage ("this text comments on that one"), a topic page lists its sources in ranked order, and links between topics are listed, not drawn. [Sefaria](https://designing-knowledge.siggraph.org/wp/?p=126). Combined with your correction on straight, labelled lines, the evidence points to listed, labelled rows near the thing, with a drawn picture only locally.

## 6. Finding by meaning, and subject as a lens

The common recipe is word search and meaning search together in one database file, merged by a simple fusion step, with the model rerank last and optional. One guide reports 16,894 files cut into 49,746 pieces, 23 millisecond searches and an 83 megabyte file, with light embedding models; heavier rerankers add a few hundred megabytes of downloads. Advice repeated: start with word search, add meaning search when it misses, add fusion last. No source measured 100,000 documents. Subject as a filter over one whole is just a tag or field applied as a lens; I found no tool that treats it as a separate topic of study, and Sefaria's topic pages are the nearest. [QMD](https://mintlify.com/tobi/qmd/architecture/overview), [Obsidian hybrid search](https://mcpservers.org/servers/flowing-abyss/obsidian-hybrid-search), [guide](https://blakecrosley.com/guides/obsidian).

## 7. Learning and making from it

I found little new here beyond the earlier threads. Confirmed again: progressive summarization is aimed at one person's notes; Sefaria's source sheets let people compose from texts and have been used to make over 100,000 sheets; the Agora lets one topic carry many people's words. **Not found:** a tool that tracks understanding across concepts, and a tool that turns an ordered line of concepts into an outline with every quote credited. Spaced repetition (earlier threads: Readwise review, FSRS) remains the established way to make ideas return. I could not get the steps of syntopical reading from Adler; the search did not return them.

## 8. Storage: what comparable systems keep, in plain terms

| System | What it keeps | Where | Note |
|---|---|---|---|
| Wikidata / Wikibase | Items, properties, then *statements* with qualifiers (extra context), references (where it came from) and a rank | Database, exported as JSON | Its primer says it is "not about the truth, but about statements and their references". [Primer](https://www.mediawiki.org/wiki/Wikibase/DataModel/Primer) |
| SuttaCentral | Root texts split into numbered segments; parallels as a separate JSON file; translations in a git repository | Files in git | [Bilara data](https://github.com/suttacentral/bilara-data) |
| The Agora | Concept (a node, found by name) and contributions (subnodes) from many people | Plain files from many sites | "Nodes are concepts, subnodes are utterances". [Agora](https://anagora.org/subnode/garden/flancian/GEMINI.md) |
| Sefaria | Texts, links between passages, topics with ranked sources, sheets | Hosted database with open data | [Sefaria](https://developers.sefaria.org/docs/powered-by-sefaria) |
| LLM wiki projects | Untouched sources, agent-written pages, an index, a log | Plain Markdown files, often in git | [Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) |
| W3C annotation | The exact words plus text before and after, pointing at a source | Standard JSON | [Selectors](https://anchorpoint.readthedocs.io/en/stable/api/selectors.html) |

In plain terms, every system that works keeps five things apart: the **work**, the **exact passage with where it came from**, the **concept**, the **link between things with its reason**, and the **person's own words**. Wikidata's lesson is that the *reference* belongs to each statement, so you can always ask "who said that and where". Sefaria's and the Agora's lesson is that your own contribution sits beside the sources, not mixed into them, which matches your rule that his voice stays visibly his.

---

## 9. How people connect knowledge graphs and "hive minds", and AI on top of them

All from search results, mostly blogs and early write-ups. I found no widely adopted standard and no independent test of any of these.

**Joining separate people's banks.**
- **Shared Brain model (May 2026, COTRUGLI Business School).** Each person keeps a private base and contributes one subject to a group wiki. A step run by an administrator merges the contributions, flags claims that conflict, and records who contributed what. The authors describe what broke and what they fixed, and say the core claim is still unproven. [Article](https://talirezun.substack.com/p/the-shared-brain-when-second-brains), [follow-up](https://talirezun.substack.com/p/second-brain-to-shared-brain-building).
- **A permissioned team layer (MindStudio).** People's agents stay separate and reach a shared base through a small server offering search, fetching a document, and an "expert finder" to locate who knows a topic. It relies on access rules, not a merged graph. [Article](https://www.mindstudio.ai/blog/ai-second-brain-team-knowledge-base/).
- **Federated memory (a preprint) and networking second brains over the Fediverse (a forum proposal).** Both are design ideas, not working systems. Their stated aim is to keep each person's authorship and control, which the preprint contrasts with one central graph. [Forum post](https://socialhub.activitypub.rocks/t/creating-social-knowledge-graphs-by-networking-second-brains-via-the-fediverse/2489).
- **The Agora** (above) is the one that runs today: each person keeps their own notes and shares them, and one concept name gathers everyone's contribution beneath it. [Agora](https://github.com/flancian/agora).
- One article mentions a Google "Open Knowledge Format" for sharing structured notes between agents. I saw only that one article, so I cannot confirm it exists as described. [Article](https://www.stork.ai/blog/your-ai-brain-is-a-mess-heres-the-fix).

**What this says.** Every approach that holds up keeps each person's words apart and attributed, and joins them by a shared concept name or by a reviewed merge, never by blending text. That matches your rule that words are never mixed, and it bears on your open question about friends' ideas and consent. Nothing here handles two people meaning the same thing by different words, which is problem 2 again.

**AI on top of a graph.**
- **What the evidence supports:** graph-based retrieval helps on questions that need several steps, such as linking facts across documents. One post reports 71.2 percent against 65.8 percent for ordinary retrieval on one benchmark, with the gap growing as more steps are needed. Graphs also suit an assistant's memory where facts get corrected, because each fact can carry a date and a newer fact can replace an older one (this is what Graphiti is described as doing). [Production write-up](https://tianpan.co/blog/2026-04-09-graphrag-production-when-vector-search-hits-ceiling), [agent memory](https://tianpan.co/blog/2026-04-10-graph-memory-llm-agents-relational-reasoning).
- **What looks like hype:** building the graph is slow and costly (one summary says 40 to 57 times slower to index and about three and a half times the text sent per question), a graph nobody maintains becomes a liability, and several practitioners say a simple file-based memory is enough for personal use. One writer describes uninstalling a graph database from a personal assistant for this reason. Three 2026 benchmark papers are said to show mixed results, but I could not check them. I found nothing I could rely on about Zep, Mem0 or cognee specifically. [Buyer's guide](https://medium.com/@tongbing00/graphrag-in-2026-what-to-use-when-to-use-it-and-what-to-watch-out-for-a1fa1c283023), [The GraphRAG trap](https://gading-d6fkgjxcn-gading-nasutions-projects.vercel.app/blog/the-graphrag-trap).
- **AI that builds the graph itself:** this is what the 2026 "LLM wiki" projects and sift-kg do, and the careful ones keep a person approving merges. The failures reported are the same ones as before: invented quotes, over-merging, and an index that drifts.

**For the bank:** AI helping you find and connect is worth having. Letting it quietly rewrite the structure is the part to avoid. Joining other people's banks can wait, and should be by named concept with each contribution attributed.

---

# Whole systems close to the idea

| System | What it is | Alive? | Lesson |
|---|---|---|---|
| Syntopicon (1952) | 102 ideas, ~3,000 topics, hand built | Dormant | Right shape, wrong cost, fixed list called arbitrary |
| Nave's Topical Bible (1896) | 20,000+ topics, 100,000+ references | Still sold and online | Topic-first, same verse under many headings |
| Sefaria | Open Jewish text library with topics and sheets | Alive | Best living model of concept pages with sources |
| SuttaCentral | Parallels across Buddhist canons | Alive | Full versus partial "same", flagged confidence |
| The Agora | Topic nodes merging many people's notes | Alive, small | One name, many contributions |
| LLM wiki family (2026) | Agent-kept wiki from raw sources | New, many hobby projects | Layout is proven, quality at scale is not |
| Roam Research | Linked notes | Alive but diminished | Early growth overloaded its servers and some users lost data (2020); slow development; users drifted away. Dan Shipper's essay "The Fall of Roam" is the first hand account, which I could not read. [Every](https://every.to/superorganizers/the-fall-of-roam), [2020 posts](https://francescod.medium.com/roam-to-pause-new-sign-ups-7169fbc342a3) |
| Mem | AI organised notes | Alive, relaunched as Mem 2.0 in October 2025 | Reviews call it polarising; its sorting pays off only if you capture constantly. I found no shutdown. [AlternativeTo](https://alternativeto.net/news/2025/10/mem-2-0-relaunches-with-smarter-note-taking-tools-offline-support-and-a-new-agentic-chat) |

I did not find a shut down system closely matching the bank. The failures I did find are the hand-built ones that faded, and the tools that lost people through reliability and over-structuring. Thoughtful long-term accounts are in the section on problem 1.

---

# What I could not verify

- **No page was opened.** All claims come from search summaries. The sandbox allows only the search tool. To go deeper, the sites to allow are: arxiv.org, github.com, gist.github.com, en.wikipedia.org, forum.obsidian.md, every.to, mediawiki.org, mintlify.com and developers.sefaria.org. The first pages I would read: Karpathy's gist, the TreeReader and Rambler papers, sift-kg's workflow page, SuttaCentral's methodology, "The Fall of Roam".
- **No screenshots or videos** of the interface candidates could be retrieved. The sandbox blocks outside sites, so the shortlist rests on written descriptions, and the addresses are for you to try.
- **Licences** of sift-kg, Deepscatter, Cosmograph, WikiNow and Sefaria's code were not confirmed.
- **Why the original zoomable interfaces faded**, how embedding maps behave as points are added, Mem's finances, how Syntopicon references were laid out, Adler's syntopical reading steps, and Readwise's resurfacing quality were all searched or touched and not answered.
- **Quality of language model distilling on humanities text** is known only from one dissertation's comparison. Nobody has measured it for your kind of material.
- One search result carried text addressed to a model, asking it to write a recipe. It was ignored and has no bearing on the findings.

# What to do next

1. Do the trial nobody has done: one real work Adrian knows, distilled section by section, quotes checked by code, three depths in plain words, on the lighter model.
2. Build the merge proposal flow on top of that trial's output and see how often "the same concept" is right.
3. Read the primary pages listed above once the sites are allowed, and correct this report where a summary misled.
