# Wisdom bank mock-ups: handoff

11 November 2026. Plan 11 in `docs/plans/2026-11-11-manager-handoff.md`. Made from `docs/research/wisdom-bank/04-concept.md`. Mock-ups only: one standalone page, nothing in the app changed.

- The page: `design/2026-11-wisdom-bank/index.html` (one file, three screens, no build step).
- Published for Adrian's phone: https://claude.ai/artifact/KyUE9ZY9bvArEynznJ5p1L (private to him until he shares it).

## What is drawn

One page holding three screens. The small "Source, Nugget, Express" switch in the top bar exists only for the mock-up; the screens also link to each other through their own content.

1. **Source.** An invented talk, just distilled. Its nine concepts as a map with four kinds of line (prepares, explains, contrasts, echoes). Tapping a concept on the map lights its lines and lists each line with its reason. Below, all nine concepts as cards: name, a labelled distillation, the strongest passage under "Their words" with its minute and speaker. Brightness follows resonance, and the five small dots on each card change it live. One card carries a proposed join ("Joins a concept you have") with Yes and Not now. Nothing can be removed.
2. **Nugget.** One concept in the middle with its neighbours around it, each line named by kind. Tapping a neighbour walks there: the view arrives from that neighbour's direction and the trail at the top grows. "Open" unpacks six cards to swipe: Gist, Their words (grouped by work, two works for "Already whole", each with a one-line note on how that work says it), Your lens, Lines, Your response, Go deeper.
3. **Express.** "everything is perfect" is already spoken. Five groups by tradition, each nugget with its exact words and what comes first. The plus adds a nugget to the pathway; the bar at the bottom fills; at three, "Join into a pathway" opens the research topic with Move up and Move down, a place for his words between, a gentle note when something that comes first was left out, and "Make a piece" (Article, Reel, Words for an artwork), which shows the outline with credits.

Look: the app's own colours in dark and light, the six type sizes of version two, one interface face, Lora only for spoken words.

## What is invented

Everything. No real person said any of it.

- The speakers (Ilse Varnholt, Tomas Reuel, Hanne Brückl, Anselm Dray, the friend Oisín Farrell), their talks, every passage, every minute mark.
- The nine concepts, their distillations, the lines and the reasons on them.
- The tradition headings on Express are real traditions, but the speakers under them are invented members of invented groups ("study group", "sitting group", "reading circle", "retreat"). No words are attributed to a tradition's named teacher or text.
- The lens. "Sample lens: body, breath, everyday" is a stand-in and is labelled as a sample on the card.
- "Your response" is left empty on purpose, so no words are put in Adrian's mouth. The feeling "everything is perfect" is his own example from the concept.

## What was checked

- Pictures at 390 wide in dark and light and at 1440 wide in dark. 1440 light was not pictured.
- No sideways scrolling of the page on any of the three screens at 390 or 1440 (measured).
- Not checked: widths between 390 and 1440, a real phone, a screen reader.

## What I was unsure of

- **Lines on the source screen are shown as already there.** The concept says connections are proposed and wait for his yes. Only the join is shown as a proposal. A yes or no on every line looked like a pile to sort, which the concept also forbids. This needs his eye.
- **Brightness is doing two jobs in the light theme.** "Brighter" means lighter in dark and stronger ink in light. It reads, but it is worth his look.
- **The map is laid out by hand** for these nine concepts. How a real talk with twenty or forty concepts lays itself out on a phone is not answered here.
- **Tradition headings with invented speakers** still sit close to the line the brief drew. If it reads as putting words into a tradition's mouth, the alternative is exact public-domain texts with their sources.
- **Three is not a hard limit** on the pathway. He can add more; the button wakes at three.
- **"A few today"** is not drawn. The concept said it "can" appear on the way in and he has not yet said whether he wants it.
- **"Change lens", "Draw a line of your own", "Open the talk" and the play marks** look alive but do nothing.
- The whole-bank map is not in this work, as agreed.

## Second pass, 11 November

Made after the coordinating thread passed on the grown concept (read from `claude/ar-create-ui-ux-review-71qso6`) and Adrian's words there: "we need to make sure we wire in appropriate places that I can give insight that will actually help this be a tool, not just a wall of data" and "make the interface fun to interact with built for a human, not built for AI". Same link, same file.

