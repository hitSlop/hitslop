<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Flame from "@lucide/svelte/icons/flame";
  import Trophy from "@lucide/svelte/icons/trophy";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import type { HabitTracker } from "../schema";
  import * as s from "./styles.css";

  type CalendarDay = { date: string; dayNum: number; isToday: boolean; isFuture: boolean };

  let {
    data,
    todayStr,
    calendarDays,
    currentStreak,
    bestStreak,
    consistencyRate,
  }: {
    data: HabitTracker;
    todayStr: string;
    calendarDays: CalendarDay[];
    currentStreak: number;
    bestStreak: number;
    consistencyRate: number;
  } = $props();

  const activeHabit = $derived(data.habits.find((habit) => habit.id === data.selectedId) ?? data.habits[0] ?? null);
  const checkinsSet = $derived(new Set(activeHabit?.checkins ?? []));
  const isTodayCompleted = $derived(checkinsSet.has(todayStr));
  const totalCompletions = $derived(activeHabit?.checkins.length ?? 0);
</script>

<article class={s.exportPocket} data-tone={activeHabit?.color ?? "amber"} aria-label="Exported habit tracker">
  <header class={s.chassisHeader}>
    <div class={s.brandRow}>
      <span class={s.deviceScrew} aria-hidden="true"></span>
      <div class={s.speakerGrill} aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <span class={s.deviceScrew} aria-hidden="true"></span>
    </div>
    <nav class={s.habitTabs} aria-label="Habits">
      {#each data.habits as habit (habit.id)}
        <span class={s.habitTab} data-active={activeHabit?.id === habit.id} data-tab-tone={habit.color}>
          <span class={s.tabPip} aria-hidden="true"></span>
          <span>{habit.name}</span>
        </span>
      {/each}
    </nav>
  </header>

  <section class={s.lcdWell}>
    <div class={s.lcdHead}>
      <div class={s.habitTitleRow}>
        <div class={s.titleWrap}>
          <span class={s.lcdCategory}>TRACKER · DAILY ROUTINE</span>
          <h1 class={s.habitTitle}>{activeHabit?.name ?? "No habit selected"}</h1>
        </div>
      </div>
      <div class={s.punchAndStats}>
        <div class={s.todayPunch} data-checkbox-root data-state={isTodayCompleted ? "checked" : "unchecked"}>
          <div class={s.punchIconCircle}>
            {#if isTodayCompleted}
              <Check size={26} strokeWidth={3.5} />
            {:else}
              <span class={s.punchUncheckRing} aria-hidden="true"></span>
            {/if}
          </div>
          <div class={s.punchText}>
            <span class={s.punchSub}>{todayStr} · TODAY</span>
            <strong class={s.punchMain}>{isTodayCompleted ? "COMPLETED ✓" : "OPEN"}</strong>
          </div>
        </div>
        <div class={s.statsCluster}>
          <div class={`${s.statPill} ${s.streakPill}`}>
            <div class={s.statIconWrap}><Flame size={15} /></div>
            <div class={s.statDetails}>
              <span class={s.statLabel}>CURRENT</span>
              <strong class={s.statValue}>{currentStreak} <small>DAYS</small></strong>
            </div>
          </div>
          <div class={s.statPill}>
            <div class={s.statIconWrap}><Trophy size={14} /></div>
            <div class={s.statDetails}>
              <span class={s.statLabel}>RECORD</span>
              <strong class={s.statValue}>{bestStreak} <small>DAYS</small></strong>
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
        <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
      </div>
      <div class={s.bubbleGrid} aria-hidden="true">
        {#each calendarDays as cell (cell.date)}
          {@const checked = checkinsSet.has(cell.date)}
          <span
            class={s.bubbleCell}
            data-checkbox-root
            data-state={checked ? "checked" : "unchecked"}
            data-today={cell.isToday}
            data-future={cell.isFuture}
          >
            {#if checked}
              <Check size={14} strokeWidth={3} />
            {:else}
              <span class={s.cellNum}>{cell.dayNum}</span>
            {/if}
            {#if cell.isToday}
              <span class={s.todayMarker}></span>
            {/if}
          </span>
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
      {#each data.habits as habit (habit.id)}
        {@const doneToday = habit.checkins.includes(todayStr)}
        <div class={s.railHabitChip} data-chip-tone={habit.color}>
          <span class={s.chipToggle} data-checkbox-root data-state={doneToday ? "checked" : "unchecked"}>
            {#if doneToday}<Check size={13} strokeWidth={3.5} />{/if}
          </span>
          <span class={s.chipNameBtn}>{habit.name}</span>
        </div>
      {/each}
    </div>
  </footer>
</article>
