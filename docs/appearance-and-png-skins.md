# Appearance and Future PNG Skins

## First-release appearance contract

Every `.slop` package declares `appearance.stylesheet` and ships `theme.css`. The host loads its own semantic baseline first, the pinned ElementaryFlow stylesheet second, `source/styles.css` third, and `theme.css` last. Theme changes therefore do not modify the Wasm source hash and can hot-reload without remounting the ElementaryUI app.

The public styling API is the `--slop-*` token family plus the semantic classes declared by each document: body/heading/mono fonts; background, surface, text, muted text, accent, border, focus, success, warning, and danger colors; spacing; radii; shadows; and motion durations. Themes may also use arbitrary semantic selectors. ElementaryFlow's `_e*` classes and inline `--e-*` variables are private implementation details and must not become theme dependencies. Remote imports remain blocked by the runtime content-security policy.

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
