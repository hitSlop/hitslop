<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Flame from "@lucide/svelte/icons/flame";
  import Trophy from "@lucide/svelte/icons/trophy";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import Icon from "./Icon.svelte";

  type ColorTone =
    | "cyan"
    | "teal"
    | "mint"
    | "lime"
    | "amber"
    | "orange"
    | "coral"
    | "rose"
    | "lavender"
    | "indigo";

  type Habit = {
    id: string;
    name: string;
    color: ColorTone;
    createdAt: string;
    checkins: string[];
  };

  type HabitTrackerState = {
    selectedId: string;
    habits: Habit[];
  };

  const COLOR_OPTIONS: Array<{ tone: ColorTone; label: string }> = [
    { tone: "cyan", label: "Cyan" },
    { tone: "teal", label: "Teal" },
    { tone: "mint", label: "Mint" },
    { tone: "lime", label: "Lime" },
    { tone: "amber", label: "Amber" },
    { tone: "orange", label: "Orange" },
    { tone: "coral", label: "Coral" },
    { tone: "rose", label: "Rose" },
    { tone: "lavender", label: "Lavender" },
    { tone: "indigo", label: "Indigo" },
  ];

  function formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function generateSampleDates(daysAgo: number[], anchor: Date): string[] {
    return daysAgo.map((ago) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() - ago);
      return formatLocalDate(d);
    });
  }

  const todayDate = new Date();
  const todayStr = formatLocalDate(todayDate);

  const initialHabits: Habit[] = [
    {
      id: "h-water",
      name: "Hydrate (8 glasses)",
      color: "cyan",
      createdAt: formatLocalDate(new Date(Date.now() - 60 * 86400000)),
      checkins: generateSampleDates([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 18, 20, 21, 22, 25, 27, 28, 30, 31, 35, 40], todayDate),
    },
    {
      id: "h-reading",
      name: "Morning reading",
      color: "coral",
      createdAt: formatLocalDate(new Date(Date.now() - 50 * 86400000)),
      checkins: generateSampleDates([0, 1, 2, 3, 4, 7, 8, 9, 11, 12, 14, 17, 18, 22, 23, 24, 28, 29, 30], todayDate),
    },
    {
      id: "h-walk",
      name: "Daily walk",
      color: "mint",
      createdAt: formatLocalDate(new Date(Date.now() - 45 * 86400000)),
      checkins: generateSampleDates([0, 1, 2, 3, 4, 5, 8, 9, 10, 15, 16, 17, 21, 22, 23, 25, 26, 33, 34], todayDate),
    },
    {
      id: "h-stretch",
      name: "Evening stretch",
      color: "lavender",
      createdAt: formatLocalDate(new Date(Date.now() - 30 * 86400000)),
      checkins: generateSampleDates([0, 1, 2, 5, 6, 8, 10, 12, 14, 15, 18, 20, 22], todayDate),
    },
  ];

  const store = jsonStore<HabitTrackerState>({
    selectedId: "h-water",
    habits: initialHabits,
  });

  // UI Dialog states
  let isAdding = $state(false);
  let newName = $state("");
  let newColor = $state<ColorTone>("cyan");

  let isEditing = $state(false);
  let editName = $state("");
  let editColor = $state<ColorTone>("cyan");

  const activeHabit = $derived.by(() => {
    const list = store.current.habits;
    if (list.length === 0) return null;
    return list.find((h) => h.id === store.current.selectedId) ?? list[0];
  });

  const checkinsSet = $derived(new Set(activeHabit?.checkins ?? []));
  const isTodayCompleted = $derived(checkinsSet.has(todayStr));

  // Streaks and statistics
  const streaks = $derived.by(() => {
    if (!activeHabit) return { current: 0, best: 0 };
    return calculateStreaks(activeHabit.checkins, todayStr);
  });

  const consistencyRate = $derived.by(() => {
    if (!activeHabit) return 0;
    return calculateConsistency(activeHabit.checkins, todayStr);
  });

  const totalCompletions = $derived(activeHabit?.checkins.length ?? 0);

  // 7 weeks = 49 days grid, Mon-Sun
  const calendarDays = $derived.by(() => getGridDays(7, todayDate));

  function calculateStreaks(checkins: string[], currentToday: string): { current: number; best: number } {
    const set = new Set(checkins);
    const now = new Date(`${currentToday}T12:00:00`);

    let current = 0;
    const checkDate = new Date(now);

    if (set.has(formatLocalDate(checkDate))) {
      while (set.has(formatLocalDate(checkDate))) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
      while (set.has(formatLocalDate(checkDate))) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    const sorted = Array.from(set).sort();
    let best = 0;
    let running = 0;
    let prevDate: Date | null = null;

    for (const dStr of sorted) {
      const d = new Date(`${dStr}T12:00:00`);
      if (prevDate) {
        const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          running++;
        } else {
          running = 1;
        }
      } else {
        running = 1;
      }
      if (running > best) best = running;
      prevDate = d;
    }
    if (current > best) best = current;

    return { current, best };
  }

  function calculateConsistency(checkins: string[], currentToday: string): number {
    const set = new Set(checkins);
    const now = new Date(`${currentToday}T12:00:00`);
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (set.has(formatLocalDate(d))) count++;
    }
    return Math.round((count / 30) * 100);
  }

  function getGridDays(numWeeks: number, anchor: Date) {
    const now = new Date(anchor);
    now.setHours(12, 0, 0, 0);
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - currentDayOfWeek));

    const totalDays = numWeeks * 7;
    const days = [];
    const todayFormatted = formatLocalDate(now);

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(endOfWeek);
      d.setDate(endOfWeek.getDate() - i);
      const dateStr = formatLocalDate(d);
      const isToday = dateStr === todayFormatted;
      const isFuture = d > now;
      const dayNum = d.getDate();
      days.push({ date: dateStr, dayNum, isToday, isFuture });
    }
    return days;
  }

  function toggleDay(dateStr: string): void {
    if (!activeHabit) return;
    const existing = new Set(activeHabit.checkins);
    if (existing.has(dateStr)) {
      existing.delete(dateStr);
    } else {
      existing.add(dateStr);
    }
    activeHabit.checkins = Array.from(existing).sort();
  }

  function toggleToday(): void {
    toggleDay(todayStr);
  }

  function selectHabit(id: string): void {
    store.current.selectedId = id;
  }

  function openAdd(): void {
    newName = "";
    newColor = "cyan";
    isAdding = true;
  }

  function saveNewHabit(): void {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id = `h-${Date.now()}`;
    const newHabit: Habit = {
      id,
      name: trimmed,
      color: newColor,
      createdAt: todayStr,
      checkins: [todayStr],
    };
    store.current.habits.push(newHabit);
    store.current.selectedId = id;
    isAdding = false;
  }

  function openEdit(): void {
    if (!activeHabit) return;
    editName = activeHabit.name;
    editColor = activeHabit.color;
    isEditing = true;
  }

  function saveEdit(): void {
    if (!activeHabit) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    activeHabit.name = trimmed;
    activeHabit.color = editColor;
    isEditing = false;
  }

  function removeActiveHabit(): void {
    if (!activeHabit) return;
    if (store.current.habits.length <= 1) return;
    const id = activeHabit.id;
    store.current.habits = store.current.habits.filter((h) => h.id !== id);
    store.current.selectedId = store.current.habits[0]?.id ?? "";
    isEditing = false;
  }

  function formatDayLabel(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString("en", { month: "short", day: "numeric", weekday: "short" });
  }
