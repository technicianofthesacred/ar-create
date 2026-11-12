# Write, Read and Check in version two: notes for Adrian

A static mock-up, invented content only (the demo's tea subject "Straw over the rows", with the sample's Mrs. Oda and
her shaded garden). Open `index.html` from inside the repository (the fonts come from `runtime/public/assets/fonts`).
The dashed strip at the top is not part of the design: it lists every screen and says what a picture-only button
would do. Every screen is also reachable by its address, for example `index.html#check`. Pictures are in `pictures/`.

## The shape, in one sentence

One page per piece, with Write, Read and Check as three ways of looking at the same words in the bar above it,
because the words never move and he never loses his place: only what sits beside the page changes (sources and
proposals for Write, nothing for Read, findings for Check).

Above the page, one bar holds everything about where he is: back to the subject, which piece (Article or Carousel),
which way of looking (Write, Read, Check), whether it is saved, and the few tools for writing. Each piece remembers its
own way of looking and its own place. Navigation is plain words with a line under the current one, never pills.

## The screens

| Address | What it is for | What changed from the approved sample, and why |
|---|---|---|
| `#start` | An Article with nothing written. Shows his own sentences, gathered from his voice memo and notes in the order of his plan, with Start from your own words, Speak and Type. | The sample started from Claude's dim draft that he had to rewrite or mark Not me. I chose a first draft made only of his own words: he owns it from the first second, and nothing in it is an assistant's prose. Mrs. Oda's words stay in Sources to be quoted. |
| `#write` | Writing, with sources on the left (recording, transcript, notes, photographs, research) and proposals on the right. | Same three columns. Each proposal now says who made it and from what, shows what it would change (struck and added words), and has three plain choices: Use it, Change it first, Leave it. Undo is on every choice. "Still to write" lists his plan's parts with Write and Speak beside each. His prose is in Lora. |
| `#select` | A few words selected: Keep exact, Ask for another way, Note to self. | New. Keeping words exact is one press on the words themselves; kept words carry a hairline and a small lock (never colour alone). On a phone the three choices take the place of the bottom bar, under his thumb. |
| `#proposal-edit` | Change it first: the proposal opens inside his text, editable, with Put it in and Cancel. | New. The sample only had accept or dismiss. |
| `#quote` | Quoting a source: Quote on a transcript line puts her exact words at the cursor, in quote marks, with the time they were said. | New. On a phone the page stays on top and the sources fill the lower half, so both are seen at once without a layer over the page. |
| `#speak` | Dictating. His words appear grey and italic as they are heard, then settle as his words. Stop is where Speak was. | New. Speak is the one dark button on every Write screen and the middle of the phone bar. |
| `#history` | Earlier versions: every change with who made it (You typed, You spoke, You used Claude's words), Look, and Bring this back. | New. Bringing one back keeps today's words as a version too, so nothing he wrote is lost. Undo stays in the bar for the last change. |
| `#focus` | Only the page, Saved, Speak, and Leave focus. | Same idea; the bar is smaller and Speak stays. |
| `#read` | The piece as a reader sees it: the lead photograph, no marks, no margin. Click a paragraph for Change this or Note to self. It ends with Next: Check. | The sample had no Read. Read is quiet on purpose; the one way back into writing is from the paragraph he is looking at. |
| `#read-working` | Claude checking quotes while he reads: one line in the bar with Stop. Nothing on the page changes. | New. |
| `#check` | What Check found, in plain sentences, each one marking its words in the text and offering the next step (Go to it, Show the note, It's what I know, It's mine now, Rewrite it). Below, what matched. | The sample had no Check. Four kinds of finding: a source says otherwise, nothing in his sources supports a claim, a sentence is still Claude's, a part is unwritten. Quote matches are listed quietly underneath. |
| `#carousel` | The Carousel's words: post text, then each slide's picture beside its words, with a note when words do not fit the layout. Proposals on the right; Open the slide studio for layouts and photographs. | The sample put the post text in a step on the subject page. Here the Carousel's words sit in the same place and shape as the Article's, so moving between them is one press on Article or Carousel. The studio keeps layouts, photographs and marks; words are written here and shown there. |
| `#finish` | Nothing left to look at, then Mark the Article finished, then Go to Share (Your yes, then Publish). | New. Finishing keeps the words as the first edition; a later change makes a second edition and the first stays as it was. |
| `#conflict` | The same paragraph changed on his phone and here: both shown in the page with what differs, Keep this one under each, or Keep both. | New. Never last-write-wins; the one not kept stays in Earlier versions. |
| `#recovered` | Words kept on this device when the app closed: shown in place, with Put them back or Leave them out. | Replaces the old "Recover writing (1)" button, which showed even on an untouched piece. It appears only when there is something to recover. |
| `#save-failed` | The app is not answering: "Not saved yet" in the bar, Try again, and the changed paragraph marked. He can keep writing. | New. Saving otherwise needs no thought: "Saved 14:06" is all he ever sees. |

The way back: the first thing in the bar is the subject's name with an arrow. It returns to the subject page with
The words (or the Carousel's step) open where he left it. The top bar and its desk chips are version two's own.

## How the screens answer Adrian's five reactions

1. **"I'm having to sort your words with my head."** His words, Mrs. Oda's words and Claude's proposals sit in three
   different places (page, left, right), each on its own surface; marks in the text are a hairline, a lock or a small
   number, never a label or a colour alone.
2. **"Multiple buffers and barriers reduce the text."** The page is one paper surface with no boxes inside it; the
   prose column is 660 pixels wide and Read takes the whole width; side columns have no frames.
3. **"They should not be pills to navigate."** Article, Carousel, Write, Read and Check are plain words with a line
   under the current one. The only rounded button is Speak, which is an action, not a place.
4. **"I don't want multiple nests to click through."** Everything opens in place: a proposal opens inside the text,
   sources open beside the page (the lower half on a phone), Check marks the words where they are, two versions sit in
   the paragraph. The one exception is the small selection bar over selected words (see below).
5. **Plain words, obvious next step.** Every screen has one dark button for the likely next step (Start from your own
   words, Use it, Next: Check, Mark the Article finished, Go to Share), and the buttons say what they do.

The promises about his words, as the screens keep them: an assistant's words appear only beside his and enter the text
only when he presses Use it or Put it in; every change in Earlier versions names who made it; a conflict shows both
versions and he chooses; recovered and unsaved words are kept and shown, never dropped.

## What the machinery must do to make this real

Marked **exists today**, **small** or **large**, judged from `docs/CAPABILITIES.md` only.

1. A version two screen that opens one named piece (Article or Carousel) of one subject, with the way of looking in the address. **Small** (`study-draft.read`, `magazine.working-draft.read` exist; the screen is new).
2. Write must open the piece he came from, not the last one opened (the walk's finding R3). **Small**.
3. Typing saves by itself with a revision check, as Adrian. **Exists today** (`study-draft.save`, `magazine.working-draft.edit`, human only).
4. Undo of the last change. **Exists today** (`study-draft.undo`, `magazine.working-draft.undo`).
5. Earlier versions listed with who made each change, Look, and Bring this back as a new version. **Small** (`study-draft.history-preview` and `history-restore` exist; the list with authors per change needs a read).
6. Words kept on the device after a crash, offered only when there are some. **Exists today** in Advanced (`study-draft.recover`, `root-recovery`, `recovery-storage.js`); showing it only when needed is small.
7. A failed save keeps words on the device and retries. **Small** (the same recovery storage).
8. A conflict shown per paragraph with both versions kept until he chooses. **Large** (stale saves are refused today with 409; merging by paragraph and showing both is new).
9. Proposals beside the page with Use it and Leave it, and a left proposal not offered again. **Exists today** (`magazine.working-draft.ai.propose`, `.accept`, `.reject`).
10. Change it first: open a proposal in the text and put in his changed version. **Small** (an accept with his edited words, or a save after accept).
11. Knowing which sentences are still an assistant's unchanged words, for Check. **Large** (needs the origin of each sentence kept through edits).
12. Keep exact on selected words, refused to assistants. **Exists today** as a human-only decision in Advanced; the command name was not visible in the list, so this needs confirming.
13. Quote a transcript line at the cursor, linked to its time, and kept exact. **Small** (`study.source-context` and transcripts exist; the link from quote to time is new).
14. Sources as one list beside the writing, with the recording playable from a line. **Small** (`study.source-context`, `study-originals.audio` exist).
15. Start from your own words: gather only his own sentences from his memos and notes, in the order of his plan. **Large** (needs speaker labels he has confirmed, and an assistant or a plain rule to place each sentence under a part; needs an AI provider if done by an assistant).
16. Speak: dictation into the page as his words. **Large** (needs a speech to text engine).
17. Check: every quote against its source. **Exists today** in part (`study-draft.check`, `magazine.mechanical-check`).
18. Check: a claim that nothing in his sources supports, and a note that says otherwise. **Large** (needs an AI provider; the research records exist).
19. Check: each finding linked to its words in the text. **Small**.
20. An assistant working while he reads, shown in one line with Stop. **Exists today** (`presence`, `events.since`, `leases`); Stop is small.
21. Mark the Article finished, keeping that text as an edition, and moving the subject to Share. **Small** (`study.outputs`, exports and consent exist; the finished mark may be new).
22. The Carousel's post text and slide words written here and shown in the slide studio as the same words. **Small to large**: `instagram.plan.post` and `instagram.captions` exist, but slide words are read-only in version two's studio today.
23. Whether a slide's words fit its layout. **Small** (`instagram.render`, `instagram.preview` exist).
24. Proposals for the Carousel's words. **Exists today** (`shared-carousels.propose`).
25. Back to the subject at the step he left. **Exists today** in version two's router.
26. Phone: the writing bar (Undo, Speak, Sources), the sources in the lower half, proposals under their paragraph. **Small** (layout only).

## What I am least sure of

- **Lora for his prose.** The brief asked for Lora for his prose and spoken words; the app today shows the manuscript in sans. The article title (32 pixels, 28 on a phone) is the page's own type and sits outside the six interface sizes.
- **Start from your own words.** It depends on knowing which sentences in a recording are his, and on there being enough of them. With little material it may look thin; Speak and Type are always beside it.
- **Check's "still Claude's" finding.** It is only honest if the app really knows a sentence's origin after edits (item 11).
- **The selection bar** is a small layer over the text. It is the one place something sits on top of his words; on a phone it moves into the bottom bar.
- **Between 1100 and 1280 wide** the three columns are tight; below 1100 the sources replace the margin when opened.
- **Read for a Carousel** and **Check for a Carousel** are named in the bar but drawn only as notes.
