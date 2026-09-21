# Preserved runtime fixtures

`1-1/document` is a compiled contract-1/revision-1 app with a SQLite checkpoint
and an uncheckpointed update. It covers all v1 value kinds, Unicode text, list
identity/movement, transactions, bindings, themes and export. `expected.json`
records its saved state. Swift tests always edit disposable copies.

These are release baselines, not generated examples. Do not rebuild or replace
them when the SDK changes. Add new fixtures for new capabilities and contracts.
`fixture.json` seals each document tree; the check command rejects byte changes.

Runtime release hashes live in `runtimes/releases.json`. For revisions older than
the installed runtime, restore the preserved release directories under
`generated/v1/runtime-releases/<contract>-<revision>/<contract>/` before checks.
Checks verify their hashes; native tests use them to read candidate-written state.
