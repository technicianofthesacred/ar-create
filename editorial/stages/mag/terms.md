# Tea terms pass (`/mag terms`)

Go through the tea terms in every story at once, using the term library `~/builds/tea-terms.json`. Read TEMPLATE.md section 9.

1. `node ~/builds/tea-terms.mjs --sync`, so every term knows whether it is on teajia.com.
2. For each story, `node ~/builds/tea-terms.mjs --scan "<file>"` on its DEV files (and on the published story). Each line gives the term's Chinese, English, pinyin, how often it came up, and whether it is on teajia.com, in the glossary queue, or not in the glossary yet.
3. Every term a draft or published story uses that is "not in the glossary yet" gets a row in `MAG/Workflow/_glossary-queue.md`: term, Chinese, pinyin, one-line definition, the subject's own words about it (from SRC, never invented), story. Skip terms already queued.
4. Run the same scan on each story's SRC. Where a heard form looks like a mishearing ("shao pu" for Shou Puerh), list it with its time for Adrian to confirm. Fix nothing yet: a confirmed fix follows SYSTEM.md's mishearing rule ("### Cleaning the transcript"), and RAW is never touched.
5. Add any new mishearing to that term's `variants` in the library, then `node ~/builds/tea-terms.mjs --check`.

Stop and show, per story: the queue rows added and the mishearings to confirm. One short list each; skip a story with nothing.

One-off lookups need no pass: `node ~/builds/tea-terms.mjs <words>` (the `/tea-terms` command does the same).
