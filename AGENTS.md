# hitSlop

`.slop` packages are framework-neutral `hitslop/1` runtime web apps with
host-owned JSON or SQLite data. Read `manifest.json` first.

- Authored templates live in `examples/slops/`; paused templates live in
  `archive/templates/`. Runtime `.slop` packages never contain source,
  `package.json`, dependencies, `.build`, `node_modules`, or package checkouts.
- Preview with `bun slop dev examples/slops/<id>` and build with
  `bun slop build examples/slops/<id>`.
- Edit runtime packages only through `style.css`, assets, or stores declared in
  `stores`. Replace JSON atomically and keep SQLite transactions on one
  connection.
- Reusable TypeScript code lives in `packages/`. Convex lives in
  `apps/registry`; the TanStack Start/R2 gateway lives in `apps/catalog`.
- Reusable Swift code lives in `apps/macos/packages/`. The Xcode project is only
  the macOS app and Quick Look integration layer.
- Catalog selection downloads the immutable R2 artifact into
  `~/.hitslop/templates/<publisher>/<slug>/releases/<number>.slop`, verifies its
  SHA-256, and copies it to the user-selected path. Convex never creates or
  stores a user's local document.
