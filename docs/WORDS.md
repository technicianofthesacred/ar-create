# Shared words: one transcription process

Adrian had four separate transcription setups (the phone oracle in mandalacodes, Teajia, i64os, AR Create). They are becoming one process, so that when one improves, all do. AR Create owns it because it alone has checkpointed long-audio transcription, speakers, correction receipts, a review page, the Needs you list and Simmer.

```
transcribe  ->  recognise words  ->  check they are right  ->  place each piece
   primed by      library hits,        one contextual ask,       (Source, Simmer,
   the library    known mishearings    his answers remembered      Direction, ...)
                  fixed with a receipt,
                  doubtful words found
```

Phase 1 (this page) is the library and the first three steps, inside AR Create. Phase 2 makes mandalacodes, Teajia and i64os read the same library (see [Phase 2](#phase-2-what-the-other-projects-import)).

## The word library

One JSON file in the home's `data/word-library/library.json`, written only by the server (one serial queue, atomic replace). Read it through the CLI (`words list`, `words export`), never directly. Entries:

| Field | Meaning |
|---|---|
| `spelling` | The correct spelling, as it should be written. |
| `category` | `person`, `place`, `tea-term`, `gene-key`, `hexagram` or `other`. |
| `variants` | `{text, kind, languages}`. `kind: heard` is a known mishearing or respelling and is **fixed automatically, with a receipt**. `kind: alias` is another valid name (Wilhelm's "Ch'ien" for The Creative): recognised, never rewritten. |
| `languages`, `zh`, `trad`, `pinyin` | Which languages the word is spelled in; Chinese forms for the Chinese prompt. |
| `source` | Where it came from: `import` (a seed file), `confirmed-answer` (Adrian answered a doubtful word, with the recording, the time and the sentence), or `manual`. |
| `addedBy`, `addedAt`, `status` | Provenance. `status` is `confirmed` or `proposed`. |

Only **confirmed** entries reach a prompt, a fix or the export. An agent can suggest a word (`words add`): it is marked proposed by that agent and waits on the Words screen. An agent that suggests a mishearing for a word that is already confirmed adds a *proposed variant* to it, which changes nothing until Adrian confirms.

### Seeds

`words import --input '{"source":"tea-terms"}'` reads `~/builds/tea-terms.json` (read-only; the `tea-terms` tool and skill keep working untouched). `{"source":"oracle-cards"}` reads the 64 hexagram names (Wilhelm's romanisation as an alias, the Chinese character and pinyin from `data/hexagramChinese.ts`) and the Gene Keys shadow, gift and siddhi names from mandalacodes' `oracle/oracle_cards_complete.json`, also read-only. An optional `path` names another file of the same shape. A repeat import adds what is new and never removes or changes what Adrian taught the library. Seeding is for Adrian or an `import:<source>` actor; agents cannot import.

Unlabelled seed variants are sorted by a conservative rule: a respelling close to the spelling (same first letter, at most 40% edits) is `heard`; anything else (a synonym such as "ripe puerh" for Shou Puerh) is an `alias`. Under-fixing is the safe direction.

## Prompt

The transcription job (`runtime/services/magazine/intake.mjs`, `vocabularyPrompt`) builds the speech model's vocabulary prompt from the library: per language (`en` or `zh`; the Chinese prompt uses the Chinese forms), inside the existing 160-token budget, in this order: words Adrian has corrected before, core words, words with known mishearings, then by category. A topic set (`job.terms`) lifts its words within a tier. Plain lowercase English words are left out: they cost budget and the model spells them. With nothing confirmed in the library the old Teajia `tea-terms` path is the fallback.

## Recognise, fix, check

After a transcript exists (a recording that finishes while the server is running, or `words recognise <jobId>` for any finished recording):

1. **Known mishearings** of confirmed words are replaced through the recording owner's own correction receipts (`.corrections/<id>.proposal.json`, `kind: library-variant`, exact before and after, status `applied`). The first transcript, RAW and the audio are untouched. A transcript Adrian already **reviewed** is never changed on its own: its fixes become words to check.
2. **Doubtful words** require independent speech uncertainty. Ordinary capitalization, a confident number, or resemblance to a specialist vocabulary entry is insufficient. Fuzzy suggestions are conservative person/place candidates; confirmed explicit mishearings remain supported. Previously saved open items are requalified before presentation and stale replacements are withheld. Original evidence can continue across the owner's exact guarded corrections; an unrelated source change cannot refresh every pending item's authority.
3. **One contextual request per real recording.** Home combines pending word and passage checks with a readable title, actual speech context, clearly proposed wording, reasons and surrounding audio where available. Exact overlapping excerpts share a player without discarding distinct proposals or separate moments. Whole microphone/system checks and explicitly marked tests are excluded; titles about testing and unnamed real work are retained. Historical records and human decisions remain intact. Recording reviews wait for explicit human decisions: no timed Keep-all approval or manual Home Done shortcut. Review links lead to the existing Words or transcript-check owners; unrelated steer asks keep their defaults.
4. **Answers are Adrian's, from the app.** Per word: keep as heard, use the library's suggestion, spell it another way, or "that is right, remember it". A confirmed spelling is saved: a new entry, or a new `heard` variant on the entry that already has the spelling, with the recording, time and sentence as provenance; and the recording is corrected everywhere that word was heard, through a correction receipt. The next recording in any project gets it right. A number or date is corrected for that recording only and never becomes vocabulary. A word kept as heard twice stops being asked about.

Agents: `words recognise`, `words check`, `words checks`, `words list`, `words export`, `words add` (suggest). Human-only (exit 5 for anyone else, and the service also requires the app's own page for answers): `words answer`, `words decide`.

## Other AR Create surfaces that use it

The Instagram studio flags the words to confirm in a voice note from this library (confirmed words and the mishearings Adrian taught it; with nothing confirmed yet it still falls back to the tea-terms file), and when Adrian confirms a correction there, the library remembers it (`sharedWordLibrary`, one writer for the whole server). Its own "Needs you" ask is a different thing from the recording check: it is about words a piece is about to use, before they go on Instagram, so it stays Only Adrian and links to the plan.

## Export (for phase 2)

`ar-create words export` (GET `/api/words/export`) prints a versioned snapshot; redirect it to a file at deploy.

```json
{
  "schema": "ar-create.word-library.export.v1",
  "version": "12.9ff9a1a2",
  "libraryRevision": 12,
  "contentHash": "<sha256 of the entries below>",
  "exportedAt": "2026-11-03T08:00:00.000Z",
  "counts": {"entries": 473, "byCategory": {"person": 5, "place": 30, "tea-term": 184, "hexagram": 62, "gene-key": 186, "other": 6}},
  "categories": [{"id": "person", "label": "Person"}],
  "promptBudgetTokens": 160,
  "prompts": {"en": "Names and terms in this conversation: Lu Yu, ...", "zh": "以下是访谈中出现的名字和术语：陆羽、..."},
  "entries": [{
    "id": "uuid", "spelling": "Lu Yu", "category": "person", "languages": ["en", "zh"],
    "zh": "陆羽", "trad": "陸羽", "pinyin": "lù yǔ", "note": "", "sets": ["person"], "core": true,
    "variants": [{"text": "loo you", "kind": "heard", "languages": ["en"]}],
    "source": {"kind": "import", "ref": "tea-terms.json"}, "addedBy": "import:tea-terms", "addedAt": "2026-11-03T08:00:00.000Z"
  }]
}
```

`version` changes when the words change and is stable when they do not (`contentHash` covers the entries only, not `exportedAt`). Only confirmed entries appear. Optional entry fields (`zh`, `trad`, `pinyin`, `note`, `sets`, `core`) are omitted when empty. `prompts` are ready to use as the speech model's prompt; a consumer that builds its own prompt should follow the order above and the 160-token budget.

## Phase 2: what the other projects import

Consumer imports are implemented. Each project vendors a committed, versioned export: `shared/words.snapshot.json` in mandalacodes and Teajia, and `packages/shared/words.snapshot.json` in i64os. Their existing transcription paths use the shared prompt and correction helpers; deployment consumes these source snapshots without reading the installed AR Create `data/` directly.

Source qualification on 5 November found identical schema `ar-create.word-library.export.v1`, version `2.c0f92872`,473 entries and SHA-256 `264d8321f529aee8215642596956b09e2d5bbc507c11d24012628a783a7f3c7f` in all three copies. The qualified callers include Mandala memo/quick/authoring/reflection transcription, Teajia Curate voice transcription, and i64os Telegram transcription. Updating a snapshot is an explicit reviewed source update using the export contract above. This does not claim a fresh export from the private running library or live transcription acceptance.
