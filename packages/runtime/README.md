# @hitslop/runtime

The framework-neutral browser bridge for hitSlop documents.

```ts
import { capture, ready, slop } from "@hitslop/runtime";

const snapshot = await slop.json.open({ count: 0 });
await slop.window.resize({ width: 560, height: 480 });
ready();
```

Use `@hitslop/runtime/adapter` only when implementing a framework adapter; it
exports the shared JSON persister and safe media helpers.

`JsonPersister` batches idle writes for 150 ms, with a one-second maximum wait.
Adapters supply detached snapshots and validate values at their I/O boundaries.
`flush()` bypasses scheduling and drains pending writes; errors retain their
original identity and code. Register adapter flushers with `registerFlush` so
the host can await state that has not reached the bridge yet. Keep that
registration until teardown's final save succeeds.
The persister's `onError` callback receives `Error | null`; derive display text
from the error's `message` rather than replacing the error object.

Documentation: [Architecture](https://github.com/hitslop/hitslop/blob/master/docs/architecture.md) ·
[Storage](https://github.com/hitslop/hitslop/blob/master/docs/storage.md)

MIT © 2026 hitSlop contributors.
