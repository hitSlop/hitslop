<script lang="ts">
  import type { CountdownData } from "../schema";
  import type { CountdownState } from "./countdown";
  import { displayDate } from "./countdown";
  import * as s from "./styles.css";
  let {
    data,
    state,
    onEdit,
  }: { data: CountdownData; state: CountdownState; onEdit?: () => void } =
    $props();
</script>

<section class={s.calendar} aria-label={state.accessible}>
  <span class={s.binding} style:left="22%" aria-hidden="true"></span><span
    class={s.binding}
    style:right="22%"
    aria-hidden="true"
  ></span>
  <h1 class={s.title}>{data.title || "Something to look forward to"}</h1>
  <div class={s.readout}>
    <strong class={s.number} data-long={state.value.length > 3}
      >{state.value}</strong
    >{#if state.kind !== "today"}<span class={s.unit}>{state.unit}</span>{/if}
    <p class={s.detail}>{state.detail}</p>
  </div>
  {#if onEdit}<button
      class={s.dateButton}
      onclick={onEdit}
      aria-label="Edit event date and time"
      >{displayDate(data.targetDate, data.targetTime)} ↗</button
    >{:else}<div class={s.dateButton}>
      {displayDate(data.targetDate, data.targetTime)}
    </div>{/if}
</section>
