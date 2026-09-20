# hitSlop authoring

Read `manifest.json` first. Keep its required author name and optional HTTP(S)
author URL accurate. Use the `hitslop-authoring` skill for package, storage,
capture, install, and publish work. Use `hitslop-design` when creating or
revising the interface. hitSlop installs those skills into `~/.hitslop/skills`
and links them for coding agents. The Mac app refreshes them after app updates;
`slop skills sync` explicitly installs the CLI's current bundle. Missing skills
do not prevent working on this project; follow these notes and the manifest.

Treat the host window as the outer object boundary and size it for realistic
default content. Use Bits UI (`bits-ui`) for interactive controls (dialogs,
selects, sliders, tabs, checkboxes, calendars, tooltips) rather than home-making
components. Style via data attributes and semantic CSS custom properties so your
slop retains its bespoke aesthetic and can be re-themed cleanly.
Use Vanilla Extract for structural `.css.ts` styles and root `theme.ts` with
`defineTheme` from `@hitslop/runtime/theme`. The builder emits immutable default
CSS; owners override tokens in `stores/theme.css`.
Preview both live and static states, then validate, build, install a writable test
copy, and publish only when ready. Browser development is a disposable UI
preview; test persistence in an installed writable copy. Attach the root TypeBox
schema to every Svelte JSON store. Call `ready()` after loading and destroy stores on component teardown. Use
`IconTarget` and `ExportTarget` for optional capture views with the same store data.
Run `bun run check` without a dev server or generated files.
Source, authoring skills, dependencies, editable
styles, secrets, and seed data never enter the runtime `.slop`. Build output
does include the canonical `hitslop-document` skill; optional app-specific
agent guidance belongs only in root `document-guide.md`.

## This app

Add project-specific notes for coding agents here.
