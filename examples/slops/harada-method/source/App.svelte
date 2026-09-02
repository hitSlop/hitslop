<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";

  type Theme = { title: string; cells: string[] };
  type Sheet = { goal: string; deadline: string; themes: Theme[]; done: Record<string, boolean> };

  // The eight cells that ring a centre, in reading order. One list drives both the
  // placement of themes around the goal and the placement of blocks around the sheet,
  // which is what makes a theme sit in the same direction as the block it opens.
  const RING: readonly [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]];
  const ringIndex = (row: number, col: number): number => RING.findIndex(([r, c]) => r === row && c === col);

  type Cell = {
    row: number;
    col: number;
    block: number;
    role: "goal" | "theme" | "action";
    theme: number;
    action: number;
    edgeX: "none" | "hair" | "block";
    edgeY: "none" | "hair" | "block";
  };

  const CELLS: Cell[] = Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const blockRow = Math.floor(row / 3);
    const blockCol = Math.floor(col / 3);
    const localRow = row % 3;
    const localCol = col % 3;
    const block = blockRow * 3 + blockCol;
    const isCentreBlock = block === 4;
    const isCentreCell = localRow === 1 && localCol === 1;
    const edgeX = col === 8 ? "none" : localCol === 2 ? "block" : "hair";
    const edgeY = row === 8 ? "none" : localRow === 2 ? "block" : "hair";
    const base = { row, col, block, edgeX, edgeY } as const;
    if (isCentreBlock && isCentreCell) return { ...base, role: "goal", theme: -1, action: -1 };
    if (isCentreBlock) return { ...base, role: "theme", theme: ringIndex(localRow, localCol), action: -1 };
    const theme = ringIndex(blockRow, blockCol);
    if (isCentreCell) return { ...base, role: "theme", theme, action: -1 };
    return { ...base, role: "action", theme, action: ringIndex(localRow, localCol) };
  });

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

  const sheet = jsonStore<Sheet>({
    goal: "Run my first marathon under four hours",
    deadline: nextOctober(),
    themes: THEMES,
    done: { "0:0": true, "0:3": true, "0:5": true, "2:2": true, "4:0": true, "4:1": true, "6:0": true, "7:0": true, "7:1": true },
  });

  const doneCount = $derived(Object.values(sheet.current.done).filter(Boolean).length);
  const deadlineLabel = $derived(formatDeadline(sheet.current.deadline));

  function nextOctober(): string {
    const now = new Date();
    const year = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-10-12`;
  }
  function formatDeadline(value: string): string {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) return "No date set";
    const days = Math.ceil((parsed.valueOf() - Date.now()) / 86_400_000);
    if (days > 1) return `${days} days out`;
    if (days === 1) return "Tomorrow";
    if (days === 0) return "Today";
    return "Passed";
  }

  function keyOf(theme: number, action: number): string { return `${theme}:${action}`; }
  function isDone(theme: number, action: number): boolean { return sheet.current.done[keyOf(theme, action)] === true; }
  function toggle(theme: number, action: number): void {
    const key = keyOf(theme, action);
    if (sheet.current.done[key]) delete sheet.current.done[key];
    else sheet.current.done[key] = true;
  }
  function titleOf(theme: number): string { return sheet.current.themes[theme]?.title.trim() || `Theme ${theme + 1}`; }

  // Below a comfortable editing width the sheet collapses to one 3×3 at a time. Capture
  // always overrides this in CSS, so an export is the whole chart no matter the window.
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

  onDestroy(() => sheet.destroy());
</script>

<main class="harada-canvas" data-slop-selection="none" bind:this={canvasEl}>
  <article class="page">
    <header class="masthead">
      <div class="crest" aria-hidden="true"></div>
      <div class="masthead-copy">
        <p class="wordmark">Open Window 64</p>
        <h1>Harada Method</h1>
      </div>
      <label class="target">
        <span>Target</span>
        <input type="date" aria-label="Target date" bind:value={sheet.current.deadline} />
        <em>{deadlineLabel}</em>
      </label>
      <div class="tally">
        <p class="tally-count"><b>{doneCount}</b><small>/ 64</small></p>
        <div class="tally-bar" aria-hidden="true"><span style="--fill: {doneCount / 64}"></span></div>
        <p class="tally-label">Actions taken</p>
      </div>
    </header>

    {#if zoomed}
      <nav class="zoom-bar" data-slop-export="hide" aria-label="Choose a block">
        {#each { length: 9 } as _, block (block)}
          <button type="button" class="zoom-key" class:zoom-key-on={focused === block} aria-pressed={focused === block} onclick={() => { focused = block; }}>
            {block === 4 ? "Goal" : titleOf(ringIndex(Math.floor(block / 3), block % 3))}
          </button>
        {/each}
      </nav>
      <p class="zoom-title" data-slop-export="hide">{blockLabel}</p>
    {/if}

    <div class="sheet" data-zoom={zoomed ? "on" : "off"}>
      {#each CELLS as cell (cell.row * 9 + cell.col)}
        <div
          class="cell"
          class:cell-away={zoomed && cell.block !== focused}
          class:cell-done={cell.role === "action" && isDone(cell.theme, cell.action)}
          data-role={cell.role}
          data-x={cell.edgeX}
          data-y={cell.edgeY}
        >
          {#if cell.role === "goal"}
            <textarea class="write" aria-label="Core goal" placeholder="The one goal" bind:value={sheet.current.goal}></textarea>
          {:else if cell.role === "theme"}
            <textarea class="write" aria-label="Theme {cell.theme + 1}" placeholder="Theme {cell.theme + 1}" bind:value={sheet.current.themes[cell.theme].title}></textarea>
          {:else}
            <textarea class="write" aria-label="{titleOf(cell.theme)}, action {cell.action + 1}" placeholder="—" bind:value={sheet.current.themes[cell.theme].cells[cell.action]}></textarea>
            <button
              type="button"
              class="tick"
              aria-pressed={isDone(cell.theme, cell.action)}
              aria-label="Mark done: {titleOf(cell.theme)}, action {cell.action + 1}"
              onclick={() => toggle(cell.theme, cell.action)}
            ></button>
          {/if}
        </div>
      {/each}
    </div>

    {#if sheet.error}<p class="friendly-error" data-slop-export="hide">Your latest changes couldn’t be saved.</p>{/if}
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
