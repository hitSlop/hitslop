# Package format

Read `manifest.json` first. It is the complete declarative contract for
identity, discovery, and initial native presentation; storage is implicit.

## Authored source

A source project normally contains:

```text
my-app/
├── manifest.json
├── package.json
├── index.html
├── vite.config.ts
├── src/
└── public/assets/              optional immutable files
```

It may also contain an `Icon.svelte` component and local
screenshots. It must not contain real document stores.

## Runtime template

```text
my-app.slop/
├── manifest.json              immutable
├── app.html                   generated and immutable
├── assets/                    optional and immutable
└── QuickLook/
    ├── Preview.png            required for install/publish
    └── Icon.png               immutable Finder/catalog artwork
```

A writable document may lazily add canonical data:

```text
stores/data.json
stores/data.sqlite
stores/data.sqlite-wal         transient while SQLite is open
stores/data.sqlite-shm         transient while SQLite is open
stores/media/<safe-name>
Icon\r                         Finder-managed local metadata on macOS
```

Templates and published artifacts must never contain `stores/`, SQLite
sidecars, `Icon\r`, source, `node_modules`, build directories,
`style.css`, or `document.json`.

## Manifest

A minimal v1 manifest:

```json
{
  "$schema": "https://hitslop.app/schemas/v1/manifest.schema.json",
  "slug": "tiny-counter",
  "title": "Tiny Counter",
  "description": "Counts one small thing.",
  "categories": ["utilities"],
  "presentation": { "width": 560, "height": 420 }
}
```

Choose one or two controlled categories: `productivity`, `utilities`,
`finance`, `media`, `games`, `developer-tools`, `education`,
`business`, `personal`, or `other`.

There is intentionally no author, document ID, release lineage, entry path,
storage declaration, tags, seed data, or runtime version. Publisher ownership
and releases live outside the artifact. Copying a template preserves the
manifest byte-for-byte.

## Immutability rule

In a document, treat `manifest.json`, `app.html`, `assets/`, and
`QuickLook/Icon.png` as immutable. The host may atomically update stores,
refresh `QuickLook/Preview.png`, and manage local filesystem metadata.
