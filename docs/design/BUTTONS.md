# Buttons: the nine styles and what each older look became

The master style file, `public/ui/tokens.css`, draws every button in AR Create with one of nine styles. A new control takes one of the nine classes (`ar-primary`, `ar-secondary`, `ar-quiet`, `ar-icon`, `ar-tab`, `ar-nav`, `ar-chip`, `ar-link`, `ar-field`). It never gets a look of its own. The older class names listed below are drawn by the same rules, so existing screens follow without edits.

All nine share these settings: corner 6, text 13 at weight 600 (tabs and nav 14), height 28 small / 32 default on desktop, 44 on touch screens only. Nothing moves on hover.

| Style | Look | Older classes now drawn this way |
|---|---|---|
| primary | ink fill, paper text, one per area | coss default (`bg-primary`), `.subj-btn.pri` (Open the Simmer board), `button.pri`, `.home-new`, version two's phone Capture (`.v2-cap`) |
| secondary | soft grey fill, ink text, no edge | coss outline and secondary, `.subj-btn`, `.wr-btn`, `.lk-link`, `.sb-btn`, `.ht-find-all`, Advanced `.btn`, `.cp-saved`, and every plain button through Graphite |
| quiet | no fill, quiet text, fill on hover | coss ghost, `.v2-ghost`, Advanced `.tbtn`, `.cp-subject`, `.cp-main-tool`, `.cp-more`, the rail's Collapse |
| icon | quiet, square | coss icon sizes, `.v2-icon-btn`, `.cp-new`, `.ht-place.ht-theme` |
| tab | text, a line under the current one | `.h3-nav`, Write's piece tabs (`.wr-tabs > a`), Looks' brands (`.lk-pills`), version two's home switch (`.home-seg`), Advanced's piece tabs (`.cp-tab`) and Edit / Read (`.cp-modes`) |
| nav | a tab at band height; a filled row in a side rail | version three's band places (`.v3-place`), phone bar (`.v3-pq`), Advanced's rail (`.combined-band-tools`) |
| chip | 24 tall, hairline edge; dashed only for "add" | Subject's forms (`.subj-form`), home stage counts (`.home-chips`), Slides' chips, Research's choices, Looks' "Used by" |
| link | accent text, no box | `.subj-link` (Change, Next), coss link |
| field | button height and corner, paper fill, hairline edge | every input and select in versions two and three, `.h3-find`, `.v2-find-box`; Advanced's fields through Graphite |

## The 84 measured looks

The audit of 18 November 2026 measured 84 distinct control looks across 22 screens at desktop and phone width, in 28 groups (the audit report's button inventory). Each group now draws as:

| Audit group | Was | Now |
|---|---|---|
| 1 band places | 47 tall, underline | nav |
| 2 band quiet actions | 28, corner 10, weight 500 | quiet |
| 3 home row icons | 28, corner 10 | icon |
| 4 New subject | 32, corner 10, weight 500 | primary |
| 5 coss outline actions | 28 to 32, corner 10, paper with an edge | secondary |
| 6 home tabs | 32, underline | tab |
| 7 Write bar | 32, corner 6 | quiet |
| 8 Write / Read / Check and piece tabs | about 38 | tab |
| 9 Edit words, Back | 28, corner 6 | secondary |
| 10 New topic, Account | 28, corner 10 | secondary |
| 11 Research Find | 30 | primary |
| 12 Open the Simmer board | 36, no class (quoting bug, fixed) | primary |
| 13 Subject form chips | 34, pill | chip |
| 15 Change, Next | 20 | link |
| 17 Looks brands | 34, pill | tab |
| 18 Looks "Used by" | about 26, pill | chip |
| 19 phone bar | 44 | nav |
| 20 version two home chips | 28, pill | chip |
| 21 version two home tabs | 24, corner 5 | tab |
| 22 version two icons | 32 | icon |
| 23 version two phone Capture | 44, pill | primary |
| 24 Advanced rail | 34, text 13.5 | nav |
| 25 Advanced Check, History | 28 | secondary |
| 26 Advanced Thought, A−, A+ | 28 | quiet |
| 27 Advanced Edit / Read | 28, corner 4 | tab |
| fields | 28 to 48, corner 6 or 10 | field |

Three groups are not buttons and keep their own shape: 14 (the subject page's step list, a list row), 16 (a note tile, a card) and 28 (Advanced's search results, list rows).

Measured after the change, the review screens show 24 looks at desktop, down from 41 to 48 on the same screens (the count before varies with hover and loading): the nine styles, their current and hover states, small and default sizes, and the three list rows above.
