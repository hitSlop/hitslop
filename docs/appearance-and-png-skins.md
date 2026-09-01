# Presentation and PNG skins

Visuals are authored and compiled into `app.html`; runtime styles and assets
are immutable. The host owns native window geometry and hit testing.

Standard presentation accepts initial `width` and `height`, optional
`resizable` (default `true`), and optional `shape` (default `rounded`):

- `rounded`
- `ellipse`
- `capsule`

For an unskinned document whose workflow changes shape, guest code may request
a new content size with `slop.window.resize({ width, height })`. The manifest
dimensions remain the initial size, and `resizable` continues to control only
whether the user can drag-resize the native window. The host validates and fits
requested sizes to the visible work area. PNG-skinned windows cannot resize
because their backing image and hit-test mask have exact dimensions.

Custom presentation replaces shape and resizing with `skin`, a safe PNG path
under `assets/`:

```json
{
  "presentation": {
    "width": 720,
    "height": 560,
    "skin": "assets/window-mask.png"
  }
}
```

The skin must be an exact-size RGBA PNG. It is used as the visible native
backing and alpha mask behind a transparent WebView. Alpha below 10% is
click-through. Skinned windows are fixed-size, and generated previews retain
their silhouette.

Keeping the image in the slop package makes a second skin manifest, content
insets, drag-region DSL, scale variants, and theme compatibility unnecessary.
