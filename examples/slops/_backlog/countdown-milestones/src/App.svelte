<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import { Calendar, Checkbox, Dialog, Popover, Progress } from "bits-ui";
  import { CalendarDate, getLocalTimeZone, today as getTodayDate, type DateValue } from "@internationalized/date";
  import { onDestroy } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import CalendarDays from "@lucide/svelte/icons/calendar-days";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import countdownSchema from "../schema";
  import Icon from "./Icon.svelte";

  function isoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const today = new Date();
  const defaultTarget = new Date(today.getFullYear(), today.getMonth() + 3, 12);

  const countdown = jsonStore({
    schema: countdownSchema,
    initial: {
      title: "Launch day",
      createdAt: isoDate(today),
      targetDate: isoDate(defaultTarget),
      targetTime: "09:00",
      milestones: [
        { id: "brief", title: "Lock the brief", done: true },
        { id: "prototype", title: "Test the prototype", done: false },
        { id: "launch", title: "Clear the runway", done: false },
      ],
    },
  });

  let now = $state(Date.now());
  let editing = $state(false);
  let milestoneTitle = $state("");
  let justCompleted = $state<string | null>(null);
  let celebrationTimer: ReturnType<typeof setTimeout> | null = null;
  const ticker = setInterval(() => { now = Date.now(); }, 1000);

  const targetMs = $derived(new Date(`${countdown.current.targetDate}T${countdown.current.targetTime}:00`).getTime());
  const remainingSeconds = $derived(Math.max(0, Math.floor((targetMs - now) / 1000)));
  const days = $derived(Math.floor(remainingSeconds / 86400));
  const hours = $derived(Math.floor((remainingSeconds % 86400) / 3600));
  const minutes = $derived(Math.floor((remainingSeconds % 3600) / 60));
  const finished = $derived(remainingSeconds === 0);
  const totalDays = $derived(Math.max(1, Math.ceil((targetMs - new Date(`${countdown.current.createdAt}T00:00:00`).getTime()) / 86400000)));
  const remainingDays = $derived(Math.max(0, Math.ceil((targetMs - now) / 86400000)));
  const elapsed = $derived(Math.max(0, Math.min(100, Math.round((1 - remainingDays / totalDays) * 100))));
  const completed = $derived(countdown.current.milestones.filter((item) => item.done).length);
  const draftCalendarValue = $derived.by(() => {
    const [year, month, day] = countdown.current.targetDate.split("-").map(Number);
    try {
      return year && month && day ? new CalendarDate(year, month, day) : getTodayDate(getLocalTimeZone());
    } catch {
      return getTodayDate(getLocalTimeZone());
    }
  });

  function shortDate(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function longDate(value: string): string {
    const date = new Date(`${value}T${countdown.current.targetTime}:00`);
    return Number.isNaN(date.getTime()) ? "Choose a date" : new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
  }

  function openEditor(): void {
    editing = true;
  }

  function selectTargetDate(value: DateValue | undefined): void {
    if (!value) return;
    countdown.current = {
      ...countdown.current,
      targetDate: `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`,
    };
  }

  function addMilestone(): void {
    const title = milestoneTitle.trim();
    if (!title || countdown.current.milestones.length >= 25) return;
    countdown.current.milestones = [...countdown.current.milestones, {
      id: crypto.randomUUID(), title, done: false,
    }];
    milestoneTitle = "";
  }

  function addMilestoneFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addMilestone();
  }

  function setDone(id: string, checked: boolean): void {
    const item = countdown.current.milestones.find((entry) => entry.id === id);
    if (!item) return;
    item.done = checked;
    if (!checked) return;
    justCompleted = id;
    if (celebrationTimer) clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => { justCompleted = null; }, 700);
  }

  function removeMilestone(id: string): void {
    countdown.current.milestones = countdown.current.milestones.filter((item) => item.id !== id);
  }

  $effect(() => { if (!countdown.isLoading) ready(); });
  onDestroy(() => {
    clearInterval(ticker);
    if (celebrationTimer) clearTimeout(celebrationTimer);
    countdown.destroy();
  });
</script>

