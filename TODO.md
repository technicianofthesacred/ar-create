# AR Create: remaining work

Reconciled 10 November 2026; installed release refreshed 13 November 2026 (version three's Home, tag `v2026.11.13-pr253`, see [WORKS](docs/status/WORKS.md)). [CURRENT](docs/status/CURRENT.md) is the status authority; [release reconciliation](docs/status/RELEASES-2026-11.md) records completed releases and their proof. Delivery picks which item runs next and merges the result. Earlier assignments are kept in the [6 November checklist](docs/history/delivery-checkpoint-2026-11-06.md). The codes at the end of each item (C01, S05) point into the [section briefs](docs/product/sections/README.md); use them to find the brief, not in reports to Adrian.

## Next useful checkpoint

| Work | State and next owner | Finished when |
|---|---|---|
| Review the generated Article (C01/C04, S05/S06) | **Waiting for Adrian.** The first live Article was generated on installed PR230 and its proposal was still waiting on 10 November. The app has since been released twice (13 November); the proposal was not re-read in that release check. Leave the review and his two live tabs at 8841 alone. | Adrian reads or rewrites it and chooses Finish or another action. Agents never accept or save his prose. |
| Real Article to its own Carousel (C01/C04/C06, S05/S06/S10) | **After Adrian's review, when he asks for it.** Delivery assigns who builds it. | On the accepted real Article: direct edits, save, reopen, exact Undo where allowed, and a separate Carousel created and reopened, with the Article, its sources and sibling pieces unchanged. Already shown on invented data. |
| Whole editorial journey and output fidelity (C01 to C06, S01 to S12) | **Open.** Delivery picks one piece and edition. The 18 November separate notice candidate identifies saved words in Read/Check after a refused v3 save and retains both tab variants; focused and disposable browser proof passed, installation remains pending. | Detours to Source, Research and Direction return to the same writing; Media, Arrange, Check and the downloaded Article and Carousel match the chosen saved edition, consent holds still apply, and publication stays a separate step. |

## Agent work, ready to pick up

Except the Magazine check, each of these runs in a fresh worktree against `npm run demo` without asking. Check the result by eye in the demo and include screenshots in the report. The Magazine check reads real records through the installed CLI: take a lease on any record you write.

- [ ] Finish the Combined visual and interaction review at desktop, at 900, 1000 and 1100 pixels wide with sidebars open, on phone, in light and dark, and with enlarged text. Keep the accepted layouts; check real populated content, focus and contrast, moving between outputs, and returning to unsaved writing. (C02/C04/C05/C06, S01 to S12)
- [ ] Finish nested Library and mixed-media filing and mixed-owner Material. Keep contact selection, albums, item identities and original files exactly as they are. Measure speed at scale before calling the Mac or iCloud catalogue complete. (C02/C04/C05, S01/S08)
- [ ] Finish Arrange: cover, opener, body and closing roles, captions and credits, placing and removing each item independently, previews, exact exports and Undo where allowed. (C04/C05/C06, S08 to S12)
- [ ] Show useful Research preparation, a proposal backed by sources, and Adrian's decision carried into the right output. Literal Library search is not fact checking or meaning-based search. (C01/C03/C04, S03 to S06)
- [ ] Topic organization and a docked Find, Where used and History panel, as separate enhancements. Keep existing folders and owners. (C02/C04/C05)
- [ ] Try to reproduce the old console 409 on the history request before Direction, before changing anything; PR160's fix was reverted in PR161. If it no longer happens, leave the current words and context as they are. (C02/C04, S04 to S06)
- [ ] Check the remaining Magazine command and editorial paths against the single-writer lock, using the installed CLI and exact revisions. Originals stay read-only. (C04/C06)
- [ ] Measure transcript correction accuracy on one small example before adding an extra grading pass. (C03/C04, S02)
- [x] Refresh the dependency audit and verify web article extraction with the patched Readability 0.6.0. Runtime, MCP SDK and UI kit reported zero production findings after the update. (C04/C06)

## Needs Adrian, or its own agreed scope

- [ ] Needs you on Home (C02/C05). A small heading sits above compact tiles with icons and short labels. The tiles wrap when space is tight. A tile opens the existing review directly where possible, or focuses the question that needs an answer. Check compact height and readable labels on desktop and phone in both themes.

- [ ] Before asking Adrian about angle and title, marked wording, Carousel words and photos, or translations, re-read those records; old counts may be stale. Agents may prepare alternatives; he accepts.
- [ ] Review the saved footage-selection handoff before connecting chosen ranges to Media and Arrange. One calibration example does not approve a whole batch of footage.
- [ ] Connecting more agent entry points or remote approval to his real data needs Adrian to ask for it. The earlier Claude and ChatGPT test used invented data and is closed.
- [ ] Phone or VPS access, offline sync and restore, and access to large originals each need their own design and Adrian's agreement. Phone-width screenshots are not phone access.
- [ ] Sending, sharing with recipients and publishing need Adrian's own consent answers and decision in the app.
- [ ] Wisdom bank, design (not built): resume from `docs/research/wisdom-bank/WISDOM-BANK.md` and the foundations page `14-what-goes-in.html`. Next: draft the starting index of themes, fields and scales; then take in a second, very different source with the full rules and look at the links. Adrian has not yet confirmed the five kinds of unit.

## How to run the next task

Read the item's section brief, CURRENT and the records it touches. Write down which files you expect to change and what finished looks like. Build it, check the changed behavior once in the demo, then run the relevant tests. Let CI report its result rather than polling it. Leave Adrian's two live tabs at 8841, his writing and his recovery records untouched. Start from a fresh `origin/main` worktree, never the old Documents checkout. Merging to `main` does not change the installed app; only `scripts/release.mjs` does that.
