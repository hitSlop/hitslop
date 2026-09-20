# Preview, export, and Finder icons

`<Slop {document}>` from `@hitslop/document/svelte` is the Svelte authoring boundary. Keep editor, export, and icon markup in one App.svelte; separate components are optional. The host still owns document loading, persistence, and teardown.

```svelte
<script lang="ts">
  import { Slop, useDocument } from "@hitslop/document/svelte";
  import schema from "./schema";
  const document = useDocument(schema);
</script>

<Slop {document}>
  <!-- Interactive editor -->
  <h1>{document.current.title}</h1>
  {#snippet exportView()}
    <article><h1>{document.current.title}</h1></article>
  {/snippet}
  {#snippet icon()}
    <!-- Square artwork, optionally derived from document.current -->
    <div class={styles.icon}>✓</div>
  {/snippet}
</Slop>
```

The wrapper reports rendering failures, exposes its document facade through `useSlop()`, flushes before capture, and registers lazy capture surfaces. Export/icon snippets mount only for capture, sharing the existing document; they do not create another session. Nested wrappers for multiple documents are unsupported. The host mounts one document per app.

Preview and PNG/PDF export use exportView when supplied and fall back to the editor otherwise. An absent icon snippet leaves the generic native icon. Icon artwork occupies a 512px square with a transparent background. Shared preparation hooks remain available through `capture.onPrepare`; do not mutate durable state in these hooks.

The framework-neutral `capture.registerTarget("export" | "icon", {element, prepare, restore})` API remains available. Target elements must be direct body children. Native code consumes the capture controller's `dedicated` flag and measured geometry, without a separate DOM-marker protocol.

Capture commits local typing drafts and flushes persistence, then waits for fonts, visible images and stable layout. Native capture blocks CLI mutations; the controller blocks UI interaction and restores focus, selection, scroll, styles and input rendering on success or failure. Mark editor controls `data-slop-export="hide"`; fallback capture renders native text inputs as wrapping text. Dedicated exports should use normal flow rather than nested scrolling or fixed viewport heights.

PNG exports render at 2×, limited to 16,384 pixels per side and 24 megapixels. PDF retains selectable text and vectors on a continuous page, scaled to a maximum 14,400-point dimension. Icon PNGs render at 512×512. Failed captures never replace the output file.

`slop build` and `register` use the macOS Swift helper to generate `QuickLook/Preview.png` and, when authored, `QuickLook/Icon.png`. They render disposable copies so templates contain no database, locks or Finder metadata. Development builds prepare runtime resources, compile the native helper, then render templates. An explicit `HITSLOP_NATIVE_CLI` can select a matching prebuilt helper. Browser `slop dev` remains disposable and does not require native capture.

The app derives each new document's Finder custom icon from immutable `QuickLook/Icon.png`. Closing a document refreshes `QuickLook/Preview.png` and, if an icon view exists, Finder custom-icon metadata using a disposable saved-state snapshot. It does not rewrite the immutable icon asset. Catalog and Finder display PNGs without loading Loro; capture loads the host-provided WASM engine, never an engine embedded in the slop.

CLI export uses the same live capture flow when the document is open. For example, Quick Checklist exports the selected Filed tab at the current window width. Closed exports use a disposable saved-state copy and the app's initial view. See [CLI ownership, retries, and export](cli.md).
