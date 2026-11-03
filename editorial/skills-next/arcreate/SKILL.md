---
name: arcreate
description: Adrian's content skill. Turns anything he says out loud (talks, debriefs, interviews, voice memos, studio or field conversations, transcripts) into researched, fact-checked material, then makes whatever he asks for from it in the moment, for any of his brands - a magazine story, carousel, post, reel or video script, Tea Wisdom entry. Use whenever Adrian types /arcreate, shares a recording or transcript to process, asks to research or fact-check a conversation, or asks for a post, carousel, reel, script or piece "from" a talk or recording.
argument-hint: "[a recording or transcript | make <what> from <which> | brief <title> | brands]"
when_to_use: Also when Adrian says "make a reel/post/carousel about X" and X was said in a recorded conversation, or names a brand profile.
---

# /arcreate

Anything Adrian says out loud becomes content that teaches, and the people who spoke learn from it too. Adrian, 2026-10-04: "once someone who speaks learns about the fact, like myself, I will start sharing that fact, so the key is to help educate the audience and speakers."

The plan this skill was built from: https://claude.ai/artifact/FYMcaVbVUVFcyQYz8EgqeJ

## Before anything

Installed from the AR Create repo (`editorial/skills-next/arcreate/`); edit it there. Since 2026-10-21 AR Create is the magazine's one writer.

For Teajia work on this Mac (`uname -s` is Darwin), everything here reads and writes through AR Create exactly as /mag does (its SKILL.md, "Which path"): `node "$MAG" hold "/arcreate <what>"` at the start and `release` at the end; `read` then `put --expect <hash>` for every file (RESEARCH, BRIEF and ASK save directly; anything made for Instagram is written with `status: for-your-yes`, so the page asks Adrian; other words in his voice become a proposal for his yes). If AR Create does not answer, stop and say so. Off this Mac, take the shared lock as /mag's [legacy path](../mag/stages/legacy.md) says. Read [the magazine lessons](../mag/LESSONS.md) too; they apply to everything made here.

A brand's profile is also served by AR Create (`brand.read`, from `editorial/brands/`); the copies in [brands/](brands/) are installed from there.

## The path

1. **In.** A recording or transcript arrives. For Teajia it comes through the magazine's drop folders and intake (`/mag`, [stages/intake.md of mag](../mag/stages/intake.md)), which already transcribe, separate speakers and file the transcript. For any other brand, see the brand's profile.
2. **Clean record.** Speakers named, fragments joined, grammar and typos fixed only, meaning kept, unclear words flagged instead of guessed. For Teajia this is the magazine's SRC step.
3. **Research**: [stages/research.md](stages/research.md). Facts checked, teachings traced, speakers protected.
4. **Brief**: [stages/brief.md](stages/brief.md). One per recording; everything made later is made from it.
5. **Make, when asked**: [stages/make.md](stages/make.md). Nothing is made ahead. Adrian asks for a thing in the moment and it is made then, from one brief or several, and he approves it as he sees it.

Steps 3 and 4 run once per recording, straight after the clean record, without being asked. Step 5 runs only on his request.

## Gathered material, no form yet

When Adrian brings photos, recordings or his own words and has not said what they will become, do not pick the form for him. Run the soup-to-dish order from the ar-create-concepts skill ("Soup to dish: Simmer from this chat"): carry the material in with `simmer intake`, propose onto the board with `simmer propose`, wait for him to name the dish, record his exact sentence with `simmer name`, and only then make anything (step 5 above) from that sentence.

## Brands

Every recording belongs to one brand, and each brand has a profile in [brands/](brands/): where its files live, who narrates, words to avoid, where each kind of output goes, and how research feeds anything it publishes.

- [brands/teajia.md](brands/teajia.md): tea, Teajia, the magazine, Instagram, the Tea Wisdom reference.
- [brands/art.md](brands/art.md): the sculpture and spaces practice, the Universal Language series, the Writings on adrianrasmussen.com.
- [brands/mandala-codes.md](brands/mandala-codes.md): the Mandala Codes oracle deck, its cards and mandalas.
- [brands/personal.md](brands/personal.md): Adrian's own life and discoveries, written as reflection.
- A recording for a brand with no profile: build one from [brands/_template.md](brands/_template.md) by asking Adrian its five questions, once, then keep it. Never guess a brand's voice.

Keep brands apart: one brand's voice, links and calls to action never appear in another's output unless Adrian bridges them himself.

## Always

- **Speakers keep their words.** A researched fact or idea never goes in a speaker's mouth; it appears in narration or a note. Words inside quotation marks are never changed.
- **Nothing in Adrian's voice is published without his yes.** For the magazine that is its `==…==` gate; for anything else, he sees the finished thing and says yes before it is marked approved.
- **Only what research allows is stated as fact** (usable as fact, qualified with its limiting words, held back not at all).
- **Real photos only.** Never stock, never a made image.
- **No em dashes.** Plain words; no file names, step numbers or system words in anything Adrian reads.
- Adrian's own voice: read the voice and body-of-work directions in i64os (`substrate/directions/voice-profile.md`, `body-of-work.md`) before writing any line as him.

## What the argument means

| Adrian gave | Do |
|---|---|
| a recording or transcript | Find its brand (ask once if unclear). Teajia: hand it to `/mag` intake, then research and brief. Other brands: the profile's "In" section, then research and brief. |
| `make <what> from <which>`, or any "make me a reel/post/carousel…" | [stages/make.md](stages/make.md) |
| `brief <title>` | Show that brief as a reading link, short. |
| `brands` | List the profiles and what each one covers. |
| nothing | List recordings that have a brief, newest first, one line each with their brand and what has been made from them. Then stop. |
