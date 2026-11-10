# Plan 8: a noticeably better interface

**Why this plan exists.** On 10 November Adrian looked at the screens work and said the changes were "very minor", about consistency, and that "unless you're really looking for it you can't see or find any change. I was looking for more noticeable significant improvements." He is right. Plan 5 repairs and aligns the approved Combined layout; by design it cannot make the app feel different. This plan is the brief for a design round that can.

**Status.** A brief for a design round. Nothing is designed, approved or built. It proposes changes to the approved Combined direction, so the result needs Adrian's choice by eye before any of it is built (`docs/product/PRODUCT.md`: "Prove the direction visually").

## What makes the app feel flat today

Seen in the review's screenshots of the demo:

1. **The screen is mostly machinery, not his work.** On Write there are six layers of controls around the words: the top bar, a sidebar of thirteen places, the step title with piece tabs, a row of modes and tools, a direction strip, and a side panel form that is switched off. The writing sits in what is left.
2. **Home gives the big boxes to the system.** "Needs you" (nothing), "Optional" (could not be read), "Handled by agents" (none) and "Words" (none) fill the top and right. His subjects are grey rows at the bottom.
3. **Nothing looks like what it is.** A subject with photos, a recording and half an article looks the same as an empty one: a row reading "Projects · Draft". The finished Carousel slides, the best-looking thing the app makes, appear only deep inside Arrange and Audience.
4. **The journey is thirteen doors on a wall, not a path.** Each step is its own page with its own layout. Nothing shows where a subject stands, what is done or what comes next.
5. **The app talks about itself.** "Not connected", "Saved direction · not connected", "Angle and title choices pending", "Live AI is not connected to this editor" take prime space on working screens.

## The moves that would be noticed

Each is a proposal for the design round to draw, not a decision.

**A. Home is his desk.** Each subject is a card that shows the work: its name, a line of the latest writing, small pictures of its photos and slides, where it stands, and one "next" button. "Needs you" appears only when something is waiting. The system panels leave Home.

**B. One page per subject.** What went in (recordings, notes, photos, shown as themselves), what he understands and wants to say, and the pieces being made, shown as they will look. This already exists in embryo: the **Subject board** (Origins, Understanding, Pieces), part of the approved Combined direction. On a computer it is reachable only through Piece tools, it loses the subject's name in the top bar, and its columns are bare lists. Making it the centre of each subject is the largest single improvement available, and it is finishing something already approved rather than inventing something new.

**C. A path instead of thirteen doors.** Inside a subject the sidebar becomes the four stages (Gather, Develop, Make, Deliver) as a line that shows where this subject is, with a "next" step. Home and Library stay above it. The twelve sections remain as places inside the stages, so nothing is removed.

**D. The writing page is calm.** One thin line of controls above the page. Sources and AI help appear beside the paragraph they concern, as notes in the margin, when there is something to show. No permanent form.

**E. Show the work, quiet the plumbing.** Status about connections moves behind one "Details". Pieces appear as rendered pictures wherever they are listed: on the Home card, on the subject page, in Outputs.

**F. The phone is its own thing.** Built for what a phone is for: capture a thought, a voice note or a photo; read; answer "Needs you"; approve. Not the desktop squeezed.

## What must stay

- Everything the app can do, and every one of the twelve section entrances.
- Adrian's exact words, protections, saving, recovery and Undo. Agents propose; he decides.
- The palette, Plus Jakarta Sans for the interface, Lora for spoken words, the Graphite controls, light and dark.
- The page geometry of Write and Read that he has accepted.
- Honesty: a tool that is not connected still says so where he meets it, in a quieter place.

## How to do it: a design round, then a build

**Step 1. Pause polish that a redesign would replace.** The screens thread finishes plan 5's Stage A (things that are plainly broken) and stops. Restyling menus and rows waits for the direction chosen here.

**Step 2. A design round on three screens only.** Home, the subject page, and Write. Two or three clearly different directions for each, as clickable mock-ups with invented but lifelike content (a tea subject with a recording, notes, photos, half an article and a Carousel), at desktop and phone width, in dark and light. Mock-ups, not changes to the app: they are quick to make and cheap to throw away. A strong model should do this, started fresh from this brief, the review and any reference Adrian supplies.

**Step 3. Adrian chooses by eye.** He picks a direction per screen, or mixes. The choice is written into `docs/product/PRODUCT.md` as the new baseline where it differs from Combined, with the date.

**Step 4. Build in this order**, each with before and after screenshots:
1. The walkable demo (plan 7), so every screen has lifelike content to be judged with.
2. The subject page, together with plan 1 (the subject stays selected), since they are the same change seen from two sides.
3. Home.
4. Write, together with plan 2.
5. The source list (plan 3), which fills the subject page's first column with real material.
6. The phone.

Plans 1 to 3 are still needed. A better-looking subject page that cannot show a subject's sources would be a prettier dead end.

## What the design thread needs

- This file; `docs/reviews/2026-11-10-use-and-interface-review.md`; `docs/product/PRODUCT.md` (intent and the Combined decision); `docs/product/HUMAN-EXPERIENCE.md`; `docs/product/LOOK.md`.
- The demo for reference (`npm run demo`), and `scripts/review-screens.mjs` for the current screens.
- From Adrian: one or two apps or screenshots he finds classy, and what he likes in them. This matters more than anything else in the brief.

## Finish check for the design round

Adrian can open each direction on his phone and on a computer, click through Home, a subject and Write, and say which he prefers and why. Nothing in the app has changed.

## Decisions needed first

- Whether to reopen the Combined direction at all. This plan assumes yes for Home, the subject page and Write, and no for the palette, type and controls.
- Whether the sidebar may go from thirteen places to four stages inside a subject (move C). This is the boldest change and the one most worth seeing as a mock-up before deciding.