- **Fourth screen, "How I distil"** (shown as "Distil" in the mock-up switch): his lens in words with a microphone, several lenses, "Re-read the bank" with a three-line summary before anything moves, three questions the bank is asking (answer or let it pass; a passed one is replaced, never owed), the rules his corrections taught, and "Recently joined" with Correct on each.
- **Where he speaks in, on Source**: "What were you looking for in this?" brightens matching concepts. The sure join has gone through and shows Correct, with an optional one-sentence why that becomes a rule on "How I distil". One unsure join is brought with its doubt stated. "Draw a line" then a tap on another concept makes his own line, with a why.
- **Touching the map**: tap a concept to pick it, hold it to turn its resonance up and watch it glow, drag it to move it and the lines follow.
- **On Nugget**: resonance dots, "What this means to you", "Keep" on his response (resonance rises), "Not this concept" on any passage, and an "Unexpected" invitation from another tradition.
- **On Express**: the pathway reads as a line with stops, and asks "Why these, in this order?".

This answers the earlier doubt about lines shown as already there: the concept now says sure filing goes through and can be corrected.

Checked: 390 wide dark and light on all four screens, 1440 light measured for sideways scrolling only (none), not looked at as a picture. The microphone buttons only focus the field; a published page cannot use the microphone. Lens words, rules, questions, counts and dates on "How I distil" are invented and marked Sample.

Still unsure: holding and dragging on the map are not announced anywhere, so he may not find them without being told. Dragging a concept blocks page scrolling when the finger starts on a concept.

## Adrian's reaction

**11 November, after the first pass, in his words:**

"Yes, this is in the direction, but think of this having hundreds of thousands of units of data. Not just a few. Maybe it will take a while to get there, but it needs to be scalable. And we need to design it with this in mind. That means the zooming and the navigation and the zooming out and zooming in and honing in on things are the first and foremost primary most important things."

What this means for the mock-ups (my reading, not his words): the direction stands, but these screens show one talk and one concept at a human scale and say nothing about moving through a very large bank. Zooming out, zooming in and honing in must become the first thing designed, and the four screens become what you find at the closest zoom. That work is not done here. It was held out of this thread on purpose as "the whole map" and needs his yes on a plan first.

**11 November, after the second pass, in his words:**

"The distillation is generally gonna be more than one sentence. These are gonna be multi-chapter concepts or larger concepts that should be not just one thing. There's a short summary that can be glanced at, but then that summary goes to something a bit more medium and then that goes to something even a bit bigger. So just as we can zoom on the massive concept map, we can zoom in and out of the level of the distillation."

What was done about it: on the Nugget screen the distillation now has depths, Glance, Medium and Full. Every concept has Glance and Medium; only "Already whole" has Full, written as five short headed parts. All of it is invented and sits under the "Distillation" label. Not done: depths on the Source cards and on Express, and any link between how far the map is zoomed and how deep the distillation reads. That belongs with the zoom-first work, which still waits for his yes.

## The zoom-first plan proposed to Adrian (not yet answered)

Proposed on 11 November after his words on scale. He has not said yes or no. The coordinating thread will start this work in a fresh thread (plan 12); it is not to be built here.

One new clickable mock-up where zooming is the whole screen, and the four screens in this folder become what you find at the closest zoom.

- **Far out:** only the few core understandings and the traditions as regions. A bank of any size looks this simple from here.
- **Closer:** the districts (bigger concepts) inside one region, then the concepts as stops on lines, as in the transit picture he confirmed.
- **Closest:** one concept with its neighbours and its words, which is the Nugget screen.
- **Honing in:** say or type what you are after, and the map narrows to it and flies you there. It can also narrow to one topic, one work or one kind of line.
- **Never lost:** it opens where he last was, a small trail shows the way back out, and brightness tells him where to look at every depth.
- **Filled to feel large:** invented sample data, a few thousand concepts, so pinch, drag and fly can be judged honestly.
- **Added after his words on distillation:** at every depth of the map, the words read at the matching depth of distillation. Far out a glance, closer the medium reading, closest the full one with the exact words under it.

**11 November, with two screenshots (the lines panel of "Already whole" and the card of "The false version"), in his words:**

"Also on your UI UX You're not using proper Separation or formatting so all the words blend in together even though you've changed fonts and all that, they're not working in a way that I can Really feel the separation and feel calm. I feel like I'm having to sort your words with my head rather than enjoy reading."

