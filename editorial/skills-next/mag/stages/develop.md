# Develop: the plan becomes a draft (DEV)

Read TEMPLATE.md in full: it is how every story reads, and it wins over anything else. Read SYSTEM.md, "## 3: Develop (DEV)", for the draft's shape, and SYSTEM.md, "### From draft to page (mag-send)", for the markup the site reads.

## Before writing

1. **Adrian's context note:** `MAG/Workflow/1-Source/CONTEXT - [Title].md`. If there isn't one, ask him for a few lines (how he got there, why he came, who connected him, and a closing thought), typed or spoken. Lightly edit it (TEMPLATE section 8), keep his original underneath, and never invent one.
2. **His own lines first.** Adrian's first-person telling (TEMPLATE section 4): show him two or three in the reading page before writing the rest; adjust to his reaction, then do the rest the same way. Rewriting all of them round after round, each fix making the next complaint, cost a whole afternoon on 2026-10-01.

## Writing

- Make `MAG/Workflow/3-Develop/DEV - [Title].md` from the chosen plan. A story, not an interview (TEMPLATE section 4), in the draft markup mag-send reads, so the approved draft goes onto the site unchanged.
- Copy the shape of `MAG/Workflow/_style/gold-porcelain-and-tea.md`, the draft behind the live Porcelain and Tea.
- Text only at this stage: no photo notes until the text is approved (TEMPLATE section 6).
- Keep the draft to the story: working notes go in `NOTES - [Title].md`, and Adrian gets at most five `%%you%%` notes in context (TEMPLATE section 10).
- Facts from research go in only as connecting lines, never in a speaker's mouth, and only as RESEARCH allows: usable as fact, qualified with its limiting words, held back not at all. Every line its speaker check cut or corrected stays that way.
- Mark glossary terms as `[[term:<id>|<text>]]`. A term not in the teajia.com glossary gets a row in `MAG/Workflow/_glossary-queue.md`: term, Chinese, pinyin, one-line definition, the subject's own words about it (from SRC, never invented), story.
- Check quotes before showing anything: `node ~/builds/mag-check-quotes.mjs "<DEV>" "<SRC>" "<CONTEXT>"`.

Stop and show: how many connecting lines, how many notes for him, and the reading-page link. Then the draft goes to [review.md](review.md).
