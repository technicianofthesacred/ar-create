---
version: alpha
name: Personal
description: >-
  Personal artist portfolio for sacred-geometry sculpture and immersive
  installations. Wood, bronze, and stone warmth; classical serif; poetic and
  meditative. Bringing the formless into form.
colors:
  primary: "#c4aa7c"          # bronze — the accent
  primary-hover: "#9e8459"    # warm gold hover
  background: "#262321"       # darkest wood — hero ground
  surface: "#3d3226"          # wood-800
  surface-elevated: "#524330" # wood-700
  on-background: "#f2efe9"    # cream — text on dark
  on-surface-secondary: "#c2beb8"
  on-surface-dim: "#8a857c"
  # Light variant (paper / gallery wall)
  background-light: "#f5f4f0" # paper-50
  surface-light: "#ebe8e1"
  surface-elevated-light: "#e0dbcf"
  on-background-light: "#23201e" # stone-950
  primary-light: "#8a744e"    # bronze-600
typography:
  display:
    fontFamily: Cormorant Garamond
    fontSize: 4.5rem
    fontWeight: 400
    lineHeight: 1.08
  heading:
    fontFamily: Cormorant Garamond
    fontSize: 1.75rem
    fontWeight: 400
    lineHeight: 1.2
  subhead:
    fontFamily: Cormorant Garamond
    fontSize: 1.375rem
    fontWeight: 400
  lead:
    fontFamily: Lora
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: Lora
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.7
  meta:
    fontFamily: Lora
    fontSize: 0.875rem
    fontWeight: 400
  eyebrow:
    fontFamily: Karla
    fontSize: 0.6875rem
    fontWeight: 500
    letterSpacing: 1.5px
  monogram:
    fontFamily: Cinzel
    fontSize: 1.5rem
    fontWeight: 400
rounded:
  full: 9999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: 14px
  card:
    backgroundColor: "{colors.surface}"
    padding: 24px
# slides: the roles a Carousel slide needs, for posts on a dark ground and on a light one. Each value is a token
# of this file ({colors.name}, {typography.name}) or a plain value. Read by AR Create; not part of the DESIGN.md spec.
# Proposed by AR Create's look import from Adrian-Website/DESIGN.md on 10 November 2026. What it guessed:
# - light.supporting: No token is named for supporting, so it is mixed from background-light and
# on-background-light (between the headline and the ground).
# - light.label: No token is named for label, so it is mixed from background-light and on-background-light
# (quieter than the supporting words).
# - fonts.label: Karla has no font file in the app yet, so label is drawn in Plus Jakarta Sans until it is
# added.
# - logo: No logo file came with this DESIGN.md, so the logo is the brand's name set in its headline type until
# a file is added.
slides:
  dark:
    ground: "{colors.background}"
    box: "{colors.surface}"
    line: "{colors.surface-elevated}"
    headline: "{colors.on-background}"
    supporting: "{colors.on-surface-secondary}"
    label: "{colors.on-surface-dim}"
    accent: "{colors.primary}"
  light:
    ground: "{colors.background-light}"
    box: "{colors.surface-light}"
    line: "{colors.surface-elevated-light}"
    headline: "{colors.on-background-light}"
    supporting: "#514f4c"
    label: "#827f7c"
    accent: "{colors.primary-light}"
  fonts:
    headline: "{typography.display}"
    body: "{typography.body}"
    label: "{typography.eyebrow}"
  logo:
    dark: ""
    light: ""
    wordmark: Adrian Rasmussen
  link: "adrianrasmussen.com/writings"
# assets: what can be placed on a slide in this look (logo, mark or graphic), each with a file in this
# look's folder or an app path, or (a mark) characters drawn as a seal. A logo with no file is the brand's name set in
# its headline type. Read by AR Create; not part of the DESIGN.md spec.
assets:
  wordmark:
    name: "Adrian Rasmussen wordmark"
    kind: logo
---

## Overview

Personal writing publishes on adrianrasmussen.com, the art site, so this look starts as a copy of the Art look: the same
colours, type and rules, with its own id and name. Change it here when personal posts should look different from the art.

This is Adrian Rasmussen's personal artist portfolio and shop — multidimensional
wooden sculptures, sacred geometry, jewelry, oracle cards, and immersive
installations. The signature line is **"Bringing the formless into form."** The
feel is poetic and meditative: warm wood and bronze, classical serif type, and
intimate, unhurried space. The work is about presence and connection more than
intellect — the design should make a viewer feel rather than analyze. Dark wood
is the default hero ground; a paper-light gallery variant exists for daylight.

## Colors

A warm natural range — wood, stone, bronze — pulled straight from the material of
the sculptures.

- **Bronze (#c4aa7c dark / #8a744e light):** The single accent. The call to
  action and key emphasis, echoing the metal in the work.
- **Darkest wood (#262321):** The hero ground and default canvas.
- **Cream (#f2efe9):** Primary text and headlines on the dark ground.
- **Wood surface steps (800 to 700):** Quiet depth for raised elements.
- **Paper set (light variant):** Paper #f5f4f0 ground with deepened bronze, for
  bright/gallery contexts.

## Typography

A classical serif voice with one sans label and a monogram face.

- **Cormorant Garamond** — display and headings, the brand's voice. Large,
  elegant, set at regular weight. Use 20px and up.
- **Lora** — all reading text, leads, body, captions. Generous line height for a
  contemplative read.
- **Karla** — small uppercase eyebrows and labels with wide tracking. Never body.
- **Cinzel** — the "A" monogram and rare special headers only.

## Layout

Generous and gallery-like. Spacing reaches 96px between sections; give every
work room to breathe. A single calm column with wide margins. The art is the
hero — type recedes and frames it, never competes.

## Elevation & Depth

Depth is felt, not drawn. Step the surface color up and use a soft shadow to
raise an element. No hard borders or outlines around content.

## Shapes

Soft and minimal. Buttons are full-round pills; content corners stay gentle.
Avoid hard 90° edges on anything a viewer reads from.

## Components

- **Primary button:** Bronze fill, wood text, full-round pill, uppercase Karla
  label. One per frame.
- **Card:** Wood surface, 24px padding, soft depth, no border.

## Do's and Don'ts

- **Do** lead with a Cormorant line and let the artwork dominate.
- **Do** write in poetic, meditative, intimate language — feeling over intellect.
- **Do** keep one bronze accent per composition; let wood and cream carry the rest.
- **Do** leave gallery-grade space around every piece.
- **Don't** add a second accent, bright red, or pure black/white.
- **Don't** use the sans family for headlines or body — labels only.
- **Don't** crowd or over-explain; the work speaks through stillness.
- **Don't** draw borders to separate things; use a step of surface color instead.
