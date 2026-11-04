---
name: ar-create-instagram
description: Turn Adrian's voice transcript and photos into Instagram stories, reels, posts and carousels through AR Create's Instagram studio. Proposes two or three possible stories with photos matched to his lines and the research worth doing, then lays out the one he picks with a template, his words exactly as said, and a caption drafted for him. Use when Adrian shares a voice note or transcript with photos and asks what the story is, how to match it up, or to make a story, reel, post or carousel from it. Never posts or sends anything.
---

# Instagram from a voice note and photos

Adrian makes work from lived material. He gathers without choosing the form, lets it simmer, then names the dish. This skill supports that order: you bring back the possible stories, he names one, you make it, he says yes. His reader is a peer on a similar journey ("yeah, that's right, brother"): depth, not dopamine. The spiritual layer is authenticity: his actual life, no keywords.

## Nothing lost, nothing reworded unlabelled

His voice notes run about 20 minutes. The whole transcript goes in, never a summary in its place. AR Create reads it into lines and numbered moments with timestamps (`moments`: `M1`, `M2`... each with `at` in seconds and its exact text) and refuses the transcript outright if any character would fall outside the lines (`material.transcripts[].wholeness.missing` is always 0). Rules that follow:

- **His words are copied, never retyped.** On a frame, `words[].text` is an exact slice of a line. In a caption, his words are a `quote` part, linked to its line and moment. Any rewording is a `suggested` part, shown in the app beside the original quote. Quotation marks inside a `draft` part must hold his exact words or the caption is refused.
- **Every moment is placed.** The plan's `coverage` shows each moment as used (which frame or caption), in a proposed story, saved for later, skipped on purpose, or not placed yet. After proposing stories, mark every moment you are not using: `coverage:[{momentId, status:"saved"|"skipped", why}]`, with a short reason for each skip. Leave nothing "not placed".
- **Doubtful words are Adrian's to confirm.** The studio flags names and places, tea terms heard in a misheard form (with the Teajia tea-term library's spelling as a suggestion), numbers and dates. Add any others you notice with `flags:[{lineId, heard, kind, suggestion, why}]`. Never correct them yourself, in frames, captions or chat. When a piece uses a line with an open flag, AR Create puts one Only-Adrian ask on his Needs you list (linking back here), and refuses his final yes until he confirms each word as heard or corrects it. His correction may then be quoted (marked as his).
- **Read back before drafting.** Every story carries a `readback`: what it claims, in plain words, not a pitch. He answers "That is it" or "Not what I meant" in his own words. A story he says is not what he meant cannot be laid out until you propose it again from his words (his answer is kept in `meaningLog`).

## Who decides what

- **Only Adrian:** naming the dish (picking a story or naming his own), who it is for, his own words, confirming doubtful words, saying what he meant, consent for the people shown, the final yes. The app refuses these from an agent (403). Never act as `human:adrian`.
- **Carrying his decision from this chat.** When he gives one of those in the chat, record it with his exact words: add `said: {quote, via:"chat", at}` (at = when he said it, ISO time) to `instagram.choose`, `instagram.confirm`, `instagram.meaning`, `instagram.ready` or `consent.people.answer`. The record then says Adrian decided, in those words, carried by you. Quote him exactly, the whole reply that decides it; a paraphrase is not his words. Never carry a decision he did not say, and never infer one from silence. Overriding the consent hold stays in the app.
- **You default, he steers:** which photo goes with which line, the angle and title of each story, the layout (one strong default, never three options), the caption draft.
- **You handle and report after:** filing the transcript and photos into Library, fact checks (raise only the doubtful), captions, exports.

Do not ask him to approve each step. Ask only for the dish, and only if he has not already named it.

## Connect

```sh
export AR_CREATE_URL=http://127.0.0.1:8841 AR_CREATE_ACTOR=agent:claude-code
CLI="$HOME/Library/Application Support/i64os/ar-create/service/agents/cli/ar-create.mjs"
node "$CLI" status
node "$CLI" call instagram.templates
```

