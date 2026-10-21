# Asking Adrian: buttons, never just chat

Adrian decides on the magazine page, http://localhost:8766/, where every choice is a button. The page builds itself from one file per story, `MAG/Workflow/ASK - [Story].md`. So whenever a step needs him (a pick, a read, a fact, a yes), write the question there. Never leave a decision only in chat; in chat, point him to the page.

## The shape

```markdown
---
type: ASK
story: Tea Teacher
record-to: Workflow/2-Guidance/MAP - Tea Teacher.md
---

# Tea Teacher

## What the story is about
I'd go with living in the present. It follows the order she spoke in and ends where she ended.
read: Workflow/2-Guidance/MAP - Tea Teacher.md | Read the map
- [ ] Living in the present (recommended)
- [ ] Trust yourself
- [ ] Her lightness
- other: A direction of my own
```

- `story:` is the story's name as the board knows it (its CONTEXT name). `record-to:` (optional) is where each answer is ALSO written as a dated line under "## Adrian's decisions": use the map for picks.
- **At most three questions a story, and only directional ones** (Adrian, 2026-10-03: "I don't want 160 questions.. max 3 each story, directional, not micromanage"). The three, in this order:
  1. **Which title?** Up to four options, my pick first, plus "A title of my own". Drop it once he has picked.
  2. **Read the draft. Good, or what should change?** One `read:` line per part (several are allowed), "Good, carry on" and "other: Change this".
  3. **What do you remember from <the visit>?** One text box. Hint: the room, one thing they did, what surprised you (MAG/WRITER-GUIDE.md). "A sentence or two, or leave it blank."
  Only when a story cannot go on without him (a direction before any draft, permission to quote something private) may that replace the title question.
  **Outside the three: the ledger** (Adrian, 2026-10-04: "where are the check marks for adjustment"; "I can decide for others as well, I'm the editor"). Once research has run, every line the speaker check flagged, anyone's, is one question in the ledger shape (format at the top of `~/builds/mag-ask.mjs`), and the page shows them together as one ledger he settles by the words themselves. Plus one question on the line the story stands on and one per fact only he can settle. See arcreate's research step, section 4. Everything else is mine: connecting lines, word fixes, who said what, small cuts. I take my recommended answer, apply it to the draft (an Adrian line I change keeps `%%was:%%`), and record it in `_archive/Answered/ASK - [Story] (defaults <date>).md`. His "Good, carry on" approves all of it, connecting lines included; "Change this" is where he overrides. Facts only the subject can confirm go into the feedback message to them, listed in CONTEXT under "Ask them", never to Adrian.
- **Written for someone coming in blind** (Adrian, 2026-10-05: "assume each step I'm on I know nothing about previous steps"). The page already shows "The story so far" above every question (who and where from SRC, what it is about from the map's pick, his opening from CONTEXT, his decisions from the map), so keep those files' fields filled. The question's own context must still name the specific thing it is about (which visit, which part, which line) so it can be answered without opening anything. A "NEEDS MORE" in `Workflow/_page-feedback.md` means this rule was missed.
- Two lines of context at most: what it's about, then my pick and the one reason. Plain words, no file names, no step numbers, no rule numbers.
- **Superseded 2026-10-03 by the three-question limit above:** the five after-visit prompts (Adrian, 2026-10-03): every story that is not yet live carries five text-box questions straight after its first question, each heading the question itself with "(visit 1 of 5)" after it: the room, one thing they did, what you came wanting to know, what surprised you, the last thing you saw (MAG/WRITER-GUIDE.md). Under it only the hint (e.g. "The light, the smell, what was on the table.") plus "A sentence or two from memory, or leave it blank." No reasons, no instructions about memos or checks (Adrian, 2026-10-03: the long version buried the question). Answers are his lines: file them into the story's CONTEXT, place them in the draft, and run the normal checks.
- **The question first, plain** (Adrian, 2026-10-03: "use that format for all the other questions too"). The `## ` heading is the question itself, ending in "?", under about 12 words ("Which title?", "Keep my line 3 of 18?"), never a label. Under it, at most two short sentences: what it's about (the quoted line and where it sits), then the recommendation and one reason. No process talk: editors, reviewers, scores, map, direction, SRC, "rewritten today". Worked example: `_archive/Superseded drafts/Wood-Fired Potter/ASK - Wood-Fired Potter (2026-10-03 before plain questions).md` against the live file.
- **Context so he never has to look it up** (Adrian, 2026-10-02: "I shouldn't have to figure out when you're asking me about a sentence what it is in relation to"). A question about a line quotes that line and says where it sits: the section, and a few words of what comes just before and after. A question about a fact says which part of the story it's in. A pick (title, direction) says where the default comes from. (Questions per line or fact are retired: those are mine to decide, see the three-question limit.)
- `read: <file under MAG> | <button label>` only when reading something is part of deciding. The page puts the question's buttons at the bottom of that file too, so reading ends in deciding. Only link a file he can act on; never notes, checks or transcripts.
- Options as `- [ ]` lines, one button each; mark my pick `(recommended)`. Keep them short enough to fit on a button.
- `- other: <label>` adds a button that opens a box for his own words (label it plainly: "I have changes", "A title of my own"). For a question with no options at all, write `answer:` and he gets just the box.

## When he has answered

The board lists answered questions as "ANSWERED on the page, act on it". At the start of any `/mag` run, act on those before anything else: they are decisions already made, and they make the story my move. Then move each acted-on question out of the ASK file into `MAG/_archive/Answered/ASK - [Story].md` (append, newest last, with the date acted). When an ASK file has no questions left, move the whole file there. A decision that changes the story is also written where it belongs (the map, CONTEXT, STATUS.md) in the same step.

He can change an answer on the page until I act on it, so act on what the file says at the time, not what chat said earlier.

## When a step needs him

Every "you" step writes or updates the story's ASK file before the step is reported done: 4 Your pick (direction, title), 6 Your read (a read question with "Good, carry on" and "I have changes", plus each `%%you%%` note in the draft as its own question), 10 Your look, then publish ("Publish" as a button, still only acted on as his word), 11 Feedback sent ("Sent"; Adrian sends it himself, no check by anyone first: "I don't need iris to check it", 2026-10-02). Small facts the feedback message will ask the person (names, how to introduce them) are not questions here: names never hold a story back.
