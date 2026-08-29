# Template authoring

This is the editable source of truth for hitSlop's bundled mini apps. Each child directory contains `template.json`, `source/`, seed stores, and an optional document-local `style.css`.

Run `npm ci` in `sdk/` once. Its postinstall step links the shared dependencies here so Svelte, TypeScript, Tailwind, Bits UI, and Lucide resolve correctly in the editor without per-template packages.

```sh
slop dev Templates/invoice
slop package-templates
slop package-templates --check
```

`slop dev` creates an ignored runtime cartridge under `.slop-dev/`, opens it, watches the authored template, and preserves its working store data across rebuilds. `slop package-templates` replaces the generated Swift resources. Never edit generated cartridges directly.
