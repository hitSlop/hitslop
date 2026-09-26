# Authoring workflow

Read manifest.json, AGENTS.md, and BRIEF.md, then edit schema.ts, initial.ts, theme.ts, and the UI source.
Run the generated project's `bun run check` and `bun run dev`; refresh resets
preview state and source edits require restarting preview. In the repository,
use `bun slop COMMAND SOURCE`.

Run `bun run build` with a compatible installed Mac app, then `bun run register`.
Create a writable copy in the native catalog. Test close-after-type, reopen,
keyboard/IME, themes, duplication, and PNG/PDF. Inspect preview and icon artwork.
Never edit a runtime master or publish private document state as a template.
Hosted template publication is deferred; npm distributes the authoring tools.
