# Hero artwork and fonts

The marketing hero owns this visual direction. Its typography does not apply to
live slop demos or documentation.

## Fonts

Self-hosted Latin WOFF2 files in `public/assets/hero/fonts/`, downloaded from Google
Fonts. Each family includes its SIL Open Font License in the same directory.

- Lilita One, regular: marketing headline.
- DM Sans, variable 400–700: header and hero interface/copy.
- Kalam, regular: handwritten annotations.

## Feature illustrations

Generated with `genmedia` and `fal-ai/recraft/v4.1/text-to-vector` on 2026-09-17.
Three generations at the reported $0.08/image price. No runtime generation.

- `folder.svg`: request `01a0b259-7186-73c1-850d-35c306980385`
- `edit.svg`: request `01a0b259-dec5-7093-ae6e-76a8f375720f`
- `together.svg`: request `01a0b259-e293-7471-9542-8bc69f442e44`

Shared prompt direction: a single small icon for a playful indie Mac app website;
expressive, slightly irregular rounded felt-tip purple outline; one small magenta
accent; almost no interior detail; flat vector; no lettering, shadows, or 3D;
simple friendly geometry readable at 40px.

The subjects are an open folder, a diagonal pencil with two sparkles, and two
people represented by round heads and shoulders. Generated SVGs were cropped,
color-normalized to the hero palette, and stripped of their full-canvas background
and generation metadata. The three production SVGs total approximately 12.5 KB.

Arrows, marker strokes, sparkle decorations, and playback controls are authored
inline SVG/CSS. All headline and annotation lettering is live HTML text.
