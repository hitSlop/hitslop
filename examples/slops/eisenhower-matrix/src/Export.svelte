<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { Matrix } from "../schema";
  import * as s from "./styles.css";

  const QUADRANTS: { key: "q1" | "q2" | "q3" | "q4"; num: string; title: string; subtitle: string; tag: string; empty: string }[] = [
    { key: "q1", num: "I", title: "Do First", subtitle: "Urgent & Important", tag: "Crises & Deadlines", empty: "No fires on the blotter." },
    { key: "q2", num: "II", title: "Schedule", subtitle: "Not Urgent & Important", tag: "Focus & Leverage", empty: "Nothing to grow yet." },
    { key: "q3", num: "III", title: "Delegate", subtitle: "Urgent & Not Important", tag: "Interruptions", empty: "Nothing to hand off." },
    { key: "q4", num: "IV", title: "Don’t Do", subtitle: "Not Urgent & Not Important", tag: "Eliminate", empty: "Nothing to drop." },
  ];

  let { data, ratio = 0, active = 0 }: { data: Matrix; ratio?: number; active?: number } = $props();
</script>

<article class={s.exportBlotter} aria-label="Exported Eisenhower matrix {data.title}">
  <header class={s.letterhead}>
    <div class={s.titleGroup}>
      <h1 class={s.title}>{data.title.trim() || "Priority Desk Blotter"}</h1>
      <p class={s.date}>{data.date.trim() || "Undated"}</p>
    </div>
    <div class={s.leverage} aria-label="Q2 leverage {ratio} percent">
      <span class={s.leverageRow}>
        <span>Q2 Leverage</span>
        <span class={s.leverageValue}>{ratio}%</span>
      </span>
      <span class={s.meter} aria-hidden="true"><span class={s.meterFill} style:width="{ratio}%"></span></span>
    </div>
    <span class={s.activeCount}>{active} open</span>
  </header>

  <div class={s.axis} aria-hidden="true">
    <span>◀ Urgent</span>
    <span>Not urgent ▶</span>
  </div>

  <div class={s.exportMatrix}>
    {#each QUADRANTS as q (q.key)}
      <section class={s.exportQuadrant} data-quad={q.key} aria-label="{q.title} tasks">
        <div class={s.quadHeader}>
          <div class={s.quadBadge}>
            <span class={s.roman} data-quad={q.key}>{q.num}</span>
            <div class={s.quadText}>
              <h2 class={s.quadTitle}>{q.title}</h2>
              <span class={s.quadSub}>{q.subtitle}</span>
            </div>
          </div>
          <span class={s.quadTag}>{q.tag}</span>
        </div>
        <ul class={s.exportList}>
          {#each data[q.key] as task (task.id)}
            <li class={s.row} data-done={task.done}>
              <span data-checkbox-root data-state={task.done ? "checked" : "unchecked"}>{#if task.done}<Check size={10} strokeWidth={3} />{/if}</span>
              <span class={s.exportText}>{task.text.trim() || "Untitled task"}</span>
            </li>
          {:else}
            <li class={s.empty}>{q.empty}</li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <footer class={s.tray}>
    <div class={s.trayHead}>
      <div class={s.trayTitle}>
        <h3 class={s.trayHeading}>Holding Pen</h3>
      </div>
      <span class={s.trayCount}>{data.inbox.length} parked</span>
    </div>
    {#if data.inbox.length > 0}
      <ul class={s.trayList} aria-label="Holding pen">
        {#each data.inbox as item (item.id)}
          <li class={s.inboxRow}>
            <span class={s.exportText}>{item.text.trim() || "Untitled task"}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class={s.empty}>Nothing waiting to be stamped.</p>
    {/if}
  </footer>
</article>
