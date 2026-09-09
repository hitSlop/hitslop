# Template Roadmap

Authored templates live in `Templates/`. `slop package-templates` generates the
runtime cartridges loaded by the picker from `Packages/SlopTemplates`.

Shipped now: Field Notes, SQLite Field Notes, Notebook, Invoice, Minimal
Invoice, Focus Timer, Kanban Board, Expense Pulse, Subscription Tracker, Habit
Heatmap, Countdown & Milestones, Random Picker, Weekly Planner, Recipe Card,
Trip Planner, Mood Log, and Meeting Notes.

The first seventeen templates establish the MVP design language: compact focused
layouts, readable editorial typography, template-owned color systems, Lucide
icons, Bits UI behavior, and intentional silhouettes. Focus Timer uses a circle;
Countdown & Milestones and Random Picker use capsules. The second visual pass
adds deliberate range: a restrained Swiss invoice, ruled weekly desk planner,
warm culinary card, transit-board itinerary, soft color journal, sober meeting
memo, and calm subscription ledger. Authored `QuickLook` images are checked into
each template and are packaged as part of the same source of truth.

## Visual range pass

| Template        | Store | Core interaction                                 | Visual direction                                      | Default window                |
| --------------- | ----- | ------------------------------------------------ | ----------------------------------------------------- | ----------------------------- |
| Minimal Invoice | JSON  | Edit parties, status, line items, tax, and notes | Neutral Swiss utility with one cobalt signal          | 680×820 rounded — **shipped** |
| Weekly Planner  | JSON  | Add daily entries and complete the week          | Ruled cream desk planner with red and blue marks      | 760×560 rounded — **shipped** |
| Recipe Card     | JSON  | Check ingredients and run a prep timer           | Burgundy, tomato, and warm culinary editorial         | 620×680 rounded — **shipped** |
| Trip Planner    | JSON  | Switch itinerary days and add stops              | Transit board meets boarding pass                     | 650×610 rounded — **shipped** |
| Mood Log        | JSON  | Record mood, energy, and one sentence            | Gentle color journal without gamified streak pressure | 480×620 rounded — **shipped** |
| Meeting Notes   | JSON  | Track agenda, decisions, and owned actions       | Sober green meeting memo with acid-paper accents      | 620×720 rounded — **shipped** |

The next templates should be small, interactive Svelte apps that benefit from
local persistence, live CSS, and focused native windows—not static forms copied
from the archived catalog.

## First wave

| Template             | Store  | Core interaction                                          | Guest showcase                                       | Default window                |
| -------------------- | ------ | --------------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| Notebook             | JSON   | Filter, compose, and check off notes                      | Bits Dialog/Select, Tailwind tokens                  | 480×640 rounded — **shipped** |
| Invoice              | JSON   | Line items, tax, status                                   | Derived totals, date inputs, Bits Select             | 720×900 rounded — **shipped** |
| Quick Capture Inbox  | JSON   | Capture, tag, pin, and archive short thoughts             | Focus handling, optimistic edits, filtered lists     | 420×620 rounded               |
| Kanban Board         | SQLite | Create cards and move them between compact lanes          | Relational queries, drag gestures, derived counts    | 760×560 rounded — **shipped** |
| Focus Timer          | JSON   | Start a focus/rest cycle and retain session history       | Timers, lifecycle state, progress animation          | 420×420 circle — **shipped**  |
| Habit Heatmap        | SQLite | Check in daily and inspect streak history                 | Date grids, aggregate queries, responsive density    | 620×480 rounded — **shipped** |
| Expense Pulse        | SQLite | Log purchases and view category/month totals              | Forms, SQL aggregation, small charts                 | 520×680 rounded — **shipped** |
| Subscription Tracker | SQLite | Track recurring costs, renewal dates, and paused services | Editable rows, normalized totals, Bits Dialog/Select | 560×650 rounded — **shipped** |
| Meeting Agenda       | JSON   | Run an agenda, time topics, and capture decisions         | Repeating sections, keyboard flow, timer state       | 540×700 rounded               |

## Second wave

| Template               | Store  | Core interaction                               | Guest showcase                                      | Default window                |
| ---------------------- | ------ | ---------------------------------------------- | --------------------------------------------------- | ----------------------------- |
| Flashcards             | SQLite | Create decks and review with spaced repetition | Transitions, keyboard shortcuts, scheduling queries | 560×420 rounded               |
| Reading Queue          | SQLite | Save, rank, filter, and finish books/articles  | Search, sortable lists, metadata editing            | 480×660 rounded               |
| Countdown & Milestones | JSON   | Track a date with intermediate checkpoints     | Date math, progress, compact display modes          | 400×500 capsule — **shipped** |
| Decision Matrix        | JSON   | Score options against weighted criteria        | Editable tables and derived calculations            | 700×540 rounded               |
| Pantry Expiry Tracker  | SQLite | Track quantities and expiry dates              | Date filtering, alerts, rapid data entry            | 520×640 rounded               |
| Workout Interval Timer | JSON   | Build and run timed exercise sequences         | State machines, audio-ready events, motion          | 420×560 rounded               |

## Experimental

| Template              | Store  | Why it is interesting                                                          |
| --------------------- | ------ | ------------------------------------------------------------------------------ |
| Random Picker         | JSON   | A tiny capsule-shaped utility with satisfying motion and history — **shipped** |
| Mood Garden           | SQLite | Turns check-ins into a generative visual surface rather than another form      |
| Tiny Status Dashboard | JSON   | Tests dense responsive cards and external file edits                           |
| Digital Pet           | SQLite | Exercises timers, durable state, animation, and non-rectangular presentation   |

## Quality gate

A template should ship only when it has meaningful defaults, keyboard access,
empty/error states, useful authored Quick Look imagery, an intentional
template-owned visual system, clean JSON or SQLite seed data, a source-free
packaged cartridge, and tests for its persistence boundary. SQLite seeds must
carry the Slop application ID, use schema version 1 or lower, and be authored in
WAL mode; `slop package-templates` rejects invalid stores and stale runtime
cartridges.
