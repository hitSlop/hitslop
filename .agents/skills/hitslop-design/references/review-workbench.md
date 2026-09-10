# Fast slop review

In the hitSlop repository, start `bun run slops:review <slug>`. The shared gallery
opens an unscaled review board: manifest-size editor, 360px editor, complete
export, and 512px icon. Use this instead of changing browser viewport overrides.
Outside this repo, keep using the project's available preview workflow.

## Repeatable states

An optional root `review.json` holds authoring-only JSON fixtures:

```json
{"cases":[{"id":"empty","label":"Empty","data":{"count":0}}]}
```

Every `data` value must pass the slop's root schema. The preview host supplies it
to the first JSON open; each pane has a separate disposable store. Changing the
selected case resets the panes and discards preview edits. Without fixtures,
the board uses the app's ordinary defaults. Never import review.json into app
code, place it under assets, or copy it into a runtime package.

Prefer empty, typical, long-content, and one purpose-specific state. Use fixtures
for samples rather than adding fake owner content to new documents. Avoid making
many nearly identical fixtures.

## One inspection, then targeted verification

1. Open the board. Wait for all four panes to be ready with no reported errors.
   Inspect expected and measured dimensions; a horizontal overflow flag needs
   investigation. Readiness is render evidence, not a visual or accessibility pass.
2. Exercise the primary interaction and relevant keyboard behavior in the live
   pane. Check the important fixture states in one batch. Scroll inside the fixed
   editor panes to inspect below-the-fold content; the export expands in full.
3. Save board screenshots through the available browser tool. Use full-page
   capture, check image dimensions/legibility, and avoid viewport overrides.
   “Copy review packet” supplies source fingerprint, fixture, pane measurements,
   readiness timing, errors, and design-document links. Save the packet alongside
   screenshots in `.impeccable/review/`; it does not take screenshots itself.
4. Fix the batch of material findings. A source change makes existing evidence
   stale: reload the board before collecting the next packet. Build and validate
   after corrections, rerunning checks only when affected by a later change.
5. Give the independent reviewer the approved direction, board screenshots, and
   packet. A visual correction requires new visual evidence. An accessible-name
   correction requires accessibility-tree evidence in the affected states; a
   behavior fix requires the relevant interaction/test evidence. Do not redo
   unrelated captures for a nonvisual change.

Do not run a new concept-selection round when the user has already approved the
direction. Keep design documents concise and specific to the finished object.
Measure review setup and recovery time before claiming a speedup. Browser
snapshots do not establish native persistence, alpha hit-testing, or release
readiness; those checks remain explicit release-gate work.
