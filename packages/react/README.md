# @hitslop/react

React hooks for JSON, SQLite, images, and named files in a hitSlop document.

```tsx
import { useJsonStore } from "@hitslop/react";

export function Counter() {
  const document = useJsonStore({ count: 0 });
  return <button onClick={() => document.set({ count: document.value.count + 1 })}>
    {document.value.count}
  </button>;
}
```

Exports: `useJsonStore`, `useSqliteQuery`, `useImageStore`, and
`useFileStore`. See
[`examples/slops/react-counter`](https://github.com/hitslop/hitslop/tree/main/examples/slops/react-counter)
for the maintained integration. The v1 CLI does not scaffold React yet.

MIT © 2026 hitSlop contributors.
