---
version: 1
slug: "focus-timer-src-app-svelte"
primary_target: "focus-timer/src/App.svelte"
related_targets: ["focus-timer/src/styles.css.ts","focus-timer/theme.ts"]
---

# Focus Timer pilot

Mode: Operate. Everyday personal use in a small desktop window. One job: start a
focus session and understand how much time remains. Code-first, explicitly chosen
by the user. Preserve saved data, the fixed 440px circular window, and focus/break
behavior. The user selected the tactile tomato identity and approved this plan.

## Direction contract

THESIS: A tomato desk timer with a readable instrument face. Its shape identifies
the object; the controls need no metaphor to understand.

OWN-WORLD: Satin tomato-red shell, muted green leaf, warm cream inset dial,
graphite tabular Barlow numerals, soft directional highlights, compressed buttons.

STORY: See Focus and 25:00, press Start, read remaining time. Pause holds time;
completion makes the next mode ready without starting it automatically.

FIRST VIEWPORT: At 440 × 440, a 260px cream dial sits below the small leaf. Mode
controls, 72px digits, and a short status occupy its center. A cream 160 × 48px
primary button and 44px reset sit below the dial. Recent focus count sits at the
foot. No scroll, tiny labels, fabricated hardware, or decorative controls.

FORM: User-pinned tactile tomato Instrument. Seed 73b0ea9a assigned index 7;
the user's explicit selection takes precedence over the roll and challengers.
No second concept selection is needed. Existing `_vibe/` boards are the finish
reference, not assets. Motion is button compression and an accurate remaining-time
arc; reduced motion snaps it. The approved plan specifies code-drawn geometry.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Validation: clock pause/resume/reset/mode/completion regression tests, manifest-size
browser inspection, reduced motion, accessible focus, gallery export and icon,
Svelte checks, package build and validation. No other example changes or publishing.
