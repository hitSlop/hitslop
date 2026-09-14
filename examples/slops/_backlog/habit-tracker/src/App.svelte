<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick } from "svelte";
  import { Spring, prefersReducedMotion } from "svelte/motion";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Flame from "@lucide/svelte/icons/flame";
  import Trophy from "@lucide/svelte/icons/trophy";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import X from "@lucide/svelte/icons/x";
  import { Dialog, Checkbox, RadioGroup, Button } from "bits-ui";
  import habitSchema from "../schema";
  import type { HabitTracker } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

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
  type Habit = HabitTracker["habits"][number];

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
  const COLOR_TONES = new Set<string>(COLOR_OPTIONS.map(opt => opt.tone));

  function isColorTone(value: string): value is ColorTone {
    return COLOR_TONES.has(value);
  }

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

  const store = jsonStore({
    schema: habitSchema,
    initial: {
      selectedId: "h-water",
      habits: initialHabits,
    },
  });

  let isAdding = $state(false);
  let newName = $state("");
  let newColor = $state<ColorTone>("cyan");
  let isEditing = $state(false);
  let editName = $state("");
  let editColor = $state<ColorTone>("cyan");

  const punchScale = new Spring(1, { stiffness: 0.28, damping: 0.54 });
  $effect(() => { if (store.isReady) ready(); });
  onMount(() => capture.onPrepare(async () => {
    await punchScale.set(1, { instant: true });
    await tick();
  }));
  onDestroy(() => {
    punchScale.set(1, { instant: true });
    store.destroy();
  });

  const activeHabit = $derived.by(() => {
    const list = store.current.habits;
    if (list.length === 0) return null;
    return list.find((h) => h.id === store.current.selectedId) ?? list[0];
  });

  const checkinsSet = $derived(new Set(activeHabit?.checkins ?? []));
  const isTodayCompleted = $derived(checkinsSet.has(todayStr));
  const streaks = $derived.by(() => {
    if (!activeHabit) return { current: 0, best: 0 };
    return calculateStreaks(activeHabit.checkins, todayStr);
  });
  const consistencyRate = $derived.by(() => {
    if (!activeHabit) return 0;
    return calculateConsistency(activeHabit.checkins, todayStr);
  });
  const totalCompletions = $derived(activeHabit?.checkins.length ?? 0);
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
        running = diffDays === 1 ? running + 1 : 1;
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
    const currentDayOfWeek = (now.getDay() + 6) % 7;
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - currentDayOfWeek));

    const totalDays = numWeeks * 7;
    const days = [];
    const todayFormatted = formatLocalDate(now);

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(endOfWeek);
      d.setDate(endOfWeek.getDate() - i);
      const dateStr = formatLocalDate(d);
      days.push({
        date: dateStr,
        dayNum: d.getDate(),
        isToday: dateStr === todayFormatted,
        isFuture: d > now,
      });
    }
    return days;
  }

  function setDay(dateStr: string, next: boolean): void {
    if (!activeHabit) return;
    const existing = new Set(activeHabit.checkins);
    if (next) existing.add(dateStr);
    else existing.delete(dateStr);
    activeHabit.checkins = Array.from(existing).sort();
  }

  function punchToday(next: boolean): void {
    setDay(todayStr, next);
    if (prefersReducedMotion.current) {
      punchScale.set(1, { instant: true });
      return;
    }
    void punchScale.set(0.94).then(() => punchScale.set(1));
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
    if (!trimmed || store.isLoading) return;
    const id = crypto.randomUUID();
    store.current.habits.push({
      id,
      name: trimmed,
      color: newColor,
      createdAt: todayStr,
      checkins: [todayStr],
    });
    store.current.selectedId = id;
    isAdding = false;
  }

  function openEdit(): void {
    if (!activeHabit) return;
    editName = activeHabit.name;
    editColor = isColorTone(activeHabit.color) ? activeHabit.color : "cyan";
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

  function setHabitToday(habit: Habit, next: boolean): void {
    const dates = new Set(habit.checkins);
    if (next) dates.add(todayStr);
    else dates.delete(todayStr);
    habit.checkins = Array.from(dates).sort();
  }
</script>

<main
  class={s.pocketShell}
  data-tone={activeHabit?.color ?? "amber"}
  data-slop-selection="none"
  aria-busy={store.isLoading}
  aria-label="Habit tracker"
>
  <header class={s.chassisHeader}>
    <div class={s.brandRow}>
      <span class={s.deviceScrew} aria-hidden="true"></span>
      <div class={s.speakerGrill} aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <span class={s.deviceScrew} aria-hidden="true"></span>
    </div>

    <nav class={s.habitTabs} aria-label="Habit tabs">
      {#each store.current.habits as habit (habit.id)}
        <button
          type="button"
          class={s.habitTab}
          data-active={activeHabit?.id === habit.id}
          data-tab-tone={habit.color}
          onclick={() => selectHabit(habit.id)}
          aria-label={`Select ${habit.name}`}
        >
          <span class={s.tabPip} aria-hidden="true"></span>
          <span>{habit.name}</span>
        </button>
      {/each}

      <Button.Root
        type="button"
        class={s.addHabitBtn}
        data-slop-export="hide"
        onclick={openAdd}
        title="Add new habit"
        aria-label="Add new habit"
      >
        <Plus size={14} />
      </Button.Root>
    </nav>
  </header>

  <section class={s.lcdWell} inert={!store.isReady || store.isLoading}>
    <div class={s.lcdHead}>
      <div class={s.habitTitleRow}>
        <div class={s.titleWrap}>
          <span class={s.lcdCategory}>TRACKER · DAILY ROUTINE</span>
          <h1 class={s.habitTitle}>{activeHabit?.name ?? "No habit selected"}</h1>
        </div>
        {#if activeHabit}
          <Button.Root
            type="button"
            class={s.editHabitBtn}
            data-slop-export="hide"
            onclick={openEdit}
            title="Edit habit settings"
            aria-label="Edit habit settings"
          >
            Settings
          </Button.Root>
        {/if}
      </div>

      <div class={s.punchAndStats}>
        <Checkbox.Root
          class={s.todayPunch}
          style="transform: scale({punchScale.current})"
          checked={isTodayCompleted}
          disabled={!activeHabit}
          onCheckedChange={(next) => punchToday(next === true)}
          aria-label={isTodayCompleted ? "Mark today incomplete" : "Mark today complete"}
        >
          {#snippet children({ checked })}
            <div class={s.punchIconCircle}>
              {#if checked}
                <Check size={26} strokeWidth={3.5} />
              {:else}
                <span class={s.punchUncheckRing} aria-hidden="true"></span>
              {/if}
            </div>
            <div class={s.punchText}>
              <span class={s.punchSub}>{todayStr} · TODAY</span>
              <strong class={s.punchMain}>{checked ? "COMPLETED ✓" : "PUNCH IN"}</strong>
            </div>
          {/snippet}
        </Checkbox.Root>

        <div class={s.statsCluster}>
          <div class={`${s.statPill} ${s.streakPill}`}>
            <div class={s.statIconWrap}><Flame size={15} /></div>
            <div class={s.statDetails}>
              <span class={s.statLabel}>CURRENT</span>
              <strong class={s.statValue}>{streaks.current} <small>DAYS</small></strong>
            </div>
          </div>

          <div class={s.statPill}>
            <div class={s.statIconWrap}><Trophy size={14} /></div>
            <div class={s.statDetails}>
              <span class={s.statLabel}>RECORD</span>
              <strong class={s.statValue}>{streaks.best} <small>DAYS</small></strong>
            </div>
          </div>

          <div class={s.statPill}>
            <div class={s.statIconWrap}><Sparkles size={14} /></div>
            <div class={s.statDetails}>
              <span class={s.statLabel}>30D RATE</span>
              <strong class={s.statValue}>{consistencyRate}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class={s.matrixContainer} aria-label="Habit check-in history">
      <div class={s.matrixHeader}>
        <span>7-WEEK CHECK-IN MATRIX ({totalCompletions} TOTAL)</span>
        <div class={s.matrixLegend}>
          <span class={s.legendItem}><i class={s.sampleCircle} data-on="true" aria-hidden="true"></i> Done</span>
          <span class={s.legendItem}><i class={s.sampleCircle} aria-hidden="true"></i> Open</span>
        </div>
      </div>

      <div class={s.weekdayLabels} aria-hidden="true">
        <span>MON</span>
        <span>TUE</span>
        <span>WED</span>
        <span>THU</span>
        <span>FRI</span>
        <span>SAT</span>
        <span>SUN</span>
      </div>

      <div class={s.bubbleGrid} role="group" aria-label="Calendar check-in days">
        {#each calendarDays as cell (cell.date)}
          {@const on = checkinsSet.has(cell.date)}
          <Checkbox.Root
            class={s.bubbleCell}
            checked={on}
            disabled={cell.isFuture || !activeHabit}
            data-today={cell.isToday}
            data-future={cell.isFuture}
            onCheckedChange={(next) => setDay(cell.date, next === true)}
            title={`${formatDayLabel(cell.date)}: ${on ? "Completed" : "Not completed"}`}
            aria-label={`${formatDayLabel(cell.date)} ${on ? "Completed" : "Incomplete"}`}
          >
            {#snippet children({ checked })}
              {#if checked}
                <Check size={14} strokeWidth={3} />
              {:else}
                <span class={s.cellNum}>{cell.dayNum}</span>
              {/if}
              {#if cell.isToday}
                <span class={s.todayMarker} aria-hidden="true"></span>
              {/if}
            {/snippet}
          </Checkbox.Root>
        {/each}
      </div>
    </div>
  </section>

  <footer class={s.overviewRail}>
    <div class={s.railHeader}>
      <span>ALL HABITS FOR TODAY</span>
      <span>{todayStr}</span>
    </div>
    <div class={s.railList}>
      {#each store.current.habits as habit (habit.id)}
        {@const doneToday = habit.checkins.includes(todayStr)}
        <div class={s.railHabitChip} data-chip-tone={habit.color}>
          <Checkbox.Root
            class={s.chipToggle}
            checked={doneToday}
            onCheckedChange={(next) => setHabitToday(habit, next === true)}
            aria-label={`${habit.name}: ${doneToday ? "done today" : "mark done today"}`}
          >
            {#snippet children({ checked })}
              {#if checked}
                <Check size={13} strokeWidth={3.5} />
              {/if}
            {/snippet}
          </Checkbox.Root>
          <button
            type="button"
            class={s.chipNameBtn}
            onclick={() => selectHabit(habit.id)}
            title="Inspect this habit"
          >
            {habit.name}
          </button>
        </div>
      {/each}
    </div>
  </footer>

  {#if store.error}
    <div class={s.error} role="alert">
      <span>{store.isReady ? "Changes haven’t been saved." : "Your habits couldn’t be loaded."} {store.error}</span>
      <Button.Root type="button" data-slop-export="hide" onclick={() => { if (store.isReady) void store.flush().catch(() => undefined); else void store.reload(); }}>Try again</Button.Root>
    </div>
  {:else if store.isLoading}
    <p class={s.error} role="status">Loading your habits…</p>
  {/if}

  <Dialog.Root bind:open={isAdding}>
    <Dialog.Portal>
      <Dialog.Overlay data-slop-export="hide" />
      <Dialog.Content class={s.modalCard} aria-labelledby="add-modal-title" data-slop-export="hide">
        <div class={s.modalHead}>
          <Dialog.Title id="add-modal-title"><h2>New Habit Track</h2></Dialog.Title>
          <Dialog.Close class={s.modalClose} aria-label="Close dialog"><X size={16} /></Dialog.Close>
        </div>
        <form onsubmit={(e) => { e.preventDefault(); saveNewHabit(); }}>
          <label class={s.formField}>
            <span>HABIT NAME</span>
            <input bind:value={newName} placeholder="e.g. Read 20 pages" required />
          </label>
          <div class={s.formField}>
            <span>ACCENT COLOR</span>
            <RadioGroup.Root
              class={s.colorPickerRow}
              orientation="horizontal"
              value={newColor}
              onValueChange={(value) => { if (isColorTone(value)) newColor = value; }}
              aria-label="Accent color"
            >
              {#each COLOR_OPTIONS as opt (opt.tone)}
                <RadioGroup.Item
                  value={opt.tone}
                  class={s.colorChoice}
                  data-choice-tone={opt.tone}
                  aria-label={opt.label}
                />
              {/each}
            </RadioGroup.Root>
          </div>
          <div class={s.modalActions}>
            <Button.Root type="button" class={s.btnSecondary} onclick={() => { isAdding = false; }}>Cancel</Button.Root>
            <Button.Root type="submit" class={s.btnPrimary}>Add Habit</Button.Root>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>

  <Dialog.Root open={isEditing && !!activeHabit} onOpenChange={(open) => { if (!open) isEditing = false; }}>
    <Dialog.Portal>
      <Dialog.Overlay data-slop-export="hide" />
      <Dialog.Content class={s.modalCard} aria-labelledby="edit-modal-title" data-slop-export="hide">
        <div class={s.modalHead}>
          <Dialog.Title id="edit-modal-title"><h2>Edit Habit Settings</h2></Dialog.Title>
          <Dialog.Close class={s.modalClose} aria-label="Close dialog"><X size={16} /></Dialog.Close>
        </div>
        <form onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <label class={s.formField}>
            <span>HABIT NAME</span>
            <input bind:value={editName} required />
          </label>
          <div class={s.formField}>
            <span>ACCENT COLOR</span>
            <RadioGroup.Root
              class={s.colorPickerRow}
              orientation="horizontal"
              value={editColor}
              onValueChange={(value) => { if (isColorTone(value)) editColor = value; }}
              aria-label="Accent color"
            >
              {#each COLOR_OPTIONS as opt (opt.tone)}
                <RadioGroup.Item
                  value={opt.tone}
                  class={s.colorChoice}
                  data-choice-tone={opt.tone}
                  aria-label={opt.label}
                />
              {/each}
            </RadioGroup.Root>
          </div>
          <div class={s.modalActions}>
            {#if store.current.habits.length > 1}
              <Button.Root type="button" class={s.btnDanger} onclick={removeActiveHabit} title="Delete habit">
                <Trash2 size={14} /> Delete
              </Button.Root>
            {/if}
            <div class={s.spacer}></div>
            <Button.Root type="button" class={s.btnSecondary} onclick={() => { isEditing = false; }}>Cancel</Button.Root>
            <Button.Root type="submit" class={s.btnPrimary}>Save Changes</Button.Root>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

<IconTarget><Icon streak={streaks.current} rate={consistencyRate} /></IconTarget>
<ExportTarget>
  <Export
    data={store.current}
    todayStr={todayStr}
    calendarDays={calendarDays}
    currentStreak={streaks.current}
    bestStreak={streaks.best}
    consistencyRate={consistencyRate}
  />
</ExportTarget>
