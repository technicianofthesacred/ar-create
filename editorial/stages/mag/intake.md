# Intake: step 1 (dropped in) to step 2 (source)

Adrian drops a recording, or a transcript that already exists, into any drop folder (`MAG_DROPS` in `~/builds/mag-intake.config`); how it got there doesn't matter, every one is taken in the same way:
- on this computer, or from the pCloud app on his phone: `Files/1 Areas/Brands/Teajia/Magazine/Drop/` (Files syncs both ways with pCloud; a phone upload can take a while to arrive);
- from his phone through iCloud: iCloud Drive → `Teajia Drop` (Voice Memos → Share → Save to Files). A file iCloud hasn't downloaded yet shows on the board as "still downloading"; intake fetches it first.

- through the magazine page's drop zone (Mac or phone, several files at once): the files land in the Files Drop folder. A single file uploaded WITH a story name is taken in by the page itself, straight away: by the time `/mag` runs the story is already at step 2 with its RAW, and the job's record and log are in `/tmp/mag-intake-jobs/` (a failed one shows on the page with its last line; read its log, fix the cause, run intake again by hand).

The board lists everything waiting in any of them. Run intake yourself, on the file's path as the board gives it. Adrian is never handed this command.

1. Name the story: a short title from the file name or what he said ("Tea Teacher", "Wood-Fired Potter"). If nothing says who it is, ask him once.
2. Run it:

```bash
bash ~/builds/mag-intake.sh "Title" "<file in Drop>" ["<voice note>"] [--lang zh|en|auto] [--terms clay,puerh]
```

- A transcript (.txt .md .docx .rtf .srt .vtt) is filed as it is, with no whisper pass and no times unless the file has them. A PDF or Pages file is refused: ask him to export it as .txt or .docx.
- A recording is transcribed on this Mac with whisper. Inside the Bash sandbox whisper cannot use the graphics chip and cannot write to Files: run it with the sandbox off. It streams progress; a long interview takes several minutes, so give it a long timeout or run it in the background and report when it ends. Pick `--terms` sets from the subject (`node ~/builds/tea-terms.mjs --sets`).
- The file is MOVED out of Drop into the story's own folder, `…/Magazine/[Title]/`, which also gets an empty `Photos/` folder. RAW lands in `MAG/Workflow/0-Inbox/RAW - [Title].md`, with every tea term it heard in its frontmatter (`terms_heard`). RAW is never overwritten.
- The board shows the story from its RAW onward. If Adrian gave context with the drop, write `MAG/Workflow/1-Source/CONTEXT - [Title].md` (his words, lightly edited, original kept underneath); if not, ask for a few lines before drafting (step 5), not now.

Then add the story to STATUS.md with the next number, and go straight on to [source.md](source.md) unless he said to stop.

The rules for this stage: SYSTEM.md, "## 0: Ideas and Inbox". Settings: `~/builds/mag-intake.config`.
