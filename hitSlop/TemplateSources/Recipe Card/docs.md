# Recipe Card

The singleton `recipe` row contains overview fields. `ingredients` and `steps` are ordered child tables.

- Preserve `position` when inserting or reordering rows.
- Ingredient readiness is an integer boolean.
- Durations are integer minutes and servings is a positive integer.
- The optional `photo_asset_path` refers to a row in `slop_assets`.

Use targeted SQL updates. The HTML view is a `sql-html-v1` template: `<slop-row as="…">` requires exactly one result row, while `<slop-each as="…">` repeats its template for zero or more rows. Placeholders are qualified as `{{alias.column}}`. Named `data-slop-action` forms perform writes. Do not add document JavaScript.
