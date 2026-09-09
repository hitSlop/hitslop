# Pixel Art Studio

A warm industrial-grey handheld console for drawing 16×16 sprites.

Features:
- Pencil, eraser, and bucket fill on a 16×16 grid
- Palettes: Game Boy, PICO-8, Cyberpunk, Monochrome
- Undo and one-click PNG export
- Persistent pixels and palette choice via `jsonStore`
- Control-free static export (`data-slop-export="hide"`)
- Dedicated 512×512 icon render target

```sh
bun slop dev examples/slops/pixel-art
bun slop build examples/slops/pixel-art
```
