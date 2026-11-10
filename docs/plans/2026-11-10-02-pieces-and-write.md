# Plan 2: pieces and Write

**Goal.** Every piece of a subject is always in view, each sidebar step opens what its name says, and a mistake can be taken back where it was made.

**Findings covered.** U3, U4, U15, U21 (pieces), U22, U23. Root problem R3.

## What Adrian will see

- The **piece tabs** always list every piece of the subject in the same order (for example Article, Carousel, Video), whichever one is open.
- **Write** in the sidebar, in the finder and from "Continue where you left off" opens writing. With a Carousel selected it opens the Carousel's words under a title that matches the lit sidebar item.
- **Outputs** lists the article beside the Carousel.
- A new Carousel's **slide headings start empty** (or with the section heading where the writing has one), not with the subject's name three times.
- **Undo where the mistake happens**: "Slide cut. Undo" beside the slides; "Undo typing" takes back one step and says what it took back.
- A piece made by mistake can be **put away and brought back** (a bin, never a delete).

## What must not change

- Each piece keeps its own words, layout, review and delivery state. A change to the article flags other pieces and never rewrites them.
- Saved Undo, recovery of unsaved words, and "Finish" remaining Adrian's alone.
- The Carousel is still carved from the saved writing when it is made.

## Where the work is

| Piece | Files |
|---|---|
| Piece tabs | `public/document-study/combined-piece.js` lines 67 to 74 (`pieces`, `currentTab`, `openReference`) |
| What "Write" opens; which sidebar item is lit | `combined-navigation.js`, `workbench-pieces.js`, `workbench-frame.js` |
| Outputs list | `combined-previews.js`, `output-connection.js` |
| Carousel words screen, slide headings, "Output r0", "Selected output wording current" | `study-output-boundary.mjs`, `media-outputs-tools.js`, `magazine-arrange.js` |
| Typing Undo, saving, recovery | `draft-flow.js` |
| Cutting a slide, "Undo arrangement" | `magazine-arrange.js` |

## Steps

1. **Tests first.** A journey test: subject with writing, make a Carousel, expect both tabs from either piece; press Write in the sidebar, the finder and Home's Continue button, expect what Adrian's decision below says; reload, expect the selected piece kept.
2. **Find why the tab list depends on the open output** and build it from the subject's pieces instead.
3. **Make the lit sidebar item and the page title agree** on the Carousel's words screen (U4), following the decision below.
4. **List the article in Outputs.**
5. **Retest "Undo typing" by hand** (U22) before changing anything: type three sentences with pauses, undo once. If it clears more than one step, or a save is refused afterwards, fix that first; it is the only finding here that can cost him words. A refused save must say so in plain words at the moment it happens.
6. **Undo beside the slides** after a cut (U23).
7. **Empty slide headings** on a new Carousel (U15). Move "Output r0" and "Selected output wording current" under Details.
8. **A bin for pieces** (U21): put away, bring back, shown in Outputs under "Earlier editions" or its own "Put away". This adds a state to saved records: it needs its own short design note, history lines and tests. Subjects can use the same bin later.
9. Walk the Part 1 journey at 1440 and 390. Before and after screenshots for Adrian.

## Finish checks

- With an Article and a Carousel, both tabs show from either one, in the same order, after a reload too.
- Write in the sidebar, the finder, Home's Continue button and "Edit words" in Outputs each open what their label says.
- The lit sidebar item and the page title match on every screen of a Carousel.
- Three sentences typed with pauses, one "Undo typing": exactly the last step is gone, nothing else, no recovery notice.
- Cut a slide, press Undo beside it: the slide is back with its words and template.
- A Carousel put away disappears from the tabs and from Audience, and comes back whole.
- `npm test` passes with the new journey tests.

## Decisions needed first

- What Write in the sidebar means when a Carousel is selected: always the article (suggested, since "Write" then means one thing), or the selected piece's words. (Review decision 2.)
- Whether the Carousel's words belong under Write or under Arrange. Suggested: under Arrange, titled "Arrange · Words", since Arrange is where the Carousel is made.

## Not in this plan

Photos on slides (review finding U12) and exports. Those need the walkable demo of plan 7 to test.