Use the installed CLI only; never edit the installed home or read its `data/`. Pass content as JSON on stdin (`--input -`). Every write needs a fresh `operationId` (UUID) and, for an existing plan, the `expectedRevision` and `expectedHash` you just read. 409 means read again; never force.

## The run, from one prompt

1. **File the material.** Import the transcript (as a `.md` or `.txt` file) and the photos into Library with `call sources.import` (`{rootId:"library", folder:"Instagram/<date> <subject>", urls:[], files:[{name, content}|{name, base64}]}`). Keep each receipt's `source.id` and `source.hash`. If the transcript is in the chat as text, file it exactly as given; do not tidy his words. Correcting an obvious mis-transcription of a name or term is fine; say which.
2. **Open a plan.** `call instagram.plan` with `{operationId, title, door, subject?, material:{transcripts:[{sourceId, sourceHash}], photos:[{sourceId, caption}]}}`. `door` is `teajia`, `art`, `mandala-codes` or `personal` (the Teajia door keeps the Teajia templates for carousels). `subject` is the AR Create project id if this belongs to one. The answer carries `lines` (every sentence, with an id `L1`, `L2`..., its speaker and exact text), `moments` (numbered stretches with timestamps), `flags` (words to confirm) and `coverage`. Photos get ids `P1`, `P2`...
3. **Look at the photos** (read the image files) and read every moment, start to end. Do not skim a long recording; the best line is often at minute 17. Then find the stories.
4. **Propose two or three stories** with `call instagram.plan` (`id`, revision, hash, `stories`, `gaps`). Each story: `title` (short, plain), `readback` (what it claims, plainly: "He says a crack records the people who used the bowl."), `dish` (one sentence: what it would be, in which form), `why` (why it is a story, not just content), `reader` (which of his readers it is for), `format` (`story`, `reel`, `post` or `carousel`), `spine` (the line ids it is built on, in order) and `matches` (`{photoId, lineId, why}`: which photo goes with which line, and why that pairing is true). `gaps`: what is worth researching before it is published (`{question, why, storyIds}`); only real gaps, such as a name, a date, a claim, a craft term in its own language.

   What makes a story here: a turn (something he understood, not only saw), a line that only he could say, and photos that show the exact thing the line is about. Prefer fewer, truer stories. Do not invent a moral, a hook or a call to action. Different stories should be genuinely different dishes (a different centre, reader or form), not three phrasings of one.
5. **Mark the rest of the moments** saved or skipped (see above), then **show him the stories in chat**. Not a bare list: for each story, in this order:
   - **What I think you're saying**: the read-back, in plain words.
   - **Key points** (two or three) and **why I'd pick it**: the turn, the line only he could say, who it lands with.
   - **His lines in context**: each spine line quoted exactly with its timestamp, with the sentence before and after it, the line itself in bold, and the photo that goes with it.
   - **Research paths**: one to three things worth checking that he can prove or rule out (a name, a date, a claim, a craft term in its own language), and whether a fact slide could carry one.
   Put your pick first. Then the words that wait for his confirmation, each shown inside its line. Ask once which story, unless he already said.
