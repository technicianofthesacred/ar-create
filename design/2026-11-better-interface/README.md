# Design round: a noticeably better interface (November 2026)

Mock-ups for Adrian to choose from by eye. **Nothing in the app has changed.** The brief is
`docs/plans/2026-11-10-08-a-noticeably-better-interface.md`.

## Second round: direction D (10 November, later the same day)

After seeing A, B and C, Adrian asked for the B and C mix with Research treated as learning in its own right, and for the
design to be checked against his i64os research work (the Research Machine, Scout, the Study room, WordForge) and against
everything AR Create is meant to do. He confirmed three things: the four stations are **Gather, Research, Create, Share**;
a research topic is separate from a subject, so one topic can feed many subjects; and Simmer sits on the subject page
between Research and Create.

`d-four-stations/` is that one direction. Seven screens: Home, the subject page, a brand new subject, a research topic,
the Research home, Write, and Write in focus. What it adds to A, B and C:

- **Research has its own home.** Topics outlive pieces and only speak when they are ripe, contested or stalled. "Ask across everything" answers from what he has kept and says plainly what his sources cannot answer.
- **A research topic reads like Write.** Sources and Scout on the left, a briefing that teaches and claims in four bands (settled, contested, what goes wrong, fringe) in the middle, and his own side on the right: "you first", learning notes Claude never writes in, his position, what is still open, and an honest receipt of the visit.
- **Claims, not summaries.** Each claim shows who backs it, who disputes it and who says nothing, and a contested claim says why they disagree. One person's telling is kept whole and apart.
- **Simmer** between Research and Create: the board, the possible dishes, and the dish named in his words.
- **Needs you in two kinds:** what only he can decide, and what Claude carries on with unless he changes it.
- **Before you release:** the consent hold, shown where it blocks.
- **One read-through in Write.** Claude's draft stays dim until he rewrites it or marks it Not me, then he finishes. A change to one passage still has Accept and Dismiss. A question thrown to Research comes back beside its paragraph.
- **Four origins kept distinct** with a word and a mark, never colour alone: their words, his reflection, outside evidence, Claude's proposal.
- **Formats that do not exist yet are choices under New piece**, not empty rows.

**Second pass on D, after Adrian looked.** He said two things were wrong: there was no clean way to organise and order
a hundred or two hundred subjects with five on the go, and Research was too heavy with text and decisions for a simple
article. D now follows two rules:

- **Home holds many.** A short "Needs you", then "On your desk" (the five in hand, as cards he can reorder), then "Everything" (all 143 in compact rows, grouped by folder, by station or by recent, filtered by station, with a pin that puts a subject on the desk). The five desk subjects also sit in the top bar on every screen, so switching between them is one press.
- **Research is quiet by default.** On the subject page it is three things he now understands, a place to ask, and one line about the facts Claude checked. A topic opens as one calm page to read. Anything that wants a decision waits under "Decide", one at a time, and every one can be left. Sources and how Claude looked are a third view. The claim bands, Scout, positions and the receipt from the first pass are no longer on screen.
- **Write shows two notes beside the page, not four,** and the read-through ends with one button.

**Third pass on D.** Adrian liked the Home and asked for more control over it, and said Research was still too large on
the page and not organised.

- **Slim type.** Six sizes only across D (12, 13, 14, 15, 18, 22), one interface face, Lora only for spoken words. Write keeps its accepted page geometry.
- **Home: drag, tags, real folders.** Desk cards and rows reorder by dragging. Dragging a row onto a folder moves the subject, with Undo. Subjects carry tags, and Everything can be grouped by folder, tag, station or recent. Each folder shows its path, because folders on screen are the real folders on disk.
- **Research organises itself.** Groups down the side (a group is a real folder too). "Made for you this week" lists topics Claude opened from his work, each saying where it came from: a conversation, a fact check, things he saved, his note. He can let one go or accept a suggested group; nothing is required. "New topic" lets him start one and add sources himself.
- **A research group is a notebook tied to the work.** Sources on the left (tick the ones it answers from, add anything), ask in the middle with cited answers and a plain statement of what the sources cannot answer, and on the right the topics inside, what was made from it, the subjects that use it, and how the group works (how often it looks, voices it trusts, viewpoints), which he can change.

