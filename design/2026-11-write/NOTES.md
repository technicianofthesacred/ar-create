# Write, Read and Check in version two: notes for Adrian (third pass)

> "The only thing that I am not crazy about is how many different fonts and colors and shapes and sizes you put
> here, how the header blurs in with the writing, and how you don't have clear delineations throughout all of the
> areas."

## The system (third pass)

Every screen now uses only what is listed here. Anything else was removed.

- **Two faces.** The interface face (Plus Jakarta Sans) for everything the app says. Lora only for words that are
  his or someone's spoken words: his page, his notes, transcript lines, and the before and after of a proposal.
- **Interface type: two sizes, two weights.** 14 for everything ordinary, 13 for quiet details (who, when, where,
  labels such as "Your words now"). Weight 400 for reading, 600 for titles, buttons and navigation. That gives three
  interface text styles in ordinary use: a title (14, 600, main), text (14, 400, main) and a detail (13, 400, quiet).
- **Three text tones.** Main, quiet, and one accent kept for what needs him: a status he must act on ("Not saved
  since 14:06", "Two versions"), the border of the item asking him now, the "Needs you" dot, words that do not fit.
- **Words that go and words that come.** Red, struck through, only for words that would go. A green wash, only for
  words that would come. Neither colour appears anywhere else (the old green "done" text, red status and red
  listening dot are gone).
- **Two corners.** 6 for controls, 8 for surfaces. Only dots and the quote ring are round.
- **Three button kinds plus icon buttons**, the same height (32) and look on every screen:
  1. the main action, filled dark (light in dark theme): one per item, the result he came for ("Put it in my text");
  2. an ordinary action, a quiet grey fill ("Edit it first");
  3. a quiet text action, no fill, quiet tone ("Keep my words", "Undo", "Cancel", "Speak" at the cursor).
  Icon buttons are the quiet kind with only an icon. Navigation (places, subjects on the desk, Article and Carousel,
  Write Read Check, the subject name) is plain text, with a line under where he is. Never a pill. On a phone the
  bottom bar uses the quiet kind, made 44 tall for the thumb.
- **Four surfaces.** The band (both bars), the desk (behind the columns), paper (the page, and every item in a
  column), and a well (a part set into paper: two versions after a conflict, a proposal opened for editing, the
  margin's items on a phone).
- **Delineation.** Each source, proposal, finding and version is its own piece of paper with a hairline edge,
  8 apart, on the desk. The page is a sheet with a hairline on each side. The band sits above everything with a
  clear edge under it. Inside an item there are at most two groups and one hairline: what it is (title, then a quiet
  line saying who from and the count), the words (label, then Lora), and the actions under a hairline.
- **Width kept.** Items stand 6 from the column's edge and their text 12 inside the item; the columns grew by 12 so
  the room for text is exactly what it was.

## What the third pass changed

- **The header.** Before, the top bar was the desk colour made 88% opaque with a blur, and the piece bar was the desk
  colour too, so the writing showed through and the bars merged with the columns. Now both bars are one solid band
  (darker than everything below in dark, a deeper stone in light) with a single clear edge under it. Scrolling, the
  writing passes under the edge and never shows through. The gold line under the top bar is gone.
- **The areas.** Before, columns were bare desk with items divided only by a faint line. Now each item is paper on
  the desk, the page is a sheet with edges, and the waiting proposal or chosen finding has an accent border.
- **Inside a proposal** (his close-up): seven text styles became three plus the Lora words. The title lost its dot;
  "who from" and the count became one quiet two-line detail; "Your words now" and "With this change" are quiet
  labels over his words; her line is a quiet detail; the buttons sit under a hairline.
- **Check:** findings lost their coloured dots (warn, bad, ok); each is an item; the one he is on has the accent
  border. "Matches your sources" is its own item.
- **Earlier versions:** each version is an item; a named version shows its name as the title. The coloured author
  dots and gold name are gone.
- **Removed styles:** the pill "Speak" box at the cursor, the round play button, underlined gold "Undo" links, the
  large button size, the 12-size type, weights 500 and 700 in the interface, the second grey (ink2), the blur, seven
  corner sizes.

## Counts, before and after

Measured by a script over all 19 screens at 1440 and 390, dark and light. The mock-up strip and the slide drawings
are left out.

| What | Second pass | Third pass |
|---|---|---|
| Faces | 2 | 2 |
| Interface sizes | 5 (12, 13, 14, 15, 22) | 2 (13, 14) |
| Interface weights | 4 (400, 500, 600, 700) | 2 (400, 600) |
| Text styles (face, size, weight, colour), per theme | 41 (30 interface, 11 Lora) | 15 (6 interface, 9 Lora) |
| Corner sizes | 8 plus round | 2 plus round |
| Button looks (height, corner, fill, type), outside the states sheet | 26 | 12, which are the three kinds, icon buttons, the phone bar and plain-text navigation at the heights of their bars |
| Button kinds by name | 14 (main, ordinary, large, quiet at three heights, icon, link, pill, round play, Advanced, place, chip, back, phone bar) | 4 (main, ordinary, quiet, icon) plus plain-text navigation |
| Surface colours, per theme | 5 dark, 6 light (one of them see-through) | 4 (band, desk, paper, well) |

The six interface styles left are the three above, the quiet tone at 14 and 600 (quiet buttons, navigation not
chosen), the main button's own text colour, and the accent at 13. The nine Lora styles are the title (32, or 28 on a
phone), part headings (22, main and quiet for parts still to write), the page (18), spoken words arriving (18 italic,
quiet), and column words (15: main, quiet for context, and the red of words that go).

A static mock-up with invented content only: the demo's tea subject "Straw over the rows", with Mrs. Oda and her
shaded garden from the approved sample. Open `index.html` from inside the repository, because the fonts come from
`runtime/public/assets/fonts`. The dashed strip at the top is not part of the design: it lists every screen and says
what a picture-only button would do. Every screen also has its own address, for example `index.html#check`.

## The rules (from Adrian's reactions of 12 November)

Every screen was rebuilt to keep these. Where a script can measure a rule, it was measured; the numbers are under
"How the rules were checked".

1. **Nothing moves on hover or focus.** Hover and focus change colour, background or an outline drawn outside the
   control, never size or place. A control that used to appear on hover is now always there, quietly, in space kept
   for it.
2. **A bar never changes its number of lines.** Each bar has a fixed height: one line on a computer, two fixed lines
   on a phone in every state. A status has one place. A long status shortens (a short form under 1100 wide, an
   ellipsis beyond that) and never wraps. Its action, such as Try again or Stop, sits next to it on the same line.
3. **Words get the width.** Side columns have no rails, no indents and no time columns. Text runs to 12 pixels from
   each edge of a side column. Details such as time and author go on their own quiet line under the words they
   describe.
4. **His prose looks like a piece of writing.** Nothing goes inside it except his words: no numbers, no chips, no
   time stamps. A quote carries one small ring after its closing mark, which opens her exact line in place, under the
   paragraph. A kept phrase carries only a hairline under it. The words a waiting proposal is about get the faintest
   wash.
5. **A proposal shows what goes and what comes.** Before and after are the centre of every proposal: his words now,
   with the words that would go struck through; the words after, with the words that would come marked. A plain
   count sits on top, such as "Takes away 2 words of yours, adds 9 words". A proposal that only adds says "Takes away
   none of yours". The source it rests on is quoted under it.
6. **Every button says what it does.** Each button names its result to someone who has never seen the screen: "Put
   it in my text", "Keep my words", "Change the page to “early May”", "Keep it: I know this myself". A Check finding
   reads as what was found, then the evidence in place (his page's sentence and the source's sentence), then one or
   two actions. No button only navigates when the thing can be shown where he is.
7. **Icons where the icon is known, words where it is a decision.** Icons are used for play, undo, close, stop,
   restore and find, each with its name on hover and for screen readers. Words are used for every decision about his
   words.
8. **No layer over what he is reading.** Nothing floats over the text. When he selects words on a computer, the
   choices appear in the margin beside the selection, on the page's own paper colour, so they follow the theme and
   cover nothing. On a phone they replace the three buttons of the bottom bar, under his thumb and below the text.
9. **The words are always shown in the shape they will be published in.** An Article is written on its page. A
   Carousel is written on its slides, in their layouts, and the post text sits under the post as Instagram shows it.
10. **Every control has all its states, and every panel has an empty state.** The states are rest, hover, focus,
    pressed, disabled and working, shown on `#states`. Long titles are cut with an ellipsis and keep their full text
    on hover. Subjects on the desk that do not fit go into "+n" instead of being squeezed to a sliver.
11. **The promises about his words shape every screen.** An assistant's words go into his text only when he presses
    "Put it in my text". A conflict shows both versions, with what differs marked, and he chooses. Every version
    names who made it. Words kept on the device after a crash or a failed save are shown, never dropped.

## How the rules were checked

- **Rule 1, nothing moves on hover or focus.** A script forces hover, then focus, on every button, link, row, line,
  field and paragraph of all 19 screens, at 1440, 1000, 700 and 390 wide, in dark and light. It compares the place
  and size of every element on the page before and after. Result: 9,850 states tested and none moved anything. The
  same script on the first pass, at 1440 dark alone, found 33 of 1,203 states that moved things; the worst was a
  transcript line pushing up to 79 elements.
- **Rule 2, bars keep their lines.** A script measures the top bar, the piece bar and the phone bar on every screen
  and after every button press, including Try again's working and failed states. It checks their heights and whether
  any text inside wraps or is cut off. Result: 4,064 bar states measured. Every bar kept one height: the top bar 48, the piece bar 46 on a computer and 86 on a phone, the phone bar 60. Nothing wrapped or was cut off in any of them. The first pass dropped Stop onto a second line at Adrian's width.
- **Third pass, run again.** Hover and focus: 9,754 states over all 19 screens at 1440, 1000, 700 and 390, both
  themes; none moved anything. Bars: 4,052 bar states measured, including after every button press; no bar changed height (48, 46, and 86 and 60 on a phone) and nothing wrapped or was cut off. Nothing scrolls sideways and no text is clipped at 390, 700, 1000
  or 1440 in either theme (152 screen views), and only the sizes 13 and 14 are used in the interface. Buttons:
  1,193 pressed on every screen at 1440 and 390; every one did something.
- **Third pass, column text width at 1440.** The room for text in each column is unchanged; the columns grew by 12
  because each item now stands 6 inside the column, with its text 12 inside the item.
  - Margin: 340 wide with 316 for text, now 352 wide with 316 for text. The widest line: 308 before, 316 after.
  - Sources: 320 wide with 296 for text, now 332 with 296. The widest line: 295 before and after.
  - Carousel panel: 360 with 336, now 372 with 336. The widest line is 326 now against 335 before, only because its
    lines wrap at different words; the room is the same.
  - On a phone the margin's items sit in the page with 330 for text, as before.
- **Rule 3, words get the width.** Side columns at 1440, measured.
  - Before: the margin was 300 wide, with text up to 246 wide, 34 from its left edge.
  - Before: the sources column was 320 wide, with text up to 252 wide, 34 from its left edge.
  - After: the margin is 340 wide, with text up to 316 wide, 12 from each edge.
  - After: the sources column is 320 wide, with text up to 296 wide, 12 from each edge.
- **The earlier checks were run again:**
  - nothing scrolls sideways at 390, 700, 1000 or 1440, in either theme;
  - no text is clipped;
  - only the six interface sizes are used (the slide pictures keep their own type);
  - no network requests;
  - every button does something.

## Earlier versions: what I take from Google Docs, and what I do differently

1. I take the list of versions grouped by day, each named by when and who, newest first, and naming a version so it
   is kept for good ("Before Lin read it").
2. I take that choosing a version shows the whole page as it was then, with what changed in that version marked,
   and one clear action, "Restore this version", at the top.
3. I take that restoring never destroys anything: the words he had become a version too.
4. I do differently: each entry leads with what changed in plain words ("Two sentences typed in The straw"), with
   the time and who on a quiet line under it. Docs leads with a date and time, and the time is what squeezed his
   words before.
5. I do differently: the version shows in the page itself, where he writes, not in a separate full-screen viewer.
   There is a coloured dot per author (him, or his choice of Claude's words), and Undo stays in the bar for the last
   change.

## The screens: what changed in this pass and why

| Address | What it is for | What changed in this pass, and why |
|---|---|---|
| `#start` | An Article with nothing written: his own sentences gathered in the order of his plan, with Start from your own words, Speak and Type. | The time stamps after each sentence became one small ring each, opening where he said it (rule 4). Undo is shown disabled, because there is nothing to undo yet. |
| `#write` | Writing, with his sources on the left and proposals on the right. | Transcript lines keep the time and speaker on one line that never wraps. Play and Quote are always there, quietly (rule 1). Proposals lead with before and after and a count (rule 5). No numbers in the prose; a waiting proposal's words get a faint wash. A quiet "Speak" sits at the cursor. |
| `#select` | Words selected: Keep these words exactly, Ask Claude for another way, Add a note for myself. | The light bar over his text is gone. The choices sit in the margin beside the selection, in the theme's own colours, so they cover nothing (rule 8). The button words are clearer, and they are smaller on a phone. |
| `#proposal-edit` | A proposal opened in his text to change before it goes in. | The buttons now read "Put it in my text" and "Cancel". |
| `#quote` | A quote put in at the cursor from a transcript line. Its ring opens her exact line under the paragraph. | The time stamp chip in the prose is replaced by the ring. The opened line under the paragraph has Play and Close icons (rules 4 and 7). On a phone the sources fill the lower half of the screen. |
| `#speak` | Dictating. The words arrive grey and italic at the cursor, and a small box reads "Listening · Stop". | The loud dark Speak button is gone. Speak is a quiet microphone in the bar, at the cursor and in each part still to write. Listening is a steady red dot in the status place and in the box at the cursor; Esc also stops. On a phone, Speak is the middle of three equal quiet buttons. |
| `#speak-done` | The spoken words have settled as his own words. | New. The status reads "14 spoken words in" with an Undo icon on the same line. Earlier versions records them as "You, spoken". |
| `#history` | Earlier versions, after Google Docs. | Rebuilt (see above). Entries are full-width stacks with no time column and no floating "Look". Choosing an entry shows that version in the page with its changes marked. Restore this version, Name it and Close sit at the top. |
| `#focus` | Only the page, with Leave focus, the status and Speak. | Speak is quiet here too. |
| `#read` | The piece as a reader sees it. Click a paragraph for Change this paragraph or Add a note for myself. | The quote rings work here too. The last button reads "Check it". |
| `#read-working` | Claude checking quotes while he reads. | The status says "Claude is checking quotes against the recording, 3 of 5" in its fixed place, "Checking quotes, 3 of 5" when narrow. Stop is an icon on the same line, so the bar never drops to two lines (rule 2). |
| `#check` | What Check found, each finding with its evidence in place. | Every finding is rebuilt as what was found, his page's sentence beside the source's sentence with the difference marked, and one or two buttons that say their result. "Go to it", "Show the note" and "Show the sources" are gone (rule 6). "Rewrite it here" opens the sentence in place. Each answer has Undo, and "Check again" sits at the top. |
| `#finish` | Nothing left to look at, then Mark the Article finished, then Go to Share. | Finishing can now be undone. |
| `#carousel` | Writing a Carousel on its slides. | Rebuilt from his words (see below). |
| `#carousel-post` | The post text, under the post, as Instagram shows it. | New. It shows where "more" cuts the text. |
| `#conflict` | One paragraph written in two places. | Each version now marks what differs from the other. "Keep this one" sits on each version's own line. |
| `#recovered` | Words kept on the device after a crash. | Shows Saved beside Kept on this device as before and after, with the count. |
| `#save-failed` | The app is not answering. | The bar reads "Not saved since 14:06" with Try again on the same line. The margin says what Try again does, what is safe meanwhile, and what to do if it fails again, with "Copy all my words". Pressing Try again shows it working, then a second failure with the times tried, then success. |
| `#states` | Every kind of control in all six states. | New. |

### The Carousel, rethought

The unit is the slide in its layout, not a list of words. The Carousel's Write *is* the slide studio, so there is one
place, not two.

- **On the left:** the six slides and the post text, each drawn in its real layout. A slide whose words do not fit
  carries a mark.
- **In the middle:** the chosen slide, large. His words are changed on the slide itself. Under it, a meter reads "91
  of 50 characters: 41 too many, the end is cut off".
- **On the right, the layout:** its code and name, and what it holds ("a photograph and up to 50 characters, on 2
  lines"). "Change the layout" opens, in place, the layouts that have room for these words, each drawn with his
  words in it.
- **On the right, a proposal:** before and after on the slide itself, then in words, with the count.
- **On the right, the photograph and the words:** "Change the photograph" opens the subject's photographs in place.
  The Words part says plainly that the Article keeps its own words.

The studio's own tabs (Layout, Photographs, Add, Words) become these parts of the right column. Its layout codes,
looks, accounts and saved templates stay as they are. The subject page's "The slides" and "The post text" steps open
this one screen. The same thinking holds for every output: the words are always written in the shape they will be
published in.

## What the machinery must do to make this real

Each item is marked **exists today**, **small** or **large**, judged from `docs/CAPABILITIES.md` only.

1. A version two screen for one named piece, with the way of looking in the address. **Small**: `study-draft.read` and `magazine.working-draft.read` exist.
2. Write opens the piece he came from. **Small**.
3. Saving by itself as Adrian, with revision checks. **Exists today**: `study-draft.save`, `magazine.working-draft.edit`.
4. Undo. **Exists today**: `study-draft.undo`, `magazine.working-draft.undo`.
5. Earlier versions with what changed in plain words and who made each change.
   - Showing one version in the page with its changes marked: **small**. `study-draft.history-preview` and `history-restore` exist.
   - Describing each change in plain words: **small**.
   - Naming a version: **small**, and new.
6. Words kept on the device after a crash, shown as before and after. **Exists today** in Advanced: `study-draft.recover`, `root-recovery`. The before and after view is small.
7. A failed save: retry, show the times tried, and copy all his words. **Small**: the recovery storage exists; copy is a browser feature.
8. A conflict per paragraph, with both versions kept and what differs marked. **Large**: stale saves are refused today with 409.
9. Proposals with before and after and a word count. **Small**: proposals exist (`magazine.working-draft.ai.propose`, `.accept`, `.reject`). The comparison of words is done in the screen.
10. Edit a proposal before putting it in. **Small**.
11. Knowing which sentences are still an assistant's unchanged words, for Check. **Large**.
12. Keep exact on selected words, refused to assistants. **Exists today** as a human-only decision in Advanced; the command name needs confirming.
13. A quote linked to its exact line in the recording, opened under the paragraph, with Play from that moment. **Small**: `study.source-context` and `study-originals.audio` exist; the link from quote to line is new.
14. Start from your own words. **Large**: it needs confirmed speaker labels, and either an AI provider or a plain rule to place his sentences.
15. Speak: dictation at the cursor, with words arriving in place. **Large**: it needs a speech to text engine.
16. Check: each quote against its source. **Exists today** in part: `study-draft.check`, `magazine.mechanical-check`.
17. Check: a note that disagrees, or a claim nothing supports, with the closest evidence shown. **Large**: it needs an AI provider. "Ask Research to find a source" needs Research's looking, which is not built yet.
18. Check: actions that change the page in one press ("Change the page to “early May”"). **Small**: it is an edit by Adrian.
19. Claude working while he reads, with Stop. **Exists today**: `presence`, `events.since`, `leases`. Stop is small.
20. Mark finished, keep an edition, go on to Share. **Small**.
21. The Carousel written on its slides: words edited on the slide and saved to the plan. **Large**: today the studio shows words read-only, and they change in Write. The plan (`instagram.plan.post`) and the renderer (`instagram.preview`) exist.
22. Each layout's capacity in characters and lines, and whether words fit. **Small**: layouts carry `maxChars` and `textParts` today; lines would be new.
23. Layouts that have room for these words, drawn with his words. **Exists today**: the studio's "suits" rule and preview.
24. Proposals for a slide's words, shown before and after on the slide. **Small**: `shared-carousels.propose` exists; the drawing is the renderer's.
25. The post text under the post, with where "more" falls. **Small**: `instagram.captions` exists.
26. The desk keeps whole chips, with "+n" for the rest. **Small**: version two's shell already does this, and the squeezed chips in Adrian's picture should be checked against it.

## What I could not solve

- **The selection's choices on a computer:** the margin panel sits at the top of the margin in the mock-up. In the
  app it should sit level with the selected line, and that needs measuring in the real editor.
- **Words on a slide that run past their layout:** they are shown cut off under a hatched edge. Exactly where the
  renderer cuts would come from the renderer.

## What I am least sure of

- **Third pass: the dark band.** In dark the band is darker than the desk, so it reads as a frame over the paper.
  Against the desk columns the difference is small and the clear edge under the band does most of the work.
- **Third pass: the accent.** It is now the only colour besides go and come. Findings no longer differ by colour
  (a date that disagrees and a claim nothing supports look alike until he reads the title).
- **Third pass: the Article title** (32, 28 on a phone) and part headings (22) stay outside the two interface sizes,
  because they are his prose in Lora.

- **Lora for his prose.** The app shows the manuscript in sans today. The article title, at 32 pixels (28 on a
  phone), is outside the six interface sizes.
- **The word count in a proposal.** It ignores changes of punctuation only, so adding quote marks does not count as
  new words. That may undercount what he would call a change.
- **Writing a Carousel on the slides.** It joins two screens that two different pieces of work own today.
- **Whether three buttons under a proposal are too many** in a 340 pixel margin. "Keep my words" goes onto its own
  line.
