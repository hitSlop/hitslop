# Package format

Read `manifest.json` first. It is the complete declarative contract for
identity, discovery, runtime compatibility, and initial native presentation;
storage is implicit.

## Authored source

A source project normally contains:

```text
my-app/
├── manifest.json
├── package.json
├── AGENTS.md                    portable coding-agent notes; platform skills live in ~/.hitslop/skills
├── schema.ts                    required when using Svelte documentStore
├── theme.ts                     optional single-source theme definition
├── document-guide.md            optional app-specific agent guidance
├── index.html
├── vite.config.ts
├── src/
└── assets/                      optional immutable runtime files
```

It may also contain an `Icon.svelte` component and local
screenshots. It must not contain real document stores.
Its manifest uses `schemas/v1/authoring-manifest.schema.json`. The builder
generates the runtime requirement from the included SDK packages.

## Runtime template

```text
my-app.slop/
├── manifest.json              immutable
├── app.html                   generated and immutable
├── data.schema.json           optional generated data contract
├── assets/                    optional and immutable
│   └── theme.css              optional public --slop-* defaults
├── .agents/skills/hitslop-document/
│   ├── SKILL.md               canonical, immutable document instructions
│   └── references/
│       └── app-guide.md       optional publisher guide, maximum 32 KiB
└── QuickLook/
    ├── Preview.png            mutable host snapshot; required to publish
    └── Icon.png               immutable Finder/catalog artwork
```

Generated JavaScript, workers, fonts, and WASM also live under immutable
`assets/`. Structural styles remain in `app.html`. Every new CLI build embeds
document guidance, but its text or absence is never a prerequisite for opening
a document. Publishing validation accepts optional UTF-8 guidance as well.
The platform document engine's JS/WASM is supplied by the installed host and
must not be bundled under `assets/`.

Asset preservation is not a guarantee of browser API support: the current
Apple host permits blob workers, not direct custom-scheme worker URLs. Use
Vite's inline worker mode for now; external worker execution needs a separate
native compatibility test before being advertised as supported.

A writable document may lazily add canonical data:

```text
stores/data.json
stores/media/<safe-name>
stores/theme.css               optional owner theme overrides
state/identity.json            optional host-owned sync identity
state/checkpoint.loro          optional canonical Loro snapshot
state/journal/                 optional committed update bytes
Icon\r                         Finder-managed local metadata on macOS
```

Templates and published artifacts must never contain `stores/`, `state/`, `Icon\r`,
source, `node_modules`, build directories,
`style.css`, or `document.json`.

## Manifest

A minimal built manifest:

```json
{
  "$schema": "https://api.hitslop.com/schemas/v1/manifest.schema.json",
  "runtime": "1.0.0",
  "author": {
    "name": "Jordan Singer",
    "url": "https://example.com"
  },
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

`author.name` is required and travels with the artifact. `author.url` is an
optional public HTTP(S) URL. Author attribution is intentionally separate from
the publisher signing key: the manifest says who made the work, while the key
proves who controls its catalog releases.

`runtime` is the minimum compatible host runtime, independent of the app or npm
package version. `1.2.0` accepts newer `1.x` releases, but not `2.x`. Unsupported
requirements stop opening before guest execution or storage initialization and
offer a hitSlop update. Source manifests omit this generated field. See
[runtime requirements](sync-v1.md#runtime-requirements).

There is intentionally no document ID, release lineage, entry path, storage
declaration, tags, or seed data. Publisher ownership and
releases live outside the artifact. Copying a template preserves the manifest
byte-for-byte.

## Immutability rule

In a document, treat `manifest.json`, `app.html`, `data.schema.json`, `assets/`,
`.agents/`, and `QuickLook/Icon.png` as immutable. The host may atomically
update stores, refresh `QuickLook/Preview.png`, and manage local filesystem
metadata.

## Versioned document pilot

Quick Checklist's `stores/data.json` contains `$slop` revision metadata plus
application `data`; `data.schema.json` validates that complete envelope.
Host-owned `state/materialization.json` stores projection metadata and durable
import receipts alongside the checkpoint and identity. `state/journal/` may
contain pending transactions and preserved originals from explicit review.
None of `state/` belongs in templates or published artifacts. This format has no
legacy fallback or migration. See [Sync v1](sync-v1.md).
