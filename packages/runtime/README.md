# @hitslop/runtime

The framework-neutral browser bridge for hitSlop documents.

```ts
import { capture, ready, slop, sql } from "@hitslop/runtime";

const snapshot = await slop.json.open({ count: 0 });
await slop.db.execute(...sql`create table if not exists notes (body text)`);
await slop.window.resize({ width: 560, height: 480 });
ready();
```

Use `@hitslop/runtime/adapter` only when implementing a framework adapter; it
exports the shared JSON persister and safe media helpers.

Documentation: [Architecture](https://github.com/hitslop/hitslop/blob/main/docs/architecture.md) ·
[Storage](https://github.com/hitslop/hitslop/blob/main/docs/storage.md)

MIT © 2026 hitSlop contributors.
