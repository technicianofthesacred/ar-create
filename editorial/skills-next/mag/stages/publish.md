# Publish, feedback, replies

Read SYSTEM.md, "## Publish" through "### Feedback" (to "## 5: Social").

## Publish: only on Adrian's word

Nothing here runs unless Adrian's own message in this turn says publish or send for this story. The page is generated from the DEV with `mag-send`, never copied by hand.

**On this Mac, his word is recorded in AR Create first:** his yes is `magazine.send` for the exact draft (he says publish on the page or in AR Create; it is his alone). Before step 2, `node "$MAG" read "<DEV>"` and check AR Create holds his approval for that hash (`magazine.send.approval`); if the draft changed since, ask again. `node "$MAG" check "<DEV>"` runs the quote and split checks. After it is live, marking the draft published is Adrian's alone: `magazine.mark-published` (allowed only for the approved hash) answers 403 to an agent, so show him the live link and leave the `published: <link>` line to him. The issue index is written with `magazine.issue.write`. `mag-send seed` writes a draft directly: on this Mac, ask Adrian before using it. Off this Mac: [legacy.md](legacy.md).

1. Work in a teajia worktree on its own branch, rebased on origin/main. Never in a checkout another session is using.
2. Check first: `bash ~/builds/mag-send.sh send "<DEV file>" <piece> --check`. It refuses anything not ready: an unapproved `==line==`, an em dash, an unclosed side, a photo in `public/read/<slug>/` not placed in the draft, or a placed photo that is missing. It lists passages changed, new and gone, and any edit saved on the live page that now sits on changed words.
3. Send: the same command without `--check` writes `src/pages/read/conversation/pieces/<piece>.story.ts`. A new story also needs its hand-written piece file (title, the subject's name and Chinese name for the byline, credit, what to read next; the byline is built by the page, TEMPLATE.md section 2, 2b) and its photos in `public/read/<slug>/`, copied from the story's Photos folder (`Files/1 Areas/Brands/Teajia/Magazine/[Title]/Photos/`) in file-name order.
4. Run `npx vitest run src/pages/read/conversation` with the vault present: the generated file must equal what the draft makes, and every quote must trace to the transcript. Then `npm run lint` and `npm run lint:colors`, and open a PR. It goes live when Adrian says ship.
5. Add the story with its link to the current issue's index in `MAG/Issues/`, move it in STATUS.md to "On teajia.com", and ask Adrian to mark the DEV published (the live board reads its `published:` line; on this Mac only he writes it).

Show the pull request. After he says ship: the live link, checked to load, and the feedback message to send.

A page built by hand before mag-send gets `seed` once: `bash ~/builds/mag-send.sh seed "<DEV file>" <piece>` writes the draft's body from the page, after proving the round trip, and carries the tea-term marks and notes for Adrian across.

## Feedback: once it is live

Copy `MAG/Workflow/6-Feedback/FEEDBACK TEMPLATE.md` to `FEEDBACK - [Title].md` and fill it for every person in the story: name, one memory line from his opening in CONTEXT, the link, and their "What we learned" lines from the story's RESEARCH file (in Chinese in the Chinese message). Show the message, Chinese and English, for him to read before sending.

## A reply comes back

Translate it into the FEEDBACK file and the story's CONTEXT, then list the corrections for the story and the live page. Nothing on the live page changes without his yes; with it, the correction goes through mag-send again and the DEV gets a note of what changed. STATUS.md moves the story to Confirmed.
