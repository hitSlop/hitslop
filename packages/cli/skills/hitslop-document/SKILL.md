---
name: hitslop-document
description: Inspect and edit a hitSlop v1 document with the local CLI.
---
Read manifest.json first. Only hitslop-v1 is supported.
Use slop schema PATH and slop get PATH, then slop apply PATH --op JSON or slop batch PATH --ops JSON.
Paths identify list rows with {"id":"$id from get"}. Never use array indexes as identity.
Keep manifest.json, app.html, assets/, state.schema.json and initial.json immutable.
Never edit state/document.sqlite or invent stores/data.json. The CLI routes to the live host or acquires exclusive ownership when closed.
A failed transport can have an unknown outcome. Run slop get before issuing another edit; never automatically replay a mutation.

get flushes pending edits and returns persisted state; a save failure returns an error. Native export captures the live selected view when open and the initial view when closed; export output must be outside the source package.

Use `slop theme get PATH` to inspect public token defaults and overrides.
Change declared tokens with `slop theme set PATH --values '{"accent":"#123456"}'`;
reset one with `slop theme reset PATH --token accent`, or omit the token to reset
all. These commands preserve the writer lock and update the open view. Never
edit assets/theme.css or add stores/theme.css. After an uncertain result inspect
`theme get` before another change. PNG/PDF exports include the effective theme.
