<script lang="ts">
  import * as s from "./styles.css";

  let { filled = { q1: true, q2: true, q3: false, q4: false }, ratio = 0 }: {
    filled?: { q1: boolean; q2: boolean; q3: boolean; q4: boolean };
    ratio?: number;
  } = $props();
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconSheet}>
    <div class={s.iconHead}>
      <span class={s.iconTitle}></span>
      <span class={s.iconMeter}><span class={s.iconMeterFill} style:width="{Math.max(ratio, 12)}%"></span></span>
    </div>
    <div class={s.iconGrid}>
      <span class={s.iconQuad} data-quad="q1" data-filled={filled.q1}></span>
      <span class={s.iconQuad} data-quad="q2" data-filled={filled.q2}></span>
      <span class={s.iconQuad} data-quad="q3" data-filled={filled.q3}></span>
      <span class={s.iconQuad} data-quad="q4" data-filled={filled.q4}></span>
    </div>
  </article>
</div>
