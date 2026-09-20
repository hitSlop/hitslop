---
name: hitslop-document
description: Inspect and edit a hitSlop v1 document with the local CLI.
---
Read manifest.json first. Only hitslop-v1 is supported.
Use slop schema PATH and slop get PATH, then slop apply PATH --op JSON or slop batch PATH --ops JSON.
Paths identify list rows with {"id":"$id from get"}. Never use array indexes as identity.
Keep manifest.json, app.html, assets/, state.schema.json and initial.json immutable.
Never edit state/document.sqlite or invent stores/data.json. The CLI routes to the live host or acquires exclusive ownership when closed.
A failed transport can have an unknown outcome. Retry only the printed request ID and epoch; after expiry inspect state before forming fresh intent.

For mutation retries supply both --id and --epoch with the same operation. Use get to inspect state. Native export captures the live selected view when open and the initial view when closed; export output must be outside the source package.
