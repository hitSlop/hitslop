---
version: 1
slug: "five-minute-journal-src-app-svelte"
primary_target: "five-minute-journal/src/App.svelte"
related_targets: ["five-minute-journal/src/styles.css.ts", "five-minute-journal/theme.ts", "five-minute-journal/src/JournalPage.svelte", "five-minute-journal/src/DatePicker.svelte", "five-minute-journal/src/Export.svelte", "five-minute-journal/src/Icon.svelte"]
---

# Five Minute Journal

Mode: Operate. Single-purpose personal daybook in a resizable desktop document.
The user approved the code-first daybook plan and subsequently requested a Bits UI
calendar date picker. This records the direction and implemented surface, not
approval of the finished design or native release validation.

## Direction contract

THESIS: An ivory daybook with morning and evening bookmarks makes a small writing
ritual clear and inviting.

OWN-WORLD: Warm ivory paper, ochre binding, Lora serif headings and prompts, dark
readable entry text, warm morning and slate evening bookmarks. Ruled writing stays
open on the page. Material depth belongs to the binding and calendar overlay.

STORY: Open a fresh blank page, write into the morning prompts, and manually mark
it written. Return to Evening, or select Day to edit both rituals. An optional
thought stays secondary. Opening selects Morning until morning is written, then
Evening, then Day when both are written; switching does not alter completion.

FIRST VIEWPORT: At 560 × 780, the masthead and date sit above Morning, Evening,
and Day bookmarks. The selected ritual presents a serif title, sun or moon mark,
and growing writing lines. Compact insets activate at 420px; a 360px view retains
readable controls and vertical scrolling. Longer writing wraps and grows.

FORM: User-pinned paper daybook implemented in code. Seed c7a6c43d assigned index 7;
the explicitly approved direction overrides the random selection. No new concept
approval is owed. `_vibe/` remains inspiration-only. Lora is bundled with its OFL;
there is no raster skin. Small state transitions settle for reduced motion.

DATE: Bits UI Calendar in a Popover selects a date-only ISO value. Legacy text
labels remain displayable until replaced by a selection. One document still holds
one day: selecting another date relabels this page and preserves its entries.

EXPORT AND ICON: Shared JournalPage renders both rituals as static wrapped text in
export, independent of the editor tab. The icon keeps the bound ivory silhouette,
both bookmarks, and completion marks. Existing public theme tokens remain stable.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Validation scope: shared-gallery browser inspection at default and narrow sizes,
keyboard tabs and calendar, date and legacy-data behavior, long entries, manual
completion, optional thought, export and icon inspection, Svelte checks, package
build and validation. Native persistence and release gates require separate evidence;
this brief does not assert they ran.
