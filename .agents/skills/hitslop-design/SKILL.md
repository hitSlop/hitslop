---
name: hitslop-design
description: Design or refine hitSlop mini apps and documents with a purpose-led tactile language, responsive native-window behavior, transparent or PNG-skinned surfaces, and export-aware capture.
---

# hitSlop design

Read `manifest.json` first and design at its exact initial dimensions. A slop
is one complete digital object, not a small website.

If the project provides `_vibe/`, inspect it for visual direction. Treat those
images as inspiration only; do not copy them into source or runtime packages.

## Decide before styling

1. State the single job in one sentence.
2. Choose a dominant object family: Paper, Instrument, or Skin.
3. Identify the primary action/readout and persistent state.
4. Decide whether the window is standard/resizable, transparent, or PNG-skinned.
5. Define what live editing, static capture, cover, and icon must show.

Read [references/object-families.md](references/object-families.md) for visual
patterns and anti-patterns. Read
[references/presentation-and-export.md](references/presentation-and-export.md)
for transparency, resizing, skins, responsive layout, capture, cover, icon, PNG,
and PDF behavior.

## Core design rules

- Let the host window be the outer object boundary; do not wrap everything in a
  generic app card or fake desktop window.
- Use hierarchy, spacing, typography, rules, and tonal contrast before adding
  containers.
- Use one dominant neutral surface and one purpose-specific accent; reserve
  extra color for meaningful state.
- Size the initial viewport around realistic default content. Compactness comes
  from rhythm and hierarchy, never tiny type.
- Preserve critical actions at narrow sizes. Prefer container queries and
  reflow to simply hiding features.
- Keep focus visible, labels concise, numbers tabular, contrast accessible, and
  motion respectful of `prefers-reduced-motion`.
- Prefer direct editing and progressive disclosure. Use native HTML or Bits UI
  only when its interaction matches the job.
- Mark editing-only UI with `data-slop-export="hide"`; keep exportable content
  in normal flow.
- Make each slop purpose-specific. Shared SDK patterns must not make unrelated
  objects look like one reskinned dashboard.

Runtime packages remain source-free: never ship skills, editable CSS,
dependencies, build caches, or seed stores inside a `.slop`.
