<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Checkbox } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import sheetSchema from "../schema";
  import type { Theme } from "../schema";
  import { CELLS, formatDeadline, keyOf, nextOctober, ringIndex } from "./chart";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const THEMES: Theme[] = [
    { title: "Endurance", cells: ["Long run every Sunday", "Build up to 32 km", "Keep the easy pace easy", "Five running days a week", "One hilly route a week", "Log every kilometre", "Practise race pace late", "Never skip two days"] },
    { title: "Speed", cells: ["Track intervals on Tuesday", "Eight by 800 m", "Tempo run on Thursday", "Strides after easy runs", "Learn to pace by feel", "A parkrun each month", "Hill sprints through winter", "Sharpen in the final month"] },
    { title: "Strength", cells: ["Squats twice a week", "Single-leg work", "Core before bed", "Calf raises daily", "Glute bridges", "Keep lifting through taper", "Ten minutes is enough", "Film my form monthly"] },
    { title: "Fuel", cells: ["Rehearse race gels", "Carbs the night before", "Drink before thirst", "Iron-rich meals", "No new food on race week", "Breakfast three hours out", "Electrolytes on long runs", "Eat within the hour after"] },
    { title: "Recovery", cells: ["Eight hours of sleep", "A rest day is training", "Foam roll after long runs", "Massage once a month", "Easy week every fourth", "Stretch hips nightly", "Ice a niggle early", "See the physio at first pain"] },
    { title: "Kit", cells: ["Rotate two pairs of shoes", "Replace them at 700 km", "Break in the race shoes", "Test kit on long runs", "Anti-chafe everywhere", "Charge the watch on Saturday", "Lay it all out the night before", "Carry one spare gel"] },
    { title: "Mind", cells: ["Write down the why", "Visualise the last 10 km", "A mantra for the wall", "Race the plan, not the crowd", "Accept the bad runs", "Mark the small wins", "Tell people the goal", "Read a race report weekly"] },
    { title: "Logistics", cells: ["Enter the race early", "Book travel by June", "Walk the start area", "Put the taper on a calendar", "Arrange the bag drop", "Share the schedule at home", "Print a pace band", "Sort out food for after"] },
  ];

  const sheet = jsonStore({ schema: sheetSchema, initial: {
    goal: "Run my first marathon under four hours",
    deadline: nextOctober(),
    themes: THEMES,
    done: { "0:0": true, "0:3": true, "0:5": true, "2:2": true, "4:0": true, "4:1": true, "6:0": true, "7:0": true, "7:1": true },
  } });
  $effect(() => { if (sheet.isReady) ready(); });
  onDestroy(() => sheet.destroy());

  const doneCount = $derived(Object.values(sheet.current.done).filter(Boolean).length);
  const deadlineLabel = $derived(formatDeadline(sheet.current.deadline));
  const namedThemes = $derived(sheet.current.themes.filter(theme => theme.title.trim()).length);
  const writtenActions = $derived(sheet.current.themes.reduce((count, theme) => count + theme.cells.filter(cell => cell.trim()).length, 0));
  const guide = $derived(
    !sheet.current.goal.trim() ? "Write the one goal in the centre."
    : namedThemes < 8 ? "Name the eight themes that ring it."
    : writtenActions < 8 ? "Give each theme eight concrete actions."
    : "",
  );

  let canvasEl = $state<HTMLElement | null>(null);
  let canvasWidth = $state(9999);
  let focused = $state(4);
  const zoomed = $derived(canvasWidth < 560);
  const blockLabel = $derived(focused === 4 ? "The goal and its eight themes" : titleOf(ringIndex(Math.floor(focused / 3), focused % 3)));

  $effect(() => {
    const element = canvasEl;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { canvasWidth = entry?.contentRect.width ?? 9999; });
    observer.observe(element);
    return () => observer.disconnect();
  });

  function isDone(theme: number, action: number): boolean {
    return sheet.current.done[keyOf(theme, action)] === true;
  }
  function setDone(theme: number, action: number, done: boolean): void {
    const key = keyOf(theme, action);
    if (done) sheet.current.done[key] = true;
    else delete sheet.current.done[key];
  }
  function titleOf(theme: number): string {
    return sheet.current.themes[theme]?.title.trim() || `Theme ${theme + 1}`;
  }
