<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Calendar from "@lucide/svelte/icons/calendar";
  import Clock from "@lucide/svelte/icons/clock";
  import Flag from "@lucide/svelte/icons/flag";
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { Calendar as CalendarPrimitive, Popover, Select } from "bits-ui";
  import { CalendarDate, getLocalTimeZone, today as getTodayDate, type DateValue } from "@internationalized/date";
  import Icon from "./Icon.svelte";
  import type { CourseTag, Milestone, MilestoneType, SemesterData } from "./types";

  const MILESTONE_TYPES: { type: MilestoneType; label: string; color: string }[] = [
    { type: "Exam", label: "Exam / Midterm", color: "#dc2626" },
    { type: "Paper", label: "Major Paper", color: "#d97706" },
    { type: "Project", label: "Project / Deliverable", color: "#4f46e5" },
    { type: "Presentation", label: "Presentation", color: "#0d9488" },
    { type: "Break", label: "Break / Recess", color: "#16a34a" },
    { type: "Deadline", label: "Administrative Deadline", color: "#4a5d6e" },
  ];

  const defaultCourses: CourseTag[] = [
    { code: "BIO", name: "AP Biology", colorHex: "#3b7a57" },
    { code: "CALC", name: "Pre-Calculus", colorHex: "#4f46e5" },
    { code: "LIT", name: "Honors Lit", colorHex: "#4a5d6e" },
    { code: "HIST", name: "World History", colorHex: "#d97706" },
    { code: "SPAN", name: "Spanish III", colorHex: "#c2410c" },
    { code: "ALL", name: "School Wide", colorHex: "#1f2328" },
  ];

  const defaultMilestones: Milestone[] = [
    { id: "m1", date: "2026-09-08", title: "Add/Drop Class Deadline", courseCode: "ALL", type: "Deadline", notes: "Final schedule lock" },
    { id: "m2", date: "2026-09-18", title: "AP Bio Unit 1 Exam (Biochemistry)", courseCode: "BIO", type: "Exam", notes: "Chapters 1-4" },
    { id: "m3", date: "2026-10-02", title: "Pre-Calc Midterm 1", courseCode: "CALC", type: "Exam", notes: "Polynomials & Radicals" },
    { id: "m4", date: "2026-10-12", title: "Columbus / Indigenous Peoples Day", courseCode: "ALL", type: "Break", notes: "No school" },
    { id: "m5", date: "2026-10-23", title: "Honors Lit Great Gatsby Essay", courseCode: "LIT", type: "Paper", notes: "5-page critical analysis" },
    { id: "m6", date: "2026-11-06", title: "World History Revolutions Presentation", courseCode: "HIST", type: "Presentation", notes: "French vs American revolution" },
    { id: "m7", date: "2026-11-20", title: "AP Bio Midterm 2 (Cellular Bio)", courseCode: "BIO", type: "Exam", notes: "Chapters 5-8" },
    { id: "m8", date: "2026-11-25", title: "Thanksgiving Recess", courseCode: "ALL", type: "Break", notes: "Nov 25 - Nov 29" },
    { id: "m9", date: "2026-12-04", title: "Spanish Oral Dialogue Project", courseCode: "SPAN", type: "Project", notes: "Recorded conversational scene" },
    { id: "m10", date: "2026-12-14", title: "Final Exam Week Begins", courseCode: "ALL", type: "Exam", notes: "Study schedule in effect" },
    { id: "m11", date: "2026-12-18", title: "Winter Break Starts", courseCode: "ALL", type: "Break", notes: "Classes resume Jan 5" },
  ];

  const store = jsonStore<SemesterData>({
    termTitle: "Fall Semester 2026",
    academicYear: "Academic Year 2026–2027",
    startMonth: "2026-09",
    courses: defaultCourses,
    milestones: defaultMilestones,
  });

  // 4 months: Sept, Oct, Nov, Dec 2026
  const MONTHS = [
    { year: 2026, month: 8, name: "September", days: 30 },
    { year: 2026, month: 9, name: "October", days: 31 },
    { year: 2026, month: 10, name: "November", days: 30 },
    { year: 2026, month: 11, name: "December", days: 31 },
  ];

  let selectedDate = $state<string | null>(null);
  let filterCourse = $state<string>("ALL");

  // Quick Add draft
  let draftDate = $state("2026-09-15");
  let draftTitle = $state("");
  let draftCourse = $state("BIO");
  let draftType = $state<MilestoneType>("Exam");
  let datePopoverOpen = $state(false);
  const draftCalendarValue = $derived.by(() => {
    try {
      const [y, m, d] = draftDate.split("-").map(Number);
      return new CalendarDate(y, m, d);
    } catch {
      return getTodayDate(getLocalTimeZone());
    }
  });

  function onDraftDateSelect(date: DateValue | undefined): void {
    if (!date) return;
    draftDate = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
    datePopoverOpen = false;
  }

  function pad(n: number): string {
    return String(n).padStart(2, "0");
  }

  function formatDateStr(year: number, monthIdx: number, day: number): string {
    return `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
  }

  function getMilestonesForDate(dateStr: string): Milestone[] {
    return store.current.milestones.filter(m => m.date === dateStr);
  }

  const sortedMilestones = $derived(
    [...store.current.milestones]
      .filter(m => filterCourse === "ALL" || m.courseCode === filterCourse || m.courseCode === "ALL")
      .sort((a, b) => a.date.localeCompare(b.date))
  );

  const nextMilestone = $derived.by(() => {
    const today = "2026-09-02"; // Current date
    const upcoming = [...store.current.milestones]
      .filter(m => m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] || null;
  });

  function daysUntil(dateStr: string): number {
    const today = new Date("2026-09-02T00:00:00");
    const target = new Date(dateStr + "T00:00:00");
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getTypeColor(type: MilestoneType): string {
    return MILESTONE_TYPES.find(t => t.type === type)?.color || "#4a5d6e";
  }

  function getCourseColor(code: string): string {
    return store.current.courses.find(c => c.code === code)?.colorHex || "#4a5d6e";
  }

  function addMilestone() {
    if (!draftTitle.trim()) return;
    store.current.milestones.push({
      id: crypto.randomUUID(),
      date: draftDate,
      title: draftTitle.trim(),
      courseCode: draftCourse,
      type: draftType,
      notes: "",
    });
    draftTitle = "";
  }

  function removeMilestone(id: string) {
    store.current.milestones = store.current.milestones.filter(m => m.id !== id);
  }
</script>

{#if capture.isRenderer()}
  <Icon />
{/if}

<main class="semester-app">
  <div class="semester-canvas">
    <!-- Header -->
    <header class="semester-header">
      <div class="title-block">
        <div class="sub-label">TERM SYLLABUS & EXAM ROADMAP</div>
        <div class="main-title-row">
          <input class="term-title-input" bind:value={store.current.termTitle} placeholder="Semester Name" />
          <span class="dot">·</span>
          <input class="year-input" bind:value={store.current.academicYear} placeholder="Academic Year" />
        </div>
      </div>

      <!-- Next Milestone Countdown -->
      {#if nextMilestone}
        {@const diff = daysUntil(nextMilestone.date)}
        <div class="next-banner" data-slop-export="hide">
          <Flag size={13} color={getTypeColor(nextMilestone.type)} />
          <div class="next-text">
            <span class="next-head">Next Up:</span>
            <span class="next-title">{nextMilestone.title}</span>
            <span class="next-countdown">in {diff} days ({nextMilestone.date})</span>
          </div>
        </div>
      {/if}

      <!-- Course Filter -->
      <div class="course-filter-wrap" data-slop-export="hide">
        <Select.Root
          type="single"
          bind:value={filterCourse}
        >
          <Select.Trigger class="filter-select" aria-label="Course filter">
            <span>{filterCourse === "ALL" ? `All Courses (${store.current.milestones.length})` : filterCourse}</span>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="planner-select-content" data-slop-export="hide">
              <Select.Viewport>
                <Select.Item value="ALL" label="All Courses" class="planner-select-item">
                  {#snippet children({ selected })}
                    <span>All Courses ({store.current.milestones.length})</span>
                    {#if selected}<Check size={12} />{/if}
                  {/snippet}
                </Select.Item>
                {#each store.current.courses as c}
                  {#if c.code !== "ALL"}
                    <Select.Item value={c.code} label="{c.code} · {c.name}" class="planner-select-item">
                      {#snippet children({ selected })}
                        <span>{c.code} · {c.name}</span>
                        {#if selected}<Check size={12} />{/if}
                      {/snippet}
                    </Select.Item>
                  {/if}
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    </header>

    <!-- 4-Month Calendar Rail -->
    <section class="months-rail">
      {#each MONTHS as m}
        <div class="month-column">
          <div class="month-header">
            <span class="month-name">{m.name}</span>
            <span class="month-year">{m.year}</span>
          </div>
          <div class="month-days-grid">
            {#each Array.from({ length: m.days }, (_, i) => i + 1) as dayNum}
              {@const dateStr = formatDateStr(m.year, m.month, dayNum)}
              {@const dayMilestones = getMilestonesForDate(dateStr)}
              {@const isSelected = selectedDate === dateStr}
              {@const isToday = dateStr === "2026-09-02"}
              <button
                type="button"
                class="day-box"
                class:has-milestone={dayMilestones.length > 0}
                class:is-today={isToday}
                class:selected={isSelected}
                onclick={() => { selectedDate = isSelected ? null : dateStr; draftDate = dateStr; }}
                title="{dateStr}: {dayMilestones.map(x => x.title).join(', ') || 'No milestones'}"
              >
                <span class="day-num">{dayNum}</span>
                {#if dayMilestones.length > 0}
                  <div class="dots-row">
                    {#each dayMilestones as ms}
                      <span
                        class="milestone-dot"
                        style="background-color: {getTypeColor(ms.type)};"
                      ></span>
                    {/each}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </section>

    <!-- Lower Section: Quick Add Bar & Agenda List -->
    <section class="bottom-section">
      <!-- Quick Add Bar -->
      <form class="quick-add-form" onsubmit={(e) => { e.preventDefault(); addMilestone(); }} data-slop-export="hide">
        <Popover.Root bind:open={datePopoverOpen}>
          <Popover.Trigger class="date-trigger-btn" aria-label="Select date">
            <Calendar size={12} />
            <span>{draftDate || "Select Date"}</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class="planner-calendar-popover" side="top" align="start" sideOffset={6} data-slop-export="hide">
              <CalendarPrimitive.Root
                type="single"
                value={draftCalendarValue}
                onValueChange={onDraftDateSelect}
              >
                {#snippet children({ months, weekdays })}
                  <CalendarPrimitive.Header class="slop-cal-header">
                    <CalendarPrimitive.PrevButton class="slop-cal-nav" aria-label="Previous month">
                      <ChevronLeft size={13} />
                    </CalendarPrimitive.PrevButton>
                    <CalendarPrimitive.Heading class="slop-cal-title" />
                    <CalendarPrimitive.NextButton class="slop-cal-nav" aria-label="Next month">
                      <ChevronRight size={13} />
                    </CalendarPrimitive.NextButton>
                  </CalendarPrimitive.Header>
                  {#each months as month}
                    <CalendarPrimitive.Grid class="slop-cal-grid">
                      <CalendarPrimitive.GridHead>
                        <CalendarPrimitive.GridRow class="slop-cal-row">
                          {#each weekdays as day}
                            <CalendarPrimitive.HeadCell class="slop-cal-head-cell">{day.slice(0, 2)}</CalendarPrimitive.HeadCell>
                          {/each}
                        </CalendarPrimitive.GridRow>
                      </CalendarPrimitive.GridHead>
                      <CalendarPrimitive.GridBody>
                        {#each month.weeks as weekDates}
                          <CalendarPrimitive.GridRow class="slop-cal-row">
                            {#each weekDates as date}
                              <CalendarPrimitive.Cell {date} month={month.value} class="slop-cal-cell">
                                <CalendarPrimitive.Day class="slop-cal-day" />
                              </CalendarPrimitive.Cell>
                            {/each}
                          </CalendarPrimitive.GridRow>
                        {/each}
                      </CalendarPrimitive.GridBody>
                    </CalendarPrimitive.Grid>
                  {/each}
                {/snippet}
              </CalendarPrimitive.Root>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Select.Root
          type="single"
          bind:value={draftType}
        >
          <Select.Trigger class="type-select" aria-label="Milestone type">
            <span>{draftType}</span>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="planner-select-content" data-slop-export="hide">
              <Select.Viewport>
                {#each MILESTONE_TYPES as mt}
                  <Select.Item value={mt.type} label={mt.label} class="planner-select-item">
                    {#snippet children({ selected })}
                      <span>{mt.label}</span>
                      {#if selected}<Check size={12} />{/if}
                    {/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <Select.Root
          type="single"
          bind:value={draftCourse}
        >
          <Select.Trigger class="course-select" aria-label="Course">
            <span>{draftCourse}</span>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="planner-select-content" data-slop-export="hide">
              <Select.Viewport>
                {#each store.current.courses as c}
                  <Select.Item value={c.code} label={c.code} class="planner-select-item">
                    {#snippet children({ selected })}
                      <span>{c.code}</span>
                      {#if selected}<Check size={12} />{/if}
                    {/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <input class="title-input" bind:value={draftTitle} placeholder="Milestone / Exam / Project title..." />
        <button type="submit" class="add-btn" title="Add milestone">
          <Plus size={13} />
          <span>Add Date</span>
        </button>
      </form>

      <!-- Chronological Agenda Table -->
      <div class="agenda-container">
        <table class="agenda-table">
          <thead>
            <tr>
              <th style="width: 90px;">Date</th>
              <th style="width: 70px;">Course</th>
              <th style="width: 110px;">Type</th>
              <th>Milestone / Description</th>
              <th style="width: 140px;">Notes / Prep</th>
              <th style="width: 30px;" data-slop-export="hide"></th>
            </tr>
          </thead>
          <tbody>
            {#each sortedMilestones as ms (ms.id)}
              {@const isSelected = selectedDate === ms.date}
              <tr class="agenda-row" class:selected={isSelected}>
                <td class="date-cell">
                  <input class="cell-input mono" bind:value={ms.date} />
                </td>
                <td>
                  <span class="course-badge" style="background-color: {getCourseColor(ms.courseCode)};">
                    {ms.courseCode}
                  </span>
                </td>
                <td>
                  <span class="type-badge" style="color: {getTypeColor(ms.type)}; border-color: {getTypeColor(ms.type)};">
                    {ms.type}
                  </span>
                </td>
                <td>
                  <input class="cell-input bold" bind:value={ms.title} />
                </td>
                <td>
                  <input class="cell-input muted" bind:value={ms.notes} placeholder="Add prep notes..." />
                </td>
                <td data-slop-export="hide">
                  <button
                    type="button"
                    class="del-btn"
                    onclick={() => removeMilestone(ms.id)}
                    title="Remove date"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Legend Footer -->
    <footer class="semester-footer">
      <div class="type-legend">
        {#each MILESTONE_TYPES as mt}
          <div class="legend-item">
            <span class="legend-dot" style="background-color: {mt.color};"></span>
            <span class="legend-label">{mt.label}</span>
          </div>
        {/each}
      </div>
      <div class="total-count">
        <span>{store.current.milestones.length} Term Milestones</span>
      </div>
    </footer>
  </div>
</main>

<style>
  :root {
    --bg-desk: #181716;
    --pad-paper: #faf8f3;
    --pad-border: #ded8cb;
    --ink: #1f2328;
    --ink-muted: #57606a;
    --ink-light: #8c959f;
    --rule: rgba(31, 35, 40, 0.08);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(html, body) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background: var(--bg-desk);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  :global(#app) {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: stretch;
  }

  .semester-app {
    width: 100%;
    height: 100%;
    display: flex;
    padding: 10px;
    background: var(--bg-desk);
  }

  .semester-canvas {
    flex: 1;
    background: var(--pad-paper);
    border-radius: 16px;
    border: 1.5px solid var(--pad-border);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    padding: 14px 18px;
    gap: 10px;
    overflow: hidden;
  }

  /* Header */
  .semester-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 8px;
    gap: 12px;
  }

  .sub-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--ink-light);
  }

  .main-title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .term-title-input {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 180px;
  }

  .year-input {
    font-size: 11px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 150px;
  }

  .dot { color: var(--ink-light); }

  .next-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    padding: 4px 10px;
    border-radius: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .next-text {
    display: flex;
    align-items: baseline;
    gap: 5px;
    font-size: 11px;
  }

  .next-head { font-weight: 800; color: var(--ink); }
  .next-title { font-weight: 600; color: #2563eb; }
  .next-countdown { font-size: 9.5px; color: var(--ink-muted); }

  :global(.filter-select) {
    font-size: 11px;
    font-weight: 600;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    padding: 3px 6px;
    outline: none;
    color: var(--ink);
    cursor: pointer;
  }

  :global(.planner-select-content) {
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 1000;
    outline: none;
  }

  :global(.planner-select-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 4px;
    cursor: pointer;
    outline: none;
    color: var(--ink);
  }

  :global(.planner-select-item:hover),
  :global(.planner-select-item[data-highlighted]) {
    background: #f1f5f9;
  }

  /* 4-Month Rail */
  .months-rail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .month-column {
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .month-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1.5px solid var(--ink);
    padding-bottom: 2px;
  }

  .month-name {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--ink);
    text-transform: uppercase;
  }

  .month-year {
    font-size: 9px;
    font-family: monospace;
    color: var(--ink-light);
  }

  .month-days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .day-box {
    background: #faf8f2;
    border: 1px solid transparent;
    border-radius: 4px;
    height: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    padding: 1px;
  }

  .day-box:hover {
    background: #f0ece1;
    border-color: var(--pad-border);
  }

  .day-box.is-today {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .day-box.has-milestone {
    background: #ffffff;
    border-color: #ded8cb;
  }

  .day-box.selected {
    box-shadow: 0 0 0 1.5px #232220;
    background: #ffffff;
  }

  .day-num {
    font-size: 8.5px;
    font-family: monospace;
    font-weight: 600;
    color: var(--ink);
  }

  .dots-row {
    display: flex;
    gap: 1.5px;
    margin-top: 1px;
  }

  .milestone-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  /* Bottom Section: Quick Add & Agenda */
  .bottom-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .quick-add-form {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f3efe6;
    border: 1px solid var(--pad-border);
    border-radius: 8px;
    padding: 5px 8px;
  }

  :global(.date-trigger-btn),
  :global(.type-select),
  :global(.course-select) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-family: monospace;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 5px;
    padding: 3px 6px;
    outline: none;
    color: var(--ink);
    cursor: pointer;
  }

  :global(.planner-calendar-popover) {
    z-index: 1000;
    background: #fffdf8;
    border: 1.5px solid var(--pad-border);
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
    width: 236px;
    outline: none;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  :global(.planner-calendar-popover .slop-cal-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5dfd3;
  }
  :global(.planner-calendar-popover .slop-cal-title) {
    font-size: 11px;
    font-weight: 700;
    color: #232220;
  }
  :global(.planner-calendar-popover .slop-cal-nav) {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  :global(.planner-calendar-popover .slop-cal-nav:hover) {
    background: rgba(0, 0, 0, 0.06);
  }
  :global(.planner-calendar-popover .slop-cal-grid) {
    width: 100%;
    border-collapse: collapse;
  }
  :global(.planner-calendar-popover .slop-cal-row) {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }
  :global(.planner-calendar-popover .slop-cal-head-cell) {
    font-size: 8px;
    font-weight: 800;
    text-align: center;
    color: #777;
    padding: 2px 0;
    text-transform: uppercase;
  }
  :global(.planner-calendar-popover .slop-cal-cell) {
    display: grid;
    place-items: center;
    padding: 0;
  }
  :global(.planner-calendar-popover .slop-cal-day) {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 600;
    color: #232220;
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  :global(.planner-calendar-popover .slop-cal-day:hover) {
    background: rgba(0, 0, 0, 0.06);
  }
  :global(.planner-calendar-popover .slop-cal-day[data-selected]) {
    background: #4f46e5;
    color: #ffffff;
    font-weight: 800;
  }
  :global(.planner-calendar-popover .slop-cal-day[data-today]:not([data-selected])) {
    outline: 1.5px solid #4f46e5;
  }
  :global(.planner-calendar-popover .slop-cal-day[data-outside-month]) {
    opacity: 0.25;
  }
  .title-input {
    flex: 1;
    font-size: 11px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ink);
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 700;
    background: #232220;
    color: #ffffff;
    border: none;
    border-radius: 5px;
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-btn:hover { background: #3b3935; }

  /* Agenda Table */
  .agenda-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    background: #ffffff;
  }

  .agenda-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  th {
    background: #f5efe3;
    padding: 4px 8px;
    text-align: left;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--ink-muted);
    border-bottom: 1.5px solid var(--pad-border);
  }

  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--rule);
    vertical-align: middle;
  }

  .agenda-row.selected {
    background: #f8fbf9;
  }

  .course-badge {
    font-size: 8.5px;
    font-weight: 800;
    color: #ffffff;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .type-badge {
    font-size: 8.5px;
    font-weight: 700;
    padding: 1px 4px;
    border: 1px solid;
    border-radius: 10px;
    display: inline-block;
  }

  .cell-input {
    width: 100%;
    font-size: 11px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ink);
  }

  .cell-input.mono { font-family: monospace; font-size: 10px; }
  .cell-input.bold { font-weight: 600; }
  .cell-input.muted { font-size: 10px; color: var(--ink-muted); }

  .del-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    opacity: 0;
    padding: 2px;
  }

  .agenda-row:hover .del-btn { opacity: 1; }
  .del-btn:hover { color: #dc2626; }

  /* Footer */
  .semester-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--pad-border);
    padding-top: 6px;
    font-size: 9.5px;
    color: var(--ink-muted);
  }

  .type-legend {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .total-count {
    font-weight: 700;
    font-family: monospace;
  }

  /* Export mode */
  :global(html[data-slop-capture="static"] [data-slop-export="hide"]) {
    display: none !important;
  }

  :global(html[data-slop-capture="static"]) input {
    border: none !important;
    background: transparent !important;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .semester-app {
    display: none;
  }
</style>
