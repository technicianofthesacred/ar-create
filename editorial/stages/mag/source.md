# Source: RAW becomes SRC

Read SYSTEM.md, "## 1: Source (SRC)", from that heading to the next `## `. It holds the SRC format, the grades and the cleaning rules.

Make `MAG/Workflow/1-Source/SRC - [Title].md`: clean the transcript, label speakers, grade the source, mark 10 to 15 highlights.

- Recognise tea terms with the library `~/builds/tea-terms.json` (look one up: `node ~/builds/tea-terms.mjs shou pu`). RAW's `terms_heard` frontmatter lists what intake already spotted, each with its Chinese and pinyin and whether it is on teajia.com, in the glossary queue, or not in the glossary yet.
- List any mishearing you fix under "names and Chinese terms to check", and add new mishearings to that term's `variants` in the library, then run `node ~/builds/tea-terms.mjs --check`.
- Whisper does not know who is speaking: mark any turn you are unsure of `(speaker?)`.

Stop and show Adrian: the grade, any `(speaker?)` turns, and the names and Chinese terms to check.

**Older stories.** The eight stories on the board before mag-intake existed have no RAW and no times: their SRC is the record (SYSTEM.md, "Sources older than mag-intake"). Old-style `GUIDE - …` files are in `MAG/_archive/`; ignore them.