What was done about it, on all four screens: every card now reads in groups, tight inside a group and open between groups. Their words sit on their own inset surface, so a quote is seen as a different thing before it is read. Each line to a neighbour is one row with a hairline above it, the neighbour's name on the left and the kind of line small on the right, with the reason beneath. The distillation is in full ink, no longer dimmed. Waiting for his eye on whether it now feels calm. A rule for the next thread: separation must come from space and surface, not from changing the typeface or the colour of the label.

**11 November, with two more screenshots (the "Feeling everything" card and the lines panel), in his words:**

"Now your UI significantly reduces the amount of text because of the multiple buffers and barriers is there a way to do this so we don't have to lose so much width. Also here the comes first and explains by in contrasts maybe could be something a little more refined. This feels still a bit added on."

What was done about it: their words now run as a band from edge to edge of the card, so a quote is as wide as the distillation above it and still sits on its own surface. The lines to neighbours are grouped by kind: one quiet heading per kind with the same line mark the map uses ("Comes first", "Explains it", "Contrasts with", "Leads to", "It explains", "Echoes", "Your line"), and the neighbours listed beneath it. The repeated capital tags at the right are gone. Rules for the next thread: never stack a padded box inside a padded card, and show a relationship as structure (a group, a line mark), not as a tag on each row.

**11 November, on the Source screen, in his words:**

"On the left side of this I'm not fully understanding what I actually do with all of these already whole concepts or things like that. I think it could use a bit more refinement around how these things interconnect and interact. Also, I see this map being significantly bigger, a huge map, connecting to other huge maps. Also one book may have a hundred concepts. It's important to be able to keep the book together in some sort of map as well so that we can refer to either. We're not just trying to create everything as just concepts, we're also trying to collect the concepts out of books and be able to browse in either direction."

What was done here: only one small thing. Each neighbour in the lines panel is now a control with an arrow; tapping it moves the map to that concept, so the panel is a way to travel and not only a list. The rest is for plan 12 and is not built here.

What it asks of plan 12 (my reading, not his words):

- **Two ways in, always both.** By work: a book or talk keeps its own map of all its concepts, a hundred or more, and stays together as that work. By concept: one concept across every work that speaks of it. From any concept you can step to "this concept in this book" or "this concept across the bank", and from any book to any of its concepts. Neither view replaces the other.
- **Maps that join maps.** A work's map is one region of the huge map. Where two works share a concept, their maps touch there, and that is where you cross from one book into another.
- **What you do with a concept must be plain on the spot.** The lines panel listed relationships without saying what they are for. At every concept the next moves should be visible: go to a neighbour, read its words, respond, add it to a line.
- **Scale.** The nine-concept map drawn by hand here does not answer a hundred concepts in one book. The work map itself needs depths: chapters or districts first, concepts inside them.

**11 November, on the wording of the concepts and on the size of the whole, in his words:**

"Also these concepts that you are giving me are not r really understandable or assimilatable. They feel like they are written for AI. The number one thing is that they are valuable to me. That I don't have to process to understand what you're talking about. You have failed at this as well.

The thing is this is a massive repository of many different things. So it's almost like a knowledge graph. You know, you have one book, you have all the concepts inside of the book. You can connect all those concepts together. Have one article, all the concepts, connect them. The ways to navigate and go through everything. Feels like it needs to be much larger of a interaction of all these conceptual maps as well."

Nothing was changed on the page after this. What it means (my reading, not his words):

- **The sample wording failed.** Names such as "The false version" and "Warmth as the test", and reasons such as "Sets the limit: perfect cannot mean unfelt", are compressed labels that only make sense once you already know the talk. A concept's name and distillation must be understood on first reading by someone who has not seen the source, in the words a person would say aloud. This is a requirement on the distilling itself, not only on the mock-up: if the real agent writes like this, the bank fails. It should be tested on him with real distillations before anything is built on it.
- **The whole is a graph of maps.** Each book and each article has its own map of all its concepts; those maps connect to each other; moving through all of them is the main interaction. This confirms what plan 12 is for.

**11 November, on the length of a concept, in his words:**

"Ideally these concepts are not just this one sentence, they're however long they need to be. I feel like you're consolidating them for space rather than the amount of words for a human to really understand it."

What it means (my reading, not his words): the length of a distillation is set by what a person needs in order to understand it, never by the space on a card. The layout must make room for the words, not the words for the layout. The one-line "Glance" is only a way in; the real distillation is as long as it needs to be, and the concept page's "one line saying what it means" is wrong on this point. Nothing was changed on the page after this.
