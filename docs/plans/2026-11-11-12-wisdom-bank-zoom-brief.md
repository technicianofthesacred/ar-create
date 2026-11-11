# Plan 12: the wisdom bank at full size, zoom first (the brief)

**Status.** The wisdom bank was parked on 11 November 2026; see [where it stands](../research/wisdom-bank/07-where-it-stands.md). The thread this brief started is closed. Earlier status: Prepared 11 November 2026, after Adrian's reactions to the first mock-ups; it now carries five of them. It runs in a fresh thread, because the mock-ups thread passed the size at which it should stop.

## Why

Adrian opened the [first mock-ups](https://claude.ai/artifact/KyUE9ZY9bvArEynznJ5p1L) and said, on 11 November:

> "Yes, this is in the direction, but think of this having hundreds of thousands of units of data. Not just a few. Maybe it will take a while to get there, but it needs to be scalable. And we need to design it with this in mind. That means the zooming and the navigation and the zooming out and zooming in and honing in on things are the first and foremost primary most important things."

So the direction of the four screens stands, and they become what he finds at the closest zoom. What is missing, and now comes first, is how he moves through a very large bank: out, in, and honing in. The earlier plan treated the whole map as a later study. It is now the main design work.

## What this thread makes

One page he can open on his phone: an invented bank at real size that he can zoom and move through. It is a test of the idea as much as a picture of it, so it must carry a realistic amount of data and say honestly where it strains.

## How it is started

Repository `technicianofthesacred/ar-create`, starting from `claude/ar-create-ui-ux-review-71qso6` (which holds the concept, the map surveys and the first mock-ups), pushing to `claude/wisdom-bank-zoom`. The strongest model, at the effort Adrian agrees (medium recommended).

## The text it receives

> You design and build one clickable mock-up: Adrian's wisdom bank at full size, zoom first. A standalone page, nothing in the app changes. Read this whole brief first.
>
> **Adrian's words, which are the assignment.** "Think of this having hundreds of thousands of units of data. Not just a few. Maybe it will take a while to get there, but it needs to be scalable. And we need to design it with this in mind. That means the zooming and the navigation and the zooming out and zooming in and honing in on things are the first and foremost primary most important things." Earlier, on the whole map: "Yes, I like the conceptual mind map if there's multiple concepts of how they all interconnect to each other. And those interconnections interconnect to other interconnections. This is like a big brain." On what works in the best maps: "the lines and the entry connections and intersections." And on the feel: "make the interface fun to interact with built for a human, not built for AI."
>
> And on the distillation itself, after seeing the first screens: "The distillation is generally gonna be more than one sentence. These are gonna be multi-chapter concepts or larger concepts that should be not just one thing. There's a short summary that can be glanced at, but then that summary goes to something a bit more medium and then that goes to something even a bit bigger. So just as we can zoom on the massive concept map, we can zoom in and out of the level of the distillation."
>
> **Read these, and only these.**
> 1. `docs/research/wisdom-bank/04-concept.md`: "Corrections since this page was written" and the one-minute summary at the top, then the sections "Connecting" (with "Keeping it simple as it grows" and "The whole map: the big brain") and "Where you are in it". He confirmed the transit-map picture: a research topic is a line, a concept is a stop, a concept several lines pass through is an intersection, a work is an entrance.
> 2. `docs/research/wisdom-bank/05-map-precedents.md`: "Patterns that work", "Patterns that fail", "Connections between connections", "What to test in a mock-up".
> 3. `docs/research/wisdom-bank/06-github-precedents.md`: the table only, for what to borrow.
> 4. `design/2026-11-wisdom-bank/HANDOFF.md`, and `design/2026-11-wisdom-bank/index.html` for the look. Reuse its colours, type and card styles so both pages read as one product. The four screens in that file are the closest depth of your map; link to them, do not redraw them.
>
> Do not explore the rest of the repository, do not run the app, and do not start sub-agents.
>
> **What to make.**
> - **A bank at real size, invented.** Generate the data inside the page from a fixed seed, so it is the same every time: in the order of 200,000 passages, 20,000 concepts, 2,000 works, 300 research topics and a dozen traditions. Every name invented, a "Sample" mark on the page. Never a real person's name or a real teacher's words.
> - **Depths, like looking closer.** Far away: traditions as regions, with counts and no lines. Closer: research topics as lines with their intersections. Closer: the stops on a line, each a concept, with its neighbours. Closest: one concept, which opens the Nugget screen of the first mock-ups. What is drawn at each depth is a design decision; make it and say why.
> - **The distillation zooms too.** A concept's distillation has depths: a glance, a medium reading, a full one, with the exact words beneath all of them. Moving closer to a concept should deepen its distillation in the same gesture, or one that feels like it, so that zooming the map and zooming the meaning are one habit. Each depth stays labelled as a distillation.
> - **Moving.** Pinch and drag on a phone, wheel and drag on a computer. A "where am I" trail that is always visible and can be tapped to step back out. It opens where he last was. "Back to where I was" after any jump.
> - **Honing in.** Say or type a feeling or a name and the map flies there. Narrow by tradition, topic, kind of line, or resonance (brightness), and watch the rest fade, not vanish. Show the path between two concepts.
> - **Brightness is resonance**, his to set, and the brightest things are what he sees first at every depth.
> - **Play.** It should be a pleasure to move in. Momentum, a sense of arriving, something that answers every touch.
> - **Connections between connections** are new ground (the survey found no readable picture of them at size). Do not let them steer this page. At the closest depth, show one as a small knot that can be opened, and no more.
>
> **It must hold at size, and you must say honestly whether it does.** Draw only what is in view. Choose the drawing method for the amount of data. Measure how smoothly it moves with the full generated set and write the numbers in your handoff, with what breaks first as the bank grows ten times larger. A beautiful page that only works with nine concepts fails the assignment.
>
> **Calm reading, by his third reaction to the first screens.** "You're not using proper Separation or formatting so all the words blend in together even though you've changed fonts and all that, they're not working in a way that I can Really feel the separation and feel calm. I feel like I'm having to sort your words with my head rather than enjoy reading." So separation comes from space and surface, not from typeface or label colour: groups set apart by space, a quote on its own inset surface, each line to a neighbour as one ruled row. He should enjoy reading, never have to sort the words in his head. The first mock-ups were corrected this way; follow their corrected form.
>
> **Width and the kinds of line.** "Now your UI significantly reduces the amount of text because of the multiple buffers and barriers is there a way to do this so we don't have to lose so much width. Also here the comes first and explains by in contrasts maybe could be something a little more refined. This feels still a bit added on." So separation must not cost reading width: no stacked frames and gutters around text; quotes run edge to edge of their card. The kinds of line are part of the map's own language (its line marks), grouped quietly, never labels added on.
>
> **Works and concepts, both ways; huge maps that join.** "On the left side of this I'm not fully understanding what I actually do with all of these already whole concepts or things like that. I think it could use a bit more refinement around how these things interconnect and interact. Also, I see this map being significantly bigger, a huge map, connecting to other huge maps. Also one book may have a hundred concepts. It's important to be able to keep the book together in some sort of map as well so that we can refer to either. We're not just trying to create everything as just concepts, we're also trying to collect the concepts out of books and be able to browse in either direction." So: he can browse by work and by concept, and switching between the two is always one touch away. A work keeps its own map, whole, as a region of the huge map, and maps join where works share a concept. A book of a hundred concepts needs depths inside its own map. Include at least a few such large works in the generated bank. And at every concept the next moves must be plain: what he can do with it, said by the controls themselves, not by a sentence.
>
> **Written for him, not for a machine (sent to the thread after it started).** "Also these concepts that you are giving me are not r really understandable or assimilatable. They feel like they are written for AI. The number one thing is that they are valuable to me. That I don't have to process to understand what you're talking about. You have failed at this as well. The thing is this is a massive repository of many different things. So it's almost like a knowledge graph. You know, you have one book, you have all the concepts inside of the book. You can connect all those concepts together. Have one article, all the concepts, connect them. The ways to navigate and go through everything. Feels like it needs to be much larger of a interaction of all these conceptual maps as well." So no compressed labels: every concept name, distillation and reason on a line is understood on first reading without the source, in words a person would say aloud. Hand-write with care the part of the bank he will land in; let generated filler read as plain language; say which is which. And make the interaction between the maps of different works large and central.
>
> **As long as understanding needs (sent to the thread after it started).** "Ideally these concepts are not just this one sentence, they're however long they need to be. I feel like you're consolidating them for space rather than the amount of words for a human to really understand it." So the layout makes room for the words; the words are never cut to fit the layout.
>
> **The deep reading (sent to the thread after it started; a second stage).** "Yeah. For example, you are this Buddha nature, everything is perfect. But this is what you do with it. Here's how you are able to embody it. Here's the ways to deeper understand it. Here's how that statement could be misunderstood to avoid things. And also in addition, this idea, maybe I can hit a button and share voice insights and different things into this this way. My thoughts and experiences start to fuse into the depth of this. I think this is a big portion, not just collecting other people's things, but my learning process and growth through reflecting on these assimilating this is almost like a hybridized reading guide so I don't want to dumb things down so much and not have the larger information available either. This needs to be going deeper and deeper down the rabbit hole. This is also my educational system. It's like the future of school picking what information to download into my brain. So the highly consolidated thing only exists to pull me into a much deeper understanding that I will also read through this, which you have not represented yet." So, reached by zooming all the way in, one concept is drawn all the way down as a long reading page: what it is; what you do with it; how you embody it; ways to understand it more deeply; how it can be misunderstood; then the full passages and the source. A voice button at every depth; his words kept visibly his, dated, in place. Stage one is the map, stage two is this page; the link goes to him after stage one.
>
> **Rules that still hold.** A nugget is a concept, not a best line; nothing is deleted; a concept is never shown alone. No sideways scrolling of the page. Few type sizes, one interface face, Lora only for spoken words. No sentences that describe the screen back to him. Never the em dash character.
>
> **Bounds.** Every thread of Adrian's shares one usage allowance, and the build of version two runs beside you. Phone first (390 wide), then one check at 1440. One direction. Look at your own pictures as small contact sheets, at most twice per depth. If your conversation passes about a third of its capacity, stop, push and say so.
>
> **Deliver.**
> - The page under `design/2026-11-wisdom-bank/zoom/` on your branch, pushed, with a `HANDOFF.md` beside it: what each depth shows and why, what is invented, the measurements, what breaks first, what you were unsure of.
> - The page published so Adrian can open it on his phone. Lead your message to him with that link and three plain sentences on how to move in it.
> - Then stop and wait for his reaction. Record what he says, in his words, in `HANDOFF.md`.
>
> **Who coordinates.** The coordinating thread is `session_017kitFgZ5x2SMHzVzcAbotm`; its record is `docs/plans/2026-11-11-manager-handoff.md`, and this brief is plan 12 there. Begin your closing message with one plain line saying what is done and what you are waiting for, and send that line to the coordinator.
>
> **How Adrian wants to be answered.** A link or a picture first. Plain full sentences. No code, no commit hashes, no internal codes. Say what is finished, what is not, and what he must decide, with your recommendation. He often dictates by voice.

## After it

- His reaction decides the next pass.
- Then the foundations note (how a bank this size is stored and found, so the map can stay fast), which this page's measurements feed directly.
- Then building inside version two's Research station.
