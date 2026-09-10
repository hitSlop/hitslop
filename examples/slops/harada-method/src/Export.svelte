<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { Sheet } from "../schema";
  import { CELLS, formatDate, keyOf } from "./chart";
  import * as s from "./styles.css";

  let { data }: { data: Sheet } = $props();
  const doneCount = $derived(Object.values(data.done).filter(Boolean).length);
  const deadline = $derived(formatDate(data.deadline));

  function isDone(theme: number, action: number): boolean {
    return data.done[keyOf(theme, action)] === true;
  }
  function textOf(cell: typeof CELLS[number]): string {
    if (cell.role === "goal") return data.goal;
    if (cell.role === "theme") return data.themes[cell.theme]?.title ?? "";
    return data.themes[cell.theme]?.cells[cell.action] ?? "";
  }
</script>

<article class={s.exportPage} aria-label="Exported Open Window 64 chart">
  <header class={s.masthead}>
    <div class={s.crest} aria-hidden="true"></div>
    <div>
      <p class={s.wordmark}>Open Window 64</p>
      <h1 class={s.title}>Harada Method</h1>
    </div>
    <div class={s.target}>
      <span>Target</span>
      <strong>{deadline || "No date set"}</strong>
    </div>
    <div class={s.tally}>
      <p class={s.tallyCount}><b>{doneCount}</b><small>/ 64</small></p>
      <div class={s.tallyBar} aria-hidden="true"><span class={s.tallyFill} style:width={`${(doneCount / 64) * 100}%`}></span></div>
      <p class={s.tallyLabel}>Actions taken</p>
    </div>
  </header>

  <div class={s.exportSheet}>
    {#each CELLS as cell (cell.row * 9 + cell.col)}
      <div
        class={s.cell}
        data-role={cell.role}
        data-x={cell.edgeX}
        data-y={cell.edgeY}
        data-done={cell.role === "action" && isDone(cell.theme, cell.action)}
      >
        <div class={s.write}>{textOf(cell)}</div>
        {#if cell.role === "action" && isDone(cell.theme, cell.action)}
          <span class={s.tick} data-checkbox-root data-state="checked" aria-hidden="true"><Check size={8} strokeWidth={3} /></span>
        {/if}
      </div>
    {/each}
  </div>
</article>
