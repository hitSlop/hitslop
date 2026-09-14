# Subscription Tracker — recurring payments

Single job: understand recurring spend and see which services renew next.
An instrument for personal tracking, with a playful loop motif tied to recurring
charges. Ink-purple #292040, violet #6740C8, mint #B6F3D8, and cool white replace
the previous yellow ledger. Space Grotesk supplies headings and monetary
readouts; Avenir Next keeps service details familiar and readable.

Monthly total leads the dark header; yearly estimate is subordinate. Both
include active services only, with annual charges divided by twelve for the
monthly total. Currency selection relabels amounts, not conversion. Category
marks distinguish services without third-party logos. Use fine row separators,
comfortable pause/resume controls, and a single Add service action.

At 640 × 720 show the primary totals and five sample services. At 360px keep
renewal dates below the service name; never hide them for compactness. Long
names and notes wrap. Paused services remain readable in All and are excluded
from totals. A passed date says Date passed, not an unsupported claim that the
provider has collected payment. Pausing changes local tracking only.

The icon uses two payment cards surrounded by mint recurring arrows on an
ink-purple tile. Export shares the visual language and preserves the selected
Active/All filter. Existing data, schema, categories, currency, and add/edit/
remove behavior remain compatible. Bits UI supplies tabs, selects, and dialog.

Use `bun run slops:review subscription-tracker` with mixed, empty, and paused
fixtures. Default sample values are illustrative and are not current provider
pricing. Review browser behavior, narrow dates, export, and the icon together.
