# Appearance and Future PNG Skins

## First-release appearance contract

Every `.slop` package ships `theme.css` at its conventional path. The host loads its semantic baseline first, the document's inlined source styles second, and `theme.css` last. Theme changes therefore do not modify the source hash and can hot-reload without remounting the guest.

The public styling API is the `--slop-*` token family. Tailwind v4 in the SDK maps those onto utilities (`bg-background`, `text-foreground`, `bg-primary`) via `sdk/theme/tokens.css`, so `theme.css` can restyle a cartridge without a rebuild. Themes should set variables only; do not target `button` or `#status`. Remote imports remain blocked by the runtime content-security policy.

Vector window shapes are host-owned because CSS clipping alone cannot provide native click-through hit testing. The first release supports rounded rectangles, capsules, and circles. The manifest is the source of truth for the initial shape; the Appearance panel writes changes back to it.

## Proposed `.slopskin` package

PNG-alpha skins can arrive later as a separate, validated package rather than expanding the first-release window-shape enum.

```text
radio.slopskin/
├── manifest.json
├── background.png
├── background@2x.png        # optional
└── theme.css                # optional companion theme
```

The future manifest should use `slop-skin/1` and declare:

- Stable ID, display name, version, and preview colors.
- Fixed logical canvas width and height; initial PNG skins should not resize.
- Background image paths and pixel scale.
- Content insets defining the safe WebView rectangle.
- One or more top-left-origin drag rectangles.
- Alpha hit-test threshold from 0–255.
- Optional companion theme stylesheet.

## Validation and rendering

- Require UTF-8 JSON, package-relative paths, PNG input, matching aspect ratios, and bounded dimensions/file sizes.
- Decode alpha once into a compact hit-test buffer and pass clicks through below the declared threshold.
- Use the PNG alpha as both the native window mask and visible backing image; place the transparent WebView inside the declared content insets.
- Reject empty masks, unsafe drag regions, mismatched @2x assets, and content rectangles outside the canvas.
- Keep skin and vector-shape selection mutually exclusive.
- Quick Look and window-appearance exports should preserve the alpha silhouette. Full-content document export should remain rectangular unless a separate shaped-export mode is explicitly selected.

The archived bitmap-mask implementation is useful research, but none of its file formats or APIs are compatibility requirements.
