# Slop Migration Plan

This document tracks the launch-quality migration of every existing authored slop in
`examples/slops/`. The migration is intentionally batched: each batch must be fully
usable, visually reviewed, tested as a real writable document, and releasable before
the next batch is considered complete.

The goal is not to make every slop look alike. Every slop should do one job, explain
itself through its interface, and have a personality appropriate to that job. Use the
private `_vibe/` references for direction only; never copy them into source, runtime
packages, or the open-source release.

PLEASE REFER TO BITS UI DOCS TO SEE WHAT COMPONENTS ARE AVAILABLE.

Step 1: Look at the components in the slop you are about to edit
Step 2: Search the bits ui docs to see if there are any prebuilt components you could use

[Bits UI Docs](_docs/bits/llms.txt)

## Migration principles

- [ ] Preserve one clear purpose per slop.
- [ ] Make the normal workflow immediately understandable through hierarchy, labels,
      realistic defaults, and strong empty states.
- [ ] Add explicit walkthroughs only for rare, inherently sequential methods that
      cannot be made self-explanatory. Choice Point and Harada Method are likely
      candidates; a large feature count alone is not.
- [ ] Give every slop a deliberate Paper, Instrument, or Skin identity.
- [ ] Use Bits UI for behavioral primitives when it improves accessibility and
      consistency, without imposing a shared visual style.
- [ ] Use Vanilla Extract for compiled structural styling and plain CSS variables for
      the owner-editable theme surface.
- [ ] Treat Zod as the authoritative definition of JSON document state.
- [ ] Test persistence and native behavior in a built writable copy, never infer it
      from the disposable browser preview.
- [ ] Publish completed batches incrementally only after the complete batch gate passes.

## Foundation work

- [ ] Keep `examples/slops/package.json` as the single private development workspace for
      every in-repository example.
- [ ] Keep shared framework, Bits UI, Vanilla Extract, and tool dependencies in that
      package instead of creating a `package.json` or `node_modules` tree per slop.
- [ ] Keep `examples/slops` as one root workspace and use the repository lockfile for
      dependency installation.
- [ ] Treat `slop init` as the standalone third-party authoring path. Maintain separate
      clean-room scaffold tests that install generated projects using published
      `@hitslop/*` packages.
- [ ] Keep example source organization aligned with generated projects where useful,
      without requiring catalog examples to own installation or dependency metadata.
- [ ] Normalize Svelte examples around `src/`, root `schema.ts`, `vite.config.ts`, and
      `assets/theme.css`.
- [ ] Replace the parent package's manually enumerated commands with manifest discovery
      and optional slop/batch filtering.
- [ ] Add per-slop typecheck, validation, build, and package-inspection commands so a
      migrated batch can become green while later batches are still pending.
- [ ] Add the final all-examples check to the release gate.
- [ ] Remove the stale `random-picker` command. Do not create a missing Random Picker
      as part of this migration.
- [ ] Rewrite `examples/slops/README.md` for the shared example workspace, disposable
      browser preview, built writable-document testing, current storage rules, theming,
      and the publish flow.
- [ ] Correct the obsolete claim that Kanban uses SQLite unless a deliberate product
      review establishes a real query/transaction need for SQLite.
- [ ] Keep `_vibe/`, build output, dependencies, caches, source, authoring-only skills,
      seed stores, and private credentials out of runtime packages.

## Per-slop definition of done

Apply this checklist to every slop in every batch.

### Purpose and interaction

- [ ] Read `manifest.json` first and state the slop's single job in one sentence.
- [ ] Confirm its title, description, categories, initial dimensions, window behavior,
      and author attribution support that job.
- [ ] Classify the dominant object family as Paper, Instrument, or Skin.
- [ ] Identify one dominant action, readout, or working surface.
- [ ] Audit the current workflow before redesigning it; preserve behavior that already
      serves the purpose well.
- [ ] Remove generic dashboard shells, unnecessary nested cards, duplicate controls,
      unexplained modes, and equal-weight actions.
- [ ] Use realistic initial content that demonstrates the workflow without becoming
      seed data in the runtime package.
- [ ] Make empty, partial, complete, error, and content-heavy states understandable.
- [ ] Verify keyboard operation, visible focus, accessible names, contrast, destructive
      action handling, long text, and narrow-window behavior.
- [ ] Preserve critical actions as the window narrows; prefer reflow and container
      queries over hiding functionality.
- [ ] Respect `prefers-reduced-motion` and avoid decorative motion that obscures state.
- [ ] Use a concise inline explanation or optional Help surface only when the underlying
      method is unfamiliar.
- [ ] Use an ordered walkthrough only when the task genuinely has required steps.