6. **When he answers in chat**, carry each decision with his exact words (see "Carrying his decision"): `instagram.meaning` (that is it, or not what he meant), `instagram.confirm` for each word he settles, `instagram.choose` for the story or the dish he names. If he names a dish none of the stories matches, propose it as a new story built from the lines he means, then carry his choice. If he only hints, record `heard: {storyId, quote}` with `instagram.plan` and ask him to say it plainly.
7. **Make it.** `call instagram.layout` with `{id, operationId, expectedRevision, expectedHash, storyId, format}` and no `frames`: the studio builds the one strong default from the story's lines and matches. Add `caption` as parts: `{parts:[{kind:"draft",text}, {kind:"quote",lineId,text}, {kind:"suggested",lineId,text}]}`. Make the format he asked for; make others only if he asked.
   - Story: one frame per line, "Said, under the photo". Reel: a "Reel cover, grid safe" then one "Reel line" beat per line, timed from the words, at most 3 minutes; the on-screen words also come out as subtitles (`instagram.captions`). Post: one "Field note" with the strongest line. Carousel: "Field note" slides, or the Teajia catalog for the Teajia door, up to 20.
   - To adjust, send `frames` yourself: each `{templateId, role, words:[{lineId, text}], label, credit, photos:[{photoId, x, y}], seconds?}`. `text` must be an exact slice of that line; anything else is refused. `label` and `credit` (60 characters) are for place, date and speaker only, never for new sentences.
8. **Look at it.** Open `/api/instagram/sheet?id=<id>&format=<format>` or each frame's PNG (`/api/instagram/png?id=&format=&frame=`), read the images, and fix what you see (a crop that cuts a face: change `x`/`y`; a line too long: pick a shorter slice at a natural pause).
9. **Show him the frames in chat**: each PNG, in order, with the caption draft, and ask whether it is ready. His yes in chat is carried to `instagram.ready` with his words (with any caption change he made); so is his answer for anyone shown (`consent.people.record` lists them, `consent.people.answer` carries what he says they answered). Report the rest in a few lines: what was filed, which story, which format, the open gaps. Nothing is posted from AR Create; he posts it himself.

## Memos from the phone, with the Mac asleep

He sends a voice memo and photos from mandalacodes.com/memo/. The VPS transcribes it (mandalacodes `scripts/memo-transcriber.ts`) and keeps a copy of AR Create (the feeder) for the work while the Mac is off. On the VPS:
1. List memos ready for you: `GET https://mandalacodes.com/api/oracle/pickup/memos?waiting=collect&by=vps` with `Authorization: Bearer $AR_PICKUP_TOKEN`. `GET …/memos/<id>` gives the timed transcript (`[m:ss]` paragraphs, the words exactly as transcribed) and the file paths; `GET …/memos/<id>/files/<file>` fetches the audio or a photo.
2. File the transcript text exactly as returned (as `<date> <subject>.md`) and the photos into Library with `sources.import`, then open the plan with `subject: "memo-<memo id>"` so the consent desk has a piece to check. Mark the memo collected: `POST …/memos/<id>/picked {"by":"vps"}`.
3. Then the run above, from step 3. Read the PNGs from the feeder (`/api/instagram/png?…`) and show them in chat.
The Mac's AR Create takes the finished plan one way when it wakes; never edit it on both.

## Captions

A caption is your proposal; he edits it in the app. Write as a peer who was there: plain, specific, in his register, no hype, no emoji, no em dashes, no call to action, no "link in bio" unless he asks. His words go in `quote` parts, exactly; a reworded line is a `suggested` part, never passed off as his. At most five hashtags (Instagram's limit), and only ones that name what it is (a craft, a place); none is fine. Up to 2,200 characters, but most captions are short.

## Research gaps

When a gap matters, check it (AR Create Research, or the i64os `research_hunt_start` and `web_search` tools), then update the gap with `status`, `finding` and `sources` through `instagram.plan`. Raise only doubtful findings with him. Never put an unchecked claim into a caption.

## Instagram facts the studio uses

Stories and reels are 1080 x 1920; posts and carousels 1080 x 1350 (4:5). Reels run up to 3 minutes. Carousels hold up to 20 slides. The profile grid crops to 3:4. Story words stay out of the top and bottom 250px; reel words out of the bottom 420px and right 160px. `instagram.templates` returns these with their sources.

## Never

Post, schedule or send anything. Write or change his words. Press his buttons or act as `human:adrian`. Use Cloudinary or any paid service for images. Put a story's words in a frame that he did not say.
