# Slop web SDK

Version-matched guest toolchain for the installed `slop` CLI. It requires Node 20.19 or newer; documents do not carry a compiler or dependencies.

- `@slop/runtime` — framework-neutral `window.slop` adapter
- `@slop/svelte` — `jsonStore`, `sqliteQuery`, `sql` tagged template
- `@slop/theme` — Tailwind v4 `@theme` mapping onto `--slop-*` tokens
- `bits-ui` / `@lucide/svelte` — headless controls and direct-import SVG icons, bundled into the cartridge
- `builder/` — private Vite workspace, single-file cartridge, and manifest hashes
- `bin/slop.mjs` — `build`

```sh
cd sdk
npm install

node bin/slop.mjs build ../path/to/Notes.slop
# from the repo root, after `swift build --package-path Packages/SlopCLI`
slop build Notes.slop
```

A web slop does not contain `node_modules` or a Vite config. Guest source starts at `source/main.ts` or `source/main.js`; the cartridge is always `build/index.html`.

Import Lucide icons directly so each document compiles only the symbols it uses:

```svelte
<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
</script>
```

Install the CLI and this SDK together with `scripts/install-cli.sh --prefix <directory>`. `SLOP_SDK` remains an override for development and diagnostics.
