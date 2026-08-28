# Template Roadmap

Catalog templates and themes live in `Packages/SlopTemplates`. The picker loads that package on launch.

Shipped now: Field Notes, SQLite Field Notes, Notebook (Bits UI + Tailwind), Invoice, Focus Timer. Themes: Default plus studio-noir, ocean-glass, paper-ledger, minimal-mono, nord-harbor, cupcake.

The next templates should be small, interactive Svelte apps that benefit from local persistence, live CSS, and focused native windows—not static forms copied from the archived catalog.

## First wave

| Template | Store | Core interaction | Guest showcase | Default window |
|---|---|---|---|---|
| Notebook | JSON | Filter, compose, and check off notes | Bits Dialog/Select, Tailwind tokens | 480×640 rounded — **shipped** |
| Invoice | JSON | Line items, tax, status | Derived totals, date inputs, Bits Select | 720×900 rounded — **shipped** |
| Quick Capture Inbox | JSON | Capture, tag, pin, and archive short thoughts | Focus handling, optimistic edits, filtered lists | 420×620 rounded |
| Kanban Board | SQLite | Create cards and move them between compact lanes | Relational queries, drag gestures, derived counts | 760×560 rounded |
| Focus Timer | JSON | Start a focus/rest cycle and retain session history | Timers, lifecycle state, progress animation | 420×420 circle — **shipped** |
| Habit Heatmap | SQLite | Check in daily and inspect streak history | Date grids, aggregate queries, responsive density | 620×480 rounded |
| Expense Pulse | SQLite | Log purchases and view category/month totals | Forms, SQL aggregation, small charts | 520×680 rounded |
| Meeting Agenda | JSON | Run an agenda, time topics, and capture decisions | Repeating sections, keyboard flow, timer state | 540×700 rounded |

## Second wave

| Template | Store | Core interaction | Guest showcase | Default window |
|---|---|---|---|---|
| Flashcards | SQLite | Create decks and review with spaced repetition | Transitions, keyboard shortcuts, scheduling queries | 560×420 rounded |
| Reading Queue | SQLite | Save, rank, filter, and finish books/articles | Search, sortable lists, metadata editing | 480×660 rounded |
| Countdown & Milestones | JSON | Track a date with intermediate checkpoints | Date math, progress, compact display modes | 400×500 capsule |
| Decision Matrix | JSON | Score options against weighted criteria | Editable tables and derived calculations | 700×540 rounded |
| Pantry Expiry Tracker | SQLite | Track quantities and expiry dates | Date filtering, alerts, rapid data entry | 520×640 rounded |
| Workout Interval Timer | JSON | Build and run timed exercise sequences | State machines, audio-ready events, motion | 420×560 rounded |

## Experimental

| Template | Store | Why it is interesting |
|---|---|---|
| Random Picker | JSON | A tiny capsule-shaped utility with satisfying motion and history |
| Mood Garden | SQLite | Turns check-ins into a generative visual surface rather than another form |
| Tiny Status Dashboard | JSON | Tests dense responsive cards and external file edits |
| Digital Pet | SQLite | Exercises timers, durable state, animation, and non-rectangular presentation |

## Quality gate

A template should ship only when it has meaningful defaults, keyboard access, empty/error states, useful Quick Look imagery, a token-driven `source/styles.css`, a blank `theme.css`, JSON or SQLite fixtures, generated agent guides after duplication, and tests for its persistence boundary.
