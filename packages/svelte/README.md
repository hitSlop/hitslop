# @hitslop/svelte

Svelte 5 state adapters for JSON, SQLite, images, and named files in a hitSlop
document.

```svelte
<script lang="ts">
  import { jsonStore } from "@hitslop/svelte";
  import counterSchema from "../schema";

  const document = jsonStore({
    schema: counterSchema,
    initial: { count: 0 },
  });
</script>

<button onclick={() => document.current.count += 1}>
  {document.current.count}
</button>
```

Exports: `jsonStore`, `sqliteQuery`, `imageStore`, `fileStore`, and their
class/type counterparts. JSON stores require a Zod 4 schema. The adapter checks
initial, loaded, externally changed, and outgoing values at the persistence
boundary; it does not write browser storage.

See the [Svelte authoring examples](https://github.com/hitslop/hitslop/tree/main/examples/slops).

MIT © 2026 hitSlop contributors.
