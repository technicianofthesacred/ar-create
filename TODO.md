# AR Create — to-do

This is the public mirror of Delivery's work checklist: open items only, no private detail. There is no other list. What works today is in [docs/status/CURRENT.md](docs/status/CURRENT.md).

## Soon

- [ ] Step 1: review the C workbench UI candidate against C02, C05, C06 and S01–S12; [demo verification is recorded](docs/verification/workbench-step1/README.md); it is not installed _(band: human review)_ _(effort: deep)_
- [ ] Next: add nested Library and Media storage _(band: agent-runnable)_ _(effort: deep)_
- [ ] Then: connect real Library research _(band: agent-runnable)_ _(effort: deep)_
- [ ] Then: complete Arrange templates and the photo picker _(band: agent-runnable)_ _(effort: deep)_
- [ ] Turn on Material keep-or-remove: the review is prepared but not connected _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Complete topics in the Working on switch and sort-into-topics screen (one at a time, groups, bulk move, rules); the merged Collection/learning source is installed _(band: agent-runnable)_ _(effort: deep)_
- [ ] Docked panel beside the work: Find in Library, Where it's used (photos, quotes and saved items together) and History in one place _(band: agent-runnable)_ _(effort: deep)_
- [ ] Verify an explicit human save over an active agent lease; PR17's implementation is now installed _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Give Hermes, Grok and ChatGPT a way in on this Mac: a short skill or connector that calls the one CLI with their own actor _(band: agent-runnable)_ _(effort: moderate)_

## Future

- [ ] Verify the installed Magazine command/editorial paths against the remaining single-writer/shared-lock boundary for the Teajia Workflow folder _(band: agent-runnable)_ _(effort: deep)_

## Operational notes

- Current design authority: [C workbench](design/three-directions/c-workbench/index.html) and [NOTES revisions 2–5](design/three-directions/c-workbench/NOTES.md), including the final no-number navigation instruction. Every PR receives human review; review does not install a candidate.
- PR17 verification is author-reported as 312 tests / 307 passing / five baseline failures, not independently verified here. Fixture-overlay safety checks are 4/4 and the package check passed; the full suite is not all green. Recovered rebuild installed and verified on 21 October at release `34e7a267`; see CURRENT for exact preservation proof and remaining limits. Recovery focused checks passed; a parent-reproduced native pending/timer issue remains, so the full suite is not labelled green.
