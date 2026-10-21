# AR Create — to-do

This is the public mirror of Delivery's work checklist: open items only, no private detail. There is no other list. What works today is in [docs/status/CURRENT.md](docs/status/CURRENT.md).

## Soon

- [ ] Look over the new Tree sidebar, pieces list and step path in the real app, and say what to change _(band: you-required)_ _(effort: quick)_
- [ ] Turn on Material keep-or-remove: the review is prepared but not connected _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Rehearse and release the merged standalone Collection and learning paths; then add topics to the Working on switch and sort-into-topics screen (one at a time, groups, bulk move, rules) _(band: agent-runnable)_ _(effort: deep)_
- [ ] Docked panel beside the work: Find in Library, Where it's used (photos, quotes and saved items together) and History in one place _(band: agent-runnable)_ _(effort: deep)_
- [ ] Rehearse and release PR17's human-save-over-agent-lease behavior _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Give Hermes, Grok and ChatGPT a way in on this Mac: a short skill or connector that calls the one CLI with their own actor _(band: agent-runnable)_ _(effort: moderate)_

## Future

- [ ] Rehearse and release the merged Magazine command, editorial and thin-client paths; verify the remaining single-writer/shared-lock boundary for the Teajia Workflow folder _(band: agent-runnable)_ _(effort: deep)_

## Operational notes

- The chosen design is Full A, the Tree, on the design canvas: https://claude.ai/artifact/WCibjsYNREMrVdaToKWGpR. Its build plan is `design/round3-directions/BUILD-PLAN.md` on the `claude/ar-create-interface-directions` branch.
- PR17 verification is author-reported as 312 tests / 307 passing / five baseline failures, not independently verified here. Fixture-overlay safety checks are 4/4 and the package check passed; the full suite is not all green. New release remains pending rehearsal.