Open-source work his own i64os survey already looked at for this pattern: Open Notebook and SurfSense (self-hosted notebook tools), STORM and GPT Researcher (viewpoints and wide reading, already mirrored by the i64os Hunt). Nothing has been evaluated or chosen in this round.

**Fourth pass on D.** Adrian asked whether Simmer is needed as built, and for sections he can tell apart and jump between.

- **Simmer is not a section.** The strip is gone. The board is now a second view of Gather ("List" or "Board") where material can be dragged between groups, and naming the dish moved into the plan.
- **Plan** sits at the top of every subject: the form, where it goes, who it is for, when, and the dish in his own words, with "Talk about it". On a new subject it says nothing is decided yet.
- **To the finish line** shows, per piece, what is done, what can be done now and what is waiting on what (captions wait for photographs; the Carousel waits for words and pictures; publishing waits for consent and the check). Work in any order; the line only says what must exist first.
- **Sections are separate panels** with a header that stays in view while reading, and the line on the left jumps to any section and marks the one on screen.
- **Home:** folders themselves can be dragged into a new order, and dragging works in the covers view too. Tags plus folders are enough; no folders inside folders.

**Fifth pass on D.** Adrian said the sections showed him things without telling him what to do, and that working out the
interface took the energy the work should get. The subject page was rebuilt around that.

- **Forms are plug-ins.** Article for the magazine, Carousel for Instagram and so on. Each brings its own steps and his template for it. They sit in a row he can drag into order; the page walks him through the first, then the next. "Add a form" lists the others with what each needs.
- **The steps are the page.** One list of steps to the finish line on the left, grouped under Gather, Research, Simmer, Create and Share. On the right, only the open step, with its tool. Done steps are one line; a step that waits says what it waits for. Steps shared by several forms are done once.
- **Simmer has a proper place:** the step "Name the dish". It shows what Claude noticed keeps coming back, the feeling checks (true for him, or borrowed), the dishes it could become (choosing one adds that form), and the dish in his own words, with the full board one press away.
- **Templates are chosen where they are used.** In the Carousel's "The slides" step, each slide has its template (Night bleed, Words only, Photo above, Field note) and its photograph.
- **A single ring** in a fixed spot replaces the four dots on Home and on every form.
- The sentence "It stands in Create. Next: read Claude's draft" is gone; the current step is simply the one that is open, named in plain words.

Corrections to A, B and C that D carries: the mode is Write (not Edit); no accept button on each drafted paragraph; no
"Video, not started" row.

## What is here

| Folder | Direction | In one line |
|---|---|---|
| `a-the-board/` | A. The board | Today's frame finished: the sidebar becomes a path, Home a desk of subject cards, the Subject board the centre of each subject |
| `b-the-path/` | B. The path | No sidebar. Each subject is a line with four stations (Gather, Develop, Make, Deliver); Home shows the lines side by side, a subject page is its line upright |
| `c-the-work/` | C. The work itself | No bars. Subjects are covers, pieces are shown large, a floating dock carries the controls, proposals arrive as changes marked in the writing |
| `d-four-stations/` | D. Gather, Research, Create, Share | The second round: one direction, with Research and Simmer drawn in full |
| `kit/` | Shared | The invented story, the palette and Graphite controls copied from the app, generated pictures, and the small behaviours (answer, accept, Undo, capture) |

Each direction has five screens, reached by clicking or from the dashed strip at the top (the strip is not part of any design):
Home, the subject page, a brand new subject, Write with a source beside the words and proposals waiting, and Write in plain focus.

**Sixth pass on D.** Adrian asked for his real Carousel templates, far more choice and interaction on a slide, a way to
keep making templates, a look per brand, and less chrome so the work has the room.

