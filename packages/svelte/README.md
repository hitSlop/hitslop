# @hitslop/svelte

Packaging uses this workspace's TypeScript 6 compiler API; checks use TypeScript
7 through `@typescript/native`, as does the root toolchain. The Bun patch for
`@sveltejs/package` resolves TypeScript from the project being packaged instead
of the packager's install directory. Keep the packager version pinned while the
patch is needed, and recheck this resolution when upgrading it.

Svelte 5 state adapters for JSON, SQLite, images, and named files in a hitSlop
document.

```svelte
<script lang="ts">
  import { jsonStore } from "@hitslop/svelte";
  import { ready } from "@hitslop/runtime";
  import { onDestroy } from "svelte";
  import counterSchema from "../schema";

  const document = jsonStore({
    schema: counterSchema,
    initial: { count: 0 },
  });
  $effect(() => { if (document.isReady) ready(); });
  onDestroy(() => document.destroy());
</script>

<button disabled={!document.isReady || document.isLoading} onclick={() => document.current.count += 1}>
  {document.current.count}
</button>
```

Exports: `jsonStore`, `sqliteQuery`, `imageStore`, `fileStore`, and their
class/type counterparts. JSON stores accept the default export of root TypeBox
`schema.ts` directly, with data types inferred from that schema. No preparation
or generated files are needed for editor types or typechecking. The adapter
validates initial, loaded, externally changed, and outgoing values using the
TypeBox interpreter; it does not coerce, insert defaults, strip unknown fields,
or write browser storage.

Once loaded, JSON edits save after 150 ms without another change, or after one
second of continuous editing. Only one write runs at a time; edits during a write
coalesce into the newest follow-up snapshot. `await document.flush()` captures
current state immediately, bypasses the delay, and waits for pending writes.
Concurrent flushes share the same drain. Schema validation runs at I/O boundaries,
so invalid edits remain in memory and are never written.

`isDirty` stays true while changes are waiting, saving, or failed; `isSaving` is
true during a write. `error` contains the display message and `errorCode` contains
the `SlopError` code when available, including `validation_failed`,
`revision_conflict`, and `storage_error`. A failed save retains the latest edits.
Call `flush()` to retry, or make a new edit to resume automatic saving. Repeated
observations of an identical value do not retry a failed save.

External file changes load while the store is clean. While dirty, local edits
win: a revision conflict reads the new revision and retries the latest full
local snapshot once. This does not merge another writer's fields. Another
conflict stops saving and surfaces an error. After loading, explicit `reload()`
discards edits made before the call and adopts the file; edits made during the
read survive. Retrying a failed initial load also preserves local edits.

Call `destroy()` on teardown to stop observation and immediately drain a detached
final snapshot. It is synchronous and safe to call twice. Pending or failed saves
stay registered with the runtime flush barrier until a flush succeeds. For a
user-initiated teardown where errors should prevent navigation, await `flush()`
before removing the component. A destroyed store cannot reload or resume editing.

See the [Svelte authoring examples](https://github.com/hitslop/hitslop/tree/master/examples/slops).

MIT © 2026 hitSlop contributors.

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

Preview stays at the manifest viewport. Export uses the current window width
and full content height. Dedicated exports have their own rectangular content
surface rather than a stretched window mask. PNG is 2×, limited to 16,384 pixels
per side and 24 megapixels; use PDF for longer documents. PDF is one page sized
to the content, with selectable text. Very long PDFs combine WebKit's pages and
scale uniformly to a maximum 14,400-point page dimension, preserving all content
and vector sharpness within common PDF reader limits. Their physical page width
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

Background captures operate on temporary snapshots, including a SQLite backup,
and cannot initialize or modify the source stores. User exports use the current
session to preserve view state; captures are serialized and restore the editor
on success or failure. Preview and icon failures are independent. Close-time
refreshes keep the last successful images on failure; quit gives pending jobs
up to five seconds after data has been saved.
