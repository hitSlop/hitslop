# @hitslop/sync

The shared document engine. `Replica` maps `S.Document` application data to Loro;
`DocumentEngine` coordinates changes, revision imports, and persistence.
`FileDocumentIO` implements the current byte journal for Node tools and tests.
Use `@hitslop/sync/browser` in web runtimes; it has no Node filesystem imports.

See [the document contract](../../docs/sync-v1.md). There is no second journal or
unversioned import API. Fresh documents initialize from authored data.
