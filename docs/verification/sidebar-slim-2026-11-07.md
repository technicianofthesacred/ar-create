# Slim shared navigation — 7 November 2026

Requirement C02, shared S01–S12. Contracted navigation is 64px (was 112px), has no vertical group labels/count strip, and retains destination icons, names and individual waiting badges. Expanded navigation is 144px (was 196px), retains the vertical group strips and uses smaller horizontal gaps/padding. All maintained navigation handlers are unchanged.

Finish criterion met in the isolated synthetic candidate: actual 1280px desktop light/dark at both widths, 1000px expanded and 390px phone inspected. No destination text clipping or page horizontal overflow. Toggle survives reload; ArrowDown from the toggle focuses Home; Media opens through its existing handler. Phone retains its existing bottom navigation. Invented native source files are used; no installed/private data changed.

Validation: 20 combined-navigation/combined-phone tests pass; build, package check and diff whitespace check pass. Candidate is neither installed nor human-accepted. Scope does not include a software release. Screenshots remain outside the code package.

Follow-up marked-boundary candidate: icon-only Expand retains its accessible name and tooltip; expanded vertical strips remain visible. Both themes at 1280px have no clipped labels or horizontal overflow; toggle persistence, keyboard focus and 390px phone layout rechecked. Same 20 affected tests pass.
