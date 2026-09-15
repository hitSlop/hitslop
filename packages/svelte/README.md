# @hitslop/svelte

```ts
import * as S from "@hitslop/schema/document";
import { documentStore } from "@hitslop/svelte";
const doc = documentStore({ schema: S.Document({ count: S.Integer() }), initial: { count: 0 } });
doc.change(draft => { draft.count += 1; });
await doc.flush();
```

`current` is immutable. Use `isReady` to gate editing and `isLoading` for loading
UI. Persistence and review status belong to the engine and host chrome;
the store does not expose error, dirty, or saving fields.
`flush()` waits for opening and durable persistence, rejecting on failure.
Hosted views share one engine-lifetime flush barrier. `destroy()` detaches the
view while pending persistence remains owned by that engine.

The host supplies the versioned JS/WASM engine through `window.slop.runtime`.
This package contains only its reactive adapter. Tests using custom `io` must
also pass a `runtime` provider from `@hitslop/sync/provider`.

Named attachments use `imageStore` or `fileStore`. Dedicated `ExportTarget` and
`IconTarget` views share the document state and exclude host error chrome.
See [document architecture](../../docs/sync-v1.md).
