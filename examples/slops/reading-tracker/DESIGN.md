# Reading Tracker — personal reading journal

Single job: remember books, track To Read/Reading/Read, and record a personal
rating. Replace the yellow checkout-card metaphor with a cool-white reading
journal in deep berry #642B4B, soft lavender, and restrained blush. Newsreader
supplies literary headings and book titles; Avenir supplies functional labels.
The bundled font ships with its OFL license.

Use a clear Reading list heading and owner-editable reader/note fields.
A bookmark-shaped finished count reflects real Read items. No due-date stamp,
returned-book language, or fictional circulation desk. Group each book title
with its author; a small geometric spine carries the status color. Status text
remains explicit and ratings use Lucide stars with Bits UI radio semantics.
Newly added books are unrated (0); preserve all existing ratings and schema.

Keep title/author/status/rating editable at 560 × 600 and narrow widths.
Titles grow and wrap. Authors remain visible. The window scrolls for longer
lists rather than squeezing text or hiding editing actions. The composer stays
inline. Maintain current animation with reduced-motion support.

Export keeps every title, author, rating, status, and the finished count. The
icon is a small berry bookshelf with a contrasting bookmark; a check appears
only when a nonempty shelf is entirely finished. No tiny mock table or stars.

Review typical, empty, long-title, and finished fixtures using
`bun run slops:review reading-tracker`. No registration or publishing in this pass.

## Per-book notes

Each book has Add note / Notes beside its rating. Bits UI Dialog opens a draft
with the book title, a multiline field, Save notes, and Cancel. Closing or
Escape discards the draft; Save stores only that book's notes. Empty text clears
the note. Existing documents omit the optional `notes` string and stay valid.
Export prints nonempty notes below their book with original line breaks.
