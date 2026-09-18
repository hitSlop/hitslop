# Local testing before release

Use macOS, Xcode, and the exact Bun version in root `package.json` (1.4.2).
Install dependencies with `bun install --frozen-lockfile`, then run:

```sh
bun run test:local
```

The gate checks source hygiene, generated drift, package types/tests, packed npm
installs outside the workspace, the starter, Quick Checklist, Swift, local
Cloudflare rooms, and relocated Debug helper resources. It neither publishes npm
packages nor deploys services or produces distribution builds. Wrangler uses
disposable local D1/R2/room state and a test-only authentication entrypoint.

Evidence is retained under `.hitslop/local-tests/<timestamp>/`: command logs,
`results.json`, and native captures. Clean-room npm fixtures remain in a separate
temporary directory outside the repository; its path is recorded in the logs. Required integration
tests must report a pass; a zero command exit with a required test skipped fails
the gate. Bare `swift test` remains useful for unit work but is not the local gate.
The deliberate crash-writer test runs only as a subprocess of the durability
test; its skip in the ordinary suite is expected. Starter and room tests execute
in their separate configured harnesses, even though the ordinary Swift suite
reports them skipped.

## Inspect the real app

After the automated gate, build/run the macOS Debug target using Xcode. Use
disposable local copies of Quick Checklist. Verify:

- Create, type with an IME, reorder, complete, file, restore, and delete tasks.
- Close immediately after typing; reopen and quit/relaunch without losing edits.
- Keyboard navigation, focus, empty/error states, and narrow/default window sizes.
- External valid/invalid JSON edits, theme changes, duplicate identity, and
  multiple windows. Invalid bytes must remain available for correction.
- PNG/PDF exports and Finder previews/icons agree with the selected checklist
  view; long content is complete and capture leaves the editor usable.

The automated native tests cover persistence, interrupted projection/transaction
recovery, durable command receipts, forced process termination after an
acknowledged commit, malformed inputs, limits, and multiple local owners.
The real-room tests cover offline read-only behavior, lost-result recovery,
Worker restart, invitation limits/rotation, revocation, and native snapshot
adoption followed by reopen. Compiled Quick Checklist tests exercise text,
list operations, undo, file edits, and capture through the real WebKit bridge.
The native gate also builds a small `<Slop>` fixture outside the gallery to check
typed context, host error reporting, close after rejection, and render recovery
that keeps the existing store and text drafts.

## Separate release checks

Production Firebase sign-in, signed-app camera/microphone permission prompts,
notarization, Sparkle delivery, and relocated Release helper verification remain
release-specific checks. Record them as unverified until exercised; local test
authentication and Debug binaries cannot certify those boundaries.