<main class="count-shell" data-finished={finished} data-slop-selection="none" aria-busy={countdown.isLoading}>
  <div class="orbit orbit-one" aria-hidden="true"></div>
  <div class="orbit orbit-two" aria-hidden="true"></div>
  <header class="instrument-head">
    <span>MISSION / M–01</span>
    <button class="edit-button" onclick={openEditor} aria-label="Edit countdown" data-slop-export="hide"><Pencil /></button>
  </header>

  <section class="count-stage" aria-label={`${days} days, ${hours} hours, and ${minutes} minutes until ${countdown.current.title}`}>
    <p>{finished ? "Touchdown" : "Next big thing"}</p>
    <h1>{countdown.current.title}</h1>
    <div class="day-readout">
      <strong>{finished ? "00" : String(days).padStart(2, "0")}</strong>
      <span>{finished ? "ready\nnow" : "days\nto go"}</span>
    </div>
    <div class="support-time" aria-hidden="true">
      <b>{String(hours).padStart(2, "0")}</b><span>hr</span><i></i><b>{String(minutes).padStart(2, "0")}</b><span>min</span>
    </div>
    <Progress.Root value={elapsed} max={100} class="progress-track" aria-label={`${elapsed}% of the countdown elapsed`}>
      <i style={`transform: translateX(-${100 - elapsed}%)`}></i>
    </Progress.Root>
    <div class="progress-label"><span>{shortDate(countdown.current.createdAt)}</span><b>{elapsed}% there</b><span>{shortDate(countdown.current.targetDate)}</span></div>
  </section>

  <section class="milestones" aria-label="Milestone runway">
    <div class="milestone-head"><span>Runway</span><strong>{completed}/{countdown.current.milestones.length} cleared</strong></div>
    <ol>
      {#each countdown.current.milestones as item, index (item.id)}
        <li data-done={item.done} data-celebrate={justCompleted === item.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <Checkbox.Root checked={item.done} onCheckedChange={(checked) => setDone(item.id, !!checked)} class="milestone-check" aria-label={`Mark ${item.title} ${item.done ? "incomplete" : "complete"}`}>
            {#snippet children({ checked })}{#if checked}<Check />{/if}{/snippet}
          </Checkbox.Root>
          <div><strong>{item.title}</strong></div>
          <button class="remove-button" onclick={() => removeMilestone(item.id)} aria-label={`Delete ${item.title}`} data-slop-export="hide"><Trash2 /></button>
        </li>
      {/each}
    </ol>
    {#if countdown.current.milestones.length === 0}<p class="milestone-empty">Your runway is wide open. Add the first checkpoint.</p>{/if}
    <div class="quick-add" data-slop-export="hide">
      <input bind:value={milestoneTitle} onkeydown={addMilestoneFromKeyboard} maxlength="120" placeholder="Add a checkpoint…" aria-label="New checkpoint" />
      <button onclick={addMilestone} disabled={!milestoneTitle.trim() || countdown.current.milestones.length >= 25} aria-label="Add checkpoint"><Plus /></button>
    </div>
  </section>

  <footer><span>Blast off</span><strong>{longDate(countdown.current.targetDate)}</strong><small>{countdown.current.targetTime}</small></footer>
  {#if countdown.error}<p class="count-error">The countdown could not be saved.</p>{/if}

  <Dialog.Root bind:open={editing}>
    <Dialog.Portal>
      <Dialog.Overlay class="count-overlay" />
      <Dialog.Content class="count-dialog">
        <p>Mission control</p><Dialog.Title>Set the countdown</Dialog.Title>
        <label>What are we waiting for?<input bind:value={countdown.current.title} maxlength="100" /></label>
        <div class="date-fields">
          <label>Target date
            <Popover.Root>
              <Popover.Trigger class="date-trigger" aria-label="Choose target date"><CalendarDays /><span>{longDate(countdown.current.targetDate)}</span></Popover.Trigger>
              <Popover.Portal>
                <Popover.Content class="calendar-popover" side="bottom" sideOffset={6} align="start">
                  <Calendar.Root type="single" value={draftCalendarValue} onValueChange={selectTargetDate}>
                    {#snippet children({ months, weekdays })}
                      <Calendar.Header class="calendar-head">
                        <Calendar.PrevButton class="calendar-nav" aria-label="Previous month"><ChevronLeft /></Calendar.PrevButton>
                        <Calendar.Heading />
                        <Calendar.NextButton class="calendar-nav" aria-label="Next month"><ChevronRight /></Calendar.NextButton>
                      </Calendar.Header>
                      {#each months as month}
                        <Calendar.Grid class="calendar-grid">
                          <Calendar.GridHead><Calendar.GridRow>{#each weekdays as day}<Calendar.HeadCell>{day.slice(0, 2)}</Calendar.HeadCell>{/each}</Calendar.GridRow></Calendar.GridHead>
                          <Calendar.GridBody>
                            {#each month.weeks as weekDates}
                              <Calendar.GridRow>{#each weekDates as date}<Calendar.Cell {date} month={month.value}><Calendar.Day /></Calendar.Cell>{/each}</Calendar.GridRow>
                            {/each}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                      {/each}
                    {/snippet}
                  </Calendar.Root>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </label>
          <label>Time<input type="time" bind:value={countdown.current.targetTime} /></label>
        </div>
        <div class="dialog-actions"><Dialog.Close class="done-button">Done</Dialog.Close></div>
        <Dialog.Close class="count-close" aria-label="Close"><X /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

{#if capture.isRenderer()}<Icon />{/if}
