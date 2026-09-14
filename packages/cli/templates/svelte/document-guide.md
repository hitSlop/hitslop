# Counter data

The `data` object in `stores/data.json` contains an integer `count`. Preserve
`$slop` exactly and reload the file before each editing pass. Preserve any unknown fields.
Change `stores/data.json` directly and replace it atomically after schema
validation. The editor, exported view, and icon all use this count.
