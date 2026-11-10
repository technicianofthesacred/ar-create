# Plan 6: working without the Mac

**Goal.** AR Create, Adrian's phone and his agents keep working when the Mac is off. One copy of the work, one writer, a real sign-in, and pCloud carrying files in and out.

**Findings covered.** M1 to M10 in the review's Part 4, U20, and the pCloud and iCloud assessment there. The product documents call this "planned, not installed" (`docs/DEVELOPMENT.md`, "Private storage and offline direction") and "Off-Mac reach waits for the VPS replica" (`docs/product/PRODUCT.md`).

This is its own stream. It is large, it moves private content, and nothing in it is authorised by this document. Each stage needs Adrian's agreement, and the stages that touch his real work need him present.

## The shape

```
 phone  ──▶ pCloud ◀── computer            files a person would recognise:
              │  ▲                          in  = recordings, photos, notes
        reads │  │ writes                   out = finished pieces, readable copies, backups
              ▼  │
        ┌──────────────┐   sign-in   ┌────────────────────────┐
        │  AR Create   │◀───────────▶│ phone browser, computer │
        │  on the      │             │ browser, cloud agents   │
        │  always-on   │             └────────────────────────┘
        │  server      │  the only writer of the working records
        └──────────────┘
```

- **One home, one writer.** The app's working records (history, revisions, proposals, holds) live with the one running app. They are never inside a synced folder.
- **pCloud is the carrier**, not the home. Sync tools replace a file with whichever copy looks newer; on 2 October 2026 pCloud put a June copy over the i64os store. AR Create's rule is never last-write-wins.
- **The Mac becomes a client**, and an optional helper for the heavy jobs it does best (the better transcript, large originals).

## What already exists to reuse

- The software runs off the Mac: in the review it was installed, built, run and fully tested on a Linux machine.
- i64os's always-on server, the private network between Adrian's machines, and folder sync that already copies the vault to the server (i64os `docs/TAILNET.md`, `docs/SYNC.md`).
- The magazine intake already collects from a pCloud Drop folder (`editorial/stages/mag/intake.md`).
- A scoped remote entrance for Claude and ChatGPT with sign-in, tested on invented data (`agents/remote/server.mjs`, `docs/REMOTE-CONNECTIONS.md`).
- A hosted speech service used by the phone and by i64os for a first transcript, with the shared word library (`docs/WORDS.md`, `docs/PHONE-PICKUP.md`).
- The release script already builds a separate candidate home (`scripts/release.mjs --candidate`).

## What ties it to the Mac today

| # | Tie | What changes |
|---|---|---|
| M1 | The only copy of the work is on the Mac | The home moves to the server (stage 4); pCloud and backups hold copies |
| M2 | The server answers only on 127.0.0.1 (`runtime/server.mjs` line 825) | It stays that way; a sign-in front door on the private network reaches it |
| M3 | No sign-in; actors are "honest labels" | Adrian signs in; `human:adrian` is given only to a signed-in person; agents use scoped keys |
| M4 | Unsaved words live in one browser | In-progress words are saved to the home as he types, per device, and offered on the next device |
| U20 | Pin, folder and archive live in one browser | Saved with the subject (plan 1, step 4) |
| M5 | Transcription runs only on Apple chips | A hosted first pass on the server; the Mac's better pass is offered when the Mac is on |
| M6 | AI help starts a signed-in command-line tool on the Mac | An AI provider called directly from the server, behind the same proposal and review rules |
| M7 | Phone recordings wait for the Mac to fetch them | The server fetches them |
| M8 | Agents: "from this Mac only" | The remote entrance, pointed at the server |
| M9 | Photo and footage originals are on the Mac | Previews everywhere; originals stay where they are, with an honest "the original is on the Mac" state |
| M10 | Release and restart scripts run on the Mac | The same release script, run for the server home |

## Stages

Each stage is useful by itself and can be stopped after.

**Stage 0. Decide and measure (no private content moves).**
- Adrian decides where the one true copy lives (review decision 9). This plan assumes the server.
- Inventory what the installed app reads on the Mac: every folder and tool named in its private configuration, and the size of each (text, recordings, photos). Names and sizes only.
- Sort AR Create's data folders (`docs/START.md`, "Where data lives") into "files a person would recognise" and "working records". Only the first kind may ever be written to pCloud.
- Check Adrian's pCloud plan: how far back file history goes; whether any needed folder is a locked (Crypto) folder that server tools cannot read; whether pCloud is reachable everywhere he works, including China.

**Stage 1. The app on the server with invented data.**
- Install a candidate home on the server from the walkable demo of plan 7. Reach it over the private network from the phone and a laptop.
- Finish check: Adrian opens it on his phone, makes a subject, records or drops a file, and sees a finished piece, with the Mac off. Nothing private is involved.

**Stage 2. Sign-in and the one-writer rule across devices.**
- A sign-in in front of the app. The page's default author is no longer trusted; a signed-in session is.
- In-progress words saved to the home (M4), so a piece started on one device continues on another.
- Two devices on one piece: decide and build what each sees (suggested: the second device opens read-only with "Adrian is writing on the laptop. Take over here").
- Finish check: the same piece open on two devices never loses a word; the history shows which device wrote.

**Stage 3. pCloud as the carrier.**
- On the server, `rclone` signed in to pCloud (the first sign-in is done on a machine with a browser and copied over).
- In: the server collects from named pCloud drop folders, as the magazine intake does on the Mac today.
- Out: finished pieces, a readable copy of each piece's writing, and a dated backup of the home, written by the app.
- Finish check: a recording dropped from the phone's pCloud app appears in Material; a finished Carousel's images appear in pCloud on the phone; a backup restores to a clean server.

**Stage 4. Engines that run anywhere.**
- A hosted first-pass transcript on the server, primed with the word library. The Mac's better transcript arrives later as a comparison, the way phone pickup already treats edited text.
- AI help through a provider called from the server, behind the existing proposal, review and human-only rules.
- Finish check: a recording becomes a checked transcript and a proposed paragraph with the Mac off.

**Stage 5. Move the real home (Adrian present).**
- Freeze the Mac home, copy it, verify identities and hashes, start the server home, and keep the Mac copy untouched until Adrian has used the server home for an agreed time. Follow the preservation rules in `docs/PERMANENT-HOME.md`: never restore an old tree over newer work.
- The Mac's browser-only unsaved words are checked and saved before the move.
- Finish check: Adrian's own acceptance on a real piece; rollback rehearsed first.

**Stage 6. Agents off the Mac.**
- The remote entrance pointed at the server home, with the scoped tool list and sign-in already built. Decide which of the 473 commands a cloud agent may use.
- Finish check: a cloud agent reads a real subject and stages a proposal; Adrian accepts it from his phone.

## What must not change

- One writer. No stage lets two copies of the app write the same records.
- Agents propose; Adrian decides. Human-only actions stay human-only, now tied to a real sign-in.
- Originals are never altered. Exact words, protections, rejection reasons, saved Undo and history move intact.
- Nothing is exposed to the public internet. The private network and sign-in come first.
- Backups are separate from sync, and a restore is proved before the home moves.
- No private content leaves the Mac before Stage 5, and only with Adrian present.

## Decisions needed first

- Where the one true copy lives (decision 9). The alternative, the Mac as home with a read-and-propose copy on the server, is smaller and leaves writing tied to the Mac.
- Which hosted speech service and which AI provider he is content to send his material to.
- What must work with no signal at all. This plan gives "works without the Mac", not "works offline"; offline writing on a phone or laptop is a later stage of its own.
