<script lang="ts">
  import type { Planner } from "../schema";
  import { formatDate, layout, toLabel, bookedMinutesOf } from "./schedule";
  import * as s from "./styles.css";
  let { data }: { data: Planner } = $props();
  const booked = $derived(bookedMinutesOf(data.blocks));
</script>

<article class={s.exportPage} aria-label="Exported daily planner">
  <header class={s.header}>
    <span class={s.eyebrow}>DAILY / PLANNER</span>
    <div class={s.headerMain}>
      <h1 class={s.title}>{formatDate(data.date, { weekday: "long" })}</h1>
      <span class={s.dateNumber}
        >{formatDate(data.date, { day: "2-digit" })}</span
      >
    </div>
    <p>
      {formatDate(data.date, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}
    </p>
  </header>
  <section class={s.priorities} style="max-height:none;overflow:visible">
    <h2 class={s.heading}>Make room for</h2>
    <ol class={s.priorityList}>
      {#each data.priorities as p, i}<li class={s.priority}>
          <span class={s.checkbox}>{p.done ? "✓" : i + 1}</span><span
            style:text-decoration={p.done ? "line-through" : "none"}
            >{p.text || "—"}</span
          >
        </li>{/each}
    </ol>
  </section>
  <div class={s.scheduleHead}>
    <h2 class={s.heading}>Your day</h2>
    <span class={s.meta}>{Math.floor(booked / 60)}h {booked % 60}m planned</span
    >
  </div>
  <div class={s.exportList}>
    {#each layout(data.blocks) as item}<section
        class={s.exportBlock}
        data-kind={item.block.kind}
      >
        <span class={s.meta}
          >{toLabel(item.start)}–{toLabel(item.end)} · {item.block.kind}</span
        >
        <h3 class={s.exportTitle}>{item.block.title || "Untitled block"}</h3>
      </section>{:else}<p>No time blocks yet.</p>{/each}
  </div>
  <section class={s.exportNotes}>
    <h2 class={s.heading}>Day notes</h2>
    {data.notes || "Nothing noted."}
  </section>
</article>
