# hitSlop

hitSlop is a native macOS host for small ElementaryUI apps compiled to Embedded Swift WebAssembly. Each `.slop` package keeps editable Swift/CSS, compact WASM, assets, and local JSON or SQLite data together.

```text
My App.slop/
├── manifest.json
├── source/ContentView.swift
├── source/styles.css
├── theme.css
├── build/app.wasm
├── data.json or data.sqlite
├── assets/
└── QuickLook/
```

`theme.css` is the live, document-local appearance override and does not require a Wasm rebuild. Every first-release package also carries `AGENTS.md`, `CLAUDE.md`, and local hitSlop skills under `.agents/skills/` and `.claude/skills/`.

The application owns the HTML shell, Elementary browser runtime, WASI/JavaScriptKit glue, WebKit bridge, export renderer, and Quick Look integration. A document does not include a toolchain, dependency checkout, `node_modules`, or `.build` directory.

## Packages

- `Packages/SlopKit` — cross-platform document, JSON/SQLite, and WebKit runtime foundation.
- `Packages/HitSlopMac` — macOS windows, template picker, duplication, export, and preview support.
- `Packages/SlopCLI` — `validate`, `duplicate`, `open`, and full-content PNG/PDF export.

Build and test without opening Xcode:

```sh
swift test --package-path Packages/SlopKit
swift test --package-path Packages/HitSlopMac
swift build --package-path Packages/SlopCLI
```

Regenerate the thin Xcode project with `xcodegen generate --spec hitSlop/project.yml`.

The compiler service is intentionally not part of this repository yet. Source changes run the last-known-good WASM and show a **Needs rebuild** badge until a compiler is connected.
