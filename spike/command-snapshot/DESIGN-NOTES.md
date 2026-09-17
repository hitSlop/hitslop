# Command/snapshot spike design notes

This standalone, in-memory TypeScript spike preserves the incumbent Quick
Checklist identity. It is an ordinary extension, not a new visual system.
No new `DESIGN.md` or global design sidecar is warranted by this adaptation.

## Evidence checked

- Read `examples/slops/PRODUCT.md` and Impeccable's document reference and
  degraded documenter instructions. The default agent substituted for the
  unavailable named documenter role.
- Compared `src/theme.ts` with `examples/slops/quick-checklist/theme.ts`:
  token values match exactly; only the runtime import path differs.
- Compared `src/checklist/styles.css.ts` with the incumbent `src/styles.css.ts`:
  checklist component styling is preserved apart from embedding dimensions
  and moving document defaults into `src/harness.css.ts`.
- Inspected `.impeccable/review/desktop.png` and `mobile.png`: desktop shows
  paired editors; mobile stacks them with controls outside each editor.

## Local adaptations

- Each embedded checklist shell is 620 px tall instead of viewport-height.
  Its paper uses `calc(100% - 50px)` to fit that shell.
- The harness supplies shared defaults, including inherited field font and
  ink color, visible focus outlines, and a neutral off-white page background.
- Two equal columns become one below 850 px; narrow page padding contracts
  below 700 px. Existing checklist container queries retain compact layouts.
- Simulation, connection, retry, and counter controls remain outside the
  recognizable pink checklist frame.
- Selected latency buttons retain dark ink backgrounds and light paper text
  on hover; hover fill now applies only to nonactive buttons.

## System summary

Palette: incumbent pink surface, warm paper, plum ink, yellow actions, mint completion.
Type: Georgia headings at 34 px in the checklist, Avenir-family body at 14 px.
Layout: the paper checklist remains the primary object within each editor.
States: completion combines checkbox state, text treatment, and progress labels.
Scope: neutral harness additions are local to this experiment, not collection rules.

Existing eyebrows and hard offset shadows were preserved, not promoted into
new system rules. Previously reported orphan briefs for archived Focus Timer,
Journal, and Pros/Cons remain unrepaired; PRODUCT.md also retains its historical
Focus Timer pilot evidence. Context repair is outside this spike's scope.
This pass inspected source and supplied captures; it did not run browser,
interaction, accessibility, or production checks.

The independent finish review also used a default agent because the named
reviewer role was unavailable. Its single material finding, selected latency
hover contrast, was fixed and recaptured. Its verdict was **ship**, scoped to
that scored fix; both refreshed captures were valid. The parent separately
ran the five browser integration tests, strict type check, and Vite build.