### State and runtime boundary

- [ ] Choose no persistence, JSON, SQLite, named media, or a deliberate combination
      based on the data rather than template precedent.
- [ ] For JSON state, create root `schema.ts` with a default-exported Zod 4 schema.
- [ ] Infer the TypeScript data type from the Zod schema instead of maintaining a
      separate handwritten interface.
- [ ] Attach that same schema to `jsonStore({ schema, initial })`.
- [ ] Ensure the initial value validates against the schema.
- [ ] Run `bun run schema:generate` when shared schemas change.
- [ ] Audit named image and file roles and replace/remove them through host APIs.
- [ ] Use SQLite only for queryable collections or transactional workflows; keep a
      transaction on one host connection and never ship WAL/SHM files.
- [ ] Keep manifest storage implicit and free of storage IDs or release versions.
- [ ] Preserve `manifest.author.name` and render or link `manifest.author.url` where
      attribution is displayed.
- [ ] Confirm authored templates and published artifacts contain no `stores/`, source,
      dependencies, build caches, editable stylesheets, seed data, environment files,
      keys, or Finder-managed `Icon\r`.

### Components and theming

- [ ] Inventory interactive controls before choosing replacements.
- [ ] Use Bits UI for dialogs, selects, sliders, tabs, calendars, popovers, toggles,
      checkboxes, progress controls, tooltips, and similar behavioral primitives.
- [ ] Replace native or homemade versions of those primitives when Bits UI materially
      improves keyboard, focus, screen-reader, or portal behavior.
- [ ] Do not force Bits UI onto direct text editing, drag surfaces, spreadsheets,
      canvases, Webamp, or purpose-built skinned controls.
- [ ] Style Bits primitives through their documented data attributes.
- [ ] Keep each slop's visual personality; Bits UI is a behavior layer, not a theme.
- [ ] Move structural styles into Vanilla Extract `.css.ts` modules.
- [ ] Define public semantic `--slop-*` variables with
      `createGlobalThemeContract`.
- [ ] Put default values for public tokens in immutable `assets/theme.css`.
- [ ] Keep structural measurements and implementation details out of the public theme
      contract unless owners have a safe reason to override them.
- [ ] Confirm a document-level `stores/theme.css` visibly overrides the theme without
      rebuilding `app.html`.
- [ ] Check that the default theme still works when no override exists.

### Presentation and release

- [ ] Design deliberate live, static-capture, icon, and export states.
- [ ] Call `ready()` only after durable data and critical media are available.
- [ ] Mark editing-only UI with `data-slop-export="hide"`.
- [ ] Keep exportable content in normal document flow rather than nested fixed-height
      scrollers.
- [ ] Verify full-height PNG and PDF output, including content beyond the initial
      viewport.
- [ ] Provide at most one renderer-only 512x512 icon target and mount it only during
      icon capture.
- [ ] Validate and build the authored project through the shared examples workspace.
- [ ] Inspect `dist/<slug>.slop` for the exact runtime package contract.
- [ ] Register the artifact as an immutable local template master.
- [ ] Create a separate writable document from the master.
- [ ] Mutate data, close the document, reopen it, and verify persistence.
- [ ] Test named images/files, theme override, resize or alpha hit testing, Quick Look,
      icon rendering, and export wherever applicable.
- [ ] Capture before/after screenshots for batch review.
- [ ] Publish only after every slop in the batch passes.
- [ ] Install the production catalog release in the release macOS app and rerun its
      primary workflow before marking it complete.

## Batch 0 — Canonical framework fixtures

Use the two counters to establish the migration pattern and prove that in-repo examples
match third-party projects created by `slop init`.

- [ ] **svelte-counter** — Keep it as the smallest canonical Svelte, Zod, Vanilla
      Extract, persistence, capture, icon, and theme-override example. Avoid adding
      product complexity.
- [ ] **react-counter** — Make it the equivalent React fixture, add deliberate
      capture/icon behavior, and retain its intentionally persistence-free scope.

Batch gate:

- [ ] Both fixtures use the shared examples workspace while matching the current
      framework and runtime patterns produced by generated projects.
- [ ] Both resolve local workspace packages during repository development without
      per-slop dependency installations.
- [ ] Separate clean-room `slop init` tests install and build generated standalone
      projects using published packages.
- [ ] The Svelte counter persists and accepts a native theme override.
- [ ] The React counter proves the no-storage path without placeholder stores.
- [ ] Publish and verify the batch in the production catalog.

## Batch 1 — Small instruments

Establish repeatable patterns for compact, immediately understandable control surfaces.

