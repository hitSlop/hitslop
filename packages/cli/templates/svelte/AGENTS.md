# hitSlop authoring

Read `manifest.json` first. Keep its required author name and optional HTTP(S)
author URL accurate. Use the local `hitslop-authoring` skill for package,
storage, capture, install, and publish work. Use `hitslop-design` when creating
or revising the interface. Treat the host window as the outer object boundary
and size it for realistic default content. Use Bits UI (`bits-ui`) for interactive
controls (dialogs, selects, sliders, tabs, checkboxes, calendars, tooltips) rather
than home-making components. Style via data attributes and semantic CSS custom
properties so your slop retains its bespoke aesthetic and can be re-themed cleanly.
Use Vanilla Extract for structural `.css.ts` styles and a global theme contract;
keep the editable token defaults in plain `assets/theme.css`.
Preview both live and static states, then validate, build, install a writable test
copy, and publish only when ready. Browser development is a disposable UI
preview; test persistence in an installed writable copy. Attach the root Zod
schema to every Svelte JSON store. Source, skills, dependencies, editable
styles, secrets, and seed data never enter the runtime `.slop`. Build output
does include the canonical `hitslop-document` skill; optional app-specific
agent guidance belongs only in root `document-guide.md`.
