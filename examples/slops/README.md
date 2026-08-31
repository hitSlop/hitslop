# Maintained examples

Each directory is an authored Svelte/Vite project with the same minimal
manifest used by third-party slops. Source CSS is compiled into `app.html`.
Templates contain no seed stores; JSON and SQLite are initialized lazily through
the bridge.

```sh
bun slop dev examples/slops/invoice
bun slop build examples/slops/invoice
bun slop dev examples/slops/alien-radio --native
```

`alien-radio` demonstrates a fixed exact-size RGBA skin. `kanban-board` uses
the canonical SQLite store. The other examples use the canonical JSON store.
`svelte-counter` is the intentionally small SDK baseline.

Build emits `dist/<slug>.slop`; install and publish capture a full
`QuickLook/Preview.png` and derive a static `QuickLook/Thumbnail.png`. Pass
`--thumbnail <png>` to supply custom artwork. A 512x512 PNG with a centered
subject, comfortable safe margins, and no essential small text works best in
Finder; otherwise the CLI preserves the preview's aspect ratio and scales its
longest edge to at most 512 pixels. Source, dependencies, data seeds, and
Finder's host-generated `Icon\r` metadata never enter the runtime template.
