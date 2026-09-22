# Author a mini app

A slop does one understandable job. Start with the user's primary action, the information they need at a glance, and what completion looks like. Each template owns its identity; shared infrastructure does not prescribe a collection-wide appearance.

## Start and iterate

In this checkout, use `bun slop dev examples/slops/quick-checklist`, `bun slop build SOURCE`, and `bun slop register SOURCE`. Repository contributors should follow [development](development.md) for runtime/helper preparation and adding templates.

For the distributed tools, install Bun and the matching Mac app, then:

```sh
bunx @hitslop/cli init my-slop
cd my-slop
bun install
bun run dev
```

The launch includes the CLI and SDK packages. Until that publication is available, use the checkout or the packed-package verification workflow; old npm versions are not substitutes for v1. Generated projects pin their dependencies. Prefer their `bun run check/dev/build/register` scripts. Native capture requires the installed Mac app or an explicit `HITSLOP_NATIVE_CLI`; authoring never compiles Swift. Browser preview needs no native renderer.

Read `manifest.json` first. Set `runtime` to `hitslop-v1`, author, slug, title, description, one or two categories, and initial presentation. Define `schema.ts`, creation-only `initial.ts`, token defaults in `theme.ts`, and UI in `App.svelte`. `main.ts` imports `styles.css` and calls `mountDocument(App)` from `@hitslop/document/host`.

Preview state is disposable: refresh resets it and source changes require restarting dev. Build emits `dist/<slug>.slop`. Registration builds a complete immutable master under `~/.hitslop/templates`, backing up a previous master outside the catalog before replacement. Create a writable copy in the Mac app to test persistence. Source, template, and writable document are distinct objects.

## Model state

```ts
import { defineDocument, s } from "@hitslop/document";
export default defineDocument({
  title: s.text(),
  items: s.list(s.object({ text: s.text(), done: s.boolean() })),
});
```

Supply explicit initial values without `$id`. The frozen v1 DSL supports text, finite number/string/boolean/enum registers, optional scalar registers, objects, and movable object lists. The generated descriptor is not JSON Schema. Numbers have no implicit money/integer semantics. Schema changes require new documents.

Components call `useDocument(schema)`. Read immutable `doc.current`; write through handles such as `doc.fields.title.replace(text)` and `doc.fields.items.item(id).done.set(true)`. Insert returns `$id` identity, preserved through moves and reopen. Key UI rows and selection by that identity, never by index.

`doc.transaction(tx => ...)` is synchronous and atomic. It stages a fork and accepts one delta; a rejected operation poisons the whole transaction even if caught. Do not await or write through the original document inside the callback. `await doc.flush()` is the durability barrier.

Use `bindText` for editable text. IME drafts remain local until committed. Text uses whole-value LoroText replacement, not a rich-text/concurrent-caret editor; local composition can supersede incoming text. The host autosaves and flushes before close/export, presenting retry on failed saves. Never edit SQLite or add a JSON reconciliation writer.

## Design and styling

Quick Checklist and Small Expenses are current examples, not a limit or a default visual style. Start new templates from their own purpose. Paper, Instrument, and Skin are optional directions. `_vibe/` is inspiration only; never ship its images. Record product context in PRODUCT.md and each object's actual palette, typography, layout, state language, and motion in its DESIGN.md.

Make the purpose visible in the first viewport. Keep controls familiar, state readable through words and structure, and essential text comfortable. Start with realistic content at manifest dimensions; remove competing elements before shrinking labels. Aim for at least 12px supporting text, 14px control labels, and 44px action targets. Provide keyboard access, visible focus, sufficient contrast, and reduced-motion behavior.

Use plain CSS, with app-prefixed classes and related states/descendants kept together. Style Bits UI primitives through their supported attributes; give portal content explicit classes because it lives outside the trigger's ancestor tree. Define public tokens with `defineTheme` from `@hitslop/document/theme` and use `var(--slop-TOKEN)`. The builder writes immutable theme defaults; owners use `slop theme set/reset`, not arbitrary CSS overrides.

Motion should explain change and settle for capture. Persist target values immediately, stop transient work on unmount, and honor reduced motion. Export hooks must not mutate saved state to prepare a view.

## Window presentation

