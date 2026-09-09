<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Check from "@lucide/svelte/icons/check";
  import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
  import Clock from "@lucide/svelte/icons/clock";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import { CalendarDate, getLocalTimeZone, today as getTodayDate, type DateValue } from "@internationalized/date";
  import { Tabs, Checkbox, Select, Popover, Calendar as CalendarPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import type { Assignment, AssignmentCategory, AssignmentTrackerData, Course } from "./types";

  const CATEGORIES: AssignmentCategory[] = [
    "Homework",
    "Problem Set",
    "Reading",
    "Essay",
    "Lab Report",
    "Project",
    "Quiz Prep",
  ];

  const defaultCourses: Course[] = [
    { id: "c1", code: "BIO", name: "AP Biology", colorHex: "#3b7a57" },
    { id: "c2", code: "CALC", name: "Pre-Calculus", colorHex: "#4f46e5" },
    { id: "c3", code: "LIT", name: "Honors Lit", colorHex: "#4a5d6e" },
    { id: "c4", code: "HIST", name: "World History", colorHex: "#d97706" },
    { id: "c5", code: "SPAN", name: "Spanish III", colorHex: "#c2410c" },
  ];

  function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function addDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const defaultAssignments: Assignment[] = [
    {
      id: "a1",
      courseCode: "BIO",
      title: "Cellular Respiration Lab Writeup",
      dueDate: todayISO(),
      category: "Lab Report",
      points: 50,
      completed: false,
      notes: "Include graph for trial 3 enzyme rate",
    },
    {
      id: "a2",
      courseCode: "CALC",
      title: "Problem Set 2.4: Trigonometric Identities #1-24",
      dueDate: todayISO(),
      category: "Problem Set",
      points: 20,
      completed: false,
      notes: "Show all unit circle substitutions",
    },
    {
      id: "a3",
      courseCode: "LIT",
      title: "Read The Great Gatsby Chapters 1–3 & Reading Response",
      dueDate: addDays(2),
      category: "Reading",
      points: 15,
      completed: false,
      notes: "Annotate recurring green light motif",
    },
    {
      id: "a4",
      courseCode: "HIST",
      title: "DBQ Outline: Industrial Revolution Primary Sources",
      dueDate: addDays(4),
      category: "Essay",
      points: 40,
      completed: false,
      notes: "Draft thesis statement before Friday",
    },
    {
      id: "a5",
      courseCode: "SPAN",
      title: "Subjunctive Verb Conjugation Workbook p.42-45",
      dueDate: addDays(1),
      category: "Homework",
      points: 10,
      completed: true,
      notes: "",
    },
    {
      id: "a6",
      courseCode: "BIO",
      title: "Unit 1 Quiz Prep: Macromolecules & Cell Membrane",
      dueDate: addDays(5),
      category: "Quiz Prep",
      points: 30,
      completed: false,
      notes: "Review flashcards Leitner box 2",
    },
  ];

  const store = jsonStore<AssignmentTrackerData>({
    studentName: "Alex Rivera",
    term: "Fall Semester 2026",
    courses: defaultCourses,
    assignments: defaultAssignments,
  });

  let filterTab = $state<"all" | "today" | "week" | "done">("all");

  // New assignment quick draft
  let draftCourse = $state<string>("BIO");
  let draftTitle = $state<string>("");
  let draftCategory = $state<AssignmentCategory>("Homework");
  let draftDueDate = $state<string>(todayISO());
  let draftPoints = $state<number>(20);
  let duePopoverOpen = $state(false);
  const draftCalendarValue = $derived.by(() => {
    try {
      const [y, m, d] = draftDueDate.split("-").map(Number);
      return new CalendarDate(y, m, d);
    } catch {
      return getTodayDate(getLocalTimeZone());
    }
  });

  function onDraftDateSelect(date: DateValue | undefined): void {
    if (!date) return;
    draftDueDate = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
    duePopoverOpen = false;
  }

  function getCourse(code: string): Course | undefined {
    return store.current.courses.find(c => c.code === code);
  }

  function getRelativeDueInfo(dueDate: string): { label: string; urgency: "overdue" | "today" | "soon" | "later" } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate + "T00:00:00");
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgency: "overdue" };
    if (diffDays === 0) return { label: "Due Today", urgency: "today" };
    if (diffDays === 1) return { label: "Tomorrow", urgency: "soon" };
    if (diffDays <= 6) return { label: `In ${diffDays} days`, urgency: "soon" };
    return { label: dueDate, urgency: "later" };
  }

  const activeAssignments = $derived(store.current.assignments.filter(a => !a.completed));
  const completedAssignments = $derived(store.current.assignments.filter(a => a.completed));

  const dueTodayCount = $derived(
    activeAssignments.filter(a => {
      const rel = getRelativeDueInfo(a.dueDate);
      return rel.urgency === "today" || rel.urgency === "overdue";
    }).length
  );

  const dueWeekCount = $derived(
    activeAssignments.filter(a => {
      const rel = getRelativeDueInfo(a.dueDate);
      return rel.urgency === "today" || rel.urgency === "overdue" || rel.urgency === "soon";
    }).length
  );

  const totalPointsPending = $derived(activeAssignments.reduce((acc, a) => acc + (a.points || 0), 0));

  const filteredList = $derived.by(() => {
    if (filterTab === "done") return completedAssignments;
    if (filterTab === "today") {
      return activeAssignments.filter(a => {
        const r = getRelativeDueInfo(a.dueDate);
        return r.urgency === "today" || r.urgency === "overdue";
      });
    }
    if (filterTab === "week") {
      return activeAssignments.filter(a => {
        const r = getRelativeDueInfo(a.dueDate);
        return r.urgency === "today" || r.urgency === "overdue" || r.urgency === "soon";
      });
    }
    return activeAssignments;
  });

  function addAssignment() {
    if (!draftTitle.trim()) return;
    store.current.assignments.unshift({
      id: crypto.randomUUID(),
      courseCode: draftCourse,
      title: draftTitle.trim(),
      dueDate: draftDueDate,
      category: draftCategory,
      points: draftPoints || 0,
      completed: false,
      notes: "",
    });
    draftTitle = "";
  }

  function toggleComplete(id: string) {
    const item = store.current.assignments.find(a => a.id === id);
    if (item) item.completed = !item.completed;
  }

  function removeAssignment(id: string) {
    store.current.assignments = store.current.assignments.filter(a => a.id !== id);
  }
