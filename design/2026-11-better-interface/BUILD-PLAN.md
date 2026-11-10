# Direction D: what is not covered yet, and how to build it

Written 10 November 2026, after the seventh pass on the mock-up. Nothing here is approved. It is the plan Adrian asked
for: the holes, the way to build, and what a first night of building would be.

## Where the real app stands (checked, not assumed)

- **Already in the app and reusable.** The 58 canvas layouts with stable numbers, the slide renderer, export to images,
  an Instagram studio that already keeps a plan per post with a "door" (Teajia, Art, Mandala Codes, Personal), choosing
  a layout per slide, real folders for Library and Media, research claims and sources per subject, a demo with invented
  data and a screenshot harness.
- **Partly there.** Pins and folders for subjects exist but only inside one browser. A layout carries a look tag, but
  colours and the logo are fixed inside each layout. Brand rule files exist as prose, read only for Teajia.
- **Not there at all.** Speakable codes, placing logos and graphics on a slide, saving or making a template, a look per
  brand, accounts, forms as plug-ins with their own steps, tags and drag order on Home, research topics and groups
  shared across subjects.
- **Eight plans are already written and none is approved or started** (`docs/plans/2026-11-10-00` to `08`). Plan 8 is
  this design round. Its build order is: the walkable demo, the subject page with "keep the subject", Home, Write, one
  source list, then the phone.
- **What makes a large change risky.** The interface is about a hundred plain script files that decorate each other in
  a fixed order, and many tests pin the exact markup. Renaming a hook silently drops a look. So the front of the app
  has to change in small, tested pieces. The server side is far safer to add to.

## Holes in the design (not drawn yet)

Most important first.

1. **Speaking to Claude as the main way in.** The mock-up has one line where codes work. Not drawn: where a longer
   conversation happens, what Claude may do by itself and what it must ask, and a morning view of what the assistants
   did while he slept, with Undo.
2. **What Claude knows he likes.** Drawn as a short list on the Looks page. Not decided: where it is kept, whether it
   is per look or per account, and how he corrects it when it is wrong.
3. **Changing a layout later.** If C1 is adjusted, posts already made with it must stay as they were. A code is never
   reused, and a retired layout keeps its code. None of this is drawn.
4. **Finishing a Carousel.** Captions, the post text, hashtags, alt text and the ten checks at the end of his Instagram
   guide are stubs. The Carousel has no Check step of its own (exact quotes, every Chinese character checked, wordmark
   only on the cover and the close).
5. **Getting it out.** Slides to the phone as images, which account, marking it as posted, the link in the bio.
   Posting is not connected and there is no calendar across accounts.
6. **The other forms.** Only the Carousel is drawn in depth. Story, Reel cover, single Post, the Article's own layout
   and Video each need their steps and templates. The app already has Story and Reel layouts to start from.
7. **Library.** The Library button does nothing. Choosing photographs from it, moving a crop, a consistent grade, and
   permission for each photograph that shows a person are not drawn.
8. **Find and Ask.** Both are inert.
9. **Inside Create.** The Simmer board behind "Open the board", Write's Read and Check modes, and placing photographs
   in the Article are not drawn.
10. **Touch.** Reordering by drag does not work on a phone. It needs move up and move down, or a long press.
11. **After publishing.** The message to the people in the story, the glossary, and proposals to the tea reference are
    in his Teajia rules but not in Share.
12. **Hard states.** Nothing, an error, no connection, a record another assistant is holding, three hundred templates,
    ten accounts.
13. **The real assets.** The icons and logos for Art and Mandala are stand-ins. He needs to say where his are.
14. **Small things a post needs.** The series number ("Journey 04") per account, and the pillar (佳, 家, 嘉) for a
    Teajia post.

## Things the mock-up assumes that the app cannot do yet

1. **A subject has no place on the server for its folder, tags, pin or order.** Plan 1 moves pin and folder there.
   Tags and drag order are new.
2. **Research belongs to one subject today.** Topics and groups that outlive a subject are new, and the product notes
   say research must not become a separate product or database without his say. This needs his decision, and a choice
   of engine.
3. **No look and no account exist as records.** The renderer has to learn to draw one layout in any look.
4. **The twelve sections must stay reachable.** Every plan says so. The mock-up's steps list has to be mapped onto
   them, not replace them.

## How to build it

- **One director, many workers.** The director stays on the strongest model, writes each piece as a short brief with
  the test that proves it, and accepts or rejects the result. Workers get a level that fits the job: the strongest for
  the renderer and anything touching the editor, a middle one for commands and tests, a light one for sweeps,
  screenshots and the generated capability list.
- **Each worker in its own copy of the code**, cut fresh from `main`, so they cannot collide. Pieces are merged one at
  a time into a single build branch.
- **A second reviewer on a different model** reads every piece against the mock-up pictures and the tests before it is
  merged. A different model has different blind spots.
- **Test first.** Each piece starts with the failing test, then the code, then the whole suite, then the demo with
  invented data, then pictures at computer and phone width in both themes.
- **Nothing leaves the branch.** No change to the running app, the private data or the vault, no release, and no
  merge to `main` until he has looked.
- **His two checkpoints stay.** This plan, before building. Before and after pictures of anything he would see, before
  it counts as done.

"Perfectly" cannot be promised. What can be promised is that every piece is tested, reviewed by a second model,
shown as pictures, and easy to throw away.

## A first night, if he says yes

All of it sits on the server and inside the Instagram studio the app already has. It leaves Home, the subject page and
Write alone.

1. **Codes.** Every layout gets its code from its row (C1, S2, M5). The old numbers keep working. Nothing visible.
2. **Build by saying codes.** One command that turns "C1, S2, P1, B1" into a Carousel plan, for the app and for any
   assistant. Nothing visible.
3. **Looks as records.** One folder per brand holding colours, type, logo, marks and rules, and the renderer draws any
   layout in any look. Teajia's own rows stay Teajia's. Nothing visible until used.
4. **Accounts as records**, separate from looks, with the account chosen per post. Nothing visible until used.
5. **Placed things and saved templates.** A slide can carry a logo, a mark or a graphic at a position, and a slide can
   be saved as a new template with the next free code.
6. **The studio shows it.** Codes on every layout, the look switch, the account, and the Add tab. This is the visible
   part: it waits for his eyes, with before and after pictures.

Left for later, in this order: the walkable demo (plan 7), the subject page with forms and steps (with plan 1), Home
with the desk, tags and drag order, Write (with plan 2), one source list (plan 3), Research groups, the phone.

## What only he can decide

1. Yes or no to the first night as written, on a new build branch cut from `main`.
2. Research topics and groups that live outside a subject: yes, and on which engine.
3. Where what Claude knows he likes is kept, and who may change it.
4. Whether assistants may build a whole Carousel by themselves from his words, or always stop at a proposal.
