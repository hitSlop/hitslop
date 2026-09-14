# Invoice data

`number` is the invoice identifier. `status` is `draft`, `sent`, or `paid`.
`issued` and `due` are dates in YYYY-MM-DD form. The interface offers USD, CAD,
EUR, GBP, AUD, and JPY currencies.

`from` and `billTo` each contain `name` and multiline `detail` strings. Each line
item has a stable `id`, `description`, numeric `quantity`, and numeric `rate`.
Use fresh IDs for new items and preserve existing IDs. Quantities, rates, and
`taxPercent` may be null while incomplete; the renderer treats null as zero.

`taxPercent` is a percentage (5 means 5%, not 0.05). Subtotal, tax, and total are
computed from the items; do not add stored totals. `notes` holds payment details
or other invoice notes. Ask for missing business facts rather than reusing the
demo parties, amounts, tax rate, or payment terms as if supplied by the user.

Read `data.schema.json`, preserve unknown fields, and replace `stores/data.json`
atomically. Validate before showing the invoice. Export uses the saved data and
the dedicated invoice layout.
