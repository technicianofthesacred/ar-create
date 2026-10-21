# Teajia

**Covers:** tea talks, tea trips and shop visits, sourcing, guest interviews, tea spaces. Not the shop's sales, stock or invoices: those are the shop's own tools, never this skill.

**Outputs:** the magazine on teajia.com (`/mag`), Instagram, the Tea Wisdom reference.

## In

Every Teajia recording comes in through the magazine: the drop folders and intake in `/mag` (the recording workshop on the magazine page transcribes, separates speakers and files the transcript). It becomes a story on the magazine board even if Adrian only wants posts from it; whether it also becomes a magazine piece is decided at the map, like any story. The clean record is the story's SRC.

## Where things live

All under the magazine folder in the vault (MAG, as `/mag` defines it), in `Workflow/`, the only place Claude may write there:

- research: `3-Develop/RESEARCH - [Title].md`
- brief: `3-Develop/BRIEF - [Title].md`
- carousels, posts, reel and video scripts: `5-Social/[KIND] - [Title] - [a few words].md`, KIND being CAROUSEL, POST, REEL or VIDEO
- before-publishing notes to a speaker: `6-Feedback/BEFORE - [Title] - [Name].md`

Transcripts and briefs are private: nothing from them goes into the site repo except what `mag send` generates from an approved draft.

## Voice

- The site speaks as Teajia. Never write "Adrian" in site copy; only the About page, bylines and photos of him stay personal. A magazine story is told by Adrian in his own first person, by its own rules (`/mag`).
- Instagram: the profile and bio speak as Teajia, never "I". A post that carries one of Adrian's lines from a story keeps it as his.
- Never: "master", "ceremony", "wellness", "canonical", emoji, "DM me", em dashes. For Japanese tea say "the Way of Tea" or "chanoyu".
- Chinese terms with characters and pinyin, from the tea term library (`node ~/builds/tea-terms.mjs <words>`).

## Shapes

- **Magazine carousel** (from a published story): nine slides. Title, photo, five quote slides, photo, "read the full story". Quotes and Adrian's lines only.
- **Any carousel, post or reel** links to one specific page on teajia.com, by default /start, or the story itself once it is live.
- **Photos:** real only, never stretched (crop, don't squash), no grain. Photos of Adrian show his hands and the practice, not his face.

## Instagram look

Every carousel, post and reel follows these two pages in Adrian's Claude account. Read them before making one (the canvas is a Design canvas: Artifact tool `read` with `path: "project/canvas.json"`, then the slide templates it lists; the guide is a Claude Docs doc, so read it with the Claude Docs connector's `read`, ref `{"object":"project","id":"2e628253-f6a5-415a-b50d-c5238c39b773"}`), and show Adrian the result laid out on the canvas, never only as text.

- **Instagram system**, the template canvas, one row per slide role: https://claude.ai/artifact/8esgxBsfUugunEDBaHAVkT
- **Instagram guide**, the rulebook for color, type, logo, photos and the three jiā seals: https://claude.ai/artifact/6jDJ9Wm3WmwE3fgH4cnhra

If this file and the guide disagree on how a post looks, the guide wins.

## Teach entries and research

- Every term worth defining: a row in `Workflow/_glossary-queue.md` (term, Chinese, pinyin, one-line definition, the speaker's own words about it, story).
- A teach point that defines a term, region, style or named tea is also proposed to the Tea Wisdom reference through the i64os `capture` tool, never written to the site directly. Research states map straight onto the reference's own: usable, qualified, held back.

## Speakers

- After publishing, every person in a magazine story gets the feedback message (`/mag`), which now carries their "What we learned" lines.
- Adrian is the editor and decides every speaker's flagged lines on the magazine page's ledger. A before-publishing note goes to a guest only when he wants them to restate something, in their language (Chinese for Chinese-speaking guests). Facts from guests take days: ask early, all at once, and never hold anything back waiting.
- Credit people as they ask to be credited.

## Keep apart from

Adrian's art work (Adrian Rasmussen, Technician of the Sacred) unless he bridges tea and art himself.
