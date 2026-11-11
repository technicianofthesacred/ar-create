PIECE 4, SUBJECT. Read /tmp/briefs/v2-common.md first and follow it, then public/v2/README.md in your worktree. You edit ONLY public/v2/screens/subject.js and subject.css, plus new tests. If you need something the shell lacks, say so in your report instead of changing shell files.

Build the subject page the owner approved in the mock-up (#subject and #new-subject, fifth pass onward), on real records. He must be able to tell what to do next without reading instructions.
1. Header, one line: the subject's name, its look chip (only if the records say which look it uses), its folder path, and its direction sentence cut to one line with Change (the direction is the subject's human direction; changing it is his alone, so Change opens the place where he writes it; assistants never write it).
2. Forms in order, as small pills: one per piece the subject has (Article, Carousel, and whatever piece kinds the app has: read how pieces are listed and created in the existing workspace and its commands), each with its ring and "n/m", the first marked as first. Drag to reorder with Move up and Move down; if the records have nowhere to keep a hand-set order of pieces, keep the order the app gives and report it rather than storing it in the browser. "Add a form" offers the piece kinds the app can really make, each saying what it needs; kinds the app cannot make yet are not offered.
3. Steps for the chosen form, grouped Gather, Research, Simmer, Create, Share, each with a state (done, now, needs a look, to do, waits for something) worked out from the records, and for a waiting step what it waits for. Map the app's twelve sections and their checkpoints onto these steps (read combined-navigation.js, checkpoint-rail.js and the section briefs in docs/product/sections/); every one of the twelve sections must be reachable from some step, because every plan says so. Put the mapping in one pure function with tests. The page opens on the first step that needs him.
4. One step open at a time, beside the list on a computer and inline under its row on a phone. For each step, either a small real tool or an honest hand-off:
   - What you have: the subject's sources and photographs, read-only list with counts, and Capture (the existing ways to add a recording, note, link or photographs).
   - The transcript: words waiting to be confirmed, if the transcript-check commands expose them; else Open in Advanced.
   - The facts: findings and their state from the research commands, with the one that needs him first.
   - Name the dish (Simmer): what the Simmer board holds and the dish he named, with Open the board in Advanced.
   - The words: the piece's parts and how far each is, with Write opening the approved Write for that piece in Advanced.
   - The slides: for a Carousel, the strip of its slides drawn by `instagram.render` with their codes, the say-it line (`instagram.plan.codes`), and Open the slide studio (route to the Slides screen with the plan id).
   - Her yes: who is named and shown and what has been asked, from the consent desk commands; drafting a request is allowed, recording consent is his alone.
   - Publish or Post: what it still waits for, each with a link to that step.
   Anything else: a one-line state and Open in Advanced, using the shell's helper so it lands on the same subject, piece and section. Never a dead control and never invented content.
5. A brand new subject shows "Not decided yet" for forms, one first step (What you have, with the ways to add material), and "Name the dish" waiting.
6. When an assistant changes something while the page is open, the step states update without a reload.

Pictures into /tmp/shots-v2/subject/: an Article subject and a Carousel subject at 1440 and 390, dark and light, one with a waiting step open, and the brand new subject.
