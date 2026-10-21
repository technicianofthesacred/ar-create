# AR Create — to-do

This is the public mirror of Delivery's work checklist: open items only, no private detail. There is no other list. What works today is in [docs/status/CURRENT.md](docs/status/CURRENT.md).

## Soon

- [ ] Look over the new Tree sidebar, pieces list and step path in the real app, and say what to change _(band: you-required)_ _(effort: quick)_
- [ ] Turn on Material keep-or-remove: the review is prepared but not connected _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Complete topics in the Working on switch and sort-into-topics screen (one at a time, groups, bulk move, rules); the merged Collection/learning source is installed _(band: agent-runnable)_ _(effort: deep)_
- [ ] Docked panel beside the work: Find in Library, Where it's used (photos, quotes and saved items together) and History in one place _(band: agent-runnable)_ _(effort: deep)_
- [ ] Verify an explicit human save over an active agent lease; PR17's implementation is now installed _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Give Hermes, Grok and ChatGPT a way in on this Mac: a short skill or connector that calls the one CLI with their own actor _(band: agent-runnable)_ _(effort: moderate)_

## Future

- [ ] Verify the installed Magazine command/editorial paths against the remaining single-writer/shared-lock boundary for the Teajia Workflow folder _(band: agent-runnable)_ _(effort: deep)_

## Operational notes

- The chosen design is Full A, the Tree, on the design canvas: https://claude.ai/artifact/WCibjsYNREMrVdaToKWGpR. Its build plan is `design/round3-directions/BUILD-PLAN.md` on the `claude/ar-create-interface-directions` branch.
- PR17 verification is author-reported as 312 tests / 307 passing / five baseline failures, not independently verified here. Fixture-overlay safety checks are 4/4 and the package check passed; the full suite is not all green. Recovered rebuild installed and verified on 21 October at release `34e7a267`; see CURRENT for exact preservation proof and remaining limits. Recovery focused checks passed; a parent-reproduced native pending/timer issue remains, so the full suite is not labelled green.
