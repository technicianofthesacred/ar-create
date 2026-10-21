# Make: whatever Adrian asks for, when he asks

Adrian, 2026-10-04: "it doesn't matter what first, it's creating which I'm looking for in that moment." Nothing is made ahead of time. He asks ("a reel from Hong Kong day one", "a carousel on storage"), and it is made then, from one brief or several.

## Requests from the magazine page

Adrian can also ask from the magazine page ("Make from this": carousel, post, reel, video script). Each ask is a line in `MAG/Workflow/5-Social/REQUESTS.md`: `- [ ] <date> <Kind> · <Story>`. Lines whose kind starts `Redo` belong to `/mag`, not here. At the start of every `/arcreate` or `/mag` run, make each unticked one as below and tick the line once it is saved for his yes (`- [x]`, with the file it went to). The page says "asked" until the line is ticked.

## Every time

1. **Find the briefs.** The one he named, or every brief whose line, quotes or threads touch what he asked for. Say in one line which ones you are drawing on.
2. **Read the brand's profile**: voice, words to avoid, where this kind of output goes.
3. **Make it** in the shape below. Only quotes and facts the brief allows. Every line in Adrian's voice follows the voice directions; never a researched fact in a speaker's mouth.
4. **Put it where he decides** (Adrian, 2026-10-04: approve made things on the page, not in chat). For Teajia, save it in `Workflow/5-Social/[KIND] - [Title] - [a few words].md` with frontmatter `kind:`, `story:` (the story's name exactly as the board knows it), `briefs:` and `status: for-your-yes`. The magazine page then shows it inside that story as "Is this … good to go?", with "Yes, it is good" and "Change this". In chat say only one line and the page link. Other brands: show it in chat until they have a page.
5. **His yes is the approval.** The page writes `status: approved` and the date, or `status: change` with his note under "## Adrian's change". At the start of each run: for every approved one not yet recorded, add a line to each brief's "Made from this"; for every change, make it, set `status: for-your-yes` again and drop his note into the file's history. Never set `approved` yourself.

If what he asks for needs something the brief holds back (a line without a speaker's yes, an unconfirmed fact), say so in one line and make it without that.

## Shapes

Each brand's profile may tighten these; the profile wins.

- **Magazine story** (Teajia): hand it to `/mag`, which runs from the map onward. The brief's research is already done for it.
- **Teajia carousel, two stops** (Adrian, 2026-10-05): words first, then the look.
  1. **Words.** Save the file with `status: for-your-yes` and `stage: words`, and only two sections. `## Slides` has one numbered line per slide, `1. [role] words` or `2. [quote · Speaker, Credit] "words"`, with roles cover, line, quote, teach, chapter, photo (no words) and close. `## Caption` comes after it. The magazine page shows it as a lineup of slide cards he drags to reorder, edits in place and cuts. "Yes, these words" sets `status: words-yes`. Each slide line also names its picture: `3. [scene · photo: the tea table, cups mid-pour] words`.

     **How the words flow** (Adrian, 2026-10-05: the carousel should tell more, hook, show great photos, and lead people to the article, which is being built alongside it; the template is polish). The carousel is the trailer and the article is the film:
     - **Slide 1 hooks.** It's a tension or a question the story answers, readable in one glance with no context. It's never a summary or a title card.
     - **Slides 2 and 3 put the reader in the room.** Use the strongest photo, with few words (eight or fewer on a photo-led slide).
     - **The middle is 3 or 4 beats, each one new:** a voice line, a fact from research, a turn. Every slide earns the next swipe.
     - **Hold the payoff back.** Raise the question the article answers and stop short of answering it. The second-to-last slide opens a loop the article closes.
     - **The close gives one reason to read**, plus the story's title and its own page on teajia.com (teajia.com/read until it is live).
     - **The order is article, then Instagram, then photos** (Adrian, 2026-10-05: "content doesn't need photo to land but IG does"). The words come from the article's key points: the draft once there is one, and the brief's line, teach points and threads before that. A carousel or story is cut from the article. Photos are matched to the slides afterwards, in stop 2, from the story's own folder.
     - **Record what it was cut from**, in frontmatter: `cut-from: brief` or `cut-from: draft YYYY-MM-DD`.
     - **Re-cut automatically when the article is done** (Adrian, 2026-10-06). On every `/arcreate` and `/mag` run, look for any carousel, post, reel or story file marked `cut-from: brief` whose story has reached step 8, meaning the draft is checked with his changes in. Re-cut its words from that draft without asking first. Keep his order, his edits and his cuts wherever the line still holds, and change only what the article now says differently. Then set `cut-from: draft <date>`, `status: for-your-yes` and `stage: words`, even if he had already said yes, and write a `## What changed` section with one plain line per change (for example "Slide 6: the door line now matches the article's ending"). If nothing changed, update `cut-from` and leave the status alone.
     - **Never guess a photo.** In stop 1, slides carry no `photo:` at all. In stop 2, a slide names a real file, `photo: IMG_2041.jpg`, or stays unmatched and says so. Never describe a picture that may not exist. (The first Hong Kong lineup invented 5 of its 8 photos.) The best real photo goes on slide 1 or 2. It can't post until every photo-led slide has a real photo.
     - **The caption's first line is a hook** (it's what shows before "more"). Then 2 to 4 short sentences, ending on the article.
  2. **The look.** For each `words-yes` file whose story's photo folder (`<MAG_FILES>/<story>/Photos`) has photos, look at every photo with the Read tool and match the best real photo to each slide, putting the strongest on slide 1 or 2. Then pick a template per slide from `~/builds/ig-templates.js`: H6 night bleed or F1 for a cover, F1, H1, H4, H9 or N9 (two photos) for an inner slide, M12 for words with no photo, and H10 or H9 for the close. These were measured from the Instagram system canvas, and the logo rules are built in. Write each slide as `1. [hook · template: H6 · photo: IMG_2041.jpg · crop: 50/40] words`, where crop is the focus point in percent across and down, and N9 takes `photo: a.jpg, b.jpg · crop: 50/50, 50/50`. A slide with no fitting photo gets M12 or `photo: -`, never a guess. Add `label: JOURNEY 01 · HONG KONG` (the inner-slide label) to the frontmatter, and set `stage: look` and `status: for-your-yes`. The magazine page then shows the real slides: he drags to reorder, taps a slide to switch layouts, drags photos onto it and drags the crop. "Yes, it is good" sets `approved` and saves every slide as a 1080 × 1350 PNG, plus `caption.txt`, in a folder beside the file (same name, without `.md`). It syncs to the phone through the vault, and the story shows them under "Ready to post". HEIC photos are fine: the page shows them through a JPEG copy in `~/builds/.mag-cache`. To look at a HEIC yourself, convert it there first with `sips -s format jpeg`. Don't touch the words in this step.
- **Carousel**: a title slide, then one idea told across the slides, each slide one short line or one quote, a photo where one shows the moment, and a last slide that says where to go next. Teajia's magazine carousel is nine slides (see its profile).
- **Post**: one sharp idea, one photo, a caption of two to five short sentences, and where to go next.
- **Reel script**: 30 to 60 seconds. The first line is the hook and works with the sound off as on-screen text. Then the lines to say on camera, or the speaker's own line from the recording with its time, and beside each line what is on screen, chosen from photos and clips that exist. End on one line and where to go next.
- **Video script**: longer, in parts, each part one point from the brief, with the moments and quotes that carry it, and what is on screen.
- **Teach entry**: a term, its characters and pinyin where it has them, one plain definition, and the speaker's own words about it from the clean record. Where it goes is in the profile.
- **Anything else he asks for**: make it in the shape he describes, under the same rules, and if he asks for it a second time add its shape here.

## Series

When three or more briefs share a thread, say so once when he next asks to make something from any of them: the thread, the recordings, and that it could be a series. Never more than once per thread unless a new recording joins it.