</script>

{#if capture.isRenderer()}
  <Icon />
{/if}

<main class="assignment-app">
  <div class="assignment-pad">
    <!-- Header -->
    <header class="pad-header">
      <div class="pad-title-block">
        <div class="pad-label">ASSIGNMENT PAD</div>
        <div class="meta-row">
          <input class="student-name" bind:value={store.current.studentName} placeholder="Student Name" />
          <span class="dot">·</span>
          <input class="term-name" bind:value={store.current.term} placeholder="Term" />
        </div>
      </div>

      <!-- Urgency Pills -->
      <div class="stats-ribbon" data-slop-export="hide">
        <div class="stat-pill" class:urgent={dueTodayCount > 0}>
          <AlertCircle size={12} />
          <span>{dueTodayCount} due today</span>
        </div>
        <div class="stat-pill">
          <Clock size={12} />
          <span>{dueWeekCount} this week</span>
        </div>
        <div class="stat-pill points">
          <span>{totalPointsPending} pts pending</span>
        </div>
      </div>
    </header>

    <!-- Filter Tabs -->
    <Tabs.Root value={filterTab} onValueChange={(v) => { if (v) filterTab = v as any; }}>
      <Tabs.List class="filter-tabs" data-slop-export="hide" aria-label="Filter assignments">
        <Tabs.Trigger value="all" class="tab-btn {filterTab === 'all' ? 'active' : ''}">
          All Active ({activeAssignments.length})
        </Tabs.Trigger>
        <Tabs.Trigger value="today" class="tab-btn {filterTab === 'today' ? 'active' : ''}">
          Due Today ({dueTodayCount})
        </Tabs.Trigger>
        <Tabs.Trigger value="week" class="tab-btn {filterTab === 'week' ? 'active' : ''}">
          This Week ({dueWeekCount})
        </Tabs.Trigger>
        <Tabs.Trigger value="done" class="tab-btn {filterTab === 'done' ? 'active' : ''}">
          Completed ({completedAssignments.length})
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>

    <!-- Quick Add Bar -->
    <form class="quick-add-bar" onsubmit={(e) => { e.preventDefault(); addAssignment(); }} data-slop-export="hide">
      <Select.Root
        type="single"
        bind:value={draftCourse}
      >
        <Select.Trigger class="course-select-trigger" aria-label="Course">
          <span>{draftCourse}</span>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class="assign-select-content" data-slop-export="hide">
            <Select.Viewport>
              {#each store.current.courses as c}
                <Select.Item value={c.code} label={`${c.code} · ${c.name}`} class="assign-select-item">
                  {#snippet children({ selected })}
                    <span>{c.code} · {c.name}</span>
                    {#if selected}<Check size={11} />{/if}
                  {/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <input
        class="title-input"
        placeholder="New assignment, paper, or reading..."
        bind:value={draftTitle}
      />

      <Select.Root
        type="single"
        bind:value={draftCategory}
      >
        <Select.Trigger class="cat-select-trigger" aria-label="Category">
          <span>{draftCategory}</span>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class="assign-select-content" data-slop-export="hide">
            <Select.Viewport>
              {#each CATEGORIES as cat}
                <Select.Item value={cat} label={cat} class="assign-select-item">
                  {#snippet children({ selected })}
                    <span>{cat}</span>
                    {#if selected}<Check size={11} />{/if}
                  {/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <Popover.Root bind:open={duePopoverOpen}>
        <Popover.Trigger class="date-select-trigger" aria-label="Due date">
          <CalendarIcon size={12} />
          <span>{draftDueDate || "Due date"}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="assign-calendar-popover" side="top" align="start" sideOffset={6} data-slop-export="hide">
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

      <div class="pts-wrapper">
        <input class="pts-input" type="number" bind:value={draftPoints} min="0" max="500" />
        <span class="pts-label">pts</span>
      </div>

      <button type="submit" class="add-btn" title="Add assignment">
        <Plus size={14} />
      </button>
    </form>

    <!-- Assignments List -->
    <div class="assignments-container">
      {#if filteredList.length === 0}
        <div class="empty-state">
          <CheckCircle2 size={32} class="empty-icon" />
          <p class="empty-text">No assignments in this view. You're all caught up!</p>
        </div>
      {:else}
        <ul class="assignment-list">
          {#each filteredList as item (item.id)}
            {@const course = getCourse(item.courseCode)}
            {@const due = getRelativeDueInfo(item.dueDate)}
            <li class="assignment-item" class:done={item.completed}>
              <Checkbox.Root
                checked={item.completed}
                onCheckedChange={() => toggleComplete(item.id)}
                class="check-btn"
                aria-label={item.completed ? "Mark incomplete" : "Mark completed"}
              >
                <div class="check-box" class:checked={item.completed}>
                  {#if item.completed}<Check size={12} />{/if}
                </div>
              </Checkbox.Root>

              <div class="item-body">
                <div class="item-top">
                  <span
                    class="course-chip"
                    style="background-color: {course?.colorHex || '#4a5d6e'};"
                    title={course?.name || item.courseCode}
                  >
                    {item.courseCode}
                  </span>
                  <span class="cat-tag">{item.category}</span>
                  <input
                    class="item-title-input"
                    bind:value={item.title}
                    placeholder="Assignment title"
                  />
                  <div class="due-badge {due.urgency}">
                    <span>{due.label}</span>
                  </div>
                  <span class="points-tag">{item.points} pts</span>
                  <button
                    type="button"
                    class="del-btn"
                    data-slop-export="hide"
                    onclick={() => removeAssignment(item.id)}
                    title="Delete item"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                {#if item.notes || !item.completed}
                  <input
                    class="notes-input"
                    bind:value={item.notes}
                    placeholder="Notes, links, or rubric steps..."
                  />
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Footer Summary -->
    <footer class="pad-footer">
      <div class="footer-courses">
        {#each store.current.courses as c}
          <span class="course-legend-dot" style="background-color: {c.colorHex};"></span>
          <span class="course-legend-text">{c.code} ({store.current.assignments.filter(a => a.courseCode === c.code && !a.completed).length})</span>
        {/each}
      </div>
      <div class="completion-rate">
        <span>{completedAssignments.length} / {store.current.assignments.length} done</span>
      </div>
    </footer>
  </div>
</main>

<style>
  :root {
    --bg-desk: #181715;
    --pad-sheet: #fdfbf7;
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

  .assignment-app {
    width: 100%;
    height: 100%;
    display: flex;
    padding: 10px;
    background: var(--bg-desk);
  }

  .assignment-pad {
    flex: 1;
    background: var(--pad-sheet);
    border-radius: 16px;
    border: 1.5px solid var(--pad-border);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
    gap: 10px;
    overflow: hidden;
  }

  /* Header */
  .pad-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 10px;
    gap: 12px;
  }

  .pad-label {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: var(--ink-light);
  }

  .meta-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .student-name {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 140px;
  }

  .term-name {
    font-size: 12px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 130px;
  }

  .dot { color: var(--ink-light); }

  .stats-ribbon {
    display: flex;
    gap: 6px;
  }

  .stat-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #f1ede3;
    border: 1px solid var(--pad-border);
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .stat-pill.urgent {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .stat-pill.points {
    font-family: monospace;
    font-weight: 700;
  }

  /* Filter Tabs */
  .filter-tabs {
    display: flex;
    gap: 6px;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 6px;
  }

  .tab-btn {
    background: none;
    border: none;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-muted);
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
  }

  .tab-btn:hover {
    background: #f0ece1;
    color: var(--ink);
  }

  .tab-btn.active {
    background: #232220;
    color: #ffffff;
  }

  /* Quick Add Bar */
  .quick-add-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f3efe6;
    border: 1px solid var(--pad-border);
    border-radius: 8px;
    padding: 6px 8px;
  }

  .course-select, .cat-select {
    font-size: 11px;
    font-weight: 600;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 5px;
    padding: 3px 6px;
    color: var(--ink);
    outline: none;
  }

  .course-select { width: 100px; }
  .cat-select { width: 95px; }

  .title-input {
    flex: 1;
    font-size: 11.5px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ink);
  }

  .date-input {
    font-size: 10.5px;
    font-family: monospace;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 5px;
    padding: 3px 5px;
    outline: none;
    color: var(--ink);
  }

  .pts-wrapper {
    display: flex;
    align-items: center;
    gap: 2px;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 5px;
    padding: 2px 4px;
  }

  .pts-input {
    width: 28px;
    font-size: 10.5px;
    font-family: monospace;
    font-weight: 700;
    border: none;
    outline: none;
    text-align: right;
  }

  .pts-label {
    font-size: 9px;
    color: var(--ink-light);
    font-weight: 700;
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 24px;
    background: #2b593f;
    color: #ffffff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  .add-btn:hover {
    background: #234732;
  }

  /* List */
  .assignments-container {
    flex: 1;
    overflow-y: auto;
  }

  .assignment-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .assignment-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 8px;
    padding: 8px 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: all 0.15s ease;
  }

  .assignment-item.done {
    opacity: 0.55;
    background: #f8f6f0;
  }

  .check-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
  }

  .check-box {
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--ink-light);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    transition: all 0.15s ease;
  }

  .check-box.checked {
    background: #2b593f;
    border-color: #2b593f;
  }

  .item-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .item-top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .course-chip {
    font-size: 9px;
    font-weight: 800;
    color: #ffffff;
    padding: 2px 5px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }

  .cat-tag {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--ink-muted);
    background: #f1ede3;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .item-title-input {
    flex: 1;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
  }

  .assignment-item.done .item-title-input {
    text-decoration: line-through;
    color: var(--ink-muted);
  }

  .due-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .due-badge.overdue {
    background: #fee2e2;
    color: #991b1b;
  }

  .due-badge.today {
    background: #fef3c7;
    color: #92400e;
  }

  .due-badge.soon {
    background: #e0e7ff;
    color: #3730a3;
  }

  .due-badge.later {
    background: #f3f4f6;
    color: var(--ink-muted);
  }

  .points-tag {
    font-size: 9.5px;
    font-family: monospace;
    font-weight: 700;
    color: var(--ink-muted);
    white-space: nowrap;
  }

  .del-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    opacity: 0;
    padding: 2px;
  }

  .assignment-item:hover .del-btn { opacity: 1; }
  .del-btn:hover { color: #dc2626; }

  .notes-input {
    font-size: 10px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    font-style: italic;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 180px;
    gap: 8px;
    color: var(--ink-light);
  }

  .empty-text {
    font-size: 12px;
  }

  /* Footer */
  .pad-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--pad-border);
    padding-top: 8px;
    font-size: 10px;
    color: var(--ink-muted);
  }

  .footer-courses {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .course-legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .course-legend-text {
    font-weight: 600;
    margin-right: 6px;
  }

  .completion-rate {
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

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .assignment-app {
    display: none;
  }
</style>
