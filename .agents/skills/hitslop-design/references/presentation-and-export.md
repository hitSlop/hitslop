# Presentation and export

## Standard and responsive

Manifest width/height are the initial viewport. Standard windows may be
resizable and shaped `rounded`, `ellipse`, or `capsule`. Build the outer
layout with grid/flex, relative units, min/max constraints, and container
queries. Test initial, narrower, and content-heavy states.

An unskinned slop may request `slop.window.resize({ width, height })`; use the
returned host-applied size. Never assume the screen can fit the request.

## Transparent backgrounds

Set `html`, `body`, and the app root transparent, then paint only the visible
object. Transparency does not make pixels click-through. Keep focus rings and
content within the painted surface. Use an exact RGBA PNG skin when native
alpha-shaped hit testing is required.

## PNG skins

The skin path is under `assets/`; PNG dimensions must exactly equal manifest
dimensions and include alpha. Pixels below 10% alpha are click-through. Skinned
windows cannot resize. Avoid critical controls on antialiased/translucent edges.

## Static output

Prefer an optional `Export.svelte` wrapped in `ExportTarget` from `@hitslop/svelte`.
Pass the current data and selected view; share presentation and theme components.
Use normal flow rather than viewport heights or scrolling panels. This view also
supplies the window-sized preview. Without it, use `data-slop-capture="static"`
styles and `data-slop-export="hide"` on editing controls.

PNG exports use current width and full content height at 2×, within 16384 pixels
per side and 24 megapixels. PDF retains selectable text on one content-sized page.
Dedicated exports do not inherit native window masks. Fonts, visible images, and
stable geometry are awaited; asynchronous charts can use `capture.onPrepare`.

## Icon

Use optional `IconTarget` around `Icon.svelte`. It owns renderer-only mounting and
a transparent 512×512 surface. Pass progress or other saved data if useful; keep
a strong silhouette, safe margins, and no essential small text. It refreshes
Finder metadata on close; the published `QuickLook/Icon.png` remains immutable.
Preview icon and export modes in the disposable gallery before native checks.
