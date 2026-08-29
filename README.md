# hitSlop

hitSlop is a native macOS host for small local apps. The host owns JSON/SQLite persistence, shaped windows, and the WebKit bridge. Guests use the runtime-only `slop-web/1` cartridge format; authored templates use Svelte 5 in a separate workspace.

Rebuild locally with Vite (`sdk/`, ~200ms). See `sdk/README.md`.

```text
My App.slop/
├── manifest.json
├── build/index.html
├── style.css
├── data.json or data.sqlite
├── assets/
└── QuickLook/
```

`style.css` is the live, document-local override and does not require a rebuild. Duplicating a package installs runtime-safe `AGENTS.md`, `CLAUDE.md`, and local hitSlop skills.

A document does not include source, a toolchain, hashes, `node_modules`, or `.build`.

## Packages

- `Packages/SlopKit` — document, JSON/SQLite, and WebKit runtime foundation.
- `Packages/SlopTemplates` — generated runtime cartridges used by the picker.
- `Packages/HitSlopMac` — macOS windows, template picker, duplication, export, and preview support.
- `Packages/SlopCLI` — `validate`, `dev`, `package-templates`, `duplicate`, `open`, and PNG/PDF export.
- `Templates/` — the editable source of truth for bundled mini apps.
- `sdk/` — the shared Svelte 5 + Vite toolchain, including Bits UI, Tailwind, and Lucide.

Build and test without opening Xcode:

```sh
swift test --package-path Packages/SlopKit
swift test --package-path Packages/SlopTemplates
swift test --package-path Packages/HitSlopMac
swift build --package-path Packages/SlopCLI
```

```sh
scripts/install-cli.sh --prefix /usr/local
slop dev Templates/invoice
slop package-templates
```

Regenerate the thin Xcode project with `xcodegen generate --spec hitSlop/project.yml`.
