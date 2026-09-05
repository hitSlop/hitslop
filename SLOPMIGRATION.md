# Slop Migration Plan

Current platform pilot: only Quick Checklist is active. Other example projects
are preserved in `examples/slops/_backlog/`; the historical checklist below
does not certify compatibility with the current TypeBox/runtime contracts.
Promote and migrate one project at a time before marking it supported again.

This document tracks the structural and design migration of every existing authored
slop in `examples/slops/`. Follow `SLOPMIGRATIONRUNNER.md` for the routine
per-slop workflow. Native, persistence, export, registration, installation, and
publishing checks happen only at an explicitly requested batch release gate.

The goal is not to make every slop look alike. Every slop should do one job, explain
itself through its interface, and have a personality appropriate to that job. Use the
private `_vibe/` references for direction only; never copy them into source, runtime
packages, or the open-source release.

Inventory each slop's controls and consult the
[local Bits UI reference](_docs/bits/llms.txt) before choosing behavioral
primitives.

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
- [ ] Use the shared browser gallery for a focused visual and interaction smoke test.
- [ ] Build and validate each migrated slop without registering or installing it.

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

- [ ] Read `manifest.json`, the batch entry below, and the archived reference.
- [ ] Give the slop a unique Paper, Instrument, or Skin identity with one dominant
      surface and one purpose-specific memorable detail.
- [ ] Inventory controls, consult the local Bits UI reference, and use appropriate
      Bits primitives without imposing a shared visual theme.
- [ ] Move implementation into `src/`, update entry paths, and delete `source/`.
- [ ] Use root Zod `schema.ts`, schema-backed JSON state, Vanilla Extract structure,
      and semantic theme variables where applicable.
- [ ] Run a short gallery smoke test at `http://localhost:4177/<slug>/`: inspect the
      default-size UI, exercise the primary workflow and new Bits controls, and check
      the console.
- [ ] Build and validate the resulting `dist/<slug>.slop`.
- [ ] Confirm source, dependencies, caches, stores, and editable stylesheets are absent
      from the runtime package.

## Batch release gate

Run this only when release work is explicitly requested.

- [ ] Capture and inspect native preview and icon states.
- [ ] Create a writable document, mutate it, close it, reopen it, and verify persistence.
- [ ] Verify theme overrides, named media, resizing, export, and Quick Look where used.
- [ ] Register or publish only after every slop in the batch is ready.
- [ ] Install the production catalog release and rerun its primary workflow.

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
- [x] **countdown-milestones** — Emphasize the date, remaining time, and milestone
      progression as a playful mission board.
- [x] **metronome-tapper** — Preserve its mechanical instrument character while
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
