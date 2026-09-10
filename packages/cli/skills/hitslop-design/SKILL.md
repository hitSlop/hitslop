---
name: hitslop-design
description: Design or refine hitSlop mini apps and documents with a purpose-led tactile language, responsive native-window behavior, transparent or PNG-skinned surfaces, and export-aware capture.
---

# hitSlop design

Read `manifest.json` first and design at its exact initial dimensions. A slop
is one complete digital object, not a small website.

Each slop should be unique, expressive, and instantly graspable for its single
purpose. Share standards of clarity and familiar interaction behavior; let each
object choose its own palette, typography, composition, and material. Paper,
Instrument, and Skin are starting points, not a required retro or physical look.

If the project provides `_vibe/`, inspect it for visual direction. Treat those
images as inspiration only; do not copy them into source or runtime packages.

## Decide before styling

1. State the single job in one sentence.
2. Choose a dominant object family: Paper, Instrument, or Skin.
3. Identify the primary action/readout and persistent state.
4. Decide whether the window is standard/resizable, transparent, or PNG-skinned.
5. Define what live editing, static capture, and icon must show.

Read [references/object-families.md](references/object-families.md) for visual
patterns and anti-patterns. Read
[references/presentation-and-export.md](references/presentation-and-export.md)
for transparency, resizing, skins, responsive layout, capture, icon, PNG,
and PDF behavior.

## Core design rules

- Let the host window be the outer object boundary; do not wrap everything in a
  generic app card or fake desktop window.
- Use hierarchy, spacing, typography, rules, and tonal contrast before adding
  containers.
- Choose a coherent palette for the object's purpose: a neutral or saturated
  surface can lead. Reserve additional state colors for meaning, and keep
  state understandable through labels and structure as well as color.
- Size the initial viewport around realistic default content. Compactness comes
  from rhythm and hierarchy, never tiny type.
- Preserve critical actions at narrow sizes. Prefer container queries and
  reflow to simply hiding features.
- Keep focus visible, labels concise, numbers tabular, contrast accessible, and
  motion respectful of `prefers-reduced-motion`.
- Prefer direct editing and progressive disclosure. When interactive controls are
  needed (dialogs, dropdowns, selects, sliders, segmented tabs, checkboxes, calendars,
  popovers, tooltips), always use Bits UI headless primitives (`bits-ui`). Never home-make
  custom modal overlays, focus traps, or range hacks. Read [references/bits-ui-styling.md](references/bits-ui-styling.md).
- Style Bits UI primitives via data attributes (`[data-dialog-overlay]`, `[data-select-trigger]`,
  `[data-slider-track]`, `[data-state="checked"]`) and CSS custom properties
  (`--slop-surface`, `--slop-accent`, `--slop-ink`). This ensures each slop retains its
  authentic physical personality (Paper, Instrument, Skin) while remaining effortless
  to restyle or re-theme at runtime.
- In new Svelte projects, keep structural styles in Vanilla Extract `.css.ts`
  files and define public tokens in root `theme.ts` via `defineTheme` from
  `@hitslop/runtime/theme`. Use its typed variable references in Vanilla Extract;
  the builder generates `assets/theme.css`. Never maintain both defaults files.
- Use exported `style()` classes for owned elements and import them into Svelte.
  Keep pseudo states, Bits UI data-attribute selectors, and media/container
  queries with the element's base style. Reserve `globalStyle()` for document
  defaults and necessary descendants anchored to a scoped parent. Read
  [references/vanilla-extract.md](references/vanilla-extract.md) when authoring or
  reorganizing styles; do not translate a whole stylesheet into global selectors.
- Mark editing-only UI with `data-slop-export="hide"`; keep exportable content
  in normal flow.
- Make each slop purpose-specific. Shared SDK patterns must not make unrelated
  objects look like one reskinned dashboard.

## Review efficiently

In the hitSlop repository, prefer `bun run slops:review <slug>` for fixed-size
editor, narrow, export, and icon previews with repeatable fixtures and a review
packet. Read [references/review-workbench.md](references/review-workbench.md).
Batch inspection and corrections; verify later changes with the evidence they
need rather than repeating every visual capture for an invisible code change.

## Motion

Use motion to explain an interaction or reinforce the object's character: a
pressed control, settling needle, or changing liquid level. Keep idle objects
quiet unless ongoing motion communicates a real function.

- Keep simple hover/press feedback in `.css.ts` transitions. Use Svelte
  transitions for entering/leaving DOM and `animate:flip` for keyed-list
  reordering. Use `Spring` for physical responses or `Tween` for predictable
  interpolation from `svelte/motion`; prefer these over legacy `spring`/`tweened`.
  No additional animation dependency is needed. See the
  [Svelte motion reference](https://svelte.dev/docs/svelte/svelte-motion).
- Persist the target state immediately; animated values are presentation only.
  Keep precise readouts and accessible values current. Retarget from the current
  visual value on rapid input, and prefer transforms/opacity over layout changes.
- Honor `prefersReducedMotion.current` for JavaScript motion and
  `prefers-reduced-motion` in CSS. Snap active motion when the preference changes
  (on the instance, call `spring.set(target, { instant: true })` or
  `tween.set(target, { duration: 0, delay: 0 })`).
- Keep skinned controls inside the painted, hit-test-safe silhouette. Stop
  transient animation work and clean up timers, audio, and registrations on
  unmount. Celebrations should finish and should not fire just because a saved
  document opens in a completed state.
- Export/icon views render final data, not interpolated values. Capture's CSS
  overrides do not stop JavaScript springs, tweens, or animation loops. When
  capturing an animated editor, settle it through `capture.onPrepare`, await
  the DOM update, and clean up the returned registration. Do not change saved
  data to prepare a capture or rely only on `capture.isRenderer()`.
- Check normal/reduced motion, rapid retargeting, and capture during animation.

Runtime packages remain source-free: never ship authoring skills, editable CSS,
dependencies, build caches, or seed stores inside a `.slop`. The builder alone
adds the canonical document skill.
