# Capture, icons, and exports

## Capture views

Svelte is the supported authoring integration. Keep the interactive editor in
`App.svelte`; optionally provide `Icon.svelte` and `Export.svelte` as ordinary
presentation components. They share data and styles with the editor, not another
store or persistence model:

```svelte
<script lang="ts">
  import { IconTarget, ExportTarget } from "@hitslop/svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
</script>

<IconTarget><Icon completed={finished} total={tasks.length} /></IconTarget>
<ExportTarget><Export checklist={checklist.current} view={activeView} /></ExportTarget>
```

`IconTarget` mounts its children only in icon capture. It supplies a transparent
512×512 surface; supplying it opts into Finder icon refresh when a document
closes. The signed `QuickLook/Icon.png` is immutable; only Finder metadata changes.
Without an icon target, the existing static icon remains.

`ExportTarget` mounts its children for previews and PNG/PDF exports. Pass the
current selected view explicitly. Keep content in normal flow, with no fixed
viewport heights, nested scrolling, editing controls, or transient notices.
Share presentation components and theme variables to avoid visual drift.
`Export.svelte` is optional: without a target, the existing app is captured with
`data-slop-capture="static"` and `data-slop-export="hide"` controls omitted.

A dedicated `ExportTarget` is the catalog/Quick Look preview: native capture
snapshots that object’s rectangle at 2×, not the empty editor window. Without
an export target, preview stays at the manifest viewport. Export uses the
current window width and full content height. Dedicated exports have their own
rectangular content surface rather than a stretched window mask. PNG is 2×, limited to 16,384 pixels
per side and 24 megapixels; use PDF for longer documents. PDF is one page sized
to the content, with selectable text. Very long PDFs combine WebKit's pages and
scale uniformly to a maximum 14,400-point page dimension, preserving all content
and vector sharpness within [Acrobat's page-coordinate limits](https://opensource.adobe.com/dc-acrobat-sdk-docs/library/jsapiref/doc.html). Their physical page width
is scaled too; no content is clipped or converted to a bitmap.

The runtime waits for target mounting, used fonts, visible image decoding, and
stable geometry, with a ten-second timeout for each preparation/settling stage.
Motion is disabled during capture. Canvas, charts, CSS background images, or
virtualized lists can register extra work with
`capture.onPrepare(async (mode, signal) => { ... })`; await required assets or
rendering and respect the abort signal. The returned function unregisters the
hook. Hooks should not modify durable data. Do not call `ready()` until initial
data is usable.

Use `?capture=icon` or `?capture=export` in `slop dev` or the shared gallery to
inspect disposable capture views. Reload to return to normal editing. Native
capture remains the authority for image/PDF fidelity.

Background captures operate on temporary snapshots,
and cannot initialize or modify the source stores. User exports use the current
session to preserve view state; captures are serialized and restore the editor
on success or failure. Preview and icon failures are independent. Close-time
refreshes keep the last successful images on failure; quit gives pending jobs
up to five seconds after data has been saved.
