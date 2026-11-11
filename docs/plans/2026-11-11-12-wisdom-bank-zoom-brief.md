# Plan 12: the wisdom bank at full size, zoom first (the brief)

**Status.** Prepared 11 November 2026, after Adrian's reaction to the first mock-ups. **Not started.** It starts at his word, in a fresh thread, because the mock-ups thread is near the size at which it should stop.

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
