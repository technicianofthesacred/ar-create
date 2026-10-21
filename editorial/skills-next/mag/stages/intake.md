# Intake: step 1 (dropped in) to step 2 (source)

Adrian drops a recording, or a transcript that already exists, into a drop folder: `Files/1 Areas/Brands/Teajia/Magazine/Drop/` (this computer, or the pCloud app on his phone), or iCloud Drive → `Teajia Drop` (Voice Memos → Share → Save to Files). A file iCloud hasn't downloaded yet shows on the board as "still downloading". The page's drop zone saves into the Files Drop folder; a single file uploaded WITH a story name is taken in by AR Create straight away.

**Off this Mac:** [legacy.md](legacy.md) (the old `mag-intake.sh` path, under the lock).

**On this Mac, AR Create takes it in.** You never move, copy or transcribe the file yourself, and Adrian is never handed a command.

1. Name the story: a short title from the file name or what he said ("Tea Teacher", "Wood-Fired Potter"). If nothing says who it is, ask him once.
2. `node "$MAG" claim "<file name as the board lists it>" --story "<Title>"` (add `--folder 1` for the iCloud Teajia Drop). AR Create copies it into `FILES/<Title>/` with an empty `Photos/` folder, and refuses a story whose RAW exists (RAW is never overwritten) or a file it already took in.
   - A transcript (.txt .md) is filed to `Workflow/0-Inbox/RAW - <Title>.md` at once, and the drop is emptied.
   - A recording is transcribed by AR Create's local runner (speakers separated). The answer gives a `claimId`. `node "$MAG" intake <claimId>` shows its progress; when it says the transcript is ready, `node "$MAG" intake <claimId> --file` files RAW. Only then is the drop emptied. A long interview takes several minutes: check back, don't wait in a loop.
   - A docx, rtf, srt or vtt transcript: ask him to export it as .txt first. A PDF or Pages file the same.
3. If Adrian gave context with the drop, write `Workflow/1-Source/CONTEXT - <Title>.md` with `put --new` (his words, lightly edited, original kept underneath). It is his note, so it becomes a proposal for his yes. If not, ask for a few lines before drafting (step 5), not now.

Then `node "$MAG" status-table`, and go straight on to [source.md](source.md) unless he said to stop.

The rules for this stage: SYSTEM.md, "## 0: Ideas and Inbox".
