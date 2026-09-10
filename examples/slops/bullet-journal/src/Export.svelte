<script lang="ts">
  import type { BulletJournal } from "../schema";
  import { symbolFor } from "./signifiers";
  import * as s from "./styles.css";

  let { data, spread }: { data: BulletJournal; spread: "daily" | "monthly" } = $props();
  const openCount = $derived(data.entries.filter(item => item.type === "task" || item.type === "scheduled").length);
</script>

<article class={s.exportPage} aria-label={spread === "daily" ? "Exported daily rapid log" : "Exported monthly index"}>
  <span class={s.ribbon} aria-hidden="true"></span>
  {#if spread === "daily"}
    <div class={s.titleRow}>
      <h1 class={s.title}>{data.date.trim() || "Rapid log"}</h1>
      <span class={s.pageNumWrap}>pg. {data.dailyPage.trim() || "—"}</span>
    </div>
    <ul class={s.list}>
      {#each data.entries as item (item.id)}
        <li class={s.row} data-complete={item.type === "complete"}>
          <span class={s.exportStar} aria-hidden="true">{item.star ? "*" : ""}</span>
          <span class={s.exportMark} data-type={item.type}>{symbolFor(item.type)}</span>
          <span class={s.exportText}>{item.text.trim() || "Untitled"}</span>
        </li>
      {:else}
        <li class={s.empty}><h2>A blank page.</h2></li>
      {/each}
    </ul>
    <footer class={s.foot}>
      <span>{data.entries.length} bullets · {openCount} open</span>
      <span>Rapid log</span>
    </footer>
  {:else}
    <div class={s.titleRow}>
      <h1 class={s.title}>{data.monthTitle.trim() || "Monthly index"}</h1>
      <span class={s.pageNumWrap}>pg. {data.monthlyPage.trim() || "—"}</span>
    </div>
    <ul class={s.list}>
      {#each data.monthlyLog as item (item.id)}
        <li class={s.monthRow}>
          <span class={s.monthDay}>{String(item.day).padStart(2, "0")}</span>
          <span class={s.monthWeekday}>{item.weekday.trim() || "—"}</span>
          <span class={s.monthText}>{item.text.trim() || ""}</span>
        </li>
      {:else}
        <li class={s.empty}><h2>No days indexed.</h2></li>
      {/each}
    </ul>
    <footer class={s.foot}>
      <span>{data.monthlyLog.length} days indexed</span>
      <span>Monthly log</span>
    </footer>
  {/if}
</article>
