# Slop Migration Runner

Read this file for every slop migration tracked by `SLOPMIGRATION.md`.
Routine migration ends after the authored project builds and its runtime package
validates. Do not register, install, publish, or run native release checks unless
the user explicitly asks.

## 1. Establish the job and visual direction

1. Read `examples/slops/<slug>/manifest.json` first.
2. Read the slop's entry in `SLOPMIGRATION.md` and inspect the archived version
   when one exists.
3. State its single job and choose a deliberate Paper, Instrument, or Skin
   identity.
4. Identify one dominant action, readout, or working surface and one memorable
   detail tied to the job.
5. Preserve useful behavior, but improve generic or unclear UI. Remove dashboard
   shells, interchangeable cards, duplicate controls, and flat hierarchy. Use
   realistic defaults and clear empty, partial, complete, and error states.

## 2. Use the current authoring structure

1. Move implementation files from `source/` to `src/`, update
   `index.html` and imports, then delete the old `source/` directory.
2. Keep reusable state schemas in root `schema.ts`. JSON-backed Svelte slops
   must default-export a Zod 4 schema and pass the same schema to
   `jsonStore({ schema, initial })`.
3. Put structural styles in Vanilla Extract `.css.ts` files. Define semantic
   public `--slop-*` variables with `createGlobalThemeContract` and their
   defaults in `assets/theme.css`.
4. Keep the current manifest schema URL and required author attribution.
5. Never copy `_vibe/` material into authored source or runtime output.

## 3. Audit controls with Bits UI

1. Inventory the interactive controls before changing them.
2. Search [the local Bits UI reference](_docs/bits/llms.txt) for applicable
   primitives.
3. Use Bits UI for dialogs, selects, sliders, tabs, calendars, popovers, toggles,
   checkboxes, progress controls, tooltips, and similar behavior when it improves
   keyboard, focus, or screen-reader support.
4. Style Bits UI through its documented attributes so it supports the slop's
   unique visual identity. Bits UI supplies behavior, not a shared theme.
5. Keep native direct text, number, and time inputs, canvas interactions, and
   other purpose-built controls when Bits UI adds no useful behavior.

## 4. Preview, build, and stop

1. Start the shared gallery once with `bun run slops:dev <slug>`, then reuse
   `http://localhost:4177/<slug>/` for later migrations.
2. At the manifest's default size, confirm the visual identity and hierarchy,
   exercise the primary interaction and any new Bits primitive, and check the
   browser console. Fix obvious clipping or broken behavior.
3. Build with `bun slop build examples/slops/<slug>`.
4. Validate with
   `bun slop validate examples/slops/<slug>/dist/<slug>.slop`.
5. Confirm the runtime package contains no source, dependencies, build caches,
   seed stores, or editable stylesheets, and confirm `source/` is absent.
6. Check off the slop in `SLOPMIGRATION.md`.

Do not perform writable-copy persistence, native-window, export, Quick Look,
capture, registration, installation, or publishing work during routine migration.
Those checks belong to an explicitly requested batch release gate.
