# Maintained examples

These are the maintained, publishable examples. Each directory is an authored
project containing `manifest.json`, `source/`, seed stores, and an optional
document-local `style.css`. Store paths are derived from the manifest key:
`stores/state.json` for `{ "state": { "kind": "json" } }`. The archived
templates are in `archive/templates/`.

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

`slop build` produces `dist/<slug>.slop/app.html`; `slop install` or publish
adds host-rendered `QuickLook/Preview.png` and `Thumbnail.png`. Source and
screenshots remain authoring inputs and never become guest-readable runtime
code.

`svelte-counter` is the intentionally small baseline fixture. It exercises the
Svelte SDK, JSON persistence, resizing, build/install, and native preview flow
without bringing in a component library.
