# Photos: steps 8 and 9

Photos are a side track. Adrian puts them in the story's Photos folder whenever they are ready: `Files/1 Areas/Brands/Teajia/Magazine/[Title]/Photos/` (intake makes it; the board shows the count and the link `http://localhost:8766/photos/<Title>` opens it in Finder). The text never waits for them: a story moves through steps 1 to 7 as text only (TEMPLATE section 6).

**From a shared iCloud album** (someone else's photos, or Adrian's own album): when Adrian gives a story's shared album link, run it with the sandbox off (it reaches iCloud and writes to Files):

```bash
node ~/builds/mag-photos.mjs "<Story>" "<shared album link>"
```

It downloads every photo into the story's Photos folder in album order (01.jpg, 02.jpg…), keeps the link, and on later runs (`node ~/builds/mag-photos.mjs "<Story>"`) pulls only new ones; it never overwrites or deletes. The album needs "Public Website" on; if iCloud refuses, tell Adrian exactly that one switch. Shared albums hold photos at about 2048 pixels, enough for the page. Run it again before step 9 if the board says an album is linked.

Step 9 starts when the text is approved (step 7 done) and the Photos folder has photos, or when Adrian says they are in. Read TEMPLATE.md section 6 and SYSTEM.md, "## Photos".

**Placed by what they show, not by file name** (Adrian, 2026-10-04: the shots are done by the time he leaves, so the choice is where each one goes). A number on a file is only a tiebreak (SYSTEM.md, "## Photos").

1. **Look at every photo.** Open each one and write one line per photo into NOTES: what it shows. Convert a HEIC to a JPEG copy in the scratchpad to look at it (the sandbox must be off for `sips` on HEIC); never write into the Photos folder.
2. **Match each to its passage.** For each photo, the passage it actually shows: the moment, the place, the object, the person (the story's MOMENTS file helps where there is one). A photo that shows nothing in the text is set where it best opens or closes a part. Every photo still goes in (TEMPLATE section 6).
3. **Place them in the DEV** at those passages: between thoughts, never splitting one; a side holds a whole thought; no more than two photographs in a row. Use the photo notes from SYSTEM.md, "### From draft to page (mag-send)", naming each photo by its file name, with an alt line from what you saw.
4. **Mark the passages with no photo.** A moment the story leans on that no photo shows is left as words, or carries a large line (`%%pull%%`) so the page still breathes. List them in NOTES; never ask for a reshoot and never fill one with a stock or made image.
5. Run `node ~/builds/mag-check-splits.mjs "<DEV>" "<SRC>"` again.

When showing step 10, add one plain line: how many photos moved from their file-name order and the main reason ("the kiln photos now sit with the kiln").

Stop and show the reading-page link ([preview.md](preview.md)): that is step 10, his look with the photos in. Photos rarely change the words; they move the layout, so expect him to nudge which line sits by which photo. When he has looked and every check passes, say "Ready. Say publish." and nothing more until he does. A missing name never holds a story back: the feedback message asks.
