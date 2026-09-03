# Maintained examples

Each directory is an authored web project with the same minimal manifest used
by third-party slops. Svelte/Vite is the supported v1 authoring path;
`react-counter` is the maintained React SDK integration example. Source CSS is compiled into `app.html`.
Templates contain no seed stores; JSON, SQLite, and named media are initialized lazily through
the bridge.

Static capture sets `data-slop-capture="static"` on the root. Examples can mark
editing-only UI with `data-slop-export="hide"`; previews stay at manifest size,
while PNG and PDF exports capture the full document height. PNG exports use 2x
resolution, while PDF exports preserve selectable text and WebKit vector output
on one page.

```sh
bun slop dev examples/slops/invoice
bun slop build examples/slops/invoice
bun slop dev examples/slops/alien-radio --native
bun slop dev examples/slops/soma-amp --native
bun slop dev examples/slops/expense-log
bun slop dev examples/slops/trip-itinerary
bun slop dev examples/slops/metronome-tapper
bun slop dev examples/slops/flashcards
bun slop dev examples/slops/pixel-art
bun slop dev examples/slops/school-schedule
bun slop dev examples/slops/assignment-tracker
bun slop dev examples/slops/semester-planner
bun slop dev examples/slops/grade-calculator
bun slop dev examples/slops/cornell-notes
bun slop dev examples/slops/eisenhower-matrix
bun slop dev examples/slops/ivy-lee-method
bun slop dev examples/slops/three-three-three
bun slop dev examples/slops/pros-cons-sheet
bun slop dev examples/slops/five-minute-journal
bun slop dev examples/slops/morning-pages
bun slop dev examples/slops/choice-point
bun slop dev examples/slops/bullet-journal
```

Recent product templates: `eisenhower-matrix` is an urgent-vs-important priority desk blotter with a triage holding pen; `ivy-lee-method` is a strict 6-slot single-tasking ledger strip; `three-three-three` is Oliver Burkeman’s finite work docket (3h deep work + 3 urgent + 3 maintenance); `pros-cons-sheet` is Benjamin Franklin’s prudential algebra with a live balance scale; `five-minute-journal` is a mindful morning and evening linen bookend; `morning-pages` is a 750-word stream-of-consciousness feed with live odometer; `choice-point` is Dr. Russ Harris’s ACT fork diagram; `bullet-journal` is Ryder Carroll’s analog rapid logging on cream dot-grid paper; `cornell-notes` is a classic lecture pad with an active-recall study mask; `school-schedule` is a student timetable with period bells; `assignment-tracker` is a homework urgency pad; `semester-planner` is a macro term syllabus roadmap; `grade-calculator` is an academic gradebook; `expense-log` is a thermal receipt for purchases; `flashcards` is an index-card Leitner box; `pixel-art` is a 16×16 handheld sprite desk.

`alien-radio` demonstrates a fixed exact-size RGBA skin. `kanban-board` uses
the canonical SQLite store. Recipe combines JSON with a named image store; the
SomaAmp combines JSON with a persistent ZIP skin in named media; the other examples use the canonical JSON store.
`svelte-counter` is the intentionally small Svelte SDK baseline;
`react-counter` fills the same role for React without promising a CLI scaffold.

The host window is the default outer boundary for a slop. Maintained examples
avoid wrapping the whole experience in another decorative card or backing
shadow; hierarchy comes from readable type, compact rhythm, rules, and
purposeful internal surfaces.

Build emits `dist/<slug>.slop`; install and publish capture a full
`QuickLook/Preview.png` and produce an exact 512×512 `QuickLook/Icon.png`. Pass
`--icon <png>` to supply custom artwork. A centered subject, comfortable safe
margins, and no essential small text work best in Finder and compact catalog
rows. Without a custom target or file, the CLI fits the preview into a square
icon canvas. Source, dependencies, data seeds, and Finder's host-generated
`Icon\r` metadata never enter the runtime template.

## Icon render target

An app may expose one optional square element with `data-slop-render="icon"`.
The contract, in full:

- **Mount only in the renderer pass.** The host renders document assets in a
  hidden session that sets `html[data-slop-renderer="true"]` before any guest
  code runs. Gate the targets with `capture.isRenderer()` from
  `@hitslop/runtime` so they never exist in the interactive DOM:

  ```svelte
  <script lang="ts">
    import { capture } from "@hitslop/runtime";
  </script>

  {#if capture.isRenderer()}
    <Icon />
  {/if}
  ```

- **Exactly one element**, square (width == height), and fully
  inside the viewport. The hidden renderer grows to at least 512px so a 512px
  canvas does not have to fit the interactive window. Snapshot output is
  always 512×512.
- **Reveal via CSS alone.** The host flips `html[data-slop-capture]` to
  `"icon"` (and `"static"` for full-document export) and waits
  only for layout to settle — a double `requestAnimationFrame` plus 100ms. No
  async work may be required to make a target visible. Use the double-gated
  form so targets can never flash inside the interactive app:

  ```css
  [data-slop-render] { display: none !important; width: 512px; height: 512px; background: transparent; }
  html[data-slop-renderer="true"][data-slop-capture="icon"] [data-slop-render="icon"] { display: grid !important; }
  ```

- **Ready before `slop.ready()`.** Anything a target draws from (stores,
  images, canvases) must be settled before the app signals ready; the host
  captures immediately after readiness.
- **Transparent backing.** The host snapshots with a transparent page
  background; keep the target's outer canvas transparent and paint only the
  intended object.

When a document closes, the macOS host may render the live icon for Finder
metadata without touching the interactive editor. Install and publish persist
the authored or derived icon as immutable `QuickLook/Icon.png`. Recently opened
documents keep the live `Preview.png` at the slop's own aspect ratio.

These are compiled DOM contracts—the runtime never contains or discovers
framework source files such as `Icon.svelte`.
