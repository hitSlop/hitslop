# @hitslop/svelte

Svelte 5 state adapters for JSON, SQLite, images, and named files in a hitSlop
document.

```svelte
<script lang="ts">
  import { jsonStore } from "@hitslop/svelte";
  const document = jsonStore({ count: 0 });
</script>

<button onclick={() => document.current.count += 1}>
  {document.current.count}
</button>
```

Exports: `jsonStore`, `sqliteQuery`, `imageStore`, `fileStore`, and their
class/type counterparts. Persistence is performed by `@hitslop/runtime`; the
adapter does not write browser storage.

See the [Svelte authoring examples](https://github.com/hitslop/hitslop/tree/main/examples/slops).

MIT © 2026 hitSlop contributors.
