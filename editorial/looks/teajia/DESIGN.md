---
version: alpha
name: Teajia
description: >-
  Teajia's Instagram look: warm near-black and tea-paper grounds, one gold accent, Caudex for headlines and labels,
  EB Garamond for supporting words, and three small seals for the pillars.
colors:
  ground: "#1a1714"
  box: "#2a2622"
  line: "#3a3530"
  headline: "#f3eada"
  supporting: "#cdc0a8"
  label: "#8d806b"
  gold: "#a8874d"
  ground-light: "#f4ece0"
  box-light: "#e6dbcc"
  line-light: "#d5c8b4"
  headline-light: "#18130e"
  supporting-light: "#443a2c"
  label-light: "#9a8c78"
  gold-light: "#8e6d2e"
typography:
  headline:
    fontFamily: Caudex
    fontSize: 64px
    fontWeight: 400
    lineHeight: 1.1
  supporting:
    fontFamily: EB Garamond
    fontSize: 42px
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: Caudex
    fontSize: 30px
    fontWeight: 400
    letterSpacing: 0.16em
  chinese:
    fontFamily: Shippori Mincho
    fontWeight: 800
  photo-character:
    fontFamily: Noto Serif TC
    fontWeight: 900
spacing:
  edge: 90px
  gap: 22px
components:
  slide-dark:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.headline}"
  slide-light:
    backgroundColor: "{colors.ground-light}"
    textColor: "{colors.headline-light}"
  label:
    textColor: "{colors.supporting}"
    typography: "{typography.label}"
  seal:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ground}"
    typography: "{typography.chinese}"
# slides: the roles a Carousel slide needs, for posts on a dark ground and on a light one. Each value is a token
# of this file ({colors.name}, {typography.name}) or a plain value. Read by AR Create; not part of the DESIGN.md spec.
# logo: a file in this look's folder, an app path such as /ig-assets/name.png, or empty for the brand's name set in
# its headline type. link: where a reader goes next, shown on the Full story link close.
slides:
  dark:
    ground: "{colors.ground}"
    box: "{colors.box}"
    line: "{colors.line}"
    headline: "{colors.headline}"
    supporting: "{colors.supporting}"
    label: "{colors.label}"
    accent: "{colors.gold}"
  light:
    ground: "{colors.ground-light}"
    box: "{colors.box-light}"
    line: "{colors.line-light}"
    headline: "{colors.headline-light}"
    supporting: "{colors.supporting-light}"
    label: "{colors.label-light}"
    accent: "{colors.gold-light}"
  fonts:
    headline: "{typography.headline}"
    body: "{typography.supporting}"
    label: "{typography.label}"
  logo:
    dark: "/ig-assets/teajia-wordmark.png"
    light: "/ig-assets/teajia-wordmark.png"
    wordmark: teajiā
  link: "teajia.com/read"
# assets: what can be placed on a slide in this look (logo, mark or graphic), each with a file in this
# look's folder or an app path, or (a mark) characters drawn as a seal. A logo with no file is the brand's name set in
# its headline type. Read by AR Create; not part of the DESIGN.md spec.
assets:
  wordmark:
    name: "Teajia wordmark"
    kind: logo
    file: "/ig-assets/teajia-wordmark.png"
  seal-excellence:
    name: "Seal 佳, excellence"
    kind: mark
    text: "佳"
  seal-home:
    name: "Seal 家, home"
    kind: mark
    text: "家"
  seal-celebration:
    name: "Seal 嘉, celebration"
    kind: mark
    text: "嘉"
---

## Overview

Teajia's posts feel like a quiet tea room at dusk: real photographs of tea, hands and places, warm grounds, and words set
small and calm beside them. The colours and type below are the ones written into every Carousel layout today; they come
from the Instagram guide, which wins if this file and the guide ever disagree.

## Colors

Every post is dark or light, never pure black or white.

- **Dark ground ({colors.ground}):** the near-black of a tea room. Boxes ({colors.box}) and lines ({colors.line}) step
  up from it quietly. Headlines are {colors.headline}, supporting words {colors.supporting}, quiet labels {colors.label}.
- **Light ground ({colors.ground-light}):** tea paper, with box {colors.box-light}, line {colors.line-light}, headline
  {colors.headline-light}, supporting words {colors.supporting-light} and labels {colors.label-light}.
- **Gold ({colors.gold} on dark, {colors.gold-light} on light):** the one accent: the seal, a rule, a credit.

## Typography

- **Caudex** for headlines and labels.
- **EB Garamond** for supporting words.
- **Shippori Mincho** for Chinese text.
- **Noto Serif TC** only for photographs set inside characters.
- No italics. Labels are spaced capitals of at least 30px.

## Layout

A slide is 1080 by 1350. Words keep 90px from the edges and sit only on calm parts of a photograph. No two neighbouring
slides share a layout, and one slide in a carousel has no words at all.

## Shapes

Square corners. A box is a flat step of colour, never a shadowed card.

## Components

- **Wordmark:** the teajiā wordmark (`/ig-assets/teajia-wordmark.png`) sits on covers, closes and single posts only,
  never on inner slides. On a light post it is printed dark.
- **Seals:** a small gold seal marks the pillar a post belongs to: 佳 excellence, 家 home, 嘉 celebration. The three jiā
  and their seals are Teajia's own and are never drawn in another brand's look.
- **Photographs:** real, cropped, never stretched or squashed.

## Do's and Don'ts

- **Do** make every post dark or light, never pure black or white.
- **Do** keep the wordmark to covers, closes and single posts.
- **Do** set labels in spaced capitals of at least 30px.
- **Do** crop photographs; place words only on their calm parts.
- **Don't** use italics.
- **Don't** let two neighbouring slides share a layout; let one slide carry no words.
