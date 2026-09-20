# Package format v1

Built packages require `runtime: "hitslop-v1"` in the manifest, together with author, slug, title, description, categories and presentation. The manifest remains TypeBox-defined; generation emits native Codable models and JSON Schema.

```text
Example.slop/
  manifest.json
  app.html
  assets/                       immutable application code, CSS and assets
  state.schema.json             {format:1, root:...} document descriptor
  initial.json                  immutable creation-only values
  .agents/skills/hitslop-document/SKILL.md
  QuickLook/
    Preview.png                 generated template preview; refreshed in documents
    Icon.png                    immutable authored icon, when supplied
  state/                        writable documents only
    document.sqlite             format 1, checkpoint and updates
    writer.lock                 permanent OS lock inode
    host.lock                   live native discovery
```

The host supplies runtime/index.js and Loro resources through `slop://app/__runtime__/`; they are never bundled into the document. Author sources, editable stylesheets, node_modules, caches, state and stores never belong in templates. Embedded guidance is useful but optional when opening.

A build or registered master is immutable. Copy it to a user-selected path before opening. Initial values seed only a new database. Schema changes require new documents. Old packages and databases are rejected, not imported or upgraded.

The existing native host retains frameless slop windows, the hover toolbar, masks, PNG skins, resizability and transparent backgrounds.
