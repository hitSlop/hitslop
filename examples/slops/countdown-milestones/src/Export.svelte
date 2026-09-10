<script lang="ts">
  import type { CountdownData } from "../schema";
  import type { CountdownState } from "./countdown";
  import CountdownFace from "./CountdownFace.svelte";
  import * as s from "./styles.css";
  let { data, state }: { data: CountdownData; state: CountdownState } =
    $props();
  const done = $derived(data.milestones.filter((m) => m.done).length);
</script>

<article class={s.exportShell}>
  <header class={s.header}>
    <span class={s.eyebrow}>A date to remember</span>
  </header>
  <CountdownFace {data} {state} />
  <div class={s.sectionHead}>
    <h2 class={s.sectionTitle}>Along the way</h2>
    <span class={s.eyebrow}>{done}/{data.milestones.length}</span>
  </div>
  <ol class={s.list}>
    {#each data.milestones as item}<li class={s.row}>
        <span
          class={s.check}
          data-state={item.done ? "checked" : "unchecked"}
          aria-label={item.done ? "Complete" : "Incomplete"}
          >{item.done ? "✓" : ""}</span
        ><span class={s.milestone} data-done={item.done}>{item.title}</span>
      </li>{:else}<li class={s.empty}>No milestones yet.</li>{/each}
  </ol>
</article>
