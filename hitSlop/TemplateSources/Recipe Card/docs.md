# Recipe Card

The singleton `recipe` row contains overview fields. `ingredients` and `steps` are ordered child tables.

- Preserve `position` when inserting or reordering rows.
- Ingredient readiness is an integer boolean.
- Durations are integer minutes and servings is a positive integer.
- The optional `photo_asset_path` refers to a row in `slop_assets`.

Use targeted SQL updates. The HTML view is derived from these tables.
