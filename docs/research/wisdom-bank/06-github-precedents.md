# Wisdom bank: open source projects that already map ideas

11 November 2026. Follow-up to [05-map-precedents.md](05-map-precedents.md), asked for after it: look at GitHub projects that already do this kind of concept mapping. Phone version: [06-github-precedents.html](06-github-precedents.html).

**How this was checked.** I searched GitHub, then cloned eleven repositories read only and read each README, and a few status files. I ran nothing. Star counts and last update dates come from GitHub search on 11 November 2026. I did not open any live site, because the network blocked it, so what a map looks like and how it feels is not checked. Where a claim is the project's own description of itself, I say "says".

## Ten projects

| Project (stars) | What it is | How you move in it | Borrow | Avoid |
|---|---|---|---|---|
| **[The Philosophy Web](https://github.com/MichaelMillerman/philosophyweb)** (25). Live: [thephilosophyweb.com](https://thephilosophyweb.com/) | 234 philosophers and 478 lines of influence in one force graph. Says nobody is placed by hand. | Zoom and pan. Hover lights a thinker's neighbours and fades the rest. Click opens a side panel with every connection in and out. Filter by era or school. Book nodes switch on and off. | Hover fade. Side panel listing every connection. Three line styles: solid influenced, dashed critiqued, dotted responded to. Source is plain text, one block per thinker, one line per edge. | One field of 234 is its size. It does not say how it copes at thousands. |
| **[nf-metro](https://github.com/seqeralabs/nf-metro)** (74). [Playground](https://seqeralabs.github.io/nf-metro/latest/playground/), [gallery](https://seqeralabs.github.io/nf-metro/latest/gallery/) | Draws transit style maps from a short text file. Each route is a coloured line with stations. Made for software pipelines, not ideas. | Pan, zoom, hover a station for details. Tap a line in the legend to isolate it and zoom to its extent. | Isolate one line from the legend. Lines declared in plain text. Says its playground runs in the browser with no install, so it could draw an invented pathway for a mock-up. | Built for one flow left to right, with sections and entry and exit ports. Many lines through one stop is not its case, as far as the README shows. |
| **[map4sci](https://github.com/cns-iu/map4sci)** (4) | Research code for large graphs with semantic zoom. Says it builds a multi level tree so zooming keeps the structure. | Zoom in and out. Each edge carries a level, 1 to 7, where lower means more important. Each node carries a weight. | Give every connection a level so the far view draws only the strongest ones. It matches your far, closer, closest idea. | Research code with four stars. I found no live demo. Input is a graph file, not notes. |
| **[Hyper-Knowledge](https://github.com/hanxiangmin/Hyper-Knowledge)** (92). [Docs](https://hanxiangmin.github.io/Hyper-Knowledge/latest/) | Builds graphs where one relation can join many things at once (a hyperedge), with the source of each. Version 0.8.0. | One offline page with four views: matrix, incidence table, whole structure overview with relations drawn as capsules around their members, and a one relation reader. Hover fades the rest. | Drawing a relation as a capsule around what it joins. A reader that shows one relation at a time. | It joins many things, not a relation to another relation. |
| **[Eusebius](https://github.com/iamgabrielcunha/eusebius)** (1) | Research environment on four ways in: time, place, relation, evidence. Rule: no bare claims. Every claim carries a model, confidence, basis, status and a source it actually read. | Timeline, map, graph and library, over one set of YAML files. Competing positions sit side by side and can be switched. | AI suggestions are kept apart from verified facts until a human acts. That is your "agents propose, you decide". Its status file says a relation can target a claim. | Young: one star, and its status file of 15 September says nothing is marked verified yet. I did not read its schema. |
| **[WEFT](https://github.com/DigitalHumanitiesCraft/weft)** (0). [Docs](https://dhcraft.org/weft/) | A small set of typed links between notes in a Markdown vault, so an agent can walk them. Draft v0.1. | An agent reads typed links as a tool. Its docs page shows the schema as a curated diagram with click to focus. | Discipline: reuse standard link kinds and add one of your own only where it means more than "related". A curated layout, not a force layout, to stay readable. | A draft with the relation layer still pending. |
| **[Argdown](https://github.com/argdown/argdown)** (1,058). [Sandbox](https://argdown.org/sandbox/html) | A short text syntax for arguments. Maps are drawn while you type. Works inside Markdown and exports to image or web page. | Write text, see the map. | Writing connections as plain text that becomes the map, so you and an agent use the same entrance. | Built for pro and con arguments. Whether a relation can target a relation, I could not check. |
| **[ConceptLoom](https://github.com/Zproger/ConceptLoom)** (203) | An agent workflow that finds what you know, proposes a short path, and teaches one connection at a time. Says it keeps notes between sessions. | A conversation, with small text or Mermaid diagrams. | Walking one connection at a time with a check. It fits your pathways. | It is not a map you look at. |
| **[LLMapper](https://github.com/jorgearango/llmapper)** (103) | A script that asks a model to draw a concept map of a Wikipedia page. | Run it, get a picture. | A warning. Its own README says the map is different each time it runs. | Maps made by a model, not by you. It calls itself a toy. |
| **[HyperNetX](https://github.com/pnnl/HyperNetX)** (722) | A Python library from a US national lab for analysing and drawing hypergraphs. | A library, not an app. | A reference for set shaped links. | Nothing to adopt. It serves researchers. |

Also seen, from search descriptions only: [WebVOWL](https://github.com/VisualDataWeb/WebVOWL) (1,027) draws ontologies, and its README warns that its old web address now belongs to someone else, a reminder that a hosted map can vanish. An Obsidian plugin, [persistent graph](https://github.com/Sanqui/obsidian-persistent-graph) (147), exists only to save node positions, which suggests people dislike a graph that rearranges itself.

## What these add to the earlier findings

- **Levels on connections make a far view possible.** map4sci puts the idea in the data, so the far view draws only the strongest connections.
- **Isolating one line is a real feature.** nf-metro does it from the legend. It is the transit picture's most useful move.
- **Hover fade and a side panel** (Philosophy Web, Hyper-Knowledge) keep a big picture readable without hiding it.
- **The source is a short text file** in four of these (Philosophy Web, nf-metro, Argdown, WEFT). That suits equal entrances for you and agents, and diffs cleanly.
- **Provenance on every claim** (Eusebius, Hyper-Knowledge) matches your exact words rule.
- **No project here draws a connection between connections.** The closest are Hyper-Knowledge's capsules for one relation joining many things, and Eusebius's relation that targets a claim.

## What I would test next

1. Put one invented pathway through nf-metro's browser playground and open the result on a phone. It is the cheapest way to see the transit picture with real shapes.
2. In a mock-up, give every connection a level and check that the far view stays readable with a few hundred invented concepts.
3. Try the capsule idea for a pattern that joins several connections.

## What I could not verify

- Any live site, how it looks, or how it feels on a phone.
- Whether nf-metro copes with many lines through one stop, and whether its playground works as described.
- How the Philosophy Web behaves at thousands of nodes.
- Eusebius's and Argdown's handling of a relation that points at a relation.
- A live demo for map4sci.
- Search covered about nine queries. Obsidian and Logseq plugins, Kumu style tools and other maps may exist that I did not find.
