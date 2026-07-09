# Atelier — Design System

Editorial fashion house, not startup dashboard. The UI recedes; imagery
dominates. Review it live at `/style`.

## Palette

Near-monochrome, warm, expensive. One accent, used almost never.

| Token        | Value     | Role                                    |
| ------------ | --------- | --------------------------------------- |
| Bone         | `#f2efe9` | Ground — every page sits on it          |
| Bone raised  | `#f9f7f3` | Cards, popovers, sheets                 |
| Ink          | `#191712` | Text, primary buttons                   |
| Ink soft     | `#4c473f` | Secondary text                          |
| Ink faint    | `#8a847a` | Tertiary/metadata text                  |
| Oxblood      | `#6e2f28` | The accent: emphasis italics, failures, |
|              |           | destructive edges, primary hover        |
| Hairline     | ink @ 14% | All borders                             |

No gradients (except image-protecting scrims), no shadows, no tech blues.
A fixed film-grain wash (`body::after`, 3% noise) keeps large bone fields
from feeling sterile.

## Type

- **Fraunces** (variable; opsz/SOFT/WONK axes) — headlines and the wordmark
  only. Tight tracking, 1.05–1.1 leading at display sizes. Italic = the
  emphasis voice, usually oxblood.
- **Instrument Sans** — everything else.
- **Micro-labels** (`.text-label`): 11px, uppercase, 0.14em tracking — nav
  links, buttons, section eyebrows, metadata. This is the system's signature
  gesture.
- Numbers in metadata are tabular (`tabular-nums`).

## Shape & detail

- Radius: 2px max, everywhere. Gallery frames, not app chrome.
- Hairline borders (1px @ 14% ink) instead of elevation.
- Buttons are tracked uppercase micro-labels; primary = ink block that warms
  to oxblood on hover.
- Empty states are set in Fraunces and written like captions, not apologies.

## Motion

One easing: `cubic-bezier(0.22, 1, 0.36, 1)` — decisive start, long settle.

| Tier    | Duration | Used for                          |
| ------- | -------- | --------------------------------- |
| Hover   | 200–300ms| color/border shifts               |
| Element | 450ms    | page fade (template.tsx), toggles |
| Reveal  | 900ms    | result unveil, landing headline   |

No bounce, no overshoot, no confetti. Images may scale 1.02 on hover over
700ms; the try-on result arrives as a slow fade-and-settle — an unveiling,
not a page refresh. Skeletons are flat bone-toned blocks in the exact layout
they replace.

## Imagery rules

- Assets render at natural aspect in masonry (Library); generated media sits
  in 3:4 frames (Studio, History).
- Hover reveals captions/actions over a bottom ink scrim — chrome lives *on*
  the image only when asked for.
- The before/after compare is a draggable hairline divide, labelled in
  micro-caps, keyboard-operable.

## Voice

Captions, not UI copy: "The look appears here", "Same pair, different eye",
"Set it in motion", "A seam came undone" (error page). Short, assured,
never exclamatory.
