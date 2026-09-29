# Preserved runtime fixtures

These are release baselines, not generated examples. Never rebuild or replace them
when the SDK changes; add new fixtures for new capabilities and contracts.
`fixture.json` seals each `document/` tree; checks reject byte changes, and the history
guard rejects any change to any file of a recorded fixture against the base commit.

Contract 3 / revision 1 / storage revision 1 (the launch baseline), authored once by
`bun scripts/v1/author-fixtures.ts` over the shared schema in `tests/abi/fixture-schema.ts`:

| Fixture | Covers |
|---|---|
| `3-1` | Every value kind, a checkpoint plus uncheckpointed updates, a scripted `scenario.json` with independently modeled results, and `collaboration.json`: a concurrent offline round (deterministic merges only) and synced edits for current-runtime peers, with an independently modeled `expected` result. Its app is the hand-written plain-JS ABI consumer (`tests/abi/plain/app.js`). |
| `3-1-saved-state` | Theme overrides, a content-addressed attachment referenced from a field, several separately saved updates. |
| `3-1-issues` | Merged anomalies (non-finite counter, wrong container kind, unknown enum, unknown field, missing and duplicate row IDs, which read derived `x-` IDs) with exact `issues.json`; nothing is repaired. |
| `3-1-svelte` | The Svelte adapter as compiled into apps (`tests/abi/svelte`). |

Both consumer apps check the `ctx` ABI while mounting; a failed check fails the native
open or export. `template-<slug>-<hash>` specimens are added by
`bun run fixtures:seal --write` when a release seals its runtime.

Revision 2 adds `3-2-container-values`: plain JSON objects with non-callable `kind`
properties in text, optional-object and row positions. Exact fallbacks/issues and
an unrelated edit survive append, checkpoint and reopen. Author only this fixture
with `bun scripts/v1/author-fixtures.ts --only 3-2-container-values`; existing
fixtures are never replaced. Its package requires revision 2; revision-1 specimens
continue to exercise older readers of candidate-written state at storage revision 1.

Swift tests always edit disposable copies. Host-behavior probes swap in the unsealed
`tests/abi/probe/app.js`.

Contract 4 / revision 1 / storage reader revision 2 adds `4-1` (plain-JS ABI 2) and `4-1-svelte` (compiled Svelte ABI 2). Their independent scenarios exercise accepted handles and replay. Swift additionally invokes the consumers' async checks on disposable copies. The current runtime explicitly refuses contract 3 without touching stored bytes; historical readers and fixture seals remain intact. The old author-fixtures script is retired and refuses to create contract-4 fixtures with contract-3 semantics.
