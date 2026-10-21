# Tidy (`/mag tidy`): one draft per story

Run after a story gets a new draft, or when Adrian asks. Preview first, then apply:

```bash
node ~/builds/mag-tidy.mjs            # what would move
node ~/builds/mag-tidy.mjs --apply    # move and commit
```

Kept per story: the newest draft, every part of a story split into parts (and the draft they came from), the notes of each kept draft, and the newest check. Older drafts, their notes and older checks move to `MAG/_archive/Superseded drafts/<story>/` with git, so nothing is lost. Sources (SRC, CONTEXT, MAP, PLANS) are never touched.

Before applying, check two things: the draft it keeps is the one STATUS.md calls current (if STATUS names an older draft as the one Adrian is reading, stop and ask), and no draft behind a live page moves (the site's page names its draft in a comment). After applying, fix any STATUS.md line that names a moved file.
