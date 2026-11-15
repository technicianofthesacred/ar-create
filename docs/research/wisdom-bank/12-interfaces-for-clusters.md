# Wisdom bank: interfaces worth copying (13 Nov 2026)

How this was done: about 25 web searches and 12 page reads. Search summaries and vendor pages were the main evidence, and I could not see any app running. So "how it feels" below is built from official docs and reviews, and anything I could not confirm is marked UNVERIFIED. I did not repeat the earlier research (WorkFlowy, TheBrain, Sefaria, Nodus, sift-kg and so on); this extends it.

---

## The five patterns worth copying

### 1. Drop in a source, get a board of cards (Heptabase "Research a topic")
Ingestion job (1), and a card living in many places.
- **How it feels:** One button at the top of the left sidebar. You drop in PDFs, YouTube links or whole playlists, docs and images, then press "Start research on a new whiteboard". Heptabase downloads the YouTube transcripts and parses the PDFs itself, and a new whiteboard appears with everything laid out as cards. A chat panel opens beside it and suggests questions based on the cards. Each answer carries links back to the exact paragraph or video timestamp. A good answer becomes a card with one "New card" press, and you can edit the reply (keep the lines you want, add your own note) before it is kept. Source: [Work with AI](https://wiki.heptabase.com/work-with-ai).
- **One item in many clusters:** A card lives in a shared Card Library and "can appear on any number of whiteboards". A card's Info panel lists every whiteboard holding it, and a "Whiteboard location" tool shows where it sits on each. Source: [user interface logic](https://wiki.heptabase.com/user-interface-logic). The 2025 changelog has the "Appears in X whiteboards" label ([changelog](https://wiki.heptabase.com/changelog/2025)).
- **Loved:** reviewers praise the thinking-on-a-canvas feel and that AI cites the source. **Hated:** lag on boards with 100 or more cards, especially with PDF highlights (one review site, [Vantaige](https://vantaige.io/ai-tool/heptabase), second-hand); the learning curve; Heptabase's own help advises splitting big boards. Heptabase's own page says 100 cards is the point to add another layer.
- **What to take:** the ingest moment is "drop it in and a laid-out place appears", not a form. And "Appears in N places" as a visible, clickable line on every concept.
- **Unverified:** I did not see a screenshot. The roadmap page ([roadmap](https://wiki.heptabase.com/roadmap), updated 6 Nov 2026) lists a sub-whiteboard preview mode and an MCP feature for organising boards.

### 2. Clusters as named, resizable areas that keep their title when you zoom out (Heptabase sections)
Jobs (2) and (5).
- **How it feels:** You select related cards, press Cmd/Ctrl+G, and they sit inside a labelled area. Section titles stay readable when you zoom far out, so the layout of the whole board is still legible. Dragging more items in makes the area grow to fit (Dec 2025). Sections can be handed to the AI as the chat context ("talk about only this cluster"). Whiteboards nest inside whiteboards like folders, with sections inside them. Sources: [organize knowledge](https://wiki.heptabase.com/organize-knowledge-and-projects), [changelog](https://wiki.heptabase.com/changelog/2025).
- **Limits:** the cluster is drawn by hand; there is no AI proposing the grouping that I could confirm. A card in two sections means two copies placed on the board, not one card with two membership lines (UNVERIFIED how it handles it on the same board).
- **What to take:** the cluster is a thing you grab, name, resize and talk to. Ask-the-AI-about-this-cluster is the piece Adrian has not seen mocked.

### 3. The swarm: focus on one, its relatives float around it, tags are the many-to-many (Napkin, napkin.one)
Jobs (3) and (5), and ideas in many clusters.
- **How it feels:** One card sits in the middle; related cards drift around it like a loose swarm under simple attraction and repulsion. Click any card and it becomes the centre and the swarm re-forms. Related means shares a tag or similar text; if too many qualify, it shows the ones you have not seen longest. Grey boxes sometimes gather cards that relate to each other. Adding a tag instantly pulls new cards in. A card with tags x and y appears next to both x and y neighbours, so one item lives in several groups without any folder. Source: [reviewer walkthrough](https://tfthacker.substack.com/p/collecting-connecting-and-inspiring-with-napkin-748bb1337ee1).
- **Capture:** as you type, tag suggestions appear as bubbles, one click to accept or dismiss, and it learns from the dismissals. "Inbox Review" walks you through recent captures one at a time; "Grooming" shows neglected notes and unconnected notes with a magic-wand tag suggestion.
- **Loved:** zero setup, serendipity, one reviewer calls the browsing unique. **Hated/limits:** meant for short ideas, needs about a month of use before it pays back (same reviewer). Only on iPhone and web as far as I could find (UNVERIFIED for 2026), and rated 4.4 from only 10 reviews.
- **Screenshots (from that article):** [related ideas](https://substackcdn.com/image/fetch/$s_!S_O_!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F3441b01e-199d-4034-9af5-04a1c75d2841_800x457.png), [inbox review GIF](https://substackcdn.com/image/fetch/$s_!zfM1!,w_1456,c_limit,f_auto,q_auto:good,fl_lossy/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F31eb667a-9032-4d34-92a1-5f30c7bfe74f_1267x712.gif), [note card](https://substackcdn.com/image/fetch/$s_!eA9V!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fef0e1512-2a45-410d-b376-1f12b67aabec_800x434.png).
- **What to take:** the one-card-in-the-middle view as the "open a concept" move, and a card's membership in several clusters expressed simply as having several labels.

### 4. A map that names regions as you zoom, and lets you rename them (Nomic Atlas and Apple Embedding Atlas)
Jobs (2), (3) and (5), the zoom Adrian wants.
- **How it feels (Nomic):** The whole collection is a map. At the far view you see a few broad labels; as you zoom in, finer labels appear, three depth levels, "like reading a geographic map" (Nomic's own words). Topic labels can be switched on, and points coloured by topic level. In edit mode you click a label, rename it, see its keywords; changes save to the shared map. Selection tools: lasso, click-to-add, vector search, exact search, metadata filters. Select a group, "Tag all results", name it, and that becomes a filter later. Sources: [topic modeling](https://docs.nomic.ai/atlas/data-maps/topic-modeling), [data interface](https://docs.nomic.ai/atlas/capabilities/data-interface). Hosted product.
- **Embedding Atlas (Apple, the one Adrian leans toward):** WebGPU map up to a few million points with density contours; automatic clustering and labelling; real-time search and nearest neighbours; linked charts with cross-filtering; viewers for text, image, audio; and AI agent access over MCP (schema, SQL, charts). A Python widget returns your selection as a dataframe. Sources: [site](https://apple.github.io/embedding-atlas/), a third-party index for the widget (UNVERIFIED). Images: [dark](https://apple.github.io/embedding-atlas/assets/embedding-atlas-dark.png), [light](https://apple.github.io/embedding-atlas/assets/embedding-atlas-light.png). Which of these features are new in 2026 I could not confirm.
- **Gap to fix (my reading of the docs):** neither shows readable text at depth; the point is a dot. Nomic's rename-the-label and tag-the-lasso moves are the human-management part Embedding Atlas lacks as far as I can tell (UNVERIFIED whether it has an edit-label mode).
- **What to take:** depth levels of labels tied to zoom; lasso then name equals new cluster; rename a label in place.

### 5. Click anything, see the exact source passage beside it (Elicit table, Heptabase citations, NotebookLM)
Job (4) and trust.
- **Elicit:** a grid of papers by questions. Click any cell and the supporting quotes from the paper show, with the original text highlighted beside it; arrow keys move between cells; you test a column on a pilot of 10 papers before running all. Sources: [Elicit help](https://support.elicit.com/en/articles/4267649), [intuitionlabs](https://intuitionlabs.ai/articles/elicit-data-extraction-clinical-papers). The 2026 interface specifics are UNVERIFIED (help pages undated).
- **NotebookLM mind map:** one chip in chat makes a map; branches expand and collapse; click a node and the chat asks about that topic. Official page: [Mind Maps](https://support.google.com/notebooklm/answer/16212283?hl=en). Secondary write-ups claim node click shows citations; Google's page does not say so, so treat that as unconfirmed. Not on mobile. A three-column Sources / Chat / Studio layout and an April 2026 auto-categorise-sources update are reported by blogs only (UNVERIFIED): [update post](https://pasqualepillitteri.it/en/news/1391/notebooklm-april-2026-update-auto-label-flashcards).
- **What to take:** every statement at every depth has a one-click "show me the exact words" that opens the source beside it. Pair with the earlier finding that code, not the model, checks quotes.

---

## Smaller things worth stealing (one line each)

- **Are.na:** a block connects to unlimited channels; selecting it shows every channel it is in; hovering a channel shows a mini preview; channels connect into channels ("This channel appears in" in the header). Good model for "one idea, many clusters, nested". [Connections help](https://help.are.na/docs/getting-started/connections).
- **InfraNodus (Obsidian plugin):** finds clusters from the text itself and shows the gaps between clusters, then the AI proposes questions that would bridge a gap. Closed source, needs an account. A "gap between two clusters" suggestion is a strong cluster-management delight. Images: [animation](https://infranodus.com/images/front/obsidian/infranodus-obsidian-plugin-pages.gif), [gaps](https://infranodus.com/images/front/obsidian/infranodus-obsidian-idea-gap.jpg). [Page](https://infranodus.com/obsidian-plugin).
- **Kumu clustering:** a cluster is made from a field, and the cluster itself is a real element that is reused if one with that name exists; several rules chain (people by organisation, organisations by sector). Elements can't be edited while virtual. Whether one item can join several clusters and how sub-clusters nest is not stated in the docs I read (UNVERIFIED). [Clustering](https://docs.kumu.io/guides/clustering).
- **Tana:** the same node can show up in many places as a reference; one data set can be shown as outline, table, cards or calendar without changing the data. Reviews: steep learning curve, about two weeks of confusion. (Search summaries, no page read.)
- **Recall:** save an article, YouTube video, podcast or PDF in one click from a browser extension; summaries concise or detailed; keywords extracted and linked into a knowledge graph; an automatic tag places the card in a left panel; quizzes with spaced repetition; "augmented browsing" shows saved links while you browse. A review says the graph gets crowded with hundreds of items. Pricing sources disagree. [Recall docs](https://www.recall.it/llms-full.txt). The graph-crowding remark is one review.
- **Glasp:** YouTube transcript plus summary beside the video, click a timestamp to play from there, highlight in the transcript and it is timestamped; highlights are social (others see them). Competitors say it relies on YouTube auto-captions. [Glasp YouTube](https://glasp.ai/features/youtube-summary).
- **Readwise Reader:** inbox/feed triage, Ghostreader AI for summaries and auto-tags, resurfacing of highlights. No hands-on view of the YouTube transcript experience found.
- **Mymind, Capacities, Mem, Reflect, Saner:** sources I found describe them only second-hand. Mem and Saner sort automatically; Reflect and Capacities rely on links and typed objects. I found nothing new on cluster management or depth in any of them. Not worth more time for this brief.
- **Scrintal:** zoom out to organise cards on a board; click an element, links and backlinks in a right sidebar. A board-of-boards is not confirmed.
- **Obsidian Canvas, Juggl, ExcaliBrain:** Canvas is a spatial board (not in the backlink index per one source); Juggl is graph styling; ExcaliBrain sorts links into parents, children, friends and siblings around the centred note. I could not read how clicks behave. Nothing here beats patterns 1 to 4.
- **Cosmograph:** cosmos.gl, the GPU graph engine under it, is MIT, an OpenJS incubating project, v3 shipped; the Cosmograph wrapper is closed source with a non-commercial licence (package listing). [OpenJS post](https://openjsf.org/blog/cosmos-gl-v3).
- **Open-source GraphRAG viewers:** [noworneverev/graphrag-visualizer](https://www.sourcepulse.org/projects/2335965) (MIT, TypeScript, Microsoft GraphRAG outputs, listings say a few hundred stars), ChristopherLyon's GraphRAG Workbench (3D, community detection, listed about 560 stars), TraceGraph (MIT, traces an answer to its source). LightRAG's own web page has a graph tab with a node-details panel on the right and click-a-neighbour-to-expand; I could not find a screenshot. None of these showed an attractive cluster-management experience that I could confirm; treat them as parts, not models.

---

## How these fit Adrian's list

| His job | Best thing to copy |
|---|---|
| Ingest | Heptabase "drop links, get a laid-out board, with the AI chat beside it" |
| See | Atlas-style zoom where labels deepen as you move in (Nomic, Embedding Atlas) |
| Find | Napkin swarm and Nomic lasso/filter/tag; Embedding Atlas search and cross-filter |
| Depths | Nothing found does three depths on one concept. Closest: NotebookLM branches expand/collapse in place; Nomic's three label levels. The Elicit source-beside-it click gives the bottom depth |
| Clusters | Heptabase sections (grab, name, ask), Nomic rename-a-label, Are.na many-channels, InfraNodus gaps |

## Honest gaps

- No tool I found lets you grow a cluster, nest sub-clusters, and see one idea in several clusters in a single zoomable surface. Heptabase comes nearest but duplicates cards by placement and lags past about 100 cards per board.
- I could not verify how Embedding Atlas handles renaming or hand-made clusters; read its repo ([apple/embedding-atlas](https://github.com/apple/embedding-atlas)) before betting on it.
- Recall's, Mymind's, Capacities' and Mem's actual interfaces were not seen; only descriptions.
- Prices and ratings in review sites often conflict; none are relied on here.