- [x] **quick-checklist** — Refine the pink pocket-list personality, fast one-line
      entry, completion rhythm, and archive affordance.
- [x] **focus-timer** — Make the timer the unmistakable focal point with clear start,
      pause, mode, and completion states.
- [ ] **countdown-milestones** — Emphasize the date, remaining time, and milestone
      progression as a compact departure display.
- [ ] **metronome-tapper** — Preserve its mechanical instrument character while
      improving tempo entry, Bits slider/radio/toggle behavior, audio state, and
      reduced-motion handling.
- [ ] **water-tracker** — Create a tactile hydration gauge with an accessible target,
      quick increments, and meaningful progress feedback.
- [ ] **pixel-art** — Clarify the canvas, palette, and tool model while preserving its
      playful cartridge-like personality and keyboard-accessible controls.

- [ ] Complete the batch gate and publish all six releases.

## Batch 2 — Essential paper objects

Set the editorial and export standards for documents people edit, share, and print.

- [ ] **invoice** — Build a restrained warm-paper invoice with effortless line-item
      editing, clear totals, and clean PDF output.
- [ ] **resume** — Use an editorial paper layout with direct editing, strong typography,
      content-heavy resilience, and export-first behavior.
- [ ] **recipe** — Combine recipe-card warmth with clear ingredients, steps, timing,
      difficulty, and named hero-image handling. Replace the remaining native select
      and checkbox with appropriate Bits primitives.
- [ ] **meeting-notes** — Organize agenda, notes, decisions, and action items into a
      compact meeting memo whose editing controls disappear cleanly in export.
- [ ] **daily-planner** — Make scheduling blocks and editing obvious at the initial and
      narrow window sizes using accessible date, time, select, and popover behavior.
- [ ] **weekly-planner** — Simplify the week overview and direct task scheduling without
      turning the document into a dashboard.

- [ ] Complete the batch gate and publish all six releases.

## Batch 3 — Lists and life logistics

- [ ] **grocery-list** — Refine the fridge-memo personality, optimize rapid entry and
      checking, and replace the native section select.
- [ ] **packing-list** — Clarify trip setup, categories, completion, and archive behavior;
      replace both remaining native selects.
- [ ] **trip-itinerary** — Present a clear chronological itinerary with accessible tabs,
      selects, checkboxes, and time fields.
- [ ] **reading-tracker** — Refine the library-card feel, replace the remaining native
      select, and use an accessible rating primitive if ratings remain part of the job.
- [ ] **workout-planner** — Make exercises, sets, reps, completion, and rest flow
      immediately understandable.
- [ ] **subscription-tracker** — Turn it into a focused renewal ledger and replace its
      remaining native selects with purpose-styled Bits controls.

- [ ] Complete the batch gate and publish all six releases.

## Batch 4 — Money and decisions

- [ ] **expense-log** — Optimize rapid entry and receipt-like totals with an obvious,
      accessible category workflow.
- [ ] **personal-budget** — Present income, allocations, spending, and remaining funds
      as a coherent calculator-led ledger.
- [ ] **grade-calculator** — Reduce interaction density and clarify classes, weights,
      current grades, and target calculations without defaulting to a walkthrough.
- [ ] **eisenhower-matrix** — Improve quick capture and movement between quadrants while
      retaining a physical desk-blotter feel.
- [ ] **pros-cons-sheet** — Focus the canvas on the decision, evidence, and resulting
      balance instead of decorative scoring or dashboard furniture.
- [ ] **ivy-lee-method** — Reinforce the strict six-task constraint and one-task-at-a-time
      focus.

- [ ] Complete the batch gate and publish all six releases.

## Batch 5 — Journals and reflective methods

- [ ] **bullet-journal** — Refine the dot-grid paper language and replace the remaining
      native signifier select while keeping capture fast.
- [ ] **five-minute-journal** — Make morning and evening prompts gentle, immediate, and
      visually distinct.
- [ ] **morning-pages** — Create a distraction-free writing sheet with subtle progress,
      content-heavy resilience, and clean export.
- [ ] **mood-log** — Keep logging calm and non-gamified with accessible slider labels
      and useful history.
- [ ] **three-three-three** — Make the 3/3/3 structure self-explanatory through hierarchy
      and a concise inline explanation.
- [ ] **choice-point** — Use rare explicit step guidance for situation, hooks, values,
      and chosen action. Keep the language clear and non-medicalized, and keep the
      completed worksheet useful without the guide.

- [ ] Complete the batch gate and publish all six releases.

## Batch 6 — Education and complex scheduling

- [ ] **assignment-tracker** — Reduce interaction density and make setup,
      prioritization, due dates, and completion easy to scan.
