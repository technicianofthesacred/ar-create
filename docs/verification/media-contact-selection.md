# Media contact selection — 7 November 2026

Requirement: S08, C02/C04/C05/C06. Source candidate only; installation and full workspace visual acceptance are separate.

Adopted behavior: click selects; Command/Control-click toggles additional assets; Shift-click selects the sorted range; double-click, Enter or the separate expand target opens the existing exact preview. Contact-sheet checkboxes and the conditional selection banner are removed. Library and placement-picker behavior remains intact.

Finish criterion: toolbar and grid bounds, mounted list/card identities and scroll remain unchanged through ordinary selection, Select all and Clear. Sorting retains scroll. Preview return preserves selected identities and scroll. Existing exact-photo freshness, usage/placement navigation, native detail saving, retained controls and dirty words remain protected.

Verification:

- Affected browser/HTTP coverage: 365 checks exercised. The initial combined run passed 364; one old single-click entrance in the existing-work test needed the adopted double-click gesture. The affected existing-work and contact-selection recheck passed 195/195. All assertions for freshness, identity, placement, save/return and dirty wording were retained.
- The new contact-selection regression suite failed on the old checkbox/single-click behavior before implementation and passes with the new behavior.
- Actual browser checks at 1440, 1100, 1000, 900 and 390 CSS pixels in light and dark: unchanged selection toolbar/grid bounds and list identity through selection/all/clear; no horizontal page overflow or list title/expand overlap. Sorting retained a 350-pixel list offset at desktop, intermediate and phone widths. Double-click/Back, Enter and explicit expansion were exercised.
- Browser inspection uses the maintained browser module and the application's stylesheet bundle with invented SVG assets and a disposable local fixture server. This is a synthetic component preview, not an installed/private-content journey.
- Synthetic native owner and HTTP tests cover exact photo references, guarded owner/placement opening, Back/Forward, retained unsaved caption/credit controls, saved native details and untouched manuscript controls. No live data, original photographs or private histories were imported.

The candidate is bounded to the Media browser gesture and selection layout. It does not establish complete Media/Arrange acceptance or authorize runtime cutover.
