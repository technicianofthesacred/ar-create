# Tidy (`/mag tidy`): one draft per story

Run after a story gets a new draft, or when Adrian asks.

**On this Mac:** `node "$MAG" tidy` shows what would move. Moving them is Adrian's call: tell him what moves and ask him to press Tidy in AR Create (`magazine.tidy.apply` is his alone). **Off this Mac:** [legacy.md](legacy.md).

Kept per story: the newest draft, every part of a story split into parts, the notes of each kept draft, and the newest check. Older drafts, their notes and older checks move to `MAG/_archive/Superseded drafts/<story>/`, so nothing is lost. Sources (SRC, CONTEXT, MAP, PLANS) are never touched.

Before he applies it, check two things: the draft it keeps is the one STATUS.md calls current (if STATUS names an older draft as the one Adrian is reading, say so), and no draft behind a live page moves (the site's page names its draft in a comment). After it is applied, `node "$MAG" status-table`.