</script>

<main class={s.canvas} data-slop-selection="none" bind:this={canvasEl} aria-busy={sheet.isLoading} aria-label="Open Window 64 chart">
  <article class={s.page} inert={!sheet.isReady || sheet.isLoading}>
    <header class={s.masthead}>
      <div class={s.crest} aria-hidden="true"></div>
      <div>
        <p class={s.wordmark}>Open Window 64</p>
        <h1 class={s.title}>Harada Method</h1>
      </div>
      <label class={s.target}>
        <span>Target</span>
        <input type="date" aria-label="Target date" bind:value={sheet.current.deadline} />
        <em class={s.targetNote}>{deadlineLabel}</em>
      </label>
      <div class={s.tally}>
        <p class={s.tallyCount}><b>{doneCount}</b><small>/ 64</small></p>
        <div class={s.tallyBar} aria-hidden="true"><span class={s.tallyFill} style:width={`${(doneCount / 64) * 100}%`}></span></div>
        <p class={s.tallyLabel}>Actions taken</p>
      </div>
    </header>

    {#if guide}
      <p class={s.guide} data-slop-export="hide">{guide}</p>
    {/if}

    {#if zoomed}
      <nav class={s.zoomBar} data-slop-export="hide" aria-label="Choose a block">
        {#each { length: 9 } as _, block (block)}
          <button type="button" class={s.zoomKey} data-on={focused === block} aria-pressed={focused === block} onclick={() => { focused = block; }}>
            {block === 4 ? "Goal" : titleOf(ringIndex(Math.floor(block / 3), block % 3))}
          </button>
        {/each}
      </nav>
      <p class={s.zoomTitle} data-slop-export="hide">{blockLabel}</p>
    {/if}

    <div class={s.sheet} data-zoom={zoomed ? "on" : "off"}>
      {#each CELLS as cell (cell.row * 9 + cell.col)}
        <div
          class={`${s.cell} ${zoomed && cell.block !== focused ? s.cellAway : ""}`}
          data-role={cell.role}
          data-x={cell.edgeX}
          data-y={cell.edgeY}
          data-done={cell.role === "action" && isDone(cell.theme, cell.action)}
        >
          {#if cell.role === "goal"}
            <textarea class={s.write} aria-label="Core goal" placeholder="The one goal" bind:value={sheet.current.goal}></textarea>
          {:else if cell.role === "theme"}
            <textarea class={s.write} aria-label="Theme {cell.theme + 1}" placeholder="Theme {cell.theme + 1}" bind:value={sheet.current.themes[cell.theme].title}></textarea>
          {:else}
            <textarea class={s.write} aria-label="{titleOf(cell.theme)}, action {cell.action + 1}" placeholder="—" bind:value={sheet.current.themes[cell.theme].cells[cell.action]}></textarea>
            <Checkbox.Root
              class={s.tick}
              checked={isDone(cell.theme, cell.action)}
              onCheckedChange={checked => setDone(cell.theme, cell.action, checked === true)}
              aria-label="Mark done: {titleOf(cell.theme)}, action {cell.action + 1}"
            >
              {#snippet children({ checked })}{#if checked}<Check size={8} strokeWidth={3} />{/if}{/snippet}
            </Checkbox.Root>
          {/if}
        </div>
      {/each}
    </div>

    {#if sheet.error}
      <p class={s.error} role="alert" data-slop-export="hide">
        {sheet.isReady ? "Your latest changes couldn’t be saved." : "The chart couldn’t be loaded."}
        <button type="button" onclick={() => { if (sheet.isReady) void sheet.flush().catch(() => undefined); else void sheet.reload(); }}>Try again</button>
      </p>
    {/if}
  </article>
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={sheet.current} /></ExportTarget>
