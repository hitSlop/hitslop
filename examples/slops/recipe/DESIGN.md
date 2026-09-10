# Recipe — modern cookbook

Single job: keep a recipe readable while gathering ingredients and following
its cooking steps. The user chose a modern cookbook direction after rejecting
both the repeated beige palette and the restrained green revision.

## Visual language

Bright white #FFFFFF, ink #182338, cobalt #2448C8, and tomato #C83C29.
Cobalt owns headings, rules, and the book cover; tomato identifies cooking
entry and the icon bookmark. No beige, decorative food illustration, or outer
app card. Keep servings and timing as open fields rather than separate cards.

Self-hosted Fraunces Semibold supplies editorial recipe titles and section
headings. Avenir Next supplies readable instructions and controls. The font
comes from Google Fonts' Fraunces family and ships with its OFL license.
Public token names remain compatible; tomato is an additive token.

The title leads at 680 × 680. An empty meal-photo invitation is compact;
a chosen photo fills that same area. At narrow widths the photo invitation
becomes a short row and ingredients/method stack. Titles and instructions
grow with their content. Static export omits the empty photo invitation.

## Cooking and icon

Cooking remains a full-window Bits UI dialog: deep blue #142452, white step
titles, secondary text #C5CEE5, and contrasting pale-blue controls. Keep the
large countdown, pause/reset, previous/next, completion, and keyboard dismissal.
Viewport queries govern portalled controls. Preserve reduced-motion settling.

The icon is an open cookbook with a cobalt cover, white pages, tomato bookmark,
a simple pot symbol, and substantial recipe lines. Its SVG viewBox is 512²;
the entire mark scales without a white outer tile. Small-size checks target
32px and 64px; do not infer their visual acceptance from the source alone.

## Compatibility and review

Preserve the existing schema, saved recipes, named hero media, sample recipe,
and timer behavior. No registration or publishing is part of this refinement.
Review typical, empty, and long fixtures through `bun run slops:review recipe`.
See `.impeccable/review/status.md` for verification coverage and limitations.