- **His own 59 layouts.** The slide step and the new slide studio draw from the Carousel layouts AR Create already keeps (the Instagram system canvas), in the canvas's own twelve rows: Covers, Photo beside words, Plates and bands, Full photo with a box, Several photographs, Chapters and numbers, Full picture, Single posts, The three jiā, Closes, and the two earlier rows. `make-slides-data.mjs` builds `d-four-stations/slides-data.js` from that catalogue; nothing was redrawn.
- **The slide studio** (`#slides`). Filmstrip on the left, the slide large in the middle, and one panel with four tabs: Layout (the ones that suit this slide first, then all of them), Photographs (each place on the slide), Add (logo, marks and graphics that can be placed and dragged) and Words. "Mix the layouts" gives a different varied set so a Carousel never repeats itself.
- **Templates keep growing.** "Save as a template" keeps a slide's layout and whatever was placed on it. "Make a layout" asks Claude (or any assistant) for three new layouts drawn inside the current look; each can be used or saved. Saved ones show under Yours.
- **Looks, one per brand** (`#look`). Colours, type, logo, marks and graphics, rules, templates and the account it posts to, shown as the real folder it would be on disk (`Brands / <brand> / Look`). The same layout is drawn in any look. Each look brings its own assets: the seals and Chinese characters belong to Teajiā alone, and Art and Mandala show their own marks instead. A brand with no look yet says so and offers three ways to start one.
- **A tint per brand.** Inside a brand's subjects the top bar, the ring and the current step take that brand's colour, and folders on Home carry the same dot.
- **More room for the work.** The subject's top is one line, forms are small pills, and the steps list is narrower. The Research rail is slimmer and folds to one control on narrow screens. No page scrolls sideways at any width.

**Seventh pass on D.** Adrian wants to drive most of this by speaking, with a code on every design, accounts apart
from looks, and room to keep growing.

- **A code on every layout.** The row's letter and its place: C1 to C4 covers, S side by side, P plates, B box, M several photographs, N chapters and numbers, F full picture, A single posts, J the three jiā, E closes, Y and Z the two earlier rows. A saved or made layout takes the next free number in its row. The canvas's own number stays as the key underneath.
- **Say it.** One line in the slide step and in the studio: "use C1, 2 and 5", or "C one, M two and five, then E two". It builds the Carousel from the codes. Anything else is answered with a note, because nothing is generated in the mock-up.
- **Accounts are separate from looks.** A look can post to several accounts (Mandala to Mandala Codes or Technician of the Sacred) and the account is chosen per post.
- **What Claude knows you like.** Favourites (a star on any layout) and a short list of habits on each look's page. Favourites come first when it suggests layouts.

`BUILD-PLAN.md` lists what is still not drawn, what the app cannot do yet, and how a build would run.

Teajiā's colours, type and rules are from his Instagram guide. The Art look uses the values AR Create already holds for
his art site. Mandala's colours and every drawing other than the wordmark and seals are stand-ins.

## How to look

Open `index.html` in a browser, or any direction's `index.html`. They are static pages; no server and no build is needed.
The fonts load from `runtime/public/assets/fonts`, so open them from inside the repository.
`build-shareable.mjs` packs one direction into a single file with everything inlined, for sending.
`kit/fonts/` holds small cuts of the four slide typefaces (Caudex, EB Garamond, Shippori Mincho, Noto Serif TC; all under the Open Font License), with only the letters and characters the mock-ups use.

## The story (all invented)

One tea subject, "Mrs. Oda's shaded garden": a 42 minute recording with a two-speaker transcript, three notes, six
photographs, half an Article ("Twenty days of shade") with two proposals waiting, a five-slide Carousel, and one question
that needs Adrian. Four other subjects at other stages, and one published. Photographs and slides are drawn shapes.

## Rules of use each direction shows

- The subject's name is on every screen.
- A new subject opens as itself with one first step (Add material, or Start writing).
- Article, Carousel and Video are always listed together; Write means the writing.
- One list of sources, shown the same on the subject page and beside the writing; attaching takes one press, with Undo.
- Every screen offers the next step.
- Accepting, putting away and answering can each be undone where it was done.
- All twelve sections stay reachable: in A under the path in the sidebar, in B along the line beside each station, in C from "Sections" in the dock.
- A tool that is not connected says so where it is met, quietly (Video, posting).

## Rough size to build

Judged from how the look modules sit on top of the existing markup (`docs/product/LOOK.md`).

- **A: medium.** The frame, rail, Home and Subject board exist; this restyles and refills them and needs plans 1 to 3 for the data.
- **B: large.** The sidebar goes, so navigation moves, and the subject page becomes a new screen that gathers parts of all twelve sections.
- **C: largest.** New navigation (crumb and dock), covers that need a lead picture per subject, and proposals marked inside the writing, which touches the editor.
