# Authoring a slop

The supported v1 path is Bun + Svelte 5. The runtime format is framework-neutral,
and the React SDK/example demonstrate a second integration, but the CLI does not
yet scaffold React projects.

## Create and preview

```sh
bunx @hitslop/cli init tiny-counter
cd tiny-counter
bun install
bun run dev
```

The generated scripts wrap `slop dev`, `build`, `install`, and `publish`.
Use `--template svelte` for a blank base or `--template svelte-counter` for
the teaching example. Edit `manifest.json` before the interface: it fixes the
job, title, categories, and initial viewport.

Development uses `.hitslop/dev/stores/`, never runtime package data. Use
`slop dev --reset` when a schema/default change requires fresh development
state, and `--native` to open the dev URL in the installed host.

## Choose data deliberately

- Start with no persistence for a pure utility.
- Use one JSON object for settings or a compact document model.
- Use SQLite for collections, filtering, ordering, or transactional updates.
- Use named media for a known image/file role.

Storage is implicit; do not add declarations to the manifest. See
[Storage](storage.md) for concurrency and copy semantics.

## Build

```sh
bun run validate
bun run build
```

The build bundles the web app into generated `app.html`, copies allowed
immutable assets, validates the manifest and package boundary, and writes
`dist/<slug>.slop`. Inspect the result: it must be source-free and store-free.

## Preview and icon

`install` and `publish` use the native renderer to capture a full preview and
produce an exact 512×512 icon. A dedicated icon DOM target gives the best
result; see [Design and presentation](presentation.md).

For CI or exceptional artwork, pass `--preview <png>` and/or
`--icon <png>`. These flags replace capture inputs; they do not relax PNG
or package validation.

## Install and test a real document

```sh
bun run install
```

This writes the immutable master to
`~/.hitslop/templates/<slug>.slop`. Create a writable document through **My
Templates** or open the master and choose a destination. Test persistence in the
copy, then confirm reopening, duplicating, preview, PNG/PDF export, and Finder
icon behavior.

## Publish

```sh
slop identity show
slop identity set-name "Your Name"
bun run publish
```

The CLI creates a local Ed25519 identity if needed, builds and captures one
immutable artifact, signs its hash/size envelope, and sends it to the configured
gateway. Export an encrypted identity backup with `slop identity export`.

The default endpoint is the official catalog. Use `--registry` or
`HITSLOP_REGISTRY_URL` for a self-hosted endpoint.

## Definition of done

The app has one obvious purpose; keyboard/focus/reduced-motion behavior works;
persistent defaults and migrations are safe; standard resizing or skin
hit-testing is tested; static capture has no editing controls; generated output
contains only allowed runtime files; and `bun run release:check` passes in this
repository.
