<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Calendar from "@lucide/svelte/icons/calendar";
  import Clock from "@lucide/svelte/icons/clock";
  import Flag from "@lucide/svelte/icons/flag";
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
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
        <select class="filter-select" bind:value={filterCourse}>
          <option value="ALL">All Courses ({store.current.milestones.length})</option>
          {#each store.current.courses as c}
            {#if c.code !== "ALL"}
              <option value={c.code}>{c.code} · {c.name}</option>
            {/if}
          {/each}
        </select>
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
        <input class="date-input" type="date" bind:value={draftDate} />
        <select class="type-select" bind:value={draftType}>
          {#each MILESTONE_TYPES as mt}
            <option value={mt.type}>{mt.label}</option>
          {/each}
        </select>
        <select class="course-select" bind:value={draftCourse}>
          {#each store.current.courses as c}
            <option value={c.code}>{c.code}</option>
          {/each}
        </select>
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

  .filter-select {
    font-size: 11px;
    font-weight: 600;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    padding: 3px 6px;
    outline: none;
    color: var(--ink);
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

  .date-input, .type-select, .course-select {
    font-size: 11px;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 5px;
    padding: 3px 5px;
    outline: none;
    color: var(--ink);
  }

  .date-input { font-family: monospace; font-size: 10px; }
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