</script>

<main class="pocket-shell" data-tone={activeHabit?.color ?? "amber"} data-slop-selection="none">
  <!-- Pocket gadget crown & hardware details -->
  <header class="chassis-header">
    <div class="brand-row">
      <span class="device-screw" aria-hidden="true"></span>
      <div class="speaker-grill" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <span class="device-screw" aria-hidden="true"></span>
    </div>

    <!-- Habit selection tabs -->
    <nav class="habit-tabs" aria-label="Habit tabs">
      {#each store.current.habits as habit (habit.id)}
        <button
          type="button"
          class="habit-tab"
          class:active={activeHabit?.id === habit.id}
          data-tab-tone={habit.color}
          onclick={() => selectHabit(habit.id)}
          aria-label={`Select ${habit.name}`}
        >
          <span class="tab-pip" aria-hidden="true"></span>
          <span class="tab-name">{habit.name}</span>
        </button>
      {/each}

      <button
        type="button"
        class="add-habit-btn"
        data-slop-export="hide"
        onclick={openAdd}
        title="Add new habit"
        aria-label="Add new habit"
      >
        <Plus size={14} />
      </button>
    </nav>
  </header>

  <!-- Inset LCD Screen well -->
  <section class="lcd-well">
    <!-- Readout Banner -->
    <div class="lcd-head">
      <div class="habit-title-row">
        <div class="title-wrap">
          <span class="lcd-category">TRACKER · DAILY ROUTINE</span>
          <h1 class="habit-title">{activeHabit?.name ?? "No habit selected"}</h1>
        </div>
        {#if activeHabit}
          <button
            type="button"
            class="edit-habit-btn"
            data-slop-export="hide"
            onclick={openEdit}
            title="Edit habit settings"
            aria-label="Edit habit settings"
          >
            Settings
          </button>
        {/if}
      </div>

      <!-- Action & Metrics Dashboard -->
      <div class="punch-and-stats">
        <!-- Big Tactile Today Punch Button -->
        <button
          type="button"
          class="today-punch-button"
          class:completed={isTodayCompleted}
          onclick={toggleToday}
          aria-label={isTodayCompleted ? "Mark today incomplete" : "Mark today complete"}
        >
          <div class="punch-icon-circle">
            {#if isTodayCompleted}
              <Check size={26} strokeWidth={3.5} />
            {:else}
              <span class="punch-uncheck-ring" aria-hidden="true"></span>
            {/if}
          </div>
          <div class="punch-text">
            <span class="punch-sub">{todayStr} · TODAY</span>
            <strong class="punch-main">{isTodayCompleted ? "COMPLETED ✓" : "PUNCH IN"}</strong>
          </div>
        </button>

        <!-- Stats Cluster -->
        <div class="stats-cluster">
          <div class="stat-pill streak-pill">
            <div class="stat-icon-wrap"><Flame size={15} /></div>
            <div class="stat-details">
              <span class="stat-label">CURRENT</span>
              <strong class="stat-value">{streaks.current} <small>DAYS</small></strong>
            </div>
          </div>

          <div class="stat-pill">
            <div class="stat-icon-wrap"><Trophy size={14} /></div>
            <div class="stat-details">
              <span class="stat-label">RECORD</span>
              <strong class="stat-value">{streaks.best} <small>DAYS</small></strong>
            </div>
          </div>

          <div class="stat-pill">
            <div class="stat-icon-wrap"><Sparkles size={14} /></div>
            <div class="stat-details">
              <span class="stat-label">30D RATE</span>
              <strong class="stat-value">{consistencyRate}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Circular Check-In Matrix Grid -->
    <div class="matrix-container" aria-label="Habit check-in history">
      <div class="matrix-header">
        <span class="matrix-title">7-WEEK CHECK-IN MATRIX ({totalCompletions} TOTAL)</span>
        <div class="matrix-legend">
          <span class="legend-item"><i class="sample-circle on" aria-hidden="true"></i> Done</span>
          <span class="legend-item"><i class="sample-circle" aria-hidden="true"></i> Open</span>
        </div>
      </div>

      <!-- Weekday column labels -->
      <div class="weekday-labels" aria-hidden="true">
        <span>MON</span>
        <span>TUE</span>
        <span>WED</span>
        <span>THU</span>
        <span>FRI</span>
        <span>SAT</span>
        <span>SUN</span>
      </div>

      <!-- Circular Cells Grid -->
      <div class="bubble-grid" role="grid" aria-label="Calendar check-in days">
        {#each calendarDays as cell (cell.date)}
          {@const checked = checkinsSet.has(cell.date)}
          <button
            type="button"
            class="bubble-cell"
            class:checked
            class:today={cell.isToday}
            class:future={cell.isFuture}
            disabled={cell.isFuture}
            onclick={() => toggleDay(cell.date)}
            title={`${formatDayLabel(cell.date)}: ${checked ? "Completed" : "Not completed"}`}
            aria-label={`${formatDayLabel(cell.date)} ${checked ? "Completed" : "Incomplete"}`}
          >
            {#if checked}
              <Check size={14} strokeWidth={3} />
            {:else}
              <span class="cell-num">{cell.dayNum}</span>
            {/if}
            {#if cell.isToday}
              <span class="today-marker" aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- Bottom Overview Rail: Check off all habits for today in 1 tap -->
  <footer class="overview-rail">
    <div class="rail-header">
      <span class="rail-caption">ALL HABITS FOR TODAY</span>
      <span class="rail-date">{todayStr}</span>
    </div>
    <div class="rail-list">
      {#each store.current.habits as habit (habit.id)}
        {@const doneToday = habit.checkins.includes(todayStr)}
        <div class="rail-habit-chip" data-chip-tone={habit.color}>
          <button
            type="button"
            class="chip-toggle"
            class:done={doneToday}
            onclick={() => {
              const s = new Set(habit.checkins);
              if (s.has(todayStr)) s.delete(todayStr);
              else s.add(todayStr);
              habit.checkins = Array.from(s).sort();
            }}
            aria-label={`${habit.name}: ${doneToday ? "done today" : "mark done today"}`}
          >
            {#if doneToday}
              <Check size={13} strokeWidth={3.5} />
            {/if}
          </button>
          <button
            type="button"
            class="chip-name-btn"
            onclick={() => selectHabit(habit.id)}
            title="Inspect this habit"
          >
            {habit.name}
          </button>
        </div>
      {/each}
    </div>
  </footer>

  <!-- Modal / Dialog for Adding a Habit -->
  <Dialog.Root bind:open={isAdding}>
    <Dialog.Portal>
      <Dialog.Overlay class="modal-backdrop" data-slop-export="hide" />
      <Dialog.Content class="modal-card" aria-labelledby="add-modal-title" data-slop-export="hide">
        <div class="modal-head">
          <Dialog.Title id="add-modal-title"><h2>New Habit Track</h2></Dialog.Title>
          <Dialog.Close class="modal-close" aria-label="Close dialog"><X size={16} /></Dialog.Close>
        </div>
        <form onsubmit={(e) => { e.preventDefault(); saveNewHabit(); }}>
          <label class="form-field">
            <span>HABIT NAME</span>
            <input bind:value={newName} placeholder="e.g. Read 20 pages" required />
          </label>
          <div class="form-field">
            <span>ACCENT COLOR</span>
            <div class="color-picker-row">
              {#each COLOR_OPTIONS as opt}
                <button
                  type="button"
                  class="color-choice"
                  class:selected={newColor === opt.tone}
                  data-choice-tone={opt.tone}
                  onclick={() => { newColor = opt.tone; }}
                  aria-label={opt.label}
                ></button>
              {/each}
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => { isAdding = false; }}>Cancel</button>
            <button type="submit" class="btn-primary">Add Habit</button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>

  <!-- Modal / Dialog for Editing Habit -->
  <Dialog.Root open={isEditing && !!activeHabit} onOpenChange={(open) => { if (!open) isEditing = false; }}>
    <Dialog.Portal>
      <Dialog.Overlay class="modal-backdrop" data-slop-export="hide" />
      <Dialog.Content class="modal-card" aria-labelledby="edit-modal-title" data-slop-export="hide">
        <div class="modal-head">
          <Dialog.Title id="edit-modal-title"><h2>Edit Habit Settings</h2></Dialog.Title>
          <Dialog.Close class="modal-close" aria-label="Close dialog"><X size={16} /></Dialog.Close>
        </div>
        <form onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <label class="form-field">
            <span>HABIT NAME</span>
            <input bind:value={editName} required />
          </label>
          <div class="form-field">
            <span>ACCENT COLOR</span>
            <div class="color-picker-row">
              {#each COLOR_OPTIONS as opt}
                <button
                  type="button"
                  class="color-choice"
                  class:selected={editColor === opt.tone}
                  data-choice-tone={opt.tone}
                  onclick={() => { editColor = opt.tone; }}
                  aria-label={opt.label}
                ></button>
              {/each}
            </div>
          </div>
          <div class="modal-actions">
            {#if store.current.habits.length > 1}
              <button type="button" class="btn-danger" onclick={removeActiveHabit} title="Delete habit">
                <Trash2 size={14} /> Delete
              </button>
            {/if}
            <div class="spacer"></div>
            <button type="button" class="btn-secondary" onclick={() => { isEditing = false; }}>Cancel</button>
            <button type="submit" class="btn-primary">Save Changes</button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
