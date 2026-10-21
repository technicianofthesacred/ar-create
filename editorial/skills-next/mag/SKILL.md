---
name: mag
description: Runs the Teajia magazine, recording to live page. Shows a live board of every story and does one story's next step. Use when Adrian types /mag, says "work on the magazine", names a magazine story (Tea Teacher, Yixing, Wood-Fired Potter, An Cha, Lu Zhaokai), has a new interview recording, wants to read a draft, or says publish.
argument-hint: "[status | turn | story | resume | intake | preview | send <story> | terms | tidy]"
allowed-tools: Bash(node ~/builds/mag-status.mjs)
when_to_use: Also when Adrian says he answered something on the magazine page, or asks what is waiting on him.
---

# /mag

Installed from the AR Create repo (`editorial/skills-next/mag/`); edit it there. Since 2026-10-21 **AR Create is the magazine's one writer** (Adrian's D1): on this Mac every file this skill makes or changes goes through AR Create's commands, never straight into the folder.

The magazine lives in Adrian's vault: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine/` (MAG). Recordings and photos live in FILES, `~/Documents/Files/1 Areas/Brands/Teajia/Magazine/`. Paths below are relative to MAG.

## The live board, read from the files as this skill loaded

!`node ~/builds/mag-status.mjs`

STATUS.md is Adrian's board. AR Create keeps only its story table (between the `ar-create:story-table` marks) true; every other line there is his.

## Which path: this Mac, or another machine

Run `uname -s`. **Darwin (this Mac):** use AR Create, as below. If AR Create does not answer (`node "$MAG" lock` fails), stop and tell Adrian in one line that AR Create is not running; never write the files yourself instead. **Anything else (the VPS, innerstellar):** the legacy path in [stages/legacy.md](stages/legacy.md), unchanged rules, under the shared lock.

On this Mac, `MAG="$HOME/Library/Application Support/i64os/ar-create/service/tools/magazine/mag.mjs"`, and every command is `node "$MAG" …` (run it with the sandbox off: it talks to 127.0.0.1:8841).