Standard windows use initial width/height, optional `resizable` (default true), and optional `shape` (`rounded`, `ellipse`, or `capsule`). Width is 240–4096px; height is 180–4096px. Use fluid outer layouts and test initial and narrower dimensions. In native windows, unskinned apps can request `globalThis.slop.window.resize({ width, height })`; the host returns the applied size. The manifest remains the initial size. This host global is not a removed runtime-package import and is unavailable in disposable browser preview.

For transparency, set `background: "transparent"` with a built-in shape. The host supplies viewport sizing/transparency and fills `<Slop>`'s root and its mount ancestors. Framework-neutral apps mark the root `data-hitslop-root`. Standard opaque documents retain authored layout. These low-specificity stage rules are disabled during capture.

| Host value | Meaning |
| --- | --- |
| `data-slop-presentation` | `standard`, `transparent`, or `skin` |
| `data-slop-shape` | Built-in shape, absent for PNG skins |
| `data-slop-resizable` | Present when user resizing is enabled |
| `--slop-width`, `--slop-height` | Initial dimensions, not live viewport measurements |

These presentation values are supplied by the native host. Use actual viewport layout in preview rather than assuming native masks or host globals exist there. Move windows with the native toolbar handle; no guest drag API or drag attribute exists.

Use a PNG skin only when built-in shapes cannot express the outline or hole. `presentation` then contains only width, height, and `skin: "assets/window-mask.png"`. The RGBA image must exactly match those dimensions; the window cannot resize. Alpha 0–25 is click-through and 26–255 receives input. Keep controls/focus rings away from feathered edges and verify clicks actually reach the desktop through holes. Browser transparency alone does not reproduce native hit testing.

## Export and icons

Keep editor, export, and icon markup together unless a separate component helps:

```svelte
<script lang="ts">
  import { Slop, useDocument, bindText } from "@hitslop/document/svelte";
  import schema from "./schema";
  const doc = useDocument(schema);
</script>
<Slop document={doc}>
  <input aria-label="Title" use:bindText={doc.fields.title} />
  {#snippet exportView()}
    <article><h1>{doc.current.title}</h1></article>
  {/snippet}
  {#snippet icon()}<div class="icon">✓</div>{/snippet}
</Slop>
```

`<Slop>` reports rendering failures, provides `useSlop()` context, flushes before capture, and mounts snippets lazily against the same document. Nested wrappers for multiple documents are unsupported. Preview/PNG/PDF use `exportView` when supplied, otherwise the editor. Without an icon snippet, the host uses its generic icon.

Dedicated exports should use normal flow, not fixed viewport heights or nested scrolling. Mark editing-only controls `data-slop-export="hide"`; fallback capture renders native text inputs as wrapping text. Icon art occupies a transparent 512px square with a strong silhouette and safe margins. Dedicated exports do not inherit native masks.

Framework-neutral apps may use `capture.registerTarget("export" | "icon", { element, prepare, restore })`; targets must be direct body children. `capture.onPrepare` supports asynchronous readiness. Dispose registrations and do not mutate durable state. Capture waits for fonts, visible images, and stable layout, blocks edits, and restores editor focus/selection/scroll on success or failure.

PNG is 2×, limited to 16,384 pixels per side and 24 megapixels. PDF preserves searchable text/vectors on one full-length page with a maximum 14,400-point dimension. Build/register render disposable copies and generate Quick Look artwork without leaving mutable state in masters. Close refreshes the preview and Finder icon metadata; immutable `QuickLook/Icon.png` remains unchanged.

Live exports capture the selected view at current width; closed exports use saved state and the app's initial view. See [CLI export](cli.md#export) and [runtime capture details](../reference/runtime.md#capture-and-finder-integration).

## Review a complete object

Review empty, typical, long-content, failed, and busy states; keyboard/IME interaction; reduced motion; initial/narrow widths; theme overrides; and open overlays. Use normal controls for temporary review data rather than changing creation defaults.

Run check/build, register, create a writable copy, type then immediately close, reopen, duplicate, and export PNG/PDF. Inspect editor, export, and icon from the same revision. Native tests are required for persistence, clipping, skins, and desktop click-through. See [presentation fixtures](development.md#focused-checks) and the packaged [design skill](../../packages/cli/skills/hitslop-design/SKILL.md).
