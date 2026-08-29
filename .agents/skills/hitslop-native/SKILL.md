---
name: hitslop-native
description: Work on hitSlop macOS hosting, local document storage, template caching, screenshots, export, or the native CLI.
---

# hitSlop native host

- Reusable code belongs in `apps/macos/packages`; keep the Xcode target thin.
- `HitSlopRegistry` is only catalog search/list/detail and anonymous telemetry.
  It must not create, download, cache, copy, or update local documents.
- `HitSlopHost.DocumentFactory` downloads the current immutable artifact from
  the R2 gateway, verifies SHA-256, caches by publisher/slug/release under
  `~/.hitslop/templates`, and copies it to the chosen destination.
- JSON writes must be atomic. Run every SQLite transaction on one connection.
- Do not silently update existing documents when templates change.
- Use `hitslop-native` only for WebKit-specific screenshot, PDF, and native dev
  operations; authoring commands belong to `@hitslop/cli`.
- Generated Swift manifest models come from `bun run schema:generate`; do not
  edit the generated file directly.
