# Use and interface review, 10 November 2026

A review of AR Create as someone would use it, made on the demo (`npm run demo`, invented data) at desktop (1440), 1000 and phone (390) widths, in light and dark. Part 1 follows one piece of work from a new subject to a Carousel and Share. Part 2 lists what the screens look like. Adrian asked for Part 1 to be fixed first.

Nothing here is fixed yet. Each item says how it was seen. Items marked "demo only?" may come from the demo's fixture and need checking against a real subject before any fix.

## How it was checked

- The use journey was walked as the author (the page's default author), because an agent actor cannot save writing. It ran only on the demo's disposable folder.
- The screen survey was walked as `agent:claude-code`.
- The demo has no AI connected, no recordings and no photos, so transcripts, research answers, AI proposals, photo placement, downloads and the final consent answers were not exercised.
- The installed app and real subjects were not opened.

## Part 1: use and connection

### What already works

- Typing in Write saves by itself and is still there after a reload.
- A reload returns to the same subject and screen. Browser Back steps back one screen at a time.
- A Carousel made from the writing picks up the title and paragraphs as slides. Arrange shows the slides in templates and Audience shows a preview.
- Audience links straight to the step that fixes each gap ("Edit words", "Check", "Save in Arrange").

### Losing your place

1. **A new subject drops you in Library.** New subject, name, Create project: the app opens the general Library under "All subjects". Nothing on screen names the new subject or says what to do next. Opening its row on Home, or "Continue where you left off", does the same. The subject does exist: Write in the sidebar opens its empty page. Seen at desktop and phone.
2. **Library and Material forget the subject.** Opening Library or Material switches the top bar to "All subjects". Going on to Research from there opens Research with no subject ("Back to work"). Media did this for a new subject and not for the demo's built-in one.
3. **The Article disappears once a Carousel exists.** In the article the piece tabs read Article, Carousel, Video. In the Carousel they read Carousel, Video. From then on Write in the sidebar, Write in the finder, "Continue where you left off" and "Edit words" in Outputs all open the Carousel's slide words. The only ways back to the article are Share, "Working manuscript", or Piece tools, "Back to writing". Outputs lists the Carousel and not the article.
4. **The Carousel's words screen is titled Write while the sidebar lights Arrange.**

### Material does not carry through

5. **Adding material gives no confirmation.** A file chosen in Material appears in the list with no message.
6. **Attaching material to a subject is hidden.** Open the item, find "Use in a subject" at the bottom of the right column, press the subject, then confirm Add.
7. **After attaching, the link is counted twice and does not open.** "Used in" shows 2, the second row is labelled only "Subject", and "Open in Source" does nothing.
8. **Attached material shows in one place and not the others.** The subject's Source says "No sessions to read yet" (it lists recordings only). Research says "No sources are connected to this subject". Write's side panel does list it, labelled with internal text: "current-parent-material-source-words-not-editorial-instruction-or-verified-evidence · provisional context".
9. **Source is two different things.** From Write it opens a narrow side panel ("Subject sources · not connected. Unsupported original project."). From anywhere else it is a full page.
10. **Research cannot be asked anything in the demo, and does not say why.** "Explore question" stays off with no reason shown. On the demo's built-in subject the page shows "Shared notes belong to another subject or need reconciliation." Demo only? The research record answers "conflict" in the demo.

### Buttons and messages that mislead

11. **"Save direction" on the empty Direction screen opens the form.** Nothing is saved by it.
12. **Check answers in internal terms.** "Checks held", "Splits", a receipt id, a long hash, "No captured SRC available". It says "Capture the source transcript before checking" with no link to where that is done, and does not say in plain words whether the writing passed.
13. **Carousel slides are pre-filled oddly.** Every slide's heading starts as the subject name. The page shows "Output r0" and "Selected output wording current".
14. **Home reports a fault after a new subject exists.** "Optional suggestions could not be read for 2 subjects", with a script error behind it.
15. **The new subject form opens at the bottom of Home**, below the list, away from the button. It says "Project name" and "Create project".

## Part 2: how the screens look

### Broken

- Research leaves a strip on its left where the screen underneath shows through (all desktop widths, both themes).
- The Check, Understanding and Thought panels cover the Write buttons and the page. At 1000 the panel hides half the writing.
- Share: the "Not applicable" box edge is cut by its buttons. "Open Share anyway" shows a line in an unstyled font and a Feedback block floating mid-page.
- Home: the "Pick up here" preview joins paragraphs with no space.
- Text size (A+) enlarges part of the side panel and the top bar and not the rest.
- At 1000 the Margin button's icon is misaligned. At phone width Source's title sits tight under the top bar.

### Inconsistent

- Each screen places its title at a different position and size, and its actions stop at a different right edge. Research is a narrow centred column. Outputs has two buttons floating above its title.
- Menus (Piece tools, the "+" menu, More, the finder) are rows of heavy filled slabs. The "+" menu lists Close and Back beside the piece kinds. More has two groups both called "This piece". The finder repeats "Tool · current project" on twelve rows.
- Home's subject rows are heavy blocks with the "..." outside. The filter field has a double edge.
- Native dropdowns do not match the buttons.
- Media shows table headings, "Select all" and "Clear" over an empty list.
- Wording: subject and project are mixed; "Back to work" beside "Back to Write"; "Refresh Collections" beside "Open collections".

### Phone

- The top bar takes two rows (96px) on every screen; with the bottom bar that is 154 of 844 pixels.
- Audience, Arrange, Outputs and Media scatter their actions over several rows, some as unlabelled icons.
- Library and Source sit under Develop, Material is not in the bottom bar, and nothing is lit while in Library.
- Several fields and dropdowns are 20 to 32px high.
- The "Piece direction" line is cut off.

### Measured

- Dark theme: text contrast is fine apart from the "Piece direction" line (4.15:1).
- Light theme: the sidebar group labels (9px, 4.2:1), the "Piece direction" line (3.8:1) and the small counts (3.9:1) fall under 4.5:1.
- Keyboard focus is visible (2px sand outline).
- No screen scrolls sideways at any of the three widths.
- The full test suite passed on the starting commit before any change.
