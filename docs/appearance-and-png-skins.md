# Document Styling and Future PNG Skins

## First-release styling contract

Every `.slop` package ships `style.css` at its conventional path. The host loads its minimal baseline first, the cartridge's compiled styles second, and `style.css` last. The file hot-reloads without remounting the guest.

There is no reusable theme catalog or global token contract. Each authored template owns its colors, typography, custom properties, and Bits UI state styles. Runtime overrides may target that document's selectors and variables. Remote imports remain blocked by the runtime content-security policy.

Vector window shapes are host-owned because CSS clipping alone cannot provide native click-through hit testing. The manifest declares the immutable window size and shape; the app does not expose an appearance or shape picker.

## Proposed `.slopskin` package

PNG-alpha skins can arrive later as a separate, validated package rather than expanding the first-release window-shape enum.

```text
radio.slopskin/
├── manifest.json
├── background.png
├── background@2x.png        # optional
└── style.css                # optional companion overrides
```

The future manifest should use `slop-skin/1` and declare:

- Stable ID, display name, version, and preview colors.
- Fixed logical canvas width and height; initial PNG skins should not resize.
- Background image paths and pixel scale.
- Content insets defining the safe WebView rectangle.
- One or more top-left-origin drag rectangles.
- Alpha hit-test threshold from 0–255.
- Optional companion style override.

## Validation and rendering

- Require UTF-8 JSON, package-relative paths, PNG input, matching aspect ratios, and bounded dimensions/file sizes.
- Decode alpha once into a compact hit-test buffer and pass clicks through below the declared threshold.
- Use the PNG alpha as both the native window mask and visible backing image; place the transparent WebView inside the declared content insets.
- Reject empty masks, unsafe drag regions, mismatched @2x assets, and content rectangles outside the canvas.
- Keep skin and vector-shape declarations mutually exclusive.
- Quick Look and window-appearance exports should preserve the alpha silhouette. Full-content document export should remain rectangular unless a separate shaped-export mode is explicitly selected.

The archived bitmap-mask implementation is useful research, but none of its file formats or APIs are compatibility requirements.
