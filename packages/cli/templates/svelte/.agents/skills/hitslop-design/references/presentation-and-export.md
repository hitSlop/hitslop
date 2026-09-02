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

During static capture the root has `data-slop-capture="static"`. Add
`data-slop-export="hide"` to editing-only controls and use capture CSS for
necessary flattening. Do not hide the content those controls manipulate.

Preview preserves manifest dimensions. PNG/PDF export uses current width and
full document height; PNG is deterministic 2× and PDF keeps selectable text/
vectors. Keep export content in normal flow, not nested scroll panels.

## Icon

Mount at most one 512×512 `data-slop-render="icon"` target only when
`capture.isRenderer()` is true. Reveal it only in icon capture mode. The icon
should communicate the job with a strong silhouette, safe margins, and no
essential small text. Catalog detail uses the full preview; Finder and compact
catalog rows use the icon.
