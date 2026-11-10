<!-- Hand-maintained current summary; gen-status.mjs supplies measured/release headers. Keep within 40 lines. -->
## Current checkpoint, 10 November 2026

The installed app is PR230: commit `af5350a974d5612ac1b3e373daea9979e8ad42cf`, tag `v2026.11.09-pr230`, checked running on 10 November. The test line above is the 21 focused source and HTTP checks run on that commit on 9 November, not a full-suite run and not Adrian's acceptance. Later documentation commits on `main` do not change the installed app.

## Completed and verified

- **Combined interface:** the approved Graphite controls, the eight focused layouts, sidebar readability, the Material, Media and Audience refinements, editorial discussion styling and the recovery repairs are merged and installed. The earlier PR216, 221, 222, 225 and 227 blockers are resolved; [release reconciliation](RELEASES-2026-11.md) records where that work landed.
- **Material and browser Back:** on PR229, all 32 checks of opening an item and returning passed on the installed app, with source and manuscript files unchanged, real recording playback and exact browser Back. PR230 serves the same interface files; those 32 checks were not rerun on PR230.
- **Recovery:** PR229 fixed recovery when storage is nearly full and gave each tab its own recovery record, including after reload and Back. Writing and history survived the installed check, and PR230's generation journey again kept the original writing, source captures and recovery.
- **First live Article:** PR230 creates a separate, empty Article from the saved source captures, leaving the existing manuscript and its pending decisions untouched. A live Codex run wrote 18 paragraphs (1,328 words) and staged them for Adrian's review. On 10 November that proposal was still waiting for him. Nothing has been accepted, published or added to his original writing.
- **Proposal editing:** plain paragraphs with LF or CRLF line endings can now be AI targets. Generated paragraphs stay ordinary single-line prose. Enter and Shift+Enter editing, owner and revision checks, saved Undo and Adrian-only Finish all still work.
- **Other paths:** source and transcript review, Research and Direction, independent outputs, media placement, Check, export and shared context each have tests on the source. Installing them does not mean each one has been walked end to end or accepted by eye.
- **Cloud test:** a Claude and ChatGPT sign-in roundtrip passed on invented data, then access was revoked and the tunnel closed. There is no open cloud connection to Adrian's data.

## What happens next

1. Adrian reviews the generated Article and chooses Finish or another action. Leave that review and his two live tabs at 8841 alone until he asks you to continue it.
2. Once he has decided and asks for the next step, check the same real Article through edits, save, reopen, Undo and a separate Carousel. This has already worked on invented data.
3. Pick the next task from [TODO](../../TODO.md), read its section brief and current records, and write down what finished looks like before starting.

## Still open

- Adrian has not yet accepted, by eye, the whole journey from recording to Outputs, at desktop and phone widths, in light and dark, or for accessibility. Fixture screenshots and one Article do not cover that.
- Decisions on angle and title, marked wording, Carousel words and photos, and translations belong to Adrian. Re-read those records before asking him; old counts may be stale.
- Accepted Article to Carousel, final media layout, downloads of the chosen edition, and publication are separate follow-ups. Sending and publishing stay Adrian's decision.
- Phone or VPS access, offline sync, more account connections and remote approval each need their own design and Adrian's agreement. Large-library speed and meaning-based search are not measured; today's search matches words literally.
- Old dependency warnings need a fresh audit before any fix. The MCP SDK is already on 2.4.0.

## Agent handoff

Start with [AGENTS](../../AGENTS.md), [START](../START.md), this page and [TODO](../../TODO.md). Source work starts from a fresh worktree of `origin/main`; the old Documents checkout is stale and holds uncommitted work, so leave it as it is. To know what is installed, read the home's `RELEASE.json`. Private operation IDs, manuscripts, real-app screenshots and request files stay outside Git. Release proof locations and resolved failures are in [RELEASES-2026-11](RELEASES-2026-11.md).
