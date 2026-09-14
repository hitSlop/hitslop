---
name: Decision Balance
description: A compact weighing instrument for reasons and personal judgment.
colors:
  surface: "#343935"
  paper: "#f5f2e9"
  paper-soft: "#e8e6db"
  ink: "#29332d"
  muted: "#62675d"
  pro: "#21564a"
  pro-soft: "#e4eee8"
  con: "#8a3324"
  con-soft: "#f3e6e0"
  surface-focus: "#e4ca8b"
typography:
  display:
    fontFamily: '"Decision Barlow", Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: '"Decision Barlow", Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif'
    fontSize: "26px"
    fontWeight: 600
  body:
    fontFamily: '"Avenir Next", Avenir, "Helvetica Neue", sans-serif'
    fontSize: "15px"
    lineHeight: "22px"
  label:
    fontFamily: '"Avenir Next", Avenir, "Helvetica Neue", sans-serif'
    fontSize: "12px"
rounded:
  control: "5px"
  working-bed: "9px"
  scale-pan: "0 0 16px 16px"
  icon-pan: "0 0 18px 18px"
spacing:
  small: "8px"
  medium: "12px"
  large: "20px"
components:
  add-pro:
    backgroundColor: "{colors.pro-soft}"
    textColor: "{colors.pro}"
    rounded: "{rounded.control}"
    size: "44px"
  add-con:
    backgroundColor: "{colors.con-soft}"
    textColor: "{colors.con}"
    rounded: "{rounded.control}"
    size: "44px"
  status:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Decision Balance

## Overview

**Creative North Star: "The compact weighing instrument"**

Warm graphite holds an ivory working bed. A shallow moving balance makes the
arithmetic visible while editable reasons remain the main working content.
The owner supplies the conclusion.

**Key Characteristics:**
- A compact mechanical readout above direct text editing.
- Green Pros and rust Cons, reinforced by words and point totals.
- Quiet controls with visible focus and generous action targets.

## Colors

Muted green is the primary Pros accent; rust is the secondary Cons accent.
Their pale surfaces distinguish matching controls. Graphite frames ivory,
with dark ink and subdued secondary text inside the working bed. The pale
gold focus color belongs on the dark header.

**The Paired Sides Rule.** Keep each side's heading, slider range, and add
control in its own accent family; retain text labels and totals.

## Typography

Bundled Barlow Semibold supplies the decision statement, side headings, title,
and pan totals. Avenir Next with the declared fallbacks handles editable reasons
and supporting controls. The title is 21px; pan totals are 18px. The frontmatter
records the recurring text roles. Numeric totals use tabular figures.

## Layout

The initial resizable window is 720 × 680. A 12px graphite surround holds the
working bed. Two equal columns place reasons above their composers; the verdict
area follows in normal flow. At container widths of 560px or less, the sides,
readout, and footer stack; the review board includes a 360px editor.
Text areas grow with their content, and long sheets scroll vertically.

## Elevation & Depth

Tone and thin rules define the main surfaces. Small soft shadows give the slider
thumb a grip, the status menu separation, and add buttons an inset hover response.
The working bed itself is flat. Focus underlines belong to fields; outlined
focus belongs to buttons and slider thumbs.

## Shapes

Gently rounded controls sit inside the broader working-bed corners. The balance
uses a narrow beam, triangular fulcrum, and curved pans. Action targets are 44px;
the slider's smaller visible thumb has an expanded hit area.

## Components

- **Reason rows:** growing text above a numeric Importance control, separated
  by quiet rules. Slider labels explain the endpoints as “1 minor to 5 decisive.”
- **Composers:** direct text entry, a draft importance slider, and a matching
  side-colored add button. Empty entry disables add; submission returns focus.
- **Live beam:** totals drive a bounded tilt over 420ms with cubic-out easing.
  Initial render, reduced motion, and capture settle immediately. A text readout
  states the difference or “Even balance.”
- **Verdict:** an ordinary status selector and freeform notes, independent of
  the arithmetic.
- **Export and icon:** the export keeps reasons, weights, and verdict in full
  document flow; the icon reduces the same housing, beam, and paired reasons.

## Do's and Don'ts

- **Do** keep reasons editable and the arithmetic readable in words and numbers.
- **Do** preserve the graphite, ivory, green, and rust relationships across capture views.
- **Do** keep focus visible and settle beam motion for reduced motion and capture.
- **Don't** turn the calculated balance into an automatic verdict.
- **Don't** add sample reasons to a new owner's document; use author-only review fixtures.
