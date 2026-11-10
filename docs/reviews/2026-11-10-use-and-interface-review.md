# Use and interface review, 10 November 2026

A full record of what a review of AR Create found, written so that any person or agent can continue from here without the chat it came from. The reviewer's job was to find problems and suggest fixes, not to build them. **Nothing in this document has been fixed.**

Adrian's steer on the day: fix how the app is used and how its parts connect first (Part 1), then how it looks (Part 3).

Contents: [how it was checked](#how-it-was-checked) · [the three root problems](#the-three-root-problems) · [Part 1 use and connection](#part-1-use-and-connection) · [Part 2 the agent entrance](#part-2-the-agent-entrance) · [Part 3 how the screens look](#part-3-how-the-screens-look) · [Part 4 working without the Mac](#part-4-working-without-the-mac) · [what works](#what-already-works) · [suggested order](#suggested-order-of-work) · [decisions for Adrian](#decisions-that-belong-to-adrian) · [scouting still to do](#scouting-still-worth-doing) · [function ideas](#function-ideas)

## How it was checked

- On the demo only (`npm run demo`, port 8854, invented data), at desktop (1440×900), 1000×800 and phone (390×844), in dark and light. The branch was cut from `main` on 10 November.
- **Screen survey**: all thirteen sidebar destinations and about thirty panels, menus and dialogs, opened as `agent:claude-code`.
- **Use journey**: walked as the author (the page's default author), because an agent actor cannot save writing. One piece of work was followed from a new subject through material, Write, Check, a Carousel, Arrange, Audience, Share and Outputs. This ran only against the demo's disposable folder.
- **Agent entrance**: the same demo read through `agents/cli/ar-create.mjs` (`status`, `project list`, `project read`, `library search`, `history`).
- The full test suite passed on the starting commit before anything was added (3,650 passed, 0 failed, 14 skipped).

**Not checked.** The demo has no AI connected, no recordings and no working photo roots. So transcripts, transcript correction, research answers, AI proposals and their review, photo placement, downloads and exports, sending, and the final "Yes, release this" were not exercised. The installed app and real subjects were not opened. Rename, archive, delete and Undo were not tried. Items marked **demo only?** may come from the demo fixture and must be confirmed on a real subject before any fix.

**To repeat it.** Start the demo, then:

- `node scripts/review-screens.mjs <outDir>` retakes every screen at the three widths and both themes and writes `report.json` (sideways scroll, clipped text, failed requests).
- `node scripts/review-journey.mjs <name> <width> '<steps>'` runs a few clicks, prints what is on screen and saves a screenshot. It keeps its browser profile between runs, so a journey can be walked one step at a time.

Both need Playwright (`AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs`, as the `tests/*.browser.mjs` files do) and refuse port 8841.

## The three root problems

Most of Part 1 comes from three causes. Fixing the causes is worth more than fixing the items one by one.

**R1. The app does not hold on to which subject you are in.** The subject is a property of some screens and not others. Library, Material and sometimes Media switch the top bar to "All subjects", and the screens you open next inherit that. A newly made subject is never selected at all. Suggested rule: the subject you opened stays selected on every screen until you choose another one or choose "All subjects" yourself, and the top bar always says which it is.

**R2. One subject has several separate lists of "its sources", and they do not agree.** Seen in one journey with one attached note:

| Where | What it showed | Read from |
|---|---|---|
| Library item, "Use in a subject" | Attached to the subject (counted twice) | `/api/first-flow` |
| The subject's Source | "No sessions to read yet" (recordings only) | `/api/source-sessions` |
| Research, "Change sources" | "No sources are connected to this subject" | `/api/study/research` |
| Write side panel, "Sources" | The note, selectable | `/api/study-ai/read` |
| Agent `project read`, `sourceConnections` | Empty | `/api/concept` |

Suggested rule: a subject has one list of sources. Attaching in any place shows in every place, each step may then choose a subset of that list for its own use, and the agent entrance reads the same list.

**R3. A piece is identified by whichever output was opened last, not by what the screen is called.** Once a Carousel exists, "Write" means the Carousel's words, the Article loses its tab, and the sidebar lights Arrange under a page titled Write. Suggested rule: the piece tabs always list every piece of the subject; Write always opens the writing of the piece whose tab is selected; the sidebar highlight and the page title always name the same step.

## Part 1: use and connection

Each item: what happens, how to see it, where the code is, what is suggested, and how to know it is done. Priority A blocks real use, B costs time or trust, C is polish.

### Losing your place

**U1. A new subject drops you in Library. (A, cause R1)**
- Seen: Home, New subject, type a name, Create project. The app opens the general Library under "All subjects". Nothing names the new subject or says what to do next. Opening its row on Home, or "Continue where you left off", does the same. The subject does exist: Write in the sidebar opens its empty page. Same at phone width.
- Where: the form and its submit are in `public/document-study/project-library.js` (`newForm`, `data-pl-create-form`). The Home row and "Continue where you left off" are in `workbench-frame.js` (around line 483). A new subject's status reads "Projects · Material", which is probably why it is routed to Library.
- Suggest: after Create, select the subject and open its own first screen, with its name in the top bar and one clear next step ("Add material" or "Start writing"). Its Home row and Continue button open the same screen.
- Done when: after Create the top bar shows the subject's name; a reload stays there; its Home row and "Continue where you left off" return there; the same at 390px.

**U2. Library and Material forget the subject. (A, cause R1)**
- Seen: open a subject, press Library or Material: the top bar changes to "All subjects". Then press Research: it opens with no subject and "Back to work". Media did this for the app-made subject and not for the demo's built-in one.
- Where: `workbench-frame.js` lines 293 to 294 (`globalLibrary`, the switch label). Research's subjectless form is in `research-tab.js`.
- Suggest: keep the subject selected. In Library and Material show it as a visible scope ("Morning market walk" with a way to switch to "All subjects"), so material added there can be attached to it in one press (see U6).
- Done when: Home, open subject, Library, Research shows that subject's Research; the top bar never changes subject unless the author changes it.

**U3. The Article disappears once a Carousel exists. (A, cause R3)**
- Seen: in a subject with writing, press "+" and Carousel. In the Carousel the piece tabs read "Carousel, Video". In the article they read "Article, Carousel, Video". From the Carousel, these all open the Carousel's slide words: Write in the sidebar, Write in the finder, "Continue where you left off" on Home, "Edit words" in Outputs. The only ways back to the article are Share then "Working manuscript", or Piece tools then "Back to writing". Outputs lists the Carousel and not the article.
- Where: the tabs are built in `combined-piece.js` lines 67 to 74 (`pieces`, `currentTab`, `openReference`). The tab list appears to depend on which output is selected.
- Suggest: always list every piece of the subject in the tabs, in a fixed order. Decide what Write in the sidebar means when a Carousel is selected (see the decisions list). List the article in Outputs beside the Carousel.
- Done when: with an Article and a Carousel, both tabs show from either one; each of the five entrances above opens what its label says; a reload keeps the selected piece.

**U4. The Carousel's words screen is titled Write while the sidebar lights Arrange. (B, cause R3)**
- Seen: as U3. The page header says "Write" with Edit and Read, and the sidebar highlight is on Arrange.
- Suggest: one name per screen. Either the Carousel's words are part of Write (light Write) or part of Arrange (title it Arrange).
- Done when: the lit sidebar item and the page title match on every screen of a Carousel.

### Material does not carry through

**U5. Adding material gives no confirmation. (B)**
- Seen: Material, "Choose files", pick a text file or a photo. It appears in the list with no message. Nothing says where it went or what to do next.
- Where: `material-intake.js`.
- Suggest: a short confirmation naming the item, with the next step beside it ("Use in Morning market walk", "Open").
- Done when: every add (file, link, recording) answers with what was added and one next step, and failures say why.

**U6. Attaching material to a subject is hidden. (A, cause R2)**
- Seen: open the item, find "Use in a subject" at the bottom of the right-hand column under Connections and Organize, press the subject's name, then confirm "Add". The text above it says "Add to piece is not connected here. Use this source through a subject's Source workspace."
- Where: `folder-browser.js` lines 279 to 297.
- Suggest: when a subject is selected (U2), offer "Use in <subject>" on the row and on the add confirmation. Keep the fuller chooser for attaching to another subject.
- Done when: from a subject, a new note can be added and attached in two presses, without opening the item.

**U7. After attaching, the link is counted twice and does not open. (B)**
- Seen: after Add, "Used in" shows 2: one row "Morning market walk", one row labelled only "Subject". "Open in Source" on either row does nothing. After a reload the "Use in a subject" button for the same subject shows again.
- Where: `folder-browser.js` line 290 (`rows`, `names`, `data-wfb-use-open`).
- Suggest: one row per subject, by name. "Open in Source" opens that subject's Source with the item selected. An attached subject shows as attached, not as a button to attach again.
- Done when: attach once, see one row; the link lands on the item inside the subject; a reload shows the same state.

**U8. Attached material shows in one place and not the others. (A, cause R2)**
- Seen: with the note attached, the subject's Source says "No sessions to read yet. Recordings and transcripts you add in Material appear here"; Research, "Change sources" says "No sources are connected to this subject. Add material before exploring a question."; Write's side panel does list it.
- Where: Source empty state in `empty-states.js` line 23; Research in `research-tab.js` line 37; Write's list comes from `runtime/services/first-flow.mjs` around line 110.
- Suggest: the one-list rule in R2. Source shows every attached item of the subject (notes, links, photos, recordings), with recordings keeping their session view.
- Done when: one attached note is visible, by the same name, in Source, in Research's source choices and in Write's side panel, and `project read` reports it.

**U9. Write's side panel labels a source with internal text. (B)**
- Seen: the note is labelled "current-parent-material-source-words-not-editorial-instruction-or-verified-evidence · provisional context". The author's own page is labelled "author-page".
- Where: the `role` value set in `runtime/services/first-flow.mjs` line 110 is printed as it is.
- Suggest: show a plain label ("Your note", "Transcript", "Your page") and keep the role for agents.
- Done when: no hyphenated internal role appears on screen.

**U10. Source is two different things. (B)**
- Seen: from Write, Source in the sidebar opens a narrow side panel ("Subject sources · not connected. Unsupported original project.", "Esc returns to the same line", "Open full Source") and lights both Write and Source. From anywhere else it is a full page.
- Where: the message comes from `runtime/services/study-originals.mjs` line 127 (a subject made in the app has no "original project").
- Suggest: keep reading a source beside the writing, since that is useful, and make the panel show the same list as the full page. Replace "Unsupported original project" with what is true for the author ("No sources attached yet", with "Add material").
- Done when: the panel and the page list the same sources, and neither shows an internal reason.

**U11. Research cannot be asked anything, and does not say why. (B, demo only?)**
- Seen: "Explore question" stays off after typing a question. No reason is shown. On the demo's built-in subject the page shows "Shared notes belong to another subject or need reconciliation." The research read answers 409 in the demo, and for the app-made subject the request carried the other subject's ids (`parentStudyId=hk`), which should be checked for a real cross-subject mix-up.
- Where: `research-tab.js` lines 26 to 37; the banner text is in `human-direction.js` line 98.
- Suggest: a button that is off always says why, beside it. Confirm on a real subject whether Research can be asked, and whether a new subject's Research ever reads another subject's record.
- Done when: either the question can be asked, or the screen says in plain words what is missing and links to it.

**U12. A subject made in the app cannot be given a photo. (A, demo only?)**
- Seen: for the app-made subject, Media shows "All subjects", no "Upload photos" and "No photographs are available in this Media catalog." (the built-in subject shows "Upload photos" and "From library"). A photo added through Material appears in Material. In the Carousel, Arrange, "Choose photo" opens a picker that counts it under "All media" and then fails with "The manuscript photo reader returned invalid source identities. Try again".
- Where: `study-photos.js` line 45, `folder-browser.js` lines 330 and 380.
- Suggest: confirm on a real subject first. If it holds, a new subject needs the same photo collection the older ones have, and the picker error needs plain words.
- Done when: in a new subject a photo can be uploaded from Media or from the picker and placed on a slide.

### Buttons and messages that mislead

**U13. "Save direction" on the empty Direction screen saves an empty direction and opens the form. (B)**
- Seen: Direction with nothing written shows "No story directions yet" with a primary "Save direction". Pressing it opens the form ("What I want this to say") and the history records a direction save with nothing in it. For an agent the same button reads "Write my own angle".
- Where: `human-direction.js` line 58, `piece-state.js` line 92.
- Suggest: label it "Write my direction", open the form, and save only when there are words.
- Done when: opening the form writes nothing to the history.

**U14. Check answers in internal terms. (A for trust)**
- Seen: after "Check saved draft": "Checks held", "Quotes: Held · needs manual review. Capture the source transcript before checking.", "Splits", then "Check details and saved proof" with a timestamp, a receipt id, "Draft SHA-256" and a 64-character code, "Quote output: No captured SRC available.", "Split output". It never says in plain words whether the writing passed, and "Capture the source transcript" does not link anywhere.
- Where: `draft-check-flow.js` lines 35 to 52, `runtime/services/study-draft-checks.mjs` lines 144 and 180.
- Suggest: lead with one plain sentence ("Nothing to compare yet: this piece has no transcript, so quotes could not be checked."), then what to do, with a link. Move the receipt, hash and raw output under "Details".
- Done when: someone who has never seen the app can say after one read whether the piece passed and what to do next. The wording is Adrian's to approve.

**U15. Carousel slides are pre-filled oddly. (C)**
- Seen: every slide's heading starts as the subject name. The page shows "Output r0" and "Selected output wording current".
- Where: `study-output-boundary.mjs` lines 7 to 45, `media-outputs-tools.js` line 12.
- Suggest: leave slide headings empty (or the section heading where there is one). Say "Saved" and, under Details, the revision.

**U16. Home reports a fault once a new subject exists. (B)**
- Seen: the Optional card says "Optional suggestions could not be read for 2 subjects", and the page raises a script error ("Cannot read properties of undefined (reading 'length')") on Home.
- Where: `workbench-frame.js` line 431.
- Suggest: find the script error first; a subject with nothing in it should produce "Nothing suggested yet", not a failure.

**U17. The new subject form opens at the bottom of Home. (B)**
- Seen: the form appears below the subject list, far from the button, at 644px down a phone screen. It says "Project name" and "Create project" under a button called "New subject".
- Where: `project-library.js` line 50.
- Suggest: open it under the button, in the subject wording.

**U18. The app's first screen in a new browser shows "Recover writing (1)". (C, demo only?)**
- Seen: a fresh browser opens on Write of the first demo subject with "Recover writing (1)" already showing, and a new subject at phone width showed it too.
- Where: likely the demo's packaged browser copy (`synthetic-study-data.js`).
- Suggest: confirm it is the demo's seeded copy. If a real new subject can show another subject's recovery, that is a serious mix-up.

## Part 2: the agent entrance

The product promise is that the app and agents are equal entrances to the same records. Three gaps were seen through the CLI on the demo.

**A1. `project list` and the app list different subjects.** The CLI listed only the two subjects made in the app during the review. The app's Home listed four (those two and the demo's two built-in ones). START.md says the list shows only projects that already have a concept. An agent asked "what is Adrian working on" would miss every subject without one. Suggest: one list, with a flag for "no concept yet". Confirm on the installed app how many real subjects are missing.

**A2. `project read` does not see what was attached in the app.** For the subject with the attached note, `sourceConnections` was empty and nothing in the answer mentions the writing, the Carousel or the check. Suggest: the read of a subject should say what exists (sources attached, pieces and their state, last check), since that is what an agent needs to pick up the work. Cause R2.

**A3. History and `library search` do agree with the app.** The note was found by its words, and every app action appeared in the history with its author. These work.

## Part 3: how the screens look

Second in order. Each of these was seen in the survey screenshots.

### Broken

| # | Problem | Screens | Where to look | Suggest |
|---|---|---|---|---|
| V1 | A strip of the screen underneath shows through at the left of Research and Research tools | Research, all desktop widths, both themes | `research-tab.css`, the overlay does not cover `#workspace` | Cover the whole workspace or hide what is under it |
| V2 | The Check, Understanding and Thought panels (380px, fixed) cover the Write buttons and the page; "Recover writing" and "Help" are cut off; at 1000px half the writing is hidden | Write with any panel open | `#wbf-drawer` in `workbench-frame.css` | Narrow the page when there is room; never cover the toolbar |
| V3 | The "Not applicable" box edge is cut by its buttons | Share | `empty-states.css` | Let the box grow |
| V4 | "Open Share anyway" shows a line in an unstyled font and a Feedback block floating mid-page | Share | `share-stage.js`, `workbench-share.css` | Shared type; place Feedback in the flow |
| V5 | The "Pick up here" preview joins paragraphs with no space | Home | `workbench-frame.js` | Join with a space |
| V6 | Text size (A+) enlarges part of the side panel and the top bar title and not the rest | Write and others | `c3-theme.css` | One rule: see decisions |
| V7 | Margin button icon misaligned at 1000px; Source title tight under the top bar at phone width | Write, Source | `combined-piece.css`, `combined-phone.css` | Align; add top space |

### Inconsistent

- **V8. Titles.** Each screen places its title at a different position and size, and its actions stop at a different right edge (1232, 1296, 1328 or 1408px at desktop). Research is a narrow centred column. Outputs has "By kind" and "More" floating above its title. Suggest one header line for every screen: title, subject name, actions on a shared right edge. This moves titles on accepted layouts, so it needs Adrian's yes.
- **V9. Menus.** Piece tools is twenty filled slabs of uneven width. The "+" menu lists Close and Back beside the piece kinds. "More" has two groups both called "This piece" and a white "Save direction" slab. The finder repeats "Tool · current project" on twelve rows. Suggest plain menu rows with a hover highlight and clear group names.
- **V10. Home rows.** Subject rows are heavy touching blocks with the "..." outside them; the filter field has a double edge.
- **V11. Dropdowns** are the browser's own and do not match the buttons (Outputs, Media, Source, Direction).
- **V12. Media** shows table headings, "Select all" and "Clear" over an empty list.
- **V13. Wording.** Subject and project are mixed ("New subject" opens "Project name"; "Filter projects"; "Find a project or tool"). "Back to work" beside "Back to Write". "Refresh Collections" beside "Open collections". "Show this step's tools" is an underlined button.
- **V14. One thing, many names.** Across screens the same piece of writing is called piece, output, edition, manuscript, working manuscript, draft, saved working copy and current draft. A naming pass (see scouting) should come before any wording fix.

### Phone

- **V15.** The top bar takes two rows (96px) on every screen; with the bottom bar (58px) that is 154 of 844 pixels.
- **V16.** Audience, Arrange, Outputs and Media scatter their actions over several rows, some as unlabelled icons.
- **V17.** Library and Source sit under Develop on the phone and under Gather on desktop; Material is not in the bottom bar at all; nothing is lit while in Library.
- **V18.** Fields and dropdowns 20 to 32px high: "Filter projects" (32), "Search sources" and "Search media" (20), the Source, Direction, Media and Outputs dropdowns (32), "Recover writing" (34).
- **V19.** The "Piece direction" line is cut off instead of wrapping.

### Measured

- Dark theme: contrast is fine apart from the "Piece direction" line (4.15:1).
- Light theme: sidebar group labels (9px, 4.24:1), the "Piece direction" line (3.82:1) and small counts (3.89:1) are under 4.5:1.
- Keyboard focus is visible (2px sand outline). No screen scrolls sideways at any of the three widths. Fonts are consistent apart from a few system-font lines (Media hint, Check panel, Share when opened).

## Part 4: working without the Mac

Adrian's goal is for all of this to work without the Mac. Today it does not, and this review ran into that directly: the two most useful pieces of scouting (a real piece from start to finish, and confirming the "demo only?" items) could not be done from a cloud session, because the only copy of his real work is on the Mac. That is a finding, not a scheduling detail. An agent working from the cloud, as this one did, can see the software and nothing of the work.

The product documents already say this is intended and not yet built: "Off-Mac reach waits for the VPS replica" (PRODUCT), and "Private storage and offline direction: planned, not installed" (DEVELOPMENT). What follows is what the review saw of the gap.

### What is not tied to the Mac

The software. In this review the whole app was installed, built and run on a Linux cloud machine: the demo served every screen, and all 3,650 tests passed there. The phone-width layout exists. A scoped remote connection for Claude and ChatGPT (`agents/remote/server.mjs`) exists and passed a sign-in round trip on invented data before it was closed.

### What is tied to the Mac

| # | What | Why it needs the Mac today | Where |
|---|---|---|---|
| M1 | The only copy of the work | Words, journal, recordings and photos live in one folder under the Mac's Application Support; the originals live in the Obsidian vault and Files folders on the Mac | `docs/PERMANENT-HOME.md`, `config.mjs` |
| M2 | Reaching the app | The server answers only on `127.0.0.1`; no other device can open it | `runtime/server.mjs` line 825 |
| M3 | Knowing who is asking | There is no sign-in. The page says it is Adrian, and agent names are "honest labels, not authentication". That is safe only while nothing but the Mac can connect | `docs/START.md`, actors |
| M4 | Unsaved words | Words not yet saved to the project are kept in that one browser on the Mac ("Only in this browser"). Recovery records are per browser tab | `draft-flow.js`, `docs/PERMANENT-HOME.md` |
| M5 | Transcription | Uses `mlx-whisper`, which runs only on Apple chips, plus a local speaker model | `runtime/services/runtime/transcription/adapters.py` |
| M6 | AI help | Runs by starting the Codex command-line tool that is signed in on the Mac. "Only codex is supported" | `config.example.json` (`execution`), `artifact-execution.mjs` |
| M7 | Phone recordings | The Mac goes and fetches them from the phone site. With the Mac off they wait | `docs/PHONE-PICKUP.md` |
| M8 | Agents | The CLI and MCP are "from this Mac only for now" | `docs/product/PRODUCT.md` (Agents table) |
| M9 | Photos and footage originals | In Files folders and iCloud on the Mac; "still downloading from iCloud" is handled as a Finder step | `magazine-vault/intake.mjs` |
| M10 | Releasing and restarting | The release script and start, stop and restart scripts write and run on the Mac | `scripts/release.mjs`, `scripts/permanent-home/` |

Small Mac-only conveniences (open a folder in Finder) already answer politely on other systems and are not blockers.

### What this means for the concept

The promise "the app and agents are equal entrances to the same records" holds only on the Mac. Away from it there is no entrance at all: not for Adrian on a phone, not for a cloud agent, not for another computer. The phone layout and the remote connection are built and waiting behind M1 to M3.

### Suggested shape (for a builder to plan, not decided)

The agreed direction in DEVELOPMENT is "private text and revision metadata available on the VPS and computer replicas, with offline computer editing; large originals primarily on explicitly selected computers". i64os already runs an always-on VPS, a private network between the machines, and folder sync that copies the vault to the VPS. Reusing those is cheaper than inventing new ones.

1. **Decide where the one true copy lives when the Mac is off.** The app has a firm one-writer rule. Two workable shapes: the always-on server becomes the home and the Mac becomes one of its clients; or the Mac stays the home and the server holds a read-and-propose copy. The first gives "works without the Mac" completely; the second is smaller and still leaves writing tied to the Mac. This is Adrian's decision and everything else follows from it.
2. **Put a real sign-in in front of it** before anything but the Mac can connect (M2, M3). The remote connection's sign-in already exists for agents; the author's own browser needs one.
3. **Save in-progress words to the home, not the browser** (M4), so a piece started on one device can be continued on another.
4. **Give transcription and AI help an engine that runs anywhere** (M5, M6): a hosted speech service for the first pass (the phone and i64os already use one) with the Mac's better pass as an optional improvement, and an AI provider called directly instead of through a signed-in command-line tool.
5. **Photos and footage**: previews everywhere, originals where they are, and an honest "original is on the Mac" state.
6. **Backups and restore** proved before the home moves.

### pCloud or iCloud as the place for the work (asked 10 November)

Adrian asked whether the work could live in iCloud or pCloud, since pCloud already syncs his phone and computer, and whether that rules out the VPS.

**What is already true.** pCloud is in use today. The Files folder syncs both ways with pCloud, and the magazine intake reads a Drop folder that the pCloud phone app uploads into (`editorial/stages/mag/intake.md`). iCloud is used for shared albums and a second drop folder. The vault reaches the VPS through Syncthing, which does not include the phone (i64os `docs/SYNC.md`).

**pCloud does not rule out the VPS.** pCloud's desktop app needs a screen, so it will not run on a server. But pCloud has its own web interface for programs and is a supported storage in `rclone`, a standard server tool that can list, copy and sync a pCloud folder. The one wrinkle is that the first sign-in has to be done on a machine with a browser and copied to the server. Not tested in this review (no account was available). iCloud is the weaker choice for a server: it has no official server access, and the unofficial route through the same tool needs a setting on the iPhone and a fresh sign-in about every 30 days.

**The risk: a sync service must not hold a running app's working folder.** Sync tools know nothing about the app's one-writer rule. They replace a file with whichever copy they believe is newer and make "conflicted copy" files when two devices change the same thing. This has already happened once: on 2 October 2026 pCloud put a June copy over the i64os store on the laptop, and captures from June to mid September were missing until a backup was restored (i64os `todo/archive.md`). AR Create's rule is "never last-write-wins; keep both versions", which a sync tool cannot honour inside the app's own records.

**Suggested shape.** Use pCloud as the carrier for files a person would recognise, and keep one running app as the only writer of its working records.

- In: recordings, photos and notes dropped from the phone or computer into pCloud folders. The app collects them (it already does this for the magazine Drop folder).
- Out: finished articles and carousels, readable copies of each piece, and backups, written by the app into pCloud so they appear on the phone and computer.
- Not in pCloud: the app's live data folder (journal, revisions, leases, proposals).
- With the app running on the always-on server and reading pCloud through `rclone`, the loop phone, pCloud, server, pCloud, phone works with the Mac switched off. Editing from the phone is then done in the app's own phone screens on the server, behind a sign-in, not by editing files in pCloud.

**Also worth knowing.** With Adrian's permission, a read-only pCloud key would let a cloud agent see real material without the Mac. That is the access this review lacked.

**Scouting for this.**
- On the VPS: sign `rclone` in to pCloud, list the Drop folder, and time how long a phone upload takes to arrive.
- Sort AR Create's data into "files a person would recognise" and "working records", to draw the line above exactly.
- Check whether any needed folder is a pCloud Crypto (locked) folder; server tools may not be able to read those.
- Check pCloud's file history length on Adrian's plan; it is the safety net if a sync goes wrong again.
- Check that pCloud is reachable from every place Adrian works, including China.

### Scouting for this part

- **Inventory what the installed app actually reads from the Mac**: every folder and tool named in its private configuration, and how big each is (text, recordings, photos). Names and sizes only, no content. This sizes the move.
- **Run the app on the VPS with invented data** behind the private network and open it from a phone. This review already did the equivalent on a cloud machine; doing it on the real server shows what breaks in sign-in, speed and phone use.
- **Try the one-writer rule with two devices**: the same piece open on a laptop and a phone, both typing. What does each see?
- **Away from a connection**: what should work on a train with no signal, and what may wait?
- **What agents need off the Mac**: which of the 473 commands a cloud agent should have, and which must stay with Adrian's own sign-in.

## What already works

Keep these as they are when fixing the rest.

- Typing in Write saves by itself, and the words are there after a reload.
- A reload returns to the same subject and screen. Browser Back steps back one screen at a time.
- A Carousel made from the writing picks up the title and paragraphs as slides. Arrange shows them in templates. Audience shows a preview.
- Audience names each gap and links straight to the step that closes it ("Edit words", "Check", "Save in Arrange").
- Share's "Before you release" holds until both questions are answered, then says "Ready. Nothing is holding the release."
- Material accepts a text file and a photo, and marks an attached item with its subject.
- The history records every action with its author, and `library search` finds material by its words.

## Suggested order of work

1. **R1, the subject stays selected** (U1, U2, U17). Small, and everything after is easier to test.
2. **R3, pieces and Write** (U3, U4). Needs Adrian's answer on what Write means inside a Carousel.
3. **R2, one source list** (U6, U7, U8, U9, U10, A2). The largest piece. Start by writing down which of the five lists is the truth and how the others should read from it. It touches runtime services, so it needs its own plan and tests.
4. **Plain words** (U5, U13, U14, U15, U16). Small each; U14's wording needs Adrian.
5. **Confirm the "demo only?" items on a real subject** (U11, U12, U18, A1) before spending effort on them.
6. **Part 3**, broken first (V1 to V7), then phone, then the shared header and menus.

Part 4 runs beside all of this as its own stream. It starts with Adrian's decision on where the work lives, and it should not wait for the screens to be finished: until it is done, no agent outside the Mac can check any of the above against real work.

Each fix should end with a check of the journey in Part 1 from start to finish, since these problems only show when the steps are joined up.

## Decisions that belong to Adrian

1. Where a new subject opens: its empty Write page with "Add material" and "Start writing" (suggested), or the Subject board.
2. What Write in the sidebar means when a Carousel is selected: always the article (suggested), or the selected piece's words.
3. Source from Write: keep the side panel and make it show the same sources as the full page (suggested), or always open the full page.
4. The plain-words Check result. It is his screen's voice.
5. One header line for every screen, which moves titles on layouts already accepted.
6. The phone bottom bar: add Gather (Library, Material, Source) as a sixth item to match desktop (suggested), or keep five.
7. "Subject" in everything shown on screen (suggested), or "project".
8. Text size: enlarge the writing and the side panel together and leave the top bar and sidebar fixed (suggested).
9. Where the one true copy of the work lives when the Mac is off (Part 4): the always-on server as the home with the Mac as a client, or the Mac as the home with a read-and-propose copy on the server.

## Scouting still worth doing

In rough order of how much each could change the plan.

1. **One real piece, start to finish.** Recording, transcript, correction, Source, Research with answers, Direction, Write with AI proposals, Check, photos, Carousel, export. The demo could not show the chain that matters most: spoken words becoming checked writing. Today this can only be done on the Mac, which is itself the finding in Part 4. Two ways round it: give the demo an invented recording, an invented transcript and a stand-in AI so the whole chain can be walked anywhere; or do it once on the Mac with someone watching.
2. **The "demo only?" items** (U11, U12, U18, A1): are they real?
3. **Coming back after a week.** With twenty or more real subjects, does Home say where each stands and what the next step is? Can he find a subject he half remembers?
4. **Working alongside an agent.** An agent asks a question ("Needs you"), he answers, the agent carries on. An agent proposes paragraphs while he is typing. What does he see while it works, when it fails, when it is done?
5. **Mistakes and Undo.** Attached the wrong source, made a Carousel by accident, renamed or archived a subject, deleted a slide. Can each be undone, and does the screen say so?
6. **The phone in the hand.** A real phone, one hand: capture a thought, a voice note or a photo and see it arrive under the right subject.
7. **Words for things.** List every noun the screens use (see V14) and choose one per thing. Cheap, and it removes confusion on every screen.
8. **Finding.** Search is literal today. Try ten real "where was that..." questions and see how many it answers.
9. **Size and speed.** Library and Media with thousands of items.
10. **Export matches preview.** The downloaded Article and Carousel against what Audience showed.
11. **A first empty start.** What a brand new home with no subjects shows.
12. **Without a mouse or with enlarged text.** Keyboard only, a screen reader, 200% zoom, and A+ on every screen.

## Function ideas

Not findings. Things the journey suggested that the app does not seem to have. Each needs Adrian's interest before any design.

- **Where this came from.** From a sentence in Write, see the source line behind it; from a source line, see where it has been used. The source list in R2 makes this possible, and it is the feature that would make Check trustworthy.
- **One capture box.** From any screen: type, paste a link, drop a photo or speak. It asks only "for which subject?", defaulting to the one open. Today Thought, Material and the microphone are three separate places.
- **State of play for each subject.** One line on Home per subject: what it has (material, pieces), when it was last touched, and the single next step. Arrange already has "Next: Audience"; the same button on every step would carry him through.
- **"Since you were last here."** Per subject: what agents did, what is waiting for him, in plain words.
- **Changed since I last read it.** In Read, mark what is new since his last read-through, whoever changed it.
- **What is out of date.** When the article changes, show which Carousel slides, posts or translations were made from the changed words. The product rule (a change flags other outputs and never rewrites them) exists; it was not visible in the journey.
- **Listen.** Read the piece aloud in Read. He works by voice, and errors are heard before they are seen.
- **Ready to publish?** One checklist per piece: checked, consent answered, photos placed, caption written. Audience's "Before it's ready" is most of this already.
- **An outbox.** What is ready, what went where and when. Outputs says "delivery not recorded" today.
- **A bin.** Subjects and pieces that can be put away and brought back.
