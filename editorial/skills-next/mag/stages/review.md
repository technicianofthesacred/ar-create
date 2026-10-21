# Review: edit, blind read, rating, checks

The editor, each blind reader and each rater must not be the session that wrote the draft. Run each as a fresh agent with the Agent tool (`model: "sonnet"`), handing it only its brief and the file paths. Do not do these passes yourself.

## 1. Edit

Read EDITOR.md. Hand a fresh agent `MAG/Workflow/_briefs/EDIT-BRIEF.md` with the DEV, SRC and CONTEXT paths. It edits in place (structure first, then words and sentences), fixes what it can inside the rules, leaves Adrian at most five one-line `%%you%%` questions, and logs its changes at the top of the story's NOTES file.

## 2. Blind read, two rounds

Make the reader's page: `node ~/builds/mag-blind-text.mjs "<DEV>" "<out.txt>"`. Hand a fresh agent `MAG/Workflow/_briefs/BLIND-BRIEF.md` and only that text file. It says, passage by passage, who is speaking and what they mean. The editor (a fresh agent again, or you only for a fix the brief allows) fixes every place it stumbles, on the page. Then a second blind read with a new reader. Run the quote check after each round.

## 3. Rating

Read RATING.md. A fresh agent rates attention and checks the rules, into `MAG/Workflow/4-Review/CHECK - [Title].md`. Then run the revise loop (RATING.md section 6b): apply the fixes that don't need Adrian, re-rate with a fresh reviewer, at most two rounds. Show Adrian the before and after scores and anything only he can fix.

## 4. Machine checks, after Adrian has read it

Read SYSTEM.md, "## 4: Review (the checks)". Run:

- `node ~/builds/mag-check-quotes.mjs "<DEV>" "<SRC>" "<CONTEXT>"` (real words; add CONTEXT when the story has one)
- `node ~/builds/mag-check-splits.mjs "<DEV>" "<SRC>"` (one thought never set as two quotes)

Write the result into CHECK. Stop and show: pass, or each failure with its line.

This is step 7 (his changes folded in, checked). When the text is approved and the story's Photos folder is empty, nothing happens on photos: the draft stays text only. Say "Text ready. Put the photos in its folder when you have them," with the photos link from the board. Then [photos.md](photos.md).
