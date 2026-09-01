# Maintained examples

Each directory is an authored web project with the same minimal manifest used
by third-party slops. Svelte/Vite is the supported v1 authoring path;
`react-counter` is the maintained React SDK integration example. Source CSS is compiled into `app.html`.
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
`svelte-counter` is the intentionally small Svelte SDK baseline;
`react-counter` fills the same role for React without promising a CLI scaffold.

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

## Cover and icon render targets

An app may expose one optional square element with `data-slop-render="cover"`
and one with `data-slop-render="icon"`. The contract, in full:

- **Mount only in the renderer pass.** The host renders document assets in a
  hidden session that sets `html[data-slop-renderer="true"]` before any guest
  code runs. Gate the targets with `capture.isRenderer()` from
  `@hitslop/runtime` so they never exist in the interactive DOM:

  ```svelte
  <script lang="ts">
    import { capture } from "@hitslop/runtime";
  </script>

  {#if capture.isRenderer()}
    <Cover />
    <Icon />
  {/if}
  ```

- **Exactly one element per target**, square (width == height), and fully
  inside the viewport. The hidden renderer grows to at least 512px so a 512px
  canvas does not have to fit the interactive window. Snapshot output is
  always 512×512.
- **Reveal via CSS alone.** The host flips `html[data-slop-capture]` to
  `"cover"` or `"icon"` (and `"static"` for full-document export) and waits
  only for layout to settle — a double `requestAnimationFrame` plus 100ms. No
  async work may be required to make a target visible. Use the double-gated
  form so targets can never flash inside the interactive app:

  ```css
  [data-slop-render] { display: none !important; width: 512px; height: 512px; background: transparent; }
  html[data-slop-renderer="true"][data-slop-capture="cover"] [data-slop-render="cover"],
  html[data-slop-renderer="true"][data-slop-capture="icon"] [data-slop-render="icon"] { display: grid !important; }
  ```

- **Ready before `slop.ready()`.** Anything a target draws from (stores,
  images, canvases) must be settled before the app signals ready; the host
  captures immediately after readiness.
- **Transparent backing.** The host snapshots with a transparent page
  background; keep the target's outer canvas transparent and paint only the
  intended object.

Fallback chain: when a document closes, the macOS host renders a hidden
session and prefers the live icon, then the live cover, for Finder metadata
(it never captures while the interactive document is open). Install and
publish prefer the cover for `QuickLook/Thumbnail.png`, which the catalog uses
for template cards; without a cover, the CLI derives the thumbnail from the
full `Preview.png` (`packages/cli/src/static-preview.ts`, longest edge scaled
to 512px). Recently opened documents keep the live `Preview.png` at the slop's
own aspect ratio.

These are compiled DOM contracts—the runtime never contains or discovers
framework source files such as `Cover.svelte` or `Icon.svelte`.
