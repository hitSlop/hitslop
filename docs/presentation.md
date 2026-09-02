# Design and presentation

A memorable slop starts with a job, then chooses an object language. The local
images in `_vibe/` are the project's visual reference library: use their sense
of tactile, single-purpose software, but do not copy or ship them.

## Pick an object family

- **Paper** — the output is the object. Use editorial hierarchy, direct editing,
  normal document flow, quiet controls, and excellent PNG/PDF export.
- **Instrument** — interaction is the object. Group controls like hardware,
  prioritize one live readout or action, and make state legible at a glance.
- **Skin** — silhouette is part of the idea. Use it only when the recognizable
  object materially strengthens the task.

Hybrids are welcome. An invoice can gain a thermal-receipt skin; a tracker can
feel like a pocket instrument. Keep one dominant metaphor and one obvious job.

## Standard windows and resizing

Standard presentation takes initial dimensions, optional `resizable` (default
`true`), and `shape` (`rounded`, `ellipse`, or `capsule`).

```json
{
  "presentation": {
    "width": 640,
    "height": 480,
    "resizable": true,
    "shape": "rounded"
  }
}
```

Build from a fluid outer layout: use relative units, min/max constraints, grid
or flex reflow, and test both the manifest size and a smaller supported size.
When content changes modes, an unskinned app may request a bounded native size:

```ts
await slop.window.resize({ width: 480, height: 640 })
```

The host returns the size it could apply. The manifest remains the initial size.

## Transparent backgrounds

For a floating or non-rectangular standard window, make the page and WebView
surface transparent:

```css
html, body, #app { background: transparent; }
.object {
  background: color-mix(in srgb, #16181d 94%, transparent);
  border-radius: 32px;
  overflow: clip;
}
```

Keep interactive content inside the visible object and provide adequate
contrast. Transparency alone does not change hit testing; use a PNG skin when
you need pixel-shaped click-through behavior.

## PNG skins

A skin is an exact-size RGBA PNG under `assets/`:

```json
{
  "presentation": {
    "width": 720,
    "height": 560,
    "skin": "assets/window-mask.png"
  }
}
```

The PNG is the native backing and alpha mask. Pixels below 10% alpha are
click-through. A skinned window is fixed-size: its DOM, image, and hit-test mask
must share exact dimensions. Keep important controls away from feathered edges,
and test dragging plus pointer behavior around transparent holes.

## Static capture and export

The root gains `data-slop-capture="static"` during preview/export. Hide editing
chrome without removing the underlying content:

```html
<button data-slop-export="hide">Add row</button>
```

Keep exportable content in normal page flow. Nested scrolling panels capture
only their viewport and make PDF reading worse. PNG/PDF export uses current
width and full document height; preview uses manifest dimensions.

Call `ready()` only after initial data and critical fonts/images are usable.
Respect reduced motion; capture should not depend on a particular animation
frame.

## Icon art

Icon art is compiled DOM, not an extra image source file. Mount the square
target only in the hidden renderer:

```svelte
{#if capture.isRenderer()}
  <section data-slop-render="icon">…</section>
{/if}
```

The target is exactly one 512×512 element, revealed by CSS only for icon capture
mode. Give it a strong silhouette, safe margins, and no tiny text. Finder and
compact catalog rows use the icon; catalog detail uses the full preview.

## Shipping checklist

Test keyboard access, visible focus, contrast, reduced motion, long text, empty
and error states, manifest dimensions, a resized standard window, static
capture, full-height PNG/PDF, and 512px icon art. The local
`hitslop-design` skill contains the same reusable design pattern for agents.
