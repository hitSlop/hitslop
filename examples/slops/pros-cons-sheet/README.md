# Decision Balance

A compact weighing instrument: name a choice, add Pros and Cons, adjust their
importance from 1–5, and record your own verdict. New documents start blank.

```sh
bun run slops:review pros-cons-sheet
bun slop dev examples/slops/pros-cons-sheet
bun slop build examples/slops/pros-cons-sheet
bun slop validate examples/slops/pros-cons-sheet/dist/pros-cons-sheet.slop
```

The [review workflow](../../../.agents/skills/hitslop-design/references/review-workbench.md)
shows the 720 × 680 editor, 360px narrow editor, full export, and icon together.
Author-only [review.json](review.json) provides empty, typical (the former
defaults), tied, and long-content cases. Each pane has disposable state;
switching cases resets edits. Fixtures never ship in the runtime package.

Saved fields and status values remain compatible. Totals and controls use
`clampWeight` without rewriting legacy weights until the owner edits them.
See [DESIGN.md](DESIGN.md) for the visual system and
[theme.ts](theme.ts) for its source tokens. Barlow Semibold is bundled with its
[OFL license](assets/fonts/OFL.txt).
