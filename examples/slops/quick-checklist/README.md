# Quick Checklist

A compact JSON-backed task utility for fast capture, completion, reordering, and filing.

## Development

Run from the repository root:

```sh
bun slop dev examples/slops/quick-checklist
bun run --cwd examples/slops check
bun slop build examples/slops/quick-checklist
bun slop validate examples/slops/quick-checklist/dist/quick-checklist.slop
```

Edit `schema.ts` and import it directly. Editor types and checks work without
running dev or generating files first.

## Schema and styles

Root `schema.ts` default-exports
a plain TypeBox schema and its inferred `Checklist` type. Use namespace imports:
`import * as Type from "typebox"`. The app imports that schema directly and calls
`jsonStore({ schema: checklistSchema, initial })`. The store uses TypeBox runtime
validation; the builder emits `data.schema.json` for the host. Schema definitions
must be deterministic: do not depend on time, randomness, or environment state.
Validation does not coerce, add defaults, or strip
unknown fields. Initial values explicitly include every required field.

`theme.ts` is the single source of theme tokens. Structural vanilla-extract
styles consume `theme.vars`; the builder emits immutable `assets/theme.css`.

## Platform checks

After editing workspace packages, rebuild schema/runtime/Svelte before the
slop (`bun run --cwd packages/<name> build`) to avoid using stale package output.
Run the real compiled-Svelte persistence check with:

```sh
HITSLOP_PILOT_PACKAGE="$PWD/examples/slops/quick-checklist/dist/quick-checklist.slop" \
  swift test --package-path apps/apple/Packages/HitSlopApple --filter quickChecklist
```

The test operates on a disposable copy, including missing guidance, immediate
flush/reopen, archive/restore, external edits, and preservation of unknown fields.
Set `HITSLOP_PILOT_OUTPUT` to an existing directory to save live/narrow screenshots.

The same validation fixtures run through TypeBox, package validation, and the
native JSON store. Run `bun test packages/schema/tests/data.test.ts
packages/cli/tests/data-schema.test.ts` and the Swift `sharedDataConformance` test.

## Capture views

`Export.svelte` receives the current checklist and selected tab; it opens no store.
`Icon.svelte` draws three marks representing saved completion progress on close.
Both share the pilot theme. Preview with `?capture=export` or `?capture=icon` in
the gallery. See [capture guidance](../../../docs/capture.md).