| To | Run |
|---|---|
| hold the magazine for this run (the VPS and innerstellar see it) | `node "$MAG" hold "<what you are doing>"` at the start; `node "$MAG" release` as the last thing, even if the run stopped early |
| see the board | `node "$MAG" board` (the same lines as above, plus the lock and what waits for Adrian's yes) |
| read a file | `node "$MAG" read "<path>" --out "$TMPDIR/<name>.md"`: keep the `hash` it prints |
| write a file | edit your copy, then `node "$MAG" put "<path>" --from "$TMPDIR/<name>.md" --expect <hash>` (`--new` for a new file) |
| take in a drop | `node "$MAG" claim "<file name>" --story "<Story>"` ([stages/intake.md](stages/intake.md)) |
| check quotes and splits | `node "$MAG" check "<DEV path>"` |
| keep STATUS.md's story table true | `node "$MAG" status-table` after every step |
| tidy | [stages/tidy.md](stages/tidy.md) |

What `put` does depends on the file (Adrian's D4): working notes (SRC, RESEARCH, BRIEF, NOTES, MAP, PLANS, CHECK, SENSE, BLIND, ASK, REQUESTS, the glossary queue) **save directly**, and can be undone. **Drafts (DEV), his CONTEXT note, FEEDBACK messages and post words become a proposal**: nothing is written until Adrian says yes in AR Create. Tell him in one line that the words wait for his yes. A post file you write with `status: for-your-yes` saves directly: the page asks him. RAW is written once, by intake. A `409` means the file changed after you read it: read it again and redo your change on the new text, never force it. A `423` names who holds the magazine: stop and say so.

## Then read

[LESSONS.md](LESSONS.md): the rules this work has taught (also in AR Create at `editorial/LESSONS.md`).

## Always

- Every line a reader sees is their words, Adrian's words, or a connecting line within the rules. You are not creative. You hold the story together.
- Never edit a RAW file or anything in `Writing/`. Never change a line Adrian added or changed. AR Create refuses rule files, templates, `_style`, `_briefs` and the archive.
- Transcripts are private: never copy their content outside the vault. The teajia repo gets only what `mag send` generates.
- Working notes are bare lists. No prose about the person.
- Adrian decides on the magazine page, http://localhost:8766/, where every choice is a button; its saves go through AR Create too. Any decision goes into the story's ASK file ([stages/ask.md](stages/ask.md)); never leave a choice only in chat. Answered questions are acted on first, every run.
- Adrian reads a draft as a reading-page link, never a file link: [stages/preview.md](stages/preview.md).
- Story numbers never change; a new story gets the next number after the highest ever used.
- Keep `WRITER-GUIDE.md` growing (Adrian, 2026-10-03): when a rating, a reader note or a read count teaches something about what lifts a story, add one dated line under "What we've learned", newest first, naming the story (`read`, then `put`). It is written for Adrian, not for drafting.
- His page edits are logged in `Workflow/4-Review/EDITS - <draft>.md`. At the start of every run, read new entries: his edits are final, never undone; run the checks on that draft and fix only what breaks around his edit. `%%rework%%…%%/rework%%` marks words he wants rewritten: rewrite just those (a proposal, since it is the draft), then drop the marks.
- After every step: `node "$MAG" status-table`, and write or update the story's ASK file if the next move is his.

## The twelve steps

1 Dropped in (you), 2 Source (me), 3 Research and map (me), 4 Your pick (you), 5 Draft (me), 6 Your read (you), 7 Your changes in, checked (me), 8 Photos in the folder (you, any time), 9 Photos placed (me), 10 Your look, then publish (you), 11 Feedback sent (you), 12 Confirmed (me). Lead with one story but move every other story as far as it can go without him.

## What the argument means

| Adrian gave | Do |
|---|---|
| nothing | The numbered stories, each with its step, its one next step and who it waits on; anything in a drop folder first. End with: "Your choices are on the page: http://localhost:8766/". Stop. |
| `status` | [stages/status.md](stages/status.md). Changes nothing. |
| `turn` | Every "you" step has its ASK file ([stages/ask.md](stages/ask.md)); give him http://localhost:8766/. |
| `resume` | "Resume" below. |
| a number or a story | Its step on the board, that step's file below, do the next step, then show what it says to show. |
| `intake` | [stages/intake.md](stages/intake.md) |
| `preview` | [stages/preview.md](stages/preview.md) |
| `send <story>` or "publish" | [stages/publish.md](stages/publish.md), only on his own word in this turn. |
| `terms` | [stages/terms.md](stages/terms.md) |
| `tidy` | [stages/tidy.md](stages/tidy.md) |

| Step | Read |
|---|---|
| 1, 2 | [stages/intake.md](stages/intake.md), then [stages/source.md](stages/source.md) |
| 3 | [stages/research.md](stages/research.md), then [stages/map.md](stages/map.md) |
| 4 | [stages/map.md](stages/map.md) |
| 5 (writing) | [stages/develop.md](stages/develop.md) |
| 5 (review), 7 | [stages/review.md](stages/review.md): the editor, blind and rating passes stay fresh agents; they read and write through `node "$MAG"` too |
| 8, 9, 10 (look) | [stages/photos.md](stages/photos.md) |
| 10 publish, 11, 12 | [stages/publish.md](stages/publish.md) |

Read only the file for the step, and only the SYSTEM.md, TEMPLATE.md, EDITOR.md or RATING.md sections it names (read them with `node "$MAG" read`). For the story picked, read its MAP (Adrian's decisions) before any step after Source.

## Resume

1. `node "$MAG" hold "/mag resume"`, then the board. Act on every ANSWERED question. Make what `Workflow/5-Social/REQUESTS.md` asks (unticked lines; `Redo <Step> · <story>` sends a story back to that step). Read `Workflow/_page-feedback.md` and add context wherever he answered "NEEDS MORE". Re-cut any post marked `cut-from: brief` whose story is at step 8 or later. Take in anything in a drop folder. Fix STATUS.md's story table (`node "$MAG" status-table`) and say in one line what changed.
2. One tracker: story, step, one next step, **you** or **me**.
3. One task per story in the session's task list, done as each step finishes.
4. If anything waits on Adrian, point him to http://localhost:8766/; otherwise start the first step that needs only you and keep going. `node "$MAG" release` at the end.
