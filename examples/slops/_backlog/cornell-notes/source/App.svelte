<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import { Calendar, Popover } from "bits-ui";
  import { CalendarDate, getLocalTimeZone, today, type DateValue } from "@internationalized/date";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import GraduationCap from "@lucide/svelte/icons/graduation-cap";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Check from "@lucide/svelte/icons/check";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Icon from "./Icon.svelte";
  import type { CornellItem, CornellNoteData } from "./types";

  const defaultItems: CornellItem[] = [
    {
      id: "c1",
      cue: "What is resting membrane potential?",
      notes: "- Approximately -70mV in typical mammalian neurons.\n- Maintained primarily by Na+/K+ ATPase pump (3 Na+ out, 2 K+ in) and K+ leak channels.\n- Inside of cell remains net negative relative to extracellular fluid.",
    },
    {
      id: "c2",
      cue: "Depolarization vs Hyperpolarization",
      notes: "- Depolarization: Membrane potential becomes less negative (moves toward 0mV and +30mV peak) via voltage-gated Na+ influx.\n- Hyperpolarization: Membrane potential becomes more negative than resting state (e.g. -85mV) due to delayed closing of voltage-gated K+ channels (refractory period).",
    },
    {
      id: "c3",
      cue: "All-or-None Principle",
      notes: "- Threshold potential is typically -55mV.\n- If stimulus reaches threshold, action potential fires at constant amplitude regardless of stimulus strength.\n- Stronger stimulus increases frequency of action potentials, NOT amplitude.",
    },
    {
      id: "c4",
      cue: "Saltatory Conduction",
      notes: "- Myelin sheath (formed by Schwann cells in PNS, Oligodendrocytes in CNS) insulates axon.\n- Action potentials jump from one Node of Ranvier to the next, dramatically speeding up conduction velocity (up to 120 m/s).",
    },
    {
      id: "c5",
      cue: "Synaptic Cleft Transmission",
      notes: "- Arrival of action potential at axon terminal triggers opening of voltage-gated Ca2+ channels.\n- Ca2+ influx causes synaptic vesicles to fuse with presynaptic membrane via SNARE proteins.\n- Neurotransmitters (e.g. Acetylcholine, Glutamate, GABA) diffuse across cleft and bind to postsynaptic receptors.",
    },
  ];

  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    };

    resize();
    node.addEventListener("input", resize);
    return {
      update: resize,
      destroy: () => node.removeEventListener("input", resize),
    };
  }

  const store = jsonStore<CornellNoteData>({
    topic: "Action Potentials & Synaptic Transmission",
    course: "BIO 101 · Neurobiology",
    date: "2026-09-02",
    lecturer: "Prof. Angela Ruiz",
    items: defaultItems,
    summary: "Neurons maintain an electrochemical gradient at -70mV. Depolarization to -55mV threshold triggers an all-or-none action potential propelled down myelinated axons via saltatory conduction. At terminals, Ca2+ influx facilitates neurotransmitter exocytosis across the synapse.",
    theme: "light",
  });

  let studyMode = $state(false);
  let revealedItems = $state<Record<string, boolean>>({});
  let calendarOpen = $state(false);
  let calendarValue = $state<DateValue | undefined>(today(getLocalTimeZone()));

  const currentTheme = $derived(store.current.theme ?? "light");
  const totalCount = $derived(store.current.items.length);
  const revealedCount = $derived(
    store.current.items.filter(item => revealedItems[item.id]).length
  );

  function toggleTheme() {
    store.current.theme = currentTheme === "dark" ? "light" : "dark";
  }

  function toggleStudyMode() {
    studyMode = !studyMode;
    if (studyMode) {
      revealedItems = {};
    }
  }

  function toggleReveal(id: string) {
    revealedItems[id] = !revealedItems[id];
  }

  function revealAll() {
    const next: Record<string, boolean> = {};
    for (const item of store.current.items) {
      next[item.id] = true;
    }
    revealedItems = next;
  }

  function hideAll() {
    revealedItems = {};
  }

  function addItem() {
    store.current.items.push({
      id: crypto.randomUUID(),
      cue: "New Question or Key Term",
      notes: "- Detailed notes and supporting facts...",
    });
  }

  function removeItem(id: string) {
    store.current.items = store.current.items.filter(i => i.id !== id);
  }

  function onDateSelect(val: DateValue | undefined) {
    if (!val) return;
    calendarValue = val;
    const d = val.toDate(getLocalTimeZone());
    store.current.date = d.toISOString().slice(0, 10);
    calendarOpen = false;
  }
