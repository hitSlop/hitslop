<script lang="ts">
  import type { MoodLog } from "../schema";
  import theme from "../theme";
  import * as s from "./styles.css";
  let { data }: { data: MoodLog } = $props();
  const colors = ["", theme.vars.orb1, theme.vars.orb2, theme.vars.orb3, theme.vars.orb4, theme.vars.orb5];
</script>
<article class={s.exportSheet} aria-label="Exported mood log">
  <h1 class={s.prompt}>{data.prompt}</h1>
  <ul class={s.list}>
    {#each data.entries as item (item.id)}
      <li class={s.row}>
        <span class={s.entryOrb} style:background={colors[item.mood] ?? theme.vars.orb3}></span>
        <div class={s.meta}><span>{item.day}</span><small>⚡ {item.energy}/5</small></div>
        <p class={s.note}>{item.note}</p>
      </li>
    {/each}
  </ul>
</article>
