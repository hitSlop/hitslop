# Five Minute Journal

One document holds one day: morning gratitudes, intentions, and an affirmation;
evening highlights and a lesson. Morning and Evening bookmarks focus on one ritual,
and Day shows both for editing. Mark each ritual as written when you choose.

Choose the document’s date from the calendar. Changing it preserves the entries;
this is not a multi-day archive. New dates use date-only ISO strings, while legacy
text dates remain unchanged until you select a date. Fresh documents contain empty
entries with placeholder suggestions and an optional thought.

The resizable window starts at 560 × 780. Export includes both rituals with wrapped
text; the icon shares the ivory paper, ochre binding, and two bookmarks. Lora is
bundled under the SIL Open Font License; see `assets/fonts/OFL.txt`. Visual tokens
and component rules are recorded in [DESIGN.md](DESIGN.md).

```sh
bun slop dev examples/slops/five-minute-journal
bun slop build examples/slops/five-minute-journal
bun slop validate examples/slops/five-minute-journal/dist/five-minute-journal.slop
```
