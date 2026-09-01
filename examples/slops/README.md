# Maintained examples

Each directory is an authored Svelte/Vite project with the same minimal
manifest used by third-party slops. Source CSS is compiled into `app.html`.
Templates contain no seed stores; JSON, SQLite, and named media are initialized lazily through
the bridge.

Static capture sets `data-slop-capture="static"` on the root. Examples can mark
editing-only UI with `data-slop-export="hide"`; previews stay at manifest size,
while PNG and PDF exports capture the full document height. PNG exports use 2x
resolution, while PDF exports preserve selectable text and WebKit vector output
on one page.

```sh
bun slop dev examples/slops/invoice
bun slop build examples/slops/invoice
bun slop dev examples/slops/alien-radio --native
bun slop dev examples/slops/soma-amp --native
```

`alien-radio` demonstrates a fixed exact-size RGBA skin. `kanban-board` uses
the canonical SQLite store. Recipe combines JSON with a named image store; the
SomaAmp combines JSON with a persistent ZIP skin in named media; the other examples use the canonical JSON store.
`svelte-counter` is the intentionally small SDK baseline.

The host window is the default outer boundary for a slop. Maintained examples
avoid wrapping the whole experience in another decorative card or backing
shadow; hierarchy comes from readable type, compact rhythm, rules, and
purposeful internal surfaces.

Build emits `dist/<slug>.slop`; install and publish capture a full
`QuickLook/Preview.png` and derive a static `QuickLook/Thumbnail.png`. Pass
`--thumbnail <png>` to supply custom artwork. A 512x512 PNG with a centered
subject, comfortable safe margins, and no essential small text works best in
Finder; otherwise the CLI preserves the preview's aspect ratio and scales its
longest edge to at most 512 pixels. Source, dependencies, data seeds, and
Finder's host-generated `Icon\r` metadata never enter the runtime template.

An app may expose one optional square element with
`data-slop-render="cover"` and one with `data-slop-render="icon"`. Keep both
out of the interactive DOM unless `html[data-slop-renderer="true"]` is present,
then keep both hidden and reveal the matching element under
`html[data-slop-capture="cover"]` or `html[data-slop-capture="icon"]`.
The host captures these targets with a transparent page backing, so keep the
target's outer canvas transparent and paint only the intended object.
The hidden renderer grows to at least 512px so a 512 canvas does not have to
fit the interactive window. Snapshot output is always 512×512.
Install and publish prefer the cover for `QuickLook/Thumbnail.png`, which the
catalog uses for template cards. Recently opened documents keep the live
`Preview.png` at the slop's own aspect ratio. When a document closes, the
macOS host renders in a separate hidden session and prefers the live icon,
then the live cover, for Finder metadata. It does not capture while the
interactive document is open.
These are compiled DOM contracts—the runtime never contains or discovers
framework source files such as `Cover.svelte` or `Icon.svelte`.
