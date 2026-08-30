# Maintained examples

These are the maintained, publishable examples. Each directory is an authored
project containing `manifest.json`, `source/`, seed stores, and an optional
document-local `style.css`. The archived templates are in `archive/templates/`.

From the repository root:

```sh
bun install
bun slop dev examples/slops/invoice
bun slop build examples/slops/invoice
bun slop dev examples/slops/alien-radio
```

`alien-radio` is the image-mask reference: its authored SVG and deterministic
ImageMagick script produce a fixed 720×560 sculpted window, and the app exercises
remote audio, persisted JSON preferences, native masking, and Quick Look output.

The native Swift resources and registry releases are generated. Never edit a
runtime `.slop` package directly.