</script>

{#if capture.isRenderer()}
  <Icon />
{/if}

<main class="cornell-page" class:theme-dark={currentTheme === "dark"}>
  <!-- Binder Margin Strip (Tactile notebook edge) -->
  <aside class="binder-margin" aria-hidden="true" data-slop-export="hide">
    <div class="ring-hole"></div>
    <div class="ring-hole"></div>
    <div class="ring-hole"></div>
  </aside>

  <!-- Main Collegiate Notebook Sheet -->
  <div class="notebook-sheet">
    <!-- Header: University / Course Strip & Topic -->
    <header class="sheet-header">
      <div class="header-top-bar">
        <div class="course-meta">
          <div class="course-badge">
            <input
              class="course-input"
              bind:value={store.current.course}
              placeholder="Course & Code"
              aria-label="Course"
            />
          </div>
          <span class="meta-sep" aria-hidden="true">·</span>
          <div class="meta-item">
            <span class="meta-label">INSTRUCTOR</span>
            <input
              class="meta-input"
              bind:value={store.current.lecturer}
              placeholder="Lecturer Name"
              aria-label="Instructor"
            />
          </div>
          <span class="meta-sep" aria-hidden="true">·</span>

          <!-- Bits UI Calendar Popover Picker -->
          <Popover.Root bind:open={calendarOpen}>
            <Popover.Trigger class="date-trigger" aria-label="Select date">
              <CalendarIcon size={12} />
              <span class="meta-label">DATE</span>
              <strong class="date-text">{store.current.date}</strong>
            </Popover.Trigger>
            <Popover.Content class="calendar-popover" side="bottom" align="start" sideOffset={6}>
              <Calendar.Root
                type="single"
                value={calendarValue}
                onValueChange={onDateSelect}
              >
                {#snippet children({ months, weekdays })}
                  <Calendar.Header class="cal-header">
                    <Calendar.PrevButton class="cal-nav-btn" aria-label="Previous month">
                      <ChevronLeft size={14} />
                    </Calendar.PrevButton>
                    <Calendar.Heading class="cal-heading" />
                    <Calendar.NextButton class="cal-nav-btn" aria-label="Next month">
                      <ChevronRight size={14} />
                    </Calendar.NextButton>
                  </Calendar.Header>
                  {#each months as month}
                    <Calendar.Grid class="cal-grid">
                      <Calendar.GridHead>
                        <Calendar.GridRow class="cal-row">
                          {#each weekdays as day}
                            <Calendar.HeadCell class="cal-head-cell">{day.slice(0, 2)}</Calendar.HeadCell>
                          {/each}
                        </Calendar.GridRow>
                      </Calendar.GridHead>
                      <Calendar.GridBody>
                        {#each month.weeks as weekDates}
                          <Calendar.GridRow class="cal-row">
                            {#each weekDates as date}
                              <Calendar.Cell {date} month={month.value} class="cal-cell">
                                <Calendar.Day class="cal-day" />
                              </Calendar.Cell>
                            {/each}
                          </Calendar.GridRow>
                        {/each}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                  {/each}
                {/snippet}
              </Calendar.Root>
            </Popover.Content>
          </Popover.Root>
        </div>

        <div class="header-actions" data-slop-export="hide">
          <button
            type="button"
            class="study-btn"
            class:is-active={studyMode}
            onclick={toggleStudyMode}
            title="Toggle active-recall study mask"
          >
            <GraduationCap size={13} />
            <span>{studyMode ? "Study Active" : "Study Mode"}</span>
          </button>
          <button
            type="button"
            class="theme-btn"
            onclick={toggleTheme}
            aria-label={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
          >
            {#if currentTheme === "dark"}
              <Sun size={13} />
            {:else}
              <Moon size={13} />
            {/if}
          </button>
        </div>
      </div>

      <div class="topic-row">
        <textarea
          class="topic-input"
          rows={1}
          use:autosize
          bind:value={store.current.topic}
          placeholder="Lecture Topic / Subject Chapter"
          aria-label="Lecture Topic"
        ></textarea>
      </div>

      <!-- Active Recall Study Toolbar -->
      {#if studyMode}
        <div class="study-bar" data-slop-export="hide">
          <div class="study-bar-info">
            <span class="study-dot" aria-hidden="true"></span>
            <strong>Active Recall:</strong>
            <span>Cover notes and quiz yourself using the cues.</span>
            <span class="study-progress-pill">{revealedCount} of {totalCount} revealed</span>
          </div>
          <div class="study-bar-actions">
            {#if revealedCount < totalCount}
              <button type="button" class="study-action-btn" onclick={revealAll}>
                <Eye size={11} />
                <span>Reveal All</span>
              </button>
            {:else}
              <button type="button" class="study-action-btn" onclick={hideAll}>
                <RotateCcw size={11} />
                <span>Reset All</span>
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </header>

    <!-- Main Cornell 2-Column Grid -->
    <div class="cornell-grid">
      <!-- Column Labels Header -->
      <div class="grid-labels">
        <div class="cue-label">
          <span>CUES · QUESTIONS · KEYWORDS</span>
        </div>
        <div class="margin-divider-head" aria-hidden="true"></div>
        <div class="notes-label">
          <span>LECTURE NOTES · DEFINITIONS & SUPPORTING DETAILS</span>
        </div>
      </div>

      <!-- Stream of Cornell Items -->
      <div class="items-stream">
        {#each store.current.items as item, index (item.id)}
          {@const isRevealed = revealedItems[item.id]}
          <div class="cornell-entry">
            <!-- Left: Cues Column (Questions & Prompts) -->
            <div class="cue-cell">
              <span class="cue-prefix" aria-hidden="true">Q{index + 1}</span>
              <textarea
                class="cue-textarea"
                rows={1}
                use:autosize
                bind:value={item.cue}
                placeholder="Key question or prompt…"
                aria-label={`Cue ${index + 1}`}
              ></textarea>
              {#if studyMode}
                <button
                  type="button"
                  class="cue-reveal-btn"
                  class:is-revealed={isRevealed}
                  data-slop-export="hide"
                  onclick={() => toggleReveal(item.id)}
                >
                  {#if isRevealed}
                    <EyeOff size={11} />
                    <span>Hide</span>
                  {:else}
                    <Eye size={11} />
                    <span>Check</span>
                  {/if}
                </button>
              {/if}
            </div>

            <!-- Authentic Carnelian Red Vertical Margin Rule -->
            <div class="margin-rule" aria-hidden="true"></div>

            <!-- Right: Notes Column -->
            <div class="notes-cell">
              {#if studyMode && !isRevealed}
                <!-- Tactile Active Recall Study Mask -->
                <button
                  type="button"
                  class="study-mask-card"
                  data-slop-export="hide"
                  onclick={() => toggleReveal(item.id)}
                  title="Click to reveal note"
                >
                  <Eye size={14} />
                  <span>Tap or space to reveal notes</span>
                </button>
              {/if}

              <div class="notes-content-wrap" class:masked-notes={studyMode && !isRevealed}>
                <textarea
                  class="notes-textarea"
                  rows={2}
                  use:autosize
                  bind:value={item.notes}
                  placeholder="- Enter detailed notes, definitions, formulas…"
                  aria-label={`Notes for ${item.cue || `Item ${index + 1}`}`}
                ></textarea>
              </div>

              <button
                type="button"
                class="delete-btn"
                data-slop-export="hide"
                onclick={() => removeItem(item.id)}
                aria-label={`Delete item ${index + 1}`}
                title="Delete note block"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <!-- Add Row Bar -->
      <div class="add-entry-bar" data-slop-export="hide">
        <button type="button" class="add-entry-btn" onclick={addItem}>
          <Plus size={13} />
          <span>Add Cornell Note Block</span>
        </button>
      </div>
    </div>

    <!-- Bottom: Summary & Synthesis Box -->
    <footer class="summary-box">
      <div class="summary-title-row">
        <span class="summary-kicker">SUMMARY & SYNTHESIS</span>
        <span class="summary-sub">Briefly capture the big picture in 2–3 sentences</span>
      </div>
      <textarea
        class="summary-textarea"
        rows={2}
        use:autosize
        bind:value={store.current.summary}
        placeholder="Synthesize the core takeaways of this lecture in your own words…"
        aria-label="Summary and Synthesis"
      ></textarea>
    </footer>
  </div>
</main>

<style>
  :root {
    color-scheme: light;
    --paper-bg: #ffffff;
    --binder-bg: #f8fafc;
    --binder-border: #e2e8f0;
    --hole-color: #cbd5e1;

    --ink-primary: #0f172a;
    --ink-secondary: #334155;
    --ink-muted: #64748b;
    --ink-faint: #94a3b8;

    --line-subtle: #edf2f7;
    --line-strong: #cbd5e1;
    --rule-blue: rgba(37, 99, 235, 0.07);

    /* Signature Cornell Carnelian Accent */
    --carnelian: #b31b1b;
    --carnelian-subtle: #fdf2f2;
    --carnelian-border: #fecaca;

    /* Oxford / Cambridge Collegiate Navy */
    --oxford-navy: #1e3a8a;
    --oxford-subtle: #eff6ff;
    --oxford-border: #bfdbfe;

    /* Cue Column Tone */
    --cue-bg: #f8fafc;
    --cue-border: #e2e8f0;
    --cue-ink: #1e293b;

    /* Summary Box Tone */
    --summary-bg: #fffdfa;
    --summary-border: #fed7aa;
    --summary-kicker: #b45309;

    --focus: #2563eb;
    --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05);
  }

  .cornell-page.theme-dark {
    color-scheme: dark;
    --paper-bg: #0b1320;
    --binder-bg: #070d18;
    --binder-border: #1e293b;
    --hole-color: #1e293b;

    --ink-primary: #f8fafc;
    --ink-secondary: #cbd5e1;
    --ink-muted: #94a3b8;
    --ink-faint: #64748b;

    --line-subtle: #1e293b;
    --line-strong: #334155;
    --rule-blue: rgba(59, 130, 246, 0.08);

    --carnelian: #ef4444;
    --carnelian-subtle: #2b1111;
    --carnelian-border: #521b1b;

    --oxford-navy: #60a5fa;
    --oxford-subtle: #172554;
    --oxford-border: #1e3a8a;

    --cue-bg: #0f1a2e;
    --cue-border: #1e293b;
    --cue-ink: #f1f5f9;

    --summary-bg: #141b26;
    --summary-border: #422915;
    --summary-kicker: #f59e0b;

    --focus: #60a5fa;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(html, body, #app) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background: var(--paper-bg);
  }

  /* Host Window Outer Container */
  .cornell-page {
    width: 100%;
    min-height: 100vh;
    display: flex;
    background: var(--paper-bg);
    color: var(--ink-primary);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* Subtle Binder Margin Strip */
  .binder-margin {
    flex: 0 0 24px;
    background: var(--binder-bg);
    border-right: 1px solid var(--binder-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-around;
    padding: 30px 0;
    user-select: none;
  }

  .ring-hole {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--hole-color);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  /* Main Notebook Sheet */
  .notebook-sheet {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 18px 24px 22px;
    gap: 12px;
    min-width: 0;
  }

  /* Header */
  .sheet-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--ink-primary);
  }

  .header-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .course-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .course-badge {
    display: inline-flex;
    align-items: center;
    background: var(--oxford-subtle);
    border: 1px solid var(--oxford-border);
    border-radius: 6px;
    padding: 2px 8px;
  }

  .course-input {
    border: 0;
    background: transparent;
    font-size: 11.5px;
    font-weight: 750;
    color: var(--oxford-navy);
    outline: none;
    min-width: 120px;
  }

  .meta-sep {
    color: var(--ink-faint);
  }

  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--ink-muted);
  }

  .meta-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }

  .meta-input {
    border: 0;
    background: transparent;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-primary);
    outline: none;
    border-bottom: 1px dotted var(--line-strong);
    padding: 1px 0;
  }

  /* Bits UI Calendar Popover */
  :global(.date-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    background: var(--binder-bg);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    font-size: 11px;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 120ms ease;
  }

  :global(.date-trigger:hover) {
    border-color: var(--carnelian);
    color: var(--ink-primary);
  }

  .date-text {
    font-family: monospace;
    font-size: 11px;
    font-weight: 650;
    color: var(--ink-primary);
  }

  :global(.calendar-popover) {
    z-index: 70;
    background: var(--paper-bg);
    border: 1.5px solid var(--line-strong);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 12px 36px rgba(15, 23, 42, 0.16);
    width: 270px;
    font-family: inherit;
  }

  :global(.cal-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line-subtle);
    margin-bottom: 8px;
  }

  :global(.cal-heading) {
    font-size: 12.5px;
    font-weight: 750;
    color: var(--ink-primary);
  }

  :global(.cal-nav-btn) {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 120ms ease;
  }

  :global(.cal-nav-btn:hover) {
    background: var(--binder-bg);
    color: var(--ink-primary);
  }

  :global(.cal-grid) {
    width: 100%;
    border-collapse: collapse;
  }

  :global(.cal-row) {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 2px;
  }

  :global(.cal-head-cell) {
    font-size: 9.5px;
    font-weight: 800;
    color: var(--ink-faint);
    text-align: center;
    padding: 3px 0;
    text-transform: uppercase;
  }

  :global(.cal-cell) {
    display: grid;
    place-items: center;
    padding: 0;
  }

  :global(.cal-day) {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--ink-primary);
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: all 120ms ease;
  }

  :global(.cal-day:hover) {
    background: var(--binder-bg);
  }

  :global(.cal-day[data-selected]) {
    background: var(--carnelian);
    color: #ffffff;
    font-weight: 750;
  }

  :global(.cal-day[data-today]:not([data-selected])) {
    border: 1.5px solid var(--carnelian);
  }

  :global(.cal-day[data-outside-month]) {
    opacity: 0.3;
  }

  .header-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .study-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 700;
    background: var(--cue-bg);
    border: 1.5px solid var(--line-strong);
    color: var(--ink-secondary);
    cursor: pointer;
    transition: all 140ms ease;
  }

  .study-btn:hover {
    border-color: var(--carnelian);
    color: var(--carnelian);
  }

  .study-btn.is-active {
    background: var(--carnelian);
    border-color: var(--carnelian);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(179, 27, 27, 0.25);
  }

  .theme-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 140ms ease;
  }

  .theme-btn:hover {
    color: var(--ink-primary);
    border-color: var(--ink-primary);
    background: var(--cue-bg);
  }

  .topic-row {
    display: flex;
    align-items: center;
  }

  .topic-input {
    width: 100%;
    font-family: "Charter", Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--ink-primary);
    background: transparent;
    border: 0;
    outline: none;
    line-height: 1.25;
  }

  /* Active Recall Study Bar */
  .study-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: var(--carnelian-subtle);
    border: 1px solid var(--carnelian-border);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 11.5px;
  }

  .study-bar-info {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--carnelian);
  }

  .study-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--carnelian);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .study-progress-pill {
    padding: 1px 7px;
    background: var(--paper-bg);
    border: 1px solid var(--carnelian-border);
    border-radius: 999px;
    font-weight: 750;
    font-size: 10.5px;
    margin-left: 4px;
  }

  .study-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 700;
    background: var(--paper-bg);
    border: 1px solid var(--carnelian-border);
    color: var(--carnelian);
    cursor: pointer;
  }

  .study-action-btn:hover {
    background: var(--carnelian);
    color: #ffffff;
  }

  /* Main Cornell 2-Column Grid */
  .cornell-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    background: var(--paper-bg);
    overflow: hidden;
    min-height: 0;
  }

  .grid-labels {
    display: flex;
    align-items: center;
    background: var(--binder-bg);
    border-bottom: 1.5px solid var(--line-strong);
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .cue-label {
    width: 220px;
    padding: 6px 14px;
    color: var(--oxford-navy);
  }

  .margin-divider-head {
    width: 3px;
    height: 100%;
    background: var(--carnelian);
  }

  .notes-label {
    flex: 1;
    padding: 6px 14px;
    color: var(--ink-muted);
  }

  .items-stream {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .cornell-entry {
    display: flex;
    border-bottom: 1px solid var(--line-subtle);
    position: relative;
    transition: background-color 120ms ease;
  }

  .cornell-entry:hover {
    background: rgba(37, 99, 235, 0.015);
  }

  /* Left Cue Cell */
  .cue-cell {
    width: 220px;
    padding: 10px 14px;
    background: var(--cue-bg);
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
  }

  .cue-prefix {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--carnelian);
  }

  .cue-textarea {
    width: 100%;
    font-size: 13px;
    font-weight: 700;
    color: var(--cue-ink);
    line-height: 1.35;
    background: transparent;
    border: 0;
    outline: none;
  }

  .cue-reveal-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    background: var(--paper-bg);
    border: 1px solid var(--line-strong);
    color: var(--ink-muted);
    cursor: pointer;
  }

  .cue-reveal-btn.is-revealed {
    background: var(--carnelian-subtle);
    border-color: var(--carnelian-border);
    color: var(--carnelian);
  }

  /* Signature Carnelian Red Margin Line */
  .margin-rule {
    width: 3px;
    background: var(--carnelian);
    opacity: 0.85;
  }

  /* Right Notes Cell */
  .notes-cell {
    flex: 1;
    padding: 10px 16px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    position: relative;
    min-width: 0;
    background-image: repeating-linear-gradient(
      transparent,
      transparent 23px,
      var(--rule-blue) 23px,
      var(--rule-blue) 24px
    );
    background-attachment: local;
  }

  .notes-content-wrap {
    flex: 1;
    min-width: 0;
    transition: opacity 160ms ease, filter 160ms ease;
  }

  .notes-content-wrap.masked-notes {
    filter: blur(4px);
    opacity: 0.08;
    user-select: none;
    pointer-events: none;
  }

  .notes-textarea {
    width: 100%;
    font-size: 13px;
    font-weight: 500;
    line-height: 24px;
    color: var(--ink-primary);
    background: transparent;
    border: 0;
    outline: none;
  }

  /* Study Mask Button Overlay */
  .study-mask-card {
    position: absolute;
    inset: 6px 12px;
    z-index: 10;
    background: var(--paper-bg);
    border: 1.5px dashed var(--carnelian);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    color: var(--carnelian);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: all 140ms ease;
  }

  .study-mask-card:hover {
    background: var(--carnelian-subtle);
    transform: translateY(-1px);
  }

  .delete-btn {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin-top: 2px;
    border: 0;
    background: transparent;
    color: var(--ink-faint);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: all 120ms ease;
  }

  .cornell-entry:hover .delete-btn,
  .cornell-entry:focus-within .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: var(--carnelian);
    background: var(--carnelian-subtle);
  }

  /* Add Entry Bar */
  .add-entry-bar {
    padding: 8px 14px;
    background: var(--binder-bg);
    border-top: 1px dashed var(--line-strong);
  }

  .add-entry-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 700;
    background: var(--paper-bg);
    border: 1px solid var(--line-strong);
    color: var(--ink-secondary);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .add-entry-btn:hover {
    border-color: var(--oxford-navy);
    color: var(--oxford-navy);
  }

  /* Bottom Summary Box */
  .summary-box {
    background: var(--summary-bg);
    border: 1.5px solid var(--summary-border);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--shadow-sm);
  }

  .summary-title-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .summary-kicker {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--summary-kicker);
  }

  .summary-sub {
    font-size: 10px;
    color: var(--ink-muted);
  }

  .summary-textarea {
    width: 100%;
    font-family: "Charter", Georgia, serif;
    font-size: 12.5px;
    font-style: italic;
    line-height: 1.5;
    color: var(--ink-primary);
    background: transparent;
    border: 0;
    outline: none;
  }

  /* Static Export Mode */
  :global(html[data-slop-capture="static"]) [data-slop-export="hide"] {
    display: none !important;
  }

  :global(html[data-slop-capture="static"]) .study-mask-card {
    display: none !important;
  }

  :global(html[data-slop-capture="static"]) .notes-content-wrap {
    filter: none !important;
    opacity: 1 !important;
  }

  :global(html[data-slop-capture="static"]) input,
  :global(html[data-slop-capture="static"]) textarea {
    caret-color: transparent;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .cornell-page {
    display: none !important;
  }

  /* Focus rings */
  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .course-input:focus-visible,
  .meta-input:focus-visible,
  .topic-input:focus-visible,
  .cue-textarea:focus-visible,
  .notes-textarea:focus-visible,
  .summary-textarea:focus-visible {
    outline: none;
  }
</style>
