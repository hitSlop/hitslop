# Presentation and export

## Standard and responsive

Manifest width/height are the initial viewport. Standard windows may be
resizable and shaped `rounded`, `ellipse`, or `capsule`. Build the outer
layout with grid/flex, relative units, min/max constraints, and container
queries. Test initial, narrower, and content-heavy states.

An unskinned slop may request `slop.window.resize({ width, height })`; use the
returned host-applied size. Never assume the screen can fit the request.

## Transparent backgrounds

Start with a built-in shape and `background: "transparent"`. The host supplies
page sizing/transparency and fills `<Slop>`'s root and its mount ancestors.
Framework-neutral apps mark their root `data-hitslop-root`. No manual transparent
page reset is needed. Standard opaque windows retain authored layout.

The native host sets `data-slop-presentation` (`standard`, `transparent`, `skin`),
`data-slop-shape` for built-in shapes, `data-slop-resizable` when enabled, and
`--slop-width`/`--slop-height` for initial dimensions. Use fluid CSS for live size.
These low-specificity layout rules are disabled during capture.

Transparency alone does not create input holes. Keep focus rings and controls
inside the native silhouette. Move windows using the native toolbar handle;
there is no guest drag API or drag-attribute contract.

## PNG skins

Use a PNG only for a hole or an outline no built-in shape describes. The skin
path is under `assets/`; RGBA dimensions exactly equal manifest dimensions.
The image is both native backing artwork and alpha mask. Alpha 0–25 is
click-through; 26–255 receives input. Skinned windows cannot resize. Avoid
critical controls on antialiased/translucent edges. Verify clicks actually reach
the application behind a hole, not merely that a DOM element ignores them.

## Static output

Use an optional inline `exportView` snippet inside `<Slop {document}>` from
`@hitslop/document/svelte`. Separate components are optional.
Pass the current data and selected view; share presentation and theme components.
Use normal flow rather than viewport heights or scrolling panels. This view also
supplies the catalog and Quick Look preview (captured at the export object’s
size, not the empty editor window). Without it, use `data-slop-capture="static"`
styles and `data-slop-export="hide"` on editing controls.

PNG exports use current width and full content height at 2×, within 16384 pixels
per side and 24 megapixels. PDF retains selectable text on one content-sized page.
Dedicated exports do not inherit native window masks. Fonts, visible images, and
stable geometry are awaited; asynchronous charts can use `capture.onPrepare`.

## Icon

Use an optional inline `icon` snippet in the same `<Slop>` wrapper. It mounts
only for capture on a transparent 512×512 surface. Pass progress or other saved data if useful; keep
a strong silhouette, safe margins, and no essential small text. It refreshes
Finder metadata on close; the published `QuickLook/Icon.png` remains immutable.
Build and inspect the generated QuickLook images, then verify native exports.
