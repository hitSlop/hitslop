# Expense Log

A thermal-receipt roll for rapidly recording purchases, tracking category totals, and viewing running sums.

Features:
- Thermal receipt with perforated tear-off edges and a barcode footer
- Quick entry for item, amount, category stamp, and currency symbol
- Category stamps: FOOD, TRANSIT, COFFEE, GEAR, BILLS, MISC
- Direct-edit titles and running category / grand totals
- Control-free export (`data-slop-export="hide"`)
- Dedicated 512×512 icon render target

```sh
bun slop dev examples/slops/expense-log
bun slop build examples/slops/expense-log
```
