# Plan 1: keep the subject

**Goal.** Adrian always knows which subject he is in. The app keeps that subject on every screen until he changes it, a new subject opens as itself, and a subject can be found, renamed, archived and restored from any device.

**Findings covered.** U1, U2, U17, U19, U20, U21 (subjects), U25. Root problem R1.

## What Adrian will see

- **New subject** opens a small form under the button. Create takes him to that subject's own first screen, with its name in the top bar and two buttons: "Add material" and "Start writing".
- The subject's row on Home and "Continue where you left off" open that same screen.
- In **Library, Material and Media** the top bar keeps the subject's name. A visible scope control lets him switch between the subject and "All subjects".
- A **Subjects** screen on desktop as well as phone, with Pinned and Archive. The finder also finds archived subjects and labels them.
- **Rename** on a subject. **Archive** offers Undo on the spot; **Restore** sits on the archived row.
- An **empty app** opens on Home with one sentence and one button, "New subject".

## What must not change

- A reload returns to the same subject and screen; browser Back steps back one screen (both work today).
- Existing subjects, their folders, pins and status. Subjects that come from the vault keep their identities.
- The twelve section entrances and their `data-*` hooks.

## Where the work is

| Piece | Files |
|---|---|
| New subject form and create | `public/document-study/project-library.js` (`newForm`, `data-pl-create-form`) |
| Home rows, "Continue where you left off", Home's hidden filters | `workbench-frame.js` (about lines 431 to 483), `project-library.js` |
| What the top bar calls the current subject | `workbench-frame.js` lines 293 to 294 (`globalLibrary`), `home-tabs.js` (the switcher and finder) |
| Subjects screen (phone only today), Archive folder, Organize | `combined-subjects.js`, `combined-navigation.js` |
| Library and Material scope | `folder-browser.js`, `material-intake.js` |
| Research with no subject | `research-tab.js` |
| Organization saved in the browser only | `project-library.js` ("Organization saved in this browser") |
| First empty start | `study.js`, `draft-surface.js` (the browser-only "Untitled project") |

## Steps

1. **Write the rule down as tests first.** A journey test on the demo: create a subject, expect its name in the top bar; visit Library, Material, Media, Research in turn, expect the name to stay; reload, expect the same. These fail today.
2. **Select the subject on create**, and route its Home row and Continue button to the same first screen. Find why a subject whose status is "Material" is sent to Library and remove that special case.
3. **Stop Library, Material and Media clearing the subject.** Add the scope control. "All subjects" becomes something Adrian chooses, never a side effect.
4. **Move pin, folder and archived onto the subject's record** (U20), with revision check and a history line, so they travel between devices and agents can read them. Carry over what each browser has saved, once, without losing it. This step changes saved data: it needs its own small design note and tests for stale writes.
5. **Subjects screen on desktop**, Archive in it, archived results in the finder, Restore on the row, Undo after archiving.
6. **Rename** a subject. Check every place the name is shown and that agents see the new name. Identities do not change.
7. **Empty start** (U25): Home with one first step.
8. Walk the whole Part 1 journey at 1440 and 390, light and dark. Before and after screenshots for Adrian.

## Finish checks

- After Create, the top bar shows the new subject's name; its Home row and "Continue where you left off" return there; the same at 390px.
- Home, open subject, Library, Research shows that subject's Research. The top bar never changes subject unless Adrian changes it.
- Archive a subject on one browser; a second browser shows it archived; it can be found in two presses and restored in one, on desktop and phone.
- A renamed subject shows its new name on Home, in the top bar, in the finder and in `project list`.
- A first start on an empty data folder shows Home with "New subject".
- `npm test` passes; the new journey tests are part of it.

## Decisions needed first

- Where a new subject opens: its empty Write page with "Add material" and "Start writing" (suggested), or the Subject board. (Review decision 1.)
- "Subject" as the one word on screen (review decision 7); this plan's new wording assumes it.

## Not in this plan

Removing a subject for good. A bin for subjects and pieces is described in plan 2.
