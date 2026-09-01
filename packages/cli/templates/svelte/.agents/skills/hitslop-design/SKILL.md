---
name: hitslop-design
description: Design or refine hitSlop mini apps and documents with the project’s purpose-led, tactile visual language and export-aware interaction conventions.
---

# hitSlop design

Read `manifest.json` first and design for its actual window size. A slop is a complete, single-purpose digital object, not a small website.

## Choose the object family

- **Paper:** invoices, notes, recipes, resumes, and contacts. Prefer readable type, editorial hierarchy, warm surfaces, fine rules, and direct editing.
- **Instrument:** timers, trackers, mixers, and analytics. Use compact controls, inset readouts, functional state color, and deliberate hardware-like grouping without ornamental depth.
- **Skin:** media and novelty tools whose silhouette reinforces their purpose. Use an exact-size RGBA window skin and keep essential interaction inside its safe area.

These are starting points, not enforced themes. Combine them only when the purpose calls for it.

## Build the interface

- Make the purpose and primary workflow obvious at a glance. Remove navigation and setup that the small app does not need.
- Treat the host window as the default outer boundary. Do not wrap the whole slop in another app card, backing slab, or fake offset shadow.
- Use type, spacing, rules, and tonal contrast before adding containers. Add an internal surface only when it communicates function, such as an instrument readout or selected state.
- Choose a dominant neutral surface and one purpose-specific accent. Reserve other colors for state.
- Give each slop a purpose-specific character; shared structure should not make unrelated artifacts look like one reskinned component.
- Size the manifest around the default content and workflow. Do not create empty space merely to imitate a conventional page size.
- Keep body copy comfortably readable at the manifest's native size; compactness should come from hierarchy and rhythm, not tiny type.
- Keep controls compact, labels short, numbers tabular, focus visible, text contrast accessible, and motion reduced when requested.
- Prefer direct editing and progressive disclosure. Do not open a dialog when an inline action is clearer.
- Adapt with container queries. Preserve critical actions at narrow sizes rather than hiding them. Slops may scroll even though the host hides scrollbar chrome.
- Use Bits UI for matching headless interactions; native HTML remains appropriate for basic buttons and fields. Consult the installed Bits UI documentation for the current API.

## Design for static output

- Mark editing-only controls and diagnostics with `data-slop-export="hide"`.
- Use `html[data-slop-capture="static"]` for any additional flattening needed during PNG, PDF, Quick Look, or catalog capture.
- Make static output look like the artifact itself, not a screenshot of an artifact inside app chrome. Remove outer rounding, backing, and decorative shadows.
- Keep content that must export in normal document flow. Nested scroll regions are not automatically expanded.

Runtime packages remain source-free: never ship this skill, editable CSS, dependencies, build caches, or seed stores inside a `.slop`.
