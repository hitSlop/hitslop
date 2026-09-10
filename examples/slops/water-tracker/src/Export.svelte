<script lang="ts">
  import type { WaterTracker } from "../schema";
  import * as s from "./styles.css";
  let { data, percent }: { data: WaterTracker; percent: number } = $props();
</script>

<article class={s.exportFlask} aria-label="Exported water tracker">
  <header class={s.header}>
    <span class={s.brand}>Hydration 01</span>
    <span class={s.target}>Target {data.target} {data.unit}</span>
  </header>
  <div class={s.chamber} data-complete={percent >= 100}>
    <div class={s.liquid} style:transform={`translateY(${100 - Math.max(4, percent)}%)`} aria-hidden="true"><div class={s.waveCap} data-complete={percent >= 100}></div></div>
    <div class={s.readout}>
      {#if percent >= 100}<span class={s.badge}>Goal reached</span>{/if}
      <strong class={s.digits}>{data.current.toLocaleString()}</strong>
      <span class={s.unit}>{data.unit}</span>
      <span class={s.percent}>{percent}% of daily goal</span>
    </div>
  </div>
  <footer class={s.foot}><span>{data.logs.length ? `${data.logs.length} drinks logged` : "No drinks logged."}</span></footer>
</article>
