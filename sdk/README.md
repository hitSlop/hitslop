# Slop web SDK

Version-matched guest toolchain for the installed `slop` CLI. It requires Node 20.19 or newer; documents do not carry a compiler or dependencies.

- `@slop/runtime` — framework-neutral `window.slop` adapter
- `@slop/svelte` — `jsonStore`, `sqliteQuery`, `sql` tagged template
- `bits-ui` / `@lucide/svelte` — headless controls and direct-import SVG icons, bundled into the cartridge
- `builder/` — private Vite workspace and single-file cartridge packaging
- `bin/slop.mjs` — template development and release packaging

```sh
cd sdk
npm install

node bin/slop.mjs dev ../Templates/invoice
node bin/slop.mjs package-templates
# from the repo root, after `swift build --package-path Packages/SlopCLI`
slop dev Templates/invoice
```

A runtime `.slop` contains no source, dependencies, or Vite config. Authored templates live in the repository's `Templates/` workspace; packaging produces `build/index.html`, copies seed stores and `style.css`, and omits authoring files.

Import Lucide icons directly so each document compiles only the symbols it uses:

```svelte
<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
</script>
```

Install the CLI and this SDK together with `scripts/install-cli.sh --prefix <directory>`. `SLOP_SDK` remains an override for development and diagnostics.
