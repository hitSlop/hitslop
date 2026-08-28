# ElementaryUI Template Roadmap

The first release ships only Field Notes and SQLite Field Notes. The next templates should be small, interactive apps that benefit from ElementaryUI state, local persistence, live CSS, and focused native windows—not static forms copied from the archived catalog.

## First wave

| Template | Store | Core interaction | ElementaryUI showcase | Default window |
|---|---|---|---|---|
| Quick Capture Inbox | JSON | Capture, tag, pin, and archive short thoughts | Focus handling, optimistic edits, filtered lists | 420×620 rounded |
| Kanban Board | SQLite | Create cards and move them between compact lanes | Relational queries, drag gestures, derived counts | 760×560 rounded |
| Focus Timer | JSON | Start a focus/rest cycle and retain session history | Timers, lifecycle state, progress animation | 380×380 circle |
| Habit Heatmap | SQLite | Check in daily and inspect streak history | Date grids, aggregate queries, responsive density | 620×480 rounded |
| Expense Pulse | SQLite | Log purchases and view category/month totals | Forms, SQL aggregation, small charts | 520×680 rounded |
| Meeting Agenda | JSON | Run an agenda, time topics, and capture decisions | Repeating sections, keyboard flow, timer state | 540×700 rounded |

## Second wave

| Template | Store | Core interaction | ElementaryUI showcase | Default window |
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

A template should ship only when it has meaningful defaults, keyboard access, empty/error states, useful Quick Look imagery, a token-driven `source/styles.css`, a blank `theme.css`, JSON or SQLite fixtures, package-local Codex and Claude skills, and tests for its persistence boundary.
