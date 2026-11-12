# Wisdom bank: could Embedding Atlas be the base?

12 November 2026, home thread. Written after Adrian picked Embedding Atlas as "the closest fully developed thing".

**How this was checked.** The published package (`embedding-atlas` 0.26.0, MIT licence, from Apple) was downloaded and its own interface definitions were read in full. It was then run in this sandbox with 20,000 invented points, invented names and three invented connections. Outside websites, Apple's documentation included, are blocked here, so nothing below comes from the documentation site. Sefaria and Nodus could not be opened for the same reason.

## What it gives, as read from the package itself

- A map that pans and zooms, drawn on the graphics card. By default it draws up to four million points and thins dense areas beyond that.
- It can be placed inside another app as a part: plain JavaScript, React or Svelte. The map alone (`EmbeddingView`) or the whole tool with search, table and charts (`EmbeddingAtlas`).
- **We supply the positions.** It takes x and y for every point, so where a concept sits can be decided by us. It can also work positions out from meaning by itself (UMAP) in the browser.
- **We can supply the names shown at each zoom level.** Each label has a place, a text, a zoom level at which it appears and a priority. Otherwise it writes names for dense regions itself from common words.
- **We can draw our own layer on top, locked to the map.** The overlay hook gives the screen position of any map position. This is where straight labelled connections and reading cards can go.
- **What a tap shows can be replaced with our own content,** and the app is told which point was tapped or selected.
- **The view can be steered from outside** (fly to a concept) and read back.
- **Filtering by any field,** including many-to-many joins to a second table (a concept in many works, a work with many concepts). This is "subjects for organizing and filtering" over one whole.
- **Search** by words, by meaning and by nearest neighbours, through a hook we provide. Nearest neighbours can be precomputed.
- Colour by one category, light and dark themes, branding and status bar can be switched off.

## What it does not give

- **No connections.** It knows closeness only. Lines are ours to draw on the overlay.
- **No reading.** A concept is a dot. Text at three depths is ours to build.
- **No continuous zoom from dot to text.** Zooming in spreads dots apart; it never turns a dot into a paragraph.
- **No stable places by itself.** Positions computed from meaning shift when the whole bank is recomputed. Keeping a concept where he learned to find it (place new things beside their neighbours, leave the rest) is ours to solve.
- It needs the embeddings (the numbers that stand for meaning) to be computed for every concept first.

## What the run here showed

- The part was created, and our own overlay drew three straight labelled connections at positions given by the map. So the overlay hook works as read.
- **The points themselves did not draw here.** The package requires WebGPU with the half-precision feature (`shader-f16`), and this sandbox's software graphics lacks it. The 0.26.0 package contains no WebGL fallback. So there is no picture of the full combination from this sandbox, and **whether it runs on Adrian's phone is not verified.** Recent iPhones and recent Android Chrome support WebGPU; an older phone or browser would show nothing.
- It is a young package (version 0.26) and its interface may still change.

## How the pieces would combine (recommendation, not his words)

1. **Far and middle view: Embedding Atlas.** Every concept from every work is one point on one map, placed by what it means, so tea and Buddhist teaching sit together where they share. Subjects are a filter or a colour. Our own names appear level by level as he zooms.
2. **Interconnection: our layer on the map.** Choose a concept and its connections are drawn as straight labelled lines to where the others sit, only for what is chosen, never all at once. The same connections are listed as plain rows beside the reading, as Sefaria does.
3. **Near view: a reading that opens in place over the map,** at three depths, with the passages and sources, in Sefaria's manner: the text, and beside it what connects to it.
4. **From Nodus, the idea only:** titles when far, more of the text as he comes near. Not opened or verified here.

**The open decision.** With Embedding Atlas the bank is a map of dots, and reading opens on top of it. It is not one unbroken zoom from the whole bank down into a sentence. If the unbroken zoom matters more than the ready-made map, Embedding Atlas is the wrong base and the far view has to be built another way.

## Next step proposed

One small trial page he opens on his own phone: the real Embedding Atlas map with a few thousand invented concepts marked Sample, our names by zoom level, connections drawn straight for a chosen concept, and a reading opening in place. It answers the two things reading cannot: does it run on his phone, and does it feel interconnected enough.
