<script lang="ts">
  import * as s from "./styles.css";
  let { percent = 65 }: { percent?: number } = $props();
  const fill = $derived(Math.max(18, Math.min(86, percent)));
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconShell}>
    <div class={s.iconChamber}>
      <div class={s.iconFill} style:height={`${fill}%`}><div class={s.iconWave}></div></div>
      <span class={s.iconDrop}>💧</span>
    </div>
    <div class={s.iconDots}><span></span><span></span><span></span><span></span></div>
  </div>
</div>
