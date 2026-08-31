---
name: hitslop-design
description: Design or refine hitSlop mini apps and documents with the project’s purpose-led, tactile visual language and export-aware interaction conventions.
---

# hitSlop design

Read `manifest.json` first and design for its actual window size. A slop is a complete, single-purpose digital object, not a small website.

## Choose the object family

- **Paper:** invoices, notes, recipes, resumes, and contacts. Prefer readable type, fine rules, warm surfaces, modest rounding, and shallow lifted depth.
- **Instrument:** timers, trackers, mixers, and analytics. Use compact controls, inset readouts, functional state color, and deliberate hardware-like grouping.
- **Skin:** media and novelty tools whose silhouette reinforces their purpose. Use an exact-size RGBA window skin and keep essential interaction inside its safe area.

These are starting points, not enforced themes. Combine them only when the purpose calls for it.

## Build the interface

- Make the purpose and primary workflow obvious at a glance. Remove navigation and setup that the small app does not need.
- Use at most three meaningful depth layers: backing or chassis, primary surface, and inset or raised controls. Avoid interchangeable cards and decorative shadows.
- Choose a dominant neutral surface and one purpose-specific accent. Reserve other colors for state.
- Keep controls compact, labels short, numbers tabular, focus visible, text contrast accessible, and motion reduced when requested.
- Prefer direct editing and progressive disclosure. Do not open a dialog when an inline action is clearer.
- Adapt with container queries. Preserve critical actions at narrow sizes rather than hiding them.
- Use Bits UI for matching headless interactions; native HTML remains appropriate for basic buttons and fields. In the hitSlop repository, consult `_docs/bits-ui-main` for the installed API.

## Design for static output

- Mark editing-only controls and diagnostics with `data-slop-export="hide"`.
- Use `html[data-slop-capture="static"]` for any additional flattening needed during PNG, PDF, Quick Look, or catalog capture.
- Keep content that must export in normal document flow. Nested scroll regions are not automatically expanded.

Runtime packages remain source-free: never ship this skill, editable CSS, dependencies, build caches, or seed stores inside a `.slop`.
