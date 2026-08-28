# hitSlop

hitSlop is a native macOS host for small local apps. The host owns JSON/SQLite persistence, themed windows, and the WebKit bridge. Guests use the framework-neutral `slop-web/1` cartridge format; the bundled authoring SDK is Svelte 5.

Rebuild locally with Vite (`sdk/`, ~200ms). See `sdk/README.md`.

```text
My App.slop/
├── manifest.json
├── source/App.svelte
├── source/main.ts
├── source/styles.css
├── theme.css
├── build/index.html
├── data.json or data.sqlite
├── assets/
└── QuickLook/
```

`theme.css` is the live, document-local appearance override and does not require a rebuild. Duplicating a package installs `AGENTS.md`, `CLAUDE.md`, and local hitSlop skills from one canonical guide.

A document does not include a toolchain, `node_modules`, or `.build` directory.

## Packages

- `Packages/SlopKit` — document, JSON/SQLite, and WebKit runtime foundation.
- `Packages/SlopTemplates` — bundled `.slop` templates and `.sloptheme` palettes.
- `Packages/HitSlopMac` — macOS windows, template picker, duplication, export, and preview support.
- `Packages/SlopCLI` — `validate`, `build`, `duplicate`, `open`, and full-content PNG/PDF export.
- `sdk/` — Svelte 5 + Vite guest toolchain (`source/` → `build/index.html`), including Bits UI and Tailwind.

Build and test without opening Xcode:

```sh
swift test --package-path Packages/SlopKit
swift test --package-path Packages/SlopTemplates
swift test --package-path Packages/HitSlopMac
swift build --package-path Packages/SlopCLI
```

```sh
scripts/install-cli.sh --prefix /usr/local
slop build path/to/Notes.slop
```

Regenerate the thin Xcode project with `xcodegen generate --spec hitSlop/project.yml`.
