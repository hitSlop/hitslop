# @hitslop/runtime

Framework-neutral host APIs: media, window controls, readiness, capture, flush,
and host errors. The host supplies the document engine through
`window.slop.runtime`, including its selected version. Svelte applications use
`documentStore` from `@hitslop/svelte`; their bundles contain no sync engine.

```ts
import { errors } from "@hitslop/runtime";
errors.report({ id: "download", message: "Download failed", action: { label: "Retry", run: retryDownload } });
errors.clear("download");
```

Reports update by ID. Actions run once at a time and cannot clear newer reports.
Document and media adapters report storage failures automatically. A current host
bridge is required. See [document architecture](../../docs/sync-v1.md).
