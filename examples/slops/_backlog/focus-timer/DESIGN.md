---
name: Pomodoro
description: A tactile tomato desk timer with a readable instrument face.
colors:
  surface: "#d94935"
  surface-light: "#f36b50"
  surface-rest: "#d94935"
  surface-deep: "#a92b22"
  panel: "#f5edda"
  panel-shade: "#e8ddc4"
  ink: "#302d28"
  muted: "#6b604f"
  accent: "#bd3e2d"
  rest-accent: "#3e654c"
  action: "#f5edda"
  focus: "#fff8dc"
  on-surface: "#fff3df"
typography:
  display:
    fontFamily: '"Barlow Timer", "Avenir Next", sans-serif'
    fontSize: "clamp(52px, 16.4cqw, 72px)"
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: "-.025em"
  body:
    fontFamily: '"Avenir Next", Avenir, sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: '"Avenir Next", Avenir, sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
  action:
    fontFamily: '"Avenir Next", Avenir, sans-serif'
    fontSize: "16px"
    fontWeight: 600
rounded:
  mode: "8px"
  action: "24px"
  circle: "50%"
spacing:
  readout-gap: "3px"
  action-gap: "12px"
  action-content-gap: "10px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    height: "48px"
    width: "36.4cqw"
  button-reset:
    textColor: "{colors.on-surface}"
    rounded: "{rounded.circle}"
    size: "44px"
    padding: "0"
  mode-tab:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.mode}"
    padding: "0 9px"
  mode-tab-active:
    backgroundColor: "#fffdf280"
    textColor: "{colors.ink}"
  dial:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    width: "59.1cqw"
    height: "59.1cqw"
---

# Design System: Pomodoro

## Overview

**Creative North Star: "The Tomato Desk Timer"**

A tactile tomato desk timer with a readable instrument face. Satin red material, a muted green leaf, a warm cream recess, and graphite numerals make the purpose visible before any interaction. This is Focus Timer’s own identity; other slops choose their own worlds.

**Key Characteristics:**
- One dominant, tabular time readout.
- Code-drawn shell, leaf, dial, and compressed controls.
- Quiet idle state; explicit words for running, paused, and complete.

## Colors

The palette describes a warm physical object, with restrained green for its leaf and break progress.

### Primary

Satin Tomato (`surface`, `surface-light`, `surface-deep`) models the shell; `surface-rest` retains the tomato color in the theme. Tomato Ink (`accent`) draws focus progress and the inset control focus outline.

### Secondary

Leaf Green (`rest-accent`) colors the leaf and the break progress arc. Mode words remain visible, so color never carries the distinction alone.

### Neutral

Warm Cream (`panel`, `panel-shade`, `action`) forms the dial and primary control. Graphite (`ink`) carries the numerals and selected labels; Warm Umber (`muted`) carries supporting text and ticks. Pale Cream (`on-surface`) carries the reset icon, footer, errors, and export name. `focus` provides the bright focus outline on the red shell.

## Typography

Barlow Timer is the locally bundled Barlow SemiBold display face; Avenir Next, Avenir, and sans-serif form the supporting stack. Tabular numerals keep the countdown stable. Barlow’s bundled font is distributed under the SIL Open Font License in `assets/fonts/OFL.txt` (Google Fonts source).

The frontmatter records the live display, status, mode-label, and action roles. The count uses the body weight and size with an 18px line height. Export uses a 16px mode label and 18px name. The icon enlarges Barlow to 128px with unit line height and the same tight tracking.

**The Readout Rule.** Keep time in Barlow and supporting controls in the quieter body face.

## Layout

The native window is a fixed 440 × 440 ellipse. The transparent page centers a circular container sized to the smaller viewport axis, capped at 440px and bounded below at 320px. The stage starts at 14.5cqh with a 3.2cqh gap; the dial is roughly 260px at the native size. The leaf sits above it and the action row beneath it. Footer text stays inside the lower curve.

At a container width of 380px or less, the stage starts at 13cqh with a 10px gap, the dial grows proportionally to 63cqw, numerals use 16cqw, mode labels use 12px, and the primary action becomes 44px tall. This is a compact fallback, not a second native window size.

Export preserves the 440px object with static mode, remaining time, name, and count. The 512px transparent icon canvas contains a 464px object with a simplified 274px face and configured minutes.

## Elevation & Depth

Directional gradients and soft inset shadows describe satin material and a recessed cream face. The primary button sits above the shell and compresses on press; reset is recessed. Exact shadow recipes live in the sidecar and originate in `src/styles.css.ts`.

**The Material Rule.** Use soft directional depth to distinguish shell, recess, and pressable control.

## Shapes

Circles define the shell, dial, progress track, and reset. A pill defines the primary action; softly rounded rectangles define mode tabs. The leaf uses three asymmetrically rounded green forms and a short stem. The dial has 60 code-drawn ticks, with every fifth tick emphasized, and a remaining-time arc starting at twelve o’clock.

## Components

- **Primary action:** cream gradient, graphite icon and text, minimum width 136px. Start, Pause, and Resume share one control. Hover brightens slightly; pressing lowers it 2px and reduces its shadow.
- **Reset:** a circular recessed control with a cream inline SVG arrow. Hover lifts its background tone; pressing lowers it 1px.
- **Mode tabs:** Focus and Break include their configured durations. The selected tab has a translucent cream backing and soft shadow. Targets remain at least 44px tall; selection is disabled while running or loading.
- **Dial:** the shared editor/export component combines ticks, progress, mode, and the time output. The progress arc uses a 350ms cubic-out tween; loading, capture, and reduced motion settle it immediately. Paused time stays visible.
- **Leaf:** decorative code geometry shared by editor, export, and icon. It has no interaction.

Shell controls receive a 3px light focus outline with 4px offset; inset tabs use the accent outline with 1px offset. Control transitions last 120ms with ease-out; reduced motion removes them. Export removes live actions; the icon uses simplified static shapes.

## Do's and Don'ts

### Do:

- Do keep the cream dial and graphite readout dominant.
- Do preserve the same shell, leaf, and numerals in export and icon views.
- Do keep timer state readable in words and snap motion for reduced-motion preferences.
- Do use the on-surface token for footer text and the reset icon.

### Don't:

- Don’t copy this palette or shell into other slops as a shared theme.
- Don’t ship inspiration-board imagery or replace the approved code-drawn object with a raster skin.
- Don’t turn the decorative leaf or dial ticks into apparent controls.
