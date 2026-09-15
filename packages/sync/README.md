# @hitslop/sync

The shared document engine. `Replica` maps `S.Document` application data to Loro;
`DocumentEngine` coordinates changes, revision imports, and persistence.
`FileDocumentIO` implements the current byte journal for Node tools and tests.
The host ships the generated JS/WASM runtime once. Document bundles must not
import this engine. Framework adapters use `window.slop.runtime`; Node tools and
custom-I/O tests can explicitly use `documentRuntime` from `@hitslop/sync/provider`.

The implementation release is independent of the SDK minimum and app version.
Run `bun run schema:generate` to refresh the identical native and CLI resources.

See [the document contract](../../docs/sync-v1.md). There is no second journal or
unversioned import API. Fresh documents initialize from authored data.