- [ ] **school-schedule** — Clarify timetable creation and editing; adopt Bits time,
      select, and popover primitives where they improve behavior.
- [ ] **semester-planner** — Clarify term dates, courses, and milestones as a natural
      sequence. Add contextual guidance only if the redesigned empty state is
      insufficient.
- [ ] **cornell-notes** — Make cues, notes, summary, and study masking obvious from the
      paper itself, with optional help for the unfamiliar study method.
- [ ] **flashcards** — Strengthen deck creation, card editing, review flow, keyboard
      support, and the index-card personality.
- [ ] **habit-tracker** — Simplify habit creation and daily completion while retaining
      its playful pocket-object character.

- [ ] Complete the batch gate and publish all six releases.

## Batch 7 — Work and creative power tools

- [ ] **kanban-board** — Clarify lanes, work-in-progress, card creation, and movement.
      Retain JSON unless product review finds a concrete query or transactional reason
      for SQLite.
- [ ] **pocket-sheet** — Improve selection, formula entry, keyboard navigation, and CSV
      workflows without replacing its custom grid with Bits UI.
- [ ] **markdown-editor** — Refine the manuscript/typewriter personality, edit-preview
      flow, shortcuts, long documents, and export.
- [ ] **slide-deck** — Clarify slide creation, layout choice, editing, reordering, and
      presentation. Prefer contextual empty-state instruction over a forced tour.
- [ ] **harada-method** — Explain the central goal, supporting themes, and actions with
      rare progressive guidance while preserving the complete exportable chart.
- [ ] **contact-card** — Polish the compact Rolodex/pager personality, named avatar
      handling, direct editing, and link actions.

- [ ] Complete the batch gate and publish all six releases.

## Batch 8 — Media, games, and custom skins

These slops deliberately exercise unusual runtime behavior. Preserve their purpose-built
surfaces rather than normalizing them into ordinary app layouts.

- [ ] **alien-radio** — Preserve the fixed PNG-skinned radio, alpha hit testing, tuning,
      audio state, and favorites while keeping its Bits slider accessible.
- [ ] **ambient-sound-mixer** — Refine its hi-fi mixer hierarchy, preset selection,
      accessible faders, mute/solo behavior, and audio initialization.
- [ ] **soma-amp** — Preserve Webamp and ZIP-skin behavior. Migrate its wrapper,
      storage/file contract, package boundary, capture, and icon behavior without
      forcing Bits UI or Vanilla Extract into the third-party-rendered surface.
- [ ] **codex-pet** — Preserve the sprite-led personality, validate named-file behavior,
      add a deliberate template icon, and avoid unnecessary general-purpose controls.
- [ ] **wordle** — Improve physical keyboard and on-screen keyboard feedback, accessible
      state announcements, deterministic capture state, and completion dialog.

- [ ] Complete the batch gate and publish all five releases.

## Batch release gate

Run this gate after every batch. A partial batch is not published.

- [ ] Review before/after screenshots together for purpose, usability, personality,
      collection-level variety, and visual quality.
- [ ] Run per-slop typecheck, manifest validation, build, and runtime-package inspection.
- [ ] Run each slop in disposable browser preview for interaction and responsive review.
- [ ] Register each artifact and create a separate writable document in the release
      macOS app.
- [ ] Exercise each primary workflow with persistence, named media/files, theming,
      Quick Look, icon, export, resize, and alpha-hit-test checks as applicable.
- [ ] Confirm no immutable catalog master is edited in place.
- [ ] Confirm author name and optional author URL appear correctly in catalog metadata.
- [ ] Run the complete repository checks; record unrelated failures separately, but do
      not waive failures introduced by the batch.
- [ ] Publish each slop as release 1 unless an existing immutable production artifact
      requires the next release number.
- [ ] Verify checksums, Firebase metadata, artifact download, installation, catalog
      ordering, and popularity increment behavior in production.
- [ ] Mark the batch complete only after every production-installed slop completes its
      primary workflow.

## Final launch gate

- [ ] All 49 existing slops have completed the per-slop definition of done.
- [ ] The aggregate examples typecheck reports zero errors.
- [ ] All manifests validate and all 49 runtime packages build cleanly.
- [ ] Automated discovery includes every active example exactly once.
- [ ] No migration-only validation allowance remains.
- [ ] Every catalog artifact installs and opens in the release macOS app.
- [ ] Review the catalog as a collection for duplicate purposes, naming consistency,
      author attribution, visual variety, and launch quality.
- [ ] Confirm `_vibe/` material does not appear in tracked source or published artifacts.
- [ ] Archive this document as the completed launch record rather than deleting the
      decision history.
