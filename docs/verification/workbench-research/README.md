# Workbench Research console — step 3 candidate

C04/C05/C06, S03. Uses the existing `/api/concept/sources/search` and explicit `/api/concept/source` readers. No source copy, index, provider, factual verification or automatic citation acceptance was added.

Focused client/controller tests pass. They cover real service response limits, exact literal query and source identity/hash/context, safe text rendering, malformed/unavailable responses, cancellation (including ignored fetch signals), stage-change stale result rejection and unchanged pending human wording. Native demo lookup found the invented imported Library source and opened its full surrounding context (`native-library.json`). This proves local maintained Library recall, not semantic search or outside research.

The existing saved findings and human choices retain their original owners. Console history is only in the current open page; questions are not persisted or sent to AI. Human review is required; nothing is installed.
