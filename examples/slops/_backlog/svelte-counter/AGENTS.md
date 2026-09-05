# hitSlop authoring

Read `manifest.json` first. Run `bunx @hitslop/cli dev` for a disposable UI preview, then `build` and `publish`. The root Zod schema must be attached to `jsonStore`. Test persistence in an installed writable copy. Source stays in this project and is never copied into the runtime `.slop`.
