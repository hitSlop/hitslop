<script lang="ts">
  import { tasksByTime, type Planner } from "../schema";
  import { minutes, duration, label } from "./schedule";
  import * as s from "./styles.css";
  let { data }: { data: Planner } = $props();
</script>

<article class={s.exportPage}>
  <header class={s.header}>
    <div class={s.identity}>
      <span class={s.eyebrow}>Weekly planner</span>
      <h1 class={s.weekTitle}>{data.week || "This week"}</h1>
    </div>
    <p>{data.focus}</p>
  </header>
  <div class={s.exportDays}>
    {#each data.days as day}
      <section class={s.exportDay}>
        <h2>{day.name} <span class={s.date}>{day.date}</span></h2>
        {#each tasksByTime(day.tasks) as task}
          {@const start = minutes(task.time)}
          <div
            class={s.exportBlock}
            data-color={task.color ?? "sky"}
            data-done={task.done}
          >
            <strong>{task.done ? "✓ " : ""}{task.title || "Untitled"}</strong
            ><span class={s.blockTime}
              >{start === null
                ? "Anytime"
                : `${label(start)} – ${label(Math.min(1440, start + duration(task)))}`}</span
            >
          </div>
        {:else}<p class={s.description}>Open day</p>{/each}
      </section>
    {/each}
  </div>
</article>
