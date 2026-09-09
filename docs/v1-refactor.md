# v1 breaking simplification

The v1 contract deliberately removes pre-launch compatibility layers.

## Removed from the manifest

- free-form tags and publisher-profile attribution
- declared store IDs, kinds, paths, seeds, and byte limits
- document identity and template lineage
- runtime/version and authored entry paths
- the separate window/shape object hierarchy

The replacement is one required schema URL, manifest-owned author attribution,
catalog fields, controlled categories, and a small `presentation` object.

## Removed from runtime packages

- source, dependencies, and build directories
- editable `style.css`
- seeded stores
- `document.json`
- executable Quick Look extensions and authored Finder resource forks

Template visuals are immutable. One full capture is written as
`QuickLook/Preview.png`; `QuickLook/Icon.png` is package-time icon artwork
or author-supplied static PNG. A document may refresh only its preview. Data
uses lazy `stores/data.json`.

macOS uses built-in package Quick Look. Finder list rows use a separate custom
icon path, so the host derives Finder-managed `Icon\r` metadata from the static
icon when it creates or opens a local document. The metadata is never
accepted in a template or published artifact.

## Removed from distribution

- separate manifest and screenshot uploads
- local install wrappers, metadata sidecars, and current-release pointers
- download/install/favorite telemetry
- three separate shared Swift packages

Publishing now signs one artifact; the gateway extracts trusted catalog data
from it. The initial implementation used Convex for catalog metadata before the
first-launch Firebase consolidation. Shared Apple code is one package with
focused products.

No migrations are provided because this contract replaces unpublished example
formats. The new scaffold is the compatibility target while older examples are
converted intentionally.
